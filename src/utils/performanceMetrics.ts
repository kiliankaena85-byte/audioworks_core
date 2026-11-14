export type WebVitalMetricName = 'TTFB' | 'FCP' | 'LCP' | 'CLS' | 'INP';

export type WebVitalRating = 'good' | 'needs-improvement' | 'poor';

export type LongTaskSeverity = 'moderate' | 'severe';

export interface WebVitalMetricSnapshot {
  name: WebVitalMetricName;
  value: number;
  rating: WebVitalRating;
  unit: 'ms' | 'score';
  route: string;
  detail?: string;
}

export interface LongTaskAttributionInput {
  name?: string;
  containerType?: string;
  containerSrc?: string;
  containerId?: string;
  containerName?: string;
}

export interface LongTaskEntryLike {
  name?: string;
  startTime: number;
  duration: number;
  attribution?: readonly LongTaskAttributionInput[];
}

export interface LongTaskBottleneck {
  startTimeMs: number;
  durationMs: number;
  severity: LongTaskSeverity;
  source: string;
  containerLabel: string;
  route: string;
}

export interface LayoutShiftEntryLike {
  startTime: number;
  value: number;
  hadRecentInput: boolean;
}

export interface InteractionEntryLike {
  duration: number;
  interactionId?: number;
  name?: string;
}

export interface NavigationTimingLike {
  requestStart: number;
  responseStart: number;
  domInteractive?: number;
  domContentLoadedEventEnd?: number;
  loadEventEnd?: number;
}

export interface NavigationTimingSummary {
  ttfbMs: number;
  domInteractiveMs: number | null;
  domContentLoadedMs: number | null;
  loadCompleteMs: number | null;
}

export const WEB_VITAL_THRESHOLDS: Record<
  WebVitalMetricName,
  { good: number; poor: number; unit: 'ms' | 'score' }
> = {
  TTFB: { good: 800, poor: 1800, unit: 'ms' },
  FCP: { good: 1800, poor: 3000, unit: 'ms' },
  LCP: { good: 2500, poor: 4000, unit: 'ms' },
  CLS: { good: 0.1, poor: 0.25, unit: 'score' },
  INP: { good: 200, poor: 500, unit: 'ms' },
};

export const DEFAULT_LONG_TASK_THRESHOLD_MS = 50;
export const SEVERE_LONG_TASK_THRESHOLD_MS = 150;

function roundMetricValue(name: WebVitalMetricName, value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (name === 'CLS') {
    return Math.round(value * 10000) / 10000;
  }
  return Math.round(value * 10) / 10;
}

export function evaluateWebVitalRating(
  name: WebVitalMetricName,
  value: number
): WebVitalRating {
  const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;
  const threshold = WEB_VITAL_THRESHOLDS[name];
  if (safeValue <= threshold.good) return 'good';
  if (safeValue <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

export function createWebVitalSnapshot(
  name: WebVitalMetricName,
  rawValue: number,
  route: string,
  detail?: string
): WebVitalMetricSnapshot {
  const value = roundMetricValue(name, rawValue);
  return {
    name,
    value,
    rating: evaluateWebVitalRating(name, value),
    unit: WEB_VITAL_THRESHOLDS[name].unit,
    route,
    ...(detail ? { detail } : {}),
  };
}

/**
 * Аккумулятор сессионных окон CLS по спецификации Web Vitals:
 * окно сбрасывается при паузе > 1000 мс или длительности окна > 5000 мс,
 * сдвиги после пользовательского ввода (`hadRecentInput`) игнорируются.
 */
export function createClsSessionWindowAccumulator(): {
  addEntry: (entry: LayoutShiftEntryLike) => number;
  getMaxScore: () => number;
} {
  let maxSessionValue = 0;
  let currentSessionValue = 0;
  let firstEntryTime = -Infinity;
  let lastEntryTime = -Infinity;

  const addEntry = (entry: LayoutShiftEntryLike): number => {
    if (
      entry.hadRecentInput ||
      !Number.isFinite(entry.value) ||
      entry.value <= 0 ||
      !Number.isFinite(entry.startTime)
    ) {
      return Math.round(maxSessionValue * 10000) / 10000;
    }

    const gapExceeded = entry.startTime - lastEntryTime > 1000;
    const windowExceeded = entry.startTime - firstEntryTime > 5000;

    if (firstEntryTime === -Infinity || gapExceeded || windowExceeded) {
      currentSessionValue = entry.value;
      firstEntryTime = entry.startTime;
    } else {
      currentSessionValue += entry.value;
    }

    lastEntryTime = entry.startTime;
    if (currentSessionValue > maxSessionValue) {
      maxSessionValue = currentSessionValue;
    }

    return Math.round(maxSessionValue * 10000) / 10000;
  };

  return {
    addEntry,
    getMaxScore: () => Math.round(maxSessionValue * 10000) / 10000,
  };
}

/**
 * Трекер INP: группирует максимальные длительности по `interactionId`
 * и возвращает p98 худшей интерактивности в миллисекундах.
 */
export function createInpInteractionTracker(maxTrackedInteractions = 200): {
  addEntry: (entry: InteractionEntryLike) => number | null;
  getInpMs: () => number | null;
} {
  const interactionDurations = new Map<number, number>();

  const computeInp = (): number | null => {
    if (interactionDurations.size === 0) return null;
    const sortedDesc = Array.from(interactionDurations.values()).sort(
      (a, b) => b - a
    );
    const p98Index = Math.min(
      sortedDesc.length - 1,
      Math.floor(sortedDesc.length / 50)
    );
    return Math.round(sortedDesc[p98Index] * 10) / 10;
  };

  const addEntry = (entry: InteractionEntryLike): number | null => {
    const id = entry.interactionId ?? 0;
    if (id <= 0 || !Number.isFinite(entry.duration) || entry.duration < 0) {
      return computeInp();
    }

    const existing = interactionDurations.get(id) ?? 0;
    if (entry.duration > existing) {
      interactionDurations.set(id, entry.duration);
    }

    if (interactionDurations.size > maxTrackedInteractions) {
      const oldestKey = interactionDurations.keys().next().value;
      if (oldestKey !== undefined) {
        interactionDurations.delete(oldestKey);
      }
    }

    return computeInp();
  };

  return {
    addEntry,
    getInpMs: computeInp,
  };
}

export function extractNavigationTimingSummary(
  nav: NavigationTimingLike | null | undefined
): NavigationTimingSummary | null {
  if (!nav || !Number.isFinite(nav.responseStart)) return null;
  const rawTtfb = nav.responseStart - (Number.isFinite(nav.requestStart) ? nav.requestStart : 0);
  const ttfbMs = Math.max(0, Math.round(rawTtfb * 10) / 10);

  const normalizeMs = (val?: number): number | null =>
    typeof val === 'number' && Number.isFinite(val) && val > 0
      ? Math.round(val * 10) / 10
      : null;

  return {
    ttfbMs,
    domInteractiveMs: normalizeMs(nav.domInteractive),
    domContentLoadedMs: normalizeMs(nav.domContentLoadedEventEnd),
    loadCompleteMs: normalizeMs(nav.loadEventEnd),
  };
}

export function extractLongTaskBottleneck(
  entry: LongTaskEntryLike,
  route: string,
  thresholdMs = DEFAULT_LONG_TASK_THRESHOLD_MS
): LongTaskBottleneck | null {
  if (!Number.isFinite(entry.duration) || entry.duration <= thresholdMs) {
    return null;
  }

  const durationMs = Math.round(entry.duration * 10) / 10;
  const startTimeMs = Math.max(0, Math.round(entry.startTime * 10) / 10);
  const firstAttr = entry.attribution?.[0];
  const containerParts = [
    firstAttr?.containerType,
    firstAttr?.containerId ? `#${firstAttr.containerId}` : undefined,
    firstAttr?.containerName,
    firstAttr?.containerSrc,
  ].filter((part): part is string => Boolean(part && part.trim()));

  return {
    startTimeMs,
    durationMs,
    severity:
      durationMs > SEVERE_LONG_TASK_THRESHOLD_MS ? 'severe' : 'moderate',
    source: firstAttr?.name || entry.name || 'self',
    containerLabel:
      containerParts.length > 0 ? containerParts.join(' · ') : 'main-thread',
    route,
  };
}

export function formatWebVitalLogLine(snapshot: WebVitalMetricSnapshot): string {
  const formattedVal =
    snapshot.unit === 'ms' ? `${snapshot.value}ms` : `${snapshot.value}`;
  const detailSuffix = snapshot.detail ? ` (${snapshot.detail})` : '';
  return `[FMWorks Perf] ${snapshot.name}: ${formattedVal} [${snapshot.rating}] on ${snapshot.route}${detailSuffix}`;
}

export function formatLongTaskLogLine(bottleneck: LongTaskBottleneck): string {
  return `[FMWorks Perf] Long task (${bottleneck.severity}): ${bottleneck.durationMs}ms at ${bottleneck.startTimeMs}ms [${bottleneck.source} · ${bottleneck.containerLabel}] on ${bottleneck.route}`;
}
