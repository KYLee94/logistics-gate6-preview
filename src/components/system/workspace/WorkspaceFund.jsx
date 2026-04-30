import React from 'react';

export default function WorkspaceFund() {
    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header Metadata */}
            <div className="w-full flex justify-between items-end mb-[36px]">
                <div>
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">펀드 운용 (KAM)</h1>
                    <p className="text-[15px] text-[#86868B]">LP 커뮤니케이션·자본콜·자금집행·회계/세무·컴플라이언스</p>
                </div>
                
                <div className="flex items-center h-[48px] border border-[#333] rounded-[16px] bg-[#1A1A1A] px-2">
                    <div className="flex flex-col items-center justify-center h-full px-[16px]">
                        <span className="text-[12px] text-[#666] font-normal -mb-[2px] font-['Inter']">Lead</span>
                        <span className="text-[15px] font-bold text-[#E5E5E5] tracking-tight"><span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">김행단</span></span>
                    </div>
                    <div className="w-px h-[24px] bg-[#333]"></div>
                    <div className="flex flex-col items-center justify-center h-full px-[16px]">
                        <span className="text-[12px] text-[#666] font-normal -mb-[2px] font-['Inter']">Target Vehicle</span>
                        <span className="text-[15px] font-bold text-[#A1A1AA] tracking-tight">421호 펀드</span>
                    </div>
                </div>
            </div>
            
            {/* Top 3 KPI Cards */}
            <div className="flex w-full gap-[24px] mb-[40px]">
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#fbf167]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">자본콜 누적 집행률</h3>
                    <div className="text-[42px] font-black text-white">85<span className="text-[20px] text-[#A1A1AA]">%</span></div>
                    <div className="w-full bg-[#1A1A1A] h-2 rounded-full mt-4"><div className="h-full bg-[#fbf167] rounded-full w-[85%]"></div></div>
                </div>
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#34d399]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">LP 만족도 (NPS)</h3>
                    <div className="text-[42px] font-black text-white">72<span className="text-[20px] text-[#A1A1AA]">점</span></div>
                    <p className="text-[13px] text-[#A1A1AA] mt-2">단일 채널 보고 체계 정착</p>
                </div>
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#e11d48]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">Pending Q&A</h3>
                    <div className="text-[42px] font-black text-white">0<span className="text-[16px] font-normal text-[#A1A1AA] ml-2">건</span></div>
                    <p className="text-[13px] text-[#34d399] mt-2">모든 LP 질의 종결</p>
                </div>
            </div>

            {/* Action Log */}
            <h2 className="text-[18px] font-bold text-white mb-[16px]">LP 보고 및 결재 로그</h2>
            <div className="flex flex-col gap-3">
                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[20px] flex items-center hover:border-[#555] transition-colors">
                    <div className="w-[120px]"><span className="text-[13px] text-[#86868B] font-medium">2026-04-04</span></div>
                    <div className="w-[100px]"><span className="text-[12px] px-2 py-0.5 bg-[#222] border border-[#333] text-[#A1A1AA] rounded">421호</span></div>
                    <div className="flex-1 px-4 border-l border-[#333]">
                        <span className="text-[15px] font-bold text-white">Q1 LP 분기보고 발송 + Q&A 5건 종결</span>
                    </div>
                    <div className="w-[100px] text-right">
                        <span className="text-[13px] text-[#666] font-bold">Closed</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
