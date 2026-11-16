import fs from 'node:fs';
import path from 'node:path';
import {
  buildRobotsTxt,
  injectRouteSeoIntoHtml,
} from '../src/data/seoServerTemplates.ts';

const ROOT_DIR = process.cwd();

interface AuditFailure {
  category: string;
  message: string;
}

function collectFilesRecursively(
  dirPath: string,
  extensions: ReadonlySet<string>
): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursively(full, extensions));
    } else if (extensions.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

function checkOrphanComponents(failures: AuditFailure[]): void {
  const componentsDir = path.join(ROOT_DIR, 'src', 'components');
  const componentFiles = collectFilesRecursively(
    componentsDir,
    new Set(['.tsx', '.ts'])
  ).filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));

  const searchableFiles = [
    ...collectFilesRecursively(path.join(ROOT_DIR, 'src'), new Set(['.ts', '.tsx'])),
    path.join(ROOT_DIR, 'server.ts'),
  ].filter((f) => fs.existsSync(f));

  const contentByFile = new Map<string, string>();
  for (const file of searchableFiles) {
    contentByFile.set(file, fs.readFileSync(file, 'utf8'));
  }

  for (const compFile of componentFiles) {
    const baseName = path.basename(compFile, path.extname(compFile));
    let importedSomewhere = false;
    for (const [otherFile, content] of contentByFile.entries()) {
      if (otherFile === compFile) continue;
      if (
        content.includes(`/${baseName}'`) ||
        content.includes(`/${baseName}"`) ||
        content.includes(`/${baseName}.ts`) ||
        content.includes(`/${baseName}.tsx`)
      ) {
        importedSomewhere = true;
        break;
      }
    }
    if (!importedSomewhere) {
      const rel = path.relative(ROOT_DIR, compFile);
      failures.push({
        category: 'DEAD_CODE',
        message: `Неиспользуемый UI-модуль без единого импорта: ${rel}`,
      });
    }
  }
}

function checkGeminiApiSafety(failures: AuditFailure[]): void {
  const clientFiles = collectFilesRecursively(
    path.join(ROOT_DIR, 'src'),
    new Set(['.ts', '.tsx'])
  ).filter(
    (f) =>
      !f.includes(`${path.sep}src${path.sep}server${path.sep}`) &&
      !f.endsWith('.test.ts')
  );

  for (const file of clientFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT_DIR, file);
    if (content.includes('@google/genai')) {
      failures.push({
        category: 'SECURITY_GEMINI',
        message: `Запрещённый клиентский импорт @google/genai в браузерном модуле: ${rel}`,
      });
    }
    if (content.includes('process.env.GEMINI_API_KEY') || content.includes('VITE_GEMINI_API_KEY')) {
      failures.push({
        category: 'SECURITY_GEMINI',
        message: `Утечка ссылки на GEMINI_API_KEY в клиентском коде: ${rel}`,
      });
    }
  }

  const serverFiles = [
    path.join(ROOT_DIR, 'server.ts'),
    ...collectFilesRecursively(
      path.join(ROOT_DIR, 'src', 'server'),
      new Set(['.ts'])
    ).filter((f) => !f.endsWith('.test.ts')),
  ];

  const bannedModels = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-2.0-flash',
    'gemini-2.0-pro',
    'gemini-2.0-flash-thinking',
    'gemini-3.8-flash',
  ];

  for (const file of serverFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT_DIR, file);
    for (const banned of bannedModels) {
      if (content.includes(`'${banned}'`) || content.includes(`"${banned}"`)) {
        failures.push({
          category: 'GEMINI_MODEL',
          message: `Устаревшая или несуществующая модель "${banned}" в ${rel}`,
        });
      }
    }
  }
}

function checkSeoAndAssets(failures: AuditFailure[]): void {
  const indexHtmlPath = path.join(ROOT_DIR, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    failures.push({
      category: 'SEO',
      message: 'Отсутствует входной файл index.html',
    });
    return;
  }

  const rawHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const renderedHome = injectRouteSeoIntoHtml(rawHtml, '/', 'https://fmworks.ru');

  const requiredSnippets = [
    'prefix="og: https://ogp.me/ns#"',
    'max-snippet:-1',
    'max-image-preview:large',
    'rel="canonical"',
    'property="og:title"',
    'property="og:description"',
    'property="og:image"',
    'name="twitter:card" content="summary_large_image"',
    'name="twitter:title"',
    'name="twitter:description"',
    'name="twitter:image"',
    'type="application/ld+json"',
  ];

  for (const snippet of requiredSnippets) {
    if (!rawHtml.includes(snippet)) {
      failures.push({
        category: 'SEO_INDEX_HTML',
        message: `В index.html отсутствует обязательный SEO/социальный тег: ${snippet}`,
      });
    }
    if (!renderedHome.includes(snippet)) {
      failures.push({
        category: 'SEO_SSR',
        message: `В SSR-выводе injectRouteSeoIntoHtml отсутствует тег: ${snippet}`,
      });
    }
  }

  if (rawHtml.includes('Яндекс Турбо') || renderedHome.includes('Яндекс Турбо')) {
    failures.push({
      category: 'SEO_DEPRECATED_TURBO',
      message: 'Обнаружена устаревшая ссылка Яндекс Турбо-страниц (отключены Яндексом в апреле 2025 г.)',
    });
  }

  const robots = buildRobotsTxt('https://fmworks.ru/', { airtimeEnabled: false });
  for (const bot of ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'YandexAdditionalBot', 'Google-Extended']) {
    if (!robots.includes(`User-agent: ${bot}`)) {
      failures.push({
        category: 'SEO_GEO_ROBOTS',
        message: `В robots.txt отсутствует явное правило для AI-краулера: ${bot}`,
      });
    }
  }

  // Проверяем физическое наличие всех локальных изображений, упомянутых в index.html
  const assetRefs = rawHtml.match(/\/src\/assets\/images\/[A-Za-z0-9_.-]+/g) ?? [];
  for (const refPath of new Set(assetRefs)) {
    const diskPath = path.join(ROOT_DIR, refPath.replace(/^\//, ''));
    if (!fs.existsSync(diskPath)) {
      failures.push({
        category: 'SEO_ASSET',
        message: `Локальный SEO-ассет не найден на диске: ${refPath}`,
      });
    }
  }
}

function checkBundleBudgets(failures: AuditFailure[]): void {
  const assetsDir = path.join(ROOT_DIR, 'dist', 'assets');
  if (!fs.existsSync(assetsDir)) {
    failures.push({
      category: 'BUNDLE',
      message: 'Директория dist/assets не найдена — выполните npm run build перед аудитом бандла',
    });
    return;
  }

  const MAX_CHUNK_BYTES = 500 * 1024; // 500 KiB hard ceiling per chunk
  const MAX_ENTRY_BYTES = 340 * 1024; // 340 KiB ceiling for initial entry index-*.js

  const jsFiles = fs
    .readdirSync(assetsDir)
    .filter((name) => name.endsWith('.js'));

  if (jsFiles.length === 0) {
    failures.push({
      category: 'BUNDLE',
      message: 'В dist/assets не найдено ни одного JS-чанка',
    });
    return;
  }

  for (const fileName of jsFiles) {
    const stat = fs.statSync(path.join(assetsDir, fileName));
    const sizeKb = (stat.size / 1024).toFixed(1);
    if (stat.size > MAX_CHUNK_BYTES) {
      failures.push({
        category: 'BUNDLE_BUDGET',
        message: `JS-чанк ${fileName} (${sizeKb} KiB) превышает потолок 500 KiB`,
      });
    }
    if (/^index-[A-Za-z0-9_-]+\.js$/.test(fileName) && stat.size > MAX_ENTRY_BYTES) {
      failures.push({
        category: 'BUNDLE_ENTRY_BUDGET',
        message: `Входной бандл ${fileName} (${sizeKb} KiB) превышает бюджет первого экрана 340 KiB`,
      });
    }
  }
}

function main(): void {
  const failures: AuditFailure[] = [];

  checkOrphanComponents(failures);
  checkGeminiApiSafety(failures);
  checkSeoAndAssets(failures);
  checkBundleBudgets(failures);

  if (failures.length > 0) {
    console.error(`\n[QUALITY GATE FAILED] Обнаружено проблем: ${failures.length}`);
    for (const item of failures) {
      console.error(`  - [${item.category}] ${item.message}`);
    }
    process.exit(1);
  }

  const assetsDir = path.join(ROOT_DIR, 'dist', 'assets');
  const jsFiles = fs
    .readdirSync(assetsDir)
    .filter((n) => n.endsWith('.js'))
    .map((name) => ({
      name,
      kb: Math.round((fs.statSync(path.join(assetsDir, name)).size / 1024) * 10) / 10,
    }))
    .sort((a, b) => b.kb - a.kb);

  const topChunks = jsFiles
    .slice(0, 4)
    .map((c) => `${c.name}: ${c.kb} KiB`)
    .join(', ');

  console.log(
    `[QUALITY GATE PASSED] 0 сиротских UI-модулей · Gemini SDK изолирован на сервере · SEO/Twitter/JSON-LD валидны · Топ чанков (${jsFiles.length} шт.): ${topChunks}`
  );
}

main();
