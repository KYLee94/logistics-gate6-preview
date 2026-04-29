import React from 'react';

export default function GovRoadmap() {
    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">90 Day Roadmap</h1>
            <p className="text-[15px] text-[#86868B] mb-[40px]">리파이낸싱 종결을 D-Day로 두고, 90일 안에 통합 수행체계의 ‘1차 안정 상태’를 달성한다.</p>
            
            <div className="flex w-full gap-[24px]">
                {/* D+30 */}
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[32px] relative overflow-hidden group hover:border-[#555] transition-colors">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#A1A1AA]"></div>
                    <h2 className="text-[28px] font-black text-white tracking-tighter mb-[24px]">D+30</h2>
                    <ul className="flex flex-col gap-[16px]">
                        <li className="flex items-start gap-3">
                            <span className="text-[#A1A1AA] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">CFT 운영규정·RACI 픽스</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#A1A1AA] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">통합 데이터룸 v0 오픈</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#A1A1AA] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">주간 Stand-up 가동</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#A1A1AA] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">대외 단일창구 매트릭스 통보</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#A1A1AA] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">421호 LP 진척보고 v1 발송</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#A1A1AA] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">프로젝트리츠 TFT와 킥오프</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#A1A1AA] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">외부 법무·회계 후보 롱리스트</span>
                        </li>
                    </ul>
                </div>

                {/* D+60 */}
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[32px] relative overflow-hidden group hover:border-[#555] transition-colors">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#fbf167]"></div>
                    <h2 className="text-[28px] font-black text-white tracking-tighter mb-[24px]">D+60</h2>
                    <ul className="flex flex-col gap-[16px]">
                        <li className="flex items-start gap-3">
                            <span className="text-[#fbf167] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">격주 Steering·월간 임원보고 정착</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#fbf167] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">변경관리(Change Order) SOP 배포</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#fbf167] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">대주단 Covenants 모니터링 보드 가동</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#fbf167] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">공정·예산 슬리피지 보드 가동</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#fbf167] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">IPR 구조설계 옵션 1차 보고</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#fbf167] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">감정평가 기관 파일럿 진행</span>
                        </li>
                    </ul>
                </div>

                {/* D+90 */}
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[32px] relative overflow-hidden group hover:border-[#555] transition-colors">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#e11d48]"></div>
                    <h2 className="text-[28px] font-black text-white tracking-tighter mb-[24px]">D+90</h2>
                    <ul className="flex flex-col gap-[16px]">
                        <li className="flex items-start gap-3">
                            <span className="text-[#e11d48] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">분기 회고 세션 1차 운영</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#e11d48] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">OKR/KPI 1차 리뷰</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#e11d48] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">LP 분기보고 정례화</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#e11d48] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">리스크 Top10 등록·할당 완료</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#e11d48] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">IPR 권순일 약정 초안 검토</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#e11d48] mt-[2px]">•</span>
                            <span className="text-[15px] text-[#E5E5E5] leading-[22px]">프로젝트리츠 TFT와 인터페이스 규약 합의</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
