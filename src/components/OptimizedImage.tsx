import type { MotionStyle } from 'motion/react';
import { motion } from 'motion/react';
import React, { useEffect, useState } from 'react';
import {
  deriveWebpUrl,
  resolveImageLoadingProps,
} from '../utils/imageOptimization.ts';

export interface OptimizedImageProps {
  src: string;
  alt: string;
  fallbackSrc?: string;
  priority?: boolean;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  fetchPriority?: 'high' | 'low' | 'auto';
  sizes?: string;
  className?: string;
  style?: React.CSSProperties;
  motionStyle?: MotionStyle;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  width?: number;
  height?: number;
  'aria-hidden'?: boolean | 'true' | 'false';
  'data-testid'?: string;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
  onError?: React.ReactEventHandler<HTMLImageElement>;
}

/**
 * Универсальная обёртка изображений для FMWorks:
 * - использует `<picture>` с приоритетным `<source type="image/webp">` и автоматическим фолбэком на оригинал;
 * - по умолчанию выставляет `loading="lazy"` и `decoding="async"` для Core Web Vitals, Lighthouse и Яндекса;
 * - поддерживает `motionStyle` для параллакс-эффектов без потери совместимости с `<picture>`.
 */
export function OptimizedImage({
  src,
  alt,
  fallbackSrc,
  priority = false,
  loading,
  decoding,
  fetchPriority,
  sizes,
  className,
  style,
  motionStyle,
  referrerPolicy = 'no-referrer',
  width,
  height,
  'aria-hidden': ariaHidden,
  'data-testid': dataTestId,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [activeSrc, setActiveSrc] = useState(src);
  const [webpDisabled, setWebpDisabled] = useState(false);
  const [fallbackApplied, setFallbackApplied] = useState(false);

  useEffect(() => {
    setActiveSrc(src);
    setWebpDisabled(false);
    setFallbackApplied(false);
  }, [src]);

  const webpCandidate = !webpDisabled ? deriveWebpUrl(activeSrc) : null;
  const resolvedLoading = resolveImageLoadingProps({
    priority,
    loading,
    decoding,
    fetchPriority,
  });

  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    if (webpCandidate && !webpDisabled) {
      setWebpDisabled(true);
      return;
    }
    if (fallbackSrc && !fallbackApplied && activeSrc !== fallbackSrc) {
      setFallbackApplied(true);
      setWebpDisabled(false);
      setActiveSrc(fallbackSrc);
      return;
    }
    onError?.(event);
  };

  return (
    <picture className="contents">
      {webpCandidate && (
        <source srcSet={webpCandidate} type="image/webp" sizes={sizes} />
      )}
      {motionStyle ? (
        <motion.img
          src={activeSrc}
          alt={alt}
          referrerPolicy={referrerPolicy}
          loading={resolvedLoading.loading}
          decoding={resolvedLoading.decoding}
          fetchPriority={resolvedLoading.fetchPriority}
          width={width}
          height={height}
          aria-hidden={ariaHidden}
          data-testid={dataTestId}
          onLoad={onLoad}
          onError={handleError}
          style={motionStyle}
          className={className}
        />
      ) : (
        <img
          src={activeSrc}
          alt={alt}
          referrerPolicy={referrerPolicy}
          loading={resolvedLoading.loading}
          decoding={resolvedLoading.decoding}
          fetchPriority={resolvedLoading.fetchPriority}
          width={width}
          height={height}
          aria-hidden={ariaHidden}
          data-testid={dataTestId}
          onLoad={onLoad}
          onError={handleError}
          style={style}
          className={className}
        />
      )}
    </picture>
  );
}

export default OptimizedImage;
