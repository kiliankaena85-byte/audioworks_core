import { LayaPersona, RecommendedTier } from '../engine/layaTypes';
import {
  AIR_BONUS_THRESHOLD_RUB,
  ALL_WEEKDAYS,
  AudienceTag,
  BroadcastChessboardCell,
  calculateCost,
  extractSlotMultiplicityRules,
  formatNumberSpaced,
  formatRubCompact,
  MEDIA_NICHE_OPTIONS,
  MediaClientNiche,
  MediaGridReservationPayload,
  PRODUCTION_MODERATION_GATE_HOURS,
  RadioInventorySlot,
  READY_SPOT_INGEST_GATE_HOURS,
  ReservationProductionSelection,
  ReservedStationSummaryItem,
  resolveSlotPerSecondRates,
  SecondBasedCostResult,
  SlotDurationMultiplicitySec,
  SlotMultiplicityCheckResult,
  SpotReadinessMode,
  TURNKEY_30S_PRODUCTION_RUB,
  WeekdayCode,
  WeekdayNumber,
} from './radioInventory';
import { clampExactSpotSeconds } from './scriptChronometer';

export type DaypartKind =
  | 'morning_prime'
  | 'daytime_block'
  | 'evening_drive'
  | 'weekend_air'
  | 'traffic_weather';

export type AudienceSegmentId = 'b2c_mass' | 'b2c_premium' | 'b2b_decision_makers';
export type AudienceAgeCoreId = '20_35' | '30_45' | '35_55' | '45_plus';
export type ListeningContextId =
  | 'commute_rush'
  | 'office_daytime'
  | 'evening_leisure'
  | 'weekend_family';

export interface TargetAudienceProfile {
  segment: AudienceSegmentId;
  ageCore: AudienceAgeCoreId;
  listeningContext: ListeningContextId;
}

export interface AudienceOptionSpec<T extends string> {
  id: T;
  label: string;
  shortHint: string;
}

export const AUDIENCE_SEGMENT_OPTIONS: readonly AudienceOptionSpec<AudienceSegmentId>[] = [
  {
    id: 'b2c_mass',
    label: 'B2C широкий спрос',
    shortHint: 'Городские покупки, услуги, клиники, сети и доставка',
  },
  {
    id: 'b2c_premium',
    label: 'B2C бизнес и премиум',
    shortHint: 'Недвижимость бизнес-класса, автодилеры, частная медицина',
  },
  {
    id: 'b2b_decision_makers',
    label: 'B2B и руководители',
    shortHint: 'Собственники компаний, финансы, лизинг, закупки и IT',
  },
] as const;

export const AUDIENCE_AGE_OPTIONS: readonly AudienceOptionSpec<AudienceAgeCoreId>[] = [
  { id: '20_35', label: '20–35 лет', shortHint: 'Активное молодое ядро' },
  { id: '30_45', label: '30–45 лет', shortHint: 'Платежеспособный пик карьеры' },
  { id: '35_55', label: '35–55 лет', shortHint: 'Руководители и семейный бюджет' },
  { id: '45_plus', label: '45+ лет', shortHint: 'Зрелая аудитория с высоким доверием' },
] as const;

export const LISTENING_CONTEXT_OPTIONS: readonly AudienceOptionSpec<ListeningContextId>[] = [
  {
    id: 'commute_rush',
    label: 'За рулём в часах пик',
    shortHint: 'Утренний и вечерний поток + сводки трафика',
  },
  {
    id: 'office_daytime',
    label: 'Днём в делах и офисе',
    shortHint: 'Ровный дневной эфир будней без переплаты за утро',
  },
  {
    id: 'evening_leisure',
    label: 'Только вечерний прайм',
    shortHint: 'Путь домой и спокойное внимание после рабочего дня',
  },
  {
    id: 'weekend_family',
    label: 'Выходные и загород',
    shortHint: 'Суббота и воскресенье: ТЦ, клиники, просмотры ЖК',
  },
] as const;

export const MIN_FLEXIBLE_BUDGET_RUB = 40_000;
export const MAX_FLEXIBLE_BUDGET_RUB = 1_500_000;
export const DEFAULT_FLEXIBLE_BUDGET_RUB = 180_000;

export const FLEXIBLE_BUDGET_PRESETS = [
  { amount: 40_000, label: '40 000 ₽ · Тест' },
  { amount: 85_000, label: '85 000 ₽' },
  { amount: 180_000, label: '180 000 ₽' },
  { amount: 320_000, label: '320 000 ₽' },
  { amount: 420_000, label: '420 000 ₽ · Ролик 0 ₽' },
] as const;

export interface StationDaypartVariation {
  id: string;
  stationId: string;
  kind: DaypartKind;
  label: string;
  hoursWindow: string;
  programNote: string;
  daysPattern: string;
  weekdays: WeekdayNumber[];
  sampleTimeSlots: string[];
  /** Официальная ставка 1 секунды 1 выхода по прайсу радиостанции (₽) */
  officialRatePerSec: number;
  /** Горящая ставка 1 секунды 1 выхода для клиента FMWorks (₽) */
  hotRatePerSec: number;
  minSpots: number;
  defaultSpots: number;
  maxSpots: number;
  stepSpots: number;
  /** Контакты OTS в расчёте на 1 выход в этом временном окне */
  reachPerSpotOTS: number;
  maxSpotSeconds: number;
  /** Шаг кратности хронометража слота в секундах (по умолчанию 1 сек для линейных блоков и 5 сек для спонсорства) */
  durationMultiplicitySec?: SlotDurationMultiplicitySec;
  deadlineHours: number;
  bestContexts: ListeningContextId[];
  sourceKind?: 'seed' | 'imported' | 'manual';
}

export interface RadioStationCatalogItem {
  stationId: string;
  station: string;
  frequencyFm: string;
  formatDesc: string;
  audienceTags: AudienceTag[];
  ageCores: AudienceAgeCoreId[];
  segments: AudienceSegmentId[];
  variations: StationDaypartVariation[];
}

export interface AiSemanticRecommendationHint {
  preferredDayparts?: DaypartKind[];
  avoidedDayparts?: DaypartKind[];
  boostedStationIds?: string[];
  buyerHeadline?: string;
  buyerRationale?: string;
  slotReasonsByStationId?: Record<string, string>;
  usedGeminiModel?: boolean;
}

export interface SelectedVariationState {
  variationId: string;
  spotsCount: number;
}

export interface ComputedVariationQuote {
  stationItem: RadioStationCatalogItem;
  variation: StationDaypartVariation;
  spotsCount: number;
  spotSeconds: number;
  /** Тарифицируемые секунды с учётом проверки кратности слота */
  billedSeconds: number;
  /** Детальный результат проверки кратности слота */
  multiplicity: SlotMultiplicityCheckResult;
  officialPriceRub: number;
  hotPriceRub: number;
  discountPercent: number;
  reachOTS: number;
  affinity: number;
  rankingScore: number;
  tier: 1 | 2;
  matchReason: string;
  isEligibleForTimeGate: boolean;
  isEligibleForDuration: boolean;
  isUltraUrgent: boolean;
}

export interface ProductionCostSpec {
  spotSeconds: number;
  spotReadiness: SpotReadinessMode;
  basePriceRub: number;
  effectivePriceRub: number;
  originalValueRub: number;
  isBonusUnlocked: boolean;
  tierCode: RecommendedTier;
  reservationSelection: ReservationProductionSelection;
  title: string;
}

export interface FlexibleMediaPlanResult {
  niche: MediaClientNiche;
  audience: TargetAudienceProfile;
  productNote: string;
  totalBudgetRub: number;
  spotSeconds: number;
  spotReadiness: SpotReadinessMode;
  minRequiredDeadlineHours: number;
  stationsCatalog: RadioStationCatalogItem[];
  allQuotedVariations: ComputedVariationQuote[];
  lockedUrgentVariations: StationDaypartVariation[];
  selectedQuotes: ComputedVariationQuote[];
  selectedStationsCount: number;
  totalSpots: number;
  totalReachOTS: number;
  targetAudienceSharePct: number;
  officialAirTotalRub: number;
  hotAirTotalRub: number;
  airDiscountPercent: number;
  production: ProductionCostSpec;
  totalClientCostRub: number;
  totalSavingsRub: number;
  remainingToBonusRub: number;
  minDeadlineHours: number | null;
  buyerRationale: string;
  usedAiEngine: boolean;
}

/**
 * Дефолтный портрет Целевой Аудитории при переключении отраслевой ниши,
 * который пользователь может свободно менять вручную.
 */
export function getDefaultAudienceForNiche(niche: MediaClientNiche): TargetAudienceProfile {
  switch (niche) {
    case 'real_estate':
      return {
        segment: 'b2c_premium',
        ageCore: '30_45',
        listeningContext: 'commute_rush',
      };
    case 'b2b_finance':
      return {
        segment: 'b2b_decision_makers',
        ageCore: '35_55',
        listeningContext: 'commute_rush',
      };
    case 'fmcg_retail':
      return {
        segment: 'b2c_mass',
        ageCore: '20_35',
        listeningContext: 'office_daytime',
      };
    case 'medicine':
      return {
        segment: 'b2c_mass',
        ageCore: '35_55',
        listeningContext: 'office_daytime',
      };
    case 'auto_services':
      return {
        segment: 'b2c_premium',
        ageCore: '30_45',
        listeningContext: 'commute_rush',
      };
  }
}

export function formatAudienceSummaryLine(audience: TargetAudienceProfile): string {
  const seg =
    AUDIENCE_SEGMENT_OPTIONS.find((s) => s.id === audience.segment)?.label ?? 'B2C';
  const age =
    AUDIENCE_AGE_OPTIONS.find((a) => a.id === audience.ageCore)?.label ?? '30–45 лет';
  const ctx =
    LISTENING_CONTEXT_OPTIONS.find((c) => c.id === audience.listeningContext)?.label ??
    'В часах пик';
  return `${seg} · ${age} · ${ctx}`;
}

/**
 * Двухуровневый каталог 10 ключевых радиостанций, где внутри КАЖДОЙ станции
 * есть несколько независимых эфирных окон (Утро, День, Вечер, Выходные, Трафик/Погода).
 */
export const FLAGSHIP_STATION_CATALOG: readonly RadioStationCatalogItem[] = [
  {
    stationId: 'bfm',
    station: 'Business FM',
    frequencyFm: '87.5 FM',
    formatDesc: 'Деловые новости, рынки, инвестиции и недвижимость каждые 15 минут',
    audienceTags: ['b2b', 'real_estate', 'premium', 'auto'],
    ageCores: ['30_45', '35_55', '45_plus'],
    segments: ['b2b_decision_makers', 'b2c_premium'],
    variations: [
      {
        id: 'bfm-morning',
        stationId: 'bfm',
        kind: 'morning_prime',
        label: 'Утренний прайм',
        hoursWindow: '07:30–10:30',
        programNote: 'Утренний деловой поток и сводки рынков',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['08:15', '09:15', '10:05'],
        officialRatePerSec: 1_080,
        hotRatePerSec: 680,
        minSpots: 6,
        defaultSpots: 14,
        maxSpots: 35,
        stepSpots: 2,
        reachPerSpotOTS: 20_500,
        maxSpotSeconds: 60,
        deadlineHours: 28,
        bestContexts: ['commute_rush'],
        sourceKind: 'seed',
      },
      {
        id: 'bfm-day',
        stationId: 'bfm',
        kind: 'daytime_block',
        label: 'Дневной деловой блок',
        hoursWindow: '11:30–16:30',
        programNote: 'Отраслевые обзоры, банки и сектор B2B в рабочие часы',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['12:15', '14:15', '15:45'],
        officialRatePerSec: 790,
        hotRatePerSec: 490,
        minSpots: 6,
        defaultSpots: 12,
        maxSpots: 30,
        stepSpots: 2,
        reachPerSpotOTS: 16_500,
        maxSpotSeconds: 60,
        deadlineHours: 26,
        bestContexts: ['office_daytime'],
        sourceKind: 'seed',
      },
      {
        id: 'bfm-evening',
        stationId: 'bfm',
        kind: 'evening_drive',
        label: 'Вечерний драйв',
        hoursWindow: '17:30–20:30',
        programNote: 'Итоги делового дня по пути домой',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['17:45', '18:45', '19:45'],
        officialRatePerSec: 960,
        hotRatePerSec: 590,
        minSpots: 6,
        defaultSpots: 14,
        maxSpots: 35,
        stepSpots: 2,
        reachPerSpotOTS: 19_200,
        maxSpotSeconds: 60,
        deadlineHours: 28,
        bestContexts: ['commute_rush', 'evening_leisure'],
        sourceKind: 'seed',
      },
      {
        id: 'bfm-traffic',
        stationId: 'bfm',
        kind: 'traffic_weather',
        label: 'Спонсорство деловой погоды',
        hoursWindow: '08:30 · 13:30 · 18:30',
        programNote: 'Приоритетная позиция перед сводкой трафика и курсов',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['08:30', '13:30', '18:30'],
        officialRatePerSec: 1_120,
        hotRatePerSec: 640,
        minSpots: 5,
        defaultSpots: 10,
        maxSpots: 25,
        stepSpots: 5,
        reachPerSpotOTS: 22_000,
        maxSpotSeconds: 30,
        deadlineHours: 9,
        bestContexts: ['commute_rush', 'office_daytime'],
        sourceKind: 'seed',
      },
    ],
  },
  {
    stationId: 'montecarlo',
    station: 'Радио Monte Carlo',
    frequencyFm: '102.1 FM',
    formatDesc: 'Мировая классика, киномузыка и аудитория с высоким доходом',
    audienceTags: ['real_estate', 'premium', 'medicine', 'auto'],
    ageCores: ['30_45', '35_55', '45_plus'],
    segments: ['b2c_premium', 'b2b_decision_makers'],
    variations: [
      {
        id: 'mc-morning',
        stationId: 'montecarlo',
        kind: 'morning_prime',
        label: 'Утренний прайм',
        hoursWindow: '08:00–11:00',
        programNote: 'Спокойное утро без информационного шума',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['08:25', '09:25', '10:25'],
        officialRatePerSec: 840,
        hotRatePerSec: 520,
        minSpots: 6,
        defaultSpots: 12,
        maxSpots: 30,
        stepSpots: 2,
        reachPerSpotOTS: 17_500,
        maxSpotSeconds: 60,
        deadlineHours: 30,
        bestContexts: ['commute_rush'],
        sourceKind: 'seed',
      },
      {
        id: 'mc-day',
        stationId: 'montecarlo',
        kind: 'daytime_block',
        label: 'Дневная коллекция',
        hoursWindow: '12:00–16:30',
        programNote: 'Фоновое прослушивание в кабинетах, салонах и бутикаx',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['12:40', '14:20', '15:50'],
        officialRatePerSec: 650,
        hotRatePerSec: 390,
        minSpots: 5,
        defaultSpots: 12,
        maxSpots: 30,
        stepSpots: 2,
        reachPerSpotOTS: 15_200,
        maxSpotSeconds: 60,
        deadlineHours: 28,
        bestContexts: ['office_daytime'],
        sourceKind: 'seed',
      },
      {
        id: 'mc-evening',
        stationId: 'montecarlo',
        kind: 'evening_drive',
        label: 'Вечерний драйв',
        hoursWindow: '17:30–20:30',
        programNote: 'Прайм возвращения домой, недвижимость и премиум-услуги',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['17:50', '18:40', '19:30'],
        officialRatePerSec: 860,
        hotRatePerSec: 540,
        minSpots: 6,
        defaultSpots: 14,
        maxSpots: 32,
        stepSpots: 2,
        reachPerSpotOTS: 18_400,
        maxSpotSeconds: 60,
        deadlineHours: 32,
        bestContexts: ['evening_leisure', 'commute_rush'],
        sourceKind: 'seed',
      },
      {
        id: 'mc-weekend',
        stationId: 'montecarlo',
        kind: 'weekend_air',
        label: 'Выходные Сб–Вс',
        hoursWindow: '10:30–18:30',
        programNote: 'Поездки на просмотры ЖК, рестораны и семейный отдых',
        daysPattern: 'Сб–Вс',
        weekdays: [6, 7],
        sampleTimeSlots: ['11:20', '14:20', '17:20'],
        officialRatePerSec: 590,
        hotRatePerSec: 350,
        minSpots: 4,
        defaultSpots: 10,
        maxSpots: 24,
        stepSpots: 2,
        reachPerSpotOTS: 16_800,
        maxSpotSeconds: 60,
        deadlineHours: 30,
        bestContexts: ['weekend_family'],
        sourceKind: 'seed',
      },
    ],
  },
  {
    stationId: 'avtoradio',
    station: 'Авторадио',
    frequencyFm: '90.3 FM',
    formatDesc: 'Лидер автомобильного прайма и городских сводок движения',
    audienceTags: ['auto', 'fmcg', 'mass', 'real_estate'],
    ageCores: ['30_45', '35_55', '45_plus'],
    segments: ['b2c_mass', 'b2c_premium'],
    variations: [
      {
        id: 'avto-morning',
        stationId: 'avtoradio',
        kind: 'morning_prime',
        label: 'Утреннее драйв-шоу',
        hoursWindow: '07:30–10:30',
        programNote: 'Максимальная плотность водителей в утреннем потоке',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['08:20', '09:10', '10:05'],
        officialRatePerSec: 920,
        hotRatePerSec: 560,
        minSpots: 6,
        defaultSpots: 15,
        maxSpots: 35,
        stepSpots: 3,
        reachPerSpotOTS: 31_000,
        maxSpotSeconds: 45,
        deadlineHours: 26,
        bestContexts: ['commute_rush'],
        sourceKind: 'seed',
      },
      {
        id: 'avto-day',
        stationId: 'avtoradio',
        kind: 'daytime_block',
        label: 'Дневной эфир',
        hoursWindow: '11:30–16:30',
        programNote: 'Коммерческий транспорт, логистика и дневные поездки',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['12:20', '14:10', '15:40'],
        officialRatePerSec: 660,
        hotRatePerSec: 395,
        minSpots: 5,
        defaultSpots: 14,
        maxSpots: 32,
        stepSpots: 2,
        reachPerSpotOTS: 24_500,
        maxSpotSeconds: 60,
        deadlineHours: 25,
        bestContexts: ['office_daytime'],
        sourceKind: 'seed',
      },
      {
        id: 'avto-evening',
        stationId: 'avtoradio',
        kind: 'evening_drive',
        label: 'Вечерний драйв',
        hoursWindow: '17:00–20:30',
        programNote: 'Высокое удержание за рулём на пути из центра и офисов',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['17:35', '18:35', '19:35'],
        officialRatePerSec: 890,
        hotRatePerSec: 535,
        minSpots: 6,
        defaultSpots: 14,
        maxSpots: 35,
        stepSpots: 2,
        reachPerSpotOTS: 29_500,
        maxSpotSeconds: 45,
        deadlineHours: 27,
        bestContexts: ['commute_rush', 'evening_leisure'],
        sourceKind: 'seed',
      },
      {
        id: 'avto-traffic',
        stationId: 'avtoradio',
        kind: 'traffic_weather',
        label: 'Спонсорство трафика',
        hoursWindow: '08:30 · 13:30 · 18:30',
        programNote: 'Выход первым номером в сводке дорожного движения',
        daysPattern: 'Пн–Сб',
        weekdays: [1, 2, 3, 4, 5, 6],
        sampleTimeSlots: ['08:30', '13:30', '18:30'],
        officialRatePerSec: 980,
        hotRatePerSec: 530,
        minSpots: 6,
        defaultSpots: 12,
        maxSpots: 30,
        stepSpots: 3,
        reachPerSpotOTS: 33_500,
        maxSpotSeconds: 20,
        deadlineHours: 8,
        bestContexts: ['commute_rush'],
        sourceKind: 'seed',
      },
    ],
  },
  {
    stationId: 'europaplus',
    station: 'Европа Плюс',
    frequencyFm: '106.2 FM',
    formatDesc: 'Высокий охват активной городской аудитории 20–45 лет',
    audienceTags: ['fmcg', 'mass', 'auto', 'medicine'],
    ageCores: ['20_35', '30_45'],
    segments: ['b2c_mass', 'b2c_premium'],
    variations: [
      {
        id: 'ep-morning',
        stationId: 'europaplus',
        kind: 'morning_prime',
        label: 'Утреннее шоу «Бригада У»',
        hoursWindow: '07:30–10:30',
        programNote: 'Флагманский утренний охват активных горожан',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['08:10', '09:15', '10:00'],
        officialRatePerSec: 880,
        hotRatePerSec: 540,
        minSpots: 6,
        defaultSpots: 14,
        maxSpots: 32,
        stepSpots: 2,
        reachPerSpotOTS: 30_500,
        maxSpotSeconds: 45,
        deadlineHours: 30,
        bestContexts: ['commute_rush'],
        sourceKind: 'seed',
      },
      {
        id: 'ep-day',
        stationId: 'europaplus',
        kind: 'daytime_block',
        label: 'Дневной интерактив',
        hoursWindow: '12:00–16:30',
        programNote: 'Ритейл, доставка, кофейни и онлайн-сервисы',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['12:35', '14:20', '15:40'],
        officialRatePerSec: 690,
        hotRatePerSec: 420,
        minSpots: 5,
        defaultSpots: 14,
        maxSpots: 34,
        stepSpots: 2,
        reachPerSpotOTS: 26_500,
        maxSpotSeconds: 60,
        deadlineHours: 28,
        bestContexts: ['office_daytime'],
        sourceKind: 'seed',
      },
      {
        id: 'ep-evening',
        stationId: 'europaplus',
        kind: 'evening_drive',
        label: 'Вечернее шоу «РАШ»',
        hoursWindow: '17:30–20:30',
        programNote: 'Динамичный вечерний прайм перед покупками и отдыхом',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['17:50', '18:50', '19:50'],
        officialRatePerSec: 810,
        hotRatePerSec: 495,
        minSpots: 6,
        defaultSpots: 14,
        maxSpots: 32,
        stepSpots: 2,
        reachPerSpotOTS: 28_500,
        maxSpotSeconds: 45,
        deadlineHours: 29,
        bestContexts: ['evening_leisure', 'commute_rush'],
        sourceKind: 'seed',
      },
      {
        id: 'ep-weekend',
        stationId: 'europaplus',
        kind: 'weekend_air',
        label: 'Уикенд-хит Сб–Вс',
        hoursWindow: '11:00–19:00',
        programNote: 'Торговые центры, маркетплейсы, события и HoReCa',
        daysPattern: 'Сб–Вс',
        weekdays: [6, 7],
        sampleTimeSlots: ['11:45', '14:45', '17:45'],
        officialRatePerSec: 580,
        hotRatePerSec: 345,
        minSpots: 5,
        defaultSpots: 12,
        maxSpots: 28,
        stepSpots: 2,
        reachPerSpotOTS: 25_000,
        maxSpotSeconds: 60,
        deadlineHours: 26,
        bestContexts: ['weekend_family', 'evening_leisure'],
        sourceKind: 'seed',
      },
    ],
  },
  {
    stationId: 'comedy',
    station: 'Comedy Radio',
    frequencyFm: '102.5 FM',
    formatDesc: 'Разговорно-развлекательный формат с высоким удержанием без переключения волны',
    audienceTags: ['auto', 'fmcg', 'b2b', 'mass'],
    ageCores: ['20_35', '30_45'],
    segments: ['b2c_mass', 'b2c_premium', 'b2b_decision_makers'],
    variations: [
      {
        id: 'cmd-morning',
        stationId: 'comedy',
        kind: 'morning_prime',
        label: 'Утреннее шоу «Гутен Морген Фримен»',
        hoursWindow: '08:00–11:00',
        programNote: 'Вовлечённое прослушивание диалогов в утренних пробках',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['08:25', '09:30', '10:20'],
        officialRatePerSec: 740,
        hotRatePerSec: 450,
        minSpots: 5,
        defaultSpots: 14,
        maxSpots: 30,
        stepSpots: 2,
        reachPerSpotOTS: 23_000,
        maxSpotSeconds: 45,
        deadlineHours: 27,
        bestContexts: ['commute_rush'],
        sourceKind: 'seed',
      },
      {
        id: 'cmd-day',
        stationId: 'comedy',
        kind: 'daytime_block',
        label: 'Дневной эфир',
        hoursWindow: '12:00–16:30',
        programNote: 'Доступный тест-драйв для сервисов, авто и доставки',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['12:30', '14:30', '16:00'],
        officialRatePerSec: 460,
        hotRatePerSec: 275,
        minSpots: 5,
        defaultSpots: 12,
        maxSpots: 30,
        stepSpots: 2,
        reachPerSpotOTS: 18_500,
        maxSpotSeconds: 60,
        deadlineHours: 26,
        bestContexts: ['office_daytime'],
        sourceKind: 'seed',
      },
      {
        id: 'cmd-evening',
        stationId: 'comedy',
        kind: 'evening_drive',
        label: 'Вечернее шоу «Счастливые люди»',
        hoursWindow: '17:30–20:30',
        programNote: 'Платёжеспособная аудитория в вечернем потоке',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['17:45', '18:35', '19:40'],
        officialRatePerSec: 720,
        hotRatePerSec: 440,
        minSpots: 5,
        defaultSpots: 14,
        maxSpots: 32,
        stepSpots: 2,
        reachPerSpotOTS: 24_200,
        maxSpotSeconds: 45,
        deadlineHours: 27,
        bestContexts: ['evening_leisure', 'commute_rush'],
        sourceKind: 'seed',
      },
    ],
  },
  {
    stationId: 'kommersant',
    station: 'Коммерсантъ FM',
    frequencyFm: '93.6 FM',
    formatDesc: 'Непрерывная деловая картина дня, собственники бизнеса и топ-менеджмент',
    audienceTags: ['b2b', 'real_estate', 'premium'],
    ageCores: ['30_45', '35_55', '45_plus'],
    segments: ['b2b_decision_makers', 'b2c_premium'],
    variations: [
      {
        id: 'kom-morning',
        stationId: 'kommersant',
        kind: 'morning_prime',
        label: 'Утренние деловые новости',
        hoursWindow: '07:30–10:30',
        programNote: 'Первые лица компаний и финансовый сектор',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['08:10', '09:10', '10:10'],
        officialRatePerSec: 730,
        hotRatePerSec: 455,
        minSpots: 5,
        defaultSpots: 14,
        maxSpots: 30,
        stepSpots: 2,
        reachPerSpotOTS: 16_200,
        maxSpotSeconds: 60,
        deadlineHours: 29,
        bestContexts: ['commute_rush'],
        sourceKind: 'seed',
      },
      {
        id: 'kom-day',
        stationId: 'kommersant',
        kind: 'daytime_block',
        label: 'Дневная аналитика и рынки',
        hoursWindow: '11:30–16:30',
        programNote: 'Точечный B2B-контакт с минимальным порогом бюджета',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['12:10', '14:10', '16:10'],
        officialRatePerSec: 450,
        hotRatePerSec: 275,
        minSpots: 5,
        defaultSpots: 12,
        maxSpots: 30,
        stepSpots: 2,
        reachPerSpotOTS: 13_400,
        maxSpotSeconds: 60,
        deadlineHours: 26,
        bestContexts: ['office_daytime'],
        sourceKind: 'seed',
      },
      {
        id: 'kom-evening',
        stationId: 'kommersant',
        kind: 'evening_drive',
        label: 'Вечерняя главная тема',
        hoursWindow: '17:30–20:30',
        programNote: 'Аналитические итоги дня для инвесторов и девелопмента',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['17:50', '18:50', '19:50'],
        officialRatePerSec: 690,
        hotRatePerSec: 425,
        minSpots: 5,
        defaultSpots: 14,
        maxSpots: 30,
        stepSpots: 2,
        reachPerSpotOTS: 15_600,
        maxSpotSeconds: 60,
        deadlineHours: 28,
        bestContexts: ['evening_leisure', 'commute_rush'],
        sourceKind: 'seed',
      },
    ],
  },
  {
    stationId: 'dorozhnoe',
    station: 'Дорожное Радио',
    frequencyFm: '96.0 FM',
    formatDesc: 'Широкий семейный охват, медицина, торговые сети и загородное направление',
    audienceTags: ['medicine', 'fmcg', 'mass', 'auto'],
    ageCores: ['35_55', '45_plus'],
    segments: ['b2c_mass'],
    variations: [
      {
        id: 'dor-morning',
        stationId: 'dorozhnoe',
        kind: 'morning_prime',
        label: 'Утренний семейный прайм',
        hoursWindow: '07:30–10:30',
        programNote: 'Тёплая лояльная подача для клиник, аптек и продуктов',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['08:15', '09:15', '10:15'],
        officialRatePerSec: 520,
        hotRatePerSec: 315,
        minSpots: 5,
        defaultSpots: 14,
        maxSpots: 34,
        stepSpots: 2,
        reachPerSpotOTS: 28_000,
        maxSpotSeconds: 60,
        deadlineHours: 32,
        bestContexts: ['commute_rush'],
        sourceKind: 'seed',
      },
      {
        id: 'dor-day',
        stationId: 'dorozhnoe',
        kind: 'daytime_block',
        label: 'Дневной блок',
        hoursWindow: '11:30–16:30',
        programNote: 'Лучшая цена за контакт для тестового запуска от 40 000 ₽',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['12:25', '14:25', '15:55'],
        officialRatePerSec: 410,
        hotRatePerSec: 250,
        minSpots: 5,
        defaultSpots: 14,
        maxSpots: 36,
        stepSpots: 2,
        reachPerSpotOTS: 25_500,
        maxSpotSeconds: 60,
        deadlineHours: 34,
        bestContexts: ['office_daytime'],
        sourceKind: 'seed',
      },
      {
        id: 'dor-traffic',
        stationId: 'dorozhnoe',
        kind: 'traffic_weather',
        label: 'Спонсорство погоды и дорог',
        hoursWindow: '08:30 · 12:30 · 18:30',
        programNote: 'Высокое внимание перед дорожной сводкой',
        daysPattern: 'Ср–Вс',
        weekdays: [3, 4, 5, 6, 7],
        sampleTimeSlots: ['08:30', '12:30', '18:30'],
        officialRatePerSec: 490,
        hotRatePerSec: 295,
        minSpots: 5,
        defaultSpots: 15,
        maxSpots: 35,
        stepSpots: 3,
        reachPerSpotOTS: 30_200,
        maxSpotSeconds: 30,
        deadlineHours: 36,
        bestContexts: ['commute_rush', 'weekend_family'],
        sourceKind: 'seed',
      },
      {
        id: 'dor-weekend',
        stationId: 'dorozhnoe',
        kind: 'weekend_air',
        label: 'Дачный и семейный уикенд',
        hoursWindow: '10:00–18:00',
        programNote: 'Загородные поездки, строительные гипермаркеты и семья',
        daysPattern: 'Сб–Вс',
        weekdays: [6, 7],
        sampleTimeSlots: ['10:40', '13:40', '16:40'],
        officialRatePerSec: 390,
        hotRatePerSec: 235,
        minSpots: 5,
        defaultSpots: 12,
        maxSpots: 30,
        stepSpots: 2,
        reachPerSpotOTS: 27_000,
        maxSpotSeconds: 60,
        deadlineHours: 30,
        bestContexts: ['weekend_family'],
        sourceKind: 'seed',
      },
    ],
  },
  {
    stationId: 'retrofm',
    station: 'Ретро FM',
    frequencyFm: '88.3 FM',
    formatDesc: 'Зрелая платёжеспособная аудитория 35–60 лет с высоким доверием к эфиру',
    audienceTags: ['medicine', 'fmcg', 'real_estate', 'mass'],
    ageCores: ['35_55', '45_plus'],
    segments: ['b2c_mass', 'b2c_premium'],
    variations: [
      {
        id: 'ret-morning',
        stationId: 'retrofm',
        kind: 'morning_prime',
        label: 'Утреннее шоу «Первая смена»',
        hoursWindow: '07:30–10:30',
        programNote: 'Высокий отклик на медицину, стоматологию и товары для дома',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['07:55', '08:50', '09:50'],
        officialRatePerSec: 540,
        hotRatePerSec: 330,
        minSpots: 5,
        defaultSpots: 14,
        maxSpots: 32,
        stepSpots: 2,
        reachPerSpotOTS: 26_800,
        maxSpotSeconds: 60,
        deadlineHours: 25,
        bestContexts: ['commute_rush'],
        sourceKind: 'seed',
      },
      {
        id: 'ret-day',
        stationId: 'retrofm',
        kind: 'daytime_block',
        label: 'Дневной эфир «Феличита»',
        hoursWindow: '12:00–16:00',
        programNote: 'Спокойный дневной контакт по выгодной ставке секунды',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['12:20', '13:50', '15:20'],
        officialRatePerSec: 420,
        hotRatePerSec: 255,
        minSpots: 5,
        defaultSpots: 12,
        maxSpots: 32,
        stepSpots: 2,
        reachPerSpotOTS: 23_500,
        maxSpotSeconds: 60,
        deadlineHours: 26,
        bestContexts: ['office_daytime'],
        sourceKind: 'seed',
      },
      {
        id: 'ret-evening',
        stationId: 'retrofm',
        kind: 'evening_drive',
        label: 'Вечерний прайм',
        hoursWindow: '17:00–20:00',
        programNote: 'Возвращение с работы и планирование семейных покупок',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['17:25', '18:25', '19:25'],
        officialRatePerSec: 510,
        hotRatePerSec: 310,
        minSpots: 5,
        defaultSpots: 14,
        maxSpots: 32,
        stepSpots: 2,
        reachPerSpotOTS: 25_200,
        maxSpotSeconds: 60,
        deadlineHours: 27,
        bestContexts: ['evening_leisure', 'commute_rush'],
        sourceKind: 'seed',
      },
    ],
  },
  {
    stationId: 'silverrain',
    station: 'Серебряный Дождь',
    frequencyFm: '100.1 FM',
    formatDesc: 'Интеллектуальная аудитория, архитектура, девелопмент и частный капитал',
    audienceTags: ['real_estate', 'premium', 'b2b', 'auto'],
    ageCores: ['30_45', '35_55', '45_plus'],
    segments: ['b2c_premium', 'b2b_decision_makers'],
    variations: [
      {
        id: 'sr-morning',
        stationId: 'silverrain',
        kind: 'morning_prime',
        label: 'Утренний авторский эфир',
        hoursWindow: '08:00–11:00',
        programNote: 'Вдумчивая аудитория предпринимателей и архитекторов',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['08:30', '09:30', '10:30'],
        officialRatePerSec: 640,
        hotRatePerSec: 390,
        minSpots: 5,
        defaultSpots: 12,
        maxSpots: 28,
        stepSpots: 2,
        reachPerSpotOTS: 16_800,
        maxSpotSeconds: 60,
        deadlineHours: 30,
        bestContexts: ['commute_rush'],
        sourceKind: 'seed',
      },
      {
        id: 'sr-day',
        stationId: 'silverrain',
        kind: 'daytime_block',
        label: 'Дневные спецпроекты',
        hoursWindow: '12:00–16:30',
        programNote: 'Компактный вход в премиум-сегмент от 40 000 ₽',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['12:45', '14:15', '15:45'],
        officialRatePerSec: 435,
        hotRatePerSec: 265,
        minSpots: 5,
        defaultSpots: 12,
        maxSpots: 28,
        stepSpots: 2,
        reachPerSpotOTS: 14_200,
        maxSpotSeconds: 60,
        deadlineHours: 28,
        bestContexts: ['office_daytime'],
        sourceKind: 'seed',
      },
      {
        id: 'sr-evening',
        stationId: 'silverrain',
        kind: 'evening_drive',
        label: 'Вечерние итоги',
        hoursWindow: '17:30–20:30',
        programNote: 'Ключевой вечерний слот для недвижимости и авто бизнес-класса',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['17:55', '18:55', '19:55'],
        officialRatePerSec: 680,
        hotRatePerSec: 415,
        minSpots: 5,
        defaultSpots: 14,
        maxSpots: 30,
        stepSpots: 2,
        reachPerSpotOTS: 17_600,
        maxSpotSeconds: 60,
        deadlineHours: 34,
        bestContexts: ['evening_leisure', 'commute_rush'],
        sourceKind: 'seed',
      },
      {
        id: 'sr-weekend',
        stationId: 'silverrain',
        kind: 'weekend_air',
        label: 'Авторские выходные Сб–Вс',
        hoursWindow: '11:00–18:00',
        programNote: 'Гастрономия, культура, загородные резиденции и путешествия',
        daysPattern: 'Сб–Вс',
        weekdays: [6, 7],
        sampleTimeSlots: ['11:30', '14:30', '17:00'],
        officialRatePerSec: 440,
        hotRatePerSec: 265,
        minSpots: 5,
        defaultSpots: 10,
        maxSpots: 24,
        stepSpots: 2,
        reachPerSpotOTS: 15_000,
        maxSpotSeconds: 60,
        deadlineHours: 30,
        bestContexts: ['weekend_family'],
        sourceKind: 'seed',
      },
    ],
  },
  {
    stationId: 'jazz',
    station: 'Радио JAZZ',
    frequencyFm: '89.1 FM',
    formatDesc: 'Премиальная джазовая классика, высокий чек и взыскательные слушатели',
    audienceTags: ['premium', 'real_estate', 'b2b', 'medicine'],
    ageCores: ['35_55', '45_plus'],
    segments: ['b2c_premium', 'b2b_decision_makers'],
    variations: [
      {
        id: 'jazz-morning',
        stationId: 'jazz',
        kind: 'morning_prime',
        label: 'Утренний джаз',
        hoursWindow: '08:00–11:00',
        programNote: 'Мягкая интеграция для премиальных брендов и медицины',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['08:35', '09:35', '10:35'],
        officialRatePerSec: 590,
        hotRatePerSec: 360,
        minSpots: 5,
        defaultSpots: 12,
        maxSpots: 28,
        stepSpots: 2,
        reachPerSpotOTS: 14_800,
        maxSpotSeconds: 60,
        deadlineHours: 28,
        bestContexts: ['commute_rush'],
        sourceKind: 'seed',
      },
      {
        id: 'jazz-evening',
        stationId: 'jazz',
        kind: 'evening_drive',
        label: 'Вечерний лаунж-прайм',
        hoursWindow: '18:00–21:00',
        programNote: 'Расслабленное вечернее прослушивание без рекламной суеты',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['18:20', '19:20', '20:20'],
        officialRatePerSec: 610,
        hotRatePerSec: 375,
        minSpots: 5,
        defaultSpots: 12,
        maxSpots: 28,
        stepSpots: 2,
        reachPerSpotOTS: 15_400,
        maxSpotSeconds: 60,
        deadlineHours: 30,
        bestContexts: ['evening_leisure'],
        sourceKind: 'seed',
      },
      {
        id: 'jazz-traffic-flash',
        stationId: 'jazz',
        kind: 'traffic_weather',
        label: 'Срочное спонсорство погоды',
        hoursWindow: '08:20 · 13:20 · 18:40',
        programNote: 'Горящее окно на завтрашнее утро для готового ролика',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['08:20', '13:20', '18:40'],
        officialRatePerSec: 650,
        hotRatePerSec: 345,
        minSpots: 5,
        defaultSpots: 12,
        maxSpots: 25,
        stepSpots: 3,
        reachPerSpotOTS: 16_200,
        maxSpotSeconds: 30,
        deadlineHours: 8,
        bestContexts: ['commute_rush', 'office_daytime'],
        sourceKind: 'seed',
      },
    ],
  },
] as const;

function mapLegacyDaypartToKind(daypart: string, daysPattern: string): DaypartKind {
  const low = daypart.toLowerCase();
  const daysLow = daysPattern.toLowerCase();
  if (daysLow.includes('сб–вс') || low.includes('выходн') || low.includes('уикенд')) {
    return 'weekend_air';
  }
  if (low.includes('пробок') || low.includes('погод') || low.includes('трафик')) {
    return 'traffic_weather';
  }
  if (low.includes('вечер')) return 'evening_drive';
  if (low.includes('дневн') || low.includes('день')) return 'daytime_block';
  return 'morning_prime';
}

/**
 * Объединяет базовый многослотовый каталог радиостанций с пользовательскими импортами
 * и скрытиями из админ-кабинета `radioInventoryStore`, сохраняя 100% живую синхронизацию `/admin`.
 */
export function buildMergedStationCatalog(
  storeSlots?: readonly RadioInventorySlot[]
): RadioStationCatalogItem[] {
  const catalog: RadioStationCatalogItem[] = FLAGSHIP_STATION_CATALOG.map((st) => ({
    ...st,
    audienceTags: [...st.audienceTags],
    ageCores: [...st.ageCores],
    segments: [...st.segments],
    variations: st.variations.map((v) => ({
      ...v,
      weekdays: [...v.weekdays],
      sampleTimeSlots: [...v.sampleTimeSlots],
      bestContexts: [...v.bestContexts],
    })),
  }));

  if (!storeSlots || storeSlots.length === 0) {
    return catalog;
  }

  // Если продюсер скрыл базовую станцию в админке, уважаем скрытие одноимённого слота
  const hiddenSeedStationDayparts = new Set<string>();
  for (const s of storeSlots) {
    if (s.isHidden && s.sourceKind === 'seed') {
      hiddenSeedStationDayparts.add(
        `${s.station.trim().toLowerCase()}::${mapLegacyDaypartToKind(s.daypart, s.daysPattern)}`
      );
    }
  }

  for (const item of catalog) {
    item.variations = item.variations.filter(
      (v) =>
        !hiddenSeedStationDayparts.has(
          `${item.station.trim().toLowerCase()}::${v.kind}`
        )
    );
  }

  // Подключаем импортированные/ручные квоты из админки прямо внутрь соответствующей радиостанции
  const customSlots = storeSlots.filter(
    (s) => !s.isHidden && (s.sourceKind === 'imported' || s.sourceKind === 'manual')
  );

  for (const custom of customSlots) {
    const kind = mapLegacyDaypartToKind(custom.daypart, custom.daysPattern);
    const spots = Math.max(4, custom.spotsIncluded);
    const perSecRates = resolveSlotPerSecondRates(custom);
    const rules = extractSlotMultiplicityRules(custom);
    const hotRatePerSec = Math.max(140, Math.round(perSecRates.clientHotRatePerSecRub));
    const officialRatePerSec = Math.max(
      hotRatePerSec + 60,
      Math.round(perSecRates.officialRatePerSecRub)
    );

    const newVariation: StationDaypartVariation = {
      id: custom.id,
      stationId: `custom-${custom.station.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-')}`,
      kind,
      label: `${custom.daypart.split(' ')[0]} · спецквота`,
      hoursWindow: custom.sampleTimeSlots.join(' · '),
      programNote: custom.programTitle || 'Импортированная горящая квота из прайса станции',
      daysPattern: custom.daysPattern,
      weekdays: [...custom.weekdays],
      sampleTimeSlots: [...custom.sampleTimeSlots],
      officialRatePerSec,
      hotRatePerSec,
      minSpots: Math.max(4, Math.min(6, spots)),
      defaultSpots: spots,
      maxSpots: Math.max(24, spots * 2),
      stepSpots: Math.max(1, rules.spotsMultiplicityStep),
      reachPerSpotOTS: Math.max(8_000, Math.round(custom.reachOTS / spots)),
      maxSpotSeconds: rules.maxDurationSec,
      durationMultiplicitySec: rules.durationMultiplicitySec as SlotDurationMultiplicitySec,
      deadlineHours: custom.deadlineHours,
      bestContexts:
        kind === 'evening_drive'
          ? ['evening_leisure', 'commute_rush']
          : kind === 'daytime_block'
            ? ['office_daytime']
            : kind === 'weekend_air'
              ? ['weekend_family']
              : ['commute_rush'],
      sourceKind: custom.sourceKind,
    };

    const existingStation = catalog.find(
      (st) => st.station.trim().toLowerCase() === custom.station.trim().toLowerCase()
    );
    if (existingStation) {
      newVariation.stationId = existingStation.stationId;
      existingStation.variations = [newVariation, ...existingStation.variations];
    } else {
      catalog.unshift({
        stationId: newVariation.stationId,
        station: custom.station,
        frequencyFm: custom.frequencyFm,
        formatDesc: custom.formatDesc,
        audienceTags: [...custom.audienceTags],
        ageCores: ['30_45', '35_55'],
        segments: custom.audienceTags.includes('b2b')
          ? ['b2b_decision_makers', 'b2c_premium']
          : ['b2c_mass', 'b2c_premium'],
        variations: [newVariation],
      });
    }
  }

  return catalog.filter((st) => st.variations.length > 0);
}

/**
 * Честный посекундный расчёт стоимости слота через единый движок `calculateDynamicAirPrice`
 * с автоматической проверкой кратности хронометража каждого слота (`1 сек` для линейных блоков, `5 сек` для спонсорства).
 */
export function computeExactPerSecondSlotPrices(params: {
  variation: Pick<
    StationDaypartVariation,
    'officialRatePerSec' | 'hotRatePerSec' | 'reachPerSpotOTS'
  > &
    Partial<
      Pick<
        StationDaypartVariation,
        'id' | 'kind' | 'maxSpotSeconds' | 'durationMultiplicitySec'
      >
    >;
  spotSeconds: number;
  spotsCount: number;
}): {
  officialPriceRub: number;
  hotPriceRub: number;
  discountPercent: number;
  reachOTS: number;
  billedSeconds: number;
  multiplicity: SlotMultiplicityCheckResult;
} {
  const sec = clampExactSpotSeconds(params.spotSeconds);
  const spots = Math.max(1, Math.round(params.spotsCount));
  const durationMultiplicitySec =
    params.variation.durationMultiplicitySec ??
    (params.variation.kind === 'traffic_weather' ? 5 : 1);

  const quotaCost: SecondBasedCostResult = calculateCost(
    sec,
    params.variation.hotRatePerSec,
    0,
    {
      spotsCount: spots,
      officialRatePerSecRub: params.variation.officialRatePerSec,
      multiplicityRules: {
        slotId: params.variation.id ?? 'variation-slot',
        durationMultiplicitySec,
        minDurationSec: 5,
        maxDurationSec: params.variation.maxSpotSeconds ?? 60,
        spotsMultiplicityStep: 1,
        minSpots: 1,
        maxSpots: 200,
      },
    }
  );

  // С ростом числа выходов на одном окне охват OTS растёт с плавной дедупликацией
  const dedupFactor = spots <= 10 ? 1 : 1 - Math.min(0.22, (spots - 10) * 0.008);
  const reachOTS = Math.round(params.variation.reachPerSpotOTS * spots * dedupFactor);

  return {
    officialPriceRub: quotaCost.officialAirTotalRub,
    hotPriceRub: quotaCost.totalQuotaCostRub,
    discountPercent: quotaCost.discountFromOfficialPercent,
    reachOTS,
    billedSeconds: quotaCost.effectiveDurationSeconds,
    multiplicity: quotaCost.multiplicity,
  };
}

/**
 * Прозрачная шкала стоимости производства ролика под любой точный хронометраж (5..60 сек)
 * с сохранением правила `0 ₽` при чистом эфире от `400 000 ₽` или готовом ролике клиента.
 */
export function computeProductionCostForExactSeconds(params: {
  spotSeconds: number;
  spotReadiness: SpotReadinessMode;
  hotAirTotalRub: number;
}): ProductionCostSpec {
  const sec = clampExactSpotSeconds(params.spotSeconds);
  const isBonusUnlocked = params.hotAirTotalRub >= AIR_BONUS_THRESHOLD_RUB;

  if (params.spotReadiness === 'ready_with_passport') {
    return {
      spotSeconds: sec,
      spotReadiness: 'ready_with_passport',
      basePriceRub: 0,
      effectivePriceRub: 0,
      originalValueRub: 0,
      isBonusUnlocked,
      tierCode: 'turnkey',
      reservationSelection: 'ready_spot',
      title: `Готовый ролик клиента (${sec} сек) · проверка юриста и паспорта прав`,
    };
  }

  let basePriceRub: number;
  let tierCode: RecommendedTier;
  let reservationSelection: ReservationProductionSelection;
  let formatLabel: string;

  if (sec <= 12) {
    basePriceRub = 12_000;
    tierCode = 'voice_style';
    reservationSelection = 'voice_style';
    formatLabel = `Короткий спот ${sec} сек за 24ч`;
  } else if (sec <= 20) {
    basePriceRub = 15_000;
    tierCode = 'voice_style';
    reservationSelection = 'voice_style';
    formatLabel = `Ролик «Голос и стиль» (${sec} сек) за 24ч`;
  } else if (sec <= 35) {
    basePriceRub = 25_000;
    tierCode = 'turnkey';
    reservationSelection = 'turnkey';
    formatLabel = `Ролик «Под ключ» (${sec} сек) за 24ч`;
  } else {
    basePriceRub = 35_000;
    tierCode = 'cinema';
    reservationSelection = 'cinema';
    formatLabel = `Развёрнутый игровой ролик (${sec} сек) за 24ч`;
  }

  if (isBonusUnlocked) {
    return {
      spotSeconds: sec,
      spotReadiness: 'need_production_24h',
      basePriceRub,
      effectivePriceRub: 0,
      originalValueRub: Math.max(basePriceRub, TURNKEY_30S_PRODUCTION_RUB),
      isBonusUnlocked: true,
      tierCode: 'turnkey',
      reservationSelection: 'bonus_express_24h',
      title: `Ролик ${sec} сек — 0 ₽ по агентской квоте FMWorks`,
    };
  }

  return {
    spotSeconds: sec,
    spotReadiness: 'need_production_24h',
    basePriceRub,
    effectivePriceRub: basePriceRub,
    originalValueRub: basePriceRub,
    isBonusUnlocked: false,
    tierCode,
    reservationSelection,
    title: formatLabel,
  };
}

const NICHE_STATION_WEIGHTS: Record<MediaClientNiche, Partial<Record<AudienceTag, number>>> = {
  real_estate: { real_estate: 28, premium: 18, b2b: 10, auto: 6 },
  b2b_finance: { b2b: 32, premium: 16, real_estate: 8, auto: 6 },
  fmcg_retail: { fmcg: 30, mass: 20, auto: 8, medicine: 6 },
  medicine: { medicine: 32, mass: 16, premium: 12, fmcg: 8 },
  auto_services: { auto: 32, mass: 16, b2b: 10, fmcg: 8 },
};

/**
 * Вычисляет индекс соответствия конкретного эфирного окна станции (`40..99%`)
 * под явный портрет ЦА (сегмент, возраст, контекст слушания), отраслевую нишу,
 * описание продукта и опциональные смысловые сигналы AI-анализатора.
 */
export function evaluateVariationAffinityAndReason(params: {
  stationItem: RadioStationCatalogItem;
  variation: StationDaypartVariation;
  niche: MediaClientNiche;
  audience: TargetAudienceProfile;
  productNote: string;
  layaPersona?: LayaPersona;
  aiHint?: AiSemanticRecommendationHint | null;
}): { affinity: number; rankingScore: number; matchReason: string } {
  const {
    stationItem,
    variation,
    niche,
    audience,
    productNote,
    layaPersona = 'default',
    aiHint,
  } = params;

  let score = 32;
  const reasons: string[] = [];

  // 1. Базовая релевантность радиостанции под нишу (с потолком +26, чтобы не забивать сигнал тайм-слота)
  const nicheWeights = NICHE_STATION_WEIGHTS[niche];
  const matchedTagScores = stationItem.audienceTags
    .map((tag) => nicheWeights[tag] ?? 0)
    .filter((w) => w > 0)
    .sort((a, b) => b - a);
  const nicheBoost =
    matchedTagScores.length === 0
      ? 0
      : Math.min(
          26,
          matchedTagScores[0] +
            Math.round(matchedTagScores.slice(1).reduce((s, v) => s + v, 0) * 0.35)
        );
  score += nicheBoost;

  // 2. Явный сегмент ЦА (B2C массовый / B2C премиум / B2B руководители)
  if (stationItem.segments.includes(audience.segment)) {
    score += 12;
    if (audience.segment === 'b2b_decision_makers') {
      reasons.push('ядро ЛПР и собственников');
    } else if (audience.segment === 'b2c_premium') {
      reasons.push('высокий доход аудитории');
    } else {
      reasons.push('широкий городской охват');
    }
  } else {
    score -= 9;
  }

  // 3. Возрастное ядро
  if (stationItem.ageCores.includes(audience.ageCore)) {
    score += 8;
    const ageLabel =
      AUDIENCE_AGE_OPTIONS.find((a) => a.id === audience.ageCore)?.label ?? '30–45 лет';
    reasons.push(`возраст ${ageLabel}`);
  } else {
    score -= 5;
  }

  // 4. Контекст прослушивания -> прямое управление выбором тайм-слота внутри станции!
  if (variation.bestContexts.includes(audience.listeningContext)) {
    score += 17;
    if (audience.listeningContext === 'evening_leisure' && variation.kind === 'evening_drive') {
      score += 6;
      reasons.push('вечерний прайм без утренней наценки');
    } else if (
      audience.listeningContext === 'office_daytime' &&
      variation.kind === 'daytime_block'
    ) {
      score += 6;
      reasons.push('дневной контакт в рабочие часы');
    } else if (
      audience.listeningContext === 'weekend_family' &&
      variation.kind === 'weekend_air'
    ) {
      score += 7;
      reasons.push('поток выходного дня Сб–Вс');
    } else if (audience.listeningContext === 'commute_rush') {
      reasons.push('контакт за рулём в часах пик');
    }
  } else {
    // Если клиент явно указал узкий сценарий слушания, понижаем неподходящие эфирные окна
    if (audience.listeningContext === 'evening_leisure') {
      score -= variation.kind === 'morning_prime' ? 20 : 16;
    } else if (audience.listeningContext === 'office_daytime') {
      score -= variation.kind === 'morning_prime' ? 16 : 12;
    } else if (audience.listeningContext === 'weekend_family') {
      score -= 18;
    } else {
      score -= 8;
    }
  }

  // 5. Анализ текста описания продукта клиента (локальная лексика)
  const note = productNote.trim().toLowerCase();
  if (note.length >= 3) {
    if (
      (note.includes('вечер') || note.includes('ужин') || note.includes('ресторан') || note.includes('дом')) &&
      variation.kind === 'evening_drive'
    ) {
      score += 8;
      reasons.push('оффер под вечерний сценарий');
    }
    if (
      (note.includes('выходн') || note.includes('суббот') || note.includes('семейн') || note.includes('просмотр')) &&
      variation.kind === 'weekend_air'
    ) {
      score += 9;
      reasons.push('акцент на семейный уикенд');
    }
    if (
      (note.includes('обед') || note.includes('офис') || note.includes('днём') || note.includes('бизнес-ланч')) &&
      variation.kind === 'daytime_block'
    ) {
      score += 8;
      reasons.push('дневной спрос в деловое время');
    }
    if (
      (note.includes('клиник') || note.includes('чекап') || note.includes('стомат') || note.includes('врач')) &&
      stationItem.audienceTags.includes('medicine')
    ) {
      score += 7;
      reasons.push('высокое доверие к медицине');
    }
    if (
      (note.includes('лизинг') || note.includes('юрлиц') || note.includes('опт') || note.includes('банк')) &&
      stationItem.audienceTags.includes('b2b')
    ) {
      score += 7;
      reasons.push('прямое попадание в B2B-среду');
    }
    if (
      (note.includes('шины') || note.includes('дилер') || note.includes('сервис') || note.includes('авто')) &&
      (stationItem.audienceTags.includes('auto') || variation.kind === 'traffic_weather')
    ) {
      score += 7;
      reasons.push('аудитория автовладельцев');
    }
  }

  // 6. Сигналы Laya AI (фоновая персонализация лендинга)
  if (layaPersona === 'price_searcher' && variation.hotRatePerSec <= 350) {
    score += 5;
  } else if (layaPersona === 'real_estate' && stationItem.audienceTags.includes('premium')) {
    score += 4;
  }

  // 7. Сигналы серверного AI-анализатора продукта (`gemini-4-hydrogen`)
  if (aiHint) {
    if (aiHint.boostedStationIds?.includes(stationItem.stationId)) {
      score += 7;
    }
    if (aiHint.preferredDayparts?.includes(variation.kind)) {
      score += 10;
    }
    if (aiHint.avoidedDayparts?.includes(variation.kind)) {
      score -= 16;
    }
  }

  const clampedAffinity = Math.max(42, Math.min(99, Math.round(score)));
  const customReason = aiHint?.slotReasonsByStationId?.[stationItem.stationId];
  const fallbackReason =
    reasons.slice(0, 2).join(' · ') || `${variation.label.toLowerCase()} с выгодной ставкой секунды`;

  return {
    affinity: clampedAffinity,
    rankingScore: score,
    matchReason: customReason?.trim() ? customReason.trim() : fallbackReason,
  };
}

function resolveMaxDistinctStationsForFlexibleBudget(budgetRub: number): number {
  if (budgetRub <= 135_000) return 1;
  if (budgetRub <= 260_000) return 2;
  if (budgetRub <= 460_000) return 3;
  if (budgetRub <= 800_000) return 4;
  return 6;
}

export function computeDedupTargetAudienceShare(
  selectedQuotes: readonly ComputedVariationQuote[]
): number {
  if (selectedQuotes.length === 0) return 0;

  const sorted = [...selectedQuotes].sort((a, b) => b.affinity - a.affinity);
  let unreached = 1.0;
  const seenStations = new Set<string>();

  sorted.forEach((q, idx) => {
    const isSameStationSecondWindow = seenStations.has(q.stationItem.stationId);
    seenStations.add(q.stationItem.stationId);

    const affinityRatio = q.affinity / 100;
    const reachFactor = Math.min(1.16, 0.58 + q.reachOTS / 950_000);
    const freqFactor = Math.min(1.14, q.spotsCount / 12);
    const baseWeight = idx === 0 ? 0.44 : isSameStationSecondWindow ? 0.19 : 0.28;
    const stepCapture = Math.min(0.56, baseWeight * affinityRatio * reachFactor * freqFactor);
    unreached *= 1 - stepCapture;
  });

  const pct = Math.round((1 - unreached) * 100);
  return Math.max(24, Math.min(95, pct));
}

function buildFlexibleBuyerRationale(params: {
  niche: MediaClientNiche;
  audience: TargetAudienceProfile;
  productNote: string;
  totalBudgetRub: number;
  spotSeconds: number;
  spotReadiness: SpotReadinessMode;
  productionBaseRub: number;
  minAvailableAirPackRub: number | null;
  selectedQuotes: readonly ComputedVariationQuote[];
  totalSpots: number;
  totalReachOTS: number;
  targetAudienceSharePct: number;
  hotAirTotalRub: number;
  officialAirTotalRub: number;
  totalSavingsRub: number;
  isBonusUnlocked: boolean;
  aiHint?: AiSemanticRecommendationHint | null;
}): string {
  const {
    audience,
    productNote,
    totalBudgetRub,
    spotSeconds,
    spotReadiness,
    productionBaseRub,
    minAvailableAirPackRub,
    selectedQuotes,
    totalSpots,
    totalReachOTS,
    targetAudienceSharePct,
    hotAirTotalRub,
    officialAirTotalRub,
    totalSavingsRub,
    isBonusUnlocked,
    aiHint,
  } = params;

  if (selectedQuotes.length === 0) {
    if (
      spotReadiness === 'need_production_24h' &&
      minAvailableAirPackRub !== null &&
      totalBudgetRub - productionBaseRub < minAvailableAirPackRub
    ) {
      const neededTotal = Math.ceil((productionBaseRub + minAvailableAirPackRub) / 5_000) * 5_000;
      return `При бюджете ${formatRubCompact(totalBudgetRub)} производство ролика ${spotSeconds} сек занимает ${formatRubCompact(productionBaseRub)}, а минимальный пакет из 5 выходов такой длины стоит от ${formatRubCompact(minAvailableAirPackRub)}. Чтобы запустить тестовый эфир в рамках ${formatRubCompact(totalBudgetRub)}, выберите хронометраж 10–20 сек, переключитесь на «Готовый ролик» или увеличьте бюджет до ${formatRubCompact(neededTotal)}.`;
    }
    return `В текущей сетке пока не отмечено ни одного эфирного окна. Включите подходящий тайм-слот внутри карточки радиостанции или нажмите «Подобрать эфирную сетку», чтобы собрать рабочий флайт под выбранный хронометраж ${spotSeconds} сек.`;
  }

  if (aiHint?.buyerRationale && aiHint.buyerRationale.trim().length > 40) {
    return aiHint.buyerRationale.trim();
  }

  const uniqueStations = Array.from(
    new Set(selectedQuotes.map((q) => q.stationItem.station))
  );
  const windowLabels = Array.from(
    new Set(selectedQuotes.map((q) => q.variation.label.toLowerCase()))
  );
  const audienceLine = formatAudienceSummaryLine(audience);

  const s1 =
    uniqueStations.length === 1
      ? `Под профиль «${audienceLine}»${productNote.trim() ? ` и задачу «${productNote.trim()}»` : ''} бюджет сконцентрирован без распыления на ${uniqueStations[0]} (${windowLabels.join(' + ')}, ${totalSpots} выходов по ${spotSeconds} сек).`
      : `Под портрет «${audienceLine}» собрана адресная связка из ${uniqueStations.length} радиостанций (${uniqueStations.join(', ')}) строго в целевых окнах «${windowLabels.slice(0, 3).join(' + ')}» (${totalSpots} выходов по ${spotSeconds} сек).`;

  const s2 = `Расчёт выполнен честно за каждую из ${spotSeconds} секунд без скрытых округлений и охватывает до ${targetAudienceSharePct}% целевого ядра (${formatNumberSpaced(totalReachOTS)} контактов OTS).`;

  const discPct =
    officialAirTotalRub > 0
      ? Math.round(((officialAirTotalRub - hotAirTotalRub) / officialAirTotalRub) * 100)
      : 0;

  const s3 = isBonusUnlocked
    ? `Выкуп горящих слотов (−${discPct}% от прайса) и бесплатный продакшн ролика по агентской квоте экономят компании ${formatRubCompact(totalSavingsRub)}.`
    : `Прямая выгода за счёт горящих ставок секунды (−${discPct}% от прайса радиостанций) составляет ${formatRubCompact(totalSavingsRub)}.`;

  return `${s1} ${s2} ${s3}`;
}

/**
 * Пересчитывает полную финансовую и эфирную сводку для выбранного клиентом набора
 * `variationId + spotsCount` и любого точного хронометража `spotSeconds` (5..60 сек).
 */
export function computeFlexibleMediaPlanSummary(params: {
  niche: MediaClientNiche;
  audience: TargetAudienceProfile;
  productNote?: string;
  totalBudgetRub: number;
  spotSeconds: number;
  spotReadiness: SpotReadinessMode;
  selectedVariations: readonly SelectedVariationState[];
  stationsCatalog?: readonly RadioStationCatalogItem[];
  layaPersona?: LayaPersona;
  aiHint?: AiSemanticRecommendationHint | null;
}): FlexibleMediaPlanResult {
  const {
    niche,
    audience,
    productNote = '',
    totalBudgetRub,
    spotReadiness,
    selectedVariations,
    layaPersona = 'default',
    aiHint = null,
  } = params;

  const spotSeconds = clampExactSpotSeconds(params.spotSeconds);
  const minRequiredDeadlineHours =
    spotReadiness === 'ready_with_passport'
      ? READY_SPOT_INGEST_GATE_HOURS
      : PRODUCTION_MODERATION_GATE_HOURS;

  const catalog = params.stationsCatalog
    ? [...params.stationsCatalog]
    : buildMergedStationCatalog();

  const selectionMap = new Map<string, number>();
  for (const sel of selectedVariations) {
    if (sel.spotsCount > 0) {
      selectionMap.set(sel.variationId, sel.spotsCount);
    }
  }

  const allQuotedVariations: ComputedVariationQuote[] = [];
  const lockedUrgentVariations: StationDaypartVariation[] = [];

  for (const stationItem of catalog) {
    for (const variation of stationItem.variations) {
      const isUltraUrgent =
        variation.deadlineHours >= READY_SPOT_INGEST_GATE_HOURS &&
        variation.deadlineHours < PRODUCTION_MODERATION_GATE_HOURS;
      const isEligibleForTimeGate = variation.deadlineHours >= minRequiredDeadlineHours;

      const activeSpots = selectionMap.get(variation.id) ?? variation.defaultSpots;
      const effectiveFloor =
        selectionMap.has(variation.id) && (totalBudgetRub <= 75_000 || spotSeconds >= 22)
          ? Math.min(3, variation.minSpots)
          : variation.minSpots;
      const clampedSpots = Math.max(
        effectiveFloor,
        Math.min(variation.maxSpots, Math.round(activeSpots))
      );

      const prices = computeExactPerSecondSlotPrices({
        variation,
        spotSeconds,
        spotsCount: clampedSpots,
      });

      const isEligibleForDuration = prices.multiplicity.isCompatible;

      if (!isEligibleForTimeGate && isUltraUrgent) {
        lockedUrgentVariations.push(variation);
      }

      const { affinity, rankingScore, matchReason } = evaluateVariationAffinityAndReason({
        stationItem,
        variation,
        niche,
        audience,
        productNote,
        layaPersona,
        aiHint,
      });

      allQuotedVariations.push({
        stationItem,
        variation,
        spotsCount: clampedSpots,
        spotSeconds,
        billedSeconds: prices.billedSeconds,
        multiplicity: prices.multiplicity,
        officialPriceRub: prices.officialPriceRub,
        hotPriceRub: prices.hotPriceRub,
        discountPercent: prices.discountPercent,
        reachOTS: prices.reachOTS,
        affinity,
        rankingScore,
        tier: affinity >= 76 ? 1 : 2,
        matchReason,
        isEligibleForTimeGate,
        isEligibleForDuration,
        isUltraUrgent,
      });
    }
  }

  const selectedQuotes = allQuotedVariations
    .filter((q) => selectionMap.has(q.variation.id))
    .sort((a, b) => b.rankingScore - a.rankingScore);

  const selectedStationsCount = new Set(
    selectedQuotes.map((q) => q.stationItem.stationId)
  ).size;

  const totalSpots = selectedQuotes.reduce((acc, q) => acc + q.spotsCount, 0);
  const totalReachOTS = selectedQuotes.reduce((acc, q) => acc + q.reachOTS, 0);
  const targetAudienceSharePct = computeDedupTargetAudienceShare(selectedQuotes);

  const officialAirTotalRub = selectedQuotes.reduce(
    (acc, q) => acc + q.officialPriceRub,
    0
  );
  const hotAirTotalRub = selectedQuotes.reduce((acc, q) => acc + q.hotPriceRub, 0);
  const airDiscountPercent =
    officialAirTotalRub > 0 && hotAirTotalRub < officialAirTotalRub
      ? Math.round(((officialAirTotalRub - hotAirTotalRub) / officialAirTotalRub) * 100)
      : 0;

  const production = computeProductionCostForExactSeconds({
    spotSeconds,
    spotReadiness,
    hotAirTotalRub,
  });

  const airSavingsRub = Math.max(0, officialAirTotalRub - hotAirTotalRub);
  const prodBonusSavingsRub = production.isBonusUnlocked ? production.originalValueRub : 0;
  const totalSavingsRub = airSavingsRub + prodBonusSavingsRub;
  const totalClientCostRub = hotAirTotalRub + production.effectivePriceRub;
  const remainingToBonusRub = Math.max(0, AIR_BONUS_THRESHOLD_RUB - hotAirTotalRub);

  const minDeadlineHours =
    selectedQuotes.length > 0
      ? selectedQuotes.reduce(
          (minH, q) => Math.min(minH, q.variation.deadlineHours),
          selectedQuotes[0].variation.deadlineHours
        )
      : null;

  const eligibleMinPacks = allQuotedVariations
    .filter((q) => q.isEligibleForTimeGate && q.isEligibleForDuration)
    .map((q) => Math.round(q.variation.hotRatePerSec * q.billedSeconds * q.variation.minSpots));
  const minAvailableAirPackRub =
    eligibleMinPacks.length > 0 ? Math.min(...eligibleMinPacks) : null;

  const buyerRationale = buildFlexibleBuyerRationale({
    niche,
    audience,
    productNote,
    totalBudgetRub,
    spotSeconds,
    spotReadiness,
    productionBaseRub: production.basePriceRub,
    minAvailableAirPackRub,
    selectedQuotes,
    totalSpots,
    totalReachOTS,
    targetAudienceSharePct,
    hotAirTotalRub,
    officialAirTotalRub,
    totalSavingsRub,
    isBonusUnlocked: production.isBonusUnlocked,
    aiHint,
  });

  return {
    niche,
    audience,
    productNote,
    totalBudgetRub,
    spotSeconds,
    spotReadiness,
    minRequiredDeadlineHours,
    stationsCatalog: catalog,
    allQuotedVariations,
    lockedUrgentVariations,
    selectedQuotes,
    selectedStationsCount,
    totalSpots,
    totalReachOTS,
    targetAudienceSharePct,
    officialAirTotalRub,
    hotAirTotalRub,
    airDiscountPercent,
    production,
    totalClientCostRub,
    totalSavingsRub,
    remainingToBonusRub,
    minDeadlineHours,
    buyerRationale,
    usedAiEngine: Boolean(aiHint?.usedGeminiModel),
  };
}

/**
 * Умный подбор оптимальной комбинации «Радиостанции + Конкретные тайм-слоты + Число выходов»
 * под заданный бюджет (от 40 000 ₽ до 1 500 000 ₽), точный хронометраж (5..60 сек),
 * портрет Целевой Аудитории и AI-сигналы продукта.
 */
export function recommendOptimalMediaPlan(params: {
  niche: MediaClientNiche;
  audience: TargetAudienceProfile;
  productNote?: string;
  totalBudgetRub: number;
  spotSeconds: number;
  spotReadiness: SpotReadinessMode;
  stationsCatalog?: readonly RadioStationCatalogItem[];
  layaPersona?: LayaPersona;
  aiHint?: AiSemanticRecommendationHint | null;
}): FlexibleMediaPlanResult {
  const clampedBudget = Math.max(
    MIN_FLEXIBLE_BUDGET_RUB,
    Math.min(MAX_FLEXIBLE_BUDGET_RUB, Math.round(params.totalBudgetRub))
  );
  const spotSeconds = clampExactSpotSeconds(params.spotSeconds);
  const catalog = params.stationsCatalog
    ? [...params.stationsCatalog]
    : buildMergedStationCatalog();

  // Базовая оценка слотов для автоподбора выполняется по единому эталону,
  // чтобы переключение «Нужен ролик / Есть свой ролик» не меняло выбранные радиостанции и охваты OTS
  const baseEval = computeFlexibleMediaPlanSummary({
    ...params,
    spotReadiness: 'need_production_24h',
    totalBudgetRub: clampedBudget,
    spotSeconds,
    selectedVariations: [],
    stationsCatalog: catalog,
  });

  // Если клиент явно зафиксировал узкое окно контакта (например, «Только вечерний прайм»),
  // автоподбор НЕ докупает утренние или дневные блоки на остаток бюджета
  const strictAllowedKinds: Set<DaypartKind> | null =
    params.audience.listeningContext === 'evening_leisure'
      ? new Set<DaypartKind>(['evening_drive'])
      : params.audience.listeningContext === 'office_daytime'
        ? new Set<DaypartKind>(['daytime_block', 'traffic_weather'])
        : params.audience.listeningContext === 'weekend_family'
          ? new Set<DaypartKind>(['weekend_air'])
          : null;

  const allTimeAndDurationEligible = baseEval.allQuotedVariations
    .filter((q) => q.isEligibleForTimeGate && q.isEligibleForDuration)
    .sort((a, b) => {
      if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
      return a.variation.hotRatePerSec - b.variation.hotRatePerSec;
    });

  const strictlyFilteredQuotes = strictAllowedKinds
    ? allTimeAndDurationEligible.filter((q) => strictAllowedKinds.has(q.variation.kind))
    : allTimeAndDurationEligible;

  const eligibleQuotes =
    strictlyFilteredQuotes.length > 0 ? strictlyFilteredQuotes : allTimeAndDurationEligible;

  const baseProdSpec = computeProductionCostForExactSeconds({
    spotSeconds,
    spotReadiness: params.spotReadiness,
    hotAirTotalRub: 0,
  });

  // Если бюджет >= 400 000 ₽, проверяем, выгодно ли раскрыть бесплатный ролик (весь бюджет уходит в эфир!)
  const canTryBonusMode = clampedBudget >= AIR_BONUS_THRESHOLD_RUB;

  const buildSelectionForAirCap = (airBudgetCap: number): SelectedVariationState[] => {
    if (airBudgetCap <= 0 || eligibleQuotes.length === 0) return [];

    const maxStations = resolveMaxDistinctStationsForFlexibleBudget(clampedBudget);
    const chosen: SelectedVariationState[] = [];
    const chosenIds = new Set<string>();
    const activeStations = new Set<string>();
    let remainingAir = airBudgetCap;

    // Проход 1: выбираем лучшие тайм-слоты с соблюдением лимита уникальных станций (защита от распыления)
    for (const candidate of eligibleQuotes) {
      const stationAlreadyPicked = activeStations.has(candidate.stationItem.stationId);
      if (!stationAlreadyPicked && activeStations.size >= maxStations) {
        continue;
      }

      // На одной станции не берём больше 2 разных тайм-слотов автоматически, чтобы не перегружать
      const stationWindowsCount = chosen.filter((c) =>
        candidate.stationItem.variations.some((v) => v.id === c.variationId)
      ).length;
      if (stationWindowsCount >= 2) continue;

      const unitExitCost = candidate.variation.hotRatePerSec * candidate.billedSeconds;
      if (unitExitCost <= 0) continue;

      const minCost = Math.round(unitExitCost * candidate.variation.minSpots);
      if (minCost > remainingAir) continue;

      // При малом бюджете (40–135 тыс. ₽) отдаём весь доступный ресурс в один плотный целевой слот
      const targetSpotsRaw =
        maxStations === 1
          ? Math.floor(remainingAir / unitExitCost)
          : candidate.variation.defaultSpots;

      const desiredSpots = Math.max(
        candidate.variation.minSpots,
        Math.min(
          candidate.variation.maxSpots,
          Math.min(Math.floor(remainingAir / unitExitCost), targetSpotsRaw)
        )
      );

      if (desiredSpots >= candidate.variation.minSpots) {
        chosen.push({
          variationId: candidate.variation.id,
          spotsCount: desiredSpots,
        });
        chosenIds.add(candidate.variation.id);
        activeStations.add(candidate.stationItem.stationId);
        remainingAir -= Math.round(unitExitCost * desiredSpots);
      }
    }

    // Проход 2: если остался неизрасходованный бюджет эфира, докручиваем выходы на уже выбранных лучших слотах
    if (chosen.length > 0 && remainingAir >= 2_500) {
      let improved = true;
      while (improved) {
        improved = false;
        for (const item of chosen) {
          const quote = eligibleQuotes.find((q) => q.variation.id === item.variationId);
          if (!quote) continue;
          const step = chosen.length === 1 ? 1 : quote.variation.stepSpots || 2;
          if (item.spotsCount + step > quote.variation.maxSpots) continue;
          const extraCost = Math.round(
            quote.variation.hotRatePerSec * quote.billedSeconds * step
          );
          if (extraCost <= remainingAir) {
            item.spotsCount += step;
            remainingAir -= extraCost;
            improved = true;
          }
        }
      }
    }

    // Проход 3 (резервный для компактных тестовых бюджетов 40 000–75 000 ₽ с длинным роликом):
    // сначала ищем слот с полным minSpots, а если бюджет тесный — собираем тестовый мини-пакет от 3 выходов
    if (chosen.length === 0) {
      const poolForFallback = allTimeAndDurationEligible;
      const minAllowedTestSpots = clampedBudget <= 75_000 ? 3 : 5;
      const mostAffordable = [...poolForFallback]
        .map((q) => {
          const effMin = Math.min(q.variation.minSpots, minAllowedTestSpots);
          return {
            q,
            effMin,
            minPackCost: Math.round(q.variation.hotRatePerSec * q.billedSeconds * effMin),
          };
        })
        .filter((x) => x.minPackCost <= airBudgetCap)
        .sort((a, b) => b.q.rankingScore - a.q.rankingScore)[0];

      if (mostAffordable && !chosenIds.has(mostAffordable.q.variation.id)) {
        const unitCost =
          mostAffordable.q.variation.hotRatePerSec * mostAffordable.q.billedSeconds;
        const maxFitSpots = Math.min(
          mostAffordable.q.variation.maxSpots,
          Math.max(mostAffordable.effMin, Math.floor(airBudgetCap / unitCost))
        );
        chosen.push({
          variationId: mostAffordable.q.variation.id,
          spotsCount: maxFitSpots,
        });
      }
    }

    return chosen;
  };

  const standardAirCap = Math.max(0, clampedBudget - baseProdSpec.basePriceRub);
  const standardSelection = buildSelectionForAirCap(standardAirCap);
  const standardPlan = computeFlexibleMediaPlanSummary({
    ...params,
    totalBudgetRub: clampedBudget,
    spotSeconds,
    selectedVariations: standardSelection,
    stationsCatalog: catalog,
  });

  if (canTryBonusMode) {
    const bonusSelection = buildSelectionForAirCap(clampedBudget);
    const bonusPlan = computeFlexibleMediaPlanSummary({
      ...params,
      totalBudgetRub: clampedBudget,
      spotSeconds,
      selectedVariations: bonusSelection,
      stationsCatalog: catalog,
    });

    if (
      bonusPlan.production.isBonusUnlocked &&
      bonusPlan.totalClientCostRub <= clampedBudget &&
      bonusPlan.totalSpots >= standardPlan.totalSpots
    ) {
      return bonusPlan;
    }
  }

  return standardPlan;
}

/**
 * Раскладывает выбранный тайм-слот радиостанции по ячейкам «день недели × время выхода»
 * для визуальной Эфирной шахматки Пн–Вс.
 */
export function expandVariationToChessboardCells(
  variation: StationDaypartVariation,
  spotsCount: number
): BroadcastChessboardCell[] {
  const days = variation.weekdays.length > 0 ? variation.weekdays : ([1, 2, 3, 4, 5] as WeekdayNumber[]);
  const times =
    variation.sampleTimeSlots.length > 0 ? variation.sampleTimeSlots : ['09:15', '14:15', '18:30'];

  const pairs: { weekday: WeekdayNumber; timeSlot: string }[] = [];
  for (const timeSlot of times) {
    for (const weekday of days) {
      pairs.push({ weekday, timeSlot });
    }
  }

  if (pairs.length === 0 || spotsCount <= 0) return [];

  const counts = new Array<number>(pairs.length).fill(0);
  for (let i = 0; i < spotsCount; i += 1) {
    counts[i % pairs.length] += 1;
  }

  return pairs
    .map((p, idx) => ({
      weekday: p.weekday,
      weekdayLabel: ALL_WEEKDAYS[p.weekday - 1] as WeekdayCode,
      timeSlot: p.timeSlot,
      spotsCount: counts[idx],
    }))
    .filter((cell) => cell.spotsCount > 0);
}

/**
 * Конвертирует гибкий медиаплан V3 в сквозной пакет бронирования для `QuickOrderDrawer`,
 * передавая точный хронометраж (например, `17 сек`), портрет ЦА, выбранные тайм-слоты и черновик текста.
 */
export function buildFlexibleReservationPayload(params: {
  plan: FlexibleMediaPlanResult;
  scriptDraftText?: string;
  nowMs?: number;
}): MediaGridReservationPayload {
  const { plan, scriptDraftText = '', nowMs = Date.now() } = params;
  const nicheSpec =
    MEDIA_NICHE_OPTIONS.find((n) => n.id === plan.niche) ?? MEDIA_NICHE_OPTIONS[0];

  const stations: ReservedStationSummaryItem[] = plan.selectedQuotes.map((q) => ({
    slotId: q.variation.id,
    station: q.stationItem.station,
    frequencyFm: q.stationItem.frequencyFm,
    daypart: `${q.variation.label} (${q.variation.hoursWindow})`,
    daysPattern: q.variation.daysPattern,
    sampleTimeSlots: [...q.variation.sampleTimeSlots],
    spotsIncluded: q.spotsCount,
    maxDuration: q.spotSeconds <= 15 ? 15 : 30,
    exactDurationSec: q.spotSeconds,
    officialPrice: q.officialPriceRub,
    hotPrice: q.hotPriceRub,
    discountPercent: q.discountPercent,
    reachOTS: q.reachOTS,
    packageMultiplier: 1,
  }));

  const combinedBriefParts: string[] = [];
  if (plan.productNote.trim()) {
    combinedBriefParts.push(`Продукт / оффер: ${plan.productNote.trim()}`);
  }
  combinedBriefParts.push(
    `Целевая аудитория: ${formatAudienceSummaryLine(plan.audience)} · Хронометраж: ${plan.spotSeconds} сек`
  );
  if (scriptDraftText.trim()) {
    combinedBriefParts.push(`Черновик текста из хронометра:\n${scriptDraftText.trim()}`);
  }

  return {
    createdAtMs: nowMs,
    initialCountdownSeconds: 4 * 3600 - 1,
    nicheId: plan.niche,
    nicheLabel: nicheSpec.label,
    productNote: combinedBriefParts.join('\n\n'),
    durationPref:
      plan.spotReadiness === 'ready_with_passport'
        ? 'ready_spot'
        : plan.spotSeconds <= 20
          ? '15'
          : '30',
    spotDurationSec: plan.spotSeconds,
    targetAudienceSummary: formatAudienceSummaryLine(plan.audience),
    scriptDraftText: scriptDraftText.trim() || undefined,
    stations,
    totalSpots: plan.totalSpots,
    totalReachOTS: plan.totalReachOTS,
    targetAudienceSharePct: plan.targetAudienceSharePct,
    officialAirTotal: plan.officialAirTotalRub,
    hotAirTotal: plan.hotAirTotalRub,
    airDiscountPercent: plan.airDiscountPercent,
    isBonusProductionUnlocked: plan.production.isBonusUnlocked,
    initialProductionSelection: plan.production.reservationSelection,
    initialRecommendedTier: plan.production.tierCode,
    aiRationale: plan.buyerRationale,
  };
}
