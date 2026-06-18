import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dummy-url.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'dummy-key';

let supabaseInstance;
let functionAuthPrecheckPromise = null;
let lastFunctionAuthPrecheckAt = 0;
const FUNCTION_AUTH_PRECHECK_MS = 5 * 60 * 1000;
const FUNCTION_AUTH_REFRESH_MARGIN_MS = 10 * 60 * 1000;

async function ensureFunctionAuthReady() {
    const client = window.__SUPABASE_CLIENT__;
    if (!client?.auth) return;

    const now = Date.now();
    if (now - lastFunctionAuthPrecheckAt < FUNCTION_AUTH_PRECHECK_MS) return;

    if (!functionAuthPrecheckPromise) {
        functionAuthPrecheckPromise = client.auth.getSession()
            .then(async ({ data }) => {
                const session = data?.session || null;
                if (!session?.refresh_token) {
                    lastFunctionAuthPrecheckAt = Date.now();
                    return;
                }
                const expiresAtMs = Number(session.expires_at || 0) * 1000;
                const expiredSoon = !expiresAtMs || expiresAtMs - Date.now() <= FUNCTION_AUTH_REFRESH_MARGIN_MS;
                const idleTooLong = Boolean(lastFunctionAuthPrecheckAt) && Date.now() - lastFunctionAuthPrecheckAt >= FUNCTION_AUTH_PRECHECK_MS;
                if (expiredSoon || idleTooLong) {
                    await client.auth.refreshSession();
                }
                lastFunctionAuthPrecheckAt = Date.now();
            })
            .catch((error) => {
                console.warn('Supabase function auth precheck failed:', error?.message || error);
                lastFunctionAuthPrecheckAt = Date.now();
            })
            .finally(() => {
                functionAuthPrecheckPromise = null;
            });
    }

    await functionAuthPrecheckPromise;
}

if (!window.__SUPABASE_CLIENT__) {
    const customFetch = async (url, options = {}) => {
        const requestUrl = typeof url === 'string' ? url : (url?.url || String(url || ''));
        const isAuthRequest = requestUrl.includes('/auth/v1/');
        const isFunctionRequest = requestUrl.includes('/functions/v1/');
        const controller = new AbortController();
        let timeoutId;

        // Keep auth requests unbounded so token refresh is not aborted after the tab is idle.
        // Edge Functions can cold-start after idle, so they need a longer request window.
        if (!isAuthRequest) {
            timeoutId = setTimeout(() => {
                console.warn(`Supabase fetch timeout exceeded for url: ${requestUrl}`);
                controller.abort();
            }, isFunctionRequest ? 45000 : 15000);
        }

        if (options && options.signal) {
            options.signal.addEventListener('abort', () => controller.abort());
        }

        if (isFunctionRequest && !isAuthRequest) {
            await ensureFunctionAuthReady();
        }

        return fetch(url, { ...options, signal: controller.signal })
            .then(async (response) => {
                if (!isAuthRequest && isFunctionRequest && (response.status === 401 || response.status === 403)) {
                    try {
                        const refreshResult = await window.__SUPABASE_CLIENT__?.auth?.refreshSession?.();
                        lastFunctionAuthPrecheckAt = Date.now();
                        const accessToken = refreshResult?.data?.session?.access_token;
                        if (accessToken) {
                            const headers = new Headers(options.headers || {});
                            headers.set('authorization', `Bearer ${accessToken}`);
                            return fetch(url, { ...options, headers, signal: controller.signal });
                        }
                    } catch (error) {
                        console.warn('Supabase auth refresh retry failed:', error?.message || error);
                    }
                }
                return response;
            })
            .finally(() => {
                if (timeoutId) clearTimeout(timeoutId);
            });
    };

    window.__SUPABASE_CLIENT__ = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            storageKey: 'sb-iota-auth-token',
            storage: window.sessionStorage,
            persistSession: true,
            autoRefreshToken: true,
        },
        global: {
            fetch: customFetch
        }
    });
}
supabaseInstance = window.__SUPABASE_CLIENT__;

export const supabase = supabaseInstance;
