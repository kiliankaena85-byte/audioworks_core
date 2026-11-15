import { useCallback } from 'react';
import { ArrowLeft, Bell, Lock, Plus, RefreshCw } from 'lucide-react';
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

  const handleJumpToOrder = useCallback(
    (orderNumber: string) => {
      const upper = orderNumber.trim().toUpperCase();
      const isActive = ctrl.activeOrders.some(
        (o) => o.orderNumber.toUpperCase() === upper
      );
      if (!isActive && ctrl.workspaceFilter === 'active') {
        ctrl.selectWorkspaceFilter('all');
      }
      ctrl.resetHistoryFilters();

      if (typeof document !== 'undefined') {
        window.requestAnimationFrame(() => {
          const targetEl =
            document.querySelector(
              `[data-testid="cabinet-history-row-${orderNumber}"]`
            ) ??
            document.querySelector(
              `[data-testid="cabinet-order-card-${orderNumber}"]`
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

  return (
    <section
      data-testid="client-cabinet-page"
      data-lifecycle-state={ctrl.lifecycleState}
      aria-labelledby="cabinet-page-heading"
      className="py-10 sm:py-16 lg:py-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 space-y-8 sm:space-y-10">
        {/* Верхняя строка навигации рабочего пространства */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#111111]/10 dark:border-white/10">
          <button
            type="button"
            onClick={() => onNavigate({ kind: 'home' })}
            className="min-h-[42px] inline-flex items-center gap-2 text-sm font-medium text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>На главную студию</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
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
                className="min-h-[40px] px-4 py-2 rounded-full border border-[#111111]/14 dark:border-white/14 bg-white dark:bg-[#141418] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-[#FF4820]" aria-hidden="true" />
                <span>
                  {ctrl.showLookupForm ? 'Скрыть панель доступа' : 'Вход / найти заказ'}
                </span>
              </button>
            )}

            {(ctrl.orders.length > 0 || Boolean(ctrl.clientAccount)) && (
              <button
                type="button"
                data-testid="cabinet-notifications-trigger-btn"
                aria-expanded={pushCtrl.isPanelOpen}
                onClick={() => pushCtrl.setIsPanelOpen((prev) => !prev)}
                className={`min-h-[40px] px-3.5 py-2 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                  pushCtrl.isPanelOpen
                    ? 'border-[#FF4820] bg-[#FF4820]/10 text-[#111111] dark:text-[#F4F3EF]'
                    : 'border-[#111111]/14 dark:border-white/14 bg-white dark:bg-[#141418] text-[#111111] dark:text-[#F4F3EF] hover:border-[#FF4820]'
                }`}
              >
                <Bell
                  className={`w-3.5 h-3.5 shrink-0 ${
                    pushCtrl.unreadCount > 0
                      ? 'text-[#FF4820]'
                      : 'text-[#111111]/65 dark:text-[#F4F3EF]/65'
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
              className="min-h-[40px] px-3.5 py-2 rounded-full border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111]/75 dark:text-[#F4F3EF]/75 hover:border-[#FF4820] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${ctrl.isLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Обновить</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate({ kind: 'order' })}
              className="min-h-[40px] px-4 py-2 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Новый заказ →
            </button>
          </div>
        </div>

        {/* Заголовок кабинета */}
        <div className="max-w-3xl space-y-2.5">
          <p className="text-sm font-medium text-[#FF4820]">
            {subroute === 'reset'
              ? 'Личный кабинет · Сброс и восстановление доступа'
              : subroute === 'history'
                ? 'Личный кабинет · Архив проектов и мастер-файлов'
                : 'Личный кабинет постоянного клиента'}
          </p>
          <h1
            id="cabinet-page-heading"
            className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.06] text-[#111111] dark:text-[#F4F3EF] editorial-balance"
          >
            {subroute === 'reset' && ctrl.orders.length === 0
              ? 'Восстановление доступа по почте'
              : subroute === 'history'
                ? 'История заказов и мастер-файлы'
                : 'Мои заказы и материалы'}
          </h1>
          <p className="text-sm sm:text-base text-[#111111]/68 dark:text-[#F4F3EF]/68 leading-relaxed">
            Отслеживайте этапы работы, выгружайте счёт на оплату, догружайте бриф и
            скачивайте готовые эфирные мастер-файлы по текущим и прошлым проектам.
          </p>
        </div>

        {ctrl.statusError && (
          <div
            role="alert"
            data-testid="cabinet-status-error"
            className="rounded-2xl px-4 py-3 bg-[#DC2626]/10 border border-[#DC2626]/25 text-xs sm:text-sm text-[#DC2626] dark:text-[#F87171]"
          >
            {ctrl.statusError}
          </div>
        )}

        {ctrl.authBanner && (
          <div
            role="status"
            data-testid="cabinet-auth-banner"
            className="rounded-2xl px-4 py-3 bg-[#16A34A]/10 border border-[#16A34A]/25 text-xs sm:text-sm text-[#15803D] dark:text-[#4ADE80] flex items-center justify-between gap-3"
          >
            <span>{ctrl.authBanner}</span>
            <button
              type="button"
              onClick={() => ctrl.setAuthBanner(null)}
              className="text-xs font-semibold underline underline-offset-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              Скрыть
            </button>
          </div>
        )}

        {/* Шапка активной беспарольной сессии или 1-клик авто-регистрация локальных заказов */}
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
          isBindingEmail={ctrl.isBindingEmail}
          bindEmailError={ctrl.bindEmailError}
          onSubmitBindEmail={(e) => void ctrl.handleBindAnonymousOrdersToEmail(e)}
        />

        {/* Мгновенное всплывающее push-оповещение о смене статуса заказа или новой версии аудиоролика */}
        <CabinetLivePushToast
          notification={pushCtrl.liveToast}
          onOpenOrder={pushCtrl.handleOpenOrderFromNotification}
          onDismiss={pushCtrl.dismissLiveToast}
        />

        {/* Центр push-уведомлений и настройки каналов оповещения */}
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

        {/* Панель входа по почте, сброса доступа через magic-ссылку и поиска заказа по номеру */}
        {ctrl.showLookupForm && (
          <CabinetAccessPanel
            accessTab={ctrl.accessTab}
            onSelectTab={ctrl.selectAccessTab}
            magicEmailInput={ctrl.magicEmailInput}
            onChangeMagicEmailInput={(value) => {
              ctrl.setMagicEmailInput(value);
              if (ctrl.magicRequestError) ctrl.setMagicRequestError(null);
            }}
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
              void ctrl.executeRequestMagicLink(demoEmail);
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
          <div className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-8 text-center text-sm text-[#111111]/60 dark:text-[#F4F3EF]/60">
            {ctrl.isVerifyingMagic
              ? 'Проверяем одноразовую magic-ссылку и восстанавливаем доступ к заказам…'
              : 'Проверяем статусы и готовые файлы ваших заказов…'}
          </div>
        ) : ctrl.orders.length === 0 ? (
          ctrl.showLookupForm ? (
            <div
              data-testid="cabinet-empty-state"
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-[#EFECE5]/55 dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 px-5 py-4"
            >
              <p className="text-xs sm:text-sm text-[#111111]/72 dark:text-[#F4F3EF]/72">
                Ещё не оформляли заказ? Заявка создаётся за минуту — личный кабинет зарегистрируется на вашу почту автоматически без пароля.
              </p>
              <button
                type="button"
                onClick={() => onNavigate({ kind: 'order' })}
                className="min-h-[40px] px-5 py-2 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                Оформить новый заказ →
              </button>
            </div>
          ) : (
            <div
              data-testid="cabinet-empty-state"
              className="rounded-2xl bg-[#EFECE5]/65 dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10 p-8 sm:p-10 text-center space-y-4"
            >
              <p className="text-base font-semibold text-[#111111] dark:text-[#F4F3EF]">
                В личном кабинете пока нет сохранённых заказов
              </p>
              <p className="text-sm text-[#111111]/64 dark:text-[#F4F3EF]/64 max-w-lg mx-auto">
                Оформите новый заказ за минуту — он сразу появится здесь — или восстановите доступ по почте выше.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate({ kind: 'order' })}
                  className="min-h-[44px] px-6 py-2.5 rounded-full bg-[#FF4820] hover:bg-[#E63D18] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Оформить новый заказ
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-8">
            {/* Переключатель разделов рабочего пространства */}
            <div
              data-testid="cabinet-workspace-filter"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div
                role="group"
                aria-label="Фильтр разделов личного кабинета"
                className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#EFECE5]/80 dark:bg-[#141418] border border-[#111111]/10 dark:border-white/10"
              >
                {(
                  [
                    {
                      id: 'all' as CabinetWorkspaceSectionFilter,
                      label: `Все разделы (${ctrl.orders.length})`,
                    },
                    {
                      id: 'active' as CabinetWorkspaceSectionFilter,
                      label: `Управление активными (${ctrl.activeOrders.length})`,
                    },
                    {
                      id: 'history' as CabinetWorkspaceSectionFilter,
                      label: `История заказов (${ctrl.orders.length})`,
                    },
                  ] as const
                ).map((item) => {
                  const active = ctrl.workspaceFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={active}
                      data-testid={`cabinet-filter-${item.id}`}
                      onClick={() => ctrl.selectWorkspaceFilter(item.id)}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                        active
                          ? 'bg-white dark:bg-[#0D0D0F] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/12 dark:border-white/14'
                          : 'text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-[#111111]/58 dark:text-[#F4F3EF]/58 tabular-nums">
                В работе: {ctrl.historyStatusSummary.inWorkCount} · На согласовании:{' '}
                {ctrl.historyStatusSummary.inReviewCount} · Готово:{' '}
                {ctrl.historyStatusSummary.readyCount}
              </p>
            </div>

            {/* Раздел «История заказов» с визуальными статусами («В работе», «На согласовании», «Готово»), прогрессом и мастер-файлами */}
            {ctrl.workspaceFilter !== 'active' && (
              <CabinetOrderHistorySection
                totalHistoryOrdersCount={ctrl.orders.length}
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
                completedOlderThanSixMonthsCount={
                  ctrl.historyArchiveSummary.completedOlderThanSixMonthsCount
                }
                hiddenByArchiveCount={
                  ctrl.historyArchiveSummary.hiddenByArchiveCount
                }
                manuallyArchivedOrderNumbers={ctrl.manuallyArchivedOrderNumbers}
                onToggleManualArchiveOrder={ctrl.toggleManualArchiveOrder}
                onResetFilters={ctrl.resetHistoryFilters}
                onOpenInvoiceModal={(order) => ctrl.setInvoiceModalOrder(order)}
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
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                  }
                }}
              />
            )}

            {/* Детальное управление текущими заказами (реквизиты, загрузка файлов ТЗ, канал выдачи) */}
            {ctrl.workspaceFilter !== 'history' &&
              (ctrl.activeOrders.length > 0 ? (
                <div className="space-y-5">
                  {ctrl.workspaceFilter === 'all' && (
                    <div className="space-y-1 pt-2">
                      <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]">
                        Управление текущими заказами и загрузка материалов
                      </h2>
                      <p className="text-xs sm:text-sm text-[#111111]/64 dark:text-[#F4F3EF]/64">
                        Догрузите файлы к ТЗ, обновите реквизиты организации для счёта или выберите удобный канал отправки готового ролика.
                      </p>
                    </div>
                  )}

                  <div className="space-y-6">
                    {ctrl.activeOrders.map((order) => (
                      <CabinetOrderCard
                        key={order.orderNumber}
                        order={order}
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
                        isBusyPrefs={ctrl.isSavingPrefsFor === order.orderNumber}
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
                        onOpenInvoiceModal={() =>
                          ctrl.setInvoiceModalOrder(order)
                        }
                        onRepeatOrder={() => ctrl.handleRepeatOrder(order)}
                        onForgetFromDevice={() =>
                          ctrl.handleForgetOrderFromDevice(order.orderNumber)
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
                  <p className="text-xs sm:text-sm text-[#111111]/62 dark:text-[#F4F3EF]/62 max-w-md mx-auto">
                    Все завершённые проекты и готовые мастер-файлы доступны в разделе «История заказов», либо вы можете запустить новый ролик.
                  </p>
                  <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => ctrl.selectWorkspaceFilter('history')}
                      className="min-h-[38px] px-4 py-2 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Перейти в историю заказов
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate({ kind: 'order' })}
                      className="min-h-[38px] px-4 py-2 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Новый заказ →
                    </button>
                  </div>
                </div>
              ) : null)}
          </div>
        )}

        {/* Сноска о безопасности */}
        <p className="text-xs text-[#111111]/52 dark:text-[#F4F3EF]/52 inline-flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>
            Доступ защищён криптографическими ключами HMAC-SHA256 и одноразовыми magic-ссылками (30 мин) — чужие заказы и кабинет продюсера полностью изолированы.
          </span>
        </p>
      </div>

      {ctrl.invoiceModalOrder && (
        <BrandedDocumentSuiteModal
          isOpen
          onClose={() => ctrl.setInvoiceModalOrder(null)}
          mode="client"
          initialDoc="invoice"
          legalProfiles={
            ctrl.invoiceModalOrder.legalProfiles ?? ctrl.legalProfiles
          }
          order={{
            orderNumber: ctrl.invoiceModalOrder.orderNumber,
            createdAtIso: ctrl.invoiceModalOrder.createdAt,
            formatLabel: ctrl.invoiceModalOrder.formatLabel,
            baseBudgetRub: ctrl.invoiceModalOrder.totalBudgetRub,
            contact: ctrl.invoiceModalOrder.contact,
            companyOrInn: ctrl.invoiceModalOrder.companyOrInn,
            briefText: ctrl.invoiceModalOrder.briefText,
            documentMeta: ctrl.invoiceModalOrder.documentMeta,
          }}
        />
      )}
    </section>
  );
}
