import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Pause,
  Play,
  Radio,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useLayoutEffect, useState } from 'react';
import type { CasePlayerSnapshot } from '../../audio/lazyAudioEngines';
import { useStudioCms } from '../../cms/StudioCmsContext';
import { formatAudioTime } from '../../data/audioworksCommercial';
import { BrandCasePoster, CaseId } from '../../data/casesData';
import {
  buildStationCatalogProfiles,
  getCaseDetailedBreakdown,
  INDUSTRY_SOLUTIONS,
  LOCAL_EDITORIAL_IMAGES,
  stationNameToSlug,
} from '../../data/multiPageContentData';
import { orderDraftStore } from '../../data/orderDraftStore';
import { AIRTIME_SALES_ENABLED } from '../../data/platformFeatures';
import {
  IndustryVerticalSlug,
  PlatformRoute,
  VALID_INDUSTRY_SLUGS,
} from '../../data/platformRouter';
import { formatNumberSpaced, radioInventoryStore } from '../../data/radioInventory';
import { CasesGallery } from '../CasesGallery';
import { OgSharePreviewCard } from '../OgSharePreviewCard';
import { OptimizedImage } from '../OptimizedImage';
import { PremiumAcousticWaveform } from '../PremiumAcousticWaveform';

interface CasesPageProps {
  caseSlug?: string;
  industrySlug?: IndustryVerticalSlug;
  scrollAnchor?: string;
  searchQuery?: string;
  navigationTick?: number;
  playerSnap: CasePlayerSnapshot;
  onToggleCase: (item: BrandCasePoster) => void;
  onSeekCase?: (item: BrandCasePoster, ratio: number) => void;
  onWarmCasePlayer?: () => void;
  onStopPreview: (caseId: CaseId) => void;
  onNavigate: (route: PlatformRoute, options?: { replace?: boolean }) => void;
}

export function CasesPage({
  caseSlug,
  industrySlug,
  scrollAnchor,
  searchQuery = '',
  navigationTick = 0,
  playerSnap,
  onToggleCase,
  onSeekCase,
  onWarmCasePlayer,
  onStopPreview,
  onNavigate,
}: CasesPageProps) {
  const { snapshot } = useStudioCms();
  const [draftQuery, setDraftQuery] = useState(searchQuery);

  useEffect(() => {
    setDraftQuery(searchQuery);
  }, [searchQuery]);

  const applyCaseSearch = (nextQuery: string) => {
    const clean = nextQuery.trim();
    onNavigate(
      clean ? { kind: 'cases', searchQuery: clean } : { kind: 'cases' },
      { replace: true }
    );
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    applyCaseSearch(draftQuery);
  };

  useLayoutEffect(() => {
    if (caseSlug || industrySlug || !scrollAnchor || typeof document === 'undefined') return;
    const target = document.getElementById(scrollAnchor);
    if (target) {
      target.scrollIntoView({
        behavior: 'instant' as ScrollBehavior,
        block: 'start',
      });
    }
  }, [caseSlug, industrySlug, scrollAnchor, navigationTick]);

  const allCases = [snapshot.flagshipReel, ...snapshot.portfolioCases];

  if (industrySlug) {
    return (
      <IndustrySolutionSubpage
        industrySlug={industrySlug}
        allCases={allCases}
        playerSnap={playerSnap}
        onToggleCase={onToggleCase}
        onNavigate={onNavigate}
      />
    );
  }

  if (caseSlug) {
    const matchedCase =
      allCases.find((c) => c.id.toLowerCase() === caseSlug.toLowerCase()) ?? null;
    return (
      <CaseDetailSubpage
        item={matchedCase}
        allCases={allCases}
        playerSnap={playerSnap}
        onToggleCase={onToggleCase}
        onSeekCase={onSeekCase}
        onWarmCasePlayer={onWarmCasePlayer}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div data-testid="cases-hub-page">
      {/* Вводный редакционный заголовок архива кейсов и отраслей */}
      <section className="pt-10 sm:pt-14 pb-2 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-[#111111]/10 dark:border-white/10">
          <div className="max-w-3xl space-y-3">
            <p className="text-sm font-medium text-[#111111]/56 dark:text-[#F4F3EF]/56">
              Доказательная база студии · Сценарии, таймкоды и отраслевая специфика
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] editorial-balance">
              Кейсы аудиорекламы и отраслевые решения
            </h1>
            <p className="text-base sm:text-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 editorial-pretty">
              Слушайте готовые эфирные ролики и открывайте детальный разбор каждого проекта: от клиентского брифа и партитуры сценария до юридической адаптации и цифр отклика.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
            <form
              role="search"
              onSubmit={handleSearchSubmit}
              className="flex items-center gap-2 rounded-full border border-[#111111]/16 dark:border-white/16 bg-white/80 dark:bg-[#141418] px-3.5 py-1.5 min-h-[44px] w-full sm:w-80 focus-within:border-[#FF4820] transition-colors"
            >
              <Search className="w-4 h-4 text-[#111111]/50 dark:text-[#F4F3EF]/50 shrink-0" aria-hidden="true" />
              <label htmlFor="cases-search-input" className="sr-only">
                Поиск по кейсам и отраслям
              </label>
              <input
                id="cases-search-input"
                type="search"
                data-testid="cases-search-input"
                value={draftQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setDraftQuery(val);
                  applyCaseSearch(val);
                }}
                placeholder="Поиск по кейсам и нишам..."
                className="w-full bg-transparent text-sm text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/45 dark:placeholder:text-[#F4F3EF]/45 outline-none"
              />
              {draftQuery && (
                <button
                  type="button"
                  data-testid="cases-search-reset"
                  aria-label="Сбросить поиск по кейсам"
                  onClick={() => {
                    setDraftQuery('');
                    applyCaseSearch('');
                  }}
                  className="p-1 rounded-full hover:bg-[#111111]/8 dark:hover:bg-white/10 text-[#111111]/60 dark:text-[#F4F3EF]/60 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </form>

            <a
              href="#industry-solutions-hub"
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById('industry-solutions-hub')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="min-h-[44px] max-w-full px-4 sm:px-5 py-2.5 rounded-full border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors sm:whitespace-nowrap shrink-0 self-start lg:self-auto"
            >
              <span>Отраслевые решения: ЖК, медицина, ритейл, B2B ↓</span>
            </a>
          </div>
        </div>
      </section>

      {/* Витрина кейсов с переходом в детальный разбор сценария */}
      <CasesGallery
        playerSnap={playerSnap}
        searchQuery={draftQuery}
        onResetSearch={() => {
          setDraftQuery('');
          applyCaseSearch('');
        }}
        onToggleCase={onToggleCase}
        onSeekCase={onSeekCase}
        onWarmCasePlayer={onWarmCasePlayer}
        onStopPreview={onStopPreview}
        onOpenCaseDetail={(id) => onNavigate({ kind: 'case-detail', caseSlug: id })}
      />

      {/* 4 Отраслевых решения (ЖК, Медицина, Ритейл, B2B) */}
      <section
        id="industry-solutions-hub"
        aria-labelledby="industry-hub-heading"
        className="scroll-mt-20 py-20 sm:py-28 border-t border-[#111111]/10 dark:border-white/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-12">
          <div className="max-w-3xl space-y-3">
            <p className="text-sm font-medium text-[#111111]/56 dark:text-[#F4F3EF]/56">
              Отраслевая экспертиза FMWorks
            </p>
            <h2
              id="industry-hub-heading"
              className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.06] editorial-balance"
            >
              Отраслевые решения для ЖК, медицины, ритейла и B2B
            </h2>
            <p className="text-base sm:text-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 editorial-pretty">
              В каждой индустрии свои правила слухового доверия, свой оптимальный хронометраж и свои требования ФЗ «О рекламе». Мы собрали готовые стандарты запуска по четырём ключевым рынкам.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {VALID_INDUSTRY_SLUGS.map((slug, idx) => {
              const spec = INDUSTRY_SOLUTIONS[slug];
              return (
                <article
                  key={slug}
                  data-testid={`industry-card-${slug}`}
                  className="group rounded-3xl overflow-hidden bg-[#EFECE5]/80 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 hover:border-[#FF4820]/60 transition-colors flex flex-col justify-between"
                >
                  <div className="relative h-56 sm:h-64 overflow-hidden bg-[#18181D]">
                    <OptimizedImage
                      src={spec.coverImageUrl}
                      fallbackSrc={LOCAL_EDITORIAL_IMAGES.studioHero}
                      alt={spec.coverImageAlt}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-[#0D0D10]/85 via-[#0D0D10]/25 to-transparent"
                    />
                    <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-xs font-medium text-white/85 tabular-nums">
                      <span>0{idx + 1}. {spec.shortTitle}</span>
                      <span>Оптимально: {spec.optimalDurationRange}</span>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between gap-6">
                    <div className="space-y-3">
                      <h3 className="text-2xl sm:text-3xl font-bold tracking-tight group-hover:text-[#FF4820] transition-colors">
                        {spec.fullTitle}
                      </h3>
                      <p className="text-sm sm:text-base leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72">
                        {spec.heroSummary}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-[#111111]/10 dark:border-white/10 flex items-center justify-between gap-4">
                      <span className="text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
                        Эталонный сценарий + чек-лист ФЗ-38
                      </span>
                      <button
                        type="button"
                        data-testid={`open-industry-${slug}`}
                        onClick={() =>
                          onNavigate({ kind: 'industry-detail', industrySlug: slug })
                        }
                        className="min-h-[42px] px-4 py-2 rounded-full bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] group-hover:bg-[#FF4820] group-hover:text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <span>Открыть решение</span>
                        <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

interface CaseDetailSubpageProps {
  item: BrandCasePoster | null;
  allCases: readonly BrandCasePoster[];
  playerSnap: CasePlayerSnapshot;
  onToggleCase: (item: BrandCasePoster) => void;
  onSeekCase?: (item: BrandCasePoster, ratio: number) => void;
  onWarmCasePlayer?: () => void;
  onNavigate: (route: PlatformRoute) => void;
}

function CaseDetailSubpage({
  item,
  allCases,
  playerSnap,
  onToggleCase,
  onSeekCase,
  onWarmCasePlayer,
  onNavigate,
}: CaseDetailSubpageProps) {
  if (!item) {
    return (
      <section className="py-20 px-4 sm:px-6 lg:px-12 max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Кейс не найден</h1>
        <button
          type="button"
          onClick={() => onNavigate({ kind: 'cases' })}
          className="min-h-[44px] px-6 py-2.5 rounded-full bg-[#FF4820] text-white text-sm font-semibold cursor-pointer"
        >
          Вернуться в архив кейсов
        </button>
      </section>
    );
  }

  const detail = getCaseDetailedBreakdown({
    id: item.id,
    client: item.client,
    tag: item.tag,
    summary: item.summary,
    durationSec: item.durationSec,
  });

  const isPlayingThis =
    playerSnap.isPlaying &&
    playerSnap.playbackMode === 'full' &&
    playerSnap.activeCase?.id === item.id;

  const handleOrderSimilar = () => {
    orderDraftStore.prepareProductionOrder({
      formatId: detail.recommendedOrderTier,
      industryPreset: detail.industrySlug,
      spotDurationSec: detail.spotSeconds <= 60 ? detail.spotSeconds : 20,
      briefHint: `Ориентир по подаче: кейс «${item.client}» (${detail.spotSeconds} сек).`,
      returnPath: `/cases/${item.id}`,
    });
    onNavigate({ kind: 'order' });
  };

  const otherCases = allCases.filter((c) => c.id !== item.id).slice(0, 2);

  return (
    <article
      data-testid="case-detail-page"
      className="py-10 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-12"
    >
      <div className="max-w-7xl mx-auto space-y-12 sm:space-y-16">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#111111]/10 dark:border-white/10">
          <button
            type="button"
            onClick={() => onNavigate({ kind: 'cases' })}
            className="min-h-[42px] inline-flex items-center gap-2 text-sm font-medium text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Ко всем кейсам и отраслевым решениям</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onNavigate({ kind: 'industry-detail', industrySlug: detail.industrySlug })
            }
            className="text-xs sm:text-sm font-semibold text-[#FF4820] hover:underline cursor-pointer"
          >
            Отраслевой стандарт: {detail.industryLabel} →
          </button>
        </div>

        {/* Двухколоночный Hero-разворот кейса с плеером */}
        <div className="grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden border border-[#111111]/10 dark:border-white/10 items-stretch">
          <div
            className={`lg:col-span-7 ${item.editorialSurfaceBg} text-[#F4F3EF] p-7 sm:p-11 lg:p-14 flex flex-col justify-between gap-8`}
          >
            <div className="space-y-4">
              <p className="text-xs sm:text-sm font-medium text-white/68 tabular-nums">
                {detail.industryLabel} · {detail.formatLabel} · {detail.spotSeconds} сек
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.06] text-white editorial-balance">
                {item.client}: {item.headline}
              </h1>
              <p className="text-base sm:text-lg text-white/78 leading-relaxed editorial-pretty">
                {item.summary}
              </p>
            </div>

            <div className="space-y-4 pt-2 min-w-0">
              <PremiumAcousticWaveform
                seedKey={item.id}
                isActive={isPlayingThis}
                progressRatio={isPlayingThis ? playerSnap.progress : 0}
                spectrumBands={playerSnap.spectrumBands}
                variant="dark-surface"
                heightClass="h-11 sm:h-10"
                onScrubStart={onWarmCasePlayer}
                onSeekRatio={
                  onSeekCase ? (ratio) => onSeekCase(item, ratio) : undefined
                }
                seekAriaLabel={`Перемотка ролика: ${item.client}`}
                progressBarTestId="case-detail-scrubber"
                ariaValueNow={isPlayingThis ? Math.round(playerSnap.progress * 100) : 0}
                ariaValueText={
                  isPlayingThis
                    ? `${formatAudioTime(playerSnap.currentTimeSec)} из ${formatAudioTime(item.durationSec)}`
                    : `Нажмите или проведите для прослушивания с нужной секунды (${formatAudioTime(item.durationSec)})`
                }
              />

              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 min-w-0">
                <button
                  type="button"
                  data-testid="case-detail-play-btn"
                  onClick={() => onToggleCase(item)}
                  className={`w-full sm:w-auto min-h-[48px] px-5 sm:px-6 py-3 rounded-full inline-flex items-center justify-center gap-2.5 text-sm font-semibold text-center leading-snug transition-colors cursor-pointer sm:whitespace-nowrap ${
                    isPlayingThis
                      ? 'bg-[#FF4820] text-white'
                      : 'bg-white text-[#111111] hover:bg-[#FF4820] hover:text-white'
                  }`}
                >
                  {isPlayingThis ? (
                    <Pause className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                  ) : (
                    <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                  )}
                  <span className="tabular-nums">
                    {isPlayingThis
                      ? `Пауза · ${formatAudioTime(playerSnap.currentTimeSec)}`
                      : `Слушать эфирный ролик · ${formatAudioTime(item.durationSec)}`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleOrderSimilar}
                  className="w-full sm:w-auto min-h-[48px] px-5 sm:px-6 py-3 rounded-full border border-white/24 hover:border-white text-white text-sm font-semibold text-center leading-snug transition-colors cursor-pointer sm:whitespace-nowrap"
                >
                  Заказать ролик такого уровня
                </button>
              </div>
            </div>
          </div>

          <div className={`lg:col-span-5 relative min-h-[280px] lg:min-h-full ${item.posterGradientClass}`}>
            <OptimizedImage
              src={item.coverImageUrl}
              fallbackSrc={LOCAL_EDITORIAL_IMAGES.studioHero}
              alt={item.coverImageAlt}
              priority
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Карточка шеринга с Canvas API OpenGraph-превью */}
        <OgSharePreviewCard
          routePath={`/cases/${item.id}`}
          shareTitle={`${item.client}: ${item.headline} | FMWorks`}
          shareDescription={item.summary}
          downloadFileSlug={`case-${item.id}`}
        />

        {/* 3 измеримых показателя кейса */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-y border-[#111111]/12 dark:border-white/12 divide-y md:divide-y-0 md:divide-x divide-[#111111]/12 dark:divide-white/12 tabular-nums">
          {detail.metrics.map((m, i) => (
            <div
              key={m.label}
              className={`py-6 ${i === 0 ? 'md:pr-8' : i === 1 ? 'md:px-8' : 'md:pl-8'}`}
            >
              <p className="text-3xl sm:text-4xl font-bold text-[#FF4820]">{m.value}</p>
              <p className="text-base font-bold mt-1">{m.label}</p>
              <p className="text-xs sm:text-sm text-[#111111]/64 dark:text-[#F4F3EF]/64 mt-1">
                {m.context}
              </p>
            </div>
          ))}
        </div>

        {/* Задача клиента, режиссёрское решение и юридический комплаенс */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#111111]/55 dark:text-[#F4F3EF]/55">
                01. Исходная бизнес-задача и барьер эфира
              </p>
              <p className="text-base sm:text-lg leading-relaxed text-[#111111]/82 dark:text-[#F4F3EF]/82">
                {detail.clientChallenge}
              </p>
            </div>

            <div className="pt-5 border-t border-[#111111]/10 dark:border-white/10 space-y-2">
              <p className="text-xs font-semibold text-[#111111]/55 dark:text-[#F4F3EF]/55">
                02. Акустическая и драматургическая концепция
              </p>
              <p className="text-base sm:text-lg leading-relaxed text-[#111111]/82 dark:text-[#F4F3EF]/82">
                {detail.dramaticSolution}
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-3xl p-6 sm:p-8 bg-[#EFECE5]/80 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 space-y-4">
            <p className="text-xs font-semibold text-[#FF4820] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Юридическая очистка и хронометраж</span>
            </p>
            <h2 className="text-xl font-bold tracking-tight">
              Как прошли модерацию радиосетей без потери темпа
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-[#111111]/74 dark:text-[#F4F3EF]/74">
              {detail.legalAdaptationNote}
            </p>
            <div className="pt-3 border-t border-[#111111]/10 dark:border-white/10 space-y-2">
              <p className="text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
                {AIRTIME_SALES_ENABLED
                  ? 'Рекомендуемые станции под этот формат:'
                  : 'Целевой эфирный формат проекта:'}
              </p>
              {AIRTIME_SALES_ENABLED ? (
                <div className="flex flex-wrap gap-2">
                  {detail.recommendedStations.map((stName) => (
                    <button
                      key={stName}
                      type="button"
                      onClick={() =>
                        onNavigate({
                          kind: 'station-detail',
                          stationSlug: stationNameToSlug(stName),
                        })
                      }
                      className="min-h-[36px] px-3.5 rounded-full border border-[#111111]/15 dark:border-white/15 hover:border-[#FF4820] text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {stName} →
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
                  {detail.recommendedStations.join(' · ')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Полный текст сценария и посекундная партитура */}
        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#111111]/56 dark:text-[#F4F3EF]/56">
              03. Полный сценарий ролика по секундам
            </p>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">
              Посекундная партитура и режиссёрские ремарки
            </h2>
          </div>

          <div
            data-testid="case-script-table"
            className="border-y border-[#111111]/12 dark:border-white/12 divide-y divide-[#111111]/12 dark:divide-white/12"
          >
            {detail.scriptCues.map((cue) => (
              <div
                key={cue.timecode}
                className="py-6 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 items-start"
              >
                <div className="lg:col-span-3 space-y-1 tabular-nums">
                  <p className="text-lg font-bold text-[#FF4820]">{cue.timecode}</p>
                  <p className="text-xs font-semibold text-[#111111]/62 dark:text-[#F4F3EF]/62">
                    {cue.layerLabel}
                  </p>
                </div>

                <div className="lg:col-span-5">
                  <p className="text-base sm:text-lg font-medium leading-relaxed text-[#111111] dark:text-[#F4F3EF]">
                    {cue.spokenOrFoley}
                  </p>
                </div>

                <div className="lg:col-span-4">
                  <p className="text-xs sm:text-sm leading-relaxed text-[#111111]/65 dark:text-[#F4F3EF]/65">
                    Замысел: {cue.directorNote}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Следующие кейсы */}
        {otherCases.length > 0 && (
          <section className="pt-6 border-t border-[#111111]/10 dark:border-white/10 space-y-5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Другие детальные разборы сценариев
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {otherCases.map((oc) => (
                <button
                  key={oc.id}
                  type="button"
                  onClick={() => onNavigate({ kind: 'case-detail', caseSlug: oc.id })}
                  className="text-left rounded-2xl p-6 bg-[#EFECE5]/70 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 hover:border-[#FF4820] transition-colors cursor-pointer space-y-2"
                >
                  <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                    {oc.tag} · {oc.durationSec} сек
                  </p>
                  <p className="text-xl font-bold">
                    {oc.client} — {oc.headline}
                  </p>
                  <p className="text-xs font-semibold text-[#FF4820]">
                    Открыть сценарий и показатели →
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}

interface IndustrySolutionSubpageProps {
  industrySlug: IndustryVerticalSlug;
  allCases: readonly BrandCasePoster[];
  playerSnap: CasePlayerSnapshot;
  onToggleCase: (item: BrandCasePoster) => void;
  onNavigate: (route: PlatformRoute) => void;
}

function IndustrySolutionSubpage({
  industrySlug,
  allCases,
  playerSnap,
  onToggleCase,
  onNavigate,
}: IndustrySolutionSubpageProps) {
  const spec = INDUSTRY_SOLUTIONS[industrySlug];
  const stationCatalog = buildStationCatalogProfiles(radioInventoryStore.getActiveSlots());
  const recommendedStations = spec.recommendedStationSlugs
    .map((slug) => stationCatalog.find((s) => s.slug === slug))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const relatedCases = allCases.filter((c) => spec.relatedCaseIds.includes(c.id));

  const handleStartIndustryOrder = () => {
    orderDraftStore.prepareProductionOrder({
      formatId: spec.recommendedTier,
      industryPreset: spec.slug,
      spotDurationSec: spec.defaultDurationSec,
      briefHint: `Отраслевой запуск (${spec.shortTitle}), ориентировочный хронометраж ${spec.defaultDurationSec} сек.`,
      returnPath: `/cases/industry/${spec.slug}`,
    });
    onNavigate({ kind: 'order' });
  };

  return (
    <article
      data-testid={`industry-detail-page-${industrySlug}`}
      className="py-10 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-12"
    >
      <div className="max-w-7xl mx-auto space-y-12 sm:space-y-16">
        {/* Навигация + быстрые вкладки между 4 отраслями */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#111111]/10 dark:border-white/10">
          <button
            type="button"
            onClick={() => onNavigate({ kind: 'cases' })}
            className="min-h-[42px] inline-flex items-center gap-2 text-sm font-medium text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Ко всем кейсам и отраслям</span>
          </button>

          <div className="flex flex-wrap items-center gap-1.5">
            {VALID_INDUSTRY_SLUGS.map((slug) => {
              const item = INDUSTRY_SOLUTIONS[slug];
              const active = slug === industrySlug;
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() =>
                    onNavigate({ kind: 'industry-detail', industrySlug: slug })
                  }
                  className={`min-h-[38px] px-3.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                      : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                  }`}
                >
                  {item.shortTitle}
                </button>
              );
            })}
          </div>
        </div>

        {/* Сплит-обложка отраслевого решения */}
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="min-w-0 lg:col-span-7 flex flex-col justify-between gap-8">
              <div className="space-y-4">
                <p className="text-sm font-medium text-[#FF4820]">{spec.kicker}</p>
                <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.06] editorial-balance">
                  {spec.fullTitle}
                </h1>
                <p className="text-base sm:text-xl leading-relaxed text-[#111111]/74 dark:text-[#F4F3EF]/74 editorial-pretty">
                  {spec.heroSummary}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  data-testid="industry-order-cta"
                  onClick={handleStartIndustryOrder}
                  className="min-h-[48px] max-w-full px-5 sm:px-7 py-3.5 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white text-sm font-semibold leading-snug text-center transition-colors cursor-pointer sm:whitespace-nowrap"
                >
                  Заказать ролик для отрасли «{spec.shortTitle}»
                </button>

                {AIRTIME_SALES_ENABLED ? (
                  <button
                    type="button"
                    onClick={() => onNavigate({ kind: 'hot-air' })}
                    className="min-h-[48px] px-6 py-3.5 rounded-full border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Radio className="w-4 h-4 text-[#FF4820]" aria-hidden="true" />
                    <span>Подобрать эфирную сетку</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate({ kind: 'pricing' })}
                    className="min-h-[48px] px-6 py-3.5 rounded-full border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#FF4820]" aria-hidden="true" />
                    <span>Тарифы и паспорт прав</span>
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 rounded-3xl overflow-hidden min-h-[280px] lg:min-h-full bg-[#18181D] border border-[#111111]/10 dark:border-white/10">
              <OptimizedImage
                src={spec.coverImageUrl}
                fallbackSrc={LOCAL_EDITORIAL_IMAGES.studioHero}
                alt={spec.coverImageAlt}
                priority
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 border-y border-[#111111]/12 dark:border-white/12 divide-y sm:divide-y-0 sm:divide-x divide-[#111111]/12 dark:divide-white/12 tabular-nums">
            {spec.kpiBenchmarks.map((kpi, idx) => (
              <div
                key={kpi.label}
                className={`py-5 ${idx === 0 ? 'sm:pr-6' : idx === 1 ? 'sm:px-6' : 'sm:pl-6'}`}
              >
                <p className="text-2xl sm:text-3xl font-bold text-[#FF4820]">{kpi.value}</p>
                <p className="text-xs sm:text-sm font-medium text-[#111111]/70 dark:text-[#F4F3EF]/70 mt-1">
                  {kpi.label}
                </p>
              </div>
            ))}
          </div>

          <OgSharePreviewCard
            routePath={`/cases/industry/${spec.slug}`}
            shareTitle={`${spec.fullTitle} | FMWorks`}
            shareDescription={spec.heroSummary}
            downloadFileSlug={`industry-${spec.slug}`}
          />
        </div>

        {/* Контекст слушателя и эталонный сценарий */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#111111]/56 dark:text-[#F4F3EF]/56">
                Психология восприятия в эфире
              </p>
              <h2 className="text-2xl font-bold tracking-tight">
                В какой момент клиент слышит вас за рулём
              </h2>
              <p className="text-base leading-relaxed text-[#111111]/76 dark:text-[#F4F3EF]/76">
                {spec.listenerContext}
              </p>
            </div>

            <div className="pt-5 border-t border-[#111111]/10 dark:border-white/10 space-y-2">
              <p className="text-xs font-semibold text-[#FF4820]">
                Главная ошибка конкурентов в нише
              </p>
              <p className="text-base leading-relaxed text-[#111111]/76 dark:text-[#F4F3EF]/76">
                {spec.keyMistakeToAvoid}
              </p>
            </div>

            <div className="pt-5 border-t border-[#111111]/10 dark:border-white/10 space-y-3">
              <p className="text-xs font-semibold text-[#111111]/56 dark:text-[#F4F3EF]/56">
                Чек-лист эфирной модерации и ФЗ «О рекламе»
              </p>
              <ul className="space-y-2.5 text-sm leading-relaxed text-[#111111]/80 dark:text-[#F4F3EF]/80">
                {spec.legalComplianceRules.map((rule) => (
                  <li key={rule} className="flex items-start gap-2.5">
                    <CheckCircle2
                      className="w-4 h-4 text-[#FF4820] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-6 rounded-3xl p-6 sm:p-9 bg-[#141418] text-[#F4F3EF] border border-white/10 space-y-5 tabular-nums">
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-white/12">
              <span className="text-xs font-semibold text-[#FFB38A]">
                Референс сценария FMWorks
              </span>
              <span className="text-xs text-white/62">
                Точный хронометраж · {spec.sampleBenchmarkScript.durationSec} сек
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
              {spec.sampleBenchmarkScript.title}
            </h3>

            <div className="space-y-3 text-sm sm:text-base leading-relaxed text-white/84">
              {spec.sampleBenchmarkScript.lines.map((line) => (
                <p key={line} className="py-2 border-b border-white/8 last:border-b-0">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Рекомендуемые радиостанции для отрасли */}
        {AIRTIME_SALES_ENABLED && recommendedStations.length > 0 && (
          <section className="space-y-6 pt-4 border-t border-[#111111]/10 dark:border-white/10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#111111]/56 dark:text-[#F4F3EF]/56">
                  Площадки с максимальной концентрацией вашей ЦА
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Рекомендуемые радиостанции ({spec.shortTitle})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate({ kind: 'hot-air' })}
                className="text-xs sm:text-sm font-semibold text-[#FF4820] hover:underline cursor-pointer"
              >
                Весь каталог 12 станций →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 tabular-nums">
              {recommendedStations.map((st) => (
                <button
                  key={st.slug}
                  type="button"
                  onClick={() => onNavigate({ kind: 'station-detail', stationSlug: st.slug })}
                  className="text-left rounded-2xl p-5 bg-[#EFECE5]/75 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 hover:border-[#FF4820] transition-colors cursor-pointer flex flex-col justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                      {st.frequencyFm} · в авто {st.inCarListenSharePct}%
                    </p>
                    <p className="text-lg font-bold">{st.stationName}</p>
                    <p className="text-xs text-[#111111]/68 dark:text-[#F4F3EF]/68 line-clamp-2">
                      {st.shortPositioning}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-[#FF4820]">
                    от {formatNumberSpaced(st.minRatePerSecRub)} ₽/сек · Слоты →
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Связанные аудиокейсы */}
        {relatedCases.length > 0 && (
          <section className="space-y-5 pt-4 border-t border-[#111111]/10 dark:border-white/10">
            <h2 className="text-2xl font-bold tracking-tight">
              Прослушать реальные работы в этой вертикали
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {relatedCases.map((rc) => {
                const playing =
                  playerSnap.isPlaying &&
                  playerSnap.playbackMode === 'full' &&
                  playerSnap.activeCase?.id === rc.id;
                return (
                  <div
                    key={rc.id}
                    className="rounded-2xl p-6 bg-[#EFECE5]/70 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">
                        {rc.tag} · {rc.durationSec} сек
                      </p>
                      <h3 className="text-xl font-bold">{rc.client}</h3>
                      <p className="text-sm text-[#111111]/72 dark:text-[#F4F3EF]/72">
                        {rc.headline}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => onToggleCase(rc)}
                        className="min-h-[40px] px-4 py-2 rounded-full bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                      >
                        {playing ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>{playing ? 'Пауза' : 'Слушать ролик'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onNavigate({ kind: 'case-detail', caseSlug: rc.id })}
                        className="min-h-[40px] px-4 py-2 rounded-full border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold cursor-pointer"
                      >
                        Разбор сценария →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
