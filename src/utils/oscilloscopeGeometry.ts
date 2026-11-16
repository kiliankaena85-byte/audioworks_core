export interface WaveformSignalMetrics {
  /** Среднеквадратичная энергия сигнала (0..1) */
  rms: number;
  /** Пиковая амплитуда отклонения от центра 128 (0..1) */
  peak: number;
  /** Есть ли реальное звуковое колебание выше порога тишины ЦАП */
  hasLiveSignal: boolean;
}

export interface OscilloscopeFrameParams {
  /** Сырые байты временной области из AnalyserNode.getByteTimeDomainData (центр = 128) */
  timeDomainBytes: Uint8Array | null;
  /** Количество контрольных узлов для плавной кривой Безье */
  pointCount: number;
  /** Текущее время анимации в секундах */
  timeSec: number;
  /** Включён ли приёмник пользователем */
  isBroadcastActive: boolean;
  /** Зафиксирован ли тюнер на чистоте 104.2 FM */
  isLockedOnStudio: boolean;
  /** Уровень эфирных помех на нецелевых частотах (0..1) */
  interferenceLevel: number;
}

export interface OscilloscopeFrameResult {
  /** Нормализованные и сглаженные отсчёты волны (-1..1) длиной pointCount */
  samples: Float32Array;
  /** Реальная RMS-энергия из AnalyserNode (0..1) */
  rms: number;
  /** Пиковая амплитуда из AnalyserNode (0..1) */
  peak: number;
  /** Отрисован ли кадр по живому сигналу Web Audio AnalyserNode */
  usingLiveAnalyser: boolean;
}

export interface CanvasWavePoint {
  x: number;
  y: number;
}

/**
 * Вычисляет RMS и пик сигнала из буфера getByteTimeDomainData (0..255, тишина = 128).
 */
export function computeWaveformSignalMetrics(
  timeDomainBytes: Uint8Array | null
): WaveformSignalMetrics {
  if (!timeDomainBytes || timeDomainBytes.length === 0) {
    return { rms: 0, peak: 0, hasLiveSignal: false };
  }

  let sumSq = 0;
  let peak = 0;
  const len = timeDomainBytes.length;

  for (let i = 0; i < len; i++) {
    const centered = (timeDomainBytes[i] - 128) / 128;
    const abs = Math.abs(centered);
    if (abs > peak) {
      peak = abs;
    }
    sumSq += centered * centered;
  }

  const rms = Math.min(1, Math.sqrt(sumSq / len));
  return {
    rms,
    peak: Math.min(1, peak),
    hasLiveSignal: peak > 0.008 && rms > 0.003,
  };
}

/**
 * Находит индекс восходящего пересечения нуля (переход < 128 -> >= 128),
 * чтобы стоячая волна осциллографа стабилизировалась по фазе и не дрожала по горизонтали.
 */
export function findRisingZeroCrossingIndex(
  timeDomainBytes: Uint8Array,
  maxSearchLength?: number
): number {
  const len = timeDomainBytes.length;
  if (len < 4) return 0;

  const limit = Math.min(
    len - 2,
    maxSearchLength ?? Math.floor(len * 0.45)
  );

  let bestIdx = 0;
  let bestSlope = -1;

  for (let i = 1; i <= limit; i++) {
    const prev = timeDomainBytes[i - 1];
    const curr = timeDomainBytes[i];
    const next = timeDomainBytes[i + 1];
    if (prev < 128 && curr >= 128 && next > 128) {
      const slope = next - prev;
      if (slope > bestSlope) {
        bestSlope = slope;
        bestIdx = i;
        if (slope >= 6) {
          return i;
        }
      }
    }
  }

  return bestIdx;
}

/**
 * Извлекает сглаженную кривую осциллографа из AnalyserNode (с мягкой компрессией и краевой огибающей)
 * либо плавную несущую гармонику в режиме ожидания до запуска аудио.
 */
export function extractSmoothedOscilloscopeSamples(
  params: OscilloscopeFrameParams
): OscilloscopeFrameResult {
  const safeCount = Math.max(8, Math.min(512, Math.floor(params.pointCount)));
  const out = new Float32Array(safeCount);
  const metrics = computeWaveformSignalMetrics(params.timeDomainBytes);

  if (
    params.timeDomainBytes &&
    params.timeDomainBytes.length >= 16 &&
    metrics.hasLiveSignal
  ) {
    const buf = params.timeDomainBytes;
    const triggerIdx = findRisingZeroCrossingIndex(buf);
    const availableWindow = Math.max(16, buf.length - triggerIdx);
    const raw = new Float32Array(safeCount);

    // Плавная авто-нормализация с мягким коленом (tanh), чтобы и бархатный голос диктора, и пики музыки читались объёмно
    const autoPeakGain = Math.min(4.2, Math.max(2.35, 0.85 / Math.max(0.18, metrics.peak)));
    const adaptiveGain = params.isLockedOnStudio ? autoPeakGain : Math.min(3.1, autoPeakGain * 0.8);

    for (let i = 0; i < safeCount; i++) {
      const norm = i / (safeCount - 1);
      const exactIdx = triggerIdx + norm * (availableWindow - 1);
      const idx0 = Math.min(buf.length - 1, Math.floor(exactIdx));
      const idx1 = Math.min(buf.length - 1, idx0 + 1);
      const frac = exactIdx - idx0;

      const sample0 = (buf[idx0] - 128) / 128;
      const sample1 = (buf[idx1] - 128) / 128;
      const interpolated = sample0 + (sample1 - sample0) * frac;

      raw[i] = Math.tanh(interpolated * adaptiveGain);
    }

    // 5-точечное симметричное сглаживание [1, 2, 4, 2, 1] / 10 + краевая оконная функция sin(pi * t)^0.75
    for (let i = 0; i < safeCount; i++) {
      const im2 = raw[Math.max(0, i - 2)];
      const im1 = raw[Math.max(0, i - 1)];
      const ic = raw[i];
      const ip1 = raw[Math.min(safeCount - 1, i + 1)];
      const ip2 = raw[Math.min(safeCount - 1, i + 2)];

      const smoothed = (im2 + 2 * im1 + 4 * ic + 2 * ip1 + ip2) * 0.1;
      const t = i / (safeCount - 1);
      const edgeWindow = Math.pow(Math.sin(Math.PI * t), 0.75);

      out[i] = Math.max(-1, Math.min(1, smoothed * edgeWindow));
    }

    return {
      samples: out,
      rms: metrics.rms,
      peak: metrics.peak,
      usingLiveAnalyser: true,
    };
  }

  // Плавное дыхание несущей волны приёмника до старта трека (или на паузе)
  const idleDepth = params.isBroadcastActive ? 0.24 : 0.14;
  for (let i = 0; i < safeCount; i++) {
    const t = i / (safeCount - 1);
    const edgeWindow = Math.pow(Math.sin(Math.PI * t), 0.85);
    const carrier =
      Math.sin(t * Math.PI * 4.5 + params.timeSec * 1.35) * 0.68 +
      Math.cos(t * Math.PI * 8.0 - params.timeSec * 0.9) * 0.32;
    const rfRipple =
      params.interferenceLevel > 0.12
        ? Math.sin(i * 0.85 + params.timeSec * 18) *
          params.interferenceLevel *
          0.22
        : 0;

    out[i] = Math.max(
      -1,
      Math.min(1, (carrier * idleDepth + rfRipple) * edgeWindow)
    );
  }

  return {
    samples: out,
    rms: 0,
    peak: 0,
    usingLiveAnalyser: false,
  };
}

/**
 * Преобразует нормализованные отсчёты (-1..1) в экранные координаты для гладкой отрисовки quadraticCurveTo.
 */
export function buildOscilloscopeCanvasPoints(
  samples: Float32Array,
  width: number,
  centerY: number,
  maxAmplitudePx: number
): CanvasWavePoint[] {
  const len = samples.length;
  if (len === 0) return [];
  const safeWidth = Math.max(1, width);
  const points: CanvasWavePoint[] = new Array(len);

  for (let i = 0; i < len; i++) {
    const x = len === 1 ? safeWidth * 0.5 : (i / (len - 1)) * safeWidth;
    const y = centerY - samples[i] * maxAmplitudePx;
    points[i] = { x, y };
  }

  return points;
}
