import { ArrowUp, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import {
  CHRONOMETER_FAQ_CATEGORY_TABS,
  CHRONOMETER_FAQ_ITEMS,
  CHRONOMETER_TEMPO_BENCHMARK_ROWS,
  type ChronometerFaqCategory,
  filterChronometerFaqItems,
} from '../data/chronometerFaqData';
import { buildFaqPageJsonLd, serializeJsonLd } from '../data/faqData';

export interface ChronometerFaqSectionProps {
  onScrollToCalculator?: () => void;
}

export function ChronometerFaqSection({
  onScrollToCalculator,
}: ChronometerFaqSectionProps) {
  const [activeCategory, setActiveCategory] =
    useState<ChronometerFaqCategory>('all');
  const [openIds, setOpenIds] = useState<readonly string[]>([
    CHRONOMETER_FAQ_ITEMS[0]!.id,
  ]);

  const visibleItems = useMemo(
    () => filterChronometerFaqItems(activeCategory),
    [activeCategory]
  );

  const areAllVisibleOpen =
    visibleItems.length > 0 &&
    visibleItems.every((item) => openIds.includes(item.id));

  const handleSelectCategory = (nextCategory: ChronometerFaqCategory) => {
    setActiveCategory(nextCategory);
    const nextItems = filterChronometerFaqItems(nextCategory);
    if (
      nextItems.length > 0 &&
      !nextItems.some((item) => openIds.includes(item.id))
    ) {
      setOpenIds([nextItems[0]!.id]);
    }
  };

  const handleToggleItem = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleAllVisible = () => {
    if (areAllVisibleOpen) {
      setOpenIds([]);
    } else {
      setOpenIds(visibleItems.map((item) => item.id));
    }
  };

  const handleJumpToCalculator = () => {
    if (onScrollToCalculator) {
      onScrollToCalculator();
      return;
    }
    if (typeof document !== 'undefined') {
      document
        .getElementById('script-chronometer')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const jsonLdString = useMemo(
    () =>
      serializeJsonLd(
        buildFaqPageJsonLd(CHRONOMETER_FAQ_ITEMS, {
          pageUrl: 'https://fmworks.ru/pricing#chronometer-faq',
          name: 'Часто задаваемые вопросы о хронометраже аудиороликов и ФЗ-38 — FMWorks',
          description:
            'Разбор факторов скорости дикторской речи, озвучивания телефонных номеров и цифр, а также обязательных юридических сносок по ФЗ-38 «О рекламе».',
        })
      ),
    []
  );

  return (
    <section
      id="chronometer-faq"
      data-testid="pricing-chronometer-faq-section"
      aria-labelledby="chronometer-faq-heading"
      className="scroll-mt-24 py-16 sm:py-24 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 px-4 sm:px-6 lg:px-12"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString }}
      />

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* Левая редакционная колонка + эталонная таблица объёма текста */}
          <div className="min-w-0 lg:col-span-4 lg:sticky lg:top-28 space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
                <span>Методика расчёта</span>
                <span aria-hidden="true" className="opacity-40">
                  ·
                </span>
                <span>Правила эфира и ФЗ-38</span>
              </div>

              <h2
                id="chronometer-faq-heading"
                className="text-2xl sm:text-4xl lg:text-[2.5rem] font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
              >
                Часто задаваемые вопросы о хронометраже
              </h2>

              <p className="text-sm sm:text-base leading-relaxed text-[#111111]/68 dark:text-[#F4F3EF]/68 editorial-pretty">
                Коротко объясняем, почему студийная начитка отличается от чтения
                «про себя», как цифры превращаются в секунды и какие требования
                закона о рекламе алгоритм проверяет автоматически.
              </p>
            </div>

            {/* Компактная справочная линейка эталонов (чистые разделители, tabular-nums) */}
            <div
              data-testid="chronometer-faq-benchmarks"
              className="pt-4 border-t border-[#111111]/10 dark:border-[#F4F3EF]/12 space-y-2.5 tabular-nums"
            >
              <p className="text-xs font-semibold text-[#111111]/62 dark:text-[#F4F3EF]/62">
                Ориентир объёма без сносок (темп 120 сл/мин):
              </p>
              <dl className="divide-y divide-[#111111]/8 dark:divide-[#F4F3EF]/10 text-xs sm:text-sm">
                {CHRONOMETER_TEMPO_BENCHMARK_ROWS.map((row) => (
                  <div
                    key={row.slotSec}
                    className="py-2 flex items-center justify-between gap-3"
                  >
                    <dt className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                      Ролик {row.slotSec} сек
                    </dt>
                    <dd className="text-[#111111]/72 dark:text-[#F4F3EF]/72">
                      {row.wordsRange}{' '}
                      <span aria-hidden="true" className="opacity-40">
                        ·
                      </span>{' '}
                      {row.charsApprox}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="pt-1">
              <button
                type="button"
                data-testid="chronometer-faq-back-to-calc-btn"
                onClick={handleJumpToCalculator}
                className="min-h-[42px] inline-flex items-center gap-2 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ArrowUp className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Проверить текст в калькуляторе</span>
              </button>
            </div>
          </div>

          {/* Правая колонка: фильтр по темам + чистый аккордеон ответов */}
          <div className="min-w-0 lg:col-span-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                role="group"
                aria-label="Фильтр вопросов о хронометраже"
                className="inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-[#EFECE5]/80 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10"
              >
                {CHRONOMETER_FAQ_CATEGORY_TABS.map((tab) => {
                  const isSelected = activeCategory === tab.id;
                  const count =
                    tab.id === 'all'
                      ? CHRONOMETER_FAQ_ITEMS.length
                      : filterChronometerFaqItems(tab.id).length;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      data-testid={`chrono-faq-filter-${tab.id}`}
                      aria-pressed={isSelected}
                      onClick={() => handleSelectCategory(tab.id)}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold tabular-nums transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                          : 'text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#111111] dark:hover:text-white'
                      }`}
                    >
                      {tab.label} ({count})
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                data-testid="chrono-faq-expand-all-btn"
                onClick={handleToggleAllVisible}
                className="min-h-[36px] px-2 text-xs sm:text-sm font-semibold text-[#111111]/66 dark:text-[#F4F3EF]/66 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {areAllVisibleOpen ? 'Свернуть все' : 'Развернуть все ответы'}
              </button>
            </div>

            <div className="divide-y divide-[#111111]/10 dark:divide-[#F4F3EF]/12 border-y border-[#111111]/10 dark:border-[#F4F3EF]/12">
              {visibleItems.map((item) => {
                const isOpen = openIds.includes(item.id);
                const buttonId = `chronometer-faq-trigger-${item.id}`;
                const panelId = `chronometer-faq-panel-${item.id}`;

                return (
                  <article
                    key={item.id}
                    data-testid={`chrono-faq-item-${item.id}`}
                  >
                    <h3>
                      <button
                        id={buttonId}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => handleToggleItem(item.id)}
                        className="group w-full py-5 sm:py-6 text-left flex items-start sm:items-center justify-between gap-4 sm:gap-6 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF4820]"
                      >
                        <div className="flex items-baseline gap-3.5 sm:gap-4 min-w-0">
                          <span
                            className={`text-xs sm:text-sm font-semibold tabular-nums shrink-0 transition-colors duration-150 ${
                              isOpen
                                ? 'text-[#FF4820]'
                                : 'text-[#111111]/40 dark:text-[#F4F3EF]/40 group-hover:text-[#FF4820]'
                            }`}
                          >
                            {item.indexLabel}
                          </span>
                          <span
                            className={`text-base sm:text-xl font-semibold tracking-tight leading-[1.32] editorial-balance transition-colors duration-150 ${
                              isOpen
                                ? 'text-[#111111] dark:text-[#F4F3EF]'
                                : 'text-[#111111]/88 dark:text-[#F4F3EF]/88 group-hover:text-[#FF4820] dark:group-hover:text-[#FF4820]'
                            }`}
                          >
                            {item.question}
                          </span>
                        </div>

                        <span
                          aria-hidden="true"
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors duration-150 ${
                            isOpen
                              ? 'text-[#FF4820] bg-[#FF4820]/8 dark:bg-[#FF4820]/14'
                              : 'text-[#111111]/60 dark:text-[#F4F3EF]/60 group-hover:text-[#FF4820] group-hover:bg-[#111111]/4 dark:group-hover:bg-white/6'
                          }`}
                        >
                          <Plus
                            className={`w-4 h-4 transition-transform duration-150 ${
                              isOpen ? 'rotate-45' : ''
                            }`}
                          />
                        </span>
                      </button>
                    </h3>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={panelId}
                          role="region"
                          aria-labelledby={buttonId}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            duration: 0.18,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          className="overflow-hidden"
                        >
                          <div className="pl-7 sm:pl-8 pr-2 sm:pr-12 pb-6">
                            <p className="text-sm sm:text-base leading-relaxed text-[#111111]/74 dark:text-[#F4F3EF]/74 max-w-2xl editorial-pretty">
                              {item.answer}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
