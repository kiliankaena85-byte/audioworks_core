import assert from 'node:assert/strict';
import test from 'node:test';
import { injectRouteSeoIntoHtml } from '../data/seoServerTemplates';
import {
  buildGeminiMediaAdvisorPrompt,
  GEMINI_MEDIA_ADVISOR_MODEL,
  sanitizeGeminiMediaAdvisorRawJson,
} from './geminiMediaAdvisor';
import {
  evictExcessSseClients,
  pruneExpiredTtlEntries,
  setBoundedTtlEntry,
} from './runtimeMemoryGuard';

test('geminiMediaAdvisor uses active gemini-4-hydrogen model and filters invalid/banned suggestions', () => {
  assert.equal(GEMINI_MEDIA_ADVISOR_MODEL, 'gemini-4-hydrogen');

  const prompt = buildGeminiMediaAdvisorPrompt({
    niche: 'real_estate',
    segment: 'b2c_premium',
    ageCore: '30_45',
    listeningContext: 'commute_rush',
    budgetRub: 240_000,
    spotSeconds: 20,
    productNote: 'Бизнес-квартал у парка',
  });
  assert.ok(prompt.includes('240000 ₽'));
  assert.ok(prompt.includes('Бизнес-квартал у парка'));

  const rawJson = JSON.stringify({
    preferredDayparts: ['morning_prime', 'invalid_slot'],
    avoidedDayparts: ['weekend_air', 123],
    boostedStationIds: ['bfm', 'montecarlo', 'unknown_fm', 'jazz', 'retrofm'],
    stationReasons: [
      { stationId: 'bfm', reason: 'Деловая аудитория за рулём в утренний прайм' },
      { stationId: 'unknown_fm', reason: 'Неизвестная станция' },
      { stationId: 'jazz', reason: 'Запрещённый термин москв внутри строки' },
    ],
  });

  const sanitized = sanitizeGeminiMediaAdvisorRawJson(
    rawJson,
    (reason) => !reason.toLowerCase().includes('москв')
  );

  assert.deepEqual(sanitized.preferredDayparts, ['morning_prime']);
  assert.deepEqual(sanitized.avoidedDayparts, ['weekend_air']);
  assert.deepEqual(sanitized.boostedStationIds, ['bfm', 'montecarlo', 'jazz']);
  assert.deepEqual(sanitized.slotReasonsByStationId, {
    bfm: 'Деловая аудитория за рулём в утренний прайм',
  });
});

test('runtimeMemoryGuard prunes expired TTL entries and enforces strict FIFO cap', () => {
  const map = new Map<string, number>();
  setBoundedTtlEntry(map, 'n1', 1_000, 3, 500);
  setBoundedTtlEntry(map, 'n2', 2_000, 3, 500);
  setBoundedTtlEntry(map, 'n3', 3_000, 3, 500);
  assert.equal(map.size, 3);

  // At t=1500, n1 is expired so inserting n4 prunes n1 first without evicting live n2/n3
  setBoundedTtlEntry(map, 'n4', 4_000, 3, 1_500);
  assert.deepEqual(Array.from(map.keys()), ['n2', 'n3', 'n4']);

  // At t=1600, none are expired; inserting n5 evicts oldest live entry (n2)
  setBoundedTtlEntry(map, 'n5', 5_000, 3, 1_600);
  assert.deepEqual(Array.from(map.keys()), ['n3', 'n4', 'n5']);

  const prunedCount = pruneExpiredTtlEntries(map, 4_500);
  assert.equal(prunedCount, 2);
  assert.deepEqual(Array.from(map.keys()), ['n5']);
});

test('runtimeMemoryGuard evicts oldest SSE client streams when concurrent limit is reached', () => {
  let endedIds: string[] = [];
  const makeClient = (id: string) => ({
    id,
    heartbeatTimer: setInterval(() => {}, 60_000).unref(),
    res: {
      end: () => {
        endedIds.push(id);
      },
    },
  });

  const clients = new Map<string, ReturnType<typeof makeClient>>();
  const c1 = makeClient('c1');
  const c2 = makeClient('c2');
  const c3 = makeClient('c3');
  clients.set('c1', c1);
  clients.set('c2', c2);
  clients.set('c3', c3);

  const evicted = evictExcessSseClients(clients, 2);
  assert.equal(evicted, 2);
  assert.deepEqual(endedIds, ['c1', 'c2']);
  assert.deepEqual(Array.from(clients.keys()), ['c3']);
  clearInterval(c3.heartbeatTimer);
});

test('injectRouteSeoIntoHtml emits OpenGraph, Twitter summary_large_image cards, and noindex on /admin', () => {
  const minimalShell =
    '<!doctype html><html lang="ru"><head><title>Init</title></head><body><div id="root"></div></body></html>';

  const casesHtml = injectRouteSeoIntoHtml(minimalShell, '/cases', 'https://fmworks.ru');
  assert.ok(casesHtml.includes('<meta name="twitter:card" content="summary_large_image" />'));
  assert.ok(casesHtml.includes('name="twitter:title"'));
  assert.ok(casesHtml.includes('name="twitter:description"'));
  assert.ok(
    casesHtml.includes(
      'name="twitter:image" content="https://fmworks.ru/api/og.png?route=%2Fcases"'
    )
  );

  const adminHtml = injectRouteSeoIntoHtml(minimalShell, '/admin', 'https://fmworks.ru');
  assert.ok(adminHtml.includes('<meta name="robots" content="noindex, nofollow" />'));
  assert.ok(!adminHtml.includes('data-ssr-seo="true"'));
});
