import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LEAD_MAX_ATTEMPTS,
  DEFAULT_LEAD_MIN_INTERVAL_MS,
  DEFAULT_LEAD_WINDOW_MS,
  LEAD_RATE_LIMIT_STORAGE_KEY,
  RateLimiter,
} from './rateLimiter.ts';
import type { RateLimitCheckResult, StorageLike } from './rateLimiter.ts';

export interface UseRateLimitOptions {
  /** Идентификатор формы или действия в localStorage (например, 'production_order', 'air_booking', 'quota_import') */
  scope: string;
  /** Максимальное число сабмитов внутри скользящего окна windowMs */
  maxAttempts?: number;
  /** Длительность скользящего окна в миллисекундах */
  windowMs?: number;
  /** Минимальный допустимый интервал между соседними сабмитами в миллисекундах */
  minIntervalMs?: number;
  /** Ключ в localStorage для синхронизации между вкладками и перезагрузками */
  storageKey?: string;
  /** Пользовательское хранилище (для изолированных unit-тестов) */
  storage?: StorageLike | null;
}

export interface UseRateLimitReturn {
  scope: string;
  isRateLimited: boolean;
  countdownSec: number;
  remainingAttempts: number;
  attemptsInWindow: number;
  maxAttempts: number;
  minIntervalMs: number;
  lastIntervalMs: number | null;
  rateLimitMessage: string | null;
  /** Проверяет доступность сабмита по localStorage без записи новой попытки */
  checkRateLimit: (overrideScope?: string) => RateLimitCheckResult;
  /** Фиксирует попытку сабмита в localStorage и проверяет интервал между отправками */
  recordAttempt: (overrideScope?: string) => RateLimitCheckResult;
  /** Псевдоним recordAttempt для удобного вызова в обработчиках форм */
  attemptSubmit: (overrideScope?: string) => RateLimitCheckResult;
  /** Принудительно устанавливает обратный отсчёт блокировки (например, по ответу HTTP 429 от сервера) */
  triggerCooldown: (retryAfterSec: number, customMessage?: string) => void;
  /** Синхронизирует счётчики с localStorage без блокировки кнопки до клика */
  syncState: (overrideScope?: string) => RateLimitCheckResult;
  /** Сбрасывает историю попыток для текущего scope в localStorage */
  resetRateLimit: (overrideScope?: string) => void;
}

function normalizeOptions(input: UseRateLimitOptions | string): Required<
  Omit<UseRateLimitOptions, 'storage'>
> & {
  storage?: StorageLike | null;
} {
  if (typeof input === 'string') {
    return {
      scope: input,
      maxAttempts: DEFAULT_LEAD_MAX_ATTEMPTS,
      windowMs: DEFAULT_LEAD_WINDOW_MS,
      minIntervalMs: DEFAULT_LEAD_MIN_INTERVAL_MS,
      storageKey: LEAD_RATE_LIMIT_STORAGE_KEY,
    };
  }
  return {
    scope: input.scope,
    maxAttempts: input.maxAttempts ?? DEFAULT_LEAD_MAX_ATTEMPTS,
    windowMs: input.windowMs ?? DEFAULT_LEAD_WINDOW_MS,
    minIntervalMs: input.minIntervalMs ?? DEFAULT_LEAD_MIN_INTERVAL_MS,
    storageKey: input.storageKey ?? LEAD_RATE_LIMIT_STORAGE_KEY,
    storage: input.storage,
  };
}

/**
 * Чистая функция создания контроллера интервалов сабмита в localStorage.
 * Используется внутри React-хука useRateLimit и в детерминированных unit-тестах.
 */
export function createRateLimitController(input: UseRateLimitOptions | string) {
  const opts = normalizeOptions(input);
  const limiter = new RateLimiter({
    maxAttempts: opts.maxAttempts,
    windowMs: opts.windowMs,
    minIntervalMs: opts.minIntervalMs,
    storageKey: opts.storageKey,
    storage: opts.storage,
  });

  return {
    scope: opts.scope,
    limiter,
    check(overrideScope?: string, nowMs = Date.now()): RateLimitCheckResult {
      return limiter.check(overrideScope ?? opts.scope, nowMs);
    },
    recordAttempt(overrideScope?: string, nowMs = Date.now()): RateLimitCheckResult {
      return limiter.consume(overrideScope ?? opts.scope, nowMs);
    },
    reset(overrideScope?: string): void {
      limiter.reset(overrideScope ?? opts.scope);
    },
  };
}

/**
 * React-хук useRateLimit для отслеживания временных интервалов между сабмитами в localStorage
 * и защиты форм заказа (`OrderPage`) и импорта эфирных квот (`RadioInventoryAdmin`) от спама.
 */
export function useRateLimit(input: UseRateLimitOptions | string): UseRateLimitReturn {
  const opts = normalizeOptions(input);

  const limiter = useMemo(
    () =>
      new RateLimiter({
        maxAttempts: opts.maxAttempts,
        windowMs: opts.windowMs,
        minIntervalMs: opts.minIntervalMs,
        storageKey: opts.storageKey,
        storage: opts.storage,
      }),
    [opts.maxAttempts, opts.windowMs, opts.minIntervalMs, opts.storageKey, opts.storage]
  );

  const [status, setStatus] = useState<RateLimitCheckResult>(() =>
    limiter.check(opts.scope)
  );
  const [countdownSec, setCountdownSec] = useState<number>(0);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);

  const syncState = useCallback(
    (overrideScope?: string): RateLimitCheckResult => {
      const targetScope = overrideScope ?? opts.scope;
      const next = limiter.check(targetScope);
      setStatus(next);
      if (next.allowed) {
        setCountdownSec(0);
        setRateLimitMessage(null);
      }
      return next;
    },
    [limiter, opts.scope]
  );

  useEffect(() => {
    syncState(opts.scope);
  }, [opts.scope, syncState]);

  useEffect(() => {
    if (countdownSec <= 0) return;
    const timer = window.setInterval(() => {
      setCountdownSec((prev) => {
        if (prev <= 1) {
          const refreshed = limiter.check(opts.scope);
          setStatus(refreshed);
          if (refreshed.allowed) {
            setRateLimitMessage(null);
            return 0;
          }
          return refreshed.retryAfterSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdownSec, limiter, opts.scope]);

  const checkRateLimit = useCallback(
    (overrideScope?: string): RateLimitCheckResult => {
      const targetScope = overrideScope ?? opts.scope;
      const res = limiter.check(targetScope);
      setStatus(res);
      if (!res.allowed) {
        setCountdownSec(res.retryAfterSec);
        setRateLimitMessage(res.message ?? null);
      }
      return res;
    },
    [limiter, opts.scope]
  );

  const recordAttempt = useCallback(
    (overrideScope?: string): RateLimitCheckResult => {
      const targetScope = overrideScope ?? opts.scope;
      const res = limiter.consume(targetScope);
      setStatus(res);
      if (!res.allowed) {
        setCountdownSec(res.retryAfterSec);
        setRateLimitMessage(res.message ?? null);
      } else {
        setCountdownSec(0);
        setRateLimitMessage(null);
      }
      return res;
    },
    [limiter, opts.scope]
  );

  const triggerCooldown = useCallback((retryAfterSec: number, customMessage?: string) => {
    const safeSec = Math.max(1, Math.ceil(retryAfterSec));
    setCountdownSec(safeSec);
    setStatus((prev) => ({
      ...prev,
      allowed: false,
      remainingAttempts: 0,
      retryAfterSec: safeSec,
    }));
    if (customMessage) {
      setRateLimitMessage(customMessage);
    }
  }, []);

  const resetRateLimit = useCallback(
    (overrideScope?: string) => {
      const targetScope = overrideScope ?? opts.scope;
      limiter.reset(targetScope);
      const refreshed = limiter.check(targetScope);
      setStatus(refreshed);
      setCountdownSec(0);
      setRateLimitMessage(null);
    },
    [limiter, opts.scope]
  );

  return {
    scope: opts.scope,
    isRateLimited: countdownSec > 0,
    countdownSec,
    remainingAttempts: status.remainingAttempts,
    attemptsInWindow: status.attemptsInWindow,
    maxAttempts: status.maxAttempts,
    minIntervalMs: status.minIntervalMs,
    lastIntervalMs: status.lastIntervalMs,
    rateLimitMessage,
    checkRateLimit,
    recordAttempt,
    attemptSubmit: recordAttempt,
    triggerCooldown,
    syncState,
    resetRateLimit,
  };
}
