import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RASTER_SOURCE_REGEX = /\.(jpe?g|png)$/i;

let cachedEncoder = undefined;

function detectEncoder() {
  if (cachedEncoder !== undefined) return cachedEncoder;
  for (const cmd of ['ffmpeg', 'convert']) {
    try {
      execFileSync('which', [cmd], { stdio: 'ignore' });
      cachedEncoder = cmd;
      return cmd;
    } catch {
      // Try next encoder
    }
  }
  cachedEncoder = null;
  return null;
}

export function buildWebpSiblingPath(sourceFilePath) {
  if (!RASTER_SOURCE_REGEX.test(sourceFilePath)) return null;
  return sourceFilePath.replace(RASTER_SOURCE_REGEX, '.webp');
}

export function convertRasterFileToWebp(sourceFilePath, options = {}) {
  const webpPath = buildWebpSiblingPath(sourceFilePath);
  if (!webpPath || !fs.existsSync(sourceFilePath)) {
    return { generated: false, webpPath };
  }

  if (!options.force && fs.existsSync(webpPath)) {
    const srcStat = fs.statSync(sourceFilePath);
    const webpStat = fs.statSync(webpPath);
    if (webpStat.mtimeMs >= srcStat.mtimeMs && webpStat.size > 0) {
      return { generated: false, skipped: true, webpPath };
    }
  }

  const encoder = detectEncoder();
  if (!encoder) {
    return { generated: false, skipped: true, reason: 'no-encoder', webpPath };
  }

  const quality = String(options.quality ?? 82);
  if (encoder === 'ffmpeg') {
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'error',
        '-i',
        sourceFilePath,
        '-c:v',
        'libwebp',
        '-quality',
        quality,
        '-compression_level',
        '6',
        webpPath,
      ],
      { stdio: 'pipe' }
    );
  } else {
    execFileSync('convert', [sourceFilePath, '-quality', quality, webpPath], {
      stdio: 'pipe',
    });
  }

  return { generated: true, webpPath };
}

export function ensureWebpSiblingsInDirs(dirs, options = {}) {
  const results = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !RASTER_SOURCE_REGEX.test(entry.name)) continue;
      const absPath = path.join(dir, entry.name);
      const res = convertRasterFileToWebp(absPath, options);
      results.push({ file: entry.name, ...res });
    }
  }
  return results;
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const summary = ensureWebpSiblingsInDirs([
    path.join(rootDir, 'src', 'assets', 'images'),
    path.join(rootDir, 'public', 'assets', 'cms'),
  ]);
  const generatedCount = summary.filter((item) => item.generated).length;
  console.log(
    `[generate-webp] Checked ${summary.length} images, generated ${generatedCount} WebP file(s).`
  );
}
