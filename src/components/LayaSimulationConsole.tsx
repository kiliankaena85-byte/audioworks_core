import { ChangeEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  AudioWaveform,
  Film,
  Music,
  Palette,
  Radio,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { fmTunerAudioEngine } from '../audio/fmTunerAudioEngine';
import { lazyCasePlayerEngine as casePlayerEngine } from '../audio/lazyAudioEngines';
import { duelAudioStore } from '../audio/duelAudioStore';
import { useStudioCms } from '../cms/StudioCmsContext';
import { BRAND_DOMAIN_OPTIONS, BrandDomainVariant } from '../data/brandKitData';
import { resolveHeroStagePlayback } from '../data/heroStageCms';
import { heroVideoStore, HeroVideoSnapshot } from '../data/heroVideoStore';
import { LAYA_SIMULATION_TRACES } from '../engine/layaEngine';
import { useLayaDecision } from '../engine/LayaContext';

interface LayaSimulationConsoleProps {
  mode?: 'floating' | 'embedded';
  activeBrandVariant?: BrandDomainVariant;
  onSelectBrandVariant?: (variant: BrandDomainVariant) => void;
  isCasePlayerVisible?: boolean;
  hasStickyBottomBar?: boolean;
  onOpenBrandKit?: () => void;
  onOpenRadioAdmin?: () => void;
  onOpenHeroStageAdmin?: () => void;
  onOpenDuelAdmin?: () => void;
  onOpenHomePreview?: () => void;
}

export function LayaSimulationConsole({
  mode = 'floating',
  activeBrandVariant = 'fmworks_reg',
  onSelectBrandVariant,
  isCasePlayerVisible = false,
  hasStickyBottomBar = false,
  onOpenBrandKit,
  onOpenRadioAdmin,
  onOpenHeroStageAdmin,
  onOpenDuelAdmin,
  onOpenHomePreview,
}: LayaSimulationConsoleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [videoSnap, setVideoSnap] = useState<HeroVideoSnapshot>(() =>
    heroVideoStore.getSnapshot()
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const duelPairInputRef = useRef<HTMLInputElement | null>(null);

  const { decision, activeTraceId, selectSimulationTrace } = useLayaDecision();
  const { snapshot } = useStudioCms();
  const resolvedHero = resolveHeroStagePlayback(snapshot, decision.choice);

  useEffect(() => {
    return heroVideoStore.subscribe(setVideoSnap);
  }, []);

  useEffect(() => {
    if (mode === 'embedded') return;
    let scrollTimer: number | null = null;
    const onScroll = () => {
      setIsScrolling(true);
      if (scrollTimer !== null) {
        window.clearTimeout(scrollTimer);
      }
      scrollTimer = window.setTimeout(() => {
        setIsScrolling(false);
      }, 240);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollTimer !== null) {
        window.clearTimeout(scrollTimer);
      }
    };
  }, [mode]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    casePlayerEngine.stop();

    if (mode === 'floating' && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    fmTunerAudioEngine.setCustomShowreel(objectUrl, file.name, false);
    event.target.value = '';
  };

  const handleVideoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    heroVideoStore.setCustomVideoFile(file);
    if (mode === 'floating' && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    event.target.value = '';
  };

  const handleDuelPairChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await duelAudioStore.attachPairOrList(files);
    event.target.value = '';
  };

  if (mode === 'embedded') {
    return (
      <section
        data-testid="laya-admin-embedded-console"
        aria-label="Пульт персонализации Laya AI и фирменного стиля FMWorks"
        className="space-y-6"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,audio/mpeg,audio/wav,audio/*"
          onChange={handleFileChange}
          aria-label="Выбрать локальный аудиофайл шоурила (.mp3 или .wav)"
          data-testid="laya-custom-audio-input"
          className="sr-only"
        />
        <input
          ref={videoInputRef}
          type="file"
          accept=".mp4,video/mp4,video/webm,video/*"
          onChange={handleVideoFileChange}
          aria-label="Выбрать MP4-видео для фона главного экрана"
          data-testid="laya-hero-video-input"
          className="sr-only"
        />
        <input
          ref={duelPairInputRef}
          type="file"
          multiple
          accept=".mp3,.wav,audio/mpeg,audio/wav,audio/*"
          onChange={handleDuelPairChange}
          aria-label="Выбрать пару роликов 15 секунд для сравнения"
          className="sr-only"
        />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Левая колонка: Симуляция профилей аудитории Laya AI */}
          <div className="min-w-0 xl:col-span-7 rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#111111]/10 dark:border-white/10">
              <div className="space-y-1">
                <h2 className="text-lg font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                  Симуляция профилей аудитории (Laya AI)
                </h2>
                <p className="text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
                  Переключайте цифровой след гостя, чтобы проверить адаптацию первого экрана, порядка кейсов и рекомендуемого тарифа на витрине.
                </p>
              </div>

              <div className="text-xs font-medium text-[#111111]/68 dark:text-[#F4F3EF]/68 tabular-nums">
                Активный профиль:{' '}
                <strong className="text-[#FF4820]">
                  {decision.profileBadgeLabel ?? decision.choice}
                </strong>{' '}
                · {Math.round(decision.confidence * 100)}%
              </div>
            </div>

            <div className="space-y-2">
              {LAYA_SIMULATION_TRACES.map((trace) => {
                const isSelected =
                  activeTraceId === trace.id ||
                  (!activeTraceId &&
                    trace.id === 'guest_low_conf' &&
                    decision.choice === 'default');

                return (
                  <button
                    key={trace.id}
                    type="button"
                    data-testid={`laya-trace-btn-${trace.id}`}
                    onClick={() => selectSimulationTrace(trace)}
                    aria-pressed={isSelected}
                    className={`w-full text-left px-4 py-3 rounded-xl text-xs transition-colors cursor-pointer border ${
                      isSelected
                        ? 'bg-[#111111] text-[#F7F6F2] border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:border-[#F4F3EF] font-semibold'
                        : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] hover:border-[#FF4820] text-[#111111] dark:text-[#F4F3EF] border-[#111111]/10 dark:border-white/10'
                    }`}
                  >
                    <span className="block text-sm font-semibold">
                      {trace.buttonLabel}
                    </span>
                    <span
                      className={`block text-xs mt-0.5 ${
                        isSelected
                          ? 'text-[#F7F6F2]/72 dark:text-[#0D0D0F]/72 font-normal'
                          : 'text-[#111111]/58 dark:text-[#F4F3EF]/58'
                      }`}
                    >
                      {trace.traceSummary}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Правая колонка: Brand Kit и локальный тест аудиодорожек */}
          <div className="min-w-0 xl:col-span-5 space-y-6">
            <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-6 space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                  Фирменный знак и Brand Kit
                </h3>
                <p className="text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
                  Выберите активное начертание логотипа в шапке и подвале сайта или откройте векторный пакет для скачивания SVG и PNG.
                </p>
              </div>

              {onSelectBrandVariant && (
                <div
                  role="group"
                  aria-label="Вариант логотипа на сайте"
                  className="grid grid-cols-1 gap-2"
                >
                  {BRAND_DOMAIN_OPTIONS.map((opt) => {
                    const active = activeBrandVariant === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid={`admin-brand-variant-${opt.id}`}
                        onClick={() => onSelectBrandVariant(opt.id)}
                        aria-pressed={active}
                        className={`px-3.5 py-2.5 rounded-xl text-left text-xs border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          active
                            ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:border-[#F4F3EF] font-semibold'
                            : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111] dark:text-[#F4F3EF] border-[#111111]/10 dark:border-white/10 hover:border-[#FF4820]'
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span className="opacity-65 truncate">{opt.description}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {onOpenBrandKit && (
                <button
                  type="button"
                  data-testid="laya-open-brand-kit-btn"
                  onClick={onOpenBrandKit}
                  className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF4820] hover:bg-[#E63E19] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Palette className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Открыть Brand Kit (SVG / PNG)</span>
                </button>
              )}
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-6 space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                  Маршрутизация звука на витрине (Серверная CMS)
                </h3>
                <p className="text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
                  Аудиоролики первого экрана и секции дуэли загружаются напрямую на сервер, сохраняются между сессиями и адаптируются под выбранный выше профиль Laya AI.
                </p>
              </div>

              <div className="pt-2 border-t border-[#111111]/10 dark:border-white/10 space-y-1 text-xs tabular-nums">
                <p className="text-[#111111]/55 dark:text-[#F4F3EF]/55">
                  Сейчас звучит в Hero для активного профиля:
                </p>
                <p
                  data-testid="laya-resolved-hero-track"
                  className="font-bold text-[#111111] dark:text-[#F4F3EF] truncate"
                >
                  {resolvedHero.focus.label}
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  data-testid="laya-upload-hero-video-btn"
                  onClick={() => videoInputRef.current?.click()}
                  className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF4820] hover:bg-[#E63E19] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Film className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Загрузить MP4-видео на главный экран</span>
                </button>

                {videoSnap.videoError && (
                  <p
                    role="alert"
                    data-testid="laya-hero-video-error"
                    className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-700 dark:text-red-300"
                  >
                    {videoSnap.videoError}
                  </p>
                )}

                {videoSnap.isCustomUploaded && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 text-xs">
                      <span className="truncate text-[#111111]/78 dark:text-[#F4F3EF]/78">
                        Активно: {videoSnap.fileName}
                      </span>
                      <button
                        type="button"
                        onClick={() => heroVideoStore.resetDefaultVideo()}
                        className="inline-flex items-center gap-1 font-semibold text-[#FF4820] hover:underline shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Сбросить</span>
                      </button>
                    </div>

                    {onOpenHomePreview && (
                      <button
                        type="button"
                        data-testid="laya-preview-hero-home-btn"
                        onClick={onOpenHomePreview}
                        className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#FF4820]/12 hover:bg-[#FF4820]/20 border border-[#FF4820]/35 text-[#FF4820] text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <span>Посмотреть на главном экране</span>
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}

                {onOpenHeroStageAdmin && (
                  <button
                    type="button"
                    data-testid="laya-goto-hero-stage-btn"
                    onClick={onOpenHeroStageAdmin}
                    className="w-full min-h-[42px] inline-flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-[#111111] hover:bg-[#27272A] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Radio className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
                      <span>Настроить звук Hero (Экран 1)</span>
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </button>
                )}

                {onOpenDuelAdmin && (
                  <button
                    type="button"
                    data-testid="laya-goto-duel-btn"
                    onClick={onOpenDuelAdmin}
                    className="w-full min-h-[40px] inline-flex items-center justify-between gap-2 px-4 py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-[#111111] dark:text-[#F4F3EF] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-2">
                      <AudioWaveform className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
                      <span>Настроить Дуэль 15 сек (Экран 4)</span>
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const bottomOffsetClass = hasStickyBottomBar
    ? isCasePlayerVisible
      ? 'bottom-38 xl:bottom-22'
      : 'bottom-[70px] sm:bottom-[82px]'
    : isCasePlayerVisible
      ? 'bottom-22 xl:bottom-5'
      : 'bottom-3.5 sm:bottom-5';

  return (
    <div
      className={`fixed right-3.5 sm:right-5 ${bottomOffsetClass} z-40 flex flex-col items-end transition-all duration-200 ${
        isScrolling && !isOpen ? 'max-md:opacity-40' : 'opacity-100'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,audio/mpeg,audio/wav,audio/*"
        onChange={handleFileChange}
        aria-label="Выбрать локальный аудиофайл шоурила (.mp3 или .wav)"
        data-testid="laya-custom-audio-input"
        className="sr-only"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept=".mp4,video/mp4,video/webm,video/*"
        onChange={handleVideoFileChange}
        aria-label="Выбрать MP4-видео для фона главного экрана"
        data-testid="laya-hero-video-input"
        className="sr-only"
      />
      <input
        ref={duelPairInputRef}
        type="file"
        multiple
        accept=".mp3,.wav,audio/mpeg,audio/wav,audio/*"
        onChange={handleDuelPairChange}
        aria-label="Выбрать пару роликов 15 секунд для сравнения"
        className="sr-only"
      />

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            aria-label="Пульт владельца Laya AI"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="mb-3 w-[calc(100vw-1.75rem)] max-w-sm rounded-3xl bg-[#121216]/96 text-[#F4F3EF] border border-white/14 shadow-2xl p-4 sm:p-5 space-y-4 max-h-[78vh] overflow-y-auto no-scrollbar overscroll-contain"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-bold tracking-tight text-white">
                  Laya AI · Пульт владельца
                </p>
                <p className="text-xs text-white/60 tabular-nums">
                  Профиль:{' '}
                  <span className="text-white/90">
                    {decision.profileBadgeLabel ?? decision.choice}
                  </span>{' '}
                  · {Math.round(decision.confidence * 100)}% · {decision.latencyMs} мс
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Свернуть пульт Laya AI"
                className="w-10 h-10 -mr-1 -mt-1 rounded-full flex items-center justify-center text-white/65 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="pt-3.5 border-t border-white/10 space-y-2.5">
              <button
                type="button"
                data-testid="laya-upload-hero-video-btn"
                onClick={() => videoInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#FF4820] hover:bg-[#E63E19] active:scale-[0.99] text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap"
              >
                <Film className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Загрузить MP4-видео на главный экран</span>
              </button>

              {videoSnap.videoError && (
                <p
                  role="alert"
                  data-testid="laya-hero-video-error"
                  className="px-3 py-2 rounded-xl bg-red-500/18 border border-red-400/35 text-xs text-red-200"
                >
                  {videoSnap.videoError}
                </p>
              )}

              {videoSnap.isCustomUploaded && (
                <button
                  type="button"
                  onClick={() => heroVideoStore.resetDefaultVideo()}
                  className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white/8 hover:bg-white/14 border border-white/14 text-white/80 text-xs font-medium transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#FF4820]" aria-hidden="true" />
                  <span className="truncate">Вернуть видео по умолчанию ({videoSnap.fileName})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/16 border border-white/14 text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap"
              >
                <Music className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
                <span>Загрузить свой шоурил (.mp3 / .wav)</span>
              </button>

              {onOpenBrandKit && (
                <button
                  type="button"
                  data-testid="laya-open-brand-kit-btn"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenBrandKit();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/16 border border-white/16 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Palette className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
                  <span>Скачать логотип (SVG / PNG)</span>
                </button>
              )}

              {onOpenRadioAdmin && (
                <button
                  type="button"
                  data-testid="laya-open-radio-admin-btn"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenRadioAdmin();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#FF4820]/18 hover:bg-[#FF4820]/28 border border-[#FF4820]/40 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Radio className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
                  <span>База эфира (Админ)</span>
                </button>
              )}
            </div>

            <div className="pt-3.5 border-t border-white/10 space-y-2">
              <div className="space-y-1.5">
                {LAYA_SIMULATION_TRACES.map((trace) => {
                  const isSelected =
                    activeTraceId === trace.id ||
                    (!activeTraceId &&
                      trace.id === 'guest_low_conf' &&
                      decision.choice === 'default');

                  return (
                    <button
                      key={trace.id}
                      type="button"
                      onClick={() => selectSimulationTrace(trace)}
                      aria-pressed={isSelected}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer border ${
                        isSelected
                          ? 'bg-white text-[#111111] border-white font-semibold'
                          : 'bg-white/5 hover:bg-white/10 text-white/82 border-white/8'
                      }`}
                    >
                      <span className="block truncate">{trace.buttonLabel}</span>
                      <span
                        className={`block text-[11px] truncate mt-0.5 ${
                          isSelected ? 'text-[#111111]/65 font-normal' : 'text-white/48'
                        }`}
                      >
                        {trace.traceSummary}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="Пульт Laya AI"
        title="Пульт Laya AI"
        className={`w-10 h-10 inline-flex items-center justify-center rounded-full backdrop-blur-md border transition-all cursor-pointer shrink-0 ${
          isOpen
            ? 'bg-[#111114] text-white border-white/20 shadow-lg'
            : 'bg-[#F7F6F2]/88 dark:bg-[#18181D]/88 text-[#111111]/62 dark:text-[#F4F3EF]/62 hover:text-[#111111] dark:hover:text-white border-[#111111]/12 dark:border-white/14 shadow-xs'
        }`}
      >
        <SlidersHorizontal className="w-4 h-4 shrink-0" aria-hidden="true" />
      </button>
    </div>
  );
}
