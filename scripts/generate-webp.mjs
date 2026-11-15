import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RASTER_SOURCE_REGEX = /\.(jpe?g|png)$/i;
export const RESPONSIVE_WEBP_WIDTHS = [480, 800];

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

function probeImageWidth(sourceFilePath) {
  try {
    const out = execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width',
        '-of',
        'csv=p=0',
        sourceFilePath,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    const parsed = Number.parseInt(out, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function buildWebpSiblingPath(sourceFilePath, targetWidth = null) {
  if (!RASTER_SOURCE_REGEX.test(sourceFilePath)) return null;
  if (targetWidth && Number.isFinite(targetWidth)) {
    return sourceFilePath.replace(RASTER_SOURCE_REGEX, `-${targetWidth}w.webp`);
  }
  return sourceFilePath.replace(RASTER_SOURCE_REGEX, '.webp');
}

function isFreshTarget(sourceFilePath, targetFilePath, force) {
  if (force || !fs.existsSync(targetFilePath)) return false;
  const srcStat = fs.statSync(sourceFilePath);
  const dstStat = fs.statSync(targetFilePath);
  return dstStat.mtimeMs >= srcStat.mtimeMs && dstStat.size > 0;
}

function encodeWebpFile(encoder, sourceFilePath, outputFilePath, quality, targetWidth = null) {
  if (encoder === 'ffmpeg') {
    const args = ['-y', '-loglevel', 'error', '-i', sourceFilePath];
    if (targetWidth) {
      args.push('-vf', `scale=${targetWidth}:-2:flags=lanczos`);
    }
    args.push(
      '-c:v',
      'libwebp',
      '-quality',
      String(quality),
      '-compression_level',
      '6',
      outputFilePath
    );
    execFileSync('ffmpeg', args, { stdio: 'pipe' });
  } else {
    const args = [sourceFilePath];
    if (targetWidth) {
      args.push('-resize', `${targetWidth}x`);
    }
    args.push('-quality', String(quality), outputFilePath);
    execFileSync('convert', args, { stdio: 'pipe' });
  }
}

export function convertRasterFileToWebp(sourceFilePath, options = {}) {
  const webpPath = buildWebpSiblingPath(sourceFilePath);
  if (!webpPath || !fs.existsSync(sourceFilePath)) {
    return { generated: false, webpPath, responsivePaths: [] };
  }

  const encoder = detectEncoder();
  if (!encoder) {
    return {
      generated: false,
      skipped: true,
      reason: 'no-encoder',
      webpPath,
      responsivePaths: [],
    };
  }

  let generatedAny = false;
  const baseQuality = Number(options.quality ?? 82);

  if (!isFreshTarget(sourceFilePath, webpPath, options.force)) {
    encodeWebpFile(encoder, sourceFilePath, webpPath, baseQuality, null);
    generatedAny = true;
  }

  const responsivePaths = [];
  const isAvatar = path.basename(sourceFilePath).startsWith('avatar_');
  const sourceWidth = options.responsive !== false && !isAvatar
    ? probeImageWidth(sourceFilePath)
    : null;

  if (sourceWidth && sourceWidth >= 860) {
    for (const width of RESPONSIVE_WEBP_WIDTHS) {
      if (sourceWidth <= width + 60) continue;
      const variantPath = buildWebpSiblingPath(sourceFilePath, width);
      if (!variantPath) continue;
      responsivePaths.push(variantPath);
      if (!isFreshTarget(sourceFilePath, variantPath, options.force)) {
        const tierQuality = width <= 480 ? Math.max(76, baseQuality - 2) : baseQuality;
        encodeWebpFile(encoder, sourceFilePath, variantPath, tierQuality, width);
        generatedAny = true;
      }
    }
  }

  return {
    generated: generatedAny,
    skipped: !generatedAny,
    webpPath,
    responsivePaths,
  };
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
    `[generate-webp] Checked ${summary.length} images, updated ${generatedCount} image set(s).`
  );
}
