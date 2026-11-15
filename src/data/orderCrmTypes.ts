import type {
  FlexibleMediaPlanResult,
  TargetAudienceProfile,
} from './mediaPlannerCore.ts';
import type {
  ComputedReservationTotals,
  MediaGridReservationPayload,
} from './radioInventory.ts';
import {
  computeSlaDeadlineWindow,
  computeSmartHoldExpirationMs,
  DEFAULT_STUDIO_WORK_SCHEDULE,
  getCallbackPreferenceMeta,
  resolveStudioOperatingRegime,
  sanitizeWorkScheduleConfig,
  SLA_BREACH_COMPENSATION_NOTE,
} from './slaWorkCalendar.ts';
import type {
  ClientCallbackPreference,
  StudioOperatingRegimeId,
  StudioWorkScheduleConfig,
} from './slaWorkCalendar.ts';
import type { OrderDocumentMeta } from './studioDocumentsCore.ts';
import type {
  ClientDeliveryChannel,
  ClientUploadedAttachment,
  OrderDeliverableFile,
} from './clientCabinetHelpers.ts';
import { maskContactChannelSummary } from '../security/rfLegalCompliance.ts';
import {
  ensureOrderApprovalWorkflow,
  type OrderApprovalWorkflow,
} from './productionApprovalWorkflow.ts';

function formatRubCompact(amount: number): string {
  return `${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')} ₽`;
}

function formatNumberSpaced(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
}

function formatHoldCountdown(remainingSeconds: number): string {
  const clamped = Math.max(0, Math.floor(remainingSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')}`;
}

const NICHE_LABELS_BY_ID: Readonly<Record<string, string>> = {
  real_estate: 'Недвижимость и ЖК',
  b2b_finance: 'B2B и Финансы',
  fmcg_retail: 'Продукты и Ритейл',
  medicine: 'Медицина',
  auto_services: 'Авто и Услуги',
};

const SEGMENT_LABELS_BY_ID: Readonly<Record<string, string>> = {
  b2c_mass: 'B2C широкий спрос',
  b2c_premium: 'B2C бизнес и премиум',
  b2b_decision_makers: 'B2B и руководители',
};

const AGE_LABELS_BY_ID: Readonly<Record<string, string>> = {
  '20_35': '20–35 лет',
  '30_45': '30–45 лет',
  '35_55': '35–55 лет',
  '45_plus': '45+ лет',
};

const CONTEXT_LABELS_BY_ID: Readonly<Record<string, string>> = {
  commute_rush: 'За рулём в часах пик',
  office_daytime: 'Днём в делах и офисе',
  evening_leisure: 'Только вечерний прайм',
  weekend_family: 'Выходные и загород',
};

function formatAudienceSummaryLine(audience: TargetAudienceProfile): string {
  const seg = SEGMENT_LABELS_BY_ID[audience.segment] ?? 'B2C';
  const age = AGE_LABELS_BY_ID[audience.ageCore] ?? '30–45 лет';
  const ctx = CONTEXT_LABELS_BY_ID[audience.listeningContext] ?? 'В часах пик';
  return `${seg} · ${age} · ${ctx}`;
}

export type CrmOrderStage =
  | 'new_hold'
  | 'quota_locked'
  | 'edo_invoice'
  | 'in_production'
  | 'on_air'
  | 'completed_ltv';

export type OrderEntrySource =
  | 'order_page'
  | 'quick_order_drawer'
  | 'standalone_hold_modal';

export interface CrmStageMeta {
  id: CrmOrderStage;
  stepCode: string;
  shortLabel: string;
  fullTitle: string;
  slaHint: string;
  nextActionLabel: string | null;
  nextStage: CrmOrderStage | null;
}

export const CRM_ORDER_STAGES: readonly CrmStageMeta[] = [
  {
    id: 'new_hold',
    stepCode: '01',
    shortLabel: 'Новый резерв (4ч)',
    fullTitle: '01. Новый резерв · Холд квоты 4 часа',
    slaHint: 'SLA 15 минут: сверка сетки в трафик-службе радиостанций и звонок клиенту',
    nextActionLabel: 'Подтвердить квоту на станциях →',
    nextStage: 'quota_locked',
  },
  {
    id: 'quota_locked',
    stepCode: '02',
    shortLabel: 'Квота подтверждена',
    fullTitle: '02. Квота заблокирована за клиентом',
    slaHint: 'Слоты защищены от открытой продажи · согласование тайминга и пре-чек ФЗ-38',
    nextActionLabel: 'Выставить договор-счёт в ЭДО →',
    nextStage: 'edo_invoice',
  },
  {
    id: 'edo_invoice',
    stepCode: '03',
    shortLabel: 'Счёт в ЭДО',
    fullTitle: '03. Единый договор-счёт направлен в ЭДО',
    slaHint: 'Спецификация в Диадок / СБИС · фиксация скидки горящего эфира',
    nextActionLabel: 'Передать в продакшн / техконтроль →',
    nextStage: 'in_production',
  },
  {
    id: 'in_production',
    stepCode: '04',
    shortLabel: 'Ролик и паспорт',
    fullTitle: '04. Аудиопродакшн, мастеринг −14 LUFS и паспорт прав',
    slaHint: '3 сценария / запись диктора либо проверка готового спота и очистка РАО/ВОИС',
    nextActionLabel: 'Запустить ролик в радиоэфир →',
    nextStage: 'on_air',
  },
  {
    id: 'on_air',
    stepCode: '05',
    shortLabel: 'В эфире',
    fullTitle: '05. Кампания в эфире · Контроль выходов и Search Lift',
    slaHint: 'Мастер-файл на радиостанциях · мониторинг эфирной справки и отклика',
    nextActionLabel: 'Закрыть акты и рассчитать 2-ю волну →',
    nextStage: 'completed_ltv',
  },
  {
    id: 'completed_ltv',
    stepCode: '06',
    shortLabel: 'Завершён · LTV',
    fullTitle: '06. Флайт закрыт · Готов расчёт 2-й волны без оплаты ролика',
    slaHint: 'Акты в ЭДО подписаны · паспорт прав бессрочный (100% бюджета следующей волны в эфир)',
    nextActionLabel: null,
    nextStage: null,
  },
] as const;

export const STUDIO_PRODUCTION_CRM_STAGES: readonly CrmStageMeta[] = [
  {
    id: 'new_hold',
    stepCode: '01',
    shortLabel: 'Проверка заявки и реквизитов',
    fullTitle: '01. Проверка заявки и реквизитов · Договор и счёт',
    slaHint:
      'SLA 15 минут: сверка задачи с продюсером и подготовка счёта на оплату',
    nextActionLabel: 'Подтвердить контрагента и ТЗ →',
    nextStage: 'quota_locked',
  },
  {
    id: 'quota_locked',
    stepCode: '02',
    shortLabel: 'Контрагент подтверждён',
    fullTitle: '02. Контрагент и задача подтверждены продюсером',
    slaHint:
      'Бриф проверен · пре-чек ФЗ-38 · подготовка счёта или ссылки на оплату',
    nextActionLabel: 'Направить договор-счёт / ссылку оплаты →',
    nextStage: 'edo_invoice',
  },
  {
    id: 'edo_invoice',
    stepCode: '03',
    shortLabel: 'Счёт и предоплата',
    fullTitle: '03. Счёт выставлен · ожидание предоплаты',
    slaHint:
      'Счёт готов в личном кабинете или ЭДО · старт сценариев после поступления оплаты',
    nextActionLabel: 'Оплата получена · запустить продакшн →',
    nextStage: 'in_production',
  },
  {
    id: 'in_production',
    stepCode: '04',
    shortLabel: 'Сценарии и запись',
    fullTitle: '04. 3 сценария, запись диктора и паспорт прав РАО/ВОИС',
    slaHint:
      'Разработка 3 концепций, кастинг голосов кино, студийное сведение −14 LUFS',
    nextActionLabel: 'Передать мастер-файл заказчику →',
    nextStage: 'on_air',
  },
  {
    id: 'on_air',
    stepCode: '05',
    shortLabel: 'Мастер передан',
    fullTitle: '05. Мастер-ролик и паспорт прав переданы заказчику',
    slaHint:
      'WAV/MP3 файлы и паспорт РАО/ВОИС отправлены · подписание закрывающего акта в ЭДО',
    nextActionLabel: 'Подписать акт ЭДО и закрыть сделку →',
    nextStage: 'completed_ltv',
  },
  {
    id: 'completed_ltv',
    stepCode: '06',
    shortLabel: 'Закрыт в ЭДО',
    fullTitle: '06. Проект закрыт актом ЭДО · Права отчуждены бессрочно',
    slaHint:
      'Акт подписан · исключительные права у заказчика · профиль постоянного клиента',
    nextActionLabel: null,
    nextStage: null,
  },
] as const;

export function getCrmStageMeta(stage: CrmOrderStage): CrmStageMeta {
  return CRM_ORDER_STAGES.find((s) => s.id === stage) ?? CRM_ORDER_STAGES[0];
}

export function getCrmStageMetaForOrder(
  stage: CrmOrderStage,
  checkoutMode: 'air_plus_production' | 'production_only' = 'production_only'
): CrmStageMeta {
  if (checkoutMode === 'air_plus_production') {
    return getCrmStageMeta(stage);
  }
  return (
    STUDIO_PRODUCTION_CRM_STAGES.find((s) => s.id === stage) ??
    STUDIO_PRODUCTION_CRM_STAGES[0]
  );
}

export interface OrderStationLineSnapshot {
  slotId: string;
  stationName: string;
  frequencyFm: string;
  slotLabel: string;
  daysPattern: string;
  sampleTimeSlots: string[];
  spotsCount: number;
  spotSeconds: number;
  reachOTS: number;
  officialPriceRub: number;
  hotPriceRub: number;
  discountPercent: number;
}

export interface OrderMediaPlanSnapshot {
  nicheId: string;
  nicheLabel: string;
  audienceSummary: string;
  campaignGoal: 'promo_burst' | 'brand_system_3m';
  spotReadiness: 'need_production_24h' | 'ready_with_passport';
  spotDurationSec: number;
  productionStatusLabel: string;
  totalSpots: number;
  totalReachOTS: number;
  estimatedFrequency: number;
  officialAirTotalRub: number;
  hotAirTotalRub: number;
  productionPriceRub: number;
  totalSavingsRub: number;
  unifiedTotalRub: number;
  airDiscountPercent: number;
  stations: OrderStationLineSnapshot[];
}

export interface OrderComplianceChecklist {
  trafficConfirmed: boolean;
  fz38Checked: boolean;
  rightsPassportIssued: boolean;
  edoAndOrdRegistered: boolean;
}

export type ExternalDeliveryState =
  | 'delivered'
  | 'ready_simulated'
  | 'not_configured'
  | 'failed';

export interface ChannelDeliveryStatus {
  state: ExternalDeliveryState;
  updatedAt: string;
  httpStatus: number | null;
  detail: string;
}

export type CrmDispatchEvent =
  | 'order.created'
  | 'order.stage_changed'
  | 'order.sla_breached'
  | 'order.client_rescue'
  | 'dispatch.test';

export interface OrderSlaTrackingState {
  createdRegime: StudioOperatingRegimeId;
  slaWindowStartAt: string;
  slaDeadlineAt: string;
  promisedWindowLabel: string;
  firstContactedAt: string | null;
  escalatedAt: string | null;
  clientRescueCount: number;
  compensationNote: string | null;
}

export interface CrmOrderRecord {
  id: string;
  orderNumber: string;
  createdAt: string;
  updatedAt: string;
  holdExpiresAt: string;
  source: OrderEntrySource;
  checkoutMode: 'air_plus_production' | 'production_only';
  paymentChannel?: 'edo_invoice' | 'card_online';
  stage: CrmOrderStage;
  formatLabel: string;
  totalBudgetRub: number;
  contact: string;
  clientEmail?: string | null;
  detectedChannel: 'phone' | 'telegram' | 'email' | 'vip_saved';
  callbackPreference?: ClientCallbackPreference;
  companyOrInn: string;
  innVerified: boolean;
  briefText: string;
  hasVoiceRecording: boolean;
  voiceDurationSec: number;
  attachedFileName: string | null;
  producerNotes: string;
  compliance: OrderComplianceChecklist;
  mediaPlanSnapshot: OrderMediaPlanSnapshot | null;
  documentMeta?: OrderDocumentMeta;
  preferredDeliveryChannel?: ClientDeliveryChannel;
  preferredDeliveryDetail?: string;
  cloudDiskUrl?: string | null;
  deliverables?: OrderDeliverableFile[];
  clientUploads?: ClientUploadedAttachment[];
  pdnConsentAcceptedAt?: string | null;
  pdnAnonymizedAt?: string | null;
  slaState?: OrderSlaTrackingState;
  approvalWorkflow?: OrderApprovalWorkflow;
  delivery: {
    crmRegistry: 'saved';
    telegram: ChannelDeliveryStatus;
    webhook: ChannelDeliveryStatus;
  };
}

export interface OrderDispatchSettings {
  telegram: {
    enabled: boolean;
    botToken: string;
    chatId: string;
    notifyOnNewOrder: boolean;
    notifyOnStageChange: boolean;
    /** 152-ФЗ ст. 12 / ФЗ-41-ФЗ: по умолчанию true — исключает передачу ПДн клиентов через зарубежные мессенджеры */
    maskPdnInExternalAlerts?: boolean;
  };
  webhook: {
    enabled: boolean;
    endpointUrl: string;
    hmacSecret: string;
    notifyOnNewOrder: boolean;
    notifyOnStageChange: boolean;
  };
  workSchedule?: StudioWorkScheduleConfig;
}

export interface DispatchAttemptLog {
  id: string;
  timestamp: string;
  orderNumber: string;
  channel: 'telegram' | 'webhook';
  event: CrmDispatchEvent;
  state: ExternalDeliveryState;
  httpStatus: number | null;
  latencyMs: number;
  summary: string;
}

export function ensureCrmOrderSlaFields(
  order: CrmOrderRecord,
  rawSchedule?: Partial<StudioWorkScheduleConfig> | null
): CrmOrderRecord {
  const schedule = sanitizeWorkScheduleConfig(rawSchedule ?? DEFAULT_STUDIO_WORK_SCHEDULE);
  const createdMs = Number.isFinite(Date.parse(order.createdAt))
    ? Date.parse(order.createdAt)
    : Date.now();
  const pref: ClientCallbackPreference = order.callbackPreference ?? 'call_15m';

  if (order.slaState && order.slaState.slaDeadlineAt) {
    return {
      ...order,
      callbackPreference: pref,
    };
  }

  const regime = resolveStudioOperatingRegime(createdMs, schedule);
  const slaWin = computeSlaDeadlineWindow(createdMs, pref, schedule);
  const alreadyProgressed = order.stage !== 'new_hold';

  return {
    ...order,
    callbackPreference: pref,
    slaState: {
      createdRegime: regime.regime,
      slaWindowStartAt: new Date(slaWin.slaWindowStartMs).toISOString(),
      slaDeadlineAt: new Date(slaWin.slaDeadlineMs).toISOString(),
      promisedWindowLabel: slaWin.promisedWindowLabel,
      firstContactedAt: alreadyProgressed ? order.updatedAt : null,
      escalatedAt: null,
      clientRescueCount: 0,
      compensationNote: null,
    },
  };
}

export { SLA_BREACH_COMPENSATION_NOTE };

/**
 * Оценивает среднюю эффективную частоту контактов в ядре ЦА по числу выходов на станцию.
 * Использует эмпирический коэффициент зацепа прайм-драйва (~0.34 контакта ядра на 1 выход станции).
 */
export function estimateCoreFrequencyFromStations(
  stations: readonly { spotsCount: number }[]
): number {
  if (!stations.length) return 0;
  const avgSpotsPerStation =
    stations.reduce((acc, s) => acc + Math.max(0, s.spotsCount), 0) / stations.length;
  const rawFreq = avgSpotsPerStation * 0.34;
  return Math.round(rawFreq * 10) / 10;
}

export function buildMediaPlanSnapshotFromReservation(
  payload: MediaGridReservationPayload,
  totals: ComputedReservationTotals
): OrderMediaPlanSnapshot {
  const spotSeconds =
    typeof payload.spotDurationSec === 'number' && Number.isFinite(payload.spotDurationSec)
      ? Math.max(5, Math.min(60, Math.round(payload.spotDurationSec)))
      : payload.durationPref === '30'
        ? 30
        : 15;

  const stations: OrderStationLineSnapshot[] = payload.stations.map((st) => ({
    slotId: st.slotId,
    stationName: st.station,
    frequencyFm: st.frequencyFm,
    slotLabel: st.daypart,
    daysPattern: st.daysPattern,
    sampleTimeSlots: [...st.sampleTimeSlots],
    spotsCount: st.spotsIncluded * Math.max(1, st.packageMultiplier || 1),
    spotSeconds: st.exactDurationSec ?? spotSeconds,
    reachOTS: st.reachOTS,
    officialPriceRub: st.officialPrice,
    hotPriceRub: st.hotPrice,
    discountPercent: st.discountPercent,
  }));

  const estimatedFrequency = estimateCoreFrequencyFromStations(stations);
  const isReadySpot =
    totals.productionSelection === 'ready_spot' || payload.durationPref === 'ready_spot';

  return {
    nicheId: payload.nicheId,
    nicheLabel: payload.nicheLabel,
    audienceSummary: payload.targetAudienceSummary ?? payload.nicheLabel,
    campaignGoal: payload.hotAirTotal >= 320_000 ? 'brand_system_3m' : 'promo_burst',
    spotReadiness: isReadySpot ? 'ready_with_passport' : 'need_production_24h',
    spotDurationSec: spotSeconds,
    productionStatusLabel: totals.spotStatusLabel,
    totalSpots: payload.totalSpots,
    totalReachOTS: payload.totalReachOTS,
    estimatedFrequency,
    officialAirTotalRub: payload.officialAirTotal,
    hotAirTotalRub: payload.hotAirTotal,
    productionPriceRub: totals.productionPriceRub,
    totalSavingsRub: totals.totalSavingsRub,
    unifiedTotalRub: totals.unifiedTotalRub,
    airDiscountPercent: payload.airDiscountPercent,
    stations,
  };
}

export function buildMediaPlanSnapshotFromFlexiblePlan(
  plan: FlexibleMediaPlanResult
): OrderMediaPlanSnapshot {
  const nicheLabel = NICHE_LABELS_BY_ID[plan.niche] ?? 'Бизнес-сегмент';

  const stations: OrderStationLineSnapshot[] = plan.selectedQuotes.map((q) => ({
    slotId: q.variation.id,
    stationName: q.stationItem.station,
    frequencyFm: q.stationItem.frequencyFm,
    slotLabel: `${q.variation.label} (${q.variation.hoursWindow})`,
    daysPattern: q.variation.daysPattern,
    sampleTimeSlots: [...q.variation.sampleTimeSlots],
    spotsCount: q.spotsCount,
    spotSeconds: q.spotSeconds,
    reachOTS: q.reachOTS,
    officialPriceRub: q.officialPriceRub,
    hotPriceRub: q.hotPriceRub,
    discountPercent: q.discountPercent,
  }));

  const estimatedFrequency = estimateCoreFrequencyFromStations(stations);
  const isReadySpot = plan.spotReadiness === 'ready_with_passport';

  const productionStatusLabel = isReadySpot
    ? `Готовый ролик клиента (${plan.spotSeconds} сек) — 0 ₽`
    : plan.production.isBonusUnlocked
      ? `Студийный ролик (${plan.spotSeconds} сек) — 0 ₽ бонус квоты`
      : `${plan.production.title} (${plan.spotSeconds} сек) — ${formatRubCompact(
          plan.production.effectivePriceRub
        )}`;

  return {
    nicheId: plan.niche,
    nicheLabel,
    audienceSummary: formatAudienceSummaryLine(plan.audience),
    campaignGoal: plan.hotAirTotalRub >= 320_000 ? 'brand_system_3m' : 'promo_burst',
    spotReadiness: plan.spotReadiness,
    spotDurationSec: plan.spotSeconds,
    productionStatusLabel,
    totalSpots: plan.totalSpots,
    totalReachOTS: plan.totalReachOTS,
    estimatedFrequency,
    officialAirTotalRub: plan.officialAirTotalRub,
    hotAirTotalRub: plan.hotAirTotalRub,
    productionPriceRub: plan.production.effectivePriceRub,
    totalSavingsRub: plan.totalSavingsRub,
    unifiedTotalRub: plan.totalClientCostRub,
    airDiscountPercent: plan.airDiscountPercent,
    stations,
  };
}

export function computeOrderHoldStatus(
  order: Pick<CrmOrderRecord, 'holdExpiresAt' | 'stage'>,
  nowMs = Date.now()
): {
  remainingSec: number;
  formattedCountdown: string;
  urgency: 'locked_safe' | 'active_normal' | 'expiring_soon' | 'expired';
  statusLabel: string;
} {
  if (order.stage !== 'new_hold') {
    return {
      remainingSec: 0,
      formattedCountdown: 'Зафиксировано',
      urgency: 'locked_safe',
      statusLabel: 'Квота закреплена за сделкой',
    };
  }
  const expMs = Date.parse(order.holdExpiresAt);
  if (!Number.isFinite(expMs)) {
    return {
      remainingSec: 0,
      formattedCountdown: '00:00:00',
      urgency: 'expired',
      statusLabel: 'Требуется продление холда',
    };
  }
  const remainingSec = Math.max(0, Math.floor((expMs - nowMs) / 1000));
  if (remainingSec === 0) {
    return {
      remainingSec: 0,
      formattedCountdown: '00:00:00',
      urgency: 'expired',
      statusLabel: '4ч истекли · обновите квоту',
    };
  }
  if (remainingSec <= 45 * 60) {
    return {
      remainingSec,
      formattedCountdown: formatHoldCountdown(remainingSec),
      urgency: 'expiring_soon',
      statusLabel: `Срочный холд · осталось ${formatHoldCountdown(remainingSec)}`,
    };
  }
  return {
    remainingSec,
    formattedCountdown: formatHoldCountdown(remainingSec),
    urgency: 'active_normal',
    statusLabel: `Холд 4ч · ${formatHoldCountdown(remainingSec)}`,
  };
}

export interface TelegramDispatchFormatOptions {
  /** По умолчанию true (152-ФЗ ст. 12 / ФЗ-41-ФЗ): скрывает контакты, ФИО, ИНН и текст брифа */
  maskPdn?: boolean;
}

/**
 * Формирует оперативное сообщение для рабочего оповещения продюсеров и трафик-службы.
 * По умолчанию работает в обезличенном режиме 152-ФЗ (не передаёт телефон, e-mail, ИНН и бриф в зарубежный мессенджер).
 */
export function formatTelegramOrderDispatchMessage(
  order: CrmOrderRecord,
  event: CrmDispatchEvent = 'order.created',
  options: TelegramDispatchFormatOptions = {}
): string {
  const maskPdn = options.maskPdn !== false;
  const stageMeta = getCrmStageMetaForOrder(order.stage, order.checkoutMode);
  const prefMeta = getCallbackPreferenceMeta(order.callbackPreference);
  const header =
    event === 'dispatch.test'
      ? `ТЕСТ ШЛЮЗА ПРИЁМА ЗАКАЗОВ · FMWorks`
      : event === 'order.sla_breached'
        ? `ПРОСРОЧКА SLA · СРОЧНАЯ ЭСКАЛАЦИЯ РУКОВОДИТЕЛЮ #${order.orderNumber}`
        : event === 'order.client_rescue'
          ? `СИГНАЛ ОТ КЛИЕНТА (ПРОДЛЕНИЕ ХОЛДА / ЗАПРОС СВЯЗИ) · #${order.orderNumber}`
          : event === 'order.stage_changed'
            ? `ОБНОВЛЕНИЕ ЭТАПА СДЕЛКИ #${order.orderNumber}`
            : order.checkoutMode === 'air_plus_production'
              ? `НОВЫЙ ПРИОРИТЕТНЫЙ ХОЛД 4Ч · #${order.orderNumber}`
              : `НОВЫЙ ЗАКАЗ НА АУДИОПРОДАКШН · #${order.orderNumber}`;

  const budgetLabel =
    order.totalBudgetRub > 0
      ? formatRubCompact(order.totalBudgetRub)
      : 'Договорная цена (по оценке продюсера)';
  const paymentLabel =
    order.paymentChannel === 'card_online'
      ? 'Карта физлица / СБП (ЮKassa / Робокасса, 54-ФЗ)'
      : 'Безналичный расчёт по счёту / ЭДО';

  const contactDisplayLine = maskPdn
    ? `Канал связи: ${maskContactChannelSummary(order.detectedChannel)}`
    : `Контакт клиента: ${order.contact} (${order.detectedChannel})`;

  const lines: string[] = [
    header,
    `Этап: ${stageMeta.fullTitle}`,
    `Сумма договора: ${budgetLabel}`,
    `Способ оплаты: ${paymentLabel}`,
    contactDisplayLine,
    `Режим связи: ${prefMeta.fullLabel}`,
  ];

  if (order.slaState?.promisedWindowLabel) {
    lines.push(`Обещанное окно SLA: ${order.slaState.promisedWindowLabel}`);
  }
  if (order.slaState?.compensationNote) {
    lines.push(`Сервисная гарантия: ${order.slaState.compensationNote}`);
  }

  if (order.companyOrInn) {
    if (maskPdn) {
      lines.push(
        `Контрагент / ИНН: указан в защищённом реестре РФ${
          order.innVerified ? ' · ИНН проверен по ключу ФНС' : ''
        }`
      );
    } else {
      lines.push(
        `Контрагент / ИНН: ${order.companyOrInn}${
          order.innVerified ? ' · ИНН проверен по ключу ФНС' : ''
        }`
      );
    }
  }

  if (order.mediaPlanSnapshot) {
    const snap = order.mediaPlanSnapshot;
    lines.push(
      ``,
      `МЕДИАПЛАН (${snap.stations.length} ст. · ${snap.totalSpots} вых. × ${snap.spotDurationSec}с · ${formatNumberSpaced(
        snap.totalReachOTS
      )} OTS · ~${snap.estimatedFrequency.toFixed(1).replace('.', ',')}×):`,
      ...snap.stations.map(
        (st, idx) =>
          `${idx + 1}) ${st.stationName} (${st.frequencyFm}) — ${st.spotsCount} вых. × ${st.spotSeconds}с (${st.slotLabel}) — ${formatRubCompact(
            st.hotPriceRub
          )}`
      ),
      `Ролик: ${snap.productionStatusLabel}`
    );
  } else {
    lines.push(`Формат: ${order.formatLabel}`);
  }

  if (order.briefText) {
    if (maskPdn) {
      lines.push(
        `Бриф / задача: сохранён в закрытом контуре РФ (${order.briefText.length} симв.)`
      );
    } else {
      lines.push(`Бриф / задача: ${order.briefText}`);
    }
  }
  if (order.hasVoiceRecording) {
    lines.push(`Голосовое ТЗ: прикреплено (${order.voiceDurationSec} сек)`);
  }

  lines.push(
    ``,
    maskPdn
      ? `Режим 152-ФЗ (ст. 12): ПДн не передаются в зарубежный мессенджер. Откройте локальный кабинет РФ: /admin -> Заказы и воронка (CRM)`
      : `Пульт управления: /admin -> Заказы и воронка (CRM)`
  );
  return lines.join('\n');
}

/**
 * Обезличивает персональные данные субъекта в карточке заказа CRM
 * в рамках исполнения ч. 5 ст. 21 Федерального закона № 152-ФЗ (отзыв согласия / уничтожение ПДн),
 * сохраняя обезличенный учётный номер и сумму для 402-ФЗ «О бухгалтерском учёте».
 */
export function anonymizeCrmOrderPdnRecord(
  order: CrmOrderRecord,
  nowIso = new Date().toISOString()
): CrmOrderRecord {
  const anonymizedNote = `ПДн обезличены по ст. 21 152-ФЗ (${nowIso.slice(0, 10)})`;
  return {
    ...order,
    updatedAt: nowIso,
    contact: '[ПДН УДАЛЕНЫ ПО 152-ФЗ]',
    clientEmail: null,
    companyOrInn: '[РЕКВИЗИТЫ ОБЕЗЛИЧЕНЫ ПО 152-ФЗ]',
    innVerified: false,
    briefText: anonymizedNote,
    attachedFileName: null,
    producerNotes: anonymizedNote,
    pdnAnonymizedAt: nowIso,
  };
}

export interface WebhookOrderEnvelope {
  event: CrmDispatchEvent;
  idempotencyKey: string;
  emittedAt: string;
  platform: 'FMWorks Studio CRM';
  order: {
    id: string;
    orderNumber: string;
    stage: CrmOrderStage;
    stageTitle: string;
    checkoutMode: 'air_plus_production' | 'production_only';
    paymentChannel?: 'edo_invoice' | 'card_online';
    preferredDeliveryChannel?: ClientDeliveryChannel;
    preferredDeliveryDetail?: string;
    totalBudgetRub: number;
    holdExpiresAt: string;
    callbackPreference: ClientCallbackPreference;
    slaState: OrderSlaTrackingState | null;
    client: {
      contact: string;
      channel: string;
      companyOrInn: string;
      innVerified: boolean;
    };
    brief: {
      text: string;
      hasVoiceRecording: boolean;
      voiceDurationSec: number;
      attachedFileName: string | null;
    };
    compliance: OrderComplianceChecklist;
    mediaPlan: OrderMediaPlanSnapshot | null;
  };
}

export function buildWebhookOrderEnvelope(
  order: CrmOrderRecord,
  event: CrmDispatchEvent,
  nowIso = new Date().toISOString()
): WebhookOrderEnvelope {
  return {
    event,
    idempotencyKey: `${order.orderNumber}:${event}:${order.stage}:${nowIso.slice(0, 16)}`,
    emittedAt: nowIso,
    platform: 'FMWorks Studio CRM',
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      stage: order.stage,
      stageTitle: getCrmStageMetaForOrder(order.stage, order.checkoutMode).fullTitle,
      checkoutMode: order.checkoutMode,
      paymentChannel: order.paymentChannel ?? 'edo_invoice',
      preferredDeliveryChannel: order.preferredDeliveryChannel ?? 'messenger',
      preferredDeliveryDetail: order.preferredDeliveryDetail ?? '',
      totalBudgetRub: order.totalBudgetRub,
      holdExpiresAt: order.holdExpiresAt,
      callbackPreference: order.callbackPreference ?? 'call_15m',
      slaState: order.slaState ?? null,
      client: {
        contact: order.contact,
        channel: order.detectedChannel,
        companyOrInn: order.companyOrInn,
        innVerified: order.innVerified,
      },
      brief: {
        text: order.briefText,
        hasVoiceRecording: order.hasVoiceRecording,
        voiceDurationSec: order.voiceDurationSec,
        attachedFileName: order.attachedFileName,
      },
      compliance: { ...order.compliance },
      mediaPlan: order.mediaPlanSnapshot,
    },
  };
}

/**
 * Генерирует официальный бланк счёта-спецификации для отправки клиенту в ЭДО (Диадок / СБИС).
 */
export function formatEdoInvoiceSpecificationDocument(order: CrmOrderRecord): string {
  const createdDate = (() => {
    try {
      return new Date(order.createdAt).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return order.createdAt.slice(0, 10);
    }
  })();

  const invoiceNumber = `СФ-${order.orderNumber.replace(/^FM-/, '')}`;
  const snap = order.mediaPlanSnapshot;
  const embeddedInnMatch = order.companyOrInn
    ? order.companyOrInn.match(/^(.*?)[\s·,;(/|-]*инн[\s:№-]*(\d{10,12})[)\s]*$/i)
    : null;
  const pureInnMatch = order.companyOrInn
    ? order.companyOrInn.replace(/[\s-]/g, '').match(/^(\d{10,12})$/)
    : null;
  const parsedCustomerName = embeddedInnMatch
    ? embeddedInnMatch[1].replace(/[·,;|\s-]+$/g, '').trim()
    : pureInnMatch
      ? ''
      : order.companyOrInn.trim();
  const parsedCustomerInn = embeddedInnMatch
    ? embeddedInnMatch[2]
    : pureInnMatch
      ? pureInnMatch[1]
      : '';

  const customerLines: string[] = [];
  if (parsedCustomerName && parsedCustomerInn) {
    customerLines.push(
      `• Заказчик (организация / ИП): ${parsedCustomerName}`,
      `• ИНН Заказчика: ${parsedCustomerInn}${
        order.innVerified ? ' (ИНН подтверждён по ключу ФНС)' : ''
      }`
    );
  } else {
    customerLines.push(
      `• Контрагент / ИНН: ${
        order.companyOrInn
          ? `${order.companyOrInn}${order.innVerified ? ' (ИНН подтверждён по ФНС)' : ''}`
          : order.paymentChannel === 'card_online'
            ? 'Физическое лицо / оплата по СБП или картой (ЮKassa / Робокасса, чек 54-ФЗ)'
            : 'Реквизиты уточняются при выставлении в Диадок / СБИС'
      }`
    );
  }

  const lines: string[] = [
    `══════════════════════════════════════════════════════════════════════`,
    `ДОГОВОР, СПЕЦИФИКАЦИЯ И СЧЁТ НА ОПЛАТУ ДЛЯ ЭДО № ${invoiceNumber} от ${createdDate}`,
    `Исполнитель: Студия FMWorks® — Аудиопродакшн и лицензирование прав (fmworks.ru)`,
    `Основание заявки: Заказ #${order.orderNumber} (${
      getCrmStageMetaForOrder(order.stage, order.checkoutMode).shortLabel
    })`,
    `══════════════════════════════════════════════════════════════════════`,
    `ЗАКАЗЧИК:`,
    ...customerLines,
    `• Ответственный контакт: ${order.contact}`,
    `• Форма расчёта: ${
      order.paymentChannel === 'card_online'
        ? '100% предоплата картой / СБП (54-ФЗ)'
        : '100% предоплата по договору и ЭДО (Диадок / СБИС / Контур)'
    }`,
    ``,
  ];

  if (snap && snap.stations.length > 0) {
    lines.push(
      `ПАРАМЕТРЫ ЭФИРНОЙ КАМПАНИИ:`,
      `• Отрасль и портрет ЦА: ${snap.nicheLabel} (${snap.audienceSummary})`,
      `• Хронометраж аудиоролика: ${snap.spotDurationSec} сек (${
        snap.spotReadiness === 'ready_with_passport'
          ? 'готовый ролик Заказчика с паспортом прав'
          : 'производство студии FMWorks с бессрочным паспортом прав РАО/ВОИС'
      })`,
      `• Суммарный объём: ${snap.stations.length} радиостанций · ${snap.totalSpots} выходов · ${formatNumberSpaced(
        snap.totalReachOTS
      )} OTS (~${snap.estimatedFrequency.toFixed(1).replace('.', ',')} касаний ядра)`,
      ``,
      `ТАБЛИЦА ПОЗИЦИЙ ДЛЯ ЗАКРЫВАЮЩИХ ДОКУМЕНТОВ ЭДО:`
    );

    snap.stations.forEach((st, idx) => {
      lines.push(
        `${idx + 1}. Размещение аудиоролика (${st.spotSeconds} сек) в эфире «${st.stationName}» (${st.frequencyFm})`,
        `   Тайм-слот: ${st.slotLabel}, ${st.daysPattern} · Выходов: ${st.spotsCount} шт. · Охват: ${formatNumberSpaced(
          st.reachOTS
        )} OTS`,
        `   Стоимость по квоте: ${formatRubCompact(st.hotPriceRub)} (прайс станции ${formatRubCompact(
          st.officialPriceRub
        )}, скидка −${st.discountPercent}%)`
      );
    });

    const prodLineIndex = snap.stations.length + 1;
    lines.push(
      `${prodLineIndex}. Аудиопродакшн и лицензионный паспорт прав РАО/ВОИС: ${snap.productionStatusLabel}`,
      `   К оплате по позиции продакшна: ${formatRubCompact(snap.productionPriceRub)}`,
      ``,
      `ИТОГОВАЯ ФИНАНСОВАЯ СВОДКА:`,
      `• Сумма эфира по официальному прайсу радиостанций: ${formatRubCompact(snap.officialAirTotalRub)}`,
      `• Зафиксированная скидка агентской квоты: −${formatRubCompact(snap.totalSavingsRub)} (−${snap.airDiscountPercent}%)`,
      `• ИТОГО К ОПЛАТЕ ПО ЕДИНОМУ ДОГОВОРУ (ЭДО, без скрытых комиссий): ${formatRubCompact(
        snap.unifiedTotalRub
      )}`
    );
  } else {
    const isNegotiableBudget = order.totalBudgetRub <= 0;
    lines.push(
      `ТАБЛИЦА ПОЗИЦИЙ ПО ДОГОВОРУ:`,
      `1. Услуга по тарифу «${order.formatLabel}»`,
      isNegotiableBudget
        ? `   Индивидуальный объём работ (нестандартный проект, срочный заказ от 1 часа или отдельный этап «Только сценарий») — смета согласуется с продюсером`
        : `   Полный цикл после предоплаты: концепции сценария, диктор, сведение −14 LUFS и бессрочный паспорт прав РАО/ВОИС`,
      isNegotiableBudget
        ? `   СТОИМОСТЬ: Договорная цена (фиксируется приложением/счётом после консультации с продюсером)`
        : `   ИТОГО К ОПЛАТЕ ПО СЧЁТУ (100% предоплата): ${formatRubCompact(
            order.totalBudgetRub
          )}`
    );
  }

  if (order.slaState?.compensationNote) {
    lines.push(
      ``,
      `СЕРВИСНАЯ ГАРАНТИЯ SLA:`,
      `• ${order.slaState.compensationNote}`
    );
  }

  lines.push(
    ``,
    `КЛЮЧЕВЫЕ УСЛОВИЯ ДОГОВОРА И ПРЕДОПЛАТЫ:`,
    `1. Порядок запуска работ: Исполнитель приступает к проверке ТЗ, разработке концепций сценария, кастингу и записи фонограммы строго после подтверждения контрагента, заключения договора и поступления 100% предоплаты по договору или банковской картой.`,
    `2. Защита интеллектуальной собственности: до полной оплаты все сценарии и черновые наработки не передаются Заказчику; после сдачи проекта и подписания акта в ЭДО исключительные права и паспорт РАО/ВОИС переходят Заказчику бессрочно.`,
    `3. Документооборот: для юрлиц и ИП закрывающие акты передаются в Диадок / СБИС / Контур; при оплате картой физлица или по СБП (ЮKassa / Робокасса) направляется фискальный чек по ФЗ-54.`,
    `4. Служба оформления договоров: hello@fmworks.ru`
  );

  return lines.join('\n');
}

export function exportCrmOrdersToCsv(orders: readonly CrmOrderRecord[]): string {
  const escapeCsv = (val: string | number | boolean | null | undefined): string => {
    const str = val === null || val === undefined ? '' : String(val);
    if (/[;"\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = [
    'Номер заказа',
    'Дата создания',
    'Этап воронки',
    'Тип сделки',
    'Бюджет (руб)',
    'Контакт',
    'Компания / ИНН',
    'ИНН проверен',
    'Хронометраж (сек)',
    'Радиостанции',
    'Выходов',
    'Охват OTS',
    'Заметка продюсера',
  ].join(';');

  const rows = orders.map((o) => {
    const snap = o.mediaPlanSnapshot;
    const stationsSummary = snap
      ? snap.stations.map((s) => `${s.stationName} (${s.spotsCount} вых.)`).join(', ')
      : o.formatLabel;

    return [
      escapeCsv(o.orderNumber),
      escapeCsv(o.createdAt),
      escapeCsv(getCrmStageMetaForOrder(o.stage, o.checkoutMode).shortLabel),
      escapeCsv(o.checkoutMode === 'air_plus_production' ? 'Эфир + Ролик' : 'Аудиопродакшн'),
      escapeCsv(o.totalBudgetRub),
      escapeCsv(o.contact),
      escapeCsv(o.companyOrInn),
      escapeCsv(o.innVerified ? 'Да' : 'Нет'),
      escapeCsv(snap?.spotDurationSec ?? 15),
      escapeCsv(stationsSummary),
      escapeCsv(snap?.totalSpots ?? 0),
      escapeCsv(snap?.totalReachOTS ?? 0),
      escapeCsv(o.producerNotes),
    ].join(';');
  });

  return [header, ...rows].join('\n');
}

/**
 * Начальные демонстрационные заказы в CRM-пульте продюсера, чтобы воронка,
 * счёт-спецификация ЭДО и научный аудит работали сразу после входа в кабинет.
 */
export function createSeedCrmOrders(nowMs = Date.now()): CrmOrderRecord[] {
  const isoAt = (offsetMin: number) => new Date(nowMs + offsetMin * 60_000).toISOString();
  const seed1CreatedMs = nowMs - 8 * 60_000;
  const seed1HoldExpiresIso = new Date(
    computeSmartHoldExpirationMs(seed1CreatedMs, DEFAULT_STUDIO_WORK_SCHEDULE)
  ).toISOString();

  const rawSeeds: CrmOrderRecord[] = [
    {
      id: 'crm-seed-hold-2914',
      orderNumber: 'FM-HOLD-2914',
      createdAt: new Date(seed1CreatedMs).toISOString(),
      updatedAt: new Date(seed1CreatedMs).toISOString(),
      holdExpiresAt: seed1HoldExpiresIso,
      source: 'order_page',
      checkoutMode: 'air_plus_production',
      stage: 'new_hold',
      formatLabel: 'Голос и стиль (15 сек) за 24ч — 15 000 ₽',
      totalBudgetRub: 176_550,
      contact: '+7 916 740-28-19 · Алексей (коммерческий директор)',
      detectedChannel: 'phone',
      callbackPreference: 'call_15m',
      companyOrInn: 'ООО «Квартал Инвест» · ИНН 7707083893',
      innVerified: true,
      briefText:
        'Старт продаж видовых квартир с террасами, ипотечный транш и запись на закрытый показ в выходные.',
      hasVoiceRecording: true,
      voiceDurationSec: 26,
      attachedFileName: null,
      producerNotes: 'Проверить свободные утренние окна на Серебряном Дожде под бизнес-аудиторию.',
      preferredDeliveryChannel: 'messenger',
      preferredDeliveryDetail: 'Telegram',
      cloudDiskUrl: null,
      deliverables: [],
      clientUploads: [],
      compliance: {
        trafficConfirmed: false,
        fz38Checked: true,
        rightsPassportIssued: false,
        edoAndOrdRegistered: false,
      },
      mediaPlanSnapshot: {
        nicheId: 'real_estate',
        nicheLabel: 'Недвижимость и ЖК',
        audienceSummary: 'Премиум и ЖК (30–45 · высокий доход)',
        campaignGoal: 'promo_burst',
        spotReadiness: 'need_production_24h',
        spotDurationSec: 15,
        productionStatusLabel: 'Ролик 15 сек «Под ключ» за 24ч — 15 000 ₽',
        totalSpots: 23,
        totalReachOTS: 400_474,
        estimatedFrequency: 4.8,
        officialAirTotalRub: 264_000,
        hotAirTotalRub: 161_550,
        productionPriceRub: 15_000,
        totalSavingsRub: 102_450,
        unifiedTotalRub: 176_550,
        airDiscountPercent: 39,
        stations: [
          {
            slotId: 'bfm-evening',
            stationName: 'Business FM',
            frequencyFm: '87.5 FM',
            slotLabel: 'Вечерний драйв 17:30–20:30',
            daysPattern: 'Пн–Пт',
            sampleTimeSlots: ['18:15', '19:10', '19:45'],
            spotsCount: 9,
            spotSeconds: 15,
            reachOTS: 160_200,
            officialPriceRub: 132_750,
            hotPriceRub: 79_650,
            discountPercent: 40,
          },
          {
            slotId: 'silver-morning',
            stationName: 'Серебряный Дождь',
            frequencyFm: '100.1 FM',
            slotLabel: 'Утренний авторский эфир 08:00–11:00',
            daysPattern: 'Пн–Пт',
            sampleTimeSlots: ['08:35', '09:20', '10:15'],
            spotsCount: 14,
            spotSeconds: 15,
            reachOTS: 240_274,
            officialPriceRub: 131_250,
            hotPriceRub: 81_900,
            discountPercent: 38,
          },
        ],
      },
      delivery: {
        crmRegistry: 'saved',
        telegram: {
          state: 'ready_simulated',
          updatedAt: isoAt(-22),
          httpStatus: null,
          detail: 'Ожидает подключения Bot Token в настройках шлюза',
        },
        webhook: {
          state: 'ready_simulated',
          updatedAt: isoAt(-22),
          httpStatus: null,
          detail: 'Пакет сформирован · укажите URL внешней CRM для автоотправки',
        },
      },
    },
    {
      id: 'crm-seed-edo-2891',
      orderNumber: 'FM-HOLD-2891',
      createdAt: isoAt(-210),
      updatedAt: isoAt(-45),
      holdExpiresAt: isoAt(30),
      source: 'order_page',
      checkoutMode: 'air_plus_production',
      stage: 'edo_invoice',
      formatLabel: 'Готовый ролик (20 сек) с паспортом прав — 0 ₽',
      totalBudgetRub: 242_800,
      contact: '@med_marketing_dir · Елена (сеть клиник)',
      detectedChannel: 'telegram',
      companyOrInn: 'ООО «МедЦентр Профи» · ИНН 7736207543',
      innVerified: true,
      briefText:
        'Готовый ролик 20 секунд про кардиологический чекап за 1 визит. Нужен плотный выход в утреннем и дневном эфире + проверка медицинского дисклеймера.',
      hasVoiceRecording: false,
      voiceDurationSec: 0,
      attachedFileName: 'spot_cardio_20s_passport.pdf',
      producerNotes:
        'Трафик подтвердил все 28 выходов. Дисклеймер «Имеются противопоказания» уложен в финальные 3 сек. Счёт отправлен в Диадок.',
      preferredDeliveryChannel: 'cabinet',
      preferredDeliveryDetail: '',
      cloudDiskUrl: null,
      deliverables: [
        {
          id: 'deliv-seed-2891-spot',
          title: 'Эфирный мастер-файл (20 сек, −14 LUFS)',
          kind: 'audio_master',
          fileName: 'medcenter_cardio_20s_master.wav',
          mimeType: 'audio/wav',
          sizeBytes: 2_648_000,
          uploadedAt: isoAt(-60),
          versionCode: 'master',
          versionStage: 'master',
          versionNote:
            'Готовый эфирный ролик клиента (20 сек, −14 LUFS), проверен медицинский дисклеймер',
          staticAssetUrl: 'Audioworks_75c6023f.wav',
        },
      ],
      clientUploads: [],
      compliance: {
        trafficConfirmed: true,
        fz38Checked: true,
        rightsPassportIssued: true,
        edoAndOrdRegistered: true,
      },
      mediaPlanSnapshot: {
        nicheId: 'medicine',
        nicheLabel: 'Медицина',
        audienceSummary: 'Семья и медицина (35–55 · платёжеспособное ядро)',
        campaignGoal: 'promo_burst',
        spotReadiness: 'ready_with_passport',
        spotDurationSec: 20,
        productionStatusLabel: 'Готовый ролик клиента (20 сек) — 0 ₽',
        totalSpots: 28,
        totalReachOTS: 584_000,
        estimatedFrequency: 5.4,
        officialAirTotalRub: 398_000,
        hotAirTotalRub: 242_800,
        productionPriceRub: 0,
        totalSavingsRub: 155_200,
        unifiedTotalRub: 242_800,
        airDiscountPercent: 39,
        stations: [
          {
            slotId: 'monte-morning',
            stationName: 'Радио Monte Carlo',
            frequencyFm: '102.1 FM',
            slotLabel: 'Утренний прайм 07:30–10:30',
            daysPattern: 'Пн–Пт',
            sampleTimeSlots: ['08:15', '09:15', '10:05'],
            spotsCount: 14,
            spotSeconds: 20,
            reachOTS: 298_000,
            officialPriceRub: 236_000,
            hotPriceRub: 145_600,
            discountPercent: 38,
          },
          {
            slotId: 'retro-day',
            stationName: 'Ретро FM',
            frequencyFm: '88.3 FM',
            slotLabel: 'Дневной блок 12:00–16:00',
            daysPattern: 'Пн–Вс',
            sampleTimeSlots: ['12:40', '14:15', '15:30'],
            spotsCount: 14,
            spotSeconds: 20,
            reachOTS: 286_000,
            officialPriceRub: 162_000,
            hotPriceRub: 97_200,
            discountPercent: 40,
          },
        ],
      },
      delivery: {
        crmRegistry: 'saved',
        telegram: {
          state: 'ready_simulated',
          updatedAt: isoAt(-45),
          httpStatus: null,
          detail: 'Готово к отправке в Telegram продюсеров',
        },
        webhook: {
          state: 'ready_simulated',
          updatedAt: isoAt(-45),
          httpStatus: null,
          detail: 'Событие order.stage_changed записано в журнал',
        },
      },
    },
    {
      id: 'crm-seed-onair-2854',
      orderNumber: 'FM-HOLD-2854',
      createdAt: isoAt(-2880),
      updatedAt: isoAt(-180),
      holdExpiresAt: isoAt(-2640),
      source: 'order_page',
      checkoutMode: 'air_plus_production',
      stage: 'on_air',
      formatLabel: 'Экспресс-продакшн (15 сек) за 24ч — 0 ₽ Бонус',
      totalBudgetRub: 418_500,
      contact: '+7 925 310-88-42 · Дмитрий (отдел лизинга)',
      clientEmail: 'director@transflot-leasing.ru',
      detectedChannel: 'phone',
      companyOrInn: 'АО «ТрансФлот Лизинг» · ИНН 7702070139',
      innVerified: true,
      briefText:
        'Лизинг коммерческого транспорта для юрлиц с авансом от 10% и одобрением по ИНН за 1 рабочий день. Системная программа на 3 месяца.',
      hasVoiceRecording: true,
      voiceDurationSec: 34,
      attachedFileName: 'requisites_transflot.pdf',
      producerNotes:
        'Бонусный ролик за 0 ₽ сдан и утверждён с первого дубля. Идёт 1-я волна в утреннем и вечернем драйве, готовим график 2-й волны без оплаты продакшна.',
      preferredDeliveryChannel: 'cloud',
      preferredDeliveryDetail: 'Яндекс Диск',
      cloudDiskUrl: 'https://disk.yandex.ru/d/fmworks-transflot-2854',
      deliverables: [
        {
          id: 'deliv-seed-2854-master',
          title: 'Финальный мастер-ролик (WAV 48 кГц / −14 LUFS)',
          kind: 'audio_master',
          fileName: 'transflot_leasing_15s_master.wav',
          mimeType: 'audio/wav',
          sizeBytes: 2_648_000,
          uploadedAt: isoAt(-360),
          versionCode: 'master',
          versionStage: 'master',
          versionNote:
            'Утверждённый эфирный мастер WAV 48 кГц / −14 LUFS с юридическим дисклеймером',
          staticAssetUrl: 'zerno_audioworks_15.wav',
        },
        {
          id: 'deliv-seed-2854-v2',
          title: 'Итерация v2 — правка темпа и акцента концовки',
          kind: 'audio_master',
          fileName: 'transflot_leasing_15s_v2.wav',
          mimeType: 'audio/wav',
          sizeBytes: 2_612_000,
          uploadedAt: isoAt(-440),
          versionCode: 'v2',
          versionStage: 'revision',
          versionNote:
            'Уплотнён финал и выделена пауза перед условием одобрения по ИНН за 1 рабочий день',
          staticAssetUrl: 'Audioworks_75c6023f.wav',
        },
        {
          id: 'deliv-seed-2854-v1',
          title: 'Итерация v1 — черновой дубль диктора',
          kind: 'audio_master',
          fileName: 'transflot_leasing_15s_v1.wav',
          mimeType: 'audio/wav',
          sizeBytes: 2_584_000,
          uploadedAt: isoAt(-530),
          versionCode: 'v1',
          versionStage: 'draft',
          versionNote:
            'Первая сборка: баритон, спокойная деловая подача, акцент на авансе от 10%',
          staticAssetUrl: 'Audioworks_75c6023f.wav',
        },
      ],
      clientUploads: [],
      compliance: {
        trafficConfirmed: true,
        fz38Checked: true,
        rightsPassportIssued: true,
        edoAndOrdRegistered: true,
      },
      mediaPlanSnapshot: {
        nicheId: 'b2b_finance',
        nicheLabel: 'B2B и Финансы',
        audienceSummary: 'Бизнес и B2B (35–55 · собственники и директора)',
        campaignGoal: 'brand_system_3m',
        spotReadiness: 'need_production_24h',
        spotDurationSec: 15,
        productionStatusLabel: 'Студийный ролик (15 сек) — 0 ₽ бонус квоты',
        totalSpots: 46,
        totalReachOTS: 892_400,
        estimatedFrequency: 7.8,
        officialAirTotalRub: 685_000,
        hotAirTotalRub: 418_500,
        productionPriceRub: 0,
        totalSavingsRub: 291_500,
        unifiedTotalRub: 418_500,
        airDiscountPercent: 39,
        stations: [
          {
            slotId: 'bfm-morning',
            stationName: 'Business FM',
            frequencyFm: '87.5 FM',
            slotLabel: 'Утренний прайм 07:30–10:30',
            daysPattern: 'Пн–Пт',
            sampleTimeSlots: ['08:20', '09:15', '10:10'],
            spotsCount: 24,
            spotSeconds: 15,
            reachOTS: 468_000,
            officialPriceRub: 396_000,
            hotPriceRub: 237_600,
            discountPercent: 40,
          },
          {
            slotId: 'kommersant-evening',
            stationName: 'Коммерсантъ FM',
            frequencyFm: '93.6 FM',
            slotLabel: 'Вечерний драйв 17:30–20:30',
            daysPattern: 'Пн–Пт',
            sampleTimeSlots: ['17:50', '18:40', '19:25'],
            spotsCount: 22,
            spotSeconds: 15,
            reachOTS: 424_400,
            officialPriceRub: 289_000,
            hotPriceRub: 180_900,
            discountPercent: 37,
          },
        ],
      },
      delivery: {
        crmRegistry: 'saved',
        telegram: {
          state: 'delivered',
          updatedAt: isoAt(-2879),
          httpStatus: 200,
          detail: 'Уведомление передано продюсерской группе',
        },
        webhook: {
          state: 'delivered',
          updatedAt: isoAt(-180),
          httpStatus: 200,
          detail: 'Синхронизирован статус on_air',
        },
      },
    },
    {
      id: 'crm-seed-completed-2418',
      orderNumber: 'FM-2418',
      createdAt: isoAt(-64_800),
      updatedAt: isoAt(-60_480),
      holdExpiresAt: isoAt(-64_560),
      source: 'order_page',
      checkoutMode: 'production_only',
      stage: 'completed_ltv',
      formatLabel: 'Игровой ролик / Мини-кино (25 сек) — 35 000 ₽',
      totalBudgetRub: 35_000,
      contact: '+7 925 310-88-42 · Дмитрий (отдел лизинга)',
      clientEmail: 'director@transflot-leasing.ru',
      detectedChannel: 'phone',
      companyOrInn: 'АО «ТрансФлот Лизинг» · ИНН 7702070139',
      innVerified: true,
      briefText:
        'Осеннее обновление автопарка тягачей и коммерческих фургонов для региональной логистики с нулевым удорожанием в первые 6 месяцев.',
      hasVoiceRecording: false,
      voiceDurationSec: 0,
      attachedFileName: 'brief_autumn_fleet_2418.pdf',
      producerNotes:
        'Двухголосый игровой ролик сдан за 3 рабочих дня, закрывающие документы подписаны в Диадоке.',
      preferredDeliveryChannel: 'cabinet',
      preferredDeliveryDetail: '',
      cloudDiskUrl: 'https://disk.yandex.ru/d/fmworks-transflot-2418',
      deliverables: [
        {
          id: 'deliv-seed-2418-master',
          title: 'Эфирный мастер-файл (WAV 48 кГц / −14 LUFS)',
          kind: 'audio_master',
          fileName: 'transflot_autumn_fleet_25s_master.wav',
          mimeType: 'audio/wav',
          sizeBytes: 2_707_838,
          uploadedAt: isoAt(-60_500),
          versionCode: 'master',
          versionStage: 'master',
          versionNote:
            'Финальный эфирный мастер 25 сек (WAV 48 кГц / −14 LUFS), принят без замечаний',
          staticAssetUrl: 'zerno_audioworks_15.wav',
        },
        {
          id: 'deliv-seed-2418-v2',
          title: 'Версия v2 — сведение диалога с интершумом',
          kind: 'audio_master',
          fileName: 'transflot_autumn_fleet_25s_v2.wav',
          mimeType: 'audio/wav',
          sizeBytes: 2_676_000,
          uploadedAt: isoAt(-61_080),
          versionCode: 'v2',
          versionStage: 'revision',
          versionNote:
            'Добавлена акустика кабины тягача, выверена пауза перед условием 0% удорожания',
          staticAssetUrl: 'Audioworks_75c6023f.wav',
        },
        {
          id: 'deliv-seed-2418-v1',
          title: 'Версия v1 — черновая читка двух голосов',
          kind: 'audio_master',
          fileName: 'transflot_autumn_fleet_25s_v1.wav',
          mimeType: 'audio/wav',
          sizeBytes: 2_640_000,
          uploadedAt: isoAt(-61_800),
          versionCode: 'v1',
          versionStage: 'draft',
          versionNote:
            'Черновой дубль актёрского диалога для сверки интонации и хронометража 25 сек',
          staticAssetUrl: 'Audioworks_75c6023f.wav',
        },
      ],
      clientUploads: [],
      compliance: {
        trafficConfirmed: true,
        fz38Checked: true,
        rightsPassportIssued: true,
        edoAndOrdRegistered: true,
      },
      mediaPlanSnapshot: null,
      delivery: {
        crmRegistry: 'saved',
        telegram: {
          state: 'delivered',
          updatedAt: isoAt(-60_480),
          httpStatus: 200,
          detail: 'Проект закрыт и передан в архив клиента',
        },
        webhook: {
          state: 'delivered',
          updatedAt: isoAt(-60_480),
          httpStatus: 200,
          detail: 'Синхронизирован статус completed_ltv',
        },
      },
    },
    {
      id: 'crm-seed-completed-2309',
      orderNumber: 'FM-2309',
      createdAt: isoAt(-324_000),
      updatedAt: isoAt(-319_680),
      holdExpiresAt: isoAt(-323_760),
      source: 'order_page',
      checkoutMode: 'production_only',
      stage: 'completed_ltv',
      formatLabel: 'Продакшн под ключ (20 сек) — 25 000 ₽',
      totalBudgetRub: 25_000,
      contact: '+7 925 310-88-42 · Дмитрий (отдел лизинга)',
      clientEmail: 'director@transflot-leasing.ru',
      detectedChannel: 'phone',
      companyOrInn: 'АО «ТрансФлот Лизинг» · ИНН 7702070139',
      innVerified: true,
      briefText:
        'Специальная программа лизинга дорожно-строительной спецтехники для подрядчиков по ИНН за 1 рабочий день без залога.',
      hasVoiceRecording: false,
      voiceDurationSec: 0,
      attachedFileName: null,
      producerNotes:
        'Записан федеральный баритон, оформлен паспорт прав для региональной радиосети.',
      preferredDeliveryChannel: 'email',
      preferredDeliveryDetail: 'director@transflot-leasing.ru',
      cloudDiskUrl: null,
      deliverables: [
        {
          id: 'deliv-seed-2309-master',
          title: 'Финальный мастер-ролик (WAV 48 кГц / −14 LUFS)',
          kind: 'audio_master',
          fileName: 'transflot_roadtech_20s_master.wav',
          mimeType: 'audio/wav',
          sizeBytes: 2_707_838,
          uploadedAt: isoAt(-319_720),
          versionCode: 'master',
          versionStage: 'master',
          versionNote:
            'Финальный мастер 20 сек (WAV 48 кГц / −14 LUFS) с оформленным паспортом прав',
          staticAssetUrl: 'Audioworks_75c6023f.wav',
        },
        {
          id: 'deliv-seed-2309-v1',
          title: 'Версия v1 — черновой дубль баритона',
          kind: 'audio_master',
          fileName: 'transflot_roadtech_20s_v1.wav',
          mimeType: 'audio/wav',
          sizeBytes: 2_618_000,
          uploadedAt: isoAt(-320_380),
          versionCode: 'v1',
          versionStage: 'draft',
          versionNote:
            'Первая запись диктора без фоновой подложки для согласования подачи и темпа',
          staticAssetUrl: 'zerno_audioworks_15.wav',
        },
      ],
      clientUploads: [],
      compliance: {
        trafficConfirmed: true,
        fz38Checked: true,
        rightsPassportIssued: true,
        edoAndOrdRegistered: true,
      },
      mediaPlanSnapshot: null,
      delivery: {
        crmRegistry: 'saved',
        telegram: {
          state: 'delivered',
          updatedAt: isoAt(-319_680),
          httpStatus: 200,
          detail: 'Архивная сделка завершена',
        },
        webhook: {
          state: 'delivered',
          updatedAt: isoAt(-319_680),
          httpStatus: 200,
          detail: 'Синхронизирован статус completed_ltv',
        },
      },
    },
    {
      id: 'crm-seed-review-2926',
      orderNumber: 'FM-2926',
      createdAt: isoAt(-780),
      updatedAt: isoAt(-210),
      holdExpiresAt: isoAt(-540),
      source: 'order_page',
      checkoutMode: 'production_only',
      stage: 'quota_locked',
      formatLabel: 'Игровой ролик / Мини-кино (30 сек) — 35 000 ₽',
      totalBudgetRub: 35_000,
      contact: '+7 925 310-88-42 · Дмитрий (отдел лизинга)',
      clientEmail: 'director@transflot-leasing.ru',
      detectedChannel: 'phone',
      companyOrInn: 'АО «ТрансФлот Лизинг» · ИНН 7702070139',
      innVerified: true,
      briefText:
        'Лизинг изотермических фургонов и рефрижераторов для продуктового ритейла с ускоренным решением по ИНН.',
      hasVoiceRecording: false,
      voiceDurationSec: 0,
      attachedFileName: 'tz_reefer_fleet_2926.pdf',
      producerNotes:
        'Направлены 3 концепции диалогового сценария и смета на согласование руководителю отдела лизинга.',
      preferredDeliveryChannel: 'cabinet',
      preferredDeliveryDetail: '',
      cloudDiskUrl: null,
      deliverables: [
        {
          id: 'deliv-seed-2926-v2',
          title: 'Версия v2 — обновлённый демо-дубль на согласование',
          kind: 'audio_master',
          fileName: 'transflot_reefer_30s_v2.wav',
          mimeType: 'audio/wav',
          sizeBytes: 2_890_000,
          uploadedAt: isoAt(-215),
          versionCode: 'v2',
          versionStage: 'revision',
          versionNote:
            'Ускорен старт диалога, финал уложен ровно в 30 сек — ждём утверждения перед мастерингом',
          staticAssetUrl: 'zerno_audioworks_15.wav',
        },
        {
          id: 'deliv-seed-2926-v1',
          title: 'Версия v1 — первая демо-читка сценария',
          kind: 'audio_master',
          fileName: 'transflot_reefer_30s_v1.wav',
          mimeType: 'audio/wav',
          sizeBytes: 2_940_000,
          uploadedAt: isoAt(-360),
          versionCode: 'v1',
          versionStage: 'draft',
          versionNote:
            'Черновой вариант подачи с акцентом на температурный режим рефрижераторов',
          staticAssetUrl: 'Audioworks_75c6023f.wav',
        },
      ],
      clientUploads: [],
      compliance: {
        trafficConfirmed: true,
        fz38Checked: true,
        rightsPassportIssued: false,
        edoAndOrdRegistered: false,
      },
      mediaPlanSnapshot: null,
      delivery: {
        crmRegistry: 'saved',
        telegram: {
          state: 'delivered',
          updatedAt: isoAt(-210),
          httpStatus: 200,
          detail: 'Концепции сценария переданы на согласование заказчику',
        },
        webhook: {
          state: 'delivered',
          updatedAt: isoAt(-210),
          httpStatus: 200,
          detail: 'Синхронизирован статус quota_locked',
        },
      },
    },
    {
      id: 'crm-seed-prod-2948',
      orderNumber: 'FM-2948',
      createdAt: isoAt(-240),
      updatedAt: isoAt(-65),
      holdExpiresAt: isoAt(0),
      source: 'order_page',
      checkoutMode: 'production_only',
      stage: 'in_production',
      formatLabel: 'Продакшн под ключ (20 сек) — 25 000 ₽',
      totalBudgetRub: 25_000,
      contact: '+7 925 310-88-42 · Дмитрий (отдел лизинга)',
      clientEmail: 'director@transflot-leasing.ru',
      detectedChannel: 'phone',
      companyOrInn: 'АО «ТрансФлот Лизинг» · ИНН 7702070139',
      innVerified: true,
      briefText:
        'Зимний сервисный пакет и лизинг седельных тягачей для региональных перевозчиков с отсрочкой первого платежа на 60 дней.',
      hasVoiceRecording: true,
      voiceDurationSec: 22,
      attachedFileName: null,
      producerNotes:
        'Предоплата поступила, идёт запись основного диктора и сборка саунд-дизайна −14 LUFS.',
      preferredDeliveryChannel: 'cabinet',
      preferredDeliveryDetail: '',
      cloudDiskUrl: null,
      deliverables: [],
      clientUploads: [],
      compliance: {
        trafficConfirmed: true,
        fz38Checked: true,
        rightsPassportIssued: false,
        edoAndOrdRegistered: true,
      },
      mediaPlanSnapshot: null,
      delivery: {
        crmRegistry: 'saved',
        telegram: {
          state: 'delivered',
          updatedAt: isoAt(-65),
          httpStatus: 200,
          detail: 'Заказ передан в студийное производство',
        },
        webhook: {
          state: 'delivered',
          updatedAt: isoAt(-65),
          httpStatus: 200,
          detail: 'Синхронизирован статус in_production',
        },
      },
    },
  ];

  return rawSeeds.map((ord) =>
    ensureOrderApprovalWorkflow(
      ensureCrmOrderSlaFields(ord, DEFAULT_STUDIO_WORK_SCHEDULE)
    )
  );
}
