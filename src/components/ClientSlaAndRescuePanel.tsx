import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  MessageSquare,
  PhoneForwarded,
  ShieldCheck,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildMediaPlanSnapshotFromReservation,
  CrmOrderRecord,
  CrmOrderStage,
  formatEdoInvoiceSpecificationDocument,
  getCrmStageMetaForOrder,
  OrderSlaTrackingState,
  SLA_BREACH_COMPENSATION_NOTE,
} from '../data/orderCrmTypes';
import { ConfirmedReservationSummary, orderDraftStore } from '../data/orderDraftStore';
import { AIRTIME_SALES_ENABLED } from '../data/platformFeatures';
import {
  CALLBACK_PREFERENCE_OPTIONS,
  ClientCallbackPreference,
  evaluateOrderSlaStatus,
  formatStudioTimestampHuman,
  getCallbackPreferenceMeta,
  StudioWorkScheduleConfig,
} from '../data/slaWorkCalendar';

import {
  BrandedDocumentKind,
  OrderDocumentMeta,
  StudioLegalProfilesConfig,
} from '../data/studioDocumentsCore';

const BrandedDocumentSuiteModal = lazy(() =>
  import('./documents/BrandedDocumentSuiteModal').then((m) => ({
    default: m.BrandedDocumentSuiteModal,
  }))
);

interface ClientSlaAndRescuePanelProps {
  confirmed: ConfirmedReservationSummary;
  workSchedule?: Partial<StudioWorkScheduleConfig> | null;
  legalProfiles?: Partial<StudioLegalProfilesConfig> | null;
  onUpdatedConfirmed?: (next: ConfirmedReservationSummary) => void;
  defaultExpandedEdo?: boolean;
  hideDocumentButtons?: boolean;
}

export function ClientSlaAndRescuePanel({
  confirmed,
  workSchedule,
  legalProfiles,
  onUpdatedConfirmed,
  defaultExpandedEdo = false,
  hideDocumentButtons = false,
}: ClientSlaAndRescuePanelProps) {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [liveStage, setLiveStage] = useState<CrmOrderStage>('new_hold');
  const [liveSlaState, setLiveSlaState] = useState<OrderSlaTrackingState | null>(null);
  const [liveLegalProfiles, setLiveLegalProfiles] =
    useState<Partial<StudioLegalProfilesConfig> | null>(legalProfiles ?? null);
  const [liveDocMeta, setLiveDocMeta] = useState<OrderDocumentMeta | null>(null);
  const [serverEdoText, setServerEdoText] = useState<string | null>(null);
  const [showEdoPreview, setShowEdoPreview] = useState<boolean>(
    () =>
      defaultExpandedEdo &&
      confirmed.paymentChannel !== 'card_online' &&
      Boolean(confirmed.companyLine)
  );
  const [isDocSuiteOpen, setIsDocSuiteOpen] = useState<boolean>(false);
  const [suiteInitialDoc, setSuiteInitialDoc] = useState<BrandedDocumentKind>('invoice');
  const [copiedEdo, setCopiedEdo] = useState<boolean>(false);
  const [isRescuePending, setIsRescuePending] = useState<boolean>(false);
  const [rescueFeedback, setRescueFeedback] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (legalProfiles) {
      setLiveLegalProfiles(legalProfiles);
    }
  }, [legalProfiles]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const syncLiveStatus = useCallback(async () => {
    if (!confirmed.rescueToken) return;
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(
          confirmed.orderNumber
        )}/status?token=${encodeURIComponent(confirmed.rescueToken)}`,
        {
          headers: { Accept: 'application/json' },
        }
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        stage?: CrmOrderStage;
        holdExpiresAt?: string;
        callbackPreference?: ClientCallbackPreference;
        slaState?: OrderSlaTrackingState | null;
        edoSpecificationText?: string;
        documentMeta?: OrderDocumentMeta | null;
        legalProfiles?: StudioLegalProfilesConfig | null;
      };
      if (!data.ok) return;
      if (data.stage) setLiveStage(data.stage);
      if (data.slaState) setLiveSlaState(data.slaState);
      if (data.edoSpecificationText) setServerEdoText(data.edoSpecificationText);
      if (data.documentMeta) setLiveDocMeta(data.documentMeta);
      if (data.legalProfiles) setLiveLegalProfiles(data.legalProfiles);

      const parsedHoldMs = data.holdExpiresAt ? Date.parse(data.holdExpiresAt) : NaN;
      const nextHoldMs = Number.isFinite(parsedHoldMs)
        ? parsedHoldMs
        : confirmed.holdExpiresAtMs;
      const nextPref = data.callbackPreference ?? confirmed.callbackPreference ?? 'call_15m';
      const nextComp =
        data.slaState?.compensationNote ?? confirmed.compensationNote ?? null;
      const nextContacted =
        data.slaState?.firstContactedAt ?? confirmed.firstContactedAtIso ?? null;

      if (
        nextHoldMs !== confirmed.holdExpiresAtMs ||
        nextPref !== confirmed.callbackPreference ||
        nextComp !== (confirmed.compensationNote ?? null) ||
        nextContacted !== (confirmed.firstContactedAtIso ?? null)
      ) {
        const updatedSummary: ConfirmedReservationSummary = {
          ...confirmed,
          holdExpiresAtMs: nextHoldMs,
          callbackPreference: nextPref,
          compensationNote: nextComp,
          firstContactedAtIso: nextContacted,
        };
        orderDraftStore.confirmReservationOrder(updatedSummary);
        onUpdatedConfirmed?.(updatedSummary);
      }
    } catch {
      // Локальный расчёт SLA продолжает работать при отсутствии сети
    }
  }, [confirmed, onUpdatedConfirmed]);

  useEffect(() => {
    void syncLiveStatus();
    if (!confirmed.rescueToken) return;
    const pollId = window.setInterval(() => {
      void syncLiveStatus();
    }, 12_000);
    return () => window.clearInterval(pollId);
  }, [confirmed.rescueToken, syncLiveStatus]);

  const activeCallbackPref: ClientCallbackPreference =
    liveSlaState
      ? confirmed.callbackPreference ?? 'call_15m'
      : confirmed.callbackPreference ?? 'call_15m';

  const slaEval = useMemo(() => {
    const slaStartIso =
      liveSlaState?.slaWindowStartAt ??
      (confirmed.slaWindowStartAtMs
        ? new Date(confirmed.slaWindowStartAtMs).toISOString()
        : null);
    const slaDeadIso =
      liveSlaState?.slaDeadlineAt ??
      (confirmed.slaDeadlineAtMs
        ? new Date(confirmed.slaDeadlineAtMs).toISOString()
        : null);

    return evaluateOrderSlaStatus(
      {
        stage: liveStage,
        createdAtIso: new Date(confirmed.confirmedAtMs).toISOString(),
        callbackPreference: activeCallbackPref,
        slaWindowStartIso: slaStartIso,
        slaDeadlineIso: slaDeadIso,
        firstContactedAtIso:
          liveSlaState?.firstContactedAt ?? confirmed.firstContactedAtIso ?? null,
        escalatedAtIso: liveSlaState?.escalatedAt ?? null,
      },
      nowMs,
      workSchedule
    );
  }, [
    activeCallbackPref,
    confirmed.confirmedAtMs,
    confirmed.firstContactedAtIso,
    confirmed.slaDeadlineAtMs,
    confirmed.slaWindowStartAtMs,
    liveSlaState,
    liveStage,
    nowMs,
    workSchedule,
  ]);

  const fallbackEdoText = useMemo(() => {
    if (serverEdoText) return serverEdoText;
    const syntheticRecord: CrmOrderRecord = {
      id: `local-${confirmed.orderNumber}`,
      orderNumber: confirmed.orderNumber,
      createdAt: new Date(confirmed.confirmedAtMs).toISOString(),
      updatedAt: new Date(confirmed.confirmedAtMs).toISOString(),
      holdExpiresAt: new Date(confirmed.holdExpiresAtMs).toISOString(),
      source: 'order_page',
      checkoutMode: confirmed.checkoutMode,
      paymentChannel: confirmed.paymentChannel ?? 'edo_invoice',
      stage: liveStage,
      formatLabel: confirmed.formatLabel,
      totalBudgetRub:
        confirmed.lockedTotals?.unifiedTotalRub ??
        (typeof confirmed.selectedBudgetRub === 'number'
          ? confirmed.selectedBudgetRub
          : 25_000),
      contact: confirmed.contactLine,
      detectedChannel: 'phone',
      callbackPreference: activeCallbackPref,
      companyOrInn: confirmed.companyLine,
      innVerified: confirmed.innVerified,
      briefText: confirmed.briefNote,
      hasVoiceRecording: confirmed.hasVoice,
      voiceDurationSec: confirmed.voiceSec,
      attachedFileName: confirmed.fileName,
      producerNotes: '',
      compliance: {
        trafficConfirmed: false,
        fz38Checked: false,
        rightsPassportIssued: false,
        edoAndOrdRegistered: false,
      },
      mediaPlanSnapshot:
        confirmed.lockedMediaReservation && confirmed.lockedTotals
          ? buildMediaPlanSnapshotFromReservation(
              confirmed.lockedMediaReservation,
              confirmed.lockedTotals
            )
          : null,
      documentMeta: liveDocMeta ?? undefined,
      slaState: liveSlaState ?? undefined,
      delivery: {
        crmRegistry: 'saved',
        telegram: {
          state: 'ready_simulated',
          updatedAt: new Date(confirmed.confirmedAtMs).toISOString(),
          httpStatus: null,
          detail: '',
        },
        webhook: {
          state: 'ready_simulated',
          updatedAt: new Date(confirmed.confirmedAtMs).toISOString(),
          httpStatus: null,
          detail: '',
        },
      },
    };
    return formatEdoInvoiceSpecificationDocument(syntheticRecord);
  }, [activeCallbackPref, confirmed, liveDocMeta, liveSlaState, liveStage, serverEdoText]);

  const executeRescueAction = async (
    action: 'extend_hold_and_escalate' | 'switch_to_async' | 'reschedule_callback',
    nextPref?: ClientCallbackPreference
  ) => {
    setIsRescuePending(true);
    setRescueFeedback(null);

    try {
      if (confirmed.rescueToken) {
        const res = await fetch(
          `/api/orders/${encodeURIComponent(confirmed.orderNumber)}/rescue`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rescueToken: confirmed.rescueToken,
              action,
              callbackPreference: nextPref,
            }),
          }
        );
        const data = (await res.json()) as {
          ok?: boolean;
          holdExpiresAt?: string;
          callbackPreference?: ClientCallbackPreference;
          slaState?: OrderSlaTrackingState;
          edoSpecificationText?: string;
          error?: string;
        };

        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Не удалось обновить параметры брони');
        }

        if (data.slaState) setLiveSlaState(data.slaState);
        if (data.edoSpecificationText) setServerEdoText(data.edoSpecificationText);

        const parsedHoldMs = data.holdExpiresAt
          ? Date.parse(data.holdExpiresAt)
          : confirmed.holdExpiresAtMs + 4 * 3600_000;
        const resolvedPref =
          data.callbackPreference ?? nextPref ?? confirmed.callbackPreference ?? 'call_15m';

        const updatedSummary: ConfirmedReservationSummary = {
          ...confirmed,
          holdExpiresAtMs: Number.isFinite(parsedHoldMs)
            ? parsedHoldMs
            : confirmed.holdExpiresAtMs + 4 * 3600_000,
          callbackPreference: resolvedPref,
          slaWindowStartAtMs: data.slaState?.slaWindowStartAt
            ? Date.parse(data.slaState.slaWindowStartAt)
            : confirmed.slaWindowStartAtMs,
          slaDeadlineAtMs: data.slaState?.slaDeadlineAt
            ? Date.parse(data.slaState.slaDeadlineAt)
            : confirmed.slaDeadlineAtMs,
          promisedWindowLabel:
            data.slaState?.promisedWindowLabel ?? confirmed.promisedWindowLabel,
          compensationNote:
            data.slaState?.compensationNote ??
            (action === 'extend_hold_and_escalate'
              ? SLA_BREACH_COMPENSATION_NOTE
              : confirmed.compensationNote ?? null),
        };
        orderDraftStore.confirmReservationOrder(updatedSummary);
        onUpdatedConfirmed?.(updatedSummary);
      } else {
        // Локальное резервное обновление (если заявка создана в офлайн-режиме)
        const updatedSummary: ConfirmedReservationSummary = {
          ...confirmed,
          holdExpiresAtMs:
            action === 'extend_hold_and_escalate'
              ? confirmed.holdExpiresAtMs + 4 * 3600_000
              : confirmed.holdExpiresAtMs,
          callbackPreference:
            action === 'switch_to_async'
              ? 'async_no_call'
              : nextPref ?? confirmed.callbackPreference ?? 'call_15m',
          compensationNote:
            action === 'extend_hold_and_escalate'
              ? SLA_BREACH_COMPENSATION_NOTE
              : confirmed.compensationNote ?? null,
        };
        orderDraftStore.confirmReservationOrder(updatedSummary);
        onUpdatedConfirmed?.(updatedSummary);
      }

      if (action === 'extend_hold_and_escalate') {
        setRescueFeedback({
          kind: 'ok',
          text: isAirBooking
            ? 'Резерв продлён ещё на +4 рабочих часа. Запрос передан руководителю смены, активирован бонус приоритетного сценария за 12ч.'
            : 'Запрос передан руководителю студийной смены: ускорим согласование договора/оплаты и дадим приоритетный выпуск 3 концепций сценария за 12ч сразу после поступления предоплаты.',
        });
      } else if (action === 'switch_to_async') {
        setRescueFeedback({
          kind: 'ok',
          text: isAirBooking
            ? 'Сделка переведена в письменный режим без звонков. Пришлём подтверждённый медиаплан и счёт в мессенджер.'
            : confirmed.paymentChannel === 'card_online'
              ? 'Заказ переведён в письменный режим без звонков. Направим ссылку на оплату картой или по СБП в мессенджер.'
              : 'Заказ переведён в письменный режим без звонков. Направим счёт на оплату и документы в мессенджер.',
        });
      } else {
        setRescueFeedback({
          kind: 'ok',
          text: isAirBooking
            ? `Удобное окно связи обновлено (${getCallbackPreferenceMeta(nextPref).shortLabel}). Квота защищена до завершения звонка.`
            : `Удобное окно связи обновлено (${getCallbackPreferenceMeta(nextPref).shortLabel}). Условия заявки зафиксированы.`,
        });
      }
    } catch (err) {
      setRescueFeedback({
        kind: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Сбой связи с сервером. Повторите через несколько секунд.',
      });
    } finally {
      setIsRescuePending(false);
    }
  };

  const handleCopyEdo = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fallbackEdoText);
      }
      setCopiedEdo(true);
      window.setTimeout(() => setCopiedEdo(false), 2400);
    } catch {
      setCopiedEdo(true);
      window.setTimeout(() => setCopiedEdo(false), 2400);
    }
  };

  const handleDownloadEdo = () => {
    const blob = new Blob([fallbackEdoText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FMWorks-Dogovor-EDO-${confirmed.orderNumber}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const isAirBooking =
    AIRTIME_SALES_ENABLED &&
    confirmed.checkoutMode === 'air_plus_production' &&
    Boolean(confirmed.lockedMediaReservation);
  const activeCompNote =
    liveSlaState?.compensationNote ?? confirmed.compensationNote ?? null;
  const stageMeta = getCrmStageMetaForOrder(
    liveStage,
    isAirBooking ? 'air_plus_production' : 'production_only'
  );
  const holdUntilFormatted = formatStudioTimestampHuman(confirmed.holdExpiresAtMs);

  return (
    <div
      data-testid="client-sla-rescue-panel"
      className="rounded-2xl p-5 sm:p-6 bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 space-y-5 tabular-nums"
    >
      {/* Верхняя строка статуса SLA, режима связи и защиты цены */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#111111]/10 dark:border-white/10">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
            <span
              data-testid="client-sla-status-badge"
              className={
                slaEval.state === 'contact_completed'
                  ? 'text-[#16A34A] dark:text-[#4ADE80]'
                  : slaEval.state === 'breached_late'
                    ? 'text-[#DC2626] dark:text-[#F87171]'
                    : slaEval.state === 'warning_soon'
                      ? 'text-[#D97706] dark:text-[#FBBF24]'
                      : 'text-[#FF4820]'
              }
            >
              {slaEval.badgeLabel}
            </span>
            <span aria-hidden="true" className="opacity-35">
              ·
            </span>
            <span className="text-[#111111]/68 dark:text-[#F4F3EF]/68">
              Режим: {getCallbackPreferenceMeta(activeCallbackPref).shortLabel}
            </span>
            <span aria-hidden="true" className="opacity-35">
              ·
            </span>
            <span className="text-[#111111]/68 dark:text-[#F4F3EF]/68">
              Этап: {stageMeta.shortLabel}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-[#111111]/78 dark:text-[#F4F3EF]/78 leading-relaxed">
            {!isAirBooking && slaEval.state === 'queued_off_hours'
              ? 'Заявка зафиксирована в ночном / выходном сейфе и пойдёт в первую утреннюю очередь продюсера.'
              : !isAirBooking &&
                  slaEval.state === 'active_countdown' &&
                  activeCallbackPref !== 'async_no_call'
                ? 'Идёт контрольный интервал первичного контакта с продюсером и проверки задачи.'
                : slaEval.detailMessage}{' '}
            {isAirBooking ? (
              <>
                Скидка и квота защищены до{' '}
                <strong className="text-[#111111] dark:text-[#F4F3EF]">
                  {holdUntilFormatted}
                </strong>
                .
              </>
            ) : (
              <>
                Стоимость пакета и приоритет в графике студии закреплены до{' '}
                <strong className="text-[#111111] dark:text-[#F4F3EF]">
                  {holdUntilFormatted}
                </strong>
                .
              </>
            )}
          </p>
        </div>

        {!hideDocumentButtons && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto min-w-0">
            <button
              type="button"
              data-testid="client-open-branded-suite-btn"
              onClick={() => {
                setSuiteInitialDoc(
                  confirmed.selectedFormatId === 'custom_consult' ||
                    confirmed.selectedBudgetRub === 0
                    ? 'kp'
                    : 'invoice'
                );
                setIsDocSuiteOpen(true);
              }}
              className="w-full sm:w-auto max-w-full min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-xl bg-[#FF4820] hover:bg-[#E63C17] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 text-center leading-snug transition-colors cursor-pointer whitespace-normal sm:whitespace-nowrap"
            >
              <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Счёт и документы A4</span>
            </button>

            {confirmed.paymentChannel !== 'card_online' && Boolean(confirmed.companyLine) && (
              <button
                type="button"
                data-testid="client-quick-download-edo-btn"
                onClick={handleDownloadEdo}
                className="w-full sm:w-auto max-w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#111111]/18 dark:border-white/18 hover:border-[#FF4820] text-xs font-semibold inline-flex items-center justify-center gap-1.5 text-center leading-snug transition-colors cursor-pointer whitespace-normal sm:whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Скачать счёт (.txt)</span>
              </button>
            )}
            <button
              type="button"
              data-testid="client-toggle-autonomous-edo-btn"
              onClick={() => setShowEdoPreview((prev) => !prev)}
              className="w-full sm:w-auto max-w-full min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-xl bg-[#111111] hover:bg-[#27272A] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-white text-xs font-semibold inline-flex items-center justify-center gap-2 text-center leading-snug transition-colors cursor-pointer whitespace-normal sm:whitespace-nowrap"
            >
              <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {showEdoPreview
                  ? 'Скрыть договор и счёт'
                  : confirmed.selectedFormatId === 'custom_consult' ||
                      confirmed.selectedBudgetRub === 0
                    ? 'Договор и карточка заявки'
                    : confirmed.paymentChannel === 'card_online'
                      ? 'Договор-оферта и условия оплаты'
                      : 'Открыть счёт и договор'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Активная сервисная гарантия при задержке звонка */}
      {activeCompNote && (
        <div
          data-testid="client-sla-compensation-banner"
          className="rounded-xl p-3.5 bg-[#16A34A]/10 border border-[#16A34A]/25 text-xs text-[#15803D] dark:text-[#4ADE80] flex items-start gap-2.5"
        >
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{activeCompNote}</span>
        </div>
      )}

      {/* Предпросмотр договора и счёта для бухгалтерии */}
      {showEdoPreview && (
        <div
          data-testid="client-autonomous-edo-box"
          className="rounded-xl p-4 bg-[#EFECE5] dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 space-y-3 min-w-0"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
            <p className="text-xs font-bold text-[#111111] dark:text-[#F4F3EF]">
              {confirmed.paymentChannel === 'card_online'
                ? 'Договор-оферта и бланк заказа (для оплаты картой / СБП)'
                : 'Договор-оферта и счёт на оплату (можно скачать сразу и передать в бухгалтерию)'}
            </p>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                data-testid="client-copy-edo-btn"
                onClick={() => void handleCopyEdo()}
                className="flex-1 sm:flex-initial min-h-[40px] px-3 py-1.5 rounded-lg bg-[#FF4820] hover:bg-[#E63C17] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-normal sm:whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{copiedEdo ? 'Скопировано' : 'Скопировать текст'}</span>
              </button>
              <button
                type="button"
                data-testid="client-download-edo-btn"
                onClick={handleDownloadEdo}
                className="flex-1 sm:flex-initial min-h-[40px] px-3 py-1.5 rounded-lg border border-[#111111]/16 dark:border-white/16 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-normal sm:whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Скачать (.txt)</span>
              </button>
            </div>
          </div>

          <pre className="p-3.5 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/8 dark:border-white/8 text-[11px] leading-relaxed whitespace-pre-wrap font-mono max-h-60 overflow-y-auto text-[#111111] dark:text-[#F4F3EF]">
            {fallbackEdoText}
          </pre>
        </div>
      )}

      {/* Протокол самообслуживания и защиты клиента: что если никто не перезвонил / ночь / совещание */}
      <div className="space-y-3">
        <div className="space-y-1">
          <h4 className="text-xs sm:text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
            Что если никто не перезвонил вовремя или вам неудобно говорить?
          </h4>
          <p className="text-xs text-[#111111]/68 dark:text-[#F4F3EF]/68 leading-relaxed">
            {isAirBooking
              ? 'Вы не потеряете скидку из-за занятой линии, ночи или праздников: продлите резерв в 1 клик с вызовом руководителя смены либо переведите сделку в полностью письменный режим без звонков.'
              : 'Вы не потеряете оговорённые сроки из-за занятой линии, ночи или праздников: передайте заявку руководителю смены в 1 клик с ускорением сценария до 12ч либо переведите проект в письменный режим без звонков.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 min-w-0">
          <button
            type="button"
            disabled={isRescuePending}
            data-testid="client-rescue-extend-escalate-btn"
            onClick={() => void executeRescueAction('extend_hold_and_escalate')}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-[#FF4820] hover:bg-[#E63C17] disabled:opacity-55 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 text-left sm:text-center leading-snug transition-colors cursor-pointer sm:whitespace-nowrap"
          >
            <PhoneForwarded className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>
              {isAirBooking
                ? 'Мне не перезвонили · Продлить +4ч и ускорить'
                : 'Мне не перезвонили · Вызвать руководителя и ускорить'}
            </span>
          </button>

          {activeCallbackPref !== 'async_no_call' && (
            <button
              type="button"
              disabled={isRescuePending}
              data-testid="client-rescue-switch-async-btn"
              onClick={() => void executeRescueAction('switch_to_async')}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] disabled:opacity-55 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center justify-center gap-2 text-left sm:text-center leading-snug transition-colors cursor-pointer sm:whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                {confirmed.paymentChannel === 'card_online'
                  ? 'Не звонить — прислать ссылку на оплату в чат'
                  : 'Не звонить — прислать счёт в мессенджер'}
              </span>
            </button>
          )}

          <div className="inline-flex items-center gap-1.5 w-full sm:w-auto min-w-0">
            <Clock
              className="w-3.5 h-3.5 text-[#111111]/55 dark:text-[#F4F3EF]/55 shrink-0"
              aria-hidden="true"
            />
            <label htmlFor="client-reschedule-select" className="sr-only">
              Перенести время звонка продюсера
            </label>
            <select
              id="client-reschedule-select"
              data-testid="client-rescue-reschedule-select"
              disabled={isRescuePending}
              value={activeCallbackPref}
              onChange={(e) =>
                void executeRescueAction(
                  e.target.value === 'async_no_call'
                    ? 'switch_to_async'
                    : 'reschedule_callback',
                  e.target.value as ClientCallbackPreference
                )
              }
              className="flex-1 sm:flex-initial min-w-0 max-w-full min-h-[44px] px-3 rounded-xl bg-[#EFECE5] dark:bg-[#15151A] border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] truncate"
            >
              {CALLBACK_PREFERENCE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  Окно связи: {opt.shortLabel}
                </option>
              ))}
            </select>
          </div>
        </div>

        {rescueFeedback && (
          <div
            role="status"
            data-testid="client-rescue-feedback"
            className={`px-3.5 py-2.5 rounded-xl text-xs font-medium border flex items-center gap-2 ${
              rescueFeedback.kind === 'ok'
                ? 'bg-[#16A34A]/10 border-[#16A34A]/25 text-[#15803D] dark:text-[#4ADE80]'
                : 'bg-[#DC2626]/10 border-[#DC2626]/25 text-[#DC2626] dark:text-[#F87171]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{rescueFeedback.text}</span>
          </div>
        )}
      </div>

      {isDocSuiteOpen && (
        <Suspense fallback={null}>
          <BrandedDocumentSuiteModal
            isOpen={isDocSuiteOpen}
            onClose={() => setIsDocSuiteOpen(false)}
            mode="client"
            initialDoc={suiteInitialDoc}
            legalProfiles={liveLegalProfiles}
            order={{
              orderNumber: confirmed.orderNumber,
              createdAtIso: new Date(confirmed.confirmedAtMs).toISOString(),
              formatLabel: confirmed.formatLabel,
              baseBudgetRub:
                confirmed.lockedTotals?.unifiedTotalRub ??
                (typeof confirmed.selectedBudgetRub === 'number'
                  ? confirmed.selectedBudgetRub
                  : 0),
              defaultDurationSec: confirmed.spotDurationSec || 15,
              contact: confirmed.contactLine,
              companyOrInn: confirmed.companyLine,
              briefText: confirmed.briefNote,
              documentMeta: liveDocMeta,
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
