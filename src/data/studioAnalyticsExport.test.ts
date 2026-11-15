import assert from 'node:assert/strict';
import test from 'node:test';
import { createSeedCrmOrders } from './orderCrmTypes';
import { buildStudioAnalyticsSummary } from './studioAnalyticsCore';
import {
  buildStudioAnalyticsExportFileName,
  describeAnalyticsQueryHuman,
  formatStudioAnalyticsCsv,
  wrapJpegPagesInA4Pdf,
} from './studioAnalyticsExport';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';

test('buildStudioAnalyticsExportFileName produces deterministic UTC+3 slugs for CSV and PDF', () => {
  const nowMs = Date.parse('2026-11-15T12:00:00.000Z');
  assert.equal(
    buildStudioAnalyticsExportFileName(
      { periodMonths: 6, segment: 'all', scope: 'crm_plus_archive' },
      'csv',
      nowMs
    ),
    'fmworks-analytics-6m-all-full-2026-11-15.csv'
  );
  assert.equal(
    buildStudioAnalyticsExportFileName(
      { periodMonths: 12, segment: 'production_only', scope: 'live_crm_only' },
      'pdf',
      nowMs
    ),
    'fmworks-analytics-12m-prod-live-2026-11-15.pdf'
  );
});

test('formatStudioAnalyticsCsv includes UTF-8 BOM, KPI summary, monthly conversion rows, stage dwell rows, and passes editorial guardrails', () => {
  const nowMs = Date.parse('2026-05-20T10:00:00.000Z');
  const seeds = createSeedCrmOrders(nowMs);
  const query = {
    periodMonths: 12 as const,
    segment: 'all' as const,
    scope: 'crm_plus_archive' as const,
  };
  const summary = buildStudioAnalyticsSummary(seeds, query, nowMs);
  const csv = formatStudioAnalyticsCsv(summary, query, nowMs);

  // Должен начинаться с UTF-8 BOM \uFEFF для корректного открытия кириллицы в табличных редакторах
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes('Отчёт студии FMWorks;Конверсия заказов и операционная эффективность'));
  assert.ok(csv.includes('Конверсия в сделку (%)'));
  assert.ok(csv.includes('Код месяца;Период (UTC+3);Поступило заявок'));
  assert.ok(csv.includes('Код этапа;Этап воронки;Среднее время (ч)'));
  assert.ok(csv.includes('#FM-HOLD-2854'));

  // Все 12 месяцев присутствуют в CSV
  for (const m of summary.months) {
    assert.ok(csv.includes(`${m.monthKey};${m.monthFullLabel};`));
  }

  // Соблюдение редакционных ограничений
  const lower = csv.toLowerCase();
  for (const banned of BANNED_EDITORIAL_TERMS) {
    assert.equal(
      lower.includes(banned),
      false,
      `Found banned editorial term "${banned}" in exported CSV`
    );
  }

  const human = describeAnalyticsQueryHuman(query, nowMs);
  assert.equal(human.periodLabel, '12 месяцев');
  assert.equal(human.segmentLabel, 'Все направления');
});

test('wrapJpegPagesInA4Pdf constructs a valid PDF 1.4 binary with exact xref byte offsets', () => {
  // Минимальный валидный SOI..EOI маркер JPEG
  const dummyJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdfBytes = wrapJpegPagesInA4Pdf([
    {
      jpegBytes: dummyJpeg,
      pixelWidth: 1488,
      pixelHeight: 2105,
    },
  ]);

  const text = new TextDecoder('latin1').decode(pdfBytes);
  assert.ok(text.startsWith('%PDF-1.4\n'));
  assert.ok(text.includes('/Type /Catalog /Pages 2 0 R'));
  assert.ok(text.includes('/Type /Page /Parent 2 0 R /MediaBox [ 0 0 595.28 841.89 ]'));
  assert.ok(text.includes('/Subtype /Image /Width 1488 /Height 2105'));
  assert.ok(text.includes('/Filter /DCTDecode /Length 4'));
  assert.ok(text.includes('xref\n0 6\n'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));

  // Проверяем, что смещение startxref указывает строго на слово "xref"
  const startXrefMatch = text.match(/startxref\n(\d+)\n%%EOF/);
  assert.ok(startXrefMatch);
  const xrefBytePos = Number.parseInt(startXrefMatch[1], 10);
  const sliceAtXref = new TextDecoder('ascii').decode(
    pdfBytes.slice(xrefBytePos, xrefBytePos + 4)
  );
  assert.equal(sliceAtXref, 'xref');
});
