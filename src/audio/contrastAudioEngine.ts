import {
  AUDIOWORKS_FOCUS_ENTRY_SEC,
  AUDIOWORKS_TOTAL_DURATION_SEC,
  AUDIOWORKS_WAV_URL,
  CommercialChapter,
  CommercialStageMode,
  CRASH_TEST_CLUTTER_DURATION_SEC,
  CRASH_TEST_STOP_DURATION_SEC,
  CRASH_TEST_TOTAL_INTRO_SEC,
  CrashTestPhase,
  getCommercialStateAtTime,
} from '../data/audioworksCommercial';
import type { ResolvedHeroStagePlayback } from '../data/heroStageCms';
import { LayaPersonaSlot } from '../engine/layaTypes';
import {
  createSafeAudioContext,
  unlockAudioContextOnGesture,
} from './audioContextHelper';
import {
  claimExclusiveAudioFocus,
  onExclusiveAudioFocusClaimed,
} from './audioFocusCoordinator';
import { duelAudioStore } from './duelAudioStore';

export type StageMode = CommercialStageMode;

const HERO_VOLUME_STORAGE_KEY = 'fmworks_hero_volume_v1';
const HERO_MUTED_STORAGE_KEY = 'fmworks_hero_muted_v1';
const DEFAULT_HERO_VOLUME = 0.85;

function readInitialVolume(): number {
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

function readInitialMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(HERO_MUTED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export interface ContrastStageSnapshot {
  /** Текущая визуально-звуковая фаза сцены */
  mode: StageMode;
  /** Играет ли сейчас полный студийный шоурил AudioWorks */
  isFilmPlaying: boolean;
  /** Активен ли звук сцены в данный момент */
  isSoundPlaying: boolean;
  /** Включён ли тумблер «🚗 Шум дороги» */
  roadNoiseEnabled: boolean;
  /** Прошедшее время студийного ролика (абсолютное в сек) */
  filmElapsedSec: number;
  /** Полная длительность текущего ролика (абсолютная верхняя граница в сек) */
  filmDurationSec: number;
  /** Начальная секунда текущего фокус-сегмента (для расчёта чистого прогресса 0..100%) */
  focusSegmentStartSec: number;
  /** Сколько крупных слов уже отпечаталось в такт диктору */
  revealedWordsCount: number;
  /** Текущая синхронная глава ролика */
  activeChapter: CommercialChapter | null;
  /** Подключён ли пользовательский локальный аудиофайл (.mp3 / .wav) */
  hasCustomAudio: boolean;
  /** Имя загруженного пользовательского шоурила */
  customAudioName: string | null;
  /** Подпись активного ролика Hero из серверной CMS (если выбран кейс или загружен файл) */
  activeHeroTrackLabel: string | null;
  /** Длительность Фазы А («Обычный рекламный блок») в секундах */
  clutterDurationSec: number;
  /** Длительность Фазы Б («Стоп · Пауза») в секундах */
  stopPauseDurationSec: number;
  /** Фаза эфирного краш-теста на первом экране HeroKotoLens */
  crashPhase: CrashTestPhase;
  /** Секундомер с момента запуска краш-теста (0..4.5+) */
  crashElapsedSec: number;
  /** Раскрыта ли круглая линза внимания на 100% площади экрана */
  isLensExpanded: boolean;
  /** Громкость сцены (0..1) */
  volume: number;
  /** Приглушён ли звук (Mute) */
  isMuted: boolean;
  /** Завершился ли прогон краш-теста / ролика до конца (для умного повтора) */
  hasCompletedCrashTest: boolean;
  /** Поставлен ли краш-тест / ролик на паузу посреди воспроизведения */
  isPausedMidSession: boolean;
  /** Была ли пауза нажата внутри Фазы А («Обычный эфир») для сохранения шкалы 0..clutterDurationSec */
  pausedInClutter: boolean;
  /** Сообщение об ошибке старта аудио, если браузер заблокировал воспроизведение */
  audioError: string | null;
}

type SnapshotListener = (snap: ContrastStageSnapshot) => void;

class ContrastAudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private synthMasterGain: GainNode | null = null;
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
  private cmsHeroPlayback: ResolvedHeroStagePlayback | null = null;

  private mode: StageMode = 'stream';
  private isFilmPlaying = false;
  private isSoundPlaying = false;
  private roadNoiseEnabled = false;
  private forceClutterRoadNoise = false;
  private filmElapsedSec = 0;
  private filmDurationSec = AUDIOWORKS_TOTAL_DURATION_SEC;
  private focusSegmentStartSec = 0;
  private revealedWordsCount = 0;
  private activeChapter: CommercialChapter | null = null;
  private totalFocusWords = 8;

  private crashPhase: CrashTestPhase = 'idle';
  private crashElapsedSec = 0;
  private isLensExpanded = false;

  private volume: number = readInitialVolume();
  private lastNonZeroVolume: number =
    this.volume > 0.02 ? this.volume : DEFAULT_HERO_VOLUME;
  private isMuted: boolean = readInitialMuted();

  private hasCompletedCrashTest = false;
  private isPausedMidSession = false;
  private pausedInClutter = false;
  private pausedClutterElapsedSec = 0;
  private audioError: string | null = null;

  private listeners = new Set<SnapshotListener>();
  private onStartHooks = new Set<() => void>();

  constructor() {
    onExclusiveAudioFocusClaimed((channel) => {
      if (
        channel !== 'contrast_hero' &&
        (this.isSoundPlaying || this.isFilmPlaying)
      ) {
        this.stopAll();
      }
    });
  }

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
      focusSegmentStartSec: this.focusSegmentStartSec,
      revealedWordsCount: this.revealedWordsCount,
      activeChapter: this.activeChapter,
      hasCustomAudio: this.customAudioUrl !== null,
      customAudioName: this.customAudioName,
      activeHeroTrackLabel:
        this.customAudioName ??
        (this.cmsHeroPlayback &&
        this.cmsHeroPlayback.focus.sourceKind !== 'default_reel'
          ? this.cmsHeroPlayback.focus.label
          : null),
      clutterDurationSec:
        this.cmsHeroPlayback?.clutter.durationSec ??
        CRASH_TEST_CLUTTER_DURATION_SEC,
      stopPauseDurationSec:
        this.cmsHeroPlayback?.stopPauseDurationSec ??
        CRASH_TEST_STOP_DURATION_SEC,
      crashPhase: this.crashPhase,
      crashElapsedSec: this.crashElapsedSec,
      isLensExpanded: this.isLensExpanded,
      volume: this.volume,
      isMuted: this.isMuted,
      hasCompletedCrashTest: this.hasCompletedCrashTest,
      isPausedMidSession: this.isPausedMidSession,
      pausedInClutter: this.pausedInClutter,
      audioError: this.audioError,
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  private getEffectiveGain(): number {
    if (this.isMuted) return 0;
    return Math.max(0, Math.min(1, this.volume));
  }

  private syncVolumeToNodes(): void {
    const effective = this.getEffectiveGain();
    if (this.htmlAudio) {
      this.htmlAudio.volume = effective;
      this.htmlAudio.muted = this.isMuted;
    }
    if (this.ctx && this.synthMasterGain) {
      try {
        this.synthMasterGain.gain.setTargetAtTime(
          effective,
          this.ctx.currentTime,
          0.025
        );
      } catch {
        this.synthMasterGain.gain.value = effective;
      }
    }
  }

  private persistVolumeState(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        HERO_VOLUME_STORAGE_KEY,
        this.volume.toFixed(2)
      );
      window.localStorage.setItem(
        HERO_MUTED_STORAGE_KEY,
        this.isMuted ? '1' : '0'
      );
    } catch {
      // Ignore storage quota errors
    }
  }

  /**
   * Устанавливает громкость сцены Hero (0..1) и мгновенно синхронизирует HTMLAudioElement + WebAudio.
   */
  public setVolume(nextVolume: number): void {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(nextVolume) ? nextVolume : DEFAULT_HERO_VOLUME));
    this.volume = clamped;
    if (clamped > 0.01) {
      this.lastNonZeroVolume = clamped;
      if (this.isMuted) {
        this.isMuted = false;
      }
    } else if (clamped === 0) {
      this.isMuted = true;
    }
    this.syncVolumeToNodes();
    this.persistVolumeState();
    this.emit();
  }

  /**
   * Переключает режим Mute/Unmute с сохранением предыдущего ненулевого уровня громкости.
   */
  public toggleMute(): void {
    if (this.isMuted) {
      this.isMuted = false;
      if (this.volume <= 0.01) {
        this.volume = this.lastNonZeroVolume > 0.02 ? this.lastNonZeroVolume : DEFAULT_HERO_VOLUME;
      }
    } else {
      if (this.volume > 0.01) {
        this.lastNonZeroVolume = this.volume;
      }
      this.isMuted = true;
    }
    this.syncVolumeToNodes();
    this.persistVolumeState();
    this.emit();
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

  /**
   * Синхронизирует движок первого экрана с опубликованной/редактируемой конфигурацией CMS `heroStage`.
   */
  public syncCmsHeroStage(resolved: ResolvedHeroStagePlayback): void {
    const prevFocusUrl = this.cmsHeroPlayback?.focus.audioUrl ?? null;
    this.cmsHeroPlayback = resolved;

    if (
      this.customAudioUrl === null &&
      !this.isFilmPlaying &&
      !this.isSoundPlaying
    ) {
      this.focusSegmentStartSec = resolved.focus.startSec;
      this.filmDurationSec =
        resolved.focus.endSec !== null
          ? resolved.focus.endSec
          : Math.max(1, resolved.focus.startSec + resolved.focus.durationSec);
    } else if (
      this.customAudioUrl === null &&
      prevFocusUrl !== null &&
      prevFocusUrl !== resolved.focus.audioUrl &&
      (this.isFilmPlaying || this.isSoundPlaying)
    ) {
      this.pauseKeepingMode();
      return;
    }

    this.emit();
  }

  private getClutterDurationSec(): number {
    return (
      this.cmsHeroPlayback?.clutter.durationSec ??
      CRASH_TEST_CLUTTER_DURATION_SEC
    );
  }

  private getStopPauseDurationSec(): number {
    return (
      this.cmsHeroPlayback?.stopPauseDurationSec ??
      CRASH_TEST_STOP_DURATION_SEC
    );
  }

  private getCrashPhaseAt(elapsedSec: number): CrashTestPhase {
    if (!Number.isFinite(elapsedSec) || elapsedSec < 0) {
      return 'idle';
    }
    const clutterDur = this.getClutterDurationSec();
    const totalIntro = clutterDur + this.getStopPauseDurationSec();
    if (elapsedSec < clutterDur) {
      return 'clutter';
    }
    if (elapsedSec < totalIntro) {
      return 'stop_pause';
    }
    return 'audioworks';
  }

  private getPreferredFocusAudio(): {
    url: string;
    startSec: number;
    endSec: number | null;
  } {
    if (this.customAudioUrl) {
      return { url: this.customAudioUrl, startSec: 0, endSec: null };
    }
    if (this.cmsHeroPlayback) {
      return {
        url: this.cmsHeroPlayback.focus.audioUrl,
        startSec: this.cmsHeroPlayback.focus.startSec,
        endSec: this.cmsHeroPlayback.focus.endSec,
      };
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

      this.synthMasterGain = this.ctx.createGain();
      this.synthMasterGain.gain.value = this.getEffectiveGain();
      this.synthMasterGain.connect(this.analyser);

      this.roadGain = this.ctx.createGain();
      this.roadGain.gain.value = 0.0001;
      this.roadGain.connect(this.synthMasterGain);
    }

    unlockAudioContextOnGesture(this.ctx);
    this.syncVolumeToNodes();
    return this.ctx;
  }

  private ensureHtmlAudio(targetUrl?: string): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    const desiredUrl = targetUrl ?? this.activeSrcUrl;
    if (!this.htmlAudio) {
      const audio = new Audio(desiredUrl);
      audio.preload = 'metadata';
      audio.volume = this.getEffectiveGain();
      audio.muted = this.isMuted;
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
      this.htmlAudio.volume = this.getEffectiveGain();
      this.htmlAudio.muted = this.isMuted;
    } else {
      this.htmlAudio.volume = this.getEffectiveGain();
      this.htmlAudio.muted = this.isMuted;
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
    const targetNode = this.synthMasterGain ?? this.analyser;
    if (!ctx || !targetNode) return;
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
    bandGain.connect(targetNode);
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
    const targetNode = this.synthMasterGain ?? this.analyser;
    if (!ctx || !targetNode) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.18);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(g);
    g.connect(targetNode);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  /**
   * Подключает пользовательский аудиофайл (.mp3 / .wav через `URL.createObjectURL(file)`)
   * напрямую к главной сцене и живому анализатору спектра `AnalyserNode`.
   */
  public loadCustomShowreel(objectUrl: string, fileName: string, autoPlay = false): void {
    claimExclusiveAudioFocus('contrast_hero');
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
    this.focusSegmentStartSec = 0;
    this.mode = 'focus';
    this.crashPhase = 'audioworks';
    this.isLensExpanded = true;
    this.hasCompletedCrashTest = false;
    this.isPausedMidSession = false;
    this.pausedInClutter = false;
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
    this.focusSegmentStartSec = 0;
    this.filmDurationSec = AUDIOWORKS_TOTAL_DURATION_SEC;
    this.activeChapter = null;
    this.crashPhase = 'idle';
    this.crashElapsedSec = 0;
    this.isLensExpanded = false;
    this.hasCompletedCrashTest = false;
    this.isPausedMidSession = false;
    this.pausedInClutter = false;
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
    if (!active || this.crashPhase === 'stop_pause' || this.isMuted || this.volume <= 0.01) {
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
    const scale = (this.mode === 'stream' ? 115 : 215) * this.getEffectiveGain();
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
    this.isPausedMidSession = false;
    this.pausedInClutter = false;
    this.hasCompletedCrashTest = true;
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
    this.isPausedMidSession = false;
    this.pausedInClutter = false;
    this.activeChapter = null;
    if (this.crashPhase === 'clutter' || this.crashPhase === 'stop_pause') {
      this.crashPhase = 'idle';
      this.crashElapsedSec = 0;
    }
    this.syncRoadNoiseNode();
    this.emit();
  }

  /**
   * Пауза звука с сохранением текущего визуального состояния линзы, позиции и режима.
   */
  public pauseKeepingMode(): void {
    const wasInClutter =
      this.crashPhase === 'clutter' || this.crashPhase === 'stop_pause';
    if (wasInClutter) {
      this.pausedInClutter = true;
      this.pausedClutterElapsedSec = this.crashElapsedSec;
    } else {
      this.pausedInClutter = false;
    }

    this.clearPlaybackOnly();
    this.isFilmPlaying = false;
    this.isSoundPlaying = false;
    this.isPausedMidSession = true;
    this.hasCompletedCrashTest = false;

    if (wasInClutter) {
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
        this.finishPlaybackOnFocusFrame();
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
    forceFocusMode = false,
    preserveSegmentStartSec?: number
  ): void {
    claimExclusiveAudioFocus('contrast_hero');
    this.onStartHooks.forEach((fn) => fn());
    this.clearPlaybackOnly();

    const audio = this.ensureHtmlAudio(url);
    this.ensureAudioGraph();

    const initialState = getCommercialStateAtTime(startSec);

    this.isFilmPlaying = fullFilmMode;
    this.isSoundPlaying = true;
    this.isPausedMidSession = false;
    this.pausedInClutter = false;
    this.hasCompletedCrashTest = false;
    this.stopSegmentAtSec = endSec;
    this.filmElapsedSec = startSec;
    this.focusSegmentStartSec =
      preserveSegmentStartSec !== undefined ? preserveSegmentStartSec : startSec;
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
      this.audioError = null;
      audio.play().catch(() => {
        this.isSoundPlaying = false;
        this.isFilmPlaying = false;
        this.forceClutterRoadNoise = false;
        this.activeChapter = null;
        this.revealedWordsCount = this.totalFocusWords;
        this.audioError = 'Браузер заблокировал автозапуск звука — нажмите ещё раз';
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
  public startCrashTest(initialClutterOffsetSec = 0): void {
    claimExclusiveAudioFocus('contrast_hero');
    this.onStartHooks.forEach((fn) => fn());
    this.clearPlaybackOnly();

    const clutterDur = this.getClutterDurationSec();
    const safeOffset = Math.max(0, Math.min(clutterDur - 0.2, initialClutterOffsetSec));
    const cmsClutter = this.cmsHeroPlayback?.clutter;

    this.crashPhase = 'clutter';
    this.crashElapsedSec = safeOffset;
    this.isLensExpanded = false;
    this.mode = 'stream';
    this.isFilmPlaying = true;
    this.isSoundPlaying = true;
    this.isPausedMidSession = false;
    this.pausedInClutter = false;
    this.hasCompletedCrashTest = false;
    this.audioError = null;
    this.forceClutterRoadNoise = cmsClutter ? cmsClutter.roadNoiseOnClutter : true;
    this.filmElapsedSec = safeOffset;
    this.focusSegmentStartSec = 0;

    const duelSnap = duelAudioStore.getSnapshot();
    let usesExternalAudioBuffer = false;

    if (cmsClutter && cmsClutter.mode === 'custom_upload') {
      usesExternalAudioBuffer = true;
      const audio = this.ensureHtmlAudio(cmsClutter.audioUrl);
      this.ensureAudioGraph();
      if (audio) {
        const launchCustomClutter = () => {
          try {
            audio.currentTime = cmsClutter.startSec + safeOffset;
          } catch {
            // Ignore seek before metadata
          }
          audio.play().catch(() => {
            this.audioError = 'Нажмите ещё раз для запуска звука';
            this.emit();
          });
        };
        if (audio.readyState >= 1) {
          launchCustomClutter();
        } else {
          audio.addEventListener('loadedmetadata', launchCustomClutter, { once: true });
          audio.load();
        }
      }
    } else if (!this.cmsHeroPlayback && duelSnap.radioTrack) {
      usesExternalAudioBuffer = true;
      const audio = this.ensureHtmlAudio(duelSnap.radioTrack.objectUrl);
      this.ensureAudioGraph();
      if (audio) {
        try {
          audio.currentTime = safeOffset;
        } catch {
          // Ignore seek before metadata
        }
        audio.play().catch(() => {
          this.audioError = 'Нажмите ещё раз для запуска звука';
          this.emit();
        });
      }
    } else if (!this.customAudioUrl) {
      const audio = this.ensureHtmlAudio(AUDIOWORKS_WAV_URL);
      this.ensureAudioGraph();
      if (audio) {
        const startClutterAt = (cmsClutter?.startSec ?? 1.6) + safeOffset;
        const launchClutter = () => {
          try {
            audio.currentTime = startClutterAt;
          } catch {
            // Ignore
          }
          audio.play().catch(() => {
            this.audioError = 'Нажмите ещё раз для запуска звука';
            this.emit();
          });
        };
        if (audio.readyState >= 1) {
          launchClutter();
        } else {
          audio.addEventListener('loadedmetadata', launchClutter, { once: true });
          audio.load();
        }
      }
    } else {
      usesExternalAudioBuffer = true;
      this.ensureAudioGraph();
      this.playSynthClutterBed(Math.max(0.5, clutterDur - safeOffset));
    }

    this.syncRoadNoiseNode();
    this.emit();

    if (typeof window === 'undefined') return;

    this.crashStartedAtMs = performance.now() - safeOffset * 1000;
    let enteredStopPause = false;

    this.crashTimerId = window.setInterval(() => {
      // Пока HTMLAudioElement буферизуется на 1-й фазе, не сдвигаем таймер вслепую
      const audioStalled =
        !usesExternalAudioBuffer &&
        this.htmlAudio &&
        this.htmlAudio.paused &&
        this.htmlAudio.readyState < 2 &&
        !enteredStopPause;
      if (audioStalled) {
        this.crashStartedAtMs = performance.now() - this.crashElapsedSec * 1000;
        return;
      }

      const elapsed = Math.max(0, (performance.now() - this.crashStartedAtMs) / 1000);
      this.crashElapsedSec = elapsed;
      const nextPhase = this.getCrashPhaseAt(elapsed);

      if (nextPhase === 'clutter') {
        this.filmElapsedSec = Math.min(clutterDur, elapsed);
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
          if (usesExternalAudioBuffer) {
            this.playTapeStopCue();
          }

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
        true,
        focusTarget.startSec
      );
    }, 90);
  }

  /**
   * Принудительный перезапуск полного 3-фазного краш-теста с 0:00 (Фаза 1 «Обычный эфир» -> Стоп-пауза -> FMWorks).
   * Работает из любого состояния (даже когда линза уже раскрыта или трек завершён).
   */
  public restartCrashTest(): void {
    this.pausedInClutter = false;
    this.pausedClutterElapsedSec = 0;
    this.isPausedMidSession = false;
    this.hasCompletedCrashTest = false;
    this.startCrashTest(0);
  }

  /**
   * Умный триггер для главной кнопки `[ ▶ Краш-тест в эфире ]` и клика по полотну:
   * - Если звук уже играет — ставит на паузу.
   * - Если краш-тест / трек уже доиграл до конца (`hasCompletedCrashTest`) — запускает полный 3-фазный краш-тест с 0:00!
   * - Если пользователь ставил на паузу посреди воспроизведения (`isPausedMidSession`) — плавно продолжает с места паузы.
   * - Если линза была переключена вручную в режим FMWorks (`isLensExpanded`) без старта — включает шоурил FMWorks.
   * - В исходном состоянии — запускает полный 3-фазный краш-тест.
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

    if (this.hasCompletedCrashTest) {
      this.restartCrashTest();
      return;
    }

    if (this.isPausedMidSession) {
      if (this.pausedInClutter) {
        this.startCrashTest(this.pausedClutterElapsedSec);
        return;
      }
      const focusTarget = this.getPreferredFocusAudio();
      const resumeSec =
        this.filmElapsedSec > focusTarget.startSec &&
        (focusTarget.endSec === null || this.filmElapsedSec < focusTarget.endSec - 0.3)
          ? this.filmElapsedSec
          : focusTarget.startSec;
      this.isLensExpanded = true;
      this.crashPhase = 'audioworks';
      this.seekAndPlayUrl(
        focusTarget.url,
        resumeSec,
        focusTarget.endSec,
        true,
        true,
        focusTarget.startSec
      );
      return;
    }

    if (this.isLensExpanded) {
      this.expandLensWithAudioWorks();
      return;
    }

    this.startCrashTest(0);
  }

  public expandLensWithAudioWorks(): void {
    this.isLensExpanded = true;
    this.crashPhase = 'audioworks';
    this.crashElapsedSec = CRASH_TEST_TOTAL_INTRO_SEC;
    this.hasCompletedCrashTest = false;
    this.isPausedMidSession = false;
    this.pausedInClutter = false;
    const focusTarget = this.getPreferredFocusAudio();
    this.seekAndPlayUrl(
      focusTarget.url,
      focusTarget.startSec,
      focusTarget.endSec,
      true,
      true,
      focusTarget.startSec
    );
  }

  public collapseLensToSpotlight(): void {
    this.clearPlaybackOnly();
    this.isFilmPlaying = false;
    this.isSoundPlaying = false;
    this.isLensExpanded = false;
    this.crashPhase = 'idle';
    this.crashElapsedSec = 0;
    this.hasCompletedCrashTest = false;
    this.isPausedMidSession = false;
    this.pausedInClutter = false;
    this.mode = 'stream';
    this.activeChapter = null;
    this.syncRoadNoiseNode();
    this.emit();
  }

  /**
   * Переключение режима сцены `[ Обычный эфир ] <-> [ FMWorks ]`:
   * - Если воспроизведение уже активно — переключает соответствующую звуковую фазу.
   * - Если плеер в покое или на паузе — переключает визуальную сцену без автоматического запуска звука.
   */
  public selectLens(target: 'stream' | 'focus'): void {
    const wasActive =
      this.isFilmPlaying ||
      this.isSoundPlaying ||
      this.crashPhase === 'clutter' ||
      this.crashPhase === 'stop_pause';

    if (target === 'stream') {
      if (wasActive) {
        this.restartCrashTest();
        return;
      }
      this.collapseLensToSpotlight();
      return;
    }

    if (wasActive) {
      this.expandLensWithAudioWorks();
      return;
    }

    this.clearPlaybackOnly();
    this.isFilmPlaying = false;
    this.isSoundPlaying = false;
    this.isLensExpanded = true;
    this.crashPhase = 'audioworks';
    this.mode = 'focus';
    this.hasCompletedCrashTest = false;
    this.isPausedMidSession = false;
    this.pausedInClutter = false;
    this.syncRoadNoiseNode();
    this.emit();
  }

  /**
   * Мгновенно раскрывает режим «Почерк AudioWorks» и запускает шоурил.
   */
  public startSignatureShowreel(startSec = AUDIOWORKS_FOCUS_ENTRY_SEC): void {
    this.isLensExpanded = true;
    this.crashPhase = 'audioworks';
    this.hasCompletedCrashTest = false;
    this.isPausedMidSession = false;
    this.pausedInClutter = false;
    if (this.customAudioUrl !== null) {
      const customStart =
        Math.abs(startSec - AUDIOWORKS_FOCUS_ENTRY_SEC) < 0.25 ? 0 : startSec;
      this.seekAndPlayUrl(this.customAudioUrl, customStart, null, true, true, 0);
      return;
    }
    if (this.cmsHeroPlayback) {
      const target = this.cmsHeroPlayback.focus;
      const effectiveStart =
        Math.abs(startSec - AUDIOWORKS_FOCUS_ENTRY_SEC) < 0.25
          ? target.startSec
          : startSec;
      this.seekAndPlayUrl(
        target.audioUrl,
        effectiveStart,
        target.endSec,
        true,
        true,
        target.startSec
      );
      return;
    }
    const duelSnap = duelAudioStore.getSnapshot();
    if (duelSnap.audioworksTrack && Math.abs(startSec - AUDIOWORKS_FOCUS_ENTRY_SEC) < 0.25) {
      this.seekAndPlayUrl(
        duelSnap.audioworksTrack.objectUrl,
        0,
        duelSnap.audioworksTrack.effectiveDurationSec,
        true,
        true,
        0
      );
      return;
    }
    this.seekAndPlayUrl(AUDIOWORKS_WAV_URL, startSec, null, true, true, startSec);
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
    const clamped = Math.max(0, Math.min(0.995, Number.isFinite(ratio) ? ratio : 0));
    const safeStart = Math.max(
      0,
      Math.min(Math.max(0, this.filmDurationSec - 0.5), this.focusSegmentStartSec)
    );
    const segmentSpan = Math.max(0.5, this.filmDurationSec - safeStart);
    const targetSec = safeStart + clamped * segmentSpan;
    const forceFocus =
      this.activeSrcUrl !== AUDIOWORKS_WAV_URL || targetSec >= AUDIOWORKS_FOCUS_ENTRY_SEC;
    this.isLensExpanded = true;
    this.crashPhase = 'audioworks';
    this.seekAndPlayUrl(
      this.activeSrcUrl,
      targetSec,
      this.stopSegmentAtSec,
      true,
      forceFocus,
      safeStart
    );
  }
}

export const contrastAudioEngine = new ContrastAudioEngine();
