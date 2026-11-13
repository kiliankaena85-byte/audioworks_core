import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStationCatalogProfiles,
  CASE_DETAILED_BREAKDOWNS,
  getCaseDetailedBreakdown,
  INDUSTRY_SOLUTIONS,
  LEGAL_RIGHTS_DELIVERABLES,
  MODERATION_COMPLIANCE_RULES,
  PRODUCTION_STAGES_24_48H,
  RADIO_MISTAKE_ARTICLES,
  STATION_EDITORIAL_SEEDS,
} from './multiPageContentData';
import {
  buildClientNextStepsTimeline,
  computeRemainingHoldSeconds,
  createOrderDraftStore,
  resolveReservationLifecycleStatus,
} from './orderDraftStore';
import {
  buildPlatformPath,
  MAIN_PLATFORM_NAV_ITEMS,
  parsePlatformRoute,
  resolveActiveTopNavSection,
  resolveRouteSeoMeta,
} from './platformRouter';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';

test('MAIN_PLATFORM_NAV_ITEMS содержит ровно 5 согласованных разделов', () => {
  assert.deepEqual(
    MAIN_PLATFORM_NAV_ITEMS.map((item) => item.label),
    ['Главная', 'Горящий эфир', 'Кейсы', 'Тарифы', 'О подходе']
  );
  assert.deepEqual(
    MAIN_PLATFORM_NAV_ITEMS.map((item) => item.href),
    ['/', '/hot-air', '/cases', '/pricing', '/approach']
  );
});

test('parsePlatformRoute корректно разбирает чистые URL всех внутренних страниц', () => {
  assert.deepEqual(parsePlatformRoute('/'), { kind: 'home' });
  assert.deepEqual(parsePlatformRoute('/hot-air'), { kind: 'hot-air' });
  assert.deepEqual(parsePlatformRoute('/hot-air/stations/business-fm/'), {
    kind: 'station-detail',
    stationSlug: 'business-fm',
  });
  assert.deepEqual(parsePlatformRoute('/cases'), { kind: 'cases' });
  assert.deepEqual(parsePlatformRoute('/cases/dmitrogorsky'), {
    kind: 'case-detail',
    caseSlug: 'dmitrogorsky',
  });
  assert.deepEqual(parsePlatformRoute('/cases/industry/medicine'), {
    kind: 'industry-detail',
    industrySlug: 'medicine',
  });
  assert.deepEqual(parsePlatformRoute('/pricing', '', '#faq'), {
    kind: 'pricing',
    scrollAnchor: 'faq',
  });
  assert.deepEqual(parsePlatformRoute('/approach'), { kind: 'approach' });
  assert.deepEqual(parsePlatformRoute('/approach/phonebook-syndrome'), {
    kind: 'mistake-detail',
    articleSlug: 'phonebook-syndrome',
  });
  assert.deepEqual(parsePlatformRoute('/order'), { kind: 'order' });
  assert.deepEqual(parsePlatformRoute('/admin'), { kind: 'admin' });
});

test('parsePlatformRoute поддерживает обратную совместимость старых хеш-ссылок и ?case=', () => {
  assert.deepEqual(parsePlatformRoute('/', '', '#hot-air'), { kind: 'hot-air' });
  assert.deepEqual(parsePlatformRoute('/', '', '#work'), { kind: 'cases' });
  assert.deepEqual(parsePlatformRoute('/', '', '#case-business-estate'), {
    kind: 'case-detail',
    caseSlug: 'business-estate',
  });
  assert.deepEqual(parsePlatformRoute('/', '?case=medical-clinics', ''), {
    kind: 'case-detail',
    caseSlug: 'medical-clinics',
  });
  assert.deepEqual(parsePlatformRoute('/', '', '#pricing'), { kind: 'pricing' });
  assert.deepEqual(parsePlatformRoute('/', '', '#faq'), {
    kind: 'pricing',
    scrollAnchor: 'faq',
  });
});

test('resolveActiveTopNavSection подсвечивает родительский раздел на вложенных маршрутах', () => {
  assert.equal(
    resolveActiveTopNavSection({ kind: 'station-detail', stationSlug: 'avtoradio' }),
    'hot-air'
  );
  assert.equal(
    resolveActiveTopNavSection({ kind: 'industry-detail', industrySlug: 'real-estate' }),
    'cases'
  );
  assert.equal(
    resolveActiveTopNavSection({ kind: 'case-detail', caseSlug: 'dmitrogorsky' }),
    'cases'
  );
  assert.equal(
    resolveActiveTopNavSection({ kind: 'mistake-detail', articleSlug: 'fake-radio-euphoria' }),
    'approach'
  );
  assert.equal(resolveActiveTopNavSection({ kind: 'order' }), null);
});

test('resolveRouteSeoMeta формирует осмысленные SEO-заголовки и канонические пути', () => {
  const homeSeo = resolveRouteSeoMeta({ kind: 'home' });
  assert.ok(homeSeo.title.includes('FMWorks'));
  assert.equal(homeSeo.canonicalPath, '/');

  const stationSeo = resolveRouteSeoMeta(
    { kind: 'station-detail', stationSlug: 'business-fm' },
    { stationName: 'Business FM' }
  );
  assert.ok(stationSeo.title.includes('Business FM'));
  assert.equal(stationSeo.canonicalPath, '/hot-air/stations/business-fm');
  assert.equal(
    buildPlatformPath({ kind: 'station-detail', stationSlug: 'business-fm' }),
    '/hot-air/stations/business-fm'
  );
});

test('OrderDraftStore разделяет черновик (draft_selected) и подтверждённую бронь (confirmed_hold) + формирует 3 шага маршрута клиента', () => {
  const memory = new Map<string, string>();
  const adapter = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
  };

  const store = createOrderDraftStore(adapter);
  assert.equal(store.getSnapshot().mode, 'production_only');
  assert.equal(resolveReservationLifecycleStatus(store.getSnapshot()), 'none');

  const baseNow = 1_700_000_000_000;
  store.prepareMediaReservationOrder(
    {
      createdAtMs: baseNow,
      initialCountdownSeconds: 4 * 3600 - 1,
      nicheId: 'real_estate',
      nicheLabel: 'Недвижимость и ЖК',
      productNote: 'Старт продаж видовых квартир',
      durationPref: '30',
      spotDurationSec: 21,
      totalSpots: 16,
      totalReachOTS: 320_000,
      targetAudienceSharePct: 74,
      officialAirTotal: 260_000,
      hotAirTotal: 164_000,
      airDiscountPercent: 37,
      isBonusProductionUnlocked: false,
      initialProductionSelection: 'turnkey',
      initialRecommendedTier: 'turnkey',
      aiRationale: 'Деловой утренний прайм под ЖК бизнес-класса.',
      stations: [
        {
          slotId: 'bfm-morning',
          station: 'Business FM',
          frequencyFm: '87.5 FM',
          daypart: 'Утренний прайм 07:30–10:30',
          daysPattern: 'Пн–Пт',
          sampleTimeSlots: ['08:15', '09:15'],
          spotsIncluded: 16,
          maxDuration: 30,
          packageMultiplier: 1,
          exactDurationSec: 21,
          officialPrice: 260_000,
          hotPrice: 164_000,
          discountPercent: 37,
          reachOTS: 320_000,
        },
      ],
    },
    { nowMs: baseNow, returnPath: '/hot-air' }
  );

  // До отправки контакта статус = draft_selected (а не confirmed_hold)
  const rehydrated = createOrderDraftStore(adapter);
  const snap = rehydrated.getSnapshot();
  assert.equal(snap.mode, 'air_plus_production');
  assert.equal(snap.spotDurationSec, 21);
  assert.equal(snap.industryPreset, 'real-estate');
  assert.equal(snap.mediaReservation?.stations.length, 1);
  assert.equal(resolveReservationLifecycleStatus(snap), 'draft_selected');

  const remainingAfter10Min = computeRemainingHoldSeconds(
    snap.holdExpiresAtMs,
    baseNow + 600 * 1000
  );
  assert.equal(remainingAfter10Min, 4 * 3600 - 1 - 600);

  // После подтверждения брони по контакту статус = confirmed_hold
  rehydrated.confirmReservationOrder({
    orderNumber: 'FM-HOLD-2826',
    confirmedAtMs: baseNow + 30_000,
    holdExpiresAtMs: snap.holdExpiresAtMs!,
    checkoutMode: 'air_plus_production',
    contactLine: 'Алексей +7 999 123-45-67',
    companyLine: 'ООО СтройИнвест',
    formatLabel: 'Ролик «Под ключ» (+25 000 ₽)',
    spotDurationSec: 21,
    industryLabel: 'Недвижимость и ЖК',
    briefNote: 'Старт продаж видовых квартир',
    hasVoice: false,
    voiceSec: 0,
    fileName: null,
    conversionAllowed: true,
    innVerified: false,
    lockedMediaReservation: snap.mediaReservation,
    lockedTotals: null,
  });

  const confirmedRehydrated = createOrderDraftStore(adapter);
  assert.equal(
    resolveReservationLifecycleStatus(confirmedRehydrated.getSnapshot()),
    'confirmed_hold'
  );
  assert.equal(
    confirmedRehydrated.getSnapshot().confirmedReservation?.orderNumber,
    'FM-HOLD-2826'
  );

  // Проверяем 3 шага маршрута клиента после отправки
  const steps = buildClientNextStepsTimeline('air_plus_production', 2);
  assert.equal(steps.length, 3);
  assert.equal(steps[0].stepNumber, '01');
  assert.equal(steps[1].stepNumber, '02');
  assert.equal(steps[2].stepNumber, '03');
  assert.ok(steps[0].description.includes('2 ст.'));
});

test('Каталог радиостанций и разборы кейсов корректно агрегируются и не содержат запрещённых слов', () => {
  const catalog = buildStationCatalogProfiles();
  assert.ok(catalog.length >= 12);
  const bfm = catalog.find((s) => s.slug === 'business-fm');
  assert.ok(bfm);
  assert.ok(bfm.minRatePerSecRub > 0);
  assert.ok(bfm.slots.length >= 1);

  const estateCase = getCaseDetailedBreakdown({
    id: 'business-estate',
    client: 'Квартал бизнес-класса',
    tag: 'Девелопмент',
    summary: 'Статусный ролик',
    durationSec: 20,
  });
  assert.ok(estateCase.scriptCues.length >= 4);
  assert.equal(Object.keys(INDUSTRY_SOLUTIONS).length, 4);
  assert.equal(RADIO_MISTAKE_ARTICLES.length, 5);

  const fullSerialized = JSON.stringify({
    STATION_EDITORIAL_SEEDS,
    CASE_DETAILED_BREAKDOWNS,
    INDUSTRY_SOLUTIONS,
    PRODUCTION_STAGES_24_48H,
    LEGAL_RIGHTS_DELIVERABLES,
    MODERATION_COMPLIANCE_RULES,
    RADIO_MISTAKE_ARTICLES,
  }).toLowerCase();

  const violations = BANNED_EDITORIAL_TERMS.filter((term) =>
    fullSerialized.includes(term)
  );
  assert.deepEqual(
    violations,
    [],
    `Обнаружены запрещённые редакционной политикой слова: ${violations.join(', ')}`
  );
});
