import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dummy-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'dummy-key';

let supabaseInstance;

if (!window.__SUPABASE_CLIENT__) {
    const customFetch = (url, options) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.warn(`Supabase fetch timeout exceeded for url: ${url}`);
            controller.abort();
        }, 8000); // 8 seconds global timeout

        if (options && options.signal) {
            options.signal.addEventListener('abort', () => controller.abort());
        }

        return fetch(url, { ...options, signal: controller.signal })
            .finally(() => clearTimeout(timeoutId));
    };

    window.__SUPABASE_CLIENT__ = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            storageKey: 'sb-iota-auth-token'
        },
        global: {
            fetch: customFetch
        }
    });
}
supabaseInstance = window.__SUPABASE_CLIENT__;

export const supabase = supabaseInstance;
