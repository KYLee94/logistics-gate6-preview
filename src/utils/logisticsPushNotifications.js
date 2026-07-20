import { invokeDashboardApi } from './supabaseSession';

const PUSH_CONFIG_ACTION = 'notifications/push/config';
const PUSH_SUBSCRIBE_ACTION = 'notifications/push/subscribe';
const PUSH_UNSUBSCRIBE_ACTION = 'notifications/push/unsubscribe';
const WORKER_ACTIVATION_TIMEOUT_MS = 15000;

let registrationPromise = null;
let pushPreparationPromise = null;
let preparedPushState = null;

function pushUnavailableError() {
  return new Error('현재 브라우저 또는 연결 환경에서는 시스템 알림을 사용할 수 없습니다.');
}

function getBasePath() {
  const baseUrl = import.meta.env.BASE_URL || '/';
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function getServiceWorkerUrl() {
  return `${getBasePath()}logistics-push-sw.js`;
}

function expectedServiceWorkerUrl() {
  return new URL(getServiceWorkerUrl(), window.location.href).href;
}

function expectedServiceWorkerScope() {
  return new URL(getBasePath(), window.location.href).href;
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
  const message = response?.message || response?.error?.message || error?.message || '시스템 알림 설정 요청을 처리하지 못했습니다.';
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

function sameByteSequence(left, right) {
  if (!left || !right || left.byteLength !== right.byteLength) return false;
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  return leftBytes.every((byte, index) => byte === rightBytes[index]);
}

function subscriptionUsesVapidKey(subscription, publicKey) {
  const applicationServerKey = subscription?.options?.applicationServerKey;
  if (!applicationServerKey) return false;
  return sameByteSequence(applicationServerKey, urlBase64ToUint8Array(publicKey));
}

async function removeSubscriptionForVapidKeyRotation(subscription, publicKey) {
  if (!subscription || subscriptionUsesVapidKey(subscription, publicKey)) return subscription;
  const unsubscribed = await subscription.unsubscribe();
  if (!unsubscribed) throw new Error('기존 시스템 알림 구독을 새 키로 교체하지 못했습니다.');
  return null;
}

function waitForWorkerActivation(worker) {
  if (worker?.state === 'activated') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeoutId);
      worker.removeEventListener('statechange', onStateChange);
    };
    const onStateChange = () => {
      if (worker.state === 'activated') {
        cleanup();
        resolve();
      } else if (worker.state === 'redundant') {
        cleanup();
        reject(new Error('새 시스템 알림 서비스 워커를 활성화하지 못했습니다.'));
      }
    };
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('시스템 알림 서비스 워커 활성화가 지연되고 있습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.'));
    }, WORKER_ACTIVATION_TIMEOUT_MS);
    worker.addEventListener('statechange', onStateChange);
    onStateChange();
  });
}

async function waitForUpdatedServiceWorkerActivation(registration) {
  const pendingWorker = registration.installing || registration.waiting;
  if (pendingWorker) await waitForWorkerActivation(pendingWorker);
  await navigator.serviceWorker.ready;
  return registration;
}

function validateServiceWorkerRegistration(registration) {
  const activeWorker = registration?.active;
  if (
    !activeWorker
    || activeWorker.scriptURL !== expectedServiceWorkerUrl()
    || registration.scope !== expectedServiceWorkerScope()
  ) {
    throw new Error('시스템 알림 서비스 워커가 예상 경로에서 활성화되지 않았습니다.');
  }
  return registration;
}

function createSetupNotificationId() {
  if (globalThis.crypto?.randomUUID) return `setup-${globalThis.crypto.randomUUID()}`;
  return `setup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function requestWorkerSetupNotification(registration, notificationId) {
  const worker = registration.active;
  if (!worker || typeof worker.postMessage !== 'function' || typeof MessageChannel === 'undefined') {
    return Promise.reject(new Error('활성 시스템 알림 서비스 워커를 사용할 수 없습니다.'));
  }

  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => reject(new Error('시스템 알림 워커가 테스트 알림 확인 응답을 보내지 않았습니다.')), 10000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      resolve(event.data);
    };
    worker.postMessage({
      type: 'logistics-push-show-setup-confirmation',
      notification_id: notificationId,
    }, [channel.port2]);
  });
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
        const activeRegistration = await waitForUpdatedServiceWorkerActivation(registration);
        return validateServiceWorkerRegistration(activeRegistration);
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
  const notificationId = createSetupNotificationId();
  const acknowledgement = await requestWorkerSetupNotification(registration, notificationId);
  if (
    acknowledgement?.notification_id !== notificationId
    || acknowledgement?.workerReceived !== true
    || acknowledgement?.showRequested !== true
  ) {
    throw new Error('시스템 알림 워커가 테스트 알림을 표시하지 못했습니다.');
  }
  return { notificationId, workerReceived: true, showRequested: true };
}

export async function requestLogisticsPushPermission() {
  assertPushSupport();
  if (Notification.permission === 'default') return Notification.requestPermission();
  return Notification.permission;
}

export async function getLogisticsPushConfig() {
  const config = await invokePushApi(PUSH_CONFIG_ACTION);
  if (typeof config?.public_key !== 'string' || !config.public_key) {
    throw new Error('시스템 알림 서버 설정을 불러오지 못했습니다.');
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
      const currentSubscription = await registration.pushManager.getSubscription();
      const subscription = await removeSubscriptionForVapidKeyRotation(currentSubscription, config.public_key);
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
    throw new Error('브라우저가 시스템 알림 연결 정보를 완성하지 못했습니다.');
  }
  const response = await invokePushApi(PUSH_SUBSCRIBE_ACTION, payload);
  return { permission, subscribed: response?.subscribed === true, response };
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
