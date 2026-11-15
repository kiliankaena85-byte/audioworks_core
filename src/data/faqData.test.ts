import assert from 'node:assert/strict';
import test from 'node:test';
import {
  doesFaqTextMatchQuery,
  FAQ_QUICK_SEARCH_TOPICS,
  FAQ_URGENT_ORDER_SEARCH_TEXT,
  filterFaqItems,
  HOME_PROCESS_FAQ_ITEMS,
  normalizeFaqSearchText,
  splitFaqHighlightSegments,
  tokenizeFaqSearchQuery,
} from './faqData';

test('normalizeFaqSearchText folds case, replaces ё with е, and collapses spaces', () => {
  assert.equal(normalizeFaqSearchText('  Счёт   в ЭДО  и  сведЕние '), 'счет в эдо и сведение');
  assert.equal(normalizeFaqSearchText('Актёры и ролик от 1 часа'), 'актеры и ролик от 1 часа');
  assert.equal(normalizeFaqSearchText(''), '');
});

test('tokenizeFaqSearchQuery deduplicates tokens and ignores blank input', () => {
  assert.deepEqual(tokenizeFaqSearchQuery('   '), []);
  assert.deepEqual(
    tokenizeFaqSearchQuery('Счёт  ЭДО   счет'),
    ['счет', 'эдо']
  );
});

test('filterFaqItems returns all items for empty query and filters by multi-token AND matching', () => {
  assert.equal(filterFaqItems(HOME_PROCESS_FAQ_ITEMS, '').length, HOME_PROCESS_FAQ_ITEMS.length);
  assert.equal(filterFaqItems(HOME_PROCESS_FAQ_ITEMS, '   ').length, HOME_PROCESS_FAQ_ITEMS.length);

  // "счет" matches "счёт" thanks to ё -> е normalization
  const invoiceResults = filterFaqItems(HOME_PROCESS_FAQ_ITEMS, 'счет');
  assert.ok(invoiceResults.length >= 2);
  assert.ok(invoiceResults.some((item) => item.id === 'home-contract-edo-fast'));

  // Question match ranks above answer-only matches
  assert.equal(invoiceResults[0].id, 'home-contract-edo-fast');

  // Multi-token AND filtering across question + answer
  const edoResults = filterFaqItems(HOME_PROCESS_FAQ_ITEMS, 'диадок pdf');
  assert.equal(edoResults.length, 1);
  assert.equal(edoResults[0].id, 'home-contract-edo-fast');

  // Non-matching query returns empty list
  assert.deepEqual(filterFaqItems(HOME_PROCESS_FAQ_ITEMS, 'несуществующий_термин_404'), []);
});

test('doesFaqTextMatchQuery matches urgent order block copy accurately', () => {
  assert.equal(doesFaqTextMatchQuery(FAQ_URGENT_ORDER_SEARCH_TEXT, '1 час'), true);
  assert.equal(doesFaqTextMatchQuery(FAQ_URGENT_ORDER_SEARCH_TEXT, 'сведение голос'), true);
  assert.equal(doesFaqTextMatchQuery(FAQ_URGENT_ORDER_SEARCH_TEXT, 'договорной цене'), true);
  assert.equal(doesFaqTextMatchQuery(FAQ_URGENT_ORDER_SEARCH_TEXT, 'Диадок'), false);
});

test('FAQ_QUICK_SEARCH_TOPICS each match at least one FAQ block or item', () => {
  for (const topic of FAQ_QUICK_SEARCH_TOPICS) {
    const itemsMatched = filterFaqItems(HOME_PROCESS_FAQ_ITEMS, topic.query).length;
    const urgentMatched = doesFaqTextMatchQuery(FAQ_URGENT_ORDER_SEARCH_TEXT, topic.query);
    assert.ok(
      itemsMatched > 0 || urgentMatched,
      `Expected topic "${topic.label}" (${topic.query}) to match FAQ items or urgent block`
    );
  }
});

test('splitFaqHighlightSegments highlights matches while preserving original casing and ё', () => {
  const segments = splitFaqHighlightSegments(
    'Сформированный счёт для бухгалтерии через Диадок.',
    'счет диадок'
  );

  const rebuilt = segments.map((s) => s.text).join('');
  assert.equal(rebuilt, 'Сформированный счёт для бухгалтерии через Диадок.');

  const matchedTexts = segments.filter((s) => s.matched).map((s) => s.text);
  assert.deepEqual(matchedTexts, ['счёт', 'Диадок']);
});
