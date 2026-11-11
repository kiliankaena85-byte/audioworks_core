import { Check, Pause, Play, Share2, Volume2 } from 'lucide-react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { PointerEvent as ReactPointerEvent, RefObject, useEffect, useRef, useState } from 'react';
import { CasePlayerSnapshot } from '../audio/casePlayerEngine';
import { formatAudioTime } from '../data/audioworksCommercial';
import {
  BrandCasePoster,
  buildCaseShareUrl,
  CaseId,
  computeCaseHoverOffset,
  FLAGSHIP_STUDIO_REEL,
  getOrderedCasesForPersona,
  readSharedCaseIdFromLocation,
} from '../data/casesData';
import { useLayaDecision } from '../engine/LayaContext';

interface CasesGalleryProps {
  playerSnap: CasePlayerSnapshot;
  onToggleCase: (item: BrandCasePoster) => void;
}

function getWaveBarHeightClass(level: number): string {
  if (level >= 0.78) return 'h-5';
  if (level >= 0.6) return 'h-4';
  if (level >= 0.44) return 'h-3';
  if (level >= 0.28) return 'h-2';
  return 'h-1.5';
}

function copyTextFallback(text: string): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.className = 'sr-only';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

interface CaseDepthMotionOptions {
  scrollRangePx?: number;
  hoverShiftX?: number;
  hoverShiftY?: number;
  restScale?: number;
  hoverScale?: number;
}

/**
 * Хук микро-интеракции и скролл-глубины обложки кейса:
 * сочетает вертикальный параллакс при скролле секции с мягким пружинным откликом на движение курсора.
 */
function useCaseDepthMotion(
  containerRef: RefObject<HTMLElement | null>,
  {
    scrollRangePx = 18,
    hoverShiftX = 10,
    hoverShiftY = 8,
    restScale = 1.05,
    hoverScale = 1.095,
  }: CaseDepthMotionOptions = {}
) {
  const prefersReducedMotion = useReducedMotion();

  const rawHoverX = useMotionValue(0);
  const rawHoverY = useMotionValue(0);
  const rawScale = useMotionValue(restScale);

  const smoothHoverX = useSpring(rawHoverX, {
    stiffness: 240,
    damping: 26,
    mass: 0.45,
  });
  const smoothHoverY = useSpring(rawHoverY, {
    stiffness: 240,
    damping: 26,
    mass: 0.45,
  });
  const smoothScale = useSpring(rawScale, {
    stiffness: 220,
    damping: 28,
    mass: 0.5,
  });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const rawScrollY = useTransform(
    scrollYProgress,
    [0, 1],
    [-scrollRangePx, scrollRangePx]
  );
  const smoothScrollY = useSpring(rawScrollY, {
    stiffness: 160,
    damping: 30,
    mass: 0.4,
  });

  const combinedY = useTransform(
    [smoothHoverY, smoothScrollY],
    ([hy, sy]) => Number(hy) + Number(sy)
  );

  const handlePointerEnter = () => {
    if (prefersReducedMotion) return;
    rawScale.set(hoverScale);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (prefersReducedMotion || e.pointerType === 'touch') return;
    const node = containerRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const offset = computeCaseHoverOffset(
      e.clientX,
      e.clientY,
      rect,
      hoverShiftX,
      hoverShiftY
    );
    rawHoverX.set(offset.x);
    rawHoverY.set(offset.y);
    rawScale.set(hoverScale);
  };

  const handlePointerLeave = () => {
    rawHoverX.set(0);
    rawHoverY.set(0);
    rawScale.set(restScale);
  };

  return {
    imageMotionStyle: prefersReducedMotion
      ? undefined
      : {
          x: smoothHoverX,
          y: combinedY,
          scale: smoothScale,
        },
    handlePointerEnter,
    handlePointerMove,
    handlePointerLeave,
  };
}

interface VinylSoundIndicatorProps {
  isPlaying: boolean;
}

/**
 * Виниловый студийный индикатор звука: плавно вращается и пульсирует во время проигрывания кейса.
 */
function VinylSoundIndicator({ isPlaying }: VinylSoundIndicatorProps) {
  return (
    <div
      data-testid={isPlaying ? 'vinyl-indicator-playing' : 'vinyl-indicator-idle'}
      aria-hidden="true"
      className="relative w-12 h-12 flex items-center justify-center shrink-0"
    >
      {isPlaying && (
        <span className="absolute inset-0 rounded-full border border-[#FF4820]/65 animate-ping opacity-40" />
      )}
      <div
        className={`relative w-11 h-11 rounded-full bg-[#0F0F12] border flex items-center justify-center shadow-lg transition-colors duration-300 ${
          isPlaying
            ? 'border-[#FF4820]/80 animate-[spin_4s_linear_infinite]'
            : 'border-white/22'
        }`}
      >
        <span className="absolute inset-1.5 rounded-full border border-white/12" />
        <span className="absolute inset-2.5 rounded-full border border-white/14" />
        <span className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/40" />
        <span
          className={`relative w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors ${
            isPlaying ? 'bg-[#FF4820]' : 'bg-white/35'
          }`}
        >
          <span className="w-1 h-1 rounded-full bg-[#0F0F12]" />
        </span>
      </div>
    </div>
  );
}

interface ShareCaseButtonProps {
  item: BrandCasePoster;
  isCopied: boolean;
  onShare: (item: BrandCasePoster) => void;
}

function ShareCaseButton({ item, isCopied, onShare }: ShareCaseButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onShare(item)}
      aria-label={`Поделиться кейсом «${item.client}»`}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap backdrop-blur-md border shrink-0 ${
        isCopied
          ? 'bg-white text-[#111111] border-white'
          : 'bg-black/42 hover:bg-black/65 text-white/90 hover:text-white border-white/22'
      }`}
    >
      {isCopied ? (
        <>
          <Check className="w-3.5 h-3.5 text-[#FF4820]" aria-hidden="true" />
          <span>Скопировано</span>
        </>
      ) : (
        <>
          <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Поделиться</span>
        </>
      )}
    </button>
  );
}

interface StudioCommercialStripProps {
  isReelPlaying: boolean;
  isHighlighted: boolean;
  isCopied: boolean;
  currentTimeSec: number;
  onToggleCase: (item: BrandCasePoster) => void;
  onShare: (item: BrandCasePoster) => void;
}

function StudioCommercialStrip({
  isReelPlaying,
  isHighlighted,
  isCopied,
  currentTimeSec,
  onToggleCase,
  onShare,
}: StudioCommercialStripProps) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const {
    imageMotionStyle,
    handlePointerEnter,
    handlePointerMove,
    handlePointerLeave,
  } = useCaseDepthMotion(stripRef, {
    scrollRangePx: 14,
    hoverShiftX: 9,
    hoverShiftY: 6,
    restScale: 1.05,
    hoverScale: 1.085,
  });

  return (
    <div
      ref={stripRef}
      id={`case-${FLAGSHIP_STUDIO_REEL.id}`}
      data-testid="flagship-studio-reel"
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`scroll-mt-24 group relative overflow-hidden mb-8 lg:mb-10 rounded-3xl p-6 sm:p-9 lg:p-10 bg-[#141417] text-[#F4F3EF] border transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-6 ${
        isHighlighted ? 'border-[#FF4820]' : 'border-white/10'
      }`}
    >
      <motion.img
        src={FLAGSHIP_STUDIO_REEL.coverImageUrl}
        alt={FLAGSHIP_STUDIO_REEL.coverImageAlt}
        referrerPolicy="no-referrer"
        decoding="async"
        style={imageMotionStyle}
        className="pointer-events-none absolute -inset-6 w-[calc(100%+3rem)] h-[calc(100%+3rem)] max-w-none object-cover opacity-28 brightness-110 will-change-transform"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#111114]/95 via-[#111114]/88 to-[#111114]/72"
      />

      <div className="relative z-10 space-y-2 max-w-2xl">
        <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#FF4820]">
          <Volume2 className="w-4 h-4" aria-hidden="true" />
          <span>{FLAGSHIP_STUDIO_REEL.tag}</span>
        </p>
        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-white editorial-balance">
          {FLAGSHIP_STUDIO_REEL.headline}
        </h3>
        <p className="text-sm sm:text-base text-white/75 leading-relaxed editorial-pretty">
          {FLAGSHIP_STUDIO_REEL.summary}
        </p>
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
        <VinylSoundIndicator isPlaying={isReelPlaying} />

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
          <span>{isReelPlaying ? 'Звучит промо-ролик' : 'Слушать нашу рекламу'}</span>
        </button>

        <ShareCaseButton
          item={FLAGSHIP_STUDIO_REEL}
          isCopied={isCopied}
          onShare={onShare}
        />

        <span className="text-xs sm:text-sm font-medium text-white/70 tabular-nums">
          {isReelPlaying
            ? `${formatAudioTime(currentTimeSec)} / ${formatAudioTime(
                FLAGSHIP_STUDIO_REEL.durationSec
              )}`
            : formatAudioTime(FLAGSHIP_STUDIO_REEL.durationSec)}
        </span>
      </div>
    </div>
  );
}

interface BrandCaseCardProps {
  item: BrandCasePoster;
  index: number;
  isThisPlaying: boolean;
  isThisHighlighted: boolean;
  isCopied: boolean;
  waveBars: number[];
  currentTimeSec: number;
  onToggleCase: (item: BrandCasePoster) => void;
  onShare: (item: BrandCasePoster) => void;
}

function BrandCaseCard({
  item,
  index,
  isThisPlaying,
  isThisHighlighted,
  isCopied,
  waveBars,
  currentTimeSec,
  onToggleCase,
  onShare,
}: BrandCaseCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const isFlagshipWide = index === 0;

  const {
    imageMotionStyle,
    handlePointerEnter,
    handlePointerMove,
    handlePointerLeave,
  } = useCaseDepthMotion(cardRef, {
    scrollRangePx: 20,
    hoverShiftX: 11,
    hoverShiftY: 9,
    restScale: 1.05,
    hoverScale: 1.095,
  });

  if (isFlagshipWide) {
    return (
      <motion.article
        ref={cardRef}
        layout
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        id={`case-${item.id}`}
        data-testid={`case-poster-${index}`}
        data-case-id={item.id}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={`scroll-mt-24 group lg:col-span-2 relative overflow-hidden rounded-3xl border transition-colors grid grid-cols-1 lg:grid-cols-12 items-stretch min-h-[460px] lg:min-h-[490px] ${
          isThisHighlighted
            ? 'border-[#FF4820]'
            : 'border-[#111111]/10 dark:border-white/10'
        }`}
      >
        {/* Left Half: Warm Brand Editorial Typography */}
        <div
          className={`lg:col-span-6 ${item.editorialSurfaceBg} text-[#F4F3EF] p-8 sm:p-11 lg:p-14 flex flex-col justify-between gap-8`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-white/72">
            <span>{item.tag}</span>
            <span className="text-white/58">{item.client}</span>
          </div>

          <div className="space-y-5 my-auto">
            <p className="text-sm sm:text-base italic text-white/78 editorial-pretty">
              {item.quoteImage}
            </p>

            <h3 className="text-3xl sm:text-4xl lg:text-[2.7rem] font-bold tracking-tight leading-[1.06] text-white editorial-balance">
              {item.headline}
            </h3>

            <p className="text-base sm:text-lg leading-relaxed text-white/78 editorial-pretty">
              {item.summary}
            </p>
          </div>

          <div className="pt-6 border-t border-white/12 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <VinylSoundIndicator isPlaying={isThisPlaying} />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-white/90">
                  {isThisPlaying ? 'Сейчас в эфире' : 'Эфирный мастер-ролик'}
                </p>
                <p className="text-xs text-white/58 tabular-nums">
                  Хронометраж · {formatAudioTime(item.durationSec)}
                </p>
              </div>
            </div>

            <div aria-hidden="true" className="flex items-end gap-1 h-6">
              {(isThisPlaying ? waveBars : [0.28, 0.5, 0.35, 0.65, 0.3]).map(
                (barHeight, idx) => (
                  <span
                    key={idx}
                    className={`w-1 rounded-full transition-all duration-100 ${
                      isThisPlaying ? 'bg-[#FF4820]' : 'bg-white/28'
                    } ${getWaveBarHeightClass(barHeight)}`}
                  />
                )
              )}
            </div>
          </div>
        </div>

        {/* Right Half: Full-Height Atmospheric Photography with Framer Motion Parallax + Frosted Glass Controls */}
        <div
          className={`lg:col-span-6 relative min-h-[320px] lg:min-h-full overflow-hidden ${item.posterGradientClass} flex flex-col justify-end p-6 sm:p-9 lg:p-11`}
        >
          <motion.img
            src={item.coverImageUrl}
            alt={item.coverImageAlt}
            referrerPolicy="no-referrer"
            decoding="async"
            style={imageMotionStyle}
            className="pointer-events-none absolute -inset-7 w-[calc(100%+3.5rem)] h-[calc(100%+3.5rem)] max-w-none object-cover will-change-transform"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/78 via-black/22 to-black/18"
          />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onToggleCase(item)}
                aria-label={
                  isThisPlaying
                    ? `Остановить кейс «${item.client}»`
                    : `Слушать кейс «${item.client}»`
                }
                className={`inline-flex items-center gap-3.5 pr-6 pl-2 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap backdrop-blur-md border ${
                  isThisPlaying
                    ? 'bg-[#FF4820] border-[#FF4820] text-white shadow-[0_10px_30px_rgba(255,72,32,0.4)]'
                    : 'bg-black/48 hover:bg-black/68 border-white/28 text-white active:scale-[0.99]'
                }`}
              >
                <span
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    isThisPlaying ? 'bg-black/22 text-white' : 'bg-[#FF4820] text-white'
                  }`}
                >
                  {isThisPlaying ? (
                    <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" aria-hidden="true" />
                  )}
                </span>
                <span>{isThisPlaying ? 'Звучит в эфире' : 'Слушать эфирный ролик'}</span>
              </button>

              <ShareCaseButton item={item} isCopied={isCopied} onShare={onShare} />
            </div>

            <span className="text-xs sm:text-sm font-semibold text-white/90 tabular-nums drop-shadow-xs">
              {isThisPlaying
                ? `${formatAudioTime(currentTimeSec)} / ${formatAudioTime(item.durationSec)}`
                : formatAudioTime(item.durationSec)}
            </span>
          </div>
        </div>
      </motion.article>
    );
  }

  // Secondary Large Photographic Posters (Index 1 & 2) with Framer Motion Parallax & Scroll Depth
  return (
    <motion.article
      ref={cardRef}
      layout
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      id={`case-${item.id}`}
      data-testid={`case-poster-${index}`}
      data-case-id={item.id}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`scroll-mt-24 group lg:col-span-1 relative overflow-hidden rounded-3xl ${item.posterGradientClass} text-[#F4F3EF] border transition-colors min-h-[460px] lg:min-h-[490px] p-8 sm:p-10 lg:p-11 flex flex-col justify-between ${
        isThisHighlighted
          ? 'border-[#FF4820]'
          : 'border-[#111111]/10 dark:border-white/10'
      }`}
    >
      <motion.img
        src={item.coverImageUrl}
        alt={item.coverImageAlt}
        referrerPolicy="no-referrer"
        decoding="async"
        style={imageMotionStyle}
        className="pointer-events-none absolute -inset-7 w-[calc(100%+3.5rem)] h-[calc(100%+3.5rem)] max-w-none object-cover will-change-transform"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A0C10]/94 via-[#0A0C10]/56 to-[#0A0C10]/38"
      />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs sm:text-sm font-medium text-white/85">{item.tag}</p>
          <p className="text-xs sm:text-sm text-white/68">{item.client}</p>
        </div>

        <VinylSoundIndicator isPlaying={isThisPlaying} />
      </div>

      <div className="relative z-10 mt-auto pt-12 space-y-6">
        <div className="space-y-3.5">
          <p className="text-sm sm:text-base italic text-white/82 editorial-pretty">
            {item.quoteImage}
          </p>

          <h3 className="text-2xl sm:text-3xl lg:text-[2.1rem] font-bold tracking-tight leading-[1.08] text-white editorial-balance">
            {item.headline}
          </h3>

          <p className="text-sm sm:text-base leading-relaxed text-white/80 editorial-pretty">
            {item.summary}
          </p>
        </div>

        <div className="pt-5 border-t border-white/16 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onToggleCase(item)}
              aria-label={
                isThisPlaying
                  ? `Остановить кейс «${item.client}»`
                  : `Слушать кейс «${item.client}»`
              }
              className={`inline-flex items-center gap-3 pr-5 pl-2 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap backdrop-blur-md border ${
                isThisPlaying
                  ? 'bg-[#FF4820] border-[#FF4820] text-white'
                  : 'bg-black/45 hover:bg-black/65 border-white/25 text-white active:scale-[0.99]'
              }`}
            >
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  isThisPlaying ? 'bg-black/20 text-white' : 'bg-[#FF4820] text-white'
                }`}
              >
                {isThisPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" aria-hidden="true" />
                )}
              </span>
              <span>{isThisPlaying ? 'Звучит в эфире' : 'Слушать эфирный ролик'}</span>
            </button>

            <ShareCaseButton item={item} isCopied={isCopied} onShare={onShare} />
          </div>

          <span className="text-xs sm:text-sm font-medium text-white/80 tabular-nums">
            {isThisPlaying
              ? `${formatAudioTime(currentTimeSec)} / ${formatAudioTime(item.durationSec)}`
              : formatAudioTime(item.durationSec)}
          </span>
        </div>
      </div>
    </motion.article>
  );
}

export function CasesGallery({ playerSnap, onToggleCase }: CasesGalleryProps) {
  const { decision } = useLayaDecision();
  const orderedCases = getOrderedCasesForPersona(decision.choice);
  const [copiedCaseId, setCopiedCaseId] = useState<CaseId | null>(null);
  const [highlightedCaseId, setHighlightedCaseId] = useState<CaseId | null>(null);

  const isReelPlaying =
    playerSnap.isPlaying && playerSnap.activeCase?.id === FLAGSHIP_STUDIO_REEL.id;

  // Переход по прямой ссылке на конкретный кейс (?case=<id>#case-<id>)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sharedId = readSharedCaseIdFromLocation(
      window.location.search,
      window.location.hash
    );
    if (!sharedId) return;

    setHighlightedCaseId(sharedId);
    const scrollTimer = window.setTimeout(() => {
      const targetEl = document.getElementById(`case-${sharedId}`);
      targetEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);

    const clearHighlight = window.setTimeout(() => {
      setHighlightedCaseId(null);
    }, 3600);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearHighlight);
    };
  }, []);

  const handleShareCase = async (item: BrandCasePoster) => {
    if (typeof window === 'undefined') return;
    const shareUrl = buildCaseShareUrl(window.location.href, item.id);
    const sharePayload = {
      title: `${item.client} — AudioWorks`,
      text: `${item.headline} (${item.tag})`,
      url: shareUrl,
    };

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const canUseNative =
          typeof navigator.canShare !== 'function' || navigator.canShare(sharePayload);
        if (canUseNative) {
          await navigator.share(sharePayload);
          setCopiedCaseId(item.id);
          window.setTimeout(() => {
            setCopiedCaseId((prev) => (prev === item.id ? null : prev));
          }, 2200);
          return;
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    let copied = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        copied = true;
      } catch {
        copied = copyTextFallback(shareUrl);
      }
    } else {
      copied = copyTextFallback(shareUrl);
    }

    if (copied || shareUrl) {
      setCopiedCaseId(item.id);
      window.setTimeout(() => {
        setCopiedCaseId((prev) => (prev === item.id ? null : prev));
      }, 2400);
    }
  };

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

        {/* Studio Own Commercial Strip (1:19 Full Studio Recording) */}
        <StudioCommercialStrip
          isReelPlaying={isReelPlaying}
          isHighlighted={highlightedCaseId === FLAGSHIP_STUDIO_REEL.id}
          isCopied={copiedCaseId === FLAGSHIP_STUDIO_REEL.id}
          currentTimeSec={playerSnap.currentTimeSec}
          onToggleCase={onToggleCase}
          onShare={handleShareCase}
        />

        {/* Koto Studio Photographic Poster Grid: 1 Full-Width Flagship Split + 2 Photographic Posters Beneath */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {orderedCases.map((item, index) => (
            <BrandCaseCard
              key={item.id}
              item={item}
              index={index}
              isThisPlaying={
                playerSnap.isPlaying && playerSnap.activeCase?.id === item.id
              }
              isThisHighlighted={highlightedCaseId === item.id}
              isCopied={copiedCaseId === item.id}
              waveBars={playerSnap.waveBars}
              currentTimeSec={playerSnap.currentTimeSec}
              onToggleCase={onToggleCase}
              onShare={handleShareCase}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
