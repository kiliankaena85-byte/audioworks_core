import { ChangeEvent, useEffect, useRef, useState } from 'react';
import {
  Check,
  Music,
  Palette,
  Radio,
  RotateCcw,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { casePlayerEngine } from '../audio/casePlayerEngine';
import {
  contrastAudioEngine,
  ContrastStageSnapshot,
} from '../audio/contrastAudioEngine';
import { duelAudioStore, DuelStoreSnapshot } from '../audio/duelAudioStore';
import { BRAND_DOMAIN_OPTIONS, BrandDomainVariant } from '../data/brandKitData';
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
}

export function LayaSimulationConsole({
  mode = 'floating',
  activeBrandVariant = 'fmworks_reg',
  onSelectBrandVariant,
  isCasePlayerVisible = false,
  hasStickyBottomBar = false,
  onOpenBrandKit,
  onOpenRadioAdmin,
}: LayaSimulationConsoleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [stageSnap, setStageSnap] = useState<ContrastStageSnapshot>(() =>
    contrastAudioEngine.getSnapshot()
  );
  const [duelSnap, setDuelSnap] = useState<DuelStoreSnapshot>(() =>
    duelAudioStore.getSnapshot()
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const duelPairInputRef = useRef<HTMLInputElement | null>(null);

  const { decision, activeTraceId, selectSimulationTrace } = useLayaDecision();

  useEffect(() => {
    const unsubStage = contrastAudioEngine.subscribe(setStageSnap);
    const unsubDuel = duelAudioStore.subscribe(setDuelSnap);
    return () => {
      unsubStage();
      unsubDuel();
    };
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

    contrastAudioEngine.loadCustomShowreel(objectUrl, file.name, mode === 'floating');
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
                  Быстрая проверка локальных аудиофайлов
                </h3>
                <p className="text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
                  Подключите свой локальный файл в браузерной сессии, чтобы послушать пульсацию волны на первом экране или в секции дуэли без записи на сервер.
                </p>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#111111] hover:bg-[#27272A] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-white text-xs font-semibold leading-snug text-center transition-colors cursor-pointer"
              >
                <Music className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Загрузить тестовый шоурил (.mp3 / .wav)</span>
              </button>

              {stageSnap.hasCustomAudio && stageSnap.customAudioName && (
                <div
                  data-testid="custom-audio-active-banner"
                  className="flex items-center justify-between gap-2 text-xs text-[#FF4820] font-medium"
                >
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">Подключён: {stageSnap.customAudioName}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => contrastAudioEngine.resetCustomShowreel()}
                    className="inline-flex items-center gap-1 text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-white shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>Сброс</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => duelPairInputRef.current?.click()}
                className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-[#111111] dark:text-[#F4F3EF] text-xs font-semibold leading-snug text-center transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
                <span>
                  {duelSnap.radioTrack && duelSnap.audioworksTrack
                    ? 'Обновить 2 WAV дуэли «Зерно и Свет»'
                    : 'Подключить 2 WAV дуэли «Зерно и Свет»'}
                </span>
              </button>
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
                onClick={() => fileInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#FF4820] hover:bg-[#E63E19] active:scale-[0.99] text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap"
              >
                <Music className="w-4 h-4 shrink-0" aria-hidden="true" />
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
