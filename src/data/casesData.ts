import { LayaPersona } from '../engine/layaTypes';
import { AUDIOWORKS_TOTAL_DURATION_SEC, AUDIOWORKS_WAV_URL } from './audioworksCommercial';

export type CaseId =
  | 'audioworks-reel'
  | 'dmitrogorsky'
  | 'business-estate'
  | 'medical-clinics';

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
    coverImageUrl:
      'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1400&q=85',
    coverImageAlt: 'Светлый скандинавский интерьер многопрофильной клиники',
    editorialSurfaceBg: 'bg-[#132036]',
    posterGradientClass: 'bg-gradient-to-br from-[#162747] via-[#101C35] to-[#080F1E]',
    posterGlowClass: 'bg-[#60A5FA]/15',
  },
];

export const VALID_CASE_IDS: readonly CaseId[] = [
  'audioworks-reel',
  'dmitrogorsky',
  'business-estate',
  'medical-clinics',
] as const;

export function isValidCaseId(value: string): value is CaseId {
  return (VALID_CASE_IDS as readonly string[]).includes(value);
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
  hash = ''
): CaseId | null {
  const params = new URLSearchParams(search);
  const fromQuery = (params.get('case') ?? '').trim();
  if (fromQuery && isValidCaseId(fromQuery)) {
    return fromQuery;
  }

  const normalizedHash = hash.replace(/^#/, '').trim();
  if (normalizedHash.startsWith('case-')) {
    const candidate = normalizedHash.slice('case-'.length);
    if (isValidCaseId(candidate)) {
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
  'Радиостанция дает вам миллионную аудиторию. Мы делаем так, чтобы к вам вышли подготовленными — со сценарием, редкими голосами и чистыми документами.';

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
    title: 'Сценарий со смыслом',
    body: 'Не просим вас писать ТЗ на 5 страниц. Сами нащупаем главную выгоду и сложим её в точные 30 секунд.',
  },
  {
    number: '02',
    title: 'Незамыленные актеры',
    body: 'В нашей базе голоса кино и дубляжа, которые еще не приелись слушателям в каждом рекламном блоке.',
  },
  {
    number: '03',
    title: 'Спокойствие за документы',
    body: 'Проверим текст по требованиям закона о рекламе и подготовим лицензионный паспорт музыки для любой станции.',
  },
];
