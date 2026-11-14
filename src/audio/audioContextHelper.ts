type WindowWithWebkitAudio = typeof globalThis & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

/**
 * Безопасно возвращает конструктор Web Audio API (включая префикс Safari)
 * без небезопасных приведений типов в прикладных модулях.
 */
export function resolveAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const win = window as WindowWithWebkitAudio;
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

/**
 * Создаёт новый экземпляр AudioContext или возвращает null,
 * если среда исполнения не поддерживает Web Audio API.
 */
export function createSafeAudioContext(): AudioContext | null {
  const AudioCtx = resolveAudioContextConstructor();
  if (!AudioCtx) return null;
  try {
    return new AudioCtx();
  } catch {
    return null;
  }
}
