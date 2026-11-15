import assert from 'node:assert/strict';
import test from 'node:test';
import {
  anonymizeCrmOrderPdnRecord,
  buildWebhookOrderEnvelope,
  computeOrderHoldStatus,
  createSeedCrmOrders,
  CRM_ORDER_STAGES,
  exportCrmOrdersToCsv,
  formatEdoInvoiceSpecificationDocument,
  formatTelegramOrderDispatchMessage,
  getCrmStageMetaForOrder,
  STUDIO_PRODUCTION_CRM_STAGES,
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
  assert.equal(STUDIO_PRODUCTION_CRM_STAGES.length, 6);
  assert.equal(
    getCrmStageMetaForOrder('new_hold', 'production_only').shortLabel,
    'Проверка заявки и реквизитов'
  );
  assert.equal(
    getCrmStageMetaForOrder('new_hold', 'air_plus_production').shortLabel,
    'Новый резерв (4ч)'
  );
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
  assert.ok(edoDoc.includes('Заказчик (организация / ИП): ООО «Квартал Инвест»'));
  assert.ok(edoDoc.includes('ИНН Заказчика: 7707083893 (ИНН подтверждён по ключу ФНС)'));

  const tgText = formatTelegramOrderDispatchMessage(seedOrder, 'order.created');
  assert.ok(tgText.includes('НОВЫЙ ПРИОРИТЕТНЫЙ ХОЛД 4Ч'));
  assert.ok(tgText.includes('Business FM'));
  // По умолчанию ПДн клиента не передаются в открытом виде в зарубежный мессенджер (152-ФЗ ст. 12)
  assert.equal(tgText.includes(seedOrder.contact), false);
  assert.equal(tgText.includes('Квартал Инвест'), false);
  assert.ok(tgText.includes('152-ФЗ'));

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

test('Форматтеры ЭДО и Telegram корректно обрабатывают договорную цену (custom_consult) и оплату картой физлица (54-ФЗ)', () => {
  const [seedOrder] = createSeedCrmOrders(1_760_000_000_000);
  const consultCardOrder = {
    ...seedOrder,
    orderNumber: 'FM-2999',
    checkoutMode: 'production_only' as const,
    paymentChannel: 'card_online' as const,
    formatLabel: 'Индивидуальный проект · Консультация',
    totalBudgetRub: 0,
    companyOrInn: '',
    mediaPlanSnapshot: null,
  };

  const edoDoc = formatEdoInvoiceSpecificationDocument(consultCardOrder);
  assert.ok(edoDoc.includes('РАМОЧНЫЙ ДОГОВОР-ОФЕРТА, СПЕЦИФИКАЦИЯ И СЧЁТ-ОФЕРТА ДЛЯ ЭДО'));
  assert.ok(edoDoc.includes('Договорная цена'));
  assert.ok(edoDoc.includes('54-ФЗ'));
  assert.ok(edoDoc.includes('100% предоплаты'));
  assert.ok(edoDoc.includes('Проверка заявки и реквизитов'));
  assert.ok(!edoDoc.includes('Новый резерв (4ч)'));

  const tgText = formatTelegramOrderDispatchMessage(consultCardOrder, 'order.created');
  assert.ok(tgText.includes('Договорная цена (по оценке продюсера)'));
  assert.ok(tgText.includes('ЮKassa / Робокасса, 54-ФЗ'));
  assert.ok(tgText.includes('01. Проверка заявки и реквизитов'));

  const anonymized = anonymizeCrmOrderPdnRecord(seedOrder, '2026-11-14T10:00:00.000Z');
  assert.equal(anonymized.orderNumber, seedOrder.orderNumber);
  assert.equal(anonymized.totalBudgetRub, seedOrder.totalBudgetRub);
  assert.equal(anonymized.contact, '[ПДН УДАЛЕНЫ ПО 152-ФЗ]');
  assert.equal(anonymized.companyOrInn, '[РЕКВИЗИТЫ ОБЕЗЛИЧЕНЫ ПО 152-ФЗ]');
  assert.equal(anonymized.pdnAnonymizedAt, '2026-11-14T10:00:00.000Z');
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

test('Cloud Run prod startup: серверные модули orderCrmTypes.ts и leadShield.ts загружаются чистым Node ESM без tsx', async () => {
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { createSeedCrmOrders, CRM_ORDER_STAGES } from './src/data/orderCrmTypes.ts';
       import { SECURITY_DEFENSE_LAYERS } from './src/security/leadShield.ts';
       console.log(JSON.stringify({ stages: CRM_ORDER_STAGES.length, seeds: createSeedCrmOrders().length, layers: SECURITY_DEFENSE_LAYERS.length }));`,
    ],
    { encoding: 'utf8' }
  );
  const parsed = JSON.parse(out.trim()) as {
    stages: number;
    seeds: number;
    layers: number;
  };
  assert.equal(parsed.stages, 6);
  assert.equal(parsed.seeds, 7);
  assert.ok(parsed.layers >= 4);
});

