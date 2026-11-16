import { KeyboardEvent, useCallback, useRef } from 'react';
import { ArrowLeft, Bell, Lock, Plus, RefreshCw, Undo2 } from 'lucide-react';
import type { CabinetWorkspaceSectionFilter } from '../../data/clientCabinetArchitecture';
import type { CabinetSubrouteMode } from '../../data/platformRouter';
import { CabinetAccessPanel } from '../cabinet/CabinetAccessPanel';
import { CabinetOrderCard } from '../cabinet/CabinetOrderCard';
import { CabinetOrderHistorySection } from '../cabinet/CabinetOrderHistorySection';
import {
  CabinetLivePushToast,
  CabinetPushNotificationsPanel,
} from '../cabinet/CabinetPushNotificationsPanel';
import { CabinetSessionHeader } from '../cabinet/CabinetSessionHeader';
import { useCabinetPushNotifications } from '../cabinet/useCabinetPushNotifications';
import {
  type CabinetNavigateFn,
  useClientCabinetController,
} from '../cabinet/useClientCabinetController';
import { BrandedDocumentSuiteModal } from '../documents/BrandedDocumentSuiteModal';

export interface ClientCabinetPageProps {
  subroute?: CabinetSubrouteMode;
  magicToken?: string;
  onNavigate: CabinetNavigateFn;
}

export function ClientCabinetPage({
  subroute,
  magicToken,
  onNavigate,
}: ClientCabinetPageProps) {
  const ctrl = useClientCabinetController({
    subroute,
    magicToken,
    onNavigate,
  });

  const workspaceTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleJumpToOrder = useCallback(
    (orderNumber: string, versionCode?: string) => {
      const upper = orderNumber.trim().toUpperCase();
      const isActive = ctrl.activeOrders.some(
        (o) => o.orderNumber.toUpperCase() === upper
      );

      if (versionCode) {
        ctrl.highlightOrderVersion(orderNumber, versionCode);
      }

      if (isActive && ctrl.workspaceFilter === 'history') {
        ctrl.selectWorkspaceFilter('active');
      } else if (!isActive && ctrl.workspaceFilter === 'active') {
        ctrl.selectWorkspaceFilter('history');
      }
      ctrl.resetHistoryFilters();

      if (typeof document !== 'undefined') {
        window.requestAnimationFrame(() => {
          const targetEl = isActive
            ? document.querySelector(
                `[data-testid="cabinet-order-card-${orderNumber}"]`
              )
            : document.querySelector(
                `[data-testid="cabinet-history-row-${orderNumber}"]`
              );
          targetEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    },
    [ctrl]
  );

  const pushCtrl = useCabinetPushNotifications({
    orders: ctrl.orders,
    isAuthenticated: Boolean(ctrl.clientAccount),
    onLiveOrderUpdate: () => {
      void ctrl.reloadCabinet();
    },
    onJumpToOrder: handleJumpToOrder,
  });

  const workspaceTabs: readonly {
    id: CabinetWorkspaceSectionFilter;
    label: string;
  }[] = [
    {
      id: 'all',
      label: `Все заказы (${ctrl.orders.length})`,
    },
    {
      id: 'active',
      label: `В работе и приёмке (${ctrl.activeOrders.length})`,
    },
    {
      id: 'history',
      label: `Завершённые (${ctrl.historyOrders.length})`,
    },
  ];

  const handleWorkspaceTabKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    currentIdx: number
  ) => {
    let nextIdx = -1;
    if (e.key === 'ArrowRight') {
      nextIdx = (currentIdx + 1) % workspaceTabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (currentIdx - 1 + workspaceTabs.length) % workspaceTabs.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = workspaceTabs.length - 1;
    }
    if (nextIdx >= 0) {
      e.preventDefault();
      const target = workspaceTabs[nextIdx];
      ctrl.selectWorkspaceFilter(target.id);
      workspaceTabRefs.current[target.id]?.focus();
    }
  };

  return (
    <section
      data-testid="client-cabinet-page"
      data-lifecycle-state={ctrl.lifecycleState}
      aria-labelledby="cabinet-page-heading"
      className="py-7 sm:py-10 lg:py-12"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-6 sm:space-y-7">
        {/* Компактная строка навигации и заголовок кабинета */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#111111]/10 dark:border-white/10">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72">
              <button
                type="button"
                onClick={() => onNavigate({ kind: 'home' })}
                className="min-h-[36px] inline-flex items-center gap-1.5 text-xs font-semibold text-[#111111]/76 dark:text-[#F4F3EF]/76 hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
              >
                <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>На главную</span>
              </button>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#C83210] dark:text-[#FF6B47]">
                {subroute === 'reset'
                  ? 'Восстановление доступа'
                  : subroute === 'history'
                    ? 'Архив завершённых проектов'
                    : 'Личный кабинет клиента'}
              </span>
            </div>

            <h1
              id="cabinet-page-heading"
              className="text-2xl sm:text-4xl font-bold tracking-tight leading-[1.08] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
            >
              {subroute === 'reset' && ctrl.orders.length === 0
                ? 'Восстановление доступа по почте'
                : subroute === 'history'
                  ? 'История завершённых заказов и мастер-файлы'
                  : 'Мои заказы, согласование и документы'}
            </h1>
          </div>

          {/* Панель инструментов кабинета (без дублирования яркого оранжевого CTA шапки сайта) */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {ctrl.orders.length > 0 && (
              <button
                type="button"
                data-testid="cabinet-toggle-lookup-btn"
                onClick={() => {
                  const nextOpen = !ctrl.showLookupForm;
                  ctrl.setShowLookupForm(nextOpen);
                  if (!nextOpen && subroute === 'reset') {
                    onNavigate({ kind: 'cabinet' }, { replace: true });
                  }
                }}
                className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 bg-white dark:bg-[#141418] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
              >
                <Plus className="w-3.5 h-3.5 text-[#C83210] dark:text-[#FF6B47]" aria-hidden="true" />
                <span>
                  {ctrl.showLookupForm ? 'Скрыть панель входа' : 'Найти заказ / вход'}
                </span>
              </button>
            )}

            {(ctrl.orders.length > 0 || Boolean(ctrl.clientAccount)) && (
              <button
                type="button"
                data-testid="cabinet-notifications-trigger-btn"
                aria-expanded={pushCtrl.isPanelOpen}
                onClick={() => pushCtrl.setIsPanelOpen((prev) => !prev)}
                className={`min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                  pushCtrl.isPanelOpen
                    ? 'border-[#C83210] bg-[#C83210]/10 text-[#111111] dark:text-[#F4F3EF]'
                    : 'border-[#111111]/16 dark:border-white/16 bg-white dark:bg-[#141418] text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820]'
                }`}
              >
                <Bell
                  className={`w-3.5 h-3.5 shrink-0 ${
                    pushCtrl.unreadCount > 0
                      ? 'text-[#C83210] dark:text-[#FF6B47]'
                      : 'text-[#111111]/72 dark:text-[#F4F3EF]/72'
                  }`}
                  aria-hidden="true"
                />
                <span>
                  {pushCtrl.unreadCount > 0
                    ? `Уведомления (${pushCtrl.unreadCount})`
                    : 'Уведомления'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                void ctrl.reloadCabinet();
                void pushCtrl.refreshNotifications();
              }}
              disabled={ctrl.isLoading}
              aria-label="Обновить статусы заказов"
              className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 bg-white dark:bg-[#141418] text-xs font-semibold text-[#111111]/82 dark:text-[#F4F3EF]/82 hover:border-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${ctrl.isLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Обновить</span>
            </button>
          </div>
        </div>

        {ctrl.statusError && (
          <div
            role="alert"
            data-testid="cabinet-status-error"
            className="rounded-2xl px-4 py-3 bg-[#B91C1C]/10 border border-[#B91C1C]/30 text-xs sm:text-sm text-[#B91C1C] dark:text-[#F87171]"
          >
            {ctrl.statusError}
          </div>
        )}

        {ctrl.authBanner && (
          <div
            role="status"
            data-testid="cabinet-auth-banner"
            className="rounded-2xl px-4 py-3 bg-[#166534]/10 border border-[#166534]/30 text-xs sm:text-sm text-[#166534] dark:text-[#4ADE80] flex items-center justify-between gap-3"
          >
            <span>{ctrl.authBanner}</span>
            <button
              type="button"
              onClick={() => ctrl.setAuthBanner(null)}
              className="min-h-[36px] text-xs font-semibold underline underline-offset-2 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
            >
              Скрыть
            </button>
          </div>
        )}

        {ctrl.forgottenDeviceOrderUndo && (
          <div
            role="status"
            data-testid="cabinet-undo-forget-banner"
            className="rounded-2xl px-4 py-3 bg-white dark:bg-[#141418] border border-[#111111]/16 dark:border-white/16 text-xs sm:text-sm text-[#111111] dark:text-[#F4F3EF] flex flex-wrap items-center justify-between gap-3"
          >
            <span>
              Заказ <strong>#{ctrl.forgottenDeviceOrderUndo.order.orderNumber}</strong> скрыт с этого устройства.
            </span>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                data-testid="cabinet-undo-forget-btn"
                onClick={ctrl.handleUndoForgetOrderFromDevice}
                className="min-h-[44px] sm:min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#111111] hover:bg-[#C83210] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
              >
                <Undo2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Вернуть заказ</span>
              </button>
              <button
                type="button"
                onClick={ctrl.dismissForgottenOrderUndo}
                className="min-h-[36px] text-xs font-semibold text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:text-[#111111] dark:hover:text-[#F4F3EF] cursor-pointer whitespace-nowrap shrink-0"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}

        {/* Шапка активной сессии или привязка локальных заказов */}
        <CabinetSessionHeader
          clientAccount={ctrl.clientAccount}
          profileAvatar={ctrl.profileAvatar}
          isAvatarEditorOpen={ctrl.isAvatarEditorOpen}
          isSavingAvatar={ctrl.isSavingAvatar}
          avatarError={ctrl.avatarError}
          onToggleAvatarEditor={() =>
            ctrl.setIsAvatarEditorOpen((prev) => !prev)
          }
          onSelectAvatarPreset={(presetId) =>
            void ctrl.handleSelectAvatarPreset(presetId)
          }
          onUploadAvatarPhoto={(file) =>
            void ctrl.handleUploadAvatarPhoto(file)
          }
          onRemoveAvatarPhoto={() => void ctrl.handleRemoveAvatarPhoto()}
          ordersCount={ctrl.orders.length}
          crossDeviceLink={ctrl.crossDeviceLink}
          isIssuingCrossDeviceLink={ctrl.isIssuingCrossDeviceLink}
          onIssueCrossDeviceLink={() =>
            void ctrl.handleIssueCrossDeviceMagicLink()
          }
          onDismissCrossDeviceLink={() => ctrl.setCrossDeviceLink(null)}
          onOpenAccessReset={ctrl.openAccessResetFlow}
          onLogout={() => void ctrl.handleLogoutClientSession()}
          bindEmailInput={ctrl.bindEmailInput}
          onChangeBindEmailInput={(value) => {
            ctrl.setBindEmailInput(value);
            if (ctrl.bindEmailError) ctrl.setBindEmailError(null);
          }}
          bindConsentAccepted={ctrl.bindConsentAccepted}
          onChangeBindConsentAccepted={(checked) => {
            ctrl.setBindConsentAccepted(checked);
            if (checked && ctrl.bindConsentError) ctrl.setBindConsentError(null);
          }}
          isBindingEmail={ctrl.isBindingEmail}
          bindEmailError={ctrl.bindEmailError}
          bindConsentError={ctrl.bindConsentError}
          pendingBindVerification={ctrl.pendingBindVerification}
          isVerifyingMagic={ctrl.isVerifyingMagic}
          onConfirmPendingBind={ctrl.handleConfirmPendingBindMagicLink}
          onDismissPendingBind={() => ctrl.setPendingBindVerification(null)}
          onSubmitBindEmail={(e) => void ctrl.handleBindAnonymousOrdersToEmail(e)}
        />

        {/* Мгновенное всплывающее оповещение */}
        <CabinetLivePushToast
          notification={pushCtrl.liveToast}
          onOpenOrder={pushCtrl.handleOpenOrderFromNotification}
          onDismiss={pushCtrl.dismissLiveToast}
        />

        {/* Центр push-уведомлений */}
        {(ctrl.orders.length > 0 || Boolean(ctrl.clientAccount)) && (
          <CabinetPushNotificationsPanel
            isOpen={pushCtrl.isPanelOpen}
            onClose={() => pushCtrl.setIsPanelOpen(false)}
            activeTab={pushCtrl.activeTab}
            onSelectTab={pushCtrl.setActiveTab}
            allCount={pushCtrl.notifications.length}
            unreadCount={pushCtrl.unreadCount}
            filteredNotifications={pushCtrl.filteredNotifications}
            preferences={pushCtrl.preferences}
            sseConnected={pushCtrl.sseConnected}
            browserPermission={pushCtrl.browserPermission}
            isSavingPrefs={pushCtrl.isSavingPrefs}
            isSendingTestPush={pushCtrl.isSendingTestPush}
            feedbackError={pushCtrl.feedbackError}
            onToggleBrowserPush={(next) =>
              void pushCtrl.handleToggleBrowserPush(next)
            }
            onUpdateChannelPreference={(patch) =>
              void pushCtrl.handleUpdateChannelPreference(patch)
            }
            onMarkAllRead={() => void pushCtrl.handleMarkAllRead()}
            onMarkSingleRead={(id) => void pushCtrl.handleMarkRead([id])}
            onTriggerTestPush={() => void pushCtrl.handleTriggerTestPush()}
            onOpenOrderFromNotification={
              pushCtrl.handleOpenOrderFromNotification
            }
          />
        )}

        {/* Панель входа по почте, сброса доступа и поиска заказа */}
        {ctrl.showLookupForm && (
          <CabinetAccessPanel
            accessTab={ctrl.accessTab}
            onSelectTab={ctrl.selectAccessTab}
            magicEmailInput={ctrl.magicEmailInput}
            onChangeMagicEmailInput={(value) => {
              ctrl.setMagicEmailInput(value);
              if (ctrl.magicRequestError) ctrl.setMagicRequestError(null);
            }}
            magicConsentAccepted={ctrl.magicConsentAccepted}
            onChangeMagicConsentAccepted={(checked) => {
              ctrl.setMagicConsentAccepted(checked);
              if (checked && ctrl.magicConsentError) ctrl.setMagicConsentError(null);
            }}
            magicConsentError={ctrl.magicConsentError}
            revokeOtherSessionsOnReset={ctrl.revokeOtherSessionsOnReset}
            onChangeRevokeOtherSessionsOnReset={
              ctrl.setRevokeOtherSessionsOnReset
            }
            isRequestingMagic={ctrl.isRequestingMagic}
            isVerifyingMagic={ctrl.isVerifyingMagic}
            magicRequestError={ctrl.magicRequestError}
            magicDispatchResult={ctrl.magicDispatchResult}
            onSubmitMagicLink={ctrl.handleMagicLinkSubmit}
            onTriggerDemoMagicEmail={(demoEmail) => {
              ctrl.setMagicEmailInput(demoEmail);
              if (ctrl.magicConsentAccepted) {
                void ctrl.executeRequestMagicLink(demoEmail);
              } else {
                ctrl.setMagicRequestError(null);
                ctrl.setMagicConsentError(
                  'Для запуска демо-входа подтвердите согласие на обработку персональных данных (152-ФЗ) ниже.'
                );
              }
            }}
            onOpenPreviewMagicLink={ctrl.handleOpenPreviewMagicLink}
            orderNumberInput={ctrl.orderNumberInput}
            onChangeOrderNumberInput={ctrl.setOrderNumberInput}
            verifierInput={ctrl.verifierInput}
            onChangeVerifierInput={ctrl.setVerifierInput}
            isLookingUp={ctrl.isLookingUp}
            lookupError={ctrl.lookupError}
            onSubmitLookup={ctrl.handleLookupSubmit}
            onTriggerDemoOrderLookup={() =>
              void ctrl.executeOrderLookup('FM-HOLD-2854', '7702070139')
            }
          />
        )}

        {/* Список заказов клиента или состояния загрузки / пустого списка */}
        {(ctrl.isLoading || ctrl.isVerifyingMagic) && ctrl.orders.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-8 text-center text-sm text-[#111111]/74 dark:text-[#F4F3EF]/74">
            {ctrl.isVerifyingMagic
              ? 'Проверяем одноразовую ссылку и восстанавливаем доступ к заказам…'
              : 'Проверяем статусы и готовые файлы ваших заказов…'}
          </div>
        ) : ctrl.orders.length === 0 ? (
          ctrl.showLookupForm ? (
            <div
              data-testid="cabinet-empty-state"
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-[#EFECE5]/55 dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 px-5 py-4"
            >
              <p className="text-xs sm:text-sm text-[#111111]/78 dark:text-[#F4F3EF]/78">
                Ещё не оформляли заказ? Заявка создаётся за минуту — личный кабинет подключится к вашей почте автоматически без пароля.
              </p>
              <button
                type="button"
                onClick={() => onNavigate({ kind: 'order' })}
                className="min-h-[44px] sm:min-h-[40px] px-5 py-2 rounded-xl bg-[#C83210] hover:bg-[#B02A0C] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
              >
                Оформить новый заказ →
              </button>
            </div>
          ) : (
            <div
              data-testid="cabinet-empty-state"
              className="rounded-2xl bg-[#EFECE5]/65 dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-8 sm:p-10 text-center space-y-4"
            >
              <p className="text-base font-semibold text-[#111111] dark:text-[#F4F3EF]">
                В личном кабинете пока нет сохранённых заказов
              </p>
              <p className="text-sm text-[#111111]/74 dark:text-[#F4F3EF]/74 max-w-lg mx-auto">
                Оформите новый заказ за минуту — он сразу появится здесь — или восстановите доступ по почте выше.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate({ kind: 'order' })}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#C83210] hover:bg-[#B02A0C] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                >
                  Оформить новый заказ
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-7">
            {/* WAI-ARIA tablist переключатель разделов с точной суммой счётчиков */}
            <div
              data-testid="cabinet-workspace-filter"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div
                role="tablist"
                aria-label="Разделы личного кабинета"
                className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#EFECE5]/80 dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10"
              >
                {workspaceTabs.map((item, idx) => {
                  const active = ctrl.workspaceFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      ref={(el) => {
                        workspaceTabRefs.current[item.id] = el;
                      }}
                      id={`cabinet-workspace-tab-${item.id}`}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-controls="cabinet-workspace-tabpanel"
                      tabIndex={active ? 0 : -1}
                      data-testid={`cabinet-filter-${item.id}`}
                      onKeyDown={(e) => handleWorkspaceTabKeyDown(e, idx)}
                      onClick={() => ctrl.selectWorkspaceFilter(item.id)}
                      className={`min-h-[44px] sm:min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                        active
                          ? 'bg-white dark:bg-[#0D0D0F] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/12 dark:border-white/14'
                          : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 tabular-nums">
                {ctrl.clientTurnActiveCount > 0 ? (
                  <>
                    <span className="font-semibold text-[#C83210] dark:text-[#FF6B47]">
                      Ожидают вашего решения: {ctrl.clientTurnActiveCount}
                    </span>
                    {' · '}
                  </>
                ) : null}
                В работе: {ctrl.overallStatusSummary.inWorkCount} · На согласовании:{' '}
                {ctrl.overallStatusSummary.inReviewCount} · Готово:{' '}
                {ctrl.overallStatusSummary.readyCount}
              </p>
            </div>

            <div
              id="cabinet-workspace-tabpanel"
              role="tabpanel"
              aria-labelledby={`cabinet-workspace-tab-${ctrl.workspaceFilter}`}
            >
              <div key={ctrl.workspaceFilter} className="fmworks-panel-enter space-y-8">
              {/* ПРИОРИТЕТ 1 (ABOVE THE FOLD): АКТИВНЫЕ ЗАКАЗЫ В РАБОТЕ И НА ПРИЁМКЕ */}
              {ctrl.workspaceFilter !== 'history' &&
                (ctrl.activeOrders.length > 0 ? (
                  <div className="space-y-5">
                    {ctrl.workspaceFilter === 'all' && (
                      <div className="space-y-1">
                        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                          Активные заказы: согласование, файлы и реквизиты ({ctrl.activeOrders.length})
                        </h2>
                        <p className="text-xs sm:text-sm text-[#111111]/74 dark:text-[#F4F3EF]/74">
                          Проекты, требующие вашего решения по сценарию или готовому ролику, вынесены наверх списка.
                        </p>
                      </div>
                    )}

                    <div className="space-y-6">
                      {ctrl.activeOrders.map((order) => (
                        <CabinetOrderCard
                          key={order.orderNumber}
                          order={order}
                          isAuthenticatedSession={Boolean(ctrl.clientAccount)}
                          isEditingInn={
                            ctrl.editingInnOrderNum === order.orderNumber
                          }
                          innCompanyNameDraft={ctrl.innCompanyNameDraft}
                          onChangeInnCompanyNameDraft={
                            ctrl.setInnCompanyNameDraft
                          }
                          innDigitsDraft={ctrl.innDigitsDraft}
                          onChangeInnDigitsDraft={ctrl.setInnDigitsDraft}
                          innDraftInspection={ctrl.innDraftInspection}
                          innSaveError={ctrl.innSaveError}
                          isLookingUpInn={
                            ctrl.editingInnOrderNum === order.orderNumber &&
                            ctrl.isLookingUpInn
                          }
                          onLookupCompanyByInn={() =>
                            void ctrl.handleLookupCompanyByInn()
                          }
                          isBusyPrefs={
                            ctrl.isSavingPrefsFor === order.orderNumber
                          }
                          onToggleInnEditor={() =>
                            ctrl.editingInnOrderNum === order.orderNumber
                              ? ctrl.setEditingInnOrderNum(null)
                              : ctrl.openInnEditorForOrder(order)
                          }
                          onSaveCompanyInn={() =>
                            void ctrl.handleSaveCompanyInnForOrder(order)
                          }
                          deliveryEmailDraft={
                            ctrl.deliveryDraftByOrder[order.orderNumber]
                          }
                          onChangeDeliveryEmailDraft={(val) =>
                            ctrl.setDeliveryDraftByOrder((prev) => ({
                              ...prev,
                              [order.orderNumber]: val,
                            }))
                          }
                          onUpdateDeliveryPreferences={(nextChannel, nextDetail) =>
                            void ctrl.handleDeliveryPreferencesUpdate(
                              order,
                              nextChannel,
                              nextDetail
                            )
                          }
                          uploadNote={
                            ctrl.uploadNoteByOrder[order.orderNumber] ?? ''
                          }
                          onChangeUploadNote={(val) =>
                            ctrl.setUploadNoteByOrder((prev) => ({
                              ...prev,
                              [order.orderNumber]: val,
                            }))
                          }
                          isUploading={
                            ctrl.uploadingOrderNum === order.orderNumber
                          }
                          uploadFeedback={
                            ctrl.uploadFeedbackByOrder[order.orderNumber]
                          }
                          onSelectClientFile={(file) =>
                            void ctrl.handleClientFileSelected(order, file)
                          }
                          onOpenDocumentModal={(initialDoc) =>
                            ctrl.openOrderDocumentModal(order, initialDoc)
                          }
                          onRepeatOrder={() => ctrl.handleRepeatOrder(order)}
                          onForgetFromDevice={() =>
                            ctrl.handleForgetOrderFromDevice(order.orderNumber)
                          }
                          activePlayerTimeSec={
                            ctrl.activePlayerTimeByOrder[order.orderNumber] ?? 0
                          }
                          audioSeekRequest={
                            ctrl.audioSeekRequestByOrder[order.orderNumber]
                          }
                          highlightedVersionCode={
                            ctrl.highlightedVersionByOrder[order.orderNumber]
                          }
                          onAudioTimeUpdateSec={(timeSec) =>
                            ctrl.handleAudioPlayerTimeUpdate(
                              order.orderNumber,
                              timeSec
                            )
                          }
                          onRequestAudioSeekSec={(timeSec) =>
                            ctrl.handleRequestAudioSeek(
                              order.orderNumber,
                              timeSec
                            )
                          }
                          isSubmittingApproval={
                            ctrl.submittingApprovalOrderNum === order.orderNumber
                          }
                          onApproveScript={(conceptId) =>
                            void ctrl.handleClientApproveScript(order, conceptId)
                          }
                          onRequestScriptChanges={(comment) =>
                            void ctrl.handleClientRequestScriptChanges(
                              order,
                              comment
                            )
                          }
                          onAcceptSpot={(deliverableId) =>
                            void ctrl.handleClientAcceptSpot(order, deliverableId)
                          }
                          onRequestSpotRevision={(params) =>
                            void ctrl.handleClientRequestSpotRevision(
                              order,
                              params
                            )
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : ctrl.workspaceFilter === 'active' ? (
                  <div
                    data-testid="cabinet-active-empty"
                    className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 p-6 sm:p-8 text-center space-y-3"
                  >
                    <p className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
                      Сейчас нет активных проектов в работе
                    </p>
                    <p className="text-xs sm:text-sm text-[#111111]/74 dark:text-[#F4F3EF]/74 max-w-md mx-auto">
                      Все завершённые проекты, закрывающие акты и мастер-файлы доступны в разделе «Завершённые», либо вы можете запустить новый ролик.
                    </p>
                    <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => ctrl.selectWorkspaceFilter('history')}
                        className="min-h-[44px] sm:min-h-[38px] px-4 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                      >
                        Перейти к завершённым заказам
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate({ kind: 'order' })}
                        className="min-h-[44px] sm:min-h-[38px] px-4 py-2 rounded-xl bg-[#C83210] hover:bg-[#B02A0C] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                      >
                        Оформить новый заказ →
                      </button>
                    </div>
                  </div>
                ) : null)}

              {/* ПРИОРИТЕТ 2: АРХИВ ЗАВЕРШЁННЫХ ЗАКАЗОВ И МАСТЕР-ФАЙЛОВ (БЕЗ ДУБЛИРОВАНИЯ АКТИВНЫХ) */}
              {ctrl.workspaceFilter !== 'active' &&
                (ctrl.historyOrders.length > 0 ||
                  ctrl.workspaceFilter === 'history') && (
                  <CabinetOrderHistorySection
                    totalHistoryOrdersCount={ctrl.historyOrders.length}
                    inWorkCount={ctrl.historyStatusSummary.inWorkCount}
                    inReviewCount={ctrl.historyStatusSummary.inReviewCount}
                    readyCount={ctrl.historyStatusSummary.readyCount}
                    totalHistoryMastersCount={ctrl.totalHistoryMastersCount}
                    filteredHistoryOrders={ctrl.filteredHistoryOrders}
                    statusFilter={ctrl.historyStatusFilter}
                    onChangeStatusFilter={ctrl.setHistoryStatusFilter}
                    searchQuery={ctrl.historySearchQuery}
                    onChangeSearchQuery={ctrl.setHistorySearchQuery}
                    onlyWithMasters={ctrl.historyOnlyWithMasters}
                    onToggleOnlyWithMasters={() =>
                      ctrl.setHistoryOnlyWithMasters((prev) => !prev)
                    }
                    hideOlderThanSixMonths={ctrl.historyHideOlderThanSixMonths}
                    onToggleHideOlderThanSixMonths={() =>
                      ctrl.setHistoryHideOlderThanSixMonths(
                        !ctrl.historyHideOlderThanSixMonths
                      )
                    }
                    showArchivedOnly={ctrl.historyShowArchivedOnly}
                    onToggleShowArchivedOnly={() =>
                      ctrl.setHistoryShowArchivedOnly((prev) => !prev)
                    }
                    completedOlderThanSixMonthsCount={
                      ctrl.historyArchiveSummary.completedOlderThanSixMonthsCount
                    }
                    manuallyArchivedCount={
                      ctrl.historyArchiveSummary.manuallyArchivedCount
                    }
                    hiddenByArchiveCount={
                      ctrl.historyArchiveSummary.hiddenByArchiveCount
                    }
                    manuallyArchivedOrderNumbers={
                      ctrl.manuallyArchivedOrderNumbers
                    }
                    onToggleManualArchiveOrder={ctrl.toggleManualArchiveOrder}
                    onResetFilters={ctrl.resetHistoryFilters}
                    onOpenDocumentModal={(order, initialDoc) =>
                      ctrl.openOrderDocumentModal(order, initialDoc)
                    }
                    onRepeatOrder={ctrl.handleRepeatOrder}
                    onManageActiveOrder={(orderNumber) => {
                      if (ctrl.workspaceFilter === 'history') {
                        ctrl.selectWorkspaceFilter('active');
                      }
                      if (typeof document !== 'undefined') {
                        window.requestAnimationFrame(() => {
                          document
                            .querySelector(
                              `[data-testid="cabinet-order-card-${orderNumber}"]`
                            )
                            ?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'start',
                            });
                        });
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Сноска о безопасности и приватности данных */}
        <p className="text-xs text-[#111111]/70 dark:text-[#F4F3EF]/70 inline-flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>
            Доступ защищён одноразовыми ссылками входа (30 мин) и индивидуальными ключами заказов — материалы, аудиоролики и документы доступны только вашей компании.
          </span>
        </p>
      </div>

      {ctrl.documentModalState && (
        <BrandedDocumentSuiteModal
          isOpen
          onClose={ctrl.closeOrderDocumentModal}
          mode="client"
          initialDoc={ctrl.documentModalState.initialDoc}
          legalProfiles={
            ctrl.documentModalState.order.legalProfiles ?? ctrl.legalProfiles
          }
          order={{
            orderNumber: ctrl.documentModalState.order.orderNumber,
            createdAtIso: ctrl.documentModalState.order.createdAt,
            formatLabel: ctrl.documentModalState.order.formatLabel,
            baseBudgetRub: ctrl.documentModalState.order.totalBudgetRub,
            defaultDurationSec:
              ctrl.documentModalState.order.documentMeta?.spotExactDurationSec ??
              ctrl.documentModalState.order.approvalWorkflow?.targetSlotSec,
            contact: ctrl.documentModalState.order.contact,
            companyOrInn: ctrl.documentModalState.order.companyOrInn,
            briefText: ctrl.documentModalState.order.briefText,
            documentMeta: ctrl.documentModalState.order.documentMeta,
          }}
        />
      )}
    </section>
  );
}
