import {
  AlertTriangle,
  ArrowUpRight,
  Calculator,
  Check,
  Clock,
  FileText,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildThreeReadyPackages,
  buildUnified12StationCatalog,
  CampaignGoalId,
  evaluateMediaScienceDiagnostic,
  getAudiencePortraitById,
  HOT_AIR_AUDIENCE_PORTRAITS,
  HotAirPackageId,
  HotAirPortraitId,
  HotAirReadyPackage,
  resolvePortraitFromNiche,
} from '../data/hotAirPackages';
import {
  AiSemanticRecommendationHint,
  buildFlexibleReservationPayload,
  ComputedVariationQuote,
  computeFlexibleMediaPlanSummary,
  DEFAULT_FLEXIBLE_BUDGET_RUB,
  expandVariationToChessboardCells,
  FlexibleMediaPlanResult,
  MAX_FLEXIBLE_BUDGET_RUB,
  MIN_FLEXIBLE_BUDGET_RUB,
  recommendOptimalMediaPlan,
  SelectedVariationState,
} from '../data/mediaPlannerCore';
import {
  STATION_EDITORIAL_SEEDS,
  StationEditorialSeed,
  stationNameToSlug,
} from '../data/multiPageContentData';
import {
  AIR_BONUS_THRESHOLD_RUB,
  ALL_WEEKDAY_NUMBERS,
  ALL_WEEKDAYS,
  AudienceTag,
  formatNumberSpaced,
  formatRubCompact,
  MEDIA_NICHE_OPTIONS,
  MediaGridReservationPayload,
  MIN_TEST_LAUNCH_BUDGET_RUB,
  RadioInventorySlot,
  radioInventoryStore,
  resolveMediaNicheFromLaya,
  SpotReadinessMode,
  validateMinTestLaunchBudget,
  WeekdayNumber,
} from '../data/radioInventory';
import {
  clampExactSpotSeconds,
  LegalDisclaimerId,
  MAX_CUSTOM_SPOT_SECONDS,
  MIN_CUSTOM_SPOT_SECONDS,
  ScriptTempoId,
  STANDARD_SPOT_DURATIONS,
} from '../data/scriptChronometer';
import { useLayaDecision } from '../engine/LayaContext';
import { HotAirPackagesTab } from './HotAirPackagesTab';
import { MediaProposalModal, StandaloneHoldModal } from './MediaProposalModal';
import { ScriptChronometerPanel } from './ScriptChronometerPanel';

export type HotAirWorkspaceTab = 'packages' | 'manual';
type GridViewMode = 'cards' | 'chessboard';
type TimeBandId = 'morning' | 'day' | 'evening';
type StationAudienceFilter = 'all' | AudienceTag;

interface TimeBandSpec {
  id: TimeBandId;
  label: string;
  hoursHint: string;
}

const TIME_BANDS: readonly TimeBandSpec[] = [
  { id: 'morning', label: 'Утро 07–11', hoursHint: 'Драйв-шоу и утренний поток' },
  { id: 'day', label: 'День 11–17', hoursHint: 'Деловые часы и дневной охват' },
  { id: 'evening', label: 'Вечер 17–21', hoursHint: 'Путь домой и вечерний прайм' },
] as const;

const MANUAL_STATION_FILTERS: readonly { id: StationAudienceFilter; label: string }[] = [
  { id: 'all', label: 'Все 12 станций' },
  { id: 'b2b', label: 'B2B' },
  { id: 'real_estate', label: 'Недвижимость' },
  { id: 'medicine', label: 'Медицина' },
  { id: 'fmcg', label: 'Ритейл' },
  { id: 'auto', label: 'Авто' },
  { id: 'premium', label: 'Премиум' },
] as const;

function classifyTimeBand(timeSlot: string): TimeBandId {
  const hour = parseInt(timeSlot.split(':')[0] ?? '9', 10);
  if (Number.isNaN(hour) || hour < 11) return 'morning';
  if (hour < 17) return 'day';
  return 'evening';
}

function TactilePortraitEmblem({ portraitId }: { portraitId: HotAirPortraitId }) {
  switch (portraitId) {
    case 'b2b_execs':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <circle cx="12" cy="7.25" r="3.25" />
          <path d="M5.5 19.5c.6-3.4 3.1-5.25 6.5-5.25s5.9 1.85 6.5 5.25" />
          <path d="M12 14.25v5.25" />
          <path d="M9.5 14.8 12 17.2l2.5-2.4" />
        </svg>
      );
    case 'premium_estate':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <circle cx="9.25" cy="8" r="3" />
          <path d="M3.75 19.5c.5-2.9 2.5-4.5 5.5-4.5s5 1.6 5.5 4.5" />
          <path d="M16 19.5V6.5l4.25 2v11" />
          <path d="M17.75 10.25h1" />
          <path d="M17.75 13.25h1" />
        </svg>
      );
    case 'auto_commute':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <circle cx="12" cy="6.75" r="2.9" />
          <path d="M5.75 17.25c.75-2.5 3-3.9 6.25-3.9s5.5 1.4 6.25 3.9" />
          <circle cx="12" cy="17.5" r="3.5" />
          <path d="M9 17.5h6" />
          <path d="M12 17.5V21" />
        </svg>
      );
    case 'urban_retail':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <circle cx="9.25" cy="7.75" r="3" />
          <path d="M3.75 19.5c.5-2.9 2.5-4.5 5.5-4.5 2.05 0 3.7.75 4.65 2.15" />
          <rect x="14.75" y="12.25" width="5.75" height="7.25" rx="1.2" />
          <path d="M16.15 12.25V11a1.45 1.45 0 0 1 2.9 0v1.25" />
        </svg>
      );
    case 'family_health':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <circle cx="9" cy="7.75" r="3" />
          <path d="M3.5 19.5c.5-2.9 2.5-4.5 5.5-4.5s5 1.6 5.5 4.5" />
          <path d="M18 9.25v4.5" />
          <path d="M15.75 11.5h4.5" />
        </svg>
      );
  }
}

interface ChessboardCellEntry {
  variationId: string;
  station: string;
  timeSlot: string;
  spotsCount: number;
}

interface ChessboardMatrix {
  cells: Record<TimeBandId, Record<WeekdayNumber, ChessboardCellEntry[]>>;
  cellTotals: Record<TimeBandId, Record<WeekdayNumber, number>>;
  bandTotals: Record<TimeBandId, number>;
  dayTotals: Record<WeekdayNumber, number>;
  grandTotalSpots: number;
}

function buildFlexibleChessboardMatrix(
  selectedQuotes: readonly ComputedVariationQuote[]
): ChessboardMatrix {
  const cells: Record<TimeBandId, Record<WeekdayNumber, ChessboardCellEntry[]>> = {
    morning: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
    day: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
    evening: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
  };
  const cellTotals: Record<TimeBandId, Record<WeekdayNumber, number>> = {
    morning: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
    day: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
    evening: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
  };
  const bandTotals: Record<TimeBandId, number> = {
    morning: 0,
    day: 0,
    evening: 0,
  };
  const dayTotals: Record<WeekdayNumber, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
  };
  let grandTotalSpots = 0;

  for (const quote of selectedQuotes) {
    const expanded = expandVariationToChessboardCells(quote.variation, quote.spotsCount);
    for (const cell of expanded) {
      const band = classifyTimeBand(cell.timeSlot);
      cells[band][cell.weekday].push({
        variationId: quote.variation.id,
        station: quote.stationItem.station,
        timeSlot: cell.timeSlot,
        spotsCount: cell.spotsCount,
      });
      cellTotals[band][cell.weekday] += cell.spotsCount;
      bandTotals[band] += cell.spotsCount;
      dayTotals[cell.weekday] += cell.spotsCount;
      grandTotalSpots += cell.spotsCount;
    }
  }

  return {
    cells,
    cellTotals,
    bandTotals,
    dayTotals,
    grandTotalSpots,
  };
}

export interface MediaGridPlannerProps {
  onReserveMediaGrid?: (payload: MediaGridReservationPayload) => void;
  onNavigateStation?: (stationSlug: string) => void;
  onNavigateApproach?: () => void;
  isCasePlayerVisible?: boolean;
}

export function MediaGridPlanner({
  onReserveMediaGrid,
  onNavigateStation,
  onNavigateApproach,
  isCasePlayerVisible = false,
}: MediaGridPlannerProps = {}) {
  const { decision, visitorState, activeTraceId } = useLayaDecision();

  const layaTargetNiche = resolveMediaNicheFromLaya(decision);
  const layaSignalKey = `${activeTraceId ?? ''}::${decision.choice}::${layaTargetNiche}::${visitorState.personaParam}::${visitorState.utmTerm}`;
  const lastSyncedLayaKeyRef = useRef<string>(layaSignalKey);

  // Живой каталог слотов из хранилища (подхватывает импорты из /admin)
  const [inventorySlots, setInventorySlots] = useState<RadioInventorySlot[]>(() =>
    radioInventoryStore.getAllSlots()
  );

  // Верхнеуровневые вкладки: Вкладка 1 = Готовые пакеты, Вкладка 2 = Все 12 станций и ручная сборка
  const [activeTab, setActiveTab] = useState<HotAirWorkspaceTab>('packages');
  const [campaignGoal, setCampaignGoal] = useState<CampaignGoalId>('promo_burst');
  const [portraitId, setPortraitId] = useState<HotAirPortraitId>(
    () => resolvePortraitFromNiche(layaTargetNiche).id
  );
  const [selectedPackageId, setSelectedPackageId] =
    useState<HotAirPackageId>('balanced');

  // Продукт и AI-подсказка для PRO-режима
  const [productNote, setProductNote] = useState('');
  const [aiHint, setAiHint] = useState<AiSemanticRecommendationHint | null>(null);
  const [isMatchingGrid, setIsMatchingGrid] = useState(false);

  // Бюджет от 40 000 ₽ + поле ручного ввода суммы
  const [totalBudget, setTotalBudget] = useState<number>(DEFAULT_FLEXIBLE_BUDGET_RUB);
  const [budgetInputDraft, setBudgetInputDraft] = useState<string>(() =>
    formatNumberSpaced(DEFAULT_FLEXIBLE_BUDGET_RUB)
  );

  // Хронометраж ролика (5..60 сек) + Хронометр текста
  const [spotReadiness, setSpotReadiness] = useState<SpotReadinessMode>('need_production_24h');
  const [spotSeconds, setSpotSeconds] = useState<number>(15);
  const [secondsInputDraft, setSecondsInputDraft] = useState<string>('15');
  const [isChronometerOpen, setIsChronometerOpen] = useState(false);
  const [scriptDraftText, setScriptDraftText] = useState('');
  const [scriptTempo, setScriptTempo] = useState<ScriptTempoId>('business_standard');
  const [scriptDisclaimer, setScriptDisclaimer] = useState<LegalDisclaimerId>('none');

  // Ручной выбор слотов на Вкладке 2
  const [manualSelections, setManualSelections] = useState<SelectedVariationState[] | null>(
    null
  );
  const [viewMode, setViewMode] = useState<GridViewMode>('cards');
  const [manualStationFilter, setManualStationFilter] =
    useState<StationAudienceFilter>('all');

  // Модальные окна КП и автономной брони
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [isStandaloneHoldOpen, setIsStandaloneHoldOpen] = useState(false);

  useEffect(() => {
    return radioInventoryStore.subscribe((nextSlots) => {
      setInventorySlots([...nextSlots]);
    });
  }, []);

  // Синхронизация с пультом персонализации Laya AI
  useEffect(() => {
    if (lastSyncedLayaKeyRef.current !== layaSignalKey) {
      lastSyncedLayaKeyRef.current = layaSignalKey;
      setPortraitId(resolvePortraitFromNiche(layaTargetNiche).id);
      setAiHint(null);
      setManualSelections(null);
    }
  }, [layaSignalKey, layaTargetNiche]);

  const activePortrait = useMemo(
    () => getAudiencePortraitById(portraitId),
    [portraitId]
  );

  const editorialSeedBySlug = useMemo(() => {
    const map = new Map<string, StationEditorialSeed>();
    for (const seed of STATION_EDITORIAL_SEEDS) {
      map.set(seed.slug, seed);
    }
    return map;
  }, []);

  // Единый каталог всех 12 радиостанций
  const unifiedCatalog = useMemo(
    () => buildUnified12StationCatalog(inventorySlots),
    [inventorySlots]
  );

  // Мгновенный расчёт 3 готовых пакетов со скидкой для Вкладки 1
  const readyPackages = useMemo(
    () =>
      buildThreeReadyPackages({
        portraitId,
        totalBudgetRub: totalBudget,
        campaignGoal,
        spotSeconds,
        spotReadiness,
        productNote,
        stationsCatalog: unifiedCatalog,
        layaPersona: decision.choice,
        aiHint,
      }),
    [
      portraitId,
      totalBudget,
      campaignGoal,
      spotSeconds,
      spotReadiness,
      productNote,
      unifiedCatalog,
      decision.choice,
      aiHint,
    ]
  );

  const activeReadyPackage: HotAirReadyPackage = useMemo(
    () =>
      readyPackages.find((p) => p.id === selectedPackageId) ??
      readyPackages[1] ??
      readyPackages[0],
    [readyPackages, selectedPackageId]
  );

  // Автоподбор и ручной медиаплан для Вкладки 2 («Все 12 станций и ручная сборка»)
  const recommendedManualPlan = useMemo(
    () =>
      recommendOptimalMediaPlan({
        niche: activePortrait.niche,
        audience: activePortrait.audience,
        productNote,
        totalBudgetRub: totalBudget,
        spotSeconds,
        spotReadiness,
        stationsCatalog: unifiedCatalog,
        layaPersona: decision.choice,
        aiHint,
      }),
    [
      activePortrait,
      productNote,
      totalBudget,
      spotSeconds,
      spotReadiness,
      unifiedCatalog,
      decision.choice,
      aiHint,
    ]
  );

  const manualPlan: FlexibleMediaPlanResult = useMemo(() => {
    if (manualSelections === null) {
      return recommendedManualPlan;
    }
    return computeFlexibleMediaPlanSummary({
      niche: activePortrait.niche,
      audience: activePortrait.audience,
      productNote,
      totalBudgetRub: totalBudget,
      spotSeconds,
      spotReadiness,
      selectedVariations: manualSelections,
      stationsCatalog: unifiedCatalog,
      layaPersona: decision.choice,
      aiHint,
    });
  }, [
    manualSelections,
    recommendedManualPlan,
    activePortrait,
    productNote,
    totalBudget,
    spotSeconds,
    spotReadiness,
    unifiedCatalog,
    decision.choice,
    aiHint,
  ]);

  const manualScience = useMemo(
    () =>
      evaluateMediaScienceDiagnostic({
        plan: manualPlan,
        campaignGoal,
      }),
    [manualPlan, campaignGoal]
  );

  // Текущий рабочий план для нижней закреплённой панели и КП
  const effectivePlan =
    activeTab === 'packages' ? activeReadyPackage.plan : manualPlan;
  const effectiveScience =
    activeTab === 'packages' ? activeReadyPackage.science : manualScience;

  const activeSelectionMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of manualPlan.selectedQuotes) {
      map.set(q.variation.id, q.spotsCount);
    }
    return map;
  }, [manualPlan.selectedQuotes]);

  const quotesByStationId = useMemo(() => {
    const grouped = new Map<string, ComputedVariationQuote[]>();
    for (const q of manualPlan.allQuotedVariations) {
      const list = grouped.get(q.stationItem.stationId) ?? [];
      list.push(q);
      grouped.set(q.stationItem.stationId, list);
    }
    return grouped;
  }, [manualPlan.allQuotedVariations]);

  const orderedManualStations = useMemo(() => {
    const filtered = manualPlan.stationsCatalog.filter((st) =>
      manualStationFilter === 'all'
        ? true
        : st.audienceTags.includes(manualStationFilter)
    );

    return [...filtered].sort((a, b) => {
      const aQuotes = quotesByStationId.get(a.stationId) ?? [];
      const bQuotes = quotesByStationId.get(b.stationId) ?? [];
      const aHasSelected = aQuotes.some((q) => activeSelectionMap.has(q.variation.id));
      const bHasSelected = bQuotes.some((q) => activeSelectionMap.has(q.variation.id));
      if (aHasSelected !== bHasSelected) {
        return aHasSelected ? -1 : 1;
      }
      const aMaxAff = aQuotes.reduce((m, q) => Math.max(m, q.affinity), 0);
      const bMaxAff = bQuotes.reduce((m, q) => Math.max(m, q.affinity), 0);
      return bMaxAff - aMaxAff;
    });
  }, [
    manualPlan.stationsCatalog,
    manualStationFilter,
    quotesByStationId,
    activeSelectionMap,
  ]);

  const chessboard = useMemo(
    () => buildFlexibleChessboardMatrix(manualPlan.selectedQuotes),
    [manualPlan.selectedQuotes]
  );

  const activeNicheOption =
    MEDIA_NICHE_OPTIONS.find((item) => item.id === activePortrait.niche) ??
    MEDIA_NICHE_OPTIONS[0];

  // Выбор тактильного портрета ЦА: мгновенно обновляет состояние фильтра и пересчитывает пакеты
  const handleSelectPortrait = (nextPortraitId: HotAirPortraitId) => {
    const nextPortrait = getAudiencePortraitById(nextPortraitId);
    setPortraitId(nextPortrait.id);
    setAiHint(null);
    setManualSelections(null);
    setManualStationFilter((prev) =>
      prev === 'all' ? 'all' : nextPortrait.primaryAudienceTag
    );
  };

  // Проверка минимального бюджета 40 000 ₽ для тестового запуска
  const minBudgetValidation = useMemo(() => {
    const digitsOnly = budgetInputDraft.replace(/\D/g, '');
    if (!digitsOnly) {
      return validateMinTestLaunchBudget(0, MIN_TEST_LAUNCH_BUDGET_RUB);
    }
    const parsedDraft = parseInt(digitsOnly, 10);
    return validateMinTestLaunchBudget(parsedDraft, MIN_TEST_LAUNCH_BUDGET_RUB);
  }, [budgetInputDraft]);

  // Управление бюджетом
  const applyClampedBudget = (rawAmount: number) => {
    const check = validateMinTestLaunchBudget(rawAmount, MIN_TEST_LAUNCH_BUDGET_RUB);
    const clamped = Math.max(
      MIN_FLEXIBLE_BUDGET_RUB,
      Math.min(MAX_FLEXIBLE_BUDGET_RUB, check.clampedBudgetRub)
    );
    setTotalBudget(clamped);
    setBudgetInputDraft(formatNumberSpaced(clamped));
    if (activeTab === 'packages') {
      setManualSelections(null);
    }
  };

  const handleManualBudgetInputChange = (rawValue: string) => {
    const digitsOnly = rawValue.replace(/\D/g, '');
    if (!digitsOnly) {
      setBudgetInputDraft('');
      return;
    }
    const parsed = parseInt(digitsOnly, 10);
    const capped = Math.min(MAX_FLEXIBLE_BUDGET_RUB, parsed);
    setBudgetInputDraft(formatNumberSpaced(capped));

    const check = validateMinTestLaunchBudget(capped, MIN_TEST_LAUNCH_BUDGET_RUB);
    if (check.valid && capped >= MIN_FLEXIBLE_BUDGET_RUB) {
      setTotalBudget(capped);
      if (activeTab === 'packages') {
        setManualSelections(null);
      }
    }
  };

  const handleManualBudgetBlur = () => {
    const digitsOnly = budgetInputDraft.replace(/\D/g, '');
    const parsed = digitsOnly ? parseInt(digitsOnly, 10) : MIN_TEST_LAUNCH_BUDGET_RUB;
    applyClampedBudget(parsed);
  };

  // Точный хронометраж (5..60 сек)
  const applyExactSeconds = (rawSec: number) => {
    const clamped = clampExactSpotSeconds(rawSec);
    setSpotSeconds(clamped);
    setSecondsInputDraft(String(clamped));
  };

  const handleManualSecondsInputChange = (rawVal: string) => {
    const digits = rawVal.replace(/\D/g, '').slice(0, 2);
    setSecondsInputDraft(digits);
    if (!digits) return;
    const num = parseInt(digits, 10);
    if (num >= MIN_CUSTOM_SPOT_SECONDS && num <= MAX_CUSTOM_SPOT_SECONDS) {
      setSpotSeconds(num);
    }
  };

  const handleManualSecondsBlur = () => {
    const parsed = parseInt(secondsInputDraft, 10);
    applyExactSeconds(Number.isNaN(parsed) ? spotSeconds : parsed);
  };

  // Опциональный AI-анализ продукта для тонкой ручной сборки на Вкладке 2
  const handleRunSmartMatch = async () => {
    setIsMatchingGrid(true);
    setManualSelections(null);

    let resolvedHint: AiSemanticRecommendationHint | null = null;
    try {
      const response = await fetch('/api/media-planner/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: activePortrait.niche,
          segment: activePortrait.audience.segment,
          ageCore: activePortrait.audience.ageCore,
          listeningContext: activePortrait.audience.listeningContext,
          productNote,
          budgetRub: totalBudget,
          spotSeconds,
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          hint?: AiSemanticRecommendationHint | null;
        };
        if (data?.hint) {
          resolvedHint = data.hint;
        }
      }
    } catch {
      resolvedHint = null;
    }

    setAiHint(resolvedHint);
    setIsMatchingGrid(false);
  };

  // Ручное управление тайм-слотами во Вкладке 2
  const getWorkingSelectionList = (): SelectedVariationState[] => {
    if (manualSelections !== null) {
      return [...manualSelections];
    }
    return manualPlan.selectedQuotes.map((q) => ({
      variationId: q.variation.id,
      spotsCount: q.spotsCount,
    }));
  };

  const handleToggleVariation = (quote: ComputedVariationQuote) => {
    if (!quote.isEligibleForTimeGate || !quote.isEligibleForDuration) return;

    const current = getWorkingSelectionList();
    const exists = current.some((item) => item.variationId === quote.variation.id);
    if (exists) {
      setManualSelections(
        current.filter((item) => item.variationId !== quote.variation.id)
      );
    } else {
      setManualSelections([
        ...current,
        {
          variationId: quote.variation.id,
          spotsCount: quote.spotsCount || quote.variation.defaultSpots,
        },
      ]);
    }
  };

  const handleStepVariationSpots = (quote: ComputedVariationQuote, direction: 1 | -1) => {
    if (!quote.isEligibleForTimeGate || !quote.isEligibleForDuration) return;

    const current = getWorkingSelectionList();
    const step = quote.variation.stepSpots || 2;
    const existingIdx = current.findIndex((item) => item.variationId === quote.variation.id);

    if (existingIdx === -1) {
      if (direction > 0) {
        setManualSelections([
          ...current,
          {
            variationId: quote.variation.id,
            spotsCount: quote.variation.defaultSpots,
          },
        ]);
      }
      return;
    }

    const nextSpots = current[existingIdx].spotsCount + direction * step;
    if (nextSpots < quote.variation.minSpots) {
      setManualSelections(
        current.filter((item) => item.variationId !== quote.variation.id)
      );
      return;
    }

    const clampedSpots = Math.min(quote.variation.maxSpots, nextSpots);
    const updated = [...current];
    updated[existingIdx] = {
      variationId: quote.variation.id,
      spotsCount: clampedSpots,
    };
    setManualSelections(updated);
  };

  const handleToggleBestSlotOnStation = (stationQuotes: readonly ComputedVariationQuote[]) => {
    const current = getWorkingSelectionList();
    const stationIds = new Set(stationQuotes.map((q) => q.variation.id));
    const anyActive = current.some((item) => stationIds.has(item.variationId));

    if (anyActive) {
      setManualSelections(current.filter((item) => !stationIds.has(item.variationId)));
      return;
    }

    const bestEligible = [...stationQuotes]
      .filter((q) => q.isEligibleForTimeGate && q.isEligibleForDuration)
      .sort((a, b) => b.affinity - a.affinity)[0];

    if (bestEligible) {
      setManualSelections([
        ...current,
        {
          variationId: bestEligible.variation.id,
          spotsCount: bestEligible.variation.defaultSpots,
        },
      ]);
    }
  };

  // Перенос выбранного пакета из Вкладки 1 в ручную доводку Вкладки 2
  const handleCustomizePackageInManualTab = (pkg: HotAirReadyPackage) => {
    setSelectedPackageId(pkg.id);
    setManualSelections(pkg.selectedVariations.map((v) => ({ ...v })));
    setActiveTab('manual');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const dispatchPlanReservation = (
    targetPlan: FlexibleMediaPlanResult,
    strategyLabel?: string
  ) => {
    if (onReserveMediaGrid) {
      const basePayload = buildFlexibleReservationPayload({
        plan: targetPlan,
        scriptDraftText,
      });
      const diag = evaluateMediaScienceDiagnostic({
        plan: targetPlan,
        campaignGoal,
      });
      const horizonNote =
        campaignGoal === 'brand_3months'
          ? `Режим: Система узнаваемости от 3 месяцев (1-я волна ${formatRubCompact(targetPlan.totalClientCostRub)}, прогноз 3 мес. без повторной оплаты ролика: ${formatRubCompact(diag.threeMonthProgram.threeMonthsTotalRub)}).`
          : 'Режим: Ударный акционный залп (3–10 дней).';

      const enrichedPayload: MediaGridReservationPayload = {
        ...basePayload,
        nicheLabel: strategyLabel
          ? `${basePayload.nicheLabel} · ${strategyLabel}`
          : basePayload.nicheLabel,
        aiRationale: `${horizonNote} Частота контакта: ~${diag.avgContactsPerListener.toFixed(1).replace('.', ',')} касания на слушателя. ${basePayload.aiRationale}`,
      };
      onReserveMediaGrid(enrichedPayload);
      return;
    }
    setIsStandaloneHoldOpen(true);
  };

  const handleReservePackage = (pkg: HotAirReadyPackage) => {
    dispatchPlanReservation(pkg.plan, `Пакет «${pkg.title}»`);
  };

  const handleReserveActiveSelection = () => {
    if (activeTab === 'packages') {
      dispatchPlanReservation(
        activeReadyPackage.plan,
        `Пакет «${activeReadyPackage.title}»`
      );
    } else {
      dispatchPlanReservation(manualPlan, 'Ручная сборка слотов');
    }
  };

  const handleBoostToBonus = () => {
    const boostedBudget = Math.max(totalBudget, 420_000);
    setTotalBudget(boostedBudget);
    setBudgetInputDraft(formatNumberSpaced(boostedBudget));
    setManualSelections(null);
  };

  const bonusProgressPercent = Math.min(
    100,
    Math.round((manualPlan.hotAirTotalRub / AIR_BONUS_THRESHOLD_RUB) * 100)
  );

  const stickyStationNames = useMemo(() => {
    const names = Array.from(
      new Set(effectivePlan.selectedQuotes.map((q) => q.stationItem.station))
    );
    if (names.length === 0) return 'Слоты не выбраны';
    if (names.length <= 2) return names.join(' + ');
    return `${names.slice(0, 2).join(' + ')} + ещё ${names.length - 2}`;
  }, [effectivePlan.selectedQuotes]);

  return (
    <section
      id="hot-air"
      aria-labelledby="hot-air-heading"
      className="pt-5 sm:pt-7 pb-24 sm:pb-28"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-4 sm:space-y-5 print:hidden">
        {/* Единая минималистичная шапка + переключатель 2 вкладок */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-3.5 pb-4 border-b border-[#111111]/10 dark:border-white/10">
          <div className="max-w-2xl space-y-1">
            <p className="text-xs font-semibold text-[#FF4820]">
              Горящий радиоэфир · Скидка до 45% от прайса станций
            </p>
            <h1
              id="hot-air-heading"
              className="text-2xl sm:text-3xl lg:text-[2.2rem] font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
            >
              Готовые пакеты эфира за 2 шага
            </h1>
            <p className="text-xs sm:text-sm text-[#111111]/66 dark:text-[#F4F3EF]/66">
              Выберите портрет аудитории и бюджет ползунком — или откройте все 12 станций для ручной сборки.
            </p>
          </div>

          {/* Главный переключатель 2 вкладок */}
          <div
            role="tablist"
            aria-label="Режим работы раздела Горящий эфир"
            data-testid="hot-air-main-tabs"
            className="grid grid-cols-2 w-full sm:w-auto sm:inline-flex items-center p-1 rounded-2xl bg-[#EFECE5] dark:bg-[#16161C] border border-[#111111]/10 dark:border-white/10 self-stretch sm:self-start lg:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'packages'}
              data-testid="tab-ready-packages"
              onClick={() => setActiveTab('packages')}
              className={`min-h-[40px] px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap text-center ${
                activeTab === 'packages'
                  ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              Готовые пакеты (3)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'manual'}
              data-testid="tab-all-stations-manual"
              onClick={() => setActiveTab('manual')}
              className={`min-h-[40px] px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap text-center ${
                activeTab === 'manual'
                  ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              <span className="sm:hidden">Все 12 станций</span>
              <span className="hidden sm:inline">Все станции и ручная сборка (12)</span>
            </button>
          </div>
        </header>

        {/* Блок выбора целевой аудитории: ряд из 5 тактильных иконок-портретов */}
        <div
          data-testid="tactile-portraits-block"
          className="space-y-2.5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
                1. Целевая аудитория
              </span>
              <span className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">
                · 1 клик по портрету мгновенно пересчитывает пакеты и станции
              </span>
            </div>
            <span
              data-testid="active-portrait-stations-readout"
              className="text-xs font-medium text-[#111111]/68 dark:text-[#F4F3EF]/68"
            >
              Ядро ЦА: <strong className="text-[#FF4820]">{activePortrait.coreStationsLabel}</strong>
            </span>
          </div>

          <div
            role="radiogroup"
            aria-label="Портрет целевой аудитории"
            data-testid="audience-portraits-row"
            className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5"
          >
            {HOT_AIR_AUDIENCE_PORTRAITS.map((portrait, idx) => {
              const active = portrait.id === portraitId;
              const isFifthMobileFull = idx === HOT_AIR_AUDIENCE_PORTRAITS.length - 1;

              return (
                <button
                  key={portrait.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`portrait-btn-${portrait.id}`}
                  onClick={() => handleSelectPortrait(portrait.id)}
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                    e.preventDefault();
                    const delta = e.key === 'ArrowRight' ? 1 : -1;
                    const nextIdx =
                      (idx + delta + HOT_AIR_AUDIENCE_PORTRAITS.length) %
                      HOT_AIR_AUDIENCE_PORTRAITS.length;
                    handleSelectPortrait(HOT_AIR_AUDIENCE_PORTRAITS[nextIdx].id);
                  }}
                  className={`group min-h-[72px] p-2.5 sm:px-3 sm:py-2.5 rounded-2xl text-left border transition-transform duration-100 cursor-pointer flex items-center gap-2.5 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                    isFifthMobileFull ? 'col-span-2 sm:col-span-1' : ''
                  } ${
                    active
                      ? 'bg-[#111111] text-[#F7F6F2] border-[#111111] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:border-[#F4F3EF] translate-y-[1px]'
                      : 'bg-[#F7F6F2] text-[#111111] border-[#111111]/14 dark:bg-[#16161D] dark:text-[#F4F3EF] dark:border-white/14 shadow-[0_2px_0_0_rgba(17,17,17,0.09)] dark:shadow-[0_2px_0_0_rgba(0,0,0,0.5)] hover:-translate-y-0.5 hover:border-[#111111]/35 dark:hover:border-white/35 active:translate-y-[1px]'
                  }`}
                >
                  {/* Тактильный медальон с иконкой-портретом */}
                  <span
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      active
                        ? 'bg-[#FF4820] text-white'
                        : 'bg-[#EFECE5] dark:bg-[#23232D] text-[#111111] dark:text-[#F4F3EF] group-hover:text-[#FF4820]'
                    }`}
                  >
                    <TactilePortraitEmblem portraitId={portrait.id} />
                  </span>

                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[10px] font-medium tabular-nums truncate ${
                          active
                            ? 'text-[#FF4820]'
                            : 'text-[#111111]/48 dark:text-[#F4F3EF]/48'
                        }`}
                      >
                        {portrait.portraitKeyLabel}
                      </span>
                      {active && (
                        <Check
                          className="w-3.5 h-3.5 text-[#FF4820] shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </span>

                    <span className="block text-xs sm:text-[13px] font-bold leading-snug truncate">
                      {portrait.label}
                    </span>

                    <span
                      className={`block text-[11px] leading-tight truncate ${
                        active
                          ? 'text-[#F7F6F2]/75 dark:text-[#0D0D0F]/72'
                          : 'text-[#111111]/58 dark:text-[#F4F3EF]/58'
                      }`}
                    >
                      {portrait.shortHint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'packages' ? (
          /* ================================================================
             ВКЛАДКА 1: МИНИМАЛИСТИЧНЫЙ ПОДБОР 3 ГОТОВЫХ ПАКЕТОВ СО СКИДКОЙ
             ================================================================ */
          <HotAirPackagesTab
            campaignGoal={campaignGoal}
            onSelectCampaignGoal={setCampaignGoal}
            totalBudget={totalBudget}
            budgetInputDraft={budgetInputDraft}
            minBudgetValidation={minBudgetValidation}
            onSliderBudgetChange={applyClampedBudget}
            onManualBudgetInputChange={handleManualBudgetInputChange}
            onManualBudgetBlur={handleManualBudgetBlur}
            spotReadiness={spotReadiness}
            onChangeSpotReadiness={setSpotReadiness}
            spotSeconds={spotSeconds}
            packages={readyPackages}
            selectedPackageId={selectedPackageId}
            onSelectPackage={setSelectedPackageId}
            onReservePackage={handleReservePackage}
            onCustomizePackageInManualTab={handleCustomizePackageInManualTab}
            onNavigateStation={onNavigateStation}
            onNavigateApproach={onNavigateApproach}
          />
        ) : (
          /* ================================================================
             ВКЛАДКА 2: ВСЕ 12 РАДИОСТАНЦИЙ, ХРОНОМЕТР И РУЧНАЯ СБОРКА СЛОТОВ
             ================================================================ */
          <div data-testid="hot-air-manual-tab" className="space-y-7">
            {/* Панель хронометража до секунды, готовности ролика и фильтра по ЦА */}
            <div className="rounded-3xl bg-[#EFECE5]/90 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 p-5 sm:p-7 space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
                {/* Точный хронометраж ролика 5..60 сек */}
                <div className="lg:col-span-5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                      Точный хронометраж ролика (посекундный прайс)
                    </span>
                    <button
                      type="button"
                      data-testid="toggle-chronometer-btn"
                      aria-expanded={isChronometerOpen}
                      onClick={() => setIsChronometerOpen((prev) => !prev)}
                      className="inline-flex items-center gap-1 font-semibold text-[#FF4820] hover:underline cursor-pointer whitespace-nowrap"
                    >
                      <Calculator className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{isChronometerOpen ? 'Скрыть хронометр' : 'Посчитать по тексту'}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div
                      role="group"
                      aria-label="Стандартный хронометраж ролика"
                      className="flex flex-wrap items-center gap-1"
                    >
                      {STANDARD_SPOT_DURATIONS.map((sec) => {
                        const active = spotSeconds === sec;
                        return (
                          <button
                            key={sec}
                            type="button"
                            data-testid={`duration-preset-${sec}`}
                            onClick={() => applyExactSeconds(sec)}
                            aria-pressed={active}
                            className={`min-h-[38px] px-2.5 py-1 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer border whitespace-nowrap ${
                              active
                                ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] border-transparent'
                                : 'bg-[#F7F6F2] dark:bg-[#0E0E12] text-[#111111]/78 dark:text-[#F4F3EF]/78 border-[#111111]/10 dark:border-white/10 hover:border-[#FF4820]/50'
                            }`}
                          >
                            {sec}с
                          </button>
                        );
                      })}
                    </div>

                    {/* Посекундный степпер (например, 17 сек) */}
                    <div className="inline-flex items-center h-9 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/16 dark:border-white/16 px-1 tabular-nums">
                      <button
                        type="button"
                        data-testid="exact-seconds-minus"
                        onClick={() => applyExactSeconds(spotSeconds - 1)}
                        disabled={spotSeconds <= MIN_CUSTOM_SPOT_SECONDS}
                        aria-label="Уменьшить хронометраж на 1 секунду"
                        className="w-7 h-7 rounded-lg inline-flex items-center justify-center hover:bg-[#111111]/8 dark:hover:bg-white/10 disabled:opacity-35 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <label htmlFor="exact-seconds-input" className="sr-only">
                        Точный хронометраж ролика в секундах
                      </label>
                      <input
                        id="exact-seconds-input"
                        data-testid="exact-seconds-input"
                        type="text"
                        inputMode="numeric"
                        value={secondsInputDraft}
                        onChange={(e) => handleManualSecondsInputChange(e.target.value)}
                        onBlur={handleManualSecondsBlur}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleManualSecondsBlur();
                          }
                        }}
                        className="w-9 text-center text-xs font-bold bg-transparent text-[#111111] dark:text-[#F4F3EF] focus:outline-none"
                      />
                      <span className="pr-1.5 text-[11px] font-semibold text-[#111111]/60 dark:text-[#F4F3EF]/60">
                        сек
                      </span>

                      <button
                        type="button"
                        data-testid="exact-seconds-plus"
                        onClick={() => applyExactSeconds(spotSeconds + 1)}
                        disabled={spotSeconds >= MAX_CUSTOM_SPOT_SECONDS}
                        aria-label="Увеличить хронометраж на 1 секунду"
                        className="w-7 h-7 rounded-lg inline-flex items-center justify-center hover:bg-[#111111]/8 dark:hover:bg-white/10 disabled:opacity-35 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Готовность ролика */}
                <div className="lg:col-span-3 space-y-2">
                  <span className="block text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]">
                    Статус ролика
                  </span>
                  <div
                    role="group"
                    aria-label="Готовность аудиоролика в ручной сборке"
                    className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/12 dark:border-white/12"
                  >
                    <button
                      type="button"
                      onClick={() => setSpotReadiness('need_production_24h')}
                      aria-pressed={spotReadiness === 'need_production_24h'}
                      className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                        spotReadiness === 'need_production_24h'
                          ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                          : 'text-[#111111]/68 dark:text-[#F4F3EF]/68'
                      }`}
                    >
                      Снять за 24ч
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpotReadiness('ready_with_passport')}
                      aria-pressed={spotReadiness === 'ready_with_passport'}
                      className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                        spotReadiness === 'ready_with_passport'
                          ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                          : 'text-[#111111]/68 dark:text-[#F4F3EF]/68'
                      }`}
                    >
                      Свой ролик
                    </button>
                  </div>
                </div>

                {/* Уточнение оффера для ранжирования слотов */}
                <div className="lg:col-span-4 space-y-2">
                  <label
                    htmlFor="media-product-note"
                    className="block text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]"
                  >
                    Продукт / оффер (для точного ранжирования)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="media-product-note"
                      data-testid="media-product-input"
                      type="text"
                      value={productNote}
                      onChange={(e) => setProductNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleRunSmartMatch();
                        }
                      }}
                      placeholder={activeNicheOption.placeholderExample}
                      className="w-full h-10 px-3.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs sm:text-sm text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/40 dark:placeholder:text-[#F4F3EF]/40 focus:outline-none focus:border-[#FF4820]"
                    />
                    <button
                      type="button"
                      data-testid="match-media-grid-btn"
                      disabled={isMatchingGrid}
                      onClick={() => void handleRunSmartMatch()}
                      aria-label="Пересобрать сетку по описанию продукта"
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] hover:bg-[#FF4820] hover:text-white dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{isMatchingGrid ? 'Подбор...' : 'Ранжировать'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <ScriptChronometerPanel
                isOpen={isChronometerOpen}
                scriptText={scriptDraftText}
                tempo={scriptTempo}
                disclaimer={scriptDisclaimer}
                activeSpotSeconds={spotSeconds}
                onChangeScriptText={setScriptDraftText}
                onChangeTempo={setScriptTempo}
                onChangeDisclaimer={setScriptDisclaimer}
                onApplySeconds={applyExactSeconds}
              />

              {/* Фильтр по профилю ЦА среди всех 12 радиостанций */}
              <div className="pt-4 border-t border-[#111111]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="-mx-2 px-2 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
                  <div
                    role="group"
                    aria-label="Фильтр 12 радиостанций по аудитории"
                    className="inline-flex items-center gap-1"
                  >
                    {MANUAL_STATION_FILTERS.map((f) => {
                      const active = manualStationFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setManualStationFilter(f.id)}
                          aria-pressed={active}
                          className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            active
                              ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                              : 'text-[#111111]/66 dark:text-[#F4F3EF]/66 hover:text-[#111111] dark:hover:text-white'
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  role="tablist"
                  aria-label="Режим отображения эфирной сетки"
                  className="inline-flex items-center p-1 rounded-xl bg-[#F7F6F2] dark:bg-[#0E0E12] border border-[#111111]/10 dark:border-white/10 self-start sm:self-auto"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === 'cards'}
                    data-testid="view-mode-cards"
                    onClick={() => setViewMode('cards')}
                    className={`min-h-[34px] px-3.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      viewMode === 'cards'
                        ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                        : 'text-[#111111]/68 dark:text-[#F4F3EF]/68'
                    }`}
                  >
                    Станции и слоты ({orderedManualStations.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === 'chessboard'}
                    data-testid="view-mode-chessboard"
                    onClick={() => setViewMode('chessboard')}
                    className={`min-h-[34px] px-3.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                      viewMode === 'chessboard'
                        ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                        : 'text-[#111111]/68 dark:text-[#F4F3EF]/68'
                    }`}
                  >
                    <span>Шахматка Пн–Вс</span>
                    <span className="text-[11px] font-bold text-[#FF4820] tabular-nums">
                      {manualPlan.totalSpots}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Основная сетка Вкладки 2: 12 радиостанций (слева) + Научная сводка (справа) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
              <div className="lg:col-span-8 space-y-4">
                {manualSelections !== null && (
                  <div className="flex items-center justify-between gap-3 text-xs text-[#111111]/66 dark:text-[#F4F3EF]/66 px-1 tabular-nums">
                    <span>
                      Ручной режим: {manualPlan.selectedStationsCount} ст. ·{' '}
                      {manualPlan.selectedQuotes.length} слотов ({manualPlan.totalSpots} вых.)
                    </span>
                    <button
                      type="button"
                      data-testid="reset-to-optimal-btn"
                      onClick={() => setManualSelections(null)}
                      className="inline-flex items-center gap-1.5 font-semibold text-[#FF4820] hover:underline cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Сбросить к автоподбору</span>
                    </button>
                  </div>
                )}

                {viewMode === 'chessboard' ? (
                  <div
                    data-testid="broadcast-chessboard"
                    className="rounded-3xl bg-[#FFFFFF] dark:bg-[#15151B] border border-[#111111]/12 dark:border-white/12 p-5 sm:p-7 space-y-6"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-[#FF4820]">
                          Распределение выбранных тайм-слотов по дням недели
                        </p>
                        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                          Эфирная шахматка ({chessboard.grandTotalSpots} выходов × {spotSeconds} сек)
                        </h3>
                      </div>
                    </div>

                    {manualPlan.selectedQuotes.length === 0 ? (
                      <div className="py-12 text-center space-y-3 rounded-2xl bg-[#F7F6F2] dark:bg-[#101014] border border-[#111111]/8 dark:border-white/8 px-4">
                        <p className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
                          В шахматке пока не отмечено ни одного эфирного окна
                        </p>
                        <button
                          type="button"
                          onClick={() => setManualSelections(null)}
                          className="min-h-[38px] px-4 py-2 rounded-full bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#111111] text-xs font-semibold cursor-pointer whitespace-nowrap"
                        >
                          Собрать оптимальную сетку
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto subtle-scrollbar -mx-2 px-2">
                          <table className="w-full min-w-[680px] table-fixed border-collapse tabular-nums text-left">
                            <thead>
                              <tr className="border-b border-[#111111]/10 dark:border-white/10">
                                <th className="py-2.5 pr-4 text-xs font-semibold text-[#111111]/55 dark:text-[#F4F3EF]/55 w-[156px]">
                                  Часовой пояс
                                </th>
                                {ALL_WEEKDAY_NUMBERS.map((dayNum) => (
                                  <th
                                    key={dayNum}
                                    className="py-2.5 px-1.5 text-center text-xs font-bold text-[#111111] dark:text-[#F4F3EF]"
                                  >
                                    <div>{ALL_WEEKDAYS[dayNum - 1]}</div>
                                    <div className="text-[10px] font-medium text-[#111111]/45 dark:text-[#F4F3EF]/45">
                                      {chessboard.dayTotals[dayNum] > 0
                                        ? `${chessboard.dayTotals[dayNum]} вых.`
                                        : '—'}
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#111111]/8 dark:divide-white/8">
                              {TIME_BANDS.map((band) => {
                                const bandSum = chessboard.bandTotals[band.id];
                                return (
                                  <tr key={band.id}>
                                    <td className="py-4 pr-4 align-top">
                                      <div className="text-xs sm:text-sm font-bold text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap">
                                        {band.label}
                                      </div>
                                      <div className="text-[11px] text-[#111111]/52 dark:text-[#F4F3EF]/52 mt-0.5">
                                        {band.hoursHint}
                                      </div>
                                      <div className="text-[11px] font-semibold text-[#FF4820] mt-1">
                                        {bandSum > 0 ? `${bandSum} выходов` : 'Нет выходов'}
                                      </div>
                                    </td>

                                    {ALL_WEEKDAY_NUMBERS.map((dayNum) => {
                                      const entries = chessboard.cells[band.id][dayNum];
                                      const count = chessboard.cellTotals[band.id][dayNum];

                                      return (
                                        <td
                                          key={dayNum}
                                          data-testid={`chessboard-cell-${band.id}-${dayNum}`}
                                          className="py-3 px-1.5 align-top"
                                        >
                                          {count === 0 ? (
                                            <div className="min-h-[64px] rounded-xl border border-dashed border-[#111111]/8 dark:border-white/8 flex items-center justify-center text-[11px] text-[#111111]/25 dark:text-[#F4F3EF]/22">
                                              ·
                                            </div>
                                          ) : (
                                            <div className="min-h-[64px] rounded-xl bg-[#F7F6F2] dark:bg-[#1E1E26] border border-[#FF4820]/25 p-2 flex flex-col justify-between gap-2">
                                              <div className="text-xs font-bold text-[#FF4820]">
                                                {count}×
                                              </div>
                                              <div className="space-y-0.5">
                                                <div className="text-[11px] font-bold text-[#111111] dark:text-[#F4F3EF]">
                                                  {count}{' '}
                                                  {count === 1
                                                    ? 'выход'
                                                    : count < 5
                                                      ? 'выхода'
                                                      : 'выходов'}
                                                </div>
                                                <div className="text-[10px] text-[#111111]/58 dark:text-[#F4F3EF]/58 truncate max-w-[82px]">
                                                  {entries
                                                    .map((e) => e.timeSlot)
                                                    .slice(0, 2)
                                                    .join(', ')}
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4" data-testid="media-grid-cards">
                    {orderedManualStations.map((stationItem) => {
                      const stationQuotes = quotesByStationId.get(stationItem.stationId) ?? [];
                      const activeStationQuotes = stationQuotes.filter((q) =>
                        activeSelectionMap.has(q.variation.id)
                      );
                      const isStationActive = activeStationQuotes.length > 0;
                      const stationSubtotalRub = activeStationQuotes.reduce(
                        (sum, q) => sum + q.hotPriceRub,
                        0
                      );
                      const stationTotalSpots = activeStationQuotes.reduce(
                        (sum, q) => sum + q.spotsCount,
                        0
                      );
                      const bestAffinity = stationQuotes.reduce(
                        (maxVal, q) => Math.max(maxVal, q.affinity),
                        0
                      );
                      const stationSlug = stationNameToSlug(stationItem.station);
                      const editorialSeed = editorialSeedBySlug.get(stationSlug);

                      return (
                        <article
                          key={stationItem.stationId}
                          data-testid={`station-card-${stationItem.stationId}`}
                          className={`rounded-3xl p-5 sm:p-6 transition-colors border ${
                            isStationActive
                              ? 'bg-[#FFFFFF] dark:bg-[#16161C] border-[#FF4820]/60'
                              : 'bg-[#FFFFFF]/65 dark:bg-[#121217] border-[#111111]/10 dark:border-white/10 hover:border-[#111111]/24 dark:hover:border-white/24'
                          }`}
                        >
                          {/* Шапка станции: частота, портрет слушателей и ссылка в паспорт станции */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-[#111111]/8 dark:border-white/8">
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60 tabular-nums">
                                <span className="font-semibold text-[#FF4820]">
                                  ЦА до {bestAffinity}%
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{stationItem.frequencyFm}</span>
                                {editorialSeed && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>{editorialSeed.audienceCoreAge}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{editorialSeed.inCarListenSharePct}% в авто</span>
                                  </>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-3">
                                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                                  {stationItem.station}
                                </h3>
                                {onNavigateStation && (
                                  <button
                                    type="button"
                                    data-testid={`open-station-${stationSlug}`}
                                    onClick={() => onNavigateStation(stationSlug)}
                                    className="text-xs font-semibold text-[#111111]/62 dark:text-[#F4F3EF]/62 hover:text-[#FF4820] dark:hover:text-[#FF4820] inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                                  >
                                    <span>Портрет аудитории</span>
                                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                  </button>
                                )}
                              </div>

                              <p className="text-xs sm:text-sm text-[#111111]/66 dark:text-[#F4F3EF]/66">
                                {editorialSeed?.shortPositioning ?? stationItem.formatDesc}
                              </p>
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 tabular-nums">
                              {isStationActive ? (
                                <>
                                  <div className="text-left sm:text-right">
                                    <span className="block text-[11px] text-[#111111]/55 dark:text-[#F4F3EF]/55">
                                      В сетке: {stationTotalSpots} вых.
                                    </span>
                                    <span className="text-lg sm:text-xl font-bold text-[#111111] dark:text-[#F4F3EF]">
                                      {formatRubCompact(stationSubtotalRub)}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleBestSlotOnStation(stationQuotes)}
                                    className="text-[11px] font-semibold text-[#111111]/55 dark:text-[#F4F3EF]/55 hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap"
                                  >
                                    Убрать станцию
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  data-testid={`enable-best-slot-${stationItem.stationId}`}
                                  onClick={() => handleToggleBestSlotOnStation(stationQuotes)}
                                  className="min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#EFECE5] dark:bg-white/8 text-[#111111]/82 dark:text-[#F4F3EF]/82 hover:bg-[#111111] hover:text-white dark:hover:bg-white dark:hover:text-[#111111] transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  Включить лучший слот
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Список тайм-слотов радиостанции */}
                          <div className="mt-3.5 space-y-2">
                            {stationQuotes.map((quote) => {
                              const isChecked = activeSelectionMap.has(quote.variation.id);
                              const isDisabled =
                                !quote.isEligibleForTimeGate || !quote.isEligibleForDuration;

                              return (
                                <div
                                  key={quote.variation.id}
                                  data-testid={`variation-row-${quote.variation.id}`}
                                  className={`rounded-xl px-3.5 py-3 transition-colors border flex flex-col md:flex-row md:items-center justify-between gap-3 tabular-nums ${
                                    isChecked
                                      ? 'bg-[#F7F6F2] dark:bg-[#202029] border-[#FF4820]/50'
                                      : isDisabled
                                        ? 'bg-transparent border-[#111111]/6 dark:border-white/6 opacity-55'
                                        : 'bg-transparent border-[#111111]/10 dark:border-white/10 hover:border-[#111111]/24 dark:hover:border-white/24'
                                  }`}
                                >
                                  <div className="flex items-start gap-3 min-w-0">
                                    <button
                                      type="button"
                                      role="checkbox"
                                      aria-checked={isChecked}
                                      disabled={isDisabled}
                                      data-testid={`toggle-variation-${quote.variation.id}`}
                                      aria-label={`${isChecked ? 'Отключить' : 'Выбрать'} ${quote.variation.label} на ${stationItem.station}`}
                                      onClick={() => handleToggleVariation(quote)}
                                      className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                                        isDisabled
                                          ? 'border-[#111111]/20 dark:border-white/20 cursor-not-allowed'
                                          : isChecked
                                            ? 'bg-[#FF4820] border-[#FF4820] text-white cursor-pointer'
                                            : 'bg-white dark:bg-[#141419] border-[#111111]/25 dark:border-white/25 hover:border-[#FF4820] cursor-pointer'
                                      }`}
                                    >
                                      {isChecked && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                                    </button>

                                    <div className="space-y-0.5 min-w-0">
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                        <button
                                          type="button"
                                          disabled={isDisabled}
                                          onClick={() => handleToggleVariation(quote)}
                                          className={`text-left text-xs sm:text-sm font-bold text-[#111111] dark:text-[#F4F3EF] ${
                                            isDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:text-[#FF4820]'
                                          }`}
                                        >
                                          {quote.variation.label}
                                        </button>
                                        <span className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                                          {quote.variation.hoursWindow} · {quote.variation.daysPattern}
                                        </span>
                                      </div>

                                      <div className="text-[11px] text-[#111111]/62 dark:text-[#F4F3EF]/62 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                        <span>
                                          {quote.variation.hotRatePerSec} ₽/сек (−{quote.discountPercent}%)
                                        </span>
                                        {quote.isEligibleForDuration &&
                                          quote.multiplicity.unbilledPaddingSec > 0 && (
                                            <>
                                              <span aria-hidden="true">·</span>
                                              <span data-testid={`multiplicity-note-${quote.variation.id}`}>
                                                шаг {quote.multiplicity.durationMultiplicitySec}с → {quote.billedSeconds}с
                                              </span>
                                            </>
                                          )}
                                        {!quote.isEligibleForTimeGate && (
                                          <>
                                            <span aria-hidden="true">·</span>
                                            <span className="inline-flex items-center gap-1 font-medium text-[#111111] dark:text-white">
                                              <Clock className="w-3 h-3 text-[#FF4820]" aria-hidden="true" />
                                              Срочно ({quote.variation.deadlineHours}ч) — выберите «Свой ролик»
                                            </span>
                                          </>
                                        )}
                                        {!quote.isEligibleForDuration && (
                                          <>
                                            <span aria-hidden="true">·</span>
                                            <span className="font-medium text-[#111111] dark:text-white">
                                              Лимит слота до {quote.variation.maxSpotSeconds} сек
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between md:justify-end gap-3 pl-8 md:pl-0 shrink-0">
                                    <div
                                      role="group"
                                      aria-label={`Выходы в слоте ${quote.variation.label} на ${stationItem.station}`}
                                      className="inline-flex items-center h-8 rounded-lg bg-[#EFECE5] dark:bg-[#14141A] border border-[#111111]/12 dark:border-white/14 px-1"
                                    >
                                      <button
                                        type="button"
                                        disabled={isDisabled || !isChecked}
                                        data-testid={`spots-minus-${quote.variation.id}`}
                                        onClick={() => handleStepVariationSpots(quote, -1)}
                                        aria-label={`Убавить выходы ${quote.variation.label}`}
                                        className="w-6 h-6 rounded inline-flex items-center justify-center hover:text-[#FF4820] disabled:opacity-30 cursor-pointer"
                                      >
                                        <Minus className="w-3 h-3" aria-hidden="true" />
                                      </button>
                                      <span
                                        data-testid={`spots-count-${quote.variation.id}`}
                                        className="px-2 text-xs font-bold text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap"
                                      >
                                        {quote.spotsCount} вых.
                                      </span>
                                      <button
                                        type="button"
                                        disabled={
                                          isDisabled || quote.spotsCount >= quote.variation.maxSpots
                                        }
                                        data-testid={`spots-plus-${quote.variation.id}`}
                                        onClick={() => handleStepVariationSpots(quote, 1)}
                                        aria-label={`Добавить выходы ${quote.variation.label}`}
                                        className="w-6 h-6 rounded inline-flex items-center justify-center hover:text-[#FF4820] disabled:opacity-30 cursor-pointer"
                                      >
                                        <Plus className="w-3 h-3" aria-hidden="true" />
                                      </button>
                                    </div>

                                    <div className="text-right min-w-[92px]">
                                      <div className="text-[10px] text-[#111111]/45 dark:text-[#F4F3EF]/45 line-through">
                                        {formatRubCompact(quote.officialPriceRub)}
                                      </div>
                                      <div
                                        data-testid={`variation-price-${quote.variation.id}`}
                                        className="text-sm sm:text-base font-bold text-[#111111] dark:text-[#F4F3EF]"
                                      >
                                        {formatRubCompact(quote.hotPriceRub)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Правая сводная колонка Вкладки 2 с научным контролем 5 касаний */}
              <aside
                aria-label="Сводка ручной сборки медиаплана"
                data-testid="media-plan-summary"
                className="lg:col-span-4 lg:sticky lg:top-20 rounded-3xl bg-[#111114] text-[#F4F3EF] border border-white/12 p-6 sm:p-7 space-y-5"
              >
                <div className="space-y-1">
                  <p className="text-xs font-medium text-white/55">
                    Ручная сборка · Ролик {spotSeconds} сек
                  </p>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                    Контроль эффективности
                  </h3>
                </div>

                {/* Научный индикатор 5+ касаний (защита клиента от слива бюджета) */}
                <div
                  data-testid="manual-science-diagnostic"
                  className="rounded-2xl bg-white/[0.05] border border-white/10 p-4 space-y-2 tabular-nums"
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                    <span className="inline-flex items-center gap-1.5 text-[#FFB36B]">
                      {manualScience.verdictLevel === 'under_threshold' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-[#FF4820]" aria-hidden="true" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-[#FF4820]" aria-hidden="true" />
                      )}
                      <span>Частота по науке (норма 5+)</span>
                    </span>
                    <span className="text-white font-bold">
                      ~{manualScience.avgContactsPerListener.toFixed(1).replace('.', ',')}×
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-white/80">
                    {manualScience.verdictExplanation}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 py-3.5 border-y border-white/10 tabular-nums">
                  <div>
                    <p className="text-xs text-white/55">Выходов в эфир</p>
                    <p
                      data-testid="summary-total-spots"
                      className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-0.5"
                    >
                      {manualPlan.totalSpots}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/55">Охват OTS</p>
                    <p
                      data-testid="summary-total-ots"
                      className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-0.5"
                    >
                      {formatNumberSpaced(manualPlan.totalReachOTS)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 text-sm tabular-nums">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-white/68">Прайс без скидки</span>
                    <span className="text-white/45 line-through">
                      {formatRubCompact(manualPlan.officialAirTotalRub)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-white/85">Горящий эфир ({spotSeconds}с)</span>
                    <span className="font-semibold text-white">
                      {formatRubCompact(manualPlan.hotAirTotalRub)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-white/85">
                      {manualPlan.production.isBonusUnlocked
                        ? 'Ролик по квоте'
                        : spotReadiness === 'ready_with_passport'
                          ? 'Готовый ролик'
                          : `Съёмка ролика (${spotSeconds}с)`}
                    </span>
                    <span
                      data-testid="summary-production-price"
                      className={
                        manualPlan.production.isBonusUnlocked
                          ? 'font-bold text-[#FF4820]'
                          : 'font-semibold text-white'
                      }
                    >
                      {manualPlan.production.isBonusUnlocked
                        ? '0 ₽ бонус'
                        : formatRubCompact(manualPlan.production.effectivePriceRub)}
                    </span>
                  </div>

                  {!manualPlan.production.isBonusUnlocked && (
                    <div
                      data-testid="bonus-booster-card"
                      className="rounded-2xl bg-white/[0.05] border border-white/10 p-3.5 space-y-2"
                    >
                      <p className="text-xs text-white/80">
                        От <strong>400 000 ₽</strong> эфира съёмка ролика — <strong>0 ₽</strong> (осталось{' '}
                        <span className="text-[#FFB36B] font-semibold">
                          {formatRubCompact(manualPlan.remainingToBonusRub)}
                        </span>
                        ).
                      </p>
                      <progress
                        value={bonusProgressPercent}
                        max={100}
                        aria-label="Прогресс до бесплатного производства ролика"
                        className="w-full h-1.5 rounded-full appearance-none overflow-hidden [&::-webkit-progress-bar]:bg-white/12 [&::-webkit-progress-value]:bg-[#FF4820] [&::-moz-progress-bar]:bg-[#FF4820]"
                      />
                      <button
                        type="button"
                        data-testid="boost-to-bonus-btn"
                        onClick={handleBoostToBonus}
                        className="w-full min-h-[34px] px-3 py-1 rounded-xl bg-white/10 hover:bg-[#FF4820] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Пакет 420 000 ₽ с роликом 0 ₽
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-white/12 flex items-baseline justify-between gap-3 tabular-nums">
                  <span className="text-sm text-white/75">Итого к запуску</span>
                  <span
                    data-testid="summary-total-cost"
                    className="text-2xl sm:text-3xl font-bold tracking-tight text-white"
                  >
                    {formatRubCompact(manualPlan.totalClientCostRub)}
                  </span>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    data-testid="reserve-media-grid-btn"
                    disabled={manualPlan.selectedQuotes.length === 0}
                    onClick={() => dispatchPlanReservation(manualPlan, 'Ручная сборка слотов')}
                    className="w-full min-h-[46px] px-4 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63C17] disabled:opacity-45 disabled:pointer-events-none text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Зарезервировать сетку на 4 ч
                  </button>

                  <button
                    type="button"
                    data-testid="open-kp-proposal-btn"
                    disabled={manualPlan.selectedQuotes.length === 0}
                    onClick={() => setIsProposalModalOpen(true)}
                    className="w-full min-h-[42px] px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.13] border border-white/16 disabled:opacity-45 disabled:pointer-events-none text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#FFB36B] shrink-0" aria-hidden="true" />
                    <span>Скачать медиаплан (КП)</span>
                  </button>
                </div>
              </aside>
            </div>
          </div>
        )}
      </div>

      {/* Компактная нижняя закреплённая панель: бронь и шаг бюджета без скролла вверх-вниз (<= 15% mobile cap) */}
      <div
        data-testid="sticky-hot-air-bar"
        className={`fixed inset-x-0 z-30 border-t border-[#111111]/12 dark:border-white/12 bg-[#F7F6F2]/95 dark:bg-[#111115]/95 backdrop-blur-md transition-all print:hidden ${
          isCasePlayerVisible ? 'bottom-[68px] sm:bottom-[82px]' : 'bottom-0'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-12 h-[58px] sm:h-[68px] flex items-center justify-between gap-2.5 sm:gap-5 tabular-nums">
          {/* Левая часть: выбранный пакет / станции */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#111111] dark:text-[#F4F3EF] truncate">
              <span className="truncate">
                {activeTab === 'packages'
                  ? `Пакет «${activeReadyPackage.title}»`
                  : 'Ручная сборка'}
              </span>
              <span className="hidden md:inline text-xs font-normal text-[#111111]/58 dark:text-[#F4F3EF]/58 truncate">
                · {stickyStationNames} · {effectivePlan.totalSpots} вых. (~
                {effectiveScience.avgContactsPerListener.toFixed(1).replace('.', ',')}×)
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-[#111111]/62 dark:text-[#F4F3EF]/62 truncate">
              <span className="font-bold text-[#111111] dark:text-[#F4F3EF] sm:hidden whitespace-nowrap">
                {formatRubCompact(effectivePlan.totalClientCostRub)}
              </span>
              <span className="text-[#FF4820] font-semibold whitespace-nowrap">
                <span className="sm:hidden">
                  · −{effectivePlan.airDiscountPercent}%
                </span>
                <span className="hidden sm:inline">
                  Выгода {formatRubCompact(effectivePlan.totalSavingsRub)} (−
                  {effectivePlan.airDiscountPercent}%)
                </span>
              </span>
            </div>
          </div>

          {/* Быстрый шаг бюджета без подъёма к ползунку (мобильный + десктоп) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="sticky-budget-minus"
              disabled={totalBudget <= MIN_FLEXIBLE_BUDGET_RUB}
              onClick={() => applyClampedBudget(totalBudget - 25_000)}
              aria-label="Уменьшить бюджет на 25 000 рублей"
              className="h-8 w-8 lg:h-9 lg:w-auto lg:px-2.5 rounded-lg border border-[#111111]/14 dark:border-white/14 text-xs font-semibold hover:border-[#FF4820] disabled:opacity-35 cursor-pointer whitespace-nowrap inline-flex items-center justify-center"
            >
              <span className="lg:hidden">−</span>
              <span className="hidden lg:inline">−25 тыс.</span>
            </button>
            <span className="hidden lg:inline px-2 text-xs font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70 whitespace-nowrap">
              Бюджет {formatRubCompact(totalBudget)}
            </span>
            <button
              type="button"
              data-testid="sticky-budget-plus"
              disabled={totalBudget >= MAX_FLEXIBLE_BUDGET_RUB}
              onClick={() => applyClampedBudget(totalBudget + 25_000)}
              aria-label="Увеличить бюджет на 25 000 рублей"
              className="h-8 w-8 lg:h-9 lg:w-auto lg:px-2.5 rounded-lg border border-[#111111]/14 dark:border-white/14 text-xs font-semibold hover:border-[#FF4820] disabled:opacity-35 cursor-pointer whitespace-nowrap inline-flex items-center justify-center"
            >
              <span className="lg:hidden">+</span>
              <span className="hidden lg:inline">+25 тыс.</span>
            </button>
          </div>

          {/* Правая часть: итоговая сумма (десктоп/планшет) + прямая кнопка бронирования */}
          <div className="flex items-center gap-3 shrink-0">
            <span
              data-testid="sticky-total-price"
              className="hidden sm:inline text-lg sm:text-xl font-bold text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap"
            >
              {formatRubCompact(effectivePlan.totalClientCostRub)}
            </span>

            <button
              type="button"
              data-testid="sticky-reserve-btn"
              disabled={effectivePlan.selectedQuotes.length === 0}
              onClick={handleReserveActiveSelection}
              className="min-h-[40px] sm:min-h-[44px] px-3.5 sm:px-6 py-2 rounded-full bg-[#FF4820] hover:bg-[#E63C17] disabled:opacity-45 disabled:pointer-events-none text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span className="sm:hidden">Резерв →</span>
              <span className="hidden sm:inline">Оформить резерв →</span>
            </button>
          </div>
        </div>
      </div>

      {/* Модальное окно КП */}
      <MediaProposalModal
        isOpen={isProposalModalOpen}
        plan={effectivePlan}
        onClose={() => setIsProposalModalOpen(false)}
        onReserveFromProposal={handleReserveActiveSelection}
      />

      {/* Резервное окно бронирования (при автономном рендере) */}
      <StandaloneHoldModal
        isOpen={isStandaloneHoldOpen}
        plan={effectivePlan}
        onClose={() => setIsStandaloneHoldOpen(false)}
      />
    </section>
  );
}
