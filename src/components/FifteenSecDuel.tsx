import { ArrowRightLeft, Car, Pause, Play } from 'lucide-react';
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { casePlayerEngine } from '../audio/casePlayerEngine';
import { contrastAudioEngine } from '../audio/contrastAudioEngine';
import {
  duelAudioStore,
  DuelStoreSnapshot,
  DuelTrackKind,
} from '../audio/duelAudioStore';
import { useStudioCms } from '../cms/StudioCmsContext';
import {
  AUDIOWORKS_WAV_URL,
  formatAudioTime,
} from '../data/audioworksCommercial';
import { DuelCmsSpotSpec } from '../data/studioCmsTypes';

export function FifteenSecDuel() {
  const { snapshot } = useStudioCms();
  const duelCfg = snapshot.duel;
  const [duelSnap, setDuelSnap] = useState<DuelStoreSnapshot>(() =>
    duelAudioStore.getSnapshot()
  );
  const [playingSide, setPlayingSide] = useState<DuelTrackKind | null>(null);
  const [isSequentialCompare, setIsSequentialCompare] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [roadNoiseOn, setRoadNoiseOn] = useState<boolean>(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState<boolean>(false);

  const pairInputRef = useRef<HTMLInputElement | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const roadGainRef = useRef<GainNode | null>(null);
  const roadSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const chainTimeoutRef = useRef<number | null>(null);
  const startedAtMsRef = useRef<number>(0);
  const clipStartOffsetRef = useRef<number>(0);
  const maxDurationRef = useRef<number>(15);
  const sequentialModeRef = useRef<boolean>(false);

  useEffect(() => {
    return duelAudioStore.subscribe(setDuelSnap);
  }, []);

  const stopDuelPlayback = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (chainTimeoutRef.current !== null) {
      window.clearTimeout(chainTimeoutRef.current);
      chainTimeoutRef.current = null;
    }
    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
      htmlAudioRef.current = null;
    }
    if (roadSourceRef.current) {
      try {
        roadSourceRef.current.stop();
        roadSourceRef.current.disconnect();
      } catch {
        // Ignore
      }
      roadSourceRef.current = null;
    }
    sequentialModeRef.current = false;
    setIsSequentialCompare(false);
    setPlayingSide(null);
    setElapsedSec(0);
  };

  useEffect(() => {
    const unsubHero = contrastAudioEngine.onBeforeStart(() => {
      stopDuelPlayback();
    });
    const unsubCases = casePlayerEngine.subscribe((snap) => {
      if (snap.isPlaying) {
        stopDuelPlayback();
      }
    });
    return () => {
      unsubHero();
      unsubCases();
      stopDuelPlayback();
    };
  }, []);

  const syncCabinNoise = (shouldPlay: boolean) => {
    if (typeof window === 'undefined') return;
    if (!shouldPlay) {
      if (roadSourceRef.current) {
        try {
          roadSourceRef.current.stop();
          roadSourceRef.current.disconnect();
        } catch {
          // Ignore
        }
        roadSourceRef.current = null;
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (!roadGainRef.current) {
      roadGainRef.current = ctx.createGain();
      roadGainRef.current.gain.value = 0.16;
      roadGainRef.current.connect(ctx.destination);
    }

    if (!roadSourceRef.current) {
      const length = ctx.sampleRate * 3;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.985 * b0 + white * 0.09;
        b1 = 0.95 * b1 + b0 * 0.25;
        data[i] = b1 * 0.9;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 210;

      src.connect(lp);
      lp.connect(roadGainRef.current);
      src.start();
      roadSourceRef.current = src;
    }
  };

  useEffect(() => {
    syncCabinNoise(roadNoiseOn && playingSide !== null);
  }, [roadNoiseOn, playingSide]);

  const launchSideInternal = (side: DuelTrackKind, chainNextToAudioWorks: boolean) => {
    contrastAudioEngine.stopAll();
    casePlayerEngine.stop();

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (chainTimeoutRef.current !== null) {
      window.clearTimeout(chainTimeoutRef.current);
      chainTimeoutRef.current = null;
    }
    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
      htmlAudioRef.current = null;
    }

    sequentialModeRef.current = chainNextToAudioWorks;
    setIsSequentialCompare(chainNextToAudioWorks);

    const latestSnap = duelAudioStore.getSnapshot();
    const customMeta =
      side === 'radio' ? latestSnap.radioTrack : latestSnap.audioworksTrack;
    const cmsSpot = side === 'radio' ? duelCfg.radioSpot : duelCfg.audioworksSpot;

    const srcUrl = customMeta
      ? customMeta.objectUrl
      : cmsSpot.audioUrl || AUDIOWORKS_WAV_URL;
    const startOffset =
      customMeta || cmsSpot.audioUrl ? 0 : side === 'radio' ? 0 : 15.5;
    const durationLimit = customMeta
      ? customMeta.effectiveDurationSec
      : cmsSpot.durationSec;

    clipStartOffsetRef.current = startOffset;
    maxDurationRef.current = durationLimit;
    startedAtMsRef.current = performance.now();

    setPlayingSide(side);
    setElapsedSec(0);

    if (typeof window === 'undefined') return;

    const audio = new Audio(srcUrl);
    audio.preload = 'auto';
    audio.volume = 1.0;
    htmlAudioRef.current = audio;

    const handleSideComplete = () => {
      if (side === 'radio' && sequentialModeRef.current) {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (htmlAudioRef.current) {
          htmlAudioRef.current.pause();
          htmlAudioRef.current = null;
        }
        chainTimeoutRef.current = window.setTimeout(() => {
          launchSideInternal('audioworks', false);
        }, 450);
        return;
      }
      stopDuelPlayback();
    };

    const launch = () => {
      if (htmlAudioRef.current !== audio) return;
      if (startOffset > 0) {
        try {
          audio.currentTime = startOffset;
        } catch {
          // Ignore seek before metadata
        }
      }
      audio.play().catch(() => {});
    };

    if (audio.readyState >= 1) {
      launch();
    } else {
      audio.addEventListener('loadedmetadata', launch, { once: true });
      audio.load();
    }

    audio.addEventListener('ended', handleSideComplete);
    syncCabinNoise(roadNoiseOn);

    timerRef.current = window.setInterval(() => {
      const currentAudio = htmlAudioRef.current;
      const rawElapsed =
        currentAudio &&
        !currentAudio.paused &&
        currentAudio.currentTime >= clipStartOffsetRef.current
          ? currentAudio.currentTime - clipStartOffsetRef.current
          : (performance.now() - startedAtMsRef.current) / 1000;

      if (rawElapsed >= maxDurationRef.current) {
        handleSideComplete();
        return;
      }
      setElapsedSec(Math.max(0, rawElapsed));
    }, 85);
  };

  const toggleSide = (side: DuelTrackKind) => {
    if (playingSide === side) {
      stopDuelPlayback();
      return;
    }
    launchSideInternal(side, false);
  };

  const toggleSequentialAbCompare = () => {
    if (playingSide !== null) {
      stopDuelPlayback();
      return;
    }
    launchSideInternal('radio', true);
  };

  const handlePairFilesSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await duelAudioStore.attachPairOrList(files);
    e.target.value = '';
  };

  const handleDrop = async (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDraggingFiles(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await duelAudioStore.attachPairOrList(e.dataTransfer.files);
    }
  };

  const renderWaveformStrip = (side: DuelTrackKind, progressRatio: number, isActive: boolean) => {
    const isRadio = side === 'radio';

    return (
      <div
        aria-hidden="true"
        className={`h-1 w-full rounded-full overflow-hidden ${
          isRadio
            ? 'bg-[#111111]/12 dark:bg-white/14'
            : 'bg-white/16'
        }`}
      >
        <div
          style={{ transform: `scaleX(${isActive ? Math.max(0.02, progressRatio) : 0})` }}
          className={`h-full w-full origin-left transition-transform duration-100 ${
            isRadio ? 'bg-[#111111] dark:bg-white' : 'bg-[#FF4820]'
          }`}
        />
      </div>
    );
  };

  const renderHalfPane = (side: DuelTrackKind, spec: DuelCmsSpotSpec) => {
    const isRadio = side === 'radio';
    const isActive = playingSide === side;
    const attachedMeta = isRadio ? duelSnap.radioTrack : duelSnap.audioworksTrack;
    const totalSec = attachedMeta
      ? Math.round(attachedMeta.effectiveDurationSec)
      : spec.durationSec;
    const progressRatio = isActive
      ? Math.min(1, Math.max(0, elapsedSec / Math.max(1, totalSec)))
      : 0;

    return (
      <div
        data-testid={`duel-card-${side}`}
        className={`relative p-6 sm:p-9 lg:p-11 flex flex-col justify-between gap-8 ${
          isRadio
            ? 'lg:col-span-5 bg-[#EFECE5] dark:bg-[#15151A] text-[#111111] dark:text-[#F4F3EF]'
            : 'lg:col-span-7 bg-[#121216] text-[#F4F3EF] border-t lg:border-t-0 lg:border-l border-[#111111]/10 dark:border-white/10'
        }`}
      >
        {/* Чистая текстовая мета-строка без цветных капсул-стикеров */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 text-xs sm:text-sm font-medium tabular-nums">
            <span
              className={
                isRadio
                  ? 'text-[#111111]/58 dark:text-[#F4F3EF]/58'
                  : 'text-[#FF4820] font-semibold'
              }
            >
              {spec.badge || (isRadio ? 'Обычный ролик «под радио»' : 'Наш пример · AudioWorks')}
            </span>
            <span
              className={
                isRadio
                  ? 'text-[#111111]/50 dark:text-[#F4F3EF]/50'
                  : 'text-white/65'
              }
            >
              {formatAudioTime(totalSec)}
            </span>
          </div>

          <div className="space-y-2">
            <h3
              className={`text-xl sm:text-2xl font-bold tracking-tight leading-snug editorial-balance ${
                isRadio ? 'text-[#111111] dark:text-[#F4F3EF]' : 'text-white'
              }`}
            >
              {spec.title}
            </h3>
            <p
              className={`text-xs sm:text-sm leading-relaxed ${
                isRadio
                  ? 'text-[#111111]/58 dark:text-[#F4F3EF]/58'
                  : 'text-white/62'
              }`}
            >
              {spec.metricsLine}
            </p>
          </div>
        </div>

        {/* Кнопка воспроизведения + лаконичная динамика */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => toggleSide(side)}
            className={`min-h-[46px] px-5 py-2.5 rounded-full inline-flex items-center gap-2.5 text-xs sm:text-sm font-semibold tracking-tight transition-colors cursor-pointer whitespace-nowrap ${
              isRadio
                ? isActive
                  ? 'bg-[#111111] text-white dark:bg-white dark:text-[#111111]'
                  : 'bg-[#F7F6F2] hover:bg-white text-[#111111] border border-[#111111]/12'
                : 'bg-[#FF4820] hover:bg-[#E63D18] text-white'
            }`}
          >
            {isActive ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                <span className="tabular-nums">
                  Пауза · {formatAudioTime(elapsedSec)} / {formatAudioTime(totalSec)}
                </span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                <span>
                  {isRadio ? 'Слушать обычный ролик' : 'Слушать наш пример'}
                </span>
              </>
            )}
          </button>

          {renderWaveformStrip(side, progressRatio, isActive)}
        </div>

        {/* Текст сценария без вложенных рамок («card-within-card»), разделённый тонкой линией */}
        <div
          className={`pt-6 border-t space-y-4 ${
            isRadio
              ? 'border-[#111111]/10 dark:border-white/10'
              : 'border-white/12'
          }`}
        >
          <p className="text-[15px] sm:text-[17px] leading-relaxed font-medium">
            {spec.phrases.map((phrase, idx) => {
              const isPhraseNow =
                isActive &&
                elapsedSec >= phrase.startSec &&
                elapsedSec < phrase.endSec;

              let phraseClass = '';
              if (isPhraseNow) {
                phraseClass = isRadio
                  ? 'bg-[#111111] text-white dark:bg-white dark:text-[#111111] px-1.5 py-0.5 rounded transition-colors'
                  : 'bg-[#FF4820] text-white px-1.5 py-0.5 rounded transition-colors';
              } else if (!isRadio && phrase.isAccent) {
                phraseClass = 'text-white font-semibold';
              } else {
                phraseClass = isRadio
                  ? 'text-[#111111]/74 dark:text-[#F4F3EF]/74'
                  : 'text-white/78';
              }

              return (
                <span key={`${spec.id}-p-${idx}`}>
                  <span className={phraseClass}>{phrase.text}</span>{' '}
                </span>
              );
            })}
          </p>

          <p
            className={`text-xs sm:text-sm leading-relaxed editorial-pretty ${
              isRadio
                ? 'text-[#111111]/58 dark:text-[#F4F3EF]/58'
                : 'text-white/68'
            }`}
          >
            {spec.verdict}
          </p>
        </div>
      </div>
    );
  };

  return (
    <section
      id="duel"
      aria-labelledby="duel-heading"
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDraggingFiles) setIsDraggingFiles(true);
      }}
      onDragLeave={() => setIsDraggingFiles(false)}
      onDrop={handleDrop}
      className="scroll-mt-20 py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-12 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10"
    >
      <input
        ref={pairInputRef}
        type="file"
        multiple
        accept=".wav,.mp3,audio/wav,audio/mpeg,audio/*"
        onChange={handlePairFilesSelected}
        tabIndex={-1}
        aria-hidden="true"
        data-testid="duel-pair-file-input"
        className="hidden"
      />

      <div className="max-w-7xl mx-auto space-y-10">
        <div className="space-y-3 max-w-3xl">
          <p className="text-sm font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
            {duelCfg.sectionEyebrow} · {duelCfg.clientName}
          </p>
          <h2
            id="duel-heading"
            className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
          >
            {duelCfg.headingPrimary}{' '}
            <span className="text-[#111111]/42 dark:text-[#F4F3EF]/42">
              {duelCfg.headingMuted}
            </span>
          </h2>
          <p className="text-base sm:text-lg text-[#111111]/68 dark:text-[#F4F3EF]/68 editorial-pretty">
            {duelCfg.briefSummary}
          </p>
        </div>

        {/* Единое окно прямого A/B-сравнения */}
        <div
          data-testid="unified-duel-window"
          className={`rounded-3xl overflow-hidden border transition-colors ${
            isDraggingFiles
              ? 'border-[#FF4820]'
              : 'border-[#111111]/10 dark:border-white/12'
          } bg-[#F7F6F2] dark:bg-[#141418]`}
        >
          <div className="px-6 sm:px-9 lg:px-11 py-4 border-b border-[#111111]/8 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs sm:text-sm font-medium text-[#111111]/65 dark:text-[#F4F3EF]/65">
              Прямое A/B-сравнение в одном окне
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleSequentialAbCompare}
                className={`min-h-[40px] px-4 py-2 rounded-full inline-flex items-center gap-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isSequentialCompare && playingSide !== null
                    ? 'bg-[#FF4820] text-white'
                    : 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] hover:opacity-90'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {isSequentialCompare && playingSide !== null
                    ? 'Остановить сравнение'
                    : 'Сравнить подряд'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRoadNoiseOn((prev) => !prev)}
                aria-pressed={roadNoiseOn}
                className={`min-h-[40px] px-4 py-2 rounded-full inline-flex items-center gap-2 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  roadNoiseOn
                    ? 'bg-[#FF4820]/14 text-[#FF4820] border-[#FF4820]'
                    : 'bg-transparent text-[#111111]/75 dark:text-[#F4F3EF]/75 border-[#111111]/14 dark:border-white/16 hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                <Car className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Шум дороги</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            {renderHalfPane('radio', duelCfg.radioSpot)}
            {renderHalfPane('audioworks', duelCfg.audioworksSpot)}
          </div>
        </div>
      </div>
    </section>
  );
}
