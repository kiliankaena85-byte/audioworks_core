import { ArrowRight } from 'lucide-react';
import { useSiteTextBlocks } from '../cms/SiteTextBlocksContext';
import { useStudioCms } from '../cms/StudioCmsContext';
import { CUSTOM_CONSULT_PRICING_ROW, OrderFormatId } from '../data/pricingData';
import { SiteTextBlockId } from '../data/siteTextBlocksData';
import { useLayaDecision } from '../engine/LayaContext';

const TIER_TEXT_BLOCK_MAP: Partial<Record<OrderFormatId, SiteTextBlockId>> = {
  voice_style: 'pricing-tier-voice',
  turnkey: 'pricing-tier-turnkey',
  cinema: 'pricing-tier-cinema',
};

interface PricingSectionProps {
  onSelectFormat: (formatId: OrderFormatId) => void;
}

export function PricingSection({ onSelectFormat }: PricingSectionProps) {
  const { decision } = useLayaDecision();
  const { snapshot } = useStudioCms();
  const { getBlock } = useSiteTextBlocks();
  const siteCopy = snapshot.siteCopy;
  const pricingHeader = getBlock('pricing-header');

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
            {pricingHeader.eyebrow}
          </p>
          <h2
            id="pricing-heading"
            className="text-3xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] mb-5 sm:mb-6"
          >
            <span className="block">{pricingHeader.title}</span>
            <span className="block text-[#111111]/42 dark:text-[#F4F3EF]/42">
              {pricingHeader.subtitle}
            </span>
          </h2>
          <p className="text-lg sm:text-xl text-[#111111]/68 dark:text-[#F4F3EF]/68 max-w-3xl editorial-pretty">
            {pricingHeader.description}
          </p>
        </div>

        {/* 3 Fixed Editorial Rows + 4th Negotiable Consultation Row */}
        <div className="border-b border-[#111111]/12 dark:border-[#F4F3EF]/14">
          {siteCopy.pricingRows.map((row) => {
            const isRecommended = decision.recommendedTier === row.id;
            const mappedBlockId = TIER_TEXT_BLOCK_MAP[row.id];
            const tierText = mappedBlockId ? getBlock(mappedBlockId) : row;

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

                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2.8fr)_minmax(0,4.7fr)_minmax(0,4.5fr)] gap-5 xl:gap-8 items-start xl:items-center">
                    {/* Column 1: Format Title & Hit Mark */}
                    <div className="min-w-0">
                      <h3 className="text-2xl sm:text-[1.6rem] font-bold tracking-tight leading-tight text-[#111111] dark:text-[#F4F3EF] group-hover:text-[#FF4820] transition-colors">
                        {tierText.title}
                      </h3>
                      {row.badgeHit && (
                        <span className="mt-1.5 block text-xs font-semibold text-[#111111]/52 dark:text-[#F4F3EF]/52">
                          ({row.badgeHit})
                        </span>
                      )}
                    </div>

                    {/* Column 2: Editorial Description */}
                    <div className="min-w-0">
                      <p className="text-base leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72 editorial-pretty">
                        {tierText.description}
                      </p>
                    </div>

                    {/* Column 3: Price + Turnaround & Stretched Native Order Button */}
                    <div className="min-w-0 flex flex-wrap sm:flex-nowrap items-center justify-between xl:justify-end gap-4 sm:gap-5 pt-3 xl:pt-0 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 xl:border-t-0">
                      <div className="min-w-0 text-left xl:text-right tabular-nums">
                        <span className="block text-2xl sm:text-[1.75rem] font-bold tracking-tight leading-tight text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap">
                          {row.priceFormatted}
                        </span>
                        <span className="mt-0.5 block text-xs sm:text-sm font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58 whitespace-nowrap">
                          {row.turnaround}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectFormat(row.id)}
                        aria-label={`Заказать: ${tierText.title} (${row.priceFormatted})`}
                        className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-all whitespace-nowrap shrink-0 bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] group-hover:bg-[#FF4820] group-hover:text-white cursor-pointer after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                      >
                        <span>Заказать</span>
                        <ArrowRight
                          className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {/* 4-я строка: Нестандартный формат и консультация продюсера по договорной цене */}
          <article
            key={CUSTOM_CONSULT_PRICING_ROW.id}
            data-testid={`pricing-row-${CUSTOM_CONSULT_PRICING_ROW.id}`}
            data-recommended="false"
            className="group relative border-t border-[#111111]/12 dark:border-[#F4F3EF]/14 py-2"
          >
            <div className="rounded-2xl py-7 sm:py-9 lg:py-10 px-4 sm:px-6 -mx-4 sm:-mx-6 transition-colors duration-200 group-hover:bg-[#EFECE5]/85 dark:group-hover:bg-[#16161B]">
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2.8fr)_minmax(0,4.7fr)_minmax(0,4.5fr)] gap-5 xl:gap-8 items-start xl:items-center">
                <div className="min-w-0">
                  <h3 className="text-2xl sm:text-[1.6rem] font-bold tracking-tight leading-tight text-[#111111] dark:text-[#F4F3EF] group-hover:text-[#FF4820] transition-colors">
                    {CUSTOM_CONSULT_PRICING_ROW.title}
                  </h3>
                  {CUSTOM_CONSULT_PRICING_ROW.badgeHit && (
                    <span className="mt-1.5 block text-xs font-semibold text-[#FF4820]">
                      ({CUSTOM_CONSULT_PRICING_ROW.badgeHit})
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-base leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72 editorial-pretty">
                    {CUSTOM_CONSULT_PRICING_ROW.description}
                  </p>
                </div>

                <div className="min-w-0 flex flex-wrap sm:flex-nowrap items-center justify-between xl:justify-end gap-4 sm:gap-5 pt-3 xl:pt-0 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 xl:border-t-0">
                  <div className="min-w-0 text-left xl:text-right tabular-nums">
                    <span className="block text-xl sm:text-2xl font-bold tracking-tight leading-tight text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap">
                      {CUSTOM_CONSULT_PRICING_ROW.priceFormatted}
                    </span>
                    <span className="mt-0.5 block text-xs sm:text-sm font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58 whitespace-nowrap">
                      {CUSTOM_CONSULT_PRICING_ROW.turnaround}
                    </span>
                  </div>

                  <button
                    type="button"
                    data-testid="pricing-select-custom-consult-btn"
                    onClick={() => onSelectFormat('custom_consult')}
                    aria-label={`Обсудить задачу: ${CUSTOM_CONSULT_PRICING_ROW.title} (${CUSTOM_CONSULT_PRICING_ROW.priceFormatted})`}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-all whitespace-nowrap shrink-0 border border-[#111111]/20 dark:border-[#F4F3EF]/24 text-[#111111] dark:text-[#F4F3EF] group-hover:bg-[#FF4820] group-hover:border-[#FF4820] group-hover:text-white cursor-pointer after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                  >
                    <span>Обсудить задачу</span>
                    <ArrowRight
                      className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
