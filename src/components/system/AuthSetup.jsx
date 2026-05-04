import React, { useState, useEffect } from 'react';

export default function AuthSetup({ onLogin }) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [mounted, setMounted] = useState(false);
    const [dissolved, setDissolved] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showContactModal, setShowContactModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const triggerError = (msg) => {
        setHasError(true);
        setErrorMessage(msg);
        setTimeout(() => setHasError(false), 500);
    };

    const handleSubmit = (e) => {
        e?.preventDefault();
        setErrorMessage('');
        
        if (password.length < 6) {
            triggerError('패스워드는 최소 6자리 이상이어야 합니다.');
            return;
        }
        if (password !== confirmPassword) {
            triggerError('패스워드가 일치하지 않습니다.');
            return;
        }
        
        setShowConfirmModal(true);
    };

    const proceedLogin = () => {
        setShowConfirmModal(false);
        // 실제 연동 시 이곳에서 supabase.auth.signUp 또는 updateUser 등을 호출하여 비밀번호를 DB에 저장하게 됩니다.
        
        setDissolved(true);
        setTimeout(() => {
            if(onLogin) onLogin();
        }, 700);
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
                        window.history.pushState(null, '', import.meta.env.BASE_URL);
                        window.dispatchEvent(new Event('popstate'));
                    }} className="hover:text-[#111] dark:hover:text-white cursor-pointer transition-colors bg-transparent border-none outline-none p-0 font-medium">IFPDP 소개</button>
                    <button onClick={() => setShowContactModal(true)} className="hover:text-[#111] dark:hover:text-white cursor-pointer transition-colors bg-transparent border-none outline-none p-0 font-medium">관리팀 문의</button>
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
                    
                    {/* Divider Text */}
                    <div className="flex flex-col items-center justify-center mt-1 mb-6">
                        <span className="text-[#333] dark:text-[#E5E5E5] text-[17px] font-semibold tracking-tight transition-colors duration-300">
                            전기영님 반갑습니다. 패스워드를 설정해주세요.
                        </span>
                    </div>

                    <form onSubmit={handleSubmit} className="w-full">
                        {/* Password Input */}
                        <div className="w-full mb-3">
                            <input 
                                type="password" 
                                placeholder="패스워드를 입력하세요"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`w-full bg-white dark:bg-[#262626] text-[#111] dark:text-white placeholder-gray-400 dark:placeholder-[#737373] text-[15px] px-4 py-3.5 rounded-lg border focus:outline-none transition-colors duration-300 ${hasError ? 'border-red-500 dark:border-red-500' : 'border-black/10 dark:border-[#3A3A3A] focus:border-[#111] dark:focus:border-[#666]'}`}
                            />
                        </div>

                        {/* Confirm Password Input */}
                        <div className="w-full mb-2">
                            <input 
                                type="password" 
                                placeholder="패스워드를 확인하세요"
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    if (errorMessage) setErrorMessage('');
                                }}
                                className={`w-full bg-white dark:bg-[#262626] text-[#111] dark:text-white placeholder-gray-400 dark:placeholder-[#737373] text-[15px] px-4 py-3.5 rounded-lg border focus:outline-none transition-colors duration-300 ${hasError ? 'border-red-500 dark:border-red-500' : 'border-black/10 dark:border-[#3A3A3A] focus:border-[#111] dark:focus:border-[#666]'}`}
                            />
                        </div>

                        {/* Error Message Space */}
                        <div className="w-full h-[24px] mb-4 flex items-center px-1">
                            {errorMessage && (
                                <span className="text-red-500 dark:text-[#FF453A] text-[13px] font-medium animate-pulse">
                                    * {errorMessage}
                                </span>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button 
                            type="submit"
                            className="w-full bg-[#111] dark:bg-[#0A84FF] text-white dark:text-white hover:bg-[#333] dark:hover:bg-[#0071E3] rounded-lg py-3.5 font-semibold transition-colors text-[16px] cursor-pointer"
                        >
                            확인하기
                        </button>
                    </form>

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
                        <h3 className="text-[22px] font-bold text-[#1D1D1F] dark:text-white mb-2 tracking-tight">관리팀 문의</h3>
                        <p className="text-[15px] font-medium text-[#86868B] dark:text-[#A1A1AA] text-center leading-relaxed mb-8">
                            jk.jeon@igisam.com<br/>010-9076-5369<br/>전기영 매니저에게 연락해주세요.
                        </p>
                        <button onClick={() => setShowContactModal(false)} className="w-full py-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white font-semibold text-[16px] hover:bg-[#E8E8ED] dark:hover:bg-[#3A3A3C] transition-colors">
                            닫기
                        </button>
                    </div>
                </div>
            )}

            {/* Custom Confirm Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                    <div className="bg-white dark:bg-[#1C1C1E] w-[400px] rounded-[24px] p-8 shadow-2xl flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-5">
                            <svg className="w-6 h-6 text-[#0071E3] dark:text-[#47A1FF]" fill="none" strokeWidth="2.5" stroke="currentColor" viewBox="0 0 24 24">
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
                            <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-white font-semibold text-[15px] hover:bg-[#E8E8ED] dark:hover:bg-[#3A3A3C] transition-colors">취소</button>
                            <button onClick={proceedLogin} className="flex-1 py-3.5 rounded-xl bg-[#0071E3] text-white font-semibold text-[15px] hover:bg-[#0077ED] transition-colors">진행하기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
