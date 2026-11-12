import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildThreeReadyPackages,
  buildUnified12StationCatalog,
  CAMPAIGN_GOAL_OPTIONS,
  evaluateMediaScienceDiagnostic,
  HOT_AIR_AUDIENCE_PORTRAITS,
  QUICK_SLIDER_BUDGET_MARKS,
  RADIO_SCIENCE_PILLARS,
  resolvePortraitFromNiche,
  selectAudiencePortraitAndRecalculate,
} from './hotAirPackages';
import {
  buildFlexibleReservationPayload,
  computeFlexibleMediaPlanSummary,
} from './mediaPlannerCore';
import { STATION_EDITORIAL_SEEDS } from './multiPageContentData';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';

test('HOT_AIR_AUDIENCE_PORTRAITS содержит ровно 5 портретов ЦА для выбора в 1 клик', () => {
  assert.equal(HOT_AIR_AUDIENCE_PORTRAITS.length, 5);
  const portraitIds = HOT_AIR_AUDIENCE_PORTRAITS.map((p) => p.id);
  assert.deepEqual(portraitIds, [
    'b2b_execs',
    'premium_estate',
    'auto_commute',
    'urban_retail',
    'family_health',
  ]);
  for (const portrait of HOT_AIR_AUDIENCE_PORTRAITS) {
    assert.ok(portrait.portraitKeyLabel.length > 0);
    assert.ok(portrait.coreStationsLabel.length > 0);
    assert.ok(portrait.primaryAudienceTag.length > 0);
  }
  assert.equal(resolvePortraitFromNiche('medicine').id, 'family_health');
  assert.equal(resolvePortraitFromNiche('real_estate').id, 'premium_estate');
});

test('Клик по любому из 5 тактильных портретов ЦА обновляет фильтр и автоматически пересчитывает рекомендации пакетов', () => {
  const catalog = buildUnified12StationCatalog();
  const focusSignaturesByPortrait = new Set<string>();
  const balancedSignaturesByPortrait = new Set<string>();

  for (const portrait of HOT_AIR_AUDIENCE_PORTRAITS) {
    const resultAll = selectAudiencePortraitAndRecalculate({
      nextPortraitId: portrait.id,
      currentStationFilter: 'all',
      totalBudgetRub: 180_000,
      spotSeconds: 15,
      stationsCatalog: catalog,
    });
    assert.equal(resultAll.portraitId, portrait.id);
    assert.equal(resultAll.nextStationFilter, 'all');
    assert.equal(resultAll.manualSelections, null);
    assert.equal(resultAll.readyPackages.length, 3);

    const resultScoped = selectAudiencePortraitAndRecalculate({
      nextPortraitId: portrait.id,
      currentStationFilter: 'b2b',
      totalBudgetRub: 180_000,
      spotSeconds: 15,
      stationsCatalog: catalog,
    });
    assert.equal(resultScoped.nextStationFilter, portrait.primaryAudienceTag);

    const focusSig = resultAll.readyPackages[0].stationBreakdown
      .map((s) => `${s.stationId}:${s.spotsCount}`)
      .join('|');
    const balancedSig = resultAll.readyPackages[1].stationBreakdown
      .map((s) => `${s.stationId}:${s.spotsCount}`)
      .join('|');

    focusSignaturesByPortrait.add(focusSig);
    balancedSignaturesByPortrait.add(balancedSig);
  }

  // Разные портреты ЦА обязаны выдавать различающиеся станции/рекомендации пакетов
  assert.ok(focusSignaturesByPortrait.size >= 4);
  assert.ok(balancedSignaturesByPortrait.size >= 4);
});

test('buildUnified12StationCatalog объединяет все 12 радиостанций и связывает их с профилями станций', () => {
  const catalog = buildUnified12StationCatalog();
  assert.equal(catalog.length, 12);
  const editorialSlugs = new Set(STATION_EDITORIAL_SEEDS.map((s) => s.slug));

  const packages = buildThreeReadyPackages({
    portraitId: 'urban_retail',
    totalBudgetRub: 320_000,
    spotSeconds: 15,
    stationsCatalog: catalog,
  });

  for (const pkg of packages) {
    assert.ok(pkg.stationBreakdown.length >= 1);
    for (const st of pkg.stationBreakdown) {
      assert.ok(
        editorialSlugs.has(st.stationSlug),
        `Ожидался валидный slug профиля станции для ${st.stationName}, получен ${st.stationSlug}`
      );
    }
  }
});

test('buildThreeReadyPackages формирует 3 разных пакета со скидкой на бюджете 40 000 ₽ и 180 000 ₽', () => {
  for (const portrait of HOT_AIR_AUDIENCE_PORTRAITS) {
    const testPackages = buildThreeReadyPackages({
      portraitId: portrait.id,
      totalBudgetRub: 40_000,
      spotSeconds: 15,
      spotReadiness: 'need_production_24h',
    });

    assert.equal(testPackages.length, 3);
    assert.equal(testPackages[1].id, 'balanced');
    assert.equal(testPackages[1].isRecommended, true);

    for (const pkg of testPackages) {
      assert.ok(
        pkg.plan.selectedQuotes.length >= 1,
        `Пакет ${pkg.id} для ${portrait.id} на 40 000 ₽ не должен быть пустым`
      );
      assert.ok(
        pkg.plan.totalClientCostRub <= 40_000,
        `Пакет ${pkg.id} для ${portrait.id} превысил бюджет 40 000 ₽: ${pkg.plan.totalClientCostRub}`
      );
      assert.ok(pkg.plan.airDiscountPercent >= 30);
      assert.ok(pkg.plan.totalSavingsRub > 0);
    }

    const signatures40k = new Set(
      testPackages.map((p) =>
        p.selectedVariations.map((v) => `${v.variationId}:${v.spotsCount}`).join('|')
      )
    );
    assert.ok(
      signatures40k.size >= 2,
      `Ожидались различающиеся варианты пакетов на 40 000 ₽ для ${portrait.id}`
    );

    const midPackages = buildThreeReadyPackages({
      portraitId: portrait.id,
      totalBudgetRub: 180_000,
      spotSeconds: 15,
      spotReadiness: 'need_production_24h',
    });
    const [focusPkg, balancedPkg, reachPkg] = midPackages;
    assert.ok(focusPkg.plan.totalClientCostRub <= 180_000);
    assert.ok(balancedPkg.plan.totalClientCostRub <= 180_000);
    assert.ok(reachPkg.plan.totalClientCostRub <= 180_000);
    assert.ok(
      reachPkg.plan.totalSpots >= focusPkg.plan.totalSpots,
      `Ожидалось больше или столько же выходов в пакете охвата (${reachPkg.plan.totalSpots}) против фокуса (${focusPkg.plan.totalSpots}) для ${portrait.id}`
    );
  }
});

test('Научная диагностика 5+ касаний отлавливает недобор частоты и считает 3-месячную программу без повторной оплаты ролика', () => {
  const catalog = buildUnified12StationCatalog();
  const portrait = HOT_AIR_AUDIENCE_PORTRAITS[0];

  // 1) Слишком мало выходов (3 выхода на микро-бюджете) -> under_threshold (< 3 касаний)
  const weakPlan = computeFlexibleMediaPlanSummary({
    niche: portrait.niche,
    audience: portrait.audience,
    totalBudgetRub: 50_000,
    spotSeconds: 15,
    spotReadiness: 'need_production_24h',
    selectedVariations: [{ variationId: 'bfm-morning', spotsCount: 3 }],
    stationsCatalog: catalog,
  });
  const weakDiag = evaluateMediaScienceDiagnostic({
    plan: weakPlan,
    campaignGoal: 'brand_3months',
  });
  assert.equal(weakDiag.verdictLevel, 'under_threshold');
  assert.ok(weakDiag.avgContactsPerListener < 3.0);

  // 2) Плотная серия 18 выходов на 1 станции -> optimal_5plus (>= 5 касаний)
  const strongPlan = computeFlexibleMediaPlanSummary({
    niche: portrait.niche,
    audience: portrait.audience,
    totalBudgetRub: 200_000,
    spotSeconds: 15,
    spotReadiness: 'need_production_24h',
    selectedVariations: [{ variationId: 'bfm-morning', spotsCount: 18 }],
    stationsCatalog: catalog,
  });
  const strongDiag = evaluateMediaScienceDiagnostic({
    plan: strongPlan,
    campaignGoal: 'brand_3months',
  });
  assert.equal(strongDiag.verdictLevel, 'optimal_5plus');
  assert.ok(strongDiag.avgContactsPerListener >= 5.0);
  assert.ok(strongDiag.effectiveReach5PlusCount > 0);
  // Во 2-м и 3-м месяцах продакшн не оплачивается повторно
  assert.equal(
    strongDiag.threeMonthProgram.threeMonthsTotalRub,
    strongPlan.totalClientCostRub + strongPlan.hotAirTotalRub * 2
  );
  assert.equal(
    strongDiag.threeMonthProgram.productionSavedInMonths2And3Rub,
    strongPlan.production.effectivePriceRub * 2
  );
});

test('На бюджете 420 000 ₽ все 3 готовых пакета раскрывают бонус ролика за 0 ₽ и формируют бронь на 4 часа', () => {
  const packages420k = buildThreeReadyPackages({
    portraitId: 'b2b_execs',
    totalBudgetRub: 420_000,
    spotSeconds: 20,
    spotReadiness: 'need_production_24h',
  });

  for (const pkg of packages420k) {
    assert.equal(
      pkg.plan.production.isBonusUnlocked,
      true,
      `Пакет ${pkg.id} на 420 000 ₽ должен разблокировать ролик за 0 ₽`
    );
    assert.equal(pkg.plan.production.effectivePriceRub, 0);
    assert.ok(pkg.plan.totalClientCostRub <= 420_000);

    const payload = buildFlexibleReservationPayload({ plan: pkg.plan });
    assert.equal(payload.initialCountdownSeconds, 4 * 3600 - 1);
    assert.equal(payload.isBonusProductionUnlocked, true);
    assert.ok(payload.stations.length >= 1);
  }
});

test('Тексты портретов ЦА, научной памятки и готовых пакетов не содержат запрещённых редакционных терминов', () => {
  const allPackages = HOT_AIR_AUDIENCE_PORTRAITS.flatMap((p) =>
    buildThreeReadyPackages({
      portraitId: p.id,
      totalBudgetRub: 220_000,
      campaignGoal: 'brand_3months',
      spotSeconds: 15,
    })
  );

  const serialized = JSON.stringify({
    CAMPAIGN_GOAL_OPTIONS,
    RADIO_SCIENCE_PILLARS,
    HOT_AIR_AUDIENCE_PORTRAITS,
    QUICK_SLIDER_BUDGET_MARKS,
    summaries: allPackages.map((p) => ({
      title: p.title,
      subtitle: p.subtitle,
      whySummary: p.whySummary,
      science: p.science,
    })),
  }).toLowerCase();

  const violations = BANNED_EDITORIAL_TERMS.filter((term) => serialized.includes(term));
  assert.deepEqual(violations, []);
});
