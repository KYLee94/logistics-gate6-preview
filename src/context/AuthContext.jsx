import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [memberInfo, setMemberInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch current session and setup listener
        const initializeAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
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
                setLoading(false);
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                setUser(session.user);
                await fetchMemberInfo(session.user.email);
            } else {
                setUser(null);
                setMemberInfo(null);
            }
            setLoading(false);
        });

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
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
