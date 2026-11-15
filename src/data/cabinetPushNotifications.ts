import type {
  DeliverableVersionStage,
  OrderDeliverableFile,
  OrderDeliverableKind,
} from './clientCabinetHelpers.ts';
import {
  DELIVERABLE_VERSION_STAGE_LABELS,
  isAudioSpotDeliverable,
  resolveDeliverableVersionStage,
  sanitizeDeliverableVersionCode,
  sanitizeDeliverableVersionNote,
} from './deliverableVersioning.ts';
import type { CrmOrderStage } from './orderCrmTypes.ts';

export type CabinetNotificationKind =
  | 'order_stage_changed'
  | 'audio_version_uploaded'
  | 'deliverable_uploaded';

export type CabinetNotificationFilterTab =
  | 'all'
  | 'unread'
  | 'versions'
  | 'stages';

export interface CabinetNotificationItem {
  id: string;
  orderNumber: string;
  kind: CabinetNotificationKind;
  title: string;
  body: string;
  createdAt: string;
  /** Для событий смены этапа заказа */
  previousStage?: CrmOrderStage;
  nextStage?: CrmOrderStage;
  stageClientLabel?: string;
  /** Для событий загрузки новой версии аудиоролика или документа */
  deliverableId?: string;
  deliverableKind?: OrderDeliverableKind;
  versionCode?: string;
  versionStage?: DeliverableVersionStage;
  versionNote?: string;
  /** Является ли уведомление проверкой доставки */
  isTestPush?: boolean;
}

export interface ClientNotificationPreferences {
  subjectKey: string;
  browserPushEnabled: boolean;
  notifyOnStageChange: boolean;
  notifyOnNewVersion: boolean;
  readNotificationIds: string[];
  lastReadAllAt: string | null;
  pushEndpoint: string | null;
  updatedAt: string;
}

export interface CabinetNotificationViewItem extends CabinetNotificationItem {
  isRead: boolean;
}

const CLIENT_STAGE_DISPLAY_LABELS: Readonly<
  Record<
    CrmOrderStage,
    {
      badgeLabel: string;
      headline: string;
      description: string;
    }
  >
> = {
  new_hold: {
    badgeLabel: 'Проверка заявки',
    headline: 'Заявка принята в работу',
    description:
      'Продюсер проверяет задачу, реквизиты и формирует параметры заказа.',
  },
  quota_locked: {
    badgeLabel: 'На согласовании',
    headline: 'Параметры заказа и ТЗ на согласовании',
    description:
      'Задача проверена продюсером — ознакомьтесь с деталями проекта и счётом в кабинете.',
  },
  edo_invoice: {
    badgeLabel: 'Счёт выставлен',
    headline: 'Счёт и договор готовы к оплате',
    description:
      'Счёт доступен для скачивания в личном кабинете и направлен по выбранному каналу ЭДО.',
  },
  in_production: {
    badgeLabel: 'В работе · Запись и продакшн',
    headline: 'Проект передан в студийное производство',
    description:
      'Идёт разработка сценариев, запись диктора и сведение ролика по стандарту −14 LUFS.',
  },
  on_air: {
    badgeLabel: 'Готово · Мастер передан',
    headline: 'Финальный мастер-ролик готов к скачиванию',
    description:
      'Утверждённый WAV/MP3 мастер-файл и паспорт прав доступны в карточке вашего заказа.',
  },
  completed_ltv: {
    badgeLabel: 'Готово · Закрыт в ЭДО',
    headline: 'Проект завершён, права переданы бессрочно',
    description:
      'Закрывающие документы оформлены, все версии ролика и мастер-файлы сохранены в архиве кабинета.',
  },
};

const DELIVERABLE_KIND_LABELS: Readonly<Record<OrderDeliverableKind, string>> = {
  audio_master: 'Аудиоролик',
  script: 'Сценарий',
  invoice: 'Счёт / спецификация',
  passport: 'Паспорт прав РАО/ВОИС',
  archive: 'Архив проекта',
};

export function getClientStageNotificationMeta(stage: CrmOrderStage): {
  badgeLabel: string;
  headline: string;
  description: string;
} {
  return (
    CLIENT_STAGE_DISPLAY_LABELS[stage] ?? CLIENT_STAGE_DISPLAY_LABELS.new_hold
  );
}

/**
 * Формирует серверное push-уведомление при смене этапа заказа продюсером в CRM.
 */
export function buildStageChangedNotification(params: {
  id: string;
  orderNumber: string;
  previousStage: CrmOrderStage;
  nextStage: CrmOrderStage;
  formatLabel?: string;
  createdAt?: string;
}): CabinetNotificationItem {
  const createdAt = params.createdAt ?? new Date().toISOString();
  const nextMeta = getClientStageNotificationMeta(params.nextStage);
  const prevMeta = getClientStageNotificationMeta(params.previousStage);
  const formatSuffix = params.formatLabel?.trim()
    ? ` (${params.formatLabel.trim().slice(0, 80)})`
    : '';

  return {
    id: params.id,
    orderNumber: params.orderNumber,
    kind: 'order_stage_changed',
    title: `Заказ #${params.orderNumber}: ${nextMeta.headline}`,
    body: `Статус изменился: «${prevMeta.badgeLabel}» → «${nextMeta.badgeLabel}»${formatSuffix}. ${nextMeta.description}`,
    createdAt,
    previousStage: params.previousStage,
    nextStage: params.nextStage,
    stageClientLabel: nextMeta.badgeLabel,
  };
}

/**
 * Формирует серверное push-уведомление при загрузке новой версии аудиоролика (v1, v2, master)
 * или сопутствующего документа к заказу.
 */
export function buildDeliverableUploadedNotification(params: {
  id: string;
  orderNumber: string;
  deliverable: OrderDeliverableFile;
  createdAt?: string;
}): CabinetNotificationItem {
  const { deliverable } = params;
  const createdAt =
    params.createdAt ?? deliverable.uploadedAt ?? new Date().toISOString();
  const isAudio = isAudioSpotDeliverable(deliverable);

  if (isAudio) {
    const versionStage = resolveDeliverableVersionStage(deliverable);
    const versionCode =
      sanitizeDeliverableVersionCode(deliverable.versionCode) ??
      (versionStage === 'master' ? 'master' : 'v1');
    const stageLabel = DELIVERABLE_VERSION_STAGE_LABELS[versionStage];
    const cleanNote = sanitizeDeliverableVersionNote(deliverable.versionNote);

    const isMaster = versionStage === 'master' || versionCode === 'master';
    const title = isMaster
      ? `Заказ #${params.orderNumber}: готов финальный мастер (${versionCode})`
      : `Заказ #${params.orderNumber}: загружена версия ${versionCode} (${stageLabel.toLowerCase()})`;

    const body = cleanNote
      ? `${deliverable.title} — ${cleanNote}. Прослушайте и скачайте файл в личном кабинете.`
      : isMaster
        ? `Финальный эфирный ролик «${deliverable.title}» готов к прослушиванию и скачиванию в истории версий.`
        : `Доступна новая итерация аудиоролика «${deliverable.title}» (${versionCode}) для прослушивания и согласования.`;

    return {
      id: params.id,
      orderNumber: params.orderNumber,
      kind: 'audio_version_uploaded',
      title,
      body,
      createdAt,
      deliverableId: deliverable.id,
      deliverableKind: deliverable.kind,
      versionCode,
      versionStage,
      ...(cleanNote ? { versionNote: cleanNote } : {}),
    };
  }

  const kindLabel =
    DELIVERABLE_KIND_LABELS[deliverable.kind] ?? 'Материал по заказу';
  const cleanNote = sanitizeDeliverableVersionNote(deliverable.versionNote);

  return {
    id: params.id,
    orderNumber: params.orderNumber,
    kind: 'deliverable_uploaded',
    title: `Заказ #${params.orderNumber}: добавлен документ «${kindLabel}»`,
    body: cleanNote
      ? `${deliverable.title} — ${cleanNote}.`
      : `В карточке заказа доступен новый файл «${deliverable.title}» (${deliverable.fileName}).`,
    createdAt,
    deliverableId: deliverable.id,
    deliverableKind: deliverable.kind,
    ...(cleanNote ? { versionNote: cleanNote } : {}),
  };
}

/**
 * Формирует проверочное push-уведомление для теста доставки в реальном времени.
 */
export function buildTestCabinetPushNotification(params: {
  id: string;
  orderNumber: string;
  createdAt?: string;
}): CabinetNotificationItem {
  const createdAt = params.createdAt ?? new Date().toISOString();
  return {
    id: params.id,
    orderNumber: params.orderNumber,
    kind: 'order_stage_changed',
    title: `Проверка push-канала · заказ #${params.orderNumber}`,
    body: 'Канал мгновенных оповещений активен: вы будете получать сигналы о смене статуса и загрузке новых версий (v1, v2, master).',
    createdAt,
    isTestPush: true,
  };
}

/**
 * Формирует мгновенное push-уведомление для пошагового конвейера согласования:
 * публикация режиссёрского сценария, решение продюсера или подтверждение приёмки.
 */
export function buildApprovalWorkflowNotification(params: {
  id: string;
  orderNumber: string;
  title: string;
  body: string;
  createdAt?: string;
}): CabinetNotificationItem {
  return {
    id: params.id,
    orderNumber: params.orderNumber,
    kind: 'order_stage_changed',
    title: params.title.slice(0, 160),
    body: params.body.slice(0, 420),
    createdAt: params.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Создаёт стартовые демонстрационные уведомления, синхронизированные с seed-заказами CRM,
 * чтобы история оповещений в кабинете работала сразу при входе по демо-аккаунту.
 */
export function createSeedCabinetNotifications(
  nowMs = Date.now()
): CabinetNotificationItem[] {
  const isoAt = (offsetMin: number) =>
    new Date(nowMs + offsetMin * 60_000).toISOString();

  return [
    {
      id: 'notif-seed-2948-stage-prod',
      orderNumber: 'FM-2948',
      kind: 'order_stage_changed',
      title: 'Заказ #FM-2948: Проект передан в студийное производство',
      body: 'Статус изменился: «Счёт выставлен» → «В работе · Запись и продакшн» (Продакшн под ключ 20 сек). Идёт запись диктора и сборка саунд-дизайна −14 LUFS.',
      createdAt: isoAt(-65),
      previousStage: 'edo_invoice',
      nextStage: 'in_production',
      stageClientLabel: 'В работе · Запись и продакшн',
    },
    {
      id: 'notif-seed-2926-version-v2',
      orderNumber: 'FM-2926',
      kind: 'audio_version_uploaded',
      title: 'Заказ #FM-2926: загружена версия v2 (правка)',
      body: 'Версия v2 — обновлённый демо-дубль на согласование — Ускорен старт диалога, финал уложен ровно в 30 сек — ждём утверждения перед мастерингом. Прослушайте и скачайте файл в личном кабинете.',
      createdAt: isoAt(-215),
      deliverableId: 'deliv-seed-2926-v2',
      deliverableKind: 'audio_master',
      versionCode: 'v2',
      versionStage: 'revision',
      versionNote:
        'Ускорен старт диалога, финал уложен ровно в 30 сек — ждём утверждения перед мастерингом',
    },
    {
      id: 'notif-seed-2854-stage-onair',
      orderNumber: 'FM-HOLD-2854',
      kind: 'order_stage_changed',
      title: 'Заказ #FM-HOLD-2854: Финальный мастер-ролик готов к скачиванию',
      body: 'Статус изменился: «В работе · Запись и продакшн» → «Готово · Мастер передан». Утверждённый WAV/MP3 мастер-файл и паспорт прав доступны в карточке вашего заказа.',
      createdAt: isoAt(-180),
      previousStage: 'in_production',
      nextStage: 'on_air',
      stageClientLabel: 'Готово · Мастер передан',
    },
    {
      id: 'notif-seed-2854-version-master',
      orderNumber: 'FM-HOLD-2854',
      kind: 'audio_version_uploaded',
      title: 'Заказ #FM-HOLD-2854: готов финальный мастер (master)',
      body: 'Финальный мастер-ролик (WAV 48 кГц / −14 LUFS) — Утверждённый эфирный мастер WAV 48 кГц / −14 LUFS с юридическим дисклеймером. Прослушайте и скачайте файл в личном кабинете.',
      createdAt: isoAt(-360),
      deliverableId: 'deliv-seed-2854-master',
      deliverableKind: 'audio_master',
      versionCode: 'master',
      versionStage: 'master',
      versionNote:
        'Утверждённый эфирный мастер WAV 48 кГц / −14 LUFS с юридическим дисклеймером',
    },
    {
      id: 'notif-seed-2914-stage-hold',
      orderNumber: 'FM-HOLD-2914',
      kind: 'order_stage_changed',
      title: 'Заказ #FM-HOLD-2914: Заявка принята в работу',
      body: 'Статус изменился: «Проверка заявки» → «Проверка заявки». Продюсер сверяет параметры заказа и график размещения.',
      createdAt: isoAt(-8),
      previousStage: 'new_hold',
      nextStage: 'new_hold',
      stageClientLabel: 'Проверка заявки',
    },
  ];
}

export function sanitizeCabinetNotificationItem(
  raw: unknown
): CabinetNotificationItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id.trim().slice(0, 120) : '';
  const orderNumber =
    typeof obj.orderNumber === 'string'
      ? obj.orderNumber.trim().slice(0, 40)
      : '';
  const kind = obj.kind;
  if (
    !id ||
    !orderNumber ||
    (kind !== 'order_stage_changed' &&
      kind !== 'audio_version_uploaded' &&
      kind !== 'deliverable_uploaded')
  ) {
    return null;
  }

  const title =
    typeof obj.title === 'string' ? obj.title.trim().slice(0, 220) : '';
  const body =
    typeof obj.body === 'string' ? obj.body.trim().slice(0, 600) : '';
  if (!title || !body) return null;

  const createdAtRaw =
    typeof obj.createdAt === 'string' ? obj.createdAt.trim() : '';
  const createdAt = Number.isFinite(Date.parse(createdAtRaw))
    ? new Date(Date.parse(createdAtRaw)).toISOString()
    : new Date().toISOString();

  const validStages: readonly CrmOrderStage[] = [
    'new_hold',
    'quota_locked',
    'edo_invoice',
    'in_production',
    'on_air',
    'completed_ltv',
  ];

  const previousStage = validStages.includes(obj.previousStage as CrmOrderStage)
    ? (obj.previousStage as CrmOrderStage)
    : undefined;
  const nextStage = validStages.includes(obj.nextStage as CrmOrderStage)
    ? (obj.nextStage as CrmOrderStage)
    : undefined;

  const validDelivKinds: readonly OrderDeliverableKind[] = [
    'audio_master',
    'script',
    'invoice',
    'passport',
    'archive',
  ];
  const deliverableKind = validDelivKinds.includes(
    obj.deliverableKind as OrderDeliverableKind
  )
    ? (obj.deliverableKind as OrderDeliverableKind)
    : undefined;

  const versionStage =
    obj.versionStage === 'draft' ||
    obj.versionStage === 'revision' ||
    obj.versionStage === 'master'
      ? obj.versionStage
      : undefined;

  const versionCode = sanitizeDeliverableVersionCode(obj.versionCode);
  const versionNote = sanitizeDeliverableVersionNote(obj.versionNote);

  return {
    id,
    orderNumber,
    kind,
    title,
    body,
    createdAt,
    ...(previousStage ? { previousStage } : {}),
    ...(nextStage ? { nextStage } : {}),
    ...(typeof obj.stageClientLabel === 'string' && obj.stageClientLabel.trim()
      ? { stageClientLabel: obj.stageClientLabel.trim().slice(0, 80) }
      : {}),
    ...(typeof obj.deliverableId === 'string' && obj.deliverableId.trim()
      ? { deliverableId: obj.deliverableId.trim().slice(0, 120) }
      : {}),
    ...(deliverableKind ? { deliverableKind } : {}),
    ...(versionCode ? { versionCode } : {}),
    ...(versionStage ? { versionStage } : {}),
    ...(versionNote ? { versionNote } : {}),
    ...(obj.isTestPush === true ? { isTestPush: true } : {}),
  };
}

/**
 * Идемпотентно добавляет новое уведомление в журнал, отсекая дубликаты по `id`
 * и сортируя по убыванию `createdAt` (с ограничением размера очереди).
 */
export function mergeNotificationEventIdempotently(
  existing: readonly CabinetNotificationItem[],
  incoming: CabinetNotificationItem,
  maxItems = 300
): CabinetNotificationItem[] {
  const map = new Map<string, CabinetNotificationItem>();
  map.set(incoming.id, incoming);
  for (const item of existing) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    const diff = (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    if (diff !== 0) return diff;
    return b.id.localeCompare(a.id);
  });
  return merged.slice(0, Math.max(1, maxItems));
}

/**
 * Гидратирует сохранённый список уведомлений со стартовыми seed-уведомлениями без потери новых событий.
 */
export function hydrateCabinetNotifications(
  rawList: unknown,
  nowMs = Date.now()
): CabinetNotificationItem[] {
  const seeds = createSeedCabinetNotifications(nowMs);
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return seeds.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
  }
  const sanitized = rawList
    .map((item) => sanitizeCabinetNotificationItem(item))
    .filter((item): item is CabinetNotificationItem => item !== null);

  let merged = sanitized;
  const existingIds = new Set(sanitized.map((n) => n.id));
  for (const seed of seeds) {
    if (!existingIds.has(seed.id)) {
      merged = mergeNotificationEventIdempotently(merged, seed, 300);
    }
  }
  return merged;
}

export function createDefaultClientNotificationPreferences(
  subjectKey: string,
  nowIso = new Date().toISOString()
): ClientNotificationPreferences {
  return {
    subjectKey,
    browserPushEnabled: false,
    notifyOnStageChange: true,
    notifyOnNewVersion: true,
    readNotificationIds: [],
    lastReadAllAt: null,
    pushEndpoint: null,
    updatedAt: nowIso,
  };
}

export function sanitizeClientNotificationPreferences(
  raw: unknown,
  fallbackSubjectKey = 'anonymous'
): ClientNotificationPreferences {
  const nowIso = new Date().toISOString();
  if (!raw || typeof raw !== 'object') {
    return createDefaultClientNotificationPreferences(fallbackSubjectKey, nowIso);
  }
  const obj = raw as Record<string, unknown>;
  const subjectKey =
    typeof obj.subjectKey === 'string' && obj.subjectKey.trim()
      ? obj.subjectKey.trim().slice(0, 180)
      : fallbackSubjectKey;

  const readNotificationIds = Array.isArray(obj.readNotificationIds)
    ? Array.from(
        new Set(
          obj.readNotificationIds
            .filter((x): x is string => typeof x === 'string')
            .map((x) => x.trim().slice(0, 120))
            .filter(Boolean)
        )
      ).slice(-400)
    : [];

  const lastReadAllAt =
    typeof obj.lastReadAllAt === 'string' &&
    Number.isFinite(Date.parse(obj.lastReadAllAt))
      ? new Date(Date.parse(obj.lastReadAllAt)).toISOString()
      : null;

  const pushEndpoint =
    typeof obj.pushEndpoint === 'string' &&
    obj.pushEndpoint.trim().startsWith('https://')
      ? obj.pushEndpoint.trim().slice(0, 500)
      : null;

  const updatedAt =
    typeof obj.updatedAt === 'string' && Number.isFinite(Date.parse(obj.updatedAt))
      ? new Date(Date.parse(obj.updatedAt)).toISOString()
      : nowIso;

  return {
    subjectKey,
    browserPushEnabled: Boolean(obj.browserPushEnabled),
    notifyOnStageChange:
      typeof obj.notifyOnStageChange === 'boolean'
        ? obj.notifyOnStageChange
        : true,
    notifyOnNewVersion:
      typeof obj.notifyOnNewVersion === 'boolean'
        ? obj.notifyOnNewVersion
        : true,
    readNotificationIds,
    lastReadAllAt,
    pushEndpoint,
    updatedAt,
  };
}

/**
 * Проверяет, разрешено ли уведомление пользовательскими настройками каналов.
 */
export function isNotificationEnabledByPreferences(
  item: Pick<CabinetNotificationItem, 'kind' | 'isTestPush'>,
  prefs: Pick<
    ClientNotificationPreferences,
    'notifyOnStageChange' | 'notifyOnNewVersion'
  >
): boolean {
  if (item.isTestPush) return true;
  if (item.kind === 'order_stage_changed') {
    return prefs.notifyOnStageChange;
  }
  return prefs.notifyOnNewVersion;
}

/**
 * Проверяет, прочитано ли уведомление клиентом.
 */
export function isCabinetNotificationRead(
  item: Pick<CabinetNotificationItem, 'id' | 'createdAt'>,
  prefs: Pick<
    ClientNotificationPreferences,
    'readNotificationIds' | 'lastReadAllAt'
  >
): boolean {
  if (prefs.readNotificationIds.includes(item.id)) {
    return true;
  }
  if (prefs.lastReadAllAt) {
    const readAllMs = Date.parse(prefs.lastReadAllAt);
    const itemMs = Date.parse(item.createdAt);
    if (Number.isFinite(readAllMs) && Number.isFinite(itemMs) && itemMs <= readAllMs) {
      return true;
    }
  }
  return false;
}

/**
 * Строгая изоляция доступа: возвращает только уведомления по тем заказам,
 * к которым у клиента подтверждён криптографический доступ (сессия почты или валидный rescueToken),
 * с учётом настроек типов событий и отметок о прочтении.
 */
export function filterNotificationsForAccessibleOrders(params: {
  allNotifications: readonly CabinetNotificationItem[];
  accessibleOrderNumbers: Iterable<string>;
  preferences: ClientNotificationPreferences;
  respectChannelToggles?: boolean;
}): CabinetNotificationViewItem[] {
  const allowedSet = new Set(
    Array.from(params.accessibleOrderNumbers)
      .map((n) => n.trim().toUpperCase())
      .filter(Boolean)
  );
  if (allowedSet.size === 0) return [];

  const respectToggles = params.respectChannelToggles !== false;
  const filtered = params.allNotifications.filter((item) => {
    if (!allowedSet.has(item.orderNumber.trim().toUpperCase())) {
      return false;
    }
    if (
      respectToggles &&
      !isNotificationEnabledByPreferences(item, params.preferences)
    ) {
      return false;
    }
    return true;
  });

  filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return filtered.map((item) => ({
    ...item,
    isRead: isCabinetNotificationRead(item, params.preferences),
  }));
}

export function countUnreadNotifications(
  items: readonly Pick<CabinetNotificationViewItem, 'isRead'>[]
): number {
  let count = 0;
  for (const item of items) {
    if (!item.isRead) count += 1;
  }
  return count;
}

export function filterCabinetNotificationViewItems(
  items: readonly CabinetNotificationViewItem[],
  tab: CabinetNotificationFilterTab
): CabinetNotificationViewItem[] {
  if (tab === 'unread') {
    return items.filter((item) => !item.isRead);
  }
  if (tab === 'versions') {
    return items.filter(
      (item) =>
        item.kind === 'audio_version_uploaded' ||
        item.kind === 'deliverable_uploaded'
    );
  }
  if (tab === 'stages') {
    return items.filter((item) => item.kind === 'order_stage_changed');
  }
  return [...items];
}

export function markNotificationsReadInPreferences(
  prefs: ClientNotificationPreferences,
  options: {
    notificationIds?: readonly string[];
    markAll?: boolean;
    nowIso?: string;
  }
): ClientNotificationPreferences {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const extraIds = (options.notificationIds ?? [])
    .map((id) => id.trim().slice(0, 120))
    .filter(Boolean);
  const mergedIds = Array.from(
    new Set([...prefs.readNotificationIds, ...extraIds])
  ).slice(-400);

  return {
    ...prefs,
    readNotificationIds: mergedIds,
    lastReadAllAt: options.markAll ? nowIso : prefs.lastReadAllAt,
    updatedAt: nowIso,
  };
}
