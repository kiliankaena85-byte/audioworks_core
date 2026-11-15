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
 * Фильтрует список проектов в разделе «История заказов» по визуальному статусу
 * («В работе», «На согласовании», «Готово»), поисковому запросу и флагу наличия мастер-файлов.
 */
export function filterCabinetHistoryOrders(
  historyOrders: readonly ClientCabinetOrderSummary[],
  criteria: {
    searchQuery?: string;
    onlyWithMasters?: boolean;
    statusFilter?: CabinetHistoryStatusFilter;
  }
): ClientCabinetOrderSummary[] {
  const normalizedQuery = (criteria.searchQuery ?? '').trim().toLowerCase();
  const onlyMasters = Boolean(criteria.onlyWithMasters);
  const statusFilter = criteria.statusFilter ?? 'all';

  return historyOrders.filter((order) => {
    const visualStatus = resolveCabinetOrderVisualStatus(order);
    if (statusFilter !== 'all' && visualStatus.statusId !== statusFilter) {
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
