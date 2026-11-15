export type AudioFocusChannelId =
  | 'contrast_hero'
  | 'case_player'
  | 'broadcast_aircheck'
  | 'fifteen_sec_duel'
  | 'voice_brief_recorder';

type AudioFocusListener = (activeChannel: AudioFocusChannelId) => void;

const focusListeners = new Set<AudioFocusListener>();

/**
 * Уведомляет все уже загруженные аудиодвижки, что указанный канал забрал фокус воспроизведения,
 * позволяя остановить конкурирующий звук без статического импорта соседних движков.
 */
export function claimExclusiveAudioFocus(activeChannel: AudioFocusChannelId): void {
  focusListeners.forEach((listener) => {
    try {
      listener(activeChannel);
    } catch {
      // Игнорируем локальные ошибки отдельных слушателей фокуса
    }
  });
}

/**
 * Подписывает аудиодвижок или компонент на перехват аудиофокуса другими источниками звука.
 */
export function onExclusiveAudioFocusClaimed(
  listener: AudioFocusListener
): () => void {
  focusListeners.add(listener);
  return () => {
    focusListeners.delete(listener);
  };
}
