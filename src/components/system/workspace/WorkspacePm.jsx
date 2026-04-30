import React, { useState } from 'react';

export default function WorkspacePm() {
    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header Metadata */}
            <div className="w-full flex justify-between items-end mb-[36px]">
                <div>
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">사업 PM</h1>
                    <p className="text-[15px] text-[#86868B]">전체 일정·예산 통제, 변경관리 결정, PFV 외부 단일창구</p>
                </div>
                
                <div className="flex items-center h-[48px] border border-[#333] rounded-[16px] bg-[#1A1A1A] px-2">
                    <div className="flex flex-col items-center justify-center h-full px-[16px]">
                        <span className="text-[12px] text-[#666] font-normal -mb-[2px] font-['Inter']">Co-PM</span>
                        <span className="text-[15px] font-bold text-[#E5E5E5] tracking-tight"><span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">권순일</span> / <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">강순용</span></span>
                    </div>
                    <div className="w-px h-[24px] bg-[#333]"></div>
                    <div className="flex flex-col items-center justify-center h-full px-[16px]">
                        <span className="text-[12px] text-[#666] font-normal -mb-[2px] font-['Inter']">Members</span>
                        <span className="text-[15px] font-bold text-[#A1A1AA] tracking-tight">11명</span>
                    </div>
                    <div className="w-px h-[24px] bg-[#333]"></div>
                    <div className="flex flex-col items-center justify-center h-full px-[16px]">
                        <span className="text-[12px] text-[#666] font-normal -mb-[2px] font-['Inter']">Tier</span>
                        <span className="text-[15px] font-bold text-[#e11d48] tracking-tight">T3 (주간 운영)</span>
                    </div>
                </div>
            </div>
            
            {/* Top 3 KPI Cards */}
            <div className="flex w-full gap-[24px] mb-[40px]">
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#fbf167]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">Iota 1 공정률</h3>
                    <div className="text-[42px] font-black text-white">18<span className="text-[20px] text-[#A1A1AA]">%</span></div>
                    <div className="w-full bg-[#1A1A1A] h-2 rounded-full mt-4"><div className="h-full bg-[#fbf167] rounded-full w-[18%]"></div></div>
                </div>
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#e11d48]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">사업비 증감 (UW 대비)</h3>
                    <div className="text-[42px] font-black text-white">+1.2<span className="text-[20px] text-[#A1A1AA]">%</span></div>
                    <p className="text-[13px] text-[#A1A1AA] mt-2">Iota 1 설계 변경 반영</p>
                </div>
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#34d399]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">결정 보류 (Pending)</h3>
                    <div className="text-[42px] font-black text-white">2<span className="text-[16px] font-normal text-[#A1A1AA] ml-2">건</span></div>
                    <p className="text-[13px] text-[#A1A1AA] mt-2">운영위 T2 에스컬레이션</p>
                </div>
            </div>

            {/* Top 10 Risks Board */}
            <h2 className="text-[18px] font-bold text-white mb-[16px]">Top 10 리스크 모니터링</h2>
            <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-[24px] overflow-hidden mb-[40px]">
                <table className="w-full text-left">
                    <thead className="bg-[#222]">
                        <tr>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">Risk</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">담당 셀 (Owner)</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">Trigger</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                        <tr className="hover:bg-[#292928] transition-colors">
                            <td className="px-[20px] py-[16px] text-[15px] font-bold text-white">공정 지연 (시공·인허가 복합)</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#E5E5E5]">개발관리 (<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">홍장군</span>)</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">2주 누적 지연</td>
                            <td className="px-[20px] py-[16px]"><span className="px-3 py-1 bg-[#d97706]/20 text-[#fbf167] rounded text-[13px] border border-[#d97706]/30 font-bold">Amber</span></td>
                        </tr>
                        <tr className="hover:bg-[#292928] transition-colors">
                            <td className="px-[20px] py-[16px] text-[15px] font-bold text-white">사업비 UW 범위 외 증가</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#E5E5E5]">PM (<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">강순용</span>)</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">UW +5% 누적</td>
                            <td className="px-[20px] py-[16px]"><span className="px-3 py-1 bg-[#d97706]/20 text-[#fbf167] rounded text-[13px] border border-[#d97706]/30 font-bold">Amber</span></td>
                        </tr>
                        <tr className="hover:bg-[#292928] transition-colors">
                            <td className="px-[20px] py-[16px] text-[15px] font-bold text-white">대주단 Covenants 위반</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#E5E5E5]">LFC (<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">박준호</span>)</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">DSCR/LTV 임계점</td>
                            <td className="px-[20px] py-[16px]"><span className="px-3 py-1 bg-[#059669]/20 text-[#34d399] rounded text-[13px] border border-[#059669]/30 font-bold">Green</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Decision Log */}
            <h2 className="text-[18px] font-bold text-white mb-[16px]">최근 의사결정 로그 (Change Order)</h2>
            <div className="flex flex-col gap-3">
                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[20px] flex items-center hover:border-[#555] transition-colors">
                    <div className="w-[120px]"><span className="text-[13px] text-[#86868B] font-medium">2026-04-10</span></div>
                    <div className="w-[100px]"><span className="text-[12px] px-2 py-0.5 bg-[#222] border border-[#333] text-[#A1A1AA] rounded">Iota 1</span></div>
                    <div className="flex-1 px-4 border-l border-[#333]">
                        <span className="text-[15px] font-bold text-white">Foster+Partners 설계 Alt B 채택 (UW 내)</span>
                    </div>
                    <div className="w-[120px] text-right">
                        <span className="text-[13px] text-[#666]">결정: <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">강순용</span></span>
                    </div>
                    <div className="w-[100px] text-right">
                        <span className="text-[13px] text-[#34d399] font-bold">Approved</span>
                    </div>
                </div>
                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[20px] flex items-center hover:border-[#555] transition-colors">
                    <div className="w-[120px]"><span className="text-[13px] text-[#86868B] font-medium">2026-04-01</span></div>
                    <div className="w-[100px]"><span className="text-[12px] px-2 py-0.5 bg-[#222] border border-[#333] text-[#A1A1AA] rounded">Iota 2</span></div>
                    <div className="flex-1 px-4 border-l border-[#333]">
                        <span className="text-[15px] font-bold text-white">삼성물산 도급 변경분 정산안 합의</span>
                    </div>
                    <div className="w-[120px] text-right">
                        <span className="text-[13px] text-[#666]">결정: <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">강순용</span></span>
                    </div>
                    <div className="w-[100px] text-right">
                        <span className="text-[13px] text-[#fbf167] font-bold">In Review</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
