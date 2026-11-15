import { formatIsoToUtcPlus3Ymd } from './orderStageHistory.ts';
import type {
  StudioAnalyticsQuery,
  StudioAnalyticsSummary,
} from './studioAnalyticsCore.ts';
import { formatStatusTimestampUtcPlus3 } from './telegramOrderNotifications.ts';

export type AnalyticsExportFormat = 'csv' | 'pdf';

export interface AnalyticsHumanQueryLabels {
  periodLabel: string;
  segmentLabel: string;
  scopeLabel: string;
  generatedAtUtcPlus3: string;
  dateSlugYmd: string;
}

export function describeAnalyticsQueryHuman(
  query: StudioAnalyticsQuery,
  nowMs = Date.now()
): AnalyticsHumanQueryLabels {
  const iso = new Date(nowMs).toISOString();
  const periodLabel =
    query.periodMonths === 12 ? '12 месяцев' : '6 месяцев';
  const segmentLabel =
    query.segment === 'production_only'
      ? 'Аудиопродакшн'
      : query.segment === 'air_plus_production'
        ? 'Эфир + продакшн'
        : 'Все направления';
  const scopeLabel =
    query.scope === 'live_crm_only'
      ? 'Только живой реестр CRM'
      : 'Реестр CRM + архив закрытых периодов';

  return {
    periodLabel,
    segmentLabel,
    scopeLabel,
    generatedAtUtcPlus3: formatStatusTimestampUtcPlus3(iso),
    dateSlugYmd: formatIsoToUtcPlus3Ymd(iso),
  };
}

export function buildStudioAnalyticsExportFileName(
  query: StudioAnalyticsQuery,
  format: AnalyticsExportFormat,
  nowMs = Date.now()
): string {
  const ymd = formatIsoToUtcPlus3Ymd(new Date(nowMs).toISOString());
  const segSlug =
    query.segment === 'production_only'
      ? 'prod'
      : query.segment === 'air_plus_production'
        ? 'air-prod'
        : 'all';
  const scopeSlug = query.scope === 'live_crm_only' ? 'live' : 'full';
  return `fmworks-analytics-${query.periodMonths}m-${segSlug}-${scopeSlug}-${ymd}.${format}`;
}

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let str = String(value).replace(/\r?\n/g, ' ').trim();
  // Защита от CSV Formula Injection в табличных процессорах при открытии текстовых ячеек
  if (
    typeof value === 'string' &&
    str.length > 0 &&
    /^[=+\-@]/.test(str) &&
    !/^-[0-9]/.test(str)
  ) {
    str = `'${str}`;
  }
  if (str.includes(';') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Формирует полную отчётную выгрузку графиков конверсии и эффективности работы студии в формате CSV
 * (кодировка UTF-8 с BOM \uFEFF, разделитель «;» для корректного открытия в табличных редакторах).
 */
export function formatStudioAnalyticsCsv(
  summary: StudioAnalyticsSummary,
  query: StudioAnalyticsQuery,
  nowMs = Date.now()
): string {
  const meta = describeAnalyticsQueryHuman(query, nowMs);
  const lines: string[] = [];

  // Блок 1: Паспорт отчёта и сводные показатели эффективности
  lines.push(
    [
      escapeCsvField('Отчёт студии FMWorks'),
      escapeCsvField('Конверсия заказов и операционная эффективность'),
    ].join(';')
  );
  lines.push(
    [
      escapeCsvField('Дата формирования (UTC+3)'),
      escapeCsvField(meta.generatedAtUtcPlus3),
    ].join(';')
  );
  lines.push(
    [escapeCsvField('Горизонт расчёта'), escapeCsvField(meta.periodLabel)].join(
      ';'
    )
  );
  lines.push(
    [
      escapeCsvField('Направление заказов'),
      escapeCsvField(meta.segmentLabel),
    ].join(';')
  );
  lines.push(
    [escapeCsvField('Охват выборки'), escapeCsvField(meta.scopeLabel)].join(';')
  );
  lines.push('');

  lines.push(
    [escapeCsvField('Сводная метрика'), escapeCsvField('Значение')].join(';')
  );
  lines.push(
    [
      escapeCsvField('Поступило заявок (шт.)'),
      escapeCsvField(summary.totals.totalOrders),
    ].join(';')
  );
  lines.push(
    [
      escapeCsvField('Подтверждено в сделку (шт.)'),
      escapeCsvField(summary.totals.convertedOrders),
    ].join(';')
  );
  lines.push(
    [
      escapeCsvField('Сдано мастеров и актов (шт.)'),
      escapeCsvField(summary.totals.deliveredOrders),
    ].join(';')
  );
  lines.push(
    [
      escapeCsvField('Конверсия в сделку (%)'),
      escapeCsvField(summary.totals.overallConversionPct),
    ].join(';')
  );
  lines.push(
    [
      escapeCsvField('Объём подтверждённых заказов (руб)'),
      escapeCsvField(summary.totals.confirmedRevenueRub),
    ].join(';')
  );
  lines.push(
    [
      escapeCsvField('Средний чек сделки (руб)'),
      escapeCsvField(summary.totals.avgOrderValueRub),
    ].join(';')
  );
  lines.push(
    [
      escapeCsvField('Соблюдение SLA первого ответа ≤ 15 мин (%)'),
      escapeCsvField(summary.totals.slaCompliancePct),
    ].join(';')
  );
  lines.push(
    [
      escapeCsvField('Средний первый отклик продюсера (мин)'),
      escapeCsvField(summary.totals.avgFirstResponseMin),
    ].join(';')
  );
  lines.push(
    [
      escapeCsvField('Сдача роликов с 1-го дубля (%)'),
      escapeCsvField(summary.totals.firstTakeApprovalPct),
    ].join(';')
  );
  lines.push(
    [
      escapeCsvField('Средний цикл этапов 01–04 (ч)'),
      escapeCsvField(summary.totals.avgProductionCycleHours),
    ].join(';')
  );
  lines.push('');

  // Блок 2: Помесячные данные графиков конверсии и эффективности студии
  lines.push(
    [
      'Код месяца',
      'Период (UTC+3)',
      'Поступило заявок',
      'В сделке и продакшне',
      'Сдано мастеров',
      'Конверсия (%)',
      'Динамика к пред. мес. (п.п.)',
      'Объём сделок (руб)',
      'Средний чек (руб)',
      'Соблюдение SLA ≤ 15 мин (%)',
      'Отклик ср. (мин)',
      'Отклик мин–макс (мин)',
      'Сдача с 1-го дубля (%)',
      'Ключевые заказы периода',
    ]
      .map(escapeCsvField)
      .join(';')
  );

  for (const row of summary.months) {
    const deltaText =
      row.conversionDeltaPp === null
        ? ''
        : row.conversionDeltaPp > 0
          ? `+${row.conversionDeltaPp}`
          : String(row.conversionDeltaPp);
    const rangeText =
      row.totalOrders > 0
        ? `${row.minFirstResponseMin}-${row.maxFirstResponseMin}`
        : '';
    const ordersDigestText = row.topOrders
      .map((o) => `#${o.orderNumber} ${o.clientLabel} (${o.budgetRub} руб)`)
      .join(' | ');

    lines.push(
      [
        escapeCsvField(row.monthKey),
        escapeCsvField(row.monthFullLabel),
        escapeCsvField(row.totalOrders),
        escapeCsvField(row.convertedOrders),
        escapeCsvField(row.deliveredOrders),
        escapeCsvField(row.conversionPct),
        escapeCsvField(deltaText),
        escapeCsvField(row.revenueRub),
        escapeCsvField(row.avgOrderValueRub),
        escapeCsvField(row.slaCompliancePct),
        escapeCsvField(row.avgFirstResponseMin),
        escapeCsvField(rangeText),
        escapeCsvField(row.firstTakeApprovalPct),
        escapeCsvField(ordersDigestText),
      ].join(';')
    );
  }

  lines.push('');

  // Блок 3: Скорость прохождения этапов воронки (01–05)
  lines.push(
    [
      'Код этапа',
      'Этап воронки',
      'Среднее время (ч)',
      'Пиковое время (ч)',
      'Доля цикла (%)',
      'Сейчас на этапе',
      'Переходов в журнале',
      'Статус этапа',
      'Детализация заказов этапа',
    ]
      .map(escapeCsvField)
      .join(';')
  );

  for (const st of summary.stageEfficiency) {
    const stOrdersText = st.stageOrders
      .map(
        (o) =>
          `#${o.orderNumber} ${o.clientLabel}${
            o.dwellHours !== undefined ? ` (${o.dwellHours} ч)` : ''
          }`
      )
      .join(' | ');
    lines.push(
      [
        escapeCsvField(st.stepCode),
        escapeCsvField(st.stageLabel),
        escapeCsvField(st.avgDurationHours),
        escapeCsvField(st.maxDurationHours),
        escapeCsvField(st.shareOfCyclePct),
        escapeCsvField(st.activeOrdersCount),
        escapeCsvField(st.transitionsCount),
        escapeCsvField(st.isBottleneck ? 'Узкое место цикла' : 'В нормативе'),
        escapeCsvField(stOrdersText),
      ].join(';')
    );
  }

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export interface PdfRasterPageInput {
  jpegBytes: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
}

/**
 * Упаковывает одну или несколько растровых страниц отчёта (JPEG RGB) в валидный бинарный документ PDF 1.4
 * формата A4 (595.28 × 841.89 pt) с точной таблицей перекрёстных ссылок xref.
 * Не требует сторонних тяжёлых зависимостей и сохраняет 100% точность кириллической типографики и графиков.
 */
export function wrapJpegPagesInA4Pdf(
  pages: readonly PdfRasterPageInput[]
): Uint8Array {
  if (pages.length === 0) {
    throw new Error('Для генерации PDF необходима хотя бы одна страница');
  }

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    byteLength += bytes.length;
  };
  const pushAscii = (text: string) => {
    pushBytes(encoder.encode(text));
  };

  // Заголовок PDF 1.4 + бинарная метка (4 байта > 127 по спецификации PDF)
  pushBytes(
    new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3,
      0xcf, 0xd3, 0x0a,
    ])
  );

  // Нумерация объектов:
  // 1 0 obj -> Catalog
  // 2 0 obj -> Pages
  // Для каждой страницы i (0..N-1):
  //   pageObj = 3 + i * 3
  //   contentObj = 4 + i * 3
  //   imageObj = 5 + i * 3
  const totalObjects = 2 + pages.length * 3;
  const offsets = new Array<number>(totalObjects + 1).fill(0);

  const pageObjIds = pages.map((_, idx) => 3 + idx * 3);

  // 1 0 obj: Catalog
  offsets[1] = byteLength;
  pushAscii('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // 2 0 obj: Pages
  offsets[2] = byteLength;
  const kidsRefs = pageObjIds.map((id) => `${id} 0 R`).join(' ');
  pushAscii(
    `2 0 obj\n<< /Type /Pages /Kids [ ${kidsRefs} ] /Count ${pages.length} >>\nendobj\n`
  );

  const a4WidthPt = '595.28';
  const a4HeightPt = '841.89';

  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const widthPx = Math.max(1, Math.round(page.pixelWidth));
    const heightPx = Math.max(1, Math.round(page.pixelHeight));
    const pageObjId = 3 + i * 3;
    const contentObjId = 4 + i * 3;
    const imageObjId = 5 + i * 3;

    // Page object
    offsets[pageObjId] = byteLength;
    pushAscii(
      `${pageObjId} 0 obj\n` +
        `<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 ${a4WidthPt} ${a4HeightPt} ] ` +
        `/Resources << /XObject << /Im0 ${imageObjId} 0 R >> >> ` +
        `/Contents ${contentObjId} 0 R >>\n` +
        `endobj\n`
    );

    // Content stream drawing /Im0 stretched cleanly onto A4 MediaBox
    const contentStream = `q\n${a4WidthPt} 0 0 ${a4HeightPt} 0 0 cm\n/Im0 Do\nQ\n`;
    const contentBytes = encoder.encode(contentStream);
    offsets[contentObjId] = byteLength;
    pushAscii(`${contentObjId} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
    pushBytes(contentBytes);
    pushAscii('\nendstream\nendobj\n');

    // Image XObject (/DCTDecode JPEG stream)
    offsets[imageObjId] = byteLength;
    pushAscii(
      `${imageObjId} 0 obj\n` +
        `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
        `/Length ${page.jpegBytes.length} >>\n` +
        `stream\n`
    );
    pushBytes(page.jpegBytes);
    pushAscii('\nendstream\nendobj\n');
  }

  const xrefOffset = byteLength;
  pushAscii(`xref\n0 ${totalObjects + 1}\n`);
  pushAscii('0000000000 65535 f \n');
  for (let objId = 1; objId <= totalObjects; objId += 1) {
    const padded = String(offsets[objId]).padStart(10, '0');
    pushAscii(`${padded} 00000 n \n`);
  }

  pushAscii(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\n` +
      `startxref\n${xrefOffset}\n%%EOF\n`
  );

  const output = new Uint8Array(byteLength);
  let cursor = 0;
  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}
