import { Car, Pause, Play, Volume1, Volume2, VolumeX } from 'lucide-react';
import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  FmTunerAudioSnapshot,
  fmTunerAudioEngine,
} from '../audio/fmTunerAudioEngine';
import { useSiteTextBlocks } from '../cms/SiteTextBlocksContext';
import { useStudioCms } from '../cms/StudioCmsContext';
import { formatAudioTime } from '../data/audioworksCommercial';
import { resolveHeroStagePlayback } from '../data/heroStageCms';
import { heroVideoStore, HeroVideoSnapshot } from '../data/heroVideoStore';
import { isSiteTextBlockModified } from '../data/siteTextBlocksData';
import { useLayaDecision } from '../engine/LayaContext';
import {
  computeHeroVisualOptics,
  HeroAbPole,
  shapeOscilloscopeSamplesForPole,
} from '../utils/heroAbComparison';
import { deriveWebpUrl } from '../utils/imageOptimization';
import {
  buildOscilloscopeCanvasPoints,
  CanvasWavePoint,
  extractSmoothedOscilloscopeSamples,
} from '../utils/oscilloscopeGeometry';

const STUDIO_FALLBACK_STILL_JPG =
  '/src/assets/images/hero_broadcast_booth_wide_1794605231279.jpg';
const STUDIO_FALLBACK_STILL_WEBP =
  deriveWebpUrl(STUDIO_FALLBACK_STILL_JPG) ?? STUDIO_FALLBACK_STILL_JPG;

export function HeroFMStage() {
  const { decision } = useLayaDecision();
  const { snapshot } = useStudioCms();
  const { getBlock } = useSiteTextBlocks();
  const heroManifestoBlock = getBlock('hero-manifesto');
  const manifestoModifiedInSession = isSiteTextBlockModified(heroManifestoBlock);

  const manifestoDescription = manifestoModifiedInSession
    ? heroManifestoBlock.description
    : snapshot.siteCopy.heroManifestoLead ||
      'Настройте радио так, чтобы оно приносило прибыль. Подбираем станции по цифрам аудитории, забираем горящие эфирные окна и создаём ролики, которые невозможно пропустить мимо ушей.';

  const [tunerSnap, setTunerSnap] = useState<FmTunerAudioSnapshot>(() =>
    fmTunerAudioEngine.getSnapshot()
  );
  const [videoSnap, setVideoSnap] = useState<HeroVideoSnapshot>(() =>
    heroVideoStore.getSnapshot()
  );
  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  const [isStageInView, setIsStageInView] = useState<boolean>(true);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scrubTrackRef = useRef<HTMLDivElement | null>(null);

  const isDraggingScrubRef = useRef<boolean>(false);
  const smoothedWaveRef = useRef<Float32Array | null>(null);
  const shapedWaveRef = useRef<Float32Array | null>(null);
  const tunerSnapRef = useRef<FmTunerAudioSnapshot>(tunerSnap);
  tunerSnapRef.current = tunerSnap;

  useEffect(() => {
    const unsubAudio = fmTunerAudioEngine.subscribe(setTunerSnap);
    const unsubVideo = heroVideoStore.subscribe((next) => {
      setIsVideoReady(false);
      setVideoSnap(next);
    });
    return () => {
      unsubAudio();
      unsubVideo();
      fmTunerAudioEngine.stopAll();
    };
  }, []);

  useEffect(() => {
    const resolved = resolveHeroStagePlayback(snapshot, decision.choice);
    fmTunerAudioEngine.syncCmsHeroStage(resolved);
  }, [snapshot, decision.choice]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = true;
    vid.playsInline = true;
    const playPromise = vid.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  }, [videoSnap.videoUrl]);

  // Отслеживаем видимость Hero, чтобы не нагружать CPU/GPU осциллографом вне первого экрана
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !stageRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]) {
          setIsStageInView(entries[0].isIntersecting);
        }
      },
      { threshold: 0.05 }
    );
    obs.observe(stageRef.current);
    return () => obs.disconnect();
  }, []);

  // Удержание клавиши «Пробел» для мгновенного сравнения «До / После» (когда фокус не на кнопке/поле ввода)
  useEffect(() => {
    if (!isStageInView || typeof window === 'undefined') return;

    const isInteractiveElementFocused = (target: EventTarget | null): boolean => {
      const el = (target as HTMLElement | null) ?? (document.activeElement as HTMLElement | null);
      if (!el) return false;
      const tag = el.tagName;
      if (
        tag === 'BUTTON' ||
        tag === 'A' ||
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable ||
        Boolean(el.closest('[role="dialog"], dialog'))
      ) {
        return true;
      }
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (isInteractiveElementFocused(e.target)) return;
      e.preventDefault();
      if (e.repeat) return;
      if (!tunerSnapRef.current.isBroadcastActive) {
        fmTunerAudioEngine.togglePlayPause();
      }
      fmTunerAudioEngine.setPeekComparisonActive(true);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (tunerSnapRef.current.isPeekComparing) {
        e.preventDefault();
        fmTunerAudioEngine.setPeekComparisonActive(false);
      }
    };

    const handleWindowBlur = () => {
      if (tunerSnapRef.current.isPeekComparing) {
        fmTunerAudioEngine.setPeekComparisonActive(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isStageInView]);

  // 60 FPS минималистичный осциллограф Web Audio API (динамичный студийный луч vs зажатая серая гребёнка эфира)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isStageInView) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const POINT_COUNT = 96;
    if (!smoothedWaveRef.current || smoothedWaveRef.current.length !== POINT_COUNT) {
      smoothedWaveRef.current = new Float32Array(POINT_COUNT);
    }
    if (!shapedWaveRef.current || shapedWaveRef.current.length !== POINT_COUNT) {
      shapedWaveRef.current = new Float32Array(POINT_COUNT);
    }

    const strokeSmoothQuadraticWave = (points: CanvasWavePoint[]) => {
      if (points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) * 0.5;
        const midY = (points[i].y + points[i + 1].y) * 0.5;
        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    };

    let rafId = 0;
    let lastLiveFlag = '';

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(300, Math.floor(parent.clientWidth));
      const h = Math.max(300, Math.floor(parent.clientHeight));
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const drawFrame = (nowMs: number) => {
      const parent = canvas.parentElement;
      const width = parent ? parent.clientWidth : 1280;
      const height = parent ? parent.clientHeight : 680;
      const snapNow = tunerSnapRef.current;
      const pole = snapNow.effectivePole;
      const timeSec = reducedMotion ? 1.2 : nowMs * 0.001;

      const timeDomainBytes = fmTunerAudioEngine.readAnalyserTimeDomainData();
      const frame = extractSmoothedOscilloscopeSamples({
        timeDomainBytes,
        pointCount: POINT_COUNT,
        timeSec,
        isBroadcastActive: snapNow.isBroadcastActive,
        isLockedOnStudio: pole === 'studio',
        interferenceLevel: pole === 'clutter' ? 0.85 : 0,
      });

      const nextLiveFlag = frame.usingLiveAnalyser ? 'true' : 'false';
      if (nextLiveFlag !== lastLiveFlag) {
        lastLiveFlag = nextLiveFlag;
        canvas.setAttribute('data-oscilloscope-live', nextLiveFlag);
        canvas.setAttribute(
          'data-analyser-connected',
          fmTunerAudioEngine.getAnalyserNode() ? 'true' : 'false'
        );
      }

      const shaped = shapeOscilloscopeSamplesForPole({
        rawSamples: frame.samples,
        pole,
        isPlaying: snapNow.isBroadcastActive,
        roadNoiseEnabled: snapNow.roadNoiseEnabled,
        timeSec,
        outBuffer: shapedWaveRef.current!,
      });

      const smoothBuf = smoothedWaveRef.current!;
      for (let i = 0; i < POINT_COUNT; i++) {
        const target = shaped[i];
        const prev = smoothBuf[i];
        const rate = Math.abs(target) > Math.abs(prev) ? 0.46 : 0.22;
        smoothBuf[i] = prev + (target - prev) * (reducedMotion ? 1 : rate);
      }

      ctx.clearRect(0, 0, width, height);

      // Размещаем ось волны в чистом верхнем воздухе кадра — с запасом над заголовком на всех экранах
      const centerY = width < 640 ? height * 0.22 : height * 0.30;
      const optics = computeHeroVisualOptics({
        pole,
        isPlaying: snapNow.isBroadcastActive,
        roadNoiseEnabled: snapNow.roadNoiseEnabled,
      });

      // Тонкая референсная ось 0 dB
      const axisGrad = ctx.createLinearGradient(0, centerY, width, centerY);
      axisGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      axisGrad.addColorStop(0.14, 'rgba(255, 255, 255, 0.08)');
      axisGrad.addColorStop(0.86, 'rgba(255, 255, 255, 0.08)');
      axisGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.strokeStyle = axisGrad;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      const dynamicEnergy = frame.usingLiveAnalyser
        ? Math.min(1, 0.38 + frame.rms * 2.1)
        : 0.25;
      const maxAmpPx =
        width < 640
          ? Math.min(height * 0.13, Math.max(34, height * (0.07 + dynamicEnergy * 0.05)))
          : Math.min(height * 0.21, Math.max(48, height * (0.10 + dynamicEnergy * 0.09)));

      const primaryPoints = buildOscilloscopeCanvasPoints(
        smoothBuf,
        width,
        centerY,
        maxAmpPx
      );

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Мягкий световой ореол волны
      ctx.strokeStyle = optics.waveGlowRgba;
      ctx.lineWidth = snapNow.isBroadcastActive ? 8 : 5;
      strokeSmoothQuadraticWave(primaryPoints);

      // Основная линия осциллографа
      ctx.strokeStyle = optics.wavePrimaryRgba;
      ctx.lineWidth = snapNow.isBroadcastActive ? 2.35 : 1.7;
      strokeSmoothQuadraticWave(primaryPoints);

      // Светлая сердцевина луча для чистого студийного звука FMWorks
      if (optics.waveCoreRgba && frame.usingLiveAnalyser) {
        ctx.strokeStyle = optics.waveCoreRgba;
        ctx.lineWidth = 0.95;
        strokeSmoothQuadraticWave(primaryPoints);
      }

      if (!reducedMotion && !document.hidden) {
        rafId = window.requestAnimationFrame(drawFrame);
      } else {
        rafId = 0;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rafId) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }
      } else if (!rafId) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    };

    if (!document.hidden) {
      rafId = window.requestAnimationFrame(drawFrame);
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [isStageInView]);

  const handleVolumeSliderChange = (e: FormEvent<HTMLInputElement>) => {
    const raw = Number.parseFloat(e.currentTarget.value);
    if (!Number.isFinite(raw)) return;
    fmTunerAudioEngine.setVolume(raw / 100);
  };

  const scrubRatioAtClientX = (clientX: number): number | null => {
    const el = scrubTrackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 2) return null;
    return Math.min(0.995, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const handleScrubPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    isDraggingScrubRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic environments
    }
    const ratio = scrubRatioAtClientX(e.clientX);
    if (ratio !== null) {
      fmTunerAudioEngine.seekStudioRatio(ratio);
    }
  };

  const handleScrubPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingScrubRef.current) return;
    const ratio = scrubRatioAtClientX(e.clientX);
    if (ratio !== null) {
      fmTunerAudioEngine.seekStudioRatio(ratio);
    }
  };

  const handleScrubPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingScrubRef.current) return;
    isDraggingScrubRef.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
  };

  const handleScrubTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (!t) return;
    isDraggingScrubRef.current = true;
    const ratio = scrubRatioAtClientX(t.clientX);
    if (ratio !== null) {
      fmTunerAudioEngine.seekStudioRatio(ratio);
    }
  };

  const handleScrubTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (!isDraggingScrubRef.current) return;
    const t = e.touches[0];
    if (!t) return;
    const ratio = scrubRatioAtClientX(t.clientX);
    if (ratio !== null) {
      fmTunerAudioEngine.seekStudioRatio(ratio);
    }
  };

  const handleScrubTouchEnd = () => {
    isDraggingScrubRef.current = false;
  };

  const handleScrubKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      fmTunerAudioEngine.stepStudioSeconds(5);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      fmTunerAudioEngine.stepStudioSeconds(-5);
    } else if (e.key === 'Home') {
      e.preventDefault();
      fmTunerAudioEngine.seekStudioRatio(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      fmTunerAudioEngine.seekStudioRatio(0.96);
    }
  };

  const handleSwitchKeyDown = (
    e: ReactKeyboardEvent<HTMLDivElement>,
    currentPole: HeroAbPole
  ) => {
    if (e.key === 'ArrowLeft' && currentPole !== 'clutter') {
      e.preventDefault();
      fmTunerAudioEngine.selectAbPole('clutter', true);
    } else if (e.key === 'ArrowRight' && currentPole !== 'studio') {
      e.preventDefault();
      fmTunerAudioEngine.selectAbPole('studio', true);
    }
  };

  const activePole = tunerSnap.effectivePole;
  const isStudioPole = activePole === 'studio';
  const isPlaying = tunerSnap.isBroadcastActive;
  const effectiveVolumePct = tunerSnap.isMuted ? 0 : Math.round(tunerSnap.volume * 100);

  const optics = computeHeroVisualOptics({
    pole: activePole,
    isPlaying,
    roadNoiseEnabled: tunerSnap.roadNoiseEnabled,
  });

  const stageContextLabelDesktop = tunerSnap.isPeekComparing
    ? `Быстрое сравнение · Сейчас звучит: ${
        isStudioPole ? 'Ролик FMWorks' : 'Обычный эфир'
      }`
    : isStudioPole
      ? 'Сравнение в 1 клик · Режиссура FMWorks против потокового эфира'
      : 'Режим сравнения · Типичный потоковый ролик в рекламном блоке';

  const stageContextLabelMobile = tunerSnap.isPeekComparing
    ? `Сейчас: ${isStudioPole ? 'Ролик FMWorks' : 'Обычный эфир'}`
    : isStudioPole
      ? 'Сравнение · Эфир против FMWorks'
      : 'Режим · Типичный ролик эфира';

  const stageSubtitle = isStudioPole
    ? tunerSnap.trackLabel
      ? `Сейчас выбран: ${tunerSnap.trackLabel}. Переключите тумблер в «Обычный эфир», чтобы услышать контраст на той же секунде.`
      : 'Выверенная пауза, редкие голоса дубляжа и кристальная разборчивость — сравните с обычным радиопотоком в один клик.'
    : 'Скороговорка, стоковая подложка и штампы «скидки до конца месяца» — именно такой звук мозг отфильтровывает на 2-й секунде.';

  return (
    <>
      {/* 1. МИНИМАЛИСТИЧНОЕ КИНО-ПОЛОТНО A/B-СРАВНЕНИЯ (Apple AirPods Pro × Adobe Podcast × koto.com) */}
      <section
        id="top"
        aria-label="Сравнение ролика FMWorks с обычным рекламным блоком в радиоэфире"
        className="px-3 sm:px-6 lg:px-8 pt-2 pb-4"
      >
        <div
          ref={stageRef}
          data-testid="hero-fm-stage"
          data-hero-ab-mode={activePole}
          data-fm-locked={isStudioPole ? 'true' : 'false'}
          data-road-noise={tunerSnap.roadNoiseEnabled ? 'true' : 'false'}
          data-broadcast-active={isPlaying ? 'true' : 'false'}
          className="relative w-full max-w-7xl mx-auto min-h-[72svh] sm:min-h-[78vh] rounded-2xl sm:rounded-[28px] overflow-hidden bg-[#0D0D0F] text-white border border-[#111111]/10 dark:border-white/10 shadow-[0_24px_64px_rgba(13,13,15,0.18)] flex flex-col justify-between p-4 sm:p-8 lg:p-10"
        >
          {/* Слой 1: Резервный студийный кино-кадр в WebP с высоким приоритетом */}
          <picture className="pointer-events-none absolute inset-0 w-full h-full z-[1]">
            <source srcSet={STUDIO_FALLBACK_STILL_WEBP} type="image/webp" />
            <img
              src={STUDIO_FALLBACK_STILL_JPG}
              alt="Студийный микрофон FMWorks в тёплом контровом свете"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              referrerPolicy="no-referrer"
              style={{
                filter: `blur(${optics.videoBlurPx}px) grayscale(${optics.videoGrayscalePct}%) brightness(${optics.videoBrightness}) contrast(${optics.videoContrast})`,
              }}
              className={`w-full h-full object-cover object-center scale-[1.09] transition-[filter,opacity] duration-300 ${
                isVideoReady ? 'opacity-20' : 'opacity-82'
              }`}
            />
          </picture>

          {/* Слой 2: Фоновое MP4-видео студии (управляется в 1 клик из пульта Laya AI) */}
          <video
            ref={videoRef}
            key={videoSnap.videoUrl}
            data-testid="hero-background-video"
            src={videoSnap.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlay={() => {
              setIsVideoReady(true);
              heroVideoStore.clearError();
            }}
            onLoadedData={() => {
              setIsVideoReady(true);
              heroVideoStore.clearError();
            }}
            onError={() => {
              setIsVideoReady(false);
              heroVideoStore.reportPlaybackError();
            }}
            style={{
              filter: `blur(${optics.videoBlurPx}px) grayscale(${optics.videoGrayscalePct}%) brightness(${optics.videoBrightness}) contrast(${optics.videoContrast})`,
            }}
            className={`pointer-events-none absolute inset-0 w-full h-full object-cover scale-[1.04] transition-[filter,opacity] duration-300 z-[2] ${
              isVideoReady ? 'opacity-92' : 'opacity-0'
            }`}
          />

          {/* Слой 3: Тонкая текстура эфирной компрессии только для полюса «Обычный эфир» */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 z-[3] transition-opacity duration-300 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.045)_0px,rgba(255,255,255,0.045)_1px,transparent_1px,transparent_4px)] ${
              optics.showClutterStreamOverlay ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Слой 4: Выверенный вертикальный и левосторонний скимм — текст слева читается идеально, микрофон справа остаётся светлым */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[4] bg-gradient-to-b from-black/58 via-black/20 to-black/88"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[4] bg-gradient-to-r from-[#0A0A0D]/82 via-[#0A0A0D]/42 to-transparent"
          />

          {/* Слой 5: Полупрозрачный Web Audio API осциллограф в открытой центральной зоне */}
          <canvas
            ref={canvasRef}
            data-testid="hero-acoustic-canvas"
            data-oscilloscope="analyser-node"
            data-oscilloscope-live="false"
            data-analyser-connected="false"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 w-full h-full z-[5] opacity-90 mix-blend-screen"
          />

          {/* ВЕРХНЯЯ СТРОКА ПОЛОТНА: спокойный необрамлённый контекст без обрезанных слов */}
          <div className="relative z-20 flex items-center justify-between gap-4 text-xs sm:text-[13px]">
            <p
              data-testid="hero-ab-context-line"
              className="font-medium text-white/72 whitespace-nowrap"
            >
              <span className="sm:hidden">{stageContextLabelMobile}</span>
              <span className="hidden sm:inline">{stageContextLabelDesktop}</span>
            </p>
            <p className="hidden lg:block text-white/46 whitespace-nowrap shrink-0 tabular-nums">
              Удерживайте Пробел — мгновенно сравнить «До / После»
            </p>
          </div>

          {/* НИЖНЯЯ ЗОНА ПОЛОТНА: СМЫСЛОВОЙ ЗАГОЛОВОК + ЕДИНАЯ ТОНКАЯ ДЕКА СРАВНЕНИЯ */}
          <div className="relative z-20 mt-auto pt-24 sm:pt-32 space-y-5 sm:space-y-6">
            {/* Смысловой оффер прямо на первом экране — понятен за 1 секунду даже без звука */}
            <div className="max-w-2xl space-y-2.5">
              <h1 className="text-[clamp(1.85rem,3.8vw,3.3rem)] font-bold tracking-tight leading-[1.06] text-white editorial-balance">
                <span className="block">Мы FMWorks.</span>
                <span className="block text-white/64">
                  Ролики, которые пробивают эфирный шум.
                </span>
              </h1>
              <p
                data-testid="hero-ab-subtitle"
                className="text-sm sm:text-base leading-relaxed text-white/76 max-w-xl editorial-pretty transition-colors duration-200"
              >
                {stageSubtitle}
              </p>
            </div>

            {tunerSnap.audioError && (
              <p
                role="alert"
                className="text-xs font-medium text-[#FFB4A2]"
              >
                {tunerSnap.audioError}
              </p>
            )}

            {/* ЕДИНАЯ ТОНКАЯ СТЕКЛЯННАЯ ДЕКА УПРАВЛЕНИЯ (без вложенных карточек и лишних этажей) */}
            <div
              data-testid="hero-fm-tuner-console"
              className="w-full backdrop-blur-xl bg-[#0D0D0F]/76 border border-white/12 rounded-2xl px-3.5 pt-3 pb-2.5 sm:px-5 sm:pt-3.5 sm:pb-3 text-white"
            >
              <div className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_1fr] items-center gap-y-2.5 gap-x-3 sm:gap-x-4">
                {/* Зона 1 (Слева на десктопе, внизу слева на мобильном): Пуск/Пауза и таймкод */}
                <div className="order-2 md:order-1 flex items-center gap-2.5 sm:gap-3 min-w-0 justify-self-start">
                  <button
                    type="button"
                    data-testid="hero-fm-play-btn"
                    onClick={() => fmTunerAudioEngine.togglePlayPause()}
                    aria-label={
                      isPlaying
                        ? 'Поставить сравнение на паузу'
                        : 'Включить аудиосравнение роликов'
                    }
                    className="w-11 h-11 rounded-full bg-white text-[#0D0D0F] hover:bg-white/90 active:scale-[0.98] inline-flex items-center justify-center shrink-0 transition-transform duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                    ) : (
                      <Play className="w-4 h-4 fill-current translate-x-[1px] shrink-0" aria-hidden="true" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <span className="block text-xs sm:text-[13px] font-semibold text-white whitespace-nowrap truncate">
                      {isPlaying
                        ? isStudioPole
                          ? 'Звучит FMWorks'
                          : 'Звучит обычный эфир'
                        : 'Слушать сравнение'}
                    </span>
                    <span
                      data-testid="hero-ab-timecode"
                      className="block text-[11px] font-mono tabular-nums text-white/56 whitespace-nowrap"
                    >
                      {formatAudioTime(tunerSnap.elapsedSec)} /{' '}
                      {formatAudioTime(tunerSnap.durationSec)}
                    </span>
                  </div>
                </div>

                {/* Зона 2 (Центральный герой — тактильный тумблер «Обычный эфир ↔ Ролик FMWorks») */}
                <div
                  role="group"
                  aria-label="Переключатель сравнения: обычный ролик эфира или ролик FMWorks"
                  onKeyDown={(e) => handleSwitchKeyDown(e, activePole)}
                  className="col-span-2 order-1 md:col-span-1 md:order-2 md:justify-self-center p-1 rounded-xl bg-white/[0.07] border border-white/10 grid grid-cols-2 md:inline-flex items-center gap-1"
                >
                  <button
                    type="button"
                    data-testid="hero-ab-pole-clutter"
                    aria-pressed={!isStudioPole}
                    onClick={() => fmTunerAudioEngine.selectAbPole('clutter', true)}
                    className={`min-h-[42px] md:min-h-[38px] px-3.5 lg:px-5 rounded-lg text-xs sm:text-[13px] font-semibold whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF4820] ${
                      !isStudioPole
                        ? 'bg-white/20 text-white shadow-sm'
                        : 'text-white/64 hover:text-white'
                    }`}
                  >
                    Обычный эфир
                  </button>

                  <button
                    type="button"
                    data-testid="hero-ab-pole-studio"
                    aria-pressed={isStudioPole}
                    onClick={() => fmTunerAudioEngine.selectAbPole('studio', true)}
                    className={`min-h-[42px] md:min-h-[38px] px-3.5 lg:px-5 rounded-lg text-xs sm:text-[13px] font-semibold whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-white ${
                      isStudioPole
                        ? 'bg-[#FF4820] text-white shadow-[0_6px_20px_rgba(255,72,32,0.36)]'
                        : 'text-white/64 hover:text-white'
                    }`}
                  >
                    Ролик FMWorks
                  </button>
                </div>

                {/* Зона 3 (Справа: контекстный тумблер «В шуме авто» + чистая монохромная громкость) */}
                <div className="order-3 md:order-3 flex items-center gap-1.5 sm:gap-2.5 justify-self-end shrink-0">
                  <button
                    type="button"
                    data-testid="hero-ab-road-noise-btn"
                    onClick={() => fmTunerAudioEngine.toggleRoadNoise()}
                    aria-pressed={tunerSnap.roadNoiseEnabled}
                    title="Проверить разборчивость ролика на фоне акустического гула автомобиля (70 км/ч)"
                    className={`min-h-[42px] md:min-h-[38px] px-3 sm:px-3.5 rounded-lg inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF4820] ${
                      tunerSnap.roadNoiseEnabled
                        ? 'bg-white/18 text-white ring-1 ring-white/30'
                        : 'text-white/68 hover:text-white hover:bg-white/[0.07]'
                    }`}
                  >
                    <Car className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="sm:hidden">В авто</span>
                    <span className="hidden sm:inline">В шуме авто</span>
                  </button>

                  <span
                    aria-hidden="true"
                    className="hidden lg:block w-px h-4 bg-white/12 shrink-0"
                  />

                  <div className="inline-flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      data-testid="hero-fm-mute-btn"
                      onClick={() => fmTunerAudioEngine.toggleMute()}
                      aria-label={
                        tunerSnap.isMuted || effectiveVolumePct === 0
                          ? 'Включить звук'
                          : 'Приглушить звук'
                      }
                      className="w-10 h-10 md:w-9 md:h-9 rounded-lg inline-flex items-center justify-center text-white/75 hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-[#FF4820]"
                    >
                      {tunerSnap.isMuted || effectiveVolumePct === 0 ? (
                        <VolumeX className="w-4 h-4 text-[#FF4820]" aria-hidden="true" />
                      ) : effectiveVolumePct < 50 ? (
                        <Volume1 className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Volume2 className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>

                    <div className="hidden lg:flex relative w-16 h-7 items-center select-none">
                      <div className="w-full h-1 rounded-full bg-white/18 overflow-hidden pointer-events-none">
                        <div
                          style={{ width: `${effectiveVolumePct}%` }}
                          className="h-full rounded-full bg-white/85 transition-[width] duration-75"
                        />
                      </div>
                      <span
                        aria-hidden="true"
                        style={{
                          left: `calc(${effectiveVolumePct}% - ${(effectiveVolumePct / 100) * 10}px)`,
                        }}
                        className="pointer-events-none absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-[left] duration-75"
                      />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={effectiveVolumePct}
                        onChange={handleVolumeSliderChange}
                        onInput={handleVolumeSliderChange}
                        aria-label="Громкость аудиосравнения FMWorks"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Тонкая интегрированная нить прогресса и перемотки (всегда на месте, 0 скачков высоты) */}
              <div
                ref={scrubTrackRef}
                data-testid="hero-fm-playback-scrub"
                onPointerDown={handleScrubPointerDown}
                onPointerMove={handleScrubPointerMove}
                onPointerUp={handleScrubPointerUp}
                onPointerCancel={handleScrubPointerUp}
                onTouchStart={handleScrubTouchStart}
                onTouchMove={handleScrubTouchMove}
                onTouchEnd={handleScrubTouchEnd}
                onKeyDown={handleScrubKeyDown}
                role="slider"
                tabIndex={0}
                aria-label="Позиция воспроизведения ролика FMWorks"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(tunerSnap.progressRatio * 100)}
                aria-valuetext={`${formatAudioTime(tunerSnap.elapsedSec)} из ${formatAudioTime(tunerSnap.durationSec)}`}
                className="mt-2.5 pt-1 pb-0.5 flex items-center cursor-pointer touch-none select-none group focus-visible:outline-2 focus-visible:outline-[#FF4820] rounded"
              >
                <div className="relative w-full h-[3px] group-hover:h-[5px] rounded-full bg-white/12 overflow-hidden transition-[height] duration-150">
                  <div
                    style={{ width: `${Math.round(tunerSnap.progressRatio * 100)}%` }}
                    className={`h-full transition-[width,background-color] duration-100 ${
                      isStudioPole ? 'bg-[#FF4820]' : 'bg-white/55'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ВОЗДУШНЫЙ РЕДАКЦИОННЫЙ БЛОК ПОД ПОЛОТНОМ (пропорции koto.com, без дубля H1) */}
      <section
        aria-label="Подход и специализация студии FMWorks"
        className="py-14 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-12"
      >
        <div className="max-w-7xl mx-auto">
          <div className="space-y-5 sm:space-y-6 max-w-4xl">
            <h2 className="text-[clamp(1.75rem,3.4vw,2.85rem)] font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance">
              Аудиореклама, которая работает на окупаемость.
            </h2>

            <p className="text-base sm:text-xl lg:text-2xl leading-[1.48] tracking-tight text-[#111111]/76 dark:text-[#F4F3EF]/76 max-w-3xl editorial-pretty">
              {manifestoDescription}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
