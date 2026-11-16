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
  ORDER_DRAFT_STORAGE_KEY,
  resolveReservationLifecycleStatus,
} from './orderDraftStore';
import {
  isAirtimeNavItem,
  resolveCompactHeaderNavItems,
  resolveHeaderNavTargetRoute,
} from '../components/CompactHeaderNav';
import { COMPACT_NAV_ITEMS, getCompactNavItems } from './navigationData';
import { AIRTIME_SALES_ENABLED } from './platformFeatures';
import {
  ALL_PLATFORM_NAV_ITEMS,
  buildPlatformPath,
  getMainPlatformNavItems,
  MAIN_PLATFORM_NAV_ITEMS,
  parsePlatformRoute,
  resolveActiveTopNavSection,
  resolveRouteScrollAnchor,
  resolveRouteSeoMeta,
  resolveRouteTransitionKey,
} from './platformRouter';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';

test('AIRTIME_SALES_ENABLED = false: CompactHeaderNav и верхнее меню явно скрывают эфирные ссылки и консолидируют 5 студийных разделов с FAQ', () => {
  assert.equal(AIRTIME_SALES_ENABLED, false);
  assert.deepEqual(
    MAIN_PLATFORM_NAV_ITEMS.map((item) => item.label),
    ['Главная', 'Кейсы', 'Тарифы', 'О подходе', 'FAQ']
  );
  assert.deepEqual(
    MAIN_PLATFORM_NAV_ITEMS.map((item) => item.href),
    ['/', '/cases', '/pricing', '/approach', '/faq']
  );

  // Явная фильтрация на уровне CompactHeaderNav даже при передаче полного массива ссылок
  const headerItems = resolveCompactHeaderNavItems(ALL_PLATFORM_NAV_ITEMS, false);
  assert.equal(headerItems.some((item) => isAirtimeNavItem(item)), false);
  assert.deepEqual(
    headerItems.map((item) => item.key),
    ['home', 'cases', 'pricing', 'approach', 'faq']
  );
  assert.deepEqual(resolveHeaderNavTargetRoute('hot-air', false), { kind: 'home' });
  assert.deepEqual(resolveHeaderNavTargetRoute('hot-air', true), { kind: 'hot-air' });
  assert.deepEqual(resolveHeaderNavTargetRoute('faq', false), { kind: 'faq' });

  // Якорная навигация главной страницы также исключает #hot-air в студийном режиме
  assert.equal(
    COMPACT_NAV_ITEMS.some((item) => item.id === 'hot-air'),
    false
  );
  assert.equal(
    getCompactNavItems(true).some((item) => item.id === 'hot-air'),
    true
  );
});

test('parsePlatformRoute в студийном режиме перенаправляет эфирные URL на главную и разбирает студийные маршруты', () => {
  assert.deepEqual(parsePlatformRoute('/'), { kind: 'home' });
  assert.deepEqual(parsePlatformRoute('/hot-air'), { kind: 'home' });
  assert.deepEqual(parsePlatformRoute('/hot-air/stations/business-fm/'), {
    kind: 'home',
  });
  assert.deepEqual(parsePlatformRoute('/', '', '#hot-air'), { kind: 'home' });

  assert.deepEqual(parsePlatformRoute('/cases'), { kind: 'cases' });
  assert.deepEqual(parsePlatformRoute('/cases', '', '#industry-solutions-hub'), {
    kind: 'cases',
    scrollAnchor: 'industry-solutions-hub',
  });
  assert.deepEqual(parsePlatformRoute('/cases/dmitrogorsky'), {
    kind: 'case-detail',
    caseSlug: 'dmitrogorsky',
  });
  assert.deepEqual(parsePlatformRoute('/cases/industry/medicine'), {
    kind: 'industry-detail',
    industrySlug: 'medicine',
  });
  assert.deepEqual(parsePlatformRoute('/pricing', '', '#faq'), {
    kind: 'faq',
  });
  assert.deepEqual(parsePlatformRoute('/pricing', '', '#stages-24-48'), {
    kind: 'pricing',
    scrollAnchor: 'stages-24-48',
  });
  assert.deepEqual(parsePlatformRoute('/pricing', '', '#legal-clearance'), {
    kind: 'pricing',
    scrollAnchor: 'legal-clearance',
  });
  assert.deepEqual(parsePlatformRoute('/approach'), { kind: 'approach' });
  assert.deepEqual(parsePlatformRoute('/approach', '', '#radio-mistakes'), {
    kind: 'approach',
    scrollAnchor: 'radio-mistakes',
  });
  assert.equal(
    buildPlatformPath({ kind: 'approach', scrollAnchor: 'radio-mistakes' }),
    '/approach#radio-mistakes'
  );
  assert.equal(
    resolveRouteScrollAnchor({ kind: 'approach', scrollAnchor: 'radio-mistakes' }),
    'radio-mistakes'
  );
  assert.equal(
    resolveRouteScrollAnchor({ kind: 'pricing', scrollAnchor: 'stages-24-48' }),
    'stages-24-48'
  );
  assert.equal(resolveRouteScrollAnchor({ kind: 'faq' }), undefined);
  assert.deepEqual(parsePlatformRoute('/approach/phonebook-syndrome'), {
    kind: 'mistake-detail',
    articleSlug: 'phonebook-syndrome',
  });
  assert.deepEqual(parsePlatformRoute('/faq'), { kind: 'faq' });
  assert.deepEqual(parsePlatformRoute('/order'), { kind: 'order' });
  assert.deepEqual(parsePlatformRoute('/admin'), { kind: 'admin' });
});

test('parsePlatformRoute сохраняет обратную совместимость студийных хеш-ссылок и ?case=', () => {
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
    kind: 'faq',
  });
});

test('OrderDraftStore в студийном режиме очищает старую бронь эфира и никогда не блокирует повторный заказ ролика', () => {
  const memory = new Map<string, string>();
  const adapter = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
  };

  // Имитируем устаревший снимок с эфирной бронью в localStorage клиента
  memory.set(
    ORDER_DRAFT_STORAGE_KEY,
    JSON.stringify({
      mode: 'air_plus_production',
      selectedFormat: 'turnkey',
      spotDurationSec: 25,
      returnPath: '/hot-air/stations/business-fm',
      isViewingSubmittedReceipt: true,
      mediaReservation: {
        stations: [{ slotId: 'bfm-morning', station: 'Business FM' }],
      },
      confirmedReservation: {
        orderNumber: 'FM-HOLD-OLD',
        confirmedAtMs: 1_700_000_000_000,
        holdExpiresAtMs: 1_700_014_400_000,
        checkoutMode: 'air_plus_production',
        contactLine: 'Иван +7 900 111-22-33',
        companyLine: 'ООО Старый Эфир',
        formatLabel: 'Под ключ',
        spotDurationSec: 25,
      },
    })
  );

  const sanitizedStore = createOrderDraftStore(adapter);
  const initialSnap = sanitizedStore.getSnapshot();
  assert.equal(initialSnap.mode, 'production_only');
  assert.equal(initialSnap.mediaReservation, null);
  assert.equal(initialSnap.holdExpiresAtMs, null);
  assert.equal(initialSnap.confirmedReservation, null);
  assert.equal(initialSnap.isViewingSubmittedReceipt, false);
  assert.equal(initialSnap.returnPath, '/');
  assert.equal(resolveReservationLifecycleStatus(initialSnap), 'none');

  // Отправляем студийный заказ ролика — открывается экран квитанции
  sanitizedStore.confirmReservationOrder({
    orderNumber: 'FM-SPOT-101',
    confirmedAtMs: 1_700_000_500_000,
    holdExpiresAtMs: 1_700_014_900_000,
    checkoutMode: 'production_only',
    contactLine: 'Мария +7 999 555-44-33',
    companyLine: 'ООО Девелопмент',
    formatLabel: 'Ролик «Под ключ» — 25 000 ₽',
    spotDurationSec: 20,
    industryLabel: 'Недвижимость и ЖК',
    briefNote: 'Анонс новой очереди квартала',
    hasVoice: false,
    voiceSec: 0,
    fileName: null,
    conversionAllowed: true,
    innVerified: true,
    lockedMediaReservation: null,
    lockedTotals: null,
  });

  assert.equal(sanitizedStore.getSnapshot().isViewingSubmittedReceipt, true);
  assert.equal(
    sanitizedStore.getSnapshot().confirmedReservation?.orderNumber,
    'FM-SPOT-101'
  );
  // Даже после студийного заказа индикатор эфирной брони в шапке равен 'none'
  assert.equal(
    resolveReservationLifecycleStatus(sanitizedStore.getSnapshot()),
    'none'
  );

  // Клик по любой кнопке «Заказать ролик» открывает чистую незаблокированную форму, сохраняя доступ к квитанции
  const nextOrderSnap = sanitizedStore.prepareProductionOrder({
    formatId: 'cinema',
    returnPath: '/pricing',
  });
  assert.equal(nextOrderSnap.mode, 'production_only');
  assert.equal(nextOrderSnap.selectedFormat, 'cinema');
  assert.equal(nextOrderSnap.isFormatPreselected, true);
  assert.equal(nextOrderSnap.paymentChannel, 'edo_invoice');
  assert.equal(nextOrderSnap.isViewingSubmittedReceipt, false);
  assert.equal(nextOrderSnap.confirmedReservation?.orderNumber, 'FM-SPOT-101');

  // Прямой клик из шапки без конкретного тарифа открывает развёрнутый выбор тарифа
  const genericOrderSnap = sanitizedStore.prepareProductionOrder({
    formatId: null,
    returnPath: '/',
  });
  assert.equal(genericOrderSnap.isFormatPreselected, false);

  // Поддержка договорного тарифа и оплаты картой физлица (54-ФЗ)
  const consultSnap = sanitizedStore.prepareProductionOrder({
    formatId: 'custom_consult',
    returnPath: '/pricing',
  });
  assert.equal(consultSnap.selectedFormat, 'custom_consult');
  assert.equal(consultSnap.isFormatPreselected, true);
  const cardUpdated = sanitizedStore.updateDraft({ paymentChannel: 'card_online' });
  assert.equal(cardUpdated.paymentChannel, 'card_online');

  const cardFixedSteps = buildClientNextStepsTimeline('production_only', 0, {
    paymentChannel: 'card_online',
    isNegotiable: false,
  });
  assert.equal(cardFixedSteps.length, 3);
  assert.ok(cardFixedSteps[1].title.includes('ЮKassa'));
  assert.ok(cardFixedSteps[1].description.includes('54-ФЗ'));
  assert.ok(cardFixedSteps[2].description.includes('строго после договора и поступления предоплаты'));

  const consultSteps = buildClientNextStepsTimeline('production_only', 0, {
    paymentChannel: 'edo_invoice',
    isNegotiable: true,
  });
  assert.equal(consultSteps.length, 3);
  assert.ok(consultSteps[1].description.includes('договорную цену'));
  assert.ok(consultSteps[2].timingLabel.includes('100% предоплаты'));

  // Пользователь может по желанию открыть и свернуть прошлую квитанцию без потери данных
  assert.equal(sanitizedStore.openSubmittedReceipt().isViewingSubmittedReceipt, true);
  assert.equal(sanitizedStore.dismissSubmittedReceipt().isViewingSubmittedReceipt, false);
});

test('Консервированный модуль эфира ({ airtimeEnabled: true }) сохраняет маршрутизацию и жизненный цикл брони без регрессий', () => {
  assert.deepEqual(
    getMainPlatformNavItems(true).map((item) => item.label),
    ['Главная', 'Горящий эфир', 'Кейсы', 'Тарифы', 'О подходе', 'FAQ']
  );

  assert.deepEqual(parsePlatformRoute('/hot-air', '', '', { airtimeEnabled: true }), {
    kind: 'hot-air',
  });
  assert.deepEqual(
    parsePlatformRoute('/hot-air/stations/business-fm/', '', '', {
      airtimeEnabled: true,
    }),
    {
      kind: 'station-detail',
      stationSlug: 'business-fm',
    }
  );
  assert.deepEqual(parsePlatformRoute('/', '', '#hot-air', { airtimeEnabled: true }), {
    kind: 'hot-air',
  });

  const memory = new Map<string, string>();
  const adapter = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
  };

  const store = createOrderDraftStore(adapter, { airtimeEnabled: true });
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

  const rehydrated = createOrderDraftStore(adapter, { airtimeEnabled: true });
  const snap = rehydrated.getSnapshot();
  assert.equal(snap.mode, 'air_plus_production');
  assert.equal(snap.spotDurationSec, 21);
  assert.equal(snap.industryPreset, 'real-estate');
  assert.equal(
    resolveReservationLifecycleStatus(snap, { airtimeEnabled: true }),
    'draft_selected'
  );

  const remainingAfter10Min = computeRemainingHoldSeconds(
    snap.holdExpiresAtMs,
    baseNow + 600 * 1000
  );
  assert.equal(remainingAfter10Min, 4 * 3600 - 1 - 600);

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

  const confirmedRehydrated = createOrderDraftStore(adapter, { airtimeEnabled: true });
  assert.equal(
    resolveReservationLifecycleStatus(confirmedRehydrated.getSnapshot(), {
      airtimeEnabled: true,
    }),
    'confirmed_hold'
  );

  const steps = buildClientNextStepsTimeline('air_plus_production', 2);
  assert.equal(steps.length, 3);
  assert.ok(steps[0].description.includes('2 ст.'));
});

test('resolveActiveTopNavSection и resolveRouteSeoMeta формируют корректные заголовки в обоих режимах', () => {
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
  assert.equal(resolveActiveTopNavSection({ kind: 'faq' }), 'faq');
  assert.equal(buildPlatformPath({ kind: 'faq' }), '/faq');
  assert.equal(
    resolveActiveTopNavSection({ kind: 'home', scrollAnchor: 'home-faq' }),
    'faq'
  );
  assert.deepEqual(parsePlatformRoute('/', '', '#home-faq'), {
    kind: 'faq',
  });
  assert.equal(resolveActiveTopNavSection({ kind: 'order' }), null);

  const faqSeo = resolveRouteSeoMeta({ kind: 'faq' });
  assert.equal(faqSeo.canonicalPath, '/faq');
  assert.ok(faqSeo.title.includes('FAQ'));

  const homeSeo = resolveRouteSeoMeta({ kind: 'home' });
  assert.ok(homeSeo.title.includes('FMWorks'));
  assert.ok(homeSeo.title.includes('3–4 дня под ключ'));
  assert.equal(homeSeo.canonicalPath, '/');

  const studioOrderSeo = resolveRouteSeoMeta({ kind: 'order' });
  assert.ok(studioOrderSeo.title.includes('заказа аудиоролика'));
  assert.ok(!studioOrderSeo.title.toLowerCase().includes('брони эфира'));

  const airtimeOrderSeo = resolveRouteSeoMeta(
    { kind: 'order' },
    {},
    { airtimeEnabled: true }
  );
  assert.ok(airtimeOrderSeo.title.toLowerCase().includes('брони эфира'));

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

test('Каталог радиостанций, разборы кейсов и SEO-метаданные не содержат запрещённых слов', () => {
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
    homeSeo: resolveRouteSeoMeta({ kind: 'home' }),
    faqSeo: resolveRouteSeoMeta({ kind: 'faq' }),
    orderSeo: resolveRouteSeoMeta({ kind: 'order' }),
    adminSeo: resolveRouteSeoMeta({ kind: 'admin' }),
    pricingSeo: resolveRouteSeoMeta({ kind: 'pricing' }),
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

test('resolveRouteTransitionKey сохраняет ключ для якорных переходов и разделяет разные разделы и детали', () => {
  assert.equal(resolveRouteTransitionKey({ kind: 'home' }), 'home');
  assert.equal(
    resolveRouteTransitionKey({ kind: 'home', scrollAnchor: 'duel' }),
    'home'
  );
  assert.equal(
    resolveRouteTransitionKey({ kind: 'pricing', scrollAnchor: 'stages-24-48' }),
    resolveRouteTransitionKey({ kind: 'pricing' })
  );
  assert.notEqual(
    resolveRouteTransitionKey({ kind: 'cases' }),
    resolveRouteTransitionKey({ kind: 'case-detail', caseSlug: 'dmitrogorsky' })
  );
  assert.notEqual(
    resolveRouteTransitionKey({ kind: 'case-detail', caseSlug: 'dmitrogorsky' }),
    resolveRouteTransitionKey({ kind: 'industry-detail', industrySlug: 'medicine' })
  );
  assert.notEqual(
    resolveRouteTransitionKey({ kind: 'approach' }),
    resolveRouteTransitionKey({
      kind: 'mistake-detail',
      articleSlug: 'phonebook-syndrome',
    })
  );
  assert.equal(
    resolveRouteTransitionKey({ kind: 'privacy', tab: 'policy' }),
    resolveRouteTransitionKey({ kind: 'privacy', tab: 'consent' })
  );
  assert.equal(
    resolveRouteTransitionKey({ kind: 'cabinet', subroute: 'orders' }),
    resolveRouteTransitionKey({ kind: 'cabinet', subroute: 'history' })
  );
  assert.notEqual(
    resolveRouteTransitionKey({ kind: 'cabinet', subroute: 'orders' }),
    resolveRouteTransitionKey({ kind: 'cabinet', subroute: 'reset' })
  );
  assert.equal(
    resolveRouteTransitionKey({ kind: 'sound-drop', dropToken: 'tok-1' }),
    'sound-drop:tok-1'
  );
});
