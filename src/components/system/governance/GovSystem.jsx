import React from 'react';
import cftImg from '../../../assets/cft.webp';

export default function GovSystem() {
    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto overflow-y-auto hide-scrollbar">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[36px]">IOTA CFT 통합 수행체계</h1>
            
            <div className="w-full flex justify-center mb-[10px] -mt-[30px]">
                <img src={cftImg} alt="IOTA CFT 통합 수행체계" className="w-full max-w-[1200px] object-contain rounded-[16px]" />
            </div>

            {/* 4대 축 List */}
            <div className="w-full max-w-[1100px] mx-auto bg-[#1A1A1A] border border-[#3c3c3c] rounded-[32px] p-[32px] flex flex-col relative">
                
                <h2 className="text-[18px] font-bold text-white mb-[16px]">4대 미션의 주관 및 실행자</h2>
                <div className="-mx-[32px] w-[calc(100%+64px)] h-px bg-[#333] mb-[24px]"></div>

                {/* 1. 내부 CFT */}
                <div className="flex items-start">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[15px] font-bold text-white">① 내부 CFT</span>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-[24px]">
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">주관 (Accountable)</span>
                            <span className="text-[15px] text-white"><span className="font-bold">부문대표</span> (이철승, CFT 총괄)</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">실행 (Responsible)</span>
                            <span className="text-[15px] text-[#c3c2b7]"><span className="font-bold">사업2파트</span> <span className="font-bold hover:text-[#fbf167] cursor-pointer transition-colors">강순용</span>(Co-PM:사업)<br/><span className="font-bold">사업1파트</span> <span className="font-bold hover:text-[#fbf167] cursor-pointer transition-colors">권순일</span>(Co-PM:전략)</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">핵심 산출물</span>
                            <span className="text-[15px] text-[#c3c2b7]">CFT 운영규정 / RACI / 회의체 캘린더</span>
                        </div>
                    </div>
                </div>

                <div className="-mx-[32px] w-[calc(100%+64px)] h-px bg-[#333] my-[24px]"></div>

                {/* 2. 421호 펀드 */}
                <div className="flex items-start">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[15px] font-bold text-white">② 421호 펀드 운용역</span>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-[24px]">
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">주관 (Accountable)</span>
                            <span className="text-[15px] text-white font-bold">사업2파트</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">실행 (Responsible)</span>
                            <span className="text-[15px] text-[#c3c2b7]">KAM·자산관리(<span className="hover:text-[#fbf167] cursor-pointer transition-colors">김행단</span> 1파트)<br/>운용지원·자금·회계 라인</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">핵심 산출물</span>
                            <span className="text-[15px] text-[#c3c2b7]">LP 보고서 / 자본콜 매뉴얼 / 자금집행 SOP</span>
                        </div>
                    </div>
                </div>

                <div className="-mx-[32px] w-[calc(100%+64px)] h-px bg-[#333] my-[24px]"></div>

                {/* 3. PFV 2개 기구 */}
                <div className="flex items-start">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[15px] font-bold text-white">③ PFV 2개 기구</span>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-[24px]">
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">주관 (Accountable)</span>
                            <span className="text-[15px] text-white">Iota1(427), Iota2(816)<br/><span className="font-bold hover:text-[#fbf167] cursor-pointer transition-colors">강순용</span> <span className="font-bold">&</span> <span className="font-bold hover:text-[#fbf167] cursor-pointer transition-colors">권순일</span></span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">실행 (Responsible)</span>
                            <span className="text-[15px] text-[#c3c2b7]">LFC <span className="hover:text-[#fbf167] cursor-pointer transition-colors">박준호</span>(파이낸싱)<br/>개발솔루션 <span className="hover:text-[#fbf167] cursor-pointer transition-colors">홍장군</span>(설계·시공)<br/>상품솔루션 <span className="hover:text-[#fbf167] cursor-pointer transition-colors">김현수</span>(상품/기술)<br/>EMC <span className="hover:text-[#fbf167] cursor-pointer transition-colors">김민지</span>(LM 및 기업마케팅)</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">핵심 산출물</span>
                            <span className="text-[15px] text-[#c3c2b7]">대외 단일창구 매트릭스 / 변경관리 절차</span>
                        </div>
                    </div>
                </div>

                <div className="-mx-[32px] w-[calc(100%+64px)] h-px bg-[#333] my-[24px]"></div>

                {/* 4. IPR 워킹그룹 */}
                <div className="flex items-start">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[15px] font-bold text-white">④ IPR 워킹그룹</span>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-[24px]">
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">주관 (Accountable)</span>
                            <span className="text-[15px] text-white"><span className="font-bold">프로젝트리츠 TFT</span><br/><span className="font-bold hover:text-[#fbf167] cursor-pointer transition-colors">권순일</span>(투자) / <span className="font-bold hover:text-[#fbf167] cursor-pointer transition-colors">윤용택</span>(관리)</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">실행 (Responsible)</span>
                            <span className="text-[15px] text-[#c3c2b7]">외부 자문(법무·회계·감정)<br/><span className="font-bold">사업1파트</span> + KAM 1파트 인력 차출</span>
                        </div>
                        <div>
                            <span className="block text-[13px] text-[#666] mb-[4px]">핵심 산출물</span>
                            <span className="text-[15px] text-[#c3c2b7]">Forward Purchase 구조설계서 / 권순약정 초안</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
