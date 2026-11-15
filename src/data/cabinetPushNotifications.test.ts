import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDeliverableUploadedNotification,
  buildStageChangedNotification,
  buildTestCabinetPushNotification,
  countUnreadNotifications,
  createDefaultClientNotificationPreferences,
  createSeedCabinetNotifications,
  filterCabinetNotificationViewItems,
  filterNotificationsForAccessibleOrders,
  hydrateCabinetNotifications,
  markNotificationsReadInPreferences,
  mergeNotificationEventIdempotently,
  sanitizeCabinetNotificationItem,
  sanitizeClientNotificationPreferences,
} from './cabinetPushNotifications';
import { BANNED_EDITORIAL_TERMS } from './studioCmsTypes';

test('buildStageChangedNotification formats readable stage transition for client cabinet', () => {
  const notif = buildStageChangedNotification({
    id: 'notif-stage-1',
    orderNumber: 'FM-2948',
    previousStage: 'edo_invoice',
    nextStage: 'in_production',
    formatLabel: 'Продакшн под ключ (20 сек)',
    createdAt: '2026-11-14T12:00:00.000Z',
  });

  assert.equal(notif.kind, 'order_stage_changed');
  assert.equal(notif.orderNumber, 'FM-2948');
  assert.equal(notif.previousStage, 'edo_invoice');
  assert.equal(notif.nextStage, 'in_production');
  assert.match(notif.title, /FM-2948/);
  assert.match(notif.body, /Счёт выставлен/);
  assert.match(notif.body, /В работе/);
});

test('buildDeliverableUploadedNotification distinguishes v1/v2 revisions, master audio, and non-audio files', () => {
  const v2Notif = buildDeliverableUploadedNotification({
    id: 'notif-v2',
    orderNumber: 'FM-2926',
    deliverable: {
      id: 'deliv-v2',
      title: 'Итерация v2 — правка паузы',
      kind: 'audio_master',
      fileName: 'spot_v2.wav',
      mimeType: 'audio/wav',
      sizeBytes: 2_500_000,
      uploadedAt: '2026-11-14T13:00:00.000Z',
      versionCode: 'v2',
      versionStage: 'revision',
      versionNote: 'Уплотнён финал и акцент на оффере',
    },
  });

  assert.equal(v2Notif.kind, 'audio_version_uploaded');
  assert.equal(v2Notif.versionCode, 'v2');
  assert.equal(v2Notif.versionStage, 'revision');
  assert.match(v2Notif.title, /версия v2/i);
  assert.match(v2Notif.body, /Уплотнён финал/);

  const masterNotif = buildDeliverableUploadedNotification({
    id: 'notif-master',
    orderNumber: 'FM-HOLD-2854',
    deliverable: {
      id: 'deliv-master',
      title: 'Финальный мастер-файл',
      kind: 'audio_master',
      fileName: 'spot_master.wav',
      mimeType: 'audio/wav',
      sizeBytes: 2_600_000,
      uploadedAt: '2026-11-14T14:00:00.000Z',
      versionCode: 'master',
      versionStage: 'master',
    },
  });

  assert.equal(masterNotif.kind, 'audio_version_uploaded');
  assert.equal(masterNotif.versionCode, 'master');
  assert.equal(masterNotif.versionStage, 'master');
  assert.match(masterNotif.title, /финальный мастер/i);

  const passportNotif = buildDeliverableUploadedNotification({
    id: 'notif-doc',
    orderNumber: 'FM-HOLD-2854',
    deliverable: {
      id: 'deliv-doc',
      title: 'Лицензионный паспорт прав',
      kind: 'passport',
      fileName: 'passport.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 420_000,
      uploadedAt: '2026-11-14T14:05:00.000Z',
    },
  });

  assert.equal(passportNotif.kind, 'deliverable_uploaded');
  assert.equal(passportNotif.deliverableKind, 'passport');
  assert.equal(passportNotif.versionCode, undefined);
});

test('filterNotificationsForAccessibleOrders enforces strict cryptographic order isolation', () => {
  const seeds = createSeedCabinetNotifications(Date.parse('2026-11-14T15:00:00.000Z'));
  const prefs = createDefaultClientNotificationPreferences(
    'email:director@transflot-leasing.ru',
    '2026-11-14T15:00:00.000Z'
  );

  // Клиент АО «ТрансФлот Лизинг» видит только свои заказы и никогда не видит чужой FM-HOLD-2914
  const visible = filterNotificationsForAccessibleOrders({
    allNotifications: seeds,
    accessibleOrderNumbers: ['FM-2948', 'FM-2926', 'FM-HOLD-2854', 'FM-2418'],
    preferences: prefs,
  });

  assert.ok(visible.length >= 4);
  assert.equal(
    visible.some((item) => item.orderNumber === 'FM-HOLD-2914'),
    false
  );
  assert.equal(countUnreadNotifications(visible), visible.length);

  // Пустой список доступных заказов возвращает строго 0 уведомлений
  const none = filterNotificationsForAccessibleOrders({
    allNotifications: seeds,
    accessibleOrderNumbers: [],
    preferences: prefs,
  });
  assert.equal(none.length, 0);
});

test('preferences channel toggles, filter tabs, and mark-read state transitions work deterministically', () => {
  const seeds = createSeedCabinetNotifications(Date.parse('2026-11-14T15:00:00.000Z'));
  const basePrefs = sanitizeClientNotificationPreferences({
    subjectKey: 'email:director@transflot-leasing.ru',
    browserPushEnabled: true,
    notifyOnStageChange: false,
    notifyOnNewVersion: true,
    pushEndpoint: 'https://push.example/sub/123',
  });

  // При отключённом notifyOnStageChange остаются только уведомления о версиях/файлах
  const versionsOnlyByPref = filterNotificationsForAccessibleOrders({
    allNotifications: seeds,
    accessibleOrderNumbers: ['FM-2948', 'FM-2926', 'FM-HOLD-2854'],
    preferences: basePrefs,
  });
  assert.ok(versionsOnlyByPref.length >= 2);
  assert.equal(
    versionsOnlyByPref.every((n) => n.kind !== 'order_stage_changed'),
    true
  );

  // Тестовый push проходит даже если оба канальных чекбокса выключены
  const testPush = buildTestCabinetPushNotification({
    id: 'notif-test-1',
    orderNumber: 'FM-2926',
    createdAt: '2026-11-14T15:05:00.000Z',
  });
  const mutedPrefs = sanitizeClientNotificationPreferences({
    ...basePrefs,
    notifyOnStageChange: false,
    notifyOnNewVersion: false,
  });
  const withTest = filterNotificationsForAccessibleOrders({
    allNotifications: mergeNotificationEventIdempotently(seeds, testPush),
    accessibleOrderNumbers: ['FM-2926'],
    preferences: mutedPrefs,
  });
  assert.equal(withTest.length, 1);
  assert.equal(withTest[0].id, 'notif-test-1');

  // Отметка одного уведомления прочитанным и отметка всех прочитанными
  const fullPrefs = createDefaultClientNotificationPreferences(
    'email:director@transflot-leasing.ru',
    '2026-11-14T15:00:00.000Z'
  );
  const allItems = filterNotificationsForAccessibleOrders({
    allNotifications: seeds,
    accessibleOrderNumbers: ['FM-2948', 'FM-2926', 'FM-HOLD-2854'],
    preferences: fullPrefs,
  });
  assert.equal(filterCabinetNotificationViewItems(allItems, 'versions').length, 2);
  assert.equal(filterCabinetNotificationViewItems(allItems, 'stages').length, 2);

  const afterSingleRead = markNotificationsReadInPreferences(fullPrefs, {
    notificationIds: [allItems[0].id],
    nowIso: '2026-11-14T15:01:00.000Z',
  });
  const afterSingleView = filterNotificationsForAccessibleOrders({
    allNotifications: seeds,
    accessibleOrderNumbers: ['FM-2948', 'FM-2926', 'FM-HOLD-2854'],
    preferences: afterSingleRead,
  });
  assert.equal(countUnreadNotifications(afterSingleView), allItems.length - 1);
  assert.equal(
    filterCabinetNotificationViewItems(afterSingleView, 'unread').length,
    allItems.length - 1
  );

  const afterMarkAll = markNotificationsReadInPreferences(afterSingleRead, {
    markAll: true,
    nowIso: '2026-11-14T15:02:00.000Z',
  });
  const afterAllView = filterNotificationsForAccessibleOrders({
    allNotifications: seeds,
    accessibleOrderNumbers: ['FM-2948', 'FM-2926', 'FM-HOLD-2854'],
    preferences: afterMarkAll,
  });
  assert.equal(countUnreadNotifications(afterAllView), 0);
});

test('mergeNotificationEventIdempotently and hydrateCabinetNotifications prevent duplicates and sanitize untrusted input', () => {
  const hydrated = hydrateCabinetNotifications(
    [
      {
        id: 'custom-notif-1',
        orderNumber: 'FM-2948',
        kind: 'audio_version_uploaded',
        title: 'Заказ #FM-2948: загружена версия v1',
        body: 'Доступен первый дубль диктора.',
        createdAt: '2026-11-14T16:00:00.000Z',
        versionCode: 'v1',
        versionStage: 'draft',
      },
      { id: '', broken: true },
    ],
    Date.parse('2026-11-14T15:00:00.000Z')
  );

  assert.equal(hydrated[0].id, 'custom-notif-1');
  const duplicateMerged = mergeNotificationEventIdempotently(
    hydrated,
    hydrated[0]
  );
  assert.equal(duplicateMerged.length, hydrated.length);
  assert.equal(sanitizeCabinetNotificationItem(null), null);
});

test('generated notification copy contains zero banned editorial terms or regional toponyms', () => {
  const nowMs = Date.parse('2026-11-14T15:00:00.000Z');
  const seeds = createSeedCabinetNotifications(nowMs);
  const sampleStage = buildStageChangedNotification({
    id: 'chk-1',
    orderNumber: 'FM-2948',
    previousStage: 'new_hold',
    nextStage: 'on_air',
  });
  const sampleAudio = buildDeliverableUploadedNotification({
    id: 'chk-2',
    orderNumber: 'FM-2926',
    deliverable: {
      id: 'd-1',
      title: 'Версия v1',
      kind: 'audio_master',
      fileName: 'spot_v1.wav',
      mimeType: 'audio/wav',
      sizeBytes: 1_024_000,
      uploadedAt: '2026-11-14T15:00:00.000Z',
      versionCode: 'v1',
      versionStage: 'draft',
    },
  });

  const combinedLower = JSON.stringify([
    ...seeds,
    sampleStage,
    sampleAudio,
  ]).toLowerCase();

  for (const banned of BANNED_EDITORIAL_TERMS) {
    assert.equal(
      combinedLower.includes(banned.toLowerCase()),
      false,
      `Found banned editorial term "${banned}" in cabinet push notification copy`
    );
  }
});
