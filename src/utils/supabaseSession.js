import { supabase } from './supabaseClient';

const SESSION_REFRESH_MARGIN_MS = 10 * 60 * 1000;
const SESSION_IDLE_FORCE_REFRESH_MS = 5 * 60 * 1000;
const DASHBOARD_INVOKE_TIMEOUT_MS = 45 * 1000;
let refreshPromise = null;
let lastSessionCheckAt = 0;

function authFailureMessage(error) {
  return String(error?.message || error?.error_description || error?.name || '').toLowerCase();
}

function readJsonStorageValue(key) {
  if (typeof window === 'undefined') return null;
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      return JSON.parse(raw);
    } catch {
      // Ignore malformed storage written by previous builds.
    }
  }
  return null;
}

function readSupabaseStorageSession() {
  if (typeof window === 'undefined') return null;
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
        const parsed = JSON.parse(storage.getItem(key) || 'null');
        return parsed?.currentSession || parsed?.session || parsed;
      }
    } catch {
      // Keep scanning other storage locations.
    }
  }
  return null;
}

export function getDashboardCacheScope() {
  if (typeof window === 'undefined') return 'server';
  const previewAuth = readJsonStorageValue('logistics_preview_auth');
  const storedSession = readSupabaseStorageSession();
  const email = String(
    previewAuth?.email
    || storedSession?.user?.email
    || storedSession?.user?.user_metadata?.email
    || 'anonymous',
  ).trim().toLowerCase();
  const userId = String(storedSession?.user?.id || '').trim();
  return `${email || 'anonymous'}:${userId || 'no-user-id'}`;
}

function timeoutError(action, timeoutMs) {
  const error = new Error(`${action} timed out after ${timeoutMs}ms`);
  error.name = 'DashboardInvokeTimeoutError';
  error.status = 408;
  return error;
}

async function withDashboardInvokeTimeout(action, promise, timeoutMs) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = globalThis.setTimeout(() => reject(timeoutError(action, timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export function isSupabaseAuthFailure(error) {
  const status = Number(error?.status || error?.context?.status || error?.statusCode || 0);
  const message = authFailureMessage(error);
  return status === 401
    || status === 403
    || message.includes('jwt')
    || message.includes('token')
    || message.includes('expired')
    || message.includes('unauthorized')
    || message.includes('forbidden');
}

export async function ensureFreshSupabaseSession({ force = false, throwOnFailure = false } = {}) {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    if (throwOnFailure) throw error;
    return null;
  }

  const session = data?.session || null;
  if (!session?.refresh_token) return session;

  const expiresAtMs = Number(session.expires_at || 0) * 1000;
  const now = Date.now();
  const expiredSoon = !expiresAtMs || expiresAtMs - now <= SESSION_REFRESH_MARGIN_MS;
  const idleTooLong = Boolean(lastSessionCheckAt) && now - lastSessionCheckAt >= SESSION_IDLE_FORCE_REFRESH_MS;
  const shouldRefresh = force
    || expiredSoon
    || idleTooLong;
  if (!shouldRefresh) {
    lastSessionCheckAt = now;
    return session;
  }

  if (!refreshPromise) {
    refreshPromise = supabase.auth.refreshSession()
      .then((result) => {
        if (result?.error) throw result.error;
        lastSessionCheckAt = Date.now();
        return result?.data?.session || session;
      })
      .catch((refreshError) => {
        console.warn('Supabase session refresh failed:', refreshError?.message || refreshError);
        lastSessionCheckAt = Date.now();
        if (throwOnFailure) throw refreshError;
        return session;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function shouldRetryDashboardInvoke(error) {
  const message = authFailureMessage(error);
  return isSupabaseAuthFailure(error)
    || message.includes('failed to fetch')
    || message.includes('network')
    || message.includes('timeout')
    || message.includes('aborted')
    || message.includes('load failed');
}

export async function invokeDashboardApi(action, payload = {}, { retryAuth = true } = {}) {
  await ensureFreshSupabaseSession();
  let result;
  try {
    result = await withDashboardInvokeTimeout(action, supabase.functions.invoke('ll-dashboard-api', {
      body: { action, payload },
    }), DASHBOARD_INVOKE_TIMEOUT_MS);
  } catch (invokeError) {
    if (!retryAuth || !shouldRetryDashboardInvoke(invokeError)) throw invokeError;
    await ensureFreshSupabaseSession({ force: true, throwOnFailure: true });
    return withDashboardInvokeTimeout(action, supabase.functions.invoke('ll-dashboard-api', {
      body: { action, payload },
    }), DASHBOARD_INVOKE_TIMEOUT_MS);
  }

  if (retryAuth && result?.error && shouldRetryDashboardInvoke(result.error)) {
    await ensureFreshSupabaseSession({ force: true, throwOnFailure: true });
    result = await withDashboardInvokeTimeout(action, supabase.functions.invoke('ll-dashboard-api', {
      body: { action, payload },
    }), DASHBOARD_INVOKE_TIMEOUT_MS);
  }

  return result;
}

export async function signOutSupabaseLocal({ timeoutMs = 2500 } = {}) {
  const signOutPromise = supabase.auth.signOut({ scope: 'local' });
  const timeoutPromise = new Promise((resolve) => {
    window.setTimeout(() => resolve({ timedOut: true }), timeoutMs);
  });
  return Promise.race([signOutPromise, timeoutPromise]);
}
