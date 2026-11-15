import { scrubPersonalDataFromText } from '../security/rfLegalCompliance.ts';
import type { CrmOrderRecord, CrmOrderStage } from './orderCrmTypes.ts';
import { formatStatusTimestampUtcPlus3 } from './telegramOrderNotifications.ts';

export const ORDERED_CRM_STAGE_IDS: readonly CrmOrderStage[] = [
  'new_hold',
  'quota_locked',
  'edo_invoice',
  'in_production',
  'on_air',
  'completed_ltv',
] as const;

export type OrderStageHistoryActor =
  | 'system_created'
  | 'producer_crm'
  | 'client_cabinet'
  | 'sound_engineer'
  | 'system_sla';

export type OrderStageTransitionDirection =
  | 'created'
  | 'forward'
  | 'rollback'
  | 'milestone';

export interface OrderStageHistoryEntry {
  id: string;
  timestamp: string;
  previousStage: CrmOrderStage | null;
  nextStage: CrmOrderStage;
  actor: OrderStageHistoryActor;
  /** Имя или подразделение ответственного сотрудника (например, «Илья Громов») */
  actorName?: string | null;
  workflowStepLabel?: string | null;
  note?: string | null;
  /** Длительность нахождения заказа на предыдущем этапе (в миллисекундах) */
  durationFromPrevMs?: number | null;
}

export interface AppendOrderStageHistoryInput {
  id?: string;
  timestamp?: string;
  previousStage?: CrmOrderStage | null;
  nextStage: CrmOrderStage;
  actor: OrderStageHistoryActor;
  actorName?: string | null;
  workflowStepLabel?: string | null;
  note?: string | null;
}

export type StageHistoryDatePreset =
  | 'all'
  | 'today'
  | 'last_24h'
  | 'last_7d'
  | 'last_30d'
  | 'custom_date';

export type StageHistorySortMode =
  | 'date_desc'
  | 'date_asc'
  | 'actor_asc'
  | 'actor_desc'
  | 'stage_asc'
  | 'stage_desc';

export interface StageHistoryQueryState {
  datePreset: StageHistoryDatePreset;
  /** Точная дата YYYY-MM-DD в часовом поясе студии (UTC+3) при выборе custom_date */
  exactDateYmd?: string;
  /** Ключ ответственного сотрудника / роли ('all' — все ответственные) */
  actorKey: string;
  /** Конкретный этап изменения ('all' — все этапы) */
  stageFilter: 'all' | CrmOrderStage;
  /** Область событий ('all' — все перемещения, 'stage_only' — только смены этапов) */
  eventScope?: 'all' | 'stage_only';
  /** Направление и поле сортировки лога */
  sortBy: StageHistorySortMode;
}

export interface EnrichedStageHistoryItem {
  entry: OrderStageHistoryEntry;
  stepOrdinal: number;
  direction: OrderStageTransitionDirection;
  responsibleKey: string;
  responsibleLabel: string;
  dateYmdUtcPlus3: string;
  timestampMs: number;
}

export interface StageHistoryActorOption {
  key: string;
  label: string;
  count: number;
}

export interface StageHistoryFilterFacets {
  actors: StageHistoryActorOption[];
  stageCounts: Record<CrmOrderStage, number>;
  milestoneCount: number;
  stageChangeCount: number;
  latestDateYmd: string;
}

export const DEFAULT_STAGE_HISTORY_QUERY_STATE: Readonly<StageHistoryQueryState> = {
  datePreset: 'all',
  exactDateYmd: '',
  actorKey: 'all',
  stageFilter: 'all',
  eventScope: 'all',
  sortBy: 'date_desc',
};

const MAX_STAGE_HISTORY_ENTRIES = 60;

const STAGE_TRANSITION_WEIGHTS: Readonly<Record<CrmOrderStage, number>> = {
  new_hold: 0,
  quota_locked: 1,
  edo_invoice: 2,
  in_production: 3,
  on_air: 5,
  completed_ltv: 4,
};

const VALID_ACTORS = new Set<OrderStageHistoryActor>([
  'system_created',
  'producer_crm',
  'client_cabinet',
  'sound_engineer',
  'system_sla',
]);

export function isValidCrmOrderStageId(value: unknown): value is CrmOrderStage {
  return (
    typeof value === 'string' &&
    (ORDERED_CRM_STAGE_IDS as readonly string[]).includes(value)
  );
}

export function getCrmStageOrderIndex(stage: CrmOrderStage): number {
  const idx = ORDERED_CRM_STAGE_IDS.indexOf(stage);
  return idx >= 0 ? idx : 0;
}

export function computeStageRouteStepState(
  currentStage: CrmOrderStage,
  stepStage: CrmOrderStage
): 'completed' | 'current' | 'upcoming' {
  const currentIdx = getCrmStageOrderIndex(currentStage);
  const stepIdx = getCrmStageOrderIndex(stepStage);
  if (stepIdx < currentIdx) return 'completed';
  if (stepIdx === currentIdx) return 'current';
  return 'upcoming';
}

export function resolveStageTransitionDirection(
  previousStage: CrmOrderStage | null,
  nextStage: CrmOrderStage
): OrderStageTransitionDirection {
  if (previousStage === null) {
    return 'created';
  }
  if (previousStage === nextStage) {
    return 'milestone';
  }
  return getCrmStageOrderIndex(nextStage) > getCrmStageOrderIndex(previousStage)
    ? 'forward'
    : 'rollback';
}

export function formatStageHistoryActorLabel(
  actor: OrderStageHistoryActor
): string {
  switch (actor) {
    case 'system_created':
      return 'Система приёма заявок';
    case 'client_cabinet':
      return 'Клиент (личный кабинет)';
    case 'sound_engineer':
      return 'Звукорежиссёр (шлюз ОТК)';
    case 'system_sla':
      return 'Автоконтроль SLA';
    case 'producer_crm':
    default:
      return 'Продюсер студии (CRM)';
  }
}

export function formatStageHistoryTimestamp(iso: string): string {
  return formatStatusTimestampUtcPlus3(iso);
}

/**
 * Возвращает календарную дату YYYY-MM-DD в часовом поясе студии (UTC+3) без привязки к локали ОС.
 */
export function formatIsoToUtcPlus3Ymd(iso: string): string {
  const parsedMs = Date.parse(iso);
  const safeMs = Number.isFinite(parsedMs) ? parsedMs : Date.now();
  const utcPlus3Ms = safeMs + 3 * 3_600_000;
  return new Date(utcPlus3Ms).toISOString().slice(0, 10);
}

/**
 * Определяет ключ и отображаемое имя ответственного сотрудника / роли для записи истории.
 */
export function resolveStageHistoryResponsibleInfo(
  entry: Pick<
    OrderStageHistoryEntry,
    'actor' | 'actorName' | 'workflowStepLabel'
  >,
  assignedEngineerName?: string | null
): { key: string; label: string } {
  const explicitName = cleanOptionalText(entry.actorName, 80);

  if (entry.actor === 'sound_engineer') {
    const labelMatch = entry.workflowStepLabel?.match(
      /Звукорежиссёр\s*\(([^)]+)\)/
    );
    const extractedFromStep = cleanOptionalText(labelMatch?.[1], 80);
    const fallbackEng = cleanOptionalText(assignedEngineerName, 80);
    const engineerName = explicitName || extractedFromStep || fallbackEng;
    if (engineerName) {
      return {
        key: `sound_engineer:${engineerName}`,
        label: `Звукорежиссёр · ${engineerName}`,
      };
    }
    return {
      key: 'sound_engineer',
      label: formatStageHistoryActorLabel('sound_engineer'),
    };
  }

  if (entry.actor === 'producer_crm') {
    if (explicitName) {
      return {
        key: `producer_crm:${explicitName}`,
        label: `Продюсер · ${explicitName}`,
      };
    }
    return {
      key: 'producer_crm',
      label: formatStageHistoryActorLabel('producer_crm'),
    };
  }

  return {
    key: entry.actor,
    label: formatStageHistoryActorLabel(entry.actor),
  };
}

export function formatStageDwellDurationRu(
  durationMs: number | null | undefined
): string {
  if (
    durationMs === null ||
    durationMs === undefined ||
    !Number.isFinite(durationMs) ||
    durationMs < 0
  ) {
    return '';
  }
  const totalSec = Math.floor(durationMs / 1000);
  if (totalSec <= 5) {
    return 'менее 5 сек';
  }
  if (totalSec < 60) {
    return `${totalSec} сек`;
  }
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) {
    return `${totalMin} мин`;
  }
  const totalHours = Math.floor(totalMin / 60);
  const remMin = totalMin % 60;
  if (totalHours < 24) {
    return remMin > 0 ? `${totalHours} ч ${remMin} мин` : `${totalHours} ч`;
  }
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  return remHours > 0 ? `${days} дн. ${remHours} ч` : `${days} дн.`;
}

function cleanOptionalText(
  raw: string | null | undefined,
  maxLen = 240
): string | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.replace(/\s+/g, ' ').trim().slice(0, maxLen);
  return normalized || null;
}

function resolveBackfilledWorkflowLabel(
  stage: CrmOrderStage,
  checkoutMode: 'air_plus_production' | 'production_only'
): string {
  switch (stage) {
    case 'new_hold':
      return checkoutMode === 'air_plus_production'
        ? 'Заявка и резерв эфирной квоты зарегистрированы в CRM'
        : 'Заявка на аудиопродакшн зарегистрирована в CRM';
    case 'quota_locked':
      return checkoutMode === 'air_plus_production'
        ? 'Квота на радиостанциях проверена и закреплена за сделкой'
        : 'Реквизиты контрагента и бриф подтверждены продюсером';
    case 'edo_invoice':
      return 'Сформирован и направлен единый договор-счёт';
    case 'in_production':
      return 'Оплата подтверждена · заказ передан в студийное производство';
    case 'on_air':
      return checkoutMode === 'air_plus_production'
        ? 'Мастер −14 LUFS и паспорт прав переданы в эфир'
        : 'Финальный мастер-ролик и паспорт прав переданы заказчику';
    case 'completed_ltv':
      return 'Закрывающий акт подписан в ЭДО · сделка завершена';
  }
}

function findStageEntryTimestampMs(
  history: readonly OrderStageHistoryEntry[],
  stage: CrmOrderStage,
  fallbackMs: number
): number {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const item = history[i];
    if (item.nextStage === stage && item.previousStage !== stage) {
      const parsed = Date.parse(item.timestamp);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  const last = history[history.length - 1];
  if (last) {
    const parsed = Date.parse(last.timestamp);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallbackMs;
}

function capStageHistoryEntries(
  entries: OrderStageHistoryEntry[]
): OrderStageHistoryEntry[] {
  if (entries.length <= MAX_STAGE_HISTORY_ENTRIES) {
    return entries;
  }
  const firstEntry = entries[0];
  const tail = entries.slice(-(MAX_STAGE_HISTORY_ENTRIES - 1));
  return firstEntry ? [firstEntry, ...tail] : tail;
}

function normalizeExistingStageHistory(
  rawEntries: readonly unknown[],
  order: Pick<
    CrmOrderRecord,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'stage'
    | 'checkoutMode'
    | 'pdnAnonymizedAt'
  >
): OrderStageHistoryEntry[] {
  const createdMs = Number.isFinite(Date.parse(order.createdAt))
    ? Date.parse(order.createdAt)
    : Date.now();

  const valid: OrderStageHistoryEntry[] = [];
  rawEntries.forEach((rawItem, index) => {
    if (!rawItem || typeof rawItem !== 'object') return;
    const obj = rawItem as Record<string, unknown>;
    if (!isValidCrmOrderStageId(obj.nextStage)) return;

    const prevStage =
      obj.previousStage === null || obj.previousStage === undefined
        ? null
        : isValidCrmOrderStageId(obj.previousStage)
          ? obj.previousStage
          : null;

    const parsedTs =
      typeof obj.timestamp === 'string' && Number.isFinite(Date.parse(obj.timestamp))
        ? Date.parse(obj.timestamp)
        : createdMs + index * 1000;

    const actor: OrderStageHistoryActor =
      typeof obj.actor === 'string' &&
      VALID_ACTORS.has(obj.actor as OrderStageHistoryActor)
        ? (obj.actor as OrderStageHistoryActor)
        : prevStage === null
          ? 'system_created'
          : 'producer_crm';

    const id =
      typeof obj.id === 'string' && obj.id.trim()
        ? obj.id.trim().slice(0, 96)
        : `hist-${order.id}-${index}`;

    const rawDuration = obj.durationFromPrevMs;
    const explicitDuration =
      typeof rawDuration === 'number' &&
      Number.isFinite(rawDuration) &&
      rawDuration >= 0
        ? Math.round(rawDuration)
        : undefined;

    const rawActorName = cleanOptionalText(
      typeof obj.actorName === 'string' ? obj.actorName : null,
      80
    );

    valid.push({
      id,
      timestamp: new Date(parsedTs).toISOString(),
      previousStage: prevStage,
      nextStage: obj.nextStage,
      actor,
      ...(rawActorName && !(order.pdnAnonymizedAt && actor === 'client_cabinet')
        ? { actorName: rawActorName }
        : {}),
      workflowStepLabel: cleanOptionalText(
        typeof obj.workflowStepLabel === 'string' ? obj.workflowStepLabel : null,
        240
      ),
      note: order.pdnAnonymizedAt
        ? null
        : cleanOptionalText(typeof obj.note === 'string' ? obj.note : null, 280),
      durationFromPrevMs: prevStage === null ? null : explicitDuration ?? null,
    });
  });

  valid.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  // Досчитываем durationFromPrevMs для записей, где он не был проставлен
  const hydrated: OrderStageHistoryEntry[] = [];
  for (const entry of valid) {
    if (entry.previousStage === null) {
      hydrated.push({ ...entry, durationFromPrevMs: null });
      continue;
    }
    if (
      typeof entry.durationFromPrevMs === 'number' &&
      Number.isFinite(entry.durationFromPrevMs)
    ) {
      hydrated.push(entry);
      continue;
    }
    const entryMs = Date.parse(entry.timestamp);
    const refMs =
      entry.previousStage === entry.nextStage
        ? hydrated.length > 0
          ? Date.parse(hydrated[hydrated.length - 1].timestamp)
          : createdMs
        : findStageEntryTimestampMs(hydrated, entry.previousStage, createdMs);
    hydrated.push({
      ...entry,
      durationFromPrevMs: Math.max(0, entryMs - refMs),
    });
  }

  return capStageHistoryEntries(hydrated);
}

/**
 * Формирует детерминированную хронологию переходов по этапам для существующих и демо-заказов,
 * если поле stageHistory ещё не было записано на диск, а также синхронизирует расхождения с order.stage.
 */
export function buildBackfilledOrderStageHistory(
  order: Pick<
    CrmOrderRecord,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'stage'
    | 'checkoutMode'
    | 'producerNotes'
    | 'pdnAnonymizedAt'
  >
): OrderStageHistoryEntry[] {
  const createdMs = Number.isFinite(Date.parse(order.createdAt))
    ? Date.parse(order.createdAt)
    : Date.now();
  const rawUpdatedMs = Number.isFinite(Date.parse(order.updatedAt))
    ? Date.parse(order.updatedAt)
    : createdMs;
  const updatedMs = Math.max(createdMs, rawUpdatedMs);
  const targetIdx = getCrmStageOrderIndex(order.stage);
  const checkoutMode = order.checkoutMode ?? 'production_only';

  const entries: OrderStageHistoryEntry[] = [
    {
      id: `hist-${order.id}-00-created`,
      timestamp: new Date(createdMs).toISOString(),
      previousStage: null,
      nextStage: 'new_hold',
      actor: 'system_created',
      workflowStepLabel: resolveBackfilledWorkflowLabel('new_hold', checkoutMode),
      note: null,
      durationFromPrevMs: null,
    },
  ];

  if (targetIdx === 0) {
    return entries;
  }

  let totalWeight = 0;
  for (let i = 1; i <= targetIdx; i += 1) {
    totalWeight += STAGE_TRANSITION_WEIGHTS[ORDERED_CRM_STAGE_IDS[i]] || 1;
  }

  const totalSpanMs = Math.max(0, updatedMs - createdMs);
  let cumulativeWeight = 0;
  let prevStepMs = createdMs;

  for (let i = 1; i <= targetIdx; i += 1) {
    const prevStage = ORDERED_CRM_STAGE_IDS[i - 1];
    const stage = ORDERED_CRM_STAGE_IDS[i];
    cumulativeWeight += STAGE_TRANSITION_WEIGHTS[stage] || 1;

    const rawStepMs =
      i === targetIdx
        ? updatedMs
        : createdMs + Math.round((totalSpanMs * cumulativeWeight) / totalWeight);
    const stepMs = Math.max(prevStepMs, Math.min(updatedMs, rawStepMs));
    const isFinalTarget = i === targetIdx;
    const cleanNote =
      isFinalTarget && !order.pdnAnonymizedAt
        ? cleanOptionalText(order.producerNotes, 240)
        : null;

    entries.push({
      id: `hist-${order.id}-0${i}-${stage}`,
      timestamp: new Date(stepMs).toISOString(),
      previousStage: prevStage,
      nextStage: stage,
      actor: 'producer_crm',
      workflowStepLabel: resolveBackfilledWorkflowLabel(stage, checkoutMode),
      note: cleanNote,
      durationFromPrevMs: Math.max(0, stepMs - prevStepMs),
    });

    prevStepMs = stepMs;
  }

  return entries;
}

export function ensureOrderStageHistory(order: CrmOrderRecord): CrmOrderRecord {
  const rawHistory = order.stageHistory;
  let normalized =
    Array.isArray(rawHistory) && rawHistory.length > 0
      ? normalizeExistingStageHistory(rawHistory, order)
      : [];

  if (normalized.length === 0) {
    normalized = buildBackfilledOrderStageHistory(order);
    return {
      ...order,
      stageHistory: normalized,
    };
  }

  const latest = normalized[normalized.length - 1];
  if (latest && latest.nextStage !== order.stage) {
    const fallbackCreatedMs = Number.isFinite(Date.parse(order.createdAt))
      ? Date.parse(order.createdAt)
      : Date.now();
    const latestMs = Date.parse(latest.timestamp);
    const updatedMs = Number.isFinite(Date.parse(order.updatedAt))
      ? Math.max(latestMs, Date.parse(order.updatedAt))
      : latestMs;
    const enteredPrevMs = findStageEntryTimestampMs(
      normalized,
      latest.nextStage,
      fallbackCreatedMs
    );

    normalized = capStageHistoryEntries([
      ...normalized,
      {
        id: `hist-${order.id}-sync-${updatedMs}`,
        timestamp: new Date(updatedMs).toISOString(),
        previousStage: latest.nextStage,
        nextStage: order.stage,
        actor: 'producer_crm',
        workflowStepLabel: resolveBackfilledWorkflowLabel(
          order.stage,
          order.checkoutMode
        ),
        note: null,
        durationFromPrevMs: Math.max(0, updatedMs - enteredPrevMs),
      },
    ]);
  }

  return {
    ...order,
    stageHistory: normalized,
  };
}

/**
 * Записывает новый переход заказа между этапами (или значимую производственную веху внутри этапа)
 * с расчётом фактического времени пребывания на предыдущем этапе.
 */
export function recordOrderStageTransition(
  existingOrder: CrmOrderRecord,
  input: AppendOrderStageHistoryInput
): OrderStageHistoryEntry[] {
  const hydratedExisting = ensureOrderStageHistory(existingOrder);
  const baseHistory = hydratedExisting.stageHistory ?? [];
  const createdMs = Number.isFinite(Date.parse(existingOrder.createdAt))
    ? Date.parse(existingOrder.createdAt)
    : Date.now();

  const previousStage =
    input.previousStage !== undefined ? input.previousStage : existingOrder.stage;
  const nowMs =
    input.timestamp && Number.isFinite(Date.parse(input.timestamp))
      ? Date.parse(input.timestamp)
      : Date.now();
  const lastEntry = baseHistory[baseHistory.length - 1];
  const lastMs = lastEntry ? Date.parse(lastEntry.timestamp) : createdMs;
  const effectiveMs = Math.max(Number.isFinite(lastMs) ? lastMs : createdMs, nowMs);

  let durationFromPrevMs: number | null = null;
  if (previousStage !== null) {
    if (previousStage === input.nextStage) {
      durationFromPrevMs = Math.max(
        0,
        effectiveMs - (Number.isFinite(lastMs) ? lastMs : createdMs)
      );
    } else {
      const enteredPrevMs = findStageEntryTimestampMs(
        baseHistory,
        previousStage,
        createdMs
      );
      durationFromPrevMs = Math.max(0, effectiveMs - enteredPrevMs);
    }
  }

  const cleanActorName = cleanOptionalText(input.actorName, 80);
  const nextEntry: OrderStageHistoryEntry = {
    id:
      input.id && input.id.trim()
        ? input.id.trim().slice(0, 96)
        : `hist-${existingOrder.id}-${effectiveMs}-${baseHistory.length + 1}`,
    timestamp: new Date(effectiveMs).toISOString(),
    previousStage,
    nextStage: input.nextStage,
    actor: input.actor,
    ...(cleanActorName &&
    !(existingOrder.pdnAnonymizedAt && input.actor === 'client_cabinet')
      ? { actorName: cleanActorName }
      : {}),
    workflowStepLabel: cleanOptionalText(input.workflowStepLabel, 240),
    note: existingOrder.pdnAnonymizedAt
      ? null
      : cleanOptionalText(input.note, 280),
    durationFromPrevMs,
  };

  return capStageHistoryEntries([...baseHistory, nextEntry]);
}

/**
 * Очищает свободные комментарии из истории перемещений при обезличивании ПДн по ст. 21 152-ФЗ,
 * сохраняя временные метки и коды этапов для производственного и бухгалтерского учёта.
 */
export function scrubOrderStageHistoryPdn(
  history: readonly OrderStageHistoryEntry[] | undefined
): OrderStageHistoryEntry[] {
  if (!Array.isArray(history) || history.length === 0) {
    return [];
  }
  return history.map((entry) => ({
    ...entry,
    ...(entry.actor === 'client_cabinet' ? { actorName: null } : {}),
    workflowStepLabel: entry.workflowStepLabel
      ? scrubPersonalDataFromText(entry.workflowStepLabel).slice(0, 240)
      : null,
    note: null,
  }));
}

export function hasActiveStageHistoryFilters(
  query: StageHistoryQueryState
): boolean {
  return (
    query.datePreset !== 'all' ||
    Boolean(query.exactDateYmd?.trim()) ||
    query.actorKey !== 'all' ||
    query.stageFilter !== 'all' ||
    (query.eventScope ?? 'all') !== 'all'
  );
}

export function isStageHistoryQueryModified(
  query: StageHistoryQueryState
): boolean {
  return hasActiveStageHistoryFilters(query) || query.sortBy !== 'date_desc';
}

function enrichStageHistoryEntries(
  entries: readonly OrderStageHistoryEntry[],
  assignedEngineerName?: string | null
): EnrichedStageHistoryItem[] {
  return entries.map((entry, idx) => {
    const parsedMs = Date.parse(entry.timestamp);
    const timestampMs = Number.isFinite(parsedMs) ? parsedMs : 0;
    const responsible = resolveStageHistoryResponsibleInfo(
      entry,
      assignedEngineerName
    );
    return {
      entry,
      stepOrdinal: idx + 1,
      direction: resolveStageTransitionDirection(
        entry.previousStage,
        entry.nextStage
      ),
      responsibleKey: responsible.key,
      responsibleLabel: responsible.label,
      dateYmdUtcPlus3: formatIsoToUtcPlus3Ymd(entry.timestamp),
      timestampMs,
    };
  });
}

/**
 * Собирает фасеты фильтрации (список ответственных сотрудников с количеством записей,
 * счётчики по каждому из 6 этапов и последнюю дату события в UTC+3).
 */
export function collectStageHistoryFilterFacets(
  entries: readonly OrderStageHistoryEntry[],
  options?: { assignedEngineerName?: string | null }
): StageHistoryFilterFacets {
  const enriched = enrichStageHistoryEntries(
    entries,
    options?.assignedEngineerName
  );

  const stageCounts: Record<CrmOrderStage, number> = {
    new_hold: 0,
    quota_locked: 0,
    edo_invoice: 0,
    in_production: 0,
    on_air: 0,
    completed_ltv: 0,
  };

  const actorMap = new Map<string, StageHistoryActorOption>();
  let milestoneCount = 0;
  let latestDateYmd = '';
  let latestMs = -Infinity;

  for (const item of enriched) {
    stageCounts[item.entry.nextStage] =
      (stageCounts[item.entry.nextStage] ?? 0) + 1;

    if (item.direction === 'milestone') {
      milestoneCount += 1;
    }

    const existingActor = actorMap.get(item.responsibleKey);
    if (existingActor) {
      existingActor.count += 1;
    } else {
      actorMap.set(item.responsibleKey, {
        key: item.responsibleKey,
        label: item.responsibleLabel,
        count: 1,
      });
    }

    if (item.timestampMs >= latestMs) {
      latestMs = item.timestampMs;
      latestDateYmd = item.dateYmdUtcPlus3;
    }
  }

  const actors = Array.from(actorMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label, 'ru');
  });

  return {
    actors,
    stageCounts,
    milestoneCount,
    stageChangeCount: enriched.length - milestoneCount,
    latestDateYmd,
  };
}

/**
 * Выполняет фильтрацию лога истории изменений статусов заказа по дате/периоду,
 * ответственному сотруднику и конкретному этапу, а затем сортирует результат
 * по выбранному критерию (дате, ответственному или этапу).
 */
export function queryOrderStageHistoryEntries(
  entries: readonly OrderStageHistoryEntry[],
  query: StageHistoryQueryState,
  options?: {
    assignedEngineerName?: string | null;
    nowMs?: number;
  }
): EnrichedStageHistoryItem[] {
  const nowMs =
    typeof options?.nowMs === 'number' && Number.isFinite(options.nowMs)
      ? options.nowMs
      : Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const todayYmd = formatIsoToUtcPlus3Ymd(nowIso);
  const exactYmd = (query.exactDateYmd ?? '').trim();

  const enriched = enrichStageHistoryEntries(
    entries,
    options?.assignedEngineerName
  );

  const filtered = enriched.filter((item) => {
    if (query.eventScope === 'stage_only' && item.direction === 'milestone') {
      return false;
    }

    if (query.stageFilter !== 'all' && item.entry.nextStage !== query.stageFilter) {
      return false;
    }

    if (query.actorKey !== 'all') {
      const matchesResponsibleKey = item.responsibleKey === query.actorKey;
      const matchesBaseActor = item.entry.actor === query.actorKey;
      if (!matchesResponsibleKey && !matchesBaseActor) {
        return false;
      }
    }

    if (query.datePreset === 'custom_date') {
      if (exactYmd && item.dateYmdUtcPlus3 !== exactYmd) {
        return false;
      }
    } else if (exactYmd) {
      if (item.dateYmdUtcPlus3 !== exactYmd) {
        return false;
      }
    } else if (query.datePreset === 'today') {
      if (item.dateYmdUtcPlus3 !== todayYmd) {
        return false;
      }
    } else if (query.datePreset === 'last_24h') {
      if (item.timestampMs < nowMs - 24 * 3_600_000) {
        return false;
      }
    } else if (query.datePreset === 'last_7d') {
      if (item.timestampMs < nowMs - 7 * 24 * 3_600_000) {
        return false;
      }
    } else if (query.datePreset === 'last_30d') {
      if (item.timestampMs < nowMs - 30 * 24 * 3_600_000) {
        return false;
      }
    }

    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    switch (query.sortBy) {
      case 'date_asc': {
        if (a.timestampMs !== b.timestampMs) {
          return a.timestampMs - b.timestampMs;
        }
        return a.stepOrdinal - b.stepOrdinal;
      }
      case 'actor_asc': {
        const cmp = a.responsibleLabel.localeCompare(b.responsibleLabel, 'ru');
        if (cmp !== 0) return cmp;
        if (b.timestampMs !== a.timestampMs) {
          return b.timestampMs - a.timestampMs;
        }
        return b.stepOrdinal - a.stepOrdinal;
      }
      case 'actor_desc': {
        const cmp = b.responsibleLabel.localeCompare(a.responsibleLabel, 'ru');
        if (cmp !== 0) return cmp;
        if (b.timestampMs !== a.timestampMs) {
          return b.timestampMs - a.timestampMs;
        }
        return b.stepOrdinal - a.stepOrdinal;
      }
      case 'stage_asc': {
        const idxDiff =
          getCrmStageOrderIndex(a.entry.nextStage) -
          getCrmStageOrderIndex(b.entry.nextStage);
        if (idxDiff !== 0) return idxDiff;
        if (a.timestampMs !== b.timestampMs) {
          return a.timestampMs - b.timestampMs;
        }
        return a.stepOrdinal - b.stepOrdinal;
      }
      case 'stage_desc': {
        const idxDiff =
          getCrmStageOrderIndex(b.entry.nextStage) -
          getCrmStageOrderIndex(a.entry.nextStage);
        if (idxDiff !== 0) return idxDiff;
        if (b.timestampMs !== a.timestampMs) {
          return b.timestampMs - a.timestampMs;
        }
        return b.stepOrdinal - a.stepOrdinal;
      }
      case 'date_desc':
      default: {
        if (b.timestampMs !== a.timestampMs) {
          return b.timestampMs - a.timestampMs;
        }
        return b.stepOrdinal - a.stepOrdinal;
      }
    }
  });

  return sorted;
}
