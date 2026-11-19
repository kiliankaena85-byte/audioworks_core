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
    disclaimerSec: 2,
    mappedIndustryPreset: 'real-estate',
    sampleDisclaimerText:
      'Застройщик ООО «СЗ …». Проектная декларация на наш.дом.рф.',
    moderationRuleNote:
      'В радиоролике долевого строительства обязательно озвучиваются наименование застройщика и адрес проектной декларации на наш.дом.рф.',
  },
  finance_credit_28fz: {
    id: 'finance_credit_28fz',
    shortLabel: 'Финансы / ипотека / лизинг',
    legalNorm: 'ст. 28 ФЗ-38 «О рекламе»',
    disclaimerSec: 2.5,
    mappedIndustryPreset: 'b2b-finance',
    sampleDisclaimerText:
      'Оценивайте свои финансовые возможности и риски. Изучите все условия на сайте организации.',
    moderationRuleNote:
      'При упоминании ставки или платежа озвучиваются диапазон полной стоимости кредита (ПСК), наименование банка/лизингодателя и предупреждение о рисках.',
  },
  medicine_24fz: {
    id: 'medicine_24fz',
    shortLabel: 'Медицина и клиники',
    legalNorm: 'ч. 7 ст. 24 ФЗ-38 «О рекламе»',
    disclaimerSec: 3,
    mappedIndustryPreset: 'medicine',
    sampleDisclaimerText:
      'Имеются противопоказания. Необходима консультация специалиста.',
    moderationRuleNote:
      'По закону «О рекламе» в радиопрограммах предупреждение о противопоказаниях должно звучать разборчиво не менее 3 (трёх) секунд.',
  },
  promo_stim_9fz: {
    id: 'promo_stim_9fz',
    shortLabel: 'Акции, скидки и розыгрыши',
    legalNorm: 'ст. 9 ФЗ-38 «О рекламе»',
    disclaimerSec: 1.5,
    mappedIndustryPreset: 'retail-fmcg',
    sampleDisclaimerText:
      'Сроки и правила акции — на сайте компании.',
    moderationRuleNote:
      'В рекламе акции указываются сроки её проведения и источник подробных правил (например, сайт).',
  },
};

export const CLIENT_FZ38_SELECTOR_OPTIONS: readonly {
  id: ClientFz38CategorySelection;
  label: string;
  badgeSec: string;
}[] = [
  { id: 'auto', label: 'Авто по тексту', badgeSec: 'авто' },
  { id: 'general_b2b', label: 'Без сносок (B2B / услуги)', badgeSec: '0 с' },
  { id: 'real_estate_214fz', label: 'Недвижимость / ЖК', badgeSec: '+2 с' },
  { id: 'finance_credit_28fz', label: 'Финансы / лизинг', badgeSec: '+2.5 с' },
  { id: 'medicine_24fz', label: 'Медицина (мин. 3 с)', badgeSec: '+3 с' },
  { id: 'promo_stim_9fz', label: 'Акция / скидка', badgeSec: '+1.5 с' },
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
  { chars: 140, label: '140 зн.', approxSlotHint: '~10 с' },
  { chars: 210, label: '210 зн.', approxSlotHint: '~15 с' },
  { chars: 280, label: '280 зн.', approxSlotHint: '~20 с' },
  { chars: 420, label: '420 зн.', approxSlotHint: '~30 с' },
  { chars: 630, label: '630 зн.', approxSlotHint: '~45 с' },
] as const;

export const TEMPO_CHARS_PER_SECOND: Record<
  ScriptTempoId,
  { withSpaces: number; withoutSpaces: number }
> = {
  calm_image: { withSpaces: 12.2, withoutSpaces: 10.4 },
  business_standard: { withSpaces: 14.3, withoutSpaces: 12.2 },
  dynamic_retail: { withSpaces: 16.6, withoutSpaces: 14.2 },
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

  const alreadyHasCategoryDisclaimer =
    (resolvedCategory === 'medicine_24fz' &&
      /противопоказан[а-яё]*|консультаци[а-яё]+\s+специалист|не\s+является\s+лекарственн/i.test(
        creativeOnlyText
      )) ||
    (resolvedCategory === 'real_estate_214fz' &&
      /проектн[а-яё]+\s+деклараци|наш\.?дом\.?рф/i.test(creativeOnlyText)) ||
    (resolvedCategory === 'finance_credit_28fz' &&
      /финансов[а-яё]+\s+возможност|полн[а-яё]+\s+стоимост[а-яё]+\s+кредит|диапазон\s+пск|лицензи[а-яё]+\s+банка/i.test(
        creativeOnlyText
      )) ||
    (resolvedCategory === 'promo_stim_9fz' &&
      /(срок[а-яё]*|правил[а-яё]*|организатор[а-яё]*)\s+(проведения\s+|и\s+правила\s+)?акци|подробност[а-яё]*\s+(акции\s+)?на\s+сайте/i.test(
        creativeOnlyText
      ));

  const disclaimerRequiredSec = alreadyHasCategoryDisclaimer
    ? 0
    : categorySpec.disclaimerSec;
  const spokenCreativeSec = baseChrono.spokenSecondsExact;
  const totalExactSec =
    baseChrono.rawWordCount === 0
      ? categorySpec.disclaimerSec
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

  // Вещательный краевой зазор 0.2с (без искусственного завышения пауз, так как скорость зн/сек уже учитывает естественное дыхание)
  const pauseBonusSec = safeChars === 0 ? 0 : 0.2;
  const spokenCreativeSec =
    safeChars === 0 ? 0 : round1(safeChars / activeRate + pauseBonusSec);
  const totalExactSec =
    safeChars === 0
      ? disclaimerRequiredSec
      : round1(spokenCreativeSec + disclaimerRequiredSec);

  const recommendedSpotSec =
    safeChars === 0
      ? Math.max(15, clampExactSpotSeconds(Math.ceil(disclaimerRequiredSec + 12)))
      : clampExactSpotSeconds(Math.ceil(Math.max(5, totalExactSec - 0.5)));
  const nearestStandardSlotSec = resolveNearestStandardDuration(recommendedSpotSec);

  const availableCreativeSec = Math.max(
    1.5,
    targetSlotSec - disclaimerRequiredSec - 0.2
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

export type ScriptLegalFindingSeverity =
  | 'mandatory_disclaimer'
  | 'already_included'
  | 'moderation_risk'
  | 'info';

export type ScriptLegalFindingCode =
  | 'medicine_24fz'
  | 'dietary_supplement_25fz'
  | 'real_estate_214fz'
  | 'finance_credit_28fz'
  | 'promo_stim_9fz'
  | 'distance_sale_8fz'
  | 'age_rating_436fz'
  | 'superlative_comparison_5fz'
  | 'foreign_words_5fz';

export interface ScriptLegalFinding {
  code: ScriptLegalFindingCode;
  severity: ScriptLegalFindingSeverity;
  title: string;
  legalNorm: string;
  extraSeconds: number;
  matchedExcerpt: string;
  explanation: string;
  suggestedDisclaimer?: string;
}

export interface FullScriptChronometerReport {
  inputMode: 'text' | 'chars';
  isEmpty: boolean;
  charCountWithSpaces: number;
  charCountWithoutSpaces: number;
  wordCount: number;
  spokenWordCount: number;
  syllableCount: number;
  digitGroupsCount: number;
  tempo: ScriptTempoId;
  spokenCreativeSec: number;
  legalDisclaimerSec: number;
  totalExactSec: number;
  exactRoundedSec: number;
  recommendedSlotSec: StandardSpotDuration;
  hasMandatoryDisclaimers: boolean;
  hasModerationRisks: boolean;
  findings: readonly ScriptLegalFinding[];
  combinedSampleDisclaimer: string;
  resolvedPrimaryCategory: ResolvedRegulatoryCategoryId;
  mappedIndustryPreset: IndustryVerticalSlug | null;
  recommendedFormatId: OrderFormatId;
  creativeSharePct: number;
  disclaimerSharePct: number;
  summaryHeadline: string;
  summaryAdvice: string;
}

const ALLOWED_LATIN_BROADCAST_TOKENS = new Set([
  'b2b',
  'b2c',
  'vip',
  'crm',
  'sms',
  'wav',
  'mp3',
  'pdf',
  'suv',
  'spa',
  'led',
  'usb',
  'gps',
  'wifi',
  'wi-fi',
  'fm',
]);

function detectForeignWordsOutsideDomains(text: string): string[] {
  const withoutDomains = text
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\S+@\S+/gi, ' ')
    .replace(/\b[\w-]+(?:\.[\w-]+)*\.(ru|рф|com|net|org|io|pro|su|biz)\b/gi, ' ');
  const matches = withoutDomains.match(/\b[a-z]{3,}\b/gi) ?? [];
  const unique: string[] = [];
  for (const word of matches) {
    const lower = word.toLowerCase();
    if (ALLOWED_LATIN_BROADCAST_TOKENS.has(lower)) continue;
    if (!unique.some((u) => u.toLowerCase() === lower)) {
      unique.push(word);
    }
  }
  return unique.slice(0, 4);
}

/**
 * Подбирает ближайший стандартный эфирный слот (5, 10, 15, 20, 30, 45, 60 сек)
 * с реальным студийным допуском укладки (до +0.5 сек на плотной подаче диктора),
 * чтобы из-за 15.3 сек не навязывать клиенту 20-секундный слот.
 */
function resolveStudioBroadcastSlot(totalExactSec: number): StandardSpotDuration {
  const STUDIO_FIT_TOLERANCE_SEC = 0.5;
  const slots: readonly StandardSpotDuration[] = [5, 10, 15, 20, 30, 45, 60];
  for (const slot of slots) {
    if (totalExactSec <= slot + STUDIO_FIT_TOLERANCE_SEC) {
      return slot;
    }
  }
  return 60;
}

/**
 * Полноценный автоматический анализатор сценария аудиоролика:
 * по тексту (или по числу знаков) рассчитывает студийный хронометраж с раскрытием чисел и телефонов,
 * автоматически выявляет обязательные сноски по ФЗ-38 «О рекламе»
 * (не задваивая их, если сноска уже написана в самом тексте!) и предупреждает о рисках модерации.
 */
export function analyzeScriptFullComplianceAndChronometer(params: {
  inputMode?: 'text' | 'chars';
  text?: string;
  charCount?: number;
  countMode?: CharacterCountMode;
  tempo?: ScriptTempoId;
}): FullScriptChronometerReport {
  const inputMode = params.inputMode ?? 'text';
  const tempo: ScriptTempoId = params.tempo ?? 'business_standard';
  const countMode: CharacterCountMode = params.countMode ?? 'with_spaces';

  if (inputMode === 'chars') {
    const safeChars = Number.isFinite(params.charCount ?? 0)
      ? Math.max(0, Math.min(3000, Math.round(params.charCount ?? 0)))
      : 0;
    const base = evaluateCharacterCountChronometer({
      charCount: safeChars,
      countMode,
      tempo,
      categorySelection: 'general_b2b',
      targetSlotSec: 20,
    });
    const isEmpty = safeChars === 0;
    const exactRoundedSec = isEmpty ? 0 : Math.ceil(base.totalExactSec);
    const recommendedSlotSec = isEmpty
      ? 15
      : resolveStudioBroadcastSlot(base.totalExactSec);

    return {
      inputMode: 'chars',
      isEmpty,
      charCountWithSpaces: base.charCountWithSpaces,
      charCountWithoutSpaces: base.charCountWithoutSpaces,
      wordCount: base.wordCount,
      spokenWordCount: base.wordCount,
      syllableCount: base.syllableCount,
      digitGroupsCount: 0,
      tempo,
      spokenCreativeSec: base.spokenCreativeSec,
      legalDisclaimerSec: 0,
      totalExactSec: base.totalExactSec,
      exactRoundedSec,
      recommendedSlotSec,
      hasMandatoryDisclaimers: false,
      hasModerationRisks: false,
      findings: [],
      combinedSampleDisclaimer: '',
      resolvedPrimaryCategory: 'general_b2b',
      mappedIndustryPreset: null,
      recommendedFormatId:
        safeChars >= 80 && base.totalExactSec <= 60 ? 'voice_style' : 'turnkey',
      creativeSharePct: isEmpty ? 0 : 100,
      disclaimerSharePct: 0,
      summaryHeadline: isEmpty
        ? 'Укажите объём сценария в знаках'
        : `Оптимальный эфирный слот — ${recommendedSlotSec} сек`,
      summaryAdvice: isEmpty
        ? 'Введите количество знаков или вставьте готовый текст, чтобы калькулятор проверил хронометраж и требования закона о рекламе.'
        : `Объём ${safeChars} знаков (${countMode === 'without_spaces' ? 'без пробелов' : 'с пробелами'}) звучит около ${base.totalExactSec} сек (~${base.wordCount} сл.). Если в ролике есть акция, медицина, финансы или ЖК — вставьте текст сценария, и калькулятор сам учтёт нужную сноску ФЗ-38.`,
    };
  }

  const rawText = String(params.text ?? '');
  const cleanText = extractSpokenCreativeTextForChronometer(rawText);
  const charCountWithSpaces = cleanText.length;
  const charCountWithoutSpaces = cleanText.replace(/\s+/g, '').length;

  const baseChrono = calculateScriptChronometer({
    text: cleanText,
    tempo,
    disclaimer: 'none',
  });

  if (baseChrono.rawWordCount === 0 || baseChrono.spokenWordCount === 0) {
    return {
      inputMode: 'text',
      isEmpty: true,
      charCountWithSpaces: 0,
      charCountWithoutSpaces: 0,
      wordCount: 0,
      spokenWordCount: 0,
      syllableCount: 0,
      digitGroupsCount: 0,
      tempo,
      spokenCreativeSec: 0,
      legalDisclaimerSec: 0,
      totalExactSec: 0,
      exactRoundedSec: 0,
      recommendedSlotSec: 15,
      hasMandatoryDisclaimers: false,
      hasModerationRisks: false,
      findings: [],
      combinedSampleDisclaimer: '',
      resolvedPrimaryCategory: 'general_b2b',
      mappedIndustryPreset: null,
      recommendedFormatId: 'turnkey',
      creativeSharePct: 0,
      disclaimerSharePct: 0,
      summaryHeadline: 'Вставьте текст сценария и нажмите «Рассчитать»',
      summaryAdvice:
        'Калькулятор переведёт числа и телефоны в живую речь диктора, проверит обязательные сноски по ФЗ-38 и подберёт точный эфирный слот.',
    };
  }

  const findings: ScriptLegalFinding[] = [];
  let primaryCategory: ResolvedRegulatoryCategoryId = 'general_b2b';
  let mappedIndustryPreset: IndustryVerticalSlug | null = null;

  // 1. Медицина и клиники (ч. 7 ст. 24 ФЗ-38 — строго не менее 3.0 сек в радиопрограммах)
  const medMatch = cleanText.match(
    /(клиник[а-яё]*|врач[а-яё]*|медицин[а-яё]*|стоматолог[а-яё]*|диагностик[а-яё]*|лечени[а-яё]*|(?<![а-яёa-z0-9])мрт(?![а-яёa-z0-9])|(?<![а-яёa-z0-9])узи(?![а-яёa-z0-9])|анализ[а-яё]*|здоровь[а-яё]*|зрени[а-яё]*|лекарств[а-яё]*|аптек[а-яё]*|препарат[а-яё]*|ортопед[а-яё]*|кардиолог[а-яё]*|терапевт[а-яё]*|хирург[а-яё]*|офтальмолог[а-яё]*)/i
  );
  const hasMedDisclaimerInText =
    /противопоказан[а-яё]*|консультаци[а-яё]+\s+специалист/i.test(cleanText);
  if (medMatch) {
    primaryCategory = 'medicine_24fz';
    mappedIndustryPreset = 'medicine';
    findings.push(
      hasMedDisclaimerInText
        ? {
            code: 'medicine_24fz',
            severity: 'already_included',
            title: 'Медицинская сноска уже есть в вашем тексте',
            legalNorm: 'ч. 7 ст. 24 ФЗ-38',
            extraSeconds: 0,
            matchedExcerpt: medMatch[0],
            explanation:
              'Предупреждение о противопоказаниях уже учтено в секундах речи диктора (на записи проследим, чтобы оно звучало не менее 3 секунд).',
          }
        : {
            code: 'medicine_24fz',
            severity: 'mandatory_disclaimer',
            title: 'Обязательное медицинское предупреждение (мин. 3 сек)',
            legalNorm: 'ч. 7 ст. 24 ФЗ-38',
            extraSeconds: 3.0,
            matchedExcerpt: medMatch[0],
            explanation:
              'В радиорекламе клиник, медицинских услуг и лекарств предупреждение о противопоказаниях по закону должно звучать не менее 3 секунд.',
            suggestedDisclaimer:
              'Имеются противопоказания. Необходима консультация специалиста.',
          }
    );
  }

  // 2. БАДы (ч. 1.1 ст. 25 ФЗ-38 — в радиопрограммах не менее 3.0 сек)
  const badMatch = cleanText.match(
    /((?<![а-яёa-z0-9])бад[а-яё]*(?![а-яёa-z0-9])|биологически\s+активн[а-яё]*|витаминн[а-яё]*\s+комплекс[а-яё]*)/i
  );
  const hasBadDisclaimerInText = /не\s+является\s+лекарственн[а-яё]*/i.test(
    cleanText
  );
  if (badMatch) {
    if (primaryCategory === 'general_b2b') {
      primaryCategory = 'medicine_24fz';
      mappedIndustryPreset = 'medicine';
    }
    findings.push(
      hasBadDisclaimerInText
        ? {
            code: 'dietary_supplement_25fz',
            severity: 'already_included',
            title: 'Сноска для БАД уже есть в вашем тексте',
            legalNorm: 'ч. 1.1 ст. 25 ФЗ-38',
            extraSeconds: 0,
            matchedExcerpt: badMatch[0],
            explanation:
              'Предупреждение «Не является лекарственным средством» уже учтено в хронометраже речи (по закону звучит от 3 сек).',
          }
        : {
            code: 'dietary_supplement_25fz',
            severity: 'mandatory_disclaimer',
            title: 'Обязательная сноска для БАД (мин. 3 сек)',
            legalNorm: 'ч. 1.1 ст. 25 ФЗ-38',
            extraSeconds: medMatch && !hasMedDisclaimerInText ? 1.0 : 3.0,
            matchedExcerpt: badMatch[0],
            explanation:
              'В радиорекламе БАД предупреждение о том, что добавка не является лекарственным средством, должно звучать не менее 3 секунд.',
            suggestedDisclaimer: 'БАД. Не является лекарственным средством.',
          }
    );
  }

  // 3. Недвижимость и долевое строительство (ч. 7 ст. 28 ФЗ-38 · 214-ФЗ — ~2.0 сек в информационном темпе)
  const realtyMatch = cleanText.match(
    /((?<![а-яёa-z0-9])жк(?![а-яёa-z0-9])|жил(ой|ом|ого|ому|ые)\s+комплекс[а-яё]*|застройщик[а-яё]*|новостройк[а-яё]*|квартир[а-яё]*|долев[а-яё]*|эскроу|апартамент[а-яё]*|таунхаус[а-яё]*|коттеджн[а-яё]*\s+пос[её]л[а-яё]*)/i
  );
  const hasRealtyDisclaimerInText =
    /проектн[а-яё]+\s+деклараци|наш\.?дом\.?рф/i.test(cleanText);
  if (realtyMatch) {
    if (primaryCategory === 'general_b2b') {
      primaryCategory = 'real_estate_214fz';
      mappedIndustryPreset = 'real-estate';
    }
    findings.push(
      hasRealtyDisclaimerInText
        ? {
            code: 'real_estate_214fz',
            severity: 'already_included',
            title: 'Сноска застройщика и наш.дом.рф уже в тексте',
            legalNorm: 'ч. 7 ст. 28 ФЗ-38 · 214-ФЗ',
            extraSeconds: 0,
            matchedExcerpt: realtyMatch[0],
            explanation:
              'Указание проектной декларации уже присутствует в сценарии и посчитано в основном хронометраже.',
          }
        : {
            code: 'real_estate_214fz',
            severity: 'mandatory_disclaimer',
            title: 'Сноска застройщика и наш.дом.рф',
            legalNorm: 'ч. 7 ст. 28 ФЗ-38 · 214-ФЗ',
            extraSeconds: 2.0,
            matchedExcerpt: realtyMatch[0],
            explanation:
              'В рекламе новостроек в конце ролика быстрым дикторским темпом (~2 сек) озвучиваются наименование застройщика и наш.дом.рф.',
            suggestedDisclaimer:
              'Застройщик ООО «СЗ …». Проектная декларация на наш.дом.рф.',
          }
    );
  }

  // 4. Финансы, ипотека, кредит, рассрочка, лизинг (ст. 28 ФЗ-38 — ~2.5 сек в информационном темпе)
  const financeMatch = cleanText.match(
    /(ипотек[а-яё]*|кредит[а-яё]*|займ[а-яё]*|рассрочк[а-яё]*|лизинг[а-яё]*|вклад[а-яё]*|депозит[а-яё]*|банк[а-яё]*|страховани[а-яё]*|ставк[а-яё]*\s+от|ежемесячн[а-яё]*\s+плат[её]ж[а-яё]*|аванс[а-яё]*\s+от)/i
  );
  const hasFinanceDisclaimerInText =
    /финансов[а-яё]+\s+возможност|полн[а-яё]+\s+стоимост[а-яё]+\s+кредит|диапазон\s+пск|лицензи[а-яё]+\s+банка/i.test(
      cleanText
    );
  if (financeMatch) {
    if (primaryCategory === 'general_b2b') {
      primaryCategory = 'finance_credit_28fz';
      mappedIndustryPreset = 'b2b-finance';
    }
    const mentionsRate = /(%|процент[а-яё]*|ставк[а-яё]*|плат[её]ж)/i.test(
      cleanText
    );
    findings.push(
      hasFinanceDisclaimerInText
        ? {
            code: 'finance_credit_28fz',
            severity: 'already_included',
            title: 'Финансовое предупреждение уже есть в тексте',
            legalNorm: 'ст. 28 ФЗ-38',
            extraSeconds: 0,
            matchedExcerpt: financeMatch[0],
            explanation:
              'Сноска по финансовым условиям уже включена в ваш текст и учтена в хронометраже речи.',
          }
        : {
            code: 'finance_credit_28fz',
            severity: 'mandatory_disclaimer',
            title: mentionsRate
              ? 'Предупреждение о рисках, банк и диапазон ПСК'
              : 'Сноска для финансовых услуг (банк и риски)',
            legalNorm: 'ст. 28 ФЗ-38',
            extraSeconds: mentionsRate ? 3.0 : 2.5,
            matchedExcerpt: financeMatch[0],
            explanation: mentionsRate
              ? 'При упоминании ставки или платежа озвучиваются банк/организация, диапазон ПСК и предупреждение о рисках (в ускоренной дикторской подаче ~3 сек).'
              : 'В финале ролика указывается наименование банка/лизингодателя и предупреждение об оценке финансовых рисков (~2,5 сек).',
            suggestedDisclaimer:
              'Оценивайте свои финансовые возможности и риски. Изучите все условия на сайте организации.',
          }
    );
  }

  // 5. Акции, скидки, розыгрыши (ст. 9 ФЗ-38 — ~1.5 сек в быстрой подаче)
  const promoMatch = cleanText.match(
    /(акци[а-яё]*|скидк[а-яё]*|распродаж[а-яё]*|розыгрыш[а-яё]*|приз[а-яё]*|подар[оа]к[а-яё]*|промокод[а-яё]*|к[еэ]шб[еэ]к[а-яё]*|выгод[а-яё]*\s+до|бесплатн[а-яё]*)/i
  );
  const hasPromoDisclaimerInText =
    /(срок[а-яё]*|правил[а-яё]*|организатор[а-яё]*)\s+(проведения\s+|и\s+правила\s+)?акци|подробност[а-яё]*\s+(акции\s+)?на\s+сайте/i.test(
      cleanText
    );
  if (promoMatch) {
    if (primaryCategory === 'general_b2b') {
      primaryCategory = 'promo_stim_9fz';
      mappedIndustryPreset = 'retail-fmcg';
    }
    findings.push(
      hasPromoDisclaimerInText
        ? {
            code: 'promo_stim_9fz',
            severity: 'already_included',
            title: 'Сноска о сроках и правилах акции уже в тексте',
            legalNorm: 'ст. 9 ФЗ-38',
            extraSeconds: 0,
            matchedExcerpt: promoMatch[0],
            explanation:
              'Упоминание сроков/подробностей на сайте уже есть в тексте и учтено в секундах речи.',
          }
        : {
            code: 'promo_stim_9fz',
            severity: 'mandatory_disclaimer',
            title: 'Сроки акции и источник правил (ст. 9 ФЗ-38)',
            legalNorm: 'ст. 9 ФЗ-38',
            extraSeconds: 1.5,
            matchedExcerpt: promoMatch[0],
            explanation:
              'При упоминании скидок, акций или подарков в конце ролика быстро озвучиваются сроки и сайт с правилами (~1,5 сек).',
            suggestedDisclaimer: 'Сроки и правила акции — на сайте компании.',
          }
    );
  }

  // 6. Дистанционная продажа / интернет-магазин / доставка (ст. 8 ФЗ-38 — ~1.5 сек)
  const distanceMatch = cleanText.match(
    /(интернет-магазин[а-яё]*|доставк[а-яё]*|курьер[а-яё]*|заказ[а-яё]*\s+онлайн|маркетплейс[а-яё]*|привез[её]м)/i
  );
  const alreadyHasLegalRequisites = /(огрн|огрнип)/i.test(cleanText);
  if (distanceMatch) {
    findings.push(
      alreadyHasLegalRequisites
        ? {
            code: 'distance_sale_8fz',
            severity: 'already_included',
            title: 'Реквизиты продавца (ОГРН) уже указаны в тексте',
            legalNorm: 'ст. 8 ФЗ-38',
            extraSeconds: 0,
            matchedExcerpt: distanceMatch[0],
            explanation:
              'Реквизиты для дистанционной продажи уже присутствуют в тексте и учтены в хронометраже.',
          }
        : {
            code: 'distance_sale_8fz',
            severity: 'mandatory_disclaimer',
            title: 'Реквизиты продавца при доставке / онлайн-заказе',
            legalNorm: 'ст. 8 ФЗ-38',
            extraSeconds: 1.5,
            matchedExcerpt: distanceMatch[0],
            explanation:
              'При рекламе доставки и дистанционной покупки в конце быстро озвучиваются продавец, ОГРН и адрес (~1,5–2 сек).',
            suggestedDisclaimer: 'Продавец ООО «…», ОГРН …, юр. адрес …',
          }
    );
  }

  // 7. Возрастная маркировка информационной продукции (436-ФЗ — 0.5 сек: «двенадцать плюс»)
  const ageTriggerMatch = cleanText.match(
    /(концерт[а-яё]*|фестивал[а-яё]*|выставк[а-яё]*|спектакл[а-яё]*|(?<![а-яёa-z0-9])шоу(?![а-яёa-z0-9])|кино[а-яё]*|фильм[а-яё]*|билет[а-яё]*|форум[а-яё]*|конференци[а-яё]*|вебинар[а-яё]*|курс[а-яё]*|обучени[а-яё]*|приложени[а-яё]*)/i
  );
  const alreadyHasAgeRating = /(?<!\d)(?:0|6|12|16|18)\+/.test(cleanText);
  if (ageTriggerMatch && !alreadyHasAgeRating) {
    findings.push({
      code: 'age_rating_436fz',
      severity: 'mandatory_disclaimer',
      title: 'Возрастная маркировка (0+ / 6+ / 12+ / 16+ / 18+)',
      legalNorm: 'ч. 10.1 ст. 5 ФЗ-38 · 436-ФЗ',
      extraSeconds: 0.5,
      matchedExcerpt: ageTriggerMatch[0],
      explanation:
        'Для мероприятий, концертов, курсов, фильмов и приложений в самом конце произносится возрастная отметка (например, «двенадцать плюс» — ~0,5 сек).',
      suggestedDisclaimer: '12+.',
    });
  }

  // 8. Превосходные степени и некорректные сравнения (ч. 2–3 ст. 5 ФЗ-38)
  const superlativeMatch = cleanText.match(
    /(№\s*1\b|номер\s+один|сам(ый|ая|ое|ые|ых|ом|ой)\s+[а-яё]+|лучш(ий|ая|ее|ие|их)|единственн[а-яё]*|лидер\s+рынка|дешевле\s+всех|гарантия\s+100\s*%)/i
  );
  if (superlativeMatch) {
    findings.push({
      code: 'superlative_comparison_5fz',
      severity: 'moderation_risk',
      title: 'Риск отклонения: превосходная степень в тексте',
      legalNorm: 'ч. 2–3 ст. 5 ФЗ-38',
      extraSeconds: 0,
      matchedExcerpt: superlativeMatch[0],
      explanation:
        'Слова вроде «лучший», «самый» или «№ 1» радиостанции не пропускают без официального исследования. Продюсер предложит безопасную замену до записи.',
    });
  }

  // 9. Иностранные слова без перевода (ч. 5 ст. 5 ФЗ-38)
  const foreignWords = detectForeignWordsOutsideDomains(cleanText);
  if (foreignWords.length > 0) {
    findings.push({
      code: 'foreign_words_5fz',
      severity: 'moderation_risk',
      title: 'Иностранные слова требуют перевода или товарного знака',
      legalNorm: 'ч. 5 ст. 5 ФЗ-38',
      extraSeconds: 0,
      matchedExcerpt: foreignWords.join(', '),
      explanation:
        'Латиница в эфире должна иметь русский перевод либо подтверждаться свидетельством Роспатента на товарный знак.',
    });
  }

  // Реалистичное студийное сложение недостающих сносок:
  // в эфире диктор произносит объединённую сноску единой плотной фразой (потолок 4.5 сек)
  const mandatoryDisclaimers = findings.filter(
    (f) => f.severity === 'mandatory_disclaimer' && f.extraSeconds > 0
  );
  let legalDisclaimerSec = 0;
  if (mandatoryDisclaimers.length === 1) {
    legalDisclaimerSec = mandatoryDisclaimers[0]!.extraSeconds;
  } else if (mandatoryDisclaimers.length > 1) {
    const sorted = [...mandatoryDisclaimers].sort(
      (a, b) => b.extraSeconds - a.extraSeconds
    );
    const baseTail = sorted[0]!.extraSeconds;
    const extraTail = sorted
      .slice(1)
      .reduce((acc, item) => acc + item.extraSeconds * 0.45, 0);
    legalDisclaimerSec = Math.min(
      4.5,
      Math.round((baseTail + extraTail) * 2) / 2
    );
  }

  const spokenCreativeSec = baseChrono.spokenSecondsExact;
  const totalExactSec = round1(spokenCreativeSec + legalDisclaimerSec);
  const exactRoundedSec = Math.ceil(totalExactSec);
  const recommendedSlotSec = resolveStudioBroadcastSlot(totalExactSec);

  const combinedSampleDisclaimer = mandatoryDisclaimers
    .map((f) => f.suggestedDisclaimer)
    .filter((s): s is string => Boolean(s))
    .join(' ');

  const denomSec = Math.max(recommendedSlotSec, totalExactSec, 1);
  const creativeSharePct = Math.min(
    100,
    Math.round((spokenCreativeSec / denomSec) * 100)
  );
  const disclaimerSharePct = Math.min(
    100 - creativeSharePct,
    Math.round((legalDisclaimerSec / denomSec) * 100)
  );

  const hasMandatoryDisclaimers = mandatoryDisclaimers.length > 0;
  const hasModerationRisks = findings.some(
    (f) => f.severity === 'moderation_risk'
  );

  const airMarginSec = round1(recommendedSlotSec - totalExactSec);
  let summaryHeadline: string;
  let summaryAdvice: string;

  if (totalExactSec > 60.5) {
    summaryHeadline = `Слишком длинный текст (~${exactRoundedSec} сек — выше лимита 60 сек)`;
    summaryAdvice =
      'Эфирные рекламные слоты обычно ограничены 60 секундами. Рекомендуем сократить второстепенные детали — наш копирайтер поможет сжать текст без потери смысла.';
  } else if (airMarginSec >= 1.2) {
    summaryHeadline = `Оптимальный слот — ${recommendedSlotSec} сек (запас ${airMarginSec} сек)`;
    summaryAdvice = hasMandatoryDisclaimers
      ? `Основной текст (~${spokenCreativeSec} с) и сноска ФЗ-38 (+${legalDisclaimerSec} с в быстром дикторском темпе) свободно ложатся в ${recommendedSlotSec}-секундный ролик.`
      : `Текст звучит ~${spokenCreativeSec} с и оставляет ${airMarginSec} с под музыкальный акцент и запоминающийся финал.`;
  } else {
    summaryHeadline = `Плотно ложится в слот ${recommendedSlotSec} сек (~${totalExactSec} сек)`;
    summaryAdvice = hasMandatoryDisclaimers
      ? `Вместе со сноской ФЗ-38 (+${legalDisclaimerSec} с) ролик ровно укладывается в ${recommendedSlotSec} сек — на записи сведём секунда в секунду.`
      : `Текст идёт впритык под ${recommendedSlotSec} сек — на записи уложим диктора ровно в хронометраж слота.`;
  }

  const recommendedFormatId: OrderFormatId =
    baseChrono.rawWordCount >= 8 && totalExactSec <= 60.5
      ? 'voice_style'
      : 'turnkey';

  return {
    inputMode: 'text',
    isEmpty: false,
    charCountWithSpaces,
    charCountWithoutSpaces,
    wordCount: baseChrono.rawWordCount,
    spokenWordCount: baseChrono.spokenWordCount,
    syllableCount: baseChrono.syllableCount,
    digitGroupsCount: baseChrono.digitGroupsCount,
    tempo,
    spokenCreativeSec,
    legalDisclaimerSec,
    totalExactSec,
    exactRoundedSec,
    recommendedSlotSec,
    hasMandatoryDisclaimers,
    hasModerationRisks,
    findings,
    combinedSampleDisclaimer,
    resolvedPrimaryCategory: primaryCategory,
    mappedIndustryPreset,
    recommendedFormatId,
    creativeSharePct,
    disclaimerSharePct,
    summaryHeadline,
    summaryAdvice,
  };
}

/**
 * Формирует чистое задание для переноса из автоматического калькулятора ФЗ-38 в форму заявки (`/order`).
 */
export function buildFullReportBriefTransferText(params: {
  scriptText: string;
  report: FullScriptChronometerReport;
  includeSampleDisclaimer?: boolean;
  charCountMode?: CharacterCountMode;
}): string {
  const cleanScript = params.scriptText.trim();
  const tempoLabel =
    SCRIPT_TEMPO_OPTIONS.find((item) => item.id === params.report.tempo)
      ?.label ?? 'Деловой стандарт';
  const modeLabel =
    params.charCountMode === 'without_spaces' ? 'без пробелов' : 'с пробелами';

  const parts: string[] = [];
  if (params.report.inputMode === 'text' && cleanScript) {
    parts.push(cleanScript);
  } else if (params.report.inputMode === 'chars' && !params.report.isEmpty) {
    const shownChars =
      params.charCountMode === 'without_spaces'
        ? params.report.charCountWithoutSpaces
        : params.report.charCountWithSpaces;
    parts.push(
      `Ориентировочный объём сценария: ${shownChars} знаков (${modeLabel}), примерный хронометраж ~${params.report.totalExactSec} сек.`
    );
  }

  if (
    params.includeSampleDisclaimer &&
    params.report.combinedSampleDisclaimer
  ) {
    const norms = params.report.findings
      .filter((f) => f.severity === 'mandatory_disclaimer')
      .map((f) => f.legalNorm)
      .join(', ');
    parts.push(
      `[Дисклеймер ${norms || 'ФЗ-38'}]: ${params.report.combinedSampleDisclaimer}`
    );
  }

  const riskNotes = params.report.findings
    .filter((f) => f.severity === 'moderation_risk')
    .map((f) => `${f.title} («${f.matchedExcerpt}»)`);

  const metaChunks = [
    `~${params.report.totalExactSec} сек`,
    `${params.report.charCountWithSpaces} зн. с пробелами`,
    `темп «${tempoLabel}»`,
  ];
  if (params.report.legalDisclaimerSec > 0) {
    metaChunks.push(`сноски ФЗ-38: +${params.report.legalDisclaimerSec} сек`);
  }
  if (riskNotes.length > 0) {
    metaChunks.push(`проверить до записи: ${riskNotes.join('; ')}`);
  }

  parts.push(`[Расчёт хронометра: ${metaChunks.join(' · ')}]`);

  return parts.join('\n\n').slice(0, 1950);
}
