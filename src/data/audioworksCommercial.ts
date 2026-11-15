export const AUDIOWORKS_WAV_URL = '/assets/aistudio/Audioworks_75c6023f.mp3';
export const AUDIOWORKS_TOTAL_DURATION_SEC = 78.96;
export const AUDIOWORKS_FOCUS_ENTRY_SEC = 6.1;

export type CommercialStageMode = 'stream' | 'silence' | 'focus';
export type HeroSceneId = 'studio' | 'taste' | 'status';

export interface HeroCinemaScene {
  id: HeroSceneId;
  indexLabel: string;
  tabLabel: string;
  imageUrl: string;
  imageAlt: string;
  caption: string;
  subcaption: string;
  showOnAirBadge?: boolean;
  audioSeekSec: number;
}

export const HERO_STREAM_BG_IMAGE =
  '/src/assets/images/hero_grey_traffic_clutter_1794605229421.jpg';

export const HERO_CINEMA_SCENES: HeroCinemaScene[] = [
  {
    id: 'studio',
    indexLabel: '01',
    tabLabel: '01 Студия ON AIR',
    imageUrl: '/src/assets/images/hero_broadcast_booth_wide_1794605231279.jpg',
    imageAlt: 'Тёплый контровой свет звуковой студии FMWorks и студийного микрофона',
    caption: 'Сильная реклама не кричит в ухо — она включает кино в голове',
    subcaption: 'Режиссёрская запись редких актёров дубляжа и выверенная драматургия паузы',
    showOnAirBadge: true,
    audioSeekSec: 6.1,
  },
  {
    id: 'taste',
    indexLabel: '02',
    tabLabel: '02 Вкус бренда',
    imageUrl: '/src/assets/images/hero_artisan_bakery_taste_1794605229940.jpg',
    imageAlt: 'Тёплый утренний свет и хрустящий ремесленный хлеб',
    caption: 'Звук, у которого есть вкус',
    subcaption: 'Тактильный саунд-дизайн для FMCG и ритейла — когда продукт узнают с первых секунд',
    showOnAirBadge: false,
    audioSeekSec: 15.5,
  },
  {
    id: 'status',
    indexLabel: '03',
    tabLabel: '03 Тихий статус',
    imageUrl: '/src/assets/images/case_estate_cinema_1794399406227.jpg',
    imageAlt: 'Вечерний тёплый свет в панорамных окнах современной резиденции',
    caption: 'Тихий статус вместо кричащих скидок',
    subcaption: 'Камерная интонация и безупречный юридический дисклеймер для девелопмента',
    showOnAirBadge: false,
    audioSeekSec: 36.9,
  },
];

export function getCinemaSceneIdAtTime(timeSec: number): HeroSceneId {
  if (timeSec >= 15.4 && timeSec < 36.7) {
    return 'taste';
  }
  if (timeSec >= 36.7 && timeSec < 56.5) {
    return 'status';
  }
  return 'studio';
}

export type KotoFrameKind = 'photo' | 'kinetic_poster';

export interface KotoShowreelFrame {
  id: 'frame-studio' | 'frame-onair' | 'frame-product' | 'frame-architecture';
  indexLabel: string;
  kind: KotoFrameKind;
  kicker: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  imageAlt?: string;
  exposureClass?: string;
}

/**
 * 4 ритмичные полноэкранные арт-сцены шоурила HeroKoto (смена каждые 3.5 секунды)
 */
export const HERO_KOTO_FRAMES: KotoShowreelFrame[] = [
  {
    id: 'frame-studio',
    indexLabel: '01',
    kind: 'photo',
    kicker: '01 · Аудиопродакшн полного цикла для бизнеса',
    title: 'Режиссура редких голосов кино и дубляжа',
    subtitle: 'Тёплая акустика, живая подача без рекламного крика',
    imageUrl: '/src/assets/images/hero_broadcast_booth_wide_1794605231279.jpg',
    imageAlt: 'Тёплая атмосфера звуковой студии FMWorks в контровом свете',
    exposureClass: 'brightness-[1.04] contrast-[1.05] saturate-[1.06]',
  },
  {
    id: 'frame-onair',
    indexLabel: '02',
    kind: 'kinetic_poster',
    kicker: '02 · Фирменный эфирный почерк',
    title: 'ON AIR',
    subtitle: 'Секунды, которые выделяют бренд в любом рекламном блоке',
  },
  {
    id: 'frame-product',
    indexLabel: '03',
    kind: 'photo',
    kicker: '03 · FMCG и федеральный ритейл',
    title: 'Звук, у которого есть фактура и вкус',
    subtitle: 'Тактильный саунд-дизайн, пробуждающий картинку в голове',
    imageUrl: '/src/assets/images/hero_artisan_bakery_taste_1794605229940.jpg',
    imageAlt: 'Фактурный макро-кадр утреннего ремесленного продукта в солнечном луче',
    exposureClass: 'brightness-[0.98] contrast-[1.04]',
  },
  {
    id: 'frame-architecture',
    indexLabel: '04',
    kind: 'photo',
    kicker: '04 · Девелопмент и частные сервисы',
    title: 'Тихий статус вместо кричащих скидок',
    subtitle: 'Камерная интонация и ювелирно выверенный дисклеймер',
    imageUrl: '/src/assets/images/case_estate_cinema_1794399406227.jpg',
    imageAlt: 'Вечерняя современная архитектура и тёплый панорамный свет',
    exposureClass: 'brightness-[0.97] contrast-[1.05]',
  },
];

export const KOTO_MIC_WIDGET_IMAGE =
  '/src/assets/images/approach_condenser_mic_portrait_1794605230714.jpg';

export type CrashTestPhase = 'idle' | 'clutter' | 'stop_pause' | 'audioworks';

export const CRASH_TEST_CLUTTER_DURATION_SEC = 4.0;
export const CRASH_TEST_STOP_DURATION_SEC = 0.5;
export const CRASH_TEST_TOTAL_INTRO_SEC =
  CRASH_TEST_CLUTTER_DURATION_SEC + CRASH_TEST_STOP_DURATION_SEC;

/**
 * Вычисляет текущую фазу эфирного краш-теста по прошедшему времени с момента клика:
 * - 0.0–4.0 сек: `clutter` (обычный рекламный блок — шум дороги и радийные штампы, линза сужена)
 * - 4.0–4.5 сек: `stop_pause` (вспышка «СТОП. ПАУЗА 0.5 СЕК» — линза упруго раскрывается на 150%)
 * - с 4.5 сек: `audioworks` (полноцветные сцены AudioWorks, эквалайзер и чистый шоурил)
 */
export function getCrashTestPhaseAtElapsed(elapsedSec: number): CrashTestPhase {
  if (!Number.isFinite(elapsedSec) || elapsedSec < 0) {
    return 'idle';
  }
  if (elapsedSec < CRASH_TEST_CLUTTER_DURATION_SEC) {
    return 'clutter';
  }
  if (elapsedSec < CRASH_TEST_TOTAL_INTRO_SEC) {
    return 'stop_pause';
  }
  return 'audioworks';
}

export const HERO_GREY_TRAFFIC_IMAGE =
  '/src/assets/images/hero_grey_traffic_clutter_1794605229421.jpg';

export const GREY_RADIO_MARQUEE_BASE = [
  'выгодные условия...',
  'скидки до конца месяца...',
  'индивидуальный подход...',
  'звоните прямо сейчас...',
  'дом 42 корпус 1 скидка 20% по промокоду...',
  'подробности об акции на сайте...',
] as const;

export interface LensShowreelFrame {
  id: 'taste' | 'status' | 'studio';
  indexLabel: string;
  shortLabel: string;
  kicker: string;
  title: string;
  imageUrl: string;
  imageAlt: string;
  fallbackGradient: string;
  exposureClass: string;
}

/**
 * 3 сочных полноцветных кадра мира AudioWorks внутри «Интерактивной линзы внимания»
 */
export const HERO_LENS_FRAMES: LensShowreelFrame[] = [
  {
    id: 'taste',
    indexLabel: '01',
    shortLabel: 'Вкус',
    kicker: '01 · Вкус продукта',
    title: 'Звук, который вызывает аппетит',
    imageUrl: '/src/assets/images/hero_artisan_bakery_taste_1794605229940.jpg',
    imageAlt: 'Тёплый утренний свет и ремесленный хлеб — кадр «Вкус продукта»',
    fallbackGradient: 'bg-gradient-to-br from-[#3D1D14] via-[#26120C] to-[#120A08]',
    exposureClass: 'brightness-[0.98] contrast-[1.05] saturate-[1.08]',
  },
  {
    id: 'status',
    indexLabel: '02',
    shortLabel: 'Квартал',
    kicker: '02 · Тихий статус',
    title: 'Пауза и достоинство вместо кричащих скидок',
    imageUrl: '/src/assets/images/case_estate_cinema_1794399406227.jpg',
    imageAlt: 'Вечерняя современная архитектура с панорамным светом — кадр «Тихий статус»',
    fallbackGradient: 'bg-gradient-to-br from-[#132922] via-[#0D1D18] to-[#08110E]',
    exposureClass: 'brightness-[0.97] contrast-[1.06] saturate-[1.08]',
  },
  {
    id: 'studio',
    indexLabel: '03',
    shortLabel: 'Студия',
    kicker: '03 · Студия FMWorks',
    title: 'Режиссура каждой секунды',
    imageUrl: '/src/assets/images/hero_broadcast_booth_wide_1794605231279.jpg',
    imageAlt: 'Звуковая студия FMWorks в тёплом контровом свете — кадр «Студия FMWorks»',
    fallbackGradient: 'bg-gradient-to-br from-[#2B1812] via-[#1B1210] to-[#0E0D10]',
    exposureClass: 'brightness-[1.05] contrast-[1.05] saturate-[1.08]',
  },
];

export const KOTO_LENS_MANIFESTO_PARAGRAPH =
  'В тишине кабинета любой ролик за 3 000 ₽ кажется нормальным. Но в реальном эфире он стоит между четырьмя чужими объявлениями и тонет в шуме дороги. Мы создаём ролики со сценарием, редкими голосами и чистыми правами — чтобы запомнили именно вас.';

export interface DuelTranscriptPhrase {
  startSec: number;
  endSec: number;
  text: string;
  isAccent?: boolean;
}

export interface DuelSpotSpec {
  id: 'radio_cliche' | 'audioworks_craft';
  badge: string;
  title: string;
  durationSec: number;
  durationLabel: string;
  metricsLine: string;
  verdict: string;
  phrases: DuelTranscriptPhrase[];
}

/**
 * Реальная пара 15-секундных роликов по одному брифу (кофейня «Зерно и Свет»):
 * 1) Потоковый ролик «под радио» (0:14)
 * 2) Режиссёрское исполнение AudioWorks (0:15)
 */
export const ZERNO_DUEL_DATA: {
  clientName: string;
  briefSummary: string;
  radioSpot: DuelSpotSpec;
  audioworksSpot: DuelSpotSpec;
} = {
  clientName: 'Кофейня «Зерно и Свет»',
  briefSummary: 'Один и тот же бриф на 15 секунд: открытие новой точки на Ленинском и горячие завтраки весь день.',
  radioSpot: {
    id: 'radio_cliche',
    badge: 'Обычный ролик «под радио»',
    title: 'Попытка зачитать весь буклет за 14 секунд',
    durationSec: 14,
    durationLabel: '0:14',
    metricsLine: '37 слов без пауз · адрес с корпусом · телефон и сайт с дефисом на слух',
    verdict:
      'Водитель в потоке машин не успевает записать ни корпус дома, ни промокод, ни телефон — объявление пролетает мимо ушей.',
    phrases: [
      { startSec: 0.0, endSec: 2.2, text: 'Внимание! Только в ноябре' },
      {
        startSec: 2.2,
        endSec: 5.5,
        text: 'сеть кофеен «Зерно и Свет» открыла пятую точку на Ленинском проспекте, дом 42, корпус 1.',
      },
      {
        startSec: 5.5,
        endSec: 8.8,
        text: 'Авторский раф, свежая выпечка, завтраки весь день, скидка 20% по промокоду ОСЕНЬ,',
      },
      {
        startSec: 8.8,
        endSec: 11.4,
        text: 'звоните 495-700-ровно-21.',
      },
      {
        startSec: 11.4,
        endSec: 14.2,
        text: 'Подробности об акции на сайте зерно-дефис-свет.ру.',
      },
    ],
  },
  audioworksSpot: {
    id: 'audioworks_craft',
    badge: '15 секунд в FMWorks: Выстрел в память',
    title: 'Одна точная сцена и одно действие голосом',
    durationSec: 15,
    durationLabel: '0:15',
    metricsLine: '24 слова · подсечка из ситуации водителя · команда в навигатор вместо диктовки цифр',
    verdict:
      'Тёплое электропиано и живая пауза после первых двух слов выхватывают внимание из пробки, а имя бренда повторяется дважды в самом выгодном контексте.',
    phrases: [
      {
        startSec: 0.0,
        endSec: 3.1,
        text: 'Пробка на Ленинском… подождёт.',
        isAccent: true,
      },
      {
        startSec: 3.1,
        endSec: 7.5,
        text: 'Горячие завтраки весь день — в новой кофейне «Зерно и Свет».',
      },
      {
        startSec: 7.5,
        endSec: 11.0,
        text: 'Просто скажите навигатору: «Зерно и Свет».',
        isAccent: true,
      },
      {
        startSec: 11.0,
        endSec: 15.0,
        text: 'Акция действует в ноябре. Подробности в кофейне.',
      },
    ],
  },
};

export interface CommercialChapter {
  id:
    | 'cliche_stream'
    | 'tape_stop'
    | 'manifesto_intro'
    | 'scene_fmcg'
    | 'scene_estate'
    | 'manifesto_finale';
  startSec: number;
  endSec: number;
  mode: CommercialStageMode;
  eyebrow: string;
  words: string[];
}

export const AUDIOWORKS_REEL_CHAPTERS: CommercialChapter[] = [
  {
    id: 'cliche_stream',
    startSec: 0,
    endSec: 5.9,
    mode: 'stream',
    eyebrow: 'Обычный эфир · 0:00–0:06',
    words: [
      'Динамично',
      'развивающаяся',
      'компания',
      'предлагает',
      'уникальные',
      'условия',
      'и',
      'гибкие',
      'скидки...',
    ],
  },
  {
    id: 'tape_stop',
    startSec: 5.9,
    endSec: 6.85,
    mode: 'silence',
    eyebrow: 'Стоп. Выдохните.',
    words: ['Стоп.', 'Выдохните.'],
  },
  {
    id: 'manifesto_intro',
    startSec: 6.85,
    endSec: 15.4,
    mode: 'focus',
    eyebrow: '01 · Студия ON AIR',
    words: [
      'Сильная',
      'реклама',
      'не',
      'кричит',
      'в',
      'ухо',
      '—',
      'она',
      'включает',
      'кино',
      'в',
      'голове.',
    ],
  },
  {
    id: 'scene_fmcg',
    startSec: 15.4,
    endSec: 36.7,
    mode: 'focus',
    eyebrow: '02 · Вкус бренда',
    words: [
      'Горячая',
      'корочка',
      'ломается',
      'под',
      'пальцами.',
      'Глоток',
      'густого',
      'кофе',
      '—',
      'и',
      'день',
      'на',
      'паузе.',
    ],
  },
  {
    id: 'scene_estate',
    startSec: 36.7,
    endSec: 56.5,
    mode: 'focus',
    eyebrow: '03 · Тихий статус',
    words: [
      'Шум',
      'проспекта',
      'остаётся',
      'за',
      'тяжёлой',
      'дверью.',
      'Глубокая',
      'тишина',
      'двора',
      'и',
      'ветер',
      'в',
      'соснах.',
    ],
  },
  {
    id: 'manifesto_finale',
    startSec: 56.5,
    endSec: 80.0,
    mode: 'focus',
    eyebrow: 'Финал · Почерк FMWorks',
    words: [
      'Пока',
      'обычные',
      'объявления',
      'спорят,',
      'кто',
      'прокричит',
      'быстрее,',
      'ваша',
      'история',
      'уже',
      'внутри.',
    ],
  },
];

export function getCommercialStateAtTime(timeSec: number): {
  mode: CommercialStageMode;
  chapter: CommercialChapter;
  revealedWordsCount: number;
} {
  const clamped = Math.max(0, timeSec);
  const chapter =
    AUDIOWORKS_REEL_CHAPTERS.find((ch) => clamped >= ch.startSec && clamped < ch.endSec) ??
    AUDIOWORKS_REEL_CHAPTERS[AUDIOWORKS_REEL_CHAPTERS.length - 1];

  const span = Math.max(0.5, chapter.endSec - chapter.startSec);
  const revealWindow = Math.min(span * 0.68, 5.2);
  const localElapsed = Math.max(0, clamped - chapter.startSec);
  const ratio = Math.min(1, localElapsed / Math.max(0.3, revealWindow));
  const revealedWordsCount = Math.max(
    1,
    Math.min(chapter.words.length, Math.ceil(ratio * chapter.words.length))
  );

  return {
    mode: chapter.mode,
    chapter,
    revealedWordsCount,
  };
}

export function formatAudioTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
