import { ShieldCheck } from 'lucide-react';
import { MouseEvent, Suspense, useEffect, useState } from 'react';
import { useStudioLegalConfig } from '../../context/StudioLegalConfigContext';
import type { PlatformRoute } from '../../data/platformRouter';
import { RF_STORAGE_NOTICE_STORAGE_KEY } from '../../security/rfLegalCompliance';
import { lazyNamedExport } from '../../utils/lazyWithRetry';
import type { PersonalData152FzTab } from './PersonalData152FzModal';

const PersonalData152FzModal = lazyNamedExport(
  () => import('./PersonalData152FzModal'),
  'PersonalData152FzModal'
);

interface RfStorageNoticeBannerProps {
  liftForFloatingPlayer?: boolean;
  onNavigate?: (route: PlatformRoute) => void;
}

function readStoredBannerAccepted(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return Boolean(window.localStorage.getItem(RF_STORAGE_NOTICE_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function RfStorageNoticeBanner({
  liftForFloatingPlayer = false,
  onNavigate,
}: RfStorageNoticeBannerProps) {
  const { privacySettings } = useStudioLegalConfig();
  const [dismissed, setDismissed] = useState<boolean>(() => readStoredBannerAccepted());
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<PersonalData152FzTab>('rf_security');

  useEffect(() => {
    setDismissed(readStoredBannerAccepted());
  }, []);

  const handleAcceptNotice = () => {
    try {
      window.localStorage.setItem(
        RF_STORAGE_NOTICE_STORAGE_KEY,
        new Date().toISOString()
      );
    } catch {
      // Ignore storage quota errors in private mode
    }
    setDismissed(true);
  };

  const handleOpenPolicyClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    if (onNavigate) {
      onNavigate({ kind: 'privacy', tab: 'rf_security' });
      return;
    }
    setModalTab('rf_security');
    setModalOpen(true);
  };

  if (!privacySettings.cookieBannerEnabled && !modalOpen) {
    return null;
  }

  if (dismissed && !modalOpen) {
    return null;
  }

  return (
    <>
      {!dismissed && privacySettings.cookieBannerEnabled && (
        <aside
          data-nosnippet
          aria-label="Уведомление о технических файлах cookie и локальном хранении по 152-ФЗ"
          data-testid="rf-storage-notice-banner"
          className={`fixed inset-x-2.5 sm:inset-x-auto sm:right-6 sm:max-w-lg z-40 rounded-xl sm:rounded-2xl bg-[#FFFFFF]/96 dark:bg-[#141418]/96 backdrop-blur-md border border-[#111111]/14 dark:border-white/14 shadow-lg px-3 py-1.5 sm:px-3.5 sm:py-2.5 transition-opacity print:hidden ${
            liftForFloatingPlayer ? 'bottom-24 sm:bottom-24' : 'bottom-2.5 sm:bottom-4'
          }`}
        >
          <div className="flex items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck
                className="w-4 h-4 text-[#C83210] dark:text-[#FF6B47] shrink-0 hidden sm:block"
                aria-hidden="true"
              />
              <p className="text-[11px] sm:text-xs leading-tight sm:leading-snug text-[#111111]/84 dark:text-[#F4F3EF]/84">
                <strong>Технические cookie (152-ФЗ):</strong>{' '}
                <span className="sm:hidden">сессия в РФ без трекеров.</span>
                <span className="hidden sm:inline">
                  только для сессии кабинета и черновика в РФ без трекеров.
                </span>{' '}
                <a
                  href="/privacy?tab=rf_security"
                  data-testid="rf-banner-details-btn"
                  onClick={handleOpenPolicyClick}
                  className="font-semibold underline underline-offset-2 text-[#111111] dark:text-[#F4F3EF] hover:text-[#C83210] dark:hover:text-[#FF6B47] whitespace-nowrap"
                >
                  Политика
                </a>
              </p>
            </div>

            <button
              type="button"
              data-testid="rf-banner-accept-btn"
              onClick={handleAcceptNotice}
              className="min-h-[32px] sm:min-h-[36px] px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-[#111111] hover:bg-[#27272A] dark:bg-[#F4F3EF] dark:hover:bg-white text-white dark:text-[#0D0D0F] text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Понятно
            </button>
          </div>
        </aside>
      )}

      {modalOpen && (
        <Suspense fallback={null}>
          <PersonalData152FzModal
            isOpen={modalOpen}
            initialTab={modalTab}
            onClose={() => setModalOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}
