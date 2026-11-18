import { Check, Copy, Download, FileSpreadsheet, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  buildAccountingLedgerCsv,
  buildAccountingLedgerPlainText,
  buildAccountingReconciliationSummary,
  CABINET_EXPORT_PERIOD_LABELS,
  type CabinetExportPeriodId,
  extractOrderMasterFiles,
  filterOrdersByExportPeriod,
  resolveCabinetOrderVisualStatus,
  stripTrailingPriceFromOrderTitle,
} from '../../data/clientCabinetArchitecture';
import type { ClientCabinetOrderSummary } from '../../data/clientCabinetHelpers';
import { formatRubCompact } from '../../data/radioInventory';
import type { BrandedDocumentKind } from '../../data/studioDocumentsCore';

export interface CabinetAccountingExportPanelProps {
  orders: readonly ClientCabinetOrderSummary[];
  onOpenDocumentModal: (
    order: ClientCabinetOrderSummary,
    initialDoc?: BrandedDocumentKind
  ) => void;
  onClose: () => void;
}

const PERIOD_OPTIONS: readonly CabinetExportPeriodId[] = ['all', 'quarter', 'year'];

function formatShortRuDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function CabinetAccountingExportPanel({
  orders,
  onOpenDocumentModal,
  onClose,
}: CabinetAccountingExportPanelProps) {
  const [period, setPeriod] = useState<CabinetExportPeriodId>('all');
  const [copiedLedger, setCopiedLedger] = useState(false);
  const [downloadedCsv, setDownloadedCsv] = useState(false);

  const filteredOrders = useMemo(
    () => filterOrdersByExportPeriod(orders, period),
    [orders, period]
  );

  const summary = useMemo(
    () => buildAccountingReconciliationSummary(filteredOrders),
    [filteredOrders]
  );

  const handleDownloadCsv = () => {
    const csv = buildAccountingLedgerCsv(filteredOrders);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fmworks-reestr-${period}-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloadedCsv(true);
    window.setTimeout(() => setDownloadedCsv(false), 2400);
  };

  const handleCopyPlainText = async () => {
    const text = buildAccountingLedgerPlainText(
      filteredOrders,
      CABINET_EXPORT_PERIOD_LABELS[period]
    );
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedLedger(true);
      window.setTimeout(() => setCopiedLedger(false), 2400);
    } catch {
      setCopiedLedger(true);
      window.setTimeout(() => setCopiedLedger(false), 2400);
    }
  };

  return (
    <section
      data-testid="cabinet-accounting-export-panel"
      aria-label="Реестр заказов для бухгалтерии"
      className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5 border-b border-[#111111]/10 dark:border-white/10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileSpreadsheet
              className="w-4 h-4 text-[#C83210] dark:text-[#FF6B47] shrink-0"
              aria-hidden="true"
            />
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
              Реестр заказов для бухгалтерии
            </h2>
          </div>
          <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
            Сверка счетов, сумм и готовности закрывающих актов за период — выгрузка в Excel (CSV) или текстом в один клик.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть реестр для бухгалтерии"
          className="min-h-[34px] px-2 text-xs font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#111111] dark:hover:text-[#F4F3EF] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
        >
          <X className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Скрыть</span>
        </button>
      </div>

      {/* Выбор отчётного периода и сводные цифры */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Отчётный период реестра"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#EFECE5]/80 dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 self-start"
        >
          {PERIOD_OPTIONS.map((opt) => {
            const active = period === opt;
            return (
              <button
                key={opt}
                type="button"
                data-testid={`accounting-period-${opt}`}
                aria-pressed={active}
                onClick={() => setPeriod(opt)}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                  active
                    ? 'bg-white dark:bg-[#141418] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/12 dark:border-white/14'
                    : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                }`}
              >
                {CABINET_EXPORT_PERIOD_LABELS[opt]}
              </button>
            );
          })}
        </div>

        <div
          data-testid="accounting-summary-totals"
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums text-[#111111]/76 dark:text-[#F4F3EF]/76"
        >
          <span>
            Проектов:{' '}
            <strong className="text-[#111111] dark:text-[#F4F3EF]">
              {summary.ordersCount}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Итого:{' '}
            <strong className="text-[#111111] dark:text-[#F4F3EF]">
              {formatRubCompact(summary.totalBudgetRub)}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            С актами:{' '}
            <strong className="text-[#166534] dark:text-[#4ADE80]">
              {summary.readyDocsCount}
            </strong>
          </span>
        </div>
      </div>

      {/* Таблица сверки */}
      {filteredOrders.length === 0 ? (
        <div className="py-5 text-center text-xs text-[#111111]/70 dark:text-[#F4F3EF]/70 border-t border-b border-[#111111]/10 dark:border-white/10">
          За выбранный период («{CABINET_EXPORT_PERIOD_LABELS[period]}») заказов нет — переключите на «Все проекты».
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-b border-[#111111]/10 dark:border-white/10">
          <table className="w-full text-left border-collapse text-xs tabular-nums">
            <thead>
              <tr className="border-b border-[#111111]/10 dark:border-white/10 text-[11px] font-semibold text-[#111111]/64 dark:text-[#F4F3EF]/64">
                <th className="py-2.5 pr-3 font-semibold whitespace-nowrap">Заказ</th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Дата</th>
                <th className="py-2.5 px-3 font-semibold">Услуга и плательщик</th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Статус и акты</th>
                <th className="py-2.5 pl-3 text-right font-semibold whitespace-nowrap">Сумма</th>
                <th className="py-2.5 pl-3 text-right font-semibold whitespace-nowrap">Пакет</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#111111]/8 dark:divide-white/8">
              {filteredOrders.map((order) => {
                const cleanTitle = stripTrailingPriceFromOrderTitle(
                  order.formatLabel,
                  order.totalBudgetRub
                );
                const visual = resolveCabinetOrderVisualStatus(order);
                const { masterFiles } = extractOrderMasterFiles(order);
                const isReady =
                  order.stage === 'on_air' ||
                  order.stage === 'completed_ltv' ||
                  order.approvalWorkflow?.phase === 'accepted' ||
                  masterFiles.length > 0;

                return (
                  <tr
                    key={order.orderNumber}
                    data-testid={`accounting-ledger-row-${order.orderNumber}`}
                  >
                    <td className="py-2.5 pr-3 font-mono font-bold text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap">
                      #{order.orderNumber}
                    </td>
                    <td className="py-2.5 px-3 text-[#111111]/74 dark:text-[#F4F3EF]/74 whitespace-nowrap">
                      {formatShortRuDate(order.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 min-w-[200px]">
                      <p className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                        {cleanTitle}
                      </p>
                      <p className="text-[11px] text-[#111111]/68 dark:text-[#F4F3EF]/68 truncate max-w-[320px]">
                        {order.companyOrInn || 'Реквизиты не указаны'}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[#111111]/82 dark:text-[#F4F3EF]/82">
                        {visual.label}
                      </span>
                      <span aria-hidden="true" className="mx-1 text-[#111111]/40 dark:text-[#F4F3EF]/40">
                        ·
                      </span>
                      <span
                        className={
                          isReady
                            ? 'font-semibold text-[#166534] dark:text-[#4ADE80]'
                            : 'text-[#111111]/66 dark:text-[#F4F3EF]/66'
                        }
                      >
                        {isReady ? 'Акт готов' : 'Счёт и договор'}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right font-semibold text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap">
                      {order.totalBudgetRub > 0
                        ? formatRubCompact(order.totalBudgetRub)
                        : 'Договорная'}
                    </td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenDocumentModal(order, isReady ? 'act' : 'invoice')
                        }
                        className="text-xs font-semibold text-[#C83210] dark:text-[#FF6B47] hover:underline cursor-pointer"
                      >
                        {isReady ? 'Акт и счёт' : 'Счёт'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Действия экспорта */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={filteredOrders.length === 0}
            data-testid="accounting-export-csv-btn"
            onClick={handleDownloadCsv}
            className="min-h-[40px] sm:min-h-[38px] px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#C83210] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
          >
            {downloadedCsv ? (
              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              {downloadedCsv ? 'Файл CSV скачан' : 'Скачать CSV (Excel)'}
            </span>
          </button>

          <button
            type="button"
            disabled={filteredOrders.length === 0}
            data-testid="accounting-copy-ledger-btn"
            onClick={() => void handleCopyPlainText()}
            className="min-h-[40px] sm:min-h-[38px] px-3.5 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
          >
            {copiedLedger ? (
              <Check
                className="w-3.5 h-3.5 text-[#166534] dark:text-[#4ADE80] shrink-0"
                aria-hidden="true"
              />
            ) : (
              <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>
              {copiedLedger ? 'Ведомость скопирована' : 'Скопировать ведомость'}
            </span>
          </button>
        </div>

        <span className="text-[11px] text-[#111111]/64 dark:text-[#F4F3EF]/64">
          Формат CSV (UTF-8 BOM, разделитель «;») открывается в Excel без искажения кириллицы
        </span>
      </div>
    </section>
  );
}
