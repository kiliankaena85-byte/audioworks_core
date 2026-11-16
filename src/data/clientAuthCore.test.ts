import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  buildClientSessionClearCookieHeader,
  buildClientSessionSetCookieHeader,
  canDirectBindOrdersToEmailSession,
  canExposeMagicLinkLocalPreview,
  CLIENT_SESSION_COOKIE_NAME,
  collectOrdersForClientEmail,
  createSeedClientAccounts,
  DEMO_CLIENT_CABINET_EMAIL,
  doesOrderBelongToClientEmail,
  extractDisplayNameFromContact,
  extractEmailFromContactText,
  issueClientMagicLinkToken,
  issueClientSessionToken,
  normalizeClientEmail,
  resolveOrderSubmissionClientEmail,
  upsertClientAccountRecord,
  verifyClientMagicLinkToken,
  verifyClientSessionToken,
} from './clientAuthCore.ts';

const TEST_SECRET = 'unit-test-hmac-secret-fmworks-2026';

test('normalizeClientEmail validates and normalizes client emails strictly', () => {
  assert.equal(normalizeClientEmail('  Anna.Ivanova@Company-Group.RU '), 'anna.ivanova@company-group.ru');
  assert.equal(normalizeClientEmail('<director@transflot-leasing.ru>,'), 'director@transflot-leasing.ru');
  assert.equal(normalizeClientEmail('not-an-email'), null);
  assert.equal(normalizeClientEmail('broken..dots@company.ru'), null);
  assert.equal(normalizeClientEmail('user@localhost'), null);
  assert.equal(normalizeClientEmail(''), null);
});

test('extractEmailFromContactText finds embedded email inside mixed phone/name contact line', () => {
  assert.equal(
    extractEmailFromContactText('Анна +7 (916) 555-32-10 · Anna.M@BrandStudio.ru'),
    'anna.m@brandstudio.ru'
  );
  assert.equal(extractEmailFromContactText('+7 916 555-32-10 · @telegram_handle'), null);
  assert.equal(
    extractDisplayNameFromContact('Анна Смирнова · +7 916 555-32-10 · anna@brand.ru'),
    'Анна Смирнова'
  );
});

test('resolveOrderSubmissionClientEmail prioritizes cabinetEmail, email delivery, contactLine, then session', () => {
  assert.equal(
    resolveOrderSubmissionClientEmail({
      cabinetEmail: 'CABINET@corp.ru',
      preferredDeliveryChannel: 'email',
      preferredDeliveryDetail: 'delivery@corp.ru',
      contactLine: 'contact@corp.ru',
      sessionEmail: 'session@corp.ru',
    }),
    'cabinet@corp.ru'
  );

  assert.equal(
    resolveOrderSubmissionClientEmail({
      cabinetEmail: '',
      preferredDeliveryChannel: 'email',
      preferredDeliveryDetail: 'Delivery@Corp.ru',
      contactLine: '+7 999 111-22-33',
    }),
    'delivery@corp.ru'
  );

  assert.equal(
    resolveOrderSubmissionClientEmail({
      cabinetEmail: '',
      preferredDeliveryChannel: 'messenger',
      preferredDeliveryDetail: 'Telegram',
      contactLine: 'Игорь +7 999 111-22-33 igor@holding.ru',
    }),
    'igor@holding.ru'
  );

  assert.equal(
    resolveOrderSubmissionClientEmail({
      cabinetEmail: '',
      preferredDeliveryChannel: 'cabinet',
      contactLine: '+7 999 111-22-33',
      sessionEmail: 'active@holding.ru',
    }),
    'active@holding.ru'
  );

  assert.equal(
    resolveOrderSubmissionClientEmail({
      preferredDeliveryChannel: 'messenger',
      preferredDeliveryDetail: 'Telegram',
      contactLine: '+7 999 111-22-33',
    }),
    null
  );
});

test('client session tokens verify cleanly, respect TTL/revocation, and isolate from admin tokens', () => {
  const nowMs = 1_760_000_000_000;
  const issued = issueClientSessionToken('Client@Example.ru', TEST_SECRET, {
    nowMs,
    ttlMs: 60_000,
  });
  assert.equal(issued.email, 'client@example.ru');

  const verified = verifyClientSessionToken(issued.token, TEST_SECRET, { nowMs: nowMs + 5_000 });
  assert.ok(verified);
  assert.equal(verified.email, 'client@example.ru');
  assert.equal(verified.role, 'client_cabinet');

  // Expired token fails
  assert.equal(
    verifyClientSessionToken(issued.token, TEST_SECRET, { nowMs: nowMs + 61_000 }),
    null
  );

  // Revoked nonce fails
  assert.equal(
    verifyClientSessionToken(issued.token, TEST_SECRET, {
      nowMs: nowMs + 5_000,
      isNonceRevoked: (n) => n === issued.nonce,
    }),
    null
  );

  // Studio admin token format (without `client-session-v1:` domain prefix) MUST be rejected
  const fakeAdminPayload = Buffer.from(
    JSON.stringify({
      role: 'client_cabinet',
      email: 'client@example.ru',
      exp: nowMs + 60_000,
      nonce: 'abc12345',
    }),
    'utf8'
  ).toString('base64url');
  const rawUnprefixedSig = crypto
    .createHmac('sha256', TEST_SECRET)
    .update(fakeAdminPayload)
    .digest('base64url');
  assert.equal(
    verifyClientSessionToken(`${fakeAdminPayload}.${rawUnprefixedSig}`, TEST_SECRET, { nowMs }),
    null
  );
});

test('magic-link tokens enforce signature, expiration, single-use nonce, and domain separation', () => {
  const nowMs = 1_760_000_000_000;
  const magic = issueClientMagicLinkToken('Repeat.Client@Company.ru', TEST_SECRET, {
    nowMs,
    ttlMs: 30 * 60_000,
  });

  // Magic token cannot be used directly as a session cookie token
  assert.equal(verifyClientSessionToken(magic.token, TEST_SECRET, { nowMs }), null);

  const consumed = new Set<string>();
  const firstCheck = verifyClientMagicLinkToken(magic.token, TEST_SECRET, {
    nowMs: nowMs + 10_000,
    isNonceConsumed: (n) => consumed.has(n),
  });
  assert.equal(firstCheck.ok, true);
  if (firstCheck.ok) {
    assert.equal(firstCheck.payload.email, 'repeat.client@company.ru');
    consumed.add(firstCheck.payload.nonce);
  }

  // Second attempt with same magic link fails with already_used
  const replayCheck = verifyClientMagicLinkToken(magic.token, TEST_SECRET, {
    nowMs: nowMs + 15_000,
    isNonceConsumed: (n) => consumed.has(n),
  });
  assert.deepEqual(replayCheck, { ok: false, reason: 'already_used' });

  // Expired check
  const expiredCheck = verifyClientMagicLinkToken(magic.token, TEST_SECRET, {
    nowMs: nowMs + 31 * 60_000,
  });
  assert.deepEqual(expiredCheck, { ok: false, reason: 'expired' });

  // Tampered signature check
  const tamperedCheck = verifyClientMagicLinkToken(`${magic.token}x`, TEST_SECRET, { nowMs });
  assert.deepEqual(tamperedCheck, { ok: false, reason: 'bad_signature' });
});

test('upsertClientAccountRecord and collectOrdersForClientEmail stitch orders across devices', () => {
  const initialSeeds = createSeedClientAccounts(1_760_000_000_000);
  assert.equal(initialSeeds[0].email, DEMO_CLIENT_CABINET_EMAIL);

  const step1 = upsertClientAccountRecord(initialSeeds, {
    email: 'Marketing@SeverStroy.ru',
    orderNumbersToLink: ['FM-2501'],
    contactLine: 'Мария +7 916 100-20-30 Marketing@SeverStroy.ru',
    companyOrInn: 'ООО «СеверСтрой» · ИНН 7707083893',
    markLoggedIn: true,
    nowIso: '2026-11-14T10:00:00.000Z',
  });
  assert.equal(step1.account.email, 'marketing@severstroy.ru');
  assert.equal(step1.account.displayName, 'Мария');
  assert.deepEqual(step1.account.linkedOrderNumbers, ['FM-2501']);

  const step2 = upsertClientAccountRecord(step1.accounts, {
    email: 'marketing@severstroy.ru',
    orderNumbersToLink: ['FM-2599', 'FM-2501'],
    nowIso: '2026-11-14T12:00:00.000Z',
  });
  assert.deepEqual(step2.account.linkedOrderNumbers, ['FM-2599', 'FM-2501']);

  const sampleOrders = [
    {
      orderNumber: 'FM-2400',
      createdAt: '2026-11-10T09:00:00.000Z',
      contact: '+7 900 111-22-33',
      preferredDeliveryChannel: 'email' as const,
      preferredDeliveryDetail: 'marketing@severstroy.ru',
    },
    {
      orderNumber: 'FM-2501',
      createdAt: '2026-11-14T10:00:00.000Z',
      clientEmail: 'marketing@severstroy.ru',
      contact: 'Мария +7 916 100-20-30',
      preferredDeliveryChannel: 'messenger' as const,
      preferredDeliveryDetail: 'Telegram',
    },
    {
      orderNumber: 'FM-2599',
      createdAt: '2026-11-14T12:00:00.000Z',
      contact: '+7 916 100-20-30 (с телефона без почты, привязан по токену)',
      preferredDeliveryChannel: 'cabinet' as const,
    },
    {
      orderNumber: 'FM-2605-ANON',
      createdAt: '2026-11-14T13:00:00.000Z',
      clientEmail: 'marketing@severstroy.ru',
      contact: '[ПДН УДАЛЕНЫ ПО 152-ФЗ]',
      pdnAnonymizedAt: '2026-11-14T14:00:00.000Z',
    },
    {
      orderNumber: 'FM-OTHER',
      createdAt: '2026-11-14T11:00:00.000Z',
      clientEmail: 'other@another.ru',
      contact: 'other@another.ru',
    },
  ];

  const collected = collectOrdersForClientEmail(
    sampleOrders,
    'MARKETING@severstroy.ru',
    step2.account
  );
  assert.deepEqual(
    collected.map((o) => o.orderNumber),
    ['FM-2599', 'FM-2501', 'FM-2400']
  );
  assert.equal(
    doesOrderBelongToClientEmail(sampleOrders[3], 'marketing@severstroy.ru', ['FM-2605-ANON']),
    false
  );
});

test('cookie builders set HttpOnly, Path=/api, SameSite=Lax, and Secure when requested', () => {
  const setHdr = buildClientSessionSetCookieHeader('tok.sig', 3600, true);
  assert.match(setHdr, new RegExp(`^${CLIENT_SESSION_COOKIE_NAME}=tok\\.sig`));
  assert.match(setHdr, /HttpOnly/);
  assert.match(setHdr, /Path=\/api/);
  assert.match(setHdr, /SameSite=Lax/);
  assert.match(setHdr, /Max-Age=3600/);
  assert.match(setHdr, /Secure/);

  const clearHdr = buildClientSessionClearCookieHeader(false);
  assert.match(clearHdr, /Max-Age=0/);
  assert.doesNotMatch(clearHdr, /Secure/);
});

test('canDirectBindOrdersToEmailSession blocks unverified account takeover and allows same-email session', () => {
  assert.equal(
    canDirectBindOrdersToEmailSession({
      verifiedSessionEmail: null,
      targetEmail: 'victim@company.ru',
    }),
    false
  );
  assert.equal(
    canDirectBindOrdersToEmailSession({
      verifiedSessionEmail: 'attacker@evil.ru',
      targetEmail: 'victim@company.ru',
    }),
    false
  );
  assert.equal(
    canDirectBindOrdersToEmailSession({
      verifiedSessionEmail: 'Director@TransFlot-Leasing.ru',
      targetEmail: '  director@transflot-leasing.ru ',
    }),
    true
  );
});

test('canExposeMagicLinkLocalPreview blocks JSON token leakage on production and gateway failures', () => {
  // Production + real customer email + gateway failure => MUST NOT leak magicLinkUrl in JSON
  assert.equal(
    canExposeMagicLinkLocalPreview({
      nodeEnv: 'production',
      email: 'cfo@company.ru',
      hasConfiguredGateway: true,
      gatewayFailed: true,
    }),
    false
  );

  // Production + real customer email + no gateway configured (unless explicit preview flag) => false
  assert.equal(
    canExposeMagicLinkLocalPreview({
      nodeEnv: 'production',
      email: 'cfo@company.ru',
      hasConfiguredGateway: false,
      gatewayFailed: false,
    }),
    false
  );

  // Production + isolated studio demo email without gateway => allowed for demo showcase
  assert.equal(
    canExposeMagicLinkLocalPreview({
      nodeEnv: 'production',
      email: DEMO_CLIENT_CABINET_EMAIL,
      hasConfiguredGateway: false,
      gatewayFailed: false,
    }),
    true
  );

  // Development without external gateway => allowed for local testing
  assert.equal(
    canExposeMagicLinkLocalPreview({
      nodeEnv: 'development',
      email: 'cfo@company.ru',
      hasConfiguredGateway: false,
      gatewayFailed: false,
    }),
    true
  );

  // Development when configured gateway fails for non-demo email => blocked
  assert.equal(
    canExposeMagicLinkLocalPreview({
      nodeEnv: 'development',
      email: 'cfo@company.ru',
      hasConfiguredGateway: true,
      gatewayFailed: true,
    }),
    false
  );
});
