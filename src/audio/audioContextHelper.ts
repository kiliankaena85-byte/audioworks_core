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

/**
 * Синхронно разблокирует AudioContext внутри мобильного жеста пользователя (iOS Safari / Android Chrome),
 * запуская 1-сэмпловый беззвучный буфер, чтобы контекст не уходил обратно в suspended при асинхронном декодировании.
 */
export function unlockAudioContextOnGesture(ctx: AudioContext | null): void {
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (ctx.state !== 'running') {
    try {
      const silentBuffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silentBuffer;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      // Ignore in mocked or restricted environments
    }
  }
}
