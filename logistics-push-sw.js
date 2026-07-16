/* global clients */
'use strict';

const GENERIC_NOTIFICATION_TITLE = 'IGIS Logistics Platform';
const GENERIC_NOTIFICATION_BODY = '새 알림이 있습니다. 플랫폼에서 내용을 확인해 주세요.';

function readPushPayload(event) {
  if (!event.data) return {};

  try {
    const payload = event.data.json();
    return payload && typeof payload === 'object' ? payload : {};
  } catch {
    return {};
  }
}

function toSameOriginUrl(path) {
  const fallback = new URL(self.registration.scope);
  if (typeof path !== 'string' || !path.trim()) return fallback;

  try {
    const target = new URL(path, self.location.origin);
    return target.origin === self.location.origin ? target : fallback;
  } catch {
    return fallback;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event);
  const target = toSameOriginUrl(payload.path);
  const notificationId = typeof payload.notification_id === 'string' && payload.notification_id.trim()
    ? payload.notification_id.trim()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const options = {
    body: GENERIC_NOTIFICATION_BODY,
    data: { path: `${target.pathname}${target.search}${target.hash}` },
    tag: `logistics-push-${notificationId}`,
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(GENERIC_NOTIFICATION_TITLE, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = toSameOriginUrl(event.notification.data?.path);

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existingWindow = windows.find((client) => {
      try {
        return new URL(client.url).origin === target.origin;
      } catch {
        return false;
      }
    });

    if (existingWindow) {
      await existingWindow.focus();
      if (typeof existingWindow.navigate === 'function') await existingWindow.navigate(target.href);
      return;
    }

    await clients.openWindow(target.href);
  })());
});
