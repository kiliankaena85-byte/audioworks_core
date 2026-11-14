import { isAirtimeSalesEnabled } from './platformFeatures.ts';
import {
  buildRouteSchemaGraph,
  DEFAULT_OG_IMAGE_PATH,
  parsePlatformRoute,
  resolveRouteSeoMeta,
  type RouteSeoLookupTitles,
  VALID_INDUSTRY_SLUGS,
} from './platformRouter.ts';

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

/**
 * Генерирует `robots.txt` для Яндекса, Google и других поисковых роботов:
 * закрывает закрытую админ-панель, API и служебный контур оформления заказа.
 */
export function buildRobotsTxt(origin: string): string {
  const cleanOrigin = normalizeOrigin(origin);
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /order',
    'Disallow: /booking',
    'Disallow: /checkout',
    'Disallow: /api/',
    '',
    'User-agent: Yandex',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /order',
    'Disallow: /booking',
    'Disallow: /checkout',
    'Disallow: /api/',
    'Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&persona /',
    '',
    `Sitemap: ${cleanOrigin}/sitemap.xml`,
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

function upsertRouteJsonLdScript(html: string, jsonPayload: unknown): string {
  const serialized = serializeJsonLdSafe(jsonPayload);
  const tag = `<script id="fmworks-route-jsonld" type="application/ld+json">${serialized}</script>`;
  const regex =
    /<script\b[^>]*\bid=["']fmworks-route-jsonld["'][^>]*>[\s\S]*?<\/script>/i;
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
 * Подставляет серверные SEO-метаданные, canonical, OpenGraph, `robots` и Schema.org JSON-LD
 * непосредственно в HTML-шаблон под конкретный URL запроса (для краулеров и мессенджеров).
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
  out = upsertHeadMetaTag(out, 'property', 'og:title', meta.title);
  out = upsertHeadMetaTag(out, 'property', 'og:description', meta.description);
  out = upsertHeadMetaTag(out, 'property', 'og:url', fullUrl);
  out = upsertHeadMetaTag(out, 'property', 'og:image', ogImageUrl);
  out = upsertHeadMetaTag(out, 'property', 'og:site_name', 'FMWorks');
  out = upsertHeadLinkTag(out, 'canonical', fullUrl);
  out = upsertRouteJsonLdScript(out, buildRouteSchemaGraph(meta, cleanOrigin));

  return out;
}
