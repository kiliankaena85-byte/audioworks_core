import { studioCmsStore } from '../cms/studioCmsStore';

export type DuelTrackKind = 'radio' | 'audioworks';

export interface DuelCustomTrackMeta {
  objectUrl: string;
  fileName: string;
  /** Чистая длительность воспроизведения (для DAW-экспортов с пустым хвостом после 15-й секунды ограничивается ~15.3 сек) */
  effectiveDurationSec: number;
  source: 'server' | 'local';
}

export interface DuelStoreSnapshot {
  radioTrack: DuelCustomTrackMeta | null;
  audioworksTrack: DuelCustomTrackMeta | null;
  isReadyOnServer: boolean;
  isUploadingToServer: boolean;
}

type DuelStoreListener = (snap: DuelStoreSnapshot) => void;

const DB_NAME = 'audioworks_studio_duel_db_v1';
const STORE_NAME = 'tracks';

interface StoredBlobRecord {
  blob: Blob;
  fileName: string;
}

interface ServerDuelTracksResponse {
  radio?: {
    url: string | null;
    fileName: string | null;
    durationSec: number;
  };
  audioworks?: {
    url: string | null;
    fileName: string | null;
    durationSec: number;
  };
  isReadyOnServer?: boolean;
}

/**
 * Распознаёт тип ролика по названию файла пользователя:
 * покрывает как «РАДИО», так и «Зерно и свет 15_РАДИР _mixdown.wav» (`ради`).
 */
export function classifyUploadedDuelFilename(fileName: string): DuelTrackKind {
  const lower = fileName.toLowerCase();
  if (
    lower.includes('ради') ||
    lower.includes('radi') ||
    lower.includes('штамп') ||
    lower.includes('обычн')
  ) {
    return 'radio';
  }
  return 'audioworks';
}

function openDuelDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveTrackToIdb(kind: DuelTrackKind, file: File): Promise<void> {
  const db = await openDuelDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(
        { blob: file, fileName: file.name } satisfies StoredBlobRecord,
        kind
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function deleteTrackFromIdb(kind: DuelTrackKind): Promise<void> {
  const db = await openDuelDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(kind);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function loadTrackFromIdb(kind: DuelTrackKind): Promise<StoredBlobRecord | null> {
  const db = await openDuelDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(kind);
      req.onsuccess = () => {
        const val = req.result as StoredBlobRecord | undefined;
        if (val && val.blob instanceof Blob && typeof val.fileName === 'string') {
          resolve(val);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function probeAudioEffectiveDuration(
  objectUrl: string,
  kind: DuelTrackKind
): Promise<number> {
  if (typeof window === 'undefined') {
    return Promise.resolve(kind === 'radio' ? 14.2 : 15.2);
  }
  return new Promise((resolve) => {
    const probe = new Audio();
    probe.preload = 'metadata';
    const fallback = kind === 'radio' ? 14.2 : 15.2;

    const cleanup = () => {
      probe.removeAttribute('src');
    };

    const timer = window.setTimeout(() => {
      cleanup();
      resolve(fallback);
    }, 2200);

    probe.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const raw =
        Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : fallback;
      cleanup();
      if (kind === 'audioworks' && raw > 35) {
        resolve(15.3);
        return;
      }
      if (kind === 'radio' && raw > 35) {
        resolve(14.5);
        return;
      }
      resolve(raw);
    };

    probe.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve(fallback);
    };

    probe.src = objectUrl;
  });
}

class DuelAudioStore {
  private radioTrack: DuelCustomTrackMeta | null = null;
  private audioworksTrack: DuelCustomTrackMeta | null = null;
  private isReadyOnServer = false;
  private isUploadingToServer = false;
  private listeners = new Set<DuelStoreListener>();
  private hydrated = false;

  public subscribe(listener: DuelStoreListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    if (!this.hydrated && typeof window !== 'undefined') {
      this.hydrated = true;
      void this.hydrateFromServerAndIdb();
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): DuelStoreSnapshot {
    return {
      radioTrack: this.radioTrack,
      audioworksTrack: this.audioworksTrack,
      isReadyOnServer: this.isReadyOnServer,
      isUploadingToServer: this.isUploadingToServer,
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  private applyServerPayload(data: ServerDuelTracksResponse): void {
    if (data.radio?.url) {
      this.radioTrack = {
        objectUrl: data.radio.url,
        fileName: data.radio.fileName ?? 'zerno_radio_15.wav',
        effectiveDurationSec: data.radio.durationSec || 14.2,
        source: 'server',
      };
    }
    if (data.audioworks?.url) {
      this.audioworksTrack = {
        objectUrl: data.audioworks.url,
        fileName: data.audioworks.fileName ?? 'zerno_audioworks_15.wav',
        effectiveDurationSec: data.audioworks.durationSec || 15.2,
        source: 'server',
      };
    }
    this.isReadyOnServer = Boolean(data.isReadyOnServer);
  }

  public async refreshFromServer(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const resp = await fetch('/api/duel-tracks');
      if (!resp.ok) return;
      const data = (await resp.json()) as ServerDuelTracksResponse;
      this.applyServerPayload(data);
      this.emit();
    } catch {
      // Ignore network errors if offline
    }
  }

  private async hydrateFromServerAndIdb(): Promise<void> {
    await this.refreshFromServer();

    if (this.radioTrack && this.audioworksTrack) {
      return;
    }

    const [savedRadio, savedAw] = await Promise.all([
      loadTrackFromIdb('radio'),
      loadTrackFromIdb('audioworks'),
    ]);

    let changed = false;

    if (savedRadio && !this.radioTrack) {
      const url = URL.createObjectURL(savedRadio.blob);
      const dur = await probeAudioEffectiveDuration(url, 'radio');
      this.radioTrack = {
        objectUrl: url,
        fileName: savedRadio.fileName,
        effectiveDurationSec: dur,
        source: 'local',
      };
      changed = true;
      // Автоматически синхронизируем локальный кэш на сервер проекта
      void this.uploadBlobToServer('radio', savedRadio.blob);
    }

    if (savedAw && !this.audioworksTrack) {
      const url = URL.createObjectURL(savedAw.blob);
      const dur = await probeAudioEffectiveDuration(url, 'audioworks');
      this.audioworksTrack = {
        objectUrl: url,
        fileName: savedAw.fileName,
        effectiveDurationSec: dur,
        source: 'local',
      };
      changed = true;
      void this.uploadBlobToServer('audioworks', savedAw.blob);
    }

    if (changed) {
      this.emit();
    }
  }

  private async uploadBlobToServer(kind: DuelTrackKind, blob: Blob): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!studioCmsStore.isStudioSessionActive()) return;
    this.isUploadingToServer = true;
    this.emit();
    try {
      const buf = await blob.arrayBuffer();
      const resp = await fetch(`/api/duel-tracks/${kind}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          ...studioCmsStore.getAuthHeaders(),
          'Content-Type': blob.type || 'audio/wav',
        },
        body: buf,
      });
      if (resp.ok) {
        const data = (await resp.json()) as ServerDuelTracksResponse;
        this.applyServerPayload(data);
      }
    } catch {
      // Keep local IndexedDB playback if server upload fails
    } finally {
      this.isUploadingToServer = false;
      this.emit();
    }
  }

  public async attachFile(kind: DuelTrackKind, file: File): Promise<DuelCustomTrackMeta> {
    const objectUrl = URL.createObjectURL(file);
    const effectiveDurationSec = await probeAudioEffectiveDuration(objectUrl, kind);
    const meta: DuelCustomTrackMeta = {
      objectUrl,
      fileName: file.name,
      effectiveDurationSec,
      source: 'local',
    };

    const prev = kind === 'radio' ? this.radioTrack : this.audioworksTrack;
    if (prev && prev.objectUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(prev.objectUrl);
      } catch {
        // Ignore
      }
    }

    if (kind === 'radio') {
      this.radioTrack = meta;
    } else {
      this.audioworksTrack = meta;
    }

    this.emit();
    await Promise.all([saveTrackToIdb(kind, file), this.uploadBlobToServer(kind, file)]);
    return (kind === 'radio' ? this.radioTrack : this.audioworksTrack) ?? meta;
  }

  /**
   * Пакетная загрузка сразу 2 файлов:
   * безошибочно распознаёт «Зерно и свет 15_РАДИР _mixdown.wav» -> radio
   * и «Зерно и свет 15_mixdown.wav» -> audioworks.
   */
  public async attachPairOrList(files: FileList | File[]): Promise<void> {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    if (arr.length === 1) {
      const f = arr[0];
      const detected = classifyUploadedDuelFilename(f.name);
      await this.attachFile(detected, f);
      return;
    }

    const first = arr[0];
    const second = arr[1];
    const firstKind = classifyUploadedDuelFilename(first.name);
    const secondKind = classifyUploadedDuelFilename(second.name);

    if (firstKind === 'radio' && secondKind === 'audioworks') {
      await Promise.all([
        this.attachFile('radio', first),
        this.attachFile('audioworks', second),
      ]);
      return;
    }

    if (secondKind === 'radio' && firstKind === 'audioworks') {
      await Promise.all([
        this.attachFile('radio', second),
        this.attachFile('audioworks', first),
      ]);
      return;
    }

    // Если оба файла без явных маркеров — первый в радио, второй в наш пример AudioWorks
    await Promise.all([
      this.attachFile('radio', first),
      this.attachFile('audioworks', second),
    ]);
  }

  public async clearTrack(kind: DuelTrackKind): Promise<void> {
    const prev = kind === 'radio' ? this.radioTrack : this.audioworksTrack;
    if (prev && prev.objectUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(prev.objectUrl);
      } catch {
        // Ignore
      }
    }
    if (kind === 'radio') {
      this.radioTrack = null;
    } else {
      this.audioworksTrack = null;
    }
    this.isReadyOnServer = false;
    this.emit();
    await deleteTrackFromIdb(kind);
  }
}

export const duelAudioStore = new DuelAudioStore();
