import type { LayaPersona, RecommendedTier } from '../engine/layaTypes.ts';
import {
  AUDIOWORKS_TOTAL_DURATION_SEC,
  KOTO_LENS_MANIFESTO_PARAGRAPH,
  ZERNO_DUEL_DATA,
  type DuelSpotSpec,
  type DuelTranscriptPhrase,
} from './audioworksCommercial.ts';
import {
  APPROACH_LEAD_PARAGRAPH,
  APPROACH_NEURO_STUDIES,
  APPROACH_PILLARS,
  APPROACH_STUDIO_PHOTO,
  APPROACH_THESIS,
  BRAND_CASES,
  DEFAULT_CASE_PREVIEW_DURATION_SEC,
  FLAGSHIP_STUDIO_REEL,
  type ApproachPillar,
  type BrandCasePoster,
  type NeuroStudyProofCard,
} from './casesData.ts';
import { EDITORIAL_FAQ_ITEMS, type FaqItem } from './faqData.ts';
import { EDITORIAL_PRICING_ROWS, type EditorialPricingRow } from './pricingData.ts';
import { checkBannedForeignServiceUrl } from '../security/rfLegalCompliance.ts';
import {
  createDefaultHeroStageCmsConfig,
  normalizeHeroStageCmsConfig,
  type HeroStageCmsConfig,
} from './heroStageCms.ts';
import {
  createDefaultTestimonialsCmsConfig,
  normalizeTestimonialsCmsConfig,
  type ClientTestimonialCmsRecord,
  type TestimonialsCmsConfig,
  type TestimonialTrustMetric,
} from './testimonialsCms.ts';

export type {
  ClientTestimonialCmsRecord,
  HeroStageCmsConfig,
  TestimonialsCmsConfig,
  TestimonialTrustMetric,
};

export type PortfolioPersonaFocus = 'fmcg' | 'real_estate' | 'general';

export interface PortfolioCaseRecord extends BrandCasePoster {
  published: boolean;
  sortOrder: number;
  personaFocus: PortfolioPersonaFocus;
  customAudioFileName?: string;
}

export interface DuelCmsSpotSpec extends DuelSpotSpec {
  audioUrl?: string;
  audioFileName?: string;
}

export interface DuelCmsConfig {
  sectionEyebrow: string;
  headingPrimary: string;
  headingMuted: string;
  clientName: string;
  briefSummary: string;
  radioSpot: DuelCmsSpotSpec;
  audioworksSpot: DuelCmsSpotSpec;
}

export interface NeuroApproachConfig {
  eyebrow: string;
  thesis: string;
  leadParagraph: string;
  studies: NeuroStudyProofCard[];
  pillars: ApproachPillar[];
  studioPhotoUrl: string;
  studioPhotoAlt: string;
  studioPhotoKicker: string;
  studioPhotoCaption: string;
}

export interface SiteCopyCmsConfig {
  heroLensClutterKicker: string;
  heroLensClutterHeadline: string;
  heroManifestoLead: string;
  pricingEyebrow: string;
  pricingHeadingPrimary: string;
  pricingHeadingMuted: string;
  pricingSubheading: string;
  pricingRows: EditorialPricingRow[];
  faqEyebrow: string;
  faqHeading: string;
  faqSubheading: string;
  faqItems: FaqItem[];
}

export interface StudioCmsSnapshot {
  schemaVersion: 1;
  updatedAt: string;
  heroStage: HeroStageCmsConfig;
  flagshipReel: PortfolioCaseRecord;
  portfolioCases: PortfolioCaseRecord[];
  duel: DuelCmsConfig;
  neuroApproach: NeuroApproachConfig;
  siteCopy: SiteCopyCmsConfig;
  testimonials: TestimonialsCmsConfig;
}

export const BANNED_EDITORIAL_TERMS = [
  'fm-тракт',
  'спектрограмма',
  'компрессор',
  'стемы',
  'дешевые биржи',
  'честная московская цена',
  'москв',
  'петерб',
  'питер',
  'мск',
  'спб',
  'moscow',
  'spb',
] as const;

export function resolveAppRoute(pathname: string): 'public' | 'admin' {
  const clean = (pathname || '/').trim().toLowerCase();
  if (clean === '/admin' || clean.startsWith('/admin/')) {
    return 'admin';
  }
  return 'public';
}

export function formatPriceRub(priceRub: number): string {
  const safe = Math.max(0, Math.round(Number.isFinite(priceRub) ? priceRub : 0));
  const grouped = String(safe).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped} ₽`;
}

export interface NormalizedAudioTiming {
  durationSec: number;
  clipStartSec: number;
  clipEndSec: number;
  previewStartSec: number;
  previewDurationSec: number;
}

/**
 * Гарантирует корректные границы полного фрагмента и окна короткого hover-превью (3–5 секунд).
 */
export function clampPreviewTiming(params: {
  durationSec: number;
  clipStartSec?: number;
  clipEndSec?: number;
  previewStartSec?: number;
  previewDurationSec?: number;
}): NormalizedAudioTiming {
  const safeTotal = Number.isFinite(params.durationSec)
    ? Math.max(1, Math.round(params.durationSec * 100) / 100)
    : 15;

  const rawClipStart = Number.isFinite(params.clipStartSec)
    ? Math.max(0, Number(params.clipStartSec))
    : 0;

  const rawClipEnd = Number.isFinite(params.clipEndSec)
    ? Math.max(rawClipStart + 1, Number(params.clipEndSec))
    : rawClipStart + safeTotal;

  const effectiveSpan = Math.max(1, Math.round((rawClipEnd - rawClipStart) * 100) / 100);

  const rawPreviewDur = Number.isFinite(params.previewDurationSec)
    ? Number(params.previewDurationSec)
    : DEFAULT_CASE_PREVIEW_DURATION_SEC;
  const boundedPreviewDur = Math.min(5, Math.max(3, rawPreviewDur));
  const previewDurationSec =
    Math.round(Math.min(effectiveSpan, boundedPreviewDur) * 10) / 10;

  const rawPreviewStart = Number.isFinite(params.previewStartSec)
    ? Math.max(0, Number(params.previewStartSec))
    : rawClipStart;

  const maxPreviewStart = Math.max(rawClipStart, rawClipEnd - previewDurationSec);
  const previewStartSec =
    Math.round(Math.min(Math.max(rawClipStart, rawPreviewStart), maxPreviewStart) * 100) /
    100;

  return {
    durationSec: Math.max(1, Math.round(effectiveSpan)),
    clipStartSec: Math.round(rawClipStart * 100) / 100,
    clipEndSec: Math.round(rawClipEnd * 100) / 100,
    previewStartSec,
    previewDurationSec,
  };
}

/**
 * Сортирует опубликованные карточки портфолио под активный отраслевой профиль Laya AI.
 */
export function orderPublishedCmsCasesForPersona(
  cases: readonly PortfolioCaseRecord[],
  persona: LayaPersona
): PortfolioCaseRecord[] {
  const published = cases.filter((item) => item.published !== false);
  const sorted = [...published].sort((a, b) => a.sortOrder - b.sortOrder);

  if (persona === 'real_estate') {
    const estateLead = sorted.filter((c) => c.personaFocus === 'real_estate');
    const others = sorted.filter((c) => c.personaFocus !== 'real_estate');
    return [...estateLead, ...others];
  }

  if (persona === 'fmcg') {
    const fmcgLead = sorted.filter((c) => c.personaFocus === 'fmcg');
    const others = sorted.filter((c) => c.personaFocus !== 'fmcg');
    return [...fmcgLead, ...others];
  }

  return sorted;
}

/**
 * Создаёт заводской эталонный снимок студийной CMS AudioWorks.
 */
export function createDefaultStudioCmsSnapshot(): StudioCmsSnapshot {
  const defaultFocusByCaseId: Record<string, PortfolioPersonaFocus> = {
    dmitrogorsky: 'fmcg',
    'business-estate': 'real_estate',
    'medical-clinics': 'general',
  };

  return {
    schemaVersion: 1,
    updatedAt: '2026-11-12T00:00:00.000Z',
    heroStage: createDefaultHeroStageCmsConfig(),
    flagshipReel: {
      ...FLAGSHIP_STUDIO_REEL,
      clipStartSec: FLAGSHIP_STUDIO_REEL.clipStartSec ?? 0,
      clipEndSec: FLAGSHIP_STUDIO_REEL.clipEndSec ?? AUDIOWORKS_TOTAL_DURATION_SEC,
      previewStartSec: FLAGSHIP_STUDIO_REEL.previewStartSec ?? 7.2,
      previewDurationSec: FLAGSHIP_STUDIO_REEL.previewDurationSec ?? 4,
      published: true,
      sortOrder: 0,
      personaFocus: 'general',
    },
    portfolioCases: BRAND_CASES.map((item, idx) => ({
      ...item,
      published: true,
      sortOrder: idx + 1,
      personaFocus: defaultFocusByCaseId[item.id] ?? 'general',
    })),
    duel: {
      sectionEyebrow: 'Сравнение на одном брифе',
      headingPrimary: 'Один бриф на 15 секунд.',
      headingMuted: 'Два разных результата.',
      clientName: ZERNO_DUEL_DATA.clientName,
      briefSummary: ZERNO_DUEL_DATA.briefSummary,
      radioSpot: {
        ...ZERNO_DUEL_DATA.radioSpot,
        phrases: ZERNO_DUEL_DATA.radioSpot.phrases.map((p) => ({ ...p })),
      },
      audioworksSpot: {
        ...ZERNO_DUEL_DATA.audioworksSpot,
        phrases: ZERNO_DUEL_DATA.audioworksSpot.phrases.map((p) => ({ ...p })),
      },
    },
    neuroApproach: {
      eyebrow: 'Почему продакшн, а не просто озвучка',
      thesis: APPROACH_THESIS,
      leadParagraph: APPROACH_LEAD_PARAGRAPH,
      studies: APPROACH_NEURO_STUDIES.map((s) => ({ ...s })),
      pillars: APPROACH_PILLARS.map((p) => ({ ...p })),
      studioPhotoUrl: APPROACH_STUDIO_PHOTO.imageUrl,
      studioPhotoAlt: APPROACH_STUDIO_PHOTO.imageAlt,
      studioPhotoKicker: 'Студийный контроль',
      studioPhotoCaption: APPROACH_STUDIO_PHOTO.caption,
    },
    siteCopy: {
      heroLensClutterKicker: 'Краш-тест в реальном рекламном блоке',
      heroLensClutterHeadline:
        'Пять роликов подряд сливаются в фон. Выигрывает режиссура паузы.',
      heroManifestoLead: KOTO_LENS_MANIFESTO_PARAGRAPH,
      pricingEyebrow: 'Стоимость',
      pricingHeadingPrimary: 'Три пакета с фикс-ценой.',
      pricingHeadingMuted: 'Плюс индивидуальный разбор.',
      pricingSubheading:
        '100% предоплата по договору или банковской картой (ЭДО / СБП 54-ФЗ). Для срочных заказов от 1 часа и нестандартных задач доступен тариф с договорной ценой.',
      pricingRows: EDITORIAL_PRICING_ROWS.map((row) => ({ ...row })),
      faqEyebrow: 'Частые вопросы',
      faqHeading: 'Отвечаем до того, как вы спросите.',
      faqSubheading:
        'Без сложных терминов и мелкого шрифта — прозрачно про бюджет, эфирную модерацию и сроки.',
      faqItems: EDITORIAL_FAQ_ITEMS.map((item) => ({ ...item })),
    },
    testimonials: createDefaultTestimonialsCmsConfig(),
  };
}

/**
 * Проверяет тексты CMS на отсутствие запрещённых технических штампов и гео-привязок.
 */
export function auditEditorialCopyGuardrails(snapshot: StudioCmsSnapshot): string[] {
  const serialized = JSON.stringify({
    heroStage: snapshot.heroStage,
    flagshipReel: snapshot.flagshipReel,
    portfolioCases: snapshot.portfolioCases,
    duel: snapshot.duel,
    neuroApproach: snapshot.neuroApproach,
    siteCopy: snapshot.siteCopy,
    testimonials: snapshot.testimonials,
  }).toLowerCase();

  const found: string[] = [];
  for (const term of BANNED_EDITORIAL_TERMS) {
    if (serialized.includes(term)) {
      found.push(term);
    }
  }
  return found;
}

function asCleanString(val: unknown, fallback: string, maxLength = 2400): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

const LEGACY_UNSPLASH_TO_LOCAL_MAP: readonly [string, string][] = [
  ['photo-1598488035139-bdbb2231ce04', '/src/assets/images/hero_broadcast_booth_wide_1794605231279.jpg'],
  ['photo-1495474472287-4d71bcdd2085', '/src/assets/images/hero_artisan_bakery_taste_1794605229940.jpg'],
  ['photo-1509440159596-0249088772ff', '/src/assets/images/hero_artisan_bakery_taste_1794605229940.jpg'],
  ['photo-1545324418-cc1a3fa10c00', '/src/assets/images/case_estate_cinema_1794399406227.jpg'],
  ['photo-1600585154340-be6161a56a0c', '/src/assets/images/case_estate_cinema_1794399406227.jpg'],
  ['photo-1629909613654-28e377c37b09', '/src/assets/images/industry_medicine_clinic_1794514558724.jpg'],
  ['photo-1590602847861-f357a9332bbc', '/src/assets/images/approach_condenser_mic_portrait_1794605230714.jpg'],
  ['photo-1515694346937-94d85e41e6f0', '/src/assets/images/hero_grey_traffic_clutter_1794605229421.jpg'],
  ['photo-1515162816999-a0c47dc192f7', '/src/assets/images/hero_grey_traffic_clutter_1794605229421.jpg'],
];

function migrateLegacyExternalImageUrl(raw: unknown, fallbackLocalUrl: string): string {
  const cleaned = asCleanString(raw, fallbackLocalUrl, 1024);
  if (cleaned.includes('images.unsplash.com')) {
    for (const [unsplashToken, localAssetUrl] of LEGACY_UNSPLASH_TO_LOCAL_MAP) {
      if (cleaned.includes(unsplashToken)) {
        return localAssetUrl;
      }
    }
    return fallbackLocalUrl;
  }
  if (checkBannedForeignServiceUrl(cleaned).matched) {
    return fallbackLocalUrl;
  }
  return cleaned;
}

function asOptionalCleanString(
  val: unknown,
  maxLength = 1200
): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function sanitizeCaseSlug(rawId: unknown, fallbackId: string): string {
  if (typeof rawId !== 'string') return fallbackId;
  const normalized = rawId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized ? normalized.slice(0, 64) : fallbackId;
}

function normalizeCaseRecord(
  raw: unknown,
  fallback: PortfolioCaseRecord,
  indexFallback: number
): PortfolioCaseRecord {
  const obj =
    raw && typeof raw === 'object' ? (raw as Partial<PortfolioCaseRecord>) : {};

  const id = sanitizeCaseSlug(obj.id, fallback.id || `case-${indexFallback + 1}`);
  const audioUrl = asOptionalCleanString(obj.audioUrl, 1024);

  const rawDuration =
    typeof obj.durationSec === 'number' && Number.isFinite(obj.durationSec)
      ? Math.max(1, Math.min(600, obj.durationSec))
      : fallback.durationSec;

  const rawPreviewDur =
    typeof obj.previewDurationSec === 'number' && Number.isFinite(obj.previewDurationSec)
      ? Math.min(5, Math.max(3, Math.round(obj.previewDurationSec * 10) / 10))
      : fallback.previewDurationSec ?? DEFAULT_CASE_PREVIEW_DURATION_SEC;

  const hasExplicitClipBounds =
    typeof obj.clipStartSec === 'number' &&
    Number.isFinite(obj.clipStartSec) &&
    typeof obj.clipEndSec === 'number' &&
    Number.isFinite(obj.clipEndSec) &&
    obj.clipEndSec > obj.clipStartSec;

  const clipStartSec = hasExplicitClipBounds
    ? Math.max(0, Math.round(Number(obj.clipStartSec) * 100) / 100)
    : typeof obj.clipStartSec === 'number' && Number.isFinite(obj.clipStartSec)
      ? Math.max(0, Math.round(obj.clipStartSec * 100) / 100)
      : undefined;

  const clipEndSec = hasExplicitClipBounds
    ? Math.round(Number(obj.clipEndSec) * 100) / 100
    : undefined;

  const durationSec =
    clipStartSec !== undefined && clipEndSec !== undefined
      ? Math.max(1, Math.round(clipEndSec - clipStartSec))
      : Math.max(1, Math.round(rawDuration));

  const rawPreviewStart =
    typeof obj.previewStartSec === 'number' && Number.isFinite(obj.previewStartSec)
      ? Math.max(0, Math.round(obj.previewStartSec * 100) / 100)
      : clipStartSec ?? fallback.previewStartSec ?? 0;

  const validPersonaFocus: PortfolioPersonaFocus =
    obj.personaFocus === 'fmcg' ||
    obj.personaFocus === 'real_estate' ||
    obj.personaFocus === 'general'
      ? obj.personaFocus
      : fallback.personaFocus;

  return {
    id,
    client: asCleanString(obj.client, fallback.client, 140),
    tag: asCleanString(obj.tag, fallback.tag, 140),
    headline: asCleanString(obj.headline, fallback.headline, 240),
    summary: asCleanString(obj.summary, fallback.summary, 900),
    quoteImage: asCleanString(obj.quoteImage, fallback.quoteImage, 400),
    durationSec,
    audioUrl,
    clipStartSec,
    clipEndSec,
    previewStartSec: rawPreviewStart,
    previewDurationSec: Math.min(durationSec, rawPreviewDur),
    coverImageUrl: migrateLegacyExternalImageUrl(
      obj.coverImageUrl,
      fallback.coverImageUrl
    ),
    coverImageAlt: asCleanString(obj.coverImageAlt, fallback.coverImageAlt, 260),
    editorialSurfaceBg: asCleanString(
      obj.editorialSurfaceBg,
      fallback.editorialSurfaceBg,
      80
    ),
    posterGradientClass: asCleanString(
      obj.posterGradientClass,
      fallback.posterGradientClass,
      160
    ),
    posterGlowClass: asCleanString(
      obj.posterGlowClass,
      fallback.posterGlowClass,
      80
    ),
    published: typeof obj.published === 'boolean' ? obj.published : true,
    sortOrder:
      typeof obj.sortOrder === 'number' && Number.isFinite(obj.sortOrder)
        ? Math.round(obj.sortOrder)
        : indexFallback + 1,
    personaFocus: validPersonaFocus,
    customAudioFileName: asOptionalCleanString(obj.customAudioFileName, 200),
  };
}

function normalizeDuelPhrases(
  rawPhrases: unknown,
  fallback: DuelTranscriptPhrase[]
): DuelTranscriptPhrase[] {
  if (!Array.isArray(rawPhrases) || rawPhrases.length === 0) {
    return fallback.map((p) => ({ ...p }));
  }

  const cleaned: DuelTranscriptPhrase[] = [];
  for (const entry of rawPhrases.slice(0, 24)) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Partial<DuelTranscriptPhrase>;
    const text = typeof item.text === 'string' ? item.text.trim().slice(0, 320) : '';
    if (!text) continue;
    const startSec =
      typeof item.startSec === 'number' && Number.isFinite(item.startSec)
        ? Math.max(0, Math.round(item.startSec * 100) / 100)
        : 0;
    const endSec =
      typeof item.endSec === 'number' && Number.isFinite(item.endSec)
        ? Math.max(startSec + 0.2, Math.round(item.endSec * 100) / 100)
        : startSec + 2.5;

    cleaned.push({
      startSec,
      endSec,
      text,
      isAccent: Boolean(item.isAccent),
    });
  }

  return cleaned.length > 0 ? cleaned : fallback.map((p) => ({ ...p }));
}

function normalizeDuelSpot(
  rawSpot: unknown,
  fallback: DuelCmsSpotSpec
): DuelCmsSpotSpec {
  const obj =
    rawSpot && typeof rawSpot === 'object' ? (rawSpot as Partial<DuelCmsSpotSpec>) : {};

  const durationSec =
    typeof obj.durationSec === 'number' && Number.isFinite(obj.durationSec)
      ? Math.max(1, Math.min(180, Math.round(obj.durationSec)))
      : fallback.durationSec;

  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const computedLabel = `${mins}:${String(secs).padStart(2, '0')}`;

  return {
    id: fallback.id,
    badge: asCleanString(obj.badge, fallback.badge, 120),
    title: asCleanString(obj.title, fallback.title, 200),
    durationSec,
    durationLabel: computedLabel,
    metricsLine: asCleanString(obj.metricsLine, fallback.metricsLine, 260),
    verdict: asCleanString(obj.verdict, fallback.verdict, 600),
    phrases: normalizeDuelPhrases(obj.phrases, fallback.phrases),
    audioUrl: asOptionalCleanString(obj.audioUrl, 1024),
    audioFileName: asOptionalCleanString(obj.audioFileName, 200),
  };
}

/**
 * Валидирует и нормализует входящий JSON-снимок CMS перед сохранением на диск или импортом.
 */
export function validateAndNormalizeCmsSnapshot(
  input: unknown
):
  | { ok: true; data: StudioCmsSnapshot; editorialWarnings: string[] }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Некорректный формат данных CMS' };
  }

  const defaults = createDefaultStudioCmsSnapshot();
  const raw = input as Partial<StudioCmsSnapshot>;

  const flagshipReel = normalizeCaseRecord(
    raw.flagshipReel,
    defaults.flagshipReel,
    0
  );

  let portfolioCases: PortfolioCaseRecord[];
  if (Array.isArray(raw.portfolioCases) && raw.portfolioCases.length > 0) {
    const seenIds = new Set<string>([flagshipReel.id]);
    portfolioCases = raw.portfolioCases.slice(0, 30).map((item, idx) => {
      const baseFallback =
        defaults.portfolioCases[idx % defaults.portfolioCases.length] ??
        defaults.portfolioCases[0];
      const normalized = normalizeCaseRecord(item, baseFallback, idx);
      let uniqueId = normalized.id;
      if (seenIds.has(uniqueId)) {
        uniqueId = `${uniqueId}-${idx + 1}`;
      }
      seenIds.add(uniqueId);
      return { ...normalized, id: uniqueId, sortOrder: idx + 1 };
    });
  } else {
    portfolioCases = defaults.portfolioCases;
  }

  if (portfolioCases.every((c) => !c.published)) {
    return {
      ok: false,
      error: 'В портфолио должен оставаться хотя бы один опубликованный кейс',
    };
  }

  const rawDuel = raw.duel && typeof raw.duel === 'object' ? raw.duel : defaults.duel;
  const duel: DuelCmsConfig = {
    sectionEyebrow: asCleanString(
      rawDuel.sectionEyebrow,
      defaults.duel.sectionEyebrow,
      140
    ),
    headingPrimary: asCleanString(
      rawDuel.headingPrimary,
      defaults.duel.headingPrimary,
      180
    ),
    headingMuted: asCleanString(
      rawDuel.headingMuted,
      defaults.duel.headingMuted,
      180
    ),
    clientName: asCleanString(rawDuel.clientName, defaults.duel.clientName, 140),
    briefSummary: asCleanString(rawDuel.briefSummary, defaults.duel.briefSummary, 500),
    radioSpot: normalizeDuelSpot(rawDuel.radioSpot, defaults.duel.radioSpot),
    audioworksSpot: normalizeDuelSpot(
      rawDuel.audioworksSpot,
      defaults.duel.audioworksSpot
    ),
  };

  const rawNeuro =
    raw.neuroApproach && typeof raw.neuroApproach === 'object'
      ? raw.neuroApproach
      : defaults.neuroApproach;

  const studies: NeuroStudyProofCard[] =
    Array.isArray(rawNeuro.studies) && rawNeuro.studies.length > 0
      ? rawNeuro.studies.slice(0, 4).map((st, idx) => {
          const fb =
            defaults.neuroApproach.studies[idx] ?? defaults.neuroApproach.studies[0];
          const sObj =
            st && typeof st === 'object' ? (st as Partial<NeuroStudyProofCard>) : {};
          return {
            id: sanitizeCaseSlug(sObj.id, fb.id || `study-${idx + 1}`),
            sourceLabel: asCleanString(sObj.sourceLabel, fb.sourceLabel, 180),
            metricValue: asCleanString(sObj.metricValue, fb.metricValue, 32),
            metricCaption: asCleanString(sObj.metricCaption, fb.metricCaption, 180),
            secondaryStat: asCleanString(sObj.secondaryStat, fb.secondaryStat, 220),
            summary: asCleanString(sObj.summary, fb.summary, 600),
          };
        })
      : defaults.neuroApproach.studies;

  const pillars: ApproachPillar[] =
    Array.isArray(rawNeuro.pillars) && rawNeuro.pillars.length > 0
      ? rawNeuro.pillars.slice(0, 6).map((pil, idx) => {
          const fb =
            defaults.neuroApproach.pillars[idx] ?? defaults.neuroApproach.pillars[0];
          const pObj =
            pil && typeof pil === 'object' ? (pil as Partial<ApproachPillar>) : {};
          return {
            number: String(idx + 1).padStart(2, '0'),
            title: asCleanString(pObj.title, fb.title, 160),
            body: asCleanString(pObj.body, fb.body, 520),
          };
        })
      : defaults.neuroApproach.pillars;

  const neuroApproach: NeuroApproachConfig = {
    eyebrow: asCleanString(rawNeuro.eyebrow, defaults.neuroApproach.eyebrow, 140),
    thesis: asCleanString(rawNeuro.thesis, defaults.neuroApproach.thesis, 380),
    leadParagraph: asCleanString(
      rawNeuro.leadParagraph,
      defaults.neuroApproach.leadParagraph,
      700
    ),
    studies,
    pillars,
    studioPhotoUrl: migrateLegacyExternalImageUrl(
      rawNeuro.studioPhotoUrl,
      defaults.neuroApproach.studioPhotoUrl
    ),
    studioPhotoAlt: asCleanString(
      rawNeuro.studioPhotoAlt,
      defaults.neuroApproach.studioPhotoAlt,
      260
    ),
    studioPhotoKicker: asCleanString(
      rawNeuro.studioPhotoKicker,
      defaults.neuroApproach.studioPhotoKicker,
      120
    ),
    studioPhotoCaption: asCleanString(
      rawNeuro.studioPhotoCaption,
      defaults.neuroApproach.studioPhotoCaption,
      260
    ),
  };

  const rawCopy =
    raw.siteCopy && typeof raw.siteCopy === 'object'
      ? raw.siteCopy
      : defaults.siteCopy;

  const allowedTierIds: readonly RecommendedTier[] = ['voice_style', 'turnkey', 'cinema'];
  const pricingRows: EditorialPricingRow[] = defaults.siteCopy.pricingRows.map(
    (fbRow, idx) => {
      const candidate = Array.isArray(rawCopy.pricingRows)
        ? (rawCopy.pricingRows.find((r) => r?.id === fbRow.id) ??
          rawCopy.pricingRows[idx])
        : undefined;
      const rObj =
        candidate && typeof candidate === 'object'
          ? (candidate as Partial<EditorialPricingRow>)
          : {};
      const tierId = allowedTierIds.includes(rObj.id as RecommendedTier)
        ? (rObj.id as RecommendedTier)
        : fbRow.id;
      const priceRub =
        typeof rObj.priceRub === 'number' && Number.isFinite(rObj.priceRub)
          ? Math.max(1000, Math.min(5000000, Math.round(rObj.priceRub)))
          : fbRow.priceRub;

      return {
        id: tierId,
        title: asCleanString(rObj.title, fbRow.title, 120),
        badgeHit: asOptionalCleanString(rObj.badgeHit, 80),
        description: asCleanString(rObj.description, fbRow.description, 600),
        priceRub,
        priceFormatted: formatPriceRub(priceRub),
        turnaround: asCleanString(rObj.turnaround, fbRow.turnaround, 80),
      };
    }
  );

  const faqItems: FaqItem[] =
    Array.isArray(rawCopy.faqItems) && rawCopy.faqItems.length > 0
      ? rawCopy.faqItems.slice(0, 16).map((fq, idx) => {
          const fb =
            defaults.siteCopy.faqItems[idx] ?? defaults.siteCopy.faqItems[0];
          const fObj = fq && typeof fq === 'object' ? (fq as Partial<FaqItem>) : {};
          return {
            id: sanitizeCaseSlug(fObj.id, `faq-${idx + 1}`),
            indexLabel: String(idx + 1).padStart(2, '0'),
            question: asCleanString(fObj.question, fb.question, 320),
            answer: asCleanString(fObj.answer, fb.answer, 1600),
          };
        })
      : defaults.siteCopy.faqItems;

  const siteCopy: SiteCopyCmsConfig = {
    heroLensClutterKicker: asCleanString(
      rawCopy.heroLensClutterKicker,
      defaults.siteCopy.heroLensClutterKicker,
      160
    ),
    heroLensClutterHeadline: asCleanString(
      rawCopy.heroLensClutterHeadline,
      defaults.siteCopy.heroLensClutterHeadline,
      260
    ),
    heroManifestoLead: asCleanString(
      rawCopy.heroManifestoLead,
      defaults.siteCopy.heroManifestoLead,
      900
    ),
    pricingEyebrow: asCleanString(
      rawCopy.pricingEyebrow,
      defaults.siteCopy.pricingEyebrow,
      120
    ),
    pricingHeadingPrimary: asCleanString(
      rawCopy.pricingHeadingPrimary,
      defaults.siteCopy.pricingHeadingPrimary,
      160
    ),
    pricingHeadingMuted: asCleanString(
      rawCopy.pricingHeadingMuted,
      defaults.siteCopy.pricingHeadingMuted,
      160
    ),
    pricingSubheading: asCleanString(
      rawCopy.pricingSubheading,
      defaults.siteCopy.pricingSubheading,
      400
    ),
    pricingRows,
    faqEyebrow: asCleanString(rawCopy.faqEyebrow, defaults.siteCopy.faqEyebrow, 120),
    faqHeading: asCleanString(rawCopy.faqHeading, defaults.siteCopy.faqHeading, 180),
    faqSubheading: asCleanString(
      rawCopy.faqSubheading,
      defaults.siteCopy.faqSubheading,
      400
    ),
    faqItems,
  };

  const heroStage = normalizeHeroStageCmsConfig(raw.heroStage);
  const testimonialsResult = normalizeTestimonialsCmsConfig(raw.testimonials);
  if (!testimonialsResult.ok) {
    return {
      ok: false,
      error: testimonialsResult.error,
    };
  }

  const normalizedSnapshot: StudioCmsSnapshot = {
    schemaVersion: 1,
    updatedAt:
      typeof raw.updatedAt === 'string' && raw.updatedAt.trim()
        ? raw.updatedAt.trim()
        : new Date().toISOString(),
    heroStage,
    flagshipReel,
    portfolioCases,
    duel,
    neuroApproach,
    siteCopy,
    testimonials: testimonialsResult.data,
  };

  const editorialWarnings = auditEditorialCopyGuardrails(normalizedSnapshot);
  return {
    ok: true,
    data: normalizedSnapshot,
    editorialWarnings,
  };
}
