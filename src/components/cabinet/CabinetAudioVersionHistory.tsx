import {
  CheckCircle2,
  Download,
  FileAudio,
  History,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
} from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  claimExclusiveAudioFocus,
  onExclusiveAudioFocusClaimed,
} from '../../audio/audioFocusCoordinator';
import {
  buildDeliverableDownloadUrls,
  type OrderAudioVersionHistory,
} from '../../data/clientCabinetArchitecture';
import { formatFileSizeReadable } from '../../data/clientCabinetHelpers';
import type { AudioSeekRequest } from './useClientCabinetController';

type AudioDeliverableVersionItem =
  OrderAudioVersionHistory['versionsChronological'][number];

let activeCabinetDeckInstanceId: string | null = null;

function formatVersionDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const datePart = d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${datePart}, ${timePart}`;
  } catch {
    return iso;
  }
}

function formatStudioTimecode(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00.0';
  const mins = Math.floor(sec / 60);
  const rem = sec - mins * 60;
  const wholeSec = Math.floor(rem);
  const tenths = Math.floor((rem - wholeSec + 1e-6) * 10);
  return `${String(mins).padStart(2, '0')}:${String(wholeSec).padStart(2, '0')}.${Math.min(9, Math.max(0, tenths))}`;
}

interface StudioVersionAudioDeckProps {
  orderNumber: string;
  rescueToken: string;
  activeVersion: AudioDeliverableVersionItem;
  allVersions: readonly AudioDeliverableVersionItem[];
  audioTestId: string;
  externalSeekTimeSec?: number;
  externalSeekNonce?: number;
  onSelectVersionId?: (fileId: string, preserveTimeSec: number, wasPlaying: boolean) => void;
  resumeState?: { timeSec: number; autoResume: boolean } | null;
  onConsumeResumeState?: () => void;
  onTimeUpdateSec?: (timeSec: number) => void;
}

function StudioVersionAudioDeck({
  orderNumber,
  rescueToken,
  activeVersion,
  allVersions,
  audioTestId,
  externalSeekTimeSec,
  externalSeekNonce,
  onSelectVersionId,
  resumeState,
  onConsumeResumeState,
  onTimeUpdateSec,
}: StudioVersionAudioDeckProps) {
  const instanceId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState(false);

  const { previewHref } = buildDeliverableDownloadUrls(
    orderNumber,
    rescueToken,
    activeVersion.file.id
  );

  // Координация эксклюзивного аудио-фокуса: при запуске другого плеера ставим текущий на паузу
  useEffect(() => {
    return onExclusiveAudioFocusClaimed((activeChannel) => {
      if (
        activeChannel !== 'cabinet_player' ||
        activeCabinetDeckInstanceId !== instanceId
      ) {
        const el = audioRef.current;
        if (el && !el.paused) {
          el.pause();
        }
      }
    });
  }, [instanceId]);

  useEffect(() => {
    const el = audioRef.current;
    return () => {
      if (el && !el.paused) {
        el.pause();
      }
    };
  }, []);

  // Сохранение позиции воспроизведения при переключении A/B между версиями v1 / v2 / master
  useEffect(() => {
    if (!resumeState) return;
    const el = audioRef.current;
    if (!el) return;
    const targetSec = Math.max(0, resumeState.timeSec);
    const applyResume = () => {
      try {
        if (Number.isFinite(el.duration) && el.duration > 0) {
          el.currentTime = Math.min(targetSec, Math.max(0, el.duration - 0.05));
        } else {
          el.currentTime = targetSec;
        }
      } catch {
        // Ignore seek before metadata if unsupported
      }
      setCurrentTime(targetSec);
      onTimeUpdateSec?.(targetSec);
      if (resumeState.autoResume) {
        activeCabinetDeckInstanceId = instanceId;
        claimExclusiveAudioFocus('cabinet_player');
        void el.play().catch(() => {
          setIsPlaying(false);
        });
      }
      onConsumeResumeState?.();
    };

    if (el.readyState >= 1) {
      applyResume();
      return;
    }
    el.addEventListener('loadedmetadata', applyResume, { once: true });
    el.load();
    return () => {
      el.removeEventListener('loadedmetadata', applyResume);
    };
  }, [instanceId, onConsumeResumeState, onTimeUpdateSec, resumeState]);

  // Переход к таймкоду по клику из конвейера согласования
  useEffect(() => {
    if (externalSeekNonce === undefined || externalSeekTimeSec === undefined) {
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    const target = Math.max(0, externalSeekTimeSec);
    const applySeek = () => {
      try {
        el.currentTime =
          Number.isFinite(el.duration) && el.duration > 0
            ? Math.min(target, el.duration)
            : target;
      } catch {
        // Ignore transient seek error
      }
      setCurrentTime(target);
      onTimeUpdateSec?.(target);
    };
    if (el.readyState >= 1) {
      applySeek();
    } else {
      el.addEventListener('loadedmetadata', applySeek, { once: true });
      el.load();
    }
  }, [externalSeekNonce, externalSeekTimeSec, onTimeUpdateSec]);

  const togglePlayPause = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setLoadError(false);
    if (el.paused) {
      activeCabinetDeckInstanceId = instanceId;
      claimExclusiveAudioFocus('cabinet_player');
      void el.play().catch(() => {
        setIsPlaying(false);
        setLoadError(true);
      });
    } else {
      el.pause();
    }
  }, [instanceId]);

  const seekTo = useCallback(
    (nextSec: number) => {
      const el = audioRef.current;
      const maxDur = duration > 0 ? duration : 60;
      const clamped = Math.max(0, Math.min(maxDur, nextSec));
      if (el) {
        try {
          el.currentTime = clamped;
        } catch {
          // Ignore seek before metadata
        }
      }
      setCurrentTime(clamped);
      onTimeUpdateSec?.(clamped);
    },
    [duration, onTimeUpdateSec]
  );

  const effectiveMax = duration > 0 ? duration : Math.max(20, Math.ceil(currentTime));

  return (
    <div
      data-testid={`studio-deck-${activeVersion.file.id}`}
      className="rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 p-3 sm:p-3.5 space-y-2.5"
    >
      <audio
        ref={audioRef}
        preload="none"
        src={previewHref}
        data-testid={audioTestId}
        aria-label={`Аудиоплеер версии ${activeVersion.versionCode}: ${activeVersion.file.title}`}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) {
            setDuration(d);
          }
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setCurrentTime(t);
          onTimeUpdateSec?.(t);
        }}
        onError={() => {
          setIsPlaying(false);
          setLoadError(true);
        }}
        className="sr-only"
      />

      {/* Верхняя полоса студийного контрола: быстрое A/B сравнение версий + индикатор стандарта вещания */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] tabular-nums">
        <div className="flex flex-wrap items-center gap-1.5 text-[#111111]/75 dark:text-[#F4F3EF]/75">
          <Volume2 className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
          <span className="font-mono font-bold text-[#111111] dark:text-[#F4F3EF]">
            {activeVersion.versionCode}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {activeVersion.isFinalMaster
              ? 'Эфирный мастер −14 LUFS'
              : 'Контрольное прослушивание'}
          </span>
        </div>

        {allVersions.length > 1 && onSelectVersionId && (
          <div
            role="group"
            aria-label="Сравнение версий ролика с сохранением таймкода"
            className="inline-flex flex-wrap items-center gap-1"
          >
            <span className="text-[#111111]/68 dark:text-[#F4F3EF]/68 mr-0.5">
              A/B версия:
            </span>
            {allVersions.slice(0, 4).map((candidate) => {
              const isCurrent = candidate.file.id === activeVersion.file.id;
              return (
                <button
                  key={candidate.file.id}
                  type="button"
                  aria-pressed={isCurrent}
                  data-testid={`studio-ab-switch-${orderNumber}-${candidate.versionCode}`}
                  onClick={() => {
                    if (!isCurrent) {
                      onSelectVersionId(candidate.file.id, currentTime, isPlaying);
                    }
                  }}
                  className={`min-h-[32px] sm:min-h-[26px] px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                    isCurrent
                      ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                      : 'bg-white dark:bg-[#141418] text-[#111111]/78 dark:text-[#F4F3EF]/78 border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820]'
                  }`}
                >
                  {candidate.versionCode}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Транспортная панель с крупными кнопками и точной шкалой таймкода */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={togglePlayPause}
          data-testid={`studio-play-toggle-${activeVersion.file.id}`}
          aria-label={
            isPlaying
              ? `Пауза версии ${activeVersion.versionCode}`
              : `Воспроизвести версию ${activeVersion.versionCode}`
          }
          className="min-h-[44px] min-w-[44px] sm:min-h-[38px] sm:min-w-[38px] rounded-xl bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 shrink-0" aria-hidden="true" />
          ) : (
            <Play className="w-4 h-4 shrink-0 ml-0.5" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={() => seekTo(currentTime - 5)}
          aria-label="Перемотать на 5 секунд назад"
          className="min-h-[44px] min-w-[40px] sm:min-h-[34px] sm:min-w-[34px] px-2 rounded-lg border border-[#111111]/14 dark:border-white/14 bg-white dark:bg-[#141418] hover:border-[#FF4820] text-[#111111]/80 dark:text-[#F4F3EF]/80 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
        >
          <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        </button>

        <div className="flex-1 min-w-0 space-y-1">
          <input
            type="range"
            min={0}
            max={effectiveMax}
            step={0.1}
            value={Math.min(currentTime, effectiveMax)}
            aria-label={`Позиция воспроизведения ${activeVersion.versionCode} в секундах`}
            onChange={(e) => seekTo(Number.parseFloat(e.target.value) || 0)}
            className="w-full h-2 accent-[#FF4820] cursor-pointer"
          />
          <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-[#111111]/75 dark:text-[#F4F3EF]/75 tabular-nums">
            <span data-testid={`studio-timecode-${activeVersion.file.id}`}>
              {formatStudioTimecode(currentTime)}
            </span>
            <span>
              {duration > 0 ? formatStudioTimecode(duration) : 'Нажмите Play для потока'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => seekTo(currentTime + 5)}
          aria-label="Перемотать на 5 секунд вперёд"
          className="min-h-[44px] min-w-[40px] sm:min-h-[34px] sm:min-w-[34px] px-2 rounded-lg border border-[#111111]/14 dark:border-white/14 bg-white dark:bg-[#141418] hover:border-[#FF4820] text-[#111111]/80 dark:text-[#F4F3EF]/80 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
        >
          <RotateCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        </button>
      </div>

      {loadError && (
        <p role="alert" className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]">
          Потоковое воспроизведение недоступно в текущем окружении — скачайте файл кнопкой справа.
        </p>
      )}
    </div>
  );
}

export interface CabinetAudioVersionHistoryProps {
  orderNumber: string;
  rescueToken: string;
  history: OrderAudioVersionHistory;
  supplementaryCount?: number;
  variant: 'active_card' | 'history_row';
  defaultExpandLatestAudio?: boolean;
  highlightedVersionCode?: string;
  seekRequest?: AudioSeekRequest;
  onTimeUpdateSec?: (timeSec: number) => void;
}

export function CabinetAudioVersionHistory({
  orderNumber,
  rescueToken,
  history,
  supplementaryCount = 0,
  variant,
  defaultExpandLatestAudio = false,
  highlightedVersionCode,
  seekRequest,
  onTimeUpdateSec,
}: CabinetAudioVersionHistoryProps) {
  const [openFileId, setOpenFileId] = useState<string | null>(() => {
    if (defaultExpandLatestAudio && history.latestVersion) {
      return history.latestVersion.file.id;
    }
    return null;
  });

  const [resumeState, setResumeState] = useState<{
    fileId: string;
    timeSec: number;
    autoResume: boolean;
  } | null>(null);

  const [showAllOlderVersions, setShowAllOlderVersions] = useState<boolean>(false);

  // Реакция на переход по таймкоду из конвейера согласования
  useEffect(() => {
    if (!seekRequest) return;
    const targetVer = seekRequest.versionCode
      ? history.versionsNewestFirst.find(
          (v) => v.versionCode === seekRequest.versionCode
        )
      : history.latestVersion;
    if (targetVer) {
      setOpenFileId(targetVer.file.id);
      if (
        history.versionsNewestFirst.findIndex(
          (v) => v.file.id === targetVer.file.id
        ) >= 4
      ) {
        setShowAllOlderVersions(true);
      }
    }
  }, [history.latestVersion, history.versionsNewestFirst, seekRequest]);

  // Реакция на переход по уведомлению к конкретной версии
  useEffect(() => {
    if (!highlightedVersionCode) return;
    const matched = history.versionsNewestFirst.find(
      (v) => v.versionCode === highlightedVersionCode
    );
    if (matched) {
      setOpenFileId(matched.file.id);
      if (
        history.versionsNewestFirst.findIndex((v) => v.file.id === matched.file.id) >= 4
      ) {
        setShowAllOlderVersions(true);
      }
    }
  }, [highlightedVersionCode, history.versionsNewestFirst]);

  if (!history.hasAudioVersions) {
    return null;
  }

  const toggleAudioPlayer = (fileId: string) => {
    setResumeState(null);
    setOpenFileId((prev) => (prev === fileId ? null : fileId));
  };

  const handleSelectAbVersion = (
    targetFileId: string,
    preserveTimeSec: number,
    wasPlaying: boolean
  ) => {
    if (
      history.versionsNewestFirst.findIndex((v) => v.file.id === targetFileId) >= 4
    ) {
      setShowAllOlderVersions(true);
    }
    setResumeState({
      fileId: targetFileId,
      timeSec: preserveTimeSec,
      autoResume: wasPlaying,
    });
    setOpenFileId(targetFileId);
  };

  const MAX_VISIBLE_DEFAULT = 4;
  const visibleVersions =
    showAllOlderVersions || history.versionsNewestFirst.length <= MAX_VISIBLE_DEFAULT
      ? history.versionsNewestFirst
      : history.versionsNewestFirst.slice(0, MAX_VISIBLE_DEFAULT);
  const hiddenCount = history.versionsNewestFirst.length - visibleVersions.length;

  return (
    <div
      data-testid={`cabinet-version-history-${variant}-${orderNumber}`}
      className="space-y-2.5"
    >
      {/* Строка сводки истории итераций (чистая типографика без статичных пилюль) */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs tabular-nums">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[#111111]/74 dark:text-[#F4F3EF]/74">
          <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
            История версий аудиоролика
          </span>
          <span aria-hidden="true">·</span>
          <span
            data-testid={`cabinet-version-chain-${variant}-${orderNumber}`}
            className="font-mono font-semibold text-[#111111] dark:text-[#F4F3EF]"
          >
            {history.progressionChainText}
          </span>
          <span aria-hidden="true">·</span>
          <span>Итераций: {history.totalVersionsCount}</span>
        </div>

        {supplementaryCount > 0 && (
          <span className="text-[#111111]/68 dark:text-[#F4F3EF]/68">
            Доп. документы: {supplementaryCount}
          </span>
        )}
      </div>

      {/* Одноуровневый список всех версий с тонкими разделителями */}
      <ul className="divide-y divide-[#111111]/10 dark:divide-white/10 border-t border-b border-[#111111]/10 dark:border-white/10">
        {visibleVersions.map((ver) => {
          const { file } = ver;
          const { downloadHref } = buildDeliverableDownloadUrls(
            orderNumber,
            rescueToken,
            file.id
          );
          const isPlayerOpen = openFileId === file.id;
          const isHighlighted = highlightedVersionCode === ver.versionCode;

          const rowTestId =
            variant === 'active_card'
              ? `cabinet-deliverable-${file.id}`
              : ver.isFinalMaster
                ? `cabinet-history-master-${file.id}`
                : `cabinet-history-iteration-${file.id}`;

          const previewBtnTestId =
            variant === 'active_card'
              ? `cabinet-preview-deliverable-${file.id}`
              : `cabinet-history-preview-toggle-${file.id}`;

          const downloadBtnTestId =
            variant === 'active_card'
              ? `cabinet-download-deliverable-${file.id}`
              : `cabinet-history-download-${file.id}`;

          const audioTestId =
            variant === 'active_card'
              ? `cabinet-audio-deliverable-${file.id}`
              : `cabinet-history-audio-${file.id}`;

          return (
            <li
              key={file.id}
              data-testid={rowTestId}
              data-version-code={ver.versionCode}
              className={`py-3.5 space-y-2.5 transition-colors ${
                isHighlighted
                  ? 'bg-[#FF4820]/[0.04] dark:bg-[#FF4820]/[0.07] px-2.5 rounded-xl'
                  : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  {/* Мета-строка версии: код итерации · стадия · дата загрузки · размер */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums">
                    {ver.isFinalMaster ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#15803D] dark:text-[#4ADE80]">
                        <CheckCircle2
                          className="w-3.5 h-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="font-mono font-bold">
                          {ver.versionCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{ver.stageLabel}</span>
                      </span>
                    ) : ver.isCurrentLatest ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#D93814] dark:text-[#FF6B47]">
                        <FileAudio
                          className="w-3.5 h-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="font-mono font-bold">
                          {ver.versionCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{ver.stageLabel} (на согласовании)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#111111]/76 dark:text-[#F4F3EF]/76">
                        <History
                          className="w-3.5 h-3.5 shrink-0 text-[#111111]/62 dark:text-[#F4F3EF]/62"
                          aria-hidden="true"
                        />
                        <span className="font-mono font-bold text-[#111111] dark:text-[#F4F3EF]">
                          {ver.versionCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{ver.stageLabel}</span>
                      </span>
                    )}

                    <span
                      aria-hidden="true"
                      className="text-[#111111]/45 dark:text-[#F4F3EF]/45"
                    >
                      ·
                    </span>
                    <span className="text-[#111111]/70 dark:text-[#F4F3EF]/70">
                      {formatVersionDateTime(file.uploadedAt)}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-[#111111]/45 dark:text-[#F4F3EF]/45"
                    >
                      ·
                    </span>
                    <span className="text-[#111111]/70 dark:text-[#F4F3EF]/70">
                      {formatFileSizeReadable(file.sizeBytes)}
                    </span>
                  </div>

                  {/* Заголовок версии и комментарий продюсера */}
                  <p className="text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] break-words">
                    {file.title}
                  </p>

                  {ver.versionNote && (
                    <p className="text-xs text-[#111111]/76 dark:text-[#F4F3EF]/76 leading-relaxed">
                      {ver.versionNote}
                    </p>
                  )}

                  <p className="font-mono text-[11px] text-[#111111]/68 dark:text-[#F4F3EF]/68 break-all sm:break-normal">
                    {file.fileName}
                  </p>
                </div>

                {/* Кнопки прослушивания и скачивания конкретной версии */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    aria-expanded={isPlayerOpen}
                    aria-label={
                      isPlayerOpen
                        ? `Скрыть плеер версии ${ver.versionCode}`
                        : `Прослушать версию ${ver.versionCode} (${file.title})`
                    }
                    data-testid={previewBtnTestId}
                    onClick={() => toggleAudioPlayer(file.id)}
                    className="min-h-[44px] sm:min-h-[36px] px-3.5 py-1.5 rounded-lg border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                  >
                    <Play
                      className="w-3.5 h-3.5 text-[#FF4820] shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {isPlayerOpen ? 'Скрыть плеер' : 'Прослушать'}
                    </span>
                  </button>

                  <a
                    href={downloadHref}
                    download={file.fileName}
                    data-testid={downloadBtnTestId}
                    className={
                      ver.isFinalMaster
                        ? 'min-h-[44px] sm:min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]'
                        : 'min-h-[44px] sm:min-h-[36px] px-3.5 py-1.5 rounded-lg border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]'
                    }
                  >
                    <Download
                      className="w-3.5 h-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {ver.isFinalMaster
                        ? 'Скачать мастер WAV'
                        : `Скачать ${ver.versionCode}`}
                    </span>
                  </a>
                </div>
              </div>

              {isPlayerOpen && (
                <StudioVersionAudioDeck
                  orderNumber={orderNumber}
                  rescueToken={rescueToken}
                  activeVersion={ver}
                  allVersions={history.versionsNewestFirst}
                  audioTestId={audioTestId}
                  externalSeekTimeSec={seekRequest?.timeSec}
                  externalSeekNonce={seekRequest?.nonce}
                  onSelectVersionId={handleSelectAbVersion}
                  resumeState={
                    resumeState && resumeState.fileId === file.id
                      ? {
                          timeSec: resumeState.timeSec,
                          autoResume: resumeState.autoResume,
                        }
                      : null
                  }
                  onConsumeResumeState={() => setResumeState(null)}
                  onTimeUpdateSec={onTimeUpdateSec}
                />
              )}
            </li>
          );
        })}
      </ul>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAllOlderVersions(true)}
          className="min-h-[44px] sm:min-h-[34px] px-2 text-xs font-semibold text-[#D93814] dark:text-[#FF6B47] hover:underline cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
        >
          Показать ещё ранние версии ({hiddenCount})
        </button>
      )}
    </div>
  );
}
