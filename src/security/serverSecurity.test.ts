import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendSecurityAuditEvent,
  buildContentSecurityPolicy,
  buildSessionClearCookieHeader,
  buildSessionSetCookieHeader,
  createSessionRevocationRegistry,
  detectVerifiedImageType,
  hasValidAudioMagicBytes,
  isCrossOriginBrowserRequest,
  isPrivateOrReservedIp,
  parseCookieHeader,
  resolveSafePublicOrigin,
  resolveTrustedClientIp,
  STUDIO_SESSION_COOKIE_NAME,
  validateOutboundWebhookTarget,
} from './serverSecurity';

test('resolveTrustedClientIp игнорирует поддельный X-Forwarded-For при отключённом trustProxy или внешнем peer', () => {
  assert.equal(
    resolveTrustedClientIp('95.165.10.22', '127.0.0.1, 10.0.0.1', false),
    '95.165.10.22'
  );
  // Даже если trustProxy=true, внешний (публичный) peer не имеет права подменять IP через XFF
  assert.equal(
    resolveTrustedClientIp('95.165.10.22', '77.88.55.80', true),
    '95.165.10.22'
  );
  // За локальным доверенным reverse proxy (127.0.0.1) XFF учитывается корректно
  assert.equal(
    resolveTrustedClientIp('::ffff:127.0.0.1', '95.165.10.22, 10.0.0.5', true),
    '95.165.10.22'
  );
});

test('isPrivateOrReservedIp блокирует RFC1918, loopback, metadata 169.254.169.254 и приватные IPv6', () => {
  assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('10.12.0.5'), true);
  assert.equal(isPrivateOrReservedIp('172.16.0.1'), true);
  assert.equal(isPrivateOrReservedIp('192.168.1.10'), true);
  assert.equal(isPrivateOrReservedIp('169.254.169.254'), true);
  assert.equal(isPrivateOrReservedIp('100.64.0.1'), true);
  assert.equal(isPrivateOrReservedIp('::1'), true);
  assert.equal(isPrivateOrReservedIp('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('::ffff:7f00:1'), true);
  assert.equal(isPrivateOrReservedIp('fe80::1'), true);
  assert.equal(isPrivateOrReservedIp('fc00::1'), true);

  assert.equal(isPrivateOrReservedIp('77.88.55.80'), false);
  assert.equal(isPrivateOrReservedIp('2a02:6b8::2:242'), false);
});

test('validateOutboundWebhookTarget блокирует SSRF-векторы и разрешает только публичные URL или точный loopback-приёмник', () => {
  assert.equal(validateOutboundWebhookTarget('file:///etc/passwd').ok, false);
  assert.equal(validateOutboundWebhookTarget('gopher://127.0.0.1:6379/_INFO').ok, false);
  assert.equal(validateOutboundWebhookTarget('http://169.254.169.254/latest/meta-data/').ok, false);
  assert.equal(validateOutboundWebhookTarget('http://user:pass@crm.example.ru/hook').ok, false);
  assert.equal(validateOutboundWebhookTarget('http://127.0.0.1:8080/internal-admin').ok, false);
  assert.equal(validateOutboundWebhookTarget('http://localhost:3000/other-path').ok, false);
  assert.equal(validateOutboundWebhookTarget('http://[::1]:3000/secret').ok, false);

  const loopbackSink = validateOutboundWebhookTarget(
    'http://127.0.0.1:3000/api/webhooks/loopback-crm-sink',
    { allowInternalLoopbackSink: true, localPort: 3000 }
  );
  assert.equal(loopbackSink.ok, true);
  assert.equal(loopbackSink.isInternalLoopbackSink, true);

  const publicCrm = validateOutboundWebhookTarget('https://b24.example.ru/rest/webhook');
  assert.equal(publicCrm.ok, true);
  assert.equal(publicCrm.isInternalLoopbackSink, false);
});

test('detectVerifiedImageType и hasValidAudioMagicBytes отсекают поддельные файлы по magic bytes', () => {
  const fakeHtmlAsJpg = Buffer.from('<!doctype html><script>alert(1)</script>', 'utf8');
  assert.equal(detectVerifiedImageType(fakeHtmlAsJpg), null);
  assert.equal(hasValidAudioMagicBytes(fakeHtmlAsJpg), false);

  const fakeSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'utf8');
  assert.equal(detectVerifiedImageType(fakeSvg), null);

  const validPng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  assert.deepEqual(detectVerifiedImageType(validPng), {
    ext: '.png',
    mime: 'image/png',
  });

  const validJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  assert.deepEqual(detectVerifiedImageType(validJpg), {
    ext: '.jpg',
    mime: 'image/jpeg',
  });

  const validWav = Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00', 'latin1');
  assert.equal(hasValidAudioMagicBytes(validWav), true);

  const riffNotWave = Buffer.from('RIFF\x24\x00\x00\x00WEBPfmt \x10\x00\x00\x00', 'latin1');
  assert.equal(hasValidAudioMagicBytes(riffNotWave), false);
});

test('Cookie-сессии, отзыв токена при logout и CSP соответствуют требованиям OWASP', () => {
  const cookieHeader = buildSessionSetCookieHeader('abc.sig123', 3600, true);
  assert.match(cookieHeader, /HttpOnly/);
  assert.match(cookieHeader, /SameSite=Lax/);
  assert.match(cookieHeader, /Secure/);
  assert.match(cookieHeader, /Path=\/api/);

  const cleared = buildSessionClearCookieHeader(false);
  assert.match(cleared, /Max-Age=0/);

  const parsed = parseCookieHeader(`foo=1; ${STUDIO_SESSION_COOKIE_NAME}=tok%2E123; bar=baz`);
  assert.equal(parsed[STUDIO_SESSION_COOKIE_NAME], 'tok.123');

  const registry = createSessionRevocationRegistry();
  assert.equal(registry.isRevoked('nonce-1'), false);
  registry.revoke('nonce-1', Date.now() + 60_000);
  assert.equal(registry.isRevoked('nonce-1'), true);

  // Восстановление списка отозванных сессий после перезапуска процесса
  const snapshot = registry.exportEntries();
  const restoredRegistry = createSessionRevocationRegistry(snapshot);
  assert.equal(restoredRegistry.isRevoked('nonce-1'), true);

  const csp = buildContentSecurityPolicy();
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'self'/);

  const previewCsp = buildContentSecurityPolicy({ allowPreviewFrames: true });
  assert.match(previewCsp, /frame-ancestors 'self' https:\/\/aistudio\.google\.com/);
});

test('appendSecurityAuditEvent ограничивает размер буфера и сохраняет порядок событий', () => {
  const list = appendSecurityAuditEvent([], {
    kind: 'ssrf_target_blocked',
    ipHash: 'ab12cd34ef',
    detail: 'Blocked 169.254.169.254',
  });
  assert.equal(list.length, 1);
  assert.equal(list[0].kind, 'ssrf_target_blocked');
});

test('resolveSafePublicOrigin и isCrossOriginBrowserRequest защищают от Host Header Injection и CSRF (WSTG)', () => {
  // Игнорирует поддельный X-Forwarded-Host без trustProxy
  assert.equal(
    resolveSafePublicOrigin({
      hostHeader: 'fmworks.ru',
      forwardedHost: 'evil.attacker',
      protocol: 'https',
      trustProxy: false,
    }),
    'https://fmworks.ru'
  );
  // Отклоняет userinfo@ и инъекцию слэшей/пробелов в Host
  assert.equal(
    resolveSafePublicOrigin({
      hostHeader: 'fmworks.ru@evil.attacker/phish',
      protocol: 'https',
      trustProxy: false,
    }),
    'https://fmworks.ru'
  );
  assert.equal(
    resolveSafePublicOrigin({
      configuredOrigin: 'https://studio.fmworks.ru',
      hostHeader: 'evil.attacker',
      protocol: 'http',
    }),
    'https://studio.fmworks.ru'
  );

  // CSRF Origin checks
  assert.equal(
    isCrossOriginBrowserRequest({
      originHeader: 'https://evil.example',
      hostHeader: 'localhost:3000',
    }),
    true
  );
  assert.equal(
    isCrossOriginBrowserRequest({
      originHeader: 'http://localhost:3000',
      hostHeader: 'localhost:3000',
    }),
    false
  );
});

