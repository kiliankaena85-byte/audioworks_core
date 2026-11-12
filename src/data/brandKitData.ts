export type BrandDomainVariant = 'audioworks_reg' | 'audioworks_pro' | 'airworks_reg';

export type BrandColorTheme = 'dark' | 'light';

export interface BrandDomainOption {
  id: BrandDomainVariant;
  label: string;
  description: string;
  fileSlug: string;
}

export const BRAND_DOMAIN_OPTIONS: readonly BrandDomainOption[] = [
  {
    id: 'audioworks_reg',
    label: 'AudioWorks®',
    description: 'Основной студийный знак с охраняемым символом ®',
    fileSlug: 'audioworks',
  },
  {
    id: 'audioworks_pro',
    label: 'AudioWorks.pro',
    description: 'Доменная версия для визиток, КП и презентаций',
    fileSlug: 'audioworks-pro',
  },
  {
    id: 'airworks_reg',
    label: 'AirWorks®',
    description: 'Короткая эфирная версия знака AirWorks®',
    fileSlug: 'airworks',
  },
] as const;

export interface BrandWordmarkGeometry {
  variant: BrandDomainVariant;
  accessibleLabel: string;
  viewBoxWidth: number;
  viewBoxHeight: number;
  prefixText: string;
  prefixEndX: number;
  iStemX: number;
  postIText: string;
  postIX: number;
  waveStartX: number;
  waveWidth: number;
  orksStartX: number;
  suffixText: string;
  suffixKind: 'registered' | 'domain';
}

/**
 * Точная векторная геометрия логотипа для всех 3 доменных версий:
 * - Префикс перед `i` выровнен по правому краю (`text-anchor="end"`), исключая наезд на штрих `i`
 * - Точка над `i` — чистый геометрический кружок `#FF4820` (символ студийной лампы ON AIR)
 * - Центральная `W` в `Works` — кастомная гладкая осциллограмма (кубические кривые Безье)
 * - Хвост `orks` с `®` или `.pro` привязан сразу после волны `W`
 */
export function getBrandWordmarkGeometry(
  variant: BrandDomainVariant = 'audioworks_reg'
): BrandWordmarkGeometry {
  if (variant === 'airworks_reg') {
    return {
      variant,
      accessibleLabel: 'AirWorks®',
      viewBoxWidth: 212,
      viewBoxHeight: 48,
      prefixText: 'A',
      prefixEndX: 73.2,
      iStemX: 75.8,
      postIText: 'r',
      postIX: 81.8,
      waveStartX: 96.4,
      waveWidth: 34.8,
      orksStartX: 133.8,
      suffixText: '®',
      suffixKind: 'registered',
    };
  }

  if (variant === 'audioworks_pro') {
    return {
      variant,
      accessibleLabel: 'AudioWorks.pro',
      viewBoxWidth: 286,
      viewBoxHeight: 48,
      prefixText: 'Aud',
      prefixEndX: 104.5,
      iStemX: 107.6,
      postIText: 'o',
      postIX: 113.5,
      waveStartX: 135.2,
      waveWidth: 34.8,
      orksStartX: 172.6,
      suffixText: '.pro',
      suffixKind: 'domain',
    };
  }

  return {
    variant: 'audioworks_reg',
    accessibleLabel: 'AudioWorks®',
    viewBoxWidth: 248,
    viewBoxHeight: 48,
    prefixText: 'Aud',
    prefixEndX: 104.5,
    iStemX: 107.6,
    postIText: 'o',
    postIX: 113.5,
    waveStartX: 135.2,
    waveWidth: 34.8,
    orksStartX: 172.6,
    suffixText: '®',
    suffixKind: 'registered',
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Генерирует 3 асимметричные упругие акустические линии внутри скруглённого квадрата `#FF4820`,
 * образующие стилизованную букву `W` с нарастающей динамикой справа.
 */
export function computeMonogramPaths(
  hoverEnergy = 0,
  phaseRad = 0
): [string, string, string] {
  const energy = Math.max(0, Math.min(1, hoverEnergy));
  const leftLift = round2(Math.sin(phaseRad) * 1.4 * energy);
  const centerLift = round2(Math.sin(phaseRad * 1.35 + 1.1) * 2.1 * energy);
  const rightLift = round2(Math.cos(phaseRad * 1.15 + 0.4) * 1.8 * energy);

  const line1 = `M 9.6 ${round2(16.6 + leftLift)} C 10.9 22.6, 12.3 28.2, 14.1 ${round2(
    33.2 - leftLift * 0.45
  )}`;

  const centerPeakY = round2(19.0 - 2.2 * energy + centerLift);
  const centerValleyY = round2(31.8 + 0.9 * energy - centerLift * 0.35);
  const line2 = `M 18.3 ${centerValleyY} C 19.7 25.0, 20.8 ${centerPeakY}, 22.2 ${centerPeakY} C 23.6 ${centerPeakY}, 24.7 25.0, 26.1 ${centerValleyY}`;

  const line3 = `M 30.3 ${round2(33.2 + rightLift * 0.35)} C 31.8 26.5, 33.2 19.5, 34.9 ${round2(
    13.2 - 1.1 * energy - rightLift * 0.7
  )}`;

  return [line1, line2, line3];
}

/**
 * Генерирует кастомный векторный росчерк центральной буквы `W` в слове `Works`
 * в виде гладкой звуковой волны (осциллограммы), которая при наведении мыши
 * плавно оживает и меняет амплитуду.
 */
export function computeOscillogramWPath(
  waveStartX: number,
  hoverEnergy = 0,
  phaseRad = 0,
  waveWidth = 35.6
): string {
  const energy = Math.max(0, Math.min(1, hoverEnergy));
  const x0 = waveStartX;
  const scaleX = waveWidth / 35.6;
  const x = (offset: number) => round2(x0 + offset * scaleX);

  // В покое — сбалансированная архитектурная волна `W`; при наведении — живая модуляция амплитуды
  const crestPulse = Math.sin(phaseRad * 1.6) * 2.6 * energy;
  const valleyAsymA = Math.cos(phaseRad * 1.35 + 0.5) * 1.8 * energy;
  const valleyAsymB = Math.sin(phaseRad * 1.45 + 2.1) * 1.8 * energy;

  const yEntry = round2(18.2 - 0.8 * energy);
  const yTopLeft = round2(15.4 - 0.9 * energy + crestPulse * 0.25);
  const yValley1 = round2(33.3 + 2.1 * energy + valleyAsymA);
  const yCenterPeak = round2(16.8 - 3.6 * energy + crestPulse);
  const yValley2 = round2(33.3 + 2.1 * energy + valleyAsymB);
  const yTopRight = round2(15.2 - 1.1 * energy - crestPulse * 0.25);
  const yExit = round2(18.0 - 0.8 * energy);

  return [
    `M ${x(0)} ${yEntry}`,
    `C ${x(0.9)} ${yTopLeft}, ${x(1.9)} ${yTopLeft}, ${x(3.1)} ${yTopLeft}`,
    `C ${x(6.2)} ${yTopLeft}, ${x(7.1)} ${yValley1}, ${x(10.3)} ${yValley1}`,
    `C ${x(13.5)} ${yValley1}, ${x(14.6)} ${yCenterPeak}, ${x(17.8)} ${yCenterPeak}`,
    `C ${x(21.0)} ${yCenterPeak}, ${x(22.1)} ${yValley2}, ${x(25.3)} ${yValley2}`,
    `C ${x(28.5)} ${yValley2}, ${x(29.4)} ${yTopRight}, ${x(32.5)} ${yTopRight}`,
    `C ${x(33.7)} ${yTopRight}, ${x(34.7)} ${yExit}, ${x(35.6)} ${yExit}`,
  ].join(' ');
}

export interface BuildBrandLogoSvgOptions {
  variant?: BrandDomainVariant;
  colorTheme: BrandColorTheme;
  /** Если `true`, центрирует логотип на прозрачном холсте 2400×800px для скачивания SVG/PNG */
  exportArtboard2400x800?: boolean;
}

/**
 * Генерирует чистый автономный векторный `<svg>` основного логотипа (`dark` или `light`)
 * с прозрачным фоном без внешних CSS-зависимостей — готов для сохранения в `.svg` и рендера в `2400×800px` `.png`.
 */
export function buildBrandLogoSvgMarkup({
  variant = 'audioworks_reg',
  colorTheme,
  exportArtboard2400x800 = true,
}: BuildBrandLogoSvgOptions): string {
  const geom = getBrandWordmarkGeometry(variant);
  const inkHex = colorTheme === 'dark' ? '#111111' : '#FFFFFF';
  const accentHex = '#FF4820';
  const fontStack =
    "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

  const [m1, m2, m3] = computeMonogramPaths(0, 0);
  const wPath = computeOscillogramWPath(geom.waveStartX, 0, 0, geom.waveWidth);

  const suffixTspan =
    geom.suffixKind === 'domain'
      ? `<tspan fill="${accentHex}" font-weight="600">${geom.suffixText}</tspan>`
      : `<tspan dx="1.6" dy="-9.5" font-size="11.5" font-weight="600" fill="${inkHex}" fill-opacity="0.68">${geom.suffixText}</tspan>`;

  const innerLockup = [
    `<rect x="2" y="4" width="40" height="40" rx="11.5" fill="${accentHex}" />`,
    `<path d="${m1}" stroke="#FFFFFF" stroke-width="3.15" stroke-linecap="round" stroke-linejoin="round" fill="none" />`,
    `<path d="${m2}" stroke="#FFFFFF" stroke-width="3.15" stroke-linecap="round" stroke-linejoin="round" fill="none" />`,
    `<path d="${m3}" stroke="#FFFFFF" stroke-width="3.15" stroke-linecap="round" stroke-linejoin="round" fill="none" />`,
    `<text x="${geom.prefixEndX}" y="33.5" text-anchor="end" font-family="${fontStack}" font-size="26" font-weight="500" letter-spacing="-0.4" fill="${inkHex}">${geom.prefixText}</text>`,
    `<rect x="${geom.iStemX}" y="20.2" width="3.1" height="13.3" rx="1.1" fill="${inkHex}" />`,
    `<circle cx="${round2(geom.iStemX + 1.55)}" cy="14.1" r="2.75" fill="${accentHex}" />`,
    `<text x="${geom.postIX}" y="33.5" text-anchor="start" font-family="${fontStack}" font-size="26" font-weight="500" letter-spacing="-0.3" fill="${inkHex}">${geom.postIText}</text>`,
    `<path d="${wPath}" stroke="${inkHex}" stroke-width="3.05" stroke-linecap="round" stroke-linejoin="round" fill="none" />`,
    `<text x="${geom.orksStartX}" y="33.5" text-anchor="start" font-family="${fontStack}" font-size="26" font-weight="600" letter-spacing="-0.4" fill="${inkHex}">orks${suffixTspan}</text>`,
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

  // Масштабируем пропорционально на прозрачный холст 2400×800px с благородными охранными полями
  const artW = 2400;
  const artH = 800;
  const maxTargetWidth = 2040;
  const maxTargetHeight = 420;
  const scale = round2(
    Math.min(maxTargetWidth / geom.viewBoxWidth, maxTargetHeight / geom.viewBoxHeight)
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
 * Генерирует квадратную фирменную иконку-монограмму `AW / Волна` (1000×1000px)
 * специально для аватарок Telegram, WhatsApp и фавиконки сайта:
 * радиус `rx="220"` на 1000×1000 даёт прозрачные скруглённые углы для иконки сайта
 * и при этом на 100% заполняет круглый кроп мессенджеров (радиус 500px) без белых зазоров.
 */
export function buildAvatarIconSvgMarkup(
  variant: BrandDomainVariant = 'audioworks_reg'
): string {
  const geom = getBrandWordmarkGeometry(variant);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" fill="none">`,
    `  <title>${geom.accessibleLabel} — Icon</title>`,
    `  <defs>`,
    `    <linearGradient id="aw-avatar-bg" x1="120" y1="80" x2="880" y2="940" gradientUnits="userSpaceOnUse">`,
    `      <stop offset="0%" stop-color="#FF5932" />`,
    `      <stop offset="55%" stop-color="#FF4820" />`,
    `      <stop offset="100%" stop-color="#E53914" />`,
    `    </linearGradient>`,
    `  </defs>`,
    `  <rect x="0" y="0" width="1000" height="1000" rx="220" fill="url(#aw-avatar-bg)" />`,
    `  <path d="M 218 338 C 252 486, 286 620, 332 738" stroke="#FFFFFF" stroke-width="76" stroke-linecap="round" stroke-linejoin="round" fill="none" />`,
    `  <path d="M 434 704 C 468 538, 494 398, 526 398 C 558 398, 584 538, 618 704" stroke="#FFFFFF" stroke-width="76" stroke-linecap="round" stroke-linejoin="round" fill="none" />`,
    `  <path d="M 720 738 C 756 572, 790 400, 832 248" stroke="#FFFFFF" stroke-width="76" stroke-linecap="round" stroke-linejoin="round" fill="none" />`,
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
  variant: BrandDomainVariant = 'audioworks_reg'
): BrandKitAssetSpec[] {
  const opt =
    BRAND_DOMAIN_OPTIONS.find((item) => item.id === variant) ?? BRAND_DOMAIN_OPTIONS[0];
  const slug = opt.fileSlug;
  const avatarPrefix = variant === 'airworks_reg' ? 'airworks' : 'audioworks';

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
      title: 'Квадратная иконка-монограмма AW / Волна',
      subtitle: 'Для аватарки Telegram, WhatsApp и фавиконки сайта',
      svgFileName: `${avatarPrefix}-avatar-icon.svg`,
      pngFileName: `${avatarPrefix}-avatar-icon.png`,
      pngWidth: 1000,
      pngHeight: 1000,
      dimensionsLabel: '1000 × 1000 px · квадрат и круг мессенджеров',
      previewSurface: 'avatar',
    },
  ];
}
