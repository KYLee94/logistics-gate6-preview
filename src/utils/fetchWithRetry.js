import { supabase } from './supabaseClient';

export const fetchWithRetry = async (queryFn, maxRetries = 3, delayMs = 500) => {
    let lastError = null;
    for (let i = 0; i < maxRetries; i++) {
        let data = null, error = null;
        try {
            // Add a timeout to prevent infinite hangs if Supabase lock is deadlocked
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Query timeout - possible Lock deadlock')), 5000);
            });
            const result = await Promise.race([queryFn(), timeoutPromise]);
            data = result.data;
            error = result.error;
        } catch (err) {
            // Supabase occasionally throws the Lock error as an exception instead of returning it
            // Or our timeout triggers
            error = err;
        }

        if (!error) return { data, error: null };
        
        lastError = error;
        // If it's a lock stolen error or network issue, retry
        if ((error.message && error.message.includes('Lock')) || (error.message && error.message.includes('fetch'))) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
        }
        
        // Break early for auth/RLS errors since they won't succeed on retry
        if (error.code && (error.code.startsWith('PGRST') || error.status === 401 || error.status === 403)) {
            break;
        }
    }
    // If we exhausted retries and it's STILL a lock error, we simply return the error.
    // NEVER forcefully log the user out or nuke storage here. Let the UI handle the error state gracefully.
    if (lastError && lastError.message && lastError.message.includes('Lock')) {
        console.warn('Supabase Lock error persisted after retries. Returning error to UI instead of crashing.');
    }

    return { data: null, error: lastError };
};
