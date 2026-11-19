import { ArrowRight, Check, Clock, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  buildChronometerBriefTransferText,
  CHARACTER_COUNT_PRESETS,
  type CharacterCountMode,
  CLIENT_CHRONOMETER_SAMPLES,
  CLIENT_FZ38_SELECTOR_OPTIONS,
  type ClientFz38CategorySelection,
  type ClientScriptFz38Evaluation,
  evaluateCharacterCountChronometer,
  evaluateClientScriptAndFz38,
  getRecommendedCharRangesForTempo,
  SCRIPT_TEMPO_OPTIONS,
  type ScriptTempoId,
} from '../data/clientChronometerAndFz38';
import type { IndustryVerticalSlug } from '../data/platformRouter';
import type { OrderFormatId } from '../data/pricingData';

const QUICK_SLOT_BUTTONS = [10, 15, 20, 30, 45] as const;

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

export function ClientChronometerFz38Section(
  props: ClientChronometerFz38SectionProps
) {
  const [inputMode, setInputMode] = useState<'chars' | 'text'>('chars');
  const [charCountDraft, setCharCountDraft] = useState<number>(250);
  const [charCountMode, setCharCountMode] =
    useState<CharacterCountMode>('with_spaces');
  const [localText, setLocalText] = useState<string>(
    CLIENT_CHRONOMETER_SAMPLES[0]?.text ?? ''
  );
  const [tempo, setTempo] = useState<ScriptTempoId>('business_standard');
  const [categorySelection, setCategorySelection] =
    useState<ClientFz38CategorySelection>('auto');
  const [localSlotSec, setLocalSlotSec] = useState<number>(20);
  const [includeDisclaimerInTransfer, setIncludeDisclaimerInTransfer] =
    useState<boolean>(true);
  const [isInlineExpanded, setIsInlineExpanded] = useState<boolean>(false);

  const activeText =
    props.mode === 'inline_order' ? props.briefText : localText;
  const activeSlotSec =
    props.mode === 'inline_order' ? props.spotDurationSec : localSlotSec;

  const evaluation = useMemo(() => {
    if (props.mode !== 'inline_order' && inputMode === 'chars') {
      return evaluateCharacterCountChronometer({
        charCount: charCountDraft,
        countMode: charCountMode,
        tempo,
        categorySelection,
        targetSlotSec: activeSlotSec,
      });
    }
    return evaluateClientScriptAndFz38({
      text: activeText,
      tempo,
      categorySelection,
      targetSlotSec: activeSlotSec,
    });
  }, [
    props.mode,
    inputMode,
    charCountDraft,
    charCountMode,
    activeText,
    tempo,
    categorySelection,
    activeSlotSec,
  ]);

  const tempoCharRanges = useMemo(
    () =>
      getRecommendedCharRangesForTempo({
        tempo,
        countMode: charCountMode,
        disclaimerSec: evaluation.disclaimerRequiredSec,
      }),
    [tempo, charCountMode, evaluation.disclaimerRequiredSec]
  );

  if (props.mode === 'inline_order') {
    const hasDisclaimer = Boolean(evaluation.categorySpec.sampleDisclaimerText);
    const alreadyHasSample =
      hasDisclaimer &&
      props.briefText
        .toLowerCase()
        .includes(
          evaluation.categorySpec.sampleDisclaimerText.slice(0, 18).toLowerCase()
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
                  value={tempo}
                  onChange={(e) => setTempo(e.target.value as ScriptTempoId)}
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
                  value={categorySelection}
                  onChange={(e) =>
                    setCategorySelection(
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

  const handleTransferToOrder = () => {
    const modeLabel =
      charCountMode === 'without_spaces' ? 'без пробелов' : 'с пробелами';
    const briefText = buildChronometerBriefTransferText({
      scriptText: inputMode === 'text' ? localText : '',
      charCountModeNote:
        inputMode === 'chars'
          ? `Ориентировочный объём сценария: ${charCountDraft} знаков (${modeLabel}), примерный хронометраж ~${evaluation.totalExactSec} сек.`
          : undefined,
      evaluation,
      includeSampleDisclaimer: includeDisclaimerInTransfer,
    });
    const targetSec =
      evaluation.fitStatus === 'overflow'
        ? evaluation.recommendedSpotSec
        : localSlotSec;
    props.onApplyToOrder({
      formatId: evaluation.recommendedFormatId,
      spotDurationSec: targetSec,
      industryPreset: evaluation.categorySpec.mappedIndustryPreset,
      briefText,
    });
  };

  const handleSwitchInputMode = (nextMode: 'chars' | 'text') => {
    if (nextMode === 'chars' && inputMode === 'text' && localText.trim().length > 0) {
      const textEval = evaluateClientScriptAndFz38({
        text: localText,
        tempo,
        categorySelection,
        targetSlotSec: localSlotSec,
      });
      setCharCountDraft(
        charCountMode === 'without_spaces'
          ? textEval.charCountWithoutSpaces
          : textEval.charCountWithSpaces
      );
    }
    setInputMode(nextMode);
  };

  const activeDisplayChars =
    charCountMode === 'without_spaces'
      ? evaluation.charCountWithoutSpaces
      : evaluation.charCountWithSpaces;
  const activeMaxSlotChars =
    charCountMode === 'without_spaces'
      ? evaluation.creativeMaxCharsWithoutSpaces
      : evaluation.creativeMaxCharsWithSpaces;
  const activeCharModeSuffix =
    charCountMode === 'without_spaces' ? 'без пробелов' : 'с пробелами';

  return (
    <section
      id="script-chronometer"
      data-testid="pricing-chronometer-fz38-section"
      aria-labelledby="chronometer-fz38-heading"
      className="scroll-mt-24 py-16 sm:py-24 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 px-4 sm:px-6 lg:px-12"
    >
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="max-w-3xl space-y-3">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
            <span>Калькулятор хронометража</span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span className="tabular-nums">По количеству знаков и тексту сценария</span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span>Точность до 0,1 сек</span>
          </div>

          <h2
            id="chronometer-fz38-heading"
            className="text-2xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
          >
            Калькулятор хронометража аудиоролика по знакам и тексту.
          </h2>
          <p className="text-sm sm:text-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 editorial-pretty">
            Укажите количество знаков в тексте сценария или вставьте готовый черновик —
            калькулятор сразу покажет примерный хронометраж ролика с учётом темпа
            диктора и обязательной сноски по ФЗ-38.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Левая колонка: выбор режима (по знакам / по тексту), темп и категория ФЗ-38 */}
          <div className="lg:col-span-7 rounded-3xl p-6 sm:p-8 bg-[#EFECE5]/75 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 space-y-6">
            {/* Переключатель режима расчёта */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Способ расчёта хронометража"
                className="inline-flex items-center p-1 rounded-2xl bg-[#E4E0D7] dark:bg-[#0D0D0F] border border-[#111111]/8 dark:border-white/10"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputMode === 'chars'}
                  data-testid="chrono-mode-chars"
                  onClick={() => handleSwitchInputMode('chars')}
                  className={`min-h-[38px] px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    inputMode === 'chars'
                      ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                      : 'text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:text-[#111111] dark:hover:text-white'
                  }`}
                >
                  По количеству знаков
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputMode === 'text'}
                  data-testid="chrono-mode-text"
                  onClick={() => handleSwitchInputMode('text')}
                  className={`min-h-[38px] px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    inputMode === 'text'
                      ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                      : 'text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:text-[#111111] dark:hover:text-white'
                  }`}
                >
                  По тексту сценария
                </button>
              </div>

              <span className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58 tabular-nums">
                {evaluation.charCountWithSpaces} зн. с пробелами ·{' '}
                {evaluation.charCountWithoutSpaces} без пробелов
              </span>
            </div>

            {inputMode === 'chars' ? (
              <div
                data-testid="chrono-char-calculator-panel"
                className="space-y-4 tabular-nums"
              >
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <label
                      htmlFor="chrono-char-count-input"
                      className="block text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]"
                    >
                      Количество знаков в сценарии
                    </label>
                    <div className="flex items-center gap-2.5">
                      <input
                        id="chrono-char-count-input"
                        data-testid="chrono-char-count-input"
                        type="number"
                        min={0}
                        max={2500}
                        step={10}
                        value={charCountDraft}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          setCharCountDraft(
                            Number.isFinite(raw)
                              ? Math.max(0, Math.min(2500, Math.round(raw)))
                              : 0
                          );
                        }}
                        className="w-36 min-h-[46px] px-3.5 rounded-2xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/16 dark:border-white/16 text-xl font-bold text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                      />
                      <span className="text-xs sm:text-sm text-[#111111]/64 dark:text-[#F4F3EF]/64">
                        знаков (~{evaluation.wordCount} сл.)
                      </span>
                    </div>
                  </div>

                  <div
                    role="group"
                    aria-label="Учёт пробелов в подсчёте знаков"
                    className="inline-flex items-center p-1 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 self-start sm:self-end"
                  >
                    <button
                      type="button"
                      data-testid="chrono-char-mode-with-spaces"
                      aria-pressed={charCountMode === 'with_spaces'}
                      onClick={() => setCharCountMode('with_spaces')}
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
                      onClick={() => setCharCountMode('without_spaces')}
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

                {/* Ползунок количества знаков */}
                <div className="space-y-2 pt-1">
                  <label htmlFor="chrono-char-count-slider" className="sr-only">
                    Ползунок количества знаков сценария
                  </label>
                  <input
                    id="chrono-char-count-slider"
                    data-testid="chrono-char-count-slider"
                    type="range"
                    min={0}
                    max={900}
                    step={10}
                    value={Math.min(900, charCountDraft)}
                    onChange={(e) => setCharCountDraft(Number(e.target.value))}
                    className="w-full h-2 rounded-full accent-[#FF4820] cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[11px] text-[#111111]/52 dark:text-[#F4F3EF]/52">
                    <span>0</span>
                    <span>150</span>
                    <span>300</span>
                    <span>450</span>
                    <span>600</span>
                    <span>900+ зн.</span>
                  </div>
                </div>

                {/* Быстрые ориентиры по объёму */}
                <div
                  role="group"
                  aria-label="Типовой объём сценария в знаках"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {CHARACTER_COUNT_PRESETS.map((preset) => {
                    const isSelected = charCountDraft === preset.chars;
                    return (
                      <button
                        key={preset.chars}
                        type="button"
                        data-testid={`chrono-char-preset-${preset.chars}`}
                        aria-pressed={isSelected}
                        onClick={() => setCharCountDraft(preset.chars)}
                        className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          isSelected
                            ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                            : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/80 dark:text-[#F4F3EF]/80 border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                        }`}
                      >
                        {preset.label}{' '}
                        <span className="opacity-65">{preset.approxSlotHint}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Динамическая памятка: сколько знаков помещается в стандартные слоты при выбранном темпе */}
                <div className="pt-3 border-t border-[#111111]/10 dark:border-white/10 space-y-2">
                  <p className="text-[11px] font-semibold text-[#111111]/62 dark:text-[#F4F3EF]/62">
                    Ориентир объёма для выбранного темпа ({activeCharModeSuffix}
                    {evaluation.disclaimerRequiredSec > 0
                      ? `, с учётом сноски ${evaluation.disclaimerRequiredSec} с`
                      : ''}
                    ) — нажмите, чтобы подставить слот:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                    {tempoCharRanges.map((item) => {
                      const isActiveSlot = localSlotSec === item.slotSec;
                      return (
                        <button
                          key={item.slotSec}
                          type="button"
                          data-testid={`chrono-ref-slot-${item.slotSec}`}
                          onClick={() => {
                            setLocalSlotSec(item.slotSec);
                            setCharCountDraft(item.maxChars);
                          }}
                          className={`p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                            isActiveSlot
                              ? 'bg-[#FF4820]/10 border-[#FF4820] text-[#111111] dark:text-[#F4F3EF]'
                              : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] border-[#111111]/10 dark:border-white/10 hover:border-[#FF4820] text-[#111111] dark:text-[#F4F3EF]'
                          }`}
                        >
                          <span className="block text-[11px] font-bold text-[#FF4820]">
                            {item.slotSec} сек
                          </span>
                          <span className="block text-xs font-semibold mt-0.5">
                            до {item.maxChars} зн.
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="public-chronometer-textarea"
                    className="text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]"
                  >
                    Текст ролика или черновик оффера
                  </label>
                  <span className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56 tabular-nums">
                    {evaluation.wordCount} сл. · {evaluation.syllableCount} слогов
                    {evaluation.digitGroupsCount > 0
                      ? ` · числ. групп: ${evaluation.digitGroupsCount}`
                      : ''}
                  </span>
                </div>

                <div
                  role="group"
                  aria-label="Готовые примеры текстов по отраслям"
                  className="flex flex-wrap items-center gap-1.5 pb-1"
                >
                  {CLIENT_CHRONOMETER_SAMPLES.map((sample) => {
                    const isCurrent = localText.trim() === sample.text.trim();
                    return (
                      <button
                        key={sample.id}
                        type="button"
                        data-testid={`chrono-sample-${sample.id}`}
                        onClick={() => {
                          setLocalText(sample.text);
                          setTempo(sample.tempo);
                          setCategorySelection(sample.category);
                          setLocalSlotSec(sample.targetSlotSec);
                        }}
                        aria-pressed={isCurrent}
                        className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          isCurrent
                            ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                            : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/78 dark:text-[#F4F3EF]/78 border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                        }`}
                      >
                        {sample.label}
                      </button>
                    );
                  })}
                  {localText.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => setLocalText('')}
                      className="min-h-[34px] px-2.5 py-1 text-xs font-medium text-[#111111]/56 dark:text-[#F4F3EF]/56 hover:text-[#FF4820] cursor-pointer whitespace-nowrap"
                    >
                      Очистить
                    </button>
                  )}
                </div>

                <textarea
                  id="public-chronometer-textarea"
                  data-testid="public-chronometer-textarea"
                  rows={4}
                  value={localText}
                  onChange={(e) => setLocalText(e.target.value)}
                  placeholder="Вставьте готовый сценарий или тезисы рекламной акции с телефоном и сайтом…"
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-[#F4F3EF]/42 focus:outline-none focus:border-[#FF4820] leading-relaxed"
                />
              </div>
            )}

            {/* Выбор темпа подачи */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#111111]/68 dark:text-[#F4F3EF]/68">
                1. Темп актёрской подачи
              </p>
              <div
                role="group"
                aria-label="Темп актёрской подачи"
                className="grid grid-cols-1 sm:grid-cols-3 gap-2"
              >
                {SCRIPT_TEMPO_OPTIONS.map((opt) => {
                  const isSelected = tempo === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      data-testid={`chrono-tempo-${opt.id}`}
                      aria-pressed={isSelected}
                      onClick={() => setTempo(opt.id)}
                      className={`p-3 rounded-2xl border text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                          : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111] dark:text-[#F4F3EF] border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs font-bold tabular-nums">
                        <span className="leading-snug">{opt.label}</span>
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
            </div>

            {/* Выбор отраслевой нормы ФЗ-38 */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="public-chrono-category-select"
                  className="text-xs font-semibold text-[#111111]/68 dark:text-[#F4F3EF]/68"
                >
                  2. Рубрика по Федеральному закону «О рекламе» № 38-ФЗ
                </label>
                {evaluation.isAutoDetected && evaluation.wordCount > 0 && (
                  <span className="text-xs font-medium text-[#FF4820]">
                    Определено по тексту: {evaluation.categorySpec.shortLabel}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CLIENT_FZ38_SELECTOR_OPTIONS.filter(
                  (opt) => !(inputMode === 'chars' && opt.id === 'auto')
                ).map((opt) => {
                  const isSelected =
                    inputMode === 'chars'
                      ? evaluation.resolvedCategory === opt.id
                      : categorySelection === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      data-testid={`chrono-fz38-${opt.id}`}
                      aria-pressed={isSelected}
                      onClick={() => setCategorySelection(opt.id)}
                      className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#FF4820] text-white border-[#FF4820]'
                          : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/84 dark:text-[#F4F3EF]/84 border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      <span className="tabular-nums opacity-85 shrink-0">
                        {opt.badgeSec}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Правая колонка: вердикт по секундам, шаблон сноски и 1-клик перенос в заказ */}
          <div className="lg:col-span-5 rounded-3xl p-6 sm:p-8 bg-[#141418] text-[#F4F3EF] border border-white/10 space-y-6 tabular-nums">
            <div className="flex items-start justify-between gap-4 pb-5 border-b border-white/10">
              <div>
                <p className="text-xs font-medium text-white/60">
                  Итоговое звучание ролика
                </p>
                <div
                  data-testid="public-chrono-total-sec"
                  className="text-4xl sm:text-5xl font-bold tracking-tight text-white mt-1"
                >
                  {evaluation.totalExactSec}{' '}
                  <span className="text-lg sm:text-xl font-semibold text-white/65">
                    сек
                  </span>
                </div>
                <p className="text-xs text-white/62 mt-1.5">
                  Речь диктора: {evaluation.spokenCreativeSec} с · Сноска ФЗ-38:{' '}
                  {evaluation.disclaimerRequiredSec} с
                </p>
                <p
                  data-testid="public-chrono-char-capacity"
                  className="text-xs text-white/75 mt-1"
                >
                  {activeDisplayChars} зн. ({activeCharModeSuffix}) · лимит слота{' '}
                  {localSlotSec} с: до ~{activeMaxSlotChars} зн.
                </p>
              </div>

              <div className="text-right space-y-1">
                <p className="text-xs text-white/60">Целевой слот эфира</p>
                <div className="flex flex-wrap justify-end gap-1">
                  {QUICK_SLOT_BUTTONS.map((sec) => {
                    const active = localSlotSec === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        data-testid={`chrono-slot-${sec}`}
                        aria-pressed={active}
                        onClick={() => setLocalSlotSec(sec)}
                        className={`min-h-[32px] px-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#FF4820] text-white border-[#FF4820]'
                            : 'bg-white/6 text-white/75 border-white/14 hover:border-white/40'
                        }`}
                      >
                        {sec}с
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Пропорциональная шкала распределения слота */}
            <div className="space-y-2">
              <div
                aria-hidden="true"
                className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden flex"
              >
                <div
                  style={{ width: `${evaluation.creativeSharePct}%` }}
                  className="bg-white transition-all duration-200"
                />
                {evaluation.disclaimerSharePct > 0 && (
                  <div
                    style={{ width: `${evaluation.disclaimerSharePct}%` }}
                    className="bg-[#FF4820] transition-all duration-200"
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/64">
                <span>Основной текст ({evaluation.spokenCreativeSec} с)</span>
                <span>Сноска ФЗ-38 ({evaluation.disclaimerRequiredSec} с)</span>
                <span>
                  Рекомендуемый слот: {evaluation.nearestStandardSlotSec} с
                </span>
              </div>
            </div>

            {/* Вердикт посадки */}
            <div className="rounded-2xl p-4 bg-white/[0.05] border border-white/10 space-y-2">
              <p
                data-testid="public-chrono-fit-headline"
                className={`text-sm font-bold ${
                  evaluation.fitStatus === 'overflow'
                    ? 'text-[#FF6B4A]'
                    : evaluation.fitStatus === 'fits_tightly'
                      ? 'text-amber-300'
                      : 'text-emerald-400'
                }`}
              >
                {evaluation.fitHeadline}
              </p>
              <p className="text-xs text-white/76 leading-relaxed">
                {evaluation.fitAdvice}
              </p>
            </div>

            {/* Юридическая справка и шаблон обязательной сноски */}
            <div className="space-y-2.5 pt-1 border-t border-white/10 text-xs">
              <div className="flex items-center gap-2 text-white/88 font-semibold">
                <ShieldCheck
                  className="w-4 h-4 text-[#FF4820] shrink-0"
                  aria-hidden="true"
                />
                <span>
                  {evaluation.categorySpec.shortLabel} ·{' '}
                  {evaluation.categorySpec.legalNorm}
                </span>
              </div>
              <p className="text-white/66 leading-relaxed">
                {evaluation.categorySpec.moderationRuleNote}
              </p>

              {evaluation.categorySpec.sampleDisclaimerText && (
                <div className="rounded-xl p-3 bg-black/35 border border-white/10 space-y-2">
                  <p className="text-[11px] text-white/56">
                    Образец обязательной голосовой сноски:
                  </p>
                  <p className="text-xs text-white/90 italic leading-relaxed">
                    «{evaluation.categorySpec.sampleDisclaimerText}»
                  </p>
                  <label className="pt-1 inline-flex items-center gap-2 cursor-pointer text-xs text-white/85">
                    <input
                      type="checkbox"
                      checked={includeDisclaimerInTransfer}
                      onChange={(e) =>
                        setIncludeDisclaimerInTransfer(e.target.checked)
                      }
                      className="w-4 h-4 accent-[#FF4820] cursor-pointer"
                    />
                    <span>Приложить шаблон сноски к тексту заявки</span>
                  </label>
                </div>
              )}
            </div>

            {/* Единственный главный CTA переноса в заказ */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                data-testid="public-chrono-transfer-order-btn"
                onClick={handleTransferToOrder}
                className="w-full min-h-[48px] px-5 py-3 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  Перенести текст и метраж (
                  {evaluation.fitStatus === 'overflow'
                    ? evaluation.recommendedSpotSec
                    : localSlotSec}{' '}
                  сек) в заявку
                </span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
              <p className="text-[11px] text-center text-white/54">
                Рекомендуемый тариф:{' '}
                {evaluation.recommendedFormatId === 'voice_style'
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
