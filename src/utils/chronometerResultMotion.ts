import type { FullScriptChronometerReport } from '../data/clientChronometerAndFz38';

export const CHRONOMETER_MOTION_EASE: readonly [number, number, number, number] = [
  0.16,
  1,
  0.3,
  1,
];

export const CHRONOMETER_MOTION_DURATION_SEC = 0.18;
export const CHRONOMETER_NUMBER_TWEEN_MS = 180;

export function easeOutCubic(rawProgress: number): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(rawProgress) ? rawProgress : 1));
  return 1 - Math.pow(1 - t, 3);
}

export function interpolateChronometerNumber(params: {
  from: number;
  to: number;
  progress: number;
  decimals?: 0 | 1;
  reducedMotion?: boolean;
}): number {
  const { from, to, progress, decimals = 1, reducedMotion = false } = params;
  if (!Number.isFinite(to)) return 0;
  if (!Number.isFinite(from) || reducedMotion || progress >= 1) {
    return roundToDecimals(to, decimals);
  }
  if (Math.abs(to - from) < (decimals === 0 ? 0.5 : 0.05)) {
    return roundToDecimals(to, decimals);
  }
  const eased = easeOutCubic(progress);
  const current = from + (to - from) * eased;
  return roundToDecimals(current, decimals);
}

function roundToDecimals(val: number, decimals: 0 | 1): number {
  if (decimals === 0) {
    return Math.round(val);
  }
  return Math.round(val * 10) / 10;
}

/**
 * Форматирует секунды так же, как числовой вывод в интерфейсе (без лишнего «.0» у целых чисел).
 */
export function formatChronometerNumber(
  val: number,
  decimals: 0 | 1 = 1,
  prefix = ''
): string {
  const rounded = roundToDecimals(Number.isFinite(val) ? val : 0, decimals);
  return `${prefix}${rounded}`;
}

/**
 * Вычисляет коэффициенты GPU-трансформации scaleX (от 0 до 1) для двухслойной шкалы хронометража
 * без перерасчёта геометрии (width).
 */
export function computeChronometerBarScales(params: {
  creativeSharePct: number;
  disclaimerSharePct: number;
}): {
  creativeScale: number;
  totalOccupiedScale: number;
} {
  const c = Math.max(0, Math.min(100, params.creativeSharePct || 0));
  const d = Math.max(0, Math.min(100 - c, params.disclaimerSharePct || 0));
  return {
    creativeScale: Math.round((c / 100) * 1000) / 1000,
    totalOccupiedScale: Math.round(((c + d) / 100) * 1000) / 1000,
  };
}

/**
 * Строит стабильный ключ структурного состояния правового блока, чтобы анимация появления карточек
 * срабатывала при смене режима ввода, примера, нажатии «Рассчитать» или изменении набора сносок ФЗ-38,
 * но не мигала статичной памяткой при изменении числа знаков и переходе между слотами.
 */
export function buildChronometerFindingsSignature(
  report: Pick<
    FullScriptChronometerReport,
    'inputMode' | 'isEmpty' | 'findings'
  >,
  explicitPulse = 0
): string {
  const findingsPart = report.findings
    .map((f) => `${f.code}:${f.severity}`)
    .join('|');
  return `${report.inputMode}:${report.isEmpty ? 'empty' : 'filled'}:${findingsPart}:p${explicitPulse}`;
}
