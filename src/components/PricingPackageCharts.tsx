import {
  ArrowRight,
  Clock,
  Layers,
  Timer,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { OrderFormatId } from '../data/pricingData';
import {
  buildRadarPolygonPoints,
  computeChronometryStructureForPackage,
  getPricingPackageVisualSpec,
  PRICING_PACKAGE_VISUAL_SPECS,
  type PricingChartDimension,
  SUPPORTED_SPOT_DURATIONS_SEC,
  type SupportedSpotDurationSec,
  type VisualPackageId,
} from '../data/pricingPackageVisuals';
import { formatRubCompact } from '../data/radioInventory';

interface PricingPackageChartsProps {
  onSelectFormat: (formatId: OrderFormatId) => void;
}

const DIMENSION_TABS: ReadonlyArray<{
  id: PricingChartDimension;
  label: string;
}> = [
  { id: 'overview', label: 'Все 3 параметра' },
  { id: 'chronometry', label: 'Хронометраж (15–30 сек)' },
  { id: 'complexity', label: 'Сложность и наполнение' },
  { id: 'timeline', label: 'Сроки и этапы' },
];

const SEGMENT_COLORS: Record<'hook' | 'offer' | 'cta' | 'disclaimer', string> = {
  hook: 'bg-[#FF4820]',
  offer: 'bg-[#111111] dark:bg-[#F4F3EF]',
  cta: 'bg-[#16A34A] dark:bg-[#4ADE80]',
  disclaimer: 'bg-[#D97706] dark:bg-[#FBBF24]',
};

const SEGMENT_DOT_COLORS: Record<
  'hook' | 'offer' | 'cta' | 'disclaimer',
  string
> = {
  hook: 'bg-[#FF4820]',
  offer: 'bg-[#111111] dark:bg-[#F4F3EF]',
  cta: 'bg-[#16A34A] dark:bg-[#4ADE80]',
  disclaimer: 'bg-[#D97706] dark:bg-[#FBBF24]',
};

const PHASE_BAR_COLORS: Record<
  'script' | 'recording' | 'mixing' | 'clearance',
  string
> = {
  script: 'bg-[#FF4820]',
  recording: 'bg-[#111111] dark:bg-[#F4F3EF]',
  mixing: 'bg-[#2563EB] dark:bg-[#60A5FA]',
  clearance: 'bg-[#16A34A] dark:bg-[#4ADE80]',
};

export function PricingPackageCharts({
  onSelectFormat,
}: PricingPackageChartsProps) {
  const [selectedPackageId, setSelectedPackageId] =
    useState<VisualPackageId>('turnkey');
  const [activeDimension, setActiveDimension] =
    useState<PricingChartDimension>('overview');
  const [targetDurationSec, setTargetDurationSec] =
    useState<SupportedSpotDurationSec>(20);
  const [includeDisclaimerFz38, setIncludeDisclaimerFz38] =
    useState<boolean>(true);
  const [comparePackageId, setComparePackageId] =
    useState<VisualPackageId>('voice_style');

  const activeSpec = useMemo(
    () => getPricingPackageVisualSpec(selectedPackageId),
    [selectedPackageId]
  );

  const compareSpec = useMemo(() => {
    const fallbackId: VisualPackageId =
      selectedPackageId === comparePackageId
        ? selectedPackageId === 'turnkey'
          ? 'cinema'
          : 'turnkey'
        : comparePackageId;
    return getPricingPackageVisualSpec(fallbackId);
  }, [comparePackageId, selectedPackageId]);

  const chronometrySim = useMemo(
    () =>
      computeChronometryStructureForPackage(
        selectedPackageId,
        targetDurationSec,
        includeDisclaimerFz38
      ),
    [includeDisclaimerFz38, selectedPackageId, targetDurationSec]
  );

  const activeRadar = useMemo(
    () => buildRadarPolygonPoints(activeSpec.complexity.axes, 110, 74),
    [activeSpec]
  );

  const compareRadar = useMemo(
    () => buildRadarPolygonPoints(compareSpec.complexity.axes, 110, 74),
    [compareSpec]
  );

  const showChronometryChart =
    activeDimension === 'overview' || activeDimension === 'chronometry';
  const showComplexityChart =
    activeDimension === 'overview' || activeDimension === 'complexity';
  const showTimelineChart =
    activeDimension === 'overview' || activeDimension === 'timeline';

  const handleSelectPackageCard = (pkgId: VisualPackageId) => {
    if (pkgId !== selectedPackageId) {
      setComparePackageId(selectedPackageId);
      setSelectedPackageId(pkgId);
    }
  };

  return (
    <section
      id="pricing-visual-charts"
      data-testid="pricing-package-charts-section"
      aria-labelledby="pricing-visual-charts-heading"
      className="scroll-mt-24 py-16 sm:py-24 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 px-4 sm:px-6 lg:px-12"
    >
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Заголовок секции и переключатель осей визуализации */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58 tabular-nums">
              <span>Интерактивная аналитика тарифов</span>
              <span aria-hidden="true">·</span>
              <span>Хронометраж · Сложность · Сроки</span>
            </div>
            <h2
              id="pricing-visual-charts-heading"
              className="text-2xl sm:text-4xl font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
            >
              Наглядная разница в наполнении пакетов: из чего складываются секунды, глубина продакшна и часы выпуска.
            </h2>
            <p className="text-sm sm:text-base text-[#111111]/68 dark:text-[#F4F3EF]/68 leading-relaxed">
              Переключайте тарифы и хронометраж ролика, чтобы сравнить распределение эфирных секунд, глубину проработки сценария и поэтапный график производства.
            </p>
          </div>

          <div
            role="group"
            aria-label="Режим отображения графиков тарифов"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-[#EFECE5]/80 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 self-start"
          >
            {DIMENSION_TABS.map((tab) => {
              const isActive = activeDimension === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={isActive}
                  data-testid={`pricing-chart-dimension-${tab.id}`}
                  onClick={() => setActiveDimension(tab.id)}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                      : 'text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Интерактивная матрица выбора пакета со сравнительными мини-индикаторами 3 параметров */}
        <div
          role="region"
          aria-label="Выбор ценового пакета для интерактивного сравнения"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {PRICING_PACKAGE_VISUAL_SPECS.map((spec) => {
            const isSelected = spec.id === selectedPackageId;
            return (
              <div
                key={spec.id}
                data-testid={`pricing-chart-pkg-card-${spec.id}`}
                data-selected={isSelected ? 'true' : 'false'}
                onClick={() => handleSelectPackageCard(spec.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectPackageCard(spec.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                className={`rounded-2xl p-5 text-left transition-all cursor-pointer border flex flex-col justify-between gap-4 ${
                  isSelected
                    ? 'bg-white dark:bg-[#18181F] border-[#FF4820] ring-1 ring-[#FF4820]/40'
                    : 'bg-[#EFECE5]/55 dark:bg-[#141418] border-[#111111]/10 dark:border-white/10 hover:border-[#111111]/30 dark:hover:border-white/25'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold tabular-nums">
                    <span
                      className={
                        isSelected
                          ? 'text-[#FF4820]'
                          : 'text-[#111111]/58 dark:text-[#F4F3EF]/58'
                      }
                    >
                      {spec.turnaroundLabel}
                    </span>
                    <span className="text-[#111111] dark:text-[#F4F3EF] font-bold">
                      {spec.priceFormatted}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                    {spec.shortTitle}
                  </h3>
                  <p className="text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62">
                    {spec.subtitle}
                  </p>
                </div>

                {/* Мини-графики 3 осей: Хронометраж · Сложность · Скорость */}
                <div className="space-y-2 pt-2 border-t border-[#111111]/8 dark:border-white/8 text-[11px] tabular-nums">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[#111111]/68 dark:text-[#F4F3EF]/68">
                      <span>Охват хронометража</span>
                      <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                        {spec.chronometry.maxSec} сек
                        {spec.chronometry.includes15sResize ? ' + 15с' : ''}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#111111]/10 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#FF4820] transition-all"
                        style={{ width: `${spec.chronometry.chronometryScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[#111111]/68 dark:text-[#F4F3EF]/68">
                      <span>Индекс наполнения</span>
                      <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                        {spec.complexity.overallScore} / 100
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#111111]/10 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#111111] dark:bg-[#F4F3EF] transition-all"
                        style={{ width: `${spec.complexity.overallScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[#111111]/68 dark:text-[#F4F3EF]/68">
                      <span>Оперативность сдачи</span>
                      <span className="font-semibold text-[#16A34A] dark:text-[#4ADE80]">
                        {spec.supportsUrgent1Hour
                          ? `от 1 ч / ${spec.turnaroundLabel}`
                          : spec.turnaroundLabel}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#111111]/10 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#16A34A] dark:bg-[#4ADE80] transition-all"
                        style={{ width: `${spec.timeline.speedScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ГРАФИК 1: Хронометраж, посекундная структура спота и цена 1 секунды готового ролика */}
        {showChronometryChart && (
          <div
            data-testid="pricing-chart-panel-chronometry"
            className="rounded-3xl p-6 sm:p-8 lg:p-10 bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 space-y-7"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#111111]/10 dark:border-white/10">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[#FF4820]">
                  <Timer className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>График 1 · Хронометраж и распределение секунд внутри ролика</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                  Посекундная анатомия спота ({targetDurationSec} сек) для пакета «{activeSpec.title}»
                </h3>
              </div>

              {/* Интерактивный селектор длительности (15 / 20 / 25 / 30 сек) + чекбокс ФЗ-38 */}
              <div className="flex flex-wrap items-center gap-3">
                <div
                  role="group"
                  aria-label="Целевой хронометраж ролика в секундах"
                  className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10"
                >
                  {SUPPORTED_SPOT_DURATIONS_SEC.map((sec) => {
                    const active = targetDurationSec === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        aria-pressed={active}
                        data-testid={`pricing-chart-duration-${sec}`}
                        onClick={() => setTargetDurationSec(sec)}
                        className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#FF4820] text-white'
                            : 'text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                        }`}
                      >
                        {sec} сек
                      </button>
                    );
                  })}
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#111111]/78 dark:text-[#F4F3EF]/78 cursor-pointer select-none min-h-[36px] px-3 py-1.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10">
                  <input
                    type="checkbox"
                    data-testid="pricing-chart-disclaimer-toggle"
                    checked={includeDisclaimerFz38}
                    onChange={(e) => setIncludeDisclaimerFz38(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-[#FF4820] shrink-0"
                  />
                  <span>Сноска ФЗ-38</span>
                </label>
              </div>
            </div>

            {/* Составная шкала хронометража выбранного пакета */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm tabular-nums">
                <span className="text-[#111111]/75 dark:text-[#F4F3EF]/75">
                  {chronometrySim.recommendedAdjustmentNote}
                </span>
                <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                  Ёмкость дикторского текста: ~{chronometrySim.wordsCapacityApprox} слов
                  {chronometrySim.pricePerSecondRub
                    ? ` · ${formatRubCompact(chronometrySim.pricePerSecondRub)}/сек`
                    : ' · Договорная смета'}
                </span>
              </div>

              {/* Интерактивная полоса распределения секунд */}
              <div
                data-testid="pricing-chart-chronometry-bar"
                className="h-10 w-full rounded-2xl overflow-hidden flex bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12 p-1 gap-1"
              >
                {chronometrySim.segments.map((seg) => (
                  <div
                    key={seg.id}
                    data-testid={`pricing-chart-segment-${seg.id}`}
                    style={{ width: `${Math.max(10, seg.sharePercent)}%` }}
                    className={`h-full rounded-xl ${SEGMENT_COLORS[seg.id]} flex items-center justify-center px-2 text-[11px] font-bold text-white dark:text-[#0D0D0F] first:text-white last:text-white tabular-nums transition-all overflow-hidden whitespace-nowrap`}
                    title={`${seg.label}: ${seg.seconds} сек (${seg.sharePercent}%)`}
                  >
                    <span>{seg.seconds}с</span>
                  </div>
                ))}
              </div>

              {/* Детализация 4 сегментов хронометража */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {chronometrySim.segments.map((seg) => (
                  <div
                    key={seg.id}
                    className="rounded-2xl p-4 bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/8 dark:border-white/8 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-bold tabular-nums text-[#111111] dark:text-[#F4F3EF]">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${SEGMENT_DOT_COLORS[seg.id]}`}
                          aria-hidden="true"
                        />
                        <span>{seg.seconds} сек</span>
                      </span>
                      <span className="text-[#111111]/55 dark:text-[#F4F3EF]/55">
                        {seg.sharePercent}%
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]">
                      {seg.label}
                    </p>
                    <p className="text-[11px] text-[#111111]/64 dark:text-[#F4F3EF]/64 leading-relaxed">
                      {seg.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Сравнительный график диапазонов хронометража и удельной цены секунды по всем 4 пакетам */}
            <div className="pt-5 border-t border-[#111111]/10 dark:border-white/10 space-y-3">
              <p className="text-xs font-semibold text-[#111111]/62 dark:text-[#F4F3EF]/62">
                Сравнение диапазона хронометража и стоимости 1 секунды готового ролика при длительности {targetDurationSec} сек:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {PRICING_PACKAGE_VISUAL_SPECS.map((spec) => {
                  const perSec =
                    spec.priceRub > 0
                      ? Math.round(spec.priceRub / targetDurationSec)
                      : null;
                  const active = spec.id === selectedPackageId;
                  return (
                    <button
                      key={spec.id}
                      type="button"
                      onClick={() => handleSelectPackageCard(spec.id)}
                      className={`rounded-xl p-3.5 text-left border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#FF4820]/8 border-[#FF4820]'
                          : 'bg-[#F7F6F2]/70 dark:bg-[#0D0D0F] border-[#111111]/10 dark:border-white/10 hover:border-[#111111]/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#111111] dark:text-[#F4F3EF] tabular-nums">
                        <span>{spec.shortTitle}</span>
                        <span className="text-[#FF4820]">
                          {perSec ? `${formatRubCompact(perSec)}/сек` : 'По ТЗ'}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#111111]/65 dark:text-[#F4F3EF]/65 tabular-nums">
                        Диапазон: {spec.chronometry.rangeLabel} · Версий в сдаче:{' '}
                        {spec.chronometry.includedVersionsCount}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ГРАФИК 2: Сложность и глубина наполнения (4-осевой SVG радар + столбчатые диаграммы) */}
        {showComplexityChart && (
          <div
            data-testid="pricing-chart-panel-complexity"
            className="rounded-3xl p-6 sm:p-8 lg:p-10 bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 space-y-7"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#111111]/10 dark:border-white/10">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[#FF4820]">
                  <Layers className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>График 2 · Сложность производства и состав пакета</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                  Профиль наполнения: «{activeSpec.title}» в сравнении с «{compareSpec.title}»
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[#111111]/60 dark:text-[#F4F3EF]/60">
                  Сравнить с пакетом:
                </span>
                {PRICING_PACKAGE_VISUAL_SPECS.filter(
                  (s) => s.id !== selectedPackageId
                ).map((s) => {
                  const isComp = compareSpec.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      data-testid={`pricing-chart-compare-with-${s.id}`}
                      onClick={() => setComparePackageId(s.id)}
                      className={`min-h-[32px] px-3 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        isComp
                          ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:border-[#F4F3EF]'
                          : 'bg-[#F7F6F2] dark:bg-[#0D0D0F] text-[#111111]/70 dark:text-[#F4F3EF]/70 border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820]'
                      }`}
                    >
                      {s.shortTitle}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Левая колонка: 4-осевой SVG радар сравнения двух пакетов */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center rounded-2xl p-5 bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10">
                <svg
                  viewBox="0 0 220 220"
                  role="img"
                  aria-label={`Радар сравнения наполнения пакета ${activeSpec.title} (${activeSpec.complexity.overallScore} из 100) и ${compareSpec.title} (${compareSpec.complexity.overallScore} из 100)`}
                  data-testid="pricing-complexity-radar-svg"
                  className="w-full max-w-[260px] h-auto overflow-visible"
                >
                  {/* Концентрические контуры сетки 33%, 66%, 100% */}
                  {[25, 50, 74].map((r) => (
                    <polygon
                      key={r}
                      points={`110,${110 - r} ${110 + r},110 110,${110 + r} ${110 - r},110`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      className="text-[#111111]/12 dark:text-white/14"
                    />
                  ))}
                  {/* Оси координат */}
                  <line
                    x1="110"
                    y1="36"
                    x2="110"
                    y2="184"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-[#111111]/12 dark:text-white/14"
                  />
                  <line
                    x1="36"
                    y1="110"
                    x2="184"
                    y2="110"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-[#111111]/12 dark:text-white/14"
                  />

                  {/* Многоугольник сравниваемого пакета (пунктирный контур) */}
                  <polygon
                    points={compareRadar.polygonPoints}
                    fill="currentColor"
                    fillOpacity="0.08"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    className="text-[#111111]/55 dark:text-[#F4F3EF]/55 transition-all duration-300"
                  />

                  {/* Многоугольник выбранного пакета (акцентный #FF4820) */}
                  <polygon
                    data-testid="pricing-radar-active-polygon"
                    points={activeRadar.polygonPoints}
                    fill="#FF4820"
                    fillOpacity="0.22"
                    stroke="#FF4820"
                    strokeWidth="2.5"
                    className="transition-all duration-300"
                  />

                  {/* Узлы и подписи 4 осей */}
                  {activeRadar.vertices.map((vertex) => (
                    <g key={vertex.id}>
                      <circle
                        cx={vertex.x}
                        cy={vertex.y}
                        r="4"
                        fill="#FF4820"
                      />
                      <text
                        x={vertex.labelX}
                        y={vertex.labelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#111111] dark:fill-[#F4F3EF] text-[9px] font-bold"
                      >
                        {vertex.shortLabel} ({vertex.score}%)
                      </text>
                    </g>
                  ))}
                </svg>

                {/* Легенда радара */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs tabular-nums">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#111111] dark:text-[#F4F3EF]">
                    <span className="w-3 h-3 rounded-sm bg-[#FF4820] inline-block" />
                    <span>
                      {activeSpec.shortTitle} ({activeSpec.complexity.overallScore}/100)
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#111111]/65 dark:text-[#F4F3EF]/65">
                    <span className="w-3 h-0.5 border-t-2 border-dashed border-[#111111]/60 dark:border-white/60 inline-block" />
                    <span>
                      {compareSpec.shortTitle} ({compareSpec.complexity.overallScore}/100)
                    </span>
                  </span>
                </div>
              </div>

              {/* Правая колонка: поосевые шкалы сложности и конкретное наполнение */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[#111111]/65 dark:text-[#F4F3EF]/65 tabular-nums">
                  <span>Уровень: {activeSpec.complexity.levelLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>Состав: {activeSpec.complexity.voicesCountLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Концепций сценария:{' '}
                    {activeSpec.complexity.scriptConceptsCount > 0
                      ? `${activeSpec.complexity.scriptConceptsCount} шт.`
                      : 'по готовому тексту'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Сервисный раунд доводки:{' '}
                    {activeSpec.complexity.includedServiceRevisions} вкл.
                  </span>
                </div>

                <div className="space-y-3.5">
                  {activeSpec.complexity.axes.map((axis, idx) => {
                    const compAxis = compareSpec.complexity.axes[idx];
                    const delta = axis.score - (compAxis?.score ?? 0);
                    return (
                      <div
                        key={axis.id}
                        data-testid={`pricing-complexity-axis-${axis.id}`}
                        className="rounded-2xl p-4 bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/8 dark:border-white/8 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                            {axis.label}
                          </span>
                          <span className="font-semibold tabular-nums text-[#111111]/72 dark:text-[#F4F3EF]/72">
                            {axis.score}%{' '}
                            {delta !== 0 && (
                              <span
                                className={
                                  delta > 0
                                    ? 'text-[#16A34A] dark:text-[#4ADE80]'
                                    : 'text-[#111111]/50 dark:text-[#F4F3EF]/50'
                                }
                              >
                                ({delta > 0 ? `+${delta}%` : `${delta}%`} к «{compareSpec.shortTitle}»)
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="relative h-2 w-full rounded-full bg-[#111111]/10 dark:bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#FF4820] transition-all duration-300"
                            style={{ width: `${axis.score}%` }}
                          />
                        </div>

                        <p className="text-xs text-[#111111]/70 dark:text-[#F4F3EF]/70 leading-relaxed">
                          {axis.deliverableSummary}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ГРАФИК 3: Сроки выпуска, диаграмма этапов (Gantt) и срочный заказ от 1 часа */}
        {showTimelineChart && (
          <div
            data-testid="pricing-chart-panel-timeline"
            className="rounded-3xl p-6 sm:p-8 lg:p-10 bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 space-y-7"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#111111]/10 dark:border-white/10">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[#FF4820]">
                  <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>График 3 · Сроки производства по этапам и срочный режим</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                  Сравнение длительности цикла (от 1 часа экспресс до 5 дней постановочного цикла)
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums text-[#111111]/68 dark:text-[#F4F3EF]/68">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF4820]" />
                  <span>Сценарий / Текст</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#111111] dark:bg-[#F4F3EF]" />
                  <span>Запись голосов</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] dark:bg-[#60A5FA]" />
                  <span>Сведение −14 LUFS</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] dark:bg-[#4ADE80]" />
                  <span>Паспорт прав и сдача</span>
                </span>
              </div>
            </div>

            {/* Сравнительная диаграмма Ганта (Gantt) по всем 4 пакетам */}
            <div className="space-y-4">
              {PRICING_PACKAGE_VISUAL_SPECS.map((spec) => {
                const isSelected = spec.id === selectedPackageId;
                // Относительная ширина полосы относительно максимального 120-часового цикла
                const totalWidthPercent = Math.max(
                  28,
                  Math.min(100, Math.round((spec.turnaroundHoursMax / 120) * 100))
                );

                return (
                  <div
                    key={spec.id}
                    data-testid={`pricing-timeline-row-${spec.id}`}
                    onClick={() => handleSelectPackageCard(spec.id)}
                    className={`rounded-2xl p-4 border transition-colors cursor-pointer space-y-2.5 ${
                      isSelected
                        ? 'bg-[#F7F6F2] dark:bg-[#18181F] border-[#FF4820]'
                        : 'bg-[#F7F6F2]/55 dark:bg-[#0D0D0F] border-[#111111]/8 dark:border-white/8 hover:border-[#111111]/25'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                          {spec.title}
                        </span>
                        <span aria-hidden="true" className="text-[#111111]/40 dark:text-white/40">
                          ·
                        </span>
                        <span className="text-xs font-semibold text-[#FF4820] tabular-nums">
                          {spec.priceFormatted}
                        </span>
                        {spec.supportsUrgent1Hour && (
                          <>
                            <span
                              aria-hidden="true"
                              className="text-[#111111]/40 dark:text-white/40"
                            >
                              ·
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A] dark:text-[#4ADE80]">
                              <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>Срочный режим от 1 ч (без разработки сценария)</span>
                            </span>
                          </>
                        )}
                      </div>

                      <span className="text-xs font-bold tabular-nums text-[#111111] dark:text-[#F4F3EF]">
                        Стандарт: {spec.turnaroundLabel} ({spec.turnaroundHoursMin}–
                        {spec.turnaroundHoursMax} ч)
                      </span>
                    </div>

                    {/* Масштабируемая стековая полоса этапов */}
                    <div className="w-full bg-[#111111]/6 dark:bg-white/6 rounded-xl p-1">
                      <div
                        style={{ width: `${totalWidthPercent}%` }}
                        className="h-6 rounded-lg overflow-hidden flex gap-0.5 transition-all duration-300"
                      >
                        {spec.timeline.phases.map((phase) => (
                          <div
                            key={phase.id}
                            style={{ width: `${phase.sharePercent}%` }}
                            title={`${phase.label}: ${phase.hoursMin}–${phase.hoursMax} ч`}
                            className={`h-full ${PHASE_BAR_COLORS[phase.id]} flex items-center justify-center text-[10px] font-bold text-white dark:text-[#0D0D0F] first:text-white last:text-white tabular-nums overflow-hidden whitespace-nowrap px-1`}
                          >
                            <span>
                              {phase.hoursMin}–{phase.hoursMax}ч
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Детализация 4 производственных фаз выбранного пакета */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {activeSpec.timeline.phases.map((phase, idx) => (
                <div
                  key={phase.id}
                  className="rounded-2xl p-4 bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/8 dark:border-white/8 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-bold tabular-nums text-[#111111] dark:text-[#F4F3EF]">
                    <span>Этап 0{idx + 1}</span>
                    <span className="text-[#FF4820]">
                      {phase.hoursMin}–{phase.hoursMax} ч
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]">
                    {phase.label}
                  </p>
                  <p className="text-[11px] text-[#111111]/64 dark:text-[#F4F3EF]/64 leading-relaxed">
                    {phase.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Итоговая панель выбранного пакета на графиках с кнопкой перехода к заказу в 1 клик */}
        <div
          data-testid="pricing-chart-selected-summary"
          className="rounded-2xl p-5 sm:p-6 bg-[#EFECE5]/80 dark:bg-[#16161B] border border-[#111111]/12 dark:border-white/12 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[#111111]/62 dark:text-[#F4F3EF]/62 tabular-nums">
              <span>Выбран на графике: {activeSpec.title}</span>
              <span aria-hidden="true">·</span>
              <span>{activeSpec.priceFormatted}</span>
              <span aria-hidden="true">·</span>
              <span>Срок: {activeSpec.turnaroundLabel}</span>
              <span aria-hidden="true">·</span>
              <span>Хронометраж: {activeSpec.chronometry.rangeLabel}</span>
            </div>
            <p className="text-xs sm:text-sm text-[#111111]/78 dark:text-[#F4F3EF]/78">
              {activeSpec.urgentNote}
            </p>
          </div>

          <button
            type="button"
            data-testid="pricing-chart-order-selected-btn"
            onClick={() => onSelectFormat(activeSpec.id)}
            className="min-h-[44px] px-5 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Выбрать «{activeSpec.shortTitle}» в заказ</span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
