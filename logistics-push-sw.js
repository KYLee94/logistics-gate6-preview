/* global clients */
'use strict';

const GENERIC_NOTIFICATION_TITLE = 'IGIS Logistics Platform';
const GENERIC_NOTIFICATION_BODY = '새 알림이 있습니다. 플랫폼에서 내용을 확인해 주세요.';
const SETUP_NOTIFICATION_BODY = '시스템 알림이 정상적으로 연결되었습니다.';
const PUSH_STAGE_MESSAGE_TYPE = 'logistics-push-stage';
const PUSH_SETUP_MESSAGE_TYPE = 'logistics-push-show-setup-confirmation';
const PUSH_ACK_MESSAGE_TYPE = 'logistics-push-ack';

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

function notificationId(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function postNotificationStage(id, stage) {
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const message = { type: PUSH_STAGE_MESSAGE_TYPE, notification_id: id, stage };
  windows.forEach((client) => {
    try {
      client.postMessage(message);
    } catch {
      // A closing client must not prevent notification delivery to the others.
    }
  });
}

async function showLogisticsNotification({ id, path, body, tagPrefix }) {
  await postNotificationStage(id, 'received');
  const target = toSameOriginUrl(path);
  try {
    await self.registration.showNotification(GENERIC_NOTIFICATION_TITLE, {
      body,
      data: { path: `${target.pathname}${target.search}${target.hash}` },
      tag: `${tagPrefix}-${id}`,
      renotify: true,
    });
    await postNotificationStage(id, 'shown');
    return { workerReceived: true, showRequested: true };
  } catch {
    await postNotificationStage(id, 'failed');
    return { workerReceived: true, showRequested: false };
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
  const id = notificationId(payload.notification_id);
  event.waitUntil(showLogisticsNotification({
    id,
    path: payload.path,
    body: GENERIC_NOTIFICATION_BODY,
    tagPrefix: 'logistics-push',
  }));
});

self.addEventListener('message', (event) => {
  const payload = event.data && typeof event.data === 'object' ? event.data : {};
  if (payload.type !== PUSH_SETUP_MESSAGE_TYPE) return;

  const id = notificationId(payload.notification_id);
  const responsePort = event.ports?.[0];
  event.waitUntil((async () => {
    const acknowledgement = await showLogisticsNotification({
      id,
      path: payload.path,
      body: SETUP_NOTIFICATION_BODY,
      tagPrefix: 'logistics-push-setup',
    });
    if (responsePort) {
      responsePort.postMessage({
        type: PUSH_ACK_MESSAGE_TYPE,
        notification_id: id,
        ...acknowledgement,
      });
    }
  })());
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
