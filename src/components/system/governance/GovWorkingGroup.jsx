import React from 'react';

export default function GovWorkingGroup() {
    return (
        <div className="w-full flex-1 flex flex-col pt-[60px] pb-[160px] max-w-[1112px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[8px]">프로젝트리츠 워킹그룹</h1>
            <p className="text-[16px] text-[#86868B] mb-[40px] leading-[26px]">이오타 CFT는 프리츠 TFT와의 인터페이스를 ‘IPR 워킹그룹(IPR-WG)’ 형태로 운영합니다.<br />IPR-WG는 격주 1회 정기 회의를 가지며, CFT 측은 (i) 강순용 PM, (ii) 박준호 LFC, (iii) 김행단 KAM 1파트, <br />프리츠 TFT 측은 (i) 권순일 투자담당, (ii) 윤용택 관리담당이 고정 멤버로 참석합니다.</p>
            
            <div className="w-full bg-[#1A1A1A] border border-[#e11d48]/50 rounded-[24px] p-[32px] mb-[40px] relative overflow-hidden">
                
                <h3 className="text-[18px] font-bold text-white mb-[12px]">
                    이해상충 방지를 위한 분리 원칙
                </h3>
                <p className="text-[16px] text-[#E5E5E5] leading-[28px]">
                    <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">권순일</span>(IPR 트랙 투자담당, 사업1파트장)은 IPR 가격결정·구조설계의 <strong>‘매수자 측’</strong> 의사결정자이다.<br/>
                    <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">강순용</span>(PM, 사업2파트장)은 PFV·421호 펀드의 <strong>‘매도자 측’</strong> 의사결정자이다.<br/>
                    양자가 동일 안건에 대해 동시에 결정권을 갖지 않도록, IPR 편입 의향 회신 단계에서는 CFT 총괄(<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">이철승</span> 부문대표)이 최종 승인 권한을 보유한다.<br/>
                    단, 가격·조건의 사실관계 검토는 양자가 ‘공동 검토자’로 참여 가능하다.
                </p>
            </div>

            <h2 className="text-[20px] font-bold text-white mb-[24px]">Forward Purchase 구조 설계 5단계</h2>
            
            <div className="flex flex-col gap-4">
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
                <p className="text-[15px] text-[#A1A1AA] leading-[26px] mb-[28px]">
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
    );
}
