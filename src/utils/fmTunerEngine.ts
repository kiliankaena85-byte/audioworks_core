export const FM_TUNER_MIN_FREQ = 88.0;
export const FM_TUNER_MAX_FREQ = 108.0;
export const FM_TUNER_SPAN = FM_TUNER_MAX_FREQ - FM_TUNER_MIN_FREQ;
export const FM_STUDIO_FREQUENCY = 104.2;

/** Радиус активного магнитного притяжения во время перетаскивания ползунка */
export const FM_STUDIO_DRAG_MAGNET_MHZ = 0.35;
/** Радиус уверенного примагничивания при отпускании / клике рядом со 104.2 FM */
export const FM_STUDIO_RELEASE_MAGNET_MHZ = 0.65;
/** Порог захвата чужих проходных частот при отпускании */
export const FM_NOISE_STATION_SNAP_MHZ = 0.25;

export type FmStationKind = 'noise' | 'studio';

export interface FmStationPreset {
  id: 'noise_flow' | 'noise_fast' | 'noise_template' | 'fmworks_studio';
  frequency: number;
  freqLabel: string;
  shortLabel: string;
  fullLabel: string;
  description: string;
  kind: FmStationKind;
  /** Дорожная/радийная подложка в основном аудиофайле для демонстрации шума (сек) */
  clutterSampleSec?: number;
}

export const FM_TUNER_STATIONS: readonly FmStationPreset[] = [
  {
    id: 'noise_flow',
    frequency: 90.4,
    freqLabel: '90.4 FM',
    shortLabel: 'Шум потока',
    fullLabel: '90.4 FM — Шум потока',
    description: 'Плотный рекламный блок, дорожный гул и потеря внимания слушателя',
    kind: 'noise',
    clutterSampleSec: 0.5,
  },
  {
    id: 'noise_fast',
    frequency: 95.2,
    freqLabel: '95.2 FM',
    shortLabel: 'Скороговорки',
    fullLabel: '95.2 FM — Скороговорки',
    description: 'Перегруженный текст, быстрый диктор и забытое название бренда',
    kind: 'noise',
    clutterSampleSec: 2.1,
  },
  {
    id: 'noise_template',
    frequency: 99.6,
    freqLabel: '99.6 FM',
    shortLabel: 'Шаблоны',
    fullLabel: '99.6 FM — Шаблоны',
    description: 'Типовые штампы без сценария и драматургии паузы',
    kind: 'noise',
    clutterSampleSec: 3.9,
  },
  {
    id: 'fmworks_studio',
    frequency: FM_STUDIO_FREQUENCY,
    freqLabel: '104.2 FM',
    shortLabel: 'FMWORKS',
    fullLabel: '104.2 FM • FMWORKS STUDIO',
    description: 'Кристальный студийный звук, редкие голоса и чистые права',
    kind: 'studio',
  },
] as const;

export function clampFmFrequency(rawFreq: number): number {
  if (!Number.isFinite(rawFreq)) return FM_STUDIO_FREQUENCY;
  const clamped = Math.min(FM_TUNER_MAX_FREQ, Math.max(FM_TUNER_MIN_FREQ, rawFreq));
  return Math.round(clamped * 10) / 10;
}

export function formatFmFrequency(freq: number): string {
  return clampFmFrequency(freq).toFixed(1);
}

export function frequencyToRatio(freq: number): number {
  const clamped = clampFmFrequency(freq);
  return (clamped - FM_TUNER_MIN_FREQ) / FM_TUNER_SPAN;
}

export function ratioToFrequency(ratio: number): number {
  const safe = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  return clampFmFrequency(FM_TUNER_MIN_FREQ + safe * FM_TUNER_SPAN);
}

/** Радиус поля магнитного сопротивления вокруг 104.2 FM */
export const FM_MAGNET_FIELD_RADIUS_MHZ = 1.05;
/** Вязкое затухание маховика шкалы после отпускания курсора (1/сек) */
export const FM_FLYWHEEL_FRICTION_PER_SEC = 5.2;
/** Максимальная физическая скорость инерции шкалы (МГц/сек) */
export const FM_FLYWHEEL_MAX_VELOCITY_MHZ = 28.0;

export interface FmFlywheelState {
  frequency: number;
  velocity: number;
  magneticPull: number;
  activeSpringTarget: number | null;
  settled: boolean;
}

/**
 * Применяет магнитное притяжение шкалы радиочастот:
 * - в режиме `'step'` или `'physics'` не притягивает принудительно, позволяя клавишам и физике инерции работать свободно,
 * - к 104.2 FM — сильный магнит (в зависимости от перетаскивания или отпускания),
 * - к проходным частотам (90.4 / 95.2 / 99.6) — мягкий щелчок фиксации при отпускании.
 */
export function applyFmMagneticSnap(
  rawFreq: number,
  phase: 'drag' | 'commit' | 'step' | 'physics' = 'commit'
): number {
  const clamped = clampFmFrequency(rawFreq);
  if (phase === 'step' || phase === 'physics') {
    return clamped;
  }

  const distToStudio = Math.abs(clamped - FM_STUDIO_FREQUENCY);
  const studioRadius =
    phase === 'drag' ? FM_STUDIO_DRAG_MAGNET_MHZ : FM_STUDIO_RELEASE_MAGNET_MHZ;

  if (distToStudio <= studioRadius) {
    return FM_STUDIO_FREQUENCY;
  }

  if (phase === 'commit') {
    for (const st of FM_TUNER_STATIONS) {
      if (st.kind === 'noise' && Math.abs(clamped - st.frequency) <= FM_NOISE_STATION_SNAP_MHZ) {
        return st.frequency;
      }
    }
  }

  return clamped;
}

/**
 * Вычисляет непрерывную силу магнитного поля вокруг фирменной частоты 104.2 FM (0..1).
 */
export function computeStudioMagneticField(freq: number): number {
  if (!Number.isFinite(freq)) return 0;
  const dist = Math.abs(freq - FM_STUDIO_FREQUENCY);
  if (dist >= FM_MAGNET_FIELD_RADIUS_MHZ) return 0;
  const norm = 1 - dist / FM_MAGNET_FIELD_RADIUS_MHZ;
  return Math.pow(norm, 1.5);
}

function clampContinuousFrequency(freq: number): number {
  if (!Number.isFinite(freq)) return FM_STUDIO_FREQUENCY;
  return Math.min(FM_TUNER_MAX_FREQ, Math.max(FM_TUNER_MIN_FREQ, freq));
}

export interface FmDragResistanceInput {
  currentFreq: number;
  cursorFreq: number;
  dtSec?: number;
}

export interface FmDragResistanceResult {
  nextFreq: number;
  velocity: number;
  magneticPull: number;
  isResistingBreakaway: boolean;
}

/**
 * Рассчитывает механический отклик шкалы при перетаскивании курсором:
 * - при приближении к 104.2 FM мягко втягивает стрелку в студийную лунку;
 * - при попытке сдвинуть ползунок со 104.2 FM создаёт ощутимое магнитное сопротивление до порога срыва.
 */
export function stepFmTunerDrag(input: FmDragResistanceInput): FmDragResistanceResult {
  const dt = Math.min(0.05, Math.max(0.008, input.dtSec ?? 0.016));
  const current = clampContinuousFrequency(input.currentFreq);
  const cursor = clampContinuousFrequency(input.cursorFreq);

  const curDist = Math.abs(current - FM_STUDIO_FREQUENCY);
  const cursorDist = Math.abs(cursor - FM_STUDIO_FREQUENCY);
  const field = Math.max(
    computeStudioMagneticField(current),
    computeStudioMagneticField(cursor) * 0.75
  );

  let targetFreq = cursor;
  let isResistingBreakaway = false;

  if (field > 0.01) {
    const pullingAway = cursorDist > curDist && curDist < 0.85;
    if (pullingAway) {
      // «Магнитное» сопротивление отрыву от 104.2 FM: чем ближе к центру, тем тяжелее ход до порога ~0.82 МГц
      isResistingBreakaway = true;
      const breakawayProgress = Math.min(1, Math.max(0, (cursorDist - 0.16) / 0.72));
      const compliance = 0.14 + 0.86 * Math.pow(breakawayProgress, 2.1);
      targetFreq = current + (cursor - current) * compliance;
    } else if (cursorDist <= 0.18) {
      // Уверенная фиксация в самом центре магнитной лунки 104.2 FM
      targetFreq = FM_STUDIO_FREQUENCY;
    } else {
      // Плавное притяжение к 104.2 FM при приближении курсора
      const attractBlend = field * 0.42;
      targetFreq = cursor + (FM_STUDIO_FREQUENCY - cursor) * attractBlend;
    }
  }

  // Лёгкая маховичная сглаженность реакции на курсор
  const followAlpha = 1 - Math.exp(-36 * dt);
  let nextFreq = current + (targetFreq - current) * followAlpha;
  if (Math.abs(nextFreq - FM_STUDIO_FREQUENCY) < 0.025 && cursorDist <= 0.22) {
    nextFreq = FM_STUDIO_FREQUENCY;
  }
  nextFreq = clampContinuousFrequency(nextFreq);

  const rawVel = (nextFreq - current) / dt;
  const velocity = Math.max(
    -FM_FLYWHEEL_MAX_VELOCITY_MHZ,
    Math.min(FM_FLYWHEEL_MAX_VELOCITY_MHZ, rawVel)
  );

  return {
    nextFreq,
    velocity,
    magneticPull: computeStudioMagneticField(nextFreq),
    isResistingBreakaway,
  };
}

/**
 * Шаг физики инерции маховика тюнера:
 * - плавное затухание скорости после отпускания курсора;
 * - магнитное торможение и дотягивание при прохождении рядом со 104.2 FM;
 * - пружинный переезд при выборе пресета станции кнопкой.
 */
export function stepFmTunerInertia(
  state: FmFlywheelState,
  dtSec: number
): FmFlywheelState {
  const dt = Math.min(0.04, Math.max(0.002, dtSec));
  let freq = clampContinuousFrequency(state.frequency);
  let vel = Number.isFinite(state.velocity) ? state.velocity : 0;

  // Режим 1: Плавный пружинный переезд к выбранной кнопкой станции (~260мс)
  if (state.activeSpringTarget !== null) {
    const target = clampContinuousFrequency(state.activeSpringTarget);
    const diff = target - freq;
    const accel = diff * 360 - vel * 38;
    vel += accel * dt;
    freq = clampContinuousFrequency(freq + vel * dt);

    if (Math.abs(target - freq) <= 0.018 && Math.abs(vel) <= 0.14) {
      return {
        frequency: target,
        velocity: 0,
        magneticPull: computeStudioMagneticField(target),
        activeSpringTarget: null,
        settled: true,
      };
    }

    return {
      frequency: freq,
      velocity: vel,
      magneticPull: computeStudioMagneticField(freq),
      activeSpringTarget: target,
      settled: false,
    };
  }

  // Режим 2: Свободная инерция маховика после отпускания курсора
  vel *= Math.exp(-FM_FLYWHEEL_FRICTION_PER_SEC * dt);

  const studioField = computeStudioMagneticField(freq);
  if (studioField > 0.005) {
    // Магнитное торможение + притяжение к 104.2 FM: медленный выбег захватится магнитом, быстрый — проскочит с сопротивлением
    const dist = FM_STUDIO_FREQUENCY - freq;
    const magSpringAccel = dist * (64 * (0.28 + 0.72 * studioField));
    vel *= Math.exp(-(4.6 * studioField) * dt);
    vel += magSpringAccel * dt;
  } else if (Math.abs(vel) < 2.2) {
    // Лёгкая тактильная лунка на проходных частотах (90.4 / 95.2 / 99.6) при почти остановившейся стрелке
    for (const st of FM_TUNER_STATIONS) {
      if (st.kind === 'noise') {
        const d = st.frequency - freq;
        if (Math.abs(d) <= 0.3) {
          vel += d * 24 * dt;
          vel *= Math.exp(-7.2 * dt);
          if (Math.abs(d) <= 0.035 && Math.abs(vel) <= 0.18) {
            return {
              frequency: st.frequency,
              velocity: 0,
              magneticPull: 0,
              activeSpringTarget: null,
              settled: true,
            };
          }
          break;
        }
      }
    }
  }

  let nextFreq = freq + vel * dt;
  if (nextFreq <= FM_TUNER_MIN_FREQ) {
    nextFreq = FM_TUNER_MIN_FREQ;
    if (vel < 0) vel = 0;
  } else if (nextFreq >= FM_TUNER_MAX_FREQ) {
    nextFreq = FM_TUNER_MAX_FREQ;
    if (vel > 0) vel = 0;
  }

  const nextField = computeStudioMagneticField(nextFreq);
  const distToStudio = Math.abs(nextFreq - FM_STUDIO_FREQUENCY);

  // Защёлкивание в 104.2 FM при затухании внутри центра магнитной лунки
  if (distToStudio <= 0.03 && Math.abs(vel) <= 0.28) {
    return {
      frequency: FM_STUDIO_FREQUENCY,
      velocity: 0,
      magneticPull: 1,
      activeSpringTarget: null,
      settled: true,
    };
  }

  // Полная остановка после затухания инерции
  const nearNoisePull = FM_TUNER_STATIONS.some(
    (st) => st.kind === 'noise' && Math.abs(st.frequency - nextFreq) <= 0.28 && Math.abs(st.frequency - nextFreq) > 0.02
  );
  if (Math.abs(vel) <= 0.05 && nextField < 0.05 && !nearNoisePull) {
    const snapped = clampFmFrequency(nextFreq);
    return {
      frequency: snapped,
      velocity: 0,
      magneticPull: computeStudioMagneticField(snapped),
      activeSpringTarget: null,
      settled: true,
    };
  }

  return {
    frequency: nextFreq,
    velocity: Math.max(
      -FM_FLYWHEEL_MAX_VELOCITY_MHZ,
      Math.min(FM_FLYWHEEL_MAX_VELOCITY_MHZ, vel)
    ),
    magneticPull: nextField,
    activeSpringTarget: null,
    settled: false,
  };
}

export interface FmTunerSignalState {
  frequency: number;
  formattedFrequency: string;
  ratio: number;
  isLockedOnStudio: boolean;
  /** Чистота студийного сигнала FMWorks (1.0 ровно на 104.2 FM, 0..0.38 на чужих частотах) */
  studioClarity: number;
  /** Уровень эфирной ряби и расфокуса (0 на 104.2 FM, до 1.0 на чужих частотах и между станциями) */
  interferenceLevel: number;
  /** Уровень сигнала по 8-сегментной шкале Б&О/Braun (1..8) */
  signalBars: number;
  matchedStation: FmStationPreset | null;
  statusText: string;
}

export function evaluateFmTunerSignal(freq: number): FmTunerSignalState {
  const frequency = clampFmFrequency(freq);
  const distStudio = Math.abs(frequency - FM_STUDIO_FREQUENCY);
  const isLockedOnStudio = distStudio <= 0.05;

  const matchedStation =
    FM_TUNER_STATIONS.find((st) => Math.abs(st.frequency - frequency) <= 0.15) ?? null;

  // Студийная чистота максимальна только на 104.2 FM, плавно падает при уходе с частоты
  const studioClarity = isLockedOnStudio
    ? 1
    : Math.max(0.06, Math.exp(-(distStudio * distStudio) / 1.4) * 0.65);

  const interferenceLevel = isLockedOnStudio
    ? 0
    : Math.min(1, Math.max(0.32, 1 - studioClarity));

  // Индикатор сигнала: 8/8 на FMWorks, 3-5/8 на чужих станциях, 1-2/8 в белом шуме
  const signalBars = isLockedOnStudio
    ? 8
    : matchedStation?.kind === 'noise'
      ? 4
      : Math.max(1, Math.min(3, Math.round((1 - Math.min(1, distStudio / 6)) * 3)));

  const statusText = isLockedOnStudio
    ? 'STEREO • ON AIR'
    : 'СЛАБЫЙ ОТКЛИК • ФОНОВЫЙ ШУМ';

  return {
    frequency,
    formattedFrequency: formatFmFrequency(frequency),
    ratio: frequencyToRatio(frequency),
    isLockedOnStudio,
    studioClarity,
    interferenceLevel,
    signalBars,
    matchedStation,
    statusText,
  };
}
