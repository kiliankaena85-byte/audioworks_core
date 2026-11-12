import { ArrowUpRight, Check, SlidersHorizontal } from 'lucide-react';
import {
  CAMPAIGN_GOAL_OPTIONS,
  CampaignGoalId,
  HotAirPackageId,
  HotAirReadyPackage,
  QUICK_SLIDER_BUDGET_MARKS,
  RADIO_SCIENCE_PILLARS,
} from '../data/hotAirPackages';
import {
  MAX_FLEXIBLE_BUDGET_RUB,
  MIN_FLEXIBLE_BUDGET_RUB,
} from '../data/mediaPlannerCore';
import {
  AIR_BONUS_THRESHOLD_RUB,
  formatNumberSpaced,
  formatRubCompact,
  SpotReadinessMode,
} from '../data/radioInventory';

interface HotAirPackagesTabProps {
  campaignGoal: CampaignGoalId;
  onSelectCampaignGoal: (goal: CampaignGoalId) => void;
  totalBudget: number;
  budgetInputDraft: string;
  onSliderBudgetChange: (amount: number) => void;
  onManualBudgetInputChange: (rawValue: string) => void;
  onManualBudgetBlur: () => void;
  spotReadiness: SpotReadinessMode;
  onChangeSpotReadiness: (mode: SpotReadinessMode) => void;
  spotSeconds: number;
  packages: readonly HotAirReadyPackage[];
  selectedPackageId: HotAirPackageId;
  onSelectPackage: (id: HotAirPackageId) => void;
  onReservePackage: (pkg: HotAirReadyPackage) => void;
  onCustomizePackageInManualTab: (pkg: HotAirReadyPackage) => void;
  onNavigateStation?: (stationSlug: string) => void;
  onNavigateApproach?: () => void;
}

export function HotAirPackagesTab({
  campaignGoal,
  onSelectCampaignGoal,
  totalBudget,
  budgetInputDraft,
  onSliderBudgetChange,
  onManualBudgetInputChange,
  onManualBudgetBlur,
  spotReadiness,
  onChangeSpotReadiness,
  spotSeconds,
  packages,
  selectedPackageId,
  onSelectPackage,
  onReservePackage,
  onCustomizePackageInManualTab,
  onNavigateStation,
  onNavigateApproach,
}: HotAirPackagesTabProps) {
  const isBonusBudgetZone = totalBudget >= AIR_BONUS_THRESHOLD_RUB;
  const activeGoalSpec =
    CAMPAIGN_GOAL_OPTIONS.find((g) => g.id === campaignGoal) ??
    CAMPAIGN_GOAL_OPTIONS[0];

  return (
    <div data-testid="hot-air-packages-tab" className="space-y-5 sm:space-y-6">
      {/* Компактный пульт без лишних фильтров: Задача -> Аудитория в 1 клик -> Ползунок бюджета */}
      <div className="rounded-3xl bg-[#EFECE5]/90 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 p-4 sm:p-5 space-y-3.5 sm:space-y-4">
        {/* Задача бизнеса: Разовая акция (11.11) vs Система узнаваемости от 3 месяцев */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
              Какая задача у кампании
            </span>
            <span className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">
              От задачи зависит минимальный срок и число касаний
            </span>
          </div>

          <div
            role="radiogroup"
            aria-label="Бизнес-задача рекламной кампании"
            data-testid="campaign-goal-selector"
            className="grid grid-cols-1 md:grid-cols-2 gap-2"
          >
            {CAMPAIGN_GOAL_OPTIONS.map((goal) => {
              const active = goal.id === campaignGoal;
              return (
                <button
                  key={goal.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`campaign-goal-${goal.id}`}
                  onClick={() => onSelectCampaignGoal(goal.id)}
                  className={`min-h-[50px] px-3.5 py-2 rounded-2xl text-left border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                    active
                      ? 'bg-[#111111] text-[#F7F6F2] border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:border-[#F4F3EF]'
                      : 'bg-[#F7F6F2] text-[#111111] border-[#111111]/10 hover:border-[#111111]/30 dark:bg-[#0E0E12] dark:text-[#F4F3EF] dark:border-white/10 dark:hover:border-white/30'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span className="text-xs sm:text-[13px] font-bold whitespace-nowrap">
                        {goal.label}
                      </span>
                      <span className="text-xs font-semibold whitespace-nowrap text-[#FF4820]">
                        · {goal.horizonLabel}
                      </span>
                    </div>
                    <p
                      className={`text-[11.5px] leading-snug line-clamp-2 sm:truncate ${
                        active
                          ? 'text-[#F7F6F2]/74 dark:text-[#0D0D0F]/72'
                          : 'text-[#111111]/60 dark:text-[#F4F3EF]/60'
                      }`}
                    >
                      {goal.shortHint}
                    </p>
                  </div>

                  {active && (
                    <Check
                      className="w-4 h-4 text-[#FF4820] shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <p
            data-testid="campaign-goal-honest-note"
            className="text-xs leading-snug text-[#111111]/72 dark:text-[#F4F3EF]/72"
          >
            {activeGoalSpec.honestRuleNote}
          </p>
        </div>

        {/* ШАГ 2: Ползунок бюджета + ручной ввод + готовность ролика */}
        <div className="pt-3.5 border-t border-[#111111]/10 dark:border-white/10 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-end">
          <div className="lg:col-span-8 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="media-budget-manual-input"
                className="text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]"
              >
                {campaignGoal === 'brand_3months'
                  ? '2. Бюджет одной волны (в системе от 3 месяцев)'
                  : '2. Бюджет на акционный залп'}
              </label>

              <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/16 dark:border-white/16 px-3 h-10 focus-within:border-[#FF4820]">
                <input
                  id="media-budget-manual-input"
                  data-testid="media-budget-manual-input"
                  type="text"
                  inputMode="numeric"
                  value={budgetInputDraft}
                  onChange={(e) => onManualBudgetInputChange(e.target.value)}
                  onBlur={onManualBudgetBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onManualBudgetBlur();
                    }
                  }}
                  aria-label="Точная сумма бюджета в рублях"
                  className="w-26 sm:w-28 text-right text-base sm:text-lg font-bold tabular-nums bg-transparent text-[#111111] dark:text-[#F4F3EF] focus:outline-none"
                />
                <span className="text-sm font-bold text-[#111111]/55 dark:text-[#F4F3EF]/55">
                  ₽
                </span>
              </div>
            </div>

            <div>
              <input
                id="media-budget-slider"
                data-testid="media-budget-slider"
                type="range"
                min={MIN_FLEXIBLE_BUDGET_RUB}
                max={MAX_FLEXIBLE_BUDGET_RUB}
                step={5_000}
                value={totalBudget}
                onChange={(e) => onSliderBudgetChange(Number(e.target.value))}
                aria-label="Ползунок бюджета рекламной кампании"
                className="w-full h-2 rounded-full appearance-none bg-[#111111]/15 dark:bg-white/16 accent-[#FF4820] cursor-pointer"
              />
              <div className="flex items-center justify-between text-[11px] font-medium tabular-nums text-[#111111]/54 dark:text-[#F4F3EF]/54 mt-1">
                <span>40 000 ₽ · минимум</span>
                <span
                  className={
                    isBonusBudgetZone ? 'text-[#FF4820] font-semibold' : ''
                  }
                >
                  от 400 000 ₽ эфира — ролик 0 ₽
                </span>
                <span>1 500 000 ₽</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_SLIDER_BUDGET_MARKS.map((mark) => {
                const isMarkActive = totalBudget === mark.amount;
                return (
                  <button
                    key={mark.amount}
                    type="button"
                    data-testid={`budget-preset-${mark.amount}`}
                    onClick={() => onSliderBudgetChange(mark.amount)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
                      isMarkActive
                        ? 'bg-[#FF4820] text-white border-[#FF4820]'
                        : 'bg-[#F7F6F2] dark:bg-[#0E0E12] text-[#111111]/76 dark:text-[#F4F3EF]/76 border-[#111111]/10 dark:border-white/10 hover:border-[#FF4820]/60'
                    }`}
                  >
                    {mark.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Тумблер готовности ролика */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72">
                Аудиоролик ({spotSeconds} сек)
              </span>
              <span className="text-[#111111]/52 dark:text-[#F4F3EF]/52 tabular-nums">
                {spotReadiness === 'ready_with_passport'
                  ? 'Проверка прав 0 ₽'
                  : isBonusBudgetZone
                    ? 'Бонус квоты 0 ₽'
                    : 'Под ключ за 24ч'}
              </span>
            </div>

            <div
              role="group"
              aria-label="Готовность аудиоролика"
              className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12"
            >
              <button
                type="button"
                data-testid="readiness-need-production"
                onClick={() => onChangeSpotReadiness('need_production_24h')}
                aria-pressed={spotReadiness === 'need_production_24h'}
                className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                  spotReadiness === 'need_production_24h'
                    ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                    : 'text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                Нужен ролик
              </button>
              <button
                type="button"
                data-testid="readiness-ready-spot"
                onClick={() => onChangeSpotReadiness('ready_with_passport')}
                aria-pressed={spotReadiness === 'ready_with_passport'}
                className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                  spotReadiness === 'ready_with_passport'
                    ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                    : 'text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                Есть свой ролик
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Витрина из 3 готовых пакетов со скидкой */}
      <div
        data-testid="ready-packages-grid"
        className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch"
      >
        {packages.map((pkg) => {
          const isSelected = pkg.id === selectedPackageId;
          const { plan, stationBreakdown, science } = pkg;

          return (
            <article
              key={pkg.id}
              data-testid={`ready-package-card-${pkg.id}`}
              onClick={() => onSelectPackage(pkg.id)}
              className={`rounded-3xl p-6 sm:p-7 border transition-colors cursor-pointer flex flex-col justify-between gap-6 ${
                isSelected
                  ? 'bg-[#FFFFFF] dark:bg-[#17171D] border-[#FF4820]'
                  : 'bg-[#FFFFFF]/75 dark:bg-[#131318] border-[#111111]/12 dark:border-white/10 hover:border-[#111111]/30 dark:hover:border-white/28'
              }`}
            >
              <div className="space-y-5">
                {/* Шапка пакета: тихая строка метаданных через интерпункт без пилюль */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs font-medium tabular-nums">
                    <span
                      className={
                        pkg.isRecommended
                          ? 'font-semibold text-[#FF4820]'
                          : 'text-[#111111]/56 dark:text-[#F4F3EF]/56'
                      }
                    >
                      {pkg.indexLabel} ·{' '}
                      {pkg.isRecommended ? 'Рекомендуем · ' : ''}
                      {pkg.subtitle}
                    </span>

                    <span className="font-bold text-[#FF4820] shrink-0">
                      −{plan.airDiscountPercent}%
                    </span>
                  </div>

                  <h2 className="text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                    {pkg.title}
                  </h2>

                  <p className="text-xs sm:text-sm leading-relaxed text-[#111111]/68 dark:text-[#F4F3EF]/68">
                    {pkg.whySummary}
                  </p>
                </div>

                {/* Ключевые цифры пакета + научная частота касаний */}
                <div className="space-y-2.5 py-3.5 border-y border-[#111111]/10 dark:border-white/10 tabular-nums">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[11px] text-[#111111]/54 dark:text-[#F4F3EF]/54">
                        Выходов ({spotSeconds}с)
                      </p>
                      <p
                        data-testid={`pkg-spots-${pkg.id}`}
                        className="text-lg sm:text-xl font-bold text-[#111111] dark:text-[#F4F3EF] mt-0.5"
                      >
                        {plan.totalSpots}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#111111]/54 dark:text-[#F4F3EF]/54">
                        Касаний ЦА
                      </p>
                      <p
                        data-testid={`pkg-contacts-${pkg.id}`}
                        className={`text-lg sm:text-xl font-bold mt-0.5 ${
                          science.verdictLevel === 'optimal_5plus'
                            ? 'text-[#16A34A] dark:text-[#4ADE80]'
                            : science.verdictLevel === 'working_3plus'
                              ? 'text-[#111111] dark:text-[#F4F3EF]'
                              : 'text-[#D97706] dark:text-[#FBBF24]'
                        }`}
                      >
                        ~{science.avgContactsPerListener.toFixed(1).replace('.', ',')}×
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#111111]/54 dark:text-[#F4F3EF]/54">
                        Охват OTS
                      </p>
                      <p className="text-lg sm:text-xl font-bold text-[#111111] dark:text-[#F4F3EF] mt-0.5">
                        {formatNumberSpaced(plan.totalReachOTS)}
                      </p>
                    </div>
                  </div>

                  <p
                    data-testid={`pkg-science-verdict-${pkg.id}`}
                    className={`text-[11px] font-medium leading-snug ${
                      science.verdictLevel === 'optimal_5plus'
                        ? 'text-[#15803D] dark:text-[#86EFAC]'
                        : science.verdictLevel === 'working_3plus'
                          ? 'text-[#111111]/64 dark:text-[#F4F3EF]/64'
                          : 'text-[#B45309] dark:text-[#FCD34D]'
                    }`}
                  >
                    {science.verdictShortLabel}
                  </p>
                </div>

                {/* Прозрачный состав радиостанций внутри пакета */}
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-[#111111]/58 dark:text-[#F4F3EF]/58">
                    Радиостанции в пакете ({stationBreakdown.length}):
                  </p>

                  <ul className="divide-y divide-[#111111]/8 dark:divide-white/8 tabular-nums">
                    {stationBreakdown.map((st) => (
                      <li
                        key={st.stationId}
                        className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            {onNavigateStation ? (
                              <button
                                type="button"
                                data-testid={`pkg-${pkg.id}-station-link-${st.stationSlug}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigateStation(st.stationSlug);
                                }}
                                aria-label={`Открыть портрет радиостанции ${st.stationName}`}
                                className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] inline-flex items-center gap-1 transition-colors cursor-pointer text-left truncate"
                              >
                                <span className="truncate">{st.stationName}</span>
                                <ArrowUpRight
                                  className="w-3.5 h-3.5 text-[#111111]/42 dark:text-[#F4F3EF]/42 shrink-0"
                                  aria-hidden="true"
                                />
                              </button>
                            ) : (
                              <span className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF] truncate">
                                {st.stationName}
                              </span>
                            )}
                            <span className="text-xs text-[#111111]/52 dark:text-[#F4F3EF]/52 shrink-0">
                              {st.frequencyFm}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#111111]/60 dark:text-[#F4F3EF]/60 truncate">
                            {st.windowsSummary}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="block text-xs font-bold text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap">
                            {st.spotsCount} вых.
                          </span>
                          <span className="block text-[11px] text-[#111111]/50 dark:text-[#F4F3EF]/50 whitespace-nowrap">
                            {formatRubCompact(st.hotPriceRub)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Нижняя зона: статус ролика + 3-мес прогноз (при системной цели) + цена + кнопка бронирования */}
              <div className="pt-4 border-t border-[#111111]/10 dark:border-white/10 space-y-3.5 tabular-nums">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#111111]/64 dark:text-[#F4F3EF]/64 truncate">
                    {plan.production.isBonusUnlocked
                      ? `Ролик ${spotSeconds} сек по квоте`
                      : spotReadiness === 'ready_with_passport'
                        ? `Ваш готовый ролик (${spotSeconds}с)`
                        : `Ролик ${spotSeconds} сек «Под ключ»`}
                  </span>
                  <span
                    className={
                      plan.production.isBonusUnlocked
                        ? 'font-bold text-[#FF4820] whitespace-nowrap'
                        : 'font-semibold text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap'
                    }
                  >
                    {plan.production.isBonusUnlocked
                      ? '0 ₽ бонус'
                      : spotReadiness === 'ready_with_passport'
                        ? '0 ₽'
                        : formatRubCompact(plan.production.effectivePriceRub)}
                  </span>
                </div>

                {campaignGoal === 'brand_3months' && (
                  <div
                    data-testid={`pkg-3month-summary-${pkg.id}`}
                    className="pt-2.5 border-t border-[#111111]/8 dark:border-white/8 text-[11px] text-[#111111]/66 dark:text-[#F4F3EF]/66 flex items-center justify-between gap-2"
                  >
                    <span>План 3 мес. (2–3 мес. без оплаты ролика):</span>
                    <span className="font-bold text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap">
                      {formatRubCompact(science.threeMonthProgram.threeMonthsTotalRub)}
                    </span>
                  </div>
                )}

                <div className="flex items-baseline justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="block text-xs line-through text-[#111111]/44 dark:text-[#F4F3EF]/44">
                      Прайс: {formatRubCompact(plan.officialAirTotalRub + plan.production.originalValueRub)}
                    </span>
                    <span className="block text-xs font-semibold text-[#FF4820]">
                      Выгода {formatRubCompact(plan.totalSavingsRub)}
                    </span>
                  </div>

                  <div className="text-right">
                    {campaignGoal === 'brand_3months' && (
                      <span className="block text-[10px] text-[#111111]/52 dark:text-[#F4F3EF]/52">
                        1-я волна к старту
                      </span>
                    )}
                    <span
                      data-testid={`pkg-total-price-${pkg.id}`}
                      className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap"
                    >
                      {formatRubCompact(plan.totalClientCostRub)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    data-testid={`book-package-btn-${pkg.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPackage(pkg.id);
                      onReservePackage(pkg);
                    }}
                    className={`w-full min-h-[46px] px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap inline-flex items-center justify-center ${
                      isSelected
                        ? 'bg-[#FF4820] hover:bg-[#E63C17] text-white'
                        : 'bg-[#111111] hover:bg-[#FF4820] text-[#F7F6F2] hover:text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white'
                    }`}
                  >
                    {campaignGoal === 'brand_3months'
                      ? 'Зарезервировать 1-ю волну на 4 ч'
                      : 'Зарезервировать пакет на 4 ч'}
                  </button>

                  <button
                    type="button"
                    data-testid={`customize-package-btn-${pkg.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCustomizePackageInManualTab(pkg);
                    }}
                    className="w-full min-h-[36px] px-3 py-1.5 text-xs font-medium text-[#111111]/64 dark:text-[#F4F3EF]/64 hover:text-[#111111] dark:hover:text-white inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Изменить станции или секунды вручную</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Научно-практический блок: честные границы радиорекламы, 5 касаний и горизонт 3 месяцев */}
      <section
        aria-labelledby="radio-science-heading"
        data-testid="radio-science-section"
        className="pt-8 sm:pt-12 border-t border-[#111111]/10 dark:border-white/10 space-y-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="max-w-3xl space-y-2">
            <p className="text-xs sm:text-sm font-semibold text-[#FF4820]">
              Маркетинговые исследования и честные правила эффективности
            </p>
            <h2
              id="radio-science-heading"
              className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] editorial-balance"
            >
              Как работает радио на самом деле и почему мы не продаём пустые выходы
            </h2>
          </div>

          {onNavigateApproach && (
            <button
              type="button"
              onClick={onNavigateApproach}
              className="text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start lg:self-auto"
            >
              <span>Разборы ошибок радиорекламы</span>
              <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
          {RADIO_SCIENCE_PILLARS.map((pillar) => (
            <article
              key={pillar.index}
              className="rounded-3xl p-6 bg-[#EFECE5]/70 dark:bg-[#141419] border border-[#111111]/10 dark:border-white/10 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-[#FF4820] tabular-nums">
                  {pillar.index} · {pillar.metricAnchor}
                </p>
                <h3 className="text-lg font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                  {pillar.title}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72">
                  {pillar.summary}
                </p>
              </div>

              <p className="pt-3 border-t border-[#111111]/10 dark:border-white/10 text-xs font-medium leading-relaxed text-[#111111]/84 dark:text-[#F4F3EF]/84">
                {pillar.practicalRule}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
