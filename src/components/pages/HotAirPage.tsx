import {
  ArrowLeft,
  Check,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  buildStationCatalogProfiles,
  StationCatalogProfile,
} from '../../data/multiPageContentData';
import { PlatformRoute } from '../../data/platformRouter';
import {
  AIR_BONUS_THRESHOLD_RUB,
  createSecondBasedPricingFromSlot,
  formatNumberSpaced,
  formatRubCompact,
  MediaGridReservationPayload,
  RadioInventorySlot,
  radioInventoryStore,
} from '../../data/radioInventory';
import { MediaGridPlanner } from '../MediaGridPlanner';

interface HotAirPageProps {
  stationSlug?: string;
  isCasePlayerVisible?: boolean;
  onNavigate: (route: PlatformRoute) => void;
  onReserveMediaGrid: (payload: MediaGridReservationPayload, returnPath?: string) => void;
}

const STATION_DURATION_PRESETS = [10, 15, 17, 20, 22, 30] as const;

export function HotAirPage({
  stationSlug,
  isCasePlayerVisible = false,
  onNavigate,
  onReserveMediaGrid,
}: HotAirPageProps) {
  const [slots, setSlots] = useState<RadioInventorySlot[]>(() =>
    radioInventoryStore.getActiveSlots()
  );

  useEffect(() => {
    return radioInventoryStore.subscribe(() => {
      setSlots(radioInventoryStore.getActiveSlots());
    });
  }, []);

  const stationProfiles = useMemo(
    () => buildStationCatalogProfiles(slots),
    [slots]
  );

  const activeStation = useMemo<StationCatalogProfile | null>(() => {
    if (!stationSlug) return null;
    return stationProfiles.find((s) => s.slug === stationSlug) ?? null;
  }, [stationProfiles, stationSlug]);

  if (stationSlug) {
    return (
      <StationDetailSubpage
        station={activeStation}
        allStations={stationProfiles}
        onNavigate={onNavigate}
        onReserveMediaGrid={onReserveMediaGrid}
      />
    );
  }

  return (
    <div data-testid="hot-air-page">
      <MediaGridPlanner
        isCasePlayerVisible={isCasePlayerVisible}
        onReserveMediaGrid={(payload) => onReserveMediaGrid(payload, '/hot-air')}
        onNavigateStation={(slug) =>
          onNavigate({ kind: 'station-detail', stationSlug: slug })
        }
        onNavigateApproach={() => onNavigate({ kind: 'approach' })}
      />
    </div>
  );
}

interface StationDetailSubpageProps {
  station: StationCatalogProfile | null;
  allStations: readonly StationCatalogProfile[];
  onNavigate: (route: PlatformRoute) => void;
  onReserveMediaGrid: (payload: MediaGridReservationPayload, returnPath?: string) => void;
}

function StationDetailSubpage({
  station,
  allStations,
  onNavigate,
  onReserveMediaGrid,
}: StationDetailSubpageProps) {
  const [spotSeconds, setSpotSeconds] = useState<number>(20);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>(() =>
    station?.slots[0] ? [station.slots[0].id] : []
  );

  useEffect(() => {
    if (station?.slots[0]) {
      setSelectedSlotIds([station.slots[0].id]);
    }
  }, [station]);

  if (!station) {
    return (
      <section className="py-20 px-4 sm:px-6 lg:px-12 max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Радиостанция не найдена</h1>
        <p className="text-[#111111]/68 dark:text-[#F4F3EF]/68">
          Возможно, ссылка устарела или квота была скрыта продюсером. Перейдите в общий каталог горящего эфира.
        </p>
        <button
          type="button"
          onClick={() => onNavigate({ kind: 'hot-air' })}
          className="min-h-[44px] px-6 py-2.5 rounded-full bg-[#FF4820] text-white text-sm font-semibold cursor-pointer"
        >
          Открыть каталог радиостанций
        </button>
      </section>
    );
  }

  const toggleSlotSelection = (slotId: string) => {
    setSelectedSlotIds((prev) =>
      prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
    );
  };

  const slotQuotes = station.slots.map((slot) => {
    const engine = slot.secondBasedPricing ?? createSecondBasedPricingFromSlot(slot);
    const cost = engine.calculateCost(spotSeconds);
    return { slot, engine, cost };
  });

  const activeQuotes = slotQuotes.filter((q) =>
    selectedSlotIds.includes(q.slot.id)
  );

  const totalSelectedHotRub = activeQuotes.reduce(
    (acc, q) => acc + q.cost.totalQuotaCostRub,
    0
  );
  const totalSelectedOfficialRub = activeQuotes.reduce(
    (acc, q) => acc + q.cost.officialAirTotalRub,
    0
  );
  const totalSelectedSpots = activeQuotes.reduce(
    (acc, q) => acc + q.cost.spotsCount,
    0
  );
  const totalSelectedOTS = activeQuotes.reduce(
    (acc, q) => acc + q.slot.reachOTS,
    0
  );
  const discountRub = Math.max(0, totalSelectedOfficialRub - totalSelectedHotRub);
  const discountPct =
    totalSelectedOfficialRub > 0
      ? Math.round((discountRub / totalSelectedOfficialRub) * 100)
      : 35;

  const handleBookStationSlots = () => {
    const chosen = activeQuotes.length > 0 ? activeQuotes : slotQuotes.slice(0, 1);
    if (chosen.length === 0) return;

    const hotSum = chosen.reduce((a, q) => a + q.cost.totalQuotaCostRub, 0);
    const offSum = chosen.reduce((a, q) => a + q.cost.officialAirTotalRub, 0);
    const spotsSum = chosen.reduce((a, q) => a + q.cost.spotsCount, 0);
    const otsSum = chosen.reduce((a, q) => a + q.slot.reachOTS, 0);
    const discRub = Math.max(0, offSum - hotSum);
    const discPct = offSum > 0 ? Math.round((discRub / offSum) * 100) : 36;
    const isBonus = hotSum >= AIR_BONUS_THRESHOLD_RUB;

    const payload: MediaGridReservationPayload = {
      createdAtMs: Date.now(),
      initialCountdownSeconds: 4 * 3600 - 1,
      nicheId: 'b2b_finance',
      nicheLabel: `Прямой выбор · ${station.stationName}`,
      productNote: `Бронь тайм-слотов на радиостанции ${station.stationName} (${station.frequencyFm}) под ролик ${spotSeconds} сек`,
      durationPref: spotSeconds <= 15 ? '15' : '30',
      targetAudienceSummary: `${station.audienceCoreAge} · ${station.incomeProfile}`,
      spotDurationSec: spotSeconds,
      totalSpots: spotsSum,
      totalReachOTS: otsSum,
      targetAudienceSharePct: station.inCarListenSharePct,
      officialAirTotal: offSum,
      hotAirTotal: hotSum,
      airDiscountPercent: discPct,
      isBonusProductionUnlocked: isBonus,
      initialProductionSelection: isBonus ? 'bonus_express_24h' : 'turnkey',
      initialRecommendedTier: 'turnkey',
      aiRationale: station.editorialBuyingNote,
      stations: chosen.map((q) => {
        const slotDiscPct =
          q.cost.officialAirTotalRub > 0
            ? Math.max(
                0,
                Math.round(
                  ((q.cost.officialAirTotalRub - q.cost.totalQuotaCostRub) /
                    q.cost.officialAirTotalRub) *
                    100
                )
              )
            : 36;
        return {
          slotId: q.slot.id,
          station: q.slot.station,
          frequencyFm: q.slot.frequencyFm,
          daypart: q.slot.daypart,
          daysPattern: q.slot.daysPattern,
          sampleTimeSlots: [...q.slot.sampleTimeSlots],
          spotsIncluded: q.cost.spotsCount,
          maxDuration: q.slot.maxDuration,
          packageMultiplier: 1,
          exactDurationSec: q.cost.effectiveDurationSeconds,
          officialPrice: q.cost.officialAirTotalRub,
          hotPrice: q.cost.totalQuotaCostRub,
          discountPercent: slotDiscPct,
          reachOTS: q.slot.reachOTS,
        };
      }),
    };

    onReserveMediaGrid(payload, `/hot-air/stations/${station.slug}`);
  };

  const neighborStations = allStations
    .filter((s) => s.slug !== station.slug)
    .slice(0, 3);

  return (
    <article
      data-testid="station-detail-page"
      className="py-10 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-12"
    >
      <div className="max-w-7xl mx-auto space-y-12 sm:space-y-16">
        {/* Навигация назад */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#111111]/10 dark:border-white/10">
          <button
            type="button"
            onClick={() => onNavigate({ kind: 'hot-air' })}
            className="min-h-[42px] inline-flex items-center gap-2 text-sm font-medium text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Ко всем радиостанциям и конструктору эфира</span>
          </button>

          <span className="text-xs sm:text-sm font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58 tabular-nums">
            Частота вещания · {station.frequencyFm}
          </span>
        </div>

        {/* Заголовок радиостанции + полоса из 4 метрик */}
        <header className="space-y-8">
          <div className="max-w-4xl space-y-4">
            <p className="text-sm font-medium text-[#FF4820]">
              Паспорт радиостанции · {station.affinityIndexLabel}
            </p>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.04] text-[#111111] dark:text-[#F4F3EF] editorial-balance">
              {station.stationName}{' '}
              <span className="text-[#111111]/40 dark:text-[#F4F3EF]/40 tabular-nums">
                {station.frequencyFm}
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-[#111111]/74 dark:text-[#F4F3EF]/74 leading-relaxed editorial-pretty">
              {station.corePortrait}
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 border-y border-[#111111]/12 dark:border-white/12 divide-y lg:divide-y-0 sm:divide-x divide-[#111111]/12 dark:divide-white/12 tabular-nums">
            <div className="py-5 sm:pr-6">
              <p className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">Возрастное ядро</p>
              <p className="text-2xl sm:text-3xl font-bold mt-1">{station.audienceCoreAge}</p>
            </div>
            <div className="py-5 sm:px-6">
              <p className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">Слушают за рулём</p>
              <p className="text-2xl sm:text-3xl font-bold text-[#FF4820] mt-1">
                {station.inCarListenSharePct}%
              </p>
            </div>
            <div className="py-5 sm:px-6">
              <p className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">Посекундная ставка</p>
              <p className="text-2xl sm:text-3xl font-bold mt-1">
                от {formatNumberSpaced(station.minRatePerSecRub)} ₽/с
              </p>
            </div>
            <div className="py-5 sm:pl-6">
              <p className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">Охват горящих квот</p>
              <p className="text-2xl sm:text-3xl font-bold mt-1">
                {formatNumberSpaced(station.totalStationOTS)} OTS
              </p>
            </div>
          </div>
        </header>

        {/* Портрет платёжеспособности, лучшие товарные категории и рекомендации продюсера */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-7 rounded-3xl p-6 sm:p-9 bg-[#EFECE5]/75 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#111111]/56 dark:text-[#F4F3EF]/56">
                Рекомендация медиапланера FMWorks
              </p>
              <h2 className="text-2xl font-bold tracking-tight">
                Как звучать на {station.stationName}, чтобы окупить эфир
              </h2>
              <p className="text-base leading-relaxed text-[#111111]/74 dark:text-[#F4F3EF]/74">
                {station.editorialBuyingNote}
              </p>
            </div>

            <div className="pt-5 border-t border-[#111111]/10 dark:border-white/10 space-y-3">
              <p className="text-xs font-semibold text-[#111111]/56 dark:text-[#F4F3EF]/56">
                Отрасли с максимальным индексом соответствия ({station.incomeProfile})
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm font-medium">
                {station.bestCategories.map((cat) => (
                  <li key={cat} className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
                    <span>{cat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-3xl p-6 sm:p-9 bg-[#141418] text-[#F4F3EF] border border-white/10 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[#FFB38A] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Нюанс юридической и эфирной модерации</span>
              </p>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
                Требования редакции {station.stationName}
              </h3>
              <p className="text-sm sm:text-base leading-relaxed text-white/75">
                {station.moderationNuance}
              </p>
            </div>

            <div className="pt-5 border-t border-white/12 flex items-center justify-between gap-3 text-xs text-white/65">
              <span>Паспорт ролика и пре-чек ФЗ-38 включены</span>
              <button
                type="button"
                onClick={() => onNavigate({ kind: 'pricing' })}
                className="font-semibold text-white hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap"
              >
                Подробнее о модерации →
              </button>
            </div>
          </div>
        </div>

        {/* Интерактивный выбор тайм-слотов станции с честным посекундным пересчётом */}
        <section className="space-y-6 pt-4">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#111111]/56 dark:text-[#F4F3EF]/56">
                Доступные горящие слоты радиостанции
              </p>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">
                Выберите тайм-слоты и хронометраж ролика
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#111111]/60 dark:text-[#F4F3EF]/60 mr-1">
                Хронометраж:
              </span>
              {STATION_DURATION_PRESETS.map((sec) => {
                const active = spotSeconds === sec;
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSpotSeconds(sec)}
                    aria-pressed={active}
                    className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold tabular-nums border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#FF4820] text-white border-[#FF4820]'
                        : 'border-[#111111]/15 dark:border-white/15 hover:border-[#FF4820]'
                    }`}
                  >
                    {sec} сек
                  </button>
                );
              })}
              <input
                type="number"
                min={5}
                max={60}
                value={spotSeconds}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (Number.isFinite(val)) {
                    setSpotSeconds(Math.max(5, Math.min(60, val)));
                  }
                }}
                aria-label="Свой хронометраж в секундах"
                className="w-20 min-h-[38px] px-2.5 rounded-xl bg-transparent border border-[#111111]/16 dark:border-white/16 text-xs font-semibold tabular-nums text-center focus:outline-none focus:border-[#FF4820]"
              />
            </div>
          </div>

          <div className="space-y-3">
            {slotQuotes.map(({ slot, cost }) => {
              const isSelected = selectedSlotIds.includes(slot.id);
              return (
                <div
                  key={slot.id}
                  data-testid={`station-slot-row-${slot.id}`}
                  onClick={() => toggleSlotSelection(slot.id)}
                  className={`rounded-2xl p-5 sm:p-6 border transition-colors cursor-pointer grid grid-cols-1 lg:grid-cols-12 gap-4 items-center tabular-nums ${
                    isSelected
                      ? 'bg-[#EFECE5] dark:bg-[#191920] border-[#FF4820]'
                      : 'bg-transparent border-[#111111]/12 dark:border-white/12 hover:border-[#111111]/35 dark:hover:border-white/30'
                  }`}
                >
                  <div className="lg:col-span-5 flex items-start gap-3.5">
                    <button
                      type="button"
                      aria-label={`Выбрать слот ${slot.daypart}`}
                      aria-pressed={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSlotSelection(slot.id);
                      }}
                      className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#FF4820] border-[#FF4820] text-white'
                          : 'border-[#111111]/25 dark:border-white/25'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                    </button>

                    <div className="space-y-1">
                      <p className="text-base sm:text-lg font-bold text-[#111111] dark:text-[#F4F3EF]">
                        {slot.daypart} · {slot.daysPattern}
                      </p>
                      <p className="text-xs sm:text-sm text-[#111111]/66 dark:text-[#F4F3EF]/66">
                        {slot.programTitle ?? slot.formatDesc} · Выходы:{' '}
                        {slot.sampleTimeSlots.join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="lg:col-span-4 text-xs sm:text-sm text-[#111111]/70 dark:text-[#F4F3EF]/70 space-y-1">
                    <p>
                      Квота: <strong>{cost.spotsCount} выходов</strong> · Шаг кратности:{' '}
                      <strong>{cost.multiplicity.durationMultiplicitySec} сек</strong>
                    </p>
                    <p>
                      К оплате: <strong>{cost.effectiveDurationSeconds} сек</strong> (
                      {formatNumberSpaced(cost.clientRatePerSecRub)} ₽/сек) · Дедлайн:{' '}
                      {slot.deadlineHours}ч
                    </p>
                  </div>

                  <div className="lg:col-span-3 flex items-baseline justify-between lg:justify-end gap-3">
                    <span className="text-xs line-through text-[#111111]/45 dark:text-[#F4F3EF]/45">
                      {formatRubCompact(cost.officialAirTotalRub)}
                    </span>
                    <span className="text-xl sm:text-2xl font-bold text-[#111111] dark:text-[#F4F3EF]">
                      {formatRubCompact(cost.totalQuotaCostRub)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Итоговая панель бронирования выбранных слотов станции */}
          <div className="rounded-3xl p-6 sm:p-8 bg-[#111114] text-[#F4F3EF] border border-white/12 flex flex-col lg:flex-row lg:items-center justify-between gap-6 tabular-nums">
            <div className="space-y-1">
              <p className="text-xs text-white/62">
                Выбрано слотов: {activeQuotes.length || 1} · {totalSelectedSpots || slotQuotes[0]?.cost.spotsCount || 0} выходов · Ролик {spotSeconds} сек · Охват {formatNumberSpaced(totalSelectedOTS || slotQuotes[0]?.slot.reachOTS || 0)} OTS
              </p>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-2xl sm:text-3xl font-bold">
                  {formatRubCompact(
                    totalSelectedHotRub || slotQuotes[0]?.cost.totalQuotaCostRub || 0
                  )}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-[#FFB36B]">
                  Выгода −{discountPct}% от прайса станции
                </span>
              </div>
            </div>

            <button
              type="button"
              data-testid="station-reserve-slots-btn"
              onClick={handleBookStationSlots}
              className="min-h-[48px] px-7 py-3.5 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Зарезервировать слоты на 4 часа →
            </button>
          </div>
        </section>

        {/* Соседние радиостанции для сравнения */}
        {neighborStations.length > 0 && (
          <section className="pt-8 border-t border-[#111111]/10 dark:border-white/10 space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Другие радиостанции для сравнения медиаплана
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {neighborStations.map((st) => (
                <button
                  key={st.slug}
                  type="button"
                  onClick={() => onNavigate({ kind: 'station-detail', stationSlug: st.slug })}
                  className="text-left rounded-2xl p-5 bg-[#EFECE5]/65 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 hover:border-[#FF4820] transition-colors cursor-pointer space-y-2"
                >
                  <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58 tabular-nums">
                    {st.frequencyFm} · {st.audienceCoreAge}
                  </p>
                  <p className="text-lg font-bold">{st.stationName}</p>
                  <p className="text-xs text-[#FF4820] font-semibold tabular-nums">
                    от {formatNumberSpaced(st.minRatePerSecRub)} ₽/сек →
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
