import React from 'react';

export default function GovWorkingGroup() {
    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">프로젝트리츠 워킹그룹</h1>
            <p className="text-[15px] text-[#86868B] mb-[40px]">이오타 CFT는 프리츠 TFT와의 인터페이스를 ‘IPR 워킹그룹(IPR-WG)’ 형태로 운영합니다.</p>
            
            <div className="w-full bg-[#1A1A1A] border border-[#e11d48]/50 rounded-[24px] p-[32px] mb-[40px] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#e11d48]"></div>
                <h3 className="text-[18px] font-bold text-[#e11d48] mb-[12px] flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    이해상충 방지를 위한 분리 원칙
                </h3>
                <p className="text-[15px] text-[#E5E5E5] leading-[26px]">
                    <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">권순일</span>(IPR 트랙 투자담당, 사업1파트장)은 IPR 가격결정·구조설계의 <strong>‘매수자 측’</strong> 의사결정자이다.<br/>
                    <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">강순용</span>(PM, 사업2파트장)은 PFV·421호 펀드의 <strong>‘매도자 측’</strong> 의사결정자이다.<br/>
                    양자가 동일 안건에 대해 동시에 결정권을 갖지 않도록, IPR 편입 의향 회신 단계에서는 CFT 총괄(<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">이철승</span> 부문대표)이 최종 승인 권한을 보유한다.<br/>
                    단, 가격·조건의 사실관계 검토는 양자가 ‘공동 검토자’로 참여 가능하다.
                </p>
            </div>

            <h2 className="text-[20px] font-bold text-white mb-[24px]">Forward Purchase 구조 설계 5단계</h2>
            
            <div className="flex flex-col gap-4">
                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#555]">Stage 0</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-white block mb-1">조기 의향 확인</span>
                        <span className="text-[14px] text-[#A1A1AA]">프리츠 TFT가 이오타 자산을 IPR 편입 후보로 ‘예비등록’</span>
                    </div>
                </div>

                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#fbf167]">Stage 1</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-[#fbf167] block mb-1">옵션 설계</span>
                        <span className="text-[14px] text-[#A1A1AA]">가격결정 메커니즘(고정/변동), 인도시점, 옵션 수수료 구조</span>
                    </div>
                </div>

                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#555]">Stage 2</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-white block mb-1">권순약정 초안</span>
                        <span className="text-[14px] text-[#A1A1AA]">외부 법무자문 선정 → 권순약정·우선매수약정 초안 작성</span>
                    </div>
                </div>

                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#555]">Stage 3</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-white block mb-1">외부 검증</span>
                        <span className="text-[14px] text-[#A1A1AA]">회계자문(세무)·감정평가(가격) 병렬 진행, 시나리오별 IRR/Cap Rate 검증</span>
                    </div>
                </div>

                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#555]">Stage 4</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-white block mb-1">LP 사전 통지</span>
                        <span className="text-[14px] text-[#A1A1AA]">421호 펀드 LP에 IPR 편입 시나리오 사전 통지·의향 청취</span>
                    </div>
                </div>

                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#555]">Stage 5</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-white block mb-1">약정 체결·공시</span>
                        <span className="text-[14px] text-[#A1A1AA]">정식 권순약정 체결 후 운용보고에 반영</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
