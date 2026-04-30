import React from 'react';

export default function WorkspaceFinancing() {
    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header Metadata */}
            <div className="w-full flex justify-between items-end mb-[36px]">
                <div>
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">파이낸싱 (LFC)</h1>
                    <p className="text-[15px] text-[#86868B]">본PF·통합PF 구조, 대주단 모니터링, 리파이낸싱 옵션 상시 검토</p>
                </div>
                
                <div className="flex items-center h-[48px] border border-[#333] rounded-[16px] bg-[#1A1A1A] px-2">
                    <div className="flex flex-col items-center justify-center h-full px-[16px]">
                        <span className="text-[12px] text-[#666] font-normal -mb-[2px] font-['Inter']">Lead</span>
                        <span className="text-[15px] font-bold text-[#E5E5E5] tracking-tight"><span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">박준호</span></span>
                    </div>
                    <div className="w-px h-[24px] bg-[#333]"></div>
                    <div className="flex flex-col items-center justify-center h-full px-[16px]">
                        <span className="text-[12px] text-[#666] font-normal -mb-[2px] font-['Inter']">Members</span>
                        <span className="text-[15px] font-bold text-[#A1A1AA] tracking-tight">7명</span>
                    </div>
                    <div className="w-px h-[24px] bg-[#333]"></div>
                    <div className="flex flex-col items-center justify-center h-full px-[16px]">
                        <span className="text-[12px] text-[#666] font-normal -mb-[2px] font-['Inter']">Key Partner</span>
                        <span className="text-[15px] font-bold text-[#A1A1AA] tracking-tight">NH / 신한 / 대신</span>
                    </div>
                </div>
            </div>
            
            {/* Top 3 KPI Cards */}
            <div className="flex w-full gap-[24px] mb-[40px]">
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#34d399]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">Covenants Status (Iota 1)</h3>
                    <div className="text-[32px] font-black text-white">정상 유지</div>
                    <p className="text-[13px] text-[#A1A1AA] mt-2">LTV 58% (한도 65%)</p>
                </div>
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#60a5fa]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">시장금리 변동 추이</h3>
                    <div className="text-[42px] font-black text-white">4.2<span className="text-[20px] text-[#A1A1AA]">%</span></div>
                    <p className="text-[13px] text-[#A1A1AA] mt-2">전월 대비 -15bp 하락</p>
                </div>
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#fbf167]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">통합 PF 진행률</h3>
                    <div className="text-[42px] font-black text-white">40<span className="text-[20px] text-[#A1A1AA]">%</span></div>
                    <div className="w-full bg-[#1A1A1A] h-2 rounded-full mt-4"><div className="h-full bg-[#fbf167] rounded-full w-[40%]"></div></div>
                </div>
            </div>

            {/* Covenants & Refinancing Pipeline */}
            <h2 className="text-[18px] font-bold text-white mb-[16px]">대주단 모니터링 (Lenders)</h2>
            <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-[24px] overflow-hidden mb-[40px]">
                <table className="w-full text-left">
                    <thead className="bg-[#222]">
                        <tr>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">자산</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">주관사 (Arranger)</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">약정 금액</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">현재 금리</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">만기일</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">Next Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                        <tr className="hover:bg-[#292928] transition-colors">
                            <td className="px-[20px] py-[16px] text-[13px] font-bold text-white">Iota 1</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#E5E5E5]"><span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">신한투자증권</span> (외 2곳)</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">4,500억원</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">5.2%</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">2027.06</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#E5E5E5]">월간 약정서 모니터링</td>
                        </tr>
                        <tr className="hover:bg-[#292928] transition-colors">
                            <td className="px-[20px] py-[16px] text-[13px] font-bold text-white">Iota 2</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#E5E5E5]"><span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">NH투자증권</span> (대표)</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">6,000억원</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">4.8%</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#fbf167]">2026.12</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#E5E5E5]">통합 PF 1차 텀시트 협의 중</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            {/* Action Log */}
            <h2 className="text-[18px] font-bold text-white mb-[16px]">최근 이력 (Action Log)</h2>
            <div className="flex flex-col gap-3">
                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[20px] flex items-center hover:border-[#555] transition-colors">
                    <div className="w-[120px]"><span className="text-[13px] text-[#86868B] font-medium">2026-04-18</span></div>
                    <div className="w-[100px]"><span className="text-[12px] px-2 py-0.5 bg-[#222] border border-[#333] text-[#A1A1AA] rounded">Iota 1/2</span></div>
                    <div className="flex-1 px-4 border-l border-[#333]">
                        <span className="text-[15px] font-bold text-white">통합 PF 주관사 NH 우선협상 개시</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
