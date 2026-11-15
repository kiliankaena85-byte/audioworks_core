import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractOrderMasterFiles,
  filterCabinetHistoryOrders,
  resolveCabinetOrderVisualStatus,
} from './clientCabinetArchitecture';
import type {
  ClientCabinetOrderSummary,
  OrderDeliverableFile,
} from './clientCabinetHelpers';
import {
  buildOrderAudioVersionHistory,
  mergeSeedOrderDeliverablesWithVersions,
  resolveUploadedDeliverableVersionMeta,
  sanitizeDeliverableVersionCode,
  suggestNextAudioVersionCode,
} from './deliverableVersioning';
import { createSeedCrmOrders } from './orderCrmTypes';

function makeCabinetOrder(
  overrides: Partial<ClientCabinetOrderSummary> & { orderNumber: string }
): ClientCabinetOrderSummary {
  return {
    rescueToken: `tok-${overrides.orderNumber}`,
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-12T15:00:00.000Z',
    stage: 'on_air',
    formatLabel: 'Продакшн под ключ (15 сек)',
    totalBudgetRub: 25_000,
    contact: '+7 925 310-88-42 · Дмитрий',
    clientEmail: 'director@transflot-leasing.ru',
    companyOrInn: 'АО «ТрансФлот Лизинг» · ИНН 7702070139',
    innVerified: true,
    briefText: 'Лизинг коммерческого транспорта',
    hasVoiceRecording: false,
    voiceDurationSec: 0,
    attachedFileName: null,
    preferredDeliveryChannel: 'cabinet',
    cloudDiskUrl: null,
    deliverables: [],
    clientUploads: [],
    documentMeta: null,
    ...overrides,
  };
}

test('buildOrderAudioVersionHistory: выстраивает цепочку v1 -> v2 -> master и выделяет финальный мастер', () => {
  const deliverables: OrderDeliverableFile[] = [
    {
      id: 'd-master',
      title: 'Финальный эфирный мастер',
      kind: 'audio_master',
      fileName: 'spot_master.wav',
      mimeType: 'audio/wav',
      sizeBytes: 2_650_000,
      uploadedAt: '2026-11-12T18:00:00.000Z',
      versionCode: 'master',
      versionStage: 'master',
      versionNote: 'Утверждённый мастер −14 LUFS',
    },
    {
      id: 'd-v2',
      title: 'Итерация v2 — правка концовки',
      kind: 'audio_master',
      fileName: 'spot_v2.wav',
      mimeType: 'audio/wav',
      sizeBytes: 2_610_000,
      uploadedAt: '2026-11-12T14:00:00.000Z',
      versionCode: 'v2',
      versionStage: 'revision',
      versionNote: 'Усилена пауза перед оффером',
    },
    {
      id: 'd-v1',
      title: 'Итерация v1 — черновой дубль',
      kind: 'audio_master',
      fileName: 'spot_v1.wav',
      mimeType: 'audio/wav',
      sizeBytes: 2_580_000,
      uploadedAt: '2026-11-12T10:00:00.000Z',
      versionCode: 'v1',
      versionStage: 'draft',
      versionNote: 'Первая запись баритона',
    },
    {
      id: 'd-passport',
      title: 'Паспорт прав',
      kind: 'passport',
      fileName: 'passport.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 140_000,
      uploadedAt: '2026-11-12T18:05:00.000Z',
    },
  ];

  const order = makeCabinetOrder({
    orderNumber: 'FM-HOLD-2854',
    deliverables,
  });

  const history = buildOrderAudioVersionHistory(order);
  assert.equal(history.hasAudioVersions, true);
  assert.equal(history.totalVersionsCount, 3);
  assert.equal(history.hasFinalMaster, true);
  assert.equal(history.progressionChainText, 'v1 → v2 → master');
  assert.deepEqual(
    history.versionsChronological.map((v) => v.versionCode),
    ['v1', 'v2', 'master']
  );
  assert.deepEqual(
    history.versionsNewestFirst.map((v) => v.versionCode),
    ['master', 'v2', 'v1']
  );
  assert.equal(history.latestVersion?.versionCode, 'master');
  assert.equal(history.latestVersion?.isFinalMaster, true);
  assert.equal(history.latestVersion?.isCurrentLatest, true);
  assert.equal(history.previousVersions.length, 2);

  // extractOrderMasterFiles возвращает только финальный мастер (1) и PDF-документы (1), не смешивая v1/v2 с документами
  const extracted = extractOrderMasterFiles(order);
  assert.deepEqual(
    extracted.masterFiles.map((f) => f.id),
    ['d-master']
  );
  assert.deepEqual(
    extracted.supplementaryFiles.map((f) => f.id),
    ['d-passport']
  );
});

test('Заказ на согласовании с версиями v1 и v2 без master остаётся в статусе «На согласовании» и выделяет v2 как актуальную', () => {
  const reviewOrder = makeCabinetOrder({
    orderNumber: 'FM-2926',
    stage: 'in_production',
    deliverables: [
      {
        id: 'd-2926-v1',
        title: 'Версия v1 — первая читка',
        kind: 'audio_master',
        fileName: 'reefer_v1.wav',
        mimeType: 'audio/wav',
        sizeBytes: 2_800_000,
        uploadedAt: '2026-11-13T10:00:00.000Z',
        versionCode: 'v1',
        versionStage: 'draft',
        versionNote: 'Черновой вариант подачи',
      },
      {
        id: 'd-2926-v2',
        title: 'Версия v2 — обновлённый темп',
        kind: 'audio_master',
        fileName: 'reefer_v2.wav',
        mimeType: 'audio/wav',
        sizeBytes: 2_760_000,
        uploadedAt: '2026-11-13T14:30:00.000Z',
        versionCode: 'v2',
        versionStage: 'revision',
        versionNote: 'Ускорен старт и сокращён хронометраж до 30 сек',
      },
    ],
  });

  const history = buildOrderAudioVersionHistory(reviewOrder);
  assert.equal(history.hasFinalMaster, false);
  assert.equal(history.progressionChainText, 'v1 → v2');
  assert.equal(history.latestVersion?.versionCode, 'v2');
  assert.equal(history.latestVersion?.isFinalMaster, false);
  assert.equal(history.latestVersion?.isCurrentLatest, true);
  assert.equal(history.previousVersions.length, 1);
  assert.equal(history.previousVersions[0].versionCode, 'v1');

  const visualStatus = resolveCabinetOrderVisualStatus(reviewOrder);
  assert.equal(visualStatus.statusId, 'in_review');
  assert.equal(visualStatus.label, 'На согласовании');

  // Поиск в «Истории заказов» находит проект по коду итерации 'v2' и по тексту versionNote
  assert.deepEqual(
    filterCabinetHistoryOrders([reviewOrder], { searchQuery: 'v2' }).map(
      (o) => o.orderNumber
    ),
    ['FM-2926']
  );
  assert.deepEqual(
    filterCabinetHistoryOrders([reviewOrder], {
      searchQuery: 'ускорен старт',
    }).map((o) => o.orderNumber),
    ['FM-2926']
  );
});

test('suggestNextAudioVersionCode и resolveUploadedDeliverableVersionMeta корректно нумеруют новые загрузки из CRM', () => {
  assert.equal(sanitizeDeliverableVersionCode('V1'), 'v1');
  assert.equal(sanitizeDeliverableVersionCode('2'), 'v2');
  assert.equal(sanitizeDeliverableVersionCode('Финал'), 'master');
  assert.equal(sanitizeDeliverableVersionCode('<script>'), undefined);

  assert.equal(suggestNextAudioVersionCode([]), 'v1');

  const firstMeta = resolveUploadedDeliverableVersionMeta({
    kind: 'audio_master',
    mimeType: 'audio/wav',
    requestedVersionCode: 'auto',
    requestedVersionNote: '  Черновой дубль баритона  ',
    existingDeliverables: [],
  });
  assert.deepEqual(firstMeta, {
    versionCode: 'v1',
    versionStage: 'draft',
    versionNote: 'Черновой дубль баритона',
  });

  const existingV1: OrderDeliverableFile = {
    id: 'deliv-1',
    title: 'Дубль 1',
    kind: 'audio_master',
    fileName: 'take_v1.wav',
    mimeType: 'audio/wav',
    sizeBytes: 2_500_000,
    uploadedAt: '2026-11-14T10:00:00.000Z',
    versionCode: 'v1',
    versionStage: 'draft',
  };

  assert.equal(suggestNextAudioVersionCode([existingV1]), 'v2');

  const secondMeta = resolveUploadedDeliverableVersionMeta({
    kind: 'audio_master',
    mimeType: 'audio/wav',
    requestedVersionCode: 'auto',
    existingDeliverables: [existingV1],
  });
  assert.deepEqual(secondMeta, {
    versionCode: 'v2',
    versionStage: 'revision',
  });

  const masterMeta = resolveUploadedDeliverableVersionMeta({
    kind: 'audio_master',
    mimeType: 'audio/wav',
    requestedVersionCode: 'master',
    requestedVersionNote: 'Финальное сведение −14 LUFS',
    existingDeliverables: [existingV1],
  });
  assert.deepEqual(masterMeta, {
    versionCode: 'master',
    versionStage: 'master',
    versionNote: 'Финальное сведение −14 LUFS',
  });
});

test('mergeSeedOrderDeliverablesWithVersions обновляет старые неразмеченные seed-файлы, сохраняя загрузки продюсера', () => {
  const oldPersisted: OrderDeliverableFile[] = [
    {
      id: 'deliv-custom-producer-99',
      title: 'Доп. версия продюсера',
      kind: 'audio_master',
      fileName: 'custom.wav',
      mimeType: 'audio/wav',
      sizeBytes: 2_400_000,
      uploadedAt: '2026-11-14T11:00:00.000Z',
      storageKey: 'FM-HOLD-2854_custom.wav',
    },
    {
      id: 'deliv-seed-2854-master',
      title: 'Старый мастер без versionCode',
      kind: 'audio_master',
      fileName: 'old_master.wav',
      mimeType: 'audio/wav',
      sizeBytes: 2_648_000,
      uploadedAt: '2026-11-12T10:00:00.000Z',
      staticAssetUrl: 'zerno_audioworks_15.wav',
    },
  ];

  const seeds = createSeedCrmOrders();
  const seed2854 = seeds.find((s) => s.orderNumber === 'FM-HOLD-2854');
  assert.ok(seed2854);

  const migrated = mergeSeedOrderDeliverablesWithVersions(
    oldPersisted,
    seed2854.deliverables
  );
  assert.equal(migrated[0].id, 'deliv-custom-producer-99');
  assert.deepEqual(
    migrated.slice(1).map((d) => d.versionCode),
    ['master', 'v2', 'v1']
  );

  // Повторный вызов идемпотентен и не дублирует элементы
  const secondPass = mergeSeedOrderDeliverablesWithVersions(
    migrated,
    seed2854.deliverables
  );
  assert.equal(secondPass.length, migrated.length);
});
