import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFlexibleReservationPayload,
  buildMergedStationCatalog,
  computeExactPerSecondSlotPrices,
  computeFlexibleMediaPlanSummary,
  computeProductionCostForExactSeconds,
  expandVariationToChessboardCells,
  FLAGSHIP_STATION_CATALOG,
  getDefaultAudienceForNiche,
  MIN_FLEXIBLE_BUDGET_RUB,
  recommendOptimalMediaPlan,
} from './mediaPlannerCore';
import {
  computeReservationTotalsForSelection,
  DEFAULT_RADIO_INVENTORY_SLOTS,
  formatBookingSpecificationText,
  RadioInventorySlot,
} from './radioInventory';
import {
  calculateScriptChronometer,
  CHRONOMETER_SAMPLE_SCRIPTS,
  clampExactSpotSeconds,
  STANDARD_SPOT_DURATIONS,
} from './scriptChronometer';

const BANNED_EDITORIAL_TERMS = [
  'москв',
  'петерб',
  'питер',
  'мск',
  'спб',
  'moscow',
  'spb',
  'fm-тракт',
  'спектрограмма',
  'компрессор',
  'стемы',
  'дешевые биржи',
  'честная московская цена',
] as const;

test('Волна 1: каждая радиостанция предлагает от 3 независимых эфирных окон, и можно выбрать только Вечерний драйв без Утра', () => {
  assert.equal(FLAGSHIP_STATION_CATALOG.length, 10);
  for (const station of FLAGSHIP_STATION_CATALOG) {
    assert.ok(
      station.variations.length >= 3,
      `Станция ${station.station} должна иметь минимум 3 тайм-слота`
    );
  }

  // Пользователь выбирает на Business FM строго Вечерний драйв (12 выходов) и НЕ покупает Утренний прайм
  const summary = computeFlexibleMediaPlanSummary({
    niche: 'b2b_finance',
    audience: {
      segment: 'b2b_decision_makers',
      ageCore: '35_55',
      listeningContext: 'evening_leisure',
    },
    totalBudgetRub: 180_000,
    spotSeconds: 15,
    spotReadiness: 'need_production_24h',
    selectedVariations: [{ variationId: 'bfm-evening', spotsCount: 12 }],
  });

  assert.equal(summary.selectedQuotes.length, 1);
  assert.equal(summary.selectedQuotes[0].variation.id, 'bfm-evening');
  assert.equal(summary.selectedQuotes[0].variation.kind, 'evening_drive');
  assert.equal(summary.totalSpots, 12);
  assert.equal(
    summary.selectedQuotes.some((q) => q.variation.kind === 'morning_prime'),
    false
  );

  // Шахматка раскладывает выходы без потери и искажения суммы
  const cells = expandVariationToChessboardCells(summary.selectedQuotes[0].variation, 12);
  const sumSpots = cells.reduce((acc, c) => acc + c.spotsCount, 0);
  assert.equal(sumSpots, 12);
});

test('Волна 1: buildMergedStationCatalog синхронизирует скрытия и импорты из /admin хранилища', () => {
  const customImported: RadioInventorySlot = {
    ...DEFAULT_RADIO_INVENTORY_SLOTS[0],
    id: 'imported-evening-special',
    station: 'Business FM',
    daypart: 'Вечерний драйв 17:30–20:30',
    daysPattern: 'Пн–Пт',
    spotsIncluded: 10,
    officialPrice: 180_000,
    hotPrice: 110_000,
    sourceKind: 'imported',
    isHidden: false,
  };

  const merged = buildMergedStationCatalog([...DEFAULT_RADIO_INVENTORY_SLOTS, customImported]);
  const bfm = merged.find((s) => s.station === 'Business FM');
  assert.ok(bfm);
  assert.ok(bfm.variations.some((v) => v.id === 'imported-evening-special'));
});

test('Волна 2: честный посекундный расчёт для нестандартного хронометража (например, 17 и 22 сек) без округления вверх', () => {
  assert.deepEqual([...STANDARD_SPOT_DURATIONS], [5, 10, 15, 20, 30, 45, 60]);
  assert.equal(clampExactSpotSeconds(17), 17);
  assert.equal(clampExactSpotSeconds(2), 5);
  assert.equal(clampExactSpotSeconds(95), 60);

  const bfmEvening = FLAGSHIP_STATION_CATALOG[0].variations.find(
    (v) => v.id === 'bfm-evening'
  )!;

  const p15 = computeExactPerSecondSlotPrices({
    variation: bfmEvening,
    spotSeconds: 15,
    spotsCount: 10,
  });
  const p17 = computeExactPerSecondSlotPrices({
    variation: bfmEvening,
    spotSeconds: 17,
    spotsCount: 10,
  });
  const p20 = computeExactPerSecondSlotPrices({
    variation: bfmEvening,
    spotSeconds: 20,
    spotsCount: 10,
  });

  // Строго пропорциональная формула: 590 ₽/сек × 17 сек × 10 выходов = 100 300 ₽
  assert.equal(p17.hotPriceRub, bfmEvening.hotRatePerSec * 17 * 10);
  assert.ok(p15.hotPriceRub < p17.hotPriceRub && p17.hotPriceRub < p20.hotPriceRub);
});

test('Волна 2: Хронометр текста считает слова, слоги, телефонные цифры, темп диктора и юридические дисклеймеры ФЗ-38', () => {
  const emptyRes = calculateScriptChronometer({
    text: '   ',
    tempo: 'business_standard',
    disclaimer: 'none',
  });
  assert.equal(emptyRes.rawWordCount, 0);
  assert.equal(emptyRes.spokenSecondsExact, 0);

  const sampleText =
    'Вечерний показ видовых резиденций в парке! Запишитесь на экскурсию по телефону 220-45-90.';

  const standardNoDisc = calculateScriptChronometer({
    text: sampleText,
    tempo: 'business_standard',
    disclaimer: 'none',
  });
  const calmNoDisc = calculateScriptChronometer({
    text: sampleText,
    tempo: 'calm_image',
    disclaimer: 'none',
  });
  const dynamicNoDisc = calculateScriptChronometer({
    text: sampleText,
    tempo: 'dynamic_retail',
    disclaimer: 'none',
  });
  const withMedDisc = calculateScriptChronometer({
    text: sampleText,
    tempo: 'business_standard',
    disclaimer: 'medicine',
  });

  assert.ok(standardNoDisc.rawWordCount >= 10);
  assert.ok(standardNoDisc.digitGroupsCount >= 1);
  assert.ok(standardNoDisc.syllableCount > 25);
  assert.ok(calmNoDisc.spokenSecondsExact > standardNoDisc.spokenSecondsExact);
  assert.ok(standardNoDisc.spokenSecondsExact > dynamicNoDisc.spokenSecondsExact);
  assert.equal(withMedDisc.disclaimerSeconds, 3);
  assert.ok(withMedDisc.recommendedSeconds >= standardNoDisc.recommendedSeconds + 3);

  // Проверяем, что все 3 демонстрационных примера в Хронометре попадают ровно в свой ориентир (~17, ~13, ~22 сек)
  const expectedSampleSec: Record<string, number> = {
    'sample-b2b-17s': 17,
    'sample-coffee-13s': 13,
    'sample-clinic-22s': 22,
  };
  for (const sample of CHRONOMETER_SAMPLE_SCRIPTS) {
    const calc = calculateScriptChronometer({
      text: sample.text,
      tempo: sample.tempo,
      disclaimer: sample.disclaimer,
    });
    const target = expectedSampleSec[sample.id];
    assert.ok(
      Math.abs(calc.recommendedSeconds - target) <= 1,
      `Пример ${sample.id} дал ${calc.recommendedSeconds} сек вместо ~${target} сек`
    );
  }
});

test('Волна 3: минимальный бюджет от 40 000 ₽ собирает сфокусированный тестовый запуск на 1 радиостанции без перерасхода', () => {
  assert.equal(MIN_FLEXIBLE_BUDGET_RUB, 40_000);

  const testFlight = recommendOptimalMediaPlan({
    niche: 'medicine',
    audience: {
      segment: 'b2c_mass',
      ageCore: '35_55',
      listeningContext: 'office_daytime',
    },
    totalBudgetRub: 40_000,
    spotSeconds: 15,
    spotReadiness: 'need_production_24h',
  });

  assert.equal(testFlight.selectedStationsCount, 1);
  assert.ok(testFlight.totalSpots >= 5);
  assert.ok(
    testFlight.totalClientCostRub <= 40_000,
    `Итоговый чек ${testFlight.totalClientCostRub} ₽ не должен превышать тестовый бюджет 40 000 ₽`
  );

  // Даже при нестандартных 21 сек и бюджете 45 000 ₽ собирается рабочий тестовый мини-пакет (не 0 выходов!)
  const tight21sFlight = recommendOptimalMediaPlan({
    niche: 'b2b_finance',
    audience: getDefaultAudienceForNiche('b2b_finance'),
    totalBudgetRub: 45_000,
    spotSeconds: 21,
    spotReadiness: 'need_production_24h',
  });
  assert.ok(tight21sFlight.totalSpots >= 3);
  assert.ok(tight21sFlight.totalClientCostRub <= 45_000);

  // Короткий спот 10 сек стоит 12 000 ₽ в производстве и даёт ещё больше выходов на 40 000 ₽
  const shortSpotProd = computeProductionCostForExactSeconds({
    spotSeconds: 10,
    spotReadiness: 'need_production_24h',
    hotAirTotalRub: 25_000,
  });
  assert.equal(shortSpotProd.effectivePriceRub, 12_000);

  // При бюджете 450 000 ₽ автоматически открывается бонусный ролик за 0 ₽
  const bonusFlight = recommendOptimalMediaPlan({
    niche: 'real_estate',
    audience: getDefaultAudienceForNiche('real_estate'),
    totalBudgetRub: 450_000,
    spotSeconds: 20,
    spotReadiness: 'need_production_24h',
  });
  assert.equal(bonusFlight.production.isBonusUnlocked, true);
  assert.equal(bonusFlight.production.effectivePriceRub, 0);
  assert.ok(bonusFlight.totalClientCostRub <= 450_000);
});

test('Волна 4: смена портрета ЦА и AI-сигналов реально меняет приоритетные тайм-слоты, а бронь передаёт секунды и текст в QuickOrderDrawer', () => {
  const eveningPlan = recommendOptimalMediaPlan({
    niche: 'b2b_finance',
    audience: {
      segment: 'b2b_decision_makers',
      ageCore: '35_55',
      listeningContext: 'evening_leisure',
    },
    productNote: 'Лизинг коммерческого автопарка для юрлиц, вечерний деловой эфир',
    totalBudgetRub: 180_000,
    spotSeconds: 17,
    spotReadiness: 'need_production_24h',
    aiHint: {
      preferredDayparts: ['evening_drive'],
      avoidedDayparts: ['morning_prime'],
      boostedStationIds: ['bfm', 'kommersant'],
      slotReasonsByStationId: {
        bfm: 'Итоги рынков для собственников бизнеса по пути домой',
      },
      usedGeminiModel: true,
    },
  });

  assert.equal(eveningPlan.usedAiEngine, true);
  assert.ok(eveningPlan.selectedQuotes.length >= 1);
  // НИ ОДНОГО утреннего или дневного блока при выборе «Только вечерний прайм»!
  assert.ok(
    eveningPlan.selectedQuotes.every((q) => q.variation.kind === 'evening_drive'),
    'При выборе «Только вечерний прайм» должны выбираться исключительно вечерние слоты'
  );

  // Передача в QuickOrderDrawer сохраняет точные 17 сек, портрет ЦА и черновик текста
  const draftScript = 'Лизинг автопарка за один день без залога.';
  const payload = buildFlexibleReservationPayload({
    plan: eveningPlan,
    scriptDraftText: draftScript,
  });

  assert.equal(payload.spotDurationSec, 17);
  assert.equal(payload.scriptDraftText, draftScript);
  assert.ok(payload.targetAudienceSummary?.includes('B2B'));

  const totals = computeReservationTotalsForSelection(
    payload,
    payload.initialProductionSelection
  );
  assert.ok(totals.spotStatusLabel.includes('17 сек'));

  const specText = formatBookingSpecificationText({
    orderNumber: 'FM-HOLD-3017',
    payload,
    totals,
    contact: 'Алексей +7 999 000-11-22',
    companyRequisites: 'ООО Альфа Лизинг',
    briefText: payload.productNote,
    hasVoice: false,
    voiceSec: 0,
    requisitesFileName: null,
  });
  assert.ok(specText.includes('17 сек'));
  assert.ok(specText.includes('Целевая аудитория:'));
});

test('Редакционная чистота V3: ни одного запрещённого географического или студийного штампа в каталоге и примерах', () => {
  const fullDump = JSON.stringify({
    catalog: FLAGSHIP_STATION_CATALOG,
    samples: CHRONOMETER_SAMPLE_SCRIPTS,
  }).toLowerCase();

  for (const banned of BANNED_EDITORIAL_TERMS) {
    assert.equal(
      fullDump.includes(banned),
      false,
      `Обнаружен запрещённый термин "${banned}" в данных планировщика V3`
    );
  }
});
