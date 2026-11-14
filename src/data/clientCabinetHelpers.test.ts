import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCanonicalDeliveryDetail,
  formatFileSizeReadable,
  mapCrmStageToClientProgress,
  matchesOrderLookupVerifier,
  normalizeDeliveryPreferences,
  parseDeliveryDetailSelection,
  removeClientCabinetEntry,
  resolveDeliveryChannelLabel,
  sanitizeCloudDiskUrl,
  sanitizeDeliveryChannel,
  upsertClientCabinetEntry,
  validateDeliveryEmail,
} from './clientCabinetHelpers.ts';

function createMemoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

test('sanitizeDeliveryChannel и normalizeDeliveryPreferences поддерживают messenger/cloud/email/cabinet и мигрируют старые каналы', () => {
  assert.equal(sanitizeDeliveryChannel('messenger'), 'messenger');
  assert.equal(sanitizeDeliveryChannel('cloud'), 'cloud');
  assert.equal(sanitizeDeliveryChannel('email'), 'email');
  assert.equal(sanitizeDeliveryChannel('cabinet'), 'cabinet');
  assert.equal(sanitizeDeliveryChannel('yandex_disk'), 'cloud');
  assert.equal(sanitizeDeliveryChannel('google_disk'), 'cloud');
  assert.equal(sanitizeDeliveryChannel('unknown_channel'), 'messenger');

  assert.deepEqual(normalizeDeliveryPreferences('yandex_disk', undefined), {
    channel: 'cloud',
    detail: 'Яндекс Диск',
  });
  assert.deepEqual(normalizeDeliveryPreferences('google_disk', undefined), {
    channel: 'cloud',
    detail: 'Google Диск',
  });
  assert.deepEqual(normalizeDeliveryPreferences('messenger', 'Max'), {
    channel: 'messenger',
    detail: 'Max',
  });
  assert.deepEqual(normalizeDeliveryPreferences('email', 'studio@brand.ru'), {
    channel: 'email',
    detail: 'studio@brand.ru',
  });

  assert.equal(
    resolveDeliveryChannelLabel('messenger', 'WhatsApp'),
    'Мессенджер · WhatsApp'
  );
  assert.equal(
    resolveDeliveryChannelLabel('cloud', 'Dropbox'),
    'Облачное хранилище · Dropbox'
  );
  assert.equal(
    resolveDeliveryChannelLabel('email', 'info@brand.ru'),
    'На почту · info@brand.ru'
  );
  assert.equal(resolveDeliveryChannelLabel('cabinet', ''), 'Личный кабинет');
});

test('buildCanonicalDeliveryDetail, parseDeliveryDetailSelection и validateDeliveryEmail работают корректно', () => {
  assert.equal(
    buildCanonicalDeliveryDetail({ channel: 'messenger', messenger: 'max' }),
    'Max'
  );
  assert.equal(
    buildCanonicalDeliveryDetail({
      channel: 'messenger',
      messenger: 'other',
      messengerOther: 'VK Мессенджер',
    }),
    'VK Мессенджер'
  );
  assert.equal(
    buildCanonicalDeliveryDetail({ channel: 'cloud', cloud: 'google_disk' }),
    'Google Диск'
  );
  assert.equal(
    buildCanonicalDeliveryDetail({ channel: 'email', email: 'promo@company.ru' }),
    'promo@company.ru'
  );

  const parsedMessenger = parseDeliveryDetailSelection('messenger', 'WhatsApp');
  assert.equal(parsedMessenger.messenger, 'whatsapp');

  const parsedCustomCloud = parseDeliveryDetailSelection('cloud', 'Облако Mail');
  assert.equal(parsedCustomCloud.cloud, 'other');
  assert.equal(parsedCustomCloud.cloudOther, 'Облако Mail');

  assert.equal(validateDeliveryEmail('anna@company.ru'), true);
  assert.equal(validateDeliveryEmail('bad-email'), false);
  assert.equal(validateDeliveryEmail(''), false);
});

test('sanitizeCloudDiskUrl разрешает только http/https ссылки и блокирует javascript:', () => {
  assert.equal(
    sanitizeCloudDiskUrl('https://disk.yandex.ru/d/abc123'),
    'https://disk.yandex.ru/d/abc123'
  );
  assert.equal(
    sanitizeCloudDiskUrl('https://drive.google.com/drive/folders/xyz'),
    'https://drive.google.com/drive/folders/xyz'
  );
  assert.equal(sanitizeCloudDiskUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeCloudDiskUrl('not-a-url'), null);
});

test('formatFileSizeReadable форматирует размеры файлов на русском языке', () => {
  assert.equal(formatFileSizeReadable(0), '—');
  assert.equal(formatFileSizeReadable(512), '512 Б');
  assert.equal(formatFileSizeReadable(4096), '4 КБ');
  assert.equal(formatFileSizeReadable(2_621_440), '2,5 МБ');
});

test('mapCrmStageToClientProgress корректно переводит этапы CRM в понятные шаги клиента', () => {
  const step0 = mapCrmStageToClientProgress('new_hold');
  assert.equal(step0.stepIndex, 0);
  assert.equal(step0.badgeLabel, 'Заявка принята');

  const stepReady = mapCrmStageToClientProgress('on_air');
  assert.equal(stepReady.stepIndex, 3);
  assert.equal(stepReady.badgeLabel, 'Готов к выдаче');
  assert.equal(stepReady.steps[3].active, true);

  const stepDone = mapCrmStageToClientProgress('completed_ltv');
  assert.equal(stepDone.stepIndex, 4);
  assert.equal(stepDone.steps[4].done, true);
});

test('matchesOrderLookupVerifier проверяет последние 4 цифры телефона, ИНН или Telegram-ник', () => {
  const contact = '+7 925 310-88-42 · Дмитрий';
  const company = 'АО «ТрансФлот Лизинг» · ИНН 7702070139';

  assert.equal(matchesOrderLookupVerifier(contact, company, '8842'), true);
  assert.equal(matchesOrderLookupVerifier(contact, company, '7702070139'), true);
  assert.equal(matchesOrderLookupVerifier(contact, company, '9999'), false);
  assert.equal(
    matchesOrderLookupVerifier('@med_marketing_dir · Елена', 'ООО «МедЦентр»', '@med_marketing_dir'),
    true
  );
  assert.equal(matchesOrderLookupVerifier(contact, company, '12'), false);
});

test('upsertClientCabinetEntry и removeClientCabinetEntry управляют списком заказов клиента без дублей', () => {
  const storage = createMemoryStorage();
  const list1 = upsertClientCabinetEntry(
    {
      orderNumber: 'FM-2510',
      rescueToken: 'tok-1',
      contactLine: 'Анна +7 916 555-32-10',
      companyLine: 'ООО «Рассвет» · ИНН 7707083893',
    },
    storage
  );
  assert.equal(list1.length, 1);

  const list2 = upsertClientCabinetEntry(
    {
      orderNumber: 'FM-2510',
      rescueToken: 'tok-updated',
      contactLine: 'Анна +7 916 555-32-10',
      companyLine: 'ООО «Рассвет» · ИНН 7707083893',
    },
    storage
  );
  assert.equal(list2.length, 1);
  assert.equal(list2[0].rescueToken, 'tok-updated');

  const afterRemove = removeClientCabinetEntry('FM-2510', storage);
  assert.equal(afterRemove.length, 0);
});
