import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [memberInfo, setMemberInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch current session and setup listener
        let subscription;

        const initializeAuth = async () => {
            let timeoutId;
            try {
                timeoutId = setTimeout(() => {
                    console.error("Auth initialization timed out! Forcing load.");
                    setLoading(false);
                }, 5000);

                const { data: { session } } = await supabase.auth.getSession();
                clearTimeout(timeoutId);

                if (session?.user) {
                    setUser(session.user);
                    await fetchMemberInfo(session.user.email);
                } else {
                    setUser(null);
                    setMemberInfo(null);
                }
            } catch (err) {
                console.error("Auth initialization error:", err);
            } finally {
                clearTimeout(timeoutId);
                setLoading(false);
                
                // Only subscribe AFTER initial session is loaded to prevent concurrent lock conflicts
                const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
                    if (session?.user) {
                        setUser(session.user);
                        await fetchMemberInfo(session.user.email);
                    } else {
                        setUser(null);
                        setMemberInfo(null);
                    }
                    setLoading(false);
                });
                subscription = data.subscription;
            }
        };

        initializeAuth();

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    const fetchMemberInfo = async (email) => {
        try {
            const { data, error } = await supabase
                .from('iota_seoul_pilot_members')
                .select('*')
                .eq('email', email)
                .single();
                
            if (data && !error) {
                setMemberInfo(data);
            }
        } catch (err) {
            console.error("Failed to fetch member info", err);
        }
    };

    const signOut = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Error during sign out:", error);
        } finally {
            // Force clean up any corrupted supabase tokens in local storage
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sb-')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
            setUser(null);
            setMemberInfo(null);
            // Hard redirect to login page to clear all React states
            window.location.href = import.meta.env.BASE_URL + 'auth-setup';
        }
    };

    return (
        <AuthContext.Provider value={{ user, memberInfo, loading, signOut }}>
            {loading ? (
                <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center bg-[#F5F5F7] dark:bg-[#1C1C1E] z-[99999]">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0071E3] mb-4"></div>
                    <span className="text-[#86868B] text-sm font-medium">인증 정보를 확인하는 중입니다...</span>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
