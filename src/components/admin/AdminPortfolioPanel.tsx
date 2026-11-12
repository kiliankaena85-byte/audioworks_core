import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Pause,
  Play,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import {
  UploadedAudioResult,
  UploadedImageResult,
} from '../../cms/studioCmsStore';
import { formatAudioTime } from '../../data/audioworksCommercial';
import { getCasePreviewWindow } from '../../data/casesData';
import {
  clampPreviewTiming,
  PortfolioCaseRecord,
  PortfolioPersonaFocus,
} from '../../data/studioCmsTypes';

interface AdminPortfolioPanelProps {
  flagshipReel: PortfolioCaseRecord;
  portfolioCases: PortfolioCaseRecord[];
  onChangeFlagshipReel: (nextReel: PortfolioCaseRecord) => void;
  onChangePortfolioCases: (nextCases: PortfolioCaseRecord[]) => void;
  onUploadAudio: (
    file: File
  ) => Promise<{ ok: true; result: UploadedAudioResult } | { ok: false; error: string }>;
  onUploadImage: (
    file: File
  ) => Promise<{ ok: true; result: UploadedImageResult } | { ok: false; error: string }>;
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
  onChangeFlagshipReel,
  onChangePortfolioCases,
  onUploadAudio,
  onUploadImage,
}: AdminPortfolioPanelProps) {
  const [selectedId, setSelectedId] = useState<string>(
    portfolioCases[0]?.id ?? flagshipReel.id
  );
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);

  const [auditionMode, setAuditionMode] = useState<AuditionMode>(null);
  const [auditionElapsed, setAuditionElapsed] = useState(0);
  const [auditionTotal, setAuditionTotal] = useState(4);

  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);
  const auditionTimerRef = useRef<number | null>(null);

  const isEditingFlagship = selectedId === flagshipReel.id;
  const activeCase: PortfolioCaseRecord = isEditingFlagship
    ? flagshipReel
    : portfolioCases.find((c) => c.id === selectedId) ?? portfolioCases[0] ?? flagshipReel;

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
    const merged: PortfolioCaseRecord = { ...activeCase, ...patch };
    if (isEditingFlagship) {
      onChangeFlagshipReel(merged);
    } else {
      onChangePortfolioCases(
        portfolioCases.map((c) => (c.id === activeCase.id ? merged : c))
      );
    }
  };

  const handleAddNewCase = () => {
    const nextIdx = portfolioCases.length + 1;
    const newId = `case-studio-${Date.now().toString(36).slice(-5)}`;
    const newCase: PortfolioCaseRecord = {
      id: newId,
      client: `Новый клиент ${nextIdx}`,
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
      previewDurationSec: 4,
      coverImageUrl:
        '/src/assets/images/hero_studio_editorial_1794399404984.jpg',
      coverImageAlt: 'Атмосферный кадр студийного кейса AudioWorks',
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

  const handleAudioFilePicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

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
      previewDurationSec: activeCase.previewDurationSec ?? 4,
    });

    updateActiveCase({
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
      text: `Аудио «${res.result.fileName}» загружено (${res.result.durationSec} сек). Нажмите «Сохранить и опубликовать», чтобы применить на сайте.`,
    });
  };

  const handleCoverFilePicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsUploadingCover(true);
    setUploadNotice(null);

    const res = await onUploadImage(file);
    setIsUploadingCover(false);

    if (!res.ok) {
      setUploadNotice({ kind: 'error', text: res.error });
      return;
    }

    updateActiveCase({
      coverImageUrl: res.result.url,
    });
    setUploadNotice({
      kind: 'ok',
      text: `Обложка «${res.result.fileName}» загружена.`,
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
      mode === 'preview' ? win.startSec : Math.max(0, activeCase.clipStartSec ?? 0);
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

  const previewWindow = getCasePreviewWindow(activeCase);
  const publishedCount = portfolioCases.filter((c) => c.published !== false).length;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left Column: Case Directory & Reordering */}
      <div className="xl:col-span-4 rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#111111]/10 dark:border-white/10 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
              Работы в портфолио
            </h2>
            <p className="text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55 tabular-nums">
              Опубликовано кейсов: {publishedCount} из {portfolioCases.length}
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
                <span className="font-semibold text-[#FF4820]">Флагманский шоурил</span>
                <span>{formatAudioTime(flagshipReel.durationSec)}</span>
              </div>
              <p className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF] truncate">
                {flagshipReel.client}
              </p>
              <p className="text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55">
                {flagshipReel.published !== false ? 'Опубликован над сеткой' : 'Скрыт с витрины'} · превью {getCasePreviewWindow(flagshipReel).durationSec} сек
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
                    <span>
                      {item.published !== false ? 'Опубликован' : 'Черновик (скрыт)'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatAudioTime(item.durationSec)}</span>
                  </div>
                  <p className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF] truncate">
                    {item.client}
                  </p>
                  <p className="text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55 truncate tabular-nums">
                    {item.tag} · превью с {win.startSec} с ({win.durationSec} с)
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

      {/* Right Column: Case Content, Cover & Audio Preview Timing Editor */}
      <div className="xl:col-span-8 rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-6 sm:p-8 space-y-8">
        {/* Header & Visibility Controls */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-[#111111]/10 dark:border-white/10">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
              {isEditingFlagship
                ? 'Редактирование флагманского промо-ролика студии'
                : `Карточка портфолио · ID: ${activeCase.id}`}
            </p>
            <h3 className="text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
              {activeCase.client}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#111111]/14 dark:border-white/14 inline-flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
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

            {!isEditingFlagship && portfolioCases.length > 1 && (
              <button
                type="button"
                onClick={handleDeleteSelectedCase}
                aria-label={`Удалить кейс «${activeCase.client}»`}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#DC2626]/30 text-[#DC2626] dark:text-[#F87171] hover:bg-[#DC2626]/10 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Удалить кейс</span>
              </button>
            )}
          </div>
        </div>

        {uploadNotice && (
          <div
            role="status"
            className={`px-4 py-3 rounded-xl text-xs font-medium border ${
              uploadNotice.kind === 'ok'
                ? 'bg-[#16A34A]/10 border-[#16A34A]/30 text-[#15803D] dark:text-[#4ADE80]'
                : 'bg-[#DC2626]/10 border-[#DC2626]/30 text-[#DC2626] dark:text-[#F87171]'
            }`}
          >
            {uploadNotice.text}
          </div>
        )}

        {/* Section 1: Audio Master & Hover Preview Timing (3-5 sec) */}
        <section className="space-y-5 pb-8 border-b border-[#111111]/10 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
                Звуковая дорожка (WAV / MP3) и тайминг превью
              </h4>
              <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
                Загрузите мастер-файл и задайте точное окно 3–5 секунд, которое звучит при наведении курсора на карточку.
              </p>
            </div>

            <div>
              <input
                ref={audioInputRef}
                type="file"
                accept=".wav,.mp3,audio/wav,audio/mpeg,audio/*"
                onChange={handleAudioFilePicked}
                data-testid="admin-case-audio-input"
                className="hidden"
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
                  {isUploadingAudio ? 'Загрузка аудио…' : 'Загрузить WAV / MP3'}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-8 space-y-1.5">
              <label
                htmlFor="case-audio-url"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
              >
                Путь к аудиофайлу (или оставьте пустым для синтеза атмосферы)
              </label>
              <input
                id="case-audio-url"
                type="text"
                value={activeCase.audioUrl ?? ''}
                onChange={(e) =>
                  updateActiveCase({
                    audioUrl: e.target.value.trim() || undefined,
                  })
                }
                placeholder="/assets/cms/brand-spot.wav"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-mono text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="sm:col-span-4 space-y-1.5">
              <label
                htmlFor="case-duration-sec"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
              >
                Хронометраж ролика (сек)
              </label>
              <input
                id="case-duration-sec"
                type="number"
                min={1}
                max={600}
                step={1}
                value={activeCase.durationSec}
                onChange={(e) => {
                  const val = Math.max(1, Number(e.target.value) || 15);
                  updateActiveCase({ durationSec: Math.round(val) });
                }}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
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
                  Math.round(((activeCase.clipStartSec ?? 0) + activeCase.durationSec) * 10) /
                    10
                }
                onChange={(e) => {
                  const start = activeCase.clipStartSec ?? 0;
                  const nextEnd = Math.max(start + 1, Number(e.target.value) || start + 15);
                  updateActiveCase({
                    clipEndSec: Math.round(nextEnd * 10) / 10,
                    durationSec: Math.max(1, Math.round(nextEnd - start)),
                  });
                }}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="case-preview-start"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75 whitespace-nowrap"
              >
                Старт превью (сек)
              </label>
              <input
                id="case-preview-start"
                type="number"
                min={0}
                step={0.1}
                value={activeCase.previewStartSec ?? activeCase.clipStartSec ?? 0}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  updateActiveCase({
                    previewStartSec: Math.round(val * 10) / 10,
                  });
                }}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
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
                value={String(activeCase.previewDurationSec ?? 4)}
                onChange={(e) =>
                  updateActiveCase({
                    previewDurationSec: Number(e.target.value),
                  })
                }
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              >
                <option value="3">3.0 сек</option>
                <option value="3.5">3.5 сек</option>
                <option value="4">4.0 сек (эталон)</option>
                <option value="4.5">4.5 сек</option>
                <option value="5">5.0 сек</option>
              </select>
            </div>
          </div>

          {/* Inline Studio Audition Bar */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
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
                    : `Проверить превью (${previewWindow.startSec}–${previewWindow.endSec} с)`}
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
              Окно наведения: {previewWindow.startSec} с → {previewWindow.endSec} с
            </span>
          </div>
        </section>

        {/* Section 2: Editorial Texts & Persona Targeting */}
        <section className="space-y-5 pb-8 border-b border-[#111111]/10 dark:border-white/10">
          <h4 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
            Тексты карточки и отраслевой фокус
          </h4>

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
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] disabled:opacity-50 focus:outline-none focus:border-[#FF4820]"
              >
                <option value="fmcg">FMCG и федеральный ритейл</option>
                <option value="real_estate">Девелопмент и недвижимость</option>
                <option value="general">Универсальный кейс</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="case-headline-input"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Главный заголовок кейса
            </label>
            <input
              id="case-headline-input"
              type="text"
              value={activeCase.headline}
              onChange={(e) => updateActiveCase({ headline: e.target.value })}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>

          <div className="space-y-1.5">
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

          <div className="space-y-1.5">
            <label
              htmlFor="case-quote-input"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Ключевая фраза-образ из ролика (для плавающего плеера)
            </label>
            <input
              id="case-quote-input"
              type="text"
              value={activeCase.quoteImage}
              onChange={(e) => updateActiveCase({ quoteImage: e.target.value })}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>
        </section>

        {/* Section 3: Cover Artwork & Editorial Surface Palette */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
                Обложка и цветовая среда постера
              </h4>
              <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
                Фотография карточки и оттенок студийного сплита при показе на первом широком месте.
              </p>
            </div>

            <div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={handleCoverFilePicked}
                className="hidden"
              />
              <button
                type="button"
                disabled={isUploadingCover}
                onClick={() => coverInputRef.current?.click()}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ImagePlus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{isUploadingCover ? 'Загрузка…' : 'Загрузить фото'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
            <div className="sm:col-span-8 space-y-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="case-cover-url"
                  className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                >
                  URL обложки
                </label>
                <input
                  id="case-cover-url"
                  type="text"
                  value={activeCase.coverImageUrl}
                  onChange={(e) =>
                    updateActiveCase({ coverImageUrl: e.target.value })
                  }
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-mono text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="case-surface-preset"
                  className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                >
                  Палитра фона постера
                </label>
                <select
                  id="case-surface-preset"
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
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                >
                  {SURFACE_PRESETS.map((preset) => (
                    <option key={preset.surface} value={preset.surface}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              className={`sm:col-span-4 h-32 rounded-xl overflow-hidden relative border border-[#111111]/10 dark:border-white/10 ${activeCase.posterGradientClass}`}
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
