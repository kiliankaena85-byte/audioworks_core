import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  AudioWaveform,
  CheckCircle2,
  FileText,
  FolderKanban,
  LogOut,
  Moon,
  RotateCcw,
  Save,
  Sun,
  Type,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSiteTextBlocks } from '../../cms/SiteTextBlocksContext';
import { useStudioCms } from '../../cms/StudioCmsContext';
import { BrandDomainVariant } from '../../data/brandKitData';
import {
  auditEditorialCopyGuardrails,
  BANNED_EDITORIAL_TERMS,
  StudioCmsSnapshot,
} from '../../data/studioCmsTypes';
import { BrandLogo } from '../BrandLogo';
import { AdminDuelPanel } from './AdminDuelPanel';
import { AdminLoginScreen } from './AdminLoginScreen';
import { AdminPortfolioPanel } from './AdminPortfolioPanel';
import { AdminSiteCopyPanel } from './AdminSiteCopyPanel';
import { AdminTextBlocksPanel } from './AdminTextBlocksPanel';

export type AdminSectionTab = 'text_blocks' | 'portfolio' | 'duel' | 'copy';

interface AdminWorkspaceProps {
  brandVariant: BrandDomainVariant;
  isDark: boolean;
  onToggleTheme: () => void;
  onNavigateHome: () => void;
}

function stripTimestamp(
  snap: StudioCmsSnapshot
): Omit<StudioCmsSnapshot, 'updatedAt'> {
  const { updatedAt: _ignored, ...rest } = snap;
  return rest;
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
  isDark,
  onToggleTheme,
  onNavigateHome,
}: AdminWorkspaceProps) {
  const {
    snapshot,
    isCustomizedOnServer,
    isAuthenticated,
    isAuthChecking,
    isSaving,
    login,
    logout,
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

  const [activeTab, setActiveTab] = useState<AdminSectionTab>('text_blocks');
  const [draft, setDraft] = useState<StudioCmsSnapshot>(() => snapshot);
  const [saveBanner, setSaveBanner] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);

  const isDirty = useMemo(() => {
    return (
      JSON.stringify(stripTimestamp(draft)) !==
      JSON.stringify(stripTimestamp(snapshot))
    );
  }, [draft, snapshot]);

  // Синхронизируем черновик с серверным снимком при первичной загрузке (если редактор ещё не вносил правок)
  useEffect(() => {
    if (!isDirty) {
      setDraft(snapshot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.updatedAt]);

  const guardrailWarnings = useMemo(() => {
    const baseWarnings = auditEditorialCopyGuardrails(draft);
    const liveSerialized = JSON.stringify(liveTextBlocks).toLowerCase();
    const combined = new Set<string>(baseWarnings);
    for (const term of BANNED_EDITORIAL_TERMS) {
      if (liveSerialized.includes(term)) {
        combined.add(term);
      }
    }
    return Array.from(combined);
  }, [draft, liveTextBlocks]);

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
    const res = await saveSnapshot(draft);
    if (!res.ok) {
      setSaveBanner({ kind: 'error', text: res.error });
      return;
    }

    setDraft(res.snapshot);
    setSaveBanner({
      kind: 'ok',
      text:
        res.warnings.length > 0
          ? `Изменения опубликованы на сайте (обратите внимание на редакционные рекомендации: ${res.warnings.join(', ')}).`
          : 'Изменения сохранены и сразу опубликованы на витрине сайта.',
    });
  };

  const handleDiscardChanges = () => {
    setDraft(snapshot);
    setSaveBanner(null);
  };

  const handleResetAll = async () => {
    setSaveBanner(null);
    resetLiveTextBlocks();
    const res = await resetToDefaults();
    if (!res.ok) {
      setSaveBanner({ kind: 'error', text: res.error });
      return;
    }
    setDraft(res.snapshot);
  };

  const SECTION_META: Record<
    AdminSectionTab,
    { label: string; subtitle: string }
  > = {
    text_blocks: {
      label: 'Текстовые блоки (Live)',
      subtitle:
        'Мгновенное редактирование заголовков и описаний секций Hero, Approach и Pricing в памяти сессии',
    },
    portfolio: {
      label: 'Портфолио и звук',
      subtitle:
        'Флагманский шоурил, карточки кейсов, загрузка WAV/MP3 и настройка окна превью 3–5 секунд',
    },
    duel: {
      label: 'Дуэль 15 секунд',
      subtitle:
        'Аудиодорожки сторон А и Б, условия брифа и синхронные реплики по таймкодам',
    },
    copy: {
      label: 'Исследования, FAQ и архив',
      subtitle:
        'Цифры исследований ЦНС, расценки тарифов в рублях, частые вопросы и резервные копии .json',
    },
  };

  const formattedTime = formatUpdatedTimestamp(snapshot.updatedAt);
  const isLiveTextTab = activeTab === 'text_blocks';

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
              aria-label="Перейти на главную витрину AudioWorks"
              className="inline-flex items-center whitespace-nowrap shrink-0"
            >
              <BrandLogo variant={brandVariant} size="sm" />
            </a>
          </div>

          <nav aria-label="Разделы кабинета студии" className="space-y-1.5">
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
              data-testid="admin-nav-portfolio"
              onClick={() => {
                setActiveTab('portfolio');
                setSaveBanner(null);
              }}
              className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'portfolio'
                  ? 'bg-[#111111] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F]'
                  : 'text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:bg-[#F7F6F2] dark:hover:bg-white/[0.04] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              <FolderKanban className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Портфолио и звук</span>
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
              {isLiveTextTab ? (
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
              ) : isDirty ? (
                <span
                  data-testid="admin-dirty-status"
                  className="inline-flex items-center gap-1.5 font-semibold text-[#D97706] dark:text-[#FBBF24]"
                >
                  <AlertCircle
                    className="w-3.5 h-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>Есть несохранённые правки</span>
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
                      : 'Заводской эталон студии'}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58 truncate">
              {SECTION_META[activeTab].subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isLiveTextTab ? (
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
                {isDirty && (
                  <button
                    type="button"
                    onClick={handleDiscardChanges}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:text-[#111111] dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Отменить правки
                  </button>
                )}

                <button
                  type="button"
                  disabled={isSaving || !isDirty}
                  data-testid="admin-save-publish-btn"
                  onClick={() => void handleSavePublish()}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] disabled:opacity-45 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:cursor-default whitespace-nowrap shrink-0"
                >
                  <Save className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {isSaving ? 'Публикация…' : 'Сохранить и опубликовать'}
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
                Редакционный контроль AudioWorks: в тексте встретились нежелательные штампы или гео-привязки ({guardrailWarnings.join(', ')}). Рекомендуем заменить их на нейтральные формулировки федерального продакшна.
              </span>
            </div>
          )}

          {activeTab === 'text_blocks' && (
            <AdminTextBlocksPanel onNavigateHome={onNavigateHome} />
          )}

          {activeTab === 'portfolio' && (
            <AdminPortfolioPanel
              flagshipReel={draft.flagshipReel}
              portfolioCases={draft.portfolioCases}
              onChangeFlagshipReel={(nextReel) =>
                setDraft((prev) => ({ ...prev, flagshipReel: nextReel }))
              }
              onChangePortfolioCases={(nextCases) =>
                setDraft((prev) => ({ ...prev, portfolioCases: nextCases }))
              }
              onUploadAudio={uploadAudioFile}
              onUploadImage={uploadImageFile}
            />
          )}

          {activeTab === 'duel' && (
            <AdminDuelPanel
              duel={draft.duel}
              onChangeDuel={(nextDuel) =>
                setDraft((prev) => ({ ...prev, duel: nextDuel }))
              }
              onUploadAudio={uploadAudioFile}
            />
          )}

          {activeTab === 'copy' && (
            <AdminSiteCopyPanel
              draft={draft}
              onChangeNeuroApproach={(nextNeuro) =>
                setDraft((prev) => ({ ...prev, neuroApproach: nextNeuro }))
              }
              onChangeSiteCopy={(nextCopy) =>
                setDraft((prev) => ({ ...prev, siteCopy: nextCopy }))
              }
              onImportSnapshot={(imported) => setDraft(imported)}
              onResetToDefaults={handleResetAll}
              onUploadImage={uploadImageFile}
            />
          )}
        </main>
      </div>
    </div>
  );
}
