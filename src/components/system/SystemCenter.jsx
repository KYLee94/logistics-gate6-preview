import React from 'react';

export default function SystemCenter() {
    return (
        <div className="flex-1 h-full bg-transparent flex flex-col relative font-sans text-[#E5E5E5] px-6 overflow-y-auto hide-scrollbar">
            
            {/* Top Header (Original preserved) */}
            <div className="w-full flex justify-between items-start pt-[20px] shrink-0">
                <div className="flex flex-col">
                    <span className="text-[18px] text-[#A1A1AA] font-normal tracking-tight">
                        프로젝트 상세 / 더케이트윈타워
                    </span>
                </div>
                {/* Changed ... to ··· (middle dots) */}
                <div className="text-[#A1A1AA] hover:text-[#E5E5E5] cursor-pointer pt-0 tracking-[3px] font-black text-[16px]">
                    ···
                </div>
            </div>

            {/* 컨텐츠 영역 (반응형 무시, 1000px 고정 폭 적용) */}
            <div className="w-[1000px] mx-auto shrink-0 flex flex-col mt-10 pb-20">
                {/* Empty Context Indicator centered */}
                <div className="flex-1 flex justify-center items-center pb-20 mt-40">
                    <span className="text-[40px] text-[#A1A1AA] font-medium tracking-tight">
                        Contents
                    </span>
                </div>
            </div>
            
        </div>
    );
}
