import { LayaDecision, LayaPersona, RecommendedTier } from '../engine/layaTypes';

export type AudienceTag =
  | 'b2b'
  | 'real_estate'
  | 'fmcg'
  | 'medicine'
  | 'auto'
  | 'premium'
  | 'mass';

export type DaypartLabel =
  | 'Утренний прайм 07:30–10:30'
  | 'Дневной блок 12:00–16:00'
  | 'Вечерний драйв 17:30–20:30'
  | 'Спонсорство пробок/погоды';

export type MediaClientNiche =
  | 'real_estate'
  | 'b2b_finance'
  | 'fmcg_retail'
  | 'medicine'
  | 'auto_services';

export type SpotDurationPreference = '15' | '30' | 'ready_spot';

/**
 * Режим готовности ролика для тайм-гейта эфирной модерации:
 * - `need_production_24h` — снимаем ролик за 24ч + модерация станции (`deadlineHours >= 24`)
 * - `ready_with_passport` — у клиента готовый ролик с паспортом (`deadlineHours >= 6`, открываются сверхсрочные слоты на завтра)
 */
export type SpotReadinessMode = 'need_production_24h' | 'ready_with_passport';

export type WeekdayCode = 'ПН' | 'ВТ' | 'СР' | 'ЧТ' | 'ПТ' | 'СБ' | 'ВС';

/** ISO-день недели для эфирной шахматки: 1 = Пн ... 7 = Вс */
export type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const ALL_WEEKDAYS: readonly WeekdayCode[] = [
  'ПН',
  'ВТ',
  'СР',
  'ЧТ',
  'ПТ',
  'СБ',
  'ВС',
] as const;

export const ALL_WEEKDAY_NUMBERS: readonly WeekdayNumber[] = [1, 2, 3, 4, 5, 6, 7] as const;

export type SlotDurationMultiplicitySec = 1 | 5 | 10 | 15;

export interface RadioInventorySlot {
  id: string;
  station: string;
  frequencyFm: string;
  programTitle?: string;
  formatDesc: string;
  audienceTags: AudienceTag[];
  daypart: DaypartLabel;
  daysPattern: string;
  /** Точные дни недели (1=Пн .. 7=Вс) для отрисовки эфирной шахматки */
  weekdays: WeekdayNumber[];
  /** Точные тайм-слоты выходов внутри блока (например ['08:20', '09:15', '18:40']) */
  sampleTimeSlots: string[];
  spotsIncluded: number;
  maxDuration: 15 | 30;
  /** Минимально допустимый хронометраж ролика для слота (сек, по умолчанию 5) */
  minDurationSec?: number;
  /** Максимальный допустимый точный хронометраж ролика для слота (сек, например 20, 30, 45, 60) */
  maxSpotSeconds?: number;
  /** Кратность хронометража слота в секундах (1 = честный посекундный расчёт, 5/10/15 = жёсткая сетка рубрики) */
  durationMultiplicitySec?: SlotDurationMultiplicitySec;
  /** Кратность количества выходов в пакете слота (например, 1, 2, 3 или 5) */
  spotsMultiplicityStep?: number;
  /** Базовая нетто-ставка радиостанции за 1 секунду 1 выхода (₽/сек) */
  stationNetRatePerSec?: number;
  /** Официальный прайс радиостанции за 1 секунду 1 выхода (₽/сек) */
  officialRatePerSec?: number;
  /** Заложенная маржа FMWorks для слота (%, по умолчанию 20) */
  fmworksMarginPercent?: number;
  /** Структура данных посекундного ценообразования квоты с методом пересчёта `calculateCost` */
  secondBasedPricing?: SecondBasedPricing;
  officialPrice: number;
  hotPrice: number;
  reachOTS: number;
  deadlineHours: number;
  isHidden?: boolean;
  sourceKind?: 'seed' | 'imported' | 'manual';
}

export interface MediaNicheOption {
  id: MediaClientNiche;
  label: string;
  shortHint: string;
  placeholderExample: string;
}

export const MEDIA_NICHE_OPTIONS: readonly MediaNicheOption[] = [
  {
    id: 'real_estate',
    label: 'Недвижимость и ЖК',
    shortHint: 'Девелопмент, бизнес-класс, апартаменты и загородные посёлки',
    placeholderExample: 'Например: жилой квартал бизнес-класса, старт пула видовых квартир',
  },
  {
    id: 'b2b_finance',
    label: 'B2B и Финансы',
    shortHint: 'Банки, лизинг, IT-платформы, логистика и услуги для бизнеса',
    placeholderExample: 'Например: лизинг коммерческого транспорта для юрлиц с решением за день',
  },
  {
    id: 'fmcg_retail',
    label: 'Продукты и Ритейл',
    shortHint: 'Продукты питания, торговые сети, HoReCa и доставка',
    placeholderExample: 'Например: линейка фермерских завтраков во всех супермаркетах города',
  },
  {
    id: 'medicine',
    label: 'Медицина',
    shortHint: 'Многопрофильные клиники, стоматология, чекапы и диагностика',
    placeholderExample: 'Например: сеть семейных клиник, кардиологический чекап за 1 визит',
  },
  {
    id: 'auto_services',
    label: 'Авто и Услуги',
    shortHint: 'Дилерские центры, сервис, детейлинг и городские сервисы',
    placeholderExample: 'Например: официальный дилер, трейд-ин и сезонный сервис без очереди',
  },
] as const;

export const AIR_BONUS_THRESHOLD_RUB = 400_000;
export const EXPRESS_15S_PRODUCTION_RUB = 15_000;
export const TURNKEY_30S_PRODUCTION_RUB = 25_000;
export const MIN_MEDIA_BUDGET_RUB = 100_000;
export const MAX_MEDIA_BUDGET_RUB = 1_500_000;
export const DEFAULT_MEDIA_BUDGET_RUB = 300_000;

/** Пороги тайм-гейта модерации и эффективной частоты */
export const PRODUCTION_MODERATION_GATE_HOURS = 24;
export const READY_SPOT_INGEST_GATE_HOURS = 6;
export const MIN_EFFECTIVE_SPOTS_PER_SLOT = 10;
export const FOCUSED_BUDGET_CEILING_RUB = 250_000;

export const DEFAULT_FMWORKS_MARGIN_PERCENT = 20;
export const MIN_BILLABLE_SPOT_SECONDS = 5;
export const MAX_BILLABLE_SPOT_SECONDS = 60;

const RADIO_INVENTORY_STORAGE_KEY = 'fmworks_radio_inventory_v2';

/**
 * 12 реалистичных горящих квот ключевых радиоформатов:
 * - 9 базовых квот с запасом модерации `deadlineHours >= 24` (скидки 36%–40% от прайса)
 * - 3 сверхсрочных утренних/трафиковых пакета на завтра (`deadlineHours` 7–10ч, доп. скидка 45%–47%),
 *   которые автоматически открываются при наличии у клиента готового ролика с паспортом прав.
 */
const RAW_DEFAULT_RADIO_INVENTORY_SLOTS: readonly RadioInventorySlot[] = [
  {
    id: 'bfm-morning',
    station: 'Business FM',
    frequencyFm: '87.5 FM',
    programTitle: 'Утренние деловые новости и обзор рынков',
    formatDesc: 'Деловые новости, биржевые сводки и недвижимость каждые 15 минут',
    audienceTags: ['b2b', 'real_estate', 'premium', 'auto'],
    daypart: 'Утренний прайм 07:30–10:30',
    daysPattern: 'Пн–Пт',
    weekdays: [1, 2, 3, 4, 5],
    sampleTimeSlots: ['08:15', '08:45', '09:15', '10:05'],
    spotsIncluded: 16,
    maxDuration: 30,
    minDurationSec: 5,
    maxSpotSeconds: 60,
    durationMultiplicitySec: 1,
    spotsMultiplicityStep: 2,
    stationNetRatePerSec: 565,
    officialRatePerSec: 1_080,
    fmworksMarginPercent: 20,
    officialPrice: 260_000,
    hotPrice: 164_000,
    reachOTS: 320_000,
    deadlineHours: 28,
    isHidden: false,
    sourceKind: 'seed',
  },
  {
    id: 'montecarlo-drive',
    station: 'Радио Monte Carlo',
    frequencyFm: '102.1 FM',
    programTitle: 'Вечерняя коллекция · прайм возвращения домой',
    formatDesc: 'Мировая классика, джаз и аудитория с высоким доходом',
    audienceTags: ['real_estate', 'premium', 'medicine', 'auto'],
    daypart: 'Вечерний драйв 17:30–20:30',
    daysPattern: 'Пн–Пт',
    weekdays: [1, 2, 3, 4, 5],
    sampleTimeSlots: ['17:50', '18:40', '19:20', '20:05'],
    spotsIncluded: 15,
    maxDuration: 30,
    minDurationSec: 5,
    maxSpotSeconds: 60,
    durationMultiplicitySec: 1,
    spotsMultiplicityStep: 1,
    stationNetRatePerSec: 450,
    officialRatePerSec: 860,
    fmworksMarginPercent: 20,
    officialPrice: 195_000,
    hotPrice: 124_000,
    reachOTS: 275_000,
    deadlineHours: 32,
    isHidden: false,
    sourceKind: 'seed',
  },
  {
    id: 'avtoradio-traffic',
    station: 'Авторадио',
    frequencyFm: '90.3 FM',
    programTitle: 'Утреннее драйв-шоу «Мурзилки Live» + трафик',
    formatDesc: 'Лидер автомобильного прайма и утренних городских сводок движения',
    audienceTags: ['auto', 'fmcg', 'mass', 'real_estate'],
    daypart: 'Утренний прайм 07:30–10:30',
    daysPattern: 'Пн–Пт',
    weekdays: [1, 2, 3, 4, 5],
    sampleTimeSlots: ['08:20', '09:05', '09:40', '10:15'],
    spotsIncluded: 20,
    maxDuration: 15,
    minDurationSec: 5,
    maxSpotSeconds: 20,
    durationMultiplicitySec: 1,
    spotsMultiplicityStep: 2,
    stationNetRatePerSec: 465,
    officialRatePerSec: 920,
    fmworksMarginPercent: 20,
    officialPrice: 255_000,
    hotPrice: 154_000,
    reachOTS: 620_000,
    deadlineHours: 26,
    isHidden: false,
    sourceKind: 'seed',
  },
  {
    id: 'europaplus-day',
    station: 'Европа Плюс',
    frequencyFm: '106.2 FM',
    programTitle: 'Дневной интерактивный прайм',
    formatDesc: 'Высокий дневной охват активной городской аудитории 25–45 лет',
    audienceTags: ['fmcg', 'mass', 'auto', 'medicine'],
    daypart: 'Дневной блок 12:00–16:00',
    daysPattern: 'Ср–Вс',
    weekdays: [3, 4, 5, 6, 7],
    sampleTimeSlots: ['12:35', '13:45', '14:20', '15:40'],
    spotsIncluded: 18,
    maxDuration: 30,
    minDurationSec: 5,
    maxSpotSeconds: 60,
    durationMultiplicitySec: 1,
    spotsMultiplicityStep: 2,
    stationNetRatePerSec: 350,
    officialRatePerSec: 690,
    fmworksMarginPercent: 20,
    officialPrice: 215_000,
    hotPrice: 136_000,
    reachOTS: 580_000,
    deadlineHours: 30,
    isHidden: false,
    sourceKind: 'seed',
  },
  {
    id: 'comedy-evening',
    station: 'Comedy Radio',
    frequencyFm: '102.5 FM',
    programTitle: 'Вечернее шоу «Счастливые люди»',
    formatDesc: 'Платёжеспособная аудитория в вечернем трафике с высоким удержанием',
    audienceTags: ['auto', 'fmcg', 'b2b', 'mass'],
    daypart: 'Вечерний драйв 17:30–20:30',
    daysPattern: 'Пн–Пт',
    weekdays: [1, 2, 3, 4, 5],
    sampleTimeSlots: ['17:45', '18:35', '19:25', '20:10'],
    spotsIncluded: 16,
    maxDuration: 15,
    minDurationSec: 5,
    maxSpotSeconds: 45,
    durationMultiplicitySec: 1,
    spotsMultiplicityStep: 2,
    stationNetRatePerSec: 365,
    officialRatePerSec: 720,
    fmworksMarginPercent: 20,
    officialPrice: 178_000,
    hotPrice: 110_000,
    reachOTS: 395_000,
    deadlineHours: 27,
    isHidden: false,
    sourceKind: 'seed',
  },
  {
    id: 'kommersant-morning',
    station: 'Коммерсантъ FM',
    frequencyFm: '93.6 FM',
    programTitle: 'Деловые новости и главная тема часа',
    formatDesc: 'Собственники бизнеса, инвесторы и руководители компаний',
    audienceTags: ['b2b', 'real_estate', 'premium'],
    daypart: 'Утренний прайм 07:30–10:30',
    daysPattern: 'Пн–Пт',
    weekdays: [1, 2, 3, 4, 5],
    sampleTimeSlots: ['08:10', '08:50', '09:30', '10:10'],
    spotsIncluded: 14,
    maxDuration: 30,
    minDurationSec: 5,
    maxSpotSeconds: 60,
    durationMultiplicitySec: 1,
    spotsMultiplicityStep: 2,
    stationNetRatePerSec: 380,
    officialRatePerSec: 730,
    fmworksMarginPercent: 20,
    officialPrice: 175_000,
    hotPrice: 112_000,
    reachOTS: 230_000,
    deadlineHours: 29,
    isHidden: false,
    sourceKind: 'seed',
  },
  {
    id: 'dorozhnoe-day',
    station: 'Дорожное Радио',
    frequencyFm: '96.0 FM',
    programTitle: 'Спонсорство прогноза погоды и дорожных сводок',
    formatDesc: 'Широкий семейный охват, медицина, ритейл и загородное направление',
    audienceTags: ['medicine', 'fmcg', 'mass', 'auto'],
    daypart: 'Спонсорство пробок/погоды',
    daysPattern: 'Ср–Вс',
    weekdays: [3, 4, 5, 6, 7],
    sampleTimeSlots: ['08:30', '12:30', '15:30', '18:30'],
    spotsIncluded: 16,
    maxDuration: 15,
    minDurationSec: 5,
    maxSpotSeconds: 30,
    durationMultiplicitySec: 5,
    spotsMultiplicityStep: 4,
    stationNetRatePerSec: 245,
    officialRatePerSec: 490,
    fmworksMarginPercent: 20,
    officialPrice: 114_000,
    hotPrice: 68_000,
    reachOTS: 490_000,
    deadlineHours: 36,
    isHidden: false,
    sourceKind: 'seed',
  },
  {
    id: 'retrofm-morning',
    station: 'Ретро FM',
    frequencyFm: '88.3 FM',
    programTitle: 'Утреннее шоу «Первая смена»',
    formatDesc: 'Лояльная взрослая аудитория 35–60 лет с высоким доверием к эфиру',
    audienceTags: ['medicine', 'fmcg', 'real_estate', 'mass'],
    daypart: 'Утренний прайм 07:30–10:30',
    daysPattern: 'Пн–Пт',
    weekdays: [1, 2, 3, 4, 5],
    sampleTimeSlots: ['07:55', '08:40', '09:25', '10:05'],
    spotsIncluded: 14,
    maxDuration: 30,
    minDurationSec: 5,
    maxSpotSeconds: 60,
    durationMultiplicitySec: 1,
    spotsMultiplicityStep: 2,
    stationNetRatePerSec: 275,
    officialRatePerSec: 540,
    fmworksMarginPercent: 20,
    officialPrice: 118_000,
    hotPrice: 72_000,
    reachOTS: 440_000,
    deadlineHours: 25,
    isHidden: false,
    sourceKind: 'seed',
  },
  {
    id: 'silverrain-evening',
    station: 'Серебряный Дождь',
    frequencyFm: '100.1 FM',
    programTitle: 'Авторский вечерний прайм «Вечерний РБК / Итоги»',
    formatDesc: 'Интеллектуальная аудитория, архитектура, девелопмент и частный капитал',
    audienceTags: ['real_estate', 'premium', 'b2b', 'auto'],
    daypart: 'Вечерний драйв 17:30–20:30',
    daysPattern: 'Пн–Пт',
    weekdays: [1, 2, 3, 4, 5],
    sampleTimeSlots: ['17:55', '18:25', '19:15', '19:55'],
    spotsIncluded: 14,
    maxDuration: 30,
    minDurationSec: 5,
    maxSpotSeconds: 60,
    durationMultiplicitySec: 1,
    spotsMultiplicityStep: 2,
    stationNetRatePerSec: 345,
    officialRatePerSec: 680,
    fmworksMarginPercent: 20,
    officialPrice: 162_000,
    hotPrice: 98_000,
    reachOTS: 245_000,
    deadlineHours: 34,
    isHidden: false,
    sourceKind: 'seed',
  },
  {
    id: 'jazz-flash-traffic',
    station: 'Радио JAZZ',
    frequencyFm: '89.1 FM',
    programTitle: 'Срочное спонсорство погоды и трафика · выход завтра утром',
    formatDesc: 'Сверхсрочная квота для готового ролика: премиальная аудитория в часах пик',
    audienceTags: ['premium', 'real_estate', 'b2b', 'auto'],
    daypart: 'Спонсорство пробок/погоды',
    daysPattern: 'Пн–Пт',
    weekdays: [1, 2, 3, 4, 5],
    sampleTimeSlots: ['08:20', '09:15', '18:40'],
    spotsIncluded: 15,
    maxDuration: 30,
    minDurationSec: 5,
    maxSpotSeconds: 30,
    durationMultiplicitySec: 5,
    spotsMultiplicityStep: 5,
    stationNetRatePerSec: 288,
    officialRatePerSec: 650,
    fmworksMarginPercent: 20,
    officialPrice: 176_000,
    hotPrice: 94_000,
    reachOTS: 215_000,
    deadlineHours: 8,
    isHidden: false,
    sourceKind: 'seed',
  },
  {
    id: 'novoeradio-flash-morning',
    station: 'Новое Радио',
    frequencyFm: '98.4 FM',
    programTitle: 'Утреннее драйв-шоу «1+1» · горящее окно на завтра',
    formatDesc: 'Сверхсрочный сброс брони со стартом завтра утром и максимальным дисконтом',
    audienceTags: ['fmcg', 'mass', 'auto'],
    daypart: 'Утренний прайм 07:30–10:30',
    daysPattern: 'Пн–Сб',
    weekdays: [1, 2, 3, 4, 5, 6],
    sampleTimeSlots: ['08:15', '09:10', '10:05'],
    spotsIncluded: 18,
    maxDuration: 15,
    minDurationSec: 5,
    maxSpotSeconds: 20,
    durationMultiplicitySec: 1,
    spotsMultiplicityStep: 3,
    stationNetRatePerSec: 328,
    officialRatePerSec: 730,
    fmworksMarginPercent: 20,
    officialPrice: 198_000,
    hotPrice: 106_000,
    reachOTS: 520_000,
    deadlineHours: 7,
    isHidden: false,
    sourceKind: 'seed',
  },
  {
    id: 'relaxfm-flash-morning',
    station: 'Relax FM',
    frequencyFm: '90.8 FM',
    programTitle: 'Утренний атмосферный эфир · срочный старт завтра',
    formatDesc: 'Сверхсрочная квота с доп. скидкой: медицина, семейные ЖК и премиум-услуги',
    audienceTags: ['medicine', 'real_estate', 'premium', 'fmcg'],
    daypart: 'Утренний прайм 07:30–10:30',
    daysPattern: 'Ср–Вс',
    weekdays: [3, 4, 5, 6, 7],
    sampleTimeSlots: ['08:25', '09:25', '10:25'],
    spotsIncluded: 16,
    maxDuration: 30,
    minDurationSec: 5,
    maxSpotSeconds: 60,
    durationMultiplicitySec: 1,
    spotsMultiplicityStep: 2,
    stationNetRatePerSec: 288,
    officialRatePerSec: 580,
    fmworksMarginPercent: 20,
    officialPrice: 168_000,
    hotPrice: 92_000,
    reachOTS: 345_000,
    deadlineHours: 10,
    isHidden: false,
    sourceKind: 'seed',
  },
];

export const DEFAULT_RADIO_INVENTORY_SLOTS: readonly RadioInventorySlot[] =
  RAW_DEFAULT_RADIO_INVENTORY_SLOTS.map((slot) => withSlotSecondBasedPricing(slot));

/* ============================================================================
 * АРХИТЕКТУРА ПОСЕКУНДНОГО ЦЕНООБРАЗОВАНИЯ ЭФИРА И ПРОВЕРКИ КРАТНОСТИ СЛОТОВ
 * ============================================================================ */

/**
 * Политика тарификации хронометража при несовпадении с шагом кратности слота:
 * - `ceil_to_multiplicity` — округление вверх до ближайшего допустимого шага слота (например, 17с -> 20с при кратности 5с)
 * - `nearest_multiplicity` — округление к ближайшему шагу кратности слота
 * - `strict_exact` — строгий отказ, если хронометраж не кратен шагу слота
 */
export type MultiplicityRoundingPolicy =
  | 'ceil_to_multiplicity'
  | 'nearest_multiplicity'
  | 'strict_exact';

export type SlotMultiplicityStatus =
  | 'exact_match'
  | 'rounded_up_to_multiplicity'
  | 'rounded_to_nearest_multiplicity'
  | 'multiplicity_mismatch'
  | 'below_min_duration'
  | 'exceeds_max_duration'
  | 'invalid_spots_multiplicity';

export type StationPriceBasis =
  | 'per_second'
  | 'base_30s_spot'
  | 'base_15s_spot'
  | 'package_total';

export type MarginValueUnit = 'auto' | 'percent' | 'fraction';

export type MarginCalculationModel = 'markup' | 'gross_margin';

/**
 * Правила кратности хронометража и выходов для конкретного эфирного слота.
 */
export interface SlotMultiplicityRules {
  slotId?: string;
  /** Шаг кратности хронометража в секундах (1 = честный посекундный, 5/10/15 = жёсткая сетка рубрики) */
  durationMultiplicitySec?: number;
  /** Минимально допустимый хронометраж ролика в слоте (сек) */
  minDurationSec?: number;
  /** Максимально допустимый хронометраж ролика в слоте (сек) */
  maxDurationSec?: number;
  /** Кратность количества выходов в пакете слота (по умолчанию 1) */
  spotsMultiplicityStep?: number;
  /** Минимальное число выходов в слоте */
  minSpots?: number;
  /** Максимальное число выходов в слоте */
  maxSpots?: number;
}

/**
 * Результат проверки кратности и границ слота для уникального хронометража ролика (например, 17с или 22с).
 */
export interface SlotMultiplicityCheckResult {
  slotId: string;
  /** Исходный запрошенный хронометраж ролика (округлённый до целой эфирной секунды вверх) */
  requestedSeconds: number;
  /** Тарифицируемый хронометраж с учётом кратности слота (сек) */
  billedSeconds: number;
  /** Шаг кратности хронометража слота (сек) */
  durationMultiplicitySec: number;
  minDurationSec: number;
  maxDurationSec: number;
  /** Кратен ли запрошенный хронометраж шагу `durationMultiplicitySec` без остатка */
  isDurationExactMultiple: boolean;
  /** Попадает ли запрошенный и тарифицируемый хронометраж в допустимые границы `[minDurationSec, maxDurationSec]` */
  isWithinDurationBounds: boolean;
  /** Остаток от деления `requestedSeconds % durationMultiplicitySec` */
  multiplicityRemainderSec: number;
  /** Разница между оплачиваемым окном и фактической длиной ролика (`billedSeconds - requestedSeconds`, сек) */
  unbilledPaddingSec: number;
  /** Ближайшее допустимое кратное значение снизу (сек) */
  nearestValidLowerSec: number;
  /** Ближайшее допустимое кратное значение сверху (сек) */
  nearestValidUpperSec: number;
  /** Запрошенное число выходов */
  requestedSpots: number;
  /** Приведённое к кратности `spotsMultiplicityStep` число выходов */
  adjustedSpots: number;
  spotsMultiplicityStep: number;
  isSpotsExactMultiple: boolean;
  /** Итоговый флаг совместимости ролика со слотом при выбранной политике кратности */
  isCompatible: boolean;
  status: SlotMultiplicityStatus;
  /** Понятное пояснение проверки кратности на русском языке */
  reasonRu: string;
}

/**
 * Структурный дескриптор прайса станции (альтернатива числовой ставке `stationPrice` в динамическом расчёте).
 */
export interface StationTariffDescriptor {
  /** Прямая ставка радиостанции за 1 секунду 1 выхода (₽/сек) */
  ratePerSecRub?: number;
  /** Стоимость базового эталонного спота радиостанции (например, за 30с или 15с, ₽) */
  baseSpotPriceRub?: number;
  /** Эталонный хронометраж базового спота (по умолчанию 30 сек) */
  baseSpotDurationSec?: number;
  /** Стоимость всего пакета от станции (₽) */
  packageNetPriceRub?: number;
  /** Число выходов в пакете станции */
  packageSpotsCount?: number;
  /** Официальный открытый прайс станции за 1 секунду 1 выхода (₽/сек) */
  officialRatePerSecRub?: number;
  /** Правила кратности слота */
  multiplicityRules?: SlotMultiplicityRules;
}

export interface DynamicAirPriceOptions {
  /** Количество выходов в расчёте (по умолчанию 1) */
  spotsCount?: number;
  /** Что означает числовой аргумент `stationPrice` (по умолчанию `'per_second'` — ставка ₽/сек) */
  stationPriceBasis?: StationPriceBasis;
  /** Число выходов в базовом пакете при `stationPriceBasis === 'package_total'` */
  basePackageSpots?: number;
  /** Базовый хронометраж пакета при `stationPriceBasis === 'package_total'` (по умолчанию 20 сек) */
  basePackageDurationSec?: number;
  /** Единица измерения `fmworksMargin` (`'auto'` понимает и `20` как 20%, и `0.2` как 20%) */
  marginUnit?: MarginValueUnit;
  /** Модель расчёта маржи: `'markup'` (`прайс * (1 + m)`) или `'gross_margin'` (`прайс / (1 - m)`) */
  marginModel?: MarginCalculationModel;
  /** Политика округления при некратном хронометраже (по умолчанию `'ceil_to_multiplicity'`) */
  roundingPolicy?: MultiplicityRoundingPolicy;
  /** Правила кратности слота */
  multiplicityRules?: SlotMultiplicityRules;
  /** Официальная прайсовая ставка 1 секунды для расчёта клиентской скидки (₽/сек) */
  officialRatePerSecRub?: number;
}

/**
 * Результат динамического расчёта цены эфира `(секунды, прайс_станции, маржа_FMWorks)`.
 */
export interface DynamicAirPriceResult {
  requestedSeconds: number;
  billedSeconds: number;
  spotsCount: number;
  multiplicity: SlotMultiplicityCheckResult;
  /** Расчётная входная ставка радиостанции за 1 секунду 1 выхода (₽/сек) */
  stationRatePerSecRub: number;
  /** Итоговая ставка для клиента с учётом маржи FMWorks за 1 секунду 1 выхода (₽/сек) */
  clientRatePerSecRub: number;
  /** Официальная прайсовая ставка станции за 1 секунду 1 выхода (₽/сек) */
  officialRatePerSecRub: number;
  /** Нормализованная маржа FMWorks (%) */
  fmworksMarginPercent: number;
  /** Нормализованная доля маржи FMWorks (например, `0.2` для `20%`) */
  fmworksMarginRatio: number;
  /** Чистая стоимость эфира по прайсу радиостанции без маржи FMWorks (₽) */
  stationBaseCostRub: number;
  /** Сумма комиссии / маржи FMWorks в рублях (₽) */
  fmworksMarginRub: number;
  /** Итоговая динамическая стоимость эфира для клиента (₽) */
  totalClientPriceRub: number;
  /** Стоимость одного выхода заданного хронометража для клиента (₽) */
  singleSpotClientPriceRub: number;
  /** Справочная стоимость того же объёма по официальному прайсу станции (₽) */
  officialAirTotalRub: number;
  /** Процент выгоды клиента относительно официального прайса (%) */
  discountFromOfficialPercent: number;
}

/**
 * Входной интерфейс расчёта стоимости конкретного слота `RadioInventorySlot`
 * под уникальный хронометраж ролика (например, `17с` или `22с`).
 */
export interface UniqueChronometryPricingInput {
  slot: RadioInventorySlot;
  /** Уникальный хронометраж ролика в секундах (например, 17, 22, 13, 30) */
  spotSeconds: number;
  /** Желаемое количество выходов (по умолчанию `slot.spotsIncluded`) */
  spotsCount?: number;
  /** Переопределение маржи FMWorks (по умолчанию `slot.fmworksMarginPercent ?? 20`) */
  fmworksMargin?: number;
  marginUnit?: MarginValueUnit;
  roundingPolicy?: MultiplicityRoundingPolicy;
}

/**
 * Детальная котировка стоимости слота радиостанции для уникального хронометража ролика.
 */
export interface UniqueChronometrySlotQuote {
  slot: RadioInventorySlot;
  slotId: string;
  station: string;
  daypart: DaypartLabel;
  requestedSeconds: number;
  billedSeconds: number;
  spotsCount: number;
  multiplicity: SlotMultiplicityCheckResult;
  pricing: DynamicAirPriceResult;
  /** Прогнозируемый охват OTS с учётом скорректированного числа выходов */
  estimatedReachOTS: number;
}

/**
 * Опции пересчёта эфирной квоты методом `calculateCost(durationSeconds, stationPrice, margin)`.
 */
export interface CalculateCostOptions extends DynamicAirPriceOptions {
  /** Эталонный хронометраж базовой квоты станции (сек, например 15, 20 или 30) */
  baseQuotaDurationSeconds?: number;
}

/**
 * Сериализуемая структура данных посекундного ценообразования эфирной квоты.
 */
export interface SecondBasedPricingConfig {
  /** Идентификатор слота или тарифа */
  slotId?: string;
  /** Эталонная длительность базовой квоты радиостанции (сек) */
  baseQuotaDurationSeconds: number;
  /** Количество выходов, включённых в эфирную квоту */
  spotsIncluded: number;
  /** Единица измерения входного прайса станции (`per_second` | `base_30s_spot` | `base_15s_spot` | `package_total`) */
  stationPriceBasis: StationPriceBasis;
  /** Базовый прайс станции (ставка за секунду, эталонный ролик или весь пакет квоты, ₽) */
  stationPriceRub: number;
  /** Приведённая нетто-ставка станции за 1 секунду 1 выхода (₽/сек) */
  stationRatePerSecRub: number;
  /** Официальный открытый прайс станции за 1 секунду 1 выхода (₽/сек) */
  officialRatePerSecRub: number;
  /** Шаг кратности длительности ролика в секундах (1 = посекундно, 5/10/15 = кратное окно рубрики) */
  multiplicityStepSeconds: number;
  /** Минимально допустимая длительность ролика (сек) */
  minDurationSeconds: number;
  /** Максимально допустимая длительность ролика (сек) */
  maxDurationSeconds: number;
  /** Шаг кратности числа выходов в пакете */
  spotsMultiplicityStep: number;
  /** Политика округления некратного хронометража (`ceil_to_multiplicity` | `nearest_multiplicity` | `strict_exact`) */
  roundingPolicy: MultiplicityRoundingPolicy;
  /** Наценка агентства FMWorks (в процентах, например `20`, или в доле `0.2`) */
  agencyMargin: number;
  /** Модель расчёта комиссии агентства (`markup` = наценка на прайс станции, `gross_margin` = маржинальность) */
  marginModel: MarginCalculationModel;
}

/**
 * Результат пересчёта эфирной квоты методом `calculateCost(durationSeconds, stationPrice, margin)`.
 */
export interface SecondBasedCostResult extends DynamicAirPriceResult {
  /** Фактическая запрошенная длительность ролика (сек, округлённая вверх до целой секунды эфира) */
  actualDurationSeconds: number;
  /** Расчётная длительность ролика после применения правил кратности слота (сек) */
  effectiveDurationSeconds: number;
  /** Эталонная длительность базовой эфирной квоты (сек) */
  baseQuotaDurationSeconds: number;
  /** Коэффициент пропорционального пересчёта квоты (`effectiveDurationSeconds / baseQuotaDurationSeconds`) */
  quotaDurationScaleFactor: number;
  /** Пересчитанная стоимость эфирной квоты по прайсу станции без наценки агентства (₽) */
  stationQuotaCostRub: number;
  /** Сумма наценки агентства FMWorks в рублях (₽) */
  agencyMarkupRub: number;
  /** Процент наценки агентства FMWorks (%) */
  agencyMarginPercent: number;
  /** Итоговая стоимость пересчитанной эфирной квоты для клиента с учётом кратности и наценки агентства (₽) */
  totalQuotaCostRub: number;
}

/**
 * Интерфейс посекундного ценообразования (`SecondBasedPricing`), объединяющий структуру тарифа/кратности квоты
 * и метод `calculateCost(durationSeconds, stationPrice, margin)` для динамического пересчёта стоимости эфира.
 */
export interface SecondBasedPricing extends SecondBasedPricingConfig {
  /** Правила кратности слота в унифицированном формате `SlotMultiplicityRules` */
  multiplicityRules: Required<SlotMultiplicityRules>;
  /**
   * Пересчитывает эфирную квоту исходя из фактической длительности ролика (`durationSeconds`),
   * учитывая правила кратности слота и наценку агентства (`margin`).
   * Если `stationPrice` или `margin` не переданы, используются параметры самой квоты.
   */
  calculateCost(
    durationSeconds: number,
    stationPrice?: number | StationTariffDescriptor,
    margin?: number,
    options?: CalculateCostOptions
  ): SecondBasedCostResult;
}

/**
 * Сервисный интерфейс модуля посекундного ценообразования эфира FMWorks.
 */
export interface PerSecondAirPricingEngine {
  validateSlotMultiplicity(
    seconds: number,
    rules?: SlotMultiplicityRules,
    options?: { requestedSpots?: number; roundingPolicy?: MultiplicityRoundingPolicy }
  ): SlotMultiplicityCheckResult;
  calculateDynamicAirPrice(
    seconds: number,
    stationPrice: number | StationTariffDescriptor,
    fmworksMargin?: number,
    options?: DynamicAirPriceOptions
  ): DynamicAirPriceResult;
  calculateCost(
    durationSeconds: number,
    stationPrice: number | StationTariffDescriptor,
    margin?: number,
    options?: CalculateCostOptions
  ): SecondBasedCostResult;
  createSecondBasedPricing(
    init?: Partial<SecondBasedPricingConfig>
  ): SecondBasedPricing;
  calculateSlotPriceForUniqueChronometry(
    input: UniqueChronometryPricingInput
  ): UniqueChronometrySlotQuote;
  evaluateInventoryForChronometry(
    spotSeconds: number,
    options?: {
      slots?: readonly RadioInventorySlot[];
      fmworksMargin?: number;
      roundingPolicy?: MultiplicityRoundingPolicy;
    }
  ): UniqueChronometrySlotQuote[];
}

/**
 * Нормализует маржу FMWorks: поддерживает передачу как в процентах (`20` -> `20%`),
 * так и в десятичной доле (`0.2` -> `20%`).
 */
export function normalizeFmworksMargin(
  rawMargin: number,
  unit: MarginValueUnit = 'auto'
): { marginPercent: number; marginRatio: number } {
  if (!Number.isFinite(rawMargin) || rawMargin <= 0) {
    return { marginPercent: 0, marginRatio: 0 };
  }

  let ratio: number;
  if (unit === 'fraction') {
    ratio = rawMargin;
  } else if (unit === 'percent') {
    ratio = rawMargin / 100;
  } else {
    // 'auto': значения строго меньше 1 (напр. 0.15, 0.2, 0.25) интерпретируются как доля, >= 1 — как проценты
    ratio = rawMargin < 1 ? rawMargin : rawMargin / 100;
  }

  const safeRatio = Math.max(0, Math.min(5, ratio));
  return {
    marginPercent: Math.round(safeRatio * 10_000) / 100,
    marginRatio: safeRatio,
  };
}

/**
 * Извлекает правила кратности хронометража и количества выходов из карточки слота `RadioInventorySlot`.
 * Для спонсорских рубрик погоды/пробок шаг кратности по умолчанию равен `5 сек`,
 * для линейных рекламных блоков — `1 сек` (честный посекундный расчёт).
 */
export function extractSlotMultiplicityRules(
  slot: Pick<
    RadioInventorySlot,
    | 'id'
    | 'daypart'
    | 'maxDuration'
    | 'spotsIncluded'
    | 'minDurationSec'
    | 'maxSpotSeconds'
    | 'durationMultiplicitySec'
    | 'spotsMultiplicityStep'
  >
): Required<SlotMultiplicityRules> {
  const isSponsorshipBlock = slot.daypart === 'Спонсорство пробок/погоды';
  const durationMultiplicitySec =
    slot.durationMultiplicitySec ?? (isSponsorshipBlock ? 5 : 1);
  const minDurationSec = Math.max(1, slot.minDurationSec ?? MIN_BILLABLE_SPOT_SECONDS);
  const maxDurationSec = Math.max(
    minDurationSec,
    slot.maxSpotSeconds ?? (slot.maxDuration === 15 ? 20 : MAX_BILLABLE_SPOT_SECONDS)
  );
  const spotsMultiplicityStep = Math.max(1, Math.round(slot.spotsMultiplicityStep ?? 1));
  const minSpots = Math.max(1, Math.min(slot.spotsIncluded, spotsMultiplicityStep));
  const maxSpots = Math.max(slot.spotsIncluded * 3, 60);

  return {
    slotId: slot.id,
    durationMultiplicitySec,
    minDurationSec,
    maxDurationSec,
    spotsMultiplicityStep,
    minSpots,
    maxSpots,
  };
}

/**
 * Проверяет уникальный хронометраж ролика (например, `17с`, `22с`) и количество выходов
 * на соответствие правилам кратности и лимитам конкретного слота.
 */
export function validateSlotMultiplicity(
  seconds: number,
  rules: SlotMultiplicityRules = {},
  options: {
    requestedSpots?: number;
    roundingPolicy?: MultiplicityRoundingPolicy;
  } = {}
): SlotMultiplicityCheckResult {
  const slotId = rules.slotId ?? 'dynamic-slot';
  const stepSec = Math.max(1, Math.round(rules.durationMultiplicitySec ?? 1));
  const minDurationSec = Math.max(1, Math.round(rules.minDurationSec ?? MIN_BILLABLE_SPOT_SECONDS));
  const maxDurationSec = Math.max(
    minDurationSec,
    Math.round(rules.maxDurationSec ?? MAX_BILLABLE_SPOT_SECONDS)
  );
  const spotsStep = Math.max(1, Math.round(rules.spotsMultiplicityStep ?? 1));
  const minSpots = Math.max(1, Math.round(rules.minSpots ?? 1));
  const maxSpots = Math.max(minSpots, Math.round(rules.maxSpots ?? 200));
  const roundingPolicy = options.roundingPolicy ?? 'ceil_to_multiplicity';

  // Любой дробный хронометраж аудиофайла в эфире занимает целое число секунд вверх
  const normalizedRequestedSec =
    Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;

  const requestedSpots =
    options.requestedSpots !== undefined && Number.isFinite(options.requestedSpots)
      ? Math.max(1, Math.round(options.requestedSpots))
      : minSpots;

  // Проверка кратности числа выходов
  const isSpotsExactMultiple =
    requestedSpots >= minSpots &&
    requestedSpots <= maxSpots &&
    (requestedSpots - minSpots) % spotsStep === 0 &&
    (spotsStep === 1 || requestedSpots % spotsStep === 0 || (requestedSpots - minSpots) % spotsStep === 0);

  // Для прозрачной пакетной кратности проверяем `requestedSpots % spotsStep === 0` при `minSpots % spotsStep === 0`
  const strictSpotsRemainder = requestedSpots % spotsStep;
  const spotsAligned = strictSpotsRemainder === 0 && requestedSpots >= minSpots && requestedSpots <= maxSpots;

  let adjustedSpots = requestedSpots;
  if (!spotsAligned) {
    if (roundingPolicy === 'nearest_multiplicity') {
      adjustedSpots = Math.round(requestedSpots / spotsStep) * spotsStep;
    } else if (roundingPolicy === 'ceil_to_multiplicity') {
      adjustedSpots = Math.ceil(requestedSpots / spotsStep) * spotsStep;
    }
    adjustedSpots = Math.max(
      Math.ceil(minSpots / spotsStep) * spotsStep,
      Math.min(Math.floor(maxSpots / spotsStep) * spotsStep || maxSpots, adjustedSpots)
    );
  }

  // Ближайшие кратные границы хронометража
  const rawLower = Math.max(
    Math.ceil(minDurationSec / stepSec) * stepSec,
    Math.floor(Math.max(normalizedRequestedSec, minDurationSec) / stepSec) * stepSec
  );
  const rawUpper = Math.ceil(Math.max(normalizedRequestedSec, minDurationSec) / stepSec) * stepSec;
  const nearestValidLowerSec = Math.min(maxDurationSec, rawLower);
  const nearestValidUpperSec = Math.min(
    Math.floor(maxDurationSec / stepSec) * stepSec || maxDurationSec,
    rawUpper
  );

  const remainderSec =
    normalizedRequestedSec > 0 ? normalizedRequestedSec % stepSec : stepSec;
  const isDurationExactMultiple = normalizedRequestedSec > 0 && remainderSec === 0;

  // 1. Проверка нижней границы хронометража
  if (normalizedRequestedSec < minDurationSec) {
    const minValid = Math.ceil(minDurationSec / stepSec) * stepSec;
    return {
      slotId,
      requestedSeconds: normalizedRequestedSec,
      billedSeconds: minValid,
      durationMultiplicitySec: stepSec,
      minDurationSec,
      maxDurationSec,
      isDurationExactMultiple: false,
      isWithinDurationBounds: false,
      multiplicityRemainderSec: remainderSec,
      unbilledPaddingSec: Math.max(0, minValid - normalizedRequestedSec),
      nearestValidLowerSec: minValid,
      nearestValidUpperSec: minValid,
      requestedSpots,
      adjustedSpots,
      spotsMultiplicityStep: spotsStep,
      isSpotsExactMultiple: spotsAligned && isSpotsExactMultiple,
      isCompatible: false,
      status: 'below_min_duration',
      reasonRu: `Хронометраж ${normalizedRequestedSec} сек ниже минимального порога слота (${minDurationSec} сек)`,
    };
  }

  // 2. Проверка верхней границы хронометража до округления
  if (normalizedRequestedSec > maxDurationSec) {
    const maxValid = Math.floor(maxDurationSec / stepSec) * stepSec || maxDurationSec;
    return {
      slotId,
      requestedSeconds: normalizedRequestedSec,
      billedSeconds: normalizedRequestedSec,
      durationMultiplicitySec: stepSec,
      minDurationSec,
      maxDurationSec,
      isDurationExactMultiple,
      isWithinDurationBounds: false,
      multiplicityRemainderSec: remainderSec,
      unbilledPaddingSec: 0,
      nearestValidLowerSec: maxValid,
      nearestValidUpperSec: maxValid,
      requestedSpots,
      adjustedSpots,
      spotsMultiplicityStep: spotsStep,
      isSpotsExactMultiple: spotsAligned,
      isCompatible: false,
      status: 'exceeds_max_duration',
      reasonRu: `Хронометраж ${normalizedRequestedSec} сек превышает лимит слота (до ${maxDurationSec} сек)`,
    };
  }

  // 3. Определение оплачиваемого хронометража по политике кратности
  let billedSeconds = normalizedRequestedSec;
  if (!isDurationExactMultiple) {
    if (roundingPolicy === 'ceil_to_multiplicity' || roundingPolicy === 'strict_exact') {
      billedSeconds = rawUpper;
    } else {
      const candidateNearest = Math.round(normalizedRequestedSec / stepSec) * stepSec;
      // Ролик длиннее окна физически не поместится в эфирный слот без подрезки текста,
      // но в режиме nearest возвращаем ближайший допустимый кратный ориентир не ниже minDurationSec
      billedSeconds = Math.max(Math.ceil(minDurationSec / stepSec) * stepSec, candidateNearest);
    }
  }

  // Если округление вверх до кратности вытолкнуло ролик за пределы maxDurationSec (например, 22с -> 25с при лимите 22с)
  if (billedSeconds > maxDurationSec) {
    const maxValid = Math.floor(maxDurationSec / stepSec) * stepSec || maxDurationSec;
    return {
      slotId,
      requestedSeconds: normalizedRequestedSec,
      billedSeconds,
      durationMultiplicitySec: stepSec,
      minDurationSec,
      maxDurationSec,
      isDurationExactMultiple: false,
      isWithinDurationBounds: false,
      multiplicityRemainderSec: remainderSec,
      unbilledPaddingSec: billedSeconds - normalizedRequestedSec,
      nearestValidLowerSec: maxValid,
      nearestValidUpperSec: maxValid,
      requestedSpots,
      adjustedSpots,
      spotsMultiplicityStep: spotsStep,
      isSpotsExactMultiple: spotsAligned,
      isCompatible: false,
      status: 'exceeds_max_duration',
      reasonRu: `С учётом кратности ${stepSec} сек ролик ${normalizedRequestedSec} сек требует окна ${billedSeconds} сек при лимите слота ${maxDurationSec} сек`,
    };
  }

  // 4. Строгий режим: отказ при некратности секунд или выходов
  if (roundingPolicy === 'strict_exact') {
    if (!isDurationExactMultiple) {
      return {
        slotId,
        requestedSeconds: normalizedRequestedSec,
        billedSeconds,
        durationMultiplicitySec: stepSec,
        minDurationSec,
        maxDurationSec,
        isDurationExactMultiple: false,
        isWithinDurationBounds: true,
        multiplicityRemainderSec: remainderSec,
        unbilledPaddingSec: billedSeconds - normalizedRequestedSec,
        nearestValidLowerSec,
        nearestValidUpperSec,
        requestedSpots,
        adjustedSpots: requestedSpots,
        spotsMultiplicityStep: spotsStep,
        isSpotsExactMultiple: spotsAligned,
        isCompatible: false,
        status: 'multiplicity_mismatch',
        reasonRu: `Слот требует хронометраж, кратный ${stepSec} сек (ближайшие окна: ${nearestValidLowerSec} или ${nearestValidUpperSec} сек)`,
      };
    }
    if (!spotsAligned) {
      return {
        slotId,
        requestedSeconds: normalizedRequestedSec,
        billedSeconds,
        durationMultiplicitySec: stepSec,
        minDurationSec,
        maxDurationSec,
        isDurationExactMultiple: true,
        isWithinDurationBounds: true,
        multiplicityRemainderSec: 0,
        unbilledPaddingSec: 0,
        nearestValidLowerSec,
        nearestValidUpperSec,
        requestedSpots,
        adjustedSpots,
        spotsMultiplicityStep: spotsStep,
        isSpotsExactMultiple: false,
        isCompatible: false,
        status: 'invalid_spots_multiplicity',
        reasonRu: `Количество выходов (${requestedSpots}) должно быть кратно ${spotsStep} (например, ${adjustedSpots} вых.)`,
      };
    }
  }

  const unbilledPaddingSec = Math.max(0, billedSeconds - normalizedRequestedSec);
  const status: SlotMultiplicityStatus = isDurationExactMultiple
    ? 'exact_match'
    : roundingPolicy === 'nearest_multiplicity'
      ? 'rounded_to_nearest_multiplicity'
      : 'rounded_up_to_multiplicity';

  const reasonRu = isDurationExactMultiple
    ? stepSec === 1
      ? `Честный посекундный расчёт (шаг 1 сек): оплачиваются ровно ${billedSeconds} сек`
      : `Точное попадание в сетку слота (шаг ${stepSec} сек): ${billedSeconds} сек`
    : `Кратность слота ${stepSec} сек: ролик ${normalizedRequestedSec} сек тарифицируется по окну ${billedSeconds} сек (+${unbilledPaddingSec} сек)`;

  return {
    slotId,
    requestedSeconds: normalizedRequestedSec,
    billedSeconds,
    durationMultiplicitySec: stepSec,
    minDurationSec,
    maxDurationSec,
    isDurationExactMultiple,
    isWithinDurationBounds: true,
    multiplicityRemainderSec: remainderSec,
    unbilledPaddingSec,
    nearestValidLowerSec,
    nearestValidUpperSec,
    requestedSpots,
    adjustedSpots,
    spotsMultiplicityStep: spotsStep,
    isSpotsExactMultiple: spotsAligned,
    isCompatible: true,
    status,
    reasonRu,
  };
}

/**
 * Динамический метод расчёта цены эфира, принимающий `(секунды, прайс_станции, маржа_FMWorks)`.
 *
 * - Проверяет уникальный хронометраж ролика (например, `17с`, `22с`) по правилам кратности слота;
 * - Вычисляет базовую посекундную ставку радиостанции (из прямой ставки `₽/сек`, эталона 15с/30с или пакета);
 * - Начисляет динамическую маржу FMWorks (`%` или доля `0..1`) без расхождения суммы в рублях.
 */
export function calculateDynamicAirPrice(
  seconds: number,
  stationPrice: number | StationTariffDescriptor,
  fmworksMargin: number = DEFAULT_FMWORKS_MARGIN_PERCENT,
  options: DynamicAirPriceOptions = {}
): DynamicAirPriceResult {
  const { marginPercent, marginRatio } = normalizeFmworksMargin(
    fmworksMargin,
    options.marginUnit ?? 'auto'
  );
  const marginModel = options.marginModel ?? 'markup';

  // 1. Определяем базовую ставку 1 секунды станции и правила кратности
  let stationRatePerSecRub = 0;
  let officialRatePerSecRub = options.officialRatePerSecRub ?? 0;
  let mergedRules: SlotMultiplicityRules = { ...(options.multiplicityRules ?? {}) };
  let defaultSpots = options.spotsCount ?? 1;

  if (typeof stationPrice === 'number') {
    const safePrice = Number.isFinite(stationPrice) ? Math.max(0, stationPrice) : 0;
    const basis = options.stationPriceBasis ?? 'per_second';
    if (basis === 'base_30s_spot') {
      stationRatePerSecRub = safePrice / 30;
    } else if (basis === 'base_15s_spot') {
      stationRatePerSecRub = safePrice / 15;
    } else if (basis === 'package_total') {
      const pkgSpots = Math.max(1, options.basePackageSpots ?? 15);
      const pkgDur = Math.max(1, options.basePackageDurationSec ?? 20);
      stationRatePerSecRub = safePrice / (pkgSpots * pkgDur);
      if (options.spotsCount === undefined) {
        defaultSpots = pkgSpots;
      }
    } else {
      stationRatePerSecRub = safePrice;
    }
  } else {
    if (stationPrice.multiplicityRules) {
      mergedRules = {
        ...stationPrice.multiplicityRules,
        ...(options.multiplicityRules ?? {}),
      };
    }
    if (options.spotsCount === undefined && stationPrice.packageSpotsCount) {
      defaultSpots = stationPrice.packageSpotsCount;
    }

    if (
      typeof stationPrice.ratePerSecRub === 'number' &&
      stationPrice.ratePerSecRub > 0
    ) {
      stationRatePerSecRub = stationPrice.ratePerSecRub;
    } else if (
      typeof stationPrice.baseSpotPriceRub === 'number' &&
      stationPrice.baseSpotPriceRub > 0
    ) {
      const refSec = Math.max(1, stationPrice.baseSpotDurationSec ?? 30);
      stationRatePerSecRub = stationPrice.baseSpotPriceRub / refSec;
    } else if (
      typeof stationPrice.packageNetPriceRub === 'number' &&
      stationPrice.packageNetPriceRub > 0
    ) {
      const pkgSpots = Math.max(1, stationPrice.packageSpotsCount ?? 15);
      const refSec = Math.max(1, stationPrice.baseSpotDurationSec ?? 20);
      stationRatePerSecRub = stationPrice.packageNetPriceRub / (pkgSpots * refSec);
    }

    if (!officialRatePerSecRub && stationPrice.officialRatePerSecRub) {
      officialRatePerSecRub = stationPrice.officialRatePerSecRub;
    }
  }

  // 2. Проверяем кратность хронометража и выходов
  const multiplicity = validateSlotMultiplicity(seconds, mergedRules, {
    requestedSpots: defaultSpots,
    roundingPolicy: options.roundingPolicy ?? 'ceil_to_multiplicity',
  });

  const spotsCount = multiplicity.adjustedSpots;
  const billedSeconds = multiplicity.billedSeconds;

  // 3. Считаем рублёвую базу станции и клиентскую цену с маржой FMWorks
  const rawStationBaseCost = stationRatePerSecRub * billedSeconds * spotsCount;
  const stationBaseCostRub = Math.round(rawStationBaseCost);

  let rawClientTotal: number;
  let clientRatePerSecRaw: number;
  if (marginModel === 'gross_margin') {
    const safeGrossDenom = Math.max(0.05, 1 - Math.min(0.95, marginRatio));
    rawClientTotal = rawStationBaseCost / safeGrossDenom;
    clientRatePerSecRaw = stationRatePerSecRub / safeGrossDenom;
  } else {
    rawClientTotal = rawStationBaseCost * (1 + marginRatio);
    clientRatePerSecRaw = stationRatePerSecRub * (1 + marginRatio);
  }

  const totalClientPriceRub = Math.max(stationBaseCostRub, Math.round(rawClientTotal));
  const fmworksMarginRub = Math.max(0, totalClientPriceRub - stationBaseCostRub);
  const singleSpotClientPriceRub =
    spotsCount > 0 ? Math.round(totalClientPriceRub / spotsCount) : totalClientPriceRub;

  const resolvedOfficialRatePerSec =
    officialRatePerSecRub > 0
      ? officialRatePerSecRub
      : Math.round(clientRatePerSecRaw * 1.58 * 100) / 100;

  const officialAirTotalRub = Math.max(
    totalClientPriceRub,
    Math.round(resolvedOfficialRatePerSec * billedSeconds * spotsCount)
  );
  const discountFromOfficialPercent =
    officialAirTotalRub > 0 && totalClientPriceRub < officialAirTotalRub
      ? Math.round(
          ((officialAirTotalRub - totalClientPriceRub) / officialAirTotalRub) * 100
        )
      : 0;

  return {
    requestedSeconds: multiplicity.requestedSeconds,
    billedSeconds,
    spotsCount,
    multiplicity,
    stationRatePerSecRub: Math.round(stationRatePerSecRub * 100) / 100,
    clientRatePerSecRub: Math.round(clientRatePerSecRaw * 100) / 100,
    officialRatePerSecRub: Math.round(resolvedOfficialRatePerSec * 100) / 100,
    fmworksMarginPercent: marginPercent,
    fmworksMarginRatio: marginRatio,
    stationBaseCostRub,
    fmworksMarginRub,
    totalClientPriceRub,
    singleSpotClientPriceRub,
    officialAirTotalRub,
    discountFromOfficialPercent,
  };
}

/**
 * Извлекает согласованные посекундные ставки (`нетто станции`, `горящая ставка клиента`, `официальный прайс`)
 * из любого слота `RadioInventorySlot` (включая импортированные и ручные слоты из админ-панели).
 */
export function resolveSlotPerSecondRates(
  slot: RadioInventorySlot,
  fmworksMarginOverride?: number
): {
  stationNetRatePerSecRub: number;
  clientHotRatePerSecRub: number;
  officialRatePerSecRub: number;
  fmworksMarginPercent: number;
  referenceDurationSec: number;
} {
  const referenceDurationSec = slot.maxDuration === 15 ? 15 : 20;
  const spots = Math.max(1, slot.spotsIncluded);
  const baseSlotMargin = slot.fmworksMarginPercent ?? DEFAULT_FMWORKS_MARGIN_PERCENT;
  const effectiveMarginPct =
    fmworksMarginOverride !== undefined
      ? normalizeFmworksMargin(fmworksMarginOverride).marginPercent
      : baseSlotMargin;

  const stationNetRatePerSecRub =
    typeof slot.stationNetRatePerSec === 'number' && slot.stationNetRatePerSec > 0
      ? slot.stationNetRatePerSec
      : Math.round(
          (slot.hotPrice / (1 + baseSlotMargin / 100) / (spots * referenceDurationSec)) * 100
        ) / 100;

  const clientHotRatePerSecRub =
    Math.round(stationNetRatePerSecRub * (1 + effectiveMarginPct / 100) * 100) / 100;

  const officialRatePerSecRub =
    typeof slot.officialRatePerSec === 'number' && slot.officialRatePerSec > 0
      ? slot.officialRatePerSec
      : Math.max(
          Math.ceil(clientHotRatePerSecRub * 1.4),
          Math.round((slot.officialPrice / (spots * referenceDurationSec)) * 100) / 100
        );

  return {
    stationNetRatePerSecRub,
    clientHotRatePerSecRub,
    officialRatePerSecRub,
    fmworksMarginPercent: effectiveMarginPct,
    referenceDurationSec,
  };
}

/**
 * Рассчитывает полную стоимость конкретного слота радиостанции (`RadioInventorySlot`)
 * для любого уникального хронометража ролика (например, `17с` или `22с`) с проверкой кратности слота.
 */
export function calculateSlotPriceForUniqueChronometry(
  input: UniqueChronometryPricingInput
): UniqueChronometrySlotQuote {
  const { slot, spotSeconds } = input;
  const rules = extractSlotMultiplicityRules(slot);
  const rates = resolveSlotPerSecondRates(slot, input.fmworksMargin);
  const targetSpots = input.spotsCount ?? slot.spotsIncluded;

  const pricing = calculateDynamicAirPrice(
    spotSeconds,
    {
      ratePerSecRub: rates.stationNetRatePerSecRub,
      officialRatePerSecRub: rates.officialRatePerSecRub,
      packageSpotsCount: slot.spotsIncluded,
      multiplicityRules: rules,
    },
    input.fmworksMargin ?? rates.fmworksMarginPercent,
    {
      spotsCount: targetSpots,
      marginUnit: input.marginUnit ?? (input.fmworksMargin !== undefined ? 'auto' : 'percent'),
      roundingPolicy: input.roundingPolicy ?? 'ceil_to_multiplicity',
      officialRatePerSecRub: rates.officialRatePerSecRub,
    }
  );

  // Масштабирование OTS с плавной дедупликацией при росте числа выходов
  const baseUnitReach = slot.reachOTS / Math.max(1, slot.spotsIncluded);
  const dedup =
    pricing.spotsCount <= 10
      ? 1
      : 1 - Math.min(0.22, (pricing.spotsCount - 10) * 0.008);
  const estimatedReachOTS = Math.round(baseUnitReach * pricing.spotsCount * dedup);

  return {
    slot,
    slotId: slot.id,
    station: slot.station,
    daypart: slot.daypart,
    requestedSeconds: pricing.requestedSeconds,
    billedSeconds: pricing.billedSeconds,
    spotsCount: pricing.spotsCount,
    multiplicity: pricing.multiplicity,
    pricing,
    estimatedReachOTS,
  };
}

/**
 * Прогоняет все слоты радиоинвентаря через проверку кратности и посекундный расчёт
 * под заданный уникальный хронометраж ролика (например, `17с` или `22с`).
 */
export function evaluateInventoryForChronometry(
  spotSeconds: number,
  options: {
    slots?: readonly RadioInventorySlot[];
    fmworksMargin?: number;
    roundingPolicy?: MultiplicityRoundingPolicy;
  } = {}
): UniqueChronometrySlotQuote[] {
  const sourceSlots = options.slots ?? radioInventoryStore.getActiveSlots();
  return sourceSlots
    .filter((s) => !s.isHidden)
    .map((slot) =>
      calculateSlotPriceForUniqueChronometry({
        slot,
        spotSeconds,
        fmworksMargin: options.fmworksMargin,
        roundingPolicy: options.roundingPolicy,
      })
    );
}

/**
 * Пересчитывает эфирную квоту исходя из фактической длительности ролика (`durationSeconds`),
 * учитывая правила кратности слота и наценку агентства (`margin`).
 */
export function calculateCost(
  durationSeconds: number,
  stationPrice: number | StationTariffDescriptor,
  margin: number = DEFAULT_FMWORKS_MARGIN_PERCENT,
  options: CalculateCostOptions = {}
): SecondBasedCostResult {
  const dynamicResult = calculateDynamicAirPrice(
    durationSeconds,
    stationPrice,
    margin,
    options
  );

  let inferredBaseDurationSec = options.baseQuotaDurationSeconds;
  if (!inferredBaseDurationSec || inferredBaseDurationSec <= 0) {
    if (typeof stationPrice === 'object' && stationPrice !== null) {
      if (stationPrice.baseSpotDurationSec && stationPrice.baseSpotDurationSec > 0) {
        inferredBaseDurationSec = stationPrice.baseSpotDurationSec;
      } else if (stationPrice.baseSpotPriceRub && stationPrice.baseSpotPriceRub > 0) {
        inferredBaseDurationSec = 30;
      } else if (stationPrice.packageNetPriceRub && stationPrice.packageNetPriceRub > 0) {
        inferredBaseDurationSec = 20;
      } else {
        inferredBaseDurationSec = 1;
      }
    } else {
      const basis = options.stationPriceBasis ?? 'per_second';
      if (basis === 'base_30s_spot') {
        inferredBaseDurationSec = 30;
      } else if (basis === 'base_15s_spot') {
        inferredBaseDurationSec = 15;
      } else if (basis === 'package_total') {
        inferredBaseDurationSec = Math.max(1, options.basePackageDurationSec ?? 20);
      } else {
        inferredBaseDurationSec = 1;
      }
    }
  }

  const baseQuotaDurationSeconds = Math.max(1, Math.round(inferredBaseDurationSec));
  const quotaDurationScaleFactor =
    Math.round((dynamicResult.billedSeconds / baseQuotaDurationSeconds) * 10_000) / 10_000;

  return {
    ...dynamicResult,
    actualDurationSeconds: dynamicResult.requestedSeconds,
    effectiveDurationSeconds: dynamicResult.billedSeconds,
    baseQuotaDurationSeconds,
    quotaDurationScaleFactor,
    stationQuotaCostRub: dynamicResult.stationBaseCostRub,
    agencyMarkupRub: dynamicResult.fmworksMarginRub,
    agencyMarginPercent: dynamicResult.fmworksMarginPercent,
    totalQuotaCostRub: dynamicResult.totalClientPriceRub,
  };
}

/**
 * Создаёт экземпляр структуры данных `SecondBasedPricing` с привязанным методом
 * `calculateCost(durationSeconds, stationPrice?, margin?, options?)`.
 */
export function createSecondBasedPricing(
  init: Partial<SecondBasedPricingConfig> = {}
): SecondBasedPricing {
  const slotId = init.slotId ?? 'second-based-quota';
  const baseQuotaDurationSeconds = Math.max(1, Math.round(init.baseQuotaDurationSeconds ?? 20));
  const spotsIncluded = Math.max(1, Math.round(init.spotsIncluded ?? 1));
  const stationPriceBasis: StationPriceBasis = init.stationPriceBasis ?? 'per_second';
  const stationPriceRub =
    typeof init.stationPriceRub === 'number' && Number.isFinite(init.stationPriceRub)
      ? Math.max(0, init.stationPriceRub)
      : typeof init.stationRatePerSecRub === 'number' && Number.isFinite(init.stationRatePerSecRub)
        ? Math.max(0, init.stationRatePerSecRub)
        : 0;

  let stationRatePerSecRub =
    typeof init.stationRatePerSecRub === 'number' && init.stationRatePerSecRub > 0
      ? init.stationRatePerSecRub
      : 0;

  if (stationRatePerSecRub <= 0 && stationPriceRub > 0) {
    if (stationPriceBasis === 'base_30s_spot') {
      stationRatePerSecRub = stationPriceRub / 30;
    } else if (stationPriceBasis === 'base_15s_spot') {
      stationRatePerSecRub = stationPriceRub / 15;
    } else if (stationPriceBasis === 'package_total') {
      stationRatePerSecRub = stationPriceRub / (spotsIncluded * baseQuotaDurationSeconds);
    } else {
      stationRatePerSecRub = stationPriceRub;
    }
  }

  const agencyMargin =
    init.agencyMargin !== undefined && Number.isFinite(init.agencyMargin)
      ? Math.max(0, init.agencyMargin)
      : DEFAULT_FMWORKS_MARGIN_PERCENT;
  const normalizedMargin = normalizeFmworksMargin(agencyMargin);
  const officialRatePerSecRub =
    typeof init.officialRatePerSecRub === 'number' && init.officialRatePerSecRub > 0
      ? init.officialRatePerSecRub
      : Math.round(stationRatePerSecRub * (1 + normalizedMargin.marginRatio) * 1.58 * 100) / 100;

  const multiplicityStepSeconds = Math.max(1, Math.round(init.multiplicityStepSeconds ?? 1));
  const minDurationSeconds = Math.max(
    1,
    Math.round(init.minDurationSeconds ?? MIN_BILLABLE_SPOT_SECONDS)
  );
  const maxDurationSeconds = Math.max(
    minDurationSeconds,
    Math.round(init.maxDurationSeconds ?? MAX_BILLABLE_SPOT_SECONDS)
  );
  const spotsMultiplicityStep = Math.max(1, Math.round(init.spotsMultiplicityStep ?? 1));
  const roundingPolicy: MultiplicityRoundingPolicy =
    init.roundingPolicy ?? 'ceil_to_multiplicity';
  const marginModel: MarginCalculationModel = init.marginModel ?? 'markup';

  const multiplicityRules: Required<SlotMultiplicityRules> = {
    slotId,
    durationMultiplicitySec: multiplicityStepSeconds,
    minDurationSec: minDurationSeconds,
    maxDurationSec: maxDurationSeconds,
    spotsMultiplicityStep,
    minSpots: Math.max(1, Math.min(spotsIncluded, spotsMultiplicityStep)),
    maxSpots: Math.max(spotsIncluded * 3, 200),
  };

  return {
    slotId,
    baseQuotaDurationSeconds,
    spotsIncluded,
    stationPriceBasis,
    stationPriceRub: Math.round(stationPriceRub * 100) / 100,
    stationRatePerSecRub: Math.round(stationRatePerSecRub * 100) / 100,
    officialRatePerSecRub: Math.round(officialRatePerSecRub * 100) / 100,
    multiplicityStepSeconds,
    minDurationSeconds,
    maxDurationSeconds,
    spotsMultiplicityStep,
    roundingPolicy,
    agencyMargin,
    marginModel,
    multiplicityRules,
    calculateCost(
      durationSeconds: number,
      overrideStationPrice?: number | StationTariffDescriptor,
      overrideMargin?: number,
      callOptions: CalculateCostOptions = {}
    ): SecondBasedCostResult {
      const effectiveStationPrice =
        overrideStationPrice !== undefined ? overrideStationPrice : stationPriceRub;
      const effectiveMargin = overrideMargin !== undefined ? overrideMargin : agencyMargin;
      const effectiveBasis = callOptions.stationPriceBasis ?? stationPriceBasis;

      return calculateCost(durationSeconds, effectiveStationPrice, effectiveMargin, {
        spotsCount: callOptions.spotsCount ?? spotsIncluded,
        stationPriceBasis: effectiveBasis,
        basePackageSpots: callOptions.basePackageSpots ?? spotsIncluded,
        basePackageDurationSec:
          callOptions.basePackageDurationSec ?? baseQuotaDurationSeconds,
        baseQuotaDurationSeconds:
          callOptions.baseQuotaDurationSeconds ?? baseQuotaDurationSeconds,
        marginUnit: callOptions.marginUnit ?? 'auto',
        marginModel: callOptions.marginModel ?? marginModel,
        roundingPolicy: callOptions.roundingPolicy ?? roundingPolicy,
        officialRatePerSecRub:
          callOptions.officialRatePerSecRub ??
          (overrideStationPrice === undefined ? officialRatePerSecRub : undefined),
        multiplicityRules: {
          ...multiplicityRules,
          ...(callOptions.multiplicityRules ?? {}),
        },
      });
    },
  };
}

/**
 * Формирует структуру `SecondBasedPricing` из карточки эфирного слота `RadioInventorySlot`.
 */
export function createSecondBasedPricingFromSlot(
  slot: RadioInventorySlot
): SecondBasedPricing {
  const rules = extractSlotMultiplicityRules(slot);
  const rates = resolveSlotPerSecondRates(slot);

  return createSecondBasedPricing({
    slotId: slot.id,
    baseQuotaDurationSeconds: rates.referenceDurationSec,
    spotsIncluded: slot.spotsIncluded,
    stationPriceBasis: 'per_second',
    stationPriceRub: rates.stationNetRatePerSecRub,
    stationRatePerSecRub: rates.stationNetRatePerSecRub,
    officialRatePerSecRub: rates.officialRatePerSecRub,
    multiplicityStepSeconds: rules.durationMultiplicitySec,
    minDurationSeconds: rules.minDurationSec,
    maxDurationSeconds: rules.maxDurationSec,
    spotsMultiplicityStep: rules.spotsMultiplicityStep,
    roundingPolicy: 'ceil_to_multiplicity',
    agencyMargin: rates.fmworksMarginPercent,
    marginModel: 'markup',
  });
}

function withSlotSecondBasedPricing(slot: RadioInventorySlot): RadioInventorySlot {
  return {
    ...slot,
    secondBasedPricing: createSecondBasedPricingFromSlot(slot),
  };
}

/**
 * Базовый экземпляр `SecondBasedPricing` для прямого посекундного пересчёта квот.
 */
export const secondBasedPricing: SecondBasedPricing = createSecondBasedPricing({
  slotId: 'default-second-based-pricing',
  baseQuotaDurationSeconds: 1,
  spotsIncluded: 1,
  stationPriceBasis: 'per_second',
  stationPriceRub: 0,
  multiplicityStepSeconds: 1,
  minDurationSeconds: MIN_BILLABLE_SPOT_SECONDS,
  maxDurationSeconds: MAX_BILLABLE_SPOT_SECONDS,
  spotsMultiplicityStep: 1,
  roundingPolicy: 'ceil_to_multiplicity',
  agencyMargin: DEFAULT_FMWORKS_MARGIN_PERCENT,
  marginModel: 'markup',
});

export const perSecondAirPricingEngine: PerSecondAirPricingEngine = {
  validateSlotMultiplicity,
  calculateDynamicAirPrice,
  calculateCost,
  createSecondBasedPricing,
  calculateSlotPriceForUniqueChronometry,
  evaluateInventoryForChronometry,
};

/**
 * Реалистичная тестовая выгрузка от сейлз-хауса радиостанций (Telegram / почта)
 * для проверки парсера в 1 клик (включает как квоты >=24ч под съёмку ролика, так и сверхсрочный пакет 9ч).
 */
export const SAMPLE_RADIO_SALES_DUMP = [
  'Коллеги FMWorks, отдаём горящие остатки на ближайшие дни (снялась бронь федерального дилера):',
  '1) Серебряный Дождь 100.1 FM | Вечерний драйв 17:30–20:30 | Пн–Пт | 14 выходов | до 30 сек | по прайсу 185 000 ₽ -> нетто 84 000 ₽ | OTS 240 000 | дедлайн 28ч',
  '2) Relax FM 90.8 FM | Утренний прайм 07:30–10:30 | Ср–Вс | 16 выходов | до 30 сек | прайс 172 000 ₽ -> нетто 79 000 ₽ | OTS 335 000 | дедлайн 30ч',
  '3) Радио Jazz 89.1 FM | Спонсорство пробок/погоды | Пн–Пт | 12 выходов | до 15 сек | прайс 148 000 ₽ -> нетто 68 000 ₽ | OTS 195 000 | дедлайн 9ч',
].join('\n');

const NICHE_TAG_WEIGHTS: Record<MediaClientNiche, Partial<Record<AudienceTag, number>>> = {
  real_estate: {
    real_estate: 44,
    premium: 26,
    b2b: 14,
    auto: 8,
  },
  b2b_finance: {
    b2b: 48,
    premium: 24,
    real_estate: 12,
    auto: 8,
  },
  fmcg_retail: {
    fmcg: 46,
    mass: 28,
    auto: 12,
    medicine: 8,
  },
  medicine: {
    medicine: 48,
    mass: 22,
    premium: 14,
    fmcg: 10,
  },
  auto_services: {
    auto: 48,
    mass: 22,
    b2b: 14,
    fmcg: 10,
  },
};

/**
 * Синхронизация профиля LayaDecisionEngine с нишей медиапланера.
 */
export function mapLayaPersonaToMediaNiche(persona: LayaPersona): MediaClientNiche {
  if (persona === 'real_estate') return 'real_estate';
  if (persona === 'fmcg') return 'fmcg_retail';
  if (persona === 'returning_vip') return 'b2b_finance';
  if (persona === 'price_searcher') return 'fmcg_retail';
  return 'real_estate';
}

/**
 * Извлекает точную целевую нишу конструктора эфира из решения Laya AI
 * (включая прямые сигналы `Девелопмент и ЖК`, `Ритейл и FMCG`, `Медицина`, `B2B`, `Авто`).
 */
export function resolveMediaNicheFromLaya(
  decision: Pick<LayaDecision, 'choice' | 'mediaNiche'>
): MediaClientNiche {
  if (decision.mediaNiche) {
    return decision.mediaNiche;
  }
  return mapLayaPersonaToMediaNiche(decision.choice);
}

export function computeSlotDiscountPercent(
  slot: Pick<RadioInventorySlot, 'officialPrice' | 'hotPrice'>
): number {
  if (slot.officialPrice <= 0 || slot.hotPrice >= slot.officialPrice) return 0;
  return Math.round(((slot.officialPrice - slot.hotPrice) / slot.officialPrice) * 100);
}

/**
 * Разбирает строковый шаблон дней (`Пн–Пт`, `Ср–Вс`, `Пн–Сб`, `Сб–Вс` и т.д.)
 * в массив ISO-номеров дней недели (`[1, 2, 3, 4, 5]` = Пн–Пт, `[3, 4, 5, 6, 7]` = Ср–Вс).
 */
export function resolveWeekdayNumbers(daysPattern: string): WeekdayNumber[] {
  const norm = daysPattern.trim().toUpperCase().replace(/—/g, '–').replace(/-/g, '–');
  const mapToken = (token: string): number => {
    if (token.startsWith('ПН')) return 1;
    if (token.startsWith('ВТ')) return 2;
    if (token.startsWith('СР')) return 3;
    if (token.startsWith('ЧТ')) return 4;
    if (token.startsWith('ПТ')) return 5;
    if (token.startsWith('СБ')) return 6;
    if (token.startsWith('ВС')) return 7;
    return -1;
  };

  if (norm.includes('ЕЖЕДН') || norm.includes('ПН–ВС')) {
    return [...ALL_WEEKDAY_NUMBERS];
  }

  const rangeParts = norm.split('–');
  if (rangeParts.length === 2) {
    const startNum = mapToken(rangeParts[0].trim());
    const endNum = mapToken(rangeParts[1].trim());
    if (startNum >= 1 && endNum >= startNum) {
      return ALL_WEEKDAY_NUMBERS.filter((num) => num >= startNum && num <= endNum);
    }
  }

  const matched = ALL_WEEKDAY_NUMBERS.filter((num) => norm.includes(ALL_WEEKDAYS[num - 1]));
  return matched.length > 0 ? matched : [1, 2, 3, 4, 5];
}

/**
 * Разбирает строковый шаблон дней или числовой массив `weekdays`
 * в коды дней недели `ПН ВТ СР ЧТ ПТ СБ ВС`.
 */
export function resolveActiveWeekdays(
  daysPatternOrWeekdays: string | readonly WeekdayNumber[]
): WeekdayCode[] {
  if (Array.isArray(daysPatternOrWeekdays)) {
    const valid = daysPatternOrWeekdays.filter(
      (n): n is WeekdayNumber => typeof n === 'number' && n >= 1 && n <= 7
    );
    return valid.length > 0
      ? valid.map((n) => ALL_WEEKDAYS[n - 1])
      : ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ'];
  }
  return resolveWeekdayNumbers(daysPatternOrWeekdays as string).map((n) => ALL_WEEKDAYS[n - 1]);
}

export interface BroadcastChessboardCell {
  weekday: WeekdayNumber;
  weekdayLabel: WeekdayCode;
  timeSlot: string;
  spotsCount: number;
}

/**
 * Раскладывает квоту станции по точным ячейкам «день недели × тайм-слот»
 * так, чтобы сумма выходов в шахматке строго равнялась `slot.spotsIncluded`.
 */
export function expandSlotBroadcastGrid(slot: RadioInventorySlot): BroadcastChessboardCell[] {
  const days =
    Array.isArray(slot.weekdays) && slot.weekdays.length > 0
      ? slot.weekdays
      : resolveWeekdayNumbers(slot.daysPattern);
  const times =
    Array.isArray(slot.sampleTimeSlots) && slot.sampleTimeSlots.length > 0
      ? slot.sampleTimeSlots
      : ['08:20', '09:15', '18:40'];

  const candidatePairs: { weekday: WeekdayNumber; timeSlot: string }[] = [];
  for (const timeSlot of times) {
    for (const weekday of days) {
      candidatePairs.push({ weekday, timeSlot });
    }
  }

  const totalCells = candidatePairs.length;
  if (totalCells === 0 || slot.spotsIncluded <= 0) return [];

  const counts = new Array<number>(totalCells).fill(0);
  for (let s = 0; s < slot.spotsIncluded; s += 1) {
    counts[s % totalCells] += 1;
  }

  return candidatePairs
    .map((pair, idx) => ({
      weekday: pair.weekday,
      weekdayLabel: ALL_WEEKDAYS[pair.weekday - 1],
      timeSlot: pair.timeSlot,
      spotsCount: counts[idx],
    }))
    .filter((cell) => cell.spotsCount > 0);
}

/**
 * Определяет режим готовности ролика и минимально допустимый запас часов до эфира:
 * - «Нужно снять ролик за 24ч» -> `deadlineHours >= 24`
 * - «Готовый ролик с паспортом» -> `deadlineHours >= 6`
 */
export function resolveSpotReadinessMode(
  durationPref: SpotDurationPreference,
  explicitMode?: SpotReadinessMode
): SpotReadinessMode {
  if (explicitMode) return explicitMode;
  return durationPref === 'ready_spot' ? 'ready_with_passport' : 'need_production_24h';
}

export function resolveMinDeadlineGateHours(readinessMode: SpotReadinessMode): number {
  return readinessMode === 'ready_with_passport'
    ? READY_SPOT_INGEST_GATE_HOURS
    : PRODUCTION_MODERATION_GATE_HOURS;
}

/**
 * Правило эффективной частоты медиабайера:
 * Ограничивает максимальное число станций в зависимости от бюджета,
 * чтобы не размазывать 100–250 тыс. ₽ тонким слоем по 4–5 разным радиостанциям.
 */
export function resolveMaxStationsForBudget(totalBudgetRub: number): number {
  if (totalBudgetRub <= 165_000) return 1;
  if (totalBudgetRub <= FOCUSED_BUDGET_CEILING_RUB) return 2;
  if (totalBudgetRub <= 450_000) return 3;
  if (totalBudgetRub <= 750_000) return 5;
  return 8;
}

/**
 * Оценивает релевантность радиослота под нишу клиента (`0..100%`),
 * синхронизированную с текущим профилем `LayaDecisionEngine` и текстовым уточнением продукта.
 */
export function computeSlotAffinity(
  slot: RadioInventorySlot,
  niche: MediaClientNiche,
  layaPersona: LayaPersona = 'default',
  productNote = ''
): number {
  const weights = NICHE_TAG_WEIGHTS[niche];
  let rawScore = 30;

  for (const tag of slot.audienceTags) {
    rawScore += weights[tag] ?? 0;
  }

  // Бонус за соответствие прайм-тайма задаче бизнеса
  if (
    (niche === 'b2b_finance' || niche === 'real_estate') &&
    (slot.daypart.includes('Утренний') || slot.daypart.includes('Вечерний'))
  ) {
    rawScore += 6;
  } else if (
    (niche === 'fmcg_retail' || niche === 'medicine') &&
    (slot.daypart.includes('Дневной') || slot.daypart.includes('пробок'))
  ) {
    rawScore += 5;
  } else if (
    niche === 'auto_services' &&
    (slot.daypart.includes('пробок') || slot.daypart.includes('Утренний') || slot.daypart.includes('Вечерний'))
  ) {
    rawScore += 7;
  }

  // Синхронизация с активным профилем LayaDecisionEngine
  if (layaPersona === 'real_estate' && slot.audienceTags.includes('premium')) {
    rawScore += 4;
  } else if (layaPersona === 'fmcg' && slot.audienceTags.includes('fmcg')) {
    rawScore += 4;
  } else if (layaPersona === 'price_searcher' && computeSlotDiscountPercent(slot) >= 38) {
    rawScore += 5;
  } else if (
    layaPersona === 'returning_vip' &&
    (slot.daypart.includes('Утренний') || slot.daypart.includes('Вечерний'))
  ) {
    rawScore += 4;
  }

  // Тонкая подстройка по текстовому уточнению продукта клиента
  const note = productNote.trim().toLowerCase();
  if (note.length >= 3) {
    if (
      (note.includes('премиум') || note.includes('бизнес') || note.includes('клубн')) &&
      slot.audienceTags.includes('premium')
    ) {
      rawScore += 5;
    }
    if (
      (note.includes('клиник') || note.includes('стомат') || note.includes('чекап') || note.includes('врач')) &&
      slot.audienceTags.includes('medicine')
    ) {
      rawScore += 6;
    }
    if (
      (note.includes('авто') || note.includes('дилер') || note.includes('шины') || note.includes('сервис')) &&
      slot.audienceTags.includes('auto')
    ) {
      rawScore += 6;
    }
    if (
      (note.includes('доставк') || note.includes('сети') || note.includes('продукт') || note.includes('кофе')) &&
      slot.audienceTags.includes('fmcg')
    ) {
      rawScore += 5;
    }
    if (
      (note.includes('банк') || note.includes('лизинг') || note.includes('b2b') || note.includes('инвест')) &&
      slot.audienceTags.includes('b2b')
    ) {
      rawScore += 6;
    }
  }

  return Math.max(42, Math.min(99, Math.round(rawScore)));
}

export interface ScoredRadioSlot {
  slot: RadioInventorySlot;
  affinity: number;
  discountPercent: number;
  /** 1 = профильное ядро ЦА, 2 = охватная станция второго эшелона */
  tier: 1 | 2;
  /** Сверхсрочная квота с выходом завтра (`6 <= deadlineHours < 24`) */
  isUltraUrgent: boolean;
  isEligibleForTimeGate: boolean;
  isEligibleForDuration: boolean;
  isEffectiveFrequency: boolean;
}

export interface MediaGridPlanResult {
  niche: MediaClientNiche;
  totalBudget: number;
  durationPref: SpotDurationPreference;
  spotReadinessMode: SpotReadinessMode;
  minRequiredDeadlineHours: number;
  scoredSlots: ScoredRadioSlot[];
  /** Слоты <24ч, скрытые тайм-гейтом при выборе записи ролика за 24ч */
  lockedUrgentSlots: RadioInventorySlot[];
  selectedSlots: ScoredRadioSlot[];
  selectedSlotIds: string[];
  totalSpots: number;
  totalReachOTS: number;
  /** Оценка захвата профильной целевой радиоаудитории ниши (в %) */
  targetAudienceSharePct: number;
  officialAirTotal: number;
  hotAirTotal: number;
  baseProductionPrice: number;
  effectiveProductionPrice: number;
  productionOriginalValue: number;
  isBonusProductionUnlocked: boolean;
  productionTitle: string;
  totalClientCost: number;
  totalSavingsRub: number;
  remainingToBonusRub: number;
  minDeadlineHours: number | null;
  /** Короткое экспертное резюме ИИ-медиабайера (2–3 предложения) под конкретный выбор клиента */
  aiRationale: string;
}

export function resolveBaseProductionSpec(durationPref: SpotDurationPreference): {
  basePrice: number;
  label: string;
} {
  if (durationPref === 'ready_spot') {
    return {
      basePrice: 0,
      label: 'Готовый ролик клиента · проверка юриста и паспорта прав',
    };
  }
  if (durationPref === '15') {
    return {
      basePrice: EXPRESS_15S_PRODUCTION_RUB,
      label: 'Экспресс-производство ролика 15 сек за 24 часа',
    };
  }
  return {
    basePrice: TURNKEY_30S_PRODUCTION_RUB,
    label: 'Экспресс-производство ролика «Под ключ» 30 сек за 24 часа',
  };
}

const NICHE_AUDIENCE_CONTEXT: Record<
  MediaClientNiche,
  {
    segmentGenitive: string;
    whyContext: string;
  }
> = {
  real_estate: {
    segmentGenitive: 'покупателей недвижимости и бизнес-класса',
    whyContext:
      'платёжеспособные покупатели квартир и инвесторы слушают эфир без визуального шума по пути в офис и домой',
  },
  b2b_finance: {
    segmentGenitive: 'собственников бизнеса и ЛПР',
    whyContext:
      'руководители и финансовые директора включены в деловую повестку и аналитику рынков за рулём',
  },
  fmcg_retail: {
    segmentGenitive: 'городских покупателей и семейного ритейла',
    whyContext:
      'контакт происходит непосредственно перед ежедневными покупками, в поездках и активном дневном трафике',
  },
  medicine: {
    segmentGenitive: 'взрослой семейной аудитории клиник',
    whyContext:
      'спокойная подача в этих блоках формирует высокое базовое доверие к врачебным услугам и диагностике',
  },
  auto_services: {
    segmentGenitive: 'активных автовладельцев',
    whyContext:
      'сообщение застаёт водителей прямо за рулём на пике дорожных сводок и часов пик',
  },
};

function summarizeSelectedDayparts(selectedSlots: readonly ScoredRadioSlot[]): string {
  const hasMorning = selectedSlots.some((s) => s.slot.daypart.includes('Утренний'));
  const hasEvening = selectedSlots.some((s) => s.slot.daypart.includes('Вечерний'));
  const hasTraffic = selectedSlots.some((s) => s.slot.daypart.includes('пробок'));
  const hasDay = selectedSlots.some((s) => s.slot.daypart.includes('Дневной'));

  const parts: string[] = [];
  if (hasMorning) parts.push('утренний прайм');
  if (hasTraffic) parts.push('спонсорство трафика и погоды');
  if (hasEvening) parts.push('вечерний драйв');
  if (hasDay) parts.push('дневной охватный блок');

  return parts.length > 0 ? parts.join(' + ') : 'прайм-слоты будней';
}

/**
 * Вычисляет реалистичную долю захвата активной целевой радиоаудитории ниши (`0..95%`)
 * с учётом дедупликации пересечения станций, плотности выходов и индекса соответствия ЦА.
 */
export function computeTargetAudienceSharePct(
  selectedSlots: readonly ScoredRadioSlot[]
): number {
  if (selectedSlots.length === 0) return 0;

  // Накопительная кривая непересекающегося захвата ниши: каждая следующая станция добирает остаток ЦА
  const sortedByAffinity = [...selectedSlots].sort((a, b) => b.affinity - a.affinity);
  let unreachedShare = 1.0;

  sortedByAffinity.forEach((item, idx) => {
    const affinityRatio = item.affinity / 100;
    const reachFactor = Math.min(1.18, 0.68 + item.slot.reachOTS / 1_100_000);
    const freqFactor = Math.min(1.12, item.slot.spotsIncluded / 15);
    const incrementalPenetration = Math.min(
      0.58,
      (idx === 0 ? 0.48 : 0.29) * affinityRatio * reachFactor * freqFactor
    );
    unreachedShare *= 1 - incrementalPenetration;
  });

  const capturedPct = Math.round((1 - unreachedShare) * 100);
  return Math.max(38, Math.min(95, capturedPct));
}

/**
 * Генерирует короткое экспертное резюме ИИ-медиапланера (строго 2–3 предложения)
 * с объяснением связки станций и тайм-слотов, процентом захвата ЦА и суммой экономии.
 */
export function generateMediaBuyerRationale(params: {
  niche: MediaClientNiche;
  spotReadinessMode: SpotReadinessMode;
  selectedSlots: readonly ScoredRadioSlot[];
  totalSpots: number;
  totalReachOTS: number;
  targetAudienceSharePct: number;
  officialAirTotal: number;
  hotAirTotal: number;
  totalSavingsRub: number;
  isBonusProductionUnlocked: boolean;
  minDeadlineHours: number | null;
}): string {
  const {
    niche,
    spotReadinessMode,
    selectedSlots,
    totalSpots,
    totalReachOTS,
    targetAudienceSharePct,
    officialAirTotal,
    hotAirTotal,
    totalSavingsRub,
    isBonusProductionUnlocked,
    minDeadlineHours,
  } = params;

  const ctx = NICHE_AUDIENCE_CONTEXT[niche];

  if (selectedSlots.length === 0) {
    return `Сейчас в медиаплане не выбрано ни одной радиостанции. Включите 1–2 профильные квоты (от 12 выходов на станцию), чтобы сфокусировать эффективную частоту на сегменте ${ctx.segmentGenitive} без распыления бюджета.`;
  }

  const daypartPhrase = summarizeSelectedDayparts(selectedSlots);
  const tier1 = selectedSlots.filter((s) => s.tier === 1);
  const tier2 = selectedSlots.filter((s) => s.tier === 2);

  let sentence1: string;
  if (selectedSlots.length <= 2) {
    const names = selectedSlots.map((s) => s.slot.station).join(' и ');
    sentence1 = `Вместо распыления бюджета тонким слоем сфокусировали плотный удар из ${totalSpots} выходов на ${names} (${daypartPhrase}), где ${ctx.whyContext}.`;
  } else if (tier1.length > 0 && tier2.length > 0) {
    const coreNames = tier1.map((s) => s.slot.station).join(', ');
    const reachNames = tier2.map((s) => s.slot.station).join(', ');
    sentence1 = `Ядро сетки собрано на целевых ${coreNames} и усилено охватным вторым эшелоном (${reachNames}) в связке «${daypartPhrase}» (${totalSpots} плотных выходов), где ${ctx.whyContext}.`;
  } else {
    const topNames = selectedSlots.map((s) => s.slot.station).join(', ');
    sentence1 = `Скомбинировали костяк из ${selectedSlots.length} станций (${topNames}) в окнах «${daypartPhrase}» с эффективной частотой ${totalSpots} выходов — именно там ${ctx.whyContext}.`;
  }

  const hasUrgentTomorrowSlot = selectedSlots.some(
    (s) => s.slot.deadlineHours >= READY_SPOT_INGEST_GATE_HOURS && s.slot.deadlineHours < PRODUCTION_MODERATION_GATE_HOURS
  );

  let gateClause = '';
  if (spotReadinessMode === 'ready_with_passport' && hasUrgentTomorrowSlot) {
    gateClause = ', включая сверхсрочные квоты с выходом завтра утром за счёт готового паспорта ролика';
  } else if (spotReadinessMode === 'need_production_24h' && minDeadlineHours !== null) {
    gateClause = ` с гарантированным запасом ${minDeadlineHours} ч на запись ролика и модерацию юристов станций`;
  }

  const sentence2 = `Связка захватывает до ${targetAudienceSharePct}% профильной аудитории ${ctx.segmentGenitive} (${formatNumberSpaced(totalReachOTS)} контактов OTS)${gateClause}.`;

  const avgDiscountPct =
    officialAirTotal > 0
      ? Math.round(((officialAirTotal - hotAirTotal) / officialAirTotal) * 100)
      : 0;

  const sentence3 = isBonusProductionUnlocked
    ? `За счёт выкупа горящих квот (−${avgDiscountPct}% от прайса) и включения ролика «Под ключ» за 0 ₽ по агентской квоте вы экономите ${formatRubCompact(totalSavingsRub)}.`
    : `Прямая экономия бюджета за счёт горящих слотов со скидкой −${avgDiscountPct}% от официального прайса станций составляет ${formatRubCompact(totalSavingsRub)}.`;

  return `${sentence1} ${sentence2} ${sentence3}`;
}

/**
 * Считает финансовую сводку «Единого окна запуска» и экспертное резюме `aiRationale`
 * для любого набора выбранных слотов (как автоматического AI-подбора, так и ручного выбора).
 */
export function computeMediaPlanSummary(params: {
  niche: MediaClientNiche;
  totalBudget: number;
  durationPref: SpotDurationPreference;
  spotReadinessMode?: SpotReadinessMode;
  lockedUrgentSlots?: readonly RadioInventorySlot[];
  scoredSlots: ScoredRadioSlot[];
  selectedSlotIds: readonly string[];
}): MediaGridPlanResult {
  const {
    niche,
    totalBudget,
    durationPref,
    scoredSlots,
    selectedSlotIds,
    lockedUrgentSlots = [],
  } = params;

  const spotReadinessMode = resolveSpotReadinessMode(durationPref, params.spotReadinessMode);
  const minRequiredDeadlineHours = resolveMinDeadlineGateHours(spotReadinessMode);

  const idSet = new Set(selectedSlotIds);
  const selectedSlots = scoredSlots.filter((item) => idSet.has(item.slot.id));

  const totalSpots = selectedSlots.reduce((acc, item) => acc + item.slot.spotsIncluded, 0);
  const totalReachOTS = selectedSlots.reduce((acc, item) => acc + item.slot.reachOTS, 0);
  const targetAudienceSharePct = computeTargetAudienceSharePct(selectedSlots);
  const officialAirTotal = selectedSlots.reduce((acc, item) => acc + item.slot.officialPrice, 0);
  const hotAirTotal = selectedSlots.reduce((acc, item) => acc + item.slot.hotPrice, 0);

  const baseSpec = resolveBaseProductionSpec(durationPref);
  const isBonusProductionUnlocked = hotAirTotal >= AIR_BONUS_THRESHOLD_RUB;

  const effectiveProductionPrice = isBonusProductionUnlocked ? 0 : baseSpec.basePrice;
  const productionOriginalValue = isBonusProductionUnlocked
    ? TURNKEY_30S_PRODUCTION_RUB
    : baseSpec.basePrice;

  const productionTitle = isBonusProductionUnlocked
    ? 'Ролик «Под ключ» (25 000 ₽) — 0 ₽ за счёт агентской квоты FMWorks'
    : baseSpec.label;

  const airSavings = Math.max(0, officialAirTotal - hotAirTotal);
  const productionBonusSavings = isBonusProductionUnlocked ? TURNKEY_30S_PRODUCTION_RUB : 0;
  const totalSavingsRub = airSavings + productionBonusSavings;
  const totalClientCost = hotAirTotal + effectiveProductionPrice;
  const remainingToBonusRub = Math.max(0, AIR_BONUS_THRESHOLD_RUB - hotAirTotal);

  const minDeadlineHours =
    selectedSlots.length > 0
      ? selectedSlots.reduce(
          (minVal, item) => Math.min(minVal, item.slot.deadlineHours),
          selectedSlots[0].slot.deadlineHours
        )
      : null;

  const aiRationale = generateMediaBuyerRationale({
    niche,
    spotReadinessMode,
    selectedSlots,
    totalSpots,
    totalReachOTS,
    targetAudienceSharePct,
    officialAirTotal,
    hotAirTotal,
    totalSavingsRub,
    isBonusProductionUnlocked,
    minDeadlineHours,
  });

  return {
    niche,
    totalBudget,
    durationPref,
    spotReadinessMode,
    minRequiredDeadlineHours,
    scoredSlots,
    lockedUrgentSlots: [...lockedUrgentSlots],
    selectedSlots,
    selectedSlotIds: selectedSlots.map((item) => item.slot.id),
    totalSpots,
    totalReachOTS,
    targetAudienceSharePct,
    officialAirTotal,
    hotAirTotal,
    baseProductionPrice: baseSpec.basePrice,
    effectiveProductionPrice,
    productionOriginalValue,
    isBonusProductionUnlocked,
    productionTitle,
    totalClientCost,
    totalSavingsRub,
    remainingToBonusRub,
    minDeadlineHours,
    aiRationale,
  };
}

export interface BuildOptimalGridOptions {
  layaPersona?: LayaPersona;
  productNote?: string;
  /** Явный статус готовности ролика (если не передан — определяется автоматически из `durationPref`) */
  spotStatus?: SpotReadinessMode;
  slots?: readonly RadioInventorySlot[];
}

/**
 * Профессиональный алгоритм сборки эфирной сетки медиабайера (2D ДП по бюджету и лимиту станций):
 * 1) Правило эффективной частоты: защищает бюджет 100–250 тыс. ₽ от размазывания по 4–5 станциям,
 *    концентрируя удар на 1–2 целевых станциях с плотной частотой (12–20 выходов), а с ростом бюджета
 *    подключает охватные радиостанции второго эшелона.
 * 2) Тайм-гейт модерации: при заказе ролика за 24ч оставляет только квоты `deadlineHours >= 24`,
 *    а при готовом ролике с паспортом открывает сверхсрочные слоты на завтра (`deadlineHours >= 6`) с доп. скидкой.
 * 3) Коммерческий бонус: при сумме эфира `>= 400 000 ₽` включает ролик «Под ключ (25 000 ₽)» за `0 ₽`.
 * 4) Формирует экспертное резюме `aiRationale` (2–3 предложения) под собранную связку.
 */
export function buildOptimalMediaGrid(
  niche: MediaClientNiche,
  totalBudget: number,
  durationPref: SpotDurationPreference,
  options: BuildOptimalGridOptions = {}
): MediaGridPlanResult {
  const clampedBudget = Math.max(
    MIN_MEDIA_BUDGET_RUB,
    Math.min(MAX_MEDIA_BUDGET_RUB, Math.round(totalBudget))
  );
  const layaPersona = options.layaPersona ?? 'default';
  const productNote = options.productNote ?? '';
  const spotReadinessMode = resolveSpotReadinessMode(durationPref, options.spotStatus);
  const minRequiredDeadlineHours = resolveMinDeadlineGateHours(spotReadinessMode);
  const sourceSlots = options.slots ?? radioInventoryStore.getActiveSlots();

  const visibleSlots = sourceSlots.filter((s) => !s.isHidden);

  const lockedUrgentSlots = visibleSlots.filter(
    (s) =>
      s.deadlineHours >= READY_SPOT_INGEST_GATE_HOURS &&
      s.deadlineHours < minRequiredDeadlineHours
  );

  const allScored: ScoredRadioSlot[] = visibleSlots
    .map((slot) => {
      const affinity = computeSlotAffinity(slot, niche, layaPersona, productNote);
      const discountPercent = computeSlotDiscountPercent(slot);
      const tier: 1 | 2 = affinity >= 78 ? 1 : 2;
      const isUltraUrgent =
        slot.deadlineHours >= READY_SPOT_INGEST_GATE_HOURS &&
        slot.deadlineHours < PRODUCTION_MODERATION_GATE_HOURS;
      const isEligibleForTimeGate = slot.deadlineHours >= minRequiredDeadlineHours;
      const isEligibleForDuration =
        durationPref === '30' ? slot.maxDuration >= 30 : slot.maxDuration >= 15;
      const isEffectiveFrequency = slot.spotsIncluded >= MIN_EFFECTIVE_SPOTS_PER_SLOT;

      return {
        slot,
        affinity,
        discountPercent,
        tier,
        isUltraUrgent,
        isEligibleForTimeGate,
        isEligibleForDuration,
        isEffectiveFrequency,
      };
    })
    .filter((item) => item.isEligibleForTimeGate)
    .sort((a, b) => {
      if (a.isEligibleForDuration !== b.isEligibleForDuration) {
        return a.isEligibleForDuration ? -1 : 1;
      }
      if (b.affinity !== a.affinity) {
        return b.affinity - a.affinity;
      }
      return b.discountPercent - a.discountPercent;
    });

  // Отсекаем слоты с неэффективной частотой (<10 выходов), если в базе есть нормальные пакетные квоты
  const durationEligible = allScored.filter((item) => item.isEligibleForDuration);
  const denseCandidates = durationEligible.filter((item) => item.isEffectiveFrequency);
  const eligible = denseCandidates.length > 0 ? denseCandidates : durationEligible;

  const baseProd = resolveBaseProductionSpec(durationPref).basePrice;
  const maxStations = resolveMaxStationsForBudget(clampedBudget);
  const isFocusedSmallBudget = clampedBudget <= FOCUSED_BUDGET_CEILING_RUB;

  // 2D динамическое программирование: шаг бюджета 1 000 ₽ × число станций k (1..maxStations)
  const STEP = 1_000;
  const maxSteps = Math.floor(clampedBudget / STEP);
  const stride = maxStations + 1;
  const dpScore = new Float64Array((maxSteps + 1) * stride).fill(-1);
  const dpChoice: number[][][] = Array.from({ length: maxSteps + 1 }, () =>
    Array.from({ length: stride }, () => [])
  );
  dpScore[0] = 0;

  for (let i = 0; i < eligible.length; i += 1) {
    const candidate = eligible[i];
    const costSteps = Math.max(1, Math.ceil(candidate.slot.hotPrice / STEP));
    if (costSteps > maxSteps) continue;

    const affinityNorm = candidate.affinity / 100;
    const durationFitFactor =
      durationPref === '15' && candidate.slot.maxDuration === 15 ? 1.05 : 1.0;

    // Плотная частота (12–20+ выходов) вознаграждается, мелкие пакеты штрафуются
    const frequencyFactor =
      candidate.slot.spotsIncluded >= 16
        ? 1.08
        : candidate.slot.spotsIncluded >= 12
          ? 1.02
          : candidate.slot.spotsIncluded >= MIN_EFFECTIVE_SPOTS_PER_SLOT
            ? 0.88
            : 0.25;

    // При малом бюджете (до 250 тыс. ₽) резко приоритизируем станции 1-го эшелона (ядро ЦА),
    // а при росте бюджета даём полноценный вес охвату станций 2-го эшелона
    const tierWeight =
      isFocusedSmallBudget && candidate.tier === 2 ? 0.56 : 1.0;

    const urgentBonusFactor =
      spotReadinessMode === 'ready_with_passport' && candidate.isUltraUrgent ? 1.12 : 1.0;

    const reachWeightPerK = isFocusedSmallBudget ? 22 : 48;

    const utility =
      (candidate.slot.hotPrice *
        (0.24 + Math.pow(affinityNorm, 2.25) * 1.65) *
        durationFitFactor *
        frequencyFactor +
        (candidate.slot.reachOTS / 1000) * reachWeightPerK * affinityNorm +
        candidate.slot.spotsIncluded * 1_150) *
      tierWeight *
      urgentBonusFactor;

    for (let s = maxSteps; s >= costSteps; s -= 1) {
      for (let k = maxStations; k >= 1; k -= 1) {
        const prevIdx = (s - costSteps) * stride + (k - 1);
        const prevScore = dpScore[prevIdx];
        if (prevScore < 0) continue;

        // Защита от дублирования одной и той же радиостанции в одном и том же прайм-блоке
        const prevList = dpChoice[s - costSteps][k - 1];
        const hasDuplicateStationDaypart = prevList.some(
          (pickedIdx) =>
            eligible[pickedIdx].slot.station === candidate.slot.station &&
            eligible[pickedIdx].slot.daypart === candidate.slot.daypart
        );
        if (hasDuplicateStationDaypart) continue;

        const targetIdx = s * stride + k;
        const candidateScore = prevScore + utility;
        if (candidateScore > dpScore[targetIdx]) {
          dpScore[targetIdx] = candidateScore;
          dpChoice[s][k] = [...prevList, i];
        }
      }
    }
  }

  // Выбираем оптимальное состояние (s, k <= maxStations), соблюдающее лимит `airSpend + prodCost <= clampedBudget`
  let bestStep = 0;
  let bestK = 0;
  let bestObjective = -1;

  for (let s = 1; s <= maxSteps; s += 1) {
    for (let k = 1; k <= maxStations; k += 1) {
      const baseScore = dpScore[s * stride + k];
      if (baseScore < 0) continue;

      const pickedIndices = dpChoice[s][k];
      const exactAirSpend = pickedIndices.reduce(
        (sum, idx) => sum + eligible[idx].slot.hotPrice,
        0
      );

      const qualifiesBonus = exactAirSpend >= AIR_BONUS_THRESHOLD_RUB;
      const prodCost = qualifiesBonus ? 0 : baseProd;

      if (exactAirSpend + prodCost > clampedBudget) {
        continue;
      }

      // Поощряем концентрацию частоты при малом бюджете и разблокировку бесплатного ролика при >= 400 000 ₽
      const concentrationBonus =
        isFocusedSmallBudget && k === 1 && pickedIndices[0] !== undefined && eligible[pickedIndices[0]].tier === 1
          ? 14_000
          : 0;
      const bonusUtility = qualifiesBonus && durationPref !== 'ready_spot' ? 42_000 : 0;
      const totalObjective = baseScore + concentrationBonus + bonusUtility;

      if (totalObjective > bestObjective) {
        bestObjective = totalObjective;
        bestStep = s;
        bestK = k;
      }
    }
  }

  const selectedIds =
    bestStep > 0 && bestK > 0
      ? dpChoice[bestStep][bestK].map((idx) => eligible[idx].slot.id)
      : [];

  return computeMediaPlanSummary({
    niche,
    totalBudget: clampedBudget,
    durationPref,
    spotReadinessMode,
    lockedUrgentSlots,
    scoredSlots: allScored,
    selectedSlotIds: selectedIds,
  });
}

export interface ParsedRadioImportPreview {
  slots: RadioInventorySlot[];
  skippedLines: number;
}

function inferTagsAndMetaFromStationName(stationName: string): {
  tags: AudienceTag[];
  frequencyFm: string;
  formatDesc: string;
} {
  const low = stationName.toLowerCase();
  if (
    low.includes('business') ||
    low.includes('бизнес') ||
    low.includes('коммерсант') ||
    low.includes('рбк')
  ) {
    return {
      tags: ['b2b', 'real_estate', 'premium'],
      frequencyFm: low.includes('коммерсант') ? '93.6 FM' : '87.5 FM',
      formatDesc: 'Деловая повестка, собственники бизнеса и инвесторы',
    };
  }
  if (low.includes('серебрян') || low.includes('silver')) {
    return {
      tags: ['real_estate', 'premium', 'b2b', 'auto'],
      frequencyFm: '100.1 FM',
      formatDesc: 'Интеллектуальный эфир и авторские программы для требовательной аудитории',
    };
  }
  if (
    low.includes('relax') ||
    low.includes('релакс') ||
    low.includes('monte') ||
    low.includes('монте')
  ) {
    return {
      tags: ['real_estate', 'medicine', 'premium', 'fmcg'],
      frequencyFm: low.includes('monte') ? '102.1 FM' : '90.8 FM',
      formatDesc: 'Спокойная атмосферная волна для платёжеспособной городской аудитории',
    };
  }
  if (low.includes('jazz') || low.includes('джаз') || low.includes('шоколад')) {
    return {
      tags: ['premium', 'real_estate', 'b2b', 'auto'],
      frequencyFm: '89.1 FM',
      formatDesc: 'Премиальная джазовая классика, высокий доход и статусное потребление',
    };
  }
  if (low.includes('авто') || low.includes('дорожн') || low.includes('шансон')) {
    return {
      tags: ['auto', 'mass', 'fmcg', 'medicine'],
      frequencyFm: low.includes('авто') ? '90.3 FM' : '96.0 FM',
      formatDesc: 'Автомобильный трафик и широкий охват водителей в часах пик',
    };
  }
  return {
    tags: ['fmcg', 'mass', 'auto', 'medicine'],
    frequencyFm: '101.2 FM',
    formatDesc: 'Коммерческая эфирная квота с проверенным охватом аудитории',
  };
}

function inferDaypartAndTimes(line: string): {
  daypart: DaypartLabel;
  sampleTimeSlots: string[];
} {
  const explicitTimes = Array.from(line.matchAll(/\b([01]\d|2[0-3]):[0-5]\d\b/g)).map(
    (m) => m[0]
  );

  const low = line.toLowerCase();
  if (
    low.includes('проб') ||
    low.includes('погод') ||
    low.includes('трафик') ||
    low.includes('спонсор')
  ) {
    return {
      daypart: 'Спонсорство пробок/погоды',
      sampleTimeSlots: explicitTimes.length >= 2 ? explicitTimes : ['08:20', '09:15', '18:40'],
    };
  }
  if (
    low.includes('вечер') ||
    low.includes('драйв') ||
    low.includes('17:') ||
    low.includes('18:')
  ) {
    return {
      daypart: 'Вечерний драйв 17:30–20:30',
      sampleTimeSlots: explicitTimes.length >= 2 ? explicitTimes : ['17:50', '18:35', '19:40'],
    };
  }
  if (
    low.includes('дневн') ||
    low.includes('день') ||
    low.includes('12:') ||
    low.includes('13:')
  ) {
    return {
      daypart: 'Дневной блок 12:00–16:00',
      sampleTimeSlots: explicitTimes.length >= 2 ? explicitTimes : ['12:30', '14:15', '15:35'],
    };
  }
  return {
    daypart: 'Утренний прайм 07:30–10:30',
    sampleTimeSlots: explicitTimes.length >= 2 ? explicitTimes : ['08:15', '09:15', '10:05'],
  };
}

/**
 * Умный парсер сырых сообщений из Telegram / почты от сейлзов радиостанций и CSV/табличных строк.
 * Извлекает станцию, частоту, тайм-слот, дни, число выходов, хронометраж, нетто-стоимость и прайс,
 * автоматически начисляя регулируемую маржу FMWorks (`15%–25%`).
 */
export function parseRawRadioSalesDump(
  rawText: string,
  marginPercent = 20
): ParsedRadioImportPreview {
  const clampedMargin = Math.max(15, Math.min(25, Math.round(marginPercent)));
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const parsedSlots: RadioInventorySlot[] = [];
  let skippedLines = 0;

  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    if (
      (lower.startsWith('коллеги') ||
        lower.startsWith('станция;') ||
        lower.startsWith('station,')) &&
      !/\d{2,3}\s?\d{3}/.test(line)
    ) {
      skippedLines += 1;
      return;
    }

    const semicolonParts = line.split(';').map((p) => p.trim());
    if (semicolonParts.length >= 6 && /^\d+$/.test(semicolonParts[3].replace(/\s+/g, ''))) {
      const stationRaw = semicolonParts[0].replace(/^\d+[.)]\s*/, '');
      const inferred = inferTagsAndMetaFromStationName(stationRaw);
      const daypartInfo = inferDaypartAndTimes(semicolonParts[1]);
      const daysPattern = semicolonParts[2] || 'Пн–Пт';
      const weekdays = resolveWeekdayNumbers(daysPattern);
      const spots = Math.max(4, parseInt(semicolonParts[3].replace(/\D/g, ''), 10) || 14);
      const durNum = parseInt(semicolonParts[4].replace(/\D/g, ''), 10);
      const maxDuration: 15 | 30 = durNum === 15 ? 15 : 30;
      const officialRaw = parseInt(semicolonParts[5].replace(/\D/g, ''), 10) || 170_000;
      const netRaw =
        parseInt((semicolonParts[6] ?? '').replace(/\D/g, ''), 10) ||
        Math.round(officialRaw * 0.5);
      const otsRaw = parseInt((semicolonParts[7] ?? '').replace(/\D/g, ''), 10) || 260_000;
      const deadlineRaw = parseInt((semicolonParts[8] ?? '').replace(/\D/g, ''), 10) || 28;

      const withMargin = Math.round((netRaw * (1 + clampedMargin / 100)) / 1000) * 1000;
      const officialPrice = Math.max(
        officialRaw,
        Math.round(withMargin / 0.68 / 1000) * 1000
      );
      const hotPrice = Math.min(withMargin, Math.round((officialPrice * 0.72) / 1000) * 1000);

      parsedSlots.push({
        id: `imp-${Date.now()}-${index}`,
        station: stationRaw.replace(/\d{2,3}\.\d\s*FM/i, '').trim() || stationRaw,
        frequencyFm: (
          stationRaw.match(/(\d{2,3}\.\d\s*FM)/i)?.[1] ?? inferred.frequencyFm
        ).toUpperCase(),
        formatDesc: inferred.formatDesc,
        audienceTags: inferred.tags,
        daypart: daypartInfo.daypart,
        daysPattern,
        weekdays,
        sampleTimeSlots: daypartInfo.sampleTimeSlots,
        spotsIncluded: spots,
        maxDuration,
        officialPrice,
        hotPrice,
        reachOTS: otsRaw,
        deadlineHours: Math.max(4, Math.min(72, deadlineRaw)),
        isHidden: false,
        sourceKind: 'imported',
      });
      return;
    }

    const cleanedLead = line.replace(/^[-•*\d.)\s]+/, '').trim();
    const pipeSegments = cleanedLead.split(/\s*\|\s*|\s+—\s+/);
    const headSegment = pipeSegments[0] ?? cleanedLead;

    const fmMatch = line.match(/(\d{2,3}[.,]\d)\s*FM/i);
    const stationClean = headSegment
      .replace(/(\d{2,3}[.,]\d)\s*FM/gi, '')
      .replace(/[()]/g, '')
      .split(',')[0]
      .trim();

    if (!stationClean || stationClean.length < 2) {
      skippedLines += 1;
      return;
    }

    const lineWithoutOts = line.replace(
      /(?:ots|охват)\s*[:=-]?\s*\d[\d\s.,]*[кkтыс]*/gi,
      ''
    );
    const moneyMatches = Array.from(
      lineWithoutOts.matchAll(/(\d{2,3}(?:[\s\u00A0]\d{3})+|\d{5,6})\s*(?:₽|руб|р\b)?/gi)
    )
      .map((m) => parseInt(m[1].replace(/\D/g, ''), 10))
      .filter((val) => val >= 30_000 && val <= 990_000);

    if (moneyMatches.length === 0) {
      skippedLines += 1;
      return;
    }

    let officialCandidate: number;
    let netCost: number;
    if (moneyMatches.length >= 2) {
      const sortedDesc = [...moneyMatches].sort((a, b) => b - a);
      officialCandidate = sortedDesc[0];
      netCost = sortedDesc[sortedDesc.length - 1];
    } else {
      netCost = moneyMatches[0];
      officialCandidate =
        Math.round(((netCost * (1 + clampedMargin / 100)) / 0.63) / 1000) * 1000;
    }

    const clientWithMargin = Math.round((netCost * (1 + clampedMargin / 100)) / 1000) * 1000;
    const officialPrice = Math.max(
      officialCandidate,
      Math.round(clientWithMargin / 0.71 / 1000) * 1000
    );
    const hotPrice = Math.min(
      clientWithMargin,
      Math.round((officialPrice * 0.72) / 1000) * 1000
    );

    const spotsMatch = line.match(/(\d{1,3})\s*(?:выход|выпуск|спот|ролик)/i);
    const spotsIncluded = spotsMatch ? Math.max(4, parseInt(spotsMatch[1], 10)) : 14;

    const durMatch = line.match(/(?:до\s*|по\s*)?(15|30)\s*(?:сек|с\b)/i);
    const maxDuration: 15 | 30 = durMatch && durMatch[1] === '15' ? 15 : 30;

    const daysMatch = line.match(
      /(Пн\s*[–-]\s*Пт|Ср\s*[–-]\s*Вс|Пн\s*[–-]\s*Сб|Пн\s*[–-]\s*Вс|Сб\s*[–-]\s*Вс)/i
    );
    const daysPattern = daysMatch
      ? daysMatch[1].replace(/\s+/g, '').replace('-', '–')
      : 'Пн–Пт';
    const weekdays = resolveWeekdayNumbers(daysPattern);

    const otsMatch = line.match(
      /(?:ots|охват)\s*[:=-]?\s*(\d{2,3}(?:[\s\u00A0]\d{3})+|\d{2,4})\s*([кk]|тыс)?/i
    );
    let reachOTS = 260_000;
    if (otsMatch) {
      const rawNum = parseInt(otsMatch[1].replace(/\D/g, ''), 10);
      reachOTS = otsMatch[2] || rawNum < 2000 ? rawNum * 1000 : rawNum;
    }

    const deadlineMatch = line.match(
      /(?:дедлайн|бронь|закрыт\S*|осталось)\s*[:=-]?\s*(\d{1,2})\s*(?:ч|час)/i
    );
    const deadlineHours = deadlineMatch
      ? Math.max(4, Math.min(72, parseInt(deadlineMatch[1], 10)))
      : 28;

    const inferred = inferTagsAndMetaFromStationName(stationClean);
    const daypartInfo = inferDaypartAndTimes(line);

    parsedSlots.push(
      normalizeSlotRecord({
        id: `imp-${Date.now()}-${index}`,
        station: stationClean,
        frequencyFm: fmMatch ? `${fmMatch[1].replace(',', '.')} FM` : inferred.frequencyFm,
        formatDesc: inferred.formatDesc,
        audienceTags: inferred.tags,
        daypart: daypartInfo.daypart,
        daysPattern,
        weekdays,
        sampleTimeSlots: daypartInfo.sampleTimeSlots,
        spotsIncluded,
        maxDuration,
        officialPrice,
        hotPrice,
        reachOTS,
        deadlineHours,
        isHidden: false,
        sourceKind: 'imported',
      })
    );
  });

  return {
    slots: parsedSlots,
    skippedLines,
  };
}

export interface MediaHoldReservationInput {
  contactLine: string;
  companyName: string;
  selectedCount: number;
}

export interface MediaHoldValidationResult {
  valid: boolean;
  contactError?: string;
  slotsError?: string;
}

export function validateMediaHoldReservation(
  input: MediaHoldReservationInput
): MediaHoldValidationResult {
  if (input.selectedCount <= 0) {
    return {
      valid: false,
      slotsError: 'Выберите хотя бы одну радиостанцию в сетке для резерва квоты.',
    };
  }
  const contact = input.contactLine.trim();
  if (contact.length < 4) {
    return {
      valid: false,
      contactError: 'Укажите телефон, @Telegram или рабочую почту для фиксации 4-часовой брони.',
    };
  }
  return { valid: true };
}

function cloneDefaultSlots(): RadioInventorySlot[] {
  return DEFAULT_RADIO_INVENTORY_SLOTS.map((slot) =>
    normalizeSlotRecord({
      ...slot,
      audienceTags: [...slot.audienceTags],
      weekdays: [...slot.weekdays],
      sampleTimeSlots: [...slot.sampleTimeSlots],
    })
  );
}

function normalizeSlotRecord(raw: RadioInventorySlot): RadioInventorySlot {
  const daysPattern = raw.daysPattern || 'Пн–Пт';
  const weekdays =
    Array.isArray(raw.weekdays) && raw.weekdays.length > 0
      ? raw.weekdays
      : resolveWeekdayNumbers(daysPattern);
  const sampleTimeSlots =
    Array.isArray(raw.sampleTimeSlots) && raw.sampleTimeSlots.length > 0
      ? raw.sampleTimeSlots
      : ['08:20', '09:15', '18:40'];

  const normalizedBase: RadioInventorySlot = {
    ...raw,
    daysPattern,
    weekdays,
    sampleTimeSlots,
  };

  return withSlotSecondBasedPricing(normalizedBase);
}

function readStoredSlots(): RadioInventorySlot[] {
  if (typeof window === 'undefined') {
    return cloneDefaultSlots();
  }
  try {
    const raw = window.localStorage.getItem(RADIO_INVENTORY_STORAGE_KEY);
    if (!raw) return cloneDefaultSlots();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return cloneDefaultSlots();
    }
    const valid = parsed
      .filter(
        (item): item is RadioInventorySlot =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.station === 'string' &&
          typeof item.hotPrice === 'number' &&
          typeof item.officialPrice === 'number'
      )
      .map(normalizeSlotRecord);

    return valid.length > 0 ? valid : cloneDefaultSlots();
  } catch {
    return cloneDefaultSlots();
  }
}

function writeStoredSlots(slots: RadioInventorySlot[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RADIO_INVENTORY_STORAGE_KEY, JSON.stringify(slots));
  } catch {
    // Ignore storage quota errors in private mode
  }
}

type InventoryListener = (slots: RadioInventorySlot[]) => void;

export type ManualSlotInput = Omit<
  RadioInventorySlot,
  'id' | 'sourceKind' | 'weekdays'
> & {
  weekdays?: WeekdayNumber[];
};

class RadioInventoryStore {
  private slots: RadioInventorySlot[] = readStoredSlots();
  private listeners = new Set<InventoryListener>();

  getAllSlots(): RadioInventorySlot[] {
    return this.slots;
  }

  getActiveSlots(): RadioInventorySlot[] {
    return this.slots.filter((slot) => !slot.isHidden);
  }

  subscribe(listener: InventoryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private commit(nextSlots: RadioInventorySlot[]): void {
    this.slots = nextSlots;
    writeStoredSlots(nextSlots);
    this.listeners.forEach((fn) => fn(this.slots));
  }

  prependImportedSlots(newSlots: RadioInventorySlot[]): void {
    if (newSlots.length === 0) return;
    this.commit([...newSlots.map(normalizeSlotRecord), ...this.slots]);
  }

  addManualSlot(slot: ManualSlotInput): RadioInventorySlot {
    const daysPattern = slot.daysPattern || 'Пн–Пт';
    const created = normalizeSlotRecord({
      ...slot,
      daysPattern,
      weekdays:
        slot.weekdays && slot.weekdays.length > 0
          ? [...slot.weekdays]
          : resolveWeekdayNumbers(daysPattern),
      id: `manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sourceKind: 'manual',
    });
    this.commit([created, ...this.slots]);
    return created;
  }

  updateSlot(
    slotId: string,
    patch: Partial<
      Pick<
        RadioInventorySlot,
        | 'hotPrice'
        | 'officialPrice'
        | 'spotsIncluded'
        | 'deadlineHours'
        | 'isHidden'
        | 'daysPattern'
        | 'weekdays'
        | 'sampleTimeSlots'
      >
    >
  ): void {
    const next = this.slots.map((item) => {
      if (item.id !== slotId) return item;
      const updatedHot =
        patch.hotPrice !== undefined
          ? Math.max(15_000, Math.round(patch.hotPrice))
          : item.hotPrice;
      const updatedOfficial =
        patch.officialPrice !== undefined
          ? Math.max(updatedHot + 5_000, Math.round(patch.officialPrice))
          : Math.max(item.officialPrice, updatedHot + 10_000);
      const nextDaysPattern = patch.daysPattern ?? item.daysPattern;
      const nextWeekdays =
        patch.weekdays ??
        (patch.daysPattern !== undefined
          ? resolveWeekdayNumbers(nextDaysPattern)
          : item.weekdays);

      return normalizeSlotRecord({
        ...item,
        ...patch,
        daysPattern: nextDaysPattern,
        weekdays: nextWeekdays,
        hotPrice: updatedHot,
        officialPrice: updatedOfficial,
        spotsIncluded:
          patch.spotsIncluded !== undefined
            ? Math.max(1, Math.round(patch.spotsIncluded))
            : item.spotsIncluded,
        deadlineHours:
          patch.deadlineHours !== undefined
            ? Math.max(1, Math.round(patch.deadlineHours))
            : item.deadlineHours,
      });
    });
    this.commit(next);
  }

  removeSlot(slotId: string): void {
    const next = this.slots.filter((item) => item.id !== slotId);
    this.commit(next.length > 0 ? next : cloneDefaultSlots());
  }

  resetToDefaults(): void {
    this.commit(cloneDefaultSlots());
  }

  /**
   * Пересчёт эфирной квоты исходя из фактической длительности ролика (`durationSeconds`),
   * прайса станции (`stationPrice`) и наценки агентства (`margin`).
   */
  calculateCost(
    durationSeconds: number,
    stationPrice: number | StationTariffDescriptor,
    margin: number = DEFAULT_FMWORKS_MARGIN_PERCENT,
    options?: CalculateCostOptions
  ): SecondBasedCostResult {
    return calculateCost(durationSeconds, stationPrice, margin, options);
  }

  /**
   * Пересчёт стоимости конкретной эфирной квоты из хранилища по её `SecondBasedPricing` структуре.
   */
  recalculateSlotQuotaCost(
    slotId: string,
    durationSeconds: number,
    marginOverride?: number,
    options?: CalculateCostOptions
  ): SecondBasedCostResult | null {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot) return null;
    const pricing = slot.secondBasedPricing ?? createSecondBasedPricingFromSlot(slot);
    return pricing.calculateCost(durationSeconds, undefined, marginOverride, options);
  }

  /**
   * Динамический расчёт цены эфира `(секунды, прайс_станции, маржа_FMWorks)` напрямую через хранилище.
   */
  calculateDynamicAirPrice(
    seconds: number,
    stationPrice: number | StationTariffDescriptor,
    fmworksMargin: number = DEFAULT_FMWORKS_MARGIN_PERCENT,
    options?: DynamicAirPriceOptions
  ): DynamicAirPriceResult {
    return calculateDynamicAirPrice(seconds, stationPrice, fmworksMargin, options);
  }

  /**
   * Проверка кратности слота по `slotId` или набору правил для уникального хронометража ролика.
   */
  validateSlotMultiplicity(
    slotIdOrRules: string | SlotMultiplicityRules,
    seconds: number,
    options?: { requestedSpots?: number; roundingPolicy?: MultiplicityRoundingPolicy }
  ): SlotMultiplicityCheckResult {
    if (typeof slotIdOrRules === 'string') {
      const found = this.slots.find((s) => s.id === slotIdOrRules);
      const rules = found
        ? extractSlotMultiplicityRules(found)
        : { slotId: slotIdOrRules };
      return validateSlotMultiplicity(seconds, rules, options);
    }
    return validateSlotMultiplicity(seconds, slotIdOrRules, options);
  }

  /**
   * Расчёт стоимости конкретного слота из хранилища под уникальный хронометраж ролика (например, `17с` или `22с`).
   */
  quoteSlotForChronometry(
    slotId: string,
    spotSeconds: number,
    options: {
      spotsCount?: number;
      fmworksMargin?: number;
      roundingPolicy?: MultiplicityRoundingPolicy;
    } = {}
  ): UniqueChronometrySlotQuote | null {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot) return null;
    return calculateSlotPriceForUniqueChronometry({
      slot,
      spotSeconds,
      spotsCount: options.spotsCount,
      fmworksMargin: options.fmworksMargin,
      roundingPolicy: options.roundingPolicy,
    });
  }
}

export const radioInventoryStore = new RadioInventoryStore();

export function formatRubCompact(amount: number): string {
  return `${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')} ₽`;
}

export function formatNumberSpaced(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
}

/* ============================================================================
 * ВОЛНА 4: СКВОЗНАЯ ИНТЕГРАЦИЯ С ШТОРКОЙ «БЫСТРЫЙ ЗАКАЗ» (БРОНЬ ЭФИРА + ПРОДАКШН)
 * ============================================================================ */

export type ReservationProductionSelection =
  | 'bonus_express_24h'
  | 'voice_style'
  | 'turnkey'
  | 'cinema'
  | 'ready_spot';

export interface ReservedStationSummaryItem {
  slotId: string;
  station: string;
  frequencyFm: string;
  daypart: string;
  daysPattern: string;
  sampleTimeSlots: string[];
  spotsIncluded: number;
  maxDuration: 15 | 30;
  /** Точный хронометраж ролика в секундах (например, 17 сек) */
  exactDurationSec?: number;
  officialPrice: number;
  hotPrice: number;
  discountPercent: number;
  reachOTS: number;
  packageMultiplier: number;
}

export interface MediaGridReservationPayload {
  createdAtMs: number;
  /** Стартовый обратный отсчёт 4-часового приоритетного резерва (14399 сек = 03:59:59) */
  initialCountdownSeconds: number;
  nicheId: MediaClientNiche;
  nicheLabel: string;
  productNote: string;
  durationPref: SpotDurationPreference;
  /** Точный выбранный или рассчитанный по тексту хронометраж ролика (5..60 сек) */
  spotDurationSec?: number;
  /** Сводная строка портрета Целевой Аудитории */
  targetAudienceSummary?: string;
  /** Черновик сценария из встроенного Хронометра текста */
  scriptDraftText?: string;
  stations: ReservedStationSummaryItem[];
  totalSpots: number;
  totalReachOTS: number;
  targetAudienceSharePct: number;
  officialAirTotal: number;
  hotAirTotal: number;
  airDiscountPercent: number;
  isBonusProductionUnlocked: boolean;
  initialProductionSelection: ReservationProductionSelection;
  initialRecommendedTier: RecommendedTier;
  aiRationale: string;
}

export interface ComputedReservationTotals {
  productionSelection: ReservationProductionSelection;
  spotStatusLabel: string;
  productionPriceRub: number;
  bonusSavingsRub: number;
  airSavingsRub: number;
  totalSavingsRub: number;
  unifiedTotalRub: number;
}

/**
 * Форматирует секунды 4-часового приоритетного холда в `ЧЧ:ММ:СС` (`03:59:59`).
 */
export function formatHoldCountdown(remainingSeconds: number): string {
  const clamped = Math.max(0, Math.floor(remainingSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')}`;
}

export function buildMediaReservationPayload(params: {
  plan: MediaGridPlanResult;
  nicheLabel: string;
  productNote: string;
  packageMultipliers?: Record<string, number>;
  nowMs?: number;
}): MediaGridReservationPayload {
  const { plan, nicheLabel, productNote, packageMultipliers = {}, nowMs = Date.now() } = params;

  const airDiscountPercent =
    plan.officialAirTotal > 0 && plan.hotAirTotal < plan.officialAirTotal
      ? Math.round(((plan.officialAirTotal - plan.hotAirTotal) / plan.officialAirTotal) * 100)
      : 0;

  let initialProductionSelection: ReservationProductionSelection = 'turnkey';
  let initialRecommendedTier: RecommendedTier = 'turnkey';

  if (plan.durationPref === 'ready_spot') {
    initialProductionSelection = 'ready_spot';
    initialRecommendedTier = 'turnkey';
  } else if (plan.isBonusProductionUnlocked) {
    initialProductionSelection = 'bonus_express_24h';
    initialRecommendedTier = 'turnkey';
  } else if (plan.durationPref === '15') {
    initialProductionSelection = 'voice_style';
    initialRecommendedTier = 'voice_style';
  } else {
    initialProductionSelection = 'turnkey';
    initialRecommendedTier = 'turnkey';
  }

  return {
    createdAtMs: nowMs,
    initialCountdownSeconds: 4 * 3600 - 1, // 03:59:59
    nicheId: plan.niche,
    nicheLabel,
    productNote: productNote.trim(),
    durationPref: plan.durationPref,
    stations: plan.selectedSlots.map(({ slot, discountPercent }) => ({
      slotId: slot.id,
      station: slot.station,
      frequencyFm: slot.frequencyFm,
      daypart: slot.daypart,
      daysPattern: slot.daysPattern,
      sampleTimeSlots: [...slot.sampleTimeSlots],
      spotsIncluded: slot.spotsIncluded,
      maxDuration: slot.maxDuration,
      officialPrice: slot.officialPrice,
      hotPrice: slot.hotPrice,
      discountPercent,
      reachOTS: slot.reachOTS,
      packageMultiplier: packageMultipliers[slot.id] ?? 1,
    })),
    totalSpots: plan.totalSpots,
    totalReachOTS: plan.totalReachOTS,
    targetAudienceSharePct: plan.targetAudienceSharePct,
    officialAirTotal: plan.officialAirTotal,
    hotAirTotal: plan.hotAirTotal,
    airDiscountPercent,
    isBonusProductionUnlocked: plan.isBonusProductionUnlocked,
    initialProductionSelection,
    initialRecommendedTier,
    aiRationale: plan.aiRationale,
  };
}

export function computeReservationTotalsForSelection(
  payload: MediaGridReservationPayload,
  selection: ReservationProductionSelection
): ComputedReservationTotals {
  const airSavingsRub = Math.max(0, payload.officialAirTotal - payload.hotAirTotal);
  const exactSecSuffix =
    typeof payload.spotDurationSec === 'number' ? ` (${payload.spotDurationSec} сек)` : '';

  if (selection === 'bonus_express_24h' && payload.isBonusProductionUnlocked) {
    return {
      productionSelection: 'bonus_express_24h',
      spotStatusLabel: payload.spotDurationSec
        ? `Экспресс-продакшн${exactSecSuffix} за 24ч — 0 ₽ Бонус`
        : 'Экспресс-продакшн за 24ч — 0 ₽ Бонус',
      productionPriceRub: 0,
      bonusSavingsRub: TURNKEY_30S_PRODUCTION_RUB,
      airSavingsRub,
      totalSavingsRub: airSavingsRub + TURNKEY_30S_PRODUCTION_RUB,
      unifiedTotalRub: payload.hotAirTotal,
    };
  }

  if (selection === 'ready_spot') {
    return {
      productionSelection: 'ready_spot',
      spotStatusLabel: `Готовый ролик${exactSecSuffix} с паспортом прав — 0 ₽`,
      productionPriceRub: 0,
      bonusSavingsRub: 0,
      airSavingsRub,
      totalSavingsRub: airSavingsRub,
      unifiedTotalRub: payload.hotAirTotal,
    };
  }

  if (selection === 'voice_style') {
    if (payload.isBonusProductionUnlocked) {
      return {
        productionSelection: 'bonus_express_24h',
        spotStatusLabel: payload.spotDurationSec
          ? `Экспресс-продакшн${exactSecSuffix} за 24ч — 0 ₽ Бонус`
          : 'Экспресс-продакшн за 24ч — 0 ₽ Бонус',
        productionPriceRub: 0,
        bonusSavingsRub: TURNKEY_30S_PRODUCTION_RUB,
        airSavingsRub,
        totalSavingsRub: airSavingsRub + TURNKEY_30S_PRODUCTION_RUB,
        unifiedTotalRub: payload.hotAirTotal,
      };
    }
    const shortSpotPrice =
      typeof payload.spotDurationSec === 'number' && payload.spotDurationSec <= 12
        ? 12_000
        : 15_000;
    return {
      productionSelection: 'voice_style',
      spotStatusLabel:
        shortSpotPrice === 12_000
          ? `Короткий спот${exactSecSuffix} за 24ч — ${formatRubCompact(12_000)}`
          : `Голос и стиль${exactSecSuffix} за 24ч — ${formatRubCompact(15_000)}`,
      productionPriceRub: shortSpotPrice,
      bonusSavingsRub: 0,
      airSavingsRub,
      totalSavingsRub: airSavingsRub,
      unifiedTotalRub: payload.hotAirTotal + shortSpotPrice,
    };
  }

  if (selection === 'cinema') {
    return {
      productionSelection: 'cinema',
      spotStatusLabel: `Игровой ролик / Мини-кино${exactSecSuffix} — ${formatRubCompact(35_000)}`,
      productionPriceRub: 35_000,
      bonusSavingsRub: 0,
      airSavingsRub,
      totalSavingsRub: airSavingsRub,
      unifiedTotalRub: payload.hotAirTotal + 35_000,
    };
  }

  // 'turnkey'
  if (payload.isBonusProductionUnlocked) {
    return {
      productionSelection: 'bonus_express_24h',
      spotStatusLabel: payload.spotDurationSec
        ? `Экспресс-продакшн${exactSecSuffix} за 24ч — 0\u00A0₽ Бонус`
        : 'Экспресс-продакшн за 24ч — 0\u00A0₽ Бонус',
      productionPriceRub: 0,
      bonusSavingsRub: TURNKEY_30S_PRODUCTION_RUB,
      airSavingsRub,
      totalSavingsRub: airSavingsRub + TURNKEY_30S_PRODUCTION_RUB,
      unifiedTotalRub: payload.hotAirTotal,
    };
  }

  return {
    productionSelection: 'turnkey',
    spotStatusLabel: `Продакшн «Под ключ»${exactSecSuffix} за 24ч — ${formatRubCompact(25_000)}`,
    productionPriceRub: 25_000,
    bonusSavingsRub: 0,
    airSavingsRub,
    totalSavingsRub: airSavingsRub,
    unifiedTotalRub: payload.hotAirTotal + 25_000,
  };
}

export function formatBookingSpecificationText(params: {
  orderNumber: string;
  payload: MediaGridReservationPayload;
  totals: ComputedReservationTotals;
  contact: string;
  companyRequisites?: string;
  briefText?: string;
  hasVoice?: boolean;
  voiceSec?: number;
  requisitesFileName?: string | null;
}): string {
  const {
    orderNumber,
    payload,
    totals,
    contact,
    companyRequisites = '',
    briefText = '',
    hasVoice = false,
    voiceSec = 0,
    requisitesFileName = null,
  } = params;

  const lines: string[] = [
    `FMWorks® (fmworks.ru) — Спецификация 4-часовой брони эфира и продакшна`,
    `Номер резерва: #${orderNumber}`,
    `Статус: Квота поставлена на 4-часовой холд. Единый счёт в ЭДО — в течение 20 минут.`,
    `Ниша кампании: ${payload.nicheLabel}${payload.targetAudienceSummary ? ` (${payload.targetAudienceSummary})` : ''}`,
    ...(payload.spotDurationSec ? [`Точный хронометраж ролика: ${payload.spotDurationSec} сек`] : []),
    ``,
    `ЗАБРОНИРОВАННЫЕ ЭФИРНЫЕ ОКНА (${payload.stations.length} поз. · ${payload.totalSpots} выходов · ${formatNumberSpaced(payload.totalReachOTS)} OTS):`,
    ...payload.stations.map((st, idx) => {
      const multLabel = st.packageMultiplier > 1 ? ` [${st.packageMultiplier} пакета]` : '';
      const durText = st.exactDurationSec
        ? `${st.exactDurationSec} сек`
        : `до ${st.maxDuration} сек`;
      return `${idx + 1}. ${st.station} (${st.frequencyFm})${multLabel} — ${st.daypart}, ${st.daysPattern} (окна: ${st.sampleTimeSlots.join(', ')}) — ${st.spotsIncluded} выходов, ${durText} — ${formatRubCompact(st.hotPrice)} (офиц. прайс ${formatRubCompact(st.officialPrice)}, −${st.discountPercent}%)`;
    }),
    ``,
    `ФИНАНСОВАЯ СВОДКА (ЕДИНЫЙ ДОГОВОР И ЭДО):`,
    `• Эфир по горящим квотам: ${formatRubCompact(payload.hotAirTotal)} (вместо ${formatRubCompact(payload.officialAirTotal)}, скидка −${payload.airDiscountPercent}%)`,
    `• Производство аудиоролика: ${totals.spotStatusLabel}`,
    `• Зафиксированная выгода клиента: +${formatRubCompact(totals.totalSavingsRub)}`,
    `• ИТОГО ПО ЕДИНОМУ СЧЁТУ: ${formatRubCompact(totals.unifiedTotalRub)}`,
    ``,
    `ДАННЫЕ ЗАКАЗЧИКА И ТЗ:`,
    `• Контакт: ${contact}`,
  ];

  if (companyRequisites.trim()) {
    lines.push(`• Юрлицо / ИНН для ЭДО: ${companyRequisites.trim()}`);
  }
  if (requisitesFileName) {
    lines.push(`• Прикреплённый файл (реквизиты / бриф): ${requisitesFileName}`);
  }
  if (hasVoice) {
    lines.push(`• Голосовое ТЗ для сценариста: прикреплено (0:${String(voiceSec).padStart(2, '0')})`);
  }
  if (briefText.trim()) {
    lines.push(`• Задача / акция: ${briefText.trim()}`);
  }

  lines.push(``, `Отдел медиабаинга FMWorks: hello@fmworks.ru · https://fmworks.ru`);
  return lines.join('\n');
}

