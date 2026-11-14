import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildBreadcrumbListJsonLd,
  buildRouteSchemaGraph,
  resolveRouteSeoMeta,
} from './platformRouter.ts';
import {
  buildLlmsTxt,
  buildRobotsTxt,
  buildSitemapXml,
  injectRouteSeoIntoHtml,
  resolveServerRouteLookup,
} from './seoServerTemplates.ts';
import {
  buildLocalBusinessJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  LOCAL_BUSINESS_JSONLD_SCRIPT_ID,
  ORGANIZATION_JSONLD_SCRIPT_ID,
  WEBSITE_JSONLD_SCRIPT_ID,
} from './seoUtils.ts';

test('buildRobotsTxt оптимизирован для Яндекса, YandexAdditionalBot и Google и совпадает с public/robots.txt', () => {
  const robots = buildRobotsTxt('https://fmworks.ru/', {
    airtimeEnabled: false,
  });
  assert.ok(robots.includes('User-agent: Yandex'));
  assert.ok(robots.includes('User-agent: YandexAdditionalBot'));
  assert.ok(robots.includes('User-agent: Googlebot'));
  assert.ok(robots.includes('User-agent: *'));
  assert.ok(robots.includes('Allow: /cases'));
  assert.ok(robots.includes('Allow: /pricing'));
  assert.ok(robots.includes('Allow: /approach'));
  assert.ok(robots.includes('Allow: /faq'));
  assert.ok(robots.includes('Allow: /llms.txt'));
  assert.ok(robots.includes('Disallow: /admin'));
  assert.ok(robots.includes('Disallow: /order'));
  assert.ok(robots.includes('Disallow: /api/'));
  assert.ok(robots.includes('Disallow: /hot-air'));
  assert.ok(robots.includes('Clean-param:'));
  assert.ok(robots.includes('Sitemap: https://fmworks.ru/sitemap.xml'));

  const publicRobotsPath = path.resolve(process.cwd(), 'public', 'robots.txt');
  assert.equal(fs.existsSync(publicRobotsPath), true);
  assert.equal(fs.readFileSync(publicRobotsPath, 'utf8'), robots);

  const robotsAirtimeActive = buildRobotsTxt('https://fmworks.ru', {
    airtimeEnabled: true,
  });
  assert.ok(robotsAirtimeActive.includes('Allow: /hot-air'));
  assert.equal(robotsAirtimeActive.includes('Disallow: /hot-air'), false);
});

test('buildLlmsTxt формирует структурированный AI-паспорт и совпадает с public/llms.txt', () => {
  const llms = buildLlmsTxt('https://fmworks.ru/');
  assert.ok(llms.includes('# FMWorks'));
  assert.ok(llms.includes('15 000 ₽'));
  assert.ok(llms.includes('25 000 ₽'));
  assert.ok(llms.includes('35 000 ₽'));
  assert.ok(llms.includes('-14 … -11 LUFS'));
  assert.ok(llms.includes('https://fmworks.ru/pricing'));
  assert.ok(llms.includes('https://fmworks.ru/faq'));

  const publicLlmsPath = path.resolve(process.cwd(), 'public', 'llms.txt');
  assert.equal(fs.existsSync(publicLlmsPath), true);
  assert.equal(fs.readFileSync(publicLlmsPath, 'utf8'), llms);
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

test('resolveServerRouteLookup находит точные заголовки кейсов, отраслей и статей', () => {
  assert.deepEqual(resolveServerRouteLookup('/cases/dmitrogorsky'), {
    caseClientName: 'Дмитрогорский продукт',
  });
  assert.deepEqual(resolveServerRouteLookup('/cases/industry/medicine'), {
    industryTitle: 'Аудиореклама для клиник, стоматологии и диагностики',
  });
  assert.ok(
    resolveServerRouteLookup('/approach/phonebook-syndrome').articleTitle?.includes(
      'Синдром телефонного справочника'
    )
  );
});

test('injectRouteSeoIntoHtml подставляет метаданные, гео-теги, SSR-таблицы и FAQPage JSON-LD', () => {
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
  assert.ok(faqHtml.includes('<meta name="geo.region" content="RU-TVE" />'));
  assert.ok(faqHtml.includes('<meta property="og:locale" content="ru_RU" />'));
  assert.ok(faqHtml.includes('id="fmworks-route-jsonld"'));
  assert.ok(faqHtml.includes('id="fmworks-faqpage-jsonld"'));
  assert.ok(faqHtml.includes('FAQPage'));
  assert.ok(faqHtml.includes('ProfessionalService'));
  assert.ok(faqHtml.includes('OfferCatalog'));
  assert.ok(faqHtml.includes('BreadcrumbList'));
  assert.ok(faqHtml.includes('<div id="root"></div>'));
  assert.ok(faqHtml.includes('<noscript data-ssr-seo="true">'));
  assert.ok(faqHtml.includes('</noscript>'));
  assert.equal(faqHtml.includes('twitter:'), false);

  const pricingHtml = injectRouteSeoIntoHtml(baseHtml, '/pricing', 'https://fmworks.ru');
  assert.ok(pricingHtml.includes('<div id="root"></div>'));
  assert.ok(pricingHtml.includes('<table>'));
  assert.ok(pricingHtml.includes('25 000 ₽'));
  assert.ok(pricingHtml.includes('-14 … -11 LUFS'));

  const adminHtml = injectRouteSeoIntoHtml(baseHtml, '/admin', 'https://fmworks.ru');
  assert.ok(adminHtml.includes('<meta name="robots" content="noindex, nofollow" />'));
  assert.equal(adminHtml.includes('data-ssr-seo'), false);

  const orderHtml = injectRouteSeoIntoHtml(baseHtml, '/order', 'https://fmworks.ru');
  assert.ok(orderHtml.includes('<meta name="robots" content="noindex, nofollow" />'));
  assert.equal(orderHtml.includes('data-ssr-seo'), false);
});

test('buildRouteSchemaGraph формирует коммерческие Offer в RUB и BreadcrumbList', () => {
  const meta = resolveRouteSeoMeta({ kind: 'pricing' });
  const graph = buildRouteSchemaGraph(meta, 'https://fmworks.ru') as {
    '@context': string;
    '@graph': Array<Record<string, unknown>>;
  };
  assert.equal(graph['@context'], 'https://schema.org');
  assert.equal(graph['@graph'].length, 3);
  assert.equal(graph['@graph'][0]['@type'], 'ProfessionalService');
  assert.equal(graph['@graph'][0]['currenciesAccepted'], 'RUB');
  assert.ok(graph['@graph'][0]['hasOfferCatalog']);
  assert.equal(graph['@graph'][1]['@type'], 'Service');
  assert.deepEqual(graph['@graph'][1]['breadcrumb'], {
    '@id': 'https://fmworks.ru/pricing#breadcrumb',
  });
  assert.equal(graph['@graph'][2]['@type'], 'BreadcrumbList');
  assert.equal(graph['@graph'][2]['@id'], 'https://fmworks.ru/pricing#breadcrumb');
});

test('buildBreadcrumbListJsonLd генерирует иерархическую разметку для всех подстраниц и null для главной', () => {
  const homeMeta = resolveRouteSeoMeta({ kind: 'home' });
  assert.equal(buildBreadcrumbListJsonLd(homeMeta, 'https://fmworks.ru'), null);

  const subRoutes = [
    resolveRouteSeoMeta({ kind: 'cases' }),
    resolveRouteSeoMeta(
      { kind: 'case-detail', caseSlug: 'dmitrogorsky' },
      { caseClientName: 'Дмитрогорский продукт' }
    ),
    resolveRouteSeoMeta(
      { kind: 'industry-detail', industrySlug: 'medicine' },
      { industryTitle: 'Аудиореклама для клиник' }
    ),
    resolveRouteSeoMeta({ kind: 'pricing' }),
    resolveRouteSeoMeta({ kind: 'approach' }),
    resolveRouteSeoMeta(
      { kind: 'mistake-detail', articleSlug: 'phonebook-syndrome' },
      { articleTitle: 'Синдром телефонного справочника' }
    ),
    resolveRouteSeoMeta({ kind: 'faq' }),
    resolveRouteSeoMeta({ kind: 'order' }),
    resolveRouteSeoMeta({ kind: 'admin' }),
    resolveRouteSeoMeta({ kind: 'hot-air' }, {}, { airtimeEnabled: true }),
    resolveRouteSeoMeta(
      { kind: 'station-detail', stationSlug: 'business-fm' },
      { stationName: 'Business FM' },
      { airtimeEnabled: true }
    ),
  ];

  for (const meta of subRoutes) {
    const schema = buildBreadcrumbListJsonLd(meta, 'https://fmworks.ru/');
    assert.ok(schema, `Ожидалась разметка BreadcrumbList для ${meta.canonicalPath}`);
    assert.equal(schema['@context'], 'https://schema.org');
    assert.equal(schema['@type'], 'BreadcrumbList');
    assert.equal(schema['@id'], `https://fmworks.ru${meta.canonicalPath}#breadcrumb`);
    assert.ok(schema.itemListElement.length >= 2);
    assert.equal(schema.itemListElement[0].position, 1);
    assert.equal(schema.itemListElement[0].name, 'Главная');
    assert.equal(schema.itemListElement[0].item, 'https://fmworks.ru/');
    const last = schema.itemListElement[schema.itemListElement.length - 1];
    assert.equal(last.position, schema.itemListElement.length);
    assert.equal(last.item, `https://fmworks.ru${meta.canonicalPath}`);
  }

  const baseHtml =
    '<!doctype html><html><head><title>Base</title></head><body><div id="root"></div></body></html>';
  const homeHtml = injectRouteSeoIntoHtml(baseHtml, '/', 'https://fmworks.ru');
  assert.equal(homeHtml.includes('id="fmworks-breadcrumb-jsonld"'), false);

  const casesHtml = injectRouteSeoIntoHtml(baseHtml, '/cases', 'https://fmworks.ru');
  assert.ok(casesHtml.includes('id="fmworks-breadcrumb-jsonld"'));
  assert.ok(casesHtml.includes('https://fmworks.ru/cases#breadcrumb'));

  const approachHtml = injectRouteSeoIntoHtml(baseHtml, '/approach/phonebook-syndrome', 'https://fmworks.ru');
  assert.ok(approachHtml.includes('id="fmworks-breadcrumb-jsonld"'));
  assert.ok(approachHtml.includes('https://fmworks.ru/approach'));
  assert.ok(approachHtml.includes('https://fmworks.ru/approach/phonebook-syndrome'));
});

test('buildOrganizationJsonLd и buildLocalBusinessJsonLd структурируют реквизиты студии для Яндекса и Google и внедряются в SSR HTML', () => {
  const org = buildOrganizationJsonLd('https://fmworks.ru/');
  assert.equal(org['@context'], 'https://schema.org');
  assert.equal(org['@type'], 'Organization');
  assert.equal(org['@id'], 'https://fmworks.ru/#organization');
  assert.equal(org.name, 'FMWorks');
  assert.equal(org.email, 'hello@fmworks.ru');
  assert.equal(org.telephone, '+7 (4822) 75-04-20');
  assert.equal(org.address['@type'], 'PostalAddress');
  assert.equal(org.address.postalCode, '170100');
  assert.equal(org.address.addressLocality, 'Тверь');
  assert.equal(org.address.addressCountry, 'RU');
  assert.equal(org.contactPoint[0]['@type'], 'ContactPoint');
  assert.deepEqual(org.contactPoint[0].availableLanguage, ['Russian']);
  assert.equal(org.logo['@type'], 'ImageObject');
  assert.ok(org.knowsAbout.length >= 4);

  const local = buildLocalBusinessJsonLd('https://fmworks.ru/');
  assert.equal(local['@context'], 'https://schema.org');
  assert.equal(local['@type'], 'LocalBusiness');
  assert.equal(local['@id'], 'https://fmworks.ru/#localbusiness');
  assert.equal(local.currenciesAccepted, 'RUB');
  assert.equal(local.geo['@type'], 'GeoCoordinates');
  assert.equal(typeof local.geo.latitude, 'number');
  assert.equal(typeof local.geo.longitude, 'number');
  assert.equal(local.openingHoursSpecification[0].opens, '09:00');
  assert.equal(local.openingHoursSpecification[0].closes, '19:00');
  assert.deepEqual(local.parentOrganization, {
    '@id': 'https://fmworks.ru/#organization',
  });

  const baseHtml =
    '<!doctype html><html><head><title>Base</title></head><body><div id="root"></div></body></html>';
  const homeHtml = injectRouteSeoIntoHtml(baseHtml, '/', 'https://fmworks.ru');

  const orgMatch = homeHtml.match(
    new RegExp(
      `<script id="${ORGANIZATION_JSONLD_SCRIPT_ID}" type="application\\/ld\\+json">([\\s\\S]*?)<\\/script>`
    )
  );
  const localMatch = homeHtml.match(
    new RegExp(
      `<script id="${LOCAL_BUSINESS_JSONLD_SCRIPT_ID}" type="application\\/ld\\+json">([\\s\\S]*?)<\\/script>`
    )
  );
  assert.ok(orgMatch, 'Ожидался script Organization JSON-LD в head');
  assert.ok(localMatch, 'Ожидался script LocalBusiness JSON-LD в head');

  const parsedOrg = JSON.parse(orgMatch[1]);
  const parsedLocal = JSON.parse(localMatch[1]);
  assert.equal(parsedOrg['@type'], 'Organization');
  assert.equal(parsedLocal['@type'], 'LocalBusiness');
  assert.equal(parsedLocal.address.streetAddress, 'ул. Советская, д. 45, оф. 308');
});

test('buildWebSiteJsonLd формирует схему WebSite с potentialAction SearchAction и search-input для Sitelinks Search Box', () => {
  const website = buildWebSiteJsonLd('https://fmworks.ru/');
  assert.equal(website['@context'], 'https://schema.org');
  assert.equal(website['@type'], 'WebSite');
  assert.equal(website['@id'], 'https://fmworks.ru/#website');
  assert.equal(website.url, 'https://fmworks.ru/');
  assert.equal(website.inLanguage, 'ru-RU');
  assert.deepEqual(website.publisher, {
    '@id': 'https://fmworks.ru/#organization',
  });
  assert.equal(website.potentialAction['@type'], 'SearchAction');
  assert.equal(website.potentialAction.target['@type'], 'EntryPoint');
  assert.equal(
    website.potentialAction.target.urlTemplate,
    'https://fmworks.ru/cases?q={search_term_string}'
  );
  assert.equal(
    website.potentialAction['query-input'],
    'required name=search_term_string'
  );
  assert.equal(
    website.potentialAction['search-input'],
    'required name=search_term_string'
  );

  const homeMeta = resolveRouteSeoMeta({ kind: 'home' });
  const homeGraph = buildRouteSchemaGraph(homeMeta, 'https://fmworks.ru') as {
    '@graph': Array<Record<string, unknown>>;
  };
  assert.equal(homeGraph['@graph'].length, 2);
  assert.equal(homeGraph['@graph'][1]['@type'], 'WebSite');
  assert.ok(homeGraph['@graph'][1]['potentialAction']);

  const baseHtml =
    '<!doctype html><html><head><title>Base</title></head><body><div id="root"></div></body></html>';
  const homeHtml = injectRouteSeoIntoHtml(baseHtml, '/', 'https://fmworks.ru');
  const websiteMatch = homeHtml.match(
    new RegExp(
      `<script id="${WEBSITE_JSONLD_SCRIPT_ID}" type="application\\/ld\\+json">([\\s\\S]*?)<\\/script>`
    )
  );
  assert.ok(websiteMatch, 'Ожидался script WebSite JSON-LD в head');
  const parsedWebsite = JSON.parse(websiteMatch[1]);
  assert.equal(parsedWebsite['@type'], 'WebSite');
  assert.equal(parsedWebsite.potentialAction['@type'], 'SearchAction');
  assert.equal(
    parsedWebsite.potentialAction['search-input'],
    'required name=search_term_string'
  );
});



