import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_WEB_VITALS_ENDPOINT,
  evaluateFidRating,
  formatWebVitalsReportLine,
  normalizeWebVitalMetric,
  roundWebVitalValue,
  validateWebVitalsBeaconPayload,
  WebVitals,
} from './performance.ts';

test('evaluateFidRating и roundWebVitalValue применяют официальные пороги Web Vitals', () => {
  assert.equal(evaluateFidRating(18), 'good');
  assert.equal(evaluateFidRating(100), 'good');
  assert.equal(evaluateFidRating(185), 'needs-improvement');
  assert.equal(evaluateFidRating(340), 'poor');

  assert.equal(roundWebVitalValue('CLS', 0.045678), 0.0457);
  assert.equal(roundWebVitalValue('LCP', 1245.67), 1245.7);
  assert.equal(roundWebVitalValue('FID', -5), 0);
});

test('normalizeWebVitalMetric, formatWebVitalsReportLine и validateWebVitalsBeaconPayload очищают маршруты и валидируют отчёты CLS/LCP/FID', () => {
  const clsReport = normalizeWebVitalMetric(
    {
      name: 'CLS',
      id: 'v5-cls-1',
      value: 0.01234,
      delta: 0.01234,
      rating: 'good',
      navigationType: 'navigate',
    },
    '/cases?utm_source=yandex#top'
  );
  assert.equal(clsReport.route, '/cases');
  assert.equal(clsReport.value, 0.0123);
  assert.equal(
    formatWebVitalsReportLine(clsReport),
    '[FMWorks Perf] WebVitals CLS: 0.0123 [good] on /cases'
  );

  const lcpValidated = validateWebVitalsBeaconPayload({
    name: 'LCP',
    id: 'v5-lcp-1',
    value: 920.44,
    delta: 920.44,
    rating: 'good',
    route: '/pricing?ref=partner',
    navigationType: 'navigate',
  });
  assert.ok(lcpValidated);
  assert.equal(lcpValidated.route, '/pricing');
  assert.equal(lcpValidated.value, 920.4);

  const fidValidated = validateWebVitalsBeaconPayload({
    name: 'FID',
    id: 'fid-412',
    value: 14.2,
    delta: 14.2,
    rating: 'good',
    route: '/',
  });
  assert.ok(fidValidated);
  assert.equal(fidValidated.name, 'FID');

  assert.equal(validateWebVitalsBeaconPayload({ name: 'HACK', value: 10 }), null);
  assert.equal(
    validateWebVitalsBeaconPayload({
      name: 'LCP',
      value: -10,
      rating: 'good',
    }),
    null
  );
  assert.equal(
    validateWebVitalsBeaconPayload({
      name: 'LCP',
      value: 100,
      rating: 'invalid-rating',
    }),
    null
  );
});

test('WebVitals.report сохраняет собранные метрики и уведомляет обработчик без сети', () => {
  WebVitals.resetForTests();
  const captured: string[] = [];

  const lcpPayload = normalizeWebVitalMetric(
    {
      name: 'LCP',
      id: 'v5-lcp-test',
      value: 740.2,
      delta: 740.2,
      rating: 'good',
      navigationType: 'navigate',
    },
    '/approach'
  );

  WebVitals.report(lcpPayload, {
    endpoint: null,
    logToConsole: false,
    onMetric: (report) => {
      captured.push(`${report.name}:${report.value}@${report.route}`);
    },
  });

  assert.deepEqual(captured, ['LCP:740.2@/approach']);
  const collected = WebVitals.getCollectedMetrics();
  assert.equal(collected.LCP?.value, 740.2);
  assert.equal(collected.LCP?.route, '/approach');
  assert.equal(DEFAULT_WEB_VITALS_ENDPOINT, '/api/monitoring/web-vitals');
  WebVitals.resetForTests();
});
