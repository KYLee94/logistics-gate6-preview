import React, { useState } from 'react';
import WorkspaceActivityLog from './WorkspaceActivityLog';

export default function WorkspaceIpr() {
    const [activeTab, setActiveTab] = useState(0);

    return (
                <div className="w-full flex-1 flex flex-col pt-[50px] pb-[100px] max-w-[1200px] mx-auto">
            {/* Header & Team Structure */}
            <div className="w-full flex justify-between items-center mb-[40px] gap-[40px]">
                {/* Header Metadata */}
                <div className="shrink-0 max-w-none whitespace-nowrap">
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">IPR Working Group</h1>
                    <p className="text-[15px] text-[#86868B] leading-[24px]">이오타 CFT는 프리츠 TFT와의 인터페이스를 ‘IPR 워킹그룹(IPR-WG)’ 형태로 운영합니다.</p>
                </div>
                
                {/* Team Structure */}
                <div className="border border-[#333] rounded-[24px] flex items-center bg-transparent shrink-0 pl-[20px] pr-[18px] py-[10px]">

                    {/* 투자 */}
                    <div className="w-[40px] shrink-0">
                        <span className="text-[13px] font-bold text-[#86868B]">투자</span>
                    </div>
                    <div className="flex items-center gap-[12px] w-[126px] shrink-0">
                        <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                            <img src={`${import.meta.env.BASE_URL}권순일.webp`} alt="권순일" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                            <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-white font-bold text-[13px] leading-tight">권순일</span>
                            <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">사업1파트장</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-1.5 gap-y-2 -ml-[6px]">
                        <span className="text-[#A1A1AA] text-[13px] font-medium leading-none ml-[6px]">사업1파트 실무진</span>
                    </div>

                    {/* Vertical Separator */}
                    <div className="w-px h-[30px] bg-[#333] mx-[20px]"></div>

                    {/* 관리 */}
                    <div className="w-[40px] shrink-0">
                        <span className="text-[13px] font-bold text-[#86868B]">관리</span>
                    </div>
                    <div className="flex items-center gap-[12px] w-[120px] shrink-0">
                        <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                            <img src={`${import.meta.env.BASE_URL}윤용택.webp`} alt="윤용택" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                            <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-white font-bold text-[13px] leading-tight">윤용택</span>
                            <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">사업3파트</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-1.5 gap-y-2 -ml-[6px]">
                        <span className="text-[#A1A1AA] text-[13px] font-medium leading-none ml-[6px]">신규 영입 예정</span>
                    </div>
                </div>
            </div>

            <WorkspaceActivityLog workspaceCode="WS_IPR" workspaceLabel="IPR" />
            
            <div className="w-full border-b border-[#333] mt-[20px] mb-[40px]"></div>

            <div className="pb-[40px]">
            <h2 className="text-[20px] font-bold text-white mb-[16px]">Forward Purchase 구조 설계 5단계</h2>
            
            <div className="flex flex-col gap-[12px]">
                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#bbb9af]">Stage 0</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-white block mb-1">조기 의향 확인</span>
                        <span className="text-[15px] text-[#A1A1AA]">프리츠 TFT가 이오타 자산을 IPR 편입 후보로 ‘예비등록’</span>
                    </div>
                </div>

                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#fbf167]">Stage 1</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-[#fbf167] block mb-1">옵션 설계</span>
                        <span className="text-[15px] text-[#A1A1AA]">가격결정 메커니즘(고정/변동), 인도시점, 옵션 수수료 구조</span>
                    </div>
                </div>

                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#bbb9af]">Stage 2</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-white block mb-1">권순약정 초안</span>
                        <span className="text-[15px] text-[#A1A1AA]">외부 법무자문 선정 → 권순약정·우선매수약정 초안 작성</span>
                    </div>
                </div>

                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#bbb9af]">Stage 3</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-white block mb-1">외부 검증</span>
                        <span className="text-[15px] text-[#A1A1AA]">회계자문(세무)·감정평가(가격) 병렬 진행, 시나리오별 IRR/Cap Rate 검증</span>
                    </div>
                </div>

                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#bbb9af]">Stage 4</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-white block mb-1">LP 사전 통지</span>
                        <span className="text-[15px] text-[#A1A1AA]">421호 펀드 LP에 IPR 편입 시나리오 사전 통지·의향 청취</span>
                    </div>
                </div>

                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#bbb9af]">Stage 5</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-white block mb-1">약정 체결·공시</span>
                        <span className="text-[15px] text-[#A1A1AA]">정식 권순약정 체결 후 운용보고에 반영</span>
                    </div>
                </div>
            </div>

            <div className="mt-[56px] pt-[48px] border-t border-[#333]">
                <h2 className="text-[20px] font-bold text-white mb-[8px]">외부 자문 선정 프로세스</h2>
                <p className="text-[15px] text-[#A1A1AA] leading-[26px] mb-[24px]">
                    법무·회계·감정 3개 분야 모두 <strong className="text-white font-bold">‘이오타 전담’</strong> 자문사를 별도 선정합니다. 부문 전체 자문사 풀과는 분리하여 이해상충을 최소화합니다.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-[16px]">
                    <div className="bg-[#1A1A1A] rounded-[16px] p-[24px] flex flex-col gap-[12px] border border-[#333] hover:border-[#555] transition-colors">
                        <div className="flex items-center gap-[8px]">
                            <div className="w-[8px] h-[8px] rounded-full bg-[#2997FF]"></div>
                            <h3 className="text-[17px] font-bold text-white">법무</h3>
                        </div>
                        <p className="text-[15px] text-[#A1A1AA] leading-[24px]">
                            부동산금융·REITs·M&A 모두 가능한 펌 + 송무 보강 펌의 <strong className="text-[#E5E5E5] font-bold">듀얼 트랙</strong>
                        </p>
                    </div>
                    <div className="bg-[#1A1A1A] rounded-[16px] p-[24px] flex flex-col gap-[12px] border border-[#333] hover:border-[#555] transition-colors">
                        <div className="flex items-center gap-[8px]">
                            <div className="w-[8px] h-[8px] rounded-full bg-[#2997FF]"></div>
                            <h3 className="text-[17px] font-bold text-white">회계</h3>
                        </div>
                        <p className="text-[15px] text-[#A1A1AA] leading-[24px]">
                            빅 4 중 1개사로 세무·검토·자문 분리 계약, <strong className="text-[#E5E5E5] font-bold">감사인은 별도 풀에서 지정</strong>
                        </p>
                    </div>
                    <div className="bg-[#1A1A1A] rounded-[16px] p-[24px] flex flex-col gap-[12px] border border-[#333] hover:border-[#555] transition-colors">
                        <div className="flex items-center gap-[8px]">
                            <div className="w-[8px] h-[8px] rounded-full bg-[#2997FF]"></div>
                            <h3 className="text-[17px] font-bold text-white">감정</h3>
                        </div>
                        <p className="text-[15px] text-[#A1A1AA] leading-[24px]">
                            2개사 병렬 평가, 차이 5% 초과 시 <strong className="text-[#E5E5E5] font-bold">제 3자 평가 트리거</strong>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
    );
}
