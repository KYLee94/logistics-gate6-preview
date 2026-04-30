import React from 'react';

export default function GovPrinciples() {
    return (
        <div className="w-full flex flex-col pt-[77px] pb-[60px] max-w-[1112px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[36px]">5대 의사결정 원칙</h1>
            
            <div className="flex flex-col w-full mb-[32px]">
                <div className="w-full h-px bg-[#333] mb-[24px]"></div>
                
                <div className="flex flex-col">
                    <h3 className="text-[22px] font-bold text-white mb-[8px]">1. 단일 진실의 원칙(Single Source of Truth)</h3>
                    <p className="text-[19px] text-[#c3c2b7] leading-[24px]">모든 보고·KPI·자금흐름 데이터는 통합 데이터룸을 통해서만 인용합니다.</p>
                </div>

                <div className="w-full h-px bg-[#333] my-[24px]"></div>

                <div className="flex flex-col">
                    <h3 className="text-[22px] font-bold text-white mb-[8px]">2. 결정자·승인자 분리 원칙(Two-Lock)</h3>
                    <p className="text-[19px] text-[#c3c2b7] leading-[24px]">일정 또는 비용에 영향이 있는 변경은 PM이 결정자, 부대표/대표가 승인자로 분리됩니다.</p>
                </div>

                <div className="w-full h-px bg-[#333] my-[24px]"></div>

                <div className="flex flex-col">
                    <h3 className="text-[22px] font-bold text-white mb-[8px]">3. UW 범위 안과 밖의 분리 원칙</h3>
                    <p className="text-[19px] text-[#c3c2b7] leading-[24px]">UW 범위 내 변경은 사업파트 co-PM 자율, UW 범위 외는 즉시 부문대표 보고와 LP 통지 절차가 트리거 됩니다.</p>
                </div>

                <div className="w-full h-px bg-[#333] my-[24px]"></div>

                <div className="flex flex-col">
                    <h3 className="text-[22px] font-bold text-white mb-[8px]">4. 이해상충 방화벽 원칙</h3>
                    <p className="text-[19px] text-[#c3c2b7] leading-[24px]">421호 펀드 운용역과 IPR 워킹그룹은 동일 인물이 동시 결정권을 가질 수 없습니다(자문/검토는 가능).</p>
                </div>

                <div className="w-full h-px bg-[#333] my-[24px]"></div>

                <div className="flex flex-col">
                    <h3 className="text-[22px] font-bold text-white mb-[8px]">5. 기록과 복기의 원칙</h3>
                    <p className="text-[19px] text-[#c3c2b7] leading-[24px]">모든 의사결정은 회의록·결정문 형태로 통합 데이터룸에 잔존하며, 매 분기 회고 세션에서의 복기 대상이 됩니다.</p>
                </div>

                <div className="w-full h-px bg-[#333] mt-[24px]"></div>
            </div>

            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[16px] mt-[48px]">4중 평가체계</h1>
            <p className="text-[16px] text-[#A1A1AA] leading-[26px] mb-[32px]">
                부문 평가체계는 1)수익조직 KPI(사업단위 성과), 2) OKR(조직단위 성과), 3) CGC(부문 전체 기여), 4) 경영조직(종합)의 4중 구조입니다. 이오타서울 CFT는 이 구조를 그대로 차용하여 ‘수행 사업 단위 KPI’와 ‘기능 셀 OKR’을 분리 운영합니다.
            </p>

            {/* KPI / OKR List */}
            <div className="w-full bg-[#1E1E1E] border border-[#3c3c3c] rounded-[32px] pt-[18px] pb-[32px] px-[32px] flex flex-col relative">

                {/* Headers */}
                <div className="flex items-end mb-[16px]">
                    <div className="w-[180px] shrink-0">
                        <span className="block text-[15px] font-bold text-[#E5E5E5]">평가 차원</span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-[24px]">
                        <div className="ml-[30px]">
                            <span className="block text-[15px] font-bold text-[#E5E5E5]">측정 대상</span>
                        </div>
                        <div className="-ml-[180px]">
                            <span className="block text-[15px] font-bold text-[#E5E5E5]">대표 지표(예시)</span>
                        </div>
                    </div>
                </div>
                
                <div className="-mx-[32px] w-[calc(100%+64px)] h-px bg-[#333] mb-[24px]"></div>

                {/* 1. KPI */}
                <div className="flex items-center">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[19px] font-bold text-white">KPI (사업단위)</span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-[24px]">
                        <div className="ml-[30px]">
                            <span className="text-[17px] text-white">이오타서울 PFV 합산 성과</span>
                        </div>
                        <div className="-ml-[180px]">
                            <span className="text-[15px] text-[#c3c2b7]">IRR/Multiple, 사업비 UW 대비 차이, 공정·예산 슬리피지(%), 대주단 covenants 위반 0건</span>
                        </div>
                    </div>
                </div>

                <div className="-mx-[32px] w-[calc(100%+64px)] h-px bg-[#333] my-[24px]"></div>

                {/* 2. OKR */}
                <div className="flex items-center">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[19px] font-bold text-white">OKR (조직단위)</span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-[24px]">
                        <div className="ml-[30px]">
                            <span className="text-[17px] text-white">CFT 5개 기능 셀</span>
                        </div>
                        <div className="-ml-[180px]">
                            <span className="text-[15px] text-[#c3c2b7]">의사결정 평균 소요일, 회의체 정시개최율, 미결 액션 7일 내 종결률</span>
                        </div>
                    </div>
                </div>

                <div className="-mx-[32px] w-[calc(100%+64px)] h-px bg-[#333] my-[24px]"></div>

                {/* 3. CGC */}
                <div className="flex items-center">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[19px] font-bold text-white">CGC (부문 기여)</span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-[24px]">
                        <div className="ml-[30px]">
                            <span className="text-[17px] text-white">타 사업/타 펀드 파급</span>
                        </div>
                        <div className="-ml-[180px]">
                            <span className="text-[15px] text-[#c3c2b7]">이오타에서 도출된 표준 SOP·계약서·UW 모델의 부문 내 재활용 건수</span>
                        </div>
                    </div>
                </div>

                <div className="-mx-[32px] w-[calc(100%+64px)] h-px bg-[#333] my-[24px]"></div>

                {/* 4. 경영조직 */}
                <div className="flex items-center">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[19px] font-bold text-white">경영조직 (종합)</span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-[24px]">
                        <div className="ml-[30px]">
                            <span className="text-[17px] text-white">부문대표 직속 평가</span>
                        </div>
                        <div className="-ml-[180px]">
                            <span className="text-[15px] text-[#c3c2b7]">LP NPS, 외부 파트너 컴플레인 0건, 미디어/규제 리스크 사건 0건</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}