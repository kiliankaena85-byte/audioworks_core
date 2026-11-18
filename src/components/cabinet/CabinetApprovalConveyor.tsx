import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crosshair,
  MessageSquare,
  SlidersHorizontal,
} from 'lucide-react';
import { KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  type ClientApprovalWorkflowView,
  SPOT_REVISION_KIND_LABELS,
  type SpotRevisionKind,
} from '../../data/productionApprovalWorkflow';

function formatDateTimeRu(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export interface CabinetApprovalConveyorProps {
  orderNumber: string;
  workflow: ClientApprovalWorkflowView;
  latestDeliverableId?: string | null;
  activePlayerTimeSec?: number;
  onRequestSeekTimeSec?: (timeSec: number) => void;
  isSubmitting: boolean;
  onApproveScript: (conceptId?: string) => Promise<void> | void;
  onRequestScriptChanges: (comment: string) => Promise<void> | void;
  onAcceptSpot: (deliverableId?: string | null) => Promise<void> | void;
  onRequestSpotRevision: (params: {
    kind: SpotRevisionKind;
    timecodeSec: number | null;
    comment: string;
  }) => Promise<void> | void;
  /** Слот со студийным аудиоплеером, выводимый выше кнопок приёмки на этапе 03 */
  spotAudioPreviewSlot?: ReactNode;
  /** Сигнал мгновенной фиксации таймкода прямо из студийного плеера */
  quickRevisionTrigger?: { timeSec: number; nonce: number } | null;
}

const EXTERNAL_STEPS: readonly {
  id: ClientApprovalWorkflowView['externalStep'];
  code: string;
  title: string;
}[] = [
  { id: '01_script', code: '01', title: 'Режиссёрский сценарий' },
  { id: '02_production', code: '02', title: 'Студийное производство' },
  { id: '03_spot', code: '03', title: 'Готовый ролик и приёмка' },
] as const;

export function CabinetApprovalConveyor({
  orderNumber,
  workflow,
  latestDeliverableId,
  activePlayerTimeSec = 0,
  onRequestSeekTimeSec,
  isSubmitting,
  onApproveScript,
  onRequestScriptChanges,
  onAcceptSpot,
  onRequestSpotRevision,
  spotAudioPreviewSlot,
  quickRevisionTrigger,
}: CabinetApprovalConveyorProps) {
  const latestScriptDraft = workflow.scriptVersions[0] ?? null;
  const [selectedConceptId, setSelectedConceptId] = useState<string>(
    () => latestScriptDraft?.concepts[0]?.id ?? ''
  );
  const conceptTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const revisionCommentInputRef = useRef<HTMLInputElement | null>(null);

  const [isScriptCommentOpen, setIsScriptCommentOpen] = useState<boolean>(false);
  const [scriptCommentDraft, setScriptCommentDraft] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  const [isSpotRevisionOpen, setIsSpotRevisionOpen] = useState<boolean>(false);
  const [revisionKind, setRevisionKind] =
    useState<SpotRevisionKind>('balance_timecode');
  const [revisionTimecodeInput, setRevisionTimecodeInput] = useState<string>('');
  const [revisionCommentDraft, setRevisionCommentDraft] = useState<string>('');

  useEffect(() => {
    if (!quickRevisionTrigger || workflow.phase !== 'spot_client_review') {
      return;
    }
    const rounded = Math.max(0, Math.round(quickRevisionTrigger.timeSec * 10) / 10);
    setRevisionKind('balance_timecode');
    setRevisionTimecodeInput(rounded.toFixed(1));
    setLocalError(null);
    setIsSpotRevisionOpen(true);
    const timerId = window.setTimeout(() => {
      const inputEl = revisionCommentInputRef.current;
      if (inputEl) {
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inputEl.focus();
      }
    }, 60);
    return () => window.clearTimeout(timerId);
  }, [quickRevisionTrigger, workflow.phase]);

  const activeStepIdx = EXTERNAL_STEPS.findIndex(
    (s) => s.id === workflow.externalStep
  );

  const activeConcept =
    latestScriptDraft?.concepts.find((c) => c.id === selectedConceptId) ??
    latestScriptDraft?.concepts[0] ??
    null;

  const handleConceptTabKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    const concepts = latestScriptDraft?.concepts ?? [];
    if (concepts.length <= 1) return;
    let nextIdx = -1;
    if (e.key === 'ArrowRight') {
      nextIdx = (currentIndex + 1) % concepts.length;
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (currentIndex - 1 + concepts.length) % concepts.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = concepts.length - 1;
    }
    if (nextIdx >= 0) {
      e.preventDefault();
      const target = concepts[nextIdx];
      setSelectedConceptId(target.id);
      conceptTabRefs.current[target.id]?.focus();
    }
  };

  const handleCopyScriptForDirector = async () => {
    const src = workflow.lockedScript ?? activeConcept;
    if (!src) return;
    const title =
      'conceptTitle' in src ? src.conceptTitle : src.title;
    const textToCopy = [
      `FMWorks · Заказ #${orderNumber} · Режиссёрский сценарий (${workflow.targetSlotSec} сек)`,
      `Концепция: ${title}`,
      ``,
      src.bodyText,
      src.stressNotes ? `\nУдарения: ${src.stressNotes}` : '',
      src.fz38Disclaimer ? `Сноска ФЗ-38: ${src.fz38Disclaimer}` : '',
      `\nРежиссёрское решение студии: ${src.directorApproach}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        setCopiedScript(true);
        window.setTimeout(() => setCopiedScript(false), 2200);
      }
    } catch {
      setCopiedScript(false);
    }
  };

  const handleScriptCommentSubmit = async () => {
    const clean = scriptCommentDraft.trim();
    if (clean.length < 3) {
      setLocalError('Опишите замечание к тексту сценария (минимум 3 символа)');
      return;
    }
    setLocalError(null);
    await onRequestScriptChanges(clean);
    setScriptCommentDraft('');
    setIsScriptCommentOpen(false);
  };

  const handleCapturePlayerTimecode = () => {
    const rounded = Math.max(0, Math.round(activePlayerTimeSec * 10) / 10);
    setRevisionTimecodeInput(rounded.toFixed(1));
    setLocalError(null);
  };

  const handleSpotRevisionSubmit = async () => {
    const clean = revisionCommentDraft.trim();
    if (clean.length < 3) {
      setLocalError('Уточните пожелание к ролику (минимум 3 символа)');
      return;
    }
    const normalizedTc = revisionTimecodeInput.trim().replace(',', '.');
    const parsedTc = normalizedTc ? Number.parseFloat(normalizedTc) : null;
    if (
      normalizedTc &&
      (parsedTc === null || Number.isNaN(parsedTc) || parsedTc < 0 || parsedTc > 180)
    ) {
      setLocalError('Укажите корректный таймкод в секундах (например, 8.5)');
      return;
    }
    setLocalError(null);
    await onRequestSpotRevision({
      kind: revisionKind,
      timecodeSec: parsedTc,
      comment: clean,
    });
    setRevisionCommentDraft('');
    setRevisionTimecodeInput('');
    setIsSpotRevisionOpen(false);
  };

  const willUseIncludedServiceRound =
    !workflow.serviceRoundUsed &&
    (revisionKind === 'balance_timecode' ||
      revisionKind === 'music_replacement');

  const latestRevision = workflow.spotRevisions[0] ?? null;
  const hasMultipleConcepts = (latestScriptDraft?.concepts.length ?? 0) > 1;
  const scriptPanelId = `cabinet-script-tabpanel-${orderNumber}`;

  return (
    <section
      aria-label={`Пошаговое согласование заказа ${orderNumber}`}
      data-testid={`cabinet-approval-conveyor-${orderNumber}`}
      data-phase={workflow.phase}
      className="space-y-4 pt-1 pb-4 border-b border-[#111111]/10 dark:border-white/10 tabular-nums"
    >
      {/* Строка статуса хода (чистая типографика без капсульных бейджей) */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[#111111]/72 dark:text-[#F4F3EF]/72">
          <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
            Ход производства
          </span>
          <span aria-hidden="true">·</span>
          <span>Слот {workflow.targetSlotSec},00 с</span>
          <span aria-hidden="true">·</span>
          <span>Диктор и музыка — подбор студии</span>
        </div>

        <span
          data-testid={`cabinet-whose-turn-${orderNumber}`}
          className={`font-semibold ${
            workflow.whoseTurnActor === 'client'
              ? 'text-[#D93814] dark:text-[#FF6B47]'
              : workflow.whoseTurnActor === 'completed'
                ? 'text-[#15803D] dark:text-[#4ADE80]'
                : 'text-[#111111]/78 dark:text-[#F4F3EF]/78'
          }`}
        >
          {workflow.whoseTurnLabel}
        </span>
      </div>

      {/* 3 минималистичных этапа внешнего конвейера клиента */}
      <ol className="grid grid-cols-1 sm:grid-cols-3 border-t border-b border-[#111111]/10 dark:border-white/10 divide-y sm:divide-y-0 sm:divide-x divide-[#111111]/10 dark:divide-white/10">
        {EXTERNAL_STEPS.map((step, idx) => {
          const isDone =
            workflow.phase === 'accepted' || idx < activeStepIdx;
          const isActive =
            workflow.phase !== 'accepted' && idx === activeStepIdx;

          return (
            <li
              key={step.id}
              data-testid={`cabinet-conveyor-step-${orderNumber}-${step.id}`}
              className={`py-2.5 sm:px-3.5 first:sm:pl-0 last:sm:pr-0 flex items-center justify-between gap-2 text-xs ${
                isActive
                  ? 'text-[#111111] dark:text-[#F4F3EF] font-semibold'
                  : isDone
                    ? 'text-[#15803D] dark:text-[#4ADE80] font-medium'
                    : 'text-[#111111]/66 dark:text-[#F4F3EF]/66'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isDone ? (
                  <CheckCircle2
                    className="w-3.5 h-3.5 shrink-0 text-[#15803D] dark:text-[#4ADE80]"
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className={`font-mono text-[11px] shrink-0 ${
                      isActive ? 'text-[#D93814] dark:text-[#FF6B47] font-bold' : ''
                    }`}
                  >
                    {step.code}.
                  </span>
                )}
                <span className="truncate">{step.title}</span>
              </div>

              {isActive && workflow.whoseTurnActor === 'client' && (
                <span className="text-[11px] font-semibold text-[#D93814] dark:text-[#FF6B47] whitespace-nowrap shrink-0">
                  Ваш ход
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* ================================================================= */}
      {/* ЭТАП 01: РЕЖИССЁРСКИЙ СЦЕНАРИЙ                                    */}
      {/* ================================================================= */}
      {workflow.externalStep === '01_script' && (
        <div className="space-y-4">
          {workflow.phase === 'script_drafting' ? (
            <div className="py-3 px-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] space-y-1.5">
              <p className="text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
                {latestScriptDraft?.clientComment
                  ? `Готовим обновлённый сценарий v${latestScriptDraft.versionNumber + 1} по вашему комментарию`
                  : `Продюсер формирует режиссёрский сценарий (${workflow.targetSlotSec} с)`}
              </p>
              {latestScriptDraft?.clientComment ? (
                <p className="text-xs text-[#111111]/74 dark:text-[#F4F3EF]/74 leading-relaxed">
                  Ваше замечание к v{latestScriptDraft.versionNumber}: «
                  {latestScriptDraft.clientComment}»
                </p>
              ) : (
                <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 leading-relaxed">
                  Выверяем продающую драматургию, ударения, сноски ФЗ-38 и точный
                  хронометраж. Как только сценарий будет опубликован, придёт
                  мгновенное оповещение.
                </p>
              )}
            </div>
          ) : activeConcept && latestScriptDraft ? (
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-[#111111]/74 dark:text-[#F4F3EF]/74">
                  <strong className="text-[#111111] dark:text-[#F4F3EF]">
                    Режиссёрский сценарий v{latestScriptDraft.versionNumber}
                  </strong>
                  {' · '}расчётная читка ~{activeConcept.estimatedSec} с (слот{' '}
                  {workflow.targetSlotSec} с)
                </div>

                <button
                  type="button"
                  onClick={() => void handleCopyScriptForDirector()}
                  data-testid={`cabinet-copy-script-btn-${orderNumber}`}
                  className="min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-lg border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111]/85 dark:text-[#F4F3EF]/85 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                >
                  {copiedScript ? (
                    <Check className="w-3.5 h-3.5 text-[#15803D] dark:text-[#4ADE80]" aria-hidden="true" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>
                    {copiedScript
                      ? 'Скопировано в буфер'
                      : 'Скопировать для руководителя'}
                  </span>
                </button>
              </div>

              {hasMultipleConcepts && (
                <div
                  role="tablist"
                  aria-label="Варианты режиссёрского сценария"
                  className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F]"
                >
                  {latestScriptDraft.concepts.map((concept, idx) => {
                    const isSelected = concept.id === activeConcept.id;
                    const tabId = `cabinet-script-tab-${orderNumber}-${concept.id}`;
                    return (
                      <button
                        key={concept.id}
                        ref={(el) => {
                          conceptTabRefs.current[concept.id] = el;
                        }}
                        id={tabId}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        aria-controls={scriptPanelId}
                        tabIndex={isSelected ? 0 : -1}
                        onKeyDown={(e) => handleConceptTabKeyDown(e, idx)}
                        onClick={() => setSelectedConceptId(concept.id)}
                        className={`min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                          isSelected
                            ? 'bg-white dark:bg-[#141418] text-[#111111] dark:text-[#F4F3EF] shadow-xs'
                            : 'text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                        }`}
                      >
                        {concept.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div
                id={scriptPanelId}
                role={hasMultipleConcepts ? 'tabpanel' : undefined}
                aria-labelledby={
                  hasMultipleConcepts
                    ? `cabinet-script-tab-${orderNumber}-${activeConcept.id}`
                    : undefined
                }
                tabIndex={hasMultipleConcepts ? 0 : undefined}
                className="p-4 sm:p-5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] space-y-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
              >
                <p className="text-xs font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74">
                  {activeConcept.title}
                </p>

                <p
                  data-testid={`cabinet-script-body-${orderNumber}`}
                  className="text-sm sm:text-base font-medium text-[#111111] dark:text-[#F4F3EF] leading-relaxed"
                >
                  {activeConcept.bodyText}
                </p>

                {(activeConcept.stressNotes || activeConcept.fz38Disclaimer) && (
                  <div className="pt-2.5 border-t border-[#111111]/10 dark:border-white/10 space-y-1 text-xs text-[#111111]/76 dark:text-[#F4F3EF]/76">
                    {activeConcept.stressNotes && (
                      <p>
                        <strong className="text-[#111111] dark:text-[#F4F3EF]">
                          Ударения и произношение:
                        </strong>{' '}
                        {activeConcept.stressNotes}
                      </p>
                    )}
                    {activeConcept.fz38Disclaimer && (
                      <p>
                        <strong className="text-[#111111] dark:text-[#F4F3EF]">
                          Дисклеймер ФЗ-38 (внутри хронометража):
                        </strong>{' '}
                        {activeConcept.fz38Disclaimer}
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-2.5 border-t border-[#111111]/10 dark:border-white/10 text-xs text-[#111111]/78 dark:text-[#F4F3EF]/78 leading-relaxed">
                  <strong className="text-[#111111] dark:text-[#F4F3EF]">
                    Режиссёрское решение студии (голос и музыка):
                  </strong>{' '}
                  {activeConcept.directorApproach}
                </div>
              </div>

              <p className="text-xs text-[#111111]/70 dark:text-[#F4F3EF]/70 leading-relaxed">
                Утверждение сценария фиксирует текст, ударения и хронометраж{' '}
                {workflow.targetSlotSec} с. Подбор диктора, интонации и
                лицензионной музыкальной фонограммы выполняет режиссёрская группа
                FMWorks (п. 2.3 Договора).
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  data-testid={`cabinet-approve-script-btn-${orderNumber}`}
                  onClick={() => void onApproveScript(activeConcept.id)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                >
                  <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {isSubmitting
                      ? 'Фиксация сценария…'
                      : 'Утвердить сценарий в производство'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  data-testid={`cabinet-script-comment-toggle-${orderNumber}`}
                  onClick={() => {
                    setLocalError(null);
                    setIsScriptCommentOpen((prev) => !prev);
                  }}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {isScriptCommentOpen
                      ? 'Скрыть форму замечания'
                      : 'Оставить замечание к тексту'}
                  </span>
                </button>
              </div>

              {isScriptCommentOpen && (
                <div className="p-3.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] space-y-2.5">
                  <label
                    htmlFor={`script-comment-${orderNumber}`}
                    className="block text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]"
                  >
                    Что скорректировать в сценарии до начала записи диктора
                  </label>
                  <textarea
                    id={`script-comment-${orderNumber}`}
                    rows={3}
                    value={scriptCommentDraft}
                    onChange={(e) => setScriptCommentDraft(e.target.value)}
                    placeholder="Например: уточните срок акции до 30 декабря и выделите телефон в финале…"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/16 dark:border-white/16 text-xs sm:text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                  />
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      data-testid={`cabinet-submit-script-comment-btn-${orderNumber}`}
                      onClick={() => void handleScriptCommentSubmit()}
                      className="min-h-[44px] sm:min-h-[38px] px-4 py-1.5 rounded-lg bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                    >
                      Отправить замечание продюсеру
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ================================================================= */}
      {/* ЭТАП 02: СТУДИЙНОЕ ПРОИЗВОДСТВО                                   */}
      {/* ================================================================= */}
      {workflow.externalStep === '02_production' && (
        <div className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
              {workflow.hasPendingQcTake
                ? 'Готовый дубль на финальном техконтроле продюсера'
                : 'Сценарий утверждён · ролик в студийном производстве'}
            </p>
            {workflow.lockedScript?.approvedAt && (
              <span className="text-xs text-[#111111]/70 dark:text-[#F4F3EF]/70">
                Утверждён {formatDateTimeRu(workflow.lockedScript.approvedAt)}
              </span>
            )}
          </div>

          <p className="text-xs text-[#111111]/74 dark:text-[#F4F3EF]/74 leading-relaxed">
            Записываем профильного диктора, собираем коммерческую музыкальную
            фонограмму и выравниваем громкость под эфирный стандарт −14 LUFS (ровно{' '}
            {workflow.targetSlotSec},00 с). Готовый ролик откроется здесь сразу
            после проверки продюсером.
          </p>

          {workflow.lockedScript && (
            <details className="pt-1 text-xs">
              <summary className="min-h-[36px] inline-flex items-center font-semibold text-[#111111]/82 dark:text-[#F4F3EF]/82 cursor-pointer select-none hover:text-[#FF4820] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]">
                Показать утверждённый текст сценария (v
                {workflow.lockedScript.versionNumber})
              </summary>
              <div className="mt-2 pt-2 border-t border-[#111111]/10 dark:border-white/10 space-y-1.5 text-[#111111]/82 dark:text-[#F4F3EF]/82 leading-relaxed">
                <p>{workflow.lockedScript.bodyText}</p>
                {workflow.lockedScript.stressNotes && (
                  <p className="text-xs text-[#111111]/70 dark:text-[#F4F3EF]/70">
                    Ударения: {workflow.lockedScript.stressNotes}
                  </p>
                )}
              </div>
            </details>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* ЭТАП 03: ГОТОВЫЙ РОЛИК, 1 СЕРВИСНЫЙ РАУНД И ПРИЁМКА               */}
      {/* ================================================================= */}
      {workflow.externalStep === '03_spot' && (
        <div className="space-y-3.5">
          {workflow.phase === 'accepted' ? (
            <div
              data-testid={`cabinet-spot-accepted-banner-${orderNumber}`}
              className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2
                  className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="space-y-0.5">
                  <p className="text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
                    Аудиоролик официально принят в эфир
                  </p>
                  <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                    {workflow.acceptedAt
                      ? `Дата приёмки: ${formatDateTimeRu(workflow.acceptedAt)} · `
                      : ''}
                    Мастер-файл WAV (−14 LUFS), акт сдачи-приёмки и паспорт прав доступны в карточке.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Сначала прослушивание версий ролика, затем — кнопки приёмки / правки */}
              {spotAudioPreviewSlot && (
                <div
                  data-testid={`cabinet-spot-audio-first-${orderNumber}`}
                  className="pt-1"
                >
                  {spotAudioPreviewSlot}
                </div>
              )}

              <div className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] space-y-3">
                {/* Уведомление о зашитом в цену 1 сервисном раунде доводки без микро-счетов */}
              <p
                data-testid={`cabinet-service-round-note-${orderNumber}`}
                className="text-xs text-[#111111]/78 dark:text-[#F4F3EF]/78 leading-relaxed"
              >
                {!workflow.serviceRoundUsed ? (
                  <>
                    <strong className="text-[#111111] dark:text-[#F4F3EF]">
                      Гарантия спокойного согласования с руководством:
                    </strong>{' '}
                    в стоимость заказа включён{' '}
                    <strong className="text-[#111111] dark:text-[#F4F3EF]">
                      1 сервисный раунд доводки ролика
                    </strong>{' '}
                    (коррекция баланса громкости и пауз по таймкоду либо до 1
                    замены музыкальной подложки — без доплат и дополнительных
                    счетов).
                  </>
                ) : (
                  <>
                    <strong className="text-[#111111] dark:text-[#F4F3EF]">
                      Статус сервисного раунда:
                    </strong>{' '}
                    {workflow.serviceRoundSummary ??
                      'Включённый сервисный раунд доводки использован без доплат'}
                    . Дополнительные изменения или перечитка текста решаются
                    напрямую с продюсером без бумажной волокиты.
                  </>
                )}
              </p>

              {(workflow.phase === 'revision_in_progress' ||
                workflow.phase === 'producer_escalation') &&
                latestRevision && (
                  <div className="pt-2.5 border-t border-[#111111]/10 dark:border-white/10 space-y-1 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5 font-semibold text-[#111111] dark:text-[#F4F3EF]">
                      <Clock
                        className="w-3.5 h-3.5 text-[#FF4820] shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        {workflow.phase === 'producer_escalation'
                          ? 'Запрос передан продюсеру студии:'
                          : 'Доводка ролика в работе студии:'}
                      </span>
                      <span>{SPOT_REVISION_KIND_LABELS[latestRevision.kind]}</span>
                      {typeof latestRevision.timecodeSec === 'number' && (
                        onRequestSeekTimeSec ? (
                          <button
                            type="button"
                            data-testid={`cabinet-seek-revision-tc-${orderNumber}`}
                            onClick={() =>
                              onRequestSeekTimeSec(latestRevision.timecodeSec ?? 0)
                            }
                            className="font-mono text-[#D93814] dark:text-[#FF6B47] underline underline-offset-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                          >
                            · таймкод {latestRevision.timecodeSec.toFixed(1)} с (перейти)
                          </button>
                        ) : (
                          <span>
                            · таймкод {latestRevision.timecodeSec.toFixed(1)} с
                          </span>
                        )
                      )}
                    </div>
                    <p className="text-[#111111]/74 dark:text-[#F4F3EF]/74">
                      «{latestRevision.comment}»
                    </p>
                  </div>
                )}

              {workflow.phase === 'spot_client_review' && (
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    data-testid={`cabinet-accept-spot-btn-${orderNumber}`}
                    onClick={() => void onAcceptSpot(latestDeliverableId)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                  >
                    <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      {isSubmitting ? 'Сохранение…' : 'Принять готовый ролик'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    data-testid={`cabinet-open-spot-revision-btn-${orderNumber}`}
                    onClick={() => {
                      setLocalError(null);
                      setIsSpotRevisionOpen((prev) => !prev);
                    }}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                  >
                    <SlidersHorizontal
                      className="w-3.5 h-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {isSpotRevisionOpen
                        ? 'Скрыть форму доводки'
                        : !workflow.serviceRoundUsed
                          ? 'Внести поправку (1 раунд в цене)'
                          : 'Направить запрос продюсеру'}
                    </span>
                  </button>
                </div>
              )}

              {isSpotRevisionOpen && workflow.phase === 'spot_client_review' && (
                <div className="pt-3 border-t border-[#111111]/10 dark:border-white/10 space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]">
                      Тип корректировки
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      {(
                        [
                          {
                            id: 'balance_timecode' as SpotRevisionKind,
                            short: 'Баланс / пауза по таймкоду',
                          },
                          {
                            id: 'music_replacement' as SpotRevisionKind,
                            short: 'Заменить музыку (1 раз в цене)',
                          },
                          {
                            id: 'text_change_escalation' as SpotRevisionKind,
                            short: 'Изменить текст (к продюсеру)',
                          },
                        ] as const
                      ).map((opt) => {
                        const selected = revisionKind === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            aria-pressed={selected}
                            data-testid={`cabinet-revision-kind-${orderNumber}-${opt.id}`}
                            onClick={() => setRevisionKind(opt.id)}
                            className={`min-h-[44px] sm:min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-semibold text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                              selected
                                ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:border-[#F4F3EF]'
                                : 'bg-white dark:bg-[#141418] text-[#111111]/82 dark:text-[#F4F3EF]/82 border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820]'
                            }`}
                          >
                            {opt.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-4 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor={`rev-tc-${orderNumber}`}
                          className="block text-xs font-medium text-[#111111]/74 dark:text-[#F4F3EF]/74"
                        >
                          Таймкод, сек
                        </label>
                        <button
                          type="button"
                          data-testid={`cabinet-capture-timecode-btn-${orderNumber}`}
                          onClick={handleCapturePlayerTimecode}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D93814] dark:text-[#FF6B47] hover:underline cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                        >
                          <Crosshair className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span>Из плеера ({activePlayerTimeSec.toFixed(1)} с)</span>
                        </button>
                      </div>
                      <input
                        id={`rev-tc-${orderNumber}`}
                        data-testid={`cabinet-revision-timecode-${orderNumber}`}
                        type="text"
                        inputMode="decimal"
                        value={revisionTimecodeInput}
                        onChange={(e) => setRevisionTimecodeInput(e.target.value)}
                        placeholder="напр. 12.5"
                        className="w-full min-h-[44px] sm:min-h-[38px] px-3 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/16 dark:border-white/16 text-xs tabular-nums focus:outline-none focus:border-[#FF4820]"
                      />
                    </div>

                    <div className="sm:col-span-8 space-y-1">
                      <label
                        htmlFor={`rev-comment-${orderNumber}`}
                        className="block text-xs font-medium text-[#111111]/74 dark:text-[#F4F3EF]/74"
                      >
                        Комментарий для студии
                      </label>
                      <input
                        ref={revisionCommentInputRef}
                        id={`rev-comment-${orderNumber}`}
                        type="text"
                        data-testid={`cabinet-revision-comment-${orderNumber}`}
                        value={revisionCommentDraft}
                        onChange={(e) => setRevisionCommentDraft(e.target.value)}
                        placeholder="Опишите, что нужно скорректировать…"
                        className="w-full min-h-[44px] sm:min-h-[38px] px-3 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/16 dark:border-white/16 text-xs focus:outline-none focus:border-[#FF4820]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                      {willUseIncludedServiceRound
                        ? 'Правка уйдёт сразу в работу в рамках включённого сервисного раунда (0 ₽ доплат).'
                        : 'Запрос поступит продюсеру для быстрого согласования без микро-счетов.'}
                    </span>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      data-testid={`cabinet-submit-spot-revision-btn-${orderNumber}`}
                      onClick={() => void handleSpotRevisionSubmit()}
                      className="min-h-[44px] sm:min-h-[38px] px-4 py-1.5 rounded-lg bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                    >
                      {willUseIncludedServiceRound
                        ? 'Отправить в работу студии'
                        : 'Направить продюсеру'}
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}
        </div>
      )}

      {localError && (
        <p role="alert" className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]">
          {localError}
        </p>
      )}
    </section>
  );
}
