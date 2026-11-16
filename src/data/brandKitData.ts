export type BrandDomainVariant = 'fmworks_reg' | 'fmworks_ru' | 'fmworks_pro';

export type BrandColorTheme = 'dark' | 'light';

export interface BrandDomainOption {
  id: BrandDomainVariant;
  label: string;
  description: string;
  fileSlug: string;
}

export const BRAND_DOMAIN_OPTIONS: readonly BrandDomainOption[] = [
  {
    id: 'fmworks_reg',
    label: 'FMWorks®',
    description: 'Основной студийный знак с охраняемым символом ®',
    fileSlug: 'fmworks',
  },
  {
    id: 'fmworks_ru',
    label: 'FMWorks.ru',
    description: 'Официальная доменная версия fmworks.ru для сайта и КП',
    fileSlug: 'fmworks-ru',
  },
  {
    id: 'fmworks_pro',
    label: 'FMWorks.pro',
    description: 'Версия для презентаций, шоурилов и договоров',
    fileSlug: 'fmworks-pro',
  },
] as const;

export interface BrandWordmarkGeometry {
  variant: BrandDomainVariant;
  accessibleLabel: string;
  viewBoxWidth: number;
  viewBoxHeight: number;
  textStartX: number;
  baselineY: number;
  fontSize: number;
  letterSpacing: number;
  fmPrefix: string;
  worksBody: string;
  suffixText: string;
  suffixKind: 'registered' | 'domain';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Геометрия логотипа `FMWorks®` / `FMWorks.ru` / `FMWorks.pro`:
 * - Слева: фирменная иконка 48×48 (`rx="13"`, `#FF4820`) с белой звуковой волной `W` (осциллограммой)
 * - Справа: монолитная типографическая часть `FMWorks` (`font-bold tracking-[-0.04em]`)
 */
export function getBrandWordmarkGeometry(
  variant: BrandDomainVariant = 'fmworks_reg'
): BrandWordmarkGeometry {
  if (variant === 'fmworks_ru') {
    return {
      variant: 'fmworks_ru',
      accessibleLabel: 'FMWorks.ru',
      viewBoxWidth: 232,
      viewBoxHeight: 48,
      textStartX: 60,
      baselineY: 34,
      fontSize: 28,
      letterSpacing: -1.12,
      fmPrefix: 'FM',
      worksBody: 'Works',
      suffixText: '.ru',
      suffixKind: 'domain',
    };
  }

  if (variant === 'fmworks_pro') {
    return {
      variant: 'fmworks_pro',
      accessibleLabel: 'FMWorks.pro',
      viewBoxWidth: 248,
      viewBoxHeight: 48,
      textStartX: 60,
      baselineY: 34,
      fontSize: 28,
      letterSpacing: -1.12,
      fmPrefix: 'FM',
      worksBody: 'Works',
      suffixText: '.pro',
      suffixKind: 'domain',
    };
  }

  return {
    variant: 'fmworks_reg',
    accessibleLabel: 'FMWorks®',
    viewBoxWidth: 204,
    viewBoxHeight: 48,
    textStartX: 60,
    baselineY: 34,
    fontSize: 28,
    letterSpacing: -1.12,
    fmPrefix: 'FM',
    worksBody: 'Works',
    suffixText: '®',
    suffixKind: 'registered',
  };
}

/**
 * Строит непрерывную 6-сегментную кубическую кривую Безье в виде плавной звуковой волны `W`
 * (осциллограммы) внутри оранжевого квадрата 48×48 (`rx="13"`, `#FF4820`).
 * При наведении курсора (`hoverEnergy > 0`) волна мягко оживает по амплитуде.
 */
export function computeBadgeWaveWPath(
  hoverEnergy = 0,
  phaseRad = 0
): string {
  const energy = Math.max(0, Math.min(1, hoverEnergy));

  const midY = 24.5;
  const shoulderOffset =
    energy > 0.001 ? Math.sin(phaseRad * 1.9) * 1.8 * energy : 0;
  const valleyOffset =
    energy > 0.001 ? Math.cos(phaseRad * 2.1 + 0.6) * 2.2 * energy : 0;
  const centerPeakOffset =
    energy > 0.001 ? Math.sin(phaseRad * 2.4 + 1.7) * 2.5 * energy : 0;

  const crestY = round2(15.2 - shoulderOffset);
  const valleyY = round2(34.4 + valleyOffset);
  const centerPeakY = round2(16.6 - centerPeakOffset);

  return [
    `M 7.2 ${midY}`,
    `C 8.9 ${midY}, 9.5 ${crestY}, 11.0 ${crestY}`,
    `C 13.0 ${crestY}, 15.0 ${valleyY}, 17.4 ${valleyY}`,
    `C 19.8 ${valleyY}, 21.6 ${centerPeakY}, 24.0 ${centerPeakY}`,
    `C 26.4 ${centerPeakY}, 28.2 ${valleyY}, 30.6 ${valleyY}`,
    `C 33.0 ${valleyY}, 35.0 ${crestY}, 37.0 ${crestY}`,
    `C 38.5 ${crestY}, 39.1 ${midY}, 40.8 ${midY}`,
  ].join(' ');
}

export interface BuildBrandLogoSvgOptions {
  variant?: BrandDomainVariant;
  colorTheme: BrandColorTheme;
  /** Если `true`, центрирует логотип на прозрачном холсте 2400×800px для скачивания SVG/PNG */
  exportArtboard2400x800?: boolean;
}

/**
 * Генерирует чистый автономный векторный `<svg>` основного логотипа `FMWorks` (`dark` или `light`)
 * с прозрачным фоном без внешних CSS-зависимостей — готов для сохранения в `.svg` и рендера в `2400×800px` `.png`.
 */
export function buildBrandLogoSvgMarkup({
  variant = 'fmworks_reg',
  colorTheme,
  exportArtboard2400x800 = true,
}: BuildBrandLogoSvgOptions): string {
  const geom = getBrandWordmarkGeometry(variant);
  const inkHex = colorTheme === 'dark' ? '#111111' : '#FFFFFF';
  const accentHex = '#FF4820';
  const fontStack =
    "'Manrope', 'Golos Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  const wavePath = computeBadgeWaveWPath(0, 0);

  const suffixTspan =
    geom.suffixKind === 'domain'
      ? `<tspan fill="${accentHex}" font-weight="700">${geom.suffixText}</tspan>`
      : `<tspan dx="1.4" dy="-9.8" font-size="11.5" font-weight="700" fill="${inkHex}" fill-opacity="0.68">${geom.suffixText}</tspan>`;

  const innerLockup = [
    `<rect x="0" y="0" width="48" height="48" rx="13" fill="${accentHex}" />`,
    `<path d="${wavePath}" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none" />`,
    `<text x="${geom.textStartX}" y="${geom.baselineY}" text-anchor="start" font-family="${fontStack}" font-size="${geom.fontSize}" font-weight="700" letter-spacing="${geom.letterSpacing}" fill="${inkHex}"><tspan fill="${accentHex}" font-weight="800">${geom.fmPrefix}</tspan><tspan fill="${inkHex}" font-weight="700">${geom.worksBody}</tspan>${suffixTspan}</text>`,
  ].join('\n    ');

  if (!exportArtboard2400x800) {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geom.viewBoxWidth} ${geom.viewBoxHeight}" width="${geom.viewBoxWidth * 4}" height="${geom.viewBoxHeight * 4}" fill="none">`,
      `  <g>`,
      `    ${innerLockup}`,
      `  </g>`,
      `</svg>`,
    ].join('\n');
  }

  const artW = 2400;
  const artH = 800;
  const maxTargetWidth = 2000;
  const maxTargetHeight = 420;
  const scale = round2(
    Math.min(
      maxTargetWidth / geom.viewBoxWidth,
      maxTargetHeight / geom.viewBoxHeight
    )
  );
  const offsetX = round2((artW - geom.viewBoxWidth * scale) / 2);
  const offsetY = round2((artH - geom.viewBoxHeight * scale) / 2);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${artW} ${artH}" width="${artW}" height="${artH}" fill="none">`,
    `  <title>${geom.accessibleLabel}</title>`,
    `  <g transform="translate(${offsetX}, ${offsetY}) scale(${scale})">`,
    `    ${innerLockup}`,
    `  </g>`,
    `</svg>`,
  ].join('\n');
}

/**
 * Генерирует квадратную фирменную иконку `FMWorks` (1000×1000px)
 * со звуковой волной `W` на фоне `#FF4820`
 * для аватарок в мессенджерах, Telegram и фавиконки сайта.
 */
export function buildAvatarIconSvgMarkup(
  variant: BrandDomainVariant = 'fmworks_reg'
): string {
  const geom = getBrandWordmarkGeometry(variant);
  const wavePath = computeBadgeWaveWPath(0, 0);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="1000" height="1000" fill="none">`,
    `  <title>${geom.accessibleLabel} — Icon</title>`,
    `  <rect x="0" y="0" width="48" height="48" rx="13" fill="#FF4820" />`,
    `  <path d="${wavePath}" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none" />`,
    `</svg>`,
  ].join('\n');
}

export interface BrandKitAssetSpec {
  id: 'logo-dark' | 'logo-light' | 'avatar-icon';
  title: string;
  subtitle: string;
  svgFileName: string;
  pngFileName: string;
  pngWidth: number;
  pngHeight: number;
  dimensionsLabel: string;
  previewSurface: 'light' | 'dark' | 'avatar';
}

export function getBrandKitAssetSpecs(
  variant: BrandDomainVariant = 'fmworks_reg'
): BrandKitAssetSpec[] {
  const opt =
    BRAND_DOMAIN_OPTIONS.find((item) => item.id === variant) ??
    BRAND_DOMAIN_OPTIONS[0];
  const slug = opt.fileSlug;

  return [
    {
      id: 'logo-dark',
      title: 'Основной логотип для светлого фона',
      subtitle: 'Для сайта, договоров, смет и коммерческих предложений',
      svgFileName: `${slug}-logo-dark.svg`,
      pngFileName: `${slug}-logo-dark.png`,
      pngWidth: 2400,
      pngHeight: 800,
      dimensionsLabel: '2400 × 800 px · прозрачный фон',
      previewSurface: 'light',
    },
    {
      id: 'logo-light',
      title: 'Белый логотип с оранжевым акцентом',
      subtitle: 'Для тёмного фона, видеошоурилов и презентаций',
      svgFileName: `${slug}-logo-light.svg`,
      pngFileName: `${slug}-logo-light.png`,
      pngWidth: 2400,
      pngHeight: 800,
      dimensionsLabel: '2400 × 800 px · прозрачный фон',
      previewSurface: 'dark',
    },
    {
      id: 'avatar-icon',
      title: 'Квадратная иконка-монограмма (Волна W)',
      subtitle: 'Для аватарки в мессенджерах, Telegram и фавиконки сайта',
      svgFileName: 'fmworks-avatar-icon.svg',
      pngFileName: 'fmworks-avatar-icon.png',
      pngWidth: 1000,
      pngHeight: 1000,
      dimensionsLabel: '1000 × 1000 px · квадрат и круг мессенджеров',
      previewSurface: 'avatar',
    },
  ];
}
