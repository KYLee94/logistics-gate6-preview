/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const AuthContext = createContext();

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const LOGISTICS_EMAIL_ALIASES = { '10524@igisam.com': 'kylee@igisam.com' };
const LOGISTICS_LOCAL_AUTH_KEY = 'logistics_preview_auth';

const canonicalLogisticsEmail = (email) => {
    const normalized = String(email || '').trim().toLowerCase();
    return LOGISTICS_EMAIL_ALIASES[normalized] || normalized;
};

const clearSupabaseAuthStorage = () => {
    [localStorage, sessionStorage].forEach((storage) => {
        const keysToRemove = [];
        for (let i = 0; i < storage.length; i += 1) {
            const key = storage.key(i);
            if (key && (key.startsWith('sb-') || key === LOGISTICS_LOCAL_AUTH_KEY || key === 'iota_last_activity')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((key) => storage.removeItem(key));
    });
};

const isPasswordRecoveryLocation = () => {
    if (typeof window === 'undefined') return false;
    const params = [
        new URLSearchParams(window.location.search || ''),
        new URLSearchParams((window.location.hash || '').replace(/^#/, '')),
    ];
    return params.some((item) => (
        item.get('type') === 'recovery'
        || (item.has('access_token') && item.has('refresh_token') && window.location.pathname.includes('auth-setup'))
    ));
};

const normalizeMemberInfo = (remoteUser, sessionEmail) => {
    const normalizedEmail = String(sessionEmail || remoteUser?.email || '').trim().toLowerCase();
    const permissionEmail = canonicalLogisticsEmail(remoteUser?.email || normalizedEmail);
    const displayName = remoteUser?.staff_name || remoteUser?.name || normalizedEmail;
    const organization = remoteUser?.organization || remoteUser?.department || remoteUser?.team_name || '';

    return {
        ...remoteUser,
        id: remoteUser?.id || remoteUser?.user_id || `logistics-permission-${permissionEmail}`,
        email: normalizedEmail,
        permission_email: permissionEmail,
        staff_name: displayName,
        name: remoteUser?.name || displayName,
        organization,
        department: remoteUser?.department || organization,
        team_name: remoteUser?.team_name || organization,
        image_url: remoteUser?.image_url || remoteUser?.avatar_url || remoteUser?.profile_image_url || null,
        avatar_url: remoteUser?.avatar_url || remoteUser?.image_url || remoteUser?.profile_image_url || null,
        logistics_permission: remoteUser,
    };
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [memberInfo, setMemberInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recoveryMode, setRecoveryMode] = useState(false);

    const handleSignOut = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Error during sign out:', error);
        } finally {
            clearSupabaseAuthStorage();
            setUser(null);
            setMemberInfo(null);
            window.location.href = `${import.meta.env.BASE_URL}auth-setup`;
        }
    };

    const fetchMemberInfo = async (sessionEmail) => {
        const normalizedEmail = String(sessionEmail || '').trim().toLowerCase();
        if (!normalizedEmail) {
            setMemberInfo(null);
            return false;
        }

        try {
            const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
                body: {
                    action: 'auth/me',
                    payload: {},
                },
            });

            const remoteUser = data?.data || data?.user || null;
            if (error || data?.ok === false || !remoteUser) {
                console.warn('Logistics auth profile unavailable:', error?.message || data?.error || 'empty profile');
                setMemberInfo(null);
                return false;
            }

            setMemberInfo(normalizeMemberInfo(remoteUser, normalizedEmail));
            return true;
        } catch (error) {
            console.warn('Failed to fetch logistics auth profile:', error?.message || error);
            setMemberInfo(null);
            return false;
        }
    };

    useEffect(() => {
        sessionStorage.setItem('iota_last_activity', Date.now().toString());

        const activityIntervalId = setInterval(() => {
            sessionStorage.setItem('iota_last_activity', Date.now().toString());
        }, 60000);

        return () => clearInterval(activityIntervalId);
    }, []);

    useEffect(() => {
        let subscription;
        let mounted = true;

        const initializeAuth = async () => {
            let timeoutId;

            try {
                const recoveryFromUrl = isPasswordRecoveryLocation();
                if (recoveryFromUrl && mounted) {
                    setRecoveryMode(true);
                }

                const lastActivityStr = sessionStorage.getItem('iota_last_activity');
                if (lastActivityStr) {
                    const lastActivity = parseInt(lastActivityStr, 10);
                    if (Date.now() - lastActivity > TIMEOUT_MS) {
                        sessionStorage.removeItem('iota_last_activity');
                        await handleSignOut();
                        return;
                    }
                }

                timeoutId = setTimeout(() => {
                    console.error('Auth initialization timed out. Rendering fallback state.');
                    if (mounted) setLoading(false);
                }, 5000);

                const { data: { session } } = await supabase.auth.getSession();
                clearTimeout(timeoutId);

                if (!mounted) return;

                if (session?.user) {
                    setUser(session.user);
                    if (recoveryFromUrl) {
                        setMemberInfo((current) => current || normalizeMemberInfo({ email: session.user.email }, session.user.email));
                    } else {
                        const ok = await fetchMemberInfo(session.user.email);
                        if (!ok) {
                            await handleSignOut();
                            return;
                        }
                    }
                } else {
                    setUser(null);
                    setMemberInfo(null);
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
                setUser(null);
                setMemberInfo(null);
            } finally {
                clearTimeout(timeoutId);
                if (mounted) setLoading(false);

                const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
                    if (event === 'PASSWORD_RECOVERY') {
                        setRecoveryMode(true);
                        if (session?.user) {
                            setUser(session.user);
                            setMemberInfo((current) => current || normalizeMemberInfo({ email: session.user.email }, session.user.email));
                        }
                        setLoading(false);
                        return;
                    }

                    if (session?.user) {
                        setUser(session.user);
                        const ok = await fetchMemberInfo(session.user.email);
                        if (!ok) {
                            await handleSignOut();
                            return;
                        }
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
            mounted = false;
            subscription?.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, memberInfo, loading, signOut: handleSignOut, recoveryMode, setRecoveryMode }}>
            {loading ? (
                <div className="fixed inset-0 z-[99999] flex h-full w-full flex-col items-center justify-center bg-[#FDFDFD] dark:bg-[#111111]">
                    <div className="relative mb-5 h-6 w-6 animate-spin">
                        <div className="absolute left-1/2 top-0 -ml-[3px] h-[6px] w-[6px] rounded-full bg-[#111] dark:bg-white" />
                    </div>
                    <span className="text-[14px] font-medium tracking-tight text-[#86868B] dark:text-[#A1A1AA]">로그인 정보를 확인하고 있습니다...</span>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
