import {
  DeviceKind,
  LayaDecision,
  LayaMediaNicheHint,
  LayaPersona,
  LayaPersonaSlot,
  LayaSimulationTrace,
  LayaVisitorState,
  RecommendedTier,
} from './layaTypes';

export const LAYA_CONFIDENCE_THRESHOLD = 0.75;
export const LAYA_SYSTEM1_LATENCY_MS = 28;

export const VALID_PERSONAS: readonly LayaPersona[] = [
  'default',
  'price_searcher',
  'real_estate',
  'fmcg',
  'returning_vip',
] as const;

/**
 * 5 эталонных цифровых следов для плавающего демо-пульта владельца «🧠 Laya AI Engine»
 */
export const LAYA_SIMULATION_TRACES: LayaSimulationTrace[] = [
  {
    id: 'guest_low_conf',
    buttonLabel: 'Универсальный гость (Confidence 0.52 -> Default)',
    traceSummary: 'Прямой заход · нет UTM · десктоп',
    expectedConfidence: 0.52,
    state: {
      utmTerm: '',
      personaParam: '',
      utmSource: 'direct',
      device: 'desktop',
      visitCount: 1,
      referrer: '',
      simulationTraceId: 'guest_low_conf',
    },
  },
  {
    id: 'yandex_price',
    buttonLabel: 'Яндекс: "озвучка радио цена" (Confidence 0.91)',
    traceSummary: 'Поиск Яндекса · коммерческий запрос цены',
    expectedConfidence: 0.91,
    state: {
      utmTerm: 'озвучка радио цена',
      personaParam: '',
      utmSource: 'yandex_cpc',
      device: 'desktop',
      visitCount: 1,
      referrer: 'https://ya.ru',
      simulationTraceId: 'yandex_price',
    },
  },
  {
    id: 'ad_real_estate',
    buttonLabel: 'Реклама: Девелопмент и ЖК (Confidence 0.94)',
    traceSummary: 'Кампания Девелопмент и ЖК · квартал бизнес-класса',
    expectedConfidence: 0.94,
    state: {
      utmTerm: 'радиоролик жк бизнес класса девелопмент',
      personaParam: 'real_estate',
      utmSource: 'tg_ads_dev',
      device: 'desktop',
      visitCount: 2,
      referrer: '',
      simulationTraceId: 'ad_real_estate',
    },
  },
  {
    id: 'abm_fmcg',
    buttonLabel: 'ABM-ссылка: Ритейл и FMCG (Confidence 0.89)',
    traceSummary: 'Персональная ссылка для директора по маркетингу FMCG',
    expectedConfidence: 0.89,
    state: {
      utmTerm: 'бренд ролик продукты питания федеральный эфир',
      personaParam: 'fmcg',
      utmSource: 'abm_outreach',
      device: 'desktop',
      visitCount: 1,
      referrer: '',
      simulationTraceId: 'abm_fmcg',
    },
  },
  {
    id: 'ad_medicine',
    buttonLabel: 'Реклама: Медицина и клиники (Confidence 0.92)',
    traceSummary: 'Кампания Медицина · клиники, диагностика и чекапы',
    expectedConfidence: 0.92,
    state: {
      utmTerm: 'радиоролик клиника медицина чекап диагностика',
      personaParam: 'medicine',
      utmSource: 'yandex_med',
      device: 'desktop',
      visitCount: 1,
      referrer: '',
      simulationTraceId: 'ad_medicine',
    },
  },
  {
    id: 'vip_mobile',
    buttonLabel: 'Постоянный клиент со смартфона (Confidence 0.98)',
    traceSummary: '5-й визит · мобильное устройство · знакомый клиент',
    expectedConfidence: 0.98,
    state: {
      utmTerm: '',
      personaParam: 'returning_vip',
      utmSource: 'crm_vip',
      device: 'mobile',
      visitCount: 5,
      referrer: '',
      simulationTraceId: 'vip_mobile',
    },
  },
];

export const LAYA_CONTENT_DICTIONARY: Record<LayaPersona, LayaPersonaSlot> = {
  default: {
    id: 'default',
    profileLabel: 'Эталонная версия',
    shortTriggerHint: 'Базовый профиль (confidence < 0.75)',
    kotoManifestoTagline: 'Аудиореклама, которая работает.',
    heroHeading: 'Эфир продаёт минуты. Мы создаём секунды, которые помнят.',
    heroSubheading:
      'Аудиопродакшн полного цикла для бизнеса и амбициозных брендов: сценарий, актёрская режиссура, саунд-дизайн и чистые права для эфира. Фиксированная смета от 15 000 ₽.',
    streamCliches: [
      'выгодные условия только в этом месяце...',
      'гибкая система скидок для каждого клиента...',
      'звоните прямо сейчас по телефону...',
      'индивидуальный подход и высокое качество...',
      'успейте воспользоваться уникальным предложением...',
      'подробности уточняйте у менеджеров отдела продаж...',
    ],
    focusEyebrow: 'Почерк FMWorks · Кино в голове',
    focusWords: ['Тишина.', 'Вдох.', 'И', 'ваш', 'бренд', 'слышат', 'с', 'первой', 'секунды.'],
    focusSurfaceClass: 'bg-gradient-to-br from-[#1C1614] via-[#261915] to-[#121215]',
    focusChordPreset: 'editorial',
  },

  price_searcher: {
    id: 'price_searcher',
    profileLabel: 'Запрос сметы («озвучка цена»)',
    shortTriggerHint: '?utm_term=озвучка+радио+цена',
    kotoManifestoTagline: 'Звук, который окупает эфир от 15 000 ₽.',
    heroHeading: 'Точная режиссура окупает эфирный бюджет с первой недели.',
    heroSubheading:
      'Запускаем лаконичный формат по вашему тексту за 15 000 ₽ или берём на себя идею, кастинг редких голосов и юридическую очистку под ключ.',
    streamCliches: [
      'выгодные условия только в этом месяце...',
      'гибкая система скидок и спецпредложений...',
      'спешите заказать по старым условиям...',
      'индивидуальный подход к каждому клиенту...',
      'только три дня уникальные условия...',
      'подробности уточняйте по телефону...',
    ],
    focusEyebrow: 'Прозрачная смета · Форматы от 15 000 ₽',
    focusWords: ['Точный', 'голос', 'окупает', 'весь', 'рекламный', 'эфир.'],
    focusSurfaceClass: 'bg-gradient-to-br from-[#1E1815] via-[#2D1C14] to-[#141316]',
    focusChordPreset: 'crisp_value',
  },

  real_estate: {
    id: 'real_estate',
    profileLabel: 'Девелопмент и ЖК',
    shortTriggerHint: '?persona=real_estate',
    kotoManifestoTagline: 'Тихий статус для девелопмента и ЖК.',
    heroHeading: 'Статус проекта считывается с первой паузы.',
    heroSubheading:
      'Камерные аудиоролики для девелопмента и ЖК: сдержанная актёрская интонация, атмосферный звук и выверенный дисклеймер. Смета от 15 000 ₽.',
    streamCliches: [
      'выгодные условия покупки только в этом месяце...',
      'рассрочка ноль процентов звоните прямо сейчас...',
      'гибкие скидки на пул квартир от застройщика...',
      'ключи уже в этом квартале спешите...',
      'индивидуальные условия в офисе продаж...',
      'подробности уточняйте у менеджеров...',
    ],
    focusEyebrow: 'Девелопмент бизнес-класса · Чистый дисклеймер',
    focusWords: ['Тихий', 'статус', 'вместо', 'кричащих', 'скидок.'],
    focusSurfaceClass: 'bg-gradient-to-br from-[#10231D] via-[#163028] to-[#0D1513]',
    focusChordPreset: 'architectural',
  },

  fmcg: {
    id: 'fmcg',
    profileLabel: 'Ритейл и FMCG',
    shortTriggerHint: '?persona=fmcg',
    kotoManifestoTagline: 'Звук бренда, у которого есть вкус.',
    heroHeading: 'Звук бренда, у которого есть характер и вкус.',
    heroSubheading:
      'Вместо дикторских штампов — живая актёрская драматургия, тактильный саунд-дизайн и полная очистка прав для эфира. Смета от 15 000 ₽.',
    streamCliches: [
      'выгодные условия и гибкие скидки во всех сетях...',
      'традиции качества проверенные временем...',
      'спрашивайте во всех магазинах сети...',
      'только в этом месяце специальное предложение...',
      'индивидуальный подход и широкий ассортимент...',
      'попробуйте новинку уже сегодня...',
    ],
    focusEyebrow: 'Ориентир: «Дмитрогорский продукт» · Федеральный эфир',
    focusWords: ['Звук,', 'у', 'которого', 'есть', 'вкус.'],
    focusSurfaceClass: 'bg-gradient-to-br from-[#3B1B14] via-[#4D2218] to-[#1A110F]',
    focusChordPreset: 'warm_appetizing',
  },

  returning_vip: {
    id: 'returning_vip',
    profileLabel: 'Постоянный клиент',
    shortTriggerHint: '?persona=returning_vip',
    kotoManifestoTagline: 'Ваш продакшн без долгих брифов.',
    heroHeading: 'Рады новой задаче. Запустим ролик в работу без долгих брифов.',
    heroSubheading:
      'Помним тональность вашего бренда и требования юристов — надиктуйте задачу голосом за 30 секунд, остальное соберёт продюсер. Смета от 15 000 ₽.',
    streamCliches: [
      'выгодные условия только в этом месяце...',
      'гибкая система скидок и бонусов...',
      'звоните прямо сейчас номер в эфире...',
      'индивидуальный подход к каждому клиенту...',
      'только до конца текущей недели...',
      'все подробности уточняйте на сайте...',
    ],
    focusEyebrow: 'Приоритетный запуск · Студия в работе',
    focusWords: ['Знакомый', 'почерк.', 'Новый', 'флайт', 'готов', 'точно', 'в', 'срок.'],
    focusSurfaceClass: 'bg-gradient-to-br from-[#141A2B] via-[#1B243B] to-[#0E111A]',
    focusChordPreset: 'vip_velvet',
  },
};

const PRICE_TERMS = [
  'озвучка радио цена',
  'цена',
  'стоимость',
  'прайс',
  'недорого',
  'тариф',
  'сколько стоит',
  '15000',
  '15 000',
  'озвучка',
];

const REAL_ESTATE_TERMS = [
  'жк',
  'застройщик',
  'девелоп',
  'недвижимост',
  'квартал',
  'бизнес-класс',
  'апартамент',
  'коттедж',
];

const FMCG_TERMS = [
  'fmcg',
  'продукт',
  'пищев',
  'дмитрогорск',
  'колбас',
  'молок',
  'ритейл',
  'сеть магазин',
  'еда',
  'напитк',
  'кофе',
];

const VIP_TERMS = ['vip', 'повторн', 'снова', 'новый флайт', 'постоянн'];

const MEDICINE_TERMS = [
  'медицин',
  'клиник',
  'стомат',
  'чекап',
  'врач',
  'диагност',
  'медцентр',
  'здоровь',
];

const B2B_TERMS = ['b2b', 'банк', 'финанс', 'лизинг', 'логист', 'корпоратив'];

const AUTO_TERMS = ['автосалон', 'автодилер', 'трейд-ин', 'детейлинг', 'шиномонтаж'];

function includesKeyword(source: string, keywords: string[]): boolean {
  return keywords.some((kw) => source.includes(kw));
}

function isValidPersona(val: string): val is LayaPersona {
  return (VALID_PERSONAS as readonly string[]).includes(val);
}

function defaultNicheForPersona(persona: LayaPersona): LayaMediaNicheHint {
  if (persona === 'real_estate') return 'real_estate';
  if (persona === 'fmcg') return 'fmcg_retail';
  if (persona === 'returning_vip') return 'b2b_finance';
  if (persona === 'price_searcher') return 'fmcg_retail';
  return 'real_estate';
}

/**
 * Чистая функция принятия решения Laya AI (System 1).
 * За ~28 мс вычисляет `choice`, `mediaNiche`, `intentScore`, `recommendedTier` и `confidence`.
 * При `confidence < 0.75` строго возвращает эталонный профиль `default`.
 */
export function evaluateLayaDecision(state: LayaVisitorState): LayaDecision {
  // Точные профили симулятора цифрового следа
  if (state.simulationTraceId === 'guest_low_conf') {
    return {
      choice: 'default',
      rawChoice: 'default',
      mediaNiche: 'real_estate',
      profileBadgeLabel: 'default',
      intentScore: 2,
      recommendedTier: 'turnkey',
      confidence: 0.52,
      latencyMs: LAYA_SYSTEM1_LATENCY_MS,
      isFallback: true,
    };
  }
  if (state.simulationTraceId === 'yandex_price') {
    return {
      choice: 'price_searcher',
      rawChoice: 'price_searcher',
      mediaNiche: 'fmcg_retail',
      profileBadgeLabel: 'price_searcher',
      intentScore: 4,
      recommendedTier: 'voice_style',
      confidence: 0.91,
      latencyMs: LAYA_SYSTEM1_LATENCY_MS,
      isFallback: false,
    };
  }
  if (state.simulationTraceId === 'ad_real_estate') {
    return {
      choice: 'real_estate',
      rawChoice: 'real_estate',
      mediaNiche: 'real_estate',
      profileBadgeLabel: 'real_estate',
      intentScore: 5,
      recommendedTier: 'cinema',
      confidence: 0.94,
      latencyMs: LAYA_SYSTEM1_LATENCY_MS,
      isFallback: false,
    };
  }
  if (state.simulationTraceId === 'abm_fmcg') {
    return {
      choice: 'fmcg',
      rawChoice: 'fmcg',
      mediaNiche: 'fmcg_retail',
      profileBadgeLabel: 'fmcg',
      intentScore: 4,
      recommendedTier: 'turnkey',
      confidence: 0.89,
      latencyMs: LAYA_SYSTEM1_LATENCY_MS,
      isFallback: false,
    };
  }
  if (state.simulationTraceId === 'ad_medicine') {
    return {
      choice: 'default',
      rawChoice: 'default',
      mediaNiche: 'medicine',
      profileBadgeLabel: 'medicine',
      intentScore: 5,
      recommendedTier: 'turnkey',
      confidence: 0.92,
      latencyMs: LAYA_SYSTEM1_LATENCY_MS,
      isFallback: false,
    };
  }
  if (state.simulationTraceId === 'vip_mobile') {
    return {
      choice: 'returning_vip',
      rawChoice: 'returning_vip',
      mediaNiche: 'b2b_finance',
      profileBadgeLabel: 'returning_vip',
      intentScore: 5,
      recommendedTier: 'turnkey',
      confidence: 0.98,
      latencyMs: LAYA_SYSTEM1_LATENCY_MS,
      isFallback: false,
    };
  }

  const personaQuery = state.personaParam.trim().toLowerCase();
  const utmTerm = state.utmTerm.trim().toLowerCase();
  const utmSource = state.utmSource.trim().toLowerCase();

  let rawChoice: LayaPersona = 'default';
  let explicitMediaNiche: LayaMediaNicheHint | undefined;
  let explicitBadgeLabel: string | undefined;
  let recommendedTier: RecommendedTier = 'turnkey';
  let intentScore: 1 | 2 | 3 | 4 | 5 = 2;
  let confidence = 0.52; // Универсальный гость без сигналов < 0.75 -> Default

  if (personaQuery && isValidPersona(personaQuery)) {
    if (personaQuery === 'default') {
      rawChoice = 'default';
      recommendedTier = 'turnkey';
      intentScore = 2;
      confidence = 0.52;
    } else {
      rawChoice = personaQuery;
      confidence =
        personaQuery === 'returning_vip'
          ? 0.98
          : personaQuery === 'real_estate'
            ? 0.94
            : personaQuery === 'price_searcher'
              ? 0.91
              : 0.89;
      intentScore = personaQuery === 'returning_vip' || personaQuery === 'real_estate' ? 5 : 4;
      recommendedTier =
        personaQuery === 'price_searcher'
          ? 'voice_style'
          : personaQuery === 'real_estate'
            ? 'cinema'
            : 'turnkey';
    }
  } else if (
    personaQuery === 'medicine' ||
    personaQuery === 'med' ||
    personaQuery === 'medical'
  ) {
    rawChoice = 'default';
    explicitMediaNiche = 'medicine';
    explicitBadgeLabel = 'medicine';
    recommendedTier = 'turnkey';
    intentScore = 5;
    confidence = 0.92;
  } else if (
    personaQuery === 'b2b' ||
    personaQuery === 'b2b_finance' ||
    personaQuery === 'finance'
  ) {
    rawChoice = 'returning_vip';
    explicitMediaNiche = 'b2b_finance';
    explicitBadgeLabel = 'b2b_finance';
    recommendedTier = 'turnkey';
    intentScore = 4;
    confidence = 0.9;
  } else if (
    personaQuery === 'auto' ||
    personaQuery === 'auto_services'
  ) {
    rawChoice = 'default';
    explicitMediaNiche = 'auto_services';
    explicitBadgeLabel = 'auto_services';
    recommendedTier = 'turnkey';
    intentScore = 4;
    confidence = 0.9;
  } else if (utmTerm) {
    if (includesKeyword(utmTerm, REAL_ESTATE_TERMS)) {
      rawChoice = 'real_estate';
      explicitMediaNiche = 'real_estate';
      recommendedTier = 'cinema';
      intentScore = 5;
      confidence = 0.94;
    } else if (includesKeyword(utmTerm, FMCG_TERMS)) {
      rawChoice = 'fmcg';
      explicitMediaNiche = 'fmcg_retail';
      recommendedTier = 'turnkey';
      intentScore = 4;
      confidence = 0.89;
    } else if (includesKeyword(utmTerm, MEDICINE_TERMS)) {
      rawChoice = 'default';
      explicitMediaNiche = 'medicine';
      explicitBadgeLabel = 'medicine';
      recommendedTier = 'turnkey';
      intentScore = 5;
      confidence = 0.92;
    } else if (includesKeyword(utmTerm, B2B_TERMS)) {
      rawChoice = 'default';
      explicitMediaNiche = 'b2b_finance';
      explicitBadgeLabel = 'b2b_finance';
      recommendedTier = 'turnkey';
      intentScore = 4;
      confidence = 0.9;
    } else if (includesKeyword(utmTerm, AUTO_TERMS)) {
      rawChoice = 'default';
      explicitMediaNiche = 'auto_services';
      explicitBadgeLabel = 'auto_services';
      recommendedTier = 'turnkey';
      intentScore = 4;
      confidence = 0.9;
    } else if (includesKeyword(utmTerm, PRICE_TERMS)) {
      rawChoice = 'price_searcher';
      explicitMediaNiche = 'fmcg_retail';
      recommendedTier = 'voice_style';
      intentScore = 4;
      confidence = 0.91;
    } else if (includesKeyword(utmTerm, VIP_TERMS)) {
      rawChoice = 'returning_vip';
      explicitMediaNiche = 'b2b_finance';
      recommendedTier = 'turnkey';
      intentScore = 5;
      confidence = 0.98;
    } else {
      rawChoice = 'default';
      recommendedTier = 'turnkey';
      intentScore = 3;
      confidence = 0.64;
    }
  } else if (state.visitCount >= 4 || utmSource === 'crm_vip') {
    rawChoice = 'returning_vip';
    explicitMediaNiche = 'b2b_finance';
    recommendedTier = 'turnkey';
    intentScore = 5;
    confidence = state.device === 'mobile' ? 0.98 : 0.88;
  }

  const normalizedConfidence = Math.round(confidence * 100) / 100;
  const isFallback = normalizedConfidence < LAYA_CONFIDENCE_THRESHOLD;
  const choice: LayaPersona = isFallback ? 'default' : rawChoice;
  const effectiveTier: RecommendedTier = isFallback ? 'turnkey' : recommendedTier;
  const mediaNiche: LayaMediaNicheHint = isFallback
    ? 'real_estate'
    : explicitMediaNiche ?? defaultNicheForPersona(choice);
  const profileBadgeLabel = isFallback ? 'default' : explicitBadgeLabel ?? choice;

  return {
    choice,
    rawChoice,
    mediaNiche,
    profileBadgeLabel,
    intentScore,
    recommendedTier: effectiveTier,
    confidence: normalizedConfidence,
    latencyMs: LAYA_SYSTEM1_LATENCY_MS,
    isFallback,
  };
}

export function readVisitorStateFromLocation(
  search: string,
  viewportWidth: number,
  referrer: string,
  visitCount: number
): LayaVisitorState {
  const params = new URLSearchParams(search);
  const device: DeviceKind = viewportWidth < 768 ? 'mobile' : 'desktop';

  return {
    utmTerm: params.get('utm_term') ?? '',
    personaParam: params.get('persona') ?? params.get('niche') ?? '',
    utmSource: params.get('utm_source') ?? '',
    device,
    visitCount: Math.max(1, visitCount),
    referrer,
  };
}
