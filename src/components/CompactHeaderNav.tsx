import { CheckCircle2, Menu, Moon, Sun, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BrandDomainVariant } from '../data/brandKitData';
import { ReservationLifecycleStatus } from '../data/orderDraftStore';
import { AIRTIME_SALES_ENABLED } from '../data/platformFeatures';
import {
  ALL_PLATFORM_NAV_ITEMS,
  MainPlatformNavItem,
  PlatformRoute,
  resolveActiveTopNavSection,
  TopNavSectionKey,
} from '../data/platformRouter';
import { BrandLogo } from './BrandLogo';

export interface CompactHeaderNavProps {
  isDark: boolean;
  onToggleTheme: () => void;
  activeRoute: PlatformRoute;
  onNavigate: (route: PlatformRoute) => void;
  onOpenOrder: () => void;
  brandVariant?: BrandDomainVariant;
  onOpenBrandKit?: () => void;
  /** Опциональные параметры консервированного эфирного модуля (не используются в студийном режиме) */
  hasActiveHold?: boolean;
  holdStationsCount?: number;
  reservationStatus?: ReservationLifecycleStatus;
  confirmedOrderNumber?: string | null;
  onOpenConfirmedModal?: () => void;
}

export function isAirtimeNavItem(item: Pick<MainPlatformNavItem, 'key' | 'href'>): boolean {
  return (
    item.key === 'hot-air' ||
    item.href === '/hot-air' ||
    item.href.startsWith('/hot-air/') ||
    item.href === '#hot-air'
  );
}

/**
 * Явно исключает все эфирные ссылки в режиме студийного продакшна и консолидирует
 * оставшиеся разделы в лаконичную однострочную навигацию.
 */
export function resolveCompactHeaderNavItems(
  items: readonly MainPlatformNavItem[] = ALL_PLATFORM_NAV_ITEMS,
  airtimeEnabled = AIRTIME_SALES_ENABLED
): readonly MainPlatformNavItem[] {
  if (airtimeEnabled) {
    return items;
  }
  return items.filter((item) => !isAirtimeNavItem(item));
}

export function resolveHeaderNavTargetRoute(
  key: TopNavSectionKey,
  airtimeEnabled = AIRTIME_SALES_ENABLED
): PlatformRoute {
  switch (key) {
    case 'home':
      return { kind: 'home' };
    case 'hot-air':
      return airtimeEnabled ? { kind: 'hot-air' } : { kind: 'home' };
    case 'cases':
      return { kind: 'cases' };
    case 'pricing':
      return { kind: 'pricing' };
    case 'approach':
      return { kind: 'approach' };
    case 'faq':
      return { kind: 'faq' };
  }
}

export function CompactHeaderNav({
  isDark,
  onToggleTheme,
  activeRoute,
  onNavigate,
  onOpenOrder,
  brandVariant = 'fmworks_reg',
  onOpenBrandKit,
  hasActiveHold = false,
  holdStationsCount = 0,
  reservationStatus,
  confirmedOrderNumber = null,
  onOpenConfirmedModal,
}: CompactHeaderNavProps) {
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const headerRef = useRef<HTMLElement | null>(null);

  const navItems = useMemo(
    () => resolveCompactHeaderNavItems(ALL_PLATFORM_NAV_ITEMS, AIRTIME_SALES_ENABLED),
    []
  );

  const rawActiveSection = resolveActiveTopNavSection(activeRoute);
  const activeTopSection =
    !AIRTIME_SALES_ENABLED && rawActiveSection === 'hot-air'
      ? null
      : rawActiveSection;
  const isOrderActive = activeRoute.kind === 'order';

  const effectiveStatus: ReservationLifecycleStatus = !AIRTIME_SALES_ENABLED
    ? 'none'
    : (reservationStatus ?? (hasActiveHold ? 'draft_selected' : 'none'));

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activeRoute]);

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
    onNavigate({ kind: 'home' });
  };

  const handleNavClick = (
    e: ReactMouseEvent<HTMLAnchorElement>,
    key: TopNavSectionKey
  ) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    const targetRoute = resolveHeaderNavTargetRoute(key, AIRTIME_SALES_ENABLED);
    onNavigate(targetRoute);
  };

  const handlePrimaryCtaClick = () => {
    setIsMobileMenuOpen(false);
    if (
      AIRTIME_SALES_ENABLED &&
      effectiveStatus === 'confirmed_hold' &&
      onOpenConfirmedModal
    ) {
      onOpenConfirmedModal();
      return;
    }
    onOpenOrder();
  };

  return (
    <header
      ref={headerRef}
      aria-label="Главная навигация студии FMWorks"
      className={`sticky top-0 z-40 w-full h-14 bg-[#F7F6F2]/92 dark:bg-[#0D0D0F]/92 backdrop-blur-xl transition-colors duration-200 border-b ${
        isScrolled || activeRoute.kind !== 'home'
          ? 'border-[#111111]/8 dark:border-white/10'
          : 'border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto h-full px-3 sm:px-6 lg:px-12 flex items-center justify-between gap-2 sm:gap-4 lg:gap-8 relative min-w-0">
        {/* Зона 1: Логотип бренда (однострочный знак без прилипших подзаголовков и бейджей) */}
        <a
          href="/"
          onClick={handleBrandClick}
          onContextMenu={(e) => {
            if (!onOpenBrandKit) return;
            e.preventDefault();
            onOpenBrandKit();
          }}
          title="Главная страница FMWorks"
          className="inline-flex items-center whitespace-nowrap shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF4820]"
        >
          <span className="sm:hidden inline-flex items-center">
            <BrandLogo
              variant={brandVariant}
              size="sm"
              onOpenBrandKit={onOpenBrandKit}
            />
          </span>
          <span className="hidden sm:inline-flex items-center">
            <BrandLogo
              variant={brandVariant}
              size="md"
              onOpenBrandKit={onOpenBrandKit}
            />
          </span>
        </a>

        {/* Зона 2: Консолидированная студийная навигация (чистая однострочная типографика) */}
        <nav
          aria-label="Основные разделы студии"
          className="hidden md:flex items-center gap-7 lg:gap-9 h-full"
        >
          {navItems.map((item) => {
            const isActive = activeTopSection === item.key;
            return (
              <a
                key={item.key}
                href={item.href}
                data-testid={`header-nav-${item.key}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => handleNavClick(e, item.key)}
                className={`group relative h-full inline-flex items-center text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                  isActive
                    ? 'text-[#111111] dark:text-[#F4F3EF] font-semibold'
                    : 'text-[#111111]/64 dark:text-[#F4F3EF]/64 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                }`}
              >
                <span>{item.label}</span>
                {isActive ? (
                  <motion.span
                    layoutId="platform-nav-indicator"
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[#FF4820]"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[#111111]/20 dark:bg-white/25 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Зона 3: Личный кабинет, переключатель темы, мобильное меню и целевое действие студии */}
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0 min-w-0">
          <a
            href="/cabinet"
            data-testid="header-cabinet-link"
            aria-current={activeRoute.kind === 'cabinet' ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              setIsMobileMenuOpen(false);
              onNavigate({ kind: 'cabinet' });
            }}
            className={`hidden sm:inline-flex items-center h-9 px-3 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
              activeRoute.kind === 'cabinet'
                ? 'bg-[#111111]/10 text-[#111111] dark:bg-white/14 dark:text-[#F4F3EF]'
                : 'text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-[#F4F3EF] hover:bg-[#111111]/5 dark:hover:bg-white/6'
            }`}
          >
            Кабинет
          </a>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-[#F4F3EF] hover:bg-[#111111]/6 dark:hover:bg-white/8 transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
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
            className="md:hidden w-10 h-10 rounded-full flex items-center justify-center text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:bg-[#111111]/6 dark:hover:bg-white/8 transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
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
            className={`h-9 sm:h-10 px-3 sm:px-5 rounded-full text-xs sm:text-[13px] font-semibold tracking-tight inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
              AIRTIME_SALES_ENABLED && effectiveStatus === 'confirmed_hold'
                ? 'bg-[#111111] text-[#F7F6F2] hover:bg-[#FF4820] hover:text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white'
                : isOrderActive
                  ? 'bg-[#111111] text-[#F7F6F2] dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'bg-[#FF4820] hover:bg-[#E63D18] text-white'
            }`}
          >
            {AIRTIME_SALES_ENABLED && effectiveStatus === 'confirmed_hold' ? (
              <>
                <CheckCircle2
                  className="w-3.5 h-3.5 text-[#FF4820] shrink-0"
                  aria-hidden="true"
                />
                <span className="sm:hidden">Бронь</span>
                <span className="hidden sm:inline">
                  {confirmedOrderNumber
                    ? `Бронь #${confirmedOrderNumber} принята`
                    : 'Бронь принята · Статус'}
                </span>
              </>
            ) : AIRTIME_SALES_ENABLED && effectiveStatus === 'draft_selected' ? (
              <>
                <span className="sm:hidden">Выбрано {holdStationsCount} ст.</span>
                <span className="hidden sm:inline">
                  Выбрано {holdStationsCount} ст. · Завершить бронь
                </span>
              </>
            ) : AIRTIME_SALES_ENABLED ? (
              <span>Оформить заказ</span>
            ) : (
              <>
                <span className="min-[380px]:hidden">Заказать</span>
                <span className="max-[379px]:hidden">Заказать ролик</span>
              </>
            )}
          </button>
        </div>

        {/* Выпадающее мобильное меню студийных разделов */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.nav
              id="compact-mobile-nav"
              aria-label="Мобильное меню разделов студии"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden absolute left-3 right-3 sm:left-auto sm:right-4 top-15 sm:w-64 z-50 rounded-2xl bg-[#F7F6F2] dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/12 shadow-xl p-2"
            >
              <div className="space-y-0.5">
                {navItems.map((item) => {
                  const isActive = activeTopSection === item.key;
                  return (
                    <a
                      key={item.key}
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={(e) => handleNavClick(e, item.key)}
                      className={`min-h-11 flex items-center justify-between px-3.5 rounded-xl text-sm transition-colors whitespace-nowrap ${
                        isActive
                          ? 'font-semibold text-[#FF4820] bg-[#111111]/4 dark:bg-white/6'
                          : 'font-medium text-[#111111] dark:text-[#F4F3EF] hover:bg-[#111111]/6 dark:hover:bg-white/8'
                      }`}
                    >
                      <span>{item.label}</span>
                    </a>
                  );
                })}
              </div>

              <div className="mt-2 pt-2 border-t border-[#111111]/8 dark:border-white/10 space-y-1.5">
                <a
                  href="/cabinet"
                  data-testid="mobile-cabinet-link"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMobileMenuOpen(false);
                    onNavigate({ kind: 'cabinet' });
                  }}
                  className={`min-h-10 flex items-center justify-between px-3.5 rounded-xl text-sm transition-colors whitespace-nowrap ${
                    activeRoute.kind === 'cabinet'
                      ? 'font-semibold text-[#FF4820] bg-[#111111]/4 dark:bg-white/6'
                      : 'font-medium text-[#111111]/82 dark:text-[#F4F3EF]/82 hover:bg-[#111111]/6 dark:hover:bg-white/8'
                  }`}
                >
                  <span>Личный кабинет</span>
                </a>
                <button
                  type="button"
                  onClick={handlePrimaryCtaClick}
                  className="w-full min-h-11 px-4 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  {AIRTIME_SALES_ENABLED ? 'Оформить заказ' : 'Заказать ролик'}
                </button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
