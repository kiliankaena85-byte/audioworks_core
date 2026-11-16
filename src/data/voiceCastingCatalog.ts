import { AUDIOWORKS_WAV_URL } from './audioworksCommercial.ts';
import type { BrandCasePoster } from './casesData.ts';
import type { IndustryVerticalSlug } from './platformRouter.ts';
import type { OrderFormatId } from './pricingData.ts';

export type VoiceArchetypeId =
  | 'federal_baritone'
  | 'warm_cinema_alto'
  | 'dubbing_scene_duo'
  | 'executive_b2b_tenor'
  | 'bright_retail_soprano'
  | 'calm_medical_baritone';

export type VoiceCastingFilterId =
  | 'all'
  | 'male'
  | 'female'
  | 'duo'
  | 'b2b_estate'
  | 'medicine_retail';

export interface VoiceArchetypeSpec {
  id: VoiceArchetypeId;
  code: string;
  title: string;
  genderKind: 'male' | 'female' | 'duo';
  genderLabel: string;
  timbreSummary: string;
  registerHzLabel: string;
  tempoWpmLabel: string;
  bestForSectors: string;
  auditionQuote: string;
  directorNote: string;
  recommendedFormatId: OrderFormatId;
  mappedIndustrySlug: IndustryVerticalSlug | null;
  demoClipStartSec: number;
  demoClipEndSec: number;
  coverImageUrl: string;
  filterTags: readonly VoiceCastingFilterId[];
}

export const VOICE_CASTING_FILTER_TABS: readonly {
  id: VoiceCastingFilterId;
  label: string;
}[] = [
  { id: 'all', label: 'Все голоса (6)' },
  { id: 'male', label: 'Мужские тембры' },
  { id: 'female', label: 'Женские тембры' },
  { id: 'duo', label: 'Игровой дуэт' },
  { id: 'b2b_estate', label: 'Девелопмент и B2B' },
  { id: 'medicine_retail', label: 'Медицина и ритейл' },
] as const;

export const VOICE_ARCHETYPES_CATALOG: readonly VoiceArchetypeSpec[] = [
  {
    id: 'federal_baritone',
    code: 'CAST-01',
    title: 'Федеральный баритон кинодубляжа',
    genderKind: 'male',
    genderLabel: 'Мужской баритон',
    timbreSummary: 'Плотный грудной регистр · спокойная статусная подача без крика',
    registerHzLabel: '95–135 Гц',
    tempoWpmLabel: '108 сл/мин',
    bestForSectors: 'ЖК бизнес-класса · автодилеры · частные банки · имидж',
    auditionQuote:
      '«Шум проспекта остаётся за тяжёлой дверью — слышен только ветер в кронах сосен»',
    directorNote:
      'Удерживает внимание в перегруженном прайм-тайме за счёт паузы и близкого микрофона Neumann U87.',
    recommendedFormatId: 'turnkey',
    mappedIndustrySlug: 'real-estate',
    demoClipStartSec: 36.8,
    demoClipEndSec: 54.4,
    coverImageUrl: '/src/assets/images/case_estate_cinema_1794399406227.jpg',
    filterTags: ['all', 'male', 'b2b_estate'],
  },
  {
    id: 'warm_cinema_alto',
    code: 'CAST-02',
    title: 'Тёплое женское меццо (сторителлинг)',
    genderKind: 'female',
    genderLabel: 'Женское меццо-сопрано',
    timbreSummary: 'Живое дыхание · тактильная интонация · доверие с первой фразы',
    registerHzLabel: '175–220 Гц',
    tempoWpmLabel: '116 сл/мин',
    bestForSectors: 'Гастрономия и FMCG · семейные кварталы · HoReCa · сервисы',
    auditionQuote:
      '«Тонкая, ещё горячая корочка медленно ломается под пальцами — и день на паузе»',
    directorNote:
      'Создаёт осязаемую картинку в голове слушателя без навязчивой «дикторской улыбки».',
    recommendedFormatId: 'turnkey',
    mappedIndustrySlug: 'retail-fmcg',
    demoClipStartSec: 15.4,
    demoClipEndSec: 33.2,
    coverImageUrl:
      '/src/assets/images/hero_artisan_bakery_taste_1794605229940.jpg',
    filterTags: ['all', 'female', 'medicine_retail'],
  },
  {
    id: 'dubbing_scene_duo',
    code: 'CAST-03',
    title: 'Игровой дуэт актёров дубляжа',
    genderKind: 'duo',
    genderLabel: 'Дуэт 2 актёров (М + Ж)',
    timbreSummary: 'Диалог как сцена из кино · естественная реакция · SFX-драматургия',
    registerHzLabel: '2 плана сцены',
    tempoWpmLabel: '122 сл/мин',
    bestForSectors: 'Мини-кино · федеральные кампании · сложные услуги и финтех',
    auditionQuote:
      '«Стоп. Выдохните. Пока обычные объявления спорят, кто прокричит быстрее — ваша история уже внутри»',
    directorNote:
      'Записываем партнёров с точной отстройкой реплик и интершума — ролик выделяется среди сухих объявлений.',
    recommendedFormatId: 'cinema',
    mappedIndustrySlug: null,
    demoClipStartSec: 0,
    demoClipEndSec: 15.2,
    coverImageUrl:
      '/src/assets/images/hero_broadcast_booth_wide_1794605231279.jpg',
    filterTags: ['all', 'duo', 'b2b_estate', 'medicine_retail'],
  },
  {
    id: 'executive_b2b_tenor',
    code: 'CAST-04',
    title: 'Деловой аналитический баритон-тенор',
    genderKind: 'male',
    genderLabel: 'Мужской деловой тембр',
    timbreSummary: 'Безупречная дикция цифр · собранный ритм · тон равного партнёра',
    registerHzLabel: '120–160 Гц',
    tempoWpmLabel: '124 сл/мин',
    bestForSectors: 'B2B-поставки · лизинг · IT и облачные платформы · логистика',
    auditionQuote:
      '«Точный расчёт сметы, чистые права и приёмка ролика на радиостанции с первого дубля»',
    directorNote:
      'Органично произносит сложные термины, процентные ставки и юридические дисклеймеры ст. 28 ФЗ-38.',
    recommendedFormatId: 'voice_style',
    mappedIndustrySlug: 'b2b-finance',
    demoClipStartSec: 56.6,
    demoClipEndSec: 74.5,
    coverImageUrl: '/src/assets/images/hero_studio_editorial_1794399404984.jpg',
    filterTags: ['all', 'male', 'b2b_estate'],
  },
  {
    id: 'bright_retail_soprano',
    code: 'CAST-05',
    title: 'Светлый динамичный голос для акций',
    genderKind: 'female',
    genderLabel: 'Женский светлый тембр',
    timbreSummary: 'Энергичная подача без суеты · ясный акцент на оффере и датах',
    registerHzLabel: '205–255 Гц',
    tempoWpmLabel: '134 сл/мин',
    bestForSectors: 'Ритейл-распродажи · доставка · маркетплейсы · фитнес и события',
    auditionQuote:
      '«Свежая выпечка и зерновой кофе по пути в офис — загляните за две минуты!»',
    directorNote:
      'Читает плотные 15-секундные офферы легко и полётно, сохраняя стопроцентную разборчивость телефона.',
    recommendedFormatId: 'voice_style',
    mappedIndustrySlug: 'retail-fmcg',
    demoClipStartSec: 21.0,
    demoClipEndSec: 36.5,
    coverImageUrl:
      '/src/assets/images/hero_artisan_bakery_taste_1794605229940.jpg',
    filterTags: ['all', 'female', 'medicine_retail'],
  },
  {
    id: 'calm_medical_baritone',
    code: 'CAST-06',
    title: 'Спокойный экспертный голос доверия',
    genderKind: 'male',
    genderLabel: 'Мужской мягкий тембр',
    timbreSummary: 'Деликатная врачебная интонация · эмпатия без пафоса',
    registerHzLabel: '110–145 Гц',
    tempoWpmLabel: '110 сл/мин',
    bestForSectors: 'Многопрофильные клиники · стоматология · диагностика · страхование',
    auditionQuote:
      '«Спокойный голос специалиста, с которого начинается точная диагностика без спешки»',
    directorNote:
      'Идеален для медицинской рубрики (ч. 7 ст. 24 ФЗ-38), где важны такт и отсутствие давления на пациента.',
    recommendedFormatId: 'turnkey',
    mappedIndustrySlug: 'medicine',
    demoClipStartSec: 41.0,
    demoClipEndSec: 56.4,
    coverImageUrl:
      '/src/assets/images/industry_medicine_clinic_1794514558724.jpg',
    filterTags: ['all', 'male', 'medicine_retail'],
  },
] as const;

const VALID_VOICE_IDS: readonly VoiceArchetypeId[] = VOICE_ARCHETYPES_CATALOG.map(
  (item) => item.id
);

export function isValidVoiceArchetypeId(
  value: unknown
): value is VoiceArchetypeId {
  return (
    typeof value === 'string' &&
    (VALID_VOICE_IDS as readonly string[]).includes(value)
  );
}

export function getVoiceArchetypeById(
  id: string | null | undefined
): VoiceArchetypeSpec | null {
  if (!id || !isValidVoiceArchetypeId(id)) return null;
  return VOICE_ARCHETYPES_CATALOG.find((item) => item.id === id) ?? null;
}

export function filterVoiceArchetypes(
  filterId: VoiceCastingFilterId
): readonly VoiceArchetypeSpec[] {
  if (filterId === 'all') return VOICE_ARCHETYPES_CATALOG;
  return VOICE_ARCHETYPES_CATALOG.filter((item) =>
    item.filterTags.includes(filterId)
  );
}

/**
 * Адаптирует карточку актёра дубляжа к единому формату студийного аудиоплеера (`FloatingCasePlayer`),
 * чтобы демо-отрывок воспроизводился локально и поддерживал глобальные клавиши Space / Стрелки.
 */
export function toVoiceDemoCasePoster(
  voice: VoiceArchetypeSpec
): BrandCasePoster {
  const durationSec = Math.max(
    8,
    Math.round(voice.demoClipEndSec - voice.demoClipStartSec)
  );
  return {
    id: `voice-demo-${voice.id}`,
    client: `${voice.code} · ${voice.title}`,
    tag: `${voice.genderLabel} · ${voice.registerHzLabel}`,
    headline: voice.timbreSummary,
    summary: voice.directorNote,
    quoteImage: voice.auditionQuote,
    durationSec,
    audioUrl: AUDIOWORKS_WAV_URL,
    clipStartSec: voice.demoClipStartSec,
    clipEndSec: voice.demoClipEndSec,
    previewStartSec: voice.demoClipStartSec,
    previewDurationSec: 4,
    coverImageUrl: voice.coverImageUrl,
    coverImageAlt: `Демо тембра: ${voice.title}`,
    editorialSurfaceBg: 'bg-[#151417]',
    posterGradientClass: 'bg-gradient-to-br from-[#18181C] via-[#121216] to-[#0B0B0D]',
    posterGlowClass: 'bg-[#FF4820]/15',
  };
}

export function formatVoiceSelectionSummary(
  voiceId: string | null | undefined
): string | null {
  const voice = getVoiceArchetypeById(voiceId);
  if (!voice) return null;
  return `${voice.title} (${voice.code}, ${voice.genderLabel})`;
}
