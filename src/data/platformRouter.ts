import { AIRTIME_SALES_ENABLED, isAirtimeSalesEnabled } from './platformFeatures.ts';
import {
  buildRouteOgImageUrl,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
} from './ogImageTemplates.ts';
import {
  buildLocalBusinessJsonLd,
  buildOrganizationJsonLd,
  buildServiceJsonLd,
  buildWebSiteJsonLd,
  DEFAULT_OG_IMAGE_PATH,
  FMWORKS_BUSINESS_DETAILS,
  injectBusinessSchemasIntoDocument,
  injectServiceSchemaIntoDocument,
  injectWebSiteSchemaIntoDocument,
  LOCAL_BUSINESS_JSONLD_SCRIPT_ID,
  ORGANIZATION_JSONLD_SCRIPT_ID,
  SERVICE_JSONLD_SCRIPT_ID,
  upsertJsonLdScriptInHead,
  WEBSITE_JSONLD_SCRIPT_ID,
} from './seoUtils.ts';

export type IndustryVerticalSlug =
  | 'real-estate'
  | 'medicine'
  | 'retail-fmcg'
  | 'b2b-finance';

export const VALID_INDUSTRY_SLUGS: readonly IndustryVerticalSlug[] = [
  'real-estate',
  'medicine',
  'retail-fmcg',
  'b2b-finance',
] as const;

export function isValidIndustrySlug(value: string): value is IndustryVerticalSlug {
  return (VALID_INDUSTRY_SLUGS as readonly string[]).includes(value);
}

export type TopNavSectionKey =
  | 'home'
  | 'hot-air'
  | 'cases'
  | 'pricing'
  | 'approach'
  | 'faq';

export type CabinetSubrouteMode = 'orders' | 'history' | 'reset';

export type LegalPageSectionTab = 'policy' | 'consent' | 'rf_security';

export type PlatformRoute =
  | { kind: 'home'; scrollAnchor?: string }
  | { kind: 'hot-air' }
  | { kind: 'station-detail'; stationSlug: string }
  | { kind: 'cases'; scrollAnchor?: string; searchQuery?: string }
  | { kind: 'case-detail'; caseSlug: string }
  | { kind: 'industry-detail'; industrySlug: IndustryVerticalSlug }
  | { kind: 'pricing'; scrollAnchor?: string }
  | { kind: 'approach'; scrollAnchor?: string }
  | { kind: 'mistake-detail'; articleSlug: string }
  | { kind: 'faq'; scrollAnchor?: string }
  | { kind: 'privacy'; tab?: LegalPageSectionTab }
  | { kind: 'order' }
  | {
      kind: 'cabinet';
      subroute?: CabinetSubrouteMode;
      magicToken?: string;
    }
  | {
      kind: 'sound-drop';
      dropToken?: string;
    }
  | { kind: 'admin' };

export function resolveRouteScrollAnchor(route: PlatformRoute): string | undefined {
  if (
    route.kind === 'home' ||
    route.kind === 'pricing' ||
    route.kind === 'approach' ||
    route.kind === 'cases' ||
    route.kind === 'faq'
  ) {
    return route.scrollAnchor;
  }
  return undefined;
}

export function resolveRouteTransitionKey(route: PlatformRoute): string {
  switch (route.kind) {
    case 'station-detail':
      return `station-detail:${route.stationSlug}`;
    case 'case-detail':
      return `case-detail:${route.caseSlug}`;
    case 'industry-detail':
      return `industry-detail:${route.industrySlug}`;
    case 'mistake-detail':
      return `mistake-detail:${route.articleSlug}`;
    case 'cabinet':
      return route.subroute === 'reset' ? 'cabinet:reset' : 'cabinet';
    case 'sound-drop':
      return `sound-drop:${route.dropToken ?? 'default'}`;
    default:
      return route.kind;
  }
}

export type RouteSkeletonVariant =
  | 'home'
  | 'cases'
  | 'pricing'
  | 'approach'
  | 'faq'
  | 'privacy'
  | 'order'
  | 'cabinet'
  | 'admin'
  | 'sound-drop'
  | 'hot-air';

export function resolveRouteSkeletonVariant(
  route: PlatformRoute
): RouteSkeletonVariant {
  switch (route.kind) {
    case 'cases':
    case 'case-detail':
    case 'industry-detail':
      return 'cases';
    case 'approach':
    case 'mistake-detail':
      return 'approach';
    case 'hot-air':
    case 'station-detail':
      return 'hot-air';
    default:
      return route.kind;
  }
}

export interface MainPlatformNavItem {
  key: TopNavSectionKey;
  label: string;
  href: string;
}

export const ALL_PLATFORM_NAV_ITEMS: readonly MainPlatformNavItem[] = [
  { key: 'home', label: 'Главная', href: '/' },
  { key: 'hot-air', label: 'Горящий эфир', href: '/hot-air' },
  { key: 'cases', label: 'Кейсы', href: '/cases' },
  { key: 'pricing', label: 'Тарифы', href: '/pricing' },
  { key: 'approach', label: 'О подходе', href: '/approach' },
  { key: 'faq', label: 'FAQ', href: '/faq' },
] as const;

export function getMainPlatformNavItems(
  airtimeEnabled = AIRTIME_SALES_ENABLED
): readonly MainPlatformNavItem[] {
  if (airtimeEnabled) {
    return ALL_PLATFORM_NAV_ITEMS;
  }
  return ALL_PLATFORM_NAV_ITEMS.filter((item) => item.key !== 'hot-air');
}

export const MAIN_PLATFORM_NAV_ITEMS: readonly MainPlatformNavItem[] =
  getMainPlatformNavItems();

function sanitizeSlugSegment(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Очищает токен magic-ссылки из URL без изменения регистра символов (base64url чувствителен к регистру).
 */
export function sanitizeCabinetMagicToken(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (trimmed.length < 12 || trimmed.length > 512) return undefined;
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return undefined;
  return trimmed;
}

export function sanitizeSoundDropToken(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (trimmed.length < 16 || trimmed.length > 1024) return undefined;
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return undefined;
  return trimmed;
}

/**
 * Разбирает URL браузера (включая обратную совместимость со старыми хеш-якорями и query-параметрами)
 * в строго типизированный маршрут многостраничной платформы FMWorks.
 */
export function parsePlatformRoute(
  pathname: string,
  search = '',
  hash = '',
  options?: { airtimeEnabled?: boolean }
): PlatformRoute {
  const airtimeEnabled = isAirtimeSalesEnabled(options?.airtimeEnabled);
  const normalizedPath = (pathname || '/')
    .trim()
    .replace(/\/+$/g, '')
    .toLowerCase() || '/';
  const normalizedHash = (hash || '').replace(/^#/, '').trim().toLowerCase();
  const params = new URLSearchParams(search || '');

  if (normalizedPath === '/admin' || normalizedPath.startsWith('/admin/')) {
    return { kind: 'admin' };
  }

  if (
    normalizedPath === '/sound-drop' ||
    normalizedPath.startsWith('/sound-drop/')
  ) {
    const dropToken = sanitizeSoundDropToken(params.get('token'));
    return {
      kind: 'sound-drop',
      ...(dropToken ? { dropToken } : {}),
    };
  }

  if (
    normalizedPath === '/order' ||
    normalizedPath === '/booking' ||
    normalizedPath === '/checkout'
  ) {
    return { kind: 'order' };
  }

  if (
    normalizedPath === '/cabinet' ||
    normalizedPath === '/account' ||
    normalizedPath === '/cabinet/history' ||
    normalizedPath === '/cabinet/archive' ||
    normalizedPath === '/cabinet/reset' ||
    normalizedPath === '/cabinet/recovery'
  ) {
    const modeParam = (params.get('mode') ?? '').trim().toLowerCase();
    const isResetSubroute =
      normalizedPath === '/cabinet/reset' ||
      normalizedPath === '/cabinet/recovery' ||
      modeParam === 'reset' ||
      modeParam === 'recovery' ||
      params.get('reset') === '1' ||
      normalizedHash === 'reset';
    const isHistorySubroute =
      !isResetSubroute &&
      (normalizedPath === '/cabinet/history' ||
        normalizedPath === '/cabinet/archive' ||
        modeParam === 'history' ||
        normalizedHash === 'history' ||
        normalizedHash === 'cabinet-history');
    const magicToken = sanitizeCabinetMagicToken(params.get('magic'));
    return {
      kind: 'cabinet',
      ...(isResetSubroute
        ? { subroute: 'reset' as const }
        : isHistorySubroute
          ? { subroute: 'history' as const }
          : {}),
      ...(magicToken ? { magicToken } : {}),
    };
  }

  if (normalizedPath === '/hot-air') {
    return airtimeEnabled ? { kind: 'hot-air' } : { kind: 'home' };
  }

  if (normalizedPath.startsWith('/hot-air/stations/')) {
    if (!airtimeEnabled) {
      return { kind: 'home' };
    }
    const slug = sanitizeSlugSegment(
      normalizedPath.slice('/hot-air/stations/'.length)
    );
    return slug ? { kind: 'station-detail', stationSlug: slug } : { kind: 'hot-air' };
  }

  if (normalizedPath === '/cases') {
    const rawSearchQuery = (params.get('q') ?? '').trim().slice(0, 120);
    return {
      kind: 'cases',
      ...(normalizedHash === 'industry-solutions-hub'
        ? { scrollAnchor: normalizedHash }
        : {}),
      ...(rawSearchQuery ? { searchQuery: rawSearchQuery } : {}),
    };
  }

  if (normalizedPath.startsWith('/cases/industry/')) {
    const rawInd = sanitizeSlugSegment(
      normalizedPath.slice('/cases/industry/'.length)
    );
    if (isValidIndustrySlug(rawInd)) {
      return { kind: 'industry-detail', industrySlug: rawInd };
    }
    return { kind: 'cases' };
  }

  if (normalizedPath.startsWith('/cases/')) {
    const slug = sanitizeSlugSegment(normalizedPath.slice('/cases/'.length));
    return slug ? { kind: 'case-detail', caseSlug: slug } : { kind: 'cases' };
  }

  if (normalizedPath === '/pricing') {
    if (normalizedHash === 'faq') {
      return { kind: 'faq' };
    }
    return {
      kind: 'pricing',
      scrollAnchor:
        normalizedHash === 'stages-24-48' ||
        normalizedHash === 'legal-clearance' ||
        normalizedHash === 'pricing-visual-charts'
          ? normalizedHash
          : undefined,
    };
  }

  if (normalizedPath === '/approach') {
    return {
      kind: 'approach',
      ...(normalizedHash === 'radio-mistakes' ||
      normalizedHash === 'effective-frequency-science'
        ? { scrollAnchor: normalizedHash }
        : {}),
    };
  }

  if (normalizedPath.startsWith('/approach/')) {
    const slug = sanitizeSlugSegment(normalizedPath.slice('/approach/'.length));
    return slug ? { kind: 'mistake-detail', articleSlug: slug } : { kind: 'approach' };
  }

  if (normalizedPath === '/faq') {
    return {
      kind: 'faq',
      ...(normalizedHash === 'urgent-order' || normalizedHash === 'faq-questions'
        ? { scrollAnchor: normalizedHash }
        : {}),
    };
  }

  if (
    normalizedPath === '/privacy' ||
    normalizedPath === '/policy' ||
    normalizedPath === '/personal-data' ||
    normalizedPath === '/152-fz'
  ) {
    const rawTab = (params.get('tab') || normalizedHash).trim().toLowerCase();
    const tab: LegalPageSectionTab | undefined =
      rawTab === 'consent' || rawTab === 'pdn-consent'
        ? 'consent'
        : rawTab === 'rf_security' || rawTab === 'security' || rawTab === 'cookies'
          ? 'rf_security'
          : rawTab === 'policy' || rawTab === 'pdn-policy'
            ? 'policy'
            : undefined;
    return {
      kind: 'privacy',
      ...(tab ? { tab } : {}),
    };
  }

  // Обратная совместимость старых прямых ссылок с корневой страницы (`/?case=...`, `/#hot-air`, `/#work` и т.д.)
  const sharedCaseParam = sanitizeSlugSegment(params.get('case') ?? '');
  if (sharedCaseParam) {
    return { kind: 'case-detail', caseSlug: sharedCaseParam };
  }

  if (normalizedHash === 'hot-air') {
    return airtimeEnabled ? { kind: 'hot-air' } : { kind: 'home' };
  }
  if (normalizedHash === 'work') {
    return { kind: 'cases' };
  }
  if (normalizedHash.startsWith('case-')) {
    const caseSlug = sanitizeSlugSegment(normalizedHash.slice('case-'.length));
    if (caseSlug) {
      return { kind: 'case-detail', caseSlug };
    }
  }
  if (normalizedHash === 'pricing') {
    return { kind: 'pricing' };
  }
  if (normalizedHash === 'faq' || normalizedHash === 'home-faq') {
    return { kind: 'faq' };
  }
  if (normalizedHash === 'urgent-order') {
    return { kind: 'faq', scrollAnchor: 'urgent-order' };
  }
  if (normalizedHash === 'approach') {
    return { kind: 'approach' };
  }
  if (normalizedHash === 'radio-mistakes') {
    return { kind: 'approach', scrollAnchor: 'radio-mistakes' };
  }
  if (normalizedHash === 'cabinet') {
    return { kind: 'cabinet' };
  }
  if (normalizedHash === 'cabinet-history') {
    return { kind: 'cabinet', subroute: 'history' };
  }
  if (normalizedHash === 'cabinet-reset') {
    return { kind: 'cabinet', subroute: 'reset' };
  }
  if (normalizedHash === 'duel' || normalizedHash === 'testimonials') {
    return { kind: 'home', scrollAnchor: normalizedHash };
  }

  return { kind: 'home' };
}

/**
 * Формирует канонический чистый URL-путь для маршрута платформы.
 */
export function buildPlatformPath(route: PlatformRoute): string {
  switch (route.kind) {
    case 'home':
      return route.scrollAnchor ? `/#${route.scrollAnchor}` : '/';
    case 'hot-air':
      return '/hot-air';
    case 'station-detail':
      return `/hot-air/stations/${encodeURIComponent(route.stationSlug)}`;
    case 'cases': {
      const cleanQuery = route.searchQuery?.trim();
      const queryPart = cleanQuery ? `?q=${encodeURIComponent(cleanQuery)}` : '';
      const hashPart = route.scrollAnchor ? `#${route.scrollAnchor}` : '';
      return `/cases${queryPart}${hashPart}`;
    }
    case 'case-detail':
      return `/cases/${encodeURIComponent(route.caseSlug)}`;
    case 'industry-detail':
      return `/cases/industry/${route.industrySlug}`;
    case 'pricing':
      return route.scrollAnchor ? `/pricing#${route.scrollAnchor}` : '/pricing';
    case 'approach':
      return route.scrollAnchor ? `/approach#${route.scrollAnchor}` : '/approach';
    case 'mistake-detail':
      return `/approach/${encodeURIComponent(route.articleSlug)}`;
    case 'faq':
      return route.scrollAnchor ? `/faq#${route.scrollAnchor}` : '/faq';
    case 'privacy':
      return route.tab && route.tab !== 'policy'
        ? `/privacy?tab=${encodeURIComponent(route.tab)}`
        : '/privacy';
    case 'order':
      return '/order';
    case 'cabinet': {
      const basePath =
        route.subroute === 'reset'
          ? '/cabinet/reset'
          : route.subroute === 'history'
            ? '/cabinet/history'
            : '/cabinet';
      const cleanMagic = sanitizeCabinetMagicToken(route.magicToken);
      return cleanMagic
        ? `${basePath}?magic=${encodeURIComponent(cleanMagic)}`
        : basePath;
    }
    case 'sound-drop': {
      const cleanDrop = sanitizeSoundDropToken(route.dropToken);
      return cleanDrop
        ? `/sound-drop?token=${encodeURIComponent(cleanDrop)}`
        : '/sound-drop';
    }
    case 'admin':
      return '/admin';
  }
}

/**
 * Определяет активный пункт в верхней панели навигации для любого вложенного маршрута.
 */
export function resolveActiveTopNavSection(
  route: PlatformRoute
): TopNavSectionKey | null {
  switch (route.kind) {
    case 'home':
      return route.scrollAnchor === 'home-faq' ? 'faq' : 'home';
    case 'hot-air':
    case 'station-detail':
      return 'hot-air';
    case 'cases':
    case 'case-detail':
    case 'industry-detail':
      return 'cases';
    case 'pricing':
      return 'pricing';
    case 'approach':
    case 'mistake-detail':
      return 'approach';
    case 'faq':
      return 'faq';
    case 'privacy':
    case 'order':
    case 'cabinet':
    case 'sound-drop':
    case 'admin':
      return null;
  }
}

export interface RouteBreadcrumbItem {
  name: string;
  path: string;
}

export interface RouteSeoMetadata {
  title: string;
  description: string;
  canonicalPath: string;
  schemaType: 'WebSite' | 'Service' | 'CollectionPage' | 'Article' | 'CheckoutPage';
  noindex?: boolean;
  breadcrumbs?: readonly RouteBreadcrumbItem[];
}

export const INDEXABLE_ROBOTS_META_CONTENT =
  'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';

export interface RouteSeoLookupTitles {
  stationName?: string;
  caseClientName?: string;
  industryTitle?: string;
  articleTitle?: string;
}

export {
  buildLocalBusinessJsonLd,
  buildOrganizationJsonLd,
  buildServiceJsonLd,
  buildWebSiteJsonLd,
  DEFAULT_OG_IMAGE_PATH,
  FMWORKS_BUSINESS_DETAILS,
  injectBusinessSchemasIntoDocument,
  injectServiceSchemaIntoDocument,
  injectWebSiteSchemaIntoDocument,
  LOCAL_BUSINESS_JSONLD_SCRIPT_ID,
  ORGANIZATION_JSONLD_SCRIPT_ID,
  SERVICE_JSONLD_SCRIPT_ID,
  WEBSITE_JSONLD_SCRIPT_ID,
};

/**
 * Генерирует индивидуальные SEO-метаданные, OpenGraph-теги, директивы роботам, хлебные крошки
 * и тип микроразметки Schema.org для каждого маршрута многостраничной платформы FMWorks.
 */
export function resolveRouteSeoMeta(
  route: PlatformRoute,
  lookup: RouteSeoLookupTitles = {},
  options?: { airtimeEnabled?: boolean }
): RouteSeoMetadata {
  const airtimeEnabled = isAirtimeSalesEnabled(options?.airtimeEnabled);
  switch (route.kind) {
    case 'home':
      return {
        title:
          'FMWorks — Студийный аудиопродакшн: от 24–48ч по тексту, 3–4 дня под ключ',
        description:
          'Производство коммерческих аудиороликов по договору и предоплате: 3 сценария, голоса кинодубляжа, саунд-дизайн и паспорт прав РАО/ВОИС.',
        canonicalPath: '/',
        schemaType: 'WebSite',
        noindex: false,
      };
    case 'hot-air':
      return {
        title: 'Горящий радиоэфир и каталог станций — Медиапланер FMWorks',
        description:
          'Интерактивный подбор тайм-слотов на радиостанциях со скидкой до 45%, честным посекундным расчётом хронометража и резервом квоты на 4 часа.',
        canonicalPath: '/hot-air',
        schemaType: 'Service',
        noindex: !airtimeEnabled,
        breadcrumbs: [
          { name: 'Главная', path: '/' },
          { name: 'Горящий эфир', path: '/hot-air' },
        ],
      };
    case 'station-detail': {
      const name = lookup.stationName || route.stationSlug.toUpperCase();
      return {
        title: `${name} — Аудитория, тайм-слоты и стоимость секунды | FMWorks`,
        description: `Портрет слушателей ${name}, доступные эфирные блоки, правила кратности хронометража и расчёт горящих квот по посекундной ставке.`,
        canonicalPath: `/hot-air/stations/${route.stationSlug}`,
        schemaType: 'Service',
        noindex: !airtimeEnabled,
        breadcrumbs: [
          { name: 'Главная', path: '/' },
          { name: 'Горящий эфир', path: '/hot-air' },
          { name: name, path: `/hot-air/stations/${route.stationSlug}` },
        ],
      };
    }
    case 'cases':
      return {
        title: 'Кейсы аудиорекламы, сценарии и отраслевые решения — FMWorks',
        description:
          'Примеры радиороликов с полными текстами сценариев, таймкодами, юридической адаптацией и решениями для ЖК, медицины, ритейла и B2B.',
        canonicalPath: '/cases',
        schemaType: 'CollectionPage',
        noindex: false,
        breadcrumbs: [
          { name: 'Главная', path: '/' },
          { name: 'Кейсы', path: '/cases' },
        ],
      };
    case 'case-detail': {
      const client = lookup.caseClientName || 'Разбор проекта';
      return {
        title: `${client} — Сценарий радиоролика и результаты | Кейс FMWorks`,
        description: `Подробный разбор аудиоролика «${client}»: бизнес-задача, посекундная партитура сценария, юридический комплаенс и показатели отклика.`,
        canonicalPath: `/cases/${route.caseSlug}`,
        schemaType: 'Article',
        noindex: false,
        breadcrumbs: [
          { name: 'Главная', path: '/' },
          { name: 'Кейсы', path: '/cases' },
          { name: client, path: `/cases/${route.caseSlug}` },
        ],
      };
    }
    case 'industry-detail': {
      const ind = lookup.industryTitle || 'Отраслевое решение';
      return {
        title: `${ind} — Аудиореклама и отраслевой стандарт | FMWorks`,
        description: `Отраслевой стандарт радиорекламы (${ind}): рабочие сценарии, прохождение модерации по ФЗ «О рекламе» и звуковая драматургия.`,
        canonicalPath: `/cases/industry/${route.industrySlug}`,
        schemaType: 'Service',
        noindex: false,
        breadcrumbs: [
          { name: 'Главная', path: '/' },
          { name: 'Кейсы', path: '/cases' },
          { name: ind, path: `/cases/industry/${route.industrySlug}` },
        ],
      };
    }
    case 'pricing':
      return {
        title:
          'Тарифы на аудиоролики, сроки от 24–48ч (3–4 дня под ключ) и права — FMWorks',
        description:
          'Фиксированная стоимость радиороликов от 15 000 ₽ по договору, этапы продакшна, паспорт прав РАО/ВОИС и эфирная модерация.',
        canonicalPath: '/pricing',
        schemaType: 'Service',
        noindex: false,
        breadcrumbs: [
          { name: 'Главная', path: '/' },
          { name: 'Тарифы', path: '/pricing' },
        ],
      };
    case 'approach':
      return {
        title: 'О подходе FMWorks — Нейроисследования и ошибки радиорекламы',
        description:
          'Почему слушатели игнорируют 80% объявлений в рекламном блоке: исследования внимания и разбор 5 типовых ошибок в сценариях радиороликов.',
        canonicalPath: '/approach',
        schemaType: 'CollectionPage',
        noindex: false,
        breadcrumbs: [
          { name: 'Главная', path: '/' },
          { name: 'О подходе', path: '/approach' },
        ],
      };
    case 'mistake-detail': {
      const art = lookup.articleTitle || 'Разбор ошибки в радиорекламе';
      return {
        title: `${art} — Экспертный разбор FMWorks`,
        description: `Практический разбор ошибки в радиорекламе: сравнение сценариев «до и после», экономика удержания внимания и чек-лист продюсера.`,
        canonicalPath: `/approach/${route.articleSlug}`,
        schemaType: 'Article',
        noindex: false,
        breadcrumbs: [
          { name: 'Главная', path: '/' },
          { name: 'О подходе', path: '/approach' },
          { name: art, path: `/approach/${route.articleSlug}` },
        ],
      };
    }
    case 'faq':
      return {
        title: 'Частые вопросы (FAQ) по договору, оплате и срокам — FMWorks',
        description:
          'Как устроено оформление договора и счёта для юрлиц, оплата картой и по СБП, индивидуальный формат и сроки продакшна аудиороликов.',
        canonicalPath: '/faq',
        schemaType: 'CollectionPage',
        noindex: false,
        breadcrumbs: [
          { name: 'Главная', path: '/' },
          { name: 'FAQ', path: '/faq' },
        ],
      };
    case 'privacy':
      return {
        title:
          'Политика обработки персональных данных (152-ФЗ) и согласие — FMWorks',
        description:
          'Официальная Политика в отношении обработки персональных данных на сайте fmworks.ru по ст. 18.1 Закона № 152-ФЗ: цели, сроки хранения, локализация в РФ и cookie.',
        canonicalPath: '/privacy',
        schemaType: 'Article',
        noindex: false,
        breadcrumbs: [
          { name: 'Главная', path: '/' },
          { name: 'Политика обработки персональных данных', path: '/privacy' },
        ],
      };
    case 'order':
      return airtimeEnabled
        ? {
            title: 'Оформление брони эфира и заказа аудиоролика — FMWorks',
            description:
              'Поставьте эфирную сетку на приоритетный 4-часовой резерв или передайте голосовое ТЗ на производство радиоролика по договору.',
            canonicalPath: '/order',
            schemaType: 'CheckoutPage',
            noindex: true,
            breadcrumbs: [
              { name: 'Главная', path: '/' },
              { name: 'Бронь эфира и заказ ролика', path: '/order' },
            ],
          }
        : {
            title: 'Оформление заказа аудиоролика — Студия FMWorks',
            description:
              'Быстрая заявка на производство аудиоролика: формат, короткий бриф и контакт продюсера, а также моментальный счёт на оплату при необходимости.',
            canonicalPath: '/order',
            schemaType: 'CheckoutPage',
            noindex: true,
            breadcrumbs: [
              { name: 'Главная', path: '/' },
              { name: 'Заказ аудиоролика', path: '/order' },
            ],
          };
    case 'cabinet':
      return {
        title:
          route.subroute === 'reset'
            ? 'Сброс и восстановление доступа в личный кабинет — FMWorks'
            : route.subroute === 'history'
              ? 'История заказов и мастер-файлы — Личный кабинет FMWorks'
              : 'Личный кабинет заказов — FMWorks',
        description:
          route.subroute === 'reset'
            ? 'Беспарольный сброс доступа к заказам и счетам по одноразовой magic-ссылке на вашу электронную почту.'
            : route.subroute === 'history'
              ? 'Архив прошлых проектов студии FMWorks с мгновенным скачиванием готовых мастер-файлов WAV, сценариев и закрывающих документов.'
              : 'Отслеживание статуса аудиороликов, загрузка материалов, скачивание готовых файлов и счетов на оплату.',
        canonicalPath: '/cabinet',
        schemaType: 'WebSite',
        noindex: true,
        breadcrumbs: [
          { name: 'Главная', path: '/' },
          { name: 'Личный кабинет', path: '/cabinet' },
        ],
      };
    case 'sound-drop':
      return {
        title: 'Прямая сдача мастер-файла продюсеру — Студия FMWorks',
        description:
          'Служебный шлюз прямой сдачи готового аудиофайла WAV/MP3 на проверку продюсеру студии FMWorks.',
        canonicalPath: '/sound-drop',
        schemaType: 'WebSite',
        noindex: true,
      };
    case 'admin':
      return airtimeEnabled
        ? {
            title: 'Кабинет продюсера — Управление контентом и эфиром FMWorks',
            description:
              'Закрытая панель управления студийной витриной и эфирными квотами FMWorks.',
            canonicalPath: '/admin',
            schemaType: 'WebSite',
            noindex: true,
            breadcrumbs: [
              { name: 'Главная', path: '/' },
              { name: 'Кабинет продюсера', path: '/admin' },
            ],
          }
        : {
            title: 'Кабинет продюсера — Управление студией и заказами FMWorks',
            description:
              'Закрытая панель управления студийной витриной, заказами аудиороликов и SLA FMWorks.',
            canonicalPath: '/admin',
            schemaType: 'WebSite',
            noindex: true,
            breadcrumbs: [
              { name: 'Главная', path: '/' },
              { name: 'Кабинет продюсера', path: '/admin' },
            ],
          };
  }
}

export interface BreadcrumbListItemSchema {
  '@type': 'ListItem';
  position: number;
  name: string;
  item: string;
}

export interface BreadcrumbListJsonLd {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  '@id': string;
  itemListElement: BreadcrumbListItemSchema[];
}

/**
 * Генерирует Schema.org JSON-LD (`BreadcrumbList`) для всех вложенных страниц платформы (`/cases`, `/approach`, `/pricing`, `/faq` и др.).
 * Для корневой страницы (`/`) возвращает `null`.
 */
export function buildBreadcrumbListJsonLd(
  meta: RouteSeoMetadata,
  origin: string
): BreadcrumbListJsonLd | null {
  if (!meta.breadcrumbs || meta.breadcrumbs.length === 0) {
    return null;
  }
  const cleanOrigin = origin.replace(/\/+$/g, '') || 'https://fmworks.ru';
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${cleanOrigin}${meta.canonicalPath}#breadcrumb`,
    itemListElement: meta.breadcrumbs.map((crumb, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: crumb.name,
      item: `${cleanOrigin}${crumb.path}`,
    })),
  };
}

/**
 * Формирует расширенный граф Schema.org JSON-LD (`ProfessionalService` + `OfferCatalog` с ценами в RUB + сущность страницы + `BreadcrumbList`).
 */
export function buildRouteSchemaGraph(
  meta: RouteSeoMetadata,
  origin: string
): Record<string, unknown> {
  const cleanOrigin = origin.replace(/\/+$/g, '') || 'https://fmworks.ru';
  const fullUrl = `${cleanOrigin}${meta.canonicalPath}`;
  const ogImageUrl = buildRouteOgImageUrl(cleanOrigin, meta.canonicalPath);

  const organizationNode: Record<string, unknown> = {
    '@type': 'ProfessionalService',
    '@id': `${cleanOrigin}/#service-provider`,
    name: FMWORKS_BUSINESS_DETAILS.brandName,
    alternateName: FMWORKS_BUSINESS_DETAILS.legalName,
    url: cleanOrigin,
    email: FMWORKS_BUSINESS_DETAILS.email,
    telephone: FMWORKS_BUSINESS_DETAILS.telephone,
    image: ogImageUrl,
    priceRange: FMWORKS_BUSINESS_DETAILS.priceRange,
    currenciesAccepted: FMWORKS_BUSINESS_DETAILS.currenciesAccepted,
    paymentAccepted: FMWORKS_BUSINESS_DETAILS.paymentAccepted,
    parentOrganization: {
      '@id': `${cleanOrigin}/#organization`,
    },
    address: {
      '@type': 'PostalAddress',
      ...FMWORKS_BUSINESS_DETAILS.address,
    },
    geo: {
      '@type': 'GeoCoordinates',
      ...FMWORKS_BUSINESS_DETAILS.geo,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [...FMWORKS_BUSINESS_DETAILS.openingHours.dayOfWeek],
        opens: FMWORKS_BUSINESS_DETAILS.openingHours.opens,
        closes: FMWORKS_BUSINESS_DETAILS.openingHours.closes,
      },
    ],
    areaServed: {
      '@type': 'Country',
      name: 'Россия',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Тарифы на производство рекламных аудиороликов FMWorks',
      itemListElement: [
        {
          '@type': 'Offer',
          name: 'Голос и стиль (по готовому тексту, 24–48 ч)',
          url: `${cleanOrigin}/pricing`,
          price: '15000',
          priceCurrency: 'RUB',
          availability: 'https://schema.org/InStock',
        },
        {
          '@type': 'Offer',
          name: 'Продакшн под ключ (3 сценария с нуля, 3–4 дня)',
          url: `${cleanOrigin}/pricing`,
          price: '25000',
          priceCurrency: 'RUB',
          availability: 'https://schema.org/InStock',
        },
        {
          '@type': 'Offer',
          name: 'Игровой ролик / Мини-кино (2–3 актёра, 4–5 дней)',
          url: `${cleanOrigin}/pricing`,
          price: '35000',
          priceCurrency: 'RUB',
          availability: 'https://schema.org/InStock',
        },
      ],
    },
  };

  const pageNode: Record<string, unknown> = {
    '@type': meta.schemaType,
    '@id': `${fullUrl}#webpage`,
    name: meta.title,
    description: meta.description,
    url: fullUrl,
    inLanguage: 'ru-RU',
    primaryImageOfPage: ogImageUrl,
    provider: {
      '@id': `${cleanOrigin}/#service-provider`,
    },
  };

  if (meta.schemaType === 'Article') {
    pageNode.headline = meta.title;
    pageNode.author = { '@id': `${cleanOrigin}/#organization` };
    pageNode.publisher = { '@id': `${cleanOrigin}/#organization` };
    pageNode.mainEntityOfPage = fullUrl;
  }

  if (meta.schemaType === 'WebSite') {
    pageNode.potentialAction = buildWebSiteJsonLd(cleanOrigin).potentialAction;
  }

  const breadcrumbSchema = buildBreadcrumbListJsonLd(meta, cleanOrigin);
  if (breadcrumbSchema) {
    pageNode.breadcrumb = { '@id': breadcrumbSchema['@id'] };
  }

  const graphNodes: Record<string, unknown>[] = [organizationNode, pageNode];

  if (breadcrumbSchema) {
    graphNodes.push({
      '@type': breadcrumbSchema['@type'],
      '@id': breadcrumbSchema['@id'],
      itemListElement: breadcrumbSchema.itemListElement,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graphNodes,
  };
}

/**
 * Применяет SEO-метаданные, OpenGraph, геотеги Яндекса, директивы robots, canonical и JSON-LD к текущему документу.
 */
export function applyRouteSeoToDocument(meta: RouteSeoMetadata): void {
  if (typeof document === 'undefined') return;

  document.title = meta.title;

  const upsertMeta = (attr: 'name' | 'property', key: string, content: string) => {
    let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://fmworks.ru';
  const fullUrl = `${origin}${meta.canonicalPath}`;
  const ogImageUrl = buildRouteOgImageUrl(origin, meta.canonicalPath);

  upsertMeta('name', 'description', meta.description);
  upsertMeta(
    'name',
    'robots',
    meta.noindex ? 'noindex, nofollow' : INDEXABLE_ROBOTS_META_CONTENT
  );
  upsertMeta('name', 'geo.region', 'RU-TVE');
  upsertMeta('name', 'geo.placename', 'Тверь, Россия');
  upsertMeta('property', 'og:locale', 'ru_RU');
  upsertMeta(
    'property',
    'og:type',
    meta.schemaType === 'Article' ? 'article' : 'website'
  );
  upsertMeta('property', 'og:title', meta.title);
  upsertMeta('property', 'og:description', meta.description);
  upsertMeta('property', 'og:url', fullUrl);
  upsertMeta('property', 'og:image', ogImageUrl);
  upsertMeta('property', 'og:image:width', String(OG_IMAGE_WIDTH));
  upsertMeta('property', 'og:image:height', String(OG_IMAGE_HEIGHT));
  upsertMeta('property', 'og:image:type', 'image/png');
  upsertMeta('property', 'og:image:alt', meta.title);
  upsertMeta('property', 'og:site_name', 'FMWorks');
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', meta.title);
  upsertMeta('name', 'twitter:description', meta.description);
  upsertMeta('name', 'twitter:image', ogImageUrl);

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', fullUrl);

  const jsonLdPayload = buildRouteSchemaGraph(meta, origin);
  upsertJsonLdScriptInHead('fmworks-route-jsonld', jsonLdPayload);
  injectBusinessSchemasIntoDocument(origin, DEFAULT_OG_IMAGE_PATH);

  const breadcrumbJsonLd = buildBreadcrumbListJsonLd(meta, origin);
  const breadcrumbScriptEl = document.getElementById(
    'fmworks-breadcrumb-jsonld'
  ) as HTMLScriptElement | null;
  if (breadcrumbJsonLd) {
    upsertJsonLdScriptInHead('fmworks-breadcrumb-jsonld', breadcrumbJsonLd);
  } else if (breadcrumbScriptEl) {
    breadcrumbScriptEl.remove();
  }
}
