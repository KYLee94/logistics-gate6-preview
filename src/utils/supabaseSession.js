import { supabase } from './supabaseClient';

const SESSION_REFRESH_MARGIN_MS = 10 * 60 * 1000;
const SESSION_IDLE_FORCE_REFRESH_MS = 5 * 60 * 1000;
let refreshPromise = null;
let lastSessionCheckAt = 0;

function authFailureMessage(error) {
  return String(error?.message || error?.error_description || error?.name || '').toLowerCase();
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

export async function ensureFreshSupabaseSession({ force = false } = {}) {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;

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
        lastSessionCheckAt = Date.now();
        return result?.data?.session || session;
      })
      .catch((refreshError) => {
        console.warn('Supabase session refresh failed:', refreshError?.message || refreshError);
        lastSessionCheckAt = Date.now();
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
  let result = await supabase.functions.invoke('ll-dashboard-api', {
    body: { action, payload },
  });

  if (retryAuth && result?.error && shouldRetryDashboardInvoke(result.error)) {
    await ensureFreshSupabaseSession({ force: true });
    result = await supabase.functions.invoke('ll-dashboard-api', {
      body: { action, payload },
    });
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
