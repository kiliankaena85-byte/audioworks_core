import assert from 'node:assert/strict';
import test from 'node:test';
import { createSeedCrmOrders } from './orderCrmTypes';
import {
  buildMonthSequenceUtcPlus3,
  buildStudioAnalyticsSummary,
  isOrderConvertedStage,
  isOrderDeliveredStage,
} from './studioAnalyticsCore';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';

test('buildMonthSequenceUtcPlus3 handles 6 and 12 months across year boundaries in UTC+3', () => {
  // 2026-03-15T12:00:00Z -> 2026-03-15 in UTC+3
  const anchorMs = Date.parse('2026-03-15T12:00:00.000Z');

  const seq6 = buildMonthSequenceUtcPlus3(6, anchorMs);
  assert.equal(seq6.length, 6);
  assert.equal(seq6[0]?.monthKey, '2025-10');
  assert.equal(seq6[0]?.monthLabel, 'Окт 25');
  assert.equal(seq6[5]?.monthKey, '2026-03');
  assert.equal(seq6[5]?.monthFullLabel, 'Март 2026');
  assert.equal(seq6[5]?.monthsAgo, 0);

  const seq12 = buildMonthSequenceUtcPlus3(12, anchorMs);
  assert.equal(seq12.length, 12);
  assert.equal(seq12[0]?.monthKey, '2025-04');
  assert.equal(seq12[11]?.monthKey, '2026-03');
});

test('isOrderConvertedStage and isOrderDeliveredStage classify funnel stages accurately', () => {
  assert.equal(isOrderConvertedStage('new_hold'), false);
  assert.equal(isOrderConvertedStage('quota_locked'), false);
  assert.equal(isOrderConvertedStage('edo_invoice'), true);
  assert.equal(isOrderConvertedStage('in_production'), true);
  assert.equal(isOrderConvertedStage('on_air'), true);
  assert.equal(isOrderConvertedStage('completed_ltv'), true);

  assert.equal(isOrderDeliveredStage('in_production'), false);
  assert.equal(isOrderDeliveredStage('on_air'), true);
  assert.equal(isOrderDeliveredStage('completed_ltv'), true);
});

test('buildStudioAnalyticsSummary computes live_crm_only metrics across 6-month and 12-month horizons', () => {
  const nowMs = Date.parse('2026-05-20T10:00:00.000Z');
  const seeds = createSeedCrmOrders(nowMs);
  assert.equal(seeds.length, 7);

  // FM-2309 создан 225 дней назад (-324_000 мин), поэтому в 6 месяцев попадают 6 сделок, а в 12 месяцев — все 7
  const summary6m = buildStudioAnalyticsSummary(
    seeds,
    {
      periodMonths: 6,
      segment: 'all',
      scope: 'live_crm_only',
    },
    nowMs
  );
  assert.equal(summary6m.months.length, 6);
  assert.equal(summary6m.totals.totalOrders, 6);

  const summary12m = buildStudioAnalyticsSummary(
    seeds,
    {
      periodMonths: 12,
      segment: 'all',
      scope: 'live_crm_only',
    },
    nowMs
  );
  assert.equal(summary12m.months.length, 12);
  assert.equal(summary12m.totals.totalOrders, 7);

  const expectedConverted = seeds.filter((o) =>
    isOrderConvertedStage(o.stage)
  ).length;
  const expectedRevenue = seeds
    .filter((o) => isOrderConvertedStage(o.stage))
    .reduce((acc, o) => acc + o.totalBudgetRub, 0);

  assert.equal(summary12m.totals.convertedOrders, expectedConverted);
  assert.equal(summary12m.totals.confirmedRevenueRub, expectedRevenue);
  assert.ok(summary12m.totals.overallConversionPct > 0);
  assert.ok(summary12m.totals.slaCompliancePct > 0);

  // Ровно один этап с максимальной длительностью помечен как узкое место
  const bottlenecks = summary12m.stageEfficiency.filter((s) => s.isBottleneck);
  assert.equal(bottlenecks.length, 1);
  assert.equal(summary12m.stageEfficiency.length, 5);
});

test('buildStudioAnalyticsSummary preserves segment partition sums in crm_plus_archive mode', () => {
  const nowMs = Date.parse('2026-05-20T10:00:00.000Z');
  const seeds = createSeedCrmOrders(nowMs);

  const allSummary = buildStudioAnalyticsSummary(
    seeds,
    { periodMonths: 12, segment: 'all', scope: 'crm_plus_archive' },
    nowMs
  );
  const prodSummary = buildStudioAnalyticsSummary(
    seeds,
    { periodMonths: 12, segment: 'production_only', scope: 'crm_plus_archive' },
    nowMs
  );
  const airSummary = buildStudioAnalyticsSummary(
    seeds,
    {
      periodMonths: 12,
      segment: 'air_plus_production',
      scope: 'crm_plus_archive',
    },
    nowMs
  );

  assert.equal(allSummary.months.length, 12);
  assert.equal(
    prodSummary.totals.totalOrders + airSummary.totals.totalOrders,
    allSummary.totals.totalOrders
  );
  assert.equal(
    prodSummary.totals.convertedOrders + airSummary.totals.convertedOrders,
    allSummary.totals.convertedOrders
  );
  assert.equal(
    prodSummary.totals.confirmedRevenueRub +
      airSummary.totals.confirmedRevenueRub,
    allSummary.totals.confirmedRevenueRub
  );
});

test('studioAnalyticsCore generated labels comply with BANNED_EDITORIAL_TERMS guardrails', () => {
  const nowMs = Date.parse('2026-05-20T10:00:00.000Z');
  const summary = buildStudioAnalyticsSummary(
    createSeedCrmOrders(nowMs),
    { periodMonths: 12, segment: 'all', scope: 'crm_plus_archive' },
    nowMs
  );
  const serialized = JSON.stringify(summary).toLowerCase();
  for (const banned of BANNED_EDITORIAL_TERMS) {
    assert.equal(
      serialized.includes(banned),
      false,
      `Found banned editorial term "${banned}" in studio analytics output`
    );
  }
});
