import { Check, Copy, PhoneCall, Send } from 'lucide-react';
import { MouseEvent as ReactMouseEvent, useEffect, useState } from 'react';
import { useStudioLegalConfig } from '../context/StudioLegalConfigContext';
import { BrandDomainVariant } from '../data/brandKitData';
import { AIRTIME_SALES_ENABLED } from '../data/platformFeatures';
import {
  buildPlatformPath,
  MAIN_PLATFORM_NAV_ITEMS,
  PlatformRoute,
} from '../data/platformRouter';
import {
  buildTelHref,
  formatDisplayPhoneRu,
  normalizeTelegramContact,
  resolveAdaptiveBrandTagline,
} from '../utils/footerContactsFormat';
import { BrandLogo } from './BrandLogo';
import { PersonalData152FzModal } from './legal/PersonalData152FzModal';

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
  const { activeProfile, privacySettings, publicContacts, inlineRequisites } =
    useStudioLegalConfig();

  const studioEmail = publicContacts.email || activeProfile.email;
  const studioCity = activeProfile.city || 'г. Тверь';
  const studioDomain = activeProfile.websiteDomain || 'fmworks.ru';
  const workHoursLabel = publicContacts.workHoursLabel;

  const phoneHref = buildTelHref(publicContacts.phone);
  const formattedPhone = formatDisplayPhoneRu(publicContacts.phone);
  const showPhoneCard = Boolean(
    publicContacts.showPhoneInFooter && phoneHref && formattedPhone
  );

  const telegramContact = normalizeTelegramContact(publicContacts.telegram);
  const showTelegramCard = Boolean(
    publicContacts.showTelegramInFooter && telegramContact
  );

  const tagline = resolveAdaptiveBrandTagline(
    publicContacts.taglineLine1,
    publicContacts.taglineLine2
  );

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
    if (!studioEmail) return;
    let copied = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(studioEmail);
        copied = true;
      } catch {
        copied = copyTextFallback(studioEmail);
      }
    } else {
      copied = copyTextFallback(studioEmail);
    }

    if (copied || studioEmail) {
      setIsEmailCopied(true);
      window.setTimeout(() => {
        setIsEmailCopied(false);
      }, 2400);
    }
  };

  const handleRouteClick = (
    e: ReactMouseEvent<HTMLAnchorElement>,
    route: PlatformRoute
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
      return;
    }
    if (!onNavigate) return;
    e.preventDefault();
    onNavigate(route);
  };

  const handleHomeClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (onNavigate) {
      onNavigate({ kind: 'home' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };



  return (
    <footer
      id="contacts"
      data-testid="site-footer"
      className="scroll-mt-20 pt-14 pb-28 sm:pt-18 sm:pb-24 lg:pt-24 lg:pb-28 border-t border-[#111111]/10 dark:border-[#F4F3EF]/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-10 sm:space-y-12 lg:space-y-14">
        {/* Зона 1: Позиционирование студии и адаптивная сетка прямых контактов (Почта · Телефон · Telegram) */}
        <div
          data-testid="footer-top-grid"
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 xl:gap-12 items-start lg:items-end"
        >
          <div className="lg:col-span-5 xl:col-span-6 space-y-3.5 sm:space-y-4">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-medium text-[#111111]/65 dark:text-[#F4F3EF]/65 tabular-nums">
              <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                {studioCity} · Работаем по всей РФ
              </span>
              {workHoursLabel ? (
                <>
                  <span aria-hidden="true" className="opacity-35">
                    ·
                  </span>
                  <span>{workHoursLabel}</span>
                </>
              ) : null}
              <span aria-hidden="true" className="opacity-35">
                ·
              </span>
              <span>
                Время студии{' '}
                <strong className="font-bold text-[#111111] dark:text-[#F4F3EF]">
                  {studioTime}
                </strong>
              </span>
            </div>

            <p className="text-xl sm:text-2xl xl:text-[28px] font-bold tracking-tight leading-[1.26] text-[#111111] dark:text-[#F4F3EF] editorial-balance max-w-xl">
              {AIRTIME_SALES_ENABLED
                ? 'Аудиопродакшн полного цикла и прямая бронь эфира для амбициозных брендов.'
                : 'Студийный аудиопродакшн полного цикла: сценарии, голоса кинодубляжа и чистые права для эфира.'}
            </p>
          </div>

          <div
            data-testid="footer-contacts-hub"
            className="lg:col-span-7 xl:col-span-6 w-full grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {/* Главная почта продюсеров с копированием в 1 клик (занимает 2 колонки адаптивной сетки на sm+) */}
            {studioEmail ? (
              <div className="sm:col-span-2 w-full rounded-2xl border border-[#111111]/12 dark:border-white/12 bg-white/75 dark:bg-[#141418] px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[11px] sm:text-xs font-medium text-[#111111]/56 dark:text-[#F4F3EF]/56">
                    Прямая почта продюсеров для ТЗ и реквизитов
                  </p>
                  <a
                    href={`mailto:${studioEmail}`}
                    data-testid="footer-mailto-link"
                    className="block text-lg sm:text-xl xl:text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors truncate"
                  >
                    {studioEmail}
                  </a>
                </div>

                <button
                  type="button"
                  data-testid="footer-copy-email-btn"
                  onClick={() => void handleCopyEmail()}
                  aria-label={`Скопировать адрес ${studioEmail}`}
                  className={`min-h-[44px] sm:min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold border inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                    isEmailCopied
                      ? 'bg-[#FF4820] text-white border-[#FF4820]'
                      : 'bg-[#F4F3EF] dark:bg-[#0D0D0F] text-[#111111]/84 dark:text-[#F4F3EF]/84 border-[#111111]/12 dark:border-white/14 hover:border-[#FF4820]/60'
                  }`}
                >
                  {isEmailCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Скопировано</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Скопировать почту</span>
                    </>
                  )}
                </button>
              </div>
            ) : null}

            {/* Карточка телефона продюсера (редактируется в админке, автоматически растягивается при скрытии Telegram) */}
            {showPhoneCard && phoneHref ? (
              <a
                href={phoneHref}
                data-testid="footer-studio-phone"
                className={`${
                  !showTelegramCard ? 'sm:col-span-2' : 'sm:col-span-1'
                } min-h-[58px] rounded-2xl border border-[#111111]/12 dark:border-white/12 bg-white/75 dark:bg-[#141418] hover:border-[#FF4820]/65 px-4 py-3 flex items-center justify-between gap-3 transition-colors group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]`}
              >
                <div className="min-w-0 space-y-0.5">
                  <span className="block text-[11px] font-medium text-[#111111]/56 dark:text-[#F4F3EF]/56 truncate">
                    {publicContacts.phoneLabel || 'Прямая линия продюсера'}
                  </span>
                  <span className="block text-sm sm:text-[15px] font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] group-hover:text-[#FF4820] transition-colors tabular-nums whitespace-nowrap">
                    {formattedPhone}
                  </span>
                </div>
                <PhoneCall
                  className="w-4 h-4 text-[#111111]/45 dark:text-[#F4F3EF]/45 group-hover:text-[#FF4820] transition-colors shrink-0"
                  aria-hidden="true"
                />
              </a>
            ) : null}

            {/* Карточка ссылки на Telegram (редактируется в админке, автоматически растягивается при скрытии телефона) */}
            {showTelegramCard && telegramContact ? (
              <a
                href={telegramContact.href}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="footer-studio-telegram"
                className={`${
                  !showPhoneCard ? 'sm:col-span-2' : 'sm:col-span-1'
                } min-h-[58px] rounded-2xl border border-[#111111]/12 dark:border-white/12 bg-white/75 dark:bg-[#141418] hover:border-[#FF4820]/65 px-4 py-3 flex items-center justify-between gap-3 transition-colors group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]`}
              >
                <div className="min-w-0 space-y-0.5">
                  <span className="block text-[11px] font-medium text-[#111111]/56 dark:text-[#F4F3EF]/56 truncate">
                    {publicContacts.telegramLabel || 'Написать в Telegram'}
                  </span>
                  <span className="block text-sm sm:text-[15px] font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] group-hover:text-[#FF4820] transition-colors whitespace-nowrap">
                    {telegramContact.displayHandle}
                  </span>
                </div>
                <Send
                  className="w-4 h-4 text-[#111111]/45 dark:text-[#F4F3EF]/45 group-hover:text-[#FF4820] transition-colors shrink-0"
                  aria-hidden="true"
                />
              </a>
            ) : null}
          </div>
        </div>

        {/* Зона 2: Адаптивная карта разделов платформы (2 колонки на мобильных, 3 на планшетах и ПК) */}
        <nav
          aria-label="Карта разделов платформы FMWorks"
          className="pt-8 sm:pt-10 border-t border-[#111111]/10 dark:border-[#F4F3EF]/10 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8 sm:gap-8 lg:gap-12 text-sm"
        >
          <div className="col-span-1 space-y-3">
            <p className="text-xs font-semibold text-[#111111]/52 dark:text-[#F4F3EF]/52">
              Разделы платформы
            </p>
            <ul className="space-y-1.5 sm:space-y-2">
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
                      className="min-h-[34px] sm:min-h-[28px] inline-flex items-center text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
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
                  className="min-h-[34px] sm:min-h-[28px] inline-flex items-center font-semibold text-[#FF4820] hover:underline whitespace-nowrap"
                >
                  {AIRTIME_SALES_ENABLED
                    ? 'Бронь и заказ\u00A0→'
                    : 'Заказать ролик\u00A0→'}
                </a>
              </li>
              <li>
                <a
                  href="/cabinet"
                  data-testid="footer-cabinet-link"
                  onClick={(e) => handleRouteClick(e, { kind: 'cabinet' })}
                  className="min-h-[34px] sm:min-h-[28px] inline-flex items-center text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
                >
                  Личный кабинет
                </a>
              </li>
            </ul>
          </div>

          <div className="col-span-1 space-y-3">
            <p className="text-xs font-semibold text-[#111111]/52 dark:text-[#F4F3EF]/52">
              Отраслевые решения
            </p>
            <ul className="space-y-1.5 sm:space-y-2">
              {FOOTER_INDUSTRY_LINKS.map((entry) => (
                <li key={entry.label}>
                  <a
                    href={buildPlatformPath(entry.route)}
                    data-testid={`footer-industry-${entry.id}`}
                    onClick={(e) => handleRouteClick(e, entry.route)}
                    className="min-h-[34px] sm:min-h-[28px] inline-flex items-center text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
                  >
                    {entry.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 md:col-span-1 space-y-3 pt-2 md:pt-0 border-t md:border-t-0 border-[#111111]/8 dark:border-[#F4F3EF]/8">
            <p className="text-xs font-semibold text-[#111111]/52 dark:text-[#F4F3EF]/52">
              {AIRTIME_SALES_ENABLED
                ? 'Карточки радиостанций'
                : 'Регламент и экспертиза'}
            </p>
            {AIRTIME_SALES_ENABLED ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-x-6 gap-y-1.5 sm:gap-y-2">
                {FOOTER_STATION_LINKS.map((entry) => (
                  <li key={entry.label}>
                    <a
                      href={buildPlatformPath(entry.route)}
                      onClick={(e) => handleRouteClick(e, entry.route)}
                      className="min-h-[34px] sm:min-h-[28px] inline-flex items-center text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
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
                    className="min-h-[34px] sm:min-h-[28px] inline-flex items-center text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
                  >
                    FAQ: процесс работы и срочные заказы
                  </a>
                </li>
                <li>
                  <a
                    href="/hot-air"
                    onClick={(e) => handleRouteClick(e, { kind: 'hot-air' })}
                    className="min-h-[34px] sm:min-h-[28px] inline-flex items-center text-[#111111]/60 dark:text-[#F4F3EF]/60 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
                  >
                    Все 12 радиостанций и слоты →
                  </a>
                </li>
              </ul>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-x-6 gap-y-1.5 sm:gap-y-2">
                {FOOTER_STUDIO_EXPERTISE_LINKS.map((entry) => (
                  <li key={entry.label}>
                    <a
                      href={buildPlatformPath(entry.route)}
                      data-testid={`footer-expertise-${entry.id}`}
                      onClick={(e) => handleRouteClick(e, entry.route)}
                      className="min-h-[34px] sm:min-h-[28px] inline-flex items-center text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
                    >
                      {entry.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </nav>

        {/* Зона 3: Двухстрочная адаптивная подпись бренда, служебные ссылки и реквизиты оператора (ст. 10 149-ФЗ) */}
        <div className="pt-7 sm:pt-8 border-t border-[#111111]/10 dark:border-[#F4F3EF]/10 space-y-3.5 text-sm text-[#111111]/64 dark:text-[#F4F3EF]/64">
          <div
            data-testid="footer-bottom-grid"
            className="grid grid-cols-1 lg:grid-cols-12 items-start lg:items-center gap-4 lg:gap-6"
          >
            {/* Логотип + двухстрочная адаптивная подпись «Аудиореклама, / которая работает» на fmworks.ru */}
            <div
              data-testid="footer-brand-signature"
              className="lg:col-span-6 flex items-center gap-3 sm:gap-3.5 min-w-0"
            >
              <a
                href="/"
                aria-label={`${studioDomain} — на главную`}
                onClick={handleHomeClick}
                className="inline-flex items-center shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
              >
                <BrandLogo
                  variant={brandVariant}
                  size="sm"
                  onOpenBrandKit={onOpenBrandKit}
                />
              </a>

              <span
                aria-hidden="true"
                className="h-7 w-px bg-[#111111]/14 dark:bg-[#F4F3EF]/16 shrink-0"
              />

              <div
                data-testid="footer-brand-tagline"
                className="min-w-0 text-xs sm:text-[13px] leading-[1.26]"
              >
                {/* На узких и средних экранах (< xl): сама фраза складывается в две сбалансированные строки */}
                <div className="xl:hidden">
                  <span className="block font-semibold text-[#111111] dark:text-[#F4F3EF]">
                    {tagline.firstLine}
                  </span>
                  <span className="block font-semibold text-[#111111] dark:text-[#F4F3EF]">
                    {tagline.secondLine}
                    <span aria-hidden="true" className="mx-1.5 opacity-35 font-normal">
                      ·
                    </span>
                    <a
                      href="/"
                      onClick={handleHomeClick}
                      className="font-medium text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
                    >
                      {studioDomain}
                    </a>
                  </span>
                </div>

                {/* На широком десктопе (xl+): 1-я строка — слоган целиком, 2-я строка — чистый домен fmworks.ru */}
                <div className="hidden xl:block">
                  <span className="block font-semibold text-[#111111] dark:text-[#F4F3EF]">
                    {tagline.singleLine}
                  </span>
                  <a
                    href="/"
                    onClick={handleHomeClick}
                    className="block text-xs font-medium text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors"
                  >
                    {studioDomain}
                  </a>
                </div>
              </div>
            </div>

            {/* Служебные ссылки (без висячих точек при переносе на узких экранах) */}
            <div className="lg:col-span-6 lg:justify-self-end flex flex-wrap items-center gap-x-5 sm:gap-x-4 gap-y-1 text-xs sm:text-sm">
              <a
                href="/faq"
                data-testid="footer-bottom-faq-link"
                onClick={(e) => handleRouteClick(e, { kind: 'faq' })}
                className="min-h-[38px] lg:min-h-[36px] inline-flex items-center text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors whitespace-nowrap"
              >
                FAQ и срочные заказы
              </a>
              <span aria-hidden="true" className="hidden sm:inline opacity-25">
                ·
              </span>
              <a
                href="/privacy"
                data-testid="footer-pdn-policy-btn"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  if (onNavigate) {
                    e.preventDefault();
                    onNavigate({ kind: 'privacy' });
                    return;
                  }
                  e.preventDefault();
                  setIsPdnModalOpen(true);
                }}
                className="min-h-[38px] lg:min-h-[36px] inline-flex items-center text-left text-[#111111]/80 dark:text-[#F4F3EF]/80 font-medium hover:text-[#FF4820] dark:hover:text-[#FF4820] transition-colors cursor-pointer whitespace-nowrap"
              >
                Политика ПДн (152-ФЗ)
              </a>
              <span aria-hidden="true" className="hidden sm:inline opacity-25">
                ·
              </span>
              <a
                href="/admin"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  if (onOpenAdmin) {
                    e.preventDefault();
                    onOpenAdmin();
                  }
                }}
                className="min-h-[38px] lg:min-h-[36px] inline-flex items-center text-[#111111]/54 dark:text-[#F4F3EF]/54 hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors whitespace-nowrap"
              >
                Кабинет студии
              </a>
            </div>
          </div>

          {privacySettings.showRequisitesInFooter && (
            <p
              data-testid="footer-operator-requisites"
              className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58 leading-relaxed tabular-nums"
            >
              Оператор ПДн и владелец сайта: {inlineRequisites}
            </p>
          )}
        </div>
      </div>

      <PersonalData152FzModal
        isOpen={isPdnModalOpen}
        onClose={() => setIsPdnModalOpen(false)}
      />
    </footer>
  );
}
