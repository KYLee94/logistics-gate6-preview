import { supabase } from './supabaseClient.js';

const SESSION_REFRESH_MARGIN_MS = 10 * 60 * 1000;
const SESSION_RECENT_CHECK_REUSE_MS = 15 * 1000;
const DASHBOARD_INVOKE_TIMEOUT_MS = 45 * 1000;
const AUTH_SESSION_TIMEOUT_MS = 3500;
const AUTH_REFRESH_TIMEOUT_MS = 5000;
const DASHBOARD_PERMISSION_IDENTITY_KEY = 'logisticsDashboardPermissionIdentity:v1';
const DASHBOARD_PERMISSION_CACHE_KEYS = [
  'logisticsFeatureAccessConfig',
  'logisticsFeatureAccessUsers:v1',
  'logisticsLoginHistory:v2',
];
const ACTIVE_ACCOUNT_STATUS = 'active';
let refreshOperationPromise = null;
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

function readJwtSubject(accessToken) {
  try {
    const payload = String(accessToken || '').split('.')[1];
    if (!payload) return '';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = typeof atob === 'function'
      ? atob(normalized)
      : typeof globalThis.Buffer?.from === 'function'
        ? globalThis.Buffer.from(normalized, 'base64').toString('utf8')
        : '';
    const subject = JSON.parse(decoded)?.sub;
    return typeof subject === 'string' ? subject.trim() : '';
  } catch {
    return '';
  }
}

function verifiedSessionSubject(session) {
  const userId = String(session?.user?.id || '').trim();
  const tokenSubject = readJwtSubject(session?.access_token);
  if (userId && tokenSubject && userId === tokenSubject) return tokenSubject;
  return '';
}

function permissionRevision(memberInfo = {}) {
  return String(
    memberInfo?.permission_revision
    ?? memberInfo?.permissionRevision
    ?? memberInfo?.permissions_updated_at
    ?? memberInfo?.updated_at
    ?? memberInfo?.profile_payload?.permission_revision
    ?? '',
  ).trim();
}

function permissionAccountStatus(memberInfo = {}) {
  return String(memberInfo?.account_status ?? memberInfo?.accountStatus ?? 'unknown').trim().toLowerCase() || 'unknown';
}

function permissionFingerprint(memberInfo = {}) {
  const permissions = memberInfo?.feature_permissions;
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) return 'none';
  return Object.keys(permissions)
    .sort()
    .map((key) => `${key}:${permissions[key] === true ? '1' : '0'}`)
    .join(',') || 'none';
}

function clearDashboardPermissionStorage() {
  if (typeof window === 'undefined') return;
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      storage.removeItem(DASHBOARD_PERMISSION_IDENTITY_KEY);
      DASHBOARD_PERMISSION_CACHE_KEYS.forEach((key) => storage.removeItem(key));
    } catch {
      // Storage cleanup is best effort and must never block authentication.
    }
  }
}

export function invalidateDashboardPermissionCache() {
  lastSessionCheckAt = 0;
  clearDashboardPermissionStorage();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('logistics-permission-cache-invalidated'));
  }
}

export function setDashboardPermissionCacheIdentity(session, memberInfo = {}) {
  if (typeof window === 'undefined') return null;
  const subject = verifiedSessionSubject(session);
  const accountStatus = permissionAccountStatus(memberInfo);
  if (!subject || accountStatus !== ACTIVE_ACCOUNT_STATUS) {
    invalidateDashboardPermissionCache();
    return null;
  }

  const nextIdentity = {
    subject,
    permission_revision: permissionRevision(memberInfo),
    account_status: accountStatus,
    feature_permissions: permissionFingerprint(memberInfo),
  };
  const nextSignature = JSON.stringify(nextIdentity);
  let previousSignature = '';
  try {
    previousSignature = window.sessionStorage.getItem(DASHBOARD_PERMISSION_IDENTITY_KEY) || '';
  } catch {
    // Session storage may be unavailable in privacy-restricted browser contexts.
  }
  if (previousSignature && previousSignature !== nextSignature) clearDashboardPermissionStorage();
  try {
    window.sessionStorage.setItem(DASHBOARD_PERMISSION_IDENTITY_KEY, nextSignature);
  } catch {
    // The cache scope safely falls back to the session subject below.
  }
  return nextIdentity;
}

export function getDashboardCacheScope() {
  if (typeof window === 'undefined') return 'server';
  const storedSession = readSupabaseStorageSession();
  const subject = verifiedSessionSubject(storedSession);
  if (!subject) return 'anonymous';
  const cachedIdentity = readJsonStorageValue(DASHBOARD_PERMISSION_IDENTITY_KEY);
  if (cachedIdentity?.subject !== subject || cachedIdentity?.account_status !== ACTIVE_ACCOUNT_STATUS) {
    return `sub:${subject}:permission-unverified`;
  }
  return `sub:${subject}:revision:${cachedIdentity.permission_revision || 'none'}:status:${cachedIdentity.account_status || 'unknown'}:features:${cachedIdentity.feature_permissions || 'none'}`;
}

export function createReturnRevalidationGate(revalidate, {
  minimumIntervalMs = 1000,
  now = () => Date.now(),
} = {}) {
  let inFlight = null;
  let lastSuccessAt = 0;
  let lastResult;

  return function queueReturnRevalidation() {
    if (inFlight) return inFlight;
    if (lastSuccessAt && now() - lastSuccessAt < minimumIntervalMs) {
      return Promise.resolve(lastResult);
    }

    try {
      inFlight = Promise.resolve(revalidate())
        .then((result) => {
          lastResult = result;
          lastSuccessAt = now();
          return result;
        })
        .finally(() => {
          inFlight = null;
        });
    } catch (error) {
      return Promise.reject(error);
    }
    return inFlight;
  };
}

function timeoutError(action, timeoutMs) {
  const error = new Error(`${action} timed out after ${timeoutMs}ms`);
  error.name = 'DashboardInvokeTimeoutError';
  error.status = 408;
  return error;
}

function abortError(action, signal) {
  if (signal?.reason instanceof Error) return signal.reason;
  const error = new Error(`${action} aborted`);
  error.name = 'AbortError';
  error.status = 499;
  return error;
}

function authTimeoutError(action, timeoutMs) {
  const error = new Error(`${action} timed out after ${timeoutMs}ms`);
  error.name = 'SupabaseAuthTimeoutError';
  error.status = 408;
  return error;
}

async function withDeadline(action, operationFactory, timeoutMs, {
  signal = null,
  errorFactory = timeoutError,
} = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timeoutId;
  let externalAbortListener;
  let rejectBoundary;
  const boundaryPromise = new Promise((_, reject) => {
    rejectBoundary = reject;
  });

  const rejectForAbort = () => {
    const error = abortError(action, signal);
    if (controller && !controller.signal.aborted) controller.abort(error);
    rejectBoundary(error);
  };

  if (signal) {
    externalAbortListener = rejectForAbort;
    if (signal.aborted) rejectForAbort();
    else signal.addEventListener('abort', externalAbortListener, { once: true });
  }

  if (timeoutMs > 0) {
    timeoutId = globalThis.setTimeout(() => {
      const error = errorFactory(action, timeoutMs);
      if (controller && !controller.signal.aborted) controller.abort(error);
      rejectBoundary(error);
    }, timeoutMs);
  }

  const operationPromise = Promise.resolve().then(() => {
    const operationSignal = controller?.signal || signal;
    if (operationSignal?.aborted) throw abortError(action, operationSignal);
    return operationFactory(operationSignal);
  });
  try {
    return await Promise.race([operationPromise, boundaryPromise]);
  } finally {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
    if (externalAbortListener) signal?.removeEventListener('abort', externalAbortListener);
  }
}

function withDashboardInvokeTimeout(action, invokeFactory, timeoutMs, signal = null) {
  return withDeadline(action, invokeFactory, timeoutMs, { signal, errorFactory: timeoutError });
}

function withAuthTimeout(action, operationFactory, timeoutMs, signal = null) {
  return withDeadline(action, operationFactory, timeoutMs, { signal, errorFactory: authTimeoutError });
}

function browserIsOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function errorStatus(error) {
  const status = Number(error?.status || error?.context?.status || error?.statusCode || 0);
  return Number.isFinite(status) ? status : 0;
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

export async function ensureFreshSupabaseSession({ force = false, throwOnFailure = false, signal = null } = {}) {
  if (signal?.aborted) throw abortError('supabase.auth.getSession', signal);
  const now = Date.now();
  if (!force && lastSessionCheckAt && now - lastSessionCheckAt < SESSION_RECENT_CHECK_REUSE_MS) {
    return readSupabaseStorageSession();
  }
  let sessionResult;
  try {
    sessionResult = await withAuthTimeout('supabase.auth.getSession', () => supabase.auth.getSession(), AUTH_SESSION_TIMEOUT_MS, signal);
  } catch (sessionError) {
    if (signal?.aborted || sessionError?.name === 'AbortError') throw sessionError;
    console.warn('Supabase session read timed out:', sessionError?.message || sessionError);
    lastSessionCheckAt = Date.now();
    if (throwOnFailure) throw sessionError;
    return readSupabaseStorageSession();
  }
  const { data, error } = sessionResult || {};
  if (error) {
    if (throwOnFailure) throw error;
    return null;
  }

  const session = data?.session || null;
  if (!session?.refresh_token) {
    lastSessionCheckAt = now;
    return session;
  }

  const expiresAtMs = Number(session.expires_at || 0) * 1000;
  const expiredSoon = !expiresAtMs || expiresAtMs - now <= SESSION_REFRESH_MARGIN_MS;
  const shouldRefresh = force
    || expiredSoon;
  if (!shouldRefresh) {
    lastSessionCheckAt = now;
    return session;
  }

  if (!refreshOperationPromise) {
    refreshOperationPromise = Promise.resolve()
      .then(() => supabase.auth.refreshSession())
      .finally(() => {
        refreshOperationPromise = null;
      });
  }

  try {
    const result = await withAuthTimeout('supabase.auth.refreshSession', () => refreshOperationPromise, AUTH_REFRESH_TIMEOUT_MS, signal);
    if (result?.error) throw result.error;
    lastSessionCheckAt = Date.now();
    return result?.data?.session || session;
  } catch (refreshError) {
    if (signal?.aborted || refreshError?.name === 'AbortError') throw refreshError;
    console.warn('Supabase session refresh failed:', refreshError?.message || refreshError);
    lastSessionCheckAt = Date.now();
    if (throwOnFailure) throw refreshError;
    return session;
  }
}

function shouldRetryDashboardInvoke(error, { retryNetwork = true, retryTimeout = true, signal = null } = {}) {
  if (signal?.aborted || browserIsOffline()) return false;
  const message = authFailureMessage(error);
  const status = errorStatus(error);
  const timeoutLike = message.includes('timeout')
    || message.includes('aborted')
    || error?.name === 'DashboardInvokeTimeoutError';
  const networkLike = message.includes('failed to fetch')
    || message.includes('network')
    || message.includes('load failed');
  if (status === 403 || message.includes('forbidden')) return false;
  if (timeoutLike && !retryTimeout) return false;
  if (networkLike && !retryNetwork) return false;
  return status === 401
    || (isSupabaseAuthFailure(error) && status !== 403)
    || networkLike
    || timeoutLike;
}

function isDashboardReadAction(action) {
  const value = String(action || '').trim().toLowerCase();
  if (!value) return false;
  if ([
    'health',
    'dashboard/read',
    'worklogs',
    'opendart/company',
    'building-register/summary',
    'naver/maps-config',
    'naver/geocode',
    'naver/geocode-batch',
    'naver/reverse-geocode',
  ].includes(value)) return true;
  return /\/(read|list|get|status|catalog|rows|views|view-rows|coverage|preview|readback|latest|evaluate|me)$/.test(value);
}

export async function invokeDashboardApi(action, payload = {}, {
  retryAuth = true,
  forceSessionRefresh = false,
  timeoutMs = DASHBOARD_INVOKE_TIMEOUT_MS,
  retryNetwork = true,
  retryTimeout = true,
  signal = null,
} = {}) {
  return withDashboardInvokeTimeout(action, async (deadlineSignal) => {
    const retryOptions = {
      retryNetwork,
      retryTimeout: retryTimeout && isDashboardReadAction(action),
      signal: deadlineSignal,
    };
    const invokeOnce = () => supabase.functions.invoke('ll-dashboard-api', {
      body: { action, payload },
      signal: deadlineSignal,
      timeout: timeoutMs,
    });

    await ensureFreshSupabaseSession({ force: forceSessionRefresh, signal: deadlineSignal });
    let result;
    try {
      result = await invokeOnce();
    } catch (invokeError) {
      if (!retryAuth || !shouldRetryDashboardInvoke(invokeError, retryOptions)) throw invokeError;
      await ensureFreshSupabaseSession({ force: true, throwOnFailure: true, signal: deadlineSignal });
      return invokeOnce();
    }

    if (retryAuth && result?.error && shouldRetryDashboardInvoke(result.error, retryOptions)) {
      await ensureFreshSupabaseSession({ force: true, throwOnFailure: true, signal: deadlineSignal });
      result = await invokeOnce();
    }
    return result;
  }, timeoutMs, signal);
}

export async function signOutSupabaseLocal({ timeoutMs = 2500 } = {}) {
  const signOutPromise = supabase.auth.signOut({ scope: 'local' });
  const timeoutPromise = new Promise((resolve) => {
    window.setTimeout(() => resolve({ timedOut: true }), timeoutMs);
  });
  return Promise.race([signOutPromise, timeoutPromise]);
}
