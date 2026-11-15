import { ArrowRight, ArrowUpRight, Search, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  buildFaqPageJsonLd,
  doesFaqTextMatchQuery,
  FAQ_QUICK_SEARCH_TOPICS,
  FAQ_URGENT_ORDER_SEARCH_TEXT,
  filterFaqItems,
  HOME_PROCESS_FAQ_ITEMS,
  normalizeFaqSearchText,
  serializeJsonLd,
} from '../../data/faqData';
import { PlatformRoute } from '../../data/platformRouter';
import { OrderFormatId } from '../../data/pricingData';
import { FaqHighlightedText, FAQSection } from '../FAQSection';

interface FaqPageProps {
  scrollAnchor?: string;
  navigationTick?: number;
  onNavigate: (route: PlatformRoute) => void;
  onStartOrder: (formatId?: OrderFormatId | null) => void;
}

export function FaqPage({
  scrollAnchor,
  navigationTick = 0,
  onNavigate,
  onStartOrder,
}: FaqPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useLayoutEffect(() => {
    if (!scrollAnchor || typeof document === 'undefined') return;
    if (scrollAnchor === 'urgent-order') {
      setSearchQuery('');
    }
    const target = document.getElementById(scrollAnchor);
    if (target) {
      target.scrollIntoView({
        behavior: 'instant' as ScrollBehavior,
        block: 'start',
      });
    }
  }, [scrollAnchor, navigationTick]);

  useEffect(() => {
    const ssrScript = document.head.querySelector('#fmworks-faqpage-jsonld');
    if (ssrScript) {
      ssrScript.remove();
    }
  }, []);

  const normalizedQuery = useMemo(
    () => normalizeFaqSearchText(searchQuery),
    [searchQuery]
  );
  const hasActiveSearch = normalizedQuery.length > 0;

  const filteredFaqItems = useMemo(
    () => filterFaqItems(HOME_PROCESS_FAQ_ITEMS, searchQuery),
    [searchQuery]
  );

  const urgentOrderMatches = useMemo(
    () => doesFaqTextMatchQuery(FAQ_URGENT_ORDER_SEARCH_TEXT, searchQuery),
    [searchQuery]
  );

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
          'Как устроена проверка реквизитов, 100% предоплата по договору или банковской картой, срочный заказ от 1 часа, договорной тариф, сроки продакшна и передача паспорта прав РАО/ВОИС.',
      })
    );
  }, []);

  const handleResetSearch = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  return (
    <div data-testid="faq-page-root">
      <script
        id="fmworks-faqpage-jsonld"
        data-testid="faq-page-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLdMarkup }}
      />
      {/* Редакционная шапка раздела FAQ + мгновенный поиск */}
      <section className="pt-10 pb-6 sm:pt-14 sm:pb-8 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
          <div className="space-y-4">
            <div
              data-testid="faq-header-kicker"
              className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58"
            >
              <span>Частые вопросы и регламент</span>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span>100% предоплата по договору или банковской картой</span>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span>Срочный заказ от 1 часа</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-[3.35rem] font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] max-w-4xl editorial-balance">
              Ответы на частые вопросы о договоре, оплате и этапах создания ролика.
            </h1>
          </div>

          {/* Панель мгновенного поиска по вопросам и ответам */}
          <div
            data-testid="faq-search-bar"
            className="pt-1 space-y-3 max-w-7xl"
          >
            <div className="relative flex items-center rounded-2xl border border-[#111111]/15 dark:border-white/15 bg-[#EFECE5]/65 dark:bg-[#15151A] focus-within:border-[#FF4820] dark:focus-within:border-[#FF4820] transition-colors">
              <Search
                className="w-4 h-4 sm:w-5 sm:h-5 text-[#111111]/48 dark:text-[#F4F3EF]/48 ml-4 sm:ml-5 shrink-0 pointer-events-none"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="text"
                inputMode="search"
                role="searchbox"
                data-testid="faq-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && searchQuery.length > 0) {
                    e.preventDefault();
                    setSearchQuery('');
                  }
                }}
                aria-label="Мгновенный поиск по вопросам и ответам FAQ"
                placeholder="Поиск по вопросам: счёт, ЭДО, 1 час, РАО..."
                className="w-full min-w-0 bg-transparent px-3 sm:px-4 py-3.5 sm:py-4 text-sm sm:text-base text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/45 dark:placeholder:text-[#F4F3EF]/45 focus:outline-none"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  data-testid="faq-search-clear"
                  onClick={handleResetSearch}
                  aria-label="Очистить поисковый запрос"
                  className="mr-2.5 sm:mr-3 w-10 h-10 rounded-xl flex items-center justify-center text-[#111111]/60 dark:text-[#F4F3EF]/60 hover:text-[#FF4820] dark:hover:text-[#FF4820] hover:bg-[#111111]/5 dark:hover:bg-white/6 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Быстрые фильтры тем FAQ"
              >
                {FAQ_QUICK_SEARCH_TOPICS.map((topic) => {
                  const isActive =
                    normalizeFaqSearchText(topic.query) === normalizedQuery;
                  return (
                    <button
                      key={topic.label}
                      type="button"
                      data-testid={`faq-topic-${normalizeFaqSearchText(topic.label).replace(/\s+/g, '-')}`}
                      aria-pressed={isActive}
                      onClick={() =>
                        setSearchQuery(isActive ? '' : topic.query)
                      }
                      className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        isActive
                          ? 'border-[#FF4820] bg-[#FF4820]/10 dark:bg-[#FF4820]/18 text-[#FF4820]'
                          : 'border-[#111111]/12 dark:border-white/14 bg-transparent text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:border-[#FF4820]/55 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                      }`}
                    >
                      {topic.label}
                    </button>
                  );
                })}
              </div>

              <p
                data-testid="faq-search-count"
                aria-live="polite"
                className="text-xs sm:text-sm font-medium text-[#111111]/60 dark:text-[#F4F3EF]/60 tabular-nums shrink-0"
              >
                {hasActiveSearch
                  ? `Найдено: ${filteredFaqItems.length} из ${HOME_PROCESS_FAQ_ITEMS.length}${
                      urgentOrderMatches ? ' · + срочный блок' : ''
                    }`
                  : `Вопросов в базе: ${HOME_PROCESS_FAQ_ITEMS.length}`}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Выделенный блок «Срочный заказ» (от 1 часа · без разработки сценария · по договорной цене) */}
      {(!hasActiveSearch || urgentOrderMatches) && (
        <section
          id="urgent-order"
          aria-labelledby="faq-urgent-order-heading"
          className="scroll-mt-24 pb-6 sm:pb-10 px-4 sm:px-6 lg:px-12"
        >
          <div
            data-testid="faq-urgent-order-block"
            className="max-w-7xl mx-auto rounded-3xl p-6 sm:p-8 lg:p-10 bg-[#EFECE5]/75 dark:bg-[#15151A] border border-[#111111]/12 dark:border-white/12 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
          >
            <div className="space-y-3 max-w-3xl">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-semibold text-[#FF4820] tabular-nums">
                <span>
                  <FaqHighlightedText
                    text="Готовность от 1 часа"
                    query={searchQuery}
                  />
                </span>
                <span aria-hidden="true" className="opacity-40">
                  ·
                </span>
                <span>
                  <FaqHighlightedText
                    text="Без разработки сценария"
                    query={searchQuery}
                  />
                </span>
                <span aria-hidden="true" className="opacity-40">
                  ·
                </span>
                <span>
                  <FaqHighlightedText
                    text="Договорная цена"
                    query={searchQuery}
                  />
                </span>
              </div>

              <h2
                id="faq-urgent-order-heading"
                className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-[#111111] dark:text-[#F4F3EF] editorial-balance"
              >
                <FaqHighlightedText text="Срочный заказ" query={searchQuery} />
              </h2>

              <p
                data-testid="faq-urgent-order-copy"
                className="text-base sm:text-lg font-medium leading-relaxed text-[#111111] dark:text-[#F4F3EF] editorial-pretty"
              >
                <FaqHighlightedText
                  text="Да, мы делаем ролики от 1 часа. Запись голоса и сведение. Без разработки сценария. Срочные заказы оплачиваются по договорной цене."
                  query={searchQuery}
                />
              </p>

              <p className="text-xs sm:text-sm leading-relaxed text-[#111111]/68 dark:text-[#F4F3EF]/68 editorial-pretty">
                <FaqHighlightedText
                  text="По вашему готовому тексту вне очереди записываем диктора и выпускаем чистовой эфирный мастер (−14 LUFS, WAV + MP3) на условиях 100% предоплаты по договору или банковской картой."
                  query={searchQuery}
                />
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                type="button"
                data-testid="faq-urgent-order-cta"
                onClick={() => onStartOrder('custom_consult')}
                className="min-h-[46px] px-5 sm:px-6 py-3 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>Оформить срочный заказ</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Основной список вопросов и ответов */}
      <FAQSection
        sectionId="faq-page-list"
        testId="faq-page-section"
        compactPadding
        eyebrow="Процесс без недосказанности"
        heading="От проверки реквизитов до готового мастера."
        subheading="100% предоплата по договору или банковской картой — затем разработка сценария, запись актёров кино и передача паспорта прав РАО/ВОИС."
        itemsOverride={filteredFaqItems}
        highlightQuery={searchQuery}
        emptyStateTitle={
          urgentOrderMatches
            ? 'Совпадение найдено только в регламенте «Срочный заказ»'
            : undefined
        }
        emptyStateHint={
          urgentOrderMatches
            ? 'В основном списке вопросов точных совпадений нет, либо сбросьте фильтр, чтобы просмотреть все 7 ответов.'
            : undefined
        }
        onResetSearch={handleResetSearch}
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
