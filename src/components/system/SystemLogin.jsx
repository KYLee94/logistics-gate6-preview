import React, { useState, useRef, useEffect } from 'react';
import VirtualMouse from './VirtualMouse';

export default function SystemLogin({ onLogin }) {
    const targetRef = useRef(null);
    const [email, setEmail] = useState('');
    const [mouseVisible, setMouseVisible] = useState(false);
    const [mousePos, setMousePos] = useState({ top: '65%', left: '120%', transform: 'scale(1)' });
    const [buttonActive, setButtonActive] = useState(false);
    const [hasTriggered, setHasTriggered] = useState(false);
    const [dissolved, setDissolved] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const handleScreenClick = () => {
        if (hasTriggered || !targetRef.current) return;
        setHasTriggered(true);

        const rect = targetRef.current.getBoundingClientRect();

        // 1. Mouse enters from right
        setMouseVisible(true);
        // Move gently to the center of the Google Button
        setMousePos({ 
            top: `${rect.top + rect.height / 2 - 3}px`, 
            left: `${rect.left + rect.width / 2 - 6}px`, 
            transform: 'scale(1)' 
        });

        // 2. Mouse clicks (Scale down + button active state)
        setTimeout(() => {
            setButtonActive(true);
            setMousePos(prev => ({ ...prev, transform: 'scale(0.85)' }));
        }, 1500); // 1.5s travel time

        // 3. Mouse release & trigger dissolve
        setTimeout(() => {
            setButtonActive(false);
            setMousePos(prev => ({ ...prev, transform: 'scale(1)' }));
            setDissolved(true);
        }, 1700);

        // 4. Actually navigate (Wait for dissolve transition to complete)
        setTimeout(() => {
            onLogin();
        }, 2400); // 700ms after release to allow fade out
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.key === 'Enter') {
                handleScreenClick();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hasTriggered]);

    return (
        <div className={`w-full h-full min-h-screen bg-[#FDFDFD] dark:bg-[#111111] text-[#1D1D1F] dark:text-white flex flex-col font-sans relative cursor-default transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${dissolved ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'}`} onClick={handleScreenClick}>
            <VirtualMouse isVisible={mouseVisible} style={mousePos} />
            {/* Top Navbar */}
            <div className={`w-full flex justify-between items-center px-12 py-8 relative z-50 transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                <div className="text-[20px] font-bold tracking-wide text-[#1D1D1F] dark:text-white transition-colors duration-300">IFPDP</div>
                <div className="flex gap-8 text-[17px] font-medium text-[#86868B] dark:text-[#A1A1AA] transition-colors duration-300">
                    <button onClick={() => {
                        window.history.pushState(null, '', import.meta.env.BASE_URL + 'home');
                        window.dispatchEvent(new Event('popstate'));
                    }} className="hover:text-[#111] dark:hover:text-white cursor-pointer transition-colors bg-transparent border-none outline-none p-0 font-medium">IFPDP 소개</button>
                    <button onClick={(e) => { e.stopPropagation(); alert("[리소스 데이터베이스] 데모 시연을 위해 준비 중인 메뉴입니다."); }} className="hover:text-[#111] dark:hover:text-white cursor-pointer transition-colors bg-transparent border-none outline-none p-0 font-medium">리소스</button>
                    <button onClick={(e) => { e.stopPropagation(); alert("[Help Desk] IFPDP 관리 및 지원을 위한 연락처 팝업이 노출될 예정입니다."); }} className="hover:text-[#111] dark:hover:text-white cursor-pointer transition-colors bg-transparent border-none outline-none p-0 font-medium">플랫폼 이용 문의</button>
                </div>
            </div>

            {/* Main Content */}
            <div className={`flex-1 flex flex-col items-center justify-center -mt-32 transition-all duration-[1200ms] delay-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                
                <h1 className="text-[46px] font-bold mb-[22px] tracking-normal font-inter text-[#1D1D1F] dark:text-[#E5E5E5] transition-colors duration-300">IFPDP</h1>

                {/* Form Box */}
                <div className="bg-white dark:bg-transparent border border-black/10 dark:border-[#333333] rounded-[28px] p-8 w-[430px] flex flex-col shadow-xl dark:shadow-2xl transition-colors duration-300">
                    
                    {/* Google Button */}
                    <button 
                        ref={targetRef}
                        onClick={(e) => { e.stopPropagation(); handleScreenClick(); }}
                        className={`w-full border border-black/10 dark:border-[#333333] text-[#1D1D1F] dark:text-[#E5E5E5] rounded-lg py-3 flex items-center justify-center gap-3 transition-colors text-[14px] font-medium cursor-pointer ${buttonActive ? 'bg-gray-100 dark:bg-[#2A2A2A] scale-[0.98]' : 'bg-white dark:bg-[#1A1A1A] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]'}`}
                    >
                        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Google로 계속하기
                    </button>

                    {/* Divider */}
                    <div className="flex flex-col items-center justify-center my-6">
                        <span className="text-[#888] dark:text-[#737373] text-[13px] font-normal tracking-tight transition-colors duration-300">또는</span>
                    </div>

                    {/* Email Input */}
                    <div className="w-full mb-4">
                        <input 
                            type="email" 
                            placeholder="이메일을 입력하세요"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-white dark:bg-[#262626] text-[#111] dark:text-white placeholder-gray-400 dark:placeholder-[#737373] text-[16px] px-4 py-3.5 rounded-lg border border-black/10 dark:border-[#3A3A3A] focus:outline-none focus:border-[#111] dark:focus:border-[#666] transition-colors duration-300"
                        />
                    </div>

                    {/* Email Submit Button */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleScreenClick(); }}
                        className="w-full bg-[#111] dark:bg-[#F5F5F7] text-white dark:text-[#111111] hover:bg-[#333] dark:hover:bg-white rounded-lg py-3 font-semibold transition-colors text-[16px] cursor-pointer"
                    >
                        이메일로 계속하기
                    </button>

                </div>
            </div>
        </div>
    );
}
