import {
  type B2bRegulatoryCategoryId,
  detectRegulatoryCategoryFromOrderText,
  type ResolvedRegulatoryCategoryId,
} from './b2bContractLedgerCore.ts';
import type { IndustryVerticalSlug } from './platformRouter.ts';
import type { OrderFormatId } from './pricingData.ts';
import {
  calculateScriptChronometer,
  clampExactSpotSeconds,
  resolveNearestStandardDuration,
  SCRIPT_TEMPO_OPTIONS,
  type ScriptTempoId,
  type StandardSpotDuration,
} from './scriptChronometer.ts';

export { SCRIPT_TEMPO_OPTIONS, type ScriptTempoId, type StandardSpotDuration };

export type ClientFz38CategorySelection = B2bRegulatoryCategoryId;

export interface ClientFz38CategorySpec {
  id: ResolvedRegulatoryCategoryId;
  shortLabel: string;
  legalNorm: string;
  disclaimerSec: number;
  mappedIndustryPreset: IndustryVerticalSlug | null;
  sampleDisclaimerText: string;
  moderationRuleNote: string;
}

export const CLIENT_FZ38_CATEGORY_SPECS: Record<
  ResolvedRegulatoryCategoryId,
  ClientFz38CategorySpec
> = {
  general_b2b: {
    id: 'general_b2b',
    shortLabel: 'Обычные товары / B2B',
    legalNorm: 'ч. 1 ст. 5 ФЗ-38 «О рекламе»',
    disclaimerSec: 0,
    mappedIndustryPreset: null,
    sampleDisclaimerText: '',
    moderationRuleNote:
      'Обязательный голосовой дисклеймер не требуется, если в тексте нет обещаний «№ 1 / самый лучший», дистанционной продажи без ОГРН или возрастных ограничений.',
  },
  real_estate_214fz: {
    id: 'real_estate_214fz',
    shortLabel: 'Недвижимость и ЖК',
    legalNorm: 'ч. 7 ст. 28 ФЗ-38 · 214-ФЗ',
    disclaimerSec: 3,
    mappedIndustryPreset: 'real-estate',
    sampleDisclaimerText:
      'Застройщик ООО «Специализированный застройщик …». Проектная декларация на сайте наш.дом.рф.',
    moderationRuleNote:
      'В радиоролике долевого строительства обязательно озвучиваются полное наименование застройщика и адрес публикации проектной декларации на наш.дом.рф.',
  },
  finance_credit_28fz: {
    id: 'finance_credit_28fz',
    shortLabel: 'Финансы / ипотека / лизинг',
    legalNorm: 'ст. 28 ФЗ-38 «О рекламе»',
    disclaimerSec: 3.5,
    mappedIndustryPreset: 'b2b-finance',
    sampleDisclaimerText:
      'Оценивайте свои финансовые возможности и риски. Изучите все условия кредита на сайте банка. Генеральная лицензия Банка России № …',
    moderationRuleNote:
      'При упоминании процентной ставки или платежа обязательно озвучиваются диапазон полной стоимости кредита (ПСК), наименование банка/лизингодателя и предупреждение о рисках.',
  },
  medicine_24fz: {
    id: 'medicine_24fz',
    shortLabel: 'Медицина и клиники',
    legalNorm: 'ч. 7 ст. 24 ФЗ-38 «О рекламе»',
    disclaimerSec: 3.5,
    mappedIndustryPreset: 'medicine',
    sampleDisclaimerText:
      'Имеются противопоказания. Необходима консультация специалиста.',
    moderationRuleNote:
      'По закону «О рекламе» в радиопрограммах предупреждение о наличии противопоказаний должно звучать разборчиво не менее 3 (трёх) секунд чистого эфирного времени.',
  },
  promo_stim_9fz: {
    id: 'promo_stim_9fz',
    shortLabel: 'Акции, скидки и розыгрыши',
    legalNorm: 'ст. 9 ФЗ-38 «О рекламе»',
    disclaimerSec: 2.5,
    mappedIndustryPreset: 'retail-fmcg',
    sampleDisclaimerText:
      'Акция действует с 1 по 30 ноября. Подробности об организаторе, правилах и сроках — на сайте компании.',
    moderationRuleNote:
      'В рекламе стимулирующего мероприятия обязательно указываются сроки проведения акции и источник информации об организаторе, правилах, количестве призов и порядке их получения.',
  },
};

export const CLIENT_FZ38_SELECTOR_OPTIONS: readonly {
  id: ClientFz38CategorySelection;
  label: string;
  badgeSec: string;
}[] = [
  { id: 'auto', label: 'Авто по тексту', badgeSec: 'авто' },
  { id: 'general_b2b', label: 'Без сносок (B2B / услуги)', badgeSec: '0 с' },
  { id: 'real_estate_214fz', label: 'Недвижимость / ЖК', badgeSec: '+3 с' },
  { id: 'finance_credit_28fz', label: 'Финансы / лизинг', badgeSec: '+3.5 с' },
  { id: 'medicine_24fz', label: 'Медицина (мин. 3 с)', badgeSec: '+3.5 с' },
  { id: 'promo_stim_9fz', label: 'Акция / скидка', badgeSec: '+2.5 с' },
] as const;

export interface ClientChronometerSampleItem {
  id: string;
  label: string;
  tempo: ScriptTempoId;
  category: ClientFz38CategorySelection;
  targetSlotSec: number;
  text: string;
}

export const CLIENT_CHRONOMETER_SAMPLES: readonly ClientChronometerSampleItem[] = [
  {
    id: 'realty-20s',
    label: 'ЖК бизнес-класса (20 сек)',
    tempo: 'calm_image',
    category: 'auto',
    targetSlotSec: 20,
    text: 'Тихий приватный двор с соснами в пяти минутах от делового центра. Квартиры с панорамными окнами в жилом комплексе «Речной Парк». Звоните 240-15-80.',
  },
  {
    id: 'clinic-20s',
    label: 'Семейная клиника (20 сек)',
    tempo: 'calm_image',
    category: 'auto',
    targetSlotSec: 20,
    text: 'Комплексная диагностика зрения и подбор коррекции за один утренний визит без очередей. Клиника микрохирургии «СветМед», запись по телефону 310-77-00.',
  },
  {
    id: 'b2b-leasing-15s',
    label: 'B2B-лизинг (15 сек)',
    tempo: 'business_standard',
    category: 'auto',
    targetSlotSec: 15,
    text: 'Обновите коммерческий автопарк компании с авансом от десяти процентов и решением за один день. Лизинг для бизнеса «ТрансФинанс», 220-45-90.',
  },
  {
    id: 'retail-promo-15s',
    label: 'Ритейл-акция (15 сек)',
    tempo: 'dynamic_retail',
    category: 'auto',
    targetSlotSec: 15,
    text: 'Горячие круассаны на сливочном масле и зерновой кофе со скидкой до тридцати процентов каждое утро! Сеть пекарен «Зерно и Свет».',
  },
] as const;

export type ClientChronometerFitStatus =
  | 'empty'
  | 'fits_comfortably'
  | 'fits_tightly'
  | 'overflow';

export type CharacterCountMode = 'with_spaces' | 'without_spaces';

export interface CharacterCountPreset {
  chars: number;
  label: string;
  approxSlotHint: string;
}

export const CHARACTER_COUNT_PRESETS: readonly CharacterCountPreset[] = [
  { chars: 120, label: '120 зн.', approxSlotHint: '~10 с' },
  { chars: 200, label: '200 зн.', approxSlotHint: '~15 с' },
  { chars: 270, label: '270 зн.', approxSlotHint: '~20 с' },
  { chars: 400, label: '400 зн.', approxSlotHint: '~30 с' },
  { chars: 600, label: '600 зн.', approxSlotHint: '~45 с' },
] as const;

export const TEMPO_CHARS_PER_SECOND: Record<
  ScriptTempoId,
  { withSpaces: number; withoutSpaces: number }
> = {
  calm_image: { withSpaces: 12.2, withoutSpaces: 10.5 },
  business_standard: { withSpaces: 14.0, withoutSpaces: 12.0 },
  dynamic_retail: { withSpaces: 15.9, withoutSpaces: 13.6 },
};

export interface ClientScriptFz38Evaluation {
  resolvedCategory: ResolvedRegulatoryCategoryId;
  isAutoDetected: boolean;
  categorySpec: ClientFz38CategorySpec;
  tempo: ScriptTempoId;
  targetSlotSec: number;
  charCountWithSpaces: number;
  charCountWithoutSpaces: number;
  wordCount: number;
  syllableCount: number;
  digitGroupsCount: number;
  spokenCreativeSec: number;
  disclaimerRequiredSec: number;
  totalExactSec: number;
  recommendedSpotSec: number;
  nearestStandardSlotSec: StandardSpotDuration;
  creativeMaxWordsForTargetSlot: number;
  creativeMaxCharsWithSpaces: number;
  creativeMaxCharsWithoutSpaces: number;
  fitStatus: ClientChronometerFitStatus;
  fitHeadline: string;
  fitAdvice: string;
  recommendedFormatId: OrderFormatId;
  creativeSharePct: number;
  disclaimerSharePct: number;
  reserveSharePct: number;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

/**
 * Удаляет служебные пометки переноса ([Расчёт хронометра: ...], [Кастинг голоса: ...], [Дисклеймер ...]: ...),
 * чтобы на странице заказа хронометраж не удваивался при повторной оценке перенесённого текста.
 */
export function extractSpokenCreativeTextForChronometer(rawText: string): string {
  return (rawText || '')
    .replace(/\[Расчёт хронометра:[^\]]*\]/gi, ' ')
    .replace(/\[Кастинг голоса:[^\]]*\]/gi, ' ')
    .replace(/\[Дисклеймер[^\]]*\]:[^\n]*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Комплексный клиентский расчёт хронометража сценария и обязательных сносок по 38-ФЗ «О рекламе».
 * Считает слоговую длительность чтения (включая телефоны, проценты и домены) и прибавляет нормативный метраж дисклеймера.
 */
export function evaluateClientScriptAndFz38(params: {
  text: string;
  tempo?: ScriptTempoId;
  categorySelection?: ClientFz38CategorySelection;
  targetSlotSec?: number;
}): ClientScriptFz38Evaluation {
  const tempo: ScriptTempoId = params.tempo ?? 'business_standard';
  const categorySelection: ClientFz38CategorySelection =
    params.categorySelection ?? 'auto';
  const targetSlotSec = clampExactSpotSeconds(params.targetSlotSec ?? 20);

  const isAutoDetected = categorySelection === 'auto';
  const resolvedCategory: ResolvedRegulatoryCategoryId = isAutoDetected
    ? detectRegulatoryCategoryFromOrderText(params.text)
    : categorySelection;
  const categorySpec = CLIENT_FZ38_CATEGORY_SPECS[resolvedCategory];

  const creativeOnlyText = extractSpokenCreativeTextForChronometer(params.text);
  const baseChrono = calculateScriptChronometer({
    text: creativeOnlyText,
    tempo,
    disclaimer: 'none',
  });

  const tempoSpec =
    SCRIPT_TEMPO_OPTIONS.find((item) => item.id === tempo) ??
    SCRIPT_TEMPO_OPTIONS[1];

  const disclaimerRequiredSec = categorySpec.disclaimerSec;
  const spokenCreativeSec = baseChrono.spokenSecondsExact;
  const totalExactSec =
    baseChrono.rawWordCount === 0
      ? disclaimerRequiredSec
      : round1(spokenCreativeSec + disclaimerRequiredSec);

  const recommendedSpotSec =
    baseChrono.rawWordCount === 0
      ? Math.max(15, clampExactSpotSeconds(Math.ceil(disclaimerRequiredSec + 12)))
      : clampExactSpotSeconds(Math.ceil(totalExactSec));

  const nearestStandardSlotSec = resolveNearestStandardDuration(recommendedSpotSec);

  // Доступный бюджет на креатив внутри выбранного целевого слота (за вычетом дисклеймера и 0.75с пауз)
  const availableCreativeSec = Math.max(
    1.5,
    targetSlotSec - disclaimerRequiredSec - 0.75
  );
  const approxWordsPerSec = tempoSpec.wordsPerMinute / 60;
  const creativeMaxWordsForTargetSlot = Math.max(
    3,
    Math.floor(availableCreativeSec * approxWordsPerSec)
  );

  const denomSec = Math.max(targetSlotSec, totalExactSec, 1);
  const creativeSharePct = Math.min(
    100,
    Math.round((spokenCreativeSec / denomSec) * 100)
  );
  const disclaimerSharePct = Math.min(
    100 - creativeSharePct,
    Math.round((disclaimerRequiredSec / denomSec) * 100)
  );
  const reserveSharePct = Math.max(
    0,
    100 - creativeSharePct - disclaimerSharePct
  );

  let fitStatus: ClientChronometerFitStatus = 'fits_comfortably';
  let fitHeadline = `Помещается в ролик ${targetSlotSec} сек`;
  let fitAdvice = baseChrono.pacingAdvice;

  if (baseChrono.rawWordCount === 0) {
    fitStatus = 'empty';
    fitHeadline = `Слот ${targetSlotSec} сек вмещает до ${creativeMaxWordsForTargetSlot} слов`;
    fitAdvice =
      disclaimerRequiredSec > 0
        ? `В рубрике «${categorySpec.shortLabel}» закон (${categorySpec.legalNorm}) требует ~${disclaimerRequiredSec} сек на сноску — на основной оффер в слоте ${targetSlotSec} сек остаётся ${round1(availableCreativeSec)} сек.`
        : `Вставьте готовый текст или тезисы акции — калькулятор посчитает слоги, цифры телефона и проверит сноски по ФЗ-38.`;
  } else if (totalExactSec > targetSlotSec + 0.4) {
    fitStatus = 'overflow';
    const overSec = round1(totalExactSec - targetSlotSec);
    fitHeadline = `Не помещается в ${targetSlotSec} сек (+${overSec} сек сверх слота)`;
    fitAdvice =
      nearestStandardSlotSec > targetSlotSec
        ? `Вместе со сноской (${disclaimerRequiredSec} сек) хронометраж составит ${totalExactSec} сек. Выберите слот ${recommendedSpotSec} сек (или стандарт ${nearestStandardSlotSec} сек) либо сократите текст до ~${creativeMaxWordsForTargetSlot} слов.`
        : `Текст звучит ${totalExactSec} сек — сократите второстепенные обороты или выберите более динамичный темп подачи.`;
  } else if (totalExactSec >= targetSlotSec - 0.8) {
    fitStatus = 'fits_tightly';
    fitHeadline = `Впритык под слот ${targetSlotSec} сек (${totalExactSec} сек)`;
    fitAdvice = `Текст укладывается без запаса воздуха. На записи диктор прочитает плотно, а сноску (${disclaimerRequiredSec} сек) мы аккуратно уложим в финальный такт.`;
  } else {
    fitStatus = 'fits_comfortably';
    const airLeft = round1(targetSlotSec - totalExactSec);
    fitHeadline = `Комфортно ложится в ${targetSlotSec} сек (запас ${airLeft} сек)`;
    fitAdvice =
      disclaimerRequiredSec > 0
        ? `Основной текст (${spokenCreativeSec} сек) и обязательная сноска по ${categorySpec.legalNorm} (${disclaimerRequiredSec} сек) звучат разборчиво и оставляют воздух для саунд-дизайна.`
        : `Текст (${spokenCreativeSec} сек) читается без скороговорки и оставляет ${airLeft} сек под музыкальный акцент и запоминающийся финал.`;
  }

  const charCountWithSpaces = creativeOnlyText.length;
  const charCountWithoutSpaces = creativeOnlyText.replace(/\s+/g, '').length;
  const charsPerSecSpec = TEMPO_CHARS_PER_SECOND[tempo];
  const creativeMaxCharsWithSpaces = Math.max(
    20,
    Math.floor(availableCreativeSec * charsPerSecSpec.withSpaces)
  );
  const creativeMaxCharsWithoutSpaces = Math.max(
    18,
    Math.floor(availableCreativeSec * charsPerSecSpec.withoutSpaces)
  );

  const recommendedFormatId: OrderFormatId =
    baseChrono.rawWordCount >= 8 && !baseChrono.isOverSixtySeconds
      ? 'voice_style'
      : 'turnkey';

  return {
    resolvedCategory,
    isAutoDetected,
    categorySpec,
    tempo,
    targetSlotSec,
    charCountWithSpaces,
    charCountWithoutSpaces,
    wordCount: baseChrono.rawWordCount,
    syllableCount: baseChrono.syllableCount,
    digitGroupsCount: baseChrono.digitGroupsCount,
    spokenCreativeSec,
    disclaimerRequiredSec,
    totalExactSec,
    recommendedSpotSec,
    nearestStandardSlotSec,
    creativeMaxWordsForTargetSlot,
    creativeMaxCharsWithSpaces,
    creativeMaxCharsWithoutSpaces,
    fitStatus,
    fitHeadline,
    fitAdvice,
    recommendedFormatId,
    creativeSharePct,
    disclaimerSharePct,
    reserveSharePct,
  };
}

/**
 * Рассчитывает рекомендуемые ориентиры количества знаков для стандартных эфирных слотов
 * в зависимости от выбранного темпа диктора, способа подсчёта пробелов и длительности сноски ФЗ-38.
 */
export function getRecommendedCharRangesForTempo(params: {
  tempo?: ScriptTempoId;
  countMode?: CharacterCountMode;
  disclaimerSec?: number;
}): readonly { slotSec: number; maxChars: number }[] {
  const tempo: ScriptTempoId = params.tempo ?? 'business_standard';
  const countMode: CharacterCountMode = params.countMode ?? 'with_spaces';
  const disclaimerSec = Math.max(0, params.disclaimerSec ?? 0);
  const rate =
    countMode === 'without_spaces'
      ? TEMPO_CHARS_PER_SECOND[tempo].withoutSpaces
      : TEMPO_CHARS_PER_SECOND[tempo].withSpaces;

  return [10, 15, 20, 30, 45].map((slotSec) => {
    const netCreativeSec = Math.max(2, slotSec - disclaimerSec - 0.85);
    const maxChars = Math.max(20, Math.round((netCreativeSec * rate) / 5) * 5);
    return { slotSec, maxChars };
  });
}

/**
 * Интерактивный расчёт примерного хронометража аудиоролика напрямую по количеству знаков в сценарии
 * (с пробелами или без пробелов) с учётом темпа актёрской подачи и обязательных сносок по ФЗ-38.
 */
export function evaluateCharacterCountChronometer(params: {
  charCount: number;
  countMode?: CharacterCountMode;
  tempo?: ScriptTempoId;
  categorySelection?: ClientFz38CategorySelection;
  targetSlotSec?: number;
}): ClientScriptFz38Evaluation {
  const tempo: ScriptTempoId = params.tempo ?? 'business_standard';
  const countMode: CharacterCountMode = params.countMode ?? 'with_spaces';
  const categorySelection: ClientFz38CategorySelection =
    params.categorySelection ?? 'general_b2b';
  const targetSlotSec = clampExactSpotSeconds(params.targetSlotSec ?? 20);

  const safeChars = Number.isFinite(params.charCount)
    ? Math.max(0, Math.min(3000, Math.round(params.charCount)))
    : 0;

  const resolvedCategory: ResolvedRegulatoryCategoryId =
    categorySelection === 'auto' ? 'general_b2b' : categorySelection;
  const categorySpec = CLIENT_FZ38_CATEGORY_SPECS[resolvedCategory];
  const disclaimerRequiredSec = categorySpec.disclaimerSec;

  const tempoSpec =
    SCRIPT_TEMPO_OPTIONS.find((item) => item.id === tempo) ??
    SCRIPT_TEMPO_OPTIONS[1];
  const charsPerSecSpec = TEMPO_CHARS_PER_SECOND[tempo];
  const activeRate =
    countMode === 'without_spaces'
      ? charsPerSecSpec.withoutSpaces
      : charsPerSecSpec.withSpaces;

  const charCountWithSpaces =
    countMode === 'with_spaces' ? safeChars : Math.round(safeChars * 1.16);
  const charCountWithoutSpaces =
    countMode === 'without_spaces' ? safeChars : Math.round(safeChars / 1.16);
  const approxWordCount =
    safeChars === 0
      ? 0
      : Math.max(
          1,
          Math.round(charCountWithSpaces / 7)
        );
  const approxSyllableCount =
    safeChars === 0 ? 0 : Math.max(1, Math.round(charCountWithoutSpaces * 0.42));

  // Стартовый вдох звукорежиссёра 0.75с + пропорциональные пунктуационные паузы
  const pauseBonusSec =
    safeChars === 0 ? 0 : 0.75 + Math.min(3.5, (safeChars / 100) * 0.14);
  const spokenCreativeSec =
    safeChars === 0 ? 0 : round1(safeChars / activeRate + pauseBonusSec);
  const totalExactSec =
    safeChars === 0
      ? disclaimerRequiredSec
      : round1(spokenCreativeSec + disclaimerRequiredSec);

  const recommendedSpotSec =
    safeChars === 0
      ? Math.max(15, clampExactSpotSeconds(Math.ceil(disclaimerRequiredSec + 12)))
      : clampExactSpotSeconds(Math.ceil(totalExactSec));
  const nearestStandardSlotSec = resolveNearestStandardDuration(recommendedSpotSec);

  const availableCreativeSec = Math.max(
    1.5,
    targetSlotSec - disclaimerRequiredSec - 0.85
  );
  const approxWordsPerSec = tempoSpec.wordsPerMinute / 60;
  const creativeMaxWordsForTargetSlot = Math.max(
    3,
    Math.floor(availableCreativeSec * approxWordsPerSec)
  );
  const creativeMaxCharsWithSpaces = Math.max(
    20,
    Math.floor(availableCreativeSec * charsPerSecSpec.withSpaces)
  );
  const creativeMaxCharsWithoutSpaces = Math.max(
    18,
    Math.floor(availableCreativeSec * charsPerSecSpec.withoutSpaces)
  );
  const activeMaxChars =
    countMode === 'without_spaces'
      ? creativeMaxCharsWithoutSpaces
      : creativeMaxCharsWithSpaces;
  const modeSuffix =
    countMode === 'without_spaces' ? 'без пробелов' : 'с пробелами';

  const denomSec = Math.max(targetSlotSec, totalExactSec, 1);
  const creativeSharePct = Math.min(
    100,
    Math.round((spokenCreativeSec / denomSec) * 100)
  );
  const disclaimerSharePct = Math.min(
    100 - creativeSharePct,
    Math.round((disclaimerRequiredSec / denomSec) * 100)
  );
  const reserveSharePct = Math.max(
    0,
    100 - creativeSharePct - disclaimerSharePct
  );

  let fitStatus: ClientChronometerFitStatus = 'fits_comfortably';
  let fitHeadline = `Помещается в ролик ${targetSlotSec} сек`;
  let fitAdvice = '';

  if (safeChars === 0) {
    fitStatus = 'empty';
    fitHeadline = `Слот ${targetSlotSec} сек вмещает до ~${activeMaxChars} знаков (${modeSuffix})`;
    fitAdvice =
      disclaimerRequiredSec > 0
        ? `С учётом обязательной сноски по ${categorySpec.legalNorm} (+${disclaimerRequiredSec} сек) на основной текст остаётся ${round1(availableCreativeSec)} сек.`
        : `Укажите количество знаков в сценарии или передвиньте ползунок, чтобы оценить примерный хронометраж ролика.`;
  } else if (totalExactSec > targetSlotSec + 0.4) {
    fitStatus = 'overflow';
    const overSec = round1(totalExactSec - targetSlotSec);
    fitHeadline = `Не помещается в ${targetSlotSec} сек (+${overSec} сек сверх слота)`;
    fitAdvice =
      nearestStandardSlotSec > targetSlotSec
        ? `${safeChars} знаков (${modeSuffix}) в темпе «${tempoSpec.label}» звучат около ${totalExactSec} сек. Выберите слот ${recommendedSpotSec} сек (или стандарт ${nearestStandardSlotSec} сек) либо сократите объём до ~${activeMaxChars} знаков.`
        : `Объём ${safeChars} знаков звучит ~${totalExactSec} сек — сократите текст примерно до ${activeMaxChars} знаков или выберите более динамичный темп.`;
  } else if (totalExactSec >= targetSlotSec - 0.8) {
    fitStatus = 'fits_tightly';
    fitHeadline = `Впритык под слот ${targetSlotSec} сек (~${totalExactSec} сек)`;
    fitAdvice = `Объём ${safeChars} знаков (${modeSuffix}) ложится плотно без лишних пауз. Диктор прочитает чётко, а финальную сноску и бренд мы аккуратно сведём в такт.`;
  } else {
    fitStatus = 'fits_comfortably';
    const airLeft = round1(targetSlotSec - totalExactSec);
    fitHeadline = `Комфортно ложится в ${targetSlotSec} сек (запас ${airLeft} сек)`;
    fitAdvice =
      disclaimerRequiredSec > 0
        ? `Текст на ${safeChars} знаков (~${spokenCreativeSec} сек) и сноска по ${categorySpec.legalNorm} (${disclaimerRequiredSec} сек) звучат разборчиво с запасом на музыкальный акцент.`
        : `${safeChars} знаков (${modeSuffix}) читаются спокойно (~${spokenCreativeSec} сек) и оставляют ${airLeft} сек под музыкальную отбивку и финал.`;
  }

  const recommendedFormatId: OrderFormatId =
    safeChars >= 80 && totalExactSec <= 60 ? 'voice_style' : 'turnkey';

  return {
    resolvedCategory,
    isAutoDetected: false,
    categorySpec,
    tempo,
    targetSlotSec,
    charCountWithSpaces,
    charCountWithoutSpaces,
    wordCount: approxWordCount,
    syllableCount: approxSyllableCount,
    digitGroupsCount: 0,
    spokenCreativeSec,
    disclaimerRequiredSec,
    totalExactSec,
    recommendedSpotSec,
    nearestStandardSlotSec,
    creativeMaxWordsForTargetSlot,
    creativeMaxCharsWithSpaces,
    creativeMaxCharsWithoutSpaces,
    fitStatus,
    fitHeadline,
    fitAdvice,
    recommendedFormatId,
    creativeSharePct,
    disclaimerSharePct,
    reserveSharePct,
  };
}

/**
 * Формирует чистое текстовое задание для переноса из онлайн-хронометра в форму заказа (`/order`).
 */
export function buildChronometerBriefTransferText(params: {
  scriptText: string;
  evaluation: ClientScriptFz38Evaluation;
  includeSampleDisclaimer?: boolean;
  charCountModeNote?: string;
}): string {
  const cleanScript = params.scriptText.trim();
  const tempoLabel =
    SCRIPT_TEMPO_OPTIONS.find((item) => item.id === params.evaluation.tempo)
      ?.label ?? 'Деловой стандарт';

  const parts: string[] = [];
  if (cleanScript) {
    parts.push(cleanScript);
  } else if (params.charCountModeNote) {
    parts.push(params.charCountModeNote);
  }

  if (
    params.includeSampleDisclaimer &&
    params.evaluation.categorySpec.sampleDisclaimerText
  ) {
    const sample = params.evaluation.categorySpec.sampleDisclaimerText;
    if (!cleanScript.toLowerCase().includes(sample.slice(0, 18).toLowerCase())) {
      parts.push(`[Дисклеймер ${params.evaluation.categorySpec.legalNorm}]: ${sample}`);
    }
  }

  const metaSummary = `[Расчёт хронометра: ~${params.evaluation.totalExactSec} сек · ${params.evaluation.charCountWithSpaces} зн. с пробелами · темп «${tempoLabel}»${
    params.evaluation.disclaimerRequiredSec > 0
      ? ` · сноска ${params.evaluation.categorySpec.shortLabel} (${params.evaluation.disclaimerRequiredSec} сек)`
      : ''
  }]`;
  parts.push(metaSummary);

  return parts.join('\n\n').slice(0, 1950);
}
