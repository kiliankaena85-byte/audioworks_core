import { MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
import {
  BrandDomainVariant,
  computeMonogramPaths,
  computeOscillogramWPath,
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
  variant = 'audioworks_reg',
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
      energyRef.current = isHovered ? 0.65 : 0;
      setAnimFrame({ energy: energyRef.current, phase: 0 });
      return;
    }

    let rafId = 0;
    const enterTime = performance.now();
    let lastTime = enterTime;
    const HOVER_SWEEP_MS = 1100;

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const targetEnergy = isHovered ? 1 : 0;
      const lerpRate = isHovered ? 10.5 : 9.0;
      const nextEnergy =
        energyRef.current + (targetEnergy - energyRef.current) * Math.min(1, dt * lerpRate);

      const elapsedMs = now - enterTime;
      const isSweepingHover = isHovered && elapsedMs < HOVER_SWEEP_MS;

      if (isSweepingHover) {
        const sweepDamping = 1 - elapsedMs / HOVER_SWEEP_MS;
        energyRef.current = nextEnergy;
        phaseRef.current += dt * (3.2 + 4.4 * sweepDamping);
        setAnimFrame({ energy: nextEnergy, phase: phaseRef.current });
        rafId = window.requestAnimationFrame(step);
      } else if (!isHovered && nextEnergy > 0.008) {
        energyRef.current = nextEnergy;
        setAnimFrame({ energy: nextEnergy, phase: phaseRef.current });
        rafId = window.requestAnimationFrame(step);
      } else {
        energyRef.current = targetEnergy;
        setAnimFrame({ energy: targetEnergy, phase: phaseRef.current });
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
  const [monoLine1, monoLine2, monoLine3] = computeMonogramPaths(
    animFrame.energy,
    animFrame.phase
  );
  const wOscillogramPath = computeOscillogramWPath(
    geom.waveStartX,
    animFrame.energy,
    animFrame.phase,
    geom.waveWidth
  );

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

  const dotCenterX = Math.round((geom.iStemX + 1.55) * 100) / 100;
  const isWaveHighlighted = animFrame.energy > 0.18;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${geom.viewBoxWidth} ${geom.viewBoxHeight}`}
      role="img"
      aria-label={geom.accessibleLabel}
      data-testid="brand-logo-svg"
      data-variant={variant}
      data-wave-active={isHovered ? 'true' : 'false'}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={handleContextMenu}
      className={`w-auto select-none shrink-0 overflow-visible ${SIZE_HEIGHT_CLASS[size]} ${colorToneClass} ${className}`}
    >
      <title>{geom.accessibleLabel}</title>

      {/* 1. Фирменный знак-монограмма: скруглённый квадрат #FF4820 + 3 асимметричные акустические линии W */}
      <rect x="2" y="4" width="40" height="40" rx="11.5" fill="#FF4820" />
      <path
        d={monoLine1}
        stroke="#FFFFFF"
        strokeWidth="3.15"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d={monoLine2}
        stroke="#FFFFFF"
        strokeWidth="3.15"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d={monoLine3}
        stroke="#FFFFFF"
        strokeWidth="3.15"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* 2. Слово Audio (font-medium) с кораллово-оранжевой лампой ON AIR над буквой i */}
      <text
        x={geom.prefixEndX}
        y="33.5"
        textAnchor="end"
        fontSize="26"
        fontWeight="500"
        letterSpacing="-0.4"
        fill="currentColor"
      >
        {geom.prefixText}
      </text>

      <rect
        x={geom.iStemX}
        y="20.2"
        width="3.1"
        height="13.3"
        rx="1.1"
        fill="currentColor"
      />

      {isWaveHighlighted && (
        <circle
          cx={dotCenterX}
          cy="14.1"
          r="5.1"
          fill="#FF4820"
          fillOpacity={Math.round(animFrame.energy * 26) / 100}
        />
      )}
      <circle
        data-testid="brand-logo-onair-dot"
        cx={dotCenterX}
        cy="14.1"
        r="2.75"
        fill="#FF4820"
      />

      <text
        x={geom.postIX}
        y="33.5"
        textAnchor="start"
        fontSize="26"
        fontWeight="500"
        letterSpacing="-0.3"
        fill="currentColor"
      >
        {geom.postIText}
      </text>

      {/* 3. Центральная буква W в слове Works — кастомная векторная осциллограмма */}
      <path
        data-testid="brand-logo-wave-w"
        d={wOscillogramPath}
        stroke={isWaveHighlighted ? '#FF4820' : 'currentColor'}
        strokeWidth="3.05"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="transition-colors duration-150"
      />

      {/* Хвост orks + знак ® или .pro */}
      <text
        x={geom.orksStartX}
        y="33.5"
        textAnchor="start"
        fontSize="26"
        fontWeight="600"
        letterSpacing="-0.4"
        fill="currentColor"
      >
        orks
        {geom.suffixKind === 'domain' ? (
          <tspan fill="#FF4820" fontWeight="600">
            {geom.suffixText}
          </tspan>
        ) : (
          <tspan
            dx="1.6"
            dy="-9.5"
            fontSize="11.5"
            fontWeight="600"
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
