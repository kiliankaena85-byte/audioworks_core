import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWebhookOrderEnvelope,
  computeOrderHoldStatus,
  createSeedCrmOrders,
  CRM_ORDER_STAGES,
  exportCrmOrdersToCsv,
  formatEdoInvoiceSpecificationDocument,
  formatTelegramOrderDispatchMessage,
} from './orderCrmTypes';
import {
  buildAttributionAndSearchLiftProtocol,
  calculateMultiWaveLtvEconomics,
  evaluateCognitiveFrequencyAndMemoryCurve,
  evaluatePsychoacousticSpotAudit,
  extractScientificPresetFromOrder,
  SCIENTIFIC_GROWTH_ROADMAP,
} from './scientificGrowthPlan';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';

test('CRM_ORDER_STAGES содержит все 6 операционных этапов воронки со строгой последовательностью переходов', () => {
  assert.equal(CRM_ORDER_STAGES.length, 6);
  assert.equal(CRM_ORDER_STAGES[0].id, 'new_hold');
  assert.equal(CRM_ORDER_STAGES[0].nextStage, 'quota_locked');
  assert.equal(CRM_ORDER_STAGES[5].id, 'completed_ltv');
  assert.equal(CRM_ORDER_STAGES[5].nextStage, null);
});

test('computeOrderHoldStatus корректно различает активный 4ч холд, истекающий (<45м), истёкший и закреплённую квоту', () => {
  const now = 1_760_000_000_000;
  const normal = computeOrderHoldStatus(
    {
      stage: 'new_hold',
      holdExpiresAt: new Date(now + 2 * 3600_000).toISOString(),
    },
    now
  );
  assert.equal(normal.urgency, 'active_normal');
  assert.equal(normal.formattedCountdown, '02:00:00');

  const urgent = computeOrderHoldStatus(
    {
      stage: 'new_hold',
      holdExpiresAt: new Date(now + 25 * 60_000).toISOString(),
    },
    now
  );
  assert.equal(urgent.urgency, 'expiring_soon');

  const locked = computeOrderHoldStatus(
    {
      stage: 'quota_locked',
      holdExpiresAt: new Date(now - 3600_000).toISOString(),
    },
    now
  );
  assert.equal(locked.urgency, 'locked_safe');
});

test('Форматтеры счёта ЭДО, Telegram-уведомления, Webhook-конверта и CSV включают полные данные медиаплана и ИНН', () => {
  const [seedOrder] = createSeedCrmOrders(1_760_000_000_000);
  assert.ok(seedOrder.mediaPlanSnapshot);

  const edoDoc = formatEdoInvoiceSpecificationDocument(seedOrder);
  assert.ok(edoDoc.includes('СПЕЦИФИКАЦИЯ И СЧЁТ-ОФЕРТА ДЛЯ ЭДО'));
  assert.ok(edoDoc.includes(seedOrder.orderNumber));
  assert.ok(edoDoc.includes('Business FM'));
  assert.ok(edoDoc.includes('Серебряный Дождь'));
  assert.ok(edoDoc.includes('7707083893'));

  const tgText = formatTelegramOrderDispatchMessage(seedOrder, 'order.created');
  assert.ok(tgText.includes('НОВЫЙ ПРИОРИТЕТНЫЙ ХОЛД 4Ч'));
  assert.ok(tgText.includes('Business FM'));

  const webhookEnv = buildWebhookOrderEnvelope(
    seedOrder,
    'order.created',
    '2026-11-13T12:00:00.000Z'
  );
  assert.equal(webhookEnv.event, 'order.created');
  assert.equal(webhookEnv.order.orderNumber, seedOrder.orderNumber);
  assert.equal(webhookEnv.order.mediaPlan?.stations.length, 2);

  const csv = exportCrmOrdersToCsv([seedOrder]);
  assert.ok(csv.includes('Номер заказа;Дата создания;Этап воронки'));
  assert.ok(csv.includes(seedOrder.orderNumber));
});

test('Научный контур I: аудит 5+ касаний и 12-недельная кривая памяти доказывают кратное преимущество пульсирующих волн', () => {
  const underThreshold = evaluateCognitiveFrequencyAndMemoryCurve({
    totalSpots: 10,
    stationsCount: 3,
  });
  assert.equal(underThreshold.meetsFiveTouchThreshold, false);
  assert.ok(underThreshold.deficitContacts > 0);

  const healthy = evaluateCognitiveFrequencyAndMemoryCurve({
    totalSpots: 32,
    stationsCount: 2,
  });
  assert.equal(healthy.meetsFiveTouchThreshold, true);
  assert.equal(healthy.weeklyCurve.length, 12);
  assert.ok(
    healthy.week90PulsingFinalPct > healthy.week90SingleBurstFinalPct * 2,
    'К 12-й неделе пульсирующая программа удерживает знание кратно выше разового слива'
  );
});

test('Научные контуры II, III и IV: расчёт Search Lift, психоакустики первых 3 сек и экономики LTV 3 волн', () => {
  const attribution = buildAttributionAndSearchLiftProtocol({
    industryId: 'real_estate',
    totalReachOTS: 420_000,
    effectiveFrequency: 5.4,
    baselineWeeklySearches: 400,
  });
  assert.ok(attribution.projectedPrimeWindowSearches > attribution.baselineWeeklySearches);
  assert.ok(attribution.projectedSearchLiftPercent > 0);
  assert.ok(attribution.phoneticPromoCode.length > 0);

  const cleanScriptAudit = evaluatePsychoacousticSpotAudit({
    spotSeconds: 15,
    scriptText:
      'Видовые квартиры с террасами в Квартал Парк. Ставка по траншу от четырёх процентов. Наберите Квартал Парк в поиске уже сегодня.',
  });
  assert.equal(cleanScriptAudit.densityStatus, 'optimal');
  assert.equal(cleanScriptAudit.firstThreeSecHookScore, 'strong_hook');

  const overloadedClicheAudit = evaluatePsychoacousticSpotAudit({
    spotSeconds: 10,
    scriptText:
      'Наша компания динамично развивающаяся и мы рады предложить индивидуальный подход широкий ассортимент скидки акции доставка звоните прямо сейчас всем покупателям подарки и бонусы каждый день без выходных',
  });
  assert.equal(overloadedClicheAudit.densityStatus, 'overloaded');
  assert.equal(overloadedClicheAudit.firstThreeSecHookScore, 'generic_opening');

  const ltv = calculateMultiWaveLtvEconomics({
    waveBudgetRub: 180_000,
    wave1ProductionRub: 15_000,
    spotSeconds: 15,
    baseWave1Spots: 23,
    baseWave1ReachOTS: 400_000,
  });
  assert.equal(ltv.waves.length, 3);
  assert.equal(ltv.waves[0].productionCostRub, 15_000);
  assert.equal(ltv.waves[1].productionCostRub, 0);
  assert.equal(ltv.waves[2].productionCostRub, 0);
  assert.ok(ltv.waves[1].estimatedSpots > ltv.waves[0].estimatedSpots);
  assert.ok(ltv.blended3WaveCptRub < ltv.wave1CptRub);
});

test('Тексты CRM-сделок, счёта ЭДО и Научного плана развития не содержат запрещённых редакционных штампов и гео-привязок', () => {
  const seeds = createSeedCrmOrders();
  const combined = JSON.stringify({
    seeds,
    edoDocs: seeds.map((s) => formatEdoInvoiceSpecificationDocument(s)),
    tgMessages: seeds.map((s) => formatTelegramOrderDispatchMessage(s)),
    roadmap: SCIENTIFIC_GROWTH_ROADMAP,
    preset: extractScientificPresetFromOrder(seeds[0]),
  }).toLowerCase();

  for (const banned of BANNED_EDITORIAL_TERMS) {
    assert.equal(
      combined.includes(banned),
      false,
      `Обнаружен запрещённый редакционный термин: ${banned}`
    );
  }
});
