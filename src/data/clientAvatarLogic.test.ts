import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  createSeedClientAccounts,
  sanitizeClientAccountRecord,
  toClientAccountPublicProfile,
  upsertClientAccountRecord,
} from './clientAuthCore.ts';
import {
  CLIENT_ABSTRACT_AVATAR_PRESETS,
  deriveClientInitials,
  pickClientAbstractAvatarPreset,
  resolveClientAvatarModel,
  sanitizeClientAvatarPresetId,
  sanitizeClientAvatarUrl,
} from './clientAvatarLogic.ts';

test('deriveClientInitials корректно извлекает инициалы из ФИО, контактов, компании и e-mail', () => {
  assert.equal(
    deriveClientInitials({
      displayName: 'Алексей Соколов',
    }),
    'АС'
  );

  // Демо-клиент кабинета: скобочное примечание и ОПФ «АО» отсекаются -> Имя + Бренд («ДТ»)
  assert.equal(
    deriveClientInitials({
      displayName: 'Дмитрий (отдел лизинга)',
      companyOrInn: 'АО «ТрансФлот Лизинг» · ИНН 7702070139',
      email: 'director@transflot-leasing.ru',
    }),
    'ДТ'
  );

  // Контактная строка с телефоном, почтой и Telegram
  assert.equal(
    deriveClientInitials({
      contactLine: 'Анна Морозова +7 (916) 555-32-10 @anna_m anna@company.ru',
    }),
    'АМ'
  );

  // Только название организации с ОПФ и ИНН
  assert.equal(
    deriveClientInitials({
      companyOrInn: 'ООО «СеверСтрой Девелопмент» · ИНН 7701234567',
    }),
    'СД'
  );

  // Только e-mail клиента
  assert.equal(
    deriveClientInitials({
      email: 'ivan.petrov@company.ru',
    }),
    'IP'
  );

  assert.equal(
    deriveClientInitials({
      email: 'director@transflot-leasing.ru',
    }),
    'DT'
  );

  // Пустой ввод — безопасный дефолт «КЛ»
  assert.equal(deriveClientInitials({}), 'КЛ');
});

test('все сгенерированные студийные абстрактные аватары существуют на диске вместе с .webp версиями', () => {
  assert.ok(CLIENT_ABSTRACT_AVATAR_PRESETS.length >= 4);

  for (const preset of CLIENT_ABSTRACT_AVATAR_PRESETS) {
    const jpgRel = preset.imageUrl.replace(/^\//, '');
    const jpgAbs = path.resolve(process.cwd(), jpgRel);
    assert.equal(
      fs.existsSync(jpgAbs),
      true,
      `Отсутствует файл абстрактного аватара ${preset.imageUrl}`
    );
    assert.ok(fs.statSync(jpgAbs).size > 1024);

    assert.ok(preset.webpUrl, `Ожидался webpUrl для пресета ${preset.id}`);
    const webpAbs = path.resolve(process.cwd(), preset.webpUrl.replace(/^\//, ''));
    assert.equal(
      fs.existsSync(webpAbs),
      true,
      `Отсутствует WebP-версия абстрактного аватара ${preset.webpUrl}`
    );
    assert.ok(fs.statSync(webpAbs).size > 512);
  }
});

test('resolveClientAvatarModel использует абстрактный аватар при отсутствии фото и переключается на фото профиля при загрузке', () => {
  const seedAccount = createSeedClientAccounts()[0];
  const defaultModel = resolveClientAvatarModel({
    displayName: seedAccount.displayName,
    companyOrInn: seedAccount.defaultCompanyOrInn,
    email: seedAccount.email,
    avatarUrl: seedAccount.avatarUrl,
    avatarPresetId: seedAccount.avatarPresetId,
  });

  assert.equal(defaultModel.hasCustomPhoto, false);
  assert.equal(defaultModel.customPhotoUrl, null);
  assert.equal(defaultModel.initials, 'ДТ');

  // Детерминированный выбор одного и того же стиля для одного клиента
  const repeatedModel = resolveClientAvatarModel({
    displayName: seedAccount.displayName,
    companyOrInn: seedAccount.defaultCompanyOrInn,
    email: seedAccount.email,
  });
  assert.equal(defaultModel.preset.id, repeatedModel.preset.id);

  // Явный выбор другого абстрактного пресета
  const explicitPreset = pickClientAbstractAvatarPreset(
    'ДТ',
    seedAccount.email,
    'emerald_stone'
  );
  assert.equal(explicitPreset.id, 'emerald_stone');

  // Когда загружено проверенное фото профиля
  const withPhotoModel = resolveClientAvatarModel({
    displayName: seedAccount.displayName,
    companyOrInn: seedAccount.defaultCompanyOrInn,
    email: seedAccount.email,
    avatarUrl: '/assets/cms/client-avatar-ab12cd34ef-1794695850000.png',
  });
  assert.equal(withPhotoModel.hasCustomPhoto, true);
  assert.equal(
    withPhotoModel.customPhotoUrl,
    '/assets/cms/client-avatar-ab12cd34ef-1794695850000.png'
  );
  assert.equal(
    withPhotoModel.customPhotoWebpUrl,
    '/assets/cms/client-avatar-ab12cd34ef-1794695850000.webp'
  );
});

test('sanitizeClientAvatarUrl и sanitizeClientAvatarPresetId отсекают небезопасные пути', () => {
  assert.equal(sanitizeClientAvatarUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeClientAvatarUrl('https://evil.example.com/avatar.jpg'), null);
  assert.equal(sanitizeClientAvatarUrl('/assets/cms/../secret.jpg'), null);
  assert.equal(sanitizeClientAvatarUrl('/assets/cms/script.svg'), null);
  assert.equal(
    sanitizeClientAvatarUrl('/assets/cms/client-avatar-123.webp'),
    '/assets/cms/client-avatar-123.webp'
  );

  assert.equal(sanitizeClientAvatarPresetId('unknown_style'), null);
  assert.equal(sanitizeClientAvatarPresetId('titanium_diffuser'), 'titanium_diffuser');
});

test('upsertClientAccountRecord сохраняет и сбрасывает avatarUrl и avatarPresetId в профиле клиента', () => {
  const initial = createSeedClientAccounts();
  const withPhoto = upsertClientAccountRecord(initial, {
    email: initial[0].email,
    avatarUrl: '/assets/cms/client-avatar-demo-100.jpg',
    avatarPresetId: 'slate_acoustic',
  });

  assert.equal(
    withPhoto.account.avatarUrl,
    '/assets/cms/client-avatar-demo-100.jpg'
  );
  assert.equal(withPhoto.account.avatarPresetId, 'slate_acoustic');

  const sanitized = sanitizeClientAccountRecord(withPhoto.account);
  assert.ok(sanitized);
  assert.equal(sanitized.avatarUrl, '/assets/cms/client-avatar-demo-100.jpg');
  assert.equal(sanitized.avatarPresetId, 'slate_acoustic');

  const publicProfile = toClientAccountPublicProfile(sanitized, 5);
  assert.equal(
    publicProfile.avatarUrl,
    '/assets/cms/client-avatar-demo-100.jpg'
  );
  assert.equal(publicProfile.avatarPresetId, 'slate_acoustic');

  // Удаление фото возвращает avatarUrl в null, сохраняя выбранный пресет абстрактного аватара
  const clearedPhoto = upsertClientAccountRecord(withPhoto.accounts, {
    email: initial[0].email,
    avatarUrl: null,
  });
  assert.equal(clearedPhoto.account.avatarUrl, null);
  assert.equal(clearedPhoto.account.avatarPresetId, 'slate_acoustic');
});
