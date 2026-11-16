import {
  buildCanonicalDeliveryDetail,
  resolveDeliveryChannelLabel,
} from './clientCabinetHelpers';
import { INDUSTRY_SOLUTIONS } from './multiPageContentData';
import {
  type OrderCheckoutMode,
  type OrderDraftSnapshot,
} from './orderDraftStore';
import { getStudioFormatDisplayMeta, type OrderFormatId } from './pricingData';
import {
  computeReservationTotalsForSelection,
  formatNumberSpaced,
  formatRubCompact,
} from './radioInventory';
import {
  assembleProductionDocumentSuite,
  type AssembledDocumentSuite,
  createDefaultStudioLegalProfiles,
  type StudioEntityKind,
  type StudioLegalProfilesConfig,
} from './studioDocumentsCore';
import { formatVoiceSelectionSummary } from './voiceCastingCatalog';

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
  selectedVoiceLabel: string | null;
  industryTitle: string | null;
  industryComplianceNote: string | null;
  customerDisplayName: string;
  customerCompanyOrInnLine: string;
  customerInn: string;
  customerKpp: string;
  customerAddress: string;
  customerContact: string;
  studioEntityKind: StudioEntityKind;
  studioLegalName: string;
  studioInn: string;
  studioKpp: string;
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

export interface ProposalLayoutTextDraw {
  kind: 'text';
  id: string;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  measuredWidth: number;
  fontSizePx: number;
  lineHeightPx: number;
  bold: boolean;
  align: 'left' | 'right';
  color: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ProposalLayoutRectDraw {
  kind: 'rect';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface ProposalA4PagePlan {
  pageNumber: number;
  totalPages: number;
  widthPx: number;
  heightPx: number;
  contentBottomLimit: number;
  footerDividerY: number;
  maxContentBottomY: number;
  rects: ProposalLayoutRectDraw[];
  texts: ProposalLayoutTextDraw[];
}

export type TextWidthMeasurer = (
  text: string,
  fontSizePx: number,
  bold: boolean
) => number;

const A4_WIDTH_PX = 1240;
const A4_HEIGHT_PX = 1754;
const A4_PAD_X = 72;
const A4_CONTENT_W = A4_WIDTH_PX - A4_PAD_X * 2; // 1096
const A4_FOOTER_DIVIDER_Y = A4_HEIGHT_PX - 142; // 1612
const A4_CONTENT_BOTTOM_LIMIT = A4_FOOTER_DIVIDER_Y - 24; // 1588
const CANVAS_FONT_STACK =
  "'Golos Text', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

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

function truncateAtWordBoundary(raw: string, maxChars: number): string {
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  if (normalized.length <= maxChars) return normalized;
  const sliced = normalized.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(' ');
  const cut = lastSpace > Math.floor(maxChars * 0.75) ? sliced.slice(0, lastSpace) : sliced;
  return `${cut.replace(/[.,;:\s-]+$/, '')}…`;
}

function resolveDraftDeliveryDetail(draft: OrderDraftSnapshot): string {
  if (
    draft.preferredDeliveryChannel === 'messenger' &&
    draft.deliveryMessenger === 'other' &&
    !draft.deliveryMessengerOther.trim()
  ) {
    return 'other';
  }
  if (
    draft.preferredDeliveryChannel === 'cloud' &&
    draft.deliveryCloud === 'other' &&
    !draft.deliveryCloudOther.trim()
  ) {
    return 'other';
  }
  return buildCanonicalDeliveryDetail({
    channel: draft.preferredDeliveryChannel,
    messenger: draft.deliveryMessenger,
    messengerOther: draft.deliveryMessengerOther,
    cloud: draft.deliveryCloud,
    cloudOther: draft.deliveryCloudOther,
    email: draft.deliveryEmail.trim() || draft.cabinetEmail.trim(),
  });
}

function resolveScopeItemDetails(
  formatId: OrderFormatId,
  itemIndex: number,
  isNegotiable: boolean,
  assembledSuite: AssembledDocumentSuite
): string {
  if (formatId === 'adaptation') {
    return itemIndex === 0
      ? 'Выверка обновлённой редакции текста, монтаж/дозапись диктора и мастеринг −14 LUFS'
      : 'Актуализация сведений об авторах, дикторах и музыкальной лицензии для радиостанций РФ';
  }
  if (isNegotiable) {
    return itemIndex === 0
      ? 'Разбор задачи продюсером, пре-чек требований ФЗ-38 и подготовка персональной сметы'
      : 'Сценарий, подбор дикторов, студийная запись, саунд-дизайн, мастеринг −14 LUFS и паспорт РАО/ВОИС';
  }
  if (itemIndex === 0) {
    return assembledSuite.scope.conceptsCountLabel;
  }
  if (itemIndex === 1) {
    return assembledSuite.scope.voiceCastLabel;
  }
  if (itemIndex === 2 && assembledSuite.scope.kpLineItems.length > 3) {
    return assembledSuite.scope.soundAndMusicLabel;
  }
  return 'Официальная справка об авторах, дикторах и лицензионной музыке для радиохолдингов РФ';
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

  const selectedVoiceLabel = formatVoiceSelectionSummary(draft.selectedVoiceId);

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
      ...(selectedVoiceLabel ? { voiceTalentLine: selectedVoiceLabel } : {}),
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

  const totalPayableRub = Math.round(assembledSuite.tax.totalPayableKopecks / 100);
  const lineItems: DraftKpLineItem[] = [];

  if (isMediaMode && draft.mediaReservation && mediaTotals) {
    draft.mediaReservation.stations.forEach((st, idx) => {
      const dur = st.exactDurationSec ?? effectiveDurationSec;
      lineItems.push({
        index: idx + 1,
        code: `AIR-${String(idx + 1).padStart(2, '0')}`,
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
    const rawItems = assembledSuite.scope.kpLineItems;
    const explicitPricedIdx = rawItems.findIndex(
      (it) => it.priceNote !== 'Включено' && it.priceNote !== 'Бесплатно'
    );
    const targetPricedIdx = explicitPricedIdx >= 0 ? explicitPricedIdx : 0;

    rawItems.forEach((item, idx) => {
      const isMainPricedRow = idx === targetPricedIdx;
      const amountFormatted = isMainPricedRow
        ? assembledSuite.isNegotiablePendingPrice
          ? draft.selectedFormat === 'adaptation'
            ? 'По оценке задачи'
            : 'Договорная цена'
          : assembledSuite.tax.formattedTotalRub
        : item.priceNote;

      lineItems.push({
        index: idx + 1,
        code: item.code,
        title: item.title,
        details: resolveScopeItemDetails(
          draft.selectedFormat,
          idx,
          assembledSuite.isNegotiablePendingPrice,
          assembledSuite
        ),
        durationOrVolume: `${effectiveDurationSec} сек`,
        turnaround: item.turnaround,
        amountFormatted,
        amountRub:
          isMainPricedRow && !assembledSuite.isNegotiablePendingPrice
            ? totalPayableRub
            : 0,
      });
    });
  }

  const includedDeliverables: string[] = [
    `Эфирный мастер-файл WAV (48 кГц / 24 бит и 44.1 кГц / 16 бит, −14 LUFS) + MP3 320 кбит/с (${effectiveDurationSec} сек)`,
    `Паспорт рекламного аудиоролика для РАО / ВОИС и отчуждение исключительных прав в полном объёме (ст. 1234 ГК РФ)`,
    `Предварительный пре-чек текста и возрастной маркировки по Федеральному закону «О рекламе» № 38-ФЗ`,
    `1 сервисный раунд финальной доводки (коррекция баланса/паузы по таймкоду или до 1 замены музыкальной подложки без доплат)`,
  ];

  if (selectedVoiceLabel) {
    includedDeliverables.unshift(
      `Запись выбранного актёрского тембра из базы студии: ${selectedVoiceLabel}`
    );
  }

  if (draft.selectedFormat === 'cinema') {
    includedDeliverables.push(
      effectiveDurationSec > 15
        ? 'Короткий эфирный ресайз 15 сек в комплекте для повышения частоты выходов в прайм-тайм'
        : 'Короткий эфирный блиц-ресайз (5–10 сек) в комплекте для повышения частоты выходов в прайм-тайм'
    );
  }

  const issueDateRu = formatDateRu(nowIso);
  const validUntilRu = formatDateRu(addDaysIso(nowIso, 7));

  const safeSlug = draft.selectedFormat.replace(/[^a-z0-9_-]/gi, '-');
  const suggestedFileName = `FMWorks-KP-${safeSlug}-${effectiveDurationSec}s-${dateCompact}.pdf`;

  const totalInWordsOrNote = assembledSuite.isNegotiablePendingPrice
    ? 'Финальная стоимость фиксируется в Приложении № 1 после согласования ТЗ с продюсером'
    : assembledSuite.tax.totalInWordsRu;

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
    totalPayableRub: assembledSuite.isNegotiablePendingPrice ? 0 : totalPayableRub,
    totalPayableFormatted: assembledSuite.isNegotiablePendingPrice
      ? draft.selectedFormat === 'adaptation'
        ? 'По оценке задачи'
        : 'Договорная цена (по оценке ТЗ)'
      : assembledSuite.tax.formattedTotalRub,
    totalInWordsRu: totalInWordsOrNote,
    taxLegalLabel: assembledSuite.tax.taxLegalLabel,
    paymentTermsLabel: '100% предоплата по договору или банковской картой',
    paymentChannelLabel,
    deliveryChannelLabel,
    selectedVoiceLabel,
    industryTitle: industrySpec?.shortTitle ?? null,
    industryComplianceNote: industrySpec?.legalComplianceRules[0] ?? null,
    customerDisplayName: assembledSuite.customer.displayName,
    customerCompanyOrInnLine: companyOrInnLine,
    customerInn: assembledSuite.customer.inn,
    customerKpp: assembledSuite.customer.kpp,
    customerAddress: assembledSuite.customer.address,
    customerContact:
      draft.contactLine.trim() || 'Не указан (черновик до отправки)',
    studioEntityKind: assembledSuite.studio.entityKind,
    studioLegalName: assembledSuite.studio.legalName,
    studioInn: assembledSuite.studio.inn,
    studioKpp: assembledSuite.studio.kpp,
    studioOgrn: assembledSuite.studio.ogrnOrOgrnip,
    studioAddress: assembledSuite.studio.legalAddress,
    studioBankSummary: `${assembledSuite.studio.bankName} · Р/с ${assembledSuite.studio.checkingAccount} · К/с ${assembledSuite.studio.correspondentAccount} · БИК ${assembledSuite.studio.bik}`,
    studioSignatoryLine: `${assembledSuite.studio.signatoryRoleTitle} — ${assembledSuite.studio.signatoryShortName}`,
    studioContactLine: `${assembledSuite.studio.phone} · ${assembledSuite.studio.email} · ${assembledSuite.studio.websiteDomain}`,
    briefSummary: draft.briefText.trim()
      ? truncateAtWordBoundary(draft.briefText, 1400)
      : 'Задача будет уточнена с продюсером либо передана голосовым сообщением.',
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

export interface EmbeddedJpegPageData {
  jpegBytes: Uint8Array;
  widthPx: number;
  heightPx: number;
}

/**
 * Собирает валидный бинарный файл PDF 1.4 (`%PDF-1.4 ... %%EOF`),
 * поддерживая как одиночный лист, так и многостраничный массив растровых листов A4 (JPEG),
 * либо генерируя автономный PDF-лист со структурой КП в безбраузерной среде.
 */
export function buildValidPdfDocumentBytes(
  proposal: DraftCommercialProposalSpec,
  jpegPagesOrSingle?:
    | EmbeddedJpegPageData
    | readonly EmbeddedJpegPageData[]
    | null
): Uint8Array {
  const pagesList: EmbeddedJpegPageData[] = Array.isArray(jpegPagesOrSingle)
    ? jpegPagesOrSingle.filter((p) => p && p.jpegBytes.byteLength > 0)
    : jpegPagesOrSingle &&
        !Array.isArray(jpegPagesOrSingle) &&
        (jpegPagesOrSingle as EmbeddedJpegPageData).jpegBytes.byteLength > 0
      ? [jpegPagesOrSingle as EmbeddedJpegPageData]
      : [];

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

  if (pagesList.length > 0) {
    // Для каждой страницы выделяем 3 объекта: Page, Contents, Image XObject
    // После всех страниц: Font объект и Info объект
    const firstPageObj = 3;
    const pageObjNums = pagesList.map((_, idx) => firstPageObj + idx * 3);
    const fontObjNum = firstPageObj + pagesList.length * 3;
    const infoObjNum = fontObjNum + 1;

    // 2 0 obj: Pages
    startObject(2);
    const kidsRefs = pageObjNums.map((n) => `${n} 0 R`).join(' ');
    pushAscii(`<< /Type /Pages /Kids [${kidsRefs}] /Count ${pagesList.length} >>`);
    endObject();

    pagesList.forEach((pageImg, idx) => {
      const pageObj = firstPageObj + idx * 3;
      const contentObj = pageObj + 1;
      const imgObj = pageObj + 2;
      const imName = `/Im${idx}`;

      startObject(pageObj);
      pushAscii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << ${imName} ${imgObj} 0 R >> /Font << /F1 ${fontObjNum} 0 R >> >> /Contents ${contentObj} 0 R >>`
      );
      endObject();

      const streamCmd = `q\n595.28 0 0 841.89 0 0 cm\n${imName} Do\nQ\n`;
      startObject(contentObj);
      pushAscii(`<< /Length ${streamCmd.length} >>\nstream\n${streamCmd}endstream`);
      endObject();

      startObject(imgObj);
      pushAscii(
        `<< /Type /XObject /Subtype /Image /Width ${pageImg.widthPx} /Height ${pageImg.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pageImg.jpegBytes.byteLength} >>\nstream\n`
      );
      pushBytes(pageImg.jpegBytes);
      pushAscii('\nendstream');
      endObject();
    });

    startObject(fontObjNum);
    pushAscii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    endObject();

    startObject(infoObjNum);
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
    // Fallback векторный одностраничный PDF (Node / SSR без Canvas)
    startObject(2);
    pushAscii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    endObject();

    startObject(3);
    pushAscii(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>'
    );
    endObject();

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

    startObject(4);
    pushAscii(`<< /Length ${contentOps.length} >>\nstream\n${contentOps}\nendstream`);
    endObject();

    startObject(5);
    pushAscii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    endObject();

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

/**
 * Реалистичная калиброванная оценка ширины кириллического/латинского текста для unit-тестов без DOM Canvas.
 */
export function estimateTextWidthFallback(
  text: string,
  fontSizePx: number,
  bold: boolean
): number {
  let units = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === ' ') units += 0.29;
    else if ('.,:;!|·\'"`()[]{}'.includes(ch)) units += 0.3;
    else if ('шщмжюфыШЩМЖЮФЫ@%№MW'.includes(ch)) units += 0.84;
    else if (ch >= 'А' && ch <= 'Я') units += 0.68;
    else if (ch >= 'A' && ch <= 'Z') units += 0.66;
    else if (ch >= '0' && ch <= '9') units += 0.57;
    else units += 0.56;
  }
  return units * fontSizePx * (bold ? 1.06 : 1.0);
}

/**
 * Склеивает неразрывным пробелом (\u00A0) короткие русские предлоги/союзы, знак №,
 * сокращения (ст., гл., п., г.) и единицы измерения (сек, ч, ₽, %), чтобы исключить
 * висячие предлоги и оторванный знак «№» на правом краю строки.
 */
export function applyRussianTypographicGlue(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/(№)\s+/g, '$1\u00A0')
    .replace(/\b(ст\.|гл\.|п\.|д\.|оф\.|помещ\.)\s+/gi, '$1\u00A0')
    .replace(/(^|[ \n«(])(в|к|с|у|о|и|а|по|на|за|из|до|от|об|не|со|во|ни)\s+/gi, '$1$2\u00A0')
    .replace(/(\d)\s+(сек|мин|ч|дн\.|раб\.|вых\.|₽|%|г\.)/g, '$1\u00A0$2')
    .replace(/(раб\.)\s+(ч|дн\.|дня|дней)/g, '$1\u00A0$2');
}

/**
 * Переносит многострочный текст по ширине `maxWidth` без обрезки на полуслове,
 * сохраняя неразрывные пробелы (`\u00A0`), а сверхдлинные токены разбивает посимвольно.
 */
export function wrapMeasuredTextLines(
  text: string,
  maxWidth: number,
  fontSizePx: number,
  bold: boolean,
  measureWidth: TextWidthMeasurer = estimateTextWidthFallback
): string[] {
  const safeMaxW = Math.max(40, maxWidth);
  const glued = applyRussianTypographicGlue(text || '');
  const rawParagraphs = glued.replace(/\r\n/g, '\n').split('\n');
  const allLines: string[] = [];

  const breakLongToken = (token: string): string[] => {
    if (measureWidth(token, fontSizePx, bold) <= safeMaxW) return [token];
    // Сначала пробуем мягко разбить по неразрывным пробелам, если склеенная группа шире колонки
    if (token.includes('\u00A0')) {
      const subParts = token.split('\u00A0').filter(Boolean);
      if (subParts.length > 1) {
        return subParts.flatMap((sp) => breakLongToken(sp));
      }
    }
    const parts: string[] = [];
    let chunk = '';
    for (const ch of token) {
      const next = chunk + ch;
      if (chunk.length > 0 && measureWidth(next, fontSizePx, bold) > safeMaxW) {
        parts.push(chunk);
        chunk = ch;
      } else {
        chunk = next;
      }
    }
    if (chunk) parts.push(chunk);
    return parts;
  };

  for (const para of rawParagraphs) {
    const rawWords = para.split(/[ \t]+/).filter(Boolean);
    if (rawWords.length === 0) continue;

    const normalizedTokens: string[] = [];
    for (const w of rawWords) {
      normalizedTokens.push(...breakLongToken(w));
    }

    let currentLine = normalizedTokens[0];
    for (let i = 1; i < normalizedTokens.length; i++) {
      const candidate = `${currentLine} ${normalizedTokens[i]}`;
      if (measureWidth(candidate, fontSizePx, bold) <= safeMaxW) {
        currentLine = candidate;
      } else {
        allLines.push(currentLine);
        currentLine = normalizedTokens[i];
      }
    }
    allLines.push(currentLine);
  }

  return allLines.length > 0 ? allLines : [''];
}

/**
 * Строит детерминированный геометрический план всех листов A4 Коммерческого предложения:
 * исключает любые горизонтальные и вертикальные наложения, обрезку на полуслове и наезд на подвал,
 * автоматически перенося избыточные строки на 2-ю и последующие страницы A4.
 */
export function computeProposalA4Layout(
  proposal: DraftCommercialProposalSpec,
  measureWidth: TextWidthMeasurer = estimateTextWidthFallback
): ProposalA4PagePlan[] {
  const pages: ProposalA4PagePlan[] = [];

  const createBlankPage = (pageNum: number): ProposalA4PagePlan => {
    const page: ProposalA4PagePlan = {
      pageNumber: pageNum,
      totalPages: 1,
      widthPx: A4_WIDTH_PX,
      heightPx: A4_HEIGHT_PX,
      contentBottomLimit: A4_CONTENT_BOTTOM_LIMIT,
      footerDividerY: A4_FOOTER_DIVIDER_Y,
      maxContentBottomY: 0,
      rects: [
        {
          kind: 'rect',
          id: `p${pageNum}-paper-bg`,
          x: 0,
          y: 0,
          width: A4_WIDTH_PX,
          height: A4_HEIGHT_PX,
          fillColor: '#FFFFFF',
        },
        {
          kind: 'rect',
          id: `p${pageNum}-brand-top-bar`,
          x: A4_PAD_X,
          y: 48,
          width: A4_CONTENT_W,
          height: 7,
          fillColor: '#FF4820',
        },
      ],
      texts: [],
    };
    pages.push(page);
    return page;
  };

  const addTextLine = (
    page: ProposalA4PagePlan,
    params: {
      id: string;
      text: string;
      x: number;
      topY: number;
      maxWidth: number;
      fontSizePx: number;
      lineHeightPx: number;
      bold?: boolean;
      align?: 'left' | 'right';
      color: string;
      trackContentBottom?: boolean;
    }
  ) => {
    const bold = Boolean(params.bold);
    const align = params.align ?? 'left';
    const measuredW = Math.min(
      params.maxWidth,
      Math.ceil(measureWidth(params.text, params.fontSizePx, bold))
    );
    const bboxX = align === 'right' ? params.x - measuredW : params.x;
    const baselineY = Math.round(params.topY + params.fontSizePx * 0.84);
    const draw: ProposalLayoutTextDraw = {
      kind: 'text',
      id: params.id,
      text: params.text,
      x: params.x,
      y: baselineY,
      maxWidth: params.maxWidth,
      measuredWidth: measuredW,
      fontSizePx: params.fontSizePx,
      lineHeightPx: params.lineHeightPx,
      bold,
      align,
      color: params.color,
      bbox: {
        x: bboxX,
        y: params.topY,
        width: measuredW,
        height: params.lineHeightPx,
      },
    };
    page.texts.push(draw);
    if (params.trackContentBottom !== false) {
      page.maxContentBottomY = Math.max(
        page.maxContentBottomY,
        params.topY + params.lineHeightPx
      );
    }
  };

  const addWrappedLines = (
    page: ProposalA4PagePlan,
    params: {
      idPrefix: string;
      lines: readonly string[];
      x: number;
      startTopY: number;
      maxWidth: number;
      fontSizePx: number;
      lineHeightPx: number;
      bold?: boolean;
      align?: 'left' | 'right';
      color: string;
      trackContentBottom?: boolean;
    }
  ): number => {
    let curY = params.startTopY;
    params.lines.forEach((line, idx) => {
      addTextLine(page, {
        id: `${params.idPrefix}-${idx}`,
        text: line,
        x: params.x,
        topY: curY,
        maxWidth: params.maxWidth,
        fontSizePx: params.fontSizePx,
        lineHeightPx: params.lineHeightPx,
        bold: params.bold,
        align: params.align,
        color: params.color,
        trackContentBottom: params.trackContentBottom,
      });
      curY += params.lineHeightPx;
    });
    return curY;
  };

  const drawRunningHeaderOnContinuationPage = (page: ProposalA4PagePlan): number => {
    addTextLine(page, {
      id: `p${page.pageNumber}-running-left`,
      text: 'FMWorks® · Аудиопродакшн',
      x: A4_PAD_X,
      topY: 70,
      maxWidth: 480,
      fontSizePx: 16,
      lineHeightPx: 22,
      bold: true,
      color: '#111111',
    });
    addTextLine(page, {
      id: `p${page.pageNumber}-running-right`,
      text: `Коммерческое предложение № ${proposal.kpNumber} (продолжение)`,
      x: A4_WIDTH_PX - A4_PAD_X,
      topY: 72,
      maxWidth: 560,
      fontSizePx: 14,
      lineHeightPx: 20,
      bold: true,
      align: 'right',
      color: '#D93814',
    });
    page.rects.push({
      kind: 'rect',
      id: `p${page.pageNumber}-running-divider`,
      x: A4_PAD_X,
      y: 102,
      width: A4_CONTENT_W,
      height: 1.5,
      fillColor: '#E5E2DC',
    });
    return 122;
  };

  let currentPage = createBlankPage(1);
  let y = 72;

  // === ШАПКА СТРАНИЦЫ 1: строгая двухколоночная сетка с гарантированным коридором 36px ===
  const headerLeftX = A4_PAD_X; // 72
  const headerLeftW = 608; // 72..680
  const headerRightEdgeX = A4_WIDTH_PX - A4_PAD_X; // 1168
  const headerRightW = 452; // 716..1168 (коридор 680..716 = 36px)

  const ogrnLabel = proposal.studioEntityKind === 'ip' ? 'ОГРНИП' : 'ОГРН';
  const kppPart =
    proposal.studioEntityKind === 'ooo' && proposal.studioKpp
      ? ` · КПП ${proposal.studioKpp}`
      : '';

  let leftHeaderY = y;
  const brandLines = wrapMeasuredTextLines(
    'FMWorks® · Аудиопродакшн',
    headerLeftW,
    31,
    true,
    measureWidth
  );
  leftHeaderY = addWrappedLines(currentPage, {
    idPrefix: 'header-brand',
    lines: brandLines,
    x: headerLeftX,
    startTopY: leftHeaderY,
    maxWidth: headerLeftW,
    fontSizePx: 31,
    lineHeightPx: 38,
    bold: true,
    color: '#111111',
  });
  leftHeaderY += 6;

  const studioLegalLines = wrapMeasuredTextLines(
    `${proposal.studioLegalName}\nИНН ${proposal.studioInn}${kppPart} · ${ogrnLabel} ${proposal.studioOgrn}`,
    headerLeftW,
    13.5,
    false,
    measureWidth
  );
  leftHeaderY = addWrappedLines(currentPage, {
    idPrefix: 'header-studio-legal',
    lines: studioLegalLines,
    x: headerLeftX,
    startTopY: leftHeaderY,
    maxWidth: headerLeftW,
    fontSizePx: 13.5,
    lineHeightPx: 19,
    color: '#3A3834',
  });
  leftHeaderY += 2;

  const studioAddrLines = wrapMeasuredTextLines(
    `${proposal.studioAddress} · ${proposal.studioContactLine}`,
    headerLeftW,
    13,
    false,
    measureWidth
  );
  leftHeaderY = addWrappedLines(currentPage, {
    idPrefix: 'header-studio-contact',
    lines: studioAddrLines,
    x: headerLeftX,
    startTopY: leftHeaderY,
    maxWidth: headerLeftW,
    fontSizePx: 13,
    lineHeightPx: 18,
    color: '#57534E',
  });

  let rightHeaderY = y + 2;
  const kpTitleLines = wrapMeasuredTextLines(
    `КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ\n№\u00A0${proposal.kpNumber}`,
    headerRightW,
    18.5,
    true,
    measureWidth
  );
  rightHeaderY = addWrappedLines(currentPage, {
    idPrefix: 'header-kp-title',
    lines: kpTitleLines,
    x: headerRightEdgeX,
    startTopY: rightHeaderY,
    maxWidth: headerRightW,
    fontSizePx: 18.5,
    lineHeightPx: 24,
    bold: true,
    align: 'right',
    color: '#D93814',
  });
  rightHeaderY += 6;

  const kpMetaLines = wrapMeasuredTextLines(
    `Дата выпуска: ${proposal.issueDateRu}\nДействительно до: ${proposal.validUntilRu}\nКод проекта: ${proposal.draftOrderNumber}`,
    headerRightW,
    13.5,
    false,
    measureWidth
  );
  rightHeaderY = addWrappedLines(currentPage, {
    idPrefix: 'header-kp-meta',
    lines: kpMetaLines,
    x: headerRightEdgeX,
    startTopY: rightHeaderY,
    maxWidth: headerRightW,
    fontSizePx: 13.5,
    lineHeightPx: 19,
    align: 'right',
    color: '#4A4843',
  });

  y = Math.max(leftHeaderY, rightHeaderY) + 18;
  currentPage.rects.push({
    kind: 'rect',
    id: 'header-divider',
    x: A4_PAD_X,
    y,
    width: A4_CONTENT_W,
    height: 1.5,
    fillColor: '#E5E2DC',
  });
  y += 22;

  // === КАРТОЧКА ЗАКАЗЧИКА И УСЛОВИЙ ОПЛАТЫ (динамическая высота без обрезки строк) ===
  const cardPadX = 24;
  const cardPadY = 20;
  const cardColW = 504;
  const cardLeftX = A4_PAD_X + cardPadX; // 96..600
  const cardDividerX = A4_PAD_X + A4_CONTENT_W / 2; // 620
  const cardRightX = cardDividerX + 20; // 640..1144

  const customerNameLines = wrapMeasuredTextLines(
    proposal.customerDisplayName,
    cardColW,
    17,
    true,
    measureWidth
  );
  const customerReqText = proposal.customerInn
    ? `ИНН ${proposal.customerInn}${proposal.customerKpp ? ` · КПП ${proposal.customerKpp}` : ''}${
        proposal.customerAddress ? ` · ${proposal.customerAddress}` : ''
      }`
    : 'ИНН будет внесён при выставлении счёта (или оплата картой 54-ФЗ)';
  const customerReqLines = wrapMeasuredTextLines(
    customerReqText,
    cardColW,
    13.5,
    false,
    measureWidth
  );
  const customerContactLines = wrapMeasuredTextLines(
    `Контакт: ${proposal.customerContact}`,
    cardColW,
    13.5,
    false,
    measureWidth
  );

  const payTermsLines = wrapMeasuredTextLines(
    proposal.paymentTermsLabel,
    cardColW,
    17,
    true,
    measureWidth
  );
  const payChannelLines = wrapMeasuredTextLines(
    `Канал оплаты: ${proposal.paymentChannelLabel}`,
    cardColW,
    13.5,
    false,
    measureWidth
  );
  const turnaroundLines = wrapMeasuredTextLines(
    `Срок готовности: ${proposal.turnaroundLabel} · Хронометраж: ${proposal.spotDurationSec} сек`,
    cardColW,
    13.5,
    false,
    measureWidth
  );

  const leftCardContentH =
    18 +
    6 +
    customerNameLines.length * 22 +
    6 +
    customerReqLines.length * 19 +
    4 +
    customerContactLines.length * 19;
  const rightCardContentH =
    18 +
    6 +
    payTermsLines.length * 22 +
    6 +
    payChannelLines.length * 19 +
    4 +
    turnaroundLines.length * 19;
  const cardH = Math.max(leftCardContentH, rightCardContentH) + cardPadY * 2;

  currentPage.rects.push({
    kind: 'rect',
    id: 'customer-terms-card',
    x: A4_PAD_X,
    y,
    width: A4_CONTENT_W,
    height: cardH,
    fillColor: '#F7F6F2',
    strokeColor: '#DFDCD4',
    strokeWidth: 1.5,
  });
  currentPage.rects.push({
    kind: 'rect',
    id: 'customer-terms-mid-divider',
    x: cardDividerX,
    y: y + 16,
    width: 1,
    height: cardH - 32,
    fillColor: '#E2DFD7',
  });

  let cLeftY = y + cardPadY;
  addTextLine(currentPage, {
    id: 'card-customer-kicker',
    text: 'ЗАКАЗЧИК / ПОЛУЧАТЕЛЬ КП:',
    x: cardLeftX,
    topY: cLeftY,
    maxWidth: cardColW,
    fontSizePx: 12,
    lineHeightPx: 18,
    bold: true,
    color: '#66625B',
  });
  cLeftY += 24;
  cLeftY = addWrappedLines(currentPage, {
    idPrefix: 'card-customer-name',
    lines: customerNameLines,
    x: cardLeftX,
    startTopY: cLeftY,
    maxWidth: cardColW,
    fontSizePx: 17,
    lineHeightPx: 22,
    bold: true,
    color: '#111111',
  });
  cLeftY += 6;
  cLeftY = addWrappedLines(currentPage, {
    idPrefix: 'card-customer-req',
    lines: customerReqLines,
    x: cardLeftX,
    startTopY: cLeftY,
    maxWidth: cardColW,
    fontSizePx: 13.5,
    lineHeightPx: 19,
    color: '#333333',
  });
  cLeftY += 4;
  addWrappedLines(currentPage, {
    idPrefix: 'card-customer-contact',
    lines: customerContactLines,
    x: cardLeftX,
    startTopY: cLeftY,
    maxWidth: cardColW,
    fontSizePx: 13.5,
    lineHeightPx: 19,
    color: '#333333',
  });

  let cRightY = y + cardPadY;
  addTextLine(currentPage, {
    id: 'card-pay-kicker',
    text: 'УСЛОВИЯ ОПЛАТЫ И СРОКИ:',
    x: cardRightX,
    topY: cRightY,
    maxWidth: cardColW,
    fontSizePx: 12,
    lineHeightPx: 18,
    bold: true,
    color: '#66625B',
  });
  cRightY += 24;
  cRightY = addWrappedLines(currentPage, {
    idPrefix: 'card-pay-terms',
    lines: payTermsLines,
    x: cardRightX,
    startTopY: cRightY,
    maxWidth: cardColW,
    fontSizePx: 17,
    lineHeightPx: 22,
    bold: true,
    color: '#111111',
  });
  cRightY += 6;
  cRightY = addWrappedLines(currentPage, {
    idPrefix: 'card-pay-channel',
    lines: payChannelLines,
    x: cardRightX,
    startTopY: cRightY,
    maxWidth: cardColW,
    fontSizePx: 13.5,
    lineHeightPx: 19,
    color: '#333333',
  });
  cRightY += 4;
  addWrappedLines(currentPage, {
    idPrefix: 'card-turnaround',
    lines: turnaroundLines,
    x: cardRightX,
    startTopY: cRightY,
    maxWidth: cardColW,
    fontSizePx: 13.5,
    lineHeightPx: 19,
    color: '#333333',
  });

  currentPage.maxContentBottomY = Math.max(currentPage.maxContentBottomY, y + cardH);
  y += cardH + 26;

  // === РАЗДЕЛ 1: ТАБЛИЦА СПЕЦИФИКАЦИИ (4 непересекающиеся колонки с переносом строк) ===
  const col1X = A4_PAD_X + 16; // 88..164 (w=76)
  const col1W = 76;
  const colDiv1X = A4_PAD_X + 102; // 174
  const col2X = A4_PAD_X + 116; // 188..710 (w=522)
  const col2W = 522;
  const colDiv2X = A4_PAD_X + 652; // 724
  const col3X = A4_PAD_X + 666; // 738..930 (w=192)
  const col3W = 192;
  const colDiv3X = A4_PAD_X + 872; // 944
  const col4RightX = A4_WIDTH_PX - A4_PAD_X - 16; // 1152 (958..1152, w=194)
  const col4W = 194;

  const drawTableHeader = (page: ProposalA4PagePlan, topY: number, suffixId: string): number => {
    const headerH = 40;
    page.rects.push({
      kind: 'rect',
      id: `table-head-${suffixId}`,
      x: A4_PAD_X,
      y: topY,
      width: A4_CONTENT_W,
      height: headerH,
      fillColor: '#141418',
    });
    const textTopY = topY + 11;
    addTextLine(page, {
      id: `th-code-${suffixId}`,
      text: 'Код',
      x: col1X,
      topY: textTopY,
      maxWidth: col1W,
      fontSizePx: 12.5,
      lineHeightPx: 18,
      bold: true,
      color: '#FFFFFF',
    });
    addTextLine(page, {
      id: `th-title-${suffixId}`,
      text: 'Наименование этапа и состав работ',
      x: col2X,
      topY: textTopY,
      maxWidth: col2W,
      fontSizePx: 12.5,
      lineHeightPx: 18,
      bold: true,
      color: '#FFFFFF',
    });
    addTextLine(page, {
      id: `th-vol-${suffixId}`,
      text: 'Объём / Срок',
      x: col3X,
      topY: textTopY,
      maxWidth: col3W,
      fontSizePx: 12.5,
      lineHeightPx: 18,
      bold: true,
      color: '#FFFFFF',
    });
    addTextLine(page, {
      id: `th-price-${suffixId}`,
      text: 'Стоимость',
      x: col4RightX,
      topY: textTopY,
      maxWidth: col4W,
      fontSizePx: 12.5,
      lineHeightPx: 18,
      bold: true,
      align: 'right',
      color: '#FFFFFF',
    });
    page.maxContentBottomY = Math.max(page.maxContentBottomY, topY + headerH);
    return topY + headerH;
  };

  const sec1HeadingLines = wrapMeasuredTextLines(
    `1. Спецификация работ и расчёт стоимости (${proposal.formatTitle})`,
    A4_CONTENT_W,
    19,
    true,
    measureWidth
  );
  y = addWrappedLines(currentPage, {
    idPrefix: 'sec1-heading',
    lines: sec1HeadingLines,
    x: A4_PAD_X,
    startTopY: y,
    maxWidth: A4_CONTENT_W,
    fontSizePx: 19,
    lineHeightPx: 25,
    bold: true,
    color: '#111111',
  });
  y += 10;
  y = drawTableHeader(currentPage, y, 'p1');

  for (const item of proposal.lineItems) {
    const cleanCodeLabel = /^\d+$/.test(item.code.trim())
      ? item.code.trim()
      : item.code;
    const codeLines = wrapMeasuredTextLines(
      cleanCodeLabel,
      col1W,
      12.5,
      true,
      measureWidth
    );
    const titleLines = wrapMeasuredTextLines(
      item.title,
      col2W,
      14.5,
      true,
      measureWidth
    );
    const detailLines = wrapMeasuredTextLines(
      item.details,
      col2W,
      12.5,
      false,
      measureWidth
    );
    const volLines = wrapMeasuredTextLines(
      item.durationOrVolume,
      col3W,
      13,
      true,
      measureWidth
    );
    const turnLines = wrapMeasuredTextLines(
      item.turnaround,
      col3W,
      12.5,
      false,
      measureWidth
    );
    const priceLines = wrapMeasuredTextLines(
      item.amountFormatted,
      col4W,
      14,
      true,
      measureWidth
    );

    const rowPadY = 14;
    const col1H = codeLines.length * 18;
    const col2H = titleLines.length * 20 + 5 + detailLines.length * 17;
    const col3H = volLines.length * 18 + 3 + turnLines.length * 17;
    const col4H = priceLines.length * 20;
    const rowH = Math.max(58, Math.max(col1H, col2H, col3H, col4H) + rowPadY * 2);

    if (y + rowH > A4_CONTENT_BOTTOM_LIMIT) {
      currentPage = createBlankPage(pages.length + 1);
      y = drawRunningHeaderOnContinuationPage(currentPage);
      y = drawTableHeader(currentPage, y, `p${currentPage.pageNumber}`);
    }

    currentPage.rects.push({
      kind: 'rect',
      id: `row-bg-${item.index}`,
      x: A4_PAD_X,
      y,
      width: A4_CONTENT_W,
      height: rowH,
      fillColor: item.index % 2 === 1 ? '#FFFFFF' : '#FAF9F6',
      strokeColor: '#E5E2DC',
      strokeWidth: 1,
    });

    for (const [divIdx, divX] of [colDiv1X, colDiv2X, colDiv3X].entries()) {
      currentPage.rects.push({
        kind: 'rect',
        id: `row-${item.index}-vdiv-${divIdx}`,
        x: divX,
        y,
        width: 1,
        height: rowH,
        fillColor: '#ECE9E2',
      });
    }

    addWrappedLines(currentPage, {
      idPrefix: `row-${item.index}-code`,
      lines: codeLines,
      x: col1X,
      startTopY: y + rowPadY + 1,
      maxWidth: col1W,
      fontSizePx: 12.5,
      lineHeightPx: 18,
      bold: true,
      color: '#5C5852',
    });

    const afterTitleY = addWrappedLines(currentPage, {
      idPrefix: `row-${item.index}-title`,
      lines: titleLines,
      x: col2X,
      startTopY: y + rowPadY,
      maxWidth: col2W,
      fontSizePx: 14.5,
      lineHeightPx: 20,
      bold: true,
      color: '#111111',
    });

    addWrappedLines(currentPage, {
      idPrefix: `row-${item.index}-details`,
      lines: detailLines,
      x: col2X,
      startTopY: afterTitleY + 5,
      maxWidth: col2W,
      fontSizePx: 12.5,
      lineHeightPx: 17,
      color: '#55524D',
    });

    const afterVolY = addWrappedLines(currentPage, {
      idPrefix: `row-${item.index}-vol`,
      lines: volLines,
      x: col3X,
      startTopY: y + rowPadY + 1,
      maxWidth: col3W,
      fontSizePx: 13,
      lineHeightPx: 18,
      bold: true,
      color: '#1C1B19',
    });

    addWrappedLines(currentPage, {
      idPrefix: `row-${item.index}-turn`,
      lines: turnLines,
      x: col3X,
      startTopY: afterVolY + 3,
      maxWidth: col3W,
      fontSizePx: 12.5,
      lineHeightPx: 17,
      color: '#55524D',
    });

    const isAccentPrice =
      item.amountFormatted.includes('Договорная') ||
      item.amountFormatted.includes('По оценке');
    addWrappedLines(currentPage, {
      idPrefix: `row-${item.index}-price`,
      lines: priceLines,
      x: col4RightX,
      startTopY: y + rowPadY,
      maxWidth: col4W,
      fontSizePx: 14,
      lineHeightPx: 20,
      bold: true,
      align: 'right',
      color: isAccentPrice ? '#B82D0D' : '#111111',
    });

    currentPage.maxContentBottomY = Math.max(currentPage.maxContentBottomY, y + rowH);
    y += rowH;
  }

  // === ИТОГОВАЯ ПЛАШКА СТОИМОСТИ (строго разведённые левая и правая колонки) ===
  y += 14;
  const totalsPadX = 24;
  const totalsPadY = 18;
  const totalsLeftX = A4_PAD_X + totalsPadX; // 96..726 (w=630)
  const totalsLeftW = 630;
  const totalsRightX = A4_WIDTH_PX - A4_PAD_X - totalsPadX; // 1144 (764..1144, w=380; коридор 38px)
  const totalsRightW = 380;

  const totalKickerText = proposal.isNegotiable
    ? 'ИТОГО ПО КОММЕРЧЕСКОМУ ПРЕДЛОЖЕНИЮ (ПРЕДВАРИТЕЛЬНАЯ ОЦЕНКА):'
    : 'ИТОГО К ОПЛАТЕ ПО КОММЕРЧЕСКОМУ ПРЕДЛОЖЕНИЮ:';
  const totalKickerLines = wrapMeasuredTextLines(
    totalKickerText,
    totalsLeftW,
    14,
    true,
    measureWidth
  );
  const totalTaxLines = wrapMeasuredTextLines(
    proposal.taxLegalLabel,
    totalsLeftW,
    12.5,
    false,
    measureWidth
  );
  const totalWordsLabel = proposal.isNegotiable
    ? proposal.totalInWordsRu
    : `Сумма прописью: ${proposal.totalInWordsRu}`;
  const totalWordsLines = wrapMeasuredTextLines(
    totalWordsLabel,
    totalsLeftW,
    12.5,
    false,
    measureWidth
  );

  const rightPrimaryAmountText = proposal.isNegotiable
    ? proposal.selectedFormatId === 'adaptation'
      ? 'По оценке задачи'
      : 'Договорная цена'
    : proposal.totalPayableFormatted;
  const rightSecondaryNoteText =
    proposal.isNegotiable && proposal.selectedFormatId !== 'adaptation'
      ? 'расчёт по ТЗ продюсером'
      : '';

  const rightPriceFontPx =
    proposal.isNegotiable || rightPrimaryAmountText.length > 16 ? 24 : 28;
  const rightPriceLineH = rightPriceFontPx === 24 ? 30 : 34;
  const rightPriceLines = wrapMeasuredTextLines(
    rightPrimaryAmountText,
    totalsRightW,
    rightPriceFontPx,
    true,
    measureWidth
  );
  const rightSubLines = rightSecondaryNoteText
    ? wrapMeasuredTextLines(rightSecondaryNoteText, totalsRightW, 12.5, false, measureWidth)
    : [];

  const leftTotalsH =
    totalKickerLines.length * 20 +
    5 +
    totalTaxLines.length * 18 +
    3 +
    totalWordsLines.length * 18;
  const rightTotalsH =
    rightPriceLines.length * rightPriceLineH +
    (rightSubLines.length > 0 ? 3 + rightSubLines.length * 17 : 0);
  const totalsBoxH = Math.max(leftTotalsH, rightTotalsH) + totalsPadY * 2;

  if (y + totalsBoxH > A4_CONTENT_BOTTOM_LIMIT) {
    currentPage = createBlankPage(pages.length + 1);
    y = drawRunningHeaderOnContinuationPage(currentPage);
  }

  currentPage.rects.push({
    kind: 'rect',
    id: 'totals-bar-bg',
    x: A4_PAD_X,
    y,
    width: A4_CONTENT_W,
    height: totalsBoxH,
    fillColor: '#141418',
  });

  let tLeftY = y + totalsPadY;
  tLeftY = addWrappedLines(currentPage, {
    idPrefix: 'totals-kicker',
    lines: totalKickerLines,
    x: totalsLeftX,
    startTopY: tLeftY,
    maxWidth: totalsLeftW,
    fontSizePx: 14,
    lineHeightPx: 20,
    bold: true,
    color: '#F4F3EF',
  });
  tLeftY += 5;
  tLeftY = addWrappedLines(currentPage, {
    idPrefix: 'totals-tax',
    lines: totalTaxLines,
    x: totalsLeftX,
    startTopY: tLeftY,
    maxWidth: totalsLeftW,
    fontSizePx: 12.5,
    lineHeightPx: 18,
    color: '#CCC9C0',
  });
  tLeftY += 3;
  addWrappedLines(currentPage, {
    idPrefix: 'totals-words',
    lines: totalWordsLines,
    x: totalsLeftX,
    startTopY: tLeftY,
    maxWidth: totalsLeftW,
    fontSizePx: 12.5,
    lineHeightPx: 18,
    color: '#E8E5DC',
  });

  let rightCurY = Math.round(y + (totalsBoxH - rightTotalsH) / 2);
  rightCurY = addWrappedLines(currentPage, {
    idPrefix: 'totals-amount',
    lines: rightPriceLines,
    x: totalsRightX,
    startTopY: rightCurY,
    maxWidth: totalsRightW,
    fontSizePx: rightPriceFontPx,
    lineHeightPx: rightPriceLineH,
    bold: true,
    align: 'right',
    color: '#FF4820',
  });
  if (rightSubLines.length > 0) {
    addWrappedLines(currentPage, {
      idPrefix: 'totals-amount-sub',
      lines: rightSubLines,
      x: totalsRightX,
      startTopY: rightCurY + 3,
      maxWidth: totalsRightW,
      fontSizePx: 12.5,
      lineHeightPx: 17,
      align: 'right',
      color: '#CCC9C0',
    });
  }

  currentPage.maxContentBottomY = Math.max(currentPage.maxContentBottomY, y + totalsBoxH);
  y += totalsBoxH + 26;

  // === РАЗДЕЛ 2: КОМПЛЕКТ ПОСТАВКИ И ОЧИСТКА ПРАВ ===
  const sec2HeadingLines = wrapMeasuredTextLines(
    '2. Комплект поставки, вещательный стандарт и очистка прав РАО / ВОИС',
    A4_CONTENT_W,
    18,
    true,
    measureWidth
  );
  const firstDelivLines =
    proposal.includedDeliverables.length > 0
      ? wrapMeasuredTextLines(
          proposal.includedDeliverables[0],
          A4_CONTENT_W - 28,
          13.5,
          false,
          measureWidth
        )
      : [];
  const sec2MinKeepTogetherH =
    sec2HeadingLines.length * 24 + 8 + firstDelivLines.length * 20;

  if (y + sec2MinKeepTogetherH > A4_CONTENT_BOTTOM_LIMIT) {
    currentPage = createBlankPage(pages.length + 1);
    y = drawRunningHeaderOnContinuationPage(currentPage);
  }

  y = addWrappedLines(currentPage, {
    idPrefix: 'sec2-heading',
    lines: sec2HeadingLines,
    x: A4_PAD_X,
    startTopY: y,
    maxWidth: A4_CONTENT_W,
    fontSizePx: 18,
    lineHeightPx: 24,
    bold: true,
    color: '#111111',
  });
  y += 8;

  proposal.includedDeliverables.forEach((deliv, dIdx) => {
    const bulletLines = wrapMeasuredTextLines(
      deliv,
      A4_CONTENT_W - 28,
      13.5,
      false,
      measureWidth
    );
    const itemH = bulletLines.length * 20 + 4;
    if (y + itemH > A4_CONTENT_BOTTOM_LIMIT) {
      currentPage = createBlankPage(pages.length + 1);
      y = drawRunningHeaderOnContinuationPage(currentPage);
    }
    addTextLine(currentPage, {
      id: `sec2-bullet-dot-${dIdx}`,
      text: '•',
      x: A4_PAD_X + 6,
      topY: y,
      maxWidth: 16,
      fontSizePx: 13.5,
      lineHeightPx: 20,
      bold: true,
      color: '#D93814',
    });
    y = addWrappedLines(currentPage, {
      idPrefix: `sec2-bullet-text-${dIdx}`,
      lines: bulletLines,
      x: A4_PAD_X + 24,
      startTopY: y,
      maxWidth: A4_CONTENT_W - 28,
      fontSizePx: 13.5,
      lineHeightPx: 20,
      color: '#222222',
    });
    y += 4;
  });

  // === РАЗДЕЛ 3: ПАРАМЕТРЫ ЗАДАЧИ ИЗ ЧЕРНОВИКА ЗАКАЗА ===
  y += 14;
  const sec3HeadingLines = wrapMeasuredTextLines(
    '3. Параметры задачи из черновика заказа',
    A4_CONTENT_W,
    18,
    true,
    measureWidth
  );
  const briefLines = wrapMeasuredTextLines(
    `Задача / бриф: ${proposal.briefSummary}`,
    A4_CONTENT_W - 16,
    13.5,
    false,
    measureWidth
  );
  const deliveryLineText = `Канал выдачи мастер-файлов: ${proposal.deliveryChannelLabel}${
    proposal.industryTitle ? ` · Отрасль: ${proposal.industryTitle}` : ''
  }`;
  const deliveryLines = wrapMeasuredTextLines(
    deliveryLineText,
    A4_CONTENT_W - 16,
    13.5,
    false,
    measureWidth
  );
  const complianceLines = proposal.industryComplianceNote
    ? wrapMeasuredTextLines(
        `Правовая памятка ФЗ-38: ${proposal.industryComplianceNote}`,
        A4_CONTENT_W - 16,
        12.5,
        false,
        measureWidth
      )
    : [];

  // Удерживаем заголовок Раздела 3 минимум с первой строкой брифа
  if (y + sec3HeadingLines.length * 24 + 8 + 20 > A4_CONTENT_BOTTOM_LIMIT) {
    currentPage = createBlankPage(pages.length + 1);
    y = drawRunningHeaderOnContinuationPage(currentPage);
  }

  y = addWrappedLines(currentPage, {
    idPrefix: 'sec3-heading',
    lines: sec3HeadingLines,
    x: A4_PAD_X,
    startTopY: y,
    maxWidth: A4_CONTENT_W,
    fontSizePx: 18,
    lineHeightPx: 24,
    bold: true,
    color: '#111111',
  });
  y += 8;

  briefLines.forEach((bLine, bIdx) => {
    if (y + 20 > A4_CONTENT_BOTTOM_LIMIT) {
      currentPage = createBlankPage(pages.length + 1);
      y = drawRunningHeaderOnContinuationPage(currentPage);
    }
    addTextLine(currentPage, {
      id: `sec3-brief-${bIdx}`,
      text: bLine,
      x: A4_PAD_X + 8,
      topY: y,
      maxWidth: A4_CONTENT_W - 16,
      fontSizePx: 13.5,
      lineHeightPx: 20,
      color: '#2B2A27',
    });
    y += 20;
  });

  y += 6;
  if (y + deliveryLines.length * 20 > A4_CONTENT_BOTTOM_LIMIT) {
    currentPage = createBlankPage(pages.length + 1);
    y = drawRunningHeaderOnContinuationPage(currentPage);
  }
  y = addWrappedLines(currentPage, {
    idPrefix: 'sec3-delivery',
    lines: deliveryLines,
    x: A4_PAD_X + 8,
    startTopY: y,
    maxWidth: A4_CONTENT_W - 16,
    fontSizePx: 13.5,
    lineHeightPx: 20,
    color: '#2B2A27',
  });

  if (complianceLines.length > 0) {
    y += 4;
    if (y + complianceLines.length * 18 > A4_CONTENT_BOTTOM_LIMIT) {
      currentPage = createBlankPage(pages.length + 1);
      y = drawRunningHeaderOnContinuationPage(currentPage);
    }
    addWrappedLines(currentPage, {
      idPrefix: 'sec3-compliance',
      lines: complianceLines,
      x: A4_PAD_X + 8,
      startTopY: y,
      maxWidth: A4_CONTENT_W - 16,
      fontSizePx: 12.5,
      lineHeightPx: 18,
      color: '#57534E',
    });
  }

  // === ФИНАЛИЗАЦИЯ ПОДВАЛОВ НА ВСЕХ СТРАНИЦАХ ===
  const totalPages = pages.length;
  pages.forEach((page, idx) => {
    page.totalPages = totalPages;
    page.rects.push({
      kind: 'rect',
      id: `p${page.pageNumber}-footer-divider`,
      x: A4_PAD_X,
      y: A4_FOOTER_DIVIDER_Y,
      width: A4_CONTENT_W,
      height: 1.5,
      fillColor: '#E5E2DC',
    });

    let fY = A4_FOOTER_DIVIDER_Y + 14;
    const bankLines = wrapMeasuredTextLines(
      `Банковские реквизиты Исполнителя: ${proposal.studioBankSummary}`,
      A4_CONTENT_W,
      12.5,
      false,
      measureWidth
    ).slice(0, 2);
    fY = addWrappedLines(page, {
      idPrefix: `p${page.pageNumber}-footer-bank`,
      lines: bankLines,
      x: A4_PAD_X,
      startTopY: fY,
      maxWidth: A4_CONTENT_W,
      fontSizePx: 12.5,
      lineHeightPx: 18,
      color: '#44423E',
      trackContentBottom: false,
    });

    fY += 3;
    const signMaxW = 880;
    const signLines = wrapMeasuredTextLines(
      `Подписант со стороны студии: ${proposal.studioSignatoryLine}`,
      signMaxW,
      12.5,
      false,
      measureWidth
    ).slice(0, 1);
    addWrappedLines(page, {
      idPrefix: `p${page.pageNumber}-footer-sign`,
      lines: signLines,
      x: A4_PAD_X,
      startTopY: fY,
      maxWidth: signMaxW,
      fontSizePx: 12.5,
      lineHeightPx: 18,
      color: '#44423E',
      trackContentBottom: false,
    });

    addTextLine(page, {
      id: `p${page.pageNumber}-footer-pagenum`,
      text: `Стр. ${idx + 1} из ${totalPages}`,
      x: A4_WIDTH_PX - A4_PAD_X,
      topY: fY,
      maxWidth: 180,
      fontSizePx: 12.5,
      lineHeightPx: 18,
      align: 'right',
      color: '#66625B',
      trackContentBottom: false,
    });

    fY += 22;
    const urgentLines = wrapMeasuredTextLines(
      'Срочные заказы (запись голоса и сведение без разработки сценария) выполняются от 1 часа по договорной цене.',
      A4_CONTENT_W,
      12.5,
      true,
      measureWidth
    ).slice(0, 2);
    addWrappedLines(page, {
      idPrefix: `p${page.pageNumber}-footer-urgent`,
      lines: urgentLines,
      x: A4_PAD_X,
      startTopY: fY,
      maxWidth: A4_CONTENT_W,
      fontSizePx: 12.5,
      lineHeightPx: 18,
      bold: true,
      color: '#C83210',
      trackContentBottom: false,
    });
  });

  return pages;
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
 * Отрисовывает 1..N листов A4 Коммерческого предложения на HTML5 Canvas в браузере,
 * используя точные метрики шрифта `ctx.measureText` для исключения любых наложений.
 */
export function renderProposalA4CanvasesInBrowser(
  proposal: DraftCommercialProposalSpec
): { canvases: HTMLCanvasElement[]; plans: ProposalA4PagePlan[] } | null {
  if (typeof document === 'undefined') return null;
  try {
    const measureCanvas = document.createElement('canvas');
    measureCanvas.width = 16;
    measureCanvas.height = 16;
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) return null;

    const browserMeasurer: TextWidthMeasurer = (text, fontSizePx, bold) => {
      measureCtx.font = `${bold ? '700' : '400'} ${fontSizePx}px ${CANVAS_FONT_STACK}`;
      return measureCtx.measureText(text).width;
    };

    const plans = computeProposalA4Layout(proposal, browserMeasurer);
    const canvases: HTMLCanvasElement[] = [];

    for (const plan of plans) {
      const canvas = document.createElement('canvas');
      canvas.width = plan.widthPx;
      canvas.height = plan.heightPx;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      for (const rect of plan.rects) {
        if (rect.fillColor) {
          ctx.fillStyle = rect.fillColor;
          ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        }
        if (rect.strokeColor && rect.strokeWidth) {
          ctx.strokeStyle = rect.strokeColor;
          ctx.lineWidth = rect.strokeWidth;
          ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        }
      }

      for (const txt of plan.texts) {
        ctx.font = `${txt.bold ? '700' : '400'} ${txt.fontSizePx}px ${CANVAS_FONT_STACK}`;
        ctx.fillStyle = txt.color;
        ctx.textAlign = txt.align;
        ctx.fillText(txt.text, txt.x, txt.y);
      }
      ctx.textAlign = 'left';
      canvases.push(canvas);
    }

    return { canvases, plans };
  } catch {
    return null;
  }
}

function renderProposalA4JpegPagesInBrowser(
  proposal: DraftCommercialProposalSpec
): EmbeddedJpegPageData[] | null {
  const rendered = renderProposalA4CanvasesInBrowser(proposal);
  if (!rendered || rendered.canvases.length === 0) return null;

  const out: EmbeddedJpegPageData[] = [];
  for (const canvas of rendered.canvases) {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.93);
    const jpegBytes = dataUrlToUint8Array(dataUrl);
    if (!jpegBytes || jpegBytes.byteLength === 0) return null;
    out.push({
      jpegBytes,
      widthPx: canvas.width,
      heightPx: canvas.height,
    });
  }
  return out;
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
  const browserJpegPages = renderProposalA4JpegPagesInBrowser(proposal);
  const pdfBytes = buildValidPdfDocumentBytes(proposal, browserJpegPages);

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
