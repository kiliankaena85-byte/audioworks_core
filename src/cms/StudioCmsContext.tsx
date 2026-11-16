import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { StudioCmsSnapshot } from '../data/studioCmsTypes';
import {
  StudioCmsState,
  studioCmsStore,
  UploadedAudioResult,
  UploadedImageResult,
} from './studioCmsStore';

export interface StudioCmsContextValue extends StudioCmsState {
  login: (
    password: string,
    operatorName?: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  updateLocalSnapshot: (
    updater:
      | StudioCmsSnapshot
      | ((prev: StudioCmsSnapshot) => StudioCmsSnapshot)
  ) => StudioCmsSnapshot;
  discardLocalChanges: () => void;
  saveSnapshot: (
    candidate: StudioCmsSnapshot
  ) => Promise<
    | { ok: true; snapshot: StudioCmsSnapshot; warnings: string[] }
    | { ok: false; error: string }
  >;
  resetToDefaults: () => Promise<
    { ok: true; snapshot: StudioCmsSnapshot } | { ok: false; error: string }
  >;
  uploadAudioFile: (
    file: File
  ) => Promise<
    { ok: true; result: UploadedAudioResult } | { ok: false; error: string }
  >;
  uploadImageFile: (
    file: File
  ) => Promise<
    { ok: true; result: UploadedImageResult } | { ok: false; error: string }
  >;
  refreshContent: () => Promise<void>;
}

const StudioCmsContext = createContext<StudioCmsContextValue | null>(null);

export function StudioCmsProvider({ children }: { children: ReactNode }) {
  const [cmsState, setCmsState] = useState<StudioCmsState>(() =>
    studioCmsStore.getState()
  );

  useEffect(() => {
    return studioCmsStore.subscribe(setCmsState);
  }, []);

  const value: StudioCmsContextValue = {
    ...cmsState,
    login: (password, operatorName) =>
      studioCmsStore.login(password, operatorName),
    logout: () => studioCmsStore.logout(),
    updateLocalSnapshot: (updater) => studioCmsStore.updateLocalSnapshot(updater),
    discardLocalChanges: () => studioCmsStore.discardLocalChanges(),
    saveSnapshot: (candidate) => studioCmsStore.saveSnapshot(candidate),
    resetToDefaults: () => studioCmsStore.resetToDefaults(),
    uploadAudioFile: (file) => studioCmsStore.uploadAudioFile(file),
    uploadImageFile: (file) => studioCmsStore.uploadImageFile(file),
    refreshContent: () => studioCmsStore.refreshContent(),
  };

  return (
    <StudioCmsContext.Provider value={value}>
      {children}
    </StudioCmsContext.Provider>
  );
}

export function useStudioCms(): StudioCmsContextValue {
  const ctx = useContext(StudioCmsContext);
  if (!ctx) {
    throw new Error('useStudioCms must be used within StudioCmsProvider');
  }
  return ctx;
}
