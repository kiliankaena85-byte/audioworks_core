import { CheckCircle2, Menu, Moon, Sun, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
import { BrandDomainVariant } from '../data/brandKitData';
import { ReservationLifecycleStatus } from '../data/orderDraftStore';
import {
  MAIN_PLATFORM_NAV_ITEMS,
  PlatformRoute,
  resolveActiveTopNavSection,
  TopNavSectionKey,
} from '../data/platformRouter';
import { BrandLogo } from './BrandLogo';

interface CompactHeaderNavProps {
  isDark: boolean;
  onToggleTheme: () => void;
  activeRoute: PlatformRoute;
  hasActiveHold: boolean;
  holdStationsCount: number;
  reservationStatus?: ReservationLifecycleStatus;
  confirmedOrderNumber?: string | null;
  onNavigate: (route: PlatformRoute) => void;
  onOpenOrder: () => void;
  onOpenConfirmedModal?: () => void;
  brandVariant?: BrandDomainVariant;
  onOpenBrandKit?: () => void;
}

function navKeyToRoute(key: TopNavSectionKey): PlatformRoute {
  switch (key) {
    case 'home':
      return { kind: 'home' };
    case 'hot-air':
      return { kind: 'hot-air' };
    case 'cases':
      return { kind: 'cases' };
    case 'pricing':
      return { kind: 'pricing' };
    case 'approach':
      return { kind: 'approach' };
  }
}

export function CompactHeaderNav({
  isDark,
  onToggleTheme,
  activeRoute,
  hasActiveHold,
  holdStationsCount,
  reservationStatus,
  confirmedOrderNumber = null,
  onNavigate,
  onOpenOrder,
  onOpenConfirmedModal,
  brandVariant = 'fmworks_reg',
  onOpenBrandKit,
}: CompactHeaderNavProps) {
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const headerRef = useRef<HTMLElement | null>(null);
  const activeTopSection = resolveActiveTopNavSection(activeRoute);
  const isOrderActive = activeRoute.kind === 'order';

  const effectiveStatus: ReservationLifecycleStatus =
    reservationStatus ?? (hasActiveHold ? 'draft_selected' : 'none');

  useEffect(() => {
    const syncScroll = () => {
      const next = window.scrollY > 12;
      setIsScrolled((prev) => (prev === next ? prev : next));
    };
    syncScroll();
    window.addEventListener('scroll', syncScroll, { passive: true });
    return () => window.removeEventListener('scroll', syncScroll);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (headerRef.current && target && !headerRef.current.contains(target)) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isMobileMenuOpen]);

  const handleBrandClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    if (activeRoute.kind === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    onNavigate({ kind: 'home' });
  };

  const handleNavClick = (
    e: ReactMouseEvent<HTMLAnchorElement>,
    key: TopNavSectionKey
  ) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    const targetRoute = navKeyToRoute(key);
    if (activeRoute.kind === targetRoute.kind) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    onNavigate(targetRoute);
  };

  const handlePrimaryCtaClick = () => {
    setIsMobileMenuOpen(false);
    if (effectiveStatus === 'confirmed_hold' && onOpenConfirmedModal) {
      onOpenConfirmedModal();
      return;
    }
    onOpenOrder();
  };

  return (
    <header
      ref={headerRef}
      aria-label="Главная навигация платформы FMWorks"
      className={`sticky top-0 z-50 w-full h-14 bg-[#F7F6F2]/92 dark:bg-[#0D0D0F]/92 backdrop-blur-xl transition-colors duration-200 border-b ${
        isScrolled || activeRoute.kind !== 'home'
          ? 'border-[#111111]/8 dark:border-white/10'
          : 'border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto h-full px-3 sm:px-6 lg:px-12 flex items-center justify-between gap-2 sm:gap-4 lg:gap-8 relative">
        {/* Зона 1: Логотип бренда */}
        <a
          href="/"
          onClick={handleBrandClick}
          onContextMenu={(e) => {
            if (!onOpenBrandKit) return;
            e.preventDefault();
            onOpenBrandKit();
          }}
          title="Главная страница FMWorks · Правый клик открывает Brand Kit"
          className="inline-flex items-center whitespace-nowrap shrink-0 rounded-lg max-sm:scale-[0.86] origin-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF4820]"
        >
          <BrandLogo
            variant={brandVariant}
            size="md"
            onOpenBrandKit={onOpenBrandKit}
          />
        </a>

        {/* Зона 2: Чистая однострочная текстовая навигация (5 разделов) */}
        <nav
          aria-label="Основные разделы сайта"
          className="hidden md:flex items-center gap-6 lg:gap-8 h-full"
        >
          {MAIN_PLATFORM_NAV_ITEMS.map((item) => {
            const isActive = activeTopSection === item.key;
            return (
              <a
                key={item.key}
                href={item.href}
                data-testid={`header-nav-${item.key}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => handleNavClick(e, item.key)}
                className={`relative h-full inline-flex items-center text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                  isActive
                    ? 'text-[#111111] dark:text-[#F4F3EF] font-semibold'
                    : 'text-[#111111]/62 dark:text-[#F4F3EF]/62 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                }`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <motion.span
                    layoutId="platform-nav-indicator"
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[#FF4820]"
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Зона 3: Тема, мобильное меню и единственное главное действие с разделением черновика и принятой брони */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 min-w-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-[#F4F3EF] hover:bg-[#111111]/6 dark:hover:bg-white/8 transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
          >
            {isDark ? (
              <Sun className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="compact-mobile-nav"
            aria-label={isMobileMenuOpen ? 'Закрыть меню разделов' : 'Открыть меню разделов'}
            className="md:hidden w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:bg-[#111111]/6 dark:hover:bg-white/8 transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
          >
            {isMobileMenuOpen ? (
              <X className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Menu className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            data-testid="header-order-cta"
            data-reservation-status={effectiveStatus}
            onClick={handlePrimaryCtaClick}
            aria-current={isOrderActive ? 'page' : undefined}
            className={`h-8 sm:h-10 px-2.5 sm:px-5 rounded-full text-[11px] sm:text-[13px] font-semibold tracking-tight inline-flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
              effectiveStatus === 'confirmed_hold'
                ? 'bg-[#111111] text-[#F7F6F2] hover:bg-[#FF4820] hover:text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white'
                : isOrderActive
                  ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'bg-[#FF4820] hover:bg-[#E63D18] text-white'
            }`}
          >
            {effectiveStatus === 'confirmed_hold' ? (
              <>
                <CheckCircle2
                  className="w-3.5 h-3.5 text-[#FF4820] shrink-0"
                  aria-hidden="true"
                />
                <span className="sm:hidden">Бронь принята</span>
                <span className="hidden sm:inline">
                  {confirmedOrderNumber
                    ? `Бронь #${confirmedOrderNumber} принята`
                    : 'Бронь принята · Статус'}
                </span>
              </>
            ) : effectiveStatus === 'draft_selected' ? (
              <>
                <span className="sm:hidden">
                  Выбрано {holdStationsCount} ст.
                </span>
                <span className="hidden sm:inline">
                  Выбрано {holdStationsCount} ст. · Завершить бронь
                </span>
              </>
            ) : (
              <span>Оформить заказ</span>
            )}
          </button>
        </div>

        {/* Выпадающее мобильное меню разделов */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.nav
              id="compact-mobile-nav"
              aria-label="Мобильное меню разделов"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden absolute right-4 top-15 w-60 rounded-2xl bg-[#F7F6F2] dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/12 shadow-xl p-1.5"
            >
              {MAIN_PLATFORM_NAV_ITEMS.map((item) => {
                const isActive = activeTopSection === item.key;
                return (
                  <a
                    key={item.key}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={(e) => handleNavClick(e, item.key)}
                    className={`min-h-[44px] flex items-center justify-between px-3.5 rounded-xl text-sm transition-colors ${
                      isActive
                        ? 'font-semibold text-[#FF4820] bg-[#111111]/4 dark:bg-white/6'
                        : 'font-medium text-[#111111] dark:text-[#F4F3EF] hover:bg-[#111111]/6 dark:hover:bg-white/8'
                    }`}
                  >
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
