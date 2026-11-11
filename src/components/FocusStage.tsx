import { Car, Pause, Play } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { MouseEvent, useEffect, useState } from 'react';
import {
  contrastAudioEngine,
  ContrastStageSnapshot,
} from '../audio/contrastAudioEngine';
import { formatAudioTime } from '../data/audioworksCommercial';
import { LayaPersonaSlot } from '../engine/layaTypes';

interface FocusStageProps {
  slot: LayaPersonaSlot;
}

const QUICK_MARKERS = [
  { label: '0:00 Поток', sec: 0 },
  { label: '0:06 Почерк', sec: 6.1 },
  { label: '0:15 Вкус', sec: 15.5 },
  { label: '0:37 Статус', sec: 36.9 },
  { label: '0:57 Финал', sec: 56.8 },
] as const;

export function FocusStage({ slot }: FocusStageProps) {
  const [snap, setSnap] = useState<ContrastStageSnapshot>(() =>
    contrastAudioEngine.getSnapshot()
  );

  useEffect(() => {
    const unsubscribe = contrastAudioEngine.subscribe(setSnap);
    return () => {
      unsubscribe();
      contrastAudioEngine.stopAll();
    };
  }, []);

  useEffect(() => {
    contrastAudioEngine.syncPersonaConfig(slot.focusChordPreset, slot.focusWords.length);
  }, [slot.focusChordPreset, slot.focusWords.length]);

  const isStreamView = snap.mode === 'stream';
  const isSilencePhase = snap.mode === 'silence';
  const isFocusView = snap.mode === 'focus';
  const isPlayingAny = snap.isFilmPlaying || snap.isSoundPlaying;

  // Repeat cliché phrases so horizontal marquee tracks flow seamlessly
  const rowOne = [...slot.streamCliches, ...slot.streamCliches];
  const rowTwo = [
    ...slot.streamCliches.slice(2),
    ...slot.streamCliches.slice(0, 2),
    ...slot.streamCliches.slice(2),
    ...slot.streamCliches.slice(0, 2),
  ];
  const rowThree = [
    ...slot.streamCliches.slice(4),
    ...slot.streamCliches.slice(0, 4),
    ...slot.streamCliches.slice(4),
    ...slot.streamCliches.slice(0, 4),
  ];

  const activeWords = snap.activeChapter ? snap.activeChapter.words : slot.focusWords;
  const activeEyebrow = snap.activeChapter ? snap.activeChapter.eyebrow : slot.focusEyebrow;

  const visibleWordLimit =
    isFocusView && snap.revealedWordsCount > 0
      ? Math.min(activeWords.length, snap.revealedWordsCount)
      : activeWords.length;

  const progressPercent = isPlayingAny
    ? Math.min(100, Math.max(2, Math.round((snap.filmElapsedSec / snap.filmDurationSec) * 100)))
    : isFocusView
      ? 100
      : 12;

  const handleTimelineScrub = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    contrastAudioEngine.seekToRatio(ratio);
  };

  return (
    <div className="space-y-4">
      {/* Main ~430px Art-Installation Stage Driven by Real Studio Commercial */}
      <div
        data-testid="focus-stage"
        data-stage-mode={snap.mode}
        className={`relative rounded-3xl min-h-[410px] sm:h-[435px] overflow-hidden flex flex-col justify-between p-5 sm:p-7 transition-colors duration-500 border ${
          isFocusView
            ? `${slot.focusSurfaceClass} text-[#F4F3EF] border-white/12`
            : isSilencePhase
              ? 'bg-[#111113] text-[#F4F3EF] border-white/10'
              : 'bg-[#E6E4DF] dark:bg-[#161619] text-[#111111] dark:text-[#F4F3EF] border-[#111111]/8 dark:border-[#F4F3EF]/10'
        }`}
      >
        {/* Top Control Lens Bar inside Stage */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-3">
          {/* Segmented Lens Switcher */}
          <div
            role="group"
            aria-label="Режим звуковой сцены"
            className={`inline-flex items-center p-1 rounded-full transition-colors ${
              isFocusView || isSilencePhase
                ? 'bg-white/10 border border-white/15'
                : 'bg-[#F7F6F2]/90 dark:bg-[#0D0D0F]/85 border border-[#111111]/10 dark:border-[#F4F3EF]/10'
            }`}
          >
            <button
              type="button"
              onClick={() => contrastAudioEngine.selectLens('stream')}
              aria-pressed={isStreamView}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isStreamView
                  ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-current opacity-75 hover:opacity-100'
              }`}
            >
              Общий поток эфира
            </button>

            <button
              type="button"
              onClick={() => contrastAudioEngine.selectLens('focus')}
              aria-pressed={isFocusView || isSilencePhase}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isFocusView || isSilencePhase
                  ? 'bg-[#FF4820] text-white'
                  : 'text-current opacity-75 hover:opacity-100'
              }`}
            >
              Почерк Audioworks
            </button>
          </div>

          {/* Right Controls: Real 1:19 Studio Commercial + Road Noise Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => contrastAudioEngine.toggleContrastFilm12s()}
              className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isPlayingAny
                  ? 'bg-[#FF4820] text-white'
                  : isFocusView || isSilencePhase
                    ? 'bg-white text-[#111111] hover:bg-white/90'
                    : 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] hover:opacity-90'
              }`}
            >
              {isPlayingAny ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  <span className="tabular-nums">
                    Пауза · {formatAudioTime(snap.filmElapsedSec)} /{' '}
                    {formatAudioTime(snap.filmDurationSec)}
                  </span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  <span>Слушать наш демо-ролик (1:19)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => contrastAudioEngine.toggleRoadNoise()}
              aria-pressed={snap.roadNoiseEnabled}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-medium transition-colors border cursor-pointer whitespace-nowrap ${
                snap.roadNoiseEnabled
                  ? 'bg-[#FF4820]/18 border-[#FF4820] text-[#FF4820] dark:text-[#FF6A4A]'
                  : isFocusView || isSilencePhase
                    ? 'bg-white/8 border-white/15 text-white/80 hover:text-white'
                    : 'bg-[#F7F6F2]/80 dark:bg-[#0D0D0F]/75 border-[#111111]/12 dark:border-[#F4F3EF]/15 text-[#111111]/75 dark:text-[#F4F3EF]/75 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
              }`}
            >
              <Car className="w-4 h-4" aria-hidden="true" />
              <span>Шум дороги</span>
            </button>
          </div>
        </div>

        {/* Center Visual Canvas */}
        <div className="relative z-10 my-auto py-6 flex items-center justify-center min-h-[225px]">
          <AnimatePresence mode="wait">
            {/* STATE 1: ОБЩИЙ ПОТОК ЭФИРА (Monotonous Blurred Clichés + 0:00–0:06 Audio) */}
            {isStreamView && (
              <motion.div
                key={`stream-${slot.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full space-y-5 select-none overflow-hidden"
              >
                <div className="flex whitespace-nowrap gap-10 animate-stream-left blur-[2px] opacity-45 text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight">
                  {rowOne.map((phrase, idx) => (
                    <span key={`r1-${idx}`}>{phrase}</span>
                  ))}
                </div>

                <div className="flex whitespace-nowrap gap-10 animate-stream-right blur-[1.5px] opacity-55 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                  {rowTwo.map((phrase, idx) => (
                    <span key={`r2-${idx}`}>{phrase}</span>
                  ))}
                </div>

                <div className="flex whitespace-nowrap gap-10 animate-stream-left-slow blur-[2.5px] opacity-40 text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight">
                  {rowThree.map((phrase, idx) => (
                    <span key={`r3-${idx}`}>{phrase}</span>
                  ))}
                </div>

                <p className="pt-2 text-center text-xs sm:text-sm font-medium text-[#111111]/62 dark:text-[#F4F3EF]/62">
                  {isPlayingAny
                    ? 'Звучит 0:00–0:06: «Динамично развивающаяся компания предлагает уникальные условия и гибкие скидки...»'
                    : 'Сплошной рекламный блок · нажмите «Слушать наш демо-ролик (1:19)», чтобы услышать контраст'}
                </p>
              </motion.div>
            )}

            {/* STATE 2: СТОП. ВЫДОХНИТЕ. (Real Tape-Stop Silence at 0:06) */}
            {isSilencePhase && (
              <motion.div
                key="dramatic-silence"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col items-center justify-center text-center space-y-3"
              >
                <div className="w-12 h-0.5 bg-[#FF4820] rounded-full" />
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Стоп. Выдохните.
                </p>
                <p className="text-xs font-medium text-white/65">
                  Акустическая пауза · внимание слушателя полностью ваше
                </p>
              </motion.div>
            )}

            {/* STATE 3: ПОЧЕРК AUDIOWORKS (Live Studio Chapters 0:07–1:19) */}
            {isFocusView && (
              <motion.div
                key={`focus-${snap.activeChapter?.id ?? slot.id}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-4xl mx-auto px-2 sm:px-6 text-center"
              >
                <p className="text-xs sm:text-sm font-medium text-[#FF4820] mb-5">
                  {activeEyebrow}
                </p>

                <div
                  aria-live="polite"
                  className="flex flex-wrap items-baseline justify-center gap-x-3 sm:gap-x-4 gap-y-2 text-2xl sm:text-4xl lg:text-[3.1rem] font-bold tracking-tight leading-[1.08] text-[#F4F3EF]"
                >
                  {activeWords.slice(0, visibleWordLimit).map((word, idx) => (
                    <motion.span
                      key={`${snap.activeChapter?.id ?? slot.id}-word-${idx}-${word}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="inline-block"
                    >
                      {word}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Stage Scene Jumpers & Interactive Scrubber */}
        <div className="relative z-20 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium opacity-75 tabular-nums">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              {QUICK_MARKERS.map((m) => (
                <button
                  key={m.label}
                  type="button"
                  onClick={() =>
                    contrastAudioEngine.seekToRatio(m.sec / Math.max(1, snap.filmDurationSec))
                  }
                  className="hover:text-[#FF4820] transition-colors cursor-pointer"
                >
                  {m.label}
                </button>
              ))}
            </div>

            <span className="hidden md:inline">
              {snap.roadNoiseEnabled ? 'Фон автомобиля включён' : 'Оригинальный ролик Audioworks'}
            </span>
          </div>

          <button
            type="button"
            aria-label="Перемотать демо-ролик Audioworks"
            onClick={handleTimelineScrub}
            className="block w-full py-1 cursor-pointer group"
          >
            <progress
              value={progressPercent}
              max={100}
              className={`block h-1.5 w-full rounded-full overflow-hidden appearance-none ${
                isFocusView || isSilencePhase
                  ? '[&::-webkit-progress-bar]:bg-white/15'
                  : '[&::-webkit-progress-bar]:bg-[#111111]/12 dark:[&::-webkit-progress-bar]:bg-[#F4F3EF]/15'
              } [&::-webkit-progress-value]:bg-[#FF4820] [&::-webkit-progress-value]:transition-all [&::-moz-progress-bar]:bg-[#FF4820]`}
            />
          </button>
        </div>
      </div>

      {/* Calm Single-Line Caption Beneath the Stage */}
      <p className="text-center text-sm sm:text-base font-medium text-[#111111]/65 dark:text-[#F4F3EF]/65 tracking-tight">
        Когда вокруг говорят одинаково — выигрывает тот, кто звучит иначе.
      </p>
    </div>
  );
}
