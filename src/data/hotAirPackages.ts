import { LayaPersona } from '../engine/layaTypes';
import {
  AiSemanticRecommendationHint,
  buildMergedStationCatalog,
  ComputedVariationQuote,
  computeFlexibleMediaPlanSummary,
  computeProductionCostForExactSeconds,
  FlexibleMediaPlanResult,
  MAX_FLEXIBLE_BUDGET_RUB,
  MIN_FLEXIBLE_BUDGET_RUB,
  RadioStationCatalogItem,
  recommendOptimalMediaPlan,
  SelectedVariationState,
  TargetAudienceProfile,
} from './mediaPlannerCore';
import { stationNameToSlug } from './multiPageContentData';
import {
  AIR_BONUS_THRESHOLD_RUB,
  AudienceTag,
  MediaClientNiche,
  RadioInventorySlot,
  SpotReadinessMode,
} from './radioInventory';
import { clampExactSpotSeconds } from './scriptChronometer';

export type HotAirPortraitId =
  | 'b2b_execs'
  | 'premium_estate'
  | 'auto_commute'
  | 'urban_retail'
  | 'family_health';

export type HotAirPackageId = 'focus' | 'balanced' | 'reach';

export type CampaignGoalId = 'promo_burst' | 'brand_3months';

export type FrequencyVerdictLevel =
  | 'optimal_5plus'
  | 'working_3plus'
  | 'under_threshold';

export interface CampaignGoalOption {
  id: CampaignGoalId;
  label: string;
  horizonLabel: string;
  shortHint: string;
  honestRuleNote: string;
}

export interface ThreeMonthWaveProgram {
  wavesCount: 3;
  activeSchedulePattern: string;
  firstMonthTotalRub: number;
  subsequentMonthAirOnlyRub: number;
  threeMonthsTotalRub: number;
  productionSavedInMonths2And3Rub: number;
}

export interface MediaEffectivenessDiagnostic {
  avgContactsPerListener: number;
  uniqueListenersCount: number;
  effectiveReach5PlusCount: number;
  shareReaching5PlusPct: number;
  minScientificSpotsPerStation: number;
  verdictLevel: FrequencyVerdictLevel;
  verdictShortLabel: string;
  verdictExplanation: string;
  omnichannelNote: string;
  threeMonthProgram: ThreeMonthWaveProgram;
}

export interface HotAirAudiencePortrait {
  id: HotAirPortraitId;
  label: string;
  shortHint: string;
  portraitKeyLabel: string;
  coreStationsLabel: string;
  primaryAudienceTag: AudienceTag;
  niche: MediaClientNiche;
  audience: TargetAudienceProfile;
  focusStationIds: readonly string[];
  balancedStationIds: readonly string[];
  reachStationIds: readonly string[];
}

export interface HotAirPackageStationItem {
  stationId: string;
  stationSlug: string;
  stationName: string;
  frequencyFm: string;
  windowsSummary: string;
  spotsCount: number;
  reachOTS: number;
  officialPriceRub: number;
  hotPriceRub: number;
  discountPercent: number;
}

export interface HotAirReadyPackage {
  id: HotAirPackageId;
  indexLabel: '01' | '02' | '03';
  title: string;
  subtitle: string;
  isRecommended: boolean;
  whySummary: string;
  selectedVariations: SelectedVariationState[];
  stationBreakdown: HotAirPackageStationItem[];
  plan: FlexibleMediaPlanResult;
  science: MediaEffectivenessDiagnostic;
}

export interface RadioSciencePillar {
  index: '01' | '02' | '03';
  title: string;
  metricAnchor: string;
  summary: string;
  practicalRule: string;
}

/**
 * Честное разделение бизнес-задач на входе, чтобы клиент не покупал 1 месяц под задачу,
 * которая по законам памяти требует минимум 3 месяцев.
 */
export const CAMPAIGN_GOAL_OPTIONS: readonly CampaignGoalOption[] = [
  {
    id: 'promo_burst',
    label: 'Разовая акция или событие',
    horizonLabel: 'Быстрый залп 3–10 дней',
    shortHint: 'Распродажа 11.11, открытие, сезонный оффер',
    honestRuleNote:
      'Для быстрой акции работает концентрированный залп: плотная серия от 14 выходов на одной волне за 3–10 дней, чтобы слушатель успел услышать оффер 5 раз до конца акции.',
  },
  {
    id: 'brand_3months',
    label: 'Узнаваемость и постоянный поток',
    horizonLabel: 'Система минимум 3 месяца',
    shortHint: 'Чтобы вас запомнили, доверяли и покупали регулярно',
    honestRuleNote:
      'Честное правило FMWorks: под задачу узнаваемости мы не продаём «попробовать 1 месяц» — без закрепления память обнуляется, и вы зря разочаруетесь в радио. Устойчивый поток формируется за 3 месяца импульсными волнами по 5+ касаний (причём за съёмку ролика вы платите только в 1-м месяце).',
  },
] as const;

/**
 * Научно-практическая памятка для клиента: как на самом деле работает радиореклама,
 * где её границы и почему 1 выход в эфире равен нулю.
 */
export const RADIO_SCIENCE_PILLARS: readonly RadioSciencePillar[] = [
  {
    index: '01',
    title: 'Закон 5 касаний: почему 1–3 выхода — деньги впустую',
    metricAnchor: 'Минимум 5 контактов со слушателем',
    summary:
      'По исследованиям эффективной частоты (Krugman, Naples, RAB), 1 выход в эфире слушатель даже не фиксирует — вас словно не было. 2-й контакт даёт смутное узнавание, 3–4-й включают интерес, и только с 5-го контакта возникает доверие и покупка.',
    practicalRule:
      'На одной радиостанции постоянный слушатель застаёт около трети рекламных блоков. Поэтому научный минимум на одну станцию — от 14–16 выходов во флайте, а не по 2 выхода на пяти разных волнах.',
  },
  {
    index: '02',
    title: 'Акция «11.11» против системного бренда от 3 месяцев',
    metricAnchor: 'Залп 5–10 дней vs Цикл 12 недель',
    summary:
      'Если задача — громко сообщить про распродажу 11.11 или открытие клиники, достаточно одного плотного недельного залпа. Но если цель — чтобы вашу компанию знали в лицо, покупка 1 месяца бессмысленна: кривая забывания сотрёт эффект через 3 недели тишины.',
    practicalRule:
      'Для системного спроса мы закладываем горизонт 3 месяца пульсирующими волнами (2 недели плотного эфира 5+ касаний → 2 недели удержания). Вы бронируете 1-ю волну, а во 2-й и 3-й платите только за эфир без повторной оплаты ролика.',
  },
  {
    index: '03',
    title: 'Экосистема 5 касаний: радио + видимые точки вокруг клиента',
    metricAnchor: 'Звук за рулём + визуальный якорь',
    summary:
      'Пять касаний работают кратно сильнее, когда окружают клиента в разных средах: утром он слышит ваш звуковой якорь на радио в машине, днём видит экран в лифте или визитку, вечером встречает бренд на ТВ или в поиске смартфона.',
    practicalRule:
      'Радио берёт на себя самый дефицитный канал без баннерной слепоты — внимание в дороге, создавая первые 3–5 акустических касаний, после которых поиск, визитки и наружные носители конвертируют в сделку.',
  },
] as const;

/**
 * Дополнительные станции из 12 редакционных площадок («Новое Радио» и «Relax FM»),
 * чтобы обе вкладки раздела «Горящий эфир» работали с единым списком из 12 радиостанций.
 */
const EXTRA_CATALOG_STATIONS: readonly RadioStationCatalogItem[] = [
  {
    stationId: 'novoeradio',
    station: 'Новое Радио',
    frequencyFm: '98.4 FM',
    formatDesc: 'Энергичный охват молодой и активной городской аудитории 20–39 лет',
    audienceTags: ['fmcg', 'mass', 'auto'],
    ageCores: ['20_35', '30_45'],
    segments: ['b2c_mass'],
    variations: [
      {
        id: 'nov-morning',
        stationId: 'novoeradio',
        kind: 'morning_prime',
        label: 'Утреннее шоу «1+1»',
        hoursWindow: '07:30–10:30',
        programNote: 'Быстрый отклик на доставку, онлайн-сервисы и розничные акции',
        daysPattern: 'Пн–Сб',
        weekdays: [1, 2, 3, 4, 5, 6],
        sampleTimeSlots: ['08:15', '09:20', '10:15'],
        officialRatePerSec: 590,
        hotRatePerSec: 335,
        minSpots: 5,
        defaultSpots: 14,
        maxSpots: 34,
        stepSpots: 2,
        reachPerSpotOTS: 27_200,
        maxSpotSeconds: 45,
        deadlineHours: 26,
        bestContexts: ['commute_rush'],
        sourceKind: 'seed',
      },
      {
        id: 'nov-day',
        stationId: 'novoeradio',
        kind: 'daytime_block',
        label: 'Дневной ритм',
        hoursWindow: '12:00–16:30',
        programNote: 'Доступный тест-драйв для e-commerce, кофеен и городских услуг',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['12:30', '14:30', '16:00'],
        officialRatePerSec: 430,
        hotRatePerSec: 245,
        minSpots: 5,
        defaultSpots: 14,
        maxSpots: 36,
        stepSpots: 2,
        reachPerSpotOTS: 23_800,
        maxSpotSeconds: 60,
        deadlineHours: 25,
        bestContexts: ['office_daytime'],
        sourceKind: 'seed',
      },
      {
        id: 'nov-evening',
        stationId: 'novoeradio',
        kind: 'evening_drive',
        label: 'Вечерний поток',
        hoursWindow: '17:30–20:30',
        programNote: 'Высокий охват перед вечерними покупками и досугом',
        daysPattern: 'Пн–Сб',
        weekdays: [1, 2, 3, 4, 5, 6],
        sampleTimeSlots: ['17:45', '18:45', '19:45'],
        officialRatePerSec: 540,
        hotRatePerSec: 310,
        minSpots: 5,
        defaultSpots: 14,
        maxSpots: 32,
        stepSpots: 2,
        reachPerSpotOTS: 25_400,
        maxSpotSeconds: 45,
        deadlineHours: 27,
        bestContexts: ['evening_leisure', 'commute_rush'],
        sourceKind: 'seed',
      },
    ],
  },
  {
    stationId: 'relaxfm',
    station: 'Relax FM',
    frequencyFm: '90.8 FM',
    formatDesc: 'Спокойная эмоциональная среда без суеты: клиники, семейные ЖК и комфорт',
    audienceTags: ['medicine', 'real_estate', 'premium', 'fmcg'],
    ageCores: ['30_45', '35_55', '45_plus'],
    segments: ['b2c_premium', 'b2c_mass'],
    variations: [
      {
        id: 'rlx-morning',
        stationId: 'relaxfm',
        kind: 'morning_prime',
        label: 'Утренний атмосферный эфир',
        hoursWindow: '08:00–11:00',
        programNote: 'Мягкий контакт без рекламного раздражения для медицины и ЖК',
        daysPattern: 'Ср–Вс',
        weekdays: [3, 4, 5, 6, 7],
        sampleTimeSlots: ['08:25', '09:25', '10:25'],
        officialRatePerSec: 560,
        hotRatePerSec: 320,
        minSpots: 5,
        defaultSpots: 14,
        maxSpots: 32,
        stepSpots: 2,
        reachPerSpotOTS: 21_500,
        maxSpotSeconds: 60,
        deadlineHours: 30,
        bestContexts: ['commute_rush', 'weekend_family'],
        sourceKind: 'seed',
      },
      {
        id: 'rlx-day',
        stationId: 'relaxfm',
        kind: 'daytime_block',
        label: 'Дневной баланс',
        hoursWindow: '12:00–16:30',
        programNote: 'Фоновое прослушивание в клиниках, офисах и семейных поездках',
        daysPattern: 'Пн–Пт',
        weekdays: [1, 2, 3, 4, 5],
        sampleTimeSlots: ['12:35', '14:35', '16:05'],
        officialRatePerSec: 425,
        hotRatePerSec: 250,
        minSpots: 5,
        defaultSpots: 12,
        maxSpots: 32,
        stepSpots: 2,
        reachPerSpotOTS: 19_200,
        maxSpotSeconds: 60,
        deadlineHours: 28,
        bestContexts: ['office_daytime'],
        sourceKind: 'seed',
      },
      {
        id: 'rlx-evening',
        stationId: 'relaxfm',
        kind: 'evening_drive',
        label: 'Вечерняя волна',
        hoursWindow: '18:00–21:00',
        programNote: 'Доверительный вечерний прайм для здоровья, дома и отдыха',
        daysPattern: 'Пн–Вс',
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        sampleTimeSlots: ['18:20', '19:20', '20:20'],
        officialRatePerSec: 530,
        hotRatePerSec: 305,
        minSpots: 5,
        defaultSpots: 14,
        maxSpots: 30,
        stepSpots: 2,
        reachPerSpotOTS: 20_600,
        maxSpotSeconds: 60,
        deadlineHours: 30,
        bestContexts: ['evening_leisure'],
        sourceKind: 'seed',
      },
    ],
  },
] as const;

/**
 * Один ряд из 5 понятных портретов целевой аудитории для выбора в 1 клик.
 */
export const HOT_AIR_AUDIENCE_PORTRAITS: readonly HotAirAudiencePortrait[] = [
  {
    id: 'b2b_execs',
    label: 'Бизнес и B2B',
    shortHint: 'Собственники, директора, финансы',
    portraitKeyLabel: '35–55 · ЛПР',
    coreStationsLabel: 'Business FM · Коммерсантъ',
    primaryAudienceTag: 'b2b',
    niche: 'b2b_finance',
    audience: {
      segment: 'b2b_decision_makers',
      ageCore: '35_55',
      listeningContext: 'commute_rush',
    },
    focusStationIds: ['bfm', 'kommersant', 'silverrain', 'jazz'],
    balancedStationIds: ['kommersant', 'bfm', 'comedy', 'silverrain'],
    reachStationIds: ['comedy', 'avtoradio', 'kommersant', 'bfm'],
  },
  {
    id: 'premium_estate',
    label: 'Премиум и ЖК',
    shortHint: 'Высокий чек, недвижимость, инвестиции',
    portraitKeyLabel: '30–45 · Премиум',
    coreStationsLabel: 'Monte Carlo · Серебряный Дождь',
    primaryAudienceTag: 'real_estate',
    niche: 'real_estate',
    audience: {
      segment: 'b2c_premium',
      ageCore: '30_45',
      listeningContext: 'commute_rush',
    },
    focusStationIds: ['montecarlo', 'bfm', 'silverrain', 'jazz'],
    balancedStationIds: ['bfm', 'silverrain', 'montecarlo', 'relaxfm'],
    reachStationIds: ['silverrain', 'relaxfm', 'avtoradio', 'montecarlo'],
  },
  {
    id: 'auto_commute',
    label: 'Водители в пути',
    shortHint: 'Утренний и вечерний поток за рулём',
    portraitKeyLabel: '82% за рулём',
    coreStationsLabel: 'Авторадио · Comedy Radio',
    primaryAudienceTag: 'auto',
    niche: 'auto_services',
    audience: {
      segment: 'b2c_premium',
      ageCore: '30_45',
      listeningContext: 'commute_rush',
    },
    focusStationIds: ['avtoradio', 'comedy', 'bfm', 'dorozhnoe'],
    balancedStationIds: ['comedy', 'avtoradio', 'europaplus', 'dorozhnoe'],
    reachStationIds: ['dorozhnoe', 'europaplus', 'novoeradio', 'avtoradio'],
  },
  {
    id: 'urban_retail',
    label: 'Ритейл и услуги',
    shortHint: 'Покупки, доставка, сети, сервис',
    portraitKeyLabel: '20–45 · Масс',
    coreStationsLabel: 'Европа Плюс · Новое Радио',
    primaryAudienceTag: 'fmcg',
    niche: 'fmcg_retail',
    audience: {
      segment: 'b2c_mass',
      ageCore: '20_35',
      listeningContext: 'office_daytime',
    },
    focusStationIds: ['europaplus', 'comedy', 'novoeradio', 'avtoradio'],
    balancedStationIds: ['novoeradio', 'europaplus', 'comedy', 'dorozhnoe'],
    reachStationIds: ['dorozhnoe', 'novoeradio', 'retrofm', 'europaplus'],
  },
  {
    id: 'family_health',
    label: 'Семья и медицина',
    shortHint: 'Клиники, дом, семейный бюджет',
    portraitKeyLabel: '35–55 · Семья',
    coreStationsLabel: 'Relax FM · Ретро FM',
    primaryAudienceTag: 'medicine',
    niche: 'medicine',
    audience: {
      segment: 'b2c_mass',
      ageCore: '35_55',
      listeningContext: 'office_daytime',
    },
    focusStationIds: ['retrofm', 'relaxfm', 'montecarlo', 'dorozhnoe'],
    balancedStationIds: ['relaxfm', 'dorozhnoe', 'retrofm', 'europaplus'],
    reachStationIds: ['dorozhnoe', 'retrofm', 'europaplus', 'relaxfm'],
  },
] as const;

export const QUICK_SLIDER_BUDGET_MARKS = [
  { amount: 40_000, label: '40 000 ₽ · Разовый залп' },
  { amount: 120_000, label: '120 000 ₽ · 5+ касаний' },
  { amount: 250_000, label: '250 000 ₽' },
  { amount: 420_000, label: '420 000 ₽ · Ролик 0 ₽' },
] as const;

export function resolvePortraitFromNiche(niche: MediaClientNiche): HotAirAudiencePortrait {
  switch (niche) {
    case 'b2b_finance':
      return HOT_AIR_AUDIENCE_PORTRAITS[0];
    case 'real_estate':
      return HOT_AIR_AUDIENCE_PORTRAITS[1];
    case 'auto_services':
      return HOT_AIR_AUDIENCE_PORTRAITS[2];
    case 'fmcg_retail':
      return HOT_AIR_AUDIENCE_PORTRAITS[3];
    case 'medicine':
      return HOT_AIR_AUDIENCE_PORTRAITS[4];
  }
}

export function getAudiencePortraitById(id: HotAirPortraitId): HotAirAudiencePortrait {
  return (
    HOT_AIR_AUDIENCE_PORTRAITS.find((item) => item.id === id) ??
    HOT_AIR_AUDIENCE_PORTRAITS[1]
  );
}

export interface PortraitFilterTransitionResult {
  portraitId: HotAirPortraitId;
  portrait: HotAirAudiencePortrait;
  nextStationFilter: 'all' | AudienceTag;
  manualSelections: null;
  aiHint: null;
  readyPackages: readonly HotAirReadyPackage[];
  recommendedManualPlan: FlexibleMediaPlanResult;
}

/**
 * Чистый расчёт смены портрета ЦА по клику на тактильную иконку-портрет:
 * обновляет активный фильтр, сбрасывает ручные переопределения и мгновенно
 * пересчитывает 3 готовых пакета и ранжирование 12 станций.
 */
export function selectAudiencePortraitAndRecalculate(params: {
  nextPortraitId: HotAirPortraitId;
  currentStationFilter?: 'all' | AudienceTag;
  totalBudgetRub: number;
  campaignGoal?: CampaignGoalId;
  spotSeconds?: number;
  spotReadiness?: SpotReadinessMode;
  productNote?: string;
  stationsCatalog?: readonly RadioStationCatalogItem[];
  layaPersona?: LayaPersona;
}): PortraitFilterTransitionResult {
  const portrait = getAudiencePortraitById(params.nextPortraitId);
  const currentFilter = params.currentStationFilter ?? 'all';
  const nextStationFilter: 'all' | AudienceTag =
    currentFilter === 'all' ? 'all' : portrait.primaryAudienceTag;

  const catalog = params.stationsCatalog ?? buildUnified12StationCatalog();
  const readyPackages = buildThreeReadyPackages({
    portraitId: portrait.id,
    totalBudgetRub: params.totalBudgetRub,
    campaignGoal: params.campaignGoal ?? 'promo_burst',
    spotSeconds: params.spotSeconds ?? 15,
    spotReadiness: params.spotReadiness ?? 'need_production_24h',
    productNote: params.productNote ?? '',
    stationsCatalog: catalog,
    layaPersona: params.layaPersona,
    aiHint: null,
  });

  const recommendedManualPlan = recommendOptimalMediaPlan({
    niche: portrait.niche,
    audience: portrait.audience,
    productNote: params.productNote ?? '',
    totalBudgetRub: params.totalBudgetRub,
    spotSeconds: params.spotSeconds ?? 15,
    spotReadiness: params.spotReadiness ?? 'need_production_24h',
    stationsCatalog: catalog,
    layaPersona: params.layaPersona,
    aiHint: null,
  });

  return {
    portraitId: portrait.id,
    portrait,
    nextStationFilter,
    manualSelections: null,
    aiHint: null,
    readyPackages,
    recommendedManualPlan,
  };
}

/**
 * Хвост распределения Пуассона P(X >= 5 | lambda) — доля охваченной аудитории,
 * получившей не менее 5 рекламных контактов.
 */
function poissonTailAtLeast5(lambda: number): number {
  if (lambda <= 0) return 0;
  const expNeg = Math.exp(-lambda);
  let sumZeroToFour = 0;
  let term = 1;
  for (let k = 0; k <= 4; k += 1) {
    if (k > 0) {
      term *= lambda / k;
    }
    sumZeroToFour += term;
  }
  const probAtLeastZero = Math.max(0, Math.min(1, 1 - expNeg * sumZeroToFour));
  const probAtLeastOne = Math.max(0.0001, 1 - expNeg);
  // Условная вероятность P(X >= 5 | X >= 1) среди реально услышавших слушателей
  return Math.max(0, Math.min(0.96, probAtLeastZero / probAtLeastOne));
}

/**
 * Научный расчёт эффективной частоты (правило 5+ контактов) и 3-месячного горизонта
 * для любого пакета или ручной сборки слотов.
 */
export function evaluateMediaScienceDiagnostic(params: {
  plan: FlexibleMediaPlanResult;
  campaignGoal: CampaignGoalId;
}): MediaEffectivenessDiagnostic {
  const { plan, campaignGoal } = params;
  const minScientificSpotsPerStation = 14;

  const firstMonthTotalRub = plan.totalClientCostRub;
  const subsequentMonthAirOnlyRub = plan.hotAirTotalRub;
  const threeMonthProgram: ThreeMonthWaveProgram = {
    wavesCount: 3,
    activeSchedulePattern: '3 волны за 12 недель (по 2 недели плотного эфира + 2 недели удержания)',
    firstMonthTotalRub,
    subsequentMonthAirOnlyRub,
    threeMonthsTotalRub: firstMonthTotalRub + subsequentMonthAirOnlyRub * 2,
    productionSavedInMonths2And3Rub: plan.production.effectivePriceRub * 2,
  };

  if (plan.selectedQuotes.length === 0 || plan.totalSpots === 0) {
    return {
      avgContactsPerListener: 0,
      uniqueListenersCount: 0,
      effectiveReach5PlusCount: 0,
      shareReaching5PlusPct: 0,
      minScientificSpotsPerStation,
      verdictLevel: 'under_threshold',
      verdictShortLabel: 'Нет выходов в эфире',
      verdictExplanation:
        'Единичный выход на радио равен нулю — выберите пакет или минимум 14 выходов на одной волне.',
      omnichannelNote:
        'Для срабатывания рекламы клиенту нужно минимум 5 касаний со звуком и визуальными носителями.',
      threeMonthProgram,
    };
  }

  // Группируем выходы и OTS по радиостанциям
  const byStation = new Map<
    string,
    { spots: number; ots: number; listenShareFactor: number }
  >();

  for (const q of plan.selectedQuotes) {
    const daypartFactor =
      q.variation.kind === 'traffic_weather'
        ? 0.38
        : q.variation.kind === 'morning_prime' || q.variation.kind === 'evening_drive'
          ? 0.35
          : 0.31;

    const prev = byStation.get(q.stationItem.stationId);
    if (prev) {
      const totalSpots = prev.spots + q.spotsCount;
      const blendedFactor =
        (prev.listenShareFactor * prev.spots + daypartFactor * q.spotsCount) /
        Math.max(1, totalSpots);
      byStation.set(q.stationItem.stationId, {
        spots: totalSpots,
        ots: prev.ots + q.reachOTS,
        listenShareFactor: blendedFactor,
      });
    } else {
      byStation.set(q.stationItem.stationId, {
        spots: q.spotsCount,
        ots: q.reachOTS,
        listenShareFactor: daypartFactor,
      });
    }
  }

  const stationEntries = Array.from(byStation.values());
  // При нескольких профильных станциях часть ядерной ЦА пересекается (~16% на каждую доп. волну)
  const crossStationSynergy =
    stationEntries.length > 1
      ? 1 + Math.min(0.32, (stationEntries.length - 1) * 0.14)
      : 1;

  let weightedLambdaSum = 0;
  let totalOtsWeight = 0;
  let rawUniqueSum = 0;

  for (const st of stationEntries) {
    const lambdaStation = st.spots * st.listenShareFactor * crossStationSynergy;
    // Средняя частота среди тех, кто услышал хотя бы 1 раз: lambda / (1 - e^-lambda)
    const meanGivenHeard =
      lambdaStation > 0.05
        ? lambdaStation / (1 - Math.exp(-lambdaStation))
        : Math.max(0.3, lambdaStation);
    const uniqueOnStation = Math.round(st.ots / Math.max(1, meanGivenHeard));

    weightedLambdaSum += lambdaStation * st.ots;
    totalOtsWeight += st.ots;
    rawUniqueSum += uniqueOnStation;
  }

  const dedupOverlap =
    stationEntries.length > 1 ? Math.max(0.74, 1 - (stationEntries.length - 1) * 0.09) : 1;
  const uniqueListenersCount = Math.max(1_000, Math.round(rawUniqueSum * dedupOverlap));

  const effectiveLambda =
    totalOtsWeight > 0 ? weightedLambdaSum / totalOtsWeight : 0;
  const avgContactsRaw =
    effectiveLambda > 0.25
      ? effectiveLambda / (1 - Math.exp(-effectiveLambda))
      : effectiveLambda;
  const avgContactsPerListener = Math.round(avgContactsRaw * 10) / 10;

  const share5Plus = poissonTailAtLeast5(effectiveLambda);
  const shareReaching5PlusPct = Math.round(share5Plus * 100);
  const effectiveReach5PlusCount = Math.round(uniqueListenersCount * share5Plus);

  let verdictLevel: FrequencyVerdictLevel;
  let verdictShortLabel: string;
  let verdictExplanation: string;

  if (avgContactsPerListener >= 4.7) {
    verdictLevel = 'optimal_5plus';
    verdictShortLabel = `Норма 5+ касаний (~${avgContactsPerListener.toFixed(1).replace('.', ',')} конт.)`;
    verdictExplanation =
      campaignGoal === 'brand_3months'
        ? `Плотность волны достаточна для запоминания (~${avgContactsPerListener.toFixed(1).replace('.', ',')} касания). Повторите 3 волны за 3 месяца, чтобы закрепить бренд в памяти ЦА.`
        : `Достаточная плотность залпа (~${avgContactsPerListener.toFixed(1).replace('.', ',')} касания на слушателя) — оффер акции пробьёт информационный шум.`;
  } else if (avgContactsPerListener >= 3.0) {
    verdictLevel = 'working_3plus';
    verdictShortLabel = `Базовые ~${avgContactsPerListener.toFixed(1).replace('.', ',')} касания (до 5+ доберите точками)`;
    verdictExplanation =
      campaignGoal === 'promo_burst'
        ? `Тестовая частота (~${avgContactsPerListener.toFixed(1).replace('.', ',')} контакта) сработает на горячую акцию, если усилить её поиском, визитками или наружным носителем до 5 касаний.`
        : `Частота ~${avgContactsPerListener.toFixed(1).replace('.', ',')} контакта близка к порогу: для 3-месячной узнаваемости лучше сконцентрировать бюджет на 1 станции (от 14 выходов) или усилить вторым каналом.`;
  } else {
    verdictLevel = 'under_threshold';
    verdictShortLabel = `Мало контактов (~${avgContactsPerListener.toFixed(1).replace('.', ',')} из 5) — риск слива`;
    verdictExplanation =
      'При 1–6 выходах на станции слушатель поймает ролик максимум 1–2 раза и не запомнит бренд. Соберите все выходы на 1 станции (от 14 выходов) или увеличьте бюджет.';
  }

  const omnichannelNote =
    'Правило 5 контактов: радио закрывает контакт в машине и делах — подкрепите волну визитками, экранами в лифтах, ретаргетингом или ТВ для кратного роста заявок.';

  return {
    avgContactsPerListener,
    uniqueListenersCount,
    effectiveReach5PlusCount,
    shareReaching5PlusPct,
    minScientificSpotsPerStation,
    verdictLevel,
    verdictShortLabel,
    verdictExplanation,
    omnichannelNote,
    threeMonthProgram,
  };
}

/**
 * Собирает полный каталог 12 радиостанций с учётом всех активных/скрытых/импортированных слотов из `/admin`.
 */
export function buildUnified12StationCatalog(
  storeSlots?: readonly RadioInventorySlot[]
): RadioStationCatalogItem[] {
  const baseCatalog = buildMergedStationCatalog(storeSlots);
  const existingNames = new Set(
    baseCatalog.map((st) => st.station.trim().toLowerCase())
  );

  const hiddenStationNames = new Set<string>();
  if (storeSlots) {
    for (const slot of storeSlots) {
      if (slot.isHidden && slot.sourceKind === 'seed') {
        const hasVisibleSameStation = storeSlots.some(
          (other) =>
            !other.isHidden &&
            other.station.trim().toLowerCase() === slot.station.trim().toLowerCase()
        );
        if (!hasVisibleSameStation) {
          hiddenStationNames.add(slot.station.trim().toLowerCase());
        }
      }
    }
  }

  for (const extra of EXTRA_CATALOG_STATIONS) {
    const key = extra.station.trim().toLowerCase();
    if (!existingNames.has(key) && !hiddenStationNames.has(key)) {
      baseCatalog.push({
        ...extra,
        audienceTags: [...extra.audienceTags],
        ageCores: [...extra.ageCores],
        segments: [...extra.segments],
        variations: extra.variations.map((v) => ({
          ...v,
          weekdays: [...v.weekdays],
          sampleTimeSlots: [...v.sampleTimeSlots],
          bestContexts: [...v.bestContexts],
        })),
      });
    }
  }

  return baseCatalog;
}

function resolveStrategyMaxStations(
  packageId: HotAirPackageId,
  budgetRub: number,
  campaignGoal: CampaignGoalId
): number {
  // Защита от распыления по науке 5 касаний: не дробим бюджет на лишние станции,
  // пока на каждой не набирается плотный блок от ~12–15 выходов!
  if (packageId === 'focus') {
    if (budgetRub <= 260_000) return 1;
    return 2;
  }
  if (packageId === 'balanced') {
    if (budgetRub <= 135_000) return 1;
    if (budgetRub <= 310_000) return 2;
    if (budgetRub <= 650_000) return campaignGoal === 'brand_3months' ? 2 : 3;
    return 3;
  }
  // reach
  if (budgetRub <= 95_000) return 1;
  if (budgetRub <= 210_000) return 2;
  if (budgetRub <= 420_000) return 3;
  return 4;
}

function scoreCandidateForStrategy(
  quote: ComputedVariationQuote,
  packageId: HotAirPackageId,
  portrait: HotAirAudiencePortrait
): number {
  const unitSecCost = Math.max(120, quote.variation.hotRatePerSec);
  const contactsPerThousandRub =
    quote.variation.reachPerSpotOTS /
    Math.max(1, (unitSecCost * quote.billedSeconds) / 1000);

  if (packageId === 'focus') {
    const focusIdx = portrait.focusStationIds.indexOf(quote.stationItem.stationId);
    const stationBoost = focusIdx === 0 ? 44 : focusIdx === 1 ? 30 : focusIdx >= 2 ? 16 : 0;
    const primeBoost =
      quote.variation.kind === 'morning_prime' || quote.variation.kind === 'evening_drive'
        ? 14
        : quote.variation.kind === 'traffic_weather'
          ? 8
          : 0;
    return quote.affinity * 1.45 + stationBoost + primeBoost;
  }

  if (packageId === 'balanced') {
    const balIdx = portrait.balancedStationIds.indexOf(quote.stationItem.stationId);
    const stationBoost = balIdx === 0 ? 34 : balIdx === 1 ? 26 : balIdx >= 2 ? 16 : 0;
    const discountBoost = quote.discountPercent * 0.65;
    const primeBoost =
      quote.variation.kind === 'evening_drive' || quote.variation.kind === 'morning_prime'
        ? 10
        : 6;
    return quote.affinity * 1.2 + stationBoost + discountBoost + primeBoost;
  }

  // reach: максимум выходов, OTS на 1000 ₽ и глубины горящей скидки
  const reachIdx = portrait.reachStationIds.indexOf(quote.stationItem.stationId);
  const stationBoost = reachIdx === 0 ? 32 : reachIdx === 1 ? 24 : reachIdx >= 2 ? 14 : 0;
  const dayOrTrafficBoost =
    quote.variation.kind === 'daytime_block' ||
    quote.variation.kind === 'traffic_weather' ||
    quote.variation.kind === 'weekend_air'
      ? 16
      : 4;
  return (
    contactsPerThousandRub * 0.14 +
    quote.discountPercent * 0.9 +
    quote.affinity * 0.75 +
    stationBoost +
    dayOrTrafficBoost
  );
}

function buildStrategySelectionForAirBudget(params: {
  eligibleQuotes: readonly ComputedVariationQuote[];
  packageId: HotAirPackageId;
  portrait: HotAirAudiencePortrait;
  campaignGoal: CampaignGoalId;
  airBudgetCap: number;
  totalBudgetRub: number;
  discourageLeadVariationIds: ReadonlySet<string>;
  requireMinAirRub?: number;
}): SelectedVariationState[] {
  const {
    eligibleQuotes,
    packageId,
    portrait,
    campaignGoal,
    airBudgetCap,
    totalBudgetRub,
    discourageLeadVariationIds,
    requireMinAirRub = 0,
  } = params;

  if (airBudgetCap <= 0 || eligibleQuotes.length === 0) return [];

  const maxStations = resolveStrategyMaxStations(packageId, totalBudgetRub, campaignGoal);
  const maxWindowsPerStation = packageId === 'focus' ? 2 : 1;

  const ranked = [...eligibleQuotes].sort((a, b) => {
    const penaltyA =
      maxStations === 1 && discourageLeadVariationIds.has(a.variation.id) ? 38 : 0;
    const penaltyB =
      maxStations === 1 && discourageLeadVariationIds.has(b.variation.id) ? 38 : 0;
    const scoreA = scoreCandidateForStrategy(a, packageId, portrait) - penaltyA;
    const scoreB = scoreCandidateForStrategy(b, packageId, portrait) - penaltyB;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.variation.hotRatePerSec - b.variation.hotRatePerSec;
  });

  const chosen: SelectedVariationState[] = [];
  const chosenIds = new Set<string>();
  const activeStations = new Set<string>();
  let remainingAir = airBudgetCap;

  for (const candidate of ranked) {
    const stationAlreadyPicked = activeStations.has(candidate.stationItem.stationId);
    if (!stationAlreadyPicked && activeStations.size >= maxStations) {
      continue;
    }

    const stationWindowsCount = chosen.filter((c) =>
      candidate.stationItem.variations.some((v) => v.id === c.variationId)
    ).length;
    if (stationWindowsCount >= maxWindowsPerStation) continue;

    const unitExitCost = candidate.variation.hotRatePerSec * candidate.billedSeconds;
    if (unitExitCost <= 0) continue;

    // Запрещаем бессмысленные 1–2 выхода: минимум 5 выходов (или от 3 на микро-тесте 40 000 ₽ с длинным роликом)
    const effectiveMinSpots =
      totalBudgetRub <= 60_000
        ? Math.min(4, candidate.variation.minSpots)
        : Math.max(6, candidate.variation.minSpots);

    const minPackCost = Math.round(unitExitCost * effectiveMinSpots);
    if (minPackCost > remainingAir) continue;

    const stationsLeftToFill = Math.max(1, maxStations - activeStations.size);
    const fairShareRub =
      maxStations === 1
        ? remainingAir
        : Math.max(minPackCost, Math.floor(remainingAir / stationsLeftToFill));

    const fairSpots = Math.floor(fairShareRub / unitExitCost);
    const baseTargetSpots =
      maxStations === 1
        ? Math.floor(remainingAir / unitExitCost)
        : Math.min(Math.max(14, candidate.variation.defaultSpots), fairSpots);

    const desiredSpots = Math.max(
      effectiveMinSpots,
      Math.min(
        candidate.variation.maxSpots,
        Math.min(Math.floor(remainingAir / unitExitCost), baseTargetSpots)
      )
    );

    if (desiredSpots >= effectiveMinSpots) {
      chosen.push({
        variationId: candidate.variation.id,
        spotsCount: desiredSpots,
      });
      chosenIds.add(candidate.variation.id);
      activeStations.add(candidate.stationItem.stationId);
      remainingAir -= Math.round(unitExitCost * desiredSpots);
    }
  }

  // Резервный проход для компактных бюджетов (например, 40 000 ₽ с длинным роликом)
  if (chosen.length === 0) {
    const minAllowedTestSpots = totalBudgetRub <= 75_000 ? 3 : 5;
    const affordable = ranked
      .map((q) => {
        const effMin = Math.min(q.variation.minSpots, minAllowedTestSpots);
        return {
          q,
          effMin,
          minCost: Math.round(q.variation.hotRatePerSec * q.billedSeconds * effMin),
        };
      })
      .filter((x) => x.minCost <= airBudgetCap);

    const picked =
      affordable.find((x) => !discourageLeadVariationIds.has(x.q.variation.id)) ??
      affordable[0];

    if (picked && !chosenIds.has(picked.q.variation.id)) {
      const unitCost = picked.q.variation.hotRatePerSec * picked.q.billedSeconds;
      const fitSpots = Math.min(
        picked.q.variation.maxSpots,
        Math.max(picked.effMin, Math.floor(airBudgetCap / unitCost))
      );
      chosen.push({
        variationId: picked.q.variation.id,
        spotsCount: fitSpots,
      });
      remainingAir -= Math.round(unitCost * fitSpots);
    }
  }

  // Проход 2: добираем выходы на выбранных окнах для достижения 5+ касаний
  if (chosen.length > 0 && remainingAir >= 1_500) {
    let improved = true;
    while (improved) {
      improved = false;
      for (const item of chosen) {
        const quote = ranked.find((q) => q.variation.id === item.variationId);
        if (!quote) continue;
        const step = 1;
        if (item.spotsCount + step > quote.variation.maxSpots) continue;
        const extraCost = Math.round(quote.variation.hotRatePerSec * quote.billedSeconds * step);
        if (extraCost <= remainingAir) {
          item.spotsCount += step;
          remainingAir -= extraCost;
          improved = true;
        }
      }
    }
  }

  // Добор до бонусного порога 400 000 ₽, если бюджет >= 400 000 ₽, а лимит maxSpots первого слота уже исчерпан
  if (requireMinAirRub > 0 && airBudgetCap - remainingAir < requireMinAirRub) {
    for (const extraCandidate of ranked) {
      if (chosenIds.has(extraCandidate.variation.id)) continue;
      const unitCost =
        extraCandidate.variation.hotRatePerSec * extraCandidate.billedSeconds;
      const minSpots = extraCandidate.variation.minSpots;
      const minCost = Math.round(unitCost * minSpots);
      if (minCost <= remainingAir) {
        const fitSpots = Math.min(
          extraCandidate.variation.maxSpots,
          Math.max(minSpots, Math.floor(remainingAir / unitCost))
        );
        chosen.push({
          variationId: extraCandidate.variation.id,
          spotsCount: fitSpots,
        });
        chosenIds.add(extraCandidate.variation.id);
        remainingAir -= Math.round(unitCost * fitSpots);
        if (airBudgetCap - remainingAir >= requireMinAirRub) break;
      }
    }
  }

  return chosen;
}

export function aggregatePackageStations(
  selectedQuotes: readonly ComputedVariationQuote[]
): HotAirPackageStationItem[] {
  const byStation = new Map<
    string,
    {
      stationId: string;
      stationName: string;
      frequencyFm: string;
      windowLabels: string[];
      daysSet: Set<string>;
      spotsCount: number;
      reachOTS: number;
      officialPriceRub: number;
      hotPriceRub: number;
    }
  >();

  for (const q of selectedQuotes) {
    const existing = byStation.get(q.stationItem.stationId);
    if (existing) {
      if (!existing.windowLabels.includes(q.variation.label)) {
        existing.windowLabels.push(q.variation.label);
      }
      existing.daysSet.add(q.variation.daysPattern);
      existing.spotsCount += q.spotsCount;
      existing.reachOTS += q.reachOTS;
      existing.officialPriceRub += q.officialPriceRub;
      existing.hotPriceRub += q.hotPriceRub;
    } else {
      byStation.set(q.stationItem.stationId, {
        stationId: q.stationItem.stationId,
        stationName: q.stationItem.station,
        frequencyFm: q.stationItem.frequencyFm,
        windowLabels: [q.variation.label],
        daysSet: new Set([q.variation.daysPattern]),
        spotsCount: q.spotsCount,
        reachOTS: q.reachOTS,
        officialPriceRub: q.officialPriceRub,
        hotPriceRub: q.hotPriceRub,
      });
    }
  }

  return Array.from(byStation.values()).map((st) => {
    const discountPercent =
      st.officialPriceRub > 0 && st.hotPriceRub < st.officialPriceRub
        ? Math.round(((st.officialPriceRub - st.hotPriceRub) / st.officialPriceRub) * 100)
        : 0;
    const daysJoined = Array.from(st.daysSet).join(', ');
    return {
      stationId: st.stationId,
      stationSlug: stationNameToSlug(st.stationName),
      stationName: st.stationName,
      frequencyFm: st.frequencyFm,
      windowsSummary: `${st.windowLabels.join(' + ')} · ${daysJoined}`,
      spotsCount: st.spotsCount,
      reachOTS: st.reachOTS,
      officialPriceRub: st.officialPriceRub,
      hotPriceRub: st.hotPriceRub,
      discountPercent,
    };
  });
}

function buildPackageWhySummary(
  packageId: HotAirPackageId,
  stationBreakdown: readonly HotAirPackageStationItem[],
  plan: FlexibleMediaPlanResult,
  campaignGoal: CampaignGoalId
): string {
  const names = stationBreakdown.map((s) => s.stationName).join(' + ');
  if (!names) {
    return 'Увеличьте бюджет или сократите хронометраж ролика для подбора эфирных окон.';
  }

  if (packageId === 'focus') {
    return stationBreakdown.length === 1
      ? `Концентрация без распыления на ${names} (${plan.totalSpots} вых.) — пробивает порог памяти ЦА.`
      : `Плотная серия выходов на ядре вашей ЦА (${names}) для высокой частоты контакта.`;
  }

  if (packageId === 'balanced') {
    if (campaignGoal === 'brand_3months') {
      return `Эталонная 1-я волна для 3-месячной программы узнаваемости (${names}, скидка −${plan.airDiscountPercent}%).`;
    }
    return stationBreakdown.length === 1
      ? `Целевой прайм на ${names} с высокой долей вашей аудитории и скидкой −${plan.airDiscountPercent}%.`
      : `Сбалансированная связка (${names}) — золотая середина частоты касаний и цены контакта.`;
  }

  return `Максимум эфирных выходов за этот бюджет (${plan.totalSpots} вых. на ${names}) под широкую акцию.`;
}

/**
 * Мгновенно (0 мс) рассчитывает 3 готовых пакета радиоэфира со скидкой
 * («Точный фокус», «Оптимальный баланс», «Максимальный охват») и их научную диагностику 5+ касаний.
 */
export function buildThreeReadyPackages(params: {
  portraitId: HotAirPortraitId;
  totalBudgetRub: number;
  campaignGoal?: CampaignGoalId;
  spotSeconds?: number;
  spotReadiness?: SpotReadinessMode;
  productNote?: string;
  stationsCatalog?: readonly RadioStationCatalogItem[];
  layaPersona?: LayaPersona;
  aiHint?: AiSemanticRecommendationHint | null;
}): HotAirReadyPackage[] {
  const portrait = getAudiencePortraitById(params.portraitId);
  const campaignGoal = params.campaignGoal ?? 'promo_burst';
  const clampedBudget = Math.max(
    MIN_FLEXIBLE_BUDGET_RUB,
    Math.min(MAX_FLEXIBLE_BUDGET_RUB, Math.round(params.totalBudgetRub))
  );
  const spotSeconds = clampExactSpotSeconds(params.spotSeconds ?? 15);
  const spotReadiness = params.spotReadiness ?? 'need_production_24h';
  const catalog = params.stationsCatalog
    ? [...params.stationsCatalog]
    : buildUnified12StationCatalog();

  const baseEval = computeFlexibleMediaPlanSummary({
    niche: portrait.niche,
    audience: portrait.audience,
    productNote: params.productNote,
    totalBudgetRub: clampedBudget,
    spotSeconds,
    spotReadiness,
    selectedVariations: [],
    stationsCatalog: catalog,
    layaPersona: params.layaPersona,
    aiHint: params.aiHint,
  });

  const eligibleQuotes = baseEval.allQuotedVariations.filter(
    (q) => q.isEligibleForTimeGate && q.isEligibleForDuration
  );

  const baseProdSpec = computeProductionCostForExactSeconds({
    spotSeconds,
    spotReadiness,
    hotAirTotalRub: 0,
  });

  const canTryBonusMode = clampedBudget >= AIR_BONUS_THRESHOLD_RUB;
  const usedSingleLeadIds = new Set<string>();

  const specs: readonly {
    id: HotAirPackageId;
    indexLabel: '01' | '02' | '03';
    title: string;
    subtitle: string;
    isRecommended: boolean;
  }[] = [
    {
      id: 'focus',
      indexLabel: '01',
      title: 'Точный фокус',
      subtitle: 'Максимум частоты в ядре ЦА',
      isRecommended: false,
    },
    {
      id: 'balanced',
      indexLabel: '02',
      title: 'Оптимальный баланс',
      subtitle: 'Прайм-связка цены и касаний',
      isRecommended: true,
    },
    {
      id: 'reach',
      indexLabel: '03',
      title: 'Максимальный охват',
      subtitle: 'Больше выходов за бюджет',
      isRecommended: false,
    },
  ];

  return specs.map((spec) => {
    const standardAirCap = Math.max(0, clampedBudget - baseProdSpec.basePriceRub);
    const standardSelection = buildStrategySelectionForAirBudget({
      eligibleQuotes,
      packageId: spec.id,
      portrait,
      campaignGoal,
      airBudgetCap: standardAirCap,
      totalBudgetRub: clampedBudget,
      discourageLeadVariationIds: usedSingleLeadIds,
    });

    let resolvedSelection = standardSelection;
    let resolvedPlan = computeFlexibleMediaPlanSummary({
      niche: portrait.niche,
      audience: portrait.audience,
      productNote: params.productNote,
      totalBudgetRub: clampedBudget,
      spotSeconds,
      spotReadiness,
      selectedVariations: standardSelection,
      stationsCatalog: catalog,
      layaPersona: params.layaPersona,
      aiHint: params.aiHint,
    });

    if (canTryBonusMode) {
      const bonusSelection = buildStrategySelectionForAirBudget({
        eligibleQuotes,
        packageId: spec.id,
        portrait,
        campaignGoal,
        airBudgetCap: clampedBudget,
        totalBudgetRub: clampedBudget,
        discourageLeadVariationIds: usedSingleLeadIds,
        requireMinAirRub: AIR_BONUS_THRESHOLD_RUB,
      });

      const bonusPlan = computeFlexibleMediaPlanSummary({
        niche: portrait.niche,
        audience: portrait.audience,
        productNote: params.productNote,
        totalBudgetRub: clampedBudget,
        spotSeconds,
        spotReadiness,
        selectedVariations: bonusSelection,
        stationsCatalog: catalog,
        layaPersona: params.layaPersona,
        aiHint: params.aiHint,
      });

      if (
        bonusPlan.production.isBonusUnlocked &&
        bonusPlan.totalClientCostRub <= clampedBudget &&
        bonusPlan.totalSpots >= resolvedPlan.totalSpots
      ) {
        resolvedSelection = bonusSelection;
        resolvedPlan = bonusPlan;
      }
    }

    if (resolvedSelection.length === 1) {
      usedSingleLeadIds.add(resolvedSelection[0].variationId);
    }

    const stationBreakdown = aggregatePackageStations(resolvedPlan.selectedQuotes);
    const science = evaluateMediaScienceDiagnostic({
      plan: resolvedPlan,
      campaignGoal,
    });

    return {
      id: spec.id,
      indexLabel: spec.indexLabel,
      title: spec.title,
      subtitle: spec.subtitle,
      isRecommended: spec.isRecommended,
      whySummary: buildPackageWhySummary(
        spec.id,
        stationBreakdown,
        resolvedPlan,
        campaignGoal
      ),
      selectedVariations: resolvedSelection,
      stationBreakdown,
      plan: resolvedPlan,
      science,
    };
  });
}
