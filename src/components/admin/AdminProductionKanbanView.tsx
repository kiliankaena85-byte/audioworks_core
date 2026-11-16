import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Mail,
  Plus,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { studioCmsStore } from '../../cms/studioCmsStore';
import { formatFileSizeReadable } from '../../data/clientCabinetHelpers';
import type { CrmOrderRecord } from '../../data/orderCrmTypes';
import {
  ensureOrderApprovalWorkflow,
  estimateRussianScriptDurationSec,
  evaluateBroadcastSlotFit,
  resolveStudioKanbanColumn,
  resolveWhoseTurn,
  SOUND_ENGINEER_EMAIL_CTA_LABEL,
  type SoundEngineerContact,
  type SoundEngineerEmailNotificationRecord,
  SPOT_REVISION_KIND_LABELS,
  STUDIO_KANBAN_COLUMNS,
  type StudioKanbanColumnId,
} from '../../data/productionApprovalWorkflow';
import { formatRubCompact } from '../../data/radioInventory';
import { resolveNextTabIdOnArrowKey } from '../../security/adminSessionStandards';
import { OrderStageHistoryTimeline } from './OrderStageHistoryTimeline';

const KANBAN_TAB_IDS: readonly ('all' | StudioKanbanColumnId)[] = [
  'all',
  ...STUDIO_KANBAN_COLUMNS.map((c) => c.id),
];

export interface AdminProductionKanbanViewProps {
  orders: CrmOrderRecord[];
  soundEngineers: SoundEngineerContact[];
  soundEngineerEmails?: SoundEngineerEmailNotificationRecord[];
  selectedOrderId: string;
  onSelectOrderId: (id: string) => void;
  onOrderUpdated: (updatedOrder: CrmOrderRecord) => void;
  onSoundEngineersUpdated: (roster: SoundEngineerContact[]) => void;
  onSoundEngineerEmailsUpdated?: (
    emails: SoundEngineerEmailNotificationRecord[]
  ) => void;
  onFeedback: (banner: { kind: 'ok' | 'error'; text: string }) => void;
}

interface DispatchedEngineerBundle {
  orderId: string;
  dropPath: string;
  dropUrl: string;
  emailActionPath?: string;
  emailActionUrl?: string;
  channelSummary: string;
  sheet: {
    subject: string;
    plainBody: string;
    htmlBody?: string;
    buttonLabel?: string;
    actionButtonUrl?: string;
    mailtoHref: string;
  };
}

function formatShortTimeRu(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AdminProductionKanbanView({
  orders,
  soundEngineers,
  soundEngineerEmails = [],
  selectedOrderId,
  onSelectOrderId,
  onOrderUpdated,
  onSoundEngineersUpdated,
  onSoundEngineerEmailsUpdated,
  onFeedback,
}: AdminProductionKanbanViewProps) {
  const [columnFilter, setColumnFilter] = useState<
    'all' | StudioKanbanColumnId
  >('all');

  const handleKanbanTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentId: 'all' | StudioKanbanColumnId
  ) => {
    const nextId = resolveNextTabIdOnArrowKey(
      KANBAN_TAB_IDS,
      currentId,
      event.key
    );
    if (!nextId) return;
    event.preventDefault();
    setColumnFilter(nextId);
    document.getElementById(`kanban-tab-btn-${nextId}`)?.focus();
  };
  const [isRosterOpen, setIsRosterOpen] = useState<boolean>(false);
  const [rosterDraft, setRosterDraft] =
    useState<SoundEngineerContact[]>(soundEngineers);
  const [isSavingRoster, setIsSavingRoster] = useState<boolean>(false);

  // Редактор режиссёрского сценария выбранного заказа
  const [targetSlotDraft, setTargetSlotDraft] = useState<number>(20);
  const [concept1Title, setConcept1Title] = useState<string>('');
  const [concept1Body, setConcept1Body] = useState<string>('');
  const [concept1Stresses, setConcept1Stresses] = useState<string>('');
  const [concept1Disclaimer, setConcept1Disclaimer] = useState<string>('');
  const [concept1Approach, setConcept1Approach] = useState<string>('');

  const [showConcept2, setShowConcept2] = useState<boolean>(false);
  const [concept2Title, setConcept2Title] = useState<string>('');
  const [concept2Body, setConcept2Body] = useState<string>('');
  const [concept2Approach, setConcept2Approach] = useState<string>('');
  const [isPublishingScript, setIsPublishingScript] = useState<boolean>(false);

  // Назначение звукорежиссёра и выпуск техлиста с прямой ссылкой /sound-drop
  const [selectedEngineerId, setSelectedEngineerId] = useState<string>('');
  const [isDispatchingEngineer, setIsDispatchingEngineer] =
    useState<boolean>(false);
  const [dispatchedBundle, setDispatchedBundle] =
    useState<DispatchedEngineerBundle | null>(null);
  const [copiedField, setCopiedField] = useState<'url' | 'sheet' | null>(null);

  // Публикация дубля из буфера ОТК клиенту
  const [publishVersionByTake, setPublishVersionByTake] = useState<
    Record<string, 'v1' | 'v2' | 'master'>
  >({});
  const [isPublishingTakeId, setIsPublishingTakeId] = useState<string | null>(
    null
  );

  // Решение продюсера по эскалации
  const [escalationNoteDraft, setEscalationNoteDraft] = useState<string>('');
  const [escalationBudgetDraft, setEscalationBudgetDraft] =
    useState<string>('');
  const [isResolvingEscalation, setIsResolvingEscalation] =
    useState<boolean>(false);

  useEffect(() => {
    setRosterDraft(soundEngineers);
  }, [soundEngineers]);

  const hydratedOrders = useMemo(
    () => orders.map((o) => ensureOrderApprovalWorkflow(o)),
    [orders]
  );

  const columnCounts = useMemo(() => {
    const counts: Record<StudioKanbanColumnId, number> = {
      col_script: 0,
      col_ready_for_sound: 0,
      col_with_engineer: 0,
      col_producer_qc: 0,
      col_client_acceptance: 0,
    };
    for (const ord of hydratedOrders) {
      const col = resolveStudioKanbanColumn(ord.approvalWorkflow);
      counts[col] += 1;
    }
    return counts;
  }, [hydratedOrders]);

  const visibleOrders = useMemo(() => {
    if (columnFilter === 'all') return hydratedOrders;
    return hydratedOrders.filter(
      (ord) => resolveStudioKanbanColumn(ord.approvalWorkflow) === columnFilter
    );
  }, [columnFilter, hydratedOrders]);

  const activeOrder = useMemo(() => {
    return (
      visibleOrders.find((o) => o.id === selectedOrderId) ??
      visibleOrders[0] ??
      hydratedOrders[0] ??
      null
    );
  }, [hydratedOrders, selectedOrderId, visibleOrders]);

  // Заполнение черновика сценария и выбранного звукорежиссёра при переключении заказа
  useEffect(() => {
    if (!activeOrder) return;
    const wf = activeOrder.approvalWorkflow;
    setTargetSlotDraft(wf.targetSlotSec);

    const latestDraft = wf.scriptVersions[0];
    const c1 = latestDraft?.concepts[0];
    const c2 = latestDraft?.concepts[1];

    setConcept1Title(
      c1?.title ??
        wf.lockedScript?.conceptTitle ??
        `Основная концепция (${wf.targetSlotSec} с)`
    );
    setConcept1Body(
      c1?.bodyText ?? wf.lockedScript?.bodyText ?? activeOrder.briefText ?? ''
    );
    setConcept1Stresses(c1?.stressNotes ?? wf.lockedScript?.stressNotes ?? '');
    setConcept1Disclaimer(
      c1?.fz38Disclaimer ?? wf.lockedScript?.fz38Disclaimer ?? ''
    );
    setConcept1Approach(
      c1?.directorApproach ??
        wf.lockedScript?.directorApproach ??
        'Уверенный коммерческий баритон, плотная лицензионная подложка, сведение −14 LUFS.'
    );

    if (c2) {
      setShowConcept2(true);
      setConcept2Title(c2.title);
      setConcept2Body(c2.bodyText);
      setConcept2Approach(c2.directorApproach);
    } else {
      setShowConcept2(false);
      setConcept2Title('Альтернативный заход');
      setConcept2Body('');
      setConcept2Approach(
        'Динамичная подача с акцентом на ключевую выгоду в первых 3 секундах.'
      );
    }

    const defaultEng =
      soundEngineers.find((e) => e.id === wf.assignedEngineerId) ??
      soundEngineers.find((e) => e.isDefault) ??
      soundEngineers[0];
    setSelectedEngineerId(defaultEng?.id ?? '');
    setEscalationBudgetDraft(String(activeOrder.totalBudgetRub || 25000));
    setEscalationNoteDraft('');
    setDispatchedBundle((prev) =>
      prev && prev.orderId === activeOrder.id ? prev : null
    );
  }, [activeOrder?.id, soundEngineers]); // eslint-disable-line react-hooks/exhaustive-deps

  const chronoPreview = useMemo(
    () => estimateRussianScriptDurationSec(concept1Body, concept1Disclaimer),
    [concept1Body, concept1Disclaimer]
  );

  const handleSaveRoster = async () => {
    setIsSavingRoster(true);
    try {
      const res = await fetch('/api/cms/sound-engineers', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...studioCmsStore.getAuthHeaders(),
        },
        body: JSON.stringify({ soundEngineers: rosterDraft }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        soundEngineers?: SoundEngineerContact[];
        error?: string;
      };
      if (!res.ok || !json.ok || !json.soundEngineers) {
        throw new Error(
          json.error ?? 'Не удалось сохранить справочник звукорежиссёров'
        );
      }
      onSoundEngineersUpdated(json.soundEngineers);
      onFeedback({
        kind: 'ok',
        text: 'Справочник звукорежиссёров обновлён — теперь любого исполнителя можно назначить в 1 клик без доступа к CRM.',
      });
    } catch (err) {
      onFeedback({
        kind: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Ошибка сохранения справочника звукорежиссёров',
      });
    } finally {
      setIsSavingRoster(false);
    }
  };

  const handlePublishScript = async () => {
    if (!activeOrder || isPublishingScript) return;
    if (concept1Body.trim().length < 10) {
      onFeedback({
        kind: 'error',
        text: 'Введите текст режиссёрского сценария перед отправкой клиенту (от 10 символов).',
      });
      return;
    }

    setIsPublishingScript(true);
    try {
      const conceptsPayload = [
        {
          label: showConcept2 ? 'Вариант 1 (Основной)' : 'Режиссёрский сценарий',
          title: concept1Title.trim() || 'Основная концепция',
          bodyText: concept1Body.trim(),
          stressNotes: concept1Stresses.trim(),
          fz38Disclaimer: concept1Disclaimer.trim(),
          directorApproach: concept1Approach.trim(),
        },
        ...(showConcept2 && concept2Body.trim().length >= 10
          ? [
              {
                label: 'Вариант 2',
                title: concept2Title.trim() || 'Альтернативная подача',
                bodyText: concept2Body.trim(),
                stressNotes: concept1Stresses.trim(),
                fz38Disclaimer: concept1Disclaimer.trim(),
                directorApproach: concept2Approach.trim(),
              },
            ]
          : []),
      ];

      const res = await fetch(
        `/api/cms/orders/${encodeURIComponent(activeOrder.id)}/approval/publish-script`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            ...studioCmsStore.getAuthHeaders(),
          },
          body: JSON.stringify({
            targetSlotSec: targetSlotDraft,
            concepts: conceptsPayload,
          }),
        }
      );
      const json = (await res.json()) as {
        ok?: boolean;
        order?: CrmOrderRecord;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.order) {
        throw new Error(
          json.error ?? 'Не удалось опубликовать режиссёрский сценарий'
        );
      }
      onOrderUpdated(json.order);
      onFeedback({
        kind: 'ok',
        text: `Режиссёрский сценарий по заказу #${json.order.orderNumber} опубликован в личный кабинет клиента с мгновенным push-оповещением.`,
      });
    } catch (err) {
      onFeedback({
        kind: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Ошибка публикации сценария клиенту',
      });
    } finally {
      setIsPublishingScript(false);
    }
  };

  const handleDispatchToEngineer = async (rotateToken = false) => {
    if (!activeOrder || isDispatchingEngineer) return;
    setIsDispatchingEngineer(true);
    try {
      const res = await fetch(
        `/api/cms/orders/${encodeURIComponent(activeOrder.id)}/approval/dispatch-engineer`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            ...studioCmsStore.getAuthHeaders(),
          },
          body: JSON.stringify({
            engineerId: selectedEngineerId,
            rotateToken,
          }),
        }
      );
      const json = (await res.json()) as {
        ok?: boolean;
        order?: CrmOrderRecord;
        dropPath?: string;
        dropUrl?: string;
        emailActionPath?: string;
        emailActionUrl?: string;
        soundEngineerEmail?: SoundEngineerEmailNotificationRecord;
        soundEngineerEmails?: SoundEngineerEmailNotificationRecord[];
        channelSummary?: string;
        sheet?: {
          subject: string;
          plainBody: string;
          htmlBody?: string;
          buttonLabel?: string;
          actionButtonUrl?: string;
          mailtoHref: string;
        };
        error?: string;
      };
      if (
        !res.ok ||
        !json.ok ||
        !json.order ||
        !json.dropPath ||
        !json.dropUrl ||
        !json.sheet
      ) {
        throw new Error(
          json.error ?? 'Не удалось сформировать техлист звукорежиссёру'
        );
      }
      onOrderUpdated(json.order);
      if (Array.isArray(json.soundEngineerEmails)) {
        onSoundEngineerEmailsUpdated?.(json.soundEngineerEmails);
      } else if (json.soundEngineerEmail) {
        onSoundEngineerEmailsUpdated?.(
          [
            json.soundEngineerEmail,
            ...soundEngineerEmails.filter(
              (m) => m.id !== json.soundEngineerEmail!.id
            ),
          ].slice(0, 30)
        );
      }
      setDispatchedBundle({
        orderId: json.order.id,
        dropPath: json.dropPath,
        dropUrl: json.dropUrl,
        emailActionPath: json.emailActionPath,
        emailActionUrl: json.emailActionUrl,
        channelSummary: json.channelSummary ?? '',
        sheet: json.sheet,
      });
      onFeedback({
        kind: 'ok',
        text: `${json.channelSummary ?? 'Техлист сформирован'} — в письмо добавлена кнопка «${SOUND_ENGINEER_EMAIL_CTA_LABEL}».`,
      });
    } catch (err) {
      onFeedback({
        kind: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Ошибка формирования техлиста звукорежиссёру',
      });
    } finally {
      setIsDispatchingEngineer(false);
    }
  };

  const handlePublishTakeToClient = async (takeId: string) => {
    if (!activeOrder || isPublishingTakeId) return;
    const preset = publishVersionByTake[takeId] ?? 'v1';
    setIsPublishingTakeId(takeId);
    try {
      const res = await fetch(
        `/api/cms/orders/${encodeURIComponent(activeOrder.id)}/approval/publish-take`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            ...studioCmsStore.getAuthHeaders(),
          },
          body: JSON.stringify({
            takeId,
            versionCode: preset,
            versionStage:
              preset === 'master'
                ? 'master'
                : preset === 'v2'
                  ? 'revision'
                  : 'draft',
          }),
        }
      );
      const json = (await res.json()) as {
        ok?: boolean;
        order?: CrmOrderRecord;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.order) {
        throw new Error(
          json.error ?? 'Не удалось опубликовать дубль в кабинет клиента'
        );
      }
      onOrderUpdated(json.order);
      onFeedback({
        kind: 'ok',
        text: `Проверенный ролик (${preset}) опубликован клиенту по заказу #${json.order.orderNumber} и отправлено push-оповещение.`,
      });
    } catch (err) {
      onFeedback({
        kind: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Ошибка публикации ролика клиенту',
      });
    } finally {
      setIsPublishingTakeId(null);
    }
  };

  const handleResolveEscalation = async (
    mode: 'loyal_included' | 'unified_invoice_adjusted'
  ) => {
    if (!activeOrder || isResolvingEscalation) return;
    const wf = activeOrder.approvalWorkflow;
    const pendingRev = wf.spotRevisions.find(
      (r) => r.status === 'awaiting_producer'
    );
    const parsedBudget = Number.parseInt(
      escalationBudgetDraft.replace(/\D/g, ''),
      10
    );

    setIsResolvingEscalation(true);
    try {
      const res = await fetch(
        `/api/cms/orders/${encodeURIComponent(activeOrder.id)}/approval/resolve-escalation`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            ...studioCmsStore.getAuthHeaders(),
          },
          body: JSON.stringify({
            revisionId: pendingRev?.id,
            mode,
            note: escalationNoteDraft.trim(),
            ...(mode === 'unified_invoice_adjusted' &&
            Number.isFinite(parsedBudget) &&
            parsedBudget > 0
              ? { newTotalBudgetRub: parsedBudget }
              : {}),
          }),
        }
      );
      const json = (await res.json()) as {
        ok?: boolean;
        order?: CrmOrderRecord;
        soundEngineerEmail?: SoundEngineerEmailNotificationRecord | null;
        soundEngineerEmails?: SoundEngineerEmailNotificationRecord[];
        error?: string;
      };
      if (!res.ok || !json.ok || !json.order) {
        throw new Error(json.error ?? 'Не удалось зафиксировать решение продюсера');
      }
      onOrderUpdated(json.order);
      if (Array.isArray(json.soundEngineerEmails)) {
        onSoundEngineerEmailsUpdated?.(json.soundEngineerEmails);
      }
      onFeedback({
        kind: 'ok',
        text:
          mode === 'loyal_included'
            ? `Запрос клиента по заказу #${json.order.orderNumber} принят лояльно в рамках текущего счёта.`
            : `Единый счёт по заказу #${json.order.orderNumber} обновлён без отдельных мелких счетов — задача в работе.`,
      });
    } catch (err) {
      onFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Ошибка решения по запросу',
      });
    } finally {
      setIsResolvingEscalation(false);
    }
  };

  const copyTextHelper = async (text: string, field: 'url' | 'sheet') => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        window.setTimeout(() => setCopiedField(null), 2000);
      }
    } catch {
      setCopiedField(null);
    }
  };

  return (
    <div data-testid="admin-production-kanban-view" className="space-y-5 tabular-nums">
      {/* Полоса 5 этапов студийного канбана + кнопка справочника звукорежиссёров */}
      <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-sm sm:text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
              Конвейер продакшна: режиссёрский мандат и шлюз звукорежиссёра
            </h2>
            <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
              Клиент видит 3 спокойных этапа · звукорежиссёр получает техлист на
              почту / в Telegram с однокнопочной ссылкой прямой сдачи файла
            </p>
          </div>

          <button
            type="button"
            data-testid="kanban-toggle-roster-btn"
            onClick={() => setIsRosterOpen((prev) => !prev)}
            className="min-h-[36px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#C83210] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Users className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>
              {isRosterOpen
                ? 'Скрыть справочник звукорежиссёров'
                : `Звукорежиссёры (${soundEngineers.length})`}
            </span>
          </button>
        </div>

        {/* 5 колонок канбана как быстрые фильтры очереди */}
        <div
          role="tablist"
          aria-label="Колонки студийного канбана"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 pt-1"
        >
          <button
            id="kanban-tab-btn-all"
            type="button"
            role="tab"
            aria-selected={columnFilter === 'all'}
            aria-controls="kanban-orders-tabpanel"
            tabIndex={columnFilter === 'all' ? 0 : -1}
            data-testid="kanban-col-filter-all"
            onClick={() => setColumnFilter('all')}
            onKeyDown={(e) => handleKanbanTabKeyDown(e, 'all')}
            className={`min-h-[54px] px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer flex flex-col justify-between ${
              columnFilter === 'all'
                ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:border-[#F4F3EF]'
                : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] border-[#111111]/10 dark:border-white/10 text-[#111111] dark:text-[#F4F3EF] hover:border-[#C83210]'
            }`}
          >
            <span
              className={`text-[11px] ${
                columnFilter === 'all'
                  ? 'text-white/85 dark:text-[#0D0D0F]/80'
                  : 'text-[#111111]/72 dark:text-[#F4F3EF]/72'
              }`}
            >
              Все колонки
            </span>
            <span className="text-xs font-bold">
              Все заказы ({hydratedOrders.length})
            </span>
          </button>

          {STUDIO_KANBAN_COLUMNS.map((col) => {
            const active = columnFilter === col.id;
            const count = columnCounts[col.id];
            return (
              <button
                id={`kanban-tab-btn-${col.id}`}
                key={col.id}
                type="button"
                role="tab"
                title={col.title}
                aria-selected={active}
                aria-controls="kanban-orders-tabpanel"
                tabIndex={active ? 0 : -1}
                data-testid={`kanban-col-filter-${col.id}`}
                onClick={() => setColumnFilter(col.id)}
                onKeyDown={(e) => handleKanbanTabKeyDown(e, col.id)}
                className={`min-h-[54px] px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer flex flex-col justify-between ${
                  active
                    ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:border-[#F4F3EF]'
                    : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] border-[#111111]/10 dark:border-white/10 text-[#111111] dark:text-[#F4F3EF] hover:border-[#C83210]'
                }`}
              >
                <span
                  className={`text-[11px] whitespace-nowrap ${
                    active
                      ? 'text-white/85 dark:text-[#0D0D0F]/80'
                      : 'text-[#111111]/72 dark:text-[#F4F3EF]/72'
                  }`}
                >
                  {col.stepCode} · {count} шт.
                </span>
                <span className="text-xs font-bold leading-snug whitespace-nowrap truncate">
                  {col.shortTitle}
                </span>
              </button>
            );
          })}
        </div>

        {/* Раскрывающийся справочник внешних звукорежиссёров (смена за 5 секунд без обучения CRM) */}
        {isRosterOpen && (
          <div
            data-testid="kanban-engineer-roster-panel"
            className="pt-4 border-t border-[#111111]/10 dark:border-white/10 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]">
                Справочник звукорежиссёров (получают только чистый техлист без цен и
                контактов клиента)
              </p>
              <button
                type="button"
                onClick={() =>
                  setRosterDraft((prev) => [
                    ...prev,
                    {
                      id: `eng-${Date.now()}`,
                      name: 'Новый звукорежиссёр',
                      specialization: 'Эфирный мастеринг −14 LUFS',
                      email: '',
                      telegramChatId: '',
                      isDefault: prev.length === 0,
                    },
                  ])
                }
                className="min-h-[32px] px-3 py-1 rounded-lg border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Добавить специалиста</span>
              </button>
            </div>

            <div className="space-y-2">
              {rosterDraft.map((eng, index) => (
                <div
                  key={eng.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F]"
                >
                  <input
                    type="text"
                    aria-label="Имя звукорежиссёра"
                    value={eng.name}
                    onChange={(e) =>
                      setRosterDraft((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, name: e.target.value } : item
                        )
                      )
                    }
                    placeholder="Имя и фамилия"
                    className="sm:col-span-3 min-h-[36px] px-2.5 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 text-xs"
                  />
                  <input
                    type="text"
                    aria-label="Специализация"
                    value={eng.specialization}
                    onChange={(e) =>
                      setRosterDraft((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, specialization: e.target.value }
                            : item
                        )
                      )
                    }
                    placeholder="Специализация"
                    className="sm:col-span-4 min-h-[36px] px-2.5 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 text-xs"
                  />
                  <input
                    type="email"
                    aria-label="Почта звукорежиссёра"
                    value={eng.email}
                    onChange={(e) =>
                      setRosterDraft((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, email: e.target.value } : item
                        )
                      )
                    }
                    placeholder="sound@studio.ru"
                    className="sm:col-span-3 min-h-[36px] px-2.5 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 text-xs"
                  />
                  <div className="sm:col-span-2 flex items-center gap-1.5">
                    <input
                      type="text"
                      aria-label="Telegram Chat ID"
                      value={eng.telegramChatId}
                      onChange={(e) =>
                        setRosterDraft((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? { ...item, telegramChatId: e.target.value }
                              : item
                          )
                        )
                      }
                      placeholder="TG Chat ID"
                      className="flex-1 min-w-0 min-h-[36px] px-2 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 text-xs"
                    />
                    {rosterDraft.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Удалить ${eng.name}`}
                        onClick={() =>
                          setRosterDraft((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                        className="min-h-[36px] min-w-[36px] px-2 inline-flex items-center justify-center rounded-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#B91C1C] dark:hover:text-[#F87171] cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={isSavingRoster}
                data-testid="kanban-save-roster-btn"
                onClick={() => void handleSaveRoster()}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#C83210] hover:bg-[#AE2A0C] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {isSavingRoster
                  ? 'Сохранение…'
                  : 'Сохранить справочник звукорежиссёров'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Рабочая область: очередь заказов слева + инспектор конвейера справа */}
      <div
        id="kanban-orders-tabpanel"
        role="tabpanel"
        aria-labelledby={`kanban-tab-btn-${columnFilter}`}
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
      >
        <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 divide-y divide-[#111111]/8 dark:divide-white/8 overflow-hidden">
          {visibleOrders.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <p className="text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]">
                В выбранной колонке сейчас нет заказов
              </p>
              <button
                type="button"
                onClick={() => setColumnFilter('all')}
                className="min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold text-[#B82D0D] dark:text-[#FF7A5C] hover:underline cursor-pointer"
              >
                Показать все заказы ({hydratedOrders.length})
              </button>
            </div>
          ) : (
            visibleOrders.map((ord) => {
              const wf = ord.approvalWorkflow;
              const colId = resolveStudioKanbanColumn(wf);
              const colMeta = STUDIO_KANBAN_COLUMNS.find((c) => c.id === colId);
              const turn = resolveWhoseTurn(wf);
              const isSelected = activeOrder?.id === ord.id;
              const pendingQcCount = wf.pendingEngineerTakes.filter(
                (t) => t.status === 'pending_qc'
              ).length;

              return (
                <button
                  key={ord.id}
                  type="button"
                  data-testid={`kanban-order-item-${ord.orderNumber}`}
                  onClick={() => onSelectOrderId(ord.id)}
                  className={`w-full p-4 text-left transition-colors cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-[#C83210]/8 dark:bg-[#FF7A5C]/12'
                      : 'hover:bg-[#F7F6F2] dark:hover:bg-[#0D0D0F]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                      #{ord.orderNumber} · {wf.targetSlotSec} с
                    </span>
                    <span className="text-[11px] font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72">
                      {colMeta?.stepCode}. {colMeta?.title}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-[#111111]/85 dark:text-[#F4F3EF]/85 line-clamp-1">
                    {ord.companyOrInn || ord.contact}
                  </p>

                  <p
                    className={`text-[11px] font-semibold ${
                      turn.actor === 'producer'
                        ? 'text-[#B82D0D] dark:text-[#FF7A5C]'
                        : turn.actor === 'completed'
                          ? 'text-[#166534] dark:text-[#4ADE80]'
                          : 'text-[#111111]/72 dark:text-[#F4F3EF]/72'
                    }`}
                  >
                    {turn.labelForProducer}
                    {pendingQcCount > 0 ? ` · дублей в ОТК: ${pendingQcCount}` : ''}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Правый пульт управления конвейером выбранного заказа */}
        {activeOrder && (
          <div
            data-testid={`kanban-inspector-${activeOrder.orderNumber}`}
            className="lg:col-span-8 rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 space-y-6"
          >
            {/* Шапка выбранного заказа */}
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#111111]/10 dark:border-white/10">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  <span className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                    #{activeOrder.orderNumber}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeOrder.formatLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[#B82D0D] dark:text-[#FF7A5C]">
                    {resolveWhoseTurn(activeOrder.approvalWorkflow).labelForProducer}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#111111] dark:text-[#F4F3EF]">
                  {activeOrder.companyOrInn || activeOrder.contact}
                </h3>
                <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  Бюджет договора: {formatRubCompact(activeOrder.totalBudgetRub)} ·{' '}
                  Сервисный раунд доводки:{' '}
                  <strong>
                    {activeOrder.approvalWorkflow.serviceRoundUsed
                      ? 'использован без доплат'
                      : 'в запасе (1 раунд зашит в цену)'}
                  </strong>
                </p>
              </div>
            </div>

            {/* Визуальная история перемещений заказа по этапам */}
            <OrderStageHistoryTimeline
              order={activeOrder}
              assignedEngineerName={
                soundEngineers.find(
                  (eng) => eng.id === activeOrder.approvalWorkflow.assignedEngineerId
                )?.name ?? null
              }
              compact
            />

            {/* БЛОК А: Буфер ОТК продюсера (если звукорежиссёр загрузил дубль по прямой ссылке) */}
            {activeOrder.approvalWorkflow.pendingEngineerTakes.filter(
              (t) => t.status === 'pending_qc'
            ).length > 0 && (
              <section
                data-testid="kanban-qc-buffer-section"
                className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-[#B82D0D] dark:text-[#FF7A5C]">
                    Буфер ОТК продюсера: проверьте сданный файл перед отправкой
                    клиенту
                  </h4>
                </div>

                <div className="space-y-3">
                  {activeOrder.approvalWorkflow.pendingEngineerTakes
                    .filter((t) => t.status === 'pending_qc')
                    .map((take) => {
                      const fit = evaluateBroadcastSlotFit(
                        take.measuredDurationSec,
                        take.targetSlotSec
                      );
                      const chosenVer = publishVersionByTake[take.id] ?? 'v1';

                      return (
                        <div
                          key={take.id}
                          data-testid={`kanban-qc-take-${take.id}`}
                          className="pt-3 first:pt-0 border-t first:border-t-0 border-[#111111]/10 dark:border-white/10 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                              {take.fileName} ({formatFileSizeReadable(take.sizeBytes)}) ·
                              сдал {take.engineerName}{' '}
                              {formatShortTimeRu(take.uploadedAt)}
                            </span>
                            <span
                              className={`font-semibold ${
                                fit.status === 'exact'
                                  ? 'text-[#166534] dark:text-[#4ADE80]'
                                  : fit.status === 'tolerance_warning'
                                    ? 'text-[#92400E] dark:text-[#FBBF24]'
                                    : 'text-[#B91C1C] dark:text-[#F87171]'
                              }`}
                            >
                              {fit.badgeText}
                            </span>
                          </div>

                          {take.engineerNote && (
                            <p className="text-xs text-[#111111]/75 dark:text-[#F4F3EF]/75">
                              Пометка звукорежиссёра: «{take.engineerNote}»
                            </p>
                          )}

                          <audio
                            controls
                            preload="metadata"
                            src={`/api/cms/orders/${encodeURIComponent(activeOrder.id)}/approval/takes/${encodeURIComponent(take.id)}/audio`}
                            className="w-full h-9"
                          />

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="inline-flex items-center gap-1.5 text-xs">
                              <span className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
                                Метка версии:
                              </span>
                              {(['v1', 'v2', 'master'] as const).map((ver) => (
                                <button
                                  key={ver}
                                  type="button"
                                  onClick={() =>
                                    setPublishVersionByTake((prev) => ({
                                      ...prev,
                                      [take.id]: ver,
                                    }))
                                  }
                                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer whitespace-nowrap shrink-0 ${
                                    chosenVer === ver
                                      ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                                      : 'bg-white dark:bg-[#141418] border-[#111111]/12 dark:border-white/12'
                                  }`}
                                >
                                  {ver === 'master' ? 'master (финал)' : ver}
                                </button>
                              ))}
                            </div>

                            <button
                              type="button"
                              disabled={isPublishingTakeId === take.id}
                              data-testid={`kanban-publish-take-btn-${take.id}`}
                              onClick={() => void handlePublishTakeToClient(take.id)}
                              className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#C83210] hover:bg-[#AE2A0C] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>
                                {isPublishingTakeId === take.id
                                  ? 'Публикация…'
                                  : 'Опубликовать клиенту'}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
            )}

            {/* БЛОК Б: Решение продюсера по эскалации (запрос сверх сервисного раунда или перечитка текста) */}
            {activeOrder.approvalWorkflow.phase === 'producer_escalation' && (
              <section
                data-testid="kanban-escalation-section"
                className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] space-y-3"
              >
                <h4 className="text-xs sm:text-sm font-bold text-[#B82D0D] dark:text-[#FF7A5C]">
                  Запрос клиента требует решения продюсера (без микро-счетов)
                </h4>

                {activeOrder.approvalWorkflow.spotRevisions
                  .filter((r) => r.status === 'awaiting_producer')
                  .map((rev) => (
                    <div key={rev.id} className="text-xs space-y-1">
                      <p className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                        {SPOT_REVISION_KIND_LABELS[rev.kind]}
                        {typeof rev.timecodeSec === 'number'
                          ? ` · таймкод ${rev.timecodeSec.toFixed(1)} с`
                          : ''}
                      </p>
                      <p className="text-[#111111]/76 dark:text-[#F4F3EF]/76">
                        «{rev.comment}»
                      </p>
                    </div>
                  ))}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="kanban-escalation-note"
                      className="block text-[11px] font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72 mb-1"
                    >
                      Комментарий для звукорежиссёра и клиента
                    </label>
                    <input
                      id="kanban-escalation-note"
                      type="text"
                      value={escalationNoteDraft}
                      onChange={(e) => setEscalationNoteDraft(e.target.value)}
                      placeholder="Например: согласовали с руководителем проекта, делаем оперативно…"
                      className="w-full min-h-[38px] px-3 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-xs"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="kanban-escalation-budget"
                      className="block text-[11px] font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72 mb-1"
                    >
                      Сумма единого счёта, ₽
                    </label>
                    <input
                      id="kanban-escalation-budget"
                      type="text"
                      inputMode="numeric"
                      value={escalationBudgetDraft}
                      onChange={(e) => setEscalationBudgetDraft(e.target.value)}
                      className="w-full min-h-[38px] px-3 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/14 dark:border-white/14 text-xs tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isResolvingEscalation}
                    data-testid="kanban-resolve-loyal-btn"
                    onClick={() => void handleResolveEscalation('loyal_included')}
                    className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#111111] hover:bg-[#C83210] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#C83210] dark:hover:text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    Выполнить лояльно в текущем счёте
                  </button>
                  <button
                    type="button"
                    disabled={isResolvingEscalation}
                    data-testid="kanban-resolve-adjust-invoice-btn"
                    onClick={() =>
                      void handleResolveEscalation('unified_invoice_adjusted')
                    }
                    className="min-h-[38px] px-4 py-1.5 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#C83210] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    Обновить сумму единого счёта
                  </button>
                </div>
              </section>
            )}

            {/* БЛОК В: Шлюз звукорежиссёра (Почта / Telegram + однокнопочная ссылка /sound-drop) */}
            <section
              data-testid="kanban-sound-dispatch-section"
              className="space-y-3 pb-5 border-b border-[#111111]/10 dark:border-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                  02. Задание звукорежиссёру и прямая ссылка сдачи файла
                </h4>
                {activeOrder.approvalWorkflow.lastDispatchedToEngineerAt && (
                  <span className="text-[11px] text-[#166534] dark:text-[#4ADE80] font-medium">
                    Отправлено{' '}
                    {formatShortTimeRu(
                      activeOrder.approvalWorkflow.lastDispatchedToEngineerAt
                    )}
                  </span>
                )}
              </div>

              <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2.5 min-w-0">
                <select
                  aria-label="Выбрать звукорежиссёра"
                  data-testid="kanban-engineer-select"
                  value={selectedEngineerId}
                  onChange={(e) => setSelectedEngineerId(e.target.value)}
                  className="flex-1 min-w-0 w-full min-h-[40px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-medium truncate"
                >
                  {soundEngineers.map((eng) => (
                    <option key={eng.id} value={eng.id}>
                      {eng.name} ({eng.email || 'без почты'})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={isDispatchingEngineer}
                  data-testid="kanban-dispatch-engineer-btn"
                  onClick={() => void handleDispatchToEngineer(false)}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#C83210] hover:bg-[#AE2A0C] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {isDispatchingEngineer
                      ? 'Формирование…'
                      : 'Сформировать техлист и ссылку'}
                  </span>
                </button>
              </div>

              {dispatchedBundle && dispatchedBundle.orderId === activeOrder.id && (
                <div
                  data-testid="kanban-dispatched-sheet-box"
                  className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                      Кнопка в письме звукорежиссёра и прямая ссылка сдачи (7 дней):
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {dispatchedBundle.emailActionPath && (
                        <a
                          href={dispatchedBundle.emailActionPath}
                          data-testid="kanban-dispatched-email-submit-btn"
                          className="min-h-[34px] px-3.5 py-1.5 rounded-lg bg-[#C83210] hover:bg-[#AE2A0C] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                        >
                          <span>{SOUND_ENGINEER_EMAIL_CTA_LABEL}</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      )}

                      <button
                        type="button"
                        data-testid="kanban-copy-drop-url"
                        onClick={() =>
                          void copyTextHelper(dispatchedBundle.dropUrl, 'url')
                        }
                        className="min-h-[32px] px-3 py-1 rounded-lg border border-[#111111]/14 dark:border-white/14 hover:border-[#C83210] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {copiedField === 'url' ? (
                          <Check
                            className="w-3.5 h-3.5 text-[#166534] dark:text-[#4ADE80]"
                            aria-hidden="true"
                          />
                        ) : (
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>
                          {copiedField === 'url'
                            ? 'Ссылка скопирована'
                            : 'Скопировать ссылку сдачи'}
                        </span>
                      </button>

                      <a
                        href={dispatchedBundle.dropPath}
                        data-testid="kanban-open-drop-link"
                        className="min-h-[32px] px-3 py-1 rounded-lg border border-[#111111]/14 dark:border-white/14 hover:border-[#C83210] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <span>Открыть экран сдачи</span>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    </div>
                  </div>

                  <input
                    type="text"
                    readOnly
                    aria-label="Прямая ссылка сдачи аудиофайла"
                    data-testid="kanban-drop-url-input"
                    value={dispatchedBundle.dropUrl}
                    className="w-full min-h-[36px] px-3 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 text-xs font-mono"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="kanban-copy-full-sheet"
                      onClick={() =>
                        void copyTextHelper(
                          dispatchedBundle.sheet.plainBody,
                          'sheet'
                        )
                      }
                      className="min-h-[34px] px-3.5 py-1.5 rounded-lg bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {copiedField === 'sheet' ? (
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>
                        {copiedField === 'sheet'
                          ? 'Техлист скопирован'
                          : 'Скопировать письмо целиком'}
                      </span>
                    </button>

                    {dispatchedBundle.sheet.mailtoHref && (
                      <a
                        href={dispatchedBundle.sheet.mailtoHref}
                        className="min-h-[34px] px-3.5 py-1.5 rounded-lg border border-[#111111]/14 dark:border-white/14 hover:border-[#C83210] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Открыть в почтовой программе</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Почтовый журнал уведомлений звукорежиссёру при смене статуса заказа с активной кнопкой «Сдать файл на проверку» */}
              {(() => {
                const orderEmails = soundEngineerEmails.filter(
                  (m) => m.orderId === activeOrder.id
                );
                const latestEmail = orderEmails[0];
                if (!latestEmail) return null;

                return (
                  <div
                    data-testid="kanban-engineer-email-preview-card"
                    className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 text-xs">
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                          Отправленное e-mail уведомление звукорежиссёру ·{' '}
                          {latestEmail.engineerName} ({latestEmail.engineerEmail})
                        </p>
                        <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72">
                          Тема: <strong>{latestEmail.subject}</strong> · Статус:{' '}
                          {latestEmail.previousStageLabel
                            ? `${latestEmail.previousStageLabel} → ${latestEmail.currentStageLabel}`
                            : latestEmail.currentStageLabel}
                          {latestEmail.clickedCount > 0
                            ? ` · Переходов по кнопке: ${latestEmail.clickedCount}`
                            : ''}
                        </p>
                      </div>

                      <a
                        href={latestEmail.emailActionPath}
                        data-testid="kanban-email-cta-submit-file-btn"
                        className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#C83210] hover:bg-[#AE2A0C] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>{latestEmail.buttonLabel}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      </a>
                    </div>

                    <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72">
                      При нажатии на кнопку «{latestEmail.buttonLabel}» в письме
                      автоматически генерируется свежая уникальная ссылка-токен{' '}
                      <code className="font-mono">/sound-drop?token=…</code> для
                      прямой загрузки мастер-файла без авторизации в админ-панели.
                    </p>
                  </div>
                );
              })()}
            </section>

            {/* БЛОК Г: Подготовка и публикация режиссёрского сценария клиенту */}
            <section
              data-testid="kanban-script-editor-section"
              className="space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                  01. Режиссёрский сценарий для клиента (без промежуточных кастингов)
                </h4>
                <span className="text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  Хронометраж текста: ~{chronoPreview.estimatedSec} с (
                  {chronoPreview.wordsCount} сл.) при слоте {targetSlotDraft} с
                </span>
              </div>

              {activeOrder.approvalWorkflow.scriptVersions[0]?.clientComment && (
                <div className="p-3 rounded-xl bg-[#C83210]/10 text-xs space-y-0.5">
                  <p className="font-bold text-[#B82D0D] dark:text-[#FF7A5C]">
                    Замечание клиента к сценарию v
                    {activeOrder.approvalWorkflow.scriptVersions[0].versionNumber}:
                  </p>
                  <p className="text-[#111111] dark:text-[#F4F3EF]">
                    «{activeOrder.approvalWorkflow.scriptVersions[0].clientComment}»
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label
                    htmlFor="kanban-target-slot"
                    className="block text-[11px] font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72 mb-1"
                  >
                    Эфирный слот
                  </label>
                  <select
                    id="kanban-target-slot"
                    value={targetSlotDraft}
                    onChange={(e) =>
                      setTargetSlotDraft(Number.parseInt(e.target.value, 10) || 20)
                    }
                    className="w-full min-h-[38px] px-3 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-semibold"
                  >
                    <option value={10}>10,00 секунд</option>
                    <option value={15}>15,00 секунд</option>
                    <option value={20}>20,00 секунд</option>
                    <option value={30}>30,00 секунд</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label
                    htmlFor="kanban-concept1-title"
                    className="block text-[11px] font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72 mb-1"
                  >
                    Название концепции
                  </label>
                  <input
                    id="kanban-concept1-title"
                    type="text"
                    value={concept1Title}
                    onChange={(e) => setConcept1Title(e.target.value)}
                    className="w-full min-h-[38px] px-3 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="kanban-concept1-body"
                  className="block text-[11px] font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72 mb-1"
                >
                  Чистовой текст ролика для озвучивания
                </label>
                <textarea
                  id="kanban-concept1-body"
                  rows={3}
                  data-testid="kanban-script-body-input"
                  value={concept1Body}
                  onChange={(e) => setConcept1Body(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="kanban-concept1-stresses"
                    className="block text-[11px] font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72 mb-1"
                  >
                    Ударения и произношение брендов
                  </label>
                  <input
                    id="kanban-concept1-stresses"
                    type="text"
                    value={concept1Stresses}
                    onChange={(e) => setConcept1Stresses(e.target.value)}
                    placeholder="напр. Трансфло́т, ли́зинг"
                    className="w-full min-h-[38px] px-3 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
                  />
                </div>

                <div>
                  <label
                    htmlFor="kanban-concept1-disclaimer"
                    className="block text-[11px] font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72 mb-1"
                  >
                    Обязательный дисклеймер ФЗ-38
                  </label>
                  <input
                    id="kanban-concept1-disclaimer"
                    type="text"
                    value={concept1Disclaimer}
                    onChange={(e) => setConcept1Disclaimer(e.target.value)}
                    placeholder="напр. ООО «Компания». Подробности на сайте."
                    className="w-full min-h-[38px] px-3 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="kanban-concept1-approach"
                  className="block text-[11px] font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72 mb-1"
                >
                  Режиссёрская экспликация студии (характер диктора и музыки)
                </label>
                <input
                  id="kanban-concept1-approach"
                  type="text"
                  value={concept1Approach}
                  onChange={(e) => setConcept1Approach(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
                />
              </div>

              {showConcept2 && (
                <div className="pt-3 border-t border-[#111111]/10 dark:border-white/10 space-y-2.5">
                  <input
                    type="text"
                    aria-label="Название второго варианта сценария"
                    value={concept2Title}
                    onChange={(e) => setConcept2Title(e.target.value)}
                    placeholder="Название варианта 2"
                    className="w-full min-h-[36px] px-3 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
                  />
                  <textarea
                    rows={2}
                    aria-label="Текст второго варианта сценария"
                    value={concept2Body}
                    onChange={(e) => setConcept2Body(e.target.value)}
                    placeholder="Текст второго варианта сценария…"
                    className="w-full px-3 py-2 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConcept2((prev) => !prev)}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#111111]/14 dark:border-white/14 hover:border-[#C83210] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  {showConcept2
                    ? 'Оставить 1 основной вариант'
                    : '+ Добавить вариант 2 (на выбор)'}
                </button>

                <button
                  type="button"
                  disabled={isPublishingScript}
                  data-testid="kanban-publish-script-btn"
                  onClick={() => void handlePublishScript()}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#C83210] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#C83210] dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  {isPublishingScript
                    ? 'Публикация…'
                    : 'Опубликовать сценарий клиенту'}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
