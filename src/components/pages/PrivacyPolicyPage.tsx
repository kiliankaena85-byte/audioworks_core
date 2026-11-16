import { ArrowLeft, Check, Copy, Printer } from 'lucide-react';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useStudioLegalConfig } from '../../context/StudioLegalConfigContext';
import type { LegalPageSectionTab, PlatformRoute } from '../../data/platformRouter';
import { LegalPolicyDocumentContent } from '../legal/LegalPolicyDocumentContent';

export interface PrivacyPolicyPageProps {
  initialTab?: LegalPageSectionTab;
  onNavigate: (route: PlatformRoute, options?: { replace?: boolean }) => void;
}

const LEGAL_SECTION_TABS: readonly {
  id: LegalPageSectionTab;
  label: string;
}[] = [
  { id: 'policy', label: 'Политика обработки ПДн (ст. 18.1)' },
  { id: 'consent', label: 'Текст согласия субъекта (ст. 9)' },
  { id: 'rf_security', label: 'Локализация и cookie в РФ' },
] as const;

export function PrivacyPolicyPage({
  initialTab = 'policy',
  onNavigate,
}: PrivacyPolicyPageProps) {
  const { operatorPassport } = useStudioLegalConfig();
  const [activeTab, setActiveTab] = useState<LegalPageSectionTab>(initialTab);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const selectSectionTab = (tab: LegalPageSectionTab) => {
    setActiveTab(tab);
    onNavigate({ kind: 'privacy', ...(tab !== 'policy' ? { tab } : {}) }, { replace: true });
  };

  const handleTabKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    currentIdx: number
  ) => {
    let nextIdx = -1;
    if (e.key === 'ArrowRight') {
      nextIdx = (currentIdx + 1) % LEGAL_SECTION_TABS.length;
    } else if (e.key === 'ArrowLeft') {
      nextIdx =
        (currentIdx - 1 + LEGAL_SECTION_TABS.length) % LEGAL_SECTION_TABS.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = LEGAL_SECTION_TABS.length - 1;
    }
    if (nextIdx >= 0) {
      e.preventDefault();
      const target = LEGAL_SECTION_TABS[nextIdx];
      selectSectionTab(target.id);
      tabRefs.current[target.id]?.focus();
    }
  };

  const handleCopyLink = async () => {
    if (typeof window === 'undefined') return;
    const directUrl = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(directUrl);
      }
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2200);
    } catch {
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2200);
    }
  };

  return (
    <section
      data-testid="privacy-policy-page"
      aria-labelledby="privacy-page-heading"
      className="py-8 sm:py-12 lg:py-16"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 space-y-7">
        {/* Шапка постоянной публичной страницы по ч. 2 ст. 18.1 152-ФЗ */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-[#111111]/10 dark:border-white/10">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-[#111111]/70 dark:text-[#F4F3EF]/70 tabular-nums">
              <button
                type="button"
                onClick={() => onNavigate({ kind: 'home' })}
                className="min-h-[36px] inline-flex items-center gap-1.5 text-xs font-semibold text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
              >
                <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>На главную</span>
              </button>
              <span aria-hidden="true">·</span>
              <span>Публичный документ ч. 2 ст. 18.1 152-ФЗ</span>
              <span aria-hidden="true">·</span>
              <span>Редакция от {operatorPassport.policyVersionDate}</span>
            </div>

            <h1
              id="privacy-page-heading"
              className="text-2xl sm:text-4xl font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
            >
              Политика в отношении обработки и защиты персональных данных
            </h1>

            <p className="text-sm sm:text-base text-[#111111]/76 dark:text-[#F4F3EF]/76 leading-relaxed max-w-3xl">
              Постоянный открытый документ Оператора ({operatorPassport.operatorTitle}) с перечнем целей обработки, правовых оснований, сроков хранения и регламентом использования технических файлов cookie на территории РФ.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
            <button
              type="button"
              data-testid="privacy-copy-url-btn"
              onClick={() => void handleCopyLink()}
              className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 bg-white dark:bg-[#141418] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
            >
              {copiedUrl ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#15803D] dark:text-[#4ADE80]" aria-hidden="true" />
                  <span>Ссылка скопирована</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Скопировать ссылку</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="privacy-print-btn"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.print();
                }
              }}
              className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 bg-white dark:bg-[#141418] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Печать документа</span>
            </button>
          </div>
        </div>

        {/* Вкладки разделов */}
        <div
          role="tablist"
          aria-label="Разделы Политики и Согласия 152-ФЗ"
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 p-1.5 rounded-2xl bg-[#EFECE5] dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 print:hidden"
        >
          {LEGAL_SECTION_TABS.map((tab, idx) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                id={`privacy-page-tab-${tab.id}`}
                type="button"
                role="tab"
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected}
                aria-controls="privacy-page-tabpanel"
                data-testid={`privacy-page-tab-${tab.id}`}
                onClick={() => selectSectionTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`flex-1 min-h-[44px] sm:min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer text-center whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                  isSelected
                    ? 'bg-white dark:bg-[#22222A] text-[#111111] dark:text-[#F4F3EF] shadow-xs'
                    : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Основной корпус документа */}
        <div
          id="privacy-page-tabpanel"
          role="tabpanel"
          aria-labelledby={`privacy-page-tab-${activeTab}`}
          className="rounded-3xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-5 sm:p-8 lg:p-10"
        >
          <div key={activeTab} className="fmworks-panel-enter">
            <LegalPolicyDocumentContent activeTab={activeTab} />
          </div>
        </div>
      </div>
    </section>
  );
}
