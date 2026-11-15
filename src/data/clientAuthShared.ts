export const DEMO_CLIENT_CABINET_EMAIL = 'director@transflot-leasing.ru';

const STRICT_EMAIL_REGEX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

const EMBEDDED_EMAIL_REGEX =
  /[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi;

export interface ClientAccountPublicProfile {
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
  displayName: string;
  defaultCompanyOrInn: string;
  linkedOrderCount: number;
  sessionEpoch?: number;
  avatarUrl?: string | null;
  avatarPresetId?: string | null;
}

/**
 * Нормализует и проверяет e-mail клиента (приводит к нижнему регистру, отсекает мусор по краям).
 */
export function normalizeClientEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .trim()
    .replace(/^[<("'`]+|[>)"'`,;]+$/g, '')
    .trim()
    .toLowerCase();
  if (cleaned.length < 5 || cleaned.length > 160) return null;
  if (cleaned.includes('..')) return null;
  if (!STRICT_EMAIL_REGEX.test(cleaned)) return null;
  const atIdx = cleaned.lastIndexOf('@');
  const domain = cleaned.slice(atIdx + 1);
  const tld = domain.split('.').pop() ?? '';
  if (tld.length < 2) return null;
  return cleaned;
}

/**
 * Извлекает первый валидный e-mail из произвольной контактной строки клиента
 * (например: «Анна +7 916 555-32-10 anna@company.ru» -> «anna@company.ru»).
 */
export function extractEmailFromContactText(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.includes('@')) return null;
  const direct = normalizeClientEmail(raw);
  if (direct) return direct;

  EMBEDDED_EMAIL_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EMBEDDED_EMAIL_REGEX.exec(raw)) !== null) {
    const normalized = normalizeClientEmail(match[0]);
    if (normalized) return normalized;
  }
  return null;
}

/**
 * Извлекает человекочитаемое имя из строки контакта (без телефона и без email), если оно есть.
 */
export function extractDisplayNameFromContact(rawContact: string): string {
  const stripped = rawContact
    .replace(EMBEDDED_EMAIL_REGEX, ' ')
    .replace(/\+?\d[\d\s()-]{6,}\d/g, ' ')
    .replace(/@[a-z0-9_]{3,}/gi, ' ')
    .replace(/[·|,;/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.slice(0, 80);
}
