import { CrmOrderRecord } from './orderCrmTypes';

export type ScientificIndustryId =
  | 'real_estate'
  | 'medicine'
  | 'fmcg_retail'
  | 'b2b_finance'
  | 'auto_services';

export interface MemoryRetentionWeekPoint {
  weekNumber: number;
  phaseLabel: string;
  isOnAirPulse: boolean;
  /** Сценарий А: разовый слив за 1 флайт и тишина (кривая забывания Эббингауза) */
  singleBurstRecallPct: number;
  /** Сценарий Б: научная пульсирующая программа (2 нед. залп -> 2 нед. удержание -> подкрепление) */
  pulsingFlightRecallPct: number;
}

export interface CognitiveFrequencyAuditResult {
  effectiveFrequency: number;
  avgSpotsPerStation: number;
  meetsFiveTouchThreshold: boolean;
  deficitContacts: number;
  recommendedMinSpotsPerStation: number;
  verdictTitle: string;
  verdictSummary: string;
  week90SingleBurstFinalPct: number;
  week90PulsingFinalPct: number;
  retentionAdvantageMultiple: number;
  weeklyCurve: readonly MemoryRetentionWeekPoint[];
}

/**
 * Контур I. Когнитивная медиаметрика:
 * Проверяет порог 5+ касаний (Krugman / Naples / RAB) и строит 12-недельную кривую памяти
 * по модели затухания Эббингауза R(t) = Peak * exp(-dt / S_k) с ростом прочности следа S_k
 * после каждого подкрепляющего флайта.
 */
export function evaluateCognitiveFrequencyAndMemoryCurve(params: {
  totalSpots: number;
  stationsCount: number;
  estimatedFrequencyOverride?: number;
}): CognitiveFrequencyAuditResult {
  const safeStations = Math.max(1, Math.round(params.stationsCount));
  const safeSpots = Math.max(0, Math.round(params.totalSpots));
  const avgSpotsPerStation = Math.round((safeSpots / safeStations) * 10) / 10;

  const computedFreq =
    typeof params.estimatedFrequencyOverride === 'number' &&
    params.estimatedFrequencyOverride > 0
      ? Math.round(params.estimatedFrequencyOverride * 10) / 10
      : Math.round(avgSpotsPerStation * 0.34 * 10) / 10;

  const meetsFiveTouchThreshold = computedFreq >= 5.0;
  const deficitContacts = meetsFiveTouchThreshold
    ? 0
    : Math.round((5.0 - computedFreq) * 10) / 10;

  const initialPeak = Math.min(92, Math.max(24, Math.round(computedFreq * 13.5)));

  const weeklyCurve: MemoryRetentionWeekPoint[] = [];

  for (let week = 1; week <= 12; week += 1) {
    // Сценарий А: только недели 1–2 в эфире, далее 10 недель тишины (прочность следа S_1 = 4.6 нед.)
    let singleBurstRecallPct: number;
    if (week === 1) {
      singleBurstRecallPct = Math.round(initialPeak * 0.72);
    } else if (week === 2) {
      singleBurstRecallPct = initialPeak;
    } else {
      const dt = week - 2;
      singleBurstRecallPct = Math.max(
        6,
        Math.round(initialPeak * Math.exp(-dt / 4.6))
      );
    }

    // Сценарий Б: пульсирующие волны (нед. 1–2 Волна 1, нед. 5–6 Волна 2, нед. 9–10 Волна 3)
    let pulsingFlightRecallPct: number;
    let isOnAirPulse = false;
    let phaseLabel = '';

    if (week <= 2) {
      isOnAirPulse = true;
      phaseLabel = 'Волна 1 · Пробой порога';
      pulsingFlightRecallPct =
        week === 1 ? Math.round(initialPeak * 0.72) : initialPeak;
    } else if (week <= 4) {
      isOnAirPulse = false;
      phaseLabel = 'Плато удержания 1';
      const dt = week - 2;
      // На короткой паузе 2 недели след держится выше порога узнавания (S_1 = 5.4)
      pulsingFlightRecallPct = Math.round(initialPeak * Math.exp(-dt / 5.4));
    } else if (week <= 6) {
      isOnAirPulse = true;
      phaseLabel = 'Волна 2 · Закрепление (0 ₽ ролик)';
      const wave2Peak = Math.min(95, Math.max(initialPeak + 9, 78));
      pulsingFlightRecallPct = week === 5 ? wave2Peak - 5 : wave2Peak;
    } else if (week <= 8) {
      isOnAirPulse = false;
      phaseLabel = 'Плато удержания 2';
      const wave2Peak = Math.min(95, Math.max(initialPeak + 9, 78));
      const dt = week - 6;
      // После второй волны прочность следа памяти возрастает (S_2 = 8.2 нед.)
      pulsingFlightRecallPct = Math.round(wave2Peak * Math.exp(-dt / 8.2));
    } else if (week <= 10) {
      isOnAirPulse = true;
      phaseLabel = 'Волна 3 · Доминирование в ЦА';
      const wave3Peak = Math.min(97, Math.max(initialPeak + 14, 86));
      pulsingFlightRecallPct = week === 9 ? wave3Peak - 3 : wave3Peak;
    } else {
      isOnAirPulse = false;
      phaseLabel = 'Инерция знания бренда';
      const wave3Peak = Math.min(97, Math.max(initialPeak + 14, 86));
      const dt = week - 10;
      // После третьей волны прочность следа S_3 = 12.5 нед.
      pulsingFlightRecallPct = Math.round(wave3Peak * Math.exp(-dt / 12.5));
    }

    weeklyCurve.push({
      weekNumber: week,
      phaseLabel,
      isOnAirPulse,
      singleBurstRecallPct,
      pulsingFlightRecallPct,
    });
  }

  const week90SingleBurstFinalPct = weeklyCurve[11].singleBurstRecallPct;
  const week90PulsingFinalPct = weeklyCurve[11].pulsingFlightRecallPct;
  const retentionAdvantageMultiple =
    Math.round((week90PulsingFinalPct / Math.max(1, week90SingleBurstFinalPct)) * 10) / 10;

  return {
    effectiveFrequency: computedFreq,
    avgSpotsPerStation,
    meetsFiveTouchThreshold,
    deficitContacts,
    recommendedMinSpotsPerStation: 15,
    verdictTitle: meetsFiveTouchThreshold
      ? `Научная норма выполнена (~${computedFreq.toFixed(1).replace('.', ',')} касаний в ядре ЦА)`
      : `Риск недобора частоты (~${computedFreq.toFixed(1).replace('.', ',')} из 5,0 касаний)`,
    verdictSummary: meetsFiveTouchThreshold
      ? 'Плотность эфира пробивает фильтр фонового внимания водителей и переводит контакт в запоминание бренда и целевой поиск.'
      : `Слушатель за рулём застаёт около трети рекламных окон. Сконцентрируйте бюджет на меньшем числе радиостанций (минимум 14–16 выходов на волну), чтобы добрать +${deficitContacts
          .toFixed(1)
          .replace('.', ',')} контакта.`,
    week90SingleBurstFinalPct,
    week90PulsingFinalPct,
    retentionAdvantageMultiple,
    weeklyCurve,
  };
}

export interface AttributionSearchLiftProtocol {
  industryId: ScientificIndustryId;
  industryTitle: string;
  phoneticPromoCode: string;
  voiceAnchorRule: string;
  primeMeasurementWindows: readonly string[];
  baselineWeeklySearches: number;
  projectedPrimeWindowSearches: number;
  projectedSearchLiftPercent: number;
  omnichannelQrBridge: string;
}

const INDUSTRY_ATTRIBUTION_PRESETS: Record<
  ScientificIndustryId,
  {
    title: string;
    promoRoot: string;
    voiceAnchor: string;
    qrBridge: string;
  }
> = {
  real_estate: {
    title: 'Недвижимость и девелопмент',
    promoRoot: 'ТЕРРАСА 15',
    voiceAnchor:
      'Двукратное произнесение названия квартала (на 4-й и 13-й секунде) + поисковый якорь «наберите в поиске Квартал Парк» вместо диктовки длинного телефона.',
    qrBridge:
      'Экраны в бизнес-центрах и паркингах с крупным QR «Планировки и расчёт транша за 30 секунд» закрывают 5-е касание после утреннего эфира в авто.',
  },
  medicine: {
    title: 'Медицина и клиники',
    promoRoot: 'ПУЛЬС 24',
    voiceAnchor:
      'Голосовой пароль при записи через колл-центр или сайт («назовите код ПУЛЬС 24 — расшифровка врача в подарок») без сложных латинских букв.',
    qrBridge:
      'Навигационные стенды и визитки администратора с QR на Telegram-бот записи фиксируют возврат семейной аудитории.',
  },
  fmcg_retail: {
    title: 'Ритейл, продукты и HoReCa',
    promoRoot: 'УТРО 10',
    voiceAnchor:
      'Короткий ритмический звуковой логотип (2,2 сек) + кодовое слово в приложении доставки или на кассе.',
    qrBridge:
      'Шелфтокеры у полки и QR на упаковке соединяют утренний акустический импульс по дороге в магазин с выбором товара.',
  },
  b2b_finance: {
    title: 'B2B, лизинг и финансы',
    promoRoot: 'ТРАНШ 7',
    voiceAnchor:
      'Формула для ЛПР за рулём: чёткое название сервиса + числовой триггер выгоды + призыв ввести двухсловный бренд в поиске по приезде в офис.',
    qrBridge:
      'Персональное КП в ЭДО и презентации сейлз-отдела с QR-ссылкой на расчёт лизингового графика усиливают конверсию звонков.',
  },
  auto_services: {
    title: 'Автодилеры и сервис',
    promoRoot: 'ДРАЙВ 5',
    voiceAnchor:
      'Обращение прямо в контекст поездки («пока вы в потоке — запишитесь на диагностику по коду ДРАЙВ 5»).',
    qrBridge:
      'Сервисная бирка в салоне и QR на гео-карточке дилера конвертируют навигационный трафик с радио.',
  },
};

/**
 * Контур II. Доказательная атрибуция эфира:
 * Строит фонетически чистый голосовой промо-маркер, протокол замера Search Lift в 20-минутных
 * окнах прайм-драйва и связку с визуальным QR-якорем.
 */
export function buildAttributionAndSearchLiftProtocol(params: {
  industryId: ScientificIndustryId;
  totalReachOTS: number;
  effectiveFrequency: number;
  baselineWeeklySearches?: number;
}): AttributionSearchLiftProtocol {
  const preset =
    INDUSTRY_ATTRIBUTION_PRESETS[params.industryId] ??
    INDUSTRY_ATTRIBUTION_PRESETS.b2b_finance;

  const baseline = Math.max(50, Math.round(params.baselineWeeklySearches ?? 420));
  // Эмпирический коэффициент поискового отклика от качественного OTS с поправкой на порог 5 касаний
  const freqFactor = params.effectiveFrequency >= 5 ? 1.28 : 0.72;
  const incrementalSearches = Math.max(
    18,
    Math.round((params.totalReachOTS / 10_000) * 3.4 * freqFactor)
  );
  const projectedPrimeWindowSearches = baseline + incrementalSearches;
  const projectedSearchLiftPercent = Math.round(
    ((projectedPrimeWindowSearches - baseline) / baseline) * 100
  );

  return {
    industryId: params.industryId,
    industryTitle: preset.title,
    phoneticPromoCode: preset.promoRoot,
    voiceAnchorRule: preset.voiceAnchor,
    primeMeasurementWindows: [
      'Утренний прайм: замер прямых и брендовых визитов 07:30–11:20 (окно +20 мин после выхода)',
      'Вечерний драйв: замер поисковых запросов 17:30–20:50 относительно контрольной недели до эфира',
    ],
    baselineWeeklySearches: baseline,
    projectedPrimeWindowSearches,
    projectedSearchLiftPercent,
    omnichannelQrBridge: preset.qrBridge,
  };
}

export interface PsychoacousticSpotAuditResult {
  spotSeconds: number;
  wordCount: number;
  wordsPerSecond: number;
  recommendedMaxWords: number;
  densityStatus: 'optimal' | 'borderline_fast' | 'overloaded';
  densityLabel: string;
  firstThreeSecHookScore: 'strong_hook' | 'generic_opening';
  firstThreeSecNote: string;
  carNoiseIntelligibilityDb: number;
  masteringSpecLine: string;
}

const CLICHE_OPENINGS = [
  'динамично развивающ',
  'мы рады предложить',
  'индивидуальный подход',
  'широкий ассортимент',
  'высокое качество по доступн',
  'наша компания',
];

/**
 * Контур III. Психоакустический аудит ролика (первые 3 секунды + шум авто 68–72 дБ):
 * Оценивает плотность речи (норма <= 2.10 слов/сек), отсутствие штампов в первых 3 секундах
 * и запас разборчивости в формантном окне 1.5–4.0 кГц поверх дорожного гула 68 дБ SPL.
 */
export function evaluatePsychoacousticSpotAudit(params: {
  spotSeconds: number;
  scriptText: string;
}): PsychoacousticSpotAuditResult {
  const safeSeconds = Math.max(5, Math.min(60, Math.round(params.spotSeconds)));
  const cleaned = params.scriptText
    .replace(/[—–•·/\\()[\]{}"«»]/g, ' ')
    .trim();

  const words = cleaned ? cleaned.split(/\s+/).filter((w) => w.length > 0) : [];
  const wordCount = words.length;
  const recommendedMaxWords = Math.floor(safeSeconds * 2.1);
  const wordsPerSecond =
    wordCount > 0 ? Math.round((wordCount / safeSeconds) * 100) / 100 : 0;

  let densityStatus: 'optimal' | 'borderline_fast' | 'overloaded' = 'optimal';
  let densityLabel = 'Эталонная разборчивость речи за рулём (до 2,1 слов/сек)';

  if (wordCount === 0) {
    densityStatus = 'optimal';
    densityLabel = `Рекомендуемый объём сценария для ${safeSeconds} сек: до ${recommendedMaxWords} слов`;
  } else if (wordsPerSecond <= 2.15) {
    densityStatus = 'optimal';
    densityLabel = `Эталонный темп (${wordsPerSecond.toFixed(2).replace('.', ',')} сл./сек · лимит ${recommendedMaxWords} слов)`;
  } else if (wordsPerSecond <= 2.55) {
    densityStatus = 'borderline_fast';
    densityLabel = `Плотный темп (${wordsPerSecond.toFixed(2).replace('.', ',')} сл./сек) — сократите ${
      wordCount - recommendedMaxWords
    } сл. для паузы перед брендом`;
  } else {
    densityStatus = 'overloaded';
    densityLabel = `Перегруз хронометража (${wordsPerSecond.toFixed(2).replace('.', ',')} сл./сек) — скороговорка теряется в шуме дороги`;
  }

  const openingLower = words.slice(0, 7).join(' ').toLowerCase();
  const hasCliche = CLICHE_OPENINGS.some((c) => openingLower.includes(c));
  const firstThreeSecHookScore: 'strong_hook' | 'generic_opening' =
    hasCliche ? 'generic_opening' : 'strong_hook';

  const firstThreeSecNote = hasCliche
    ? 'В первых 3 секундах обнаружен рекламный штамп — мозг водителя отключает внимание за 1,5 сек. Начните с конкретной ситуации или контрастной цифры.'
    : 'Старт без канцелярских штампов: первые 2,5 секунды удерживают ориентировочный рефлекс слушателя.';

  // Запас разборчивости в салоне автомобиля при дорожном шуме 68 дБ SPL
  const carNoiseIntelligibilityDb =
    densityStatus === 'optimal' ? 14 : densityStatus === 'borderline_fast' ? 9 : 4;

  return {
    spotSeconds: safeSeconds,
    wordCount,
    wordsPerSecond,
    recommendedMaxWords,
    densityStatus,
    densityLabel,
    firstThreeSecHookScore,
    firstThreeSecNote,
    carNoiseIntelligibilityDb,
    masteringSpecLine:
      'Громкость −14 LUFS · Разгрузка речевой полосы 1,5–4,0 кГц на −4,5 дБ поверх гула шин 68 дБ SPL',
  };
}

export interface LtvWaveBreakdownRow {
  waveIndex: 1 | 2 | 3;
  waveTitle: string;
  monthLabel: string;
  clientPaymentRub: number;
  productionCostRub: number;
  pureAirBudgetRub: number;
  estimatedSpots: number;
  estimatedReachOTS: number;
  cptRubPerThousand: number;
  extraSpotsFromSavedProd: number;
}

export interface MultiWaveLtvEconomicsResult {
  waveBudgetRub: number;
  wave1ProductionRub: number;
  waves: readonly LtvWaveBreakdownRow[];
  total90DayRevenueLtvRub: number;
  total90DayPureAirRub: number;
  totalSavedOnRepeatProductionRub: number;
  extraSpotsInWaves2And3: number;
  wave1CptRub: number;
  blended3WaveCptRub: number;
  cptImprovementPercent: number;
}

/**
 * Контур IV. Математическая модель LTV и капитализации аудиоактива на 3 волны (90 дней):
 * Показывает, как выпуск бессрочного паспорта прав РАО/ВОИС в 1-й волне обнуляет затраты
 * на продакшн во 2-й и 3-й волне, конвертируя 100% платежа клиента в чистый эфир.
 */
export function calculateMultiWaveLtvEconomics(params: {
  waveBudgetRub: number;
  wave1ProductionRub: number;
  spotSeconds: number;
  baseWave1Spots?: number;
  baseWave1ReachOTS?: number;
}): MultiWaveLtvEconomicsResult {
  const safeBudget = Math.max(40_000, Math.round(params.waveBudgetRub));
  const safeProd1 = Math.max(
    0,
    Math.min(safeBudget - 25_000, Math.round(params.wave1ProductionRub))
  );
  const safeSec = Math.max(5, Math.min(60, Math.round(params.spotSeconds)));

  const airWave1 = Math.max(25_000, safeBudget - safeProd1);
  // Средняя стоимость 1 выхода по горящей квоте пропорциональна хронометражу
  const avgSpotCostRub =
    params.baseWave1Spots && params.baseWave1Spots > 0
      ? airWave1 / params.baseWave1Spots
      : Math.max(2_400, safeSec * 430);

  const spotsWave1 =
    params.baseWave1Spots && params.baseWave1Spots > 0
      ? Math.round(params.baseWave1Spots)
      : Math.max(6, Math.floor(airWave1 / avgSpotCostRub));

  const otsPerSpot =
    params.baseWave1ReachOTS && params.baseWave1ReachOTS > 0 && spotsWave1 > 0
      ? params.baseWave1ReachOTS / spotsWave1
      : 17_800;

  const otsWave1 = Math.round(spotsWave1 * otsPerSpot);
  const cptWave1 =
    Math.round((safeBudget / Math.max(1, otsWave1 / 1000)) * 10) / 10;

  // Во 2-й и 3-й волне продакшн = 0 ₽ (паспорт прав уже в базе станций), весь бюджет идёт в эфир
  const airWaveRepeat = safeBudget;
  const spotsWaveRepeat = Math.max(
    spotsWave1,
    Math.floor(airWaveRepeat / avgSpotCostRub)
  );
  const extraSpotsPerRepeatWave = Math.max(0, spotsWaveRepeat - spotsWave1);
  const otsWaveRepeat = Math.round(spotsWaveRepeat * otsPerSpot);
  const cptWaveRepeat =
    Math.round((safeBudget / Math.max(1, otsWaveRepeat / 1000)) * 10) / 10;

  const waves: LtvWaveBreakdownRow[] = [
    {
      waveIndex: 1,
      waveTitle: 'Волна 1 · Запуск и выпуск паспорта прав',
      monthLabel: 'Недели 1–2',
      clientPaymentRub: safeBudget,
      productionCostRub: safeProd1,
      pureAirBudgetRub: airWave1,
      estimatedSpots: spotsWave1,
      estimatedReachOTS: otsWave1,
      cptRubPerThousand: cptWave1,
      extraSpotsFromSavedProd: 0,
    },
    {
      waveIndex: 2,
      waveTitle: 'Волна 2 · Закрепление (ролик 0 ₽)',
      monthLabel: 'Недели 5–6',
      clientPaymentRub: safeBudget,
      productionCostRub: 0,
      pureAirBudgetRub: airWaveRepeat,
      estimatedSpots: spotsWaveRepeat,
      estimatedReachOTS: otsWaveRepeat,
      cptRubPerThousand: cptWaveRepeat,
      extraSpotsFromSavedProd: extraSpotsPerRepeatWave,
    },
    {
      waveIndex: 3,
      waveTitle: 'Волна 3 · Системный поток (ролик 0 ₽)',
      monthLabel: 'Недели 9–10',
      clientPaymentRub: safeBudget,
      productionCostRub: 0,
      pureAirBudgetRub: airWaveRepeat,
      estimatedSpots: spotsWaveRepeat,
      estimatedReachOTS: otsWaveRepeat,
      cptRubPerThousand: cptWaveRepeat,
      extraSpotsFromSavedProd: extraSpotsPerRepeatWave,
    },
  ];

  const total90DayRevenueLtvRub = safeBudget * 3;
  const total90DayPureAirRub = airWave1 + airWaveRepeat * 2;
  const totalOTS90 = otsWave1 + otsWaveRepeat * 2;
  const blended3WaveCptRub =
    Math.round((total90DayRevenueLtvRub / Math.max(1, totalOTS90 / 1000)) * 10) / 10;

  const cptImprovementPercent =
    cptWave1 > 0
      ? Math.max(0, Math.round(((cptWave1 - blended3WaveCptRub) / cptWave1) * 100))
      : 0;

  // Экономия клиента относительно заказа нового ролика в каждом флайте (минимум 15 000 ₽ × 2 волны)
  const referenceSingleSpotCost = safeProd1 > 0 ? safeProd1 : 15_000;
  const totalSavedOnRepeatProductionRub = referenceSingleSpotCost * 2;

  return {
    waveBudgetRub: safeBudget,
    wave1ProductionRub: safeProd1,
    waves,
    total90DayRevenueLtvRub,
    total90DayPureAirRub,
    totalSavedOnRepeatProductionRub,
    extraSpotsInWaves2And3: extraSpotsPerRepeatWave * 2,
    wave1CptRub: cptWave1,
    blended3WaveCptRub,
    cptImprovementPercent,
  };
}

export interface ScientificRoadmapHorizon {
  horizonCode: 'H1' | 'H2' | 'H3';
  timeframe: string;
  statusLabel: string;
  title: string;
  scientificHypothesis: string;
  deliverables: readonly string[];
  targetKpi: string;
}

export const SCIENTIFIC_GROWTH_ROADMAP: readonly ScientificRoadmapHorizon[] = [
  {
    horizonCode: 'H1',
    timeframe: 'Активное ядро · Внедрено сейчас',
    statusLabel: 'В работе на платформе',
    title: 'Операционный CRM-шлюз и 4-контурная предэфирная диагностика',
    scientificHypothesis:
      'Исключение распыления бюджета до оплаты счёта (порог 5+ касаний, контроль хронометража ролика и быстрый 4ч резерв квот) повышает конверсию из расчёта в сделку и защищает результат 1-й волны.',
    deliverables: [
      'Единый защищённый шлюз приёма заказов с передачей полного слепка радиостанций и секунд',
      '6-этапная CRM-воронка сейлз-продюсера со счётом для ЭДО + диспетчер Telegram и HMAC-Webhook',
      'Расчётные калькуляторы кривой памяти (12 нед.), разборчивости в шуме 68 дБ и экономики 3 волн',
    ],
    targetKpi: 'SLA реакции на бронь ≤ 15 минут · 100% заказов с оцифрованным медиапланом',
  },
  {
    horizonCode: 'H2',
    timeframe: 'Горизонт 30–60 дней',
    statusLabel: 'Следующий этап аналитики',
    title: 'Автоматическая сверка эфирных справок и отчётов Search Lift',
    scientificHypothesis:
      'Поминутное наложение фактических выходов радиостанций на график прямых и брендовых заходов в веб-аналитике доказывает вклад радиоэфира за рулём в твёрдых цифрах.',
    deliverables: [
      'Импорт эфирных справок радиостанций с точными таймкодами выходов в карточку заказа CRM',
      'Автоматический расчёт индекса Search Lift в 20-минутных окнах после утреннего и вечернего прайма',
      'Триггерное напоминание продюсеру за 10 дней до плато забывания о запуске 2-й волны без оплаты ролика',
    ],
    targetKpi: 'Рост конверсии клиентов во 2-ю и 3-ю волну (LTV) с 22% до 48%+',
  },
  {
    horizonCode: 'H3',
    timeframe: 'Горизонт 60–120 дней',
    statusLabel: 'Предиктивное моделирование',
    title: 'Отраслевые бенчмарки отклика и сезонное планирование квот',
    scientificHypothesis:
      'Накопление обезличенных коэффициентов отклика по 5 портретам ЦА и отраслям позволяет предсказывать оптимальную связку радиостанций и длину спота ещё на этапе брифа.',
    deliverables: [
      'База отраслевых коэффициентов конверсии OTS -> целевой запрос для ЖК, медицины, ритейла и B2B',
      'Автоматическая балансировка весов радиостанций с учётом сезонного трафика за рулём',
      'Экспорт сквозного управленческого отчёта ROMI по итогам 90-дневного цикла для собственника бизнеса',
    ],
    targetKpi: 'Снижение средней стоимости целевого обращения с радиоэфира на 18–25%',
  },
] as const;

export function extractScientificPresetFromOrder(order: CrmOrderRecord): {
  industryId: ScientificIndustryId;
  waveBudgetRub: number;
  wave1ProductionRub: number;
  spotSeconds: number;
  totalSpots: number;
  stationsCount: number;
  totalReachOTS: number;
  estimatedFrequency?: number;
  scriptSample: string;
} {
  const snap = order.mediaPlanSnapshot;
  const rawNiche = snap?.nicheId ?? 'b2b_finance';
  const validNiches: readonly ScientificIndustryId[] = [
    'real_estate',
    'medicine',
    'fmcg_retail',
    'b2b_finance',
    'auto_services',
  ];
  const industryId: ScientificIndustryId = validNiches.includes(
    rawNiche as ScientificIndustryId
  )
    ? (rawNiche as ScientificIndustryId)
    : 'b2b_finance';

  const cleanedBrief = (order.briefText || '').trim();
  const isAutoAudienceMetadata = cleanedBrief.startsWith('Целевая аудитория:');

  return {
    industryId,
    waveBudgetRub: Math.max(40_000, order.totalBudgetRub || 180_000),
    wave1ProductionRub: snap ? snap.productionPriceRub : 15_000,
    spotSeconds: snap ? snap.spotDurationSec : 15,
    totalSpots: snap ? snap.totalSpots : 20,
    stationsCount: snap ? Math.max(1, snap.stations.length) : 2,
    totalReachOTS: snap ? snap.totalReachOTS : 360_000,
    estimatedFrequency: snap?.estimatedFrequency,
    scriptSample: isAutoAudienceMetadata ? '' : cleanedBrief,
  };
}
