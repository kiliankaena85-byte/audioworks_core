import { Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useStudioCms } from '../cms/StudioCmsContext';
import { toggleFaqItem } from '../data/faqData';

export function FaqSection() {
  const { snapshot } = useStudioCms();
  const siteCopy = snapshot.siteCopy;
  const faqItems = siteCopy.faqItems;

  const [openId, setOpenId] = useState<string | null>(
    faqItems[0]?.id ?? null
  );

  useEffect(() => {
    if (openId && !faqItems.some((item) => item.id === openId)) {
      setOpenId(faqItems[0]?.id ?? null);
    }
  }, [faqItems, openId]);

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="scroll-mt-24 py-20 sm:py-28 lg:py-40 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* Left Editorial Masthead */}
          <div className="lg:col-span-4 lg:sticky lg:top-28">
            <p className="text-sm font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58 mb-4 sm:mb-5">
              {siteCopy.faqEyebrow}
            </p>
            <h2
              id="faq-heading"
              className="text-3xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] editorial-balance mb-4 sm:mb-5"
            >
              {siteCopy.faqHeading}
            </h2>
            <p className="text-base sm:text-lg leading-relaxed text-[#111111]/66 dark:text-[#F4F3EF]/66 editorial-pretty">
              {siteCopy.faqSubheading}
            </p>
          </div>

          {/* Right Magazine Accordion */}
          <div className="lg:col-span-8 border-b border-[#111111]/12 dark:border-[#F4F3EF]/14">
            {faqItems.map((item) => {
              const isOpen = openId === item.id;
              const buttonId = `faq-trigger-${item.id}`;
              const panelId = `faq-panel-${item.id}`;

              return (
                <article
                  key={item.id}
                  data-testid={`faq-item-${item.id}`}
                  className="border-t border-[#111111]/12 dark:border-[#F4F3EF]/14"
                >
                  <h3>
                    <button
                      id={buttonId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenId((prev) => toggleFaqItem(prev, item.id))}
                      className="group w-full py-7 sm:py-9 text-left flex items-start justify-between gap-6 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF4820]"
                    >
                      <div className="flex items-baseline gap-4 sm:gap-6 min-w-0">
                        <span
                          className={`text-sm font-semibold tabular-nums shrink-0 transition-colors duration-200 ${
                            isOpen
                              ? 'text-[#FF4820]'
                              : 'text-[#111111]/40 dark:text-[#F4F3EF]/40 group-hover:text-[#FF4820]'
                          }`}
                        >
                          {item.indexLabel}
                        </span>
                        <span
                          className={`text-xl sm:text-2xl lg:text-[1.65rem] font-bold tracking-tight leading-[1.22] editorial-balance transition-colors duration-200 ${
                            isOpen
                              ? 'text-[#111111] dark:text-[#F4F3EF]'
                              : 'text-[#111111]/90 dark:text-[#F4F3EF]/90 group-hover:text-[#FF4820] dark:group-hover:text-[#FF4820]'
                          }`}
                        >
                          {item.question}
                        </span>
                      </div>

                      <span
                        aria-hidden="true"
                        className={`mt-0.5 w-11 h-11 rounded-full border flex items-center justify-center shrink-0 transition-all duration-200 ${
                          isOpen
                            ? 'border-[#FF4820] bg-[#FF4820] text-white rotate-45'
                            : 'border-[#111111]/15 dark:border-[#F4F3EF]/18 text-[#111111] dark:text-[#F4F3EF] group-hover:border-[#FF4820] group-hover:text-[#FF4820]'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
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
                        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="pl-8 sm:pl-11 pr-4 sm:pr-12 pb-8 sm:pb-10">
                          <p className="text-base sm:text-lg leading-relaxed text-[#111111]/74 dark:text-[#F4F3EF]/74 max-w-2xl editorial-pretty">
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
    </section>
  );
}
