import { ArrowRight, Mic, Radio } from 'lucide-react';
import { lazy, Suspense, useLayoutEffect } from 'react';
import type { CasePlayerSnapshot } from '../../audio/lazyAudioEngines';
import { BrandCasePoster, CaseId } from '../../data/casesData';
import { AIRTIME_SALES_ENABLED } from '../../data/platformFeatures';
import { parsePlatformRoute, PlatformRoute } from '../../data/platformRouter';
import { OrderFormatId } from '../../data/pricingData';
import { HeroFMStage } from '../HeroFMStage';

const RealRadioBroadcastBench = lazy(() =>
  import('../RealRadioBroadcastBench').then((m) => ({
    default: m.RealRadioBroadcastBench,
  }))
);
const CasesGallery = lazy(() =>
  import('../CasesGallery').then((m) => ({
    default: m.CasesGallery,
  }))
);
const FifteenSecDuel = lazy(() =>
  import('../FifteenSecDuel').then((m) => ({
    default: m.FifteenSecDuel,
  }))
);
const ApproachSection = lazy(() =>
  import('../ApproachSection').then((m) => ({
    default: m.ApproachSection,
  }))
);
const TestimonialsSection = lazy(() =>
  import('../TestimonialsSection').then((m) => ({
    default: m.TestimonialsSection,
  }))
);
const PricingSection = lazy(() =>
  import('../PricingSection').then((m) => ({
    default: m.PricingSection,
  }))
);

function SectionPlaceholder() {
  return <div className="min-h-[280px] w-full" aria-hidden="true" />;
}

interface HomePageProps {
  scrollAnchor?: string;
  navigationTick?: number;
  playerSnap: CasePlayerSnapshot;
  onToggleCase: (item: BrandCasePoster) => void;
  onSeekCase?: (item: BrandCasePoster, ratio: number) => void;
  onWarmCasePlayer?: () => void;
  onStopPreview: (caseId: CaseId) => void;
  onNavigate: (route: PlatformRoute) => void;
  onStartStudioOrder: (formatId?: OrderFormatId | null) => void;
}

export function HomePage({
  scrollAnchor,
  navigationTick = 0,
  playerSnap,
  onToggleCase,
  onSeekCase,
  onWarmCasePlayer,
  onStopPreview,
  onNavigate,
  onStartStudioOrder,
}: HomePageProps) {
  useLayoutEffect(() => {
    if (!scrollAnchor || typeof document === 'undefined') return;
    const target = document.getElementById(scrollAnchor);
    if (target) {
      target.scrollIntoView({
        behavior: 'instant' as ScrollBehavior,
        block: 'start',
      });
    }
  }, [scrollAnchor, navigationTick]);

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
      {/* 1. Полноэкранное живое кино-полотно с A/B-сравнением и журнальным манифестом */}
      <HeroFMStage />

      {/* 1.5. Интерактивный стенд реального регионального радиоэфира (ролик не первым в блоке + проверка своего ролика) */}
      <Suspense fallback={<SectionPlaceholder />}>
        <RealRadioBroadcastBench onStartStudioOrder={onStartStudioOrder} />
      </Suspense>

      {/* 2. Избранные студийные работы с мгновенным аудио-превью и мостом в отраслевой архив */}
      <Suspense fallback={<SectionPlaceholder />}>
        <CasesGallery
          playerSnap={playerSnap}
          onToggleCase={onToggleCase}
          onSeekCase={onSeekCase}
          onWarmCasePlayer={onWarmCasePlayer}
          onStopPreview={onStopPreview}
          onOpenCaseDetail={(caseId) =>
            onNavigate({ kind: 'case-detail', caseSlug: caseId })
          }
        />
      </Suspense>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 -mt-10 pb-20 sm:pb-24">
        <div className="pt-6 border-t border-[#111111]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm sm:text-base text-[#111111]/68 dark:text-[#F4F3EF]/68">
            В разделе «Кейсы» — посекундные партитуры сценариев, решение сносок ФЗ-38 и готовые
            отраслевые стандарты для ЖК, медицины, ритейла и B2B.
          </p>
          <button
            type="button"
            data-testid="home-cases-bridge-btn"
            onClick={() => onNavigate({ kind: 'cases' })}
            className="min-h-[44px] inline-flex items-center gap-2 text-sm font-semibold text-left leading-snug text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer sm:whitespace-nowrap sm:shrink-0"
          >
            <span>Все кейсы и 4 отраслевых стандарта</span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 3. Слепое сравнение 15 секунд: потоковый шаблон против режиссуры FMWorks */}
      <Suspense fallback={<SectionPlaceholder />}>
        <FifteenSecDuel />
      </Suspense>

      {/* 4. Подход студии, нейроисследования внимания и переход к разбору 5 ошибок */}
      <Suspense fallback={<SectionPlaceholder />}>
        <ApproachSection />
      </Suspense>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 -mt-10 pb-20 sm:pb-24">
        <div className="pt-6 border-t border-[#111111]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm sm:text-base text-[#111111]/68 dark:text-[#F4F3EF]/68">
            Почему слушатели фильтруют 80% типовых объявлений: подробные разборы сценариев «до и
            после» собраны в разделе «О подходе».
          </p>
          <button
            type="button"
            data-testid="home-approach-bridge-btn"
            onClick={() =>
              onNavigate({ kind: 'approach', scrollAnchor: 'radio-mistakes' })
            }
            className="min-h-[44px] inline-flex items-center gap-2 text-sm font-semibold text-left leading-snug text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer sm:whitespace-nowrap sm:shrink-0"
          >
            <span>Разбор 5 ошибок в радиороликах</span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 5. Отзывы заказчиков и линейка тарифов с переходом к регламенту и FAQ */}
      <Suspense fallback={<SectionPlaceholder />}>
        <TestimonialsSection
          playerSnap={playerSnap}
          onToggleCase={onToggleCase}
          onOpenQuickOrder={() => onStartStudioOrder(null)}
          onNavigateRelated={handleRelatedTestimonialNavigate}
        />

        <PricingSection onSelectFormat={(formatId) => onStartStudioOrder(formatId)} />
      </Suspense>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 -mt-10 pb-20 sm:pb-24">
        <div className="pt-6 border-t border-[#111111]/10 dark:border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <p className="text-sm sm:text-base text-[#111111]/68 dark:text-[#F4F3EF]/68 inline-flex items-start sm:items-center gap-2">
            <Mic className="w-4 h-4 text-[#FF4820] shrink-0 mt-1 sm:mt-0" aria-hidden="true" />
            <span>
              Сроки после договора и предоплаты: от 24–48 ч по готовому тексту · 3–4 дня под ключ.
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 min-w-0">
            <button
              type="button"
              data-testid="home-pricing-details-bridge-btn"
              onClick={() =>
                onNavigate({ kind: 'pricing', scrollAnchor: 'stages-24-48' })
              }
              className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-semibold text-left leading-snug text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer sm:whitespace-nowrap"
            >
              <span>Этапы производства и паспорт РАО/ВОИС</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              data-testid="home-faq-bridge-btn"
              onClick={() => onNavigate({ kind: 'faq' })}
              className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-semibold text-left leading-snug text-[#111111]/75 dark:text-[#F4F3EF]/75 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer sm:whitespace-nowrap"
            >
              <span>Вопросы по договору, ЭДО и 54-ФЗ</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {AIRTIME_SALES_ENABLED && (
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
      )}
    </div>
  );
}
