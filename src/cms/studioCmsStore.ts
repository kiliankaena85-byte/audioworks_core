import {
  auditEditorialCopyGuardrails,
  createDefaultStudioCmsSnapshot,
  StudioCmsSnapshot,
  validateAndNormalizeCmsSnapshot,
} from '../data/studioCmsTypes';

export interface StudioCmsState {
  snapshot: StudioCmsSnapshot;
  isCustomizedOnServer: boolean;
  isHydrated: boolean;
  isAuthenticated: boolean;
  isAuthChecking: boolean;
  isSaving: boolean;
  editorialWarnings: string[];
}

type StudioCmsListener = (state: StudioCmsState) => void;

const TOKEN_STORAGE_KEY = 'audioworks_cms_session_token_v1';

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

export interface UploadedAudioResult {
  url: string;
  fileName: string;
  durationSec: number;
}

export interface UploadedImageResult {
  url: string;
  fileName: string;
}

class StudioCmsStore {
  private state: StudioCmsState = {
    snapshot: createDefaultStudioCmsSnapshot(),
    isCustomizedOnServer: false,
    isHydrated: false,
    isAuthenticated: false,
    isAuthChecking: true,
    isSaving: false,
    editorialWarnings: [],
  };

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
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
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

      if (payload.customized && payload.snapshot) {
        const parsed = validateAndNormalizeCmsSnapshot(payload.snapshot);
        if (parsed.ok) {
          this.emit({
            snapshot: parsed.data,
            isCustomizedOnServer: true,
            isHydrated: true,
            editorialWarnings: parsed.editorialWarnings,
          });
          return;
        }
      }

      const defaults = createDefaultStudioCmsSnapshot();
      this.emit({
        snapshot: defaults,
        isCustomizedOnServer: false,
        isHydrated: true,
        editorialWarnings: auditEditorialCopyGuardrails(defaults),
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

  public async login(password: string): Promise<{ ok: true } | { ok: false; error: string }> {
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
        writeStoredToken(null);
        this.emit({ isAuthenticated: false, isSaving: false });
        return { ok: false, error: 'Сессия истекла. Войдите в кабинет заново.' };
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

      this.emit({
        snapshot: nextSnap,
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
    const token = readStoredToken();
    if (!token) {
      this.emit({ isAuthenticated: false });
      return { ok: false, error: 'Сессия истекла. Войдите снова.' };
    }

    try {
      const resp = await fetch('/api/cms/reset', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (resp.status === 401) {
        writeStoredToken(null);
        this.emit({ isAuthenticated: false });
        return { ok: false, error: 'Сессия истекла. Войдите снова.' };
      }
      if (!resp.ok) {
        return { ok: false, error: 'Не удалось сбросить настройки CMS' };
      }

      const freshDefaults = createDefaultStudioCmsSnapshot();
      this.emit({
        snapshot: freshDefaults,
        isCustomizedOnServer: false,
        editorialWarnings: [],
      });
      return { ok: true, snapshot: freshDefaults };
    } catch {
      return { ok: false, error: 'Сбой сети при сбросе настроек' };
    }
  }

  public async uploadAudioFile(
    file: File
  ): Promise<{ ok: true; result: UploadedAudioResult } | { ok: false; error: string }> {
    const token = readStoredToken();
    if (!token) {
      this.emit({ isAuthenticated: false });
      return { ok: false, error: 'Сессия истекла. Войдите снова.' };
    }

    try {
      const buffer = await file.arrayBuffer();
      const resp = await fetch('/api/cms/upload-audio', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': file.type || 'audio/wav',
          'X-File-Name': encodeURIComponent(file.name),
        },
        body: buffer,
      });

      const data = (await resp.json()) as {
        ok?: boolean;
        url?: string;
        fileName?: string;
        durationSec?: number;
        error?: string;
      };

      if (resp.status === 401) {
        writeStoredToken(null);
        this.emit({ isAuthenticated: false });
        return { ok: false, error: 'Сессия истекла. Войдите снова.' };
      }

      if (!resp.ok || !data.ok || !data.url) {
        return {
          ok: false,
          error: data.error || 'Не удалось загрузить аудиофайл',
        };
      }

      return {
        ok: true,
        result: {
          url: data.url,
          fileName: data.fileName || file.name,
          durationSec: data.durationSec || 15,
        },
      };
    } catch {
      return { ok: false, error: 'Ошибка передачи аудиофайла на сервер' };
    }
  }

  public async uploadImageFile(
    file: File
  ): Promise<{ ok: true; result: UploadedImageResult } | { ok: false; error: string }> {
    const token = readStoredToken();
    if (!token) {
      this.emit({ isAuthenticated: false });
      return { ok: false, error: 'Сессия истекла. Войдите снова.' };
    }

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

      const data = (await resp.json()) as {
        ok?: boolean;
        url?: string;
        fileName?: string;
        error?: string;
      };

      if (resp.status === 401) {
        writeStoredToken(null);
        this.emit({ isAuthenticated: false });
        return { ok: false, error: 'Сессия истекла. Войдите снова.' };
      }

      if (!resp.ok || !data.ok || !data.url) {
        return {
          ok: false,
          error: data.error || 'Не удалось загрузить обложку',
        };
      }

      return {
        ok: true,
        result: {
          url: data.url,
          fileName: data.fileName || file.name,
        },
      };
    } catch {
      return { ok: false, error: 'Ошибка передачи изображения на сервер' };
    }
  }
}

export const studioCmsStore = new StudioCmsStore();
