import { useEffect, useRef } from 'react';
import {
  createClsSessionWindowAccumulator,
  createInpInteractionTracker,
  createWebVitalSnapshot,
  DEFAULT_LONG_TASK_THRESHOLD_MS,
  extractLongTaskBottleneck,
  extractNavigationTimingSummary,
  formatLongTaskLogLine,
  formatWebVitalLogLine,
  InteractionEntryLike,
  LayoutShiftEntryLike,
  LongTaskEntryLike,
  NavigationTimingLike,
  WebVitalMetricName,
  WebVitalMetricSnapshot,
} from '../utils/performanceMetrics';

interface LargestContentfulPaintEntryLike extends PerformanceEntry {
  element?: Element | null;
  size?: number;
}

export interface PerformanceMonitorProps {
  enabled?: boolean;
  longTaskThresholdMs?: number;
  routeKey?: string;
}

function describeElementSelector(element: Element | null | undefined): string | undefined {
  if (!element) return undefined;
  const tag = element.tagName.toLowerCase();
  const idPart = element.id ? `#${element.id}` : '';
  return `${tag}${idPart}`;
}

function isSupportedEntryType(type: string): boolean {
  if (typeof PerformanceObserver === 'undefined') return false;
  const supported = PerformanceObserver.supportedEntryTypes;
  return Array.isArray(supported) && supported.includes(type);
}

/**
 * Безголовый компонент мониторинга Core Web Vitals (TTFB, FCP, LCP, CLS, INP)
 * и длинных задач (Long Tasks > 50 мс) в консоли разработчика без вывода в UI.
 */
export function PerformanceMonitor({
  enabled = true,
  longTaskThresholdMs = DEFAULT_LONG_TASK_THRESHOLD_MS,
  routeKey = '/',
}: PerformanceMonitorProps) {
  const latestRouteRef = useRef<string>(routeKey);
  latestRouteRef.current = routeKey;

  useEffect(() => {
    if (
      !enabled ||
      typeof window === 'undefined' ||
      typeof performance === 'undefined' ||
      typeof PerformanceObserver === 'undefined'
    ) {
      return;
    }

    const observers: PerformanceObserver[] = [];
    const metricsMap = new Map<WebVitalMetricName, WebVitalMetricSnapshot>();
    const clsAccumulator = createClsSessionWindowAccumulator();
    const inpTracker = createInpInteractionTracker();
    let latestLcpEntry: LargestContentfulPaintEntryLike | null = null;
    let longTaskCount = 0;
    let totalLongTaskBlockingMs = 0;
    let isSessionFlushed = false;

    const recordMetric = (
      snapshot: WebVitalMetricSnapshot,
      emitNow: boolean
    ) => {
      metricsMap.set(snapshot.name, snapshot);
      if (emitNow) {
        console.info(formatWebVitalLogLine(snapshot), snapshot);
      }
    };

    // 1. TTFB и Navigation Timing
    try {
      const navEntries = performance.getEntriesByType(
        'navigation'
      ) as unknown as NavigationTimingLike[];
      const navSummary = extractNavigationTimingSummary(navEntries[0]);
      if (navSummary) {
        recordMetric(
          createWebVitalSnapshot(
            'TTFB',
            navSummary.ttfbMs,
            latestRouteRef.current,
            navSummary.domContentLoadedMs !== null
              ? `DCL ${navSummary.domContentLoadedMs}ms`
              : undefined
          ),
          true
        );
      }
    } catch {
      // Игнорируем ограничения доступа к Navigation Timing в изолированных контекстах
    }

    // 2. First Contentful Paint (FCP)
    if (isSupportedEntryType('paint')) {
      try {
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              recordMetric(
                createWebVitalSnapshot(
                  'FCP',
                  entry.startTime,
                  latestRouteRef.current
                ),
                true
              );
              paintObserver.disconnect();
              break;
            }
          }
        });
        paintObserver.observe({ type: 'paint', buffered: true });
        observers.push(paintObserver);
      } catch {
        // Не поддерживается данным браузером
      }
    }

    // 3. Largest Contentful Paint (LCP)
    if (isSupportedEntryType('largest-contentful-paint')) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries() as LargestContentfulPaintEntryLike[];
          const last = entries[entries.length - 1];
          if (last) {
            latestLcpEntry = last;
          }
        });
        lcpObserver.observe({
          type: 'largest-contentful-paint',
          buffered: true,
        });
        observers.push(lcpObserver);
      } catch {
        // Не поддерживается данным браузером
      }
    }

    // 4. Cumulative Layout Shift (CLS)
    if (isSupportedEntryType('layout-shift')) {
      try {
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries() as unknown as LayoutShiftEntryLike[];
          for (const entry of entries) {
            clsAccumulator.addEntry(entry);
          }
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
        observers.push(clsObserver);
      } catch {
        // Не поддерживается данным браузером
      }
    }

    // 5. Interaction to Next Paint (INP)
    if (isSupportedEntryType('event')) {
      try {
        const inpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries() as unknown as InteractionEntryLike[];
          for (const entry of entries) {
            inpTracker.addEntry(entry);
          }
        });
        inpObserver.observe({
          type: 'event',
          buffered: true,
          durationThreshold: 16,
        } as PerformanceObserverInit);
        observers.push(inpObserver);
      } catch {
        // Не поддерживается данным браузером
      }
    }

    // 6. Long Tasks (> 50 мс) — немедленное логирование узких мест
    if (isSupportedEntryType('longtask')) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries() as unknown as LongTaskEntryLike[];
          for (const entry of entries) {
            const bottleneck = extractLongTaskBottleneck(
              entry,
              latestRouteRef.current,
              longTaskThresholdMs
            );
            if (!bottleneck) continue;

            longTaskCount += 1;
            totalLongTaskBlockingMs += Math.max(
              0,
              bottleneck.durationMs - longTaskThresholdMs
            );
            console.warn(formatLongTaskLogLine(bottleneck), bottleneck);
          }
        });
        longTaskObserver.observe({ type: 'longtask', buffered: true });
        observers.push(longTaskObserver);
      } catch {
        // Не поддерживается данным браузером
      }
    }

    const flushVitalsSummary = (reason: 'pagehide' | 'hidden' | 'unmount') => {
      if (isSessionFlushed) return;
      isSessionFlushed = true;

      if (latestLcpEntry) {
        recordMetric(
          createWebVitalSnapshot(
            'LCP',
            latestLcpEntry.startTime,
            latestRouteRef.current,
            describeElementSelector(latestLcpEntry.element)
          ),
          false
        );
      }

      recordMetric(
        createWebVitalSnapshot(
          'CLS',
          clsAccumulator.getMaxScore(),
          latestRouteRef.current
        ),
        false
      );

      const inpMs = inpTracker.getInpMs();
      if (inpMs !== null) {
        recordMetric(
          createWebVitalSnapshot('INP', inpMs, latestRouteRef.current),
          false
        );
      }

      if (metricsMap.size > 0 || longTaskCount > 0) {
        console.info(
          `[FMWorks Perf] Core Web Vitals summary (${reason}) on ${latestRouteRef.current}`,
          {
            metrics: Object.fromEntries(metricsMap.entries()),
            longTasks: {
              count: longTaskCount,
              totalBlockingTimeMs:
                Math.round(totalLongTaskBlockingMs * 10) / 10,
            },
          }
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushVitalsSummary('hidden');
      }
    };

    const handlePageHide = () => {
      flushVitalsSummary('pagehide');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      for (const observer of observers) {
        observer.disconnect();
      }
      flushVitalsSummary('unmount');
    };
  }, [enabled, longTaskThresholdMs]);

  return null;
}
