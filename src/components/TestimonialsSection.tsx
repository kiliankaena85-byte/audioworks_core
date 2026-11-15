import { ArrowUpRight, Pause, Play } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { CasePlayerSnapshot } from '../audio/casePlayerEngine';
import { useStudioCms } from '../cms/StudioCmsContext';
import { BrandCasePoster } from '../data/casesData';
import {
  ClientTestimonialCmsRecord,
  computeTestimonialFilterCounts,
  getPublishedCmsTestimonialsForFilterAndPersona,
  resolveTestimonialLinkedCase,
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
  const isSingleSpotlight = totalVisible === 1;

  const getGridSpanClass = (index: number): string => {
    if (totalVisible === 1) return 'lg:col-span-12';
    if (index === 0) return 'lg:col-span-7';
    if (index === 1) return 'lg:col-span-5';
    if (totalVisible % 2 === 1 && index === totalVisible - 1) {
      return 'lg:col-span-12';
    }
    return 'lg:col-span-6';
  };

  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      data-testid="testimonials-section"
      className="scroll-mt-24 py-20 sm:py-28 lg:py-40 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        {/* Editorial Header + StudioCMS Quantified Proof Strip + Responsive Industry Filter */}
        <div className="space-y-8 sm:space-y-10 mb-12 lg:mb-16">
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

          {/* Dynamic StudioCMS Trust Metrics Strip */}
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

          {/* Interactive Industry Filter Controls */}
          <div className="w-full sm:w-auto">
            <div
              role="group"
              aria-label="Фильтр отзывов по индустрии"
              className="flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/8 dark:border-white/10 w-full sm:w-fit"
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
          </div>
        </div>

        {/* Empty Category State or Asymmetric Editorial Bento Grid */}
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
          <motion.div
            layout
            data-testid="testimonials-grid"
            className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8 items-stretch"
          >
            <AnimatePresence mode="popLayout">
              {visibleTestimonials.map(
                (item: ClientTestimonialCmsRecord, index: number) => {
                  const isFeaturedDark = index === 0;
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
                    <motion.article
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      data-testid={`testimonial-card-${item.id}`}
                      className={`${getGridSpanClass(
                        index
                      )} rounded-3xl p-6 sm:p-9 lg:p-11 flex flex-col justify-between gap-8 border transition-colors ${
                        isFeaturedDark
                          ? 'bg-[#141418] text-[#F4F3EF] border-white/10'
                          : 'bg-[#EFECE5]/75 dark:bg-[#15151A] text-[#111111] dark:text-[#F4F3EF] border-[#111111]/10 dark:border-white/10'
                      }`}
                    >
                      {/* Top Unboxed Metadata + Concrete Quantified Outcome */}
                      <div className="space-y-5">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 text-xs sm:text-[13px]">
                          <p
                            className={`font-medium leading-relaxed ${
                              isFeaturedDark
                                ? 'text-white/62'
                                : 'text-[#111111]/58 dark:text-[#F4F3EF]/58'
                            }`}
                          >
                            {item.verifiedProvenance
                              ? `${item.projectMeta} · ${item.verifiedProvenance}`
                              : item.projectMeta}
                          </p>

                          <span className="font-semibold tabular-nums text-[#FF4820] whitespace-nowrap shrink-0">
                            {item.outcomeMetric}
                          </span>
                        </div>

                        {/* Client Quote */}
                        <blockquote
                          className={`font-semibold tracking-tight leading-[1.32] editorial-pretty ${
                            isFeaturedDark || isSingleSpotlight
                              ? 'text-xl sm:text-2xl lg:text-[1.65rem] text-white'
                              : 'text-lg sm:text-xl lg:text-[1.35rem] text-[#111111] dark:text-[#F4F3EF]'
                          }`}
                        >
                          «{item.quote}»
                        </blockquote>
                      </div>

                      {/* Concrete Outcome Context + Attributable Author & Direct Audio / Case Proof */}
                      <div className="space-y-4 pt-6 border-t border-current/10">
                        <p
                          className={`text-xs sm:text-sm leading-relaxed ${
                            isFeaturedDark
                              ? 'text-white/68'
                              : 'text-[#111111]/65 dark:text-[#F4F3EF]/65'
                          }`}
                        >
                          Результат: {item.outcomeContext}
                        </p>

                        {/* Full-Width Attributable Speaker Row */}
                        <div className="flex items-center gap-3.5 min-w-0 pt-1">
                          <div
                            aria-hidden="true"
                            className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold tracking-tight shrink-0 border ${
                              isFeaturedDark
                                ? 'bg-white/8 text-white border-white/16'
                                : 'bg-[#F7F6F2] dark:bg-[#1E1E25] text-[#111111] dark:text-[#F4F3EF] border-[#111111]/12 dark:border-white/14'
                            }`}
                          >
                            {item.initials}
                          </div>

                          <div className="min-w-0">
                            <p
                              className={`text-sm sm:text-base font-bold tracking-tight ${
                                isFeaturedDark
                                  ? 'text-white'
                                  : 'text-[#111111] dark:text-[#F4F3EF]'
                              }`}
                            >
                              {item.authorName}
                            </p>
                            <p
                              className={`text-xs sm:text-[13px] leading-snug ${
                                isFeaturedDark
                                  ? 'text-white/65'
                                  : 'text-[#111111]/62 dark:text-[#F4F3EF]/62'
                              }`}
                            >
                              {item.authorRole} · {item.company}
                            </p>
                          </div>
                        </div>

                        {/* Dedicated Proof Actions Row (Audio Spot Preview + Case Link) */}
                        <div className="pt-3.5 border-t border-current/10 flex flex-wrap items-center justify-between gap-3">
                          {linkedCase && onToggleCase ? (
                            <button
                              type="button"
                              data-testid={`testimonial-play-case-${item.id}`}
                              onClick={() => onToggleCase(linkedCase)}
                              aria-label={
                                isCasePlaying
                                  ? `Поставить на паузу аудиоролик ${linkedCase.client}`
                                  : `Прослушать аудиоролик ${linkedCase.client}`
                              }
                              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums border ${
                                isCasePlaying
                                  ? 'bg-[#FF4820] text-white border-[#FF4820]'
                                  : isFeaturedDark
                                    ? 'bg-white/8 hover:bg-white/14 text-white border-white/14'
                                    : 'bg-[#F7F6F2] dark:bg-[#1E1E25] hover:border-[#FF4820] text-[#111111] dark:text-[#F4F3EF] border-[#111111]/12 dark:border-white/14'
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
                          ) : (
                            <span className="sr-only">Прямой переход к сравнению</span>
                          )}

                          <a
                            href={item.relatedHref}
                            onClick={(e) => {
                              if (!onNavigateRelated) return;
                              e.preventDefault();
                              onNavigateRelated(item.relatedHref);
                            }}
                            className={`min-h-[40px] inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                              isFeaturedDark
                                ? 'text-[#FFB38A] hover:text-white'
                                : 'text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820]'
                            }`}
                          >
                            <span>{item.relatedLabel}</span>
                            <ArrowUpRight
                              className="w-4 h-4 shrink-0"
                              aria-hidden="true"
                            />
                          </a>
                        </div>
                      </div>
                    </motion.article>
                  );
                }
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Quiet Editorial Conversion Strip */}
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
