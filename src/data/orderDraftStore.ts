import { IndustryVerticalSlug, isValidIndustrySlug } from './platformRouter';
import { OrderFormatId } from './pricingData';
import {
  ComputedReservationTotals,
  MediaGridReservationPayload,
  ReservationProductionSelection,
} from './radioInventory';

export type OrderCheckoutMode = 'production_only' | 'air_plus_production';

export type ReservationLifecycleStatus =
  | 'none'
  | 'draft_selected'
  | 'confirmed_hold';

export interface ConfirmedReservationSummary {
  orderNumber: string;
  confirmedAtMs: number;
  holdExpiresAtMs: number;
  checkoutMode: OrderCheckoutMode;
  contactLine: string;
  companyLine: string;
  formatLabel: string;
  spotDurationSec: number;
  industryLabel: string | null;
  briefNote: string;
  hasVoice: boolean;
  voiceSec: number;
  fileName: string | null;
  conversionAllowed: boolean;
  innVerified: boolean;
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
  spotDurationSec: number;
  industryPreset: IndustryVerticalSlug | null;
  briefText: string;
  contactLine: string;
  companyLine: string;
  mediaReservation: MediaGridReservationPayload | null;
  holdExpiresAtMs: number | null;
  reservationProdSelection: ReservationProductionSelection;
  confirmedReservation: ConfirmedReservationSummary | null;
  returnPath: string;
}

export const ORDER_DRAFT_STORAGE_KEY = 'fmworks_order_draft_v1';
export const DEFAULT_HOLD_WINDOW_SECONDS = 4 * 3600 - 1;

const VALID_ORDER_FORMATS: readonly OrderFormatId[] = [
  'voice_style',
  'turnkey',
  'cinema',
  'adaptation',
];

const VALID_PROD_SELECTIONS: readonly ReservationProductionSelection[] = [
  'bonus_express_24h',
  'voice_style',
  'turnkey',
  'cinema',
  'ready_spot',
];

export function resolveReservationLifecycleStatus(
  snapshot: Pick<OrderDraftSnapshot, 'mediaReservation' | 'confirmedReservation'>
): ReservationLifecycleStatus {
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

export function buildClientNextStepsTimeline(
  checkoutMode: OrderCheckoutMode,
  stationsCount = 0
): readonly ClientNextStepItem[] {
  if (checkoutMode === 'air_plus_production') {
    const stationsPhrase =
      stationsCount === 1
        ? 'выбранной радиостанции'
        : `выбранных радиостанциях (${stationsCount} ст.)`;
    return [
      {
        stepNumber: '01',
        timingLabel: 'Сейчас · 0–15 минут',
        title: 'Блокировка эфирных окон в трафик-службе',
        description: `Сейлз-продюсер сверяет сетку на ${stationsPhrase} и ставит слоты на закрытый 4-часовой резерв, чтобы квота со скидкой не ушла в открытую продажу.`,
      },
      {
        stepNumber: '02',
        timingLabel: 'Через 15–20 минут',
        title: 'Звонок или сообщение продюсера в Telegram',
        description:
          'Персональный продюсер свяжется по вашему контакту, подтвердит точное расписание выходов и при необходимости примет задачу для сценариста устно.',
      },
      {
        stepNumber: '03',
        timingLabel: 'В течение 4 часов',
        title: 'Единый договор-счёт в ЭДО и старт ролика',
        description:
          'Вы получите единую спецификацию и счёт в ЭДО без предоплаты за воздух. Если в пакете заказан ролик — студия подготовит 3 концепции сценария и кастинг дикторов.',
      },
    ];
  }

  return [
    {
      stepNumber: '01',
      timingLabel: 'Сейчас · 0–15 минут',
      title: 'Разбор задачи и юридический пре-чек ФЗ-38',
      description:
        'Исполнительный продюсер фиксирует ваш бриф или голосовое ТЗ, проверяет отраслевые требования радиостанций и подбирает голоса из базы федеральных дикторов.',
    },
    {
      stepNumber: '02',
      timingLabel: 'Через 15–30 минут',
      title: 'Связь продюсера, тайминг и счёт в ЭДО',
      description:
        'Свяжемся по указанному контакту, согласуем точный хронометраж ролика и направим договор-счёт в ЭДО.',
    },
    {
      stepNumber: '03',
      timingLabel: 'За 24–48 часов',
      title: '3 концепции сценария, запись и паспорт прав',
      description:
        'Пришлём 3 варианта сценария на выбор, запишем утверждённый ролик со сведением по ГОСТ радиоэфира и выдадим полный паспорт прав РАО/ВОИС.',
    },
  ];
}

export function createDefaultOrderDraft(): OrderDraftSnapshot {
  return {
    mode: 'production_only',
    selectedFormat: 'turnkey',
    spotDurationSec: 20,
    industryPreset: null,
    briefText: '',
    contactLine: '',
    companyLine: '',
    mediaReservation: null,
    holdExpiresAtMs: null,
    reservationProdSelection: 'turnkey',
    confirmedReservation: null,
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
  return Math.max(0, Math.min(4 * 3600, diffSec));
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
    contactLine: obj.contactLine.slice(0, 240),
    companyLine: typeof obj.companyLine === 'string' ? obj.companyLine.slice(0, 240) : '',
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
    lockedMediaReservation: obj.lockedMediaReservation ?? null,
    lockedTotals: obj.lockedTotals ?? null,
  };
}

function sanitizeDraftFromStorage(raw: unknown): OrderDraftSnapshot {
  const base = createDefaultOrderDraft();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Partial<OrderDraftSnapshot>;

  const mode: OrderCheckoutMode =
    obj.mode === 'air_plus_production' && obj.mediaReservation
      ? 'air_plus_production'
      : 'production_only';

  const selectedFormat: OrderFormatId = VALID_ORDER_FORMATS.includes(
    obj.selectedFormat as OrderFormatId
  )
    ? (obj.selectedFormat as OrderFormatId)
    : base.selectedFormat;

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
    obj.mediaReservation &&
    typeof obj.mediaReservation === 'object' &&
    Array.isArray(obj.mediaReservation.stations) &&
    obj.mediaReservation.stations.length > 0;

  const mediaReservation = hasValidReservation ? obj.mediaReservation! : null;

  const holdExpiresAtMs =
    mediaReservation &&
    typeof obj.holdExpiresAtMs === 'number' &&
    Number.isFinite(obj.holdExpiresAtMs)
      ? obj.holdExpiresAtMs
      : mediaReservation
        ? Date.now() + DEFAULT_HOLD_WINDOW_SECONDS * 1000
        : null;

  const confirmedReservation = sanitizeConfirmedReservation(obj.confirmedReservation);

  return {
    mode: mediaReservation ? mode : 'production_only',
    selectedFormat,
    spotDurationSec,
    industryPreset,
    briefText: typeof obj.briefText === 'string' ? obj.briefText.slice(0, 2000) : '',
    contactLine: typeof obj.contactLine === 'string' ? obj.contactLine.slice(0, 240) : '',
    companyLine: typeof obj.companyLine === 'string' ? obj.companyLine.slice(0, 240) : '',
    mediaReservation,
    holdExpiresAtMs,
    reservationProdSelection,
    confirmedReservation,
    returnPath:
      typeof obj.returnPath === 'string' && obj.returnPath.startsWith('/')
        ? obj.returnPath
        : '/',
  };
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createOrderDraftStore(customStorage?: StorageAdapter) {
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
      return sanitizeDraftFromStorage(JSON.parse(raw));
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
        mode:
          state.mediaReservation && !params.formatId && !params.industryPreset
            ? state.mode
            : 'production_only',
        selectedFormat: params.formatId ?? state.selectedFormat,
        industryPreset:
          params.industryPreset !== undefined ? params.industryPreset : state.industryPreset,
        spotDurationSec:
          params.spotDurationSec !== undefined
            ? Math.max(5, Math.min(60, Math.round(params.spotDurationSec)))
            : state.spotDurationSec,
        briefText:
          params.briefHint && !state.briefText.trim() ? params.briefHint : state.briefText,
        returnPath: params.returnPath ?? state.returnPath,
      };
      persistAndNotify(next);
      return next;
    },

    prepareMediaReservationOrder(
      payload: MediaGridReservationPayload,
      options: { nowMs?: number; returnPath?: string } = {}
    ): OrderDraftSnapshot {
      const nowMs = options.nowMs ?? Date.now();
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
        returnPath: options.returnPath ?? '/hot-air',
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
      };
      persistAndNotify(next);
      return next;
    },

    clearConfirmedReservation(): OrderDraftSnapshot {
      const next: OrderDraftSnapshot = {
        ...state,
        confirmedReservation: null,
      };
      persistAndNotify(next);
      return next;
    },

    switchMode(mode: OrderCheckoutMode): OrderDraftSnapshot {
      if (mode === 'air_plus_production' && !state.mediaReservation) {
        return state;
      }
      const next: OrderDraftSnapshot = {
        ...state,
        mode,
      };
      persistAndNotify(next);
      return next;
    },

    updateDraft(patch: Partial<OrderDraftSnapshot>): OrderDraftSnapshot {
      const next = sanitizeDraftFromStorage({
        ...state,
        ...patch,
      });
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
      };
      persistAndNotify(next);
      return next;
    },
  };
}

export const orderDraftStore = createOrderDraftStore();
