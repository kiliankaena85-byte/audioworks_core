export type FaqIconKey =
  | 'waveform'
  | 'clock'
  | 'mic'
  | 'sliders'
  | 'shield'
  | 'radio'
  | 'file-audio'
  | 'receipt';

export interface FaqItem {
  id: string;
  indexLabel: string;
  question: string;
  answer: string;
  iconKey?: FaqIconKey;
}

export const EDITORIAL_FAQ_ITEMS: FaqItem[] = [
  {
    id: 'production-vs-voiceover',
    indexLabel: '01',
    iconKey: 'sliders',
    question:
      'В чем разница между вашей работой за 25 000 ₽ и обычной озвучкой за 3 000 – 5 000 ₽?',
    answer:
      'За 3 000 – 5 000 ₽ вы покупаете только запись одного дикторского голоса по вашему тексту — без идеи, режиссуры и проверки рисков. В продакшне FMWorks за 25 000 ₽ над задачей работает команда: копирайтер готовит 3 концепции сценария, режиссёр ведёт запись актёра кино или дубляжа, саунд-дизайнер создаёт фирменную атмосферу, а юрист проверяет формулировки и готовит паспорт ролика. Работа стартует после заключения договора и внесения 100% предоплаты.',
  },
  {
    id: 'radio-station-bonus',
    indexLabel: '02',
    iconKey: 'radio',
    question:
      'Радиостанция предлагает сделать ролик бонусом к эфиру. Зачем обращаться в отдельный продакшн?',
    answer:
      'Мы с большим уважением относимся к коллегам с радио: станция даёт вам главное — миллионный эфир и точный охват аудитории. Но штатный продакшн станции выпускает десятки роликов в день в едином потоковом ритме и с одними и теми же голосами. Бутиковая студия FMWorks приносит свежий взгляд со стороны, незамыленные актёрские тембры и точную драматургию — чтобы ваш бренд уверенно выделялся в рекламном блоке.',
  },
  {
    id: 'moderation-and-rights',
    indexLabel: '03',
    iconKey: 'shield',
    question: 'Примет ли радиостанция ваш ролик и что с авторскими правами?',
    answer:
      'Примет с первого раза — мы даём 100% гарантию прохождения эфирной и юридической модерации на радиостанциях и в федеральных сетях. Вместе с финальным мастером мы передаём исключительные права по договору, лицензионные паспорта на музыку (РАО/ВОИС) и выверенные по ФЗ «О рекламе» дисклеймеры.',
  },
  {
    id: 'timing-and-payment',
    indexLabel: '04',
    iconKey: 'clock',
    question:
      'Как проходит оплата, что со срочным заказом от 1 часа и от чего зависят сроки?',
    answer:
      'Мы работаем на условиях 100% предоплаты по договору или банковской картой (включая ЭДО Диадок / СБИС / Контур и оплату по СБП). Стандартные сроки отсчитываются с момента оплаты: 24–48 ч «Голос и стиль», 3–4 раб. дня «Под ключ», 4–5 дней «Игровой». Если ролик нужен экстренно — делаем срочный заказ от 1 часа (запись голоса и сведение без разработки сценария, по договорной цене).',
  },
];

export const HOME_PROCESS_FAQ_ITEMS: FaqItem[] = [
  {
    id: 'home-process-stages',
    indexLabel: '01',
    iconKey: 'waveform',
    question:
      'Как устроен реальный процесс работы: от заявки и проверки до старта сценария?',
    answer:
      'Вы оставляете короткую заявку, продюсер связывается с вами, уточняет задачу и согласует формат. Работа ведётся на условиях 100% предоплаты по договору или банковской картой. Если вы указали ИНН компании, счёт на оплату можно выгрузить сразу после отправки заявки или в Личном кабинете — не дожидаясь менеджера. После поступления предоплаты команда запускает сценарии, кастинг и запись. Без договора и предоплаты сценарии не пишутся.',
  },
  {
    id: 'home-contract-edo-fast',
    indexLabel: '02',
    iconKey: 'shield',
    question:
      'Какой договор вы заключаете и как быстро можно получить счёт для оплаты?',
    answer:
      'Для юридических лиц и ИП предусмотрен прямой договор и счёт на аудиопродакшн (100% предоплата по договору или банковской картой), закрывающий все вопросы по авторским правам и модерации. Если вы указали ИНН при заказе (или добавили его позже в Личном кабинете), сформированный счёт можно сразу скачать в PDF/A4 для бухгалтерии или отправить через Диадок, СБИС и Контур.',
  },
  {
    id: 'home-card-payment-legal',
    indexLabel: '03',
    iconKey: 'receipt',
    question:
      'Можно ли оплатить заказ без реквизитов юрлица — например, банковской картой или по СБП?',
    answer:
      'Да, у нас действует 100% предоплата по договору или банковской картой: вы можете оставить быструю заявку только по номеру телефона или @Telegram без ИНН, а оплатить банковской картой, по СБП с официальным чеком или по счёту. Работа начинается сразу после согласования задачи и поступления предоплаты.',
  },
  {
    id: 'home-timelines-breakdown',
    indexLabel: '04',
    iconKey: 'clock',
    question:
      'Сколько длится производство (24–48 ч и 3–5 дней) и с какого момента идёт отсчёт?',
    answer:
      'Отсчёт сроков начинается с момента согласования задачи и поступления 100% предоплаты по договору или банковской картой. По готовому тексту («Голос и стиль» или адаптация) сдаём ролик за 24–48 часов. Полноценный продакшн «Под ключ» с концепциями сценария занимает 3–4 рабочих дня, а многоголосый игровой спот — 4–5 дней.',
  },
  {
    id: 'home-custom-negotiable-tariff',
    indexLabel: '05',
    iconKey: 'sliders',
    question:
      'Что делать, если задача нестандартная или хочется сначала обсудить её с живым продюсером без фикс-цены?',
    answer:
      'Выберите тариф «Индивидуальный проект» с договорной ценой. Он создан специально для сложных или нестандартных случаев, серии роликов либо ситуаций, когда нужно просто поговорить с человеком, чтобы грамотно сформулировать задачу. Вы описываете запрос своими словами без фиксации сметы — продюсер связывается, помогает уточнить объём, согласует индивидуальную цену и только после этого готовит договор и счёт.',
  },
  {
    id: 'home-script-only-and-deliverables',
    indexLabel: '06',
    iconKey: 'mic',
    question:
      'Можно ли заказать только сценарий без записи ролика, и где забрать готовые файлы?',
    answer:
      'Базово мы делаем аудиоролики под ключ, чтобы идея, кастинг актёров кино и саунд-дизайн работали как единый инструмент. Но при необходимости мы можем выделить разработку сценария отдельно через тариф «Индивидуальный проект». Готовый ролик (WAV, MP3), паспорт прав РАО/ВОИС и закрывающие документы отправляем в мессенджер, на Яндекс Диск, Облако Mail.ru и сохраняем в вашем Личном кабинете на сайте.',
  },
  {
    id: 'home-urgent-order-1h',
    indexLabel: '07',
    iconKey: 'clock',
    question: 'Срочный заказ: делаете ли вы аудиоролики за 1 час?',
    answer:
      'Да, мы делаем ролики от 1 часа. Запись голоса и сведение. Без разработки сценария. Срочные заказы оплачиваются по договорной цене.',
  },
];

const FAQ_ID_TO_ICON: Record<string, FaqIconKey> = {
  'production-vs-voiceover': 'sliders',
  'radio-station-bonus': 'radio',
  'moderation-and-rights': 'shield',
  'timing-and-payment': 'clock',
  'home-process-stages': 'waveform',
  'home-contract-edo-fast': 'shield',
  'home-card-payment-legal': 'receipt',
  'home-timelines-breakdown': 'clock',
  'home-custom-negotiable-tariff': 'sliders',
  'home-script-only-and-deliverables': 'mic',
  'home-urgent-order-1h': 'clock',
};

/**
 * Подбирает контекстную иконку для любого вопроса FAQ —
 * сначала по явному `iconKey` / `id`, затем по ключевым словам вопроса.
 */
export function resolveFaqIconKey(
  item: Pick<FaqItem, 'id' | 'question' | 'iconKey'>
): FaqIconKey {
  if (item.iconKey) return item.iconKey;
  if (FAQ_ID_TO_ICON[item.id]) return FAQ_ID_TO_ICON[item.id];

  const q = item.question.toLowerCase();
  if (q.includes('срок') || q.includes('быстр') || q.includes('час') || q.includes('дн')) {
    return 'clock';
  }
  if (q.includes('прав') || q.includes('модерац') || q.includes('договор') || q.includes('рао')) {
    return 'shield';
  }
  if (
    q.includes('оплат') ||
    q.includes('эдо') ||
    q.includes('счёт') ||
    q.includes('стоим') ||
    q.includes('карт') ||
    q.includes('физлиц')
  ) {
    return 'receipt';
  }
  if (
    q.includes('диктор') ||
    q.includes('голос') ||
    q.includes('кастинг') ||
    q.includes('правк') ||
    q.includes('нестандарт') ||
    q.includes('договорн') ||
    q.includes('консультац')
  ) {
    return 'sliders';
  }
  if (q.includes('бриф') || q.includes('текст') || q.includes('задач') || q.includes('сценари')) {
    return 'mic';
  }
  if (q.includes('файл') || q.includes('wav') || q.includes('mp3') || q.includes('мастер')) {
    return 'file-audio';
  }
  if (q.includes('радио') || q.includes('эфир')) {
    return 'radio';
  }
  return 'waveform';
}

export function toggleFaqItem(
  currentOpenId: string | null,
  clickedId: string
): string | null {
  return currentOpenId === clickedId ? null : clickedId;
}

export interface FaqAnswerJsonLd {
  '@type': 'Answer';
  text: string;
}

export interface FaqQuestionJsonLd {
  '@type': 'Question';
  name: string;
  acceptedAnswer: FaqAnswerJsonLd;
}

export interface FaqPageJsonLdSchema {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  name: string;
  description: string;
  url: string;
  inLanguage: 'ru-RU';
  mainEntity: FaqQuestionJsonLd[];
}

export interface BuildFaqPageJsonLdOptions {
  pageUrl?: string;
  name?: string;
  description?: string;
}

const DEFAULT_FAQ_PAGE_URL = 'https://fmworks.ru/faq';
const DEFAULT_FAQ_PAGE_NAME =
  'Частые вопросы (FAQ) по договору, оплате и срокам — FMWorks';
const DEFAULT_FAQ_PAGE_DESCRIPTION =
  'Ответы на частые вопросы о договоре, моментальном счёте на оплату, сроках производства аудиороликов и выдаче готовых материалов.';

/**
 * Формирует валидную структуру Schema.org `FAQPage` (JSON-LD) для списка вопросов продакшна.
 */
export function buildFaqPageJsonLd(
  items: readonly FaqItem[],
  options: BuildFaqPageJsonLdOptions = {}
): FaqPageJsonLdSchema {
  const normalizedUrl = options.pageUrl?.trim() || DEFAULT_FAQ_PAGE_URL;
  const normalizedName = options.name?.trim() || DEFAULT_FAQ_PAGE_NAME;
  const normalizedDescription =
    options.description?.trim() || DEFAULT_FAQ_PAGE_DESCRIPTION;

  const mainEntity: FaqQuestionJsonLd[] = items
    .map((item) => ({
      question: item.question.trim(),
      answer: item.answer.trim(),
    }))
    .filter((item) => item.question.length > 0 && item.answer.length > 0)
    .map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    }));

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    name: normalizedName,
    description: normalizedDescription,
    url: normalizedUrl,
    inLanguage: 'ru-RU',
    mainEntity,
  };
}

/**
 * Безопасно сериализует объект в JSON-LD, экранируя символы HTML/XML тегов.
 */
export function serializeJsonLd(payload: unknown): string {
  return JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export const FAQ_URGENT_ORDER_SEARCH_TEXT =
  'Срочный заказ Готовность от 1 часа Без разработки сценария Договорная цена Да, мы делаем ролики от 1 часа. Запись голоса и сведение. Без разработки сценария. Срочные заказы оплачиваются по договорной цене. По вашему готовому тексту вне очереди записываем диктора и выпускаем чистовой эфирный мастер (-14 LUFS, WAV + MP3) на условиях 100% предоплаты по договору или банковской картой.';

export const FAQ_QUICK_SEARCH_TOPICS: readonly {
  label: string;
  query: string;
}[] = [
  { label: 'Срочный заказ', query: '1 час' },
  { label: 'ЭДО и счёт', query: 'счёт' },
  { label: 'Оплата картой / СБП', query: 'СБП' },
  { label: 'Права РАО / ВОИС', query: 'РАО' },
  { label: 'Сроки 24–48 ч', query: '24–48' },
  { label: 'Договорная цена', query: 'договорной' },
] as const;

/**
 * Нормализует текст для нечёткого регистронезависимого поиска (включая «ё» → «е»).
 */
export function normalizeFaqSearchText(raw: string): string {
  return (raw ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Разбивает поисковый запрос на уникальные непустые токены.
 */
export function tokenizeFaqSearchQuery(rawQuery: string): string[] {
  const normalized = normalizeFaqSearchText(rawQuery);
  if (!normalized) return [];
  const parts = normalized.split(' ').filter(Boolean);
  return Array.from(new Set(parts));
}

/**
 * Проверяет, содержит ли текстовый блок все ключевые слова запроса.
 */
export function doesFaqTextMatchQuery(text: string, rawQuery: string): boolean {
  const tokens = tokenizeFaqSearchQuery(rawQuery);
  if (tokens.length === 0) return true;
  const hay = normalizeFaqSearchText(text);
  return tokens.every((token) => hay.includes(token));
}

/**
 * Фильтрует и ранжирует вопросы/ответы FAQ по ключевым словам:
 * 1) точная фраза в заголовке вопроса,
 * 2) все токены в заголовке вопроса,
 * 3) точная фраза в ответе,
 * 4) совпадение токенов по вопросу и ответу.
 */
export function filterFaqItems(
  items: readonly FaqItem[],
  rawQuery: string
): FaqItem[] {
  const normalizedQuery = normalizeFaqSearchText(rawQuery);
  if (!normalizedQuery) return [...items];

  const tokens = tokenizeFaqSearchQuery(normalizedQuery);
  if (tokens.length === 0) return [...items];

  const scored: Array<{ item: FaqItem; score: number; originalIdx: number }> =
    [];

  items.forEach((item, originalIdx) => {
    const qNorm = normalizeFaqSearchText(item.question);
    const aNorm = normalizeFaqSearchText(item.answer);
    const combined = `${item.indexLabel} ${qNorm} ${aNorm}`;

    if (!tokens.every((token) => combined.includes(token))) {
      return;
    }

    let score = 1;
    if (qNorm.includes(normalizedQuery)) {
      score += 100;
    } else if (tokens.every((token) => qNorm.includes(token))) {
      score += 50;
    }
    if (aNorm.includes(normalizedQuery)) {
      score += 20;
    }
    for (const token of tokens) {
      if (qNorm.includes(token)) score += 5;
      if (aNorm.includes(token)) score += 2;
    }

    scored.push({ item, score, originalIdx });
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.originalIdx - b.originalIdx;
  });

  return scored.map((entry) => entry.item);
}

export interface FaqHighlightSegment {
  text: string;
  matched: boolean;
}

/**
 * Разбивает исходный текст на сегменты с пометкой совпадений для безопасной подсветки,
 * сохраняя исходный регистр и букву «ё».
 */
export function splitFaqHighlightSegments(
  text: string,
  rawQuery: string
): FaqHighlightSegment[] {
  if (!text) return [];
  const tokens = tokenizeFaqSearchQuery(rawQuery)
    .filter((t) => t.length >= 2)
    .sort((a, b) => b.length - a.length);

  if (tokens.length === 0) {
    return [{ text, matched: false }];
  }

  // Строим 1:1 посимвольно нормализованную строку (toLowerCase + ё -> е;
  // для редких символов, меняющих длину, откатываемся без сдвига индексов).
  const chars = Array.from(text);
  const normChars = chars.map((ch) => {
    const low = ch.toLowerCase().replace(/ё/g, 'е');
    return low.length === 1 ? low : ch.toLowerCase();
  });

  if (normChars.length !== chars.length) {
    return [{ text, matched: false }];
  }

  const hay = normChars.join('');
  const matchedMask = new Array<boolean>(chars.length).fill(false);

  for (const token of tokens) {
    let fromIdx = 0;
    while (fromIdx < hay.length) {
      const foundIdx = hay.indexOf(token, fromIdx);
      if (foundIdx === -1) break;
      for (let i = foundIdx; i < foundIdx + token.length; i += 1) {
        matchedMask[i] = true;
      }
      fromIdx = foundIdx + token.length;
    }
  }

  const segments: FaqHighlightSegment[] = [];
  let currentText = '';
  let currentMatched = matchedMask[0] ?? false;

  for (let i = 0; i < chars.length; i += 1) {
    const isMatched = matchedMask[i];
    if (i > 0 && isMatched !== currentMatched) {
      segments.push({ text: currentText, matched: currentMatched });
      currentText = chars[i];
      currentMatched = isMatched;
    } else {
      currentText += chars[i];
    }
  }

  if (currentText) {
    segments.push({ text: currentText, matched: currentMatched });
  }

  return segments;
}

