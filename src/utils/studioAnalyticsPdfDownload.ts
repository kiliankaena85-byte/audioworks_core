import { formatNumberSpaced, formatRubCompact } from '../data/radioInventory';
import type {
  StudioAnalyticsQuery,
  StudioAnalyticsSummary,
} from '../data/studioAnalyticsCore';
import {
  buildStudioAnalyticsExportFileName,
  describeAnalyticsQueryHuman,
  formatStudioAnalyticsCsv,
  wrapJpegPagesInA4Pdf,
} from '../data/studioAnalyticsExport';

export type AnalyticsReportMetricMode = 'orders' | 'revenue';

function triggerBrowserBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

export function downloadStudioAnalyticsCsvReport(
  summary: StudioAnalyticsSummary,
  query: StudioAnalyticsQuery,
  nowMs = Date.now()
): { fileName: string; rowsCount: number } {
  const csvContent = formatStudioAnalyticsCsv(summary, query, nowMs);
  const fileName = buildStudioAnalyticsExportFileName(query, 'csv', nowMs);
  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerBrowserBlobDownload(blob, fileName);
  return {
    fileName,
    rowsCount: summary.months.length,
  };
}

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
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function truncateTextToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

/**
 * Генерирует печатный аналитический отчёт A4 в формате PDF 1.4 (включая сводные KPI,
 * графики помесячной конверсии и скорости этапов воронки, а также таблицу показателей)
 * и инициирует прямое скачивание файла без открытия всплывающих окон.
 */
export function downloadStudioAnalyticsPdfReport(
  summary: StudioAnalyticsSummary,
  query: StudioAnalyticsQuery,
  metricMode: AnalyticsReportMetricMode,
  nowMs = Date.now()
): { fileName: string; byteSize: number } {
  const pageWidth = 1488;
  const pageHeight = 2105;
  const padX = 72;
  const contentW = pageWidth - padX * 2;
  const fontSans =
    '"Plus Jakarta Sans", "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  const canvas = document.createElement('canvas');
  canvas.width = pageWidth;
  canvas.height = pageHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось инициализировать графический контекст PDF');
  }

  const meta = describeAnalyticsQueryHuman(query, nowMs);

  // Чистый бумажный лист A4
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, pageWidth, pageHeight);

  // 1. Шапка аналитического отчёта
  let cursorY = 68;
  drawRoundedRectPath(ctx, padX, cursorY, 34, 34, 8);
  ctx.fillStyle = '#FF4820';
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 16px ${fontSans}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FM', padX + 17, cursorY + 18);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#111111';
  ctx.font = `700 22px ${fontSans}`;
  ctx.fillText('FMWorks · Аналитическая сводка студии', padX + 48, cursorY + 24);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#666660';
  ctx.font = `500 15px ${fontSans}`;
  ctx.fillText(
    `Сформировано: ${meta.generatedAtUtcPlus3}`,
    pageWidth - padX,
    cursorY + 23
  );

  cursorY += 62;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#111111';
  ctx.font = `700 32px ${fontSans}`;
  ctx.fillText(
    'Конверсия заказов и операционная эффективность',
    padX,
    cursorY
  );

  cursorY += 28;
  ctx.fillStyle = '#575752';
  ctx.font = `500 16px ${fontSans}`;
  ctx.fillText(
    `Горизонт: ${meta.periodLabel}  ·  Направление: ${meta.segmentLabel}  ·  Охват: ${meta.scopeLabel}`,
    padX,
    cursorY
  );

  cursorY += 22;
  ctx.strokeStyle = '#E4E3DD';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, cursorY);
  ctx.lineTo(pageWidth - padX, cursorY);
  ctx.stroke();

  // 2. Сводные KPI-карточки (4 колонки)
  cursorY += 28;
  const kpiGap = 20;
  const kpiW = (contentW - kpiGap * 3) / 4;
  const kpiH = 132;
  const slaColor =
    summary.totals.slaCompliancePct >= 85
      ? '#16A34A'
      : summary.totals.slaCompliancePct >= 70
        ? '#D97706'
        : '#DC2626';

  const kpis = [
    {
      label: 'Конверсия в сделку',
      value: `${summary.totals.overallConversionPct}%`,
      valueColor: '#111111',
      sub: `${summary.totals.convertedOrders} из ${summary.totals.totalOrders} заявок`,
    },
    {
      label: 'Объём подтверждённых сделок',
      value: formatRubCompact(summary.totals.confirmedRevenueRub),
      valueColor: '#111111',
      sub: `Ср. чек ${formatNumberSpaced(summary.totals.avgOrderValueRub)} ₽ · сдано ${summary.totals.deliveredOrders}`,
    },
    {
      label: 'Соблюдение SLA ≤ 15 мин',
      value: `${summary.totals.slaCompliancePct}%`,
      valueColor: slaColor,
      sub: `Средний отклик ${summary.totals.avgFirstResponseMin} мин`,
    },
    {
      label: 'Сдача с 1-го дубля',
      value: `${summary.totals.firstTakeApprovalPct}%`,
      valueColor: '#111111',
      sub: `Цикл этапов 01–04: ${summary.totals.avgProductionCycleHours} ч`,
    },
  ];

  kpis.forEach((card, idx) => {
    const x = padX + idx * (kpiW + kpiGap);
    drawRoundedRectPath(ctx, x, cursorY, kpiW, kpiH, 16);
    ctx.fillStyle = '#F8F7F3';
    ctx.fill();
    ctx.strokeStyle = '#E2E1DB';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#5E5E58';
    ctx.font = `600 14px ${fontSans}`;
    ctx.fillText(card.label, x + 20, cursorY + 34);

    ctx.fillStyle = card.valueColor;
    ctx.font = `700 30px ${fontSans}`;
    ctx.fillText(
      truncateTextToWidth(ctx, card.value, kpiW - 40),
      x + 20,
      cursorY + 78
    );

    ctx.fillStyle = '#666660';
    ctx.font = `500 13px ${fontSans}`;
    ctx.fillText(
      truncateTextToWidth(ctx, card.sub, kpiW - 40),
      x + 20,
      cursorY + 108
    );
  });

  // 3. Визуальные графики (слева: Конверсия по месяцам, справа: Скорость этапов воронки)
  cursorY += kpiH + 30;
  const chartsRowH = 440;
  const leftChartW = Math.round(contentW * 0.6);
  const rightChartW = contentW - leftChartW - 24;
  const rightChartX = padX + leftChartW + 24;

  // Левая карточка графика
  drawRoundedRectPath(ctx, padX, cursorY, leftChartW, chartsRowH, 18);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#E2E1DB';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#111111';
  ctx.font = `700 20px ${fontSans}`;
  ctx.fillText(
    '01. Динамика и конверсия заказов по месяцам',
    padX + 24,
    cursorY + 38
  );
  ctx.fillStyle = '#666660';
  ctx.font = `500 13px ${fontSans}`;
  ctx.fillText(
    metricMode === 'revenue'
      ? 'Столбцы: объём сделок (тыс. ₽)  ·  Линия (#FF4820): конверсия (%)'
      : 'Столбцы: поступило заявок / в сделке (шт.)  ·  Линия (#FF4820): конверсия (%)',
    padX + 24,
    cursorY + 62
  );

  const plot1X = padX + 56;
  const plot1Y = cursorY + 96;
  const plot1W = leftChartW - 112;
  const plot1H = chartsRowH - 148;

  const maxBarVal = Math.max(
    4,
    ...summary.months.map((m) =>
      metricMode === 'revenue' ? m.revenueThousandsRub : m.totalOrders
    )
  );

  // Сетка графика 1
  for (let step = 0; step <= 4; step += 1) {
    const ratio = step / 4;
    const y = plot1Y + plot1H - ratio * plot1H;
    ctx.strokeStyle = '#ECEBE6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plot1X, y);
    ctx.lineTo(plot1X + plot1W, y);
    ctx.stroke();

    const leftTick = Math.round(maxBarVal * ratio);
    ctx.fillStyle = '#73736D';
    ctx.font = `500 12px ${fontSans}`;
    ctx.textAlign = 'right';
    ctx.fillText(
      metricMode === 'revenue' ? `${leftTick}к` : String(leftTick),
      plot1X - 10,
      y + 4
    );

    ctx.fillStyle = '#FF4820';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(ratio * 100)}%`, plot1X + plot1W + 10, y + 4);
  }

  const monthCount = Math.max(1, summary.months.length);
  const slotW = plot1W / monthCount;
  const lineCoords: Array<{ x: number; y: number; pct: number }> = [];

  summary.months.forEach((m, idx) => {
    const centerX = plot1X + slotW * (idx + 0.5);
    if (metricMode === 'orders') {
      const bw = Math.min(20, Math.max(8, slotW * 0.28));
      const hTotal = (m.totalOrders / maxBarVal) * plot1H;
      const hConv = (m.convertedOrders / maxBarVal) * plot1H;

      if (hTotal > 0) {
        drawRoundedRectPath(
          ctx,
          centerX - bw - 2,
          plot1Y + plot1H - hTotal,
          bw,
          hTotal,
          3
        );
        ctx.fillStyle = '#D6D5CE';
        ctx.fill();
      }
      if (hConv > 0) {
        drawRoundedRectPath(
          ctx,
          centerX + 2,
          plot1Y + plot1H - hConv,
          bw,
          hConv,
          3
        );
        ctx.fillStyle = '#111111';
        ctx.fill();
      }
    } else {
      const bw = Math.min(26, Math.max(10, slotW * 0.42));
      const hRev = (m.revenueThousandsRub / maxBarVal) * plot1H;
      if (hRev > 0) {
        drawRoundedRectPath(
          ctx,
          centerX - bw / 2,
          plot1Y + plot1H - hRev,
          bw,
          hRev,
          3
        );
        ctx.fillStyle = '#111111';
        ctx.fill();
      }
    }

    ctx.fillStyle = '#575752';
    ctx.font = `600 12px ${fontSans}`;
    ctx.textAlign = 'center';
    ctx.fillText(m.monthLabel, centerX, plot1Y + plot1H + 24);

    const lineY = plot1Y + plot1H - (m.conversionPct / 100) * plot1H;
    lineCoords.push({ x: centerX, y: lineY, pct: m.conversionPct });
  });

  if (lineCoords.length > 0) {
    ctx.strokeStyle = '#FF4820';
    ctx.lineWidth = 3;
    ctx.beginPath();
    lineCoords.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    lineCoords.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FF4820';
      ctx.fill();
    });
  }

  // Правая карточка графика (Скорость этапов воронки 01–05)
  drawRoundedRectPath(ctx, rightChartX, cursorY, rightChartW, chartsRowH, 18);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#E2E1DB';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#111111';
  ctx.font = `700 20px ${fontSans}`;
  ctx.fillText(
    '02. Скорость этапов воронки (ч)',
    rightChartX + 24,
    cursorY + 38
  );
  ctx.fillStyle = '#666660';
  ctx.font = `500 13px ${fontSans}`;
  ctx.fillText(
    'Среднее время пребывания заказа на этапах 01–05',
    rightChartX + 24,
    cursorY + 62
  );

  const maxStageHours = Math.max(
    1,
    ...summary.stageEfficiency.map((s) => s.avgDurationHours)
  );
  const stagePlotX = rightChartX + 24;
  const stagePlotY = cursorY + 94;
  const stageRowH = 56;
  const barMaxW = rightChartW - 140;

  summary.stageEfficiency.forEach((st, idx) => {
    const rowTop = stagePlotY + idx * stageRowH;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4A4A45';
    ctx.font = `600 13px ${fontSans}`;
    ctx.fillText(
      truncateTextToWidth(ctx, st.stageLabel, rightChartW - 48),
      stagePlotX,
      rowTop + 14
    );

    const barW = Math.max(6, (st.avgDurationHours / maxStageHours) * barMaxW);
    drawRoundedRectPath(ctx, stagePlotX, rowTop + 22, barW, 18, 4);
    ctx.fillStyle = st.isBottleneck ? '#FF4820' : '#111111';
    ctx.fill();

    ctx.fillStyle = st.isBottleneck ? '#FF4820' : '#111111';
    ctx.font = `700 13px ${fontSans}`;
    ctx.fillText(`${st.avgDurationHours} ч`, stagePlotX + barW + 10, rowTop + 36);
  });

  const bottleneck = summary.stageEfficiency.find((s) => s.isBottleneck);
  if (bottleneck) {
    ctx.fillStyle = '#FF4820';
    ctx.font = `600 13px ${fontSans}`;
    ctx.textAlign = 'left';
    ctx.fillText(
      truncateTextToWidth(
        ctx,
        `Узкое место: ${bottleneck.stageLabel} (${bottleneck.avgDurationHours} ч)`,
        rightChartW - 48
      ),
      rightChartX + 24,
      cursorY + chartsRowH - 24
    );
  }

  // 4. Помесячная отчётная ведомость конверсии и SLA
  cursorY += chartsRowH + 30;
  const rowCount = summary.months.length;
  const headerH = 44;
  const titleBarH = 54;
  const bodyRowH = rowCount > 6 ? 50 : 62;
  const tableCardH = titleBarH + headerH + rowCount * bodyRowH + 16;

  drawRoundedRectPath(ctx, padX, cursorY, contentW, tableCardH, 18);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#E2E1DB';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#111111';
  ctx.font = `700 19px ${fontSans}`;
  ctx.fillText(
    '03. Помесячная ведомость конверсии, выручки и SLA студии (UTC+3)',
    padX + 24,
    cursorY + 35
  );

  const cols = [
    { title: 'Период', x: padX + 24, align: 'left' as const },
    { title: 'Заявки', x: padX + 250, align: 'right' as const },
    { title: 'В сделке', x: padX + 365, align: 'right' as const },
    { title: 'Сдано', x: padX + 465, align: 'right' as const },
    { title: 'Конверсия', x: padX + 595, align: 'right' as const },
    { title: 'Объём сделок', x: padX + 785, align: 'right' as const },
    { title: 'Отклик SLA', x: padX + 985, align: 'right' as const },
    { title: 'С 1-го дубля', x: padX + 1135, align: 'right' as const },
    { title: 'Флагман периода', x: padX + 1165, align: 'left' as const },
  ];

  const thTop = cursorY + titleBarH;
  ctx.fillStyle = '#F6F5F0';
  ctx.fillRect(padX + 2, thTop, contentW - 4, headerH);

  ctx.font = `700 13px ${fontSans}`;
  ctx.fillStyle = '#575752';
  cols.forEach((col) => {
    ctx.textAlign = col.align;
    ctx.fillText(col.title, col.x, thTop + 27);
  });

  summary.months.forEach((row, idx) => {
    const rTop = thTop + headerH + idx * bodyRowH;
    if (idx % 2 === 1) {
      ctx.fillStyle = '#FAF9F6';
      ctx.fillRect(padX + 2, rTop, contentW - 4, bodyRowH);
    }
    ctx.strokeStyle = '#ECEBE6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX + 16, rTop);
    ctx.lineTo(padX + contentW - 16, rTop);
    ctx.stroke();

    const textY = rTop + Math.round(bodyRowH * 0.6);
    ctx.font = `600 14px ${fontSans}`;
    ctx.fillStyle = '#111111';
    ctx.textAlign = 'left';
    ctx.fillText(row.monthFullLabel, cols[0].x, textY);

    ctx.textAlign = 'right';
    ctx.font = `500 14px ${fontSans}`;
    ctx.fillStyle = '#333330';
    ctx.fillText(String(row.totalOrders), cols[1].x, textY);
    ctx.fillText(String(row.convertedOrders), cols[2].x, textY);
    ctx.fillText(String(row.deliveredOrders), cols[3].x, textY);

    ctx.font = `700 14px ${fontSans}`;
    ctx.fillStyle = '#FF4820';
    ctx.fillText(`${row.conversionPct}%`, cols[4].x, textY);

    ctx.fillStyle = '#111111';
    ctx.fillText(`${formatNumberSpaced(row.revenueRub)} ₽`, cols[5].x, textY);

    ctx.font = `500 13px ${fontSans}`;
    ctx.fillStyle = '#333330';
    ctx.fillText(
      row.totalOrders > 0
        ? `${row.avgFirstResponseMin} мин (${row.slaCompliancePct}%)`
        : '—',
      cols[6].x,
      textY
    );

    ctx.font = `700 14px ${fontSans}`;
    ctx.fillStyle = '#16A34A';
    ctx.fillText(
      row.convertedOrders > 0 ? `${row.firstTakeApprovalPct}%` : '—',
      cols[7].x,
      textY
    );

    const topDeal = row.topOrders[0];
    ctx.textAlign = 'left';
    ctx.font = `500 12px ${fontSans}`;
    ctx.fillStyle = '#575752';
    ctx.fillText(
      topDeal
        ? truncateTextToWidth(ctx, `#${topDeal.orderNumber}`, 152)
        : '—',
      cols[8].x,
      textY
    );
  });

  // 5. Колонтитул документа
  ctx.textAlign = 'left';
  ctx.fillStyle = '#85857E';
  ctx.font = `500 13px ${fontSans}`;
  ctx.fillText(
    'FMWorks Studio CRM · Отчётность эффективности продакшна и конверсии сделок',
    padX,
    pageHeight - 36
  );
  ctx.textAlign = 'right';
  ctx.fillText('Стр. 1 из 1', pageWidth - padX, pageHeight - 36);

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const jpegBytes = dataUrlToUint8Array(jpegDataUrl);
  const pdfBytes = wrapJpegPagesInA4Pdf([
    {
      jpegBytes,
      pixelWidth: pageWidth,
      pixelHeight: pageHeight,
    },
  ]);

  const fileName = buildStudioAnalyticsExportFileName(query, 'pdf', nowMs);
  const pdfArrayBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
  triggerBrowserBlobDownload(blob, fileName);

  return {
    fileName,
    byteSize: pdfBytes.byteLength,
  };
}
