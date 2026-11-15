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
  collectSitemapRouteEntries,
  DEFAULT_SITEMAP_LASTMOD,
  injectRouteSeoIntoHtml,
  resolveServerRouteLookup,
} from './seoServerTemplates.ts';
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

test('buildSitemapXml автоматически собирает публичные роуты, опубликованные кейсы и услуги и совпадает с public/sitemap.xml', () => {
  const studioSitemap = buildSitemapXml('https://fmworks.ru', {
    airtimeEnabled: false,
    lastmodIsoDate: DEFAULT_SITEMAP_LASTMOD,
  });

  assert.ok(studioSitemap.includes('<loc>https://fmworks.ru/</loc>'));
  assert.ok(studioSitemap.includes('<loc>https://fmworks.ru/cases</loc>'));
  assert.ok(studioSitemap.includes('<loc>https://fmworks.ru/cases/audioworks-reel</loc>'));
  assert.ok(studioSitemap.includes('<loc>https://fmworks.ru/cases/dmitrogorsky</loc>'));
  assert.ok(studioSitemap.includes('<loc>https://fmworks.ru/cases/business-estate</loc>'));
  assert.ok(studioSitemap.includes('<loc>https://fmworks.ru/cases/medical-clinics</loc>'));
  assert.equal(studioSitemap.includes('auto-trade-in'), false);
  assert.ok(studioSitemap.includes('<loc>https://fmworks.ru/pricing</loc>'));
  assert.ok(studioSitemap.includes('<loc>https://fmworks.ru/approach</loc>'));
  assert.ok(studioSitemap.includes('<loc>https://fmworks.ru/faq</loc>'));
  assert.ok(studioSitemap.includes('/cases/industry/real-estate'));
  assert.ok(studioSitemap.includes('/cases/industry/medicine'));
  assert.ok(studioSitemap.includes('/cases/industry/retail-fmcg'));
  assert.ok(studioSitemap.includes('/cases/industry/b2b-finance'));
  assert.ok(studioSitemap.includes('/approach/phonebook-syndrome'));
  assert.ok(studioSitemap.includes('<image:image>'));
  assert.ok(studioSitemap.includes('<image:loc>https://fmworks.ru/api/og.png?route=%2Fpricing</image:loc>'));
  assert.equal(studioSitemap.includes('/hot-air'), false);
  assert.equal(studioSitemap.includes('/admin'), false);
  assert.equal(studioSitemap.includes('/order'), false);
  assert.equal(studioSitemap.includes('/cabinet'), false);
  assert.equal(studioSitemap.includes('/sound-drop'), false);

  const publicSitemapPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
  assert.equal(fs.existsSync(publicSitemapPath), true);
  assert.equal(fs.readFileSync(publicSitemapPath, 'utf8'), studioSitemap);

  const cmsFilteredSitemap = buildSitemapXml('https://fmworks.ru', {
    airtimeEnabled: false,
    lastmodIsoDate: '2026-11-15T10:58:00.000Z',
    cmsCases: [
      {
        id: 'dmitrogorsky',
        client: 'Дмитрогорский продукт',
        headline: 'Вкус',
        published: true,
      },
      {
        id: 'draft-secret-case',
        client: 'Черновик',
        headline: 'Скрытый кейс',
        published: false,
      },
      {
        id: 'new-published-case',
        client: 'Новый клиент',
        headline: 'Премьера',
        published: true,
      },
    ],
  });
  assert.ok(cmsFilteredSitemap.includes('<lastmod>2026-11-15</lastmod>'));
  assert.ok(cmsFilteredSitemap.includes('<loc>https://fmworks.ru/cases/audioworks-reel</loc>'));
  assert.ok(cmsFilteredSitemap.includes('<loc>https://fmworks.ru/cases/dmitrogorsky</loc>'));
  assert.ok(cmsFilteredSitemap.includes('<loc>https://fmworks.ru/cases/new-published-case</loc>'));
  assert.equal(cmsFilteredSitemap.includes('draft-secret-case'), false);

  const airtimeEntries = collectSitemapRouteEntries('https://fmworks.ru', {
    airtimeEnabled: true,
  });
  assert.ok(airtimeEntries.some((e) => e.path === '/hot-air'));
  assert.ok(airtimeEntries.some((e) => e.path.startsWith('/hot-air/stations/')));
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
  assert.ok(faqHtml.includes('<link rel="sitemap" type="application/xml" title="Sitemap" href="https://fmworks.ru/sitemap.xml" />'));
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
  assert.equal(org.email, 'art@artmspektr.ru');
  assert.equal(org.telephone, '+79040000911');
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
  assert.equal(local.contactPoint[0]['@type'], 'ContactPoint');
  assert.equal(local.makesOffer[0].itemOffered['@type'], 'Service');
  assert.equal(local.makesOffer[0].itemOffered['@id'], 'https://fmworks.ru/#service');
  assert.equal(local.hasOfferCatalog['@type'], 'OfferCatalog');
  assert.equal(local.hasOfferCatalog.itemListElement.length, 4);
  assert.deepEqual(local.parentOrganization, {
    '@id': 'https://fmworks.ru/#organization',
  });

  const service = buildServiceJsonLd('https://fmworks.ru/');
  assert.equal(service['@context'], 'https://schema.org');
  assert.equal(service['@type'], 'Service');
  assert.equal(service['@id'], 'https://fmworks.ru/#service');
  assert.ok(service.name.includes('AudioWorks'));
  assert.equal(service.provider['@type'], 'LocalBusiness');
  assert.equal(service.provider['@id'], 'https://fmworks.ru/#localbusiness');
  assert.equal(service.provider.telephone, '+79040000911');
  assert.equal(service.provider.email, 'art@artmspektr.ru');
  assert.equal(service.offers['@type'], 'AggregateOffer');
  assert.equal(service.offers.priceCurrency, 'RUB');
  assert.equal(service.offers.lowPrice, '15000');
  assert.equal(service.offers.highPrice, '35000');
  assert.equal(service.offers.offerCount, 4);
  assert.equal(service.hasOfferCatalog['@type'], 'OfferCatalog');
  assert.equal(service.hasOfferCatalog.itemListElement.length, 4);
  assert.equal(service.hasOfferCatalog.itemListElement[0].itemOffered['@type'], 'Service');

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
  const serviceMatch = homeHtml.match(
    new RegExp(
      `<script id="${SERVICE_JSONLD_SCRIPT_ID}" type="application\\/ld\\+json">([\\s\\S]*?)<\\/script>`
    )
  );
  assert.ok(orgMatch, 'Ожидался script Organization JSON-LD в head');
  assert.ok(localMatch, 'Ожидался script LocalBusiness JSON-LD в head');
  assert.ok(serviceMatch, 'Ожидался script Service JSON-LD в head');

  const parsedOrg = JSON.parse(orgMatch[1]);
  const parsedLocal = JSON.parse(localMatch[1]);
  const parsedService = JSON.parse(serviceMatch[1]);
  assert.equal(parsedOrg['@type'], 'Organization');
  assert.equal(parsedLocal['@type'], 'LocalBusiness');
  assert.equal(parsedLocal.address.streetAddress, '');
  assert.equal(parsedService['@type'], 'Service');
  assert.equal(parsedService.provider['@type'], 'LocalBusiness');
  assert.equal(parsedService.offers.priceCurrency, 'RUB');
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



