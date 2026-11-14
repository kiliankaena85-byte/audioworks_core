import { Mic, Pause, Play, Square, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSafeAudioContext } from '../../audio/audioContextHelper';
import { casePlayerEngine } from '../../audio/casePlayerEngine';
import { contrastAudioEngine } from '../../audio/contrastAudioEngine';

export type VoiceRecordStatus = 'idle' | 'recording' | 'recorded';

export interface VoiceBriefSnapshot {
  status: VoiceRecordStatus;
  seconds: number;
}

interface VoiceBriefRecorderProps {
  variant?: 'primary' | 'secondary';
  idleLabel?: string;
  idleHint?: string;
  resetSignal?: number;
  onStateChange: (snapshot: VoiceBriefSnapshot) => void;
  onClearError?: () => void;
}

function getPulseBarHeightClass(level: number): string {
  if (level >= 0.78) return 'h-5';
  if (level >= 0.6) return 'h-4';
  if (level >= 0.44) return 'h-3';
  if (level >= 0.3) return 'h-2';
  return 'h-1.5';
}

export function VoiceBriefRecorder({
  variant = 'primary',
  idleLabel = 'Надиктовать задачу голосом',
  idleHint = '30 секунд своими словами вместо заполнения анкеты',
  resetSignal = 0,
  onStateChange,
  onClearError,
}: VoiceBriefRecorderProps) {
  const [voiceStatus, setVoiceStatus] = useState<VoiceRecordStatus>('idle');
  const [isSimulatedMic, setIsSimulatedMic] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [pulseBars, setPulseBars] = useState<[number, number, number, number, number]>([
    0.3, 0.55, 0.4, 0.7, 0.35,
  ]);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const htmlPlayerRef = useRef<HTMLAudioElement | null>(null);
  const simPlaybackTimerRef = useRef<number | null>(null);

  const cleanupRecordingTimersAndStream = useCallback(() => {
    if (recordIntervalRef.current !== null) {
      window.clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  useEffect(() => {
    onStateChange({ status: voiceStatus, seconds: recordSeconds });
  }, [onStateChange, recordSeconds, voiceStatus]);

  useEffect(() => {
    return () => {
      cleanupRecordingTimersAndStream();
      if (recordedBlobUrl) URL.revokeObjectURL(recordedBlobUrl);
      if (htmlPlayerRef.current) htmlPlayerRef.current.pause();
      if (simPlaybackTimerRef.current !== null) {
        window.clearTimeout(simPlaybackTimerRef.current);
      }
    };
  }, [cleanupRecordingTimersAndStream, recordedBlobUrl]);

  const deleteRecordedVoice = useCallback(() => {
    cleanupRecordingTimersAndStream();
    if (htmlPlayerRef.current) htmlPlayerRef.current.pause();
    if (simPlaybackTimerRef.current !== null) {
      window.clearTimeout(simPlaybackTimerRef.current);
      simPlaybackTimerRef.current = null;
    }
    if (recordedBlobUrl) {
      URL.revokeObjectURL(recordedBlobUrl);
      setRecordedBlobUrl(null);
    }
    setIsPlayingVoice(false);
    setRecordSeconds(0);
    setVoiceStatus('idle');
  }, [cleanupRecordingTimersAndStream, recordedBlobUrl]);

  const deleteRecordedVoiceRef = useRef(deleteRecordedVoice);
  deleteRecordedVoiceRef.current = deleteRecordedVoice;

  useEffect(() => {
    if (resetSignal > 0) {
      deleteRecordedVoiceRef.current();
    }
  }, [resetSignal]);

  const stopVoiceRecording = () => {
    if (isSimulatedMic) {
      cleanupRecordingTimersAndStream();
      setRecordSeconds((prev) => Math.max(4, prev));
      setVoiceStatus('recorded');
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupRecordingTimersAndStream();
      setVoiceStatus('recorded');
    }
  };

  const startSimulatedRecording = () => {
    setIsSimulatedMic(true);
    setRecordSeconds(0);
    setVoiceStatus('recording');
    onClearError?.();

    let tick = 0;
    recordIntervalRef.current = window.setInterval(() => {
      tick += 1;
      setPulseBars([
        0.28 + 0.55 * Math.abs(Math.sin(tick * 0.9)),
        0.35 + 0.6 * Math.abs(Math.cos(tick * 1.1)),
        0.3 + 0.65 * Math.abs(Math.sin(tick * 1.4 + 0.6)),
        0.25 + 0.58 * Math.abs(Math.cos(tick * 0.8 + 1.2)),
        0.32 + 0.5 * Math.abs(Math.sin(tick * 1.2 + 2.0)),
      ]);
      if (tick % 5 === 0) {
        setRecordSeconds((prev) => prev + 1);
      }
    }, 200);
  };

  const startVoiceRecording = async () => {
    contrastAudioEngine.stopAll();
    casePlayerEngine.stop();
    onClearError?.();

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof window.MediaRecorder === 'undefined'
    ) {
      startSimulatedRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      setIsSimulatedMic(false);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (recordedBlobUrl) URL.revokeObjectURL(recordedBlobUrl);
        setRecordedBlobUrl(URL.createObjectURL(blob));
        setVoiceStatus('recorded');
        cleanupRecordingTimersAndStream();
      };

      let analyser: AnalyserNode | null = null;
      let freqBuf: Uint8Array<ArrayBuffer> | null = null;

      const ctx = createSafeAudioContext();
      if (ctx) {
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 32;
        src.connect(analyser);
        freqBuf = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      }

      setRecordSeconds(0);
      setVoiceStatus('recording');
      recorder.start();

      let tick = 0;
      recordIntervalRef.current = window.setInterval(() => {
        tick += 1;
        if (analyser && freqBuf) {
          analyser.getByteFrequencyData(freqBuf);
          setPulseBars([
            Math.max(0.22, Math.min(1, (freqBuf[1] ?? 0) / 210)),
            Math.max(0.25, Math.min(1, (freqBuf[3] ?? 0) / 200)),
            Math.max(0.28, Math.min(1, (freqBuf[5] ?? 0) / 190)),
            Math.max(0.24, Math.min(1, (freqBuf[7] ?? 0) / 200)),
            Math.max(0.22, Math.min(1, (freqBuf[9] ?? 0) / 210)),
          ]);
        }
        if (tick % 5 === 0) {
          setRecordSeconds((prev) => {
            if (prev >= 89) {
              stopVoiceRecording();
              return 90;
            }
            return prev + 1;
          });
        }
      }, 200);
    } catch {
      cleanupRecordingTimersAndStream();
      startSimulatedRecording();
    }
  };

  const togglePlaybackRecordedVoice = () => {
    if (isPlayingVoice) {
      if (htmlPlayerRef.current) htmlPlayerRef.current.pause();
      if (simPlaybackTimerRef.current !== null) {
        window.clearTimeout(simPlaybackTimerRef.current);
        simPlaybackTimerRef.current = null;
      }
      setIsPlayingVoice(false);
      return;
    }

    contrastAudioEngine.stopAll();
    casePlayerEngine.stop();

    if (!isSimulatedMic && recordedBlobUrl) {
      const audio = new Audio(recordedBlobUrl);
      htmlPlayerRef.current = audio;
      audio.onended = () => setIsPlayingVoice(false);
      setIsPlayingVoice(true);
      audio.play().catch(() => setIsPlayingVoice(false));
      return;
    }

    setIsPlayingVoice(true);
    const durSec = Math.min(6, Math.max(3, recordSeconds));
    simPlaybackTimerRef.current = window.setTimeout(() => {
      setIsPlayingVoice(false);
      simPlaybackTimerRef.current = null;
    }, durSec * 1000);
  };

  const containerClass =
    variant === 'primary'
      ? 'rounded-2xl p-4 sm:p-5 bg-[#EFECE5] dark:bg-[#16161B] border border-[#111111]/10 dark:border-white/10'
      : 'rounded-2xl p-4 bg-[#F7F6F2] dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10';

  const recordButtonClass =
    variant === 'primary'
      ? 'min-h-[44px] inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0'
      : 'min-h-[42px] inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#111111] hover:bg-[#FF4820] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0';

  return (
    <div className={containerClass}>
      {voiceStatus === 'idle' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            data-testid="drawer-voice-record-btn"
            onClick={() => void startVoiceRecording()}
            className={recordButtonClass}
          >
            <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{idleLabel}</span>
          </button>
          <span className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58">
            {idleHint}
          </span>
        </div>
      )}

      {voiceStatus === 'recording' && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF4820]" />
            <span className="text-sm font-semibold tabular-nums">
              Идёт запись · 0:{String(recordSeconds).padStart(2, '0')}
            </span>
            <div aria-hidden="true" className="flex items-end gap-1 h-5 ml-1">
              {pulseBars.map((bar, slot) => (
                <span
                  key={`voice-pulse-bar-${slot}`}
                  className={`w-1 bg-[#FF4820] rounded-full transition-all duration-150 ${getPulseBarHeightClass(
                    bar
                  )}`}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            data-testid="drawer-voice-stop-btn"
            onClick={stopVoiceRecording}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            <Square className="w-3 h-3 fill-current" aria-hidden="true" />
            <span>Готово</span>
          </button>
        </div>
      )}

      {voiceStatus === 'recorded' && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={togglePlaybackRecordedVoice}
              className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF4820] hover:bg-[#E63C17] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              {isPlayingVoice ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Пауза</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Прослушать</span>
                </>
              )}
            </button>

            <span className="text-xs sm:text-sm font-medium tabular-nums">
              Голосовое ТЗ · 0:{String(Math.max(1, recordSeconds)).padStart(2, '0')}
            </span>
          </div>

          <button
            type="button"
            onClick={deleteRecordedVoice}
            aria-label="Удалить голосовую запись"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#FF4820] transition-colors cursor-pointer shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
