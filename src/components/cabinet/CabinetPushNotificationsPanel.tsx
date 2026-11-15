import {
  ArrowUpRight,
  Bell,
  BellRing,
  CheckCheck,
  FileAudio,
  GitBranch,
  Send,
  X,
} from 'lucide-react';
import type {
  CabinetNotificationFilterTab,
  CabinetNotificationViewItem,
  ClientNotificationPreferences,
} from '../../data/cabinetPushNotifications';
import type { BrowserPushPermissionStatus } from './useCabinetPushNotifications';

function formatNotificationTimestamp(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '';
  try {
    return new Date(ts).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso.slice(0, 16).replace('T', ' ');
  }
}

function getPermissionStatusCaption(
  browserPushEnabled: boolean,
  permission: BrowserPushPermissionStatus,
  sseConnected: boolean
): string {
  if (!browserPushEnabled) {
    return sseConnected
      ? 'Мгновенный поток кабинета подключён · системные push-баннеры браузера выключены'
      : 'Включите push-оповещения, чтобы получать сигналы о статусах и версиях ролика';
  }
  if (permission === 'granted') {
    return 'Браузерные push-уведомления и живой поток кабинета активны';
  }
  if (permission === 'denied') {
    return 'Системные баннеры ограничены настройками браузера · мгновенные оповещения внутри кабинета активны';
  }
  return 'Живой push-поток кабинета активен в реальном времени';
}

export interface CabinetLivePushToastProps {
  notification: CabinetNotificationViewItem | null;
  onOpenOrder: (item: CabinetNotificationViewItem) => void;
  onDismiss: () => void;
}

export function CabinetLivePushToast({
  notification,
  onOpenOrder,
  onDismiss,
}: CabinetLivePushToastProps) {
  if (!notification) return null;

  const isVersionEvent =
    notification.kind === 'audio_version_uploaded' ||
    notification.kind === 'deliverable_uploaded';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="cabinet-live-push-toast"
      className="rounded-2xl bg-white dark:bg-[#141418] border border-[#FF4820]/45 px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-sm"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#111111]/64 dark:text-[#F4F3EF]/64 tabular-nums">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#FF4820]">
            <BellRing className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Новое push-оповещение</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono font-semibold text-[#111111] dark:text-[#F4F3EF]">
            #{notification.orderNumber}
          </span>
          {notification.versionCode && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold text-[#111111] dark:text-[#F4F3EF]">
                версия {notification.versionCode}
              </span>
            </>
          )}
        </div>

        <p className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
          {notification.title}
        </p>
        <p className="text-xs sm:text-sm text-[#111111]/70 dark:text-[#F4F3EF]/70 leading-relaxed">
          {notification.body}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
        <button
          type="button"
          data-testid="cabinet-toast-open-order-btn"
          onClick={() => onOpenOrder(notification)}
          className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#FF4820] hover:bg-[#E63D18] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <span>
            {isVersionEvent && notification.versionCode
              ? `К версии ${notification.versionCode}`
              : 'Открыть заказ'}
          </span>
          <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label="Скрыть уведомление"
          data-testid="cabinet-toast-dismiss-btn"
          onClick={onDismiss}
          className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111]/70 dark:text-[#F4F3EF]/70 hover:border-[#111111]/30 dark:hover:border-white/30 inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Скрыть</span>
        </button>
      </div>
    </div>
  );
}

export interface CabinetPushNotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: CabinetNotificationFilterTab;
  onSelectTab: (tab: CabinetNotificationFilterTab) => void;
  allCount: number;
  unreadCount: number;
  filteredNotifications: readonly CabinetNotificationViewItem[];
  preferences: ClientNotificationPreferences;
  sseConnected: boolean;
  browserPermission: BrowserPushPermissionStatus;
  isSavingPrefs: boolean;
  isSendingTestPush: boolean;
  feedbackError: string | null;
  onToggleBrowserPush: (nextEnabled: boolean) => void;
  onUpdateChannelPreference: (patch: {
    notifyOnStageChange?: boolean;
    notifyOnNewVersion?: boolean;
  }) => void;
  onMarkAllRead: () => void;
  onMarkSingleRead: (id: string) => void;
  onTriggerTestPush: () => void;
  onOpenOrderFromNotification: (item: CabinetNotificationViewItem) => void;
}

export function CabinetPushNotificationsPanel({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  allCount,
  unreadCount,
  filteredNotifications,
  preferences,
  sseConnected,
  browserPermission,
  isSavingPrefs,
  isSendingTestPush,
  feedbackError,
  onToggleBrowserPush,
  onUpdateChannelPreference,
  onMarkAllRead,
  onMarkSingleRead,
  onTriggerTestPush,
  onOpenOrderFromNotification,
}: CabinetPushNotificationsPanelProps) {
  if (!isOpen) return null;

  const tabs: ReadonlyArray<{
    id: CabinetNotificationFilterTab;
    label: string;
  }> = [
    { id: 'all', label: `Все (${allCount})` },
    { id: 'unread', label: `Непрочитанные (${unreadCount})` },
    { id: 'versions', label: 'Новые версии ролика' },
    { id: 'stages', label: 'Статусы заказов' },
  ];

  return (
    <section
      aria-labelledby="cabinet-notifications-heading"
      data-testid="cabinet-notifications-panel"
      className="rounded-2xl bg-white dark:bg-[#141418] border border-[#111111]/12 dark:border-white/12 divide-y divide-[#111111]/10 dark:divide-white/10"
    >
      {/* Шапка центра оповещений */}
      <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111111] dark:text-[#F4F3EF]">
            <Bell className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
            <span>Push-уведомления кабинета</span>
          </div>
          <h2
            id="cabinet-notifications-heading"
            className="text-lg sm:text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]"
          >
            Оповещения о статусах и версиях аудиоролика
          </h2>
          <p className="text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60">
            {getPermissionStatusCaption(
              preferences.browserPushEnabled,
              browserPermission,
              sseConnected
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="cabinet-push-toggle-btn"
            disabled={isSavingPrefs}
            aria-pressed={preferences.browserPushEnabled}
            onClick={() => onToggleBrowserPush(!preferences.browserPushEnabled)}
            className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 ${
              preferences.browserPushEnabled
                ? 'bg-[#111111] dark:bg-[#F4F3EF] text-white dark:text-[#111111]'
                : 'bg-[#FF4820] hover:bg-[#E63D18] text-white'
            }`}
          >
            <BellRing className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>
              {preferences.browserPushEnabled
                ? 'Push-уведомления включены'
                : 'Включить push-уведомления'}
            </span>
          </button>

          <button
            type="button"
            data-testid="cabinet-push-test-btn"
            disabled={isSendingTestPush}
            onClick={onTriggerTestPush}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5 text-[#FF4820] shrink-0" aria-hidden="true" />
            <span>
              {isSendingTestPush ? 'Отправка…' : 'Проверить оповещение'}
            </span>
          </button>

          <button
            type="button"
            data-testid="cabinet-notifications-close-btn"
            onClick={onClose}
            aria-label="Свернуть панель уведомлений"
            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#111111]/12 dark:border-white/12 text-xs font-semibold text-[#111111]/68 dark:text-[#F4F3EF]/68 hover:text-[#111111] dark:hover:text-[#F4F3EF] inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Свернуть</span>
          </button>
        </div>
      </div>

      {/* Настройки событий, по которым приходят оповещения */}
      <div className="px-5 py-3.5 sm:px-6 bg-[#EFECE5]/45 dark:bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#111111]/84 dark:text-[#F4F3EF]/84 cursor-pointer select-none">
            <input
              type="checkbox"
              data-testid="cabinet-pref-stage-checkbox"
              checked={preferences.notifyOnStageChange}
              disabled={isSavingPrefs}
              onChange={(e) =>
                onUpdateChannelPreference({
                  notifyOnStageChange: e.target.checked,
                })
              }
              className="w-4 h-4 rounded accent-[#FF4820] cursor-pointer"
            />
            <span>Смена статуса заказа («В работе», «На согласовании», «Готово»)</span>
          </label>

          <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#111111]/84 dark:text-[#F4F3EF]/84 cursor-pointer select-none">
            <input
              type="checkbox"
              data-testid="cabinet-pref-version-checkbox"
              checked={preferences.notifyOnNewVersion}
              disabled={isSavingPrefs}
              onChange={(e) =>
                onUpdateChannelPreference({
                  notifyOnNewVersion: e.target.checked,
                })
              }
              className="w-4 h-4 rounded accent-[#FF4820] cursor-pointer"
            />
            <span>Новые версии аудиоролика (v1, v2, master) и документы</span>
          </label>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            data-testid="cabinet-mark-all-read-btn"
            onClick={onMarkAllRead}
            className="min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold text-[#FF4820] hover:underline underline-offset-4 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <CheckCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Отметить все прочитанными</span>
          </button>
        )}
      </div>

      {feedbackError && (
        <div
          role="alert"
          className="px-5 py-3 sm:px-6 text-xs sm:text-sm text-[#DC2626] dark:text-[#F87171] bg-[#DC2626]/8"
        >
          {feedbackError}
        </div>
      )}

      {/* Фильтры ленты оповещений */}
      <div className="px-5 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Фильтр уведомлений"
          className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#EFECE5]/75 dark:bg-[#0D0D0F] border border-[#111111]/10 dark:border-white/10"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`cabinet-notif-tab-${tab.id}`}
                onClick={() => onSelectTab(tab.id)}
                className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                  active
                    ? 'bg-white dark:bg-[#141418] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/12 dark:border-white/14'
                    : 'text-[#111111]/66 dark:text-[#F4F3EF]/66 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-[#111111]/54 dark:text-[#F4F3EF]/54 tabular-nums">
          Показано событий: {filteredNotifications.length}
        </p>
      </div>

      {/* Лента событий (единая плоскость с тонкими разделителями без вложенных карточек) */}
      {filteredNotifications.length === 0 ? (
        <div
          data-testid="cabinet-notifications-empty"
          className="px-5 py-8 sm:px-6 text-center space-y-1.5"
        >
          <p className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
            В выбранной категории пока нет уведомлений
          </p>
          <p className="text-xs sm:text-sm text-[#111111]/60 dark:text-[#F4F3EF]/60 max-w-md mx-auto">
            Как только продюсер обновит этап заказа или загрузит новую версию аудиоролика (v1, v2, master), событие мгновенно появится здесь.
          </p>
        </div>
      ) : (
        <ul
          data-testid="cabinet-notifications-list"
          className="divide-y divide-[#111111]/8 dark:divide-white/8 max-h-[440px] overflow-y-auto"
        >
          {filteredNotifications.map((item) => {
            const isVersionEvent =
              item.kind === 'audio_version_uploaded' ||
              item.kind === 'deliverable_uploaded';

            return (
              <li
                key={item.id}
                data-testid={`cabinet-notification-item-${item.id}`}
                data-unread={item.isRead ? 'false' : 'true'}
                className={`px-5 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-colors ${
                  item.isRead
                    ? 'bg-transparent'
                    : 'bg-[#FF4820]/[0.035] dark:bg-[#FF4820]/[0.06]'
                }`}
              >
                <div className="min-w-0 space-y-1">
                  {/* Строка метаданных без капсул (Zero-Pill Discipline) */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#111111]/60 dark:text-[#F4F3EF]/60 tabular-nums">
                    {!item.isRead && (
                      <>
                        <span className="font-semibold text-[#FF4820]">
                          Новое
                        </span>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    <span className="inline-flex items-center gap-1 font-medium text-[#111111]/78 dark:text-[#F4F3EF]/78">
                      {isVersionEvent ? (
                        <FileAudio
                          className="w-3.5 h-3.5 text-[#FF4820] shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <GitBranch
                          className="w-3.5 h-3.5 text-[#FF4820] shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <span>
                        {item.kind === 'audio_version_uploaded'
                          ? 'Новая версия ролика'
                          : item.kind === 'deliverable_uploaded'
                            ? 'Документ по заказу'
                            : 'Смена статуса заказа'}
                      </span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-semibold text-[#111111] dark:text-[#F4F3EF]">
                      #{item.orderNumber}
                    </span>
                    {item.versionCode && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono font-semibold text-[#111111] dark:text-[#F4F3EF]">
                          {item.versionCode}
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{formatNotificationTimestamp(item.createdAt)}</span>
                  </div>

                  <p
                    className={`text-sm ${
                      item.isRead
                        ? 'font-medium text-[#111111]/86 dark:text-[#F4F3EF]/86'
                        : 'font-semibold text-[#111111] dark:text-[#F4F3EF]'
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="text-xs sm:text-sm text-[#111111]/66 dark:text-[#F4F3EF]/66 leading-relaxed">
                    {item.body}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={() => onMarkSingleRead(item.id)}
                      className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium text-[#111111]/62 dark:text-[#F4F3EF]/62 hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Прочитано
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid={`cabinet-notif-jump-${item.orderNumber}`}
                    onClick={() => onOpenOrderFromNotification(item)}
                    className="min-h-[34px] px-3.5 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>
                      {item.versionCode
                        ? `К версии ${item.versionCode}`
                        : 'К заказу'}
                    </span>
                    <ArrowUpRight
                      className="w-3.5 h-3.5 text-[#FF4820] shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
