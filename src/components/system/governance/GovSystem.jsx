import React from 'react';

export default function GovSystem() {
    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto overflow-y-auto hide-scrollbar">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[36px]">IOTA CFT 통합 수행체계</h1>
            
            <div className="w-full bg-[#1e1e1e] border border-[#333] rounded-[32px] p-[48px] flex flex-col relative mb-[40px] items-center">
                
                {/* 1. PO */}
                <div className="flex flex-col items-center justify-center w-[160px] h-[72px] bg-[#333] rounded-[16px] relative z-10 shadow-lg">
                    <span className="text-[12px] text-[#A1A1AA] font-bold mb-1">PO</span>
                    <span className="text-[16px] font-bold text-white hover:text-[#fbf167] cursor-pointer transition-colors">이철승</span>
                </div>

                <div className="w-px h-[24px] bg-[#666]"></div>

                {/* 2. Sub PO */}
                <div className="flex flex-col items-center justify-center w-[160px] h-[72px] bg-[#333] rounded-[16px] relative z-10 shadow-lg">
                    <span className="text-[12px] text-[#A1A1AA] font-bold mb-1">Sub PO</span>
                    <span className="text-[16px] font-bold text-white"><span className="hover:text-[#fbf167] cursor-pointer transition-colors">윤관식</span> <span className="hover:text-[#fbf167] cursor-pointer transition-colors ml-1">정조민</span></span>
                </div>

                <div className="w-px h-[24px] bg-[#666]"></div>

                {/* 3. 3-way branch */}
                <div className="relative w-[480px] h-[16px]">
                    <div className="absolute top-0 left-0 w-full border-t border-[#666]"></div>
                    <div className="absolute top-0 left-0 w-px h-[16px] bg-[#666]"></div>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-[16px] bg-[#666]"></div>
                    <div className="absolute top-0 right-0 w-px h-[16px] bg-[#666]"></div>
                </div>

                {/* 3 Nodes */}
                <div className="flex justify-between w-[520px] relative z-10">
                    <div className="flex flex-col items-center justify-center w-[140px] h-[72px] bg-[#333] rounded-[16px] shadow-lg">
                        <span className="text-[15px] font-bold text-white">사업1파트</span>
                    </div>
                    <div className="flex flex-col items-center justify-center w-[160px] h-[72px] bg-[#333] rounded-[16px] shadow-lg">
                        <span className="text-[12px] text-[#A1A1AA] font-bold mb-1">Co-PM</span>
                        <span className="text-[16px] font-bold text-white"><span className="hover:text-[#fbf167] cursor-pointer transition-colors">권순일</span> <span className="hover:text-[#fbf167] cursor-pointer transition-colors ml-1">강순용</span></span>
                    </div>
                    <div className="flex flex-col items-center justify-center w-[140px] h-[72px] bg-[#333] rounded-[16px] shadow-lg">
                        <span className="text-[15px] font-bold text-white">사업2파트</span>
                    </div>
                </div>

                {/* Arrows down to missions */}
                <div className="flex justify-between w-[480px] mt-2 mb-2">
                    <div className="flex flex-col items-center relative">
                        <div className="w-px h-[24px] bg-[#666]"></div>
                        <div className="w-2 h-2 border-b border-r border-[#666] transform rotate-45 absolute bottom-0 translate-y-1/2"></div>
                    </div>
                    <div className="flex flex-col items-center relative">
                        <div className="w-px h-[24px] bg-[#666]"></div>
                        <div className="w-2 h-2 border-b border-r border-[#666] transform rotate-45 absolute bottom-0 translate-y-1/2"></div>
                    </div>
                    <div className="flex flex-col items-center relative">
                        <div className="w-px h-[24px] bg-[#666]"></div>
                        <div className="w-2 h-2 border-b border-r border-[#666] transform rotate-45 absolute bottom-0 translate-y-1/2"></div>
                    </div>
                </div>

                {/* Missions Container */}
                <div className="w-full max-w-[1000px] bg-[#1e293b]/40 border border-[#334155] rounded-[32px] p-[24px] flex justify-between gap-4 relative z-10 shadow-xl">
                    <div className="flex-1 flex flex-col items-center justify-center py-[20px] bg-[#1e293b] rounded-[20px] border border-[#334155] shadow-inner">
                        <span className="text-[11px] text-[#94a3b8] font-bold mb-1">Mission 1</span>
                        <span className="text-[15px] font-bold text-white text-center">CFT 거버넌스 수립</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center py-[20px] bg-[#1e293b] rounded-[20px] border border-[#334155] shadow-inner">
                        <span className="text-[11px] text-[#94a3b8] font-bold mb-1">Mission 2</span>
                        <span className="text-[15px] font-bold text-white text-center">421 Fund 운용</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center py-[20px] bg-[#1e293b] rounded-[20px] border border-[#334155] shadow-inner">
                        <span className="text-[11px] text-[#94a3b8] font-bold mb-1">Mission 3</span>
                        <span className="text-[15px] font-bold text-white text-center">IOTA1/2 PFV 운영</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center py-[20px] bg-[#1e293b] rounded-[20px] border border-[#334155] shadow-inner">
                        <span className="text-[11px] text-[#94a3b8] font-bold mb-1">Mission 4</span>
                        <span className="text-[15px] font-bold text-white text-center">IPR 사전준비</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center py-[20px] bg-[#1e293b] rounded-[20px] border border-[#334155] shadow-inner">
                        <span className="text-[11px] text-[#94a3b8] font-bold mb-1">Mission 5</span>
                        <span className="text-[15px] font-bold text-white text-center">...</span>
                    </div>
                </div>

                {/* Arrows UP from centers */}
                <div className="flex justify-between w-full max-w-[920px] mt-2 mb-2">
                    {[...Array(7)].map((_, i) => (
                        <div key={i} className="flex flex-col items-center relative">
                            <div className="w-2 h-2 border-t border-l border-[#666] transform rotate-45 absolute top-0 -translate-y-1/2"></div>
                            <div className="w-px h-[24px] bg-[#666]"></div>
                        </div>
                    ))}
                </div>

                {/* 7 Centers */}
                <div className="w-full max-w-[1000px] flex justify-between gap-3 relative z-10">
                    <div className="flex-1 flex flex-col items-center justify-center py-[16px] bg-[#333] rounded-[16px] shadow-lg text-center">
                        <span className="text-[11px] text-[#A1A1AA] font-medium mb-1">론파이낸스센터</span>
                        <span className="text-[14px] font-bold text-white hover:text-[#fbf167] cursor-pointer transition-colors">박준호</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center py-[16px] bg-[#333] rounded-[16px] shadow-lg text-center">
                        <span className="text-[11px] text-[#A1A1AA] font-medium mb-1">개발솔루션센터</span>
                        <span className="text-[14px] font-bold text-white hover:text-[#fbf167] cursor-pointer transition-colors">홍장군</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center py-[16px] bg-[#333] rounded-[16px] shadow-lg text-center">
                        <span className="text-[11px] text-[#A1A1AA] font-medium mb-1">기업마케팅센터</span>
                        <span className="text-[14px] font-bold text-white hover:text-[#fbf167] cursor-pointer transition-colors">김민지</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center py-[16px] bg-[#333] rounded-[16px] shadow-lg text-center">
                        <span className="text-[11px] text-[#A1A1AA] font-medium mb-1">공간솔루션센터</span>
                        <span className="text-[14px] font-bold text-white hover:text-[#fbf167] cursor-pointer transition-colors">김현수</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center py-[16px] bg-[#333] rounded-[16px] shadow-lg text-center">
                        <span className="text-[11px] text-[#A1A1AA] font-medium mb-1">디지털사업그룹</span>
                        <span className="text-[14px] font-bold text-white hover:text-[#fbf167] cursor-pointer transition-colors">현철호</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center py-[16px] bg-[#333] rounded-[16px] shadow-lg text-center">
                        <span className="text-[11px] text-[#A1A1AA] font-medium mb-1">KAM</span>
                        <span className="text-[14px] font-bold text-white hover:text-[#fbf167] cursor-pointer transition-colors">김행단</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center py-[16px] bg-[#333] rounded-[16px] shadow-lg text-center">
                        <span className="text-[11px] text-[#A1A1AA] font-medium mb-1">프리츠TF</span>
                        <span className="text-[14px] font-bold text-white"><span className="hover:text-[#fbf167] cursor-pointer transition-colors">권순일</span> <span className="hover:text-[#fbf167] cursor-pointer transition-colors">윤용택</span></span>
                    </div>
                </div>

                {/* Big White Arrow Down */}
                <div className="flex flex-col items-center mt-[32px] mb-[16px]">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                        <path d="M12 5v14M19 12l-7 7-7-7" />
                    </svg>
                </div>

                {/* Single Source of Truth */}
                <div className="flex flex-col items-center text-center">
                    <span className="text-[20px] font-bold text-white tracking-tight mb-1">Single Source of Truth</span>
                    <span className="text-[16px] font-medium text-[#E5E5E5]">보고·승인·리스크 로그 통합</span>
                </div>
            </div>

            {/* 4대 축 List (No Title, Thin Separators) */}
            <div className="w-full bg-[#1A1A1A] border border-[#3c3c3c] rounded-[32px] p-[32px] flex flex-col relative">
                
                {/* 1. 내부 CFT */}
                <div className="flex items-start">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[15px] font-bold text-[#86868B]">① 내부 CFT</span>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-[24px]">
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">주관 (Accountable)</span>
                            <span className="text-[15px] text-white">부문대표 (이철승, CFT 총괄)</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">실행 (Responsible)</span>
                            <span className="text-[15px] text-[#c3c2b7]">사업2파트 <span className="hover:text-[#fbf167] cursor-pointer transition-colors">강순용</span>(Co-PM:사업)<br/>사업1파트 <span className="hover:text-[#fbf167] cursor-pointer transition-colors">권순일</span>(Co-PM:전략)</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">핵심 산출물</span>
                            <span className="text-[15px] text-[#86868B]">CFT 운영규정 / RACI / 회의체 캘린더</span>
                        </div>
                    </div>
                </div>

                <div className="w-full h-px bg-[#333] my-[24px]"></div>

                {/* 2. 421호 펀드 */}
                <div className="flex items-start">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[15px] font-bold text-[#86868B]">② 421호 펀드 운용역</span>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-[24px]">
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">주관 (Accountable)</span>
                            <span className="text-[15px] text-white">사업2파트</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">실행 (Responsible)</span>
                            <span className="text-[15px] text-[#c3c2b7]">KAM·자산관리(<span className="hover:text-[#fbf167] cursor-pointer transition-colors">김행단</span> 1파트)<br/>운용지원·자금·회계 라인</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">핵심 산출물</span>
                            <span className="text-[15px] text-[#86868B]">LP 보고서 / 자본콜 매뉴얼 / 자금집행 SOP</span>
                        </div>
                    </div>
                </div>

                <div className="w-full h-px bg-[#333] my-[24px]"></div>

                {/* 3. PFV 2개 기구 */}
                <div className="flex items-start">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[15px] font-bold text-[#86868B]">③ PFV 2개 기구</span>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-[24px]">
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">주관 (Accountable)</span>
                            <span className="text-[15px] text-white">Iota1(427), Iota2(816)<br/>(<span className="hover:text-[#fbf167] cursor-pointer transition-colors">강순용</span> & <span className="hover:text-[#fbf167] cursor-pointer transition-colors">권순일</span>)</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">실행 (Responsible)</span>
                            <span className="text-[15px] text-[#c3c2b7]">LFC <span className="hover:text-[#fbf167] cursor-pointer transition-colors">박준호</span>(파이낸싱)<br/>개발솔루션 <span className="hover:text-[#fbf167] cursor-pointer transition-colors">홍장군</span>(설계·시공)<br/>상품솔루션 <span className="hover:text-[#fbf167] cursor-pointer transition-colors">김현수</span>(상품/기술)<br/>EMC <span className="hover:text-[#fbf167] cursor-pointer transition-colors">김민지</span>(LM 및 기업마케팅)</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">핵심 산출물</span>
                            <span className="text-[15px] text-[#86868B]">대외 단일창구 매트릭스 / 변경관리 절차</span>
                        </div>
                    </div>
                </div>

                <div className="w-full h-px bg-[#333] my-[24px]"></div>

                {/* 4. IPR 워킹그룹 */}
                <div className="flex items-start">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[15px] font-bold text-[#86868B]">④ IPR 워킹그룹</span>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-[24px]">
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">주관 (Accountable)</span>
                            <span className="text-[15px] text-white">프로젝트리츠 TFT<br/><span className="hover:text-[#fbf167] cursor-pointer transition-colors">권순일</span>(투자) / <span className="hover:text-[#fbf167] cursor-pointer transition-colors">윤용택</span>(관리)</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">실행 (Responsible)</span>
                            <span className="text-[15px] text-[#c3c2b7]">외부 자문(법무·회계·감정)<br/>사업1파트 + KAM 1파트 인력 차출</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">핵심 산출물</span>
                            <span className="text-[15px] text-[#86868B]">Forward Purchase 구조설계서 / 권순약정 초안</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
