const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const WORKER_PATH = path.join(ROOT, 'public', 'logistics-push-sw.js');
const UTILITY_PATH = path.join(ROOT, 'src', 'utils', 'logisticsPushNotifications.js');

function loadWorker({ showNotification } = {}) {
  const listeners = new Map();
  const sentMessages = [];
  const client = { postMessage: (message) => sentMessages.push(message) };
  const self = {
    location: { origin: 'https://kylee94.github.io' },
    registration: {
      scope: 'https://kylee94.github.io/logistics-gate6-preview/',
      showNotification: showNotification || (async () => undefined),
    },
    addEventListener: (name, listener) => listeners.set(name, listener),
    skipWaiting: async () => undefined,
  };
  const context = vm.createContext({
    URL,
    Date,
    Math,
    self,
    clients: {
      claim: async () => undefined,
      matchAll: async () => [client],
      openWindow: async () => undefined,
    },
  });
  vm.runInContext(fs.readFileSync(WORKER_PATH, 'utf8'), context, { filename: WORKER_PATH });
  return { listeners, sentMessages };
}

function loadPushUtility({ registration, serviceWorkerReady = Promise.resolve(registration) }) {
  const source = fs.readFileSync(UTILITY_PATH, 'utf8')
    .replace(/import \{ invokeDashboardApi \} from ['"]\.\/supabaseSession['"];?/u, 'const invokeDashboardApi = globalThis.__invokeDashboardApi;')
    .replace(/import\.meta\.env\.BASE_URL/gu, "'/logistics-gate6-preview/'")
    .replace(/\bexport\s+/gu, '')
    .concat('\nglobalThis.__pushUtility = { registerLogisticsPushServiceWorker };');
  const context = vm.createContext({
    URL,
    Uint8Array,
    Promise,
    setTimeout,
    clearTimeout,
    window: {
      isSecureContext: true,
      PushManager: function PushManager() {},
      Notification: function Notification() {},
      location: { href: 'https://kylee94.github.io/logistics-gate6-preview/company' },
    },
    navigator: {
      userAgent: 'Mozilla/5.0 Chrome/138.0',
      serviceWorker: {
        register: async () => registration,
        ready: serviceWorkerReady,
      },
    },
    __invokeDashboardApi: async () => ({ data: { ok: true, data: {} }, error: null }),
  });
  vm.runInContext(source, context, { filename: UTILITY_PATH });
  return context.__pushUtility;
}

function lifecycleWorker({ state, scriptURL }) {
  const listeners = new Set();
  return {
    state,
    scriptURL,
    addEventListener: (type, listener) => {
      if (type === 'statechange') listeners.add(listener);
    },
    removeEventListener: (type, listener) => {
      if (type === 'statechange') listeners.delete(listener);
    },
    transition(nextState) {
      this.state = nextState;
      listeners.forEach((listener) => listener());
    },
  };
}

async function dispatchPush(worker, payload) {
  let work;
  worker.listeners.get('push')({
    data: { json: () => payload },
    waitUntil: (promise) => { work = promise; },
  });
  await work;
}

async function dispatchSetupMessage(worker, notificationId) {
  let work;
  const acknowledgements = [];
  worker.listeners.get('message')({
    data: { type: 'logistics-push-show-setup-confirmation', notification_id: notificationId },
    ports: [{ postMessage: (message) => acknowledgements.push(message) }],
    waitUntil: (promise) => { work = promise; },
  });
  await work;
  return JSON.parse(JSON.stringify(acknowledgements));
}

test('push worker posts received then shown stages to every open client using notification_id', async () => {
  const worker = loadWorker();

  await dispatchPush(worker, { notification_id: 'notice-42', path: '/company' });

  assert.deepEqual(JSON.parse(JSON.stringify(worker.sentMessages)), [
    { type: 'logistics-push-stage', notification_id: 'notice-42', stage: 'received' },
    { type: 'logistics-push-stage', notification_id: 'notice-42', stage: 'shown' },
  ]);
});

test('push worker never posts the shown stage after showNotification fails', async () => {
  const worker = loadWorker({ showNotification: async () => { throw new Error('denied'); } });

  await dispatchPush(worker, { notification_id: 'notice-failed' });

  assert.deepEqual(JSON.parse(JSON.stringify(worker.sentMessages)), [
    { type: 'logistics-push-stage', notification_id: 'notice-failed', stage: 'received' },
    { type: 'logistics-push-stage', notification_id: 'notice-failed', stage: 'failed' },
  ]);
});

test('setup confirmation is requested through the service worker and has a fixed successful acknowledgement', () => {
  const source = fs.readFileSync(UTILITY_PATH, 'utf8');
  const setupStart = source.indexOf('export async function showLogisticsPushSetupConfirmation()');
  const setupEnd = source.indexOf('export async function requestLogisticsPushPermission()', setupStart);
  const setup = source.slice(setupStart, setupEnd);

  assert.match(source, /function requestWorkerSetupNotification/u);
  assert.match(source, /worker\.postMessage\(/u);
  assert.match(setup, /notificationId/u);
  assert.match(setup, /workerReceived:\s*true/u);
  assert.match(setup, /showRequested:\s*true/u);
  assert.doesNotMatch(setup, /registration\.showNotification\(/u);
});

test('service worker returns the setup acknowledgement after using the notification path', async () => {
  const worker = loadWorker();

  const acknowledgements = await dispatchSetupMessage(worker, 'setup-42');

  assert.deepEqual(acknowledgements, [{
    type: 'logistics-push-ack',
    notification_id: 'setup-42',
    workerReceived: true,
    showRequested: true,
  }]);
  assert.deepEqual(JSON.parse(JSON.stringify(worker.sentMessages)), [
    { type: 'logistics-push-stage', notification_id: 'setup-42', stage: 'received' },
    { type: 'logistics-push-stage', notification_id: 'setup-42', stage: 'shown' },
  ]);
});

test('registration waits for an installing or waiting worker to activate before returning the active worker', async () => {
  const activeWorker = lifecycleWorker({
    state: 'activated',
    scriptURL: 'https://kylee94.github.io/logistics-gate6-preview/logistics-push-sw.js',
  });
  const waitingWorker = lifecycleWorker({
    state: 'installed',
    scriptURL: 'https://kylee94.github.io/logistics-gate6-preview/logistics-push-sw.js',
  });
  const registration = {
    scope: 'https://kylee94.github.io/logistics-gate6-preview/',
    active: activeWorker,
    waiting: waitingWorker,
    installing: null,
    update: async () => undefined,
  };
  const utility = loadPushUtility({ registration });
  let settled = false;
  const result = utility.registerLogisticsPushServiceWorker().then((value) => {
    settled = true;
    return value;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false, 'registration must not return the old active worker while an update is waiting');

  registration.active = waitingWorker;
  registration.waiting = null;
  waitingWorker.transition('activated');
  assert.equal((await result).active, waitingWorker);
});

test('registration also waits for an installing worker to activate', async () => {
  const activeWorker = lifecycleWorker({
    state: 'activated',
    scriptURL: 'https://kylee94.github.io/logistics-gate6-preview/logistics-push-sw.js',
  });
  const installingWorker = lifecycleWorker({
    state: 'installing',
    scriptURL: 'https://kylee94.github.io/logistics-gate6-preview/logistics-push-sw.js',
  });
  const registration = {
    scope: 'https://kylee94.github.io/logistics-gate6-preview/',
    active: activeWorker,
    waiting: null,
    installing: installingWorker,
    update: async () => undefined,
  };
  const utility = loadPushUtility({ registration });
  let settled = false;
  const result = utility.registerLogisticsPushServiceWorker().then((value) => {
    settled = true;
    return value;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false, 'registration must not return the old active worker while an update is installing');

  registration.active = installingWorker;
  registration.installing = null;
  installingWorker.transition('activated');
  assert.equal((await result).active, installingWorker);
});

test('registration, VAPID rotation, and persisted subscription success are explicitly verified', () => {
  const source = fs.readFileSync(UTILITY_PATH, 'utf8');

  assert.match(source, /scriptURL/u);
  assert.match(source, /registration\.scope/u);
  assert.match(source, /WORKER_ACTIVATION_TIMEOUT_MS/u);
  assert.match(source, /subscription\?\.options\?\.applicationServerKey/u);
  assert.match(source, /await subscription\.unsubscribe\(\)/u);
  assert.match(source, /response\?\.subscribed\s*===\s*true/u);
  assert.doesNotMatch(source, /The outdated browser push subscription could not be replaced\.|The active system notification worker is not registered at the expected path\.|The active system notification worker is unavailable\.|The system notification worker did not acknowledge the test alert\.|The system notification worker could not display the test alert\./u);
});
