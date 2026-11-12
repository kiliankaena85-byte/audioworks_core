import { ArrowRight, ArrowUpRight, Radio } from 'lucide-react';
import { useEffect } from 'react';
import { CasePlayerSnapshot } from '../../audio/casePlayerEngine';
import { BrandDomainVariant } from '../../data/brandKitData';
import { BrandCasePoster, CaseId } from '../../data/casesData';
import {
  INDUSTRY_SOLUTIONS,
  LOCAL_EDITORIAL_IMAGES,
  PRODUCTION_STAGES_24_48H,
} from '../../data/multiPageContentData';
import {
  parsePlatformRoute,
  PlatformRoute,
  VALID_INDUSTRY_SLUGS,
} from '../../data/platformRouter';
import { OrderFormatId } from '../../data/pricingData';
import { CasesGallery } from '../CasesGallery';
import { FifteenSecDuel } from '../FifteenSecDuel';
import { HeroKotoLens } from '../HeroKotoLens';
import { TestimonialsSection } from '../TestimonialsSection';

interface HomePageProps {
  scrollAnchor?: string;
  brandVariant: BrandDomainVariant;
  onOpenBrandKit: () => void;
  playerSnap: CasePlayerSnapshot;
  onToggleCase: (item: BrandCasePoster) => void;
  onStartPreview: (item: BrandCasePoster) => void;
  onStopPreview: (caseId: CaseId) => void;
  onNavigate: (route: PlatformRoute) => void;
  onStartStudioOrder: (formatId?: OrderFormatId | null) => void;
}

export function HomePage({
  scrollAnchor,
  brandVariant,
  onOpenBrandKit,
  playerSnap,
  onToggleCase,
  onStartPreview,
  onStopPreview,
  onNavigate,
  onStartStudioOrder,
}: HomePageProps) {
  useEffect(() => {
    if (!scrollAnchor || typeof document === 'undefined') return;
    const timer = window.setTimeout(() => {
      const target = document.getElementById(scrollAnchor);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [scrollAnchor]);

  const handleRelatedTestimonialNavigate = (href: string) => {
    if (href.startsWith('#duel')) {
      const el = document.getElementById('duel');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    const parsed = parsePlatformRoute('/', '', href);
    onNavigate(parsed);
  };

  return (
    <div data-testid="home-page-root">
      {/* 1. Интерактивная сцена и студийный манифест */}
      <HeroKotoLens brandVariant={brandVariant} onOpenBrandKit={onOpenBrandKit} />

      {/* 2. Слепое сравнение 15 секунд: потоковый шаблон против режиссуры FMWorks */}
      <FifteenSecDuel />

      {/* 3. Избранные студийные работы с мгновенным аудио-превью */}
      <CasesGallery
        playerSnap={playerSnap}
        onToggleCase={onToggleCase}
        onStartPreview={onStartPreview}
        onStopPreview={onStopPreview}
        onOpenCaseDetail={(caseId) =>
          onNavigate({ kind: 'case-detail', caseSlug: caseId })
        }
      />

      {/* Тихая полоса перехода в полный архив кейсов со сценариями */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 -mt-10 pb-20 sm:pb-24">
        <div className="pt-6 border-t border-[#111111]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm sm:text-base text-[#111111]/68 dark:text-[#F4F3EF]/68">
            В полном архиве каждого проекта — посекундная партитура сценария, решение
            юридических сносок и показатели эфирного отклика.
          </p>
          <button
            type="button"
            onClick={() => onNavigate({ kind: 'cases' })}
            className="min-h-[44px] inline-flex items-center gap-2 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Все кейсы, сценарии и цифры</span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 4. Отраслевые решения аудиопродакшна (ЖК, Медицина, Ритейл, B2B) */}
      <section
        id="industries-navigator"
        aria-labelledby="industries-navigator-heading"
        className="py-20 sm:py-28 lg:py-36 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-12 lg:space-y-16">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-3xl space-y-3">
              <p className="text-sm font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
                Отраслевая специализация студии
              </p>
              <h2
                id="industries-navigator-heading"
                className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
              >
                Готовые стандарты драматургии и модерации для вашей индустрии.
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onNavigate({ kind: 'approach' })}
              className="min-h-[44px] inline-flex items-center gap-2 text-sm font-semibold text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Разбор 5 ошибок в радиороликах</span>
              <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {VALID_INDUSTRY_SLUGS.map((slug) => {
              const spec = INDUSTRY_SOLUTIONS[slug];
              return (
                <article
                  key={spec.slug}
                  data-testid={`home-industry-card-${spec.slug}`}
                  onClick={() =>
                    onNavigate({ kind: 'industry-detail', industrySlug: spec.slug })
                  }
                  className="group rounded-3xl overflow-hidden bg-[#EFECE5]/70 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 hover:border-[#FF4820]/60 transition-colors cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-[#141418]">
                    <img
                      src={spec.coverImageUrl}
                      alt={spec.coverImageAlt}
                      decoding="async"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (!img.dataset.fallbackApplied) {
                          img.dataset.fallbackApplied = '1';
                          img.src = LOCAL_EDITORIAL_IMAGES.studioHero;
                        }
                      }}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </div>

                  <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between gap-6">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58 tabular-nums">
                        <span>{spec.shortTitle}</span>
                        <span>Оптимум · {spec.optimalDurationRange}</span>
                      </div>

                      <h3 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug text-[#111111] dark:text-[#F4F3EF] group-hover:text-[#FF4820] transition-colors editorial-balance">
                        {spec.fullTitle}
                      </h3>

                      <p className="text-sm sm:text-base leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72 editorial-pretty">
                        {spec.heroSummary}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-[#111111]/10 dark:border-white/10 flex items-center justify-between gap-4 text-xs sm:text-sm font-semibold">
                      <span className="text-[#111111] dark:text-[#F4F3EF] group-hover:text-[#FF4820] transition-colors">
                        Сценарий, слоты и правила ФЗ-38
                      </span>
                      <ArrowRight
                        className="w-4 h-4 text-[#FF4820] transition-transform duration-200 group-hover:translate-x-0.5 shrink-0"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Короткий ритм продакшна за 24–48 часов с переходом в «Тарифы и права» */}
      <section
        aria-labelledby="home-rhythm-heading"
        className="py-20 sm:py-28 lg:py-36 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-12">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-3xl space-y-3">
              <p className="text-sm font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
                Студийный процесс без бюрократии
              </p>
              <h2
                id="home-rhythm-heading"
                className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
              >
                От 30-секундного голосового брифа до эфирного мастера за 24–48 часов.
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onNavigate({ kind: 'pricing' })}
              className="min-h-[44px] inline-flex items-center gap-2 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Тарифы от 15 000 ₽ и очистка прав</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
            {PRODUCTION_STAGES_24_48H.map((stage) => (
              <div
                key={stage.stepNumber}
                className="pt-6 border-t border-[#111111]/14 dark:border-white/14 space-y-3"
              >
                <div className="flex items-center justify-between text-xs font-semibold tabular-nums">
                  <span className="text-[#FF4820]">{stage.stepNumber}</span>
                  <span className="text-[#111111]/55 dark:text-[#F4F3EF]/55">
                    {stage.timeWindow}
                  </span>
                </div>
                <h3 className="text-lg font-bold tracking-tight leading-snug text-[#111111] dark:text-[#F4F3EF]">
                  {stage.title}
                </h3>
                <p className="text-sm leading-relaxed text-[#111111]/68 dark:text-[#F4F3EF]/68">
                  {stage.deliverable}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Отзывы директоров по маркетингу и собственников */}
      <TestimonialsSection
        onOpenQuickOrder={() => onStartStudioOrder(null)}
        onNavigateRelated={handleRelatedTestimonialNavigate}
      />

      {/* 7. Спокойный мост в отдельный раздел «Горящий эфир» (эфир вынесен с Главной) */}
      <section
        aria-label="Переход к бронированию радиоэфира"
        className="py-16 sm:py-24 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 px-4 sm:px-6 lg:px-12"
      >
        <div className="max-w-7xl mx-auto rounded-3xl p-7 sm:p-11 lg:p-14 bg-[#141418] text-[#F4F3EF] border border-white/10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-medium text-white/62 tabular-nums">
              <Radio className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
              <span>Отдельное направление платформы · Медиабаинг</span>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span>Скидки на горящие слоты до 45%</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight leading-[1.1] text-white editorial-balance">
              Нужен не только сильный ролик, но и выгодный выход на радиостанциях?
            </h2>

            <p className="text-sm sm:text-lg text-white/72 max-w-2xl editorial-pretty">
              Мы вынесли подбор тайм-слотов, портреты аудитории 12 радиостанций и честный
              посекундный расчёт хронометража в самостоятельный раздел «Горящий эфир».
            </p>
          </div>

          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3">
            <button
              type="button"
              onClick={() => onNavigate({ kind: 'hot-air' })}
              className="min-h-[48px] px-6 py-3.5 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Открыть «Горящий эфир»</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onStartStudioOrder('turnkey')}
              className="min-h-[46px] px-6 py-3 rounded-full bg-white/8 hover:bg-white/14 text-white border border-white/16 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Заказать только продакшн</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
