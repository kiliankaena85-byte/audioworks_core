import { BRAND_CASES, BrandCasePoster, CaseId } from '../data/casesData';
import { contrastAudioEngine } from './contrastAudioEngine';

export interface CasePlayerSnapshot {
  activeCase: BrandCasePoster | null;
  isPlaying: boolean;
  currentTimeSec: number;
  durationSec: number;
  progress: number; // 0..1
  /** 5 живых нормализованных полос (0.18..1) для органической звуковой анимации постера и капсулы */
  waveBars: [number, number, number, number, number];
}

type CasePlayerListener = (snap: CasePlayerSnapshot) => void;

const IDLE_BARS: [number, number, number, number, number] = [0.22, 0.35, 0.28, 0.4, 0.24];

class CasePlayerEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;

  private activeNodes: AudioNode[] = [];
  private timers: number[] = [];
  private intervalId: number | null = null;
  private htmlAudio: HTMLAudioElement | null = null;
  private clipStartSec = 0;
  private clipEndSec: number | null = null;

  private activeCase: BrandCasePoster | null = null;
  private isPlaying = false;
  private startCtxTime = 0;
  private durationSec = 15;
  private listeners = new Set<CasePlayerListener>();

  constructor() {
    contrastAudioEngine.onBeforeStart(() => {
      if (this.isPlaying) {
        this.stop();
      }
    });
  }

  public subscribe(listener: CasePlayerListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): CasePlayerSnapshot {
    if (!this.isPlaying || !this.activeCase) {
      return {
        activeCase: null,
        isPlaying: false,
        currentTimeSec: 0,
        durationSec: this.durationSec,
        progress: 0,
        waveBars: IDLE_BARS,
      };
    }

    let elapsed = 0;
    if (this.htmlAudio) {
      elapsed = Math.max(0, this.htmlAudio.currentTime - this.clipStartSec);
    } else if (this.ctx) {
      elapsed = Math.max(0, this.ctx.currentTime - this.startCtxTime);
    }

    const clampedElapsed = Math.min(this.durationSec, elapsed);
    const progress = this.durationSec > 0 ? Math.min(1, clampedElapsed / this.durationSec) : 0;

    return {
      activeCase: this.activeCase,
      isPlaying: this.isPlaying,
      currentTimeSec: clampedElapsed,
      durationSec: this.durationSec,
      progress,
      waveBars: this.sampleWaveBars(clampedElapsed),
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  private sampleWaveBars(elapsedSec: number): [number, number, number, number, number] {
    if (!this.htmlAudio && this.analyser && this.freqData) {
      this.analyser.getByteFrequencyData(this.freqData);
      const bins = [2, 5, 9, 14, 20];
      const measured = bins.map((idx, i) => {
        const raw = (this.freqData?.[idx] ?? 0) / 255;
        const organic = 0.24 + 0.18 * Math.abs(Math.sin(elapsedSec * 4.2 + i * 1.1));
        return Math.min(1, Math.max(0.2, raw * 1.35 + organic * 0.45));
      });
      return measured as [number, number, number, number, number];
    }

    return [0, 1, 2, 3, 4].map((i) =>
      Math.min(
        1,
        0.26 +
          0.42 * Math.abs(Math.sin(elapsedSec * 5.2 + i * 1.15)) +
          0.24 * Math.abs(Math.cos(elapsedSec * 3.1 + i * 0.7))
      )
    ) as [number, number, number, number, number];
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.78;
      this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];

    if (this.htmlAudio) {
      this.htmlAudio.pause();
      this.htmlAudio = null;
    }
    this.clipStartSec = 0;
    this.clipEndSec = null;

    if (this.ctx && this.masterGain) {
      try {
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.04);
      } catch {
        // Ignore
      }
    }

    const oldNodes = [...this.activeNodes];
    this.activeNodes = [];
    window.setTimeout(() => {
      oldNodes.forEach((node) => {
        try {
          if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
            (node as OscillatorNode).stop();
          }
          node.disconnect();
        } catch {
          // Ignore
        }
      });
    }, 70);

    this.activeCase = null;
    this.isPlaying = false;
    this.emit();
  }

  public toggleCase(item: BrandCasePoster): void {
    if (this.isPlaying && this.activeCase?.id === item.id) {
      this.stop();
      return;
    }

    // Останавливаем сцену первого экрана, чтобы два потока звука никогда не накладывались
    contrastAudioEngine.stopAll();
    this.stop();

    this.activeCase = item;
    this.clipStartSec = item.clipStartSec ?? 0;
    this.clipEndSec = item.clipEndSec ?? null;
    this.durationSec =
      this.clipEndSec !== null
        ? Math.max(1, Math.round(this.clipEndSec - this.clipStartSec))
        : item.durationSec;
    this.isPlaying = true;

    if (item.audioUrl) {
      // Воспроизводим студийный WAV напрямую через HTMLAudioElement (100% чистый тракт без потерь)
      const audio = new Audio(item.audioUrl);
      audio.preload = 'auto';
      audio.volume = 1.0;
      this.htmlAudio = audio;

      const startAt = this.clipStartSec;
      const launchAudio = () => {
        if (this.htmlAudio !== audio) return;
        if (startAt > 0) {
          try {
            audio.currentTime = startAt;
          } catch {
            // Ignore seek before metadata
          }
        }
        if (this.clipEndSec === null && audio.duration && Number.isFinite(audio.duration)) {
          this.durationSec = Math.round(audio.duration);
        }
        audio.play().catch(() => this.stop());
      };

      if (audio.readyState >= 1) {
        launchAudio();
      } else {
        audio.addEventListener('loadedmetadata', launchAudio, { once: true });
        audio.load();
      }

      audio.addEventListener('ended', () => this.stop());
    } else {
      const ctx = this.ensureContext();
      if (ctx && this.masterGain) {
        this.startCtxTime = ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(ctx.currentTime);
        this.masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
        this.masterGain.gain.linearRampToValueAtTime(0.82, ctx.currentTime + 0.1);

        this.scheduleCaseComposition(ctx, this.masterGain, item.id, item.durationSec);

        const finishTimer = window.setTimeout(() => {
          if (this.activeCase?.id === item.id) {
            this.stop();
          }
        }, item.durationSec * 1000 + 120);
        this.timers.push(finishTimer);
      }
    }

    this.emit();
    this.intervalId = window.setInterval(() => {
      if (!this.isPlaying) return;
      if (
        this.htmlAudio &&
        this.clipEndSec !== null &&
        this.htmlAudio.currentTime >= this.clipEndSec
      ) {
        this.stop();
        return;
      }
      this.emit();
    }, 100);
  }

  public playNextCase(orderedList: BrandCasePoster[] = BRAND_CASES): void {
    if (!orderedList.length) return;
    if (!this.activeCase) {
      this.toggleCase(orderedList[0]);
      return;
    }
    const idx = orderedList.findIndex((c) => c.id === this.activeCase?.id);
    if (idx === -1) {
      this.toggleCase(orderedList[0]);
      return;
    }
    const next = orderedList[(idx + 1) % orderedList.length];
    this.toggleCase(next);
  }

  private playTone(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    offsetSec: number,
    durSec: number,
    opts: {
      type?: OscillatorType;
      gain?: number;
      attack?: number;
      cutoff?: number;
      pan?: number;
    } = {}
  ): void {
    const t0 = ctx.currentTime + offsetSec;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();

    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(opts.cutoff ?? 2000, t0);

    const peak = opts.gain ?? 0.12;
    const attack = opts.attack ?? 0.05;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0002, t0 + durSec);

    osc.connect(filter);
    if (typeof ctx.createStereoPanner === 'function' && opts.pan !== undefined) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(opts.pan, t0);
      filter.connect(panner);
      panner.connect(g);
      this.activeNodes.push(panner);
    } else {
      filter.connect(g);
    }

    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + durSec + 0.04);
    this.activeNodes.push(osc, filter, g);
  }

  private scheduleWarmRoomAir(
    ctx: AudioContext,
    dest: AudioNode,
    durationSec: number,
    centerHz: number,
    gainLevel: number
  ): void {
    const len = Math.floor(ctx.sampleRate * 3);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      prev = (prev + 0.03 * w) / 1.03;
      data[i] = prev * 1.9;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = centerHz;
    bp.Q.value = 0.85;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(gainLevel, ctx.currentTime + 0.5);
    g.gain.setValueAtTime(gainLevel, ctx.currentTime + Math.max(0.6, durationSec - 0.9));
    g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + durationSec);

    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    src.start(ctx.currentTime);
    src.stop(ctx.currentTime + durationSec + 0.05);
    this.activeNodes.push(src, bp, g);
  }

  private scheduleCaseComposition(
    ctx: AudioContext,
    dest: AudioNode,
    caseId: CaseId,
    durationSec: number
  ): void {
    if (caseId === 'medical-clinics') {
      // medical-clinics: Тёплая человеческая интонация — прозрачные мажорные интервалы доверия и спокойствия
      this.scheduleWarmRoomAir(ctx, dest, durationSec, 480, 0.03);
      const calmChords = [
        { t: 0.1, notes: [146.83, 220.0, 293.66, 369.99, 440.0] }, // Dmaj7
        { t: 3.6, notes: [196.0, 246.94, 293.66, 369.99, 493.88] }, // Gmaj7
        { t: 7.2, notes: [146.83, 220.0, 277.18, 369.99, 440.0] }, // Dmaj9
        { t: 10.8, notes: [164.81, 220.0, 293.66, 369.99, 587.33] }, // Asus4 -> D
      ];

      calmChords.forEach((c) => {
        if (c.t >= durationSec - 0.5) return;
        c.notes.forEach((nf, idx) => {
          this.playTone(ctx, dest, nf, c.t + idx * 0.09, 3.3, {
            type: 'sine',
            gain: idx === 0 ? 0.15 : 0.08,
            attack: 0.14,
            cutoff: 2100,
            pan: (idx - 2) * 0.18,
          });
        });
      });
    }
  }
}

export const casePlayerEngine = new CasePlayerEngine();
