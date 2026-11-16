import {
  formatStructuredCompanyLine,
  parseCompanyNameAndInn,
} from '../components/order/companyDetailsHelpers';
import {
  ClientDeliveryChannel,
  DeliveryCloudId,
  DeliveryMessengerId,
  normalizeDeliveryPreferences,
  sanitizeDeliveryDetail,
} from './clientCabinetHelpers';
import { AIRTIME_SALES_ENABLED, isAirtimeSalesEnabled } from './platformFeatures';
import { IndustryVerticalSlug, isValidIndustrySlug } from './platformRouter';
import { OrderFormatId } from './pricingData';
import {
  ComputedReservationTotals,
  MediaGridReservationPayload,
  ReservationProductionSelection,
} from './radioInventory';
import {
  buildRegimeAwareClientTimeline,
  ClientCallbackPreference,
  StudioWorkScheduleConfig,
} from './slaWorkCalendar';
import {
  OrderDocumentMeta,
  sanitizeOrderDocumentMeta,
} from './studioDocumentsCore';

export type OrderCheckoutMode = 'production_only' | 'air_plus_production';

export type StudioPaymentChannel = 'edo_invoice' | 'card_online';

export type ReservationLifecycleStatus =
  | 'none'
  | 'draft_selected'
  | 'confirmed_hold';

export interface ConfirmedReservationSummary {
  orderNumber: string;
  confirmedAtMs: number;
  holdExpiresAtMs: number;
  checkoutMode: OrderCheckoutMode;
  paymentChannel?: StudioPaymentChannel;
  preferredDeliveryChannel?: ClientDeliveryChannel;
  preferredDeliveryDetail?: string;
  selectedFormatId?: OrderFormatId;
  selectedBudgetRub?: number | null;
  contactLine: string;
  clientEmail?: string | null;
  autoSignedIn?: boolean;
  companyLine: string;
  callbackPreference?: ClientCallbackPreference;
  slaWindowStartAtMs?: number;
  slaDeadlineAtMs?: number;
  promisedWindowLabel?: string;
  rescueToken?: string | null;
  compensationNote?: string | null;
  firstContactedAtIso?: string | null;
  formatLabel: string;
  spotDurationSec: number;
  industryLabel: string | null;
  briefNote: string;
  hasVoice: boolean;
  voiceSec: number;
  fileName: string | null;
  conversionAllowed: boolean;
  innVerified: boolean;
  wantsDiadocDuplicate?: boolean;
  documentMeta?: OrderDocumentMeta | null;
  lockedMediaReservation: MediaGridReservationPayload | null;
  lockedTotals: ComputedReservationTotals | null;
}

export interface ClientNextStepItem {
  stepNumber: string;
  timingLabel: string;
  title: string;
  description: string;
}

export interface OrderDraftSnapshot {
  mode: OrderCheckoutMode;
  selectedFormat: OrderFormatId;
  isFormatPreselected: boolean;
  paymentChannel: StudioPaymentChannel;
  preferredDeliveryChannel: ClientDeliveryChannel;
  deliveryMessenger: DeliveryMessengerId;
  deliveryMessengerOther: string;
  deliveryCloud: DeliveryCloudId;
  deliveryCloudOther: string;
  deliveryEmail: string;
  cabinetEmail: string;
  wantsInvoiceNow: boolean;
  wantsDiadocDuplicate: boolean;
  resolvedCounterpartyMeta: OrderDocumentMeta | null;
  spotDurationSec: number;
  industryPreset: IndustryVerticalSlug | null;
  briefText: string;
  contactLine: string;
  companyLine: string;
  companyName: string;
  companyInn: string;
  callbackPreference: ClientCallbackPreference;
  mediaReservation: MediaGridReservationPayload | null;
  holdExpiresAtMs: number | null;
  reservationProdSelection: ReservationProductionSelection;
  confirmedReservation: ConfirmedReservationSummary | null;
  /**
   * Управляет тем, открыт ли экран квитанции отправленной заявки.
   * При клике на любую кнопку «Заказать ролик» всегда сбрасывается в `false`,
   * чтобы прошлая бронь или заказ никогда не блокировали новую студийную заявку.
   */
  isViewingSubmittedReceipt: boolean;
  returnPath: string;
}

export const ORDER_DRAFT_STORAGE_KEY = 'fmworks_order_draft_v1';
export const DEFAULT_HOLD_WINDOW_SECONDS = 4 * 3600 - 1;

const VALID_ORDER_FORMATS: readonly OrderFormatId[] = [
  'voice_style',
  'turnkey',
  'cinema',
  'adaptation',
  'custom_consult',
];

const VALID_PAYMENT_CHANNELS: readonly StudioPaymentChannel[] = [
  'edo_invoice',
  'card_online',
];

const VALID_PROD_SELECTIONS: readonly ReservationProductionSelection[] = [
  'bonus_express_24h',
  'voice_style',
  'turnkey',
  'cinema',
  'ready_spot',
];

export function resolveReservationLifecycleStatus(
  snapshot: Pick<OrderDraftSnapshot, 'mediaReservation' | 'confirmedReservation'>,
  options?: { airtimeEnabled?: boolean }
): ReservationLifecycleStatus {
  const airtimeEnabled = isAirtimeSalesEnabled(options?.airtimeEnabled);
  if (!airtimeEnabled) {
    return 'none';
  }
  if (snapshot.confirmedReservation !== null) {
    return 'confirmed_hold';
  }
  if (
    snapshot.mediaReservation !== null &&
    Array.isArray(snapshot.mediaReservation.stations) &&
    snapshot.mediaReservation.stations.length > 0
  ) {
    return 'draft_selected';
  }
  return 'none';
}

const VALID_CALLBACK_PREFS: readonly ClientCallbackPreference[] = [
  'call_15m',
  'async_no_call',
  'morning_0930',
  'day_1300',
  'evening_1730',
];

export function buildClientNextStepsTimeline(
  checkoutMode: OrderCheckoutMode,
  stationsCount = 0,
  options?: {
    nowMs?: number;
    callbackPreference?: ClientCallbackPreference;
    scheduleConfig?: Partial<StudioWorkScheduleConfig> | null;
    paymentChannel?: StudioPaymentChannel;
    isNegotiable?: boolean;
  }
): readonly ClientNextStepItem[] {
  return buildRegimeAwareClientTimeline({
    checkoutMode,
    stationsCount,
    nowMs: options?.nowMs,
    callbackPreference: options?.callbackPreference,
    scheduleConfig: options?.scheduleConfig,
    paymentChannel: options?.paymentChannel,
    isNegotiable: options?.isNegotiable,
  });
}

export function createDefaultOrderDraft(): OrderDraftSnapshot {
  return {
    mode: 'production_only',
    selectedFormat: 'turnkey',
    isFormatPreselected: false,
    paymentChannel: 'edo_invoice',
    preferredDeliveryChannel: 'messenger',
    deliveryMessenger: 'telegram',
    deliveryMessengerOther: '',
    deliveryCloud: 'yandex_disk',
    deliveryCloudOther: '',
    deliveryEmail: '',
    cabinetEmail: '',
    wantsInvoiceNow: false,
    wantsDiadocDuplicate: false,
    resolvedCounterpartyMeta: null,
    spotDurationSec: 20,
    industryPreset: null,
    briefText: '',
    contactLine: '',
    companyLine: '',
    companyName: '',
    companyInn: '',
    callbackPreference: 'call_15m',
    mediaReservation: null,
    holdExpiresAtMs: null,
    reservationProdSelection: 'turnkey',
    confirmedReservation: null,
    isViewingSubmittedReceipt: false,
    returnPath: '/',
  };
}

export function computeRemainingHoldSeconds(
  holdExpiresAtMs: number | null,
  nowMs = Date.now()
): number {
  if (!holdExpiresAtMs || !Number.isFinite(holdExpiresAtMs)) {
    return DEFAULT_HOLD_WINDOW_SECONDS;
  }
  const diffSec = Math.floor((holdExpiresAtMs - nowMs) / 1000);
  return Math.max(0, Math.min(21 * 24 * 3600, diffSec));
}

function sanitizeConfirmedReservation(
  raw: unknown
): ConfirmedReservationSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<ConfirmedReservationSummary>;
  if (
    typeof obj.orderNumber !== 'string' ||
    !obj.orderNumber.trim() ||
    typeof obj.contactLine !== 'string' ||
    !obj.contactLine.trim()
  ) {
    return null;
  }
  const nowMs = Date.now();
  return {
    orderNumber: obj.orderNumber.slice(0, 64),
    confirmedAtMs:
      typeof obj.confirmedAtMs === 'number' && Number.isFinite(obj.confirmedAtMs)
        ? obj.confirmedAtMs
        : nowMs,
    holdExpiresAtMs:
      typeof obj.holdExpiresAtMs === 'number' && Number.isFinite(obj.holdExpiresAtMs)
        ? obj.holdExpiresAtMs
        : nowMs + DEFAULT_HOLD_WINDOW_SECONDS * 1000,
    checkoutMode:
      obj.checkoutMode === 'air_plus_production'
        ? 'air_plus_production'
        : 'production_only',
    paymentChannel: VALID_PAYMENT_CHANNELS.includes(
      obj.paymentChannel as StudioPaymentChannel
    )
      ? (obj.paymentChannel as StudioPaymentChannel)
      : 'edo_invoice',
    ...(() => {
      const norm = normalizeDeliveryPreferences(
        obj.preferredDeliveryChannel,
        obj.preferredDeliveryDetail,
        'messenger'
      );
      return {
        preferredDeliveryChannel: norm.channel,
        preferredDeliveryDetail: norm.detail,
      };
    })(),
    selectedFormatId: VALID_ORDER_FORMATS.includes(obj.selectedFormatId as OrderFormatId)
      ? (obj.selectedFormatId as OrderFormatId)
      : undefined,
    selectedBudgetRub:
      typeof obj.selectedBudgetRub === 'number' && Number.isFinite(obj.selectedBudgetRub)
        ? Math.max(0, Math.round(obj.selectedBudgetRub))
        : obj.selectedBudgetRub === null
          ? null
          : undefined,
    contactLine: obj.contactLine.slice(0, 240),
    clientEmail:
      typeof obj.clientEmail === 'string' && obj.clientEmail.trim()
        ? obj.clientEmail.trim().toLowerCase().slice(0, 160)
        : null,
    autoSignedIn: Boolean(obj.autoSignedIn),
    companyLine: typeof obj.companyLine === 'string' ? obj.companyLine.slice(0, 240) : '',
    callbackPreference: VALID_CALLBACK_PREFS.includes(
      obj.callbackPreference as ClientCallbackPreference
    )
      ? (obj.callbackPreference as ClientCallbackPreference)
      : 'call_15m',
    slaWindowStartAtMs:
      typeof obj.slaWindowStartAtMs === 'number' && Number.isFinite(obj.slaWindowStartAtMs)
        ? obj.slaWindowStartAtMs
        : undefined,
    slaDeadlineAtMs:
      typeof obj.slaDeadlineAtMs === 'number' && Number.isFinite(obj.slaDeadlineAtMs)
        ? obj.slaDeadlineAtMs
        : undefined,
    promisedWindowLabel:
      typeof obj.promisedWindowLabel === 'string'
        ? obj.promisedWindowLabel.slice(0, 240)
        : undefined,
    rescueToken:
      typeof obj.rescueToken === 'string' ? obj.rescueToken.slice(0, 120) : null,
    compensationNote:
      typeof obj.compensationNote === 'string' ? obj.compensationNote.slice(0, 320) : null,
    firstContactedAtIso:
      typeof obj.firstContactedAtIso === 'string' ? obj.firstContactedAtIso.slice(0, 64) : null,
    formatLabel:
      typeof obj.formatLabel === 'string' ? obj.formatLabel.slice(0, 240) : 'Под ключ',
    spotDurationSec:
      typeof obj.spotDurationSec === 'number' && Number.isFinite(obj.spotDurationSec)
        ? Math.max(5, Math.min(60, Math.round(obj.spotDurationSec)))
        : 20,
    industryLabel:
      typeof obj.industryLabel === 'string' ? obj.industryLabel.slice(0, 160) : null,
    briefNote: typeof obj.briefNote === 'string' ? obj.briefNote.slice(0, 2000) : '',
    hasVoice: Boolean(obj.hasVoice),
    voiceSec:
      typeof obj.voiceSec === 'number' && Number.isFinite(obj.voiceSec)
        ? Math.max(0, Math.min(180, Math.round(obj.voiceSec)))
        : 0,
    fileName: typeof obj.fileName === 'string' ? obj.fileName.slice(0, 240) : null,
    conversionAllowed: obj.conversionAllowed !== false,
    innVerified: Boolean(obj.innVerified),
    wantsDiadocDuplicate: Boolean(obj.wantsDiadocDuplicate),
    documentMeta: obj.documentMeta
      ? sanitizeOrderDocumentMeta(obj.documentMeta)
      : null,
    lockedMediaReservation: obj.lockedMediaReservation ?? null,
    lockedTotals: obj.lockedTotals ?? null,
  };
}

function sanitizeDraftFromStorage(
  raw: unknown,
  airtimeEnabled = AIRTIME_SALES_ENABLED
): OrderDraftSnapshot {
  const base = createDefaultOrderDraft();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Partial<OrderDraftSnapshot>;

  const selectedFormat: OrderFormatId = VALID_ORDER_FORMATS.includes(
    obj.selectedFormat as OrderFormatId
  )
    ? (obj.selectedFormat as OrderFormatId)
    : base.selectedFormat;

  const paymentChannel: StudioPaymentChannel = VALID_PAYMENT_CHANNELS.includes(
    obj.paymentChannel as StudioPaymentChannel
  )
    ? (obj.paymentChannel as StudioPaymentChannel)
    : base.paymentChannel;

  const spotDurationSec =
    typeof obj.spotDurationSec === 'number' && Number.isFinite(obj.spotDurationSec)
      ? Math.max(5, Math.min(60, Math.round(obj.spotDurationSec)))
      : base.spotDurationSec;

  const industryPreset =
    typeof obj.industryPreset === 'string' && isValidIndustrySlug(obj.industryPreset)
      ? obj.industryPreset
      : null;

  const reservationProdSelection: ReservationProductionSelection =
    VALID_PROD_SELECTIONS.includes(
      obj.reservationProdSelection as ReservationProductionSelection
    )
      ? (obj.reservationProdSelection as ReservationProductionSelection)
      : base.reservationProdSelection;

  const hasValidReservation =
    airtimeEnabled &&
    obj.mediaReservation &&
    typeof obj.mediaReservation === 'object' &&
    Array.isArray(obj.mediaReservation.stations) &&
    obj.mediaReservation.stations.length > 0;

  const mediaReservation = hasValidReservation ? obj.mediaReservation! : null;

  const mode: OrderCheckoutMode =
    airtimeEnabled && obj.mode === 'air_plus_production' && mediaReservation
      ? 'air_plus_production'
      : 'production_only';

  const holdExpiresAtMs =
    mediaReservation &&
    typeof obj.holdExpiresAtMs === 'number' &&
    Number.isFinite(obj.holdExpiresAtMs)
      ? obj.holdExpiresAtMs
      : mediaReservation
        ? Date.now() + DEFAULT_HOLD_WINDOW_SECONDS * 1000
        : null;

  const rawConfirmed = sanitizeConfirmedReservation(obj.confirmedReservation);
  const confirmedReservation =
    !airtimeEnabled && rawConfirmed?.checkoutMode === 'air_plus_production'
      ? null
      : rawConfirmed;

  const rawReturnPath =
    typeof obj.returnPath === 'string' && obj.returnPath.startsWith('/')
      ? obj.returnPath
      : '/';
  const returnPath =
    !airtimeEnabled && rawReturnPath.startsWith('/hot-air') ? '/' : rawReturnPath;

  return {
    mode: mediaReservation ? mode : 'production_only',
    selectedFormat,
    isFormatPreselected: Boolean(obj.isFormatPreselected),
    paymentChannel,
    ...(() => {
      const legacyRaw = obj.preferredDeliveryChannel as string | undefined;
      const norm = normalizeDeliveryPreferences(
        obj.preferredDeliveryChannel,
        undefined,
        base.preferredDeliveryChannel
      );
      const validMessengerIds: readonly DeliveryMessengerId[] = [
        'telegram',
        'max',
        'other',
      ];
      const validCloudIds: readonly DeliveryCloudId[] = [
        'yandex_disk',
        'mailru_cloud',
        'other',
      ];
      const inferredCloud: DeliveryCloudId =
        legacyRaw === 'google_disk' || legacyRaw === 'yandex_disk'
          ? 'yandex_disk'
          : validCloudIds.includes(obj.deliveryCloud as DeliveryCloudId)
            ? (obj.deliveryCloud as DeliveryCloudId)
            : base.deliveryCloud;
      return {
        preferredDeliveryChannel: norm.channel,
        deliveryMessenger: validMessengerIds.includes(
          obj.deliveryMessenger as DeliveryMessengerId
        )
          ? (obj.deliveryMessenger as DeliveryMessengerId)
          : base.deliveryMessenger,
        deliveryMessengerOther: sanitizeDeliveryDetail(obj.deliveryMessengerOther).slice(
          0,
          80
        ),
        deliveryCloud: inferredCloud,
        deliveryCloudOther: sanitizeDeliveryDetail(obj.deliveryCloudOther).slice(0, 80),
        deliveryEmail: sanitizeDeliveryDetail(obj.deliveryEmail).slice(0, 160),
        cabinetEmail: sanitizeDeliveryDetail(obj.cabinetEmail).slice(0, 160),
      };
    })(),
    wantsInvoiceNow: Boolean(obj.wantsInvoiceNow),
    wantsDiadocDuplicate: Boolean(obj.wantsDiadocDuplicate),
    resolvedCounterpartyMeta: obj.resolvedCounterpartyMeta
      ? sanitizeOrderDocumentMeta(obj.resolvedCounterpartyMeta)
      : null,
    spotDurationSec,
    industryPreset,
    briefText: typeof obj.briefText === 'string' ? obj.briefText.slice(0, 2000) : '',
    contactLine: typeof obj.contactLine === 'string' ? obj.contactLine.slice(0, 240) : '',
    ...(() => {
      const rawLine = typeof obj.companyLine === 'string' ? obj.companyLine.slice(0, 240) : '';
      const rawName = typeof obj.companyName === 'string' ? obj.companyName.slice(0, 120) : '';
      const rawInn =
        typeof obj.companyInn === 'string'
          ? obj.companyInn.replace(/\D/g, '').slice(0, 12)
          : '';
      if (rawName || rawInn) {
        return {
          companyName: rawName,
          companyInn: rawInn,
          companyLine: formatStructuredCompanyLine(rawName, rawInn) || rawLine,
        };
      }
      const parsed = parseCompanyNameAndInn(rawLine);
      return {
        companyLine: rawLine,
        companyName: parsed.companyName,
        companyInn: parsed.companyInn,
      };
    })(),
    callbackPreference: VALID_CALLBACK_PREFS.includes(
      obj.callbackPreference as ClientCallbackPreference
    )
      ? (obj.callbackPreference as ClientCallbackPreference)
      : 'call_15m',
    mediaReservation,
    holdExpiresAtMs,
    reservationProdSelection,
    confirmedReservation,
    isViewingSubmittedReceipt: Boolean(obj.isViewingSubmittedReceipt && confirmedReservation),
    returnPath,
  };
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createOrderDraftStore(
  customStorage?: StorageAdapter,
  options?: { airtimeEnabled?: boolean }
) {
  const airtimeEnabled = isAirtimeSalesEnabled(options?.airtimeEnabled);

  const getStorage = (): StorageAdapter | undefined => {
    if (customStorage) return customStorage;
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return undefined;
  };

  const loadInitial = (): OrderDraftSnapshot => {
    const store = getStorage();
    if (!store) return createDefaultOrderDraft();
    try {
      const raw = store.getItem(ORDER_DRAFT_STORAGE_KEY);
      if (!raw) return createDefaultOrderDraft();
      return sanitizeDraftFromStorage(JSON.parse(raw), airtimeEnabled);
    } catch {
      return createDefaultOrderDraft();
    }
  };

  let state: OrderDraftSnapshot = loadInitial();
  const listeners = new Set<(snap: OrderDraftSnapshot) => void>();

  const persistAndNotify = (next: OrderDraftSnapshot) => {
    state = next;
    const store = getStorage();
    if (store) {
      try {
        store.setItem(ORDER_DRAFT_STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Ignore storage quota errors
      }
    }
    listeners.forEach((fn) => fn(state));
  };

  return {
    getSnapshot(): OrderDraftSnapshot {
      return state;
    },

    subscribe(listener: (snap: OrderDraftSnapshot) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    prepareProductionOrder(params: {
      formatId?: OrderFormatId | null;
      industryPreset?: IndustryVerticalSlug | null;
      spotDurationSec?: number;
      briefHint?: string;
      returnPath?: string;
    } = {}): OrderDraftSnapshot {
      const next: OrderDraftSnapshot = {
        ...state,
        mode: 'production_only',
        selectedFormat: params.formatId ?? state.selectedFormat,
        isFormatPreselected: Boolean(params.formatId),
        industryPreset:
          params.industryPreset !== undefined ? params.industryPreset : state.industryPreset,
        spotDurationSec:
          params.spotDurationSec !== undefined
            ? Math.max(5, Math.min(60, Math.round(params.spotDurationSec)))
            : state.spotDurationSec,
        briefText:
          params.briefHint && !state.briefText.trim() ? params.briefHint : state.briefText,
        mediaReservation: airtimeEnabled ? state.mediaReservation : null,
        holdExpiresAtMs: airtimeEnabled ? state.holdExpiresAtMs : null,
        isViewingSubmittedReceipt: false,
        returnPath: params.returnPath ?? state.returnPath,
      };
      persistAndNotify(next);
      return next;
    },

    prepareMediaReservationOrder(
      payload: MediaGridReservationPayload,
      opts: { nowMs?: number; returnPath?: string } = {}
    ): OrderDraftSnapshot {
      if (!airtimeEnabled) {
        return state;
      }
      const nowMs = opts.nowMs ?? Date.now();
      const countdownSec =
        payload.initialCountdownSeconds > 0
          ? payload.initialCountdownSeconds
          : DEFAULT_HOLD_WINDOW_SECONDS;

      const mappedIndustry: IndustryVerticalSlug | null =
        payload.nicheId === 'real_estate'
          ? 'real-estate'
          : payload.nicheId === 'medicine'
            ? 'medicine'
            : payload.nicheId === 'fmcg_retail'
              ? 'retail-fmcg'
              : payload.nicheId === 'b2b_finance'
                ? 'b2b-finance'
                : state.industryPreset;

      const next: OrderDraftSnapshot = {
        ...state,
        mode: 'air_plus_production',
        selectedFormat: payload.initialRecommendedTier,
        spotDurationSec: payload.spotDurationSec ?? state.spotDurationSec,
        industryPreset: mappedIndustry,
        briefText: payload.productNote || state.briefText,
        mediaReservation: payload,
        holdExpiresAtMs: nowMs + countdownSec * 1000,
        reservationProdSelection: payload.initialProductionSelection,
        confirmedReservation: null,
        isViewingSubmittedReceipt: false,
        returnPath: opts.returnPath ?? '/hot-air',
      };
      persistAndNotify(next);
      return next;
    },

    confirmReservationOrder(
      summary: ConfirmedReservationSummary
    ): OrderDraftSnapshot {
      const next: OrderDraftSnapshot = {
        ...state,
        confirmedReservation: summary,
        holdExpiresAtMs: summary.holdExpiresAtMs,
        isViewingSubmittedReceipt: true,
      };
      persistAndNotify(next);
      return next;
    },

    openSubmittedReceipt(): OrderDraftSnapshot {
      if (!state.confirmedReservation) {
        return state;
      }
      const next: OrderDraftSnapshot = {
        ...state,
        isViewingSubmittedReceipt: true,
      };
      persistAndNotify(next);
      return next;
    },

    dismissSubmittedReceipt(): OrderDraftSnapshot {
      if (!state.isViewingSubmittedReceipt) {
        return state;
      }
      const next: OrderDraftSnapshot = {
        ...state,
        isViewingSubmittedReceipt: false,
      };
      persistAndNotify(next);
      return next;
    },

    clearConfirmedReservation(): OrderDraftSnapshot {
      const next: OrderDraftSnapshot = {
        ...state,
        confirmedReservation: null,
        isViewingSubmittedReceipt: false,
      };
      persistAndNotify(next);
      return next;
    },

    switchMode(mode: OrderCheckoutMode): OrderDraftSnapshot {
      if (!airtimeEnabled && mode === 'air_plus_production') {
        return state;
      }
      if (mode === 'air_plus_production' && !state.mediaReservation) {
        return state;
      }
      const next: OrderDraftSnapshot = {
        ...state,
        mode,
        isViewingSubmittedReceipt: false,
      };
      persistAndNotify(next);
      return next;
    },

    updateDraft(patch: Partial<OrderDraftSnapshot>): OrderDraftSnapshot {
      const merged: Partial<OrderDraftSnapshot> = {
        ...state,
        ...patch,
      };
      if (patch.companyName !== undefined || patch.companyInn !== undefined) {
        const nextName = patch.companyName ?? state.companyName;
        const nextInn = patch.companyInn ?? state.companyInn;
        merged.companyName = nextName;
        merged.companyInn = nextInn;
        merged.companyLine = formatStructuredCompanyLine(nextName, nextInn);
      } else if (patch.companyLine !== undefined) {
        const parsed = parseCompanyNameAndInn(patch.companyLine);
        merged.companyName = parsed.companyName;
        merged.companyInn = parsed.companyInn;
      }
      const next = sanitizeDraftFromStorage(merged, airtimeEnabled);
      persistAndNotify(next);
      return next;
    },

    clearMediaReservation(): OrderDraftSnapshot {
      const next: OrderDraftSnapshot = {
        ...state,
        mode: 'production_only',
        mediaReservation: null,
        holdExpiresAtMs: null,
        confirmedReservation: null,
        isViewingSubmittedReceipt: false,
      };
      persistAndNotify(next);
      return next;
    },
  };
}

export const orderDraftStore = createOrderDraftStore();
