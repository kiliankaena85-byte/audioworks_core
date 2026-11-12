import { Car, Pause, Play } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { MouseEvent, useEffect, useRef, useState } from 'react';
import {
  contrastAudioEngine,
  ContrastStageSnapshot,
} from '../audio/contrastAudioEngine';
import {
  formatAudioTime,
  getCinemaSceneIdAtTime,
  HERO_CINEMA_SCENES,
  HERO_STREAM_BG_IMAGE,
  HeroSceneId,
} from '../data/audioworksCommercial';
import { LayaPersona, LayaPersonaSlot } from '../engine/layaTypes';

interface HeroCinemaStageProps {
  slot: LayaPersonaSlot;
}

function getDefaultSceneForPersona(persona: LayaPersona): HeroSceneId {
  if (persona === 'fmcg') return 'taste';
  if (persona === 'real_estate') return 'status';
  return 'studio';
}

export function HeroCinemaStage({ slot }: HeroCinemaStageProps) {
  const [snap, setSnap] = useState<ContrastStageSnapshot>(() =>
    contrastAudioEngine.getSnapshot()
  );
  const [activeSceneId, setActiveSceneId] = useState<HeroSceneId>(() =>
    getDefaultSceneForPersona(slot.id)
  );
  const manualLockUntilRef = useRef<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isSignatureRef = useRef<boolean>(snap.mode === 'focus');

  const isSignatureMode = snap.mode === 'focus' || snap.mode === 'silence';
  const isPlayingAny = snap.isFilmPlaying || snap.isSoundPlaying;
  isSignatureRef.current = isSignatureMode;

  useEffect(() => {
    const unsubscribe = contrastAudioEngine.subscribe(setSnap);
    return () => {
      unsubscribe();
      contrastAudioEngine.stopAll();
    };
  }, []);

  useEffect(() => {
    contrastAudioEngine.syncPersonaConfig(slot.focusChordPreset, slot.focusWords.length);
    setActiveSceneId(getDefaultSceneForPersona(slot.id));
  }, [slot.id, slot.focusChordPreset, slot.focusWords.length]);

  // Синхронная смена кино-кадра под голос диктора ИЛИ плавное слайд-шоу в режиме Почерка
  useEffect(() => {
    if (!isSignatureMode) return;

    if (isPlayingAny && snap.filmElapsedSec >= 6.0) {
      if (Date.now() < manualLockUntilRef.current) return;
      const syncedScene = getCinemaSceneIdAtTime(snap.filmElapsedSec);
      setActiveSceneId((prev) => (prev === syncedScene ? prev : syncedScene));
      return;
    }

    const slideTimer = window.setInterval(() => {
      if (Date.now() < manualLockUntilRef.current) return;
      setActiveSceneId((prev) => {
        const idx = HERO_CINEMA_SCENES.findIndex((s) => s.id === prev);
        const nextIdx = (idx + 1) % HERO_CINEMA_SCENES.length;
        return HERO_CINEMA_SCENES[nextIdx].id;
      });
    }, 6500);

    return () => window.clearInterval(slideTimer);
  }, [isSignatureMode, isPlayingAny, snap.filmElapsedSec]);

  // Интерактивная реактивная 3D/Canvas звуковая скульптура (AnalyserNode Web Audio API)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const fftBins = new Uint8Array(new ArrayBuffer(64));
    let smoothBass = 0.14;
    let smoothMid = 0.12;
    let smoothHigh = 0.1;
    let phase = 0;
    let rafId = 0;
    let lastDrawTime = 0;

    const syncCanvasResolution = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nextW = Math.max(320, Math.floor(rect.width * dpr));
      const nextH = Math.max(120, Math.floor(rect.height * dpr));
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }
    };

    syncCanvasResolution();
    window.addEventListener('resize', syncCanvasResolution);

    const renderFrame = (now: number) => {
      rafId = window.requestAnimationFrame(renderFrame);
      // Стабильные ~30 кадров/сек: плавная пластика волн и нулевая нагрузка на CPU
      if (now - lastDrawTime < 32) return;
      const dt = Math.min(0.06, (now - lastDrawTime) / 1000);
      lastDrawTime = now;

      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);

      const hasLiveAudio = contrastAudioEngine.readFrequencyBins(fftBins);
      const signatureActive = isSignatureRef.current;

      if (hasLiveAudio) {
        let bassAcc = 0;
        let midAcc = 0;
        let highAcc = 0;
        for (let i = 1; i <= 8; i++) bassAcc += fftBins[i];
        for (let i = 9; i <= 24; i++) midAcc += fftBins[i];
        for (let i = 25; i <= 44; i++) highAcc += fftBins[i];

        const targetBass = bassAcc / (8 * 255);
        const targetMid = midAcc / (16 * 255);
        const targetHigh = highAcc / (20 * 255);

        smoothBass += (targetBass - smoothBass) * 0.28;
        smoothMid += (targetMid - smoothMid) * 0.26;
        smoothHigh += (targetHigh - smoothHigh) * 0.24;
      } else {
        const idleTarget = signatureActive ? 0.2 : 0.06;
        smoothBass += (idleTarget - smoothBass) * 0.08;
        smoothMid += (idleTarget * 0.85 - smoothMid) * 0.08;
        smoothHigh += (idleTarget * 0.65 - smoothHigh) * 0.08;
      }

      phase += dt * (hasLiveAudio ? 2.8 + smoothMid * 2.4 : 1.05);

      if (!signatureActive) {
        // РЕЖИМ 1: Плоская зажатая серая нить монотонного радио-потока
        const baseY = h * 0.64;
        ctx2d.beginPath();
        const points = 64;
        for (let i = 0; i <= points; i++) {
          const u = i / points;
          const x = u * w;
          const edgeFade = Math.sin(u * Math.PI);
          const jitter =
            Math.sin(u * 26 + phase * 3.5) * (h * 0.035 * (0.4 + smoothMid)) * edgeFade;
          const y = baseY + jitter;
          if (i === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
        }
        ctx2d.strokeStyle = 'rgba(215, 216, 222, 0.34)';
        ctx2d.lineWidth = Math.max(1.5, w * 0.0014);
        ctx2d.stroke();
        return;
      }

      // РЕЖИМ 2: 3D-перспективная акустическая скульптура AudioWorks (#FF4820 + тёплое золото)
      const ribbons = [
        {
          depthZ: 0.35,
          colorStart: 'rgba(255, 72, 32, 0.08)',
          colorMid: 'rgba(255, 72, 32, 0.95)',
          colorEnd: 'rgba(255, 168, 76, 0.08)',
          freq: 2.3,
          harmonic: 5.1,
          phaseOffset: 0,
          ampScale: 1.0,
          widthPx: 2.8,
        },
        {
          depthZ: 0.55,
          colorStart: 'rgba(255, 184, 77, 0.06)',
          colorMid: 'rgba(255, 196, 107, 0.88)',
          colorEnd: 'rgba(255, 72, 32, 0.06)',
          freq: 3.1,
          harmonic: 6.4,
          phaseOffset: 1.35,
          ampScale: 0.82,
          widthPx: 2.1,
        },
        {
          depthZ: 0.75,
          colorStart: 'rgba(255, 228, 168, 0.04)',
          colorMid: 'rgba(255, 232, 178, 0.68)',
          colorEnd: 'rgba(255, 140, 66, 0.04)',
          freq: 1.8,
          harmonic: 4.2,
          phaseOffset: 2.6,
          ampScale: 0.64,
          widthPx: 1.6,
        },
        {
          depthZ: 0.92,
          colorStart: 'rgba(255, 72, 32, 0.03)',
          colorMid: 'rgba(255, 108, 64, 0.52)',
          colorEnd: 'rgba(255, 196, 107, 0.03)',
          freq: 3.9,
          harmonic: 7.5,
          phaseOffset: 4.0,
          ampScale: 0.5,
          widthPx: 1.3,
        },
      ];

      // Мягкое тёплое акустическое свечение под нитями
      const glowRadius = Math.max(w * 0.36, 180);
      const centerGlow = ctx2d.createRadialGradient(
        w * 0.5,
        h * 0.58,
        8,
        w * 0.5,
        h * 0.58,
        glowRadius
      );
      const glowAlpha = Math.min(0.36, 0.12 + smoothBass * 0.32);
      centerGlow.addColorStop(0, `rgba(255, 72, 32, ${glowAlpha.toFixed(3)})`);
      centerGlow.addColorStop(0.55, `rgba(255, 176, 72, ${(glowAlpha * 0.45).toFixed(3)})`);
      centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx2d.fillStyle = centerGlow;
      ctx2d.fillRect(0, 0, w, h);

      const segments = 84;
      ribbons.forEach((ribbon, rIdx) => {
        const grad = ctx2d.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, ribbon.colorStart);
        grad.addColorStop(0.22, ribbon.colorMid);
        grad.addColorStop(0.5, rIdx % 2 === 0 ? 'rgba(255, 210, 130, 0.96)' : ribbon.colorMid);
        grad.addColorStop(0.78, ribbon.colorMid);
        grad.addColorStop(1, ribbon.colorEnd);

        const perspectiveY = h * (0.48 + ribbon.depthZ * 0.24);
        const perspectiveScale = 1 / (0.82 + ribbon.depthZ * 0.45);
        const energy =
          (0.16 + smoothBass * 0.65 + smoothMid * 0.55 + smoothHigh * 0.3) *
          ribbon.ampScale *
          perspectiveScale;

        ctx2d.beginPath();
        for (let i = 0; i <= segments; i++) {
          const u = i / segments;
          const x = u * w;
          const envelope = Math.pow(Math.sin(u * Math.PI), 1.35);

          const binIdx = Math.min(42, Math.floor(Math.abs(u - 0.5) * 2 * 36) + 2);
          const localBin = hasLiveAudio ? (fftBins[binIdx] ?? 0) / 255 : 0.22;

          const wavePrimary = Math.sin(u * Math.PI * 2 * ribbon.freq + phase + ribbon.phaseOffset);
          const waveSecondary = Math.cos(
            u * Math.PI * 2 * ribbon.harmonic - phase * 1.28 + ribbon.phaseOffset
          );
          const displacement =
            (wavePrimary * 0.68 + waveSecondary * 0.32) *
            h *
            0.34 *
            (energy + localBin * 0.18) *
            envelope;

          const y = perspectiveY + displacement;
          if (i === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
        }

        ctx2d.strokeStyle = grad;
        ctx2d.lineWidth = ribbon.widthPx * Math.min(2, Math.max(1, w / 900));
        ctx2d.lineCap = 'round';
        ctx2d.stroke();
      });
    };

    rafId = window.requestAnimationFrame(renderFrame);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncCanvasResolution);
    };
  }, []);

  const currentScene =
    HERO_CINEMA_SCENES.find((s) => s.id === activeSceneId) ?? HERO_CINEMA_SCENES[0];

  const handleActivateShowreel = () => {
    manualLockUntilRef.current = Date.now() + 8500;
    setActiveSceneId('studio');
    contrastAudioEngine.startSignatureShowreel(HERO_CINEMA_SCENES[0].audioSeekSec);
  };

  const handleSelectSceneTab = (sceneId: HeroSceneId) => {
    const target = HERO_CINEMA_SCENES.find((s) => s.id === sceneId) ?? HERO_CINEMA_SCENES[0];
    manualLockUntilRef.current = Date.now() + 9000;
    setActiveSceneId(sceneId);

    if (!isSignatureMode || isPlayingAny) {
      contrastAudioEngine.startSignatureShowreel(target.audioSeekSec);
    }
  };

  const handleTimelineScrub = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    manualLockUntilRef.current = 0;
    const ratio = (e.clientX - rect.left) / rect.width;
    contrastAudioEngine.seekToRatio(ratio);
  };

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

  const progressPercent = isPlayingAny
    ? Math.min(100, Math.max(3, Math.round((snap.filmElapsedSec / snap.filmDurationSec) * 100)))
    : isSignatureMode
      ? 100
      : 14;

  return (
    <div className="space-y-4">
      {/* Main Widescreen Cinema Media Stage (480px–540px, rounded-3xl) */}
      <div
        data-testid="hero-cinema-stage"
        data-stage-mode={isSignatureMode ? 'focus' : 'stream'}
        data-active-scene={activeSceneId}
        className="relative w-full h-[500px] sm:h-[520px] lg:h-[540px] rounded-3xl overflow-hidden bg-[#101013] text-[#F4F3EF] border border-[#111111]/12 dark:border-white/12 flex flex-col justify-between p-5 sm:p-8 lg:p-10 select-none"
      >
        {/* LAYER 1A: Mode 1 Background Photography (Evening Traffic / Rainy Glass with Grayscale & Blur) */}
        <div
          aria-hidden={isSignatureMode}
          className={`absolute inset-0 transition-opacity duration-700 ${
            isSignatureMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <img
            src={HERO_STREAM_BG_IMAGE}
            alt="Вечерний городской поток сквозь дождливое стекло автомобиля"
            decoding="async"
            className="w-full h-full object-cover animate-ken-burns grayscale contrast-75 blur-[2px] brightness-[0.42] scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0D0D10]/70 via-[#0D0D10]/45 to-[#0D0D10]/90" />
        </div>

        {/* LAYER 1B: Mode 2 Stacked Preloaded Widescreen Cinema Photography (Zero Flicker + Ken Burns) */}
        <div
          aria-hidden={!isSignatureMode}
          className={`absolute inset-0 transition-opacity duration-700 ${
            isSignatureMode ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {HERO_CINEMA_SCENES.map((scene) => {
            const isCurrent = scene.id === activeSceneId;
            const exposureClass =
              scene.id === 'studio'
                ? 'brightness-[1.28] contrast-[1.06] saturate-[1.14]'
                : 'brightness-[0.96] contrast-[1.03]';
            return (
              <img
                key={scene.id}
                src={scene.imageUrl}
                alt={scene.imageAlt}
                decoding="async"
                className={`absolute inset-0 w-full h-full object-cover animate-ken-burns transition-opacity duration-700 ${exposureClass} ${
                  isCurrent ? 'opacity-100' : 'opacity-0'
                }`}
              />
            );
          })}
          {/* Cinematic Studio Vignette for Crisp Editorial Readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090B]/86 via-[#09090B]/24 to-[#09090B]/44" />
        </div>

        {/* LAYER 2: Lower-Third Reactive 3D/Canvas Sound Sculpture (AnalyserNode Web Audio API) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-10 h-44 sm:h-52 z-10"
        >
          <canvas
            ref={canvasRef}
            data-testid="hero-acoustic-canvas"
            className="w-full h-full block"
          />
        </div>

        {/* LAYER 3: Top Bar — Mode Switcher + Glowing ON AIR Badge & Road Noise Toggle */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Режим медиа-сцены"
            className="inline-flex items-center p-1 rounded-full bg-black/45 backdrop-blur-md border border-white/15"
          >
            <button
              type="button"
              onClick={() => contrastAudioEngine.selectLens('stream')}
              aria-pressed={!isSignatureMode}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                !isSignatureMode
                  ? 'bg-white text-[#111111]'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              Обычный эфир
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isSignatureMode) {
                  handleActivateShowreel();
                }
              }}
              aria-pressed={isSignatureMode}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isSignatureMode
                  ? 'bg-[#FF4820] text-white'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              Почерк FMWorks
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Glowing ON AIR Indicator on Studio Scene */}
            {isSignatureMode && currentScene.showOnAirBadge && (
              <div
                data-testid="studio-on-air-badge"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/55 backdrop-blur-md border border-[#FF4820]/55 text-xs font-semibold tracking-wide text-white shadow-[0_0_24px_rgba(255,72,32,0.42)]"
              >
                <span
                  className="w-2 h-2 rounded-full bg-[#FF4820] shadow-[0_0_10px_#FF4820] animate-pulse"
                  aria-hidden="true"
                />
                <span>ON AIR</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => contrastAudioEngine.toggleRoadNoise()}
              aria-pressed={snap.roadNoiseEnabled}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors border cursor-pointer whitespace-nowrap backdrop-blur-md ${
                snap.roadNoiseEnabled
                  ? 'bg-[#FF4820]/25 border-[#FF4820] text-white'
                  : 'bg-black/40 border-white/15 text-white/80 hover:text-white'
              }`}
            >
              <Car className="w-4 h-4" aria-hidden="true" />
              <span>Шум дороги</span>
            </button>
          </div>
        </div>

        {/* LAYER 4: Center Cinema Storytelling Content */}
        <div className="relative z-20 my-auto py-4">
          <AnimatePresence mode="wait">
            {!isSignatureMode ? (
              /* MODE 1: ОБЫЧНЫЙ ЭФИР (Фоновый шум + плывущие радио-штампы + Главная кнопка шоурила) */
              <motion.div
                key="mode-ordinary-stream"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24 }}
                className="space-y-6"
              >
                <div className="space-y-3.5 overflow-hidden py-1">
                  <div className="flex whitespace-nowrap gap-10 animate-stream-left opacity-38 blur-[0.6px] text-lg sm:text-2xl font-medium text-white/80">
                    {rowOne.map((phrase, idx) => (
                      <span key={`m1-${idx}`}>{phrase}</span>
                    ))}
                  </div>

                  <div className="flex whitespace-nowrap gap-10 animate-stream-right opacity-48 text-xl sm:text-3xl font-semibold text-white/85">
                    {rowTwo.map((phrase, idx) => (
                      <span key={`m2-${idx}`}>{phrase}</span>
                    ))}
                  </div>

                  <div className="flex whitespace-nowrap gap-10 animate-stream-left-slow opacity-32 blur-[0.8px] text-lg sm:text-2xl font-medium text-white/75">
                    {rowThree.map((phrase, idx) => (
                      <span key={`m3-${idx}`}>{phrase}</span>
                    ))}
                  </div>
                </div>

                {/* Centerpiece Showreel Trigger */}
                <div className="pt-2 flex flex-col items-center text-center gap-3">
                  <button
                    type="button"
                    onClick={handleActivateShowreel}
                    className="group inline-flex items-center gap-3.5 pl-2.5 pr-7 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63E19] active:scale-[0.99] text-white text-sm sm:text-base font-semibold shadow-[0_12px_36px_rgba(255,72,32,0.38)] transition-all cursor-pointer"
                  >
                    <span className="w-11 h-11 rounded-full bg-white text-[#111111] flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
                      <Play className="w-4 h-4 fill-current ml-0.5" aria-hidden="true" />
                    </span>
                    <span>Включить шоурил FMWorks</span>
                  </button>

                  <p className="text-xs sm:text-sm text-white/65">
                    Серый рекламный шум исчезнет — включится живой звук и 3 сцены в голове слушателя
                  </p>
                </div>
              </motion.div>
            ) : (
              /* MODE 2: ПОЧЕРК FMWORKS (Кино в голове — 3 атмосферные широкоформатные сцены) */
              <motion.div
                key={`mode-cinema-${currentScene.id}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-3xl space-y-3"
              >
                <p className="text-xs sm:text-sm font-semibold text-[#FFB36B] tracking-wide">
                  Почерк FMWorks · Кино в голове
                </p>

                <h2 className="text-2xl sm:text-4xl lg:text-[2.85rem] font-bold tracking-tight leading-[1.08] text-white editorial-balance drop-shadow-xs">
                  {currentScene.caption}
                </h2>

                <p className="text-sm sm:text-base text-white/78 max-w-2xl leading-relaxed editorial-pretty">
                  {currentScene.subcaption}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* LAYER 5: Bottom Controls — Manual Scene Dot-Tabs + Play/Pause & Timeline */}
        <div className="relative z-20 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* 3 Scene Dot-Tabs right on the card */}
            <div
              role="tablist"
              aria-label="Сцены шоурила FMWorks"
              className="flex flex-wrap items-center gap-1.5 sm:gap-2"
            >
              {HERO_CINEMA_SCENES.map((scene) => {
                const isSelected = isSignatureMode && activeSceneId === scene.id;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleSelectSceneTab(scene.id)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer backdrop-blur-md border ${
                      isSelected
                        ? 'bg-white text-[#111111] border-white'
                        : 'bg-black/45 text-white/78 border-white/15 hover:text-white hover:border-white/35'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-[#FF4820]' : 'bg-white/45'
                      }`}
                    />
                    <span>{scene.tabLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Right Audio Status / Play-Pause Button */}
            <button
              type="button"
              onClick={() =>
                contrastAudioEngine.toggleShowreelPlayback(currentScene.audioSeekSec)
              }
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap backdrop-blur-md ${
                isPlayingAny
                  ? 'bg-[#FF4820] text-white'
                  : 'bg-white/14 hover:bg-white/22 text-white border border-white/20'
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
                  <span>Шоурил 1:19</span>
                </>
              )}
            </button>
          </div>

          {/* Interactive Scrubber Hairline */}
          <button
            type="button"
            aria-label="Перемотать шоурил FMWorks"
            onClick={handleTimelineScrub}
            className="block w-full py-1 cursor-pointer"
          >
            <progress
              value={progressPercent}
              max={100}
              className="block h-1 w-full rounded-full overflow-hidden appearance-none [&::-webkit-progress-bar]:bg-white/18 [&::-webkit-progress-value]:bg-[#FF4820] [&::-moz-progress-bar]:bg-[#FF4820]"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
