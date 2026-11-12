import {
  CheckCircle2,
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
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
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
import { useLayaDecision } from '../engine/LayaContext';

interface QuickOrderDrawerProps {
  isOpen: boolean;
  initialFormat: OrderFormatId | null;
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
  onClose,
}: QuickOrderDrawerProps) {
  const { decision } = useLayaDecision();

  const [clientMode, setClientMode] = useState<ClientMode>('new_project');
  const [savedVip, setSavedVip] = useState<SavedVipProfile | null>(() =>
    readSavedVipProfile()
  );
  const [isEditingVipContact, setIsEditingVipContact] = useState(false);

  const [selectedFormat, setSelectedFormat] = useState<OrderFormatId>(
    initialFormat ?? decision.recommendedTier
  );
  const [briefText, setBriefText] = useState('');
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [contactLine, setContactLine] = useState('');
  const [companyLine, setCompanyLine] = useState('');

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
  const [confirmedOrder, setConfirmedOrder] = useState<{
    orderNumber: string;
    formatLabel: string;
    contact: string;
    hasVoice: boolean;
    voiceSec: number;
    fileName: string | null;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const htmlPlayerRef = useRef<HTMLAudioElement | null>(null);
  const simPlaybackTimerRef = useRef<number | null>(null);

  // Sync preselected format & VIP mode whenever drawer opens
  useEffect(() => {
    if (!isOpen) return;
    setConfirmedOrder(null);
    setContactError(undefined);
    setTaskError(undefined);
    setSelectedFormat(initialFormat ?? decision.recommendedTier);
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
  }, [isOpen, initialFormat, decision.recommendedTier, decision.choice]);

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

    const effectiveContact = isReturningFastTrack
      ? savedVip.contactLine
      : contactLine.trim();

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

    setConfirmedOrder({
      orderNumber: generateOrderNumber(),
      formatLabel: chosenPill.label,
      contact: effectiveContact,
      hasVoice: voiceStatus === 'recorded' || voiceStatus === 'recording',
      voiceSec: Math.max(4, recordSeconds),
      fileName: attachedFileName,
    });
  };

  const resetForAnotherOrder = () => {
    setConfirmedOrder(null);
    setBriefText('');
    setAttachedFileName(null);
    deleteRecordedVoice();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#111111]/48 dark:bg-black/68"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-order-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl h-full bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111] dark:text-[#F4F3EF] border-l border-[#111111]/10 dark:border-[#F4F3EF]/12 p-6 sm:p-10 flex flex-col justify-between overflow-y-auto subtle-scrollbar overscroll-contain"
          >
            <div>
              {/* Drawer Top Header */}
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55 mb-1.5">
                    Консьерж-сервис AudioWorks
                  </p>
                  <h2
                    id="quick-order-title"
                    className="text-2xl sm:text-3xl font-bold tracking-tight"
                  >
                    Быстрый заказ за 30 секунд
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
                /* BEAUTIFUL CONFIRMATION SCREEN INSIDE DRAWER */
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-6 space-y-6"
                >
                  <div className="w-12 h-12 rounded-full bg-[#FF4820]/15 text-[#FF4820] flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-wide text-[#FF4820] uppercase tabular-nums">
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
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-7">
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

                  {/* STEP 2: Executive-Friendly Task Input (Voice, File, or Short Note) */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-[#111111]/60 dark:text-[#F4F3EF]/60">
                      Шаг 2 · Передайте задачу как удобно
                    </p>

                    {/* Killer Feature: Voice Brief Recorder */}
                    <div className="rounded-2xl p-4 bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/8 dark:border-[#F4F3EF]/10">
                      {voiceStatus === 'idle' && (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={startVoiceRecording}
                            className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                          >
                            <Mic className="w-4 h-4" aria-hidden="true" />
                            <span>Надиктовать задачу голосом</span>
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

                    {/* Concise Textarea + File Attachment */}
                    <div>
                      <textarea
                        rows={2}
                        aria-label="О чем ролик или какая акция?"
                        value={briefText}
                        onChange={(e) => {
                          setBriefText(e.target.value);
                          if (taskError) setTaskError(undefined);
                        }}
                        placeholder="О чем ролик или какая акция?"
                        className="w-full px-4 py-3 rounded-2xl bg-transparent border border-[#111111]/15 dark:border-[#F4F3EF]/15 text-base sm:text-sm text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none focus:border-[#FF4820]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".doc,.docx,.pdf,.txt,.rtf"
                        onChange={handleFileChange}
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-[#111111]/15 dark:border-[#F4F3EF]/15 text-xs font-medium text-[#111111]/75 dark:text-[#F4F3EF]/75 hover:border-[#111111]/40 dark:hover:border-[#F4F3EF]/40 transition-colors cursor-pointer"
                      >
                        <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {attachedFileName ? attachedFileName : 'Прикрепить .doc / .pdf'}
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

                  {/* STEP 3: Single Contact Field (or 2-Click Saved Returning Client Card!) */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-[#111111]/60 dark:text-[#F4F3EF]/60">
                      Шаг 3 · Контакт для тайминга и счёта
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
                        {clientMode === 'returning_client' && (
                          <input
                            type="text"
                            aria-label="Компания или бренд (сохраним для следующих заказов)"
                            value={companyLine}
                            onChange={(e) => setCompanyLine(e.target.value)}
                            placeholder="Компания или бренд (запомним для заказа в 2 клика)"
                            className="w-full px-4 py-3 rounded-2xl bg-transparent border border-[#111111]/15 dark:border-[#F4F3EF]/15 text-base sm:text-sm text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none focus:border-[#FF4820]"
                          />
                        )}

                        <input
                          type="text"
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
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-4 px-6 rounded-full bg-[#FF4820] hover:bg-[#E63C17] active:scale-[0.99] text-white text-base font-semibold transition-all cursor-pointer"
                    >
                      Запустить в работу
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="pt-6 mt-6 border-t border-[#111111]/10 dark:border-[#F4F3EF]/10 flex items-center justify-between text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55">
              <span>Ответ продюсера и счёт — до 30 минут</span>
              <span className="font-medium">По договору и ЭДО</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
