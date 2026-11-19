import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  Check,
  ChevronDown,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeScriptFullComplianceAndChronometer,
  buildFullReportBriefTransferText,
  type CharacterCountMode,
  CLIENT_FZ38_SELECTOR_OPTIONS,
  type ClientFz38CategorySelection,
  type ClientScriptFz38Evaluation,
  evaluateClientScriptAndFz38,
  SCRIPT_TEMPO_OPTIONS,
  type ScriptTempoId,
} from '../data/clientChronometerAndFz38';
import type { IndustryVerticalSlug } from '../data/platformRouter';
import type { OrderFormatId } from '../data/pricingData';
import {
  buildChronometerFindingsSignature,
  CHRONOMETER_MOTION_DURATION_SEC,
  CHRONOMETER_MOTION_EASE,
  CHRONOMETER_NUMBER_TWEEN_MS,
  computeChronometerBarScales,
  formatChronometerNumber,
  interpolateChronometerNumber,
} from '../utils/chronometerResultMotion';

interface QuickExampleScript {
  id: string;
  label: string;
  text: string;
}

const QUICK_EXAMPLES: readonly QuickExampleScript[] = [
  {
    id: 'clinic',
    label: 'Клиника',
    text: 'Комплексная диагностика зрения и МРТ за один утренний визит без очередей. Клиника «СветМед», запись по телефону 310-77-00.',
  },
  {
    id: 'realty-mortgage',
    label: 'ЖК + ипотека',
    text: 'ЖК «Речной Парк» — лучший выбор у воды! Квартиры с ипотекой от 6% и скидкой до 300 тысяч рублей. Звоните 240-15-80.',
  },
  {
    id: 'promo-delivery',
    label: 'Акция и доставка',
    text: 'Осенняя распродажа в интернет-магазине «УютДом» — скидка 25% и быстрая доставка курьером в день заказа. Подробности на uyutdom.ru.',
  },
  {
    id: 'clean-bakery',
    label: 'Обычный текст',
    text: 'Свежая выпечка на сливочном масле и ароматный зерновой кофе каждое утро в пекарне «Тёплый Хлеб» на улице Мира. Ждём вас с восьми утра.',
  },
] as const;

const SIMPLE_CHAR_PRESETS = [
  { chars: 140, label: '140 зн. (~10 с)' },
  { chars: 210, label: '210 зн. (~15 с)' },
  { chars: 280, label: '280 зн. (~20 с)' },
  { chars: 420, label: '420 зн. (~30 с)' },
] as const;

interface EditorialChronometerProps {
  mode?: 'editorial_section';
  onApplyToOrder: (payload: {
    formatId: OrderFormatId;
    spotDurationSec: number;
    industryPreset: IndustryVerticalSlug | null;
    briefText: string;
  }) => void;
}

interface InlineOrderChronometerProps {
  mode: 'inline_order';
  briefText: string;
  spotDurationSec: number;
  onUpdateBriefText: (nextText: string) => void;
  onUpdateSpotDuration: (nextSec: number) => void;
  onUpdateIndustryPreset?: (slug: IndustryVerticalSlug | null) => void;
}

export type ClientChronometerFz38SectionProps =
  | EditorialChronometerProps
  | InlineOrderChronometerProps;

function FitStatusLine({
  evaluation,
}: {
  evaluation: ClientScriptFz38Evaluation;
}) {
  const toneClass =
    evaluation.fitStatus === 'overflow'
      ? 'text-[#D93814] dark:text-[#FF6B4A]'
      : evaluation.fitStatus === 'fits_tightly'
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-emerald-700 dark:text-emerald-400';

  return (
    <div className="space-y-1.5">
      <p className={`text-sm sm:text-base font-bold tabular-nums ${toneClass}`}>
        {evaluation.fitHeadline}
      </p>
      <p className="text-xs sm:text-sm text-[#111111]/72 dark:text-[#F4F3EF]/72 leading-relaxed">
        {evaluation.fitAdvice}
      </p>
    </div>
  );
}

/**
 * Плавно интерполирует числовое значение прямо в DOM-узле за 180 мс без вызовов React setState в RAF.
 */
function AnimatedChronometerNumber({
  value,
  decimals = 1,
  prefix = '',
  reducedMotion = false,
}: {
  value: number;
  decimals?: 0 | 1;
  prefix?: string;
  reducedMotion?: boolean;
}) {
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const previousValueRef = useRef<number>(value);

  useEffect(() => {
    const node = spanRef.current;
    const fromVal = previousValueRef.current;
    previousValueRef.current = value;

    if (!node) return;
    if (
      reducedMotion ||
      Math.abs(value - fromVal) < (decimals === 0 ? 0.5 : 0.05)
    ) {
      node.textContent = formatChronometerNumber(value, decimals, prefix);
      return;
    }

    let rafId = 0;
    const startedAt = performance.now();

    const step = (now: number) => {
      const progress = Math.min(
        1,
        (now - startedAt) / CHRONOMETER_NUMBER_TWEEN_MS
      );
      const interpolated = interpolateChronometerNumber({
        from: fromVal,
        to: value,
        progress,
        decimals,
        reducedMotion: false,
      });
      if (spanRef.current) {
        spanRef.current.textContent = formatChronometerNumber(
          interpolated,
          decimals,
          prefix
        );
      }
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [value, decimals, prefix, reducedMotion]);

  return (
    <span ref={spanRef}>
      {formatChronometerNumber(value, decimals, prefix)}
    </span>
  );
}

interface CommittedChronometerQuery {
  inputMode: 'text' | 'chars';
  text: string;
  charCount: number;
  countMode: CharacterCountMode;
  tempo: ScriptTempoId;
}

export function ClientChronometerFz38Section(
  props: ClientChronometerFz38SectionProps
) {
  const initialText = QUICK_EXAMPLES[0]!.text;

  // Состояние для inline_order (форма /order)
  const [inlineTempo, setInlineTempo] =
    useState<ScriptTempoId>('business_standard');
  const [inlineCategory, setInlineCategory] =
    useState<ClientFz38CategorySelection>('auto');
  const [isInlineExpanded, setIsInlineExpanded] = useState<boolean>(false);

  // Состояние для упрощённого полноценного калькулятора на /pricing
  const [inputMode, setInputMode] = useState<'text' | 'chars'>('text');
  const [draftText, setDraftText] = useState<string>(initialText);
  const [draftCharCount, setDraftCharCount] = useState<number>(210);
  const [charCountMode, setCharCountMode] =
    useState<CharacterCountMode>('with_spaces');
  const [tempo, setTempo] = useState<ScriptTempoId>('business_standard');
  const [isTempoExpanded, setIsTempoExpanded] = useState<boolean>(false);
  const [includeDisclaimerInTransfer, setIncludeDisclaimerInTransfer] =
    useState<boolean>(true);

  const shouldReduceMotion = useReducedMotion();
  const [calcPulse, setCalcPulse] = useState<number>(0);

  const [committed, setCommitted] = useState<CommittedChronometerQuery>({
    inputMode: 'text',
    text: initialText,
    charCount: 210,
    countMode: 'with_spaces',
    tempo: 'business_standard',
  });

  // Расчёт для компактного режима внутри формы /order
  const inlineEvaluation = useMemo(() => {
    if (props.mode !== 'inline_order') return null;
    return evaluateClientScriptAndFz38({
      text: props.briefText,
      tempo: inlineTempo,
      categorySelection: inlineCategory,
      targetSlotSec: props.spotDurationSec,
    });
  }, [
    props.mode,
    props.mode === 'inline_order' ? props.briefText : '',
    props.mode === 'inline_order' ? props.spotDurationSec : 20,
    inlineTempo,
    inlineCategory,
  ]);

  // Полноценный автоматический отчёт по тексту/знакам + ФЗ-38
  const report = useMemo(() => {
    if (props.mode === 'inline_order') return null;
    return analyzeScriptFullComplianceAndChronometer({
      inputMode: committed.inputMode,
      text: committed.text,
      charCount: committed.charCount,
      countMode: committed.countMode,
      tempo: committed.tempo,
    });
  }, [props.mode, committed]);

  // ── Режим inline_order (форма /order) — сохранён без изменений ──
  if (props.mode === 'inline_order') {
    if (!inlineEvaluation) return null;
    const evaluation = inlineEvaluation;
    const hasDisclaimer = Boolean(evaluation.categorySpec.sampleDisclaimerText);
    const alreadyHasSample =
      hasDisclaimer &&
      props.briefText
        .toLowerCase()
        .includes(
          evaluation.categorySpec.sampleDisclaimerText
            .slice(0, 18)
            .toLowerCase()
        );

    return (
      <div
        data-testid="order-inline-chronometer-box"
        className="rounded-2xl px-3.5 py-3 bg-[#EFECE5]/55 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 space-y-2.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[#111111]/78 dark:text-[#F4F3EF]/78">
            <Clock
              className="w-3.5 h-3.5 text-[#FF4820] shrink-0"
              aria-hidden="true"
            />
            <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
              Хронометр ФЗ-38:
            </span>
            <span>{evaluation.charCountWithSpaces} зн.</span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span>{evaluation.wordCount} сл.</span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span>
              ~{evaluation.totalExactSec} сек из {props.spotDurationSec} сек
            </span>
            {evaluation.disclaimerRequiredSec > 0 && (
              <>
                <span aria-hidden="true" className="opacity-40">
                  ·
                </span>
                <span className="text-[#FF4820] font-medium">
                  сноска {evaluation.categorySpec.shortLabel} (+
                  {evaluation.disclaimerRequiredSec} с)
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            data-testid="order-inline-chronometer-toggle"
            aria-expanded={isInlineExpanded}
            onClick={() => setIsInlineExpanded((prev) => !prev)}
            className="text-xs font-semibold text-[#FF4820] hover:underline cursor-pointer whitespace-nowrap shrink-0"
          >
            {isInlineExpanded ? 'Свернуть расчёт' : 'Темп и сноска ФЗ-38 →'}
          </button>
        </div>

        {isInlineExpanded && (
          <div className="pt-2.5 border-t border-[#111111]/10 dark:border-white/10 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label
                  htmlFor="order-inline-chrono-tempo"
                  className="block font-semibold text-[#111111]/64 dark:text-[#F4F3EF]/64"
                >
                  Темп чтения диктора
                </label>
                <select
                  id="order-inline-chrono-tempo"
                  value={inlineTempo}
                  onChange={(e) =>
                    setInlineTempo(e.target.value as ScriptTempoId)
                  }
                  className="w-full min-h-[38px] px-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 font-medium"
                >
                  {SCRIPT_TEMPO_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label} ({opt.wordsPerMinute} сл/мин)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="order-inline-chrono-fz38"
                  className="block font-semibold text-[#111111]/64 dark:text-[#F4F3EF]/64"
                >
                  Проверка сносок ФЗ-38
                </label>
                <select
                  id="order-inline-chrono-fz38"
                  value={inlineCategory}
                  onChange={(e) =>
                    setInlineCategory(
                      e.target.value as ClientFz38CategorySelection
                    )
                  }
                  className="w-full min-h-[38px] px-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 font-medium"
                >
                  {CLIENT_FZ38_SELECTOR_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label} ({opt.badgeSec})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <FitStatusLine evaluation={evaluation} />

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {evaluation.wordCount > 0 &&
                evaluation.recommendedSpotSec !== props.spotDurationSec && (
                  <button
                    type="button"
                    data-testid="order-inline-apply-recommended-sec"
                    onClick={() => {
                      props.onUpdateSpotDuration(evaluation.recommendedSpotSec);
                      if (
                        props.onUpdateIndustryPreset &&
                        evaluation.categorySpec.mappedIndustryPreset
                      ) {
                        props.onUpdateIndustryPreset(
                          evaluation.categorySpec.mappedIndustryPreset
                        );
                      }
                    }}
                    className="min-h-[34px] px-3 py-1.5 rounded-xl bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] font-semibold tabular-nums cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Поставить метраж {evaluation.recommendedSpotSec} сек
                  </button>
                )}

              {hasDisclaimer && !alreadyHasSample && (
                <button
                  type="button"
                  data-testid="order-inline-insert-disclaimer-btn"
                  onClick={() => {
                    const prefix = props.briefText.trim();
                    const appended = prefix
                      ? `${prefix}\n\n[Дисклеймер ${evaluation.categorySpec.legalNorm}]: ${evaluation.categorySpec.sampleDisclaimerText}`
                      : evaluation.categorySpec.sampleDisclaimerText;
                    props.onUpdateBriefText(appended.slice(0, 1950));
                    if (
                      props.onUpdateIndustryPreset &&
                      evaluation.categorySpec.mappedIndustryPreset
                    ) {
                      props.onUpdateIndustryPreset(
                        evaluation.categorySpec.mappedIndustryPreset
                      );
                    }
                  }}
                  className="min-h-[34px] px-3 py-1.5 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] font-semibold text-[#111111] dark:text-[#F4F3EF] cursor-pointer whitespace-nowrap shrink-0"
                >
                  + Вставить шаблон сноски ({evaluation.categorySpec.shortLabel})
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!report) return null;

  const trimmedDraft = draftText.trim();
  const draftCharsWithSpaces = trimmedDraft.length;
  const draftWords = trimmedDraft
    ? trimmedDraft
        .split(/\s+/)
        .filter((token) => /[а-яёa-z0-9]/i.test(token)).length
    : 0;

  const hasPendingChanges =
    inputMode !== committed.inputMode ||
    tempo !== committed.tempo ||
    (inputMode === 'text'
      ? draftText !== committed.text
      : draftCharCount !== committed.charCount ||
        charCountMode !== committed.countMode);

  const handleCalculate = () => {
    setCommitted({
      inputMode,
      text: draftText,
      charCount: draftCharCount,
      countMode: charCountMode,
      tempo,
    });
    setCalcPulse((prev) => prev + 1);
  };

  const handleLiveCharUpdate = (
    nextCharCount: number,
    nextCountMode: CharacterCountMode = charCountMode
  ) => {
    const clamped = Number.isFinite(nextCharCount)
      ? Math.max(0, Math.min(2500, Math.round(nextCharCount)))
      : 0;
    setDraftCharCount(clamped);
    setCharCountMode(nextCountMode);
    setCommitted((prev) => ({
      ...prev,
      inputMode: 'chars',
      charCount: clamped,
      countMode: nextCountMode,
      tempo,
    }));
  };

  const handlePickExample = (example: QuickExampleScript) => {
    setInputMode('text');
    setDraftText(example.text);
    setCommitted({
      inputMode: 'text',
      text: example.text,
      charCount: draftCharCount,
      countMode: charCountMode,
      tempo,
    });
    setCalcPulse((prev) => prev + 1);
  };

  const handleToggleInputMode = () => {
    if (inputMode === 'text') {
      const nextChars =
        draftCharsWithSpaces > 0 ? draftCharsWithSpaces : draftCharCount;
      setInputMode('chars');
      setDraftCharCount(nextChars);
      setCommitted({
        inputMode: 'chars',
        text: draftText,
        charCount: nextChars,
        countMode: charCountMode,
        tempo,
      });
    } else {
      setInputMode('text');
      setCommitted({
        inputMode: 'text',
        text: draftText,
        charCount: draftCharCount,
        countMode: charCountMode,
        tempo,
      });
    }
    setCalcPulse((prev) => prev + 1);
  };

  const handleSelectTempo = (nextTempo: ScriptTempoId) => {
    setTempo(nextTempo);
    setCommitted((prev) => ({ ...prev, tempo: nextTempo }));
  };

  const handleTransferToOrder = () => {
    const activeReport = hasPendingChanges
      ? analyzeScriptFullComplianceAndChronometer({
          inputMode,
          text: draftText,
          charCount: draftCharCount,
          countMode: charCountMode,
          tempo,
        })
      : report;

    const briefText = buildFullReportBriefTransferText({
      scriptText: inputMode === 'text' ? draftText : '',
      report: activeReport,
      includeSampleDisclaimer: includeDisclaimerInTransfer,
      charCountMode,
    });

    props.onApplyToOrder({
      formatId: activeReport.recommendedFormatId,
      spotDurationSec: activeReport.recommendedSlotSec,
      industryPreset: activeReport.mappedIndustryPreset,
      briefText,
    });
  };

  const currentTempoSpec =
    SCRIPT_TEMPO_OPTIONS.find((opt) => opt.id === tempo) ??
    SCRIPT_TEMPO_OPTIONS[1]!;

  const mandatoryFindings = report.findings.filter(
    (f) => f.severity === 'mandatory_disclaimer'
  );
  const alreadyIncludedFindings = report.findings.filter(
    (f) => f.severity === 'already_included'
  );
  const riskFindings = report.findings.filter(
    (f) => f.severity === 'moderation_risk'
  );

  return (
    <section
      id="script-chronometer"
      data-testid="pricing-chronometer-fz38-section"
      aria-labelledby="chronometer-fz38-heading"
      className="scroll-mt-24 py-16 sm:py-24 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 px-4 sm:px-6 lg:px-12"
    >
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Заголовок секции */}
        <div className="max-w-3xl space-y-3">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
            <span>Калькулятор хронометража</span>
            <span aria-hidden="true" className="hidden sm:inline opacity-40">
              ·
            </span>
            <span>Автопроверка по ФЗ-38 «О рекламе»</span>
          </div>

          <h2
            id="chronometer-fz38-heading"
            className="text-2xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
          >
            Узнайте хронометраж ролика и нужные сноски по закону.
          </h2>
          <p className="text-sm sm:text-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 editorial-pretty">
            Вставьте текст сценария и нажмите «Рассчитать» — калькулятор сам
            измерит время чтения диктора, определит обязательные юридические
            сноски и предупредит о рисках эфирной модерации.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Левая колонка: максимально простой ввод + 1 главная кнопка «Рассчитать» */}
          <div className="lg:col-span-7 lg:sticky lg:top-28 rounded-3xl p-6 sm:p-8 bg-[#EFECE5]/75 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 space-y-5">
            {inputMode === 'text' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="public-chronometer-textarea"
                    className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]"
                  >
                    Текст сценария или черновик оффера
                  </label>
                  <div className="flex items-center gap-3 text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58 tabular-nums">
                    <span>
                      {draftCharsWithSpaces} зн. · {draftWords} сл.
                    </span>
                    {draftText.length > 0 && (
                      <button
                        type="button"
                        data-testid="chrono-clear-text-btn"
                        onClick={() => setDraftText('')}
                        className="font-medium hover:text-[#FF4820] transition-colors cursor-pointer"
                      >
                        Очистить
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  id="public-chronometer-textarea"
                  data-testid="public-chronometer-textarea"
                  rows={6}
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleCalculate();
                    }
                  }}
                  placeholder="Вставьте текст аудиоролика или черновик предложения с телефоном и сайтом…"
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none focus:border-[#FF4820] leading-relaxed"
                />

                {/* Быстрые примеры для 1-клик проверки */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-2 pt-0.5">
                  <span className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">
                    Примеры:
                  </span>
                  {QUICK_EXAMPLES.map((example) => {
                    const isCurrent = draftText.trim() === example.text.trim();
                    return (
                      <button
                        key={example.id}
                        type="button"
                        data-testid={`chrono-sample-${example.id}`}
                        aria-pressed={isCurrent}
                        onClick={() => handlePickExample(example)}
                        className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          isCurrent
                            ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                            : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/78 dark:text-[#F4F3EF]/78 border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                        }`}
                      >
                        {example.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div
                data-testid="chrono-char-calculator-panel"
                className="space-y-4 tabular-nums"
              >
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <label
                      htmlFor="chrono-char-count-input"
                      className="block text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]"
                    >
                      Сколько знаков планируется в сценарии?
                    </label>
                    <div className="flex items-center gap-2.5">
                      <input
                        id="chrono-char-count-input"
                        data-testid="chrono-char-count-input"
                        type="number"
                        min={0}
                        max={2500}
                        step={10}
                        value={draftCharCount}
                        onChange={(e) => {
                          handleLiveCharUpdate(Number(e.target.value));
                        }}
                        className="w-36 min-h-[46px] px-3.5 rounded-2xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/16 dark:border-white/16 text-xl font-bold text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                      />
                      <span className="text-xs sm:text-sm text-[#111111]/64 dark:text-[#F4F3EF]/64">
                        знаков
                      </span>
                    </div>
                  </div>

                  <div
                    role="group"
                    aria-label="Учёт пробелов"
                    className="inline-flex items-center p-1 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 self-start sm:self-end"
                  >
                    <button
                      type="button"
                      data-testid="chrono-char-mode-with-spaces"
                      aria-pressed={charCountMode === 'with_spaces'}
                      onClick={() =>
                        handleLiveCharUpdate(draftCharCount, 'with_spaces')
                      }
                      className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        charCountMode === 'with_spaces'
                          ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                          : 'text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#111111] dark:hover:text-white'
                      }`}
                    >
                      С пробелами
                    </button>
                    <button
                      type="button"
                      data-testid="chrono-char-mode-without-spaces"
                      aria-pressed={charCountMode === 'without_spaces'}
                      onClick={() =>
                        handleLiveCharUpdate(draftCharCount, 'without_spaces')
                      }
                      className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        charCountMode === 'without_spaces'
                          ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                          : 'text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#111111] dark:hover:text-white'
                      }`}
                    >
                      Без пробелов
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="chrono-char-count-slider" className="sr-only">
                    Ползунок количества знаков
                  </label>
                  <input
                    id="chrono-char-count-slider"
                    data-testid="chrono-char-count-slider"
                    type="range"
                    min={0}
                    max={900}
                    step={10}
                    value={Math.min(900, draftCharCount)}
                    onChange={(e) =>
                      handleLiveCharUpdate(Number(e.target.value))
                    }
                    className="w-full h-2 rounded-full accent-[#FF4820] cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[11px] text-[#111111]/52 dark:text-[#F4F3EF]/52">
                    <span>0</span>
                    <span>200</span>
                    <span>400</span>
                    <span>600</span>
                    <span>900 зн.</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {SIMPLE_CHAR_PRESETS.map((preset) => (
                    <button
                      key={preset.chars}
                      type="button"
                      data-testid={`chrono-char-preset-${preset.chars}`}
                      onClick={() => {
                        handleLiveCharUpdate(preset.chars);
                      }}
                      className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        draftCharCount === preset.chars
                          ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                          : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/78 dark:text-[#F4F3EF]/78 border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Главная кнопка действия */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                data-testid="chrono-calculate-btn"
                onClick={handleCalculate}
                className="w-full min-h-[52px] px-6 py-3.5 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm sm:text-base font-semibold inline-flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
              >
                <Calculator className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {hasPendingChanges
                    ? 'Пересчитать хронометраж'
                    : 'Рассчитать хронометраж'}
                </span>
              </button>

              {hasPendingChanges && (
                <p
                  data-testid="chrono-pending-hint"
                  className="text-xs text-center font-medium text-[#D93814] dark:text-[#FF6B4A]"
                >
                  Данные изменены — нажмите кнопку, чтобы обновить расчёт и
                  проверку ФЗ-38
                </p>
              )}
            </div>

            {/* Спокойная нижняя строка с дополнительными опциями (не мешают главному сценарию) */}
            <div className="pt-4 border-t border-[#111111]/10 dark:border-white/10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
                <button
                  type="button"
                  data-testid="chrono-toggle-char-mode-btn"
                  onClick={handleToggleInputMode}
                  className="font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:text-[#FF4820] transition-colors cursor-pointer text-left"
                >
                  {inputMode === 'text'
                    ? 'Нет готового текста? Рассчитать по числу знаков →'
                    : '← Вернуться к расчёту по тексту и проверке ФЗ-38'}
                </button>

                <button
                  type="button"
                  data-testid="chrono-advanced-tempo-toggle"
                  aria-expanded={isTempoExpanded}
                  onClick={() => setIsTempoExpanded((prev) => !prev)}
                  className="inline-flex items-center gap-1 font-medium text-[#111111]/62 dark:text-[#F4F3EF]/62 hover:text-[#111111] dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Темп: {currentTempoSpec.label}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      isTempoExpanded ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </div>

              {isTempoExpanded && (
                <div
                  role="group"
                  aria-label="Выбор темпа чтения диктора"
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1"
                >
                  {SCRIPT_TEMPO_OPTIONS.map((opt) => {
                    const isSelected = tempo === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid={`chrono-tempo-${opt.id}`}
                        aria-pressed={isSelected}
                        onClick={() => handleSelectTempo(opt.id)}
                        className={`p-3 rounded-2xl border text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                            : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111] dark:text-[#F4F3EF] border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-bold tabular-nums">
                          <span>{opt.label}</span>
                          <span className="opacity-70 whitespace-nowrap shrink-0">
                            {opt.wordsPerMinute} сл/м
                          </span>
                        </div>
                        <p className="text-[11px] opacity-72 mt-1 leading-snug">
                          {opt.hint}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Правая колонка: полный автоматический результат и аудит ФЗ-38 с плавной анимацией */}
          <div className="lg:col-span-5 rounded-3xl p-6 sm:p-8 bg-[#141418] text-[#F4F3EF] border border-white/10 space-y-6 tabular-nums overflow-hidden">
            {/* Итоговый хронометраж и рекомендованный слот */}
            <motion.div
              key={`chrono-hero-${calcPulse}-${report.isEmpty ? 'empty' : 'ready'}`}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: CHRONOMETER_MOTION_DURATION_SEC,
                ease: CHRONOMETER_MOTION_EASE,
              }}
              className="flex items-start justify-between gap-4 pb-5 border-b border-white/10"
            >
              <div>
                <p className="text-xs font-medium text-white/60">
                  Примерный хронометраж ролика
                </p>
                <div
                  data-testid="public-chrono-total-sec"
                  aria-live="polite"
                  className="text-4xl sm:text-5xl font-bold tracking-tight text-white mt-1"
                >
                  {report.isEmpty ? (
                    '0'
                  ) : (
                    <AnimatedChronometerNumber
                      value={report.totalExactSec}
                      decimals={1}
                      prefix="~"
                      reducedMotion={Boolean(shouldReduceMotion)}
                    />
                  )}{' '}
                  <span className="text-lg sm:text-xl font-semibold text-white/65">
                    сек
                  </span>
                </div>
                <p className="text-xs text-white/66 mt-1.5">
                  Речь диктора:{' '}
                  <AnimatedChronometerNumber
                    value={report.spokenCreativeSec}
                    decimals={1}
                    reducedMotion={Boolean(shouldReduceMotion)}
                  />{' '}
                  с · Доп. сноска ФЗ-38:{' '}
                  {report.legalDisclaimerSec > 0 ? (
                    <>
                      +
                      <AnimatedChronometerNumber
                        value={report.legalDisclaimerSec}
                        decimals={1}
                        reducedMotion={Boolean(shouldReduceMotion)}
                      />{' '}
                      с
                    </>
                  ) : (
                    '0 с'
                  )}
                </p>
                {!report.isEmpty && (
                  <p className="text-[11px] text-white/52 mt-1">
                    <AnimatedChronometerNumber
                      value={report.charCountWithSpaces}
                      decimals={0}
                      reducedMotion={Boolean(shouldReduceMotion)}
                    />{' '}
                    зн. с пробелами ·{' '}
                    <AnimatedChronometerNumber
                      value={report.charCountWithoutSpaces}
                      decimals={0}
                      reducedMotion={Boolean(shouldReduceMotion)}
                    />{' '}
                    без пробелов ·{' '}
                    {report.spokenWordCount > report.wordCount ? (
                      <>
                        <AnimatedChronometerNumber
                          value={report.wordCount}
                          decimals={0}
                          reducedMotion={Boolean(shouldReduceMotion)}
                        />{' '}
                        сл. (
                        <AnimatedChronometerNumber
                          value={report.spokenWordCount}
                          decimals={0}
                          reducedMotion={Boolean(shouldReduceMotion)}
                        />{' '}
                        произносимых с цифрами)
                      </>
                    ) : (
                      <>
                        <AnimatedChronometerNumber
                          value={report.wordCount}
                          decimals={0}
                          reducedMotion={Boolean(shouldReduceMotion)}
                        />{' '}
                        сл.
                      </>
                    )}
                  </p>
                )}
              </div>

              {!report.isEmpty && (
                <div className="text-right shrink-0">
                  <p className="text-xs text-white/58">Оптимальный слот</p>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.p
                      key={`slot-${report.recommendedSlotSec}`}
                      data-testid="public-chrono-recommended-slot"
                      initial={
                        shouldReduceMotion
                          ? false
                          : { opacity: 0, y: 6, scale: 0.96 }
                      }
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, y: -5, scale: 0.96 }
                      }
                      transition={{
                        duration: CHRONOMETER_MOTION_DURATION_SEC,
                        ease: CHRONOMETER_MOTION_EASE,
                      }}
                      className="text-2xl sm:text-3xl font-bold text-[#FF6B4A] mt-1"
                    >
                      {report.recommendedSlotSec} с
                    </motion.p>
                  </AnimatePresence>
                </div>
              )}
            </motion.div>

            {/* Пропорциональная шкала (GPU scaleX без reflow width) + плавное появление вердикта */}
            {!report.isEmpty && (() => {
              const barScales = computeChronometerBarScales({
                creativeSharePct: report.creativeSharePct,
                disclaimerSharePct: report.disclaimerSharePct,
              });
              return (
                <div className="space-y-2.5">
                  <div
                    aria-hidden="true"
                    className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden"
                  >
                    {report.disclaimerSharePct > 0 && (
                      <div
                        style={{
                          transform: `scaleX(${barScales.totalOccupiedScale})`,
                        }}
                        className="absolute inset-0 origin-left bg-[#FF4820] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      />
                    )}
                    <div
                      style={{
                        transform: `scaleX(${barScales.creativeScale})`,
                      }}
                      className="absolute inset-0 origin-left bg-white transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    />
                  </div>

                  <motion.div
                    key={`verdict-${report.recommendedSlotSec}-${report.hasMandatoryDisclaimers ? 'disc' : 'clean'}-${calcPulse}`}
                    initial={
                      shouldReduceMotion ? false : { opacity: 0.35, y: 4 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: CHRONOMETER_MOTION_DURATION_SEC,
                      ease: CHRONOMETER_MOTION_EASE,
                    }}
                    className="space-y-1"
                  >
                    <p
                      data-testid="public-chrono-fit-headline"
                      className="text-sm font-bold text-white"
                    >
                      {report.summaryHeadline}
                    </p>
                    <p className="text-xs text-white/72 leading-relaxed">
                      {report.summaryAdvice}
                    </p>
                  </motion.div>
                </div>
              );
            })()}

            {/* Автоматическая юридическая проверка ФЗ-38 с плавным появлением карточек */}
            <div
              data-testid="public-chrono-legal-findings"
              className="space-y-3 pt-4 border-t border-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-white/92">
                  <ShieldCheck
                    className="w-4 h-4 text-[#FF4820] shrink-0"
                    aria-hidden="true"
                  />
                  <span>Проверка по ФЗ-38 «О рекламе»</span>
                </div>
                {!report.isEmpty && report.inputMode === 'text' && (
                  <span className="text-[11px] font-medium text-white/58">
                    {report.findings.length === 0
                      ? 'Замечаний нет'
                      : [
                          mandatoryFindings.length > 0
                            ? `добавить сносок: ${mandatoryFindings.length}`
                            : '',
                          alreadyIncludedFindings.length > 0
                            ? `уже в тексте: ${alreadyIncludedFindings.length}`
                            : '',
                          riskFindings.length > 0
                            ? `рисков: ${riskFindings.length}`
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                  </span>
                )}
              </div>

              <motion.div
                key={buildChronometerFindingsSignature(report, calcPulse)}
                initial={shouldReduceMotion ? false : { opacity: 0.3, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: CHRONOMETER_MOTION_DURATION_SEC,
                  ease: CHRONOMETER_MOTION_EASE,
                }}
                className="space-y-3"
              >
                  {report.isEmpty ? (
                    <p className="text-xs text-white/64 leading-relaxed">
                      {report.summaryAdvice}
                    </p>
                  ) : report.inputMode === 'chars' ? (
                    <div className="rounded-2xl p-3.5 bg-white/[0.04] border border-white/10 text-xs text-white/74 leading-relaxed">
                      В режиме подсчёта по знакам оценивается только время речи.
                      Чтобы калькулятор автоматически проверил нужные сноски
                      ФЗ-38 (медицина, 214-ФЗ, ипотека, акции, 436-ФЗ), вставьте
                      текст сценария.
                    </div>
                  ) : report.findings.length === 0 ? (
                    <div
                      data-testid="public-chrono-clean-status"
                      className="rounded-2xl p-3.5 bg-emerald-500/10 border border-emerald-400/20 space-y-1"
                    >
                      <p className="text-xs font-semibold text-emerald-300">
                        Обязательные юридические сноски не требуются · текст
                        чистый для эфира
                      </p>
                      <p className="text-xs text-white/70 leading-relaxed">
                        В тексте не обнаружено регулируемых категорий (медицина,
                        БАД, новостройки, финансы, акции), превосходных степеней
                        или латиницы без перевода.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {report.findings.map((finding, idx) => {
                        const isRisk = finding.severity === 'moderation_risk';
                        const isAlreadyIncluded =
                          finding.severity === 'already_included';
                        return (
                          <motion.div
                            key={finding.code}
                            data-testid={`chrono-finding-${finding.code}`}
                            initial={
                              shouldReduceMotion ? false : { opacity: 0, y: 6 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: CHRONOMETER_MOTION_DURATION_SEC,
                              delay: shouldReduceMotion
                                ? 0
                                : Math.min(0.12, idx * 0.035),
                              ease: CHRONOMETER_MOTION_EASE,
                            }}
                            className={`rounded-2xl p-3.5 border space-y-1.5 ${
                              isRisk
                                ? 'bg-amber-400/[0.07] border-amber-400/25'
                                : isAlreadyIncluded
                                  ? 'bg-emerald-500/[0.08] border-emerald-400/25'
                                  : 'bg-white/[0.04] border-white/10'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 text-xs">
                              <div className="flex items-start gap-2 font-semibold text-white">
                                {isRisk && (
                                  <AlertTriangle
                                    className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5"
                                    aria-hidden="true"
                                  />
                                )}
                                {isAlreadyIncluded && (
                                  <Check
                                    className="w-3.5 h-3.5 text-emerald-300 shrink-0 mt-0.5"
                                    aria-hidden="true"
                                  />
                                )}
                                <span>{finding.title}</span>
                              </div>
                              <span
                                className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                                  isRisk
                                    ? 'text-amber-300'
                                    : isAlreadyIncluded
                                      ? 'text-emerald-300'
                                      : 'text-[#FF6B4A]'
                                }`}
                              >
                                {isRisk
                                  ? 'Риск'
                                  : isAlreadyIncluded
                                    ? 'Уже в тексте · 0 с'
                                    : `+${finding.extraSeconds} с`}
                              </span>
                            </div>

                            <p className="text-[11px] text-white/56">
                              {finding.legalNorm} · найдено в тексте: «
                              {finding.matchedExcerpt}»
                            </p>
                            <p className="text-xs text-white/76 leading-relaxed">
                              {finding.explanation}
                            </p>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* Готовый объединённый шаблон сноски */}
                  {report.combinedSampleDisclaimer && (
                    <div className="rounded-2xl p-3.5 bg-black/35 border border-white/10 space-y-2">
                      <p className="text-[11px] font-medium text-white/56">
                        Образец обязательной голосовой сноски для записи:
                      </p>
                      <p className="text-xs text-white/90 italic leading-relaxed">
                        «{report.combinedSampleDisclaimer}»
                      </p>
                      <label className="pt-1 inline-flex items-center gap-2 cursor-pointer text-xs text-white/82">
                        <input
                          type="checkbox"
                          checked={includeDisclaimerInTransfer}
                          onChange={(e) =>
                            setIncludeDisclaimerInTransfer(e.target.checked)
                          }
                          className="w-4 h-4 accent-[#FF4820] cursor-pointer"
                        />
                        <span>Приложить шаблон сноски к заявке</span>
                      </label>
                    </div>
                  )}
                </motion.div>
            </div>

            {/* Перенос расчёта в заявку */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                data-testid="public-chrono-transfer-order-btn"
                onClick={handleTransferToOrder}
                className="w-full min-h-[48px] px-5 py-3 rounded-full bg-[#F4F3EF] hover:bg-white text-[#111111] text-sm font-semibold inline-flex items-center justify-center gap-2 text-center transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  Перенести расчёт ({report.recommendedSlotSec} с) в заявку
                </span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
              <p className="text-[11px] text-center text-white/54">
                Подходящий тариф:{' '}
                {report.recommendedFormatId === 'voice_style'
                  ? 'По готовому тексту — 15 000 ₽ (24–48 ч)'
                  : 'Под ключ со сценарием — 25 000 ₽ (3–4 дня)'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
