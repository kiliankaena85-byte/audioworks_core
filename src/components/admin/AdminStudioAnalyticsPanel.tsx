import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { studioCmsStore } from '../../cms/studioCmsStore';
import type { CrmOrderRecord } from '../../data/orderCrmTypes';
import { formatNumberSpaced, formatRubCompact } from '../../data/radioInventory';
import {
  type AnalyticsDataScope,
  type AnalyticsPeriodMonths,
  type AnalyticsSegmentFilter,
  buildStudioAnalyticsSummary,
  type MonthlyConversionPoint,
  type StageEfficiencyPoint,
} from '../../data/studioAnalyticsCore';
import {
  downloadStudioAnalyticsCsvReport,
  downloadStudioAnalyticsPdfReport,
} from '../../utils/studioAnalyticsPdfDownload';

export interface AdminStudioAnalyticsPanelProps {
  orders?: CrmOrderRecord[];
  isDark?: boolean;
  isRefreshingExternal?: boolean;
  onRefreshOrders?: () => void | Promise<void>;
  onOpenOrdersFunnel?: () => void;
}

type ConversionChartMetricMode = 'orders' | 'revenue';

interface TooltipPayloadEntry<TRecord> {
  payload?: TRecord;
}

function formatSignedDeltaPp(delta: number | null): string | null {
  if (delta === null || !Number.isFinite(delta)) return null;
  if (delta > 0) return `+${delta} п.п.`;
  if (delta < 0) return `−${Math.abs(delta)} п.п.`;
  return '0 п.п.';
}

function ConversionChartTooltip({
  active,
  payload,
  metricMode,
}: {
  active?: boolean;
  payload?: readonly TooltipPayloadEntry<MonthlyConversionPoint>[];
  metricMode: ConversionChartMetricMode;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  const deltaLabel = formatSignedDeltaPp(row.conversionDeltaPp);
  const deltaTone =
    row.conversionDeltaPp === null || row.conversionDeltaPp === 0
      ? 'text-[#111111]/72 dark:text-[#F4F3EF]/72'
      : row.conversionDeltaPp > 0
        ? 'text-[#166534] dark:text-[#4ADE80]'
        : 'text-[#92400E] dark:text-[#FBBF24]';

  return (
    <div
      data-testid="tooltip-monthly-conversion"
      className="rounded-xl bg-white/98 dark:bg-[#17171C]/98 backdrop-blur-sm border border-[#111111]/15 dark:border-white/16 px-4 py-3.5 shadow-lg text-xs text-[#111111] dark:text-[#F4F3EF] w-[308px] sm:w-[344px] space-y-2.5 tabular-nums pointer-events-none"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-bold text-[#111111] dark:text-[#F4F3EF]">
          {row.monthFullLabel} (UTC+3)
        </p>
        {deltaLabel && (
          <span className={`text-[11px] font-semibold ${deltaTone}`}>
            {deltaLabel} к пред. мес.
          </span>
        )}
      </div>

      {/* Детализация метрики периода */}
      <div className="space-y-1 pt-2 border-t border-[#111111]/10 dark:border-white/10">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[#B82D0D] dark:text-[#FF7A5C] font-medium">
            Конверсия в сделку:
          </span>
          <span className="font-bold text-[#B82D0D] dark:text-[#FF7A5C] whitespace-nowrap shrink-0 text-right">
            {row.conversionPct}% ({row.convertedOrders} из {row.totalOrders})
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
            {metricMode === 'revenue'
              ? 'Подтверждённый объём:'
              : 'Объём сделок:'}
          </span>
          <span className="font-semibold whitespace-nowrap shrink-0 text-right">
            {formatNumberSpaced(row.revenueRub)} ₽
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
            Средний чек · сдано:
          </span>
          <span className="font-semibold whitespace-nowrap shrink-0 text-right">
            {row.avgOrderValueRub > 0
              ? `${formatNumberSpaced(row.avgOrderValueRub)} ₽`
              : '—'}{' '}
            · {row.deliveredOrders} шт.
          </span>
        </div>
      </div>

      {/* Детализация конкретных заказов периода */}
      <div className="space-y-1.5 pt-2 border-t border-[#111111]/10 dark:border-white/10">
        <p className="text-[11px] font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72">
          Ключевые заказы периода ({row.topOrders.length}):
        </p>
        {row.topOrders.length === 0 ? (
          <p className="text-[11px] text-[#111111]/70 dark:text-[#F4F3EF]/70">
            В выбранном срезе за этот месяц сделок не зарегистрировано.
          </p>
        ) : (
          <div className="space-y-1.5">
            {row.topOrders.map((ord) => (
              <div key={ord.orderNumber} className="space-y-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-[#111111] dark:text-[#F4F3EF] truncate">
                    #{ord.orderNumber} · {ord.clientLabel}
                  </span>
                  <span className="font-bold text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap shrink-0">
                    {ord.budgetRub > 0
                      ? formatRubCompact(ord.budgetRub)
                      : 'Договорная'}
                  </span>
                </div>
                <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72 truncate">
                  {ord.stageShortLabel} · {ord.formatSummary} ·{' '}
                  {ord.origin === 'live_crm' ? 'живой CRM' : 'архив ЭДО'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EfficiencyChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly TooltipPayloadEntry<MonthlyConversionPoint>[];
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  const slaTargetLabel =
    row.totalOrders > 0 ? formatSignedDeltaPp(row.slaDeltaVsTargetPp) : null;
  const slaTargetTone =
    row.slaDeltaVsTargetPp >= 0
      ? 'text-[#166534] dark:text-[#4ADE80]'
      : 'text-[#B91C1C] dark:text-[#F87171]';
  const spot = row.slaSpotlightOrder;

  return (
    <div
      data-testid="tooltip-studio-efficiency"
      className="rounded-xl bg-white/98 dark:bg-[#17171C]/98 backdrop-blur-sm border border-[#111111]/15 dark:border-white/16 px-4 py-3.5 shadow-lg text-xs text-[#111111] dark:text-[#F4F3EF] w-[308px] sm:w-[344px] space-y-2.5 tabular-nums pointer-events-none"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-bold text-[#111111] dark:text-[#F4F3EF]">
          {row.monthFullLabel} (UTC+3)
        </p>
        {slaTargetLabel && (
          <span className={`text-[11px] font-semibold ${slaTargetTone}`}>
            {slaTargetLabel} к порогу 90%
          </span>
        )}
      </div>

      {/* Детализация операционных метрик студии */}
      <div className="space-y-1 pt-2 border-t border-[#111111]/10 dark:border-white/10">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[#166534] dark:text-[#4ADE80] font-medium">
            Соблюдение SLA ≤ 15 мин:
          </span>
          <span className="font-bold text-[#166534] dark:text-[#4ADE80] whitespace-nowrap shrink-0 text-right">
            {row.slaCompliancePct}% ({row.slaMetOrders} из {row.totalOrders})
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
            Отклик (ср. / разброс):
          </span>
          <span className="font-semibold whitespace-nowrap shrink-0 text-right">
            {row.totalOrders > 0
              ? `${row.avgFirstResponseMin} мин (${row.minFirstResponseMin}–${row.maxFirstResponseMin} мин)`
              : '—'}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[#1D4ED8] dark:text-[#60A5FA] font-medium">
            Сдача с 1-го дубля:
          </span>
          <span className="font-bold text-[#1D4ED8] dark:text-[#60A5FA] whitespace-nowrap shrink-0 text-right">
            {row.firstTakeApprovalPct}% ({row.firstTakeApprovedOrders} из{' '}
            {row.convertedOrders})
          </span>
        </div>
      </div>

      {/* Детализация конкретного заказа по SLA и согласованию */}
      <div className="space-y-1 pt-2 border-t border-[#111111]/10 dark:border-white/10">
        <p className="text-[11px] font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72">
          {spot && (!spot.metSla || !spot.firstTakeClean)
            ? 'Заказ, требующий контроля регламента:'
            : 'Показательный заказ по скорости отклика:'}
        </p>
        {spot ? (
          <div className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-[#111111] dark:text-[#F4F3EF] truncate">
                #{spot.orderNumber} · {spot.clientLabel}
              </span>
              <span
                className={`font-bold whitespace-nowrap shrink-0 ${
                  spot.metSla
                    ? 'text-[#166534] dark:text-[#4ADE80]'
                    : 'text-[#B91C1C] dark:text-[#F87171]'
                }`}
              >
                {spot.responseMin} мин
              </span>
            </div>
            <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72 truncate">
              {spot.metSla ? 'SLA ≤ 15 мин соблюдён' : 'Отклик вне SLA 15 мин'}{' '}
              ·{' '}
              {spot.firstTakeClean
                ? 'принят с 1-го дубля'
                : 'переделка текста'}{' '}
              · {spot.stageShortLabel}
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-[#111111]/70 dark:text-[#F4F3EF]/70">
            В этом месяце нет заказов для расчёта SLA.
          </p>
        )}
      </div>
    </div>
  );
}

function StageDwellChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly TooltipPayloadEntry<StageEfficiencyPoint>[];
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <div
      data-testid="tooltip-stage-dwell"
      className="rounded-xl bg-white/98 dark:bg-[#17171C]/98 backdrop-blur-sm border border-[#111111]/15 dark:border-white/16 px-4 py-3.5 shadow-lg text-xs text-[#111111] dark:text-[#F4F3EF] w-[300px] sm:w-[336px] space-y-2.5 tabular-nums pointer-events-none"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-bold text-[#111111] dark:text-[#F4F3EF]">
          {row.stageLabel}
        </p>
        <span
          className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${
            row.isBottleneck
              ? 'text-[#B82D0D] dark:text-[#FF7A5C]'
              : 'text-[#166534] dark:text-[#4ADE80]'
          }`}
        >
          {row.isBottleneck ? 'Узкое место' : 'В нормативе'}
        </span>
      </div>

      {/* Метрики скорости прохождения этапа */}
      <div className="space-y-1 pt-2 border-t border-[#111111]/10 dark:border-white/10">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
            Среднее время (доля цикла):
          </span>
          <span
            className={`font-bold whitespace-nowrap shrink-0 text-right ${
              row.isBottleneck
                ? 'text-[#B82D0D] dark:text-[#FF7A5C]'
                : 'text-[#111111] dark:text-[#F4F3EF]'
            }`}
          >
            {row.avgDurationHours} ч ({row.shareOfCyclePct}%)
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
            Пиковое время на этапе:
          </span>
          <span className="font-semibold whitespace-nowrap shrink-0 text-right">
            {row.maxDurationHours} ч
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
            Сейчас на этапе · переходов:
          </span>
          <span className="font-semibold whitespace-nowrap shrink-0 text-right">
            {row.activeOrdersCount} зак. · {row.transitionsCount} пер.
          </span>
        </div>
      </div>

      {/* Конкретные сделки на этапе или в выборке переходов */}
      <div className="space-y-1.5 pt-2 border-t border-[#111111]/10 dark:border-white/10">
        <p className="text-[11px] font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72">
          Детализация по заказам этапа ({row.stageOrders.length}):
        </p>
        {row.stageOrders.length === 0 ? (
          <p className="text-[11px] text-[#111111]/70 dark:text-[#F4F3EF]/70">
            Расчёт по архивному нормативу · активных сделок на этапе нет.
          </p>
        ) : (
          <div className="space-y-1.5">
            {row.stageOrders.map((ord) => (
              <div key={ord.orderNumber} className="space-y-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-[#111111] dark:text-[#F4F3EF] truncate">
                    #{ord.orderNumber} · {ord.clientLabel}
                  </span>
                  <span className="font-bold text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap shrink-0">
                    {ord.dwellHours !== undefined
                      ? `${ord.dwellHours} ч`
                      : formatRubCompact(ord.budgetRub)}
                  </span>
                </div>
                <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72 truncate">
                  {ord.isActiveOnStage
                    ? 'сейчас на этапе'
                    : 'завершён переход'}{' '}
                  · {ord.formatSummary}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminStudioAnalyticsPanel({
  orders: externalOrders,
  isDark: isDarkProp,
  isRefreshingExternal = false,
  onRefreshOrders,
  onOpenOrdersFunnel,
}: AdminStudioAnalyticsPanelProps) {
  const [fetchedOrders, setFetchedOrders] = useState<CrmOrderRecord[]>([]);
  const [isLoadingInternal, setIsLoadingInternal] = useState<boolean>(
    externalOrders === undefined
  );
  const [isRefreshingInternal, setIsRefreshingInternal] =
    useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [periodMonths, setPeriodMonths] = useState<AnalyticsPeriodMonths>(6);
  const [segment, setSegment] = useState<AnalyticsSegmentFilter>('all');
  const [scope, setScope] = useState<AnalyticsDataScope>('crm_plus_archive');
  const [metricMode, setMetricMode] =
    useState<ConversionChartMetricMode>('orders');

  const [observedDark, setObservedDark] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    if (typeof isDarkProp === 'boolean' || typeof document === 'undefined') {
      return undefined;
    }
    const root = document.documentElement;
    const syncTheme = () => setObservedDark(root.classList.contains('dark'));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [isDarkProp]);

  const effectiveDark =
    typeof isDarkProp === 'boolean' ? isDarkProp : observedDark;

  const loadOrdersFromServer = useCallback(async (initial = false) => {
    if (initial) {
      setIsLoadingInternal(true);
    } else {
      setIsRefreshingInternal(true);
    }
    setLoadError(null);
    try {
      const res = await fetch('/api/cms/orders', {
        credentials: 'same-origin',
        headers: studioCmsStore.getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error('Не удалось загрузить данные заказов для аналитики');
      }
      const json = (await res.json()) as {
        ok: boolean;
        orders: CrmOrderRecord[];
      };
      setFetchedOrders(Array.isArray(json.orders) ? json.orders : []);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Ошибка соединения при загрузке аналитики CRM'
      );
    } finally {
      setIsLoadingInternal(false);
      setIsRefreshingInternal(false);
    }
  }, []);

  useEffect(() => {
    if (externalOrders !== undefined) {
      setIsLoadingInternal(false);
      setLoadError(null);
      return;
    }
    void loadOrdersFromServer(true);
  }, [externalOrders, loadOrdersFromServer]);

  const handleRefresh = useCallback(() => {
    if (externalOrders !== undefined && onRefreshOrders) {
      void onRefreshOrders();
      return;
    }
    void loadOrdersFromServer(false);
  }, [externalOrders, onRefreshOrders, loadOrdersFromServer]);

  const activeOrders = externalOrders ?? fetchedOrders;
  const isRefreshing =
    externalOrders !== undefined ? isRefreshingExternal : isRefreshingInternal;

  const summary = useMemo(
    () =>
      buildStudioAnalyticsSummary(activeOrders, {
        periodMonths,
        segment,
        scope,
      }),
    [activeOrders, periodMonths, segment, scope]
  );

  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [exportFeedback, setExportFeedback] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    setExportFeedback(null);
  }, [periodMonths, segment, scope, metricMode]);

  const handleExportCsv = useCallback(() => {
    try {
      const result = downloadStudioAnalyticsCsvReport(summary, {
        periodMonths,
        segment,
        scope,
      });
      setExportFeedback({
        kind: 'ok',
        text: `Отчёт CSV сформирован и скачан: ${result.fileName}`,
      });
    } catch (err) {
      setExportFeedback({
        kind: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Не удалось сформировать CSV-выгрузку аналитики',
      });
    }
  }, [summary, periodMonths, segment, scope]);

  const handleExportPdf = useCallback(() => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const result = downloadStudioAnalyticsPdfReport(
        summary,
        { periodMonths, segment, scope },
        metricMode
      );
      setExportFeedback({
        kind: 'ok',
        text: `Отчёт PDF (A4) сформирован и скачан: ${result.fileName}`,
      });
    } catch (err) {
      setExportFeedback({
        kind: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Не удалось сформировать PDF-отчёт аналитики',
      });
    } finally {
      setIsExportingPdf(false);
    }
  }, [isExportingPdf, summary, periodMonths, segment, scope, metricMode]);

  const bottleneckStage = useMemo(
    () => summary.stageEfficiency.find((item) => item.isBottleneck) ?? null,
    [summary.stageEfficiency]
  );

  // Семантические цвета графиков с учётом светлой/тёмной темы
  const gridStroke = effectiveDark
    ? 'rgba(244, 243, 239, 0.09)'
    : 'rgba(17, 17, 17, 0.09)';
  const axisTickColor = effectiveDark
    ? 'rgba(244, 243, 239, 0.74)'
    : 'rgba(17, 17, 17, 0.72)';
  const inquiriesBarFill = effectiveDark
    ? 'rgba(244, 243, 239, 0.24)'
    : 'rgba(17, 17, 17, 0.18)';
  const convertedBarFill = effectiveDark ? '#F4F3EF' : '#111111';
  const firstTakeStroke = effectiveDark ? '#60A5FA' : '#1D4ED8';
  const slaStroke = effectiveDark ? '#4ADE80' : '#166534';
  const slaKpiToneClass =
    summary.totals.slaCompliancePct >= 85
      ? 'text-[#166534] dark:text-[#4ADE80]'
      : summary.totals.slaCompliancePct >= 70
        ? 'text-[#92400E] dark:text-[#FBBF24]'
        : 'text-[#B91C1C] dark:text-[#F87171]';
  const slaKpiStatusNote =
    summary.totals.slaCompliancePct >= 85 ? 'SLA ≤ 15 мин' : 'цель ≥ 90%';

  if (isLoadingInternal) {
    return (
      <section
        aria-label="Загрузка аналитики студии"
        data-testid="studio-analytics-loading"
        className="space-y-6"
      >
        <div className="h-[62px] rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-[116px] rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 animate-pulse"
            />
          ))}
        </div>
        <div className="h-[390px] rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 animate-pulse" />
      </section>
    );
  }

  return (
    <section
      aria-label="Аналитика конверсии заказов и эффективности работы студии"
      data-testid="studio-analytics-panel"
      className="space-y-6 min-w-0"
    >
      {loadError && (
        <div
          role="alert"
          data-testid="studio-analytics-error"
          className="rounded-2xl bg-[#B91C1C]/10 border border-[#B91C1C]/30 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#B91C1C] dark:text-[#F87171]"
        >
          <span className="font-medium">{loadError}</span>
          <button
            type="button"
            onClick={() => void loadOrdersFromServer(false)}
            className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#141418] border border-[#B91C1C]/30 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#C83210] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Повторить запрос
          </button>
        </div>
      )}

      {/* Панель управления срезами аналитики */}
      <div
        data-testid="studio-analytics-controls"
        className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-4 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Горизонт расчёта */}
          <div
            role="group"
            aria-label="Горизонт расчёта по месяцам"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/8 dark:border-white/8"
          >
            <button
              type="button"
              data-testid="analytics-period-6"
              aria-pressed={periodMonths === 6}
              onClick={() => setPeriodMonths(6)}
              className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                periodMonths === 6
                  ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              6 месяцев
            </button>
            <button
              type="button"
              data-testid="analytics-period-12"
              aria-pressed={periodMonths === 12}
              onClick={() => setPeriodMonths(12)}
              className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                periodMonths === 12
                  ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              12 месяцев
            </button>
          </div>

          {/* Направление заказов */}
          <div>
            <label htmlFor="analytics-segment-select" className="sr-only">
              Направление заказов
            </label>
            <select
              id="analytics-segment-select"
              data-testid="analytics-segment-select"
              value={segment}
              onChange={(e) =>
                setSegment(e.target.value as AnalyticsSegmentFilter)
              }
              className="min-h-[40px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] cursor-pointer"
            >
              <option value="all">Все направления</option>
              <option value="production_only">Аудиопродакшн</option>
              <option value="air_plus_production">Эфир + продакшн</option>
            </select>
          </div>

          {/* Источник выборки */}
          <div>
            <label htmlFor="analytics-scope-select" className="sr-only">
              Охват данных
            </label>
            <select
              id="analytics-scope-select"
              data-testid="analytics-scope-select"
              value={scope}
              onChange={(e) => setScope(e.target.value as AnalyticsDataScope)}
              className="min-h-[40px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] cursor-pointer"
            >
              <option value="crm_plus_archive">Реестр CRM + архив</option>
              <option value="live_crm_only">Только живой реестр CRM</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="analytics-export-pdf-btn"
            disabled={summary.totals.totalOrders === 0 || isExportingPdf}
            onClick={handleExportPdf}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#111111] hover:bg-[#26262B] dark:bg-[#F4F3EF] dark:hover:bg-white disabled:opacity-45 text-white dark:text-[#0D0D0F] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-default whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{isExportingPdf ? 'Сборка PDF…' : 'Скачать PDF'}</span>
          </button>

          <button
            type="button"
            data-testid="analytics-export-csv-btn"
            disabled={summary.totals.totalOrders === 0}
            onClick={handleExportCsv}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] disabled:opacity-45 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-default whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet
              className="w-3.5 h-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>Скачать CSV</span>
          </button>

          {onOpenOrdersFunnel && (
            <button
              type="button"
              data-testid="analytics-open-funnel-btn"
              onClick={onOpenOrdersFunnel}
              className="min-h-[40px] px-3 py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:border-[#FF4820] hover:text-[#111111] dark:hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>К сделкам CRM ({activeOrders.length})</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </button>
          )}

          {externalOrders === undefined && (
            <button
              type="button"
              data-testid="analytics-refresh-btn"
              aria-label="Обновить данные аналитики"
              title="Обновить данные аналитики"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="min-h-[40px] w-[40px] rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:border-[#FF4820] hover:text-[#111111] dark:hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${
                  isRefreshing ? 'animate-spin' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </div>

      {exportFeedback && (
        <div
          role={exportFeedback.kind === 'error' ? 'alert' : 'status'}
          data-testid="studio-analytics-export-status"
          className={`rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs tabular-nums ${
            exportFeedback.kind === 'error'
              ? 'bg-[#B91C1C]/10 border border-[#B91C1C]/30 text-[#B91C1C] dark:text-[#F87171]'
              : 'bg-white dark:bg-[#141418] border border-[#166534]/30 dark:border-[#4ADE80]/30 text-[#111111] dark:text-[#F4F3EF]'
          }`}
        >
          <span className="inline-flex items-center gap-2 font-medium">
            {exportFeedback.kind === 'ok' && (
              <CheckCircle2
                className="w-4 h-4 shrink-0 text-[#166534] dark:text-[#4ADE80]"
                aria-hidden="true"
              />
            )}
            <span>{exportFeedback.text}</span>
          </span>
          <button
            type="button"
            aria-label="Скрыть уведомление об экспорте"
            onClick={() => setExportFeedback(null)}
            className="min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Скрыть
          </button>
        </div>
      )}

      {/* Сводные KPI-карточки (одноуровневая плоскость без пилюль и вложенных рамок) */}
      <div
        data-testid="studio-analytics-kpi-grid"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 space-y-2">
          <p className="text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72">
            Конверсия в сделку
          </p>
          <p
            data-testid="kpi-conversion-pct"
            className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] tabular-nums"
          >
            {summary.totals.overallConversionPct}%
          </p>
          <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 tabular-nums">
            {summary.totals.convertedOrders} из {summary.totals.totalOrders}{' '}
            заявок · горизонт {periodMonths} мес.
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 space-y-2">
          <p className="text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72">
            Объём подтверждённых заказов
          </p>
          <p
            data-testid="kpi-confirmed-revenue"
            className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] tabular-nums"
          >
            {formatRubCompact(summary.totals.confirmedRevenueRub)}
          </p>
          <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 tabular-nums">
            Средний чек {formatNumberSpaced(summary.totals.avgOrderValueRub)} ₽ ·{' '}
            сдано {summary.totals.deliveredOrders}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 space-y-2">
          <p className="text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72">
            Соблюдение SLA первого ответа
          </p>
          <p
            data-testid="kpi-sla-compliance"
            className={`text-2xl sm:text-[28px] font-bold tracking-tight tabular-nums ${slaKpiToneClass}`}
          >
            {summary.totals.slaCompliancePct}%
          </p>
          <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 tabular-nums">
            Отклик {summary.totals.avgFirstResponseMin} мин · {slaKpiStatusNote}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 space-y-2">
          <p className="text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72">
            Сдача роликов с 1-го дубля
          </p>
          <p
            data-testid="kpi-first-take-pct"
            className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] tabular-nums"
          >
            {summary.totals.firstTakeApprovalPct}%
          </p>
          <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 tabular-nums">
            Средний цикл этапов 01–04: {summary.totals.avgProductionCycleHours} ч
          </p>
        </div>
      </div>

      {summary.totals.totalOrders === 0 ? (
        <div
          data-testid="studio-analytics-empty"
          className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-8 text-center space-y-3"
        >
          <h3 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
            По выбранному срезу нет зарегистрированных заказов
          </h3>
          <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 max-w-md mx-auto">
            В выбранном сегменте или периоде отсутствуют сделки. Включите архив
            закрытых периодов или сбросьте фильтр направления.
          </p>
          <div>
            <button
              type="button"
              onClick={() => {
                setSegment('all');
                setScope('crm_plus_archive');
              }}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#C83210] hover:bg-[#AE2A0C] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Сбросить срез и подключить архив
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ГРАФИК 1: Помесячная конверсия заказов и объём сделок */}
          <div
            data-testid="chart-monthly-conversion"
            className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 space-y-5 min-w-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                  01. Динамика и конверсия заказов по месяцам
                </h2>
                <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  Соотношение входящих обращений, подтверждённых договоров-счетов
                  и процента конверсии по месяцам (UTC+3)
                </p>
              </div>

              <div
                role="group"
                aria-label="Режим отображения шкалы объёма"
                className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/8 dark:border-white/8 shrink-0"
              >
                <button
                  type="button"
                  data-testid="analytics-metric-orders"
                  aria-pressed={metricMode === 'orders'}
                  onClick={() => setMetricMode('orders')}
                  className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    metricMode === 'orders'
                      ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                      : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-white'
                  }`}
                >
                  Заявки и конверсия
                </button>
                <button
                  type="button"
                  data-testid="analytics-metric-revenue"
                  aria-pressed={metricMode === 'revenue'}
                  onClick={() => setMetricMode('revenue')}
                  className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    metricMode === 'revenue'
                      ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                      : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-white'
                  }`}
                >
                  Выручка и конверсия
                </button>
              </div>
            </div>

            {/* Текстовая легенда графика с графическими штрихами серий */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#111111]/74 dark:text-[#F4F3EF]/74">
              {metricMode === 'orders' ? (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <svg width="12" height="8" aria-hidden="true">
                      <rect
                        width="12"
                        height="8"
                        rx="2"
                        fill={inquiriesBarFill}
                      />
                    </svg>
                    <span>Поступило заявок (шт.)</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <svg width="12" height="8" aria-hidden="true">
                      <rect
                        width="12"
                        height="8"
                        rx="2"
                        fill={convertedBarFill}
                      />
                    </svg>
                    <span>Подтверждено в сделку (шт.)</span>
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <svg width="12" height="8" aria-hidden="true">
                    <rect
                      width="12"
                      height="8"
                      rx="2"
                      fill={convertedBarFill}
                    />
                  </svg>
                  <span>Объём подтверждённых заказов (тыс. ₽)</span>
                </span>
              )}
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-[#B82D0D] dark:text-[#FF7A5C]">
                <svg width="16" height="8" aria-hidden="true">
                  <line
                    x1="0"
                    y1="4"
                    x2="16"
                    y2="4"
                    stroke="#C83210"
                    strokeWidth="2.5"
                  />
                </svg>
                <span>Конверсия в сделку (%, правая шкала)</span>
              </span>
            </div>

            <div className="h-[300px] w-full min-w-0">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={240}
                minHeight={220}
              >
                <ComposedChart
                  data={summary.months}
                  margin={{ top: 14, right: 12, left: -10, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={gridStroke}
                  />
                  <XAxis
                    dataKey="monthLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: axisTickColor, fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="left"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: axisTickColor, fontSize: 11 }}
                    tickFormatter={(val: number) =>
                      metricMode === 'revenue' ? `${val}к` : String(val)
                    }
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: effectiveDark ? '#FF7A5C' : '#B82D0D',
                      fontSize: 11,
                    }}
                    tickFormatter={(val: number) => `${val}%`}
                  />
                  <Tooltip
                    isAnimationActive={false}
                    offset={14}
                    cursor={{
                      fill: effectiveDark
                        ? 'rgba(244, 243, 239, 0.05)'
                        : 'rgba(17, 17, 17, 0.04)',
                    }}
                    content={(props) => (
                      <ConversionChartTooltip
                        active={props.active}
                        payload={
                          props.payload as
                            | readonly TooltipPayloadEntry<MonthlyConversionPoint>[]
                            | undefined
                        }
                        metricMode={metricMode}
                      />
                    )}
                  />
                  {metricMode === 'orders' ? (
                    <>
                      <Bar
                        yAxisId="left"
                        dataKey="totalOrders"
                        name="Поступило заявок"
                        fill={inquiriesBarFill}
                        activeBar={{
                          fill: effectiveDark
                            ? 'rgba(244, 243, 239, 0.42)'
                            : 'rgba(17, 17, 17, 0.34)',
                        }}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={26}
                        isAnimationActive={false}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="convertedOrders"
                        name="В сделке и продакшне"
                        fill={convertedBarFill}
                        activeBar={{ fillOpacity: 0.82 }}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={26}
                        isAnimationActive={false}
                      />
                    </>
                  ) : (
                    <Bar
                      yAxisId="left"
                      dataKey="revenueThousandsRub"
                      name="Объём сделок (тыс. ₽)"
                      fill={convertedBarFill}
                      activeBar={{ fillOpacity: 0.82 }}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                      isAnimationActive={false}
                    />
                  )}
                  <Line
                    yAxisId="right"
                    type="linear"
                    dataKey="conversionPct"
                    name="Конверсия (%)"
                    stroke="#FF4820"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#FF4820', strokeWidth: 0 }}
                    activeDot={{
                      r: 6,
                      fill: '#FF4820',
                      stroke: effectiveDark ? '#141418' : '#FFFFFF',
                      strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ВТОРОЙ РЯД: 2 графика эффективности работы студии (7 + 5 колонок) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-w-0">
            {/* ГРАФИК 2: Качество SLA и сдача с первого дубля */}
            <div
              data-testid="chart-studio-efficiency"
              className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 flex flex-col justify-between gap-4 min-w-0"
            >
              <div className="space-y-3">
                <div className="space-y-1">
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                    02. Эффективность работы студии по месяцам
                  </h2>
                  <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                    Динамика соблюдения регламента ответа продюсера (≤ 15 мин) и
                    согласования аудиороликов без текстовых переделок
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#111111]/74 dark:text-[#F4F3EF]/74">
                  <span className="inline-flex items-center gap-1.5 font-medium text-[#166534] dark:text-[#4ADE80]">
                    <svg width="16" height="8" aria-hidden="true">
                      <line
                        x1="0"
                        y1="4"
                        x2="16"
                        y2="4"
                        stroke={slaStroke}
                        strokeWidth="2.5"
                      />
                    </svg>
                    <span>Соблюдение SLA ≤ 15 мин (%)</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-[#1D4ED8] dark:text-[#60A5FA]">
                    <svg width="16" height="8" aria-hidden="true">
                      <line
                        x1="0"
                        y1="4"
                        x2="16"
                        y2="4"
                        stroke={firstTakeStroke}
                        strokeWidth="2.5"
                      />
                    </svg>
                    <span>Сдача с 1-го дубля (%)</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Целевой порог SLA: 90%</span>
                </div>
              </div>

              <div className="h-[272px] w-full min-w-0">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={220}
                  minHeight={210}
                >
                  <AreaChart
                    data={summary.months}
                    margin={{ top: 14, right: 12, left: -12, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={gridStroke}
                    />
                    <XAxis
                      dataKey="monthLabel"
                      padding={{ left: 18, right: 18 }}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: axisTickColor, fontSize: 11 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: axisTickColor, fontSize: 11 }}
                      tickFormatter={(val: number) => `${val}%`}
                    />
                    <ReferenceLine
                      y={90}
                      stroke={slaStroke}
                      strokeDasharray="4 4"
                      strokeOpacity={0.45}
                    />
                    <Tooltip
                      isAnimationActive={false}
                      offset={14}
                      content={(props) => (
                        <EfficiencyChartTooltip
                          active={props.active}
                          payload={
                            props.payload as
                              | readonly TooltipPayloadEntry<MonthlyConversionPoint>[]
                              | undefined
                          }
                        />
                      )}
                    />
                    <Area
                      type="linear"
                      dataKey="slaCompliancePct"
                      name="Соблюдение SLA ≤ 15 мин"
                      stroke={slaStroke}
                      strokeWidth={2.5}
                      fill={slaStroke}
                      fillOpacity={0.12}
                      dot={{ r: 3.5, fill: slaStroke, strokeWidth: 0 }}
                      activeDot={{
                        r: 5.5,
                        fill: slaStroke,
                        stroke: effectiveDark ? '#141418' : '#FFFFFF',
                        strokeWidth: 2,
                      }}
                      isAnimationActive={false}
                    />
                    <Area
                      type="linear"
                      dataKey="firstTakeApprovalPct"
                      name="Сдача с 1-го дубля"
                      stroke={firstTakeStroke}
                      strokeWidth={2.2}
                      fill={firstTakeStroke}
                      fillOpacity={0.07}
                      dot={{ r: 3.5, fill: firstTakeStroke, strokeWidth: 0 }}
                      activeDot={{
                        r: 5.5,
                        fill: firstTakeStroke,
                        stroke: effectiveDark ? '#141418' : '#FFFFFF',
                        strokeWidth: 2,
                      }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ГРАФИК 3: Длительность прохождения этапов воронки (01–05) */}
            <div
              data-testid="chart-stage-dwell"
              className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 flex flex-col justify-between gap-4 min-w-0"
            >
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                  03. Скорость этапов воронки (ч)
                </h2>
                <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  Среднее время пребывания сделки на этапах 01–05 по журналу
                  перемещений заказов
                </p>
              </div>

              <div className="h-[268px] w-full min-w-0">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={200}
                  minHeight={210}
                >
                  <BarChart
                    data={summary.stageEfficiency}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: -8, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke={gridStroke}
                    />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: axisTickColor, fontSize: 11 }}
                      tickFormatter={(val: number) => `${val} ч`}
                    />
                    <YAxis
                      type="category"
                      dataKey="stepCode"
                      width={36}
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: axisTickColor,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    />
                    <Tooltip
                      isAnimationActive={false}
                      offset={14}
                      cursor={{
                        fill: effectiveDark
                          ? 'rgba(244, 243, 239, 0.05)'
                          : 'rgba(17, 17, 17, 0.04)',
                      }}
                      content={(props) => (
                        <StageDwellChartTooltip
                          active={props.active}
                          payload={
                            props.payload as
                              | readonly TooltipPayloadEntry<StageEfficiencyPoint>[]
                              | undefined
                          }
                        />
                      )}
                    />
                    <Bar
                      dataKey="avgDurationHours"
                      name="Среднее время (ч)"
                      barSize={20}
                      activeBar={{ fillOpacity: 0.84 }}
                      radius={[0, 4, 4, 0]}
                      isAnimationActive={false}
                    >
                      {summary.stageEfficiency.map((entry) => (
                        <Cell
                          key={entry.stageId}
                          fill={
                            entry.isBottleneck ? '#FF4820' : convertedBarFill
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="pt-3 border-t border-[#111111]/8 dark:border-white/8 text-xs text-[#111111]/74 dark:text-[#F4F3EF]/74 space-y-1 tabular-nums">
                {bottleneckStage ? (
                  <p>
                    <span className="font-semibold text-[#B82D0D] dark:text-[#FF7A5C]">
                      Узкое место цикла:
                    </span>{' '}
                    {bottleneckStage.stageLabel} ·{' '}
                    <strong className="text-[#111111] dark:text-[#F4F3EF]">
                      {bottleneckStage.avgDurationHours} ч
                    </strong>{' '}
                    в среднем
                  </p>
                ) : (
                  <p>Переходы по этапам укладываются в плановый норматив.</p>
                )}
                <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  Этапы: 01 Приём · 02 ТЗ и квота · 03 Счёт ЭДО · 04 Продакшн ·
                  05 Сдача и эфир
                </p>
              </div>
            </div>
          </div>

          {/* ТАБЛИЧНАЯ ВЕДОМОСТЬ ПО МЕСЯЦАМ */}
          <div
            data-testid="studio-analytics-monthly-table"
            className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 overflow-hidden"
          >
            <div className="px-5 sm:px-6 py-4 border-b border-[#111111]/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                Помесячная ведомость конверсии и SLA студии
              </h2>
              <span className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 tabular-nums">
                Часовой пояс расчёта: UTC+3 · строк: {summary.months.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse tabular-nums">
                <thead>
                  <tr className="border-b border-[#111111]/10 dark:border-white/10 text-[#111111]/72 dark:text-[#F4F3EF]/72">
                    <th
                      scope="col"
                      className="py-2.5 px-5 sm:px-6 font-semibold whitespace-nowrap"
                    >
                      Период
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 px-3 font-semibold text-right whitespace-nowrap"
                    >
                      Заявки
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 px-3 font-semibold text-right whitespace-nowrap"
                    >
                      В сделке
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 px-3 font-semibold text-right whitespace-nowrap"
                    >
                      Сдано
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 px-3 font-semibold text-right whitespace-nowrap"
                    >
                      Конверсия
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 px-3 font-semibold text-right whitespace-nowrap"
                    >
                      Объём сделок
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 px-3 font-semibold text-right whitespace-nowrap"
                    >
                      Отклик SLA
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 px-5 sm:px-6 font-semibold text-right whitespace-nowrap"
                    >
                      С 1-го дубля
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#111111]/8 dark:divide-white/8">
                  {summary.months.map((row) => (
                    <tr
                      key={row.monthKey}
                      className="h-[40px] hover:bg-[#F7F6F2]/75 dark:hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="py-2 px-5 sm:px-6 font-semibold text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap">
                        {row.monthFullLabel}
                      </td>
                      <td className="py-2 px-3 text-right text-[#111111]/80 dark:text-[#F4F3EF]/80 whitespace-nowrap">
                        {row.totalOrders}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap">
                        {row.convertedOrders}
                      </td>
                      <td className="py-2 px-3 text-right text-[#111111]/80 dark:text-[#F4F3EF]/80 whitespace-nowrap">
                        {row.deliveredOrders}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-[#B82D0D] dark:text-[#FF7A5C] whitespace-nowrap">
                        {row.conversionPct}%
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap">
                        {formatNumberSpaced(row.revenueRub)} ₽
                      </td>
                      <td className="py-2 px-3 text-right text-[#111111]/80 dark:text-[#F4F3EF]/80 whitespace-nowrap">
                        {row.totalOrders > 0
                          ? `${row.avgFirstResponseMin} мин (${row.slaCompliancePct}%)`
                          : '—'}
                      </td>
                      <td className="py-2 px-5 sm:px-6 text-right font-medium text-[#166534] dark:text-[#4ADE80] whitespace-nowrap">
                        {row.convertedOrders > 0
                          ? `${row.firstTakeApprovalPct}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
