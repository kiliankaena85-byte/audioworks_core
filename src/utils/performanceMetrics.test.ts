import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createClsSessionWindowAccumulator,
  createInpInteractionTracker,
  createWebVitalSnapshot,
  evaluateWebVitalRating,
  extractLongTaskBottleneck,
  extractNavigationTimingSummary,
  formatLongTaskLogLine,
  formatWebVitalLogLine,
} from './performanceMetrics.ts';

test('evaluateWebVitalRating классифицирует TTFB, FCP, LCP, CLS и INP по порогам Core Web Vitals', () => {
  assert.equal(evaluateWebVitalRating('LCP', 1800), 'good');
  assert.equal(evaluateWebVitalRating('LCP', 2500), 'good');
  assert.equal(evaluateWebVitalRating('LCP', 3200), 'needs-improvement');
  assert.equal(evaluateWebVitalRating('LCP', 4500), 'poor');

  assert.equal(evaluateWebVitalRating('CLS', 0.05), 'good');
  assert.equal(evaluateWebVitalRating('CLS', 0.18), 'needs-improvement');
  assert.equal(evaluateWebVitalRating('CLS', 0.31), 'poor');

  assert.equal(evaluateWebVitalRating('INP', 120), 'good');
  assert.equal(evaluateWebVitalRating('INP', 280), 'needs-improvement');
  assert.equal(evaluateWebVitalRating('INP', 640), 'poor');

  assert.equal(evaluateWebVitalRating('TTFB', 450), 'good');
  assert.equal(evaluateWebVitalRating('FCP', 1900), 'needs-improvement');
});

test('createClsSessionWindowAccumulator игнорирует hadRecentInput и сбрасывает сессионное окно', () => {
  const cls = createClsSessionWindowAccumulator();
  assert.equal(
    cls.addEntry({ startTime: 200, value: 0.4, hadRecentInput: true }),
    0
  );
  assert.equal(
    cls.addEntry({ startTime: 500, value: 0.04, hadRecentInput: false }),
    0.04
  );
  assert.equal(
    cls.addEntry({ startTime: 900, value: 0.03, hadRecentInput: false }),
    0.07
  );
  // Разрыв больше 1000 мс начинает новое окно; максимум остаётся 0.07
  assert.equal(
    cls.addEntry({ startTime: 2500, value: 0.02, hadRecentInput: false }),
    0.07
  );
  // Более крупное новое окно в пределах 5с обновляет maxScore
  assert.equal(
    cls.addEntry({ startTime: 3000, value: 0.09, hadRecentInput: false }),
    0.11
  );
  assert.equal(cls.getMaxScore(), 0.11);
});

test('createInpInteractionTracker вычисляет p98 длительность по interactionId', () => {
  const inp = createInpInteractionTracker();
  assert.equal(inp.getInpMs(), null);
  // Запись без interactionId (например hover) не учитывается в INP
  assert.equal(inp.addEntry({ duration: 400, interactionId: 0 }), null);

  inp.addEntry({ duration: 48, interactionId: 1 });
  inp.addEntry({ duration: 96, interactionId: 2 });
  // Повторная более длинная фаза того же interactionId обновляет значение
  inp.addEntry({ duration: 132, interactionId: 2 });
  assert.equal(inp.getInpMs(), 132);
});

test('extractNavigationTimingSummary извлекает TTFB и этапы загрузки', () => {
  const summary = extractNavigationTimingSummary({
    requestStart: 120,
    responseStart: 365.44,
    domInteractive: 612.88,
    domContentLoadedEventEnd: 790.12,
    loadEventEnd: 1120.55,
  });
  assert.deepEqual(summary, {
    ttfbMs: 245.4,
    domInteractiveMs: 612.9,
    domContentLoadedMs: 790.1,
    loadCompleteMs: 1120.6,
  });

  const negativeClamp = extractNavigationTimingSummary({
    requestStart: 500,
    responseStart: 200,
  });
  assert.equal(negativeClamp?.ttfbMs, 0);
});

test('extractLongTaskBottleneck фильтрует задачи <= 50ms и классифицирует узкие места', () => {
  assert.equal(
    extractLongTaskBottleneck({ startTime: 100, duration: 49.9 }, '/cases'),
    null
  );

  const moderate = extractLongTaskBottleneck(
    {
      name: 'self',
      startTime: 412.34,
      duration: 82.66,
      attribution: [{ containerType: 'window', containerId: 'app-main' }],
    },
    '/pricing'
  );
  assert.deepEqual(moderate, {
    startTimeMs: 412.3,
    durationMs: 82.7,
    severity: 'moderate',
    source: 'self',
    containerLabel: 'window · #app-main',
    route: '/pricing',
  });

  const severe = extractLongTaskBottleneck(
    {
      name: 'same-origin',
      startTime: 1200,
      duration: 215,
      attribution: [{ containerSrc: '/assets/heavy.js' }],
    },
    '/approach'
  );
  assert.equal(severe?.severity, 'severe');
  assert.ok(formatLongTaskLogLine(severe!).includes('215ms'));

  const snap = createWebVitalSnapshot('LCP', 1432.6, '/cases', 'img.hero');
  assert.ok(formatWebVitalLogLine(snap).includes('LCP: 1432.6ms [good] on /cases'));
});
