import { PortfolioCaseRecord, StudioCmsSnapshot } from './studioCmsTypes';

export const WAVE1_DEFAULT_PREVIEW_DURATION_SEC = 3;
export const MAX_PORTFOLIO_AUDIO_BYTES = 80 * 1024 * 1024;

export interface AudioFileValidationInput {
  name: string;
  type?: string;
  size: number;
}

export type AudioFileValidationResult =
  | { ok: true; format: 'WAV' | 'MP3' }
  | { ok: false; error: string };

/**
 * Проверяет загружаемый мастер-файл портфолио (строго непустой WAV или MP3 до 80 МБ).
 */
export function validatePortfolioAudioFileMeta(
  input: AudioFileValidationInput
): AudioFileValidationResult {
  const cleanName = (input.name || '').trim();
  if (!cleanName || !Number.isFinite(input.size) || input.size <= 0) {
    return {
      ok: false,
      error: 'Файл пустой или повреждён. Выберите корректный мастер-файл WAV или MP3.',
    };
  }

  if (input.size > MAX_PORTFOLIO_AUDIO_BYTES) {
    return {
      ok: false,
      error: 'Размер аудиофайла превышает 80 МБ. Загрузите эфирный мастер WAV или MP3.',
    };
  }

  const lowerName = cleanName.toLowerCase();
  const lowerMime = (input.type || '').trim().toLowerCase();

  const isWav =
    lowerName.endsWith('.wav') ||
    lowerMime === 'audio/wav' ||
    lowerMime === 'audio/x-wav' ||
    lowerMime === 'audio/wave' ||
    lowerMime === 'audio/vnd.wave';

  if (isWav) {
    return { ok: true, format: 'WAV' };
  }

  const isMp3 =
    lowerName.endsWith('.mp3') ||
    lowerMime === 'audio/mpeg' ||
    lowerMime === 'audio/mp3';

  if (isMp3) {
    return { ok: true, format: 'MP3' };
  }

  return {
    ok: false,
    error: 'Поддерживаются только аудиофайлы форматов WAV (.wav) и MP3 (.mp3).',
  };
}

/**
 * Читает точную длительность WAV-файла напрямую из заголовка RIFF/WAVE (без ожидания кодека браузера).
 */
export function parseWavDurationFromBuffer(buffer: ArrayBuffer): number | null {
  if (!buffer || buffer.byteLength < 44) return null;
  const view = new DataView(buffer);

  const readFourCC = (offset: number): string => {
    if (offset + 4 > view.byteLength) return '';
    return String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
  };

  if (readFourCC(0) !== 'RIFF' || readFourCC(8) !== 'WAVE') {
    return null;
  }

  let byteRate = 0;
  let dataByteLength = 0;
  let offset = 12;

  while (offset + 8 <= view.byteLength) {
    const chunkId = readFourCC(offset);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkId === 'fmt ' && chunkSize >= 16 && chunkDataOffset + 12 <= view.byteLength) {
      byteRate = view.getUint32(chunkDataOffset + 8, true);
    } else if (chunkId === 'data') {
      const availableBytes = Math.max(0, view.byteLength - chunkDataOffset);
      dataByteLength = Math.min(chunkSize, availableBytes);
      if (byteRate > 0) {
        break;
      }
    }

    const paddedStep = chunkSize + (chunkSize % 2);
    if (paddedStep <= 0 && chunkSize === 0) {
      offset += 8;
    } else {
      offset = chunkDataOffset + paddedStep;
    }
  }

  if (byteRate <= 0 || dataByteLength <= 0) {
    return null;
  }

  const seconds = dataByteLength / byteRate;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return Math.round(seconds * 100) / 100;
}

export interface PreviewTimelineMetrics {
  trackStartSec: number;
  trackEndSec: number;
  trackSpanSec: number;
  previewStartSec: number;
  previewEndSec: number;
  previewDurationSec: number;
  maxPreviewStartSec: number;
  offsetPercent: number;
  widthPercent: number;
}

/**
 * Рассчитывает геометрию и границы окна короткого превью (по умолчанию 3.0 сек) на шкале ролика.
 */
export function computePreviewWindowTimeline(
  item: Pick<
    PortfolioCaseRecord,
    | 'durationSec'
    | 'clipStartSec'
    | 'clipEndSec'
    | 'previewStartSec'
    | 'previewDurationSec'
  >
): PreviewTimelineMetrics {
  const trackStartSec =
    typeof item.clipStartSec === 'number' && Number.isFinite(item.clipStartSec)
      ? Math.max(0, Math.round(item.clipStartSec * 100) / 100)
      : 0;

  const fallbackSpan =
    typeof item.durationSec === 'number' && Number.isFinite(item.durationSec)
      ? Math.max(1, item.durationSec)
      : 15;

  const trackEndSec =
    typeof item.clipEndSec === 'number' &&
    Number.isFinite(item.clipEndSec) &&
    item.clipEndSec > trackStartSec
      ? Math.round(item.clipEndSec * 100) / 100
      : Math.round((trackStartSec + fallbackSpan) * 100) / 100;

  const trackSpanSec = Math.max(1, Math.round((trackEndSec - trackStartSec) * 100) / 100);

  const rawPreviewDur =
    typeof item.previewDurationSec === 'number' &&
    Number.isFinite(item.previewDurationSec)
      ? item.previewDurationSec
      : WAVE1_DEFAULT_PREVIEW_DURATION_SEC;

  const boundedDur = Math.min(5, Math.max(3, rawPreviewDur));
  const previewDurationSec =
    Math.round(Math.min(trackSpanSec, boundedDur) * 10) / 10;

  const maxPreviewStartSec =
    Math.round(Math.max(trackStartSec, trackEndSec - previewDurationSec) * 100) / 100;

  const rawStart =
    typeof item.previewStartSec === 'number' && Number.isFinite(item.previewStartSec)
      ? item.previewStartSec
      : trackStartSec;

  const previewStartSec =
    Math.round(
      Math.min(Math.max(trackStartSec, rawStart), maxPreviewStartSec) * 100
    ) / 100;

  const previewEndSec = Math.round((previewStartSec + previewDurationSec) * 100) / 100;

  const rawOffsetPct = ((previewStartSec - trackStartSec) / trackSpanSec) * 100;
  const rawWidthPct = (previewDurationSec / trackSpanSec) * 100;

  const offsetPercent = Math.min(100, Math.max(0, Math.round(rawOffsetPct * 100) / 100));
  const widthPercent = Math.min(
    100 - offsetPercent,
    Math.max(2, Math.round(rawWidthPct * 100) / 100)
  );

  return {
    trackStartSec,
    trackEndSec,
    trackSpanSec,
    previewStartSec,
    previewEndSec,
    previewDurationSec,
    maxPreviewStartSec,
    offsetPercent,
    widthPercent,
  };
}

/**
 * Применяет эталонное 3-секундное окно превью к карточке кейса с безопасным зажимом границ.
 */
export function applyThreeSecondPreviewTiming(
  item: PortfolioCaseRecord,
  desiredStartSec?: number
): PortfolioCaseRecord {
  const nextCandidate: PortfolioCaseRecord = {
    ...item,
    previewDurationSec: WAVE1_DEFAULT_PREVIEW_DURATION_SEC,
    previewStartSec:
      desiredStartSec !== undefined
        ? desiredStartSec
        : item.previewStartSec ?? item.clipStartSec ?? 0,
  };
  const metrics = computePreviewWindowTimeline(nextCandidate);
  return {
    ...nextCandidate,
    previewStartSec: metrics.previewStartSec,
    previewDurationSec: metrics.previewDurationSec,
  };
}

/**
 * Определяет формат прикреплённого аудио для бейджа в списке работ портфолио.
 */
export function resolveAudioBadgeLabel(item: Pick<PortfolioCaseRecord, 'audioUrl' | 'customAudioFileName'>): string {
  const ref = (item.customAudioFileName || item.audioUrl || '').toLowerCase();
  if (!ref) return 'Синтез';
  if (ref.includes('.mp3')) return 'MP3';
  if (ref.includes('.wav')) return 'WAV';
  if (ref.startsWith('blob:')) return 'Аудио';
  return 'WAV';
}

/**
 * Подсчитывает количество изменённых или добавленных работ портфолио в локальном состоянии CMS.
 */
export function countLocalPortfolioChanges(
  current: StudioCmsSnapshot,
  baseline: StudioCmsSnapshot
): number {
  let count = 0;

  if (JSON.stringify(current.flagshipReel) !== JSON.stringify(baseline.flagshipReel)) {
    count += 1;
  }

  const baseById = new Map(baseline.portfolioCases.map((c) => [c.id, c]));
  const currentIds = new Set(current.portfolioCases.map((c) => c.id));

  for (const item of current.portfolioCases) {
    const base = baseById.get(item.id);
    if (!base || JSON.stringify(item) !== JSON.stringify(base)) {
      count += 1;
    }
  }

  for (const baseItem of baseline.portfolioCases) {
    if (!currentIds.has(baseItem.id)) {
      count += 1;
    }
  }

  return count;
}
