export const DEFAULT_HERO_STUDIO_VIDEO_URL =
  '/assets/aistudio/Microphone_in_dark_recording_studio_f86c0561_1080p_69b99aaf.mp4';
export const DEFAULT_HERO_STUDIO_VIDEO_LABEL =
  'Студийная сцена FMWorks · ON AIR (1080p)';

export interface HeroVideoSnapshot {
  videoUrl: string;
  fileName: string;
  isCustomUploaded: boolean;
  videoError: string | null;
}

const DB_NAME = 'fmworks_hero_video_db_v1';
const STORE_NAME = 'hero_videos';
const RECORD_KEY = 'custom_hero_mp4';
const MAX_PERSISTED_VIDEO_BYTES = 180 * 1024 * 1024;

interface StoredVideoRecord {
  blob: Blob;
  fileName: string;
  savedAt: number;
}

function openVideoDb(): Promise<IDBDatabase | null> {
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

async function saveCustomVideoToDb(
  blob: Blob,
  fileName: string
): Promise<'saved' | 'quota_exceeded' | 'unavailable'> {
  if (blob.size > MAX_PERSISTED_VIDEO_BYTES) {
    return 'quota_exceeded';
  }
  const db = await openVideoDb();
  if (!db) return 'unavailable';
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: StoredVideoRecord = {
        blob,
        fileName,
        savedAt: Date.now(),
      };
      store.put(record, RECORD_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve('saved');
      };
      tx.onerror = () => {
        const isQuota =
          tx.error?.name === 'QuotaExceededError' ||
          tx.error?.name === 'NS_ERROR_DOM_QUOTA_REACHED';
        db.close();
        resolve(isQuota ? 'quota_exceeded' : 'unavailable');
      };
    } catch {
      db.close();
      resolve('unavailable');
    }
  });
}

async function loadCustomVideoFromDb(): Promise<StoredVideoRecord | null> {
  const db = await openVideoDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RECORD_KEY);
      req.onsuccess = () => {
        const res = req.result as StoredVideoRecord | undefined;
        db.close();
        if (res && res.blob instanceof Blob && res.blob.size > 0) {
          resolve(res);
          return;
        }
        resolve(null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

async function clearCustomVideoInDb(): Promise<void> {
  const db = await openVideoDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(RECORD_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

function isSupportedVideoFile(file: File): boolean {
  if (file.type && file.type.startsWith('video/')) {
    return true;
  }
  return /\.(mp4|webm|m4v|mov)$/i.test(file.name);
}

class HeroVideoStore {
  private snapshot: HeroVideoSnapshot = {
    videoUrl: DEFAULT_HERO_STUDIO_VIDEO_URL,
    fileName: DEFAULT_HERO_STUDIO_VIDEO_LABEL,
    isCustomUploaded: false,
    videoError: null,
  };
  private listeners = new Set<(snap: HeroVideoSnapshot) => void>();
  private hydrated = false;

  constructor() {
    if (typeof window !== 'undefined') {
      void this.hydrateFromIndexedDb();
    }
  }

  private async hydrateFromIndexedDb(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;
    const saved = await loadCustomVideoFromDb();
    if (!saved || this.snapshot.isCustomUploaded) return;
    const objectUrl = URL.createObjectURL(saved.blob);
    this.snapshot = {
      videoUrl: objectUrl,
      fileName: saved.fileName || 'hero-custom-video.mp4',
      isCustomUploaded: true,
      videoError: null,
    };
    this.emit();
  }

  private emit(): void {
    const current = this.snapshot;
    this.listeners.forEach((fn) => fn(current));
  }

  public getSnapshot(): HeroVideoSnapshot {
    return this.snapshot;
  }

  public subscribe(listener: (snap: HeroVideoSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setCustomVideoFile(file: File): void {
    if (!file || file.size <= 0 || !isSupportedVideoFile(file)) {
      this.snapshot = {
        ...this.snapshot,
        videoError:
          'Выберите корректный видеофайл MP4 (H.264) или WebM для фонового полотна.',
      };
      this.emit();
      return;
    }

    const prevUrl = this.snapshot.videoUrl;
    const objectUrl = URL.createObjectURL(file);
    if (prevUrl.startsWith('blob:') && prevUrl !== objectUrl) {
      try {
        URL.revokeObjectURL(prevUrl);
      } catch {
        // Ignore revoke error
      }
    }
    this.snapshot = {
      videoUrl: objectUrl,
      fileName: file.name,
      isCustomUploaded: true,
      videoError: null,
    };
    this.emit();

    void saveCustomVideoToDb(file, file.name).then((status) => {
      if (status === 'quota_exceeded' && this.snapshot.videoUrl === objectUrl) {
        this.snapshot = {
          ...this.snapshot,
          videoError:
            'Видео применено на этот сеанс, но файл слишком тяжёлый для автосохранения в кэш браузера.',
        };
        this.emit();
      }
    });
  }

  public reportPlaybackError(reason?: string): void {
    this.snapshot = {
      ...this.snapshot,
      videoError:
        reason ??
        'Браузер не смог декодировать выбранное видео (используйте MP4 в кодеке H.264 или WebM).',
    };
    this.emit();
  }

  public clearError(): void {
    if (!this.snapshot.videoError) return;
    this.snapshot = {
      ...this.snapshot,
      videoError: null,
    };
    this.emit();
  }

  public resetDefaultVideo(): void {
    const prevUrl = this.snapshot.videoUrl;
    if (prevUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(prevUrl);
      } catch {
        // Ignore revoke error
      }
    }
    this.snapshot = {
      videoUrl: DEFAULT_HERO_STUDIO_VIDEO_URL,
      fileName: DEFAULT_HERO_STUDIO_VIDEO_LABEL,
      isCustomUploaded: false,
      videoError: null,
    };
    this.emit();
    void clearCustomVideoInDb();
  }
}

export const heroVideoStore = new HeroVideoStore();
