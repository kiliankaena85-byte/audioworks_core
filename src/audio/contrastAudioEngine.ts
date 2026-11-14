import {
  AUDIOWORKS_FOCUS_ENTRY_SEC,
  AUDIOWORKS_TOTAL_DURATION_SEC,
  AUDIOWORKS_WAV_URL,
  CommercialChapter,
  CommercialStageMode,
  CRASH_TEST_CLUTTER_DURATION_SEC,
  CRASH_TEST_TOTAL_INTRO_SEC,
  CrashTestPhase,
  getCommercialStateAtTime,
  getCrashTestPhaseAtElapsed,
} from '../data/audioworksCommercial';
import { LayaPersonaSlot } from '../engine/layaTypes';
import { createSafeAudioContext } from './audioContextHelper';
import { duelAudioStore } from './duelAudioStore';

export type StageMode = CommercialStageMode;

export interface ContrastStageSnapshot {
  /** Текущая визуально-звуковая фаза сцены */
  mode: StageMode;
  /** Играет ли сейчас полный студийный шоурил AudioWorks */
  isFilmPlaying: boolean;
  /** Активен ли звук сцены в данный момент */
  isSoundPlaying: boolean;
  /** Включён ли тумблер «🚗 Шум дороги» */
  roadNoiseEnabled: boolean;
  /** Прошедшее время студийного ролика */
  filmElapsedSec: number;
  /** Полная длительность текущего ролика */
  filmDurationSec: number;
  /** Сколько крупных слов уже отпечаталось в такт диктору */
  revealedWordsCount: number;
  /** Текущая синхронная глава ролика */
  activeChapter: CommercialChapter | null;
  /** Подключён ли пользовательский локальный аудиофайл (.mp3 / .wav) */
  hasCustomAudio: boolean;
  /** Имя загруженного пользовательского шоурила */
  customAudioName: string | null;
  /** Фаза эфирного краш-теста на первом экране HeroKotoLens */
  crashPhase: CrashTestPhase;
  /** Секундомер с момента запуска краш-теста (0..4.5+) */
  crashElapsedSec: number;
  /** Раскрыта ли круглая линза внимания на 100% площади экрана */
  isLensExpanded: boolean;
}

type SnapshotListener = (snap: ContrastStageSnapshot) => void;

class ContrastAudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaElementSource: MediaElementAudioSourceNode | null = null;
  private roadGain: GainNode | null = null;
  private roadSource: AudioBufferSourceNode | null = null;
  private clutterNodes: AudioNode[] = [];

  private tickIntervalId: number | null = null;
  private crashTimerId: number | null = null;
  private crashStartedAtMs = 0;
  private stopSegmentAtSec: number | null = null;
  private htmlAudio: HTMLAudioElement | null = null;
  private activeSrcUrl: string = AUDIOWORKS_WAV_URL;

  private customAudioUrl: string | null = null;
  private customAudioName: string | null = null;

  private mode: StageMode = 'stream';
  private isFilmPlaying = false;
  private isSoundPlaying = false;
  private roadNoiseEnabled = false;
  private forceClutterRoadNoise = false;
  private filmElapsedSec = 0;
  private filmDurationSec = AUDIOWORKS_TOTAL_DURATION_SEC;
  private revealedWordsCount = 0;
  private activeChapter: CommercialChapter | null = null;
  private totalFocusWords = 8;

  private crashPhase: CrashTestPhase = 'idle';
  private crashElapsedSec = 0;
  private isLensExpanded = false;

  private listeners = new Set<SnapshotListener>();
  private onStartHooks = new Set<() => void>();

  public onBeforeStart(cb: () => void): () => void {
    this.onStartHooks.add(cb);
    return () => this.onStartHooks.delete(cb);
  }

  public subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): ContrastStageSnapshot {
    return {
      mode: this.mode,
      isFilmPlaying: this.isFilmPlaying,
      isSoundPlaying: this.isSoundPlaying,
      roadNoiseEnabled: this.roadNoiseEnabled,
      filmElapsedSec: this.filmElapsedSec,
      filmDurationSec: this.filmDurationSec,
      revealedWordsCount: this.revealedWordsCount,
      activeChapter: this.activeChapter,
      hasCustomAudio: this.customAudioUrl !== null,
      customAudioName: this.customAudioName,
      crashPhase: this.crashPhase,
      crashElapsedSec: this.crashElapsedSec,
      isLensExpanded: this.isLensExpanded,
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  public syncPersonaConfig(
    _preset: LayaPersonaSlot['focusChordPreset'],
    wordsCount: number
  ): void {
    this.totalFocusWords = wordsCount;
    if (this.mode === 'focus' && !this.isFilmPlaying && !this.isSoundPlaying) {
      this.revealedWordsCount = wordsCount;
      this.emit();
    }
  }

  private getPreferredFocusAudio(): {
    url: string;
    startSec: number;
    endSec: number | null;
  } {
    if (this.customAudioUrl) {
      return { url: this.customAudioUrl, startSec: 0, endSec: null };
    }
    const duelSnap = duelAudioStore.getSnapshot();
    if (duelSnap.audioworksTrack) {
      return {
        url: duelSnap.audioworksTrack.objectUrl,
        startSec: 0,
        endSec: duelSnap.audioworksTrack.effectiveDurationSec,
      };
    }
    return {
      url: AUDIOWORKS_WAV_URL,
      startSec: AUDIOWORKS_FOCUS_ENTRY_SEC,
      endSec: null,
    };
  }

  private ensureAudioGraph(): AudioContext | null {
    if (!this.ctx) {
      const created = createSafeAudioContext();
      if (!created) return null;
      this.ctx = created;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.82;
      this.analyser.connect(this.ctx.destination);

      this.roadGain = this.ctx.createGain();
      this.roadGain.gain.value = 0.0001;
      this.roadGain.connect(this.analyser);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (this.htmlAudio && !this.mediaElementSource && this.analyser) {
      try {
        this.mediaElementSource = this.ctx.createMediaElementSource(this.htmlAudio);
        this.mediaElementSource.connect(this.analyser);
      } catch {
        // Fallback if MediaElementSource already attached or unsupported
      }
    }

    return this.ctx;
  }

  private ensureHtmlAudio(targetUrl?: string): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    const desiredUrl = targetUrl ?? this.activeSrcUrl;
    if (!this.htmlAudio) {
      const audio = new Audio(desiredUrl);
      audio.preload = 'metadata';
      audio.volume = 1.0;
      this.activeSrcUrl = desiredUrl;

      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
          this.filmDurationSec =
            this.stopSegmentAtSec !== null
              ? Math.min(audio.duration, this.stopSegmentAtSec)
              : audio.duration;
          this.emit();
        }
      });

      audio.addEventListener('ended', () => {
        this.finishPlaybackOnFocusFrame();
      });

      this.htmlAudio = audio;
    } else if (targetUrl && this.activeSrcUrl !== targetUrl) {
      this.htmlAudio.pause();
      this.htmlAudio.src = targetUrl;
      this.htmlAudio.load();
      this.activeSrcUrl = targetUrl;
    }
    return this.htmlAudio;
  }

  private stopSynthClutterNodes(): void {
    const nodes = [...this.clutterNodes];
    this.clutterNodes = [];
    nodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
          (node as OscillatorNode).stop();
        }
        node.disconnect();
      } catch {
        // Ignore already stopped nodes
      }
    });
  }

  private playSynthClutterBed(durationSec: number): void {
    const ctx = this.ensureAudioGraph();
    if (!ctx || !this.analyser) return;
    this.stopSynthClutterNodes();

    // Глухой сжатый радийный фон с торопливой модуляцией (используется как фоллбэк, если выбран кастомный шоурил без трека радио)
    const now = ctx.currentTime;
    const bandGain = ctx.createGain();
    bandGain.gain.setValueAtTime(0.001, now);
    bandGain.gain.linearRampToValueAtTime(0.09, now + 0.15);
    bandGain.gain.setValueAtTime(0.085, now + Math.max(0.2, durationSec - 0.12));
    bandGain.gain.linearRampToValueAtTime(0.0001, now + durationSec);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 920;
    bp.Q.value = 1.9;

    bp.connect(bandGain);
    bandGain.connect(this.analyser);
    this.clutterNodes.push(bp, bandGain);

    const notes = [220, 277.18, 329.63, 246.94, 293.66, 369.99];
    const step = 0.24;
    const count = Math.floor(durationSec / step);
    for (let i = 0; i < count; i++) {
      const t0 = now + i * step;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[i % notes.length], t0);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.28, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.02, t0 + step * 0.92);
      osc.connect(g);
      g.connect(bp);
      osc.start(t0);
      osc.stop(t0 + step);
      this.clutterNodes.push(osc, g);
    }
  }

  private playTapeStopCue(): void {
    const ctx = this.ensureAudioGraph();
    if (!ctx || !this.analyser) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.18);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(g);
    g.connect(this.analyser);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  /**
   * Подключает пользовательский аудиофайл (.mp3 / .wav через `URL.createObjectURL(file)`)
   * напрямую к главной сцене и живому анализатору спектра `AnalyserNode`.
   */
  public loadCustomShowreel(objectUrl: string, fileName: string, autoPlay = true): void {
    this.onStartHooks.forEach((fn) => fn());
    this.clearPlaybackOnly();

    if (
      this.customAudioUrl &&
      this.customAudioUrl.startsWith('blob:') &&
      this.customAudioUrl !== objectUrl
    ) {
      try {
        URL.revokeObjectURL(this.customAudioUrl);
      } catch {
        // Ignore revoke errors
      }
    }

    this.customAudioUrl = objectUrl;
    this.customAudioName = fileName;
    this.filmElapsedSec = 0;
    this.mode = 'focus';
    this.crashPhase = 'audioworks';
    this.isLensExpanded = true;
    this.activeChapter = getCommercialStateAtTime(AUDIOWORKS_FOCUS_ENTRY_SEC + 1).chapter;
    this.revealedWordsCount = this.totalFocusWords;

    this.ensureHtmlAudio(objectUrl);
    this.ensureAudioGraph();

    if (!autoPlay) {
      this.isFilmPlaying = false;
      this.isSoundPlaying = false;
      this.syncRoadNoiseNode();
      this.emit();
      return;
    }

    this.seekAndPlayUrl(objectUrl, 0, null, true, true);
  }

  /**
   * Возвращает встроенный эталонный демо-ролик студии AudioWorks (1:19).
   */
  public resetCustomShowreel(): void {
    this.clearPlaybackOnly();

    if (this.customAudioUrl && this.customAudioUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(this.customAudioUrl);
      } catch {
        // Ignore
      }
    }

    this.customAudioUrl = null;
    this.customAudioName = null;
    this.isFilmPlaying = false;
    this.isSoundPlaying = false;
    this.filmElapsedSec = 0;
    this.filmDurationSec = AUDIOWORKS_TOTAL_DURATION_SEC;
    this.activeChapter = null;
    this.crashPhase = 'idle';
    this.crashElapsedSec = 0;
    this.isLensExpanded = false;
    this.mode = 'stream';

    this.ensureHtmlAudio(AUDIOWORKS_WAV_URL);
    this.syncRoadNoiseNode();
    this.emit();
  }

  /**
   * Заполняет буфер реальными частотными данными из Web Audio API `AnalyserNode`
   * для живой звуковой волны и эквалайзера на первом экране.
   */
  public readFrequencyBins(target: Uint8Array<ArrayBuffer>): boolean {
    const active = this.isSoundPlaying || this.isFilmPlaying;
    if (!active || this.crashPhase === 'stop_pause') {
      return false;
    }

    if (this.analyser) {
      this.analyser.getByteFrequencyData(target);
      let nonZeroSum = 0;
      for (let i = 0; i < target.length; i++) {
        nonZeroSum += target[i];
      }
      if (nonZeroSum > 12) {
        return true;
      }
    }

    // Органический спектральный фоллбэк для окружений без физического аудио-выхода (headless preview)
    const t = performance.now() * 0.0042 + this.filmElapsedSec * 1.7;
    const scale = this.mode === 'stream' ? 115 : 215;
    for (let i = 0; i < target.length; i++) {
      const bandRatio = i / Math.max(1, target.length);
      const voiceFormant = Math.exp(-Math.pow((bandRatio - 0.24) * 4.2, 2));
      const foleyAir = Math.exp(-Math.pow((bandRatio - 0.62) * 5.0, 2)) * 0.55;
      const wave =
        0.52 +
        0.3 * Math.sin(t * 1.9 + i * 0.34) +
        0.18 * Math.cos(t * 3.1 - i * 0.21);
      target[i] = Math.min(
        255,
        Math.max(16, Math.round((voiceFormant + foleyAir + 0.18) * wave * scale))
      );
    }
    return true;
  }

  private finishPlaybackOnFocusFrame(): void {
    this.clearTimersOnly();
    this.stopSynthClutterNodes();
    this.forceClutterRoadNoise = false;
    this.stopSegmentAtSec = null;
    this.isFilmPlaying = false;
    this.isSoundPlaying = false;
    if (this.isLensExpanded) {
      this.mode = 'focus';
      this.crashPhase = 'audioworks';
    }
    this.activeChapter = null;
    this.revealedWordsCount = this.totalFocusWords;
    this.filmElapsedSec = this.filmDurationSec;
    this.syncRoadNoiseNode();
    this.emit();
  }

  private clearTimersOnly(): void {
    if (this.tickIntervalId !== null) {
      window.clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }
    if (this.crashTimerId !== null) {
      window.clearInterval(this.crashTimerId);
      this.crashTimerId = null;
    }
  }

  private clearPlaybackOnly(): void {
    this.clearTimersOnly();
    this.stopSynthClutterNodes();
    this.forceClutterRoadNoise = false;
    this.stopSegmentAtSec = null;
    if (this.htmlAudio) {
      this.htmlAudio.pause();
    }
  }

  public stopAll(): void {
    this.clearPlaybackOnly();
    this.isFilmPlaying = false;
    this.isSoundPlaying = false;
    this.activeChapter = null;
    if (this.crashPhase === 'clutter' || this.crashPhase === 'stop_pause') {
      this.crashPhase = 'idle';
      this.crashElapsedSec = 0;
    }
    this.syncRoadNoiseNode();
    this.emit();
  }

  /**
   * Пауза звука с сохранением текущего визуального состояния линзы и режима.
   */
  public pauseKeepingMode(): void {
    this.clearPlaybackOnly();
    this.isFilmPlaying = false;
    this.isSoundPlaying = false;
    if (this.crashPhase === 'clutter' || this.crashPhase === 'stop_pause') {
      this.crashPhase = this.isLensExpanded ? 'audioworks' : 'idle';
    }
    this.syncRoadNoiseNode();
    this.emit();
  }

  public toggleRoadNoise(): void {
    this.roadNoiseEnabled = !this.roadNoiseEnabled;
    if (this.roadNoiseEnabled) {
      this.ensureAudioGraph();
    }
    this.syncRoadNoiseNode();
    this.emit();
  }

  private syncRoadNoiseNode(): void {
    const shouldPlayRoad =
      (this.roadNoiseEnabled || this.forceClutterRoadNoise) &&
      (this.isSoundPlaying || this.isFilmPlaying);

    if (!shouldPlayRoad) {
      if (this.ctx && this.roadGain) {
        try {
          this.roadGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
        } catch {
          // Ignore
        }
      }
      if (this.roadSource) {
        const oldSource = this.roadSource;
        this.roadSource = null;
        window.setTimeout(() => {
          try {
            oldSource.stop();
            oldSource.disconnect();
          } catch {
            // Ignore
          }
        }, 180);
      }
      return;
    }

    const ctx = this.ensureAudioGraph();
    if (!ctx || !this.roadGain) return;

    if (!this.roadSource) {
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

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 215;

      const cabinPeak = ctx.createBiquadFilter();
      cabinPeak.type = 'peaking';
      cabinPeak.frequency.value = 92;
      cabinPeak.gain.value = 5;
      cabinPeak.Q.value = 1.4;

      noise.connect(lowpass);
      lowpass.connect(cabinPeak);
      cabinPeak.connect(this.roadGain);
      noise.start();
      this.roadSource = noise;
    }

    this.roadGain.gain.cancelScheduledValues(ctx.currentTime);
    this.roadGain.gain.setTargetAtTime(0.17, ctx.currentTime, 0.14);
  }

  private startTrackingLoop(lockFocusVisual = false): void {
    if (this.tickIntervalId !== null) {
      window.clearInterval(this.tickIntervalId);
    }

    this.tickIntervalId = window.setInterval(() => {
      const audio = this.htmlAudio;
      if (!audio || (!this.isSoundPlaying && !this.isFilmPlaying)) return;

      const t = audio.currentTime;
      if (this.stopSegmentAtSec !== null && t >= this.stopSegmentAtSec) {
        audio.pause();
        this.stopSegmentAtSec = null;
        this.isSoundPlaying = false;
        this.isFilmPlaying = false;
        this.forceClutterRoadNoise = false;
        this.activeChapter = null;
        this.syncRoadNoiseNode();
        if (this.tickIntervalId !== null) {
          window.clearInterval(this.tickIntervalId);
          this.tickIntervalId = null;
        }
        this.emit();
        return;
      }

      const synced = getCommercialStateAtTime(t);
      this.filmElapsedSec = t;
      const isExternalTrack = this.activeSrcUrl !== AUDIOWORKS_WAV_URL;
      const keepFocus =
        lockFocusVisual &&
        (isExternalTrack || t >= AUDIOWORKS_FOCUS_ENTRY_SEC - 0.3);
      this.mode = keepFocus ? 'focus' : lockFocusVisual ? 'focus' : this.mode;
      this.activeChapter = isExternalTrack ? null : synced.chapter;
      this.revealedWordsCount = isExternalTrack ? this.totalFocusWords : synced.revealedWordsCount;
      this.emit();
    }, 110);
  }

  private seekAndPlayUrl(
    url: string,
    startSec: number,
    endSec: number | null,
    fullFilmMode: boolean,
    forceFocusMode = false
  ): void {
    this.onStartHooks.forEach((fn) => fn());
    this.clearPlaybackOnly();

    const audio = this.ensureHtmlAudio(url);
    this.ensureAudioGraph();

    const initialState = getCommercialStateAtTime(startSec);

    this.isFilmPlaying = fullFilmMode;
    this.isSoundPlaying = true;
    this.stopSegmentAtSec = endSec;
    this.filmElapsedSec = startSec;
    if (endSec !== null) {
      this.filmDurationSec = endSec;
    }
    this.mode = forceFocusMode ? 'focus' : initialState.mode;
    this.activeChapter = url === AUDIOWORKS_WAV_URL ? initialState.chapter : null;
    this.revealedWordsCount =
      url === AUDIOWORKS_WAV_URL ? initialState.revealedWordsCount : this.totalFocusWords;

    this.syncRoadNoiseNode();
    this.emit();

    if (!audio) return;

    const launch = () => {
      if (
        endSec === null &&
        audio.duration &&
        Number.isFinite(audio.duration) &&
        audio.duration > 0.5
      ) {
        this.filmDurationSec = audio.duration;
      }
      const maxSafeTime =
        audio.duration && Number.isFinite(audio.duration) && audio.duration > 0.5
          ? Math.max(0, audio.duration - 0.4)
          : startSec;
      const clampedStart = Math.min(startSec, maxSafeTime);

      try {
        audio.currentTime = clampedStart;
      } catch {
        // Ignore if metadata still loading
      }
      audio.play().catch(() => {
        this.isSoundPlaying = false;
        this.isFilmPlaying = false;
        this.forceClutterRoadNoise = false;
        this.activeChapter = null;
        this.revealedWordsCount = this.totalFocusWords;
        this.syncRoadNoiseNode();
        this.emit();
      });
    };

    if (audio.readyState >= 1) {
      launch();
    } else {
      audio.addEventListener('loadedmetadata', launch, { once: true });
      audio.load();
    }

    this.startTrackingLoop(forceFocusMode);
  }

  /**
   * 3-фазный «Краш-тест в реальном рекламном блоке»:
   * - Фаза 1 (0.0–4.0 с): приглушённый серый радийный поток + шум дороги, линза сужается.
   * - Фаза 2 (4.0–4.5 с): резкий СТОП и пауза 0.5 сек — круглая линза упруго раскрывается на весь экран (150%).
   * - Фаза 3 (с 4.5 с): чистый, объёмный мир AudioWorks со студийным звуком и живым эквалайзером.
   */
  public startCrashTest(): void {
    this.onStartHooks.forEach((fn) => fn());
    this.clearPlaybackOnly();

    this.crashPhase = 'clutter';
    this.crashElapsedSec = 0;
    this.isLensExpanded = false;
    this.mode = 'stream';
    this.isFilmPlaying = true;
    this.isSoundPlaying = true;
    this.forceClutterRoadNoise = true;
    this.filmElapsedSec = 0;

    const duelSnap = duelAudioStore.getSnapshot();

    if (duelSnap.radioTrack) {
      const audio = this.ensureHtmlAudio(duelSnap.radioTrack.objectUrl);
      this.ensureAudioGraph();
      if (audio) {
        try {
          audio.currentTime = 0;
        } catch {
          // Ignore seek before metadata
        }
        audio.play().catch(() => {});
      }
    } else if (!this.customAudioUrl) {
      const audio = this.ensureHtmlAudio(AUDIOWORKS_WAV_URL);
      this.ensureAudioGraph();
      if (audio) {
        const startClutterAt = 1.6;
        const launchClutter = () => {
          try {
            audio.currentTime = startClutterAt;
          } catch {
            // Ignore
          }
          audio.play().catch(() => {});
        };
        if (audio.readyState >= 1) {
          launchClutter();
        } else {
          audio.addEventListener('loadedmetadata', launchClutter, { once: true });
          audio.load();
        }
      }
    } else {
      this.ensureAudioGraph();
      this.playSynthClutterBed(CRASH_TEST_CLUTTER_DURATION_SEC);
    }

    this.syncRoadNoiseNode();
    this.emit();

    if (typeof window === 'undefined') return;

    this.crashStartedAtMs = performance.now();
    let enteredStopPause = false;

    this.crashTimerId = window.setInterval(() => {
      const elapsed = Math.max(0, (performance.now() - this.crashStartedAtMs) / 1000);
      this.crashElapsedSec = elapsed;
      const nextPhase = getCrashTestPhaseAtElapsed(elapsed);

      if (nextPhase === 'clutter') {
        this.filmElapsedSec = Math.min(CRASH_TEST_CLUTTER_DURATION_SEC, elapsed);
        this.emit();
        return;
      }

      if (nextPhase === 'stop_pause') {
        if (!enteredStopPause) {
          enteredStopPause = true;
          if (this.htmlAudio) {
            this.htmlAudio.pause();
          }
          this.stopSynthClutterNodes();
          this.forceClutterRoadNoise = false;
          this.syncRoadNoiseNode();
          this.playTapeStopCue();

          this.crashPhase = 'stop_pause';
          this.mode = 'silence';
          // В момент «СТОП. ПАУЗА 0.5 СЕК» круглая линза упруго пружинит до 150%, стирая серую пробку!
          this.isLensExpanded = true;
        }
        this.emit();
        return;
      }

      // Переход в Фазу 3 (`audioworks`) на 4.5 сек
      if (this.crashTimerId !== null) {
        window.clearInterval(this.crashTimerId);
        this.crashTimerId = null;
      }
      this.crashPhase = 'audioworks';
      this.isLensExpanded = true;
      this.mode = 'focus';
      this.forceClutterRoadNoise = false;

      const focusTarget = this.getPreferredFocusAudio();
      this.seekAndPlayUrl(
        focusTarget.url,
        focusTarget.startSec,
        focusTarget.endSec,
        true,
        true
      );
    }, 90);
  }

  /**
   * Умный триггер для главной кнопки `[ ▶ Краш-тест в эфире ]` и клика по полотну:
   * - Если звук уже играет — ставит на паузу.
   * - Если линза ещё свернута — запускает полный 3-фазный краш-тест (4 с радио-блока -> СТОП 0.5 с -> взрыв цвета AudioWorks).
   * - Если линза уже раскрыта — сразу включает чистый звук AudioWorks.
   */
  public toggleCrashTestOrShowreel(): void {
    if (
      this.isFilmPlaying ||
      this.isSoundPlaying ||
      this.crashPhase === 'clutter' ||
      this.crashPhase === 'stop_pause'
    ) {
      this.pauseKeepingMode();
      return;
    }

    if (this.isLensExpanded) {
      this.expandLensWithAudioWorks();
      return;
    }

    this.startCrashTest();
  }

  public expandLensWithAudioWorks(): void {
    this.isLensExpanded = true;
    this.crashPhase = 'audioworks';
    this.crashElapsedSec = CRASH_TEST_TOTAL_INTRO_SEC;
    const focusTarget = this.getPreferredFocusAudio();
    this.seekAndPlayUrl(
      focusTarget.url,
      focusTarget.startSec,
      focusTarget.endSec,
      true,
      true
    );
  }

  public collapseLensToSpotlight(): void {
    this.clearPlaybackOnly();
    this.isFilmPlaying = false;
    this.isSoundPlaying = false;
    this.isLensExpanded = false;
    this.crashPhase = 'idle';
    this.crashElapsedSec = 0;
    this.mode = 'stream';
    this.activeChapter = null;
    this.syncRoadNoiseNode();
    this.emit();
  }

  /**
   * Мгновенное переключение режима `[ Серый блок ] <-> [ AudioWorks ]`:
   * - `stream`: возвращает серый эфирный поток
   * - `focus`: раскрывает полноцветный мир AudioWorks
   */
  public selectLens(target: 'stream' | 'focus'): void {
    if (target === 'stream') {
      this.isLensExpanded = false;
      this.crashPhase = 'idle';
      this.crashElapsedSec = 0;

      const duelSnap = duelAudioStore.getSnapshot();
      if (duelSnap.radioTrack) {
        this.mode = 'stream';
        this.seekAndPlayUrl(
          duelSnap.radioTrack.objectUrl,
          0,
          duelSnap.radioTrack.effectiveDurationSec,
          false,
          false
        );
        return;
      }

      if (this.customAudioUrl !== null) {
        this.pauseKeepingMode();
        this.mode = 'stream';
        this.emit();
        return;
      }

      this.seekAndPlayUrl(AUDIOWORKS_WAV_URL, 0, 5.9, false, false);
      return;
    }

    this.expandLensWithAudioWorks();
  }

  /**
   * Мгновенно раскрывает режим «Почерк AudioWorks» и запускает шоурил.
   */
  public startSignatureShowreel(startSec = AUDIOWORKS_FOCUS_ENTRY_SEC): void {
    this.isLensExpanded = true;
    this.crashPhase = 'audioworks';
    if (this.customAudioUrl !== null) {
      const customStart =
        Math.abs(startSec - AUDIOWORKS_FOCUS_ENTRY_SEC) < 0.25 ? 0 : startSec;
      this.seekAndPlayUrl(this.customAudioUrl, customStart, null, true, true);
      return;
    }
    const duelSnap = duelAudioStore.getSnapshot();
    if (duelSnap.audioworksTrack && Math.abs(startSec - AUDIOWORKS_FOCUS_ENTRY_SEC) < 0.25) {
      this.seekAndPlayUrl(
        duelSnap.audioworksTrack.objectUrl,
        0,
        duelSnap.audioworksTrack.effectiveDurationSec,
        true,
        true
      );
      return;
    }
    this.seekAndPlayUrl(AUDIOWORKS_WAV_URL, startSec, null, true, true);
  }

  public toggleShowreelPlayback(preferredStartSec = AUDIOWORKS_FOCUS_ENTRY_SEC): void {
    if (this.isFilmPlaying || this.isSoundPlaying) {
      this.pauseKeepingMode();
      return;
    }
    this.startSignatureShowreel(preferredStartSec);
  }

  public toggleContrastFilm12s(): void {
    this.toggleCrashTestOrShowreel();
  }

  public seekToRatio(ratio: number): void {
    const clamped = Math.max(0, Math.min(0.99, ratio));
    const targetSec = clamped * this.filmDurationSec;
    const forceFocus =
      this.activeSrcUrl !== AUDIOWORKS_WAV_URL || targetSec >= AUDIOWORKS_FOCUS_ENTRY_SEC;
    this.seekAndPlayUrl(this.activeSrcUrl, targetSec, this.stopSegmentAtSec, true, forceFocus);
  }
}

export const contrastAudioEngine = new ContrastAudioEngine();
