import { useEffect, useRef } from 'react';
import {
  DEFAULT_WEB_VITALS_ENDPOINT,
  WebVitals,
} from '../utils/performance';
import {
  DEFAULT_LONG_TASK_THRESHOLD_MS,
  extractLongTaskBottleneck,
  formatLongTaskLogLine,
  LongTaskEntryLike,
} from '../utils/performanceMetrics';

export interface PerformanceMonitorProps {
  enabled?: boolean;
  longTaskThresholdMs?: number;
  routeKey?: string;
}

function isSupportedEntryType(type: string): boolean {
  if (typeof PerformanceObserver === 'undefined') return false;
  const supported = PerformanceObserver.supportedEntryTypes;
  return Array.isArray(supported) && supported.includes(type);
}

/**
 * Безголовый компонент мониторинга Core Web Vitals (`CLS`, `LCP`, `FID`, `INP`, `FCP`, `TTFB`)
 * через библиотеку `web-vitals` (`WebVitals`) и длинных задач (Long Tasks > 50 мс) без вывода в UI.
 */
export function PerformanceMonitor({
  enabled = true,
  longTaskThresholdMs = DEFAULT_LONG_TASK_THRESHOLD_MS,
  routeKey = '/',
}: PerformanceMonitorProps) {
  const latestRouteRef = useRef<string>(routeKey);
  latestRouteRef.current = routeKey;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    const stopWebVitals = WebVitals.init({
      endpoint: DEFAULT_WEB_VITALS_ENDPOINT,
      logToConsole: true,
      reportAllChanges: false,
      getRoute: () => latestRouteRef.current,
    });

    let longTaskObserver: PerformanceObserver | null = null;
    let longTaskCount = 0;
    let totalLongTaskBlockingMs = 0;
    let isSessionFlushed = false;

    if (
      typeof performance !== 'undefined' &&
      isSupportedEntryType('longtask')
    ) {
      try {
        longTaskObserver = new PerformanceObserver((list) => {
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
      } catch {
        // Не поддерживается данным браузером
      }
    }

    const flushVitalsSummary = (reason: 'pagehide' | 'hidden' | 'unmount') => {
      if (isSessionFlushed) return;
      isSessionFlushed = true;

      const collectedMetrics = WebVitals.getCollectedMetrics();
      if (Object.keys(collectedMetrics).length > 0 || longTaskCount > 0) {
        console.info(
          `[FMWorks Perf] Core Web Vitals summary (${reason}) on ${latestRouteRef.current}`,
          {
            metrics: collectedMetrics,
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
      if (longTaskObserver) {
        longTaskObserver.disconnect();
      }
      stopWebVitals();
      flushVitalsSummary('unmount');
    };
  }, [enabled, longTaskThresholdMs]);

  return null;
}
