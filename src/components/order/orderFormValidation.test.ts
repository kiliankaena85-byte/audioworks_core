import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOrderSubmissionFields } from './orderFormValidation.ts';

test('validateOrderSubmissionFields проверяет сразу все поля (задача, контакт, название, ИНН) при пустой отправке под ЭДО', () => {
  const result = validateOrderSubmissionFields({
    mode: 'production_only',
    paymentChannel: 'edo_invoice',
    contactLine: '',
    companyName: '',
    companyInn: '',
    legacyCompanyLine: '',
    briefText: '',
    hasVoiceRecording: false,
    hasAttachedFile: false,
    isReturningFastTrack: false,
    honeypotFilled: false,
  });

  assert.equal(result.valid, false);
  assert.ok(result.taskError);
  assert.ok(result.contactError);
  assert.ok(result.companyNameError);
  assert.ok(result.companyInnError);
  assert.equal(result.firstErrorField, 'brief');
});

test('validateOrderSubmissionFields ловит пустое название и невалидный ИНН даже когда задача и контакт уже заполнены', () => {
  const badInn = validateOrderSubmissionFields({
    mode: 'production_only',
    paymentChannel: 'edo_invoice',
    contactLine: 'Анна +7 916 555-32-10',
    companyName: '',
    companyInn: '7707083890',
    legacyCompanyLine: '',
    briefText: 'Ролик на 20 секунд про старт продаж',
    hasVoiceRecording: false,
    hasAttachedFile: false,
    isReturningFastTrack: false,
    honeypotFilled: false,
  });

  assert.equal(badInn.valid, false);
  assert.equal(badInn.taskError, undefined);
  assert.equal(badInn.contactError, undefined);
  assert.ok(badInn.companyNameError);
  assert.ok(badInn.companyInnError);
  assert.equal(badInn.firstErrorField, 'companyName');

  const onlyBadInn = validateOrderSubmissionFields({
    mode: 'production_only',
    paymentChannel: 'edo_invoice',
    contactLine: 'Анна +7 916 555-32-10',
    companyName: 'ООО «Квартал Инвест»',
    companyInn: '12345',
    legacyCompanyLine: '',
    briefText: 'Ролик на 20 секунд про старт продаж',
    hasVoiceRecording: false,
    hasAttachedFile: false,
    isReturningFastTrack: false,
    honeypotFilled: false,
  });

  assert.equal(onlyBadInn.valid, false);
  assert.equal(onlyBadInn.companyNameError, undefined);
  assert.ok(onlyBadInn.companyInnError);
  assert.equal(onlyBadInn.firstErrorField, 'companyInn');
});

test('validateOrderSubmissionFields пропускает оплату картой 54-ФЗ без реквизитов, но подсвечивает контакт при ошибке', () => {
  const missingContact = validateOrderSubmissionFields({
    mode: 'production_only',
    paymentChannel: 'card_online',
    contactLine: 'Анна',
    companyName: '',
    companyInn: '',
    legacyCompanyLine: '',
    briefText: 'Нужен игровой ролик на 20 сек',
    hasVoiceRecording: false,
    hasAttachedFile: false,
    isReturningFastTrack: false,
    honeypotFilled: false,
  });

  assert.equal(missingContact.valid, false);
  assert.ok(missingContact.contactError);
  assert.equal(missingContact.companyNameError, undefined);
  assert.equal(missingContact.companyInnError, undefined);
  assert.equal(missingContact.firstErrorField, 'contact');

  const validCard = validateOrderSubmissionFields({
    mode: 'production_only',
    paymentChannel: 'card_online',
    contactLine: 'Анна @anna_promo',
    companyName: '',
    companyInn: '',
    legacyCompanyLine: '',
    briefText: 'Нужен игровой ролик на 20 сек',
    hasVoiceRecording: false,
    hasAttachedFile: false,
    isReturningFastTrack: false,
    honeypotFilled: false,
  });

  assert.equal(validCard.valid, true);
  assert.equal(validCard.firstErrorField, null);
});

test('validateOrderSubmissionFields разрешает заказ с валидным названием, ИНН ФНС, контактом и задачей', () => {
  const validEdo = validateOrderSubmissionFields({
    mode: 'production_only',
    paymentChannel: 'edo_invoice',
    contactLine: 'Анна +7 916 555-32-10',
    companyName: 'ООО «Квартал Инвест»',
    companyInn: '7707083893',
    legacyCompanyLine: '',
    briefText: 'Ролик для утреннего эфира про ЖК',
    hasVoiceRecording: false,
    hasAttachedFile: false,
    isReturningFastTrack: false,
    honeypotFilled: false,
  });

  assert.equal(validEdo.valid, true);
  assert.equal(validEdo.firstErrorField, null);
  assert.equal(validEdo.effectiveCompany, 'ООО «Квартал Инвест» · ИНН 7707083893');
});

test('validateOrderSubmissionFields блокирует отправку без согласия на обработку ПДн (152-ФЗ)', () => {
  const withoutConsent = validateOrderSubmissionFields({
    mode: 'production_only',
    paymentChannel: 'card_online',
    contactLine: 'Ирина +7 904 123-45-67',
    companyName: '',
    companyInn: '',
    legacyCompanyLine: '',
    briefText: 'Нужен аудиоролик на 15 секунд',
    hasVoiceRecording: false,
    hasAttachedFile: false,
    isReturningFastTrack: false,
    honeypotFilled: false,
    pdnConsentAccepted: false,
  });

  assert.equal(withoutConsent.valid, false);
  assert.ok(withoutConsent.consentError);
  assert.match(withoutConsent.consentError, /152-ФЗ/);
  assert.equal(withoutConsent.firstErrorField, 'consent');

  const withConsent = validateOrderSubmissionFields({
    mode: 'production_only',
    paymentChannel: 'card_online',
    contactLine: 'Ирина +7 904 123-45-67',
    companyName: '',
    companyInn: '',
    legacyCompanyLine: '',
    briefText: 'Нужен аудиоролик на 15 секунд',
    hasVoiceRecording: false,
    hasAttachedFile: false,
    isReturningFastTrack: false,
    honeypotFilled: false,
    pdnConsentAccepted: true,
  });

  assert.equal(withConsent.valid, true);
  assert.equal(withConsent.consentError, undefined);
  assert.equal(withConsent.firstErrorField, null);
});
