import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Car,
  CheckCircle2,
  FastForward,
  FileAudio,
  MessageSquareText,
  Pause,
  Play,
  Scale,
  Shuffle,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type BroadcastAircheckSnapshot,
  lazyBroadcastAircheckEngine as broadcastAircheckEngine,
} from '../audio/lazyAudioEngines';
import { formatAudioTime } from '../data/audioworksCommercial';
import {
  BroadcastSourceMode,
  buildAircheckAuditBriefSummary,
  buildWaveformPhaseMarkers,
  getCompetitorsAfterTargetCount,
  getCompetitorsBeforeTargetCount,
  getTargetSpotPresetSpec,
  TARGET_SPOT_PRESETS,
  VERIFIED_LIVE_REGIONAL_STATIONS,
  VerifiedRegionalStationSpec,
} from '../data/broadcastAircheckData';
import { orderDraftStore } from '../data/orderDraftStore';
import { generateOrderNumber, OrderFormatId } from '../data/pricingData';
import {
  validateCompanyOrInnField,
  validateHumanLeadContact,
} from '../security/leadShield';
import { useLeadShieldForm } from '../security/useLeadShieldForm';
import { PersonalDataConsentField } from './legal/PersonalDataConsentField';
import { WaveformTimeline } from './WaveformTimeline';

interface RealRadioBroadcastBenchProps {
  onStartStudioOrder: (formatId?: OrderFormatId | null) => void;
}

const SOURCE_MODE_OPTIONS: readonly {
  id: BroadcastSourceMode;
  label: string;
  shortLabel: string;
}[] = [
  {
    id: 'captured_regional_host',
    label: 'Ведущие 91.0 FM',
    shortLabel: '91.0 FM',
  },
  {
    id: 'captured_story_program',
    label: 'История в эфире',
    shortLabel: 'История',
  },
  {
    id: 'live_regional_stream',
    label: 'Live-поток',
    shortLabel: 'Live',
  },
];

export function RealRadioBroadcastBench({
  onStartStudioOrder,
}: RealRadioBroadcastBenchProps) {
  const [snap, setSnap] = useState<BroadcastAircheckSnapshot>(() =>
    broadcastAircheckEngine.getSnapshot()
  );
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isLeadDrawerOpen, setIsLeadDrawerOpen] = useState(false);

  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [pdnConsentAccepted, setPdnConsentAccepted] = useState(false);

  const [nameError, setNameError] = useState<string | undefined>();
  const [contactError, setContactError] = useState<string | undefined>();
  const [companyError, setCompanyError] = useState<string | undefined>();
  const [consentError, setConsentError] = useState<string | undefined>();
  const [submitBannerError, setSubmitBannerError] = useState<string | undefined>();
  const [submittedLead, setSubmittedLead] = useState<{
    orderNumber: string;
    promisedWindowLabel?: string;
    fileName: string | null;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const contactInputRef = useRef<HTMLInputElement | null>(null);
  const companyInputRef = useRef<HTMLInputElement | null>(null);
  const consentInputRef = useRef<HTMLInputElement | null>(null);

  const formUid = useId();

  const {
    websiteTrap,
    setWebsiteTrap,
    isSubmittingLead,
    rateLimitCountdownSec,
    registerPointerActivity,
    registerKeyActivity,
    registerFocusActivity,
    submitProtectedLead,
  } = useLeadShieldForm('production_only');

  useEffect(() => {
    const unsubscribe = broadcastAircheckEngine.subscribe(setSnap);
    return () => {
      unsubscribe();
      broadcastAircheckEngine.stop();
    };
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSubmittedLead(null);
      void broadcastAircheckEngine.loadClientAudioFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSubmittedLead(null);
      void broadcastAircheckEngine.loadClientAudioFile(file);
    }
  };

  const handleSelectClientUpload = () => {
    if (!snap.clientAudioUrl) {
      fileInputRef.current?.click();
      return;
    }
    broadcastAircheckEngine.setSpotMode('client_upload');
  };

  const scrollToAndFocus = (el: HTMLElement | null) => {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      el.focus({ preventScroll: true });
    }, 120);
  };

  const openLeadDrawerAndFocus = () => {
    setIsLeadDrawerOpen(true);
    window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 80);
  };

  const handleLeadSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitBannerError(undefined);

    const trimmedName = clientName.trim();
    const trimmedContact = clientContact.trim();
    const trimmedCompany = clientCompany.trim();

    let nextNameErr: string | undefined;
    let nextContactErr: string | undefined;
    let nextCompanyErr: string | undefined;

    const letterCount = (trimmedName.match(/[a-zA-Zа-яА-ЯёЁ]/g) ?? []).length;
    if (!trimmedName || letterCount < 2) {
      nextNameErr = 'Укажите имя (от 2 букв)';
    }

    if (!trimmedContact) {
      nextContactErr = 'Укажите телефон или @Telegram';
    } else if (!websiteTrap.trim()) {
      const checkContact = validateHumanLeadContact(
        `${trimmedName || 'Клиент'} · ${trimmedContact}`,
        { isReturningFastTrack: false }
      );
      if (!checkContact.valid && !checkContact.isLikelyBotGarbage) {
        nextContactErr =
          checkContact.error ?? 'Проверьте корректность телефона или @Telegram';
      }
    }

    if (trimmedCompany && !websiteTrap.trim()) {
      const checkCompany = validateCompanyOrInnField(trimmedCompany);
      if (!checkCompany.valid) {
        nextCompanyErr = checkCompany.error ?? 'Проверьте название компании или ИНН';
      }
    }

    setNameError(nextNameErr);
    setContactError(nextContactErr);
    setCompanyError(nextCompanyErr);

    const nextConsentErr = !pdnConsentAccepted
      ? 'Подтвердите согласие на обработку персональных данных согласно 152-ФЗ.'
      : undefined;
    setConsentError(nextConsentErr);

    if (nextNameErr || nextContactErr || nextCompanyErr || nextConsentErr) {
      if (nextNameErr) {
        scrollToAndFocus(nameInputRef.current);
      } else if (nextContactErr) {
        scrollToAndFocus(contactInputRef.current);
      } else if (nextCompanyErr) {
        scrollToAndFocus(companyInputRef.current);
      } else if (nextConsentErr) {
        scrollToAndFocus(consentInputRef.current);
      }
      return;
    }

    const combinedContactLine = `${trimmedName} · ${trimmedContact}`;
    const auditBrief = buildAircheckAuditBriefSummary({
      clientName: trimmedName,
      sourceMode: snap.sourceMode,
      targetSlotIndex: snap.targetSlotIndex,
      diagnostic: snap.uploadedDiagnostic,
    });

    const candidateOrderNum = generateOrderNumber();
    const result = await submitProtectedLead({
      source: 'quick_order_drawer',
      checkoutMode: 'production_only',
      paymentChannel: 'edo_invoice',
      orderNumberCandidate: candidateOrderNum,
      formatLabel: snap.uploadedDiagnostic
        ? 'Разбор ролика в реальном радиоэфире'
        : 'Пример в реальном эфире · Консультация',
      totalBudgetRub: 0,
      contactLine: combinedContactLine,
      companyLine: trimmedCompany,
      callbackPreference: 'call_15m',
      briefText: auditBrief,
      hasVoiceRecording: false,
      voiceDurationSec: 0,
      hasAttachedFile: Boolean(snap.clientFileName),
      attachedFileName: snap.clientFileName,
      mediaPlanSnapshot: null,
      isReturningFastTrack: false,
      requireBriefOrVoice: true,
      pdnConsentAccepted: true,
    });

    if (!result.ok) {
      if (result.contactError) {
        setContactError(result.contactError);
        scrollToAndFocus(contactInputRef.current);
      }
      if (result.companyError) {
        setCompanyError(result.companyError);
        if (!result.contactError) {
          scrollToAndFocus(companyInputRef.current);
        }
      }
      if (result.rateLimitError || result.taskError) {
        setSubmitBannerError(result.rateLimitError ?? result.taskError);
      }
      return;
    }

    orderDraftStore.updateDraft({
      contactLine: combinedContactLine,
      companyName: trimmedCompany,
      briefText: auditBrief,
      spotDurationSec: snap.uploadedDiagnostic?.nearestStandardSec ?? 15,
    });

    setSubmittedLead({
      orderNumber: result.orderNumber,
      promisedWindowLabel: result.promisedWindowLabel,
      fileName: snap.clientFileName,
    });
  };

  const handleProceedToFullOrder = () => {
    const trimmedName = clientName.trim();
    const trimmedContact = clientContact.trim();
    const auditBrief = buildAircheckAuditBriefSummary({
      clientName: trimmedName || 'Клиент со стенда эфира',
      sourceMode: snap.sourceMode,
      targetSlotIndex: snap.targetSlotIndex,
      diagnostic: snap.uploadedDiagnostic,
    });

    if (trimmedName && trimmedContact) {
      orderDraftStore.updateDraft({
        contactLine: `${trimmedName} · ${trimmedContact}`,
        companyName: clientCompany.trim(),
      });
    }

    orderDraftStore.prepareProductionOrder({
      formatId: 'turnkey',
      spotDurationSec: snap.uploadedDiagnostic?.nearestStandardSec ?? 15,
      briefHint: auditBrief,
      returnPath: '/',
    });
    onStartStudioOrder('turnkey');
  };

  const activeSegment =
    snap.segments.find((s) => s.id === snap.activeSegmentId) ?? snap.segments[0];
  const targetSegment =
    snap.segments.find((s) => s.isTargetSlot) ?? snap.segments[2] ?? snap.segments[0];

  const competitorsBeforeCount = getCompetitorsBeforeTargetCount(snap.segments);
  const competitorsAfterCount = getCompetitorsAfterTargetCount(snap.segments);
  const activePreset = getTargetSpotPresetSpec(snap.targetPresetId);

  const phaseMarkers = useMemo(
    () =>
      buildWaveformPhaseMarkers(
        snap.segments,
        snap.activeSegmentId,
        snap.spotMode,
        snap.targetPresetId
      ),
    [snap.segments, snap.activeSegmentId, snap.spotMode, snap.targetPresetId]
  );

  const desktopMarkerFlexWeights = useMemo(() => {
    const raw = phaseMarkers.map((m) => {
      if (m.id === 'phase_program') {
        return Math.min(22.5, Math.max(15.5, m.widthPercent * 0.76));
      }
      if (m.id === 'phase_splice') {
        return Math.max(8.2, m.widthPercent);
      }
      if (m.id === 'phase_target') {
        return Math.max(17.5, m.widthPercent);
      }
      if (m.id === 'phase_return') {
        return Math.max(14.8, m.widthPercent);
      }
      return Math.max(12.5, m.widthPercent * 0.88);
    });
    const sum = raw.reduce((acc, v) => acc + v, 0) || 100;
    return raw.map((v) => (v / sum) * 100);
  }, [phaseMarkers]);

  const activeStation =
    VERIFIED_LIVE_REGIONAL_STATIONS.find((s) => s.id === snap.selectedStationId) ??
    VERIFIED_LIVE_REGIONAL_STATIONS[0];

  const liveMomentHint = useMemo(() => {
    if (snap.elapsedSec < targetSegment.startSec) {
      const secLeft = Math.max(1, Math.ceil(targetSegment.startSec - snap.elapsedSec));
      return `До вашего выхода ${formatAudioTime(secLeft)}`;
    }
    if (snap.activeSegmentId === 'target_spot') {
      return competitorsAfterCount > 0
        ? `Слот №${snap.targetSlotIndex} · следом ещё ${competitorsAfterCount} объявл.`
        : 'Финальный слот №5 перед возвратом ведущих';
    }
    if (snap.activeSegmentId.startsWith('competitor_after')) {
      return 'Соседние объявления после вашего слота';
    }
    return 'Возврат станции к передаче';
  }, [
    snap.elapsedSec,
    snap.activeSegmentId,
    snap.targetSlotIndex,
    targetSegment.startSec,
    competitorsAfterCount,
  ]);

  const slotSurroundSummary =
    snap.targetSlotIndex === 1
      ? 'первый слот сразу после склейки, следом 4 рекламы'
      : snap.targetSlotIndex === 5
        ? 'финальный слот после 4 реклам перед возвратом эфира'
        : `до вас ${competitorsBeforeCount} рол., после — ещё ${competitorsAfterCount}`;

  const activeWaveformSeed = `${snap.sourceMode}-${snap.spotMode}-${snap.targetPresetId}-slot${snap.targetSlotIndex}-${snap.clientFileName ?? 'ref'}`;

  const spectrumBands = useMemo(() => {
    if (!snap.isPlaying) return undefined;
    return Array.from({ length: 36 }, (_, idx) => {
      const phase = snap.elapsedSec * 7.1 + idx * 0.52;
      const isTarget = snap.activeSegmentId === 'target_spot';
      const base = isTarget ? 0.34 : 0.27;
      const swing = isTarget ? 0.54 : 0.44;
      return Math.min(
        0.95,
        Math.max(
          0.12,
          base +
            swing *
              (0.5 + 0.5 * Math.sin(phase)) *
              (0.6 + 0.4 * Math.cos(idx * 0.37 - snap.elapsedSec * 4.0))
        )
      );
    });
  }, [snap.isPlaying, snap.elapsedSec, snap.activeSegmentId]);

  return (
    <section
      id="broadcast-aircheck"
      data-testid="real-radio-broadcast-bench"
      aria-labelledby="broadcast-aircheck-heading"
      onPointerMove={registerPointerActivity}
      onKeyDown={registerKeyActivity}
      onFocusCapture={registerFocusActivity}
      className="scroll-mt-20 pb-14 sm:pb-20 px-4 sm:px-6 lg:px-12"
    >
      <div className="max-w-7xl mx-auto space-y-3.5 sm:space-y-4">
        {/* Компактная однорядная шапка модуля */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 border-t border-[#111111]/10 dark:border-white/10 pt-8 sm:pt-10">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium text-[#111111]/56 dark:text-[#F4F3EF]/56 tabular-nums">
              Реальный радиоэфир · Блок {formatAudioTime(snap.totalDurationSec)} · Слот №
              {snap.targetSlotIndex} ({slotSurroundSummary})
            </p>
            <h2
              id="broadcast-aircheck-heading"
              className="text-xl sm:text-2xl lg:text-[1.75rem] font-bold tracking-tight leading-[1.14] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
            >
              Проверьте ролик внутри полного регионального эфира и рекламной склейки
            </h2>
          </div>

          {/* Сегментный выбор радиоконтекста */}
          <div
            role="group"
            aria-label="Выбор радиоэфира перед рекламным блоком"
            className="grid grid-cols-3 w-full sm:w-auto sm:flex items-center gap-1 p-1 rounded-xl bg-[#111111]/[0.05] dark:bg-white/[0.06] border border-[#111111]/10 dark:border-white/10 self-start lg:self-auto max-w-full"
          >
            {SOURCE_MODE_OPTIONS.map((opt) => {
              const active = snap.sourceMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`aircheck-source-${opt.id}`}
                  aria-pressed={active}
                  onClick={() => broadcastAircheckEngine.setSourceMode(opt.id)}
                  className={`min-h-[44px] lg:min-h-[38px] px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap text-center ${
                    active
                      ? 'bg-[#121216] text-white dark:bg-white dark:text-[#111111]'
                      : 'text-[#111111]/70 dark:text-white/70 hover:text-[#111111] dark:hover:text-white'
                  }`}
                >
                  <span className="sm:hidden">{opt.shortLabel}</span>
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Единая минималистичная студийная полоса со звуковой волной */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!isDraggingOver) setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDrop}
          className={`rounded-2xl sm:rounded-3xl bg-[#121216] text-[#F4F3EF] p-4 sm:px-6 sm:py-5 border transition-colors space-y-3 min-w-0 ${
            isDraggingOver ? 'border-[#FF4820]' : 'border-white/10'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.m4a,.ogg,.aac,audio/*"
            data-testid="aircheck-client-upload-input"
            aria-label="Загрузить свой аудиоролик для проверки в радиоэфире"
            onChange={handleFileChange}
            className="sr-only"
          />

          {/* Выбор станции прямого вещания (показывается только в режиме Live) */}
          {snap.sourceMode === 'live_regional_stream' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/10 min-w-0">
              <label
                htmlFor={`${formUid}-station-select`}
                className="text-xs text-white/68 shrink-0"
              >
                Волна прямого эфира:
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 max-w-xl min-w-0">
                <select
                  id={`${formUid}-station-select`}
                  data-testid="aircheck-live-station-select"
                  value={snap.selectedStationId}
                  onChange={(e) =>
                    broadcastAircheckEngine.setSelectedStation(
                      e.target.value as VerifiedRegionalStationSpec['id']
                    )
                  }
                  className="w-full min-w-0 min-h-[44px] sm:min-h-[38px] px-3 py-1.5 rounded-xl bg-white/[0.07] border border-white/14 text-xs font-medium text-white focus:outline-none focus:border-[#FF4820]"
                >
                  {VERIFIED_LIVE_REGIONAL_STATIONS.map((st) => (
                    <option key={st.id} value={st.id} className="bg-[#141418] text-white">
                      {st.title} · {st.frequencyBadge}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-white/62 tabular-nums whitespace-nowrap shrink-0">
                  {snap.liveStreamStatus === 'live_air'
                    ? 'Поток подключён'
                    : snap.liveStreamStatus === 'connecting'
                      ? 'Подключение…'
                      : snap.liveStreamStatus === 'fallback_aircheck'
                        ? 'Запись эфира'
                        : activeStation.frequencyBadge}
                </span>
              </div>
            </div>
          )}

          {/* Пропорциональные кликабельные метки этапов прямо вдоль звуковой волны */}
          <div className="space-y-1.5 min-w-0">
            {/* Десктопная пропорциональная линейка этапов */}
            <div
              role="group"
              aria-label="Этапы реального радиоэфира на звуковой волне"
              className="hidden lg:flex items-stretch gap-1 w-full min-w-0"
            >
              {phaseMarkers.map((marker, idx) => {
                const flexPct = desktopMarkerFlexWeights[idx] ?? marker.widthPercent;
                return (
                  <button
                    key={marker.id}
                    type="button"
                    data-testid={`aircheck-phase-${marker.id}`}
                    onClick={() =>
                      broadcastAircheckEngine.playFromSegment(marker.targetSegmentId)
                    }
                    style={{ width: `${flexPct.toFixed(2)}%` }}
                    className={`min-h-[40px] px-2.5 py-1.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between gap-1.5 min-w-0 ${
                      marker.isActive
                        ? marker.isTarget
                          ? 'bg-[#FF4820] border-[#FF4820] text-white'
                          : 'bg-white/14 border-white/35 text-white'
                        : marker.isTarget
                          ? 'bg-[#FF4820]/14 border-[#FF4820]/50 hover:border-[#FF4820] text-white'
                          : 'bg-white/[0.04] border-white/10 hover:border-white/25 text-white/76 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-semibold truncate">
                      {marker.label}
                    </span>
                    {marker.id !== 'phase_program' && marker.id !== 'phase_splice' && (
                      <span
                        className={`text-[11px] tabular-nums shrink-0 ${
                          marker.isActive ? 'text-white/90' : 'text-white/46'
                        }`}
                      >
                        {marker.durationLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Мобильная и планшетная горизонтальная лента фаз без вылета за 320px */}
            <div
              role="group"
              aria-label="Этапы эфира"
              className="flex lg:hidden items-center gap-1.5 overflow-x-auto max-w-full pb-1 min-w-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {phaseMarkers.map((marker) => (
                <button
                  key={marker.id}
                  type="button"
                  onClick={() =>
                    broadcastAircheckEngine.playFromSegment(marker.targetSegmentId)
                  }
                  className={`min-h-[44px] px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer tabular-nums ${
                    marker.isActive
                      ? marker.isTarget
                        ? 'bg-[#FF4820] border-[#FF4820] text-white'
                        : 'bg-white/16 border-white/38 text-white'
                      : marker.isTarget
                        ? 'bg-[#FF4820]/14 border-[#FF4820]/50 text-white'
                        : 'bg-white/[0.04] border-white/10 text-white/76'
                  }`}
                >
                  {marker.shortMobileLabel} · {marker.durationLabel}
                </button>
              ))}
            </div>

            {/* Минималистичная посегментная звуковая дорожка эфирного блока (цвет + амплитуда) */}
            <WaveformTimeline
              segments={snap.segments}
              totalDurationSec={snap.totalDurationSec}
              elapsedSec={snap.elapsedSec}
              activeSegmentId={snap.activeSegmentId}
              spotMode={snap.spotMode}
              targetSlotIndex={snap.targetSlotIndex}
              targetShortLabel={activePreset.shortTitle}
              isPlaying={snap.isPlaying}
              seedKey={activeWaveformSeed}
              onScrubStart={() => void broadcastAircheckEngine.preload()}
              onSeekRatio={(ratio) => broadcastAircheckEngine.seekToRatio(ratio)}
              onSelectSegment={(segmentId) =>
                broadcastAircheckEngine.playFromSegment(segmentId)
              }
              seekAriaLabel="Перемотка реального радиоэфира по секундам"
              spectrumBands={spectrumBands}
              heightClass="h-14"
              visualizerTestId="aircheck-broadcast-waveform"
              progressBarTestId="aircheck-waveform-scrubber"
            />

            {/* Компактная строка живого эфирного статуса (1 линия) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-white/64 tabular-nums min-w-0">
              <p className="truncate">
                <span className="text-white/90 font-medium">
                  {activeSegment.shortStepLabel}:
                </span>{' '}
                <span>{activeSegment.title}</span>
              </p>
              <span className="text-white/52 shrink-0">{liveMomentHint}</span>
            </div>
          </div>

          {/* Строка конфигурации блока: позиция врезки (1–5 + случайная) и выбор кейса / шаблона */}
          <div className="pt-3 border-t border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3 min-w-0">
            {/* Позиция врезки в блоке + рандомизация */}
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-medium text-white/55 mr-0.5 shrink-0">
                Слот в блоке:
              </span>
              <div
                role="group"
                aria-label="Выбор позиции целевого ролика в рекламном блоке от 1 до 5"
                className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-white/[0.05] border border-white/10"
              >
                {([1, 2, 3, 4, 5] as const).map((slotNum) => {
                  const active = snap.targetSlotIndex === slotNum;
                  return (
                    <button
                      key={slotNum}
                      type="button"
                      data-testid={`aircheck-slot-${slotNum}`}
                      aria-label={`Позиция в блоке: слот ${slotNum}`}
                      aria-pressed={active}
                      onClick={() => broadcastAircheckEngine.setTargetSlotIndex(slotNum)}
                      className={`min-h-[44px] sm:min-h-[34px] min-w-[44px] sm:min-w-[36px] px-2 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#FF4820] text-white'
                          : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      №{slotNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                data-testid="aircheck-randomize-slot-btn"
                onClick={() => broadcastAircheckEngine.randomizeTargetSlot()}
                className="min-h-[44px] sm:min-h-[36px] px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/12 text-white/88 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Shuffle className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
                <span>Случайная врезка</span>
              </button>
            </div>

            {/* Выбор ролика в целевом слоте: 3 реальных кейса студии + шаблон + загрузка */}
            <div
              role="group"
              aria-label="Выбор ролика в целевом слоте"
              className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white/[0.05] border border-white/10 min-w-0"
            >
              {TARGET_SPOT_PRESETS.map((preset) => {
                const isCliche = preset.category === 'cliche';
                const active =
                  snap.spotMode !== 'client_upload' &&
                  snap.targetPresetId === preset.id;
                const resolvedTestId =
                  preset.id === 'zerno_craft'
                    ? 'aircheck-spot-fmworks'
                    : isCliche
                      ? 'aircheck-spot-cliche'
                      : `aircheck-preset-${preset.id}`;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={resolvedTestId}
                    aria-pressed={active}
                    onClick={() =>
                      broadcastAircheckEngine.selectTargetPreset(preset.id)
                    }
                    className={`min-h-[44px] sm:min-h-[34px] px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? isCliche
                          ? 'bg-white text-[#111111]'
                          : 'bg-[#FF4820] text-white'
                        : 'text-white/72 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {preset.shortTitle}
                  </button>
                );
              })}

              {snap.clientAudioUrl && (
                <button
                  type="button"
                  data-testid="aircheck-spot-client"
                  aria-pressed={snap.spotMode === 'client_upload'}
                  onClick={handleSelectClientUpload}
                  className={`min-h-[44px] sm:min-h-[34px] px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    snap.spotMode === 'client_upload'
                      ? 'bg-[#FF4820] text-white'
                      : 'text-white/72 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  Ваш ролик
                </button>
              )}
            </div>
          </div>

          {/* Нижняя студийная панель транспорта и действий */}
          <div className="pt-2.5 border-t border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 min-w-0">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 min-w-0">
              <button
                type="button"
                data-testid="aircheck-play-toggle-btn"
                onClick={() => broadcastAircheckEngine.togglePlayPause()}
                className="min-h-[44px] px-4 py-2 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap tabular-nums"
              >
                {snap.isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                    <span>
                      Пауза · {formatAudioTime(snap.elapsedSec)} /{' '}
                      {formatAudioTime(snap.totalDurationSec)}
                    </span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                    <span>
                      Слушать эфир · {formatAudioTime(snap.elapsedSec)} /{' '}
                      {formatAudioTime(snap.totalDurationSec)}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="aircheck-jump-splice-btn"
                onClick={() => broadcastAircheckEngine.jumpToSpliceTransition()}
                className="min-h-[44px] px-3.5 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/14 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <FastForward className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>К склейке рекламы</span>
              </button>

              <button
                type="button"
                data-testid="aircheck-road-noise-btn"
                aria-pressed={snap.roadNoiseEnabled}
                onClick={() => broadcastAircheckEngine.toggleRoadNoise()}
                className={`min-h-[44px] px-3.5 py-2 rounded-full border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  snap.roadNoiseEnabled
                    ? 'bg-[#FF4820]/22 border-[#FF4820] text-white'
                    : 'bg-transparent border-white/14 text-white/74 hover:text-white hover:border-white/30'
                }`}
              >
                <Car className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Шум дороги</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 min-w-0">
              <button
                type="button"
                data-testid="aircheck-upload-trigger-btn"
                disabled={snap.isAnalyzingUpload}
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] px-4 py-2 rounded-full bg-white text-[#111111] hover:bg-[#FF4820] hover:text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {snap.isAnalyzingUpload
                    ? 'Встраиваем…'
                    : snap.clientAudioUrl
                      ? 'Заменить свой ролик'
                      : 'Вставить свой ролик'}
                </span>
              </button>

              <button
                type="button"
                data-testid="aircheck-open-lead-btn"
                aria-expanded={isLeadDrawerOpen || Boolean(submittedLead)}
                onClick={() => setIsLeadDrawerOpen((prev) => !prev)}
                className={`min-h-[44px] px-4 py-2 rounded-full border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  isLeadDrawerOpen || submittedLead
                    ? 'bg-white/16 border-white/40 text-white'
                    : 'bg-transparent border-white/18 text-white/85 hover:text-white hover:border-white/36'
                }`}
              >
                <MessageSquareText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Разбор с продюсером</span>
              </button>
            </div>
          </div>

          {snap.uploadError && (
            <div
              role="alert"
              className="pt-2 border-t border-white/10 text-xs font-medium text-[#F87171] flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{snap.uploadError}</span>
            </div>
          )}
        </div>

        {/* Раскрываемая панель №1: Техническая и юридическая диагностика (ФЗ-38 / ФАС / РАО-ВОИС) */}
        {snap.uploadedDiagnostic && (
          <div
            data-testid="aircheck-uploaded-diagnostic"
            className="rounded-2xl bg-[#EFECE5] dark:bg-[#17171D] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/12 dark:border-white/12 p-4 sm:px-6 sm:py-5 space-y-3.5 min-w-0"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <FileAudio className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
                <span className="text-xs sm:text-sm font-bold truncate max-w-full">
                  Ваш файл в слоте №{snap.uploadedDiagnostic.targetSlotIndex}:{' '}
                  {snap.uploadedDiagnostic.fileName}
                </span>
                <span className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60 tabular-nums shrink-0">
                  · {snap.uploadedDiagnostic.meanRmsDb} дБ · пик{' '}
                  {snap.uploadedDiagnostic.peakDb} dBFS ·{' '}
                  {Math.round(snap.uploadedDiagnostic.sampleRateHz / 1000)} кГц
                </span>
                <span
                  data-testid="aircheck-diagnostic-readiness"
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                    snap.uploadedDiagnostic.overallReadiness === 'critical_issues'
                      ? 'bg-[#DC2626]/12 text-[#B91C1C] dark:text-[#FCA5A5]'
                      : snap.uploadedDiagnostic.overallReadiness === 'needs_tuning'
                        ? 'bg-[#D97706]/14 text-[#B45309] dark:text-[#FCD34D]'
                        : 'bg-[#16A34A]/14 text-[#15803D] dark:text-[#86EFAC]'
                  }`}
                >
                  {snap.uploadedDiagnostic.overallReadiness === 'critical_issues'
                    ? 'Риск отклонения станцией'
                    : snap.uploadedDiagnostic.overallReadiness === 'needs_tuning'
                      ? 'Требует доработки'
                      : 'Готов к эфиру'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                {Math.abs(snap.uploadedDiagnostic.loudnessDeltaVsAirDb) > 1.2 && (
                  <div
                    role="group"
                    aria-label="Режим прослушивания громкости вашего ролика"
                    className="inline-flex items-center p-0.5 rounded-lg bg-[#111111]/[0.07] dark:bg-white/[0.08]"
                  >
                    <button
                      type="button"
                      data-testid="aircheck-gain-raw"
                      aria-pressed={snap.clientGainMode === 'as_uploaded'}
                      onClick={() =>
                        broadcastAircheckEngine.setClientGainMode('as_uploaded')
                      }
                      className={`min-h-[44px] sm:min-h-[32px] px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                        snap.clientGainMode === 'as_uploaded'
                          ? 'bg-[#121216] text-white dark:bg-white dark:text-[#111111]'
                          : 'text-[#111111]/70 dark:text-white/70'
                      }`}
                    >
                      Как загружен
                    </button>
                    <button
                      type="button"
                      data-testid="aircheck-gain-matched"
                      aria-pressed={snap.clientGainMode === 'broadcast_matched'}
                      onClick={() =>
                        broadcastAircheckEngine.setClientGainMode('broadcast_matched')
                      }
                      className={`min-h-[44px] sm:min-h-[32px] px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                        snap.clientGainMode === 'broadcast_matched'
                          ? 'bg-[#FF4820] text-white'
                          : 'text-[#111111]/70 dark:text-white/70'
                      }`}
                    >
                      В балансе эфира
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => broadcastAircheckEngine.jumpToTargetTransition()}
                  className="min-h-[44px] sm:min-h-[36px] text-xs font-semibold text-[#FF4820] hover:underline cursor-pointer whitespace-nowrap"
                >
                  Прослушать стык в блоке
                </button>
                <button
                  type="button"
                  aria-label="Удалить загруженный ролик"
                  onClick={() => broadcastAircheckEngine.clearClientAudio()}
                  className="min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] rounded-full inline-flex items-center justify-center text-[#111111]/58 dark:text-[#F4F3EF]/58 hover:text-[#111111] dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2.5 border-t border-[#111111]/10 dark:border-white/10 text-xs tabular-nums">
              <div className="space-y-0.5 min-w-0">
                <dt className="text-[#111111]/54 dark:text-[#F4F3EF]/54">
                  Сетка станции и громкость
                </dt>
                <dd className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                  {snap.uploadedDiagnostic.timingHumanLabel} ·{' '}
                  {snap.uploadedDiagnostic.loudnessHumanLabel}
                </dd>
              </div>

              <div className="space-y-0.5 min-w-0">
                <dt className="text-[#111111]/54 dark:text-[#F4F3EF]/54">
                  {snap.uploadedDiagnostic.targetSlotIndex === 1
                    ? 'Вход после склейки'
                    : `Вход после соседа №${snap.uploadedDiagnostic.targetSlotIndex - 1}`}
                </dt>
                <dd className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                  {snap.uploadedDiagnostic.introHumanLabel}
                </dd>
              </div>

              <div className="space-y-0.5 min-w-0">
                <dt className="text-[#111111]/54 dark:text-[#F4F3EF]/54">
                  {snap.uploadedDiagnostic.targetSlotIndex === 5
                    ? 'Финал перед возвратом в эфир'
                    : `Финал перед ${5 - snap.uploadedDiagnostic.targetSlotIndex} объявл.`}
                </dt>
                <dd className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                  {snap.uploadedDiagnostic.outroHumanLabel}
                </dd>
              </div>
            </dl>

            {/* Чек-лист технических допусков и юридических требований (ФЗ-38 / ФАС / РАО-ВОИС) */}
            {snap.uploadedDiagnostic.complianceChecklist.length > 0 && (
              <div
                data-testid="aircheck-compliance-checklist"
                className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2.5 border-t border-[#111111]/10 dark:border-white/10"
              >
                {snap.uploadedDiagnostic.complianceChecklist.map((item) => {
                  const isCritical = item.severity === 'critical';
                  const isWarning = item.severity === 'warning';
                  const CategoryIcon =
                    item.category === 'legal' ? Scale : SlidersHorizontal;
                  return (
                    <div
                      key={item.id}
                      data-severity={item.severity}
                      className={`rounded-xl px-3 py-2.5 border text-xs space-y-0.5 min-w-0 ${
                        isCritical
                          ? 'bg-[#DC2626]/[0.07] border-[#DC2626]/28'
                          : isWarning
                            ? 'bg-[#D97706]/[0.07] border-[#D97706]/24'
                            : 'bg-[#111111]/[0.03] dark:bg-white/[0.03] border-[#111111]/10 dark:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[#111111] dark:text-[#F4F3EF] min-w-0 truncate">
                          {isCritical ? (
                            <AlertCircle
                              className="w-3.5 h-3.5 text-[#DC2626] dark:text-[#F87171] shrink-0"
                              aria-hidden="true"
                            />
                          ) : isWarning ? (
                            <AlertTriangle
                              className="w-3.5 h-3.5 text-[#D97706] dark:text-[#FBBF24] shrink-0"
                              aria-hidden="true"
                            />
                          ) : (
                            <CheckCircle2
                              className="w-3.5 h-3.5 text-[#16A34A] dark:text-[#4ADE80] shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <span className="truncate">{item.title}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[#111111]/55 dark:text-white/55 shrink-0">
                          <CategoryIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span>{item.category === 'legal' ? 'Закон' : 'Техника'}</span>
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72">
                        {item.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-[#111111]/10 dark:border-white/10">
              <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 leading-relaxed">
                {snap.uploadedDiagnostic.recommendationSummary}
              </p>

              {!isLeadDrawerOpen && !submittedLead && (
                <button
                  type="button"
                  onClick={openLeadDrawerAndFocus}
                  className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-normal sm:whitespace-nowrap text-center"
                >
                  <span>Получить правки продюсера</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Раскрываемая панель №2: Минималистичная форма связи с продюсером (появляется строго по запросу) */}
        {(isLeadDrawerOpen || submittedLead) && (
          <div
            data-testid="aircheck-lead-capture-card"
            className="rounded-2xl bg-[#EFECE5] dark:bg-[#17171D] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/12 dark:border-white/12 p-4 sm:px-6 sm:py-5 space-y-3.5 min-w-0"
          >
            {submittedLead ? (
              <div
                role="status"
                data-testid="aircheck-lead-success"
                className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <CheckCircle2
                    className="w-5 h-5 text-[#16A34A] dark:text-[#4ADE80] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-bold tabular-nums">
                      Заявка #{submittedLead.orderNumber} передана продюсеру
                    </p>
                    <p className="text-xs text-[#111111]/70 dark:text-[#F4F3EF]/70 leading-relaxed">
                      {submittedLead.fileName
                        ? `Подготовим рекомендации по выделению файла «${submittedLead.fileName}» среди соседних объявлений.`
                        : 'Покажем решения, которые отделяют бренд от 4 соседних объявлений в блоке.'}{' '}
                      {submittedLead.promisedWindowLabel
                        ? `Окно ответа: ${submittedLead.promisedWindowLabel}.`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0">
                  <button
                    type="button"
                    data-testid="aircheck-proceed-order-btn"
                    onClick={handleProceedToFullOrder}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-normal sm:whitespace-nowrap text-center"
                  >
                    <span>Оформить ролик под ключ</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Свернуть панель подтверждения"
                    onClick={() => {
                      setSubmittedLead(null);
                      setIsLeadDrawerOpen(false);
                    }}
                    className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-full border border-[#111111]/16 dark:border-white/16 text-xs font-semibold hover:border-[#FF4820] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Свернуть
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => void handleLeadSubmit(e)}
                noValidate
                className="space-y-3 min-w-0"
              >
                <div aria-hidden="true" className="sr-only relative">
                  <label htmlFor={`${formUid}-website-trap`}>
                    Корпоративный сайт (не заполнять)
                  </label>
                  <input
                    id={`${formUid}-website-trap`}
                    name="company_portal_trap"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={websiteTrap}
                    onChange={(e) => setWebsiteTrap(e.target.value)}
                    className="w-px h-px"
                  />
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <h3 className="text-sm sm:text-base font-bold">
                      {snap.uploadedDiagnostic
                        ? 'Разбор вашего ролика с продюсером FMWorks'
                        : 'Бесплатный разбор ролика или идея сценария под реальный эфир'}
                    </h3>
                    <p className="text-xs text-[#111111]/64 dark:text-[#F4F3EF]/64">
                      Покажем, как отстроиться от 4 конкурентов в рекламной паузе · выпуск от 24–48 ч по тексту · 3–4 дня под ключ
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label="Закрыть форму разбора"
                    onClick={() => setIsLeadDrawerOpen(false)}
                    className="min-h-[40px] min-w-[40px] rounded-full inline-flex items-center justify-center text-[#111111]/55 dark:text-[#F4F3EF]/55 hover:text-[#111111] dark:hover:text-white cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-start min-w-0">
                  <div className="lg:col-span-3 space-y-1 min-w-0">
                    <label
                      htmlFor={`${formUid}-lead-name`}
                      className="block text-xs font-medium text-[#111111]/74 dark:text-[#F4F3EF]/74"
                    >
                      Ваше имя *
                    </label>
                    <input
                      ref={nameInputRef}
                      id={`${formUid}-lead-name`}
                      data-testid="aircheck-lead-name"
                      type="text"
                      value={clientName}
                      aria-invalid={Boolean(nameError)}
                      onChange={(e) => {
                        setClientName(e.target.value);
                        if (nameError) setNameError(undefined);
                      }}
                      placeholder="Алексей"
                      className={`w-full min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#121216] border text-sm text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/36 dark:placeholder:text-white/32 focus:outline-none transition-colors ${
                        nameError
                          ? 'border-[#DC2626] ring-2 ring-[#DC2626]/20'
                          : 'border-[#111111]/14 dark:border-white/14 focus:border-[#FF4820]'
                      }`}
                    />
                    {nameError && (
                      <p
                        role="alert"
                        data-testid="aircheck-lead-name-error"
                        className="text-[11px] font-medium text-[#DC2626] dark:text-[#F87171]"
                      >
                        {nameError}
                      </p>
                    )}
                  </div>

                  <div className="lg:col-span-4 space-y-1 min-w-0">
                    <label
                      htmlFor={`${formUid}-lead-contact`}
                      className="block text-xs font-medium text-[#111111]/74 dark:text-[#F4F3EF]/74"
                    >
                      Телефон или @Telegram *
                    </label>
                    <input
                      ref={contactInputRef}
                      id={`${formUid}-lead-contact`}
                      data-testid="aircheck-lead-contact"
                      type="text"
                      value={clientContact}
                      aria-invalid={Boolean(contactError)}
                      onChange={(e) => {
                        setClientContact(e.target.value);
                        if (contactError) setContactError(undefined);
                      }}
                      placeholder="+7 999 123-45-67 или @ivanov"
                      className={`w-full min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#121216] border text-sm text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/36 dark:placeholder:text-white/32 focus:outline-none transition-colors ${
                        contactError
                          ? 'border-[#DC2626] ring-2 ring-[#DC2626]/20'
                          : 'border-[#111111]/14 dark:border-white/14 focus:border-[#FF4820]'
                      }`}
                    />
                    {contactError && (
                      <p
                        role="alert"
                        data-testid="aircheck-lead-contact-error"
                        className="text-[11px] font-medium text-[#DC2626] dark:text-[#F87171]"
                      >
                        {contactError}
                      </p>
                    )}
                  </div>

                  <div className="lg:col-span-3 space-y-1 min-w-0">
                    <label
                      htmlFor={`${formUid}-lead-company`}
                      className="block text-xs font-medium text-[#111111]/74 dark:text-[#F4F3EF]/74"
                    >
                      Компания (по желанию)
                    </label>
                    <input
                      ref={companyInputRef}
                      id={`${formUid}-lead-company`}
                      data-testid="aircheck-lead-company"
                      type="text"
                      value={clientCompany}
                      aria-invalid={Boolean(companyError)}
                      onChange={(e) => {
                        setClientCompany(e.target.value);
                        if (companyError) setCompanyError(undefined);
                      }}
                      placeholder="Клиника «МедСфера»"
                      className={`w-full min-w-0 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#121216] border text-sm text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/36 dark:placeholder:text-white/32 focus:outline-none transition-colors ${
                        companyError
                          ? 'border-[#DC2626] ring-2 ring-[#DC2626]/20'
                          : 'border-[#111111]/14 dark:border-white/14 focus:border-[#FF4820]'
                      }`}
                    />
                    {companyError && (
                      <p
                        role="alert"
                        className="text-[11px] font-medium text-[#DC2626] dark:text-[#F87171]"
                      >
                        {companyError}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2 lg:col-span-2 lg:pt-[22px]">
                    <button
                      type="submit"
                      data-testid="aircheck-lead-submit-btn"
                      disabled={isSubmittingLead || rateLimitCountdownSec > 0}
                      className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] disabled:opacity-55 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-normal sm:whitespace-nowrap"
                    >
                      <span>
                        {rateLimitCountdownSec > 0
                          ? `Ждите ${rateLimitCountdownSec}с`
                          : isSubmittingLead
                            ? 'Отправка…'
                            : 'Получить разбор'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <PersonalDataConsentField
                  id={`${formUid}-pdn-consent`}
                  inputRef={consentInputRef}
                  checked={pdnConsentAccepted}
                  onChange={(next) => {
                    setPdnConsentAccepted(next);
                    if (consentError) setConsentError(undefined);
                  }}
                  error={consentError}
                  compact
                  testIdPrefix="aircheck-pdn-consent"
                />

                {submitBannerError && (
                  <p
                    role="alert"
                    className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]"
                  >
                    {submitBannerError}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                  <span>Без спама и рассылок · ответит живой продюсер</span>
                  <button
                    type="button"
                    onClick={handleProceedToFullOrder}
                    className="min-h-[36px] inline-flex items-center font-semibold text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer text-left sm:text-right"
                  >
                    Сразу к расчёту заказа →
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
