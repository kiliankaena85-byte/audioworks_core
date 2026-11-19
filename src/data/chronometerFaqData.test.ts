import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHRONOMETER_FAQ_CATEGORY_TABS,
  CHRONOMETER_FAQ_ITEMS,
  CHRONOMETER_TEMPO_BENCHMARK_ROWS,
  filterChronometerFaqItems,
} from './chronometerFaqData';
import { buildFaqPageJsonLd } from './faqData';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';

test('CHRONOMETER_FAQ_ITEMS covers speech tempo, numbers/phones, and 38-FZ legal rules with sequential numbering', () => {
  assert.equal(CHRONOMETER_FAQ_ITEMS.length, 6);
  const ids = new Set<string>();

  CHRONOMETER_FAQ_ITEMS.forEach((item, idx) => {
    assert.equal(item.indexLabel, String(idx + 1).padStart(2, '0'));
    assert.ok(item.question.trim().length > 20);
    assert.ok(item.answer.trim().length > 80);
    assert.equal(ids.has(item.id), false, `Duplicate FAQ id: ${item.id}`);
    ids.add(item.id);
  });

  const combinedAnswers = CHRONOMETER_FAQ_ITEMS.map(
    (i) => `${i.question} ${i.answer}`
  )
    .join(' ')
    .toLowerCase();

  // Проверяем, что раскрыты все ключевые темы из запроса: скорость речи, цифры/телефоны, сноски и нюансы ФЗ-38
  assert.ok(combinedAnswers.includes('120 слов'));
  assert.ok(combinedAnswers.includes('310-77-00'));
  assert.ok(combinedAnswers.includes('3 полных секунд'));
  assert.ok(combinedAnswers.includes('уже в тексте'));
  assert.ok(combinedAnswers.includes('превосходные степени'));
  assert.ok(combinedAnswers.includes('436-фз'));
});

test('filterChronometerFaqItems partitions items cleanly across categories', () => {
  const all = filterChronometerFaqItems('all');
  const tempo = filterChronometerFaqItems('speech_tempo');
  const fz38 = filterChronometerFaqItems('fz38_disclaimers');

  assert.equal(CHRONOMETER_FAQ_CATEGORY_TABS.length, 3);
  assert.equal(all.length, CHRONOMETER_FAQ_ITEMS.length);
  assert.ok(tempo.length >= 2);
  assert.ok(fz38.length >= 2);
  assert.equal(tempo.length + fz38.length, all.length);
});

test('CHRONOMETER_TEMPO_BENCHMARK_ROWS and FAQ JSON-LD schema are valid and pass BANNED_EDITORIAL_TERMS guardrails', () => {
  assert.deepEqual(
    CHRONOMETER_TEMPO_BENCHMARK_ROWS.map((r) => r.slotSec),
    [10, 15, 20, 30]
  );

  const jsonLd = buildFaqPageJsonLd(CHRONOMETER_FAQ_ITEMS, {
    pageUrl: 'https://fmworks.ru/pricing#chronometer-faq',
    name: 'Часто задаваемые вопросы о хронометраже и ФЗ-38 — FMWorks',
  });
  assert.equal(jsonLd['@type'], 'FAQPage');
  assert.equal(jsonLd.mainEntity.length, CHRONOMETER_FAQ_ITEMS.length);

  const serialized = JSON.stringify({
    CHRONOMETER_FAQ_ITEMS,
    CHRONOMETER_TEMPO_BENCHMARK_ROWS,
    CHRONOMETER_FAQ_CATEGORY_TABS,
  }).toLowerCase();

  for (const banned of BANNED_EDITORIAL_TERMS) {
    assert.equal(
      serialized.includes(banned.toLowerCase()),
      false,
      `chronometerFaqData must not contain banned editorial term "${banned}"`
    );
  }
});
