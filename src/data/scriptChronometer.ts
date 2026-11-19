export type ScriptTempoId = 'calm_image' | 'business_standard' | 'dynamic_retail';

export type LegalDisclaimerId = 'none' | 'finance_realty' | 'medicine';

export interface ScriptTempoOption {
  id: ScriptTempoId;
  label: string;
  wordsPerMinute: number;
  syllablesPerSecond: number;
  wordTransitionSec: number;
  sentencePauseSec: number;
  clausePauseSec: number;
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
  spokenWordCount: number;
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

/**
 * Эталонные студийные темпы дикторской начитки в радиорекламе РФ (стандарт КупиГолос / Хрономер):
 * - Спокойный имиджевый (~105 сл/мин: ~25 слов / ~180 зн. на 15 сек; ~50 слов / ~360 зн. на 30 сек)
 * - Средний рекламный (~120 сл/мин, «2 слова = 1 сек»: ~30 слов / ~210 зн. на 15 сек; ~60 слов / ~420 зн. на 30 сек)
 * - Быстрый акционный (~145 сл/мин: ~36 слов / ~250 зн. на 15 сек; ~70 слов / ~480 зн. на 30 сек)
 */
export const SCRIPT_TEMPO_OPTIONS: readonly ScriptTempoOption[] = [
  {
    id: 'calm_image',
    label: 'Спокойный имиджевый',
    wordsPerMinute: 105,
    syllablesPerSecond: 5.15,
    wordTransitionSec: 0.048,
    sentencePauseSec: 0.36,
    clausePauseSec: 0.14,
    hint: 'Размеренная подача с паузами (~25 слов или ~180 зн. на 15 сек)',
  },
  {
    id: 'business_standard',
    label: 'Средний рекламный',
    wordsPerMinute: 120,
    syllablesPerSecond: 6.0,
    wordTransitionSec: 0.04,
    sentencePauseSec: 0.3,
    clausePauseSec: 0.12,
    hint: 'Золотой стандарт радиорекламы РФ (~30 слов или ~210 зн. на 15 сек)',
  },
  {
    id: 'dynamic_retail',
    label: 'Быстрый акционный',
    wordsPerMinute: 145,
    syllablesPerSecond: 7.05,
    wordTransitionSec: 0.028,
    sentencePauseSec: 0.2,
    clausePauseSec: 0.08,
    hint: 'Динамичная подача для ритейла и распродаж (~36 слов или ~250 зн. на 15 сек)',
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
    label: 'ЖК / Финансы (+2.5 сек)',
    extraSeconds: 2.5,
    hint: 'Ускоренная сноска: застройщик и наш.дом.рф либо условия банка/лизинга',
  },
  {
    id: 'medicine',
    label: 'Медицина (+3 сек)',
    extraSeconds: 3,
    hint: 'Обязательное предупреждение по ч. 7 ст. 24 ФЗ-38 (не менее 3 сек в радиоэфире)',
  },
] as const;

export const CHRONOMETER_SAMPLE_SCRIPTS: readonly ScriptChronometerSample[] = [
  {
    id: 'sample-b2b-17s',
    label: 'Пример: Лизинг для бизнеса (~17 сек)',
    tempo: 'business_standard',
    disclaimer: 'finance_realty',
    text: 'Обновите коммерческий автопарк без вывода оборотных средств из бизнеса. Лизинг транспорта в «ТрансФинанс» с авансом от десяти процентов и одобрением за один день. Звоните 220-45-90.',
  },
  {
    id: 'sample-coffee-13s',
    label: 'Пример: Сеть пекарен (~13 сек)',
    tempo: 'dynamic_retail',
    disclaimer: 'none',
    text: 'Горячие французские круассаны на сливочном масле, ремесленный хлеб из печи и свежеобжаренный зерновой кофе каждое утро по пути на работу. Уютные пекарни «Зерно и Свет» — ваш тёплый завтрак за две минуты!',
  },
  {
    id: 'sample-clinic-22s',
    label: 'Пример: Семейная клиника (~22 сек)',
    tempo: 'calm_image',
    disclaimer: 'medicine',
    text: 'Когда вы в последний раз проверяли здоровье сердца спокойно, без спешки и очередей? В семейной клинике «ВераМед» полная диагностика у кардиолога и УЗИ проходят бережно за один утренний визит. Запишитесь по телефону 310-77-00.',
  },
] as const;

const ONES_MASC: readonly string[] = [
  '',
  'один',
  'два',
  'три',
  'четыре',
  'пять',
  'шесть',
  'семь',
  'восемь',
  'девять',
  'десять',
  'одиннадцать',
  'двенадцать',
  'тринадцать',
  'четырнадцать',
  'пятнадцать',
  'шестнадцать',
  'семнадцать',
  'восемнадцать',
  'девятнадцать',
];

const ONES_FEM: readonly string[] = [
  '',
  'одна',
  'две',
  ...ONES_MASC.slice(3),
];

const TENS: readonly string[] = [
  '',
  '',
  'двадцать',
  'тридцать',
  'сорок',
  'пятьдесят',
  'шестьдесят',
  'семьдесят',
  'восемьдесят',
  'девяносто',
];

const HUNDREDS: readonly string[] = [
  '',
  'сто',
  'двести',
  'триста',
  'четыреста',
  'пятьсот',
  'шестьсот',
  'семьсот',
  'восемьсот',
  'девятьсот',
];

function tripletToRussianWords(n: number, feminine = false): string[] {
  const words: string[] = [];
  const h = Math.floor(n / 100);
  const rem = n % 100;
  if (h > 0 && HUNDREDS[h]) {
    words.push(HUNDREDS[h]);
  }
  if (rem >= 1 && rem <= 19) {
    const table = feminine ? ONES_FEM : ONES_MASC;
    if (table[rem]) words.push(table[rem]);
  } else if (rem >= 20) {
    const t = Math.floor(rem / 10);
    const o = rem % 10;
    if (TENS[t]) words.push(TENS[t]);
    const table = feminine ? ONES_FEM : ONES_MASC;
    if (o > 0 && table[o]) words.push(table[o]);
  }
  return words;
}

function pluralForm(
  n: number,
  forms: [string, string, string]
): string {
  const rem100 = n % 100;
  const rem10 = n % 10;
  if (rem100 >= 11 && rem100 <= 19) return forms[2];
  if (rem10 === 1) return forms[0];
  if (rem10 >= 2 && rem10 <= 4) return forms[1];
  return forms[2];
}

/**
 * Переводит целое число в русские числительные так, как их произносит диктор у микрофона.
 */
export function numberToRussianSpokenWords(rawDigits: string): string {
  const cleaned = rawDigits.replace(/\D/g, '');
  if (!cleaned) return '';

  // Ведущие нули в коротких группах ("00", "05", "000" в телефонах/кодах)
  if (/^0+$/.test(cleaned)) {
    return Array.from({ length: cleaned.length }, () => 'ноль').join(' ');
  }
  if (cleaned.startsWith('0') && cleaned.length <= 3) {
    const leadingZeros = cleaned.match(/^0+/)?.[0].length ?? 0;
    const rest = cleaned.slice(leadingZeros);
    const prefix = Array.from({ length: leadingZeros }, () => 'ноль').join(' ');
    const restWords = rest ? numberToRussianSpokenWords(rest) : '';
    return `${prefix} ${restWords}`.trim();
  }

  // Слишком длинные коды (ОГРН 13 цифр, ИНН 10–12 цифр) читаются парами/тройками цифр
  if (cleaned.length > 9) {
    const chunks: string[] = [];
    let i = 0;
    while (i < cleaned.length) {
      const take = cleaned.length - i === 4 ? 2 : Math.min(3, cleaned.length - i);
      chunks.push(numberToRussianSpokenWords(cleaned.slice(i, i + take)));
      i += take;
    }
    return chunks.join(' ');
  }

  const num = Number(cleaned);
  if (!Number.isFinite(num) || num === 0) return 'ноль';

  const words: string[] = [];
  const millions = Math.floor(num / 1_000_000);
  const thousands = Math.floor((num % 1_000_000) / 1_000);
  const remainder = num % 1_000;

  if (millions > 0) {
    words.push(...tripletToRussianWords(millions, false));
    words.push(pluralForm(millions, ['миллион', 'миллиона', 'миллионов']));
  }
  if (thousands > 0) {
    // В рекламе "1000 рублей" обычно читается "тысяча рублей" без лишнего "одна"
    if (thousands === 1 && millions === 0) {
      words.push('тысяча');
    } else {
      words.push(...tripletToRussianWords(thousands, true));
      words.push(pluralForm(thousands, ['тысяча', 'тысячи', 'тысяч']));
    }
  }
  if (remainder > 0) {
    words.push(...tripletToRussianWords(remainder, false));
  }

  return words.join(' ');
}

/**
 * Словарь буквенных аббревиатур, которые в радиоэфире произносятся по названиям букв.
 * (Звуковые аббревиатуры вроде УЗИ, БАД, ГОСТ, ВУЗ, МКАД уже содержат гласные и читаются слитно).
 */
const SPOKEN_ABBREVIATIONS: Readonly<Record<string, string>> = {
  жк: 'жэ ка',
  мрт: 'эм эр тэ',
  кт: 'ка тэ',
  экг: 'э ка гэ',
  лфк: 'эл эф ка',
  дмс: 'дэ эм эс',
  омс: 'о эм эс',
  ооо: 'о о о',
  пао: 'пэ а о',
  зао: 'зэ а о',
  ип: 'и пэ',
  огрн: 'о гэ эр эн',
  огрнип: 'о гэ эр эн и пэ',
  инн: 'и эн эн',
  кпп: 'ка пэ пэ',
  пск: 'пэ эс ка',
  цб: 'цэ бэ',
  рф: 'эр эф',
  тц: 'тэ цэ',
  трц: 'тэ эр цэ',
  бц: 'бэ цэ',
  мфц: 'эм фэ цэ',
  сз: 'эс зэ',
  фз: 'эф зэ',
  эдо: 'э дэ о',
  сбп: 'эс бэ пэ',
  ндс: 'эн дэ эс',
  жкх: 'жэ ка ха',
  гибдд: 'ги бэ дэ дэ',
  дтп: 'дэ тэ пэ',
  кпд: 'ка пэ дэ',
  смс: 'эс эм эс',
  sms: 'эс эм эс',
  b2b: 'би ту би',
  b2c: 'би ту си',
  fm: 'эф эм',
  usb: 'ю эс би',
  gps: 'джи пи эс',
  suv: 'эс ю ви',
  led: 'лед',
  vip: 'вип',
  spa: 'спа',
  wifi: 'вай фай',
};

/**
 * Преобразует письменный текст сценария в реально звучащую речь диктора:
 * - убирает служебные ремарки (Диктор:, Мужской голос:, [звук ...], (бодро)),
 * - раскрывает телефонные номера группами цифр (310-77-00 -> триста десять семьдесят семь ноль ноль),
 * - переводит числа, проценты, валюту, домены и аббревиатуры (ЖК, МРТ, 6%, 300 000 ₽) в произносимые слова.
 */
export function expandRussianTextForVoiceover(rawText: string): {
  spokenText: string;
  digitGroupsCount: number;
} {
  let digitGroupsCount = 0;

  // 1. Убираем имена ролей в начале строк и звукорежиссёрские ремарки в скобках
  let text = rawText
    .replace(
      /(?:^|\n)\s*(?:диктор\s*\d*|голос\s*\d*|мужской\s+голос|женский\s+голос|детский\s+голос|акт[её]р\s*\d*|ведущий|персонаж\s*\d*|мг|жг)\s*(?:\([^)]*\))?\s*:/gi,
      ' '
    )
    .replace(
      /\[(?:звук|музыка|шум|пауза|sfx|джингл|отбивка|прим|ремарка|логотип|пэкшот)[^\]]*\]/gi,
      ' '
    )
    .replace(
      /\((?:уверенно|спокойно|бодро|мягко|динамично|быстро|ш[её]потом|радостно|серь[её]зно|с\s+улыбкой|тепло|торжественно|пауза|музыка|звук|sfx)[^)]*\)/gi,
      ' '
    );

  // 2. Возрастная маркировка 0+ / 6+ / 12+ / 16+ / 18+
  text = text.replace(/(?<!\d)(0|6|12|16|18)\+/g, (_m, age: string) => {
    digitGroupsCount += 1;
    return ` ${numberToRussianSpokenWords(age)} плюс `;
  });

  // 3. Федеральные и мобильные телефоны: +7 (904) 000-09-11 / 8 800 555-35-35
  text = text.replace(
    /(?:\+7|(?<!\d)8)[\s()-]*(\d{3})[\s()-]*(\d{3})[\s-]*(\d{2})[\s-]*(\d{2})(?!\d)/g,
    (match, code: string, p1: string, p2: string, p3: string) => {
      digitGroupsCount += 1;
      const prefix = match.trim().startsWith('+7') ? 'плюс семь' : 'восемь';
      return ` ${prefix} ${numberToRussianSpokenWords(code)} ${numberToRussianSpokenWords(p1)} ${numberToRussianSpokenWords(p2)} ${numberToRussianSpokenWords(p3)} `;
    }
  );

  // 4. Городские телефоны через дефис: 310-77-00, 22-33-44, 240-15-80
  text = text.replace(
    /(?<!\d)(\d{2,3})-(\d{2})-(\d{2})(?!\d)/g,
    (_m, p1: string, p2: string, p3: string) => {
      digitGroupsCount += 1;
      return ` ${numberToRussianSpokenWords(p1)} ${numberToRussianSpokenWords(p2)} ${numberToRussianSpokenWords(p3)} `;
    }
  );

  // 5. Склеиваем пробелы между тысячами в числах ("300 000" -> "300000", "1 500 000" -> "1500000")
  text = text.replace(/(\d{1,3})\s+(\d{3})\s+(\d{3})(?!\d)/g, '$1$2$3');
  text = text.replace(/(\d{1,3})\s+(\d{3})(?!\d)/g, '$1$2');

  // 6. Дробные ставки с половиной ("6,5%" -> "шесть с половиной процентов", "6,9%" -> "шесть и девять процентов")
  text = text.replace(
    /(\d+)[,.](\d)\s*%/g,
    (_m, whole: string, frac: string) => {
      digitGroupsCount += 1;
      const wholeSpoken = numberToRussianSpokenWords(whole);
      if (frac === '5') {
        return ` ${wholeSpoken} с половиной процентов `;
      }
      return ` ${wholeSpoken} и ${numberToRussianSpokenWords(frac)} процентов `;
    }
  );

  // 7. Целые проценты ("6%" -> "шесть процентов", "1%" -> "один процент")
  text = text.replace(/(\d+)\s*%/g, (_m, digits: string) => {
    digitGroupsCount += 1;
    const n = Number(digits);
    const unit = pluralForm(Number.isFinite(n) ? n : 5, [
      'процент',
      'процента',
      'процентов',
    ]);
    return ` ${numberToRussianSpokenWords(digits)} ${unit} `;
  });

  // 8. Домены ("uyutdom.ru" -> "uyutdom точка ру", "наш.дом.рф" -> "наш точка дом точка эр эф")
  text = text.replace(/https?:\/\/(www\.)?/gi, ' ');
  text = text.replace(/\.рф(?![а-яёa-z0-9])/gi, ' точка эр эф ');
  text = text.replace(/\.ru(?![а-яёa-z0-9])/gi, ' точка ру ');
  text = text.replace(/\.com(?![а-яёa-z0-9])/gi, ' точка ком ');
  text = text.replace(/\.pro(?![а-яёa-z0-9])/gi, ' точка про ');
  text = text.replace(
    /(?<=[а-яёa-z0-9])\.(?=[а-яёa-z]{2,})/gi,
    ' точка '
  );

  // 9. Знак номера, валюты и типовые сокращения в сценариях
  text = text
    .replace(/№/g, ' номер ')
    .replace(/₽/g, ' рублей ')
    .replace(/(?<![а-яё])руб\.?(?![а-яё])/gi, ' рублей ')
    .replace(/(?<=\d\s*)р\.(?![а-яё])/gi, ' рублей ')
    .replace(/(?<![а-яё])тыс\.?(?![а-яё])/gi, ' тысяч ')
    .replace(/(?<![а-яё])млн\.?(?![а-яё])/gi, ' миллионов ')
    .replace(/(?<![а-яё])млрд\.?(?![а-яё])/gi, ' миллиардов ')
    .replace(/(?<![а-яё])ул\.(?=\s*[а-яё])/gi, ' улица ')
    .replace(/(?<![а-яё])г\.(?=\s*[А-ЯЁ])/g, ' город ')
    .replace(/(?<![а-яё])пр-т(?![а-яё])/gi, ' проспект ')
    .replace(/(?<![а-яё])корп\.(?![а-яё])/gi, ' корпус ')
    .replace(/(?<![а-яё])стр\.(?![а-яё])/gi, ' строение ')
    .replace(/(?<![а-яё])д\.(?=\s*\d)/gi, ' дом ')
    .replace(/(?<![а-яё])оф\.(?=\s*\d)/gi, ' офис ')
    .replace(/(?<![а-яё])тел\.(?![а-яё])/gi, ' телефон ')
    .replace(/wi-fi/gi, ' вай фай ');

  // 10. Оставшиеся числа переводим в русские числительные
  text = text.replace(/\d+/g, (digits) => {
    digitGroupsCount += 1;
    return ` ${numberToRussianSpokenWords(digits)} `;
  });

  // 11. Буквенные аббревиатуры (ЖК, МРТ, ООО, ИП, ОГРН, B2B и др.)
  text = text.replace(
    /(?<![а-яёa-z0-9])([а-яёa-z0-9]{2,6})(?![а-яёa-z0-9])/gi,
    (word) => {
      const mapped = SPOKEN_ABBREVIATIONS[word.toLowerCase()];
      return mapped ? ` ${mapped} ` : word;
    }
  );

  const spokenText = text.replace(/\s+/g, ' ').trim();
  return { spokenText, digitGroupsCount };
}

const VOWEL_REGEX = /[аеёиоуыэюяaeiouy]/gi;

function countSpokenSyllablesFromExpandedText(spokenText: string): {
  syllables: number;
  spokenWords: number;
} {
  if (!spokenText) return { syllables: 0, spokenWords: 0 };

  // Составные слова через дефис ("интернет-магазин", "бизнес-класс") читаются слитно без паузы
  const tokens = spokenText
    .split(/\s+/)
    .map((t) => t.replace(/^[^а-яёa-z]+|[^а-яёa-z]+$/gi, ''))
    .filter((t) => /[а-яёa-z]/i.test(t));

  let syllables = 0;
  for (const tok of tokens) {
    const vowels = tok.match(VOWEL_REGEX)?.length ?? 0;
    if (vowels > 0) {
      syllables += vowels;
    } else {
      // Однобуквенные предлоги без гласных ("в", "с", "к") дают минимальную смычку согласных
      syllables += 0.15;
    }
  }

  return { syllables, spokenWords: tokens.length };
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
 * Рассчитывает точный студийный хронометраж дикторского чтения текста в секундах:
 * раскрывает числа, телефоны, проценты и аббревиатуры в реальные русские слова,
 * считает фактические слоги и межфразовые вдохи (не путая дефисы с тире).
 */
const LEGAL_TAIL_SENTENCE_REGEX =
  /противопоказан[а-яё]*|консультаци[а-яё]+\s+специалист|не\s+является\s+лекарственн|проектн[а-яё]+\s+деклараци|наш\.?дом\.?рф|застройщик\s+(?:ооо|ао|пао|сз)|оценивайте\s+свои\s+финансов|полн[а-яё]+\s+стоимост[а-яё]+\s+кредит|диапазон\s+пск|генеральн[а-яё]+\s+лицензи[а-яё]+\s+банка|(?:срок[а-яё]*|правил[а-яё]*|организатор[а-яё]*)\s+(?:проведения\s+|и\s+правила\s+)?акци|подробност[а-яё]*\s+(?:акции\s+)?на\s+сайте|\bогрн(?:ип)?\b|юр\.?\s*адрес|^\s*(?:0|6|12|16|18)\+\s*[.!]?\s*$/i;

const CREATIVE_CTA_GUARD_REGEX =
  /\b(?:звоните|запишитесь|приходите|заказывайте|покупайте|выбирайте|успейте|ждём\s+вас)\b/i;

/**
 * Отделяет финальные юридические сноски в конце сценария от основного рекламного текста:
 * в реальном радиопроизводстве сноски в конце ролика начитываются быстрым информационным темпом
 * (~180–200 сл/мин, ~9.2 слога/сек), а медицинские/БАД сноски длятся ровно не менее 3.0 сек.
 */
function splitCreativeAndTrailingLegalTail(normalizedText: string): {
  creativeText: string;
  legalTailText: string;
} {
  const sentences = normalizedText.match(/[^.!?…]+[.!?…]*/g);
  if (!sentences || sentences.length === 0) {
    return { creativeText: normalizedText, legalTailText: '' };
  }

  let splitIdx = sentences.length;
  while (splitIdx > 0) {
    const candidate = sentences[splitIdx - 1]!.trim();
    if (!candidate) {
      splitIdx -= 1;
      continue;
    }
    if (
      LEGAL_TAIL_SENTENCE_REGEX.test(candidate) &&
      !CREATIVE_CTA_GUARD_REGEX.test(candidate)
    ) {
      splitIdx -= 1;
    } else {
      break;
    }
  }

  if (splitIdx === sentences.length) {
    return { creativeText: normalizedText, legalTailText: '' };
  }

  return {
    creativeText: sentences.slice(0, splitIdx).join(' ').trim(),
    legalTailText: sentences.slice(splitIdx).join(' ').trim(),
  };
}

/**
 * Рассчитывает точный студийный хронометраж дикторского чтения текста в секундах:
 * раскрывает числа, телефоны, проценты и аббревиатуры в реальные русские слова,
 * учитывает слоги, межсловную артикуляцию предлогов/коротких слов, вдохи на точках/запятых
 * и быстрый дикторский темп финальных юридических сносок.
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
      spokenWordCount: 0,
      syllableCount: 0,
      digitGroupsCount: 0,
      pauseBonusSec: 0,
      spokenSecondsExact: 0,
      disclaimerSeconds: disclaimerSpec.extraSeconds,
      totalSecondsExact: disclaimerSpec.extraSeconds,
      recommendedSeconds: Math.max(15, Math.ceil(disclaimerSpec.extraSeconds + 10)),
      nearestStandardSec: 15,
      isOverSixtySeconds: false,
      pacingAdvice:
        'Вставьте черновик текста или оффер, чтобы узнать точный хронометраж ролика в секундах.',
    };
  }

  const mergedForRawCount = normalized.replace(/(\d{1,3})\s+(\d{3})(?!\d)/g, '$1$2');
  const rawTokens = mergedForRawCount
    .split(/\s+/)
    .filter((tok) => /[a-zа-яё0-9%₽]/i.test(tok));

  const { spokenText: fullSpokenText, digitGroupsCount } =
    expandRussianTextForVoiceover(normalized);
  const { syllables: totalSyllables, spokenWords: totalSpokenWords } =
    countSpokenSyllablesFromExpandedText(fullSpokenText);

  if (totalSpokenWords === 0) {
    return {
      rawWordCount: 0,
      spokenWordCount: 0,
      syllableCount: 0,
      digitGroupsCount: 0,
      pauseBonusSec: 0,
      spokenSecondsExact: 0,
      disclaimerSeconds: disclaimerSpec.extraSeconds,
      totalSecondsExact: disclaimerSpec.extraSeconds,
      recommendedSeconds: 15,
      nearestStandardSec: 15,
      isOverSixtySeconds: false,
      pacingAdvice:
        'Вставьте текст для озвучивания (ремарки в скобках диктором не читаются).',
    };
  }

  const { creativeText, legalTailText } =
    splitCreativeAndTrailingLegalTail(normalized);

  let creativeRawSec = 0;
  let pauseBonusSec = 0;

  if (creativeText) {
    const { spokenText: creativeSpoken } =
      expandRussianTextForVoiceover(creativeText);
    const { syllables: cSyl, spokenWords: cWords } =
      countSpokenSyllablesFromExpandedText(creativeSpoken);

    const withoutTrailingPunct = creativeText.replace(/[.!?…\s]+$/g, '');
    const internalSentenceBreaks = (
      withoutTrailingPunct.match(/[.!?…]+/g) ?? []
    ).length;
    const clauseBreaks =
      (withoutTrailingPunct.match(/[,;:]/g) ?? []).length +
      (withoutTrailingPunct.match(/\s[—–-]\s/g) ?? []).length;

    pauseBonusSec = Math.min(
      3.5,
      internalSentenceBreaks * tempoSpec.sentencePauseSec +
        clauseBreaks * tempoSpec.clausePauseSec
    );

    creativeRawSec =
      cSyl / tempoSpec.syllablesPerSecond +
      cWords * tempoSpec.wordTransitionSec +
      pauseBonusSec;
  }

  let inlineLegalTailSec = 0;
  if (legalTailText) {
    const { spokenText: tailSpoken } =
      expandRussianTextForVoiceover(legalTailText);
    const { syllables: tSyl, spokenWords: tWords } =
      countSpokenSyllablesFromExpandedText(tailSpoken);

    // Финальная юридическая скороговорка в радиоролике (~9.2 слога/сек)
    const fastTailSec = tSyl / 9.2 + tWords * 0.018 + 0.15;
    const hasStatutory3sFloor =
      /противопоказан[а-яё]*|консультаци[а-яё]+\s+специалист|не\s+является\s+лекарственн/i.test(
        legalTailText
      );
    inlineLegalTailSec = hasStatutory3sFloor
      ? Math.max(3.0, fastTailSec)
      : fastTailSec;
  }

  const spokenSecondsExact =
    Math.round((creativeRawSec + inlineLegalTailSec) * 10) / 10;
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
    spokenWordCount: totalSpokenWords,
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
