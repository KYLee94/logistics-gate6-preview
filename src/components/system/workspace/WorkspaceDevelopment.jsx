import React, { useState, useEffect } from 'react';
import WorkspaceActivityLog from './WorkspaceActivityLog';
import { PROJECTS, COSTS, RR, COUNTERPARTIES } from '../../../data/iotaDevelopmentData';

export default function WorkspaceDevelopment() {
    const [hoveredProject, setHoveredProject] = useState(null);
    const [activeProject, setActiveProject] = useState('total');

    // Local filters for R&R and Counterparty
    const [rrTabType, setRrTabType] = useState('internal'); // 'internal' or 'external'
    const [rrTabProject, setRrTabProject] = useState('total');
    const [cpTabProject, setCpTabProject] = useState('total');

    // Sync local filters when global activeProject changes
    useEffect(() => {
        setRrTabProject(activeProject);
        setCpTabProject(activeProject);
    }, [activeProject]);

    return (
        <div className="w-full flex-1 flex flex-col pt-[50px] pb-[60px] max-w-[1200px] mx-auto relative">
            {/* Header & Team Structure */}
            <div className="w-full flex justify-between items-center mb-[40px] gap-[40px]">
                <div className="shrink-0 max-w-[400px]">
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">개발관리</h1>
                    <p className="text-[15px] text-[#86868B] leading-[24px] break-keep">설계·시공·CM·감리 통제, 인허가/명도 대응, 공정·품질·안전 KPI</p>
                </div>
                
                <div className="border border-[#333] rounded-[24px] flex flex-col bg-transparent shrink-0">
                    <div className="flex items-center pl-[20px] pr-[10px] py-[10px]">
                        <div className="w-[76px] shrink-0">
                            <span className="text-[13px] font-bold text-[#86868B]">개발솔루션</span>
                        </div>
                        <div className="flex items-center gap-[12px] w-[112px] shrink-0">
                            <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                                <img src={`${import.meta.env.BASE_URL}홍장군.webp`} alt="홍장군" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-white font-bold text-[13px] leading-tight">홍장군</span>
                                <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">센터장</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-x-1.5 gap-y-2 -ml-[6px]">
                            {["채원","김보성","전승희","김대익","장성진","이정훈","박봉서"].map(name => (
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
            
            <WorkspaceActivityLog workspaceCode="WS_DSC" workspaceLabel="개발솔루션-DSC" />

            {/* Development Milestones */}
            <div className="w-full mb-[40px] -mt-[14px]">
                <div className="w-full flex gap-[24px]">
                    {/* IOTA One 427 */}
                    <div 
                        className={`flex-1 border border-[#3c3c3c] rounded-[24px] p-[28px] transition-colors duration-300 ${hoveredProject === 'iota1' ? 'bg-[#333]' : 'bg-[#272726]'}`}
                        onMouseEnter={() => setHoveredProject('iota1')}
                        onMouseLeave={() => setHoveredProject(null)}
                    >
                        <div className="flex justify-between items-center mb-[24px]">
                            <h3 className="text-[24px] font-bold text-white leading-none">IOTA One 427 개발일정</h3>
                            <div className="px-[12px] py-[6px] bg-[#222] border border-[#333] rounded-full">
                                <span className="text-[12px] font-bold text-[#A1A1AA]">준공 2032.08</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-[1fr_50px_60px_50px_60px] gap-[16px] mb-[16px] px-[8px]">
                            <span className="text-[14px] font-bold text-[#86868B]">마일스톤</span>
                            <span className="text-[14px] font-bold text-[#86868B] text-center">UW</span>
                            <span className="text-[14px] font-bold text-[#86868B] text-center">실제</span>
                            <span className="text-[14px] font-bold text-[#86868B] text-center">지연</span>
                            <span className="text-[14px] font-bold text-[#86868B] text-center">상태</span>
                        </div>

                        <div className="flex flex-col gap-[12px]">
                            {[
                                { title: '사업시행인가', uw: '2024.12', actual: '2024.12', delay: 'D+0月', delayColor: 'text-[#86868B]', status: '완료', statusClass: 'text-[#34d399] border-[#059669]' },
                                { title: '관리처분인가', uw: '2025.03', actual: '2025.03', delay: 'D+0月', delayColor: 'text-[#86868B]', status: '완료', statusClass: 'text-[#34d399] border-[#059669]' },
                                { title: '철거 착공', uw: '2025.05', actual: '2025.05', delay: 'D+0月', delayColor: 'text-[#86868B]', status: '진행', statusClass: 'text-[#60a5fa] border-[#3b82f6]' },
                                { title: '철거공사 완료', uw: '2026.07', actual: '2027.01', delay: 'D+6月', delayColor: 'text-[#60a5fa]', status: '예정', statusClass: 'text-[#86868B] border-[#444]' },
                                { title: '착공계 제출', uw: '2026.09', actual: '2027.03', delay: 'D+6月', delayColor: 'text-[#60a5fa]', status: '예정', statusClass: 'text-[#86868B] border-[#444]' },
                                { title: '본공사 착공', uw: '2026.11', actual: '2027.05', delay: 'D+6月', delayColor: 'text-[#60a5fa]', status: '예정', statusClass: 'text-[#86868B] border-[#444]' },
                                { title: '준공', uw: '2032.02', actual: '2032.08', delay: 'D+6月', delayColor: 'text-[#60a5fa]', status: '예정', statusClass: 'text-[#86868B] border-[#444]' }
                            ].map((row, idx) => (
                                <div key={`one-${idx}`} className="grid grid-cols-[1fr_50px_60px_50px_60px] gap-[16px] items-center bg-[#222] hover:bg-[#292928] transition-colors rounded-[16px] py-[16px] px-[16px] border border-[#333]">
                                    <span className="text-[14px] font-bold text-white whitespace-nowrap">{row.title}</span>
                                    <span className="text-[14px] font-bold text-[#A1A1AA] text-center">{row.uw}</span>
                                    <span className="text-[14px] font-bold text-[#A1A1AA] text-center">{row.actual}</span>
                                    <span className={`text-[14px] font-bold text-center ${row.delayColor}`}>{row.delay}</span>
                                    <div className="flex justify-center">
                                        <span className={`text-[12px] font-bold rounded-full px-[14px] py-[4px] border ${row.statusClass}`}>
                                            {row.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* IOTA Two 816 */}
                    <div 
                        className={`flex-1 border border-[#3c3c3c] rounded-[24px] p-[28px] transition-colors duration-300 ${hoveredProject === 'iota2' ? 'bg-[#333]' : 'bg-[#272726]'}`}
                        onMouseEnter={() => setHoveredProject('iota2')}
                        onMouseLeave={() => setHoveredProject(null)}
                    >
                        <div className="flex justify-between items-center mb-[24px]">
                            <h3 className="text-[24px] font-bold text-white leading-none">IOTA Two 816 개발일정</h3>
                            <div className="px-[12px] py-[6px] bg-[#222] border border-[#333] rounded-full">
                                <span className="text-[12px] font-bold text-[#A1A1AA]">준공 2032.06</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-[1fr_50px_60px_50px_60px] gap-[16px] mb-[16px] px-[8px]">
                            <span className="text-[14px] font-bold text-[#86868B]">마일스톤</span>
                            <span className="text-[14px] font-bold text-[#86868B] text-center">UW</span>
                            <span className="text-[14px] font-bold text-[#86868B] text-center">실제</span>
                            <span className="text-[14px] font-bold text-[#86868B] text-center">지연</span>
                            <span className="text-[14px] font-bold text-[#86868B] text-center">상태</span>
                        </div>

                        <div className="flex flex-col gap-[12px]">
                            {[
                                { title: '통합심의 완료', uw: '2024.12', actual: '2024.12', delay: 'D+0月', delayColor: 'text-[#86868B]', status: '완료', statusClass: 'text-[#34d399] border-[#059669]' },
                                { title: '사업시행인가', uw: '2025.04', actual: '2025.04', delay: 'D+0月', delayColor: 'text-[#86868B]', status: '완료', statusClass: 'text-[#34d399] border-[#059669]' },
                                { title: '관리처분인가', uw: '2025.10', actual: '2025.10', delay: 'D+0月', delayColor: 'text-[#86868B]', status: '완료', statusClass: 'text-[#34d399] border-[#059669]' },
                                { title: '철거 개시', uw: '2026.09', actual: '2027.03', delay: 'D+6月', delayColor: 'text-[#60a5fa]', status: '예정', statusClass: 'text-[#86868B] border-[#444]' },
                                { title: '본공사 착공', uw: '2027.12', actual: '2028.06', delay: 'D+6月', delayColor: 'text-[#60a5fa]', status: '예정', statusClass: 'text-[#86868B] border-[#444]' },
                                { title: '준공', uw: '2031.12', actual: '2032.06', delay: 'D+6月', delayColor: 'text-[#60a5fa]', status: '예정', statusClass: 'text-[#86868B] border-[#444]' }
                            ].map((row, idx) => (
                                <div key={`two-${idx}`} className="grid grid-cols-[1fr_50px_60px_50px_60px] gap-[16px] items-center bg-[#222] hover:bg-[#292928] transition-colors rounded-[16px] py-[16px] px-[16px] border border-[#333]">
                                    <span className="text-[14px] font-bold text-white whitespace-nowrap">{row.title}</span>
                                    <span className="text-[14px] font-bold text-[#A1A1AA] text-center">{row.uw}</span>
                                    <span className="text-[14px] font-bold text-[#A1A1AA] text-center">{row.actual}</span>
                                    <span className={`text-[14px] font-bold text-center ${row.delayColor}`}>{row.delay}</span>
                                    <div className="flex justify-center">
                                        <span className={`text-[12px] font-bold rounded-full px-[14px] py-[4px] border ${row.statusClass}`}>
                                            {row.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Filtered Content */}
            <div className="w-full flex flex-col">
                {/* PHYSICAL KPIS */}
                <div className="w-full bg-[#272726] border border-[#3c3c3c] rounded-[24px] p-[40px] mb-[24px]">
                    <div className="flex flex-col mb-[32px]">
                        <span className="text-[12px] font-bold text-[#86868B] tracking-wider uppercase mb-[8px]">PHYSICAL KPIS</span>
                        <h2 className="text-[24px] font-bold text-white">물리 제원 핵심 지표</h2>
                    </div>
                    <div className="grid grid-cols-4 gap-[20px]">
                        {PROJECTS[activeProject]?.kpis.map((item, idx) => (
                            <div key={idx} className="bg-transparent border border-[#333] rounded-[16px] p-[24px] flex flex-col justify-center">
                                <span className="text-[13px] font-medium text-[#86868B] mb-[12px]">{item[0]}</span>
                                <span className="text-[24px] font-black text-white leading-tight mb-[4px]">{item[1]}</span>
                                {item[2] && <span className="text-[13px] text-[#A1A1AA]">{item[2]}</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* CONSTRUCTION COST */}
                <div className="w-full bg-[#272726] border border-[#3c3c3c] rounded-[24px] p-[40px] mb-[24px]">
                    <div className="flex flex-col mb-[32px]">
                        <span className="text-[12px] font-bold text-[#86868B] tracking-wider uppercase mb-[8px]">CONSTRUCTION COST</span>
                        <h2 className="text-[24px] font-bold text-white">공사비 break down</h2>
                    </div>
                    <div className="w-full border border-[#333] rounded-[16px] overflow-hidden">
                        <div className="grid grid-cols-[1fr_120px_100px_1.5fr] border-b border-[#333] px-[24px] py-[16px]">
                            <span className="text-[13px] font-bold text-[#86868B]">항목</span>
                            <span className="text-[13px] font-bold text-[#86868B] text-right">금액(억원)</span>
                            <span className="text-[13px] font-bold text-[#86868B] text-right">비율</span>
                            <span className="text-[13px] font-bold text-[#86868B] pl-[40px]">메모</span>
                        </div>
                        
                        <div className="flex flex-col">
                            {COSTS[activeProject] && (
                                <div className="grid grid-cols-[1fr_120px_100px_1.5fr] px-[24px] py-[20px] border-b border-[#333] items-center hover:bg-[#222] transition-colors">
                                    <div className="flex items-center gap-[12px]">
                                        <div className="w-[20px] h-[20px] rounded-[6px] border border-[#555] flex items-center justify-center cursor-pointer hover:bg-[#333]">
                                            <span className="text-[#A1A1AA] text-[16px] leading-none -mt-[2px]">-</span>
                                        </div>
                                        <span className="text-[15px] font-bold text-white">{COSTS[activeProject][0].label}</span>
                                    </div>
                                    <span className="text-[15px] font-medium text-white text-right">{COSTS[activeProject][0].amount?.toLocaleString()}</span>
                                    <span className="text-[15px] text-[#E5E5E5] text-right">100.0%</span>
                                    <span className="text-[14px] text-[#A1A1AA] pl-[40px]">{COSTS[activeProject][0].memo}</span>
                                </div>
                            )}
                            
                            {COSTS[activeProject]?.[0]?.children.map((child, idx) => (
                                <div key={idx} className="grid grid-cols-[1fr_120px_100px_1.5fr] px-[24px] py-[20px] border-b border-[#333] last:border-b-0 items-center hover:bg-[#222] transition-colors">
                                    <span className="text-[15px] font-bold text-white pl-[48px]">{child.label}</span>
                                    <span className="text-[15px] font-medium text-white text-right">{child.amount ? child.amount.toLocaleString() : '-'}</span>
                                    <span className="text-[15px] text-[#E5E5E5] text-right">
                                        {child.amount ? ((child.amount / COSTS[activeProject][0].amount) * 100).toFixed(1) + '%' : '-'}
                                    </span>
                                    <span className="text-[14px] text-[#A1A1AA] pl-[40px]">{child.memo}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ARCHITECTURE */}
                <div className="w-full bg-[#272726] border border-[#3c3c3c] rounded-[24px] p-[40px] mb-[24px]">
                    <div className="flex flex-col mb-[32px]">
                        <span className="text-[12px] font-bold text-[#86868B] tracking-wider uppercase mb-[8px]">ARCHITECTURE</span>
                        <h2 className="text-[24px] font-bold text-white">건축개요</h2>
                    </div>
                    <div className="w-full border border-[#333] rounded-[16px] overflow-hidden">
                        <div className="grid grid-cols-3">
                            {PROJECTS[activeProject]?.specs.map((spec, idx) => (
                                <div key={idx} className="flex flex-col px-[24px] py-[24px] border-b border-[#333] border-r [&:nth-child(3n)]:border-r-0 hover:bg-[#222] transition-colors">
                                    <span className="text-[13px] font-medium text-[#86868B] mb-[8px]">{spec[0]}</span>
                                    <span className="text-[15px] font-bold text-white leading-snug">{spec[1]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RESPONSIBILITY */}
                <div className="w-full bg-[#272726] border border-[#3c3c3c] rounded-[24px] p-[40px] mb-[24px]">
                    <div className="flex flex-col mb-[32px]">
                        <span className="text-[12px] font-bold text-[#86868B] tracking-wider uppercase mb-[8px]">RESPONSIBILITY</span>
                        <h2 className="text-[24px] font-bold text-white">이해관계자 / R&R</h2>
                    </div>
                    
                    <div className="flex justify-between items-center mb-[24px]">
                        <div className="flex bg-[#222] border border-[#333] rounded-full p-[4px]">
                            <button className={`px-[16px] py-[6px] rounded-full text-[13px] font-bold ${rrTabType === 'internal' ? 'bg-[#333] text-white' : 'text-[#86868B] hover:text-white'}`} onClick={() => setRrTabType('internal')}>내부</button>
                            <button className={`px-[16px] py-[6px] rounded-full text-[13px] font-bold ${rrTabType === 'external' ? 'bg-[#333] text-white' : 'text-[#86868B] hover:text-white'}`} onClick={() => setRrTabType('external')}>외부</button>
                        </div>
                        <div className="flex bg-[#222] border border-[#333] rounded-full p-[4px]">
                            <button className={`px-[16px] py-[6px] rounded-full text-[13px] font-bold ${rrTabProject === 'total' ? 'bg-[#333] text-white' : 'text-[#86868B] hover:text-white'}`} onClick={() => setRrTabProject('total')}>통합</button>
                            <button className={`px-[16px] py-[6px] rounded-full text-[13px] font-bold ${rrTabProject === '427' ? 'bg-[#333] text-white' : 'text-[#86868B] hover:text-white'}`} onClick={() => setRrTabProject('427')}>427</button>
                            <button className={`px-[16px] py-[6px] rounded-full text-[13px] font-bold ${rrTabProject === '816' ? 'bg-[#333] text-white' : 'text-[#86868B] hover:text-white'}`} onClick={() => setRrTabProject('816')}>816</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-[16px]">
                        {RR.filter(item => item.type === rrTabType)
                           .filter(item => rrTabProject === 'total' || item.project === 'total' || item.project === rrTabProject)
                           .map((item, idx) => (
                            <div key={idx} className="bg-transparent border border-[#333] rounded-[16px] p-[24px] flex flex-col hover:border-[#555] transition-colors">
                                <div className="flex justify-between items-start mb-[16px]">
                                    <h3 className="text-[18px] font-bold text-white">{item.name}</h3>
                                    <span className="text-[12px] font-bold text-[#A1A1AA]">{item.project === 'total' ? '통합' : item.project}</span>
                                </div>
                                <span className="text-[14px] font-medium text-[#c3c2b7] mb-[16px]">{item.role}</span>
                                <div className="flex flex-col gap-[8px]">
                                    <span className="text-[13px] text-[#A1A1AA] leading-snug">{item.issue}</span>
                                    <span className="text-[13px] text-[#A1A1AA] leading-snug">{item.next}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* COUNTERPARTY */}
                <div className="w-full bg-[#272726] border border-[#3c3c3c] rounded-[24px] p-[40px] mb-[40px]">
                    <div className="flex flex-col mb-[32px]">
                        <span className="text-[12px] font-bold text-[#86868B] tracking-wider uppercase mb-[8px]">COUNTERPARTY</span>
                        <h2 className="text-[24px] font-bold text-white">개발 카운터파티 관리 포인트</h2>
                    </div>
                    
                    <div className="flex mb-[24px]">
                        <div className="flex bg-[#222] border border-[#333] rounded-full p-[4px]">
                            <button className={`px-[16px] py-[6px] rounded-full text-[13px] font-bold ${cpTabProject === 'total' ? 'bg-[#333] text-white' : 'text-[#86868B] hover:text-white'}`} onClick={() => setCpTabProject('total')}>통합</button>
                            <button className={`px-[16px] py-[6px] rounded-full text-[13px] font-bold ${cpTabProject === '427' ? 'bg-[#333] text-white' : 'text-[#86868B] hover:text-white'}`} onClick={() => setCpTabProject('427')}>427</button>
                            <button className={`px-[16px] py-[6px] rounded-full text-[13px] font-bold ${cpTabProject === '816' ? 'bg-[#333] text-white' : 'text-[#86868B] hover:text-white'}`} onClick={() => setCpTabProject('816')}>816</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-[16px]">
                        {COUNTERPARTIES.filter(item => cpTabProject === 'total' || item.project === 'total' || item.project === cpTabProject)
                           .map((item, idx) => (
                            <div key={idx} className="bg-transparent border border-[#333] rounded-[16px] p-[24px] flex flex-col hover:border-[#555] transition-colors min-h-[160px]">
                                <div className="flex justify-between items-start mb-[20px]">
                                    <h3 className="text-[18px] font-bold text-white">{item.name}</h3>
                                    <span className="text-[12px] font-bold text-[#A1A1AA]">{item.category}</span>
                                </div>
                                <div className="flex flex-col gap-[10px]">
                                    <span className="text-[14px] text-[#A1A1AA] leading-snug break-keep">{item.point}</span>
                                    <span className="text-[14px] text-[#A1A1AA] leading-snug break-keep">{item.action}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Wing Absolute */}
            <div className="absolute top-[100px] bottom-[100px] -right-[180px] w-[140px]">
                <div className="sticky top-[120px] flex flex-col gap-[8px]">
                    <span className="text-[11px] font-bold text-[#86868B] tracking-widest uppercase mb-[4px]">PROJECT</span>
                    {[
                        { id: 'total', label: 'IOTA Seoul 통합' },
                        { id: '427', label: 'IOTA One 427' },
                        { id: '816', label: 'IOTA Two 816' }
                    ].map(btn => (
                        <button
                            key={btn.id}
                            onClick={() => setActiveProject(btn.id)}
                            className={`w-full text-left px-[16px] py-[12px] rounded-[12px] transition-colors duration-200 text-[13px] font-bold ${
                                activeProject === btn.id 
                                ? 'bg-[#E5F059] text-black shadow-sm' 
                                : 'text-[#86868B] hover:text-white hover:bg-[#333]'
                            }`}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>
            </div>

        </div>
    );
}
