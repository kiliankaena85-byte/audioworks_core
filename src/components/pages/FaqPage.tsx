import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import {
  buildFaqPageJsonLd,
  HOME_PROCESS_FAQ_ITEMS,
  serializeJsonLd,
} from '../../data/faqData';
import { PlatformRoute } from '../../data/platformRouter';
import { OrderFormatId } from '../../data/pricingData';
import { FAQSection } from '../FAQSection';

interface FaqPageProps {
  onNavigate: (route: PlatformRoute) => void;
  onStartOrder: (formatId?: OrderFormatId | null) => void;
}

export function FaqPage({ onNavigate, onStartOrder }: FaqPageProps) {
  useEffect(() => {
    const ssrScript = document.head.querySelector('#fmworks-faqpage-jsonld');
    if (ssrScript) {
      ssrScript.remove();
    }
  }, []);

  const faqJsonLdMarkup = useMemo(() => {
    const pageUrl =
      typeof window !== 'undefined' && window.location.origin
        ? `${window.location.origin}/faq`
        : 'https://fmworks.ru/faq';

    return serializeJsonLd(
      buildFaqPageJsonLd(HOME_PROCESS_FAQ_ITEMS, {
        pageUrl,
        name: 'Ответы на частые вопросы о договоре, оплате и этапах создания ролика — FMWorks',
        description:
          'Как устроена проверка реквизитов, рамочный договор и счёт в ЭДО, оплата картой физлица по 54-ФЗ, договорной тариф, сроки продакшна и передача паспорта прав РАО/ВОИС.',
      })
    );
  }, []);

  return (
    <div data-testid="faq-page-root">
      <script
        id="fmworks-faqpage-jsonld"
        data-testid="faq-page-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLdMarkup }}
      />
      {/* Редакционная шапка раздела FAQ */}
      <section className="pt-10 pb-6 sm:pt-14 sm:pb-8 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
            <span>Частые вопросы и регламент</span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span>Рамочный договор и ЭДО</span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span>100% предоплата или карта 54-ФЗ</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-[3.35rem] font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] max-w-4xl editorial-balance">
            Ответы на частые вопросы о договоре, оплате и этапах создания ролика.
          </h1>
        </div>
      </section>

      {/* Основной список вопросов и ответов */}
      <FAQSection
        sectionId="faq-page-list"
        testId="faq-page-section"
        compactPadding
        eyebrow="Процесс без недосказанности"
        heading="От проверки реквизитов до готового мастера."
        subheading="Сначала проверка контрагента, договор и предоплата — затем 3 концепции сценария, запись актёров кино и передача паспорта прав РАО/ВОИС."
        itemsOverride={HOME_PROCESS_FAQ_ITEMS}
        ctaLabel="Тарифы, сроки по пакетам и паспорт прав"
        onCtaClick={() => onNavigate({ kind: 'pricing' })}
      />

      {/* Спокойный переход к оформлению заказа или индивидуальной консультации */}
      <section className="py-14 sm:py-18 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] editorial-balance">
              Остались вопросы по нестандартной задаче или нужен точный расчёт?
            </h2>
            <p className="text-sm sm:text-base text-[#111111]/68 dark:text-[#F4F3EF]/68">
              Укажите реквизиты для мгновенного счёта в ЭДО по фиксированному тарифу или выберите
              индивидуальную консультацию по договорной цене с продюсером.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full sm:w-auto min-w-0">
            <button
              type="button"
              data-testid="faq-page-order-cta"
              onClick={() => onStartOrder(null)}
              className="w-full sm:w-auto min-h-[46px] px-5 sm:px-6 py-3 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 text-center leading-snug transition-colors cursor-pointer sm:whitespace-nowrap"
            >
              <span>Оформить заказ и получить счёт</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              data-testid="faq-page-consult-cta"
              onClick={() => onStartOrder('custom_consult')}
              className="w-full sm:w-auto min-h-[46px] px-5 py-3 rounded-full border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-sm font-semibold inline-flex items-center justify-center gap-2 text-center leading-snug transition-colors cursor-pointer sm:whitespace-nowrap"
            >
              <span>Обсудить договорную цену</span>
              <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
