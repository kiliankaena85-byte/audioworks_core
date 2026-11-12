import { Pause, Play, Plus, Trash2, Upload } from 'lucide-react';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { duelAudioStore, DuelTrackKind } from '../../audio/duelAudioStore';
import { UploadedAudioResult } from '../../cms/studioCmsStore';
import {
  AUDIOWORKS_WAV_URL,
  DuelTranscriptPhrase,
  formatAudioTime,
} from '../../data/audioworksCommercial';
import { DuelCmsConfig, DuelCmsSpotSpec } from '../../data/studioCmsTypes';

interface AdminDuelPanelProps {
  duel: DuelCmsConfig;
  onChangeDuel: (nextDuel: DuelCmsConfig) => void;
  onUploadAudio: (
    file: File
  ) => Promise<{ ok: true; result: UploadedAudioResult } | { ok: false; error: string }>;
}

export function AdminDuelPanel({
  duel,
  onChangeDuel,
  onUploadAudio,
}: AdminDuelPanelProps) {
  const [activeSide, setActiveSide] = useState<DuelTrackKind>('audioworks');
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(
    null
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [playElapsedSec, setPlayElapsedSec] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);
  const auditionTimerRef = useRef<number | null>(null);

  const activeSpot: DuelCmsSpotSpec =
    activeSide === 'radio' ? duel.radioSpot : duel.audioworksSpot;

  const stopAudition = () => {
    if (auditionTimerRef.current !== null) {
      window.clearInterval(auditionTimerRef.current);
      auditionTimerRef.current = null;
    }
    if (auditionAudioRef.current) {
      auditionAudioRef.current.pause();
      auditionAudioRef.current = null;
    }
    setIsPlaying(false);
    setPlayElapsedSec(0);
  };

  useEffect(() => {
    stopAudition();
    setNotice(null);
  }, [activeSide]);

  useEffect(() => {
    return () => {
      stopAudition();
    };
  }, []);

  const updateSpot = (side: DuelTrackKind, patch: Partial<DuelCmsSpotSpec>) => {
    const current = side === 'radio' ? duel.radioSpot : duel.audioworksSpot;
    const nextDuration =
      typeof patch.durationSec === 'number' && Number.isFinite(patch.durationSec)
        ? Math.max(1, Math.min(180, Math.round(patch.durationSec)))
        : current.durationSec;
    const mins = Math.floor(nextDuration / 60);
    const secs = nextDuration % 60;
    const updated: DuelCmsSpotSpec = {
      ...current,
      ...patch,
      durationSec: nextDuration,
      durationLabel: `${mins}:${String(secs).padStart(2, '0')}`,
    };

    if (side === 'radio') {
      onChangeDuel({ ...duel, radioSpot: updated });
    } else {
      onChangeDuel({ ...duel, audioworksSpot: updated });
    }
  };

  const handleUploadSideAudio = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    stopAudition();
    setIsUploading(true);
    setNotice(null);

    const res = await onUploadAudio(file);
    setIsUploading(false);

    if (!res.ok) {
      setNotice({ kind: 'error', text: res.error });
      return;
    }

    // Очищаем локальный браузерный кэш дуэли, чтобы на сайте звучал именно опубликованный трек из CMS
    void duelAudioStore.clearTrack(activeSide);

    const roundedDuration = Math.max(1, Math.round(res.result.durationSec));
    updateSpot(activeSide, {
      audioUrl: res.result.url,
      audioFileName: res.result.fileName,
      durationSec: roundedDuration,
    });

    setNotice({
      kind: 'ok',
      text: `Дорожка «${res.result.fileName}» (${res.result.durationSec} сек) прикреплена к стороне. Нажмите «Сохранить и опубликовать», чтобы обновить дуэль на сайте.`,
    });
  };

  const updatePhraseAt = (
    index: number,
    patch: Partial<DuelTranscriptPhrase>
  ) => {
    const nextPhrases = activeSpot.phrases.map((phrase, idx) =>
      idx === index ? { ...phrase, ...patch } : phrase
    );
    updateSpot(activeSide, { phrases: nextPhrases });
  };

  const handleAddPhrase = () => {
    const last = activeSpot.phrases[activeSpot.phrases.length - 1];
    const startSec = last ? Math.round(last.endSec * 10) / 10 : 0;
    const endSec = Math.round((startSec + 3.0) * 10) / 10;
    const nextPhrases: DuelTranscriptPhrase[] = [
      ...activeSpot.phrases,
      {
        startSec,
        endSec,
        text: 'Новая реплика диктора или звуковой акцент',
        isAccent: activeSide === 'audioworks',
      },
    ];
    updateSpot(activeSide, { phrases: nextPhrases });
  };

  const handleDeletePhrase = (index: number) => {
    if (activeSpot.phrases.length <= 1) return;
    const nextPhrases = activeSpot.phrases.filter((_, idx) => idx !== index);
    updateSpot(activeSide, { phrases: nextPhrases });
  };

  const toggleAuditionSide = () => {
    if (isPlaying) {
      stopAudition();
      return;
    }

    stopAudition();
    const customUrl = activeSpot.audioUrl?.trim();
    const fallbackStartSec = activeSide === 'radio' ? 1.4 : 7.2;
    const sourceUrl = customUrl || AUDIOWORKS_WAV_URL;
    const startOffsetSec = customUrl ? 0 : fallbackStartSec;
    const maxSpanSec = Math.max(1, activeSpot.durationSec);

    const audio = new Audio(sourceUrl);
    audio.preload = 'auto';
    audio.volume = 0.95;
    auditionAudioRef.current = audio;
    setIsPlaying(true);
    setPlayElapsedSec(0);

    const launch = () => {
      if (auditionAudioRef.current !== audio) return;
      try {
        audio.currentTime = startOffsetSec;
      } catch {
        // Ignore seek before metadata ready
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
      const relSec = Math.max(0, current.currentTime - startOffsetSec);
      if (relSec >= maxSpanSec) {
        stopAudition();
        return;
      }
      setPlayElapsedSec(relSec);
    }, 60);
  };

  return (
    <div className="space-y-6">
      {/* Shared Brief & Section Header Card */}
      <section className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-6 sm:p-8 space-y-5">
        <div>
          <h2 className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
            Общий бриф и заголовок секции «Дуэль 15 секунд»
          </h2>
          <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
            Настройте вводную задачу клиента, на которой посетитель сравнивает типовой ролик и режиссуру AudioWorks.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="duel-eyebrow-input"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Надзаголовок секции
            </label>
            <input
              id="duel-eyebrow-input"
              type="text"
              value={duel.sectionEyebrow}
              onChange={(e) =>
                onChangeDuel({ ...duel, sectionEyebrow: e.target.value })
              }
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="duel-client-input"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Клиент в разборе
            </label>
            <input
              id="duel-client-input"
              type="text"
              value={duel.clientName}
              onChange={(e) =>
                onChangeDuel({ ...duel, clientName: e.target.value })
              }
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="duel-heading-primary"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Первая строка заголовка
            </label>
            <input
              id="duel-heading-primary"
              type="text"
              value={duel.headingPrimary}
              onChange={(e) =>
                onChangeDuel({ ...duel, headingPrimary: e.target.value })
              }
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="duel-heading-muted"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Вторая строка заголовка (акцент полутоном)
            </label>
            <input
              id="duel-heading-muted"
              type="text"
              value={duel.headingMuted}
              onChange={(e) =>
                onChangeDuel({ ...duel, headingMuted: e.target.value })
              }
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="duel-brief-summary"
            className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
          >
            Краткое условие брифа
          </label>
          <textarea
            id="duel-brief-summary"
            rows={2}
            value={duel.briefSummary}
            onChange={(e) =>
              onChangeDuel({ ...duel, briefSummary: e.target.value })
            }
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm leading-relaxed text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
          />
        </div>
      </section>

      {/* Side A / Side B Audio & Synchronized Transcript Editor */}
      <section className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#111111]/10 dark:border-white/10">
          {/* Interactive Side Switcher */}
          <div
            role="tablist"
            aria-label="Выбор стороны дуэли"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeSide === 'radio'}
              onClick={() => setActiveSide('radio')}
              className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeSide === 'radio'
                  ? 'bg-white dark:bg-[#1E1E24] text-[#111111] dark:text-[#F4F3EF] shadow-xs'
                  : 'text-[#111111]/60 dark:text-[#F4F3EF]/60 hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              Сторона А · Потоковый ролик
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSide === 'audioworks'}
              onClick={() => setActiveSide('audioworks')}
              className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeSide === 'audioworks'
                  ? 'bg-[#FF4820] text-white shadow-xs'
                  : 'text-[#111111]/60 dark:text-[#F4F3EF]/60 hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              Сторона Б · Режиссура AudioWorks
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={toggleAuditionSide}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isPlaying
                  ? 'bg-[#111111] text-white dark:bg-white dark:text-[#111111]'
                  : 'bg-[#F7F6F2] dark:bg-[#1E1E24] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
              }`}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
              )}
              <span className="tabular-nums">
                {isPlaying
                  ? `Играет · ${playElapsedSec.toFixed(1)} / ${activeSpot.durationSec.toFixed(1)} с`
                  : `Прослушать сторону (${formatAudioTime(activeSpot.durationSec)})`}
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.mp3,audio/wav,audio/mpeg,audio/*"
              onChange={handleUploadSideAudio}
              className="hidden"
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                {isUploading ? 'Загрузка…' : 'Загрузить WAV / MP3 стороны'}
              </span>
            </button>
          </div>
        </div>

        {notice && (
          <div
            role="status"
            className={`px-4 py-3 rounded-xl text-xs font-medium border ${
              notice.kind === 'ok'
                ? 'bg-[#16A34A]/10 border-[#16A34A]/30 text-[#15803D] dark:text-[#4ADE80]'
                : 'bg-[#DC2626]/10 border-[#DC2626]/30 text-[#DC2626] dark:text-[#F87171]'
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* Spot Metadata Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          <div className="sm:col-span-4 space-y-1.5">
            <label
              htmlFor="duel-spot-badge"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Подпись формата карточки
            </label>
            <input
              id="duel-spot-badge"
              type="text"
              value={activeSpot.badge}
              onChange={(e) => updateSpot(activeSide, { badge: e.target.value })}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>

          <div className="sm:col-span-5 space-y-1.5">
            <label
              htmlFor="duel-spot-title"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Заголовок варианта
            </label>
            <input
              id="duel-spot-title"
              type="text"
              value={activeSpot.title}
              onChange={(e) => updateSpot(activeSide, { title: e.target.value })}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>

          <div className="sm:col-span-3 space-y-1.5">
            <label
              htmlFor="duel-spot-duration"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Хронометраж (сек)
            </label>
            <input
              id="duel-spot-duration"
              type="number"
              min={1}
              max={180}
              step={1}
              value={activeSpot.durationSec}
              onChange={(e) =>
                updateSpot(activeSide, {
                  durationSec: Math.max(1, Number(e.target.value) || 15),
                })
              }
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>

          <div className="sm:col-span-6 space-y-1.5">
            <label
              htmlFor="duel-spot-audio-url"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              URL аудиофайла стороны (пусто = эталонный демо-фрагмент)
            </label>
            <input
              id="duel-spot-audio-url"
              type="text"
              value={activeSpot.audioUrl ?? ''}
              onChange={(e) =>
                updateSpot(activeSide, {
                  audioUrl: e.target.value.trim() || undefined,
                })
              }
              placeholder="/assets/cms/duel-spot.wav"
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-mono text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>

          <div className="sm:col-span-6 space-y-1.5">
            <label
              htmlFor="duel-spot-metrics"
              className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
            >
              Строка параметров речи (темп, слова, паузы)
            </label>
            <input
              id="duel-spot-metrics"
              type="text"
              value={activeSpot.metricsLine}
              onChange={(e) =>
                updateSpot(activeSide, { metricsLine: e.target.value })
              }
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm tabular-nums text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="duel-spot-verdict"
            className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
          >
            Итоговый вывод под карточкой
          </label>
          <textarea
            id="duel-spot-verdict"
            rows={2}
            value={activeSpot.verdict}
            onChange={(e) => updateSpot(activeSide, { verdict: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm leading-relaxed text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
          />
        </div>

        {/* High-Density Synchronized Phrases Table */}
        <div className="pt-4 border-t border-[#111111]/10 dark:border-white/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                Синхронная партитура фраз по таймкодам
              </h3>
              <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                Реплики подсвечиваются по ходу звучания ролика как в секции на сайте, так и при проверке выше.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddPhrase}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Добавить фразу</span>
            </button>
          </div>

          <div className="overflow-x-auto subtle-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#111111]/10 dark:border-white/10 text-xs font-semibold text-[#111111]/55 dark:text-[#F4F3EF]/55">
                  <th className="py-2.5 pr-3 w-24">Старт (с)</th>
                  <th className="py-2.5 pr-3 w-24">Финал (с)</th>
                  <th className="py-2.5 pr-3">Текст реплики / акустической паузы</th>
                  <th className="py-2.5 pr-3 w-28 text-center">Акцент</th>
                  <th className="py-2.5 w-12 text-right">Удалить</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#111111]/8 dark:divide-white/8">
                {activeSpot.phrases.map((phrase, idx) => {
                  const isHighlightedNow =
                    isPlaying &&
                    playElapsedSec >= phrase.startSec &&
                    playElapsedSec <= phrase.endSec;

                  return (
                    <tr
                      key={`${activeSide}-phrase-${idx}`}
                      className={`transition-colors ${
                        isHighlightedNow
                          ? 'bg-[#FF4820]/10 dark:bg-[#FF4820]/15'
                          : 'hover:bg-[#F7F6F2]/60 dark:hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="py-2 pr-3 align-middle">
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          aria-label={`Старт фразы ${idx + 1} в секундах`}
                          value={phrase.startSec}
                          onChange={(e) =>
                            updatePhraseAt(idx, {
                              startSec: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-20 min-h-[36px] px-2.5 py-1 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-mono tabular-nums text-right text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                        />
                      </td>
                      <td className="py-2 pr-3 align-middle">
                        <input
                          type="number"
                          min={0.2}
                          step={0.1}
                          aria-label={`Финал фразы ${idx + 1} в секундах`}
                          value={phrase.endSec}
                          onChange={(e) =>
                            updatePhraseAt(idx, {
                              endSec: Math.max(
                                phrase.startSec + 0.2,
                                Number(e.target.value) || phrase.startSec + 1
                              ),
                            })
                          }
                          className="w-20 min-h-[36px] px-2.5 py-1 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-mono tabular-nums text-right text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                        />
                      </td>
                      <td className="py-2 pr-3 align-middle">
                        <input
                          type="text"
                          aria-label={`Текст фразы ${idx + 1}`}
                          value={phrase.text}
                          onChange={(e) =>
                            updatePhraseAt(idx, { text: e.target.value })
                          }
                          className="w-full min-h-[36px] px-3 py-1 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                        />
                      </td>
                      <td className="py-2 pr-3 align-middle text-center">
                        <input
                          type="checkbox"
                          aria-label={`Смысловой акцент фразы ${idx + 1}`}
                          checked={Boolean(phrase.isAccent)}
                          onChange={(e) =>
                            updatePhraseAt(idx, { isAccent: e.target.checked })
                          }
                          className="accent-[#FF4820] w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 align-middle text-right">
                        <button
                          type="button"
                          disabled={activeSpot.phrases.length <= 1}
                          onClick={() => handleDeletePhrase(idx)}
                          aria-label={`Удалить фразу ${idx + 1}`}
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#111111]/55 dark:text-[#F4F3EF]/55 hover:text-[#DC2626] dark:hover:text-[#F87171] disabled:opacity-30 cursor-pointer disabled:cursor-default"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
