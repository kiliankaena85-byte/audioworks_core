import { AIRTIME_SALES_ENABLED, isAirtimeSalesEnabled } from './platformFeatures.ts';

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

export type PlatformRoute =
  | { kind: 'home'; scrollAnchor?: string }
  | { kind: 'hot-air' }
  | { kind: 'station-detail'; stationSlug: string }
  | { kind: 'cases' }
  | { kind: 'case-detail'; caseSlug: string }
  | { kind: 'industry-detail'; industrySlug: IndustryVerticalSlug }
  | { kind: 'pricing'; scrollAnchor?: string }
  | { kind: 'approach' }
  | { kind: 'mistake-detail'; articleSlug: string }
  | { kind: 'faq' }
  | { kind: 'order' }
  | { kind: 'admin' };

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
    normalizedPath === '/order' ||
    normalizedPath === '/booking' ||
    normalizedPath === '/checkout'
  ) {
    return { kind: 'order' };
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
    return { kind: 'cases' };
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
        normalizedHash === 'stages-24-48' || normalizedHash === 'legal-clearance'
          ? normalizedHash
          : undefined,
    };
  }

  if (normalizedPath === '/approach') {
    return { kind: 'approach' };
  }

  if (normalizedPath.startsWith('/approach/')) {
    const slug = sanitizeSlugSegment(normalizedPath.slice('/approach/'.length));
    return slug ? { kind: 'mistake-detail', articleSlug: slug } : { kind: 'approach' };
  }

  if (normalizedPath === '/faq') {
    return { kind: 'faq' };
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
  if (normalizedHash === 'approach') {
    return { kind: 'approach' };
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
    case 'cases':
      return '/cases';
    case 'case-detail':
      return `/cases/${encodeURIComponent(route.caseSlug)}`;
    case 'industry-detail':
      return `/cases/industry/${route.industrySlug}`;
    case 'pricing':
      return route.scrollAnchor ? `/pricing#${route.scrollAnchor}` : '/pricing';
    case 'approach':
      return '/approach';
    case 'mistake-detail':
      return `/approach/${encodeURIComponent(route.articleSlug)}`;
    case 'faq':
      return '/faq';
    case 'order':
      return '/order';
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
    case 'order':
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

export interface RouteSeoLookupTitles {
  stationName?: string;
  caseClientName?: string;
  industryTitle?: string;
  articleTitle?: string;
}

export const DEFAULT_OG_IMAGE_PATH =
  '/src/assets/images/hero_studio_editorial_1794399404984.jpg';

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
          'Фиксированная стоимость радиороликов от 15 000 ₽ по рамочному договору, этапы продакшна, паспорт прав РАО/ВОИС и эфирная модерация.',
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
          'Как устроена проверка реквизитов, рамочный договор и счёт в ЭДО, оплата картой физлица по 54-ФЗ, договорной тариф и сроки продакшна аудиороликов.',
        canonicalPath: '/faq',
        schemaType: 'CollectionPage',
        noindex: false,
        breadcrumbs: [
          { name: 'Главная', path: '/' },
          { name: 'FAQ', path: '/faq' },
        ],
      };
    case 'order':
      return airtimeEnabled
        ? {
            title: 'Оформление брони эфира и заказа аудиоролика — FMWorks',
            description:
              'Поставьте эфирную сетку на приоритетный 4-часовой резерв или передайте голосовое ТЗ на производство радиоролика по договору и ЭДО.',
            canonicalPath: '/order',
            schemaType: 'CheckoutPage',
            noindex: true,
          }
        : {
            title: 'Оформление заказа аудиоролика — Студия FMWorks',
            description:
              'Передайте задачу и реквизиты или выберите консультацию продюсера: рамочный договор и счёт в ЭДО или оплата картой (54-ФЗ), старт сценариев и записи после предоплаты.',
            canonicalPath: '/order',
            schemaType: 'CheckoutPage',
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
          }
        : {
            title: 'Кабинет продюсера — Управление студией и заказами FMWorks',
            description:
              'Закрытая панель управления студийной витриной, заказами аудиороликов и SLA FMWorks.',
            canonicalPath: '/admin',
            schemaType: 'WebSite',
            noindex: true,
          };
  }
}

/**
 * Формирует расширенный граф Schema.org JSON-LD (`ProfessionalService` + сущность страницы + `BreadcrumbList`).
 */
export function buildRouteSchemaGraph(
  meta: RouteSeoMetadata,
  origin: string
): Record<string, unknown> {
  const cleanOrigin = origin.replace(/\/+$/g, '') || 'https://fmworks.ru';
  const fullUrl = `${cleanOrigin}${meta.canonicalPath}`;
  const ogImageUrl = `${cleanOrigin}${DEFAULT_OG_IMAGE_PATH}`;

  const graphNodes: Record<string, unknown>[] = [
    {
      '@type': 'ProfessionalService',
      '@id': `${cleanOrigin}/#organization`,
      name: 'FMWorks',
      url: cleanOrigin,
      email: 'hello@fmworks.ru',
      telephone: '+7 (4822) 75-04-20',
      image: ogImageUrl,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Тверь',
        addressRegion: 'Тверская область',
        addressCountry: 'RU',
      },
      areaServed: 'RU',
    },
    {
      '@type': meta.schemaType,
      '@id': `${fullUrl}#webpage`,
      name: meta.title,
      description: meta.description,
      url: fullUrl,
      inLanguage: 'ru-RU',
      primaryImageOfPage: ogImageUrl,
      provider: {
        '@id': `${cleanOrigin}/#organization`,
      },
    },
  ];

  if (meta.breadcrumbs && meta.breadcrumbs.length > 0) {
    graphNodes.push({
      '@type': 'BreadcrumbList',
      itemListElement: meta.breadcrumbs.map((crumb, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: crumb.name,
        item: `${cleanOrigin}${crumb.path}`,
      })),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graphNodes,
  };
}

/**
 * Применяет SEO-метаданные, OpenGraph, Twitter-карточки, директивы robots, canonical и JSON-LD к текущему документу.
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
  const ogImageUrl = `${origin}${DEFAULT_OG_IMAGE_PATH}`;

  upsertMeta('name', 'description', meta.description);
  upsertMeta(
    'name',
    'robots',
    meta.noindex ? 'noindex, nofollow' : 'index, follow'
  );
  upsertMeta('property', 'og:title', meta.title);
  upsertMeta('property', 'og:description', meta.description);
  upsertMeta('property', 'og:url', fullUrl);
  upsertMeta('property', 'og:image', ogImageUrl);
  upsertMeta('property', 'og:site_name', 'FMWorks');

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', fullUrl);

  const jsonLdPayload = buildRouteSchemaGraph(meta, origin);

  let scriptEl = document.getElementById('fmworks-route-jsonld') as HTMLScriptElement | null;
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = 'fmworks-route-jsonld';
    scriptEl.type = 'application/ld+json';
    document.head.appendChild(scriptEl);
  }
  scriptEl.textContent = JSON.stringify(jsonLdPayload);
}
