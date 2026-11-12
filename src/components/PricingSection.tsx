import { ArrowRight } from 'lucide-react';
import { EDITORIAL_PRICING_ROWS, OrderFormatId } from '../data/pricingData';
import { useLayaDecision } from '../engine/LayaContext';

interface PricingSectionProps {
  onSelectFormat: (formatId: OrderFormatId) => void;
}

export function PricingSection({ onSelectFormat }: PricingSectionProps) {
  const { decision } = useLayaDecision();

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="scroll-mt-24 py-20 sm:py-28 lg:py-40 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        {/* Spacious Editorial Header (Koto Studio Two-Tone Typography) */}
        <div className="max-w-4xl mb-12 sm:mb-16 lg:mb-24">
          <p className="text-sm font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55 mb-4 sm:mb-5">
            Стоимость
          </p>
          <h2
            id="pricing-heading"
            className="text-3xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] mb-5 sm:mb-6"
          >
            <span className="block">Три формата работы.</span>
            <span className="block text-[#111111]/42 dark:text-[#F4F3EF]/42">
              Фиксированная смета.
            </span>
          </h2>
          <p className="text-lg sm:text-xl text-[#111111]/68 dark:text-[#F4F3EF]/68 max-w-3xl editorial-pretty">
            Работаем по договору и ЭДО. Все исключительные права сразу переходят вам.
          </p>
        </div>

        {/* 3 Wide Editorial Rows (Zero Cheap Pricing Boxes, Straight Hairlines) */}
        <div className="border-b border-[#111111]/12 dark:border-[#F4F3EF]/14">
          {EDITORIAL_PRICING_ROWS.map((row) => {
            const isRecommended = decision.recommendedTier === row.id;

            return (
              <article
                key={row.id}
                data-testid={`pricing-row-${row.id}`}
                data-recommended={isRecommended ? 'true' : 'false'}
                className="group relative border-t border-[#111111]/12 dark:border-[#F4F3EF]/14 py-2"
              >
                <div className="rounded-2xl py-7 sm:py-9 lg:py-10 px-4 sm:px-6 -mx-4 sm:-mx-6 transition-colors duration-200 group-hover:bg-[#EFECE5]/85 dark:group-hover:bg-[#16161B]">
                  {/* Laya AI Recommendation Tag */}
                  {isRecommended && (
                    <div className="mb-3">
                      <span className="text-xs font-semibold text-[#FF4820]">
                        Рекомендуем под вашу задачу
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start lg:items-center">
                    {/* Column 1: Format Title & Hit Mark */}
                    <div className="lg:col-span-3">
                      <div className="flex flex-wrap items-baseline gap-2.5">
                        <h3 className="text-2xl sm:text-[1.65rem] font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] group-hover:text-[#FF4820] transition-colors">
                          {row.title}
                        </h3>
                        {row.badgeHit && (
                          <span className="text-xs font-semibold text-[#111111]/50 dark:text-[#F4F3EF]/50">
                            ({row.badgeHit})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Column 2: Editorial Description */}
                    <div className="lg:col-span-5">
                      <p className="text-base leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72 editorial-pretty">
                        {row.description}
                      </p>
                    </div>

                    {/* Column 3: Price • Turnaround & Stretched Native Order Button */}
                    <div className="lg:col-span-4 flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-4 sm:gap-6 pt-2 lg:pt-0">
                      <div className="text-left lg:text-right tabular-nums">
                        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap">
                          {row.priceFormatted}
                        </span>
                        <span className="mx-2 text-[#111111]/35 dark:text-[#F4F3EF]/35">•</span>
                        <span className="text-sm font-medium text-[#111111]/60 dark:text-[#F4F3EF]/60 whitespace-nowrap">
                          {row.turnaround}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectFormat(row.id)}
                        aria-label={`Заказать: ${row.title} (${row.priceFormatted})`}
                        className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-all whitespace-nowrap shrink-0 bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] group-hover:bg-[#FF4820] group-hover:text-white cursor-pointer after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                      >
                        <span>Заказать</span>
                        <ArrowRight
                          className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
