import {
  Car,
  Disc3,
  GripHorizontal,
  Menu,
  Moon,
  Pause,
  Play,
  Sun,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react';
import { MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
import {
  contrastAudioEngine,
  ContrastStageSnapshot,
} from '../audio/contrastAudioEngine';
import {
  formatAudioTime,
  HERO_KOTO_FRAMES,
  KOTO_MIC_WIDGET_IMAGE,
} from '../data/audioworksCommercial';
import { LAYA_CONTENT_DICTIONARY, VALID_PERSONAS } from '../engine/layaEngine';
import { useLayaDecision } from '../engine/LayaContext';

interface HeroKotoProps {
  isDark: boolean;
  onToggleTheme: () => void;
  isQuickOrderOpen: boolean;
  onOpenQuickOrder: () => void;
}

const NAV_MENU_ITEMS = [
  { label: 'Работы', href: '#work', meta: 'Кейсы и эфирные ролики' },
  { label: '15 секунд', href: '#approach', meta: 'Подход и студийный стандарт' },
  { label: 'Стоимость', href: '#pricing', meta: 'Фиксированная смета от 15 000 ₽' },
  { label: 'Вопросы', href: '#faq', meta: 'Права, модерация и ЭДО' },
  { label: 'Контакты', href: '#contacts', meta: 'Принимаем проекты онлайн' },
] as const;

function readCurrentHHMM(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function HeroKoto({
  isDark,
  onToggleTheme,
  isQuickOrderOpen,
  onOpenQuickOrder,
}: HeroKotoProps) {
  const { decision, slot, selectPersonaProfile } = useLayaDecision();

  const [snap, setSnap] = useState<ContrastStageSnapshot>(() =>
    contrastAudioEngine.getSnapshot()
  );
  const [showWidgets, setShowWidgets] = useState<boolean>(true);
  const [isNavOpen, setIsNavOpen] = useState<boolean>(false);
  const [frameIndex, setFrameIndex] = useState<number>(0);
  const [clockHHMM, setClockHHMM] = useState<string>(() => readCurrentHHMM());
  const [isCursorInsideCanvas, setIsCursorInsideCanvas] = useState<boolean>(false);

  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isPlayingAny = snap.isFilmPlaying || snap.isSoundPlaying;
  const isStreamContrast = isPlayingAny && snap.mode === 'stream';
  const activeFrame = HERO_KOTO_FRAMES[frameIndex] ?? HERO_KOTO_FRAMES[0];

  // Refs for 30fps Canvas sound wave loop (zero React setState inside rAF)
  const frameIdRef = useRef(activeFrame.id);
  const isPlayingRef = useRef(isPlayingAny);
  const modeRef = useRef(snap.mode);
  frameIdRef.current = activeFrame.id;
  isPlayingRef.current = isPlayingAny;
  modeRef.current = snap.mode;

  // Smooth spring-physics cursor follower for Koto-style `Play showreel` pill
  const cursorX = useMotionValue(40);
  const cursorY = useMotionValue(40);
  const smoothX = useSpring(cursorX, { stiffness: 320, damping: 28, mass: 0.45 });
  const smoothY = useSpring(cursorY, { stiffness: 320, damping: 28, mass: 0.45 });

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

  // Живые часы HH:MM для верхней таблетки и виджета Студийные часы
  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockHHMM(readCurrentHHMM());
    }, 10000);
    return () => window.clearInterval(timer);
  }, []);

  // Автоматическая ритмичная смена 4 полноэкранных арт-сцен каждые 3.5 секунды (сбрасывается при ручном выборе кадра)
  useEffect(() => {
    const cycleTimer = window.setTimeout(() => {
      setFrameIndex((prev) => (prev + 1) % HERO_KOTO_FRAMES.length);
    }, 3500);
    return () => window.clearTimeout(cycleTimer);
  }, [frameIndex]);

  // Кинетическая звуковая волна на полотне (особенно масштабная на Кадре 2 #FF4820 ON AIR и при воспроизведении шоурила)
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const fftBins = new Uint8Array(new ArrayBuffer(64));
    let smoothBass = 0.22;
    let smoothMid = 0.18;
    let smoothHigh = 0.14;
    let phase = 0;
    let rafId = 0;
    let lastDrawTime = 0;

    const syncResolution = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nextW = Math.max(320, Math.floor(rect.width * dpr));
      const nextH = Math.max(220, Math.floor(rect.height * dpr));
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }
    };

    syncResolution();
    window.addEventListener('resize', syncResolution);

    const drawFrame = (now: number) => {
      rafId = window.requestAnimationFrame(drawFrame);
      if (now - lastDrawTime < 32) return;
      const dt = Math.min(0.06, (now - lastDrawTime) / 1000);
      lastDrawTime = now;

      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);

      const hasLiveAudio = contrastAudioEngine.readFrequencyBins(fftBins);
      const isPosterFrame = frameIdRef.current === 'frame-onair';
      const playing = isPlayingRef.current;
      const isStream = playing && modeRef.current === 'stream';

      if (hasLiveAudio) {
        let bassSum = 0;
        let midSum = 0;
        let highSum = 0;
        for (let i = 1; i <= 8; i++) bassSum += fftBins[i];
        for (let i = 9; i <= 24; i++) midSum += fftBins[i];
        for (let i = 25; i <= 44; i++) highSum += fftBins[i];

        smoothBass += (bassSum / (8 * 255) - smoothBass) * 0.3;
        smoothMid += (midSum / (16 * 255) - smoothMid) * 0.28;
        smoothHigh += (highSum / (20 * 255) - smoothHigh) * 0.25;
      } else {
        const idle = isPosterFrame ? 0.34 : 0.14;
        smoothBass += (idle - smoothBass) * 0.09;
        smoothMid += (idle * 0.85 - smoothMid) * 0.09;
        smoothHigh += (idle * 0.65 - smoothHigh) * 0.09;
      }

      phase += dt * (hasLiveAudio ? 3.2 + smoothMid * 2.6 : isPosterFrame ? 2.1 : 1.05);

      if (!isPosterFrame && !playing) {
        // Тонкое живое дыхание акустической линии в покое на фото-кадрах
        const baseY = h * 0.78;
        ctx2d.beginPath();
        const pts = 72;
        for (let i = 0; i <= pts; i++) {
          const u = i / pts;
          const x = u * w;
          const env = Math.pow(Math.sin(u * Math.PI), 1.4);
          const y =
            baseY +
            Math.sin(u * Math.PI * 4.5 + phase) * (h * 0.028) * env +
            Math.cos(u * Math.PI * 8 - phase * 1.2) * (h * 0.012) * env;
          if (i === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
        }
        ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx2d.lineWidth = Math.max(1.5, w * 0.0013);
        ctx2d.stroke();
        return;
      }

      if (isStream) {
        // Зажатая серая монотонная нить обычного радио-потока
        const baseY = h * 0.68;
        ctx2d.beginPath();
        const pts = 76;
        for (let i = 0; i <= pts; i++) {
          const u = i / pts;
          const x = u * w;
          const env = Math.sin(u * Math.PI);
          const jitter = Math.sin(u * 34 + phase * 4.2) * (h * 0.025 * (0.5 + smoothMid)) * env;
          const y = baseY + jitter;
          if (i === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
        }
        ctx2d.strokeStyle = 'rgba(228, 229, 235, 0.45)';
        ctx2d.lineWidth = Math.max(2, w * 0.0016);
        ctx2d.stroke();
        return;
      }

      // Кинетическая полноэкранная звуковая скульптура AudioWorks:
      // на коралловом постере #FF4820 — ослепительно белые и тёпло-кремовые нити;
      // на фото-сценах — огненно-коралловые (#FF4820) и золотые нити.
      const ribbons = isPosterFrame
        ? [
            {
              yRatio: 0.54,
              stroke: 'rgba(255, 255, 255, 0.96)',
              freq: 2.2,
              harm: 5.0,
              offset: 0,
              amp: 0.24,
              width: 3.4,
            },
            {
              yRatio: 0.57,
              stroke: 'rgba(255, 236, 214, 0.72)',
              freq: 3.1,
              harm: 6.3,
              offset: 1.4,
              amp: 0.19,
              width: 2.3,
            },
            {
              yRatio: 0.6,
              stroke: 'rgba(17, 17, 17, 0.36)',
              freq: 1.7,
              harm: 4.1,
              offset: 2.8,
              amp: 0.16,
              width: 2.0,
            },
            {
              yRatio: 0.51,
              stroke: 'rgba(255, 255, 255, 0.44)',
              freq: 3.8,
              harm: 7.4,
              offset: 4.1,
              amp: 0.14,
              width: 1.5,
            },
          ]
        : [
            {
              yRatio: 0.7,
              stroke: 'rgba(255, 72, 32, 0.96)',
              freq: 2.3,
              harm: 5.2,
              offset: 0,
              amp: 0.17,
              width: 3.0,
            },
            {
              yRatio: 0.73,
              stroke: 'rgba(255, 196, 108, 0.86)',
              freq: 3.0,
              harm: 6.2,
              offset: 1.35,
              amp: 0.13,
              width: 2.2,
            },
            {
              yRatio: 0.76,
              stroke: 'rgba(255, 238, 198, 0.62)',
              freq: 1.8,
              harm: 4.3,
              offset: 2.7,
              amp: 0.1,
              width: 1.6,
            },
          ];

      const segments = 96;
      const energyBoost = 0.45 + smoothBass * 0.85 + smoothMid * 0.65 + smoothHigh * 0.35;

      ribbons.forEach((r) => {
        ctx2d.beginPath();
        const centerY = h * r.yRatio;
        for (let i = 0; i <= segments; i++) {
          const u = i / segments;
          const x = u * w;
          const envelope = Math.pow(Math.sin(u * Math.PI), 1.3);
          const binIdx = Math.min(44, Math.floor(Math.abs(u - 0.5) * 2 * 38) + 2);
          const localSpectrum = hasLiveAudio ? (fftBins[binIdx] ?? 0) / 255 : 0.28;

          const waveA = Math.sin(u * Math.PI * 2 * r.freq + phase + r.offset);
          const waveB = Math.cos(u * Math.PI * 2 * r.harm - phase * 1.25 + r.offset);
          const dy =
            (waveA * 0.68 + waveB * 0.32) *
            h *
            r.amp *
            (energyBoost + localSpectrum * 0.28) *
            envelope;

          const y = centerY + dy;
          if (i === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
        }
        ctx2d.strokeStyle = r.stroke;
        ctx2d.lineWidth = r.width * Math.min(2, Math.max(1, w / 960));
        ctx2d.lineCap = 'round';
        ctx2d.stroke();
      });
    };

    rafId = window.requestAnimationFrame(drawFrame);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncResolution);
    };
  }, []);

  const handleCanvasMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const stage = canvasStageRef.current;
    if (!stage) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-koto-interactive="true"]')) {
      setIsCursorInsideCanvas(false);
      return;
    }
    const rect = stage.getBoundingClientRect();
    cursorX.set(e.clientX - rect.left + 14);
    cursorY.set(e.clientY - rect.top + 14);
    if (!isCursorInsideCanvas) {
      setIsCursorInsideCanvas(true);
    }
  };

  const handleCanvasBackgroundClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-koto-interactive="true"]')) {
      return;
    }
    contrastAudioEngine.toggleShowreelPlayback();
  };

  const showreelBadgeDuration = snap.hasCustomAudio
    ? formatAudioTime(snap.filmDurationSec)
    : '0:50';

  const rowCliches = [...slot.streamCliches, ...slot.streamCliches];

  return (
    <>
      {/* 1. ПАРЯЩИЕ КАПСУЛЫ В СТИЛЕ KOTO.COM (Floating Pills Bar — без полоски border-b) */}
      <div
        role="banner"
        aria-label="Верхняя панель AudioWorks"
        className="fixed top-4 md:top-5 inset-x-4 md:inset-x-6 z-50 pointer-events-none flex items-start justify-between gap-3"
      >
        {/* Слева: плотная капсула с логотипом AudioWorks® */}
        <a
          href="#top"
          className="pointer-events-auto h-10 px-4.5 rounded-full bg-[#F7F6F2]/90 dark:bg-[#141418]/90 backdrop-blur-md border border-[#111111]/10 dark:border-white/14 text-[#111111] dark:text-[#F4F3EF] inline-flex items-center text-[15px] font-bold tracking-tight shadow-sm hover:scale-[1.01] transition-transform whitespace-nowrap shrink-0"
        >
          AudioWorks<sup className="text-[10px] font-semibold ml-0.5 opacity-75">®</sup>
        </a>

        {/* Справа: группа тактильных кнопок-таблеток высотой 40px */}
        <div className="pointer-events-auto relative flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          {/* 1) [ Виджеты • HH:MM ] */}
          <button
            type="button"
            onClick={() => setShowWidgets((prev) => !prev)}
            aria-pressed={showWidgets}
            className={`hidden sm:inline-flex h-10 px-4 rounded-full items-center gap-2 text-xs font-semibold tracking-tight backdrop-blur-md border transition-all cursor-pointer whitespace-nowrap shadow-sm ${
              showWidgets
                ? 'bg-[#F7F6F2]/92 dark:bg-[#18181D]/92 text-[#111111] dark:text-[#F4F3EF] border-[#111111]/12 dark:border-white/16'
                : 'bg-[#111114]/75 text-white/75 border-white/12 hover:text-white'
            }`}
          >
            <span
              aria-hidden="true"
              className={`w-2 h-2 rounded-full transition-colors ${
                showWidgets ? 'bg-[#FF4820]' : 'bg-current opacity-35'
              }`}
            />
            <span className="tabular-nums">Виджеты • {clockHHMM}</span>
          </button>

          {/* 2) [ ▶ Включить шоурил ] */}
          <button
            type="button"
            onClick={() => contrastAudioEngine.toggleShowreelPlayback()}
            className={`hidden md:inline-flex h-10 px-4 rounded-full items-center gap-2 text-xs font-semibold tracking-tight backdrop-blur-md border transition-all cursor-pointer whitespace-nowrap shadow-sm ${
              isPlayingAny
                ? 'bg-[#111111] text-white border-[#111111] dark:bg-white dark:text-[#111111] dark:border-white'
                : 'bg-[#F7F6F2]/92 dark:bg-[#18181D]/92 text-[#111111] dark:text-[#F4F3EF] border-[#111111]/12 dark:border-white/16 hover:border-[#111111]/30 dark:hover:border-white/35'
            }`}
          >
            {isPlayingAny ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                <span className="tabular-nums">
                  Пауза • {formatAudioTime(snap.filmElapsedSec)}
                </span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                <span>Включить шоурил</span>
              </>
            )}
          </button>

          {/* 3a) Переключатель темы (Светлая / Темная) */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
            className="h-10 w-10 rounded-full bg-[#F7F6F2]/92 dark:bg-[#18181D]/92 backdrop-blur-md border border-[#111111]/12 dark:border-white/16 text-[#111111] dark:text-[#F4F3EF] inline-flex items-center justify-center shadow-sm hover:scale-[1.02] transition-all cursor-pointer shrink-0"
          >
            {isDark ? (
              <Sun className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          {/* 3b) Кнопка меню навигации (Работы, 15 секунд, Стоимость) */}
          <button
            type="button"
            onClick={() => setIsNavOpen((prev) => !prev)}
            aria-expanded={isNavOpen}
            aria-label="Меню разделов сайта"
            className="h-10 px-3.5 sm:px-4 rounded-full bg-[#F7F6F2]/92 dark:bg-[#18181D]/92 backdrop-blur-md border border-[#111111]/12 dark:border-white/16 text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 text-xs font-semibold tracking-tight shadow-sm hover:border-[#111111]/30 dark:hover:border-white/35 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            {isNavOpen ? (
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Menu className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Меню</span>
          </button>

          {/* 4) Акцентная кораллово-оранжевая таблетка #FF4820: [ ⚡ Быстрый заказ ] */}
          <button
            type="button"
            onClick={onOpenQuickOrder}
            aria-expanded={isQuickOrderOpen}
            className="h-10 px-4 sm:px-5 rounded-full bg-[#FF4820] hover:bg-[#E63D18] active:scale-[0.99] text-white text-xs sm:text-[13px] font-semibold tracking-tight inline-flex items-center gap-1.5 shadow-[0_8px_24px_rgba(255,72,32,0.34)] transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <Zap className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            <span>Быстрый заказ</span>
          </button>

          {/* Выпадающее меню навигации в стиле Koto */}
          <AnimatePresence>
            {isNavOpen && (
              <motion.nav
                aria-label="Основная навигация"
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-12 w-72 rounded-3xl bg-[#F7F6F2]/96 dark:bg-[#16161B]/96 backdrop-blur-xl border border-[#111111]/12 dark:border-white/14 shadow-2xl p-3 space-y-1"
              >
                {NAV_MENU_ITEMS.map((navItem) => (
                  <a
                    key={navItem.href}
                    href={navItem.href}
                    onClick={() => setIsNavOpen(false)}
                    className="block px-4 py-2.5 rounded-2xl hover:bg-[#111111]/6 dark:hover:bg-white/8 transition-colors"
                  >
                    <span className="block text-sm font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                      {navItem.label}
                    </span>
                    <span className="block text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                      {navItem.meta}
                    </span>
                  </a>
                ))}

                {/* На мобильных также дублируем тумблер виджетов внутри меню */}
                <div className="sm:hidden pt-2 mt-1 border-t border-[#111111]/10 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setShowWidgets((prev) => !prev);
                      setIsNavOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 rounded-2xl text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:bg-[#111111]/6 dark:hover:bg-white/8 cursor-pointer"
                  >
                    {showWidgets ? 'Скрыть живые виджеты' : 'Показать живые виджеты'} • {clockHHMM}
                  </button>
                </div>
              </motion.nav>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 2. ГЛАВНОЕ ПОЛОТНО ВО ВЕСЬ ЭКРАН (Full-Bleed Showreel Canvas — p-3 md:p-4, min-h-[84vh], rounded-[28px]) */}
      <section id="top" aria-label="Главный шоурил AudioWorks" className="p-3 md:p-4">
        <div
          ref={canvasStageRef}
          data-testid="koto-hero-canvas"
          data-active-frame={activeFrame.id}
          data-stage-mode={snap.mode}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setIsCursorInsideCanvas(false)}
          onClick={handleCanvasBackgroundClick}
          className="relative w-full min-h-[84vh] rounded-[28px] overflow-hidden bg-[#101014] text-[#F4F3EF] flex flex-col justify-between p-5 sm:p-8 lg:p-11 select-none lg:cursor-pointer"
        >
          {/* СЛОЙ 1: 4 полноэкранные арт-сцены (предзагружены в DOM для мгновенной смены без мигания) */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {HERO_KOTO_FRAMES.map((frame, idx) => {
              const isCurrent = idx === frameIndex;

              if (frame.kind === 'kinetic_poster') {
                return (
                  <div
                    key={frame.id}
                    className={`absolute inset-0 transition-opacity duration-700 ${
                      isCurrent && !isStreamContrast ? 'opacity-100' : 'opacity-0'
                    } bg-gradient-to-br from-[#FF4820] via-[#F23F19] to-[#CC2D0C]`}
                  >
                    {/* Гигантская журнальная надпись ON AIR во весь постер */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                      <span className="text-xs sm:text-sm font-semibold tracking-widest text-white/85 mb-2">
                        АУДИОПРОДАКШН ПОЛНОГО ЦИКЛА ДЛЯ БИЗНЕСА
                      </span>
                      <p className="text-[clamp(4.5rem,14vw,11.5rem)] font-bold tracking-tighter leading-[0.86] text-white select-none">
                        ON AIR
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={frame.id}
                  className={`absolute inset-0 transition-opacity duration-700 ${
                    isCurrent ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <img
                    src={frame.imageUrl}
                    alt={frame.imageAlt ?? ''}
                    referrerPolicy="no-referrer"
                    decoding="async"
                    className={`w-full h-full object-cover animate-ken-burns transition-all duration-700 ${
                      isStreamContrast
                        ? 'grayscale contrast-75 blur-[2px] brightness-[0.42]'
                        : frame.exposureClass ?? ''
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0D]/88 via-[#0A0A0D]/26 to-[#0A0A0D]/48" />
                </div>
              );
            })}

            {/* Если на Кадре 2 включен режим Радио-штампа — приглушаем постер под серый эфирный поток */}
            {isStreamContrast && (
              <div className="absolute inset-0 bg-[#121216]/84 transition-opacity duration-300" />
            )}
          </div>

          {/* СЛОЙ 2: Живая кинетическая звуковая волна (Web Audio API AnalyserNode -> Canvas) */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
            <canvas
              ref={waveCanvasRef}
              data-testid="koto-wave-canvas"
              className="w-full h-full block"
            />
          </div>

          {/* СЛОЙ 2B: Бегущая лента радио-штампов, когда выбран контраст «Обычный эфир / Радио-штамп» */}
          <AnimatePresence>
            {isStreamContrast && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-1/3 z-10 space-y-3 overflow-hidden"
              >
                <div className="flex whitespace-nowrap gap-10 animate-stream-left opacity-45 text-xl sm:text-3xl font-semibold text-white/80">
                  {rowCliches.map((phrase, i) => (
                    <span key={`cl-${i}`}>{phrase}</span>
                  ))}
                </div>
                <div className="flex whitespace-nowrap gap-10 animate-stream-right opacity-35 text-lg sm:text-2xl font-medium text-white/70">
                  {rowCliches.map((phrase, i) => (
                    <span key={`cl2-${i}`}>{phrase}</span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* СЛОЙ 3: Верхняя внутренняя полоса кадров шоурила + быстрый переключатель сравнения */}
          <div
            data-koto-interactive="true"
            className="relative z-20 pt-14 sm:pt-12 flex flex-wrap items-center justify-between gap-4 cursor-default"
          >
            {/* 4 тактильных индикатора арт-сцен шоурила */}
            <div
              role="tablist"
              aria-label="Сцены визуального шоурила"
              className="inline-flex items-center gap-2 bg-black/35 backdrop-blur-md px-3 py-2 rounded-full border border-white/14"
            >
              {HERO_KOTO_FRAMES.map((frame, idx) => {
                const isSelected = idx === frameIndex;
                return (
                  <button
                    key={frame.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-label={`Кадр ${frame.indexLabel}: ${frame.title}`}
                    onClick={() => setFrameIndex(idx)}
                    className={`h-6 px-2.5 rounded-full text-[11px] font-semibold tabular-nums transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white text-[#111111]'
                        : 'text-white/72 hover:text-white'
                    }`}
                  >
                    {frame.indexLabel}
                  </button>
                );
              })}
            </div>

            {/* Переключатель сравнения на полотне (особенно нагляден во время воспроизведения) */}
            <div
              role="group"
              aria-label="Режим сравнения эфира на полотне"
              className="inline-flex items-center p-1 rounded-full bg-black/40 backdrop-blur-md border border-white/15"
            >
              <button
                type="button"
                onClick={() => contrastAudioEngine.selectLens('stream')}
                aria-pressed={isStreamContrast}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  isStreamContrast
                    ? 'bg-white text-[#111111]'
                    : 'text-white/78 hover:text-white'
                }`}
              >
                Обычный эфир
              </button>
              <button
                type="button"
                onClick={() => contrastAudioEngine.selectLens('focus')}
                aria-pressed={isPlayingAny && !isStreamContrast}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  !isStreamContrast && (isPlayingAny || snap.hasCustomAudio)
                    ? 'bg-[#FF4820] text-white'
                    : 'text-white/78 hover:text-white'
                }`}
              >
                AudioWorks
              </button>
            </div>
          </div>

          {/* СЛОЙ 4: ФИРМЕННЫЕ ПЕРЕТАСКИВАЕМЫЕ ЖИВЫЕ ВИДЖЕТЫ KOTO (Framer Motion drag) */}
          <AnimatePresence>
            {showWidgets && (
              <motion.div
                data-testid="koto-widgets-layer"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="relative md:absolute md:right-7 md:bottom-8 lg:right-10 lg:bottom-10 z-30 my-6 md:my-0 flex flex-wrap md:flex-nowrap items-end justify-end gap-3.5 pointer-events-none"
              >
                {/* ВИДЖЕТ 1: Виниловый плеер сравнения (190x210px) */}
                <motion.div
                  drag
                  dragConstraints={canvasStageRef}
                  dragElastic={0.08}
                  dragMomentum={false}
                  whileDrag={{ scale: 1.03, zIndex: 50 }}
                  data-koto-interactive="true"
                  data-testid="koto-widget-vinyl"
                  className="pointer-events-auto w-[206px] h-[210px] rounded-2xl bg-[#141418]/95 backdrop-blur-xl text-[#F4F3EF] border border-white/16 shadow-2xl p-3.5 flex flex-col justify-between cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-white/60">
                      <GripHorizontal className="w-3.5 h-3.5 text-white/40" aria-hidden="true" />
                      <span>Сравнение</span>
                    </span>

                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        contrastAudioEngine.toggleRoadNoise();
                      }}
                      aria-pressed={snap.roadNoiseEnabled}
                      aria-label="Шум автомобиля в эфире"
                      title="Шум автомобиля"
                      className={`w-7 h-7 rounded-full inline-flex items-center justify-center border transition-colors cursor-pointer ${
                        snap.roadNoiseEnabled
                          ? 'bg-[#FF4820]/25 border-[#FF4820] text-[#FF4820]'
                          : 'bg-white/6 border-white/14 text-white/70 hover:text-white'
                      }`}
                    >
                      <Car className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Центральная пластинка + кнопка Play/Pause */}
                  <div className="flex items-center gap-3 my-auto">
                    <div
                      className={`relative w-12 h-12 rounded-full bg-[#09090B] border border-white/20 flex items-center justify-center shrink-0 ${
                        isPlayingAny ? 'animate-[spin_4s_linear_infinite]' : ''
                      }`}
                    >
                      <Disc3
                        className={`w-6 h-6 ${
                          isPlayingAny ? 'text-[#FF4820]' : 'text-white/55'
                        }`}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-bold tracking-tight text-white truncate">
                        {isStreamContrast ? 'Радио-штамп' : 'Почерк студии'}
                      </p>
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          contrastAudioEngine.toggleShowreelPlayback();
                        }}
                        aria-label={
                          isPlayingAny
                            ? 'Пауза винилового плеера'
                            : 'Включить сравнение в виниловом плеере'
                        }
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-[#111111] text-[11px] font-semibold hover:bg-white/90 transition-colors cursor-pointer"
                      >
                        {isPlayingAny ? (
                          <>
                            <Pause className="w-3 h-3 fill-current" aria-hidden="true" />
                            <span>Пауза</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                            <span>Слушать</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Мини-переключатель в 1 клик: Радио-штамп <-> AudioWorks */}
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/8 border border-white/10"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        contrastAudioEngine.selectLens('stream');
                      }}
                      className={`py-1.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap px-1.5 ${
                        isStreamContrast
                          ? 'bg-white text-[#111111]'
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      Радио-штамп
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        contrastAudioEngine.selectLens('focus');
                      }}
                      className={`py-1.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap px-1.5 ${
                        !isStreamContrast
                          ? 'bg-[#FF4820] text-white'
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      AudioWorks
                    </button>
                  </div>
                </motion.div>

                {/* ВИДЖЕТ 2: Студийные часы (150x150px) */}
                <motion.div
                  drag
                  dragConstraints={canvasStageRef}
                  dragElastic={0.08}
                  dragMomentum={false}
                  whileDrag={{ scale: 1.04, zIndex: 50 }}
                  data-koto-interactive="true"
                  data-testid="koto-widget-clock"
                  className="pointer-events-auto w-[150px] h-[150px] rounded-2xl bg-[#F7F6F2]/96 text-[#111111] border border-black/10 shadow-2xl p-3.5 flex flex-col justify-between cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="w-2 h-2 rounded-full bg-[#FF4820] animate-pulse shrink-0"
                    />
                    <span className="text-[9px] font-bold tracking-tight text-[#111111]/85 truncate">
                      СТУДИЯ В РАБОТЕ
                    </span>
                  </div>

                  <p className="text-3xl font-bold tracking-tight tabular-nums text-[#111111] leading-none">
                    {clockHHMM}
                  </p>

                  <p className="text-[11px] font-medium text-[#111111]/68 leading-tight">
                    Срок сдачи: от 24ч
                  </p>
                </motion.div>

                {/* ВИДЖЕТ 3: Живая карточка микрофона (160x160px) */}
                <motion.div
                  drag
                  dragConstraints={canvasStageRef}
                  dragElastic={0.08}
                  dragMomentum={false}
                  whileDrag={{ scale: 1.04, zIndex: 50 }}
                  data-koto-interactive="true"
                  data-testid="koto-widget-mic"
                  className="pointer-events-auto relative w-[160px] h-[160px] rounded-2xl overflow-hidden bg-[#1A1716] border border-white/16 shadow-2xl p-3.5 flex flex-col justify-between cursor-grab active:cursor-grabbing"
                >
                  <img
                    src={KOTO_MIC_WIDGET_IMAGE}
                    alt="Студийный микрофон AudioWorks"
                    referrerPolicy="no-referrer"
                    decoding="async"
                    draggable={false}
                    className="pointer-events-none absolute inset-0 w-full h-full object-cover"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/88 via-black/28 to-black/18"
                  />

                  <span className="relative z-10 inline-flex items-center gap-1.5 text-[10px] font-semibold text-white/90">
                    <span
                      aria-hidden="true"
                      className="w-1.5 h-1.5 rounded-full bg-[#FF4820]"
                    />
                    <span>ON AIR</span>
                  </span>

                  <p className="relative z-10 text-xs font-bold leading-snug text-white">
                    От 15 000 ₽ под ключ
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* СЛОЙ 5: Нижний левый титр кадра + скругленная белая капсула Play showreel (в покое и на мобильных) */}
          <div className="relative z-20 mt-auto max-w-xl space-y-5 pointer-events-none">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFrame.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-2"
              >
                <p className="text-xs sm:text-sm font-semibold text-white/80">
                  {snap.hasCustomAudio && snap.customAudioName
                    ? `Ваш шоурил в эфире · ${snap.customAudioName}`
                    : activeFrame.kicker}
                </p>

                {activeFrame.kind !== 'kinetic_poster' && (
                  <h2 className="text-2xl sm:text-4xl lg:text-[2.65rem] font-bold tracking-tight leading-[1.06] text-white editorial-balance">
                    {activeFrame.title}
                  </h2>
                )}

                <p className="text-sm sm:text-base text-white/82 max-w-lg editorial-pretty">
                  {activeFrame.subtitle}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Капсула Play showreel в левом нижнем углу (всегда доступна с клавиатуры, тач-экранов и в покое мыши) */}
            <div data-koto-interactive="true" className="pointer-events-auto inline-block">
              <button
                type="button"
                onClick={() => contrastAudioEngine.toggleShowreelPlayback()}
                className={`inline-flex items-center gap-3 pl-2.5 pr-5 py-2 rounded-full text-xs sm:text-sm font-semibold shadow-2xl transition-all cursor-pointer whitespace-nowrap ${
                  isPlayingAny
                    ? 'bg-[#FF4820] text-white'
                    : 'bg-white text-[#111111] hover:scale-[1.02]'
                } ${isCursorInsideCanvas ? 'lg:opacity-0' : 'opacity-100'}`}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isPlayingAny
                      ? 'bg-black/20 text-white'
                      : 'bg-[#FF4820] text-white'
                  }`}
                >
                  {isPlayingAny ? (
                    <Pause className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" aria-hidden="true" />
                  )}
                </span>
                <span className="tabular-nums">
                  {isPlayingAny
                    ? `Пауза шоурила (${formatAudioTime(snap.filmElapsedSec)} / ${formatAudioTime(
                        snap.filmDurationSec
                      )})`
                    : `Слушать шоурил AudioWorks (${showreelBadgeDuration})`}
                </span>
              </button>
            </div>
          </div>

          {/* КНОПКА Play showreel, ПЛАВНО СЛЕДУЮЩАЯ ЗА КУРСОРОМ НА ДЕСКТОПЕ (Koto Cursor Pill) */}
          <motion.div
            aria-hidden="true"
            style={{ x: smoothX, y: smoothY }}
            className={`hidden lg:flex pointer-events-none absolute top-0 left-0 z-40 items-center gap-3 pl-2.5 pr-5 py-2 rounded-full shadow-2xl transition-opacity duration-150 whitespace-nowrap ${
              isPlayingAny ? 'bg-[#FF4820] text-white' : 'bg-white text-[#111111]'
            } ${isCursorInsideCanvas ? 'opacity-100' : 'opacity-0'}`}
          >
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isPlayingAny ? 'bg-black/20 text-white' : 'bg-[#FF4820] text-white'
              }`}
            >
              {isPlayingAny ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              )}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {isPlayingAny
                ? `Пауза шоурила (${formatAudioTime(snap.filmElapsedSec)})`
                : `Слушать шоурил AudioWorks (${showreelBadgeDuration})`}
            </span>
          </motion.div>
        </div>
      </section>

      {/* 4. МОЩНЫЙ ТЕКСТОВЫЙ МАНИФЕСТ СРАЗУ ПОД ПОЛОТНОМ (Пропорции «We're Koto. The Creative Company.») */}
      <section
        aria-labelledby="koto-manifesto-heading"
        className="py-20 md:py-28 px-6 md:px-12 max-w-7xl mx-auto"
      >
        <div className="space-y-8 md:space-y-10">
          <h1
            id="koto-manifesto-heading"
            className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.25rem] font-bold tracking-tight leading-[1.04] text-[#111111] dark:text-[#F4F3EF] max-w-5xl"
          >
            <span className="block">Мы AudioWorks.</span>
            <motion.span
              key={slot.kotoManifestoTagline}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="block text-[#111111]/46 dark:text-[#F4F3EF]/48"
            >
              {slot.kotoManifestoTagline}
            </motion.span>
          </h1>

          <p className="text-2xl md:text-4xl font-normal leading-[1.25] tracking-tight max-w-4xl text-[#111111]/90 dark:text-[#F4F3EF]/90 editorial-pretty">
            Эфир продаёт минуты — мы создаём секунды, которые врезаются в память. Придумываем
            идею, пишем сценарий, режиссируем редкие голоса и очищаем все права, чтобы в рекламной
            паузе услышали именно вас.
          </p>

          {/* Лаконичная лента профилей Laya AI под манифестом */}
          <div className="pt-8 border-t border-[#111111]/10 dark:border-[#F4F3EF]/10 flex flex-wrap items-center justify-between gap-4">
            <div
              role="group"
              aria-label="Профили адаптации Laya AI"
              className="flex flex-wrap items-center gap-1.5"
            >
              {VALID_PERSONAS.map((personaId) => {
                const item = LAYA_CONTENT_DICTIONARY[personaId];
                const isActive = decision.choice === personaId;
                return (
                  <button
                    key={personaId}
                    type="button"
                    onClick={() => selectPersonaProfile(personaId)}
                    aria-pressed={isActive}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                        : 'text-[#111111]/62 dark:text-[#F4F3EF]/62 hover:text-[#111111] dark:hover:text-[#F4F3EF] hover:bg-[#111111]/6 dark:hover:bg-[#F4F3EF]/8'
                    }`}
                  >
                    {item.profileLabel}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-[#111111]/50 dark:text-[#F4F3EF]/50 tabular-nums">
              Laya System 1 · {decision.latencyMs} мс · уверенность{' '}
              {Math.round(decision.confidence * 100)}%
              {decision.isFallback ? ' (эталон)' : ''}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
