import React from 'react';

export default function WorkspaceDigital() {
    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header Metadata */}
            <div className="w-full flex justify-between items-end mb-[36px]">
                <div>
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">상품·디지털</h1>
                    <p className="text-[15px] text-[#86868B]">상품 차별화 전략·POC, 테넌트 경험 설계, 디지털 인프라(보안·통신·DC)</p>
                </div>
                
                <div className="flex items-center h-[48px] border border-[#333] rounded-[16px] bg-[#1A1A1A] px-2">
                    <div className="flex flex-col items-center justify-center h-full px-[16px]">
                        <span className="text-[12px] text-[#666] font-normal -mb-[2px] font-['Inter']">Lead</span>
                        <span className="text-[15px] font-bold text-[#E5E5E5] tracking-tight"><span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">김현수</span> / <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">현철호</span></span>
                    </div>
                    <div className="w-px h-[24px] bg-[#333]"></div>
                    <div className="flex flex-col items-center justify-center h-full px-[16px]">
                        <span className="text-[12px] text-[#666] font-normal -mb-[2px] font-['Inter']">Members</span>
                        <span className="text-[15px] font-bold text-[#A1A1AA] tracking-tight">2명</span>
                    </div>
                </div>
            </div>
            
            {/* Top 3 KPI Cards */}
            <div className="flex w-full gap-[24px] mb-[40px]">
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#a855f7]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">디지털 트윈 적용률</h3>
                    <div className="text-[42px] font-black text-white">45<span className="text-[20px] text-[#A1A1AA]">%</span></div>
                    <div className="w-full bg-[#1A1A1A] h-2 rounded-full mt-4"><div className="h-full bg-[#a855f7] rounded-full w-[45%]"></div></div>
                </div>
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#fbf167]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">PoC 진척도</h3>
                    <div className="text-[42px] font-black text-white">3<span className="text-[16px] font-normal text-[#A1A1AA] ml-2">/ 5 건</span></div>
                    <p className="text-[13px] text-[#A1A1AA] mt-2">출입 보안, 주차 관제 연동 완료</p>
                </div>
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#34d399]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">인프라 구축 예산율</h3>
                    <div className="text-[42px] font-black text-white">92<span className="text-[20px] text-[#A1A1AA]">%</span></div>
                    <p className="text-[13px] text-[#A1A1AA] mt-2">정상 예산 내 집행 중</p>
                </div>
            </div>

            <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-[24px] p-[32px] flex flex-col items-center justify-center min-h-[300px]">
                <svg className="w-16 h-16 text-[#444] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                <h3 className="text-[18px] font-bold text-white mb-2">스마트 인프라 데이터룸 대기 중</h3>
                <p className="text-[14px] text-[#86868B] text-center max-w-[400px]">디지털 트윈 아키텍처 및 테넌트 앱 POC 결과 보고서가 업로드되면 이곳에 연동됩니다.</p>
            </div>
        </div>
    );
}
