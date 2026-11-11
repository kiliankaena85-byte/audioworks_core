import { Moon, Sun, Zap } from 'lucide-react';

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  isQuickOrderOpen: boolean;
  onOpenQuickOrder: () => void;
}

export function Header({
  isDark,
  onToggleTheme,
  isQuickOrderOpen,
  onOpenQuickOrder,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 h-18 bg-[#F7F6F2]/90 dark:bg-[#0D0D0F]/90 backdrop-blur-md border-b border-[#111111]/8 dark:border-[#F4F3EF]/10 transition-colors duration-200">
      <div className="max-w-7xl mx-auto h-full px-6 lg:px-12 flex items-center justify-between gap-6">
        {/* Left: Confident Logo + Live ON AIR indicator */}
        <div className="flex items-center gap-4 shrink-0">
          <a
            href="#top"
            className="text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF4820]"
          >
            Audioworks<sup className="text-xs font-semibold ml-0.5 opacity-75">®</sup>
          </a>

          <span
            aria-label="Студия в работе"
            className="hidden sm:inline-flex items-center gap-2 text-xs font-medium tracking-tight text-[#111111]/65 dark:text-[#F4F3EF]/65 whitespace-nowrap"
          >
            <span className="w-2 h-2 rounded-full bg-[#FF4820]" aria-hidden="true" />
            <span>ON AIR</span>
          </span>
        </div>

        {/* Center: Clean Editorial Navigation */}
        <nav
          aria-label="Основная навигация"
          className="hidden md:flex items-center gap-8 text-sm font-medium text-[#111111]/70 dark:text-[#F4F3EF]/70"
        >
          <a
            href="#work"
            className="hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors whitespace-nowrap"
          >
            Работы
          </a>
          <a
            href="#approach"
            className="hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors whitespace-nowrap"
          >
            Подход
          </a>
          <a
            href="#pricing"
            className="hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors whitespace-nowrap"
          >
            Стоимость
          </a>
          <a
            href="#contacts"
            className="hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors whitespace-nowrap"
          >
            Контакты
          </a>
        </nav>

        {/* Right: Theme Switcher + Tactile Quick Order Pill */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#111111]/75 dark:text-[#F4F3EF]/80 hover:bg-[#111111]/6 dark:hover:bg-[#F4F3EF]/10 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenQuickOrder}
            aria-expanded={isQuickOrderOpen}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63C17] active:scale-[0.98] text-white text-sm font-semibold tracking-tight transition-all cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
          >
            <Zap className="w-4 h-4 fill-current" aria-hidden="true" />
            <span>Быстрый заказ</span>
          </button>
        </div>
      </div>
    </header>
  );
}
