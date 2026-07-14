const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const AUTH_CONTEXT_PATH = path.join(ROOT, 'src', 'context', 'AuthContext.jsx');
const SESSION_PATH = path.join(ROOT, 'src', 'utils', 'supabaseSession.js');
const CLIENT_PATH = path.join(ROOT, 'src', 'utils', 'supabaseClient.js');

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key) {
    return this.values.has(String(key)) ? this.values.get(String(key)) : null;
  }

  key(index) {
    return [...this.values.keys()][index] || null;
  }

  removeItem(key) {
    this.values.delete(String(key));
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }
}

function extractCallBlock(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing marker: ${marker}`);
  const open = source.indexOf('{', start);
  assert.notEqual(open, -1, `missing block: ${marker}`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated block: ${marker}`);
}

function guardDuration(promise, timeoutMs = 300) {
  let timeoutId;
  const guard = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`test guard exceeded ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timeoutId));
}

const sessionStorage = new MemoryStorage();
const localStorage = new MemoryStorage();
const fakeSupabase = {
  auth: {},
  functions: {},
};

global.window = {
  __SUPABASE_CLIENT__: fakeSupabase,
  sessionStorage,
  localStorage,
  setTimeout,
  clearTimeout,
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { onLine: true },
});

function activeSession(overrides = {}) {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 'user-1', email: 'user@igisam.com' },
    ...overrides,
  };
}

function resetFakeSupabase(session = activeSession()) {
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
  fakeSupabase.auth.getSession = async () => ({ data: { session }, error: null });
  fakeSupabase.auth.refreshSession = async () => ({ data: { session }, error: null });
  fakeSupabase.functions.invoke = async () => ({ data: { ok: true }, error: null });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { onLine: true },
  });
}

async function loadSessionModule(label) {
  const url = `${pathToFileURL(SESSION_PATH).href}?network-auth-test=${encodeURIComponent(label)}-${Date.now()}-${Math.random()}`;
  return import(url);
}

test('network and auth lifecycle contracts', async (t) => {
  await t.test('auth state callback is synchronous and defers Supabase work', () => {
    const source = fs.readFileSync(AUTH_CONTEXT_PATH, 'utf8');
    const callback = extractCallBlock(source, 'supabase.auth.onAuthStateChange(');
    assert.doesNotMatch(callback, /onAuthStateChange\(async\s*\(/u);
    assert.match(callback, /deferAuthStateWork\(async\s*\(\)\s*=>\s*\{[\s\S]*await\s+fetchMemberInfo/u);
  });

  await t.test('custom fetch bounds refresh and does not refresh a permission-only 403', () => {
    const source = fs.readFileSync(CLIENT_PATH, 'utf8');
    assert.match(source, /withPromiseDeadline\(/u);
    assert.match(source, /response\.status\s*===\s*401/u);
    assert.doesNotMatch(source, /response\.status\s*===\s*401\s*\|\|\s*response\.status\s*===\s*403/u);
  });

  await t.test('the full invoke deadline also bounds a hung session refresh', async () => {
    const session = activeSession({ expires_at: Math.floor(Date.now() / 1000) + 30 });
    resetFakeSupabase(session);
    let invokeCount = 0;
    fakeSupabase.auth.refreshSession = () => new Promise(() => {});
    fakeSupabase.functions.invoke = async () => {
      invokeCount += 1;
      return { data: { ok: true }, error: null };
    };
    const { invokeDashboardApi } = await loadSessionModule('hung-refresh');

    await assert.rejects(
      guardDuration(invokeDashboardApi('dashboard/home/read', {}, { timeoutMs: 35, retryAuth: false })),
      (error) => error?.name === 'DashboardInvokeTimeoutError' && error?.status === 408,
    );
    assert.equal(invokeCount, 0);
  });

  await t.test('the hard deadline settles even when the invoked operation ignores abort', async () => {
    resetFakeSupabase();
    fakeSupabase.functions.invoke = () => new Promise(() => {});
    const { invokeDashboardApi } = await loadSessionModule('hung-invoke');

    await assert.rejects(
      guardDuration(invokeDashboardApi('sector-market/read', {}, { timeoutMs: 30, retryAuth: false })),
      (error) => error?.name === 'DashboardInvokeTimeoutError' && error?.status === 408,
    );
  });

  await t.test('an external AbortSignal stops the caller without a retry', async () => {
    resetFakeSupabase();
    let invokeCount = 0;
    fakeSupabase.functions.invoke = () => {
      invokeCount += 1;
      return new Promise(() => {});
    };
    const controller = new AbortController();
    const { invokeDashboardApi } = await loadSessionModule('external-abort');
    const pending = invokeDashboardApi('data-management/views', {}, {
      timeoutMs: 1000,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 10);

    await assert.rejects(
      guardDuration(pending),
      (error) => error?.name === 'AbortError',
    );
    assert.equal(invokeCount, 1);
  });

  await t.test('403 and offline failures do not retry', async () => {
    resetFakeSupabase();
    let invokeCount = 0;
    fakeSupabase.functions.invoke = async () => {
      invokeCount += 1;
      return { data: null, error: { status: 403, message: 'Forbidden' } };
    };
    let module = await loadSessionModule('forbidden');
    const forbiddenResult = await guardDuration(module.invokeDashboardApi('data-management/views'));
    assert.equal(forbiddenResult.error.status, 403);
    assert.equal(invokeCount, 1);

    resetFakeSupabase();
    invokeCount = 0;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { onLine: false },
    });
    fakeSupabase.functions.invoke = async () => {
      invokeCount += 1;
      return { data: null, error: { message: 'Failed to fetch' } };
    };
    module = await loadSessionModule('offline');
    const offlineResult = await guardDuration(module.invokeDashboardApi('sector-market/read'));
    assert.match(offlineResult.error.message, /failed to fetch/iu);
    assert.equal(invokeCount, 1);
  });

  await t.test('401 refreshes once and preserves the successful response shape', async () => {
    resetFakeSupabase();
    let invokeCount = 0;
    let refreshCount = 0;
    fakeSupabase.auth.refreshSession = async () => {
      refreshCount += 1;
      return { data: { session: activeSession() }, error: null };
    };
    fakeSupabase.functions.invoke = async () => {
      invokeCount += 1;
      if (invokeCount === 1) return { data: null, error: { status: 401, message: 'JWT expired' } };
      return { data: { ok: true, data: { value: 7 } }, error: null };
    };
    const { invokeDashboardApi } = await loadSessionModule('unauthorized');
    const result = await guardDuration(invokeDashboardApi('dashboard/home/read'));

    assert.deepEqual(result, { data: { ok: true, data: { value: 7 } }, error: null });
    assert.equal(invokeCount, 2);
    assert.equal(refreshCount, 1);
  });
});
