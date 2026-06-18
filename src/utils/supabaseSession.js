import { supabase } from './supabaseClient';

const SESSION_REFRESH_MARGIN_MS = 2 * 60 * 1000;
let refreshPromise = null;

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
  const shouldRefresh = force || (expiresAtMs && expiresAtMs - Date.now() <= SESSION_REFRESH_MARGIN_MS);
  if (!shouldRefresh) return session;

  if (!refreshPromise) {
    refreshPromise = supabase.auth.refreshSession()
      .then((result) => result?.data?.session || session)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function invokeDashboardApi(action, payload = {}, { retryAuth = true } = {}) {
  await ensureFreshSupabaseSession();
  let result = await supabase.functions.invoke('ll-dashboard-api', {
    body: { action, payload },
  });

  if (retryAuth && result?.error && isSupabaseAuthFailure(result.error)) {
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
