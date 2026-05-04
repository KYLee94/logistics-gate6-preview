import React, { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';

export default function WorkspacePm() {
    const [kpiData, setKpiData] = useState({
        progress_percent: 18.0,
        budget_variance: 1.2,
        schedule_slippage_days: 7,
        covenant_status: '정상',
        covenant_ltv: 45.5,
        covenant_dscr: 1.25
    });

    useEffect(() => {
        const fetchKpis = async () => {
            const { data, error } = await supabase
                .from('iota_workspace_kpis')
                .select('*')
                .eq('project_id', 'IOTA_SEOUL')
                .single();
                
            if (data && !error) {
                setKpiData(data);
            }
        };
        fetchKpis();
    }, []);

    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header Metadata */}
            <div className="w-full flex justify-between items-end mb-[36px]">
                <div>
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">사업 PM</h1>
                    <p className="text-[15px] text-[#86868B]">전체 사업 일정 및 예산 통제, 변경관리 결정, PFV 외부 단일창구</p>
                </div>
            </div>
            
            {/* PM Team Structure */}
            <div className="w-full border border-[#333] rounded-[24px] -mt-[4px] mb-[32px] flex flex-col">
                {/* 사업1파트 */}
                <div className="flex items-center px-[24px] py-[16px]">
                    <div className="w-[100px] shrink-0">
                        <span className="text-[13px] font-bold text-[#86868B]">Co-PM 전략</span>
                    </div>
                    <div className="flex items-center gap-[12px] w-[180px] shrink-0">
                        <div className="relative w-[40px] h-[40px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden">
                            <img src={`${import.meta.env.BASE_URL}권순일.webp`} alt="권순일" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                            <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-white font-bold text-[15px] leading-tight">권순일</span>
                            <span className="text-[#A1A1AA] text-[13px] mt-[2px] leading-tight">사업1파트장</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-2 -ml-[10px]">
                        {['윤주형', '김제익', '류홍', '박만진', '박일훈', '이정원', '전무경'].map(name => (
                            <div key={name} className="flex items-center gap-[6px] bg-[#222] border border-[#333] rounded-full pl-[4px] pr-[10px] py-[4px] min-w-[76px]">
                                <div className="w-[20px] h-[20px] shrink-0 rounded-full bg-[#3c3c3c] overflow-hidden">
                                    <img src={`${import.meta.env.BASE_URL}${name}.webp`} alt={name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                </div>
                                <span className="text-[#E5E5E5] text-[12px] font-medium leading-none">{name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-full h-px bg-[#333]"></div>

                {/* 사업2파트 */}
                <div className="flex items-center px-[24px] py-[16px]">
                    <div className="w-[100px] shrink-0">
                        <span className="text-[13px] font-bold text-[#86868B]">Co-PM 사업</span>
                    </div>
                    <div className="flex items-center gap-[12px] w-[180px] shrink-0">
                        <div className="relative w-[40px] h-[40px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden">
                            <img src={`${import.meta.env.BASE_URL}강순용.webp`} alt="강순용" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                            <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-white font-bold text-[15px] leading-tight">강순용</span>
                            <span className="text-[#A1A1AA] text-[13px] mt-[2px] leading-tight">사업2파트장</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-2 -ml-[10px]">
                        {['한찬호', '박석제', '박채현', '소현준', '이수정', '조영비', '한수정'].map(name => (
                            <div key={name} className="flex items-center gap-[6px] bg-[#222] border border-[#333] rounded-full pl-[4px] pr-[10px] py-[4px] min-w-[76px]">
                                <div className="w-[20px] h-[20px] shrink-0 rounded-full bg-[#3c3c3c] overflow-hidden">
                                    <img src={`${import.meta.env.BASE_URL}${name}.webp`} alt={name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                </div>
                                <span className="text-[#E5E5E5] text-[12px] font-medium leading-none">{name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top 4 KPI Cards */}
            <div className="flex w-full gap-[19px] -mt-[10px] mb-[40px]">
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] px-[20px] pt-[16px] pb-[18px] hover:border-[#555] transition-colors relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-[8px]">
                        <h3 className="text-[14px] font-bold text-[#86868B]">진척도</h3>
                        <span className="px-2 py-0.5 border border-[#d97706]/50 text-[#d97706] text-[11px] font-bold rounded-full">live</span>
                    </div>
                    <div className="text-[36px] font-black text-white leading-none mt-1">{kpiData.progress_percent}<span className="text-[18px] text-[#A1A1AA]">%</span></div>
                </div>
                
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] px-[20px] pt-[16px] pb-[18px] hover:border-[#555] transition-colors relative overflow-hidden">
                    <h3 className="text-[14px] font-bold text-[#86868B] mb-[8px]">예산 편차</h3>
                    <div className="flex items-end gap-2 mt-1">
                        <div className="text-[36px] font-black text-white leading-none">{kpiData.budget_variance > 0 ? '+' : ''}{kpiData.budget_variance}<span className="text-[18px] text-[#A1A1AA]">%</span></div>
                        <span className="text-[12px] text-[#A1A1AA] translate-y-[1px]">U/W 대비</span>
                    </div>
                </div>

                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] px-[20px] pt-[16px] pb-[18px] hover:border-[#555] transition-colors relative overflow-hidden">
                    <h3 className="text-[14px] font-bold text-[#86868B] mb-[8px]">일정 슬리피지</h3>
                    <div className="flex items-end gap-2 mt-1">
                        <div className="text-[36px] font-black text-white leading-none">{kpiData.schedule_slippage_days}d</div>
                        <span className="text-[12px] text-[#A1A1AA] translate-y-[1px]">누적</span>
                    </div>
                </div>

                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] px-[20px] pt-[16px] pb-[18px] hover:border-[#555] transition-colors relative overflow-hidden">
                    <h3 className="text-[14px] font-bold text-[#86868B] mb-[8px]">Covenants</h3>
                    <div className="flex items-end gap-3 mt-1">
                        <div className={`text-[36px] font-black leading-none ${kpiData.covenant_status === '위반' ? 'text-[#e11d48]' : 'text-white'}`}>{kpiData.covenant_status}</div>
                        <div className="flex flex-col text-[12px] text-[#86868B] pb-0.5 leading-tight">
                            <span>LTV {kpiData.covenant_ltv}%</span>
                            <span>DSCR {kpiData.covenant_dscr}x</span>
                        </div>
                    </div>
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
