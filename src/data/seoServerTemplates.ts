import { BRAND_CASES, FLAGSHIP_STUDIO_REEL } from './casesData.ts';
import {
  buildFaqPageJsonLd,
  EDITORIAL_FAQ_ITEMS,
  HOME_PROCESS_FAQ_ITEMS,
} from './faqData.ts';
import { isAirtimeSalesEnabled } from './platformFeatures.ts';
import {
  buildBreadcrumbListJsonLd,
  buildRouteSchemaGraph,
  DEFAULT_OG_IMAGE_PATH,
  parsePlatformRoute,
  type PlatformRoute,
  resolveRouteSeoMeta,
  type RouteSeoLookupTitles,
  type RouteSeoMetadata,
  VALID_INDUSTRY_SLUGS,
} from './platformRouter.ts';
import {
  buildLocalBusinessJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  LOCAL_BUSINESS_JSONLD_SCRIPT_ID,
  ORGANIZATION_JSONLD_SCRIPT_ID,
  WEBSITE_JSONLD_SCRIPT_ID,
} from './seoUtils.ts';
import { CUSTOM_CONSULT_PRICING_ROW, EDITORIAL_PRICING_ROWS } from './pricingData.ts';
import { BROADCAST_TECH_STANDARD_ROWS } from './studioDocumentsCore.ts';

export const STATIC_MISTAKE_ARTICLE_SLUGS: readonly string[] = [
  'phonebook-syndrome',
  'fake-radio-euphoria',
  'lost-first-three-seconds',
  'disclaimer-ate-the-offer',
  'wrong-daypart-trap',
] as const;

export const DEFAULT_CASE_SLUGS: readonly string[] = [
  'dmitrogorsky',
  'business-estate',
  'medical-clinics',
  'auto-trade-in',
] as const;

const SERVER_INDUSTRY_TITLES: Record<string, string> = {
  'real-estate': 'Аудиореклама для жилых комплексов и девелоперов',
  medicine: 'Аудиореклама для клиник, стоматологии и диагностики',
  'retail-fmcg': 'Аудиореклама для продуктовых брендов, торговых сетей и HoReCa',
  'b2b-finance': 'Аудиореклама для банков, лизинга, логистики и B2B-сервисов',
};

const SERVER_ARTICLE_TITLES: Record<string, string> = {
  'phonebook-syndrome':
    'Синдром телефонного справочника: почему два контакта в ролике обнуляют звонки',
  'fake-radio-euphoria':
    'Фальшивый радио-восторг: как дежурная дикторская подача включает рекламную глухоту',
  'lost-first-three-seconds':
    'Потерянные первые 3 секунды: почему нельзя начинать ролик с названия компании',
  'disclaimer-ate-the-offer':
    'Юридический хвост, съевший оффер: ошибки расчёта хронометража в ЖК и медицине',
  'wrong-daypart-trap':
    'Ловушка утреннего прайма: когда дневные и вечерние слоты дают в 1,8 раза больше заявок',
};

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function serializeJsonLdSafe(payload: unknown): string {
  return JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export function normalizeOrigin(rawOrigin?: string): string {
  const trimmed = (rawOrigin ?? '').trim().replace(/\/+$/g, '');
  return trimmed || 'https://fmworks.ru';
}

export interface BuildRobotsOptions {
  airtimeEnabled?: boolean;
}

/**
 * Генерирует `robots.txt` для Яндекса, Поиска с Алисой (`YandexAdditionalBot`), Google и других ботов:
 * открывает основные контентные разделы, `/llms.txt` и статику, закрывает админ-панель,
 * API, служебный контур оформления заказа и законсервированный раздел `/hot-air`.
 */
export function buildRobotsTxt(
  origin: string,
  options: BuildRobotsOptions = {}
): string {
  const cleanOrigin = normalizeOrigin(origin);
  const airtimeEnabled = isAirtimeSalesEnabled(options.airtimeEnabled);

  const coreAllowLines = [
    'Allow: /',
    'Allow: /cases',
    'Allow: /pricing',
    'Allow: /approach',
    'Allow: /faq',
    'Allow: /llms.txt',
    'Allow: /turbo.xml',
    'Allow: /turbo-pages.xml',
    ...(airtimeEnabled ? ['Allow: /hot-air'] : []),
  ];

  const staticAllowLines = ['Allow: /assets/', 'Allow: /fonts/'];

  const disallowLines = [
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /order',
    'Disallow: /booking',
    'Disallow: /checkout',
    'Disallow: /cabinet',
    'Disallow: /account',
    'Disallow: /api/',
    ...(!airtimeEnabled ? ['Disallow: /hot-air', 'Disallow: /hot-air/'] : []),
  ];

  return [
    '# FMWorks — Правила индексации для Яндекса, Поиска с Алисой (Нейро), Google и других поисковых систем',
    '',
    'User-agent: Yandex',
    ...coreAllowLines,
    ...staticAllowLines,
    ...disallowLines,
    'Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&persona&yclid&ref /',
    '',
    'User-agent: YandexAdditionalBot',
    ...coreAllowLines,
    ...disallowLines,
    '',
    'User-agent: Googlebot',
    ...coreAllowLines,
    ...staticAllowLines,
    ...disallowLines,
    '',
    'User-agent: *',
    ...coreAllowLines,
    ...staticAllowLines,
    ...disallowLines,
    '',
    `Sitemap: ${cleanOrigin}/sitemap.xml`,
    '',
  ].join('\n');
}

/**
 * Генерирует структурированный Markdown-паспорт `/llms.txt` для нейросетевого поиска
 * (Яндекс Нейро / Поиск с Алисой и LLM-агрегаторов).
 */
export function buildLlmsTxt(origin: string): string {
  const cleanOrigin = normalizeOrigin(origin);
  return [
    '# FMWorks — Студийный аудиопродакшн для радио и бизнеса',
    '',
    '> Студия аудиорекламы полного цикла (г. Тверь, работаем онлайн по всей России). Создаём коммерческие аудиоролики с нуля по договору, с паспортом прав РАО/ВОИС и гарантией прохождения модерации радиостанций по ФЗ-38 «О рекламе».',
    '',
    '## Ключевые факты о компании',
    '- **Название:** FMWorks (Аудиопродакшн-студия FMWorks®)',
    '- **География:** г. Тверь, ул. Советская, д. 45, оф. 308 · приём и выпуск проектов по всей России (RU)',
    '- **Режим работы:** Пн–Пт, 09:00–19:00 (МСК)',
    '- **Контакты:** hello@fmworks.ru · +7 (4822) 75-04-20',
    '- **Оплата и документооборот:** Договор и счёт со сметой для юрлиц/ИП (УСН без НДС / НДС 5% / НДС 7% / ОСНО, ЭДО Диадок/СБИС/Контур) или оплата банковской картой / СБП (чек по 54-ФЗ). Работа начинается после согласования договора и 100% предоплаты.',
    '',
    '## Тарифы и сроки производства',
    ...EDITORIAL_PRICING_ROWS.map(
      (row) => `- **${row.title}:** ${row.priceFormatted} · ${row.turnaround} (${row.description})`
    ),
    `- **${CUSTOM_CONSULT_PRICING_ROW.title}:** ${CUSTOM_CONSULT_PRICING_ROW.priceFormatted} · ${CUSTOM_CONSULT_PRICING_ROW.turnaround} (${CUSTOM_CONSULT_PRICING_ROW.description})`,
    '',
    '## Технический стандарт сдачи мастер-пакета (ГОСТ / ФАС / радиосети РФ)',
    ...BROADCAST_TECH_STANDARD_ROWS.map((row) => `- **${row.parameter}:** ${row.specification}`),
    '',
    '## Основные разделы сайта',
    `- [Главная страница](${cleanOrigin}/): позиционирование, 15-секундная дуэль «до и после», витрина кейсов, калькулятор тарифов.`,
    `- [Тарифы и паспорт прав](${cleanOrigin}/pricing): сравнение пакетов, этапы производства, матрица модерации по ФЗ-38 и технические стандарты сдачи.`,
    `- [Кейсы и отраслевые решения](${cleanOrigin}/cases): разборы проектов с полными сценариями и посекундной партитурой.`,
    `- [Отрасль: ЖК и девелопмент](${cleanOrigin}/cases/industry/real-estate)`,
    `- [Отрасль: Медицина и клиники](${cleanOrigin}/cases/industry/medicine)`,
    `- [Отрасль: Ритейл и FMCG](${cleanOrigin}/cases/industry/retail-fmcg)`,
    `- [Отрасль: B2B и финансы](${cleanOrigin}/cases/industry/b2b-finance)`,
    `- [Подход и нейроисследования внимания](${cleanOrigin}/approach): как удерживать внимание в автопотоке и разбор 5 ошибок радиорекламы.`,
    `- [Частые вопросы (FAQ)](${cleanOrigin}/faq): оформление договора и счёта для юрлиц, оплата картой или по СБП, сроки, индивидуальные проекты.`,
    '',
  ].join('\n');
}

export interface BuildSitemapOptions {
  airtimeEnabled?: boolean;
  caseSlugs?: readonly string[];
  articleSlugs?: readonly string[];
  lastmodIsoDate?: string;
}

/**
 * Генерирует актуальный `sitemap.xml` для всех публичных разделов платформы FMWorks.
 */
export function buildSitemapXml(
  origin: string,
  options: BuildSitemapOptions = {}
): string {
  const cleanOrigin = normalizeOrigin(origin);
  const airtimeEnabled = isAirtimeSalesEnabled(options.airtimeEnabled);
  const lastmod =
    options.lastmodIsoDate || new Date().toISOString().slice(0, 10);

  const uniquePaths = new Set<string>([
    '/',
    '/cases',
    '/pricing',
    '/approach',
    '/faq',
  ]);

  if (airtimeEnabled) {
    uniquePaths.add('/hot-air');
  }

  for (const industrySlug of VALID_INDUSTRY_SLUGS) {
    uniquePaths.add(`/cases/industry/${industrySlug}`);
  }

  const caseSlugs =
    options.caseSlugs && options.caseSlugs.length > 0
      ? options.caseSlugs
      : DEFAULT_CASE_SLUGS;
  for (const slug of caseSlugs) {
    const clean = slug.trim().toLowerCase();
    if (clean) uniquePaths.add(`/cases/${encodeURIComponent(clean)}`);
  }

  const articleSlugs =
    options.articleSlugs && options.articleSlugs.length > 0
      ? options.articleSlugs
      : STATIC_MISTAKE_ARTICLE_SLUGS;
  for (const slug of articleSlugs) {
    const clean = slug.trim().toLowerCase();
    if (clean) uniquePaths.add(`/approach/${encodeURIComponent(clean)}`);
  }

  const urlsXml = Array.from(uniquePaths)
    .map((routePath) => {
      const priority =
        routePath === '/'
          ? '1.0'
          : routePath === '/pricing' || routePath === '/cases' || routePath === '/faq'
            ? '0.9'
            : '0.8';
      const changefreq = routePath === '/' ? 'weekly' : 'monthly';
      return [
        '  <url>',
        `    <loc>${escapeXmlText(`${cleanOrigin}${routePath}`)}</loc>`,
        `    <lastmod>${escapeXmlText(lastmod)}</lastmod>`,
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority}</priority>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlsXml,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * Разрешает точные заголовки кейса, отрасли или статьи для серверного рендеринга мета-тегов.
 */
export function resolveServerRouteLookup(
  pathname: string,
  cmsCases: readonly { id: string; client: string }[] = [],
  options: { search?: string; hash?: string; airtimeEnabled?: boolean } = {}
): RouteSeoLookupTitles {
  const route = parsePlatformRoute(
    pathname,
    options.search ?? '',
    options.hash ?? '',
    { airtimeEnabled: options.airtimeEnabled }
  );

  if (route.kind === 'case-detail') {
    const combined = [FLAGSHIP_STUDIO_REEL, ...BRAND_CASES, ...cmsCases];
    const matched = combined.find(
      (c) => c.id.toLowerCase() === route.caseSlug.toLowerCase()
    );
    if (matched) {
      return { caseClientName: matched.client };
    }
  }

  if (route.kind === 'industry-detail') {
    const title = SERVER_INDUSTRY_TITLES[route.industrySlug];
    if (title) {
      return { industryTitle: title };
    }
  }

  if (route.kind === 'mistake-detail') {
    const title = SERVER_ARTICLE_TITLES[route.articleSlug];
    if (title) {
      return { articleTitle: title };
    }
  }

  return {};
}

function buildSsrFallbackMarkup(
  route: PlatformRoute,
  meta: RouteSeoMetadata,
  cleanOrigin: string
): string {
  if (meta.noindex) {
    return '';
  }

  const navLinks = [
    { href: '/', label: 'Главная' },
    { href: '/cases', label: 'Кейсы' },
    { href: '/pricing', label: 'Тарифы' },
    { href: '/approach', label: 'О подходе' },
    { href: '/faq', label: 'FAQ' },
  ]
    .map(
      (item) =>
        `<a href="${escapeHtmlAttr(item.href)}">${escapeXmlText(item.label)}</a>`
    )
    .join(' · ');

  const pricingTable = [
    '<table>',
    '<caption>Тарифы студийного аудиопродакшна FMWorks</caption>',
    '<thead><tr><th>Тариф</th><th>Что входит</th><th>Срок</th><th>Стоимость</th></tr></thead>',
    '<tbody>',
    ...EDITORIAL_PRICING_ROWS.map(
      (r) =>
        `<tr><td>${escapeXmlText(r.title)}</td><td>${escapeXmlText(r.description)}</td><td>${escapeXmlText(r.turnaround)}</td><td>${escapeXmlText(r.priceFormatted)}</td></tr>`
    ),
    `<tr><td>${escapeXmlText(CUSTOM_CONSULT_PRICING_ROW.title)}</td><td>${escapeXmlText(CUSTOM_CONSULT_PRICING_ROW.description)}</td><td>${escapeXmlText(CUSTOM_CONSULT_PRICING_ROW.turnaround)}</td><td>${escapeXmlText(CUSTOM_CONSULT_PRICING_ROW.priceFormatted)}</td></tr>`,
    '</tbody>',
    '</table>',
  ].join('');

  const techStandardsTable = [
    '<table>',
    '<caption>Единый технический стандарт сдачи для радиостанций РФ</caption>',
    '<thead><tr><th>Параметр</th><th>Требование</th></tr></thead>',
    '<tbody>',
    ...BROADCAST_TECH_STANDARD_ROWS.map(
      (row) =>
        `<tr><td>${escapeXmlText(row.parameter)}</td><td>${escapeXmlText(row.specification)}</td></tr>`
    ),
    '</tbody>',
    '</table>',
  ].join('');

  let routeBodyHtml = '';
  if (route.kind === 'faq') {
    routeBodyHtml = [
      '<h2>Частые вопросы заказчиков</h2>',
      '<dl>',
      ...HOME_PROCESS_FAQ_ITEMS.map(
        (item) =>
          `<dt>${escapeXmlText(item.question)}</dt><dd>${escapeXmlText(item.answer)}</dd>`
      ),
      '</dl>',
    ].join('');
  } else if (route.kind === 'pricing') {
    routeBodyHtml = `${pricingTable}${techStandardsTable}`;
  } else if (route.kind === 'cases' || route.kind === 'case-detail' || route.kind === 'industry-detail') {
    routeBodyHtml = [
      '<h2>Примеры коммерческих аудиороликов FMWorks</h2>',
      '<ul>',
      ...[FLAGSHIP_STUDIO_REEL, ...BRAND_CASES].map(
        (c) =>
          `<li><a href="/cases/${encodeURIComponent(c.id)}">${escapeXmlText(`${c.client}: ${c.headline}`)}</a> — ${escapeXmlText(c.summary)} (${c.durationSec} сек)</li>`
      ),
      '</ul>',
      '<h2>Отраслевые стандарты</h2>',
      '<ul>',
      ...VALID_INDUSTRY_SLUGS.map(
        (slug) =>
          `<li><a href="/cases/industry/${slug}">${escapeXmlText(SERVER_INDUSTRY_TITLES[slug] || slug)}</a></li>`
      ),
      '</ul>',
    ].join('');
  } else if (route.kind === 'approach' || route.kind === 'mistake-detail') {
    routeBodyHtml = [
      '<h2>Разбор 5 ошибок в сценариях радиорекламы</h2>',
      '<ul>',
      ...STATIC_MISTAKE_ARTICLE_SLUGS.map(
        (slug) =>
          `<li><a href="/approach/${slug}">${escapeXmlText(SERVER_ARTICLE_TITLES[slug] || slug)}</a></li>`
      ),
      '</ul>',
    ].join('');
  } else {
    routeBodyHtml = [
      pricingTable,
      '<h2>Ключевые ответы по работе студии</h2>',
      '<dl>',
      ...EDITORIAL_FAQ_ITEMS.slice(0, 4).map(
        (item) =>
          `<dt>${escapeXmlText(item.question)}</dt><dd>${escapeXmlText(item.answer)}</dd>`
      ),
      '</dl>',
    ].join('');
  }

  return [
    '<noscript data-ssr-seo="true">',
    `<header><nav aria-label="Основная навигация">${navLinks}</nav></header>`,
    '<main>',
    `<h1>${escapeXmlText(meta.title)}</h1>`,
    `<p>${escapeXmlText(meta.description)}</p>`,
    routeBodyHtml,
    '</main>',
    '<footer><p>FMWorks® · г. Тверь, ул. Советская, д. 45, оф. 308 · Работаем по всей России · Пн–Пт 09:00–19:00 (МСК) · +7 (4822) 75-04-20 · hello@fmworks.ru</p></footer>',
    '</noscript>',
  ].join('');
}

function upsertHeadMetaTag(
  html: string,
  attr: 'name' | 'property',
  key: string,
  content: string
): string {
  const escaped = escapeHtmlAttr(content);
  const tag = `<meta ${attr}="${key}" content="${escaped}" />`;
  const regex = new RegExp(
    `<meta\\b[^>]*\\b${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
    'i'
  );
  if (regex.test(html)) {
    return html.replace(regex, tag);
  }
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

function upsertHeadLinkTag(html: string, rel: string, href: string): string {
  const escaped = escapeHtmlAttr(href);
  const tag = `<link rel="${rel}" href="${escaped}" />`;
  const regex = new RegExp(`<link\\b[^>]*\\brel=["']${rel}["'][^>]*>`, 'i');
  if (regex.test(html)) {
    return html.replace(regex, tag);
  }
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

function upsertHeadTurboRssLink(html: string, feedUrl: string): string {
  const escaped = escapeHtmlAttr(feedUrl);
  const tag = `<link rel="alternate" type="application/rss+xml" title="Яндекс Турбо-страницы — FMWorks" href="${escaped}" />`;
  const regex = /<link\b[^>]*\btype=["']application\/rss\+xml["'][^>]*>/i;
  if (regex.test(html)) {
    return html.replace(regex, tag);
  }
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

function upsertHeadJsonLdScript(
  html: string,
  scriptId: string,
  jsonPayload: unknown
): string {
  const serialized = serializeJsonLdSafe(jsonPayload);
  const tag = `<script id="${escapeHtmlAttr(scriptId)}" type="application/ld+json">${serialized}</script>`;
  const escapedId = scriptId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `<script\\b[^>]*\\bid=["']${escapedId}["'][^>]*>[\\s\\S]*?<\\/script>`,
    'i'
  );
  if (regex.test(html)) {
    return html.replace(regex, tag);
  }
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

export interface InjectRouteSeoOptions {
  search?: string;
  hash?: string;
  airtimeEnabled?: boolean;
  lookup?: RouteSeoLookupTitles;
}

/**
 * Подставляет серверные SEO-метаданные, canonical, OpenGraph, геотеги, `robots`, Schema.org JSON-LD
 * и семантический SSR-контент для поисковых роботов и нейропоиска (Яндекс Нейро / Алиса AI).
 */
export function injectRouteSeoIntoHtml(
  html: string,
  pathname: string,
  origin: string,
  options: InjectRouteSeoOptions = {}
): string {
  const cleanOrigin = normalizeOrigin(origin);
  const route = parsePlatformRoute(
    pathname,
    options.search ?? '',
    options.hash ?? '',
    { airtimeEnabled: options.airtimeEnabled }
  );
  const meta = resolveRouteSeoMeta(route, options.lookup ?? {}, {
    airtimeEnabled: options.airtimeEnabled,
  });

  const fullUrl = `${cleanOrigin}${meta.canonicalPath}`;
  const ogImageUrl = `${cleanOrigin}${DEFAULT_OG_IMAGE_PATH}`;
  const robotsValue = meta.noindex ? 'noindex, nofollow' : 'index, follow';

  let out = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeXmlText(meta.title)}</title>`
  );

  out = upsertHeadMetaTag(out, 'name', 'description', meta.description);
  out = upsertHeadMetaTag(out, 'name', 'robots', robotsValue);
  out = upsertHeadMetaTag(out, 'name', 'geo.region', 'RU-TVE');
  out = upsertHeadMetaTag(out, 'name', 'geo.placename', 'Тверь, Россия');
  out = upsertHeadMetaTag(out, 'property', 'og:locale', 'ru_RU');
  out = upsertHeadMetaTag(
    out,
    'property',
    'og:type',
    meta.schemaType === 'Article' ? 'article' : 'website'
  );
  out = upsertHeadMetaTag(out, 'property', 'og:title', meta.title);
  out = upsertHeadMetaTag(out, 'property', 'og:description', meta.description);
  out = upsertHeadMetaTag(out, 'property', 'og:url', fullUrl);
  out = upsertHeadMetaTag(out, 'property', 'og:image', ogImageUrl);
  out = upsertHeadMetaTag(out, 'property', 'og:site_name', 'FMWorks');
  out = upsertHeadLinkTag(out, 'canonical', fullUrl);
  out = upsertHeadTurboRssLink(out, `${cleanOrigin}/turbo-pages.xml`);
  out = upsertHeadJsonLdScript(
    out,
    'fmworks-route-jsonld',
    buildRouteSchemaGraph(meta, cleanOrigin)
  );
  out = upsertHeadJsonLdScript(
    out,
    ORGANIZATION_JSONLD_SCRIPT_ID,
    buildOrganizationJsonLd(cleanOrigin, DEFAULT_OG_IMAGE_PATH)
  );
  out = upsertHeadJsonLdScript(
    out,
    LOCAL_BUSINESS_JSONLD_SCRIPT_ID,
    buildLocalBusinessJsonLd(cleanOrigin, DEFAULT_OG_IMAGE_PATH)
  );
  out = upsertHeadJsonLdScript(
    out,
    WEBSITE_JSONLD_SCRIPT_ID,
    buildWebSiteJsonLd(cleanOrigin)
  );

  const breadcrumbSchema = buildBreadcrumbListJsonLd(meta, cleanOrigin);
  if (breadcrumbSchema) {
    out = upsertHeadJsonLdScript(
      out,
      'fmworks-breadcrumb-jsonld',
      breadcrumbSchema
    );
  }

  if (route.kind === 'faq') {
    const faqSchema = buildFaqPageJsonLd(HOME_PROCESS_FAQ_ITEMS, {
      pageUrl: `${cleanOrigin}/faq`,
      name: meta.title,
      description: meta.description,
    });
    out = upsertHeadJsonLdScript(out, 'fmworks-faqpage-jsonld', faqSchema);
  }

  const ssrFallbackHtml = buildSsrFallbackMarkup(route, meta, cleanOrigin);
  if (ssrFallbackHtml) {
    out = out.replace(/<\/body>/i, `    ${ssrFallbackHtml}\n  </body>`);
  }

  return out;
}
