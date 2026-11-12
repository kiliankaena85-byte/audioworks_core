import { KOTO_LENS_MANIFESTO_PARAGRAPH } from './audioworksCommercial';
import {
  APPROACH_LEAD_PARAGRAPH,
  APPROACH_PILLARS,
  APPROACH_THESIS,
} from './casesData';
import { EDITORIAL_PRICING_ROWS } from './pricingData';

export type SiteTextSectionId = 'hero' | 'approach' | 'pricing';

export type SiteTextBlockId =
  | 'hero-stage'
  | 'hero-manifesto'
  | 'approach-lead'
  | 'approach-pillar-01'
  | 'approach-pillar-02'
  | 'approach-pillar-03'
  | 'pricing-header'
  | 'pricing-tier-voice'
  | 'pricing-tier-turnkey'
  | 'pricing-tier-cinema';

export interface SiteTextBlock {
  id: SiteTextBlockId;
  section: SiteTextSectionId;
  sectionLabel: string;
  blockLabel: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  description: string;
}

export const SITE_TEXT_SECTION_TABS: readonly {
  id: 'all' | SiteTextSectionId;
  label: string;
}[] = [
  { id: 'all', label: 'Все секции' },
  { id: 'hero', label: 'Hero · Первый экран' },
  { id: 'approach', label: 'Approach · Подход и ЦНС' },
  { id: 'pricing', label: 'Pricing · Стоимость' },
] as const;

/**
 * Статичный эталонный массив ключевых текстовых блоков сайта
 * для секций Hero, Approach и Pricing.
 */
export const STATIC_SITE_TEXT_BLOCKS: readonly SiteTextBlock[] = [
  {
    id: 'hero-stage',
    section: 'hero',
    sectionLabel: 'Hero · Интерактивная сцена',
    blockLabel: 'Сцена эфирного краш-теста',
    eyebrow: 'Краш-тест в реальном рекламном блоке',
    title: 'Пять роликов подряд сливаются в фон. Выигрывает режиссура паузы.',
    description: 'Обычный рекламный блок · наведите курсор',
  },
  {
    id: 'hero-manifesto',
    section: 'hero',
    sectionLabel: 'Hero · Манифест студии',
    blockLabel: 'Главный заголовок H1 и манифест',
    title: 'Мы FMWorks.',
    subtitle: 'Аудиореклама, которая работает.',
    description: KOTO_LENS_MANIFESTO_PARAGRAPH,
  },
  {
    id: 'approach-lead',
    section: 'approach',
    sectionLabel: 'Approach · Главный тезис',
    blockLabel: 'Тезис про аудиторию и фильтр внимания ЦНС',
    eyebrow: 'Почему продакшн, а не просто озвучка',
    title: APPROACH_THESIS,
    description: APPROACH_LEAD_PARAGRAPH,
  },
  {
    id: 'approach-pillar-01',
    section: 'approach',
    sectionLabel: 'Approach · Принцип 01',
    blockLabel: 'Принцип 01 · Драматургия и пауза',
    eyebrow: APPROACH_PILLARS[0].number,
    title: APPROACH_PILLARS[0].title,
    description: APPROACH_PILLARS[0].body,
  },
  {
    id: 'approach-pillar-02',
    section: 'approach',
    sectionLabel: 'Approach · Принцип 02',
    blockLabel: 'Принцип 02 · Голоса кино и дубляжа',
    eyebrow: APPROACH_PILLARS[1].number,
    title: APPROACH_PILLARS[1].title,
    description: APPROACH_PILLARS[1].body,
  },
  {
    id: 'approach-pillar-03',
    section: 'approach',
    sectionLabel: 'Approach · Принцип 03',
    blockLabel: 'Принцип 03 · Юридическая чистота и ЭДО',
    eyebrow: APPROACH_PILLARS[2].number,
    title: APPROACH_PILLARS[2].title,
    description: APPROACH_PILLARS[2].body,
  },
  {
    id: 'pricing-header',
    section: 'pricing',
    sectionLabel: 'Pricing · Заголовок секции',
    blockLabel: 'Шапка раздела стоимости и условий',
    eyebrow: 'Стоимость',
    title: 'Три формата работы.',
    subtitle: 'Фиксированная смета.',
    description:
      'Работаем по договору и ЭДО. Все исключительные права сразу переходят вам.',
  },
  {
    id: 'pricing-tier-voice',
    section: 'pricing',
    sectionLabel: 'Pricing · Тариф 15 000 ₽',
    blockLabel: 'Формат 01 · Голос и стиль',
    title: EDITORIAL_PRICING_ROWS[0].title,
    description: EDITORIAL_PRICING_ROWS[0].description,
  },
  {
    id: 'pricing-tier-turnkey',
    section: 'pricing',
    sectionLabel: 'Pricing · Тариф 25 000 ₽',
    blockLabel: 'Формат 02 · Продакшн под ключ',
    title: EDITORIAL_PRICING_ROWS[1].title,
    description: EDITORIAL_PRICING_ROWS[1].description,
  },
  {
    id: 'pricing-tier-cinema',
    section: 'pricing',
    sectionLabel: 'Pricing · Тариф 35 000 ₽',
    blockLabel: 'Формат 03 · Игровой ролик / Мини-кино',
    title: EDITORIAL_PRICING_ROWS[2].title,
    description: EDITORIAL_PRICING_ROWS[2].description,
  },
] as const;

export interface SiteTextBlockEditablePatch {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  description?: string;
}

export function cloneInitialSiteTextBlocks(): SiteTextBlock[] {
  return STATIC_SITE_TEXT_BLOCKS.map((block) => ({ ...block }));
}

export function getInitialSiteTextBlockById(id: SiteTextBlockId): SiteTextBlock {
  const found = STATIC_SITE_TEXT_BLOCKS.find((item) => item.id === id);
  return found ? { ...found } : { ...STATIC_SITE_TEXT_BLOCKS[0] };
}

export function getSiteTextBlockById(
  blocks: readonly SiteTextBlock[],
  id: SiteTextBlockId
): SiteTextBlock {
  return (
    blocks.find((item) => item.id === id) ?? getInitialSiteTextBlockById(id)
  );
}

export function updateSiteTextBlockInList(
  blocks: readonly SiteTextBlock[],
  id: SiteTextBlockId,
  patch: SiteTextBlockEditablePatch
): SiteTextBlock[] {
  return blocks.map((block) => {
    if (block.id !== id) return block;
    return {
      ...block,
      ...(patch.eyebrow !== undefined ? { eyebrow: patch.eyebrow } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.subtitle !== undefined ? { subtitle: patch.subtitle } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description }
        : {}),
    };
  });
}

export function resetSiteTextBlockInList(
  blocks: readonly SiteTextBlock[],
  id: SiteTextBlockId
): SiteTextBlock[] {
  const baseline = getInitialSiteTextBlockById(id);
  return blocks.map((block) => (block.id === id ? baseline : block));
}

export function isSiteTextBlockModified(block: SiteTextBlock): boolean {
  const baseline = STATIC_SITE_TEXT_BLOCKS.find((b) => b.id === block.id);
  if (!baseline) return false;
  return (
    (block.eyebrow ?? '') !== (baseline.eyebrow ?? '') ||
    block.title !== baseline.title ||
    (block.subtitle ?? '') !== (baseline.subtitle ?? '') ||
    block.description !== baseline.description
  );
}

export function isSiteTextBlockSubtitleModified(block: SiteTextBlock): boolean {
  const baseline = STATIC_SITE_TEXT_BLOCKS.find((b) => b.id === block.id);
  if (!baseline) return false;
  return (block.subtitle ?? '') !== (baseline.subtitle ?? '');
}

export function countModifiedSiteTextBlocks(
  blocks: readonly SiteTextBlock[]
): number {
  let count = 0;
  for (const block of blocks) {
    if (isSiteTextBlockModified(block)) {
      count += 1;
    }
  }
  return count;
}

export function filterSiteTextBlocks(
  blocks: readonly SiteTextBlock[],
  sectionFilter: 'all' | SiteTextSectionId,
  searchQuery = ''
): SiteTextBlock[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  return blocks.filter((block) => {
    if (sectionFilter !== 'all' && block.section !== sectionFilter) {
      return false;
    }
    if (!normalizedQuery) return true;
    const haystack = [
      block.sectionLabel,
      block.blockLabel,
      block.eyebrow ?? '',
      block.title,
      block.subtitle ?? '',
      block.description,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
