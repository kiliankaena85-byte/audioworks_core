import {
  APPROACH_PILLARS,
  APPROACH_STUDIO_PHOTO,
  APPROACH_THESIS,
} from '../data/casesData';

export function ApproachSection() {
  return (
    <section
      id="approach"
      aria-labelledby="approach-heading"
      className="scroll-mt-20 py-20 sm:py-28 lg:py-40 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        {/* Quiet Section Label */}
        <p className="text-sm font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58 mb-5 sm:mb-6">
          Почему продакшн, а не просто озвучка
        </p>

        {/* One Large, Calm Editorial Thesis */}
        <h2
          id="approach-heading"
          className="max-w-5xl text-2xl sm:text-4xl lg:text-[3.15rem] font-bold tracking-tight leading-[1.14] text-[#111111] dark:text-[#F4F3EF] editorial-balance mb-12 sm:mb-16 lg:mb-24"
        >
          {APPROACH_THESIS}
        </h2>

        {/* Editorial 2-Zone Composition: 01 / 02 / 03 Pillars + Vertical Studio Microphone Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-stretch">
          {/* Left: 01, 02, 03 Spacious Editorial Rows */}
          <div className="lg:col-span-7 flex flex-col justify-between divide-y divide-[#111111]/12 dark:divide-[#F4F3EF]/14 border-t border-[#111111]/12 dark:border-[#F4F3EF]/14">
            {APPROACH_PILLARS.map((pillar) => (
              <div
                key={pillar.number}
                className="py-8 lg:py-10 first:pt-8 last:pb-2 grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-8 items-start"
              >
                <p className="sm:col-span-3 text-4xl sm:text-5xl font-bold tracking-tight tabular-nums text-[#FF4820] leading-none">
                  {pillar.number}
                </p>

                <div className="sm:col-span-9 space-y-2.5">
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                    {pillar.title}
                  </h3>

                  <p className="text-base sm:text-lg leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72 editorial-pretty">
                    {pillar.body}
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
              src={APPROACH_STUDIO_PHOTO.imageUrl}
              alt={APPROACH_STUDIO_PHOTO.imageAlt}
              referrerPolicy="no-referrer"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#0B0A0A]/90 via-[#0B0A0A]/28 to-transparent"
            />

            <figcaption className="relative z-10 space-y-2">
              <p className="text-xs font-medium text-white/68">
                Студийный контроль
              </p>
              <p className="text-base sm:text-lg font-semibold leading-snug text-white editorial-pretty">
                {APPROACH_STUDIO_PHOTO.caption}
              </p>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
