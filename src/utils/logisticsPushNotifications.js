import { invokeDashboardApi } from './supabaseSession';

const PUSH_CONFIG_ACTION = 'notifications/push/config';
const PUSH_SUBSCRIBE_ACTION = 'notifications/push/subscribe';
const PUSH_UNSUBSCRIBE_ACTION = 'notifications/push/unsubscribe';

let registrationPromise = null;
let pushPreparationPromise = null;
let preparedPushState = null;

function pushUnavailableError() {
  return new Error('Push notifications are unavailable in this browser or connection.');
}

function getBasePath() {
  const baseUrl = import.meta.env.BASE_URL || '/';
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function getServiceWorkerUrl() {
  return `${getBasePath()}logistics-push-sw.js`;
}

function assertPushSupport() {
  if (
    typeof window === 'undefined'
    || !window.isSecureContext
    || !('serviceWorker' in navigator)
    || !('PushManager' in window)
    || !('Notification' in window)
  ) {
    throw pushUnavailableError();
  }
}

function errorFromApi(action, error, response) {
  const message = response?.message || response?.error?.message || error?.message || `${action} failed.`;
  return new Error(message);
}

async function invokePushApi(action, payload = {}) {
  const { data, error } = await invokeDashboardApi(action, payload, {
    retryNetwork: false,
    retryTimeout: false,
  });
  if (error || data?.ok === false) throw errorFromApi(action, error, data);
  return data?.data ?? data;
}

function arrayBufferToBase64Url(value) {
  if (!value) return '';
  const bytes = new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

function getBrowserFamily() {
  const userAgent = navigator.userAgent || '';
  if (/Whale/iu.test(userAgent)) return 'whale';
  if (/Edg/iu.test(userAgent)) return 'edge';
  if (/Chrome/iu.test(userAgent)) return 'chrome';
  if (/Safari/iu.test(userAgent)) return 'safari';
  return 'browser';
}

function serializeSubscription(subscription) {
  return {
    endpoint: subscription.endpoint,
    p256dh_key: arrayBufferToBase64Url(subscription.getKey('p256dh')),
    auth_key: arrayBufferToBase64Url(subscription.getKey('auth')),
    expires_at: subscription.expirationTime ? new Date(subscription.expirationTime).toISOString() : null,
    browser_family: getBrowserFamily(),
  };
}

export function isLogisticsPushSupported() {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function urlBase64ToUint8Array(base64Url) {
  if (typeof base64Url !== 'string' || !/^[A-Za-z0-9_-]+$/u.test(base64Url)) {
    throw new Error('The VAPID public key must be a base64url string.');
  }

  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = `${base64Url}${padding}`.replace(/-/gu, '+').replace(/_/gu, '/');
  const binary = atob(base64);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) output[index] = binary.charCodeAt(index);
  return output;
}

export async function registerLogisticsPushServiceWorker() {
  assertPushSupport();
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker.register(getServiceWorkerUrl(), { scope: getBasePath() })
      .then(async (registration) => {
        await registration.update();
        return navigator.serviceWorker.ready;
      })
      .catch((error) => {
        registrationPromise = null;
        throw error;
      });
  }
  return registrationPromise;
}

export async function showLogisticsPushSetupConfirmation() {
  const registration = await registerLogisticsPushServiceWorker();
  await registration.showNotification('IGIS Logistics Platform', {
    body: '시스템 알림이 정상적으로 연결되었습니다.',
    tag: `logistics-push-setup-${Date.now()}`,
    renotify: true,
  });
}

export async function requestLogisticsPushPermission() {
  assertPushSupport();
  if (Notification.permission === 'default') return Notification.requestPermission();
  return Notification.permission;
}

export async function getLogisticsPushConfig() {
  const config = await invokePushApi(PUSH_CONFIG_ACTION);
  if (typeof config?.public_key !== 'string' || !config.public_key) {
    throw new Error('The server did not return a VAPID public key.');
  }
  return config;
}

export async function prepareLogisticsPushNotifications() {
  assertPushSupport();
  if (!pushPreparationPromise) {
    pushPreparationPromise = Promise.all([
      registerLogisticsPushServiceWorker(),
      getLogisticsPushConfig(),
    ]).then(async ([registration, config]) => {
      const subscription = await registration.pushManager.getSubscription();
      preparedPushState = { registration, config, subscription };
      return preparedPushState;
    }).catch((error) => {
      pushPreparationPromise = null;
      preparedPushState = null;
      throw error;
    });
  }
  return pushPreparationPromise;
}

export async function subscribeLogisticsPushNotifications() {
  assertPushSupport();
  const prepared = preparedPushState;
  if (!prepared) throw new Error('시스템 알림 준비가 끝난 뒤 다시 시도해 주세요.');

  let subscription = prepared.subscription;
  if (!subscription) {
    try {
      const subscriptionPromise = prepared.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(prepared.config.public_key),
      });
      subscription = await subscriptionPromise;
      preparedPushState = { ...prepared, subscription };
    } catch (error) {
      const permission = Notification.permission;
      if (permission !== 'granted') return { permission, subscribed: false };
      throw error;
    }
  }

  const permission = Notification.permission;
  if (permission !== 'granted') return { permission, subscribed: false };
  const payload = serializeSubscription(subscription);
  if (!payload.endpoint || !payload.p256dh_key || !payload.auth_key) {
    throw new Error('The browser returned an incomplete push subscription.');
  }
  const response = await invokePushApi(PUSH_SUBSCRIBE_ACTION, payload);
  return { permission, subscribed: true, response };
}

export async function getLogisticsPushSubscriptionStatus() {
  if (!isLogisticsPushSupported()) return { supported: false, subscribed: false, permission: 'unsupported' };
  const prepared = await prepareLogisticsPushNotifications();
  return { supported: true, subscribed: Boolean(prepared.subscription), permission: Notification.permission };
}

export async function unsubscribeLogisticsPushNotifications() {
  assertPushSupport();
  const prepared = await prepareLogisticsPushNotifications();
  const subscription = prepared.subscription;
  if (!subscription) return { subscribed: false, alreadyUnsubscribed: true };

  await invokePushApi(PUSH_UNSUBSCRIBE_ACTION, { endpoint: subscription.endpoint });
  const unsubscribed = await subscription.unsubscribe();
  if (unsubscribed) preparedPushState = { ...prepared, subscription: null };
  return { subscribed: false, unsubscribed };
}
