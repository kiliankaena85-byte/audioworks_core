import { ArrowUpRight, Check, Pause, Play, Share2 } from 'lucide-react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { PointerEvent as ReactPointerEvent, RefObject, useEffect, useRef, useState } from 'react';
import type { CasePlayerSnapshot } from '../audio/lazyAudioEngines';
import { useStudioCms } from '../cms/StudioCmsContext';
import { formatAudioTime } from '../data/audioworksCommercial';
import { OptimizedImage } from './OptimizedImage';
import {
  BrandCasePoster,
  buildCaseShareUrl,
  CaseCardProgressState,
  CaseId,
  CasePlaybackMode,
  computeCaseCardProgress,
  computeCaseHoverOffset,
  getCasePreviewWindow,
  readSharedCaseIdFromLocation,
} from '../data/casesData';
import { orderPublishedCmsCasesForPersona } from '../data/studioCmsTypes';
import { useLayaDecision } from '../engine/LayaContext';
import { PremiumAcousticWaveform } from './PremiumAcousticWaveform';

const LOCAL_CASE_FALLBACK_IMAGE =
  '/src/assets/images/hero_studio_editorial_1794399404984.jpg';

interface CasesGalleryProps {
  playerSnap: CasePlayerSnapshot;
  searchQuery?: string;
  onResetSearch?: () => void;
  onToggleCase: (item: BrandCasePoster) => void;
  onSeekCase?: (item: BrandCasePoster, ratio: number) => void;
  onWarmCasePlayer?: () => void;
  onStopPreview?: (caseId: CaseId) => void;
  onOpenCaseDetail?: (caseId: CaseId) => void;
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

function useCaseDepthMotion(
  containerRef: RefObject<HTMLElement | null>,
  {
    scrollRangePx = 18,
    hoverShiftX = 10,
    hoverShiftY = 8,
    restScale = 1.05,
    hoverScale = 1.09,
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

interface UseCaseHoverPreviewOptions {
  item: BrandCasePoster;
  isGlobalPlaying: boolean;
  globalPlaybackMode: CasePlaybackMode | null;
  onStopPreview?: (caseId: CaseId) => void;
}

function useCaseHoverPreview({
  item,
  isGlobalPlaying,
  globalPlaybackMode,
  onStopPreview,
}: UseCaseHoverPreviewOptions) {
  const handlePreviewPointerLeave = () => {
    if (isGlobalPlaying && globalPlaybackMode === 'preview') {
      onStopPreview?.(item.id);
    }
  };

  return {
    handlePreviewPointerLeave,
  };
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
      aria-label={isCopied ? 'Ссылка скопирована' : `Поделиться кейсом «${item.client}»`}
      title={isCopied ? 'Ссылка скопирована' : 'Поделиться кейсом'}
      className={`h-10 w-10 sm:h-11 sm:w-11 rounded-full inline-flex items-center justify-center transition-colors cursor-pointer backdrop-blur-md border shrink-0 ${
        isCopied
          ? 'bg-white text-[#111111] border-white'
          : 'bg-black/40 hover:bg-black/65 text-white/85 hover:text-white border-white/18'
      }`}
    >
      {isCopied ? (
        <Check className="w-4 h-4 text-[#FF4820]" aria-hidden="true" />
      ) : (
        <Share2 className="w-4 h-4" aria-hidden="true" />
      )}
    </button>
  );
}

interface CaseAudioProgressBarProps {
  item: BrandCasePoster;
  progress: CaseCardProgressState;
  spectrumBands: readonly number[];
  currentTimeSec: number;
  onScrubStart?: () => void;
  onSeekRatio?: (ratio: number) => void;
}

function CaseAudioProgressBar({
  item,
  progress,
  spectrumBands,
  currentTimeSec,
  onScrubStart,
  onSeekRatio,
}: CaseAudioProgressBarProps) {
  const prefersReducedMotion = useReducedMotion();
  const previewWindow = getCasePreviewWindow(item);
  const targetDurationSec =
    progress.mode === 'preview' ? previewWindow.durationSec : item.durationSec;

  return (
    <PremiumAcousticWaveform
      seedKey={item.id}
      isActive={progress.isActive}
      progressRatio={progress.isActive ? progress.ratio : 0}
      spectrumBands={spectrumBands}
      reducedMotion={Boolean(prefersReducedMotion)}
      variant="dark-surface"
      heightClass="h-11 sm:h-10"
      onScrubStart={onScrubStart}
      onSeekRatio={onSeekRatio}
      seekAriaLabel={`Перемотка ролика: ${item.client}`}
      visualizerTestId={`case-visualizer-${item.id}`}
      visualizerMode={progress.mode ?? 'idle'}
      progressBarTestId={`case-progress-${item.id}`}
      ariaLabel={`Прогресс воспроизведения: ${item.client}`}
      ariaValueNow={progress.percent}
      ariaValueText={
        progress.isActive
          ? `${progress.mode === 'preview' ? 'Превью ' : ''}${progress.percent}% (${formatAudioTime(currentTimeSec)} из ${formatAudioTime(targetDurationSec)})`
          : `Нажмите или проведите для прослушивания с нужной секунды (${formatAudioTime(item.durationSec)})`
      }
    />
  );
}

interface StudioCommercialStripProps {
  reel: BrandCasePoster;
  progress: CaseCardProgressState;
  spectrumBands: readonly number[];
  isGlobalPlaying: boolean;
  globalPlaybackMode: CasePlaybackMode | null;
  isHighlighted: boolean;
  isCopied: boolean;
  currentTimeSec: number;
  onToggleCase: (item: BrandCasePoster) => void;
  onSeekCase?: (item: BrandCasePoster, ratio: number) => void;
  onWarmCasePlayer?: () => void;
  onStopPreview?: (caseId: CaseId) => void;
  onShare: (item: BrandCasePoster) => void;
  onOpenCaseDetail?: (caseId: CaseId) => void;
}

function StudioCommercialStrip({
  reel,
  progress,
  spectrumBands,
  isGlobalPlaying,
  globalPlaybackMode,
  isHighlighted,
  isCopied,
  currentTimeSec,
  onToggleCase,
  onSeekCase,
  onWarmCasePlayer,
  onStopPreview,
  onShare,
  onOpenCaseDetail,
}: StudioCommercialStripProps) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const isReelFullPlaying = progress.isActive && progress.mode === 'full';
  const isReelPreviewPlaying = progress.isActive && progress.mode === 'preview';
  const reelPreviewWindow = getCasePreviewWindow(reel);

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

  const { handlePreviewPointerLeave } = useCaseHoverPreview({
    item: reel,
    isGlobalPlaying,
    globalPlaybackMode,
    onStopPreview,
  });

  return (
    <div
      ref={stripRef}
      id={`case-${reel.id}`}
      data-testid="flagship-studio-reel"
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        handlePointerLeave();
        handlePreviewPointerLeave();
      }}
      className={`scroll-mt-24 group relative overflow-hidden mb-8 lg:mb-10 rounded-3xl p-6 sm:p-9 lg:p-11 bg-[#141417] text-[#F4F3EF] border transition-colors flex flex-col gap-4 ${
        isHighlighted ? 'border-[#FF4820]' : 'border-white/10'
      }`}
    >
      <OptimizedImage
        src={reel.coverImageUrl}
        fallbackSrc={LOCAL_CASE_FALLBACK_IMAGE}
        alt={reel.coverImageAlt}
        motionStyle={imageMotionStyle}
        className="pointer-events-none absolute -inset-6 w-[calc(100%+3rem)] h-[calc(100%+3rem)] max-w-none object-cover opacity-75 brightness-105 will-change-transform"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#111114]/92 via-[#111114]/68 to-[#111114]/30"
      />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs sm:text-sm font-medium text-white/62">
            {reel.tag}
          </p>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-white editorial-balance">
            {reel.headline}
          </h3>
          <p className="text-sm sm:text-base text-white/70 leading-relaxed editorial-pretty">
            {reel.summary}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {isReelPreviewPlaying && (
            <span
              data-testid={`case-preview-status-${reel.id}`}
              className="text-xs font-medium tabular-nums text-white/85 whitespace-nowrap shrink-0"
            >
              Превью · {formatAudioTime(currentTimeSec)} /{' '}
              {formatAudioTime(reelPreviewWindow.durationSec)}
            </span>
          )}

          <button
            type="button"
            onClick={() => onToggleCase(reel)}
            aria-label={
              isReelFullPlaying
                ? `Остановить ${reel.client}`
                : `Слушать ${reel.client} целиком`
            }
            className={`min-h-[42px] sm:min-h-[44px] px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full inline-flex items-center gap-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isReelFullPlaying
                ? 'bg-[#FF4820] text-white'
                : 'bg-white text-[#111111] hover:bg-[#FF4820] hover:text-white'
            }`}
          >
            {isReelFullPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
            )}
            <span className="tabular-nums">
              {isReelFullPlaying
                ? `Пауза · ${formatAudioTime(currentTimeSec)}`
                : `Слушать шоурил · ${formatAudioTime(reel.durationSec)}`}
            </span>
          </button>

          <ShareCaseButton
            item={reel}
            isCopied={isCopied}
            onShare={onShare}
          />

          {onOpenCaseDetail && (
            <button
              type="button"
              data-testid={`open-case-detail-${reel.id}`}
              onClick={() => onOpenCaseDetail(reel.id)}
              className="min-h-[42px] sm:min-h-[44px] px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/18 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Разбор</span>
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10">
        <CaseAudioProgressBar
          item={reel}
          progress={progress}
          spectrumBands={spectrumBands}
          currentTimeSec={currentTimeSec}
          onScrubStart={() => onWarmCasePlayer?.()}
          onSeekRatio={
            onSeekCase ? (ratio) => onSeekCase(reel, ratio) : undefined
          }
        />
      </div>
    </div>
  );
}

interface BrandCaseCardProps {
  item: BrandCasePoster;
  index: number;
  progress: CaseCardProgressState;
  spectrumBands: readonly number[];
  isGlobalPlaying: boolean;
  globalPlaybackMode: CasePlaybackMode | null;
  isThisHighlighted: boolean;
  isCopied: boolean;
  currentTimeSec: number;
  onToggleCase: (item: BrandCasePoster) => void;
  onSeekCase?: (item: BrandCasePoster, ratio: number) => void;
  onWarmCasePlayer?: () => void;
  onStopPreview?: (caseId: CaseId) => void;
  onShare: (item: BrandCasePoster) => void;
  onOpenCaseDetail?: (caseId: CaseId) => void;
}

function BrandCaseCard({
  item,
  index,
  progress,
  spectrumBands,
  isGlobalPlaying,
  globalPlaybackMode,
  isThisHighlighted,
  isCopied,
  currentTimeSec,
  onToggleCase,
  onSeekCase,
  onWarmCasePlayer,
  onStopPreview,
  onShare,
  onOpenCaseDetail,
}: BrandCaseCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const isFlagshipWide = index === 0;
  const isThisFullPlaying = progress.isActive && progress.mode === 'full';
  const isThisPreviewPlaying = progress.isActive && progress.mode === 'preview';
  const previewWindow = getCasePreviewWindow(item);

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
    hoverScale: 1.09,
  });

  const { handlePreviewPointerLeave } = useCaseHoverPreview({
    item,
    isGlobalPlaying,
    globalPlaybackMode,
    onStopPreview,
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
        onPointerLeave={() => {
          handlePointerLeave();
          handlePreviewPointerLeave();
        }}
        className={`scroll-mt-24 group lg:col-span-2 relative overflow-hidden rounded-3xl border transition-colors grid grid-cols-1 lg:grid-cols-12 items-stretch min-h-[420px] lg:min-h-[460px] ${
          isThisHighlighted
            ? 'border-[#FF4820]'
            : 'border-[#111111]/10 dark:border-white/10'
        }`}
      >
        <div
          className={`lg:col-span-6 ${item.editorialSurfaceBg} text-[#F4F3EF] p-6 sm:p-11 lg:p-14 flex flex-col justify-between gap-8`}
        >
          <p className="text-xs sm:text-sm font-medium text-white/65">
            {item.tag} · {item.client}
          </p>

          <div className="space-y-4 my-auto">
            <h3 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-bold tracking-tight leading-[1.06] text-white editorial-balance">
              {item.headline}
            </h3>

            <p className="text-base sm:text-lg leading-relaxed text-white/75 editorial-pretty">
              {item.summary}
            </p>
          </div>

          <div className="space-y-4">
            <CaseAudioProgressBar
              item={item}
              progress={progress}
              spectrumBands={spectrumBands}
              currentTimeSec={currentTimeSec}
              onScrubStart={() => onWarmCasePlayer?.()}
              onSeekRatio={
                onSeekCase ? (ratio) => onSeekCase(item, ratio) : undefined
              }
            />

            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => onToggleCase(item)}
                  aria-label={
                    isThisFullPlaying
                      ? `Остановить кейс «${item.client}»`
                      : `Слушать кейс «${item.client}»`
                  }
                  className={`min-h-[42px] sm:min-h-[44px] px-4 sm:px-5 py-2 sm:py-2.5 rounded-full inline-flex items-center gap-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isThisFullPlaying
                      ? 'bg-[#FF4820] text-white'
                      : 'bg-white text-[#111111] hover:bg-[#FF4820] hover:text-white'
                  }`}
                >
                  {isThisFullPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                  )}
                  <span className="tabular-nums">
                    {isThisFullPlaying
                      ? `Пауза · ${formatAudioTime(currentTimeSec)}`
                      : `Слушать · ${formatAudioTime(item.durationSec)}`}
                  </span>
                </button>

                <ShareCaseButton item={item} isCopied={isCopied} onShare={onShare} />

                {onOpenCaseDetail && (
                  <button
                    type="button"
                    data-testid={`open-case-detail-${item.id}`}
                    onClick={() => onOpenCaseDetail(item.id)}
                    className="min-h-[42px] sm:min-h-[44px] px-3 sm:px-4 py-2 sm:py-2.5 rounded-full inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/18 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>Сценарий</span>
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </button>
                )}
              </div>

              {isThisFullPlaying && (
                <span className="text-xs font-medium tabular-nums text-white/75 whitespace-nowrap shrink-0">
                  {formatAudioTime(currentTimeSec)} / {formatAudioTime(item.durationSec)}
                </span>
              )}

              {isThisPreviewPlaying && (
                <span
                  data-testid={`case-preview-status-${item.id}`}
                  className="text-xs font-medium tabular-nums text-white/88 whitespace-nowrap shrink-0"
                >
                  Превью · {formatAudioTime(currentTimeSec)} /{' '}
                  {formatAudioTime(previewWindow.durationSec)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className={`lg:col-span-6 relative min-h-[260px] sm:min-h-[300px] lg:min-h-full overflow-hidden ${item.posterGradientClass}`}
        >
          <OptimizedImage
            src={item.coverImageUrl}
            fallbackSrc={LOCAL_CASE_FALLBACK_IMAGE}
            alt={item.coverImageAlt}
            motionStyle={imageMotionStyle}
            className="pointer-events-none absolute -inset-7 w-[calc(100%+3.5rem)] h-[calc(100%+3.5rem)] max-w-none object-cover will-change-transform"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15"
          />
        </div>
      </motion.article>
    );
  }

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
      onPointerLeave={() => {
        handlePointerLeave();
        handlePreviewPointerLeave();
      }}
      className={`scroll-mt-24 group lg:col-span-1 relative overflow-hidden rounded-3xl ${item.posterGradientClass} text-[#F4F3EF] border transition-colors min-h-[400px] sm:min-h-[440px] lg:min-h-[460px] p-6 sm:p-10 flex flex-col justify-between ${
        isThisHighlighted
          ? 'border-[#FF4820]'
          : 'border-[#111111]/10 dark:border-white/10'
      }`}
    >
      <OptimizedImage
        src={item.coverImageUrl}
        fallbackSrc={LOCAL_CASE_FALLBACK_IMAGE}
        alt={item.coverImageAlt}
        motionStyle={imageMotionStyle}
        className="pointer-events-none absolute -inset-7 w-[calc(100%+3.5rem)] h-[calc(100%+3.5rem)] max-w-none object-cover will-change-transform"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A0C10]/92 via-[#0A0C10]/48 to-[#0A0C10]/32"
      />

      <p className="relative z-10 text-xs sm:text-sm font-medium text-white/78">
        {item.tag} · {item.client}
      </p>

      <div className="relative z-10 mt-auto pt-12 space-y-6">
        <div className="space-y-3">
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight leading-[1.08] text-white editorial-balance">
            {item.headline}
          </h3>

          <p className="text-sm sm:text-base leading-relaxed text-white/76 editorial-pretty">
            {item.summary}
          </p>
        </div>

        <div className="space-y-3.5">
          <CaseAudioProgressBar
            item={item}
            progress={progress}
            spectrumBands={spectrumBands}
            currentTimeSec={currentTimeSec}
            onScrubStart={() => onWarmCasePlayer?.()}
            onSeekRatio={
              onSeekCase ? (ratio) => onSeekCase(item, ratio) : undefined
            }
          />

          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={() => onToggleCase(item)}
                aria-label={
                  isThisFullPlaying
                    ? `Остановить кейс «${item.client}»`
                    : `Слушать кейс «${item.client}»`
                }
                className={`min-h-[42px] sm:min-h-[44px] px-4 sm:px-5 py-2 sm:py-2.5 rounded-full inline-flex items-center gap-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap backdrop-blur-md border shrink-0 ${
                  isThisFullPlaying
                    ? 'bg-[#FF4820] border-[#FF4820] text-white'
                    : 'bg-black/45 hover:bg-black/65 border-white/22 text-white'
                }`}
              >
                {isThisFullPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                )}
                <span className="tabular-nums">
                  {isThisFullPlaying
                    ? `Пауза · ${formatAudioTime(currentTimeSec)}`
                    : `Слушать · ${formatAudioTime(item.durationSec)}`}
                </span>
              </button>

              <ShareCaseButton item={item} isCopied={isCopied} onShare={onShare} />

              {onOpenCaseDetail && (
                <button
                  type="button"
                  data-testid={`open-case-detail-${item.id}`}
                  onClick={() => onOpenCaseDetail(item.id)}
                  className="min-h-[42px] sm:min-h-[44px] px-3 sm:px-4 py-2 sm:py-2.5 rounded-full inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold bg-black/45 hover:bg-black/65 text-white border border-white/20 backdrop-blur-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Сценарий</span>
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                </button>
              )}
            </div>

            {isThisFullPlaying && (
              <span className="text-xs font-medium tabular-nums text-white/80 whitespace-nowrap shrink-0">
                {formatAudioTime(currentTimeSec)} / {formatAudioTime(item.durationSec)}
              </span>
            )}

            {isThisPreviewPlaying && (
              <span
                data-testid={`case-preview-status-${item.id}`}
                className="text-xs font-medium tabular-nums text-white/88 whitespace-nowrap shrink-0"
              >
                Превью · {formatAudioTime(currentTimeSec)} /{' '}
                {formatAudioTime(previewWindow.durationSec)}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export function CasesGallery({
  playerSnap,
  searchQuery,
  onResetSearch,
  onToggleCase,
  onSeekCase,
  onWarmCasePlayer,
  onStopPreview,
  onOpenCaseDetail,
}: CasesGalleryProps) {
  const { decision } = useLayaDecision();
  const { snapshot } = useStudioCms();
  const flagshipReel = snapshot.flagshipReel;
  const normalizedQuery = (searchQuery ?? '').trim().toLowerCase();
  const matchesQuery = (item: BrandCasePoster): boolean => {
    if (!normalizedQuery) return true;
    const haystack = `${item.id} ${item.client} ${item.headline} ${item.summary} ${item.tag}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  };
  const showFlagshipReel =
    flagshipReel.published !== false && matchesQuery(flagshipReel);
  const orderedCases = orderPublishedCmsCasesForPersona(
    snapshot.portfolioCases,
    decision.choice
  ).filter(matchesQuery);
  const [copiedCaseId, setCopiedCaseId] = useState<CaseId | null>(null);
  const [highlightedCaseId, setHighlightedCaseId] = useState<CaseId | null>(null);

  const activeCaseId = playerSnap.activeCase?.id ?? null;
  const reelProgress = computeCaseCardProgress(
    flagshipReel.id,
    playerSnap.isPlaying,
    activeCaseId,
    playerSnap.progress,
    playerSnap.playbackMode
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const allowedIds = [
      flagshipReel.id,
      ...snapshot.portfolioCases.map((c) => c.id),
    ];
    const sharedId = readSharedCaseIdFromLocation(
      window.location.search,
      window.location.hash,
      allowedIds
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
  }, [flagshipReel.id, snapshot.portfolioCases]);

  const handleShareCase = async (item: BrandCasePoster) => {
    if (typeof window === 'undefined') return;
    const shareUrl = window.location.origin
      ? `${window.location.origin}/cases/${encodeURIComponent(item.id)}`
      : buildCaseShareUrl(window.location.href, item.id);
    const sharePayload = {
      title: `${item.client} — FMWorks`,
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
      className="scroll-mt-20 py-20 sm:py-28 lg:py-36 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="max-w-3xl mb-12 lg:mb-16">
          <p className="text-sm font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55 mb-3">
            Портфолио
          </p>
          <h2
            id="work-heading"
            className="text-3xl sm:text-5xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] mb-3"
          >
            Наши работы
          </h2>
          <p className="text-base sm:text-xl text-[#111111]/68 dark:text-[#F4F3EF]/68 editorial-pretty">
            Как звучат бренды, когда за дело берётся продакшн. Включите любой
            ролик по кнопке «Слушать», чтобы оценить режиссуру и подачу в эфире.
          </p>
        </div>

        {showFlagshipReel && (
          <StudioCommercialStrip
            reel={flagshipReel}
            progress={reelProgress}
            spectrumBands={playerSnap.spectrumBands}
            isGlobalPlaying={playerSnap.isPlaying}
            globalPlaybackMode={playerSnap.playbackMode}
            isHighlighted={highlightedCaseId === flagshipReel.id}
            isCopied={copiedCaseId === flagshipReel.id}
            currentTimeSec={playerSnap.currentTimeSec}
            onToggleCase={onToggleCase}
            onSeekCase={onSeekCase}
            onWarmCasePlayer={onWarmCasePlayer}
            onStopPreview={onStopPreview}
            onShare={handleShareCase}
            onOpenCaseDetail={onOpenCaseDetail}
          />
        )}

        {!showFlagshipReel && orderedCases.length === 0 ? (
          <div
            data-testid="cases-search-empty"
            className="rounded-3xl border border-[#111111]/12 dark:border-white/12 bg-[#EFECE5]/65 dark:bg-[#15151A] p-8 sm:p-12 text-center space-y-4"
          >
            <p className="text-lg font-semibold text-[#111111] dark:text-[#F4F3EF]">
              По запросу «{searchQuery?.trim()}» ролики не найдены
            </p>
            <p className="text-sm text-[#111111]/66 dark:text-[#F4F3EF]/66">
              Попробуйте ключевые слова «ритейл», «ЖК», «клиника», «Дмитрогорский» или сбросьте фильтр.
            </p>
            {onResetSearch && (
              <button
                type="button"
                onClick={onResetSearch}
                className="min-h-[42px] px-5 py-2 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Показать все кейсы
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {orderedCases.map((item, index) => (
              <BrandCaseCard
                key={item.id}
                item={item}
                index={index}
                progress={computeCaseCardProgress(
                  item.id,
                  playerSnap.isPlaying,
                  activeCaseId,
                  playerSnap.progress,
                  playerSnap.playbackMode
                )}
                spectrumBands={playerSnap.spectrumBands}
                isGlobalPlaying={playerSnap.isPlaying}
                globalPlaybackMode={playerSnap.playbackMode}
                isThisHighlighted={highlightedCaseId === item.id}
                isCopied={copiedCaseId === item.id}
                currentTimeSec={playerSnap.currentTimeSec}
                onToggleCase={onToggleCase}
                onSeekCase={onSeekCase}
                onWarmCasePlayer={onWarmCasePlayer}
                onStopPreview={onStopPreview}
                onShare={handleShareCase}
                onOpenCaseDetail={onOpenCaseDetail}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
