/* global clients */
'use strict';

const GENERIC_NOTIFICATION_TITLE = 'IGIS Logistics Leasing';
const GENERIC_NOTIFICATION_BODY = 'A new notification is ready. Open the app to view it.';

function readPushPath(event) {
  if (!event.data) return null;

  try {
    const payload = event.data.json();
    return typeof payload?.path === 'string' ? payload.path : null;
  } catch {
    return null;
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

self.addEventListener('push', (event) => {
  const target = toSameOriginUrl(readPushPath(event));
  const options = {
    body: GENERIC_NOTIFICATION_BODY,
    data: { path: `${target.pathname}${target.search}${target.hash}` },
    tag: 'logistics-push-notification',
    renotify: false,
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
