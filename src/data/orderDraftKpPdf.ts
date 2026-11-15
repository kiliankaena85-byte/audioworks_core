import { resolveDeliveryChannelLabel } from './clientCabinetHelpers';
import { INDUSTRY_SOLUTIONS } from './multiPageContentData';
import {
  type OrderCheckoutMode,
  type OrderDraftSnapshot,
} from './orderDraftStore';
import { getStudioFormatDisplayMeta, type OrderFormatId } from './pricingData';
import { getPricingPackageVisualSpec } from './pricingPackageVisuals';
import {
  computeReservationTotalsForSelection,
  formatNumberSpaced,
  formatRubCompact,
} from './radioInventory';
import {
  assembleProductionDocumentSuite,
  type AssembledDocumentSuite,
  createDefaultStudioLegalProfiles,
  type StudioLegalProfilesConfig,
} from './studioDocumentsCore';

export interface DraftKpLineItem {
  index: number;
  code: string;
  title: string;
  details: string;
  durationOrVolume: string;
  turnaround: string;
  amountFormatted: string;
  amountRub: number;
}

export interface DraftCommercialProposalSpec {
  kpNumber: string;
  draftOrderNumber: string;
  issueDateIso: string;
  issueDateRu: string;
  validUntilRu: string;
  checkoutMode: OrderCheckoutMode;
  selectedFormatId: OrderFormatId;
  formatTitle: string;
  spotDurationSec: number;
  turnaroundLabel: string;
  isNegotiable: boolean;
  totalPayableRub: number;
  totalPayableFormatted: string;
  totalInWordsRu: string;
  taxLegalLabel: string;
  paymentTermsLabel: string;
  paymentChannelLabel: string;
  deliveryChannelLabel: string;
  industryTitle: string | null;
  industryComplianceNote: string | null;
  customerDisplayName: string;
  customerInn: string;
  customerKpp: string;
  customerAddress: string;
  customerContact: string;
  studioLegalName: string;
  studioInn: string;
  studioOgrn: string;
  studioAddress: string;
  studioBankSummary: string;
  studioSignatoryLine: string;
  studioContactLine: string;
  briefSummary: string;
  lineItems: readonly DraftKpLineItem[];
  includedDeliverables: readonly string[];
  suggestedFileName: string;
  assembledSuite: AssembledDocumentSuite;
}

function formatDateRu(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function addDaysIso(iso: string, days: number): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Date(d.getTime() + days * 86_400_000).toISOString();
  } catch {
    return iso;
  }
}

function resolveDraftDeliveryDetail(draft: OrderDraftSnapshot): string {
  if (draft.preferredDeliveryChannel === 'messenger') {
    return draft.deliveryMessenger === 'other'
      ? draft.deliveryMessengerOther.trim() || 'Мессенджер'
      : draft.deliveryMessenger;
  }
  if (draft.preferredDeliveryChannel === 'cloud') {
    return draft.deliveryCloud === 'other'
      ? draft.deliveryCloudOther.trim() || 'Облачный диск'
      : draft.deliveryCloud;
  }
  if (draft.preferredDeliveryChannel === 'email') {
    return draft.deliveryEmail.trim() || draft.cabinetEmail.trim() || '';
  }
  return draft.cabinetEmail.trim();
}

/**
 * Формирует полную спецификацию коммерческого предложения (КП) напрямую из текущего
 * черновика заказа (`OrderDraftSnapshot`) до отправки заявки и проведения оплаты.
 */
export function buildCommercialProposalFromDraft(
  draft: OrderDraftSnapshot,
  options?: {
    legalProfiles?: Partial<StudioLegalProfilesConfig> | null;
    nowIso?: string;
  }
): DraftCommercialProposalSpec {
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const dateCompact = nowIso.slice(0, 10).replace(/-/g, '');
  const formatMeta = getStudioFormatDisplayMeta(draft.selectedFormat);
  const visualSpec = getPricingPackageVisualSpec(draft.selectedFormat);

  const isMediaMode =
    draft.mode === 'air_plus_production' &&
    draft.mediaReservation !== null &&
    draft.mediaReservation.stations.length > 0;

  const mediaTotals =
    isMediaMode && draft.mediaReservation
      ? computeReservationTotalsForSelection(
          draft.mediaReservation,
          draft.reservationProdSelection
        )
      : null;

  const effectiveDurationSec = Math.max(
    5,
    Math.min(
      60,
      Math.round(
        (isMediaMode
          ? draft.mediaReservation?.spotDurationSec
          : draft.spotDurationSec) || 20
      )
    )
  );

  const baseBudgetRub = isMediaMode && mediaTotals
    ? mediaTotals.unifiedTotalRub
    : formatMeta.priceRub;

  const draftCodeSuffix = `${effectiveDurationSec}S-${draft.selectedFormat
    .slice(0, 3)
    .toUpperCase()}`;
  const draftOrderNumber =
    draft.confirmedReservation?.orderNumber ||
    `FM-КП-${dateCompact.slice(2)}-${draftCodeSuffix}`;

  const companyOrInnLine =
    draft.companyLine.trim() ||
    [
      draft.companyName.trim(),
      draft.companyInn.trim() ? `ИНН ${draft.companyInn.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

  const resolvedProfiles =
    options?.legalProfiles ?? createDefaultStudioLegalProfiles();

  const assembledSuite = assembleProductionDocumentSuite({
    orderNumber: draftOrderNumber,
    createdAtIso: nowIso,
    formatLabel: isMediaMode && mediaTotals
      ? `Комплексное размещение в радиоэфире + ${mediaTotals.spotStatusLabel}`
      : `${formatMeta.title} (${effectiveDurationSec} сек)`,
    baseBudgetRub,
    defaultDurationSec: effectiveDurationSec,
    contact: draft.contactLine.trim() || 'Контакт уточняется при согласовании',
    companyOrInn: companyOrInnLine,
    briefText:
      draft.briefText.trim() ||
      `Производство рекламного аудиоролика (${formatMeta.title}, хронометраж ${effectiveDurationSec} сек) с очисткой прав РАО/ВОИС и мастерингом −14 LUFS.`,
    legalProfiles: resolvedProfiles,
    documentMeta: {
      ...(draft.resolvedCounterpartyMeta ?? {}),
      spotExactDurationSec: effectiveDurationSec,
      wantsDiadocDuplicate: draft.wantsDiadocDuplicate,
    },
  });

  const industrySpec = draft.industryPreset
    ? INDUSTRY_SOLUTIONS[draft.industryPreset] ?? null
    : null;

  const deliveryDetail = resolveDraftDeliveryDetail(draft);
  const deliveryChannelLabel = resolveDeliveryChannelLabel(
    draft.preferredDeliveryChannel,
    deliveryDetail
  );

  const paymentChannelLabel =
    draft.paymentChannel === 'card_online'
      ? 'Банковская карта / СБП (онлайн-касса 54-ФЗ)'
      : 'Безналичный расчёт по счёту / ЭДО (Диадок / СБИС)';

  const lineItems: DraftKpLineItem[] = [];

  if (isMediaMode && draft.mediaReservation && mediaTotals) {
    draft.mediaReservation.stations.forEach((st, idx) => {
      const dur = st.exactDurationSec ?? effectiveDurationSec;
      lineItems.push({
        index: idx + 1,
        code: `AIR-0${idx + 1}`,
        title: `Размещение на радиостанции «${st.station}» (${st.frequencyFm})`,
        details: `${st.daypart} · ${st.daysPattern} · охват ${formatNumberSpaced(
          st.reachOTS
        )} OTS (скидка −${st.discountPercent}%)`,
        durationOrVolume: `${st.spotsIncluded} вых. × ${dur} сек`,
        turnaround: 'По медиаплану',
        amountFormatted: formatRubCompact(st.hotPrice),
        amountRub: st.hotPrice,
      });
    });

    lineItems.push({
      index: lineItems.length + 1,
      code: 'PROD-01',
      title: `Аудиопродакшн: ${mediaTotals.spotStatusLabel}`,
      details:
        'Студийная запись, сведение −14 LUFS, проверка дисклеймеров ФЗ-38 и паспорт прав РАО/ВОИС',
      durationOrVolume: `${effectiveDurationSec} сек`,
      turnaround: formatMeta.turnaround,
      amountFormatted:
        mediaTotals.productionPriceRub > 0
          ? formatRubCompact(mediaTotals.productionPriceRub)
          : '0 ₽ (бонус квоты)',
      amountRub: mediaTotals.productionPriceRub,
    });
  } else {
    assembledSuite.scope.kpLineItems.forEach((item, idx) => {
      lineItems.push({
        index: idx + 1,
        code: item.code,
        title: item.title,
        details:
          idx === 0
            ? visualSpec.complexity.axes[idx]?.deliverableSummary ??
              assembledSuite.scope.conceptsCountLabel
            : idx === 1
              ? assembledSuite.scope.voiceCastLabel
              : idx === 2
                ? assembledSuite.scope.soundAndMusicLabel
                : 'Официальная справка об авторах, дикторах и лицензионной музыке для радиохолдингов РФ',
        durationOrVolume: `${effectiveDurationSec} сек`,
        turnaround: item.turnaround,
        amountFormatted:
          idx === 0
            ? assembledSuite.isNegotiablePendingPrice
              ? 'Договорная цена'
              : assembledSuite.tax.formattedTotalRub
            : item.priceNote,
        amountRub: idx === 0 ? assembledSuite.effectivePriceRub : 0,
      });
    });
  }

  const includedDeliverables: string[] = [
    `Эфирный мастер-файл WAV (48 кГц / 24 бит и 44.1 кГц / 16 бит, −14 LUFS) + MP3 320 кбит/с (${effectiveDurationSec} сек)`,
    `Паспорт рекламного аудиоролика для РАО / ВОИС и отчуждение исключительных прав в полном объёме (ст. 1234 ГК РФ)`,
    `Предварительный пре-чек текста и возрастной маркировки по Федеральному закону «О рекламе» № 38-ФЗ`,
    `1 сервисный раунд финальной доводки (коррекция баланса/паузы по таймкоду или до 1 замены музыкальной подложки без доплат)`,
  ];

  if (visualSpec.chronometry.includes15sResize) {
    includedDeliverables.push(
      'Короткий эфирный ресайз 15 сек в комплекте для повышения частоты выходов в прайм-тайм'
    );
  }

  const issueDateRu = formatDateRu(nowIso);
  const validUntilRu = formatDateRu(addDaysIso(nowIso, 7));

  const safeSlug = draft.selectedFormat.replace(/[^a-z0-9_-]/gi, '-');
  const suggestedFileName = `FMWorks-KP-${safeSlug}-${effectiveDurationSec}s-${dateCompact}.pdf`;

  return {
    kpNumber: assembledSuite.kpNumber,
    draftOrderNumber,
    issueDateIso: nowIso,
    issueDateRu,
    validUntilRu,
    checkoutMode: isMediaMode ? 'air_plus_production' : 'production_only',
    selectedFormatId: draft.selectedFormat,
    formatTitle: isMediaMode
      ? `Эфирная кампания + ${mediaTotals?.spotStatusLabel ?? formatMeta.title}`
      : formatMeta.title,
    spotDurationSec: effectiveDurationSec,
    turnaroundLabel: formatMeta.turnaround,
    isNegotiable: assembledSuite.isNegotiablePendingPrice,
    totalPayableRub: assembledSuite.effectivePriceRub,
    totalPayableFormatted: assembledSuite.isNegotiablePendingPrice
      ? 'Договорная цена (по оценке ТЗ)'
      : assembledSuite.tax.formattedTotalRub,
    totalInWordsRu: assembledSuite.tax.totalInWordsRu,
    taxLegalLabel: assembledSuite.tax.taxLegalLabel,
    paymentTermsLabel: '100% предоплата по договору или банковской картой',
    paymentChannelLabel,
    deliveryChannelLabel,
    industryTitle: industrySpec?.shortTitle ?? null,
    industryComplianceNote: industrySpec?.legalComplianceRules[0] ?? null,
    customerDisplayName: assembledSuite.customer.displayName,
    customerInn: assembledSuite.customer.inn,
    customerKpp: assembledSuite.customer.kpp,
    customerAddress: assembledSuite.customer.address,
    customerContact:
      draft.contactLine.trim() || 'Не указан (черновик до отправки)',
    studioLegalName: assembledSuite.studio.legalName,
    studioInn: assembledSuite.studio.inn,
    studioOgrn: assembledSuite.studio.ogrnOrOgrnip,
    studioAddress: assembledSuite.studio.legalAddress,
    studioBankSummary: `${assembledSuite.studio.bankName} · Р/с ${assembledSuite.studio.checkingAccount} · БИК ${assembledSuite.studio.bik}`,
    studioSignatoryLine: `${assembledSuite.studio.signatoryRoleTitle} — ${assembledSuite.studio.signatoryShortName}`,
    studioContactLine: `${assembledSuite.studio.phone} · ${assembledSuite.studio.email} · ${assembledSuite.studio.websiteDomain}`,
    briefSummary:
      draft.briefText.trim() ||
      'Задача будет уточнена с продюсером либо передана голосовым сообщением.',
    lineItems,
    includedDeliverables,
    suggestedFileName,
    assembledSuite,
  };
}

/**
 * Кодирует строку в UTF-16BE Hex (`<FEFF...>`) для корректного отображения кириллицы
 * в метаданных и текстовых объектах стандарта PDF 1.4+.
 */
export function encodePdfUtf16BeHex(text: string): string {
  let hex = 'FEFF';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    hex += code.toString(16).toUpperCase().padStart(4, '0');
  }
  return `<${hex}>`;
}

function encodeAsciiBytes(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    out[i] = str.charCodeAt(i) & 0xff;
  }
  return out;
}

function concatUint8Arrays(chunks: readonly Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, arr) => sum + arr.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

/**
 * Собирает валидный бинарный файл PDF 1.4 (`%PDF-1.4 ... %%EOF`),
 * встраивая растровый лист A4 (JPEG) при наличии либо генерируя автономный PDF-лист со структурой КП.
 */
export function buildValidPdfDocumentBytes(
  proposal: DraftCommercialProposalSpec,
  jpegPageData?: {
    jpegBytes: Uint8Array;
    widthPx: number;
    heightPx: number;
  } | null
): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // index 0 is free object
  let currentOffset = 0;

  const pushAscii = (text: string) => {
    const bytes = encodeAsciiBytes(text);
    chunks.push(bytes);
    currentOffset += bytes.byteLength;
  };

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    currentOffset += bytes.byteLength;
  };

  const startObject = (objNum: number) => {
    offsets[objNum] = currentOffset;
    pushAscii(`${objNum} 0 obj\n`);
  };

  const endObject = () => {
    pushAscii(`\nendobj\n`);
  };

  // Заголовок PDF 1.4 с бинарным маркером
  pushAscii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  // 1 0 obj: Catalog
  startObject(1);
  pushAscii('<< /Type /Catalog /Pages 2 0 R >>');
  endObject();

  // 2 0 obj: Pages
  startObject(2);
  pushAscii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  endObject();

  const hasImage = Boolean(jpegPageData && jpegPageData.jpegBytes.byteLength > 0);

  // 3 0 obj: Page (A4 595.28 x 841.89 pt)
  startObject(3);
  if (hasImage) {
    pushAscii(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 5 0 R >> /Font << /F1 6 0 R >> >> /Contents 4 0 R >>'
    );
  } else {
    pushAscii(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>'
    );
  }
  endObject();

  // 4 0 obj: Page Contents stream
  startObject(4);
  if (hasImage) {
    const streamCmd = 'q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';
    pushAscii(`<< /Length ${streamCmd.length} >>\nstream\n${streamCmd}endstream`);
  } else {
    const asciiSummaryLines = [
      `FMWorks Studio - Commercial Proposal (KP)`,
      `Proposal No: ${proposal.kpNumber} (${proposal.draftOrderNumber})`,
      `Issue Date: ${proposal.issueDateIso.slice(0, 10)}`,
      `Format: ${proposal.selectedFormatId} (${proposal.spotDurationSec} sec)`,
      `Total Payable RUB: ${proposal.totalPayableRub} RUB`,
      `Payment Terms: 100% prepayment by contract or bank card`,
      `Studio INN: ${proposal.studioInn} | Customer INN: ${proposal.customerInn || 'N/A'}`,
      `Line Items Count: ${proposal.lineItems.length}`,
    ];
    const contentOps = [
      'q',
      '0.97 0.965 0.95 rg',
      '0 0 595.28 841.89 re f',
      '1 0.282 0.125 rg',
      '36 785 523.28 4 re f',
      '0.07 0.07 0.07 rg',
      'BT',
      '/F1 14 Tf',
      '36 760 Td',
      '18 TL',
      ...asciiSummaryLines.map(
        (line) => `(${line.replace(/[()\\]/g, '')}) Tj T*`
      ),
      'ET',
      'Q',
    ].join('\n');
    pushAscii(`<< /Length ${contentOps.length} >>\nstream\n${contentOps}\nendstream`);
  }
  endObject();

  if (hasImage && jpegPageData) {
    // 5 0 obj: Image XObject (/DCTDecode JPEG)
    startObject(5);
    pushAscii(
      `<< /Type /XObject /Subtype /Image /Width ${jpegPageData.widthPx} /Height ${jpegPageData.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegPageData.jpegBytes.byteLength} >>\nstream\n`
    );
    pushBytes(jpegPageData.jpegBytes);
    pushAscii('\nendstream');
    endObject();

    // 6 0 obj: Font
    startObject(6);
    pushAscii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    endObject();

    // 7 0 obj: Info dictionary with UTF-16BE Cyrillic metadata
    startObject(7);
    pushAscii(
      `<< /Title ${encodePdfUtf16BeHex(
        `Коммерческое предложение № ${proposal.kpNumber} — FMWorks`
      )} /Author ${encodePdfUtf16BeHex(
        proposal.studioLegalName
      )} /Subject ${encodePdfUtf16BeHex(
        `${proposal.formatTitle} · ${proposal.totalPayableFormatted} · ${proposal.paymentTermsLabel}`
      )} /Creator (FMWorks Studio Document Engine) >>`
    );
    endObject();
  } else {
    // 5 0 obj: Font
    startObject(5);
    pushAscii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    endObject();

    // 6 0 obj: Info dictionary with UTF-16BE Cyrillic metadata
    startObject(6);
    pushAscii(
      `<< /Title ${encodePdfUtf16BeHex(
        `Коммерческое предложение № ${proposal.kpNumber} — FMWorks`
      )} /Author ${encodePdfUtf16BeHex(
        proposal.studioLegalName
      )} /Subject ${encodePdfUtf16BeHex(
        `${proposal.formatTitle} · ${proposal.totalPayableFormatted} · ${proposal.paymentTermsLabel}`
      )} /Creator (FMWorks Studio Document Engine) >>`
    );
    endObject();
  }

  const totalObjects = offsets.length;
  const infoObjNum = totalObjects - 1;
  const xrefStartOffset = currentOffset;

  pushAscii(`xref\n0 ${totalObjects}\n`);
  pushAscii(`0000000000 65535 f \n`);
  for (let i = 1; i < totalObjects; i++) {
    const padded = String(offsets[i]).padStart(10, '0');
    pushAscii(`${padded} 00000 n \n`);
  }

  pushAscii(
    `trailer\n<< /Size ${totalObjects} /Root 1 0 R /Info ${infoObjNum} 0 R >>\nstartxref\n${xrefStartOffset}\n%%EOF\n`
  );

  return concatUint8Arrays(chunks);
}

function wrapCanvasParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${currentLine} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0 || typeof atob !== 'function') return null;
  const base64 = dataUrl.slice(commaIdx + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Отрисовывает фирменный бланк Коммерческого предложения A4 на HTML5 Canvas (с полной поддержкой кириллицы)
 * и возвращает JPEG-поток для упаковки в PDF-документ.
 */
function renderProposalA4JpegInBrowser(
  proposal: DraftCommercialProposalSpec
): { jpegBytes: Uint8Array; widthPx: number; heightPx: number } | null {
  if (typeof document === 'undefined') return null;
  try {
    const widthPx = 1240;
    const heightPx = 1754;
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const padX = 76;
    const contentW = widthPx - padX * 2;

    // Фон листа A4
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, widthPx, heightPx);

    // Верхняя фирменная полоса FMWorks (#FF4820)
    ctx.fillStyle = '#FF4820';
    ctx.fillRect(padX, 56, contentW, 8);

    // Шапка: бренд и реквизиты студии
    let y = 108;
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 34px Inter, -apple-system, BlinkMacSystemFont, Arial, sans-serif';
    ctx.fillText('FMWorks® · Аудиопродакшн', padX, y);

    ctx.textAlign = 'right';
    ctx.font = 'bold 20px Inter, Arial, sans-serif';
    ctx.fillStyle = '#FF4820';
    ctx.fillText(`КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ № ${proposal.kpNumber}`, widthPx - padX, y - 6);
    ctx.font = '15px Inter, Arial, sans-serif';
    ctx.fillStyle = '#555555';
    ctx.fillText(
      `от ${proposal.issueDateRu} · Действительно до ${proposal.validUntilRu}`,
      widthPx - padX,
      y + 20
    );
    ctx.textAlign = 'left';

    y += 22;
    ctx.font = '14px Inter, Arial, sans-serif';
    ctx.fillStyle = '#444444';
    ctx.fillText(
      `${proposal.studioLegalName} · ИНН ${proposal.studioInn} · ОГРН/ОГРНИП ${proposal.studioOgrn}`,
      padX,
      y
    );
    y += 22;
    ctx.fillText(`${proposal.studioAddress} · ${proposal.studioContactLine}`, padX, y);

    // Разделитель
    y += 24;
    ctx.fillStyle = '#E5E3DC';
    ctx.fillRect(padX, y, contentW, 2);

    // Блок Заказчика и условий запуска
    y += 28;
    ctx.fillStyle = '#F7F6F2';
    ctx.fillRect(padX, y, contentW, 138);
    ctx.strokeStyle = '#E0DDD5';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(padX, y, contentW, 138);

    let boxY = y + 30;
    ctx.font = 'bold 14px Inter, Arial, sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fillText('ЗАКАЗЧИК / ПОЛУЧАТЕЛЬ КП:', padX + 24, boxY);
    ctx.fillText('УСЛОВИЯ ОПЛАТЫ И СРОКИ:', padX + contentW * 0.52, boxY);

    boxY += 26;
    ctx.font = 'bold 18px Inter, Arial, sans-serif';
    ctx.fillStyle = '#111111';
    ctx.fillText(
      proposal.customerDisplayName.slice(0, 48),
      padX + 24,
      boxY
    );
    ctx.fillText(
      proposal.paymentTermsLabel,
      padX + contentW * 0.52,
      boxY
    );

    boxY += 24;
    ctx.font = '14px Inter, Arial, sans-serif';
    ctx.fillStyle = '#333333';
    ctx.fillText(
      proposal.customerInn
        ? `ИНН ${proposal.customerInn}${proposal.customerKpp ? ` · КПП ${proposal.customerKpp}` : ''}`
        : 'ИНН будет внесён при выставлении счёта (или оплата картой 54-ФЗ)',
      padX + 24,
      boxY
    );
    ctx.fillText(
      `Канал оплаты: ${proposal.paymentChannelLabel.slice(0, 46)}`,
      padX + contentW * 0.52,
      boxY
    );

    boxY += 22;
    ctx.fillText(
      `Контакт: ${proposal.customerContact.slice(0, 46)}`,
      padX + 24,
      boxY
    );
    ctx.fillText(
      `Срок готовности: ${proposal.turnaroundLabel} · Хронометраж: ${proposal.spotDurationSec} сек`,
      padX + contentW * 0.52,
      boxY
    );

    y += 174;

    // Заголовок таблицы спецификации
    ctx.font = 'bold 20px Inter, Arial, sans-serif';
    ctx.fillStyle = '#111111';
    ctx.fillText(
      `1. Спецификация работ и расчёт стоимости (${proposal.formatTitle})`,
      padX,
      y
    );

    y += 18;
    // Шапка таблицы
    ctx.fillStyle = '#141418';
    ctx.fillRect(padX, y, contentW, 42);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px Inter, Arial, sans-serif';
    ctx.fillText('№ / Код', padX + 16, y + 26);
    ctx.fillText('Наименование этапа / состав работ', padX + 115, y + 26);
    ctx.fillText('Объём / Срок', padX + contentW - 310, y + 26);
    ctx.textAlign = 'right';
    ctx.fillText('Стоимость', widthPx - padX - 16, y + 26);
    ctx.textAlign = 'left';

    y += 42;

    // Строки спецификации
    for (const item of proposal.lineItems.slice(0, 6)) {
      ctx.font = '13px Inter, Arial, sans-serif';
      const detailLines = wrapCanvasParagraph(ctx, item.details, contentW - 455).slice(0, 2);
      const rowH = Math.max(66, 44 + detailLines.length * 18);

      ctx.fillStyle = item.index % 2 === 1 ? '#FFFFFF' : '#FAF9F6';
      ctx.fillRect(padX, y, contentW, rowH);
      ctx.strokeStyle = '#E5E3DC';
      ctx.lineWidth = 1;
      ctx.strokeRect(padX, y, contentW, rowH);

      ctx.fillStyle = '#666666';
      ctx.font = 'bold 13px Inter, Arial, sans-serif';
      ctx.fillText(`${item.index}. ${item.code}`, padX + 16, y + 26);

      ctx.fillStyle = '#111111';
      ctx.font = 'bold 15px Inter, Arial, sans-serif';
      ctx.fillText(item.title.slice(0, 56), padX + 115, y + 25);

      ctx.fillStyle = '#555555';
      ctx.font = '13px Inter, Arial, sans-serif';
      detailLines.forEach((dLine, idx) => {
        ctx.fillText(dLine, padX + 115, y + 45 + idx * 17);
      });

      ctx.fillStyle = '#222222';
      ctx.font = '13px Inter, Arial, sans-serif';
      ctx.fillText(
        `${item.durationOrVolume} · ${item.turnaround}`,
        padX + contentW - 310,
        y + 26
      );

      ctx.textAlign = 'right';
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 15px Inter, Arial, sans-serif';
      ctx.fillText(item.amountFormatted, widthPx - padX - 16, y + 26);
      ctx.textAlign = 'left';

      y += rowH;
    }

    // Итоговая плашка стоимости
    y += 14;
    ctx.fillStyle = '#141418';
    ctx.fillRect(padX, y, contentW, 82);

    ctx.fillStyle = '#F4F3EF';
    ctx.font = 'bold 15px Inter, Arial, sans-serif';
    ctx.fillText('ИТОГО К ОПЛАТЕ ПО КОММЕРЧЕСКОМУ ПРЕДЛОЖЕНИЮ:', padX + 24, y + 32);
    ctx.font = '13px Inter, Arial, sans-serif';
    ctx.fillStyle = '#CCCCCC';
    ctx.fillText(
      `${proposal.taxLegalLabel} · ${proposal.totalInWordsRu.slice(0, 75)}`,
      padX + 24,
      y + 58
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = '#FF4820';
    ctx.font = 'bold 28px Inter, Arial, sans-serif';
    ctx.fillText(proposal.totalPayableFormatted, widthPx - padX - 24, y + 48);
    ctx.textAlign = 'left';

    y += 116;

    // Раздел 2: Что входит в комплект сдачи и юридическая чистота
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 18px Inter, Arial, sans-serif';
    ctx.fillText(
      '2. Комплект поставки, вещательный стандарт и очистка прав РАО / ВОИС',
      padX,
      y
    );
    y += 26;

    ctx.font = '14px Inter, Arial, sans-serif';
    ctx.fillStyle = '#222222';
    for (const deliv of proposal.includedDeliverables) {
      const wrapped = wrapCanvasParagraph(ctx, `• ${deliv}`, contentW - 20);
      for (const line of wrapped) {
        ctx.fillText(line, padX + 8, y);
        y += 21;
      }
      y += 4;
    }

    // Раздел 3: Краткое ТЗ / бриф из черновика
    y += 16;
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 18px Inter, Arial, sans-serif';
    ctx.fillText('3. Параметры задачи из черновика заказа', padX, y);
    y += 24;

    ctx.font = '14px Inter, Arial, sans-serif';
    ctx.fillStyle = '#333333';
    const briefWrapped = wrapCanvasParagraph(
      ctx,
      `Задача / бриф: ${proposal.briefSummary}`,
      contentW - 20
    ).slice(0, 3);
    for (const line of briefWrapped) {
      ctx.fillText(line, padX + 8, y);
      y += 20;
    }
    ctx.fillText(
      `Канал выдачи мастер-файлов: ${proposal.deliveryChannelLabel}${
        proposal.industryTitle ? ` · Отрасль: ${proposal.industryTitle}` : ''
      }`,
      padX + 8,
      y + 6
    );

    // Подвал с банковскими реквизитами и подписью
    const footerY = heightPx - 140;
    ctx.fillStyle = '#E5E3DC';
    ctx.fillRect(padX, footerY, contentW, 2);

    ctx.fillStyle = '#444444';
    ctx.font = '13px Inter, Arial, sans-serif';
    ctx.fillText(`Банковские реквизиты Исполнителя: ${proposal.studioBankSummary}`, padX, footerY + 28);
    ctx.fillText(
      `Подписант со стороны студии: ${proposal.studioSignatoryLine}`,
      padX,
      footerY + 52
    );
    ctx.fillStyle = '#FF4820';
    ctx.font = 'bold 13px Inter, Arial, sans-serif';
    ctx.fillText(
      'Срочные заказы (запись голоса и сведение без разработки сценария) выполняются от 1 часа по договорной цене.',
      padX,
      footerY + 80
    );

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const jpegBytes = dataUrlToUint8Array(dataUrl);
    if (!jpegBytes || jpegBytes.byteLength === 0) return null;
    return {
      jpegBytes,
      widthPx,
      heightPx,
    };
  } catch {
    return null;
  }
}

/**
 * Генерирует бинарный PDF-файл (`Uint8Array`, `%PDF-1.4`) из текущего черновика заказа (`OrderDraftSnapshot`).
 */
export function generateCommercialProposalPdfFromDraft(
  draft: OrderDraftSnapshot,
  options?: {
    legalProfiles?: Partial<StudioLegalProfilesConfig> | null;
    nowIso?: string;
  }
): {
  proposal: DraftCommercialProposalSpec;
  pdfBytes: Uint8Array;
  fileName: string;
  mimeType: 'application/pdf';
} {
  const proposal = buildCommercialProposalFromDraft(draft, options);
  const browserJpegPage = renderProposalA4JpegInBrowser(proposal);
  const pdfBytes = buildValidPdfDocumentBytes(proposal, browserJpegPage);

  return {
    proposal,
    pdfBytes,
    fileName: proposal.suggestedFileName,
    mimeType: 'application/pdf',
  };
}

/**
 * Генерирует и инициирует прямое скачивание PDF-файла Коммерческого предложения в браузере клиента.
 */
export function downloadCommercialProposalPdfFromDraft(
  draft: OrderDraftSnapshot,
  options?: {
    legalProfiles?: Partial<StudioLegalProfilesConfig> | null;
    nowIso?: string;
  }
): {
  proposal: DraftCommercialProposalSpec;
  fileName: string;
  byteLength: number;
} {
  const { proposal, pdfBytes, fileName, mimeType } =
    generateCommercialProposalPdfFromDraft(draft, options);

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const safeBuffer = new Uint8Array(pdfBytes.byteLength);
    safeBuffer.set(pdfBytes);
    const blob = new Blob([safeBuffer.buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  return {
    proposal,
    fileName,
    byteLength: pdfBytes.byteLength,
  };
}
