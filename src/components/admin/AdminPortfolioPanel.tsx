import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  FileAudio,
  ImagePlus,
  Pause,
  Play,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import {
  UploadedAudioResult,
  UploadedImageResult,
} from '../../cms/studioCmsStore';
import { formatAudioTime } from '../../data/audioworksCommercial';
import { getCasePreviewWindow } from '../../data/casesData';
import {
  applyThreeSecondPreviewTiming,
  computePreviewWindowTimeline,
  resolveAudioBadgeLabel,
  WAVE1_DEFAULT_PREVIEW_DURATION_SEC,
} from '../../data/portfolioWave1Helpers';
import {
  clampPreviewTiming,
  PortfolioCaseRecord,
  PortfolioPersonaFocus,
} from '../../data/studioCmsTypes';

interface AdminPortfolioPanelProps {
  flagshipReel: PortfolioCaseRecord;
  portfolioCases: PortfolioCaseRecord[];
  onPatchCase: (caseId: string, patch: Partial<PortfolioCaseRecord>) => void;
  onChangePortfolioCases: (nextCases: PortfolioCaseRecord[]) => void;
  onUploadAudio: (
    file: File
  ) => Promise<{ ok: true; result: UploadedAudioResult } | { ok: false; error: string }>;
  onUploadImage: (
    file: File
  ) => Promise<{ ok: true; result: UploadedImageResult } | { ok: false; error: string }>;
  onNavigateToGallery?: () => void;
}

const SURFACE_PRESETS = [
  {
    label: 'Тёмный графит студии',
    surface: 'bg-[#151417]',
    gradient: 'bg-gradient-to-br from-[#18181C] via-[#121216] to-[#0B0B0D]',
    glow: 'bg-[#FF4820]/20',
  },
  {
    label: 'Тёплый эспрессо (FMCG)',
    surface: 'bg-[#2A1410]',
    gradient: 'bg-gradient-to-br from-[#3D1D16] via-[#2A1410] to-[#170B08]',
    glow: 'bg-[#FF6B3D]/20',
  },
  {
    label: 'Хвойный изумруд (Девелопмент)',
    surface: 'bg-[#12231D]',
    gradient: 'bg-gradient-to-br from-[#143D30] via-[#0E2B22] to-[#071712]',
    glow: 'bg-[#4ADE80]/12',
  },
  {
    label: 'Скандинавский индиго (Медицина / Сервис)',
    surface: 'bg-[#132036]',
    gradient: 'bg-gradient-to-br from-[#162747] via-[#101C35] to-[#080F1E]',
    glow: 'bg-[#60A5FA]/15',
  },
] as const;

type AuditionMode = 'preview' | 'full' | null;

export function AdminPortfolioPanel({
  flagshipReel,
  portfolioCases,
  onPatchCase,
  onChangePortfolioCases,
  onUploadAudio,
  onUploadImage,
  onNavigateToGallery,
}: AdminPortfolioPanelProps) {
  const [selectedId, setSelectedId] = useState<string>(
    portfolioCases[0]?.id ?? flagshipReel.id
  );
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isDragOverAudio, setIsDragOverAudio] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);

  const [auditionMode, setAuditionMode] = useState<AuditionMode>(null);
  const [auditionElapsed, setAuditionElapsed] = useState(0);
  const [auditionTotal, setAuditionTotal] = useState(WAVE1_DEFAULT_PREVIEW_DURATION_SEC);

  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);
  const auditionTimerRef = useRef<number | null>(null);

  const isEditingFlagship = selectedId === flagshipReel.id;
  const activeCase: PortfolioCaseRecord = isEditingFlagship
    ? flagshipReel
    : portfolioCases.find((c) => c.id === selectedId) ??
      portfolioCases[0] ??
      flagshipReel;

  const stopAudition = () => {
    if (auditionTimerRef.current !== null) {
      window.clearInterval(auditionTimerRef.current);
      auditionTimerRef.current = null;
    }
    if (auditionAudioRef.current) {
      auditionAudioRef.current.pause();
      auditionAudioRef.current = null;
    }
    setAuditionMode(null);
    setAuditionElapsed(0);
  };

  useEffect(() => {
    stopAudition();
    setUploadNotice(null);
  }, [selectedId]);

  useEffect(() => {
    return () => {
      stopAudition();
    };
  }, []);

  const updateActiveCase = (patch: Partial<PortfolioCaseRecord>) => {
    onPatchCase(activeCase.id, patch);
  };

  const handleAddNewCase = () => {
    const nextIdx = portfolioCases.length + 1;
    const newId = `case-studio-${Date.now().toString(36).slice(-5)}`;
    const newCase: PortfolioCaseRecord = {
      id: newId,
      client: `Новый бренд ${nextIdx}`,
      tag: 'Аудиопродакшн · Эфирный ролик',
      headline: 'Выразительный ролик, который считывается с первой секунды',
      summary:
        'Коротко опишите задачу клиента, найденную драматургическую идею и результат прохождения эфирной модерации.',
      quoteImage: '«Точная звуковая деталь, включающая воображение слушателя»',
      durationSec: 15,
      audioUrl: flagshipReel.audioUrl,
      clipStartSec: 0,
      clipEndSec: 15,
      previewStartSec: 0,
      previewDurationSec: WAVE1_DEFAULT_PREVIEW_DURATION_SEC,
      coverImageUrl:
        '/src/assets/images/hero_studio_editorial_1794399404984.jpg',
      coverImageAlt: 'Атмосферный кадр студийного кейса FMWorks',
      editorialSurfaceBg: SURFACE_PRESETS[0].surface,
      posterGradientClass: SURFACE_PRESETS[0].gradient,
      posterGlowClass: SURFACE_PRESETS[0].glow,
      published: true,
      sortOrder: nextIdx,
      personaFocus: 'general',
    };
    onChangePortfolioCases([...portfolioCases, newCase]);
    setSelectedId(newId);
  };

  const handleDeleteSelectedCase = () => {
    if (isEditingFlagship || portfolioCases.length <= 1) return;
    const remaining = portfolioCases
      .filter((c) => c.id !== activeCase.id)
      .map((c, idx) => ({ ...c, sortOrder: idx + 1 }));
    onChangePortfolioCases(remaining);
    setSelectedId(remaining[0]?.id ?? flagshipReel.id);
  };

  const handleMoveCase = (caseId: string, direction: -1 | 1) => {
    const idx = portfolioCases.findIndex((c) => c.id === caseId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= portfolioCases.length) return;
    const copy = [...portfolioCases];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    onChangePortfolioCases(
      copy.map((item, i) => ({
        ...item,
        sortOrder: i + 1,
      }))
    );
  };

  const processSelectedAudioFile = async (file: File) => {
    const targetCaseId = activeCase.id;
    stopAudition();
    setIsUploadingAudio(true);
    setUploadNotice(null);

    const res = await onUploadAudio(file);
    setIsUploadingAudio(false);

    if (!res.ok) {
      setUploadNotice({ kind: 'error', text: res.error });
      return;
    }

    const totalDur = Math.max(1, Math.round(res.result.durationSec * 10) / 10);
    const timing = clampPreviewTiming({
      durationSec: totalDur,
      clipStartSec: 0,
      clipEndSec: totalDur,
      previewStartSec: 0,
      previewDurationSec: WAVE1_DEFAULT_PREVIEW_DURATION_SEC,
    });

    onPatchCase(targetCaseId, {
      audioUrl: res.result.url,
      customAudioFileName: res.result.fileName,
      durationSec: timing.durationSec,
      clipStartSec: timing.clipStartSec,
      clipEndSec: timing.clipEndSec,
      previewStartSec: timing.previewStartSec,
      previewDurationSec: timing.previewDurationSec,
    });

    setUploadNotice({
      kind: 'ok',
      text: `${res.result.format} «${res.result.fileName}» (${res.result.durationSec} сек) подключён в локальное состояние CMS · превью установлено на ${timing.previewDurationSec.toFixed(1)} сек.`,
    });
  };

  const handleAudioFilePicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await processSelectedAudioFile(file);
  };

  const handleAudioDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOverAudio(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processSelectedAudioFile(file);
  };

  const handleCoverFilePicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const targetCaseId = activeCase.id;
    setIsUploadingCover(true);
    setUploadNotice(null);

    const res = await onUploadImage(file);
    setIsUploadingCover(false);

    if (!res.ok) {
      setUploadNotice({ kind: 'error', text: res.error });
      return;
    }

    onPatchCase(targetCaseId, {
      coverImageUrl: res.result.url,
    });
    setUploadNotice({
      kind: 'ok',
      text: `Обложка «${res.result.fileName}» обновлена в локальном состоянии CMS.`,
    });
  };

  const timeline = computePreviewWindowTimeline(activeCase);
  const previewWindow = getCasePreviewWindow(activeCase);
  const publishedCount = portfolioCases.filter((c) => c.published !== false).length;

  const handleNudgePreviewStart = (deltaSec: number) => {
    const nextStart = Math.min(
      timeline.maxPreviewStartSec,
      Math.max(
        timeline.trackStartSec,
        Math.round((timeline.previewStartSec + deltaSec) * 10) / 10
      )
    );
    updateActiveCase({ previewStartSec: nextStart });
  };

  const handleApply3SecPreset = () => {
    const updated = applyThreeSecondPreviewTiming(activeCase);
    updateActiveCase({
      previewStartSec: updated.previewStartSec,
      previewDurationSec: updated.previewDurationSec,
    });
  };

  const startAudition = (mode: 'preview' | 'full') => {
    if (auditionMode === mode) {
      stopAudition();
      return;
    }

    stopAudition();
    if (!activeCase.audioUrl) {
      setUploadNotice({
        kind: 'error',
        text: 'У этого кейса пока не прикреплён WAV/MP3 файл — загрузите аудиодорожку ниже.',
      });
      return;
    }

    const win = getCasePreviewWindow(activeCase);
    const startSec =
      mode === 'preview'
        ? win.startSec
        : Math.max(0, activeCase.clipStartSec ?? 0);
    const endSec =
      mode === 'preview'
        ? win.endSec
        : activeCase.clipEndSec && activeCase.clipEndSec > startSec
          ? activeCase.clipEndSec
          : startSec + Math.max(1, activeCase.durationSec);
    const spanSec = Math.max(0.5, endSec - startSec);

    const audio = new Audio(activeCase.audioUrl);
    audio.preload = 'auto';
    audio.volume = 0.95;
    auditionAudioRef.current = audio;
    setAuditionMode(mode);
    setAuditionTotal(Math.round(spanSec * 10) / 10);
    setAuditionElapsed(0);

    const launch = () => {
      if (auditionAudioRef.current !== audio) return;
      try {
        audio.currentTime = startSec;
      } catch {
        // Ignore seek before ready
      }
      audio.play().catch(() => {
        stopAudition();
      });
    };

    if (audio.readyState >= 1) {
      launch();
    } else {
      audio.addEventListener('loadedmetadata', launch, { once: true });
      audio.load();
    }

    audio.addEventListener('ended', stopAudition);

    auditionTimerRef.current = window.setInterval(() => {
      const current = auditionAudioRef.current;
      if (!current) return;
      const remaining = endSec - current.currentTime;
      if (mode === 'preview' && remaining <= 0.3 && remaining > 0) {
        current.volume = Math.max(0.05, (remaining / 0.3) * 0.95);
      }
      if (current.currentTime >= endSec) {
        stopAudition();
        return;
      }
      setAuditionElapsed(Math.max(0, current.currentTime - startSec));
    }, 60);
  };

  const activeAudioLabel =
    activeCase.customAudioFileName ||
    (activeCase.audioUrl
      ? decodeURIComponent(activeCase.audioUrl.split('/').pop() || 'studio-master.wav')
      : 'Синтез студийной атмосферы (без файла)');

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left Column: Case Directory & Reordering */}
      <div className="min-w-0 xl:col-span-4 rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#111111]/10 dark:border-white/10 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
              Работы в портфолио
            </h2>
            <p className="text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55 tabular-nums">
              Опубликовано: {publishedCount} из {portfolioCases.length}
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddNewCase}
            data-testid="admin-add-case-btn"
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] hover:bg-[#FF4820] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Новый кейс</span>
          </button>
        </div>

        <div className="divide-y divide-[#111111]/8 dark:divide-white/8">
          {/* Flagship Studio Reel Row */}
          <div
            className={`p-4 transition-colors ${
              isEditingFlagship
                ? 'bg-[#F7F6F2] dark:bg-[#1C1C22]'
                : 'hover:bg-[#F7F6F2]/60 dark:hover:bg-white/[0.03]'
            }`}
          >
            <button
              type="button"
              onClick={() => setSelectedId(flagshipReel.id)}
              className="w-full text-left space-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56 tabular-nums">
                <span className="font-semibold text-[#FF4820]">
                  Флагманский шоурил
                </span>
                <span>
                  {resolveAudioBadgeLabel(flagshipReel)} ·{' '}
                  {formatAudioTime(flagshipReel.durationSec)}
                </span>
              </div>
              <p className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF] truncate">
                {flagshipReel.headline}
              </p>
              <p className="text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55 truncate tabular-nums">
                {flagshipReel.client} · превью{' '}
                {getCasePreviewWindow(flagshipReel).durationSec.toFixed(1)} с (с{' '}
                {getCasePreviewWindow(flagshipReel).startSec} с)
              </p>
            </button>
          </div>

          {/* Individual Portfolio Cases */}
          {portfolioCases.map((item, idx) => {
            const isSelected = !isEditingFlagship && activeCase.id === item.id;
            const win = getCasePreviewWindow(item);

            return (
              <div
                key={item.id}
                data-testid={`admin-case-row-${item.id}`}
                className={`p-4 flex items-start justify-between gap-3 transition-colors ${
                  isSelected
                    ? 'bg-[#F7F6F2] dark:bg-[#1C1C22]'
                    : 'hover:bg-[#F7F6F2]/60 dark:hover:bg-white/[0.03]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="min-w-0 flex-1 text-left space-y-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55 tabular-nums">
                    <span className="font-semibold">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{resolveAudioBadgeLabel(item)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatAudioTime(item.durationSec)}</span>
                  </div>
                  <p className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF] truncate">
                    {item.headline}
                  </p>
                  <p className="text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55 truncate tabular-nums">
                    {item.client} · превью {win.durationSec.toFixed(1)} с (с{' '}
                    {win.startSec} с)
                  </p>
                </button>

                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveCase(item.id, -1)}
                    aria-label={`Поднять кейс «${item.client}» выше`}
                    className="w-7 h-7 rounded-md border border-[#111111]/12 dark:border-white/12 inline-flex items-center justify-center text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-default"
                  >
                    <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === portfolioCases.length - 1}
                    onClick={() => handleMoveCase(item.id, 1)}
                    aria-label={`Опустить кейс «${item.client}» ниже`}
                    className="w-7 h-7 rounded-md border border-[#111111]/12 dark:border-white/12 inline-flex items-center justify-center text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-default"
                  >
                    <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Wave 1 Portfolio Editor (Headlines + WAV/MP3 + 3s Preview Timing) */}
      <div className="min-w-0 xl:col-span-8 rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-8 space-y-8">
        {/* Header & Visibility Controls */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-[#111111]/10 dark:border-white/10">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
              {isEditingFlagship
                ? 'Флагманский шоурил студии · синхронизация с локальным состоянием CMS'
                : `Кейс портфолио (${activeCase.id}) · синхронизация с локальным состоянием CMS`}
            </p>
            <h3 className="text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] truncate">
              {activeCase.client}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#111111]/14 dark:border-white/14 inline-flex items-center gap-2 text-xs font-semibold cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={activeCase.published !== false}
                disabled={
                  !isEditingFlagship &&
                  activeCase.published !== false &&
                  publishedCount <= 1
                }
                onChange={(e) => updateActiveCase({ published: e.target.checked })}
                className="accent-[#FF4820] w-4 h-4"
              />
              <span>Показывать на сайте</span>
            </label>

            {onNavigateToGallery && (
              <button
                type="button"
                onClick={onNavigateToGallery}
                data-testid="admin-open-gallery-btn"
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#F7F6F2] dark:bg-[#1E1E24] hover:bg-[#FF4820] hover:text-white text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>Проверить в галерее</span>
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </button>
            )}

            {!isEditingFlagship && portfolioCases.length > 1 && (
              <button
                type="button"
                onClick={handleDeleteSelectedCase}
                aria-label={`Удалить кейс «${activeCase.client}»`}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#DC2626]/30 text-[#DC2626] dark:text-[#F87171] hover:bg-[#DC2626]/10 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Удалить</span>
              </button>
            )}
          </div>
        </div>

        {uploadNotice && (
          <div
            role={uploadNotice.kind === 'error' ? 'alert' : 'status'}
            data-testid={
              uploadNotice.kind === 'error'
                ? 'admin-audio-upload-error'
                : 'admin-audio-upload-ok'
            }
            className={`px-4 py-3 rounded-xl text-xs font-medium border ${
              uploadNotice.kind === 'ok'
                ? 'bg-[#16A34A]/10 border-[#16A34A]/30 text-[#15803D] dark:text-[#4ADE80]'
                : 'bg-[#DC2626]/10 border-[#DC2626]/30 text-[#DC2626] dark:text-[#F87171]'
            }`}
          >
            {uploadNotice.text}
          </div>
        )}

        {/* Block 1: Case Headlines & Editorial Identity */}
        <section className="space-y-5 pb-8 border-b border-[#111111]/10 dark:border-white/10">
          <div>
            <h4 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
              1. Заголовок кейса и подача бренда
            </h4>
            <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
              Все изменения заголовков и карточек мгновенно сохраняются в локальное состояние CMS и отображаются в галерее.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="case-headline-input"
              className="block text-xs font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78"
            >
              Главный заголовок кейса
            </label>
            <input
              id="case-headline-input"
              data-testid="case-headline-input"
              type="text"
              value={activeCase.headline}
              onChange={(e) => updateActiveCase({ headline: e.target.value })}
              placeholder="Например: Вкус, который слышно даже в утренней пробке"
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="case-client-input"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
              >
                Клиент / Бренд
              </label>
              <input
                id="case-client-input"
                data-testid="case-client-input"
                type="text"
                value={activeCase.client}
                onChange={(e) => updateActiveCase({ client: e.target.value })}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="case-tag-input"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
              >
                Рубрика / Формат
              </label>
              <input
                id="case-tag-input"
                type="text"
                value={activeCase.tag}
                onChange={(e) => updateActiveCase({ tag: e.target.value })}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="case-persona-select"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
              >
                Приоритет для профиля Laya AI
              </label>
              <select
                id="case-persona-select"
                disabled={isEditingFlagship}
                value={activeCase.personaFocus}
                onChange={(e) =>
                  updateActiveCase({
                    personaFocus: e.target.value as PortfolioPersonaFocus,
                  })
                }
                className="w-full min-h-[42px] pl-3.5 pr-9 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] disabled:opacity-50 focus:outline-none focus:border-[#FF4820]"
              >
                <option value="fmcg">FMCG и федеральный ритейл</option>
                <option value="real_estate">Девелопмент и недвижимость</option>
                <option value="general">Универсальный кейс</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-7 space-y-1.5">
              <label
                htmlFor="case-summary-textarea"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
              >
                Описание задачи и решения
              </label>
              <textarea
                id="case-summary-textarea"
                rows={3}
                value={activeCase.summary}
                onChange={(e) => updateActiveCase({ summary: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm leading-relaxed text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="sm:col-span-5 space-y-1.5">
              <label
                htmlFor="case-quote-input"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
              >
                Ключевая фраза-образ (для плеера)
              </label>
              <textarea
                id="case-quote-input"
                rows={3}
                value={activeCase.quoteImage}
                onChange={(e) =>
                  updateActiveCase({ quoteImage: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm leading-relaxed text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>
          </div>
        </section>

        {/* Block 2: WAV / MP3 Upload & 3-Second Preview Timing Studio */}
        <section className="space-y-5 pb-8 border-b border-[#111111]/10 dark:border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-0.5">
              <h4 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
                2. Мастер-аудио (WAV / MP3) и тайминг 3-секундного превью
              </h4>
              <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
                Перетащите WAV или MP3 и выберите самый выразительный 3-секундный фрагмент для мгновенного превью по наведению.
              </p>
            </div>

            <button
              type="button"
              onClick={handleApply3SecPreset}
              data-testid="preset-3sec-btn"
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                Math.abs(timeline.previewDurationSec - 3) < 0.05
                  ? 'bg-[#FF4820]/12 text-[#FF4820] border border-[#FF4820]/30'
                  : 'border border-[#111111]/14 dark:border-white/14 text-[#111111]/75 dark:text-[#F4F3EF]/75 hover:border-[#FF4820]'
              }`}
            >
              Окно 3.0 сек
            </button>
          </div>

          {/* Drag-and-Drop WAV/MP3 Uploader Surface */}
          <div
            data-testid="admin-audio-dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOverAudio(true);
            }}
            onDragLeave={() => setIsDragOverAudio(false)}
            onDrop={(e) => void handleAudioDrop(e)}
            className={`rounded-2xl p-4 sm:p-5 border border-dashed transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              isDragOverAudio
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
                  data-testid="active-audio-filename"
                  className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] truncate"
                >
                  {activeAudioLabel}
                </p>
                <p className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56 tabular-nums">
                  Формат: {resolveAudioBadgeLabel(activeCase)} · хронометраж{' '}
                  {formatAudioTime(activeCase.durationSec)} ({timeline.trackSpanSec} сек) · перетащите .wav или .mp3 сюда
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <input
                ref={audioInputRef}
                type="file"
                accept=".wav,.mp3,audio/wav,audio/x-wav,audio/mpeg,audio/mp3"
                onChange={handleAudioFilePicked}
                aria-label="Загрузить аудиофайл кейса WAV или MP3"
                data-testid="admin-case-audio-input"
                className="sr-only"
              />
              <button
                type="button"
                disabled={isUploadingAudio}
                onClick={() => audioInputRef.current?.click()}
                data-testid="admin-upload-audio-btn"
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {isUploadingAudio ? 'Обработка файла…' : 'Загрузить WAV / MP3'}
                </span>
              </button>
            </div>
          </div>

          {/* Interactive 3-Second Preview Timeline Bar & Scrubber */}
          <div
            data-testid="preview-timeline-visualizer"
            className="rounded-2xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 p-4 sm:p-5 space-y-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
              <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                Окно превью на дорожке: {timeline.previewStartSec.toFixed(1)} с —{' '}
                {timeline.previewEndSec.toFixed(1)} с ({timeline.previewDurationSec.toFixed(1)} сек)
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleNudgePreviewStart(-0.5)}
                  aria-label="Сдвинуть старт превью на 0.5 секунды раньше"
                  className="min-h-[30px] px-2.5 py-1 rounded-lg border border-[#111111]/14 dark:border-white/14 text-xs font-semibold hover:border-[#FF4820] transition-colors cursor-pointer whitespace-nowrap"
                >
                  −0.5 с
                </button>
                <button
                  type="button"
                  onClick={() => handleNudgePreviewStart(0.5)}
                  aria-label="Сдвинуть старт превью на 0.5 секунды позже"
                  className="min-h-[30px] px-2.5 py-1 rounded-lg border border-[#111111]/14 dark:border-white/14 text-xs font-semibold hover:border-[#FF4820] transition-colors cursor-pointer whitespace-nowrap"
                >
                  +0.5 с
                </button>
              </div>
            </div>

            {/* Highlighted Preview Window Strip */}
            <div className="relative h-8 rounded-xl bg-[#111111]/8 dark:bg-white/8 overflow-hidden flex items-center px-2">
              <div
                aria-hidden="true"
                className="w-full flex items-center justify-between gap-1 opacity-30 pointer-events-none"
              >
                {Array.from({ length: 36 }).map((_, idx) => {
                  const barHeight = 28 + Math.round(Math.abs(Math.sin(idx * 0.85)) * 56);
                  return (
                    <span
                      key={idx}
                      className="w-0.5 rounded-full bg-[#111111] dark:bg-white"
                      style={{ height: `${Math.round((barHeight / 100) * 22)}px` }}
                    />
                  );
                })}
              </div>

              <div
                data-testid="preview-window-highlight"
                className="absolute top-1 bottom-1 rounded-lg bg-[#FF4820]/28 border border-[#FF4820] pointer-events-none"
                style={{
                  left: `${timeline.offsetPercent}%`,
                  width: `${timeline.widthPercent}%`,
                }}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="case-preview-slider" className="sr-only">
                Позиция старта превью в секундах
              </label>
              <input
                id="case-preview-slider"
                data-testid="case-preview-slider"
                type="range"
                min={timeline.trackStartSec}
                max={timeline.maxPreviewStartSec}
                step={0.1}
                value={timeline.previewStartSec}
                disabled={timeline.maxPreviewStartSec <= timeline.trackStartSec}
                onChange={(e) =>
                  updateActiveCase({
                    previewStartSec: Math.round(Number(e.target.value) * 10) / 10,
                  })
                }
                className="w-full accent-[#FF4820] cursor-pointer disabled:opacity-40"
              />
              <div className="flex items-center justify-between text-[11px] text-[#111111]/50 dark:text-[#F4F3EF]/50 tabular-nums">
                <span>Старт фрагмента: {timeline.trackStartSec.toFixed(1)} с</span>
                <span>Финал фрагмента: {timeline.trackEndSec.toFixed(1)} с</span>
              </div>
            </div>
          </div>

          {/* 4-Column Exact Numeric Timing Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <label
                htmlFor="case-preview-start"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75 whitespace-nowrap"
              >
                Старт превью (сек)
              </label>
              <input
                id="case-preview-start"
                data-testid="case-preview-start-input"
                type="number"
                min={0}
                step={0.1}
                value={timeline.previewStartSec}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  updateActiveCase({
                    previewStartSec: Math.round(val * 10) / 10,
                  });
                }}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="case-preview-duration"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75 whitespace-nowrap"
              >
                Длина превью (3–5 сек)
              </label>
              <select
                id="case-preview-duration"
                data-testid="case-preview-duration-select"
                value={String(activeCase.previewDurationSec ?? WAVE1_DEFAULT_PREVIEW_DURATION_SEC)}
                onChange={(e) => {
                  const nextDur = Number(e.target.value);
                  const clamped = computePreviewWindowTimeline({
                    ...activeCase,
                    previewDurationSec: nextDur,
                  });
                  updateActiveCase({
                    previewDurationSec: clamped.previewDurationSec,
                    previewStartSec: clamped.previewStartSec,
                  });
                }}
                className="w-full min-h-[42px] pl-3.5 pr-9 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              >
                <option value="3">3.0 сек</option>
                <option value="3.5">3.5 сек</option>
                <option value="4">4.0 сек</option>
                <option value="4.5">4.5 сек</option>
                <option value="5">5.0 сек</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="case-clip-start"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75 whitespace-nowrap"
              >
                Старт ролика (сек)
              </label>
              <input
                id="case-clip-start"
                type="number"
                min={0}
                step={0.1}
                value={activeCase.clipStartSec ?? 0}
                onChange={(e) => {
                  const nextStart = Math.max(0, Number(e.target.value) || 0);
                  const nextEnd = activeCase.clipEndSec;
                  updateActiveCase({
                    clipStartSec: Math.round(nextStart * 10) / 10,
                    durationSec:
                      nextEnd && nextEnd > nextStart
                        ? Math.max(1, Math.round(nextEnd - nextStart))
                        : activeCase.durationSec,
                  });
                }}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="case-clip-end"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75 whitespace-nowrap"
              >
                Финал ролика (сек)
              </label>
              <input
                id="case-clip-end"
                type="number"
                min={0.5}
                step={0.1}
                value={
                  activeCase.clipEndSec ??
                  Math.round(
                    ((activeCase.clipStartSec ?? 0) + activeCase.durationSec) * 10
                  ) / 10
                }
                onChange={(e) => {
                  const start = activeCase.clipStartSec ?? 0;
                  const nextEnd = Math.max(
                    start + 1,
                    Number(e.target.value) || start + 15
                  );
                  updateActiveCase({
                    clipEndSec: Math.round(nextEnd * 10) / 10,
                    durationSec: Math.max(1, Math.round(nextEnd - start)),
                  });
                }}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>
          </div>

          {/* Inline Studio Audition Bar */}
          <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => startAudition('preview')}
                data-testid="admin-audition-preview-btn"
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  auditionMode === 'preview'
                    ? 'bg-[#FF4820] text-white'
                    : 'bg-[#F7F6F2] dark:bg-[#1E1E24] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                }`}
              >
                {auditionMode === 'preview' ? (
                  <Pause className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                )}
                <span className="tabular-nums">
                  {auditionMode === 'preview'
                    ? `Играет превью · ${auditionElapsed.toFixed(1)} / ${auditionTotal.toFixed(1)} с`
                    : `Слушать превью (${previewWindow.startSec}–${previewWindow.endSec} с)`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => startAudition('full')}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  auditionMode === 'full'
                    ? 'bg-[#111111] text-white dark:bg-white dark:text-[#111111]'
                    : 'bg-transparent text-[#111111]/78 dark:text-[#F4F3EF]/78 border border-[#111111]/12 dark:border-white/12 hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                {auditionMode === 'full' ? (
                  <Pause className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                )}
                <span className="tabular-nums">
                  {auditionMode === 'full'
                    ? `Пауза · ${formatAudioTime(auditionElapsed)} / ${formatAudioTime(auditionTotal)}`
                    : `Слушать весь ролик (${formatAudioTime(activeCase.durationSec)})`}
                </span>
              </button>
            </div>

            <span className="text-xs text-[#111111]/52 dark:text-[#F4F3EF]/52 tabular-nums">
              Превью при наведении: {previewWindow.durationSec.toFixed(1)} сек
            </span>
          </div>
        </section>

        {/* Block 3: Cover Artwork & Live Card Preview */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
                3. Обложка и предпросмотр карточки портфолио
              </h4>
              <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
                Как карточка выглядит в секции «Наши работы» с обновлённым заголовком и таймингом превью.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 max-w-full">
              <select
                id="case-surface-preset"
                aria-label="Палитра фона постера"
                value={activeCase.editorialSurfaceBg}
                onChange={(e) => {
                  const preset = SURFACE_PRESETS.find(
                    (p) => p.surface === e.target.value
                  );
                  if (preset) {
                    updateActiveCase({
                      editorialSurfaceBg: preset.surface,
                      posterGradientClass: preset.gradient,
                      posterGlowClass: preset.glow,
                    });
                  }
                }}
                className="min-h-[38px] max-w-full min-w-0 px-3 py-1.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-medium text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              >
                {SURFACE_PRESETS.map((preset) => (
                  <option key={preset.surface} value={preset.surface}>
                    {preset.label}
                  </option>
                ))}
              </select>

              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={handleCoverFilePicked}
                className="sr-only"
              />
              <button
                type="button"
                disabled={isUploadingCover}
                onClick={() => coverInputRef.current?.click()}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ImagePlus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{isUploadingCover ? 'Загрузка…' : 'Сменить фото'}</span>
              </button>
            </div>
          </div>

          <div
            data-testid="admin-portfolio-live-card"
            className={`rounded-2xl overflow-hidden border border-[#111111]/10 dark:border-white/10 grid grid-cols-1 sm:grid-cols-12 ${activeCase.editorialSurfaceBg} text-[#F4F3EF]`}
          >
            <div className="sm:col-span-8 p-5 sm:p-6 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs text-white/62 tabular-nums">
                  {activeCase.tag} · {activeCase.client} · превью{' '}
                  {previewWindow.startSec}–{previewWindow.endSec} с
                </p>
                <h5 className="text-lg sm:text-xl font-bold tracking-tight leading-snug text-white">
                  {activeCase.headline}
                </h5>
                <p className="text-xs leading-relaxed text-white/74 line-clamp-2">
                  {activeCase.summary}
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs text-white/65 tabular-nums">
                <span className="font-semibold text-[#FF4820]">
                  Слушать · {formatAudioTime(activeCase.durationSec)}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Наведение: {previewWindow.durationSec.toFixed(1)} сек
                </span>
              </div>
            </div>

            <div
              className={`sm:col-span-4 min-h-[150px] relative overflow-hidden ${activeCase.posterGradientClass}`}
            >
              <img
                src={activeCase.coverImageUrl}
                alt={activeCase.coverImageAlt}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.dataset.fallbackApplied) {
                    img.dataset.fallbackApplied = '1';
                    img.src =
                      '/src/assets/images/hero_studio_editorial_1794399404984.jpg';
                  }
                }}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
