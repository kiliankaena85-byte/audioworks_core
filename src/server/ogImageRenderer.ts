import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import {
  buildOgCardSvgTemplate,
  OG_IMAGE_WIDTH,
  type OgCardSpec,
  resolveOgCardSpecForPath,
  type ResolveOgCardOptions,
} from '../data/ogImageTemplates.ts';

const SYSTEM_CYRILLIC_FONTS = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Regular.ttf',
  '/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
].filter((fontPath) => fs.existsSync(fontPath));

const MAX_PNG_CACHE_ENTRIES = 64;
const renderedPngCache = new Map<string, { png: Buffer; spec: OgCardSpec }>();
const coverDataUriCache = new Map<string, string | null>();

function resolveLocalAssetDiskPath(
  rootDir: string,
  coverImagePath: string
): string | null {
  const cleanRel = (coverImagePath || '').split(/[?#]/)[0].replace(/^\/+/, '');
  if (!cleanRel) return null;

  const candidates = [
    path.resolve(rootDir, cleanRel),
    path.resolve(rootDir, 'public', cleanRel),
    path.resolve(rootDir, 'dist', cleanRel),
  ];

  // Защита от path traversal за пределы корня приложения
  const normalizedRoot = `${path.resolve(rootDir)}${path.sep}`;
  for (const candidate of candidates) {
    if (!candidate.startsWith(normalizedRoot)) continue;
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Ignore unreadable paths
    }
  }
  return null;
}

function resolveMimeForExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

export function loadEmbeddedCoverDataUri(
  rootDir: string,
  coverImagePath: string
): string | null {
  const normalizedKey = `${rootDir}::${coverImagePath}`;
  if (coverDataUriCache.has(normalizedKey)) {
    return coverDataUriCache.get(normalizedKey) ?? null;
  }

  // Prefer `.jpg` / `.png` over `.webp` for maximum resvg compatibility
  const preferredPath = coverImagePath.endsWith('.webp')
    ? coverImagePath.replace(/\.webp$/i, '.jpg')
    : coverImagePath;

  const absPath =
    resolveLocalAssetDiskPath(rootDir, preferredPath) ??
    resolveLocalAssetDiskPath(rootDir, coverImagePath);

  if (!absPath) {
    coverDataUriCache.set(normalizedKey, null);
    return null;
  }

  try {
    const raw = fs.readFileSync(absPath);
    const mime = resolveMimeForExtension(absPath);
    const uri = `data:${mime};base64,${raw.toString('base64')}`;
    coverDataUriCache.set(normalizedKey, uri);
    return uri;
  } catch {
    coverDataUriCache.set(normalizedKey, null);
    return null;
  }
}

export function clearOgImageCache(): void {
  renderedPngCache.clear();
  coverDataUriCache.clear();
}

export function renderOgSvgForRoute(
  rootDir: string,
  routePath: string,
  options: ResolveOgCardOptions = {}
): { svg: string; spec: OgCardSpec } {
  const spec = resolveOgCardSpecForPath(routePath, options);
  const embeddedCoverDataUri = loadEmbeddedCoverDataUri(rootDir, spec.coverImagePath);
  const svg = buildOgCardSvgTemplate(spec, { embeddedCoverDataUri });
  return { svg, spec };
}

export function renderOgPngForRoute(
  rootDir: string,
  routePath: string,
  options: ResolveOgCardOptions & { cacheKeySuffix?: string } = {}
): { png: Buffer; spec: OgCardSpec } {
  const spec = resolveOgCardSpecForPath(routePath, options);
  const cacheKey = `${spec.routePath}::${spec.title}::${options.cacheKeySuffix ?? ''}`;
  const cached = renderedPngCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const embeddedCoverDataUri = loadEmbeddedCoverDataUri(rootDir, spec.coverImagePath);
  const svg = buildOgCardSvgTemplate(spec, { embeddedCoverDataUri });

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: OG_IMAGE_WIDTH,
    },
    font: {
      fontFiles: SYSTEM_CYRILLIC_FONTS,
      loadSystemFonts: true,
      defaultFontFamily: 'DejaVu Sans',
    },
  });

  const pngData = resvg.render();
  const pngBuffer = Buffer.from(pngData.asPng());

  if (renderedPngCache.size >= MAX_PNG_CACHE_ENTRIES) {
    const oldestKey = renderedPngCache.keys().next().value;
    if (oldestKey !== undefined) {
      renderedPngCache.delete(oldestKey);
    }
  }
  renderedPngCache.set(cacheKey, { png: pngBuffer, spec });

  return { png: pngBuffer, spec };
}
