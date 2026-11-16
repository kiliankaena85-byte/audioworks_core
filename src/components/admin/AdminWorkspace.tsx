import {
  AlertTriangle,
  ArrowUpRight,
  AudioWaveform,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  FolderKanban,
  LogOut,
  Menu,
  MessageSquareQuote,
  Mic2,
  Moon,
  PhoneCall,
  Radio,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sun,
  UserCheck,
  X,
} from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useSiteTextBlocks } from '../../cms/SiteTextBlocksContext';
import { useStudioCms } from '../../cms/StudioCmsContext';
import { BrandDomainVariant } from '../../data/brandKitData';
import { assignPortfolioCaseToHeroStage } from '../../data/heroStageCms';
import {
  auditEditorialCopyGuardrails,
  BANNED_EDITORIAL_TERMS,
} from '../../data/studioCmsTypes';
import { BrandLogo } from '../BrandLogo';
import { AdminLoginScreen } from './AdminLoginScreen';
import { AdminShowcaseScenesBar } from './AdminShowcaseScenesBar';

const AdminOrdersCrmPanel = lazy(() =>
  import('./AdminOrdersCrmPanel').then((mod) => ({
    default: mod.AdminOrdersCrmPanel,
  }))
);
const LazyAdminStudioAnalyticsPanel = lazy(() =>
  import('./AdminStudioAnalyticsPanel').then((mod) => ({
    default: mod.AdminStudioAnalyticsPanel,
  }))
);
const AdminHeroStagePanel = lazy(() =>
  import('./AdminHeroStagePanel').then((mod) => ({
    default: mod.AdminHeroStagePanel,
  }))
);
const AdminPortfolioPanel = lazy(() =>
  import('./AdminPortfolioPanel').then((mod) => ({
    default: mod.AdminPortfolioPanel,
  }))
);
const AdminDuelPanel = lazy(() =>
  import('./AdminDuelPanel').then((mod) => ({
    default: mod.AdminDuelPanel,
  }))
);
const AdminTestimonialsPanel = lazy(() =>
  import('./AdminTestimonialsPanel').then((mod) => ({
    default: mod.AdminTestimonialsPanel,
  }))
);
const AdminSiteCopyPanel = lazy(() =>
  import('./AdminSiteCopyPanel').then((mod) => ({
    default: mod.AdminSiteCopyPanel,
  }))
);
const LayaSimulationConsole = lazy(() =>
  import('../LayaSimulationConsole').then((mod) => ({
    default: mod.LayaSimulationConsole,
  }))
);

function AdminTabSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <div className="h-[58px] rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 animate-pulse" />
      <div className="h-[340px] rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 animate-pulse" />
    </div>
  );
}

export type AdminSectionTab =
  | 'orders_crm'
  | 'production'
  | 'analytics'
  | 'settings'
  | 'hero_stage'
  | 'portfolio'
  | 'duel'
  | 'testimonials'
  | 'copy'
  | 'laya_brand';

const CMS_SECTION_TABS: ReadonlySet<AdminSectionTab> = new Set([
  'hero_stage',
  'portfolio',
  'duel',
  'testimonials',
  'copy',
  'laya_brand',
]);

interface AdminWorkspaceProps {
  brandVariant: BrandDomainVariant;
  onSelectBrandVariant?: (variant: BrandDomainVariant) => void;
  onOpenBrandKit?: () => void;
  onOpenRadioAdmin?: () => void;
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
  onOpenRadioAdmin,
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
    operatorName,
    login,
    logout,
    updateLocalSnapshot,
    discardLocalChanges,
    saveSnapshot,
    resetToDefaults,
    uploadAudioFile,
    uploadImageFile,
  } = useStudioCms();

  const { blocks: liveTextBlocks, resetAllBlocks: resetLiveTextBlocks } =
    useSiteTextBlocks();

  const [activeTab, setActiveTab] = useState<AdminSectionTab>('orders_crm');
  const [isCmsDrawerOpen, setIsCmsDrawerOpen] = useState<boolean>(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [focusedOrderId, setFocusedOrderId] = useState<string | undefined>(
    undefined
  );
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
          ? `Изменения записаны на сервер (редакционные рекомендации: ${res.warnings.join(', ')}).`
          : 'Изменения записаны на сервер и опубликованы на витрине сайта.',
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

  const SECTION_META: Record<
    AdminSectionTab,
    { label: string; subtitle: string }
  > = {
    orders_crm: {
      label: 'Реестр сделок и ЭДО',
      subtitle:
        'Коммерческий реестр заявок B2B, счета и договоры A4, черновики Контур.Диадока и нормативная проверка хронометража ФЗ-38',
    },
    production: {
      label: 'Производство и озвучка',
      subtitle:
        'Согласование сценариев, назначение звукорежиссёров, дубли дикторов и передача финальных WAV-мастеров',
    },
    analytics: {
      label: 'Аналитика и отчёты',
      subtitle:
        'Конверсия заказов по месяцам, соблюдение SLA первого ответа (≤ 15 мин), сдача роликов с 1-го дубля и выгрузка PDF/CSV',
    },
    settings: {
      label: 'Контакты и реквизиты',
      subtitle:
        'Телефон и ссылка на Telegram в подвале сайта, реквизиты ООО / ИП (152-ФЗ), шлюзы уведомлений и антиспам',
    },
    hero_stage: {
      label: 'Первый экран (Hero)',
      subtitle:
        'Загрузка демо-аудиоролика на главный экран сайта, привязка кейса из Портфолио и настройка фаз прослушивания',
    },
    portfolio: {
      label: 'Портфолио и звук',
      subtitle:
        'Управление кейсами секции «Наши работы» (#work) и каталога /cases, загрузка WAV/MP3 и 3-секундных превью',
    },
    duel: {
      label: 'Дуэль 15 секунд',
      subtitle:
        'Аудиодорожки вариантов А и Б для секции сравнения на главной (#duel), условия брифа и синхронные реплики',
    },
    testimonials: {
      label: 'Отзывы клиентов',
      subtitle:
        'Отзывы заказчиков на витрине (#testimonials), показатели эффекта, привязка аудиороликов и отраслевые рубрики',
    },
    copy: {
      label: 'Тарифы, FAQ и архив',
      subtitle:
        'Стоимость пакетов производства в рублях, ответы на частые вопросы и резервные копии конфигурации .json',
    },
    laya_brand: {
      label: 'Бренд и профили витрины',
      subtitle:
        'Управление фирменным стилем FMWorks и отраслевыми сценариями витрины',
    },
  };

  const formattedTime = formatUpdatedTimestamp(snapshot.updatedAt);
  const isCmsTabActive = CMS_SECTION_TABS.has(activeTab);
  const isOperationalTab = !isCmsTabActive || activeTab === 'laya_brand';
  const showCmsItems = isCmsDrawerOpen || isCmsTabActive;
  const cmsUnsavedBadgesCount =
    (hasLocalHeroChanges ? 1 : 0) +
    localPortfolioChangeCount +
    localTestimonialsChangeCount +
    (hasLocalChanges &&
    !hasLocalHeroChanges &&
    localPortfolioChangeCount === 0 &&
    localTestimonialsChangeCount === 0
      ? 1
      : 0);

  const selectAdminSection = (nextTab: AdminSectionTab, keepCmsOpen = false) => {
    setActiveTab(nextTab);
    if (keepCmsOpen) {
      setIsCmsDrawerOpen(true);
    }
    setIsMobileNavOpen(false);
    setSaveBanner(null);
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#111111] dark:bg-[#0D0D0F] dark:text-[#F4F3EF] flex flex-col lg:flex-row">
      {/* Канонический боковой навигатор (264px на десктопе, свёрнутая шапка на мобильном 390px) */}
      <aside className="w-full lg:w-[264px] lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto no-scrollbar shrink-0 bg-white dark:bg-[#141418] border-b lg:border-b-0 lg:border-r border-[#111111]/10 dark:border-white/10 flex flex-col justify-between px-4 py-3 lg:p-5">
        <div className="space-y-4 lg:space-y-6">
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

            <button
              type="button"
              data-testid="admin-mobile-menu-toggle"
              aria-expanded={isMobileNavOpen}
              aria-controls="admin-sidebar-drawer"
              aria-label={
                isMobileNavOpen
                  ? 'Свернуть меню разделов кабинета'
                  : 'Открыть меню разделов кабинета'
              }
              onClick={() => setIsMobileNavOpen((prev) => !prev)}
              className="lg:hidden min-h-[38px] px-3 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {isMobileNavOpen ? (
                <>
                  <X className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Закрыть</span>
                </>
              ) : (
                <>
                  <Menu className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Разделы</span>
                </>
              )}
            </button>
          </div>

          <div
            id="admin-sidebar-drawer"
            className={`${isMobileNavOpen ? 'block pt-2 border-t border-[#111111]/10 dark:border-white/10 lg:pt-0 lg:border-t-0' : 'hidden'} lg:block space-y-6`}
          >
            <nav aria-label="Операционное управление студией" className="space-y-1.5">
              <button
                type="button"
                data-testid="admin-nav-orders-crm"
                onClick={() => selectAdminSection('orders_crm')}
                className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'orders_crm'
                    ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                    : 'text-[#111111]/76 dark:text-[#F4F3EF]/76 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <ClipboardList className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Реестр сделок и ЭДО</span>
                </span>
              </button>

              <button
                type="button"
                data-testid="admin-nav-production"
                onClick={() => selectAdminSection('production')}
                className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'production'
                    ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                    : 'text-[#111111]/76 dark:text-[#F4F3EF]/76 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <Mic2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Производство и озвучка</span>
                </span>
              </button>

              <button
                type="button"
                data-testid="admin-nav-analytics"
                onClick={() => selectAdminSection('analytics')}
                className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'analytics'
                    ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                    : 'text-[#111111]/76 dark:text-[#F4F3EF]/76 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <BarChart3 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Аналитика и отчёты</span>
                </span>
              </button>

              <button
                type="button"
                data-testid="admin-nav-settings"
                onClick={() => selectAdminSection('settings')}
                className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                    : 'text-[#111111]/76 dark:text-[#F4F3EF]/76 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Контакты и реквизиты</span>
                </span>
              </button>

              {/* Вторичный свёрнутый контур управления контентом витрины сайта */}
              <div className="pt-3 mt-3 border-t border-[#111111]/8 dark:border-white/8 space-y-1">
                <button
                  type="button"
                  data-testid="admin-toggle-cms-group"
                  aria-expanded={showCmsItems}
                  onClick={() => setIsCmsDrawerOpen((prev) => !prev)}
                  className="w-full min-h-[38px] px-3.5 py-1.5 rounded-xl text-left text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:text-[#111111] dark:hover:text-white hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-2">
                    <span>Витрина сайта (CMS)</span>
                    {cmsUnsavedBadgesCount > 0 && (
                      <span className="text-[11px] font-bold tabular-nums text-[#B82D0D] dark:text-[#FF7A5C]">
                        {cmsUnsavedBadgesCount}
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
                      showCmsItems ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {showCmsItems && (
                  <div className="space-y-1 pt-1">
                    <button
                      type="button"
                      data-testid="admin-nav-hero-stage"
                      onClick={() => selectAdminSection('hero_stage', true)}
                      className={`w-full min-h-[38px] px-3.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'hero_stage'
                          ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                          : 'text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2.5">
                        <Radio className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Первый экран (Hero)</span>
                      </span>
                      {hasLocalHeroChanges && (
                        <span className="text-[11px] font-bold tabular-nums text-[#B82D0D] dark:text-[#FF7A5C]">
                          1
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      data-testid="admin-nav-portfolio"
                      onClick={() => selectAdminSection('portfolio', true)}
                      className={`w-full min-h-[38px] px-3.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'portfolio'
                          ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                          : 'text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2.5">
                        <FolderKanban
                          className="w-3.5 h-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>Портфолио и звук</span>
                      </span>
                      {localPortfolioChangeCount > 0 && (
                        <span className="text-[11px] font-bold tabular-nums text-[#B82D0D] dark:text-[#FF7A5C]">
                          {localPortfolioChangeCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      data-testid="admin-nav-duel"
                      onClick={() => selectAdminSection('duel', true)}
                      className={`w-full min-h-[38px] px-3.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'duel'
                          ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                          : 'text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
                      }`}
                    >
                      <AudioWaveform
                        className="w-3.5 h-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>Дуэль 15 секунд</span>
                    </button>

                    <button
                      type="button"
                      data-testid="admin-nav-testimonials"
                      onClick={() => selectAdminSection('testimonials', true)}
                      className={`w-full min-h-[38px] px-3.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'testimonials'
                          ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                          : 'text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2.5">
                        <MessageSquareQuote
                          className="w-3.5 h-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>Отзывы клиентов</span>
                      </span>
                      {localTestimonialsChangeCount > 0 && (
                        <span className="text-[11px] font-bold tabular-nums text-[#B82D0D] dark:text-[#FF7A5C]">
                          {localTestimonialsChangeCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      data-testid="admin-nav-copy"
                      onClick={() => selectAdminSection('copy', true)}
                      className={`w-full min-h-[38px] px-3.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'copy'
                          ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                          : 'text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
                      }`}
                    >
                      <FileText
                        className="w-3.5 h-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>Тарифы, FAQ и архив</span>
                    </button>

                    <button
                      type="button"
                      data-testid="admin-nav-laya-brand"
                      onClick={() => selectAdminSection('laya_brand', true)}
                      className={`w-full min-h-[38px] px-3.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'laya_brand'
                          ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                          : 'text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
                      }`}
                    >
                      <SlidersHorizontal
                        className="w-3.5 h-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>Бренд и профили витрины</span>
                    </button>

                    <button
                      type="button"
                      data-testid="admin-nav-footer-contacts"
                      onClick={() => selectAdminSection('settings', true)}
                      className={`w-full min-h-[38px] px-3.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'settings'
                          ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                          : 'text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
                      }`}
                    >
                      <PhoneCall
                        className="w-3.5 h-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>Контакты подвала (Тел · TG)</span>
                    </button>
                  </div>
                )}
              </div>
            </nav>
          </div>
        </div>

        {/* Нижний блок действий кабинета и активный оператор сессии */}
        <div
          className={`${isMobileNavOpen ? 'block' : 'hidden'} lg:block pt-5 mt-5 border-t border-[#111111]/10 dark:border-white/10 space-y-1.5`}
        >
          <div
            data-testid="admin-active-operator-badge"
            className="px-3.5 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#0D0D0F] text-xs space-y-0.5"
          >
            <div className="flex items-center gap-2 font-semibold text-[#111111] dark:text-[#F4F3EF] truncate">
              <UserCheck className="w-3.5 h-3.5 shrink-0 text-[#166534] dark:text-[#4ADE80]" aria-hidden="true" />
              <span className="truncate">{operatorName}</span>
            </div>
            <p className="text-[11px] text-[#111111]/70 dark:text-[#F4F3EF]/70">
              Сессия ASVS · 30 мин idle / 12 ч
            </p>
          </div>

          <a
            href="/"
            data-testid="admin-back-to-site"
            onClick={(e) => {
              e.preventDefault();
              onNavigateHome();
            }}
            className="w-full min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white flex items-center justify-between gap-2 transition-colors whitespace-nowrap"
          >
            <span>На витрину сайта</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          </a>

          <button
            type="button"
            onClick={onToggleTheme}
            className="w-full min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
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
            className="w-full min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:text-[#B91C1C] dark:hover:text-[#F87171] hover:bg-[#DC2626]/6 flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Выйти из кабинета</span>
          </button>
        </div>
      </aside>

      {/* Рабочая область кабинета */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Верхняя контекстная панель (компактная на мобильном ≤ 15% высоты экрана) */}
        <header className="sticky top-0 z-20 bg-[#F7F6F2]/94 dark:bg-[#0D0D0F]/94 backdrop-blur-md border-b border-[#111111]/10 dark:border-white/10 px-4 sm:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
              <span className="hidden sm:inline">Кабинет студии</span>
              <span className="hidden sm:inline" aria-hidden="true">/</span>
              <span className="font-semibold text-[#111111] dark:text-[#F4F3EF] truncate">
                {SECTION_META[activeTab].label}
              </span>
              <span className="hidden md:inline" aria-hidden="true">·</span>
              {isOperationalTab ? (
                <span
                  data-testid="admin-crm-realtime-status"
                  className="hidden md:inline-flex items-center gap-1.5 font-medium text-[#166534] dark:text-[#4ADE80] tabular-nums"
                >
                  <CheckCircle2
                    className="w-3.5 h-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>Реестр на сервере · автосохранение</span>
                </span>
              ) : hasLocalChanges ? (
                <span
                  data-testid="admin-local-cms-status"
                  className="hidden md:inline-flex items-center gap-1.5 font-semibold text-[#166534] dark:text-[#4ADE80] tabular-nums"
                >
                  <CheckCircle2
                    className="w-3.5 h-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Неопубликованные правки CMS
                    {localPortfolioChangeCount > 0
                      ? ` (${localPortfolioChangeCount})`
                      : ''}
                  </span>
                </span>
              ) : (
                <span
                  data-testid="admin-published-status"
                  className="hidden md:inline-flex items-center gap-1.5 font-medium text-[#166534] dark:text-[#4ADE80] tabular-nums"
                >
                  <CheckCircle2
                    className="w-3.5 h-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {isCustomizedOnServer
                      ? `Опубликовано${formattedTime ? ` в ${formattedTime}` : ''}`
                      : 'Витрина синхронизирована'}
                  </span>
                </span>
              )}
            </div>
            <p className="hidden sm:block text-xs text-[#111111]/70 dark:text-[#F4F3EF]/70 truncate">
              {SECTION_META[activeTab].subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
            {isOperationalTab ? (
              <button
                type="button"
                data-testid="admin-open-live-site-btn"
                onClick={onNavigateHome}
                className="min-h-[38px] sm:min-h-[40px] px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#C83210] hover:bg-[#AE2A0C] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>На витрину сайта</span>
                <ArrowUpRight
                  className="w-3.5 h-3.5 shrink-0"
                  aria-hidden="true"
                />
              </button>
            ) : (
              <>
                {hasLocalChanges && (
                  <button
                    type="button"
                    onClick={handleDiscardLocal}
                    className="min-h-[38px] sm:min-h-[40px] px-3.5 py-1.5 sm:py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111]/80 dark:text-[#F4F3EF]/80 hover:text-[#111111] dark:hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
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
                  className="min-h-[38px] sm:min-h-[40px] px-3.5 py-1.5 sm:py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#C83210] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
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
                  className="min-h-[38px] sm:min-h-[40px] px-4 py-1.5 sm:py-2 rounded-xl bg-[#C83210] hover:bg-[#AE2A0C] disabled:opacity-45 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:cursor-default whitespace-nowrap shrink-0"
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

        {/* Основной холст раздела */}
        <main className="flex-1 px-4 sm:px-8 py-5 sm:py-8 max-w-7xl w-full mx-auto space-y-6">
          {saveBanner && (
            <div
              role="status"
              data-testid="admin-save-banner"
              className={`px-4 py-3 rounded-xl text-xs font-medium border ${
                saveBanner.kind === 'ok'
                  ? 'bg-[#16A34A]/10 border-[#16A34A]/30 text-[#166534] dark:text-[#4ADE80]'
                  : 'bg-[#DC2626]/10 border-[#DC2626]/30 text-[#B91C1C] dark:text-[#F87171]'
              }`}
            >
              {saveBanner.text}
            </div>
          )}

          {guardrailWarnings.length > 0 && (
            <div
              role="status"
              className="px-4 py-3 rounded-xl text-xs font-medium bg-[#D97706]/10 border border-[#D97706]/30 text-[#92400E] dark:text-[#FBBF24] flex items-start gap-2.5"
            >
              <AlertTriangle
                className="w-4 h-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>
                Редакционный контроль FMWorks: в тексте встретились
                нежелательные штампы или гео-привязки (
                {guardrailWarnings.join(', ')}). Рекомендуем заменить их на
                нейтральные формулировки федерального продакшна.
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
                setIsCmsDrawerOpen(true);
                setSaveBanner(null);
              }}
              onNavigateToAnchor={handleNavigateToAnchor}
            />
          )}

          <Suspense fallback={<AdminTabSkeleton />}>
            {(activeTab === 'orders_crm' ||
              activeTab === 'production' ||
              activeTab === 'settings') && (
              <AdminOrdersCrmPanel
                viewGroup={
                  activeTab === 'production'
                    ? 'production'
                    : activeTab === 'settings'
                      ? 'settings'
                      : 'ledger'
                }
                focusedOrderId={focusedOrderId}
                onNavigateToProductionOrder={(orderId) => {
                  setFocusedOrderId(orderId);
                  setActiveTab('production');
                  setSaveBanner(null);
                }}
              />
            )}

            {activeTab === 'analytics' && (
              <LazyAdminStudioAnalyticsPanel
                isDark={isDark}
                onOpenOrdersFunnel={() => {
                  setActiveTab('orders_crm');
                  setSaveBanner(null);
                }}
              />
            )}

            {activeTab === 'laya_brand' && (
              <LayaSimulationConsole
                mode="embedded"
                activeBrandVariant={brandVariant}
                onSelectBrandVariant={onSelectBrandVariant}
                onOpenBrandKit={onOpenBrandKit}
                onOpenRadioAdmin={onOpenRadioAdmin}
                onOpenHomePreview={onNavigateHome}
                onOpenHeroStageAdmin={() => {
                  setActiveTab('hero_stage');
                  setIsCmsDrawerOpen(true);
                  setSaveBanner(null);
                }}
                onOpenDuelAdmin={() => {
                  setActiveTab('duel');
                  setIsCmsDrawerOpen(true);
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
                  setIsCmsDrawerOpen(true);
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
                    heroStage: assignPortfolioCaseToHeroStage(
                      prev.heroStage,
                      item
                    ),
                  }))
                }
                onOpenHeroStageTab={() => {
                  setActiveTab('hero_stage');
                  setIsCmsDrawerOpen(true);
                  setSaveBanner(null);
                }}
                onUploadAudio={uploadAudioFile}
                onUploadImage={uploadImageFile}
                onNavigateToGallery={() => handleNavigateToAnchor('#work')}
              />
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
          </Suspense>
        </main>
      </div>
    </div>
  );
}
