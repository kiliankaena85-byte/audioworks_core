import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  Paperclip,
  Radio,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'motion/react';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { INDUSTRY_SOLUTIONS } from '../../data/multiPageContentData';
import { buildMediaPlanSnapshotFromReservation } from '../../data/orderCrmTypes';
import {
  buildClientNextStepsTimeline,
  computeRemainingHoldSeconds,
  ConfirmedReservationSummary,
  DEFAULT_HOLD_WINDOW_SECONDS,
  OrderCheckoutMode,
  OrderDraftSnapshot,
  orderDraftStore,
} from '../../data/orderDraftStore';
import { AIRTIME_SALES_ENABLED } from '../../data/platformFeatures';
import {
  IndustryVerticalSlug,
  PlatformRoute,
  VALID_INDUSTRY_SLUGS,
} from '../../data/platformRouter';
import {
  generateOrderNumber,
  getStudioFormatDisplayMeta,
  QUICK_ORDER_PILLS,
  readSavedVipProfile,
  SavedVipProfile,
  writeSavedVipProfile,
} from '../../data/pricingData';
import {
  ComputedReservationTotals,
  computeReservationTotalsForSelection,
  formatBookingSpecificationText,
  formatHoldCountdown,
  formatNumberSpaced,
  formatRubCompact,
  ReservationProductionSelection,
} from '../../data/radioInventory';
import {
  computeSlaDeadlineWindow,
  computeSmartHoldExpirationMs,
  DEFAULT_STUDIO_WORK_SCHEDULE,
  sanitizeWorkScheduleConfig,
  StudioWorkScheduleConfig,
} from '../../data/slaWorkCalendar';
import { useLayaDecision } from '../../engine/LayaContext';
import { resolveLeadFormRateScope } from '../../security/leadShield';
import { useLeadShieldForm } from '../../security/useLeadShieldForm';
import { useRateLimit } from '../../security/useRateLimit';
import { ClientSlaAndRescuePanel } from '../ClientSlaAndRescuePanel';
import {
  CallbackPreferenceSelector,
  OperatingRegimeBanner,
} from '../OperatingRegimeAndCallbackBar';
import { CompanyDetailsForm } from '../order/CompanyDetailsForm';
import {
  OrderValidationFieldKey,
  validateOrderSubmissionFields,
} from '../order/orderFormValidation';
import {
  VoiceBriefRecorder,
  VoiceBriefSnapshot,
} from '../order/VoiceBriefRecorder';
import { ReservationConfirmedModal } from '../ReservationConfirmedModal';

interface OrderPageProps {
  draft: OrderDraftSnapshot;
  onNavigate: (route: PlatformRoute) => void;
}

type ClientMode = 'new_project' | 'returning_client';

const SPOT_DURATION_PRESETS = [10, 15, 17, 20, 22, 30] as const;

export function OrderPage({ draft, onNavigate }: OrderPageProps) {
  const { decision } = useLayaDecision();

  const hasSavedReservation =
    AIRTIME_SALES_ENABLED && draft.mediaReservation !== null;
  const isMediaBookingMode =
    AIRTIME_SALES_ENABLED &&
    draft.mode === 'air_plus_production' &&
    draft.mediaReservation !== null;

  const [clientMode, setClientMode] = useState<ClientMode>(() =>
    decision.choice === 'returning_vip' ? 'returning_client' : 'new_project'
  );
  const [savedVip, setSavedVip] = useState<SavedVipProfile | null>(() =>
    readSavedVipProfile()
  );
  const [isEditingVipContact, setIsEditingVipContact] = useState(false);
  const [workSchedule, setWorkSchedule] = useState<StudioWorkScheduleConfig>(
    DEFAULT_STUDIO_WORK_SCHEDULE
  );

  const [holdRemainingSec, setHoldRemainingSec] = useState<number>(() =>
    computeRemainingHoldSeconds(draft.holdExpiresAtMs)
  );
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [copiedSpec, setCopiedSpec] = useState(false);

  const [voiceSnap, setVoiceSnap] = useState<VoiceBriefSnapshot>({
    status: 'idle',
    seconds: 0,
  });
  const [voiceResetSignal, setVoiceResetSignal] = useState(0);

  const [contactError, setContactError] = useState<string | undefined>();
  const [companyError, setCompanyError] = useState<string | undefined>();
  const [companyNameError, setCompanyNameError] = useState<string | undefined>();
  const [companyInnError, setCompanyInnError] = useState<string | undefined>();
  const [taskError, setTaskError] = useState<string | undefined>();
  const [rateLimitError, setRateLimitError] = useState<string | undefined>();
  const [confirmedOrder, setConfirmedOrder] =
    useState<ConfirmedReservationSummary | null>(() => draft.confirmedReservation);
  const [isConfirmedModalOpen, setIsConfirmedModalOpen] = useState<boolean>(false);

  const [isFormatPickerExpanded, setIsFormatPickerExpanded] = useState<boolean>(
    () => !draft.isFormatPreselected
  );

  const activeRateScope = resolveLeadFormRateScope(
    isMediaBookingMode ? 'air_plus_production' : 'production_only'
  );

  const {
    countdownSec: rateLimitCountdownSec,
    checkRateLimit,
    recordAttempt,
    triggerCooldown,
    syncState: syncRateLimitState,
  } = useRateLimit({
    scope: activeRateScope,
    maxAttempts: 4,
    windowMs: 10 * 60 * 1000,
    minIntervalMs: 1200,
  });

  const {
    websiteTrap,
    setWebsiteTrap,
    isSubmittingLead,
    registerPointerActivity,
    registerKeyActivity,
    registerFocusActivity,
    resetShieldAfterOrder,
    submitProtectedLead,
  } = useLeadShieldForm(isMediaBookingMode ? 'air_plus_production' : 'production_only');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const briefTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const contactInputRef = useRef<HTMLInputElement | null>(null);
  const companyNameInputRef = useRef<HTMLInputElement | null>(null);
  const companyInnInputRef = useRef<HTMLInputElement | null>(null);
  const rateLimitErrorRef = useRef<HTMLParagraphElement | null>(null);
  const mediaReservation = AIRTIME_SALES_ENABLED ? draft.mediaReservation : null;

  const scrollAndFocusField = useCallback((field: OrderValidationFieldKey | null) => {
    if (!field || typeof document === 'undefined') return;
    const targetMap: Record<OrderValidationFieldKey, HTMLElement | null> = {
      brief: briefTextareaRef.current,
      contact: contactInputRef.current,
      companyName: companyNameInputRef.current,
      companyInn: companyInnInputRef.current,
      companyLine: companyNameInputRef.current ?? companyInnInputRef.current,
      rateLimit: rateLimitErrorRef.current,
    };
    const target = targetMap[field];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof target.focus === 'function') {
      window.setTimeout(() => {
        target.focus({ preventScroll: true });
      }, 220);
    }
  }, []);

  const reservationTotals = useMemo<ComputedReservationTotals | null>(() => {
    if (!mediaReservation) return null;
    return computeReservationTotalsForSelection(
      mediaReservation,
      draft.reservationProdSelection
    );
  }, [mediaReservation, draft.reservationProdSelection]);

  // Загружаем актуальное расписание смен и праздников студии с сервера (с локальным резервом)
  useEffect(() => {
    let active = true;
    fetch('/api/public/work-schedule', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; workSchedule?: Partial<StudioWorkScheduleConfig> } | null) => {
        if (active && data?.ok && data.workSchedule) {
          setWorkSchedule(sanitizeWorkScheduleConfig(data.workSchedule));
        }
      })
      .catch(() => {
        // Локальный календарь DEFAULT_STUDIO_WORK_SCHEDULE работает автономно
      });
    return () => {
      active = false;
    };
  }, []);

  // При открытии страницы оформления всегда прокручиваем экран к началу
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, []);

  useEffect(() => {
    setConfirmedOrder(draft.confirmedReservation);
  }, [draft.confirmedReservation]);

  useEffect(() => {
    setIsFormatPickerExpanded(!draft.isFormatPreselected);
  }, [draft.isFormatPreselected]);

  // Автоподстановка сохранённого VIP-профиля при входе на страницу
  useEffect(() => {
    const stored = readSavedVipProfile();
    setSavedVip(stored);
    if (stored && !draft.contactLine) {
      orderDraftStore.updateDraft({
        contactLine: stored.contactLine,
        companyLine: stored.company || draft.companyLine,
      });
      setIsEditingVipContact(false);
    }
  }, [draft.companyLine, draft.contactLine]);

  // Живой отсчёт 4-часового таймера (только если включён режим эфирных броней)
  useEffect(() => {
    if (!hasSavedReservation || !draft.holdExpiresAtMs) return;
    setHoldRemainingSec(computeRemainingHoldSeconds(draft.holdExpiresAtMs));
    const timerId = window.setInterval(() => {
      setHoldRemainingSec(computeRemainingHoldSeconds(draft.holdExpiresAtMs));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [hasSavedReservation, draft.holdExpiresAtMs]);

  const handleVoiceChange = useCallback((snap: VoiceBriefSnapshot) => {
    setVoiceSnap(snap);
  }, []);

  const handleClearTaskError = useCallback(() => {
    setTaskError(undefined);
  }, []);

  const handleSwitchMode = (nextMode: OrderCheckoutMode) => {
    setIsConfirmedModalOpen(false);
    orderDraftStore.dismissSubmittedReceipt();
    setContactError(undefined);
    setCompanyError(undefined);
    setCompanyNameError(undefined);
    setCompanyInnError(undefined);
    setTaskError(undefined);
    setRateLimitError(undefined);
    orderDraftStore.switchMode(nextMode);
  };

  const handleSwitchClientMode = (nextMode: ClientMode) => {
    setClientMode(nextMode);
    setContactError(undefined);
    setCompanyError(undefined);
    setCompanyNameError(undefined);
    setCompanyInnError(undefined);
    setTaskError(undefined);
    setRateLimitError(undefined);
    if (nextMode === 'returning_client') {
      const stored = readSavedVipProfile();
      if (stored) {
        setSavedVip(stored);
        orderDraftStore.updateDraft({
          contactLine: stored.contactLine,
          companyLine: stored.company,
        });
        setIsEditingVipContact(false);
      } else {
        setIsEditingVipContact(true);
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFileName(file.name);
      setTaskError(undefined);
    }
  };

  const isReturningFastTrack =
    clientMode === 'returning_client' && savedVip !== null && !isEditingVipContact;

  const activeIndustrySpec = draft.industryPreset
    ? INDUSTRY_SOLUTIONS[draft.industryPreset]
    : null;

  const selectedFormatMeta = useMemo(
    () => getStudioFormatDisplayMeta(draft.selectedFormat),
    [draft.selectedFormat]
  );

  // Критическое разделение: экран квитанции показывается ТОЛЬКО если пользователь только что отправил заявку
  // или сам нажал «Посмотреть статус и счёт ЭДО». Клик по любой кнопке «Заказать ролик» всегда открывает чистую форму!
  const showConfirmedView = Boolean(
    confirmedOrder && draft.isViewingSubmittedReceipt
  );

  useEffect(() => {
    if (showConfirmedView && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [showConfirmedView]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmittingLead) return;

    setContactError(undefined);
    setCompanyError(undefined);
    setCompanyNameError(undefined);
    setCompanyInnError(undefined);
    setTaskError(undefined);
    setRateLimitError(undefined);

    const preLimitCheck = checkRateLimit(activeRateScope);
    if (!preLimitCheck.allowed) {
      setRateLimitError(
        preLimitCheck.message ??
          `Слишком частая отправка. Повторите через ${preLimitCheck.retryAfterSec} сек.`
      );
      window.requestAnimationFrame(() => scrollAndFocusField('rateLimit'));
      return;
    }

    const effectiveMode: OrderCheckoutMode =
      isMediaBookingMode && mediaReservation && reservationTotals
        ? 'air_plus_production'
        : 'production_only';

    const hasVoice = voiceSnap.status === 'recorded' || voiceSnap.status === 'recording';
    const voiceSec = hasVoice ? Math.max(4, voiceSnap.seconds) : 0;

    const validation = validateOrderSubmissionFields({
      mode: effectiveMode,
      paymentChannel: draft.paymentChannel,
      contactLine: isReturningFastTrack ? savedVip.contactLine : draft.contactLine,
      companyName: draft.companyName,
      companyInn: draft.companyInn,
      legacyCompanyLine: draft.companyLine,
      savedVipCompany: savedVip?.company,
      briefText: draft.briefText,
      hasVoiceRecording: hasVoice,
      hasAttachedFile: Boolean(attachedFileName),
      isReturningFastTrack,
      honeypotFilled: Boolean(websiteTrap.trim()),
    });

    if (!validation.valid) {
      setTaskError(validation.taskError);
      setContactError(validation.contactError);
      setCompanyNameError(validation.companyNameError);
      setCompanyInnError(validation.companyInnError);
      setCompanyError(validation.companyError);
      window.requestAnimationFrame(() =>
        scrollAndFocusField(validation.firstErrorField)
      );
      return;
    }

    const effectiveContact = validation.effectiveContact;
    const effectiveCompany = validation.effectiveCompany;

    if (effectiveMode === 'air_plus_production' && mediaReservation && reservationTotals) {
      const recordedRate = recordAttempt(activeRateScope);
      if (!recordedRate.allowed) {
        setRateLimitError(
          recordedRate.message ??
            `Слишком частая отправка. Повторите через ${recordedRate.retryAfterSec} сек.`
        );
        window.requestAnimationFrame(() => scrollAndFocusField('rateLimit'));
        return;
      }

      const holdNum = 2810 + (mediaReservation.totalSpots % 580);
      const shieldResult = await submitProtectedLead({
        source: 'order_page',
        checkoutMode: 'air_plus_production',
        orderNumberCandidate: `FM-HOLD-${holdNum}`,
        formatLabel: reservationTotals.spotStatusLabel,
        totalBudgetRub: reservationTotals.unifiedTotalRub,
        contactLine: effectiveContact,
        companyLine: effectiveCompany,
        callbackPreference: draft.callbackPreference,
        briefText: draft.briefText.trim(),
        hasVoiceRecording: hasVoice,
        voiceDurationSec: voiceSec,
        hasAttachedFile: Boolean(attachedFileName),
        attachedFileName,
        mediaPlanSnapshot: buildMediaPlanSnapshotFromReservation(
          mediaReservation,
          reservationTotals
        ),
        isReturningFastTrack,
        requireBriefOrVoice: false,
        skipClientRateConsume: true,
      });

      if (!shieldResult.ok) {
        if (shieldResult.verdict === 'rate_limited' && shieldResult.retryAfterSec) {
          triggerCooldown(shieldResult.retryAfterSec, shieldResult.rateLimitError);
        }
        setContactError(shieldResult.contactError);
        setCompanyError(shieldResult.companyError);
        setTaskError(shieldResult.taskError);
        setRateLimitError(shieldResult.rateLimitError);
        const firstServerError: OrderValidationFieldKey | null = shieldResult.contactError
          ? 'contact'
          : shieldResult.companyError
            ? 'companyLine'
            : shieldResult.taskError
              ? 'brief'
              : shieldResult.rateLimitError
                ? 'rateLimit'
                : null;
        window.requestAnimationFrame(() => scrollAndFocusField(firstServerError));
        return;
      }

      const nextVip: SavedVipProfile = {
        contactLine: effectiveContact,
        company: effectiveCompany,
      };
      if (shieldResult.conversionAllowed) {
        writeSavedVipProfile(nextVip);
        setSavedVip(nextVip);
        setIsEditingVipContact(false);
      }

      const nowMs = Date.now();
      const fallbackSla = computeSlaDeadlineWindow(
        nowMs,
        draft.callbackPreference,
        workSchedule
      );
      const fallbackHoldMs = computeSmartHoldExpirationMs(nowMs, workSchedule);

      const summary: ConfirmedReservationSummary = {
        orderNumber: shieldResult.orderNumber,
        confirmedAtMs: nowMs,
        holdExpiresAtMs:
          shieldResult.holdExpiresAtMs ??
          draft.holdExpiresAtMs ??
          fallbackHoldMs ??
          nowMs + DEFAULT_HOLD_WINDOW_SECONDS * 1000,
        checkoutMode: 'air_plus_production',
        callbackPreference: draft.callbackPreference,
        slaWindowStartAtMs:
          shieldResult.slaWindowStartAtMs ?? fallbackSla.slaWindowStartMs,
        slaDeadlineAtMs: shieldResult.slaDeadlineAtMs ?? fallbackSla.slaDeadlineMs,
        promisedWindowLabel:
          shieldResult.promisedWindowLabel ?? fallbackSla.promisedWindowLabel,
        rescueToken: shieldResult.rescueToken ?? null,
        formatLabel: reservationTotals.spotStatusLabel,
        spotDurationSec: mediaReservation.spotDurationSec ?? draft.spotDurationSec,
        industryLabel: mediaReservation.nicheLabel,
        contactLine: effectiveContact,
        companyLine: nextVip.company,
        briefNote: draft.briefText.trim(),
        hasVoice,
        voiceSec,
        fileName: attachedFileName,
        lockedMediaReservation: mediaReservation,
        lockedTotals: reservationTotals,
        conversionAllowed: shieldResult.conversionAllowed,
        innVerified: shieldResult.innVerified,
      };

      orderDraftStore.confirmReservationOrder(summary);
      setConfirmedOrder(summary);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const recordedRate = recordAttempt(activeRateScope);
    if (!recordedRate.allowed) {
      setRateLimitError(
        recordedRate.message ??
          `Слишком частая отправка. Повторите через ${recordedRate.retryAfterSec} сек.`
      );
      window.requestAnimationFrame(() => scrollAndFocusField('rateLimit'));
      return;
    }

    const chosenPill =
      QUICK_ORDER_PILLS.find((p) => p.id === draft.selectedFormat) ?? QUICK_ORDER_PILLS[1];

    const shieldResult = await submitProtectedLead({
      source: 'order_page',
      checkoutMode: 'production_only',
      paymentChannel: draft.paymentChannel,
      orderNumberCandidate: generateOrderNumber(),
      formatLabel: chosenPill.label,
      totalBudgetRub: selectedFormatMeta.priceRub,
      contactLine: effectiveContact,
      companyLine: effectiveCompany,
      callbackPreference: draft.callbackPreference,
      briefText: draft.briefText.trim(),
      hasVoiceRecording: hasVoice,
      voiceDurationSec: voiceSec,
      hasAttachedFile: Boolean(attachedFileName),
      attachedFileName,
      mediaPlanSnapshot: null,
      isReturningFastTrack,
      requireBriefOrVoice: true,
      skipClientRateConsume: true,
    });

    if (!shieldResult.ok) {
      if (shieldResult.verdict === 'rate_limited' && shieldResult.retryAfterSec) {
        triggerCooldown(shieldResult.retryAfterSec, shieldResult.rateLimitError);
      }
      setContactError(shieldResult.contactError);
      setCompanyError(shieldResult.companyError);
      setTaskError(shieldResult.taskError);
      setRateLimitError(shieldResult.rateLimitError);
      const firstServerError: OrderValidationFieldKey | null = shieldResult.taskError
        ? 'brief'
        : shieldResult.contactError
          ? 'contact'
          : shieldResult.companyError
            ? 'companyLine'
            : shieldResult.rateLimitError
              ? 'rateLimit'
              : null;
      window.requestAnimationFrame(() => scrollAndFocusField(firstServerError));
      return;
    }

    const nextVip: SavedVipProfile = {
      contactLine: effectiveContact,
      company: effectiveCompany,
    };
    if (shieldResult.conversionAllowed) {
      writeSavedVipProfile(nextVip);
      setSavedVip(nextVip);
      setIsEditingVipContact(false);
    }

    const nowMs = Date.now();
    const fallbackSla = computeSlaDeadlineWindow(
      nowMs,
      draft.callbackPreference,
      workSchedule
    );
    const fallbackHoldMs = computeSmartHoldExpirationMs(nowMs, workSchedule);

    const summary: ConfirmedReservationSummary = {
      orderNumber: shieldResult.orderNumber,
      confirmedAtMs: nowMs,
      holdExpiresAtMs:
        shieldResult.holdExpiresAtMs ??
        fallbackHoldMs ??
        nowMs + DEFAULT_HOLD_WINDOW_SECONDS * 1000,
      checkoutMode: 'production_only',
      paymentChannel: draft.paymentChannel,
      selectedFormatId: draft.selectedFormat,
      selectedBudgetRub: selectedFormatMeta.priceRub,
      callbackPreference: draft.callbackPreference,
      slaWindowStartAtMs:
        shieldResult.slaWindowStartAtMs ?? fallbackSla.slaWindowStartMs,
      slaDeadlineAtMs: shieldResult.slaDeadlineAtMs ?? fallbackSla.slaDeadlineMs,
      promisedWindowLabel:
        shieldResult.promisedWindowLabel ?? fallbackSla.promisedWindowLabel,
      rescueToken: shieldResult.rescueToken ?? null,
      formatLabel: chosenPill.label,
      spotDurationSec: draft.spotDurationSec,
      industryLabel: activeIndustrySpec?.shortTitle ?? null,
      contactLine: effectiveContact,
      companyLine: nextVip.company,
      briefNote: draft.briefText.trim(),
      hasVoice,
      voiceSec,
      fileName: attachedFileName,
      lockedMediaReservation: null,
      lockedTotals: null,
      conversionAllowed: shieldResult.conversionAllowed,
      innVerified: shieldResult.innVerified,
    };

    orderDraftStore.confirmReservationOrder(summary);
    setConfirmedOrder(summary);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCopyBookingSpec = async () => {
    if (!confirmedOrder?.lockedMediaReservation || !confirmedOrder.lockedTotals) return;
    const specText = formatBookingSpecificationText({
      orderNumber: confirmedOrder.orderNumber,
      payload: confirmedOrder.lockedMediaReservation,
      totals: confirmedOrder.lockedTotals,
      contact: confirmedOrder.contactLine,
      companyRequisites: confirmedOrder.companyLine,
      briefText: confirmedOrder.briefNote,
      hasVoice: confirmedOrder.hasVoice,
      voiceSec: confirmedOrder.voiceSec,
      requisitesFileName: confirmedOrder.fileName,
    });
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(specText);
      }
      setCopiedSpec(true);
      window.setTimeout(() => setCopiedSpec(false), 2400);
    } catch {
      setCopiedSpec(true);
      window.setTimeout(() => setCopiedSpec(false), 2400);
    }
  };

  const handleDownloadBookingSpec = () => {
    if (!confirmedOrder?.lockedMediaReservation || !confirmedOrder.lockedTotals) return;
    const specText = formatBookingSpecificationText({
      orderNumber: confirmedOrder.orderNumber,
      payload: confirmedOrder.lockedMediaReservation,
      totals: confirmedOrder.lockedTotals,
      contact: confirmedOrder.contactLine,
      companyRequisites: confirmedOrder.companyLine,
      briefText: confirmedOrder.briefNote,
      hasVoice: confirmedOrder.hasVoice,
      voiceSec: confirmedOrder.voiceSec,
      requisitesFileName: confirmedOrder.fileName,
    });
    const blob = new Blob([specText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FMWorks-${confirmedOrder.orderNumber}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const startNewCleanStudioOrder = () => {
    setIsConfirmedModalOpen(false);
    orderDraftStore.dismissSubmittedReceipt();
    setCopiedSpec(false);
    setRateLimitError(undefined);
    orderDraftStore.updateDraft({ briefText: '' });
    setAttachedFileName(null);
    setVoiceResetSignal((prev) => prev + 1);
    resetShieldAfterOrder();
    syncRateLimitState(activeRateScope);
  };

  const shortSpotVoiceLabel =
    mediaReservation?.spotDurationSec !== undefined && mediaReservation.spotDurationSec <= 12
      ? 'Короткий спот (12 000 ₽)'
      : 'Голос и стиль (15 000 ₽)';

  const mediaProductionOptions: {
    id: ReservationProductionSelection;
    label: string;
  }[] = mediaReservation?.isBonusProductionUnlocked
    ? [
        { id: 'bonus_express_24h', label: 'Экспресс за 24ч — 0 ₽ Бонус' },
        { id: 'cinema', label: 'Игровой ролик (35 000 ₽)' },
        { id: 'ready_spot', label: 'Готовый ролик (0 ₽)' },
      ]
    : [
        { id: 'voice_style', label: shortSpotVoiceLabel },
        { id: 'turnkey', label: 'Под ключ (25 000 ₽)' },
        { id: 'cinema', label: 'Игровой (35 000 ₽)' },
        { id: 'ready_spot', label: 'Готовый ролик (0 ₽)' },
      ];

  const confirmedNextSteps = useMemo(() => {
    if (!confirmedOrder) return [];
    const effectiveMode: OrderCheckoutMode =
      AIRTIME_SALES_ENABLED && confirmedOrder.checkoutMode === 'air_plus_production'
        ? 'air_plus_production'
        : 'production_only';
    const isNegotiable =
      confirmedOrder.selectedFormatId === 'custom_consult' ||
      confirmedOrder.selectedBudgetRub === 0;
    return buildClientNextStepsTimeline(
      effectiveMode,
      confirmedOrder.lockedMediaReservation?.stations.length ?? 0,
      {
        callbackPreference: confirmedOrder.callbackPreference,
        scheduleConfig: workSchedule,
        paymentChannel: confirmedOrder.paymentChannel,
        isNegotiable,
      }
    );
  }, [confirmedOrder, workSchedule]);

  return (
    <section
      data-testid="fullscreen-order-page"
      aria-labelledby="order-page-heading"
      className="py-10 sm:py-16 lg:py-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-8 sm:space-y-10">
        {/* Верхняя навигационная строка возврата */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#111111]/10 dark:border-white/10">
          <button
            type="button"
            onClick={() =>
              onNavigate(isMediaBookingMode ? { kind: 'hot-air' } : { kind: 'home' })
            }
            className="min-h-[42px] inline-flex items-center gap-2 text-sm font-medium text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              {isMediaBookingMode ? 'К конструктору горящего эфира' : 'На главную студию'}
            </span>
          </button>

          {hasSavedReservation && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
              <div
                data-testid="drawer-hold-timer"
                className="inline-flex flex-wrap items-center gap-2 text-xs sm:text-[13px] font-semibold tabular-nums text-[#111111] dark:text-[#F4F3EF]"
              >
                <Clock className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
                {showConfirmedView && confirmedOrder ? (
                  <span>
                    Бронь{' '}
                    <strong className="text-[#FF4820]">
                      #{confirmedOrder.orderNumber}
                    </strong>{' '}
                    зафиксирована · Резерв: {formatHoldCountdown(holdRemainingSec)}
                  </span>
                ) : (
                  <span>
                    Шаг 2 из 2: Укажите контакт для активации резерва (
                    <strong className="text-[#FF4820]">
                      {formatHoldCountdown(holdRemainingSec)}
                    </strong>
                    )
                  </span>
                )}
              </div>

              <div
                role="group"
                aria-label="Режим оформления"
                className="inline-flex flex-wrap sm:flex-nowrap items-center max-w-full p-1 rounded-xl bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/10 dark:border-white/10"
              >
                <button
                  type="button"
                  onClick={() => handleSwitchMode('air_plus_production')}
                  aria-pressed={isMediaBookingMode}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    isMediaBookingMode
                      ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                      : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                  }`}
                >
                  Бронь эфира + Продакшн
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('production_only')}
                  aria-pressed={!isMediaBookingMode}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    !isMediaBookingMode
                      ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                      : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                  }`}
                >
                  Только продакшн
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Неблокирующая тихая плашка предыдущего отправленного заказа (форма остаётся полностью открытой!) */}
        {!showConfirmedView && confirmedOrder && (
          <div
            data-testid="previous-submitted-order-banner"
            className="rounded-2xl px-4 py-3.5 sm:px-6 bg-[#EFECE5]/80 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm tabular-nums"
          >
            <div className="flex flex-wrap items-center gap-2">
              <FileText className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
              <span>
                У вас уже есть активная заявка{' '}
                <strong className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                  #{confirmedOrder.orderNumber}
                </strong>{' '}
                ({confirmedOrder.formatLabel}). Ниже открыта чистая форма для нового заказа.
              </span>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <button
                type="button"
                data-testid="open-previous-order-receipt-btn"
                onClick={() => orderDraftStore.openSubmittedReceipt()}
                className="font-semibold text-[#FF4820] hover:underline cursor-pointer whitespace-nowrap"
              >
                Открыть статус и счёт ЭДО →
              </button>
              <button
                type="button"
                onClick={() => orderDraftStore.clearConfirmedReservation()}
                className="text-xs text-[#111111]/54 dark:text-[#F4F3EF]/54 hover:text-[#111111] dark:hover:text-[#F4F3EF] cursor-pointer whitespace-nowrap"
              >
                Скрыть
              </button>
            </div>
          </div>
        )}

        {/* Заголовок экрана оформления */}
        <div className="max-w-3xl space-y-3">
          <p className="text-sm font-medium text-[#FF4820]">
            {showConfirmedView && confirmedOrder
              ? `Заявка #${confirmedOrder.orderNumber} принята · ${
                  confirmedOrder.promisedWindowLabel ?? 'Ответ продюсера в течение 15–20 минут'
                }`
              : isMediaBookingMode
                ? `Выбрано радиостанций: ${mediaReservation?.stations.length ?? 0} · Оставьте контакт, чтобы закрепить слоты за вашей компанией`
                : 'Консьерж-оформление FMWorks · Рамочный договор, ЭДО и оплата 54-ФЗ'}
          </p>
          <h1
            id="order-page-heading"
            className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
          >
            {showConfirmedView && confirmedOrder
              ? AIRTIME_SALES_ENABLED && confirmedOrder.lockedMediaReservation
                ? 'Ваша приоритетная бронь принята в работу'
                : 'Заявка принята в студию FMWorks'
              : isMediaBookingMode
                ? 'Завершение бронирования эфира за 15 секунд'
                : draft.selectedFormat === 'custom_consult'
                  ? 'Обсудить задачу с продюсером и согласовать смету'
                  : 'Запуск аудиоролика по договору'}
          </h1>
          <p className="text-base sm:text-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 editorial-pretty">
            {showConfirmedView && confirmedOrder
              ? 'Ниже показаны живой статус SLA, рамочный договор-оферта со счётом (ЭДО) или оплатой по 54-ФЗ и пошаговый маршрут работы.'
              : isMediaBookingMode
                ? 'Укажите Имя, Телефон или @Telegram и реквизиты компании для выставления рамочного договора и счёта в ЭДО. Задачу на ролик можно добавить ниже.'
                : 'Опишите задачу голосом или парой строк и выберите удобный способ оплаты. После подтверждения заявки, рамочного договора и 100% предоплаты приступаем к 3 концепциям сценария, кастингу и записи.'}
          </p>
        </div>

        {showConfirmedView && confirmedOrder ? (
          /* ЭКРАН ПОДТВЕРЖДЕНИЯ ОТПРАВЛЕННОЙ ЗАЯВКИ С ПУЛЬТОМ SLA И СЧЁТОМ ЭДО */
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            data-testid="drawer-confirmed-hold-card"
            className="rounded-3xl p-6 sm:p-10 lg:p-12 bg-[#EFECE5]/80 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 space-y-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#111111]/10 dark:border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#FF4820] text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-[#FF4820] tabular-nums">
                    {AIRTIME_SALES_ENABLED && confirmedOrder.lockedMediaReservation
                      ? `Приоритетная бронь #${confirmedOrder.orderNumber} зафиксирована`
                      : `Заказ #${confirmedOrder.orderNumber} принят на согласование`}
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">
                    {AIRTIME_SALES_ENABLED && confirmedOrder.lockedMediaReservation
                      ? 'Эфирные квоты поставлены на 4-часовой холд'
                      : confirmedOrder.promisedWindowLabel ??
                        (confirmedOrder.selectedFormatId === 'custom_consult' ||
                        confirmedOrder.selectedBudgetRub === 0
                          ? 'Оценим задачу, согласуем цену и подготовим договор'
                          : confirmedOrder.paymentChannel === 'card_online'
                            ? 'Проверяем задачу и готовим ссылку на оплату (54-ФЗ)'
                            : 'Проверяем реквизиты и открываем договор и счёт в ЭДО')}
                  </h2>
                </div>
              </div>

              <div className="text-xs sm:text-sm font-medium text-[#111111]/62 dark:text-[#F4F3EF]/62 tabular-nums sm:text-right space-y-1">
                <div>
                  Контакт:{' '}
                  <strong className="text-[#111111] dark:text-[#F4F3EF]">
                    {confirmedOrder.contactLine}
                  </strong>
                </div>
                {confirmedOrder.conversionAllowed && (
                  <div
                    data-testid="verified-human-lead-status"
                    className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold"
                  >
                    Верифицированная заявка
                    {confirmedOrder.innVerified ? ' · ИНН проверен по ключу ФНС' : ''}
                  </div>
                )}
              </div>
            </div>

            {/* Живой пульт SLA, счёта-оферты ЭДО 24/7 и самообслуживания клиента */}
            <ClientSlaAndRescuePanel
              confirmed={confirmedOrder}
              workSchedule={workSchedule}
              defaultExpandedEdo
              onUpdatedConfirmed={(next) => setConfirmedOrder(next)}
            />

            {/* Наглядная дорожная карта из 3 шагов с учётом времени суток и выбранного способа связи */}
            <div className="space-y-3">
              <h3 className="text-base sm:text-lg font-bold text-[#111111] dark:text-[#F4F3EF]">
                Что происходит дальше (пошагово)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {confirmedNextSteps.map((step) => (
                  <div
                    key={step.stepNumber}
                    className="rounded-2xl p-5 bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold tabular-nums">
                      <span className="text-[#FF4820]">Шаг {step.stepNumber}</span>
                      <span className="text-[#111111]/58 dark:text-[#F4F3EF]/58">
                        {step.timingLabel}
                      </span>
                    </div>
                    <p className="text-sm sm:text-base font-bold leading-snug text-[#111111] dark:text-[#F4F3EF]">
                      {step.title}
                    </p>
                    <p className="text-xs sm:text-sm leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {AIRTIME_SALES_ENABLED &&
            confirmedOrder.lockedMediaReservation &&
            confirmedOrder.lockedTotals ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7 space-y-4">
                  <p
                    data-testid="drawer-hold-explanation"
                    className="text-base leading-relaxed text-[#111111]/80 dark:text-[#F4F3EF]/80"
                  >
                    Продюсер эфирного отдела сверяет выбранные тайм-слоты с трафик-службой радиостанций и подготовит единый договор-счёт в ЭДО.
                  </p>

                  <div className="divide-y divide-[#111111]/10 dark:divide-white/10 border-y border-[#111111]/10 dark:border-white/10 tabular-nums text-sm">
                    {confirmedOrder.lockedMediaReservation.stations.map((st) => (
                      <div
                        key={st.slotId}
                        className="py-3.5 flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                            {st.station} · {st.spotsIncluded} выходов
                            {st.exactDurationSec ? ` · ${st.exactDurationSec} сек` : ''}
                          </p>
                          <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                            {st.daypart || st.frequencyFm}
                          </p>
                        </div>
                        <span className="font-bold shrink-0">{formatRubCompact(st.hotPrice)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      data-testid="copy-booking-spec-btn"
                      onClick={handleCopyBookingSpec}
                      className="min-h-[46px] px-5 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer text-center leading-snug"
                    >
                      <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>
                        {copiedSpec
                          ? 'Спецификация скопирована'
                          : 'Скопировать спецификацию брони'}
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="download-booking-spec-btn"
                      onClick={handleDownloadBookingSpec}
                      className="min-h-[46px] px-5 py-2.5 rounded-full border border-[#111111]/18 dark:border-[#F4F3EF]/18 hover:border-[#FF4820] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer text-center leading-snug"
                    >
                      <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Скачать спецификацию (.txt)</span>
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-2xl p-6 bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 space-y-3 text-sm tabular-nums">
                  <div className="flex items-center justify-between">
                    <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">Выходов и охват:</span>
                    <span className="font-semibold">
                      {confirmedOrder.lockedMediaReservation.totalSpots} вых. ·{' '}
                      {formatNumberSpaced(confirmedOrder.lockedMediaReservation.totalReachOTS)} OTS
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">Продакшн ролика:</span>
                    <span className="font-semibold text-[#FF4820]">
                      {confirmedOrder.lockedTotals.spotStatusLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">Фиксированная выгода:</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      +{formatRubCompact(confirmedOrder.lockedTotals.totalSavingsRub)} (−
                      {confirmedOrder.lockedMediaReservation.airDiscountPercent}%)
                    </span>
                  </div>
                  <div className="pt-3 border-t border-[#111111]/10 dark:border-white/10 flex items-baseline justify-between">
                    <span className="font-semibold">Единый счёт в ЭДО:</span>
                    <span className="text-2xl font-bold">
                      {formatRubCompact(confirmedOrder.lockedTotals.unifiedTotalRub)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-4 border-y border-[#111111]/10 dark:border-white/10 text-sm tabular-nums">
                <div>
                  <p className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">Выбранный пакет</p>
                  <p className="font-bold text-base mt-1">{confirmedOrder.formatLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">Целевой хронометраж</p>
                  <p className="font-bold text-base mt-1">{confirmedOrder.spotDurationSec} сек</p>
                </div>
                <div>
                  <p className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">Отрасль и документы</p>
                  <p className="font-bold text-base mt-1">
                    {confirmedOrder.industryLabel ?? 'Коммерческий эфир'} · Паспорт прав + ЭДО
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() =>
                  onNavigate(
                    AIRTIME_SALES_ENABLED && confirmedOrder.lockedMediaReservation
                      ? { kind: 'hot-air' }
                      : { kind: 'cases' }
                  )
                }
                className="w-full sm:w-auto min-h-[46px] px-5 sm:px-6 py-3 rounded-full bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] text-sm font-semibold text-center leading-snug cursor-pointer sm:whitespace-nowrap"
              >
                {AIRTIME_SALES_ENABLED && confirmedOrder.lockedMediaReservation
                  ? 'Вернуться в раздел «Горящий эфир»'
                  : 'Посмотреть разборы кейсов'}
              </button>
              <button
                type="button"
                data-testid="start-another-studio-order-btn"
                onClick={startNewCleanStudioOrder}
                className="w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-[#111111]/15 dark:border-[#F4F3EF]/15 text-sm font-semibold text-center leading-snug hover:border-[#FF4820] transition-colors cursor-pointer sm:whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Оформить ещё один ролик</span>
              </button>
            </div>
          </motion.div>
        ) : (
          /* ДВУХКОЛОНОЧНАЯ ПОЛНОЭКРАННАЯ ФОРМА ЗАКАЗА (ВСЕГДА РАЗБЛОКИРОВАНА ДЛЯ НОВОГО ПРОЕКТА) */
          <form
            onSubmit={handleSubmit}
            onPointerMove={registerPointerActivity}
            onKeyDown={registerKeyActivity}
            onFocusCapture={registerFocusActivity}
            noValidate
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start"
          >
            {/* Невидимая антибот-ловушка (Honeypot) без влияния на доступность и верстку */}
            <div aria-hidden="true" className="sr-only relative">
              <label htmlFor="order-corp-website-trap">
                Корпоративный портал (не заполнять)
              </label>
              <input
                id="order-corp-website-trap"
                name="corp_website_url"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={websiteTrap}
                onChange={(e) => setWebsiteTrap(e.target.value)}
                className="w-px h-px"
              />
            </div>

            {/* ЛЕВАЯ КОЛОНКА (7 колонок) */}
            <div className="lg:col-span-7 space-y-8">
              {isMediaBookingMode && (
                <OperatingRegimeBanner
                  workSchedule={workSchedule}
                  mode="air_plus_production"
                />
              )}

              {isMediaBookingMode ? (
                /* =========================================================
                   СПЯЩИЙ РЕЖИМ БРОНИРОВАНИЯ ЭФИРА (активен только при AIRTIME_SALES_ENABLED = true)
                   ========================================================= */
                <>
                  <div
                    data-testid="contact-first-booking-step"
                    className="rounded-3xl p-5 sm:p-7 bg-[#EFECE5]/90 dark:bg-[#16161B] border border-[#111111]/12 dark:border-white/12 space-y-5"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[#FF4820]">
                        01. Быстрая фиксация эфира (обязательный шаг)
                      </p>
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                        Куда прислать подтверждение слотов и счёт в ЭДО
                      </h2>
                      <p className="text-xs sm:text-sm text-[#111111]/68 dark:text-[#F4F3EF]/68">
                        Укажите телефон или @Telegram и выберите удобный формат ответа продюсера.
                      </p>
                    </div>

                    {isReturningFastTrack ? (
                      <div className="rounded-2xl p-4 sm:p-5 bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs text-[#FF4820] font-semibold">
                            Сохранённый профиль постоянного клиента · запуск в 1 клик
                          </p>
                          <p className="text-sm sm:text-base font-semibold mt-0.5">
                            {savedVip.contactLine}
                            {savedVip.company ? ` · ${savedVip.company}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEditingVipContact(true)}
                          className="text-xs font-semibold underline underline-offset-4 opacity-75 hover:opacity-100 cursor-pointer shrink-0"
                        >
                          Изменить
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label
                            htmlFor="order-contact-input"
                            className="block text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                          >
                            Имя и Телефон / @Telegram *
                          </label>
                          <input
                            ref={contactInputRef}
                            id="order-contact-input"
                            type="text"
                            data-testid="drawer-contact-input"
                            aria-label="Имя и Телефон / @Telegram"
                            aria-invalid={Boolean(contactError)}
                            value={draft.contactLine}
                            onChange={(e) => {
                              orderDraftStore.updateDraft({ contactLine: e.target.value });
                              if (contactError) setContactError(undefined);
                            }}
                            placeholder="Например: Алексей +7 999 123-45-67"
                            className={`scroll-mt-24 w-full min-h-[48px] px-4 py-3 rounded-2xl border text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none transition-all ${
                              contactError
                                ? 'border-[#FF4820] ring-2 ring-[#FF4820]/20 bg-[#FF4820]/[0.03]'
                                : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] border-[#111111]/18 dark:border-[#F4F3EF]/18 focus:border-[#FF4820]'
                            }`}
                          />
                          {contactError && (
                            <p
                              role="alert"
                              data-testid="drawer-contact-error"
                              className="text-xs font-semibold text-[#FF4820] flex items-center gap-1.5"
                            >
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>{contactError}</span>
                            </p>
                          )}
                        </div>

                        <CompanyDetailsForm
                          idPrefix="media-order-company"
                          nameInputRef={companyNameInputRef}
                          innInputRef={companyInnInputRef}
                          companyName={draft.companyName}
                          companyInn={draft.companyInn}
                          paymentChannel="edo_invoice"
                          companyNameError={companyNameError}
                          companyInnError={companyInnError}
                          onChangeCompanyName={(val) => {
                            orderDraftStore.updateDraft({ companyName: val });
                            if (companyNameError) setCompanyNameError(undefined);
                            if (companyError) setCompanyError(undefined);
                          }}
                          onChangeCompanyInn={(digits) => {
                            orderDraftStore.updateDraft({ companyInn: digits });
                            if (companyInnError) setCompanyInnError(undefined);
                            if (companyError) setCompanyError(undefined);
                          }}
                        />
                      </div>
                    )}

                    <CallbackPreferenceSelector
                      value={draft.callbackPreference}
                      onChange={(nextPref) =>
                        orderDraftStore.updateDraft({ callbackPreference: nextPref })
                      }
                      mode="air_plus_production"
                      compact
                    />

                    {companyError && (
                      <p
                        role="alert"
                        data-testid="drawer-company-error"
                        className="text-xs font-semibold text-[#FF4820] flex items-center gap-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{companyError}</span>
                      </p>
                    )}

                    {rateLimitError && (
                      <p
                        ref={rateLimitErrorRef}
                        role="alert"
                        data-testid="drawer-rate-limit-error"
                        className="scroll-mt-24 text-xs font-semibold text-[#FF4820] flex items-center gap-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{rateLimitError}</span>
                      </p>
                    )}

                    <div className="pt-1 space-y-2.5">
                      <button
                        type="submit"
                        disabled={isSubmittingLead}
                        data-testid="drawer-submit-btn"
                        className="w-full sm:w-auto min-w-[280px] min-h-[52px] py-3.5 px-7 rounded-full bg-[#FF4820] hover:bg-[#E63C17] disabled:opacity-65 active:scale-[0.99] text-white text-sm sm:text-base font-semibold transition-all cursor-pointer disabled:cursor-default text-center leading-snug"
                      >
                        {isSubmittingLead
                          ? 'Проверка и фиксация квот…'
                          : rateLimitCountdownSec > 0
                            ? `Повторная отправка через ${rateLimitCountdownSec} сек`
                            : 'Поставить эфирную сетку на 4-часовой холд'}
                      </button>

                      <p
                        data-testid="order-antispam-caption"
                        className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56 flex flex-wrap items-center gap-1.5 tabular-nums"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
                        <span>
                          Проверка ИНН по алгоритму ФНС · Формирование рамочного договора и счёта без капчи
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl p-5 sm:p-7 bg-[#EFECE5]/55 dark:bg-[#141419] border border-[#111111]/10 dark:border-white/10 space-y-5">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[#111111]/58 dark:text-[#F4F3EF]/58">
                        02. По желанию: формат ролика, голосовое ТЗ или реквизиты
                      </p>
                      <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                        Пожелания к аудиоролику (необязательно для брони эфира)
                      </h3>
                    </div>

                    <div className="space-y-2.5">
                      <p className="text-xs font-semibold text-[#111111]/64 dark:text-[#F4F3EF]/64">
                        Статус производства ролика в составе брони:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {mediaProductionOptions.map((opt) => {
                          const active =
                            reservationTotals?.productionSelection === opt.id ||
                            draft.reservationProdSelection === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              data-testid={`drawer-prod-opt-${opt.id}`}
                              onClick={() =>
                                orderDraftStore.updateDraft({
                                  reservationProdSelection: opt.id,
                                })
                              }
                              aria-pressed={active}
                              className={`min-h-[42px] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors border cursor-pointer text-center leading-snug whitespace-nowrap ${
                                active
                                  ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                                  : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/80 dark:text-[#F4F3EF]/80 border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <VoiceBriefRecorder
                      variant="secondary"
                      idleLabel="Надиктовать задачу для ролика голосом (по желанию)"
                      idleHint="30 секунд своими словами"
                      resetSignal={voiceResetSignal}
                      onStateChange={handleVoiceChange}
                      onClearError={handleClearTaskError}
                    />

                    <textarea
                      rows={2}
                      aria-label="О чем ролик или какая акция?"
                      value={draft.briefText}
                      onChange={(e) => {
                        orderDraftStore.updateDraft({ briefText: e.target.value });
                        if (taskError) setTaskError(undefined);
                      }}
                      placeholder="Кратко о продукте, акции или пожеланиях к подаче (необязательно)"
                      className="w-full px-4 py-3 rounded-2xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-[#F4F3EF]/14 text-sm text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none focus:border-[#FF4820]"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".doc,.docx,.pdf,.txt,.rtf,.xls,.xlsx,.jpg,.png"
                        onChange={handleFileChange}
                        className="hidden"
                      />

                      <button
                        type="button"
                        data-testid="drawer-attach-requisites-btn"
                        onClick={() => fileInputRef.current?.click()}
                        className="min-h-[42px] max-w-full inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#111111]/16 dark:border-[#F4F3EF]/16 text-xs sm:text-sm font-medium text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:border-[#FF4820] transition-colors cursor-pointer leading-snug"
                      >
                        <Paperclip className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {attachedFileName
                            ? attachedFileName
                            : 'Прикрепить карточку реквизитов или бриф (.pdf, .doc)'}
                        </span>
                      </button>

                      {attachedFileName && (
                        <button
                          type="button"
                          onClick={() => {
                            setAttachedFileName(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-xs font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55 hover:text-[#FF4820] cursor-pointer"
                        >
                          Убрать файл
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* =========================================================
                   ОСНОВНОЙ РЕЖИМ СТУДИЙНОГО ЗАКАЗА АУДИОРОЛИКА
                   ========================================================= */
                <>
                  {/* Переключатель: Новый проект / Постоянный клиент — показывается только при наличии сохранённого профиля */}
                  {(savedVip !== null || decision.choice === 'returning_vip') && (
                    <div
                      role="group"
                      aria-label="Тип клиента"
                      className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/8 dark:border-[#F4F3EF]/10"
                    >
                      <button
                        type="button"
                        onClick={() => handleSwitchClientMode('new_project')}
                        aria-pressed={clientMode === 'new_project'}
                        className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          clientMode === 'new_project'
                            ? 'bg-[#F7F6F2] text-[#111111] dark:bg-[#0D0D0F] dark:text-[#F4F3EF] shadow-xs'
                            : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                        }`}
                      >
                        Новый проект
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSwitchClientMode('returning_client')}
                        aria-pressed={clientMode === 'returning_client'}
                        className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          clientMode === 'returning_client'
                            ? 'bg-[#F7F6F2] text-[#111111] dark:bg-[#0D0D0F] dark:text-[#F4F3EF] shadow-xs'
                            : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                        }`}
                      >
                        Постоянный клиент (по договору)
                      </button>
                    </div>
                  )}

                  {!isFormatPickerExpanded ? (
                    /* Компактная плашка предвыбранного тарифа и хронометража */
                    <div
                      data-testid="preselected-format-summary"
                      className="rounded-2xl p-4 sm:p-5 bg-[#EFECE5]/80 dark:bg-[#15151A] border border-[#111111]/12 dark:border-white/12 flex flex-col sm:flex-row sm:items-center justify-between gap-4 tabular-nums"
                    >
                      <div className="space-y-1 min-w-0">
                        <p className="text-xs font-semibold text-[#111111]/58 dark:text-[#F4F3EF]/58">
                          01. Выбранный пакет и параметры ролика
                        </p>
                        <p className="text-base sm:text-lg font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                          {selectedFormatMeta.title} · {selectedFormatMeta.priceFormatted}
                        </p>
                        <p className="text-xs text-[#111111]/68 dark:text-[#F4F3EF]/68">
                          Срок после оплаты: {selectedFormatMeta.turnaround} · Хронометраж:{' '}
                          {draft.spotDurationSec} сек
                          {activeIndustrySpec ? ` · ${activeIndustrySpec.shortTitle}` : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        data-testid="expand-format-picker-btn"
                        onClick={() => setIsFormatPickerExpanded(true)}
                        className="min-h-[40px] px-4 py-2 rounded-full border border-[#111111]/18 dark:border-white/18 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
                      >
                        Изменить тариф или хронометраж
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Шаг 01: Выбор пакета продакшна */}
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-[#111111]/58 dark:text-[#F4F3EF]/58">
                            01. Формат студийного производства
                          </p>
                          {draft.isFormatPreselected && (
                            <button
                              type="button"
                              data-testid="collapse-format-picker-btn"
                              onClick={() => setIsFormatPickerExpanded(false)}
                              className="text-xs font-semibold text-[#FF4820] hover:underline cursor-pointer whitespace-nowrap"
                            >
                              Свернуть параметры ↑
                            </button>
                          )}
                        </div>
                        <div
                          role="group"
                          aria-label="Формат ролика"
                          className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                        >
                          {QUICK_ORDER_PILLS.map((pill) => {
                            const active = draft.selectedFormat === pill.id;
                            const spanClass =
                              pill.id === 'custom_consult' ? 'sm:col-span-2' : '';
                            return (
                              <button
                                key={pill.id}
                                type="button"
                                data-testid={`studio-format-pill-${pill.id}`}
                                onClick={() =>
                                  orderDraftStore.updateDraft({ selectedFormat: pill.id })
                                }
                                aria-pressed={active}
                                className={`min-h-[54px] px-4 py-3 rounded-2xl text-left transition-colors border cursor-pointer flex flex-col justify-center ${spanClass} ${
                                  active
                                    ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                                    : 'bg-[#EFECE5]/65 dark:bg-[#15151A] text-[#111111] dark:text-[#F4F3EF] border-[#111111]/12 dark:border-white/10 hover:border-[#111111]/35 dark:hover:border-white/30'
                                }`}
                              >
                                <span className="text-sm font-semibold">{pill.label}</span>
                                <span
                                  className={`text-xs tabular-nums mt-0.5 ${
                                    active ? 'opacity-72' : 'opacity-58'
                                  }`}
                                >
                                  {pill.shortSummary}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Шаг 02: Точный хронометраж ролика и отрасль */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-[#111111]/10 dark:border-white/10">
                        <div className="space-y-2.5">
                          <label
                            htmlFor="order-spot-seconds-input"
                            className="block text-xs font-semibold text-[#111111]/58 dark:text-[#F4F3EF]/58"
                          >
                            02. Хронометраж ролика (включая 17с, 22с и др.)
                          </label>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {SPOT_DURATION_PRESETS.map((sec) => {
                              const isCurrent = draft.spotDurationSec === sec;
                              return (
                                <button
                                  key={sec}
                                  type="button"
                                  onClick={() =>
                                    orderDraftStore.updateDraft({ spotDurationSec: sec })
                                  }
                                  aria-pressed={isCurrent}
                                  className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold tabular-nums border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                    isCurrent
                                      ? 'bg-[#FF4820] text-white border-[#FF4820]'
                                      : 'border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820]'
                                  }`}
                                >
                                  {sec}с
                                </button>
                              );
                            })}
                            <input
                              id="order-spot-seconds-input"
                              type="number"
                              min={5}
                              max={60}
                              value={draft.spotDurationSec}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (Number.isFinite(val)) {
                                  orderDraftStore.updateDraft({ spotDurationSec: val });
                                }
                              }}
                              aria-label="Точный хронометраж в секундах"
                              className="w-20 min-h-[38px] px-2.5 rounded-xl bg-transparent border border-[#111111]/16 dark:border-white/16 text-xs font-semibold tabular-nums text-center focus:outline-none focus:border-[#FF4820]"
                            />
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          <label
                            htmlFor="order-industry-select"
                            className="block text-xs font-semibold text-[#111111]/58 dark:text-[#F4F3EF]/58"
                          >
                            Отраслевой профиль и модерация ФЗ-38
                          </label>
                          <select
                            id="order-industry-select"
                            value={draft.industryPreset ?? ''}
                            onChange={(e) => {
                              const val = e.target.value as IndustryVerticalSlug | '';
                              orderDraftStore.updateDraft({
                                industryPreset: val ? val : null,
                              });
                            }}
                            className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#EFECE5]/70 dark:bg-[#15151A] border border-[#111111]/14 dark:border-white/14 text-sm font-medium focus:outline-none focus:border-[#FF4820]"
                          >
                            <option value="">Универсальный коммерческий проект</option>
                            {VALID_INDUSTRY_SLUGS.map((slug) => (
                              <option key={slug} value={slug}>
                                {INDUSTRY_SOLUTIONS[slug].shortTitle}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Голосовая надиктовка задачи + текстовый бриф + прикрепление файла */}
                  <div className="space-y-3.5 pt-2 border-t border-[#111111]/10 dark:border-white/10">
                    <p className="text-xs font-semibold text-[#111111]/60 dark:text-[#F4F3EF]/60">
                      {draft.selectedFormat === 'custom_consult'
                        ? `${isFormatPickerExpanded ? '03' : '02'}. Опишите нестандартную задачу, этап «Только сценарий» или вопросы продюсеру`
                        : `${isFormatPickerExpanded ? '03' : '02'}. Передайте задачу голосом или текстом`}
                    </p>

                    <VoiceBriefRecorder
                      variant="primary"
                      idleLabel={
                        draft.selectedFormat === 'custom_consult'
                          ? 'Надиктовать вопрос или ТЗ голосом'
                          : 'Надиктовать задачу голосом'
                      }
                      idleHint="30 секунд своими словами вместо заполнения анкеты"
                      resetSignal={voiceResetSignal}
                      onStateChange={handleVoiceChange}
                      onClearError={handleClearTaskError}
                    />

                    <textarea
                      ref={briefTextareaRef}
                      id="production-order-brief-input"
                      rows={3}
                      data-testid="drawer-brief-input"
                      aria-label="О чем ролик или какая акция?"
                      aria-invalid={Boolean(taskError)}
                      aria-describedby={taskError ? 'production-order-task-error' : undefined}
                      value={draft.briefText}
                      onChange={(e) => {
                        orderDraftStore.updateDraft({ briefText: e.target.value });
                        if (taskError) setTaskError(undefined);
                      }}
                      placeholder={
                        draft.selectedFormat === 'custom_consult'
                          ? 'Например: нужна серия из 4 роликов, отдельный этап «Только сценарий» для записи на месте или у нас есть вопросы до старта по договорной цене…'
                          : 'О чем ролик, какая главная выгода для клиента и какой контакт оставить в финале?'
                      }
                      className={`scroll-mt-24 w-full px-4 py-3.5 rounded-2xl border text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none transition-all ${
                        taskError
                          ? 'border-[#FF4820] ring-2 ring-[#FF4820]/20 bg-[#FF4820]/[0.03]'
                          : 'bg-transparent border-[#111111]/16 dark:border-[#F4F3EF]/16 focus:border-[#FF4820]'
                      }`}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".doc,.docx,.pdf,.txt,.rtf,.xls,.xlsx,.jpg,.png"
                        onChange={handleFileChange}
                        className="hidden"
                      />

                      <button
                        type="button"
                        data-testid="drawer-attach-requisites-btn"
                        onClick={() => fileInputRef.current?.click()}
                        className="min-h-[42px] max-w-full inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#111111]/16 dark:border-[#F4F3EF]/16 text-xs sm:text-sm font-medium text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:border-[#FF4820] transition-colors cursor-pointer leading-snug"
                      >
                        <Paperclip className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {attachedFileName
                            ? attachedFileName
                            : 'Прикрепить карточку реквизитов или бриф (.pdf, .doc)'}
                        </span>
                      </button>

                      {attachedFileName && (
                        <button
                          type="button"
                          onClick={() => {
                            setAttachedFileName(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-xs font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55 hover:text-[#FF4820] cursor-pointer"
                        >
                          Убрать файл
                        </button>
                      )}
                    </div>

                    {taskError && (
                      <p
                        id="production-order-task-error"
                        role="alert"
                        data-testid="drawer-task-error"
                        className="text-xs font-semibold text-[#FF4820] flex items-center gap-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{taskError}</span>
                      </p>
                    )}
                  </div>

                  {/* Способ оплаты, реквизиты ЭДО и выбор удобного окна связи */}
                  <div className="space-y-4 pt-2 border-t border-[#111111]/10 dark:border-white/10">
                    <p className="text-xs font-semibold text-[#111111]/60 dark:text-[#F4F3EF]/60">
                      {isFormatPickerExpanded ? '04' : '03'}. Способ оплаты, реквизиты и контакт для договора
                    </p>

                    <div
                      role="group"
                      aria-label="Способ оплаты заказа"
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                    >
                      <button
                        type="button"
                        data-testid="payment-channel-edo"
                        aria-pressed={draft.paymentChannel === 'edo_invoice'}
                        onClick={() =>
                          orderDraftStore.updateDraft({ paymentChannel: 'edo_invoice' })
                        }
                        className={`min-h-[60px] px-4 py-3 rounded-2xl text-left border transition-colors cursor-pointer flex flex-col justify-center ${
                          draft.paymentChannel === 'edo_invoice'
                            ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                            : 'bg-[#EFECE5]/65 dark:bg-[#15151A] text-[#111111] dark:text-[#F4F3EF] border-[#111111]/12 dark:border-white/10 hover:border-[#FF4820]'
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-semibold">
                          Безнал · Рамочный договор и ЭДО
                        </span>
                        <span
                          className={`text-[11px] mt-0.5 leading-snug ${
                            draft.paymentChannel === 'edo_invoice'
                              ? 'opacity-75'
                              : 'opacity-60'
                          }`}
                        >
                          Для ООО и ИП · Диадок / СБИС · Договор и счёт доступны сразу
                        </span>
                      </button>

                        <button
                          type="button"
                          onClick={() => {
                            orderDraftStore.updateDraft({
                              paymentChannel: 'card_online',
                            });
                            setCompanyNameError(undefined);
                            setCompanyInnError(undefined);
                            setCompanyError(undefined);
                          }}
                          aria-pressed={draft.paymentChannel === 'card_online'}
                          data-testid="payment-channel-card"
                          className={`min-h-[60px] px-4 py-3 rounded-2xl text-left border transition-colors cursor-pointer flex flex-col justify-center ${
                            draft.paymentChannel === 'card_online'
                              ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                              : 'bg-[#EFECE5]/65 dark:bg-[#15151A] text-[#111111] dark:text-[#F4F3EF] border-[#111111]/12 dark:border-white/10 hover:border-[#FF4820]'
                          }`}
                        >
                          <span className="text-xs sm:text-sm font-semibold">
                            Картой физлица / СБП (54-ФЗ)
                          </span>
                          <span
                            className={`text-[11px] mt-0.5 leading-snug ${
                              draft.paymentChannel === 'card_online'
                                ? 'opacity-75'
                                : 'opacity-60'
                            }`}
                          >
                            ЮKassa / Робокасса · Чек 54-ФЗ · Если удобнее без р/с
                          </span>
                        </button>
                      </div>

                    {isReturningFastTrack ? (
                      <div className="space-y-4">
                        <div className="rounded-2xl p-4 sm:p-5 bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/10 dark:border-white/10 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-xs text-[#FF4820] font-semibold">
                              Сохранённый профиль постоянного клиента · запуск в 2 клика
                            </p>
                            <p className="text-sm sm:text-base font-semibold mt-0.5">
                              {savedVip.contactLine}
                              {savedVip.company ? ` · ${savedVip.company}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsEditingVipContact(true)}
                            className="text-xs font-semibold underline underline-offset-4 opacity-75 hover:opacity-100 cursor-pointer shrink-0"
                          >
                            Изменить
                          </button>
                        </div>

                        {draft.paymentChannel === 'edo_invoice' && !savedVip.company && (
                          <CompanyDetailsForm
                            idPrefix="vip-order-company"
                            nameInputRef={companyNameInputRef}
                            innInputRef={companyInnInputRef}
                            companyName={draft.companyName}
                            companyInn={draft.companyInn}
                            paymentChannel={draft.paymentChannel}
                            companyNameError={companyNameError}
                            companyInnError={companyInnError}
                            onChangeCompanyName={(val) => {
                              orderDraftStore.updateDraft({ companyName: val });
                              if (companyNameError) setCompanyNameError(undefined);
                              if (companyError) setCompanyError(undefined);
                            }}
                            onChangeCompanyInn={(digits) => {
                              orderDraftStore.updateDraft({ companyInn: digits });
                              if (companyInnError) setCompanyInnError(undefined);
                              if (companyError) setCompanyError(undefined);
                            }}
                            onSwitchToCardOnline={() => {
                              orderDraftStore.updateDraft({ paymentChannel: 'card_online' });
                              setCompanyNameError(undefined);
                              setCompanyInnError(undefined);
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label
                            htmlFor="production-order-contact-input"
                            className="block text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                          >
                            Контакт ответственного лица (Имя и Телефон / @Telegram) *
                          </label>
                          <input
                            ref={contactInputRef}
                            id="production-order-contact-input"
                            type="text"
                            data-testid="drawer-contact-input"
                            aria-label="Имя и Телефон / @Telegram"
                            aria-invalid={Boolean(contactError)}
                            aria-describedby={
                              contactError ? 'production-order-contact-error' : undefined
                            }
                            value={draft.contactLine}
                            onChange={(e) => {
                              orderDraftStore.updateDraft({ contactLine: e.target.value });
                              if (contactError) setContactError(undefined);
                            }}
                            placeholder="Например: Анна +7 916 555-32-10 или @anna_promo"
                            className={`scroll-mt-24 w-full min-h-[48px] px-4 py-3 rounded-2xl border text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none transition-all ${
                              contactError
                                ? 'border-[#FF4820] ring-2 ring-[#FF4820]/20 bg-[#FF4820]/[0.03]'
                                : 'bg-transparent border-[#111111]/16 dark:border-[#F4F3EF]/16 focus:border-[#FF4820]'
                            }`}
                          />
                          {contactError && (
                            <p
                              id="production-order-contact-error"
                              role="alert"
                              data-testid="drawer-contact-error"
                              className="text-xs font-semibold text-[#FF4820] flex items-center gap-1.5"
                            >
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>{contactError}</span>
                            </p>
                          )}
                        </div>

                        <CompanyDetailsForm
                          idPrefix="production-order-company"
                          nameInputRef={companyNameInputRef}
                          innInputRef={companyInnInputRef}
                          companyName={draft.companyName}
                          companyInn={draft.companyInn}
                          paymentChannel={draft.paymentChannel}
                          companyNameError={companyNameError}
                          companyInnError={companyInnError}
                          onChangeCompanyName={(val) => {
                            orderDraftStore.updateDraft({ companyName: val });
                            if (companyNameError) setCompanyNameError(undefined);
                            if (companyError) setCompanyError(undefined);
                          }}
                          onChangeCompanyInn={(digits) => {
                            orderDraftStore.updateDraft({ companyInn: digits });
                            if (companyInnError) setCompanyInnError(undefined);
                            if (companyError) setCompanyError(undefined);
                          }}
                          onSwitchToCardOnline={() => {
                            orderDraftStore.updateDraft({ paymentChannel: 'card_online' });
                            setCompanyNameError(undefined);
                            setCompanyInnError(undefined);
                          }}
                        />
                      </div>
                    )}

                    <CallbackPreferenceSelector
                      value={draft.callbackPreference}
                      onChange={(nextPref) =>
                        orderDraftStore.updateDraft({ callbackPreference: nextPref })
                      }
                      mode="production_only"
                      workSchedule={workSchedule}
                    />

                    {companyError && (
                      <p
                        role="alert"
                        data-testid="drawer-company-error"
                        className="text-xs font-semibold text-[#FF4820] flex items-center gap-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{companyError}</span>
                      </p>
                    )}

                    {rateLimitError && (
                      <p
                        ref={rateLimitErrorRef}
                        role="alert"
                        data-testid="drawer-rate-limit-error"
                        className="scroll-mt-24 text-xs font-semibold text-[#FF4820] flex items-center gap-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{rateLimitError}</span>
                      </p>
                    )}
                  </div>

                  <div className="pt-2 space-y-2.5">
                    {(taskError ||
                      contactError ||
                      companyNameError ||
                      companyInnError ||
                      companyError) && (
                      <p
                        role="alert"
                        data-testid="order-submit-validation-hint"
                        className="text-xs font-semibold text-[#FF4820] flex items-center gap-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          Заполните подсвеченные поля:{' '}
                          {[
                            taskError ? 'описание задачи' : null,
                            contactError ? 'контакт' : null,
                            companyNameError ? 'название компании' : null,
                            companyInnError ? 'ИНН' : null,
                            companyError ? 'реквизиты' : null,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmittingLead}
                      data-testid="drawer-submit-btn"
                      className="w-full sm:w-auto min-w-[280px] min-h-[52px] py-4 px-8 rounded-full bg-[#FF4820] hover:bg-[#E63C17] disabled:opacity-65 active:scale-[0.99] text-white text-sm sm:text-base font-semibold transition-all cursor-pointer disabled:cursor-default text-center leading-snug whitespace-nowrap"
                    >
                      {isSubmittingLead
                        ? 'Проверка и фиксация заявки…'
                        : rateLimitCountdownSec > 0
                          ? `Повторная отправка через ${rateLimitCountdownSec} сек`
                          : draft.selectedFormat === 'custom_consult'
                            ? 'Отправить задачу на оценку продюсеру'
                            : draft.paymentChannel === 'card_online'
                              ? 'Оформить заявку и получить ссылку оплаты'
                              : 'Оформить и получить договор и счёт'}
                    </button>

                    <p
                      data-testid="order-antispam-caption"
                      className="text-xs text-[#111111]/54 dark:text-[#F4F3EF]/54 flex flex-wrap items-center gap-1.5 tabular-nums"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
                      <span>
                        Проверка ИНН по алгоритму ФНС · Мгновенное формирование рамочного договора и счёта
                      </span>
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* ПРАВАЯ КОЛОНКА (5 колонок, липкая при скролле): Живая смета и спецификация под ЭДО */}
            <aside className="lg:col-span-5 lg:sticky lg:top-24 space-y-5">
              {isMediaBookingMode && mediaReservation && reservationTotals ? (
                <div
                  data-testid="drawer-media-grid-card"
                  className="rounded-3xl p-6 sm:p-7 bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/10 dark:border-white/10 space-y-4 tabular-nums"
                >
                  <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-[#111111]/10 dark:border-white/10">
                    <div>
                      <p className="text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
                        Спецификация выбранного эфира
                      </p>
                      <h2 className="text-lg sm:text-xl font-bold tracking-tight mt-0.5">
                        {mediaReservation.nicheLabel}
                        {mediaReservation.spotDurationSec
                          ? ` · ролик ${mediaReservation.spotDurationSec} сек`
                          : ''}
                      </h2>
                    </div>
                    <span className="text-xs font-semibold text-[#FF4820] shrink-0">
                      −{mediaReservation.airDiscountPercent}% от прайса
                    </span>
                  </div>

                  {mediaReservation.targetAudienceSummary && (
                    <p className="text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
                      Ядро ЦА: {mediaReservation.targetAudienceSummary}
                    </p>
                  )}

                  <div className="divide-y divide-[#111111]/8 dark:divide-white/8 text-xs sm:text-sm max-h-[280px] overflow-y-auto subtle-scrollbar pr-1">
                    {mediaReservation.stations.map((st) => (
                      <div
                        key={st.slotId}
                        className="py-2.5 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                            {st.station} · {st.spotsIncluded} вых.
                            {st.exactDurationSec ? ` · ${st.exactDurationSec} сек` : ''}
                          </p>
                          <p className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">
                            {st.daypart || st.frequencyFm}
                          </p>
                        </div>
                        <span className="font-semibold shrink-0">
                          {formatRubCompact(st.hotPrice)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3.5 border-t border-[#111111]/10 dark:border-white/10 space-y-2 text-xs sm:text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">
                        Суммарный охват сетки:
                      </span>
                      <span className="font-semibold">
                        {mediaReservation.totalSpots} вых. ·{' '}
                        {formatNumberSpaced(mediaReservation.totalReachOTS)} OTS
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62 shrink-0">
                        Статус ролика:
                      </span>
                      <span
                        data-testid="drawer-spot-status"
                        className="font-semibold text-[#111111] dark:text-[#F4F3EF] text-right editorial-balance"
                      >
                        {reservationTotals.spotStatusLabel}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">
                        Экономия к открытому прайсу:
                      </span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        +{formatRubCompact(reservationTotals.totalSavingsRub)}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-[#111111]/10 dark:border-white/10 flex items-baseline justify-between gap-2">
                      <span className="font-semibold">Единый счёт в ЭДО:</span>
                      <span
                        data-testid="drawer-unified-total"
                        className="text-2xl font-bold text-[#111111] dark:text-[#F4F3EF]"
                      >
                        {formatRubCompact(reservationTotals.unifiedTotalRub)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => onNavigate({ kind: 'hot-air' })}
                      className="font-semibold text-[#FF4820] hover:underline cursor-pointer"
                    >
                      Изменить станции или слоты →
                    </button>
                    <button
                      type="button"
                      onClick={() => orderDraftStore.clearMediaReservation()}
                      className="text-[#111111]/52 dark:text-[#F4F3EF]/52 hover:text-[#111111] dark:hover:text-[#F4F3EF] cursor-pointer"
                    >
                      Очистить эфир
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  data-testid="order-studio-summary-card"
                  className="rounded-3xl p-6 sm:p-7 bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/10 dark:border-white/10 space-y-5 tabular-nums"
                >
                  <div className="pb-4 border-b border-[#111111]/10 dark:border-white/10 space-y-1">
                    <p className="text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
                      Сводка студийного заказа
                    </p>
                    <h2 className="text-xl font-bold tracking-tight">
                      {selectedFormatMeta.title}
                    </h2>
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">
                        Стоимость пакета:
                      </span>
                      <span
                        data-testid="order-summary-price"
                        className="text-lg font-bold"
                      >
                        {selectedFormatMeta.priceFormatted}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">
                        Срок готовности:
                      </span>
                      <span className="font-semibold">
                        {selectedFormatMeta.turnaround}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">
                        Способ оплаты:
                      </span>
                      <span className="font-semibold text-right">
                        {draft.paymentChannel === 'card_online'
                          ? 'Карта / СБП (54-ФЗ)'
                          : 'Рамочный договор · ЭДО'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">
                        Целевой хронометраж:
                      </span>
                      <span className="font-semibold">{draft.spotDurationSec} сек</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">
                        Юридический пакет:
                      </span>
                      <span className="font-semibold">Договор · Паспорт РАО/ВОИС</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#111111]/10 dark:border-white/10 space-y-1.5 text-xs">
                    <p className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                      Порядок запуска и защиты авторских прав
                    </p>
                    <p className="text-[#111111]/72 dark:text-[#F4F3EF]/72 leading-relaxed">
                      Разработка сценариев, кастинг и запись начинаются строго после проверки контрагента, заключения рамочного договора-оферты и 100% предоплаты.
                    </p>
                  </div>

                  {activeIndustrySpec && (
                    <div className="pt-4 border-t border-[#111111]/10 dark:border-white/10 space-y-1.5 text-xs">
                      <p className="font-semibold text-[#FF4820] flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Пре-чек модерации · {activeIndustrySpec.shortTitle}</span>
                      </p>
                      <p className="text-[#111111]/70 dark:text-[#F4F3EF]/70 leading-relaxed">
                        {activeIndustrySpec.legalComplianceRules[0]}
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-[#111111]/10 dark:border-white/10">
                    {AIRTIME_SALES_ENABLED ? (
                      <button
                        type="button"
                        onClick={() => onNavigate({ kind: 'hot-air' })}
                        className="w-full min-h-[42px] px-4 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820] text-xs font-semibold inline-flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Radio className="w-3.5 h-3.5 text-[#FF4820]" aria-hidden="true" />
                          <span>Нужен ещё и радиоэфир со скидкой?</span>
                        </span>
                        <span className="text-[#FF4820]">Подобрать слоты →</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onNavigate({ kind: 'cases' })}
                        className="w-full min-h-[42px] px-4 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820] text-xs font-semibold inline-flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span>Примеры партитур сценариев и кейсы</span>
                        <ArrowUpRight className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="px-2 flex items-center justify-between gap-2 text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55">
                <span>
                  {draft.paymentChannel === 'card_online'
                    ? 'ЮKassa / Робокасса · Чек 54-ФЗ'
                    : 'Договор-оферта и счёт ЭДО сразу после заявки'}
                </span>
                <span className="font-medium shrink-0">Договор · 100% предоплата</span>
              </div>
            </aside>
          </form>
        )}
      </div>

      {/* Диалоговое модальное окно подтверждения заявки со статусом SLA и автономным счётом ЭДО */}
      <ReservationConfirmedModal
        isOpen={isConfirmedModalOpen}
        confirmed={confirmedOrder}
        onClose={() => setIsConfirmedModalOpen(false)}
        onNavigateHotAir={
          AIRTIME_SALES_ENABLED
            ? () => onNavigate({ kind: 'hot-air' })
            : undefined
        }
      />
    </section>
  );
}
