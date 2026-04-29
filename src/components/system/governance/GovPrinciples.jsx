import React from 'react';

export default function GovPrinciples() {
    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[36px]">의사결정 원칙 및 평가 체계</h1>
            
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

            <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-[24px] overflow-hidden">
                <div className="px-[28px] py-[20px] border-b border-[#333] bg-[#222]">
                    <h3 className="text-[16px] font-bold text-white">KPI / OKR 이중 평가 체계</h3>
                </div>
                <div className="w-full">
                    <table className="w-full text-left">
                        <thead className="bg-[#1A1A1A]">
                            <tr>
                                <th className="px-[28px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333] w-[180px]">평가 차원</th>
                                <th className="px-[28px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333] w-[200px]">측정 대상</th>
                                <th className="px-[28px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">대표 지표(예시)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#333]">
                            <tr className="hover:bg-[#222] transition-colors">
                                <td className="px-[28px] py-[20px] text-[15px] font-bold text-[#E5E5E5]">KPI <span className="text-[#86868B] font-normal text-[13px] ml-1">(사업단위)</span></td>
                                <td className="px-[28px] py-[20px] text-[15px] text-[#A1A1AA]">이오타서울 PFV 합산 성과</td>
                                <td className="px-[28px] py-[20px] text-[14px] text-[#A1A1AA]">IRR/Multiple, 사업비 UW 대비 차이, 공정·예산 슬리피지(%), 대주단 covenants 위반 0건</td>
                            </tr>
                            <tr className="hover:bg-[#222] transition-colors">
                                <td className="px-[28px] py-[20px] text-[15px] font-bold text-[#E5E5E5]">OKR <span className="text-[#86868B] font-normal text-[13px] ml-1">(조직단위)</span></td>
                                <td className="px-[28px] py-[20px] text-[15px] text-[#A1A1AA]">CFT 5개 기능 셀</td>
                                <td className="px-[28px] py-[20px] text-[14px] text-[#A1A1AA]">의사결정 평균 소요일, 회의체 정시개최율, 미결 액션 7일 내 종결률</td>
                            </tr>
                            <tr className="hover:bg-[#222] transition-colors">
                                <td className="px-[28px] py-[20px] text-[15px] font-bold text-[#E5E5E5]">CGC <span className="text-[#86868B] font-normal text-[13px] ml-1">(부문 기여)</span></td>
                                <td className="px-[28px] py-[20px] text-[15px] text-[#A1A1AA]">타 사업/타 펀드 파급</td>
                                <td className="px-[28px] py-[20px] text-[14px] text-[#A1A1AA]">이오타에서 도출된 표준 SOP·계약서·UW 모델의 부문 내 재활용 건수</td>
                            </tr>
                            <tr className="hover:bg-[#222] transition-colors">
                                <td className="px-[28px] py-[20px] text-[15px] font-bold text-[#E5E5E5]">경영조직 <span className="text-[#86868B] font-normal text-[13px] ml-1">(종합)</span></td>
                                <td className="px-[28px] py-[20px] text-[15px] text-[#A1A1AA]">부문대표 직속 평가</td>
                                <td className="px-[28px] py-[20px] text-[14px] text-[#A1A1AA]">LP NPS, 외부 파트너 컴플레인 0건, 미디어/규제 리스크 사건 0건</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
