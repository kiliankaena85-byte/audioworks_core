import { Check, Download, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import {
  BRAND_DOMAIN_OPTIONS,
  BrandDomainVariant,
  BrandKitAssetSpec,
  buildAvatarIconSvgMarkup,
  buildBrandLogoSvgMarkup,
  getBrandKitAssetSpecs,
} from '../data/brandKitData';
import { BrandLogo } from './BrandLogo';

interface BrandKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSiteVariant: BrandDomainVariant;
  onSelectSiteVariant?: (variant: BrandDomainVariant) => void;
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1500);
}

async function renderSvgMarkupToPngBlob(
  svgMarkup: string,
  width: number,
  height: number
): Promise<Blob> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font readiness warning
    }
  }

  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = 'sync';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Не удалось подготовить вектор для PNG'));
      image.src = svgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D недоступен в браузере');
    }

    // Прозрачный фон (Alpha 0) по всему периметру
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('Ошибка кодирования PNG'));
        }
      }, 'image/png');
    });

    return pngBlob;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function AvatarMonogramPreview() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 1000"
      aria-hidden="true"
      className="w-full h-full"
    >
      <defs>
        <linearGradient
          id="aw-modal-avatar-bg"
          x1="120"
          y1="80"
          x2="880"
          y2="940"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FF5932" />
          <stop offset="55%" stopColor="#FF4820" />
          <stop offset="100%" stopColor="#E53914" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1000" height="1000" rx="220" fill="url(#aw-modal-avatar-bg)" />
      <path
        d="M 218 338 C 252 486, 286 620, 332 738"
        stroke="#FFFFFF"
        strokeWidth="76"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M 434 704 C 468 538, 494 398, 526 398 C 558 398, 584 538, 618 704"
        stroke="#FFFFFF"
        strokeWidth="76"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M 720 738 C 756 572, 790 400, 832 248"
        stroke="#FFFFFF"
        strokeWidth="76"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function BrandKitModal({
  isOpen,
  onClose,
  activeSiteVariant,
  onSelectSiteVariant,
}: BrandKitModalProps) {
  const [selectedVariant, setSelectedVariant] =
    useState<BrandDomainVariant>(activeSiteVariant);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [downloadedKey, setDownloadedKey] = useState<string | null>(null);
  const [lastDownloadedFile, setLastDownloadedFile] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setSelectedVariant(activeSiteVariant);
  }, [activeSiteVariant]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const assetSpecs = getBrandKitAssetSpecs(selectedVariant);

  const getSvgForAsset = (spec: BrandKitAssetSpec): string => {
    if (spec.id === 'avatar-icon') {
      return buildAvatarIconSvgMarkup(selectedVariant);
    }
    return buildBrandLogoSvgMarkup({
      variant: selectedVariant,
      colorTheme: spec.id === 'logo-dark' ? 'dark' : 'light',
      exportArtboard2400x800: true,
    });
  };

  const markSuccess = (actionKey: string, fileName: string) => {
    setDownloadedKey(actionKey);
    setLastDownloadedFile(fileName);
    window.setTimeout(() => {
      setDownloadedKey((prev) => (prev === actionKey ? null : prev));
    }, 2200);
  };

  const handleDownloadSvg = (spec: BrandKitAssetSpec) => {
    setErrorMsg(null);
    const key = `${spec.id}-svg`;
    try {
      const markup = getSvgForAsset(spec);
      const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
      triggerBlobDownload(blob, spec.svgFileName);
      markSuccess(key, spec.svgFileName);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Не удалось сохранить SVG');
    }
  };

  const handleDownloadPng = async (spec: BrandKitAssetSpec) => {
    setErrorMsg(null);
    const key = `${spec.id}-png`;
    setBusyKey(key);
    try {
      const markup = getSvgForAsset(spec);
      const pngBlob = await renderSvgMarkupToPngBlob(
        markup,
        spec.pngWidth,
        spec.pngHeight
      );
      triggerBlobDownload(pngBlob, spec.pngFileName);
      markSuccess(key, spec.pngFileName);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Не удалось сохранить PNG');
    } finally {
      setBusyKey(null);
    }
  };

  const handleVariantChange = (nextVariant: BrandDomainVariant) => {
    setSelectedVariant(nextVariant);
    onSelectSiteVariant?.(nextVariant);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
          data-testid="brand-kit-modal-backdrop"
          data-last-download={lastDownloadedFile ?? ''}
        >
          {/* Затемнение фона */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/62 backdrop-blur-sm"
          />

          {/* Модальное окно Brand Kit AudioWorks */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="brand-kit-modal-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-[52rem] max-h-[90vh] overflow-y-auto no-scrollbar overscroll-contain rounded-3xl bg-[#F7F6F2] dark:bg-[#141418] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/12 dark:border-white/14 shadow-2xl p-5 sm:p-7 space-y-6"
          >
            {/* Шапка Brand Kit */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-[#111111]/56 dark:text-[#F4F3EF]/56">
                  Официальные векторные исходники и прозрачные PNG
                </p>
                <h2
                  id="brand-kit-modal-title"
                  className="text-xl sm:text-2xl font-bold tracking-tight"
                >
                  Brand Kit AudioWorks
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть Brand Kit AudioWorks"
                className="w-10 h-10 rounded-full flex items-center justify-center text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-white hover:bg-[#111111]/6 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* 4. Переключатель превью домена / знака: AudioWorks®, AudioWorks.pro, AirWorks® */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#111111]/64 dark:text-[#F4F3EF]/64">
                  Версия знака для предпросмотра и скачивания
                </span>
                {lastDownloadedFile && (
                  <span
                    data-testid="brand-kit-download-status"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF4820]"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Сохранено: {lastDownloadedFile}</span>
                  </span>
                )}
              </div>

              <div
                role="group"
                aria-label="Переключатель версии знака и домена"
                className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#EAE7DF] dark:bg-[#1D1D23]"
              >
                {BRAND_DOMAIN_OPTIONS.map((option) => {
                  const isSelected = selectedVariant === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleVariantChange(option.id)}
                      aria-pressed={isSelected}
                      className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? 'bg-white dark:bg-[#111114] text-[#111111] dark:text-white shadow-xs'
                          : 'text-[#111111]/65 dark:text-[#F4F3EF]/65 hover:text-[#111111] dark:hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {errorMsg && (
              <p
                role="alert"
                className="text-xs font-medium text-[#D9381E] bg-[#FF4820]/10 border border-[#FF4820]/25 rounded-xl px-3.5 py-2.5"
              >
                {errorMsg}
              </p>
            )}

            {/* Карточки файлов для скачивания в 1 клик */}
            <div className="space-y-4">
              {assetSpecs.map((spec) => {
                const svgActionKey = `${spec.id}-svg`;
                const pngActionKey = `${spec.id}-png`;
                const isSvgDone = downloadedKey === svgActionKey;
                const isPngDone = downloadedKey === pngActionKey;
                const isPngBusy = busyKey === pngActionKey;

                return (
                  <div
                    key={spec.id}
                    data-testid={`brand-kit-card-${spec.id}`}
                    className="rounded-2xl border border-[#111111]/10 dark:border-white/12 bg-white/75 dark:bg-[#1A1A20] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Живое векторное превью */}
                    <div className="flex items-center gap-4 min-w-0">
                      {spec.previewSurface === 'avatar' ? (
                        <div className="flex items-center gap-2.5 shrink-0">
                          <div
                            title="Квадратная иконка 1000×1000px"
                            className="w-16 h-16 rounded-2xl overflow-hidden shadow-sm shrink-0"
                          >
                            <AvatarMonogramPreview />
                          </div>
                          <div
                            title="Превью круглого аватара в Telegram и WhatsApp"
                            className="w-12 h-12 rounded-full overflow-hidden shadow-sm shrink-0 border border-[#111111]/10 dark:border-white/15"
                          >
                            <AvatarMonogramPreview />
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`h-18 px-5 rounded-xl flex items-center justify-center shrink-0 border ${
                            spec.previewSurface === 'light'
                              ? 'bg-[#F7F6F2] border-[#111111]/10'
                              : 'bg-[#111216] border-white/12'
                          }`}
                        >
                          <BrandLogo
                            variant={selectedVariant}
                            size="sm"
                            colorMode={spec.previewSurface === 'light' ? 'dark' : 'light'}
                          />
                        </div>
                      )}

                      <div className="min-w-0 space-y-1">
                        <h3 className="text-sm sm:text-base font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                          {spec.title}
                        </h3>
                        <p className="text-xs text-[#111111]/64 dark:text-[#F4F3EF]/64">
                          {spec.subtitle}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-[#111111]/54 dark:text-[#F4F3EF]/54 leading-relaxed">
                          {spec.svgFileName} / .png · {spec.dimensionsLabel}
                        </p>
                      </div>
                    </div>

                    {/* Кнопки скачивания SVG и PNG в 1 клик */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDownloadSvg(spec)}
                        aria-label={`Скачать ${spec.svgFileName}`}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#111111]/14 dark:border-white/16 bg-[#F7F6F2] dark:bg-[#23232B] hover:border-[#FF4820] text-[#111111] dark:text-[#F4F3EF] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {isSvgDone ? (
                          <Check className="w-3.5 h-3.5 text-[#FF4820]" aria-hidden="true" />
                        ) : (
                          <Download className="w-3.5 h-3.5 text-[#FF4820]" aria-hidden="true" />
                        )}
                        <span>SVG</span>
                      </button>

                      <button
                        type="button"
                        disabled={isPngBusy}
                        onClick={() => void handleDownloadPng(spec)}
                        aria-label={`Скачать ${spec.pngFileName}`}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {isPngDone ? (
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span className="tabular-nums">
                          {isPngBusy
                            ? 'Рендер…'
                            : spec.id === 'avatar-icon'
                              ? 'PNG 1000px'
                              : 'PNG 2400px'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Подсказка про вызов по правому клику и наведение на волну */}
            <div className="pt-2 border-t border-[#111111]/8 dark:border-white/10 text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">
              Наведите курсор на логотип для проверки живой волны W · правый клик по логотипу в шапке всегда открывает Brand Kit.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
