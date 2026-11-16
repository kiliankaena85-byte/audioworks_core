import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createDefaultStudioLegalProfiles,
  resolveActiveStudioProfile,
  resolveSecondaryStudioProfile,
  sanitizePrivacyPolicySettings,
  sanitizePublicContactsConfig,
  sanitizeStudioLegalProfilesConfig,
  type StudioLegalProfile,
  type StudioLegalProfilesConfig,
  type StudioPrivacyPolicySettings,
  type StudioPublicContactsConfig,
} from '../data/studioDocumentsCore';
import {
  buildOperatorPassportSummary,
  formatOperatorInlineRequisites,
  type OperatorPassportView,
} from '../security/legalDocumentBuilder';

export const LEGAL_PROFILES_UPDATED_EVENT = 'fmworks:legal-profiles-updated';

export function dispatchLegalProfilesUpdatedEvent(
  nextProfiles: StudioLegalProfilesConfig
): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent<StudioLegalProfilesConfig>(LEGAL_PROFILES_UPDATED_EVENT, {
        detail: nextProfiles,
      })
    );
  } catch {
    // Ignore in headless non-CustomEvent environments
  }
}

export interface StudioLegalConfigContextValue {
  legalProfiles: StudioLegalProfilesConfig;
  activeProfile: StudioLegalProfile;
  secondaryProfile: StudioLegalProfile | null;
  privacySettings: StudioPrivacyPolicySettings;
  publicContacts: StudioPublicContactsConfig;
  operatorPassport: OperatorPassportView;
  inlineRequisites: string;
  isLoadedFromServer: boolean;
  refreshLegalConfig: () => Promise<void>;
  applyLegalProfilesOptimistically: (
    next: Partial<StudioLegalProfilesConfig>
  ) => void;
}

const StudioLegalConfigContext = createContext<StudioLegalConfigContextValue | null>(
  null
);

export function StudioLegalConfigProvider({ children }: { children: ReactNode }) {
  const [legalProfiles, setLegalProfiles] = useState<StudioLegalProfilesConfig>(() =>
    createDefaultStudioLegalProfiles()
  );
  const [isLoadedFromServer, setIsLoadedFromServer] = useState<boolean>(false);

  const refreshLegalConfig = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/public/legal-profile', {
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        legalProfiles?: Partial<StudioLegalProfilesConfig>;
      };
      if (data?.ok && data.legalProfiles) {
        setLegalProfiles(sanitizeStudioLegalProfilesConfig(data.legalProfiles));
        setIsLoadedFromServer(true);
      }
    } catch {
      // Fallback to sanitized defaults if offline
    }
  }, []);

  const applyLegalProfilesOptimistically = useCallback(
    (next: Partial<StudioLegalProfilesConfig>) => {
      const sanitized = sanitizeStudioLegalProfilesConfig(next);
      setLegalProfiles(sanitized);
      setIsLoadedFromServer(true);
      dispatchLegalProfilesUpdatedEvent(sanitized);
    },
    []
  );

  useEffect(() => {
    void refreshLegalConfig();
  }, [refreshLegalConfig]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onProfilesUpdated = (event: Event) => {
      const custom = event as CustomEvent<Partial<StudioLegalProfilesConfig>>;
      if (custom.detail) {
        setLegalProfiles(sanitizeStudioLegalProfilesConfig(custom.detail));
        setIsLoadedFromServer(true);
      } else {
        void refreshLegalConfig();
      }
    };
    window.addEventListener(LEGAL_PROFILES_UPDATED_EVENT, onProfilesUpdated);
    return () => {
      window.removeEventListener(LEGAL_PROFILES_UPDATED_EVENT, onProfilesUpdated);
    };
  }, [refreshLegalConfig]);

  const value = useMemo<StudioLegalConfigContextValue>(() => {
    const activeProfile = resolveActiveStudioProfile(legalProfiles);
    const secondaryProfile = resolveSecondaryStudioProfile(legalProfiles);
    const privacySettings = sanitizePrivacyPolicySettings(
      legalProfiles.privacyPolicy,
      activeProfile.email
    );
    const publicContacts = sanitizePublicContactsConfig(
      legalProfiles.publicContacts,
      activeProfile.phone,
      activeProfile.email
    );
    const operatorPassport = buildOperatorPassportSummary(legalProfiles);
    const inlineRequisites = formatOperatorInlineRequisites(legalProfiles);
    return {
      legalProfiles,
      activeProfile,
      secondaryProfile,
      privacySettings,
      publicContacts,
      operatorPassport,
      inlineRequisites,
      isLoadedFromServer,
      refreshLegalConfig,
      applyLegalProfilesOptimistically,
    };
  }, [
    applyLegalProfilesOptimistically,
    isLoadedFromServer,
    legalProfiles,
    refreshLegalConfig,
  ]);

  return (
    <StudioLegalConfigContext.Provider value={value}>
      {children}
    </StudioLegalConfigContext.Provider>
  );
}

/**
 * Возвращает актуальные реквизиты компании (ООО / ИП) и настройки 152-ФЗ из серверного хранилища.
 * Безопасен и вне провайдера (в изолированных тестах возвращает валидный дефолт ООО).
 */
export function useStudioLegalConfig(): StudioLegalConfigContextValue {
  const ctx = useContext(StudioLegalConfigContext);
  const fallback = useMemo<StudioLegalConfigContextValue>(() => {
    const defaults = createDefaultStudioLegalProfiles();
    const activeProfile = resolveActiveStudioProfile(defaults);
    return {
      legalProfiles: defaults,
      activeProfile,
      secondaryProfile: resolveSecondaryStudioProfile(defaults),
      privacySettings: sanitizePrivacyPolicySettings(
        defaults.privacyPolicy,
        activeProfile.email
      ),
      publicContacts: sanitizePublicContactsConfig(
        defaults.publicContacts,
        activeProfile.phone,
        activeProfile.email
      ),
      operatorPassport: buildOperatorPassportSummary(defaults),
      inlineRequisites: formatOperatorInlineRequisites(defaults),
      isLoadedFromServer: false,
      refreshLegalConfig: async () => {},
      applyLegalProfilesOptimistically: () => {},
    };
  }, []);
  return ctx ?? fallback;
}
