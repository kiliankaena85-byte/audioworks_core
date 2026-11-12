import { Menu, Moon, Sun, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
import { BrandDomainVariant } from '../data/brandKitData';
import {
  COMPACT_NAV_ITEMS,
  computeSmoothScrollTargetY,
  NavSectionId,
  resolveActiveSectionId,
  SectionViewportBounds,
} from '../data/navigationData';
import { BrandLogo } from './BrandLogo';

interface CompactHeaderNavProps {
  isDark: boolean;
  onToggleTheme: () => void;
  isQuickOrderOpen: boolean;
  onOpenQuickOrder: () => void;
  brandVariant?: BrandDomainVariant;
  onOpenBrandKit?: () => void;
}

export function CompactHeaderNav({
  isDark,
  onToggleTheme,
  isQuickOrderOpen,
  onOpenQuickOrder,
  brandVariant = 'audioworks_reg',
  onOpenBrandKit,
}: CompactHeaderNavProps) {
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const [activeSectionId, setActiveSectionId] = useState<NavSectionId | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const headerRef = useRef<HTMLElement | null>(null);
  const manualLockUntilRef = useRef<number>(0);

  useEffect(() => {
    let rafId = 0;

    const syncScrollState = () => {
      rafId = 0;
      const scrollY = window.scrollY;
      const nextScrolled = scrollY > 16;
      setIsScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));

      if (performance.now() < manualLockUntilRef.current) {
        return;
      }

      const bounds: SectionViewportBounds[] = [];
      for (const item of COMPACT_NAV_ITEMS) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        bounds.push({ id: item.id, top: rect.top, bottom: rect.bottom });
      }

      const docEl = document.documentElement;
      const isAtBottom =
        scrollY > 80 &&
        window.innerHeight + scrollY >= docEl.scrollHeight - 36;

      const resolved = resolveActiveSectionId(bounds, 148, isAtBottom);
      setActiveSectionId((prev) => (prev === resolved ? prev : resolved));
    };

    const onScrollOrResize = () => {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(syncScrollState);
    };

    syncScrollState();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
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

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handleBrandClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    setActiveSectionId(null);
    manualLockUntilRef.current = performance.now() + 550;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  const handleSectionNavigate = (
    e: ReactMouseEvent<HTMLAnchorElement>,
    sectionId: NavSectionId,
    href: string
  ) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);

    const targetEl = document.getElementById(sectionId);
    if (!targetEl) return;

    setActiveSectionId(sectionId);
    manualLockUntilRef.current = performance.now() + 650;

    const targetY = computeSmoothScrollTargetY(
      targetEl.getBoundingClientRect().top,
      window.scrollY
    );

    window.scrollTo({
      top: targetY,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });

    window.history.replaceState(null, '', href);
  };

  return (
    <header
      ref={headerRef}
      aria-label="Закреплённая навигация AudioWorks"
      className={`sticky top-0 z-50 w-full h-14 bg-[#F7F6F2]/92 dark:bg-[#0D0D0F]/92 backdrop-blur-xl transition-colors duration-200 border-b ${
        isScrolled
          ? 'border-[#111111]/8 dark:border-white/10'
          : 'border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-12 flex items-center justify-between gap-6 lg:gap-8 relative">
        {/* Зона 1: Дизайнерский векторный логотип с плавным возвратом к началу и Brand Kit по правому клику */}
        <a
          href="#top"
          onClick={handleBrandClick}
          onContextMenu={(e) => {
            if (!onOpenBrandKit) return;
            e.preventDefault();
            onOpenBrandKit();
          }}
          title="Нажмите для возврата наверх · Правый клик открывает Brand Kit (SVG / PNG)"
          className="inline-flex items-center whitespace-nowrap shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF4820]"
        >
          <BrandLogo
            variant={brandVariant}
            size="md"
            onOpenBrandKit={onOpenBrandKit}
          />
        </a>

        {/* Зона 2: Компактная навигация к ключевым секциям (Галерея, Стоимость, FAQ и др.) */}
        <nav
          aria-label="Навигация по секциям страницы"
          className="hidden md:flex items-center gap-6 lg:gap-8 h-full"
        >
          {COMPACT_NAV_ITEMS.map((item) => {
            const isActive = activeSectionId === item.id;
            return (
              <a
                key={item.id}
                href={item.href}
                aria-current={isActive ? 'location' : undefined}
                onClick={(e) => handleSectionNavigate(e, item.id, item.href)}
                className={`relative h-full inline-flex items-center text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                  isActive
                    ? 'text-[#111111] dark:text-[#F4F3EF] font-semibold'
                    : 'text-[#111111]/62 dark:text-[#F4F3EF]/62 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                }`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <motion.span
                    layoutId="compact-nav-indicator"
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[#FF4820]"
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Зона 3: Переключатель темы, компактное мобильное меню и главное действие */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
            onClick={onOpenQuickOrder}
            aria-expanded={isQuickOrderOpen}
            className="h-9 sm:h-10 px-4 sm:px-5 rounded-full bg-[#FF4820] hover:bg-[#E63D18] active:scale-[0.99] text-white text-xs sm:text-[13px] font-semibold tracking-tight inline-flex items-center justify-center transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
          >
            Быстрый заказ
          </button>
        </div>

        {/* Компактное выпадающее меню для мобильных экранов */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.nav
              id="compact-mobile-nav"
              aria-label="Мобильное меню разделов"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden absolute right-4 top-15 w-56 rounded-2xl bg-[#F7F6F2] dark:bg-[#15151A] border border-[#111111]/10 dark:border-white/12 shadow-xl p-1.5"
            >
              {COMPACT_NAV_ITEMS.map((item) => {
                const isActive = activeSectionId === item.id;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    aria-current={isActive ? 'location' : undefined}
                    onClick={(e) => handleSectionNavigate(e, item.id, item.href)}
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
