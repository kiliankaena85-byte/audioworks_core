import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildTurboPagesXml } from './turboFeed.ts';

test('buildTurboPagesXml формирует валидный RSS 2.0 фид Яндекс Турбо-страниц по контенту сайта', () => {
  const xml = buildTurboPagesXml('https://fmworks.ru/');

  // Базовая RSS 2.0 + Yandex Turbo схема
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('xmlns:yandex="http://news.yandex.ru"'));
  assert.ok(xml.includes('xmlns:media="http://search.yahoo.com/mrss/"'));
  assert.ok(xml.includes('xmlns:turbo="http://turbo.yandex.ru"'));
  assert.ok(xml.includes('<language>ru</language>'));
  assert.ok(xml.includes('<turbo:analytics/>'));

  // Исключаем Google Analytics или запрещённые inline-скрипты
  assert.equal(xml.includes('<script'), false);
  assert.equal(xml.includes('GoogleAnalytics'), false);

  // Покрытие ключевых разделов сайта
  assert.ok(xml.includes('<link>https://fmworks.ru/</link>'));
  assert.ok(xml.includes('<link>https://fmworks.ru/pricing</link>'));
  assert.ok(xml.includes('<link>https://fmworks.ru/cases</link>'));
  assert.ok(xml.includes('<link>https://fmworks.ru/cases/dmitrogorsky</link>'));
  assert.ok(xml.includes('<link>https://fmworks.ru/cases/business-estate</link>'));
  assert.ok(xml.includes('<link>https://fmworks.ru/cases/industry/real-estate</link>'));
  assert.ok(xml.includes('<link>https://fmworks.ru/cases/industry/medicine</link>'));
  assert.ok(xml.includes('<link>https://fmworks.ru/approach</link>'));
  assert.ok(xml.includes('<link>https://fmworks.ru/approach/phonebook-syndrome</link>'));
  assert.ok(xml.includes('<link>https://fmworks.ru/faq</link>'));

  // Специфические блоки Яндекс Турбо: menu, figure, table, accordion, CTA-кнопка
  assert.ok(xml.includes('<item turbo="true">'));
  assert.ok(xml.includes('<turbo:content><![CDATA['));
  assert.ok(xml.includes('<menu>'));
  assert.ok(xml.includes('<table>'));
  assert.ok(xml.includes('<div data-block="accordion">'));
  assert.ok(xml.includes('<div data-block="item"'));
  assert.ok(xml.includes('<button formaction="https://fmworks.ru/order"'));

  // Данные реального контента: тарифы, LUFS-стандарт и кейс
  assert.ok(xml.includes('25 000 ₽'));
  assert.ok(xml.includes('-14 … -11 LUFS'));
  assert.ok(xml.includes('Дмитрогорский продукт'));

  // Безопасность CDATA и синхронизация со статическим public/turbo-pages.xml
  assert.equal(xml.includes(']]]]><![CDATA[>'), false);
  const turboItemCount = (xml.match(/<item turbo="true">/g) ?? []).length;
  assert.ok(turboItemCount >= 16);

  const publicTurboPath = path.resolve(
    process.cwd(),
    'public',
    'turbo-pages.xml'
  );
  assert.equal(fs.existsSync(publicTurboPath), true);
  assert.equal(fs.readFileSync(publicTurboPath, 'utf8'), xml);
});
