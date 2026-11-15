import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  FileCheck2,
  FileText,
  FolderOpen,
  Paperclip,
  Radio,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'motion/react';
import { ChangeEvent, FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCanonicalDeliveryDetail,
  CLIENT_DELIVERY_CHANNEL_OPTIONS,
  DELIVERY_CLOUD_OPTIONS,
  DELIVERY_MESSENGER_OPTIONS,
  resolveDeliveryChannelLabel,
  upsertClientCabinetEntry,
} from '../../data/clientCabinetHelpers';
import {
  extractEmailFromContactText,
  normalizeClientEmail,
} from '../../data/clientAuthShared';
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
  formatStructuredCompanyLine,
  inspectInnDigits,
  normalizeInnDigits,
} from '../order/companyDetailsHelpers';
import {
  OrderValidationFieldKey,
  validateOrderSubmissionFields,
} from '../order/orderFormValidation';
import {
  VoiceBriefRecorder,
  VoiceBriefSnapshot,
} from '../order/VoiceBriefRecorder';
import { PersonalDataConsentField } from '../legal/PersonalDataConsentField';
import {
  counterpartyToDocumentMetaPatch,
  type CounterpartyLookupResult,
  resolveOfflineCounterpartyByInn,
} from '../../data/konturIntegrationCore';
import {
  createDefaultStudioLegalProfiles,
  type OrderDocumentMeta,
  StudioLegalProfilesConfig,
} from '../../data/studioDocumentsCore';
import { ReservationConfirmedModal } from '../ReservationConfirmedModal';
import { BrandedDocumentSuiteModal } from '../documents/BrandedDocumentSuiteModal';

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
  const [deliveryError, setDeliveryError] = useState<string | undefined>();
  const [companyError, setCompanyError] = useState<string | undefined>();
  const [companyNameError, setCompanyNameError] = useState<string | undefined>();
  const [companyInnError, setCompanyInnError] = useState<string | undefined>();
  const [taskError, setTaskError] = useState<string | undefined>();
  const [consentError, setConsentError] = useState<string | undefined>();
  const [rateLimitError, setRateLimitError] = useState<string | undefined>();
  const [pdnConsentAccepted, setPdnConsentAccepted] = useState<boolean>(false);
  const [legalProfiles, setLegalProfiles] = useState<StudioLegalProfilesConfig>(() =>
    createDefaultStudioLegalProfiles()
  );
  const [confirmedOrder, setConfirmedOrder] =
    useState<ConfirmedReservationSummary | null>(() => draft.confirmedReservation);
  const [isConfirmedModalOpen, setIsConfirmedModalOpen] = useState<boolean>(false);

  const [isFormatPickerExpanded, setIsFormatPickerExpanded] = useState<boolean>(
    () => !draft.isFormatPreselected
  );
  const [isDurationIndustryExpanded, setIsDurationIndustryExpanded] =
    useState<boolean>(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState<boolean>(false);
  const [quickInnName, setQuickInnName] = useState<string>('');
  const [quickInnDigits, setQuickInnDigits] = useState<string>('');
  const [quickInnError, setQuickInnError] = useState<string | null>(null);
  const [isSavingQuickInn, setIsSavingQuickInn] = useState<boolean>(false);
  const [quickInnSaved, setQuickInnSaved] = useState<boolean>(false);
  const [activeSessionEmail, setActiveSessionEmail] = useState<string | null>(null);
  const [bindEmailDraft, setBindEmailDraft] = useState<string>('');
  const [bindEmailError, setBindEmailError] = useState<string | null>(null);
  const [isBindingEmail, setIsBindingEmail] = useState<boolean>(false);

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
  const deliverySectionRef = useRef<HTMLDivElement | null>(null);
  const deliveryDetailInputRef = useRef<HTMLInputElement | null>(null);
  const companyNameInputRef = useRef<HTMLInputElement | null>(null);
  const companyInnInputRef = useRef<HTMLInputElement | null>(null);
  const consentInputRef = useRef<HTMLInputElement | null>(null);
  const rateLimitErrorRef = useRef<HTMLParagraphElement | null>(null);
  const mediaReservation = AIRTIME_SALES_ENABLED ? draft.mediaReservation : null;

  const scrollAndFocusField = useCallback((field: OrderValidationFieldKey | null) => {
    if (!field || typeof document === 'undefined') return;
    const targetMap: Record<OrderValidationFieldKey, HTMLElement | null> = {
      brief: briefTextareaRef.current,
      contact: contactInputRef.current,
      delivery: deliveryDetailInputRef.current ?? deliverySectionRef.current,
      companyName: companyNameInputRef.current,
      companyInn: companyInnInputRef.current,
      companyLine: companyNameInputRef.current ?? companyInnInputRef.current,
      consent: consentInputRef.current,
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
    fetch('/api/public/legal-profile', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; legalProfiles?: StudioLegalProfilesConfig } | null) => {
        if (active && data?.ok && data.legalProfiles) {
          setLegalProfiles(data.legalProfiles);
        }
      })
      .catch(() => {
        // Локальные профили г. Тверь работают автономно
      });
    fetch('/api/client-auth/session', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            ok?: boolean;
            authenticated?: boolean;
            account?: { email?: string } | null;
          } | null
        ) => {
          if (active && data?.authenticated && data.account?.email) {
            setActiveSessionEmail(data.account.email);
          }
        }
      )
      .catch(() => {
        // Сессия кабинета опциональна
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
    setDeliveryError(undefined);
    setCompanyError(undefined);
    setCompanyNameError(undefined);
    setCompanyInnError(undefined);
    setTaskError(undefined);
    setConsentError(undefined);
    setRateLimitError(undefined);
    orderDraftStore.switchMode(nextMode);
  };

  const handleSwitchClientMode = (nextMode: ClientMode) => {
    setClientMode(nextMode);
    setContactError(undefined);
    setDeliveryError(undefined);
    setCompanyError(undefined);
    setCompanyNameError(undefined);
    setCompanyInnError(undefined);
    setTaskError(undefined);
    setConsentError(undefined);
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

  const resolvedDeliveryDetail = useMemo(
    () =>
      buildCanonicalDeliveryDetail({
        channel: draft.preferredDeliveryChannel,
        messenger: draft.deliveryMessenger,
        messengerOther: draft.deliveryMessengerOther,
        cloud: draft.deliveryCloud,
        cloudOther: draft.deliveryCloudOther,
        email: draft.deliveryEmail,
      }),
    [
      draft.preferredDeliveryChannel,
      draft.deliveryMessenger,
      draft.deliveryMessengerOther,
      draft.deliveryCloud,
      draft.deliveryCloudOther,
      draft.deliveryEmail,
    ]
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
    setDeliveryError(undefined);
    setCompanyError(undefined);
    setCompanyNameError(undefined);
    setCompanyInnError(undefined);
    setTaskError(undefined);
    setConsentError(undefined);
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
      requireCompanyDetails: isMediaBookingMode ? true : draft.wantsInvoiceNow,
      preferredDeliveryChannel: draft.preferredDeliveryChannel,
      deliveryMessenger: draft.deliveryMessenger,
      deliveryMessengerOther: draft.deliveryMessengerOther,
      deliveryCloud: draft.deliveryCloud,
      deliveryCloudOther: draft.deliveryCloudOther,
      deliveryEmail: draft.deliveryEmail,
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
      pdnConsentAccepted: isReturningFastTrack ? true : pdnConsentAccepted,
    });

    if (!validation.valid) {
      setTaskError(validation.taskError);
      setContactError(validation.contactError);
      setDeliveryError(validation.deliveryError);
      setCompanyNameError(validation.companyNameError);
      setCompanyInnError(validation.companyInnError);
      setCompanyError(validation.companyError);
      setConsentError(validation.consentError);
      window.requestAnimationFrame(() =>
        scrollAndFocusField(validation.firstErrorField)
      );
      return;
    }

    if (
      draft.preferredDeliveryChannel === 'cabinet' &&
      draft.cabinetEmail.trim().length > 0 &&
      !normalizeClientEmail(draft.cabinetEmail)
    ) {
      setDeliveryError(
        'Проверьте адрес почты (например, name@company.ru) или оставьте поле пустым'
      );
      window.requestAnimationFrame(() => scrollAndFocusField('delivery'));
      return;
    }

    const effectiveContact = validation.effectiveContact;
    const effectiveCompany = validation.effectiveCompany;

    const buildClientSideDocumentMeta = (): OrderDocumentMeta | null => {
      const candidateInn = normalizeInnDigits(
        draft.companyInn || effectiveCompany.match(/(\d{10,12})/)?.[1] || ''
      );
      const offlineCp = candidateInn
        ? resolveOfflineCounterpartyByInn(candidateInn)
        : null;
      const basePatch = offlineCp
        ? counterpartyToDocumentMetaPatch(offlineCp, {
            wantsDiadocDuplicate: draft.wantsDiadocDuplicate,
          })
        : {};
      const trimmedManualName = draft.companyName.trim();
      const resolvedFullLegalName =
        draft.resolvedCounterpartyMeta?.customerLegalName || basePatch.customerLegalName;
      const isAutoShortName =
        Boolean(trimmedManualName) &&
        (trimmedManualName === offlineCp?.shortName ||
          trimmedManualName === resolvedFullLegalName);

      const merged: OrderDocumentMeta = {
        ...basePatch,
        ...(draft.resolvedCounterpartyMeta ?? {}),
        ...(trimmedManualName && (!isAutoShortName || !resolvedFullLegalName)
          ? { customerLegalName: trimmedManualName }
          : {}),
        ...(candidateInn ? { customerInn: candidateInn } : {}),
        wantsDiadocDuplicate: draft.wantsDiadocDuplicate,
      };
      return Object.keys(merged).length > 0 ? merged : null;
    };

    const submittedDocMeta =
      draft.wantsInvoiceNow || effectiveMode === 'air_plus_production' || Boolean(draft.companyInn)
        ? buildClientSideDocumentMeta()
        : null;

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
        preferredDeliveryChannel: draft.preferredDeliveryChannel,
        preferredDeliveryDetail: resolvedDeliveryDetail,
        cabinetEmail:
          draft.preferredDeliveryChannel === 'cabinet'
            ? draft.cabinetEmail.trim()
            : undefined,
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
        pdnConsentAccepted: isReturningFastTrack ? true : pdnConsentAccepted,
        wantsDiadocDuplicate: draft.wantsDiadocDuplicate,
        documentMeta: submittedDocMeta,
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
        preferredDeliveryChannel: draft.preferredDeliveryChannel,
        preferredDeliveryDetail: resolvedDeliveryDetail,
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
        wantsDiadocDuplicate: draft.wantsDiadocDuplicate,
        documentMeta: shieldResult.documentMeta ?? submittedDocMeta,
        clientEmail: shieldResult.clientEmail ?? null,
        autoSignedIn: Boolean(shieldResult.clientSession?.authenticated),
      };

      if (shieldResult.clientEmail) {
        setActiveSessionEmail(shieldResult.clientEmail);
      }

      if (shieldResult.rescueToken) {
        upsertClientCabinetEntry({
          orderNumber: shieldResult.orderNumber,
          rescueToken: shieldResult.rescueToken,
          contactLine: effectiveContact,
          companyLine: nextVip.company,
        });
      }

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
      preferredDeliveryChannel: draft.preferredDeliveryChannel,
      preferredDeliveryDetail: resolvedDeliveryDetail,
      cabinetEmail:
        draft.preferredDeliveryChannel === 'cabinet'
          ? draft.cabinetEmail.trim()
          : undefined,
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
      pdnConsentAccepted: isReturningFastTrack ? true : pdnConsentAccepted,
      wantsDiadocDuplicate: draft.wantsInvoiceNow ? draft.wantsDiadocDuplicate : false,
      documentMeta: submittedDocMeta,
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
      preferredDeliveryChannel: draft.preferredDeliveryChannel,
      preferredDeliveryDetail: resolvedDeliveryDetail,
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
      wantsDiadocDuplicate: draft.wantsInvoiceNow ? draft.wantsDiadocDuplicate : false,
      documentMeta: shieldResult.documentMeta ?? submittedDocMeta,
      clientEmail: shieldResult.clientEmail ?? null,
      autoSignedIn: Boolean(shieldResult.clientSession?.authenticated),
    };

    if (shieldResult.clientEmail) {
      setActiveSessionEmail(shieldResult.clientEmail);
    }

    if (shieldResult.rescueToken) {
      upsertClientCabinetEntry({
        orderNumber: shieldResult.orderNumber,
        rescueToken: shieldResult.rescueToken,
        contactLine: effectiveContact,
        companyLine: nextVip.company,
      });
    }

    setQuickInnName('');
    setQuickInnDigits('');
    setQuickInnError(null);
    setQuickInnSaved(false);
    setBindEmailDraft('');
    setBindEmailError(null);
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

  const handleQuickInnDigitsChange = (rawValue: string) => {
    const digits = normalizeInnDigits(rawValue);
    setQuickInnDigits(digits);
    if (quickInnError) setQuickInnError(null);
    const check = inspectInnDigits(digits);
    if (check.isCompleteLength && check.checksumValid) {
      const offline = resolveOfflineCounterpartyByInn(digits);
      if (offline && !quickInnName.trim()) {
        setQuickInnName(offline.shortName);
      }
      fetch(`/api/public/counterparty-by-inn?inn=${encodeURIComponent(digits)}`, {
        headers: { Accept: 'application/json' },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { ok?: boolean; counterparty?: CounterpartyLookupResult } | null) => {
          if (data?.ok && data.counterparty) {
            setQuickInnName((prev) => prev.trim() || data.counterparty!.shortName);
          }
        })
        .catch(() => {
          // Офлайн-подстановка уже выполнена
        });
    }
  };

  const handleSaveQuickInnForConfirmed = async () => {
    if (!confirmedOrder) return;
    const cleanDigits = normalizeInnDigits(quickInnDigits);
    const innCheck = inspectInnDigits(cleanDigits);

    if (!innCheck.isCompleteLength || !innCheck.checksumValid) {
      setQuickInnError('Проверьте ИНН (10 или 12 цифр).');
      return;
    }

    const offlineResolved = resolveOfflineCounterpartyByInn(cleanDigits);
    const cleanName =
      quickInnName.trim() || offlineResolved?.shortName || `Организация (ИНН ${cleanDigits})`;

    const companyLine = formatStructuredCompanyLine(cleanName, cleanDigits);
    let nextDocMeta: OrderDocumentMeta | null = offlineResolved
      ? {
          ...(confirmedOrder.documentMeta ?? {}),
          ...counterpartyToDocumentMetaPatch(offlineResolved),
          customerLegalName:
            quickInnName.trim() && quickInnName.trim() !== offlineResolved.shortName
              ? quickInnName.trim()
              : offlineResolved.legalName,
        }
      : confirmedOrder.documentMeta ?? null;

    setIsSavingQuickInn(true);
    setQuickInnError(null);
    try {
      if (confirmedOrder.rescueToken) {
        const res = await fetch(
          `/api/orders/${encodeURIComponent(confirmedOrder.orderNumber)}/preferences`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rescueToken: confirmedOrder.rescueToken,
              companyName: cleanName,
              companyInn: cleanDigits,
              companyOrInn: companyLine,
            }),
          }
        );
        if (!res.ok) {
          throw new Error('Не удалось сохранить реквизиты компании');
        }
        const json = (await res.json()) as {
          ok?: boolean;
          documentMeta?: OrderDocumentMeta | null;
        };
        if (json?.documentMeta) {
          nextDocMeta = json.documentMeta;
        }
      }

      const updated: ConfirmedReservationSummary = {
        ...confirmedOrder,
        companyLine,
        innVerified: true,
        documentMeta: nextDocMeta,
      };
      orderDraftStore.updateDraft({
        companyName: cleanName,
        companyInn: cleanDigits,
        companyLine,
        resolvedCounterpartyMeta: nextDocMeta,
      });
      orderDraftStore.confirmReservationOrder(updated);
      setConfirmedOrder(updated);
      if (confirmedOrder.rescueToken) {
        upsertClientCabinetEntry({
          orderNumber: confirmedOrder.orderNumber,
          rescueToken: confirmedOrder.rescueToken,
          contactLine: confirmedOrder.contactLine,
          companyLine,
        });
      }
      setQuickInnSaved(true);
    } catch (err) {
      setQuickInnError(
        err instanceof Error ? err.message : 'Ошибка сохранения реквизитов'
      );
    } finally {
      setIsSavingQuickInn(false);
    }
  };

  const handleBindEmailForConfirmed = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirmedOrder?.rescueToken || isBindingEmail) return;
    const normalized = normalizeClientEmail(bindEmailDraft);
    if (!normalized) {
      setBindEmailError('Укажите корректную почту (например, name@company.ru)');
      return;
    }

    setIsBindingEmail(true);
    setBindEmailError(null);
    try {
      const res = await fetch('/api/client-auth/bind-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalized,
          orderNumber: confirmedOrder.orderNumber,
          rescueToken: confirmedOrder.rescueToken,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        authenticated?: boolean;
        account?: { email: string };
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Не удалось привязать почту к заказу');
      }
      const boundEmail = json.account?.email ?? normalized;
      const updated: ConfirmedReservationSummary = {
        ...confirmedOrder,
        clientEmail: boundEmail,
        autoSignedIn: true,
      };
      setActiveSessionEmail(boundEmail);
      orderDraftStore.confirmReservationOrder(updated);
      setConfirmedOrder(updated);
      setBindEmailDraft('');
    } catch (err) {
      setBindEmailError(
        err instanceof Error ? err.message : 'Ошибка привязки почты'
      );
    } finally {
      setIsBindingEmail(false);
    }
  };

  const startNewCleanStudioOrder = () => {
    setIsConfirmedModalOpen(false);
    setIsDocModalOpen(false);
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
                Открыть заказ #{confirmedOrder.orderNumber} и счёт →
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
        <div className="max-w-3xl space-y-2.5">
          <p className="text-sm font-medium text-[#FF4820]">
            {showConfirmedView && confirmedOrder
              ? `Заявка #${confirmedOrder.orderNumber} принята · ${
                  confirmedOrder.promisedWindowLabel ?? 'Продюсер свяжется в рабочее время'
                }`
              : isMediaBookingMode
                ? `Выбрано радиостанций: ${mediaReservation?.stations.length ?? 0} · Оставьте контакт, чтобы закрепить слоты`
                : 'Оформление заказа · 100% предоплата по договору или банковской картой'}
          </p>
          <h1
            id="order-page-heading"
            className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
          >
            {showConfirmedView && confirmedOrder
              ? AIRTIME_SALES_ENABLED && confirmedOrder.lockedMediaReservation
                ? 'Ваша приоритетная бронь принята в работу'
                : 'Заявка принята в работу'
              : isMediaBookingMode
                ? 'Завершение бронирования эфира за 15 секунд'
                : draft.selectedFormat === 'custom_consult'
                  ? 'Обсудить задачу с продюсером'
                  : 'Заказать аудиоролик'}
          </h1>
          <p className="text-base sm:text-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 editorial-pretty">
            {showConfirmedView && confirmedOrder
              ? 'Отслеживайте статус заказа, скачайте счёт на оплату или перейдите в Личный кабинет.'
              : isMediaBookingMode
                ? 'Укажите имя, телефон или @Telegram и реквизиты компании для выставления счёта. Задачу на ролик можно добавить ниже.'
                : 'Выберите формат и оставьте контакт — продюсер уточнит детали и запустит проект.'}
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
                      : `Заказ #${confirmedOrder.orderNumber} принят`}
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">
                    {AIRTIME_SALES_ENABLED && confirmedOrder.lockedMediaReservation
                      ? 'Эфирные квоты поставлены на 4-часовой холд'
                      : confirmedOrder.promisedWindowLabel ??
                        (confirmedOrder.selectedFormatId === 'custom_consult' ||
                        confirmedOrder.selectedBudgetRub === 0
                          ? 'Оценим задачу и свяжемся с вами'
                          : 'Продюсер свяжется и поможет со стартом')}
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
                <div>
                  Выдача материалов:{' '}
                  <strong className="text-[#111111] dark:text-[#F4F3EF]">
                    {resolveDeliveryChannelLabel(
                      confirmedOrder.preferredDeliveryChannel,
                      confirmedOrder.preferredDeliveryDetail
                    )}
                  </strong>
                </div>
                {confirmedOrder.conversionAllowed && (
                  <div
                    data-testid="verified-human-lead-status"
                    className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold"
                  >
                    Заявка подтверждена
                    {confirmedOrder.innVerified ? ' · ИНН проверен' : ''}
                  </div>
                )}
                {confirmedOrder.clientEmail && (
                  <div
                    data-testid="confirmed-auto-login-status"
                    className="text-xs text-[#111111]/78 dark:text-[#F4F3EF]/78"
                  >
                    Личный кабинет:{' '}
                    <strong className="text-[#111111] dark:text-[#F4F3EF]">
                      {confirmedOrder.clientEmail}
                    </strong>{' '}
                    (авто-вход выполнен)
                  </div>
                )}
              </div>
            </div>

            {/* Главные быстрые действия: Счёт A4 и Личный кабинет */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
              <button
                type="button"
                data-testid="confirmed-open-invoice-btn"
                onClick={() => setIsDocModalOpen(true)}
                className="min-h-[46px] px-5 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Открыть / скачать счёт (A4 / PDF)</span>
              </button>

              <button
                type="button"
                data-testid="confirmed-go-cabinet-btn"
                onClick={() => onNavigate({ kind: 'cabinet' })}
                className="min-h-[46px] px-5 py-2.5 rounded-full bg-[#111111] hover:bg-[#27272A] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <FolderOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {confirmedOrder.clientEmail
                    ? 'Перейти в Личный кабинет (вы вошли) →'
                    : 'Перейти в Личный кабинет →'}
                </span>
              </button>
            </div>

            {/* Опциональная 1-клик привязка почты для входа с других устройств (если заказ оформлен только по телефону) */}
            {!confirmedOrder.clientEmail && confirmedOrder.rescueToken && (
              <form
                onSubmit={handleBindEmailForConfirmed}
                data-testid="confirmed-bind-email-bar"
                className="rounded-2xl p-4 bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5 min-w-0">
                  <label
                    htmlFor="confirmed-bind-email-input"
                    className="block text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]"
                  >
                    Открывать заказ с любого устройства без пароля (по желанию)
                  </label>
                  <p className="text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
                    Укажите почту — кабинет привяжется автоматически, а вход с телефона или другого ПК будет по magic-ссылке.
                  </p>
                  {bindEmailError && (
                    <p role="alert" className="text-xs font-semibold text-[#FF4820] pt-0.5">
                      {bindEmailError}
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                  <input
                    id="confirmed-bind-email-input"
                    data-testid="confirmed-bind-email-input"
                    type="email"
                    value={bindEmailDraft}
                    onChange={(e) => {
                      setBindEmailDraft(e.target.value);
                      if (bindEmailError) setBindEmailError(null);
                    }}
                    placeholder="name@company.ru"
                    className="min-h-[40px] sm:w-56 px-3.5 rounded-xl bg-white dark:bg-[#141418] border border-[#111111]/16 dark:border-white/16 text-xs sm:text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                  />
                  <button
                    type="submit"
                    disabled={isBindingEmail}
                    data-testid="confirmed-bind-email-submit-btn"
                    className="min-h-[40px] px-4 rounded-xl bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {isBindingEmail ? 'Сохраняем…' : 'Привязать почту'}
                  </button>
                </div>
              </form>
            )}

            {/* Если быстрый лид был без реквизитов — даём возможность мгновенно дописать ИНН под счёт */}
            {!confirmedOrder.companyLine ? (
              <div
                data-testid="confirmed-quick-inn-card"
                className="rounded-2xl p-4 sm:p-5 bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 space-y-3"
              >
                <div className="space-y-0.5">
                  <p className="text-xs sm:text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                    Нужен счёт с вашими реквизитами прямо сейчас?
                  </p>
                  <p className="text-xs text-[#111111]/64 dark:text-[#F4F3EF]/64">
                    Укажите ИНН — название, КПП, ОГРН и юр. адрес подтянутся в счёт A4 автоматически.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={12}
                    value={quickInnDigits}
                    onChange={(e) => handleQuickInnDigitsChange(e.target.value)}
                    placeholder="ИНН (10 или 12 цифр)"
                    aria-label="ИНН компании для счёта"
                    data-testid="confirmed-quick-inn-digits"
                    className="sm:col-span-4 min-h-[44px] px-3.5 rounded-xl bg-transparent border border-[#111111]/16 dark:border-white/16 text-xs sm:text-sm tabular-nums focus:outline-none focus:border-[#FF4820]"
                  />
                  <input
                    type="text"
                    value={quickInnName}
                    onChange={(e) => {
                      setQuickInnName(e.target.value);
                      if (quickInnError) setQuickInnError(null);
                    }}
                    placeholder="Название компании (авто по ИНН)"
                    aria-label="Название компании для счёта"
                    data-testid="confirmed-quick-inn-name"
                    className="sm:col-span-5 min-h-[44px] px-3.5 rounded-xl bg-transparent border border-[#111111]/16 dark:border-white/16 text-xs sm:text-sm focus:outline-none focus:border-[#FF4820]"
                  />
                  <button
                    type="button"
                    disabled={isSavingQuickInn}
                    data-testid="confirmed-quick-inn-save-btn"
                    onClick={() => void handleSaveQuickInnForConfirmed()}
                    className="sm:col-span-3 min-h-[44px] px-4 rounded-xl bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    {isSavingQuickInn ? 'Сохраняем…' : 'Сформировать счёт'}
                  </button>
                </div>

                {quickInnError && (
                  <p role="alert" className="text-xs font-semibold text-[#FF4820]">
                    {quickInnError}
                  </p>
                )}
              </div>
            ) : (
              quickInnSaved && (
                <div className="rounded-xl px-4 py-2.5 bg-emerald-600/10 border border-emerald-600/25 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    Реквизиты сохранены: <strong>{confirmedOrder.companyLine}</strong>. Счёт A4 обновлён!
                  </span>
                </div>
              )
            )}

            {/* Живой пульт SLA и самообслуживания клиента */}
            <ClientSlaAndRescuePanel
              confirmed={confirmedOrder}
              workSchedule={workSchedule}
              legalProfiles={legalProfiles}
              hideDocumentButtons
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
          /* ДВУХКОЛОНОЧНАЯ ФОРМА ЗАКАЗА (Вариант 2: Быстрый лид + счёт по желанию) */
          <form
            onSubmit={handleSubmit}
            onPointerMove={registerPointerActivity}
            onKeyDown={registerKeyActivity}
            onFocusCapture={registerFocusActivity}
            noValidate
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start"
          >
            {/* Невидимая антибот-ловушка (Honeypot) без класса relative, чтобы не сдвигать CSS Grid */}
            <div aria-hidden="true" className="sr-only">
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
            <div className="lg:col-span-7 space-y-6">
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
                          wantsDiadocDuplicate={draft.wantsDiadocDuplicate}
                          onChangeWantsDiadocDuplicate={(checked) =>
                            orderDraftStore.updateDraft({ wantsDiadocDuplicate: checked })
                          }
                          onResolvedCounterparty={(metaPatch) =>
                            orderDraftStore.updateDraft({
                              resolvedCounterpartyMeta: {
                                ...(draft.resolvedCounterpartyMeta ?? {}),
                                ...metaPatch,
                              },
                            })
                          }
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

                    <div className="pt-1 space-y-3">
                      {!isReturningFastTrack && (
                        <PersonalDataConsentField
                          id="media-order-pdn-consent"
                          inputRef={consentInputRef}
                          checked={pdnConsentAccepted}
                          onChange={(checked) => {
                            setPdnConsentAccepted(checked);
                            if (checked && consentError) setConsentError(undefined);
                          }}
                          error={consentError}
                          compact
                          testIdPrefix="order-pdn-consent"
                        />
                      )}

                      <button
                        type="submit"
                        disabled={isSubmittingLead}
                        data-testid="drawer-submit-btn"
                        className="w-full sm:w-auto min-w-0 min-h-[52px] py-3.5 px-4 sm:px-7 rounded-2xl sm:rounded-full bg-[#FF4820] hover:bg-[#E63C17] disabled:opacity-65 active:scale-[0.99] text-white text-sm sm:text-base font-semibold transition-all cursor-pointer disabled:cursor-default text-center leading-snug whitespace-normal sm:whitespace-nowrap"
                      >
                        {isSubmittingLead
                          ? 'Проверка и фиксация квот…'
                          : rateLimitCountdownSec > 0
                            ? `Повторная отправка через ${rateLimitCountdownSec} сек`
                            : 'Поставить эфирную сетку на 4-часовой холд'}
                      </button>

                      <p
                        data-testid="order-antispam-caption"
                        className="text-xs leading-relaxed text-[#111111]/56 dark:text-[#F4F3EF]/56 flex items-start gap-2 tabular-nums"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 mt-0.5 text-[#FF4820] shrink-0" aria-hidden="true" />
                        <span>
                          Проверка ИНН по алгоритму ФНС · Быстрое оформление счёта без капчи
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
                    /* Компактная плашка предвыбранного тарифа */
                    <div
                      data-testid="preselected-format-summary"
                      className="rounded-2xl p-4 sm:p-5 bg-[#EFECE5]/80 dark:bg-[#15151A] border border-[#111111]/12 dark:border-white/12 flex flex-col sm:flex-row sm:items-center justify-between gap-4 tabular-nums"
                    >
                      <div className="space-y-1 min-w-0">
                        <p className="text-xs font-semibold text-[#111111]/58 dark:text-[#F4F3EF]/58">
                          01. Формат
                        </p>
                        <p className="text-base sm:text-lg font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                          {selectedFormatMeta.title} · {selectedFormatMeta.priceFormatted}
                        </p>
                        <p className="text-xs text-[#111111]/68 dark:text-[#F4F3EF]/68">
                          Срок: {selectedFormatMeta.turnaround} · {draft.spotDurationSec} сек
                          {activeIndustrySpec ? ` · ${activeIndustrySpec.shortTitle}` : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        data-testid="expand-format-picker-btn"
                        onClick={() => setIsFormatPickerExpanded(true)}
                        className="min-h-[40px] px-4 py-2 rounded-full border border-[#111111]/18 dark:border-white/18 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
                      >
                        Изменить формат
                      </button>
                    </div>
                  ) : (
                    /* Шаг 01: Выбор формата ролика */
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#111111]/60 dark:text-[#F4F3EF]/60">
                          01. Выберите формат
                        </p>
                        {draft.isFormatPreselected && (
                          <button
                            type="button"
                            data-testid="collapse-format-picker-btn"
                            onClick={() => setIsFormatPickerExpanded(false)}
                            className="text-xs font-semibold text-[#FF4820] hover:underline cursor-pointer whitespace-nowrap"
                          >
                            Свернуть ↑
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
                              className={`min-h-[52px] px-4 py-2.5 rounded-2xl text-left transition-colors border cursor-pointer flex flex-col justify-center ${spanClass} ${
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
                  )}

                  {/* Опциональная сворачиваемая настройка хронометража и отрасли */}
                  <div className="space-y-3">
                    <button
                      type="button"
                      data-testid="toggle-duration-industry-btn"
                      aria-expanded={isDurationIndustryExpanded}
                      onClick={() =>
                        setIsDurationIndustryExpanded((prev) => !prev)
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#111111]/64 dark:text-[#F4F3EF]/64 hover:text-[#FF4820] transition-colors cursor-pointer"
                    >
                      {isDurationIndustryExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>
                        Уточнить хронометраж ({draft.spotDurationSec} сек) или отрасль
                        {activeIndustrySpec ? ` · ${activeIndustrySpec.shortTitle}` : ''}
                      </span>
                    </button>

                    {isDurationIndustryExpanded && (
                      <div className="rounded-2xl p-4 bg-[#EFECE5]/55 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label
                            htmlFor="order-spot-seconds-input"
                            className="block text-xs font-semibold text-[#111111]/64 dark:text-[#F4F3EF]/64"
                          >
                            Хронометраж ролика (сек)
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
                                  className={`min-h-[36px] px-2.5 rounded-xl text-xs font-semibold tabular-nums border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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
                              className="w-16 min-h-[36px] px-2 rounded-xl bg-transparent border border-[#111111]/16 dark:border-white/16 text-xs font-semibold tabular-nums text-center focus:outline-none focus:border-[#FF4820]"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor="order-industry-select"
                            className="block text-xs font-semibold text-[#111111]/64 dark:text-[#F4F3EF]/64"
                          >
                            Отрасль (для нюансов ФЗ-38)
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
                            className="w-full min-h-[40px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#FF4820]"
                          >
                            <option value="">Без привязки к отрасли</option>
                            {VALID_INDUSTRY_SLUGS.map((slug) => (
                              <option key={slug} value={slug}>
                                {INDUSTRY_SOLUTIONS[slug].shortTitle}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Шаг 02: Короткий бриф + компактный голос/файл в одну строку */}
                  <div className="space-y-3 pt-4 border-t border-[#111111]/10 dark:border-white/10">
                    <label
                      htmlFor="production-order-brief-input"
                      className="block text-xs font-semibold text-[#111111]/60 dark:text-[#F4F3EF]/60"
                    >
                      {draft.selectedFormat === 'custom_consult'
                        ? '02. Опишите задачу или вопросы продюсеру'
                        : '02. О чём ролик? (текст, голос или файл)'}
                    </label>

                    <textarea
                      ref={briefTextareaRef}
                      id="production-order-brief-input"
                      rows={2}
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
                          ? 'Кратко: серия роликов, сценарий для записи на месте или вопросы по задаче…'
                          : 'Продукт или акция, главное преимущество и контакт в конце'
                      }
                      className={`scroll-mt-24 w-full px-4 py-3 rounded-2xl border text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none transition-all ${
                        taskError
                          ? 'border-[#FF4820] ring-2 ring-[#FF4820]/20 bg-[#FF4820]/[0.03]'
                          : 'bg-transparent border-[#111111]/16 dark:border-[#F4F3EF]/16 focus:border-[#FF4820]'
                      }`}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <VoiceBriefRecorder
                        variant="compact"
                        idleLabel="Надиктовать голосом"
                        resetSignal={voiceResetSignal}
                        onStateChange={handleVoiceChange}
                        onClearError={handleClearTaskError}
                      />

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".doc,.docx,.pdf,.txt,.rtf,.xls,.xlsx,.jpg,.png,.mp3,.wav"
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
                          {attachedFileName ? attachedFileName : 'Прикрепить файл'}
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

                  {/* Шаг 03: Контакт, где удобно забрать готовый ролик, и опциональный счёт */}
                  <div className="space-y-4 pt-4 border-t border-[#111111]/10 dark:border-white/10">
                    <p className="text-xs font-semibold text-[#111111]/60 dark:text-[#F4F3EF]/60">
                      03. Куда ответить и где удобно получить готовый ролик
                    </p>

                    {isReturningFastTrack ? (
                      <div className="rounded-2xl p-4 bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/10 dark:border-white/10 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs text-[#FF4820] font-semibold">
                            Сохранённый профиль клиента
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
                      <div className="space-y-1.5">
                        <label
                          htmlFor="production-order-contact-input"
                          className="block text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                        >
                          Имя и телефон или @Telegram *
                        </label>
                        <input
                          ref={contactInputRef}
                          id="production-order-contact-input"
                          type="text"
                          data-testid="drawer-contact-input"
                          aria-label="Имя и телефон или @Telegram"
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
                    )}

                    {/* Предпочтительный канал выдачи готовых файлов */}
                    <div ref={deliverySectionRef} className="scroll-mt-24 space-y-2.5">
                      <p className="text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72">
                        Где удобно получить готовый ролик и материалы?
                      </p>
                      <div
                        role="group"
                        aria-label="Предпочтительный канал получения файлов"
                        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                      >
                        {CLIENT_DELIVERY_CHANNEL_OPTIONS.map((opt) => {
                          const isSelected = draft.preferredDeliveryChannel === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              data-testid={`delivery-channel-${opt.id}`}
                              aria-pressed={isSelected}
                              onClick={() => {
                                const extractedContactEmail =
                                  extractEmailFromContactText(draft.contactLine) ?? '';
                                const emailFromContact =
                                  opt.id === 'email' && !draft.deliveryEmail
                                    ? extractedContactEmail
                                    : draft.deliveryEmail;
                                const cabinetEmailPrefill =
                                  opt.id === 'cabinet' && !draft.cabinetEmail
                                    ? extractedContactEmail ||
                                      draft.deliveryEmail ||
                                      activeSessionEmail ||
                                      ''
                                    : draft.cabinetEmail;
                                orderDraftStore.updateDraft({
                                  preferredDeliveryChannel: opt.id,
                                  ...(opt.id === 'email' && emailFromContact
                                    ? { deliveryEmail: emailFromContact }
                                    : {}),
                                  ...(opt.id === 'cabinet' && cabinetEmailPrefill
                                    ? { cabinetEmail: cabinetEmailPrefill }
                                    : {}),
                                });
                                if (deliveryError) setDeliveryError(undefined);
                              }}
                              className={`min-h-[42px] px-2.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer text-center leading-tight ${
                                isSelected
                                  ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                                  : 'bg-[#EFECE5]/65 dark:bg-[#15151A] text-[#111111]/82 dark:text-[#F4F3EF]/82 border-[#111111]/12 dark:border-white/10 hover:border-[#FF4820]'
                              }`}
                            >
                              {opt.shortLabel}
                            </button>
                          );
                        })}
                      </div>

                      {/* Компактное уточнение под выбранный канал (не перегружает форму) */}
                      <div
                        data-testid={`delivery-subpanel-${draft.preferredDeliveryChannel}`}
                        className="rounded-xl p-3 bg-[#EFECE5]/45 dark:bg-[#15151A]/80 border border-[#111111]/8 dark:border-white/8 space-y-2.5"
                      >
                        {draft.preferredDeliveryChannel === 'messenger' && (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-[#111111]/66 dark:text-[#F4F3EF]/66">
                                Какой мессенджер удобнее?
                              </span>
                              <div
                                role="group"
                                aria-label="Выбор мессенджера"
                                className="flex flex-wrap items-center gap-1.5"
                              >
                                {DELIVERY_MESSENGER_OPTIONS.map((m) => {
                                  const active = draft.deliveryMessenger === m.id;
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      data-testid={`delivery-messenger-${m.id}`}
                                      aria-pressed={active}
                                      onClick={() => {
                                        orderDraftStore.updateDraft({
                                          deliveryMessenger: m.id,
                                        });
                                        if (deliveryError) setDeliveryError(undefined);
                                      }}
                                      className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                                        active
                                          ? 'bg-[#FF4820] text-white border-[#FF4820]'
                                          : 'bg-white/80 dark:bg-[#0D0D0F] text-[#111111]/80 dark:text-[#F4F3EF]/80 border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                                      }`}
                                    >
                                      {m.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {draft.deliveryMessenger === 'other' && (
                              <input
                                ref={deliveryDetailInputRef}
                                type="text"
                                data-testid="delivery-messenger-other-input"
                                aria-label="Название вашего мессенджера"
                                aria-invalid={Boolean(deliveryError)}
                                value={draft.deliveryMessengerOther}
                                onChange={(e) => {
                                  orderDraftStore.updateDraft({
                                    deliveryMessengerOther: e.target.value,
                                  });
                                  if (deliveryError) setDeliveryError(undefined);
                                }}
                                placeholder="Например: VK Мессенджер или Viber"
                                className={`w-full min-h-[40px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm bg-white/90 dark:bg-[#0D0D0F] text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none ${
                                  deliveryError
                                    ? 'border-[#FF4820] ring-2 ring-[#FF4820]/20'
                                    : 'border-[#111111]/14 dark:border-white/14 focus:border-[#FF4820]'
                                }`}
                              />
                            )}
                          </>
                        )}

                        {draft.preferredDeliveryChannel === 'cloud' && (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-[#111111]/66 dark:text-[#F4F3EF]/66">
                                Какой сервис удобнее?
                              </span>
                              <div
                                role="group"
                                aria-label="Выбор облачного хранилища"
                                className="flex flex-wrap items-center gap-1.5"
                              >
                                {DELIVERY_CLOUD_OPTIONS.map((c) => {
                                  const active = draft.deliveryCloud === c.id;
                                  return (
                                    <button
                                      key={c.id}
                                      type="button"
                                      data-testid={`delivery-cloud-${c.id}`}
                                      aria-pressed={active}
                                      onClick={() => {
                                        orderDraftStore.updateDraft({
                                          deliveryCloud: c.id,
                                        });
                                        if (deliveryError) setDeliveryError(undefined);
                                      }}
                                      className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                                        active
                                          ? 'bg-[#FF4820] text-white border-[#FF4820]'
                                          : 'bg-white/80 dark:bg-[#0D0D0F] text-[#111111]/80 dark:text-[#F4F3EF]/80 border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                                      }`}
                                    >
                                      {c.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {draft.deliveryCloud === 'other' && (
                              <input
                                ref={deliveryDetailInputRef}
                                type="text"
                                data-testid="delivery-cloud-other-input"
                                aria-label="Укажите облачное хранилище"
                                aria-invalid={Boolean(deliveryError)}
                                value={draft.deliveryCloudOther}
                                onChange={(e) => {
                                  orderDraftStore.updateDraft({
                                    deliveryCloudOther: e.target.value,
                                  });
                                  if (deliveryError) setDeliveryError(undefined);
                                }}
                                placeholder="Например: Облако Mail, Nextcloud или ваша папка"
                                className={`w-full min-h-[40px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm bg-white/90 dark:bg-[#0D0D0F] text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none ${
                                  deliveryError
                                    ? 'border-[#FF4820] ring-2 ring-[#FF4820]/20'
                                    : 'border-[#111111]/14 dark:border-white/14 focus:border-[#FF4820]'
                                }`}
                              />
                            )}
                          </>
                        )}

                        {draft.preferredDeliveryChannel === 'email' && (
                          <div className="space-y-1.5">
                            <label
                              htmlFor="production-order-delivery-email"
                              className="block text-[11px] font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                            >
                              Почта для отправки готового ролика *
                            </label>
                            <input
                              ref={deliveryDetailInputRef}
                              id="production-order-delivery-email"
                              type="email"
                              data-testid="delivery-email-input"
                              aria-invalid={Boolean(deliveryError)}
                              aria-describedby={
                                deliveryError ? 'production-order-delivery-error' : undefined
                              }
                              value={draft.deliveryEmail}
                              onChange={(e) => {
                                orderDraftStore.updateDraft({
                                  deliveryEmail: e.target.value,
                                });
                                if (deliveryError) setDeliveryError(undefined);
                              }}
                              placeholder="name@company.ru"
                              className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm bg-white/90 dark:bg-[#0D0D0F] text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none ${
                                deliveryError
                                  ? 'border-[#FF4820] ring-2 ring-[#FF4820]/20'
                                  : 'border-[#111111]/14 dark:border-white/14 focus:border-[#FF4820]'
                              }`}
                            />
                            <p className="text-[11px] text-[#111111]/58 dark:text-[#F4F3EF]/58">
                              Отправим ролик и материалы прямо на e-mail — без входа в личный кабинет.
                            </p>
                          </div>
                        )}

                        {draft.preferredDeliveryChannel === 'cabinet' && (
                          <div className="space-y-1.5">
                            <label
                              htmlFor="production-order-cabinet-email"
                              className="block text-[11px] font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                            >
                              Почта для авто-входа в Личный кабинет (необязательно)
                            </label>
                            <input
                              ref={deliveryDetailInputRef}
                              id="production-order-cabinet-email"
                              type="email"
                              data-testid="delivery-cabinet-email-input"
                              aria-invalid={Boolean(deliveryError)}
                              aria-describedby={
                                deliveryError ? 'production-order-delivery-error' : undefined
                              }
                              value={draft.cabinetEmail}
                              onChange={(e) => {
                                orderDraftStore.updateDraft({
                                  cabinetEmail: e.target.value,
                                });
                                if (deliveryError) setDeliveryError(undefined);
                              }}
                              placeholder={
                                activeSessionEmail
                                  ? `${activeSessionEmail} (уже выполнен вход)`
                                  : 'name@company.ru — для авто-регистрации без пароля'
                              }
                              className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm bg-white/90 dark:bg-[#0D0D0F] text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none ${
                                deliveryError
                                  ? 'border-[#FF4820] ring-2 ring-[#FF4820]/20'
                                  : 'border-[#111111]/14 dark:border-white/14 focus:border-[#FF4820]'
                              }`}
                            />
                            <p className="text-[11px] text-[#111111]/60 dark:text-[#F4F3EF]/60 leading-snug">
                              При указании почты регистрация и вход выполняются автоматически без пароля (с других устройств — по magic-ссылке). Можно оставить пустым.
                            </p>
                          </div>
                        )}
                      </div>

                      {deliveryError && (
                        <p
                          id="production-order-delivery-error"
                          role="alert"
                          data-testid="drawer-delivery-error"
                          className="text-xs font-semibold text-[#FF4820] flex items-center gap-1.5"
                        >
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{deliveryError}</span>
                        </p>
                      )}
                    </div>

                    {/* Сворачиваемый блок «Счёт на компанию сразу (по желанию)» */}
                    {!isReturningFastTrack && (
                      <div className="space-y-3">
                        <button
                          type="button"
                          data-testid="toggle-invoice-section-btn"
                          aria-expanded={draft.wantsInvoiceNow}
                          onClick={() => {
                            const nextWants = !draft.wantsInvoiceNow;
                            orderDraftStore.updateDraft({
                              wantsInvoiceNow: nextWants,
                              paymentChannel: 'edo_invoice',
                            });
                            if (!nextWants) {
                              setCompanyNameError(undefined);
                              setCompanyInnError(undefined);
                              setCompanyError(undefined);
                            }
                          }}
                          className="w-full rounded-2xl px-4 py-3 bg-[#EFECE5]/60 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 hover:border-[#FF4820]/60 transition-colors flex items-center justify-between gap-3 text-left cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
                              Нужен счёт на компанию сразу? (по желанию)
                            </p>
                            <p className="text-[11px] text-[#111111]/58 dark:text-[#F4F3EF]/58">
                              Укажите ИНН, чтобы скачать счёт сразу после отправки — без ожидания менеджера
                            </p>
                          </div>
                          {draft.wantsInvoiceNow ? (
                            <ChevronUp className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#111111]/55 dark:text-[#F4F3EF]/55 shrink-0" aria-hidden="true" />
                          )}
                        </button>

                        {draft.wantsInvoiceNow && (
                          <CompanyDetailsForm
                            idPrefix="production-order-company"
                            hideCardSwitch
                            nameInputRef={companyNameInputRef}
                            innInputRef={companyInnInputRef}
                            companyName={draft.companyName}
                            companyInn={draft.companyInn}
                            paymentChannel="edo_invoice"
                            wantsDiadocDuplicate={draft.wantsDiadocDuplicate}
                            onChangeWantsDiadocDuplicate={(checked) =>
                              orderDraftStore.updateDraft({ wantsDiadocDuplicate: checked })
                            }
                            onResolvedCounterparty={(metaPatch) =>
                              orderDraftStore.updateDraft({
                                resolvedCounterpartyMeta: {
                                  ...(draft.resolvedCounterpartyMeta ?? {}),
                                  ...metaPatch,
                                },
                              })
                            }
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
                        )}
                      </div>
                    )}

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

                  <div className="pt-2 space-y-3">
                    {!isReturningFastTrack && (
                      <PersonalDataConsentField
                        id="production-order-pdn-consent"
                        inputRef={consentInputRef}
                        checked={pdnConsentAccepted}
                        onChange={(checked) => {
                          setPdnConsentAccepted(checked);
                          if (checked && consentError) setConsentError(undefined);
                        }}
                        error={consentError}
                        testIdPrefix="order-pdn-consent"
                      />
                    )}

                    {(taskError ||
                      contactError ||
                      deliveryError ||
                      companyNameError ||
                      companyInnError ||
                      companyError ||
                      consentError) && (
                      <p
                        role="alert"
                        data-testid="order-submit-validation-hint"
                        className="text-xs font-semibold text-[#FF4820] flex items-start gap-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>
                          Проверьте:{' '}
                          {[
                            taskError ? 'описание задачи' : null,
                            contactError ? 'контакт' : null,
                            deliveryError ? 'куда отправить ролик' : null,
                            companyNameError ? 'название компании' : null,
                            companyInnError ? 'ИНН' : null,
                            companyError ? 'реквизиты' : null,
                            consentError ? 'согласие 152-ФЗ' : null,
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
                      className="w-full sm:w-auto min-w-0 min-h-[52px] py-3.5 px-6 sm:px-8 rounded-2xl sm:rounded-full bg-[#FF4820] hover:bg-[#E63C17] disabled:opacity-65 active:scale-[0.99] text-white text-sm sm:text-base font-semibold transition-all cursor-pointer disabled:cursor-default text-center leading-snug whitespace-normal sm:whitespace-nowrap"
                    >
                      {isSubmittingLead
                        ? 'Отправка заявки…'
                        : rateLimitCountdownSec > 0
                          ? `Повторная отправка через ${rateLimitCountdownSec} сек`
                          : draft.wantsInvoiceNow
                            ? 'Отправить заявку и получить счёт'
                            : 'Отправить заявку'}
                    </button>

                    <p
                      data-testid="order-antispam-caption"
                      className="text-xs leading-relaxed text-[#111111]/54 dark:text-[#F4F3EF]/54 flex items-start gap-2 tabular-nums"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 mt-0.5 text-[#FF4820] shrink-0" aria-hidden="true" />
                      <span>
                        Без спама · Продюсер уточнит детали, а статус и готовые файлы появятся в Личном кабинете
                      </span>
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* ПРАВАЯ КОЛОНКА (5 колонок, липкая при скролле): Лаконичная сводка */}
            <aside className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
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
                      <span className="font-semibold">Итого к оплате:</span>
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
                  className="rounded-3xl p-6 sm:p-7 bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/10 dark:border-white/10 space-y-4 tabular-nums"
                >
                  <div className="pb-4 border-b border-[#111111]/10 dark:border-white/10 space-y-1">
                    <p className="text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
                      Ваш заказ
                    </p>
                    <h2 className="text-xl font-bold tracking-tight">
                      {selectedFormatMeta.title}
                    </h2>
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">
                        Стоимость:
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
                        Хронометраж:
                      </span>
                      <span className="font-semibold">{draft.spotDurationSec} сек</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">
                        Выдача файлов:
                      </span>
                      <span className="font-semibold text-right">
                        {resolveDeliveryChannelLabel(
                          draft.preferredDeliveryChannel,
                          resolvedDeliveryDetail
                        )}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-3 pt-2 border-t border-[#111111]/8 dark:border-white/8">
                      <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62 shrink-0">
                        Оплата:
                      </span>
                      <span
                        data-testid="order-summary-payment-terms"
                        className="font-semibold text-right text-xs sm:text-sm leading-snug"
                      >
                        100% предоплата по договору или банковской картой
                      </span>
                    </div>
                  </div>

                  <p className="pt-3 border-t border-[#111111]/10 dark:border-white/10 text-xs text-[#111111]/68 dark:text-[#F4F3EF]/68 leading-relaxed">
                    Продюсер свяжется, уточнит детали и поможет со стартом (100% предоплата по договору или банковской картой). Статус заказа, счёт и готовые файлы всегда доступны в Личном кабинете.
                  </p>

                  {activeIndustrySpec && (
                    <div className="pt-3 border-t border-[#111111]/10 dark:border-white/10 space-y-1 text-xs">
                      <p className="font-semibold text-[#FF4820] flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{activeIndustrySpec.shortTitle}</span>
                      </p>
                      <p className="text-[#111111]/68 dark:text-[#F4F3EF]/68 leading-relaxed">
                        {activeIndustrySpec.legalComplianceRules[0]}
                      </p>
                    </div>
                  )}

                  <div className="pt-3 border-t border-[#111111]/10 dark:border-white/10">
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
                        data-testid="order-sidebar-cabinet-link"
                        onClick={() => onNavigate({ kind: 'cabinet' })}
                        className="w-full min-h-[42px] px-3.5 sm:px-4 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820] text-xs font-semibold flex flex-wrap items-center justify-between gap-x-3 gap-y-1 transition-colors cursor-pointer text-left"
                      >
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <FolderOpen className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
                          <span>Уже заказывали у нас?</span>
                        </span>
                        <span className="text-[#FF4820] whitespace-nowrap">Личный кабинет →</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </aside>
          </form>
        )}
      </div>

      {/* Диалоговое модальное окно подтверждения заявки со статусом SLA и автономным счётом */}
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

      {isDocModalOpen && confirmedOrder && (
        <Suspense fallback={null}>
          <BrandedDocumentSuiteModal
            isOpen={isDocModalOpen}
            onClose={() => setIsDocModalOpen(false)}
            mode="client"
            initialDoc="invoice"
            legalProfiles={legalProfiles}
            order={{
              orderNumber: confirmedOrder.orderNumber,
              createdAtIso: new Date(confirmedOrder.confirmedAtMs).toISOString(),
              formatLabel: confirmedOrder.formatLabel,
              baseBudgetRub:
                confirmedOrder.lockedTotals?.unifiedTotalRub ??
                (typeof confirmedOrder.selectedBudgetRub === 'number'
                  ? confirmedOrder.selectedBudgetRub
                  : 0),
              defaultDurationSec: confirmedOrder.spotDurationSec || 15,
              contact: confirmedOrder.contactLine,
              companyOrInn: confirmedOrder.companyLine,
              briefText: confirmedOrder.briefNote,
              documentMeta:
                confirmedOrder.documentMeta ?? draft.resolvedCounterpartyMeta ?? null,
            }}
          />
        </Suspense>
      )}
    </section>
  );
}
