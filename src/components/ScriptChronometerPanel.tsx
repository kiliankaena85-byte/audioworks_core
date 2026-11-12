import { Check, Clock, RotateCcw } from 'lucide-react';
import {
  calculateScriptChronometer,
  CHRONOMETER_SAMPLE_SCRIPTS,
  LEGAL_DISCLAIMER_OPTIONS,
  LegalDisclaimerId,
  SCRIPT_TEMPO_OPTIONS,
  ScriptTempoId,
} from '../data/scriptChronometer';

interface ScriptChronometerPanelProps {
  isOpen: boolean;
  scriptText: string;
  tempo: ScriptTempoId;
  disclaimer: LegalDisclaimerId;
  activeSpotSeconds: number;
  onChangeScriptText: (text: string) => void;
  onChangeTempo: (tempo: ScriptTempoId) => void;
  onChangeDisclaimer: (disclaimer: LegalDisclaimerId) => void;
  onApplySeconds: (seconds: number) => void;
}

export function ScriptChronometerPanel({
  isOpen,
  scriptText,
  tempo,
  disclaimer,
  activeSpotSeconds,
  onChangeScriptText,
  onChangeTempo,
  onChangeDisclaimer,
  onApplySeconds,
}: ScriptChronometerPanelProps) {
  if (!isOpen) return null;

  const metrics = calculateScriptChronometer({
    text: scriptText,
    tempo,
    disclaimer,
  });

  const hasText = scriptText.trim().length > 0;
  const isAlreadyApplied = hasText && activeSpotSeconds === metrics.recommendedSeconds;

  return (
    <div
      data-testid="script-chronometer-panel"
      className="mt-3 rounded-2xl p-4 sm:p-5 bg-[#F7F6F2] dark:bg-[#111115] border border-[#111111]/12 dark:border-white/12 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
            Хронометр текста сценария
          </p>
          <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
            Учитывает длину слов по слогам, номера телефонов, паузы и юридические сноски
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {CHRONOMETER_SAMPLE_SCRIPTS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => {
                onChangeScriptText(sample.text);
                onChangeTempo(sample.tempo);
                onChangeDisclaimer(sample.disclaimer);
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#EFECE5] dark:bg-[#1B1B21] hover:bg-[#111111]/10 dark:hover:bg-white/12 text-[#111111]/80 dark:text-[#F4F3EF]/80 transition-colors cursor-pointer whitespace-nowrap"
            >
              {sample.label}
            </button>
          ))}
          {hasText && (
            <button
              type="button"
              onClick={() => onChangeScriptText('')}
              aria-label="Очистить текст хронометра"
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#111111]/60 dark:text-[#F4F3EF]/60 hover:text-[#111111] dark:hover:text-white inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Очистить</span>
            </button>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="chronometer-script-textarea"
          className="sr-only"
        >
          Черновик рекламного текста для расчёта секунд
        </label>
        <textarea
          id="chronometer-script-textarea"
          data-testid="chronometer-textarea"
          rows={3}
          value={scriptText}
          onChange={(e) => onChangeScriptText(e.target.value)}
          placeholder="Вставьте набросок текста ролика, оффер и телефон — мы посчитаем точное число секунд дикторского чтения..."
          className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-white dark:bg-[#17171D] border border-[#111111]/14 dark:border-white/14 text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/42 dark:placeholder:text-white/38 focus:outline-none focus:border-[#FF4820] transition-colors resize-y"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Темп чтения диктора */}
        <div className="space-y-1.5">
          <span className="block text-[11px] font-semibold text-[#111111]/65 dark:text-[#F4F3EF]/65">
            Темп подачи диктора
          </span>
          <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-[#EFECE5] dark:bg-[#191920]">
            {SCRIPT_TEMPO_OPTIONS.map((opt) => {
              const active = tempo === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeTempo(opt.id)}
                  className={`flex-1 min-w-[110px] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-[#262630] text-[#111111] dark:text-white shadow-xs font-semibold'
                      : 'text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Обязательный юридический дисклеймер */}
        <div className="space-y-1.5">
          <span className="block text-[11px] font-semibold text-[#111111]/65 dark:text-[#F4F3EF]/65">
            Юридический дисклеймер (ФЗ «О рекламе»)
          </span>
          <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-[#EFECE5] dark:bg-[#191920]">
            {LEGAL_DISCLAIMER_OPTIONS.map((opt) => {
              const active = disclaimer === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeDisclaimer(opt.id)}
                  className={`flex-1 min-w-[105px] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-[#262630] text-[#111111] dark:text-white shadow-xs font-semibold'
                      : 'text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Живая сводка расчёта и кнопка применения точного хронометража */}
      <div className="pt-3 border-t border-[#111111]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 tabular-nums">
        <div className="space-y-1">
          {hasText ? (
            <>
              <div className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>Слов: <strong>{metrics.rawWordCount}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Слогов: <strong>{metrics.syllableCount}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Диктор: <strong>{metrics.spokenSecondsExact} сек</strong></span>
                {metrics.disclaimerSeconds > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Дисклеймер: <strong>+{metrics.disclaimerSeconds} сек</strong></span>
                  </>
                )}
              </div>
              <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
                {metrics.pacingAdvice}
              </p>
            </>
          ) : (
            <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
              {metrics.pacingAdvice}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {hasText && (
            <div className="text-right">
              <span className="block text-[11px] text-[#111111]/55 dark:text-[#F4F3EF]/55">
                Точный метраж
              </span>
              <span
                data-testid="chronometer-calculated-seconds"
                className="text-lg font-bold text-[#111111] dark:text-white"
              >
                {metrics.recommendedSeconds} сек
              </span>
            </div>
          )}

          <button
            type="button"
            disabled={!hasText}
            data-testid="chronometer-apply-btn"
            onClick={() => onApplySeconds(metrics.recommendedSeconds)}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              !hasText
                ? 'bg-[#111111]/10 dark:bg-white/10 text-[#111111]/40 dark:text-white/35 cursor-not-allowed'
                : isAlreadyApplied
                  ? 'bg-[#111111] dark:bg-[#F4F3EF] text-[#F7F6F2] dark:text-[#111111] cursor-pointer'
                  : 'bg-[#FF4820] hover:bg-[#E63C17] text-white cursor-pointer'
            }`}
          >
            {isAlreadyApplied ? (
              <>
                <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Применено ({metrics.recommendedSeconds} сек)</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {hasText
                    ? `Применить ${metrics.recommendedSeconds} сек к сетке`
                    : 'Введите текст сценария'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
