export type LeadFormRateScope =
  | 'production_order'
  | 'air_booking'
  | 'global_lead';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface RateLimiterConfig {
  maxAttempts: number;
  windowMs: number;
  minIntervalMs?: number;
  storageKey?: string;
  storage?: StorageLike | null;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  scope: string;
  attemptsInWindow: number;
  remainingAttempts: number;
  maxAttempts: number;
  windowMs: number;
  minIntervalMs: number;
  lastIntervalMs: number | null;
  retryAfterSec: number;
  reason?: 'window_limit' | 'burst_cooldown';
  message?: string;
}

interface PersistedRateLimitBuckets {
  version: 1;
  buckets: Record<string, number[]>;
}

export const LEAD_RATE_LIMIT_STORAGE_KEY = 'fmworks_lead_rate_limiter_v1';
export const DEFAULT_LEAD_WINDOW_MS = 10 * 60 * 1000; // 10 минут
export const DEFAULT_LEAD_MAX_ATTEMPTS = 4; // до 4 отправок за 10 минут на форму
export const DEFAULT_LEAD_MIN_INTERVAL_MS = 1200; // защита от мгновенного дабл-клика / скрипт-флуда

function resolveDefaultStorage(): StorageLike | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function formatRateLimitBlockMessage(
  retryAfterSec: number,
  reason: 'window_limit' | 'burst_cooldown' = 'window_limit'
): string {
  const safeSec = Math.max(1, Math.ceil(retryAfterSec));
  if (reason === 'burst_cooldown') {
    return `Слишком частая отправка формы. Подождите ${safeSec} сек. перед следующей попыткой.`;
  }
  return `Превышен лимит отправок заявки за короткое время. Повторите через ${safeSec} сек. или напишите на hello@fmworks.ru.`;
}

/**
 * Универсальный RateLimiter со скользящим временным окном и защитой от пакетного флуда.
 * На клиенте синхронизирует попытки в localStorage, на сервере работает в памяти / хранилище.
 */
export class RateLimiter {
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly minIntervalMs: number;
  private readonly storageKey: string;
  private readonly customStorage: StorageLike | null | undefined;
  private readonly memoryFallback = new Map<string, number[]>();

  constructor(config?: Partial<RateLimiterConfig>) {
    this.maxAttempts = Math.max(1, config?.maxAttempts ?? DEFAULT_LEAD_MAX_ATTEMPTS);
    this.windowMs = Math.max(1000, config?.windowMs ?? DEFAULT_LEAD_WINDOW_MS);
    this.minIntervalMs = Math.max(0, config?.minIntervalMs ?? DEFAULT_LEAD_MIN_INTERVAL_MS);
    this.storageKey = config?.storageKey ?? LEAD_RATE_LIMIT_STORAGE_KEY;
    this.customStorage = config?.storage;
  }

  private getStorage(): StorageLike | null {
    if (this.customStorage !== undefined) {
      return this.customStorage;
    }
    return resolveDefaultStorage();
  }

  private readAllBuckets(): Record<string, number[]> {
    const store = this.getStorage();
    if (!store) {
      const fromMem: Record<string, number[]> = {};
      for (const [k, v] of this.memoryFallback.entries()) {
        fromMem[k] = [...v];
      }
      return fromMem;
    }

    try {
      const raw = store.getItem(this.storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Partial<PersistedRateLimitBuckets>;
      if (!parsed || typeof parsed !== 'object' || !parsed.buckets) {
        return {};
      }
      const clean: Record<string, number[]> = {};
      for (const [scopeKey, list] of Object.entries(parsed.buckets)) {
        if (Array.isArray(list)) {
          clean[scopeKey] = list.filter(
            (ts): ts is number => typeof ts === 'number' && Number.isFinite(ts)
          );
        }
      }
      return clean;
    } catch {
      return {};
    }
  }

  private writeAllBuckets(buckets: Record<string, number[]>, nowMs: number): void {
    const cutoff = nowMs - this.windowMs;
    const pruned: Record<string, number[]> = {};
    const keys = Object.keys(buckets);

    for (const k of keys.slice(-400)) {
      const active = (buckets[k] ?? []).filter((ts) => ts > cutoff);
      if (active.length > 0) {
        pruned[k] = active;
      }
    }

    const store = this.getStorage();
    if (!store) {
      this.memoryFallback.clear();
      for (const [k, v] of Object.entries(pruned)) {
        this.memoryFallback.set(k, v);
      }
      return;
    }

    try {
      const payload: PersistedRateLimitBuckets = {
        version: 1,
        buckets: pruned,
      };
      store.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      // Fallback в память при переполнении квоты localStorage
      this.memoryFallback.clear();
      for (const [k, v] of Object.entries(pruned)) {
        this.memoryFallback.set(k, v);
      }
    }
  }

  public check(scope: string, nowMs = Date.now()): RateLimitCheckResult {
    const buckets = this.readAllBuckets();
    const cutoff = nowMs - this.windowMs;
    const active = (buckets[scope] ?? []).filter((ts) => ts > cutoff).sort((a, b) => a - b);
    const lastAttempt = active.length > 0 ? (active[active.length - 1] ?? null) : null;
    const lastIntervalMs = lastAttempt !== null ? Math.max(0, nowMs - lastAttempt) : null;

    if (active.length >= this.maxAttempts) {
      const oldest = active[0] ?? nowMs;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + this.windowMs - nowMs) / 1000));
      return {
        allowed: false,
        scope,
        attemptsInWindow: active.length,
        remainingAttempts: 0,
        maxAttempts: this.maxAttempts,
        windowMs: this.windowMs,
        minIntervalMs: this.minIntervalMs,
        lastIntervalMs,
        retryAfterSec,
        reason: 'window_limit',
        message: formatRateLimitBlockMessage(retryAfterSec, 'window_limit'),
      };
    }

    if (this.minIntervalMs > 0 && lastIntervalMs !== null) {
      if (lastIntervalMs < this.minIntervalMs) {
        const retryAfterSec = Math.max(1, Math.ceil((this.minIntervalMs - lastIntervalMs) / 1000));
        return {
          allowed: false,
          scope,
          attemptsInWindow: active.length,
          remainingAttempts: Math.max(0, this.maxAttempts - active.length),
          maxAttempts: this.maxAttempts,
          windowMs: this.windowMs,
          minIntervalMs: this.minIntervalMs,
          lastIntervalMs,
          retryAfterSec,
          reason: 'burst_cooldown',
          message: formatRateLimitBlockMessage(retryAfterSec, 'burst_cooldown'),
        };
      }
    }

    return {
      allowed: true,
      scope,
      attemptsInWindow: active.length,
      remainingAttempts: Math.max(0, this.maxAttempts - active.length),
      maxAttempts: this.maxAttempts,
      windowMs: this.windowMs,
      minIntervalMs: this.minIntervalMs,
      lastIntervalMs,
      retryAfterSec: 0,
    };
  }

  public consume(scope: string, nowMs = Date.now()): RateLimitCheckResult {
    const currentStatus = this.check(scope, nowMs);
    const buckets = this.readAllBuckets();
    const cutoff = nowMs - this.windowMs;
    const active = (buckets[scope] ?? []).filter((ts) => ts > cutoff).sort((a, b) => a - b);

    if (!currentStatus.allowed) {
      buckets[scope] = active;
      this.writeAllBuckets(buckets, nowMs);
      return currentStatus;
    }

    const previousAttempt = active.length > 0 ? (active[active.length - 1] ?? null) : null;
    const lastIntervalMs =
      previousAttempt !== null ? Math.max(0, nowMs - previousAttempt) : null;

    active.push(nowMs);
    buckets[scope] = active;
    this.writeAllBuckets(buckets, nowMs);

    return {
      allowed: true,
      scope,
      attemptsInWindow: active.length,
      remainingAttempts: Math.max(0, this.maxAttempts - active.length),
      maxAttempts: this.maxAttempts,
      windowMs: this.windowMs,
      minIntervalMs: this.minIntervalMs,
      lastIntervalMs,
      retryAfterSec: 0,
    };
  }

  public reset(scope?: string): void {
    if (!scope) {
      this.memoryFallback.clear();
      const store = this.getStorage();
      if (store) {
        try {
          if (typeof store.removeItem === 'function') {
            store.removeItem(this.storageKey);
          } else {
            store.setItem(this.storageKey, JSON.stringify({ version: 1, buckets: {} }));
          }
        } catch {
          // Ignore storage cleanup errors
        }
      }
      return;
    }

    const buckets = this.readAllBuckets();
    delete buckets[scope];
    this.writeAllBuckets(buckets, Date.now());
  }
}

export function resolveLeadFormRateScope(
  checkoutMode: 'air_plus_production' | 'production_only'
): LeadFormRateScope {
  return checkoutMode === 'air_plus_production' ? 'air_booking' : 'production_order';
}

export const clientLeadRateLimiter = new RateLimiter({
  maxAttempts: DEFAULT_LEAD_MAX_ATTEMPTS,
  windowMs: DEFAULT_LEAD_WINDOW_MS,
  minIntervalMs: DEFAULT_LEAD_MIN_INTERVAL_MS,
  storageKey: LEAD_RATE_LIMIT_STORAGE_KEY,
});
