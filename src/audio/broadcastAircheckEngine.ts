import {
  AIRCHECK_AUDIO_URLS,
  analyzeUploadedSpotSamples,
  BroadcastSegmentId,
  BroadcastSourceMode,
  BroadcastTimelineSegment,
  buildBroadcastTimelineSegments,
  getTotalBroadcastDurationSec,
  InsertedSpotMode,
  resolveActiveBroadcastSegmentAtTime,
  UploadedSpotBroadcastDiagnostic,
  VERIFIED_LIVE_REGIONAL_STATIONS,
  VerifiedRegionalStationSpec,
} from '../data/broadcastAircheckData';
import { createSafeAudioContext } from './audioContextHelper';
import { casePlayerEngine } from './casePlayerEngine';
import { contrastAudioEngine } from './contrastAudioEngine';

export type LiveStreamConnectionState =
  | 'idle'
  | 'connecting'
  | 'live_air'
  | 'fallback_aircheck';

export interface BroadcastAircheckSnapshot {
  isPlaying: boolean;
  sourceMode: BroadcastSourceMode;
  spotMode: InsertedSpotMode;
  selectedStationId: VerifiedRegionalStationSpec['id'];
  liveStreamStatus: LiveStreamConnectionState;
  roadNoiseEnabled: boolean;
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

class BroadcastAircheckEngine {
  private sourceMode: BroadcastSourceMode = 'captured_regional_host';
  private spotMode: InsertedSpotMode = 'fmworks_example';
  private selectedStationId: VerifiedRegionalStationSpec['id'] = 'kp_reg_91';
  private liveStreamStatus: LiveStreamConnectionState = 'idle';
  private roadNoiseEnabled = false;

  private isPlaying = false;
  private elapsedSec = 0;

  private clientAudioUrl: string | null = null;
  private clientFileName: string | null = null;
  private uploadedDiagnostic: UploadedSpotBroadcastDiagnostic | null = null;
  private isAnalyzingUpload = false;
  private uploadError: string | null = null;

  private htmlAudio: HTMLAudioElement | null = null;
  private preloadedNextAudio: HTMLAudioElement | null = null;
  private preloadedNextUrl: string | null = null;

  private activeSegmentIndex = 0;
  private segmentWallStartMs = 0;
  private segmentInitialOffsetSec = 0;
  private tickTimerId: number | null = null;
  private liveConnectGuardTimerId: number | null = null;
  private sessionToken = 0;

  private noiseCtx: AudioContext | null = null;
  private roadGain: GainNode | null = null;
  private roadSource: AudioBufferSourceNode | null = null;

  private listeners = new Set<AircheckListener>();

  constructor() {
    contrastAudioEngine.onBeforeStart(() => {
      if (this.isPlaying) {
        this.stop();
      }
    });

    casePlayerEngine.subscribe((snap) => {
      if (snap.isPlaying && this.isPlaying) {
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
      VERIFIED_LIVE_REGIONAL_STATIONS.find((s) => s.id === this.selectedStationId) ??
      VERIFIED_LIVE_REGIONAL_STATIONS[0]
    );
  }

  private computeSegments(): readonly BroadcastTimelineSegment[] {
    const station = this.getSelectedStation();
    return buildBroadcastTimelineSegments({
      sourceMode: this.sourceMode,
      spotMode:
        this.spotMode === 'client_upload' && !this.clientAudioUrl
          ? 'fmworks_example'
          : this.spotMode,
      clientSpotName: this.clientFileName,
      clientSpotDurationSec: this.uploadedDiagnostic?.durationSec ?? null,
      liveStationTitle: `${station.title} (${station.frequencyBadge})`,
    });
  }

  public getSnapshot(): BroadcastAircheckSnapshot {
    const segments = this.computeSegments();
    const totalDurationSec = getTotalBroadcastDurationSec(segments);
    const clampedElapsed = Math.min(totalDurationSec, Math.max(0, this.elapsedSec));
    const resolved = resolveActiveBroadcastSegmentAtTime(segments, clampedElapsed);

    return {
      isPlaying: this.isPlaying,
      sourceMode: this.sourceMode,
      spotMode: this.spotMode,
      selectedStationId: this.selectedStationId,
      liveStreamStatus: this.liveStreamStatus,
      roadNoiseEnabled: this.roadNoiseEnabled,
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
    if (this.selectedStationId === stationId && this.sourceMode === 'live_regional_stream') {
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
    this.elapsedSec = 0;
    this.isPlaying = false;
    this.syncRoadNoise();
    this.emit();
    if (wasPlaying) {
      this.jumpToTargetTransition();
    }
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

  /**
   * Свободная перемотка по клику или перетаскиванию вдоль скульптурной звуковой волны (0..1).
   */
  public seekToRatio(ratio: number): void {
    const segments = this.computeSegments();
    const total = getTotalBroadcastDurationSec(segments);
    if (total <= 0) return;
    const clampedRatio = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
    this.seekToTime(clampedRatio * total);
  }

  public seekToTime(targetTimeSec: number): void {
    const segments = this.computeSegments();
    const total = getTotalBroadcastDurationSec(segments);
    const clamped = Math.max(0, Math.min(Math.max(0, total - 0.25), targetTimeSec));

    if (this.isPlaying && this.htmlAudio) {
      const resolved = resolveActiveBroadcastSegmentAtTime(segments, clamped);
      const targetIdx = segments.findIndex((s) => s.id === resolved.segment.id);
      const isLiveSeg =
        resolved.segment.id === 'program_leadin' &&
        this.sourceMode === 'live_regional_stream' &&
        this.liveStreamStatus !== 'fallback_aircheck';

      if (targetIdx === this.activeSegmentIndex && !isLiveSeg && this.htmlAudio.readyState >= 1) {
        try {
          this.htmlAudio.currentTime = resolved.segmentLocalSec;
          this.segmentInitialOffsetSec = resolved.segmentLocalSec;
          this.segmentWallStartMs = performance.now();
          this.elapsedSec = clamped;
          this.emit();
          return;
        } catch {
          // Fall through to full segment restart
        }
      }
    }

    this.playFromTime(clamped);
  }

  /**
   * Переходит за 2.8 сек до входа в рекламный блок (финал фразы ведущего -> настоящая рекламная склейка ->
   * конкурент №1 -> целевой ролик -> ещё 3 конкурента -> возврат в передачу).
   */
  public jumpToSpliceTransition(): void {
    const segments = this.computeSegments();
    const adJingleSeg = segments.find((s) => s.id === 'ad_jingle_in');
    const spliceStart = adJingleSeg ? Math.max(0, adJingleSeg.startSec - 2.8) : 0;
    this.playFromTime(spliceStart);
  }

  /**
   * Переходит за 3.2 сек до самого целевого слота (конец первого конкурента -> ваш ролик -> 3 конкурента следом),
   * используется сразу после загрузки своего файла для мгновенной проверки стыков.
   */
  public jumpToTargetTransition(): void {
    const segments = this.computeSegments();
    const targetSeg = segments.find((s) => s.id === 'target_spot');
    const startAt = targetSeg ? Math.max(0, targetSeg.startSec - 3.2) : 0;
    this.playFromTime(startAt);
  }

  public pause(): void {
    this.clearAudioAndTimers();
    this.isPlaying = false;
    if (this.liveStreamStatus === 'connecting') {
      this.liveStreamStatus = 'idle';
    }
    this.syncRoadNoise();
    this.emit();
  }

  public stop(): void {
    this.clearAudioAndTimers();
    this.isPlaying = false;
    this.elapsedSec = 0;
    this.liveStreamStatus = 'idle';
    this.syncRoadNoise();
    this.emit();
  }

  public async loadClientAudioFile(file: File): Promise<boolean> {
    this.uploadError = null;

    if (!file) {
      return false;
    }

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

      const channelData = decoded.getChannelData(0);
      const diagnostic = analyzeUploadedSpotSamples({
        fileName: file.name,
        samples: channelData,
        sampleRate: decoded.sampleRate,
      });

      if (this.clientAudioUrl && this.clientAudioUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(this.clientAudioUrl);
        } catch {
          // Ignore revoke errors
        }
      }

      const nextObjectUrl = URL.createObjectURL(file);
      this.clientAudioUrl = nextObjectUrl;
      this.clientFileName = file.name;
      this.uploadedDiagnostic = diagnostic;
      this.spotMode = 'client_upload';
      this.isAnalyzingUpload = false;
      this.uploadError = null;
      this.elapsedSec = 0;
      this.emit();

      // Сразу запускаем воспроизведение с конца конкурента №1 перед роликом клиента
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
    this.uploadedDiagnostic = null;
    this.uploadError = null;
    this.isAnalyzingUpload = false;
    if (this.spotMode === 'client_upload') {
      this.spotMode = 'fmworks_example';
    }
    this.isPlaying = false;
    this.elapsedSec = 0;
    this.syncRoadNoise();
    this.emit();
  }

  private playFromTime(startTimeSec: number): void {
    if (typeof window === 'undefined') return;

    contrastAudioEngine.stopAll();
    casePlayerEngine.stop();

    this.clearAudioAndTimers();

    const segments = this.computeSegments();
    const total = getTotalBroadcastDurationSec(segments);
    const clampedStart = Math.max(0, Math.min(Math.max(0, total - 0.2), startTimeSec));
    const resolved = resolveActiveBroadcastSegmentAtTime(segments, clampedStart);
    const segIdx = Math.max(
      0,
      segments.findIndex((s) => s.id === resolved.segment.id)
    );

    this.isPlaying = true;
    this.elapsedSec = clampedStart;
    this.syncRoadNoise();
    this.emit();

    this.startSegmentAtIndex(segIdx, resolved.segmentLocalSec);
  }

  private resolveSegmentAudioSource(segment: BroadcastTimelineSegment): {
    url: string;
    isLiveStream: boolean;
    fallbackUrl: string | null;
  } {
    const station = this.getSelectedStation();

    switch (segment.id) {
      case 'program_leadin': {
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

      case 'ad_jingle_in':
        return {
          url: AIRCHECK_AUDIO_URLS.adSpliceJingleIn,
          isLiveStream: false,
          fallbackUrl: null,
        };

      case 'competitor_before_1':
        return {
          url: AIRCHECK_AUDIO_URLS.competitorBefore1,
          isLiveStream: false,
          fallbackUrl: null,
        };

      case 'target_spot': {
        if (this.spotMode === 'client_upload' && this.clientAudioUrl) {
          return {
            url: this.clientAudioUrl,
            isLiveStream: false,
            fallbackUrl: AIRCHECK_AUDIO_URLS.fmworksReferenceSpot,
          };
        }
        if (this.spotMode === 'typical_cliche') {
          return {
            url: AIRCHECK_AUDIO_URLS.typicalClicheSpot,
            isLiveStream: false,
            fallbackUrl: null,
          };
        }
        return {
          url: AIRCHECK_AUDIO_URLS.fmworksReferenceSpot,
          isLiveStream: false,
          fallbackUrl: null,
        };
      }

      case 'competitor_after_1':
        return {
          url: AIRCHECK_AUDIO_URLS.competitorAfter1,
          isLiveStream: false,
          fallbackUrl: null,
        };

      case 'competitor_after_2':
        return {
          url: AIRCHECK_AUDIO_URLS.competitorAfter2,
          isLiveStream: false,
          fallbackUrl: null,
        };

      case 'competitor_after_3':
        return {
          url: AIRCHECK_AUDIO_URLS.competitorAfter3,
          isLiveStream: false,
          fallbackUrl: null,
        };

      case 'program_return':
      default:
        return {
          url: AIRCHECK_AUDIO_URLS.broadcastReturnOutro,
          isLiveStream: false,
          fallbackUrl: null,
        };
    }
  }

  private preloadNextSegmentIfNeeded(segments: readonly BroadcastTimelineSegment[]): void {
    if (typeof window === 'undefined') return;
    const nextIdx = this.activeSegmentIndex + 1;
    if (nextIdx >= segments.length) return;

    const nextSeg = segments[nextIdx];
    const nextSource = this.resolveSegmentAudioSource(nextSeg);
    if (nextSource.isLiveStream) return;
    if (this.preloadedNextUrl === nextSource.url && this.preloadedNextAudio) {
      return;
    }

    this.disposePreloadedAudio();
    try {
      const nextAudio = new Audio();
      nextAudio.preload = 'auto';
      nextAudio.volume = 1.0;
      nextAudio.src = nextSource.url;
      nextAudio.load();
      this.preloadedNextAudio = nextAudio;
      this.preloadedNextUrl = nextSource.url;
    } catch {
      this.disposePreloadedAudio();
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

  private startSegmentAtIndex(segIndex: number, offsetSec: number): void {
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

    const source = this.resolveSegmentAudioSource(segment);
    if (source.isLiveStream) {
      this.liveStreamStatus = 'connecting';
    } else if (this.sourceMode !== 'live_regional_stream') {
      this.liveStreamStatus = 'idle';
    }

    this.launchSegmentAudio(segment, source.url, source.isLiveStream, source.fallbackUrl, token);
    this.startSegmentTicker(token);
  }

  private launchSegmentAudio(
    segment: BroadcastTimelineSegment,
    url: string,
    isLiveStream: boolean,
    fallbackUrl: string | null,
    token: number
  ): void {
    if (typeof window === 'undefined') return;

    if (this.htmlAudio) {
      try {
        this.htmlAudio.pause();
        this.htmlAudio.removeAttribute('src');
        this.htmlAudio.load();
      } catch {
        // Ignore cleanup errors
      }
      this.htmlAudio = null;
    }

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
      audio.volume = 1.0;
      audio.src = url;
    }

    this.htmlAudio = audio;

    let switchedToFallback = false;
    const triggerFallbackIfNeeded = () => {
      if (token !== this.sessionToken || switchedToFallback || !fallbackUrl) {
        return;
      }
      switchedToFallback = true;
      this.liveStreamStatus = 'fallback_aircheck';
      this.segmentWallStartMs = performance.now();
      this.emit();
      this.launchSegmentAudio(segment, fallbackUrl, false, null, token);
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
        if (!isLiveStream) {
          this.advanceToNextSegment(token);
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
              ? Math.min(this.segmentInitialOffsetSec, Math.max(0, audio.duration - 0.15))
              : this.segmentInitialOffsetSec;
          audio.currentTime = safeOffset;
        } catch {
          // Ignore seek before buffer
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

      if (seg.durationSec - localElapsed <= 4.5) {
        this.preloadNextSegmentIfNeeded(segments);
      }

      if (localElapsed >= seg.durationSec - 0.04) {
        this.advanceToNextSegment(token);
        return;
      }

      this.emit();
    }, 85);
  }

  private advanceToNextSegment(token: number): void {
    if (token !== this.sessionToken || !this.isPlaying) return;
    const segments = this.computeSegments();
    const nextIdx = this.activeSegmentIndex + 1;
    if (nextIdx >= segments.length) {
      this.finishBroadcastSequence(segments);
      return;
    }
    this.elapsedSec = segments[nextIdx].startSec;
    this.emit();
    this.startSegmentAtIndex(nextIdx, 0);
  }

  private finishBroadcastSequence(segments: readonly BroadcastTimelineSegment[]): void {
    this.clearAudioAndTimers();
    this.isPlaying = false;
    this.elapsedSec = getTotalBroadcastDurationSec(segments);
    if (this.liveStreamStatus === 'connecting') {
      this.liveStreamStatus = 'idle';
    }
    this.syncRoadNoise();
    this.emit();
  }

  private clearAudioAndTimers(): void {
    this.sessionToken += 1;
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
    this.disposePreloadedAudio();
  }

  private syncRoadNoise(): void {
    if (typeof window === 'undefined') return;
    const shouldPlayNoise = this.roadNoiseEnabled && this.isPlaying;

    if (!shouldPlayNoise) {
      if (this.noiseCtx && this.roadGain) {
        try {
          this.roadGain.gain.setTargetAtTime(0.0001, this.noiseCtx.currentTime, 0.08);
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

    if (!this.noiseCtx) {
      const created = createSafeAudioContext();
      if (!created) return;
      this.noiseCtx = created;
      this.roadGain = this.noiseCtx.createGain();
      this.roadGain.gain.value = 0.0001;
      this.roadGain.connect(this.noiseCtx.destination);
    }

    if (this.noiseCtx.state === 'suspended') {
      this.noiseCtx.resume().catch(() => {});
    }

    if (!this.roadSource && this.roadGain) {
      const length = this.noiseCtx.sampleRate * 3;
      const buffer = this.noiseCtx.createBuffer(1, length, this.noiseCtx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.985 * b0 + white * 0.09;
        b1 = 0.95 * b1 + b0 * 0.25;
        data[i] = b1 * 0.9;
      }

      const src = this.noiseCtx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const lowpass = this.noiseCtx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 215;

      const cabinPeak = this.noiseCtx.createBiquadFilter();
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
      this.roadGain.gain.cancelScheduledValues(this.noiseCtx.currentTime);
      this.roadGain.gain.setTargetAtTime(0.16, this.noiseCtx.currentTime, 0.14);
    }
  }
}

export const broadcastAircheckEngine = new BroadcastAircheckEngine();
