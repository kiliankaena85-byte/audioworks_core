import { Pause, SkipForward, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef } from 'react';
import type { CasePlayerSnapshot } from '../audio/lazyAudioEngines';
import { formatAudioTime } from '../data/audioworksCommercial';
import { useAudioTrackScrubber } from '../utils/audioScrubbing';
import { PremiumAcousticWaveform } from './PremiumAcousticWaveform';

interface FloatingCasePlayerProps {
  playerSnap: CasePlayerSnapshot;
  onStop: () => void;
  onNext: () => void;
  onSeek?: (ratio: number) => void;
  onWarmCasePlayer?: () => void;
}

export function FloatingCasePlayer({
  playerSnap,
  onStop,
  onNext,
  onSeek,
  onWarmCasePlayer,
}: FloatingCasePlayerProps) {
  const scrubTrackRef = useRef<HTMLDivElement | null>(null);
  const isVisible =
    playerSnap.isPlaying &&
    playerSnap.playbackMode === 'full' &&
    playerSnap.activeCase !== null;
  const active = playerSnap.activeCase;
  const isSeekable = Boolean(onSeek && isVisible && active);

  const { displayRatio, isScrubbing, eventHandlers } = useAudioTrackScrubber({
    trackRef: scrubTrackRef,
    engineRatio: playerSnap.progress,
    isInteractive: isSeekable,
    stepRatio: 0.05,
    onScrubStart: onWarmCasePlayer,
    onCommitRatio: onSeek,
  });

  const progressPercent = Math.min(100, Math.max(0, Math.round(displayRatio * 100)));
  const effectiveTimeSec = isScrubbing
    ? displayRatio * Math.max(1, playerSnap.durationSec)
    : playerSnap.currentTimeSec;

  return (
    <AnimatePresence>
      {isVisible && active && (
        <div className="fixed bottom-3.5 sm:bottom-5 inset-x-0 z-40 px-3 sm:px-4 pointer-events-none flex justify-center">
          <motion.aside
            aria-label="Мини-плеер текущего кейса"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto w-full max-w-xl rounded-3xl sm:rounded-full bg-[#111111]/95 dark:bg-[#19191E]/95 text-[#F4F3EF] border border-white/12 shadow-2xl px-3 sm:px-4 pt-2 pb-3.5 sm:py-2.5 flex items-center justify-between gap-2.5 sm:gap-4 relative overflow-hidden"
          >
            {/* Left: Pause Button + Live Wave Bars + Case Info */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={onStop}
                aria-label={`Пауза: ${active.client}`}
                className="w-11 h-11 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              >
                <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
              </button>

              <div className="hidden sm:block w-16 shrink-0">
                <PremiumAcousticWaveform
                  seedKey={active.id}
                  isActive={true}
                  progressRatio={displayRatio}
                  spectrumBands={playerSnap.spectrumBands}
                  variant="dark-surface"
                  heightClass="h-7"
                  onScrubStart={onWarmCasePlayer}
                  onSeekRatio={onSeek}
                  seekAriaLabel={`Перемотка на волне: ${active.client}`}
                />
              </div>

              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-white truncate">
                  {active.client}
                </p>
                <p className="text-[11px] sm:text-xs text-white/60 truncate tabular-nums">
                  <span className="min-[380px]:hidden text-white/80 font-medium">
                    {formatAudioTime(effectiveTimeSec)} /{' '}
                    {formatAudioTime(playerSnap.durationSec)} ·{' '}
                  </span>
                  {active.tag}
                </p>
              </div>
            </div>

            {/* Right: Timecode + Next Case + Close */}
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <span
                className={`hidden min-[380px]:inline text-[11px] sm:text-xs font-medium tabular-nums mr-1 transition-colors ${
                  isScrubbing ? 'text-[#FF4820]' : 'text-white/65'
                }`}
              >
                {formatAudioTime(effectiveTimeSec)} /{' '}
                {formatAudioTime(playerSnap.durationSec)}
              </span>

              <button
                type="button"
                onClick={onNext}
                aria-label="Следующий кейс"
                className="w-11 h-11 rounded-full flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onStop}
                aria-label="Закрыть мини-плеер"
                className="w-11 h-11 rounded-full flex items-center justify-center text-white/65 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive Touch & Pointer Scrubber Track along bottom edge */}
            <div
              ref={scrubTrackRef}
              data-testid="floating-case-player-scrubber"
              role={isSeekable ? 'slider' : 'progressbar'}
              tabIndex={isSeekable ? 0 : undefined}
              aria-label={`Перемотка: ${active.client}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
              aria-valuetext={`${formatAudioTime(effectiveTimeSec)} из ${formatAudioTime(
                playerSnap.durationSec
              )}`}
              {...eventHandlers}
              className={`absolute bottom-0 inset-x-4 sm:inset-x-6 h-4 flex items-end pb-1 select-none ${
                isSeekable ? 'cursor-pointer touch-none group/scrub' : 'pointer-events-none'
              }`}
            >
              <div className="pointer-events-none relative w-full h-1 sm:h-0.5 group-hover/scrub:h-1 rounded-full bg-white/16 transition-all">
                <div
                  style={{ width: `${displayRatio * 100}%` }}
                  className="h-full rounded-full bg-[#FF4820]"
                />
                {isSeekable && (
                  <div
                    style={{ left: `${displayRatio * 100}%` }}
                    className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-[#FF4820] shadow-sm transition-transform ${
                      isScrubbing ? 'w-3 h-3 scale-110' : 'w-2 h-2 sm:opacity-0 sm:group-hover/scrub:opacity-100'
                    }`}
                  />
                )}
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
