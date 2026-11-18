import {
  Archive,
  ArchiveRestore,
  ArrowDownRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Repeat,
  Search,
  X,
} from 'lucide-react';
import {
  buildDeliverableDownloadUrls,
  buildOrderAudioVersionHistory,
  type CabinetHistoryStatusFilter,
  type CabinetHistoryVisualStatusId,
  extractOrderMasterFiles,
  isCompletedHistoryOrder,
  isCompletedOrderOlderThanSixMonths,
  isOrderCompletedAndPaid,
  resolveCabinetOrderVisualStatus,
  stripTrailingPriceFromOrderTitle,
} from '../../data/clientCabinetArchitecture';
import {
  type ClientCabinetOrderSummary,
  formatFileSizeReadable,
  type OrderDeliverableFile,
} from '../../data/clientCabinetHelpers';
import { formatRubCompact } from '../../data/radioInventory';
import type { BrandedDocumentKind } from '../../data/studioDocumentsCore';
import { CabinetAudioVersionHistory } from './CabinetAudioVersionHistory';

const SUPPLEMENTARY_KIND_LABELS: Record<OrderDeliverableFile['kind'], string> = {
  audio_master: 'Мастер WAV',
  script: 'Сценарий',
  invoice: 'Счёт / документы',
  passport: 'Паспорт прав',
  archive: 'Архив',
};

function formatHistoryDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function renderVisualStatusInline(
  statusId: CabinetHistoryVisualStatusId,
  label: string
) {
  if (statusId === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-[#166534] dark:text-[#4ADE80]">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  if (statusId === 'in_review') {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-[#B45309] dark:text-[#FBBF24]">
        <ClipboardCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-[#C83210] dark:text-[#FF6B47]">
      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export interface CabinetOrderHistorySectionProps {
  totalHistoryOrdersCount: number;
  inWorkCount: number;
  inReviewCount: number;
  readyCount: number;
  totalHistoryMastersCount: number;
  filteredHistoryOrders: readonly ClientCabinetOrderSummary[];
  statusFilter: CabinetHistoryStatusFilter;
  onChangeStatusFilter: (next: CabinetHistoryStatusFilter) => void;
  searchQuery: string;
  onChangeSearchQuery: (value: string) => void;
  onlyWithMasters: boolean;
  onToggleOnlyWithMasters: () => void;
  hideOlderThanSixMonths?: boolean;
  onToggleHideOlderThanSixMonths?: () => void;
  showArchivedOnly?: boolean;
  onToggleShowArchivedOnly?: () => void;
  completedOlderThanSixMonthsCount?: number;
  manuallyArchivedCount?: number;
  hiddenByArchiveCount?: number;
  manuallyArchivedOrderNumbers?: readonly string[];
  onToggleManualArchiveOrder?: (orderNumber: string) => void;
  onResetFilters: () => void;
  onOpenDocumentModal: (
    order: ClientCabinetOrderSummary,
    initialDoc?: BrandedDocumentKind
  ) => void;
  onRepeatOrder: (order: ClientCabinetOrderSummary) => void;
  onManageActiveOrder?: (orderNumber: string) => void;
}

export function CabinetOrderHistorySection({
  totalHistoryOrdersCount,
  inWorkCount,
  inReviewCount,
  readyCount,
  totalHistoryMastersCount,
  filteredHistoryOrders,
  statusFilter,
  onChangeStatusFilter,
  searchQuery,
  onChangeSearchQuery,
  onlyWithMasters,
  onToggleOnlyWithMasters,
  hideOlderThanSixMonths = false,
  onToggleHideOlderThanSixMonths,
  showArchivedOnly = false,
  onToggleShowArchivedOnly,
  completedOlderThanSixMonthsCount = 0,
  manuallyArchivedCount = 0,
  hiddenByArchiveCount = 0,
  manuallyArchivedOrderNumbers = [],
  onToggleManualArchiveOrder,
  onResetFilters,
  onOpenDocumentModal,
  onRepeatOrder,
  onManageActiveOrder,
}: CabinetOrderHistorySectionProps) {
  const manualArchiveSet = new Set(manuallyArchivedOrderNumbers);
  const totalArchivableItems =
    completedOlderThanSixMonthsCount + manuallyArchivedCount;
  const hasActiveFilter =
    Boolean(searchQuery.trim()) ||
    onlyWithMasters ||
    statusFilter !== 'all' ||
    showArchivedOnly ||
    hideOlderThanSixMonths ||
    manualArchiveSet.size > 0;

  const showSubStatusTabs = inWorkCount > 0 || inReviewCount > 0;
  const statusFilterItems: readonly {
    id: CabinetHistoryStatusFilter;
    label: string;
  }[] = [
    { id: 'all', label: `Все (${totalHistoryOrdersCount})` },
    { id: 'in_work', label: `В работе (${inWorkCount})` },
    { id: 'in_review', label: `На согласовании (${inReviewCount})` },
    { id: 'ready', label: `Готово (${readyCount})` },
  ];

  return (
    <section
      id="cabinet-history"
      data-testid="cabinet-order-history-section"
      aria-labelledby="cabinet-history-heading"
      className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 divide-y divide-[#111111]/10 dark:divide-white/10"
    >
      {/* Шапка раздела «История завершённых заказов» */}
      <div className="p-5 sm:p-7 space-y-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72 tabular-nums">
            <span>Завершено проектов: {totalHistoryOrdersCount}</span>
            <span aria-hidden="true">·</span>
            <span>Мастер-файлов WAV: {totalHistoryMastersCount}</span>
            {completedOlderThanSixMonthsCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>Старше 6 мес.: {completedOlderThanSixMonthsCount}</span>
              </>
            )}
            {manuallyArchivedCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>В ручном архиве: {manuallyArchivedCount}</span>
              </>
            )}
          </div>

          <h2
            id="cabinet-history-heading"
            className="text-xl sm:text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]"
          >
            История завершённых заказов и мастер-файлы
          </h2>
          <p className="text-xs sm:text-sm text-[#111111]/74 dark:text-[#F4F3EF]/74 max-w-2xl leading-relaxed">
            Архив сданных проектов с доступом ко всем итерациям аудиоролика (v1, v2, master WAV −14 LUFS), закрывающим актам сдачи-приёмки, паспортам прав РАО/ВОИС и повтором заказа в 1 клик.
          </p>
        </div>

        {totalHistoryOrdersCount > 0 && (
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-1">
            {showSubStatusTabs ? (
              <div
                role="group"
                aria-label="Фильтр по статусу проектов"
                className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 self-start"
              >
                {statusFilterItems.map((item) => {
                  const active = statusFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={active}
                      data-testid={`cabinet-history-status-filter-${item.id}`}
                      onClick={() => onChangeStatusFilter(item.id)}
                      className={`min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                        active
                          ? 'bg-white dark:bg-[#141418] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/12 dark:border-white/14'
                          : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Поиск, фильтр мастер-файлов и управление архивом */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full xl:w-auto">
              <div className="relative flex-1 sm:w-72">
                <label htmlFor="cabinet-history-search" className="sr-only">
                  Поиск по завершённым проектам и мастер-файлам
                </label>
                <Search
                  className="w-4 h-4 text-[#111111]/60 dark:text-[#F4F3EF]/60 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="cabinet-history-search"
                  type="search"
                  data-testid="cabinet-history-search-input"
                  value={searchQuery}
                  onChange={(e) => onChangeSearchQuery(e.target.value)}
                  placeholder="Номер, ИНН, версия (v1, master) или файл…"
                  className="w-full min-h-[44px] sm:min-h-[40px] pl-9 pr-10 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 focus:border-[#FF4820] focus:outline-none text-xs sm:text-sm text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/60 dark:placeholder:text-[#F4F3EF]/60 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Очистить поисковый запрос"
                    onClick={() => onChangeSearchQuery('')}
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#111111] dark:hover:text-[#F4F3EF] cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              <button
                type="button"
                aria-pressed={onlyWithMasters}
                data-testid="cabinet-history-masters-only-btn"
                onClick={onToggleOnlyWithMasters}
                className={`min-h-[44px] sm:min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                  onlyWithMasters
                    ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:border-[#F4F3EF]'
                    : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/82 dark:text-[#F4F3EF]/82 border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820]'
                }`}
              >
                Только с мастер-файлами
              </button>

              {onToggleHideOlderThanSixMonths && completedOlderThanSixMonthsCount > 0 && !showArchivedOnly && (
                <button
                  type="button"
                  aria-pressed={hideOlderThanSixMonths}
                  data-testid="cabinet-history-hide-older-6m-btn"
                  onClick={onToggleHideOlderThanSixMonths}
                  className={`min-h-[44px] sm:min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                    hideOlderThanSixMonths
                      ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:border-[#F4F3EF]'
                      : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/82 dark:text-[#F4F3EF]/82 border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820]'
                  }`}
                >
                  <Archive className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {hideOlderThanSixMonths
                      ? `Скрыты > 6 мес. (${completedOlderThanSixMonthsCount})`
                      : `Скрыть > 6 мес. (${completedOlderThanSixMonthsCount})`}
                  </span>
                </button>
              )}

              {onToggleShowArchivedOnly && (totalArchivableItems > 0 || showArchivedOnly) && (
                <button
                  type="button"
                  aria-pressed={showArchivedOnly}
                  data-testid="cabinet-history-archive-view-btn"
                  onClick={onToggleShowArchivedOnly}
                  className={`min-h-[44px] sm:min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                    showArchivedOnly
                      ? 'bg-[#C83210] text-white border-[#C83210]'
                      : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/82 dark:text-[#F4F3EF]/82 border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820]'
                  }`}
                >
                  <ArchiveRestore className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {showArchivedOnly
                      ? 'Выйти из архива'
                      : `Архив (${hiddenByArchiveCount > 0 ? hiddenByArchiveCount : totalArchivableItems})`}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Уведомление о скрытых архивных проектах (> 6 мес. или скрытых вручную) */}
        {!showArchivedOnly && hiddenByArchiveCount > 0 && (
          <div
            data-testid="cabinet-history-archive-banner"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-xs"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[#111111]/78 dark:text-[#F4F3EF]/78 tabular-nums">
              <Archive
                className="w-3.5 h-3.5 text-[#111111]/68 dark:text-[#F4F3EF]/68 shrink-0"
                aria-hidden="true"
              />
              <span>
                В архиве скрыто завершённых проектов:{' '}
                <strong className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                  {hiddenByArchiveCount}
                </strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {onToggleShowArchivedOnly && (
                <button
                  type="button"
                  data-testid="cabinet-history-show-archived-btn"
                  onClick={onToggleShowArchivedOnly}
                  className="min-h-[36px] text-xs font-semibold text-[#C83210] dark:text-[#FF6B47] hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                >
                  <ArchiveRestore className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Открыть скрытые в архиве ({hiddenByArchiveCount})</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Список завершённых проектов клиента */}
      {totalHistoryOrdersCount === 0 ? (
        <div
          data-testid="cabinet-history-empty"
          className="p-6 sm:p-8 text-center space-y-2"
        >
          <p className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
            В истории пока нет завершённых проектов
          </p>
          <p className="text-xs sm:text-sm text-[#111111]/72 dark:text-[#F4F3EF]/72 max-w-lg mx-auto leading-relaxed">
            После приёмки ролика заказ автоматически перейдёт сюда с полным архивом мастер-файлов WAV, паспортом прав РАО/ВОИС и закрывающим актом A4.
          </p>
        </div>
      ) : filteredHistoryOrders.length === 0 ? (
        <div
          data-testid="cabinet-history-no-matches"
          className="p-6 sm:p-8 text-center space-y-3"
        >
          <p className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
            По выбранным фильтрам проекты не найдены
          </p>
          <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
            {hiddenByArchiveCount > 0 && !showArchivedOnly
              ? `В архиве скрыто завершённых проектов: ${hiddenByArchiveCount}. Откройте архив или сбросьте фильтры.`
              : 'Проверьте поисковый запрос или сбросьте фильтры истории.'}
          </p>
          <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">
            {hiddenByArchiveCount > 0 && !showArchivedOnly && onToggleShowArchivedOnly && (
              <button
                type="button"
                onClick={onToggleShowArchivedOnly}
                className="min-h-[44px] sm:min-h-[38px] px-4 py-2 rounded-xl bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
              >
                Открыть архив ({hiddenByArchiveCount})
              </button>
            )}
            {hasActiveFilter && (
              <button
                type="button"
                data-testid="cabinet-history-reset-filters-btn"
                onClick={onResetFilters}
                className="min-h-[44px] sm:min-h-[38px] px-4 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[#111111]/10 dark:divide-white/10">
          {filteredHistoryOrders.map((order) => {
            const { supplementaryFiles } = extractOrderMasterFiles(order);
            const audioHistory = buildOrderAudioVersionHistory(order);
            const visualStatus = resolveCabinetOrderVisualStatus(order);
            const isArchived = isCompletedHistoryOrder(order);
            const isCompletedPaid = isOrderCompletedAndPaid(order);
            const isOlderThan6m = isCompletedOrderOlderThanSixMonths(order);
            const isManuallyArchived = manualArchiveSet.has(order.orderNumber);

            return (
              <article
                key={order.orderNumber}
                data-testid={`cabinet-history-row-${order.orderNumber}`}
                data-visual-status={visualStatus.statusId}
                data-older-than-6m={isOlderThan6m ? 'true' : 'false'}
                className="p-5 sm:p-7 space-y-5 hover:bg-[#111111]/[0.012] dark:hover:bg-white/[0.015] transition-colors"
              >
                {/* Верхняя строка проекта */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72 tabular-nums">
                      <span className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                        #{order.orderNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span data-testid={`cabinet-history-status-${order.orderNumber}`}>
                        {renderVisualStatusInline(
                          visualStatus.statusId,
                          visualStatus.label
                        )}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {visualStatus.statusId === 'ready' ? 'сдан ' : 'обновлён '}
                        {formatHistoryDate(order.updatedAt || order.createdAt)}
                      </span>
                      {isOlderThan6m && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span
                            data-testid={`cabinet-history-older-6m-tag-${order.orderNumber}`}
                            className="text-[#111111]/78 dark:text-[#F4F3EF]/78"
                          >
                            Архив &gt; 6 мес. (оплачен)
                          </span>
                        </>
                      )}
                      {isManuallyArchived && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#C83210] dark:text-[#FF6B47]">
                            Скрыт в архив
                          </span>
                        </>
                      )}
                      {order.companyOrInn && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[280px] sm:max-w-none">
                            {order.companyOrInn}
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                      {stripTrailingPriceFromOrderTitle(
                        order.formatLabel,
                        order.totalBudgetRub
                      )}
                    </h3>

                    {order.briefText && (
                      <p className="text-xs sm:text-sm text-[#111111]/76 dark:text-[#F4F3EF]/76 leading-relaxed max-w-3xl">
                        {order.briefText}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap lg:flex-col items-center lg:items-end justify-between gap-2.5 shrink-0">
                    <p className="text-lg sm:text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] tabular-nums">
                      {order.totalBudgetRub > 0
                        ? formatRubCompact(order.totalBudgetRub)
                        : 'Договорная'}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        data-testid={`cabinet-history-invoice-${order.orderNumber}`}
                        onClick={() => onOpenDocumentModal(order, 'invoice')}
                        className="min-h-[40px] sm:min-h-[36px] px-3 py-1.5 rounded-lg border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Счёт и договор</span>
                      </button>

                      <button
                        type="button"
                        data-testid={`cabinet-history-act-${order.orderNumber}`}
                        onClick={() => onOpenDocumentModal(order, 'act')}
                        className="min-h-[40px] sm:min-h-[36px] px-3 py-1.5 rounded-lg border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                      >
                        <FileCheck2 className="w-3.5 h-3.5 text-[#166534] dark:text-[#4ADE80] shrink-0" aria-hidden="true" />
                        <span>Акт сдачи</span>
                      </button>

                      {order.cloudDiskUrl && (
                        <a
                          href={order.cloudDiskUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`cabinet-history-cloud-${order.orderNumber}`}
                          className="min-h-[44px] sm:min-h-[36px] px-3 py-1.5 rounded-lg border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                        >
                          <FolderOpen className="w-3.5 h-3.5 shrink-0 text-[#C83210] dark:text-[#FF6B47]" aria-hidden="true" />
                          <span>Папка на диске</span>
                          <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                        </a>
                      )}

                      {isCompletedPaid && onToggleManualArchiveOrder && !isOlderThan6m && (
                        <button
                          type="button"
                          data-testid={`cabinet-history-manual-archive-${order.orderNumber}`}
                          onClick={() => onToggleManualArchiveOrder(order.orderNumber)}
                          className="min-h-[44px] sm:min-h-[36px] px-3 py-1.5 rounded-lg border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111]/82 dark:text-[#F4F3EF]/82 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                        >
                          {isManuallyArchived ? (
                            <ArchiveRestore className="w-3.5 h-3.5 shrink-0 text-[#C83210] dark:text-[#FF6B47]" aria-hidden="true" />
                          ) : (
                            <Archive className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          )}
                          <span>
                            {isManuallyArchived ? 'Вернуть из архива' : 'Скрыть в архив'}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        data-testid={`cabinet-history-repeat-${order.orderNumber}`}
                        onClick={() => onRepeatOrder(order)}
                        className="min-h-[44px] sm:min-h-[36px] px-3 py-1.5 rounded-lg border border-[#C83210]/30 bg-[#C83210]/8 hover:bg-[#C83210]/14 text-xs font-semibold text-[#C83210] dark:text-[#FF6B47] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                      >
                        <Repeat className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Повторить проект</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* История версий аудиоролика (v1, v2, master) */}
                <div className="pt-3 border-t border-[#111111]/10 dark:border-white/10 space-y-2.5">
                  {audioHistory.hasAudioVersions ? (
                    <CabinetAudioVersionHistory
                      orderNumber={order.orderNumber}
                      rescueToken={order.rescueToken}
                      history={audioHistory}
                      supplementaryCount={supplementaryFiles.length}
                      variant="history_row"
                    />
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                      <span>
                        Мастер-файлы по этому проекту были переданы по выбранному внешнему каналу.
                      </span>
                      {!isArchived && onManageActiveOrder && (
                        <button
                          type="button"
                          data-testid={`cabinet-history-manage-${order.orderNumber}`}
                          onClick={() => onManageActiveOrder(order.orderNumber)}
                          className="min-h-[44px] sm:min-h-[34px] text-xs font-semibold text-[#C83210] dark:text-[#FF6B47] hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
                        >
                          <span>Управление и файлы ТЗ</span>
                          <ArrowDownRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}

                  {supplementaryFiles.length > 0 && (
                    <ul className="pt-1 space-y-1.5">
                      {supplementaryFiles.map((file) => {
                        const { downloadHref } = buildDeliverableDownloadUrls(
                          order.orderNumber,
                          order.rescueToken,
                          file.id
                        );
                        return (
                          <li
                            key={file.id}
                            className="flex flex-wrap items-center justify-between gap-2 py-1 text-xs text-[#111111]/78 dark:text-[#F4F3EF]/78"
                          >
                            <span className="inline-flex items-center gap-2 min-w-0">
                              <FileText
                                className="w-3.5 h-3.5 shrink-0 text-[#111111]/66 dark:text-[#F4F3EF]/66"
                                aria-hidden="true"
                              />
                              <span className="truncate">{file.title}</span>
                              <span className="text-[#111111]/68 dark:text-[#F4F3EF]/68 tabular-nums shrink-0">
                                · {SUPPLEMENTARY_KIND_LABELS[file.kind] ?? 'Файл'} ·{' '}
                                {formatFileSizeReadable(file.sizeBytes)}
                              </span>
                            </span>
                            <a
                              href={downloadHref}
                              download={file.fileName}
                              data-testid={`cabinet-history-download-${file.id}`}
                              className="min-h-[36px] inline-flex items-center gap-1 text-xs font-semibold text-[#C83210] dark:text-[#FF6B47] hover:underline whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                            >
                              <Download className="w-3 h-3 shrink-0" aria-hidden="true" />
                              <span>Скачать</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
