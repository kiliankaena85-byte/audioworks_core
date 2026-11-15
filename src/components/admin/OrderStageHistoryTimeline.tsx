import { ArrowRight, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import {
  CRM_ORDER_STAGES,
  type CrmOrderRecord,
  type CrmOrderStage,
  ensureOrderStageHistory,
  getCrmStageMetaForOrder,
} from '../../data/orderCrmTypes';
import {
  collectStageHistoryFilterFacets,
  computeStageRouteStepState,
  DEFAULT_STAGE_HISTORY_QUERY_STATE,
  formatStageDwellDurationRu,
  formatStageHistoryTimestamp,
  hasActiveStageHistoryFilters,
  isStageHistoryQueryModified,
  type OrderStageHistoryEntry,
  queryOrderStageHistoryEntries,
  type StageHistoryDatePreset,
  type StageHistoryQueryState,
  type StageHistorySortMode,
} from '../../data/orderStageHistory';

export interface OrderStageHistoryTimelineProps {
  order: CrmOrderRecord;
  assignedEngineerName?: string | null;
  isUpdating?: boolean;
  compact?: boolean;
  onSelectStage?: (nextStage: CrmOrderStage) => void;
}

export function OrderStageHistoryTimeline({
  order,
  assignedEngineerName = null,
  isUpdating = false,
  compact = false,
  onSelectStage,
}: OrderStageHistoryTimelineProps) {
  const fieldIdPrefix = useId();
  const [query, setQuery] = useState<StageHistoryQueryState>(() => ({
    ...DEFAULT_STAGE_HISTORY_QUERY_STATE,
  }));
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setQuery({ ...DEFAULT_STAGE_HISTORY_QUERY_STATE });
    setIsExpanded(false);
  }, [order.id]);

  const chronologicalEntries = useMemo<OrderStageHistoryEntry[]>(() => {
    const hydrated = ensureOrderStageHistory(order);
    return hydrated.stageHistory ?? [];
  }, [order]);

  const facets = useMemo(
    () =>
      collectStageHistoryFilterFacets(chronologicalEntries, {
        assignedEngineerName,
      }),
    [chronologicalEntries, assignedEngineerName]
  );

  const queriedEntries = useMemo(
    () =>
      queryOrderStageHistoryEntries(chronologicalEntries, query, {
        assignedEngineerName,
      }),
    [chronologicalEntries, query, assignedEngineerName]
  );

  const filtersActive = hasActiveStageHistoryFilters(query);
  const queryModified = isStageHistoryQueryModified(query);

  const collapsedLimit = compact ? 3 : 5;
  const hasOverflow = !filtersActive && queriedEntries.length > collapsedLimit;
  const visibleEntries =
    isExpanded || filtersActive
      ? queriedEntries
      : queriedEntries.slice(0, collapsedLimit);

  const currentStageMeta = getCrmStageMetaForOrder(
    order.stage,
    order.checkoutMode
  );

  const handleResetQuery = () => {
    setQuery({ ...DEFAULT_STAGE_HISTORY_QUERY_STATE });
    setIsExpanded(false);
  };

  return (
    <div
      data-testid="order-stage-history-panel"
      aria-label={`История изменений статусов заказа ${order.orderNumber}`}
      className="space-y-4 pb-5 border-b border-[#111111]/10 dark:border-white/10"
    >
      {/* Заголовок секции + счётчик записей + быстрый сброс параметров */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
            История перемещений по этапам
          </h3>
          <p
            data-testid="stage-history-counter-summary"
            className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60 tabular-nums"
          >
            Текущий этап: {currentStageMeta.stepCode}.{' '}
            {currentStageMeta.shortLabel} ·{' '}
            {filtersActive
              ? `показано ${queriedEntries.length} из ${chronologicalEntries.length}`
              : `записей в журнале: ${chronologicalEntries.length}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
          {facets.milestoneCount > 0 && (
            <div
              role="group"
              aria-label="Фильтр типа событий"
              className="inline-flex items-center gap-3"
            >
              <button
                type="button"
                data-testid="stage-history-filter-all"
                onClick={() =>
                  setQuery((prev) => ({ ...prev, eventScope: 'all' }))
                }
                className={`min-h-[30px] cursor-pointer transition-colors border-b-2 pb-0.5 whitespace-nowrap ${
                  (query.eventScope ?? 'all') === 'all'
                    ? 'border-[#FF4820] font-bold text-[#111111] dark:text-[#F4F3EF]'
                    : 'border-transparent font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                }`}
              >
                Все события ({chronologicalEntries.length})
              </button>
              <button
                type="button"
                data-testid="stage-history-filter-stages"
                onClick={() =>
                  setQuery((prev) => ({ ...prev, eventScope: 'stage_only' }))
                }
                className={`min-h-[30px] cursor-pointer transition-colors border-b-2 pb-0.5 whitespace-nowrap ${
                  query.eventScope === 'stage_only'
                    ? 'border-[#FF4820] font-bold text-[#111111] dark:text-[#F4F3EF]'
                    : 'border-transparent font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                }`}
              >
                Смены этапов ({facets.stageChangeCount})
              </button>
            </div>
          )}

          {queryModified && (
            <button
              type="button"
              data-testid="stage-history-reset-btn"
              onClick={handleResetQuery}
              className="min-h-[30px] inline-flex items-center gap-1 font-semibold text-[#FF4820] hover:text-[#E63D18] transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>Сбросить параметры</span>
            </button>
          )}
        </div>
      </div>

      {/* Визуальная шкала прохождения 6 этапов сделки */}
      <ol
        data-testid="order-stage-route-track"
        aria-label="Маршрут этапов заказа"
        className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5"
      >
        {CRM_ORDER_STAGES.map((st) => {
          const meta = getCrmStageMetaForOrder(st.id, order.checkoutMode);
          const stepState = computeStageRouteStepState(order.stage, st.id);
          const isInteractive = Boolean(onSelectStage) && st.id !== order.stage;

          const barToneClass =
            stepState === 'current'
              ? 'bg-[#FF4820]'
              : stepState === 'completed'
                ? 'bg-[#111111] dark:bg-[#F4F3EF]'
                : 'bg-[#111111]/14 dark:bg-white/14';

          const textToneClass =
            stepState === 'current'
              ? 'text-[#FF4820] font-bold'
              : stepState === 'completed'
                ? 'text-[#111111] dark:text-[#F4F3EF] font-semibold'
                : 'text-[#111111]/50 dark:text-[#F4F3EF]/50 font-medium';

          const stepContent = (
            <>
              <span
                aria-hidden="true"
                className={`block h-[3px] w-full transition-colors ${barToneClass}`}
              />
              <span className="mt-1.5 flex items-baseline gap-1.5 min-w-0">
                <span className="text-[11px] font-bold tabular-nums shrink-0">
                  {meta.stepCode}
                </span>
                <span className="text-xs leading-snug truncate">
                  {meta.shortLabel}
                </span>
              </span>
            </>
          );

          return (
            <li
              key={st.id}
              data-testid={`order-stage-step-${st.id}`}
              data-step-state={stepState}
              className="min-w-0"
            >
              {isInteractive ? (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => onSelectStage?.(st.id)}
                  aria-label={`Перевести заказ #${order.orderNumber} на этап ${meta.stepCode}. ${meta.shortLabel}`}
                  className={`w-full text-left cursor-pointer disabled:opacity-50 disabled:cursor-default group focus:outline-none ${textToneClass} hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors`}
                >
                  {stepContent}
                </button>
              ) : (
                <div
                  aria-current={stepState === 'current' ? 'step' : undefined}
                  className={textToneClass}
                >
                  {stepContent}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Панель фильтрации и сортировки лога изменений статусов (по дате, сотруднику, этапу) */}
      <div
        data-testid="order-stage-history-filter-bar"
        role="region"
        aria-label="Фильтрация и сортировка лога изменений статусов"
        className="pt-3 border-t border-[#111111]/10 dark:border-white/10 space-y-2.5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* 1. Сортировка лога */}
          <div className="space-y-1">
            <label
              htmlFor={`${fieldIdPrefix}-sort`}
              className="block text-[11px] font-semibold text-[#111111]/64 dark:text-[#F4F3EF]/64"
            >
              Сортировка лога
            </label>
            <select
              id={`${fieldIdPrefix}-sort`}
              data-testid="stage-history-sort-select"
              value={query.sortBy}
              onChange={(e) =>
                setQuery((prev) => ({
                  ...prev,
                  sortBy: e.target.value as StageHistorySortMode,
                }))
              }
              className="w-full min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-xs font-medium text-[#111111] dark:text-[#F4F3EF] tabular-nums"
            >
              <option value="date_desc">По дате: сначала новые</option>
              <option value="date_asc">По дате: сначала старые</option>
              <option value="actor_asc">По сотруднику (А–Я)</option>
              <option value="actor_desc">По сотруднику (Я–А)</option>
              <option value="stage_asc">По этапу (01 → 06)</option>
              <option value="stage_desc">По этапу (06 → 01)</option>
            </select>
          </div>

          {/* 2. Фильтр по ответственному сотруднику / роли */}
          <div className="space-y-1">
            <label
              htmlFor={`${fieldIdPrefix}-actor`}
              className="block text-[11px] font-semibold text-[#111111]/64 dark:text-[#F4F3EF]/64"
            >
              Ответственный сотрудник
            </label>
            <select
              id={`${fieldIdPrefix}-actor`}
              data-testid="stage-history-actor-filter"
              value={query.actorKey}
              onChange={(e) =>
                setQuery((prev) => ({
                  ...prev,
                  actorKey: e.target.value,
                }))
              }
              className="w-full min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-xs font-medium text-[#111111] dark:text-[#F4F3EF] tabular-nums"
            >
              <option value="all">
                Все ответственные ({chronologicalEntries.length})
              </option>
              {facets.actors.map((actorOpt) => (
                <option key={actorOpt.key} value={actorOpt.key}>
                  {actorOpt.label} ({actorOpt.count})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Фильтр по конкретному этапу изменения */}
          <div className="space-y-1">
            <label
              htmlFor={`${fieldIdPrefix}-stage`}
              className="block text-[11px] font-semibold text-[#111111]/64 dark:text-[#F4F3EF]/64"
            >
              Этап изменения
            </label>
            <select
              id={`${fieldIdPrefix}-stage`}
              data-testid="stage-history-stage-filter"
              value={query.stageFilter}
              onChange={(e) =>
                setQuery((prev) => ({
                  ...prev,
                  stageFilter: e.target.value as 'all' | CrmOrderStage,
                }))
              }
              className="w-full min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-xs font-medium text-[#111111] dark:text-[#F4F3EF] tabular-nums"
            >
              <option value="all">
                Все этапы ({chronologicalEntries.length})
              </option>
              {CRM_ORDER_STAGES.map((st) => {
                const stMeta = getCrmStageMetaForOrder(
                  st.id,
                  order.checkoutMode
                );
                const count = facets.stageCounts[st.id] ?? 0;
                return (
                  <option key={st.id} value={st.id}>
                    {stMeta.stepCode}. {stMeta.shortLabel} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* 4. Фильтр по дате / периоду (UTC+3) */}
          <div className="space-y-1">
            <label
              htmlFor={`${fieldIdPrefix}-date-preset`}
              className="block text-[11px] font-semibold text-[#111111]/64 dark:text-[#F4F3EF]/64"
            >
              Дата изменения (UTC+3)
            </label>
            <select
              id={`${fieldIdPrefix}-date-preset`}
              data-testid="stage-history-date-preset"
              value={query.datePreset}
              onChange={(e) => {
                const nextPreset = e.target.value as StageHistoryDatePreset;
                setQuery((prev) => ({
                  ...prev,
                  datePreset: nextPreset,
                  exactDateYmd:
                    nextPreset === 'custom_date'
                      ? prev.exactDateYmd || facets.latestDateYmd
                      : '',
                }));
              }}
              className="w-full min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-xs font-medium text-[#111111] dark:text-[#F4F3EF] tabular-nums"
            >
              <option value="all">За всё время</option>
              <option value="today">За сегодня (UTC+3)</option>
              <option value="last_24h">За последние 24 часа</option>
              <option value="last_7d">За 7 дней</option>
              <option value="last_30d">За 30 дней</option>
              <option value="custom_date">Выбрать точную дату…</option>
            </select>
          </div>
        </div>

        {query.datePreset === 'custom_date' && (
          <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
            <label
              htmlFor={`${fieldIdPrefix}-exact-date`}
              className="text-xs font-medium text-[#111111]/70 dark:text-[#F4F3EF]/70"
            >
              Календарная дата (UTC+3):
            </label>
            <input
              id={`${fieldIdPrefix}-exact-date`}
              type="date"
              data-testid="stage-history-exact-date"
              value={query.exactDateYmd ?? ''}
              onChange={(e) =>
                setQuery((prev) => ({
                  ...prev,
                  datePreset: 'custom_date',
                  exactDateYmd: e.target.value,
                }))
              }
              className="min-h-[36px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-medium text-[#111111] dark:text-[#F4F3EF] tabular-nums"
            />
          </div>
        )}
      </div>

      {/* Хронологический / отсортированный лог перемещений заказа либо пустое состояние */}
      {visibleEntries.length === 0 ? (
        <div
          data-testid="stage-history-empty-state"
          className="py-4 border-t border-[#111111]/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-xs text-[#111111]/66 dark:text-[#F4F3EF]/66">
            По заданным условиям фильтрации (дата, ответственный сотрудник или
            этап) записей не найдено.
          </p>
          <button
            type="button"
            data-testid="stage-history-empty-reset-btn"
            onClick={handleResetQuery}
            className="min-h-[36px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Сбросить фильтры истории
          </button>
        </div>
      ) : (
        <ol
          data-testid="order-stage-history-list"
          className="divide-y divide-[#111111]/8 dark:divide-white/8 border-t border-[#111111]/10 dark:border-white/10"
        >
          {visibleEntries.map(
            ({ entry, stepOrdinal, direction, responsibleLabel }) => {
              const prevMeta = entry.previousStage
                ? getCrmStageMetaForOrder(
                    entry.previousStage,
                    order.checkoutMode
                  )
                : null;
              const nextMeta = getCrmStageMetaForOrder(
                entry.nextStage,
                order.checkoutMode
              );
              const dwellText = formatStageDwellDurationRu(
                entry.durationFromPrevMs
              );
              const formattedTs = formatStageHistoryTimestamp(entry.timestamp);
              const ordinalCode = String(stepOrdinal).padStart(2, '0');

              return (
                <li
                  key={entry.id}
                  data-testid="order-stage-history-item"
                  data-transition-direction={direction}
                  className="py-2.5 space-y-1 text-xs"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-bold tabular-nums text-[#111111]/46 dark:text-[#F4F3EF]/46 shrink-0">
                        #{ordinalCode}
                      </span>

                      {direction === 'created' ? (
                        <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                          Регистрация заказа{' '}
                          <ArrowRight
                            className="inline w-3 h-3 mx-0.5 text-[#111111]/50 dark:text-[#F4F3EF]/50"
                            aria-hidden="true"
                          />{' '}
                          «{nextMeta.stepCode}. {nextMeta.shortLabel}»
                        </span>
                      ) : direction === 'milestone' ? (
                        <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                          Этап «{nextMeta.stepCode}. {nextMeta.shortLabel}» ·
                          событие конвейера
                        </span>
                      ) : (
                        <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                          «{prevMeta?.stepCode}. {prevMeta?.shortLabel}»{' '}
                          <ArrowRight
                            className="inline w-3 h-3 mx-0.5 text-[#FF4820]"
                            aria-hidden="true"
                          />{' '}
                          <span
                            className={
                              stepOrdinal === chronologicalEntries.length
                                ? 'text-[#FF4820] font-bold'
                                : ''
                            }
                          >
                            «{nextMeta.stepCode}. {nextMeta.shortLabel}»
                          </span>
                          {direction === 'rollback' && (
                            <span className="ml-1.5 text-[11px] font-semibold text-[#B45309] dark:text-[#FBBF24]">
                              · возврат на предыдущий этап
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-[#111111]/58 dark:text-[#F4F3EF]/58 tabular-nums">
                      <span>{formattedTs}</span>
                      {dwellText && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span>
                            {direction === 'milestone'
                              ? `интервал: ${dwellText}`
                              : `на этапе ${prevMeta?.stepCode ?? ''}: ${dwellText}`}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true"> · </span>
                      <span>{responsibleLabel}</span>
                    </p>
                  </div>

                  {(() => {
                    const rawLabel = entry.workflowStepLabel ?? '';
                    const isGenericStageSwitchLabel = rawLabel.startsWith(
                      'Перевод заказа на этап «'
                    );
                    const effectiveLabel = isGenericStageSwitchLabel
                      ? ''
                      : rawLabel;
                    if (!effectiveLabel && !entry.note) return null;
                    return (
                      <p className="text-[11px] leading-relaxed text-[#111111]/70 dark:text-[#F4F3EF]/70 pl-6">
                        {effectiveLabel}
                        {effectiveLabel && entry.note ? ' — ' : ''}
                        {entry.note ? `Заметка: ${entry.note}` : ''}
                      </p>
                    );
                  })()}
                </li>
              );
            }
          )}
        </ol>
      )}

      {hasOverflow && (
        <div>
          <button
            type="button"
            data-testid="order-stage-history-expand-btn"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((prev) => !prev)}
            className="min-h-[32px] text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:text-[#FF4820] dark:hover:text-[#FF4820] inline-flex items-center gap-1 transition-colors cursor-pointer tabular-nums"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Свернуть журнал до последних {collapsedLimit} записей
                </span>
              </>
            ) : (
              <>
                <ChevronDown
                  className="w-3.5 h-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Показать все перемещения ({queriedEntries.length})
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
