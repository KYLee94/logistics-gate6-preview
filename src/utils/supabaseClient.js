import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dummy-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'dummy-key';

let supabaseInstance;

if (!window.__SUPABASE_CLIENT__) {
    window.__SUPABASE_CLIENT__ = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            storageKey: 'sb-iota-auth-token'
        }
    });
}
supabaseInstance = window.__SUPABASE_CLIENT__;

export const supabase = supabaseInstance;
