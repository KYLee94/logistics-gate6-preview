import React from 'react';

export default function DecisionLog() {
    return (
        <div className="w-[1200px] mx-auto flex-1 flex flex-col pt-[77px] shrink-0 pb-[60px]">
            <div className="w-full flex justify-between items-end mb-[26px]">
                <h1 className="text-[36px] font-bold text-[#1D1D1F] dark:text-white tracking-tight leading-none font-['Inter'] -translate-y-[1px] translate-x-[4px]">의사결정 로그</h1>
            </div>
            
            <div className="w-full flex-1 flex flex-col items-center justify-center bg-white dark:bg-[#1C1C1E] rounded-[32px] border border-black/10 dark:border-[#2C2C2E] shadow-sm min-h-[400px]">
                <div className="w-16 h-16 mb-6 text-[#86868B]">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <h2 className="text-[24px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#E5E5E5]">의사결정 로그</h2>
                <p className="mt-2 text-[15px] text-[#86868B] dark:text-[#A1A1AA]">데이터 및 컴포넌트 뼈대 구조화 대기 중</p>
            </div>
        </div>
    );
}
