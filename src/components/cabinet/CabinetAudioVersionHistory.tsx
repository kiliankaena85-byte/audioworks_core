import {
  CheckCircle2,
  Download,
  FileAudio,
  History,
  Play,
} from 'lucide-react';
import { useState } from 'react';
import {
  buildDeliverableDownloadUrls,
  type OrderAudioVersionHistory,
} from '../../data/clientCabinetArchitecture';
import { formatFileSizeReadable } from '../../data/clientCabinetHelpers';

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

export interface CabinetAudioVersionHistoryProps {
  orderNumber: string;
  rescueToken: string;
  history: OrderAudioVersionHistory;
  supplementaryCount?: number;
  variant: 'active_card' | 'history_row';
  defaultExpandLatestAudio?: boolean;
}

export function CabinetAudioVersionHistory({
  orderNumber,
  rescueToken,
  history,
  supplementaryCount = 0,
  variant,
  defaultExpandLatestAudio = false,
}: CabinetAudioVersionHistoryProps) {
  const [expandedAudioById, setExpandedAudioById] = useState<
    Record<string, boolean>
  >(() => {
    if (defaultExpandLatestAudio && history.latestVersion) {
      return { [history.latestVersion.file.id]: true };
    }
    return {};
  });

  const [showAllOlderVersions, setShowAllOlderVersions] = useState<boolean>(false);

  if (!history.hasAudioVersions) {
    return null;
  }

  const toggleAudioPlayer = (fileId: string) => {
    setExpandedAudioById((prev) => ({
      ...prev,
      [fileId]: !prev[fileId],
    }));
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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[#111111]/68 dark:text-[#F4F3EF]/68">
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
          <span className="text-[#111111]/52 dark:text-[#F4F3EF]/52">
            Доп. документы: {supplementaryCount}
          </span>
        )}
      </div>

      {/* Одноуровневый список всех версий с тонкими разделителями */}
      <ul className="divide-y divide-[#111111]/8 dark:divide-white/8 border-t border-b border-[#111111]/8 dark:border-white/8">
        {visibleVersions.map((ver) => {
          const { file } = ver;
          const { downloadHref, previewHref } = buildDeliverableDownloadUrls(
            orderNumber,
            rescueToken,
            file.id
          );
          const isPlayerOpen = Boolean(expandedAudioById[file.id]);

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
              className="py-3.5 space-y-2.5"
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
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#FF4820]">
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
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#111111]/68 dark:text-[#F4F3EF]/68">
                        <History
                          className="w-3.5 h-3.5 shrink-0 text-[#111111]/45 dark:text-[#F4F3EF]/45"
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
                      className="text-[#111111]/38 dark:text-[#F4F3EF]/38"
                    >
                      ·
                    </span>
                    <span className="text-[#111111]/56 dark:text-[#F4F3EF]/56">
                      {formatVersionDateTime(file.uploadedAt)}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-[#111111]/38 dark:text-[#F4F3EF]/38"
                    >
                      ·
                    </span>
                    <span className="text-[#111111]/56 dark:text-[#F4F3EF]/56">
                      {formatFileSizeReadable(file.sizeBytes)}
                    </span>
                  </div>

                  {/* Заголовок версии и комментарий продюсера */}
                  <p className="text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] break-words">
                    {file.title}
                  </p>

                  {ver.versionNote && (
                    <p className="text-xs text-[#111111]/70 dark:text-[#F4F3EF]/70 leading-relaxed">
                      {ver.versionNote}
                    </p>
                  )}

                  <p className="font-mono text-[11px] text-[#111111]/48 dark:text-[#F4F3EF]/48 break-all sm:break-normal">
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
                    className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
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
                      ver.isCurrentLatest
                        ? 'min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0'
                        : 'min-h-[36px] px-3 py-1.5 rounded-lg border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0'
                    }
                  >
                    <Download
                      className="w-3.5 h-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {ver.isFinalMaster
                        ? 'Скачать мастер'
                        : `Скачать ${ver.versionCode}`}
                    </span>
                  </a>
                </div>
              </div>

              {isPlayerOpen && (
                <audio
                  controls
                  preload="none"
                  src={previewHref}
                  data-testid={audioTestId}
                  className="w-full h-9"
                  aria-label={`Аудиоплеер версии ${ver.versionCode}: ${file.title}`}
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
          className="text-xs font-semibold text-[#FF4820] hover:underline cursor-pointer whitespace-nowrap shrink-0"
        >
          Показать ещё ранние версии ({hiddenCount})
        </button>
      )}
    </div>
  );
}
