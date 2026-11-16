import {
  AUDIOWORKS_TOTAL_DURATION_SEC,
  CRASH_TEST_CLUTTER_DURATION_SEC,
  CRASH_TEST_STOP_DURATION_SEC,
} from '../data/audioworksCommercial';
import {
  BroadcastSegmentId,
  BroadcastSourceMode,
  buildBroadcastTimelineSegments,
  DEFAULT_NEIGHBOR_ORDER,
  getTotalBroadcastDurationSec,
  InsertedSpotMode,
  NeighborBroadcastSpotSpec,
  resolveActiveBroadcastSegmentAtTime,
  TargetSlotPosition,
  TargetSpotPresetId,
  VERIFIED_LIVE_REGIONAL_STATIONS,
  VerifiedRegionalStationSpec,
} from '../data/broadcastAircheckData';
import {
  BRAND_CASES,
  BrandCasePoster,
  CASE_SPECTRUM_BAND_COUNT,
  CaseId,
} from '../data/casesData';
import type { ResolvedHeroStagePlayback } from '../data/heroStageCms';
import type { LayaPersonaSlot } from '../engine/layaTypes';
import { onExclusiveAudioFocusClaimed } from './audioFocusCoordinator';
import type {
  BroadcastAircheckSnapshot,
  ClientGainMode,
  LiveStreamConnectionState,
} from './broadcastAircheckEngine';
import type { CasePlayerSnapshot } from './casePlayerEngine';
import type { ContrastStageSnapshot, StageMode } from './contrastAudioEngine';

export type {
  BroadcastAircheckSnapshot,
  CasePlayerSnapshot,
  ClientGainMode,
  ContrastStageSnapshot,
  LiveStreamConnectionState,
  StageMode,
};

type BroadcastAircheckEngineInstance =
  typeof import('./broadcastAircheckEngine')['broadcastAircheckEngine'];
type CasePlayerEngineInstance =
  typeof import('./casePlayerEngine')['casePlayerEngine'];
type ContrastAudioEngineInstance =
  typeof import('./contrastAudioEngine')['contrastAudioEngine'];

const HERO_VOLUME_STORAGE_KEY = 'fmworks_hero_volume_v1';
const HERO_MUTED_STORAGE_KEY = 'fmworks_hero_muted_v1';
const DEFAULT_HERO_VOLUME = 0.85;

function readInitialHeroVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_HERO_VOLUME;
  try {
    const raw = window.localStorage.getItem(HERO_VOLUME_STORAGE_KEY);
    if (raw === null) return DEFAULT_HERO_VOLUME;
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_HERO_VOLUME;
    return Math.max(0, Math.min(1, parsed));
  } catch {
    return DEFAULT_HERO_VOLUME;
  }
}

function readInitialHeroMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(HERO_MUTED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

// ============================================================================
// 1. Lazy CasePlayerEngine Facade
// ============================================================================

const IDLE_CASE_WAVE_BARS: [number, number, number, number, number] = [
  0.22, 0.35, 0.28, 0.4, 0.24,
];
const IDLE_CASE_SPECTRUM_BANDS: number[] = Array.from(
  { length: CASE_SPECTRUM_BAND_COUNT },
  () => 0
);

function createIdleCasePlayerSnapshot(): CasePlayerSnapshot {
  return {
    activeCase: null,
    isPlaying: false,
    playbackMode: null,
    currentTimeSec: 0,
    durationSec: 15,
    progress: 0,
    waveBars: IDLE_CASE_WAVE_BARS,
    spectrumBands: IDLE_CASE_SPECTRUM_BANDS,
  };
}

class LazyCasePlayerEngine {
  private instance: CasePlayerEngineInstance | null = null;
  private loadingPromise: Promise<CasePlayerEngineInstance> | null = null;
  private listeners = new Set<(snap: CasePlayerSnapshot) => void>();
  private idleSnapshot: CasePlayerSnapshot = createIdleCasePlayerSnapshot();

  public isLoaded(): boolean {
    return this.instance !== null;
  }

  public preload(): Promise<CasePlayerEngineInstance> {
    if (this.instance) {
      return Promise.resolve(this.instance);
    }
    if (!this.loadingPromise) {
      this.loadingPromise = import('./casePlayerEngine').then((mod) => {
        const engine = mod.casePlayerEngine;
        this.instance = engine;
        engine.subscribe((snap) => {
          this.listeners.forEach((fn) => fn(snap));
        });
        return engine;
      });
    }
    return this.loadingPromise;
  }

  public subscribe(listener: (snap: CasePlayerSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): CasePlayerSnapshot {
    if (this.instance) {
      return this.instance.getSnapshot();
    }
    return this.idleSnapshot;
  }

  public stop(): void {
    if (this.instance) {
      this.instance.stop();
    }
  }

  public pause(): void {
    if (this.instance) {
      this.instance.pause();
    }
  }

  public resume(): void {
    if (this.instance) {
      this.instance.resume();
    }
  }

  public togglePause(): void {
    if (this.instance) {
      this.instance.togglePause();
    }
  }

  public seekBySeconds(deltaSec: number): void {
    if (this.instance) {
      this.instance.seekBySeconds(deltaSec);
    }
  }

  public stopPreview(caseId?: CaseId): void {
    if (this.instance) {
      this.instance.stopPreview(caseId);
    }
  }

  public startPreview(item: BrandCasePoster): void {
    void this.preload().then((engine) => {
      engine.startPreview(item);
    });
  }

  public toggleCase(item: BrandCasePoster): void {
    if (this.instance) {
      this.instance.toggleCase(item);
      return;
    }
    void this.preload().then((engine) => {
      engine.toggleCase(item);
    });
  }

  public seekToRatio(ratio: number, targetCase?: BrandCasePoster): void {
    if (this.instance) {
      this.instance.seekToRatio(ratio, targetCase);
      return;
    }
    void this.preload().then((engine) => {
      engine.seekToRatio(ratio, targetCase);
    });
  }

  public playNextCase(orderedList: BrandCasePoster[] = BRAND_CASES): void {
    if (this.instance) {
      this.instance.playNextCase(orderedList);
      return;
    }
    void this.preload().then((engine) => {
      engine.playNextCase(orderedList);
    });
  }
}

// ============================================================================
// 2. Lazy ContrastAudioEngine Facade
// ============================================================================

class LazyContrastAudioEngine {
  private instance: ContrastAudioEngineInstance | null = null;
  private loadingPromise: Promise<ContrastAudioEngineInstance> | null = null;
  private listeners = new Set<(snap: ContrastStageSnapshot) => void>();
  private pendingBeforeStartCallbacks = new Set<() => void>();
  private pendingPersonaConfig: {
    preset: LayaPersonaSlot['focusChordPreset'];
    wordsCount: number;
  } | null = null;
  private pendingCmsHeroStage: ResolvedHeroStagePlayback | null = null;

  constructor() {
    onExclusiveAudioFocusClaimed((channel) => {
      if (channel === 'contrast_hero' && !this.instance) {
        this.pendingBeforeStartCallbacks.forEach((cb) => cb());
      }
    });
  }

  public isLoaded(): boolean {
    return this.instance !== null;
  }

  private buildIdleSnapshot(): ContrastStageSnapshot {
    const resolved = this.pendingCmsHeroStage;
    const focusSegmentStartSec = resolved ? resolved.focus.startSec : 0;
    const filmDurationSec = resolved
      ? resolved.focus.endSec !== null
        ? resolved.focus.endSec
        : Math.max(1, resolved.focus.startSec + resolved.focus.durationSec)
      : AUDIOWORKS_TOTAL_DURATION_SEC;

    return {
      mode: 'stream',
      isFilmPlaying: false,
      isSoundPlaying: false,
      roadNoiseEnabled: false,
      filmElapsedSec: 0,
      filmDurationSec,
      focusSegmentStartSec,
      revealedWordsCount: 0,
      activeChapter: null,
      hasCustomAudio: false,
      customAudioName: null,
      activeHeroTrackLabel:
        resolved && resolved.focus.sourceKind !== 'default_reel'
          ? resolved.focus.label
          : null,
      clutterDurationSec:
        resolved?.clutter.durationSec ?? CRASH_TEST_CLUTTER_DURATION_SEC,
      stopPauseDurationSec:
        resolved?.stopPauseDurationSec ?? CRASH_TEST_STOP_DURATION_SEC,
      crashPhase: 'idle',
      crashElapsedSec: 0,
      isLensExpanded: false,
      volume: readInitialHeroVolume(),
      isMuted: readInitialHeroMuted(),
      hasCompletedCrashTest: false,
      isPausedMidSession: false,
      pausedInClutter: false,
      audioError: null,
    };
  }

  private emitIdle(): void {
    if (this.instance) return;
    const snap = this.buildIdleSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  public preload(): Promise<ContrastAudioEngineInstance> {
    if (this.instance) {
      return Promise.resolve(this.instance);
    }
    if (!this.loadingPromise) {
      this.loadingPromise = import('./contrastAudioEngine').then((mod) => {
        const engine = mod.contrastAudioEngine;
        this.instance = engine;

        this.pendingBeforeStartCallbacks.forEach((cb) => {
          engine.onBeforeStart(cb);
        });

        if (this.pendingPersonaConfig) {
          engine.syncPersonaConfig(
            this.pendingPersonaConfig.preset,
            this.pendingPersonaConfig.wordsCount
          );
        }
        if (this.pendingCmsHeroStage) {
          engine.syncCmsHeroStage(this.pendingCmsHeroStage);
        }

        engine.subscribe((snap) => {
          this.listeners.forEach((fn) => fn(snap));
        });
        return engine;
      });
    }
    return this.loadingPromise;
  }

  public onBeforeStart(cb: () => void): () => void {
    if (this.instance) {
      return this.instance.onBeforeStart(cb);
    }
    this.pendingBeforeStartCallbacks.add(cb);
    return () => {
      this.pendingBeforeStartCallbacks.delete(cb);
    };
  }

  public subscribe(
    listener: (snap: ContrastStageSnapshot) => void
  ): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): ContrastStageSnapshot {
    if (this.instance) {
      return this.instance.getSnapshot();
    }
    return this.buildIdleSnapshot();
  }

  public syncPersonaConfig(
    preset: LayaPersonaSlot['focusChordPreset'],
    wordsCount: number
  ): void {
    this.pendingPersonaConfig = { preset, wordsCount };
    if (this.instance) {
      this.instance.syncPersonaConfig(preset, wordsCount);
    }
  }

  public syncCmsHeroStage(resolved: ResolvedHeroStagePlayback): void {
    this.pendingCmsHeroStage = resolved;
    if (this.instance) {
      this.instance.syncCmsHeroStage(resolved);
      return;
    }
    this.emitIdle();
  }

  public readFrequencyBins(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.instance) {
      return false;
    }
    return this.instance.readFrequencyBins(target);
  }

  public stopAll(): void {
    if (this.instance) {
      this.instance.stopAll();
    }
  }

  public pauseKeepingMode(): void {
    if (this.instance) {
      this.instance.pauseKeepingMode();
    }
  }

  public setVolume(nextVolume: number): void {
    void this.preload().then((engine) => {
      engine.setVolume(nextVolume);
    });
  }

  public toggleMute(): void {
    void this.preload().then((engine) => {
      engine.toggleMute();
    });
  }

  public loadCustomShowreel(
    objectUrl: string,
    fileName: string,
    autoPlay = false
  ): void {
    void this.preload().then((engine) => {
      engine.loadCustomShowreel(objectUrl, fileName, autoPlay);
    });
  }

  public resetCustomShowreel(): void {
    if (!this.instance) return;
    this.instance.resetCustomShowreel();
  }

  public toggleRoadNoise(): void {
    void this.preload().then((engine) => {
      engine.toggleRoadNoise();
    });
  }

  public startCrashTest(initialClutterOffsetSec = 0): void {
    void this.preload().then((engine) => {
      engine.startCrashTest(initialClutterOffsetSec);
    });
  }

  public restartCrashTest(): void {
    void this.preload().then((engine) => {
      engine.restartCrashTest();
    });
  }

  public toggleCrashTestOrShowreel(): void {
    void this.preload().then((engine) => {
      engine.toggleCrashTestOrShowreel();
    });
  }

  public expandLensWithAudioWorks(): void {
    void this.preload().then((engine) => {
      engine.expandLensWithAudioWorks();
    });
  }

  public collapseLensToSpotlight(): void {
    if (!this.instance) return;
    this.instance.collapseLensToSpotlight();
  }

  public selectLens(target: 'stream' | 'focus'): void {
    void this.preload().then((engine) => {
      engine.selectLens(target);
    });
  }

  public startSignatureShowreel(startSec?: number): void {
    void this.preload().then((engine) => {
      engine.startSignatureShowreel(startSec);
    });
  }

  public toggleShowreelPlayback(preferredStartSec?: number): void {
    void this.preload().then((engine) => {
      engine.toggleShowreelPlayback(preferredStartSec);
    });
  }

  public toggleContrastFilm12s(): void {
    void this.preload().then((engine) => {
      engine.toggleContrastFilm12s();
    });
  }

  public seekToRatio(ratio: number): void {
    if (this.instance) {
      this.instance.seekToRatio(ratio);
      return;
    }
    void this.preload().then((engine) => {
      engine.seekToRatio(ratio);
    });
  }
}

// ============================================================================
// 3. Lazy BroadcastAircheckEngine Facade
// ============================================================================

function createIdleBroadcastAircheckSnapshot(): BroadcastAircheckSnapshot {
  const station = VERIFIED_LIVE_REGIONAL_STATIONS[0];
  const neighborOrder: NeighborBroadcastSpotSpec['id'][] = [
    ...DEFAULT_NEIGHBOR_ORDER,
  ];
  const segments = buildBroadcastTimelineSegments({
    sourceMode: 'captured_regional_host',
    spotMode: 'fmworks_example',
    targetPresetId: 'zerno_craft',
    targetSlotIndex: 2,
    neighborOrder,
    clientSpotName: null,
    clientSpotDurationSec: null,
    liveStationTitle: `${station.title} (${station.frequencyBadge})`,
    segmentDurationOverrides: {},
  });
  const totalDurationSec = getTotalBroadcastDurationSec(segments);
  const resolved = resolveActiveBroadcastSegmentAtTime(segments, 0);
  const leadInSeg = segments.find((s) => s.id === 'program_leadin');

  return {
    isPlaying: false,
    sourceMode: 'captured_regional_host',
    spotMode: 'fmworks_example',
    targetPresetId: 'zerno_craft',
    targetSlotIndex: 2,
    neighborOrder,
    selectedStationId: station.id,
    liveStreamStatus: 'idle',
    roadNoiseEnabled: false,
    clientGainMode: 'as_uploaded',
    isCrossfadingSplice: false,
    resolvedProgramExitSec: leadInSeg ? leadInSeg.durationSec : null,
    volume: 0.9,
    isMuted: false,
    elapsedSec: 0,
    totalDurationSec,
    activeSegmentId: resolved.segment.id,
    segmentProgressRatio: resolved.segmentProgressRatio,
    segments,
    clientAudioUrl: null,
    clientFileName: null,
    uploadedDiagnostic: null,
    isAnalyzingUpload: false,
    uploadError: null,
  };
}

class LazyBroadcastAircheckEngine {
  private instance: BroadcastAircheckEngineInstance | null = null;
  private loadingPromise: Promise<BroadcastAircheckEngineInstance> | null =
    null;
  private listeners = new Set<(snap: BroadcastAircheckSnapshot) => void>();
  private idleSnapshot: BroadcastAircheckSnapshot =
    createIdleBroadcastAircheckSnapshot();

  public isLoaded(): boolean {
    return this.instance !== null;
  }

  public preload(): Promise<BroadcastAircheckEngineInstance> {
    if (this.instance) {
      return Promise.resolve(this.instance);
    }
    if (!this.loadingPromise) {
      this.loadingPromise = import('./broadcastAircheckEngine').then((mod) => {
        const engine = mod.broadcastAircheckEngine;
        this.instance = engine;
        engine.subscribe((snap) => {
          this.listeners.forEach((fn) => fn(snap));
        });
        return engine;
      });
    }
    return this.loadingPromise;
  }

  public subscribe(
    listener: (snap: BroadcastAircheckSnapshot) => void
  ): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): BroadcastAircheckSnapshot {
    if (this.instance) {
      return this.instance.getSnapshot();
    }
    return this.idleSnapshot;
  }

  public stop(): void {
    if (this.instance) {
      this.instance.stop();
    }
  }

  public pause(): void {
    if (this.instance) {
      this.instance.pause();
    }
  }

  public setVolume(next: number): void {
    void this.preload().then((engine) => {
      engine.setVolume(next);
    });
  }

  public toggleMute(): void {
    void this.preload().then((engine) => {
      engine.toggleMute();
    });
  }

  public setSourceMode(mode: BroadcastSourceMode): void {
    void this.preload().then((engine) => {
      engine.setSourceMode(mode);
    });
  }

  public setSelectedStation(
    stationId: VerifiedRegionalStationSpec['id']
  ): void {
    void this.preload().then((engine) => {
      engine.setSelectedStation(stationId);
    });
  }

  public setSpotMode(mode: InsertedSpotMode): void {
    void this.preload().then((engine) => {
      engine.setSpotMode(mode);
    });
  }

  public selectTargetPreset(presetId: TargetSpotPresetId): void {
    void this.preload().then((engine) => {
      engine.selectTargetPreset(presetId);
    });
  }

  public setTargetSlotIndex(slot: TargetSlotPosition): void {
    void this.preload().then((engine) => {
      engine.setTargetSlotIndex(slot);
    });
  }

  public randomizeTargetSlot(): void {
    void this.preload().then((engine) => {
      engine.randomizeTargetSlot();
    });
  }

  public setClientGainMode(mode: ClientGainMode): void {
    void this.preload().then((engine) => {
      engine.setClientGainMode(mode);
    });
  }

  public toggleRoadNoise(): void {
    void this.preload().then((engine) => {
      engine.toggleRoadNoise();
    });
  }

  public togglePlayPause(): void {
    if (this.instance) {
      this.instance.togglePlayPause();
      return;
    }
    void this.preload().then((engine) => {
      engine.togglePlayPause();
    });
  }

  public playFromSegment(segmentId: BroadcastSegmentId): void {
    if (this.instance) {
      this.instance.playFromSegment(segmentId);
      return;
    }
    void this.preload().then((engine) => {
      engine.playFromSegment(segmentId);
    });
  }

  public seekToRatio(ratio: number): void {
    if (this.instance) {
      this.instance.seekToRatio(ratio);
      return;
    }
    void this.preload().then((engine) => {
      engine.seekToRatio(ratio);
    });
  }

  public seekToTime(targetTimeSec: number): void {
    if (this.instance) {
      this.instance.seekToTime(targetTimeSec);
      return;
    }
    void this.preload().then((engine) => {
      engine.seekToTime(targetTimeSec);
    });
  }

  public jumpToSpliceTransition(): void {
    void this.preload().then((engine) => {
      engine.jumpToSpliceTransition();
    });
  }

  public jumpToTargetTransition(): void {
    void this.preload().then((engine) => {
      engine.jumpToTargetTransition();
    });
  }

  public async loadClientAudioFile(file: File): Promise<boolean> {
    const engine = await this.preload();
    return engine.loadClientAudioFile(file);
  }

  public clearClientAudio(): void {
    if (!this.instance) return;
    this.instance.clearClientAudio();
  }
}

export const lazyCasePlayerEngine = new LazyCasePlayerEngine();
export const lazyContrastAudioEngine = new LazyContrastAudioEngine();
export const lazyBroadcastAircheckEngine = new LazyBroadcastAircheckEngine();
