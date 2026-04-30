import React from 'react';

export default function IotaDashboard() {
    return (
        <div className="flex-1 h-full bg-transparent flex flex-col items-center justify-center relative font-sans text-[#E5E5E5] overflow-hidden">
            <div className="w-16 h-16 mb-6 text-[#444]">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            </div>
            <h2 className="text-[24px] font-bold tracking-tight text-[#86868B]">페이지 준비중</h2>
            <p className="mt-2 text-[15px] text-[#666]">해당 메뉴의 콘텐츠와 데이터를 연결 중입니다.</p>
        </div>
    );
}
