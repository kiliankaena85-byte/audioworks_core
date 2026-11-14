import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRouteSchemaGraph,
  resolveRouteSeoMeta,
} from './platformRouter.ts';
import {
  buildRobotsTxt,
  buildSitemapXml,
  injectRouteSeoIntoHtml,
} from './seoServerTemplates.ts';

test('buildRobotsTxt закрывает /admin, /order и /api/ и указывает Sitemap', () => {
  const robots = buildRobotsTxt('https://fmworks.ru/');
  assert.ok(robots.includes('User-agent: *'));
  assert.ok(robots.includes('User-agent: Yandex'));
  assert.ok(robots.includes('Disallow: /admin'));
  assert.ok(robots.includes('Disallow: /order'));
  assert.ok(robots.includes('Disallow: /api/'));
  assert.ok(robots.includes('Sitemap: https://fmworks.ru/sitemap.xml'));
});

test('buildSitemapXml включает публичные маршруты и исключает /admin, /order и отключённый /hot-air', () => {
  const studioSitemap = buildSitemapXml('https://fmworks.ru', {
    airtimeEnabled: false,
    lastmodIsoDate: '2026-11-14',
  });

  assert.ok(studioSitemap.includes('<loc>https://fmworks.ru/</loc>'));
  assert.ok(studioSitemap.includes('<loc>https://fmworks.ru/cases</loc>'));
  assert.ok(studioSitemap.includes('<loc>https://fmworks.ru/pricing</loc>'));
  assert.ok(studioSitemap.includes('<loc>https://fmworks.ru/approach</loc>'));
  assert.ok(studioSitemap.includes('<loc>https://fmworks.ru/faq</loc>'));
  assert.ok(studioSitemap.includes('/cases/industry/real-estate'));
  assert.ok(studioSitemap.includes('/approach/phonebook-syndrome'));
  assert.equal(studioSitemap.includes('/hot-air'), false);
  assert.equal(studioSitemap.includes('/admin'), false);
  assert.equal(studioSitemap.includes('/order'), false);

  const airtimeSitemap = buildSitemapXml('https://fmworks.ru', {
    airtimeEnabled: true,
  });
  assert.ok(airtimeSitemap.includes('<loc>https://fmworks.ru/hot-air</loc>'));
});

test('injectRouteSeoIntoHtml подставляет метаданные, canonical, noindex и Schema.org @graph под маршрут', () => {
  const baseHtml = `<!doctype html><html><head>
    <title>Base</title>
    <meta name="description" content="Base desc" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://fmworks.ru/" />
    <meta property="og:title" content="Base" />
    <meta property="og:description" content="Base desc" />
  </head><body><div id="root"></div></body></html>`;

  const faqHtml = injectRouteSeoIntoHtml(baseHtml, '/faq', 'https://fmworks.ru');
  assert.ok(faqHtml.includes('<title>Частые вопросы (FAQ) по договору, оплате и срокам — FMWorks</title>'));
  assert.ok(faqHtml.includes('<link rel="canonical" href="https://fmworks.ru/faq" />'));
  assert.ok(faqHtml.includes('<meta name="robots" content="index, follow" />'));
  assert.ok(faqHtml.includes('id="fmworks-route-jsonld"'));
  assert.ok(faqHtml.includes('ProfessionalService'));
  assert.ok(faqHtml.includes('BreadcrumbList'));
  assert.ok(faqHtml.includes('property="og:title"'));
  assert.equal(faqHtml.includes('twitter:'), false);

  const adminHtml = injectRouteSeoIntoHtml(baseHtml, '/admin', 'https://fmworks.ru');
  assert.ok(adminHtml.includes('<meta name="robots" content="noindex, nofollow" />'));

  const orderHtml = injectRouteSeoIntoHtml(baseHtml, '/order', 'https://fmworks.ru');
  assert.ok(orderHtml.includes('<meta name="robots" content="noindex, nofollow" />'));
});

test('buildRouteSchemaGraph формирует валидные узлы ProfessionalService (Тверь) и BreadcrumbList', () => {
  const meta = resolveRouteSeoMeta({ kind: 'pricing' });
  const graph = buildRouteSchemaGraph(meta, 'https://fmworks.ru') as {
    '@context': string;
    '@graph': Array<Record<string, unknown>>;
  };
  assert.equal(graph['@context'], 'https://schema.org');
  assert.equal(graph['@graph'].length, 3);
  assert.equal(graph['@graph'][0]['@type'], 'ProfessionalService');
  assert.equal(graph['@graph'][1]['@type'], 'Service');
  assert.equal(graph['@graph'][2]['@type'], 'BreadcrumbList');
});
