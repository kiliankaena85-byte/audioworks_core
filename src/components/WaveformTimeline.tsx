import { useId, useMemo, useRef } from 'react';
import { formatAudioTime } from '../data/audioworksCommercial';
import { useAudioTrackScrubber } from '../utils/audioScrubbing';
import {
  BroadcastSegmentId,
  BroadcastSegmentKind,
  BroadcastTimelineSegment,
  InsertedSpotMode,
} from '../data/broadcastAircheckData';

export const TIMELINE_VIEWBOX_WIDTH = 750;
export const TIMELINE_VIEWBOX_HEIGHT = 48;
const CENTER_Y = 27;
const MAX_UPPER_AMP = 22.5;
const MAX_LOWER_AMP = 14.5;
export const DEFAULT_TIMELINE_SAMPLE_COUNT = 150;
export const DEFAULT_BLOCK_DURATION_SEC = 150;

export interface SegmentVisualProfile {
  kind: BroadcastSegmentKind;
  legendLabel: string;
  idleCrestStroke: string;
  idleLowerStroke: string;
  idleFilamentStroke: string;
  idleFillTop: string;
  idleFillBottom: string;
  playedCrestStroke: string;
  playedLowerStroke: string;
  playedFilamentStroke: string;
  playedFillTop: string;
  playedFillBottom: string;
}

export const SEGMENT_VISUAL_PROFILES: Readonly<
  Record<BroadcastSegmentKind, SegmentVisualProfile>
> = {
  program: {
    kind: 'program',
    legendLabel: 'Эфир станции',
    idleCrestStroke: 'rgba(203, 213, 225, 0.64)',
    idleLowerStroke: 'rgba(203, 213, 225, 0.24)',
    idleFilamentStroke: 'rgba(203, 213, 225, 0.25)',
    idleFillTop: 'rgba(148, 163, 184, 0.26)',
    idleFillBottom: 'rgba(148, 163, 184, 0.04)',
    playedCrestStroke: '#F8FAFC',
    playedLowerStroke: 'rgba(226, 232, 240, 0.62)',
    playedFilamentStroke: 'rgba(248, 250, 252, 0.56)',
    playedFillTop: 'rgba(226, 232, 240, 0.58)',
    playedFillBottom: 'rgba(148, 163, 184, 0.12)',
  },
  splice: {
    kind: 'splice',
    legendLabel: 'Склейка',
    idleCrestStroke: '#FBBF24',
    idleLowerStroke: 'rgba(251, 191, 36, 0.44)',
    idleFilamentStroke: 'rgba(251, 191, 36, 0.46)',
    idleFillTop: 'rgba(245, 158, 11, 0.40)',
    idleFillBottom: 'rgba(245, 158, 11, 0.07)',
    playedCrestStroke: '#FDE68A',
    playedLowerStroke: '#F59E0B',
    playedFilamentStroke: 'rgba(253, 230, 138, 0.80)',
    playedFillTop: 'rgba(251, 191, 36, 0.84)',
    playedFillBottom: 'rgba(245, 158, 11, 0.20)',
  },
  competitor: {
    kind: 'competitor',
    legendLabel: 'Реклама конкурентов',
    idleCrestStroke: 'rgba(214, 158, 110, 0.68)',
    idleLowerStroke: 'rgba(214, 158, 110, 0.30)',
    idleFilamentStroke: 'rgba(214, 158, 110, 0.32)',
    idleFillTop: 'rgba(194, 132, 82, 0.30)',
    idleFillBottom: 'rgba(120, 83, 55, 0.06)',
    playedCrestStroke: '#FDBA74',
    playedLowerStroke: 'rgba(251, 146, 60, 0.58)',
    playedFilamentStroke: 'rgba(253, 186, 116, 0.60)',
    playedFillTop: 'rgba(234, 88, 12, 0.58)',
    playedFillBottom: 'rgba(234, 88, 12, 0.14)',
  },
  target: {
    kind: 'target',
    legendLabel: 'Целевой ролик',
    idleCrestStroke: '#FF6B4A',
    idleLowerStroke: 'rgba(255, 72, 32, 0.50)',
    idleFilamentStroke: 'rgba(255, 107, 74, 0.48)',
    idleFillTop: 'rgba(255, 72, 32, 0.48)',
    idleFillBottom: 'rgba(255, 72, 32, 0.10)',
    playedCrestStroke: '#FFD0C2',
    playedLowerStroke: '#FF4820',
    playedFilamentStroke: 'rgba(255, 184, 161, 0.84)',
    playedFillTop: '#FF7A59',
    playedFillBottom: 'rgba(255, 72, 32, 0.24)',
  },
};

export interface TimelineAmplitudeSample {
  index: number;
  ratio: number;
  timeSec: number;
  x: number;
  yTop: number;
  yBottom: number;
  amplitude: number;
  segmentId: BroadcastSegmentId;
  kind: BroadcastSegmentKind;
}

export interface RenderedSegmentLayer {
  id: BroadcastSegmentId;
  kind: BroadcastSegmentKind;
  title: string;
  compactLabel: string;
  startSec: number;
  endSec: number;
  startRatio: number;
  endRatio: number;
  startX: number;
  widthX: number;
  isTargetSlot: boolean;
  isActive: boolean;
  profile: SegmentVisualProfile;
}

export interface TimelineGeometryResult {
  totalDurationSec: number;
  samples: readonly TimelineAmplitudeSample[];
  closedAreaPath: string;
  upperCrestPath: string;
  lowerCrestPath: string;
  segmentLayers: readonly RenderedSegmentLayer[];
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function buildCubicBezierPath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  const tension = 0.19;

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

export function createDefault150sSegments(): readonly BroadcastTimelineSegment[] {
  const specs: Array<{
    id: BroadcastSegmentId;
    kind: BroadcastSegmentKind;
    shortStepLabel: string;
    compactWaveLabel: string;
    title: string;
    subtitle: string;
    durationSec: number;
    isTargetSlot: boolean;
  }> = [
    {
      id: 'program_leadin',
      kind: 'program',
      shortStepLabel: '01 · Живой эфир',
      compactWaveLabel: 'Эфир',
      title: 'Живой региональный эфир перед рекламным блоком',
      subtitle: 'Разговорная рубрика ведущих',
      durationSec: 54,
      isTargetSlot: false,
    },
    {
      id: 'ad_jingle_in',
      kind: 'splice',
      shortStepLabel: '02 · Рекламная склейка',
      compactWaveLabel: 'Склейка',
      title: 'Эфирная отбивка перехода к рекламе',
      subtitle: 'Сигнал начала коммерческого блока',
      durationSec: 4,
      isTargetSlot: false,
    },
    {
      id: 'competitor_before_1',
      kind: 'competitor',
      shortStepLabel: '03 · Конкурент №1',
      compactWaveLabel: 'Сосед №1',
      title: 'Первый ролик конкурента перед целевым слотом',
      subtitle: 'Плотная начитка акций',
      durationSec: 15,
      isTargetSlot: false,
    },
    {
      id: 'target_spot',
      kind: 'target',
      shortStepLabel: '04 · Целевой слот №2',
      compactWaveLabel: 'Ваш слот',
      title: 'Целевой ролик внутри рекламного блока',
      subtitle: 'Пауза 0.4 сек и выразительная подача',
      durationSec: 15,
      isTargetSlot: true,
    },
    {
      id: 'competitor_after_1',
      kind: 'competitor',
      shortStepLabel: '05 · Конкурент №2',
      compactWaveLabel: 'Сосед №2',
      title: 'Второй чужой ролик сразу после вас',
      subtitle: 'Продолжение рекламной очереди',
      durationSec: 15,
      isTargetSlot: false,
    },
    {
      id: 'competitor_after_2',
      kind: 'competitor',
      shortStepLabel: '06 · Конкурент №3',
      compactWaveLabel: 'Сосед №3',
      title: 'Третий чужой ролик подряд',
      subtitle: 'Плотный рекламный поток',
      durationSec: 15,
      isTargetSlot: false,
    },
    {
      id: 'competitor_after_3',
      kind: 'competitor',
      shortStepLabel: '07 · Конкурент №4',
      compactWaveLabel: 'Сосед №4',
      title: 'Четвёртый чужой ролик в финале паузы',
      subtitle: 'Завершение коммерческого блока',
      durationSec: 13,
      isTargetSlot: false,
    },
    {
      id: 'program_return',
      kind: 'program',
      shortStepLabel: '08 · Возврат в эфир',
      compactWaveLabel: 'Возврат',
      title: 'Выходная отбивка и возврат ведущих в студию',
      subtitle: 'Продолжение радиопередачи',
      durationSec: 19,
      isTargetSlot: false,
    },
  ];

  let cursor = 0;
  return specs.map((item, idx) => {
    const startSec = cursor;
    const endSec = cursor + item.durationSec;
    cursor = endSec;
    return {
      ...item,
      slotNumber: item.kind === 'competitor' || item.kind === 'target' ? idx - 1 : null,
      orderIndex: idx + 1,
      startSec,
      endSec,
    };
  });
}

export interface ComputeWaveformTimelineParams {
  segments?: readonly BroadcastTimelineSegment[];
  totalDurationSec?: number;
  activeSegmentId?: BroadcastSegmentId;
  spotMode?: InsertedSpotMode;
  seedKey?: string;
  sampleCount?: number;
  spectrumBands?: readonly number[];
  isPlaying?: boolean;
  elapsedSec?: number;
  reducedMotion?: boolean;
}

/**
 * Вычисляет гео-огибающую и посекундные сэмплы 150-секундного эфирного блока,
 * кодируя каждый тип сегмента (живой эфир, склейка, реклама конкурентов, ролик клиента)
 * собственным акустическим профилем амплитуды и цветовой палитрой.
 */
export function computeWaveformTimelineGeometry(
  params: ComputeWaveformTimelineParams
): TimelineGeometryResult {
  const activeSegments =
    params.segments && params.segments.length > 0
      ? params.segments
      : createDefault150sSegments();

  const rawTotal =
    params.totalDurationSec && params.totalDurationSec > 0
      ? params.totalDurationSec
      : activeSegments[activeSegments.length - 1]?.endSec ?? DEFAULT_BLOCK_DURATION_SEC;

  const totalDurationSec = Math.max(1, rawTotal);
  const sampleCount = Math.max(32, params.sampleCount ?? DEFAULT_TIMELINE_SAMPLE_COUNT);
  const spotMode = params.spotMode ?? 'fmworks_example';
  const seed = hashSeed(params.seedKey || `timeline-${spotMode}`);
  const phase = (seed % 360) * (Math.PI / 180);

  const segmentLayers: RenderedSegmentLayer[] = activeSegments.map((seg) => {
    const startRatio = Math.min(1, Math.max(0, seg.startSec / totalDurationSec));
    const endRatio = Math.min(1, Math.max(startRatio, seg.endSec / totalDurationSec));
    const startX = startRatio * TIMELINE_VIEWBOX_WIDTH;
    const widthX = Math.max(0.5, (endRatio - startRatio) * TIMELINE_VIEWBOX_WIDTH);

    return {
      id: seg.id,
      kind: seg.kind,
      title: seg.title,
      compactLabel: seg.compactWaveLabel,
      startSec: seg.startSec,
      endSec: seg.endSec,
      startRatio,
      endRatio,
      startX,
      widthX,
      isTargetSlot: seg.isTargetSlot,
      isActive: params.activeSegmentId === seg.id,
      profile: SEGMENT_VISUAL_PROFILES[seg.kind],
    };
  });

  const playRatio =
    typeof params.elapsedSec === 'number' && Number.isFinite(params.elapsedSec)
      ? Math.min(1, Math.max(0, params.elapsedSec / totalDurationSec))
      : 0;

  const samples: TimelineAmplitudeSample[] = [];
  const upperPts: { x: number; y: number }[] = [];
  const lowerPts: { x: number; y: number }[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const ratio = i / Math.max(1, sampleCount - 1);
    const timeSec = ratio * totalDurationSec;
    const x = ratio * TIMELINE_VIEWBOX_WIDTH;

    const seg =
      activeSegments.find((s) => timeSec >= s.startSec && timeSec < s.endSec) ??
      activeSegments[activeSegments.length - 1];

    const segSpan = Math.max(0.2, seg.endSec - seg.startSec);
    const localT = Math.min(1, Math.max(0, (timeSec - seg.startSec) / segSpan));

    let amp = 0.36;
    if (seg.kind === 'program') {
      // Живая студийная речь ведущих с естественными вдохами и спокойной динамикой
      const breathGate = Math.pow(
        0.5 + 0.5 * Math.sin(localT * Math.PI * 7.2 + phase),
        1.55
      );
      const speech =
        0.42 +
        0.33 * Math.sin(ratio * 96.0 + phase) +
        0.25 * Math.cos(ratio * 151.0 - phase * 0.5);
      amp = 0.11 + breathGate * 0.54 * speech;
    } else if (seg.kind === 'splice') {
      // Короткий фирменный импульс эфирной склейки при входе в рекламу
      const bell = Math.sin(Math.PI * Math.min(0.96, Math.max(0.04, localT)));
      amp = 0.54 + 0.38 * bell * (0.78 + 0.22 * Math.sin(ratio * 184.0));
    } else if (seg.kind === 'competitor') {
      // Плотно зажатая «кирпичом» рекламная стена конкурентов без пауз
      const brick =
        0.74 +
        0.11 * Math.sin(ratio * 168.0 + phase * 1.2 + seg.orderIndex) +
        0.08 * Math.cos(ratio * 226.0 - seg.orderIndex * 0.7);
      amp = Math.min(0.9, Math.max(0.62, brick));
    } else {
      // Целевой слот: контраст между зажатым шаблоном и срежиссированной паузой 0.4с + драматургией
      if (spotMode === 'typical_cliche') {
        const flatCliche =
          0.76 + 0.1 * Math.sin(ratio * 172.0 + 0.8) + 0.07 * Math.cos(ratio * 238.0);
        amp = Math.min(0.91, Math.max(0.64, flatCliche));
      } else {
        if (localT < 0.12) {
          // Стартовая воздушная пауза 0.4 сек, отсекающая шум предыдущего конкурента
          amp = 0.09 + 0.02 * Math.sin(localT * 24.0);
        } else if (localT > 0.91) {
          // Чистая финальная точка перед следующими 3 конкурентами
          amp = 0.14 + 0.08 * (1 - (localT - 0.91) / 0.09);
        } else {
          const inner = (localT - 0.12) / 0.79;
          const phraseArch = Math.sin(Math.PI * Math.min(0.96, Math.max(0.08, inner)));
          const sculptedVoice =
            0.56 +
            0.28 * Math.sin(inner * Math.PI * 3.6 + phase) +
            0.19 * Math.cos(ratio * 124.0);
          amp = 0.24 + 0.72 * Math.pow(phraseArch, 0.34) * sculptedVoice;
        }
      }
    }

    // Лёгкое живое дыхание спектра вокруг текущей каретки воспроизведения
    if (
      params.isPlaying &&
      !params.reducedMotion &&
      params.spectrumBands &&
      params.spectrumBands.length > 0
    ) {
      const dist = Math.abs(ratio - playRatio);
      if (dist < 0.09) {
        const proximity = 1 - dist / 0.09;
        const bandIdx = Math.min(
          params.spectrumBands.length - 1,
          Math.floor(localT * params.spectrumBands.length)
        );
        const liveBand = params.spectrumBands[bandIdx] ?? amp;
        amp = amp * (1 - 0.36 * proximity) + liveBand * (0.36 * proximity);
      }
    }

    const edgeTaper = Math.pow(
      Math.sin(Math.PI * Math.min(0.992, Math.max(0.008, ratio))),
      0.18
    );
    const clampedAmp = Math.min(0.97, Math.max(0.08, amp * edgeTaper));
    const yTop = CENTER_Y - clampedAmp * MAX_UPPER_AMP;
    const yBottom = CENTER_Y + clampedAmp * MAX_LOWER_AMP;

    upperPts.push({ x, y: yTop });
    lowerPts.push({ x, y: yBottom });
    samples.push({
      index: i,
      ratio,
      timeSec: Math.round(timeSec * 100) / 100,
      x,
      yTop,
      yBottom,
      amplitude: Math.round(clampedAmp * 1000) / 1000,
      segmentId: seg.id,
      kind: seg.kind,
    });
  }

  const upperCrestPath = buildCubicBezierPath(upperPts);
  const lowerCrestPath = buildCubicBezierPath(lowerPts);
  const reversedLower = [...lowerPts].reverse();
  const lowerReverseCurve = buildCubicBezierPath(reversedLower).replace(/^M [^C]+/, '');
  const closedAreaPath = `${upperCrestPath} L ${reversedLower[0].x.toFixed(2)} ${reversedLower[0].y.toFixed(2)}${lowerReverseCurve} Z`;

  return {
    totalDurationSec,
    samples,
    closedAreaPath,
    upperCrestPath,
    lowerCrestPath,
    segmentLayers,
  };
}

export function clampSeekRatioToSeconds(ratio: number, totalDurationSec: number): number {
  const safeTotal = Math.max(1, Number.isFinite(totalDurationSec) ? totalDurationSec : 150);
  const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  return Math.round(clamped * safeTotal * 100) / 100;
}

export interface WaveformTimelineProps {
  segments?: readonly BroadcastTimelineSegment[];
  totalDurationSec?: number;
  elapsedSec?: number;
  activeSegmentId?: BroadcastSegmentId;
  spotMode?: InsertedSpotMode;
  targetSlotIndex?: number;
  targetShortLabel?: string;
  isPlaying?: boolean;
  seedKey?: string;
  spectrumBands?: readonly number[];
  reducedMotion?: boolean;
  onSeekRatio?: (ratio: number) => void;
  onScrubStart?: () => void;
  onSelectSegment?: (segmentId: BroadcastSegmentId) => void;
  seekAriaLabel?: string;
  heightClass?: string;
  visualizerTestId?: string;
  progressBarTestId?: string;
  showTimeRuler?: boolean;
}

export function WaveformTimeline({
  segments,
  totalDurationSec,
  elapsedSec = 0,
  activeSegmentId = 'program_leadin',
  spotMode = 'fmworks_example',
  targetSlotIndex,
  targetShortLabel,
  isPlaying = false,
  seedKey = 'broadcast-150s',
  spectrumBands,
  reducedMotion = false,
  onSeekRatio,
  onScrubStart,
  onSelectSegment,
  seekAriaLabel = 'Перемотка реального радиоэфира по секундам',
  heightClass = 'h-12 sm:h-14',
  visualizerTestId = 'aircheck-broadcast-waveform',
  progressBarTestId = 'aircheck-waveform-scrubber',
  showTimeRuler = true,
}: WaveformTimelineProps) {
  const uid = useId().replace(/:/g, '');
  const trackRef = useRef<HTMLDivElement | null>(null);

  const geometry = useMemo(
    () =>
      computeWaveformTimelineGeometry({
        segments,
        totalDurationSec,
        activeSegmentId,
        spotMode,
        seedKey,
        spectrumBands,
        isPlaying,
        elapsedSec,
        reducedMotion,
      }),
    [
      segments,
      totalDurationSec,
      activeSegmentId,
      spotMode,
      seedKey,
      spectrumBands,
      isPlaying,
      elapsedSec,
      reducedMotion,
    ]
  );

  const engineProgressRatio = Math.min(
    1,
    Math.max(
      0,
      geometry.totalDurationSec > 0 ? elapsedSec / geometry.totalDurationSec : 0
    )
  );
  const isInteractive = typeof onSeekRatio === 'function';
  const canInteract = isInteractive || typeof onSelectSegment === 'function';

  const commitSeekAtRatio = (ratio: number) => {
    if (onSeekRatio) {
      onSeekRatio(ratio);
      return;
    }
    if (onSelectSegment) {
      const targetSec = clampSeekRatioToSeconds(ratio, geometry.totalDurationSec);
      const hit = geometry.segmentLayers.find(
        (layer) => targetSec >= layer.startSec && targetSec <= layer.endSec
      );
      if (hit) onSelectSegment(hit.id);
    }
  };

  const {
    displayRatio: progressRatio,
    hoverRatio,
    isScrubbing,
    eventHandlers,
  } = useAudioTrackScrubber({
    trackRef,
    engineRatio: engineProgressRatio,
    isInteractive: canInteract,
    stepRatio: 5 / Math.max(15, geometry.totalDurationSec),
    onScrubStart,
    onCommitRatio: commitSeekAtRatio,
  });

  const playedClipRightPct = Math.max(0, Math.min(100, (1 - progressRatio) * 100));
  const displayedElapsedSec = isScrubbing
    ? clampSeekRatioToSeconds(progressRatio, geometry.totalDurationSec)
    : elapsedSec;

  const targetLayer =
    geometry.segmentLayers.find((layer) => layer.isTargetSlot) ?? null;
  const spliceLayer =
    geometry.segmentLayers.find((layer) => layer.kind === 'splice') ?? null;
  const returnLayer =
    geometry.segmentLayers[geometry.segmentLayers.length - 1] ?? null;

  const previewRatio = isScrubbing ? progressRatio : hoverRatio;
  const hoverInfo = useMemo(() => {
    if (previewRatio === null) return null;
    const sec = clampSeekRatioToSeconds(previewRatio, geometry.totalDurationSec);
    const hit =
      geometry.segmentLayers.find(
        (layer) => sec >= layer.startSec && sec <= layer.endSec
      ) ?? geometry.segmentLayers[0];
    return {
      sec,
      label: hit ? hit.compactLabel : '',
    };
  }, [previewRatio, geometry.totalDurationSec, geometry.segmentLayers]);

  const activeLayer =
    geometry.segmentLayers.find((l) => l.isActive) ?? geometry.segmentLayers[0];

  return (
    <div
      data-testid="waveform-timeline"
      className="w-full space-y-1.5 min-w-0 select-none"
    >
      <div
        ref={trackRef}
        role={isInteractive ? 'slider' : 'progressbar'}
        tabIndex={isInteractive ? 0 : undefined}
        aria-label={seekAriaLabel}
        aria-valuemin={0}
        aria-valuemax={Math.round(geometry.totalDurationSec)}
        aria-valuenow={Math.round(displayedElapsedSec)}
        aria-valuetext={`${formatAudioTime(displayedElapsedSec)} из ${formatAudioTime(
          geometry.totalDurationSec
        )}${activeLayer ? `, ${activeLayer.compactLabel}` : ''}`}
        data-testid={progressBarTestId}
        data-playing={isPlaying ? 'true' : 'false'}
        data-scrubbing={isScrubbing ? 'true' : 'false'}
        data-active-segment={activeSegmentId}
        {...eventHandlers}
        className={`relative w-full ${heightClass} rounded-xl bg-white/[0.02] overflow-hidden ${
          canInteract
            ? 'cursor-pointer touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4820]'
            : 'pointer-events-none'
        }`}
      >
        <div
          aria-hidden="true"
          data-testid={visualizerTestId}
          data-active={isPlaying || displayedElapsedSec > 0 ? 'true' : 'false'}
          className="pointer-events-none relative w-full h-full"
        >
          {/* Подложка целевого слота клиента / эталона FMWorks */}
          {targetLayer && (
            <div
              style={{
                left: `${(targetLayer.startRatio * 100).toFixed(2)}%`,
                width: `${((targetLayer.endRatio - targetLayer.startRatio) * 100).toFixed(2)}%`,
              }}
              className="absolute inset-y-0 bg-[#FF4820]/[0.10] border-x border-[#FF4820]/50"
            />
          )}

          {/* Тонкие вертикальные засечки стыков между сегментами эфирного блока */}
          {geometry.segmentLayers.slice(1).map((layer) => (
            <span
              key={`divider-${layer.id}`}
              style={{
                left: `${(layer.startRatio * 100).toFixed(2)}%`,
              }}
              className={`absolute inset-y-0 w-px ${
                layer.isTargetSlot
                  ? 'bg-[#FF4820]/55'
                  : layer.kind === 'splice'
                    ? 'bg-[#FBBF24]/45'
                    : 'bg-white/[0.13]'
              }`}
            />
          ))}

          {/* Слой №1: Сегментированная звуковая дорожка в покое (каждый тип сегмента — свой цвет и амплитуда) */}
          <svg
            viewBox={`0 0 ${TIMELINE_VIEWBOX_WIDTH} ${TIMELINE_VIEWBOX_HEIGHT}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full overflow-visible"
          >
            <defs>
              {(Object.keys(SEGMENT_VISUAL_PROFILES) as BroadcastSegmentKind[]).map(
                (kind) => {
                  const prof = SEGMENT_VISUAL_PROFILES[kind];
                  return (
                    <linearGradient
                      key={`idle-grad-${kind}`}
                      id={`wt-idle-${kind}-${uid}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={prof.idleFillTop} />
                      <stop offset="100%" stopColor={prof.idleFillBottom} />
                    </linearGradient>
                  );
                }
              )}
              {geometry.segmentLayers.map((layer) => (
                <clipPath key={`clip-idle-${layer.id}`} id={`wt-seg-${layer.id}-${uid}`}>
                  <rect
                    x={layer.startX.toFixed(2)}
                    y="0"
                    width={layer.widthX.toFixed(2)}
                    height={TIMELINE_VIEWBOX_HEIGHT}
                  />
                </clipPath>
              ))}
            </defs>

            <line
              x1="0"
              y1={CENTER_Y}
              x2={TIMELINE_VIEWBOX_WIDTH}
              y2={CENTER_Y}
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />

            {geometry.segmentLayers.map((layer) => {
              const segSamples = geometry.samples.filter(
                (s) => s.segmentId === layer.id
              );
              return (
                <g
                  key={`seg-idle-${layer.id}`}
                  data-segment-id={layer.id}
                  data-segment-kind={layer.kind}
                  clipPath={`url(#wt-seg-${layer.id}-${uid})`}
                >
                  <path
                    d={geometry.closedAreaPath}
                    fill={`url(#wt-idle-${layer.kind}-${uid})`}
                  />
                  <g
                    stroke={layer.profile.idleFilamentStroke}
                    strokeWidth="1.25"
                    strokeLinecap="round"
                  >
                    {segSamples.map((s) => (
                      <line
                        key={s.index}
                        x1={s.x.toFixed(2)}
                        y1={(s.yTop + 0.8).toFixed(2)}
                        x2={s.x.toFixed(2)}
                        y2={(CENTER_Y + (s.yBottom - CENTER_Y) * 0.78).toFixed(2)}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </g>
                  <path
                    d={geometry.upperCrestPath}
                    fill="none"
                    stroke={layer.profile.idleCrestStroke}
                    strokeWidth={layer.isTargetSlot ? '1.65' : '1.3'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={geometry.lowerCrestPath}
                    fill="none"
                    stroke={layer.profile.idleLowerStroke}
                    strokeWidth="1"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </svg>

          {/* Слой №2: Прослушанная часть дорожки с усиленной яркостью каждого сегмента */}
          <div
            style={{
              clipPath: `inset(0 ${playedClipRightPct.toFixed(2)}% 0 0)`,
            }}
            className="absolute inset-0 w-full h-full will-change-[clip-path]"
          >
            <svg
              viewBox={`0 0 ${TIMELINE_VIEWBOX_WIDTH} ${TIMELINE_VIEWBOX_HEIGHT}`}
              preserveAspectRatio="none"
              className="w-full h-full overflow-visible"
            >
              <defs>
                {(Object.keys(SEGMENT_VISUAL_PROFILES) as BroadcastSegmentKind[]).map(
                  (kind) => {
                    const prof = SEGMENT_VISUAL_PROFILES[kind];
                    return (
                      <linearGradient
                        key={`played-grad-${kind}`}
                        id={`wt-played-${kind}-${uid}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={prof.playedFillTop} />
                        <stop offset="100%" stopColor={prof.playedFillBottom} />
                      </linearGradient>
                    );
                  }
                )}
              </defs>

              <line
                x1="0"
                y1={CENTER_Y}
                x2={TIMELINE_VIEWBOX_WIDTH}
                y2={CENTER_Y}
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />

              {geometry.segmentLayers.map((layer) => {
                const segSamples = geometry.samples.filter(
                  (s) => s.segmentId === layer.id
                );
                return (
                  <g
                    key={`seg-played-${layer.id}`}
                    clipPath={`url(#wt-seg-${layer.id}-${uid})`}
                  >
                    <path
                      d={geometry.closedAreaPath}
                      fill={`url(#wt-played-${layer.kind}-${uid})`}
                    />
                    <g
                      stroke={layer.profile.playedFilamentStroke}
                      strokeWidth="1.35"
                      strokeLinecap="round"
                    >
                      {segSamples.map((s) => (
                        <line
                          key={s.index}
                          x1={s.x.toFixed(2)}
                          y1={(s.yTop + 0.7).toFixed(2)}
                          x2={s.x.toFixed(2)}
                          y2={(CENTER_Y + (s.yBottom - CENTER_Y) * 0.82).toFixed(2)}
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                    </g>
                    <path
                      d={geometry.upperCrestPath}
                      fill="none"
                      stroke={layer.profile.playedCrestStroke}
                      strokeWidth={layer.isTargetSlot ? '1.8' : '1.45'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                    <path
                      d={geometry.lowerCrestPath}
                      fill="none"
                      stroke={layer.profile.playedLowerStroke}
                      strokeWidth="1.05"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Курсор предпросмотра при наведении */}
          {hoverRatio !== null && hoverInfo && (
            <span
              style={{
                left: `${(hoverRatio * 100).toFixed(2)}%`,
              }}
              className="absolute inset-y-0 w-px -translate-x-1/2 bg-white/50"
            />
          )}

          {/* Световая каретка текущего момента воспроизведения и тактильный ползунок */}
          {(isPlaying || isScrubbing || progressRatio > 0.003) && progressRatio < 0.999 && (
            <span
              style={{
                left: `${(progressRatio * 100).toFixed(2)}%`,
              }}
              className="absolute top-0.5 bottom-0.5 w-[2px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,72,32,0.95)]"
            >
              {canInteract && (
                <span
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white ring-2 ring-[#FF4820] transition-transform duration-100 ${
                    isScrubbing ? 'scale-125' : 'scale-100'
                  }`}
                />
              )}
            </span>
          )}
        </div>
      </div>

      {/* Компактная шкала ключевых таймкодов и цветовой ключ сегментов (на lg+ без дубля верхней линейки) */}
      {showTimeRuler && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-white/46 tabular-nums min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 sm:gap-x-4 gap-y-1 min-w-0">
            <span className="inline-flex lg:hidden items-center gap-1 whitespace-nowrap shrink-0">
              <span
                aria-hidden="true"
                className="w-2 h-[2px] rounded-full bg-[#CBD5E1]"
              />
              <span>Эфир</span>
            </span>
            <span className="inline-flex lg:hidden items-center gap-1 whitespace-nowrap shrink-0">
              <span
                aria-hidden="true"
                className="w-2 h-[2px] rounded-full bg-[#FBBF24]"
              />
              <span>Склейка</span>
            </span>
            <span className="inline-flex lg:hidden items-center gap-1 whitespace-nowrap shrink-0">
              <span
                aria-hidden="true"
                className="w-2 h-[2px] rounded-full bg-[#D69E6E]"
              />
              <span className="sm:hidden">Реклама ×4</span>
              <span className="hidden sm:inline">4 конкурента</span>
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 text-white/82">
              <span
                aria-hidden="true"
                className="w-2 h-[2px] rounded-full bg-[#FF4820]"
              />
              <span className="sm:hidden">
                {spotMode === 'client_upload'
                  ? `Ваш №${targetSlotIndex ?? 2}`
                  : `Слот №${targetSlotIndex ?? 2}`}
              </span>
              <span className="hidden sm:inline">
                {spotMode === 'client_upload'
                  ? `Ваш ролик в слоте №${targetSlotIndex ?? 2}`
                  : spotMode === 'typical_cliche'
                    ? `Обычный шаблон в слоте №${targetSlotIndex ?? 2}`
                    : targetShortLabel
                      ? `${targetShortLabel} · слот №${targetSlotIndex ?? 2}`
                      : `Эталон FMWorks · слот №${targetSlotIndex ?? 2}`}
              </span>
            </span>
          </div>

          {isScrubbing && hoverInfo && (
            <span className="sm:hidden text-[#FF8A70] font-semibold shrink-0">
              {formatAudioTime(hoverInfo.sec)} · {hoverInfo.label}
            </span>
          )}

          <div className="hidden sm:flex items-center gap-2.5 text-white/44 shrink-0">
            {hoverInfo ? (
              <span className="text-white/84 font-medium">
                {formatAudioTime(hoverInfo.sec)} · {hoverInfo.label}
              </span>
            ) : (
              <>
                <span>0:00</span>
                {spliceLayer && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Склейка {formatAudioTime(spliceLayer.startSec)}</span>
                  </>
                )}
                {targetLayer && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#FF8A70]">
                      Слот №{targetSlotIndex ?? 2} {formatAudioTime(targetLayer.startSec)}
                    </span>
                  </>
                )}
                {returnLayer && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Финал {formatAudioTime(geometry.totalDurationSec)}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
