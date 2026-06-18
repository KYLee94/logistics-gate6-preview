import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dummy-url.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'dummy-key';

let supabaseInstance;

if (!window.__SUPABASE_CLIENT__) {
    const customFetch = (url, options = {}) => {
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

        return fetch(url, { ...options, signal: controller.signal })
            .then(async (response) => {
                if (!isAuthRequest && isFunctionRequest && (response.status === 401 || response.status === 403)) {
                    try {
                        const refreshResult = await window.__SUPABASE_CLIENT__?.auth?.refreshSession?.();
                        const accessToken = refreshResult?.data?.session?.access_token;
                        if (accessToken) {
                            const headers = new Headers(options.headers || {});
                            headers.set('authorization', `Bearer ${accessToken}`);
                            return fetch(url, { ...options, headers });
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
