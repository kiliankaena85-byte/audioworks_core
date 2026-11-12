import { ArrowRight, ArrowUpRight, Check, FileCheck2, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import {
  LEGAL_RIGHTS_DELIVERABLES,
  LOCAL_EDITORIAL_IMAGES,
  MODERATION_COMPLIANCE_RULES,
  PRODUCTION_STAGES_24_48H,
} from '../../data/multiPageContentData';
import { PlatformRoute } from '../../data/platformRouter';
import { OrderFormatId } from '../../data/pricingData';
import { FaqSection } from '../FaqSection';
import { PricingSection } from '../PricingSection';

interface PricingPageProps {
  scrollAnchor?: string;
  onSelectFormat: (formatId: OrderFormatId) => void;
  onNavigate: (route: PlatformRoute) => void;
}

export function PricingPage({
  scrollAnchor,
  onSelectFormat,
  onNavigate,
}: PricingPageProps) {
  useEffect(() => {
    if (!scrollAnchor || typeof document === 'undefined') return;
    const timer = window.setTimeout(() => {
      const target = document.getElementById(scrollAnchor);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [scrollAnchor]);

  const scrollToLocalId = (id: string) => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div data-testid="pricing-page-root">
      {/* Вводный редакционный заголовок раздела «Тарифы, регламент и права» */}
      <section className="pt-12 pb-10 sm:pt-16 sm:pb-12 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
            <span>Тарифы и регламент студии</span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span className="tabular-nums">Фиксированная смета по договору и ЭДО</span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span className="tabular-nums">Цикл 24–48 часов</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end">
            <div className="lg:col-span-8 space-y-4">
              <h1 className="text-3xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] editorial-balance">
                Прозрачная стоимость ролика, чистые права и приёмка с первого дубля.
              </h1>
              <p className="text-base sm:text-xl text-[#111111]/70 dark:text-[#F4F3EF]/70 max-w-3xl editorial-pretty">
                В каждый тариф уже включены три концепции сценария, запись актёров дубляжа,
                выравнивание громкости под автомобильную акустику и полный паспорт ролика для
                юридической службы радиостанций.
              </p>
            </div>

            <div className="lg:col-span-4 flex flex-wrap lg:justify-end gap-x-5 gap-y-2 text-xs sm:text-sm font-semibold text-[#111111]/68 dark:text-[#F4F3EF]/68">
              <button
                type="button"
                onClick={() => scrollToLocalId('stages-24-48')}
                className="min-h-[40px] inline-flex items-center hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap"
              >
                Этапы 24–48ч ↓
              </button>
              <button
                type="button"
                onClick={() => scrollToLocalId('legal-clearance')}
                className="min-h-[40px] inline-flex items-center hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap"
              >
                Очистка прав ↓
              </button>
              <button
                type="button"
                onClick={() => scrollToLocalId('faq')}
                className="min-h-[40px] inline-flex items-center hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap"
              >
                Частые вопросы ↓
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Линейка студийных тарифов */}
      <PricingSection onSelectFormat={onSelectFormat} />

      {/* Почасовой регламент продакшна за 24–48 часов */}
      <section
        id="stages-24-48"
        aria-labelledby="stages-heading"
        className="scroll-mt-24 py-20 sm:py-28 lg:py-36 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-12 lg:space-y-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-7 space-y-4">
              <p className="text-sm font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
                Регламент производства
              </p>
              <h2
                id="stages-heading"
                className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
              >
                Как устроен выпуск ролика за 24–48 часов без бесконечных переписок.
              </h2>
              <p className="text-base sm:text-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 max-w-2xl editorial-pretty">
                Ваше участие требуется всего дважды — на старте задачи и при выборе понравившегося
                сценария с голосом. Всю режиссуру, запись и подготовку документов берёт на себя
                студия.
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-3xl aspect-[16/10] bg-[#141418] border border-[#111111]/10 dark:border-white/10">
                <img
                  src={LOCAL_EDITORIAL_IMAGES.studioLegalMastering}
                  alt="Рабочий стол продюсера в студии звукозаписи со сценарием и студийным микрофоном"
                  decoding="async"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (!img.dataset.fallbackApplied) {
                      img.dataset.fallbackApplied = '1';
                      img.src = LOCAL_EDITORIAL_IMAGES.studioHero;
                    }
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {PRODUCTION_STAGES_24_48H.map((stage) => (
              <article
                key={stage.stepNumber}
                data-testid={`production-stage-${stage.stepNumber}`}
                className="rounded-3xl p-6 sm:p-9 bg-[#EFECE5]/75 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 flex flex-col justify-between gap-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 text-xs sm:text-sm tabular-nums">
                    <span className="font-bold text-[#FF4820]">Этап {stage.stepNumber}</span>
                    <span className="font-semibold text-[#111111]/60 dark:text-[#F4F3EF]/60">
                      {stage.timeWindow}
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug text-[#111111] dark:text-[#F4F3EF] editorial-balance">
                    {stage.title}
                  </h3>

                  <p className="text-sm sm:text-base leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72 editorial-pretty">
                    {stage.description}
                  </p>
                </div>

                <div className="pt-5 border-t border-[#111111]/10 dark:border-white/10 space-y-2 text-xs sm:text-sm">
                  <p className="text-[#111111]/66 dark:text-[#F4F3EF]/66">
                    <strong className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                      От вас:
                    </strong>{' '}
                    {stage.clientAction}
                  </p>
                  <p className="text-[#111111]/66 dark:text-[#F4F3EF]/66">
                    <strong className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                      На выходе:
                    </strong>{' '}
                    {stage.deliverable}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Юридическая очистка прав (РАО/ВОИС) и эфирная модерация по ФЗ-38 */}
      <section
        id="legal-clearance"
        aria-labelledby="legal-clearance-heading"
        className="scroll-mt-24 py-20 sm:py-28 lg:py-36 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-12 lg:space-y-16">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
              Юридическая чистота и комплаенс
            </p>
            <h2
              id="legal-clearance-heading"
              className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
            >
              Паспорт прав РАО / ВОИС и защита от отклонения ролика юристами станции.
            </h2>
            <p className="text-base sm:text-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 editorial-pretty">
              Каждая радиостанция проверяет рекламный спот по двум контурам: авторские и смежные
              права на музыку и исполнение, а также строгое соответствие Федеральному закону
              «О рекламе» № 38-ФЗ.
            </p>
          </div>

          {/* 3 документа в комплекте поставки */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {LEGAL_RIGHTS_DELIVERABLES.map((doc) => (
              <article
                key={doc.indexLabel}
                className="rounded-3xl p-6 sm:p-8 bg-[#141418] text-[#F4F3EF] border border-white/10 flex flex-col justify-between gap-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 text-xs font-semibold text-white/60 tabular-nums">
                    <span>{doc.indexLabel}</span>
                    <FileCheck2 className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug text-white editorial-balance">
                    {doc.title}
                  </h3>

                  <p className="text-sm leading-relaxed text-white/72 editorial-pretty">
                    {doc.summary}
                  </p>
                </div>

                <ul className="pt-5 border-t border-white/10 space-y-2.5 text-xs sm:text-sm text-white/84">
                  {doc.includedItems.map((line) => (
                    <li key={line} className="flex items-start gap-2.5">
                      <Check
                        className="w-4 h-4 text-[#FF4820] shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          {/* Таблица отраслевой эфирной модерации */}
          <div className="rounded-3xl p-6 sm:p-9 lg:p-11 bg-[#EFECE5]/65 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
                  <ShieldCheck className="w-4 h-4 text-[#FF4820] shrink-0" aria-hidden="true" />
                  <span>Матрица предварительной проверки сценариев по ФЗ-38</span>
                </div>
                <p className="text-xs sm:text-sm text-[#111111]/64 dark:text-[#F4F3EF]/64">
                  Закладываем точный хронометраж обязательных сносок до записи диктора, чтобы не
                  переплачивать за лишние секунды эфира.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigate({ kind: 'cases' })}
                className="min-h-[42px] inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>Отраслевые стандарты в кейсах</span>
                <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </div>

            <div className="divide-y divide-[#111111]/10 dark:divide-white/10 border-t border-b border-[#111111]/10 dark:border-white/10">
              {MODERATION_COMPLIANCE_RULES.map((rule) => (
                <div
                  key={rule.sector}
                  className="py-5 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 items-start"
                >
                  <div className="lg:col-span-3">
                    <h4 className="text-base sm:text-lg font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                      {rule.sector}
                    </h4>
                  </div>
                  <div className="lg:col-span-4 text-sm leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72">
                    <span className="block text-xs font-semibold text-[#111111]/50 dark:text-[#F4F3EF]/50 mb-1">
                      Требование эфирных юристов
                    </span>
                    {rule.mandatoryRequirement}
                  </div>
                  <div className="lg:col-span-5 text-sm leading-relaxed text-[#111111]/86 dark:text-[#F4F3EF]/86">
                    <span className="block text-xs font-semibold text-[#FF4820] mb-1">
                      Решение продюсеров FMWorks
                    </span>
                    {rule.howFmworksSolves}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Частые вопросы */}
      <FaqSection />

      {/* Спокойная финальная полоса перехода к заказу или расчёту эфира */}
      <section className="py-16 sm:py-20 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto rounded-3xl p-7 sm:p-10 lg:p-12 bg-[#141418] text-[#F4F3EF] border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-2.5 max-w-2xl">
            <p className="text-xs sm:text-sm font-medium text-white/60 tabular-nums">
              Единый договор · ЭДО · Приоритетный выпуск при бронировании эфира от 220 000 ₽
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white editorial-balance">
              Передайте задачу голосом за 30 секунд или соберите эфирную сетку с бонусным роликом.
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onSelectFormat('turnkey')}
              className="min-h-[46px] px-6 py-3 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Оформить заказ ролика</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate({ kind: 'hot-air' })}
              className="min-h-[46px] px-5 py-3 rounded-full bg-white/8 hover:bg-white/14 text-white border border-white/16 text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Горящий эфир со скидкой до 45%</span>
              <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
