import React from 'react';

export default function WorkspaceIpr() {
    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header Metadata */}
            <div className="w-full flex justify-between items-end mb-[36px]">
                <div>
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">IPR (프로젝트 리츠)</h1>
                    <p className="text-[15px] text-[#86868B]">Forward Purchase 권순약정 타임라인 및 밸류에이션 / IPR Working Group</p>
                </div>
                
                <div className="flex items-center h-[48px] border border-[#333] rounded-[16px] bg-[#1A1A1A] px-2">
                    <div className="flex flex-col items-center justify-center h-full px-[16px]">
                        <span className="text-[12px] text-[#666] font-normal -mb-[2px] font-['Inter']">Lead (투자)</span>
                        <span className="text-[15px] font-bold text-[#E5E5E5] tracking-tight"><span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">권순일</span></span>
                    </div>
                    <div className="w-px h-[24px] bg-[#333]"></div>
                    <div className="flex flex-col items-center justify-center h-full px-[16px]">
                        <span className="text-[12px] text-[#666] font-normal -mb-[2px] font-['Inter']">Lead (관리)</span>
                        <span className="text-[15px] font-bold text-[#E5E5E5] tracking-tight"><span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">윤용택</span></span>
                    </div>
                    <div className="w-px h-[24px] bg-[#333]"></div>
                    <div className="flex flex-col items-center justify-center h-full px-[16px]">
                        <span className="text-[12px] text-[#666] font-normal -mb-[2px] font-['Inter']">Stage</span>
                        <span className="text-[15px] font-bold text-[#fbf167] tracking-tight">Stage 1 / 5</span>
                    </div>
                </div>
            </div>
            
            {/* IPR Stage Map */}
            <h2 className="text-[18px] font-bold text-white mb-[16px]">IPR Working Group 진행 단계</h2>
            <div className="w-full bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[32px] mb-[40px] flex justify-between items-center relative">
                <div className="absolute top-1/2 left-[50px] right-[50px] h-[2px] bg-[#333] -translate-y-1/2 z-0"></div>
                <div className="absolute top-1/2 left-[50px] w-[20%] h-[2px] bg-[#fbf167] -translate-y-1/2 z-0 transition-all duration-1000"></div>

                <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#fbf167] flex items-center justify-center text-black font-bold border-4 border-[#292928]">0</div>
                    <span className="text-[12px] text-[#E5E5E5] font-bold">후보 식별</span>
                </div>
                <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#1A1A1A] border-2 border-[#fbf167] flex items-center justify-center text-[#fbf167] font-bold">1</div>
                    <span className="text-[12px] text-[#fbf167] font-bold">옵션 설계</span>
                </div>
                <div className="relative z-10 flex flex-col items-center gap-2 opacity-50">
                    <div className="w-8 h-8 rounded-full bg-[#1A1A1A] border-2 border-[#555] flex items-center justify-center text-[#555] font-bold">2</div>
                    <span className="text-[12px] text-[#A1A1AA] font-bold">권순약정 초안</span>
                </div>
                <div className="relative z-10 flex flex-col items-center gap-2 opacity-50">
                    <div className="w-8 h-8 rounded-full bg-[#1A1A1A] border-2 border-[#555] flex items-center justify-center text-[#555] font-bold">3</div>
                    <span className="text-[12px] text-[#A1A1AA] font-bold">외부 검증</span>
                </div>
                <div className="relative z-10 flex flex-col items-center gap-2 opacity-50">
                    <div className="w-8 h-8 rounded-full bg-[#1A1A1A] border-2 border-[#555] flex items-center justify-center text-[#555] font-bold">4</div>
                    <span className="text-[12px] text-[#A1A1AA] font-bold">LP 통지</span>
                </div>
                <div className="relative z-10 flex flex-col items-center gap-2 opacity-50">
                    <div className="w-8 h-8 rounded-full bg-[#1A1A1A] border-2 border-[#555] flex items-center justify-center text-[#555] font-bold">5</div>
                    <span className="text-[12px] text-[#A1A1AA] font-bold">약정 체결</span>
                </div>
            </div>

            {/* External Partners */}
            <div className="flex gap-[24px]">
                <div className="flex-1 bg-[#1A1A1A] border border-[#333] rounded-[24px] p-[24px]">
                    <h3 className="text-[16px] font-bold text-white mb-[16px]">외부 자문 (듀얼트랙)</h3>
                    <ul className="flex flex-col gap-3">
                        <li className="flex justify-between items-center py-2 border-b border-[#333]">
                            <span className="text-[14px] text-[#A1A1AA]">법무 자문 (REITs/M&A)</span>
                            <span className="text-[14px] text-[#E5E5E5] font-bold">롱리스트 8개사 선정완료</span>
                        </li>
                        <li className="flex justify-between items-center py-2 border-b border-[#333]">
                            <span className="text-[14px] text-[#A1A1AA]">회계 자문 (Big4)</span>
                            <span className="text-[14px] text-[#E5E5E5] font-bold">제안 요청 대기</span>
                        </li>
                        <li className="flex justify-between items-center py-2 border-b border-[#333]">
                            <span className="text-[14px] text-[#A1A1AA]">감정 평가 (병렬)</span>
                            <span className="text-[14px] text-[#E5E5E5] font-bold">평가사 A·B 컨택 전</span>
                        </li>
                    </ul>
                </div>
                <div className="flex-1 bg-[#1A1A1A] border border-[#333] rounded-[24px] p-[24px]">
                    <h3 className="text-[16px] font-bold text-white mb-[16px]">최근 의사결정</h3>
                    <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[16px] flex flex-col">
                        <span className="text-[12px] text-[#86868B] mb-2">2026-04-15</span>
                        <span className="text-[14px] text-white font-medium mb-3">외부 법무 듀얼트랙 후보 롱리스트 8개사 확정</span>
                        <div className="flex justify-between items-center mt-auto">
                            <span className="text-[12px] text-[#666]">결정: <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">권순일</span></span>
                            <span className="text-[12px] text-[#34d399] font-bold">Approved</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
