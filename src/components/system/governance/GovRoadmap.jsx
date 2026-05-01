import React from 'react';

export default function GovRoadmap() {
    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1112px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">90 Day Roadmap</h1>
            <p className="text-[16px] text-[#86868B] mb-[4px]">리파이낸싱 종결을 D-Day로 두고, 90일 안에 통합 수행체계의 ‘1차 안정 상태’를 달성합니다.</p>
            <p className="text-[16px] text-[#86868B] mb-[40px]">본 로드맵은 경영진 보고용 High-level 수준의 요약본입니다. 개별 태스크의 실행과 검증은 RACI 체계 및 지정된 회의체(운영위, 주간 Stand-up 등)를 통해 상세화됩니다.</p>
            
            <div className="flex flex-col w-full gap-[24px]">
                {/* D+30 */}
                <div className="flex w-full items-stretch gap-[24px]">
                    <div className="w-[80px] shrink-0 flex flex-col justify-center items-end pr-[4px]">
                        <h2 className="text-[28px] font-black text-white tracking-tighter leading-none">D+30</h2>
                    </div>
                    <div className="flex-1 bg-[#272726] border border-[#3c3c3c] rounded-[24px] px-[32px] pt-[28px] pb-[28px] hover:border-[#555] transition-colors">
                        <div className="flex w-full gap-[32px]">
                        <div className="flex-1">
                            <h3 className="text-[13px] font-bold text-[#A1A1AA] bg-[#171716] px-3 py-1 rounded-[8px] inline-block mb-[16px]">CFT 거버넌스</h3>
                            <ul className="flex flex-col gap-[12px]">
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">CFT 운영규정·RACI 픽스</span>
                                </li>
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">통합 플랫폼 오픈, 주간 Stand-up 가동</span>
                                </li>
                            </ul>
                        </div>
                        
                        <div className="flex-1">
                            <h3 className="text-[13px] font-bold text-[#A1A1AA] bg-[#171716] px-3 py-1 rounded-[8px] inline-block mb-[16px]">PFV / 펀드</h3>
                            <ul className="flex flex-col gap-[12px]">
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">대외 단일창구 매트릭스 통보</span>
                                </li>
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">421호 LP 진척보고 v1 발송</span>
                                </li>
                            </ul>
                        </div>

                        <div className="flex-1">
                            <h3 className="text-[13px] font-bold text-[#A1A1AA] bg-[#171716] px-3 py-1 rounded-[8px] inline-block mb-[16px]">IPR 사전 준비</h3>
                            <ul className="flex flex-col gap-[12px]">
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">프로젝트리츠 TFT와 킥오프</span>
                                </li>
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">외부 법무·회계 후보 롱리스트</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    </div>
                </div>

                {/* D+60 */}
                <div className="flex w-full items-stretch gap-[24px]">
                    <div className="w-[80px] shrink-0 flex flex-col justify-center items-end pr-[4px]">
                        <h2 className="text-[28px] font-black text-white tracking-tighter leading-none">D+60</h2>
                    </div>
                    <div className="flex-1 bg-[#272726] border border-[#3c3c3c] rounded-[24px] px-[32px] pt-[28px] pb-[28px] hover:border-[#555] transition-colors">
                        <div className="flex w-full gap-[32px]">
                        <div className="flex-1">
                            <h3 className="text-[13px] font-bold text-[#A1A1AA] bg-[#171716] px-3 py-1 rounded-[8px] inline-block mb-[16px]">CFT 거버넌스</h3>
                            <ul className="flex flex-col gap-[12px]">
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">격주 Steering·월간 임원보고 정착</span>
                                </li>
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">변경관리(Change Order) SOP 배포</span>
                                </li>
                            </ul>
                        </div>
                        
                        <div className="flex-1">
                            <h3 className="text-[13px] font-bold text-[#A1A1AA] bg-[#171716] px-3 py-1 rounded-[8px] inline-block mb-[16px]">PFV / 펀드</h3>
                            <ul className="flex flex-col gap-[12px]">
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">대주단 Covenants 모니터링 보드 가동</span>
                                </li>
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">공정·예산 슬리피지 보드 가동</span>
                                </li>
                            </ul>
                        </div>

                        <div className="flex-1">
                            <h3 className="text-[13px] font-bold text-[#A1A1AA] bg-[#171716] px-3 py-1 rounded-[8px] inline-block mb-[16px]">IPR 사전 준비</h3>
                            <ul className="flex flex-col gap-[12px]">
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">IPR 구조설계 옵션 1차 보고</span>
                                </li>
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">감정평가 기관 파일럿 진행</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    </div>
                </div>

                {/* D+90 */}
                <div className="flex w-full items-stretch gap-[24px]">
                    <div className="w-[80px] shrink-0 flex flex-col justify-center items-end pr-[4px]">
                        <h2 className="text-[28px] font-black text-white tracking-tighter leading-none">D+90</h2>
                    </div>
                    <div className="flex-1 bg-[#272726] border border-[#3c3c3c] rounded-[24px] px-[32px] pt-[28px] pb-[28px] hover:border-[#555] transition-colors">
                        <div className="flex w-full gap-[32px]">
                        <div className="flex-1">
                            <h3 className="text-[13px] font-bold text-[#A1A1AA] bg-[#171716] px-3 py-1 rounded-[8px] inline-block mb-[16px]">CFT 거버넌스</h3>
                            <ul className="flex flex-col gap-[12px]">
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">분기 회고 세션 1차 운영</span>
                                </li>
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">OKR/KPI 1차 리뷰</span>
                                </li>
                            </ul>
                        </div>
                        
                        <div className="flex-1">
                            <h3 className="text-[13px] font-bold text-[#A1A1AA] bg-[#171716] px-3 py-1 rounded-[8px] inline-block mb-[16px]">PFV / 펀드</h3>
                            <ul className="flex flex-col gap-[12px]">
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">LP 분기보고 정례화</span>
                                </li>
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">리스크 Top10 등록·할당 완료</span>
                                </li>
                            </ul>
                        </div>

                        <div className="flex-1">
                            <h3 className="text-[13px] font-bold text-[#A1A1AA] bg-[#171716] px-3 py-1 rounded-[8px] inline-block mb-[16px]">IPR 사전 준비</h3>
                            <ul className="flex flex-col gap-[12px]">
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">IPR 권순일 약정 초안 검토</span>
                                </li>
                                <li className="flex items-start gap-[8px]">
                                    <div className="w-[4px] h-[4px] rounded-full bg-[#A1A1AA] mt-[10px] shrink-0"></div>
                                    <span className="text-[16px] text-[#E5E5E5] leading-[24px]">프로젝트리츠 TFT와 인터페이스 규약 합의</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
