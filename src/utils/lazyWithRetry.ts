import { ComponentType, lazy, type LazyExoticComponent } from 'react';

export const CHUNK_RELOAD_STORAGE_KEY = 'fmworks_chunk_reload_at';
export const CHUNK_RELOAD_COOLDOWN_MS = 10_000;
export const DEFAULT_CHUNK_RETRY_DELAY_MS = 220;

const CHUNK_ERROR_PATTERNS: readonly RegExp[] = [
  /ChunkLoadError/i,
  /dynamically imported module/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /Loading (?:CSS )?chunk .* failed/i,
  /disallowed MIME type/i,
  /Failed to fetch/i,
  /NetworkError when attempting to fetch resource/i,
  /^Load failed$/i,
];

let reloadInProgressInMemory = false;

export function resetChunkReloadStateForTests(): void {
  reloadInProgressInMemory = false;
}

export function isChunkReloadInProgress(): boolean {
  return reloadInProgressInMemory;
}

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name?: unknown }).name ?? '')
      : '';
  const message =
    typeof error === 'string'
      ? error
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';

  const combined = `${name} ${message}`.trim();
  if (!combined) return false;
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message) || pattern.test(combined));
}

export interface ChunkReloadOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  reloadFn?: () => void;
  nowMs?: number;
  cooldownMs?: number;
}

function getDefaultSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function tryTriggerChunkReload(options: ChunkReloadOptions = {}): boolean {
  if (reloadInProgressInMemory) {
    return true;
  }

  const storage =
    options.storage !== undefined ? options.storage : getDefaultSessionStorage();
  const reloadFn =
    options.reloadFn ??
    (typeof window !== 'undefined' ? () => window.location.reload() : undefined);

  if (!storage || !reloadFn) {
    return false;
  }

  const nowMs = options.nowMs ?? Date.now();
  const cooldownMs = options.cooldownMs ?? CHUNK_RELOAD_COOLDOWN_MS;

  try {
    const rawLast = storage.getItem(CHUNK_RELOAD_STORAGE_KEY);
    const lastReloadAt = rawLast ? Number(rawLast) : 0;
    if (Number.isFinite(lastReloadAt) && lastReloadAt > 0 && nowMs - lastReloadAt <= cooldownMs) {
      return false;
    }
    storage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(nowMs));
    reloadInProgressInMemory = true;
    reloadFn();
    return true;
  } catch {
    return false;
  }
}

export interface LoadWithRetryOptions {
  retries?: number;
  retryDelayMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
  onChunkFailureReload?: () => boolean;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export async function loadWithRetry<T>(
  loader: () => Promise<T>,
  options: LoadWithRetryOptions = {}
): Promise<T> {
  const retries = Math.max(0, options.retries ?? 1);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_CHUNK_RETRY_DELAY_MS);
  const sleepFn = options.sleepFn ?? defaultSleep;
  const onChunkFailureReload = options.onChunkFailureReload ?? (() => tryTriggerChunkReload());

  let attempt = 0;
  while (true) {
    try {
      return await loader();
    } catch (error) {
      const chunkError = isChunkLoadError(error);
      if (chunkError && attempt < retries) {
        attempt += 1;
        if (retryDelayMs > 0) {
          await sleepFn(retryDelayMs);
        }
        continue;
      }

      if (chunkError && onChunkFailureReload()) {
        // Держим Suspense в состоянии скелетона, пока браузер завершает reload на свежие чанки
        return new Promise<T>(() => {});
      }

      throw error;
    }
  }
}

export function lazyNamedExport<
  K extends string,
  P extends object = Record<string, never>,
>(
  loader: () => Promise<{ [M in K]: ComponentType<P> }>,
  exportName: K
): LazyExoticComponent<ComponentType<P>> {
  return lazy<ComponentType<P>>(() =>
    loadWithRetry(async () => {
      const mod = await loader();
      const resolved = mod?.[exportName];
      if (!resolved) {
        throw new Error(
          `Failed to resolve dynamically imported module export "${exportName}"`
        );
      }
      return { default: resolved };
    })
  );
}
