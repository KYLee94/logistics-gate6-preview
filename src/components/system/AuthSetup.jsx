import React, { useState, useEffect } from 'react';

import { supabase } from '../../utils/supabaseClient';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import { useAuth } from '../../context/AuthContext';

export default function AuthSetup({ onLogin }) {
    const { recoveryMode, setRecoveryMode } = useAuth();
    const [step, setStep] = useState(recoveryMode ? 5 : 1);
    const [email, setEmail] = useState('');
    const [staffName, setStaffName] = useState('');
    const [isFirstTime, setIsFirstTime] = useState(true);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [accessCode, setAccessCode] = useState('');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const PILOT_ACCESS_CODE = 'IOTA2026';
    const [mounted, setMounted] = useState(false);
    const [dissolved, setDissolved] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showChangeSuccessModal, setShowChangeSuccessModal] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (recoveryMode) {
            setStep(5);
        }
    }, [recoveryMode]);

    const triggerError = (msg) => {
        setHasError(true);
        setErrorMessage(msg);
        setTimeout(() => setHasError(false), 500);
    };

    const handleEmailSubmit = async (e) => {
        e?.preventDefault();
        setErrorMessage('');
        
        if (!email.includes('@')) {
            triggerError('유효한 이메일 주소를 입력해주세요.');
            return;
        }

        setIsCheckingEmail(true);
        try {
            // Check if email exists in our pilot members list
            const { data, error } = await fetchWithRetry(() => supabase
                .from('iota_seoul_pilot_members')
                .select('staff_name, auth_id')
                .eq('email', email.trim().toLowerCase())
                .single());

            if (error || !data) {
                console.error("Login email lookup error:", error);
                triggerError(error ? `서버 오류: ${error.message}` : '등록되지 않은 사용자입니다. 관리팀에 문의해주세요.');
                return;
            }

            setStaffName(data.staff_name);
            setIsFirstTime(!data.auth_id); // If auth_id is null, it's their first time setting a password
            setStep(2);
        } catch (err) {
            triggerError('서버 연결에 실패했습니다.');
        } finally {
            setIsCheckingEmail(false);
        }
    };

    const handlePasswordSubmit = (e) => {
        e?.preventDefault();
        setErrorMessage('');
        
        if (password.length < 6) {
            triggerError('패스워드는 최소 6자리 이상이어야 합니다.');
            return;
        }
        if (isFirstTime) {
            if (accessCode.trim().toUpperCase() !== PILOT_ACCESS_CODE) {
                triggerError('최초 접속 코드가 올바르지 않습니다.');
                return;
            }
            if (password !== confirmPassword) {
                triggerError('패스워드가 일치하지 않습니다.');
                return;
            }
            setShowConfirmModal(true);
        } else {
            proceedLogin();
        }
    };

    const handleChangePasswordSubmit = async (e) => {
        e?.preventDefault();
        setErrorMessage('');
        
        if (newPassword.length < 6) {
            triggerError('새 패스워드는 최소 6자리 이상이어야 합니다.');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            triggerError('새 패스워드가 일치하지 않습니다.');
            return;
        }
        if (oldPassword === newPassword) {
            triggerError('새 패스워드는 기존 패스워드와 달라야 합니다.');
            return;
        }

        try {
            // 1. Verify old password by signing in
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password: oldPassword
            });

            if (error || !data.user) {
                triggerError('기존 패스워드가 올바르지 않습니다.');
                return;
            }

            // 2. Update password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) {
                let msg = updateError.message;
                if (msg.includes('different from the old password')) {
                    msg = '새 패스워드는 기존 패스워드와 달라야 합니다.';
                }
                triggerError('패스워드 변경 실패: ' + msg);
                return;
            }

            // Success, show confirmation popup
            setShowChangeSuccessModal(true);

        } catch (err) {
            triggerError('패스워드 변경 중 오류가 발생했습니다.');
        }
    };

    const handleResetEmailSubmit = async (e) => {
        e?.preventDefault();
        setErrorMessage('');
        
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
                redirectTo: window.location.origin + import.meta.env.BASE_URL + 'auth-setup',
            });
            
            if (error) {
                triggerError('이메일 발송 실패: ' + error.message);
                return;
            }
            
            alert('이메일로 비밀번호 재설정 링크가 발송되었습니다. 이메일을 확인해주세요.');
            setStep(1);
        } catch (err) {
            triggerError('이메일 발송 중 오류가 발생했습니다.');
        }
    };

    const handleRecoveryPasswordSubmit = async (e) => {
        e?.preventDefault();
        setErrorMessage('');
        
        if (newPassword.length < 6) {
            triggerError('새 패스워드는 최소 6자리 이상이어야 합니다.');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            triggerError('새 패스워드가 일치하지 않습니다.');
            return;
        }

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) {
                triggerError('패스워드 변경 실패: ' + updateError.message);
                return;
            }

            // Success, clear recovery mode and show confirmation popup
            setRecoveryMode(false);
            setShowChangeSuccessModal(true);

        } catch (err) {
            triggerError('패스워드 변경 중 오류가 발생했습니다.');
        }
    };

    const proceedLogin = async () => {
        setShowConfirmModal(false);
        setErrorMessage('');
        
        try {
            if (isFirstTime) {
                // Sign up new user
                let { data, error } = await supabase.auth.signUp({
                    email: email.trim().toLowerCase(),
                    password: password
                });
                
                if (error) {
                    // Auto-heal: If user already exists in Supabase auth but auth_id in DB is null (e.g. after table reset)
                    if (error.message.includes('already registered')) {
                        const signInRes = await supabase.auth.signInWithPassword({
                            email: email.trim().toLowerCase(),
                            password: password
                        });
                        
                        if (signInRes.error) {
                            triggerError('이미 가입된 이메일입니다. 기존 패스워드를 입력하거나 "비밀번호 찾기"를 이용하세요.');
                            return;
                        }
                        data = signInRes.data; // Use the signed-in session data
                    } else {
                        triggerError('회원가입 실패: ' + error.message);
                        return;
                    }
                }

                // Update auth_id in our members table
                if (data.user) {
                    await supabase
                        .from('iota_seoul_pilot_members')
                        .update({ auth_id: data.user.id, last_login_at: new Date().toISOString() })
                        .eq('email', email.trim().toLowerCase());
                }
            } else {
                // Sign in existing user
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email.trim().toLowerCase(),
                    password: password
                });

                if (error) {
                    triggerError('로그인 실패: 패스워드를 확인해주세요.');
                    return;
                }

                if (data.user) {
                    await supabase
                        .from('iota_seoul_pilot_members')
                        .update({ last_login_at: new Date().toISOString() })
                        .eq('email', email.trim().toLowerCase());
                }
            }

            setDissolved(true);
            setTimeout(() => {
                if(onLogin) onLogin();
            }, 700);

        } catch (err) {
            triggerError('인증 처리 중 오류가 발생했습니다.');
        }
    };

    return (
        <div className={`w-full h-full min-h-screen bg-[#FDFDFD] dark:bg-[#111111] text-[#1D1D1F] dark:text-white flex flex-col font-sans relative transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${dissolved ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'}`}>
            
            <style>
                {`
                    @keyframes authShake {
                        0%, 100% { transform: translateX(0); }
                        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                        20%, 40%, 60%, 80% { transform: translateX(5px); }
                    }
                `}
            </style>

            {/* Top Navbar */}
            <div className={`w-full flex justify-between items-center px-12 py-8 relative z-50 transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                <div className="text-[20px] font-bold tracking-wide text-[#1D1D1F] dark:text-white transition-colors duration-300">IFPDP</div>
                <div className="flex gap-8 text-[17px] font-medium text-[#86868B] dark:text-[#A1A1AA] transition-colors duration-300">
                    <button onClick={() => {
                        window.history.pushState(null, '', import.meta.env.BASE_URL + 'home');
                        window.dispatchEvent(new Event('popstate'));
                    }} className="hover:text-[#111] dark:hover:text-white cursor-pointer transition-colors bg-transparent border-none outline-none p-0 font-medium">IFPDP 소개</button>
                    <button onClick={() => setShowContactModal(true)} className="hover:text-[#111] dark:hover:text-white cursor-pointer transition-colors bg-transparent border-none outline-none p-0 font-medium">플랫폼 이용 문의</button>
                </div>
            </div>

            {/* Main Content */}
            <div className={`flex-1 flex flex-col items-center justify-center -mt-32 transition-all duration-[1200ms] delay-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                
                <h1 className="text-[42px] font-bold mb-[26px] tracking-tight font-inter text-[#1D1D1F] dark:text-[#E5E5E5] transition-colors duration-300">
                    IFPDP IOTA Seoul
                </h1>

                {/* Form Box */}
                <div 
                    className="bg-white dark:bg-transparent border border-black/10 dark:border-[#333333] rounded-[28px] p-8 w-[460px] flex flex-col shadow-xl dark:shadow-2xl transition-colors duration-300"
                    style={hasError ? { animation: 'authShake 0.4s ease-in-out' } : {}}
                >
                    
                    {step === 1 ? (
                        <>
                            <div className="w-full flex items-center justify-start mt-1 mb-6">
                                <span className="text-[#333] dark:text-[#E5E5E5] text-[17px] font-semibold tracking-tight transition-colors duration-300">
                                    이지스 이메일을 입력해주세요.
                                </span>
                            </div>

                            <form onSubmit={handleEmailSubmit} className="w-full">
                                <div className="w-full mb-2">
                                    <input 
                                        type="email" 
                                        placeholder="이메일을 입력하세요."
                                        value={email}
                                        disabled={isCheckingEmail}
                                        onChange={(e) => { setEmail(e.target.value); if(errorMessage) setErrorMessage(''); }}
                                        className={`w-full bg-white dark:bg-[#262626] text-[#111] dark:text-white placeholder-gray-400 dark:placeholder-[#737373] text-[15px] px-4 py-3.5 rounded-[16px] border focus:outline-none transition-colors duration-300 ${hasError ? 'border-red-500 dark:border-red-500' : 'border-black/10 dark:border-[#3A3A3A] focus:border-[#111] dark:focus:border-[#666]'} ${isCheckingEmail ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    />
                                </div>
                                <div className="w-full h-[8px] mb-0 flex items-center px-1">
                                    {errorMessage && (
                                        <span className="text-red-500 dark:text-[#FF453A] text-[13px] font-medium animate-pulse">
                                            * {errorMessage}
                                        </span>
                                    )}
                                </div>
                                <button 
                                    type="submit"
                                    disabled={isCheckingEmail}
                                    className={`w-full bg-[#111] dark:bg-white text-white dark:text-[#111111] hover:bg-[#333] dark:hover:bg-gray-200 rounded-[16px] py-3.5 font-semibold transition-colors text-[16px] flex justify-center items-center ${isCheckingEmail ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    {isCheckingEmail ? (
                                        <svg className="animate-spin h-5 w-5 text-white dark:text-[#111]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        '다음'
                                    )}
                                </button>
                            </form>
                        </>
                    ) : step === 2 ? (
                        <>
                            <div className="flex items-center justify-between w-full mt-1 mb-6">
                                <div className="flex items-center">
                                    <div className="w-[36px] h-[36px] shrink-0 rounded-full bg-[#3c3c3c] overflow-hidden relative shadow-sm mr-3">
                                        <img src={`${import.meta.env.BASE_URL}${(staffName || '').replace(/\\s/g, '')}.webp`} alt={staffName} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                        <div className="absolute inset-0 rounded-full border border-black/10 dark:border-white/10 pointer-events-none"></div>
                                    </div>
                                    <span className="text-[#333] dark:text-[#E5E5E5] text-[16px] font-semibold tracking-tight transition-colors duration-300">
                                        {staffName}님 반갑습니다. 패스워드를 {isFirstTime ? '설정' : '입력'}해주세요.
                                    </span>
                                </div>
                                <button onClick={() => setStep(1)} className="text-[#86868B] hover:text-[#111] dark:hover:text-white transition-colors flex items-center text-[13px] shrink-0">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                                    뒤로
                                </button>
                            </div>

                            <form onSubmit={handlePasswordSubmit} className="w-full">
                                <div className="w-full mb-2">
                                    <input 
                                        type="password" 
                                        placeholder={isFirstTime ? "패스워드를 설정하세요." : "패스워드를 입력하세요."}
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); if(errorMessage) setErrorMessage(''); }}
                                        className={`w-full bg-white dark:bg-[#262626] text-[#111] dark:text-white placeholder-gray-400 dark:placeholder-[#737373] text-[15px] px-4 py-3.5 rounded-[16px] border focus:outline-none transition-colors duration-300 ${hasError ? 'border-red-500 dark:border-red-500' : 'border-black/10 dark:border-[#3A3A3A] focus:border-[#111] dark:focus:border-[#666]'}`}
                                    />
                                </div>

                                {isFirstTime && (
                                    <>
                                        <div className="w-full mb-2">
                                            <input 
                                                type="password" 
                                                placeholder="패스워드를 재확인하세요."
                                                value={confirmPassword}
                                                onChange={(e) => {
                                                    setConfirmPassword(e.target.value);
                                                    if (errorMessage) setErrorMessage('');
                                                }}
                                                className={`w-full bg-white dark:bg-[#262626] text-[#111] dark:text-white placeholder-gray-400 dark:placeholder-[#737373] text-[15px] px-4 py-3.5 rounded-[16px] border focus:outline-none transition-colors duration-300 ${hasError ? 'border-red-500 dark:border-red-500' : 'border-black/10 dark:border-[#3A3A3A] focus:border-[#111] dark:focus:border-[#666]'}`}
                                            />
                                        </div>
                                        <div className="w-full mb-2">
                                            <input 
                                                type="text" 
                                                placeholder="최초 접속 코드"
                                                value={accessCode}
                                                onChange={(e) => {
                                                    setAccessCode(e.target.value);
                                                    if (errorMessage) setErrorMessage('');
                                                }}
                                                className={`w-full bg-white dark:bg-[#262626] text-[#111] dark:text-white placeholder-gray-400 dark:placeholder-[#737373] text-[15px] px-4 py-3.5 rounded-[16px] border focus:outline-none transition-colors duration-300 ${hasError ? 'border-red-500 dark:border-red-500' : 'border-black/10 dark:border-[#3A3A3A] focus:border-[#111] dark:focus:border-[#666]'}`}
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="w-full h-[8px] mb-0 flex items-center px-1">
                                    {errorMessage && (
                                        <span className="text-red-500 dark:text-[#FF453A] text-[13px] font-medium animate-pulse">
                                            * {errorMessage}
                                        </span>
                                    )}
                                </div>

                                <button 
                                    type="submit"
                                    className="w-full bg-[#111] dark:bg-white text-white dark:text-[#111111] hover:bg-[#333] dark:hover:bg-gray-200 rounded-[16px] py-3.5 font-semibold transition-colors text-[16px] cursor-pointer"
                                >
                                    확인하기
                                </button>

                                {!isFirstTime && (
                                    <div className="w-full mt-5 flex justify-center items-center">
                                        <button 
                                            type="button"
                                            onClick={() => setStep(3)}
                                            className="text-[#86868B] hover:text-[#111] dark:hover:text-[#E5E5E5] text-[13px] font-medium transition-colors border-b border-transparent hover:border-[#111] dark:hover:border-[#E5E5E5] pb-0.5"
                                        >
                                            패스워드 변경
                                        </button>
                                        <span className="mx-3 text-[#E5E5E5] dark:text-[#333]">|</span>
                                        <button 
                                            type="button"
                                            onClick={() => setStep(4)}
                                            className="text-[#86868B] hover:text-[#111] dark:hover:text-[#E5E5E5] text-[13px] font-medium transition-colors border-b border-transparent hover:border-[#111] dark:hover:border-[#E5E5E5] pb-0.5"
                                        >
                                            비밀번호를 잊으셨나요?
                                        </button>
                                    </div>
                                )}
                            </form>
                        </>
                    ) : step === 3 ? (
                        <>
                            <div className="flex items-center justify-between w-full mt-1 mb-6">
                                <span className="text-[#333] dark:text-[#E5E5E5] text-[17px] font-semibold tracking-tight transition-colors duration-300">
                                    패스워드를 변경해주세요.
                                </span>
                                <button onClick={() => setStep(2)} className="text-[#86868B] hover:text-[#111] dark:hover:text-white transition-colors flex items-center text-[13px] shrink-0">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                                    뒤로
                                </button>
                            </div>

                            <form onSubmit={handleChangePasswordSubmit} className="w-full">
                                <div className="w-full mb-2">
                                    <input 
                                        type="password" 
                                        placeholder="기존 패스워드"
                                        value={oldPassword}
                                        onChange={(e) => { setOldPassword(e.target.value); if(errorMessage) setErrorMessage(''); }}
                                        className={`w-full bg-white dark:bg-[#262626] text-[#111] dark:text-white placeholder-gray-400 dark:placeholder-[#737373] text-[15px] px-4 py-3.5 rounded-[16px] border focus:outline-none transition-colors duration-300 ${hasError ? 'border-red-500 dark:border-red-500' : 'border-black/10 dark:border-[#3A3A3A] focus:border-[#111] dark:focus:border-[#666]'}`}
                                    />
                                </div>
                                <div className="w-full mb-2">
                                    <input 
                                        type="password" 
                                        placeholder="새 패스워드"
                                        value={newPassword}
                                        onChange={(e) => { setNewPassword(e.target.value); if(errorMessage) setErrorMessage(''); }}
                                        className={`w-full bg-white dark:bg-[#262626] text-[#111] dark:text-white placeholder-gray-400 dark:placeholder-[#737373] text-[15px] px-4 py-3.5 rounded-[16px] border focus:outline-none transition-colors duration-300 ${hasError ? 'border-red-500 dark:border-red-500' : 'border-black/10 dark:border-[#3A3A3A] focus:border-[#111] dark:focus:border-[#666]'}`}
                                    />
                                </div>
                                <div className="w-full mb-2">
                                    <input 
                                        type="password" 
                                        placeholder="새 패스워드 확인"
                                        value={confirmNewPassword}
                                        onChange={(e) => { setConfirmNewPassword(e.target.value); if(errorMessage) setErrorMessage(''); }}
                                        className={`w-full bg-white dark:bg-[#262626] text-[#111] dark:text-white placeholder-gray-400 dark:placeholder-[#737373] text-[15px] px-4 py-3.5 rounded-[16px] border focus:outline-none transition-colors duration-300 ${hasError ? 'border-red-500 dark:border-red-500' : 'border-black/10 dark:border-[#3A3A3A] focus:border-[#111] dark:focus:border-[#666]'}`}
                                    />
                                </div>

                                <div className="w-full h-[8px] mb-0 flex items-center px-1">
                                    {errorMessage && (
                                        <span className="text-red-500 dark:text-[#FF453A] text-[13px] font-medium animate-pulse">
                                            * {errorMessage}
                                        </span>
                                    )}
                                </div>

                                <button 
                                    type="submit"
                                    className="w-full bg-[#111] dark:bg-white text-white dark:text-[#111111] hover:bg-[#333] dark:hover:bg-gray-200 rounded-[16px] py-3.5 font-semibold transition-colors text-[16px] cursor-pointer"
                                >
                                    변경 및 접속하기
                                </button>
                            </form>
                        </>
                    ) : step === 4 ? (
                        <>
                            <div className="flex items-center justify-between w-full mt-1 mb-6">
                                <span className="text-[#333] dark:text-[#E5E5E5] text-[17px] font-semibold tracking-tight transition-colors duration-300">
                                    비밀번호 재설정 링크 발송
                                </span>
                                <button onClick={() => setStep(2)} className="text-[#86868B] hover:text-[#111] dark:hover:text-white transition-colors flex items-center text-[13px] shrink-0">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                                    뒤로
                                </button>
                            </div>

                            <p className="text-[#86868B] dark:text-[#A1A1AA] text-[14px] mb-6 leading-relaxed">
                                가입하신 이메일 주소로 비밀번호를 재설정할 수 있는 링크를 보내드립니다.
                            </p>

                            <form onSubmit={handleResetEmailSubmit} className="w-full">
                                <div className="w-full mb-2">
                                    <input 
                                        type="email" 
                                        placeholder="이메일을 입력하세요."
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value); if(errorMessage) setErrorMessage(''); }}
                                        className={`w-full bg-white dark:bg-[#262626] text-[#111] dark:text-white placeholder-gray-400 dark:placeholder-[#737373] text-[15px] px-4 py-3.5 rounded-[16px] border focus:outline-none transition-colors duration-300 ${hasError ? 'border-red-500 dark:border-red-500' : 'border-black/10 dark:border-[#3A3A3A] focus:border-[#111] dark:focus:border-[#666]'}`}
                                    />
                                </div>

                                <div className="w-full h-[8px] mb-0 flex items-center px-1">
                                    {errorMessage && (
                                        <span className="text-red-500 dark:text-[#FF453A] text-[13px] font-medium animate-pulse">
                                            * {errorMessage}
                                        </span>
                                    )}
                                </div>

                                <button 
                                    type="submit"
                                    className="w-full bg-[#111] dark:bg-white text-white dark:text-[#111111] hover:bg-[#333] dark:hover:bg-gray-200 rounded-[16px] py-3.5 font-semibold transition-colors text-[16px] cursor-pointer"
                                >
                                    재설정 링크 받기
                                </button>
                            </form>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center justify-between w-full mt-1 mb-6">
                                <span className="text-[#333] dark:text-[#E5E5E5] text-[17px] font-semibold tracking-tight transition-colors duration-300">
                                    새로운 패스워드 설정
                                </span>
                            </div>

                            <form onSubmit={handleRecoveryPasswordSubmit} className="w-full">
                                <div className="w-full mb-2">
                                    <input 
                                        type="password" 
                                        placeholder="새 패스워드"
                                        value={newPassword}
                                        onChange={(e) => { setNewPassword(e.target.value); if(errorMessage) setErrorMessage(''); }}
                                        className={`w-full bg-white dark:bg-[#262626] text-[#111] dark:text-white placeholder-gray-400 dark:placeholder-[#737373] text-[15px] px-4 py-3.5 rounded-[16px] border focus:outline-none transition-colors duration-300 ${hasError ? 'border-red-500 dark:border-red-500' : 'border-black/10 dark:border-[#3A3A3A] focus:border-[#111] dark:focus:border-[#666]'}`}
                                    />
                                </div>
                                <div className="w-full mb-2">
                                    <input 
                                        type="password" 
                                        placeholder="새 패스워드 확인"
                                        value={confirmNewPassword}
                                        onChange={(e) => { setConfirmNewPassword(e.target.value); if(errorMessage) setErrorMessage(''); }}
                                        className={`w-full bg-white dark:bg-[#262626] text-[#111] dark:text-white placeholder-gray-400 dark:placeholder-[#737373] text-[15px] px-4 py-3.5 rounded-[16px] border focus:outline-none transition-colors duration-300 ${hasError ? 'border-red-500 dark:border-red-500' : 'border-black/10 dark:border-[#3A3A3A] focus:border-[#111] dark:focus:border-[#666]'}`}
                                    />
                                </div>

                                <div className="w-full h-[8px] mb-0 flex items-center px-1">
                                    {errorMessage && (
                                        <span className="text-red-500 dark:text-[#FF453A] text-[13px] font-medium animate-pulse">
                                            * {errorMessage}
                                        </span>
                                    )}
                                </div>

                                <button 
                                    type="submit"
                                    className="w-full bg-[#111] dark:bg-white text-white dark:text-[#111111] hover:bg-[#333] dark:hover:bg-gray-200 rounded-[16px] py-3.5 font-semibold transition-colors text-[16px] cursor-pointer"
                                >
                                    패스워드 저장 및 접속하기
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>

            {/* Custom Contact Modal */}
            {showContactModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowContactModal(false)}>
                    <div className="bg-white dark:bg-[#1C1C1E] w-[420px] rounded-[24px] p-8 shadow-2xl flex flex-col items-center" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center mb-5">
                            <svg className="w-6 h-6 text-[#1D1D1F] dark:text-white" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 className="text-[22px] font-bold text-[#1D1D1F] dark:text-white mb-2 tracking-tight">플랫폼 이용 문의</h3>
                        <p className="text-[15px] font-medium text-[#86868B] dark:text-[#A1A1AA] text-center leading-relaxed mb-8">
                            ***@igisam.com<br/>010-****-****<br/>전기영 매니저에게 연락해주세요.
                        </p>
                        <button onClick={() => setShowContactModal(false)} className="w-full py-3.5 rounded-[16px] bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white font-semibold text-[16px] hover:bg-[#E8E8ED] dark:hover:bg-[#3A3A3C] transition-colors cursor-pointer">
                            닫기
                        </button>
                    </div>
                </div>
            )}

            {/* Custom Confirm Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                    <div className="bg-white dark:bg-[#1C1C1E] w-[400px] rounded-[24px] p-8 shadow-2xl flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center mb-5">
                            <svg className="w-6 h-6 text-[#1D1D1F] dark:text-white" fill="none" strokeWidth="2.5" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h3 className="text-[20px] font-bold text-[#1D1D1F] dark:text-white mb-4 tracking-tight">패스워드 확인</h3>
                        <div className="bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-lg px-6 py-3 mb-6 flex flex-col items-center">
                            <span className="text-[13px] text-[#86868B] dark:text-[#A1A1AA] mb-1">설정하신 패스워드</span>
                            <span className="text-[18px] font-semibold text-[#1D1D1F] dark:text-white tracking-widest">{password}</span>
                        </div>
                        <p className="text-[16px] font-medium text-[#1D1D1F] dark:text-white mb-8">이대로 진행할까요?</p>
                        <div className="w-full flex gap-3">
                            <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-3.5 rounded-[16px] bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white font-semibold text-[15px] hover:bg-[#E8E8ED] dark:hover:bg-[#3A3A3C] transition-colors cursor-pointer">취소</button>
                            <button onClick={proceedLogin} className="flex-1 py-3.5 rounded-[16px] bg-[#111] dark:bg-white text-white dark:text-[#111111] font-semibold text-[15px] hover:bg-[#333] dark:hover:bg-gray-200 transition-colors cursor-pointer">진행하기</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Password Change Success Modal */}
            {showChangeSuccessModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                    <div className="bg-white dark:bg-[#1C1C1E] w-[400px] rounded-[24px] p-8 shadow-2xl flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center mb-5">
                            <svg className="w-6 h-6 text-green-500" fill="none" strokeWidth="2.5" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-[20px] font-bold text-[#1D1D1F] dark:text-white mb-4 tracking-tight">패스워드 변경 완료</h3>
                        <div className="bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-lg px-6 py-4 mb-6 flex flex-col items-center w-full">
                            <span className="text-[13px] text-[#86868B] dark:text-[#A1A1AA] mb-1">새로 설정된 패스워드</span>
                            <span className="text-[22px] font-semibold text-[#1D1D1F] dark:text-white tracking-widest">{newPassword}</span>
                        </div>
                        <p className="text-[14px] font-medium text-[#86868B] dark:text-[#A1A1AA] mb-8 text-center leading-relaxed">
                            패스워드가 성공적으로 변경되었습니다.<br/>반드시 기억해 주세요.
                        </p>
                        <button 
                            onClick={() => {
                                setShowChangeSuccessModal(false);
                                setDissolved(true);
                                setTimeout(() => {
                                    if(onLogin) onLogin();
                                }, 700);
                            }} 
                            className="w-full py-3.5 rounded-[16px] bg-[#111] dark:bg-white text-white dark:text-[#111111] font-semibold text-[15px] hover:bg-[#333] dark:hover:bg-gray-200 transition-colors cursor-pointer"
                        >
                            접속하기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
