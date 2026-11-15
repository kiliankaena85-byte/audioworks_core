import { Check, Copy } from 'lucide-react';
import { MouseEvent as ReactMouseEvent, useEffect, useState } from 'react';
import { BrandDomainVariant } from '../data/brandKitData';
import { AIRTIME_SALES_ENABLED } from '../data/platformFeatures';
import {
  buildPlatformPath,
  MAIN_PLATFORM_NAV_ITEMS,
  PlatformRoute,
} from '../data/platformRouter';
import { BrandLogo } from './BrandLogo';
import { PersonalData152FzModal } from './legal/PersonalData152FzModal';

const STUDIO_EMAIL = 'art@artmspektr.ru';
const STUDIO_PHONE = '+79040000911';

function readStudioTimeHHMM(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function copyTextFallback(text: string): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.className = 'sr-only';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

interface FooterProps {
  brandVariant?: BrandDomainVariant;
  onOpenBrandKit?: () => void;
  onOpenAdmin?: () => void;
  onOpenOrder?: () => void;
  onNavigate?: (route: PlatformRoute) => void;
}

const FOOTER_INDUSTRY_LINKS: readonly {
  id: string;
  label: string;
  route: PlatformRoute;
}[] = [
  {
    id: 'real-estate',
    label: 'ЖК и девелопмент',
    route: { kind: 'industry-detail', industrySlug: 'real-estate' },
  },
  {
    id: 'medicine',
    label: 'Медицина и клиники',
    route: { kind: 'industry-detail', industrySlug: 'medicine' },
  },
  {
    id: 'retail-fmcg',
    label: 'Ритейл и FMCG',
    route: { kind: 'industry-detail', industrySlug: 'retail-fmcg' },
  },
  {
    id: 'b2b-finance',
    label: 'B2B и финансы',
    route: { kind: 'industry-detail', industrySlug: 'b2b-finance' },
  },
] as const;

const FOOTER_STATION_LINKS: readonly { label: string; route: PlatformRoute }[] = [
  { label: 'Business FM', route: { kind: 'station-detail', stationSlug: 'business-fm' } },
  { label: 'Радио Monte Carlo', route: { kind: 'station-detail', stationSlug: 'monte-carlo' } },
  { label: 'Авторадио', route: { kind: 'station-detail', stationSlug: 'avtoradio' } },
  { label: 'Европа Плюс', route: { kind: 'station-detail', stationSlug: 'europa-plus' } },
] as const;

const FOOTER_STUDIO_EXPERTISE_LINKS: readonly {
  id: string;
  label: string;
  route: PlatformRoute;
}[] = [
  {
    id: 'stages-24-48',
    label: 'Этапы производства и сроки',
    route: { kind: 'pricing', scrollAnchor: 'stages-24-48' },
  },
  {
    id: 'legal-clearance',
    label: 'Паспорт прав РАО / ВОИС',
    route: { kind: 'pricing', scrollAnchor: 'legal-clearance' },
  },
  {
    id: 'radio-mistakes',
    label: 'Разбор 5 ошибок в сценариях',
    route: { kind: 'approach', scrollAnchor: 'radio-mistakes' },
  },
  {
    id: 'faq',
    label: 'FAQ: процесс работы и срочные заказы',
    route: { kind: 'faq' },
  },
  {
    id: 'urgent-order',
    label: 'Срочный заказ ролика от 1 часа',
    route: { kind: 'faq', scrollAnchor: 'urgent-order' },
  },
] as const;

export function Footer({
  brandVariant = 'fmworks_reg',
  onOpenBrandKit,
  onOpenAdmin,
  onOpenOrder,
  onNavigate,
}: FooterProps = {}) {
  const [studioTime, setStudioTime] = useState<string>(() => readStudioTimeHHMM());
  const [isEmailCopied, setIsEmailCopied] = useState<boolean>(false);
  const [isPdnModalOpen, setIsPdnModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStudioTime(readStudioTimeHHMM());
    }, 10000);
    return () => window.clearInterval(timer);
  }, []);

  const handleCopyEmail = async () => {
    let copied = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(STUDIO_EMAIL);
        copied = true;
      } catch {
        copied = copyTextFallback(STUDIO_EMAIL);
      }
    } else {
      copied = copyTextFallback(STUDIO_EMAIL);
    }

    if (copied || STUDIO_EMAIL) {
      setIsEmailCopied(true);
      window.setTimeout(() => {
        setIsEmailCopied(false);
      }, 2400);
    }
  };

  const handleRouteClick = (e: ReactMouseEvent<HTMLAnchorElement>, route: PlatformRoute) => {
    if (!onNavigate) return;
    e.preventDefault();
    onNavigate(route);
  };

  return (
    <footer
      id="contacts"
      className="scroll-mt-20 pt-16 pb-24 sm:py-20 lg:py-28 border-t border-[#111111]/10 dark:border-[#F4F3EF]/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-12 sm:space-y-14 lg:space-y-16">
        {/* Верхний блок контакта продюсеров */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 sm:gap-10">
          <div className="space-y-4 sm:space-y-5 max-w-xl">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-medium text-[#111111]/65 dark:text-[#F4F3EF]/65 tabular-nums">
              <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                г. Тверь · Работаем по всей РФ
              </span>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span>Пн–Пт 09:00–19:00 (МСК)</span>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span>
                Время студии{' '}
                <strong className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                  {studioTime}
                </strong>
              </span>
            </div>

            <p className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-[#111111] dark:text-[#F4F3EF] editorial-balance">
              {AIRTIME_SALES_ENABLED
                ? 'Аудиопродакшн полного цикла и прямая бронь эфира для амбициозных брендов.'
                : 'Студийный аудиопродакшн полного цикла: сценарии, голоса кинодубляжа и чистые права для эфира.'}
            </p>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-2">
            <p className="text-xs font-medium text-[#111111]/55 dark:text-[#F4F3EF]/55">
              Прямая почта продюсеров · скопировать в 1 клик
            </p>

            <button
              type="button"
              onClick={handleCopyEmail}
              aria-label={`Скопировать адрес ${STUDIO_EMAIL}`}
              className="min-h-[48px] group flex flex-wrap items-center gap-2.5 sm:gap-3.5 text-xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer text-left"
            >
              <span className="break-all sm:break-normal">{STUDIO_EMAIL}</span>
              <span
                className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shrink-0 ${
                  isEmailCopied
                    ? 'bg-[#FF4820] text-white border-[#FF4820]'
                    : 'bg-[#EFECE5] dark:bg-[#17171C] text-[#111111]/80 dark:text-[#F4F3EF]/80 border-[#111111]/12 dark:border-white/14 group-hover:border-[#FF4820]/50'
                }`}
              >
                {isEmailCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Копировать</span>
                  </>
                )}
              </span>
            </button>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-[#111111]/64 dark:text-[#F4F3EF]/64 tabular-nums">
              <a
                href={`tel:${STUDIO_PHONE}`}
                data-testid="footer-studio-phone"
                className="font-semibold text-[#111111]/82 dark:text-[#F4F3EF]/82 hover:text-[#FF4820] transition-colors"
              >
                {STUDIO_PHONE}
              </a>
            </div>
          </div>
        </div>

        {/* Многостраничная карта разделов платформы */}
        <nav
          aria-label="Карта разделов платформы FMWorks"
          className="pt-10 border-t border-[#111111]/10 dark:border-[#F4F3EF]/10 grid grid-cols-1 sm:grid-cols-3 gap-8 lg:gap-12 text-sm"
        >
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#111111]/50 dark:text-[#F4F3EF]/50">
              Разделы платформы
            </p>
            <ul className="space-y-2">
              {MAIN_PLATFORM_NAV_ITEMS.map((item) => {
                const route: PlatformRoute =
                  item.key === 'home'
                    ? { kind: 'home' }
                    : item.key === 'hot-air'
                      ? { kind: 'hot-air' }
                      : item.key === 'cases'
                        ? { kind: 'cases' }
                        : item.key === 'pricing'
                          ? { kind: 'pricing' }
                          : item.key === 'faq'
                            ? { kind: 'faq' }
                            : { kind: 'approach' };
                return (
                  <li key={item.key}>
                    <a
                      href={item.href}
                      data-testid={`footer-nav-${item.key}`}
                      onClick={(e) => handleRouteClick(e, route)}
                      className="inline-flex py-0.5 text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
              <li>
                <a
                  href="/order"
                  data-testid="footer-order-link"
                  onClick={(e) => {
                    if (onOpenOrder) {
                      e.preventDefault();
                      onOpenOrder();
                      return;
                    }
                    handleRouteClick(e, { kind: 'order' });
                  }}
                  className="inline-flex py-0.5 font-semibold text-[#FF4820] hover:underline"
                >
                  {AIRTIME_SALES_ENABLED
                    ? 'Оформление брони и заказа →'
                    : 'Заказать аудиоролик →'}
                </a>
              </li>
              <li>
                <a
                  href="/cabinet"
                  data-testid="footer-cabinet-link"
                  onClick={(e) => handleRouteClick(e, { kind: 'cabinet' })}
                  className="inline-flex py-0.5 text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
                >
                  Личный кабинет заказов
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#111111]/50 dark:text-[#F4F3EF]/50">
              Отраслевые решения
            </p>
            <ul className="space-y-2">
              {FOOTER_INDUSTRY_LINKS.map((entry) => (
                <li key={entry.label}>
                  <a
                    href={buildPlatformPath(entry.route)}
                    data-testid={`footer-industry-${entry.id}`}
                    onClick={(e) => handleRouteClick(e, entry.route)}
                    className="inline-flex py-0.5 text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
                  >
                    {entry.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#111111]/50 dark:text-[#F4F3EF]/50">
              {AIRTIME_SALES_ENABLED
                ? 'Карточки радиостанций'
                : 'Регламент и экспертиза'}
            </p>
            {AIRTIME_SALES_ENABLED ? (
              <ul className="space-y-2">
                {FOOTER_STATION_LINKS.map((entry) => (
                  <li key={entry.label}>
                    <a
                      href={buildPlatformPath(entry.route)}
                      onClick={(e) => handleRouteClick(e, entry.route)}
                      className="inline-flex py-0.5 text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
                    >
                      {entry.label}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href="/faq"
                    data-testid="footer-expertise-faq"
                    onClick={(e) => handleRouteClick(e, { kind: 'faq' })}
                    className="inline-flex py-0.5 text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
                  >
                    FAQ: процесс работы и срочные заказы
                  </a>
                </li>
                <li>
                  <a
                    href="/hot-air"
                    onClick={(e) => handleRouteClick(e, { kind: 'hot-air' })}
                    className="inline-flex py-0.5 text-[#111111]/58 dark:text-[#F4F3EF]/58 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
                  >
                    Все 12 радиостанций и слоты →
                  </a>
                </li>
              </ul>
            ) : (
              <ul className="space-y-2">
                {FOOTER_STUDIO_EXPERTISE_LINKS.map((entry) => (
                  <li key={entry.label}>
                    <a
                      href={buildPlatformPath(entry.route)}
                      data-testid={`footer-expertise-${entry.id}`}
                      onClick={(e) => handleRouteClick(e, entry.route)}
                      className="inline-flex py-0.5 text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
                    >
                      {entry.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </nav>

        {/* Нижняя строка копирайта */}
        <div className="pt-8 border-t border-[#111111]/10 dark:border-[#F4F3EF]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-[#111111]/62 dark:text-[#F4F3EF]/62">
          <div className="flex flex-wrap items-center gap-3">
            <BrandLogo
              variant={brandVariant}
              size="sm"
              onOpenBrandKit={onOpenBrandKit}
            />
            <span className="font-medium text-[#111111]/78 dark:text-[#F4F3EF]/78">
              FMWorks® — Аудиореклама, которая работает •{' '}
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  if (onNavigate) {
                    onNavigate({ kind: 'home' });
                  } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className="hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
              >
                fmworks.ru
              </a>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href="/faq"
              data-testid="footer-bottom-faq-link"
              onClick={(e) => handleRouteClick(e, { kind: 'faq' })}
              className="min-h-[44px] inline-flex items-center text-[#111111]/62 dark:text-[#F4F3EF]/62 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors whitespace-nowrap"
            >
              FAQ и срочные заказы
            </a>
            <span aria-hidden="true" className="opacity-25">
              ·
            </span>
            <button
              type="button"
              data-testid="footer-pdn-policy-btn"
              onClick={() => setIsPdnModalOpen(true)}
              className="min-h-[44px] inline-flex items-center text-left text-[#111111]/62 dark:text-[#F4F3EF]/62 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer whitespace-normal sm:whitespace-nowrap"
            >
              Политика ПДн (152-ФЗ)
            </button>
            <span aria-hidden="true" className="opacity-25">
              ·
            </span>
            <a
              href="/admin"
              onClick={(e) => {
                if (onOpenAdmin) {
                  e.preventDefault();
                  onOpenAdmin();
                }
              }}
              className="min-h-[44px] inline-flex items-center text-[#111111]/48 dark:text-[#F4F3EF]/48 hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors whitespace-nowrap"
            >
              Кабинет студии
            </a>
            <span aria-hidden="true" className="opacity-25">
              ·
            </span>
            <a
              href={`mailto:${STUDIO_EMAIL}`}
              data-testid="footer-mailto-link"
              className="min-h-[44px] inline-flex items-center hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors whitespace-nowrap"
            >
              {STUDIO_EMAIL}
            </a>
          </div>
        </div>
      </div>

      <PersonalData152FzModal
        isOpen={isPdnModalOpen}
        onClose={() => setIsPdnModalOpen(false)}
      />
    </footer>
  );
}
