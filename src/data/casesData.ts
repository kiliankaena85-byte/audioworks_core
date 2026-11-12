import { LayaPersona } from '../engine/layaTypes';
import { AUDIOWORKS_TOTAL_DURATION_SEC, AUDIOWORKS_WAV_URL } from './audioworksCommercial';

export type CanonicalCaseId =
  | 'audioworks-reel'
  | 'dmitrogorsky'
  | 'business-estate'
  | 'medical-clinics';

export type CaseId = CanonicalCaseId | (string & {});

export type CasePlaybackMode = 'full' | 'preview';

export const DEFAULT_CASE_PREVIEW_DURATION_SEC = 4;

export interface BrandCasePoster {
  id: CaseId;
  client: string;
  tag: string;
  headline: string;
  summary: string;
  quoteImage: string;
  durationSec: number;
  audioUrl?: string;
  clipStartSec?: number;
  clipEndSec?: number;
  /** Секунда старта короткого эфирного превью при наведении курсора */
  previewStartSec?: number;
  /** Длительность превью при наведении (3–5 секунд) */
  previewDurationSec?: number;
  /** Фотографическая обложка журнального постера */
  coverImageUrl: string;
  coverImageAlt: string;
  /** Благородный студийный фон текстовой половины во флагманском двухколоночном сплите */
  editorialSurfaceBg: string;
  /** Фоллбэк-градиент под фотографией на случай медленной сети */
  posterGradientClass: string;
  /** Мягкий акцентный свет внутри обложки */
  posterGlowClass: string;
}

/**
 * Полный студийный демо-ролик Audioworks (1:19), записанный для демонстрации контраста:
 * от потокового радийного штампа — к паузе и кино-сценам в голове слушателя.
 */
export const FLAGSHIP_STUDIO_REEL: BrandCasePoster = {
  id: 'audioworks-reel',
  client: 'Промо-ролик Audioworks',
  tag: 'Оригинальная запись студии · Полная версия 1:19',
  headline: 'Сильная реклама не кричит в ухо — она включает кино в голове',
  summary:
    'Послушайте наш собственный эфирный ролик целиком: резкая остановка рекламного шума, утренняя сцена вкуса, тишина приватного двора и фирменный почерк Audioworks.',
  quoteImage:
    '«Стоп. Выдохните. Пока обычные объявления спорят, кто прокричит быстрее — ваша история уже внутри»',
  durationSec: Math.round(AUDIOWORKS_TOTAL_DURATION_SEC),
  audioUrl: AUDIOWORKS_WAV_URL,
  clipStartSec: 0,
  clipEndSec: AUDIOWORKS_TOTAL_DURATION_SEC,
  previewStartSec: 7.2,
  previewDurationSec: 4,
  coverImageUrl:
    'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1600&q=85',
  coverImageAlt: 'Студийная консоль и микрофон продакшна Audioworks в мягком свете',
  editorialSurfaceBg: 'bg-[#151417]',
  posterGradientClass: 'bg-gradient-to-br from-[#18181C] via-[#121216] to-[#0B0B0D]',
  posterGlowClass: 'bg-[#FF4820]/20',
};

export const BRAND_CASES: BrandCasePoster[] = [
  {
    id: 'dmitrogorsky',
    client: 'Дмитрогорский продукт',
    tag: 'FMCG · Федеральный эфир',
    headline: 'Вкус, который слышно даже в утренней пробке',
    summary:
      'Ушли от дикторских штампов в сторону живой игровой подачи и аппетитного саунд-дизайна. Ролик с первого дубля прошел модерацию радиосетей.',
    quoteImage: '«Тонкая, ещё горячая корочка медленно ломается под пальцами — и день на паузе»',
    durationSec: 21,
    audioUrl: AUDIOWORKS_WAV_URL,
    clipStartSec: 15.4,
    clipEndSec: 36.6,
    previewStartSec: 15.6,
    previewDurationSec: 4,
    coverImageUrl:
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1600&q=85',
    coverImageAlt: 'Утренний горячий кофе и ремесленная гастрономическая подача для кейса Дмитрогорский продукт',
    editorialSurfaceBg: 'bg-[#2A1410]',
    posterGradientClass: 'bg-gradient-to-br from-[#3D1D16] via-[#2A1410] to-[#170B08]',
    posterGlowClass: 'bg-[#FF6B3D]/20',
  },
  {
    id: 'business-estate',
    client: 'Квартал бизнес-класса',
    tag: 'Девелопмент • Недвижимость',
    headline: 'Тихая уверенность вместо кричащих распродаж',
    summary:
      'Статусный ролик для деловых радиостанций с ювелирно выверенным юридическим дисклеймером.',
    quoteImage: '«Шум проспекта остаётся за тяжёлой дверью — слышен только ветер в кронах сосен»',
    durationSec: 20,
    audioUrl: AUDIOWORKS_WAV_URL,
    clipStartSec: 36.8,
    clipEndSec: 56.4,
    previewStartSec: 37.0,
    previewDurationSec: 4,
    coverImageUrl:
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1400&q=85',
    coverImageAlt: 'Современная фасадная архитектура жилого квартала бизнес-класса',
    editorialSurfaceBg: 'bg-[#12231D]',
    posterGradientClass: 'bg-gradient-to-br from-[#143D30] via-[#0E2B22] to-[#071712]',
    posterGlowClass: 'bg-[#4ADE80]/12',
  },
  {
    id: 'medical-clinics',
    client: 'Сеть многопрофильных клиник',
    tag: 'Медицина',
    headline: 'Человеческая интонация там, где все читают по бумажке',
    summary:
      'Теплый актерский тембр, вызывающий доверие с первой секунды, и 100% соблюдение закона о рекламе медицины.',
    quoteImage: '«Спокойный голос врача, с которого начинается выздоровление»',
    durationSec: 15,
    audioUrl: undefined,
    previewStartSec: 0,
    previewDurationSec: 4,
    coverImageUrl:
      'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1400&q=85',
    coverImageAlt: 'Светлый скандинавский интерьер многопрофильной клиники',
    editorialSurfaceBg: 'bg-[#132036]',
    posterGradientClass: 'bg-gradient-to-br from-[#162747] via-[#101C35] to-[#080F1E]',
    posterGlowClass: 'bg-[#60A5FA]/15',
  },
];

export const VALID_CASE_IDS: readonly CanonicalCaseId[] = [
  'audioworks-reel',
  'dmitrogorsky',
  'business-estate',
  'medical-clinics',
] as const;

export function isValidCaseId(
  value: string,
  allowedIds: readonly string[] = VALID_CASE_IDS
): value is CaseId {
  return allowedIds.includes(value);
}

export interface CaseHoverRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Вычисляет мягкое встречное смещение фотообложки при движении курсора по карточке кейса,
 * создавая ощущение оптической глубины и объёма внутри журнальной рамки.
 */
export function computeCaseHoverOffset(
  clientX: number,
  clientY: number,
  rect: CaseHoverRect,
  maxShiftX = 10,
  maxShiftY = 8
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 };
  }

  const normX = Math.max(-0.5, Math.min(0.5, (clientX - rect.left) / rect.width - 0.5));
  const normY = Math.max(-0.5, Math.min(0.5, (clientY - rect.top) / rect.height - 0.5));

  const x = Math.round(-normX * 2 * maxShiftX * 100) / 100;
  const y = Math.round(-normY * 2 * maxShiftY * 100) / 100;

  return {
    x: Object.is(x, -0) ? 0 : x,
    y: Object.is(y, -0) ? 0 : y,
  };
}

export interface CasePreviewWindow {
  startSec: number;
  durationSec: number;
  endSec: number;
}

/**
 * Вычисляет точное окно короткого эфирного превью (3–5 секунд) для карточки кейса.
 */
export function getCasePreviewWindow(
  item: Pick<
    BrandCasePoster,
    'clipStartSec' | 'durationSec' | 'previewStartSec' | 'previewDurationSec'
  >
): CasePreviewWindow {
  const rawDuration = Number.isFinite(item.previewDurationSec)
    ? Number(item.previewDurationSec)
    : DEFAULT_CASE_PREVIEW_DURATION_SEC;
  const boundedDuration = Math.min(5, Math.max(3, rawDuration));
  const durationSec = Math.min(Math.max(1, item.durationSec), boundedDuration);
  const startSec = Math.max(0, item.previewStartSec ?? item.clipStartSec ?? 0);
  const endSec = Math.round((startSec + durationSec) * 100) / 100;

  return {
    startSec: Math.round(startSec * 100) / 100,
    durationSec,
    endSec,
  };
}

/**
 * Определяет, должно ли наведение курсора запускать короткое превью кейса:
 * - Игнорирует касания на тач-экранах (`pointerType === 'touch'`).
 * - Никогда не прерывает уже запущенный пользователем полный трек (`playbackMode === 'full'`).
 */
export function shouldStartHoverPreview(params: {
  pointerType: string;
  isPlaying: boolean;
  playbackMode: CasePlaybackMode | null;
}): boolean {
  if (params.pointerType === 'touch') {
    return false;
  }
  if (params.isPlaying && params.playbackMode === 'full') {
    return false;
  }
  return true;
}

export interface CaseCardProgressState {
  isActive: boolean;
  mode: CasePlaybackMode | null;
  ratio: number;
  percent: number;
}

/**
 * Вычисляет нормализованный прогресс воспроизведения (0..1 и 0..100%)
 * индивидуально для конкретной карточки кейса (как для полного трека, так и для превью).
 * Заполняется только у карточки, чей аудиоролик звучит прямо сейчас.
 */
export function computeCaseCardProgress(
  caseId: CaseId,
  isPlaying: boolean,
  activeCaseId: CaseId | null | undefined,
  rawProgress: number,
  playbackMode: CasePlaybackMode | null = 'full'
): CaseCardProgressState {
  if (!isPlaying || activeCaseId !== caseId) {
    return { isActive: false, mode: null, ratio: 0, percent: 0 };
  }

  const clamped = Number.isFinite(rawProgress)
    ? Math.max(0, Math.min(1, rawProgress))
    : 0;

  return {
    isActive: true,
    mode: playbackMode ?? 'full',
    ratio: Math.round(Math.max(0.02, clamped) * 1000) / 1000,
    percent: Math.round(clamped * 100),
  };
}

export const CASE_SPECTRUM_BAND_COUNT = 32;

/**
 * Вычисляет 32-полосный акустический профиль звуковой волны (0.16..1)
 * с индивидуальным тембральным почерком каждого кейса при прослушивании и предпросмотре.
 */
export function computeCaseSpectrumBands(
  caseId: CaseId,
  elapsedSec: number,
  isActive: boolean,
  fftNormalized?: readonly number[]
): number[] {
  if (!isActive) {
    return Array.from({ length: CASE_SPECTRUM_BAND_COUNT }, () => 0);
  }

  const t = Number.isFinite(elapsedSec) ? Math.max(0, elapsedSec) : 0;

  let cadenceHz = 5.4;
  let formantCenter = 0.44;
  let formantWidth = 0.28;
  let airSparkle = 0.28;
  let warmLow = 0.34;
  let phaseSeed = 0.4;

  if (caseId === 'dmitrogorsky') {
    cadenceHz = 6.3;
    formantCenter = 0.48;
    formantWidth = 0.26;
    airSparkle = 0.42;
    warmLow = 0.32;
    phaseSeed = 1.15;
  } else if (caseId === 'business-estate') {
    cadenceHz = 3.7;
    formantCenter = 0.32;
    formantWidth = 0.24;
    airSparkle = 0.18;
    warmLow = 0.52;
    phaseSeed = 2.3;
  } else if (caseId === 'medical-clinics') {
    cadenceHz = 4.3;
    formantCenter = 0.42;
    formantWidth = 0.3;
    airSparkle = 0.24;
    warmLow = 0.38;
    phaseSeed = 3.45;
  }

  // Естественная речевая фразировка с мягкими микропаузами дыхания
  const breathGate =
    0.58 +
    0.42 *
      Math.max(
        0.15,
        Math.sin(t * 2.1 + phaseSeed) * 0.6 + Math.cos(t * 1.15 + phaseSeed * 0.5) * 0.4 + 0.35
      );

  const hasLiveFft =
    Array.isArray(fftNormalized) &&
    fftNormalized.length > 0 &&
    fftNormalized.some((v) => v > 0.02);

  return Array.from({ length: CASE_SPECTRUM_BAND_COUNT }, (_, idx) => {
    const pos = idx / (CASE_SPECTRUM_BAND_COUNT - 1); // 0..1

    const vocalBell = Math.exp(-Math.pow((pos - formantCenter) / formantWidth, 2));
    const lowShelf = Math.exp(-Math.pow(pos / 0.24, 2)) * warmLow;
    const highAir = Math.exp(-Math.pow((pos - 0.84) / 0.16, 2)) * airSparkle;
    const spectralContour = Math.min(1, 0.18 + vocalBell * 0.68 + lowShelf + highAir);

    const syllabicPulse =
      0.42 +
      0.36 * Math.abs(Math.sin(t * cadenceHz + idx * 0.46 + phaseSeed)) +
      0.22 * Math.abs(Math.cos(t * (cadenceHz * 1.62) - idx * 0.31));

    let level = spectralContour * syllabicPulse * Math.min(1.08, breathGate);

    if (hasLiveFft && fftNormalized) {
      const fftIdx = Math.min(
        fftNormalized.length - 1,
        Math.floor((pos * fftNormalized.length) * 0.85)
      );
      const fftVal = Math.max(0, Math.min(1, fftNormalized[fftIdx] ?? 0));
      level = level * 0.48 + (0.16 + fftVal * 0.84) * 0.52;
    }

    const clamped = Math.min(1, Math.max(0.16, level));
    return Math.round(clamped * 1000) / 1000;
  });
}

/**
 * Формирует прямую ссылку на конкретный кейс портфолио (`?case=<id>#case-<id>`),
 * сохраняя текущие параметры персонализации (например, `?persona=...`).
 */
export function buildCaseShareUrl(currentHref: string, caseId: CaseId): string {
  try {
    const url = new URL(currentHref);
    url.searchParams.set('case', caseId);
    url.hash = `case-${caseId}`;
    return url.toString();
  } catch {
    return `?case=${encodeURIComponent(caseId)}#case-${encodeURIComponent(caseId)}`;
  }
}

/**
 * Извлекает идентификатор кейса из URL (`?case=...` или `#case-...`) при переходе по прямой ссылке.
 */
export function readSharedCaseIdFromLocation(
  search: string,
  hash = '',
  allowedIds: readonly string[] = VALID_CASE_IDS
): CaseId | null {
  const params = new URLSearchParams(search);
  const fromQuery = (params.get('case') ?? '').trim();
  if (fromQuery && isValidCaseId(fromQuery, allowedIds)) {
    return fromQuery;
  }

  const normalizedHash = hash.replace(/^#/, '').trim();
  if (normalizedHash.startsWith('case-')) {
    const candidate = normalizedHash.slice('case-'.length);
    if (isValidCaseId(candidate, allowedIds)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Динамическая сортировка витрины кейсов решением Laya AI:
 * - Если Laya определила профиль `real_estate` — на первое широкое место встаёт кейс Девелопера.
 * - Если `fmcg` или `default` (и остальные профили) — на первом широком месте стоит «Дмитрогорский продукт».
 */
export function getOrderedCasesForPersona(persona: LayaPersona): BrandCasePoster[] {
  const byId = new Map(BRAND_CASES.map((c) => [c.id, c]));

  const order: CaseId[] =
    persona === 'real_estate'
      ? ['business-estate', 'dmitrogorsky', 'medical-clinics']
      : ['dmitrogorsky', 'business-estate', 'medical-clinics'];

  return order.map((id) => byId.get(id)!);
}

export const APPROACH_THESIS =
  'Радиостанция даёт вам миллионную аудиторию. Мы делаем так, чтобы в рекламном блоке услышали именно вас.';

export const APPROACH_LEAD_PARAGRAPH =
  'Центральная нервная система человека экономит ресурс и за первые две секунды переводит однотипные рекламные ролики в фоновый шум. Чтобы эфирный бюджет приносил клиентов, а не растворялся между чужими скидками, звук должен переключать восприятие — без крика и заученных штампов.';

export interface NeuroStudyProofCard {
  id: string;
  sourceLabel: string;
  metricValue: string;
  metricCaption: string;
  secondaryStat: string;
  summary: string;
}

export const APPROACH_NEURO_STUDIES: NeuroStudyProofCard[] = [
  {
    id: 'neuro-insight-hear-and-now',
    sourceLabel: 'Radiocentre × Neuro-Insight · исследование Hear and Now',
    metricValue: '+22%',
    metricCaption: 'к записи бренда в долговременную память',
    secondaryStat: '+23% к вовлечённости мозга в живом бытовом контексте',
    summary:
      'По данным нейротомографии активности мозга (SST), слушатель за рулём или в делах автоматически отсекает общий рекламный гул, но мгновенно включает селективное внимание, когда с первых секунд узнаёт свою реальную ситуацию.',
  },
  {
    id: 'system1-listen-up',
    sourceLabel: 'System1 × Radiocentre · исследование Listen Up! (50 000+ слушателей)',
    metricValue: '2×',
    metricCaption: 'двукратный рост доверия к бренду в эфире',
    secondaryStat: '+8,2% к реальным целевым действиям покупателей',
    summary:
      'Сухая скороговорка из цифр, адресов и условий перегружает узкий аналитический канал и стирается через минуту. Живая сцена, пауза и тёплая актёрская подача включают образное восприятие правого полушария и работают вдолгую.',
  },
];

export const APPROACH_STUDIO_PHOTO = {
  imageUrl:
    'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1000&q=85',
  imageAlt: 'Крупный план студийного конденсаторного микрофона в мягком тёплом свете',
  caption: 'Собственный контроль качества на каждом этапе — от текста до паспорта ролика',
} as const;

export interface ApproachPillar {
  number: string;
  title: string;
  body: string;
}

export const APPROACH_PILLARS: ApproachPillar[] = [
  {
    number: '01',
    title: 'Контраст вместо рекламного шума',
    body: 'Снимаем защитный блок внимания с первой секунды: выстраиваем драматургию паузы, одну точную выгоду и живую сцену вместо попытки зачитать весь буклет за 15 секунд.',
  },
  {
    number: '02',
    title: 'Незамыленные голоса кино и дубляжа',
    body: 'Слушатель мгновенно глушит приевшуюся «дежурную дикторскую подачу». Мы записываем характерных актёров с живым человеческим дыханием, которым веришь с полуслова.',
  },
  {
    number: '03',
    title: 'Спокойствие за эфир и документы',
    body: 'Проверяем каждое слово по требованиям закона о рекламе, выверяем хронометраж до десятой доли секунды и готовим лицензионный паспорт музыки для модерации с первого дубля.',
  },
];
