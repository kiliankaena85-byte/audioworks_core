import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCost,
  calculateDynamicAirPrice,
  calculateSlotPriceForUniqueChronometry,
  createSecondBasedPricing,
  createSecondBasedPricingFromSlot,
  DEFAULT_RADIO_INVENTORY_SLOTS,
  evaluateInventoryForChronometry,
  extractSlotMultiplicityRules,
  normalizeFmworksMargin,
  perSecondAirPricingEngine,
  radioInventoryStore,
  SecondBasedPricing,
  secondBasedPricing,
  validateSlotMultiplicity,
} from './radioInventory';
import { computeExactPerSecondSlotPrices, FLAGSHIP_STATION_CATALOG } from './mediaPlannerCore';

test('normalizeFmworksMargin: корректно распознаёт проценты (20 -> 20%) и доли (0.2 -> 20%)', () => {
  const fromPercent = normalizeFmworksMargin(20);
  assert.equal(fromPercent.marginPercent, 20);
  assert.equal(fromPercent.marginRatio, 0.2);

  const fromFraction = normalizeFmworksMargin(0.25);
  assert.equal(fromFraction.marginPercent, 25);
  assert.equal(fromFraction.marginRatio, 0.25);

  const zero = normalizeFmworksMargin(0);
  assert.equal(zero.marginPercent, 0);
  assert.equal(zero.marginRatio, 0);

  const negative = normalizeFmworksMargin(-15);
  assert.equal(negative.marginPercent, 0);
  assert.equal(negative.marginRatio, 0);
});

test('validateSlotMultiplicity: проверка кратности слота для уникального хронометража 17с и 22с', () => {
  // 1. Линейный слот с шагом 1 сек: 17с и 22с проходят без переплаты за округление
  const linear17 = validateSlotMultiplicity(17, {
    slotId: 'bfm-morning',
    durationMultiplicitySec: 1,
    minDurationSec: 5,
    maxDurationSec: 60,
  });
  assert.equal(linear17.isCompatible, true);
  assert.equal(linear17.isDurationExactMultiple, true);
  assert.equal(linear17.billedSeconds, 17);
  assert.equal(linear17.unbilledPaddingSec, 0);
  assert.equal(linear17.status, 'exact_match');

  const linear22 = validateSlotMultiplicity(22, {
    slotId: 'montecarlo-drive',
    durationMultiplicitySec: 1,
    minDurationSec: 5,
    maxDurationSec: 60,
  });
  assert.equal(linear22.isCompatible, true);
  assert.equal(linear22.billedSeconds, 22);
  assert.equal(linear22.unbilledPaddingSec, 0);

  // 2. Спонсорский слот с кратностью 5 сек: 17с -> тарифицируется как 20с (+3с), 22с -> 25с (+3с)
  const sponsor17 = validateSlotMultiplicity(
    17,
    {
      slotId: 'dorozhnoe-day',
      durationMultiplicitySec: 5,
      minDurationSec: 5,
      maxDurationSec: 30,
    },
    { roundingPolicy: 'ceil_to_multiplicity' }
  );
  assert.equal(sponsor17.isCompatible, true);
  assert.equal(sponsor17.isDurationExactMultiple, false);
  assert.equal(sponsor17.multiplicityRemainderSec, 2);
  assert.equal(sponsor17.nearestValidLowerSec, 15);
  assert.equal(sponsor17.nearestValidUpperSec, 20);
  assert.equal(sponsor17.billedSeconds, 20);
  assert.equal(sponsor17.unbilledPaddingSec, 3);
  assert.equal(sponsor17.status, 'rounded_up_to_multiplicity');

  const sponsor22 = validateSlotMultiplicity(
    22,
    {
      slotId: 'jazz-flash-traffic',
      durationMultiplicitySec: 5,
      minDurationSec: 5,
      maxDurationSec: 30,
    },
    { roundingPolicy: 'ceil_to_multiplicity' }
  );
  assert.equal(sponsor22.isCompatible, true);
  assert.equal(sponsor22.billedSeconds, 25);
  assert.equal(sponsor22.unbilledPaddingSec, 3);

  // 3. Строгая политика кратности (strict_exact) отклоняет некратные 17с на 5-секундном слоте
  const strict17 = validateSlotMultiplicity(
    17,
    {
      slotId: 'dorozhnoe-day',
      durationMultiplicitySec: 5,
      minDurationSec: 5,
      maxDurationSec: 30,
    },
    { roundingPolicy: 'strict_exact' }
  );
  assert.equal(strict17.isCompatible, false);
  assert.equal(strict17.status, 'multiplicity_mismatch');

  // 4. Выход за пределы лимита слота (22с при maxDurationSec = 20с) и округление за границу (21с -> 25с > 22с)
  const exceedsDirect = validateSlotMultiplicity(22, {
    slotId: 'avtoradio-traffic',
    durationMultiplicitySec: 1,
    minDurationSec: 5,
    maxDurationSec: 20,
  });
  assert.equal(exceedsDirect.isCompatible, false);
  assert.equal(exceedsDirect.status, 'exceeds_max_duration');

  const exceedsAfterCeil = validateSlotMultiplicity(21, {
    slotId: 'tight-sponsor',
    durationMultiplicitySec: 5,
    minDurationSec: 5,
    maxDurationSec: 22,
  });
  assert.equal(exceedsAfterCeil.isCompatible, false);
  assert.equal(exceedsAfterCeil.status, 'exceeds_max_duration');

  // 5. Проверка кратности количества выходов (spotsMultiplicityStep = 5)
  const spotsCheck = validateSlotMultiplicity(
    15,
    {
      slotId: 'jazz-flash-traffic',
      durationMultiplicitySec: 5,
      spotsMultiplicityStep: 5,
      minSpots: 5,
      maxSpots: 45,
    },
    { requestedSpots: 12, roundingPolicy: 'ceil_to_multiplicity' }
  );
  assert.equal(spotsCheck.isSpotsExactMultiple, false);
  assert.equal(spotsCheck.adjustedSpots, 15);
});

test('calculateDynamicAirPrice: динамический метод (секунды, прайс_станции, маржа_FMWorks)', () => {
  // Прямой вызов (17 сек, 500 ₽/сек прайс станции, 20% маржа FMWorks)
  const q17 = calculateDynamicAirPrice(17, 500, 20);
  assert.equal(q17.requestedSeconds, 17);
  assert.equal(q17.billedSeconds, 17);
  assert.equal(q17.stationRatePerSecRub, 500);
  assert.equal(q17.clientRatePerSecRub, 600);
  assert.equal(q17.fmworksMarginPercent, 20);
  assert.equal(q17.stationBaseCostRub, 8_500);
  assert.equal(q17.fmworksMarginRub, 1_700);
  assert.equal(q17.totalClientPriceRub, 10_200);
  assert.equal(q17.stationBaseCostRub + q17.fmworksMarginRub, q17.totalClientPriceRub);

  // Вызов для 22 сек с маржой в доле (0.18 = 18%) и пакетом из 10 выходов
  const q22 = calculateDynamicAirPrice(22, 420, 0.18, { spotsCount: 10 });
  assert.equal(q22.billedSeconds, 22);
  assert.equal(q22.spotsCount, 10);
  assert.equal(q22.fmworksMarginPercent, 18);
  assert.equal(q22.stationBaseCostRub, 22 * 420 * 10); // 92 400 ₽
  assert.equal(q22.totalClientPriceRub, Math.round(92_400 * 1.18)); // 109 032 ₽
  assert.equal(q22.stationBaseCostRub + q22.fmworksMarginRub, q22.totalClientPriceRub);

  // Вызов от прайса эталонного 30-секундного спота станции (15 000 ₽ за 30с => 500 ₽/сек) с кратностью слота 5 сек
  const qFrom30s = calculateDynamicAirPrice(17, 15_000, 20, {
    stationPriceBasis: 'base_30s_spot',
    spotsCount: 10,
    multiplicityRules: {
      durationMultiplicitySec: 5,
      maxDurationSec: 30,
    },
  });
  assert.equal(qFrom30s.stationRatePerSecRub, 500);
  assert.equal(qFrom30s.billedSeconds, 20); // 17с -> 20с по кратности 5 сек
  assert.equal(qFrom30s.stationBaseCostRub, 100_000);
  assert.equal(qFrom30s.fmworksMarginRub, 20_000);
  assert.equal(qFrom30s.totalClientPriceRub, 120_000);

  // Проверка эквивалентности метода на экземпляре хранилища и движка
  const viaStore = radioInventoryStore.calculateDynamicAirPrice(17, 500, 20);
  const viaEngine = perSecondAirPricingEngine.calculateDynamicAirPrice(17, 500, 20);
  assert.equal(viaStore.totalClientPriceRub, q17.totalClientPriceRub);
  assert.equal(viaEngine.totalClientPriceRub, q17.totalClientPriceRub);
});

test('SecondBasedPricing и calculateCost(durationSeconds, stationPrice, margin): пересчёт эфирной квоты с кратностью и наценкой агентства', () => {
  // 1. Прямой вызов calculateCost(durationSeconds, stationPrice, margin) и через secondBasedPricing
  const direct17 = calculateCost(17, 500, 20);
  const viaSingleton = secondBasedPricing.calculateCost(17, 500, 20);
  const viaStore = radioInventoryStore.calculateCost(17, 500, 20);

  assert.equal(direct17.actualDurationSeconds, 17);
  assert.equal(direct17.effectiveDurationSeconds, 17);
  assert.equal(direct17.stationQuotaCostRub, 8_500);
  assert.equal(direct17.agencyMarkupRub, 1_700);
  assert.equal(direct17.agencyMarginPercent, 20);
  assert.equal(direct17.totalQuotaCostRub, 10_200);
  assert.equal(viaSingleton.totalQuotaCostRub, 10_200);
  assert.equal(viaStore.totalQuotaCostRub, 10_200);

  // 2. Пересчёт пакетной эфирной квоты (15 выходов × 20 сек = 90 000 ₽ нетто станции) на линейном слоте (шаг 1 сек)
  const linearQuotaPricing: SecondBasedPricing = createSecondBasedPricing({
    slotId: 'linear-quota-20s',
    baseQuotaDurationSeconds: 20,
    spotsIncluded: 15,
    stationPriceBasis: 'package_total',
    stationPriceRub: 90_000,
    multiplicityStepSeconds: 1,
    minDurationSeconds: 5,
    maxDurationSeconds: 60,
    agencyMargin: 20,
  });

  // Для ролика 17с (или дробного 16.3с -> 17с) квота дешевеет пропорционально 17/20 = 0.85
  const linear17Cost = linearQuotaPricing.calculateCost(16.3, 90_000, 20);
  assert.equal(linear17Cost.actualDurationSeconds, 17);
  assert.equal(linear17Cost.effectiveDurationSeconds, 17);
  assert.equal(linear17Cost.quotaDurationScaleFactor, 0.85);
  assert.equal(linear17Cost.stationQuotaCostRub, 76_500);
  assert.equal(linear17Cost.agencyMarkupRub, 15_300);
  assert.equal(linear17Cost.totalQuotaCostRub, 91_800);

  // 3. Пересчёт спонсорской эфирной квоты с кратностью 5 сек и наценкой в доле (0.25 = 25%)
  const sponsorQuotaPricing: SecondBasedPricing = createSecondBasedPricing({
    slotId: 'sponsor-quota-20s',
    baseQuotaDurationSeconds: 20,
    spotsIncluded: 15,
    stationPriceBasis: 'package_total',
    stationPriceRub: 90_000, // 300 ₽/сек
    multiplicityStepSeconds: 5,
    minDurationSeconds: 5,
    maxDurationSeconds: 30,
    agencyMargin: 0.25,
  });

  // 17с на 5-секундном слоте тарифицируется как 20с (scale = 1.0), 22с -> 25с (scale = 1.25)
  const sponsor17Cost = sponsorQuotaPricing.calculateCost(17, 90_000, 0.25);
  assert.equal(sponsor17Cost.actualDurationSeconds, 17);
  assert.equal(sponsor17Cost.effectiveDurationSeconds, 20);
  assert.equal(sponsor17Cost.quotaDurationScaleFactor, 1);
  assert.equal(sponsor17Cost.stationQuotaCostRub, 90_000);
  assert.equal(sponsor17Cost.agencyMarkupRub, 22_500);
  assert.equal(sponsor17Cost.totalQuotaCostRub, 112_500);

  const sponsor22Cost = sponsorQuotaPricing.calculateCost(22, 90_000, 0.25);
  assert.equal(sponsor22Cost.effectiveDurationSeconds, 25);
  assert.equal(sponsor22Cost.quotaDurationScaleFactor, 1.25);
  assert.equal(sponsor22Cost.stationQuotaCostRub, 112_500);
  assert.equal(sponsor22Cost.agencyMarkupRub, 28_125);
  assert.equal(sponsor22Cost.totalQuotaCostRub, 140_625);

  // 4. Все слоты DEFAULT_RADIO_INVENTORY_SLOTS и radioInventoryStore содержат готовую структуру SecondBasedPricing
  for (const slot of DEFAULT_RADIO_INVENTORY_SLOTS) {
    assert.ok(slot.secondBasedPricing, `Slot ${slot.id} missing secondBasedPricing`);
    const slotPricing = createSecondBasedPricingFromSlot(slot);
    const q15 = slot.secondBasedPricing!.calculateCost(15);
    assert.equal(q15.totalQuotaCostRub, slotPricing.calculateCost(15).totalQuotaCostRub);
    assert.equal(
      q15.stationQuotaCostRub + q15.agencyMarkupRub,
      q15.totalQuotaCostRub
    );
  }

  const storeDorQuote = radioInventoryStore.recalculateSlotQuotaCost('dorozhnoe-day', 17, 20);
  assert.ok(storeDorQuote);
  assert.equal(storeDorQuote.actualDurationSeconds, 17);
  assert.equal(storeDorQuote.effectiveDurationSeconds, 20);
  assert.equal(storeDorQuote.multiplicity.durationMultiplicitySec, 5);
});

test('calculateSlotPriceForUniqueChronometry и evaluateInventoryForChronometry на реальных слотах радиостанций', () => {
  const bfmSlot = DEFAULT_RADIO_INVENTORY_SLOTS.find((s) => s.id === 'bfm-morning')!;
  const dorSponsorSlot = DEFAULT_RADIO_INVENTORY_SLOTS.find((s) => s.id === 'dorozhnoe-day')!;
  const avtoShortSlot = DEFAULT_RADIO_INVENTORY_SLOTS.find((s) => s.id === 'avtoradio-traffic')!;

  assert.equal(extractSlotMultiplicityRules(bfmSlot).durationMultiplicitySec, 1);
  assert.equal(extractSlotMultiplicityRules(dorSponsorSlot).durationMultiplicitySec, 5);

  // Business FM (шаг 1 сек) для 17с и 22с
  const bfm17 = calculateSlotPriceForUniqueChronometry({
    slot: bfmSlot,
    spotSeconds: 17,
    spotsCount: 16,
    fmworksMargin: 20,
  });
  const bfm22 = calculateSlotPriceForUniqueChronometry({
    slot: bfmSlot,
    spotSeconds: 22,
    spotsCount: 16,
    fmworksMargin: 20,
  });
  assert.equal(bfm17.billedSeconds, 17);
  assert.equal(bfm22.billedSeconds, 22);
  assert.ok(bfm22.pricing.totalClientPriceRub > bfm17.pricing.totalClientPriceRub);

  // Дорожное Радио (Спонсорство погоды, шаг 5 сек): 17с тарифицируется по 20с
  const dor17 = calculateSlotPriceForUniqueChronometry({
    slot: dorSponsorSlot,
    spotSeconds: 17,
  });
  assert.equal(dor17.multiplicity.durationMultiplicitySec, 5);
  assert.equal(dor17.billedSeconds, 20);
  assert.equal(dor17.multiplicity.unbilledPaddingSec, 3);

  // Авторадио (лимит 20 сек): 17с совместим, 22с отсекается по лимиту
  const avto17 = calculateSlotPriceForUniqueChronometry({
    slot: avtoShortSlot,
    spotSeconds: 17,
  });
  const avto22 = calculateSlotPriceForUniqueChronometry({
    slot: avtoShortSlot,
    spotSeconds: 22,
  });
  assert.equal(avto17.multiplicity.isCompatible, true);
  assert.equal(avto22.multiplicity.isCompatible, false);
  assert.equal(avto22.multiplicity.status, 'exceeds_max_duration');

  // Массовая проверка всего инвентаря для 22 сек
  const all22 = evaluateInventoryForChronometry(22, {
    slots: DEFAULT_RADIO_INVENTORY_SLOTS,
    fmworksMargin: 20,
  });
  assert.equal(all22.length, DEFAULT_RADIO_INVENTORY_SLOTS.length);
  assert.ok(all22.some((q) => q.multiplicity.status === 'exact_match'));
  assert.ok(all22.some((q) => q.multiplicity.status === 'rounded_up_to_multiplicity'));
  assert.ok(all22.some((q) => q.multiplicity.status === 'exceeds_max_duration'));

  // Связка с mediaPlannerCore: спонсорский слот traffic_weather учитывает кратность 5 сек
  const bfmTrafficVar = FLAGSHIP_STATION_CATALOG[0].variations.find(
    (v) => v.id === 'bfm-traffic'
  )!;
  const coreSponsor17 = computeExactPerSecondSlotPrices({
    variation: bfmTrafficVar,
    spotSeconds: 17,
    spotsCount: 10,
  });
  assert.equal(coreSponsor17.billedSeconds, 20);
  assert.equal(coreSponsor17.hotPriceRub, bfmTrafficVar.hotRatePerSec * 20 * 10);
});

test('RadioInventorySlot.pricePerSecond и проверка минимального бюджета 40 000 ₽ для тестового запуска', async () => {
  const {
    buildOptimalMediaGrid,
    MIN_MEDIA_BUDGET_RUB,
    MIN_TEST_LAUNCH_BUDGET_RUB,
    resolveSlotHotPrice,
    resolveSlotOfficialPrice,
    resolveSlotPerSecondRates,
    validateMediaHoldReservation,
    validateMinTestLaunchBudget,
  } = await import('./radioInventory');

  // 1. Константа минимального бюджета тестового запуска = 40 000 ₽
  assert.equal(MIN_TEST_LAUNCH_BUDGET_RUB, 40_000);
  assert.equal(MIN_MEDIA_BUDGET_RUB, 40_000);

  // 2. Все слоты инвентаря содержат валидное поле pricePerSecond > 0
  for (const slot of DEFAULT_RADIO_INVENTORY_SLOTS) {
    assert.equal(typeof slot.pricePerSecond, 'number');
    assert.ok(slot.pricePerSecond > 0, `Slot ${slot.id} must have pricePerSecond > 0`);
  }

  // 3. Слот, созданный только с pricePerSecond (без фиксированных hotPrice / officialPrice)
  const purePerSecondSlot = {
    id: 'pure-per-sec-slot',
    station: 'Business FM',
    frequencyFm: '87.5 FM',
    formatDesc: 'Деловые новости (посекундный тариф)',
    audienceTags: ['b2b' as const, 'real_estate' as const],
    daypart: 'Утренний прайм 07:30–10:30' as const,
    daysPattern: 'Пн–Пт',
    weekdays: [1, 2, 3, 4, 5] as (1 | 2 | 3 | 4 | 5)[],
    sampleTimeSlots: ['08:15', '09:15', '10:15'],
    spotsIncluded: 10,
    maxDuration: 15 as const,
    pricePerSecond: 400, // 400 ₽/сек -> 10 выходов × 15 сек = 60 000 ₽
    reachOTS: 240_000,
    deadlineHours: 28,
    isHidden: false,
  };

  const resolvedHot = resolveSlotHotPrice(purePerSecondSlot, 15);
  const resolvedOfficial = resolveSlotOfficialPrice(purePerSecondSlot, 15);
  const rates = resolveSlotPerSecondRates(purePerSecondSlot);

  assert.equal(resolvedHot, 400 * 10 * 15); // 60 000 ₽
  assert.ok(resolvedOfficial > resolvedHot);
  assert.equal(rates.pricePerSecondRub, 400);
  assert.equal(rates.clientHotRatePerSecRub, 400);

  // 4. Проверка минимального бюджета 40 000 ₽ через validateMinTestLaunchBudget
  const belowMin = validateMinTestLaunchBudget(25_000);
  assert.equal(belowMin.valid, false);
  assert.equal(belowMin.minRequiredBudgetRub, 40_000);
  assert.equal(belowMin.clampedBudgetRub, 40_000);
  assert.equal(belowMin.deficitRub, 15_000);
  assert.ok(belowMin.error?.includes('40'));

  const exactMin = validateMinTestLaunchBudget(40_000);
  assert.equal(exactMin.valid, true);
  assert.equal(exactMin.clampedBudgetRub, 40_000);
  assert.equal(exactMin.deficitRub, 0);
  assert.equal(exactMin.error, undefined);

  // 5. buildOptimalMediaGrid: при бюджете 40 000 ₽ собирает тестовый запуск по pricePerSecond
  const testLaunchPlan40k = buildOptimalMediaGrid('b2b_finance', 40_000, '15');
  assert.equal(testLaunchPlan40k.totalBudget, 40_000);
  assert.equal(testLaunchPlan40k.minBudgetValidation?.valid, true);
  assert.ok(testLaunchPlan40k.selectedSlots.length >= 1);
  assert.ok(testLaunchPlan40k.hotAirTotal <= 40_000);
  assert.ok(testLaunchPlan40k.totalClientCost <= 40_000);

  const clampedFromLow = buildOptimalMediaGrid('b2b_finance', 20_000, '15');
  assert.equal(clampedFromLow.totalBudget, 40_000);
  assert.equal(clampedFromLow.minBudgetValidation?.valid, false);
  assert.equal(clampedFromLow.minBudgetValidation?.deficitRub, 20_000);

  // 6. validateMediaHoldReservation блокирует бронь с бюджетом < 40 000 ₽
  const holdBelow40k = validateMediaHoldReservation({
    contactLine: '+7 999 123-45-67',
    companyName: 'Тест Компания',
    selectedCount: 1,
    totalBudgetRub: 30_000,
  });
  assert.equal(holdBelow40k.valid, false);
  assert.ok(holdBelow40k.error?.includes('40'));

  const holdAt40k = validateMediaHoldReservation({
    contactLine: '+7 999 123-45-67',
    companyName: 'Тест Компания',
    selectedCount: 1,
    totalBudgetRub: 40_000,
  });
  assert.equal(holdAt40k.valid, true);
});
