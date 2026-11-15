export interface ForeignServiceRuleMatch {
  matched: boolean;
  host: string | null;
  category:
    | 'google_banned_or_restricted'
    | 'foreign_social_blocked'
    | 'foreign_cdn_or_media'
    | null;
  lawReference: string | null;
  reason: string | null;
}

const RESTRICTED_GOOGLE_HOST_PATTERNS: readonly RegExp[] = [
  /(^|\.)google-analytics\.com$/i,
  /(^|\.)googletagmanager\.com$/i,
  /(^|\.)fonts\.googleapis\.com$/i,
  /(^|\.)fonts\.gstatic\.com$/i,
  /(^|\.)generativelanguage\.googleapis\.com$/i,
  /(^|\.)recaptcha\.net$/i,
  /(^|\.)doubleclick\.net$/i,
  /(^|\.)googlesyndication\.com$/i,
  /(^|\.)googleadservices\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)youtu\.be$/i,
  /(^|\.)ytimg\.com$/i,
  /(^|\.)googleapis\.com$/i,
  /(^|\.)gstatic\.com$/i,
  /(^|\.)google\.com$/i,
];

const BLOCKED_FOREIGN_SOCIAL_PATTERNS: readonly RegExp[] = [
  /(^|\.)facebook\.com$/i,
  /(^|\.)fbcdn\.net$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)cdninstagram\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)twimg\.com$/i,
  /(^|\.)discord\.com$/i,
  /(^|\.)discord\.gg$/i,
  /(^|\.)vimeo\.com$/i,
];

const FOREIGN_CDN_OR_MEDIA_PATTERNS: readonly RegExp[] = [
  /(^|\.)images\.unsplash\.com$/i,
  /(^|\.)unsplash\.com$/i,
  /(^|\.)cloudflare\.com$/i,
  /(^|\.)cdnjs\.cloudflare\.com$/i,
  /(^|\.)cdn\.jsdelivr\.net$/i,
  /(^|\.)unpkg\.com$/i,
  /(^|\.)mixpanel\.com$/i,
  /(^|\.)amplitude\.com$/i,
  /(^|\.)hotjar\.com$/i,
  /(^|\.)intercom\.io$/i,
  /(^|\.)segment\.io$/i,
  /(^|\.)openai\.com$/i,
  /(^|\.)anthropic\.com$/i,
];

function extractHostnameSafe(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('/') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Проверяет URL на принадлежность к сервисам Google, заблокированным в РФ соцсетям
 * или зарубежным трекерам/CDN с трансграничной передачей IP-адресов и ПДн.
 */
export function checkBannedForeignServiceUrl(rawUrl: string): ForeignServiceRuleMatch {
  const host = extractHostnameSafe(rawUrl);
  if (!host) {
    return {
      matched: false,
      host: null,
      category: null,
      lawReference: null,
      reason: null,
    };
  }

  if (RESTRICTED_GOOGLE_HOST_PATTERNS.some((rx) => rx.test(host))) {
    return {
      matched: true,
      host,
      category: 'google_banned_or_restricted',
      lawReference: '152-ФЗ (ч. 5 ст. 18, ст. 12), позиция РКН по Google Analytics/Fonts',
      reason: `Домен «${host}» относится к инфраструктуре Google с трансграничной передачей IP и метаданных за пределы РФ.`,
    };
  }

  if (BLOCKED_FOREIGN_SOCIAL_PATTERNS.some((rx) => rx.test(host))) {
    return {
      matched: true,
      host,
      category: 'foreign_social_blocked',
      lawReference: '149-ФЗ, ограничения РКН и ст. 18.1 ФЗ-38 «О рекламе»',
      reason: `Домен «${host}» относится к заблокированным или ограниченным на территории РФ платформам.`,
    };
  }

  if (FOREIGN_CDN_OR_MEDIA_PATTERNS.some((rx) => rx.test(host))) {
    return {
      matched: true,
      host,
      category: 'foreign_cdn_or_media',
      lawReference: '152-ФЗ (ст. 12) · требование локального хостинга медиа и шрифтов в РФ',
      reason: `Домен «${host}» является зарубежным CDN/аналитикой/AI-API; используйте локальные ресурсы в контуре РФ.`,
    };
  }

  return {
    matched: false,
    host,
    category: null,
    lawReference: null,
    reason: null,
  };
}

/**
 * Проверяет URL вебхука CRM с точки зрения локализации баз данных в РФ (ч. 5 ст. 18 152-ФЗ).
 */
export function evaluateWebhookEndpointRfSafety(rawUrl: string): {
  isValidUrl: boolean;
  isBannedForeignService: boolean;
  isRfContourRecommended: boolean;
  warning: string | null;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      isValidUrl: false,
      isBannedForeignService: false,
      isRfContourRecommended: false,
      warning: null,
    };
  }

  const banned = checkBannedForeignServiceUrl(trimmed);
  if (banned.matched) {
    return {
      isValidUrl: true,
      isBannedForeignService: true,
      isRfContourRecommended: false,
      warning: banned.reason,
    };
  }

  let host = '';
  try {
    const parsed = new URL(trimmed);
    host = parsed.hostname.toLowerCase();
  } catch {
    return {
      isValidUrl: false,
      isBannedForeignService: false,
      isRfContourRecommended: false,
      warning: 'Укажите корректный http/https адрес приёмника CRM.',
    };
  }

  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal');
  const isRussianDomain =
    host.endsWith('.ru') ||
    host.endsWith('.su') ||
    host.endsWith('.xn--p1ai') ||
    host.includes('bitrix24.ru') ||
    host.includes('amocrm.ru');

  if (isLocal || isRussianDomain) {
    return {
      isValidUrl: true,
      isBannedForeignService: false,
      isRfContourRecommended: true,
      warning: null,
    };
  }

  return {
    isValidUrl: true,
    isBannedForeignService: false,
    isRfContourRecommended: false,
    warning: `Хост «${host}» не относится к доменным зонам .RU/.РФ: перед отправкой ПДн убедитесь, что сервер расположен в РФ и подано уведомление в РКН по ст. 12 152-ФЗ.`,
  };
}

/**
 * Удаляет или маскирует прямые персональные данные (телефоны, email, @telegram, ИНН 10/12 цифр)
 * перед отправкой технических уведомлений во внешние или зарубежные каналы (ст. 12 152-ФЗ, ФЗ-41-ФЗ).
 */
export function scrubPersonalDataFromText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(
      /(?:\+?7|8)[\s\-().]*\d{3}[\s\-().]*\d{3}[\s\-().]*\d{2}[\s\-().]*\d{2}/g,
      '[ТЕЛЕФОН СКРЫТ · 152-ФЗ]'
    )
    .replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      '[EMAIL СКРЫТ · 152-ФЗ]'
    )
    .replace(/@[a-zA-Z0-9_]{3,}/g, '[КОНТАКТ СКРЫТ · 152-ФЗ]')
    .replace(/\b\d{10}(?:\d{2})?\b/g, '[ИНН СКРЫТ · 152-ФЗ]');
}

/**
 * Возвращает минимально необходимую обезличенную метку канала связи для внешних оповещений.
 */
export function maskContactChannelSummary(
  detectedChannel: 'phone' | 'telegram' | 'email' | 'vip_saved' | string
): string {
  if (detectedChannel === 'email') {
    return 'Электронная почта (скрыта в CRM по 152-ФЗ)';
  }
  if (detectedChannel === 'telegram') {
    return 'Аккаунт мессенджера (скрыт в CRM по 152-ФЗ)';
  }
  if (detectedChannel === 'vip_saved') {
    return 'Действующий контрагент (профиль в CRM РФ)';
  }
  return 'Телефон (скрыт в CRM по 152-ФЗ)';
}

/**
 * Проверяет, содержит ли текст прямые идентификаторы ПДн (телефон, e-mail, @username, ИНН),
 * чтобы исключить их попадание в любые сторонние или AI-инференс контуры.
 */
export function containsDirectPersonalData(rawText: string): boolean {
  if (!rawText) return false;
  const scrubbed = scrubPersonalDataFromText(rawText);
  return scrubbed !== rawText;
}

export const RF_STORAGE_NOTICE_STORAGE_KEY = 'fmworks_rf_storage_notice_v1';

export interface RfCompliancePassportItem {
  id: string;
  title: string;
  lawBadge: string;
  statusLabel: string;
  summary: string;
}

export const RF_COMPLIANCE_PASSPORT_ITEMS: readonly RfCompliancePassportItem[] = [
  {
    id: 'no_google_runtime',
    title: 'Полный отказ от сервисов Google и зарубежных трекеров',
    lawBadge: '152-ФЗ · Позиция РКН',
    statusLabel: 'Активно · 0 запросов',
    summary:
      'На сайте и при оформлении заявок полностью отключены Google Analytics, Google Tag Manager, Google Fonts, Google reCAPTCHA и зарубежные рекламные пиксели. IP-адреса посетителей не передаются на иностранные серверы.',
  },
  {
    id: 'local_fonts_media',
    title: 'Локальные шрифты SIL OFL 1.1 и медиа на сервере РФ',
    lawBadge: 'ФЗ-149 · 152-ФЗ',
    statusLabel: '100% локально',
    summary:
      'Типографика (Golos Text, Manrope, JetBrains Mono), аудиопримеры и иллюстрации раздаются напрямую с нашего сервера без обращения к зарубежным CDN (gstatic, unsplash, cloudflare).',
  },
  {
    id: 'rf_pdn_localization',
    title: 'Локализация баз ПДн в РФ и обезличивание в мессенджерах',
    lawBadge: 'ч. 5 ст. 18, ст. 12 152-ФЗ · ФЗ-41-ФЗ',
    statusLabel: 'Защитный режим ON',
    summary:
      'Анкеты, брифы и реквизиты хранятся исключительно в реестре на сервере в РФ. В оперативные оповещения продюсеру не передаются номера телефонов, почты, ИНН и текст брифа — только номер заявки для входа в защищённый кабинет.',
  },
  {
    id: 'fz38_sep_consent',
    title: 'Раздельные согласия и запрет навязанных рекламных рассылок',
    lawBadge: 'ч. 1 ст. 18 ФЗ-38 «О рекламе» · ст. 9 152-ФЗ',
    statusLabel: 'Проверено в формах',
    summary:
      'Согласие на обработку ПДн запрашивается отдельно до отправки формы, не объединено со спам-рассылками и может быть отозвано письмом на art@artmspektr.ru с обезличиванием в установленный ст. 21 152-ФЗ срок.',
  },
  {
    id: 'edo_54fz_rights',
    title: 'Безнал ЭДО, касса 54-ФЗ, маркировка и отчуждение прав РАО/ВОИС',
    lawBadge: 'ГК РФ ч. IV · 54-ФЗ · ФЗ-38',
    statusLabel: 'Г. Тверь · РФ',
    summary:
      'Каждая сделка оформляется Договором и Приложением (ИП/ООО, УСН/НДС, 100% предоплата по договору или банковской картой), Паспортом рекламного ролика РАО/ВОИС и расчётами по ЭДО или через российские платёжные шлюзы с чеком 54-ФЗ.',
  },
] as const;
