import {
  cloneInitialSiteTextBlocks,
  countModifiedSiteTextBlocks,
  getSiteTextBlockById,
  resetSiteTextBlockInList,
  SiteTextBlock,
  SiteTextBlockEditablePatch,
  SiteTextBlockId,
  updateSiteTextBlockInList,
} from '../data/siteTextBlocksData';

export interface SiteTextBlocksSessionState {
  blocks: SiteTextBlock[];
  modifiedCount: number;
  lastEditedBlockId: SiteTextBlockId | null;
}

type SiteTextBlocksListener = (state: SiteTextBlocksSessionState) => void;

/**
 * Оперативное хранилище текстовых блоков в памяти текущей сессии:
 * мгновенно транслирует правки администратора в секции Hero, Approach и Pricing без перезагрузки.
 */
class SiteTextBlocksSessionStore {
  private state: SiteTextBlocksSessionState = {
    blocks: cloneInitialSiteTextBlocks(),
    modifiedCount: 0,
    lastEditedBlockId: null,
  };

  private listeners = new Set<SiteTextBlocksListener>();

  public subscribe(listener: SiteTextBlocksListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): SiteTextBlocksSessionState {
    return this.state;
  }

  public getBlock(id: SiteTextBlockId): SiteTextBlock {
    return getSiteTextBlockById(this.state.blocks, id);
  }

  public updateBlock(
    id: SiteTextBlockId,
    patch: SiteTextBlockEditablePatch
  ): void {
    const nextBlocks = updateSiteTextBlockInList(this.state.blocks, id, patch);
    this.state = {
      blocks: nextBlocks,
      modifiedCount: countModifiedSiteTextBlocks(nextBlocks),
      lastEditedBlockId: id,
    };
    this.emit();
  }

  public resetBlock(id: SiteTextBlockId): void {
    const nextBlocks = resetSiteTextBlockInList(this.state.blocks, id);
    this.state = {
      blocks: nextBlocks,
      modifiedCount: countModifiedSiteTextBlocks(nextBlocks),
      lastEditedBlockId: id,
    };
    this.emit();
  }

  public resetAllBlocks(): void {
    const initial = cloneInitialSiteTextBlocks();
    this.state = {
      blocks: initial,
      modifiedCount: 0,
      lastEditedBlockId: null,
    };
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }
}

export const siteTextBlocksStore = new SiteTextBlocksSessionStore();
