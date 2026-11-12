import { Car, Pause, Play } from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  contrastAudioEngine,
  ContrastStageSnapshot,
} from '../audio/contrastAudioEngine';
import { useSiteTextBlocks } from '../cms/SiteTextBlocksContext';
import {
  AUDIOWORKS_TOTAL_DURATION_SEC,
  CRASH_TEST_CLUTTER_DURATION_SEC,
  formatAudioTime,
  GREY_RADIO_MARQUEE_BASE,
  HERO_GREY_TRAFFIC_IMAGE,
  HERO_LENS_FRAMES,
} from '../data/audioworksCommercial';
import { BrandDomainVariant } from '../data/brandKitData';
import { isSiteTextBlockSubtitleModified } from '../data/siteTextBlocksData';
import { LAYA_CONTENT_DICTIONARY, VALID_PERSONAS } from '../engine/layaEngine';
import { useLayaDecision } from '../engine/LayaContext';
import { BrandLogo } from './BrandLogo';

const LOCAL_FALLBACK_IMAGES: Record<string, string> = {
  traffic: '/src/assets/images/case_auto_mobility_1794399407900.jpg',
  taste: '/src/assets/images/case_retail_coffee_1794399406426.jpg',
  status: '/src/assets/images/case_estate_cinema_1794399406227.jpg',
  studio: '/src/assets/images/hero_studio_editorial_1794399404984.jpg',
};

function clampSpotlightPosition(
  rawX: number,
  rawY: number,
  width: number,
  height: number,
  radius: number
): { x: number; y: number } {
  if (width < 640) {
    const topHudGuard = 78;
    const bottomHudGuard = 136;
    const safeMinY = topHudGuard + radius;
    const safeMaxY = height - bottomHudGuard - radius;
    const y =
      safeMinY <= safeMaxY
        ? Math.max(safeMinY, Math.min(safeMaxY, rawY))
        : (topHudGuard + Math.max(topHudGuard, height - bottomHudGuard)) * 0.5;

    const minX = Math.min(width * 0.5, radius + 12);
    const maxX = Math.max(width * 0.5, width - radius - 12);
    const x = Math.max(minX, Math.min(maxX, rawX));
    return { x, y };
  }

  const minY = Math.min(height * 0.5, 84 + radius * 0.28);
  const maxY = Math.max(minY, height - 96);
  const minX = Math.min(width * 0.5, 64);
  const maxX = Math.max(minX, width - 64);
  return {
    x: Math.max(minX, Math.min(maxX, rawX)),
    y: Math.max(minY, Math.min(maxY, rawY)),
  };
}

interface HeroKotoLensProps {
  brandVariant?: BrandDomainVariant;
  onOpenBrandKit?: () => void;
}

export function HeroKotoLens({
  brandVariant = 'audioworks_reg',
  onOpenBrandKit,
}: HeroKotoLensProps = {}) {
  const { decision, slot, selectPersonaProfile } = useLayaDecision();
  const { getBlock } = useSiteTextBlocks();
  const heroStageBlock = getBlock('hero-stage');
  const heroManifestoBlock = getBlock('hero-manifesto');
  const manifestoSubtitle = isSiteTextBlockSubtitleModified(heroManifestoBlock)
    ? heroManifestoBlock.subtitle ?? slot.kotoManifestoTagline
    : slot.kotoManifestoTagline;

  const [snap, setSnap] = useState<ContrastStageSnapshot>(() =>
    contrastAudioEngine.getSnapshot()
  );
  const [frameIndex, setFrameIndex] = useState<number>(0);
  const [isPointerInside, setIsPointerInside] = useState<boolean>(false);
  const [isOverControl, setIsOverControl] = useState<boolean>(false);
  const [expandedTargetRadius, setExpandedTargetRadius] = useState<number>(2400);
  const [spotlightBaseRadius, setSpotlightBaseRadius] = useState<number>(200);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const isPointerInsideRef = useRef(isPointerInside);
  isPointerInsideRef.current = isPointerInside;

  const isPlayingAny = snap.isFilmPlaying || snap.isSoundPlaying;
  const isClutterPhase = snap.crashPhase === 'clutter';
  const isStopPausePhase = snap.crashPhase === 'stop_pause';
  const isExpanded = snap.isLensExpanded;
  const activeFrame = HERO_LENS_FRAMES[frameIndex] ?? HERO_LENS_FRAMES[0];

  const lensX = useMotionValue(560);
  const lensY = useMotionValue(320);
  const lensRadius = useMotionValue(200);

  const smoothX = useSpring(lensX, { stiffness: 320, damping: 30, mass: 0.42 });
  const smoothY = useSpring(lensY, { stiffness: 320, damping: 30, mass: 0.42 });
  const smoothRadius = useSpring(lensRadius, {
    stiffness: 155,
    damping: 24,
    mass: 0.68,
  });

  const clipPathMask = useMotionTemplate`circle(${smoothRadius}px at ${smoothX}px ${smoothY}px)`;
  const ringScale = useTransform(smoothRadius, (r) => Math.max(0.2, r / 200));
  const pillOffsetX = useTransform(smoothX, (x) => x + 18);
  const pillOffsetY = useTransform(smoothY, (y) => y + 18);

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

  const spotlightBaseRadiusRef = useRef(spotlightBaseRadius);
  spotlightBaseRadiusRef.current = spotlightBaseRadius;

  useEffect(() => {
    let prevWidth = 0;

    const updateGeometry = () => {
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const diag = Math.hypot(rect.width, rect.height);
      setExpandedTargetRadius(Math.max(2200, Math.ceil(diag * 1.5)));

      const nextBaseRadius =
        rect.width < 640
          ? Math.min(104, Math.max(80, Math.round(rect.width * 0.28)))
          : 200;
      spotlightBaseRadiusRef.current = nextBaseRadius;
      setSpotlightBaseRadius(nextBaseRadius);

      const widthChangedMeaningfully = Math.abs(rect.width - prevWidth) > 8;
      prevWidth = rect.width;

      if (widthChangedMeaningfully && isPointerInsideRef.current) {
        isPointerInsideRef.current = false;
        setIsPointerInside(false);
        setIsOverControl(false);
      }

      if (!isPointerInsideRef.current || widthChangedMeaningfully) {
        const centered = clampSpotlightPosition(
          rect.width * 0.5,
          rect.height * 0.46,
          rect.width,
          rect.height,
          nextBaseRadius
        );
        lensX.set(centered.x);
        lensY.set(centered.y);
      }
    };

    updateGeometry();
    window.addEventListener('resize', updateGeometry);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && stageRef.current) {
      ro = new ResizeObserver(() => updateGeometry());
      ro.observe(stageRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateGeometry);
      ro?.disconnect();
    };
  }, [lensX, lensY]);

  useEffect(() => {
    if (isPointerInside || isExpanded) return;
    let raf = 0;
    let startMs = performance.now();

    const drift = (now: number) => {
      raf = window.requestAnimationFrame(drift);
      if (now - startMs < 48) return;
      startMs = now;
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const t = now * 0.00075;
      const rawCx = rect.width * 0.5 + Math.sin(t) * Math.min(56, rect.width * 0.05);
      const rawCy = rect.height * 0.46 + Math.cos(t * 0.8) * Math.min(24, rect.height * 0.03);
      const clamped = clampSpotlightPosition(
        rawCx,
        rawCy,
        rect.width,
        rect.height,
        spotlightBaseRadiusRef.current
      );
      lensX.set(clamped.x);
      lensY.set(clamped.y);
    };

    raf = window.requestAnimationFrame(drift);
    return () => window.cancelAnimationFrame(raf);
  }, [isPointerInside, isExpanded, lensX, lensY]);

  useEffect(() => {
    if (isExpanded) {
      lensRadius.set(expandedTargetRadius);
      return;
    }
    if (isClutterPhase) {
      lensRadius.set(Math.round(spotlightBaseRadius * 0.68));
      return;
    }
    lensRadius.set(spotlightBaseRadius);
  }, [isExpanded, isClutterPhase, expandedTargetRadius, spotlightBaseRadius, lensRadius]);

  useEffect(() => {
    const cycleTimer = window.setTimeout(() => {
      setFrameIndex((prev) => (prev + 1) % HERO_LENS_FRAMES.length);
    }, 4200);
    return () => window.clearTimeout(cycleTimer);
  }, [frameIndex]);

  const handleStageMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();

    const target = e.target as HTMLElement | null;
    const hoveringInteractive = Boolean(target?.closest('[data-lens-interactive="true"]'));
    if (hoveringInteractive !== isOverControl) {
      setIsOverControl(hoveringInteractive);
    }

    if (!hoveringInteractive) {
      const clamped = clampSpotlightPosition(
        e.clientX - rect.left,
        e.clientY - rect.top,
        rect.width,
        rect.height,
        spotlightBaseRadiusRef.current
      );
      lensX.set(clamped.x);
      lensY.set(clamped.y);
    }

    if (!isPointerInside) {
      setIsPointerInside(true);
    }
  };

  const handleStageMouseLeave = () => {
    setIsPointerInside(false);
    setIsOverControl(false);
  };

  const handleStageTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    const touch = e.touches[0];
    if (!stage || !touch) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-lens-interactive="true"]')) return;

    const rect = stage.getBoundingClientRect();
    const clamped = clampSpotlightPosition(
      touch.clientX - rect.left,
      touch.clientY - rect.top,
      rect.width,
      rect.height,
      spotlightBaseRadiusRef.current
    );
    lensX.set(clamped.x);
    lensY.set(clamped.y);
  };

  const handleStageClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-lens-interactive="true"]')) {
      return;
    }
    contrastAudioEngine.toggleCrashTestOrShowreel();
  };

  const combinedMarqueePhrases = [
    ...GREY_RADIO_MARQUEE_BASE,
    ...slot.streamCliches,
    ...GREY_RADIO_MARQUEE_BASE,
    ...slot.streamCliches,
  ];

  const clutterProgressPct = Math.min(
    100,
    Math.max(0, (snap.crashElapsedSec / CRASH_TEST_CLUTTER_DURATION_SEC) * 100)
  );

  const filmProgressPct = Math.min(
    100,
    Math.max(0, (snap.filmElapsedSec / AUDIOWORKS_TOTAL_DURATION_SEC) * 100)
  );

  const hideNativeCursor = !isExpanded && isPointerInside && !isOverControl;

  return (
    <>
      {/* ИНТЕРАКТИВНЫЙ ПЕРВЫЙ ЭКРАН: ЛИНЗА ВНИМАНИЯ (чистая композиция без виджетов и лишних волн) */}
      <section
        id="top"
        aria-label="Интерактивная линза внимания и краш-тест в рекламном блоке"
        className="px-3 sm:px-6 lg:px-8 pt-2 pb-4"
      >
        <div
          ref={stageRef}
          data-testid="koto-lens-stage"
          data-crash-phase={snap.crashPhase}
          data-lens-expanded={isExpanded ? 'true' : 'false'}
          data-active-frame={activeFrame.id}
          onMouseMove={handleStageMouseMove}
          onMouseLeave={handleStageMouseLeave}
          onTouchMove={handleStageTouchMove}
          onClick={handleStageClick}
          className={`relative w-full max-w-7xl mx-auto min-h-[70svh] sm:min-h-[76vh] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#111216] text-[#F4F3EF] flex flex-col justify-between p-5 sm:p-9 lg:p-12 select-none touch-pan-y ${
            hideNativeCursor ? 'lg:cursor-none' : 'lg:cursor-pointer'
          }`}
        >
          {/* Слой 1: Серый рекламный поток в дороге */}
          <div
            aria-hidden={isExpanded}
            className="pointer-events-none absolute inset-0 bg-[#121318]"
          >
            <img
              src={HERO_GREY_TRAFFIC_IMAGE}
              alt="Вечерний поток машин — обычный рекламный блок"
              referrerPolicy="no-referrer"
              decoding="async"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.fallbackApplied) {
                  img.dataset.fallbackApplied = '1';
                  img.src = LOCAL_FALLBACK_IMAGES.traffic;
                }
              }}
              className="w-full h-full object-cover grayscale contrast-75 brightness-50 blur-[2px] scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C10]/92 via-[#111216]/56 to-[#0B0C10]/68" />

            <div className="absolute inset-x-0 top-[36%] space-y-6 overflow-hidden">
              <div className="flex whitespace-nowrap gap-14 animate-stream-left text-xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-white/14">
                {combinedMarqueePhrases.map((phrase, idx) => (
                  <span key={`grey-r1-${idx}`}>{phrase}</span>
                ))}
              </div>
              <div className="flex whitespace-nowrap gap-14 animate-stream-right text-lg sm:text-2xl lg:text-3xl font-medium tracking-tight text-white/10">
                {combinedMarqueePhrases.map((phrase, idx) => (
                  <span key={`grey-r2-${idx}`}>{phrase}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Слой 2: Чистый полноцветный мир AudioWorks внутри круглой линзы */}
          <motion.div
            data-testid="koto-attention-lens-layer"
            style={{ clipPath: clipPathMask }}
            className="pointer-events-none absolute inset-0 z-10 bg-[#141110]"
          >
            {HERO_LENS_FRAMES.map((frame, idx) => {
              const isCurrent = idx === frameIndex;
              return (
                <div
                  key={frame.id}
                  className={`absolute inset-0 transition-opacity duration-700 ${
                    isCurrent ? 'opacity-100' : 'opacity-0'
                  } ${frame.fallbackGradient}`}
                >
                  <img
                    src={frame.imageUrl}
                    alt={frame.imageAlt}
                    referrerPolicy="no-referrer"
                    decoding="async"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (!img.dataset.fallbackApplied) {
                        img.dataset.fallbackApplied = '1';
                        img.src =
                          LOCAL_FALLBACK_IMAGES[frame.id] ?? LOCAL_FALLBACK_IMAGES.studio;
                      }
                    }}
                    className={`w-full h-full object-cover animate-ken-burns ${frame.exposureClass}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#09090C]/88 via-[#09090C]/28 to-[#09090C]/42" />
                </div>
              );
            })}
          </motion.div>

          {/* Тонкий контур линзы и спокойная подсказка курсора до раскрытия */}
          {!isExpanded && (
            <>
              <motion.div
                aria-hidden="true"
                style={{
                  x: smoothX,
                  y: smoothY,
                  scale: ringScale,
                }}
                className="pointer-events-none absolute top-0 left-0 z-20 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/40"
              />

              <motion.div
                aria-hidden="true"
                style={{ x: pillOffsetX, y: pillOffsetY }}
                className={`hidden lg:inline-flex pointer-events-none absolute top-0 left-0 z-30 items-center gap-2 px-3.5 py-2 rounded-full bg-white text-[#111111] text-xs font-semibold shadow-lg transition-opacity duration-150 whitespace-nowrap ${
                  isPointerInside && !isOverControl ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <Play className="w-3 h-3 fill-current text-[#FF4820]" />
                <span>
                  {isClutterPhase ? 'Идёт обычный блок…' : 'Слушать краш-тест'}
                </span>
              </motion.div>
            </>
          )}

          {/* Верхняя строка холста: тихий статус слева + единственный переключатель режимов справа */}
          <div
            data-lens-interactive="true"
            className="relative z-30 flex flex-wrap items-center justify-between gap-3 cursor-default"
          >
            <div className="min-w-0">
              {isClutterPhase ? (
                <div
                  data-testid="crash-phase-clutter-badge"
                  className="flex items-center gap-3 text-xs sm:text-sm font-medium text-white/90 tabular-nums"
                >
                  <span>0:00–0:04 · Обычный рекламный блок</span>
                  <span className="hidden sm:inline-block w-16 h-0.5 bg-white/20 overflow-hidden">
                    <span
                      style={{ transform: `scaleX(${clutterProgressPct / 100})` }}
                      className="block w-full h-full bg-[#FF4820] origin-left transition-transform duration-100"
                    />
                  </span>
                </div>
              ) : isStopPausePhase ? (
                <div
                  data-testid="crash-phase-stop-badge"
                  className="text-xs sm:text-sm font-semibold text-[#FF4820] tracking-tight"
                >
                  Стоп · Пауза 0.5 сек
                </div>
              ) : isExpanded ? (
                <div
                  role="tablist"
                  aria-label="Сцены AudioWorks"
                  className="flex items-center gap-4 sm:gap-5 overflow-x-auto no-scrollbar"
                >
                  {HERO_LENS_FRAMES.map((frame, idx) => {
                    const isSelected = idx === frameIndex;
                    return (
                      <button
                        key={frame.id}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        onClick={() => setFrameIndex(idx)}
                        className={`min-h-[36px] text-xs sm:text-sm font-medium tabular-nums transition-colors cursor-pointer whitespace-nowrap shrink-0 border-b-2 ${
                          isSelected
                            ? 'text-white border-[#FF4820]'
                            : 'text-white/60 border-transparent hover:text-white'
                        }`}
                      >
                        {frame.indexLabel}. {frame.shortLabel}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="hidden sm:block text-xs sm:text-sm font-medium text-white/68">
                  {heroStageBlock.description}
                </p>
              )}
            </div>

            <div
              role="group"
              aria-label="Режим сцены"
              className="inline-flex items-center p-1 rounded-full bg-black/48 backdrop-blur-md border border-white/14 ml-auto shrink-0"
            >
              <button
                type="button"
                onClick={() => contrastAudioEngine.selectLens('stream')}
                aria-pressed={!isExpanded}
                className={`min-h-[36px] px-3.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  !isExpanded
                    ? 'bg-white text-[#111111]'
                    : 'text-white/75 hover:text-white'
                }`}
              >
                Обычный эфир
              </button>
              <button
                type="button"
                onClick={() => contrastAudioEngine.selectLens('focus')}
                aria-pressed={isExpanded}
                className={`min-h-[36px] px-3.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isExpanded
                    ? 'bg-[#FF4820] text-white'
                    : 'text-white/75 hover:text-white'
                }`}
              >
                AudioWorks
              </button>
            </div>
          </div>

          {/* Нижняя строка холста: свободный заголовок слева (без перекрытий) + одна кнопка запуска справа */}
          <div className="relative z-30 mt-auto pt-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl space-y-2 pointer-events-none">
              {isExpanded ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeFrame.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-1.5"
                  >
                    <p className="text-xs sm:text-sm font-medium text-white/72">
                      {snap.hasCustomAudio && snap.customAudioName
                        ? `Шоурил · ${snap.customAudioName}`
                        : activeFrame.kicker}
                    </p>
                    <h2 className="text-2xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.08] text-white editorial-balance">
                      {activeFrame.title}
                    </h2>
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs sm:text-sm font-medium text-white/68">
                    {heroStageBlock.eyebrow}
                  </p>
                  <h2 className="text-xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-[1.12] text-white editorial-balance">
                    {heroStageBlock.title}
                  </h2>
                </div>
              )}
            </div>

            <div
              data-lens-interactive="true"
              className="flex flex-wrap items-center gap-2.5 shrink-0 cursor-default"
            >
              {isPlayingAny && (
                <button
                  type="button"
                  onClick={() => contrastAudioEngine.toggleRoadNoise()}
                  aria-pressed={snap.roadNoiseEnabled}
                  className={`min-h-[44px] px-4 rounded-full inline-flex items-center gap-2 text-xs font-semibold backdrop-blur-md border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    snap.roadNoiseEnabled
                      ? 'bg-[#FF4820]/25 border-[#FF4820] text-white'
                      : 'bg-black/45 border-white/18 text-white/82 hover:text-white'
                  }`}
                >
                  <Car className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Шум авто</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => contrastAudioEngine.toggleCrashTestOrShowreel()}
                className={`min-h-[46px] px-5 py-2.5 rounded-full inline-flex items-center gap-2.5 text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isPlayingAny || isStopPausePhase
                    ? 'bg-[#FF4820] text-white'
                    : 'bg-white text-[#111111] hover:bg-[#FF4820] hover:text-white'
                }`}
              >
                {isPlayingAny || isStopPausePhase ? (
                  <Pause className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                )}
                <span className="tabular-nums">
                  {isClutterPhase
                    ? `Эфирный блок · 0:0${Math.min(4, Math.floor(snap.crashElapsedSec))}`
                    : isStopPausePhase
                      ? 'Пауза · 0.5 сек'
                      : isPlayingAny
                        ? `Пауза · ${formatAudioTime(snap.filmElapsedSec)}`
                        : 'Краш-тест в эфире'}
                </span>
              </button>
            </div>
          </div>

          {/* Тонкая линия прогресса воспроизведения по нижнему краю */}
          {isPlayingAny && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-0.5 bg-white/12 overflow-hidden"
            >
              <div
                style={{
                  transform: `scaleX(${
                    (isClutterPhase ? clutterProgressPct : filmProgressPct) / 100
                  })`,
                }}
                className="w-full h-full bg-[#FF4820] origin-left transition-transform duration-150"
              />
            </div>
          )}
        </div>
      </section>

      {/* МАНИФЕСТ СТУДИИ (чистая журнальная типографика и воздух) */}
      <section
        aria-label="Манифест студии AudioWorks"
        className="py-18 sm:py-24 lg:py-28 px-4 sm:px-6 lg:px-12"
      >
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="space-y-6 max-w-5xl">
            <div className="flex items-center">
              <BrandLogo
                variant={brandVariant}
                size="lg"
                onOpenBrandKit={onOpenBrandKit}
              />
            </div>

            <h1 className="text-[clamp(2.25rem,4.2vw,3.75rem)] font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] editorial-balance">
              {heroManifestoBlock.title}{' '}
              <span className="text-[#111111]/44 dark:text-[#F4F3EF]/44">
                {manifestoSubtitle}
              </span>
            </h1>

            <p className="text-lg sm:text-2xl leading-[1.45] tracking-tight text-[#111111]/76 dark:text-[#F4F3EF]/76 max-w-3xl editorial-pretty">
              {heroManifestoBlock.description}
            </p>
          </div>

          {/* Спокойная строка отраслевого фокуса без лишних дублирующих ссылок */}
          <div className="pt-6 border-t border-[#111111]/10 dark:border-white/10 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
            <div className="inline-flex items-center gap-x-6 text-xs sm:text-sm">
              <span className="text-[#111111]/46 dark:text-[#F4F3EF]/46 font-medium whitespace-nowrap shrink-0">
                Отраслевой фокус
              </span>
              {VALID_PERSONAS.map((personaKey) => {
                const pSlot = LAYA_CONTENT_DICTIONARY[personaKey];
                const isSelected = decision.choice === personaKey;
                return (
                  <button
                    key={personaKey}
                    type="button"
                    onClick={() => selectPersonaProfile(personaKey)}
                    aria-pressed={isSelected}
                    className={`min-h-[42px] inline-flex items-center font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 border-b-2 ${
                      isSelected
                        ? 'text-[#111111] dark:text-[#F4F3EF] border-[#FF4820]'
                        : 'text-[#111111]/55 dark:text-[#F4F3EF]/55 border-transparent hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                    }`}
                  >
                    {pSlot.profileLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
