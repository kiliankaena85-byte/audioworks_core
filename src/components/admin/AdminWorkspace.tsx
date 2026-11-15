import {
  AlertTriangle,
  ArrowUpRight,
  AudioWaveform,
  CheckCircle2,
  ClipboardList,
  FileText,
  FlaskConical,
  FolderKanban,
  LogOut,
  MessageSquareQuote,
  Moon,
  Radio,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Type,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSiteTextBlocks } from '../../cms/SiteTextBlocksContext';
import { useStudioCms } from '../../cms/StudioCmsContext';
import { BrandDomainVariant } from '../../data/brandKitData';
import { assignPortfolioCaseToHeroStage } from '../../data/heroStageCms';
import { AIRTIME_SALES_ENABLED } from '../../data/platformFeatures';
import {
  auditEditorialCopyGuardrails,
  BANNED_EDITORIAL_TERMS,
} from '../../data/studioCmsTypes';
import { BrandLogo } from '../BrandLogo';
import { LayaSimulationConsole } from '../LayaSimulationConsole';
import { AdminDuelPanel } from './AdminDuelPanel';
import { AdminHeroStagePanel } from './AdminHeroStagePanel';
import { AdminLoginScreen } from './AdminLoginScreen';
import { AdminOrdersCrmPanel } from './AdminOrdersCrmPanel';
import { AdminPortfolioPanel } from './AdminPortfolioPanel';
import { AdminSecurityPanel } from './AdminSecurityPanel';
import { AdminShowcaseScenesBar } from './AdminShowcaseScenesBar';
import { AdminSiteCopyPanel } from './AdminSiteCopyPanel';
import { AdminTestimonialsPanel } from './AdminTestimonialsPanel';
import { AdminTextBlocksPanel } from './AdminTextBlocksPanel';

export type AdminSectionTab =
  | 'orders_crm'
  | 'science_plan'
  | 'hero_stage'
  | 'portfolio'
  | 'text_blocks'
  | 'duel'
  | 'testimonials'
  | 'copy'
  | 'laya_brand'
  | 'security';

interface AdminWorkspaceProps {
  brandVariant: BrandDomainVariant;
  onSelectBrandVariant?: (variant: BrandDomainVariant) => void;
  onOpenBrandKit?: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onNavigateHome: () => void;
}

function formatUpdatedTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function AdminWorkspace({
  brandVariant,
  onSelectBrandVariant,
  onOpenBrandKit,
  isDark,
  onToggleTheme,
  onNavigateHome,
}: AdminWorkspaceProps) {
  const {
    snapshot,
    hasLocalChanges,
    hasLocalHeroChanges,
    localPortfolioChangeCount,
    localTestimonialsChangeCount,
    isCustomizedOnServer,
    isAuthenticated,
    isAuthChecking,
    isSaving,
    login,
    logout,
    updateLocalSnapshot,
    discardLocalChanges,
    saveSnapshot,
    resetToDefaults,
    uploadAudioFile,
    uploadImageFile,
  } = useStudioCms();

  const {
    blocks: liveTextBlocks,
    modifiedCount: liveModifiedCount,
    resetAllBlocks: resetLiveTextBlocks,
  } = useSiteTextBlocks();

  const [activeTab, setActiveTab] = useState<AdminSectionTab>('orders_crm');
  const [saveBanner, setSaveBanner] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);

  const guardrailWarnings = useMemo(() => {
    const baseWarnings = auditEditorialCopyGuardrails(snapshot);
    const liveSerialized = JSON.stringify(liveTextBlocks).toLowerCase();
    const combined = new Set<string>(baseWarnings);
    for (const term of BANNED_EDITORIAL_TERMS) {
      if (liveSerialized.includes(term)) {
        combined.add(term);
      }
    }
    return Array.from(combined);
  }, [snapshot, liveTextBlocks]);

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#F7F6F2] dark:bg-[#0D0D0F] flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-8 space-y-4">
          <div className="h-6 w-40 rounded-md bg-[#111111]/8 dark:bg-white/8 animate-pulse" />
          <div className="h-4 w-64 rounded-md bg-[#111111]/6 dark:bg-white/6 animate-pulse" />
          <div className="h-11 w-full rounded-xl bg-[#111111]/6 dark:bg-white/6 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AdminLoginScreen
        brandVariant={brandVariant}
        onLogin={login}
        onNavigateHome={onNavigateHome}
      />
    );
  }

  const handleSavePublish = async () => {
    setSaveBanner(null);
    const res = await saveSnapshot(snapshot);
    if (!res.ok) {
      setSaveBanner({ kind: 'error', text: res.error });
      return;
    }

    setSaveBanner({
      kind: 'ok',
      text:
        res.warnings.length > 0
          ? `Изменения записаны на сервер (обратите внимание на редакционные рекомендации: ${res.warnings.join(', ')}).`
          : 'Изменения записаны на сервер и закреплены за витриной сайта.',
    });
  };

  const handleDiscardLocal = () => {
    discardLocalChanges();
    setSaveBanner(null);
  };

  const handleResetAll = async () => {
    setSaveBanner(null);
    resetLiveTextBlocks();
    const res = await resetToDefaults();
    if (!res.ok) {
      setSaveBanner({ kind: 'error', text: res.error });
    }
  };

  const handleNavigateToAnchor = (
    anchorHash: '#top' | '#work' | '#duel' | '#testimonials'
  ) => {
    onNavigateHome();
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        if (anchorHash === '#top') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        const targetEl = document.getElementById(anchorHash.slice(1));
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 80);
    }
  };

  const handleNavigateToGallery = () => {
    handleNavigateToAnchor('#work');
  };

  const SECTION_META: Record<
    AdminSectionTab,
    { label: string; subtitle: string }
  > = {
    orders_crm: {
      label: 'Заказы и воронка (CRM)',
      subtitle: AIRTIME_SALES_ENABLED
        ? 'Приём резервов эфира с таймером 4ч, генератор счёта-спецификации ЭДО и шлюзы доставки в Telegram и внешние CRM'
        : 'Приём студийных заказов аудиороликов, контроль SLA ответа продюсера, генератор счёта ЭДО и шлюзы в Telegram и CRM',
    },
    science_plan: {
      label: 'Научный план развития',
      subtitle:
        'Когнитивный порог 5+ касаний, атрибуция Search Lift за рулём, психоакустика первых 3 секунд и LTV повторных волн',
    },
    hero_stage: {
      label: 'Первый экран (Hero · Краш-тест)',
      subtitle:
        'Прямая загрузка аудиоролика WAV/MP3 на первый экран сайта, подключение кейса из Портфолио в 1 клик и настройка 3 фаз краш-теста',
    },
    portfolio: {
      label: 'Портфолио и звук · Экран 3',
      subtitle:
        'Загрузка WAV/MP3 для секции «Наши работы» (#work) и каталога /cases, заголовки кейсов и настройка 3-секундного превью',
    },
    text_blocks: {
      label: 'Текстовые блоки (Live)',
      subtitle:
        'Мгновенное редактирование заголовков и описаний секций Hero, Approach и Pricing в памяти сессии',
    },
    duel: {
      label: 'Дуэль 15 секунд · Экран 4',
      subtitle:
        'Аудиодорожки сторон А и Б для секции «Один бриф на 15 секунд» (#duel), условия брифа и синхронные реплики по таймкодам',
    },
    testimonials: {
      label: 'Отзывы клиентов · StudioCMS',
      subtitle:
        'Динамические отзывы брендов на главной (#testimonials), показатели доверия, привязка аудиороликов из портфолио и отраслевые рубрики',
    },
    copy: {
      label: 'Исследования, FAQ и архив',
      subtitle:
        'Цифры исследований ЦНС, расценки тарифов в рублях, частые вопросы и резервные копии .json',
    },
    laya_brand: {
      label: 'Персонализация Laya AI и Brand Kit',
      subtitle:
        'Симуляция профилей аудитории, маршрутизация звука под отрасль и управление фирменным стилем FMWorks без вывода на клиентскую витрину',
    },
    security: {
      label: 'Защита от спама и заявки',
      subtitle:
        'Журнал верифицированных заявок, теневой карантин ботов, проверка ИНН ФНС и защита рекламного бюджета',
    },
  };

  const formattedTime = formatUpdatedTimestamp(snapshot.updatedAt);
  const isLiveTextTab = activeTab === 'text_blocks';
  const isOrdersOrScienceTab =
    activeTab === 'orders_crm' ||
    activeTab === 'science_plan' ||
    activeTab === 'laya_brand';

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#111111] dark:bg-[#0D0D0F] dark:text-[#F4F3EF] flex flex-col lg:flex-row">
      {/* Left Workspace Sidebar (264px sticky viewport height on desktop) */}
      <aside className="w-full lg:w-[264px] lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto no-scrollbar shrink-0 bg-white dark:bg-[#141418] border-b lg:border-b-0 lg:border-r border-[#111111]/10 dark:border-white/10 flex flex-col justify-between p-5">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigateHome();
              }}
              aria-label="Перейти на главную витрину FMWorks"
              className="inline-flex items-center whitespace-nowrap shrink-0"
            >
              <BrandLogo variant={brandVariant} size="sm" />
            </a>
          </div>

          <nav aria-label="Разделы кабинета студии" className="space-y-1.5">
            <button
              type="button"
              data-testid="admin-nav-orders-crm"
              onClick={() => {
                setActiveTab('orders_crm');
                setSaveBanner(null);
              }}
              className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'orders_crm'
                  ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <ClipboardList className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Заказы и воронка (CRM)</span>
              </span>
            </button>

            <button
              type="button"
              data-testid="admin-nav-science-plan"
              onClick={() => {
                setActiveTab('science_plan');
                setSaveBanner(null);
              }}
              className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'science_plan'
                  ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <FlaskConical className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Научный план развития</span>
              </span>
            </button>

            <div className="my-2 border-t border-[#111111]/8 dark:border-white/8" />

            <button
              type="button"
              data-testid="admin-nav-hero-stage"
              onClick={() => {
                setActiveTab('hero_stage');
                setSaveBanner(null);
              }}
              className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'hero_stage'
                  ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <Radio className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Первый экран (Hero)</span>
              </span>
              {hasLocalHeroChanges && (
                <span className="text-[11px] font-bold tabular-nums text-[#FF4820]">
                  1
                </span>
              )}
            </button>

            <button
              type="button"
              data-testid="admin-nav-portfolio"
              onClick={() => {
                setActiveTab('portfolio');
                setSaveBanner(null);
              }}
              className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'portfolio'
                  ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <FolderKanban className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Портфолио и звук</span>
              </span>
              {localPortfolioChangeCount > 0 && (
                <span className="text-[11px] font-bold tabular-nums text-[#FF4820]">
                  {localPortfolioChangeCount}
                </span>
              )}
            </button>

            <button
              type="button"
              data-testid="admin-nav-text-blocks"
              onClick={() => {
                setActiveTab('text_blocks');
                setSaveBanner(null);
              }}
              className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'text_blocks'
                  ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <Type className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Текстовые блоки</span>
              </span>
              {liveModifiedCount > 0 && (
                <span className="text-[11px] font-bold tabular-nums text-[#FF4820]">
                  {liveModifiedCount}
                </span>
              )}
            </button>

            <button
              type="button"
              data-testid="admin-nav-duel"
              onClick={() => {
                setActiveTab('duel');
                setSaveBanner(null);
              }}
              className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'duel'
                  ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              <AudioWaveform className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Дуэль 15 секунд</span>
            </button>

            <button
              type="button"
              data-testid="admin-nav-testimonials"
              onClick={() => {
                setActiveTab('testimonials');
                setSaveBanner(null);
              }}
              className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'testimonials'
                  ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <MessageSquareQuote className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Отзывы клиентов</span>
              </span>
              {localTestimonialsChangeCount > 0 && (
                <span className="text-[11px] font-bold tabular-nums text-[#FF4820]">
                  {localTestimonialsChangeCount}
                </span>
              )}
            </button>

            <button
              type="button"
              data-testid="admin-nav-copy"
              onClick={() => {
                setActiveTab('copy');
                setSaveBanner(null);
              }}
              className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'copy'
                  ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Исследования, FAQ и архив</span>
            </button>

            <button
              type="button"
              data-testid="admin-nav-laya-brand"
              onClick={() => {
                setActiveTab('laya_brand');
                setSaveBanner(null);
              }}
              className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'laya_brand'
                  ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Персонализация и бренд</span>
            </button>

            <button
              type="button"
              data-testid="admin-nav-security"
              onClick={() => {
                setActiveTab('security');
                setSaveBanner(null);
              }}
              className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'security'
                  ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Защита и заявки</span>
            </button>
          </nav>
        </div>

        {/* Bottom Workspace Actions */}
        <div className="pt-6 mt-6 border-t border-[#111111]/10 dark:border-white/10 space-y-1.5">
          <a
            href="/"
            data-testid="admin-back-to-site"
            onClick={(e) => {
              e.preventDefault();
              onNavigateHome();
            }}
            className="w-full min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white flex items-center justify-between gap-2 transition-colors whitespace-nowrap"
          >
            <span>На витрину сайта</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          </a>

          <button
            type="button"
            onClick={onToggleTheme}
            className="w-full min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Moon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{isDark ? 'Светлая тема' : 'Тёмная тема'}</span>
          </button>

          <button
            type="button"
            onClick={() => void logout()}
            className="w-full min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium text-[#111111]/62 dark:text-[#F4F3EF]/62 hover:text-[#DC2626] dark:hover:text-[#F87171] hover:bg-[#DC2626]/6 flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Выйти из кабинета</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual Top Header */}
        <header className="sticky top-0 z-20 bg-[#F7F6F2]/92 dark:bg-[#0D0D0F]/92 backdrop-blur-md border-b border-[#111111]/10 dark:border-white/10 px-5 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#111111]/56 dark:text-[#F4F3EF]/56">
              <span>Кабинет студии</span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-[#111111] dark:text-[#F4F3EF]">
                {SECTION_META[activeTab].label}
              </span>
              <span aria-hidden="true">·</span>
              {isOrdersOrScienceTab ? (
                <span
                  data-testid="admin-crm-realtime-status"
                  className="inline-flex items-center gap-1.5 font-medium text-[#16A34A] dark:text-[#4ADE80] tabular-nums"
                >
                  <CheckCircle2
                    className="w-3.5 h-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>Реестр сделок на сервере · автосохранение</span>
                </span>
              ) : isLiveTextTab ? (
                liveModifiedCount > 0 ? (
                  <span
                    data-testid="admin-live-session-status"
                    className="inline-flex items-center gap-1.5 font-semibold text-[#16A34A] dark:text-[#4ADE80] tabular-nums"
                  >
                    <CheckCircle2
                      className="w-3.5 h-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Обновлено в памяти сессии ({liveModifiedCount})
                    </span>
                  </span>
                ) : (
                  <span
                    data-testid="admin-live-session-status"
                    className="inline-flex items-center gap-1.5 font-medium text-[#16A34A] dark:text-[#4ADE80]"
                  >
                    <CheckCircle2
                      className="w-3.5 h-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Реальное время · память сессии</span>
                  </span>
                )
              ) : hasLocalChanges ? (
                <span
                  data-testid="admin-local-cms-status"
                  className="inline-flex items-center gap-1.5 font-semibold text-[#16A34A] dark:text-[#4ADE80] tabular-nums"
                >
                  <CheckCircle2
                    className="w-3.5 h-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Сохранено в локальном состоянии CMS
                    {localPortfolioChangeCount > 0
                      ? ` (${localPortfolioChangeCount})`
                      : ''}
                  </span>
                </span>
              ) : (
                <span
                  data-testid="admin-published-status"
                  className="inline-flex items-center gap-1.5 font-medium text-[#16A34A] dark:text-[#4ADE80] tabular-nums"
                >
                  <CheckCircle2
                    className="w-3.5 h-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {isCustomizedOnServer
                      ? `Опубликовано${formattedTime ? ` в ${formattedTime}` : ''}`
                      : 'Локальное состояние CMS синхронизировано'}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58 truncate">
              {SECTION_META[activeTab].subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {isOrdersOrScienceTab ? (
              <button
                type="button"
                data-testid="admin-open-live-site-btn"
                onClick={onNavigateHome}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>На витрину сайта</span>
                <ArrowUpRight
                  className="w-3.5 h-3.5 shrink-0"
                  aria-hidden="true"
                />
              </button>
            ) : isLiveTextTab ? (
              <>
                {liveModifiedCount > 0 && (
                  <button
                    type="button"
                    onClick={resetLiveTextBlocks}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:text-[#111111] dark:hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw
                      className="w-3.5 h-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Сбросить правки</span>
                  </button>
                )}

                <button
                  type="button"
                  data-testid="admin-open-live-site-btn"
                  onClick={onNavigateHome}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Проверить на витрине</span>
                  <ArrowUpRight
                    className="w-3.5 h-3.5 shrink-0"
                    aria-hidden="true"
                  />
                </button>
              </>
            ) : (
              <>
                {hasLocalChanges && (
                  <button
                    type="button"
                    onClick={handleDiscardLocal}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:text-[#111111] dark:hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw
                      className="w-3.5 h-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Сбросить правки</span>
                  </button>
                )}

                <button
                  type="button"
                  data-testid="admin-open-live-site-btn"
                  onClick={() =>
                    activeTab === 'testimonials'
                      ? handleNavigateToAnchor('#testimonials')
                      : onNavigateHome()
                  }
                  className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Проверить на витрине</span>
                  <ArrowUpRight
                    className="w-3.5 h-3.5 shrink-0"
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  disabled={isSaving || !hasLocalChanges}
                  data-testid="admin-save-publish-btn"
                  onClick={() => void handleSavePublish()}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] disabled:opacity-45 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:cursor-default whitespace-nowrap shrink-0"
                >
                  <Save className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {isSaving ? 'Сохранение…' : 'Сохранить на сервере'}
                  </span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Main Workspace Body */}
        <main className="flex-1 px-5 sm:px-8 py-6 sm:py-8 max-w-7xl w-full mx-auto space-y-6">
          {saveBanner && (
            <div
              role="status"
              data-testid="admin-save-banner"
              className={`px-4 py-3 rounded-xl text-xs font-medium border ${
                saveBanner.kind === 'ok'
                  ? 'bg-[#16A34A]/10 border-[#16A34A]/30 text-[#15803D] dark:text-[#4ADE80]'
                  : 'bg-[#DC2626]/10 border-[#DC2626]/30 text-[#DC2626] dark:text-[#F87171]'
              }`}
            >
              {saveBanner.text}
            </div>
          )}

          {guardrailWarnings.length > 0 && (
            <div
              role="status"
              className="px-4 py-3 rounded-xl text-xs font-medium bg-[#D97706]/10 border border-[#D97706]/30 text-[#B45309] dark:text-[#FBBF24] flex items-start gap-2.5"
            >
              <AlertTriangle
                className="w-4 h-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>
                Редакционный контроль FMWorks: в тексте встретились нежелательные штампы или гео-привязки ({guardrailWarnings.join(', ')}). Рекомендуем заменить их на нейтральные формулировки федерального продакшна.
              </span>
            </div>
          )}

          {(activeTab === 'hero_stage' ||
            activeTab === 'portfolio' ||
            activeTab === 'duel') && (
            <AdminShowcaseScenesBar
              snapshot={snapshot}
              activeScene={activeTab}
              onSelectScene={(sceneId) => {
                setActiveTab(sceneId);
                setSaveBanner(null);
              }}
              onNavigateToAnchor={handleNavigateToAnchor}
            />
          )}

          {(activeTab === 'orders_crm' || activeTab === 'science_plan') && (
            <AdminOrdersCrmPanel
              initialSubView={activeTab === 'science_plan' ? 'science' : 'funnel'}
            />
          )}

          {activeTab === 'laya_brand' && (
            <LayaSimulationConsole
              mode="embedded"
              activeBrandVariant={brandVariant}
              onSelectBrandVariant={onSelectBrandVariant}
              onOpenBrandKit={onOpenBrandKit}
              onOpenHeroStageAdmin={() => {
                setActiveTab('hero_stage');
                setSaveBanner(null);
              }}
              onOpenDuelAdmin={() => {
                setActiveTab('duel');
                setSaveBanner(null);
              }}
            />
          )}

          {activeTab === 'hero_stage' && (
            <AdminHeroStagePanel
              snapshot={snapshot}
              onChangeHeroStage={(nextHero) =>
                updateLocalSnapshot((prev) => ({
                  ...prev,
                  heroStage: nextHero,
                }))
              }
              onChangeHeroCopy={(patch) =>
                updateLocalSnapshot((prev) => ({
                  ...prev,
                  siteCopy: {
                    ...prev.siteCopy,
                    ...patch,
                  },
                }))
              }
              onUploadAudio={uploadAudioFile}
              onOpenPortfolioTab={() => {
                setActiveTab('portfolio');
                setSaveBanner(null);
              }}
              onNavigateToHeroOnSite={() => handleNavigateToAnchor('#top')}
            />
          )}

          {activeTab === 'portfolio' && (
            <AdminPortfolioPanel
              flagshipReel={snapshot.flagshipReel}
              portfolioCases={snapshot.portfolioCases}
              heroStage={snapshot.heroStage}
              onPatchCase={(caseId, patch) =>
                updateLocalSnapshot((prev) => {
                  if (prev.flagshipReel.id === caseId) {
                    return {
                      ...prev,
                      flagshipReel: { ...prev.flagshipReel, ...patch },
                    };
                  }
                  return {
                    ...prev,
                    portfolioCases: prev.portfolioCases.map((c) =>
                      c.id === caseId ? { ...c, ...patch } : c
                    ),
                  };
                })
              }
              onChangePortfolioCases={(nextCases) =>
                updateLocalSnapshot((prev) => ({
                  ...prev,
                  portfolioCases: nextCases,
                }))
              }
              onAssignCaseToHero={(item) =>
                updateLocalSnapshot((prev) => ({
                  ...prev,
                  heroStage: assignPortfolioCaseToHeroStage(prev.heroStage, item),
                }))
              }
              onOpenHeroStageTab={() => {
                setActiveTab('hero_stage');
                setSaveBanner(null);
              }}
              onUploadAudio={uploadAudioFile}
              onUploadImage={uploadImageFile}
              onNavigateToGallery={handleNavigateToGallery}
            />
          )}

          {activeTab === 'text_blocks' && (
            <AdminTextBlocksPanel onNavigateHome={onNavigateHome} />
          )}

          {activeTab === 'duel' && (
            <AdminDuelPanel
              duel={snapshot.duel}
              onChangeDuel={(nextDuel) =>
                updateLocalSnapshot((prev) => ({ ...prev, duel: nextDuel }))
              }
              onUploadAudio={uploadAudioFile}
            />
          )}

          {activeTab === 'testimonials' && (
            <AdminTestimonialsPanel
              testimonials={snapshot.testimonials}
              portfolioCases={snapshot.portfolioCases}
              flagshipReel={snapshot.flagshipReel}
              onChangeTestimonials={(nextTestimonials) =>
                updateLocalSnapshot((prev) => ({
                  ...prev,
                  testimonials: nextTestimonials,
                }))
              }
              onNavigateToTestimonialsOnSite={() =>
                handleNavigateToAnchor('#testimonials')
              }
            />
          )}

          {activeTab === 'copy' && (
            <AdminSiteCopyPanel
              draft={snapshot}
              onChangeNeuroApproach={(nextNeuro) =>
                updateLocalSnapshot((prev) => ({
                  ...prev,
                  neuroApproach: nextNeuro,
                }))
              }
              onChangeSiteCopy={(nextCopy) =>
                updateLocalSnapshot((prev) => ({ ...prev, siteCopy: nextCopy }))
              }
              onImportSnapshot={(imported) => updateLocalSnapshot(imported)}
              onResetToDefaults={handleResetAll}
              onUploadImage={uploadImageFile}
            />
          )}

          {activeTab === 'security' && <AdminSecurityPanel />}
        </main>
      </div>
    </div>
  );
}
