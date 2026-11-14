import {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface AcousticFilamentNode {
  x: number;
  yTop: number;
  yBottom: number;
}

export interface AcousticRibbonGeometry {
  closedAreaPath: string;
  upperCrestPath: string;
  lowerCrestPath: string;
  filaments: readonly AcousticFilamentNode[];
}

export interface WaveformSegmentZone {
  id: string;
  startRatio: number;
  endRatio: number;
  kind: 'program' | 'splice' | 'competitor' | 'target';
}

const VIEWBOX_WIDTH = 600;
const VIEWBOX_HEIGHT = 44;
const CENTER_Y = 26;
const MAX_UPPER_AMP = 22.5;
const MAX_LOWER_AMP = 14.2;
const SAMPLE_COUNT = 92;

function hashSeedString(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

/**
 * Генерирует выразительный студийный контур голосовой и музыкальной мастер-дорожки
 * (с акцентированными слоговыми пиками и естественными воздушными паузами дыхания),
 * чтобы даже до нажатия Play волна читалась как дорогой студийный мастер, а не плоская линия.
 */
export function computeStudioStemContour(
  seedKey: string,
  count = SAMPLE_COUNT
): number[] {
  const seed = hashSeedString(seedKey || 'fmworks');
  const phaseA = (seed % 360) * (Math.PI / 180);
  const phaseB = ((seed >> 5) % 360) * (Math.PI / 180);
  const phaseC = ((seed >> 11) % 360) * (Math.PI / 180);
  const phraseCount = 4.4 + (seed % 5) * 0.38;

  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);

    const edgeWindow = Math.sin(Math.PI * Math.min(0.985, Math.max(0.015, t)));
    const edgeTaper = Math.pow(edgeWindow, 0.32);

    const rawPhrase = Math.sin(t * Math.PI * phraseCount + phaseA);
    const phraseGate = Math.pow(0.5 + 0.5 * rawPhrase, 1.35);

    const syllableA = 0.5 + 0.5 * Math.sin(t * 46.0 + phaseB);
    const syllableB = 0.5 + 0.5 * Math.cos(t * 79.0 - phaseC);
    const microTransient = 0.5 + 0.5 * Math.sin(t * 131.0 + phaseA * 1.7);

    const vocalEnergy =
      0.11 +
      phraseGate * (0.34 + 0.36 * syllableA + 0.22 * syllableB + 0.14 * microTransient);

    const sculpted = vocalEnergy * edgeTaper;
    values.push(Math.min(0.96, Math.max(0.09, sculpted)));
  }

  return values;
}

/**
 * Строит композитный контур длинного радиоэфира по зонам:
 * живая передача -> отбивка рекламы -> плотный зажатый блок конкурентов -> скульптурный целевой слот -> возврат в эфир.
 */
export function computeSegmentedBroadcastContour(
  seedKey: string,
  zones: readonly WaveformSegmentZone[],
  count = 128
): number[] {
  if (zones.length === 0) {
    return computeStudioStemContour(seedKey, count);
  }

  const seed = hashSeedString(seedKey || 'aircheck');
  const phase = (seed % 360) * (Math.PI / 180);
  const values: number[] = [];

  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const zone =
      zones.find((z) => t >= z.startRatio && t <= z.endRatio) ??
      zones[zones.length - 1];
    const span = Math.max(0.01, zone.endRatio - zone.startRatio);
    const localT = Math.min(1, Math.max(0, (t - zone.startRatio) / span));

    let amp = 0.4;
    if (zone.kind === 'program') {
      // Живая разговорная передача с естественным дыханием ведущих
      const phrase = Math.pow(0.5 + 0.5 * Math.sin(localT * Math.PI * 6.5 + phase), 1.45);
      const syll =
        0.45 +
        0.32 * Math.sin(t * 88.0 + phase) +
        0.23 * Math.cos(t * 143.0 - phase * 0.6);
      amp = 0.12 + phrase * 0.68 * syll;
    } else if (zone.kind === 'splice') {
      // Короткая энергичная музыкальная отбивка рекламной склейки
      const bell = Math.sin(Math.PI * Math.min(0.96, Math.max(0.04, localT)));
      amp = 0.48 + 0.44 * bell * (0.75 + 0.25 * Math.sin(t * 170));
    } else if (zone.kind === 'competitor') {
      // Пережатая «кирпичом» рекламная скороговорка конкурентов без воздуха
      const ripple =
        0.74 +
        0.13 * Math.sin(t * 155.0 + phase * 1.3) +
        0.09 * Math.cos(t * 211.0);
      amp = Math.min(0.9, Math.max(0.56, ripple));
    } else {
      // Целевой слот: заметная стартовая пауза 0.4с и выразительная студийная драматургия
      if (localT < 0.11) {
        amp = 0.1;
      } else {
        const activeLocal = (localT - 0.11) / 0.89;
        const arch = Math.sin(Math.PI * Math.min(0.96, Math.max(0.08, activeLocal)));
        const voice =
          0.52 +
          0.32 * Math.sin(activeLocal * Math.PI * 3.4 + phase) +
          0.22 * Math.cos(t * 118.0);
        amp = 0.18 + 0.78 * Math.pow(arch, 0.35) * voice;
      }
    }

    const edgeTaper = Math.pow(
      Math.sin(Math.PI * Math.min(0.99, Math.max(0.01, t))),
      0.22
    );
    values.push(Math.min(0.96, Math.max(0.09, amp * edgeTaper)));
  }

  return values;
}

/**
 * Смешивает архитектуру студийного мастера с живым спектром,
 * сохраняя выразительный рельеф волны как в покое, так и при воспроизведении.
 */
export function interpolateActiveSpectrumContour(
  baseContour: readonly number[],
  spectrumBands: readonly number[] | undefined,
  isActive: boolean,
  reducedMotion: boolean
): number[] {
  const n = baseContour.length;
  if (!isActive || reducedMotion || !spectrumBands || spectrumBands.length === 0) {
    return baseContour.map((v) =>
      isActive ? Math.min(0.97, v * 1.06 + 0.04) : Math.max(0.09, v * 0.86)
    );
  }

  const bandLen = spectrumBands.length;
  const hasLiveEnergy = spectrumBands.some((b) => b > 0.04);
  if (!hasLiveEnergy) {
    return baseContour.map((v) => Math.min(0.97, v * 1.04 + 0.03));
  }

  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const u = t * (bandLen - 1);
    const idx0 = Math.floor(u);
    const idx1 = Math.min(bandLen - 1, idx0 + 1);
    const frac = u - idx0;

    const b0 = spectrumBands[idx0] ?? 0.24;
    const b1 = spectrumBands[idx1] ?? b0;
    const liveVal = b0 + (b1 - b0) * frac;

    const edgeTaper = Math.pow(
      Math.sin(Math.PI * Math.min(0.985, Math.max(0.015, t))),
      0.28
    );
    const blended = (liveVal * 0.56 + baseContour[i] * 0.54) * edgeTaper;
    out.push(Math.min(0.98, Math.max(0.1, blended)));
  }

  return out.map((val, idx) => {
    const prev = out[Math.max(0, idx - 1)] ?? val;
    const next = out[Math.min(out.length - 1, idx + 1)] ?? val;
    return prev * 0.18 + val * 0.64 + next * 0.18;
  });
}

function buildSmoothCubicCurve(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  const tension = 0.2;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return d;
}

export function buildSmoothAcousticRibbonPaths(
  amplitudes: readonly number[]
): AcousticRibbonGeometry {
  const n = amplitudes.length;
  if (n < 2) {
    const flat = `M 0 ${CENTER_Y} L ${VIEWBOX_WIDTH} ${CENTER_Y}`;
    return {
      closedAreaPath: flat,
      upperCrestPath: flat,
      lowerCrestPath: flat,
      filaments: [],
    };
  }

  const upperPts: { x: number; y: number }[] = [];
  const lowerPts: { x: number; y: number }[] = [];
  const filaments: AcousticFilamentNode[] = [];

  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * VIEWBOX_WIDTH;
    const amp = Math.min(1, Math.max(0.06, amplitudes[i] ?? 0.12));
    const yTop = CENTER_Y - amp * MAX_UPPER_AMP;
    const yBottom = CENTER_Y + amp * MAX_LOWER_AMP;
    upperPts.push({ x, y: yTop });
    lowerPts.push({ x, y: yBottom });
    filaments.push({
      x,
      yTop: yTop + 0.9,
      yBottom: CENTER_Y + amp * MAX_LOWER_AMP * 0.78,
    });
  }

  const upperCrestPath = buildSmoothCubicCurve(upperPts);
  const lowerCrestPath = buildSmoothCubicCurve(lowerPts);
  const reversedLower = [...lowerPts].reverse();
  const lowerReverseCurve = buildSmoothCubicCurve(reversedLower).replace(/^M [^C]+/, '');

  const closedAreaPath = `${upperCrestPath} L ${reversedLower[0].x.toFixed(2)} ${reversedLower[0].y.toFixed(2)}${lowerReverseCurve} Z`;

  return {
    closedAreaPath,
    upperCrestPath,
    lowerCrestPath,
    filaments,
  };
}

export interface PremiumAcousticWaveformProps {
  seedKey: string;
  isActive: boolean;
  progressRatio: number;
  spectrumBands?: readonly number[];
  segmentZones?: readonly WaveformSegmentZone[];
  onSeekRatio?: (ratio: number) => void;
  seekAriaLabel?: string;
  reducedMotion?: boolean;
  /** Светлая волна на тёмных студийных поверхностях ('dark-surface') или адаптивная ('adaptive') */
  variant?: 'dark-surface' | 'adaptive';
  heightClass?: string;
  visualizerTestId?: string;
  visualizerMode?: string;
  progressBarTestId?: string;
  ariaLabel?: string;
  ariaValueNow?: number;
  ariaValueText?: string;
}

export function PremiumAcousticWaveform({
  seedKey,
  isActive,
  progressRatio,
  spectrumBands,
  segmentZones,
  onSeekRatio,
  seekAriaLabel,
  reducedMotion = false,
  variant = 'dark-surface',
  heightClass = 'h-10',
  visualizerTestId,
  visualizerMode = 'idle',
  progressBarTestId,
  ariaLabel,
  ariaValueNow = 0,
  ariaValueText,
}: PremiumAcousticWaveformProps) {
  const gradUid = useId().replace(/:/g, '');
  const trackRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  const clampedRatio = Math.min(
    1,
    Math.max(0, Number.isFinite(progressRatio) ? progressRatio : 0)
  );
  const clipRightPct = Math.max(0, Math.min(100, (1 - clampedRatio) * 100));

  const baseContour = useMemo(
    () =>
      segmentZones && segmentZones.length > 0
        ? computeSegmentedBroadcastContour(seedKey, segmentZones, 128)
        : computeStudioStemContour(seedKey, SAMPLE_COUNT),
    [seedKey, segmentZones]
  );

  const amplitudes = useMemo(
    () =>
      interpolateActiveSpectrumContour(
        baseContour,
        spectrumBands,
        isActive,
        reducedMotion
      ),
    [baseContour, spectrumBands, isActive, reducedMotion]
  );

  const geometry = useMemo(
    () => buildSmoothAcousticRibbonPaths(amplitudes),
    [amplitudes]
  );

  const isDarkSurface = variant === 'dark-surface';
  const isInteractive = typeof onSeekRatio === 'function';

  const resolvePointerRatio = (clientX: number): number | null => {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 1) return null;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onSeekRatio) return;
    isDraggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events without pointer capture support
    }
    const r = resolvePointerRatio(e.clientX);
    if (r !== null) onSeekRatio(r);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onSeekRatio) return;
    const r = resolvePointerRatio(e.clientX);
    setHoverRatio(r);
    if (isDraggingRef.current && r !== null) {
      onSeekRatio(r);
    }
  };

  const handlePointerUpOrCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onSeekRatio) return;
    isDraggingRef.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
  };

  const handleClickFallback = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!onSeekRatio) return;
    const r = resolvePointerRatio(e.clientX);
    if (r !== null) onSeekRatio(r);
  };

  const targetZone = segmentZones?.find((z) => z.kind === 'target') ?? null;

  return (
    <div
      ref={trackRef}
      role={isInteractive ? 'slider' : ariaLabel ? 'progressbar' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={seekAriaLabel ?? ariaLabel}
      aria-valuemin={isInteractive || ariaLabel ? 0 : undefined}
      aria-valuemax={isInteractive || ariaLabel ? 100 : undefined}
      aria-valuenow={
        isInteractive ? Math.round(clampedRatio * 100) : ariaLabel ? ariaValueNow : undefined
      }
      aria-valuetext={ariaLabel ? ariaValueText : undefined}
      data-testid={progressBarTestId}
      data-playing={isActive ? 'true' : 'false'}
      data-mode={visualizerMode}
      onClick={isInteractive ? handleClickFallback : undefined}
      onPointerDown={isInteractive ? handlePointerDown : undefined}
      onPointerMove={isInteractive ? handlePointerMove : undefined}
      onPointerUp={isInteractive ? handlePointerUpOrCancel : undefined}
      onPointerCancel={isInteractive ? handlePointerUpOrCancel : undefined}
      onPointerLeave={isInteractive ? () => setHoverRatio(null) : undefined}
      onKeyDown={
        isInteractive && onSeekRatio
          ? (e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                onSeekRatio(Math.min(1, clampedRatio + 0.04));
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                onSeekRatio(Math.max(0, clampedRatio - 0.04));
              }
            }
          : undefined
      }
      className={`relative w-full ${heightClass} select-none overflow-hidden ${
        isInteractive
          ? 'pointer-events-auto cursor-pointer touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4820]'
          : 'pointer-events-none'
      }`}
    >
      <div
        aria-hidden="true"
        data-testid={visualizerTestId}
        data-active={isActive ? 'true' : 'false'}
        data-mode={visualizerMode}
        className="relative w-full h-full"
      >
        {/* Деликатная подсветка зоны целевого слота внутри длинного эфирного блока */}
        {targetZone && (
          <div
            style={{
              left: `${(targetZone.startRatio * 100).toFixed(2)}%`,
              width: `${((targetZone.endRatio - targetZone.startRatio) * 100).toFixed(2)}%`,
            }}
            className="absolute inset-y-0 bg-[#FF4820]/[0.11] border-x border-[#FF4820]/45"
          />
        )}

        {/* Тонкие вертикальные засечки границ эфирных сегментов */}
        {segmentZones &&
          segmentZones.slice(1).map((zone) => (
            <span
              key={zone.id}
              style={{
                left: `${(zone.startRatio * 100).toFixed(2)}%`,
              }}
              className={`absolute inset-y-0 w-px ${
                zone.kind === 'target'
                  ? 'bg-[#FF4820]/50'
                  : 'bg-white/[0.14]'
              }`}
            />
          ))}

        {/* Базовый скульптурный слой студийной акустической дорожки */}
        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id={`idle-fill-${gradUid}`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={isDarkSurface ? '#FFFFFF' : 'currentColor'}
                stopOpacity={isActive ? 0.34 : 0.28}
              />
              <stop
                offset="58%"
                stopColor={isDarkSurface ? '#FFFFFF' : 'currentColor'}
                stopOpacity={isActive ? 0.16 : 0.13}
              />
              <stop
                offset="100%"
                stopColor={isDarkSurface ? '#FFFFFF' : 'currentColor'}
                stopOpacity={isActive ? 0.06 : 0.04}
              />
            </linearGradient>
          </defs>

          <line
            x1="0"
            y1={CENTER_Y}
            x2={VIEWBOX_WIDTH}
            y2={CENTER_Y}
            stroke={isDarkSurface ? 'rgba(255,255,255,0.22)' : 'currentColor'}
            strokeOpacity={isDarkSurface ? 1 : 0.18}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />

          <path d={geometry.closedAreaPath} fill={`url(#idle-fill-${gradUid})`} />

          <g
            stroke={isDarkSurface ? '#FFFFFF' : 'currentColor'}
            strokeOpacity={isActive ? 0.34 : 0.24}
            strokeWidth="1.45"
            strokeLinecap="round"
          >
            {geometry.filaments.map((f, idx) => (
              <line
                key={idx}
                x1={f.x.toFixed(2)}
                y1={f.yTop.toFixed(2)}
                x2={f.x.toFixed(2)}
                y2={f.yBottom.toFixed(2)}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>

          <path
            d={geometry.upperCrestPath}
            fill="none"
            stroke={isDarkSurface ? '#FFFFFF' : 'currentColor'}
            strokeOpacity={isActive ? 0.68 : 0.52}
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          <path
            d={geometry.lowerCrestPath}
            fill="none"
            stroke={isDarkSurface ? '#FFFFFF' : 'currentColor'}
            strokeOpacity={isActive ? 0.26 : 0.18}
            strokeWidth="1"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Прослушанный активный слой в фирменном киноварном свечении */}
        <div
          style={{
            clipPath: `inset(0 ${clipRightPct.toFixed(2)}% 0 0)`,
          }}
          className="absolute inset-0 w-full h-full will-change-[clip-path]"
        >
          <svg
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            preserveAspectRatio="none"
            className="w-full h-full overflow-visible"
          >
            <defs>
              <linearGradient id={`active-fill-${gradUid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF8A65" stopOpacity="0.95" />
                <stop offset="58%" stopColor="#FF4820" stopOpacity="0.74" />
                <stop offset="100%" stopColor="#FF4820" stopOpacity="0.18" />
              </linearGradient>
            </defs>

            <line
              x1="0"
              y1={CENTER_Y}
              x2={VIEWBOX_WIDTH}
              y2={CENTER_Y}
              stroke="#FF4820"
              strokeOpacity="0.82"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />

            <path d={geometry.closedAreaPath} fill={`url(#active-fill-${gradUid})`} />

            <g
              stroke="#FF9E80"
              strokeOpacity="0.62"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              {geometry.filaments.map((f, idx) => (
                <line
                  key={idx}
                  x1={f.x.toFixed(2)}
                  y1={f.yTop.toFixed(2)}
                  x2={f.x.toFixed(2)}
                  y2={f.yBottom.toFixed(2)}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>

            <path
              d={geometry.upperCrestPath}
              fill="none"
              stroke="#FFB8A1"
              strokeWidth="1.55"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />

            <path
              d={geometry.lowerCrestPath}
              fill="none"
              stroke="#FF4820"
              strokeOpacity="0.68"
              strokeWidth="1.05"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        {/* Линия предпросмотра курсора при наведении на интерактивную волну */}
        {isInteractive && hoverRatio !== null && (
          <span
            style={{
              left: `${(hoverRatio * 100).toFixed(2)}%`,
            }}
            className="absolute inset-y-0 w-px -translate-x-1/2 bg-white/45"
          />
        )}

        {/* Световая каретка текущего момента воспроизведения */}
        {(isActive || clampedRatio > 0.004) && clampedRatio < 0.998 && (
          <span
            style={{
              left: `${(clampedRatio * 100).toFixed(2)}%`,
            }}
            className="absolute top-0.5 bottom-0.5 w-[1.5px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,72,32,0.95)]"
          />
        )}
      </div>
    </div>
  );
}
