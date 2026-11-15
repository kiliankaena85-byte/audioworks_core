import {
  ArrowRight,
  AudioWaveform,
  Clock3,
  FileAudio,
  LucideIcon,
  Mic,
  Plus,
  Radio,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useStudioCms } from '../cms/StudioCmsContext';
import {
  FaqIconKey,
  FaqItem,
  normalizeFaqSearchText,
  resolveFaqIconKey,
  splitFaqHighlightSegments,
  toggleFaqItem,
} from '../data/faqData';

export function FaqHighlightedText({
  text,
  query,
}: {
  text: string;
  query?: string;
}) {
  if (!query || !query.trim()) {
    return <>{text}</>;
  }
  const segments = splitFaqHighlightSegments(text, query);
  return (
    <>
      {segments.map((seg, idx) =>
        seg.matched ? (
          <mark
            key={idx}
            className="bg-[#FF4820]/16 dark:bg-[#FF4820]/28 text-inherit rounded-xs px-0.5"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={idx}>{seg.text}</span>
        )
      )}
    </>
  );
}

export interface FAQSectionProps {
  sectionId?: string;
  testId?: string;
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  itemsOverride?: readonly FaqItem[];
  ctaLabel?: string;
  onCtaClick?: () => void;
  compactPadding?: boolean;
  highlightQuery?: string;
  emptyStateTitle?: string;
  emptyStateHint?: string;
  onResetSearch?: () => void;
}

const FAQ_ICON_MAP: Record<FaqIconKey, LucideIcon> = {
  waveform: AudioWaveform,
  clock: Clock3,
  mic: Mic,
  sliders: SlidersHorizontal,
  shield: ShieldCheck,
  radio: Radio,
  'file-audio': FileAudio,
  receipt: ReceiptText,
};

export function FAQSection({
  sectionId = 'faq',
  testId = 'faq-section',
  eyebrow,
  heading,
  subheading,
  itemsOverride,
  ctaLabel,
  onCtaClick,
  compactPadding = false,
  highlightQuery,
  emptyStateTitle,
  emptyStateHint,
  onResetSearch,
}: FAQSectionProps = {}) {
  const { snapshot } = useStudioCms();
  const siteCopy = snapshot.siteCopy;
  const faqItems = itemsOverride ?? siteCopy.faqItems;
  const resolvedEyebrow = eyebrow ?? siteCopy.faqEyebrow;
  const resolvedHeading = heading ?? siteCopy.faqHeading;
  const resolvedSubheading = subheading ?? siteCopy.faqSubheading;
  const headingElementId = `${sectionId}-heading`;

  const [openId, setOpenId] = useState<string | null>(
    faqItems[0]?.id ?? null
  );
  const normalizedQuery = normalizeFaqSearchText(highlightQuery ?? '');
  const prevQueryRef = useRef<string>(normalizedQuery);

  useEffect(() => {
    if (prevQueryRef.current !== normalizedQuery) {
      prevQueryRef.current = normalizedQuery;
      if (normalizedQuery.length > 0) {
        setOpenId(faqItems[0]?.id ?? null);
      } else if (!openId || !faqItems.some((item) => item.id === openId)) {
        setOpenId(faqItems[0]?.id ?? null);
      }
      return;
    }

    if (openId && !faqItems.some((item) => item.id === openId)) {
      setOpenId(faqItems[0]?.id ?? null);
    }
  }, [faqItems, normalizedQuery, openId]);

  return (
    <section
      id={sectionId}
      data-testid={testId}
      aria-labelledby={headingElementId}
      className={`scroll-mt-24 border-t border-[#111111]/8 dark:border-[#F4F3EF]/10 ${
        compactPadding
          ? 'py-10 sm:py-14 lg:py-16'
          : 'py-18 sm:py-24 lg:py-32'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* Левая редакционная колонка */}
          <div className="min-w-0 lg:col-span-4 lg:sticky lg:top-28 space-y-5">
            <div className="space-y-3.5">
              <p className="text-sm font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
                {resolvedEyebrow}
              </p>
              <h2
                id={headingElementId}
                className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
              >
                {resolvedHeading}
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-[#111111]/66 dark:text-[#F4F3EF]/66 editorial-pretty">
                {resolvedSubheading}
              </p>
            </div>

            {ctaLabel && onCtaClick && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onCtaClick}
                  className="min-h-11 max-w-full inline-flex items-center gap-2 text-left text-sm font-semibold leading-snug text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer"
                >
                  <span>{ctaLabel}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          {/* Правый минималистичный аккордеон с контекстными иконками */}
          <div className="min-w-0 lg:col-span-8 divide-y divide-[#111111]/10 dark:divide-[#F4F3EF]/12 border-y border-[#111111]/10 dark:border-[#F4F3EF]/12">
            {faqItems.length === 0 ? (
              <div
                data-testid="faq-search-empty"
                className="py-10 sm:py-12 space-y-4"
              >
                <p className="text-lg sm:text-xl font-semibold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                  {emptyStateTitle ||
                    `По запросу «${highlightQuery?.trim() ?? ''}» ничего не найдено`}
                </p>
                <p className="text-sm sm:text-base text-[#111111]/66 dark:text-[#F4F3EF]/66 max-w-xl">
                  {emptyStateHint ||
                    'Попробуйте другое ключевое слово (например: «счёт», «договор», «1 час», «РАО») или сбросьте фильтр.'}
                </p>
                {onResetSearch && (
                  <button
                    type="button"
                    data-testid="faq-search-empty-reset"
                    onClick={onResetSearch}
                    className="min-h-11 px-5 py-2.5 rounded-full border border-[#111111]/18 dark:border-white/18 hover:border-[#FF4820] hover:text-[#FF4820] text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] transition-colors cursor-pointer"
                  >
                    Показать все вопросы
                  </button>
                )}
              </div>
            ) : (
              faqItems.map((item) => {
                const isOpen = openId === item.id;
                const buttonId = `${sectionId}-trigger-${item.id}`;
                const panelId = `${sectionId}-panel-${item.id}`;
                const iconKey = resolveFaqIconKey(item);
                const QuestionIcon = FAQ_ICON_MAP[iconKey];

                return (
                  <article
                    key={item.id}
                    data-testid={`faq-item-${item.id}`}
                  >
                    <h3>
                      <button
                        id={buttonId}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => setOpenId((prev) => toggleFaqItem(prev, item.id))}
                        className="group w-full py-6 sm:py-7 text-left flex items-center justify-between gap-4 sm:gap-6 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF4820]"
                      >
                        <div className="flex items-start gap-3.5 sm:gap-4 min-w-0">
                          <span
                            aria-hidden="true"
                            data-faq-icon={iconKey}
                            className={`mt-0.5 w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors duration-200 ${
                              isOpen
                                ? 'border-[#FF4820]/30 bg-[#FF4820]/8 text-[#FF4820] dark:bg-[#FF4820]/14'
                                : 'border-[#111111]/10 dark:border-white/12 bg-[#111111]/[0.02] dark:bg-white/[0.02] text-[#111111]/52 dark:text-[#F4F3EF]/52 group-hover:border-[#FF4820]/30 group-hover:text-[#FF4820]'
                            }`}
                          >
                            <QuestionIcon className="w-4 h-4" strokeWidth={1.75} />
                          </span>

                          <div className="flex items-baseline gap-3 sm:gap-4 min-w-0 pt-1">
                            <span
                              className={`text-xs sm:text-sm font-semibold tabular-nums shrink-0 transition-colors duration-200 ${
                                isOpen
                                  ? 'text-[#FF4820]'
                                  : 'text-[#111111]/38 dark:text-[#F4F3EF]/38 group-hover:text-[#FF4820]'
                              }`}
                            >
                              {item.indexLabel}
                            </span>
                            <span
                              className={`text-lg sm:text-xl lg:text-[1.32rem] font-semibold tracking-tight leading-[1.3] editorial-balance transition-colors duration-200 ${
                                isOpen
                                  ? 'text-[#111111] dark:text-[#F4F3EF]'
                                  : 'text-[#111111]/88 dark:text-[#F4F3EF]/88 group-hover:text-[#FF4820] dark:group-hover:text-[#FF4820]'
                              }`}
                            >
                              <FaqHighlightedText
                                text={item.question}
                                query={highlightQuery}
                              />
                            </span>
                          </div>
                        </div>

                        <span
                          aria-hidden="true"
                          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${
                            isOpen
                              ? 'text-[#FF4820] bg-[#FF4820]/8 dark:bg-[#FF4820]/14'
                              : 'text-[#111111]/60 dark:text-[#F4F3EF]/60 group-hover:text-[#FF4820] group-hover:bg-[#111111]/4 dark:group-hover:bg-white/6'
                          }`}
                        >
                          <Plus
                            className={`w-4 h-4 transition-transform duration-200 ${
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
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="pl-[3.125rem] sm:pl-[3.25rem] pr-4 sm:pr-12 pb-6 sm:pb-7">
                            <p className="text-sm sm:text-base leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72 max-w-2xl editorial-pretty">
                              <FaqHighlightedText
                                text={item.answer}
                                query={highlightQuery}
                              />
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
