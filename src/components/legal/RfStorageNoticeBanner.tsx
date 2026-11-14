import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RF_STORAGE_NOTICE_STORAGE_KEY } from '../../security/rfLegalCompliance';
import {
  PersonalData152FzModal,
  PersonalData152FzTab,
} from './PersonalData152FzModal';

interface RfStorageNoticeBannerProps {
  liftForFloatingPlayer?: boolean;
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
}: RfStorageNoticeBannerProps) {
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

  if (dismissed && !modalOpen) {
    return null;
  }

  return (
    <>
      {!dismissed && (
        <aside
          aria-label="Уведомление о локальном хранении данных по 152-ФЗ"
          data-testid="rf-storage-notice-banner"
          className={`fixed inset-x-3 sm:inset-x-auto sm:left-6 sm:max-w-xl z-40 rounded-2xl bg-[#FFFFFF]/95 dark:bg-[#141418]/95 backdrop-blur-md border border-[#111111]/14 dark:border-white/14 shadow-xl px-4 py-3.5 transition-all ${
            liftForFloatingPlayer ? 'bottom-24 sm:bottom-24' : 'bottom-3 sm:bottom-5'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <ShieldCheck
                className="w-4 h-4 text-[#FF4820] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="text-[11px] sm:text-xs leading-relaxed text-[#111111]/82 dark:text-[#F4F3EF]/82">
                <strong>152-ФЗ и отказ от Google:</strong> сайт использует только
                технический{' '}
                <code className="px-1 py-0.5 rounded bg-[#111111]/6 dark:bg-white/10">
                  localStorage
                </code>{' '}
                и локальные шрифты в РФ. Google Analytics, Google Fonts и сторонние трекеры
                полностью отключены.
              </p>
            </div>

            <div className="flex flex-col xs:flex-row sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="rf-banner-details-btn"
                onClick={() => {
                  setModalTab('rf_security');
                  setModalOpen(true);
                }}
                className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#111111]/16 dark:border-white/16 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820] transition-colors cursor-pointer text-center"
              >
                Подробнее (152-ФЗ)
              </button>
              <button
                type="button"
                data-testid="rf-banner-accept-btn"
                onClick={handleAcceptNotice}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#111111] hover:bg-[#27272A] dark:bg-[#F4F3EF] dark:hover:bg-white text-white dark:text-[#0D0D0F] text-xs font-semibold transition-colors cursor-pointer text-center"
              >
                Понятно
              </button>
            </div>
          </div>
        </aside>
      )}

      <PersonalData152FzModal
        isOpen={modalOpen}
        initialTab={modalTab}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
