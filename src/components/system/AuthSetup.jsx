import React, { useState, useEffect } from 'react';

export default function AuthSetup({ onLogin }) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [mounted, setMounted] = useState(false);
    const [dissolved, setDissolved] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const handleSubmit = (e) => {
        e?.preventDefault();
        if (password !== confirmPassword) {
            alert('패스워드가 일치하지 않습니다.');
            return;
        }
        if (password.length < 6) {
            alert('패스워드는 6자리 이상이어야 합니다.');
            return;
        }
        
        // 실제 연동 시 이곳에서 supabase.auth.signUp 또는 updateUser 등을 호출하여 비밀번호를 DB에 저장하게 됩니다.
        
        setDissolved(true);
        setTimeout(() => {
            if(onLogin) onLogin();
        }, 700);
    };

    return (
        <div className={`w-full h-full min-h-screen bg-[#FDFDFD] dark:bg-[#111111] text-[#1D1D1F] dark:text-white flex flex-col font-sans relative transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${dissolved ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'}`}>
            
            {/* Top Navbar */}
            <div className={`w-full flex justify-between items-center px-12 py-8 relative z-50 transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                <div className="text-[20px] font-bold tracking-wide text-[#1D1D1F] dark:text-white transition-colors duration-300">IFPDP</div>
                <div className="flex gap-8 text-[17px] font-medium text-[#86868B] dark:text-[#A1A1AA] transition-colors duration-300">
                    <a href="?page=home" className="hover:text-[#111] dark:hover:text-white cursor-pointer transition-colors">IFPDP 소개</a>
                    <button onClick={() => alert("[리소스 데이터베이스] 데모 시연을 위해 준비 중인 메뉴입니다.")} className="hover:text-[#111] dark:hover:text-white cursor-pointer transition-colors bg-transparent border-none outline-none p-0 font-medium">리소스</button>
                    <button onClick={() => alert("[Help Desk] IFPDP 관리 및 지원을 위한 연락처 팝업이 노출될 예정입니다.")} className="hover:text-[#111] dark:hover:text-white cursor-pointer transition-colors bg-transparent border-none outline-none p-0 font-medium">관리팀 문의</button>
                </div>
            </div>

            {/* Main Content */}
            <div className={`flex-1 flex flex-col items-center justify-center -mt-32 transition-all duration-[1200ms] delay-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                
                <h1 className="text-[42px] font-bold mb-[26px] tracking-tight font-inter text-[#1D1D1F] dark:text-[#E5E5E5] transition-colors duration-300">
                    IFPDP IOTA Seoul
                </h1>

                {/* Form Box */}
                <div className="bg-white dark:bg-transparent border border-black/10 dark:border-[#333333] rounded-[28px] p-8 w-[460px] flex flex-col shadow-xl dark:shadow-2xl transition-colors duration-300">
                    
                    {/* Google Button */}
                    <button 
                        className="w-full border border-black/10 dark:border-[#333333] text-[#1D1D1F] dark:text-[#E5E5E5] rounded-lg py-3 flex items-center justify-center gap-3 transition-colors text-[14px] font-medium cursor-pointer bg-white dark:bg-[#1A1A1A] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]"
                    >
                        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Google로 계속하기 : jk.jeon@igisam.com
                    </button>

                    {/* Divider Text */}
                    <div className="flex flex-col items-center justify-center mt-8 mb-6">
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
                                className="w-full bg-white dark:bg-[#262626] text-[#111] dark:text-white placeholder-gray-400 dark:placeholder-[#737373] text-[15px] px-4 py-3.5 rounded-lg border border-black/10 dark:border-[#3A3A3A] focus:outline-none focus:border-[#111] dark:focus:border-[#666] transition-colors duration-300"
                            />
                        </div>

                        {/* Confirm Password Input */}
                        <div className="w-full mb-6">
                            <input 
                                type="password" 
                                placeholder="패스워드를 확인하세요"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-white dark:bg-[#262626] text-[#111] dark:text-white placeholder-gray-400 dark:placeholder-[#737373] text-[15px] px-4 py-3.5 rounded-lg border border-black/10 dark:border-[#3A3A3A] focus:outline-none focus:border-[#111] dark:focus:border-[#666] transition-colors duration-300"
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
