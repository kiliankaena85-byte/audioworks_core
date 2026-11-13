import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Mic,
  Paperclip,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Square,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { casePlayerEngine } from '../../audio/casePlayerEngine';
import { contrastAudioEngine } from '../../audio/contrastAudioEngine';
import { INDUSTRY_SOLUTIONS } from '../../data/multiPageContentData';
import {
  buildMediaPlanSnapshotFromReservation,
} from '../../data/orderCrmTypes';
import {
  buildClientNextStepsTimeline,
  computeRemainingHoldSeconds,
  ConfirmedReservationSummary,
  DEFAULT_HOLD_WINDOW_SECONDS,
  OrderCheckoutMode,
  OrderDraftSnapshot,
  orderDraftStore,
} from '../../data/orderDraftStore';
import {
  IndustryVerticalSlug,
  PlatformRoute,
  VALID_INDUSTRY_SLUGS,
} from '../../data/platformRouter';
import {
  EDITORIAL_PRICING_ROWS,
  generateOrderNumber,
  QUICK_ORDER_PILLS,
  readSavedVipProfile,
  SavedVipProfile,
  validateQuickOrder,
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
import { useLayaDecision } from '../../engine/LayaContext';
import {
  resolveLeadFormRateScope,
  validateCompanyOrInnField,
  validateHumanLeadContact,
} from '../../security/leadShield';
import { useLeadShieldForm } from '../../security/useLeadShieldForm';
import { useRateLimit } from '../../security/useRateLimit';
import { ReservationConfirmedModal } from '../ReservationConfirmedModal';

interface OrderPageProps {
  draft: OrderDraftSnapshot;
  onNavigate: (route: PlatformRoute) => void;
}

type ClientMode = 'new_project' | 'returning_client';
type VoiceStatus = 'idle' | 'recording' | 'recorded';

const SPOT_DURATION_PRESETS = [10, 15, 17, 20, 22, 30] as const;

function getPulseBarHeightClass(level: number): string {
  if (level >= 0.78) return 'h-5';
  if (level >= 0.6) return 'h-4';
  if (level >= 0.44) return 'h-3';
  if (level >= 0.3) return 'h-2';
  return 'h-1.5';
}

export function OrderPage({ draft, onNavigate }: OrderPageProps) {
  const { decision } = useLayaDecision();

  const hasSavedReservation = draft.mediaReservation !== null;
  const isMediaBookingMode =
    draft.mode === 'air_plus_production' && draft.mediaReservation !== null;

  const [clientMode, setClientMode] = useState<ClientMode>(() =>
    decision.choice === 'returning_vip' ? 'returning_client' : 'new_project'
  );
  const [savedVip, setSavedVip] = useState<SavedVipProfile | null>(() =>
    readSavedVipProfile()
  );
  const [isEditingVipContact, setIsEditingVipContact] = useState(false);

  const [holdRemainingSec, setHoldRemainingSec] = useState<number>(() =>
    computeRemainingHoldSeconds(draft.holdExpiresAtMs)
  );
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [copiedSpec, setCopiedSpec] = useState(false);

  // Voice recording state (real MediaRecorder API + seamless simulation fallback)
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [isSimulatedMic, setIsSimulatedMic] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [pulseBars, setPulseBars] = useState<[number, number, number, number, number]>([
    0.3, 0.55, 0.4, 0.7, 0.35,
  ]);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const [contactError, setContactError] = useState<string | undefined>();
  const [companyError, setCompanyError] = useState<string | undefined>();
  const [taskError, setTaskError] = useState<string | undefined>();
  const [rateLimitError, setRateLimitError] = useState<string | undefined>();
  const [confirmedOrder, setConfirmedOrder] =
    useState<ConfirmedReservationSummary | null>(() => draft.confirmedReservation);
  const [isConfirmedModalOpen, setIsConfirmedModalOpen] = useState<boolean>(false);

  const activeRateScope = resolveLeadFormRateScope(
    isMediaBookingMode ? 'air_plus_production' : 'production_only'
  );

  const {
    countdownSec: rateLimitCountdownSec,
    remainingAttempts,
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const htmlPlayerRef = useRef<HTMLAudioElement | null>(null);
  const simPlaybackTimerRef = useRef<number | null>(null);

  const mediaReservation = draft.mediaReservation;

  const reservationTotals = useMemo<ComputedReservationTotals | null>(() => {
    if (!mediaReservation) return null;
    return computeReservationTotalsForSelection(
      mediaReservation,
      draft.reservationProdSelection
    );
  }, [mediaReservation, draft.reservationProdSelection]);

  // При открытии страницы оформления всегда прокручиваем экран к началу (Шаг 01 — быстрый контакт)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, []);

  // Синхронизация подтверждённой брони из хранилища (например, если была создана новая бронь в медиапланере)
  useEffect(() => {
    setConfirmedOrder(draft.confirmedReservation);
  }, [draft.confirmedReservation]);

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

  // Живой отсчёт 4-часового таймера от сохранённого дедлайна holdExpiresAtMs
  useEffect(() => {
    if (!hasSavedReservation || !draft.holdExpiresAtMs) return;
    setHoldRemainingSec(computeRemainingHoldSeconds(draft.holdExpiresAtMs));
    const timerId = window.setInterval(() => {
      setHoldRemainingSec(computeRemainingHoldSeconds(draft.holdExpiresAtMs));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [hasSavedReservation, draft.holdExpiresAtMs]);

  const cleanupRecordingTimersAndStream = () => {
    if (recordIntervalRef.current !== null) {
      window.clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupRecordingTimersAndStream();
      if (recordedBlobUrl) URL.revokeObjectURL(recordedBlobUrl);
      if (htmlPlayerRef.current) htmlPlayerRef.current.pause();
      if (simPlaybackTimerRef.current !== null) {
        window.clearTimeout(simPlaybackTimerRef.current);
      }
    };
  }, [recordedBlobUrl]);

  const handleSwitchMode = (nextMode: OrderCheckoutMode) => {
    setConfirmedOrder(null);
    setIsConfirmedModalOpen(false);
    orderDraftStore.clearConfirmedReservation();
    setContactError(undefined);
    setCompanyError(undefined);
    setTaskError(undefined);
    setRateLimitError(undefined);
    orderDraftStore.switchMode(nextMode);
  };

  const handleSwitchClientMode = (nextMode: ClientMode) => {
    setClientMode(nextMode);
    setContactError(undefined);
    setCompanyError(undefined);
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

  const startSimulatedRecording = () => {
    setIsSimulatedMic(true);
    setRecordSeconds(0);
    setVoiceStatus('recording');
    setTaskError(undefined);

    let tick = 0;
    recordIntervalRef.current = window.setInterval(() => {
      tick += 1;
      setPulseBars([
        0.28 + 0.55 * Math.abs(Math.sin(tick * 0.9)),
        0.35 + 0.6 * Math.abs(Math.cos(tick * 1.1)),
        0.3 + 0.65 * Math.abs(Math.sin(tick * 1.4 + 0.6)),
        0.25 + 0.58 * Math.abs(Math.cos(tick * 0.8 + 1.2)),
        0.32 + 0.5 * Math.abs(Math.sin(tick * 1.2 + 2.0)),
      ]);
      if (tick % 5 === 0) {
        setRecordSeconds((prev) => prev + 1);
      }
    }, 200);
  };

  const startVoiceRecording = async () => {
    contrastAudioEngine.stopAll();
    casePlayerEngine.stop();
    setTaskError(undefined);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof window.MediaRecorder === 'undefined'
    ) {
      startSimulatedRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      setIsSimulatedMic(false);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (recordedBlobUrl) URL.revokeObjectURL(recordedBlobUrl);
        setRecordedBlobUrl(URL.createObjectURL(blob));
        setVoiceStatus('recorded');
        cleanupRecordingTimersAndStream();
      };

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      let analyser: AnalyserNode | null = null;
      let freqBuf: Uint8Array<ArrayBuffer> | null = null;

      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 32;
        src.connect(analyser);
        freqBuf = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      }

      setRecordSeconds(0);
      setVoiceStatus('recording');
      recorder.start();

      let tick = 0;
      recordIntervalRef.current = window.setInterval(() => {
        tick += 1;
        if (analyser && freqBuf) {
          analyser.getByteFrequencyData(freqBuf);
          setPulseBars([
            Math.max(0.22, Math.min(1, (freqBuf[1] ?? 0) / 210)),
            Math.max(0.25, Math.min(1, (freqBuf[3] ?? 0) / 200)),
            Math.max(0.28, Math.min(1, (freqBuf[5] ?? 0) / 190)),
            Math.max(0.24, Math.min(1, (freqBuf[7] ?? 0) / 200)),
            Math.max(0.22, Math.min(1, (freqBuf[9] ?? 0) / 210)),
          ]);
        }
        if (tick % 5 === 0) {
          setRecordSeconds((prev) => {
            if (prev >= 89) {
              stopVoiceRecording();
              return 90;
            }
            return prev + 1;
          });
        }
      }, 200);
    } catch {
      cleanupRecordingTimersAndStream();
      startSimulatedRecording();
    }
  };

  const stopVoiceRecording = () => {
    if (isSimulatedMic) {
      cleanupRecordingTimersAndStream();
      setRecordSeconds((prev) => Math.max(4, prev));
      setVoiceStatus('recorded');
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupRecordingTimersAndStream();
      setVoiceStatus('recorded');
    }
  };

  const togglePlaybackRecordedVoice = () => {
    if (isPlayingVoice) {
      if (htmlPlayerRef.current) htmlPlayerRef.current.pause();
      if (simPlaybackTimerRef.current !== null) {
        window.clearTimeout(simPlaybackTimerRef.current);
        simPlaybackTimerRef.current = null;
      }
      setIsPlayingVoice(false);
      return;
    }

    contrastAudioEngine.stopAll();
    casePlayerEngine.stop();

    if (!isSimulatedMic && recordedBlobUrl) {
      const audio = new Audio(recordedBlobUrl);
      htmlPlayerRef.current = audio;
      audio.onended = () => setIsPlayingVoice(false);
      setIsPlayingVoice(true);
      audio.play().catch(() => setIsPlayingVoice(false));
      return;
    }

    setIsPlayingVoice(true);
    const durSec = Math.min(6, Math.max(3, recordSeconds));
    simPlaybackTimerRef.current = window.setTimeout(() => {
      setIsPlayingVoice(false);
      simPlaybackTimerRef.current = null;
    }, durSec * 1000);
  };

  const deleteRecordedVoice = () => {
    if (htmlPlayerRef.current) htmlPlayerRef.current.pause();
    if (simPlaybackTimerRef.current !== null) {
      window.clearTimeout(simPlaybackTimerRef.current);
      simPlaybackTimerRef.current = null;
    }
    if (recordedBlobUrl) {
      URL.revokeObjectURL(recordedBlobUrl);
      setRecordedBlobUrl(null);
    }
    setIsPlayingVoice(false);
    setRecordSeconds(0);
    setVoiceStatus('idle');
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

  const selectedStudioPricingRow = useMemo(
    () => EDITORIAL_PRICING_ROWS.find((r) => r.id === draft.selectedFormat) ?? null,
    [draft.selectedFormat]
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmittingLead) return;
    if (voiceStatus === 'recording') {
      stopVoiceRecording();
    }

    setContactError(undefined);
    setCompanyError(undefined);
    setTaskError(undefined);
    setRateLimitError(undefined);

    // 1. Проверяем интервал между сабмитами и лимит попыток в localStorage через useRateLimit
    const preLimitCheck = checkRateLimit(activeRateScope);
    if (!preLimitCheck.allowed) {
      setRateLimitError(
        preLimitCheck.message ??
          `Слишком частая отправка. Повторите через ${preLimitCheck.retryAfterSec} сек.`
      );
      return;
    }

    const effectiveContact = isReturningFastTrack
      ? savedVip.contactLine
      : draft.contactLine.trim();
    const effectiveCompany = draft.companyLine.trim() || savedVip?.company || '';
    const hasVoice = voiceStatus === 'recorded' || voiceStatus === 'recording';

    if (isMediaBookingMode && mediaReservation && reservationTotals) {
      if (!isReturningFastTrack && effectiveContact.length < 4) {
        setContactError('Укажите имя и телефон или @Telegram для подтверждения холда');
        return;
      }

      if (!websiteTrap.trim()) {
        const contactValidation = validateHumanLeadContact(effectiveContact, {
          isReturningFastTrack,
        });
        if (!contactValidation.valid && !contactValidation.isLikelyBotGarbage) {
          setContactError(contactValidation.error);
          return;
        }
        const companyValidation = validateCompanyOrInnField(effectiveCompany);
        if (!companyValidation.valid) {
          setCompanyError(companyValidation.error);
          return;
        }
      }

      const recordedRate = recordAttempt(activeRateScope);
      if (!recordedRate.allowed) {
        setRateLimitError(
          recordedRate.message ??
            `Слишком частая отправка. Повторите через ${recordedRate.retryAfterSec} сек.`
        );
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
        briefText: draft.briefText.trim(),
        hasVoiceRecording: hasVoice,
        voiceDurationSec: hasVoice ? Math.max(4, recordSeconds) : 0,
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
      const summary: ConfirmedReservationSummary = {
        orderNumber: shieldResult.orderNumber,
        confirmedAtMs: nowMs,
        holdExpiresAtMs:
          draft.holdExpiresAtMs ?? nowMs + DEFAULT_HOLD_WINDOW_SECONDS * 1000,
        checkoutMode: 'air_plus_production',
        formatLabel: reservationTotals.spotStatusLabel,
        spotDurationSec: mediaReservation.spotDurationSec ?? draft.spotDurationSec,
        industryLabel: mediaReservation.nicheLabel,
        contactLine: effectiveContact,
        companyLine: nextVip.company,
        briefNote: draft.briefText.trim(),
        hasVoice,
        voiceSec: Math.max(4, recordSeconds),
        fileName: attachedFileName,
        lockedMediaReservation: mediaReservation,
        lockedTotals: reservationTotals,
        conversionAllowed: shieldResult.conversionAllowed,
        innVerified: shieldResult.innVerified,
      };

      orderDraftStore.confirmReservationOrder(summary);
      setConfirmedOrder(summary);
      setIsConfirmedModalOpen(true);
      return;
    }

    const check = validateQuickOrder({
      contactLine: effectiveContact,
      briefText: draft.briefText,
      hasVoiceRecording: hasVoice,
      hasAttachedFile: Boolean(attachedFileName),
      isReturningClientWithSavedProfile: isReturningFastTrack,
    });

    if (!check.valid) {
      setContactError(check.contactError);
      setTaskError(check.taskError);
      return;
    }

    if (!websiteTrap.trim()) {
      const contactValidation = validateHumanLeadContact(effectiveContact, {
        isReturningFastTrack,
      });
      if (!contactValidation.valid && !contactValidation.isLikelyBotGarbage) {
        setContactError(contactValidation.error);
        return;
      }
      const companyValidation = validateCompanyOrInnField(effectiveCompany);
      if (!companyValidation.valid) {
        setCompanyError(companyValidation.error);
        return;
      }
    }

    const recordedRate = recordAttempt(activeRateScope);
    if (!recordedRate.allowed) {
      setRateLimitError(
        recordedRate.message ??
          `Слишком частая отправка. Повторите через ${recordedRate.retryAfterSec} сек.`
      );
      return;
    }

    const chosenPill =
      QUICK_ORDER_PILLS.find((p) => p.id === draft.selectedFormat) ?? QUICK_ORDER_PILLS[1];

    const shieldResult = await submitProtectedLead({
      source: 'order_page',
      checkoutMode: 'production_only',
      orderNumberCandidate: generateOrderNumber(),
      formatLabel: chosenPill.label,
      totalBudgetRub: selectedStudioPricingRow?.priceRub,
      contactLine: effectiveContact,
      companyLine: effectiveCompany,
      briefText: draft.briefText.trim(),
      hasVoiceRecording: hasVoice,
      voiceDurationSec: hasVoice ? Math.max(4, recordSeconds) : 0,
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
    const summary: ConfirmedReservationSummary = {
      orderNumber: shieldResult.orderNumber,
      confirmedAtMs: nowMs,
      holdExpiresAtMs: nowMs + DEFAULT_HOLD_WINDOW_SECONDS * 1000,
      checkoutMode: 'production_only',
      formatLabel: chosenPill.label,
      spotDurationSec: draft.spotDurationSec,
      industryLabel: activeIndustrySpec?.shortTitle ?? null,
      contactLine: effectiveContact,
      companyLine: nextVip.company,
      briefNote: draft.briefText.trim(),
      hasVoice,
      voiceSec: Math.max(4, recordSeconds),
      fileName: attachedFileName,
      lockedMediaReservation: null,
      lockedTotals: null,
      conversionAllowed: shieldResult.conversionAllowed,
      innVerified: shieldResult.innVerified,
    };

    orderDraftStore.confirmReservationOrder(summary);
    setConfirmedOrder(summary);
    setIsConfirmedModalOpen(true);
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

  const resetForAnotherOrder = () => {
    setConfirmedOrder(null);
    setIsConfirmedModalOpen(false);
    orderDraftStore.clearConfirmedReservation();
    setCopiedSpec(false);
    setRateLimitError(undefined);
    orderDraftStore.updateDraft({ briefText: '' });
    setAttachedFileName(null);
    deleteRecordedVoice();
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
    return buildClientNextStepsTimeline(
      confirmedOrder.checkoutMode,
      confirmedOrder.lockedMediaReservation?.stations.length ?? 0
    );
  }, [confirmedOrder]);

  return (
    <section
      data-testid="fullscreen-order-page"
      aria-labelledby="order-page-heading"
      className="py-10 sm:py-16 lg:py-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-8 sm:space-y-10">
        {/* Верхняя навигационная строка возврата и честный статус шага резерва */}
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
                {confirmedOrder ? (
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

        {/* Заголовок экрана оформления */}
        <div className="max-w-3xl space-y-3">
          <p className="text-sm font-medium text-[#FF4820]">
            {confirmedOrder
              ? `Заявка #${confirmedOrder.orderNumber} отправлена · Ждите звонка продюсера в течение 15–20 минут`
              : isMediaBookingMode
                ? `Выбрано радиостанций: ${mediaReservation?.stations.length ?? 0} · Оставьте контакт, чтобы закрепить слоты за вашей компанией`
                : 'Консьерж-оформление FMWorks · Работаем по договору и ЭДО'}
          </p>
          <h1
            id="order-page-heading"
            className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
          >
            {confirmedOrder
              ? 'Ваша приоритетная бронь принята в работу'
              : isMediaBookingMode
                ? 'Завершение бронирования эфира за 15 секунд'
                : 'Запуск аудиоролика за 24–48 часов'}
          </h1>
          <p className="text-base sm:text-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 editorial-pretty">
            {confirmedOrder
              ? 'Ниже показан пошаговый маршрут работы по вашей заявке и полная спецификация. В любой момент вы можете открыть диалоговое окно статуса.'
              : isMediaBookingMode
                ? 'Для постановки выбранных станций на бесплатный 4-часовой резерв достаточно указать Имя и Телефон (или @Telegram). Задачу на сценарий ролика можно добавить ниже по желанию или обсудить с продюсером устно.'
                : 'Передайте задачу 30-секундным голосовым сообщением или парой строк — продюсер предложит три концепции сценария, кастинг актёров и возьмёт на себя юридическую очистку прав.'}
          </p>
        </div>

        {confirmedOrder ? (
          /* ЭКРАН ПОДТВЕРЖДЕНИЯ БРОНИ ИЛИ СТУДИЙНОГО ЗАКАЗА С МАРШРУТОМ 3 ШАГОВ */
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
                    {confirmedOrder.lockedMediaReservation
                      ? `Приоритетная бронь #${confirmedOrder.orderNumber} зафиксирована`
                      : `Заказ #${confirmedOrder.orderNumber} принят в студию`}
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">
                    {confirmedOrder.lockedMediaReservation
                      ? 'Эфирные квоты поставлены на 4-часовой холд'
                      : 'Пришлём тайминг, кастинг и счёт в течение 30 минут'}
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
                <button
                  type="button"
                  data-testid="reopen-confirmed-modal-btn"
                  onClick={() => setIsConfirmedModalOpen(true)}
                  className="text-xs font-semibold text-[#FF4820] hover:underline cursor-pointer"
                >
                  Открыть диалоговое окно статуса →
                </button>
              </div>
            </div>

            {/* Наглядная дорожная карта из 3 шагов: что происходит дальше */}
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

            {confirmedOrder.lockedMediaReservation && confirmedOrder.lockedTotals ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7 space-y-4">
                  <p
                    data-testid="drawer-hold-explanation"
                    className="text-base leading-relaxed text-[#111111]/80 dark:text-[#F4F3EF]/80"
                  >
                    Продюсер эфирного отдела уже сверяет выбранные тайм-слоты с трафик-службой радиостанций и подготовит единый договор-счёт в ЭДО в течение 20 минут.
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

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  onNavigate(
                    confirmedOrder.lockedMediaReservation ? { kind: 'hot-air' } : { kind: 'cases' }
                  )
                }
                className="min-h-[46px] px-6 py-3 rounded-full bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] text-sm font-semibold cursor-pointer"
              >
                {confirmedOrder.lockedMediaReservation
                  ? 'Вернуться в раздел «Горящий эфир»'
                  : 'Посмотреть разборы кейсов'}
              </button>
              <button
                type="button"
                onClick={resetForAnotherOrder}
                className="min-h-[46px] inline-flex items-center gap-2 px-5 py-3 rounded-full border border-[#111111]/15 dark:border-[#F4F3EF]/15 text-sm font-semibold hover:border-[#FF4820] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Изменить данные или оформить ещё проект</span>
              </button>
            </div>
          </motion.div>
        ) : (
          /* ДВУХКОЛОНОЧНАЯ ПОЛНОЭКРАННАЯ ФОРМА: В РЕЖИМЕ БРОНИ ЭФИРА ШАГ 1 = КОНТАКТ, ШАГ 2 = ПО ЖЕЛАНИЮ БРИФ */
          <form
            onSubmit={handleSubmit}
            onPointerMove={registerPointerActivity}
            onKeyDown={registerKeyActivity}
            onFocusCapture={registerFocusActivity}
            noValidate
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start"
          >
            {/* Невидимая антибот-ловушка (Honeypot) без влияния на доступность и верстку */}
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
              />
            </div>

            {/* ЛЕВАЯ КОЛОНКА (7 колонок) */}
            <div className="lg:col-span-7 space-y-8">
              {isMediaBookingMode ? (
                /* =========================================================
                   РЕЖИМ БРОНИРОВАНИЯ ЭФИРА: СНАЧАЛА БЫСТРЫЙ РЕЗЕРВ ПО КОНТАКТУ,
                   БРИФ И ГОЛОСОВОЕ ТЗ НА РОЛИК — ПО ЖЕЛАНИЮ НИЖЕ
                   ========================================================= */
                <>
                  {/* ШАГ 01 (ГЛАВНЫЙ): Контакт для мгновенной фиксации 4-часового резерва */}
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
                        Укажите телефон или @Telegram — после нажатия кнопки откроется диалоговое окно с номером вашей брони, а продюсер свяжется в течение 15–20 минут.
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label
                            htmlFor="order-contact-input"
                            className="block text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                          >
                            Имя и Телефон / @Telegram *
                          </label>
                          <input
                            id="order-contact-input"
                            type="text"
                            data-testid="drawer-contact-input"
                            aria-label="Имя и Телефон / @Telegram"
                            value={draft.contactLine}
                            onChange={(e) => {
                              orderDraftStore.updateDraft({ contactLine: e.target.value });
                              if (contactError) setContactError(undefined);
                            }}
                            placeholder="Например: Алексей +7 999 123-45-67"
                            className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/18 dark:border-[#F4F3EF]/18 text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none focus:border-[#FF4820]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label
                            htmlFor="order-requisites-input"
                            className="block text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                          >
                            Компания или ИНН (по желанию, для ЭДО)
                          </label>
                          <input
                            id="order-requisites-input"
                            type="text"
                            data-testid="drawer-requisites-input"
                            aria-label="Компания или ИНН для выставления счёта в ЭДО"
                            value={draft.companyLine}
                            onChange={(e) => {
                              orderDraftStore.updateDraft({ companyLine: e.target.value });
                              if (companyError) setCompanyError(undefined);
                            }}
                            placeholder="ООО или ИНН 10 / 12 цифр"
                            className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/18 dark:border-[#F4F3EF]/18 text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none focus:border-[#FF4820]"
                          />
                        </div>
                      </div>
                    )}

                    {contactError && (
                      <p
                        role="alert"
                        data-testid="drawer-contact-error"
                        className="text-xs font-semibold text-[#FF4820]"
                      >
                        {contactError}
                      </p>
                    )}

                    {companyError && (
                      <p
                        role="alert"
                        data-testid="drawer-company-error"
                        className="text-xs font-semibold text-[#FF4820]"
                      >
                        {companyError}
                      </p>
                    )}

                    {rateLimitError && (
                      <p
                        role="alert"
                        data-testid="drawer-rate-limit-error"
                        className="text-xs font-semibold text-[#FF4820]"
                      >
                        {rateLimitError}
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
                          Антиспам-фильтр без капчи · Проверка ИНН ФНС · RateLimiter (доступно попыток:{' '}
                          {remainingAttempts})
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* ШАГ 02 (ПО ЖЕЛАНИЮ): Формат ролика, голосовое ТЗ и карточка реквизитов */}
                  <div className="rounded-3xl p-5 sm:p-7 bg-[#EFECE5]/55 dark:bg-[#141419] border border-[#111111]/10 dark:border-white/10 space-y-5">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[#111111]/58 dark:text-[#F4F3EF]/58">
                        02. По желанию: формат ролика, голосовое ТЗ или реквизиты
                      </p>
                      <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                        Пожелания к аудиоролику (необязательно для брони эфира)
                      </h3>
                      <p className="text-xs sm:text-sm text-[#111111]/64 dark:text-[#F4F3EF]/64">
                        Если хотите, выберите вариант производства ролика и надиктуйте задачу голосом прямо сейчас — или оставьте пустым и обсудите всё с продюсером по телефону.
                      </p>
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
                              className={`min-h-[42px] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors border cursor-pointer text-center leading-snug ${
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

                    {/* Голосовая надиктовка */}
                    <div className="rounded-2xl p-4 bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10">
                      {voiceStatus === 'idle' && (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            data-testid="drawer-voice-record-btn"
                            onClick={startVoiceRecording}
                            className="min-h-[42px] inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer text-center leading-snug"
                          >
                            <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>Надиктовать задачу для ролика голосом (по желанию)</span>
                          </button>
                          <span className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                            30 секунд своими словами
                          </span>
                        </div>
                      )}

                      {voiceStatus === 'recording' && (
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#FF4820]" />
                            <span className="text-sm font-semibold tabular-nums">
                              Идёт запись · 0:{String(recordSeconds).padStart(2, '0')}
                            </span>
                            <div aria-hidden="true" className="flex items-end gap-1 h-5 ml-1">
                              {pulseBars.map((bar, idx) => (
                                <span
                                  key={idx}
                                  className={`w-1 bg-[#FF4820] rounded-full transition-all duration-150 ${getPulseBarHeightClass(
                                    bar
                                  )}`}
                                />
                              ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            data-testid="drawer-voice-stop-btn"
                            onClick={stopVoiceRecording}
                            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] text-xs font-semibold cursor-pointer"
                          >
                            <Square className="w-3 h-3 fill-current" aria-hidden="true" />
                            <span>Готово</span>
                          </button>
                        </div>
                      )}

                      {voiceStatus === 'recorded' && (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={togglePlaybackRecordedVoice}
                              className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white text-xs font-semibold cursor-pointer shrink-0"
                            >
                              {isPlayingVoice ? (
                                <>
                                  <Pause className="w-3.5 h-3.5 fill-current" />
                                  <span>Пауза</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  <span>Прослушать</span>
                                </>
                              )}
                            </button>

                            <span className="text-xs sm:text-sm font-medium tabular-nums">
                              Голосовое ТЗ · 0:{String(Math.max(1, recordSeconds)).padStart(2, '0')}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={deleteRecordedVoice}
                            aria-label="Удалить голосовую запись"
                            className="w-10 h-10 rounded-full flex items-center justify-center text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#FF4820] transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

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
                   РЕЖИМ СТУДИЙНОГО ЗАКАЗА РОЛИКА (ТОЛЬКО ПРОДАКШН)
                   ========================================================= */
                <>
                  {/* Переключатель: Новый проект / Постоянный клиент */}
                  <div
                    role="group"
                    aria-label="Тип клиента"
                    className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/8 dark:border-[#F4F3EF]/10"
                  >
                    <button
                      type="button"
                      onClick={() => handleSwitchClientMode('new_project')}
                      aria-pressed={clientMode === 'new_project'}
                      className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
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
                      className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                        clientMode === 'returning_client'
                          ? 'bg-[#F7F6F2] text-[#111111] dark:bg-[#0D0D0F] dark:text-[#F4F3EF] shadow-xs'
                          : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                      }`}
                    >
                      Постоянный клиент (по договору)
                    </button>
                  </div>

                  {/* Шаг 1: Выбор пакета продакшна */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-[#111111]/58 dark:text-[#F4F3EF]/58">
                      01. Формат студийного производства
                    </p>
                    <div
                      role="group"
                      aria-label="Формат ролика"
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                    >
                      {QUICK_ORDER_PILLS.map((pill) => {
                        const active = draft.selectedFormat === pill.id;
                        return (
                          <button
                            key={pill.id}
                            type="button"
                            onClick={() =>
                              orderDraftStore.updateDraft({ selectedFormat: pill.id })
                            }
                            aria-pressed={active}
                            className={`min-h-[54px] px-4 py-3 rounded-2xl text-left transition-colors border cursor-pointer flex flex-col justify-center ${
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

                  {/* Шаг 2: Точный хронометраж ролика и отрасль */}
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
                              className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold tabular-nums border transition-colors cursor-pointer ${
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

                  {/* Шаг 3: Голосовая надиктовка задачи + текстовый бриф + прикрепление файла */}
                  <div className="space-y-3.5 pt-2 border-t border-[#111111]/10 dark:border-white/10">
                    <p className="text-xs font-semibold text-[#111111]/60 dark:text-[#F4F3EF]/60">
                      03. Передайте задачу голосом или текстом
                    </p>

                    <div className="rounded-2xl p-4 sm:p-5 bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/10 dark:border-white/10">
                      {voiceStatus === 'idle' && (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            data-testid="drawer-voice-record-btn"
                            onClick={startVoiceRecording}
                            className="min-h-[44px] inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer text-center leading-snug"
                          >
                            <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>Надиктовать задачу голосом</span>
                          </button>
                          <span className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                            30 секунд своими словами вместо заполнения анкеты
                          </span>
                        </div>
                      )}

                      {voiceStatus === 'recording' && (
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#FF4820]" />
                            <span className="text-sm font-semibold tabular-nums">
                              Идёт запись · 0:{String(recordSeconds).padStart(2, '0')}
                            </span>
                            <div aria-hidden="true" className="flex items-end gap-1 h-5 ml-1">
                              {pulseBars.map((bar, idx) => (
                                <span
                                  key={idx}
                                  className={`w-1 bg-[#FF4820] rounded-full transition-all duration-150 ${getPulseBarHeightClass(
                                    bar
                                  )}`}
                                />
                              ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            data-testid="drawer-voice-stop-btn"
                            onClick={stopVoiceRecording}
                            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] text-xs font-semibold cursor-pointer"
                          >
                            <Square className="w-3 h-3 fill-current" aria-hidden="true" />
                            <span>Готово</span>
                          </button>
                        </div>
                      )}

                      {voiceStatus === 'recorded' && (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={togglePlaybackRecordedVoice}
                              className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white text-xs font-semibold cursor-pointer shrink-0"
                            >
                              {isPlayingVoice ? (
                                <>
                                  <Pause className="w-3.5 h-3.5 fill-current" />
                                  <span>Пауза</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  <span>Прослушать</span>
                                </>
                              )}
                            </button>

                            <span className="text-xs sm:text-sm font-medium tabular-nums">
                              Голосовое ТЗ · 0:{String(Math.max(1, recordSeconds)).padStart(2, '0')}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={deleteRecordedVoice}
                            aria-label="Удалить голосовую запись"
                            className="w-10 h-10 rounded-full flex items-center justify-center text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#FF4820] transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <textarea
                      rows={3}
                      aria-label="О чем ролик или какая акция?"
                      value={draft.briefText}
                      onChange={(e) => {
                        orderDraftStore.updateDraft({ briefText: e.target.value });
                        if (taskError) setTaskError(undefined);
                      }}
                      placeholder="О чем ролик, какая главная выгода для клиента и какой контакт оставить в финале?"
                      className="w-full px-4 py-3.5 rounded-2xl bg-transparent border border-[#111111]/16 dark:border-[#F4F3EF]/16 text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none focus:border-[#FF4820]"
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
                      <p role="alert" className="text-xs font-semibold text-[#FF4820]">
                        {taskError}
                      </p>
                    )}
                  </div>

                  {/* Шаг 4: Контакты и реквизиты для ЭДО */}
                  <div className="space-y-3.5 pt-2 border-t border-[#111111]/10 dark:border-white/10">
                    <p className="text-xs font-semibold text-[#111111]/60 dark:text-[#F4F3EF]/60">
                      04. Куда прислать тайминг, сценарии и счёт
                    </p>

                    {isReturningFastTrack ? (
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
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          data-testid="drawer-contact-input"
                          aria-label="Имя и Телефон / @Telegram"
                          value={draft.contactLine}
                          onChange={(e) => {
                            orderDraftStore.updateDraft({ contactLine: e.target.value });
                            if (contactError) setContactError(undefined);
                          }}
                          placeholder="Имя и Телефон / @Telegram *"
                          className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-transparent border border-[#111111]/16 dark:border-[#F4F3EF]/16 text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none focus:border-[#FF4820]"
                        />

                        <input
                          type="text"
                          data-testid="drawer-requisites-input"
                          aria-label="Компания или ИНН для выставления счёта в ЭДО"
                          value={draft.companyLine}
                          onChange={(e) => {
                            orderDraftStore.updateDraft({ companyLine: e.target.value });
                            if (companyError) setCompanyError(undefined);
                          }}
                          placeholder="Компания или ИНН 10 / 12 цифр (для ЭДО)"
                          className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-transparent border border-[#111111]/16 dark:border-[#F4F3EF]/16 text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none focus:border-[#FF4820]"
                        />
                      </div>
                    )}

                    {contactError && (
                      <p
                        role="alert"
                        data-testid="drawer-contact-error"
                        className="text-xs font-semibold text-[#FF4820]"
                      >
                        {contactError}
                      </p>
                    )}

                    {companyError && (
                      <p
                        role="alert"
                        data-testid="drawer-company-error"
                        className="text-xs font-semibold text-[#FF4820]"
                      >
                        {companyError}
                      </p>
                    )}

                    {rateLimitError && (
                      <p
                        role="alert"
                        data-testid="drawer-rate-limit-error"
                        className="text-xs font-semibold text-[#FF4820]"
                      >
                        {rateLimitError}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 space-y-2.5">
                    <button
                      type="submit"
                      disabled={isSubmittingLead}
                      data-testid="drawer-submit-btn"
                      className="w-full sm:w-auto min-w-[280px] min-h-[52px] py-4 px-8 rounded-full bg-[#FF4820] hover:bg-[#E63C17] disabled:opacity-65 active:scale-[0.99] text-white text-sm sm:text-base font-semibold transition-all cursor-pointer disabled:cursor-default text-center leading-snug"
                    >
                      {isSubmittingLead
                        ? 'Проверка и фиксация заявки…'
                        : rateLimitCountdownSec > 0
                          ? `Повторная отправка через ${rateLimitCountdownSec} сек`
                          : 'Запустить проект в работу'}
                    </button>

                    <p
                      data-testid="order-antispam-caption"
                      className="text-xs text-[#111111]/54 dark:text-[#F4F3EF]/54 flex flex-wrap items-center gap-1.5 tabular-nums"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
                      <span>
                        Антиспам-фильтр без капчи · Проверка ИНН ФНС · RateLimiter (доступно попыток:{' '}
                        {remainingAttempts})
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
                <div className="rounded-3xl p-6 sm:p-7 bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/10 dark:border-white/10 space-y-5 tabular-nums">
                  <div className="pb-4 border-b border-[#111111]/10 dark:border-white/10 space-y-1">
                    <p className="text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
                      Сводка студийного заказа
                    </p>
                    <h2 className="text-xl font-bold tracking-tight">
                      {selectedStudioPricingRow?.title ?? 'Адаптация прошлого ролика'}
                    </h2>
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">
                        Стоимость пакета:
                      </span>
                      <span className="text-lg font-bold">
                        {selectedStudioPricingRow?.priceFormatted ?? 'По оценке задачи'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">
                        Срок готовности:
                      </span>
                      <span className="font-semibold">
                        {selectedStudioPricingRow?.turnaround ?? '24 часа'}
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
                      <span className="font-semibold">Паспорт РАО/ВОИС + права</span>
                    </div>
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
                  </div>
                </div>
              )}

              <div className="px-2 flex items-center justify-between text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55">
                <span>Ответ продюсера — до 15–20 минут</span>
                <span className="font-medium">Договор · Безнал · ЭДО</span>
              </div>
            </aside>
          </form>
        )}
      </div>

      {/* Диалоговое модальное окно подтверждения брони с 3 шагами «Что дальше» */}
      <ReservationConfirmedModal
        isOpen={isConfirmedModalOpen}
        confirmed={confirmedOrder}
        onClose={() => setIsConfirmedModalOpen(false)}
        onNavigateHotAir={() => onNavigate({ kind: 'hot-air' })}
      />
    </section>
  );
}
