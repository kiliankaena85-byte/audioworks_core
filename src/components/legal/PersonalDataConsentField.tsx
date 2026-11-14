import { AlertCircle } from 'lucide-react';
import { RefObject, useState } from 'react';
import {
  PersonalData152FzModal,
  PersonalData152FzTab,
} from './PersonalData152FzModal';

interface PersonalDataConsentFieldProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  compact?: boolean;
  testIdPrefix?: string;
}

export function PersonalDataConsentField({
  id,
  checked,
  onChange,
  error,
  inputRef,
  compact = false,
  testIdPrefix = 'pdn-consent',
}: PersonalDataConsentFieldProps) {
  const [modalState, setModalState] = useState<{
    open: boolean;
    tab: PersonalData152FzTab;
  }>({ open: false, tab: 'policy' });

  const openModalTab = (tab: PersonalData152FzTab) => {
    setModalState({ open: true, tab });
  };

  return (
    <div className="space-y-1.5 min-w-0">
      <div
        className={`rounded-2xl border transition-colors ${
          compact ? 'px-3 sm:px-3.5 py-2.5' : 'px-3 sm:px-4 py-2.5 sm:py-3'
        } ${
          error
            ? 'bg-[#DC2626]/[0.05] border-[#DC2626]'
            : 'bg-[#F7F6F2]/80 dark:bg-[#111115] border-[#111111]/12 dark:border-white/12'
        }`}
      >
        <div className="flex items-start gap-2.5 sm:gap-3 min-h-[36px] min-w-0">
          <input
            ref={inputRef}
            id={id}
            type="checkbox"
            checked={checked}
            aria-invalid={Boolean(error)}
            aria-labelledby={`${id}-caption`}
            data-testid={`${testIdPrefix}-checkbox`}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded border-[#111111]/30 dark:border-white/30 accent-[#FF4820] cursor-pointer shrink-0"
          />

          <p
            id={`${id}-caption`}
            className="flex-1 min-w-0 text-xs leading-[1.5] text-[#111111]/78 dark:text-[#F4F3EF]/78"
          >
            <label htmlFor={id} className="inline cursor-pointer select-none">
              Даю{' '}
            </label>
            <a
              href="#pdn-consent"
              role="button"
              aria-haspopup="dialog"
              data-testid={`${testIdPrefix}-open-consent-btn`}
              onClick={(e) => {
                e.preventDefault();
                openModalTab('consent');
              }}
              onKeyDown={(e) => {
                if (e.key === ' ') {
                  e.preventDefault();
                  openModalTab('consent');
                }
              }}
              className="inline underline decoration-[#111111]/35 dark:decoration-white/35 underline-offset-[3px] font-semibold text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer"
            >
              согласие на обработку персональных данных
            </a>
            <label htmlFor={id} className="inline cursor-pointer select-none">
              {' '}согласно{' '}
            </label>
            <a
              href="#pdn-policy"
              role="button"
              aria-haspopup="dialog"
              data-testid={`${testIdPrefix}-open-policy-btn`}
              onClick={(e) => {
                e.preventDefault();
                openModalTab('policy');
              }}
              onKeyDown={(e) => {
                if (e.key === ' ') {
                  e.preventDefault();
                  openModalTab('policy');
                }
              }}
              className="inline underline decoration-[#111111]/35 dark:decoration-white/35 underline-offset-[3px] font-semibold text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer"
            >
              Политике обработки ПДн (152-ФЗ)
            </a>
            <label htmlFor={id} className="inline cursor-pointer select-none">
              {' '}для связи продюсера и подготовки документов по заказу.
            </label>
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          data-testid={`${testIdPrefix}-error`}
          className="text-xs font-semibold text-[#DC2626] dark:text-[#F87171] flex items-start gap-1.5"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      <PersonalData152FzModal
        isOpen={modalState.open}
        initialTab={modalState.tab}
        onClose={() => setModalState((prev) => ({ ...prev, open: false }))}
        onAcceptConsent={() => onChange(true)}
      />
    </div>
  );
}
