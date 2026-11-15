/* FMWorks Client Cabinet Push & Notification Service Worker */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function normalizeNotificationPayload(raw) {
  const fallback = {
    title: 'Обновление по заказу · FMWorks',
    body: 'В личном кабинете обновился статус проекта или загружена новая версия аудиоролика.',
    orderNumber: '',
    versionCode: '',
    notificationId: 'fmworks-cabinet-push',
    url: '/cabinet',
  };
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }
  const orderNumber =
    typeof raw.orderNumber === 'string' ? raw.orderNumber.trim() : '';
  const versionCode =
    typeof raw.versionCode === 'string' ? raw.versionCode.trim() : '';
  const notificationId =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : fallback.notificationId;

  return {
    title:
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim()
        : fallback.title,
    body:
      typeof raw.body === 'string' && raw.body.trim()
        ? raw.body.trim()
        : fallback.body,
    orderNumber,
    versionCode,
    notificationId,
    url: orderNumber
      ? `/cabinet?order=${encodeURIComponent(orderNumber)}`
      : '/cabinet',
  };
}

self.addEventListener('push', (event) => {
  let parsed = null;
  if (event.data) {
    try {
      parsed = event.data.json();
    } catch {
      try {
        parsed = { body: event.data.text() };
      } catch {
        parsed = null;
      }
    }
  }
  const payload = normalizeNotificationPayload(parsed);
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.notificationId,
      renotify: false,
      data: {
        url: payload.url,
        orderNumber: payload.orderNumber,
        versionCode: payload.versionCode,
        notificationId: payload.notificationId,
      },
    })
  );
});

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'SHOW_CABINET_NOTIFICATION' && msg.notification) {
    const payload = normalizeNotificationPayload(msg.notification);
    event.waitUntil(
      self.registration.showNotification(payload.title, {
        body: payload.body,
        tag: payload.notificationId,
        renotify: false,
        data: {
          url: payload.url,
          orderNumber: payload.orderNumber,
          versionCode: payload.versionCode,
          notificationId: payload.notificationId,
        },
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = typeof data.url === 'string' && data.url ? data.url : '/cabinet';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ('focus' in client && client.url.includes('/cabinet')) {
            client.postMessage({
              type: 'CABINET_NOTIFICATION_CLICK',
              orderNumber: data.orderNumber || '',
              versionCode: data.versionCode || '',
              notificationId: data.notificationId || '',
            });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});
