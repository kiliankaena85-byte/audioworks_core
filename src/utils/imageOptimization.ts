const RASTER_EXTENSION_REGEX = /\.(jpe?g|png)$/i;

const OPTIMIZABLE_LOCAL_PREFIXES = [
  '/src/assets/images/',
  '/assets/cms/',
  '/assets/aistudio/',
] as const;

export const STUDIO_RESPONSIVE_WEBP_TIERS = [480, 800] as const;
export const DEFAULT_ADAPTIVE_CARD_SIZES =
  '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 1200px';

export interface ImageLoadingConfigInput {
  priority?: boolean;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  fetchPriority?: 'high' | 'low' | 'auto';
}

export interface ResolvedImageLoadingConfig {
  loading: 'lazy' | 'eager';
  decoding: 'async' | 'sync' | 'auto';
  fetchPriority: 'high' | 'low' | 'auto';
}

/**
 * Преобразует локальный путь JPEG/PNG (студийные фото и CMS-обложки) в путь к WebP-версии.
 * Внешние URL, SVG, data-URI и уже готовые .webp/.avif не изменяются (`null`).
 */
export function deriveWebpUrl(rawSrc: string | null | undefined): string | null {
  if (typeof rawSrc !== 'string') return null;
  const trimmed = rawSrc.trim();
  if (!trimmed) return null;

  if (
    /^(?:https?:)?\/\//i.test(trimmed) ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return null;
  }

  const queryOrHashIdx = trimmed.search(/[?#]/);
  const pathname =
    queryOrHashIdx === -1 ? trimmed : trimmed.slice(0, queryOrHashIdx);
  const suffix = queryOrHashIdx === -1 ? '' : trimmed.slice(queryOrHashIdx);

  const isLocalOptimizable = OPTIMIZABLE_LOCAL_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  if (!isLocalOptimizable) {
    return null;
  }

  if (!RASTER_EXTENSION_REGEX.test(pathname)) {
    return null;
  }

  return `${pathname.replace(RASTER_EXTENSION_REGEX, '.webp')}${suffix}`;
}

/**
 * Формирует адаптивный `srcset` с дескрипторами ширины (`480w`, `800w`, `1280w`)
 * для студийных фотографий `/src/assets/images/*` (кроме компактных аватаров `avatar_*`),
 * либо одиночный WebP URL для прочих локальных иллюстраций и CMS-загрузок.
 */
export function deriveResponsiveWebpSrcSet(
  rawSrc: string | null | undefined
): { srcSet: string; isMultiWidth: boolean } | null {
  const baseWebp = deriveWebpUrl(rawSrc);
  if (!baseWebp || typeof rawSrc !== 'string') return null;

  const trimmed = rawSrc.trim();
  const queryOrHashIdx = trimmed.search(/[?#]/);
  const pathname =
    queryOrHashIdx === -1 ? trimmed : trimmed.slice(0, queryOrHashIdx);
  const suffix = queryOrHashIdx === -1 ? '' : trimmed.slice(queryOrHashIdx);

  const fileName = pathname.split('/').pop() ?? '';
  const supportsMultiWidth =
    pathname.startsWith('/src/assets/images/') &&
    !fileName.startsWith('avatar_') &&
    RASTER_EXTENSION_REGEX.test(pathname);

  if (!supportsMultiWidth) {
    return { srcSet: baseWebp, isMultiWidth: false };
  }

  const tierEntries = STUDIO_RESPONSIVE_WEBP_TIERS.map((w) => {
    const tierUrl = `${pathname.replace(RASTER_EXTENSION_REGEX, `-${w}w.webp`)}${suffix}`;
    return `${tierUrl} ${w}w`;
  });
  tierEntries.push(`${baseWebp} 1280w`);

  return {
    srcSet: tierEntries.join(', '),
    isMultiWidth: true,
  };
}

/**
 * Формирует путь для сохранения WebP-копии рядом с исходным файлом изображения.
 */
export function buildWebpOutputFilePath(sourceFilePath: string): string | null {
  if (!RASTER_EXTENSION_REGEX.test(sourceFilePath)) {
    return null;
  }
  return sourceFilePath.replace(RASTER_EXTENSION_REGEX, '.webp');
}

/**
 * Возвращает атрибуты отложенной загрузки для Lighthouse и Yandex Webmaster:
 * по умолчанию `loading="lazy"` и `decoding="async"`, а для hero LCP (`priority=true`) — `eager` + `high`.
 */
export function resolveImageLoadingProps(
  input: ImageLoadingConfigInput = {}
): ResolvedImageLoadingConfig {
  const isPriority = Boolean(input.priority);
  return {
    loading: input.loading ?? (isPriority ? 'eager' : 'lazy'),
    decoding: input.decoding ?? 'async',
    fetchPriority: input.fetchPriority ?? (isPriority ? 'high' : 'auto'),
  };
}
