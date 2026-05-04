import { supabase } from './supabaseClient';

export const fetchWithRetry = async (queryFn, maxRetries = 3, delayMs = 500) => {
    let lastError = null;
    for (let i = 0; i < maxRetries; i++) {
        const { data, error } = await queryFn();
        if (!error) return { data, error: null };
        
        lastError = error;
        // If it's a lock stolen error or network issue, retry
        if (error.message && error.message.includes('Lock') || error.message.includes('fetch')) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
        }
        
        // Break early for auth/RLS errors since they won't succeed on retry
        if (error.code && (error.code.startsWith('PGRST') || error.status === 401 || error.status === 403)) {
            break;
        }
    }
    return { data: null, error: lastError };
};
