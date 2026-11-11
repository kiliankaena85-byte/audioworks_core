export const AUDIOWORKS_WAV_URL = '/assets/aistudio/Audioworks_75c6023f.wav';
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
  'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1800&q=85';

export const HERO_CINEMA_SCENES: HeroCinemaScene[] = [
  {
    id: 'studio',
    indexLabel: '01',
    tabLabel: '01 Студия ON AIR',
    imageUrl:
      'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1800&q=85',
    imageAlt: 'Тёплый контровой свет звуковой студии AudioWorks и студийного микрофона',
    caption: 'Сильная реклама не кричит в ухо — она включает кино в голове',
    subcaption: 'Режиссёрская запись редких актёров дубляжа и выверенная драматургия паузы',
    showOnAirBadge: true,
    audioSeekSec: 6.1,
  },
  {
    id: 'taste',
    indexLabel: '02',
    tabLabel: '02 Вкус бренда',
    imageUrl:
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1800&q=85',
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
    imageUrl:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=85',
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
    imageUrl:
      'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=2000&q=85',
    imageAlt: 'Тёплая атмосфера звуковой студии AudioWorks в контровом свете',
    exposureClass: 'brightness-[1.24] contrast-[1.06] saturate-[1.12]',
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
    imageUrl:
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=2000&q=85',
    imageAlt: 'Фактурный макро-кадр утреннего ремесленного продукта в солнечном луче',
    exposureClass: 'brightness-[0.95] contrast-[1.04]',
  },
  {
    id: 'frame-architecture',
    indexLabel: '04',
    kind: 'photo',
    kicker: '04 · Девелопмент и частные сервисы',
    title: 'Тихий статус вместо кричащих скидок',
    subtitle: 'Камерная интонация и ювелирно выверенный дисклеймер',
    imageUrl:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=85',
    imageAlt: 'Вечерняя современная архитектура и тёплый панорамный свет',
    exposureClass: 'brightness-[0.96] contrast-[1.05]',
  },
];

export const KOTO_MIC_WIDGET_IMAGE =
  'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=600&q=80';

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
    eyebrow: 'Финал · Почерк AudioWorks',
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
