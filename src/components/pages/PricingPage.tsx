import { ArrowRight, ArrowUpRight, Check, FileCheck2, ShieldCheck } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import {
  LEGAL_RIGHTS_DELIVERABLES,
  LOCAL_EDITORIAL_IMAGES,
  MODERATION_COMPLIANCE_RULES,
  PRODUCTION_STAGES_24_48H,
} from '../../data/multiPageContentData';
import { AIRTIME_SALES_ENABLED } from '../../data/platformFeatures';
import { PlatformRoute } from '../../data/platformRouter';
import {
  CUSTOM_CONSULT_PRICING_ROW,
  EDITORIAL_PRICING_ROWS,
  OrderFormatId,
} from '../../data/pricingData';
import { BROADCAST_TECH_STANDARD_ROWS } from '../../data/studioDocumentsCore';
import { OptimizedImage } from '../OptimizedImage';
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
  const isFirstMountRef = useRef(true);

  useLayoutEffect(() => {
    const isInitialMount = isFirstMountRef.current;
    isFirstMountRef.current = false;
    if (!scrollAnchor || typeof document === 'undefined') return;
    const target = document.getElementById(scrollAnchor);
    if (target) {
      target.scrollIntoView({
        behavior: isInitialMount ? ('instant' as ScrollBehavior) : 'smooth',
        block: 'start',
      });
    }
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
            <span className="tabular-nums">
              От 24–48 ч по готовому тексту · 3–4 дня под ключ
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end">
            <div className="lg:col-span-8 space-y-4">
              <h1 className="text-3xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] editorial-balance">
                Прозрачная стоимость ролика, чистые права и приёмка с первого дубля.
              </h1>
              <p className="text-base sm:text-xl text-[#111111]/70 dark:text-[#F4F3EF]/70 max-w-3xl editorial-pretty">
                Работаем по рамочному договору и 100% предоплате: после проверки заявки вы сразу
                скачиваете договор-оферту и счёт для ЭДО (либо оплачиваете картой по 54-ФЗ), а мы
                готовим 3 концепции сценария, запись актёров дубляжа и паспорт прав РАО/ВОИС.
              </p>
            </div>

            <div className="lg:col-span-4 flex flex-wrap lg:justify-end gap-x-5 gap-y-2 text-xs sm:text-sm font-semibold text-[#111111]/68 dark:text-[#F4F3EF]/68">
              <button
                type="button"
                onClick={() => scrollToLocalId('stages-24-48')}
                className="min-h-[40px] inline-flex items-center hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap"
              >
                Этапы производства ↓
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
                data-testid="pricing-faq-bridge-top-btn"
                onClick={() => onNavigate({ kind: 'faq' })}
                className="min-h-[40px] inline-flex items-center hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap"
              >
                Вопросы и договор →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Линейка студийных тарифов */}
      <PricingSection onSelectFormat={onSelectFormat} />

      {/* Сводная сравнительная таблица тарифов и вещательных стандартов (для коммерческих факторов и ИИ-поиска) */}
      <section
        id="pricing-comparison"
        aria-labelledby="pricing-comparison-heading"
        className="py-16 sm:py-24 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 px-4 sm:px-6 lg:px-12"
      >
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="space-y-3 max-w-3xl">
            <p className="text-sm font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
              Сравнение форматов и технических норм
            </p>
            <h2
              id="pricing-comparison-heading"
              className="text-2xl sm:text-4xl font-bold tracking-tight leading-[1.1] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
            >
              Сводная таблица стоимости, сроков и требований эфира
            </h2>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-[#111111]/12 dark:border-white/12 bg-[#EFECE5]/50 dark:bg-[#15151A]">
            <table
              data-testid="pricing-comparison-table"
              className="w-full min-w-[640px] text-left border-collapse text-sm"
            >
              <thead>
                <tr className="border-b border-[#111111]/12 dark:border-white/12 text-xs font-semibold text-[#111111]/62 dark:text-[#F4F3EF]/62">
                  <th scope="col" className="py-4 px-5 sm:px-6">
                    Формат работы
                  </th>
                  <th scope="col" className="py-4 px-4">
                    Что входит в пакет
                  </th>
                  <th scope="col" className="py-4 px-4 whitespace-nowrap">
                    Срок сдачи
                  </th>
                  <th scope="col" className="py-4 px-5 sm:px-6 text-right whitespace-nowrap">
                    Стоимость
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#111111]/10 dark:divide-white/10">
                {EDITORIAL_PRICING_ROWS.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="py-4 px-5 sm:px-6 font-bold text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap">
                      {row.title}
                    </td>
                    <td className="py-4 px-4 text-[#111111]/75 dark:text-[#F4F3EF]/75 leading-relaxed">
                      {row.description}
                    </td>
                    <td className="py-4 px-4 tabular-nums font-medium text-[#111111]/82 dark:text-[#F4F3EF]/82 whitespace-nowrap">
                      {row.turnaround}
                    </td>
                    <td className="py-4 px-5 sm:px-6 text-right tabular-nums font-bold text-[#FF4820] whitespace-nowrap">
                      {row.priceFormatted}
                    </td>
                  </tr>
                ))}
                <tr className="align-top">
                  <td className="py-4 px-5 sm:px-6 font-bold text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap">
                    {CUSTOM_CONSULT_PRICING_ROW.title}
                  </td>
                  <td className="py-4 px-4 text-[#111111]/75 dark:text-[#F4F3EF]/75 leading-relaxed">
                    {CUSTOM_CONSULT_PRICING_ROW.description}
                  </td>
                  <td className="py-4 px-4 tabular-nums font-medium text-[#111111]/82 dark:text-[#F4F3EF]/82 whitespace-nowrap">
                    {CUSTOM_CONSULT_PRICING_ROW.turnaround}
                  </td>
                  <td className="py-4 px-5 sm:px-6 text-right tabular-nums font-bold text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap">
                    {CUSTOM_CONSULT_PRICING_ROW.priceFormatted}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-[#111111]/12 dark:border-white/12 bg-[#EFECE5]/40 dark:bg-[#141418]">
            <table
              data-testid="broadcast-tech-standard-table"
              className="w-full min-w-[600px] text-left border-collapse text-sm"
            >
              <thead>
                <tr className="border-b border-[#111111]/12 dark:border-white/12 text-xs font-semibold text-[#111111]/62 dark:text-[#F4F3EF]/62">
                  <th scope="col" className="py-4 px-5 sm:px-6 w-1/3">
                    Единый технический стандарт по договору (ст. 721 ГК РФ)
                  </th>
                  <th scope="col" className="py-4 px-5 sm:px-6">
                    Норматив сдачи для радиостанций РФ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#111111]/10 dark:divide-white/10">
                {BROADCAST_TECH_STANDARD_ROWS.map((row) => (
                  <tr key={row.parameter} className="align-top">
                    <td className="py-4 px-5 sm:px-6 font-semibold text-[#111111] dark:text-[#F4F3EF]">
                      {row.parameter}
                    </td>
                    <td className="py-4 px-5 sm:px-6 text-[#111111]/75 dark:text-[#F4F3EF]/75 leading-relaxed">
                      {row.specification}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

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
                Как устроен выпуск ролика: от 24–48 ч по готовому тексту и 3–4 дня под ключ.
              </h2>
              <p className="text-base sm:text-lg text-[#111111]/70 dark:text-[#F4F3EF]/70 max-w-2xl editorial-pretty">
                Отсчёт сроков начинается строго после проверки реквизитов, заключения рамочного
                договора и 100% предоплаты. Далее ваше участие требуется только при выборе
                понравившегося сценария и голоса диктора.
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-3xl aspect-[16/10] bg-[#141418] border border-[#111111]/10 dark:border-white/10">
                <OptimizedImage
                  src={LOCAL_EDITORIAL_IMAGES.studioLegalMastering}
                  fallbackSrc={LOCAL_EDITORIAL_IMAGES.studioHero}
                  alt="Рабочий стол продюсера в студии звукозаписи со сценарием и студийным микрофоном"
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

      {/* Мост к единому разделу частых вопросов (/faq) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 pb-12">
        <div className="pt-8 border-t border-[#111111]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm sm:text-base text-[#111111]/70 dark:text-[#F4F3EF]/70">
            Вопросы по проверке контрагента, рамочному договору в ЭДО, оплате картой по 54-ФЗ и
            этапу «Только сценарий» собраны на отдельной странице.
          </p>
          <button
            type="button"
            data-testid="pricing-faq-bridge-bottom-btn"
            onClick={() => onNavigate({ kind: 'faq' })}
            className="min-h-[44px] inline-flex items-center gap-2 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Открыть все ответы в разделе FAQ</span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Спокойная финальная полоса перехода к заказу ролика */}
      <section className="py-16 sm:py-20 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto rounded-3xl p-7 sm:p-10 lg:p-12 bg-[#141418] text-[#F4F3EF] border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-2.5 max-w-2xl">
            <p className="text-xs sm:text-sm font-medium text-white/60 tabular-nums">
              {AIRTIME_SALES_ENABLED
                ? 'Единый договор · ЭДО · Приоритетный выпуск при бронировании эфира от 220 000 ₽'
                : 'Рамочный договор · Счёт в ЭДО или карта (54-ФЗ) · Паспорт прав РАО / ВОИС'}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white editorial-balance">
              {AIRTIME_SALES_ENABLED
                ? 'Передайте задачу голосом за 30 секунд или соберите эфирную сетку с бонусным роликом.'
                : 'Оставьте заявку с реквизитами или выберите индивидуальную консультацию по договорной цене.'}
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full sm:w-auto min-w-0">
            <button
              type="button"
              onClick={() => onSelectFormat('turnkey')}
              className="w-full sm:w-auto min-h-[46px] px-5 sm:px-6 py-3 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer sm:whitespace-nowrap"
            >
              <span>Заказать аудиоролик</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>

            {AIRTIME_SALES_ENABLED ? (
              <button
                type="button"
                onClick={() => onNavigate({ kind: 'hot-air' })}
                className="w-full sm:w-auto min-h-[46px] px-5 py-3 rounded-full bg-white/8 hover:bg-white/14 text-white border border-white/16 text-sm font-semibold inline-flex items-center justify-center gap-2 text-center leading-snug transition-colors cursor-pointer sm:whitespace-nowrap"
              >
                <span>Горящий эфир со скидкой до 45%</span>
                <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelectFormat('custom_consult')}
                className="w-full sm:w-auto min-h-[46px] px-5 py-3 rounded-full bg-white/8 hover:bg-white/14 text-white border border-white/16 text-sm font-semibold inline-flex items-center justify-center gap-2 text-center leading-snug transition-colors cursor-pointer sm:whitespace-nowrap"
              >
                <span>Обсудить нестандартный проект</span>
                <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
