import { ArrowUpRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import {
  ClientTestimonial,
  getTestimonialsForFilterAndPersona,
  TESTIMONIAL_FILTERS,
  TestimonialCategory,
} from '../data/testimonialsData';
import { useLayaDecision } from '../engine/LayaContext';

interface TestimonialsSectionProps {
  onOpenQuickOrder?: () => void;
  onNavigateRelated?: (href: string) => void;
}

export function TestimonialsSection({
  onOpenQuickOrder,
  onNavigateRelated,
}: TestimonialsSectionProps) {
  const { decision } = useLayaDecision();
  const [activeFilter, setActiveFilter] = useState<TestimonialCategory>('all');

  const visibleTestimonials = getTestimonialsForFilterAndPersona(
    activeFilter,
    decision.choice
  );
  const isSingleSpotlight = visibleTestimonials.length === 1;

  const getGridSpanClass = (index: number): string => {
    if (isSingleSpotlight) return 'lg:col-span-12';
    if (index === 0) return 'lg:col-span-7';
    if (index === 1) return 'lg:col-span-5';
    return 'lg:col-span-6';
  };

  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      className="scroll-mt-24 py-20 sm:py-28 lg:py-40 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        {/* Editorial Header + Unclipped Responsive Industry Filter */}
        <div className="space-y-7 sm:space-y-8 mb-12 lg:mb-16">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55 mb-4 sm:mb-5">
              Отзывы клиентов
            </p>
            <h2
              id="testimonials-heading"
              className="text-3xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] editorial-balance mb-4 sm:mb-5"
            >
              <span className="block">Что говорят бренды</span>
              <span className="block text-[#111111]/42 dark:text-[#F4F3EF]/42">
                после выхода в эфир.
              </span>
            </h2>
            <p className="text-base sm:text-xl text-[#111111]/68 dark:text-[#F4F3EF]/68 max-w-2xl editorial-pretty">
              Директора по маркетингу и основатели компаний — о том, как меняется отклик аудитории и скорость согласования роликов.
            </p>
          </div>

          {/* Interactive Filter Controls */}
          <div className="w-full sm:w-auto">
            <div
              role="group"
              aria-label="Фильтр отзывов по индустрии"
              className="flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/8 dark:border-white/10 w-full sm:w-fit"
            >
              {TESTIMONIAL_FILTERS.map((tab) => {
                const isActive = activeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFilter(tab.id)}
                    aria-pressed={isActive}
                    className={`min-h-[38px] sm:min-h-[44px] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                      isActive
                        ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] shadow-xs'
                        : 'text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Asymmetric Editorial Bento Grid of Client Quotes */}
        <motion.div
          layout
          data-testid="testimonials-grid"
          className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8 items-stretch"
        >
          <AnimatePresence mode="popLayout">
            {visibleTestimonials.map((item: ClientTestimonial, index: number) => {
              const isFeaturedDark = index === 0;

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
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs sm:text-[13px]">
                      <span
                        className={
                          isFeaturedDark
                            ? 'text-white/62 font-medium'
                            : 'text-[#111111]/58 dark:text-[#F4F3EF]/58 font-medium'
                        }
                      >
                        {item.projectMeta}
                      </span>

                      <span className="font-semibold tabular-nums text-[#FF4820]">
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

                  {/* Concrete Outcome Context + Attributable Author & Case Link */}
                  <div className="space-y-5 pt-6 border-t border-current/10">
                    <p
                      className={`text-xs sm:text-sm leading-relaxed ${
                        isFeaturedDark
                          ? 'text-white/68'
                          : 'text-[#111111]/65 dark:text-[#F4F3EF]/65'
                      }`}
                    >
                      Результат: {item.outcomeContext}
                    </p>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0">
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
                            className={`text-sm sm:text-base font-bold tracking-tight truncate ${
                              isFeaturedDark
                                ? 'text-white'
                                : 'text-[#111111] dark:text-[#F4F3EF]'
                            }`}
                          >
                            {item.authorName}
                          </p>
                          <p
                            className={`text-xs sm:text-[13px] truncate ${
                              isFeaturedDark
                                ? 'text-white/65'
                                : 'text-[#111111]/62 dark:text-[#F4F3EF]/62'
                            }`}
                          >
                            {item.authorRole} · {item.company}
                          </p>
                        </div>
                      </div>

                      <a
                        href={item.relatedHref}
                        onClick={(e) => {
                          if (!onNavigateRelated) return;
                          e.preventDefault();
                          onNavigateRelated(item.relatedHref);
                        }}
                        className={`min-h-[44px] inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto ${
                          isFeaturedDark
                            ? 'text-[#FFB38A] hover:text-white'
                            : 'text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820]'
                        }`}
                      >
                        <span>{item.relatedLabel}</span>
                        <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {/* Quiet Editorial Conversion Strip */}
        {onOpenQuickOrder && (
          <div className="mt-10 sm:mt-14 pt-8 border-t border-[#111111]/10 dark:border-[#F4F3EF]/12 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm sm:text-base text-[#111111]/72 dark:text-[#F4F3EF]/72 editorial-pretty">
              Нужен такой же спокойный выпуск ролика в эфир с первой подачи и по ЭДО?
            </p>

            <button
              type="button"
              onClick={onOpenQuickOrder}
              className="min-h-[46px] px-6 py-3 rounded-full bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] hover:bg-[#FF4820] hover:text-white dark:hover:bg-[#FF4820] dark:hover:text-white text-sm font-semibold inline-flex items-center justify-center transition-colors cursor-pointer whitespace-nowrap shrink-0 w-full sm:w-auto"
            >
              Надиктовать задачу за 30 секунд
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
