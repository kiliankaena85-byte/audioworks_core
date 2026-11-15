import assert from 'node:assert/strict';
import test from 'node:test';
import {
  anonymizeCrmOrderPdnRecord,
  createSeedCrmOrders,
  ensureOrderStageHistory,
  recordOrderStageTransition,
} from './orderCrmTypes';
import {
  collectStageHistoryFilterFacets,
  computeStageRouteStepState,
  DEFAULT_STAGE_HISTORY_QUERY_STATE,
  formatIsoToUtcPlus3Ymd,
  formatStageDwellDurationRu,
  formatStageHistoryActorLabel,
  formatStageHistoryTimestamp,
  hasActiveStageHistoryFilters,
  isStageHistoryQueryModified,
  type OrderStageHistoryEntry,
  queryOrderStageHistoryEntries,
  resolveStageTransitionDirection,
} from './orderStageHistory';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';

test('seed orders are deterministically hydrated with chronological stageHistory', () => {
  const baseMs = Date.parse('2026-11-15T12:00:00.000Z');
  const seeds = createSeedCrmOrders(baseMs);
  assert.ok(seeds.length >= 4);

  const newHoldOrder = seeds.find((o) => o.stage === 'new_hold');
  assert.ok(newHoldOrder, 'expected at least one new_hold seed order');
  assert.equal(newHoldOrder.stageHistory?.length, 1);
  assert.equal(newHoldOrder.stageHistory?.[0]?.previousStage, null);
  assert.equal(newHoldOrder.stageHistory?.[0]?.nextStage, 'new_hold');
  assert.equal(newHoldOrder.stageHistory?.[0]?.actor, 'system_created');

  const prodOrder = seeds.find((o) => o.orderNumber === 'FM-2948');
  assert.ok(prodOrder, 'expected FM-2948 seed order on in_production');
  const prodHistory = prodOrder.stageHistory ?? [];
  assert.equal(prodHistory.length, 4);
  assert.deepEqual(
    prodHistory.map((e) => e.nextStage),
    ['new_hold', 'quota_locked', 'edo_invoice', 'in_production']
  );
  assert.equal(prodHistory[0]?.timestamp, prodOrder.createdAt);
  assert.equal(prodHistory[3]?.timestamp, prodOrder.updatedAt);
  assert.ok(
    prodHistory[3]?.note?.includes('Предоплата поступила'),
    'final backfilled stage preserves producerNotes'
  );

  for (let i = 1; i < prodHistory.length; i += 1) {
    const prevMs = Date.parse(prodHistory[i - 1]!.timestamp);
    const curMs = Date.parse(prodHistory[i]!.timestamp);
    assert.ok(curMs >= prevMs, 'timestamps must be monotonic');
    assert.equal(prodHistory[i]!.durationFromPrevMs, curMs - prevMs);
  }

  const completedOrder = seeds.find((o) => o.stage === 'completed_ltv');
  assert.ok(completedOrder, 'expected completed_ltv seed order');
  assert.equal(completedOrder.stageHistory?.length, 6);
  assert.equal(completedOrder.stageHistory?.[5]?.nextStage, 'completed_ltv');
});

test('recordOrderStageTransition tracks forward, milestone, and rollback movements with accurate dwell time', () => {
  const t0 = '2026-11-15T08:00:00.000Z';
  const [seed] = createSeedCrmOrders(Date.parse(t0));
  assert.ok(seed);

  let order = ensureOrderStageHistory({
    ...seed,
    createdAt: t0,
    updatedAt: t0,
    stage: 'new_hold',
    stageHistory: undefined,
  });

  // 18 minutes on new_hold -> quota_locked
  const t1 = '2026-11-15T08:18:00.000Z';
  order = {
    ...order,
    stage: 'quota_locked',
    updatedAt: t1,
    stageHistory: recordOrderStageTransition(order, {
      timestamp: t1,
      previousStage: order.stage,
      nextStage: 'quota_locked',
      actor: 'producer_crm',
      workflowStepLabel: 'Квота подтверждена',
      note: 'Согласованы утренние выходы',
    }),
  };

  assert.equal(order.stageHistory?.length, 2);
  const move1 = order.stageHistory?.[1];
  assert.equal(move1?.previousStage, 'new_hold');
  assert.equal(move1?.nextStage, 'quota_locked');
  assert.equal(move1?.durationFromPrevMs, 18 * 60 * 1000);
  assert.equal(
    resolveStageTransitionDirection(move1!.previousStage, move1!.nextStage),
    'forward'
  );

  // Intra-stage milestone 12 minutes later (still quota_locked)
  const t2 = '2026-11-15T08:30:00.000Z';
  order = {
    ...order,
    updatedAt: t2,
    stageHistory: recordOrderStageTransition(order, {
      timestamp: t2,
      previousStage: 'quota_locked',
      nextStage: 'quota_locked',
      actor: 'sound_engineer',
      workflowStepLabel: 'Техлист принят в работу',
    }),
  };

  const milestone = order.stageHistory?.[2];
  assert.equal(
    resolveStageTransitionDirection(
      milestone!.previousStage,
      milestone!.nextStage
    ),
    'milestone'
  );
  assert.equal(milestone?.durationFromPrevMs, 12 * 60 * 1000);

  // Advance quota_locked -> edo_invoice at 09:00 (total dwell in quota_locked = 42 min since 08:18)
  const t3 = '2026-11-15T09:00:00.000Z';
  order = {
    ...order,
    stage: 'edo_invoice',
    updatedAt: t3,
    stageHistory: recordOrderStageTransition(order, {
      timestamp: t3,
      previousStage: 'quota_locked',
      nextStage: 'edo_invoice',
      actor: 'producer_crm',
    }),
  };

  const move2 = order.stageHistory?.[3];
  assert.equal(move2?.durationFromPrevMs, 42 * 60 * 1000);

  // Rollback edo_invoice -> quota_locked 15 minutes later
  const t4 = '2026-11-15T09:15:00.000Z';
  order = {
    ...order,
    stage: 'quota_locked',
    updatedAt: t4,
    stageHistory: recordOrderStageTransition(order, {
      timestamp: t4,
      previousStage: 'edo_invoice',
      nextStage: 'quota_locked',
      actor: 'producer_crm',
      note: 'Корректировка реквизитов плательщика',
    }),
  };

  const rollbackMove = order.stageHistory?.[4];
  assert.equal(
    resolveStageTransitionDirection(
      rollbackMove!.previousStage,
      rollbackMove!.nextStage
    ),
    'rollback'
  );
  assert.equal(rollbackMove?.durationFromPrevMs, 15 * 60 * 1000);
});

test('ensureOrderStageHistory reconciles out-of-sync stageHistory with current order.stage', () => {
  const [seed] = createSeedCrmOrders(Date.parse('2026-11-15T10:00:00.000Z'));
  assert.ok(seed);

  const desynced = ensureOrderStageHistory({
    ...seed,
    createdAt: '2026-11-15T09:00:00.000Z',
    updatedAt: '2026-11-15T10:30:00.000Z',
    stage: 'edo_invoice',
    stageHistory: [
      {
        id: 'h1',
        timestamp: '2026-11-15T09:00:00.000Z',
        previousStage: null,
        nextStage: 'new_hold',
        actor: 'system_created',
      },
    ],
  });

  assert.equal(desynced.stageHistory?.length, 2);
  assert.equal(desynced.stageHistory?.[1]?.previousStage, 'new_hold');
  assert.equal(desynced.stageHistory?.[1]?.nextStage, 'edo_invoice');
  assert.equal(desynced.stageHistory?.[1]?.durationFromPrevMs, 90 * 60 * 1000);
});

test('anonymizeCrmOrderPdnRecord scrubs notes and personal data from stageHistory while preserving audit trail', () => {
  const [seed] = createSeedCrmOrders(Date.parse('2026-11-15T12:00:00.000Z'));
  assert.ok(seed);

  const withSensitiveHistory = {
    ...seed,
    stage: 'quota_locked' as const,
    stageHistory: recordOrderStageTransition(
      { ...seed, stage: 'new_hold' },
      {
        timestamp: '2026-11-15T12:20:00.000Z',
        previousStage: 'new_hold',
        nextStage: 'quota_locked',
        actor: 'producer_crm',
        workflowStepLabel: 'Связь с клиентом +7 999 123-45-67 и почта boss@client.ru',
        note: 'Личный телефон директора +7 999 123-45-67',
      }
    ),
  };

  const anonymized = anonymizeCrmOrderPdnRecord(
    withSensitiveHistory,
    '2026-11-15T13:00:00.000Z'
  );
  assert.ok(anonymized.stageHistory && anonymized.stageHistory.length >= 2);
  const last = anonymized.stageHistory[anonymized.stageHistory.length - 1]!;
  assert.equal(last.note, null);
  assert.equal(last.nextStage, 'quota_locked');
  assert.ok(!last.workflowStepLabel?.includes('123-45-67'));
  assert.ok(!last.workflowStepLabel?.includes('boss@client.ru'));
});

test('route step state, dwell duration formatter, and editorial guardrails pass cleanly', () => {
  assert.equal(computeStageRouteStepState('in_production', 'new_hold'), 'completed');
  assert.equal(computeStageRouteStepState('in_production', 'in_production'), 'current');
  assert.equal(computeStageRouteStepState('in_production', 'on_air'), 'upcoming');

  assert.equal(formatStageDwellDurationRu(null), '');
  assert.equal(formatStageDwellDurationRu(3000), 'менее 5 сек');
  assert.equal(formatStageDwellDurationRu(42_000), '42 сек');
  assert.equal(formatStageDwellDurationRu(18 * 60_000), '18 мин');
  assert.equal(formatStageDwellDurationRu(135 * 60_000), '2 ч 15 мин');
  assert.equal(formatStageDwellDurationRu(52 * 3600_000), '2 дн. 4 ч');

  const seeds = createSeedCrmOrders(Date.parse('2026-11-15T12:00:00.000Z'));
  const combinedCopy = [
    ...seeds.flatMap((o) =>
      (o.stageHistory ?? []).flatMap((e) => [
        e.workflowStepLabel ?? '',
        formatStageHistoryActorLabel(e.actor),
        formatStageHistoryTimestamp(e.timestamp),
      ])
    ),
    formatStageHistoryActorLabel('client_cabinet'),
    formatStageHistoryActorLabel('sound_engineer'),
    formatStageHistoryActorLabel('system_sla'),
  ]
    .join(' ')
    .toLowerCase();

  for (const banned of BANNED_EDITORIAL_TERMS) {
    assert.equal(
      combinedCopy.includes(banned),
      false,
      `stage history output must not contain banned editorial term "${banned}"`
    );
  }
});

test('queryOrderStageHistoryEntries filters and sorts logs by date, responsible employee, and stage', () => {
  const sampleEntries: OrderStageHistoryEntry[] = [
    {
      id: 'e1',
      // 2026-11-01 10:00 UTC -> 2026-11-01 13:00 UTC+3
      timestamp: '2026-11-01T10:00:00.000Z',
      previousStage: null,
      nextStage: 'new_hold',
      actor: 'system_created',
      workflowStepLabel: 'Заявка зарегистрирована',
    },
    {
      id: 'e2',
      // 2026-11-10 22:30 UTC -> 2026-11-11 01:30 UTC+3 (crosses UTC midnight into Nov 11 UTC+3)
      timestamp: '2026-11-10T22:30:00.000Z',
      previousStage: 'new_hold',
      nextStage: 'in_production',
      actor: 'producer_crm',
      actorName: 'Анна Волкова',
      workflowStepLabel: 'Передан в производство',
    },
    {
      id: 'e3',
      // 2026-11-14 14:00 UTC -> 2026-11-14 17:00 UTC+3
      timestamp: '2026-11-14T14:00:00.000Z',
      previousStage: 'in_production',
      nextStage: 'in_production',
      actor: 'sound_engineer',
      actorName: 'Илья Громов',
      workflowStepLabel: 'Звукорежиссёр (Илья Громов) сдал дубль в ОТК',
    },
    {
      id: 'e4',
      // 2026-11-15 09:00 UTC -> 2026-11-15 12:00 UTC+3
      timestamp: '2026-11-15T09:00:00.000Z',
      previousStage: 'in_production',
      nextStage: 'on_air',
      actor: 'client_cabinet',
      workflowStepLabel: 'Клиент принял ролик',
    },
    {
      id: 'e5',
      // 2026-11-15 11:00 UTC -> 2026-11-15 14:00 UTC+3 (rollback)
      timestamp: '2026-11-15T11:00:00.000Z',
      previousStage: 'on_air',
      nextStage: 'quota_locked',
      actor: 'producer_crm',
      actorName: 'Анна Волкова',
      workflowStepLabel: 'Возврат на уточнение параметров',
    },
  ];

  assert.equal(formatIsoToUtcPlus3Ymd('2026-11-10T22:30:00.000Z'), '2026-11-11');

  const facets = collectStageHistoryFilterFacets(sampleEntries);
  assert.equal(facets.milestoneCount, 1);
  assert.equal(facets.stageChangeCount, 4);
  assert.equal(facets.stageCounts.in_production, 2);
  assert.equal(facets.latestDateYmd, '2026-11-15');
  assert.ok(
    facets.actors.some(
      (a) =>
        a.key === 'sound_engineer:Илья Громов' &&
        a.label === 'Звукорежиссёр · Илья Громов' &&
        a.count === 1
    )
  );
  assert.ok(
    facets.actors.some(
      (a) =>
        a.key === 'producer_crm:Анна Волкова' &&
        a.label === 'Продюсер · Анна Волкова' &&
        a.count === 2
    )
  );

  const nowMs = Date.parse('2026-11-15T12:00:00.000Z');
  assert.equal(hasActiveStageHistoryFilters(DEFAULT_STAGE_HISTORY_QUERY_STATE), false);
  assert.equal(isStageHistoryQueryModified(DEFAULT_STAGE_HISTORY_QUERY_STATE), false);

  // 1. Default sort: date_desc (newest first)
  const desc = queryOrderStageHistoryEntries(
    sampleEntries,
    DEFAULT_STAGE_HISTORY_QUERY_STATE,
    { nowMs }
  );
  assert.deepEqual(
    desc.map((i) => i.entry.id),
    ['e5', 'e4', 'e3', 'e2', 'e1']
  );

  // 2. Sort by date_asc (oldest first)
  const asc = queryOrderStageHistoryEntries(
    sampleEntries,
    { ...DEFAULT_STAGE_HISTORY_QUERY_STATE, sortBy: 'date_asc' },
    { nowMs }
  );
  assert.deepEqual(
    asc.map((i) => i.entry.id),
    ['e1', 'e2', 'e3', 'e4', 'e5']
  );
  assert.equal(
    isStageHistoryQueryModified({
      ...DEFAULT_STAGE_HISTORY_QUERY_STATE,
      sortBy: 'date_asc',
    }),
    true
  );

  // 3. Sort by stage_asc (01 new_hold -> 02 quota_locked -> 04 in_production -> 05 on_air)
  const stageAsc = queryOrderStageHistoryEntries(
    sampleEntries,
    { ...DEFAULT_STAGE_HISTORY_QUERY_STATE, sortBy: 'stage_asc' },
    { nowMs }
  );
  assert.deepEqual(
    stageAsc.map((i) => i.entry.id),
    ['e1', 'e5', 'e2', 'e3', 'e4']
  );

  // 4. Sort by actor_asc (Russian alphabetical: Звукорежиссёр -> Клиент -> Продюсер -> Система)
  const actorAsc = queryOrderStageHistoryEntries(
    sampleEntries,
    { ...DEFAULT_STAGE_HISTORY_QUERY_STATE, sortBy: 'actor_asc' },
    { nowMs }
  );
  assert.deepEqual(
    actorAsc.map((i) => i.entry.id),
    ['e3', 'e4', 'e5', 'e2', 'e1']
  );

  // 5. Filter by specific responsible employee
  const onlyEngineer = queryOrderStageHistoryEntries(
    sampleEntries,
    {
      ...DEFAULT_STAGE_HISTORY_QUERY_STATE,
      actorKey: 'sound_engineer:Илья Громов',
    },
    { nowMs }
  );
  assert.deepEqual(
    onlyEngineer.map((i) => i.entry.id),
    ['e3']
  );

  // 6. Filter by specific stage
  const onlyProdStage = queryOrderStageHistoryEntries(
    sampleEntries,
    {
      ...DEFAULT_STAGE_HISTORY_QUERY_STATE,
      stageFilter: 'in_production',
    },
    { nowMs }
  );
  assert.deepEqual(
    onlyProdStage.map((i) => i.entry.id),
    ['e3', 'e2']
  );

  // 7. Filter by UTC+3 calendar date (Nov 11 UTC+3 matches 2026-11-10T22:30Z)
  const customDateHit = queryOrderStageHistoryEntries(
    sampleEntries,
    {
      ...DEFAULT_STAGE_HISTORY_QUERY_STATE,
      datePreset: 'custom_date',
      exactDateYmd: '2026-11-11',
    },
    { nowMs }
  );
  assert.deepEqual(
    customDateHit.map((i) => i.entry.id),
    ['e2']
  );

  // 8. Filter by last_24h from 2026-11-15T12:00Z (hits e3 at Nov 14 14:00Z, e4, e5)
  const last24h = queryOrderStageHistoryEntries(
    sampleEntries,
    {
      ...DEFAULT_STAGE_HISTORY_QUERY_STATE,
      datePreset: 'last_24h',
    },
    { nowMs }
  );
  assert.deepEqual(
    last24h.map((i) => i.entry.id),
    ['e5', 'e4', 'e3']
  );
});
