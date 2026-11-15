import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFaqPageJsonLd,
  FaqItem,
  HOME_PROCESS_FAQ_ITEMS,
  serializeJsonLd,
} from './faqData';

test('buildFaqPageJsonLd строит валидную разметку Schema.org FAQPage для всех вопросов продакшна', () => {
  const schema = buildFaqPageJsonLd(HOME_PROCESS_FAQ_ITEMS, {
    pageUrl: 'https://fmworks.ru/faq',
    name: 'Частые вопросы FMWorks',
    description: 'Регламент, договор, ЭДО, 54-ФЗ и сроки производства аудиороликов.',
  });

  assert.equal(schema['@context'], 'https://schema.org');
  assert.equal(schema['@type'], 'FAQPage');
  assert.equal(schema.url, 'https://fmworks.ru/faq');
  assert.equal(schema.inLanguage, 'ru-RU');
  assert.equal(schema.name, 'Частые вопросы FMWorks');
  assert.equal(schema.mainEntity.length, HOME_PROCESS_FAQ_ITEMS.length);

  schema.mainEntity.forEach((entity, idx) => {
    assert.equal(entity['@type'], 'Question');
    assert.equal(entity.name, HOME_PROCESS_FAQ_ITEMS[idx].question.trim());
    assert.equal(entity.acceptedAnswer['@type'], 'Answer');
    assert.equal(
      entity.acceptedAnswer.text,
      HOME_PROCESS_FAQ_ITEMS[idx].answer.trim()
    );
  });
});

test('buildFaqPageJsonLd отбрасывает пустые элементы и использует дефолты при пустых опциях', () => {
  const customItems: FaqItem[] = [
    {
      id: 'valid',
      indexLabel: '01',
      question: '  Как передаются права?  ',
      answer: '  По договору с паспортом РАО/ВОИС (100% предоплата по договору или картой).  ',
    },
    {
      id: 'empty-question',
      indexLabel: '02',
      question: '   ',
      answer: 'Ответ без вопроса',
    },
    {
      id: 'empty-answer',
      indexLabel: '03',
      question: 'Вопрос без ответа',
      answer: '',
    },
  ];

  const schema = buildFaqPageJsonLd(customItems, {
    pageUrl: '   ',
    name: '',
    description: ' ',
  });

  assert.equal(schema.url, 'https://fmworks.ru/faq');
  assert.ok(schema.name.includes('FMWorks'));
  assert.ok(schema.description.length > 20);
  assert.equal(schema.mainEntity.length, 1);
  assert.equal(schema.mainEntity[0].name, 'Как передаются права?');
  assert.equal(
    schema.mainEntity[0].acceptedAnswer.text,
    'По договору с паспортом РАО/ВОИС (100% предоплата по договору или картой).'
  );
});

test('serializeJsonLd безопасно экранирует HTML-символы без поломки валидного JSON', () => {
  const payload = buildFaqPageJsonLd([
    {
      id: 'xss',
      indexLabel: '01',
      question: 'Вопрос про </script><script>alert(1)</script> & договор?',
      answer: 'Ответ с тегами <b>WAV & MP3</b> > стандарта.',
    },
  ]);

  const serialized = serializeJsonLd(payload);
  assert.equal(serialized.includes('</script>'), false);
  assert.equal(serialized.includes('<'), false);
  assert.equal(serialized.includes('>'), false);
  assert.equal(serialized.includes('&'), false);

  const parsed = JSON.parse(serialized);
  assert.equal(parsed['@type'], 'FAQPage');
  assert.equal(
    parsed.mainEntity[0].name,
    'Вопрос про </script><script>alert(1)</script> & договор?'
  );
  assert.equal(
    parsed.mainEntity[0].acceptedAnswer.text,
    'Ответ с тегами <b>WAV & MP3</b> > стандарта.'
  );
});
