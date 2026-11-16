import {
  AUDIOWORKS_FOCUS_ENTRY_SEC,
  AUDIOWORKS_TOTAL_DURATION_SEC,
  AUDIOWORKS_WAV_URL,
} from '../data/audioworksCommercial';
import type { ResolvedHeroStagePlayback } from '../data/heroStageCms';
import {
  applyFmMagneticSnap,
  evaluateFmTunerSignal,
  FM_STUDIO_FREQUENCY,
  FmStationPreset,
} from '../utils/fmTunerEngine';
import {
  computeUnifiedSeekTargets,
  HeroAbPole,
  resolveClutterLoopBounds,
  wrapClutterPlaybackTime,
} from '../utils/heroAbComparison';
import {
  createSafeAudioContext,
  unlockAudioContextOnGesture,
} from './audioContextHelper';
import {
  claimExclusiveAudioFocus,
  onExclusiveAudioFocusClaimed,
} from './audioFocusCoordinator';

const HERO_VOLUME_STORAGE_KEY = 'fmworks_hero_volume_v1';
const HERO_MUTED_STORAGE_KEY = 'fmworks_hero_muted_v1';
const CLUTTER_PROXY_FREQUENCY = 95.2;
const DEFAULT_HERO_VOLUME = 0.85;

function readSavedVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_HERO_VOLUME;
  try {
    const raw = window.localStorage.getItem(HERO_VOLUME_STORAGE_KEY);
    if (raw === null) return DEFAULT_HERO_VOLUME;
    const num = Number.parseFloat(raw);
    return Number.isFinite(num) ? Math.min(1, Math.max(0, num)) : DEFAULT_HERO_VOLUME;
  } catch {
    return DEFAULT_HERO_VOLUME;
  }
}

function readSavedMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(HERO_MUTED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export interface FmTunerAudioSnapshot {
  /** Выбранный базовый полюс сравнения: обычный эфирный ролик или ролик FMWorks */
  abPole: HeroAbPole;
  /** Фактически звучащий полюс (с учётом временного зажатия «Пробела» / Hold-to-Compare) */
  effectivePole: HeroAbPole;
  /** Активно ли зажатие клавиши мгновенного сравнения */
  isPeekComparing: boolean;
  /** Включён ли акустический слой шума автомобиля (70 км/ч) */
  roadNoiseEnabled: boolean;
  frequency: number;
  formattedFrequency: string;
  isLockedOnStudio: boolean;
  studioClarity: number;
  interferenceLevel: number;
  signalBars: number;
  matchedStation: FmStationPreset | null;
  statusText: string;
  /** Активировано ли воспроизведение сравнения пользователем */
  isBroadcastActive: boolean;
  /** Идёт ли сейчас воспроизведение чистого студийного микса FMWorks */
  isStudioPlaying: boolean;
  elapsedSec: number;
  durationSec: number;
  progressRatio: number;
  volume: number;
  isMuted: boolean;
  trackLabel: string | null;
  audioError: string | null;
}

class FmTunerAudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private timeDomainBuffer: Uint8Array<ArrayBuffer> | null = null;

  private radioBedGain: GainNode | null = null;

  private roadLowFilter: BiquadFilterNode | null = null;
  private roadGainNode: GainNode | null = null;

  private studioAudio: HTMLAudioElement | null = null;
  private studioSourceNode: MediaElementAudioSourceNode | null = null;
  private studioGainNode: GainNode | null = null;

  private clutterAudio: HTMLAudioElement | null = null;
  private clutterSourceNode: MediaElementAudioSourceNode | null = null;
  private clutterGainNode: GainNode | null = null;
  private clutterMediaDurationSec: number | null = null;

  private activeStudioUrl = AUDIOWORKS_WAV_URL;
  private activeClutterUrl = AUDIOWORKS_WAV_URL;

  private cmsPlayback: ResolvedHeroStagePlayback | null = null;
  private customAudioUrl: string | null = null;
  private customAudioName: string | null = null;

  private abPole: HeroAbPole = 'studio';
  private peekPoleOverride: HeroAbPole | null = null;
  private roadNoiseEnabled = false;

  private frequency = FM_STUDIO_FREQUENCY;
  private isBroadcastActive = false;
  private playbackEpoch = 0;

  private elapsedSec = 0;
  private durationSec =
    Math.round((AUDIOWORKS_TOTAL_DURATION_SEC - AUDIOWORKS_FOCUS_ENTRY_SEC) * 10) / 10;
  private studioStartSec = AUDIOWORKS_FOCUS_ENTRY_SEC;
  private studioEndSec: number | null = null;
  private audioError: string | null = null;

  private volume = readSavedVolume();
  private lastNonZeroVolume = this.volume > 0.02 ? this.volume : DEFAULT_HERO_VOLUME;
  private isMuted = readSavedMuted();

  private pollTimerId: number | null = null;
  private listeners = new Set<(snap: FmTunerAudioSnapshot) => void>();

  constructor() {
    onExclusiveAudioFocusClaimed((channel) => {
      if (channel !== 'contrast_hero' && this.isBroadcastActive) {
        this.pauseBroadcast();
      }
    });
  }

  private getEffectivePole(): HeroAbPole {
    return this.peekPoleOverride ?? this.abPole;
  }

  public subscribe(listener: (snap: FmTunerAudioSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): FmTunerAudioSnapshot {
    const effectivePole = this.getEffectivePole();
    const mappedFreq =
      effectivePole === 'studio' ? FM_STUDIO_FREQUENCY : CLUTTER_PROXY_FREQUENCY;
    const sig = evaluateFmTunerSignal(mappedFreq);
    const span = Math.max(1, this.durationSec);
    const progressRatio = Math.min(1, Math.max(0, this.elapsedSec / span));
    const isStudioMode = effectivePole === 'studio';

    return {
      ...sig,
      abPole: this.abPole,
      effectivePole,
      isPeekComparing: this.peekPoleOverride !== null,
      roadNoiseEnabled: this.roadNoiseEnabled,
      frequency: mappedFreq,
      isLockedOnStudio: isStudioMode,
      isBroadcastActive: this.isBroadcastActive,
      isStudioPlaying: this.isBroadcastActive && isStudioMode,
      elapsedSec: this.elapsedSec,
      durationSec: this.durationSec,
      progressRatio,
      volume: this.volume,
      isMuted: this.isMuted,
      trackLabel:
        this.customAudioName ??
        (this.cmsPlayback && this.cmsPlayback.focus.sourceKind !== 'default_reel'
          ? this.cmsPlayback.focus.label
          : null),
      audioError: this.audioError,
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  private getEffectiveVolume(): number {
    return this.isMuted ? 0 : Math.min(1, Math.max(0, this.volume));
  }

  public syncCmsHeroStage(resolved: ResolvedHeroStagePlayback): void {
    const prevUrl = this.cmsPlayback?.focus.audioUrl ?? null;
    this.cmsPlayback = resolved;

    if (!this.customAudioUrl) {
      this.studioStartSec = resolved.focus.startSec;
      this.studioEndSec = resolved.focus.endSec;
      this.durationSec = Math.max(1, resolved.focus.durationSec);
      if (prevUrl && prevUrl !== resolved.focus.audioUrl && this.isBroadcastActive) {
        this.pauseBroadcast();
        return;
      }
    }
    this.emit();
  }

  public setCustomShowreel(objectUrl: string, fileName: string, autoPlay = false): void {
    const prevCustom = this.customAudioUrl;
    if (prevCustom && prevCustom.startsWith('blob:') && prevCustom !== objectUrl) {
      try {
        URL.revokeObjectURL(prevCustom);
      } catch {
        // Ignore revoke error
      }
    }
    this.customAudioUrl = objectUrl;
    this.customAudioName = fileName;
    this.studioStartSec = 0;
    this.studioEndSec = null;
    this.elapsedSec = 0;
    if (autoPlay) {
      this.selectAbPole('studio', true);
    } else {
      this.emit();
    }
  }

  public resetCustomShowreel(): void {
    const prevCustom = this.customAudioUrl;
    this.customAudioUrl = null;
    this.customAudioName = null;
    if (prevCustom && prevCustom.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(prevCustom);
      } catch {
        // Ignore revoke error
      }
    }
    this.pauseBroadcast();
    if (this.cmsPlayback) {
      this.studioStartSec = this.cmsPlayback.focus.startSec;
      this.studioEndSec = this.cmsPlayback.focus.endSec;
      this.durationSec = Math.max(1, this.cmsPlayback.focus.durationSec);
    } else {
      this.studioStartSec = AUDIOWORKS_FOCUS_ENTRY_SEC;
      this.studioEndSec = null;
      this.durationSec =
        Math.round((AUDIOWORKS_TOTAL_DURATION_SEC - AUDIOWORKS_FOCUS_ENTRY_SEC) * 10) / 10;
    }
    this.elapsedSec = 0;
    this.emit();
  }

  private getActiveStudioTarget(): {
    url: string;
    startSec: number;
    endSec: number | null;
    durationSec: number;
  } {
    if (this.customAudioUrl) {
      return {
        url: this.customAudioUrl,
        startSec: 0,
        endSec: null,
        durationSec: this.durationSec,
      };
    }
    if (this.cmsPlayback) {
      return {
        url: this.cmsPlayback.focus.audioUrl,
        startSec: this.cmsPlayback.focus.startSec,
        endSec: this.cmsPlayback.focus.endSec,
        durationSec: this.cmsPlayback.focus.durationSec,
      };
    }
    return {
      url: AUDIOWORKS_WAV_URL,
      startSec: AUDIOWORKS_FOCUS_ENTRY_SEC,
      endSec: null,
      durationSec: AUDIOWORKS_TOTAL_DURATION_SEC - AUDIOWORKS_FOCUS_ENTRY_SEC,
    };
  }

  private getCurrentClutterBounds() {
    const isCustomUpload = this.cmsPlayback?.clutter.mode === 'custom_upload';
    const configuredStartSec = this.cmsPlayback?.clutter.startSec ?? 1.2;
    const configuredDurationSec = this.cmsPlayback?.clutter.durationSec ?? 4.2;
    return resolveClutterLoopBounds({
      isCustomUpload,
      configuredStartSec,
      configuredDurationSec,
      mediaDurationSec: this.clutterMediaDurationSec,
    });
  }

  private ensureWebAudioGraph(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const created = createSafeAudioContext();
      if (!created) return null;
      this.ctx = created;

      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.80;
      analyser.connect(this.ctx.destination);
      this.analyser = analyser;
      this.timeDomainBuffer = new Uint8Array(new ArrayBuffer(analyser.fftSize));

      const sampleRate = this.ctx.sampleRate;
      const bufLen = sampleRate * 2;

      // 1. Тонкая эфирная подложка типичного FM-тракта (только для режима «Обычный эфир»)
      const radioBuf = this.ctx.createBuffer(1, bufLen, sampleRate);
      const radioOut = radioBuf.getChannelData(0);
      let r0 = 0;
      let r1 = 0;
      for (let i = 0; i < bufLen; i++) {
        const white = Math.random() * 2 - 1;
        r0 = 0.992 * r0 + white * 0.04;
        r1 = 0.960 * r1 + white * 0.06;
        radioOut[i] = Math.max(-1, Math.min(1, (r0 + r1 + white * 0.12) * 0.9));
      }
      const radioSrc = this.ctx.createBufferSource();
      radioSrc.buffer = radioBuf;
      radioSrc.loop = true;

      const radioFilter = this.ctx.createBiquadFilter();
      radioFilter.type = 'bandpass';
      radioFilter.frequency.value = 1450;
      radioFilter.Q.value = 1.1;

      const radioGain = this.ctx.createGain();
      radioGain.gain.value = 0.0001;

      radioSrc.connect(radioFilter);
      radioFilter.connect(radioGain);
      radioGain.connect(analyser);
      radioSrc.start(0);

      this.radioBedGain = radioGain;

      // 2. Реалистичный акустический гул салона автомобиля (70 км/ч: шины + низкочастотный резонанс кузова)
      const roadBuf = this.ctx.createBuffer(1, bufLen, sampleRate);
      const roadOut = roadBuf.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < bufLen; i++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + 0.024 * white) / 1.024;
        const cabinHum =
          Math.sin((2 * Math.PI * 86 * i) / sampleRate) * 0.09 +
          Math.sin((2 * Math.PI * 134 * i) / sampleRate) * 0.045;
        roadOut[i] = Math.max(-1, Math.min(1, brown * 2.7 + cabinHum));
      }

      const roadSrc = this.ctx.createBufferSource();
      roadSrc.buffer = roadBuf;
      roadSrc.loop = true;

      const roadFilter = this.ctx.createBiquadFilter();
      roadFilter.type = 'lowpass';
      roadFilter.frequency.value = 285;
      roadFilter.Q.value = 0.85;

      const roadGain = this.ctx.createGain();
      roadGain.gain.value = 0.0001;

      roadSrc.connect(roadFilter);
      roadFilter.connect(roadGain);
      roadGain.connect(analyser);
      roadSrc.start(0);

      this.roadLowFilter = roadFilter;
      this.roadGainNode = roadGain;
    }

    unlockAudioContextOnGesture(this.ctx);
    return this.ctx;
  }

  /** Возвращает активный узел AnalyserNode Web Audio API для осциллографа */
  public getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  /** Считывает форму аудиосигнала во временной области (getByteTimeDomainData) без аллокаций */
  public readAnalyserTimeDomainData(): Uint8Array | null {
    if (!this.analyser || !this.ctx || this.ctx.state !== 'running') {
      return null;
    }
    if (!this.timeDomainBuffer || this.timeDomainBuffer.length !== this.analyser.fftSize) {
      this.timeDomainBuffer = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
    }
    try {
      this.analyser.getByteTimeDomainData(this.timeDomainBuffer);
      return this.timeDomainBuffer;
    } catch {
      return null;
    }
  }

  private connectStudioMediaGraph(audio: HTMLAudioElement): void {
    if (!this.ctx || !this.analyser || this.studioSourceNode) return;
    try {
      const source = this.ctx.createMediaElementSource(audio);
      const gain = this.ctx.createGain();
      gain.gain.value = this.getEffectivePole() === 'studio' ? this.getEffectiveVolume() : 0;
      source.connect(gain);
      gain.connect(this.analyser);
      this.studioSourceNode = source;
      this.studioGainNode = gain;
    } catch {
      // Fallback to direct HTMLAudioElement output
    }
  }

  private connectClutterMediaGraph(audio: HTMLAudioElement): void {
    if (!this.ctx || !this.analyser || this.clutterSourceNode) return;
    try {
      const source = this.ctx.createMediaElementSource(audio);
      // Сужаем АЧХ «Обычного эфира» до плоской середины типового потокового ролика
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1280;
      filter.Q.value = 0.68;

      const gain = this.ctx.createGain();
      gain.gain.value =
        this.getEffectivePole() === 'clutter' ? this.getEffectiveVolume() * 0.74 : 0;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.analyser);

      this.clutterSourceNode = source;
      this.clutterGainNode = gain;
    } catch {
      // Fallback to direct HTMLAudioElement output
    }
  }

  /** Тихий тактильный щелчок тумблера сравнения (как алюминиевый селектор B&O) */
  public playStudioSnapClick(targetPole: HeroAbPole = 'studio'): void {
    const ctx = this.ensureWebAudioGraph();
    if (!ctx || this.isMuted || this.volume <= 0.02) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const startHz = targetPole === 'studio' ? 1120 : 760;
      const endHz = targetPole === 'studio' ? 210 : 155;
      osc.frequency.setValueAtTime(startHz, now);
      osc.frequency.exponentialRampToValueAtTime(endHz, now + 0.024);

      const level = 0.11 * this.getEffectiveVolume();
      gain.gain.setValueAtTime(Math.max(0.0001, level), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

      osc.connect(gain);
      gain.connect(this.analyser ?? ctx.destination);
      osc.start(now);
      osc.stop(now + 0.034);
    } catch {
      // Ignore WebAudio transient errors
    }
  }

  private applySafeAudioCrossOrigin(audio: HTMLAudioElement, url: string): void {
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      audio.removeAttribute('crossorigin');
    } else {
      audio.crossOrigin = 'anonymous';
    }
  }

  private ensureStudioAudio(url: string): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.studioAudio) {
      const audio = new Audio();
      this.applySafeAudioCrossOrigin(audio, url);
      audio.preload = 'auto';
      audio.src = url;
      this.activeStudioUrl = url;

      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
          const boundEnd =
            this.studioEndSec !== null
              ? Math.min(audio.duration, this.studioEndSec)
              : audio.duration;
          this.durationSec = Math.max(1, Math.round((boundEnd - this.studioStartSec) * 10) / 10);
          this.emit();
        }
      });

      audio.addEventListener('ended', () => {
        this.isBroadcastActive = false;
        this.peekPoleOverride = null;
        this.elapsedSec = 0;
        this.clutterAudio?.pause();
        this.stopPolling();
        this.syncAllAudioNodes();
        this.emit();
      });

      this.studioAudio = audio;
    } else if (this.activeStudioUrl !== url) {
      this.studioAudio.pause();
      this.applySafeAudioCrossOrigin(this.studioAudio, url);
      this.studioAudio.src = url;
      this.studioAudio.load();
      this.activeStudioUrl = url;
    }
    return this.studioAudio;
  }

  private ensureClutterAudio(url: string): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.clutterAudio) {
      const audio = new Audio();
      this.applySafeAudioCrossOrigin(audio, url);
      audio.preload = 'auto';
      audio.loop = true;
      audio.src = url;
      this.activeClutterUrl = url;

      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
          this.clutterMediaDurationSec = audio.duration;
        }
      });

      audio.addEventListener('timeupdate', () => {
        if (!this.isBroadcastActive) return;
        const bounds = this.getCurrentClutterBounds();
        const wrap = wrapClutterPlaybackTime(audio.currentTime, bounds);
        if (wrap.shouldSeek) {
          try {
            audio.currentTime = wrap.targetTimeSec;
          } catch {
            // Ignore seek before ready
          }
        }
      });

      this.clutterAudio = audio;
    } else if (this.activeClutterUrl !== url) {
      this.clutterAudio.pause();
      this.clutterMediaDurationSec = null;
      this.applySafeAudioCrossOrigin(this.clutterAudio, url);
      this.clutterAudio.src = url;
      this.clutterAudio.load();
      this.activeClutterUrl = url;
    }
    return this.clutterAudio;
  }

  private syncAllAudioNodes(): void {
    const vol = this.getEffectiveVolume();
    const effectivePole = this.getEffectivePole();
    const isActive = this.isBroadcastActive && !this.isMuted && vol > 0.005;

    const studioTargetGain = isActive && effectivePole === 'studio' ? vol : 0;
    const clutterTargetGain = isActive && effectivePole === 'clutter' ? vol * 0.76 : 0;

    if (this.studioAudio) {
      if (this.studioGainNode && this.ctx) {
        this.studioAudio.volume = 1;
        this.studioAudio.muted = false;
        try {
          this.studioGainNode.gain.setTargetAtTime(
            studioTargetGain,
            this.ctx.currentTime,
            0.018
          );
        } catch {
          this.studioGainNode.gain.value = studioTargetGain;
        }
      } else {
        this.studioAudio.volume = studioTargetGain;
        this.studioAudio.muted = !isActive || effectivePole !== 'studio';
      }
    }

    if (this.clutterAudio) {
      if (this.clutterGainNode && this.ctx) {
        this.clutterAudio.volume = 1;
        this.clutterAudio.muted = false;
        try {
          this.clutterGainNode.gain.setTargetAtTime(
            clutterTargetGain,
            this.ctx.currentTime,
            0.018
          );
        } catch {
          this.clutterGainNode.gain.value = clutterTargetGain;
        }
      } else {
        this.clutterAudio.volume = clutterTargetGain;
        this.clutterAudio.muted = !isActive || effectivePole !== 'clutter';
      }
    }

    if (this.ctx && this.radioBedGain) {
      const radioHiss =
        isActive && effectivePole === 'clutter' ? Math.max(0.0001, vol * 0.048) : 0.0001;
      try {
        this.radioBedGain.gain.setTargetAtTime(radioHiss, this.ctx.currentTime, 0.025);
      } catch {
        this.radioBedGain.gain.value = radioHiss;
      }
    }

    if (this.ctx && this.roadGainNode && this.roadLowFilter) {
      // В режиме «Обычный эфир» дорожный шум сильнее маскирует плоскую середину, чем чистый голос FMWorks
      const roadLevel =
        isActive && this.roadNoiseEnabled
          ? Math.max(0.0001, vol * (effectivePole === 'clutter' ? 0.34 : 0.24))
          : 0.0001;
      try {
        this.roadLowFilter.frequency.setTargetAtTime(
          effectivePole === 'clutter' ? 340 : 265,
          this.ctx.currentTime,
          0.03
        );
        this.roadGainNode.gain.setTargetAtTime(roadLevel, this.ctx.currentTime, 0.03);
      } catch {
        this.roadGainNode.gain.value = roadLevel;
      }
    }
  }

  private startPolling(): void {
    if (typeof window === 'undefined' || this.pollTimerId !== null) return;
    this.pollTimerId = window.setInterval(() => {
      if (!this.isBroadcastActive) return;

      if (this.clutterAudio && !this.clutterAudio.paused) {
        const bounds = this.getCurrentClutterBounds();
        const wrap = wrapClutterPlaybackTime(this.clutterAudio.currentTime, bounds);
        if (wrap.shouldSeek) {
          try {
            this.clutterAudio.currentTime = wrap.targetTimeSec;
          } catch {
            // Ignore transient seek error
          }
        }
      }

      if (this.studioAudio && !this.studioAudio.paused) {
        const absTime = this.studioAudio.currentTime || 0;
        if (this.studioEndSec !== null && absTime >= this.studioEndSec) {
          this.pauseBroadcast();
          this.elapsedSec = 0;
          this.emit();
          return;
        }
        this.elapsedSec = Math.max(0, absTime - this.studioStartSec);
        this.emit();
      }
    }, 110);
  }

  private stopPolling(): void {
    if (this.pollTimerId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.pollTimerId);
      this.pollTimerId = null;
    }
  }

  private startDualSynchronizedStreams(): void {
    this.audioError = null;
    const studioTarget = this.getActiveStudioTarget();
    this.studioStartSec = studioTarget.startSec;
    this.studioEndSec = studioTarget.endSec;
    this.durationSec = Math.max(1, studioTarget.durationSec);

    const clutterUrl = this.cmsPlayback?.clutter.audioUrl || AUDIOWORKS_WAV_URL;

    const sAudio = this.ensureStudioAudio(studioTarget.url);
    const cAudio = this.ensureClutterAudio(clutterUrl);
    if (!sAudio || !cAudio) return;

    this.connectStudioMediaGraph(sAudio);
    this.connectClutterMediaGraph(cAudio);

    const epoch = ++this.playbackEpoch;
    const bounds = this.getCurrentClutterBounds();
    const resumeElapsed =
      this.elapsedSec > 0.25 && this.elapsedSec < this.durationSec - 0.4
        ? this.elapsedSec
        : 0;
    const studioResumeSec = studioTarget.startSec + resumeElapsed;
    const clutterResumeSec =
      bounds.startSec + (bounds.spanSec > 0.2 ? resumeElapsed % bounds.spanSec : 0);

    const launchStudio = () => {
      if (this.playbackEpoch !== epoch || !this.isBroadcastActive) return;
      try {
        if (Math.abs(sAudio.currentTime - studioResumeSec) > 0.35) {
          sAudio.currentTime = studioResumeSec;
        }
      } catch {
        // Ignore seek before metadata
      }
      this.syncAllAudioNodes();
      const p = sAudio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          if (this.playbackEpoch !== epoch) return;
          this.isBroadcastActive = false;
          this.audioError = 'Нажмите Play ещё раз, чтобы разрешить звук в браузере';
          this.stopPolling();
          this.syncAllAudioNodes();
          this.emit();
        });
      }
    };

    const launchClutter = () => {
      if (this.playbackEpoch !== epoch || !this.isBroadcastActive) return;
      try {
        const wrap = wrapClutterPlaybackTime(cAudio.currentTime, bounds);
        if (wrap.shouldSeek || Math.abs(cAudio.currentTime - clutterResumeSec) > 1.5) {
          cAudio.currentTime = clutterResumeSec;
        }
      } catch {
        // Ignore seek before metadata
      }
      this.syncAllAudioNodes();
      void cAudio.play().catch(() => {});
    };

    this.startPolling();

    if (sAudio.readyState >= 1) {
      launchStudio();
    } else {
      sAudio.addEventListener('loadedmetadata', launchStudio, { once: true });
      sAudio.load();
    }

    if (cAudio.readyState >= 1) {
      launchClutter();
    } else {
      cAudio.addEventListener('loadedmetadata', launchClutter, { once: true });
      cAudio.load();
    }
  }

  /**
   * Мгновенно переключает полюс сравнения «Обычный эфир ↔ Ролик FMWorks» на той же доле секунды
   * через бесшовный 18ms кроссфейд Web Audio API без сброса позиции ролика.
   */
  public selectAbPole(nextPole: HeroAbPole, autoStartIfIdle = true): void {
    claimExclusiveAudioFocus('contrast_hero');
    this.ensureWebAudioGraph();

    const changed = this.abPole !== nextPole;
    this.abPole = nextPole;
    this.peekPoleOverride = null;
    this.frequency = nextPole === 'studio' ? FM_STUDIO_FREQUENCY : CLUTTER_PROXY_FREQUENCY;

    if (changed) {
      this.playStudioSnapClick(nextPole);
    }

    if (!this.isBroadcastActive && autoStartIfIdle) {
      this.isBroadcastActive = true;
      this.startDualSynchronizedStreams();
    } else {
      this.syncAllAudioNodes();
    }
    this.emit();
  }

  /** Включает или ставит на паузу синхронное A/B-прослушивание */
  public togglePlayPause(): void {
    if (this.isBroadcastActive) {
      this.pauseBroadcast();
      return;
    }
    claimExclusiveAudioFocus('contrast_hero');
    this.ensureWebAudioGraph();
    this.isBroadcastActive = true;
    this.playStudioSnapClick(this.getEffectivePole());
    this.startDualSynchronizedStreams();
    this.syncAllAudioNodes();
    this.emit();
  }

  /**
   * Режим Hold-to-Compare (удержание клавиши Пробел / кнопки быстрого сравнения):
   * пока зажато — временно включает противоположный полюс на текущей миллисекунде;
   * при отпускании — мгновенно возвращает исходный полюс.
   */
  public setPeekComparisonActive(active: boolean): void {
    if (active) {
      if (this.peekPoleOverride !== null) return;
      const opposite: HeroAbPole = this.abPole === 'studio' ? 'clutter' : 'studio';
      this.peekPoleOverride = opposite;
      if (this.isBroadcastActive) {
        this.playStudioSnapClick(opposite);
      }
    } else {
      if (this.peekPoleOverride === null) return;
      this.peekPoleOverride = null;
      if (this.isBroadcastActive) {
        this.playStudioSnapClick(this.abPole);
      }
    }
    this.syncAllAudioNodes();
    this.emit();
  }

  /** Включает/выключает реалистичный акустический фон салона авто (70 км/ч) */
  public toggleRoadNoise(): void {
    this.ensureWebAudioGraph();
    this.roadNoiseEnabled = !this.roadNoiseEnabled;
    this.syncAllAudioNodes();
    this.emit();
  }

  public setRoadNoise(enabled: boolean): void {
    if (this.roadNoiseEnabled === enabled) return;
    this.ensureWebAudioGraph();
    this.roadNoiseEnabled = enabled;
    this.syncAllAudioNodes();
    this.emit();
  }

  /** Совместимость с прежними вызовами */
  public tuneToStudioAndPlay(): void {
    if (this.isBroadcastActive && this.abPole === 'studio') {
      this.pauseBroadcast();
      return;
    }
    this.selectAbPole('studio', true);
  }

  public selectPreset(station: FmStationPreset): void {
    this.selectAbPole(station.kind === 'studio' ? 'studio' : 'clutter', true);
  }

  public setFrequency(rawFreq: number, phase: 'drag' | 'commit' | 'step' | 'physics' = 'drag'): void {
    const snapped = applyFmMagneticSnap(rawFreq, phase);
    const sig = evaluateFmTunerSignal(snapped);
    this.frequency = snapped;
    this.selectAbPole(sig.isLockedOnStudio ? 'studio' : 'clutter', this.isBroadcastActive);
  }

  public stepFrequency(deltaMhz: number): void {
    this.setFrequency(this.frequency + deltaMhz, 'step');
  }

  public pauseBroadcast(): void {
    this.playbackEpoch += 1;
    this.isBroadcastActive = false;
    this.peekPoleOverride = null;
    this.studioAudio?.pause();
    this.clutterAudio?.pause();
    this.stopPolling();
    this.syncAllAudioNodes();
    this.emit();
  }

  public seekStudioRatio(ratio: number): void {
    const studioTarget = this.getActiveStudioTarget();
    this.studioStartSec = studioTarget.startSec;
    this.studioEndSec = studioTarget.endSec;
    this.durationSec = Math.max(1, studioTarget.durationSec);

    const bounds = this.getCurrentClutterBounds();
    const targets = computeUnifiedSeekTargets({
      ratio,
      studioStartSec: this.studioStartSec,
      studioDurationSec: this.durationSec,
      clutterBounds: bounds,
    });

    this.elapsedSec = targets.studioElapsedSec;

    if (this.studioAudio && this.studioAudio.readyState >= 1) {
      try {
        this.studioAudio.currentTime = targets.studioTargetTimeSec;
      } catch {
        // Ignore seek error
      }
    }
    if (this.clutterAudio && this.clutterAudio.readyState >= 1) {
      try {
        this.clutterAudio.currentTime = targets.clutterTargetTimeSec;
      } catch {
        // Ignore seek error
      }
    }

    if (!this.isBroadcastActive) {
      claimExclusiveAudioFocus('contrast_hero');
      this.ensureWebAudioGraph();
      this.isBroadcastActive = true;
      this.startDualSynchronizedStreams();
    } else {
      this.syncAllAudioNodes();
    }
    this.emit();
  }

  public stepStudioSeconds(deltaSec: number): void {
    const dur = Math.max(1, this.durationSec);
    const nextRatio = (this.elapsedSec + deltaSec) / dur;
    this.seekStudioRatio(nextRatio);
  }

  public setVolume(nextVol: number): void {
    const clamped = Math.min(1, Math.max(0, Number.isFinite(nextVol) ? nextVol : DEFAULT_HERO_VOLUME));
    this.volume = clamped;
    if (clamped > 0.01) {
      this.lastNonZeroVolume = clamped;
      this.isMuted = false;
    } else {
      this.isMuted = true;
    }
    try {
      window.localStorage.setItem(HERO_VOLUME_STORAGE_KEY, this.volume.toFixed(2));
      window.localStorage.setItem(HERO_MUTED_STORAGE_KEY, this.isMuted ? '1' : '0');
    } catch {
      // Ignore storage error
    }
    this.syncAllAudioNodes();
    this.emit();
  }

  public toggleMute(): void {
    if (this.isMuted) {
      this.isMuted = false;
      if (this.volume <= 0.01) {
        this.volume = this.lastNonZeroVolume;
      }
    } else {
      if (this.volume > 0.01) {
        this.lastNonZeroVolume = this.volume;
      }
      this.isMuted = true;
    }
    try {
      window.localStorage.setItem(HERO_VOLUME_STORAGE_KEY, this.volume.toFixed(2));
      window.localStorage.setItem(HERO_MUTED_STORAGE_KEY, this.isMuted ? '1' : '0');
    } catch {
      // Ignore storage error
    }
    this.syncAllAudioNodes();
    this.emit();
  }

  public stopAll(): void {
    this.pauseBroadcast();
  }
}

export const fmTunerAudioEngine = new FmTunerAudioEngine();
