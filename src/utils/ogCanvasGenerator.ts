import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  type OgCardSpec,
  wrapOgTextLines,
} from '../data/ogImageTemplates';

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function loadImageForCanvas(src: string): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined' || !src) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCoverImageCropped(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
): void {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  if (!sw || !sh) return;

  const targetRatio = dw / dh;
  const sourceRatio = sw / sh;
  let sx = 0;
  let sy = 0;
  let sWidth = sw;
  let sHeight = sh;

  if (sourceRatio > targetRatio) {
    sWidth = sh * targetRatio;
    sx = (sw - sWidth) / 2;
  } else {
    sHeight = sw / targetRatio;
    sy = (sh - sHeight) / 2;
  }

  ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dw, dh);
}

/**
 * Отрисовывает брендированную OpenGraph-карточку (1200×630 px) с помощью браузерного Canvas API.
 */
export async function renderOgCardToCanvas(
  canvas: HTMLCanvasElement,
  spec: OgCardSpec
): Promise<void> {
  canvas.width = OG_IMAGE_WIDTH;
  canvas.height = OG_IMAGE_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Proceed with available fallback fonts
    }
  }

  const coverImg = await loadImageForCanvas(spec.coverImagePath);

  const sansFont = "'Manrope', 'Golos Text', -apple-system, BlinkMacSystemFont, sans-serif";
  const monoFont = "'JetBrains Mono', ui-monospace, monospace";

  // 1. Студийный фон и радиальное свечение
  ctx.fillStyle = spec.surfaceBg;
  ctx.fillRect(0, 0, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT);

  const radial = ctx.createRadialGradient(264, 114, 10, 264, 114, 720);
  radial.addColorStop(0, 'rgba(255, 72, 32, 0.24)');
  radial.addColorStop(0.65, 'rgba(20, 20, 24, 0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT);

  // Внешняя рамка
  drawRoundedRectPath(ctx, 24, 24, 1152, 582, 32);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 2. Правая фотографическая карточка (388×534)
  ctx.save();
  drawRoundedRectPath(ctx, 760, 48, 388, 534, 28);
  ctx.clip();

  if (coverImg) {
    drawCoverImageCropped(ctx, coverImg, 760, 48, 388, 534);
  } else {
    const fallbackGrad = ctx.createLinearGradient(760, 48, 1148, 582);
    fallbackGrad.addColorStop(0, '#272226');
    fallbackGrad.addColorStop(1, '#121216');
    ctx.fillStyle = fallbackGrad;
    ctx.fillRect(760, 48, 388, 534);
  }

  const vignette = ctx.createLinearGradient(0, 48, 0, 582);
  vignette.addColorStop(0, 'rgba(13, 13, 16, 0.08)');
  vignette.addColorStop(0.6, 'rgba(13, 13, 16, 0.25)');
  vignette.addColorStop(1, 'rgba(13, 13, 16, 0.84)');
  ctx.fillStyle = vignette;
  ctx.fillRect(760, 48, 388, 534);
  ctx.restore();

  drawRoundedRectPath(ctx, 760, 48, 388, 534, 28);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Плашка эфирного стандарта на обложке
  drawRoundedRectPath(ctx, 784, 514, 232, 40, 20);
  ctx.fillStyle = 'rgba(13, 13, 16, 0.8)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(806, 534, 5, 0, Math.PI * 2);
  ctx.fillStyle = spec.accentColor;
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 13px ${monoFont}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('1200×630 · ЭФИР -14 LUFS', 820, 534);

  // 3. Логотип FMWorks® со звуковой волной W
  ctx.save();
  ctx.translate(64, 52);
  drawRoundedRectPath(ctx, 0, 0, 46, 46, 12);
  ctx.fillStyle = spec.accentColor;
  ctx.fill();

  ctx.save();
  ctx.scale(0.958, 0.958);
  ctx.beginPath();
  ctx.moveTo(7.2, 24.5);
  ctx.bezierCurveTo(8.9, 24.5, 9.5, 15.2, 11.0, 15.2);
  ctx.bezierCurveTo(13.0, 15.2, 15.0, 34.4, 17.4, 34.4);
  ctx.bezierCurveTo(19.8, 34.4, 21.6, 16.6, 24.0, 16.6);
  ctx.bezierCurveTo(26.4, 16.6, 28.2, 34.4, 30.6, 34.4);
  ctx.bezierCurveTo(33.0, 34.4, 35.0, 15.2, 37.0, 15.2);
  ctx.bezierCurveTo(38.5, 15.2, 39.1, 24.5, 40.8, 24.5);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 28px ${sansFont}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('FMWorks', 60, 32);
  const wordWidth = ctx.measureText('FMWorks').width;
  ctx.fillStyle = 'rgba(244, 243, 239, 0.58)';
  ctx.font = `700 13px ${sansFont}`;
  ctx.fillText('®', 60 + wordWidth + 2, 19);
  ctx.restore();

  // 4. Рубрика маршрута
  drawRoundedRectPath(ctx, 64, 118, 656, 32, 10);
  ctx.fillStyle = 'rgba(255, 72, 32, 0.14)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 72, 32, 0.40)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#FFB39E';
  ctx.font = `700 13px ${monoFont}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.eyebrow.slice(0, 68), 78, 134);

  // 5. Заголовок и подзаголовок
  const titleLines = wrapOgTextLines(spec.title, 26, 3);
  const subtitleLines = wrapOgTextLines(spec.subtitle, 48, 2);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 36px ${sansFont}`;
  const titleStartY = 200;
  const titleLineHeight = 46;
  titleLines.forEach((line, idx) => {
    ctx.fillText(line, 64, titleStartY + idx * titleLineHeight);
  });

  const subtitleStartY = titleStartY + titleLines.length * titleLineHeight + 16;
  ctx.fillStyle = 'rgba(244, 243, 239, 0.74)';
  ctx.font = `400 19px ${sansFont}`;
  subtitleLines.forEach((line, idx) => {
    ctx.fillText(line, 64, subtitleStartY + idx * 28);
  });

  // 6. 28-полосная акустическая волна
  const waveBarY = 418;
  const waveBarBaseX = 64;
  spec.waveformSeeds.slice(0, 28).forEach((amp, idx) => {
    const h = Math.max(8, Math.round(amp * 34));
    const x = waveBarBaseX + idx * 14;
    const y = waveBarY + Math.round((36 - h) / 2);
    drawRoundedRectPath(ctx, x, y, 8, h, 4);
    ctx.fillStyle = idx < 17 ? spec.accentColor : 'rgba(255, 255, 255, 0.28)';
    ctx.fill();
  });

  ctx.fillStyle = 'rgba(244, 243, 239, 0.54)';
  ctx.font = `600 13px ${monoFont}`;
  ctx.fillText('AUDIOWORKS MASTER CARD', 472, 441);

  // 7. Три карточки KPI / тарифов
  const badges = spec.badges.slice(0, 3);
  const badgeCount = badges.length;
  const badgeTotalWidth = 656;
  const badgeGap = 14;
  const badgeWidth =
    badgeCount > 0
      ? Math.floor((badgeTotalWidth - badgeGap * (badgeCount - 1)) / badgeCount)
      : 210;

  badges.forEach((badge, idx) => {
    const bx = 64 + idx * (badgeWidth + badgeGap);
    const by = 472;
    drawRoundedRectPath(ctx, bx, by, badgeWidth, 82, 16);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const clippedVal =
      badge.value.length > 18 ? `${badge.value.slice(0, 17)}…` : badge.value;
    const clippedLabel =
      badge.label.length > 25 ? `${badge.label.slice(0, 24)}…` : badge.label;

    ctx.fillStyle = spec.accentColor;
    ctx.font = `700 21px ${sansFont}`;
    ctx.fillText(clippedVal, bx + 15, by + 34);

    ctx.fillStyle = 'rgba(244, 243, 239, 0.68)';
    ctx.font = `500 12px ${sansFont}`;
    ctx.fillText(clippedLabel, bx + 15, by + 61);
  });

  // 8. Нижний колонтитул карточки
  ctx.beginPath();
  ctx.moveTo(64, 572);
  ctx.lineTo(720, 572);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = 'rgba(244, 243, 239, 0.82)';
  ctx.font = `600 14px ${monoFont}`;
  ctx.textAlign = 'left';
  ctx.fillText(spec.footerLeft, 64, 594);

  ctx.fillStyle = 'rgba(244, 243, 239, 0.56)';
  ctx.font = `500 14px ${sansFont}`;
  ctx.textAlign = 'right';
  ctx.fillText(spec.footerRight, 720, 594);
  ctx.textAlign = 'left';
}

/**
 * Экспортирует OpenGraph-карточку (1200×630) в PNG Blob с помощью Canvas API.
 */
export async function exportOgCardCanvasPngBlob(
  spec: OgCardSpec,
  existingCanvas?: HTMLCanvasElement | null
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const canvas = existingCanvas ?? document.createElement('canvas');
  await renderOgCardToCanvas(canvas, spec);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
