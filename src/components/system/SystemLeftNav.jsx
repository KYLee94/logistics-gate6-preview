import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function SystemLeftNav({ isCore, isPlatform = false }) {
    const { isLightMode, toggleTheme } = useTheme();
    const [fakeLight, setFakeLight] = useState(false);

    const activeLight = isCore ? fakeLight : isLightMode;

    const handleToggle = () => {
        if (isCore) {
            setFakeLight(!fakeLight);
        } else {
            toggleTheme();
        }
    };

    return (
        <div className="w-[275px] h-full bg-[#FBFBFD] dark:bg-transparent border-r border-black/10 dark:border-[#2C2C2E] flex flex-col flex-shrink-0 text-[14px] font-sans text-[#1D1D1F] dark:text-white transition-colors duration-300">
            
            {/* Top IFPDP Header & Sidebar Collapse Icon */}
            <div className="w-full flex items-center justify-between px-[15px] pt-[18px] pb-4">
                <span 
                    onClick={() => {
                        window.history.pushState(null, '', import.meta.env.BASE_URL);
                        window.dispatchEvent(new Event('popstate'));
                    }}
                    className="font-bold text-[20px] tracking-wide font-inter ml-[5px] text-[#1D1D1F] dark:text-white transition-colors duration-300 cursor-pointer hover:text-gray-400 dark:hover:text-gray-400"
                >IFPDP</span>
                <button className="text-[#86868B] dark:text-[#c3c2b7] hover:text-[#1D1D1F] dark:hover:text-white pb-1 transition-colors group cursor-pointer mt-[4px]">
                    <svg className="w-[22px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                        <rect x="2" y="4" width="20" height="16" rx="3" ry="3" />
                        <line x1="8" y1="4" x2="8" y2="20" />
                    </svg>
                </button>
            </div>

            {/* Main Menu */}
            <div className="flex-1 overflow-y-auto pb-5 hide-scrollbar flex flex-col px-[9px]">
                
                <div
                    onClick={() => {
                        window.history.pushState(null, '', import.meta.env.BASE_URL);
                        window.dispatchEvent(new Event('popstate'));
                    }}
                    className="flex items-center px-2.5 py-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-md cursor-pointer transition-colors duration-300"
                >
                    <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 001 1m-6 0h6" /></svg>
                    <span className="font-light text-[14px]">홈</span>
                </div>

                {/* 1. 포트폴리오 */}
                <div className="flex items-center justify-between px-2.5 py-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-md cursor-pointer mt-0.5 transition-colors duration-300">
                    <div className="flex items-center">
                        <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        <span className="font-light text-[14px]">포트폴리오</span>
                    </div>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>

                {/* 2. 자산 */}
                <div className="flex items-center justify-between px-2.5 py-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-md cursor-pointer mt-0.5 transition-colors duration-300">
                    <div className="flex items-center">
                        <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        <span className="font-light text-[14px]">자산</span>
                    </div>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>

                {/* 3. 펀드 & 자본 */}
                <div className="flex items-center justify-between px-2.5 py-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-md cursor-pointer mt-0.5 transition-colors duration-300">
                    <div className="flex items-center">
                        <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="font-light text-[14px]">펀드 & 자본</span>
                    </div>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>

                {/* 4. 이해관계자 */}
                <div className="flex items-center justify-between px-2.5 py-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-md cursor-pointer mt-0.5 transition-colors duration-300">
                    <div className="flex items-center">
                        <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        <span className="font-light text-[14px]">이해관계자</span>
                    </div>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>

                {/* 5. 딜 파이프라인 */}
                <div className="flex items-center justify-between px-2.5 py-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-md cursor-pointer mt-0.5 transition-colors duration-300">
                    <div className="flex items-center">
                        <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
                        <span className="font-light text-[14px]">딜 파이프라인</span>
                    </div>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>

                {/* 6. 거버넌스 & 성과 */}
                <div className="flex items-center justify-between px-2.5 py-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-md cursor-pointer mt-0.5 transition-colors duration-300">
                    <div className="flex items-center">
                        <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        <span className="font-light text-[14px]">거버넌스 & 성과</span>
                    </div>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>

                <div 
                    onClick={isPlatform ? () => {
                        window.history.pushState(null, '', `${import.meta.env.BASE_URL}platform/iotaseoul`);
                        window.dispatchEvent(new Event('popstate'));
                    } : undefined}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-md mt-4 mb-2 transition-colors duration-300 border dark:border-[#3A3A3C] shadow-sm dark:bg-[#2A2A2A] group ${isPlatform ? 'hover:bg-[#18181A] dark:hover:bg-[#18181A] cursor-pointer border-gray-300 bg-white' : 'cursor-not-allowed opacity-40 border-gray-200 bg-gray-50'}`}
                >
                    <div className="flex items-center">
                        <span className="font-semibold text-[14px] text-[#111] dark:text-white group-hover:text-white dark:group-hover:text-white">IOTA Seoul</span>
                    </div>
                    <svg className="w-3.5 h-3.5 text-[#86868B] group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>

                {/* 최근 채팅 영역 */}
                <div className="mt-8 mb-2 px-2.5">
                    <div className="font-semibold mb-2 text-[12px] text-[#86868B] dark:text-[#A1A1AA] transition-colors duration-300">최근 채팅</div>
                    <div className="flex flex-col gap-2.5 mt-4 text-[#888] dark:text-[#737373] transition-colors duration-300">
                        {[
                            "국내 개발중 프라임 자산 원가 비교",
                            "2026년 이지스에서 가장 큰 실물사업..",
                            "모빌리티 임대차 기획 진행 상황",
                            "펀드 만기 기한",
                            "사업 그룹 진행중인 프로젝트 갯수",
                            "데이터센터 중도 구축 자체 시나리오",
                            "아제미티스 매각 준비 현황"
                        ].map((chat, idx) => (
                            <div key={idx} className="font-medium text-[13px] hover:text-[#111] dark:hover:text-[#E5E5E5] cursor-pointer truncate transition-colors duration-200">
                                {chat}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Profile */}
            <div className="px-[15px] pt-4 pb-3 border-t border-black/10 dark:border-[#3A3A3C] w-full flex items-center justify-between transition-colors duration-300">
                <div 
                    className="flex items-center gap-3 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] p-1.5 -ml-1.5 rounded-lg cursor-pointer transition-colors duration-300"
                    onClick={() => alert("개인 활동 로그 및 권한 설정 패널이 노출됩니다.")}
                >
                    <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-[#E5E5EA] dark:bg-[#2C2C2E] -ml-[2px] border border-black/5 dark:border-white/10 transition-colors duration-300">
                        <img 
                            src={`${import.meta.env.BASE_URL}전기영.webp`} 
                            alt="전기영 매니저" 
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = 'JK'; e.target.parentNode.className = 'w-10 h-10 rounded-full bg-[#E5E5EA] dark:bg-[#c3c2b7] text-[#111] dark:text-[#1F1F1E] flex items-center justify-center text-[16px] font-bold tracking-tighter -ml-[2px] transition-colors duration-300'; }}
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-[14px] leading-tight mb-0.5 text-[#1D1D1F] dark:text-white transition-colors duration-300 tracking-tight">전기영 매니저</span>
                        <span className="text-[#86868B] dark:text-gray-400 text-[12px] leading-none font-medium transition-colors duration-300">활동 로그 보기</span>
                    </div>
                </div>
                
                {/* Theme Toggle Switch */}
                <div 
                    className="flex shrink-0 items-center justify-center cursor-default ml-2"
                >
                    <div className={`w-[42px] h-[24px] rounded-full relative transition-colors duration-300 ${activeLight ? 'bg-[#c3c2b7]' : 'bg-[#3A3A3C]'} border border-black/10 dark:border-[#4A4A4C]`}>
                        <div className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[2px] transition-transform duration-300 shadow-sm ${activeLight ? 'translate-x-[20px]' : 'translate-x-[2px]'}`}></div>
                        {/* Sun/Moon icons */}
                        <svg className={`absolute left-[4px] top-[4px] w-4 h-4 text-[#111] transition-opacity duration-300 ${activeLight ? 'opacity-100' : 'opacity-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        <svg className={`absolute right-[3px] top-[3.5px] w-[15px] h-[15px] text-[#A1A1AA] transition-opacity duration-300 ${activeLight ? 'opacity-0' : 'opacity-100'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                    </div>
                </div>
            </div>
        </div>
    );
}
