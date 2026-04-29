import { useState } from 'react';

const menuItems = [
    {
        id: 1,
        label: '사업 개요',
        active: true,
        icon: (
            <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
        ),
    },
    {
        id: 2,
        label: '조직 & RACI',
        icon: (
            <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        ),
    },
    {
        id: 3,
        label: '파이낸싱',
        icon: (
            <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
    {
        id: 4,
        label: '개발관리',
        icon: (
            <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
            </svg>
        ),
    },
    {
        id: 5,
        label: '기업마케팅',
        icon: (
            <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        ),
    },
    {
        id: 6,
        label: '펀드 운용',
        icon: (
            <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
    },
    {
        id: 7,
        label: 'IPR 준비',
        icon: (
            <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
        ),
    },
    {
        id: 8,
        label: '리스크',
        badge: '3 Open',
        icon: (
            <svg className="w-4.5 h-4.5 mr-3 text-[#f87171]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
    },
    {
        id: 9,
        label: '의사결정 로그',
        icon: (
            <svg className="w-4.5 h-4.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
    },
];

export default function IotaLeftNav() {
    const [activeId, setActiveId] = useState(1);

    return (
        <div className="w-[275px] h-full bg-[#18181A] border-r border-[#2C2C2E] flex flex-col flex-shrink-0 text-[14px] font-sans text-white transition-colors duration-300">

            {/* Header */}
            <div className="w-full flex items-center justify-between px-[15px] pt-[18px] pb-4 border-b border-[#2C2C2E] mb-2">
                <div className="flex flex-col">
                    <span className="font-bold text-[20px] tracking-wide font-inter ml-[5px] text-white cursor-pointer">
                        IOTA Seoul
                    </span>
                    <span className="text-[12px] text-[#A1A1AA] ml-[6px] mt-0.5">통합 업무수행 워크스페이스</span>
                </div>
            </div>

            {/* Main Menu */}
            <div className="flex-1 overflow-y-auto pb-5 hide-scrollbar flex flex-col px-[9px]">

                {/* Back */}
                <div
                    onClick={() => {
                        window.history.pushState(null, '', window.location.pathname + '?page=system-core');
                        window.dispatchEvent(new Event('popstate'));
                    }}
                    className="flex items-center px-2.5 py-2 hover:bg-[#2C2C2E] rounded-md cursor-pointer transition-colors duration-300 mt-2"
                >
                    <svg className="w-4.5 h-4.5 mr-3 text-[#A1A1AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span className="font-light text-[14px] text-[#A1A1AA]">Global IFPDP 복귀</span>
                </div>

                <div className="mt-5 mb-2 px-2.5">
                    <div className="font-semibold text-[11px] text-[#4A4A4C] uppercase tracking-widest">메뉴</div>
                </div>

                {/* 9 Menu Items */}
                <div className="flex flex-col gap-0.5">
                    {menuItems.map((item) => {
                        const isActive = activeId === item.id;
                        return (
                            <div
                                key={item.id}
                                onClick={() => setActiveId(item.id)}
                                className={`flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer transition-colors duration-200 ${isActive ? 'bg-[#2A2A2A] border border-[#3A3A3C]' : 'hover:bg-[#2C2C2E]'}`}
                            >
                                <div className="flex items-center">
                                    <span className={isActive ? 'text-white' : 'text-[#A1A1AA]'}>
                                        {item.icon}
                                    </span>
                                    <span className={`text-[14px] ${isActive ? 'font-medium text-white' : 'font-light text-[#A1A1AA]'}`}>
                                        {item.label}
                                    </span>
                                </div>
                                {item.badge && (
                                    <div className="bg-[#f87171]/20 text-[#f87171] text-[10px] px-2 py-0.5 rounded-full">
                                        {item.badge}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Profile */}
            <div className="px-[15px] pt-4 pb-3 border-t border-[#3A3A3C] w-full flex items-center justify-between transition-colors duration-300">
                <div className="flex items-center gap-3 hover:bg-[#2C2C2E] p-1.5 -ml-1.5 rounded-lg cursor-pointer transition-colors duration-300">
                    <div className="w-10 h-10 rounded-full bg-[#c3c2b7] text-[#1F1F1E] flex items-center justify-center text-[16px] font-bold tracking-tighter -ml-[2px]">
                        JK
                    </div>
                    <div className="flex flex-col">
                        <span className="font-normal text-[14px] leading-tight mb-0.5 text-white">Jeon Kiyoung</span>
                        <span className="text-gray-400 text-[12px] leading-none font-normal">CFT 총괄</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
