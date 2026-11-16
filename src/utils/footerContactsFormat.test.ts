import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTelHref,
  formatDisplayPhoneRu,
  normalizeTelegramContact,
  resolveAdaptiveBrandTagline,
  validateAdminFooterContacts,
} from './footerContactsFormat';

test('formatDisplayPhoneRu и buildTelHref форматируют телефоны РФ и отклоняют слишком короткие строки', () => {
  assert.equal(formatDisplayPhoneRu('+79040000911'), '+7 (904) 000-09-11');
  assert.equal(formatDisplayPhoneRu('8 (916) 740-28-19'), '+7 (916) 740-28-19');
  assert.equal(formatDisplayPhoneRu('9040000911'), '+7 (904) 000-09-11');
  assert.equal(formatDisplayPhoneRu('   '), '');

  assert.equal(buildTelHref('+7 (904) 000-09-11'), 'tel:+79040000911');
  assert.equal(buildTelHref('8 904 000 09 11'), 'tel:+79040000911');
  assert.equal(buildTelHref(''), null);
  assert.equal(buildTelHref('123'), null);
});

test('normalizeTelegramContact поддерживает @ник, t.me, joinchat, инвайты и отклоняет чужие домены', () => {
  assert.deepEqual(normalizeTelegramContact('@fmworks'), {
    displayHandle: '@fmworks',
    href: 'https://t.me/fmworks',
  });
  assert.deepEqual(normalizeTelegramContact('fmworks_producer'), {
    displayHandle: '@fmworks_producer',
    href: 'https://t.me/fmworks_producer',
  });
  assert.deepEqual(normalizeTelegramContact('https://t.me/artmspektr?start=site'), {
    displayHandle: '@artmspektr',
    href: 'https://t.me/artmspektr',
  });
  assert.deepEqual(normalizeTelegramContact('t.me/fmworks_ru/'), {
    displayHandle: '@fmworks_ru',
    href: 'https://t.me/fmworks_ru',
  });
  assert.deepEqual(normalizeTelegramContact('https://t.me/+AbCdEf12345'), {
    displayHandle: 'Telegram-чат',
    href: 'https://t.me/+AbCdEf12345',
  });
  assert.deepEqual(normalizeTelegramContact('https://t.me/joinchat/StudioRoom99'), {
    displayHandle: 'Telegram-чат',
    href: 'https://t.me/joinchat/StudioRoom99',
  });
  assert.deepEqual(normalizeTelegramContact('tg://resolve?domain=fmworks_studio'), {
    displayHandle: '@fmworks_studio',
    href: 'https://t.me/fmworks_studio',
  });

  // Чужие домены и битые строки не должны превращаться в @https или сломанные ссылки
  assert.equal(normalizeTelegramContact('https://vk.com/fmworks'), null);
  assert.equal(normalizeTelegramContact('https://example.com/contact'), null);
  assert.equal(normalizeTelegramContact('vk.com/fmworks'), null);
  assert.equal(normalizeTelegramContact('   '), null);
  assert.equal(normalizeTelegramContact('@ab'), null);
});

test('validateAdminFooterContacts проверяет телефон и ссылку Telegram в админке', () => {
  const valid = validateAdminFooterContacts({
    phone: '+7 (904) 000-09-11',
    telegram: 'https://t.me/fmworks',
    showPhoneInFooter: true,
    showTelegramInFooter: true,
  });
  assert.equal(valid.isValid, true);
  assert.equal(valid.phoneError, null);
  assert.equal(valid.telegramError, null);

  const invalidEnabled = validateAdminFooterContacts({
    phone: '123',
    telegram: 'https://vk.com/not_telegram',
    showPhoneInFooter: true,
    showTelegramInFooter: true,
  });
  assert.equal(invalidEnabled.isValid, false);
  assert.ok(invalidEnabled.phoneError);
  assert.ok(invalidEnabled.telegramError);

  const emptyDisabled = validateAdminFooterContacts({
    phone: '',
    telegram: '',
    showPhoneInFooter: false,
    showTelegramInFooter: false,
  });
  assert.equal(emptyDisabled.isValid, true);
});

test('resolveAdaptiveBrandTagline собирает двухстрочную и однострочную форму подписи бренда', () => {
  const defaults = resolveAdaptiveBrandTagline();
  assert.equal(defaults.firstLine, 'Аудиореклама,');
  assert.equal(defaults.secondLine, 'которая работает');
  assert.equal(defaults.singleLine, 'Аудиореклама, которая работает');

  const custom = resolveAdaptiveBrandTagline('Звук и радио,', 'которые продают');
  assert.equal(custom.firstLine, 'Звук и радио,');
  assert.equal(custom.secondLine, 'которые продают');
  assert.equal(custom.singleLine, 'Звук и радио, которые продают');
});

test('sanitizeStudioLegalProfilesConfig сохраняет кастомные контакты из админки и позволяет скрывать пустые поля без хардкода', async () => {
  const { sanitizeStudioLegalProfilesConfig } = await import(
    '../data/studioDocumentsCore'
  );

  const updated = sanitizeStudioLegalProfilesConfig({
    legalOperatingMode: 'ooo_only',
    publicContacts: {
      phone: '+7 915 777-88-99',
      phoneLabel: 'Личный номер продюсера',
      telegram: 'https://t.me/producer_fmworks',
      telegramLabel: 'Мой Telegram',
      email: 'hello@fmworks.ru',
      workHoursLabel: 'Ежедневно 10:00–20:00',
      taglineLine1: 'Аудиореклама,',
      taglineLine2: 'которая работает',
      showPhoneInFooter: true,
      showTelegramInFooter: true,
    },
  });

  assert.equal(updated.activeEntityKind, 'ooo');
  assert.equal(
    formatDisplayPhoneRu(updated.publicContacts!.phone),
    '+7 (915) 777-88-99'
  );
  assert.deepEqual(normalizeTelegramContact(updated.publicContacts!.telegram), {
    displayHandle: '@producer_fmworks',
    href: 'https://t.me/producer_fmworks',
  });

  const hidden = sanitizeStudioLegalProfilesConfig({
    legalOperatingMode: 'ooo_only',
    publicContacts: {
      phone: '',
      phoneLabel: '',
      telegram: '',
      telegramLabel: '',
      email: 'art@artmspektr.ru',
      workHoursLabel: '',
      taglineLine1: 'Аудиореклама,',
      taglineLine2: 'которая работает',
      showPhoneInFooter: false,
      showTelegramInFooter: false,
    },
  });

  assert.equal(hidden.publicContacts!.phone, '');
  assert.equal(hidden.publicContacts!.telegram, '');
  assert.equal(buildTelHref(hidden.publicContacts!.phone), null);
  assert.equal(normalizeTelegramContact(hidden.publicContacts!.telegram), null);
});
