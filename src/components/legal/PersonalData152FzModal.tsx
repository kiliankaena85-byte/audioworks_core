import { CheckCircle2, ExternalLink, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrandLogo } from '../BrandLogo';
import {
  LegalPolicyDocumentContent,
  type LegalPolicyTabId,
} from './LegalPolicyDocumentContent';

export type PersonalData152FzTab = LegalPolicyTabId;

interface PersonalData152FzModalProps {
  isOpen: boolean;
  initialTab?: PersonalData152FzTab;
  onClose: () => void;
  onAcceptConsent?: () => void;
}

export function PersonalData152FzModal({
  isOpen,
  initialTab = 'policy',
  onClose,
  onAcceptConsent,
}: PersonalData152FzModalProps) {
  const [activeTab, setActiveTab] = useState<PersonalData152FzTab>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const standaloneHref =
    activeTab === 'policy' ? '/privacy' : `/privacy?tab=${activeTab}`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdn-152fz-modal-title"
      data-testid="pdn-152fz-modal"
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-3xl max-h-[92dvh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-3xl bg-[#F7F6F2] dark:bg-[#141418] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/14 dark:border-white/14 flex flex-col overflow-hidden shadow-2xl min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка документа */}
        <div className="px-4 sm:px-6 py-4 border-b border-[#111111]/10 dark:border-white/10 flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#111111]/64 dark:text-[#F4F3EF]/64">
              <BrandLogo variant="fmworks_reg" size="sm" />
              <span aria-hidden="true">·</span>
              <span>152-ФЗ «О персональных данных» · Законы РФ</span>
            </div>
            <h2
              id="pdn-152fz-modal-title"
              className="text-base sm:text-xl font-bold tracking-tight leading-snug"
            >
              Политика обработки и защиты персональных данных (152-ФЗ)
            </h2>
          </div>

          <button
            type="button"
            aria-label="Закрыть документ о персональных данных"
            data-testid="pdn-152fz-close-btn"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-[#111111]/12 dark:border-white/12 inline-flex items-center justify-center text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:text-[#111111] dark:hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Переключатель разделов */}
        <div
          role="tablist"
          aria-label="Разделы правовой информации 152-ФЗ"
          className="px-4 sm:px-6 pt-3 pb-2 border-b border-[#111111]/8 dark:border-white/8 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'policy'}
            data-testid="pdn-tab-policy"
            onClick={() => setActiveTab('policy')}
            className={`min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center whitespace-nowrap ${
              activeTab === 'policy'
                ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                : 'bg-[#EFECE5] dark:bg-[#1C1C22] text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            Политика обработки ПДн (ст. 18.1)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'consent'}
            data-testid="pdn-tab-consent"
            onClick={() => setActiveTab('consent')}
            className={`min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center whitespace-nowrap ${
              activeTab === 'consent'
                ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                : 'bg-[#EFECE5] dark:bg-[#1C1C22] text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            Текст согласия субъекта (ст. 9)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'rf_security'}
            data-testid="pdn-tab-rf-security"
            onClick={() => setActiveTab('rf_security')}
            className={`min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center whitespace-nowrap ${
              activeTab === 'rf_security'
                ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                : 'bg-[#EFECE5] dark:bg-[#1C1C22] text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            Локализация и cookie в РФ
          </button>
        </div>

        {/* Содержимое документа */}
        <div className="px-4 sm:px-6 py-5 overflow-y-auto flex-1">
          <LegalPolicyDocumentContent activeTab={activeTab} />
        </div>

        {/* Нижняя панель действий */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-[#111111]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#111111]/68 dark:text-[#F4F3EF]/68">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#C83210] dark:text-[#FF6B47] shrink-0" aria-hidden="true" />
              <span>Локализация в РФ · 152-ФЗ</span>
            </span>
            <span aria-hidden="true">·</span>
            <a
              href={standaloneHref}
              data-testid="pdn-modal-standalone-link"
              className="inline-flex items-center gap-1 font-semibold text-[#111111] dark:text-[#F4F3EF] hover:text-[#C83210] dark:hover:text-[#FF6B47] underline underline-offset-3 transition-colors whitespace-nowrap"
            >
              <span>Постоянная страница /privacy</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </a>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            {onAcceptConsent && (
              <button
                type="button"
                data-testid="pdn-152fz-accept-btn"
                onClick={() => {
                  onAcceptConsent();
                  onClose();
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#C83210] hover:bg-[#AE2A0C] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Подтвердить согласие и вернуться</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 text-xs sm:text-sm font-semibold inline-flex items-center justify-center transition-colors cursor-pointer text-center whitespace-nowrap"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
