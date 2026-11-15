import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type CabinetNotificationFilterTab,
  type CabinetNotificationViewItem,
  type ClientNotificationPreferences,
  countUnreadNotifications,
  createDefaultClientNotificationPreferences,
  filterCabinetNotificationViewItems,
} from '../../data/cabinetPushNotifications';
import type { ClientCabinetOrderSummary } from '../../data/clientCabinetHelpers';
import {
  buildCabinetNotificationsStreamUrl,
  type LocalOrderTokenRef,
  markCabinetNotificationsReadApi,
  queryCabinetNotificationsApi,
  triggerCabinetTestPushApi,
  updateCabinetNotificationPreferencesApi,
} from './clientCabinetApi';

export type BrowserPushPermissionStatus =
  | 'unsupported'
  | 'default'
  | 'granted'
  | 'denied';

function detectBrowserNotificationPermission(): BrowserPushPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const perm = window.Notification.permission;
  if (perm === 'granted' || perm === 'denied' || perm === 'default') {
    return perm;
  }
  return 'default';
}

async function ensureCabinetServiceWorkerRegistered(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/cabinet-push-sw.js', {
      scope: '/',
    });
    return reg;
  } catch {
    return null;
  }
}

async function showBrowserOrSwNotification(
  item: CabinetNotificationViewItem,
  swReg: ServiceWorkerRegistration | null
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }
  if (window.Notification.permission !== 'granted') {
    return;
  }
  const targetUrl = `/cabinet?order=${encodeURIComponent(item.orderNumber)}`;
  try {
    if (swReg && typeof swReg.showNotification === 'function') {
      await swReg.showNotification(item.title, {
        body: item.body,
        tag: item.id,
        data: {
          url: targetUrl,
          orderNumber: item.orderNumber,
          versionCode: item.versionCode ?? '',
          notificationId: item.id,
        },
      });
      return;
    }
  } catch {
    // Fallback to standard Notification constructor below
  }

  try {
    new window.Notification(item.title, {
      body: item.body,
      tag: item.id,
    });
  } catch {
    // Ignore when blocked by browser/iframe policy
  }
}

export interface UseCabinetPushNotificationsParams {
  orders: readonly ClientCabinetOrderSummary[];
  isAuthenticated: boolean;
  onLiveOrderUpdate: () => void;
  onJumpToOrder: (orderNumber: string, versionCode?: string) => void;
}

export function useCabinetPushNotifications({
  orders,
  isAuthenticated,
  onLiveOrderUpdate,
  onJumpToOrder,
}: UseCabinetPushNotificationsParams) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeTab, setActiveTab] =
    useState<CabinetNotificationFilterTab>('all');
  const [notifications, setNotifications] = useState<
    CabinetNotificationViewItem[]
  >([]);
  const [preferences, setPreferences] = useState<ClientNotificationPreferences>(
    () => createDefaultClientNotificationPreferences('anonymous')
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [browserPermission, setBrowserPermission] =
    useState<BrowserPushPermissionStatus>(() =>
      detectBrowserNotificationPermission()
    );
  const [liveToast, setLiveToast] =
    useState<CabinetNotificationViewItem | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);
  const prefsRef = useRef<ClientNotificationPreferences>(preferences);
  prefsRef.current = preferences;

  const onLiveOrderUpdateRef = useRef(onLiveOrderUpdate);
  onLiveOrderUpdateRef.current = onLiveOrderUpdate;

  const onJumpToOrderRef = useRef(onJumpToOrder);
  onJumpToOrderRef.current = onJumpToOrder;

  const tokenRefs: LocalOrderTokenRef[] = useMemo(
    () =>
      orders
        .filter((o) => Boolean(o.orderNumber && o.rescueToken))
        .map((o) => ({
          orderNumber: o.orderNumber,
          rescueToken: o.rescueToken,
        })),
    [orders]
  );

  const tokenSignature = useMemo(
    () =>
      tokenRefs
        .map((r) => `${r.orderNumber}:${r.rescueToken}`)
        .sort()
        .join('|'),
    [tokenRefs]
  );

  const refreshNotifications = useCallback(async () => {
    if (tokenRefs.length === 0 && !isAuthenticated) {
      setNotifications([]);
      return;
    }
    setIsSyncing(true);
    try {
      const res = await queryCabinetNotificationsApi(tokenRefs);
      if (res) {
        setNotifications(res.notifications);
        setPreferences(res.preferences);
        setFeedbackError(null);
      }
    } catch {
      // Keep last known notifications on transient network error
    } finally {
      setIsSyncing(false);
    }
  }, [tokenRefs, isAuthenticated]);

  // Начальная загрузка при изменении доступных заказов или сессии
  useEffect(() => {
    void refreshNotifications();
  }, [tokenSignature, isAuthenticated, refreshNotifications]);

  // Авто-регистрация Service Worker, если push уже включён в профиле клиента
  useEffect(() => {
    if (!preferences.browserPushEnabled) return;
    void ensureCabinetServiceWorkerRegistered().then((reg) => {
      if (reg) {
        swRegRef.current = reg;
      }
      setBrowserPermission(detectBrowserNotificationPermission());
    });
  }, [preferences.browserPushEnabled]);

  // Слушаем клики по системным уведомлениям из Service Worker
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    const handleSwMessage = (event: MessageEvent) => {
      const data = event.data as
        | {
            type?: string;
            orderNumber?: string;
            versionCode?: string;
            notificationId?: string;
          }
        | undefined;
      if (data?.type === 'CABINET_NOTIFICATION_CLICK' && data.orderNumber) {
        onJumpToOrderRef.current(
          data.orderNumber,
          data.versionCode || undefined
        );
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, []);

  // Подключение к реальному потоку Server-Sent Events (SSE) для мгновенного приёма событий
  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }
    if (tokenRefs.length === 0 && !isAuthenticated) {
      setSseConnected(false);
      return;
    }

    const streamUrl = buildCabinetNotificationsStreamUrl(tokenRefs);
    const source = new EventSource(streamUrl, { withCredentials: true });

    const onConnected = () => {
      setSseConnected(true);
    };

    const onNotificationEvent = (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(String(ev.data)) as {
          notification?: CabinetNotificationViewItem;
        };
        const incoming = parsed?.notification;
        if (!incoming || !incoming.id) return;

        setNotifications((prev) => {
          const filteredPrev = prev.filter((item) => item.id !== incoming.id);
          const next = [incoming, ...filteredPrev];
          next.sort(
            (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
          );
          return next.slice(0, 300);
        });

        setLiveToast(incoming);

        if (!incoming.isTestPush) {
          onLiveOrderUpdateRef.current();
        }

        if (prefsRef.current.browserPushEnabled) {
          void showBrowserOrSwNotification(incoming, swRegRef.current);
        }
      } catch {
        // Ignore malformed frame
      }
    };

    const onError = () => {
      setSseConnected(false);
    };

    source.addEventListener('connected', onConnected);
    source.addEventListener('notification', onNotificationEvent);
    source.onerror = onError;

    return () => {
      source.removeEventListener('connected', onConnected);
      source.removeEventListener('notification', onNotificationEvent);
      source.close();
      setSseConnected(false);
    };
  }, [tokenSignature, isAuthenticated, tokenRefs]);

  const unreadCount = useMemo(
    () => countUnreadNotifications(notifications),
    [notifications]
  );

  const filteredNotifications = useMemo(
    () => filterCabinetNotificationViewItems(notifications, activeTab),
    [notifications, activeTab]
  );

  const handleToggleBrowserPush = useCallback(
    async (nextEnabled: boolean) => {
      setIsSavingPrefs(true);
      setFeedbackError(null);
      let pushEndpoint: string | null = preferences.pushEndpoint;

      if (nextEnabled) {
        const reg = await ensureCabinetServiceWorkerRegistered();
        if (reg) {
          swRegRef.current = reg;
          try {
            const existingSub = await reg.pushManager?.getSubscription();
            if (existingSub?.endpoint) {
              pushEndpoint = existingSub.endpoint;
            }
          } catch {
            // Optional subscription metadata
          }
        }

        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          window.Notification.permission === 'default'
        ) {
          try {
            await window.Notification.requestPermission();
          } catch {
            // Sandboxed preview iframes may block OS prompt; SSE live push still works
          }
        }
        setBrowserPermission(detectBrowserNotificationPermission());
      }

      try {
        const updated = await updateCabinetNotificationPreferencesApi({
          items: tokenRefs,
          browserPushEnabled: nextEnabled,
          pushEndpoint,
        });
        setPreferences(updated.preferences);
        setNotifications(updated.notifications);
      } catch (err) {
        setFeedbackError(
          err instanceof Error
            ? err.message
            : 'Не удалось обновить настройки push-уведомлений'
        );
      } finally {
        setIsSavingPrefs(false);
      }
    },
    [preferences.pushEndpoint, tokenRefs]
  );

  const handleUpdateChannelPreference = useCallback(
    async (patch: {
      notifyOnStageChange?: boolean;
      notifyOnNewVersion?: boolean;
    }) => {
      setIsSavingPrefs(true);
      setFeedbackError(null);
      try {
        const updated = await updateCabinetNotificationPreferencesApi({
          items: tokenRefs,
          ...patch,
        });
        setPreferences(updated.preferences);
        setNotifications(updated.notifications);
      } catch (err) {
        setFeedbackError(
          err instanceof Error
            ? err.message
            : 'Не удалось сохранить параметры оповещений'
        );
      } finally {
        setIsSavingPrefs(false);
      }
    },
    [tokenRefs]
  );

  const handleMarkRead = useCallback(
    async (notificationIds: readonly string[]) => {
      if (notificationIds.length === 0) return;
      // Оптимистично отмечаем прочитанным в UI и фиксируем на сервере
      const idSet = new Set(notificationIds);
      setNotifications((prev) =>
        prev.map((item) =>
          idSet.has(item.id) ? { ...item, isRead: true } : item
        )
      );
      try {
        const updated = await markCabinetNotificationsReadApi({
          items: tokenRefs,
          notificationIds,
        });
        setPreferences(updated.preferences);
        setNotifications(updated.notifications);
      } catch {
        // Keep optimistic state if offline
      }
    },
    [tokenRefs]
  );

  const handleMarkAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    try {
      const updated = await markCabinetNotificationsReadApi({
        items: tokenRefs,
        markAll: true,
      });
      setPreferences(updated.preferences);
      setNotifications(updated.notifications);
    } catch (err) {
      setFeedbackError(
        err instanceof Error
          ? err.message
          : 'Не удалось отметить уведомления прочитанными'
      );
    }
  }, [tokenRefs]);

  const handleTriggerTestPush = useCallback(async () => {
    setIsSendingTestPush(true);
    setFeedbackError(null);
    try {
      const res = await triggerCabinetTestPushApi({
        items: tokenRefs,
        orderNumber: orders[0]?.orderNumber,
      });
      // Если SSE ещё подключается, сразу отображаем уведомление и тост идемпотентно
      setNotifications((prev) => {
        const withoutDup = prev.filter((n) => n.id !== res.notification.id);
        return [res.notification, ...withoutDup];
      });
      setLiveToast(res.notification);
    } catch (err) {
      setFeedbackError(
        err instanceof Error
          ? err.message
          : 'Не удалось отправить проверочное оповещение'
      );
    } finally {
      setIsSendingTestPush(false);
    }
  }, [tokenRefs, orders]);

  const handleOpenOrderFromNotification = useCallback(
    (item: CabinetNotificationViewItem) => {
      if (!item.isRead) {
        void handleMarkRead([item.id]);
      }
      if (liveToast?.id === item.id) {
        setLiveToast(null);
      }
      onJumpToOrder(item.orderNumber, item.versionCode);
    },
    [handleMarkRead, liveToast?.id, onJumpToOrder]
  );

  return {
    isPanelOpen,
    setIsPanelOpen,
    activeTab,
    setActiveTab,
    notifications,
    filteredNotifications,
    unreadCount,
    preferences,
    isSyncing,
    isSavingPrefs,
    isSendingTestPush,
    sseConnected,
    browserPermission,
    liveToast,
    dismissLiveToast: () => setLiveToast(null),
    feedbackError,
    clearFeedbackError: () => setFeedbackError(null),
    refreshNotifications,
    handleToggleBrowserPush,
    handleUpdateChannelPreference,
    handleMarkRead,
    handleMarkAllRead,
    handleTriggerTestPush,
    handleOpenOrderFromNotification,
  };
}
