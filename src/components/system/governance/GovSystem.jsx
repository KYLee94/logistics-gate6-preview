import React from 'react';

export default function GovSystem() {
    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[36px]">통합 수행체계</h1>
            
            <div className="w-full bg-[#292928] border border-[#3c3c3c] rounded-[32px] p-[32px] flex flex-col relative">
                <h2 className="text-[18px] font-bold text-white mb-[24px]">4대 축 (Tier)</h2>
                
                {/* 1. 내부 CFT */}
                <div className="flex items-start mb-[24px]">
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
                            <span className="text-[15px] text-[#c3c2b7]">사업2파트 강순용(Co-PM:사업)<br/>사업1파트 권순일(Co-PM:전략)</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">핵심 산출물</span>
                            <span className="text-[15px] text-[#86868B]">CFT 운영규정 / RACI / 회의체 캘린더</span>
                        </div>
                    </div>
                </div>

                {/* 2. 421호 펀드 */}
                <div className="flex items-start mb-[24px]">
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
                            <span className="text-[15px] text-[#c3c2b7]">KAM·자산관리(김행단 1파트)<br/>운용지원·자금·회계 라인</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">핵심 산출물</span>
                            <span className="text-[15px] text-[#86868B]">LP 보고서 / 자본콜 매뉴얼 / 자금집행 SOP</span>
                        </div>
                    </div>
                </div>

                {/* 3. PFV 2개 기구 */}
                <div className="flex items-start mb-[24px]">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[15px] font-bold text-[#86868B]">③ PFV 2개 기구</span>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-[24px]">
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">주관 (Accountable)</span>
                            <span className="text-[15px] text-white">Iota1(427), Iota2(816)<br/>(강순용 & 권순일)</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">실행 (Responsible)</span>
                            <span className="text-[15px] text-[#c3c2b7]">LFC 박준호(파이낸싱)<br/>개발솔루션 홍장군(설계·시공)<br/>상품솔루션 김현수(상품/기술)<br/>EMC 김민지(LM 및 기업마케팅)</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">핵심 산출물</span>
                            <span className="text-[15px] text-[#86868B]">대외 단일창구 매트릭스 / 변경관리 절차</span>
                        </div>
                    </div>
                </div>

                {/* 4. IPR 워킹그룹 */}
                <div className="flex items-start">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[15px] font-bold text-[#86868B]">④ IPR 워킹그룹</span>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-[24px]">
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">주관 (Accountable)</span>
                            <span className="text-[15px] text-white">프로젝트리츠 TFT<br/>권순일(투자) / 윤용택(관리)</span>
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
