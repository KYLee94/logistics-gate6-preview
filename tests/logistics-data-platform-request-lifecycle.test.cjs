const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const API_PATH = path.join(ROOT, 'src', 'features', 'logistics-data-platform', 'api.js');

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key) { return this.values.get(String(key)) ?? null; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  removeItem(key) { this.values.delete(String(key)); }
  setItem(key, value) { this.values.set(String(key), String(value)); }
}

global.window = {
  __SUPABASE_CLIENT__: {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      refreshSession: async () => ({ data: { session: null }, error: null }),
    },
    functions: {
      invoke: async () => ({ data: null, error: null }),
    },
  },
  sessionStorage: new MemoryStorage(),
  localStorage: new MemoryStorage(),
  setTimeout,
  clearTimeout,
  dispatchEvent: () => true,
};

async function loadApi(label) {
  return import(`${pathToFileURL(API_PATH).href}?request-lifecycle=${label}-${Date.now()}-${Math.random()}`);
}

test('data platform request lifecycle contract', async (t) => {
  const api = await loadApi('contract');

  await t.test('lifecycle cancellation is silent, including a wrapped Supabase abort', () => {
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    abort.status = 499;
    const wrapped = new api.DataPlatformResponseError('cancelled', {
      status: 499,
      cause: abort,
    });
    assert.equal(api.isDataPlatformRequestCancellation(abort), true);
    assert.equal(api.isDataPlatformRequestCancellation(wrapped), true);

    const controller = new AbortController();
    controller.abort();
    assert.equal(api.isDataPlatformRequestCancellation(new Error('cleanup'), controller.signal), true);
  });

  await t.test('real authorization, conflict, timeout, server, and network failures stay visible', () => {
    for (const status of [401, 403, 409, 408, 500, 503]) {
      const error = new api.DataPlatformResponseError('actionable failure', { status });
      assert.equal(api.isDataPlatformRequestCancellation(error), false, `status ${status}`);
    }
    assert.equal(api.isDataPlatformRequestCancellation(new TypeError('Failed to fetch')), false);
  });

  await t.test('disabling a comparison/read resource clears its stale popup error', () => {
    const current = {
      data: { preserved: true },
      revision: 7,
      requestId: 'request-1',
      loading: true,
      error: new Error('old inactive comparison failure'),
    };
    assert.deepEqual(api.inactivePrimaryResourceState(current), {
      data: { preserved: true },
      revision: 7,
      requestId: 'request-1',
      loading: false,
      error: null,
    });

    const source = fs.readFileSync(API_PATH, 'utf8');
    assert.match(source, /if\s*\(!enabled\)\s*\{[\s\S]*?generation\.current\s*\+=\s*1[\s\S]*?inactivePrimaryResourceState/iu);
    assert.match(source, /isDataPlatformRequestCancellation\(error,\s*controller\.signal\)/u);
  });
});
