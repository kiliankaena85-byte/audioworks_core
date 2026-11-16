import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assembleProductionDocumentSuite,
  BROADCAST_TECH_STANDARD_ROWS,
  computeVatBreakdown,
  createDefaultStudioLegalProfiles,
  formatProductionSuitePlainSummary,
  formatRublesInWordsRu,
  parseCustomerCounterparty,
  sanitizeStudioLegalProfilesConfig,
} from './studioDocumentsCore.ts';

const BANNED_SUBSTRINGS = [
  'fm-тракт',
  'спектрограмма',
  'компрессор',
  'стемы',
  'дешевые биржи',
  'честная московская цена',
  'москв',
  'петерб',
  'питер',
  'мск',
  'спб',
  'moscow',
  'spb',
] as const;

test('formatRublesInWordsRu склоняет рубли, тысячи, миллионы и копейки без ошибок', () => {
  assert.equal(formatRublesInWordsRu(0, 0), 'Ноль рублей 00 копеек');
  assert.equal(formatRublesInWordsRu(1, 1), 'Один рубль 01 копейка');
  assert.equal(formatRublesInWordsRu(2, 2), 'Два рубля 02 копейки');
  assert.equal(formatRublesInWordsRu(15_000, 0), 'Пятнадцать тысяч рублей 00 копеек');
  assert.equal(formatRublesInWordsRu(21_000, 50), 'Двадцать одна тысяча рублей 50 копеек');
  assert.equal(formatRublesInWordsRu(25_000, 0), 'Двадцать пять тысяч рублей 00 копеек');
  assert.equal(formatRublesInWordsRu(35_000, 0), 'Тридцать пять тысяч рублей 00 копеек');
  assert.equal(
    formatRublesInWordsRu(1_102_500, 14),
    'Один миллион сто две тысячи пятьсот рублей 14 копеек'
  );
});

test('computeVatBreakdown считает УСН без НДС, УСН 5%, УСН 7% и ОСНО 20% в режимах included и on_top', () => {
  const usnZero = computeVatBreakdown(25_000, 'usn_no_vat', 'included');
  assert.equal(usnZero.vatRatePercent, 0);
  assert.equal(usnZero.vatAmountKopecks, 0);
  assert.equal(usnZero.totalPayableKopecks, 2_500_000);
  assert.match(usnZero.taxLegalLabel, /ст\. 346\.11 НК РФ/);

  const vat5Included = computeVatBreakdown(21_000, 'usn_vat_5', 'included');
  assert.equal(vat5Included.vatRatePercent, 5);
  assert.equal(vat5Included.vatAmountKopecks, 100_000); // 1 000,00 ₽ из 21 000,00 ₽
  assert.equal(vat5Included.subtotalExclVatKopecks, 2_000_000);
  assert.equal(vat5Included.totalPayableKopecks, 2_100_000);

  const vat7OnTop = computeVatBreakdown(10_000, 'usn_vat_7', 'on_top');
  assert.equal(vat7OnTop.vatAmountKopecks, 70_000);
  assert.equal(vat7OnTop.totalPayableKopecks, 1_070_000);

  const vat20Included = computeVatBreakdown(30_000, 'osno_vat_20', 'included');
  assert.equal(vat20Included.vatAmountKopecks, 500_000); // 5 000,00 ₽
  assert.equal(vat20Included.subtotalExclVatKopecks, 2_500_000);
  assert.equal(vat20Included.totalPayableKopecks, 3_000_000);
});

test('Переключение профиля ИП / ООО (г. Тверь) скрывает КПП у ИП и включает КПП у ООО + в ST00012', () => {
  const dirtyProfiles = sanitizeStudioLegalProfilesConfig({
    activeEntityKind: 'ip',
    ipProfile: {
      entityKind: 'ip',
      kpp: '695001001', // должно быть принудительно очищено у ИП
    } as never,
  });
  assert.equal(dirtyProfiles.ipProfile.kpp, '');
  assert.equal(dirtyProfiles.ipProfile.city, 'г. Тверь');
  assert.equal(dirtyProfiles.oooProfile.kpp.length, 9);
  assert.equal(dirtyProfiles.oooProfile.city, 'г. Тверь');

  const ipSuite = assembleProductionDocumentSuite({
    orderNumber: 'FM-2601',
    createdAtIso: '2026-04-18T10:00:00.000Z',
    formatLabel: 'Под ключ · 25 000 ₽ (20 сек)',
    baseBudgetRub: 25_000,
    contact: 'Алексей +7 900 111-22-33',
    companyOrInn: 'ООО «ТверьСтрой» · ИНН 6950123456',
    briefText: 'Имиджевый ролик 20 сек',
    legalProfiles: dirtyProfiles,
  });

  assert.equal(ipSuite.studio.entityKind, 'ip');
  assert.equal(ipSuite.studio.kpp, '');
  assert.equal(ipSuite.paymentQrPayload.includes('KPP='), false);
  assert.equal(ipSuite.spotDurationSec, 20);
  assert.equal(ipSuite.spotDurationFormatted, '00:20');

  const oooSuite = assembleProductionDocumentSuite({
    orderNumber: 'FM-2601',
    createdAtIso: '2026-04-18T10:00:00.000Z',
    formatLabel: 'Игровой ролик · 35 000 ₽',
    baseBudgetRub: 35_000,
    defaultDurationSec: 30,
    contact: 'Алексей +7 900 111-22-33',
    companyOrInn: 'ООО «ТверьСтрой» · ИНН 6950123456',
    briefText: 'Игровой ролик 30 сек',
    legalProfiles: dirtyProfiles,
    documentMeta: {
      entityKindOverride: 'ooo',
      taxRegimeOverride: 'osno_vat_20',
      appendixNumber: 3,
    },
  });

  assert.equal(oooSuite.studio.entityKind, 'ooo');
  assert.equal(oooSuite.studio.kpp, '695001001');
  assert.equal(oooSuite.paymentQrPayload.includes('KPP=695001001'), true);
  assert.equal(oooSuite.appendixNumber, 3);
  assert.equal(oooSuite.tax.vatRatePercent, 20);
});

test('Договорная цена (0 ₽) блокирует выставление нулевого счёта до ввода customPriceRub продюсером', () => {
  const pendingSuite = assembleProductionDocumentSuite({
    orderNumber: 'FM-2699',
    createdAtIso: '2026-04-18T12:00:00.000Z',
    formatLabel: 'Индивидуальная задача · Договорная цена',
    baseBudgetRub: 0,
    contact: 'Мария @maria_brand',
    companyOrInn: '',
    briefText: 'Серия из 4 джинглов и бренд-войс',
  });

  assert.equal(pendingSuite.isNegotiablePendingPrice, true);
  assert.equal(pendingSuite.effectivePriceRub, 0);
  const pendingInvoiceText = formatProductionSuitePlainSummary(pendingSuite, 'invoice');
  assert.match(pendingInvoiceText, /Договорная цена/);

  const unlockedSuite = assembleProductionDocumentSuite({
    orderNumber: 'FM-2699',
    createdAtIso: '2026-04-18T12:00:00.000Z',
    formatLabel: 'Индивидуальная задача · Договорная цена',
    baseBudgetRub: 0,
    contact: 'Мария @maria_brand',
    companyOrInn: 'ИП Смирнова М. А. ИНН 695008412904',
    briefText: 'Серия из 4 джинглов и бренд-войс',
    documentMeta: {
      customPriceRub: 48_000,
    },
  });

  assert.equal(unlockedSuite.isNegotiablePendingPrice, false);
  assert.equal(unlockedSuite.effectivePriceRub, 48_000);
  assert.equal(unlockedSuite.customer.isIpByInn, true);
  assert.equal(unlockedSuite.customer.kpp, '');
});

test('Раздел 3 Договора (техстандарт радио РФ) и все 4 документа не содержат запрещённых слов', () => {
  assert.equal(BROADCAST_TECH_STANDARD_ROWS.length, 5);
  const joinedTech = BROADCAST_TECH_STANDARD_ROWS.map(
    (r) => `${r.parameter} ${r.specification}`
  ).join(' ');
  assert.match(joinedTech, /44 100 Гц/);
  assert.match(joinedTech, /-14 … -11 LUFS/);
  assert.match(joinedTech, /True Peak ≤ -0\.5 dBTP/);
  assert.match(joinedTech, /ч\. 11 ст\. 15 ФЗ-38/);

  const profiles = createDefaultStudioLegalProfiles();
  const suite = assembleProductionDocumentSuite({
    orderNumber: 'FM-2705',
    createdAtIso: '2026-04-18T15:00:00.000Z',
    formatLabel: 'Продакшн под ключ',
    baseBudgetRub: 25_000,
    contact: 'Иван Петров +7 904 000-11-22',
    companyOrInn: 'ООО «Волга Ритейл» · ИНН 6950241890',
    briefText: 'Аудиоролик для регионального эфира',
    legalProfiles: profiles,
  });

  assert.equal(suite.actNumber, 'АКТ-2026/2705-1');
  assert.equal(suite.spotMasterFileName, 'FMWorks_Spot_2026_2705_30s.wav');
  const actText = formatProductionSuitePlainSummary(suite, 'act');
  assert.match(actText, /АКТ СДАЧИ-ПРИЁМКИ ОКАЗАННЫХ УСЛУГ № АКТ-2026\/2705-1/);
  assert.match(actText, /ст\. 1234, 1285 ГК РФ/);
  assert.match(actText, /Стороны взаимных претензий не имеют/);

  const allTexts = [
    JSON.stringify(profiles),
    joinedTech,
    formatProductionSuitePlainSummary(suite, 'kp'),
    formatProductionSuitePlainSummary(suite, 'contract'),
    formatProductionSuitePlainSummary(suite, 'invoice'),
    actText,
    formatProductionSuitePlainSummary(suite, 'passport'),
  ]
    .join('\n')
    .toLowerCase();

  for (const banned of BANNED_SUBSTRINGS) {
    assert.equal(
      allTexts.includes(banned),
      false,
      `Обнаружен запрещённый фрагмент «${banned}» в документах студии`
    );
  }

  assert.match(allTexts, /fmworks\.ru/);
  assert.match(allTexts, /г\. тверь/);

  const parsedCounterparty = parseCustomerCounterparty(
    'ООО «Квартал» · ИНН 6950241890',
    'Анна'
  );
  assert.equal(parsedCounterparty.displayName, 'ООО «Квартал»');
  assert.equal(parsedCounterparty.inn, '6950241890');
});
