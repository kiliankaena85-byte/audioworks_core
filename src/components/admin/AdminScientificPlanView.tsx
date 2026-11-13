import { CheckCircle2, Copy, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CrmOrderRecord } from '../../data/orderCrmTypes';
import { formatNumberSpaced, formatRubCompact } from '../../data/radioInventory';
import {
  buildAttributionAndSearchLiftProtocol,
  calculateMultiWaveLtvEconomics,
  evaluateCognitiveFrequencyAndMemoryCurve,
  evaluatePsychoacousticSpotAudit,
  extractScientificPresetFromOrder,
  SCIENTIFIC_GROWTH_ROADMAP,
  ScientificIndustryId,
} from '../../data/scientificGrowthPlan';

interface AdminScientificPlanViewProps {
  orders: readonly CrmOrderRecord[];
  preselectedOrder?: CrmOrderRecord | null;
}

const INDUSTRY_SELECT_OPTIONS: readonly {
  id: ScientificIndustryId;
  label: string;
}[] = [
  { id: 'real_estate', label: 'Недвижимость и ЖК' },
  { id: 'medicine', label: 'Медицина и клиники' },
  { id: 'fmcg_retail', label: 'Ритейл, продукты и HoReCa' },
  { id: 'b2b_finance', label: 'B2B, лизинг и финансы' },
  { id: 'auto_services', label: 'Автодилеры и сервис' },
] as const;

const DEFAULT_SCRIPT_SAMPLE =
  'Видовые квартиры с террасами в Квартал Парк. Ставка по траншу от четырёх процентов. Наберите Квартал Парк в поиске уже сегодня.';

export function AdminScientificPlanView({
  orders,
  preselectedOrder = null,
}: AdminScientificPlanViewProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    preselectedOrder?.id ?? ''
  );
  const [industryId, setIndustryId] = useState<ScientificIndustryId>('real_estate');
  const [waveBudgetRub, setWaveBudgetRub] = useState<number>(180_000);
  const [wave1ProductionRub, setWave1ProductionRub] = useState<number>(15_000);
  const [spotSeconds, setSpotSeconds] = useState<number>(15);
  const [totalSpots, setTotalSpots] = useState<number>(28);
  const [stationsCount, setStationsCount] = useState<number>(2);
  const [totalReachOTS, setTotalReachOTS] = useState<number>(420_000);
  const [baselineSearches, setBaselineSearches] = useState<number>(400);
  const [scriptText, setScriptText] = useState<string>(DEFAULT_SCRIPT_SAMPLE);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const applyOrderPreset = (order: CrmOrderRecord) => {
    const preset = extractScientificPresetFromOrder(order);
    setSelectedOrderId(order.id);
    setIndustryId(preset.industryId);
    setWaveBudgetRub(preset.waveBudgetRub);
    setWave1ProductionRub(preset.wave1ProductionRub);
    setSpotSeconds(preset.spotSeconds);
    setTotalSpots(preset.totalSpots);
    setStationsCount(preset.stationsCount);
    setTotalReachOTS(preset.totalReachOTS);
    if (preset.scriptSample.trim()) {
      setScriptText(preset.scriptSample);
    }
  };

  useEffect(() => {
    if (preselectedOrder) {
      applyOrderPreset(preselectedOrder);
    }
  }, [preselectedOrder]);

  const cognitiveAudit = useMemo(
    () =>
      evaluateCognitiveFrequencyAndMemoryCurve({
        totalSpots,
        stationsCount,
      }),
    [totalSpots, stationsCount]
  );

  const attributionProtocol = useMemo(
    () =>
      buildAttributionAndSearchLiftProtocol({
        industryId,
        totalReachOTS,
        effectiveFrequency: cognitiveAudit.effectiveFrequency,
        baselineWeeklySearches: baselineSearches,
      }),
    [industryId, totalReachOTS, cognitiveAudit.effectiveFrequency, baselineSearches]
  );

  const psychoAudit = useMemo(
    () =>
      evaluatePsychoacousticSpotAudit({
        spotSeconds,
        scriptText,
      }),
    [spotSeconds, scriptText]
  );

  const ltvModel = useMemo(
    () =>
      calculateMultiWaveLtvEconomics({
        waveBudgetRub,
        wave1ProductionRub,
        spotSeconds,
        baseWave1Spots: totalSpots,
        baseWave1ReachOTS: totalReachOTS,
      }),
    [waveBudgetRub, wave1ProductionRub, spotSeconds, totalSpots, totalReachOTS]
  );

  const handleResetDefaults = () => {
    setSelectedOrderId('');
    setIndustryId('real_estate');
    setWaveBudgetRub(180_000);
    setWave1ProductionRub(15_000);
    setSpotSeconds(15);
    setTotalSpots(28);
    setStationsCount(2);
    setTotalReachOTS(420_000);
    setBaselineSearches(400);
    setScriptText(DEFAULT_SCRIPT_SAMPLE);
  };

  const handleCopyPromoRule = async () => {
    const text = `Промо-маркер эфира: ${attributionProtocol.phoneticPromoCode}\nПравило кода: ${attributionProtocol.voiceAnchorRule}\nПрогноз Search Lift: +${attributionProtocol.projectedSearchLiftPercent}% (${attributionProtocol.projectedPrimeWindowSearches} брендовых запросов против базы ${attributionProtocol.baselineWeeklySearches})`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2200);
    } catch {
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2200);
    }
  };

  return (
    <div data-testid="admin-scientific-plan-view" className="space-y-8 tabular-nums">
      {/* Панель входных параметров расчёта + быстрая подгрузка реального заказа из CRM */}
      <section
        aria-labelledby="science-input-heading"
        className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#111111]/8 dark:border-white/8">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#111111]/56 dark:text-[#F4F3EF]/56">
              Научно-аналитический контур FMWorks · 4 расчётные модели
            </p>
            <h2
              id="science-input-heading"
              className="text-lg sm:text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]"
            >
              Научный план развития радиокампаний и экономики LTV
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {orders.length > 0 && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="science-order-selector"
                  className="text-xs font-semibold text-[#111111]/68 dark:text-[#F4F3EF]/68 whitespace-nowrap"
                >
                  Сделка из CRM:
                </label>
                <select
                  id="science-order-selector"
                  data-testid="science-order-selector"
                  value={selectedOrderId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      handleResetDefaults();
                      return;
                    }
                    const found = orders.find((o) => o.id === val);
                    if (found) applyOrderPreset(found);
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]"
                >
                  <option value="">Эталонный профиль (180 000 ₽)</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      #{o.orderNumber} · {formatRubCompact(o.totalBudgetRub)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleResetDefaults}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75 hover:text-[#111111] dark:hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Сбросить параметры</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="sci-industry"
              className="block text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
            >
              Отрасль кампании
            </label>
            <select
              id="sci-industry"
              value={industryId}
              onChange={(e) => setIndustryId(e.target.value as ScientificIndustryId)}
              className="w-full min-h-[40px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]"
            >
              {INDUSTRY_SELECT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="sci-budget"
              className="block text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
            >
              Бюджет 1 волны (₽)
            </label>
            <input
              id="sci-budget"
              type="number"
              min={40000}
              max={1500000}
              step={10000}
              value={waveBudgetRub}
              onChange={(e) =>
                setWaveBudgetRub(Math.max(40_000, Number(e.target.value) || 40_000))
              }
              className="w-full min-h-[40px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-bold text-[#111111] dark:text-[#F4F3EF]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="sci-spots"
              className="block text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
            >
              Выходов во флайте
            </label>
            <input
              id="sci-spots"
              type="number"
              min={2}
              max={250}
              value={totalSpots}
              onChange={(e) => setTotalSpots(Math.max(2, Number(e.target.value) || 2))}
              className="w-full min-h-[40px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-bold text-[#111111] dark:text-[#F4F3EF]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="sci-stations"
              className="block text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
            >
              Радиостанций в связке
            </label>
            <input
              id="sci-stations"
              type="number"
              min={1}
              max={12}
              value={stationsCount}
              onChange={(e) =>
                setStationsCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))
              }
              className="w-full min-h-[40px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-bold text-[#111111] dark:text-[#F4F3EF]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="sci-seconds"
              className="block text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
            >
              Хронометраж ролика (сек)
            </label>
            <input
              id="sci-seconds"
              type="number"
              min={5}
              max={60}
              value={spotSeconds}
              onChange={(e) =>
                setSpotSeconds(Math.max(5, Math.min(60, Number(e.target.value) || 15)))
              }
              className="w-full min-h-[40px] px-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-bold text-[#111111] dark:text-[#F4F3EF]"
            />
          </div>
        </div>
      </section>

      {/* Сетка 4 научных контуров (2x2 на 1440px десктопе) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* КОНТУР 01: Частота 5+ касаний и кривая памяти 12 недель */}
        <section
          aria-labelledby="contour-1-heading"
          className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 flex flex-col justify-between gap-5"
        >
          <div className="space-y-4">
            <div className="space-y-1 pb-3 border-b border-[#111111]/8 dark:border-white/8">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#111111]/56 dark:text-[#F4F3EF]/56">
                  01. Когнитивная медиаметрика · Krugman & Ebbinghaus
                </span>
                <span
                  className={`font-bold ${
                    cognitiveAudit.meetsFiveTouchThreshold
                      ? 'text-[#16A34A] dark:text-[#4ADE80]'
                      : 'text-[#D97706] dark:text-[#FBBF24]'
                  }`}
                >
                  ~{cognitiveAudit.effectiveFrequency.toFixed(1).replace('.', ',')}× касаний
                </span>
              </div>
              <h3
                id="contour-1-heading"
                className="text-base sm:text-lg font-bold text-[#111111] dark:text-[#F4F3EF]"
              >
                Аудит частоты 5+ касаний и кривая памяти 12 недель
              </h3>
            </div>

            <div className="space-y-1.5">
              <p
                className={`text-xs font-bold ${
                  cognitiveAudit.meetsFiveTouchThreshold
                    ? 'text-[#16A34A] dark:text-[#4ADE80]'
                    : 'text-[#D97706] dark:text-[#FBBF24]'
                }`}
              >
                {cognitiveAudit.verdictTitle}
              </p>
              <p className="text-xs leading-relaxed text-[#111111]/74 dark:text-[#F4F3EF]/74">
                {cognitiveAudit.verdictSummary}
              </p>
            </div>

            {/* Таблица-диаграмма удержания знания по неделям (Сценарий Б пульсация vs Сценарий А слив) */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[#111111]/60 dark:text-[#F4F3EF]/60">
                <span>Динамика следа памяти R(t) за 12 недель</span>
                <span>
                  Пульсация к 12 нед.:{' '}
                  <strong className="text-[#111111] dark:text-[#F4F3EF]">
                    {cognitiveAudit.week90PulsingFinalPct}%
                  </strong>{' '}
                  против {cognitiveAudit.week90SingleBurstFinalPct}% при разовом сливе (×
                  {cognitiveAudit.retentionAdvantageMultiple})
                </span>
              </div>

              <div className="divide-y divide-[#111111]/6 dark:divide-white/6 border-t border-b border-[#111111]/10 dark:border-white/10">
                {cognitiveAudit.weeklyCurve
                  .filter((_, idx) => idx % 2 === 1)
                  .map((pt) => (
                    <div
                      key={pt.weekNumber}
                      className="py-2 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                          Нед. {pt.weekNumber}
                        </span>
                        <span className="text-[#111111]/56 dark:text-[#F4F3EF]/56">
                          {' '}
                          · {pt.phaseLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 whitespace-nowrap">
                        <span className="text-[#111111]/50 dark:text-[#F4F3EF]/50">
                          разовый: {pt.singleBurstRecallPct}%
                        </span>
                        <span className="font-bold text-[#FF4820] min-w-[78px] text-right">
                          волны: {pt.pulsingFlightRecallPct}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-[#111111]/56 dark:text-[#F4F3EF]/56">
            Плотность текущей связки: {cognitiveAudit.avgSpotsPerStation} вых./ст. (научный
            ориентир ≥ {cognitiveAudit.recommendedMinSpotsPerStation} вых. на одну волну).
          </p>
        </section>

        {/* КОНТУР 02: Атрибуция эфира, голосовые коды и Search Lift */}
        <section
          aria-labelledby="contour-2-heading"
          className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 flex flex-col justify-between gap-5"
        >
          <div className="space-y-4">
            <div className="space-y-1 pb-3 border-b border-[#111111]/8 dark:border-white/8">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#111111]/56 dark:text-[#F4F3EF]/56">
                  02. Оцифровка отклика за рулём · Search Lift & QR
                </span>
                <span className="font-bold text-[#FF4820]">
                  +{attributionProtocol.projectedSearchLiftPercent}% Search Lift
                </span>
              </div>
              <h3
                id="contour-2-heading"
                className="text-base sm:text-lg font-bold text-[#111111] dark:text-[#F4F3EF]"
              >
                Атрибуция эфира: промокоды, QR и поисковый подъём
              </h3>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-[#111111]/8 dark:border-white/8">
              <div>
                <p className="text-[11px] text-[#111111]/56 dark:text-[#F4F3EF]/56">
                  Рекомендуемый фонетический маркер ({attributionProtocol.industryTitle})
                </p>
                <p
                  data-testid="science-phonetic-code"
                  className="text-lg font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]"
                >
                  Код в ролике: «{attributionProtocol.phoneticPromoCode}»
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleCopyPromoRule()}
                className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{copiedCode ? 'Скопировано' : 'Скопировать протокол'}</span>
              </button>
            </div>

            <div className="space-y-2 text-xs leading-relaxed text-[#111111]/78 dark:text-[#F4F3EF]/78">
              <p>
                <strong className="text-[#111111] dark:text-[#F4F3EF]">
                  Акустический якорь:
                </strong>{' '}
                {attributionProtocol.voiceAnchorRule}
              </p>
              <p>
                <strong className="text-[#111111] dark:text-[#F4F3EF]">
                  Связка с визуальным QR:
                </strong>{' '}
                {attributionProtocol.omnichannelQrBridge}
              </p>
            </div>

            <div className="pt-2 border-t border-[#111111]/8 dark:border-white/8 grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="sci-baseline-search"
                  className="block text-[11px] text-[#111111]/58 dark:text-[#F4F3EF]/58 mb-1"
                >
                  База брендовых запросов / нед.
                </label>
                <input
                  id="sci-baseline-search"
                  type="number"
                  min={50}
                  max={50000}
                  step={50}
                  value={baselineSearches}
                  onChange={(e) =>
                    setBaselineSearches(Math.max(50, Number(e.target.value) || 50))
                  }
                  className="w-full min-h-[36px] px-3 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-bold"
                />
              </div>
              <div className="flex flex-col justify-end">
                <p className="text-[11px] text-[#111111]/58 dark:text-[#F4F3EF]/58">
                  Прогноз в окнах прайма (+20 мин)
                </p>
                <p className="text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
                  {formatNumberSpaced(attributionProtocol.projectedPrimeWindowSearches)} запр.{' '}
                  <span className="text-xs font-semibold text-[#16A34A] dark:text-[#4ADE80]">
                    (+{attributionProtocol.projectedSearchLiftPercent}%)
                  </span>
                </p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-[#111111]/56 dark:text-[#F4F3EF]/56">
            Окна замера в Метрике: 07:30–11:20 и 17:30–20:50 относительно контрольной недели до
            старта эфира.
          </p>
        </section>

        {/* КОНТУР 03: Психоакустический тест первых 3 секунд и шума авто 68 дБ */}
        <section
          aria-labelledby="contour-3-heading"
          className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 flex flex-col justify-between gap-5"
        >
          <div className="space-y-4">
            <div className="space-y-1 pb-3 border-b border-[#111111]/8 dark:border-white/8">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#111111]/56 dark:text-[#F4F3EF]/56">
                  03. Психоакустика и салон авто 68–72 дБ SPL
                </span>
                <span
                  className={`font-bold ${
                    psychoAudit.densityStatus === 'optimal'
                      ? 'text-[#16A34A] dark:text-[#4ADE80]'
                      : psychoAudit.densityStatus === 'borderline_fast'
                        ? 'text-[#D97706] dark:text-[#FBBF24]'
                        : 'text-[#DC2626] dark:text-[#F87171]'
                  }`}
                >
                  {psychoAudit.wordCount} сл. / {psychoAudit.spotSeconds}с (+
                  {psychoAudit.carNoiseIntelligibilityDb} дБ к шуму)
                </span>
              </div>
              <h3
                id="contour-3-heading"
                className="text-base sm:text-lg font-bold text-[#111111] dark:text-[#F4F3EF]"
              >
                Тест ролика на первые 3 секунды и читаемость в дороге
              </h3>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="sci-script-input"
                className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
              >
                Текст сценария или расшифровка клиентского ролика ({spotSeconds} сек · норма до{' '}
                {psychoAudit.recommendedMaxWords} слов):
              </label>
              <textarea
                id="sci-script-input"
                data-testid="science-script-textarea"
                rows={3}
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="Вставьте текст аудиоролика для проверки плотности слов и первых 3 секунд…"
                className="w-full p-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs leading-relaxed text-[#111111] dark:text-[#F4F3EF]"
              />
            </div>

            <div className="space-y-2 pt-1 text-xs">
              <div className="flex items-start justify-between gap-3 py-1.5 border-b border-[#111111]/8 dark:border-white/8">
                <span className="text-[#111111]/64 dark:text-[#F4F3EF]/64">
                  Плотность дикторской речи:
                </span>
                <span
                  data-testid="science-density-label"
                  className={`font-semibold text-right ${
                    psychoAudit.densityStatus === 'optimal'
                      ? 'text-[#16A34A] dark:text-[#4ADE80]'
                      : psychoAudit.densityStatus === 'borderline_fast'
                        ? 'text-[#D97706] dark:text-[#FBBF24]'
                        : 'text-[#DC2626] dark:text-[#F87171]'
                  }`}
                >
                  {psychoAudit.densityLabel}
                </span>
              </div>

              <p className="leading-relaxed text-[#111111]/76 dark:text-[#F4F3EF]/76">
                <strong className="text-[#111111] dark:text-[#F4F3EF]">
                  Первые 3 секунды:
                </strong>{' '}
                {psychoAudit.firstThreeSecNote}
              </p>
            </div>
          </div>

          <p className="text-[11px] text-[#111111]/56 dark:text-[#F4F3EF]/56">
            {psychoAudit.masteringSpecLine}
          </p>
        </section>

        {/* КОНТУР 04: Автоматический расчёт LTV и повторных волн без оплаты ролика */}
        <section
          aria-labelledby="contour-4-heading"
          className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 flex flex-col justify-between gap-5"
        >
          <div className="space-y-4">
            <div className="space-y-1 pb-3 border-b border-[#111111]/8 dark:border-white/8">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#111111]/56 dark:text-[#F4F3EF]/56">
                  04. Капитализация паспорта прав · 90 дней
                </span>
                <span className="font-bold text-[#16A34A] dark:text-[#4ADE80]">
                  LTV 3 волн: {formatRubCompact(ltvModel.total90DayRevenueLtvRub)}
                </span>
              </div>
              <h3
                id="contour-4-heading"
                className="text-base sm:text-lg font-bold text-[#111111] dark:text-[#F4F3EF]"
              >
                Экономика LTV клиента и повторных волн с 0 ₽ за ролик
              </h3>
            </div>

            <div className="flex items-center justify-between gap-3 text-xs">
              <label
                htmlFor="sci-prod-cost"
                className="font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
              >
                Стоимость ролика в 1-й волне (₽):
              </label>
              <select
                id="sci-prod-cost"
                value={wave1ProductionRub}
                onChange={(e) => setWave1ProductionRub(Number(e.target.value))}
                className="min-h-[34px] px-3 rounded-lg bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-bold"
              >
                <option value={0}>0 ₽ (готовый ролик / бонус от 400 тыс.)</option>
                <option value={15000}>15 000 ₽ (Голос и стиль · 15 сек)</option>
                <option value={25000}>25 000 ₽ (Под ключ · сценарий + сведение)</option>
                <option value={35000}>35 000 ₽ (Игровой ролик / Мини-кино)</option>
              </select>
            </div>

            <div className="overflow-x-auto border-t border-b border-[#111111]/10 dark:border-white/10">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="text-[#111111]/56 dark:text-[#F4F3EF]/56 border-b border-[#111111]/8 dark:border-white/8">
                    <th className="py-2 pr-2 font-semibold">Волна</th>
                    <th className="py-2 px-2 font-semibold text-right">Ролик</th>
                    <th className="py-2 px-2 font-semibold text-right">Чистый эфир</th>
                    <th className="py-2 px-2 font-semibold text-right">Выходы</th>
                    <th className="py-2 pl-2 font-semibold text-right">CPT (1к OTS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#111111]/6 dark:divide-white/6">
                  {ltvModel.waves.map((w) => (
                    <tr key={w.waveIndex}>
                      <td className="py-2.5 pr-2">
                        <div className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                          Волна {w.waveIndex}{' '}
                          <span className="font-normal text-[#111111]/55 dark:text-[#F4F3EF]/55">
                            ({w.monthLabel})
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-semibold">
                        {w.productionCostRub === 0 ? (
                          <span className="text-[#16A34A] dark:text-[#4ADE80]">0 ₽</span>
                        ) : (
                          formatRubCompact(w.productionCostRub)
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {formatRubCompact(w.pureAirBudgetRub)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold">
                        {w.estimatedSpots}
                        {w.extraSpotsFromSavedProd > 0 && (
                          <span className="text-[#FF4820] ml-1">
                            (+{w.extraSpotsFromSavedProd})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-semibold">
                        {w.cptRubPerThousand.toFixed(0)} ₽
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[#111111]/68 dark:text-[#F4F3EF]/68">
                Дополнительный эфир за счёт паспорта прав:{' '}
                <strong className="text-[#111111] dark:text-[#F4F3EF]">
                  +{ltvModel.extraSpotsInWaves2And3} выходов
                </strong>{' '}
                (экономия {formatRubCompact(ltvModel.totalSavedOnRepeatProductionRub)})
              </span>
              {ltvModel.cptImprovementPercent > 0 && (
                <span className="font-bold text-[#16A34A] dark:text-[#4ADE80]">
                  Снижение CPT: −{ltvModel.cptImprovementPercent}%
                </span>
              )}
            </div>
          </div>

          <p className="text-[11px] text-[#111111]/56 dark:text-[#F4F3EF]/56">
            Бессрочный паспорт прав РАО/ВОИС превращает ролик в актив: со 2-й волны 100% платежа
            идёт в выходы на радиостанциях.
          </p>
        </section>
      </div>

      {/* Стратегическая дорожная карта научного развития платформы (Горизонты H1 — H2 — H3) */}
      <section
        aria-labelledby="scientific-roadmap-heading"
        className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-6 space-y-5"
      >
        <div className="space-y-1 pb-4 border-b border-[#111111]/8 dark:border-white/8">
          <p className="text-xs font-medium text-[#111111]/56 dark:text-[#F4F3EF]/56">
            Стратегическая программа развития платформы FMWorks · 3 горизонта
          </p>
          <h3
            id="scientific-roadmap-heading"
            className="text-lg font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]"
          >
            Дорожная карта внедрения научных механик продаж и аналитики
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 divide-y lg:divide-y-0 lg:divide-x divide-[#111111]/10 dark:divide-white/10">
          {SCIENTIFIC_GROWTH_ROADMAP.map((item, idx) => (
            <div
              key={item.horizonCode}
              className={`space-y-3 ${idx > 0 ? 'pt-5 lg:pt-0 lg:pl-6' : ''}`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[#FF4820]">
                  {item.horizonCode} · {item.timeframe}
                </span>
                {item.horizonCode === 'H1' && (
                  <span className="inline-flex items-center gap-1 font-semibold text-[#16A34A] dark:text-[#4ADE80]">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Активно</span>
                  </span>
                )}
              </div>

              <h4 className="text-sm sm:text-base font-bold text-[#111111] dark:text-[#F4F3EF]">
                {item.title}
              </h4>

              <p className="text-xs leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72">
                {item.scientificHypothesis}
              </p>

              <ul className="space-y-1.5 text-xs text-[#111111]/82 dark:text-[#F4F3EF]/82 pt-1">
                {item.deliverables.map((deliv) => (
                  <li key={deliv} className="leading-snug">
                    · {deliv}
                  </li>
                ))}
              </ul>

              <p className="text-[11px] font-semibold text-[#111111] dark:text-[#F4F3EF] pt-2 border-t border-[#111111]/8 dark:border-white/8">
                Целевая метрика: {item.targetKpi}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
