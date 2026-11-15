import {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  TouchEvent as ReactTouchEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

export const SYNTHETIC_CLICK_SUPPRESSION_MS = 520;
export const OPTIMISTIC_SCRUB_HOLD_MS = 240;

export function clampScrubRatio(rawRatio: number): number {
  if (!Number.isFinite(rawRatio)) return 0;
  return Math.min(1, Math.max(0, rawRatio));
}

export function computeTrackPointerRatio(
  clientX: number,
  rectLeft: number,
  rectWidth: number
): number | null {
  if (!Number.isFinite(clientX) || !Number.isFinite(rectLeft) || !Number.isFinite(rectWidth)) {
    return null;
  }
  if (rectWidth <= 1) return null;
  return clampScrubRatio((clientX - rectLeft) / rectWidth);
}

/**
 * Определяет, должен ли нативный обработчик `click` зафиксировать перемотку:
 * если только что завершился жест `pointerup` / `touchend`, дублирующий синтетический `click`
 * на мобильных браузерах пропускается, чтобы не перезапускать аудиопоток дважды.
 */
export function shouldCommitClickAfterPointerOrTouch(
  nowMs: number,
  suppressUntilMs: number
): boolean {
  return nowMs > suppressUntilMs;
}

/**
 * Возвращает эффективную долю прогресса дорожки (0..1):
 * во время удержания пальца или короткого окна оптимистичной фиксации отдаёт позицию пальца,
 * исключая визуальный отскок каретки к старой секунде до прихода следующего тика движка.
 */
export function resolveEffectiveDisplayRatio(params: {
  engineRatio: number;
  activeScrubRatio: number | null;
  optimisticRatio: number | null;
}): number {
  if (params.activeScrubRatio !== null) {
    return clampScrubRatio(params.activeScrubRatio);
  }
  if (params.optimisticRatio !== null) {
    return clampScrubRatio(params.optimisticRatio);
  }
  return clampScrubRatio(params.engineRatio);
}

export interface UseAudioTrackScrubberOptions {
  trackRef: RefObject<HTMLElement | null>;
  engineRatio: number;
  isInteractive: boolean;
  stepRatio?: number;
  onScrubStart?: () => void;
  onCommitRatio?: (ratio: number) => void;
}

export interface AudioTrackScrubberBindings {
  displayRatio: number;
  hoverRatio: number | null;
  isScrubbing: boolean;
  eventHandlers: {
    onClick?: (e: ReactMouseEvent<HTMLElement>) => void;
    onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove?: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp?: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel?: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerLeave?: () => void;
    onTouchStart?: (e: ReactTouchEvent<HTMLElement>) => void;
    onTouchMove?: (e: ReactTouchEvent<HTMLElement>) => void;
    onTouchEnd?: (e: ReactTouchEvent<HTMLElement>) => void;
    onTouchCancel?: () => void;
    onKeyDown?: (e: ReactKeyboardEvent<HTMLElement>) => void;
  };
}

/**
 * Унифицированный контроллер мобильной и десктопной перемотки аудиодорожки:
 * - на `pointerdown` / `touchstart` прогревает ленивый аудиодвижок (`onScrubStart`),
 * - во время движения пальца плавно ведёт каретку в 60fps без перезапуска WebAudio/HTMLAudio на каждый пиксель,
 * - на `pointerup` / `touchend` фиксирует итоговую секунду ровно один раз в рамках доверенного жеста браузера,
 * - подавляет дублирующий мобильный синтетический `click`.
 */
export function useAudioTrackScrubber({
  trackRef,
  engineRatio,
  isInteractive,
  stepRatio = 0.04,
  onScrubStart,
  onCommitRatio,
}: UseAudioTrackScrubberOptions): AudioTrackScrubberBindings {
  const [activeScrubRatio, setActiveScrubRatio] = useState<number | null>(null);
  const [optimisticRatio, setOptimisticRatio] = useState<number | null>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  const activeModeRef = useRef<'none' | 'pointer' | 'touch'>('none');
  const latestRatioRef = useRef<number | null>(null);
  const suppressClickUntilRef = useRef<number>(0);
  const optimisticTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (optimisticTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(optimisticTimerRef.current);
      }
    };
  }, []);

  const readRatioAtClientX = (clientX: number): number | null => {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return computeTrackPointerRatio(clientX, rect.left, rect.width);
  };

  const finalizeCommit = (ratio: number | null) => {
    activeModeRef.current = 'none';
    setActiveScrubRatio(null);
    if (ratio === null || !onCommitRatio) {
      latestRatioRef.current = null;
      return;
    }

    const clamped = clampScrubRatio(ratio);
    latestRatioRef.current = null;
    suppressClickUntilRef.current = performance.now() + SYNTHETIC_CLICK_SUPPRESSION_MS;

    setOptimisticRatio(clamped);
    if (typeof window !== 'undefined') {
      if (optimisticTimerRef.current !== null) {
        window.clearTimeout(optimisticTimerRef.current);
      }
      optimisticTimerRef.current = window.setTimeout(() => {
        setOptimisticRatio(null);
        optimisticTimerRef.current = null;
      }, OPTIMISTIC_SCRUB_HOLD_MS);
    }

    onCommitRatio(clamped);
  };

  const cancelGesture = () => {
    activeModeRef.current = 'none';
    latestRatioRef.current = null;
    setActiveScrubRatio(null);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!isInteractive) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    e.stopPropagation();
    activeModeRef.current = 'pointer';
    onScrubStart?.();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Игнорируем синтетические события в тестовых или старых WebView средах
    }

    const r = readRatioAtClientX(e.clientX);
    if (r !== null) {
      latestRatioRef.current = r;
      setActiveScrubRatio(r);
      if (e.pointerType === 'mouse') {
        setHoverRatio(r);
      }
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!isInteractive) return;
    const r = readRatioAtClientX(e.clientX);
    if (e.pointerType === 'mouse') {
      setHoverRatio(r);
    }
    if (activeModeRef.current === 'pointer' && r !== null) {
      latestRatioRef.current = r;
      setActiveScrubRatio(r);
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (!isInteractive) return;
    if (activeModeRef.current !== 'pointer') return;
    e.stopPropagation();

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    const r = readRatioAtClientX(e.clientX) ?? latestRatioRef.current;
    finalizeCommit(r);
  };

  const handlePointerCancel = (e: ReactPointerEvent<HTMLElement>) => {
    if (activeModeRef.current !== 'pointer') return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
    // Если палец успел сместиться по дорожке до отмены — мягко сбрасываем без скачка
    cancelGesture();
  };

  const handleTouchStart = (e: ReactTouchEvent<HTMLElement>) => {
    if (!isInteractive) return;
    // Если PointerEvent уже перехватил жест, не дублируем обработку
    if (activeModeRef.current === 'pointer') return;
    const touch = e.touches[0] ?? e.changedTouches[0];
    if (!touch) return;

    e.stopPropagation();
    activeModeRef.current = 'touch';
    onScrubStart?.();

    const r = readRatioAtClientX(touch.clientX);
    if (r !== null) {
      latestRatioRef.current = r;
      setActiveScrubRatio(r);
    }
  };

  const handleTouchMove = (e: ReactTouchEvent<HTMLElement>) => {
    if (!isInteractive || activeModeRef.current !== 'touch') return;
    const touch = e.touches[0] ?? e.changedTouches[0];
    if (!touch) return;

    const r = readRatioAtClientX(touch.clientX);
    if (r !== null) {
      latestRatioRef.current = r;
      setActiveScrubRatio(r);
    }
  };

  const handleTouchEnd = (e: ReactTouchEvent<HTMLElement>) => {
    if (!isInteractive || activeModeRef.current !== 'touch') return;
    e.stopPropagation();

    const touch = e.changedTouches[0] ?? e.touches[0];
    const r = (touch ? readRatioAtClientX(touch.clientX) : null) ?? latestRatioRef.current;
    finalizeCommit(r);
  };

  const handleClick = (e: ReactMouseEvent<HTMLElement>) => {
    if (!isInteractive || !onCommitRatio) return;
    e.stopPropagation();
    if (!shouldCommitClickAfterPointerOrTouch(performance.now(), suppressClickUntilRef.current)) {
      return;
    }
    const r = readRatioAtClientX(e.clientX);
    if (r !== null) {
      finalizeCommit(r);
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (!isInteractive || !onCommitRatio) return;
    const base = resolveEffectiveDisplayRatio({
      engineRatio,
      activeScrubRatio,
      optimisticRatio,
    });
    const safeStep = Math.max(0.01, Math.min(0.25, stepRatio));
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      finalizeCommit(Math.min(1, base + safeStep));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      finalizeCommit(Math.max(0, base - safeStep));
    } else if (e.key === 'Home') {
      e.preventDefault();
      finalizeCommit(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      finalizeCommit(1);
    }
  };

  const displayRatio = resolveEffectiveDisplayRatio({
    engineRatio,
    activeScrubRatio,
    optimisticRatio,
  });

  return {
    displayRatio,
    hoverRatio,
    isScrubbing: activeScrubRatio !== null,
    eventHandlers: isInteractive
      ? {
          onClick: handleClick,
          onPointerDown: handlePointerDown,
          onPointerMove: handlePointerMove,
          onPointerUp: handlePointerUp,
          onPointerCancel: handlePointerCancel,
          onPointerLeave: () => setHoverRatio(null),
          onTouchStart: handleTouchStart,
          onTouchMove: handleTouchMove,
          onTouchEnd: handleTouchEnd,
          onTouchCancel: cancelGesture,
          onKeyDown: handleKeyDown,
        }
      : {},
  };
}
