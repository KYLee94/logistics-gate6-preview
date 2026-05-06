import React, { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import WorkspaceActivityLog from './WorkspaceActivityLog';

export default function WorkspacePm() {
    const [kpiData, setKpiData] = useState({
        progress_percent: 18.0,
        budget_variance: 1.2,
        schedule_slippage_days: 7,
        covenant_status: '정상',
        covenant_ltv: 45.5,
        covenant_dscr: 1.25
    });

    const [expandedDecisions, setExpandedDecisions] = useState({});

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

    const toggleDecisionExpand = (id) => {
        setExpandedDecisions(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="w-full flex-1 flex flex-col pt-[44px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header & Team Structure */}
            <div className="w-full flex justify-between items-center mb-[40px] gap-[40px]">
                {/* Header Metadata */}
                <div className="shrink-0 max-w-[300px]">
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">사업 PM</h1>
                    <p className="text-[15px] text-[#86868B] leading-[24px]">전체 사업 일정 및 예산 통제, 변경관리 결정,<br />PFV 외부 단일창구</p>
                </div>
                
                {/* PM Team Structure */}
                <div className="border border-[#333] rounded-[24px] flex flex-col bg-transparent shrink-0">
                    {/* 사업1파트 */}
                    <div className="flex items-center pl-[20px] pr-[10px] py-[10px]">
                        <div className="w-[80px] shrink-0">
                            <span className="text-[13px] font-bold text-[#86868B]">Co-PM 전략</span>
                        </div>
                        <div className="flex items-center gap-[12px] w-[130px] shrink-0">
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
                            {['윤주형', '김제익', '류홍', '박만진', '박일훈', '이정원', '전무경'].map(name => (
                                <div key={name} className="flex items-center gap-[6px] bg-[#222] border border-[#333] rounded-full pl-[4px] pr-[10px] py-[4px] min-w-[76px]">
                                    <div className="w-[21px] h-[21px] shrink-0 rounded-full bg-[#3c3c3c] overflow-hidden">
                                        <img src={`${import.meta.env.BASE_URL}${name}.webp`} alt={name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                    </div>
                                    <span className="text-[#E5E5E5] text-[12px] font-medium leading-none">{name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="w-full h-px bg-[#333]"></div>

                    {/* 사업2파트 */}
                    <div className="flex items-center pl-[20px] pr-[10px] py-[10px]">
                        <div className="w-[80px] shrink-0">
                            <span className="text-[13px] font-bold text-[#86868B]">Co-PM 사업</span>
                        </div>
                        <div className="flex items-center gap-[12px] w-[130px] shrink-0">
                            <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                                <img src={`${import.meta.env.BASE_URL}강순용.webp`} alt="강순용" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-white font-bold text-[13px] leading-tight">강순용</span>
                                <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">사업2파트장</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-x-1.5 gap-y-2 -ml-[6px]">
                            {['한찬호', '박석제', '박채현', '소현준', '이수정', '조영비', '한수정'].map(name => (
                                <div key={name} className="flex items-center gap-[6px] bg-[#222] border border-[#333] rounded-full pl-[4px] pr-[10px] py-[4px] min-w-[76px]">
                                    <div className="w-[21px] h-[21px] shrink-0 rounded-full bg-[#3c3c3c] overflow-hidden">
                                        <img src={`${import.meta.env.BASE_URL}${name}.webp`} alt={name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                    </div>
                                    <span className="text-[#E5E5E5] text-[12px] font-medium leading-none">{name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-5 gap-[10px] mb-[40px]">
                <div className="bg-[#262626] border border-[#333] rounded-[24px] px-[24px] py-[14px]">
                    <div className="text-[#86868B] text-[13px] font-medium mb-[8px]">공정 진척도</div>
                    <div className="flex items-baseline gap-[4px]">
                        <span className="text-[28px] font-bold text-white">{kpiData.progress_percent}%</span>
                        <span className="text-[13px] text-[#34d399] font-medium">▲ 0.5%</span>
                    </div>
                </div>
                <div className="bg-[#262626] border border-[#333] rounded-[24px] px-[24px] py-[14px]">
                    <div className="text-[#86868B] text-[13px] font-medium mb-[8px]">예산 대비 집행</div>
                    <div className="flex items-baseline gap-[4px]">
                        <span className="text-[28px] font-bold text-white">{kpiData.budget_variance}%</span>
                        <span className="text-[13px] text-[#FF453A] font-medium">▼ 0.2%</span>
                    </div>
                </div>
                <div className="bg-[#262626] border border-[#333] rounded-[24px] px-[24px] py-[14px]">
                    <div className="text-[#86868B] text-[13px] font-medium mb-[8px]">Schedule Slippage</div>
                    <div className="flex items-baseline gap-[4px]">
                        <span className="text-[28px] font-bold text-[#FF453A]">{kpiData.schedule_slippage_days} days</span>
                    </div>
                </div>
                <div className="bg-[#262626] border border-[#333] rounded-[24px] px-[24px] py-[14px]">
                    <div className="text-[#86868B] text-[13px] font-medium mb-[8px]">Covenant (LTV)</div>
                    <div className="flex items-baseline gap-[4px]">
                        <span className="text-[28px] font-bold text-white">{kpiData.covenant_ltv}%</span>
                        <span className="text-[13px] text-[#34d399] font-medium">Safe</span>
                    </div>
                </div>
                <div className="bg-[#262626] border border-[#333] rounded-[24px] px-[24px] py-[14px]">
                    <div className="text-[#86868B] text-[13px] font-medium mb-[8px]">Covenant (DSCR)</div>
                    <div className="flex items-baseline gap-[4px]">
                        <span className="text-[28px] font-bold text-white">{kpiData.covenant_dscr}x</span>
                        <span className="text-[13px] text-[#34d399] font-medium">Safe</span>
                    </div>
                </div>
            </div>

            <WorkspaceActivityLog workspaceCode="WS_PM" workspaceLabel="사업 PM" />

            {/* Top 10 Risks Board */}
            <h2 className="text-[18px] font-bold text-white mb-[12px]">Top 10 리스크 모니터링</h2>
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
            <h2 className="text-[18px] font-bold text-white mb-[12px]">최근 의사결정 로그 (Change Order)</h2>
            <div className="flex flex-col gap-3">
                {[
                    {
                        id: 'd1',
                        date: '2026-04-10',
                        created_at: '2026-04-10T14:30:00',
                        project: 'Iota 1',
                        title: 'Foster+Partners 설계 Alt B 채택 (UW 내)',
                        raw_text: 'Foster+Partners 설계 Alt B 채택 (UW 내)\n\n주요 안건:\n- 외부 입면 디자인은 B안이 가장 효율적이라는 판단\n- 예상 공사비 한도(UW) 내에서 구현 가능함\n- 강순용 전무님 승인 완료',
                        sh_name: '이지스자산운용 - 강순용',
                        status: 'Approved',
                        statusColor: 'text-[#34d399]'
                    },
                    {
                        id: 'd2',
                        date: '2026-04-01',
                        created_at: '2026-04-01T09:15:00',
                        project: 'Iota 2',
                        title: '삼성물산 도급 변경분 정산안 합의',
                        raw_text: '삼성물산 도급 변경분 정산안 합의\n\n세부 내역:\n- 물가상승분(Escalation) 반영한 최종 도급액 합의\n- 당초 예산 대비 2% 증가분은 예비비에서 충당\n- 윤관식 대표님 최종 결재 대기 중',
                        sh_name: '삼성물산 - 윤관식',
                        status: 'In Review',
                        statusColor: 'text-[#fbf167]'
                    }
                ].map((log) => (
                    <div key={log.id} className="relative bg-[#252525] border border-[#3c3c3c] rounded-[16px] p-[20px] flex flex-col hover:border-[#555] transition-colors">
                        <div className="flex items-center w-full">
                            <div className="relative flex flex-col justify-center w-[120px] shrink-0">
                                <span className="text-[13px] text-[#86868B] font-medium leading-tight">{log.date}</span>
                                {expandedDecisions[log.id] && log.created_at && (
                                    <span className="absolute top-[100%] left-0 text-[11px] text-[#555] font-['Inter'] leading-tight mt-[2px] whitespace-nowrap">
                                        {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                            <div className="w-[100px] shrink-0"><span className="text-[12px] px-2 py-0.5 bg-[#222] border border-[#333] text-[#A1A1AA] rounded">{log.project}</span></div>
                            <div className="flex-1 px-4 border-l border-[#333] flex items-center gap-[8px]">
                                <span className="text-[15px] font-bold text-white truncate">{log.raw_text ? log.raw_text.split('\n')[0] : ''}</span>
                                <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); toggleDecisionExpand(log.id); }}
                                    className="text-[12px] text-[#2997ff] hover:underline cursor-pointer font-medium shrink-0 ml-[4px]"
                                >
                                    {expandedDecisions[log.id] ? '[접기]' : '[펼쳐보기]'}
                                </button>
                            </div>
                            <div className="w-[100px] text-right shrink-0">
                                <span className={`text-[13px] ${log.statusColor} font-bold`}>{log.status}</span>
                            </div>
                        </div>

                        {/* Expanded Box */}
                        {expandedDecisions[log.id] && (
                            <div className="w-full flex mt-[14px]">
                                <div 
                                    className="bg-[#1c1c1e] border border-[#333] rounded-[12px] p-[16px] flex-1"
                                    style={{ marginLeft: '220px', marginRight: '0px' }}
                                >
                                    {/* Stakeholder Pill (Floated Right) */}
                                    {log.sh_name && (
                                        <div className="float-right ml-[16px] mb-[12px] flex flex-col items-end gap-[4px]">
                                            <span className="text-[11px] font-bold text-[#86868B] pr-[14px]">이해관계자</span>
                                            <div className="bg-[#2a2a2c] border border-[#444] rounded-full pl-[8px] pr-[12px] py-[4px] flex items-center gap-[6px]">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                <span className="text-[12px] font-medium text-[#E5E5E5]">
                                                    {log.sh_name}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="whitespace-pre-wrap break-words text-[14px] text-[#E5E5E5] leading-relaxed">
                                        {log.raw_text}
                                    </div>
                                    <div className="clear-both"></div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

        </div>
    );
}
