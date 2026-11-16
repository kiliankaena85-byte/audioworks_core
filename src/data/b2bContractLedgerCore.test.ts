import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildB2bLedgerRowView,
  classifyOrderB2bBucket,
  computeB2bLedgerSummary,
  evaluateB2bSpotRegulatoryTimingAudit,
  matchesB2bLedgerBucket,
  resolveOrderTargetSlotSeconds,
} from './b2bContractLedgerCore';
import { createSeedCrmOrders } from './orderCrmTypes';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';
import { createDefaultStudioLegalProfiles } from './studioDocumentsCore';

test('classifyOrderB2bBucket maps 6 CRM stages onto 4 B2B accounting buckets', () => {
  assert.equal(classifyOrderB2bBucket('new_hold'), 'intake_queue');
  assert.equal(classifyOrderB2bBucket('quota_locked'), 'intake_queue');
  assert.equal(classifyOrderB2bBucket('edo_invoice'), 'awaiting_payment');
  assert.equal(classifyOrderB2bBucket('in_production'), 'paid_in_work');
  assert.equal(classifyOrderB2bBucket('on_air'), 'closed_acts');
  assert.equal(classifyOrderB2bBucket('completed_ltv'), 'closed_acts');
});

test('computeB2bLedgerSummary partitions seed orders cleanly with exact portfolio sum', () => {
  const orders = createSeedCrmOrders();
  const legal = createDefaultStudioLegalProfiles();
  const summary = computeB2bLedgerSummary(orders, legal);

  assert.equal(summary.totalOrdersCount, orders.length);
  assert.equal(
    summary.intakeQueueCount +
      summary.invoicedPendingCount +
      summary.paidInProductionCount +
      summary.closedActsCount,
    orders.length
  );
  assert.equal(
    summary.intakeQueueRub +
      summary.invoicedPendingRub +
      summary.paidInProductionRub +
      summary.closedActsRub,
    summary.totalPortfolioRub
  );
  assert.ok(summary.totalPortfolioRub > 0);

  for (const ord of orders) {
    const row = buildB2bLedgerRowView(ord, legal);
    assert.equal(matchesB2bLedgerBucket(ord, row.bucket), true);
    assert.ok(row.slotSeconds >= 5);
    assert.ok(row.invoiceNumber.length > 0);
  }
});

test('resolveOrderTargetSlotSeconds extracts seconds from documentMeta, mediaPlanSnapshot, or formatLabel', () => {
  const [sample] = createSeedCrmOrders();
  assert.ok(sample);
  const withDocMeta = {
    ...sample,
    documentMeta: { ...(sample.documentMeta ?? {}), spotExactDurationSec: 25 },
  };
  assert.equal(resolveOrderTargetSlotSeconds(withDocMeta), 25);

  const withFormatOnly = {
    ...sample,
    documentMeta: undefined,
    mediaPlanSnapshot: null,
    formatLabel: 'Игровой аудиоролик 30 сек под ключ',
  };
  assert.equal(resolveOrderTargetSlotSeconds(withFormatOnly), 30);
});

test('evaluateB2bSpotRegulatoryTimingAudit enforces Art. 24 FZ-38 3s medical disclaimer and detects slot overflow', () => {
  const medOverflow = evaluateB2bSpotRegulatoryTimingAudit({
    text: 'Многопрофильная медицинская клиника приглашает на комплексную диагностику организма и консультацию профильного врача со скидкой в этом месяце запишитесь на приём по телефону прямо сейчас без очередей и ожидания в удобное время',
    targetSlotSec: 15,
  });

  assert.equal(medOverflow.resolvedCategory, 'medicine_24fz');
  assert.equal(medOverflow.disclaimerRequiredSec, 3.0);
  assert.equal(medOverflow.verdictStatus, 'overflow');
  assert.ok(medOverflow.wordsDelta > 0);
  assert.ok(
    medOverflow.suggestedUpgradeSlotSec !== null &&
      medOverflow.suggestedUpgradeSlotSec >= 20
  );

  const fitSpot = evaluateB2bSpotRegulatoryTimingAudit({
    text: 'Квартиры с террасами в новом жилом квартале. Подробности на сайте.',
    targetSlotSec: 20,
  });
  assert.equal(fitSpot.resolvedCategory, 'real_estate_214fz');
  assert.equal(fitSpot.verdictStatus, 'optimal');
});

test('b2bContractLedgerCore generated labels comply with BANNED_EDITORIAL_TERMS guardrails', () => {
  const orders = createSeedCrmOrders();
  const legal = createDefaultStudioLegalProfiles();
  const rows = orders.map((o) => buildB2bLedgerRowView(o, legal));
  const audits = [
    evaluateB2bSpotRegulatoryTimingAudit({
      text: 'Лизинг коммерческого транспорта для юридических лиц со ставкой от восьми процентов.',
      targetSlotSec: 20,
    }),
    evaluateB2bSpotRegulatoryTimingAudit({
      text: 'Стоматологическая клиника улыбки.',
      targetSlotSec: 15,
    }),
  ];

  const serialized = JSON.stringify({ rows, audits }).toLowerCase();
  for (const banned of BANNED_EDITORIAL_TERMS) {
    assert.equal(
      serialized.includes(banned),
      false,
      `Found banned editorial term "${banned}" in B2B contract ledger output`
    );
  }
});
