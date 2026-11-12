import {
  countLocalPortfolioChanges,
  parseWavDurationFromBuffer,
  validatePortfolioAudioFileMeta,
} from '../data/portfolioWave1Helpers';
import {
  auditEditorialCopyGuardrails,
  createDefaultStudioCmsSnapshot,
  PortfolioCaseRecord,
  StudioCmsSnapshot,
  validateAndNormalizeCmsSnapshot,
} from '../data/studioCmsTypes';

export interface StudioCmsState {
  snapshot: StudioCmsSnapshot;
  baselineSnapshot: StudioCmsSnapshot;
  hasLocalChanges: boolean;
  localPortfolioChangeCount: number;
  isCustomizedOnServer: boolean;
  isHydrated: boolean;
  isAuthenticated: boolean;
  isAuthChecking: boolean;
  isSaving: boolean;
  editorialWarnings: string[];
}

type StudioCmsListener = (state: StudioCmsState) => void;

const TOKEN_STORAGE_KEY = 'audioworks_cms_session_token_v1';
const LOCAL_CMS_DRAFT_KEY = 'fmworks_cms_local_state_v2';

function stripTimestamp(
  snap: StudioCmsSnapshot
): Omit<StudioCmsSnapshot, 'updatedAt'> {
  const { updatedAt: _ignored, ...rest } = snap;
  return rest;
}

function areSnapshotsEqual(a: StudioCmsSnapshot, b: StudioCmsSnapshot): boolean {
  return JSON.stringify(stripTimestamp(a)) === JSON.stringify(stripTimestamp(b));
}

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return (
      window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
      window.localStorage.getItem(TOKEN_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

function sanitizeCaseForSessionStorage(
  item: PortfolioCaseRecord,
  fallbackAudioUrl?: string
): PortfolioCaseRecord {
  if (item.audioUrl && item.audioUrl.startsWith('blob:')) {
    return {
      ...item,
      audioUrl: fallbackAudioUrl,
    };
  }
  return item;
}

function readLocalDraftSnapshot(
  baseline: StudioCmsSnapshot
): StudioCmsSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(LOCAL_CMS_DRAFT_KEY);
    if (!raw) return null;
    const parsedJson = JSON.parse(raw) as unknown;
    const validated = validateAndNormalizeCmsSnapshot(parsedJson);
    if (!validated.ok) return null;

    const baseById = new Map(baseline.portfolioCases.map((c) => [c.id, c]));
    return {
      ...validated.data,
      flagshipReel: sanitizeCaseForSessionStorage(
        validated.data.flagshipReel,
        baseline.flagshipReel.audioUrl
      ),
      portfolioCases: validated.data.portfolioCases.map((c) =>
        sanitizeCaseForSessionStorage(c, baseById.get(c.id)?.audioUrl)
      ),
    };
  } catch {
    return null;
  }
}

function writeLocalDraftSnapshot(
  snapshot: StudioCmsSnapshot | null,
  baseline: StudioCmsSnapshot
): void {
  if (typeof window === 'undefined') return;
  try {
    if (!snapshot || areSnapshotsEqual(snapshot, baseline)) {
      window.sessionStorage.removeItem(LOCAL_CMS_DRAFT_KEY);
      return;
    }

    const baseById = new Map(baseline.portfolioCases.map((c) => [c.id, c]));
    const safeToStore: StudioCmsSnapshot = {
      ...snapshot,
      flagshipReel: sanitizeCaseForSessionStorage(
        snapshot.flagshipReel,
        baseline.flagshipReel.audioUrl
      ),
      portfolioCases: snapshot.portfolioCases.map((c) =>
        sanitizeCaseForSessionStorage(c, baseById.get(c.id)?.audioUrl)
      ),
    };
    window.sessionStorage.setItem(LOCAL_CMS_DRAFT_KEY, JSON.stringify(safeToStore));
  } catch {
    // Ignore sessionStorage quota errors
  }
}

async function probeBrowserAudioDuration(objectUrl: string): Promise<number | null> {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    return null;
  }

  return new Promise<number | null>((resolve) => {
    const audio = new Audio();
    let settled = false;
    const finish = (val: number | null) => {
      if (settled) return;
      settled = true;
      audio.src = '';
      resolve(val);
    };

    const timer = window.setTimeout(() => finish(null), 2200);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        finish(Math.round(audio.duration * 100) / 100);
      } else {
        finish(null);
      }
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
    audio.src = objectUrl;
  });
}

export interface UploadedAudioResult {
  url: string;
  fileName: string;
  durationSec: number;
  format: 'WAV' | 'MP3';
  storageMode: 'local' | 'server';
}

export interface UploadedImageResult {
  url: string;
  fileName: string;
}

class StudioCmsStore {
  private state: StudioCmsState = (() => {
    const initialBaseline = createDefaultStudioCmsSnapshot();
    const restoredDraft = readLocalDraftSnapshot(initialBaseline);
    const activeSnap = restoredDraft ?? initialBaseline;
    return {
      snapshot: activeSnap,
      baselineSnapshot: initialBaseline,
      hasLocalChanges: !areSnapshotsEqual(activeSnap, initialBaseline),
      localPortfolioChangeCount: countLocalPortfolioChanges(
        activeSnap,
        initialBaseline
      ),
      isCustomizedOnServer: false,
      isHydrated: false,
      isAuthenticated: false,
      isAuthChecking: true,
      isSaving: false,
      editorialWarnings: auditEditorialCopyGuardrails(activeSnap),
    };
  })();

  private listeners = new Set<StudioCmsListener>();
  private bootStarted = false;

  public subscribe(listener: StudioCmsListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    if (!this.bootStarted && typeof window !== 'undefined') {
      this.bootStarted = true;
      void this.bootstrap();
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): StudioCmsState {
    return this.state;
  }

  private emit(patch: Partial<StudioCmsState>): void {
    const nextSnapshot = patch.snapshot ?? this.state.snapshot;
    const nextBaseline = patch.baselineSnapshot ?? this.state.baselineSnapshot;
    this.state = {
      ...this.state,
      ...patch,
      snapshot: nextSnapshot,
      baselineSnapshot: nextBaseline,
      hasLocalChanges: !areSnapshotsEqual(nextSnapshot, nextBaseline),
      localPortfolioChangeCount: countLocalPortfolioChanges(
        nextSnapshot,
        nextBaseline
      ),
      editorialWarnings:
        patch.editorialWarnings ?? auditEditorialCopyGuardrails(nextSnapshot),
    };
    this.listeners.forEach((fn) => fn(this.state));
  }

  /**
   * Мгновенно обновляет локальное состояние CMS (в памяти сессии и витрине сайта без ожидания сервера).
   */
  public updateLocalSnapshot(
    updater:
      | StudioCmsSnapshot
      | ((prev: StudioCmsSnapshot) => StudioCmsSnapshot)
  ): StudioCmsSnapshot {
    const nextRaw =
      typeof updater === 'function' ? updater(this.state.snapshot) : updater;
    const nextStamped: StudioCmsSnapshot = {
      ...nextRaw,
      updatedAt: new Date().toISOString(),
    };
    writeLocalDraftSnapshot(nextStamped, this.state.baselineSnapshot);
    this.emit({ snapshot: nextStamped });
    return nextStamped;
  }

  /**
   * Отменяет локальные несохранённые правки и возвращает состояние к серверному/заводскому эталону.
   */
  public discardLocalChanges(): void {
    writeLocalDraftSnapshot(null, this.state.baselineSnapshot);
    this.emit({
      snapshot: this.state.baselineSnapshot,
    });
  }

  private async bootstrap(): Promise<void> {
    await Promise.all([this.refreshContent(), this.verifySession()]);
  }

  public async refreshContent(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const resp = await fetch('/api/cms/content');
      if (!resp.ok) {
        this.emit({ isHydrated: true });
        return;
      }
      const payload = (await resp.json()) as {
        customized?: boolean;
        snapshot?: unknown;
        editorialWarnings?: string[];
      };

      let serverBaseline = createDefaultStudioCmsSnapshot();
      let customized = false;

      if (payload.customized && payload.snapshot) {
        const parsed = validateAndNormalizeCmsSnapshot(payload.snapshot);
        if (parsed.ok) {
          serverBaseline = parsed.data;
          customized = true;
        }
      }

      const localDraft = readLocalDraftSnapshot(serverBaseline);
      const nextActive = this.state.hasLocalChanges
        ? this.state.snapshot
        : localDraft ?? serverBaseline;

      this.emit({
        snapshot: nextActive,
        baselineSnapshot: serverBaseline,
        isCustomizedOnServer: customized,
        isHydrated: true,
      });
    } catch {
      this.emit({ isHydrated: true });
    }
  }

  public async verifySession(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const token = readStoredToken();
    if (!token) {
      this.emit({ isAuthenticated: false, isAuthChecking: false });
      return false;
    }

    try {
      const resp = await fetch('/api/cms/auth/session', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!resp.ok) {
        writeStoredToken(null);
        this.emit({ isAuthenticated: false, isAuthChecking: false });
        return false;
      }
      const data = (await resp.json()) as { authenticated?: boolean };
      const ok = Boolean(data.authenticated);
      if (!ok) {
        writeStoredToken(null);
      }
      this.emit({ isAuthenticated: ok, isAuthChecking: false });
      return ok;
    } catch {
      this.emit({ isAuthenticated: false, isAuthChecking: false });
      return false;
    }
  }

  public async login(
    password: string
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const resp = await fetch('/api/cms/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        token?: string;
        error?: string;
      };

      if (!resp.ok || !data.ok || !data.token) {
        return {
          ok: false,
          error: data.error || 'Неверный пароль студии',
        };
      }

      writeStoredToken(data.token);
      this.emit({ isAuthenticated: true, isAuthChecking: false });
      return { ok: true };
    } catch {
      return {
        ok: false,
        error: 'Не удалось связаться с сервером студии',
      };
    }
  }

  public async logout(): Promise<void> {
    const token = readStoredToken();
    writeStoredToken(null);
    this.emit({ isAuthenticated: false, isAuthChecking: false });
    if (token) {
      try {
        await fetch('/api/cms/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Ignore network errors
      }
    }
  }

  public async saveSnapshot(
    candidate: StudioCmsSnapshot
  ): Promise<
    | { ok: true; snapshot: StudioCmsSnapshot; warnings: string[] }
    | { ok: false; error: string }
  > {
    const validated = validateAndNormalizeCmsSnapshot(candidate);
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }

    const token = readStoredToken();
    if (!token) {
      this.emit({ isAuthenticated: false, isSaving: false });
      return { ok: false, error: 'Сессия истекла. Пожалуйста, войдите снова.' };
    }

    this.emit({ isSaving: true });
    try {
      const resp = await fetch('/api/cms/content', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ snapshot: validated.data }),
      });

      const payload = (await resp.json()) as {
        ok?: boolean;
        snapshot?: StudioCmsSnapshot;
        editorialWarnings?: string[];
        error?: string;
      };

      if (resp.status === 401) {
        this.emit({ isSaving: false });
        return {
          ok: false,
          error:
            'Изменения уже активны в локальном состоянии CMS. Для записи на диск войдите по паролю сервера.',
        };
      }

      if (!resp.ok || !payload.ok || !payload.snapshot) {
        this.emit({ isSaving: false });
        return {
          ok: false,
          error: payload.error || 'Ошибка сохранения изменений',
        };
      }

      const revalidated = validateAndNormalizeCmsSnapshot(payload.snapshot);
      const nextSnap = revalidated.ok ? revalidated.data : validated.data;
      const warnings =
        payload.editorialWarnings ?? auditEditorialCopyGuardrails(nextSnap);

      writeLocalDraftSnapshot(null, nextSnap);
      this.emit({
        snapshot: nextSnap,
        baselineSnapshot: nextSnap,
        isCustomizedOnServer: true,
        isSaving: false,
        editorialWarnings: warnings,
      });
      return { ok: true, snapshot: nextSnap, warnings };
    } catch {
      this.emit({ isSaving: false });
      return { ok: false, error: 'Сбой сети при сохранении контента' };
    }
  }

  public async resetToDefaults(): Promise<
    { ok: true; snapshot: StudioCmsSnapshot } | { ok: false; error: string }
  > {
    const freshDefaults = createDefaultStudioCmsSnapshot();
    const token = readStoredToken();

    if (token) {
      try {
        await fetch('/api/cms/reset', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Proceed with local reset even if offline
      }
    }

    writeLocalDraftSnapshot(null, freshDefaults);
    this.emit({
      snapshot: freshDefaults,
      baselineSnapshot: freshDefaults,
      isCustomizedOnServer: false,
      editorialWarnings: [],
    });
    return { ok: true, snapshot: freshDefaults };
  }

  /**
   * Загружает аудиофайл WAV/MP3: валидирует формат, измеряет точную длительность в браузере
   * и сразу подключает в локальное состояние CMS (плюс синхронизирует с сервером при активном токене).
   */
  public async uploadAudioFile(
    file: File
  ): Promise<
    { ok: true; result: UploadedAudioResult } | { ok: false; error: string }
  > {
    const check = validatePortfolioAudioFileMeta({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (!check.ok) {
      return check;
    }

    let buffer: ArrayBuffer;
    try {
      buffer = await file.arrayBuffer();
    } catch {
      return { ok: false, error: 'Не удалось прочитать выбранный аудиофайл' };
    }

    const wavMeasuredSec =
      check.format === 'WAV' ? parseWavDurationFromBuffer(buffer) : null;

    const localObjectUrl =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : '';

    const browserMeasuredSec =
      wavMeasuredSec ??
      (localObjectUrl ? await probeBrowserAudioDuration(localObjectUrl) : null) ??
      15;

    const token = readStoredToken();
    if (token) {
      try {
        const resp = await fetch('/api/cms/upload-audio', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type':
              file.type || (check.format === 'MP3' ? 'audio/mpeg' : 'audio/wav'),
            'X-File-Name': encodeURIComponent(file.name),
          },
          body: buffer,
        });

        if (resp.ok) {
          const data = (await resp.json()) as {
            ok?: boolean;
            url?: string;
            fileName?: string;
            durationSec?: number;
          };
          if (data.ok && data.url) {
            if (localObjectUrl && typeof URL.revokeObjectURL === 'function') {
              URL.revokeObjectURL(localObjectUrl);
            }
            return {
              ok: true,
              result: {
                url: data.url,
                fileName: data.fileName || file.name,
                durationSec: data.durationSec || browserMeasuredSec,
                format: check.format,
                storageMode: 'server',
              },
            };
          }
        }
      } catch {
        // Fallback to local ObjectURL in CMS session state
      }
    }

    return {
      ok: true,
      result: {
        url: localObjectUrl || `/assets/cms/${encodeURIComponent(file.name)}`,
        fileName: file.name,
        durationSec: browserMeasuredSec,
        format: check.format,
        storageMode: 'local',
      },
    };
  }

  public async uploadImageFile(
    file: File
  ): Promise<
    { ok: true; result: UploadedImageResult } | { ok: false; error: string }
  > {
    if (!file || file.size <= 0) {
      return { ok: false, error: 'Выбран пустой файл изображения' };
    }

    const token = readStoredToken();
    if (token) {
      try {
        const buffer = await file.arrayBuffer();
        const resp = await fetch('/api/cms/upload-image', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': file.type || 'image/jpeg',
            'X-File-Name': encodeURIComponent(file.name),
          },
          body: buffer,
        });

        if (resp.ok) {
          const data = (await resp.json()) as {
            ok?: boolean;
            url?: string;
            fileName?: string;
          };
          if (data.ok && data.url) {
            return {
              ok: true,
              result: {
                url: data.url,
                fileName: data.fileName || file.name,
              },
            };
          }
        }
      } catch {
        // Fallback to local ObjectURL
      }
    }

    const localImageUrl =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : '';

    if (!localImageUrl) {
      return { ok: false, error: 'Не удалось подготовить обложку' };
    }

    return {
      ok: true,
      result: {
        url: localImageUrl,
        fileName: file.name,
      },
    };
  }
}

export const studioCmsStore = new StudioCmsStore();
