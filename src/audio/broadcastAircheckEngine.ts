import {
  AIRCHECK_AUDIO_URLS,
  analyzeUploadedSpotSamples,
  BroadcastSegmentId,
  BroadcastSourceMode,
  BroadcastTimelineSegment,
  buildBroadcastTimelineSegments,
  clampTargetSlotIndex,
  DEFAULT_AIRCHECK_DURATIONS_SEC,
  DEFAULT_NEIGHBOR_ORDER,
  findOptimalSpeechExitSec,
  getTotalBroadcastDurationSec,
  InsertedSpotMode,
  NeighborBroadcastSpotSpec,
  PROGRAM_TRANSITION_CONFIG,
  randomizeSlotPlacement,
  resolveActiveBroadcastSegmentAtTime,
  TargetSlotPosition,
  TargetSpotPresetId,
  UploadedSpotBroadcastDiagnostic,
  VERIFIED_LIVE_REGIONAL_STATIONS,
  VerifiedRegionalStationSpec,
} from '../data/broadcastAircheckData';
import {
  createSafeAudioContext,
  unlockAudioContextOnGesture,
} from './audioContextHelper';
import {
  claimExclusiveAudioFocus,
  onExclusiveAudioFocusClaimed,
} from './audioFocusCoordinator';

export type LiveStreamConnectionState =
  | 'idle'
  | 'connecting'
  | 'live_air'
  | 'fallback_aircheck';

export type ClientGainMode = 'as_uploaded' | 'broadcast_matched';

export interface BroadcastAircheckSnapshot {
  isPlaying: boolean;
  sourceMode: BroadcastSourceMode;
  spotMode: InsertedSpotMode;
  targetPresetId: TargetSpotPresetId;
  targetSlotIndex: TargetSlotPosition;
  neighborOrder: readonly NeighborBroadcastSpotSpec['id'][];
  selectedStationId: VerifiedRegionalStationSpec['id'];
  liveStreamStatus: LiveStreamConnectionState;
  roadNoiseEnabled: boolean;
  clientGainMode: ClientGainMode;
  isCrossfadingSplice: boolean;
  resolvedProgramExitSec: number | null;
  volume: number;
  isMuted: boolean;
  elapsedSec: number;
  totalDurationSec: number;
  activeSegmentId: BroadcastSegmentId;
  segmentProgressRatio: number;
  segments: readonly BroadcastTimelineSegment[];
  clientAudioUrl: string | null;
  clientFileName: string | null;
  uploadedDiagnostic: UploadedSpotBroadcastDiagnostic | null;
  isAnalyzingUpload: boolean;
  uploadError: string | null;
}

type AircheckListener = (snap: BroadcastAircheckSnapshot) => void;

const MAX_UPLOAD_BYTES = 28 * 1024 * 1024;
const TARGET_BROADCAST_RMS_DB = -18.5;

class BroadcastAircheckEngine {
  private sourceMode: BroadcastSourceMode = 'captured_regional_host';
  private spotMode: InsertedSpotMode = 'fmworks_example';
  private targetPresetId: TargetSpotPresetId = 'zerno_craft';
  private targetSlotIndex: TargetSlotPosition = 2;
  private neighborOrder: NeighborBroadcastSpotSpec['id'][] = [
    ...DEFAULT_NEIGHBOR_ORDER,
  ];
  private selectedStationId: VerifiedRegionalStationSpec['id'] = 'kp_reg_91';
  private liveStreamStatus: LiveStreamConnectionState = 'idle';
  private roadNoiseEnabled = false;
  private clientGainMode: ClientGainMode = 'as_uploaded';
  private isCrossfadingSplice = false;
  private volume = 0.9;
  private isMuted = false;

  private isPlaying = false;
  private elapsedSec = 0;

  private clientAudioUrl: string | null = null;
  private clientFileName: string | null = null;
  private clientAudioBuffer: AudioBuffer | null = null;
  private clientLeftSamples: Float32Array | null = null;
  private clientRightSamples: Float32Array | null = null;
  private clientSampleRate = 44100;
  private uploadedDiagnostic: UploadedSpotBroadcastDiagnostic | null = null;
  private isAnalyzingUpload = false;
  private uploadError: string | null = null;

  // Единый Web Audio граф для бесшовного кроссфейда, лимитирования и шума дороги
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private roadGain: GainNode | null = null;
  private roadSource: AudioBufferSourceNode | null = null;

  private bufferCache = new Map<string, AudioBuffer>();
  private loadingBuffers = new Map<string, Promise<AudioBuffer | null>>();
  private detectedProgramExitByUrl = new Map<string, number>();

  private activeBufferSource: AudioBufferSourceNode | null = null;
  private activeBufferGain: GainNode | null = null;
  private fadingOutNodes: Array<{
    source: AudioBufferSourceNode;
    gain: GainNode;
  }> = [];

  // Потоковый HTMLAudio тракт (для Live FM-потока и фоллбэка декодирования)
  private htmlAudio: HTMLAudioElement | null = null;
  private liveMediaSource: MediaElementAudioSourceNode | null = null;
  private liveAnalyser: AnalyserNode | null = null;
  private liveDeckGain: GainNode | null = null;
  private liveTimeDomainBuf: Float32Array<ArrayBuffer> | null = null;
  private liveSpeechSamplesDb: number[] = [];
  private livePauseLowFrames = 0;
  private preloadedNextAudio: HTMLAudioElement | null = null;
  private preloadedNextUrl: string | null = null;

  private activeSegmentIndex = 0;
  private segmentWallStartMs = 0;
  private segmentInitialOffsetSec = 0;
  private crossfadeStartedForToken = -1;
  private tickTimerId: number | null = null;
  private liveConnectGuardTimerId: number | null = null;
  private sessionToken = 0;

  private listeners = new Set<AircheckListener>();

  constructor() {
    onExclusiveAudioFocusClaimed((channel) => {
      if (channel !== 'broadcast_aircheck' && this.isPlaying) {
        this.stop();
      }
    });
  }

  public subscribe(listener: AircheckListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private getSelectedStation(): VerifiedRegionalStationSpec {
    return (
      VERIFIED_LIVE_REGIONAL_STATIONS.find(
        (s) => s.id === this.selectedStationId
      ) ?? VERIFIED_LIVE_REGIONAL_STATIONS[0]
    );
  }

  private getProgramOverrideExitSec(): number | undefined {
    if (this.sourceMode === 'live_regional_stream') {
      if (this.liveStreamStatus === 'fallback_aircheck') {
        const st = this.getSelectedStation();
        return this.detectedProgramExitByUrl.get(st.fallbackAircheckUrl);
      }
      return undefined;
    }
    const url =
      this.sourceMode === 'captured_story_program'
        ? AIRCHECK_AUDIO_URLS.storyProgramLeadin
        : AIRCHECK_AUDIO_URLS.regionalHostLeadin;
    return this.detectedProgramExitByUrl.get(url);
  }

  private computeSegments(): readonly BroadcastTimelineSegment[] {
    const station = this.getSelectedStation();
    const detectedExit = this.getProgramOverrideExitSec();
    const segmentDurationOverrides: Partial<
      Record<BroadcastSegmentId, number>
    > = {};
    if (typeof detectedExit === 'number' && Number.isFinite(detectedExit)) {
      segmentDurationOverrides.program_leadin = detectedExit;
    }

    return buildBroadcastTimelineSegments({
      sourceMode: this.sourceMode,
      spotMode:
        this.spotMode === 'client_upload' && !this.clientAudioUrl
          ? 'fmworks_example'
          : this.spotMode,
      targetPresetId: this.targetPresetId,
      targetSlotIndex: this.targetSlotIndex,
      neighborOrder: this.neighborOrder,
      clientSpotName: this.clientFileName,
      clientSpotDurationSec: this.uploadedDiagnostic?.durationSec ?? null,
      liveStationTitle: `${station.title} (${station.frequencyBadge})`,
      segmentDurationOverrides,
    });
  }

  public getSnapshot(): BroadcastAircheckSnapshot {
    const segments = this.computeSegments();
    const totalDurationSec = getTotalBroadcastDurationSec(segments);
    const clampedElapsed = Math.min(
      totalDurationSec,
      Math.max(0, this.elapsedSec)
    );
    const resolved = resolveActiveBroadcastSegmentAtTime(
      segments,
      clampedElapsed
    );
    const leadInSeg = segments.find((s) => s.id === 'program_leadin');

    return {
      isPlaying: this.isPlaying,
      sourceMode: this.sourceMode,
      spotMode: this.spotMode,
      targetPresetId: this.targetPresetId,
      targetSlotIndex: this.targetSlotIndex,
      neighborOrder: [...this.neighborOrder],
      selectedStationId: this.selectedStationId,
      liveStreamStatus: this.liveStreamStatus,
      roadNoiseEnabled: this.roadNoiseEnabled,
      clientGainMode: this.clientGainMode,
      isCrossfadingSplice: this.isCrossfadingSplice,
      resolvedProgramExitSec: leadInSeg ? leadInSeg.durationSec : null,
      volume: this.volume,
      isMuted: this.isMuted,
      elapsedSec: Math.round(clampedElapsed * 100) / 100,
      totalDurationSec,
      activeSegmentId: resolved.segment.id,
      segmentProgressRatio: resolved.segmentProgressRatio,
      segments,
      clientAudioUrl: this.clientAudioUrl,
      clientFileName: this.clientFileName,
      uploadedDiagnostic: this.uploadedDiagnostic,
      isAnalyzingUpload: this.isAnalyzingUpload,
      uploadError: this.uploadError,
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  private ensureAudioGraph(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const ctx = createSafeAudioContext();
      if (!ctx) return null;

      this.audioCtx = ctx;
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume;

      this.masterLimiter = ctx.createDynamicsCompressor();
      this.masterLimiter.threshold.value = -2.0;
      this.masterLimiter.knee.value = 6.0;
      this.masterLimiter.ratio.value = 12.0;
      this.masterLimiter.attack.value = 0.002;
      this.masterLimiter.release.value = 0.08;

      this.masterLimiter.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);
    }

    unlockAudioContextOnGesture(this.audioCtx);

    return this.audioCtx;
  }

  private syncMasterVolume(): void {
    const gainVal = this.isMuted ? 0 : this.volume;
    if (this.audioCtx && this.masterGain) {
      try {
        this.masterGain.gain.setTargetAtTime(
          gainVal,
          this.audioCtx.currentTime,
          0.025
        );
      } catch {
        this.masterGain.gain.value = gainVal;
      }
    }
    if (this.htmlAudio && !this.liveMediaSource) {
      this.htmlAudio.volume = gainVal;
      this.htmlAudio.muted = this.isMuted;
    }
  }

  public setVolume(next: number): void {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(next) ? next : 0.9));
    this.volume = clamped;
    if (clamped > 0.01 && this.isMuted) {
      this.isMuted = false;
    } else if (clamped === 0) {
      this.isMuted = true;
    }
    this.syncMasterVolume();
    this.emit();
  }

  public toggleMute(): void {
    this.isMuted = !this.isMuted;
    this.syncMasterVolume();
    this.emit();
  }

  public setSourceMode(mode: BroadcastSourceMode): void {
    if (this.sourceMode === mode) return;
    const wasPlaying = this.isPlaying;
    this.clearAudioAndTimers();
    this.sourceMode = mode;
    this.liveStreamStatus = 'idle';
    this.elapsedSec = 0;
    this.isPlaying = false;
    this.syncRoadNoise();
    this.emit();
    if (wasPlaying) {
      this.playFromTime(0);
    }
  }

  public setSelectedStation(stationId: VerifiedRegionalStationSpec['id']): void {
    if (
      this.selectedStationId === stationId &&
      this.sourceMode === 'live_regional_stream'
    ) {
      return;
    }
    const wasPlaying = this.isPlaying;
    this.clearAudioAndTimers();
    this.selectedStationId = stationId;
    this.sourceMode = 'live_regional_stream';
    this.liveStreamStatus = 'idle';
    this.elapsedSec = 0;
    this.isPlaying = false;
    this.syncRoadNoise();
    this.emit();
    if (wasPlaying) {
      this.playFromTime(0);
    }
  }

  public setSpotMode(mode: InsertedSpotMode): void {
    if (mode === 'client_upload' && !this.clientAudioUrl) {
      this.spotMode = 'client_upload';
      this.stop();
      return;
    }
    if (this.spotMode === mode) return;
    const wasPlaying = this.isPlaying;
    this.clearAudioAndTimers();
    this.spotMode = mode;
    if (mode === 'typical_cliche') {
      this.targetPresetId = 'cliche_template';
    } else if (
      mode === 'fmworks_example' &&
      this.targetPresetId === 'cliche_template'
    ) {
      this.targetPresetId = 'zerno_craft';
    }
    this.elapsedSec = 0;
    this.isPlaying = false;
    this.syncRoadNoise();
    this.emit();
    if (wasPlaying) {
      this.jumpToTargetTransition();
    }
  }

  public selectTargetPreset(presetId: TargetSpotPresetId): void {
    const nextSpotMode: InsertedSpotMode =
      presetId === 'cliche_template' ? 'typical_cliche' : 'fmworks_example';
    if (
      this.targetPresetId === presetId &&
      this.spotMode === nextSpotMode
    ) {
      return;
    }
    const wasPlaying = this.isPlaying;
    this.clearAudioAndTimers();
    this.targetPresetId = presetId;
    this.spotMode = nextSpotMode;
    this.elapsedSec = 0;
    this.isPlaying = false;
    this.syncRoadNoise();
    this.emit();
    if (wasPlaying) {
      this.jumpToTargetTransition();
    }
  }

  private refreshDiagnosticSlotContext(): void {
    if (!this.clientFileName || !this.clientLeftSamples) return;
    this.uploadedDiagnostic = analyzeUploadedSpotSamples({
      fileName: this.clientFileName,
      samples: this.clientLeftSamples,
      rightSamples: this.clientRightSamples,
      sampleRate: this.clientSampleRate,
      targetSlotIndex: this.targetSlotIndex,
    });
  }

  public setTargetSlotIndex(slot: TargetSlotPosition): void {
    const nextSlot = clampTargetSlotIndex(slot);
    if (this.targetSlotIndex === nextSlot) return;
    const wasPlaying = this.isPlaying;
    this.clearAudioAndTimers();
    this.targetSlotIndex = nextSlot;
    this.refreshDiagnosticSlotContext();
    this.elapsedSec = 0;
    this.isPlaying = false;
    this.syncRoadNoise();
    this.emit();
    if (wasPlaying) {
      this.jumpToTargetTransition();
    }
  }

  public randomizeTargetSlot(): void {
    const wasPlaying = this.isPlaying;
    this.clearAudioAndTimers();
    const randomized = randomizeSlotPlacement({
      currentSlotIndex: this.targetSlotIndex,
      currentNeighborOrder: this.neighborOrder,
    });
    this.targetSlotIndex = randomized.targetSlotIndex;
    this.neighborOrder = randomized.neighborOrder;
    this.refreshDiagnosticSlotContext();
    this.elapsedSec = 0;
    this.isPlaying = false;
    this.syncRoadNoise();
    this.emit();
    if (wasPlaying) {
      this.jumpToTargetTransition();
    }
  }

  public setClientGainMode(mode: ClientGainMode): void {
    if (this.clientGainMode === mode) return;
    this.clientGainMode = mode;

    const segments = this.computeSegments();
    const activeSeg = segments[this.activeSegmentIndex];
    if (
      this.isPlaying &&
      activeSeg?.id === 'target_spot' &&
      this.spotMode === 'client_upload' &&
      this.audioCtx &&
      this.activeBufferGain
    ) {
      const targetLinear = this.computeSegmentPlaybackGain(activeSeg);
      try {
        this.activeBufferGain.gain.setTargetAtTime(
          targetLinear,
          this.audioCtx.currentTime,
          0.05
        );
      } catch {
        this.activeBufferGain.gain.value = targetLinear;
      }
    }
    this.emit();
  }

  public toggleRoadNoise(): void {
    this.roadNoiseEnabled = !this.roadNoiseEnabled;
    this.syncRoadNoise();
    this.emit();
  }

  public togglePlayPause(): void {
    if (this.isPlaying) {
      this.pause();
      return;
    }
    const segments = this.computeSegments();
    const total = getTotalBroadcastDurationSec(segments);
    const resumeAt = this.elapsedSec >= total - 0.35 ? 0 : this.elapsedSec;
    this.playFromTime(resumeAt);
  }

  public playFromSegment(segmentId: BroadcastSegmentId): void {
    const segments = this.computeSegments();
    const target = segments.find((s) => s.id === segmentId) ?? segments[0];
    this.playFromTime(target.startSec);
  }

  public seekToRatio(ratio: number): void {
    const segments = this.computeSegments();
    const total = getTotalBroadcastDurationSec(segments);
    if (total <= 0) return;
    const clampedRatio = Math.min(
      1,
      Math.max(0, Number.isFinite(ratio) ? ratio : 0)
    );
    this.seekToTime(clampedRatio * total);
  }

  public seekToTime(targetTimeSec: number): void {
    const segments = this.computeSegments();
    const total = getTotalBroadcastDurationSec(segments);
    const clamped = Math.max(
      0,
      Math.min(Math.max(0, total - 0.25), targetTimeSec)
    );

    if (this.isPlaying && this.htmlAudio) {
      const resolved = resolveActiveBroadcastSegmentAtTime(segments, clamped);
      const targetIdx = segments.findIndex((s) => s.id === resolved.segment.id);
      const isLiveSeg =
        resolved.segment.id === 'program_leadin' &&
        this.sourceMode === 'live_regional_stream' &&
        this.liveStreamStatus !== 'fallback_aircheck';

      if (
        targetIdx === this.activeSegmentIndex &&
        !isLiveSeg &&
        this.htmlAudio.readyState >= 1
      ) {
        try {
          this.htmlAudio.currentTime = resolved.segmentLocalSec;
          this.segmentInitialOffsetSec = resolved.segmentLocalSec;
          this.segmentWallStartMs = performance.now();
          this.elapsedSec = clamped;
          this.emit();
          return;
        } catch {
          // Fall through
        }
      }
    }

    this.playFromTime(clamped);
  }

  /**
   * Переходит за 3.2 сек до естественной паузы окончания фразы в программе,
   * чтобы сразу услышать завершение мысли ведущего, плавное затухание и кроссфейд в отбивку склейки.
   */
  public jumpToSpliceTransition(): void {
    const segments = this.computeSegments();
    const adJingleSeg = segments.find((s) => s.id === 'ad_jingle_in');
    const spliceStart = adJingleSeg
      ? Math.max(0, adJingleSeg.startSec - 3.2)
      : 0;
    this.playFromTime(spliceStart);
  }

  /**
   * Переходит за 3.0 сек до целевого слота (финал отбивки склейки для слота №1 или хвост соседа).
   */
  public jumpToTargetTransition(): void {
    const segments = this.computeSegments();
    const targetSeg = segments.find((s) => s.isTargetSlot);
    const startAt = targetSeg ? Math.max(0, targetSeg.startSec - 3.0) : 0;
    this.playFromTime(startAt);
  }

  public pause(): void {
    this.clearAudioAndTimers();
    this.isPlaying = false;
    this.isCrossfadingSplice = false;
    if (this.liveStreamStatus === 'connecting') {
      this.liveStreamStatus = 'idle';
    }
    this.syncRoadNoise();
    this.emit();
  }

  public stop(): void {
    this.clearAudioAndTimers();
    this.isPlaying = false;
    this.isCrossfadingSplice = false;
    this.elapsedSec = 0;
    this.liveStreamStatus = 'idle';
    this.syncRoadNoise();
    this.emit();
  }

  public async loadClientAudioFile(file: File): Promise<boolean> {
    this.uploadError = null;
    if (!file) return false;

    const lowerName = file.name.toLowerCase();
    const looksLikeAudio =
      file.type.startsWith('audio/') ||
      /\.(mp3|wav|m4a|ogg|aac|flac|webm)$/i.test(lowerName);

    if (!looksLikeAudio) {
      this.uploadError =
        'Выберите аудиофайл в формате MP3, WAV, M4A, OGG или AAC.';
      this.emit();
      return false;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      this.uploadError =
        'Размер файла превышает 28 МБ. Загрузите эфирный ролик до 28 МБ.';
      this.emit();
      return false;
    }

    this.clearAudioAndTimers();
    this.isPlaying = false;
    this.isAnalyzingUpload = true;
    this.syncRoadNoise();
    this.emit();

    try {
      const arrayBuffer = await file.arrayBuffer();
      const decodeCtx = createSafeAudioContext();
      if (!decodeCtx) {
        throw new Error('Браузер не поддерживает декодирование аудио');
      }

      let decoded: AudioBuffer;
      try {
        decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
      } finally {
        decodeCtx.close().catch(() => {});
      }

      const leftCopy = new Float32Array(decoded.getChannelData(0));
      const rightCopy =
        decoded.numberOfChannels > 1
          ? new Float32Array(decoded.getChannelData(1))
          : null;

      const diagnostic = analyzeUploadedSpotSamples({
        fileName: file.name,
        samples: leftCopy,
        rightSamples: rightCopy,
        sampleRate: decoded.sampleRate,
        targetSlotIndex: this.targetSlotIndex,
      });

      if (this.clientAudioUrl && this.clientAudioUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(this.clientAudioUrl);
        } catch {
          // Ignore
        }
      }

      const nextObjectUrl = URL.createObjectURL(file);
      this.clientAudioUrl = nextObjectUrl;
      this.clientFileName = file.name;
      this.clientAudioBuffer = decoded;
      this.clientLeftSamples = leftCopy;
      this.clientRightSamples = rightCopy;
      this.clientSampleRate = decoded.sampleRate;
      this.uploadedDiagnostic = diagnostic;
      this.spotMode = 'client_upload';
      this.isAnalyzingUpload = false;
      this.uploadError = null;
      this.elapsedSec = 0;
      this.emit();

      this.jumpToTargetTransition();
      return true;
    } catch {
      this.isAnalyzingUpload = false;
      this.uploadError =
        'Не удалось прочитать аудиодорожку. Проверьте, что файл MP3 или WAV не повреждён.';
      this.emit();
      return false;
    }
  }

  public clearClientAudio(): void {
    this.clearAudioAndTimers();
    if (this.clientAudioUrl && this.clientAudioUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(this.clientAudioUrl);
      } catch {
        // Ignore
      }
    }
    this.clientAudioUrl = null;
    this.clientFileName = null;
    this.clientAudioBuffer = null;
    this.clientLeftSamples = null;
    this.clientRightSamples = null;
    this.uploadedDiagnostic = null;
    this.uploadError = null;
    this.isAnalyzingUpload = false;
    if (this.spotMode === 'client_upload') {
      this.spotMode = 'fmworks_example';
      if (this.targetPresetId === 'cliche_template') {
        this.targetPresetId = 'zerno_craft';
      }
    }
    this.isPlaying = false;
    this.elapsedSec = 0;
    this.syncRoadNoise();
    this.emit();
  }

  private playFromTime(startTimeSec: number): void {
    if (typeof window === 'undefined') return;

    claimExclusiveAudioFocus('broadcast_aircheck');

    this.clearAudioAndTimers();

    const segments = this.computeSegments();
    const total = getTotalBroadcastDurationSec(segments);
    const clampedStart = Math.max(
      0,
      Math.min(Math.max(0, total - 0.2), startTimeSec)
    );
    const resolved = resolveActiveBroadcastSegmentAtTime(segments, clampedStart);
    const segIdx = Math.max(
      0,
      segments.findIndex((s) => s.id === resolved.segment.id)
    );

    this.isPlaying = true;
    this.isCrossfadingSplice = false;
    this.elapsedSec = clampedStart;
    this.ensureAudioGraph();
    this.syncRoadNoise();
    this.emit();

    void this.startSegmentAtIndex(segIdx, resolved.segmentLocalSec);
  }

  private resolveSegmentAudioSource(segment: BroadcastTimelineSegment): {
    url: string;
    isLiveStream: boolean;
    fallbackUrl: string | null;
  } {
    const station = this.getSelectedStation();

    if (segment.id === 'program_leadin') {
      if (this.sourceMode === 'live_regional_stream') {
        return {
          url: `/api/radio/live-stream?station=${encodeURIComponent(station.id)}&ts=${Date.now()}`,
          isLiveStream: true,
          fallbackUrl: station.fallbackAircheckUrl,
        };
      }
      if (this.sourceMode === 'captured_story_program') {
        return {
          url: AIRCHECK_AUDIO_URLS.storyProgramLeadin,
          isLiveStream: false,
          fallbackUrl: null,
        };
      }
      return {
        url: AIRCHECK_AUDIO_URLS.regionalHostLeadin,
        isLiveStream: false,
        fallbackUrl: null,
      };
    }

    if (segment.id === 'target_spot') {
      if (this.spotMode === 'client_upload' && this.clientAudioUrl) {
        return {
          url: this.clientAudioUrl,
          isLiveStream: false,
          fallbackUrl: AIRCHECK_AUDIO_URLS.caseZernoCraft,
        };
      }
      return {
        url: segment.audioUrl ?? AIRCHECK_AUDIO_URLS.caseZernoCraft,
        isLiveStream: false,
        fallbackUrl: null,
      };
    }

    return {
      url: segment.audioUrl ?? AIRCHECK_AUDIO_URLS.broadcastReturnOutro,
      isLiveStream: false,
      fallbackUrl: null,
    };
  }

  private computeSegmentPlaybackGain(segment: BroadcastTimelineSegment): number {
    if (
      segment.id === 'target_spot' &&
      this.spotMode === 'client_upload' &&
      this.uploadedDiagnostic &&
      this.clientGainMode === 'broadcast_matched'
    ) {
      const deltaDb = Math.max(
        -12,
        Math.min(16, TARGET_BROADCAST_RMS_DB - this.uploadedDiagnostic.meanRmsDb)
      );
      return Math.pow(10, deltaDb / 20);
    }
    return 1.0;
  }

  private async loadAndDecodeBuffer(
    url: string,
    isProgramLeadIn = false
  ): Promise<AudioBuffer | null> {
    if (this.clientAudioUrl && url === this.clientAudioUrl && this.clientAudioBuffer) {
      return this.clientAudioBuffer;
    }

    const cached = this.bufferCache.get(url);
    if (cached) return cached;

    const inFlight = this.loadingBuffers.get(url);
    if (inFlight) return inFlight;

    const promise = (async (): Promise<AudioBuffer | null> => {
      try {
        const ctx = this.ensureAudioGraph();
        if (!ctx) return null;
        const res = await fetch(url);
        if (!res.ok) return null;
        const arr = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arr);
        this.bufferCache.set(url, decoded);

        if (isProgramLeadIn && !this.detectedProgramExitByUrl.has(url)) {
          const preferred =
            url === AIRCHECK_AUDIO_URLS.storyProgramLeadin
              ? DEFAULT_AIRCHECK_DURATIONS_SEC.storyProgramLeadin
              : DEFAULT_AIRCHECK_DURATIONS_SEC.regionalHostLeadin;
          const exitRes = findOptimalSpeechExitSec({
            samples: decoded.getChannelData(0),
            sampleRate: decoded.sampleRate,
            searchStartSec: Math.max(
              4,
              decoded.duration - PROGRAM_TRANSITION_CONFIG.recordedSearchWindowSec
            ),
            searchEndSec: Math.max(4.5, decoded.duration - 0.15),
            preferredExitSec: preferred,
            minPauseSec: 0.14,
          });
          this.detectedProgramExitByUrl.set(url, exitRes.exitSec);
        }

        return decoded;
      } catch {
        return null;
      } finally {
        this.loadingBuffers.delete(url);
      }
    })();

    this.loadingBuffers.set(url, promise);
    return promise;
  }

  private preloadNextBufferIfNeeded(
    segments: readonly BroadcastTimelineSegment[]
  ): void {
    if (typeof window === 'undefined') return;
    const nextIdx = this.activeSegmentIndex + 1;
    if (nextIdx >= segments.length) return;

    const nextSeg = segments[nextIdx];
    const nextSource = this.resolveSegmentAudioSource(nextSeg);
    if (nextSource.isLiveStream) return;

    if (!this.bufferCache.has(nextSource.url)) {
      void this.loadAndDecodeBuffer(nextSource.url, false);
    }

    if (this.preloadedNextUrl !== nextSource.url) {
      this.disposePreloadedAudio();
      try {
        const nextAudio = new Audio();
        nextAudio.preload = 'auto';
        nextAudio.volume = this.isMuted ? 0 : this.volume;
        nextAudio.src = nextSource.url;
        nextAudio.load();
        this.preloadedNextAudio = nextAudio;
        this.preloadedNextUrl = nextSource.url;
      } catch {
        this.disposePreloadedAudio();
      }
    }
  }

  private disposePreloadedAudio(): void {
    if (this.preloadedNextAudio) {
      try {
        this.preloadedNextAudio.pause();
        this.preloadedNextAudio.removeAttribute('src');
        this.preloadedNextAudio.load();
      } catch {
        // Ignore
      }
    }
    this.preloadedNextAudio = null;
    this.preloadedNextUrl = null;
  }

  private stopActiveBufferNodes(): void {
    if (this.activeBufferSource) {
      try {
        this.activeBufferSource.stop();
        this.activeBufferSource.disconnect();
      } catch {
        // Ignore
      }
      this.activeBufferSource = null;
    }
    if (this.activeBufferGain) {
      try {
        this.activeBufferGain.disconnect();
      } catch {
        // Ignore
      }
      this.activeBufferGain = null;
    }
    for (const old of this.fadingOutNodes) {
      try {
        old.source.stop();
        old.source.disconnect();
        old.gain.disconnect();
      } catch {
        // Ignore
      }
    }
    this.fadingOutNodes = [];
  }

  private async startSegmentAtIndex(
    segIndex: number,
    offsetSec: number,
    fadeInSec = 0.025
  ): Promise<void> {
    const segments = this.computeSegments();
    if (segIndex < 0 || segIndex >= segments.length) {
      this.finishBroadcastSequence(segments);
      return;
    }

    const segment = segments[segIndex];
    const token = ++this.sessionToken;
    this.activeSegmentIndex = segIndex;
    this.segmentInitialOffsetSec = Math.max(0, offsetSec);
    this.segmentWallStartMs = performance.now();
    this.crossfadeStartedForToken = -1;
    this.liveSpeechSamplesDb = [];
    this.livePauseLowFrames = 0;

    const source = this.resolveSegmentAudioSource(segment);
    if (source.isLiveStream) {
      this.liveStreamStatus = 'connecting';
      this.launchHtmlSegmentAudio(
        segment,
        source.url,
        true,
        source.fallbackUrl,
        token
      );
      this.startSegmentTicker(token);
      return;
    }

    if (this.sourceMode !== 'live_regional_stream') {
      this.liveStreamStatus = 'idle';
    }

    const ctx = this.ensureAudioGraph();
    const cachedDecoded = ctx ? this.bufferCache.get(source.url) ?? null : null;
    if (ctx && this.masterLimiter && cachedDecoded) {
      this.launchBufferSegmentAudio(
        segment,
        cachedDecoded,
        this.segmentInitialOffsetSec,
        fadeInSec,
        token
      );
      this.startSegmentTicker(token);
      return;
    }

    const decoded = ctx
      ? await this.loadAndDecodeBuffer(
          source.url,
          segment.id === 'program_leadin'
        )
      : null;

    if (token !== this.sessionToken || !this.isPlaying) {
      return;
    }

    if (ctx && this.masterLimiter && decoded) {
      this.launchBufferSegmentAudio(
        segment,
        decoded,
        this.segmentInitialOffsetSec,
        fadeInSec,
        token
      );
      this.startSegmentTicker(token);
      return;
    }

    // Фоллбэк на HTMLAudioElement, если Web Audio декодирование недоступно
    this.launchHtmlSegmentAudio(
      segment,
      source.url,
      false,
      source.fallbackUrl,
      token
    );
    this.startSegmentTicker(token);
  }

  private launchBufferSegmentAudio(
    segment: BroadcastTimelineSegment,
    buffer: AudioBuffer,
    offsetSec: number,
    fadeInSec: number,
    token: number
  ): void {
    if (!this.audioCtx || !this.masterLimiter) return;

    // Предыдущие затухающие дорожки не обрываем мгновенно, если сейчас идёт плавный кроссфейд
    if (this.activeBufferSource && this.activeBufferGain) {
      const oldSrc = this.activeBufferSource;
      const oldGain = this.activeBufferGain;
      this.fadingOutNodes.push({ source: oldSrc, gain: oldGain });
      this.activeBufferSource = null;
      this.activeBufferGain = null;

      window.setTimeout(() => {
        try {
          oldSrc.stop();
          oldSrc.disconnect();
          oldGain.disconnect();
        } catch {
          // Ignore
        }
        this.fadingOutNodes = this.fadingOutNodes.filter(
          (n) => n.source !== oldSrc
        );
      }, 480);
    }

    if (this.htmlAudio) {
      this.teardownHtmlAudio();
    }

    const now = this.audioCtx.currentTime;
    const gainNode = this.audioCtx.createGain();
    const targetGain = this.computeSegmentPlaybackGain(segment);
    const safeFade = Math.max(0.015, fadeInSec);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(targetGain, now + safeFade);
    gainNode.connect(this.masterLimiter);

    const src = this.audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(gainNode);

    const safeOffset = Math.max(0, Math.min(buffer.duration - 0.1, offsetSec));
    const maxSegmentSpan = Math.max(0.15, segment.durationSec - safeOffset);
    const playDur = Math.min(buffer.duration - safeOffset, maxSegmentSpan + 0.35);

    this.activeBufferSource = src;
    this.activeBufferGain = gainNode;
    this.segmentInitialOffsetSec = safeOffset;
    this.segmentWallStartMs = performance.now();

    src.addEventListener('ended', () => {
      if (token !== this.sessionToken || !this.isPlaying) return;
      if (this.crossfadeStartedForToken !== token) {
        this.advanceToNextSegment(token, false);
      }
    });

    src.start(now, safeOffset, playDur);
    this.emit();
  }

  private teardownHtmlAudio(): void {
    if (this.liveMediaSource) {
      try {
        this.liveMediaSource.disconnect();
      } catch {
        // Ignore
      }
      this.liveMediaSource = null;
    }
    if (this.liveAnalyser) {
      try {
        this.liveAnalyser.disconnect();
      } catch {
        // Ignore
      }
      this.liveAnalyser = null;
    }
    if (this.liveDeckGain) {
      try {
        this.liveDeckGain.disconnect();
      } catch {
        // Ignore
      }
      this.liveDeckGain = null;
    }
    if (this.htmlAudio) {
      try {
        this.htmlAudio.pause();
        this.htmlAudio.removeAttribute('src');
        this.htmlAudio.load();
      } catch {
        // Ignore
      }
      this.htmlAudio = null;
    }
  }

  private launchHtmlSegmentAudio(
    segment: BroadcastTimelineSegment,
    url: string,
    isLiveStream: boolean,
    fallbackUrl: string | null,
    token: number
  ): void {
    if (typeof window === 'undefined') return;

    this.stopActiveBufferNodes();
    this.teardownHtmlAudio();

    if (this.liveConnectGuardTimerId !== null) {
      window.clearTimeout(this.liveConnectGuardTimerId);
      this.liveConnectGuardTimerId = null;
    }

    let audio: HTMLAudioElement;
    if (
      !isLiveStream &&
      this.segmentInitialOffsetSec <= 0.05 &&
      this.preloadedNextAudio &&
      this.preloadedNextUrl === url
    ) {
      audio = this.preloadedNextAudio;
      this.preloadedNextAudio = null;
      this.preloadedNextUrl = null;
    } else {
      audio = new Audio();
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      audio.volume = this.isMuted ? 0 : this.volume;
      audio.src = url;
    }

    this.htmlAudio = audio;

    if (isLiveStream && this.audioCtx && this.masterLimiter) {
      try {
        const mediaSrc = this.audioCtx.createMediaElementSource(audio);
        const analyser = this.audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        const deckGain = this.audioCtx.createGain();
        deckGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

        mediaSrc.connect(analyser);
        analyser.connect(deckGain);
        deckGain.connect(this.masterLimiter);

        this.liveMediaSource = mediaSrc;
        this.liveAnalyser = analyser;
        this.liveDeckGain = deckGain;
        this.liveTimeDomainBuf = new Float32Array(
          new ArrayBuffer(analyser.fftSize * Float32Array.BYTES_PER_ELEMENT)
        );
      } catch {
        this.liveMediaSource = null;
        this.liveAnalyser = null;
        this.liveDeckGain = null;
      }
    }

    let switchedToFallback = false;
    const triggerFallbackIfNeeded = () => {
      if (token !== this.sessionToken || switchedToFallback || !fallbackUrl) {
        return;
      }
      switchedToFallback = true;
      this.liveStreamStatus = 'fallback_aircheck';
      this.segmentWallStartMs = performance.now();
      this.emit();
      void this.loadAndDecodeBuffer(fallbackUrl, true).then((buf) => {
        if (token !== this.sessionToken || !this.isPlaying) return;
        if (buf && this.audioCtx && this.masterLimiter) {
          this.launchBufferSegmentAudio(segment, buf, 0, 0.03, token);
        } else {
          this.launchHtmlSegmentAudio(segment, fallbackUrl, false, null, token);
        }
      });
    };

    if (isLiveStream && fallbackUrl) {
      this.liveConnectGuardTimerId = window.setTimeout(() => {
        if (token !== this.sessionToken) return;
        if (audio.readyState < 2 && audio.paused) {
          triggerFallbackIfNeeded();
        }
      }, 3600);
    }

    audio.addEventListener(
      'playing',
      () => {
        if (token !== this.sessionToken) return;
        if (this.liveConnectGuardTimerId !== null) {
          window.clearTimeout(this.liveConnectGuardTimerId);
          this.liveConnectGuardTimerId = null;
        }
        this.segmentWallStartMs = performance.now();
        if (isLiveStream) {
          this.liveStreamStatus = 'live_air';
        }
        this.emit();
      },
      { once: true }
    );

    audio.addEventListener(
      'error',
      () => {
        if (token !== this.sessionToken) return;
        if (fallbackUrl && !switchedToFallback) {
          triggerFallbackIfNeeded();
        }
      },
      { once: true }
    );

    audio.addEventListener(
      'ended',
      () => {
        if (token !== this.sessionToken || !this.isPlaying) return;
        if (!isLiveStream && this.crossfadeStartedForToken !== token) {
          this.advanceToNextSegment(token, false);
        }
      },
      { once: true }
    );

    const beginPlay = () => {
      if (token !== this.sessionToken) return;
      if (!isLiveStream && this.segmentInitialOffsetSec > 0.05) {
        try {
          const safeOffset =
            audio.duration && Number.isFinite(audio.duration)
              ? Math.min(
                  this.segmentInitialOffsetSec,
                  Math.max(0, audio.duration - 0.15)
                )
              : this.segmentInitialOffsetSec;
          audio.currentTime = safeOffset;
        } catch {
          // Ignore
        }
      }
      this.segmentWallStartMs = performance.now();
      audio.play().catch(() => {
        if (token !== this.sessionToken) return;
        if (isLiveStream && fallbackUrl && !switchedToFallback) {
          triggerFallbackIfNeeded();
        }
      });
    };

    if (isLiveStream) {
      beginPlay();
    } else if (audio.readyState >= 1) {
      beginPlay();
    } else {
      audio.addEventListener('loadedmetadata', beginPlay, { once: true });
      audio.load();
    }
  }

  private sampleLiveStreamPauseGate(localElapsed: number): boolean {
    if (!this.liveAnalyser || !this.liveTimeDomainBuf) {
      return localElapsed >= DEFAULT_AIRCHECK_DURATIONS_SEC.liveLeadInWindow;
    }

    this.liveAnalyser.getFloatTimeDomainData(this.liveTimeDomainBuf);
    let sq = 0;
    const step = 4;
    let count = 0;
    for (let i = 0; i < this.liveTimeDomainBuf.length; i += step) {
      const s = this.liveTimeDomainBuf[i];
      sq += s * s;
      count += 1;
    }
    const rms = count > 0 ? Math.sqrt(sq / count) : 0.0001;
    const db = 20 * Math.log10(Math.max(0.00003, rms));

    if (localElapsed < PROGRAM_TRANSITION_CONFIG.livePauseGateStartSec) {
      if (db > -45) {
        this.liveSpeechSamplesDb.push(db);
        if (this.liveSpeechSamplesDb.length > 80) {
          this.liveSpeechSamplesDb.shift();
        }
      }
      return false;
    }

    const sorted = [...this.liveSpeechSamplesDb].sort((a, b) => a - b);
    const speechRefDb =
      sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.72)] : -19.0;

    if (db < speechRefDb - 9.5) {
      this.livePauseLowFrames += 1;
    } else {
      this.livePauseLowFrames = 0;
    }

    if (
      this.livePauseLowFrames >= 2 ||
      localElapsed >= PROGRAM_TRANSITION_CONFIG.livePauseGateHardLimitSec
    ) {
      return true;
    }

    return false;
  }

  private triggerSmoothProgramToSpliceCrossfade(token: number): void {
    if (token !== this.sessionToken || !this.isPlaying) return;
    if (this.crossfadeStartedForToken === token) return;
    this.crossfadeStartedForToken = token;
    this.isCrossfadingSplice = true;

    const fadeOutSec = PROGRAM_TRANSITION_CONFIG.programFadeOutSec;
    if (this.audioCtx) {
      const now = this.audioCtx.currentTime;
      if (this.activeBufferGain) {
        try {
          this.activeBufferGain.gain.cancelScheduledValues(now);
          this.activeBufferGain.gain.setValueAtTime(
            this.activeBufferGain.gain.value,
            now
          );
          this.activeBufferGain.gain.linearRampToValueAtTime(
            0.0001,
            now + fadeOutSec
          );
        } catch {
          // Ignore
        }
      }
      if (this.liveDeckGain) {
        const refDeck = this.liveDeckGain;
        const refHtml = this.htmlAudio;
        try {
          refDeck.gain.cancelScheduledValues(now);
          refDeck.gain.setValueAtTime(refDeck.gain.value, now);
          refDeck.gain.linearRampToValueAtTime(0.0001, now + fadeOutSec);
        } catch {
          // Ignore
        }
        window.setTimeout(() => {
          if (refHtml) {
            try {
              refHtml.pause();
            } catch {
              // Ignore
            }
          }
        }, Math.round(fadeOutSec * 1000) + 40);
      }
    }

    const segments = this.computeSegments();
    const nextIdx = this.activeSegmentIndex + 1;
    if (nextIdx < segments.length) {
      this.elapsedSec = segments[nextIdx].startSec;
      this.emit();
      void this.startSegmentAtIndex(nextIdx, 0, 0.14);
    }
  }

  private startSegmentTicker(token: number): void {
    if (this.tickTimerId !== null) {
      window.clearInterval(this.tickTimerId);
    }

    this.tickTimerId = window.setInterval(() => {
      if (token !== this.sessionToken || !this.isPlaying) return;

      const segments = this.computeSegments();
      const seg = segments[this.activeSegmentIndex];
      if (!seg) {
        this.finishBroadcastSequence(segments);
        return;
      }

      const audio = this.htmlAudio;
      const isLiveSeg =
        seg.id === 'program_leadin' &&
        this.sourceMode === 'live_regional_stream' &&
        this.liveStreamStatus !== 'fallback_aircheck';

      let localElapsed =
        this.segmentInitialOffsetSec +
        Math.max(0, (performance.now() - this.segmentWallStartMs) / 1000);

      if (
        !isLiveSeg &&
        audio &&
        !audio.paused &&
        Number.isFinite(audio.currentTime) &&
        audio.currentTime > 0
      ) {
        localElapsed = audio.currentTime;
      }

      this.elapsedSec = Math.min(seg.endSec, seg.startSec + localElapsed);

      if (seg.durationSec - localElapsed <= 5.5) {
        this.preloadNextBufferIfNeeded(segments);
      }

      // Для Live-потока ждём естественную паузу речи в окне 44..54с
      if (isLiveSeg) {
        const readyToCrossfade = this.sampleLiveStreamPauseGate(localElapsed);
        if (readyToCrossfade) {
          this.triggerSmoothProgramToSpliceCrossfade(token);
          return;
        }
        this.emit();
        return;
      }

      // Плавный кроссфейд из программы в отбивку склейки (наложение ~240 мс перед концом фразы)
      if (
        seg.id === 'program_leadin' &&
        localElapsed >=
          seg.durationSec - PROGRAM_TRANSITION_CONFIG.spliceCrossfadeOverlapSec &&
        this.crossfadeStartedForToken !== token
      ) {
        this.triggerSmoothProgramToSpliceCrossfade(token);
        return;
      }

      if (localElapsed >= seg.durationSec - 0.04) {
        this.advanceToNextSegment(token, true);
        return;
      }

      this.emit();
    }, 65);
  }

  private advanceToNextSegment(token: number, useMicroCrossfade: boolean): void {
    if (token !== this.sessionToken || !this.isPlaying) return;
    this.isCrossfadingSplice = false;
    const segments = this.computeSegments();
    const nextIdx = this.activeSegmentIndex + 1;
    if (nextIdx >= segments.length) {
      this.finishBroadcastSequence(segments);
      return;
    }
    this.elapsedSec = segments[nextIdx].startSec;
    this.emit();
    void this.startSegmentAtIndex(
      nextIdx,
      0,
      useMicroCrossfade ? PROGRAM_TRANSITION_CONFIG.adSlotMicroCrossfadeSec : 0.02
    );
  }

  private finishBroadcastSequence(
    segments: readonly BroadcastTimelineSegment[]
  ): void {
    this.clearAudioAndTimers();
    this.isPlaying = false;
    this.isCrossfadingSplice = false;
    this.elapsedSec = getTotalBroadcastDurationSec(segments);
    if (this.liveStreamStatus === 'connecting') {
      this.liveStreamStatus = 'idle';
    }
    this.syncRoadNoise();
    this.emit();
  }

  private clearAudioAndTimers(): void {
    this.sessionToken += 1;
    this.isCrossfadingSplice = false;
    if (typeof window !== 'undefined') {
      if (this.tickTimerId !== null) {
        window.clearInterval(this.tickTimerId);
        this.tickTimerId = null;
      }
      if (this.liveConnectGuardTimerId !== null) {
        window.clearTimeout(this.liveConnectGuardTimerId);
        this.liveConnectGuardTimerId = null;
      }
    }
    this.stopActiveBufferNodes();
    this.teardownHtmlAudio();
    this.disposePreloadedAudio();
  }

  private syncRoadNoise(): void {
    if (typeof window === 'undefined') return;
    const shouldPlayNoise = this.roadNoiseEnabled && this.isPlaying;

    if (!shouldPlayNoise) {
      if (this.audioCtx && this.roadGain) {
        try {
          this.roadGain.gain.setTargetAtTime(
            0.0001,
            this.audioCtx.currentTime,
            0.08
          );
        } catch {
          // Ignore
        }
      }
      if (this.roadSource) {
        const prev = this.roadSource;
        this.roadSource = null;
        window.setTimeout(() => {
          try {
            prev.stop();
            prev.disconnect();
          } catch {
            // Ignore
          }
        }, 150);
      }
      return;
    }

    const ctx = this.ensureAudioGraph();
    if (!ctx || !this.masterGain) return;

    if (!this.roadGain) {
      this.roadGain = ctx.createGain();
      this.roadGain.gain.value = 0.0001;
      this.roadGain.connect(this.masterGain);
    }

    if (!this.roadSource && this.roadGain) {
      const length = ctx.sampleRate * 3;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.985 * b0 + white * 0.09;
        b1 = 0.95 * b1 + b0 * 0.25;
        data[i] = b1 * 0.9;
      }

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 215;

      const cabinPeak = ctx.createBiquadFilter();
      cabinPeak.type = 'peaking';
      cabinPeak.frequency.value = 92;
      cabinPeak.gain.value = 5;
      cabinPeak.Q.value = 1.4;

      src.connect(lowpass);
      lowpass.connect(cabinPeak);
      cabinPeak.connect(this.roadGain);
      src.start();
      this.roadSource = src;
    }

    if (this.roadGain) {
      this.roadGain.gain.cancelScheduledValues(ctx.currentTime);
      this.roadGain.gain.setTargetAtTime(0.16, ctx.currentTime, 0.14);
    }
  }
}

export const broadcastAircheckEngine = new BroadcastAircheckEngine();
