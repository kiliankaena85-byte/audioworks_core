import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import express, { Request, Response, NextFunction } from 'express';
import type { StudioCmsSnapshot } from './src/data/studioCmsTypes';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_AUDIO_DIR = path.join(__dirname, 'public', 'assets', 'aistudio');
const DIST_AUDIO_DIR = path.join(__dirname, 'dist', 'assets', 'aistudio');
const PUBLIC_CMS_MEDIA_DIR = path.join(__dirname, 'public', 'assets', 'cms');
const DIST_CMS_MEDIA_DIR = path.join(__dirname, 'dist', 'assets', 'cms');
const CMS_DATA_DIR = path.join(__dirname, '.data');
const CMS_SNAPSHOT_FILE = path.join(CMS_DATA_DIR, 'studio-cms.json');
const CMS_BACKUP_FILE = path.join(CMS_DATA_DIR, 'studio-cms.last-reset.bak.json');

const MAIN_PROMO_FILENAME = 'Audioworks_75c6023f.wav';
const CANONICAL_RADIO_FILE = 'zerno_radio_15.wav';
const CANONICAL_AUDIOWORKS_FILE = 'zerno_audioworks_15.wav';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SERVER_BANNED_TERMS = [
  'fm-тракт',
  'спектрограмма',
  'компрессор',
  'стемы',
  'дешевые биржи',
  'честная московская цена',
  'москв',
  'петерб',
  'питер',
  'мск',
  'спб',
  'moscow',
  'spb',
] as const;

interface ResolvedTrackInfo {
  url: string | null;
  fileName: string | null;
  durationSec: number;
}

const durationCache = new Map<string, { mtimeMs: number; durationSec: number }>();
let cachedCmsSnapshot: StudioCmsSnapshot | null | undefined = undefined;

function getStudioAdminPassword(): string {
  const fromEnv = process.env.STUDIO_ADMIN_PASSWORD?.trim();
  if (fromEnv && fromEnv !== 'CHANGE_ME_STUDIO_PASSWORD') {
    return fromEnv;
  }
  return 'audioworks';
}

function getSessionSecret(): string {
  const fromEnv = process.env.CMS_SESSION_SECRET?.trim();
  if (fromEnv && fromEnv !== 'CHANGE_ME_RANDOM_SESSION_SECRET') {
    return fromEnv;
  }
  return `audioworks-cms-hmac-${getStudioAdminPassword()}-v1`;
}

function safeCompareStrings(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function issueAdminToken(): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = Buffer.from(
    JSON.stringify({ role: 'studio_admin', exp: expiresAt, nonce }),
    'utf8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  return {
    token: `${payload}.${sig}`,
    expiresAt,
  };
}

function verifyAdminToken(rawToken: string | undefined): boolean {
  if (!rawToken || typeof rawToken !== 'string') return false;
  const parts = rawToken.trim().split('.');
  if (parts.length !== 2) return false;
  const [payload, providedSig] = parts;
  if (!payload || !providedSig) return false;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');

  if (!safeCompareStrings(providedSig, expectedSig)) {
    return false;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as { role?: string; exp?: number };
    if (parsed.role !== 'studio_admin') return false;
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return undefined;
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return undefined;
}

function requireStudioAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!verifyAdminToken(token)) {
    res.status(401).json({
      error: 'Требуется авторизация в кабинете студии',
    });
    return;
  }
  next();
}

function scanEditorialWarnings(payload: unknown): string[] {
  const lower = JSON.stringify(payload).toLowerCase();
  const warnings: string[] = [];
  for (const term of SERVER_BANNED_TERMS) {
    if (lower.includes(term)) {
      warnings.push(term);
    }
  }
  return warnings;
}

function readPersistedCmsSnapshot(): StudioCmsSnapshot | null {
  if (cachedCmsSnapshot !== undefined) {
    return cachedCmsSnapshot;
  }
  try {
    if (!fs.existsSync(CMS_SNAPSHOT_FILE)) {
      cachedCmsSnapshot = null;
      return null;
    }
    const rawText = fs.readFileSync(CMS_SNAPSHOT_FILE, 'utf8');
    const parsed = JSON.parse(rawText) as StudioCmsSnapshot;
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.schemaVersion === 1 &&
      Array.isArray(parsed.portfolioCases)
    ) {
      cachedCmsSnapshot = parsed;
      return parsed;
    }
    cachedCmsSnapshot = null;
    return null;
  } catch {
    cachedCmsSnapshot = null;
    return null;
  }
}

function writePersistedCmsSnapshot(snapshot: StudioCmsSnapshot): void {
  fs.mkdirSync(CMS_DATA_DIR, { recursive: true });
  const tempPath = path.join(
    CMS_DATA_DIR,
    `.studio-cms.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
  );
  fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), 'utf8');
  fs.renameSync(tempPath, CMS_SNAPSHOT_FILE);
  cachedCmsSnapshot = snapshot;
}

function resetPersistedCmsSnapshot(): void {
  fs.mkdirSync(CMS_DATA_DIR, { recursive: true });
  if (fs.existsSync(CMS_SNAPSHOT_FILE)) {
    try {
      fs.copyFileSync(CMS_SNAPSHOT_FILE, CMS_BACKUP_FILE);
      fs.unlinkSync(CMS_SNAPSHOT_FILE);
    } catch {
      // Ignore cleanup errors
    }
  }
  cachedCmsSnapshot = null;
}

function sanitizeSafeFileStem(rawName: string, fallbackPrefix: string): string {
  const base = path.basename(rawName, path.extname(rawName));
  const clean = base
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  return clean || fallbackPrefix;
}

async function probeDurationSec(absPath: string, fallbackSec: number): Promise<number> {
  try {
    const stat = fs.statSync(absPath);
    const cached = durationCache.get(absPath);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.durationSec;
    }
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      absPath,
    ]);
    const parsed = Number.parseFloat(stdout.trim());
    const valid = Number.isFinite(parsed) && parsed > 0.3 ? parsed : fallbackSec;
    durationCache.set(absPath, { mtimeMs: stat.mtimeMs, durationSec: valid });
    return valid;
  } catch {
    return fallbackSec;
  }
}

function classifyDuelFilename(name: string): 'radio' | 'audioworks' | null {
  if (name === MAIN_PROMO_FILENAME || name.startsWith('.')) return null;
  const lower = name.toLowerCase();
  if (!lower.endsWith('.wav') && !lower.endsWith('.mp3') && !lower.endsWith('.m4a')) {
    return null;
  }
  if (
    lower === CANONICAL_RADIO_FILE ||
    lower.includes('ради') ||
    lower.includes('radio') ||
    lower.includes('штамп') ||
    lower.includes('обычн')
  ) {
    return 'radio';
  }
  return 'audioworks';
}

async function resolveDuelTracksOnDisk(): Promise<{
  radio: ResolvedTrackInfo;
  audioworks: ResolvedTrackInfo;
  isReadyOnServer: boolean;
}> {
  fs.mkdirSync(PUBLIC_AUDIO_DIR, { recursive: true });
  const entries = fs.readdirSync(PUBLIC_AUDIO_DIR);

  let radioFile: string | null = entries.includes(CANONICAL_RADIO_FILE)
    ? CANONICAL_RADIO_FILE
    : null;
  let awFile: string | null = entries.includes(CANONICAL_AUDIOWORKS_FILE)
    ? CANONICAL_AUDIOWORKS_FILE
    : null;

  for (const entry of entries) {
    const kind = classifyDuelFilename(entry);
    if (kind === 'radio' && !radioFile) {
      radioFile = entry;
    } else if (kind === 'audioworks' && !awFile) {
      awFile = entry;
    }
  }

  let radioInfo: ResolvedTrackInfo = {
    url: null,
    fileName: null,
    durationSec: 14.2,
  };
  let awInfo: ResolvedTrackInfo = {
    url: null,
    fileName: null,
    durationSec: 15.2,
  };

  if (radioFile) {
    const abs = path.join(PUBLIC_AUDIO_DIR, radioFile);
    const stat = fs.statSync(abs);
    const rawDur = await probeDurationSec(abs, 14.2);
    radioInfo = {
      url: `/assets/aistudio/${encodeURIComponent(radioFile)}?v=${Math.floor(stat.mtimeMs)}`,
      fileName: radioFile,
      durationSec: rawDur > 35 ? 14.5 : rawDur,
    };
  }

  if (awFile) {
    const abs = path.join(PUBLIC_AUDIO_DIR, awFile);
    const stat = fs.statSync(abs);
    const rawDur = await probeDurationSec(abs, 15.2);
    awInfo = {
      url: `/assets/aistudio/${encodeURIComponent(awFile)}?v=${Math.floor(stat.mtimeMs)}`,
      fileName: awFile,
      durationSec: rawDur > 35 ? 15.3 : rawDur,
    };
  }

  return {
    radio: radioInfo,
    audioworks: awInfo,
    isReadyOnServer: Boolean(radioInfo.url && awInfo.url),
  };
}

async function startServer() {
  const app = express();

  fs.mkdirSync(PUBLIC_CMS_MEDIA_DIR, { recursive: true });
  app.use(
    '/assets/cms',
    express.static(PUBLIC_CMS_MEDIA_DIR, {
      acceptRanges: true,
      maxAge: '7d',
    })
  );

  // =========================================================================
  // Studio CMS Auth & Content Endpoints
  // =========================================================================

  app.get('/api/cms/auth/session', (req, res) => {
    const token = extractBearerToken(req);
    res.json({
      authenticated: verifyAdminToken(token),
    });
  });

  app.post('/api/cms/auth/login', express.json({ limit: '64kb' }), (req, res) => {
    const rawPassword =
      req.body && typeof req.body.password === 'string'
        ? req.body.password.trim()
        : '';

    if (!rawPassword) {
      res.status(400).json({ error: 'Введите пароль студии' });
      return;
    }

    if (!safeCompareStrings(rawPassword, getStudioAdminPassword())) {
      res.status(401).json({ error: 'Неверный пароль студии. Проверьте раскладку и попробуйте снова.' });
      return;
    }

    const session = issueAdminToken();
    res.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
    });
  });

  app.post('/api/cms/auth/logout', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/cms/content', (_req, res) => {
    const snapshot = readPersistedCmsSnapshot();
    res.json({
      customized: snapshot !== null,
      snapshot,
      editorialWarnings: snapshot ? scanEditorialWarnings(snapshot) : [],
    });
  });

  app.put(
    '/api/cms/content',
    requireStudioAuth,
    express.json({ limit: '6mb' }),
    (req, res) => {
      const incoming = req.body?.snapshot ?? req.body;
      if (
        !incoming ||
        typeof incoming !== 'object' ||
        incoming.schemaVersion !== 1 ||
        !incoming.flagshipReel ||
        !Array.isArray(incoming.portfolioCases) ||
        incoming.portfolioCases.length === 0 ||
        !incoming.duel ||
        !incoming.neuroApproach ||
        !incoming.siteCopy
      ) {
        res.status(400).json({
          error: 'Некорректная структура снимка CMS',
        });
        return;
      }

      const hasPublishedCase = incoming.portfolioCases.some(
        (c: { published?: boolean }) => c && c.published !== false
      );
      if (!hasPublishedCase) {
        res.status(400).json({
          error: 'В портфолио должен оставаться хотя бы один опубликованный кейс',
        });
        return;
      }

      const stamped: StudioCmsSnapshot = {
        ...(incoming as StudioCmsSnapshot),
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
      };

      try {
        writePersistedCmsSnapshot(stamped);
        const editorialWarnings = scanEditorialWarnings(stamped);
        res.json({
          ok: true,
          customized: true,
          snapshot: stamped,
          editorialWarnings,
        });
      } catch (err) {
        res.status(500).json({
          error:
            err instanceof Error
              ? err.message
              : 'Не удалось сохранить данные CMS на сервере',
        });
      }
    }
  );

  app.post('/api/cms/reset', requireStudioAuth, (_req, res) => {
    try {
      resetPersistedCmsSnapshot();
      res.json({
        ok: true,
        customized: false,
        snapshot: null,
        editorialWarnings: [],
      });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error ? err.message : 'Не удалось сбросить данные CMS',
      });
    }
  });

  app.post(
    '/api/cms/upload-audio',
    requireStudioAuth,
    express.raw({ type: () => true, limit: '80mb' }),
    async (req, res) => {
      const bodyBuffer = req.body as Buffer;
      if (!Buffer.isBuffer(bodyBuffer) || bodyBuffer.length < 128) {
        res.status(400).json({ error: 'Пустой или повреждённый аудиофайл' });
        return;
      }

      const rawHeaderName = req.headers['x-file-name'];
      const decodedName =
        typeof rawHeaderName === 'string'
          ? (() => {
              try {
                return decodeURIComponent(rawHeaderName);
              } catch {
                return rawHeaderName;
              }
            })()
          : 'studio-track.wav';

      const extLower = path.extname(decodedName).toLowerCase();
      const targetExt = extLower === '.mp3' ? '.mp3' : '.wav';
      const stem = sanitizeSafeFileStem(decodedName, 'studio-audio');
      const finalFileName = `${stem}-${Date.now()}${targetExt}`;

      fs.mkdirSync(PUBLIC_CMS_MEDIA_DIR, { recursive: true });
      const targetAbs = path.join(PUBLIC_CMS_MEDIA_DIR, finalFileName);
      const tempAbs = path.join(
        PUBLIC_CMS_MEDIA_DIR,
        `.cms_audio_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.tmp`
      );

      try {
        fs.writeFileSync(tempAbs, bodyBuffer);

        if (extLower === '.mp3' || extLower === '.wav') {
          fs.renameSync(tempAbs, targetAbs);
        } else {
          try {
            await execFileAsync('ffmpeg', ['-y', '-i', tempAbs, targetAbs]);
            fs.unlinkSync(tempAbs);
          } catch {
            fs.renameSync(tempAbs, targetAbs);
          }
        }

        const measuredSec = await probeDurationSec(targetAbs, 15);

        if (fs.existsSync(path.join(__dirname, 'dist'))) {
          fs.mkdirSync(DIST_CMS_MEDIA_DIR, { recursive: true });
          fs.copyFileSync(targetAbs, path.join(DIST_CMS_MEDIA_DIR, finalFileName));
        }

        res.json({
          ok: true,
          url: `/assets/cms/${encodeURIComponent(finalFileName)}`,
          fileName: decodedName,
          durationSec: Math.round(measuredSec * 100) / 100,
        });
      } catch (err) {
        if (fs.existsSync(tempAbs)) {
          try {
            fs.unlinkSync(tempAbs);
          } catch {
            // Ignore cleanup errors
          }
        }
        res.status(500).json({
          error:
            err instanceof Error ? err.message : 'Ошибка сохранения аудиофайла',
        });
      }
    }
  );

  app.post(
    '/api/cms/upload-image',
    requireStudioAuth,
    express.raw({ type: () => true, limit: '15mb' }),
    (req, res) => {
      const bodyBuffer = req.body as Buffer;
      if (!Buffer.isBuffer(bodyBuffer) || bodyBuffer.length < 64) {
        res.status(400).json({ error: 'Пустой или повреждённый файл изображения' });
        return;
      }

      const rawHeaderName = req.headers['x-file-name'];
      const decodedName =
        typeof rawHeaderName === 'string'
          ? (() => {
              try {
                return decodeURIComponent(rawHeaderName);
              } catch {
                return rawHeaderName;
              }
            })()
          : 'cover.jpg';

      const extLower = path.extname(decodedName).toLowerCase();
      const allowedExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
      const targetExt = allowedExts.has(extLower) ? extLower : '.jpg';
      const stem = sanitizeSafeFileStem(decodedName, 'case-cover');
      const finalFileName = `${stem}-${Date.now()}${targetExt}`;

      fs.mkdirSync(PUBLIC_CMS_MEDIA_DIR, { recursive: true });
      const targetAbs = path.join(PUBLIC_CMS_MEDIA_DIR, finalFileName);

      try {
        fs.writeFileSync(targetAbs, bodyBuffer);

        if (fs.existsSync(path.join(__dirname, 'dist'))) {
          fs.mkdirSync(DIST_CMS_MEDIA_DIR, { recursive: true });
          fs.copyFileSync(targetAbs, path.join(DIST_CMS_MEDIA_DIR, finalFileName));
        }

        res.json({
          ok: true,
          url: `/assets/cms/${encodeURIComponent(finalFileName)}`,
          fileName: decodedName,
        });
      } catch (err) {
        res.status(500).json({
          error:
            err instanceof Error ? err.message : 'Ошибка сохранения обложки',
        });
      }
    }
  );

  // =========================================================================
  // Existing 15-Second Duel Direct Audio Endpoints (preserved)
  // =========================================================================

  app.get('/api/duel-tracks', async (_req, res) => {
    try {
      const payload = await resolveDuelTracksOnDisk();
      res.json(payload);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to inspect duel tracks',
      });
    }
  });

  app.post(
    '/api/duel-tracks/:kind',
    express.raw({ type: () => true, limit: '80mb' }),
    async (req, res) => {
      const kind = req.params.kind;
      if (kind !== 'radio' && kind !== 'audioworks') {
        res.status(400).json({ error: 'Invalid track kind' });
        return;
      }

      const bodyBuffer = req.body as Buffer;
      if (!Buffer.isBuffer(bodyBuffer) || bodyBuffer.length < 128) {
        res.status(400).json({ error: 'Empty or invalid audio payload' });
        return;
      }

      fs.mkdirSync(PUBLIC_AUDIO_DIR, { recursive: true });
      const targetName =
        kind === 'radio' ? CANONICAL_RADIO_FILE : CANONICAL_AUDIOWORKS_FILE;
      const targetAbs = path.join(PUBLIC_AUDIO_DIR, targetName);
      const tempAbs = path.join(
        PUBLIC_AUDIO_DIR,
        `.upload_${kind}_${Date.now()}.tmp`
      );

      try {
        fs.writeFileSync(tempAbs, bodyBuffer);
        const rawDur = await probeDurationSec(tempAbs, kind === 'radio' ? 14.2 : 15.2);

        if (kind === 'audioworks' && rawDur > 35) {
          await execFileAsync('ffmpeg', [
            '-y',
            '-i',
            tempAbs,
            '-t',
            '15.35',
            '-af',
            'afade=t=out:st=15.0:d=0.35',
            targetAbs,
          ]);
          fs.unlinkSync(tempAbs);
        } else {
          try {
            await execFileAsync('ffmpeg', ['-y', '-i', tempAbs, targetAbs]);
            fs.unlinkSync(tempAbs);
          } catch {
            fs.renameSync(tempAbs, targetAbs);
          }
        }

        if (fs.existsSync(path.join(__dirname, 'dist'))) {
          fs.mkdirSync(DIST_AUDIO_DIR, { recursive: true });
          fs.copyFileSync(targetAbs, path.join(DIST_AUDIO_DIR, targetName));
        }

        const updated = await resolveDuelTracksOnDisk();
        res.json(updated);
      } catch (err) {
        if (fs.existsSync(tempAbs)) {
          try {
            fs.unlinkSync(tempAbs);
          } catch {
            // Ignore cleanup errors
          }
        }
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to save audio file',
        });
      }
    }
  );

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AudioWorks server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
