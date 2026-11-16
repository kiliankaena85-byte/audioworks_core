import {
  BRAND_CASES,
  type BrandCasePoster,
  FLAGSHIP_STUDIO_REEL,
} from './casesData.ts';
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
  INDEXABLE_ROBOTS_META_CONTENT,
  parsePlatformRoute,
  type PlatformRoute,
  resolveRouteSeoMeta,
  type RouteSeoLookupTitles,
  type RouteSeoMetadata,
  VALID_INDUSTRY_SLUGS,
} from './platformRouter.ts';
import {
  buildRouteOgImageUrl,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  resolveOgCardSpecForPath,
} from './ogImageTemplates.ts';
import {
  INDUSTRY_SOLUTIONS,
  RADIO_MISTAKE_ARTICLES,
} from './multiPageContentData.ts';
import { SEO_STATION_TITLE_BY_SLUG } from './seoRouteLabels.ts';
import type { PortfolioCaseRecord } from './studioCmsTypes.ts';
import {
  buildLocalBusinessJsonLd,
  buildOrganizationJsonLd,
  buildServiceJsonLd,
  buildWebSiteJsonLd,
  LOCAL_BUSINESS_JSONLD_SCRIPT_ID,
  ORGANIZATION_JSONLD_SCRIPT_ID,
  SERVICE_JSONLD_SCRIPT_ID,
  WEBSITE_JSONLD_SCRIPT_ID,
} from './seoUtils.ts';
import { CUSTOM_CONSULT_PRICING_ROW, EDITORIAL_PRICING_ROWS } from './pricingData.ts';
import { BROADCAST_TECH_STANDARD_ROWS } from './studioDocumentsCore.ts';

export const DEFAULT_SITEMAP_LASTMOD = '2026-11-15';

export const STATIC_MISTAKE_ARTICLE_SLUGS: readonly string[] =
  RADIO_MISTAKE_ARTICLES.map((article) => article.slug);

export const DEFAULT_CASE_SLUGS: readonly string[] = [
  FLAGSHIP_STUDIO_REEL.id,
  ...BRAND_CASES.map((item) => item.id),
];

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
 * Генерирует `robots.txt` по стандарту RFC 9309 для Яндекса, Поиска с Алисой (`YandexAdditionalBot`),
 * Google и современных AI-поисковиков (`OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`,
 * `Claude-User`, `PerplexityBot`, `Perplexity-User`) + явная политика для `GPTBot`, `ClaudeBot`, `Google-Extended`.
 * Устаревшие ссылки на закрытые Яндекс Турбо-страницы (отключены в апреле 2025 г.) удалены.
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
    'Allow: /privacy',
    'Allow: /llms.txt',
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
    'Disallow: /sound-drop',
    'Disallow: /api/',
    ...(!airtimeEnabled ? ['Disallow: /hot-air', 'Disallow: /hot-air/'] : []),
  ];

  const aiSearchAgentBlock = (userAgent: string): string[] => [
    `User-agent: ${userAgent}`,
    ...coreAllowLines,
    ...disallowLines,
    '',
  ];

  return [
    '# FMWorks — Правила индексации (RFC 9309) для Яндекса, Алисы, Google и AI-поисковиков',
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
    '# Поисковые и пользовательские AI-агенты (цитирование и ответы нейропоиска)',
    ...aiSearchAgentBlock('OAI-SearchBot'),
    ...aiSearchAgentBlock('ChatGPT-User'),
    ...aiSearchAgentBlock('Claude-SearchBot'),
    ...aiSearchAgentBlock('Claude-User'),
    ...aiSearchAgentBlock('PerplexityBot'),
    ...aiSearchAgentBlock('Perplexity-User'),
    '# Краулеры обучения моделей и grounding (публичные материалы открыты, служебные разделы закрыты)',
    ...aiSearchAgentBlock('GPTBot'),
    ...aiSearchAgentBlock('ClaudeBot'),
    'User-agent: Google-Extended',
    ...coreAllowLines,
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
 * Генерирует структурированный Markdown-паспорт `/llms.txt` по спецификации `llmstxt.org`
 * для нейросетевого поиска (Яндекс Нейро / Поиск с Алисой, ChatGPT Search, Perplexity, Claude).
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
    '- **География:** г. Тверь · приём и выпуск проектов по всей России (RU)',
    '- **Режим работы:** Пн–Пт, 09:00–19:00 (МСК)',
    '- **Контакты:** art@artmspektr.ru · +79040000911',
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
    `- [Отрасль: ЖК и девелопмент](${cleanOrigin}/cases/industry/real-estate): стандарты и сценарии для застройщиков.`,
    `- [Отрасль: Медицина и клиники](${cleanOrigin}/cases/industry/medicine): стандарты и требования ст. 24 ФЗ-38 для медцентров.`,
    `- [Отрасль: Ритейл и FMCG](${cleanOrigin}/cases/industry/retail-fmcg): офферы и драйв-звучание для сетей и HoReCa.`,
    `- [Отрасль: B2B и финансы](${cleanOrigin}/cases/industry/b2b-finance): ролики для банков, лизинга, логистики и B2B.`,
    `- [Подход и нейроисследования внимания](${cleanOrigin}/approach): как удерживать внимание в автопотоке и разбор 5 ошибок радиорекламы.`,
    `- [Частые вопросы (FAQ)](${cleanOrigin}/faq): оформление договора и счёта для юрлиц, оплата картой или по СБП, сроки, индивидуальные проекты.`,
    '',
    '## Optional',
    `- [Политика обработки персональных данных (152-ФЗ)](${cleanOrigin}/privacy): условия локализации ПДн в РФ и использования технических cookie.`,
    `- [Карта сайта XML](${cleanOrigin}/sitemap.xml): полный список канонических индексируемых URL и Open Graph превью.`,
    '',
  ].join('\n');
}

export type SitemapRouteCategory =
  | 'core'
  | 'services'
  | 'industry-service'
  | 'case'
  | 'article'
  | 'station';

export interface SitemapUrlEntry {
  path: string;
  loc: string;
  lastmod: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: string;
  category: SitemapRouteCategory;
  imageUrl?: string;
  imageTitle?: string;
}

export interface BuildSitemapOptions {
  airtimeEnabled?: boolean;
  caseSlugs?: readonly string[];
  cmsCases?: readonly Pick<
    PortfolioCaseRecord,
    'id' | 'client' | 'headline' | 'published'
  >[];
  flagshipReel?: Pick<BrandCasePoster, 'id' | 'client' | 'headline'>;
  articleSlugs?: readonly string[];
  stationSlugs?: readonly string[];
  lastmodIsoDate?: string;
  includeImages?: boolean;
}

function normalizeIsoDateOnly(rawDate?: string): string {
  const trimmed = (rawDate ?? '').trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  if (match) return match[1];
  return new Date().toISOString().slice(0, 10);
}

/**
 * Автоматически собирает структурированный список всех индексируемых URL платформы
 * на основе актуальных роутов, опубликованных кейсов (включая CMS), отраслевых услуг и статей.
 */
export function collectSitemapRouteEntries(
  origin: string,
  options: BuildSitemapOptions = {}
): SitemapUrlEntry[] {
  const cleanOrigin = normalizeOrigin(origin);
  const airtimeEnabled = isAirtimeSalesEnabled(options.airtimeEnabled);
  const lastmod = normalizeIsoDateOnly(options.lastmodIsoDate);
  const includeImages = options.includeImages !== false;

  const cmsPublishedCases =
    options.cmsCases && options.cmsCases.length > 0
      ? options.cmsCases.filter((c) => c.published !== false)
      : null;

  const flagship = options.flagshipReel ?? FLAGSHIP_STUDIO_REEL;

  const candidateSpecs: Array<{
    path: string;
    category: SitemapRouteCategory;
    changefreq: 'daily' | 'weekly' | 'monthly';
    priority: string;
  }> = [
    { path: '/', category: 'core', changefreq: 'weekly', priority: '1.0' },
    { path: '/cases', category: 'core', changefreq: 'weekly', priority: '0.9' },
    {
      path: '/pricing',
      category: 'services',
      changefreq: 'weekly',
      priority: '0.9',
    },
    {
      path: '/approach',
      category: 'core',
      changefreq: 'monthly',
      priority: '0.8',
    },
    { path: '/faq', category: 'core', changefreq: 'monthly', priority: '0.9' },
    {
      path: '/privacy',
      category: 'core',
      changefreq: 'monthly',
      priority: '0.5',
    },
  ];

  if (airtimeEnabled) {
    candidateSpecs.push({
      path: '/hot-air',
      category: 'services',
      changefreq: 'daily',
      priority: '0.8',
    });
    const stationSlugs =
      options.stationSlugs && options.stationSlugs.length > 0
        ? options.stationSlugs
        : Object.keys(SEO_STATION_TITLE_BY_SLUG);
    for (const slug of stationSlugs) {
      const clean = slug.trim().toLowerCase();
      if (clean) {
        candidateSpecs.push({
          path: `/hot-air/stations/${encodeURIComponent(clean)}`,
          category: 'station',
          changefreq: 'weekly',
          priority: '0.7',
        });
      }
    }
  }

  for (const industrySlug of VALID_INDUSTRY_SLUGS) {
    if (INDUSTRY_SOLUTIONS[industrySlug]) {
      candidateSpecs.push({
        path: `/cases/industry/${industrySlug}`,
        category: 'industry-service',
        changefreq: 'monthly',
        priority: '0.85',
      });
    }
  }

  const resolvedCaseSlugs: string[] = (() => {
    if (options.caseSlugs && options.caseSlugs.length > 0) {
      return [...options.caseSlugs];
    }
    if (cmsPublishedCases) {
      return [flagship.id, ...cmsPublishedCases.map((c) => c.id)];
    }
    return [...DEFAULT_CASE_SLUGS];
  })();

  for (const slug of resolvedCaseSlugs) {
    const clean = slug.trim().toLowerCase();
    if (clean) {
      candidateSpecs.push({
        path: `/cases/${encodeURIComponent(clean)}`,
        category: 'case',
        changefreq: 'monthly',
        priority: clean === flagship.id.toLowerCase() ? '0.85' : '0.8',
      });
    }
  }

  const articleSlugs =
    options.articleSlugs && options.articleSlugs.length > 0
      ? options.articleSlugs
      : STATIC_MISTAKE_ARTICLE_SLUGS;
  for (const slug of articleSlugs) {
    const clean = slug.trim().toLowerCase();
    if (clean) {
      candidateSpecs.push({
        path: `/approach/${encodeURIComponent(clean)}`,
        category: 'article',
        changefreq: 'monthly',
        priority: '0.75',
      });
    }
  }

  const seenPaths = new Set<string>();
  const entries: SitemapUrlEntry[] = [];

  for (const spec of candidateSpecs) {
    if (seenPaths.has(spec.path)) continue;
    const parsed = parsePlatformRoute(spec.path, '', '', { airtimeEnabled });
    const lookup = resolveServerRouteLookup(
      spec.path,
      cmsPublishedCases ?? undefined,
      { airtimeEnabled }
    );
    const meta = resolveRouteSeoMeta(parsed, lookup, { airtimeEnabled });
    if (meta.noindex) continue;

    seenPaths.add(spec.path);
    const loc = `${cleanOrigin}${spec.path}`;

    let imageUrl: string | undefined;
    let imageTitle: string | undefined;
    if (includeImages) {
      imageUrl = buildRouteOgImageUrl(cleanOrigin, meta.canonicalPath);
      const ogSpec = resolveOgCardSpecForPath(meta.canonicalPath, {
        cmsCases: cmsPublishedCases ?? undefined,
        flagshipReel: options.flagshipReel,
      });
      imageTitle = ogSpec.alt || meta.title;
    }

    entries.push({
      path: spec.path,
      loc,
      lastmod,
      changefreq: spec.changefreq,
      priority: spec.priority,
      category: spec.category,
      ...(imageUrl ? { imageUrl, imageTitle } : {}),
    });
  }

  return entries;
}

/**
 * Генерирует актуальный `sitemap.xml` (стандарт Sitemap 0.9 + Image Sitemap)
 * на основе списка доступных роутов, опубликованных кейсов и отраслевых услуг FMWorks.
 */
export function buildSitemapXml(
  origin: string,
  options: BuildSitemapOptions = {}
): string {
  const entries = collectSitemapRouteEntries(origin, options);
  const includeImages = options.includeImages !== false;

  const urlsXml = entries
    .map((entry) => {
      const imageBlock =
        includeImages && entry.imageUrl
          ? [
              '    <image:image>',
              `      <image:loc>${escapeXmlText(entry.imageUrl)}</image:loc>`,
              ...(entry.imageTitle
                ? [`      <image:title>${escapeXmlText(entry.imageTitle)}</image:title>`]
                : []),
              '    </image:image>',
            ]
          : [];

      return [
        '  <url>',
        `    <loc>${escapeXmlText(entry.loc)}</loc>`,
        `    <lastmod>${escapeXmlText(entry.lastmod)}</lastmod>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        ...imageBlock,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  const urlsetHeader = includeImages
    ? '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
    : '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    urlsetHeader,
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

const EXACT_STATIC_KNOWN_PATHS = new Set<string>([
  '/',
  '/cases',
  '/pricing',
  '/approach',
  '/faq',
  '/privacy',
  '/policy',
  '/personal-data',
  '/152-fz',
  '/order',
  '/booking',
  '/checkout',
  '/cabinet',
  '/account',
  '/cabinet/history',
  '/cabinet/archive',
  '/cabinet/reset',
  '/cabinet/recovery',
  '/sound-drop',
  '/admin',
]);

/**
 * Определяет точный HTTP-статус ответа для маршрута SPA (предотвращает Soft-404 на битых URL и несуществующих слагах).
 */
export function resolveServerRouteHttpStatus(
  pathname: string,
  cmsCases: readonly { id: string; published?: boolean }[] = [],
  options: { airtimeEnabled?: boolean } = {}
): 200 | 404 {
  const normalizedPath =
    (pathname || '/').trim().replace(/\/+$/g, '').toLowerCase() || '/';
  const airtimeEnabled = isAirtimeSalesEnabled(options.airtimeEnabled);

  if (EXACT_STATIC_KNOWN_PATHS.has(normalizedPath)) {
    return 200;
  }

  if (
    normalizedPath.startsWith('/admin/') ||
    normalizedPath.startsWith('/sound-drop/')
  ) {
    return 200;
  }

  if (normalizedPath === '/hot-air') {
    return airtimeEnabled ? 200 : 404;
  }

  if (normalizedPath.startsWith('/hot-air/stations/')) {
    if (!airtimeEnabled) return 404;
    const slug = normalizedPath.slice('/hot-air/stations/'.length).trim();
    return slug && slug in SEO_STATION_TITLE_BY_SLUG ? 200 : 404;
  }

  if (normalizedPath.startsWith('/cases/industry/')) {
    const indSlug = normalizedPath.slice('/cases/industry/'.length).trim();
    return (VALID_INDUSTRY_SLUGS as readonly string[]).includes(indSlug)
      ? 200
      : 404;
  }

  if (normalizedPath.startsWith('/cases/')) {
    const caseSlug = normalizedPath.slice('/cases/'.length).trim();
    if (!caseSlug || caseSlug.includes('/')) return 404;
    const combined =
      cmsCases.length > 0
        ? [FLAGSHIP_STUDIO_REEL, ...cmsCases.filter((c) => c.published !== false)]
        : [FLAGSHIP_STUDIO_REEL, ...BRAND_CASES];
    const exists = combined.some((c) => c.id.toLowerCase() === caseSlug);
    return exists ? 200 : 404;
  }

  if (normalizedPath.startsWith('/approach/')) {
    const articleSlug = normalizedPath.slice('/approach/'.length).trim();
    return articleSlug && STATIC_MISTAKE_ARTICLE_SLUGS.includes(articleSlug)
      ? 200
      : 404;
  }

  return 404;
}

function buildSsrFallbackMarkup(
  route: PlatformRoute,
  meta: RouteSeoMetadata
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
    '<footer><p>FMWorks® · г. Тверь · Работаем по всей России · Пн–Пт 09:00–19:00 (МСК) · +79040000911 · art@artmspektr.ru</p></footer>',
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

function upsertHeadSitemapLink(html: string, sitemapUrl: string): string {
  const escaped = escapeHtmlAttr(sitemapUrl);
  const tag = `<link rel="sitemap" type="application/xml" title="Sitemap" href="${escaped}" />`;
  const regex = /<link\b[^>]*\brel=["']sitemap["'][^>]*>/i;
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

function ensureHtmlOpenGraphPrefix(html: string): string {
  const htmlTagMatch = /<html\b([^>]*)>/i.exec(html);
  if (!htmlTagMatch) return html;
  const attrs = htmlTagMatch[1] ?? '';
  if (/\bprefix\s*=/i.test(attrs)) {
    return html;
  }
  return html.replace(
    /<html\b([^>]*)>/i,
    `<html$1 prefix="og: https://ogp.me/ns#">`
  );
}

export interface InjectRouteSeoOptions {
  search?: string;
  hash?: string;
  airtimeEnabled?: boolean;
  lookup?: RouteSeoLookupTitles;
  httpStatus?: number;
}

/**
 * Подставляет серверные SEO-метаданные, canonical, OpenGraph, геотеги, `robots` (включая `max-snippet:-1` / `max-image-preview:large`),
 * Schema.org JSON-LD и семантический SSR-контент для поисковых роботов и нейропоиска (Яндекс Нейро / Алиса AI / Google AI Overviews).
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
  const isNotFound = options.httpStatus === 404;
  const effectiveTitle = isNotFound
    ? 'Страница не найдена (404) — FMWorks'
    : meta.title;
  const effectiveDescription = isNotFound
    ? 'Запрошенный URL не найден на сайте студии аудиопродакшна FMWorks. Перейдите в каталог кейсов, тарифов или на главную страницу.'
    : meta.description;

  const fullUrl = `${cleanOrigin}${meta.canonicalPath}`;
  const ogImageUrl = buildRouteOgImageUrl(cleanOrigin, meta.canonicalPath);
  const robotsValue =
    isNotFound || meta.noindex
      ? 'noindex, nofollow'
      : INDEXABLE_ROBOTS_META_CONTENT;

  let out = ensureHtmlOpenGraphPrefix(html);
  out = out.replace(/<link\b[^>]*\btype=["']application\/rss\+xml["'][^>]*>\s*/gi, '');
  out = out.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeXmlText(effectiveTitle)}</title>`
  );

  out = upsertHeadMetaTag(out, 'name', 'description', effectiveDescription);
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
  out = upsertHeadMetaTag(out, 'property', 'og:title', effectiveTitle);
  out = upsertHeadMetaTag(out, 'property', 'og:description', effectiveDescription);
  out = upsertHeadMetaTag(out, 'property', 'og:url', fullUrl);
  out = upsertHeadMetaTag(out, 'property', 'og:image', ogImageUrl);
  out = upsertHeadMetaTag(
    out,
    'property',
    'og:image:width',
    String(OG_IMAGE_WIDTH)
  );
  out = upsertHeadMetaTag(
    out,
    'property',
    'og:image:height',
    String(OG_IMAGE_HEIGHT)
  );
  out = upsertHeadMetaTag(out, 'property', 'og:image:type', 'image/png');
  out = upsertHeadMetaTag(out, 'property', 'og:image:alt', effectiveTitle);
  out = upsertHeadMetaTag(out, 'property', 'og:site_name', 'FMWorks');
  out = upsertHeadMetaTag(out, 'name', 'twitter:card', 'summary_large_image');
  out = upsertHeadMetaTag(out, 'name', 'twitter:title', effectiveTitle);
  out = upsertHeadMetaTag(out, 'name', 'twitter:description', effectiveDescription);
  out = upsertHeadMetaTag(out, 'name', 'twitter:image', ogImageUrl);
  out = upsertHeadLinkTag(out, 'canonical', fullUrl);
  out = upsertHeadSitemapLink(out, `${cleanOrigin}/sitemap.xml`);
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
    SERVICE_JSONLD_SCRIPT_ID,
    buildServiceJsonLd(cleanOrigin, DEFAULT_OG_IMAGE_PATH)
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

  if (route.kind === 'faq' && !isNotFound) {
    const faqSchema = buildFaqPageJsonLd(HOME_PROCESS_FAQ_ITEMS, {
      pageUrl: `${cleanOrigin}/faq`,
      name: meta.title,
      description: meta.description,
    });
    out = upsertHeadJsonLdScript(out, 'fmworks-faqpage-jsonld', faqSchema);
  }

  const ssrFallbackHtml = isNotFound ? '' : buildSsrFallbackMarkup(route, meta);
  if (ssrFallbackHtml) {
    out = out.replace(/<\/body>/i, `    ${ssrFallbackHtml}\n  </body>`);
  }

  return out;
}
