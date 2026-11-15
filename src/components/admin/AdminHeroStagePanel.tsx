import {
  ArrowUpRight,
  FileAudio,
  FolderKanban,
  Pause,
  Play,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSiteTextBlocks } from '../../cms/SiteTextBlocksContext';
import { UploadedAudioResult } from '../../cms/studioCmsStore';
import { formatAudioTime } from '../../data/audioworksCommercial';
import { isSiteTextBlockModified } from '../../data/siteTextBlocksData';
import {
  assignPortfolioCaseToHeroStage,
  createDefaultHeroStageCmsConfig,
  HeroFocusSourceMode,
  HeroPersonaOverrideKey,
  HeroStageCmsConfig,
  normalizeHeroStageCmsConfig,
  resolveHeroStagePlayback,
} from '../../data/heroStageCms';
import {
  PortfolioCaseRecord,
  StudioCmsSnapshot,
} from '../../data/studioCmsTypes';

interface AdminHeroStagePanelProps {
  snapshot: StudioCmsSnapshot;
  onChangeHeroStage: (next: HeroStageCmsConfig) => void;
  onChangeHeroCopy: (patch: {
    heroLensClutterKicker?: string;
    heroLensClutterHeadline?: string;
  }) => void;
  onUploadAudio: (
    file: File
  ) => Promise<
    { ok: true; result: UploadedAudioResult } | { ok: false; error: string }
  >;
  onOpenPortfolioTab: () => void;
  onNavigateToHeroOnSite: () => void;
}

type HeroAuditionPhase = 'idle' | 'clutter' | 'pause' | 'focus';

const PERSONA_ROWS: ReadonlyArray<{
  key: HeroPersonaOverrideKey;
  title: string;
  description: string;
}> = [
  {
    key: 'real_estate',
    title: 'Девелопмент и недвижимость',
    description:
      'Автоматически подставляется в Hero, когда Laya AI определяет застройщика или агентство недвижимости.',
  },
  {
    key: 'fmcg',
    title: 'FMCG и федеральный ритейл',
    description:
      'Автоматически подставляется в Hero для директоров по маркетингу продуктовых брендов и торговых сетей.',
  },
];

export function AdminHeroStagePanel({
  snapshot,
  onChangeHeroStage,
  onChangeHeroCopy,
  onUploadAudio,
  onOpenPortfolioTab,
  onNavigateToHeroOnSite,
}: AdminHeroStagePanelProps) {
  const { getBlock, updateBlock } = useSiteTextBlocks();

  const hero = useMemo(
    () => normalizeHeroStageCmsConfig(snapshot.heroStage),
    [snapshot.heroStage]
  );

  const resolved = useMemo(
    () => resolveHeroStagePlayback(snapshot, 'default'),
    [snapshot]
  );

  const allAvailableCases = useMemo<PortfolioCaseRecord[]>(
    () => [snapshot.flagshipReel, ...snapshot.portfolioCases],
    [snapshot.flagshipReel, snapshot.portfolioCases]
  );

  const [isUploadingFocus, setIsUploadingFocus] = useState(false);
  const [isUploadingClutter, setIsUploadingClutter] = useState(false);
  const [isDragOverFocus, setIsDragOverFocus] = useState(false);
  const [notice, setNotice] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);

  const [auditionPhase, setAuditionPhase] = useState<HeroAuditionPhase>('idle');
  const [auditionMode, setAuditionMode] = useState<'full_crash_test' | 'focus_only' | null>(
    null
  );
  const [auditionElapsedSec, setAuditionElapsedSec] = useState(0);

  const focusFileInputRef = useRef<HTMLInputElement | null>(null);
  const clutterFileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const pauseTimeoutRef = useRef<number | null>(null);

  const stopAudition = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (pauseTimeoutRef.current !== null) {
      window.clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAuditionPhase('idle');
    setAuditionMode(null);
    setAuditionElapsedSec(0);
  };

  useEffect(() => {
    return () => {
      stopAudition();
    };
  }, []);

  const updateHero = (patch: Partial<HeroStageCmsConfig>) => {
    onChangeHeroStage(
      normalizeHeroStageCmsConfig({
        ...hero,
        ...patch,
      })
    );
  };

  const launchFocusAuditionSegment = (modeLabel: 'full_crash_test' | 'focus_only') => {
    const focusTrack = resolved.focus;
    const maxPlaySpan = Math.min(Math.max(1, focusTrack.durationSec), 25);
    const startAt = focusTrack.startSec;
    const stopAt =
      focusTrack.endSec !== null
        ? Math.min(focusTrack.endSec, startAt + maxPlaySpan)
        : startAt + maxPlaySpan;

    const audio = new Audio(focusTrack.audioUrl);
    audio.preload = 'auto';
    audio.volume = 0.95;
    audioRef.current = audio;
    setAuditionPhase('focus');
    setAuditionMode(modeLabel);
    setAuditionElapsedSec(0);

    const startPlayback = () => {
      if (audioRef.current !== audio) return;
      try {
        audio.currentTime = startAt;
      } catch {
        // Ignore seek before ready
      }
      audio.play().catch(() => {
        stopAudition();
      });
    };

    if (audio.readyState >= 1) {
      startPlayback();
    } else {
      audio.addEventListener('loadedmetadata', startPlayback, { once: true });
      audio.load();
    }

    audio.addEventListener('ended', stopAudition);

    intervalRef.current = window.setInterval(() => {
      const current = audioRef.current;
      if (!current) return;
      if (current.currentTime >= stopAt) {
        stopAudition();
        return;
      }
      setAuditionElapsedSec(Math.max(0, current.currentTime - startAt));
    }, 60);
  };

  const handleToggleCrashTestAudition = () => {
    if (auditionMode === 'full_crash_test') {
      stopAudition();
      return;
    }

    stopAudition();
    const clutterTrack = resolved.clutter;
    const clutterSpan = clutterTrack.durationSec;
    const startAt = clutterTrack.startSec;
    const stopAt = startAt + clutterSpan;

    const clutterAudio = new Audio(clutterTrack.audioUrl);
    clutterAudio.preload = 'auto';
    clutterAudio.volume = 0.72;
    audioRef.current = clutterAudio;
    setAuditionMode('full_crash_test');
    setAuditionPhase('clutter');
    setAuditionElapsedSec(0);

    const startClutter = () => {
      if (audioRef.current !== clutterAudio) return;
      try {
        clutterAudio.currentTime = startAt;
      } catch {
        // Ignore seek before metadata ready
      }
      clutterAudio.play().catch(() => {
        stopAudition();
      });
    };

    if (clutterAudio.readyState >= 1) {
      startClutter();
    } else {
      clutterAudio.addEventListener('loadedmetadata', startClutter, { once: true });
      clutterAudio.load();
    }

    const enterStopPause = () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setAuditionPhase('pause');
      setAuditionElapsedSec(0);

      pauseTimeoutRef.current = window.setTimeout(() => {
        pauseTimeoutRef.current = null;
        launchFocusAuditionSegment('full_crash_test');
      }, Math.round(resolved.stopPauseDurationSec * 1000));
    };

    clutterAudio.addEventListener('ended', enterStopPause, { once: true });

    intervalRef.current = window.setInterval(() => {
      const current = audioRef.current;
      if (!current) return;
      const elapsed = Math.max(0, current.currentTime - startAt);
      if (current.currentTime >= stopAt) {
        enterStopPause();
        return;
      }
      setAuditionElapsedSec(elapsed);
    }, 60);
  };

  const handleToggleFocusOnlyAudition = () => {
    if (auditionMode === 'focus_only') {
      stopAudition();
      return;
    }
    stopAudition();
    launchFocusAuditionSegment('focus_only');
  };

  const processFocusFileUpload = async (file: File) => {
    stopAudition();
    setIsUploadingFocus(true);
    setNotice(null);

    const res = await onUploadAudio(file);
    setIsUploadingFocus(false);

    if (!res.ok) {
      setNotice({ kind: 'error', text: res.error });
      return;
    }

    const cleanStem = res.result.fileName.replace(/\.[^.]+$/, '');
    const roundedDur = Math.max(1, Math.round(res.result.durationSec * 10) / 10);

    updateHero({
      focusSourceMode: 'custom_upload',
      focusAudioUrl: res.result.url,
      focusAudioFileName: res.result.fileName,
      focusDurationSec: roundedDur,
      focusStartSec: 0,
      focusEndSec: undefined,
      focusCustomLabel: hero.focusCustomLabel || `Шоурил · ${cleanStem}`,
    });

    setNotice({
      kind: 'ok',
      text: `${res.result.format} «${res.result.fileName}» (${roundedDur} сек) подключён в Hero (Фаза 3 · выход FMWorks). Нажмите «Сохранить на сервере» вверху, чтобы закрепить ролик для всех посетителей.`,
    });
  };

  const handleFocusInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await processFocusFileUpload(file);
  };

  const handleFocusDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOverFocus(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFocusFileUpload(file);
  };

  const handleClutterInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    stopAudition();
    setIsUploadingClutter(true);
    setNotice(null);

    const res = await onUploadAudio(file);
    setIsUploadingClutter(false);

    if (!res.ok) {
      setNotice({ kind: 'error', text: res.error });
      return;
    }

    const clampedClutterDur = Math.min(
      8,
      Math.max(2, Math.round(res.result.durationSec * 10) / 10)
    );

    updateHero({
      clutterSourceMode: 'custom_upload',
      clutterAudioUrl: res.result.url,
      clutterAudioFileName: res.result.fileName,
      clutterStartSec: 0,
      clutterDurationSec: clampedClutterDur,
    });

    setNotice({
      kind: 'ok',
      text: `Аудиофайл «${res.result.fileName}» назначен на Фазу 1 («Обычный рекламный блок», ${clampedClutterDur} сек).`,
    });
  };

  const handleSwitchFocusMode = (mode: HeroFocusSourceMode) => {
    stopAudition();
    setNotice(null);

    if (mode === 'portfolio_case') {
      const targetId =
        hero.linkedCaseId ??
        snapshot.portfolioCases[0]?.id ??
        snapshot.flagshipReel.id;
      const chosen =
        allAvailableCases.find((c) => c.id === targetId) ?? snapshot.flagshipReel;
      onChangeHeroStage(assignPortfolioCaseToHeroStage(hero, chosen));
      return;
    }

    if (mode === 'default_reel') {
      const defaults = createDefaultHeroStageCmsConfig();
      updateHero({
        focusSourceMode: 'default_reel',
        focusStartSec: defaults.focusStartSec,
        focusEndSec: undefined,
        focusDurationSec: defaults.focusDurationSec,
        focusCustomLabel: undefined,
      });
      return;
    }

    // При переключении на custom_upload, если файла ещё нет — открываем выбор файла
    if (!hero.focusAudioUrl) {
      focusFileInputRef.current?.click();
      return;
    }
    updateHero({ focusSourceMode: 'custom_upload' });
  };

  const handleSelectPortfolioCaseForHero = (caseId: string) => {
    stopAudition();
    const found = allAvailableCases.find((c) => c.id === caseId);
    if (!found) return;
    onChangeHeroStage(assignPortfolioCaseToHeroStage(hero, found));
    setNotice({
      kind: 'ok',
      text: `Кейс «${found.client}» назначен главным роликом Hero (Экран 1). Нажмите «Сохранить на сервере», чтобы опубликовать выбор.`,
    });
  };

  const handleResetHeroToFactory = () => {
    stopAudition();
    onChangeHeroStage(createDefaultHeroStageCmsConfig());
    setNotice({
      kind: 'ok',
      text: 'Настройки звуковой сцены Hero возвращены к эталонному шоурилу FMWorks.',
    });
  };

  const handleHeroKickerEdit = (value: string) => {
    onChangeHeroCopy({ heroLensClutterKicker: value });
    const liveBlock = getBlock('hero-stage');
    if (isSiteTextBlockModified(liveBlock)) {
      updateBlock('hero-stage', { eyebrow: value });
    }
  };

  const handleHeroHeadlineEdit = (value: string) => {
    onChangeHeroCopy({ heroLensClutterHeadline: value });
    const liveBlock = getBlock('hero-stage');
    if (isSiteTextBlockModified(liveBlock)) {
      updateBlock('hero-stage', { title: value });
    }
  };

  const clutterEndLabel = resolved.clutter.durationSec.toFixed(1);
  const introEndLabel = resolved.totalIntroDurationSec.toFixed(1);

  return (
    <div className="space-y-6" data-testid="admin-hero-stage-panel">
      {/* Top Section: 3-Phase Crash-Test Audition & Architecture */}
      <section className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <p className="text-xs font-semibold text-[#FF4820]">
              Экран 1 главной страницы · Интерактивная линза (#top)
            </p>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
              Звуковая сцена «Краш-тест в эфире» (Обычный эфир → FMWorks)
            </h2>
            <p className="text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62 leading-relaxed">
              На первом экране посетитель слышит 3-фазный акустический контраст: плотный поток типовой рекламы, короткую стоп-паузу тишины и чистый выход вашего ролика FMWorks при раскрытии линзы.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              data-testid="hero-audition-focus-only-btn"
              onClick={handleToggleFocusOnlyAudition}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                auditionMode === 'focus_only'
                  ? 'bg-[#111111] text-white dark:bg-white dark:text-[#111111]'
                  : 'bg-[#F7F6F2] dark:bg-[#1E1E24] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
              }`}
            >
              {auditionMode === 'focus_only' ? (
                <Pause className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
              )}
              <span className="tabular-nums">
                {auditionMode === 'focus_only'
                  ? `FMWorks · ${auditionElapsedSec.toFixed(1)} с`
                  : 'Слушать только FMWorks'}
              </span>
            </button>

            <button
              type="button"
              data-testid="hero-audition-crash-test-btn"
              onClick={handleToggleCrashTestAudition}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                auditionMode === 'full_crash_test'
                  ? 'bg-[#111111] text-white dark:bg-white dark:text-[#111111]'
                  : 'bg-[#FF4820] hover:bg-[#E63D18] text-white'
              }`}
            >
              {auditionMode === 'full_crash_test' ? (
                <Pause className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
              )}
              <span className="tabular-nums">
                {auditionMode === 'full_crash_test'
                  ? auditionPhase === 'clutter'
                    ? `Фаза 1: Эфир · ${auditionElapsedSec.toFixed(1)} с`
                    : auditionPhase === 'pause'
                      ? 'Фаза 2: Стоп-пауза…'
                      : `Фаза 3: FMWorks · ${auditionElapsedSec.toFixed(1)} с`
                  : 'Прослушать весь краш-тест'}
              </span>
            </button>

            <button
              type="button"
              onClick={onNavigateToHeroOnSite}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Открыть Hero</span>
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* 3-Phase Audition Timeline */}
        <div className="pt-5 border-t border-[#111111]/10 dark:border-white/10 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#111111]/10 dark:divide-white/10">
          <div
            className={`pb-4 md:pb-0 md:pr-5 space-y-1 transition-colors ${
              auditionPhase === 'clutter' ? 'text-[#FF4820]' : ''
            }`}
          >
            <p className="text-xs font-semibold text-[#111111]/55 dark:text-[#F4F3EF]/55 tabular-nums">
              Фаза 1 · 0.0–{clutterEndLabel} сек
            </p>
            <p className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
              Обычный рекламный блок
            </p>
            <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60 truncate tabular-nums">
              {resolved.clutter.mode === 'custom_upload'
                ? `Свой файл: ${resolved.clutter.fileName}`
                : 'Встроенный радийный поток'}{' '}
              · {resolved.clutter.roadNoiseOnClutter ? 'с гулом дороги' : 'без шума дороги'}
            </p>
          </div>

          <div
            className={`py-4 md:py-0 md:px-5 space-y-1 transition-colors ${
              auditionPhase === 'pause' ? 'text-[#FF4820]' : ''
            }`}
          >
            <p className="text-xs font-semibold text-[#111111]/55 dark:text-[#F4F3EF]/55 tabular-nums">
              Фаза 2 · {clutterEndLabel}–{introEndLabel} сек
            </p>
            <p className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
              Стоп-пауза тишины
            </p>
            <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60 tabular-nums">
              {resolved.stopPauseDurationSec.toFixed(1)} сек полной тишины перед раскрытием линзы
            </p>
          </div>

          <div
            className={`pt-4 md:pt-0 md:pl-5 space-y-1 transition-colors ${
              auditionPhase === 'focus' ? 'text-[#FF4820]' : ''
            }`}
          >
            <p className="text-xs font-semibold text-[#FF4820] tabular-nums">
              Фаза 3 · с {introEndLabel} сек (главный ролик)
            </p>
            <p
              data-testid="hero-resolved-focus-label"
              className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF] truncate"
            >
              {resolved.focus.label}
            </p>
            <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60 truncate tabular-nums">
              Старт с {resolved.focus.startSec.toFixed(1)} с · длина{' '}
              {formatAudioTime(resolved.focus.durationSec)}
            </p>
          </div>
        </div>
      </section>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          data-testid="hero-stage-notice"
          className={`px-4 py-3 rounded-xl text-xs font-medium border ${
            notice.kind === 'ok'
              ? 'bg-[#16A34A]/10 border-[#16A34A]/30 text-[#15803D] dark:text-[#4ADE80]'
              : 'bg-[#DC2626]/10 border-[#DC2626]/30 text-[#DC2626] dark:text-[#F87171]'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Section 1: Main FMWorks Spot in Hero (Phase 3 & Toggle "FMWorks") */}
      <section className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#111111]/10 dark:border-white/10">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
              1. Главный ролик FMWorks в Hero (после раскрытия линзы и по кнопке «FMWorks»)
            </h3>
            <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
              Загрузите отдельный мастер-файл WAV/MP3 напрямую в Hero или в 1 клик подключите любой готовый кейс из раздела «Портфолио и звук».
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Источник главного ролика Hero"
            data-testid="hero-focus-mode-tabs"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10"
          >
            <button
              type="button"
              role="tab"
              data-testid="hero-mode-custom-upload"
              aria-selected={hero.focusSourceMode === 'custom_upload'}
              onClick={() => handleSwitchFocusMode('custom_upload')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                hero.focusSourceMode === 'custom_upload'
                  ? 'bg-[#FF4820] text-white'
                  : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              Свой WAV / MP3
            </button>
            <button
              type="button"
              role="tab"
              data-testid="hero-mode-portfolio-case"
              aria-selected={hero.focusSourceMode === 'portfolio_case'}
              onClick={() => handleSwitchFocusMode('portfolio_case')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                hero.focusSourceMode === 'portfolio_case'
                  ? 'bg-[#FF4820] text-white'
                  : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              Кейс из Портфолио
            </button>
            <button
              type="button"
              role="tab"
              data-testid="hero-mode-default-reel"
              aria-selected={hero.focusSourceMode === 'default_reel'}
              onClick={() => handleSwitchFocusMode('default_reel')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                hero.focusSourceMode === 'default_reel'
                  ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              Эталон студии
            </button>
          </div>
        </div>

        {/* Direct Drag-and-Drop WAV/MP3 Uploader for Hero */}
        <div
          data-testid="hero-focus-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOverFocus(true);
          }}
          onDragLeave={() => setIsDragOverFocus(false)}
          onDrop={(e) => void handleFocusDrop(e)}
          className={`rounded-2xl p-4 sm:p-5 border border-dashed transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isDragOverFocus
              ? 'border-[#FF4820] bg-[#FF4820]/8'
              : 'border-[#111111]/18 dark:border-white/18 bg-[#F7F6F2]/75 dark:bg-[#0D0D0F]/75'
          }`}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FF4820]/12 text-[#FF4820] flex items-center justify-center shrink-0">
              <FileAudio className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p
                data-testid="hero-active-focus-filename"
                className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] truncate"
              >
                {hero.focusSourceMode === 'custom_upload' && hero.focusAudioFileName
                  ? `Загружен файл: ${hero.focusAudioFileName}`
                  : hero.focusSourceMode === 'portfolio_case'
                    ? `Подключён из портфолио: ${resolved.focus.label}`
                    : 'Звучит эталонный шоурил FMWorks (перетащите сюда свой .wav или .mp3)'}
              </p>
              <p className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56 tabular-nums">
                Прямая загрузка в Hero · файл записывается на сервер в /assets/cms/ и не пропадает после перезагрузки
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <input
              ref={focusFileInputRef}
              type="file"
              accept=".wav,.mp3,audio/wav,audio/x-wav,audio/mpeg,audio/mp3"
              onChange={handleFocusInputChange}
              aria-label="Загрузить аудиоролик WAV или MP3 для первого экрана Hero"
              data-testid="hero-focus-audio-input"
              className="sr-only"
            />
            <button
              type="button"
              disabled={isUploadingFocus}
              onClick={() => focusFileInputRef.current?.click()}
              data-testid="hero-upload-focus-btn"
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                {isUploadingFocus ? 'Загрузка файла…' : 'Загрузить WAV / MP3 в Hero'}
              </span>
            </button>
          </div>
        </div>

        {/* 1-Click Portfolio Case Selector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-8 space-y-1.5">
            <label
              htmlFor="hero-linked-case-select"
              className="block text-xs font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78"
            >
              Или выберите готовый ролик из Портфолио в 1 клик
            </label>
            <select
              id="hero-linked-case-select"
              data-testid="hero-linked-case-select"
              value={
                hero.focusSourceMode === 'portfolio_case' && hero.linkedCaseId
                  ? hero.linkedCaseId
                  : ''
              }
              onChange={(e) => {
                if (e.target.value) {
                  handleSelectPortfolioCaseForHero(e.target.value);
                }
              }}
              className="w-full min-h-[42px] pl-3.5 pr-9 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-medium text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            >
              <option value="">
                {hero.focusSourceMode === 'portfolio_case'
                  ? 'Выберите кейс из портфолио…'
                  : '— Не выбран (используется файл выше или эталон студии) —'}
              </option>
              <option value={snapshot.flagshipReel.id}>
                [Флагманская полоса] {snapshot.flagshipReel.client} —{' '}
                {snapshot.flagshipReel.headline} ({formatAudioTime(snapshot.flagshipReel.durationSec)})
              </option>
              {snapshot.portfolioCases.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.client} · {item.tag} ({formatAudioTime(item.durationSec)})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-4">
            <button
              type="button"
              onClick={onOpenPortfolioTab}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <FolderKanban className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
              <span>Открыть фонотеку Портфолио</span>
            </button>
          </div>
        </div>

        {/* Timing & Custom Label Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="space-y-1.5">
            <label
              htmlFor="hero-focus-start-input"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Старт ролика в Hero (сек)
            </label>
            <input
              id="hero-focus-start-input"
              data-testid="hero-focus-start-input"
              type="number"
              min={0}
              max={590}
              step={0.1}
              value={hero.focusStartSec}
              onChange={(e) =>
                updateHero({
                  focusStartSec: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="hero-focus-duration-input"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Хронометраж фрагмента (сек)
            </label>
            <input
              id="hero-focus-duration-input"
              data-testid="hero-focus-duration-input"
              type="number"
              min={1}
              max={600}
              step={0.5}
              value={hero.focusDurationSec}
              onChange={(e) =>
                updateHero({
                  focusDurationSec: Math.max(1, Number(e.target.value) || 15),
                })
              }
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="hero-focus-label-input"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Подпись в раскрытой линзе Hero
            </label>
            <input
              id="hero-focus-label-input"
              data-testid="hero-focus-label-input"
              type="text"
              value={hero.focusCustomLabel ?? ''}
              onChange={(e) =>
                updateHero({
                  focusCustomLabel: e.target.value || undefined,
                })
              }
              placeholder={resolved.focus.label}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>
        </div>
      </section>

      {/* Section 2: Phase 1 Clutter, Phase 2 Stop-Pause & Hero Lens Copy */}
      <section className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#111111]/10 dark:border-white/10">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
              2. Вступление «Обычный эфир», стоп-пауза и титры первого экрана
            </h3>
            <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
              Настройте длительность фонового эфирного шума перед выходом вашего ролика и заголовки краш-теста.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetHeroToFactory}
            data-testid="hero-reset-defaults-btn"
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:text-[#111111] dark:hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Сбросить звук Hero к эталону</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end pb-6 border-b border-[#111111]/10 dark:border-white/10">
          <div className="lg:col-span-5 space-y-1.5">
            <label
              htmlFor="hero-clutter-mode-select"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Источник Фазы 1 («Обычный рекламный блок»)
            </label>
            <div className="flex items-center gap-2">
              <select
                id="hero-clutter-mode-select"
                value={hero.clutterSourceMode}
                onChange={(e) => {
                  const nextMode = e.target.value as 'builtin_stream' | 'custom_upload';
                  if (nextMode === 'custom_upload' && !hero.clutterAudioUrl) {
                    clutterFileInputRef.current?.click();
                    return;
                  }
                  updateHero({ clutterSourceMode: nextMode });
                }}
                className="flex-1 min-h-[42px] pl-3.5 pr-9 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              >
                <option value="builtin_stream">Встроенный рекламный поток студии</option>
                <option value="custom_upload">
                  {hero.clutterAudioFileName
                    ? `Свой файл: ${hero.clutterAudioFileName}`
                    : 'Загрузить свой файл эфирного блока…'}
                </option>
              </select>

              <input
                ref={clutterFileInputRef}
                type="file"
                accept=".wav,.mp3,audio/wav,audio/x-wav,audio/mpeg,audio/mp3"
                onChange={handleClutterInputChange}
                aria-label="Загрузить свой аудиофайл для фазы Обычный эфир"
                className="sr-only"
              />
              <button
                type="button"
                disabled={isUploadingClutter}
                onClick={() => clutterFileInputRef.current?.click()}
                data-testid="hero-upload-clutter-btn"
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
                <span>{isUploadingClutter ? 'Загрузка…' : 'Свой эфир'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-1.5">
            <label
              htmlFor="hero-clutter-duration-input"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75 whitespace-nowrap"
            >
              Длина эфира (2–8 с)
            </label>
            <input
              id="hero-clutter-duration-input"
              type="number"
              min={2}
              max={8}
              step={0.5}
              value={hero.clutterDurationSec}
              onChange={(e) =>
                updateHero({
                  clutterDurationSec: Number(e.target.value) || 4,
                })
              }
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>

          <div className="lg:col-span-2 space-y-1.5">
            <label
              htmlFor="hero-stop-pause-input"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75 whitespace-nowrap"
            >
              Стоп-пауза (0.2–1.5 с)
            </label>
            <input
              id="hero-stop-pause-input"
              type="number"
              min={0.2}
              max={1.5}
              step={0.1}
              value={hero.stopPauseDurationSec}
              onChange={(e) =>
                updateHero({
                  stopPauseDurationSec: Number(e.target.value) || 0.5,
                })
              }
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>

          <div className="lg:col-span-3">
            <label className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 flex items-center gap-2.5 text-xs font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hero.clutterRoadNoiseDefault}
                onChange={(e) =>
                  updateHero({ clutterRoadNoiseDefault: e.target.checked })
                }
                className="accent-[#FF4820] w-4 h-4 shrink-0"
              />
              <span>Гул дороги на «Обычном эфире»</span>
            </label>
          </div>
        </div>

        {/* Hero Clutter Copy Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          <div className="sm:col-span-4 space-y-1.5">
            <label
              htmlFor="hero-kicker-input"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Надзаголовок краш-теста
            </label>
            <input
              id="hero-kicker-input"
              type="text"
              value={snapshot.siteCopy.heroLensClutterKicker}
              onChange={(e) => handleHeroKickerEdit(e.target.value)}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>

          <div className="sm:col-span-8 space-y-1.5">
            <label
              htmlFor="hero-headline-input"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Главный заголовок первого экрана (до раскрытия линзы)
            </label>
            <input
              id="hero-headline-input"
              type="text"
              value={snapshot.siteCopy.heroLensClutterHeadline}
              onChange={(e) => handleHeroHeadlineEdit(e.target.value)}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>
        </div>
      </section>

      {/* Section 3: Industry Persona Overrides (Laya AI Step-100 Architecture) */}
      <section className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-6 sm:p-8 space-y-5">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
            3. Отраслевые слоты Hero для персонализации Laya AI (необязательно)
          </h3>
          <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
            Если включить отраслевой слот, посетитель из девелопмента или FMCG услышит в Hero профильный кейс своей индустрии вместо общего шоурила.
          </p>
        </div>

        <div className="divide-y divide-[#111111]/10 dark:divide-white/10 border-t border-[#111111]/10 dark:border-white/10">
          {PERSONA_ROWS.map((row) => {
            const ov = hero.personaOverrides[row.key];

            return (
              <div
                key={row.key}
                className="py-4 first:pt-4 last:pb-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
              >
                <div className="lg:col-span-5 space-y-0.5">
                  <label className="inline-flex items-center gap-2.5 text-sm font-bold text-[#111111] dark:text-[#F4F3EF] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      data-testid={`hero-persona-toggle-${row.key}`}
                      checked={ov.enabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        const fallbackId =
                          ov.linkedCaseId ?? snapshot.portfolioCases[0]?.id;
                        const foundCase = allAvailableCases.find(
                          (c) => c.id === fallbackId
                        );
                        onChangeHeroStage(
                          normalizeHeroStageCmsConfig({
                            ...hero,
                            personaOverrides: {
                              ...hero.personaOverrides,
                              [row.key]: {
                                ...ov,
                                enabled,
                                mode: 'portfolio_case',
                                linkedCaseId: foundCase?.id ?? ov.linkedCaseId,
                                customLabel: foundCase
                                  ? `${foundCase.client} · ${foundCase.tag}`
                                  : ov.customLabel,
                              },
                            },
                          })
                        );
                      }}
                      className="accent-[#FF4820] w-4 h-4 shrink-0"
                    />
                    <span>{row.title}</span>
                  </label>
                  <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58 pl-6">
                    {row.description}
                  </p>
                </div>

                <div className="lg:col-span-7">
                  <select
                    aria-label={`Кейс портфолио для профиля ${row.title}`}
                    data-testid={`hero-persona-select-${row.key}`}
                    disabled={!ov.enabled}
                    value={ov.linkedCaseId ?? ''}
                    onChange={(e) => {
                      const chosen = allAvailableCases.find(
                        (c) => c.id === e.target.value
                      );
                      if (!chosen) return;
                      onChangeHeroStage(
                        assignPortfolioCaseToHeroStage(hero, chosen, row.key)
                      );
                    }}
                    className="w-full min-h-[40px] pl-3.5 pr-9 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs sm:text-sm text-[#111111] dark:text-[#F4F3EF] disabled:opacity-45 focus:outline-none focus:border-[#FF4820]"
                  >
                    {allAvailableCases.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id === snapshot.flagshipReel.id
                          ? `[Флагманская полоса] ${item.client}`
                          : `${item.client} · ${item.tag}`}{' '}
                        ({formatAudioTime(item.durationSec)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
