/**
 * Утилиты ограничения памяти и своевременной очистки TTL-реестров и SSE-клиентов
 * в долгоживущем процессе Express (`server.ts`).
 */

export const MAX_CHALLENGE_NONCE_ENTRIES = 5_000;
export const MAX_RECENT_FINGERPRINT_ENTRIES = 5_000;
export const MAX_CONCURRENT_CABINET_SSE_CLIENTS = 64;

/**
 * Удаляет все просроченные записи (`expiresAt <= nowMs`) из `Map<string, number>`.
 * Возвращает количество удалённых ключей.
 */
export function pruneExpiredTtlEntries(
  registry: Map<string, number>,
  nowMs: number = Date.now()
): number {
  let removed = 0;
  for (const [key, expiresAt] of registry.entries()) {
    if (expiresAt <= nowMs) {
      registry.delete(key);
      removed += 1;
    }
  }
  return removed;
}

/**
 * Записывает ключ с TTL в `Map<string, number>` с жёстким верхним пределом `maxEntries`
 * (FIFO-вытеснение самых старых записей после очистки истёкших), исключая утечку RAM при флуде.
 */
export function setBoundedTtlEntry(
  registry: Map<string, number>,
  key: string,
  expiresAtMs: number,
  maxEntries: number,
  nowMs: number = Date.now()
): void {
  if (registry.has(key)) {
    registry.delete(key);
  }
  if (registry.size >= maxEntries) {
    pruneExpiredTtlEntries(registry, nowMs);
  }
  while (registry.size >= maxEntries) {
    const oldest = registry.keys().next();
    if (oldest.done) break;
    registry.delete(oldest.value);
  }
  registry.set(key, expiresAtMs);
}

/**
 * Ограничивает число одновременных открытых SSE-соединений клиентского кабинета,
 * аккуратно закрывая самое старое соединение при превышении `maxClients`.
 */
export function evictExcessSseClients<
  TClient extends {
    id: string;
    heartbeatTimer: ReturnType<typeof setInterval>;
    res: { end: () => void };
  },
>(clients: Map<string, TClient>, maxClients: number = MAX_CONCURRENT_CABINET_SSE_CLIENTS): number {
  let evicted = 0;
  while (clients.size >= maxClients) {
    const oldest = clients.values().next();
    if (oldest.done) break;
    const victim = oldest.value;
    clients.delete(victim.id);
    clearInterval(victim.heartbeatTimer);
    try {
      victim.res.end();
    } catch {
      // Ignore already-closed socket
    }
    evicted += 1;
  }
  return evicted;
}
