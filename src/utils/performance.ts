import {
  type Metric,
  onCLS,
  onFCP,
  onINP,
  onLCP,
  onTTFB,
} from 'web-vitals';

export type CoreWebVitalName = 'CLS' | 'LCP' | 'FID' | 'INP' | 'FCP' | 'TTFB';

export type WebVitalRating = 'good' | 'needs-improvement' | 'poor';

export const DEFAULT_WEB_VITALS_ENDPOINT = '/api/monitoring/web-vitals';

export const FID_THRESHOLDS = {
  good: 100,
  poor: 300,
} as const;

const ALLOWED_VITAL_NAMES: ReadonlySet<CoreWebVitalName> = new Set([
  'CLS',
  'LCP',
  'FID',
  'INP',
  'FCP',
  'TTFB',
]);

const ALLOWED_RATINGS: ReadonlySet<WebVitalRating> = new Set([
  'good',
  'needs-improvement',
  'poor',
]);

export interface WebVitalReportPayload {
  name: CoreWebVitalName;
  id: string;
  value: number;
  delta: number;
  rating: WebVitalRating;
  navigationType: string;
  route: string;
  timestampIso: string;
}

export interface WebVitalsOptions {
  /** Локальный endpoint мониторинга (по умолчанию `/api/monitoring/web-vitals`, `null` отключает отправку) */
  endpoint?: string | null;
  /** Выводить отчёты в консоль (`console.info`) */
  logToConsole?: boolean;
  /** Передавать промежуточные изменения метрик (по умолчанию `false`) */
  reportAllChanges?: boolean;
  /** Текущий маршрут для привязки метрик в отчёте */
  getRoute?: () => string;
  /** Пользовательский обработчик каждой зафиксированной метрики */
  onMetric?: (report: WebVitalReportPayload) => void;
}

interface FirstInputEntryLike extends PerformanceEntry {
  processingStart: number;
  startTime: number;
}

export function evaluateFidRating(valueMs: number): WebVitalRating {
  const safe = Number.isFinite(valueMs) && valueMs >= 0 ? valueMs : 0;
  if (safe <= FID_THRESHOLDS.good) return 'good';
  if (safe <= FID_THRESHOLDS.poor) return 'needs-improvement';
  return 'poor';
}

export function roundWebVitalValue(
  name: CoreWebVitalName,
  rawValue: number
): number {
  if (!Number.isFinite(rawValue) || rawValue < 0) return 0;
  if (name === 'CLS') {
    return Math.round(rawValue * 10000) / 10000;
  }
  return Math.round(rawValue * 10) / 10;
}

function sanitizeRoutePath(rawRoute: unknown): string {
  if (typeof rawRoute !== 'string') return '/';
  const cleaned = rawRoute.split(/[?#]/)[0]?.trim() || '/';
  if (!cleaned.startsWith('/')) return `/${cleaned.slice(0, 159)}`;
  return cleaned.slice(0, 160);
}

export function normalizeWebVitalMetric(
  metric:
    | Pick<Metric, 'name' | 'id' | 'value' | 'delta' | 'rating' | 'navigationType'>
    | {
        name: 'FID';
        id: string;
        value: number;
        delta: number;
        rating: WebVitalRating;
        navigationType?: string;
      },
  route = '/'
): WebVitalReportPayload {
  const name = metric.name as CoreWebVitalName;
  const value = roundWebVitalValue(name, metric.value);
  const delta = roundWebVitalValue(name, metric.delta);
  return {
    name,
    id: String(metric.id || `${name}-${Date.now()}`).slice(0, 80),
    value,
    delta,
    rating: metric.rating,
    navigationType: String(metric.navigationType || 'navigate').slice(0, 32),
    route: sanitizeRoutePath(route),
    timestampIso: new Date().toISOString(),
  };
}

export function formatWebVitalsReportLine(report: WebVitalReportPayload): string {
  const formattedVal =
    report.name === 'CLS' ? `${report.value}` : `${report.value}ms`;
  return `[FMWorks Perf] WebVitals ${report.name}: ${formattedVal} [${report.rating}] on ${report.route}`;
}

/**
 * Серверная и клиентская валидация beacon-пакета Web Vitals перед сохранением.
 */
export function validateWebVitalsBeaconPayload(
  raw: unknown
): WebVitalReportPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;

  const name = record.name as CoreWebVitalName;
  if (!ALLOWED_VITAL_NAMES.has(name)) return null;

  const rating = record.rating as WebVitalRating;
  if (!ALLOWED_RATINGS.has(rating)) return null;

  const value = typeof record.value === 'number' ? record.value : Number.NaN;
  const delta =
    typeof record.delta === 'number' ? record.delta : value;
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 600000 ||
    !Number.isFinite(delta) ||
    delta < 0 ||
    delta > 600000
  ) {
    return null;
  }

  const id =
    typeof record.id === 'string' && record.id.trim().length > 0
      ? record.id.trim().slice(0, 80)
      : `${name}-unknown`;

  const navigationType =
    typeof record.navigationType === 'string' && record.navigationType.trim()
      ? record.navigationType.trim().slice(0, 32)
      : 'navigate';

  const timestampIso =
    typeof record.timestampIso === 'string' && !Number.isNaN(Date.parse(record.timestampIso))
      ? record.timestampIso
      : new Date().toISOString();

  return {
    name,
    id,
    value: roundWebVitalValue(name, value),
    delta: roundWebVitalValue(name, delta),
    rating,
    navigationType,
    route: sanitizeRoutePath(record.route),
    timestampIso,
  };
}

const collectedMetrics = new Map<CoreWebVitalName, WebVitalReportPayload>();
let isLibrarySubscribed = false;
let activeObserver: PerformanceObserver | null = null;
let activeOptions: WebVitalsOptions = {};

function sendReportToEndpoint(
  endpoint: string,
  payload: WebVitalReportPayload
): void {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(payload);

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.sendBeacon === 'function'
  ) {
    try {
      const blob = new Blob([serialized], { type: 'application/json' });
      if (navigator.sendBeacon(endpoint, blob)) {
        return;
      }
    } catch {
      // Fallback to fetch keepalive below
    }
  }

  if (typeof fetch === 'function') {
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: serialized,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {
      // Non-blocking telemetry: ignore transient network aborts
    });
  }
}

export function reportWebVitalMetric(
  report: WebVitalReportPayload,
  options: Pick<WebVitalsOptions, 'endpoint' | 'logToConsole' | 'onMetric'> = {}
): WebVitalReportPayload {
  collectedMetrics.set(report.name, report);

  if (options.logToConsole !== false) {
    console.info(formatWebVitalsReportLine(report), report);
  }

  options.onMetric?.(report);

  const endpoint =
    options.endpoint === undefined ? DEFAULT_WEB_VITALS_ENDPOINT : options.endpoint;
  if (endpoint) {
    sendReportToEndpoint(endpoint, report);
  }

  return report;
}

function getCurrentRoute(): string {
  if (activeOptions.getRoute) {
    return sanitizeRoutePath(activeOptions.getRoute());
  }
  if (typeof window !== 'undefined' && window.location?.pathname) {
    return sanitizeRoutePath(window.location.pathname);
  }
  return '/';
}

function observeLegacyFid(onReport: (report: WebVitalReportPayload) => void): PerformanceObserver | null {
  if (typeof PerformanceObserver === 'undefined') return null;
  const supported = PerformanceObserver.supportedEntryTypes;
  if (!Array.isArray(supported) || !supported.includes('first-input')) {
    return null;
  }

  try {
    let fidReported = false;
    const observer = new PerformanceObserver((list) => {
      if (fidReported) return;
      const entries = list.getEntries() as FirstInputEntryLike[];
      const firstEntry = entries[0];
      if (!firstEntry) return;

      fidReported = true;
      const fidMs = Math.max(0, firstEntry.processingStart - firstEntry.startTime);
      const report = normalizeWebVitalMetric(
        {
          name: 'FID',
          id: `fid-${Math.round(firstEntry.startTime)}`,
          value: fidMs,
          delta: fidMs,
          rating: evaluateFidRating(fidMs),
          navigationType: 'navigate',
        },
        getCurrentRoute()
      );
      onReport(report);
      observer.disconnect();
    });

    observer.observe({ type: 'first-input', buffered: true });
    return observer;
  } catch {
    return null;
  }
}

/**
 * Инициализирует трекинг Core Web Vitals (`CLS`, `LCP`, `FID`, `INP`, `FCP`, `TTFB`)
 * на базе официальной библиотеки `web-vitals` и нативного `first-input` observer.
 */
export function initWebVitalsMonitoring(
  options: WebVitalsOptions = {}
): () => void {
  activeOptions = { ...activeOptions, ...options };

  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleMetric = (
    metric:
      | Pick<Metric, 'name' | 'id' | 'value' | 'delta' | 'rating' | 'navigationType'>
      | WebVitalReportPayload
  ) => {
    const normalized =
      'timestampIso' in metric
        ? metric
        : normalizeWebVitalMetric(metric, getCurrentRoute());
    reportWebVitalMetric(normalized, activeOptions);
  };

  if (!isLibrarySubscribed) {
    isLibrarySubscribed = true;
    const metricConfig = {
      reportAllChanges: Boolean(activeOptions.reportAllChanges),
    };

    onCLS((metric) => handleMetric(metric), metricConfig);
    onLCP((metric) => handleMetric(metric), metricConfig);
    onINP((metric) => handleMetric(metric), metricConfig);
    onFCP((metric) => handleMetric(metric), metricConfig);
    onTTFB((metric) => handleMetric(metric), metricConfig);

    activeObserver = observeLegacyFid((fidReport) => handleMetric(fidReport));
  }

  return () => {
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }
  };
}

export const WebVitals = {
  init: initWebVitalsMonitoring,
  track: initWebVitalsMonitoring,
  report: reportWebVitalMetric,
  getCollectedMetrics: (): Partial<Record<CoreWebVitalName, WebVitalReportPayload>> =>
    Object.fromEntries(collectedMetrics.entries()),
  resetForTests: () => {
    collectedMetrics.clear();
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }
    isLibrarySubscribed = false;
    activeOptions = {};
  },
} as const;
