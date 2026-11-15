import { ArrowLeft, ArrowRight, ArrowUpRight, Pause, Play } from 'lucide-react';
import { KeyboardEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CasePlayerSnapshot } from '../audio/casePlayerEngine';
import { useStudioCms } from '../cms/StudioCmsContext';
import { BrandCasePoster } from '../data/casesData';
import {
  clampTestimonialCarouselIndex,
  ClientTestimonialCmsRecord,
  computeTestimonialFilterCounts,
  formatTestimonialCarouselCounter,
  getPublishedCmsTestimonialsForFilterAndPersona,
  resolveTestimonialCarouselSwipeDirection,
  resolveTestimonialLinkedCase,
  shouldShowTestimonialCarouselControls,
  stepTestimonialCarouselIndex,
  TESTIMONIAL_FILTERS,
  TestimonialCategory,
} from '../data/testimonialsCms';
import { useLayaDecision } from '../engine/LayaContext';

interface TestimonialsSectionProps {
  playerSnap?: CasePlayerSnapshot;
  onToggleCase?: (item: BrandCasePoster) => void;
  onOpenQuickOrder?: () => void;
  onNavigateRelated?: (href: string) => void;
}

function formatAudioSeconds(rawSec: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(rawSec) ? rawSec : 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function TestimonialsSection({
  playerSnap,
  onToggleCase,
  onOpenQuickOrder,
  onNavigateRelated,
}: TestimonialsSectionProps) {
  const { snapshot } = useStudioCms();
  const { decision } = useLayaDecision();
  const [activeFilter, setActiveFilter] = useState<TestimonialCategory>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const swipeStartXRef = useRef<number | null>(null);

  const cmsTestimonials = snapshot.testimonials;

  const filterCounts = useMemo(
    () => computeTestimonialFilterCounts(cmsTestimonials),
    [cmsTestimonials]
  );

  const visibleTestimonials = useMemo(
    () =>
      getPublishedCmsTestimonialsForFilterAndPersona(
        cmsTestimonials,
        activeFilter,
        decision.choice
      ),
    [cmsTestimonials, activeFilter, decision.choice]
  );

  const totalVisible = visibleTestimonials.length;
  const safeIndex = clampTestimonialCarouselIndex(activeIndex, totalVisible);
  const showCarouselControls = shouldShowTestimonialCarouselControls(totalVisible);
  const counterLabel = formatTestimonialCarouselCounter(safeIndex, totalVisible);

  // Сбрасываем/ограничиваем активный слайд при смене фильтра или обновлении данных в Studio CMS
  useEffect(() => {
    setActiveIndex(0);
  }, [activeFilter, decision.choice]);

  useEffect(() => {
    setActiveIndex((prev) => clampTestimonialCarouselIndex(prev, totalVisible));
  }, [totalVisible]);

  const handleStep = (direction: 'prev' | 'next') => {
    if (!showCarouselControls) return;
    setActiveIndex((prev) => stepTestimonialCarouselIndex(prev, totalVisible, direction));
  };

  const handleCarouselKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!showCarouselControls) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      handleStep('next');
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      handleStep('prev');
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!showCarouselControls) return;
    // Не перехватываем клики по интерактивным кнопкам и ссылкам внутри слайда
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a')) {
      swipeStartXRef.current = null;
      return;
    }
    swipeStartXRef.current = event.clientX;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (swipeStartXRef.current === null || !showCarouselControls) return;
    const deltaX = event.clientX - swipeStartXRef.current;
    swipeStartXRef.current = null;
    const direction = resolveTestimonialCarouselSwipeDirection(deltaX);
    if (direction) {
      handleStep(direction);
    }
  };

  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      data-testid="testimonials-section"
      className="scroll-mt-24 py-20 sm:py-28 lg:py-40 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        {/* Заголовок раздела и метрики доверия из Studio CMS */}
        <div className="space-y-8 sm:space-y-10 mb-8 sm:mb-10">
          <div className="max-w-3xl">
            <p
              data-testid="testimonials-eyebrow"
              className="text-sm font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55 mb-4 sm:mb-5"
            >
              {cmsTestimonials.eyebrow}
            </p>
            <h2
              id="testimonials-heading"
              className="text-3xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] editorial-balance mb-4 sm:mb-5"
            >
              <span className="block">{cmsTestimonials.headingPrimary}</span>
              <span className="block text-[#111111]/42 dark:text-[#F4F3EF]/42">
                {cmsTestimonials.headingMuted}
              </span>
            </h2>
            <p className="text-base sm:text-xl text-[#111111]/68 dark:text-[#F4F3EF]/68 max-w-2xl editorial-pretty">
              {cmsTestimonials.subheading}
            </p>
          </div>

          {cmsTestimonials.trustMetrics.length > 0 && (
            <div
              data-testid="testimonials-trust-metrics"
              className="py-6 sm:py-7 border-y border-[#111111]/10 dark:border-[#F4F3EF]/10 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8"
            >
              {cmsTestimonials.trustMetrics.map((metric) => (
                <div key={metric.id} className="space-y-1.5">
                  <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-[#111111] dark:text-[#F4F3EF]">
                    {metric.value}
                  </p>
                  <p className="text-xs sm:text-sm leading-relaxed text-[#111111]/64 dark:text-[#F4F3EF]/64 editorial-pretty">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Панель фильтров по отраслям и навигация карусели */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div
              role="group"
              aria-label="Фильтр отзывов по индустрии"
              className="flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/8 dark:border-white/10 w-full lg:w-fit"
            >
              {TESTIMONIAL_FILTERS.map((tab) => {
                const isActive = activeFilter === tab.id;
                const count = filterCounts[tab.id] ?? 0;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-testid={`testimonial-filter-${tab.id}`}
                    onClick={() => setActiveFilter(tab.id)}
                    aria-pressed={isActive}
                    className={`min-h-[40px] sm:min-h-[44px] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                      isActive
                        ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] shadow-xs'
                        : 'text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[11px] tabular-nums ${
                        isActive
                          ? 'text-[#F7F6F2]/70 dark:text-[#0D0D0F]/70'
                          : 'text-[#111111]/45 dark:text-[#F4F3EF]/45'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {totalVisible > 0 && (
              <div
                data-testid="testimonials-carousel-controls"
                className="flex items-center justify-between sm:justify-end gap-4 shrink-0"
              >
                <span
                  data-testid="testimonials-carousel-counter"
                  aria-live="polite"
                  className="text-xs sm:text-sm font-semibold tabular-nums text-[#111111]/62 dark:text-[#F4F3EF]/62"
                >
                  {counterLabel}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="testimonials-carousel-prev"
                    onClick={() => handleStep('prev')}
                    disabled={!showCarouselControls}
                    aria-label="Предыдущий отзыв"
                    className="w-11 h-11 rounded-full border border-[#111111]/14 dark:border-white/15 bg-transparent hover:border-[#FF4820] hover:text-[#FF4820] dark:hover:border-[#FF4820] dark:hover:text-[#FF4820] text-[#111111] dark:text-[#F4F3EF] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    data-testid="testimonials-carousel-next"
                    onClick={() => handleStep('next')}
                    disabled={!showCarouselControls}
                    aria-label="Следующий отзыв"
                    className="w-11 h-11 rounded-full border border-[#111111]/14 dark:border-white/15 bg-transparent hover:border-[#FF4820] hover:text-[#FF4820] dark:hover:border-[#FF4820] dark:hover:text-[#FF4820] text-[#111111] dark:text-[#F4F3EF] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Пустое состояние фильтра или карусель отзывов из Studio CMS */}
        {visibleTestimonials.length === 0 ? (
          <div
            data-testid="testimonials-empty-filter"
            className="rounded-3xl p-8 sm:p-11 bg-[#EFECE5]/75 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-5"
          >
            <div className="space-y-1.5">
              <p className="text-base sm:text-lg font-bold text-[#111111] dark:text-[#F4F3EF]">
                В выбранной рубрике пока нет опубликованных отзывов
              </p>
              <p className="text-sm text-[#111111]/65 dark:text-[#F4F3EF]/65">
                Переключите фильтр, чтобы посмотреть проверенные проекты клиентов из других отраслей.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className="min-h-[44px] px-5 py-2.5 rounded-full bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] hover:bg-[#FF4820] hover:text-white dark:hover:bg-[#FF4820] dark:hover:text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Показать все отзывы ({filterCounts.all})
            </button>
          </div>
        ) : (
          <div
            role="region"
            aria-roledescription="carousel"
            aria-label="Отзывы клиентов из Studio CMS"
            data-testid="testimonials-carousel"
            data-active-index={safeIndex}
            tabIndex={0}
            onKeyDown={handleCarouselKeyDown}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            className="space-y-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF4820] rounded-3xl"
          >
            <div className="overflow-hidden rounded-3xl border border-[#111111]/10 dark:border-white/12 bg-[#EFECE5]/80 dark:bg-[#15151A]">
              <div
                data-testid="testimonials-carousel-track"
                style={{ transform: `translate3d(-${safeIndex * 100}%, 0, 0)` }}
                className="flex transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              >
                {visibleTestimonials.map(
                  (item: ClientTestimonialCmsRecord, index: number) => {
                    const isSlideActive = index === safeIndex;
                    const linkedCase = resolveTestimonialLinkedCase(
                      item,
                      snapshot.portfolioCases,
                      snapshot.flagshipReel
                    );
                    const isCasePlaying = Boolean(
                      linkedCase &&
                        playerSnap?.isPlaying &&
                        playerSnap.activeCase?.id === linkedCase.id
                    );

                    return (
                      <article
                        key={item.id}
                        aria-hidden={!isSlideActive}
                        data-testid={`testimonial-card-${item.id}`}
                        className="w-full shrink-0 p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch"
                      >
                        {/* Левая колонка: контекст заказа, цитата клиента и авторство */}
                        <div className="lg:col-span-8 flex flex-col justify-between gap-7 min-w-0">
                          <div className="space-y-5">
                            <p className="text-xs sm:text-[13px] font-medium leading-relaxed text-[#111111]/58 dark:text-[#F4F3EF]/58">
                              {item.verifiedProvenance
                                ? `${item.projectMeta} · ${item.verifiedProvenance}`
                                : item.projectMeta}
                            </p>

                            <blockquote className="text-xl sm:text-2xl lg:text-[1.6rem] font-semibold tracking-tight leading-[1.35] text-[#111111] dark:text-[#F4F3EF] editorial-pretty">
                              «{item.quote}»
                            </blockquote>
                          </div>

                          <div className="flex items-center gap-3.5 min-w-0 pt-5 border-t border-[#111111]/10 dark:border-white/10">
                            <div
                              aria-hidden="true"
                              className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold tracking-tight shrink-0 border bg-[#F7F6F2] dark:bg-[#1E1E25] text-[#111111] dark:text-[#F4F3EF] border-[#111111]/12 dark:border-white/14"
                            >
                              {item.initials}
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm sm:text-base font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                                {item.authorName}
                              </p>
                              <p className="text-xs sm:text-[13px] leading-snug text-[#111111]/62 dark:text-[#F4F3EF]/62">
                                {item.authorRole} · {item.company}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Правая колонка: измеримый результат и прослушивание ролика */}
                        <div className="lg:col-span-4 pt-6 lg:pt-0 border-t lg:border-t-0 lg:border-l border-[#111111]/10 dark:border-white/10 lg:pl-10 flex flex-col justify-between gap-6 min-w-0">
                          <div className="space-y-2.5">
                            <p className="text-xs font-medium text-[#111111]/52 dark:text-[#F4F3EF]/52">
                              Измеримый результат
                            </p>
                            <p className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight tabular-nums text-[#FF4820]">
                              {item.outcomeMetric}
                            </p>
                            <p className="text-xs sm:text-sm leading-relaxed text-[#111111]/68 dark:text-[#F4F3EF]/68 editorial-pretty">
                              {item.outcomeContext}
                            </p>
                          </div>

                          <div className="pt-4 border-t border-[#111111]/10 dark:border-white/10 flex flex-col items-start gap-3">
                            {linkedCase && onToggleCase && (
                              <button
                                type="button"
                                tabIndex={isSlideActive ? 0 : -1}
                                data-testid={`testimonial-play-case-${item.id}`}
                                onClick={() => onToggleCase(linkedCase)}
                                aria-label={
                                  isCasePlaying
                                    ? `Поставить на паузу аудиоролик ${linkedCase.client}`
                                    : `Прослушать аудиоролик ${linkedCase.client}`
                                }
                                className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums border ${
                                  isCasePlaying
                                    ? 'bg-[#FF4820] text-white border-[#FF4820]'
                                    : 'bg-[#F7F6F2] dark:bg-[#1E1E25] hover:border-[#FF4820] text-[#111111] dark:text-[#F4F3EF] border-[#111111]/14 dark:border-white/15'
                                }`}
                              >
                                {isCasePlaying ? (
                                  <>
                                    <Pause
                                      className="w-3.5 h-3.5 shrink-0"
                                      aria-hidden="true"
                                    />
                                    <span>
                                      Пауза ·{' '}
                                      {formatAudioSeconds(
                                        playerSnap?.currentTimeSec ?? 0
                                      )}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Play
                                      className="w-3.5 h-3.5 shrink-0"
                                      aria-hidden="true"
                                    />
                                    <span>Слушать ролик · {linkedCase.durationSec}с</span>
                                  </>
                                )}
                              </button>
                            )}

                            <a
                              href={item.relatedHref}
                              tabIndex={isSlideActive ? 0 : -1}
                              onClick={(e) => {
                                if (!onNavigateRelated) return;
                                e.preventDefault();
                                onNavigateRelated(item.relatedHref);
                              }}
                              className="min-h-[40px] inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors whitespace-nowrap shrink-0"
                            >
                              <span>{item.relatedLabel}</span>
                              <ArrowUpRight
                                className="w-4 h-4 shrink-0"
                                aria-hidden="true"
                              />
                            </a>
                          </div>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            </div>

            {/* Навигационная лента слайдов по клиентам */}
            {showCarouselControls && (
              <div
                data-testid="testimonials-carousel-dots"
                role="group"
                aria-label="Переключение слайдов отзывов клиентов"
                className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3"
              >
                {visibleTestimonials.map((item, index) => {
                  const isCurrent = index === safeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={isCurrent}
                      aria-label={`Показать отзыв ${index + 1}: ${item.company}`}
                      data-testid={`testimonial-dot-${index}`}
                      onClick={() => setActiveIndex(index)}
                      className={`min-h-[48px] px-3.5 py-2.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-3 min-w-0 ${
                        isCurrent
                          ? 'border-[#FF4820] bg-[#FF4820]/8 dark:bg-[#FF4820]/14 text-[#111111] dark:text-[#F4F3EF]'
                          : 'border-[#111111]/10 dark:border-white/12 bg-transparent text-[#111111]/62 dark:text-[#F4F3EF]/62 hover:border-[#111111]/30 dark:hover:border-white/28 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                      }`}
                    >
                      <span
                        className={`text-xs font-semibold tabular-nums shrink-0 ${
                          isCurrent
                            ? 'text-[#FF4820]'
                            : 'text-[#111111]/40 dark:text-[#F4F3EF]/40'
                        }`}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs sm:text-sm font-semibold truncate">
                          {item.authorName}
                        </span>
                        <span className="block text-[11px] opacity-70 truncate">
                          {item.company}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Спокойная конверсионная полоса */}
        {onOpenQuickOrder && (
          <div className="mt-10 sm:mt-14 pt-8 border-t border-[#111111]/10 dark:border-[#F4F3EF]/12 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm sm:text-base text-[#111111]/72 dark:text-[#F4F3EF]/72 editorial-pretty">
              {cmsTestimonials.ctaPrompt}
            </p>

            <button
              type="button"
              data-testid="testimonials-quick-order-btn"
              onClick={onOpenQuickOrder}
              className="min-h-[46px] px-6 py-3 rounded-full bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] hover:bg-[#FF4820] hover:text-white dark:hover:bg-[#FF4820] dark:hover:text-white text-sm font-semibold inline-flex items-center justify-center transition-colors cursor-pointer whitespace-nowrap shrink-0 w-full sm:w-auto"
            >
              {cmsTestimonials.ctaButtonLabel}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
