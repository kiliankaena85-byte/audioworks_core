import crypto from 'node:crypto';
import {
  type ClientAccountPublicProfile,
  DEMO_CLIENT_CABINET_EMAIL,
  extractDisplayNameFromContact,
  extractEmailFromContactText,
  normalizeClientEmail,
} from './clientAuthShared.ts';
import type { CrmOrderRecord } from './orderCrmTypes.ts';
import { anonymizeCrmOrderPdnRecord } from './orderCrmTypes.ts';

export {
  DEMO_CLIENT_CABINET_EMAIL,
  extractDisplayNameFromContact,
  extractEmailFromContactText,
  normalizeClientEmail,
};
export type { ClientAccountPublicProfile };

export const CLIENT_SESSION_COOKIE_NAME = 'fmworks_client_session';

/** 30 суток жизни клиентской сессии в браузере */
export const CLIENT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CLIENT_SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60;

/** 30 минут жизни одноразовой magic-ссылки для входа с другого устройства */
export const CLIENT_MAGIC_LINK_TTL_MS = 30 * 60 * 1000;

export interface ClientAccountRecord {
  email: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  displayName: string;
  defaultCompanyOrInn: string;
  linkedOrderNumbers: string[];
}

export interface VerifiedClientSessionPayload {
  role: 'client_cabinet';
  email: string;
  exp: number;
  nonce: string;
}

export interface VerifiedMagicLinkPayload {
  purpose: 'client_magic_login';
  email: string;
  exp: number;
  nonce: string;
}

function safeCompareDigest(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Определяет итоговый e-mail клиента при оформлении заказа из всех доступных источников:
 * 1) явное поле `cabinetEmail` (если выбран «Личный кабинет» и введена почта),
 * 2) поле `preferredDeliveryDetail`, если выбран канал `email`,
 * 3) e-mail, указанный прямо в строке контакта `contactLine`,
 * 4) уже активная авторизованная сессия клиента `sessionEmail`.
 */
export function resolveOrderSubmissionClientEmail(params: {
  cabinetEmail?: unknown;
  preferredDeliveryChannel?: unknown;
  preferredDeliveryDetail?: unknown;
  contactLine?: unknown;
  sessionEmail?: string | null;
}): string | null {
  const fromCabinetField = normalizeClientEmail(params.cabinetEmail);
  if (fromCabinetField) return fromCabinetField;

  if (params.preferredDeliveryChannel === 'email') {
    const fromDeliveryEmail = normalizeClientEmail(params.preferredDeliveryDetail);
    if (fromDeliveryEmail) return fromDeliveryEmail;
  }

  const fromContact = extractEmailFromContactText(params.contactLine);
  if (fromContact) return fromContact;

  const fromSession = normalizeClientEmail(params.sessionEmail);
  if (fromSession) return fromSession;

  return null;
}

/**
 * Выпускает подписанный токен клиентской сессии с изолированным доменным префиксом `client-session-v1:`.
 * Токен физически несовместим с админской сессией `/admin`.
 */
export function issueClientSessionToken(
  rawEmail: string,
  secret: string,
  options: { nowMs?: number; ttlMs?: number } = {}
): { token: string; email: string; expiresAt: number; nonce: string } {
  const email = normalizeClientEmail(rawEmail);
  if (!email) {
    throw new Error('Invalid client email for session token');
  }
  const nowMs = options.nowMs ?? Date.now();
  const ttlMs = options.ttlMs ?? CLIENT_SESSION_TTL_MS;
  const expiresAt = nowMs + ttlMs;
  const nonce = crypto.randomBytes(16).toString('hex');

  const payloadB64 = Buffer.from(
    JSON.stringify({
      role: 'client_cabinet',
      email,
      exp: expiresAt,
      nonce,
    } satisfies VerifiedClientSessionPayload),
    'utf8'
  ).toString('base64url');

  const sig = crypto
    .createHmac('sha256', secret)
    .update(`client-session-v1:${payloadB64}`)
    .digest('base64url');

  return {
    token: `${payloadB64}.${sig}`,
    email,
    expiresAt,
    nonce,
  };
}

export function verifyClientSessionToken(
  rawToken: string | undefined | null,
  secret: string,
  options: {
    nowMs?: number;
    isNonceRevoked?: (nonce: string) => boolean;
  } = {}
): VerifiedClientSessionPayload | null {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const parts = rawToken.trim().split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, providedSig] = parts;
  if (!payloadB64 || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`client-session-v1:${payloadB64}`)
    .digest('base64url');

  if (!safeCompareDigest(providedSig, expectedSig)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as Partial<VerifiedClientSessionPayload>;
    if (parsed.role !== 'client_cabinet') return null;
    const email = normalizeClientEmail(parsed.email);
    if (!email) return null;
    const nowMs = options.nowMs ?? Date.now();
    if (typeof parsed.exp !== 'number' || !Number.isFinite(parsed.exp) || parsed.exp < nowMs) {
      return null;
    }
    const nonce = typeof parsed.nonce === 'string' ? parsed.nonce : '';
    if (!nonce) return null;
    if (options.isNonceRevoked?.(nonce)) {
      return null;
    }
    return {
      role: 'client_cabinet',
      email,
      exp: parsed.exp,
      nonce,
    };
  } catch {
    return null;
  }
}

/**
 * Выпускает одноразовый короткоживущий токен для входа по magic-ссылке (`client-magic-v1:`).
 */
export function issueClientMagicLinkToken(
  rawEmail: string,
  secret: string,
  options: { nowMs?: number; ttlMs?: number } = {}
): { token: string; email: string; expiresAt: number; nonce: string } {
  const email = normalizeClientEmail(rawEmail);
  if (!email) {
    throw new Error('Invalid client email for magic link');
  }
  const nowMs = options.nowMs ?? Date.now();
  const ttlMs = options.ttlMs ?? CLIENT_MAGIC_LINK_TTL_MS;
  const expiresAt = nowMs + ttlMs;
  const nonce = crypto.randomBytes(18).toString('hex');

  const payloadB64 = Buffer.from(
    JSON.stringify({
      purpose: 'client_magic_login',
      email,
      exp: expiresAt,
      nonce,
    } satisfies VerifiedMagicLinkPayload),
    'utf8'
  ).toString('base64url');

  const sig = crypto
    .createHmac('sha256', secret)
    .update(`client-magic-v1:${payloadB64}`)
    .digest('base64url');

  return {
    token: `${payloadB64}.${sig}`,
    email,
    expiresAt,
    nonce,
  };
}

export function verifyClientMagicLinkToken(
  rawToken: string | undefined | null,
  secret: string,
  options: {
    nowMs?: number;
    isNonceConsumed?: (nonce: string) => boolean;
  } = {}
):
  | { ok: true; payload: VerifiedMagicLinkPayload }
  | { ok: false; reason: 'invalid_format' | 'bad_signature' | 'expired' | 'already_used' } {
  if (!rawToken || typeof rawToken !== 'string') {
    return { ok: false, reason: 'invalid_format' };
  }
  const parts = rawToken.trim().split('.');
  if (parts.length !== 2) {
    return { ok: false, reason: 'invalid_format' };
  }
  const [payloadB64, providedSig] = parts;
  if (!payloadB64 || !providedSig) {
    return { ok: false, reason: 'invalid_format' };
  }

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`client-magic-v1:${payloadB64}`)
    .digest('base64url');

  if (!safeCompareDigest(providedSig, expectedSig)) {
    return { ok: false, reason: 'bad_signature' };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as Partial<VerifiedMagicLinkPayload>;
    if (parsed.purpose !== 'client_magic_login') {
      return { ok: false, reason: 'invalid_format' };
    }
    const email = normalizeClientEmail(parsed.email);
    const nonce = typeof parsed.nonce === 'string' ? parsed.nonce : '';
    if (!email || !nonce || typeof parsed.exp !== 'number' || !Number.isFinite(parsed.exp)) {
      return { ok: false, reason: 'invalid_format' };
    }
    const nowMs = options.nowMs ?? Date.now();
    if (parsed.exp < nowMs) {
      return { ok: false, reason: 'expired' };
    }
    if (options.isNonceConsumed?.(nonce)) {
      return { ok: false, reason: 'already_used' };
    }
    return {
      ok: true,
      payload: {
        purpose: 'client_magic_login',
        email,
        exp: parsed.exp,
        nonce,
      },
    };
  } catch {
    return { ok: false, reason: 'invalid_format' };
  }
}

export function buildClientSessionSetCookieHeader(
  token: string,
  maxAgeSec: number,
  isSecure: boolean
): string {
  const parts = [
    `${CLIENT_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/api',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`,
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function buildClientSessionClearCookieHeader(isSecure: boolean): string {
  const parts = [
    `${CLIENT_SESSION_COOKIE_NAME}=`,
    'Path=/api',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function sanitizeClientAccountRecord(raw: unknown): ClientAccountRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<ClientAccountRecord>;
  const email = normalizeClientEmail(obj.email);
  if (!email) return null;
  const nowIso = new Date().toISOString();
  const linked = Array.isArray(obj.linkedOrderNumbers)
    ? Array.from(
        new Set(
          obj.linkedOrderNumbers
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            .map((s) => s.trim())
        )
      ).slice(0, 200)
    : [];
  return {
    email,
    createdAt: typeof obj.createdAt === 'string' && obj.createdAt ? obj.createdAt : nowIso,
    updatedAt: typeof obj.updatedAt === 'string' && obj.updatedAt ? obj.updatedAt : nowIso,
    lastLoginAt:
      typeof obj.lastLoginAt === 'string' && obj.lastLoginAt ? obj.lastLoginAt : null,
    displayName: typeof obj.displayName === 'string' ? obj.displayName.slice(0, 80) : '',
    defaultCompanyOrInn:
      typeof obj.defaultCompanyOrInn === 'string'
        ? obj.defaultCompanyOrInn.slice(0, 200)
        : '',
    linkedOrderNumbers: linked,
  };
}

/**
 * Создаёт или обновляет беспарольный аккаунт клиента по e-mail, привязывая номера заказов.
 */
export function upsertClientAccountRecord(
  accounts: readonly ClientAccountRecord[],
  input: {
    email: string;
    orderNumbersToLink?: readonly string[];
    contactLine?: string;
    companyOrInn?: string;
    markLoggedIn?: boolean;
    nowIso?: string;
  }
): { accounts: ClientAccountRecord[]; account: ClientAccountRecord } {
  const email = normalizeClientEmail(input.email);
  if (!email) {
    throw new Error('Cannot upsert client account with invalid email');
  }
  const nowIso = input.nowIso ?? new Date().toISOString();
  const idx = accounts.findIndex((a) => a.email === email);
  const existing = idx >= 0 ? accounts[idx] : null;

  const extractedName = input.contactLine
    ? extractDisplayNameFromContact(input.contactLine)
    : '';
  const cleanCompany = (input.companyOrInn ?? '').trim().slice(0, 200);
  const incomingOrders = (input.orderNumbersToLink ?? [])
    .map((s) => s.trim())
    .filter(Boolean);

  const mergedOrders = Array.from(
    new Set([...incomingOrders, ...(existing?.linkedOrderNumbers ?? [])])
  ).slice(0, 200);

  const updated: ClientAccountRecord = {
    email,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    lastLoginAt: input.markLoggedIn ? nowIso : existing?.lastLoginAt ?? null,
    displayName: extractedName || existing?.displayName || '',
    defaultCompanyOrInn: cleanCompany || existing?.defaultCompanyOrInn || '',
    linkedOrderNumbers: mergedOrders,
  };

  const nextAccounts =
    idx >= 0
      ? accounts.map((a, i) => (i === idx ? updated : a))
      : [updated, ...accounts].slice(0, 2000);

  return {
    accounts: nextAccounts,
    account: updated,
  };
}

/**
 * Проверяет, принадлежит ли заказ указанному нормализованному e-mail клиента
 * (по полю `clientEmail`, по e-mail доставки, по e-mail в контакте или по явной связке аккаунта).
 */
export function doesOrderBelongToClientEmail(
  order: Pick<
    CrmOrderRecord,
    | 'orderNumber'
    | 'clientEmail'
    | 'contact'
    | 'preferredDeliveryChannel'
    | 'preferredDeliveryDetail'
    | 'pdnAnonymizedAt'
  >,
  normalizedEmail: string,
  explicitLinkedOrderNumbers: readonly string[] = []
): boolean {
  if (order.pdnAnonymizedAt) return false;
  const target = normalizeClientEmail(normalizedEmail);
  if (!target) return false;

  if (order.clientEmail && normalizeClientEmail(order.clientEmail) === target) {
    return true;
  }
  if (
    order.preferredDeliveryChannel === 'email' &&
    normalizeClientEmail(order.preferredDeliveryDetail) === target
  ) {
    return true;
  }
  if (extractEmailFromContactText(order.contact) === target) {
    return true;
  }
  if (explicitLinkedOrderNumbers.includes(order.orderNumber)) {
    return true;
  }
  return false;
}

/**
 * Собирает все неанонимизированные заказы клиента по e-mail (от новых к старым).
 */
export function collectOrdersForClientEmail<
  T extends Pick<
    CrmOrderRecord,
    | 'orderNumber'
    | 'createdAt'
    | 'clientEmail'
    | 'contact'
    | 'preferredDeliveryChannel'
    | 'preferredDeliveryDetail'
    | 'pdnAnonymizedAt'
  >,
>(
  orders: readonly T[],
  rawEmail: string,
  account?: Pick<ClientAccountRecord, 'linkedOrderNumbers'> | null
): T[] {
  const email = normalizeClientEmail(rawEmail);
  if (!email) return [];
  const linked = account?.linkedOrderNumbers ?? [];

  return orders
    .filter((ord) => doesOrderBelongToClientEmail(ord, email, linked))
    .sort((a, b) => {
      const tsA = Date.parse(a.createdAt) || 0;
      const tsB = Date.parse(b.createdAt) || 0;
      return tsB - tsA;
    });
}

export function toClientAccountPublicProfile(
  account: ClientAccountRecord,
  matchedOrderCount: number
): ClientAccountPublicProfile {
  return {
    email: account.email,
    createdAt: account.createdAt,
    lastLoginAt: account.lastLoginAt,
    displayName: account.displayName,
    defaultCompanyOrInn: account.defaultCompanyOrInn,
    linkedOrderCount: Math.max(matchedOrderCount, account.linkedOrderNumbers.length),
  };
}

/**
 * Стартовый демо-аккаунт постоянного клиента (связан с заказом FM-HOLD-2854),
 * чтобы беспарольный вход по magic-ссылке можно было проверить на готовой истории с мастер-файлами.
 */
export function createSeedClientAccounts(nowMs = Date.now()): ClientAccountRecord[] {
  const createdIso = new Date(nowMs - 48 * 3600_000).toISOString();
  return [
    {
      email: DEMO_CLIENT_CABINET_EMAIL,
      createdAt: createdIso,
      updatedAt: createdIso,
      lastLoginAt: createdIso,
      displayName: 'Дмитрий (отдел лизинга)',
      defaultCompanyOrInn: 'АО «ТрансФлот Лизинг» · ИНН 7702070139',
      linkedOrderNumbers: ['FM-HOLD-2854'],
    },
  ];
}

// Re-export helper check to ensure anonymized orders drop clientEmail too when called via CRM
export { anonymizeCrmOrderPdnRecord };
