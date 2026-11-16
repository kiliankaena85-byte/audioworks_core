export type HeroAbPole = 'clutter' | 'studio';

export interface ClutterLoopBounds {
  startSec: number;
  endSec: number;
  spanSec: number;
}

export interface HeroVisualOptics {
  videoBlurPx: number;
  videoGrayscalePct: number;
  videoBrightness: number;
  videoContrast: number;
  showClutterStreamOverlay: boolean;
  wavePrimaryRgba: string;
  waveGlowRgba: string;
  waveCoreRgba: string | null;
}

const BUILTIN_CLUTTER_SAFE_START_SEC = 0.6;
const BUILTIN_CLUTTER_MAX_END_SEC = 5.75;

/**
 * Вычисляет безопасное окно зацикливания для режима «Обычный эфир»,
 * чтобы при использовании встроенного файла эфирный поток никогда не переходил
 * за границу 6.1 сек (где начинается чистый ролик FMWorks).
 */
export function resolveClutterLoopBounds(params: {
  isCustomUpload: boolean;
  configuredStartSec: number;
  configuredDurationSec: number;
  mediaDurationSec?: number | null;
}): ClutterLoopBounds {
  const {
    isCustomUpload,
    configuredStartSec,
    configuredDurationSec,
    mediaDurationSec,
  } = params;

  const safeStart = Number.isFinite(configuredStartSec)
    ? Math.max(0, configuredStartSec)
    : BUILTIN_CLUTTER_SAFE_START_SEC;
  const safeDur = Number.isFinite(configuredDurationSec)
    ? Math.max(1.5, configuredDurationSec)
    : 4.0;

  if (isCustomUpload) {
    const mediaMax =
      typeof mediaDurationSec === 'number' &&
      Number.isFinite(mediaDurationSec) &&
      mediaDurationSec > 0.8
        ? mediaDurationSec
        : safeStart + safeDur;
    const boundedStart = Math.min(safeStart, Math.max(0, mediaMax - 0.8));
    const boundedEnd = Math.min(mediaMax, Math.max(boundedStart + 0.8, boundedStart + safeDur));
    return {
      startSec: Math.round(boundedStart * 100) / 100,
      endSec: Math.round(boundedEnd * 100) / 100,
      spanSec: Math.round((boundedEnd - boundedStart) * 100) / 100,
    };
  }

  const startSec = Math.min(
    BUILTIN_CLUTTER_MAX_END_SEC - 1.8,
    Math.max(BUILTIN_CLUTTER_SAFE_START_SEC, safeStart)
  );
  const endSec = Math.min(
    BUILTIN_CLUTTER_MAX_END_SEC,
    Math.max(startSec + 1.8, startSec + safeDur)
  );

  return {
    startSec: Math.round(startSec * 100) / 100,
    endSec: Math.round(endSec * 100) / 100,
    spanSec: Math.round((endSec - startSec) * 100) / 100,
  };
}

/**
 * Определяет, пора ли бесшовно вернуть курсор «Обычного эфира» в начало петли,
 * и вычисляет точную секунду внутри окна зацикливания.
 */
export function wrapClutterPlaybackTime(
  currentTimeSec: number,
  bounds: ClutterLoopBounds
): { shouldSeek: boolean; targetTimeSec: number } {
  if (!Number.isFinite(currentTimeSec)) {
    return { shouldSeek: true, targetTimeSec: bounds.startSec };
  }
  if (currentTimeSec < bounds.startSec - 0.15 || currentTimeSec >= bounds.endSec - 0.06) {
    return { shouldSeek: true, targetTimeSec: bounds.startSec };
  }
  return { shouldSeek: false, targetTimeSec: currentTimeSec };
}

/**
 * При перематке общей шкалы прогресса синхронно вычисляет целевые секунды
 * как для ролика FMWorks, так и для фоновой петли «Обычного эфира».
 */
export function computeUnifiedSeekTargets(params: {
  ratio: number;
  studioStartSec: number;
  studioDurationSec: number;
  clutterBounds: ClutterLoopBounds;
}): {
  clampedRatio: number;
  studioElapsedSec: number;
  studioTargetTimeSec: number;
  clutterTargetTimeSec: number;
} {
  const clampedRatio = Number.isFinite(params.ratio)
    ? Math.min(0.995, Math.max(0, params.ratio))
    : 0;
  const safeStudioDur = Math.max(1, params.studioDurationSec);
  const studioElapsedSec = clampedRatio * safeStudioDur;
  const studioTargetTimeSec = Math.max(0, params.studioStartSec) + studioElapsedSec;

  const clutterOffset =
    params.clutterBounds.spanSec > 0.2
      ? studioElapsedSec % params.clutterBounds.spanSec
      : 0;
  const clutterTargetTimeSec = params.clutterBounds.startSec + clutterOffset;

  return {
    clampedRatio,
    studioElapsedSec,
    studioTargetTimeSec,
    clutterTargetTimeSec,
  };
}

/**
 * Формирует форму волны осциллографа под выбранный полюс сравнения:
 * - `studio`: естественная глубокая динамика чистого студийного микса FMWorks;
 * - `clutter`: зажатая «гребёнка» перекомпрессированного радиопотока с узким потолком
 *   и лёгкой высокочастотной рябью (+ низкочастотная вибрация при включённом шуме авто).
 */
export function shapeOscilloscopeSamplesForPole(params: {
  rawSamples: Float32Array;
  pole: HeroAbPole;
  isPlaying: boolean;
  roadNoiseEnabled: boolean;
  timeSec: number;
  outBuffer?: Float32Array;
}): Float32Array {
  const { rawSamples, pole, isPlaying, roadNoiseEnabled, timeSec, outBuffer } = params;
  const len = rawSamples.length;
  const out = outBuffer && outBuffer.length === len ? outBuffer : new Float32Array(len);
  if (len === 0) return out;

  for (let i = 0; i < len; i++) {
    const u = len > 1 ? i / (len - 1) : 0.5;
    // Мягкое оконное затухание к краям холста, чтобы нить осциллографа растворялась у рамок
    const edgeWindow = Math.sin(u * Math.PI);
    const roadRumble =
      roadNoiseEnabled && isPlaying
        ? (Math.sin(u * Math.PI * 7 + timeSec * 13.5) * 0.045 +
            Math.cos(u * Math.PI * 15 - timeSec * 19.2) * 0.025) *
          edgeWindow
        : 0;

    if (pole === 'studio') {
      const studioVal = isPlaying
        ? rawSamples[i] * (0.35 + 0.65 * edgeWindow) + roadRumble * 0.45
        : Math.sin(u * Math.PI * 2.4 + timeSec * 1.15) *
            Math.sin(u * Math.PI) *
            0.14;
      out[i] = Math.max(-1, Math.min(1, studioVal));
    } else {
      // «Обычный эфир»: жёсткий радийный brickwall-лимитер (плоская «колбаса» без воздуха)
      const base = isPlaying
        ? rawSamples[i] * 2.15
        : Math.sin(u * Math.PI * 9.5 + timeSec * 4.2) * 0.42 +
          Math.cos(u * Math.PI * 17.0 - timeSec * 6.4) * 0.28;
      const brickwall = Math.max(-0.26, Math.min(0.26, base));
      const combJitter =
        Math.sin(i * 1.9 + timeSec * 18) * (isPlaying ? 0.038 : 0.022);
      const val = (brickwall + combJitter + roadRumble) * (0.28 + 0.72 * edgeWindow);
      out[i] = Math.max(-0.42, Math.min(0.42, val));
    }
  }

  return out;
}

/**
 * Возвращает оптические параметры видео-полотна и палитру луча осциллографа
 * для мгновенного визуального считывания контраста «Обычный эфир ↔ FMWorks».
 */
export function computeHeroVisualOptics(params: {
  pole: HeroAbPole;
  isPlaying: boolean;
  roadNoiseEnabled: boolean;
}): HeroVisualOptics {
  const { pole, isPlaying, roadNoiseEnabled } = params;

  if (pole === 'clutter') {
    return {
      videoBlurPx: roadNoiseEnabled ? 3.2 : 2.4,
      videoGrayscalePct: 90,
      videoBrightness: 0.52,
      videoContrast: 0.86,
      showClutterStreamOverlay: true,
      wavePrimaryRgba: isPlaying
        ? 'rgba(186, 192, 204, 0.64)'
        : 'rgba(168, 174, 186, 0.40)',
      waveGlowRgba: 'rgba(168, 174, 186, 0.10)',
      waveCoreRgba: null,
    };
  }

  return {
    videoBlurPx: 0,
    videoGrayscalePct: 0,
    videoBrightness: roadNoiseEnabled ? 0.96 : 1.03,
    videoContrast: 1.04,
    showClutterStreamOverlay: false,
    wavePrimaryRgba: isPlaying
      ? 'rgba(255, 76, 34, 0.92)'
      : 'rgba(255, 76, 34, 0.52)',
    waveGlowRgba: isPlaying
      ? 'rgba(255, 72, 32, 0.22)'
      : 'rgba(255, 72, 32, 0.09)',
    waveCoreRgba: isPlaying ? 'rgba(255, 240, 232, 0.68)' : null,
  };
}
