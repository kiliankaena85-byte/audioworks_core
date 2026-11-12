import { ArrowUpRight, RotateCcw, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSiteTextBlocks } from '../../cms/SiteTextBlocksContext';
import { EDITORIAL_PRICING_ROWS } from '../../data/pricingData';
import {
  filterSiteTextBlocks,
  isSiteTextBlockModified,
  SITE_TEXT_SECTION_TABS,
  SiteTextBlock,
  SiteTextSectionId,
} from '../../data/siteTextBlocksData';

interface AdminTextBlocksPanelProps {
  onNavigateHome: () => void;
}

export function AdminTextBlocksPanel({
  onNavigateHome,
}: AdminTextBlocksPanelProps) {
  const {
    blocks,
    modifiedCount,
    lastEditedBlockId,
    getBlock,
    updateBlock,
    resetBlock,
    resetAllBlocks,
  } = useSiteTextBlocks();

  const [sectionFilter, setSectionFilter] = useState<'all' | SiteTextSectionId>(
    'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [previewSection, setPreviewSection] =
    useState<SiteTextSectionId>('hero');

  // Автоматически переключаем живое превью на секцию редактируемого блока
  useEffect(() => {
    if (!lastEditedBlockId) return;
    const edited = blocks.find((b) => b.id === lastEditedBlockId);
    if (edited) {
      setPreviewSection(edited.section);
    }
  }, [lastEditedBlockId, blocks]);

  const filteredBlocks = useMemo(
    () => filterSiteTextBlocks(blocks, sectionFilter, searchQuery),
    [blocks, sectionFilter, searchQuery]
  );

  const countBySection = useMemo(() => {
    return {
      all: blocks.length,
      hero: blocks.filter((b) => b.section === 'hero').length,
      approach: blocks.filter((b) => b.section === 'approach').length,
      pricing: blocks.filter((b) => b.section === 'pricing').length,
    };
  }, [blocks]);

  const handleSelectFilter = (next: 'all' | SiteTextSectionId) => {
    setSectionFilter(next);
    if (next !== 'all') {
      setPreviewSection(next);
    }
  };

  const heroStage = getBlock('hero-stage');
  const heroManifesto = getBlock('hero-manifesto');
  const approachLead = getBlock('approach-lead');
  const approachPillars: SiteTextBlock[] = [
    getBlock('approach-pillar-01'),
    getBlock('approach-pillar-02'),
    getBlock('approach-pillar-03'),
  ];
  const pricingHeader = getBlock('pricing-header');
  const pricingTiers = [
    { block: getBlock('pricing-tier-voice'), meta: EDITORIAL_PRICING_ROWS[0] },
    {
      block: getBlock('pricing-tier-turnkey'),
      meta: EDITORIAL_PRICING_ROWS[1],
    },
    { block: getBlock('pricing-tier-cinema'), meta: EDITORIAL_PRICING_ROWS[2] },
  ];

  return (
    <div className="space-y-6">
      {/* Filter & Search Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Фильтр текстовых блоков по секциям"
          className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10"
        >
          {SITE_TEXT_SECTION_TABS.map((tab) => {
            const isSelected = sectionFilter === tab.id;
            const count = countBySection[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                data-testid={`text-filter-${tab.id}`}
                onClick={() => handleSelectFilter(tab.id)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                  isSelected
                    ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                    : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={
                    isSelected
                      ? 'text-white/65 dark:text-[#0D0D0F]/65'
                      : 'text-[#111111]/42 dark:text-[#F4F3EF]/42'
                  }
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72 shrink-0">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#111111]/45 dark:text-[#F4F3EF]/45"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Поиск по текстовым блокам"
            placeholder="Поиск по заголовкам и тексту…"
            className="w-full min-h-[40px] pl-9 pr-9 py-2 rounded-xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 text-xs text-[#111111] dark:text-[#F4F3EF] placeholder:text-[#111111]/40 dark:placeholder:text-[#F4F3EF]/40 focus:outline-none focus:border-[#FF4820]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Очистить строку поиска"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md inline-flex items-center justify-center text-[#111111]/50 dark:text-[#F4F3EF]/50 hover:text-[#111111] dark:hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Split: Real-Time Editors (Left) + Live Section Mirror (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Editable Static Content Array */}
        <div className="xl:col-span-7 rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-[#111111]/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                Ключевые текстовые блоки (Hero, Approach, Pricing)
              </h2>
              <p className="text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56 tabular-nums">
                Все изменения применяются мгновенно в памяти текущей сессии · показано {filteredBlocks.length} из {blocks.length}
              </p>
            </div>

            {modifiedCount > 0 && (
              <button
                type="button"
                data-testid="reset-all-text-blocks-btn"
                onClick={resetAllBlocks}
                className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:text-[#111111] dark:hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="tabular-nums">
                  Сбросить все ({modifiedCount})
                </span>
              </button>
            )}
          </div>

          {filteredBlocks.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
                По запросу «{searchQuery}» текстовых блоков не найдено
              </p>
              <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
                Попробуйте изменить поисковый запрос или переключить фильтр секции.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSectionFilter('all');
                }}
                className="min-h-[38px] px-4 py-2 rounded-xl bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                Показать все блоки
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#111111]/10 dark:divide-white/10">
              {filteredBlocks.map((block) => {
                const modified = isSiteTextBlockModified(block);
                const hasEyebrow = block.eyebrow !== undefined;
                const hasSubtitle = block.subtitle !== undefined;

                return (
                  <article
                    key={block.id}
                    data-testid={`editor-block-${block.id}`}
                    onFocusCapture={() => setPreviewSection(block.section)}
                    className="p-6 space-y-4 transition-colors hover:bg-[#F7F6F2]/45 dark:hover:bg-white/[0.015]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-[#FF4820]">
                          {block.sectionLabel}
                        </span>
                        <span
                          aria-hidden="true"
                          className="text-[#111111]/35 dark:text-[#F4F3EF]/35"
                        >
                          ·
                        </span>
                        <span className="font-medium text-[#111111]/68 dark:text-[#F4F3EF]/68">
                          {block.blockLabel}
                        </span>
                        {modified && (
                          <>
                            <span
                              aria-hidden="true"
                              className="text-[#111111]/35 dark:text-[#F4F3EF]/35"
                            >
                              ·
                            </span>
                            <span
                              data-testid={`modified-flag-${block.id}`}
                              className="font-semibold text-[#D97706] dark:text-[#FBBF24]"
                            >
                              Изменено в сессии
                            </span>
                          </>
                        )}
                      </div>

                      {modified && (
                        <button
                          type="button"
                          onClick={() => resetBlock(block.id)}
                          aria-label={`Вернуть эталон для блока «${block.blockLabel}»`}
                          className="min-h-[32px] px-2.5 py-1 rounded-lg border border-[#111111]/12 dark:border-white/12 hover:border-[#FF4820] text-xs font-medium text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#111111] dark:hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <RotateCcw
                            className="w-3 h-3 shrink-0"
                            aria-hidden="true"
                          />
                          <span>Вернуть эталон</span>
                        </button>
                      )}
                    </div>

                    {hasEyebrow && (
                      <div className="space-y-1.5">
                        <label
                          htmlFor={`input-eyebrow-${block.id}`}
                          className="block text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72"
                        >
                          Надзаголовок / индекс
                        </label>
                        <input
                          id={`input-eyebrow-${block.id}`}
                          type="text"
                          value={block.eyebrow ?? ''}
                          onChange={(e) =>
                            updateBlock(block.id, { eyebrow: e.target.value })
                          }
                          className="w-full min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-xs font-medium text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                        />
                      </div>
                    )}

                    <div
                      className={
                        hasSubtitle
                          ? 'grid grid-cols-1 sm:grid-cols-2 gap-3.5'
                          : 'space-y-1.5'
                      }
                    >
                      <div className="space-y-1.5">
                        <label
                          htmlFor={`input-title-${block.id}`}
                          className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                        >
                          Заголовок
                        </label>
                        <input
                          id={`input-title-${block.id}`}
                          data-testid={`input-title-${block.id}`}
                          type="text"
                          value={block.title}
                          onChange={(e) =>
                            updateBlock(block.id, { title: e.target.value })
                          }
                          className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm font-semibold text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                        />
                      </div>

                      {hasSubtitle && (
                        <div className="space-y-1.5">
                          <label
                            htmlFor={`input-subtitle-${block.id}`}
                            className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                          >
                            Вторая строка заголовка (полутон)
                          </label>
                          <input
                            id={`input-subtitle-${block.id}`}
                            data-testid={`input-subtitle-${block.id}`}
                            type="text"
                            value={block.subtitle ?? ''}
                            onChange={(e) =>
                              updateBlock(block.id, {
                                subtitle: e.target.value,
                              })
                            }
                            className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor={`input-desc-${block.id}`}
                        className="block text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75"
                      >
                        Описание
                      </label>
                      <textarea
                        id={`input-desc-${block.id}`}
                        data-testid={`input-desc-${block.id}`}
                        rows={block.description.length > 120 ? 3 : 2}
                        value={block.description}
                        onChange={(e) =>
                          updateBlock(block.id, { description: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/14 dark:border-white/14 text-sm leading-relaxed text-[#111111] dark:text-[#F4F3EF] focus:outline-none focus:border-[#FF4820]"
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Live Real-Time Preview Mirror */}
        <aside
          aria-label="Живое превью секций сайта"
          data-testid="admin-live-section-preview"
          className="xl:col-span-5 xl:sticky xl:top-24 rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-[#111111]/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                Живое превью секции
              </h3>
              <p className="text-xs text-[#111111]/55 dark:text-[#F4F3EF]/55">
                Синхронный рендер витрины по мере ввода
              </p>
            </div>

            <button
              type="button"
              onClick={onNavigateHome}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-[#F7F6F2] dark:bg-[#1E1E24] hover:bg-[#FF4820] hover:text-white text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Смотреть на сайте</span>
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </button>
          </div>

          {/* Preview Section Switcher */}
          <div
            role="tablist"
            aria-label="Переключение секции в живом превью"
            className="px-5 py-2.5 border-b border-[#111111]/10 dark:border-white/10 flex items-center gap-2 bg-[#F7F6F2]/60 dark:bg-[#0D0D0F]/50"
          >
            {(
              [
                { id: 'hero', label: 'Hero' },
                { id: 'approach', label: 'Approach' },
                { id: 'pricing', label: 'Pricing' },
              ] as const
            ).map((tab) => {
              const active = previewSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPreviewSection(tab.id)}
                  className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#FF4820] text-white'
                      : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Live Section Render Surface */}
          <div className="p-6 bg-[#F7F6F2] dark:bg-[#0D0D0F] space-y-6">
            {previewSection === 'hero' && (
              <div
                data-testid="live-preview-hero"
                className="space-y-6"
              >
                <div className="rounded-xl bg-[#111216] text-[#F4F3EF] p-5 space-y-6">
                  <p className="text-xs font-medium text-white/65">
                    {heroStage.description}
                  </p>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-white/68">
                      {heroStage.eyebrow}
                    </p>
                    <h4 className="text-lg font-bold tracking-tight leading-snug text-white">
                      {heroStage.title}
                    </h4>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <h4 className="text-2xl font-bold tracking-tight leading-[1.1] text-[#111111] dark:text-[#F4F3EF]">
                    {heroManifesto.title}{' '}
                    <span className="text-[#111111]/44 dark:text-[#F4F3EF]/44">
                      {heroManifesto.subtitle}
                    </span>
                  </h4>
                  <p className="text-sm leading-relaxed text-[#111111]/75 dark:text-[#F4F3EF]/75">
                    {heroManifesto.description}
                  </p>
                </div>
              </div>
            )}

            {previewSection === 'approach' && (
              <div
                data-testid="live-preview-approach"
                className="space-y-6"
              >
                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-[#111111]/58 dark:text-[#F4F3EF]/58">
                    {approachLead.eyebrow}
                  </p>
                  <h4 className="text-xl font-bold tracking-tight leading-snug text-[#111111] dark:text-[#F4F3EF]">
                    {approachLead.title}
                  </h4>
                  <p className="text-xs leading-relaxed text-[#111111]/72 dark:text-[#F4F3EF]/72">
                    {approachLead.description}
                  </p>
                </div>

                <div className="divide-y divide-[#111111]/12 dark:divide-white/12 border-t border-[#111111]/12 dark:border-white/12">
                  {approachPillars.map((pil, idx) => (
                    <div
                      key={pil.id}
                      className="py-3.5 grid grid-cols-12 gap-3 items-start"
                    >
                      <span className="col-span-2 text-xl font-bold tabular-nums text-[#FF4820] leading-none">
                        {pil.eyebrow ?? String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="col-span-10 space-y-1">
                        <p className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                          {pil.title}
                        </p>
                        <p className="text-xs leading-relaxed text-[#111111]/70 dark:text-[#F4F3EF]/70">
                          {pil.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {previewSection === 'pricing' && (
              <div
                data-testid="live-preview-pricing"
                className="space-y-5"
              >
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
                    {pricingHeader.eyebrow}
                  </p>
                  <h4 className="text-xl font-bold tracking-tight leading-[1.1] text-[#111111] dark:text-[#F4F3EF]">
                    <span className="block">{pricingHeader.title}</span>
                    <span className="block text-[#111111]/42 dark:text-[#F4F3EF]/42">
                      {pricingHeader.subtitle}
                    </span>
                  </h4>
                  <p className="text-xs leading-relaxed text-[#111111]/68 dark:text-[#F4F3EF]/68">
                    {pricingHeader.description}
                  </p>
                </div>

                <div className="divide-y divide-[#111111]/12 dark:divide-white/12 border-y border-[#111111]/12 dark:border-white/12">
                  {pricingTiers.map(({ block, meta }) => (
                    <div key={block.id} className="py-3.5 space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-bold text-[#111111] dark:text-[#F4F3EF]">
                          {block.title}
                        </p>
                        <span className="text-sm font-bold tabular-nums text-[#FF4820] whitespace-nowrap shrink-0">
                          {meta.priceFormatted}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-[#111111]/70 dark:text-[#F4F3EF]/70">
                        {block.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
