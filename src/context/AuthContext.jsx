/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import logisticsPermissionData from '../components/system/workspace/logisticsPermissionData.json';

const AuthContext = createContext();

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const LOGISTICS_PERMISSION_USERS = logisticsPermissionData.users || [];
const LOGISTICS_EMAIL_ALIASES = { '10524@igisam.com': 'kylee@igisam.com' };
const canonicalLogisticsEmail = (email) => LOGISTICS_EMAIL_ALIASES[String(email || '').trim().toLowerCase()] || String(email || '').trim().toLowerCase();
const LOGISTICS_ALLOWED_EMAILS = new Set([
    ...LOGISTICS_PERMISSION_USERS.map((user) => String(user.email || '').trim().toLowerCase()).filter(Boolean),
    ...Object.keys(LOGISTICS_EMAIL_ALIASES),
]);

function logisticsMemberFromPermission(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const permissionEmail = canonicalLogisticsEmail(normalizedEmail);
    const user = LOGISTICS_PERMISSION_USERS.find((item) => String(item.email || '').trim().toLowerCase() === permissionEmail);
    if (!user) return null;
    return {
        id: `logistics-permission-${normalizedEmail}`,
        auth_id: null,
        email: normalizedEmail,
        permission_email: permissionEmail,
        staff_name: user.name,
        name: user.name,
        organization: user.organization,
        department: user.organization,
        team_name: user.organization,
        role_code: user.organization === '기획추진센터' ? 'master' : 'member',
    };
}

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
            setUser(null);
            setMemberInfo(null);
            window.location.href = import.meta.env.BASE_URL + 'auth-setup';
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
                    const sessionEmail = String(session.user.email || '').trim().toLowerCase();
                    if (!LOGISTICS_ALLOWED_EMAILS.has(sessionEmail)) {
                        await handleSignOut();
                        return;
                    }
                    setUser(session.user);
                    await fetchMemberInfo(sessionEmail);
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
                    if (event === 'PASSWORD_RECOVERY') {
                        setRecoveryMode(true);
                    }

                    if (session?.user) {
                        const sessionEmail = String(session.user.email || '').trim().toLowerCase();
                        if (!LOGISTICS_ALLOWED_EMAILS.has(sessionEmail)) {
                            await handleSignOut();
                            return;
                        }
                        setUser(session.user);
                        await fetchMemberInfo(sessionEmail);
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
        const normalizedEmail = String(email || '').trim().toLowerCase();
        try {
            const permissionMember = logisticsMemberFromPermission(normalizedEmail);
            if (!permissionMember) {
                setMemberInfo(null);
                return;
            }
            const { data, error } = await supabase
                .from('iota_seoul_pilot_members')
                .select('*')
                .eq('email', normalizedEmail)
                .single();
                
            if (data && !error) {
                setMemberInfo({
                    ...permissionMember,
                    ...data,
                    email: normalizedEmail,
                    staff_name: permissionMember.staff_name,
                    name: permissionMember.name,
                    organization: permissionMember.organization,
                    department: permissionMember.organization,
                    team_name: permissionMember.organization,
                });
            } else {
                setMemberInfo(permissionMember);
            }
        } catch (err) {
            console.error("Failed to fetch member info", err);
            setMemberInfo(logisticsMemberFromPermission(normalizedEmail));
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
