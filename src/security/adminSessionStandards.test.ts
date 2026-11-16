import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStudioSessionActivityTracker,
  DEFAULT_STUDIO_OPERATOR_NAME,
  resolveNextTabIdOnArrowKey,
  sanitizeStudioOperatorName,
  STUDIO_SESSION_ABSOLUTE_TTL_MS,
  STUDIO_SESSION_IDLE_TIMEOUT_MS,
} from './adminSessionStandards';

test('ASVS 5.0 V7.3.1: session constants enforce 12h absolute and 30m idle limits', () => {
  assert.equal(STUDIO_SESSION_ABSOLUTE_TTL_MS, 12 * 60 * 60 * 1000);
  assert.equal(STUDIO_SESSION_IDLE_TIMEOUT_MS, 30 * 60 * 1000);
});

test('ASVS 5.0 V6: sanitizeStudioOperatorName strips control/HTML chars and falls back safely', () => {
  assert.equal(sanitizeStudioOperatorName('  Елена   Громова '), 'Елена Громова');
  assert.equal(
    sanitizeStudioOperatorName('Алексей <script>Морозов'),
    'Алексей script Морозов'
  );
  assert.equal(sanitizeStudioOperatorName(''), DEFAULT_STUDIO_OPERATOR_NAME);
  assert.equal(sanitizeStudioOperatorName(null), DEFAULT_STUDIO_OPERATOR_NAME);
});

test('ASVS 5.0 V7.3.1: idle session tracker expires inactive sessions and extends active ones', () => {
  const tracker = createStudioSessionActivityTracker(30 * 60 * 1000);
  const t0 = 1_700_000_000_000;
  const absExp = t0 + STUDIO_SESSION_ABSOLUTE_TTL_MS;

  tracker.registerSession('nonce-1', absExp, 'Елена Громова', t0);

  // Через 20 минут сессия активна и продлевает окно бездействия
  const check20m = tracker.verifyAndTouch(
    'nonce-1',
    absExp,
    'Елена Громова',
    t0 + 20 * 60 * 1000
  );
  assert.equal(check20m.active, true);
  assert.equal(check20m.operatorName, 'Елена Громова');

  // Ещё через 20 минут (40 мин от старта, но 20 мин от последнего действия) сессия всё ещё активна
  const check40m = tracker.verifyAndTouch(
    'nonce-1',
    absExp,
    'Елена Громова',
    t0 + 40 * 60 * 1000
  );
  assert.equal(check40m.active, true);

  // Через 31 минуту полного бездействия сессия принудительно завершается
  const checkIdleExpired = tracker.verifyAndTouch(
    'nonce-1',
    absExp,
    'Елена Громова',
    t0 + 71 * 60 * 1000 + 1000
  );
  assert.equal(checkIdleExpired.active, false);
  assert.equal(checkIdleExpired.reason, 'expired_idle');
});

test('WAI-ARIA 1.2 Tabs Pattern: resolveNextTabIdOnArrowKey cycles tabs cleanly', () => {
  const tabs = ['contract', 'fz38', 'deliverables'] as const;
  assert.equal(resolveNextTabIdOnArrowKey(tabs, 'contract', 'ArrowRight'), 'fz38');
  assert.equal(
    resolveNextTabIdOnArrowKey(tabs, 'deliverables', 'ArrowRight'),
    'contract'
  );
  assert.equal(
    resolveNextTabIdOnArrowKey(tabs, 'contract', 'ArrowLeft'),
    'deliverables'
  );
  assert.equal(
    resolveNextTabIdOnArrowKey(tabs, 'deliverables', 'Home'),
    'contract'
  );
  assert.equal(
    resolveNextTabIdOnArrowKey(tabs, 'contract', 'End'),
    'deliverables'
  );
  assert.equal(resolveNextTabIdOnArrowKey(tabs, 'contract', 'Enter'), null);
});
