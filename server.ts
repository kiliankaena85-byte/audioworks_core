import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import express from 'express';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_AUDIO_DIR = path.join(__dirname, 'public', 'assets', 'aistudio');
const DIST_AUDIO_DIR = path.join(__dirname, 'dist', 'assets', 'aistudio');
const MAIN_PROMO_FILENAME = 'Audioworks_75c6023f.wav';

const CANONICAL_RADIO_FILE = 'zerno_radio_15.wav';
const CANONICAL_AUDIOWORKS_FILE = 'zerno_audioworks_15.wav';

interface ResolvedTrackInfo {
  url: string | null;
  fileName: string | null;
  durationSec: number;
}

const durationCache = new Map<string, { mtimeMs: number; durationSec: number }>();

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
    lower.includes('ради') || // покрывает и «РАДИО», и «РАДИР»
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
      // Если файл экспортирован с пустым хвостом DAW-сессии (> 35 сек), ограничиваем чистыми 15.3 сек
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
          // Автоматически отсекаем пустой хвост DAW-сессии после 15.35 сек с мягким 0.35с фейдом
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
          // Приводим любой входной WAV/MP3 к чистому WAV PCM, чтобы он мгновенно играл во всех браузерах
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
