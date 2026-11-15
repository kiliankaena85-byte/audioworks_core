import { Check, Download, Eye, EyeOff, Share2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudioCms } from '../cms/StudioCmsContext';
import {
  buildRouteOgImageUrl,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  resolveOgCardSpecForPath,
} from '../data/ogImageTemplates';
import {
  exportOgCardCanvasPngBlob,
  renderOgCardToCanvas,
} from '../utils/ogCanvasGenerator';

export interface OgSharePreviewCardProps {
  routePath: string;
  shareTitle: string;
  shareDescription: string;
  downloadFileSlug?: string;
}

function copyTextFallback(text: string): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function OgSharePreviewCard({
  routePath,
  shareTitle,
  shareDescription,
  downloadFileSlug = 'fmworks-og-card',
}: OgSharePreviewCardProps) {
  const { snapshot } = useStudioCms();
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const ogSpec = useMemo(
    () =>
      resolveOgCardSpecForPath(routePath, {
        cmsCases: snapshot.portfolioCases,
        flagshipReel: snapshot.flagshipReel,
      }),
    [routePath, snapshot.portfolioCases, snapshot.flagshipReel]
  );

  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://fmworks.ru';
  const shareUrl = `${origin}${ogSpec.routePath}`;
  const ogImageUrl = buildRouteOgImageUrl(origin, ogSpec.routePath);

  useEffect(() => {
    if (!isExpanded || !canvasRef.current) return;
    let cancelled = false;
    setIsCanvasReady(false);

    renderOgCardToCanvas(canvasRef.current, ogSpec).then(() => {
      if (!cancelled) {
        setIsCanvasReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isExpanded, ogSpec]);

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      const payload = {
        title: shareTitle,
        text: shareDescription,
        url: shareUrl,
      };
      try {
        const canShare =
          typeof navigator.canShare !== 'function' || navigator.canShare(payload);
        if (canShare) {
          await navigator.share(payload);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2400);
          return;
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    let ok = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        ok = true;
      } catch {
        ok = copyTextFallback(shareUrl);
      }
    } else {
      ok = copyTextFallback(shareUrl);
    }

    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    }
  };

  const handleDownloadPng = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const blob = await exportOgCardCanvasPngBlob(ogSpec, canvasRef.current);
      if (!blob) return;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${downloadFileSlug}-og-1200x630.png`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      data-testid="og-share-preview-card"
      className="rounded-3xl p-5 sm:p-6 bg-[#EFECE5]/75 dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/10 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#111111]/62 dark:text-[#F4F3EF]/62">
            <Share2 className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
            <span>OpenGraph-карточка для соцсетей и мессенджеров (1200×630 PNG)</span>
          </div>
          <p className="text-sm font-medium text-[#111111] dark:text-[#F4F3EF] truncate">
            {shareUrl}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            data-testid="og-share-link-btn"
            onClick={handleShare}
            className="min-h-[40px] px-4 py-2 rounded-full bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F] hover:bg-[#FF4820] hover:text-white dark:hover:bg-[#FF4820] dark:hover:text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Share2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{copied ? 'Ссылка скопирована' : 'Поделиться ссылкой'}</span>
          </button>

          <button
            type="button"
            data-testid="og-preview-toggle-btn"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((prev) => !prev)}
            className="min-h-[40px] px-4 py-2 rounded-full border border-[#111111]/18 dark:border-white/18 hover:border-[#FF4820] text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap text-[#111111] dark:text-[#F4F3EF]"
          >
            {isExpanded ? (
              <EyeOff className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
            ) : (
              <Eye className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
            )}
            <span>{isExpanded ? 'Скрыть превью обложки' : 'Превью обложки (Canvas)'}</span>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div
          data-testid="og-preview-expanded-panel"
          className="pt-4 border-t border-[#111111]/10 dark:border-white/10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
        >
          <div className="lg:col-span-7">
            <div className="relative rounded-2xl overflow-hidden border border-[#111111]/12 dark:border-white/12 bg-[#141418] shadow-sm">
              <canvas
                ref={canvasRef}
                width={OG_IMAGE_WIDTH}
                height={OG_IMAGE_HEIGHT}
                data-testid="og-preview-canvas"
                data-ready={isCanvasReady ? 'true' : 'false'}
                aria-label={ogSpec.alt}
                className="w-full h-auto block aspect-[1200/630]"
              />
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="space-y-1.5">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#FF4820]">
                Как ссылка выглядит в Telegram / VK / Slack
              </p>
              <p className="text-base font-bold leading-snug text-[#111111] dark:text-[#F4F3EF]">
                {shareTitle}
              </p>
              <p className="text-xs sm:text-sm leading-relaxed text-[#111111]/70 dark:text-[#F4F3EF]/70">
                {shareDescription}
              </p>
            </div>

            <div className="rounded-2xl p-3 bg-[#111111]/5 dark:bg-white/5 border border-[#111111]/10 dark:border-white/10 text-[11px] font-mono text-[#111111]/68 dark:text-[#F4F3EF]/68 break-all">
              og:image → {ogImageUrl}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                data-testid="og-download-png-btn"
                onClick={handleDownloadPng}
                disabled={isDownloading}
                className="min-h-[40px] px-4 py-2 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {isDownloading ? 'Экспорт PNG…' : 'Скачать PNG-обложку (1200×630)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
