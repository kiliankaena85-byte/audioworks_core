import {
  AUDIOWORKS_FOCUS_ENTRY_SEC,
  AUDIOWORKS_TOTAL_DURATION_SEC,
  AUDIOWORKS_WAV_URL,
  CommercialChapter,
  CommercialStageMode,
  getCommercialStateAtTime,
} from '../data/audioworksCommercial';
import { LayaPersonaSlot } from '../engine/layaTypes';

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
}

type SnapshotListener = (snap: ContrastStageSnapshot) => void;

class ContrastAudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaElementSource: MediaElementAudioSourceNode | null = null;
  private roadGain: GainNode | null = null;
  private roadSource: AudioBufferSourceNode | null = null;

  private tickIntervalId: number | null = null;
  private stopSegmentAtSec: number | null = null;
  private htmlAudio: HTMLAudioElement | null = null;

  private customAudioUrl: string | null = null;
  private customAudioName: string | null = null;

  private mode: StageMode = 'stream';
  private isFilmPlaying = false;
  private isSoundPlaying = false;
  private roadNoiseEnabled = false;
  private filmElapsedSec = 0;
  private filmDurationSec = AUDIOWORKS_TOTAL_DURATION_SEC;
  private revealedWordsCount = 0;
  private activeChapter: CommercialChapter | null = null;
  private totalFocusWords = 8;

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

  private getActiveAudioUrl(): string {
    return this.customAudioUrl ?? AUDIOWORKS_WAV_URL;
  }

  private ensureAudioGraph(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();

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

  private ensureHtmlAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.htmlAudio) {
      const audio = new Audio(this.getActiveAudioUrl());
      audio.preload = 'metadata';
      audio.volume = 1.0;

      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
          this.filmDurationSec = audio.duration;
          this.emit();
        }
      });

      audio.addEventListener('ended', () => {
        this.finishPlaybackOnFocusFrame();
      });

      this.htmlAudio = audio;
    }
    return this.htmlAudio;
  }

  /**
   * Подключает пользовательский аудиофайл (.mp3 / .wav через `URL.createObjectURL(file)`)
   * напрямую к главной сцене `HeroCinemaStage` и живому анализатору спектра `AnalyserNode`.
   */
  public loadCustomShowreel(objectUrl: string, fileName: string, autoPlay = true): void {
    this.onStartHooks.forEach((fn) => fn());
    this.clearPlaybackOnly();

    if (this.customAudioUrl && this.customAudioUrl.startsWith('blob:') && this.customAudioUrl !== objectUrl) {
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
    this.activeChapter = getCommercialStateAtTime(AUDIOWORKS_FOCUS_ENTRY_SEC + 1).chapter;
    this.revealedWordsCount = this.totalFocusWords;

    const audio = this.ensureHtmlAudio();
    this.ensureAudioGraph();

    if (audio) {
      audio.src = objectUrl;
      audio.load();
    }

    if (!autoPlay) {
      this.isFilmPlaying = false;
      this.isSoundPlaying = false;
      this.syncRoadNoiseNode();
      this.emit();
      return;
    }

    this.seekAndPlay(0, null, true, true);
  }

  /**
   * Возвращает встроенный эталонный демо-ролик студии Audioworks (1:19).
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

    if (this.htmlAudio) {
      this.htmlAudio.src = AUDIOWORKS_WAV_URL;
      this.htmlAudio.load();
    }

    this.syncRoadNoiseNode();
    this.emit();
  }

  /**
   * Заполняет буфер реальными частотными данными из Web Audio API `AnalyserNode`
   * для живой 3D/Canvas звуковой скульптуры на первом экране.
   */
  public readFrequencyBins(target: Uint8Array<ArrayBuffer>): boolean {
    const active = this.isSoundPlaying || this.isFilmPlaying;
    if (!active) {
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

    // Органический спектральный фоллбэк только если окружение без физического аудио-выхода (headless preview)
    const t = performance.now() * 0.0042 + this.filmElapsedSec * 1.7;
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
        Math.max(18, Math.round((voiceFormant + foleyAir + 0.18) * wave * 215))
      );
    }
    return true;
  }

  private finishPlaybackOnFocusFrame(): void {
    if (this.tickIntervalId !== null) {
      window.clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }
    this.stopSegmentAtSec = null;
    this.isFilmPlaying = false;
    this.isSoundPlaying = false;
    this.mode = 'focus';
    this.activeChapter = null;
    this.revealedWordsCount = this.totalFocusWords;
    this.filmElapsedSec = this.filmDurationSec;
    this.syncRoadNoiseNode();
    this.emit();
  }

  private clearPlaybackOnly(): void {
    if (this.tickIntervalId !== null) {
      window.clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }
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
    this.syncRoadNoiseNode();
    this.emit();
  }

  /**
   * Пауза звука с сохранением текущего визуального режима (например, оставаясь в «Почерке AudioWorks»).
   */
  public pauseKeepingMode(): void {
    this.clearPlaybackOnly();
    this.isFilmPlaying = false;
    this.isSoundPlaying = false;
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
      this.roadNoiseEnabled && (this.isSoundPlaying || this.isFilmPlaying);

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
    this.roadGain.gain.setTargetAtTime(0.18, ctx.currentTime, 0.15);
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
      const keepFocus =
        lockFocusVisual &&
        (this.customAudioUrl !== null || t >= AUDIOWORKS_FOCUS_ENTRY_SEC - 0.3);
      this.mode = keepFocus ? 'focus' : synced.mode;
      this.activeChapter = synced.chapter;
      this.revealedWordsCount = synced.revealedWordsCount;
      this.emit();
    }, 110);
  }

  private seekAndPlay(
    startSec: number,
    endSec: number | null,
    fullFilmMode: boolean,
    forceFocusMode = false
  ): void {
    this.onStartHooks.forEach((fn) => fn());
    this.clearPlaybackOnly();

    const audio = this.ensureHtmlAudio();
    this.ensureAudioGraph();

    const initialState = getCommercialStateAtTime(startSec);

    this.isFilmPlaying = fullFilmMode;
    this.isSoundPlaying = true;
    this.stopSegmentAtSec = endSec;
    this.filmElapsedSec = startSec;
    this.mode = forceFocusMode ? 'focus' : initialState.mode;
    this.activeChapter = initialState.chapter;
    this.revealedWordsCount = initialState.revealedWordsCount;

    this.syncRoadNoiseNode();
    this.emit();

    if (!audio) return;

    const launch = () => {
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
   * Переключение режима медиа-сцены:
   * - `stream`: «Обычный эфир (Фоновый шум)»
   * - `focus`: «Почерк AudioWorks (Кино в голове)»
   */
  public selectLens(target: 'stream' | 'focus'): void {
    if (target === 'stream') {
      if (this.customAudioUrl !== null) {
        this.pauseKeepingMode();
        this.mode = 'stream';
        this.emit();
        return;
      }
      this.seekAndPlay(0, 5.9, false, false);
      return;
    }
    this.startSignatureShowreel(this.customAudioUrl !== null ? 0 : AUDIOWORKS_FOCUS_ENTRY_SEC);
  }

  /**
   * Мгновенно раскрывает режим «Почерк AudioWorks (Кино в голове)» и запускает шоурил.
   * Если загружен пользовательский файл (.mp3 / .wav), основной запуск стартует с 0:00 этого файла.
   */
  public startSignatureShowreel(startSec = AUDIOWORKS_FOCUS_ENTRY_SEC): void {
    if (this.customAudioUrl !== null) {
      const customStart =
        Math.abs(startSec - AUDIOWORKS_FOCUS_ENTRY_SEC) < 0.25 ? 0 : startSec;
      this.seekAndPlay(customStart, null, true, true);
      return;
    }
    this.seekAndPlay(startSec, null, true, true);
  }

  /**
   * Запуск / пауза шоурила с сохранением открытого кино-режима при паузе.
   */
  public toggleShowreelPlayback(preferredStartSec = AUDIOWORKS_FOCUS_ENTRY_SEC): void {
    if (this.isFilmPlaying || this.isSoundPlaying) {
      this.pauseKeepingMode();
      return;
    }
    this.startSignatureShowreel(preferredStartSec);
  }

  public toggleContrastFilm12s(): void {
    this.toggleShowreelPlayback(0);
  }

  public seekToRatio(ratio: number): void {
    const clamped = Math.max(0, Math.min(0.99, ratio));
    const targetSec = clamped * this.filmDurationSec;
    const forceFocus =
      this.customAudioUrl !== null || targetSec >= AUDIOWORKS_FOCUS_ENTRY_SEC;
    this.seekAndPlay(targetSec, null, true, forceFocus);
  }
}

export const contrastAudioEngine = new ContrastAudioEngine();
