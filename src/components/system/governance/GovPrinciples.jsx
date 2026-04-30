import React from 'react';

export default function GovPrinciples() {
    return (
        <div className="w-full flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[36px]">의사결정 및 평가 체계</h1>
            
            <div className="grid grid-cols-2 gap-[24px] mb-[32px]">
                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors group">
                    <h3 className="text-[18px] font-bold text-[#E5E5E5] mb-[12px]">1. 단일 진실의 원칙 <span className="text-[#86868B] text-[15px] font-normal tracking-tight ml-1">(Single Source of Truth)</span></h3>
                    <p className="text-[15px] text-[#A1A1AA] leading-[24px]">모든 보고·KPI·자금흐름 데이터는 통합 데이터룸을 통해서만 인용한다.</p>
                </div>
                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors group">
                    <h3 className="text-[18px] font-bold text-[#E5E5E5] mb-[12px]">2. 결정자·승인자 분리 원칙 <span className="text-[#86868B] text-[15px] font-normal tracking-tight ml-1">(Two-Lock)</span></h3>
                    <p className="text-[15px] text-[#A1A1AA] leading-[24px]">일정 또는 비용에 영향이 있는 변경은 PM 이 결정자, 부대표/대표가 승인자로 분리된다.</p>
                </div>
                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors group">
                    <h3 className="text-[18px] font-bold text-[#E5E5E5] mb-[12px]">3. UW 범위 안과 밖의 분리 원칙</h3>
                    <p className="text-[15px] text-[#A1A1AA] leading-[24px]">UW 범위 내 변경은 사업파트 co-PM 자율, UW 범위 외는 즉시 부문대표 보고와 LP 통지 절차가 트리거된다.</p>
                </div>
                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors group">
                    <h3 className="text-[18px] font-bold text-[#E5E5E5] mb-[12px]">4. 이해상충 방화벽 원칙</h3>
                    <p className="text-[15px] text-[#A1A1AA] leading-[24px]">421호 펀드 운용역과 IPR 워킹그룹은 동일 인물이 동시 결정권을 가질 수 없다(자문/검토는 가능).</p>
                </div>
                <div className="col-span-2 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors group">
                    <h3 className="text-[18px] font-bold text-[#E5E5E5] mb-[12px]">5. 기록·복기의 원칙</h3>
                    <p className="text-[15px] text-[#A1A1AA] leading-[24px]">모든 의사결정은 회의록·결정문 형태로 통합 데이터룸에 잔존하며, 매 분기 회고 세션에서 복기 대상으로 삼는다.</p>
                </div>
            </div>

                        {/* KPI / OKR List */}
            <div className="w-full bg-[#1E1E1E] border border-[#3c3c3c] rounded-[32px] pt-[19px] pb-[32px] px-[32px] flex flex-col relative">
                
                {/* Headers */}
                <div className="flex items-end mb-[16px]">
                    <div className="w-[180px] shrink-0">
                        <h2 className="text-[18px] font-bold text-white">KPI / OKR 이중 평가 체계</h2>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-[24px]">
                        <div>
                            <span className="block text-[15px] font-bold text-[#E5E5E5]">측정 대상</span>
                        </div>
                        <div className="-ml-[150px]">
                            <span className="block text-[15px] font-bold text-[#E5E5E5]">대표 지표(예시)</span>
                        </div>
                    </div>
                </div>
                
                <div className="-mx-[32px] w-[calc(100%+64px)] h-px bg-[#333] mb-[24px]"></div>

                {/* 1. KPI */}
                <div className="flex items-start">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[19px] font-bold text-white">KPI (사업단위)</span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-[24px]">
                        <div>
                            <span className="text-[17px] text-white">이오타서울 PFV 합산 성과</span>
                        </div>
                        <div className="-ml-[150px]">
                            <span className="text-[15px] text-[#c3c2b7]">IRR/Multiple, 사업비 UW 대비 차이, 공정·예산 슬리피지(%), 대주단 covenants 위반 0건</span>
                        </div>
                    </div>
                </div>

                <div className="-mx-[32px] w-[calc(100%+64px)] h-px bg-[#333] my-[24px]"></div>

                {/* 2. OKR */}
                <div className="flex items-start">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[19px] font-bold text-white">OKR (조직단위)</span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-[24px]">
                        <div>
                            <span className="text-[17px] text-white">CFT 5개 기능 셀</span>
                        </div>
                        <div className="-ml-[150px]">
                            <span className="text-[15px] text-[#c3c2b7]">의사결정 평균 소요일, 회의체 정시개최율, 미결 액션 7일 내 종결률</span>
                        </div>
                    </div>
                </div>

                <div className="-mx-[32px] w-[calc(100%+64px)] h-px bg-[#333] my-[24px]"></div>

                {/* 3. CGC */}
                <div className="flex items-start">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[19px] font-bold text-white">CGC (부문 기여)</span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-[24px]">
                        <div>
                            <span className="text-[17px] text-white">타 사업/타 펀드 파급</span>
                        </div>
                        <div className="-ml-[150px]">
                            <span className="text-[15px] text-[#c3c2b7]">이오타에서 도출된 표준 SOP·계약서·UW 모델의 부문 내 재활용 건수</span>
                        </div>
                    </div>
                </div>

                <div className="-mx-[32px] w-[calc(100%+64px)] h-px bg-[#333] my-[24px]"></div>

                {/* 4. 경영조직 */}
                <div className="flex items-start">
                    <div className="w-[180px] shrink-0">
                        <span className="text-[19px] font-bold text-white">경영조직 (종합)</span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-[24px]">
                        <div>
                            <span className="text-[17px] text-white">부문대표 직속 평가</span>
                        </div>
                        <div className="-ml-[150px]">
                            <span className="text-[15px] text-[#c3c2b7]">LP NPS, 외부 파트너 컴플레인 0건, 미디어/규제 리스크 사건 0건</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}