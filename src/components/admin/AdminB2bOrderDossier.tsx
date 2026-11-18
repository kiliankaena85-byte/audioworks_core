import {
  Building2,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  Scale,
  Send,
  Trash2,
  Upload,
  UserX,
} from 'lucide-react';
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type B2bRegulatoryCategoryId,
  evaluateB2bSpotRegulatoryTimingAudit,
  resolveOrderTargetSlotSeconds,
} from '../../data/b2bContractLedgerCore';
import {
  formatFileSizeReadable,
  type OrderDeliverableKind,
  resolveDeliveryChannelLabel,
} from '../../data/clientCabinetHelpers';
import {
  type DeliverableVersionPreset,
  suggestNextAudioVersionCode,
} from '../../data/deliverableVersioning';
import type { KonturIntegrationStatus } from '../../data/konturIntegrationCore';
import {
  CRM_ORDER_STAGES,
  type CrmOrderRecord,
  type CrmOrderStage,
  type ExternalDeliveryState,
  getCrmStageMetaForOrder,
  type OrderComplianceChecklist,
} from '../../data/orderCrmTypes';
import {
  CRM_STAGE_RETURN_NOTE_PRESETS,
  type SoundEngineerContact,
  type SoundEngineerEmailNotificationRecord,
} from '../../data/productionApprovalWorkflow';
import { formatRubCompact } from '../../data/radioInventory';
import {
  assembleProductionDocumentSuite,
  type OrderDocumentMeta,
  type StudioLegalProfilesConfig,
} from '../../data/studioDocumentsCore';
import { resolveNextTabIdOnArrowKey } from '../../security/adminSessionStandards';
import { OrderStageHistoryTimeline } from './OrderStageHistoryTimeline';

export type B2bDossierTabId = 'contract' | 'fz38' | 'deliverables';

const DOSSIER_TAB_IDS: readonly B2bDossierTabId[] = [
  'contract',
  'fz38',
  'deliverables',
];

export interface PatchOrderPayload {
  stage?: CrmOrderStage;
  stageNote?: string;
  producerNotes?: string;
  compliance?: Partial<OrderComplianceChecklist>;
  documentMeta?: OrderDocumentMeta;
  totalBudgetRub?: number;
  cloudDiskUrl?: string | null;
  removeDeliverableId?: string;
}

export interface AdminB2bOrderDossierProps {
  order: CrmOrderRecord;
  legalProfiles: StudioLegalProfilesConfig;
  konturStatus: KonturIntegrationStatus | null;
  soundEngineers: SoundEngineerContact[];
  soundEngineerEmails: SoundEngineerEmailNotificationRecord[];
  isUpdatingOrder: boolean;
  isCreatingDiadocDraft: boolean;
  isUploadingDeliverable: boolean;
  isRedelivering: boolean;
  onPatchOrder: (
    orderId: string,
    payload: PatchOrderPayload,
    successMessage?: string
  ) => Promise<void>;
  onOpenDocumentsModal: (order: CrmOrderRecord) => void;
  onCreateDiadocDraft: (order: CrmOrderRecord) => Promise<void>;
  onDownloadExternCsv: (order: CrmOrderRecord) => void;
  onUploadDeliverableFile: (
    order: CrmOrderRecord,
    file: File | null,
    meta: {
      title: string;
      kind: OrderDeliverableKind;
      versionCode?: DeliverableVersionPreset;
      versionNote?: string;
    }
  ) => Promise<boolean>;
  onRedeliverGateways: (orderId: string) => Promise<void>;
  onAnonymizePdn: (order: CrmOrderRecord) => Promise<void>;
  onOpenRknDestructionAct?: (order: CrmOrderRecord) => void;
  onOpenProductionVoiceover?: (orderId: string) => void;
}

function getSourceReadableLabel(source: CrmOrderRecord['source']): string {
  if (source === 'quick_order_drawer') return 'Быстрая заявка';
  if (source === 'standalone_hold_modal') return 'Конфигуратор';
  return 'Форма договора-заказа';
}

function getDeliveryStatePresentation(state: ExternalDeliveryState): {
  label: string;
  colorClass: string;
} {
  if (state === 'delivered') {
    return {
      label: 'Доставлено (200 OK)',
      colorClass: 'text-[#166534] dark:text-[#4ADE80]',
    };
  }
  if (state === 'failed') {
    return {
      label: 'Ошибка доставки',
      colorClass: 'text-[#B91C1C] dark:text-[#F87171]',
    };
  }
  if (state === 'not_configured') {
    return {
      label: 'Не подключено',
      colorClass: 'text-[#111111]/70 dark:text-[#F4F3EF]/70',
    };
  }
  return {
    label: 'В очереди отправки',
    colorClass: 'text-[#92400E] dark:text-[#FBBF24]',
  };
}

export function AdminB2bOrderDossier({
  order,
  legalProfiles,
  konturStatus,
  soundEngineers,
  soundEngineerEmails,
  isUpdatingOrder,
  isCreatingDiadocDraft,
  isUploadingDeliverable,
  isRedelivering,
  onPatchOrder,
  onOpenDocumentsModal,
  onCreateDiadocDraft,
  onDownloadExternCsv,
  onUploadDeliverableFile,
  onRedeliverGateways,
  onAnonymizePdn,
  onOpenRknDestructionAct,
  onOpenProductionVoiceover,
}: AdminB2bOrderDossierProps) {
  const [dossierTab, setDossierTab] = useState<B2bDossierTabId>('contract');
  const [notesDraft, setNotesDraft] = useState<string>(order.producerNotes);
  const [cloudDiskDraft, setCloudDiskDraft] = useState<string>(
    order.cloudDiskUrl ?? ''
  );

  // Локальные поля загрузки выдачи в Личный кабинет клиента
  const [deliverableTitleDraft, setDeliverableTitleDraft] =
    useState<string>('');
  const [deliverableKindDraft, setDeliverableKindDraft] =
    useState<OrderDeliverableKind>('audio_master');
  const [deliverableVersionDraft, setDeliverableVersionDraft] =
    useState<DeliverableVersionPreset>('auto');
  const [deliverableVersionNoteDraft, setDeliverableVersionNoteDraft] =
    useState<string>('');
  const deliverableFileRef = useRef<HTMLInputElement | null>(null);

  // Поля нормативно-хронометражной экспертизы ФЗ-38
  const defaultSlotSec = useMemo(
    () => resolveOrderTargetSlotSeconds(order),
    [order]
  );
  const initialScriptOrBrief = useMemo(() => {
    const wf = order.approvalWorkflow;
    const lockedBody = wf?.lockedScript?.bodyText?.trim();
    if (lockedBody) return lockedBody;
    const latestDraft = wf?.scriptVersions?.[wf.scriptVersions.length - 1];
    const firstConceptBody = latestDraft?.concepts?.[0]?.bodyText?.trim();
    return firstConceptBody || order.briefText || '';
  }, [order]);

  const [auditSlotSec, setAuditSlotSec] = useState<number>(defaultSlotSec);
  const [auditCategory, setAuditCategory] =
    useState<B2bRegulatoryCategoryId>('auto');
  const [auditText, setAuditText] = useState<string>(initialScriptOrBrief);
  const [confirmingAnonymize, setConfirmingAnonymize] =
    useState<boolean>(false);
  const [confirmingRemoveDeliverableId, setConfirmingRemoveDeliverableId] =
    useState<string | null>(null);
  const [stageNoteDraft, setStageNoteDraft] = useState<string>('');

  useEffect(() => {
    setNotesDraft(order.producerNotes);
    setCloudDiskDraft(order.cloudDiskUrl ?? '');
    setAuditSlotSec(resolveOrderTargetSlotSeconds(order));
    const wf = order.approvalWorkflow;
    const lockedBody = wf?.lockedScript?.bodyText?.trim();
    const latestDraft = wf?.scriptVersions?.[wf.scriptVersions.length - 1];
    const conceptBody =
      lockedBody || latestDraft?.concepts?.[0]?.bodyText?.trim();
    setAuditText(conceptBody || order.briefText || '');
    setAuditCategory('auto');
    setConfirmingAnonymize(false);
    setConfirmingRemoveDeliverableId(null);
    setStageNoteDraft('');
  }, [order]);

  const handleDossierTabKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    currentId: B2bDossierTabId
  ) => {
    const next = resolveNextTabIdOnArrowKey(DOSSIER_TAB_IDS, currentId, e.key);
    if (!next) return;
    e.preventDefault();
    setDossierTab(next);
    document.getElementById(`dossier-tab-btn-${next}`)?.focus();
  };

  const stageMeta = useMemo(
    () => getCrmStageMetaForOrder(order.stage, 'production_only'),
    [order.stage]
  );

  const prevStageMeta = useMemo(() => {
    const idx = CRM_ORDER_STAGES.findIndex((st) => st.id === order.stage);
    if (idx <= 0) return null;
    const prevId = CRM_ORDER_STAGES[idx - 1].id;
    return getCrmStageMetaForOrder(prevId, 'production_only');
  }, [order.stage]);

  const orderSuite = useMemo(
    () =>
      assembleProductionDocumentSuite({
        orderNumber: order.orderNumber,
        createdAtIso: order.createdAt,
        formatLabel: order.formatLabel,
        baseBudgetRub: order.totalBudgetRub,
        defaultDurationSec: defaultSlotSec,
        contact: order.contact,
        companyOrInn: order.companyOrInn,
        briefText: order.briefText,
        legalProfiles,
        documentMeta: order.documentMeta ?? null,
      }),
    [order, defaultSlotSec, legalProfiles]
  );

  const timingAudit = useMemo(
    () =>
      evaluateB2bSpotRegulatoryTimingAudit({
        text: auditText,
        targetSlotSec: auditSlotSec,
        categoryOverride: auditCategory,
        nicheHint: order.mediaPlanSnapshot?.nicheId ?? null,
      }),
    [auditText, auditSlotSec, auditCategory, order.mediaPlanSnapshot?.nicheId]
  );

  const draftState = order.documentMeta?.diadocDraftState;
  const tgPres = getDeliveryStatePresentation(order.delivery.telegram.state);
  const whPres = getDeliveryStatePresentation(order.delivery.webhook.state);
  const latestEngineerMail = soundEngineerEmails.find(
    (m) => m.orderId === order.id
  );

  const handleTriggerFileUpload = async (file: File | null) => {
    const ok = await onUploadDeliverableFile(order, file, {
      title: deliverableTitleDraft,
      kind: deliverableKindDraft,
      versionCode:
        deliverableKindDraft === 'audio_master'
          ? deliverableVersionDraft
          : undefined,
      versionNote: deliverableVersionNoteDraft,
    });
    if (ok) {
      setDeliverableTitleDraft('');
      setDeliverableVersionDraft('auto');
      setDeliverableVersionNoteDraft('');
    }
    if (deliverableFileRef.current) {
      deliverableFileRef.current.value = '';
    }
  };

  const barCreativeWidth = Math.round(timingAudit.creativeSharePct * 10);
  const barDisclaimerWidth = Math.round(timingAudit.disclaimerSharePct * 10);

  return (
    <section
      aria-label={`Договорное досье сделки ${order.orderNumber}`}
      data-testid="crm-order-inspector"
      className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 space-y-5 tabular-nums"
    >
      {/* Верхний паспорт выбранной сделки + управление этапом */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-5 border-b border-[#111111]/10 dark:border-white/10">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
            <span className="font-bold text-[#111111] dark:text-[#F4F3EF]">
              Сделка #{order.orderNumber}
            </span>
            <span aria-hidden="true">·</span>
            <span>Счёт {orderSuite.invoiceNumber}</span>
            <span aria-hidden="true">·</span>
            <span>Договор {orderSuite.contractNumber}</span>
            <span aria-hidden="true">·</span>
            <span>{getSourceReadableLabel(order.source)}</span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] truncate">
            {orderSuite.customer.displayName || order.companyOrInn || order.contact}
          </h2>

          <p className="text-xs text-[#111111]/74 dark:text-[#F4F3EF]/74 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              Контакт: <strong>{order.contact}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {orderSuite.customer.inn
                ? `ИНН ${orderSuite.customer.inn}`
                : 'ИНН не указан'}
            </span>
            {order.innVerified && orderSuite.customer.inn && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-[#166534] dark:text-[#4ADE80]">
                  Проверен по ключу ФНС
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>
              Тариф: <strong>{order.formatLabel}</strong> ({defaultSlotSec} сек)
            </span>
          </p>
        </div>

        <div className="flex flex-col sm:items-end gap-2.5 shrink-0">
          <div className="sm:text-right space-y-0.5">
            <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
              {orderSuite.studio.entityKind === 'ooo' ? 'ООО' : 'ИП'} ·{' '}
              {orderSuite.tax.taxLegalLabel} ·{' '}
              {order.paymentChannel === 'card_online'
                ? 'Карта / СБП (54-ФЗ)'
                : 'Безнал / ЭДО'}
            </p>
            <p className="text-2xl font-bold text-[#111111] dark:text-[#F4F3EF]">
              {orderSuite.isNegotiablePendingPrice
                ? 'Смета на согласовании'
                : formatRubCompact(orderSuite.tax.totalPayableRubFloor)}
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {prevStageMeta && (
                <button
                  type="button"
                  disabled={isUpdatingOrder}
                  data-testid="crm-revert-stage-btn"
                  title={`Вернуть сделку на этап «${prevStageMeta.fullTitle}»`}
                  onClick={() => {
                    const note =
                      stageNoteDraft.trim() ||
                      `Возврат на этап «${prevStageMeta.fullTitle}» продюсером студии`;
                    void onPatchOrder(
                      order.id,
                      {
                        stage: prevStageMeta.id,
                        stageNote: note,
                      },
                      `Сделка #${order.orderNumber} возвращена на этап «${prevStageMeta.fullTitle}».`
                    );
                    setStageNoteDraft('');
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#C83210]/50 text-[#111111] dark:text-[#F4F3EF] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  ← На пред. этап
                </button>
              )}

              <label htmlFor="inspector-stage-select" className="sr-only">
                Этап сделки
              </label>
              <select
                id="inspector-stage-select"
                data-testid="crm-inspector-stage-select"
                disabled={isUpdatingOrder}
                value={order.stage}
                onChange={(e) => {
                  const nextStage = e.target.value as CrmOrderStage;
                  const note = stageNoteDraft.trim();
                  void onPatchOrder(
                    order.id,
                    {
                      stage: nextStage,
                      ...(note ? { stageNote: note } : {}),
                    },
                    `Этап сделки #${order.orderNumber} обновлён.`
                  );
                  setStageNoteDraft('');
                }}
                className="min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] cursor-pointer"
              >
                {CRM_ORDER_STAGES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {getCrmStageMetaForOrder(st.id, 'production_only').fullTitle}
                  </option>
                ))}
              </select>

              {stageMeta.nextStage && stageMeta.nextActionLabel && (
                <button
                  type="button"
                  disabled={isUpdatingOrder}
                  data-testid="crm-advance-stage-btn"
                  onClick={() => {
                    const note = stageNoteDraft.trim();
                    void onPatchOrder(
                      order.id,
                      {
                        stage: stageMeta.nextStage!,
                        ...(note ? { stageNote: note } : {}),
                      },
                      `Сделка #${order.orderNumber} переведена на следующий этап.`
                    );
                    setStageNoteDraft('');
                  }}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#C83210] hover:bg-[#AE2A0C] disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {stageMeta.nextActionLabel}
                </button>
              )}
            </div>

            <input
              type="text"
              value={stageNoteDraft}
              onChange={(e) => setStageNoteDraft(e.target.value)}
              data-testid="crm-stage-note-input"
              placeholder="Комментарий к смене / возврату этапа для журнала аудита..."
              className="w-full sm:w-80 min-h-[32px] px-2.5 py-1 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 text-[11px] text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/45 dark:placeholder:text-[#F4F3EF]/45"
            />
            <div className="flex flex-wrap sm:justify-end items-center gap-1 max-w-md">
              {CRM_STAGE_RETURN_NOTE_PRESETS.map((preset, idx) => (
                <button
                  key={preset}
                  type="button"
                  data-testid={`crm-stage-note-preset-${idx}`}
                  onClick={() => setStageNoteDraft(preset)}
                  className="px-2 py-0.5 rounded-md bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 hover:border-[#C83210] text-[10px] font-medium text-[#111111]/75 dark:text-[#F4F3EF]/75 transition-colors cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Внутренняя навигация досье сделки (3 компактные вкладки вместо простыни) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Разделы карточки сделки"
          className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/8 dark:border-white/8"
        >
          <button
            id="dossier-tab-btn-contract"
            type="button"
            role="tab"
            aria-selected={dossierTab === 'contract'}
            aria-controls="dossier-tabpanel-contract"
            tabIndex={dossierTab === 'contract' ? 0 : -1}
            data-testid="dossier-tab-contract"
            onClick={() => setDossierTab('contract')}
            onKeyDown={(e) => handleDossierTabKeyDown(e, 'contract')}
            className={`min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              dossierTab === 'contract'
                ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            1. Договор, счёт и ЭДО
          </button>

          <button
            id="dossier-tab-btn-fz38"
            type="button"
            role="tab"
            aria-selected={dossierTab === 'fz38'}
            aria-controls="dossier-tabpanel-fz38"
            tabIndex={dossierTab === 'fz38' ? 0 : -1}
            data-testid="dossier-tab-fz38"
            onClick={() => setDossierTab('fz38')}
            onKeyDown={(e) => handleDossierTabKeyDown(e, 'fz38')}
            className={`min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              dossierTab === 'fz38'
                ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            2. Бриф, ФЗ-38 и хронометраж ({timingAudit.estimatedTotalSec}/
            {timingAudit.targetSlotSec} с)
          </button>

          <button
            id="dossier-tab-btn-deliverables"
            type="button"
            role="tab"
            aria-selected={dossierTab === 'deliverables'}
            aria-controls="dossier-tabpanel-deliverables"
            tabIndex={dossierTab === 'deliverables' ? 0 : -1}
            data-testid="dossier-tab-deliverables"
            onClick={() => setDossierTab('deliverables')}
            onKeyDown={(e) => handleDossierTabKeyDown(e, 'deliverables')}
            className={`min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              dossierTab === 'deliverables'
                ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            3. Мастер-файлы, права и журнал ({order.deliverables?.length ?? 0})
          </button>
        </div>

        {onOpenProductionVoiceover && (
          <button
            type="button"
            data-testid="dossier-open-production-btn"
            onClick={() => onOpenProductionVoiceover(order.id)}
            className="min-h-[36px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#C83210] text-xs font-semibold text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:text-[#111111] dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Перейти в цех озвучки →
          </button>
        )}
      </div>

      {/* ================================================================= */}
      {/* ВКЛАДКА 1: ДОГОВОР, СЧЁТ И ЭДО                                    */}
      {/* ================================================================= */}
      {dossierTab === 'contract' && (
        <div
          id="dossier-tabpanel-contract"
          role="tabpanel"
          aria-labelledby="dossier-tab-btn-contract"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-1"
        >
          <div
            data-testid="crm-kontur-edo-panel"
            className="lg:col-span-7 space-y-4"
          >
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                Юридический паспорт контрагента и документы ЭДО
              </h3>
              <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                Формирование КП, договора с отчуждением исключительных прав,
                счёта на оплату и паспорта РАО/ВОИС в 1 клик
              </p>
            </div>

            <dl className="divide-y divide-[#111111]/8 dark:divide-white/8 border-t border-b border-[#111111]/10 dark:border-white/10 text-xs">
              <div className="py-2.5 flex items-baseline justify-between gap-4">
                <dt className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  Заказчик по договору
                </dt>
                <dd className="font-semibold text-right text-[#111111] dark:text-[#F4F3EF]">
                  {orderSuite.customer.displayName}
                </dd>
              </div>
              <div className="py-2.5 flex items-baseline justify-between gap-4">
                <dt className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  ИНН / КПП / ОГРН
                </dt>
                <dd className="font-semibold text-right text-[#111111] dark:text-[#F4F3EF]">
                  {orderSuite.customer.inn
                    ? `ИНН ${orderSuite.customer.inn}`
                    : 'Не заполнено'}
                  {orderSuite.customer.kpp
                    ? ` · КПП ${orderSuite.customer.kpp}`
                    : ''}
                  {orderSuite.customer.ogrn
                    ? ` · ${
                        orderSuite.customer.isIpByInn ? 'ОГРНИП' : 'ОГРН'
                      } ${orderSuite.customer.ogrn}`
                    : ''}
                </dd>
              </div>
              <div className="py-2.5 flex items-baseline justify-between gap-4">
                <dt className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  Исполнитель студии
                </dt>
                <dd className="font-semibold text-right text-[#111111] dark:text-[#F4F3EF]">
                  {orderSuite.studio.legalName} ({orderSuite.tax.taxLegalLabel})
                </dd>
              </div>
              <div className="py-2.5 flex items-baseline justify-between gap-4">
                <dt className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  Номера документов пакета
                </dt>
                <dd className="font-medium text-right text-[#111111] dark:text-[#F4F3EF]">
                  Счёт {orderSuite.invoiceNumber} · Паспорт{' '}
                  {orderSuite.passportNumber}
                </dd>
              </div>
              <div className="py-2.5 flex items-baseline justify-between gap-4">
                <dt className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  Контур.Диадок
                </dt>
                <dd className="font-medium text-right text-[#111111]/85 dark:text-[#F4F3EF]/85">
                  {orderSuite.customer.edoBoxId
                    ? `BoxId: ${orderSuite.customer.edoBoxId}`
                    : konturStatus?.diadocConfigured
                      ? 'API подключён · поиск ящика по ИНН'
                      : 'Безопасный режим черновика IsDraft'}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                data-testid="crm-open-edo-spec-btn"
                onClick={() => onOpenDocumentsModal(order)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#26262B] dark:bg-[#F4F3EF] dark:hover:bg-white text-white dark:text-[#0D0D0F] text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet
                  className="w-3.5 h-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>Документы A4 (КП · Договор · Счёт · Паспорт)</span>
              </button>

              <button
                type="button"
                disabled={
                  isCreatingDiadocDraft || orderSuite.isNegotiablePendingPrice
                }
                data-testid="crm-create-diadoc-draft-btn"
                onClick={() => void onCreateDiadocDraft(order)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] disabled:opacity-45 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {isCreatingDiadocDraft
                    ? 'Формирование…'
                    : 'В черновики Диадока'}
                </span>
              </button>

              <button
                type="button"
                disabled={orderSuite.isNegotiablePendingPrice}
                data-testid="crm-download-extern-csv-btn"
                onClick={() => onDownloadExternCsv(order)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] disabled:opacity-45 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>CSV для Экстерна</span>
              </button>
            </div>

            {draftState && draftState.status !== 'not_sent' && (
              <p
                data-testid="crm-diadoc-draft-status"
                className={`text-xs font-medium ${
                  draftState.status === 'error'
                    ? 'text-[#B91C1C] dark:text-[#F87171]'
                    : 'text-[#166534] dark:text-[#4ADE80]'
                }`}
              >
                {draftState.detail ||
                  `Черновик № ${draftState.documentNumber ?? orderSuite.invoiceNumber} сохранён (${draftState.draftMessageId ?? 'IsDraft'}).`}
              </p>
            )}
          </div>

          <div className="lg:col-span-5 space-y-4 lg:pl-6 lg:border-l border-[#111111]/10 dark:border-white/10">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                Контрольный лист договора и прав
              </h3>
              <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                Регламент этапа: {stageMeta.slaHint}
              </p>
            </div>

            <div className="space-y-2.5 text-xs">
              {(
                [
                  {
                    key: 'trafficConfirmed',
                    label:
                      'Реквизиты заказчика, хронометраж и смета договора подтверждены',
                  },
                  {
                    key: 'fz38Checked',
                    label:
                      'Нормативно-хронометражная проверка текста по ФЗ-38 пройдена',
                  },
                  {
                    key: 'edoAndOrdRegistered',
                    label:
                      'Договор-счёт и закрывающий акт направлены в ЭДО (Диадок / СБИС)',
                  },
                  {
                    key: 'rightsPassportIssued',
                    label:
                      'Бессрочный паспорт отчуждения прав (диктор и музыка) оформлен',
                  },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="min-h-[32px] flex items-start gap-2.5 cursor-pointer py-1 text-[#111111]/88 dark:text-[#F4F3EF]/88"
                >
                  <input
                    type="checkbox"
                    checked={order.compliance[item.key]}
                    disabled={isUpdatingOrder}
                    onChange={(e) =>
                      void onPatchOrder(order.id, {
                        compliance: {
                          [item.key]: e.target.checked,
                        },
                      })
                    }
                    className="mt-0.5 w-6 h-6 shrink-0 rounded border-[#111111]/30 accent-[#C83210] cursor-pointer"
                  />
                  <span className="leading-snug">{item.label}</span>
                </label>
              ))}
            </div>

            {latestEngineerMail && (
              <div
                data-testid="crm-funnel-sound-engineer-email-card"
                className="pt-3 border-t border-[#111111]/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="font-semibold text-[#111111] dark:text-[#F4F3EF] truncate">
                    Наряд звукорежиссёру: {latestEngineerMail.engineerName}
                  </p>
                  <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72 truncate">
                    {latestEngineerMail.engineerEmail}
                  </p>
                </div>
                <a
                  href={latestEngineerMail.emailActionPath}
                  data-testid="crm-funnel-email-submit-file-btn"
                  className="min-h-[34px] px-3 py-1.5 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 hover:border-[#C83210] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{latestEngineerMail.buttonLabel}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* ВКЛАДКА 2: БРИФ, ЭКСПЕРТИЗА ФЗ-38 И ХРОНОМЕТРАЖ                   */}
      {/* ================================================================= */}
      {dossierTab === 'fz38' && (
        <div
          id="dossier-tabpanel-fz38"
          role="tabpanel"
          aria-labelledby="dossier-tab-btn-fz38"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-1"
        >
          <div className="lg:col-span-5 space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                Исходный бриф заказчика
              </h3>
              <p className="text-xs leading-relaxed text-[#111111]/84 dark:text-[#F4F3EF]/84">
                {order.briefText ||
                  'Заявка оформлена по контакту — задача уточняется сейлз-продюсером.'}
              </p>
              {(order.hasVoiceRecording || order.attachedFileName) && (
                <p className="text-xs font-semibold text-[#B82D0D] dark:text-[#FF7A5C]">
                  {order.hasVoiceRecording
                    ? `Голосовой бриф (${order.voiceDurationSec || 15} сек)`
                    : ''}
                  {order.hasVoiceRecording && order.attachedFileName ? ' · ' : ''}
                  {order.attachedFileName ? `Файл: ${order.attachedFileName}` : ''}
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-[#111111]/10 dark:border-white/10 space-y-2">
              <label
                htmlFor="crm-producer-notes"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
              >
                Договорная заметка продюсера:
              </label>
              <textarea
                id="crm-producer-notes"
                rows={3}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Условия оплаты, пожелания по голосу диктора, согласованные правки…"
                className="w-full p-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs text-[#111111] dark:text-[#F4F3EF]"
              />
              <button
                type="button"
                disabled={
                  isUpdatingOrder || notesDraft === order.producerNotes
                }
                onClick={() =>
                  void onPatchOrder(
                    order.id,
                    { producerNotes: notesDraft },
                    'Заметка продюсера сохранена.'
                  )
                }
                className="min-h-[36px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
              >
                Сохранить заметку
              </button>
            </div>
          </div>

          {/* Прикладная научность Варианта 3: Нормативно-хронометражная экспертиза ФЗ-38 */}
          <div
            data-testid="b2b-fz38-timing-audit"
            className="lg:col-span-7 space-y-4 lg:pl-6 lg:border-l border-[#111111]/10 dark:border-white/10"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5">
                  <Scale
                    className="w-4 h-4 shrink-0 text-[#B82D0D] dark:text-[#FF7A5C]"
                    aria-hidden="true"
                  />
                  <span>
                    Нормативно-хронометражная экспертиза ролика (ФЗ-38 и темп
                    речи)
                  </span>
                </h3>
              </div>
              <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                Рассчитывает до записи диктора, сколько секунд займут основной
                текст (норма 2,2 слова/сек) и обязательное юридическое
                предупреждение по ФЗ-38 «О рекламе», чтобы ролик точно лёг в
                оплаченный хронометраж договора.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
              <div className="sm:col-span-4 space-y-1">
                <label
                  htmlFor="fz38-slot-select"
                  className="block font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                >
                  Хронометраж по счёту
                </label>
                <select
                  id="fz38-slot-select"
                  data-testid="fz38-slot-select"
                  value={auditSlotSec}
                  onChange={(e) => setAuditSlotSec(Number(e.target.value))}
                  className="w-full min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 font-semibold cursor-pointer"
                >
                  {[10, 15, 20, 25, 30, 45, 60].map((sec) => (
                    <option key={sec} value={sec}>
                      {sec} секунд
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-8 space-y-1">
                <label
                  htmlFor="fz38-category-select"
                  className="block font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                >
                  Отраслевая норма ФЗ-38 «О рекламе»
                </label>
                <select
                  id="fz38-category-select"
                  data-testid="fz38-category-select"
                  value={auditCategory}
                  onChange={(e) =>
                    setAuditCategory(e.target.value as B2bRegulatoryCategoryId)
                  }
                  className="w-full min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 font-semibold cursor-pointer"
                >
                  <option value="auto">
                    Автоопределение ({timingAudit.legalNormReference})
                  </option>
                  <option value="general_b2b">
                    Общая B2B/B2C реклама (без отраслевого дисклеймера)
                  </option>
                  <option value="real_estate_214fz">
                    Недвижимость и ЖК — ч. 7 ст. 28 ФЗ-38 (~2,6 сек)
                  </option>
                  <option value="finance_credit_28fz">
                    Банки, кредиты, лизинг — ст. 28 ФЗ-38 (~4,5 сек)
                  </option>
                  <option value="medicine_24fz">
                    Медицина и клиники — ч. 7 ст. 24 ФЗ-38 (мин. 3,0 сек)
                  </option>
                  <option value="promo_stim_9fz">
                    Акции, скидки и розыгрыши — ст. 9 ФЗ-38 (~2,7 сек)
                  </option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <label
                  htmlFor="fz38-script-textarea"
                  className="font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                >
                  Проверяемый текст ролика (без текста дисклеймера):
                </label>
                <span className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  Слов: <strong>{timingAudit.wordCount}</strong> (норма слота до{' '}
                  <strong>{timingAudit.recommendedMaxWords}</strong> сл.)
                </span>
              </div>
              <textarea
                id="fz38-script-textarea"
                data-testid="fz38-script-textarea"
                rows={3}
                value={auditText}
                onChange={(e) => setAuditText(e.target.value)}
                placeholder="Вставьте черновик текста ролика или оффер заказчика для точного расчёта секунд…"
                className="w-full p-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs text-[#111111] dark:text-[#F4F3EF]"
              />
            </div>

            {/* Шкала распределения хронометража без inline-стилей */}
            <div className="space-y-2 pt-1">
              <svg
                viewBox="0 0 1000 14"
                className="w-full h-3.5 rounded-full overflow-hidden bg-[#111111]/8 dark:bg-white/10"
                role="img"
                aria-label={`Распределение хронометража: рекламный текст ${timingAudit.estimatedCreativeSec} сек, дисклеймер ${timingAudit.disclaimerRequiredSec} сек из ${timingAudit.targetSlotSec} сек`}
              >
                <rect
                  x={0}
                  y={0}
                  width={barCreativeWidth}
                  height={14}
                  fill={
                    timingAudit.verdictStatus === 'overflow'
                      ? '#B91C1C'
                      : timingAudit.verdictStatus === 'tight'
                        ? '#92400E'
                        : '#166534'
                  }
                />
                {barDisclaimerWidth > 0 && (
                  <rect
                    x={barCreativeWidth}
                    y={0}
                    width={barDisclaimerWidth}
                    height={14}
                    fill="#C83210"
                  />
                )}
              </svg>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72">
                <span>
                  Основной текст: <strong>{timingAudit.estimatedCreativeSec} сек</strong>{' '}
                  · Дисклеймер ФЗ-38:{' '}
                  <strong>{timingAudit.disclaimerRequiredSec} сек</strong> ·
                  Паузы/дыхание: <strong>{timingAudit.breathMarginSec} сек</strong>
                </span>
                <span className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                  Итого: {timingAudit.estimatedTotalSec} сек / слот{' '}
                  {timingAudit.targetSlotSec} сек
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#111111]/10 dark:border-white/10 space-y-2 text-xs">
              <p
                data-testid="fz38-verdict-title"
                className={`font-bold ${
                  timingAudit.verdictStatus === 'overflow'
                    ? 'text-[#B91C1C] dark:text-[#F87171]'
                    : timingAudit.verdictStatus === 'tight'
                      ? 'text-[#92400E] dark:text-[#FBBF24]'
                      : 'text-[#166534] dark:text-[#4ADE80]'
                }`}
              >
                {timingAudit.verdictTitle}
              </p>
              <p className="text-[#111111]/78 dark:text-[#F4F3EF]/78 leading-relaxed">
                {timingAudit.verdictAction}
              </p>
              {timingAudit.mandatoryDisclaimerSample && (
                <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  Обязательная формулировка ({timingAudit.legalNormReference}): «
                  {timingAudit.mandatoryDisclaimerSample}»
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!order.compliance.fz38Checked ? (
                  <button
                    type="button"
                    disabled={isUpdatingOrder}
                    data-testid="fz38-approve-compliance-btn"
                    onClick={() =>
                      void onPatchOrder(
                        order.id,
                        {
                          compliance: { fz38Checked: true },
                          documentMeta: {
                            ...(order.documentMeta ?? {}),
                            spotExactDurationSec: auditSlotSec,
                          },
                        },
                        `Пре-чек ФЗ-38 и хронометраж ${auditSlotSec} сек зафиксированы в договоре #${order.orderNumber}.`
                      )
                    }
                    className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#111111] hover:bg-[#26262B] dark:bg-[#F4F3EF] dark:hover:bg-white text-white dark:text-[#0D0D0F] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <CheckCircle2
                      className="w-3.5 h-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Подтвердить пре-чек ФЗ-38 ({auditSlotSec} сек)</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#166534] dark:text-[#4ADE80]">
                    <CheckCircle2
                      className="w-3.5 h-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Пре-чек ФЗ-38 подтверждён по сделке</span>
                  </span>
                )}

                {timingAudit.suggestedUpgradeSlotSec &&
                  timingAudit.suggestedUpgradeSlotSec !== defaultSlotSec && (
                    <button
                      type="button"
                      disabled={isUpdatingOrder}
                      onClick={() => {
                        const nextSec = timingAudit.suggestedUpgradeSlotSec!;
                        setAuditSlotSec(nextSec);
                        void onPatchOrder(
                          order.id,
                          {
                            documentMeta: {
                              ...(order.documentMeta ?? {}),
                              spotExactDurationSec: nextSec,
                            },
                          },
                          `Хронометраж спецификации заказа #${order.orderNumber} обновлён до ${nextSec} сек.`
                        );
                      }}
                      className="min-h-[36px] px-3.5 py-1.5 rounded-xl border border-[#C83210]/45 text-[#B82D0D] dark:text-[#FF7A5C] hover:bg-[#C83210]/8 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Установить слот {timingAudit.suggestedUpgradeSlotSec} сек в
                      спецификации
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* ВКЛАДКА 3: МАСТЕР-ФАЙЛЫ, ПРАВА И ЖУРНАЛ СДЕЛКИ                     */}
      {/* ================================================================= */}
      {dossierTab === 'deliverables' && (
        <div
          id="dossier-tabpanel-deliverables"
          role="tabpanel"
          aria-labelledby="dossier-tab-btn-deliverables"
          className="space-y-6 pt-1"
        >
          <div
            data-testid="crm-client-deliverables-panel"
            className="space-y-4 pb-5 border-b border-[#111111]/10 dark:border-white/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                  Выдача мастер-файлов, паспортов прав и актов в Личный кабинет
                </h3>
                <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  Канал получения заказчика:{' '}
                  <strong>
                    {resolveDeliveryChannelLabel(
                      order.preferredDeliveryChannel,
                      order.preferredDeliveryDetail
                    )}
                  </strong>
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                aria-label="Ссылка на облачную папку заказа"
                data-testid="crm-cloud-disk-input"
                value={cloudDiskDraft}
                onChange={(e) => setCloudDiskDraft(e.target.value)}
                placeholder="https://disk.yandex.ru/d/... — папка с WAV-мастерами и закрывающими документами"
                className="flex-1 min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
              />
              <button
                type="button"
                disabled={
                  isUpdatingOrder ||
                  cloudDiskDraft === (order.cloudDiskUrl ?? '')
                }
                data-testid="crm-save-cloud-disk-btn"
                onClick={() =>
                  void onPatchOrder(
                    order.id,
                    { cloudDiskUrl: cloudDiskDraft.trim() || null },
                    'Ссылка на облачную папку сохранена для заказчика.'
                  )
                }
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
              >
                Сохранить ссылку
              </button>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  aria-label="Название файла для клиента"
                  value={deliverableTitleDraft}
                  onChange={(e) => setDeliverableTitleDraft(e.target.value)}
                  placeholder="Название (напр. Финальный мастер 20 сек -14 LUFS)"
                  className="sm:col-span-5 min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
                />
                <select
                  aria-label="Тип документа или файла выдачи"
                  value={deliverableKindDraft}
                  onChange={(e) =>
                    setDeliverableKindDraft(
                      e.target.value as OrderDeliverableKind
                    )
                  }
                  className="sm:col-span-3 min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
                >
                  <option value="audio_master">Аудиоролик (WAV/MP3)</option>
                  <option value="passport">Паспорт прав РАО/ВОИС</option>
                  <option value="invoice">Счёт / Акт / УПД</option>
                  <option value="script">Согласованный сценарий</option>
                  <option value="archive">Архив проекта</option>
                </select>
                <div className="sm:col-span-4">
                  <input
                    ref={deliverableFileRef}
                    type="file"
                    aria-label="Выбрать файл выдачи для клиента"
                    data-testid="crm-deliverable-file-input"
                    onChange={(e) =>
                      void handleTriggerFileUpload(e.target.files?.[0] ?? null)
                    }
                    className="sr-only"
                  />
                  <button
                    type="button"
                    disabled={isUploadingDeliverable}
                    data-testid="crm-upload-deliverable-btn"
                    onClick={() => deliverableFileRef.current?.click()}
                    className="w-full min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#C83210] hover:bg-[#AE2A0C] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {isUploadingDeliverable
                        ? 'Загрузка…'
                        : 'Прикрепить файл клиенту'}
                    </span>
                  </button>
                </div>
              </div>

              {deliverableKindDraft === 'audio_master' && (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <select
                    aria-label="Версия аудиоролика"
                    data-testid="crm-deliverable-version-select"
                    value={deliverableVersionDraft}
                    onChange={(e) =>
                      setDeliverableVersionDraft(
                        e.target.value as DeliverableVersionPreset
                      )
                    }
                    className="sm:col-span-4 min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-mono"
                  >
                    <option value="auto">
                      Авто ({suggestNextAudioVersionCode(order.deliverables ?? [])})
                    </option>
                    <option value="v1">v1 — Черновой дубль</option>
                    <option value="v2">v2 — Правка</option>
                    <option value="v3">v3 — Доработка</option>
                    <option value="v4">v4 — Доп. правка</option>
                    <option value="master">master — Финальный мастер</option>
                  </select>
                  <input
                    type="text"
                    aria-label="Комментарий к версии ролика"
                    data-testid="crm-deliverable-version-note-input"
                    value={deliverableVersionNoteDraft}
                    onChange={(e) =>
                      setDeliverableVersionNoteDraft(e.target.value)
                    }
                    placeholder="Примечание к версии (напр. Сведение по ГОСТ/LUFS и очистка прав)"
                    className="sm:col-span-8 min-h-[38px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <p className="font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74">
                  Выдано заказчику ({order.deliverables?.length ?? 0}):
                </p>
                {!order.deliverables || order.deliverables.length === 0 ? (
                  <p className="text-[#111111]/70 dark:text-[#F4F3EF]/70">
                    Файлы выдачи по договору ещё не прикреплены.
                  </p>
                ) : (
                  <ul className="divide-y divide-[#111111]/8 dark:divide-white/8 border-t border-b border-[#111111]/8 dark:border-white/8">
                    {order.deliverables.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-start justify-between gap-2 py-2"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="truncate font-medium text-[#111111] dark:text-[#F4F3EF]">
                            {d.versionCode && (
                              <span className="font-mono font-bold text-[#B82D0D] dark:text-[#FF7A5C] mr-1.5">
                                {d.versionCode}
                              </span>
                            )}
                            <span>{d.title}</span>{' '}
                            <span className="text-[#111111]/70 dark:text-[#F4F3EF]/70">
                              ({formatFileSizeReadable(d.sizeBytes)})
                            </span>
                          </p>
                          {d.versionNote && (
                            <p className="text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72 truncate">
                              {d.versionNote}
                            </p>
                          )}
                        </div>

                        {confirmingRemoveDeliverableId === d.id ? (
                          <div className="inline-flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={isUpdatingOrder}
                              data-testid={`crm-confirm-remove-deliverable-${d.id}`}
                              onClick={() => {
                                setConfirmingRemoveDeliverableId(null);
                                void onPatchOrder(
                                  order.id,
                                  { removeDeliverableId: d.id },
                                  'Файл удалён из выдачи заказа.'
                                );
                              }}
                              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#B91C1C] hover:bg-[#991B1B] text-white text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                            >
                              Подтвердить
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmingRemoveDeliverableId(null)
                              }
                              className="min-h-[32px] px-2.5 py-1 rounded-lg border border-[#111111]/16 dark:border-white/16 text-[11px] font-semibold text-[#111111] dark:text-[#F4F3EF] cursor-pointer whitespace-nowrap"
                            >
                              Отмена
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isUpdatingOrder}
                            aria-label={`Удалить файл ${d.title}`}
                            onClick={() =>
                              setConfirmingRemoveDeliverableId(d.id)
                            }
                            className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#B91C1C] dark:hover:text-[#F87171] cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74">
                  Вложения от заказчика ({order.clientUploads?.length ?? 0}):
                </p>
                {!order.clientUploads || order.clientUploads.length === 0 ? (
                  <p className="text-[#111111]/70 dark:text-[#F4F3EF]/70">
                    Дополнительных референсов и реквизитов не загружено.
                  </p>
                ) : (
                  <ul className="divide-y divide-[#111111]/8 dark:divide-white/8 border-t border-b border-[#111111]/8 dark:border-white/8">
                    {order.clientUploads.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center justify-between gap-2 py-2"
                      >
                        <span className="truncate">
                          {u.fileName}
                          {u.note ? ` · ${u.note}` : ''}
                        </span>
                        <a
                          href={`/api/orders/${encodeURIComponent(
                            order.orderNumber
                          )}/client-uploads/${encodeURIComponent(u.id)}`}
                          download={u.fileName}
                          className="min-h-[28px] px-1.5 rounded text-[#B82D0D] dark:text-[#FF7A5C] font-semibold hover:underline inline-flex items-center gap-1 shrink-0"
                        >
                          <span>Скачать</span>
                          <ExternalLink
                            className="w-3 h-3"
                            aria-hidden="true"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <OrderStageHistoryTimeline
            order={order}
            assignedEngineerName={
              soundEngineers.find(
                (eng) => eng.id === order.approvalWorkflow?.assignedEngineerId
              )?.name ?? null
            }
            isUpdating={isUpdatingOrder}
            onSelectStage={(targetStage) => {
              if (targetStage === order.stage) return;
              void onPatchOrder(
                order.id,
                { stage: targetStage },
                `Этап сделки #${order.orderNumber} обновлён.`
              );
            }}
          />

          <div className="pt-4 border-t border-[#111111]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <p className="text-[#111111]/74 dark:text-[#F4F3EF]/74">
              Шлюзы доставки: CRM{' '}
              <strong className="text-[#166534] dark:text-[#4ADE80]">
                Записано
              </strong>{' '}
              · Telegram <strong className={tgPres.colorClass}>{tgPres.label}</strong>{' '}
              · Webhook <strong className={whPres.colorClass}>{whPres.label}</strong>
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isRedelivering}
                data-testid="crm-redeliver-order-btn"
                onClick={() => void onRedeliverGateways(order.id)}
                className="min-h-[36px] px-3 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#C83210] font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {isRedelivering ? 'Отправка…' : 'Повторить в шлюзы'}
                </span>
              </button>

              {confirmingAnonymize && !order.pdnAnonymizedAt ? (
                <div
                  role="group"
                  aria-label="Подтверждение необратимого обезличивания ПДн"
                  className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#B91C1C]/8 border border-[#B91C1C]/30"
                >
                  <span className="px-2 text-[11px] font-semibold text-[#B91C1C] dark:text-[#F87171]">
                    Необратимо обезличить ПДн?
                  </span>
                  <button
                    type="button"
                    disabled={isUpdatingOrder}
                    data-testid="crm-confirm-anonymize-pdn-btn"
                    onClick={() => {
                      setConfirmingAnonymize(false);
                      void onAnonymizePdn(order);
                    }}
                    className="min-h-[32px] px-3 py-1 rounded-lg bg-[#B91C1C] hover:bg-[#991B1B] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Подтвердить
                  </button>
                  <button
                    type="button"
                    data-testid="crm-cancel-anonymize-pdn-btn"
                    onClick={() => setConfirmingAnonymize(false)}
                    className="min-h-[32px] px-3 py-1 rounded-lg bg-white dark:bg-[#141418] border border-[#111111]/16 dark:border-white/16 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] cursor-pointer whitespace-nowrap"
                  >
                    Отмена
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isUpdatingOrder || Boolean(order.pdnAnonymizedAt)}
                  data-testid="crm-anonymize-pdn-btn"
                  onClick={() => setConfirmingAnonymize(true)}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#B91C1C] hover:text-[#B91C1C] dark:hover:text-[#F87171] disabled:opacity-50 font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <UserX className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {order.pdnAnonymizedAt
                      ? 'ПДн обезличены (152-ФЗ)'
                      : 'Обезличить ПДн (152-ФЗ)'}
                  </span>
                </button>
              )}

              {order.pdnAnonymizedAt && onOpenRknDestructionAct && (
                <button
                  type="button"
                  data-testid="crm-download-pdn-destruction-act-btn"
                  onClick={() => onOpenRknDestructionAct(order)}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#111111] hover:bg-[#C83210] dark:bg-[#F4F3EF] dark:hover:bg-[#C83210] text-white dark:text-[#0D0D0F] dark:hover:text-white font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <FileCheck2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Акт РКН № 179 (A4)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
