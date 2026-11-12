import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import {
  getSiteTextBlockById,
  SiteTextBlock,
  SiteTextBlockEditablePatch,
  SiteTextBlockId,
} from '../data/siteTextBlocksData';
import {
  SiteTextBlocksSessionState,
  siteTextBlocksStore,
} from './siteTextBlocksStore';

export interface SiteTextBlocksContextValue extends SiteTextBlocksSessionState {
  getBlock: (id: SiteTextBlockId) => SiteTextBlock;
  updateBlock: (id: SiteTextBlockId, patch: SiteTextBlockEditablePatch) => void;
  resetBlock: (id: SiteTextBlockId) => void;
  resetAllBlocks: () => void;
}

const SiteTextBlocksContext = createContext<SiteTextBlocksContextValue | null>(
  null
);

export function SiteTextBlocksProvider({ children }: { children: ReactNode }) {
  const [sessionState, setSessionState] = useState<SiteTextBlocksSessionState>(
    () => siteTextBlocksStore.getState()
  );

  useEffect(() => {
    return siteTextBlocksStore.subscribe(setSessionState);
  }, []);

  const value: SiteTextBlocksContextValue = {
    ...sessionState,
    getBlock: (id) => getSiteTextBlockById(sessionState.blocks, id),
    updateBlock: (id, patch) => siteTextBlocksStore.updateBlock(id, patch),
    resetBlock: (id) => siteTextBlocksStore.resetBlock(id),
    resetAllBlocks: () => siteTextBlocksStore.resetAllBlocks(),
  };

  return (
    <SiteTextBlocksContext.Provider value={value}>
      {children}
    </SiteTextBlocksContext.Provider>
  );
}

export function useSiteTextBlocks(): SiteTextBlocksContextValue {
  const ctx = useContext(SiteTextBlocksContext);
  if (!ctx) {
    throw new Error(
      'useSiteTextBlocks must be used within SiteTextBlocksProvider'
    );
  }
  return ctx;
}
