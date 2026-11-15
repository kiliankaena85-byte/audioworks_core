import {
  ArrowDownRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  ExternalLink,
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
  resolveCabinetOrderVisualStatus,
} from '../../data/clientCabinetArchitecture';
import { CabinetAudioVersionHistory } from './CabinetAudioVersionHistory';
import {
  type ClientCabinetOrderSummary,
  formatFileSizeReadable,
  type OrderDeliverableFile,
} from '../../data/clientCabinetHelpers';
import { formatRubCompact } from '../../data/radioInventory';

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

function renderVisualStatusInline(statusId: CabinetHistoryVisualStatusId, label: string) {
  if (statusId === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-[#16A34A] dark:text-[#4ADE80]">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  if (statusId === 'in_review') {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-[#D97706] dark:text-[#FBBF24]">
        <ClipboardCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-[#FF4820]">
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
  onResetFilters: () => void;
  onOpenInvoiceModal: (order: ClientCabinetOrderSummary) => void;
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
  onResetFilters,
  onOpenInvoiceModal,
  onRepeatOrder,
  onManageActiveOrder,
}: CabinetOrderHistorySectionProps) {
  const hasActiveFilter =
    Boolean(searchQuery.trim()) || onlyWithMasters || statusFilter !== 'all';

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
      {/* Шапка раздела «История заказов» со сводкой статусов, фильтрами и поиском */}
      <div className="p-5 sm:p-7 space-y-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#111111]/60 dark:text-[#F4F3EF]/60 tabular-nums">
            <span>Проектов: {totalHistoryOrdersCount}</span>
            <span aria-hidden="true">·</span>
            <span>В работе: {inWorkCount}</span>
            <span aria-hidden="true">·</span>
            <span>На согласовании: {inReviewCount}</span>
            <span aria-hidden="true">·</span>
            <span>Готово: {readyCount}</span>
            <span aria-hidden="true">·</span>
            <span>Мастер-файлов WAV: {totalHistoryMastersCount}</span>
          </div>

          <h2
            id="cabinet-history-heading"
            className="text-xl sm:text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]"
          >
            История заказов
          </h2>
          <p className="text-xs sm:text-sm text-[#111111]/66 dark:text-[#F4F3EF]/66 max-w-2xl leading-relaxed">
            Единый реестр ваших проектов с наглядным прогрессом по этапам, историей всех версий аудиоролика (v1, v2, master), прямым скачиванием WAV и доступом к документам.
          </p>
        </div>

        {totalHistoryOrdersCount > 0 && (
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-1">
            {/* Сегментированный фильтр по визуальному статусу */}
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
                    className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                      active
                        ? 'bg-white dark:bg-[#141418] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/12 dark:border-white/14'
                        : 'text-[#111111]/66 dark:text-[#F4F3EF]/66 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Поиск и фильтр мастер-файлов */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full xl:w-auto">
              <div className="relative flex-1 sm:w-80">
                <label htmlFor="cabinet-history-search" className="sr-only">
                  Поиск по проектам и мастер-файлам
                </label>
                <Search
                  className="w-4 h-4 text-[#111111]/45 dark:text-[#F4F3EF]/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="cabinet-history-search"
                  type="search"
                  data-testid="cabinet-history-search-input"
                  value={searchQuery}
                  onChange={(e) => onChangeSearchQuery(e.target.value)}
                  placeholder="Номер, ИНН, версия (v1, v2, master) или файл…"
                  className="w-full min-h-[40px] pl-9 pr-8 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 focus:border-[#FF4820] focus:outline-none text-xs sm:text-sm text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/45 dark:placeholder:text-[#F4F3EF]/45 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Очистить поисковый запрос"
                    onClick={() => onChangeSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#111111]/50 dark:text-[#F4F3EF]/50 hover:text-[#111111] dark:hover:text-[#F4F3EF] cursor-pointer"
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
                className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  onlyWithMasters
                    ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:border-[#F4F3EF]'
                    : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/78 dark:text-[#F4F3EF]/78 border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                }`}
              >
                Только с мастер-файлами
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Список проектов клиента с визуальными статусами и шкалой прогресса */}
      {totalHistoryOrdersCount === 0 ? (
        <div
          data-testid="cabinet-history-empty"
          className="p-6 sm:p-8 text-center space-y-2"
        >
          <p className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
            В истории пока нет проектов
          </p>
          <p className="text-xs sm:text-sm text-[#111111]/62 dark:text-[#F4F3EF]/62 max-w-lg mx-auto leading-relaxed">
            Оформленные заказы сразу появятся здесь со статусом «В работе», «На согласовании» или «Готово» и доступом к мастер-файлам WAV.
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
          <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
            Проверьте поисковый запрос или переключите фильтр статуса проекта.
          </p>
          {hasActiveFilter && (
            <div className="pt-1">
              <button
                type="button"
                data-testid="cabinet-history-reset-filters-btn"
                onClick={onResetFilters}
                className="min-h-[38px] px-4 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Сбросить фильтры
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="divide-y divide-[#111111]/10 dark:divide-white/10">
          {filteredHistoryOrders.map((order) => {
            const { supplementaryFiles } = extractOrderMasterFiles(order);
            const audioHistory = buildOrderAudioVersionHistory(order);
            const visualStatus = resolveCabinetOrderVisualStatus(order);
            const isArchived = isCompletedHistoryOrder(order);

            return (
              <article
                key={order.orderNumber}
                data-testid={`cabinet-history-row-${order.orderNumber}`}
                data-visual-status={visualStatus.statusId}
                className="p-5 sm:p-7 space-y-5 hover:bg-[#111111]/[0.012] dark:hover:bg-white/[0.015] transition-colors"
              >
                {/* Верхняя строка проекта: номер, визуальный статус, дата, реквизиты, бюджет и действия */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#111111]/62 dark:text-[#F4F3EF]/62 tabular-nums">
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
                      {order.formatLabel}
                    </h3>

                    {order.briefText && (
                      <p className="text-xs sm:text-sm text-[#111111]/70 dark:text-[#F4F3EF]/70 leading-relaxed max-w-3xl">
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
                        onClick={() => onOpenInvoiceModal(order)}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Счёт и акт (A4)</span>
                      </button>

                      {order.cloudDiskUrl && (
                        <a
                          href={order.cloudDiskUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`cabinet-history-cloud-${order.orderNumber}`}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                        >
                          <FolderOpen className="w-3.5 h-3.5 shrink-0 text-[#FF4820]" aria-hidden="true" />
                          <span>Папка на диске</span>
                          <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                        </a>
                      )}

                      <button
                        type="button"
                        data-testid={`cabinet-history-repeat-${order.orderNumber}`}
                        onClick={() => onRepeatOrder(order)}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#FF4820]/10 hover:bg-[#FF4820]/18 text-xs font-semibold text-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Repeat className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Повторить проект</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Наглядная 3-этапная шкала прогресса проекта («В работе» → «На согласовании» → «Готово») */}
                <div
                  role="progressbar"
                  aria-valuenow={visualStatus.progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Прогресс проекта ${order.orderNumber}: ${visualStatus.label} (${visualStatus.progressPercent}%)`}
                  data-testid={`cabinet-history-progress-${order.orderNumber}`}
                  className="pt-3 border-t border-[#111111]/8 dark:border-white/8 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
                      {visualStatus.stageSummary}
                    </span>
                    <span className="font-semibold text-[#111111]/62 dark:text-[#F4F3EF]/62 tabular-nums shrink-0">
                      Этап {visualStatus.currentStepNumber} из {visualStatus.totalSteps} ·{' '}
                      {visualStatus.progressPercent}%
                    </span>
                  </div>

                  <ol className="grid grid-cols-3 gap-2 sm:gap-3">
                    {visualStatus.steps.map((step) => {
                      const barClass =
                        step.state === 'done'
                          ? 'bg-[#16A34A] dark:bg-[#4ADE80]'
                          : step.state === 'current'
                            ? step.id === 'in_review'
                              ? 'bg-[#D97706] dark:bg-[#FBBF24]'
                              : 'bg-[#FF4820]'
                            : 'bg-[#111111]/10 dark:bg-white/12';

                      const labelClass =
                        step.state === 'done'
                          ? 'text-[#15803D] dark:text-[#4ADE80] font-medium'
                          : step.state === 'current'
                            ? 'text-[#111111] dark:text-[#F4F3EF] font-semibold'
                            : 'text-[#111111]/45 dark:text-[#F4F3EF]/45';

                      return (
                        <li key={step.id} className="space-y-1.5 min-w-0">
                          <div className="h-1.5 w-full rounded-full bg-[#111111]/8 dark:bg-white/10 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-opacity ${barClass} ${
                                step.state === 'upcoming' ? 'w-0' : 'w-full'
                              }`}
                            />
                          </div>
                          <p
                            className={`text-[11px] sm:text-xs truncate tabular-nums ${labelClass}`}
                          >
                            {step.stepNumber}. {step.label}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                </div>

                {/* История версий аудиоролика (v1, v2, master) или контекстный статус активного этапа */}
                <div className="pt-3 border-t border-[#111111]/8 dark:border-white/8 space-y-2.5">
                  {audioHistory.hasAudioVersions ? (
                    <CabinetAudioVersionHistory
                      orderNumber={order.orderNumber}
                      rescueToken={order.rescueToken}
                      history={audioHistory}
                      supplementaryCount={supplementaryFiles.length}
                      variant="history_row"
                    />
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
                      <span>
                        {visualStatus.statusId === 'in_review'
                          ? 'Ожидается согласование концепции — первая аудиоверсия (v1) появится здесь сразу после записи дубля.'
                          : visualStatus.statusId === 'in_work'
                            ? 'Проект в производстве — все итерации аудиоролика (v1, v2 и финальный master WAV) будут появляться здесь по мере готовности.'
                            : 'Мастер-файлы по этому проекту были переданы по выбранному внешнему каналу.'}
                      </span>
                      {!isArchived && onManageActiveOrder && (
                        <button
                          type="button"
                          data-testid={`cabinet-history-manage-${order.orderNumber}`}
                          onClick={() => onManageActiveOrder(order.orderNumber)}
                          className="text-xs font-semibold text-[#FF4820] hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
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
                            className="flex flex-wrap items-center justify-between gap-2 py-1 text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72"
                          >
                            <span className="inline-flex items-center gap-2 min-w-0">
                              <FileText
                                className="w-3.5 h-3.5 shrink-0 text-[#111111]/48 dark:text-[#F4F3EF]/48"
                                aria-hidden="true"
                              />
                              <span className="truncate">{file.title}</span>
                              <span className="text-[#111111]/48 dark:text-[#F4F3EF]/48 tabular-nums shrink-0">
                                · {SUPPLEMENTARY_KIND_LABELS[file.kind] ?? 'Файл'} ·{' '}
                                {formatFileSizeReadable(file.sizeBytes)}
                              </span>
                            </span>
                            <a
                              href={downloadHref}
                              download={file.fileName}
                              data-testid={`cabinet-history-download-${file.id}`}
                              className="text-xs font-semibold text-[#FF4820] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
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
