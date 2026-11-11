import { Pause, Play, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { CasePlayerSnapshot } from '../audio/casePlayerEngine';
import { formatAudioTime } from '../data/audioworksCommercial';
import {
  BrandCasePoster,
  FLAGSHIP_STUDIO_REEL,
  getOrderedCasesForPersona,
} from '../data/casesData';
import { useLayaDecision } from '../engine/LayaContext';

interface SelectedWorksSectionProps {
  playerSnap: CasePlayerSnapshot;
  onToggleCase: (item: BrandCasePoster) => void;
}

function getWaveBarHeightClass(level: number): string {
  if (level >= 0.78) return 'h-6';
  if (level >= 0.6) return 'h-5';
  if (level >= 0.44) return 'h-3.5';
  if (level >= 0.28) return 'h-2.5';
  return 'h-1.5';
}

export function SelectedWorksSection({
  playerSnap,
  onToggleCase,
}: SelectedWorksSectionProps) {
  const { decision } = useLayaDecision();
  const orderedCases = getOrderedCasesForPersona(decision.choice);
  const isReelPlaying =
    playerSnap.isPlaying && playerSnap.activeCase?.id === FLAGSHIP_STUDIO_REEL.id;

  return (
    <section
      id="work"
      aria-labelledby="work-heading"
      className="scroll-mt-20 py-24 lg:py-36 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Spacious Magazine Header */}
        <div className="max-w-3xl mb-12 lg:mb-16">
          <h2
            id="work-heading"
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] mb-4"
          >
            Наши работы
          </h2>
          <p className="text-lg sm:text-xl text-[#111111]/68 dark:text-[#F4F3EF]/68 editorial-pretty">
            Как звучат бренды, когда за дело берется продакшн.
          </p>
        </div>

        {/* Featured Audioworks Own Commercial (1:19 Full Studio Recording) */}
        <div
          data-testid="flagship-studio-reel"
          className="mb-8 lg:mb-10 rounded-3xl p-6 sm:p-9 lg:p-10 bg-[#141417] text-[#F4F3EF] border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
        >
          <div className="space-y-2 max-w-2xl">
            <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#FF4820]">
              <Volume2 className="w-4 h-4" aria-hidden="true" />
              <span>{FLAGSHIP_STUDIO_REEL.tag}</span>
            </p>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-white editorial-balance">
              {FLAGSHIP_STUDIO_REEL.headline}
            </h3>
            <p className="text-sm sm:text-base text-white/70 leading-relaxed editorial-pretty">
              {FLAGSHIP_STUDIO_REEL.summary}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => onToggleCase(FLAGSHIP_STUDIO_REEL)}
              aria-label={
                isReelPlaying
                  ? 'Остановить промо-ролик Audioworks'
                  : 'Слушать промо-ролик Audioworks целиком (1:19)'
              }
              className={`inline-flex items-center gap-3.5 pr-6 pl-2 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isReelPlaying
                  ? 'bg-[#FF4820] text-white'
                  : 'bg-white text-[#111111] hover:bg-white/92 active:scale-[0.99]'
              }`}
            >
              <span
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isReelPlaying ? 'bg-black/20 text-white' : 'bg-[#FF4820] text-white'
                }`}
              >
                {isReelPlaying ? (
                  <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" aria-hidden="true" />
                )}
              </span>
              <span>
                {isReelPlaying ? 'Звучит промо-ролик' : 'Слушать нашу рекламу'}
              </span>
            </button>

            <span className="text-xs sm:text-sm font-medium text-white/65 tabular-nums">
              {isReelPlaying
                ? `${formatAudioTime(playerSnap.currentTimeSec)} / ${formatAudioTime(
                    FLAGSHIP_STUDIO_REEL.durationSec
                  )}`
                : formatAudioTime(FLAGSHIP_STUDIO_REEL.durationSec)}
            </span>
          </div>
        </div>

        {/* Koto Studio Poster Grid: 1 Full-Width Flagship Cover + 2 Large Posters Beneath */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {orderedCases.map((item, index) => {
            const isFlagshipWide = index === 0;
            const isThisPlaying =
              playerSnap.isPlaying && playerSnap.activeCase?.id === item.id;

            return (
              <motion.article
                layout
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                key={item.id}
                data-testid={`case-poster-${index}`}
                data-case-id={item.id}
                className={`relative overflow-hidden rounded-3xl ${item.posterGradientClass} text-[#F4F3EF] border border-white/10 flex flex-col justify-between ${
                  isFlagshipWide
                    ? 'lg:col-span-2 min-h-[420px] lg:min-h-[450px] p-8 sm:p-12 lg:p-14'
                    : 'lg:col-span-1 min-h-[410px] lg:min-h-[440px] p-8 sm:p-10 lg:p-12'
                }`}
              >
                {/* Soft Atmospheric Poster Glow */}
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute -right-20 -top-20 w-96 h-96 rounded-full blur-3xl transition-opacity duration-500 ${item.posterGlowClass} ${
                    isThisPlaying ? 'opacity-100' : 'opacity-55'
                  }`}
                />

                {/* Top Row: Clean Editorial Tag & Client Name */}
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                  <p className="text-xs sm:text-sm font-medium text-white/75">
                    {item.tag}
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-white/60">
                    {item.client}
                  </p>
                </div>

                {/* Center Magazine Cover Content: Quote-Image + Bold Headline + 2-Line Essence */}
                <div
                  className={`relative z-10 my-10 ${
                    isFlagshipWide
                      ? 'grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end'
                      : 'space-y-5'
                  }`}
                >
                  <div className={isFlagshipWide ? 'lg:col-span-7 space-y-5' : 'space-y-4'}>
                    <p className="text-sm sm:text-base font-medium italic text-white/75 editorial-pretty">
                      {item.quoteImage}
                    </p>

                    <h3
                      className={`font-bold tracking-tight leading-[1.06] text-white editorial-balance ${
                        isFlagshipWide
                          ? 'text-3xl sm:text-4xl lg:text-5xl'
                          : 'text-2xl sm:text-3xl lg:text-[2.15rem]'
                      }`}
                    >
                      {item.headline}
                    </h3>
                  </div>

                  <div className={isFlagshipWide ? 'lg:col-span-5' : ''}>
                    <p className="text-base sm:text-lg leading-relaxed text-white/78 editorial-pretty">
                      {item.summary}
                    </p>
                  </div>
                </div>

                {/* Bottom Row: Tactile Play Trigger + Live Sound Wave Animation */}
                <div className="relative z-10 pt-6 border-t border-white/12 flex items-center justify-between gap-6">
                  <button
                    type="button"
                    onClick={() => onToggleCase(item)}
                    aria-label={
                      isThisPlaying
                        ? `Остановить кейс «${item.client}»`
                        : `Слушать кейс «${item.client}»`
                    }
                    className={`inline-flex items-center gap-3.5 pr-6 pl-2 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      isThisPlaying
                        ? 'bg-[#FF4820] text-white'
                        : 'bg-white text-[#111111] hover:bg-white/92 active:scale-[0.99]'
                    }`}
                  >
                    <span
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        isThisPlaying ? 'bg-black/20 text-white' : 'bg-[#FF4820] text-white'
                      }`}
                    >
                      {isThisPlaying ? (
                        <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" aria-hidden="true" />
                      )}
                    </span>
                    <span>{isThisPlaying ? 'Звучит в эфире' : 'Слушать ролик'}</span>
                  </button>

                  {/* Live Acoustic Animation Bars + Duration */}
                  <div className="flex items-center gap-4">
                    <div aria-hidden="true" className="flex items-end gap-1 h-7">
                      {(isThisPlaying ? playerSnap.waveBars : [0.28, 0.5, 0.35, 0.65, 0.3]).map(
                        (barHeight, idx) => (
                          <span
                            key={idx}
                            className={`w-1 rounded-full transition-all duration-100 ${
                              isThisPlaying ? 'bg-[#FF4820]' : 'bg-white/30'
                            } ${getWaveBarHeightClass(barHeight)}`}
                          />
                        )
                      )}
                    </div>

                    <span className="text-xs sm:text-sm font-medium text-white/65 tabular-nums">
                      {isThisPlaying
                        ? `${formatAudioTime(playerSnap.currentTimeSec)} / ${formatAudioTime(
                            item.durationSec
                          )}`
                        : formatAudioTime(item.durationSec)}
                    </span>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
