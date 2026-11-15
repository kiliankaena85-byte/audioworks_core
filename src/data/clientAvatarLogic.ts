import { deriveWebpUrl } from '../utils/imageOptimization.ts';

export type ClientAvatarPresetId =
  | 'vermilion_wave'
  | 'titanium_diffuser'
  | 'slate_acoustic'
  | 'emerald_stone';

export interface ClientAbstractAvatarPreset {
  id: ClientAvatarPresetId;
  shortLabel: string;
  title: string;
  imageUrl: string;
  webpUrl: string | null;
  fallbackBgClass: string;
}

/**
 * Студийные абстрактные фоны 1:1, созданные через инструмент генерации изображений
 * в акустической и архитектурной эстетике FMWorks.
 * Используются как персональный аватар с монограммой инициалов, когда у клиента нет фото профиля.
 */
export const CLIENT_ABSTRACT_AVATAR_PRESETS: readonly ClientAbstractAvatarPreset[] = [
  {
    id: 'vermilion_wave',
    shortLabel: 'Киноварь',
    title: 'Акустическая волна · обсидиан и киноварь',
    imageUrl: '/src/assets/images/avatar_vermilion_wave_1794695842553.jpg',
    webpUrl: deriveWebpUrl('/src/assets/images/avatar_vermilion_wave_1794695842553.jpg'),
    fallbackBgClass: 'bg-gradient-to-br from-[#2B120C] via-[#16161B] to-[#8F2A14]',
  },
  {
    id: 'titanium_diffuser',
    shortLabel: 'Титан',
    title: 'Студийный диффузор · тёмный титан и бронза',
    imageUrl: '/src/assets/images/avatar_titanium_diffuser_1794695843210.jpg',
    webpUrl: deriveWebpUrl('/src/assets/images/avatar_titanium_diffuser_1794695843210.jpg'),
    fallbackBgClass: 'bg-gradient-to-br from-[#241E17] via-[#17181D] to-[#785A32]',
  },
  {
    id: 'slate_acoustic',
    shortLabel: 'Кобальт',
    title: 'Архитектурное стекло · графит и кобальт',
    imageUrl: '/src/assets/images/avatar_slate_acoustic_1794695844961.jpg',
    webpUrl: deriveWebpUrl('/src/assets/images/avatar_slate_acoustic_1794695844961.jpg'),
    fallbackBgClass: 'bg-gradient-to-br from-[#101829] via-[#151821] to-[#1E3A8A]',
  },
  {
    id: 'emerald_stone',
    shortLabel: 'Изумруд',
    title: 'Акустический рельеф · базальт и изумруд',
    imageUrl: '/src/assets/images/avatar_emerald_stone_1794695844753.jpg',
    webpUrl: deriveWebpUrl('/src/assets/images/avatar_emerald_stone_1794695844753.jpg'),
    fallbackBgClass: 'bg-gradient-to-br from-[#0F2019] via-[#15181B] to-[#14532D]',
  },
] as const;

const VALID_PRESET_IDS = new Set<string>(
  CLIENT_ABSTRACT_AVATAR_PRESETS.map((item) => item.id)
);

/**
 * Юридические организационно-правовые формы и служебные маркеры, которые не должны
 * попадать в монограмму инициалов клиента или бренда.
 */
const IGNORED_LEGAL_WORDS = new Set<string>([
  'ооо',
  'ао',
  'пао',
  'зао',
  'нао',
  'оао',
  'ип',
  'гк',
  'ано',
  'фгуп',
  'муп',
  'инн',
  'кпп',
  'огрн',
  'огрнип',
  'отдел',
  'департамент',
  'компания',
  'группа',
  'llc',
  'inc',
  'ltd',
  'corp',
  'gmbh',
]);

export interface ClientAvatarIdentityInput {
  displayName?: string | null;
  contactLine?: string | null;
  companyOrInn?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  localPreviewDataUrl?: string | null;
  avatarPresetId?: string | null;
}

export interface ResolvedClientAvatarModel {
  initials: string;
  hasCustomPhoto: boolean;
  customPhotoUrl: string | null;
  customPhotoWebpUrl: string | null;
  preset: ClientAbstractAvatarPreset;
  accessibleLabel: string;
}

export function sanitizeClientAvatarPresetId(
  raw: unknown
): ClientAvatarPresetId | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return VALID_PRESET_IDS.has(trimmed) ? (trimmed as ClientAvatarPresetId) : null;
}

/**
 * Разрешает только проверенные локальные пути загруженных фото профиля (`/assets/cms/...`).
 */
export function sanitizeClientAvatarUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 320) return null;
  if (/[\s"'<>\\]/.test(trimmed) || trimmed.includes('..')) return null;
  if (
    trimmed.startsWith('/assets/cms/') &&
    /\.(jpe?g|png|webp|avif)$/i.test(trimmed)
  ) {
    return trimmed;
  }
  return null;
}

function sanitizeLocalPreviewImageDataUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 5_600_000) return null;
  if (/^data:image\/(?:jpeg|png|webp|avif);base64,[a-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function stripNoiseForPersonTokens(raw: string): string[] {
  const withoutParens = raw
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, ' ')
    .replace(/@[a-z0-9_]{2,}/gi, ' ')
    .replace(/\+?\d[\d\s()-]{5,}\d/g, ' ');

  const words = withoutParens.match(/\p{L}+/gu) ?? [];
  return words.filter((word) => !IGNORED_LEGAL_WORDS.has(word.toLocaleLowerCase('ru-RU')));
}

function extractBrandTokensFromCompany(rawCompany: string): string[] {
  // Если в кавычках указано собственное название («ТрансФлот Лизинг»), берём его в приоритете
  const quotedMatch = rawCompany.match(/«([^»]+)»|"([^"]+)"/);
  const target = quotedMatch ? (quotedMatch[1] ?? quotedMatch[2] ?? rawCompany) : rawCompany;
  const withoutInn = target.replace(/инн\s*\d+/giu, ' ');
  const words = withoutInn.match(/\p{L}+/gu) ?? [];
  return words.filter((word) => !IGNORED_LEGAL_WORDS.has(word.toLocaleLowerCase('ru-RU')));
}

function extractTokensFromEmail(rawEmail: string): string[] {
  const trimmed = rawEmail.trim();
  const atIdx = trimmed.indexOf('@');
  if (atIdx <= 0) return [];
  const localPart = trimmed.slice(0, atIdx);
  const domainPart = trimmed.slice(atIdx + 1).split('.')[0] ?? '';

  const localWords = localPart.match(/\p{L}+/gu) ?? [];
  if (localWords.length >= 2) {
    return localWords;
  }
  const domainWords = domainPart.match(/\p{L}+/gu) ?? [];
  const firstLocal = localWords[0];
  const firstDomain = domainWords[0];
  if (localWords.length === 1 && firstLocal && firstDomain) {
    return [firstLocal, firstDomain];
  }
  return localWords;
}

function toUpperFirstChar(word: string): string {
  const chars = Array.from(word.trim());
  if (chars.length === 0) return '';
  return chars[0].toLocaleUpperCase('ru-RU');
}

/**
 * Детерминированно формирует 1–2 буквенных инициала клиента (кириллица или латиница):
 * 1) Имя и фамилия из `displayName` или `contactLine` («Алексей Соколов» -> «АС»).
 * 2) Если указано только имя («Дмитрий (отдел лизинга)») и известна компания
 *    («АО «ТрансФлот Лизинг»»), объединяет инициал имени и бренда («ДТ»).
 * 3) Если имя не указано, берёт бренд компании («ТрансФлот Лизинг» -> «ТЛ»)
 *    или токены e-mail (`ivan.petrov@company.ru` -> `IP`, `director@transflot-leasing.ru` -> `DT`).
 */
export function deriveClientInitials(input: ClientAvatarIdentityInput): string {
  const personWordsFromDisplay = input.displayName
    ? stripNoiseForPersonTokens(input.displayName)
    : [];
  const personWordsFromContact =
    personWordsFromDisplay.length === 0 && input.contactLine
      ? stripNoiseForPersonTokens(input.contactLine)
      : [];

  const personWords =
    personWordsFromDisplay.length > 0 ? personWordsFromDisplay : personWordsFromContact;
  const brandWords = input.companyOrInn
    ? extractBrandTokensFromCompany(input.companyOrInn)
    : [];

  if (personWords.length >= 2) {
    return `${toUpperFirstChar(personWords[0])}${toUpperFirstChar(personWords[1])}`;
  }

  if (personWords.length === 1) {
    const first = toUpperFirstChar(personWords[0]);
    if (brandWords.length >= 1) {
      const brandInitial = toUpperFirstChar(brandWords[0]);
      if (brandInitial) {
        return `${first}${brandInitial}`;
      }
    }
    return first || 'КЛ';
  }

  if (brandWords.length >= 2) {
    return `${toUpperFirstChar(brandWords[0])}${toUpperFirstChar(brandWords[1])}`;
  }
  if (brandWords.length === 1) {
    const word = brandWords[0];
    const chars = Array.from(word);
    if (chars.length >= 2) {
      return `${chars[0].toLocaleUpperCase('ru-RU')}${chars[1].toLocaleUpperCase('ru-RU')}`;
    }
    return toUpperFirstChar(word) || 'КЛ';
  }

  if (input.email) {
    const emailTokens = extractTokensFromEmail(input.email);
    if (emailTokens.length >= 2) {
      return `${toUpperFirstChar(emailTokens[0])}${toUpperFirstChar(emailTokens[1])}`;
    }
    if (emailTokens.length === 1) {
      const chars = Array.from(emailTokens[0]);
      if (chars.length >= 2) {
        return `${chars[0].toLocaleUpperCase('ru-RU')}${chars[1].toLocaleUpperCase('ru-RU')}`;
      }
      if (chars.length === 1) {
        return chars[0].toLocaleUpperCase('ru-RU');
      }
    }
  }

  return 'КЛ';
}

/**
 * Стабильный 32-битный FNV-1a хеш для выбора абстрактной композиции по инициалам и профилю клиента.
 */
export function computeAvatarSeedHash(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function pickClientAbstractAvatarPreset(
  initials: string,
  seedIdentity = '',
  preferredPresetId?: string | null
): ClientAbstractAvatarPreset {
  const validPreferred = sanitizeClientAvatarPresetId(preferredPresetId);
  if (validPreferred) {
    const found = CLIENT_ABSTRACT_AVATAR_PRESETS.find(
      (preset) => preset.id === validPreferred
    );
    if (found) return found;
  }

  const normalizedSeed = `${initials.trim().toUpperCase()}::${seedIdentity
    .trim()
    .toLowerCase()}`;
  const idx =
    computeAvatarSeedHash(normalizedSeed) % CLIENT_ABSTRACT_AVATAR_PRESETS.length;
  return CLIENT_ABSTRACT_AVATAR_PRESETS[idx] ?? CLIENT_ABSTRACT_AVATAR_PRESETS[0];
}

export function resolveClientAvatarModel(
  input: ClientAvatarIdentityInput
): ResolvedClientAvatarModel {
  const initials = deriveClientInitials(input);
  const serverPhotoUrl = sanitizeClientAvatarUrl(input.avatarUrl);
  const localPhotoUrl = serverPhotoUrl
    ? null
    : sanitizeLocalPreviewImageDataUrl(input.localPreviewDataUrl);
  const effectiveCustomPhotoUrl = serverPhotoUrl ?? localPhotoUrl;

  const seedKey =
    (input.email ?? '').trim() ||
    (input.companyOrInn ?? '').trim() ||
    (input.displayName ?? '').trim() ||
    (input.contactLine ?? '').trim() ||
    initials;

  const preset = pickClientAbstractAvatarPreset(
    initials,
    seedKey,
    input.avatarPresetId
  );

  const ownerText =
    (input.displayName ?? '').trim() ||
    (input.email ?? '').trim() ||
    `клиент ${initials}`;

  return {
    initials,
    hasCustomPhoto: Boolean(effectiveCustomPhotoUrl),
    customPhotoUrl: effectiveCustomPhotoUrl,
    customPhotoWebpUrl: serverPhotoUrl ? deriveWebpUrl(serverPhotoUrl) : null,
    preset,
    accessibleLabel: effectiveCustomPhotoUrl
      ? `Фото профиля: ${ownerText}`
      : `Абстрактный аватар профиля (${initials}): ${preset.title}`,
  };
}
