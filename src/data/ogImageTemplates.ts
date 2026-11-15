import { computeBadgeWaveWPath } from './brandKitData.ts';
import {
  BRAND_CASES,
  type BrandCasePoster,
  FLAGSHIP_STUDIO_REEL,
} from './casesData.ts';
import {
  getCaseDetailedBreakdown,
  INDUSTRY_SOLUTIONS,
  LOCAL_EDITORIAL_IMAGES,
  RADIO_MISTAKE_ARTICLES,
} from './multiPageContentData.ts';
import {
  CUSTOM_CONSULT_PRICING_ROW,
  EDITORIAL_PRICING_ROWS,
} from './pricingData.ts';

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export type OgTemplateKind = 'case' | 'service' | 'industry' | 'article' | 'studio';

export interface OgBadgeItem {
  label: string;
  value: string;
}

export interface OgCardSpec {
  kind: OgTemplateKind;
  routePath: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  surfaceBg: string;
  accentColor: string;
  badges: readonly OgBadgeItem[];
  coverImagePath: string;
  alt: string;
  waveformSeeds: readonly number[];
  footerLeft: string;
  footerRight: string;
}

const TAILWIND_SURFACE_HEX_MAP: Record<string, string> = {
  'bg-[#151417]': '#151417',
  'bg-[#2A1410]': '#26130F',
  'bg-[#12231D]': '#10201A',
  'bg-[#132036]': '#111C30',
};

function resolveSurfaceHex(rawBg?: string): string {
  if (!rawBg) return '#141418';
  const mapped = TAILWIND_SURFACE_HEX_MAP[rawBg.trim()];
  if (mapped) return mapped;
  const hexMatch = /#([0-9a-fA-F]{6})/.exec(rawBg);
  return hexMatch ? `#${hexMatch[1]}` : '#141418';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function normalizeOgRoutePath(rawPath?: string): string {
  const withoutOrigin = (rawPath ?? '/').trim().replace(/^https?:\/\/[^/]+/i, '');
  const withoutQueryHash = withoutOrigin.split(/[?#]/)[0] || '/';
  const cleaned = withoutQueryHash.replace(/\/+$/g, '').toLowerCase() || '/';
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

export function buildRouteOgImageUrl(
  origin: string,
  canonicalPath: string
): string {
  const cleanOrigin = (origin ?? '').trim().replace(/\/+$/g, '') || 'https://fmworks.ru';
  const normPath = normalizeOgRoutePath(canonicalPath);
  return `${cleanOrigin}/api/og.png?route=${encodeURIComponent(normPath)}`;
}

export function buildRouteOgSvgUrl(
  origin: string,
  canonicalPath: string
): string {
  const cleanOrigin = (origin ?? '').trim().replace(/\/+$/g, '') || 'https://fmworks.ru';
  const normPath = normalizeOgRoutePath(canonicalPath);
  return `${cleanOrigin}/api/og.svg?route=${encodeURIComponent(normPath)}`;
}

/**
 * Детерминированный перенос строк по границам слов для Canvas API и SVG-шаблонов OpenGraph.
 */
export function wrapOgTextLines(
  text: string,
  maxCharsPerLine: number,
  maxLines: number
): string[] {
  const normalized = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized || maxLines <= 0) return [];

  const words = normalized.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    if (!currentLine) {
      currentLine =
        word.length > maxCharsPerLine
          ? `${word.slice(0, Math.max(1, maxCharsPerLine - 1))}…`
          : word;
      continue;
    }

    const candidate = `${currentLine} ${word}`;
    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate;
    } else {
      if (lines.length + 1 >= maxLines) {
        const clipped =
          currentLine.length >= maxCharsPerLine - 1
            ? `${currentLine.slice(0, maxCharsPerLine - 1).trimEnd()}…`
            : `${currentLine}…`;
        lines.push(clipped);
        return lines;
      }
      lines.push(currentLine);
      currentLine =
        word.length > maxCharsPerLine
          ? `${word.slice(0, Math.max(1, maxCharsPerLine - 1))}…`
          : word;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  return lines;
}

function buildDeterministicWaveform(seedKey: string, count = 28): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seedKey.length; i += 1) {
    hash ^= seedKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Array.from({ length: count }, (_, idx) => {
    const pos = idx / Math.max(1, count - 1);
    const envelope = 0.45 + 0.55 * Math.sin(pos * Math.PI);
    const wave =
      0.5 +
      0.32 * Math.sin(idx * 0.85 + (hash % 17) * 0.41) +
      0.18 * Math.cos(idx * 1.45 - ((hash >>> 4) % 13) * 0.37);
    const level = Math.max(0.18, Math.min(1, envelope * wave));
    return Math.round(level * 1000) / 1000;
  });
}

export type OgCaseInput = Partial<BrandCasePoster> & { id: string };

export interface ResolveOgCardOptions {
  cmsCases?: readonly OgCaseInput[];
  flagshipReel?: OgCaseInput;
}

/**
 * Разрешает структуру OpenGraph-карточки (1200×630) для любой страницы кейсов, отраслей и услуг FMWorks.
 */
export function resolveOgCardSpecForPath(
  rawPath: string,
  options: ResolveOgCardOptions = {}
): OgCardSpec {
  const normPath = normalizeOgRoutePath(rawPath);
  const flagship: OgCaseInput = options.flagshipReel ?? FLAGSHIP_STUDIO_REEL;
  const allCases: readonly OgCaseInput[] = [
    flagship,
    ...(options.cmsCases && options.cmsCases.length > 0
      ? options.cmsCases
      : BRAND_CASES),
  ];

  // 1. Детальная страница кейса `/cases/:slug`
  if (normPath.startsWith('/cases/') && !normPath.startsWith('/cases/industry/')) {
    const slug = normPath.slice('/cases/'.length).trim().toLowerCase();
    const matchedCase = allCases.find((c) => c.id.toLowerCase() === slug);
    if (matchedCase) {
      const safeClient = matchedCase.client || 'Проект FMWorks';
      const safeTag = matchedCase.tag || 'Аудиопродакшн';
      const safeHeadline = matchedCase.headline || 'Эфирный аудиоролик';
      const safeSummary = matchedCase.summary || '';
      const safeDuration =
        typeof matchedCase.durationSec === 'number' &&
        Number.isFinite(matchedCase.durationSec)
          ? matchedCase.durationSec
          : 20;

      const breakdown = getCaseDetailedBreakdown({
        id: matchedCase.id,
        client: safeClient,
        tag: safeTag,
        summary: safeSummary,
        durationSec: safeDuration,
      });
      const badges: OgBadgeItem[] = breakdown.metrics.slice(0, 3).map((m) => ({
        label: m.label,
        value: m.value,
      }));
      return {
        kind: 'case',
        routePath: `/cases/${matchedCase.id}`,
        eyebrow: `КЕЙС · ${safeTag.toUpperCase()}`,
        title: `${safeClient}: ${safeHeadline}`,
        subtitle: safeSummary,
        surfaceBg: resolveSurfaceHex(matchedCase.editorialSurfaceBg),
        accentColor: '#FF4820',
        badges,
        coverImagePath:
          matchedCase.coverImageUrl || LOCAL_EDITORIAL_IMAGES.studioHero,
        alt: `${safeClient} — ${safeHeadline} | Кейс FMWorks`,
        waveformSeeds: buildDeterministicWaveform(`case:${matchedCase.id}`),
        footerLeft: `fmworks.ru/cases/${matchedCase.id}`,
        footerRight: `${breakdown.spotSeconds} сек · Сценарий + Паспорт РАО/ВОИС`,
      };
    }
  }

  // 2. Отраслевое решение (услуга под вертикаль) `/cases/industry/:slug`
  if (normPath.startsWith('/cases/industry/')) {
    const indSlug = normPath.slice('/cases/industry/'.length).trim().toLowerCase();
    const spec =
      INDUSTRY_SOLUTIONS[indSlug as keyof typeof INDUSTRY_SOLUTIONS] ?? null;
    if (spec) {
      return {
        kind: 'industry',
        routePath: `/cases/industry/${spec.slug}`,
        eyebrow: `ОТРАСЛЕВОЕ РЕШЕНИЕ · ${spec.shortTitle.toUpperCase()}`,
        title: spec.fullTitle,
        subtitle: spec.heroSummary,
        surfaceBg: '#13161E',
        accentColor: '#FF4820',
        badges: spec.kpiBenchmarks.slice(0, 3).map((k) => ({
          label: k.label,
          value: k.value,
        })),
        coverImagePath: spec.coverImageUrl || LOCAL_EDITORIAL_IMAGES.studioHero,
        alt: `${spec.fullTitle} — отраслевой стандарт FMWorks`,
        waveformSeeds: buildDeterministicWaveform(`industry:${spec.slug}`),
        footerLeft: `fmworks.ru/cases/industry/${spec.slug}`,
        footerRight: `Оптимум ${spec.optimalDurationRange} · Пре-чек ФЗ-38`,
      };
    }
  }

  // 3. Страница услуг и тарифов `/pricing`
  if (normPath === '/pricing') {
    const shortTierTitles: Record<string, string> = {
      voice_style: 'Голос и стиль',
      turnkey: 'Под ключ',
      cinema: 'Игровой',
    };
    const tierBadges: OgBadgeItem[] = EDITORIAL_PRICING_ROWS.map((row) => ({
      label: `${shortTierTitles[row.id] ?? row.title} · ${row.turnaround}`,
      value: row.priceFormatted,
    }));
    return {
      kind: 'service',
      routePath: '/pricing',
      eyebrow: 'УСЛУГИ И ТАРИФЫ · АУДИОПРОДАКШН ПОЛНОГО ЦИКЛА',
      title: 'Производство рекламных аудиороликов с фикс-ценой и паспортом прав',
      subtitle:
        '3 сценария с нуля, голоса кинодубляжа, сведение -14 LUFS, ЭДО и срочный выпуск от 1 часа по договорной цене.',
      surfaceBg: '#141418',
      accentColor: '#FF4820',
      badges: tierBadges,
      coverImagePath: LOCAL_EDITORIAL_IMAGES.studioLegalMastering,
      alt: 'Тарифы на производство аудиороликов FMWorks — от 15 000 ₽',
      waveformSeeds: buildDeterministicWaveform('service:pricing'),
      footerLeft: 'fmworks.ru/pricing',
      footerRight: `100% предоплата · ${CUSTOM_CONSULT_PRICING_ROW.title}`,
    };
  }

  // 4. Хаб кейсов `/cases`
  if (normPath === '/cases') {
    return {
      kind: 'case',
      routePath: '/cases',
      eyebrow: 'ПОРТФОЛИО И ОТРАСЛЕВЫЕ СТАНДАРТЫ FMWORKS',
      title: 'Кейсы аудиорекламы с посекундными сценариями и примерами звучания',
      subtitle:
        'FMCG, девелопмент, медицина и B2B: как режиссура паузы и голоса дубляжа проходят модерацию с первого дубля.',
      surfaceBg: '#171413',
      accentColor: '#FF4820',
      badges: [
        { label: 'Стандартов ниш', value: '4 вертикали' },
        { label: 'Модерация ФЗ-38', value: '98% с 1-го дубля' },
        { label: 'Старт по тексту', value: '24–48 ч' },
      ],
      coverImagePath: LOCAL_EDITORIAL_IMAGES.retailCoffee,
      alt: 'Кейсы аудиорекламы и отраслевые решения FMWorks',
      waveformSeeds: buildDeterministicWaveform('hub:cases'),
      footerLeft: 'fmworks.ru/cases',
      footerRight: 'Сценарии · Тайминги · Эфирные мастера',
    };
  }

  // 5. Разбор ошибки `/approach/:slug`
  if (normPath.startsWith('/approach/')) {
    const artSlug = normPath.slice('/approach/'.length).trim().toLowerCase();
    const article = RADIO_MISTAKE_ARTICLES.find((a) => a.slug === artSlug);
    if (article) {
      return {
        kind: 'article',
        routePath: `/approach/${article.slug}`,
        eyebrow: `${article.indexLabel.toUpperCase()} · ${article.categoryKicker.toUpperCase()}`,
        title: article.title,
        subtitle: article.subtitle,
        surfaceBg: '#16151B',
        accentColor: '#FF4820',
        badges: [
          { label: article.impactStatLabel, value: article.impactStatValue },
          { label: 'Формат разбора', value: 'До / После' },
          { label: 'Время чтения', value: article.readingTime },
        ],
        coverImagePath: LOCAL_EDITORIAL_IMAGES.radioAttention,
        alt: `${article.title} — разбор FMWorks`,
        waveformSeeds: buildDeterministicWaveform(`article:${article.slug}`),
        footerLeft: `fmworks.ru/approach/${article.slug}`,
        footerRight: 'Экспертиза FMWorks · Чек-лист продюсера',
      };
    }
  }

  // 6. Методология `/approach`
  if (normPath === '/approach') {
    return {
      kind: 'article',
      routePath: '/approach',
      eyebrow: 'НЕЙРОИССЛЕДОВАНИЯ И ДРАМАТУРГИЯ ЭФИРА',
      title: 'Как аудиоролик преодолевает рекламную глухоту в автопотоке',
      subtitle:
        'Исследования внимания Neuro-Insight и System1 + разбор 5 типовых ошибок в сценариях радиорекламы.',
      surfaceBg: '#14151B',
      accentColor: '#FF4820',
      badges: [
        { label: 'Долговременная память', value: '+22%' },
        { label: 'Доверие к бренду', value: '2× рост' },
        { label: 'Разборов ошибок', value: '5 кейсов' },
      ],
      coverImagePath: LOCAL_EDITORIAL_IMAGES.radioAttention,
      alt: 'Подход FMWorks к созданию эффективной аудиорекламы',
      waveformSeeds: buildDeterministicWaveform('service:approach'),
      footerLeft: 'fmworks.ru/approach',
      footerRight: 'Голоса кинодубляжа · Режиссура паузы',
    };
  }

  // 7. FAQ `/faq`
  if (normPath === '/faq') {
    return {
      kind: 'service',
      routePath: '/faq',
      eyebrow: 'ОТВЕТЫ НА ВОПРОСЫ · ДОГОВОР, ЭДО И СРОЧНЫЙ ЗАКАЗ',
      title: 'Условия работы студии: договор, ЭДО, 54-ФЗ и срочный выпуск от 1 часа',
      subtitle:
        '100% предоплата по договору или картой, закрытие в Диадок/СБИС, паспорт прав РАО/ВОИС и срочная запись по готовому тексту.',
      surfaceBg: '#161414',
      accentColor: '#FF4820',
      badges: [
        { label: 'Срочный заказ', value: 'От 1 часа' },
        { label: 'Документооборот', value: 'ЭДО / 54-ФЗ' },
        { label: 'Очистка прав', value: 'РАО и ВОИС' },
      ],
      coverImagePath: LOCAL_EDITORIAL_IMAGES.studioLegalMastering,
      alt: 'FAQ студии FMWorks — договор, оплата и срочный заказ от 1 часа',
      waveformSeeds: buildDeterministicWaveform('service:faq'),
      footerLeft: 'fmworks.ru/faq',
      footerRight: 'art@artmspektr.ru · +79040000911',
    };
  }

  // 8. По умолчанию: Главная студийная витрина `/`
  return {
    kind: 'studio',
    routePath: '/',
    eyebrow: 'СТУДИЯ АУДИОПРОДАКШНА ПОЛНОГО ЦИКЛА · FMWORKS (AUDIOWORKS)',
    title: 'Аудиореклама, которая работает: от 24–48ч по тексту, 3–4 дня под ключ',
    subtitle:
      'Три сценария с нуля, редкие голоса кинодубляжа, саунд-дизайн -14 LUFS и гарантия прохождения модерации по ФЗ-38.',
    surfaceBg: '#141418',
    accentColor: '#FF4820',
    badges: [
      { label: 'По тексту / Под ключ', value: '15–35 тыс. ₽' },
      { label: 'Модерация станций', value: '98% с 1-го дубля' },
      { label: 'Срочный выпуск', value: 'От 1 часа' },
    ],
    coverImagePath: LOCAL_EDITORIAL_IMAGES.studioHero,
    alt: 'FMWorks — студия коммерческого аудиопродакшна для радио и бизнеса',
    waveformSeeds: buildDeterministicWaveform('studio:home'),
    footerLeft: 'fmworks.ru',
    footerRight: 'Работаем по всей РФ · Договор и ЭДО',
  };
}

export interface BuildOgSvgOptions {
  embeddedCoverDataUri?: string | null;
  fontFamily?: string;
}

/**
 * Генерирует предобработанный векторный SVG-шаблон OpenGraph (1200×630)
 * для серверного рендеринга в PNG и мгновенного превью.
 */
export function buildOgCardSvgTemplate(
  spec: OgCardSpec,
  options: BuildOgSvgOptions = {}
): string {
  const fontFamily =
    options.fontFamily ||
    "'DejaVu Sans', 'Liberation Sans', 'Manrope', 'Golos Text', sans-serif";
  const monoFont = "'JetBrains Mono', 'DejaVu Sans Mono', monospace";

  const titleLines = wrapOgTextLines(spec.title, 26, 3);
  const subtitleLines = wrapOgTextLines(spec.subtitle, 48, 2);
  const wavePath = computeBadgeWaveWPath(0, 0);

  const titleStartY = 200;
  const titleLineHeight = 46;
  const titleMarkup = titleLines
    .map(
      (line, idx) =>
        `<text x="64" y="${titleStartY + idx * titleLineHeight}" fill="#FFFFFF" font-family="${escapeXml(fontFamily)}" font-size="36" font-weight="700" letter-spacing="-0.5">${escapeXml(line)}</text>`
    )
    .join('\n    ');

  const subtitleStartY = titleStartY + titleLines.length * titleLineHeight + 16;
  const subtitleMarkup = subtitleLines
    .map(
      (line, idx) =>
        `<text x="64" y="${subtitleStartY + idx * 28}" fill="rgba(244,243,239,0.74)" font-family="${escapeXml(fontFamily)}" font-size="19" font-weight="400">${escapeXml(line)}</text>`
    )
    .join('\n    ');

  // 28-полосная акустическая волна в фирменном стиле FMWorks
  const waveBarY = 418;
  const waveBarBaseX = 64;
  const waveBarsMarkup = spec.waveformSeeds
    .slice(0, 28)
    .map((amp, idx) => {
      const h = Math.max(8, Math.round(amp * 34));
      const x = waveBarBaseX + idx * 14;
      const y = waveBarY + Math.round((36 - h) / 2);
      const fill = idx < 17 ? spec.accentColor : 'rgba(255,255,255,0.28)';
      return `<rect x="${x}" y="${y}" width="8" height="${h}" rx="4" fill="${fill}" />`;
    })
    .join('');

  // 3 карточки KPI / тарифов
  const badgeCount = Math.min(3, spec.badges.length);
  const badgeTotalWidth = 656;
  const badgeGap = 14;
  const badgeWidth =
    badgeCount > 0
      ? Math.floor((badgeTotalWidth - badgeGap * (badgeCount - 1)) / badgeCount)
      : 210;

  const badgesMarkup = spec.badges
    .slice(0, 3)
    .map((badge, idx) => {
      const bx = 64 + idx * (badgeWidth + badgeGap);
      const by = 472;
      const clippedVal =
        badge.value.length > 18 ? `${badge.value.slice(0, 17)}…` : badge.value;
      const clippedLabel =
        badge.label.length > 25 ? `${badge.label.slice(0, 24)}…` : badge.label;
      return `
    <g>
      <rect x="${bx}" y="${by}" width="${badgeWidth}" height="82" rx="16" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" stroke-width="1" />
      <text x="${bx + 15}" y="${by + 34}" fill="${spec.accentColor}" font-family="${escapeXml(fontFamily)}" font-size="21" font-weight="700">${escapeXml(clippedVal)}</text>
      <text x="${bx + 15}" y="${by + 61}" fill="rgba(244,243,239,0.68)" font-family="${escapeXml(fontFamily)}" font-size="12" font-weight="500">${escapeXml(clippedLabel)}</text>
    </g>`;
    })
    .join('\n');

  const coverImageMarkup = options.embeddedCoverDataUri
    ? `<image href="${escapeXml(options.embeddedCoverDataUri)}" x="760" y="48" width="388" height="534" preserveAspectRatio="xMidYMid slice" clip-path="url(#og-cover-clip)" />`
    : `<rect x="760" y="48" width="388" height="534" rx="28" fill="url(#og-photo-fallback)" />`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">
  <defs>
    <radialGradient id="og-glow" cx="22%" cy="18%" r="70%">
      <stop offset="0%" stop-color="${spec.accentColor}" stop-opacity="0.22" />
      <stop offset="65%" stop-color="${spec.surfaceBg}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="og-photo-fallback" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#272226" />
      <stop offset="100%" stop-color="#121216" />
    </linearGradient>
    <linearGradient id="og-photo-vignette" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0D0D10" stop-opacity="0.08" />
      <stop offset="60%" stop-color="#0D0D10" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#0D0D10" stop-opacity="0.82" />
    </linearGradient>
    <clipPath id="og-cover-clip">
      <rect x="760" y="48" width="388" height="534" rx="28" />
    </clipPath>
  </defs>

  <!-- Базовый студийный фон -->
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="${spec.surfaceBg}" />
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#og-glow)" />
  <rect x="24" y="24" width="1152" height="582" rx="32" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1.5" />

  <!-- Правый фотографический блок с виньеткой -->
  <g>
    ${coverImageMarkup}
    <rect x="760" y="48" width="388" height="534" rx="28" fill="url(#og-photo-vignette)" />
    <rect x="760" y="48" width="388" height="534" rx="28" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" />
    <rect x="784" y="514" width="230" height="40" rx="20" fill="rgba(13,13,16,0.78)" stroke="rgba(255,255,255,0.20)" stroke-width="1" />
    <circle cx="806" cy="534" r="5" fill="${spec.accentColor}" />
    <text x="820" y="539" fill="#FFFFFF" font-family="${escapeXml(monoFont)}" font-size="13" font-weight="700">1200×630 · ЭФИР -14 LUFS</text>
  </g>

  <!-- Логотип FMWorks® -->
  <g transform="translate(64, 52)">
    <rect width="46" height="46" rx="12" fill="${spec.accentColor}" />
    <g transform="scale(0.958)">
      <path d="${wavePath}" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <text x="60" y="32" fill="#FFFFFF" font-family="${escapeXml(fontFamily)}" font-size="27" font-weight="700" letter-spacing="-0.8">FMWorks</text>
    <text x="190" y="19" fill="rgba(244,243,239,0.58)" font-family="${escapeXml(fontFamily)}" font-size="13" font-weight="700">®</text>
  </g>

  <!-- Рубрика маршрута -->
  <g>
    <rect x="64" y="118" width="656" height="32" rx="10" fill="rgba(255,72,32,0.14)" stroke="rgba(255,72,32,0.38)" stroke-width="1" />
    <text x="78" y="139" fill="#FFB39E" font-family="${escapeXml(monoFont)}" font-size="13" font-weight="700">${escapeXml(spec.eyebrow.slice(0, 68))}</text>
  </g>

  <!-- Заголовок и подзаголовок -->
  ${titleMarkup}
  ${subtitleMarkup}

  <!-- Фирменная звуковая волна -->
  <g>
    ${waveBarsMarkup}
    <text x="472" y="441" fill="rgba(244,243,239,0.54)" font-family="${escapeXml(monoFont)}" font-size="13" font-weight="600">AUDIOWORKS MASTER CARD</text>
  </g>

  <!-- 3 бейджа показателей / тарифов -->
  ${badgesMarkup}

  <!-- Нижняя строка подписи -->
  <line x1="64" y1="572" x2="720" y2="572" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
  <text x="64" y="594" fill="rgba(244,243,239,0.82)" font-family="${escapeXml(monoFont)}" font-size="14" font-weight="600">${escapeXml(spec.footerLeft)}</text>
  <text x="720" y="594" text-anchor="end" fill="rgba(244,243,239,0.56)" font-family="${escapeXml(fontFamily)}" font-size="14" font-weight="500">${escapeXml(spec.footerRight)}</text>
</svg>`;
}
