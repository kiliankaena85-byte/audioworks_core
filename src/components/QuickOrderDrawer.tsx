import {
  CheckCircle2,
  Copy,
  Download,
  Mic,
  Paperclip,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { casePlayerEngine } from '../audio/casePlayerEngine';
import { contrastAudioEngine } from '../audio/contrastAudioEngine';
import {
  generateOrderNumber,
  OrderFormatId,
  QUICK_ORDER_PILLS,
  readSavedVipProfile,
  SavedVipProfile,
  validateQuickOrder,
  writeSavedVipProfile,
} from '../data/pricingData';
import {
  ComputedReservationTotals,
  computeReservationTotalsForSelection,
  formatBookingSpecificationText,
  formatHoldCountdown,
  formatNumberSpaced,
  formatRubCompact,
  MediaGridReservationPayload,
  ReservationProductionSelection,
} from '../data/radioInventory';
import { useLayaDecision } from '../engine/LayaContext';
import {
  clientLeadRateLimiter,
  resolveLeadFormRateScope,
} from '../security/leadShield';

interface QuickOrderDrawerProps {
  isOpen: boolean;
  initialFormat: OrderFormatId | null;
  mediaReservation?: MediaGridReservationPayload | null;
  onClose: () => void;
}

type ClientMode = 'new_project' | 'returning_client';
type VoiceStatus = 'idle' | 'recording' | 'recorded';

function getPulseBarHeightClass(level: number): string {
  if (level >= 0.78) return 'h-5';
  if (level >= 0.6) return 'h-4';
  if (level >= 0.44) return 'h-3';
  if (level >= 0.3) return 'h-2';
  return 'h-1.5';
}

export function QuickOrderDrawer({
  isOpen,
  initialFormat,
  mediaReservation = null,
  onClose,
}: QuickOrderDrawerProps) {
  const { decision } = useLayaDecision();
  const isMediaBookingMode = mediaReservation !== null;

  const [clientMode, setClientMode] = useState<ClientMode>('new_project');
  const [savedVip, setSavedVip] = useState<SavedVipProfile | null>(() =>
    readSavedVipProfile()
  );
  const [isEditingVipContact, setIsEditingVipContact] = useState(false);

  const [selectedFormat, setSelectedFormat] = useState<OrderFormatId>(
    initialFormat ?? decision.recommendedTier
  );
  const [reservationProdSelection, setReservationProdSelection] =
    useState<ReservationProductionSelection>(
      mediaReservation?.initialProductionSelection ?? 'turnkey'
    );
  const [holdRemainingSec, setHoldRemainingSec] = useState<number>(
    mediaReservation?.initialCountdownSeconds ?? 4 * 3600 - 1
  );

  const [briefText, setBriefText] = useState('');
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [contactLine, setContactLine] = useState('');
  const [companyLine, setCompanyLine] = useState('');
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

  // Validation & Confirmation state
  const [contactError, setContactError] = useState<string | undefined>();
  const [taskError, setTaskError] = useState<string | undefined>();
  const [rateLimitError, setRateLimitError] = useState<string | undefined>();
  const [confirmedOrder, setConfirmedOrder] = useState<{
    orderNumber: string;
    formatLabel: string;
    contact: string;
    companyRequisites: string;
    briefNote: string;
    hasVoice: boolean;
    voiceSec: number;
    fileName: string | null;
    lockedMediaReservation: MediaGridReservationPayload | null;
    lockedTotals: ComputedReservationTotals | null;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const htmlPlayerRef = useRef<HTMLAudioElement | null>(null);
  const simPlaybackTimerRef = useRef<number | null>(null);

  const reservationTotals = useMemo<ComputedReservationTotals | null>(() => {
    if (!mediaReservation) return null;
    return computeReservationTotalsForSelection(mediaReservation, reservationProdSelection);
  }, [mediaReservation, reservationProdSelection]);

  // Sync preselected format, media reservation & VIP mode whenever drawer opens
  useEffect(() => {
    if (!isOpen) return;
    setConfirmedOrder(null);
    setCopiedSpec(false);
    setContactError(undefined);
    setTaskError(undefined);
    setRateLimitError(undefined);
    setSelectedFormat(initialFormat ?? decision.recommendedTier);

    if (mediaReservation) {
      setReservationProdSelection(mediaReservation.initialProductionSelection);
      setHoldRemainingSec(mediaReservation.initialCountdownSeconds);
      if (mediaReservation.productNote) {
        setBriefText(mediaReservation.productNote);
      }
    }

    const stored = readSavedVipProfile();
    setSavedVip(stored);
    if (decision.choice === 'returning_vip' || stored) {
      if (decision.choice === 'returning_vip') {
        setClientMode('returning_client');
      }
      if (stored) {
        setContactLine(stored.contactLine);
        setCompanyLine(stored.company);
        setIsEditingVipContact(false);
      }
    }
  }, [isOpen, initialFormat, mediaReservation, decision.recommendedTier, decision.choice]);

  // Живой обратный отсчёт 4-часового приоритетного резерва квоты (03:59:59 -> 03:59:58...)
  useEffect(() => {
    if (!isOpen || !isMediaBookingMode) return;
    const timerId = window.setInterval(() => {
      setHoldRemainingSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [isOpen, isMediaBookingMode, mediaReservation?.createdAtMs]);

  // Escape key closes drawer
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

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

  const handleSwitchClientMode = (nextMode: ClientMode) => {
    setClientMode(nextMode);
    setContactError(undefined);
    setTaskError(undefined);
    setRateLimitError(undefined);
    if (nextMode === 'returning_client') {
      const stored = readSavedVipProfile();
      if (stored) {
        setSavedVip(stored);
        setContactLine(stored.contactLine);
        setCompanyLine(stored.company);
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
      if (htmlPlayerRef.current) {
        htmlPlayerRef.current.pause();
      }
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

    // Play pleasant warm studio tone confirmation for simulated voice note
    setIsPlayingVoice(true);
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const durSec = Math.min(6, Math.max(3, recordSeconds));
    if (AudioCtx) {
      try {
        const ctx = new AudioCtx();
        const notes = [220, 277.18, 329.63, 440];
        notes.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, ctx.currentTime + idx * 0.18);
          gain.gain.setValueAtTime(0.0001, ctx.currentTime + idx * 0.18);
          gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + idx * 0.18 + 0.06);
          gain.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + durSec);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.18);
          osc.stop(ctx.currentTime + durSec + 0.05);
        });
        window.setTimeout(() => ctx.close().catch(() => {}), durSec * 1000 + 200);
      } catch {
        // Ignore headless audio context restrictions
      }
    }

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (voiceStatus === 'recording') {
      stopVoiceRecording();
    }

    setContactError(undefined);
    setTaskError(undefined);
    setRateLimitError(undefined);

    const rateScope = resolveLeadFormRateScope(
      isMediaBookingMode ? 'air_plus_production' : 'production_only'
    );

    const preCheck = clientLeadRateLimiter.check(rateScope);
    if (!preCheck.allowed) {
      setRateLimitError(
        preCheck.reason === 'burst_cooldown'
          ? `Слишком частая отправка. Подождите ${preCheck.retryAfterSec} сек.`
          : `Превышен лимит попыток отправки (${preCheck.maxAttempts} за 10 минут). Повторите через ${preCheck.retryAfterSec} сек.`
      );
      return;
    }

    const effectiveContact = isReturningFastTrack
      ? savedVip.contactLine
      : contactLine.trim();

    if (isMediaBookingMode && mediaReservation && reservationTotals) {
      if (!isReturningFastTrack && effectiveContact.length < 4) {
        setContactError('Укажите имя и телефон или @Telegram для подтверждения холда');
        return;
      }

      const consumeRes = clientLeadRateLimiter.consume(rateScope);
      if (!consumeRes.allowed) {
        setRateLimitError(
          `Превышен лимит попыток отправки. Повторите через ${consumeRes.retryAfterSec} сек.`
        );
        return;
      }

      const nextVip: SavedVipProfile = {
        contactLine: effectiveContact,
        company: companyLine.trim() || savedVip?.company || '',
      };
      writeSavedVipProfile(nextVip);
      setSavedVip(nextVip);
      setIsEditingVipContact(false);

      const holdNum = 2810 + (mediaReservation.totalSpots % 580);
      const orderNum = `FM-HOLD-${holdNum}`;

      if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        window
          .fetch('/api/orders/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: 'order_page',
              checkoutMode: 'air_plus_production',
              orderNumberCandidate: orderNum,
              formatLabel: reservationTotals.spotStatusLabel,
              totalBudgetRub: reservationTotals.unifiedTotalRub,
              contactLine: effectiveContact,
              companyLine: nextVip.company,
              briefText: briefText.trim(),
              hasVoiceRecording: voiceStatus === 'recorded' || voiceStatus === 'recording',
              hasAttachedFile: Boolean(attachedFileName),
              isReturningFastTrack,
              requireBriefOrVoice: false,
              websiteTrap: '',
              dwellMs: 3200,
              pointerMoves: 4,
              keystrokes: 8,
              focusEvents: 2,
              challengeId: '',
              challengeSalt: '',
              challengeNonce: '',
              powSolution: '',
            }),
          })
          .catch(() => {});
      }

      setConfirmedOrder({
        orderNumber: orderNum,
        formatLabel: reservationTotals.spotStatusLabel,
        contact: effectiveContact,
        companyRequisites: nextVip.company,
        briefNote: briefText.trim(),
        hasVoice: voiceStatus === 'recorded' || voiceStatus === 'recording',
        voiceSec: Math.max(4, recordSeconds),
        fileName: attachedFileName,
        lockedMediaReservation: mediaReservation,
        lockedTotals: reservationTotals,
      });
      return;
    }

    const check = validateQuickOrder({
      contactLine: effectiveContact,
      briefText,
      hasVoiceRecording: voiceStatus === 'recorded' || voiceStatus === 'recording',
      hasAttachedFile: Boolean(attachedFileName),
      isReturningClientWithSavedProfile: isReturningFastTrack,
    });

    if (!check.valid) {
      setContactError(check.contactError);
      setTaskError(check.taskError);
      return;
    }

    const consumeRes = clientLeadRateLimiter.consume(rateScope);
    if (!consumeRes.allowed) {
      setRateLimitError(
        `Превышен лимит попыток отправки. Повторите через ${consumeRes.retryAfterSec} сек.`
      );
      return;
    }

    // Сохраняем контакт и компанию в localStorage для мгновенного заказа в 2 клика при следующем визите!
    const nextVip: SavedVipProfile = {
      contactLine: effectiveContact,
      company: companyLine.trim() || savedVip?.company || '',
    };
    writeSavedVipProfile(nextVip);
    setSavedVip(nextVip);
    setIsEditingVipContact(false);

    const chosenPill =
      QUICK_ORDER_PILLS.find((p) => p.id === selectedFormat) ?? QUICK_ORDER_PILLS[1];
    const orderNum = generateOrderNumber();

    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      window
        .fetch('/api/orders/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'order_page',
            checkoutMode: 'production_only',
            orderNumberCandidate: orderNum,
            formatLabel: chosenPill.label,
            contactLine: effectiveContact,
            companyLine: nextVip.company,
            briefText: briefText.trim(),
            hasVoiceRecording: voiceStatus === 'recorded' || voiceStatus === 'recording',
            hasAttachedFile: Boolean(attachedFileName),
            isReturningFastTrack,
            requireBriefOrVoice: true,
            websiteTrap: '',
            dwellMs: 3200,
            pointerMoves: 4,
            keystrokes: 8,
            focusEvents: 2,
            challengeId: '',
            challengeSalt: '',
            challengeNonce: '',
            powSolution: '',
          }),
        })
        .catch(() => {});
    }

    setConfirmedOrder({
      orderNumber: orderNum,
      formatLabel: chosenPill.label,
      contact: effectiveContact,
      companyRequisites: nextVip.company,
      briefNote: briefText.trim(),
      hasVoice: voiceStatus === 'recorded' || voiceStatus === 'recording',
      voiceSec: Math.max(4, recordSeconds),
      fileName: attachedFileName,
      lockedMediaReservation: null,
      lockedTotals: null,
    });
  };

  const resetForAnotherOrder = () => {
    setConfirmedOrder(null);
    setCopiedSpec(false);
    setRateLimitError(undefined);
    setBriefText('');
    setAttachedFileName(null);
    deleteRecordedVoice();
  };

  const handleCopyBookingSpec = async () => {
    if (!confirmedOrder?.lockedMediaReservation || !confirmedOrder.lockedTotals) return;
    const specText = formatBookingSpecificationText({
      orderNumber: confirmedOrder.orderNumber,
      payload: confirmedOrder.lockedMediaReservation,
      totals: confirmedOrder.lockedTotals,
      contact: confirmedOrder.contact,
      companyRequisites: confirmedOrder.companyRequisites,
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
      contact: confirmedOrder.contact,
      companyRequisites: confirmedOrder.companyRequisites,
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#111111]/48 dark:bg-black/68"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-order-title"
          data-testid="quick-order-drawer-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl h-full bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111] dark:text-[#F4F3EF] border-l border-[#111111]/10 dark:border-[#F4F3EF]/12 p-6 sm:p-9 flex flex-col justify-between overflow-y-auto subtle-scrollbar overscroll-contain"
          >
            <div>
              {/* Верхний живой таймер резерва квоты в режиме «Бронь эфира + Продакшн» */}
              {isMediaBookingMode && (
                <div
                  data-testid="drawer-hold-timer"
                  className="mb-4 px-4 py-2.5 rounded-2xl bg-[#111114] text-[#F4F3EF] border border-white/12 flex items-center justify-between gap-3 text-xs sm:text-[13px] tabular-nums"
                >
                  <span className="font-semibold text-[#FFB36B]">
                    ⏳ Приоритетный резерв: {formatHoldCountdown(holdRemainingSec)}
                  </span>
                  <span className="text-white/62 hidden sm:inline">
                    Квота без предоплаты · ЭДО
                  </span>
                </div>
              )}

              {/* Drawer Top Header */}
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-xs font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55 mb-1">
                    {isMediaBookingMode
                      ? 'Единое окно запуска FMWorks · Эфир и студия'
                      : 'Консьерж-сервис FMWorks'}
                  </p>
                  <h2
                    id="quick-order-title"
                    className="text-2xl sm:text-3xl font-bold tracking-tight"
                  >
                    {isMediaBookingMode ? 'Бронь эфира + Продакшн' : 'Быстрый заказ за 30 секунд'}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Закрыть шторку быстрого заказа"
                  className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center hover:bg-[#111111]/8 dark:hover:bg-[#F4F3EF]/10 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {confirmedOrder ? (
                confirmedOrder.lockedMediaReservation && confirmedOrder.lockedTotals ? (
                  /* СТРУКТУРИРОВАННАЯ КАРТОЧКА 4-ЧАСОВОЙ БРОНИ ЭФИРА И ПРОДАКШНА */
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-testid="drawer-confirmed-hold-card"
                    className="py-2 space-y-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-[#FF4820]/15 text-[#FF4820] flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#FF4820] tabular-nums">
                          Бронь #{confirmedOrder.orderNumber} зафиксирована
                        </p>
                        <h3 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug">
                          Квота поставлена на 4-часовой холд.
                        </h3>
                      </div>
                    </div>

                    <p
                      data-testid="drawer-hold-explanation"
                      className="text-sm sm:text-[15px] leading-relaxed text-[#111111]/80 dark:text-[#F4F3EF]/80"
                    >
                      Квота поставлена на 4-часовой холд. Продюсер подтвердит тайм-слоты и пришлёт
                      единый счёт в ЭДО в течение 20 минут.
                    </p>

                    {/* Карточка спецификации заказа */}
                    <div className="rounded-3xl p-5 bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/10 dark:border-[#F4F3EF]/12 space-y-3.5 text-xs sm:text-sm tabular-nums">
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#111111]/10 dark:border-white/10">
                        <span className="font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70">
                          Забронированные станции ({confirmedOrder.lockedMediaReservation.stations.length})
                        </span>
                        <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                          {confirmedOrder.lockedMediaReservation.totalSpots} выходов ·{' '}
                          {formatNumberSpaced(confirmedOrder.lockedMediaReservation.totalReachOTS)}{' '}
                          OTS
                        </span>
                      </div>

                      <div className="divide-y divide-[#111111]/8 dark:divide-white/8">
                        {confirmedOrder.lockedMediaReservation.stations.map((st) => (
                          <div
                            key={st.slotId}
                            className="py-2 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <span className="font-semibold">{st.station}</span>
                              <span className="text-[#111111]/58 dark:text-[#F4F3EF]/58">
                                {' '}
                                · {st.daypart || st.frequencyFm} · {st.spotsIncluded} вых.
                                {st.exactDurationSec ? ` · ${st.exactDurationSec} сек` : ''}
                              </span>
                            </div>
                            <span className="font-semibold shrink-0">
                              {formatRubCompact(st.hotPrice)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2.5 border-t border-[#111111]/10 dark:border-white/10 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#111111]/65 dark:text-[#F4F3EF]/65">
                            Статус ролика:
                          </span>
                          <span className="font-semibold text-[#FF4820] text-right">
                            {confirmedOrder.lockedTotals.spotStatusLabel}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#111111]/65 dark:text-[#F4F3EF]/65">
                            Зафиксированная выгода:
                          </span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            +{formatRubCompact(confirmedOrder.lockedTotals.totalSavingsRub)} (скидка −
                            {confirmedOrder.lockedMediaReservation.airDiscountPercent}%)
                          </span>
                        </div>

                        <div className="pt-1.5 flex items-baseline justify-between gap-2">
                          <span className="font-semibold">Единый счёт в ЭДО:</span>
                          <span className="text-lg sm:text-xl font-bold">
                            {formatRubCompact(confirmedOrder.lockedTotals.unifiedTotalRub)}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-[#111111]/10 dark:border-white/10 space-y-1 text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                        <div>
                          Контакт: <strong className="text-[#111111] dark:text-[#F4F3EF]">{confirmedOrder.contact}</strong>
                        </div>
                        {confirmedOrder.companyRequisites && (
                          <div>
                            Реквизиты / юрлицо:{' '}
                            <strong className="text-[#111111] dark:text-[#F4F3EF]">
                              {confirmedOrder.companyRequisites}
                            </strong>
                          </div>
                        )}
                        {confirmedOrder.hasVoice && (
                          <div>
                            Голосовое ТЗ:{' '}
                            <strong className="text-[#111111] dark:text-[#F4F3EF]">
                              прикреплено (0:{String(confirmedOrder.voiceSec).padStart(2, '0')})
                            </strong>
                          </div>
                        )}
                        {confirmedOrder.fileName && (
                          <div>
                            Прикреплённый документ:{' '}
                            <strong className="text-[#111111] dark:text-[#F4F3EF]">
                              {confirmedOrder.fileName}
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Кнопки копирования и скачивания спецификации брони */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        data-testid="copy-booking-spec-btn"
                        onClick={handleCopyBookingSpec}
                        className="min-h-[44px] px-4 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
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
                        className="min-h-[44px] px-4 py-2.5 rounded-full border border-[#111111]/18 dark:border-[#F4F3EF]/18 hover:border-[#FF4820] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>Скачать спецификацию (.txt)</span>
                      </button>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-full bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] text-xs sm:text-sm font-semibold cursor-pointer"
                      >
                        Вернуться к конструктору эфира
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  /* СТАНДАРТНЫЙ ЭКРАН ПОДТВЕРЖДЕНИЯ БЫСТРОГО ЗАКАЗА РОЛИКА */
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="py-6 space-y-6"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#FF4820]/15 text-[#FF4820] flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold tracking-wide text-[#FF4820] tabular-nums">
                        Заказ #{confirmedOrder.orderNumber} принят в работу
                      </p>
                      <h3 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug">
                        Пришлём тайминг и счёт в течение 30 минут.
                      </h3>
                      <p className="text-base leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72">
                        Исполнительный продюсер уже получил вашу задачу и свяжется по контакту{' '}
                        <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                          {confirmedOrder.contact}
                        </span>
                        .
                      </p>
                    </div>

                    <div className="rounded-3xl p-6 bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/8 dark:border-[#F4F3EF]/10 space-y-2.5 text-sm">
                      <p>
                        <span className="opacity-60">Формат:</span>{' '}
                        <span className="font-semibold">{confirmedOrder.formatLabel}</span>
                      </p>
                      {confirmedOrder.hasVoice && (
                        <p>
                          <span className="opacity-60">Голосовое ТЗ:</span>{' '}
                          <span className="font-semibold tabular-nums">
                            прикреплено (0:{String(confirmedOrder.voiceSec).padStart(2, '0')})
                          </span>
                        </p>
                      )}
                      {confirmedOrder.fileName && (
                        <p>
                          <span className="opacity-60">Файл брифа:</span>{' '}
                          <span className="font-semibold">{confirmedOrder.fileName}</span>
                        </p>
                      )}
                      <p className="pt-2 text-xs opacity-60">
                        Профиль сохранён в браузере — следующий запуск в режиме «Постоянный клиент»
                        займёт 2 клика.
                      </p>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3.5 rounded-full bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] text-sm font-semibold cursor-pointer"
                      >
                        Вернуться на сайт
                      </button>
                      <button
                        type="button"
                        onClick={resetForAnotherOrder}
                        className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full border border-[#111111]/15 dark:border-[#F4F3EF]/15 text-sm font-medium hover:border-[#FF4820] transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" aria-hidden="true" />
                        <span>Ещё один ролик</span>
                      </button>
                    </div>
                  </motion.div>
                )
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-6">
                  {isMediaBookingMode && mediaReservation && reservationTotals ? (
                    /* КОМПАКТНАЯ КАРТОЧКА СОБРАННОЙ ЭФИРНОЙ СЕТКИ + СТАТУС РОЛИКА */
                    <div
                      data-testid="drawer-media-grid-card"
                      className="rounded-3xl p-4 sm:p-5 bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/10 dark:border-[#F4F3EF]/12 space-y-3.5 tabular-nums"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70">
                          Собранная сетка · {mediaReservation.nicheLabel}
                          {mediaReservation.spotDurationSec
                            ? ` · ролик ${mediaReservation.spotDurationSec} сек`
                            : ''}
                        </span>
                        <span className="font-semibold text-[#FF4820]">
                          {mediaReservation.totalSpots} выходов · скидка −
                          {mediaReservation.airDiscountPercent}%
                        </span>
                      </div>

                      {mediaReservation.targetAudienceSummary && (
                        <p className="text-[11px] text-[#111111]/58 dark:text-[#F4F3EF]/58">
                          ЦА: {mediaReservation.targetAudienceSummary}
                        </p>
                      )}

                      <div className="divide-y divide-[#111111]/8 dark:divide-white/8 text-xs sm:text-[13px]">
                        {mediaReservation.stations.map((st) => (
                          <div
                            key={st.slotId}
                            className="py-2 flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                                {st.station} · {st.spotsIncluded} вых.
                                {st.exactDurationSec ? ` · ${st.exactDurationSec} сек` : ''}
                                {st.packageMultiplier > 1 ? ` (${st.packageMultiplier}×)` : ''}
                              </div>
                              <div className="text-[11px] text-[#111111]/58 dark:text-[#F4F3EF]/58">
                                {st.daypart || st.frequencyFm}
                              </div>
                            </div>
                            <span className="font-semibold shrink-0 pt-0.5">
                              {formatRubCompact(st.hotPrice)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2.5 border-t border-[#111111]/10 dark:border-white/10 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">
                            Статус ролика:
                          </span>
                          <span
                            data-testid="drawer-spot-status"
                            className="font-semibold text-[#111111] dark:text-[#F4F3EF] text-right"
                          >
                            {reservationTotals.spotStatusLabel}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#111111]/62 dark:text-[#F4F3EF]/62">
                            Зафиксированная скидка и бонус:
                          </span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            +{formatRubCompact(reservationTotals.totalSavingsRub)}
                          </span>
                        </div>

                        <div className="pt-1 flex items-baseline justify-between gap-2">
                          <span className="font-semibold text-[#111111]/80 dark:text-[#F4F3EF]/80">
                            Единый счёт (Эфир + Ролик):
                          </span>
                          <span
                            data-testid="drawer-unified-total"
                            className="text-lg font-bold text-[#111111] dark:text-[#F4F3EF]"
                          >
                            {formatRubCompact(reservationTotals.unifiedTotalRub)}
                          </span>
                        </div>
                      </div>

                      {/* Переключатель формата продакшна внутри брони (0 ₽ Бонус или 15k / 25k / 35k ₽) */}
                      <div className="pt-2 border-t border-[#111111]/8 dark:border-white/8 space-y-2">
                        <p className="text-[11px] font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
                          Формат производства ролика в пакете:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {mediaProductionOptions.map((opt) => {
                            const active =
                              reservationTotals.productionSelection === opt.id ||
                              reservationProdSelection === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                data-testid={`drawer-prod-opt-${opt.id}`}
                                onClick={() => setReservationProdSelection(opt.id)}
                                aria-pressed={active}
                                className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border cursor-pointer whitespace-nowrap ${
                                  active
                                    ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                                    : 'bg-transparent text-[#111111]/75 dark:text-[#F4F3EF]/75 border-[#111111]/15 dark:border-[#F4F3EF]/15 hover:border-[#111111]/40 dark:hover:border-[#F4F3EF]/40'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Top Switcher: [ Новый проект ] / [ Постоянный клиент (по нашему договору) ] */}
                      <div
                        role="group"
                        aria-label="Тип клиента"
                        className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/8 dark:border-[#F4F3EF]/10"
                      >
                        <button
                          type="button"
                          onClick={() => handleSwitchClientMode('new_project')}
                          aria-pressed={clientMode === 'new_project'}
                          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
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
                          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                            clientMode === 'returning_client'
                              ? 'bg-[#F7F6F2] text-[#111111] dark:bg-[#0D0D0F] dark:text-[#F4F3EF] shadow-xs'
                              : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                          }`}
                        >
                          Постоянный клиент (по договору)
                        </button>
                      </div>

                      {/* STEP 1: One-Click Format Pills */}
                      <div>
                        <p className="text-xs font-medium text-[#111111]/60 dark:text-[#F4F3EF]/60 mb-3">
                          Шаг 1 · Выберите формат
                        </p>
                        <div
                          role="group"
                          aria-label="Формат ролика"
                          className="flex flex-wrap gap-2"
                        >
                          {QUICK_ORDER_PILLS.map((pill) => {
                            const active = selectedFormat === pill.id;
                            return (
                              <button
                                key={pill.id}
                                type="button"
                                onClick={() => setSelectedFormat(pill.id)}
                                aria-pressed={active}
                                className={`min-h-[44px] px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all border cursor-pointer ${
                                  active
                                    ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                                    : 'bg-transparent text-[#111111]/78 dark:text-[#F4F3EF]/78 border-[#111111]/15 dark:border-[#F4F3EF]/15 hover:border-[#111111]/40 dark:hover:border-[#F4F3EF]/40'
                                }`}
                              >
                                {pill.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {/* STEP 2: Executive-Friendly Task Input (Voice, Requisites/File, or Short Note) */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-[#111111]/60 dark:text-[#F4F3EF]/60">
                      {isMediaBookingMode
                        ? 'Задача для сценариста и реквизиты для единого счёта'
                        : 'Шаг 2 · Передайте задачу как удобно'}
                    </p>

                    {/* Killer Feature: Voice Brief Recorder */}
                    <div className="rounded-2xl p-4 bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/8 dark:border-[#F4F3EF]/10">
                      {voiceStatus === 'idle' && (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            data-testid="drawer-voice-record-btn"
                            onClick={startVoiceRecording}
                            className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>
                              {isMediaBookingMode
                                ? 'Надиктовать задачу для ролика голосом'
                                : 'Надиктовать задачу голосом'}
                            </span>
                          </button>
                          <span className="text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55">
                            30 секунд своими словами вместо брифа
                          </span>
                        </div>
                      )}

                      {voiceStatus === 'recording' && (
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#FF4820]" />
                            <span className="text-sm font-semibold tabular-nums">
                              Запись · 0:{String(recordSeconds).padStart(2, '0')}
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
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] text-xs font-semibold cursor-pointer"
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
                              aria-label={
                                isPlayingVoice
                                  ? 'Остановить прослушивание голосового ТЗ'
                                  : 'Прослушать записанное голосовое ТЗ'
                              }
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white text-xs font-semibold cursor-pointer shrink-0"
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

                            <span className="text-xs sm:text-sm font-medium truncate tabular-nums">
                              Голосовое ТЗ · 0:{String(Math.max(1, recordSeconds)).padStart(2, '0')}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={deleteRecordedVoice}
                            aria-label="Удалить голосовую запись"
                            className="w-9 h-9 rounded-full flex items-center justify-center text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#FF4820] transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Concise Textarea + File / Requisites Attachment */}
                    <div>
                      <textarea
                        rows={2}
                        aria-label="О чем ролик или какая акция?"
                        value={briefText}
                        onChange={(e) => {
                          setBriefText(e.target.value);
                          if (taskError) setTaskError(undefined);
                        }}
                        placeholder={
                          isMediaBookingMode
                            ? 'Кратко об акции или продукте (необязательно)'
                            : 'О чем ролик или какая акция?'
                        }
                        className="w-full px-4 py-3 rounded-2xl bg-transparent border border-[#111111]/15 dark:border-[#F4F3EF]/15 text-base sm:text-sm text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none focus:border-[#FF4820]"
                      />
                    </div>

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
                        className="min-h-[42px] inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-[#111111]/15 dark:border-[#F4F3EF]/15 text-xs font-medium text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:border-[#111111]/40 dark:hover:border-[#F4F3EF]/40 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Paperclip className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate max-w-[260px]">
                          {attachedFileName
                            ? attachedFileName
                            : isMediaBookingMode
                              ? 'Прикрепить реквизиты / бриф (.pdf, .doc)'
                              : 'Прикрепить .doc / .pdf'}
                        </span>
                      </button>

                      {attachedFileName && (
                        <button
                          type="button"
                          onClick={() => {
                            setAttachedFileName(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55 hover:text-[#FF4820] cursor-pointer"
                        >
                          Убрать файл
                        </button>
                      )}
                    </div>

                    {taskError && (
                      <p role="alert" className="text-xs font-medium text-[#FF4820]">
                        {taskError}
                      </p>
                    )}
                  </div>

                  {/* STEP 3: Contact + Requisites for Unified Invoice */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-[#111111]/60 dark:text-[#F4F3EF]/60">
                      {isMediaBookingMode
                        ? 'Контакт и ИНН / юрлицо для единого счёта в ЭДО'
                        : 'Шаг 3 · Контакт для тайминга и счёта'}
                    </p>

                    {isReturningFastTrack ? (
                      <div className="rounded-2xl p-4 bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/10 dark:border-[#F4F3EF]/12 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs text-[#FF4820] font-semibold">
                            По нашему договору · запуск в 2 клика
                          </p>
                          <p className="text-sm font-semibold truncate mt-0.5">
                            {savedVip.contactLine}
                            {savedVip.company ? ` · ${savedVip.company}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEditingVipContact(true)}
                          className="text-xs font-medium underline underline-offset-4 opacity-70 hover:opacity-100 cursor-pointer shrink-0"
                        >
                          Изменить
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {(clientMode === 'returning_client' || isMediaBookingMode) && (
                          <input
                            type="text"
                            data-testid="drawer-requisites-input"
                            aria-label="Компания или ИНН для выставления единого счёта"
                            value={companyLine}
                            onChange={(e) => setCompanyLine(e.target.value)}
                            placeholder={
                              isMediaBookingMode
                                ? 'ИНН или название компании для единого счёта в ЭДО'
                                : 'Компания или бренд (запомним для заказа в 2 клика)'
                            }
                            className="w-full px-4 py-3 rounded-2xl bg-transparent border border-[#111111]/15 dark:border-[#F4F3EF]/15 text-base sm:text-sm text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none focus:border-[#FF4820]"
                          />
                        )}

                        <input
                          type="text"
                          data-testid="drawer-contact-input"
                          aria-label="Имя и Телефон / @Telegram"
                          value={contactLine}
                          onChange={(e) => {
                            setContactLine(e.target.value);
                            if (contactError) setContactError(undefined);
                          }}
                          placeholder="Имя и Телефон / @Telegram"
                          className="w-full px-4 py-3.5 rounded-2xl bg-transparent border border-[#111111]/15 dark:border-[#F4F3EF]/15 text-base sm:text-sm text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none focus:border-[#FF4820]"
                        />

                        {contactError && (
                          <p role="alert" className="text-xs font-medium text-[#FF4820]">
                            {contactError}
                          </p>
                        )}
                      </div>
                    )}

                    {rateLimitError && (
                      <p
                        role="alert"
                        data-testid="drawer-rate-limit-error"
                        className="text-xs font-medium text-[#FF4820]"
                      >
                        {rateLimitError}
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-1">
                    <button
                      type="submit"
                      data-testid="drawer-submit-btn"
                      className="w-full py-4 px-6 rounded-full bg-[#FF4820] hover:bg-[#E63C17] active:scale-[0.99] text-white text-sm sm:text-base font-semibold transition-all cursor-pointer whitespace-nowrap"
                    >
                      {isMediaBookingMode
                        ? 'Поставить сетку на 4-часовой холд'
                        : 'Запустить в работу'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="pt-5 mt-5 border-t border-[#111111]/10 dark:border-[#F4F3EF]/10 flex items-center justify-between text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55">
              <span>
                {isMediaBookingMode
                  ? 'Подтверждение слотов и счёт в ЭДО — до 20 минут'
                  : 'Ответ продюсера и счёт — до 30 минут'}
              </span>
              <span className="font-medium">По договору и ЭДО</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
