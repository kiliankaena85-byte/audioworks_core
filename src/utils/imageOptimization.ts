const RASTER_EXTENSION_REGEX = /\.(jpe?g|png)$/i;

const OPTIMIZABLE_LOCAL_PREFIXES = [
  '/src/assets/images/',
  '/assets/cms/',
  '/assets/aistudio/',
] as const;

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
