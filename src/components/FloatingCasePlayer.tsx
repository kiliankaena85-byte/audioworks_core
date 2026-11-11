import { Pause, SkipForward, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { CasePlayerSnapshot } from '../audio/casePlayerEngine';
import { formatAudioTime } from '../data/audioworksCommercial';

interface FloatingCasePlayerProps {
  playerSnap: CasePlayerSnapshot;
  onStop: () => void;
  onNext: () => void;
}

function getCapsuleBarHeightClass(level: number): string {
  if (level >= 0.78) return 'h-4';
  if (level >= 0.58) return 'h-3.5';
  if (level >= 0.42) return 'h-2.5';
  if (level >= 0.28) return 'h-2';
  return 'h-1.5';
}

export function FloatingCasePlayer({
  playerSnap,
  onStop,
  onNext,
}: FloatingCasePlayerProps) {
  const isVisible = playerSnap.isPlaying && playerSnap.activeCase !== null;
  const active = playerSnap.activeCase;
  const progressPercent = Math.min(100, Math.max(0, Math.round(playerSnap.progress * 100)));

  return (
    <AnimatePresence>
      {isVisible && active && (
        <div className="fixed bottom-5 inset-x-0 z-40 px-4 pointer-events-none flex justify-center">
          <motion.aside
            aria-label="Мини-плеер текущего кейса"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto w-full max-w-xl rounded-full bg-[#111111]/95 dark:bg-[#19191E]/95 text-[#F4F3EF] border border-white/12 shadow-2xl px-4 py-2.5 flex items-center justify-between gap-4 relative overflow-hidden"
          >
            {/* Left: Pause Button + Live Wave Bars + Case Info */}
            <div className="flex items-center gap-3.5 min-w-0">
              <button
                type="button"
                onClick={onStop}
                aria-label={`Пауза: ${active.client}`}
                className="w-10 h-10 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              >
                <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
              </button>

              <div aria-hidden="true" className="hidden sm:flex items-end gap-0.5 h-5 shrink-0">
                {playerSnap.waveBars.map((val, idx) => (
                  <span
                    key={idx}
                    className={`w-0.5 bg-[#FF4820] rounded-full transition-all duration-100 ${getCapsuleBarHeightClass(
                      val
                    )}`}
                  />
                ))}
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {active.client}
                </p>
                <p className="text-xs text-white/60 truncate">
                  {active.tag}
                </p>
              </div>
            </div>

            {/* Right: Timecode + Next Case + Close */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-medium text-white/65 tabular-nums mr-1.5">
                {formatAudioTime(playerSnap.currentTimeSec)} /{' '}
                {formatAudioTime(playerSnap.durationSec)}
              </span>

              <button
                type="button"
                onClick={onNext}
                aria-label="Следующий кейс"
                className="w-9 h-9 rounded-full flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onStop}
                aria-label="Закрыть мини-плеер"
                className="w-9 h-9 rounded-full flex items-center justify-center text-white/65 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom Hairline Progress */}
            <progress
              value={progressPercent}
              max={100}
              aria-hidden="true"
              className="absolute bottom-0 inset-x-6 h-0.5 w-[calc(100%-3rem)] appearance-none overflow-hidden [&::-webkit-progress-bar]:bg-white/10 [&::-webkit-progress-value]:bg-[#FF4820] [&::-moz-progress-bar]:bg-[#FF4820]"
            />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
