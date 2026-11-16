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
import { KeyboardEvent, useRef } from 'react';
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
      ? 'Мгновенный поток кабинета подключён · системные баннеры браузера выключены'
      : 'Включите оповещения, чтобы получать сигналы о статусах и версиях ролика';
  }
  if (permission === 'granted') {
    return 'Браузерные push-уведомления и живой поток кабинета активны';
  }
  if (permission === 'denied') {
    return 'Системные баннеры ограничены настройками браузера · мгновенные оповещения внутри кабинета активны';
  }
  return 'Живой поток оповещений кабинета активен в реальном времени';
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
      className="rounded-2xl bg-white dark:bg-[#141418] border border-[#C83210]/45 dark:border-[#FF6B47]/45 px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-sm"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#111111]/74 dark:text-[#F4F3EF]/74 tabular-nums">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#C83210] dark:text-[#FF6B47]">
            <BellRing className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Новое оповещение</span>
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
        <p className="text-xs sm:text-sm text-[#111111]/76 dark:text-[#F4F3EF]/76 leading-relaxed">
          {notification.body}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
        <button
          type="button"
          data-testid="cabinet-toast-open-order-btn"
          onClick={() => onOpenOrder(notification)}
          className="min-h-[44px] sm:min-h-[38px] px-4 py-1.5 rounded-xl bg-[#C83210] hover:bg-[#B02A0C] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
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
          className="min-h-[44px] sm:min-h-[38px] px-3 py-1.5 rounded-xl border border-[#111111]/16 dark:border-white/16 text-xs font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:border-[#111111]/35 dark:hover:border-white/35 inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
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
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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

  const tabPanelId = 'cabinet-notifications-tabpanel';

  const handleTabKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    currentIdx: number
  ) => {
    let nextIdx = -1;
    if (e.key === 'ArrowRight') {
      nextIdx = (currentIdx + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = tabs.length - 1;
    }
    if (nextIdx >= 0) {
      e.preventDefault();
      const target = tabs[nextIdx];
      onSelectTab(target.id);
      tabRefs.current[target.id]?.focus();
    }
  };

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
            <Bell className="w-3.5 h-3.5 text-[#C83210] dark:text-[#FF6B47] shrink-0" aria-hidden="true" />
            <span>Центр оповещений кабинета</span>
          </div>
          <h2
            id="cabinet-notifications-heading"
            className="text-lg sm:text-xl font-bold tracking-tight text-[#111111] dark:text-[#F4F3EF]"
          >
            Оповещения о статусах и версиях аудиоролика
          </h2>
          <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72">
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
            className={`min-h-[44px] sm:min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
              preferences.browserPushEnabled
                ? 'bg-[#166534] text-white'
                : 'bg-[#111111] hover:bg-[#C83210] text-white dark:bg-[#F4F3EF] dark:text-[#0D0D0F] dark:hover:bg-[#FF4820] dark:hover:text-white'
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
            className="min-h-[44px] sm:min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
          >
            <Send className="w-3.5 h-3.5 text-[#C83210] dark:text-[#FF6B47] shrink-0" aria-hidden="true" />
            <span>
              {isSendingTestPush ? 'Отправка…' : 'Проверить оповещение'}
            </span>
          </button>

          <button
            type="button"
            data-testid="cabinet-notifications-close-btn"
            onClick={onClose}
            aria-label="Свернуть панель уведомлений"
            className="min-h-[44px] sm:min-h-[38px] px-3 py-1.5 rounded-xl border border-[#111111]/14 dark:border-white/14 text-xs font-semibold text-[#111111]/78 dark:text-[#F4F3EF]/78 hover:text-[#111111] dark:hover:text-[#F4F3EF] inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
          >
            <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Свернуть</span>
          </button>
        </div>
      </div>

      {/* Настройки событий */}
      <div className="px-5 py-3.5 sm:px-6 bg-[#EFECE5]/45 dark:bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#111111]/86 dark:text-[#F4F3EF]/86 cursor-pointer select-none">
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
              className="w-4 h-4 rounded accent-[#C83210] cursor-pointer"
            />
            <span>Смена статуса заказа («В работе», «На согласовании», «Готово»)</span>
          </label>

          <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#111111]/86 dark:text-[#F4F3EF]/86 cursor-pointer select-none">
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
              className="w-4 h-4 rounded accent-[#C83210] cursor-pointer"
            />
            <span>Новые версии аудиоролика (v1, v2, master) и документы</span>
          </label>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            data-testid="cabinet-mark-all-read-btn"
            onClick={onMarkAllRead}
            className="min-h-[44px] sm:min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold text-[#C83210] dark:text-[#FF6B47] hover:underline underline-offset-4 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
          >
            <CheckCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Отметить все прочитанными</span>
          </button>
        )}
      </div>

      {feedbackError && (
        <div
          role="alert"
          className="px-5 py-3 sm:px-6 text-xs sm:text-sm text-[#B91C1C] dark:text-[#F87171] bg-[#B91C1C]/8"
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
          {tabs.map((tab, idx) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                id={`cabinet-notif-tab-id-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={tabPanelId}
                tabIndex={active ? 0 : -1}
                data-testid={`cabinet-notif-tab-${tab.id}`}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                onClick={() => onSelectTab(tab.id)}
                className={`min-h-[44px] sm:min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820] ${
                  active
                    ? 'bg-white dark:bg-[#141418] text-[#111111] dark:text-[#F4F3EF] border border-[#111111]/12 dark:border-white/14'
                    : 'text-[#111111]/74 dark:text-[#F4F3EF]/74 hover:text-[#111111] dark:hover:text-[#F4F3EF]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 tabular-nums">
          Показано событий: {filteredNotifications.length}
        </p>
      </div>

      {/* Панель ленты событий */}
      <div
        id={tabPanelId}
        role="tabpanel"
        aria-labelledby={`cabinet-notif-tab-id-${activeTab}`}
        tabIndex={0}
        className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
      >
        {filteredNotifications.length === 0 ? (
          <div
            data-testid="cabinet-notifications-empty"
            className="px-5 py-8 sm:px-6 text-center space-y-1.5"
          >
            <p className="text-sm font-semibold text-[#111111] dark:text-[#F4F3EF]">
              В выбранной категории пока нет уведомлений
            </p>
            <p className="text-xs sm:text-sm text-[#111111]/72 dark:text-[#F4F3EF]/72 max-w-md mx-auto">
              Как только продюсер обновит этап заказа или загрузит новую версию аудиоролика (v1, v2, master), событие мгновенно появится здесь.
            </p>
          </div>
        ) : (
          <ul
            data-testid="cabinet-notifications-list"
            className="divide-y divide-[#111111]/10 dark:divide-white/10 max-h-[440px] overflow-y-auto"
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
                      : 'bg-[#C83210]/[0.04] dark:bg-[#FF4820]/[0.06]'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#111111]/72 dark:text-[#F4F3EF]/72 tabular-nums">
                      {!item.isRead && (
                        <>
                          <span className="font-semibold text-[#C83210] dark:text-[#FF6B47]">
                            Новое
                          </span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="inline-flex items-center gap-1 font-medium text-[#111111]/82 dark:text-[#F4F3EF]/82">
                        {isVersionEvent ? (
                          <FileAudio
                            className="w-3.5 h-3.5 text-[#C83210] dark:text-[#FF6B47] shrink-0"
                            aria-hidden="true"
                          />
                        ) : (
                          <GitBranch
                            className="w-3.5 h-3.5 text-[#C83210] dark:text-[#FF6B47] shrink-0"
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
                          ? 'font-medium text-[#111111]/88 dark:text-[#F4F3EF]/88'
                          : 'font-semibold text-[#111111] dark:text-[#F4F3EF]'
                      }`}
                    >
                      {item.title}
                    </p>
                    <p className="text-xs sm:text-sm text-[#111111]/76 dark:text-[#F4F3EF]/76 leading-relaxed">
                      {item.body}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                    {!item.isRead && (
                      <button
                        type="button"
                        onClick={() => onMarkSingleRead(item.id)}
                        className="min-h-[44px] sm:min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium text-[#111111]/72 dark:text-[#F4F3EF]/72 hover:text-[#111111] dark:hover:text-[#F4F3EF] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                      >
                        Прочитано
                      </button>
                    )}

                    <button
                      type="button"
                      data-testid={`cabinet-notif-jump-${item.orderNumber}`}
                      onClick={() => onOpenOrderFromNotification(item)}
                      className="min-h-[44px] sm:min-h-[36px] px-3.5 py-1.5 rounded-xl border border-[#111111]/16 dark:border-white/16 hover:border-[#FF4820] text-xs font-semibold text-[#111111] dark:text-[#F4F3EF] inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4820]"
                    >
                      <span>
                        {item.versionCode
                          ? `К версии ${item.versionCode}`
                          : 'К заказу'}
                      </span>
                      <ArrowUpRight
                        className="w-3.5 h-3.5 text-[#C83210] dark:text-[#FF6B47] shrink-0"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
