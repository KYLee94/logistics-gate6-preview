import { createClient } from '@supabase/supabase-js';

const viteEnv = import.meta.env || {};
const AUTH_FETCH_TIMEOUT_MS = 5000;
const FUNCTION_FETCH_TIMEOUT_MS = 45000;
const DEFAULT_FETCH_TIMEOUT_MS = 15000;

export const supabaseUrl = viteEnv.VITE_SUPABASE_URL || 'https://dummy-url.supabase.co';
export const supabaseAnonKey = viteEnv.VITE_SUPABASE_ANON_KEY || 'dummy-key';

let supabaseInstance;
let functionAuthRetryPromise = null;

function withPromiseDeadline(promise, timeoutMs, label) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            const error = new Error(`${label} timed out after ${timeoutMs}ms`);
            error.name = 'SupabaseAuthTimeoutError';
            error.status = 408;
            reject(error);
        }, timeoutMs);
    });
    return Promise.race([Promise.resolve(promise), timeoutPromise])
        .finally(() => clearTimeout(timeoutId));
}

if (!window.__SUPABASE_CLIENT__) {
    const customFetch = async (url, options = {}) => {
        const requestUrl = typeof url === 'string' ? url : (url?.url || String(url || ''));
        const isAuthRequest = requestUrl.includes('/auth/v1/');
        const isFunctionRequest = requestUrl.includes('/functions/v1/');
        const controller = new AbortController();
        let timeoutId;
        let externalAbortListener;

        if (!options.signal) {
            const timeoutMs = isAuthRequest
                ? AUTH_FETCH_TIMEOUT_MS
                : (isFunctionRequest ? FUNCTION_FETCH_TIMEOUT_MS : DEFAULT_FETCH_TIMEOUT_MS);
            timeoutId = setTimeout(() => {
                console.warn(`Supabase fetch timeout exceeded for url: ${requestUrl}`);
                controller.abort(new Error(`Supabase fetch timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        }

        if (options && options.signal) {
            externalAbortListener = () => controller.abort(options.signal.reason);
            if (options.signal.aborted) externalAbortListener();
            else options.signal.addEventListener('abort', externalAbortListener, { once: true });
        }

        return fetch(url, { ...options, signal: controller.signal })
            .then(async (response) => {
                if (!isAuthRequest && isFunctionRequest && response.status === 401) {
                    try {
                        if (!functionAuthRetryPromise) {
                            functionAuthRetryPromise = withPromiseDeadline(
                                window.__SUPABASE_CLIENT__?.auth?.refreshSession?.(),
                                AUTH_FETCH_TIMEOUT_MS,
                                'supabase.auth.refreshSession',
                            )
                                .finally(() => {
                                    functionAuthRetryPromise = null;
                                });
                        }
                        const refreshResult = await functionAuthRetryPromise;
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
                if (externalAbortListener) options.signal?.removeEventListener('abort', externalAbortListener);
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
