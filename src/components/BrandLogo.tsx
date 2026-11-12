import { MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
import {
  BrandDomainVariant,
  computeBadgeWaveWPath,
  getBrandWordmarkGeometry,
} from '../data/brandKitData';

export interface BrandLogoProps {
  variant?: BrandDomainVariant;
  size?: 'sm' | 'md' | 'lg';
  /**
   * `adaptive` автоматически подстраивается под светлую/тёмную тему через `currentColor`,
   * `dark` фиксирует тёмный текст `#111111`, `light` фиксирует белый текст `#FFFFFF`.
   */
  colorMode?: 'adaptive' | 'dark' | 'light';
  className?: string;
  onOpenBrandKit?: () => void;
}

const SIZE_HEIGHT_CLASS: Record<NonNullable<BrandLogoProps['size']>, string> = {
  sm: 'h-7 sm:h-7.5',
  md: 'h-8 sm:h-8.5',
  lg: 'h-10 sm:h-11',
};

export function BrandLogo({
  variant = 'fmworks_reg',
  size = 'md',
  colorMode = 'adaptive',
  className = '',
  onOpenBrandKit,
}: BrandLogoProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [animFrame, setAnimFrame] = useState<{ energy: number; phase: number }>({
    energy: 0,
    phase: 0,
  });

  const energyRef = useRef(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      energyRef.current = 0;
      setAnimFrame({ energy: 0, phase: 0 });
      return;
    }

    let rafId = 0;
    const enterTime = performance.now();
    let lastTime = enterTime;
    const HOVER_SWEEP_MS = 1000;

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const targetEnergy = isHovered ? 1 : 0;
      const lerpRate = isHovered ? 11.0 : 9.5;
      const nextEnergy =
        energyRef.current +
        (targetEnergy - energyRef.current) * Math.min(1, dt * lerpRate);

      const elapsedMs = now - enterTime;
      const isSweepingHover = isHovered && elapsedMs < HOVER_SWEEP_MS;

      if (isSweepingHover) {
        const sweepDamping = 1 - elapsedMs / HOVER_SWEEP_MS;
        energyRef.current = nextEnergy;
        phaseRef.current += dt * (3.4 + 4.2 * sweepDamping);
        setAnimFrame({ energy: nextEnergy, phase: phaseRef.current });
        rafId = window.requestAnimationFrame(step);
      } else if (!isHovered && nextEnergy > 0.008) {
        energyRef.current = nextEnergy;
        setAnimFrame({ energy: nextEnergy, phase: phaseRef.current });
        rafId = window.requestAnimationFrame(step);
      } else {
        energyRef.current = 0;
        setAnimFrame({ energy: 0, phase: phaseRef.current });
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [isHovered]);

  const geom = getBrandWordmarkGeometry(variant);
  const badgeWavePath = computeBadgeWaveWPath(animFrame.energy, animFrame.phase);

  const colorToneClass =
    colorMode === 'dark'
      ? 'text-[#111111]'
      : colorMode === 'light'
        ? 'text-white'
        : 'text-[#111111] dark:text-[#F4F3EF]';

  const handleContextMenu = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (!onOpenBrandKit) return;
    e.preventDefault();
    e.stopPropagation();
    onOpenBrandKit();
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${geom.viewBoxWidth} ${geom.viewBoxHeight}`}
      role="img"
      aria-label={geom.accessibleLabel}
      data-testid="brand-logo-svg"
      data-variant={geom.variant}
      data-fm-active={isHovered ? 'true' : 'false'}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={handleContextMenu}
      className={`w-auto select-none shrink-0 overflow-visible ${SIZE_HEIGHT_CLASS[size]} ${colorToneClass} ${className}`}
    >
      <title>{geom.accessibleLabel}</title>

      {/* СЛЕВА: фирменная иконка 48×48 (rx="13", #FF4820) с белой звуковой волной W */}
      <rect
        data-testid="brand-logo-badge-bg"
        x="0"
        y="0"
        width="48"
        height="48"
        rx="13"
        fill="#FF4820"
      />
      <path
        data-testid="brand-logo-badge-wave"
        d={badgeWavePath}
        stroke="#FFFFFF"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* СПРАВА: монолитная типографическая часть FMWorks® (font-bold tracking-[-0.04em], слитно без дыр) */}
      <text
        x={geom.textStartX}
        y={geom.baselineY}
        textAnchor="start"
        fontSize={geom.fontSize}
        fontWeight="700"
        letterSpacing={geom.letterSpacing}
        fill="currentColor"
        className="font-bold"
      >
        <tspan data-testid="brand-logo-fm-prefix" fill="#FF4820" fontWeight="800">
          {geom.fmPrefix}
        </tspan>
        <tspan fill="currentColor" fontWeight="700">
          {geom.worksBody}
        </tspan>
        {geom.suffixKind === 'domain' ? (
          <tspan fill="#FF4820" fontWeight="700">
            {geom.suffixText}
          </tspan>
        ) : (
          <tspan
            dx="1.4"
            dy="-9.8"
            fontSize="11.5"
            fontWeight="700"
            fill="currentColor"
            fillOpacity="0.68"
          >
            {geom.suffixText}
          </tspan>
        )}
      </text>
    </svg>
  );
}
