import React, { useState, useEffect } from 'react';

export default function AuthSetup({ onLogin }) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [mounted, setMounted] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const triggerError = () => {
        setHasError(true);
        setTimeout(() => setHasError(false), 500);
    };

    const handleSubmit = (e) => {
        e?.preventDefault();
        if (password !== confirmPassword || password.length < 6) {
            triggerError();
            return;
        }
        
        const confirmed = window.confirm(`설정하신 패스워드: ${password}\n\n이대로 진행할까요?`);
        if (!confirmed) return;
        
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
                    <button onClick={() => alert("jk.jeon@igisam.com 010-9076-5369 전기영 매니저에게 연락해주세요.")} className="hover:text-[#111] dark:hover:text-white cursor-pointer transition-colors bg-transparent border-none outline-none p-0 font-medium">관리팀 문의</button>
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
                    <div className="flex flex-col items-center justify-center mt-2 mb-6">
                        <span className="text-[#333] dark:text-[#E5E5E5] text-[15px] font-semibold tracking-tight transition-colors duration-300">
                            전기영님 패스워드를 설정해주세요.
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
                        <div className="w-full mb-6">
                            <input 
                                type="password" 
                                placeholder="패스워드를 확인하세요"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={`w-full bg-white dark:bg-[#262626] text-[#111] dark:text-white placeholder-gray-400 dark:placeholder-[#737373] text-[15px] px-4 py-3.5 rounded-lg border focus:outline-none transition-colors duration-300 ${hasError ? 'border-red-500 dark:border-red-500' : 'border-black/10 dark:border-[#3A3A3A] focus:border-[#111] dark:focus:border-[#666]'}`}
                            />
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
        </div>
    );
}
