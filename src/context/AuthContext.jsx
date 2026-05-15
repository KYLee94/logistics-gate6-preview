/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

const AuthContext = createContext();

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const LOGISTICS_DEMO_USER = {
    id: 'logistics-demo-user',
    email: '10524@igisam.com',
};
const LOGISTICS_DEMO_MEMBER = {
    id: 'logistics-demo-member',
    auth_id: 'logistics-demo-user',
    email: '10524@igisam.com',
    staff_name: '이시정',
    name: '이시정',
    organization: '기획추진센터',
    department: '기획추진센터',
    team_name: '기획추진센터',
    role_code: 'master',
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [memberInfo, setMemberInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recoveryMode, setRecoveryMode] = useState(false);

    // Shared signout logic to avoid dependency issues in useEffect
    const handleSignOut = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Error during sign out:", error);
        } finally {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sb-')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
            localStorage.removeItem('iota_last_activity');
            setUser(LOGISTICS_DEMO_USER);
            setMemberInfo(LOGISTICS_DEMO_MEMBER);
            window.location.href = import.meta.env.BASE_URL + 'platform/iotaseoul/workspace/logistics';
        }
    };

    // Activity tracking for session timeout
    useEffect(() => {
        // Update activity immediately
        localStorage.setItem('iota_last_activity', Date.now().toString());

        // Continuously update activity every 1 minute as long as the app is open.
        // This ensures the user is NEVER logged out while the browser tab is open.
        const activityIntervalId = setInterval(() => {
            localStorage.setItem('iota_last_activity', Date.now().toString());
        }, 60000);

        return () => {
            clearInterval(activityIntervalId);
        };
    }, []);

    useEffect(() => {
        // Fetch current session and setup listener
        let subscription;

        const initializeAuth = async () => {
            let timeoutId;
            try {
                // Check timeout before attempting to load session
                const lastActivityStr = localStorage.getItem('iota_last_activity');
                if (lastActivityStr) {
                    const lastActivity = parseInt(lastActivityStr, 10);
                    if (Date.now() - lastActivity > TIMEOUT_MS) {
                        localStorage.removeItem('iota_last_activity');
                        await handleSignOut();
                        return; // Stop initialization
                    }
                }

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
                    setUser(LOGISTICS_DEMO_USER);
                    setMemberInfo(LOGISTICS_DEMO_MEMBER);
                }
            } catch (err) {
                console.error("Auth initialization error:", err);
            } finally {
                clearTimeout(timeoutId);
                setLoading(false);
                
                // Only subscribe AFTER initial session is loaded to prevent concurrent lock conflicts
                const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
                    if (event === 'PASSWORD_RECOVERY') {
                        setRecoveryMode(true);
                    }

                    if (session?.user) {
                        setUser(session.user);
                        await fetchMemberInfo(session.user.email);
                    } else {
                        setUser(LOGISTICS_DEMO_USER);
                        setMemberInfo(LOGISTICS_DEMO_MEMBER);
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
            } else {
                setMemberInfo(LOGISTICS_DEMO_MEMBER);
            }
        } catch (err) {
            console.error("Failed to fetch member info", err);
            setMemberInfo(LOGISTICS_DEMO_MEMBER);
        }
    };

    return (
        <AuthContext.Provider value={{ user, memberInfo, loading, signOut: handleSignOut, recoveryMode, setRecoveryMode }}>
            {loading ? (
                <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center bg-[#FDFDFD] dark:bg-[#111111] z-[99999]">
                    <div className="w-6 h-6 relative mb-5 animate-spin">
                        <div className="absolute top-0 left-1/2 -ml-[3px] w-[6px] h-[6px] bg-[#111] dark:bg-white rounded-full"></div>
                    </div>
                    <span className="text-[#86868B] dark:text-[#A1A1AA] text-[14px] font-medium tracking-tight">데이터를 불러오고 있습니다...</span>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
