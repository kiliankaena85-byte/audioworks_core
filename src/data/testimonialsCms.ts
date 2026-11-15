import type { LayaPersona } from '../engine/layaTypes.ts';
import { checkBannedForeignServiceUrl } from '../security/rfLegalCompliance.ts';
import type { PortfolioCaseRecord, StudioCmsSnapshot } from './studioCmsTypes.ts';
import {
  CLIENT_TESTIMONIALS,
  TESTIMONIAL_FILTERS,
  type TestimonialCategory,
} from './testimonialsData.ts';

export type TestimonialIndustryKey = Exclude<TestimonialCategory, 'all'>;

export interface TestimonialTrustMetric {
  id: string;
  value: string;
  label: string;
}

export interface ClientTestimonialCmsRecord {
  id: string;
  published: boolean;
  sortOrder: number;
  authorName: string;
  initials: string;
  authorRole: string;
  company: string;
  category: TestimonialIndustryKey;
  /** Спокойная необрамлённая строка формата проекта через разделитель · */
  projectMeta: string;
  /** Подтверждение достоверности (ЭДО, эфирные паспорта, серия флайтов) */
  verifiedProvenance: string;
  quote: string;
  /** Конкретный измеримый результат с единицами измерения */
  outcomeMetric: string;
  outcomeContext: string;
  /** Опциональная привязка к аудио-кейсу StudioCMS для прослушивания прямо из отзыва */
  linkedCaseId?: string;
  /** Внутренняя ссылка на кейс (#case-..., #duel или /cases/...) */
  relatedHref: string;
  relatedLabel: string;
}

export interface TestimonialsCmsConfig {
  eyebrow: string;
  headingPrimary: string;
  headingMuted: string;
  subheading: string;
  trustMetrics: TestimonialTrustMetric[];
  ctaPrompt: string;
  ctaButtonLabel: string;
  items: ClientTestimonialCmsRecord[];
}

const VALID_TESTIMONIAL_CATEGORIES: readonly TestimonialIndustryKey[] = [
  'fmcg',
  'real_estate',
  'medical',
  'fast_launch',
];

const DEFAULT_PROVENANCE_BY_ID: Record<string, string> = {
  'dmitrogorsky-fmcg': 'Закрывающий акт в ЭДО · паспорта РАО/ВОИС',
  'forma-estate': 'Подтверждено отделом продаж · договор ЭДО',
  'zerno-fast-launch': 'Эфирный мастер 24 ч · прямое A/B сравнение',
  'veramed-clinics': 'Серия из 3 сезонных флайтов · пакет ЭДО',
};

const DEFAULT_LINKED_CASE_BY_ID: Record<string, string | undefined> = {
  'dmitrogorsky-fmcg': 'dmitrogorsky',
  'forma-estate': 'business-estate',
  'zerno-fast-launch': undefined,
  'veramed-clinics': 'medical-clinics',
};

const DEFAULT_TRUST_METRICS: readonly TestimonialTrustMetric[] = [
  {
    id: 'first-pass-moderation',
    value: '98%',
    label: 'согласований эфирной и юридической службы радиосетей с первой подачи',
  },
  {
    id: 'master-turnaround',
    value: '24–48 ч',
    label: 'выпуск готового эфирного мастера после утверждения задачи по договору',
  },
  {
    id: 'clean-rights-edo',
    value: '100% ЭДО',
    label: 'передача исключительных прав и паспорта музыки без дополнительных роялти',
  },
];

/**
 * Формирует 1–2 аккуратных заглавных инициала спикера из полного имени.
 */
export function deriveAuthorInitials(authorName: string): string {
  const words = (authorName || '')
    .trim()
    .replace(/[«»"'()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'КЛ';
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
}

function asCleanText(val: unknown, fallback: string, maxLength = 1200): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function sanitizeSlug(rawId: unknown, fallbackId: string): string {
  if (typeof rawId !== 'string') return fallbackId;
  const normalized = rawId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized ? normalized.slice(0, 64) : fallbackId;
}

function sanitizeInternalHref(rawHref: unknown, fallbackHref: string): string {
  if (typeof rawHref !== 'string') return fallbackHref;
  const trimmed = rawHref.trim().slice(0, 240);
  if (!trimmed) return fallbackHref;
  if (checkBannedForeignServiceUrl(trimmed).matched) {
    return fallbackHref;
  }
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) {
    return trimmed;
  }
  return fallbackHref;
}

function inferLinkedCaseIdFromHref(href: string): string | undefined {
  const trimmed = href.trim();
  if (trimmed.startsWith('#case-')) {
    const slug = trimmed.slice('#case-'.length).trim();
    return slug || undefined;
  }
  if (trimmed.startsWith('/cases/')) {
    const slug = trimmed.slice('/cases/'.length).split(/[?#]/)[0]?.trim();
    return slug || undefined;
  }
  return undefined;
}

/**
 * Создаёт заводскую конфигурацию раздела «Отзывы клиентов» для StudioCMS.
 */
export function createDefaultTestimonialsCmsConfig(): TestimonialsCmsConfig {
  return {
    eyebrow: 'Отзывы клиентов',
    headingPrimary: 'Что говорят бренды',
    headingMuted: 'после выхода в эфир.',
    subheading:
      'Директора по маркетингу и основатели компаний — о том, как меняется отклик аудитории и скорость согласования роликов.',
    trustMetrics: DEFAULT_TRUST_METRICS.map((metric) => ({ ...metric })),
    ctaPrompt:
      'Нужен такой же спокойный выпуск ролика в эфир с первой подачи и по ЭДО?',
    ctaButtonLabel: 'Надиктовать задачу за 30 секунд',
    items: CLIENT_TESTIMONIALS.map((item, idx) => ({
      id: item.id,
      published: true,
      sortOrder: idx + 1,
      authorName: item.authorName,
      initials: item.initials || deriveAuthorInitials(item.authorName),
      authorRole: item.authorRole,
      company: item.company,
      category: item.category,
      projectMeta: item.projectMeta,
      verifiedProvenance:
        DEFAULT_PROVENANCE_BY_ID[item.id] ?? 'Проверенный проект по ЭДО',
      quote: item.quote,
      outcomeMetric: item.outcomeMetric,
      outcomeContext: item.outcomeContext,
      linkedCaseId: DEFAULT_LINKED_CASE_BY_ID[item.id],
      relatedHref: item.relatedHref,
      relatedLabel: item.relatedLabel,
    })),
  };
}

function normalizeTestimonialItem(
  raw: unknown,
  fallback: ClientTestimonialCmsRecord,
  indexFallback: number
): ClientTestimonialCmsRecord {
  const obj =
    raw && typeof raw === 'object'
      ? (raw as Partial<ClientTestimonialCmsRecord>)
      : {};

  const id = sanitizeSlug(obj.id, fallback.id || `review-${indexFallback + 1}`);
  const authorName = asCleanText(obj.authorName, fallback.authorName, 120);
  const rawInitials =
    typeof obj.initials === 'string' ? obj.initials.trim().slice(0, 4) : '';
  const initials = rawInitials
    ? rawInitials.toUpperCase()
    : deriveAuthorInitials(authorName);

  const category: TestimonialIndustryKey = VALID_TESTIMONIAL_CATEGORIES.includes(
    obj.category as TestimonialIndustryKey
  )
    ? (obj.category as TestimonialIndustryKey)
    : fallback.category;

  const relatedHref = sanitizeInternalHref(obj.relatedHref, fallback.relatedHref);
  const explicitLinkedCase =
    typeof obj.linkedCaseId === 'string' && obj.linkedCaseId.trim()
      ? sanitizeSlug(obj.linkedCaseId, '')
      : undefined;
  const linkedCaseId =
    explicitLinkedCase ||
    (obj.linkedCaseId === '' ? undefined : inferLinkedCaseIdFromHref(relatedHref));

  return {
    id,
    published: typeof obj.published === 'boolean' ? obj.published : true,
    sortOrder:
      typeof obj.sortOrder === 'number' && Number.isFinite(obj.sortOrder)
        ? Math.round(obj.sortOrder)
        : indexFallback + 1,
    authorName,
    initials,
    authorRole: asCleanText(obj.authorRole, fallback.authorRole, 140),
    company: asCleanText(obj.company, fallback.company, 160),
    category,
    projectMeta: asCleanText(obj.projectMeta, fallback.projectMeta, 180),
    verifiedProvenance: asCleanText(
      obj.verifiedProvenance,
      fallback.verifiedProvenance,
      180
    ),
    quote: asCleanText(obj.quote, fallback.quote, 1400),
    outcomeMetric: asCleanText(obj.outcomeMetric, fallback.outcomeMetric, 120),
    outcomeContext: asCleanText(obj.outcomeContext, fallback.outcomeContext, 280),
    linkedCaseId: linkedCaseId || undefined,
    relatedHref,
    relatedLabel: asCleanText(obj.relatedLabel, fallback.relatedLabel, 120),
  };
}

/**
 * Нормализует конфигурацию отзывов StudioCMS с обратной совместимостью для ранних снимков без поля `testimonials`.
 */
export function normalizeTestimonialsCmsConfig(
  raw: unknown
):
  | { ok: true; data: TestimonialsCmsConfig }
  | { ok: false; error: string } {
  const defaults = createDefaultTestimonialsCmsConfig();

  if (raw === undefined || raw === null) {
    return { ok: true, data: defaults };
  }

  if (typeof raw !== 'object') {
    return { ok: false, error: 'Некорректный формат блока отзывов StudioCMS' };
  }

  const candidate = raw as Partial<TestimonialsCmsConfig>;

  if (Array.isArray(candidate.items) && candidate.items.length === 0) {
    return {
      ok: false,
      error: 'В разделе отзывов должен быть хотя бы один отзыв клиента',
    };
  }

  let items: ClientTestimonialCmsRecord[];
  if (Array.isArray(candidate.items) && candidate.items.length > 0) {
    const seenIds = new Set<string>();
    items = candidate.items.slice(0, 24).map((entry, idx) => {
      const baseFallback =
        defaults.items[idx % defaults.items.length] ?? defaults.items[0];
      const normalized = normalizeTestimonialItem(entry, baseFallback, idx);
      let uniqueId = normalized.id;
      if (seenIds.has(uniqueId)) {
        uniqueId = `${uniqueId}-${idx + 1}`;
      }
      seenIds.add(uniqueId);
      return {
        ...normalized,
        id: uniqueId,
        sortOrder: idx + 1,
      };
    });
  } else {
    items = defaults.items;
  }

  if (items.every((item) => !item.published)) {
    return {
      ok: false,
      error: 'В разделе отзывов должен оставаться хотя бы один опубликованный отзыв',
    };
  }

  const trustMetrics: TestimonialTrustMetric[] =
    Array.isArray(candidate.trustMetrics) && candidate.trustMetrics.length > 0
      ? candidate.trustMetrics.slice(0, 4).map((metric, idx) => {
          const fb =
            defaults.trustMetrics[idx % defaults.trustMetrics.length] ??
            defaults.trustMetrics[0];
          const mObj =
            metric && typeof metric === 'object'
              ? (metric as Partial<TestimonialTrustMetric>)
              : {};
          return {
            id: sanitizeSlug(mObj.id, fb.id || `trust-metric-${idx + 1}`),
            value: asCleanText(mObj.value, fb.value, 40),
            label: asCleanText(mObj.label, fb.label, 220),
          };
        })
      : defaults.trustMetrics;

  return {
    ok: true,
    data: {
      eyebrow: asCleanText(candidate.eyebrow, defaults.eyebrow, 120),
      headingPrimary: asCleanText(
        candidate.headingPrimary,
        defaults.headingPrimary,
        160
      ),
      headingMuted: asCleanText(candidate.headingMuted, defaults.headingMuted, 160),
      subheading: asCleanText(candidate.subheading, defaults.subheading, 420),
      trustMetrics,
      ctaPrompt: asCleanText(candidate.ctaPrompt, defaults.ctaPrompt, 260),
      ctaButtonLabel: asCleanText(
        candidate.ctaButtonLabel,
        defaults.ctaButtonLabel,
        90
      ),
      items,
    },
  };
}

/**
 * Возвращает опубликованные отзывы из StudioCMS с учётом выбранного отраслевого фильтра и активного профиля Laya AI.
 */
export function getPublishedCmsTestimonialsForFilterAndPersona(
  config: TestimonialsCmsConfig,
  filter: TestimonialCategory,
  persona: LayaPersona
): ClientTestimonialCmsRecord[] {
  const published = config.items
    .filter((item) => item.published !== false)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (filter !== 'all') {
    return published.filter((item) => item.category === filter);
  }

  let priorityCategory: TestimonialIndustryKey | null = null;
  if (persona === 'real_estate') {
    priorityCategory = 'real_estate';
  } else if (persona === 'fmcg') {
    priorityCategory = 'fmcg';
  } else if (persona === 'price_searcher' || persona === 'returning_vip') {
    priorityCategory = 'fast_launch';
  }

  if (!priorityCategory) {
    return published;
  }

  const prioritized = published.filter((item) => item.category === priorityCategory);
  const rest = published.filter((item) => item.category !== priorityCategory);
  return [...prioritized, ...rest];
}

/**
 * Считает количество опубликованных отзывов по каждой вкладке фильтра.
 */
export function computeTestimonialFilterCounts(
  config: TestimonialsCmsConfig
): Record<TestimonialCategory, number> {
  const published = config.items.filter((item) => item.published !== false);
  const counts: Record<TestimonialCategory, number> = {
    all: published.length,
    fmcg: 0,
    real_estate: 0,
    medical: 0,
    fast_launch: 0,
  };

  for (const item of published) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }

  return counts;
}

/**
 * Находит связанный опубликованный аудио-кейс из портфолио StudioCMS для прямого прослушивания спота из карточки отзыва.
 */
export function resolveTestimonialLinkedCase(
  item: ClientTestimonialCmsRecord,
  portfolioCases: readonly PortfolioCaseRecord[],
  flagshipReel?: PortfolioCaseRecord
): PortfolioCaseRecord | null {
  const targetSlug =
    item.linkedCaseId?.trim() || inferLinkedCaseIdFromHref(item.relatedHref);
  if (!targetSlug) return null;

  if (flagshipReel && flagshipReel.published !== false && flagshipReel.id === targetSlug) {
    return flagshipReel;
  }

  const matched = portfolioCases.find(
    (c) => c.published !== false && c.id === targetSlug
  );
  return matched ?? null;
}

/**
 * Создаёт новый черновик отзыва для добавления в StudioCMS.
 */
export function createNewCmsTestimonialRecord(
  existingItems: readonly ClientTestimonialCmsRecord[]
): ClientTestimonialCmsRecord {
  const nextOrder = existingItems.length + 1;
  const uniqueSuffix = Date.now().toString(36).slice(-5);
  return {
    id: `client-review-${uniqueSuffix}`,
    published: true,
    sortOrder: nextOrder,
    authorName: 'Дмитрий Волков',
    initials: 'ДВ',
    authorRole: 'Директор по маркетингу',
    company: 'ГК «ТехноЛизинг»',
    category: 'fmcg',
    projectMeta: 'B2B и лизинг · Игровой ролик под ключ · 20 сек',
    verifiedProvenance: 'Закрывающий акт в ЭДО · паспорт РАО/ВОИС',
    quote:
      'Передали задачу голосовым сообщением без длинного брифа. Команда предложила точную драматургическую паузу, записала двух дикторов и подготовила юридическую сноску так, что ролик приняли в эфир с первой отправки.',
    outcomeMetric: 'Согласование с 1-й подачи',
    outcomeContext: 'Полный комплект мастер-файлов и документов ЭДО за 48 часов',
    linkedCaseId: undefined,
    relatedHref: '#work',
    relatedLabel: 'Слушать работы в портфолио',
  };
}

/**
 * Меняет порядок карточек отзывов вверх или вниз и пересчитывает `sortOrder`.
 */
export function reorderCmsTestimonials(
  items: readonly ClientTestimonialCmsRecord[],
  index: number,
  direction: 'up' | 'down'
): ClientTestimonialCmsRecord[] {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (
    index < 0 ||
    index >= items.length ||
    targetIndex < 0 ||
    targetIndex >= items.length
  ) {
    return items.map((item, idx) => ({ ...item, sortOrder: idx + 1 }));
  }

  const next = items.slice();
  const [moved] = next.splice(index, 1);
  next.splice(targetIndex, 0, moved);
  return next.map((item, idx) => ({
    ...item,
    sortOrder: idx + 1,
  }));
}

/**
 * Подсчитывает количество локальных несохранённых изменений в разделе «Отзывы клиентов» относительно эталонного снимка.
 */
export function countLocalTestimonialsChanges(
  current: Pick<StudioCmsSnapshot, 'testimonials'>,
  baseline: Pick<StudioCmsSnapshot, 'testimonials'>
): number {
  let changes = 0;

  const headerChanged =
    current.testimonials.eyebrow !== baseline.testimonials.eyebrow ||
    current.testimonials.headingPrimary !== baseline.testimonials.headingPrimary ||
    current.testimonials.headingMuted !== baseline.testimonials.headingMuted ||
    current.testimonials.subheading !== baseline.testimonials.subheading ||
    current.testimonials.ctaPrompt !== baseline.testimonials.ctaPrompt ||
    current.testimonials.ctaButtonLabel !== baseline.testimonials.ctaButtonLabel ||
    JSON.stringify(current.testimonials.trustMetrics) !==
      JSON.stringify(baseline.testimonials.trustMetrics);

  if (headerChanged) {
    changes += 1;
  }

  const baselineById = new Map(
    baseline.testimonials.items.map((item) => [item.id, item])
  );
  const currentIds = new Set(current.testimonials.items.map((item) => item.id));

  for (const item of current.testimonials.items) {
    const baseItem = baselineById.get(item.id);
    if (!baseItem || JSON.stringify(item) !== JSON.stringify(baseItem)) {
      changes += 1;
    }
  }

  for (const baseItem of baseline.testimonials.items) {
    if (!currentIds.has(baseItem.id)) {
      changes += 1;
    }
  }

  return changes;
}

export { TESTIMONIAL_FILTERS, type TestimonialCategory };
