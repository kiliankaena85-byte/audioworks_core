import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatStructuredCompanyLine,
  inspectCompanyDetails,
  inspectInnDigits,
  normalizeInnDigits,
  parseCompanyNameAndInn,
} from './companyDetailsHelpers.ts';

test('normalizeInnDigits и inspectInnDigits проверяют 10- и 12-значные ИНН по контрольным цифрам ФНС', () => {
  assert.equal(normalizeInnDigits('ИНН 7707-0838-93'), '7707083893');
  assert.equal(normalizeInnDigits('123456789012345'), '123456789012');

  const legal = inspectInnDigits('7707083893');
  assert.equal(legal.entityKind, 'legal_entity');
  assert.equal(legal.isCompleteLength, true);
  assert.equal(legal.checksumValid, true);

  const ip = inspectInnDigits('500100732259');
  assert.equal(ip.entityKind, 'sole_proprietor');
  assert.equal(ip.isCompleteLength, true);
  assert.equal(ip.checksumValid, true);

  const badChecksum = inspectInnDigits('7707083894');
  assert.equal(badChecksum.isCompleteLength, true);
  assert.equal(badChecksum.checksumValid, false);

  const partial = inspectInnDigits('770708');
  assert.equal(partial.isCompleteLength, false);
  assert.equal(partial.checksumValid, false);
});

test('formatStructuredCompanyLine и parseCompanyNameAndInn выполняют обратимый разбор названия компании и ИНН', () => {
  const formatted = formatStructuredCompanyLine('ООО «Альфа Медиа»', '7707083893');
  assert.equal(formatted, 'ООО «Альфа Медиа» · ИНН 7707083893');

  const parsed = parseCompanyNameAndInn(formatted);
  assert.equal(parsed.companyName, 'ООО «Альфа Медиа»');
  assert.equal(parsed.companyInn, '7707083893');

  const parsedInnOnly = parseCompanyNameAndInn('ИНН 500100732259');
  assert.equal(parsedInnOnly.companyName, '');
  assert.equal(parsedInnOnly.companyInn, '500100732259');
});

test('inspectCompanyDetails требует название и валидный ИНН в режиме ЭДО и допускает пустые поля при оплате картой (54-ФЗ)', () => {
  const emptyEdo = inspectCompanyDetails({
    companyName: '',
    companyInn: '',
    paymentChannel: 'edo_invoice',
  });
  assert.equal(emptyEdo.valid, false);
  assert.ok(emptyEdo.nameError);
  assert.ok(emptyEdo.innError);

  const validEdo = inspectCompanyDetails({
    companyName: 'ООО «Квартал Инвест»',
    companyInn: '7707083893',
    paymentChannel: 'edo_invoice',
  });
  assert.equal(validEdo.valid, true);
  assert.equal(validEdo.innVerified, true);
  assert.equal(validEdo.innEntityKind, 'legal_entity');
  assert.equal(validEdo.combinedCompanyLine, 'ООО «Квартал Инвест» · ИНН 7707083893');

  const emptyCard = inspectCompanyDetails({
    companyName: '',
    companyInn: '',
    paymentChannel: 'card_online',
  });
  assert.equal(emptyCard.valid, true);
  assert.equal(emptyCard.innVerified, false);

  const invalidInnOnCard = inspectCompanyDetails({
    companyName: 'ИП Смирнов',
    companyInn: '7707083894',
    paymentChannel: 'card_online',
  });
  assert.equal(invalidInnOnCard.valid, false);
  assert.ok(invalidInnOnCard.innError?.includes('ИНН'));

  const validInnOnly = inspectCompanyDetails({
    companyName: '',
    companyInn: '6663003127',
    paymentChannel: 'edo_invoice',
  });
  assert.equal(validInnOnly.valid, true);
  assert.equal(validInnOnly.innVerified, true);
  assert.match(validInnOnly.combinedCompanyLine, /СКБ Контур.*ИНН 6663003127/);
});

