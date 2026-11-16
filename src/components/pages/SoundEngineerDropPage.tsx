import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileAudio,
  Moon,
  Sun,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStudioLegalConfig } from '../../context/StudioLegalConfigContext';
import { formatFileSizeReadable } from '../../data/clientCabinetHelpers';
import {
  evaluateBroadcastSlotFit,
  parseWavExactDurationSec,
  type SoundDropTaskPublicView,
} from '../../data/productionApprovalWorkflow';

export interface SoundEngineerDropPageProps {
  dropToken?: string;
  isDark: boolean;
  onToggleTheme: () => void;
}

interface UploadedTakeReceipt {
  id: string;
  fileName: string;
  sizeBytes: number;
  measuredDurationSec: number | null;
  targetSlotSec: number;
  uploadedAt: string;
}

function formatDateTimeShortRu(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function probeBrowserAudioElementDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;
    const finish = (sec: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(sec);
    };
    const timer = window.setTimeout(() => finish(null), 3500);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const dur = audio.duration;
      finish(
        Number.isFinite(dur) && dur > 0
          ? Math.round(dur * 100) / 100
          : null
      );
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
    audio.src = url;
  });
}

export function SoundEngineerDropPage({
  dropToken,
  isDark,
  onToggleTheme,
}: SoundEngineerDropPageProps) {
  const { inlineRequisites } = useStudioLegalConfig();
  const [task, setTask] = useState<SoundDropTaskPublicView | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [measuredDurationSec, setMeasuredDurationSec] = useState<number | null>(
    null
  );
  const [engineerNote, setEngineerNote] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<UploadedTakeReceipt | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadSession = useCallback(async () => {
    const cleanToken = (dropToken ?? '').trim();
    if (!cleanToken) {
      setSessionError(
        'В адресной строке отсутствует ключ прямой сдачи файла. Откройте актуальную ссылку из письма или сообщения от продюсера FMWorks.'
      );
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setSessionError(null);
    try {
      const res = await fetch(
        `/api/sound-drop/session?token=${encodeURIComponent(cleanToken)}`,
        {
          credentials: 'same-origin',
        }
      );
      const json = (await res.json()) as {
        ok?: boolean;
        task?: SoundDropTaskPublicView;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.task) {
        throw new Error(
          json.error ??
            'Ссылка прямой сдачи недействительна, отозвана или просрочена.'
        );
      }
      setTask(json.task);
    } catch (err) {
      setSessionError(
        err instanceof Error
          ? err.message
          : 'Не удалось проверить ссылку прямой сдачи файла'
      );
    } finally {
      setIsLoading(false);
    }
  }, [dropToken]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const handleInspectSelectedFile = useCallback(async (file: File | null) => {
    setUploadError(null);
    setReceipt(null);
    if (!file) {
      setSelectedFile(null);
      setMeasuredDurationSec(null);
      return;
    }

    if (file.size > 60 * 1024 * 1024) {
      setUploadError('Размер файла превышает допустимые 60 МБ.');
      return;
    }

    const lowerName = file.name.toLowerCase();
    if (
      !lowerName.endsWith('.wav') &&
      !lowerName.endsWith('.mp3') &&
      !lowerName.endsWith('.ogg') &&
      !lowerName.endsWith('.m4a')
    ) {
      setUploadError(
        'Поддерживаются форматы WAV (рекомендуется 44.1 / 48 кГц), MP3, OGG и M4A.'
      );
      return;
    }

    setSelectedFile(file);
    try {
      const buf = await file.arrayBuffer();
      const wavSec = parseWavExactDurationSec(new Uint8Array(buf));
      if (wavSec !== null) {
        setMeasuredDurationSec(wavSec);
        return;
      }
      const mediaSec = await probeBrowserAudioElementDuration(file);
      setMeasuredDurationSec(mediaSec);
    } catch {
      setMeasuredDurationSec(null);
    }
  }, []);

  const handleUploadSubmit = useCallback(async () => {
    const cleanToken = (dropToken ?? '').trim();
    if (!cleanToken || !selectedFile || isUploading) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const bytes = await selectedFile.arrayBuffer();
      const headers: Record<string, string> = {
        'Content-Type': selectedFile.type || 'application/octet-stream',
        'x-drop-token': cleanToken,
        'x-file-name': encodeURIComponent(selectedFile.name),
      };
      if (engineerNote.trim()) {
        headers['x-engineer-note'] = encodeURIComponent(
          engineerNote.trim().slice(0, 400)
        );
      }
      if (typeof measuredDurationSec === 'number' && measuredDurationSec > 0) {
        headers['x-measured-duration'] = String(measuredDurationSec);
      }

      const res = await fetch('/api/sound-drop/upload', {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: bytes,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        take?: UploadedTakeReceipt;
        task?: SoundDropTaskPublicView;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.take) {
        throw new Error(
          json.error ?? 'Не удалось передать аудиофайл в буфер ОТК продюсера'
        );
      }
      setReceipt(json.take);
      if (json.task) {
        setTask(json.task);
      }
      setSelectedFile(null);
      setEngineerNote('');
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Ошибка отправки готового файла'
      );
    } finally {
      setIsUploading(false);
    }
  }, [dropToken, engineerNote, isUploading, measuredDurationSec, selectedFile]);

  const slotFitPreview = useMemo(() => {
    if (!task || !selectedFile) return null;
    return evaluateBroadcastSlotFit(measuredDurationSec, task.targetSlotSec);
  }, [measuredDurationSec, selectedFile, task]);

  const receiptSlotFit = useMemo(() => {
    if (!receipt) return null;
    return evaluateBroadcastSlotFit(
      receipt.measuredDurationSec,
      receipt.targetSlotSec
    );
  }, [receipt]);

  return (
    <div className="min-h-screen bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111] dark:text-[#F4F3EF] flex flex-col tabular-nums">
      {/* Лаконичная шапка 3-зон без лишней навигации и без входа в админ-панель */}
      <header className="border-b border-[#111111]/10 dark:border-white/10 bg-white dark:bg-[#141418]">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between gap-8">
          <span className="text-base font-bold tracking-tight whitespace-nowrap shrink-0">
            FMWorks
          </span>

          <span className="hidden sm:inline text-xs font-medium text-[#111111]/60 dark:text-[#F4F3EF]/60 whitespace-nowrap shrink-0">
            Прямая сдача мастера продюсеру (без входа в CRM)
          </span>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              isDark ? 'Переключить светлую тему' : 'Переключить тёмную тему'
            }
            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#111111]/12 dark:border-white/12 text-xs font-medium inline-flex items-center gap-1.5 hover:border-[#FF4820] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Moon className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{isDark ? 'Светлая' : 'Тёмная'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-5 sm:px-6 py-8 sm:py-12">
        {isLoading ? (
          <div
            role="status"
            className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-6 sm:p-8 space-y-3"
          >
            <div className="h-5 w-48 rounded bg-[#111111]/8 dark:bg-white/8" />
            <div className="h-24 w-full rounded-xl bg-[#111111]/5 dark:bg-white/5" />
          </div>
        ) : sessionError || !task ? (
          <section
            data-testid="sound-drop-error-state"
            className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-6 sm:p-8 space-y-3"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="w-5 h-5 text-[#DC2626] dark:text-[#F87171] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="space-y-1.5">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                  Ссылка прямой сдачи недоступна
                </h1>
                <p className="text-xs sm:text-sm text-[#111111]/70 dark:text-[#F4F3EF]/70 leading-relaxed">
                  {sessionError ??
                    'Проверьте полноту ссылки из письма или запросите обновлённый техлист у продюсера студии.'}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section
            data-testid="sound-drop-workspace"
            className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-6 sm:p-8 space-y-6"
          >
            {/* Заголовок задания без цен, ИНН и контактов клиента */}
            <div className="space-y-2 pb-5 border-b border-[#111111]/10 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#111111]/62 dark:text-[#F4F3EF]/62">
                <span className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                  Заказ #{task.orderNumber}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-[#FF4820]">
                  Строгий слот {task.targetSlotSec},00 с (±0,05 с)
                </span>
                <span aria-hidden="true">·</span>
                <span>Норма громкости −14 LUFS</span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-balance">
                Сдача готового аудиоролика продюсеру на проверку
              </h1>

              <p className="text-xs sm:text-sm text-[#111111]/68 dark:text-[#F4F3EF]/68">
                Звукорежиссёр: <strong>{task.engineerName}</strong>
                {task.pendingTakesCount > 0 && task.lastUploadedAt ? (
                  <>
                    {' '}
                    · В буфере ОТК уже дублей: {task.pendingTakesCount} (крайняя
                    загрузка {formatDateTimeShortRu(task.lastUploadedAt)})
                  </>
                ) : null}
              </p>
            </div>

            {/* Активные правки по таймкоду или замене подложки, если есть */}
            {task.activeRevisions.length > 0 && (
              <div
                data-testid="sound-drop-revisions"
                className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] space-y-2.5"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-[#FF4820]">
                  <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Активное задание на доводку от продюсера</span>
                </div>
                <ul className="space-y-2 text-xs sm:text-sm">
                  {task.activeRevisions.map((rev) => (
                    <li
                      key={rev.id}
                      className="pt-2 first:pt-0 border-t first:border-t-0 border-[#111111]/8 dark:border-white/8 space-y-1"
                    >
                      <p className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                        {rev.kindLabel}
                        {typeof rev.timecodeSec === 'number'
                          ? ` · таймкод ${rev.timecodeSec.toFixed(1)} с`
                          : ''}
                      </p>
                      <p className="text-[#111111]/78 dark:text-[#F4F3EF]/78">
                        «{rev.comment}»
                      </p>
                      {rev.producerNote && (
                        <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
                          Примечание продюсера: {rev.producerNote}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Справка по утверждённому тексту сценария и ударениям */}
            {task.lockedScript && (
              <details
                open={task.activeRevisions.length === 0}
                className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] text-xs sm:text-sm"
              >
                <summary className="font-semibold text-[#111111] dark:text-[#F4F3EF] cursor-pointer select-none">
                  Утверждённый режиссёрский сценарий (v
                  {task.lockedScript.versionNumber} · {task.targetSlotSec},00 с)
                </summary>
                <div className="mt-3 pt-3 border-t border-[#111111]/8 dark:border-white/8 space-y-2 leading-relaxed">
                  <p className="font-medium text-[#111111] dark:text-[#F4F3EF]">
                    {task.lockedScript.bodyText}
                  </p>
                  {task.lockedScript.stressNotes && (
                    <p className="text-xs text-[#111111]/70 dark:text-[#F4F3EF]/70">
                      <strong>Ударения:</strong> {task.lockedScript.stressNotes}
                    </p>
                  )}
                  {task.lockedScript.fz38Disclaimer && (
                    <p className="text-xs text-[#111111]/70 dark:text-[#F4F3EF]/70">
                      <strong>Дисклеймер ФЗ-38 (внутри слота):</strong>{' '}
                      {task.lockedScript.fz38Disclaimer}
                    </p>
                  )}
                  <p className="text-xs text-[#111111]/64 dark:text-[#F4F3EF]/64">
                    <strong>Режиссёрская задача:</strong>{' '}
                    {task.lockedScript.directorApproach}
                  </p>
                </div>
              </details>
            )}

            {/* Подтверждение успешной отправки дубля */}
            {receipt && receiptSlotFit && (
              <div
                role="status"
                data-testid="sound-drop-success-banner"
                className="p-4 rounded-xl bg-[#16A34A]/10 border border-[#16A34A]/30 space-y-1.5"
              >
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#15803D] dark:text-[#4ADE80]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    Файл «{receipt.fileName}» доставлен продюсеру в буфер ОТК
                  </span>
                </div>
                <p className="text-xs text-[#111111]/76 dark:text-[#F4F3EF]/76">
                  Размер: {formatFileSizeReadable(receipt.sizeBytes)} ·{' '}
                  {receiptSlotFit.badgeText}. Продюсер прослушает дубль и в 1 клик
                  откроет его клиенту.
                </p>
              </div>
            )}

            {/* Зона выбора файла и однокнопочной отправки */}
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".wav,.mp3,.ogg,.m4a,audio/*"
                data-testid="sound-drop-file-input"
                aria-label="Выбрать готовый аудиофайл WAV или MP3"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  void handleInspectSelectedFile(f);
                  e.target.value = '';
                }}
                className="sr-only"
              />

              <button
                type="button"
                data-testid="sound-drop-pick-file-btn"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const dropped = e.dataTransfer.files?.[0] ?? null;
                  void handleInspectSelectedFile(dropped);
                }}
                className={`w-full min-h-[124px] p-5 rounded-xl border border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center text-center gap-2 ${
                  isDragging
                    ? 'border-[#FF4820] bg-[#FF4820]/8'
                    : selectedFile
                      ? 'border-[#16A34A]/50 bg-[#F7F6F2] dark:bg-[#0D0D0F]'
                      : 'border-[#111111]/22 dark:border-white/22 hover:border-[#FF4820] bg-[#F7F6F2] dark:bg-[#0D0D0F]'
                }`}
              >
                <FileAudio
                  className="w-6 h-6 text-[#FF4820]"
                  aria-hidden="true"
                />
                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                      {selectedFile.name} (
                      {formatFileSizeReadable(selectedFile.size)})
                    </p>
                    {slotFitPreview && (
                      <p
                        data-testid="sound-drop-slot-fit"
                        className={`text-xs font-semibold ${
                          slotFitPreview.status === 'exact'
                            ? 'text-[#15803D] dark:text-[#4ADE80]'
                            : slotFitPreview.status === 'tolerance_warning'
                              ? 'text-[#D97706] dark:text-[#FBBF24]'
                              : slotFitPreview.status === 'out_of_slot'
                                ? 'text-[#DC2626] dark:text-[#F87171]'
                                : 'text-[#111111]/64 dark:text-[#F4F3EF]/64'
                        }`}
                      >
                        {slotFitPreview.badgeText}
                      </p>
                    )}
                    <p className="text-[11px] text-[#111111]/54 dark:text-[#F4F3EF]/54">
                      Нажмите или перетащите другой файл, чтобы заменить
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
                      Перетащите готовый WAV / MP3 сюда или нажмите для выбора
                    </p>
                    <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                      До 60 МБ · автоматическая проверка точного хронометража{' '}
                      {task.targetSlotSec},00 с до отправки
                    </p>
                  </div>
                )}
              </button>

              <div>
                <label
                  htmlFor="sound-drop-note"
                  className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75 mb-1.5"
                >
                  Короткая пометка для продюсера (необязательно)
                </label>
                <input
                  id="sound-drop-note"
                  type="text"
                  data-testid="sound-drop-note-input"
                  value={engineerNote}
                  onChange={(e) => setEngineerNote(e.target.value)}
                  placeholder="Например: основной дубль −14 LUFS, хвост 0.15 с чистый…"
                  className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs sm:text-sm"
                />
              </div>

              {uploadError && (
                <p
                  role="alert"
                  className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]"
                >
                  {uploadError}
                </p>
              )}

              <button
                type="button"
                disabled={!selectedFile || isUploading}
                data-testid="sound-drop-submit-btn"
                onClick={() => void handleUploadSubmit()}
                className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-45"
              >
                <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {isUploading
                    ? 'Передача мастер-файла продюсеру…'
                    : 'Отправить готовый файл продюсеру на проверку'}
                </span>
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-[#111111]/10 dark:border-white/10 py-4 px-5 sm:px-6 text-xs text-[#111111]/64 dark:text-[#F4F3EF]/64">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 tabular-nums">
          <span>{inlineRequisites}</span>
          <a
            href="/privacy"
            className="font-semibold underline underline-offset-3 text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:text-[#C83210] dark:hover:text-[#FF6B47] whitespace-nowrap shrink-0"
          >
            Политика обработки ПДн (152-ФЗ)
          </a>
        </div>
      </footer>
    </div>
  );
}
