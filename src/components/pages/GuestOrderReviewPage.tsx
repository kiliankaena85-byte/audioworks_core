import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileAudio,
  FileText,
  Lock,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildDirectorFeedbackClipboardText,
  formatQuickTimecodeLabel,
  type GuestOrderReviewPayload,
} from '../../data/clientCabinetArchitecture';
import { formatFileSizeReadable } from '../../data/clientCabinetHelpers';
import type { PlatformRoute } from '../../data/platformRouter';
import { fetchGuestOrderReviewApi } from '../cabinet/clientCabinetApi';

export interface GuestOrderReviewPageProps {
  reviewToken?: string;
  onNavigate: (route: PlatformRoute, options?: { replace?: boolean }) => void;
}

function formatRuDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function GuestOrderReviewPage({
  reviewToken,
  onNavigate,
}: GuestOrderReviewPageProps) {
  const [review, setReview] = useState<GuestOrderReviewPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);

  const [verdict, setVerdict] = useState<'approved' | 'needs_edits'>('approved');
  const [comment, setComment] = useState('');
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingResumeTimeRef = useRef<number | null>(null);
  const shouldAutoplayAfterSwitchRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!reviewToken) {
      setReview(null);
      setError('В ссылке отсутствует код доступа к проекту.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    fetchGuestOrderReviewApi(reviewToken)
      .then((data) => {
        if (cancelled) return;
        setReview(data);
        const latestAudio =
          data.audioVersions.find((v) => v.isCurrentLatest) ??
          data.audioVersions[data.audioVersions.length - 1] ??
          null;
        setSelectedAudioId(latestAudio?.id ?? null);

        const latestDraft =
          data.approvalWorkflow?.scriptVersions &&
          data.approvalWorkflow.scriptVersions.length > 0
            ? data.approvalWorkflow.scriptVersions[
                data.approvalWorkflow.scriptVersions.length - 1
              ]
            : null;
        const concepts = latestDraft?.concepts ?? [];
        const preferredConcept =
          concepts.find((c) => c.id === latestDraft?.approvedConceptId) ??
          concepts[0] ??
          null;
        setSelectedConceptId(preferredConcept?.id ?? null);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setReview(null);
        setError(
          err instanceof Error
            ? err.message
            : 'Не удалось загрузить проект по гостевой ссылке'
        );
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reviewToken]);

  const activeAudio = useMemo(() => {
    if (!review || review.audioVersions.length === 0) return null;
    return (
      review.audioVersions.find((v) => v.id === selectedAudioId) ??
      review.audioVersions[review.audioVersions.length - 1] ??
      null
    );
  }, [review, selectedAudioId]);

  const lockedScript = review?.approvalWorkflow?.lockedScript ?? null;
  const latestScriptDraft = useMemo(() => {
    const versions = review?.approvalWorkflow?.scriptVersions;
    if (!versions || versions.length === 0) return null;
    return versions[versions.length - 1] ?? null;
  }, [review]);

  const scriptConcepts = useMemo(
    () => (lockedScript ? [] : latestScriptDraft?.concepts ?? []),
    [lockedScript, latestScriptDraft]
  );

  const activeConcept = useMemo(() => {
    if (scriptConcepts.length === 0) return null;
    return (
      scriptConcepts.find((c) => c.id === selectedConceptId) ?? scriptConcepts[0]
    );
  }, [scriptConcepts, selectedConceptId]);

  const effectiveScriptText =
    lockedScript?.bodyText ?? activeConcept?.bodyText ?? '';
  const effectiveDirectorApproach =
    lockedScript?.directorApproach ?? activeConcept?.directorApproach ?? '';
  const effectiveStressNotes =
    lockedScript?.stressNotes ?? activeConcept?.stressNotes ?? '';
  const effectiveFz38Disclaimer =
    lockedScript?.fz38Disclaimer ?? activeConcept?.fz38Disclaimer ?? '';
  const effectiveScriptSubtitle = lockedScript
    ? `Утверждённый сценарий · ${lockedScript.conceptTitle}`
    : activeConcept
      ? `${activeConcept.label} · ${activeConcept.title}`
      : '';

  const handleSwitchAudioVersion = (nextId: string) => {
    if (!activeAudio || nextId === activeAudio.id) return;
    const el = audioRef.current;
    if (el) {
      pendingResumeTimeRef.current = el.currentTime || 0;
      shouldAutoplayAfterSwitchRef.current = !el.paused;
      el.pause();
    }
    setSelectedAudioId(nextId);
  };

  const handleTogglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (!el.paused) {
      el.pause();
      return;
    }
    try {
      await el.play();
    } catch {
      setIsPlaying(false);
    }
  };

  const handleStepTime = (deltaSec: number) => {
    const el = audioRef.current;
    if (!el) return;
    const maxSec = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 60;
    const next = Math.max(0, Math.min(maxSec, el.currentTime + deltaSec));
    el.currentTime = next;
    setCurrentTimeSec(next);
  };

  const handleCopyDirectorFeedback = async () => {
    if (!review) return;
    const text = buildDirectorFeedbackClipboardText({
      orderNumber: review.orderNumber,
      formatTitle: review.formatTitle,
      verdict,
      comment,
    });
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedFeedback(true);
      window.setTimeout(() => setCopiedFeedback(false), 2600);
    } catch {
      setCopiedFeedback(true);
      window.setTimeout(() => setCopiedFeedback(false), 2600);
    }
  };

  const progressSteps = useMemo(() => {
    const step = review?.approvalWorkflow?.externalStep;
    const phase = review?.approvalWorkflow?.phase;
    const s1Done = step === '02_production' || step === '03_spot' || phase === 'accepted';
    const s2Done = step === '03_spot' || phase === 'accepted';
    const s3Done = phase === 'accepted';
    return [
      {
        num: '01',
        label: 'Сценарий',
        done: s1Done,
        active: !s1Done,
      },
      {
        num: '02',
        label: 'Озвучка и сведение',
        done: s2Done,
        active: s1Done && !s2Done,
      },
      {
        num: '03',
        label: 'Готовый ролик',
        done: s3Done,
        active: s2Done && !s3Done,
      },
    ];
  }, [review]);

  return (
    <section
      data-testid="guest-order-review-page"
      aria-labelledby="guest-review-heading"
      className="py-6 sm:py-10"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Навигация и приватная пометка */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#111111]/10 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72">
            <button
              type="button"
              onClick={() => onNavigate({ kind: 'home' })}
              className="min-h-[34px] inline-flex items-center gap-1.5 font-semibold text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>FMWorks</span>
            </button>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-[#C83210] dark:text-[#FF6B47]">
              Гостевое прослушивание
            </span>
          </div>

          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#111111]/68 dark:text-[#F4F3EF]/68">
            <ShieldCheck
              className="w-3.5 h-3.5 text-[#166534] dark:text-[#4ADE80] shrink-0"
              aria-hidden="true"
            />
            <span>Без цен, контактов и доступа в кабинет</span>
          </span>
        </div>

        {isLoading ? (
          <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-8 text-center text-sm text-[#111111]/74 dark:text-[#F4F3EF]/74">
            Загружаем материалы аудиоролика для согласования…
          </div>
        ) : error || !review ? (
          <div
            data-testid="guest-review-error"
            className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-6 sm:p-8 space-y-4"
          >
            <h1
              id="guest-review-heading"
              className="text-lg sm:text-xl font-bold text-[#111111] dark:text-[#F4F3EF]"
            >
              Ссылка для прослушивания недоступна
            </h1>
            <p className="text-sm text-[#111111]/74 dark:text-[#F4F3EF]/74 leading-relaxed">
              {error ?? 'Запросите обновлённую гостевую ссылку у коллеги в личном кабинете FMWorks.'}
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => onNavigate({ kind: 'cabinet' })}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#C83210] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                Перейти в личный кабинет
              </button>
              <button
                type="button"
                onClick={() => onNavigate({ kind: 'home' })}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] transition-colors cursor-pointer whitespace-nowrap"
              >
                На главную
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Шапка проекта */}
            <header className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-5 sm:p-7 space-y-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72 tabular-nums">
                  <span className="font-mono font-bold text-[#111111] dark:text-[#F4F3EF]">
                    #{review.orderNumber}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[#C83210] dark:text-[#FF6B47]">
                    {review.stageBadgeLabel}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Хронометраж {review.targetSlotSec} сек</span>
                  <span aria-hidden="true">·</span>
                  <span>от {formatRuDate(review.createdAt)}</span>
                </div>

                <h1
                  id="guest-review-heading"
                  className="text-xl sm:text-3xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]"
                >
                  {review.formatTitle}
                </h1>
              </div>

              {/* 3 этапа производства */}
              <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {progressSteps.map((step) => (
                  <li
                    key={step.num}
                    className={`rounded-xl px-3 py-2.5 border text-xs transition-colors ${
                      step.done
                        ? 'bg-[#166534]/8 border-[#166534]/28 text-[#166534] dark:text-[#4ADE80]'
                        : step.active
                          ? 'bg-[#C83210]/10 border-[#C83210]/40 text-[#111111] dark:text-[#F4F3EF] font-semibold'
                          : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] border-[#111111]/10 dark:border-white/10 text-[#111111]/66 dark:text-[#F4F3EF]/66'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {step.done ? (
                        <CheckCircle2
                          className="w-3.5 h-3.5 shrink-0 text-[#166534] dark:text-[#4ADE80]"
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="font-mono text-[11px] font-bold shrink-0">
                          {step.num}
                        </span>
                      )}
                      <span className="leading-snug">{step.label}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </header>

            {/* Студийный плеер A/B версий ролика */}
            <section
              aria-label="Прослушивание аудиоверсий ролика"
              data-testid="guest-review-audio-section"
              className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-5 sm:p-7 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileAudio
                    className="w-4 h-4 text-[#C83210] dark:text-[#FF6B47] shrink-0"
                    aria-hidden="true"
                  />
                  <h2 className="text-base sm:text-lg font-bold text-[#111111] dark:text-[#F4F3EF]">
                    Прослушивание версий ролика
                  </h2>
                </div>
                {review.progressionChainText && (
                  <span className="text-xs font-medium text-[#111111]/68 dark:text-[#F4F3EF]/68 tabular-nums">
                    {review.progressionChainText}
                  </span>
                )}
              </div>

              {activeAudio ? (
                <div className="space-y-4">
                  {/* A/B-переключатель версий */}
                  {review.audioVersions.length > 1 && (
                    <div
                      role="group"
                      aria-label="Выбор версии аудиоролика"
                      className="flex flex-wrap items-center gap-2"
                    >
                      {review.audioVersions.map((ver) => {
                        const selected = ver.id === activeAudio.id;
                        return (
                          <button
                            key={ver.id}
                            type="button"
                            data-testid={`guest-audio-version-${ver.versionCode}`}
                            aria-pressed={selected}
                            onClick={() => handleSwitchAudioVersion(ver.id)}
                            className={`min-h-[38px] sm:min-h-[34px] px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                              selected
                                ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:border-[#F4F3EF]'
                                : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/82 dark:text-[#F4F3EF]/82 border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820]'
                            }`}
                          >
                            {ver.versionCode} · {ver.stageLabel}
                            {ver.isCurrentLatest ? ' (актуальная)' : ''}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Контроллер плеера */}
                  <div className="rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 p-4 space-y-3">
                    <audio
                      ref={audioRef}
                      key={activeAudio.id}
                      src={activeAudio.previewUrl}
                      preload="metadata"
                      onLoadedMetadata={(e) => {
                        const el = e.currentTarget;
                        const nextDuration = Number.isFinite(el.duration) ? el.duration : 0;
                        setDurationSec(nextDuration);
                        if (pendingResumeTimeRef.current !== null) {
                          const targetTime = Math.min(
                            pendingResumeTimeRef.current,
                            nextDuration > 0 ? nextDuration : pendingResumeTimeRef.current
                          );
                          el.currentTime = targetTime;
                          setCurrentTimeSec(targetTime);
                          pendingResumeTimeRef.current = null;
                          if (shouldAutoplayAfterSwitchRef.current) {
                            shouldAutoplayAfterSwitchRef.current = false;
                            void el.play().catch(() => setIsPlaying(false));
                          }
                        } else {
                          setCurrentTimeSec(0);
                        }
                      }}
                      onTimeUpdate={(e) => setCurrentTimeSec(e.currentTarget.currentTime)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          data-testid="guest-audio-play-btn"
                          onClick={() => void handleTogglePlay()}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-[#C83210] hover:bg-[#B02A0C] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4 shrink-0" aria-hidden="true" />
                          ) : (
                            <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
                          )}
                          <span>{isPlaying ? 'Пауза' : 'Слушать'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStepTime(-5)}
                          aria-label="Назад на 5 секунд"
                          className="min-h-[40px] px-2.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>−5с</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStepTime(5)}
                          aria-label="Вперёд на 5 секунд"
                          className="min-h-[40px] px-2.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <RotateCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>+5с</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-semibold text-[#111111]/82 dark:text-[#F4F3EF]/82 tabular-nums">
                          {formatQuickTimecodeLabel(currentTimeSec)} /{' '}
                          {formatQuickTimecodeLabel(durationSec)}
                        </span>

                        <a
                          href={activeAudio.downloadUrl}
                          download={activeAudio.fileName}
                          data-testid="guest-audio-download-link"
                          className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#111111]/16 dark:border-white/16 bg-white dark:bg-[#141418] hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Скачать</span>
                        </a>
                      </div>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={durationSec > 0 ? durationSec : 1}
                      step={0.1}
                      value={Math.min(currentTimeSec, durationSec > 0 ? durationSec : 1)}
                      aria-label="Позиция воспроизведения аудиоролика"
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        if (audioRef.current) {
                          audioRef.current.currentTime = next;
                        }
                        setCurrentTimeSec(next);
                      }}
                      className="w-full accent-[#C83210] cursor-pointer"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#111111]/72 dark:text-[#F4F3EF]/72 tabular-nums">
                      <span className="font-medium text-[#111111] dark:text-[#F4F3EF]">
                        {activeAudio.title}
                        {activeAudio.versionNote ? ` · ${activeAudio.versionNote}` : ''}
                      </span>
                      <span>
                        {activeAudio.fileName} · {formatFileSizeReadable(activeAudio.sizeBytes)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-[#111111]/74 dark:text-[#F4F3EF]/74 leading-relaxed">
                  Аудиоверсия ролика ещё готовится в студии — сейчас доступно согласование режиссёрского сценария ниже.
                </p>
              )}
            </section>

            {/* Режиссёрский сценарий или творческая задача */}
            {(effectiveScriptText || review.briefText) && (
              <section
                aria-label={
                  effectiveScriptText
                    ? 'Режиссёрский сценарий ролика'
                    : 'Творческая задача по ролику'
                }
                data-testid="guest-review-script-section"
                className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-5 sm:p-7 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText
                      className="w-4 h-4 text-[#C83210] dark:text-[#FF6B47] shrink-0"
                      aria-hidden="true"
                    />
                    <h2 className="text-base sm:text-lg font-bold text-[#111111] dark:text-[#F4F3EF]">
                      {effectiveScriptText
                        ? 'Режиссёрский сценарий'
                        : 'Творческая задача ролика'}
                    </h2>
                  </div>

                  {effectiveScriptText && scriptConcepts.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {scriptConcepts.map((concept) => {
                        const active = concept.id === activeConcept?.id;
                        return (
                          <button
                            key={concept.id}
                            type="button"
                            onClick={() => setSelectedConceptId(concept.id)}
                            className={`min-h-[34px] px-3 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                              active
                                ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:border-[#F4F3EF]'
                                : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/80 dark:text-[#F4F3EF]/80 border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820]'
                            }`}
                          >
                            {concept.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {effectiveScriptText ? (
                  <>
                    {(effectiveScriptSubtitle || effectiveDirectorApproach) && (
                      <p className="text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72">
                        {effectiveScriptSubtitle}
                        {effectiveScriptSubtitle && effectiveDirectorApproach
                          ? ' — '
                          : ''}
                        {effectiveDirectorApproach}
                      </p>
                    )}

                    <div className="rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10 p-4 text-sm text-[#111111]/90 dark:text-[#F4F3EF]/90 whitespace-pre-wrap leading-relaxed">
                      {effectiveScriptText}
                    </div>

                    {effectiveStressNotes && (
                      <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 leading-relaxed">
                        Ударения и подача: {effectiveStressNotes}
                      </p>
                    )}

                    {effectiveFz38Disclaimer && (
                      <p className="text-xs text-[#111111]/68 dark:text-[#F4F3EF]/68 leading-relaxed">
                        Юридическая сноска (ФЗ-38): {effectiveFz38Disclaimer}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-[#111111]/84 dark:text-[#F4F3EF]/84 leading-relaxed">
                    {review.briefText}
                  </p>
                )}
              </section>
            )}

            {/* Заключение руководителя для коллеги */}
            <section
              aria-label="Заключение для коллеги"
              data-testid="guest-review-feedback-section"
              className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-5 sm:p-7 space-y-4"
            >
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-[#111111] dark:text-[#F4F3EF]">
                  Заключение для коллеги
                </h2>
                <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  Выберите решение и скопируйте готовый ответ для отправки в рабочий чат или почту — утверждение в студии выполнит ответственный менеджер.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="guest-verdict-approved"
                  aria-pressed={verdict === 'approved'}
                  onClick={() => setVerdict('approved')}
                  className={`min-h-[40px] px-4 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    verdict === 'approved'
                      ? 'bg-[#166534] text-white border-[#166534]'
                      : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/82 dark:text-[#F4F3EF]/82 border-[#111111]/14 dark:border-white/14 hover:border-[#166534]'
                  }`}
                >
                  Согласовано
                </button>
                <button
                  type="button"
                  data-testid="guest-verdict-edits"
                  aria-pressed={verdict === 'needs_edits'}
                  onClick={() => setVerdict('needs_edits')}
                  className={`min-h-[40px] px-4 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    verdict === 'needs_edits'
                      ? 'bg-[#C83210] text-white border-[#C83210]'
                      : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/82 dark:text-[#F4F3EF]/82 border-[#111111]/14 dark:border-white/14 hover:border-[#C83210]'
                  }`}
                >
                  Нужна правка
                </button>
              </div>

              <textarea
                rows={2}
                aria-label="Комментарий руководителя к ролику"
                data-testid="guest-verdict-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  verdict === 'approved'
                    ? 'Комментарий (необязательно), например: «Звучит уверенно, запускаем в эфир»'
                    : 'Укажите таймкод или формулировку правки, например: «На 00:08 сделать акцент на слове „выгода“»'
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs sm:text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  data-testid="guest-copy-feedback-btn"
                  onClick={() => void handleCopyDirectorFeedback()}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#C83210] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                >
                  {copiedFeedback ? (
                    <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    {copiedFeedback
                      ? 'Заключение скопировано'
                      : 'Скопировать заключение для коллеги'}
                  </span>
                </button>

                <span className="inline-flex items-center gap-1.5 text-[11px] text-[#111111]/66 dark:text-[#F4F3EF]/66">
                  <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Страница закрыта от индексации поисковиками</span>
                </span>
              </div>
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
