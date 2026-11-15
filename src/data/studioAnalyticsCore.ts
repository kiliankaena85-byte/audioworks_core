import {
  type CrmOrderRecord,
  type CrmOrderStage,
  ensureOrderStageHistory,
} from './orderCrmTypes.ts';
import {
  formatIsoToUtcPlus3Ymd,
  getCrmStageOrderIndex,
  ORDERED_CRM_STAGE_IDS,
} from './orderStageHistory.ts';

export type AnalyticsPeriodMonths = 6 | 12;
export type AnalyticsSegmentFilter =
  | 'all'
  | 'production_only'
  | 'air_plus_production';
export type AnalyticsDataScope = 'crm_plus_archive' | 'live_crm_only';

export interface StudioAnalyticsQuery {
  periodMonths: AnalyticsPeriodMonths;
  segment: AnalyticsSegmentFilter;
  scope: AnalyticsDataScope;
}

export interface AnalyticsTooltipOrderDigest {
  orderNumber: string;
  clientLabel: string;
  stageId: CrmOrderStage;
  stageShortLabel: string;
  checkoutMode: 'production_only' | 'air_plus_production';
  budgetRub: number;
  formatSummary: string;
  responseMin: number;
  metSla: boolean;
  firstTakeClean: boolean;
  dwellHours?: number;
  isActiveOnStage?: boolean;
  origin: 'live_crm' | 'archive_edo';
}

export interface MonthlyConversionPoint {
  monthKey: string;
  monthLabel: string;
  monthFullLabel: string;
  totalOrders: number;
  convertedOrders: number;
  deliveredOrders: number;
  conversionPct: number;
  conversionDeltaPp: number | null;
  revenueRub: number;
  revenueThousandsRub: number;
  avgOrderValueRub: number;
  slaCompliancePct: number;
  slaMetOrders: number;
  slaDeltaVsTargetPp: number;
  avgFirstResponseMin: number;
  minFirstResponseMin: number;
  maxFirstResponseMin: number;
  firstTakeApprovalPct: number;
  firstTakeApprovedOrders: number;
  liveCrmOrdersCount: number;
  topOrders: AnalyticsTooltipOrderDigest[];
  slaSpotlightOrder: AnalyticsTooltipOrderDigest | null;
}

export interface StageEfficiencyPoint {
  stageId: CrmOrderStage;
  stepCode: string;
  stageLabel: string;
  avgDurationHours: number;
  maxDurationHours: number;
  shareOfCyclePct: number;
  transitionsCount: number;
  activeOrdersCount: number;
  isBottleneck: boolean;
  stageOrders: AnalyticsTooltipOrderDigest[];
}

export interface StudioAnalyticsSummary {
  months: MonthlyConversionPoint[];
  stageEfficiency: StageEfficiencyPoint[];
  totals: {
    totalOrders: number;
    convertedOrders: number;
    deliveredOrders: number;
    overallConversionPct: number;
    confirmedRevenueRub: number;
    avgOrderValueRub: number;
    slaCompliancePct: number;
    avgFirstResponseMin: number;
    firstTakeApprovalPct: number;
    avgProductionCycleHours: number;
  };
}

const MONTH_SHORT_RU: readonly string[] = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
];

const MONTH_FULL_RU: readonly string[] = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const STAGE_EFFICIENCY_LABELS: Readonly<
  Record<CrmOrderStage, { stepCode: string; label: string; shortLabel: string }>
> = {
  new_hold: {
    stepCode: '01',
    label: '01. Приём и сверка заявки',
    shortLabel: '01. Приём заявки',
  },
  quota_locked: {
    stepCode: '02',
    label: '02. Подтверждение ТЗ и квоты',
    shortLabel: '02. ТЗ и квота',
  },
  edo_invoice: {
    stepCode: '03',
    label: '03. Договор-счёт и оплата',
    shortLabel: '03. Счёт ЭДО',
  },
  in_production: {
    stepCode: '04',
    label: '04. Сценарии и запись ролика',
    shortLabel: '04. Продакшн',
  },
  on_air: {
    stepCode: '05',
    label: '05. Сдача мастера и эфир',
    shortLabel: '05. Сдача и эфир',
  },
  completed_ltv: {
    stepCode: '06',
    label: '06. Закрытие актов ЭДО',
    shortLabel: '06. Акты закрыты',
  },
};

interface ArchiveFeaturedDealSpec {
  orderNumber: string;
  clientLabel: string;
  checkoutMode: 'production_only' | 'air_plus_production';
  budgetRub: number;
  formatSummary: string;
  responseMin: number;
}

interface HistoricalArchiveBucket {
  /** Смещение в месяцах назад относительно текущего месяца (0 — текущий месяц, 1 — прошлый и т.д.) */
  monthsAgo: number;
  prodInquiries: number;
  prodConverted: number;
  prodDelivered: number;
  prodRevenueRub: number;
  airInquiries: number;
  airConverted: number;
  airDelivered: number;
  airRevenueRub: number;
  slaMetCount: number;
  responseMinSum: number;
  minResponseMin: number;
  maxResponseMin: number;
  firstTakeMetCount: number;
  featuredDeals: readonly ArchiveFeaturedDealSpec[];
}

/**
 * Архивная сводка закрытых периодов студии за последние 12 месяцев (используется в режиме crm_plus_archive
 * совместно с живыми сделками из оперативного реестра CRM).
 */
const HISTORICAL_MONTHLY_BUCKETS: readonly HistoricalArchiveBucket[] = [
  {
    monthsAgo: 11,
    prodInquiries: 9,
    prodConverted: 6,
    prodDelivered: 6,
    prodRevenueRub: 165_000,
    airInquiries: 3,
    airConverted: 2,
    airDelivered: 2,
    airRevenueRub: 490_000,
    slaMetCount: 11,
    responseMinSum: 138,
    minResponseMin: 6,
    maxResponseMin: 19,
    firstTakeMetCount: 7,
    featuredDeals: [
      {
        orderNumber: 'FM-2104',
        clientLabel: 'ГК «СеверАвто Логистика»',
        checkoutMode: 'air_plus_production',
        budgetRub: 285_000,
        formatSummary: 'Эфирный пакет + ролик 20 сек',
        responseMin: 9,
      },
      {
        orderNumber: 'FM-2119',
        clientLabel: 'ООО «АгроТехСнаб»',
        checkoutMode: 'production_only',
        budgetRub: 35_000,
        formatSummary: 'Игровой аудиоролик 25 сек',
        responseMin: 11,
      },
    ],
  },
  {
    monthsAgo: 10,
    prodInquiries: 8,
    prodConverted: 5,
    prodDelivered: 5,
    prodRevenueRub: 140_000,
    airInquiries: 2,
    airConverted: 1,
    airDelivered: 1,
    airRevenueRub: 265_000,
    slaMetCount: 9,
    responseMinSum: 124,
    minResponseMin: 7,
    maxResponseMin: 21,
    firstTakeMetCount: 5,
    featuredDeals: [
      {
        orderNumber: 'FM-2182',
        clientLabel: 'ООО «ПромЛизинг Регион»',
        checkoutMode: 'air_plus_production',
        budgetRub: 265_000,
        formatSummary: 'Деловой прайм + ролик 15 сек',
        responseMin: 10,
      },
      {
        orderNumber: 'FM-2195',
        clientLabel: 'Сеть клиник «МедПрофиль»',
        checkoutMode: 'production_only',
        budgetRub: 35_000,
        formatSummary: 'Ролик 20 сек с проверкой ФЗ-38',
        responseMin: 12,
      },
    ],
  },
  {
    monthsAgo: 9,
    prodInquiries: 10,
    prodConverted: 7,
    prodDelivered: 7,
    prodRevenueRub: 195_000,
    airInquiries: 3,
    airConverted: 2,
    airDelivered: 2,
    airRevenueRub: 520_000,
    slaMetCount: 12,
    responseMinSum: 143,
    minResponseMin: 5,
    maxResponseMin: 18,
    firstTakeMetCount: 8,
    featuredDeals: [
      {
        orderNumber: 'FM-2240',
        clientLabel: 'АО «СтройИнвест Девелопмент»',
        checkoutMode: 'air_plus_production',
        budgetRub: 310_000,
        formatSummary: 'Утренний драйв + ролик 20 сек',
        responseMin: 8,
      },
      {
        orderNumber: 'FM-2258',
        clientLabel: 'ООО «ТехноПарк Инжиниринг»',
        checkoutMode: 'production_only',
        budgetRub: 35_000,
        formatSummary: 'Двухголосый ролик 25 сек',
        responseMin: 11,
      },
    ],
  },
  {
    monthsAgo: 8,
    prodInquiries: 11,
    prodConverted: 8,
    prodDelivered: 8,
    prodRevenueRub: 225_000,
    airInquiries: 4,
    airConverted: 2,
    airDelivered: 2,
    airRevenueRub: 560_000,
    slaMetCount: 14,
    responseMinSum: 158,
    minResponseMin: 5,
    maxResponseMin: 17,
    firstTakeMetCount: 9,
    featuredDeals: [
      {
        orderNumber: 'FM-2291',
        clientLabel: 'ГК «Магистраль Трак»',
        checkoutMode: 'air_plus_production',
        budgetRub: 320_000,
        formatSummary: 'Федеральный пул + ролик 15 сек',
        responseMin: 7,
      },
      {
        orderNumber: 'FM-2314',
        clientLabel: 'ООО «ФармСинтез Ритейл»',
        checkoutMode: 'production_only',
        budgetRub: 35_000,
        formatSummary: 'Серия из 2 роликов по 15 сек',
        responseMin: 9,
      },
    ],
  },
  {
    monthsAgo: 7,
    prodInquiries: 10,
    prodConverted: 7,
    prodDelivered: 7,
    prodRevenueRub: 190_000,
    airInquiries: 3,
    airConverted: 2,
    airDelivered: 2,
    airRevenueRub: 475_000,
    slaMetCount: 12,
    responseMinSum: 136,
    minResponseMin: 6,
    maxResponseMin: 18,
    firstTakeMetCount: 8,
    featuredDeals: [
      {
        orderNumber: 'FM-2367',
        clientLabel: 'ООО «ЕвроДом Квартал»',
        checkoutMode: 'air_plus_production',
        budgetRub: 275_000,
        formatSummary: 'Вечерний прайм + ролик 20 сек',
        responseMin: 8,
      },
      {
        orderNumber: 'FM-2381',
        clientLabel: 'АО «ЭнергоСбыт Комплект»',
        checkoutMode: 'production_only',
        budgetRub: 25_000,
        formatSummary: 'Продакшн под ключ 20 сек',
        responseMin: 10,
      },
    ],
  },
  {
    monthsAgo: 6,
    prodInquiries: 11,
    prodConverted: 8,
    prodDelivered: 8,
    prodRevenueRub: 230_000,
    airInquiries: 3,
    airConverted: 2,
    airDelivered: 2,
    airRevenueRub: 510_000,
    slaMetCount: 13,
    responseMinSum: 142,
    minResponseMin: 5,
    maxResponseMin: 17,
    firstTakeMetCount: 9,
    featuredDeals: [
      {
        orderNumber: 'FM-2442',
        clientLabel: 'ГК «СпецТехника Альянс»',
        checkoutMode: 'air_plus_production',
        budgetRub: 295_000,
        formatSummary: 'Деловые станции + ролик 20 сек',
        responseMin: 8,
      },
      {
        orderNumber: 'FM-2459',
        clientLabel: 'ООО «Клиника Здоровье Плюс»',
        checkoutMode: 'production_only',
        budgetRub: 35_000,
        formatSummary: 'Игровой ролик 25 сек с паспортом',
        responseMin: 10,
      },
    ],
  },
  {
    monthsAgo: 5,
    prodInquiries: 9,
    prodConverted: 6,
    prodDelivered: 6,
    prodRevenueRub: 175_000,
    airInquiries: 3,
    airConverted: 2,
    airDelivered: 2,
    airRevenueRub: 460_000,
    slaMetCount: 11,
    responseMinSum: 126,
    minResponseMin: 6,
    maxResponseMin: 18,
    firstTakeMetCount: 7,
    featuredDeals: [
      {
        orderNumber: 'FM-2510',
        clientLabel: 'ООО «Вектор Недвижимость»',
        checkoutMode: 'air_plus_production',
        budgetRub: 260_000,
        formatSummary: 'Утренний прайм + ролик 15 сек',
        responseMin: 9,
      },
      {
        orderNumber: 'FM-2527',
        clientLabel: 'АО «ХолодМаш Сервис»',
        checkoutMode: 'production_only',
        budgetRub: 35_000,
        formatSummary: 'Дикторский ролик 30 сек',
        responseMin: 11,
      },
    ],
  },
  {
    monthsAgo: 4,
    prodInquiries: 10,
    prodConverted: 7,
    prodDelivered: 7,
    prodRevenueRub: 205_000,
    airInquiries: 3,
    airConverted: 2,
    airDelivered: 2,
    airRevenueRub: 505_000,
    slaMetCount: 12,
    responseMinSum: 130,
    minResponseMin: 5,
    maxResponseMin: 17,
    firstTakeMetCount: 8,
    featuredDeals: [
      {
        orderNumber: 'FM-2588',
        clientLabel: 'ГК «АвтоХолдинг Премиум»',
        checkoutMode: 'air_plus_production',
        budgetRub: 290_000,
        formatSummary: 'Пакет 32 выхода + ролик 15 сек',
        responseMin: 7,
      },
      {
        orderNumber: 'FM-2603',
        clientLabel: 'ООО «Стоматология Практик»',
        checkoutMode: 'production_only',
        budgetRub: 35_000,
        formatSummary: 'Аудиоролик 20 сек под ключ',
        responseMin: 10,
      },
    ],
  },
  {
    monthsAgo: 3,
    prodInquiries: 12,
    prodConverted: 9,
    prodDelivered: 9,
    prodRevenueRub: 260_000,
    airInquiries: 4,
    airConverted: 3,
    airDelivered: 3,
    airRevenueRub: 740_000,
    slaMetCount: 15,
    responseMinSum: 152,
    minResponseMin: 5,
    maxResponseMin: 16,
    firstTakeMetCount: 11,
    featuredDeals: [
      {
        orderNumber: 'FM-2664',
        clientLabel: 'АО «РегионКарго Экспресс»',
        checkoutMode: 'air_plus_production',
        budgetRub: 340_000,
        formatSummary: 'Драйв-тайм + ролик 20 сек',
        responseMin: 8,
      },
      {
        orderNumber: 'FM-2689',
        clientLabel: 'ООО «ФинГарант Консалт»',
        checkoutMode: 'production_only',
        budgetRub: 35_000,
        formatSummary: 'Игровой спот 25 сек (−14 LUFS)',
        responseMin: 9,
      },
    ],
  },
  {
    monthsAgo: 2,
    prodInquiries: 13,
    prodConverted: 10,
    prodDelivered: 10,
    prodRevenueRub: 295_000,
    airInquiries: 4,
    airConverted: 3,
    airDelivered: 3,
    airRevenueRub: 790_000,
    slaMetCount: 16,
    responseMinSum: 156,
    minResponseMin: 4,
    maxResponseMin: 16,
    firstTakeMetCount: 11,
    featuredDeals: [
      {
        orderNumber: 'FM-2740',
        clientLabel: 'ГК «Горизонт Девелопмент»',
        checkoutMode: 'air_plus_production',
        budgetRub: 365_000,
        formatSummary: 'Пакет 40 выходов + ролик 20 сек',
        responseMin: 7,
      },
      {
        orderNumber: 'FM-2768',
        clientLabel: 'ООО «МедЛаб Диагностика»',
        checkoutMode: 'production_only',
        budgetRub: 35_000,
        formatSummary: 'Ролик 20 сек с дисклеймером',
        responseMin: 9,
      },
    ],
  },
  {
    monthsAgo: 1,
    prodInquiries: 12,
    prodConverted: 9,
    prodDelivered: 9,
    prodRevenueRub: 270_000,
    airInquiries: 4,
    airConverted: 3,
    airDelivered: 3,
    airRevenueRub: 760_000,
    slaMetCount: 15,
    responseMinSum: 144,
    minResponseMin: 5,
    maxResponseMin: 16,
    firstTakeMetCount: 11,
    featuredDeals: [
      {
        orderNumber: 'FM-2812',
        clientLabel: 'АО «Индустрия Лизинг»',
        checkoutMode: 'air_plus_production',
        budgetRub: 350_000,
        formatSummary: 'Утренний и вечерний прайм 15 сек',
        responseMin: 8,
      },
      {
        orderNumber: 'FM-2835',
        clientLabel: 'ООО «РитейлЛогистик Групп»',
        checkoutMode: 'production_only',
        budgetRub: 35_000,
        formatSummary: 'Двухголосый ролик 25 сек',
        responseMin: 9,
      },
    ],
  },
  {
    monthsAgo: 0,
    prodInquiries: 5,
    prodConverted: 4,
    prodDelivered: 3,
    prodRevenueRub: 115_000,
    airInquiries: 1,
    airConverted: 1,
    airDelivered: 1,
    airRevenueRub: 245_000,
    slaMetCount: 6,
    responseMinSum: 52,
    minResponseMin: 6,
    maxResponseMin: 14,
    firstTakeMetCount: 4,
    featuredDeals: [
      {
        orderNumber: 'FM-2879',
        clientLabel: 'ООО «ТехноФлот Сервис»',
        checkoutMode: 'air_plus_production',
        budgetRub: 245_000,
        formatSummary: 'Пакет 26 выходов + ролик 15 сек',
        responseMin: 8,
      },
      {
        orderNumber: 'FM-2902',
        clientLabel: 'ООО «БизнесПарк Регион»',
        checkoutMode: 'production_only',
        budgetRub: 35_000,
        formatSummary: 'Продакшн под ключ 25 сек',
        responseMin: 9,
      },
    ],
  },
];

function roundOneDecimal(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

export function isOrderConvertedStage(stage: CrmOrderStage): boolean {
  return getCrmStageOrderIndex(stage) >= 2;
}

export function isOrderDeliveredStage(stage: CrmOrderStage): boolean {
  return stage === 'on_air' || stage === 'completed_ltv';
}

export function buildMonthSequenceUtcPlus3(
  periodMonths: AnalyticsPeriodMonths,
  nowMs = Date.now()
): Array<{
  monthKey: string;
  monthLabel: string;
  monthFullLabel: string;
  monthsAgo: number;
}> {
  const nowYmd = formatIsoToUtcPlus3Ymd(new Date(nowMs).toISOString());
  const baseYear = Number.parseInt(nowYmd.slice(0, 4), 10) || 2026;
  const baseMonthIndex = (Number.parseInt(nowYmd.slice(5, 7), 10) || 1) - 1;

  const result: Array<{
    monthKey: string;
    monthLabel: string;
    monthFullLabel: string;
    monthsAgo: number;
  }> = [];

  for (let offset = periodMonths - 1; offset >= 0; offset -= 1) {
    const totalMonths = baseYear * 12 + baseMonthIndex - offset;
    const year = Math.floor(totalMonths / 12);
    const monthZero = ((totalMonths % 12) + 12) % 12;
    const mm = String(monthZero + 1).padStart(2, '0');
    const yyShort = String(year).slice(-2);
    result.push({
      monthKey: `${year}-${mm}`,
      monthLabel: `${MONTH_SHORT_RU[monthZero]} ${yyShort}`,
      monthFullLabel: `${MONTH_FULL_RU[monthZero]} ${year}`,
      monthsAgo: offset,
    });
  }

  return result;
}

function evaluateOrderResponseMinutes(order: CrmOrderRecord): {
  metSla: boolean;
  responseMin: number;
} {
  const startIso = order.slaState?.slaWindowStartAt || order.createdAt;
  const startMs = Date.parse(startIso);
  const deadlineMs = order.slaState?.slaDeadlineAt
    ? Date.parse(order.slaState.slaDeadlineAt)
    : startMs + 15 * 60_000;
  const contactedMs = order.slaState?.firstContactedAt
    ? Date.parse(order.slaState.firstContactedAt)
    : Number.NaN;

  if (Number.isFinite(contactedMs) && Number.isFinite(startMs)) {
    const diffMin = Math.max(1, Math.round((contactedMs - startMs) / 60_000));
    const clampedMin = Math.min(diffMin, 120);
    const met =
      !order.slaState?.escalatedAt &&
      (Number.isFinite(deadlineMs)
        ? contactedMs <= deadlineMs
        : clampedMin <= 15);
    return { metSla: met, responseMin: clampedMin };
  }

  if (order.stage !== 'new_hold') {
    return { metSla: !order.slaState?.escalatedAt, responseMin: 9 };
  }

  return {
    metSla: !order.slaState?.escalatedAt,
    responseMin: order.slaState?.escalatedAt ? 24 : 8,
  };
}

function isOrderFirstTakeClean(order: CrmOrderRecord): boolean {
  const revisions = order.approvalWorkflow?.spotRevisions ?? [];
  const hasEscalation = revisions.some(
    (rev) => rev.kind === 'text_change_escalation'
  );
  return !hasEscalation;
}

function extractCleanClientLabel(order: CrmOrderRecord): string {
  const rawCompany = (order.companyOrInn || '').trim();
  if (rawCompany) {
    const beforeInn = rawCompany.split('·')[0]?.trim() || rawCompany;
    return beforeInn.slice(0, 44);
  }
  const rawContact = (order.contact || '').trim();
  if (rawContact) {
    const parts = rawContact.split('·').map((s) => s.trim());
    return (parts[1] || parts[0] || 'Заказчик').slice(0, 44);
  }
  return 'Заказчик студии';
}

function extractCleanFormatSummary(order: CrmOrderRecord): string {
  if (order.mediaPlanSnapshot) {
    const stNames = order.mediaPlanSnapshot.stations
      .slice(0, 2)
      .map((s) => s.stationName)
      .join(', ');
    return `${stNames} · ${order.mediaPlanSnapshot.totalSpots} вых. × ${order.mediaPlanSnapshot.spotDurationSec}с`.slice(
      0,
      54
    );
  }
  const baseFormat = (order.formatLabel || 'Аудиоролик').split('—')[0]?.trim();
  return (baseFormat || 'Аудиопродакшн').slice(0, 54);
}

function toOrderTooltipDigest(
  order: CrmOrderRecord,
  extra?: { dwellHours?: number; isActiveOnStage?: boolean }
): AnalyticsTooltipOrderDigest {
  const slaEval = evaluateOrderResponseMinutes(order);
  const stageMeta = STAGE_EFFICIENCY_LABELS[order.stage];
  return {
    orderNumber: order.orderNumber,
    clientLabel: extractCleanClientLabel(order),
    stageId: order.stage,
    stageShortLabel: stageMeta.shortLabel,
    checkoutMode: order.checkoutMode,
    budgetRub: Math.max(0, order.totalBudgetRub || 0),
    formatSummary: extractCleanFormatSummary(order),
    responseMin: slaEval.responseMin,
    metSla: slaEval.metSla,
    firstTakeClean: isOrderFirstTakeClean(order),
    dwellHours: extra?.dwellHours,
    isActiveOnStage: extra?.isActiveOnStage,
    origin: 'live_crm',
  };
}

function toArchiveOrderDigest(
  spec: ArchiveFeaturedDealSpec
): AnalyticsTooltipOrderDigest {
  return {
    orderNumber: spec.orderNumber,
    clientLabel: spec.clientLabel,
    stageId: 'completed_ltv',
    stageShortLabel: STAGE_EFFICIENCY_LABELS.completed_ltv.shortLabel,
    checkoutMode: spec.checkoutMode,
    budgetRub: spec.budgetRub,
    formatSummary: spec.formatSummary,
    responseMin: spec.responseMin,
    metSla: spec.responseMin <= 15,
    firstTakeClean: true,
    origin: 'archive_edo',
  };
}

/**
 * Рассчитывает помесячную конверсию заказов, финансовый объём, детализацию конкретных сделок для всплывающих
 * подсказок (tooltips) и метрики производственной эффективности студии для визуализации в Recharts.
 */
export function buildStudioAnalyticsSummary(
  rawOrders: readonly CrmOrderRecord[],
  query: StudioAnalyticsQuery,
  nowMs = Date.now()
): StudioAnalyticsSummary {
  const hydratedOrders = rawOrders
    .filter((ord) => {
      if (query.segment === 'all') return true;
      return ord.checkoutMode === query.segment;
    })
    .map((ord) => ensureOrderStageHistory(ord));

  const monthFrames = buildMonthSequenceUtcPlus3(query.periodMonths, nowMs);
  const archiveByOffset = new Map<number, HistoricalArchiveBucket>(
    HISTORICAL_MONTHLY_BUCKETS.map((b) => [b.monthsAgo, b])
  );

  // Группируем живые заказы CRM по месяцу создания (UTC+3)
  const ordersByMonth = new Map<string, CrmOrderRecord[]>();
  for (const ord of hydratedOrders) {
    const monthKey = formatIsoToUtcPlus3Ymd(ord.createdAt).slice(0, 7);
    const list = ordersByMonth.get(monthKey) ?? [];
    list.push(ord);
    ordersByMonth.set(monthKey, list);
  }

  let sumOrders = 0;
  let sumConverted = 0;
  let sumDelivered = 0;
  let sumRevenueRub = 0;
  let sumSlaMet = 0;
  let sumResponseMin = 0;
  let sumFirstTakeEligible = 0;
  let sumFirstTakeMet = 0;

  const preliminaryMonths: Omit<MonthlyConversionPoint, 'conversionDeltaPp'>[] =
    monthFrames.map((frame) => {
      const liveInMonth = ordersByMonth.get(frame.monthKey) ?? [];
      let totalOrders = liveInMonth.length;
      let convertedOrders = 0;
      let deliveredOrders = 0;
      let revenueRub = 0;
      let slaMet = 0;
      let responseMinTotal = 0;
      let minResponseMin = Number.POSITIVE_INFINITY;
      let maxResponseMin = 0;
      let firstTakeEligible = 0;
      let firstTakeMet = 0;

      const liveDigests: AnalyticsTooltipOrderDigest[] = [];

      for (const ord of liveInMonth) {
        const converted = isOrderConvertedStage(ord.stage);
        const delivered = isOrderDeliveredStage(ord.stage);
        if (converted) {
          convertedOrders += 1;
          revenueRub += Math.max(0, ord.totalBudgetRub || 0);
          firstTakeEligible += 1;
          if (isOrderFirstTakeClean(ord)) {
            firstTakeMet += 1;
          }
        }
        if (delivered) {
          deliveredOrders += 1;
        }
        const slaEval = evaluateOrderResponseMinutes(ord);
        if (slaEval.metSla) slaMet += 1;
        responseMinTotal += slaEval.responseMin;
        if (slaEval.responseMin < minResponseMin) {
          minResponseMin = slaEval.responseMin;
        }
        if (slaEval.responseMin > maxResponseMin) {
          maxResponseMin = slaEval.responseMin;
        }
        liveDigests.push(toOrderTooltipDigest(ord));
      }

      const archiveDigests: AnalyticsTooltipOrderDigest[] = [];

      if (query.scope === 'crm_plus_archive') {
        const arch = archiveByOffset.get(frame.monthsAgo);
        if (arch) {
          const archInq =
            query.segment === 'production_only'
              ? arch.prodInquiries
              : query.segment === 'air_plus_production'
                ? arch.airInquiries
                : arch.prodInquiries + arch.airInquiries;
          const archConv =
            query.segment === 'production_only'
              ? arch.prodConverted
              : query.segment === 'air_plus_production'
                ? arch.airConverted
                : arch.prodConverted + arch.airConverted;
          const archDeliv =
            query.segment === 'production_only'
              ? arch.prodDelivered
              : query.segment === 'air_plus_production'
                ? arch.airDelivered
                : arch.prodDelivered + arch.airDelivered;
          const archRev =
            query.segment === 'production_only'
              ? arch.prodRevenueRub
              : query.segment === 'air_plus_production'
                ? arch.airRevenueRub
                : arch.prodRevenueRub + arch.airRevenueRub;

          const archTotalBase = Math.max(
            1,
            arch.prodInquiries + arch.airInquiries
          );
          const shareRatio = archInq / archTotalBase;
          const archConvBase = Math.max(
            1,
            arch.prodConverted + arch.airConverted
          );
          const convRatio = archConv / archConvBase;

          if (archInq > 0) {
            totalOrders += archInq;
            convertedOrders += archConv;
            deliveredOrders += archDeliv;
            revenueRub += archRev;
            slaMet += Math.min(archInq, Math.round(arch.slaMetCount * shareRatio));
            responseMinTotal += Math.round(arch.responseMinSum * shareRatio);
            firstTakeEligible += archConv;
            firstTakeMet += Math.min(
              archConv,
              Math.round(arch.firstTakeMetCount * convRatio)
            );
            if (arch.minResponseMin < minResponseMin) {
              minResponseMin = arch.minResponseMin;
            }
            if (arch.maxResponseMin > maxResponseMin) {
              maxResponseMin = arch.maxResponseMin;
            }
          }

          for (const deal of arch.featuredDeals) {
            if (
              query.segment === 'all' ||
              deal.checkoutMode === query.segment
            ) {
              archiveDigests.push(toArchiveOrderDigest(deal));
            }
          }
        }
      }

      // Сортируем живые заказы периода по убыванию бюджета (при равенстве — подтверждённые выше)
      liveDigests.sort((a, b) => {
        if (b.budgetRub !== a.budgetRub) return b.budgetRub - a.budgetRub;
        return (
          getCrmStageOrderIndex(b.stageId) - getCrmStageOrderIndex(a.stageId)
        );
      });

      const topOrders: AnalyticsTooltipOrderDigest[] = [
        ...liveDigests,
        ...archiveDigests,
      ].slice(0, 3);

      // Для графика эффективности выбираем показательный заказ месяца:
      // сначала сделку с отклонением по SLA или переделкой текста (если была), иначе — сделку с самым быстрым ответом
      const attentionOrder =
        liveDigests.find((d) => !d.metSla || !d.firstTakeClean) ?? null;
      const fastestOrder =
        [...liveDigests, ...archiveDigests].sort(
          (a, b) => a.responseMin - b.responseMin || b.budgetRub - a.budgetRub
        )[0] ?? null;
      const slaSpotlightOrder = attentionOrder ?? fastestOrder;

      const conversionPct =
        totalOrders > 0
          ? roundOneDecimal((convertedOrders / totalOrders) * 100)
          : 0;
      const avgOrderValueRub =
        convertedOrders > 0 ? Math.round(revenueRub / convertedOrders) : 0;
      const slaCompliancePct =
        totalOrders > 0 ? roundOneDecimal((slaMet / totalOrders) * 100) : 0;
      const slaDeltaVsTargetPp =
        totalOrders > 0 ? roundOneDecimal(slaCompliancePct - 90) : 0;
      const avgFirstResponseMin =
        totalOrders > 0 ? roundOneDecimal(responseMinTotal / totalOrders) : 0;
      const firstTakeApprovalPct =
        firstTakeEligible > 0
          ? roundOneDecimal((firstTakeMet / firstTakeEligible) * 100)
          : 0;

      sumOrders += totalOrders;
      sumConverted += convertedOrders;
      sumDelivered += deliveredOrders;
      sumRevenueRub += revenueRub;
      sumSlaMet += slaMet;
      sumResponseMin += responseMinTotal;
      sumFirstTakeEligible += firstTakeEligible;
      sumFirstTakeMet += firstTakeMet;

      return {
        monthKey: frame.monthKey,
        monthLabel: frame.monthLabel,
        monthFullLabel: frame.monthFullLabel,
        totalOrders,
        convertedOrders,
        deliveredOrders,
        conversionPct,
        revenueRub,
        revenueThousandsRub: Math.round(revenueRub / 1000),
        avgOrderValueRub,
        slaCompliancePct,
        slaMetOrders: slaMet,
        slaDeltaVsTargetPp,
        avgFirstResponseMin,
        minFirstResponseMin: Number.isFinite(minResponseMin)
          ? minResponseMin
          : 0,
        maxFirstResponseMin: maxResponseMin,
        firstTakeApprovalPct,
        firstTakeApprovedOrders: firstTakeMet,
        liveCrmOrdersCount: liveInMonth.length,
        topOrders,
        slaSpotlightOrder,
      };
    });

  const months: MonthlyConversionPoint[] = preliminaryMonths.map((item, idx) => {
    const prev = idx > 0 ? preliminaryMonths[idx - 1] : undefined;
    const conversionDeltaPp =
      prev && prev.totalOrders > 0 && item.totalOrders > 0
        ? roundOneDecimal(item.conversionPct - prev.conversionPct)
        : null;
    return {
      ...item,
      conversionDeltaPp,
    };
  });

  // Расчёт длительности прохождения этапов воронки и подбор конкретных заказов для подсказок этапов
  const stageDurationsMs = new Map<CrmOrderStage, number[]>();
  const activeOrdersByStage = new Map<CrmOrderStage, CrmOrderRecord[]>();
  const traversedOrdersByStage = new Map<
    CrmOrderStage,
    Array<{ order: CrmOrderRecord; dwellMs: number }>
  >();

  for (const stId of ORDERED_CRM_STAGE_IDS) {
    stageDurationsMs.set(stId, []);
    activeOrdersByStage.set(stId, []);
    traversedOrdersByStage.set(stId, []);
  }

  for (const ord of hydratedOrders) {
    activeOrdersByStage.get(ord.stage)?.push(ord);
    const history = ord.stageHistory ?? [];
    for (const entry of history) {
      if (
        entry.previousStage &&
        entry.previousStage !== entry.nextStage &&
        typeof entry.durationFromPrevMs === 'number' &&
        Number.isFinite(entry.durationFromPrevMs) &&
        entry.durationFromPrevMs > 0
      ) {
        const cappedMs = Math.min(entry.durationFromPrevMs, 72 * 3_600_000);
        stageDurationsMs.get(entry.previousStage)?.push(cappedMs);
        traversedOrdersByStage
          .get(entry.previousStage)
          ?.push({ order: ord, dwellMs: cappedMs });
      }
    }
  }

  const archiveFallbackHours: Readonly<Record<CrmOrderStage, number>> = {
    new_hold: 0.3,
    quota_locked: 1.2,
    edo_invoice: 3.4,
    in_production: 9.6,
    on_air: 14.5,
    completed_ltv: 0,
  };

  const trackedStages = ORDERED_CRM_STAGE_IDS.slice(0, 5);
  const rawStagePoints = trackedStages.map((stageId) => {
    const samples = stageDurationsMs.get(stageId) ?? [];
    const meta = STAGE_EFFICIENCY_LABELS[stageId];
    let avgHours = 0;
    let maxHours = 0;
    if (samples.length > 0) {
      const avgMs = samples.reduce((acc, v) => acc + v, 0) / samples.length;
      const maxMs = Math.max(...samples);
      avgHours = Math.max(0.1, roundOneDecimal(avgMs / 3_600_000));
      maxHours = Math.max(avgHours, roundOneDecimal(maxMs / 3_600_000));
    } else if (query.scope === 'crm_plus_archive') {
      avgHours = archiveFallbackHours[stageId];
      maxHours = roundOneDecimal(archiveFallbackHours[stageId] * 1.4);
    }

    // Собираем конкретные заказы для подсказки этапа: сначала активные на этапе, затем прошедшие его с наибольшим временем
    const activeOnThisStage = activeOrdersByStage.get(stageId) ?? [];
    const seenOrderNumbers = new Set<string>();
    const stageOrders: AnalyticsTooltipOrderDigest[] = [];

    for (const activeOrd of activeOnThisStage) {
      const lastEntryIso =
        activeOrd.stageHistory?.[activeOrd.stageHistory.length - 1]?.timestamp ||
        activeOrd.updatedAt ||
        activeOrd.createdAt;
      const currentStayMs = Math.max(
        0,
        Math.min(nowMs - Date.parse(lastEntryIso), 72 * 3_600_000)
      );
      const currentStayHours = Number.isFinite(currentStayMs)
        ? Math.max(0.1, roundOneDecimal(currentStayMs / 3_600_000))
        : undefined;
      stageOrders.push(
        toOrderTooltipDigest(activeOrd, {
          dwellHours: currentStayHours,
          isActiveOnStage: true,
        })
      );
      seenOrderNumbers.add(activeOrd.orderNumber);
      if (stageOrders.length >= 3) break;
    }

    if (stageOrders.length < 3) {
      const traversed = [...(traversedOrdersByStage.get(stageId) ?? [])].sort(
        (a, b) => b.dwellMs - a.dwellMs
      );
      for (const item of traversed) {
        if (seenOrderNumbers.has(item.order.orderNumber)) continue;
        stageOrders.push(
          toOrderTooltipDigest(item.order, {
            dwellHours: Math.max(0.1, roundOneDecimal(item.dwellMs / 3_600_000)),
            isActiveOnStage: false,
          })
        );
        seenOrderNumbers.add(item.order.orderNumber);
        if (stageOrders.length >= 3) break;
      }
    }

    return {
      stageId,
      stepCode: meta.stepCode,
      stageLabel: meta.label,
      avgDurationHours: avgHours,
      maxDurationHours: maxHours,
      shareOfCyclePct: 0,
      transitionsCount: samples.length,
      activeOrdersCount: activeOnThisStage.length,
      isBottleneck: false,
      stageOrders,
    };
  });

  let maxStageHours = 0;
  let totalAllStagesHours = 0;
  for (const pt of rawStagePoints) {
    totalAllStagesHours += pt.avgDurationHours;
    if (pt.avgDurationHours > maxStageHours) {
      maxStageHours = pt.avgDurationHours;
    }
  }

  const stageEfficiency: StageEfficiencyPoint[] = rawStagePoints.map((pt) => ({
    ...pt,
    shareOfCyclePct:
      totalAllStagesHours > 0
        ? roundOneDecimal((pt.avgDurationHours / totalAllStagesHours) * 100)
        : 0,
    isBottleneck: maxStageHours > 0 && pt.avgDurationHours === maxStageHours,
  }));

  const avgProductionCycleHours = roundOneDecimal(
    stageEfficiency
      .slice(0, 4)
      .reduce((acc, item) => acc + item.avgDurationHours, 0)
  );

  return {
    months,
    stageEfficiency,
    totals: {
      totalOrders: sumOrders,
      convertedOrders: sumConverted,
      deliveredOrders: sumDelivered,
      overallConversionPct:
        sumOrders > 0 ? roundOneDecimal((sumConverted / sumOrders) * 100) : 0,
      confirmedRevenueRub: sumRevenueRub,
      avgOrderValueRub:
        sumConverted > 0 ? Math.round(sumRevenueRub / sumConverted) : 0,
      slaCompliancePct:
        sumOrders > 0 ? roundOneDecimal((sumSlaMet / sumOrders) * 100) : 0,
      avgFirstResponseMin:
        sumOrders > 0 ? roundOneDecimal(sumResponseMin / sumOrders) : 0,
      firstTakeApprovalPct:
        sumFirstTakeEligible > 0
          ? roundOneDecimal((sumFirstTakeMet / sumFirstTakeEligible) * 100)
          : 0,
      avgProductionCycleHours,
    },
  };
}
