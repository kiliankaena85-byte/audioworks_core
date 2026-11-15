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

export interface MonthlyConversionPoint {
  monthKey: string;
  monthLabel: string;
  monthFullLabel: string;
  totalOrders: number;
  convertedOrders: number;
  deliveredOrders: number;
  conversionPct: number;
  revenueRub: number;
  revenueThousandsRub: number;
  slaCompliancePct: number;
  avgFirstResponseMin: number;
  firstTakeApprovalPct: number;
}

export interface StageEfficiencyPoint {
  stageId: CrmOrderStage;
  stepCode: string;
  stageLabel: string;
  avgDurationHours: number;
  transitionsCount: number;
  activeOrdersCount: number;
  isBottleneck: boolean;
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
  Record<CrmOrderStage, { stepCode: string; label: string }>
> = {
  new_hold: { stepCode: '01', label: '01. Приём и сверка заявки' },
  quota_locked: { stepCode: '02', label: '02. Подтверждение ТЗ и квоты' },
  edo_invoice: { stepCode: '03', label: '03. Договор-счёт и оплата' },
  in_production: { stepCode: '04', label: '04. Сценарии и запись ролика' },
  on_air: { stepCode: '05', label: '05. Сдача мастера и эфир' },
  completed_ltv: { stepCode: '06', label: '06. Закрытие актов ЭДО' },
};

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
  firstTakeMetCount: number;
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
    firstTakeMetCount: 7,
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
    firstTakeMetCount: 5,
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
    firstTakeMetCount: 8,
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
    firstTakeMetCount: 9,
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
    firstTakeMetCount: 8,
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
    firstTakeMetCount: 9,
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
    firstTakeMetCount: 7,
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
    firstTakeMetCount: 8,
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
    firstTakeMetCount: 11,
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
    firstTakeMetCount: 11,
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
    firstTakeMetCount: 11,
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
    firstTakeMetCount: 4,
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
      (Number.isFinite(deadlineMs) ? contactedMs <= deadlineMs : clampedMin <= 15);
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

/**
 * Рассчитывает помесячную конверсию заказов, финансовый объём и метрики производственной эффективности студии
 * для визуализации в Recharts.
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

  const months: MonthlyConversionPoint[] = monthFrames.map((frame) => {
    const liveInMonth = ordersByMonth.get(frame.monthKey) ?? [];
    let totalOrders = liveInMonth.length;
    let convertedOrders = 0;
    let deliveredOrders = 0;
    let revenueRub = 0;
    let slaMet = 0;
    let responseMinTotal = 0;
    let firstTakeEligible = 0;
    let firstTakeMet = 0;

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
    }

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

        const archTotalBase = Math.max(1, arch.prodInquiries + arch.airInquiries);
        const shareRatio = archInq / archTotalBase;
        const archConvBase = Math.max(1, arch.prodConverted + arch.airConverted);
        const convRatio = archConv / archConvBase;

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
      }
    }

    const conversionPct =
      totalOrders > 0 ? roundOneDecimal((convertedOrders / totalOrders) * 100) : 0;
    const slaCompliancePct =
      totalOrders > 0 ? roundOneDecimal((slaMet / totalOrders) * 100) : 0;
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
      slaCompliancePct,
      avgFirstResponseMin,
      firstTakeApprovalPct,
    };
  });

  // Расчёт длительности прохождения этапов воронки по фактическим stageHistory
  const stageDurationsMs = new Map<CrmOrderStage, number[]>();
  const activeStageCounts = new Map<CrmOrderStage, number>();
  for (const stId of ORDERED_CRM_STAGE_IDS) {
    stageDurationsMs.set(stId, []);
    activeStageCounts.set(stId, 0);
  }

  for (const ord of hydratedOrders) {
    activeStageCounts.set(ord.stage, (activeStageCounts.get(ord.stage) ?? 0) + 1);
    const history = ord.stageHistory ?? [];
    for (const entry of history) {
      if (
        entry.previousStage &&
        entry.previousStage !== entry.nextStage &&
        typeof entry.durationFromPrevMs === 'number' &&
        Number.isFinite(entry.durationFromPrevMs) &&
        entry.durationFromPrevMs > 0
      ) {
        // Ограничиваем выбросы свыше 72 часов для репрезентативной операционной медианы/среднего
        const cappedMs = Math.min(entry.durationFromPrevMs, 72 * 3_600_000);
        stageDurationsMs.get(entry.previousStage)?.push(cappedMs);
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
    if (samples.length > 0) {
      const avgMs = samples.reduce((acc, v) => acc + v, 0) / samples.length;
      avgHours = Math.max(0.1, roundOneDecimal(avgMs / 3_600_000));
    } else if (query.scope === 'crm_plus_archive') {
      avgHours = archiveFallbackHours[stageId];
    }

    return {
      stageId,
      stepCode: meta.stepCode,
      stageLabel: meta.label,
      avgDurationHours: avgHours,
      transitionsCount: samples.length,
      activeOrdersCount: activeStageCounts.get(stageId) ?? 0,
      isBottleneck: false,
    };
  });

  let maxStageHours = 0;
  for (const pt of rawStagePoints) {
    if (pt.avgDurationHours > maxStageHours) {
      maxStageHours = pt.avgDurationHours;
    }
  }
  const stageEfficiency: StageEfficiencyPoint[] = rawStagePoints.map((pt) => ({
    ...pt,
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
