import { useSiteTextBlocks } from '../cms/SiteTextBlocksContext';
import { useStudioCms } from '../cms/StudioCmsContext';
import { SiteTextBlockId } from '../data/siteTextBlocksData';

const LOCAL_STUDIO_MIC_FALLBACK =
  '/src/assets/images/hero_studio_editorial_1794399404984.jpg';

const PILLAR_BLOCK_IDS: readonly SiteTextBlockId[] = [
  'approach-pillar-01',
  'approach-pillar-02',
  'approach-pillar-03',
];

export function ApproachSection() {
  const { snapshot } = useStudioCms();
  const { getBlock } = useSiteTextBlocks();
  const neuro = snapshot.neuroApproach;
  const approachLead = getBlock('approach-lead');
  const pillarBlocks = PILLAR_BLOCK_IDS.map((id) => getBlock(id));

  return (
    <section
      id="approach"
      aria-labelledby="approach-heading"
      className="scroll-mt-20 py-20 sm:py-28 lg:py-40 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        {/* Quiet Section Label */}
        <p className="text-sm font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58 mb-5 sm:mb-6">
          {approachLead.eyebrow}
        </p>

        {/* Main Editorial Thesis: Radio gives reach, we make sure you are heard */}
        <div className="max-w-5xl space-y-6 mb-14 sm:mb-18 lg:mb-22">
          <h2
            id="approach-heading"
            className="text-2xl sm:text-4xl lg:text-[3.15rem] font-bold tracking-tight leading-[1.12] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
          >
            {approachLead.title}
          </h2>

          <p className="max-w-3xl text-base sm:text-xl leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72 editorial-pretty">
            {approachLead.description}
          </p>
        </div>

        {/* Grounded Neuroscience & Attention Proof Strip (Zero nested boxes, clean hairlines) */}
        {neuro.studies.length > 0 && (
          <div
            data-testid="approach-neuro-studies"
            className="mb-14 sm:mb-18 lg:mb-24 border-y border-[#111111]/12 dark:border-[#F4F3EF]/14 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#111111]/12 dark:divide-[#F4F3EF]/14"
          >
            {neuro.studies.map((study, idx) => (
              <article
                key={study.id}
                data-testid={`neuro-study-${idx}`}
                className={`py-8 sm:py-10 flex flex-col justify-between gap-5 ${
                  idx === 0 ? 'lg:pr-12' : 'lg:pl-12'
                }`}
              >
                <div className="space-y-3">
                  <p className="text-xs sm:text-sm font-medium text-[#111111]/56 dark:text-[#F4F3EF]/56">
                    {study.sourceLabel}
                  </p>

                  <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
                    <span className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums text-[#FF4820] leading-none">
                      {study.metricValue}
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                      {study.metricCaption}
                    </h3>
                  </div>

                  <p className="text-xs sm:text-sm font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78 tabular-nums">
                    Дополнительно · {study.secondaryStat}
                  </p>
                </div>

                <p className="text-sm sm:text-base leading-relaxed text-[#111111]/70 dark:text-[#F4F3EF]/70 editorial-pretty">
                  {study.summary}
                </p>
              </article>
            ))}
          </div>
        )}

        {/* Editorial 2-Zone Composition: 01 / 02 / 03 Pillars + Vertical Studio Microphone Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-stretch">
          {/* Left: 01, 02, 03 Spacious Editorial Rows */}
          <div className="lg:col-span-7 flex flex-col justify-between divide-y divide-[#111111]/12 dark:divide-[#F4F3EF]/14">
            {pillarBlocks.map((pillar, idx) => (
              <div
                key={pillar.id}
                className="py-8 lg:py-10 first:pt-0 last:pb-2 grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-8 items-start"
              >
                <p className="sm:col-span-3 text-4xl sm:text-5xl font-bold tracking-tight tabular-nums text-[#FF4820] leading-none">
                  {pillar.eyebrow ?? String(idx + 1).padStart(2, '0')}
                </p>

                <div className="sm:col-span-9 space-y-2.5">
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                    {pillar.title}
                  </h3>

                  <p className="text-base sm:text-lg leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72 editorial-pretty">
                    {pillar.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Vertical Studio Microphone Photography Card */}
          <figure
            data-testid="approach-studio-card"
            className="group lg:col-span-5 relative overflow-hidden rounded-3xl min-h-[420px] sm:min-h-[480px] lg:h-full bg-[#181514] border border-[#111111]/10 dark:border-white/10 flex flex-col justify-end p-7 sm:p-9"
          >
            <img
              src={neuro.studioPhotoUrl}
              alt={neuro.studioPhotoAlt}
              referrerPolicy="no-referrer"
              decoding="async"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.fallbackApplied) {
                  img.dataset.fallbackApplied = '1';
                  img.src = LOCAL_STUDIO_MIC_FALLBACK;
                }
              }}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#0B0A0A]/90 via-[#0B0A0A]/28 to-transparent"
            />

            <figcaption className="relative z-10 space-y-2">
              <p className="text-xs font-medium text-white/68">
                {neuro.studioPhotoKicker}
              </p>
              <p className="text-base sm:text-lg font-semibold leading-snug text-white editorial-pretty">
                {neuro.studioPhotoCaption}
              </p>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
