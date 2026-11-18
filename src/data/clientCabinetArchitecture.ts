import { normalizeClientEmail } from './clientAuthShared.ts';
import type {
  ClientCabinetOrderSummary,
  OrderDeliverableFile,
} from './clientCabinetHelpers.ts';
import {
  buildOrderAudioVersionHistory,
  isAudioSpotDeliverable,
  isFinalMasterAudioDeliverable,
  type OrderAudioVersionHistory,
  type ResolvedAudioDeliverableVersion,
  resolveUploadedDeliverableVersionMeta,
  suggestNextAudioVersionCode,
} from './deliverableVersioning.ts';
import type { CabinetSubrouteMode, PlatformRoute } from './platformRouter.ts';
import { sanitizeCabinetMagicToken } from './platformRouter.ts';

export {
  buildOrderAudioVersionHistory,
  isAudioSpotDeliverable,
  isFinalMasterAudioDeliverable,
  type OrderAudioVersionHistory,
  type ResolvedAudioDeliverableVersion,
  resolveUploadedDeliverableVersionMeta,
  suggestNextAudioVersionCode,
};

/**
 * Вкладки панели беспарольного доступа и восстановления в модуле `ClientCabinetPage`:
 * - `magic_email` — автоматическая регистрация по почте / беспарольный вход по одноразовой magic-ссылке;
 * - `access_reset` — сброс и восстановление доступа по magic-ссылке с отзывом старых сессий на других устройствах;
 * - `order_number` — резервный точечный доступ к отдельному заказу по номеру + телефону / ИНН / @Telegram.
 */
export type CabinetAccessTabId = 'magic_email' | 'access_reset' | 'order_number';

/**
 * Режим отображения разделов рабочего пространства в личном кабинете:
 * - `all` — активные заказы сверху + раздел «История заказов» ниже;
 * - `active` — только текущие заказы в работе;
 * - `history` — архив прошлых завершённых проектов с готовыми мастер-файлами (`/cabinet/history`).
 */
export type CabinetWorkspaceSectionFilter = 'all' | 'active' | 'history';

/**
 * Состояния жизненного цикла модуля `ClientCabinetPage`.
 */
export type CabinetAuthLifecycleState =
  | 'initializing'
  | 'verifying_magic_link'
  | 'authenticated'
  | 'anonymous_device_orders'
  | 'guest_entry';

/**
 * Вычисляет текущее архитектурное состояние модуля `ClientCabinetPage` из флагов загрузки и данных сессии.
 */
export function deriveCabinetLifecycleState(params: {
  isLoading: boolean;
  isVerifyingMagic: boolean;
  hasAuthenticatedAccount: boolean;
  ordersCount: number;
}): CabinetAuthLifecycleState {
  if (params.isVerifyingMagic) {
    return 'verifying_magic_link';
  }
  if (params.isLoading && params.ordersCount === 0 && !params.hasAuthenticatedAccount) {
    return 'initializing';
  }
  if (params.hasAuthenticatedAccount) {
    return 'authenticated';
  }
  if (params.ordersCount > 0) {
    return 'anonymous_device_orders';
  }
  return 'guest_entry';
}

/**
 * Определяет активную вкладку и видимость панели доступа при переходе по маршруту из `platformRouter.ts`.
 */
export function resolveCabinetAccessUiFromRoute(params: {
  subroute?: CabinetSubrouteMode;
  currentTab: CabinetAccessTabId;
  currentlyOpen: boolean;
  ordersCount: number;
}): {
  accessTab: CabinetAccessTabId;
  showAccessPanel: boolean;
} {
  if (params.subroute === 'reset') {
    return {
      accessTab: 'access_reset',
      showAccessPanel: true,
    };
  }
  return {
    accessTab:
      params.currentTab === 'access_reset' ? 'magic_email' : params.currentTab,
    showAccessPanel: params.ordersCount === 0 ? true : params.currentlyOpen,
  };
}

/**
 * Определяет начальный фильтр разделов кабинета по подмаршруту `platformRouter.ts`.
 */
export function resolveWorkspaceFilterFromRoute(
  subroute?: CabinetSubrouteMode
): CabinetWorkspaceSectionFilter {
  if (subroute === 'history') {
    return 'history';
  }
  return 'all';
}

/**
 * Формирует типизированный маршрут `PlatformRoute` для выбранного фильтра разделов кабинета.
 */
export function buildCabinetRouteForWorkspaceFilter(
  filter: CabinetWorkspaceSectionFilter
): Extract<PlatformRoute, { kind: 'cabinet' }> {
  if (filter === 'history') {
    return { kind: 'cabinet', subroute: 'history' };
  }
  return { kind: 'cabinet' };
}

/**
 * Формирует типизированный маршрут `PlatformRoute` при переключении вкладки доступа,
 * чтобы URL (`/cabinet` <-> `/cabinet/reset`) оставался синхронизированным с `App.tsx` и `platformRouter.ts`.
 */
export function buildCabinetRouteForAccessTab(
  tab: CabinetAccessTabId
): Extract<PlatformRoute, { kind: 'cabinet' }> {
  if (tab === 'access_reset') {
    return { kind: 'cabinet', subroute: 'reset' };
  }
  return { kind: 'cabinet' };
}

/**
 * Безопасно извлекает одноразовый `magic`-токен из пути или полного URL (например, `/cabinet/reset?magic=...`),
 * сохраняя регистр символов base64url для криптографической проверки HMAC-SHA256.
 */
export function extractMagicTokenFromCabinetHref(
  hrefOrPath: string | null | undefined
): { token: string | null; isResetPath: boolean } {
  if (!hrefOrPath || typeof hrefOrPath !== 'string') {
    return { token: null, isResetPath: false };
  }
  const trimmed = hrefOrPath.trim();
  if (!trimmed) {
    return { token: null, isResetPath: false };
  }
  try {
    const parsed = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? new URL(trimmed)
      : new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, 'https://fmworks.local');
    const pathLower = parsed.pathname.replace(/\/+$/g, '').toLowerCase();
    const isResetPath =
      pathLower === '/cabinet/reset' ||
      pathLower === '/cabinet/recovery' ||
      parsed.searchParams.get('mode')?.toLowerCase() === 'reset' ||
      parsed.searchParams.get('reset') === '1';
    const token = sanitizeCabinetMagicToken(parsed.searchParams.get('magic')) ?? null;
    return { token, isResetPath };
  } catch {
    return { token: null, isResetPath: false };
  }
}

/**
 * Объединяет заказы из авторизованной почтовой сессии и локальные заказы устройства без дублей,
 * сортируя от новых к старым.
 */
export function mergeAuthenticatedAndDeviceOrders(
  sessionOrders: readonly ClientCabinetOrderSummary[],
  deviceOrders: readonly ClientCabinetOrderSummary[]
): ClientCabinetOrderSummary[] {
  const byOrderNumber = new Map<string, ClientCabinetOrderSummary>();
  for (const ord of sessionOrders) {
    byOrderNumber.set(ord.orderNumber, ord);
  }
  for (const ord of deviceOrders) {
    if (!byOrderNumber.has(ord.orderNumber)) {
      byOrderNumber.set(ord.orderNumber, ord);
    }
  }
  return Array.from(byOrderNumber.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

/**
 * Находит локальные анонимные заказы устройства (оформленные без почты), которые можно автоматически
 * привязать к авторизованному профилю клиента по его `rescueToken`.
 */
export function pickUnboundDeviceOrderTokens(
  deviceOrders: readonly Pick<
    ClientCabinetOrderSummary,
    'orderNumber' | 'rescueToken' | 'clientEmail'
  >[],
  authenticatedEmail?: string | null
): Array<{ orderNumber: string; rescueToken: string }> {
  const normalizedTarget = normalizeClientEmail(authenticatedEmail);
  return deviceOrders
    .filter((ord) => {
      const existingEmail = normalizeClientEmail(ord.clientEmail);
      if (!existingEmail) return true;
      return normalizedTarget ? false : false;
    })
    .map((ord) => ({
      orderNumber: ord.orderNumber,
      rescueToken: ord.rescueToken,
    }));
}

/**
 * Проверяет, относится ли заказ к архиву завершённых проектов («История заказов»).
 */
export function isCompletedHistoryOrder(
  order: Pick<ClientCabinetOrderSummary, 'stage'>
): boolean {
  return order.stage === 'completed_ltv';
}

/**
 * Проверяет, является ли выданный файл готовым аудиомастером (финальной версией, а не черновым дублем v1/v2).
 */
export function isMasterAudioDeliverable(
  file: Pick<
    OrderDeliverableFile,
    'kind' | 'mimeType' | 'versionCode' | 'versionStage' | 'title' | 'fileName'
  >
): boolean {
  return isFinalMasterAudioDeliverable(file);
}

/**
 * Разделяет файлы проекта на готовые финальные аудиомастера и неаудийные сопроводительные документы.
 * Промежуточные итерации ролика (`v1`, `v2`) возвращаются через `buildOrderAudioVersionHistory(order)`.
 */
export function extractOrderMasterFiles(
  order: Pick<ClientCabinetOrderSummary, 'deliverables'>
): {
  masterFiles: OrderDeliverableFile[];
  supplementaryFiles: OrderDeliverableFile[];
} {
  const masterFiles: OrderDeliverableFile[] = [];
  const supplementaryFiles: OrderDeliverableFile[] = [];

  for (const file of order.deliverables) {
    if (isFinalMasterAudioDeliverable(file)) {
      masterFiles.push(file);
    } else if (!isAudioSpotDeliverable(file)) {
      supplementaryFiles.push(file);
    }
  }

  return { masterFiles, supplementaryFiles };
}

/**
 * Формирует защищённые ссылки для скачивания и потокового предпрослушивания готового файла заказа.
 */
export function buildDeliverableDownloadUrls(
  orderNumber: string,
  rescueToken: string,
  fileId: string
): {
  downloadHref: string;
  previewHref: string;
} {
  const downloadHref = `/api/orders/${encodeURIComponent(
    orderNumber
  )}/deliverables/${encodeURIComponent(fileId)}?token=${encodeURIComponent(
    rescueToken
  )}`;
  return {
    downloadHref,
    previewHref: `${downloadHref}&preview=1`,
  };
}

/**
 * Разделяет список заказов клиента на текущие проекты в работе и архив «История заказов»,
 * подсчитывая общее число готовых мастер-файлов в истории.
 */
export function partitionCabinetOrders(
  orders: readonly ClientCabinetOrderSummary[]
): {
  activeOrders: ClientCabinetOrderSummary[];
  historyOrders: ClientCabinetOrderSummary[];
  totalHistoryMastersCount: number;
} {
  const activeOrders: ClientCabinetOrderSummary[] = [];
  const historyOrders: ClientCabinetOrderSummary[] = [];
  let totalHistoryMastersCount = 0;

  for (const order of orders) {
    if (isCompletedHistoryOrder(order)) {
      historyOrders.push(order);
      totalHistoryMastersCount += extractOrderMasterFiles(order).masterFiles.length;
    } else {
      activeOrders.push(order);
    }
  }

  return {
    activeOrders,
    historyOrders,
    totalHistoryMastersCount,
  };
}

export type CabinetHistoryVisualStatusId = 'in_work' | 'in_review' | 'ready';

export type CabinetHistoryStatusFilter = 'all' | CabinetHistoryVisualStatusId;

export interface CabinetHistoryStepState {
  id: CabinetHistoryVisualStatusId;
  stepNumber: 1 | 2 | 3;
  label: 'В работе' | 'На согласовании' | 'Готово';
  state: 'done' | 'current' | 'upcoming';
}

export interface CabinetHistoryVisualStatusMeta {
  statusId: CabinetHistoryVisualStatusId;
  label: 'В работе' | 'На согласовании' | 'Готово';
  progressPercent: number;
  currentStepNumber: 1 | 2 | 3;
  totalSteps: 3;
  stageSummary: string;
  steps: readonly [
    CabinetHistoryStepState,
    CabinetHistoryStepState,
    CabinetHistoryStepState,
  ];
}

/**
 * Вычисляет наглядный визуальный статус проекта («В работе», «На согласовании», «Готово»)
 * и прогресс по 3 клиентским этапам для раздела «История заказов».
 */
export function resolveCabinetOrderVisualStatus(
  order: Pick<ClientCabinetOrderSummary, 'stage' | 'deliverables'>
): CabinetHistoryVisualStatusMeta {
  const { masterFiles } = extractOrderMasterFiles(order);
  const hasMasterAudio = masterFiles.length > 0;
  const hasReviewMaterials = order.deliverables.some(
    (d) =>
      d.kind === 'script' ||
      d.kind === 'passport' ||
      (isAudioSpotDeliverable(d) && !isFinalMasterAudioDeliverable(d))
  );

  if (
    order.stage === 'completed_ltv' ||
    (order.stage === 'on_air' && hasMasterAudio)
  ) {
    return {
      statusId: 'ready',
      label: 'Готово',
      progressPercent: 100,
      currentStepNumber: 3,
      totalSteps: 3,
      stageSummary:
        order.stage === 'completed_ltv'
          ? 'Проект сдан и закрыт · мастер-файлы доступны в архиве'
          : 'Мастер-файлы готовы к скачиванию и переданы заказчику',
      steps: [
        { id: 'in_work', stepNumber: 1, label: 'В работе', state: 'done' },
        {
          id: 'in_review',
          stepNumber: 2,
          label: 'На согласовании',
          state: 'done',
        },
        { id: 'ready', stepNumber: 3, label: 'Готово', state: 'done' },
      ],
    };
  }

  if (
    order.stage === 'quota_locked' ||
    (order.stage === 'in_production' && hasReviewMaterials) ||
    (order.stage === 'on_air' && !hasMasterAudio)
  ) {
    const progressPercent =
      order.stage === 'on_air' ? 85 : order.stage === 'in_production' ? 75 : 65;
    const stageSummary =
      order.stage === 'in_production'
        ? 'Варианты сценария и материалы направлены заказчику на согласование'
        : order.stage === 'on_air'
          ? 'Финальное согласование материалов и закрывающих документов'
          : 'Согласование концепции сценария, хронометража и условий запуска';

    return {
      statusId: 'in_review',
      label: 'На согласовании',
      progressPercent,
      currentStepNumber: 2,
      totalSteps: 3,
      stageSummary,
      steps: [
        { id: 'in_work', stepNumber: 1, label: 'В работе', state: 'done' },
        {
          id: 'in_review',
          stepNumber: 2,
          label: 'На согласовании',
          state: 'current',
        },
        { id: 'ready', stepNumber: 3, label: 'Готово', state: 'upcoming' },
      ],
    };
  }

  const progressPercent =
    order.stage === 'in_production'
      ? 50
      : order.stage === 'edo_invoice'
        ? 35
        : 20;
  const stageSummary =
    order.stage === 'in_production'
      ? 'Разработка сценария, запись диктора и студийное сведение ролика'
      : order.stage === 'edo_invoice'
        ? 'Оформление счёта и подготовка проекта к студийной записи'
        : 'Заявка принята в работу · сверка задачи с продюсером';

  return {
    statusId: 'in_work',
    label: 'В работе',
    progressPercent,
    currentStepNumber: 1,
    totalSteps: 3,
    stageSummary,
    steps: [
      { id: 'in_work', stepNumber: 1, label: 'В работе', state: 'current' },
      {
        id: 'in_review',
        stepNumber: 2,
        label: 'На согласовании',
        state: 'upcoming',
      },
      { id: 'ready', stepNumber: 3, label: 'Готово', state: 'upcoming' },
    ],
  };
}

/**
 * Подсчитывает количество проектов клиента по каждому визуальному статусу («В работе», «На согласовании», «Готово»)
 * и общее число доступных мастер-файлов WAV.
 */
export function summarizeCabinetHistoryStatuses(
  orders: readonly Pick<ClientCabinetOrderSummary, 'stage' | 'deliverables'>[]
): {
  totalProjectsCount: number;
  inWorkCount: number;
  inReviewCount: number;
  readyCount: number;
  totalMasterFilesCount: number;
} {
  let inWorkCount = 0;
  let inReviewCount = 0;
  let readyCount = 0;
  let totalMasterFilesCount = 0;

  for (const order of orders) {
    const visual = resolveCabinetOrderVisualStatus(order);
    if (visual.statusId === 'in_work') {
      inWorkCount += 1;
    } else if (visual.statusId === 'in_review') {
      inReviewCount += 1;
    } else {
      readyCount += 1;
    }
    totalMasterFilesCount += extractOrderMasterFiles(order).masterFiles.length;
  }

  return {
    totalProjectsCount: orders.length,
    inWorkCount,
    inReviewCount,
    readyCount,
    totalMasterFilesCount,
  };
}

/**
 * Порог автоматической архивации в «Истории заказов»: 6 месяцев (183 календарных суток).
 */
export const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

/**
 * Определяет, является ли проект одновременно завершённым («Готово» / `completed_ltv`)
 * и оплаченным (100% предоплата подтверждена по договору или банковской картой).
 */
export function isOrderCompletedAndPaid(
  order: Pick<
    ClientCabinetOrderSummary,
    'stage' | 'deliverables' | 'approvalWorkflow'
  >
): boolean {
  if (order.approvalWorkflow && order.approvalWorkflow.phase !== 'accepted') {
    return false;
  }
  const visual = resolveCabinetOrderVisualStatus(order);
  return visual.statusId === 'ready';
}

/**
 * Возвращает опорную временную метку проекта (мс) по дате последнего обновления или создания.
 */
export function resolveOrderReferenceTimestampMs(
  order: Pick<ClientCabinetOrderSummary, 'createdAt' | 'updatedAt'>
): number {
  const updatedMs = Date.parse(order.updatedAt || '');
  if (Number.isFinite(updatedMs)) {
    return updatedMs;
  }
  return Date.parse(order.createdAt || '');
}

/**
 * Проверяет, что проект завершён, оплачен и с момента его закрытия/обновления прошло более 6 месяцев.
 */
export function isCompletedOrderOlderThanSixMonths(
  order: Pick<
    ClientCabinetOrderSummary,
    'stage' | 'deliverables' | 'createdAt' | 'updatedAt' | 'approvalWorkflow'
  >,
  nowMs = Date.now()
): boolean {
  if (!isOrderCompletedAndPaid(order)) {
    return false;
  }
  const refMs = resolveOrderReferenceTimestampMs(order);
  if (!Number.isFinite(refMs)) {
    return false;
  }
  return nowMs - refMs >= SIX_MONTHS_MS;
}

function normalizeManualArchiveSet(
  manuallyArchivedOrderNumbers?: ReadonlySet<string> | readonly string[]
): Set<string> {
  if (!manuallyArchivedOrderNumbers) {
    return new Set<string>();
  }
  if (manuallyArchivedOrderNumbers instanceof Set) {
    return manuallyArchivedOrderNumbers;
  }
  return new Set(manuallyArchivedOrderNumbers);
}

/**
 * Проверяет, скрыт ли завершённый и оплаченный проект правилами минималистичного архива
 * (автоматический фильтр > 6 месяцев или ручное добавление проекта в архив клиентом).
 * Активные заказы («В работе», «На согласовании») никогда не скрываются архивом.
 */
export function isOrderArchivedInHistory(
  order: Pick<
    ClientCabinetOrderSummary,
    | 'orderNumber'
    | 'stage'
    | 'deliverables'
    | 'createdAt'
    | 'updatedAt'
    | 'approvalWorkflow'
  >,
  options?: {
    hideOlderThanSixMonths?: boolean;
    manuallyArchivedOrderNumbers?: ReadonlySet<string> | readonly string[];
    nowMs?: number;
  }
): boolean {
  if (!isOrderCompletedAndPaid(order)) {
    return false;
  }
  const manualSet = normalizeManualArchiveSet(
    options?.manuallyArchivedOrderNumbers
  );
  if (manualSet.has(order.orderNumber)) {
    return true;
  }
  if (
    options?.hideOlderThanSixMonths &&
    isCompletedOrderOlderThanSixMonths(order, options.nowMs)
  ) {
    return true;
  }
  return false;
}

export interface CabinetHistoryArchiveSummary {
  /** Всего завершённых и оплаченных проектов (доступных для архивации) */
  archivableCompletedCount: number;
  /** Завершённые и оплаченные проекты старше 6 месяцев */
  completedOlderThanSixMonthsCount: number;
  /** Завершённые проекты, вручную перенесённые клиентом в архив */
  manuallyArchivedCount: number;
  /** Сколько проектов прямо сейчас скрыто из основного списка настройками архива */
  hiddenByArchiveCount: number;
}

/**
 * Подсчитывает сводку архива для «Истории заказов», чтобы клиент видел точное количество
 * скрытых завершённых и оплаченных проектов старше 6 месяцев.
 */
export function summarizeCabinetHistoryArchive(
  orders: readonly ClientCabinetOrderSummary[],
  options?: {
    hideOlderThanSixMonths?: boolean;
    manuallyArchivedOrderNumbers?: ReadonlySet<string> | readonly string[];
    nowMs?: number;
  }
): CabinetHistoryArchiveSummary {
  const nowMs = options?.nowMs ?? Date.now();
  const manualSet = normalizeManualArchiveSet(
    options?.manuallyArchivedOrderNumbers
  );

  let archivableCompletedCount = 0;
  let completedOlderThanSixMonthsCount = 0;
  let manuallyArchivedCount = 0;
  let hiddenByArchiveCount = 0;

  for (const order of orders) {
    if (!isOrderCompletedAndPaid(order)) {
      continue;
    }
    archivableCompletedCount += 1;
    const isOlder6m = isCompletedOrderOlderThanSixMonths(order, nowMs);
    const isManual = manualSet.has(order.orderNumber);
    if (isOlder6m) {
      completedOlderThanSixMonthsCount += 1;
    }
    if (isManual) {
      manuallyArchivedCount += 1;
    }
    if (
      isOrderArchivedInHistory(order, {
        hideOlderThanSixMonths: options?.hideOlderThanSixMonths,
        manuallyArchivedOrderNumbers: manualSet,
        nowMs,
      })
    ) {
      hiddenByArchiveCount += 1;
    }
  }

  return {
    archivableCompletedCount,
    completedOlderThanSixMonthsCount,
    manuallyArchivedCount,
    hiddenByArchiveCount,
  };
}

/**
 * Фильтрует список проектов в разделе «История заказов» по визуальному статусу
 * («В работе», «На согласовании», «Готово»), поисковому запросу, флагу наличия мастер-файлов
 * и режиму минималистичного скрытия завершённых и оплаченных проектов старше 6 месяцев.
 */
export function filterCabinetHistoryOrders(
  historyOrders: readonly ClientCabinetOrderSummary[],
  criteria: {
    searchQuery?: string;
    onlyWithMasters?: boolean;
    statusFilter?: CabinetHistoryStatusFilter;
    hideOlderThanSixMonths?: boolean;
    manuallyArchivedOrderNumbers?: ReadonlySet<string> | readonly string[];
    showArchivedOnly?: boolean;
    nowMs?: number;
  }
): ClientCabinetOrderSummary[] {
  const normalizedQuery = (criteria.searchQuery ?? '').trim().toLowerCase();
  const onlyMasters = Boolean(criteria.onlyWithMasters);
  const statusFilter = criteria.statusFilter ?? 'all';
  const hideOlderThanSixMonths = Boolean(criteria.hideOlderThanSixMonths);
  const showArchivedOnly = Boolean(criteria.showArchivedOnly);
  const manualSet = normalizeManualArchiveSet(
    criteria.manuallyArchivedOrderNumbers
  );
  const nowMs = criteria.nowMs ?? Date.now();

  return historyOrders.filter((order) => {
    const visualStatus = resolveCabinetOrderVisualStatus(order);
    if (statusFilter !== 'all' && visualStatus.statusId !== statusFilter) {
      return false;
    }

    if (showArchivedOnly) {
      const isCandidateInArchive =
        isCompletedOrderOlderThanSixMonths(order, nowMs) ||
        (isOrderCompletedAndPaid(order) && manualSet.has(order.orderNumber));
      if (!isCandidateInArchive) {
        return false;
      }
    } else if (
      isOrderArchivedInHistory(order, {
        hideOlderThanSixMonths,
        manuallyArchivedOrderNumbers: manualSet,
        nowMs,
      })
    ) {
      return false;
    }

    const { masterFiles } = extractOrderMasterFiles(order);
    if (onlyMasters && masterFiles.length === 0) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }

    const audioHistory = buildOrderAudioVersionHistory(order);
    const fieldsToMatch = [
      order.orderNumber,
      order.formatLabel,
      order.companyOrInn,
      order.briefText,
      visualStatus.label,
      ...order.deliverables.flatMap((d) => [
        d.title,
        d.fileName,
        d.versionCode ?? '',
        d.versionNote ?? '',
      ]),
      ...audioHistory.versionsChronological.flatMap((v) => [
        v.versionCode,
        v.stageLabel,
        v.versionNote,
      ]),
    ];

    return fieldsToMatch.some((val) =>
      (val || '').toLowerCase().includes(normalizedQuery)
    );
  });
}

export type RepeatOrderFormatId =
  | 'voice_style'
  | 'turnkey'
  | 'cinema'
  | 'adaptation'
  | 'custom_consult';

/**
 * Восстанавливает точный тариф (`selectedFormat`) и хронометраж (`spotDurationSec`) заказа
 * для функции «Повторить заказ за 1 минуту», чтобы повторный заказ не сбрасывался на дефолтные 20 сек / «Под ключ».
 */
export function inferOrderRepeatParameters(
  order: Pick<
    ClientCabinetOrderSummary,
    'formatLabel' | 'totalBudgetRub' | 'documentMeta' | 'approvalWorkflow'
  >
): {
  formatId: RepeatOrderFormatId;
  spotDurationSec: number;
} {
  const lower = (order.formatLabel || '').toLowerCase();
  const durationMatch = (order.formatLabel || '').match(/(\d{1,2})\s*сек/i);
  const parsedFromLabel = durationMatch ? Number(durationMatch[1]) : undefined;

  const rawDuration =
    order.documentMeta?.spotExactDurationSec ??
    order.approvalWorkflow?.targetSlotSec ??
    parsedFromLabel ??
    20;
  const spotDurationSec = Math.max(5, Math.min(60, Math.round(rawDuration)));

  let formatId: RepeatOrderFormatId = 'turnkey';
  if (lower.includes('игров') || lower.includes('кино') || lower.includes('cinema')) {
    formatId = 'cinema';
  } else if (lower.includes('голос') || lower.includes('voice')) {
    formatId = 'voice_style';
  } else if (lower.includes('адаптац') || lower.includes('ресайз')) {
    formatId = 'adaptation';
  } else if (
    lower.includes('индивидуальн') ||
    lower.includes('договорн') ||
    lower.includes('консультац') ||
    order.totalBudgetRub <= 0
  ) {
    formatId = 'custom_consult';
  } else if (lower.includes('под ключ') || lower.includes('turnkey')) {
    formatId = 'turnkey';
  } else if (order.totalBudgetRub >= 33_000) {
    formatId = 'cinema';
  } else if (order.totalBudgetRub > 0 && order.totalBudgetRub <= 17_000) {
    formatId = 'voice_style';
  }

  return { formatId, spotDurationSec };
}

/**
 * Сортирует активные заказы так, чтобы проекты, ожидающие действия самого клиента
 * («Ваш ход»: утверждение сценария или приёмка готового ролика), всегда отображались первыми.
 */
export function sortActiveOrdersByClientTurn<
  T extends Pick<ClientCabinetOrderSummary, 'createdAt' | 'approvalWorkflow'>,
>(activeOrders: readonly T[]): T[] {
  return [...activeOrders].sort((a, b) => {
    const aTurn = a.approvalWorkflow?.whoseTurnActor === 'client' ? 1 : 0;
    const bTurn = b.approvalWorkflow?.whoseTurnActor === 'client' ? 1 : 0;
    if (aTurn !== bTurn) {
      return bTurn - aTurn;
    }
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

/**
 * Проверяет сигнатуру содержимого файла (magic bytes) при загрузке клиентских материалов в заказ,
 * исключая подмену исполняемых или HTML/SVG-скриптов под видом документов, изображений и аудио.
 */
export function verifyClientAttachmentMagicBytes(
  bytes: Uint8Array,
  extWithDot: string
): { ok: true } | { ok: false; error: string } {
  const ext = extWithDot.trim().toLowerCase();
  if (bytes.length === 0) {
    return { ok: false, error: 'Файл пуст (0 байт)' };
  }

  const startsWithAscii = (prefix: string): boolean => {
    if (bytes.length < prefix.length) return false;
    for (let i = 0; i < prefix.length; i += 1) {
      if (bytes[i] !== prefix.charCodeAt(i)) return false;
    }
    return true;
  };

  if (ext === '.pdf') {
    return startsWithAscii('%PDF-')
      ? { ok: true }
      : { ok: false, error: 'Файл не соответствует формату PDF (нарушена сигнатура %PDF)' };
  }

  if (ext === '.png') {
    const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const valid =
      bytes.length >= 8 && pngSig.every((b, idx) => bytes[idx] === b);
    return valid
      ? { ok: true }
      : { ok: false, error: 'Файл не является корректным изображением PNG' };
  }

  if (ext === '.jpg' || ext === '.jpeg') {
    const valid =
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;
    return valid
      ? { ok: true }
      : { ok: false, error: 'Файл не является корректным изображением JPEG' };
  }

  if (ext === '.wav') {
    const valid =
      bytes.length >= 12 &&
      startsWithAscii('RIFF') &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x41 &&
      bytes[10] === 0x56 &&
      bytes[11] === 0x45;
    return valid
      ? { ok: true }
      : { ok: false, error: 'Файл не является корректным аудиофайлом WAV (RIFF/WAVE)' };
  }

  if (ext === '.ogg') {
    return startsWithAscii('OggS')
      ? { ok: true }
      : { ok: false, error: 'Файл не является корректным аудиофайлом OGG' };
  }

  if (ext === '.mp3') {
    const hasId3 = startsWithAscii('ID3');
    const hasMpegSync =
      bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
    return hasId3 || hasMpegSync
      ? { ok: true }
      : { ok: false, error: 'Файл не является корректным аудиофайлом MP3' };
  }

  if (ext === '.m4a') {
    const hasFtyp =
      bytes.length >= 8 &&
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70;
    return hasFtyp
      ? { ok: true }
      : { ok: false, error: 'Файл не является корректным контейнером M4A (MP4 Audio)' };
  }

  if (ext === '.docx' || ext === '.zip') {
    const valid =
      bytes.length >= 4 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
    return valid
      ? { ok: true }
      : { ok: false, error: 'Файл не соответствует контейнеру DOCX / ZIP' };
  }

  if (ext === '.doc') {
    const oleSig = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    const valid =
      bytes.length >= 8 && oleSig.every((b, idx) => bytes[idx] === b);
    return valid
      ? { ok: true }
      : { ok: false, error: 'Файл не соответствует формату документа MS Word (.doc)' };
  }

  if (ext === '.rtf') {
    return startsWithAscii('{\\rtf')
      ? { ok: true }
      : { ok: false, error: 'Файл не соответствует формату RTF' };
  }

  if (ext === '.txt') {
    const sampleLen = Math.min(bytes.length, 4096);
    for (let i = 0; i < sampleLen; i += 1) {
      if (bytes[i] === 0x00) {
        return {
          ok: false,
          error: 'Текстовый файл (.txt) содержит бинарные нулевые байты',
        };
      }
    }
    return { ok: true };
  }

  return { ok: true };
}

/**
 * Убирает дублирующий хвост цены из названия формата («Продакшн под ключ (20 сек) — 25 000 ₽» -> «Продакшн под ключ (20 сек)»),
 * когда итоговый бюджет уже выводится крупным числом в правой части шапки карточки.
 */
export function stripTrailingPriceFromOrderTitle(
  formatLabel: string,
  totalBudgetRub?: number | null
): string {
  const clean = (formatLabel || '').trim();
  if (!clean) return '';
  if (typeof totalBudgetRub === 'number' && totalBudgetRub <= 0) {
    return clean;
  }
  const stripped = clean
    .replace(/\s*[—–-]\s*\d[\d\s\u00a0]*\s*(?:₽|руб\.?|р\.?)\s*$/iu, '')
    .trim();
  return stripped || clean;
}

/**
 * Показывает кнопку «Повторить заказ» только для принятых, эфирных или завершённых проектов,
 * чтобы не сбивать клиента предложением повторить ролик, который ещё не записан.
 */
export function shouldShowRepeatOrderAction(
  order: Pick<ClientCabinetOrderSummary, 'stage' | 'approvalWorkflow'>
): boolean {
  if (order.stage === 'completed_ltv' || order.stage === 'on_air') {
    return true;
  }
  return order.approvalWorkflow?.phase === 'accepted';
}

/**
 * На этапе 03 (приёмка готового ролика до окончательного утверждения) аудиоплеер
 * и версии ролика должны идти выше кнопок «Принять готовый ролик / Внести поправку».
 */
export function shouldShowAudioBeforeApprovalActions(
  workflow?: Pick<
    NonNullable<ClientCabinetOrderSummary['approvalWorkflow']>,
    'externalStep' | 'phase'
  > | null
): boolean {
  if (!workflow) return false;
  return workflow.externalStep === '03_spot' && workflow.phase !== 'accepted';
}

export interface ClientActionQueueItem {
  orderNumber: string;
  title: string;
  actionKind: 'approve_script' | 'accept_spot';
  actionLabel: string;
  stageShortLabel: string;
}

/**
 * Формирует приоритетную очередь действий клиента («Ждём вашего решения»)
 * по активным заказам на этапах утверждения сценария (01) или приёмки ролика (03).
 */
export function buildClientActionQueue(
  activeOrders: readonly Pick<
    ClientCabinetOrderSummary,
    'orderNumber' | 'formatLabel' | 'totalBudgetRub' | 'createdAt' | 'approvalWorkflow'
  >[]
): ClientActionQueueItem[] {
  const ordered = sortActiveOrdersByClientTurn(activeOrders);
  const queue: ClientActionQueueItem[] = [];

  for (const order of ordered) {
    const wf = order.approvalWorkflow;
    if (!wf || wf.whoseTurnActor !== 'client') {
      continue;
    }
    const isSpotStep = wf.externalStep === '03_spot';
    queue.push({
      orderNumber: order.orderNumber,
      title: stripTrailingPriceFromOrderTitle(
        order.formatLabel,
        order.totalBudgetRub
      ),
      actionKind: isSpotStep ? 'accept_spot' : 'approve_script',
      actionLabel: isSpotStep
        ? 'Прослушать и принять ролик'
        : 'Утвердить сценарий',
      stageShortLabel: isSpotStep
        ? 'Этап 03 · Готовый ролик'
        : 'Этап 01 · Сценарий',
    });
  }

  return queue;
}

/**
 * Форматирует секунды плеера в компактный таймкод `MM:SS.t` для кнопки быстрой поправки.
 */
export function formatQuickTimecodeLabel(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00.0';
  const rounded = Math.round(sec * 10) / 10;
  const mins = Math.floor(rounded / 60);
  const rem = rounded - mins * 60;
  const whole = Math.floor(rem);
  const tenths = Math.min(9, Math.max(0, Math.round((rem - whole) * 10)));
  return `${String(mins).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${tenths}`;
}

/**
 * Формирует готовую текстовую сводку по заказу для пересылки бухгалтеру или юристу в 1 клик.
 */
export function buildAccountingSummaryText(
  order: Pick<
    ClientCabinetOrderSummary,
    | 'orderNumber'
    | 'createdAt'
    | 'formatLabel'
    | 'totalBudgetRub'
    | 'companyOrInn'
    | 'stage'
    | 'approvalWorkflow'
  >,
  cabinetUrl?: string
): string {
  const cleanTitle = stripTrailingPriceFromOrderTitle(
    order.formatLabel,
    order.totalBudgetRub
  );
  const formattedDate = (() => {
    const d = new Date(order.createdAt);
    if (Number.isNaN(d.getTime())) return order.createdAt;
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  })();
  const amountText =
    order.totalBudgetRub > 0
      ? `${new Intl.NumberFormat('ru-RU').format(Math.round(order.totalBudgetRub))} ₽`
      : 'Договорная';
  const payerText = order.companyOrInn?.trim()
    ? order.companyOrInn.trim()
    : 'Реквизиты не указаны (можно заполнить по ИНН в личном кабинете)';
  const isReady =
    order.stage === 'on_air' ||
    order.stage === 'completed_ltv' ||
    order.approvalWorkflow?.phase === 'accepted';
  const docsList = isReady
    ? 'Счёт на оплату, договор, акт сдачи-приёмки и паспорт прав РАО/ВОИС'
    : 'Счёт на оплату, договор и черновик паспорта прав РАО/ВОИС';

  const lines = [
    `FMWorks · Документы для бухгалтерии — заказ #${order.orderNumber} от ${formattedDate}`,
    `Услуга: ${cleanTitle}`,
    `Сумма: ${amountText}`,
    `Плательщик: ${payerText}`,
    `Доступные документы: ${docsList}`,
  ];
  if (cabinetUrl?.trim()) {
    lines.push(`Личный кабинет клиента: ${cabinetUrl.trim()}`);
  }
  return lines.join('\n');
}

export type CabinetExportPeriodId = 'all' | 'quarter' | 'year';

export const CABINET_EXPORT_PERIOD_LABELS: Record<CabinetExportPeriodId, string> = {
  all: 'Все проекты',
  quarter: 'Текущий квартал',
  year: 'Текущий год',
};

/**
 * Фильтрует список заказов клиента по отчётному периоду бухгалтерии (все, текущий квартал, текущий год).
 */
export function filterOrdersByExportPeriod<
  T extends Pick<ClientCabinetOrderSummary, 'createdAt'>,
>(
  orders: readonly T[],
  period: CabinetExportPeriodId,
  nowMs = Date.now()
): T[] {
  if (period === 'all') {
    return [...orders];
  }
  const now = new Date(nowMs);
  const currentYear = now.getUTCFullYear();
  const currentQuarter = Math.floor(now.getUTCMonth() / 3);

  return orders.filter((order) => {
    const parsed = new Date(order.createdAt);
    if (Number.isNaN(parsed.getTime())) return false;
    if (period === 'year') {
      return parsed.getUTCFullYear() === currentYear;
    }
    return (
      parsed.getUTCFullYear() === currentYear &&
      Math.floor(parsed.getUTCMonth() / 3) === currentQuarter
    );
  });
}

export interface AccountingReconciliationSummary {
  ordersCount: number;
  totalBudgetRub: number;
  readyDocsCount: number;
  inWorkCount: number;
}

/**
 * Считает итоговую бухгалтерскую сводку по выбранному срезу заказов.
 */
export function buildAccountingReconciliationSummary(
  orders: readonly Pick<
    ClientCabinetOrderSummary,
    'totalBudgetRub' | 'stage' | 'deliverables' | 'approvalWorkflow'
  >[]
): AccountingReconciliationSummary {
  let totalBudgetRub = 0;
  let readyDocsCount = 0;
  let inWorkCount = 0;

  for (const order of orders) {
    if (typeof order.totalBudgetRub === 'number' && order.totalBudgetRub > 0) {
      totalBudgetRub += Math.round(order.totalBudgetRub);
    }
    const isReady =
      order.stage === 'on_air' ||
      order.stage === 'completed_ltv' ||
      order.approvalWorkflow?.phase === 'accepted' ||
      extractOrderMasterFiles(order).masterFiles.length > 0;
    if (isReady) {
      readyDocsCount += 1;
    } else {
      inWorkCount += 1;
    }
  }

  return {
    ordersCount: orders.length,
    totalBudgetRub,
    readyDocsCount,
    inWorkCount,
  };
}

function escapeCsvCellSemicolon(raw: string): string {
  const safe = raw.replace(/\r?\n/g, ' ').trim();
  if (safe.includes(';') || safe.includes('"')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function formatShortRuDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Генерирует Excel-совместимый реестр заказов для бухгалтерии в формате CSV (UTF-8 BOM + разделитель `;`).
 */
export function buildAccountingLedgerCsv(
  orders: readonly Pick<
    ClientCabinetOrderSummary,
    | 'orderNumber'
    | 'createdAt'
    | 'formatLabel'
    | 'companyOrInn'
    | 'totalBudgetRub'
    | 'stage'
    | 'deliverables'
    | 'approvalWorkflow'
  >[]
): string {
  const header = [
    'Номер заказа',
    'Дата',
    'Формат услуги',
    'Плательщик / ИНН',
    'Сумма (руб.)',
    'Статус',
    'Закрывающие документы',
    'Мастер WAV',
  ];

  const rows = orders.map((order) => {
    const cleanTitle = stripTrailingPriceFromOrderTitle(
      order.formatLabel,
      order.totalBudgetRub
    );
    const visual = resolveCabinetOrderVisualStatus(order);
    const { masterFiles } = extractOrderMasterFiles(order);
    const isReady =
      order.stage === 'on_air' ||
      order.stage === 'completed_ltv' ||
      order.approvalWorkflow?.phase === 'accepted' ||
      masterFiles.length > 0;

    return [
      `#${order.orderNumber}`,
      formatShortRuDate(order.createdAt),
      cleanTitle,
      order.companyOrInn?.trim() || 'Не указаны',
      order.totalBudgetRub > 0 ? String(Math.round(order.totalBudgetRub)) : 'Договорная',
      visual.label,
      isReady ? 'Счёт, договор, акт, паспорт РАО/ВОИС' : 'Счёт и договор',
      masterFiles.length > 0 ? `Готов (${masterFiles.length})` : 'В производстве',
    ]
      .map(escapeCsvCellSemicolon)
      .join(';');
  });

  const summary = buildAccountingReconciliationSummary(orders);
  const totalRow = [
    'ИТОГО',
    '',
    `Проектов: ${summary.ordersCount}`,
    '',
    String(summary.totalBudgetRub),
    '',
    `С актами: ${summary.readyDocsCount}`,
    '',
  ]
    .map(escapeCsvCellSemicolon)
    .join(';');

  return `\uFEFF${[header.join(';'), ...rows, totalRow].join('\r\n')}`;
}

/**
 * Формирует текстовую ведомость по проектам для мгновенной пересылки бухгалтеру в почту или мессенджер.
 */
export function buildAccountingLedgerPlainText(
  orders: readonly Pick<
    ClientCabinetOrderSummary,
    | 'orderNumber'
    | 'createdAt'
    | 'formatLabel'
    | 'companyOrInn'
    | 'totalBudgetRub'
    | 'stage'
    | 'deliverables'
    | 'approvalWorkflow'
  >[],
  periodLabel: string
): string {
  const summary = buildAccountingReconciliationSummary(orders);
  const formattedTotal = new Intl.NumberFormat('ru-RU').format(summary.totalBudgetRub);
  const lines = [
    `FMWorks · Реестр заказов для бухгалтерии (${periodLabel})`,
    `Проектов: ${summary.ordersCount} · Итого: ${formattedTotal} ₽ · С закрывающими актами: ${summary.readyDocsCount}`,
    '',
  ];

  for (const order of orders) {
    const cleanTitle = stripTrailingPriceFromOrderTitle(
      order.formatLabel,
      order.totalBudgetRub
    );
    const visual = resolveCabinetOrderVisualStatus(order);
    const amount =
      order.totalBudgetRub > 0
        ? `${new Intl.NumberFormat('ru-RU').format(Math.round(order.totalBudgetRub))} ₽`
        : 'Договорная';
    const payer = order.companyOrInn?.trim() ? ` · ${order.companyOrInn.trim()}` : '';
    lines.push(
      `• #${order.orderNumber} от ${formatShortRuDate(order.createdAt)} — ${cleanTitle} — ${amount} (${visual.label})${payer}`
    );
  }

  return lines.join('\n');
}

export interface GuestReviewAudioVersion {
  id: string;
  versionCode: string;
  stageLabel: string;
  title: string;
  fileName: string;
  versionNote?: string;
  sizeBytes: number;
  uploadedAt: string;
  isFinalMaster: boolean;
  isCurrentLatest: boolean;
  previewUrl: string;
  downloadUrl: string;
}

export interface GuestOrderReviewPayload {
  orderNumber: string;
  createdAt: string;
  formatTitle: string;
  stageBadgeLabel: string;
  targetSlotSec: number;
  briefText?: string;
  approvalWorkflow: ClientCabinetOrderSummary['approvalWorkflow'];
  audioVersions: GuestReviewAudioVersion[];
  progressionChainText: string;
}

/**
 * Формирует лаконичное заключение руководителя по гостевой ссылке для отправки коллеге.
 */
export function buildDirectorFeedbackClipboardText(params: {
  orderNumber: string;
  formatTitle: string;
  verdict: 'approved' | 'needs_edits';
  comment?: string;
}): string {
  const verdictLine =
    params.verdict === 'approved'
      ? 'Согласовано, можно утверждать в личном кабинете FMWorks.'
      : 'Нужны корректировки перед утверждением в личном кабинете FMWorks.';
  const cleanComment = (params.comment ?? '').trim();
  const lines = [
    `Согласование аудиоролика #${params.orderNumber} (${params.formatTitle})`,
    `Решение: ${verdictLine}`,
  ];
  if (cleanComment) {
    lines.push(`Комментарий: ${cleanComment}`);
  }
  return lines.join('\n');
}


