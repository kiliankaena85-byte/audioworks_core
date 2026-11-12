export type ScriptTempoId = 'calm_image' | 'business_standard' | 'dynamic_retail';

export type LegalDisclaimerId = 'none' | 'finance_realty' | 'medicine';

export interface ScriptTempoOption {
  id: ScriptTempoId;
  label: string;
  wordsPerMinute: number;
  syllablesPerSecond: number;
  hint: string;
}

export interface LegalDisclaimerOption {
  id: LegalDisclaimerId;
  label: string;
  extraSeconds: number;
  hint: string;
}

export interface ScriptChronometerSample {
  id: string;
  label: string;
  tempo: ScriptTempoId;
  disclaimer: LegalDisclaimerId;
  text: string;
}

export interface ScriptChronometerResult {
  rawWordCount: number;
  syllableCount: number;
  digitGroupsCount: number;
  pauseBonusSec: number;
  spokenSecondsExact: number;
  disclaimerSeconds: number;
  totalSecondsExact: number;
  recommendedSeconds: number;
  nearestStandardSec: 5 | 10 | 15 | 20 | 30 | 45 | 60;
  isOverSixtySeconds: boolean;
  pacingAdvice: string;
}

export const STANDARD_SPOT_DURATIONS = [5, 10, 15, 20, 30, 45, 60] as const;
export type StandardSpotDuration = (typeof STANDARD_SPOT_DURATIONS)[number];

export const MIN_CUSTOM_SPOT_SECONDS = 5;
export const MAX_CUSTOM_SPOT_SECONDS = 60;

export const SCRIPT_TEMPO_OPTIONS: readonly ScriptTempoOption[] = [
  {
    id: 'calm_image',
    label: 'Спокойный имиджевый',
    wordsPerMinute: 105,
    syllablesPerSecond: 4.15,
    hint: 'Воздух, паузы и статусная подача для ЖК, медицины и брендов',
  },
  {
    id: 'business_standard',
    label: 'Деловой стандарт',
    wordsPerMinute: 120,
    syllablesPerSecond: 4.75,
    hint: 'Уверенный естественный темп для B2B, авто и городских услуг',
  },
  {
    id: 'dynamic_retail',
    label: 'Динамичный акционный',
    wordsPerMinute: 136,
    syllablesPerSecond: 5.35,
    hint: 'Энергичная подача для акций ритейла, доставки и распродаж',
  },
] as const;

export const LEGAL_DISCLAIMER_OPTIONS: readonly LegalDisclaimerOption[] = [
  {
    id: 'none',
    label: 'Без дисклеймера',
    extraSeconds: 0,
    hint: 'Обычные товары, услуги, HoReCa и B2B без обязательных сносок',
  },
  {
    id: 'finance_realty',
    label: 'ЖК / Финансы (+3 сек)',
    extraSeconds: 3,
    hint: 'Проектная декларация застройщика, условия банка или лизинга',
  },
  {
    id: 'medicine',
    label: 'Медицина (+4 сек)',
    extraSeconds: 4,
    hint: 'Обязательное предупреждение о консультации специалиста по ФЗ-38',
  },
] as const;

export const CHRONOMETER_SAMPLE_SCRIPTS: readonly ScriptChronometerSample[] = [
  {
    id: 'sample-b2b-17s',
    label: 'Пример: Лизинг для бизнеса (~17 сек)',
    tempo: 'business_standard',
    disclaimer: 'finance_realty',
    text: 'Обновите автопарк компании без вывода оборотных средств. Выгодный лизинг транспорта с одобрением за один день. Звоните 220-45-90.',
  },
  {
    id: 'sample-coffee-13s',
    label: 'Пример: Сеть пекарен (~13 сек)',
    tempo: 'dynamic_retail',
    disclaimer: 'none',
    text: 'Тёплый круассан на сливочном масле и свежеобжаренный фильтр-кофе каждое утро по пути на работу. Загляните в уютные пекарни «Зерно и Свет» — горячий завтрак за две минуты!',
  },
  {
    id: 'sample-clinic-22s',
    label: 'Пример: Семейная клиника (~22 сек)',
    tempo: 'calm_image',
    disclaimer: 'medicine',
    text: 'Когда вы проверяли здоровье сердца без спешки и очередей? В клинике «ВераМед» полное обследование проходит за один утренний визит. Запись по номеру 310-77-00.',
  },
] as const;

const VOWEL_REGEX = /[аеёиоуыэюяaeiouy]/gi;

function countSpokenSyllablesInToken(token: string): {
  syllables: number;
  isNumericGroup: boolean;
} {
  const clean = token.trim();
  if (!clean) return { syllables: 0, isNumericGroup: false };

  // Телефоны и числа: каждая цифра в среднем произносится диктором в 1.75 слога
  const digits = clean.replace(/\D/g, '');
  if (digits.length > 0 && digits.length >= clean.replace(/[^\da-zа-яё]/gi, '').length) {
    // Например "220-45-90" (7 цифр) -> ~12 слогов, "40000" -> "сорок тысяч" (~4–6 слогов)
    const isRoundThousands = /^(\d{1,3})(000)$/.test(digits);
    const effectiveSyllables = isRoundThousands
      ? 5
      : Math.max(2, Math.round(digits.length * 1.65));
    return { syllables: effectiveSyllables, isNumericGroup: true };
  }

  // Домены вида fmworks.ru / veramed.ru — ".ru" читается как "точка ру" (+3 слога)
  let domainBonus = 0;
  if (/\.(ru|рф|com|pro)\b/i.test(clean)) {
    domainBonus = 3;
  }

  // Символы % и ₽ озвучиваются словами ("процентов", "рублей")
  if (clean.includes('%')) domainBonus += 3;
  if (clean.includes('₽')) domainBonus += 2;

  const vowelMatches = clean.match(VOWEL_REGEX);
  const baseVowels = vowelMatches ? vowelMatches.length : 0;

  // Аббревиатуры без гласных (ЖК, B2B, ЭДО, МРТ) читаются побуквенно
  const lettersOnly = clean.replace(/[^a-zа-яё]/gi, '');
  const fallbackAbbr =
    baseVowels === 0 && lettersOnly.length >= 2
      ? Math.min(6, lettersOnly.length * 1.4)
      : baseVowels === 0 && lettersOnly.length === 1
        ? 0.45
        : baseVowels;

  return {
    syllables: Math.max(0.4, fallbackAbbr + domainBonus),
    isNumericGroup: digits.length >= 2,
  };
}

export function resolveNearestStandardDuration(seconds: number): StandardSpotDuration {
  const clamped = Math.max(MIN_CUSTOM_SPOT_SECONDS, Math.min(MAX_CUSTOM_SPOT_SECONDS, seconds));
  for (const std of STANDARD_SPOT_DURATIONS) {
    if (clamped <= std) return std;
  }
  return 60;
}

export function clampExactSpotSeconds(rawSeconds: number): number {
  if (!Number.isFinite(rawSeconds)) return 15;
  return Math.max(
    MIN_CUSTOM_SPOT_SECONDS,
    Math.min(MAX_CUSTOM_SPOT_SECONDS, Math.round(rawSeconds))
  );
}

/**
 * Рассчитывает честный хронометраж дикторского чтения текста в секундах
 * с учётом слоговой длины слов, телефонных номеров, пунктуационных пауз,
 * выбранного темпа подачи и юридического дисклеймера.
 */
export function calculateScriptChronometer(params: {
  text: string;
  tempo?: ScriptTempoId;
  disclaimer?: LegalDisclaimerId;
}): ScriptChronometerResult {
  const {
    text,
    tempo = 'business_standard',
    disclaimer = 'none',
  } = params;

  const tempoSpec =
    SCRIPT_TEMPO_OPTIONS.find((item) => item.id === tempo) ?? SCRIPT_TEMPO_OPTIONS[1];
  const disclaimerSpec =
    LEGAL_DISCLAIMER_OPTIONS.find((item) => item.id === disclaimer) ??
    LEGAL_DISCLAIMER_OPTIONS[0];

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return {
      rawWordCount: 0,
      syllableCount: 0,
      digitGroupsCount: 0,
      pauseBonusSec: 0,
      spokenSecondsExact: 0,
      disclaimerSeconds: disclaimerSpec.extraSeconds,
      totalSecondsExact: disclaimerSpec.extraSeconds,
      recommendedSeconds: Math.max(15, disclaimerSpec.extraSeconds + 10),
      nearestStandardSec: 15,
      isOverSixtySeconds: false,
      pacingAdvice: 'Вставьте черновик текста или оффер, чтобы узнать точный хронометраж ролика в секундах.',
    };
  }

  // Схлопываем разделённые пробелами разряды чисел ("40 000" -> "40000"), чтобы не считать их за 2 отдельных числа
  const mergedThousands = normalized.replace(/(\d{1,3})\s+(\d{3})\b/g, '$1$2');
  const rawTokens = mergedThousands
    .split(/\s+/)
    .map((tok) => tok.trim())
    .filter((tok) => /[a-zа-яё0-9%₽]/i.test(tok));

  let totalSyllables = 0;
  let digitGroupsCount = 0;

  for (const token of rawTokens) {
    const analyzed = countSpokenSyllablesInToken(token);
    totalSyllables += analyzed.syllables;
    if (analyzed.isNumericGroup) {
      digitGroupsCount += 1;
    }
  }

  // Смысловые паузы на точках, тире, вопросах и многоточиях + стартовый/финальный вдох звукорежиссуры (0.75с)
  const sentenceBreaks = (normalized.match(/[.!?…]+/g) ?? []).length;
  const midPauses = (normalized.match(/[,;:\u2014—–-]+/g) ?? []).length;
  const pauseBonusSec =
    0.75 + Math.min(4.5, sentenceBreaks * 0.36 + midPauses * 0.14);

  const spokenSecondsExact =
    Math.round((totalSyllables / tempoSpec.syllablesPerSecond + pauseBonusSec) * 10) / 10;
  const totalSecondsExact =
    Math.round((spokenSecondsExact + disclaimerSpec.extraSeconds) * 10) / 10;

  const rawRounded = Math.ceil(totalSecondsExact);
  const isOverSixtySeconds = rawRounded > MAX_CUSTOM_SPOT_SECONDS;
  const recommendedSeconds = clampExactSpotSeconds(rawRounded);
  const nearestStandardSec = resolveNearestStandardDuration(recommendedSeconds);

  let pacingAdvice: string;
  if (isOverSixtySeconds) {
    pacingAdvice = `Текст звучит около ${rawRounded} сек — выше эфирного лимита 60 сек. Сократите второстепенные детали или выберите более динамичный темп.`;
  } else if (recommendedSeconds <= 12) {
    pacingAdvice = `Короткий хлесткий спот на ${recommendedSeconds} сек: отлично работает в спонсорстве погоды, трафика и плотных напоминаниях.`;
  } else if (recommendedSeconds <= 20) {
    pacingAdvice = `Оптимальный коммерческий метраж ${recommendedSeconds} сек: один чёткий оффер и контакт считываются слушателем без перегруза.`;
  } else if (recommendedSeconds <= 32) {
    pacingAdvice = `Развёрнутый ролик на ${recommendedSeconds} сек: хватает воздуха на игровую сцену, аргументацию и запоминающийся финал.`;
  } else {
    pacingAdvice = `Имиджевый формат ${recommendedSeconds} сек: подходит для сторителлинга и сложных продуктов, расчёт эфира пойдёт честно за ${recommendedSeconds} сек.`;
  }

  return {
    rawWordCount: rawTokens.length,
    syllableCount: Math.round(totalSyllables),
    digitGroupsCount,
    pauseBonusSec: Math.round(pauseBonusSec * 10) / 10,
    spokenSecondsExact,
    disclaimerSeconds: disclaimerSpec.extraSeconds,
    totalSecondsExact,
    recommendedSeconds,
    nearestStandardSec,
    isOverSixtySeconds,
    pacingAdvice,
  };
}
