import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import {
    createReturnRevalidationGate,
    ensureFreshSupabaseSession,
    invalidateDashboardPermissionCache,
    invokeDashboardApi,
    setDashboardPermissionCacheIdentity,
    signOutSupabaseLocal,
} from '../utils/supabaseSession';

const AuthContext = createContext();

const TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours
const AUTH_INITIALIZATION_WARNING_MS = 15 * 1000;
const LOGISTICS_EMAIL_ALIASES = { '10524@igisam.com': 'kylee@igisam.com' };
const LOGISTICS_LOCAL_AUTH_KEY = 'logistics_preview_auth';
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
const RETURN_REVALIDATION_THROTTLE_MS = 1000;

const deferAuthStateWork = (work) => {
    window.setTimeout(() => {
        void Promise.resolve()
            .then(work)
            .catch((error) => console.warn('Deferred auth state work failed:', error?.message || error));
    }, 0);
};

const canonicalLogisticsEmail = (email) => {
    const normalized = String(email || '').trim().toLowerCase();
    return LOGISTICS_EMAIL_ALIASES[normalized] || normalized;
};

const clearSupabaseAuthStorage = () => {
    invalidateDashboardPermissionCache();
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

const readLastActivity = () => {
    const value = Number.parseInt(sessionStorage.getItem('iota_last_activity') || '', 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
};

const sessionHasExpiredFromInactivity = () => {
    const lastActivity = readLastActivity();
    return Boolean(lastActivity && Date.now() - lastActivity > TIMEOUT_MS);
};

const establishActivityBaseline = () => {
    if (!readLastActivity()) sessionStorage.setItem('iota_last_activity', Date.now().toString());
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

const normalizeMemberInfo = (remoteUser, sessionUser) => {
    const normalizedEmail = String(sessionUser?.email || remoteUser?.email || '').trim().toLowerCase();
    const permissionEmail = canonicalLogisticsEmail(remoteUser?.email || normalizedEmail);
    const displayName = remoteUser?.staff_name || remoteUser?.name || normalizedEmail;
    const organization = remoteUser?.organization || remoteUser?.department || remoteUser?.team_name || '';
    const featurePermissions = remoteUser?.feature_permissions && typeof remoteUser.feature_permissions === 'object'
        ? remoteUser.feature_permissions
        : {};

    return {
        ...remoteUser,
        id: remoteUser?.id || remoteUser?.user_id || `logistics-permission-${permissionEmail}`,
        auth_subject: String(sessionUser?.id || '').trim(),
        email: normalizedEmail,
        permission_email: permissionEmail,
        account_status: String(remoteUser?.account_status || 'unknown').trim().toLowerCase(),
        permission_revision: remoteUser?.permission_revision
            ?? remoteUser?.permissionRevision
            ?? remoteUser?.permissions_updated_at
            ?? remoteUser?.updated_at
            ?? remoteUser?.profile_payload?.permission_revision
            ?? '',
        feature_permissions: featurePermissions,
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
    const [permissionsLoading, setPermissionsLoading] = useState(true);
    const [recoveryModeState, setRecoveryModeState] = useState(false);
    const recoveryModeRef = useRef(false);
    const returnRevalidationAbortRef = useRef(null);
    const verifiedMemberSubjectRef = useRef('');
    const sessionSubject = useCallback((session) => {
        const userId = String(session?.user?.id || '').trim();
        const encodedPayload = String(session?.access_token || '').split('.')[1];
        if (!userId || !encodedPayload) return '';
        try {
            const normalizedPayload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
            const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
            const tokenSubject = String(JSON.parse(window.atob(paddedPayload))?.sub || '').trim();
            return tokenSubject === userId ? tokenSubject : '';
        } catch {
            return '';
        }
    }, []);
    const hasVerifiedMemberForSession = useCallback((session) => {
        const subject = sessionSubject(session);
        return Boolean(subject && subject === verifiedMemberSubjectRef.current);
    }, [sessionSubject]);
    const clearVerifiedMemberInfo = useCallback(() => {
        verifiedMemberSubjectRef.current = '';
        invalidateDashboardPermissionCache();
        setMemberInfo(null);
    }, []);
    const setRecoveryMode = useCallback((value) => {
        const normalized = Boolean(value);
        recoveryModeRef.current = normalized;
        setRecoveryModeState(normalized);
    }, []);
    const recoveryMode = recoveryModeState;

    const handleSignOut = useCallback(async () => {
        returnRevalidationAbortRef.current?.abort();
        returnRevalidationAbortRef.current = null;
        clearSupabaseAuthStorage();
        setUser(null);
        verifiedMemberSubjectRef.current = '';
        setMemberInfo(null);
        setPermissionsLoading(false);

        try {
            void signOutSupabaseLocal().catch((error) => {
                console.warn('Local Supabase sign out cleanup failed:', error?.message || error);
            });
        } catch (error) {
            console.error('Error during sign out:', error);
        } finally {
            clearSupabaseAuthStorage();
            window.location.replace(`${import.meta.env.BASE_URL}auth-setup`);
        }
    }, []);

    const fetchMemberInfo = useCallback(async (session, shouldCommit = () => true, signal = null) => {
        const normalizedEmail = String(session?.user?.email || '').trim().toLowerCase();
        if (!normalizedEmail) {
            if (shouldCommit()) {
                clearVerifiedMemberInfo();
            }
            return false;
        }

        try {
            const { data, error } = await invokeDashboardApi('auth/me', {}, { signal });

            const remoteUser = data?.data || data?.user || null;
            const accountStatus = String(remoteUser?.account_status || '').trim().toLowerCase();
            if (error || data?.ok === false || !remoteUser || accountStatus !== 'active') {
                console.warn('Logistics auth profile unavailable:', error?.message || data?.error || 'empty profile');
                const confirmedFailure = data?.ok === false
                    || Boolean(data && (!remoteUser || accountStatus !== 'active'))
                    || [401, 403].includes(Number(error?.status));
                if (confirmedFailure && shouldCommit()) {
                    clearVerifiedMemberInfo();
                }
                return false;
            }

            if (shouldCommit()) {
                const nextMemberInfo = normalizeMemberInfo(remoteUser, session.user);
                verifiedMemberSubjectRef.current = sessionSubject(session);
                setMemberInfo(nextMemberInfo);
                setDashboardPermissionCacheIdentity(session, nextMemberInfo);
            }
            return true;
        } catch (error) {
            console.warn('Failed to fetch logistics auth profile:', error?.message || error);
            return false;
        }
    }, [clearVerifiedMemberInfo, sessionSubject]);

    useEffect(() => {
        const recordActivity = () => {
            if (document.visibilityState === 'hidden') return;
            sessionStorage.setItem('iota_last_activity', Date.now().toString());
        };
        ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
        document.addEventListener('scroll', recordActivity, { capture: true, passive: true });

        return () => {
            ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
            document.removeEventListener('scroll', recordActivity, { capture: true });
        };
    }, []);

    useEffect(() => {
        let subscription;
        let mounted = true;
        let authStateVersion = 0;

        const initializeAuth = async () => {
            let timeoutId;

            try {
                const recoveryFromUrl = isPasswordRecoveryLocation();
                if (recoveryFromUrl && mounted) {
                    setRecoveryMode(true);
                }

                if (sessionHasExpiredFromInactivity()) {
                    sessionStorage.removeItem('iota_last_activity');
                    await handleSignOut();
                    return;
                }

                timeoutId = setTimeout(() => {
                    console.warn('Auth initialization is taking longer than expected.');
                }, AUTH_INITIALIZATION_WARNING_MS);

                const session = await ensureFreshSupabaseSession();
                clearTimeout(timeoutId);

                if (!mounted) return;

                if (session?.user) {
                    setUser(session.user);
                    establishActivityBaseline();
                    if (recoveryFromUrl) {
                        setMemberInfo(normalizeMemberInfo({ email: session.user.email }, session.user));
                        setPermissionsLoading(false);
                    } else {
                        setPermissionsLoading(true);
                        await fetchMemberInfo(session);
                        if (mounted) setPermissionsLoading(false);
                    }
                } else {
                    clearVerifiedMemberInfo();
                    setUser(null);
                    setPermissionsLoading(false);
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
                clearVerifiedMemberInfo();
                setUser(null);
                setPermissionsLoading(false);
            } finally {
                clearTimeout(timeoutId);
                if (mounted) setLoading(false);

                const { data } = supabase.auth.onAuthStateChange((event, session) => {
                    if (event === 'TOKEN_REFRESHED' && returnRevalidationAbortRef.current) return;

                    const currentVersion = authStateVersion + 1;
                    authStateVersion = currentVersion;
                    const recoveryEventActive = event === 'PASSWORD_RECOVERY'
                        || (Boolean(session?.user) && (recoveryModeRef.current || isPasswordRecoveryLocation()));

                    if (recoveryEventActive) {
                        invalidateDashboardPermissionCache();
                        setRecoveryMode(true);
                        if (session?.user) {
                            setUser(session.user);
                            setMemberInfo(normalizeMemberInfo({ email: session.user.email }, session.user));
                        }
                        setPermissionsLoading(false);
                        setLoading(false);
                        return;
                    }

                    if (session?.user) {
                        setUser(session.user);
                        if (!hasVerifiedMemberForSession(session)) {
                            clearVerifiedMemberInfo();
                        }
                        if (event === 'SIGNED_IN') {
                            sessionStorage.setItem('iota_last_activity', Date.now().toString());
                        }
                        setPermissionsLoading(true);
                        setLoading(false);
                        deferAuthStateWork(async () => {
                            const isCurrent = () => mounted && authStateVersion === currentVersion;
                            if (!isCurrent()) return;
                            await fetchMemberInfo(session, isCurrent);
                            if (isCurrent()) setPermissionsLoading(false);
                        });
                    } else {
                        returnRevalidationAbortRef.current?.abort();
                        returnRevalidationAbortRef.current = null;
                        clearVerifiedMemberInfo();
                        setUser(null);
                        setPermissionsLoading(false);
                        setLoading(false);
                    }
                });

                subscription = data.subscription;
            }
        };

        initializeAuth();

        const revalidateAfterReturn = async () => {
            if (!mounted || document.visibilityState === 'hidden' || recoveryModeRef.current) return;
            if (sessionHasExpiredFromInactivity()) {
                sessionStorage.removeItem('iota_last_activity');
                await handleSignOut();
                return;
            }
            const currentVersion = authStateVersion + 1;
            authStateVersion = currentVersion;
            const controller = new AbortController();
            returnRevalidationAbortRef.current = controller;
            setPermissionsLoading(true);
            const isCurrent = () => mounted && authStateVersion === currentVersion;
            try {
                const session = await ensureFreshSupabaseSession({
                    force: true,
                    throwOnFailure: true,
                    signal: controller.signal,
                });
                if (!session?.user) {
                    if (isCurrent()) {
                        clearVerifiedMemberInfo();
                        setUser(null);
                    }
                    return false;
                }
                if (!isCurrent()) return false;
                if (!hasVerifiedMemberForSession(session)) {
                    clearVerifiedMemberInfo();
                }
                setUser(session.user);
                const ok = await fetchMemberInfo(session, isCurrent, controller.signal);
                return ok;
            } catch (error) {
                if (isCurrent() && error?.name !== 'AbortError') {
                    console.warn('Logistics auth return revalidation failed:', error?.message || error);
                }
                return false;
            } finally {
                if (returnRevalidationAbortRef.current === controller) returnRevalidationAbortRef.current = null;
                if (isCurrent()) setPermissionsLoading(false);
            }
        };
        const queueReturnRevalidation = createReturnRevalidationGate(revalidateAfterReturn, {
            minimumIntervalMs: RETURN_REVALIDATION_THROTTLE_MS,
        });
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') void queueReturnRevalidation();
        };
        const handleWindowFocus = () => void queueReturnRevalidation();
        window.addEventListener('focus', handleWindowFocus);
        window.addEventListener('pageshow', handleWindowFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            mounted = false;
            returnRevalidationAbortRef.current?.abort();
            returnRevalidationAbortRef.current = null;
            subscription?.unsubscribe();
            window.removeEventListener('focus', handleWindowFocus);
            window.removeEventListener('pageshow', handleWindowFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [clearVerifiedMemberInfo, fetchMemberInfo, handleSignOut, hasVerifiedMemberForSession, setRecoveryMode]);

    return (
        <AuthContext.Provider value={{ user, memberInfo, loading, permissionsLoading, signOut: handleSignOut, recoveryMode, setRecoveryMode }}>
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
