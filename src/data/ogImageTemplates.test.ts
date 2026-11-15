import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  buildOgCardSvgTemplate,
  buildRouteOgImageUrl,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  resolveOgCardSpecForPath,
  wrapOgTextLines,
} from './ogImageTemplates.ts';
import { injectRouteSeoIntoHtml } from './seoServerTemplates.ts';
import {
  clearOgImageCache,
  renderOgPngForRoute,
  renderOgSvgForRoute,
} from '../server/ogImageRenderer.ts';

test('resolveOgCardSpecForPath генерирует персональные OpenGraph-карточки для кейсов, отраслей и услуг', () => {
  const caseSpec = resolveOgCardSpecForPath('/cases/dmitrogorsky');
  assert.equal(caseSpec.kind, 'case');
  assert.equal(caseSpec.routePath, '/cases/dmitrogorsky');
  assert.ok(caseSpec.title.includes('Дмитрогорский продукт'));
  assert.equal(caseSpec.badges.length, 3);
  assert.ok(caseSpec.coverImagePath.includes('hero_artisan_bakery_taste'));
  assert.equal(caseSpec.waveformSeeds.length, 28);

  const industrySpec = resolveOgCardSpecForPath('/cases/industry/medicine');
  assert.equal(industrySpec.kind, 'industry');
  assert.equal(industrySpec.routePath, '/cases/industry/medicine');
  assert.ok(industrySpec.title.includes('клиник'));
  assert.equal(industrySpec.badges.length, 3);

  const pricingSpec = resolveOgCardSpecForPath('/pricing');
  assert.equal(pricingSpec.kind, 'service');
  assert.equal(pricingSpec.routePath, '/pricing');
  assert.ok(pricingSpec.badges.some((b) => b.value.includes('15 000 ₽')));
  assert.ok(pricingSpec.badges.some((b) => b.value.includes('25 000 ₽')));
  assert.ok(pricingSpec.badges.some((b) => b.value.includes('35 000 ₽')));
  assert.ok(pricingSpec.badges.every((b) => b.label.length <= 25));

  const customCaseSpec = resolveOgCardSpecForPath('/cases/tver-coffee', {
    cmsCases: [
      {
        id: 'tver-coffee',
        client: 'Кофейня Утро',
        tag: 'HoReCa · Локальный эфир',
        headline: 'Аромат свежего эспрессо за 15 секунд',
        summary: 'Утренний ролик на Авторадио для привлечения трафика до работы.',
        quoteImage: '«Утро начинается со вкуса»',
        durationSec: 15,
        coverImageUrl: '/src/assets/images/case_retail_coffee_1794399406426.jpg',
        coverImageAlt: 'Кофе',
        editorialSurfaceBg: 'bg-[#2A1410]',
        posterGradientClass: 'bg-gradient-to-br',
        posterGlowClass: 'bg-[#FF4820]/20',
      },
    ],
  });
  assert.equal(customCaseSpec.kind, 'case');
  assert.equal(customCaseSpec.routePath, '/cases/tver-coffee');
  assert.ok(customCaseSpec.title.includes('Кофейня Утро'));
});

test('wrapOgTextLines и buildOgCardSvgTemplate строят валидный SVG-шаблон 1200×630', () => {
  const lines = wrapOgTextLines(
    'Очень длинный заголовок рекламного аудиоролика для федерального радиоэфира и бизнеса',
    28,
    3
  );
  assert.equal(lines.length, 3);
  assert.ok(lines.every((l) => l.length <= 29));

  const spec = resolveOgCardSpecForPath('/cases/business-estate');
  const svg = buildOgCardSvgTemplate(spec);
  assert.ok(svg.includes(`width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}"`));
  assert.ok(svg.includes('FMWorks'));
  assert.ok(svg.includes('Квартал бизнес-класса'));
  assert.ok(svg.includes('fmworks.ru/cases/business-estate'));
});

test('renderOgPngForRoute рендерит валидный PNG (1200×630) с кириллицей и встроенным фото', () => {
  clearOgImageCache();
  const rootDir = path.resolve(process.cwd());

  const { png: casePng } = renderOgPngForRoute(rootDir, '/cases/dmitrogorsky');
  assert.ok(Buffer.isBuffer(casePng));
  assert.ok(casePng.length > 20_000, `Expected PNG > 20KB, got ${casePng.length}`);
  assert.deepEqual(
    Array.from(casePng.subarray(0, 8)),
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  );

  const { png: pricingPng } = renderOgPngForRoute(rootDir, '/pricing');
  assert.ok(pricingPng.length > 20_000);
  assert.deepEqual(
    Array.from(pricingPng.subarray(0, 8)),
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  );

  const { svg } = renderOgSvgForRoute(rootDir, '/cases/medical-clinics');
  assert.ok(svg.includes('data:image/jpeg;base64,'));
});

test('injectRouteSeoIntoHtml подставляет динамический og:image URL и размеры 1200×630', () => {
  const baseHtml = `<!doctype html><html><head><title>Base</title></head><body><div id="root"></div></body></html>`;
  const caseHtml = injectRouteSeoIntoHtml(
    baseHtml,
    '/cases/dmitrogorsky',
    'https://fmworks.ru'
  );
  const expectedUrl = buildRouteOgImageUrl('https://fmworks.ru', '/cases/dmitrogorsky');
  assert.ok(caseHtml.includes(`content="${expectedUrl}"`));
  assert.ok(caseHtml.includes('<meta property="og:image:width" content="1200" />'));
  assert.ok(caseHtml.includes('<meta property="og:image:height" content="630" />'));
  assert.ok(caseHtml.includes('<meta property="og:image:type" content="image/png" />'));

  const pricingHtml = injectRouteSeoIntoHtml(
    baseHtml,
    '/pricing',
    'https://fmworks.ru'
  );
  assert.ok(
    pricingHtml.includes('https://fmworks.ru/api/og.png?route=%2Fpricing')
  );
});
