import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHUNK_RELOAD_COOLDOWN_MS,
  CHUNK_RELOAD_STORAGE_KEY,
  isChunkLoadError,
  isChunkReloadInProgress,
  loadWithRetry,
  resetChunkReloadStateForTests,
  tryTriggerChunkReload,
} from './lazyWithRetry';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

test('isChunkLoadError detects Vite/browser stale chunk errors and ignores app bugs', () => {
  assert.equal(
    isChunkLoadError(
      new TypeError(
        'Failed to fetch dynamically imported module: https://example.com/assets/Home-abc.js'
      )
    ),
    true
  );
  assert.equal(
    isChunkLoadError(new Error('error loading dynamically imported module')),
    true
  );
  assert.equal(
    isChunkLoadError(new Error('Importing a module script failed.')),
    true
  );
  assert.equal(
    isChunkLoadError(new Error('Unable to preload CSS for /assets/PricingSection-123.css')),
    true
  );
  assert.equal(
    isChunkLoadError(
      new Error(
        'Loading module from “https://example.com/assets/Foo.js” was blocked because of a disallowed MIME type (“text/html”).'
      )
    ),
    true
  );
  assert.equal(isChunkLoadError(new Error('Load failed')), true);

  assert.equal(
    isChunkLoadError(new TypeError("Cannot read properties of null (reading 'id')")),
    false
  );
  assert.equal(isChunkLoadError(new RangeError('Invalid array length')), false);
});

test('tryTriggerChunkReload fires once per cooldown and prevents parallel chunk races', () => {
  resetChunkReloadStateForTests();
  const storage = createMemoryStorage();
  let reloads = 0;

  // Первый вызов запускает reload
  const first = tryTriggerChunkReload({
    storage,
    reloadFn: () => {
      reloads += 1;
    },
    nowMs: 1_000_000,
  });
  assert.equal(first, true);
  assert.equal(reloads, 1);
  assert.equal(isChunkReloadInProgress(), true);
  assert.equal(storage.getItem(CHUNK_RELOAD_STORAGE_KEY), '1000000');

  // Параллельный чанк в том же runtime страницы видит активный reload и не бросает ошибку
  const concurrent = tryTriggerChunkReload({
    storage,
    reloadFn: () => {
      reloads += 1;
    },
    nowMs: 1_000_005,
  });
  assert.equal(concurrent, true);
  assert.equal(reloads, 1);

  // После перезагрузки (новая память) в пределах cooldown повторного reload нет
  resetChunkReloadStateForTests();
  const withinCooldown = tryTriggerChunkReload({
    storage,
    reloadFn: () => {
      reloads += 1;
    },
    nowMs: 1_000_000 + CHUNK_RELOAD_COOLDOWN_MS - 100,
  });
  assert.equal(withinCooldown, false);
  assert.equal(reloads, 1);

  // После истечения cooldown снова разрешено обновить страницу
  const afterCooldown = tryTriggerChunkReload({
    storage,
    reloadFn: () => {
      reloads += 1;
    },
    nowMs: 1_000_000 + CHUNK_RELOAD_COOLDOWN_MS + 100,
  });
  assert.equal(afterCooldown, true);
  assert.equal(reloads, 2);
});

test('loadWithRetry recovers transient chunk errors without reload and suspends during reload', async () => {
  resetChunkReloadStateForTests();
  let calls = 0;
  const recovered = await loadWithRetry(
    async () => {
      calls += 1;
      if (calls === 1) {
        throw new TypeError('Failed to fetch dynamically imported module: /assets/Foo.js');
      }
      return { ok: true };
    },
    {
      retries: 1,
      retryDelayMs: 0,
      sleepFn: async () => {},
      onChunkFailureReload: () => {
        throw new Error('Reload should not be called when retry succeeds');
      },
    }
  );
  assert.deepEqual(recovered, { ok: true });
  assert.equal(calls, 2);

  // Непостоянная (настоящая) ошибка компонента не перезагружает страницу и пробрасывается сразу
  let appErrCalls = 0;
  await assert.rejects(
    () =>
      loadWithRetry(
        async () => {
          appErrCalls += 1;
          throw new Error('Invalid state initialization');
        },
        {
          retries: 1,
          retryDelayMs: 0,
          sleepFn: async () => {},
          onChunkFailureReload: () => true,
        }
      ),
    /Invalid state initialization/
  );
  assert.equal(appErrCalls, 1);

  // При исчерпании retry и запуске reload промис остаётся pending для Suspense без падения в ErrorBoundary
  let reloadTriggered = false;
  const pending = loadWithRetry(
    async () => {
      throw new TypeError('Failed to fetch dynamically imported module: /assets/Stale.js');
    },
    {
      retries: 1,
      retryDelayMs: 0,
      sleepFn: async () => {},
      onChunkFailureReload: () => {
        reloadTriggered = true;
        return true;
      },
    }
  );

  const raceOutcome = await Promise.race([
    pending.then(() => 'resolved', () => 'rejected'),
    new Promise<string>((resolve) => setTimeout(() => resolve('still-pending'), 25)),
  ]);
  assert.equal(reloadTriggered, true);
  assert.equal(raceOutcome, 'still-pending');
});
