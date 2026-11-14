import { AIRTIME_SALES_ENABLED } from './platformFeatures';

export type NavSectionId =
  | 'hot-air'
  | 'duel'
  | 'work'
  | 'pricing'
  | 'testimonials'
  | 'faq';

export interface CompactNavItem {
  id: NavSectionId;
  label: string;
  href: `#${NavSectionId}`;
}

export interface SectionViewportBounds {
  id: NavSectionId;
  top: number;
  bottom: number;
}

export const COMPACT_HEADER_HEIGHT_PX = 56;
export const COMPACT_SCROLL_OFFSET_PX = 68;

export const ALL_COMPACT_NAV_ITEMS: readonly CompactNavItem[] = [
  { id: 'hot-air', label: 'Горящий эфир', href: '#hot-air' },
  { id: 'duel', label: 'Сравнение', href: '#duel' },
  { id: 'work', label: 'Галерея', href: '#work' },
  { id: 'pricing', label: 'Стоимость', href: '#pricing' },
  { id: 'testimonials', label: 'Отзывы', href: '#testimonials' },
  { id: 'faq', label: 'FAQ', href: '#faq' },
] as const;

export function getCompactNavItems(
  airtimeEnabled = AIRTIME_SALES_ENABLED
): readonly CompactNavItem[] {
  if (airtimeEnabled) {
    return ALL_COMPACT_NAV_ITEMS;
  }
  return ALL_COMPACT_NAV_ITEMS.filter((item) => item.id !== 'hot-air');
}

export const COMPACT_NAV_ITEMS: readonly CompactNavItem[] = getCompactNavItems();

/**
 * Определяет активную секцию навигации по координатам секций относительно окна просмотра.
 * Возвращает `null`, пока пользователь находится на первом экране выше первой секции.
 */
export function resolveActiveSectionId(
  bounds: readonly SectionViewportBounds[],
  anchorY = 140,
  isAtPageBottom = false
): NavSectionId | null {
  if (bounds.length === 0) return null;

  if (isAtPageBottom) {
    return bounds[bounds.length - 1].id;
  }

  for (const section of bounds) {
    if (section.top <= anchorY && section.bottom > anchorY) {
      return section.id;
    }
  }

  let latestPassed: SectionViewportBounds | null = null;
  for (const section of bounds) {
    if (section.top <= anchorY) {
      if (!latestPassed || section.top > latestPassed.top) {
        latestPassed = section;
      }
    }
  }

  return latestPassed ? latestPassed.id : null;
}

/**
 * Вычисляет точную координату прокрутки с учётом закреплённой компактной шапки.
 */
export function computeSmoothScrollTargetY(
  elementTopInViewport: number,
  currentScrollY: number,
  offsetPx = COMPACT_SCROLL_OFFSET_PX
): number {
  const raw = currentScrollY + elementTopInViewport - offsetPx;
  return Math.max(0, Math.round(raw));
}
