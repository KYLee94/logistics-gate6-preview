import React, { useState } from 'react';
import WorkspaceActivityLog from './WorkspaceActivityLog';

export default function WorkspaceDevelopment() {
    const [hoveredProject, setHoveredProject] = useState(null);

    return (
        <div className="w-full flex-1 flex flex-col pt-[50px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header & Team Structure */}
            <div className="w-full flex justify-between items-center mb-[40px] gap-[40px]">
                {/* Header Metadata */}
                <div className="shrink-0 max-w-[400px]">
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">개발관리</h1>
                    <p className="text-[15px] text-[#86868B] leading-[24px] break-keep">설계·시공·CM·감리 통제, 인허가/명도 대응, 공정·품질·안전 KPI</p>
                </div>
                
                {/* Team Structure */}
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

            {/* Top 3 KPI Cards */}
            <div className="flex w-full gap-[24px] mb-[40px]">
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#fbf167]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">Iota 1 공정률 (현대건설)</h3>
                    <div className="text-[42px] font-black text-white">18<span className="text-[20px] text-[#A1A1AA]">%</span></div>
                    <div className="w-full bg-[#1A1A1A] h-2 rounded-full mt-4"><div className="h-full bg-[#fbf167] rounded-full w-[18%]"></div></div>
                </div>
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#34d399]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">Iota 2 공정률 (삼성물산)</h3>
                    <div className="text-[42px] font-black text-white">12<span className="text-[20px] text-[#A1A1AA]">%</span></div>
                    <div className="w-full bg-[#1A1A1A] h-2 rounded-full mt-4"><div className="h-full bg-[#34d399] rounded-full w-[12%]"></div></div>
                </div>
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#e11d48]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">누적 공정 지연</h3>
                    <div className="text-[42px] font-black text-white">7<span className="text-[16px] font-normal text-[#A1A1AA] ml-2">일</span></div>
                    <p className="text-[13px] text-[#e11d48] mt-2">인허가 2주 누적 지연 영향</p>
                </div>
            </div>

            {/* Project Timelines */}
            <div className="w-full flex flex-col gap-[24px] mb-[40px]">
                {/* 1. IOTA One 427 개발일정 */}
                <div>
                    <h2 className="text-[18px] font-bold text-white mb-[12px]">1. IOTA One 427 개발일정</h2>
                    <div 
                        className={`w-full border border-[#3c3c3c] rounded-[24px] py-[16px] transition-colors duration-300 cursor-pointer group ${hoveredProject === 'iota1' ? 'bg-[#333]' : 'bg-[#292928]'}`}
                        onMouseEnter={() => setHoveredProject('iota1')}
                        onMouseLeave={() => setHoveredProject(null)}
                    >
                        <div className="w-full h-[120px] relative px-[40px]">
                            <div className="absolute top-[56px] left-[40px] right-[40px] h-px bg-[#444] group-hover:bg-[#E5E5E5] transition-colors duration-300 z-0">
                                {[
                                    { date: '2022.12', label: 'PFV설립', left: 0 },
                                    { date: '2024.03', label: '자산매입', left: 0.11 },
                                    { date: '2024.12', label: '통합심의 完', left: 0.18 },
                                    { date: '2025.4', label: '사업시행인가 完', left: 0.28 },
                                    { date: '2025.6', label: '1차연장', left: 0.37 },
                                    { date: '2025.09', label: '2차연장', left: 0.43 },
                                    { date: '2025.10', label: '3차연장', left: 0.49 },
                                    { date: '2026.01', label: 'EOD', left: 0.55 },
                                    { date: 'NOW', label: '', type: 'now', left: 0.59 },
                                    { date: '2027.02', label: '통합PF', left: 0.67 },
                                    { date: '2027.05', label: 'IOTA1 착공', left: 0.76 },
                                    { date: '2028.06', label: 'IOTA2 착공', left: 0.86 },
                                    { date: '2032.08', label: '준공', left: 1.0 }
                                ].map((ms, index) => (
                                    <div key={`iota1-tl-${index}`} className={`absolute flex flex-col items-center justify-center top-1/2 -translate-y-1/2 -translate-x-1/2 ${ms.type === 'now' ? 'ml-[4px]' : ''}`} style={{ left: `${ms.left * 100}%` }}>
                                        <div className="absolute bottom-[20px] w-[120px] text-center pointer-events-none">
                                            <span className={`text-[13px] font-['Inter'] transition-colors duration-300 ${ms.type === 'now' ? 'font-bold text-[#c3c2b7]' : 'text-[#86868B] group-hover:text-[#E5E5E5]'}`}>
                                                {ms.date}
                                            </span>
                                        </div>
                                        <div className="relative z-10 flex items-center justify-center w-[14px] h-[14px]">
                                            {ms.type === 'now' ? (
                                                <div className="absolute w-[2px] h-[36px] border-l-[2px] border-dotted border-[#c3c2b7] -top-[14px] left-[6px]" />
                                            ) : (
                                                <div className="w-[14px] h-[14px] rounded-full bg-[#555] group-hover:bg-white transition-colors duration-300 shadow-sm" />
                                            )}
                                        </div>
                                        <div className="absolute top-[22px] w-[160px] text-center pointer-events-none">
                                            <span className="text-[15px] font-medium text-[#A1A1AA] group-hover:text-white transition-colors duration-300 whitespace-nowrap">
                                                {ms.label}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. IOTA Two 816 개발일정 */}
                <div>
                    <h2 className="text-[18px] font-bold text-white mb-[12px]">2. IOTA Two 816 개발일정</h2>
                    <div 
                        className={`w-full border border-[#3c3c3c] rounded-[24px] py-[16px] transition-colors duration-300 cursor-pointer group ${hoveredProject === 'iota2' ? 'bg-[#333]' : 'bg-[#292928]'}`}
                        onMouseEnter={() => setHoveredProject('iota2')}
                        onMouseLeave={() => setHoveredProject(null)}
                    >
                        <div className="w-full h-[120px] relative px-[40px]">
                            <div className="absolute top-[56px] left-[40px] right-[40px] h-px bg-[#444] group-hover:bg-[#E5E5E5] transition-colors duration-300 z-0">
                                {[
                                    { date: '2022.12', label: 'PFV설립', left: 0 },
                                    { date: '2024.03', label: '자산매입', left: 0.11 },
                                    { date: '2024.12', label: '통합심의 完', left: 0.18 },
                                    { date: '2025.4', label: '사업시행인가 完', left: 0.28 },
                                    { date: '2025.6', label: '1차연장', left: 0.37 },
                                    { date: '2025.09', label: '2차연장', left: 0.43 },
                                    { date: '2025.10', label: '3차연장', left: 0.49 },
                                    { date: '2026.01', label: 'EOD', left: 0.55 },
                                    { date: 'NOW', label: '', type: 'now', left: 0.59 },
                                    { date: '2027.02', label: '통합PF', left: 0.67 },
                                    { date: '2027.05', label: 'IOTA1 착공', left: 0.76 },
                                    { date: '2028.06', label: 'IOTA2 착공', left: 0.86 },
                                    { date: '2032.08', label: '준공', left: 1.0 }
                                ].map((ms, index) => (
                                    <div key={`iota2-tl-${index}`} className={`absolute flex flex-col items-center justify-center top-1/2 -translate-y-1/2 -translate-x-1/2 ${ms.type === 'now' ? 'ml-[4px]' : ''}`} style={{ left: `${ms.left * 100}%` }}>
                                        <div className="absolute bottom-[20px] w-[120px] text-center pointer-events-none">
                                            <span className={`text-[13px] font-['Inter'] transition-colors duration-300 ${ms.type === 'now' ? 'font-bold text-[#c3c2b7]' : 'text-[#86868B] group-hover:text-[#E5E5E5]'}`}>
                                                {ms.date}
                                            </span>
                                        </div>
                                        <div className="relative z-10 flex items-center justify-center w-[14px] h-[14px]">
                                            {ms.type === 'now' ? (
                                                <div className="absolute w-[2px] h-[36px] border-l-[2px] border-dotted border-[#c3c2b7] -top-[14px] left-[6px]" />
                                            ) : (
                                                <div className="w-[14px] h-[14px] rounded-full bg-[#555] group-hover:bg-white transition-colors duration-300 shadow-sm" />
                                            )}
                                        </div>
                                        <div className="absolute top-[22px] w-[160px] text-center pointer-events-none">
                                            <span className="text-[15px] font-medium text-[#A1A1AA] group-hover:text-white transition-colors duration-300 whitespace-nowrap">
                                                {ms.label}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Development Milestones */}
            <div className="w-full mb-[40px] -mt-[14px]">
                <div className="w-full flex gap-[24px]">
                    
                    {/* IOTA One 427 */}
                    <div 
                        className={`flex-1 border border-[#333] rounded-[24px] p-[28px] transition-colors duration-300 ${hoveredProject === 'iota1' ? 'bg-[#333]' : 'bg-[#292928]/50'}`}
                        onMouseEnter={() => setHoveredProject('iota1')}
                        onMouseLeave={() => setHoveredProject(null)}
                    >
                        <div className="flex justify-between items-center mb-[24px]">
                            <h3 className="text-[24px] font-bold text-white leading-none">IOTA One 427</h3>
                            <div className="px-[12px] py-[6px] bg-[#222] border border-[#333] rounded-full">
                                <span className="text-[12px] font-bold text-[#A1A1AA]">준공 2032.08</span>
                            </div>
                        </div>

                        {/* Table Header */}
                        <div className="grid grid-cols-[1fr_50px_60px_50px_60px] gap-[16px] mb-[16px] px-[8px]">
                            <span className="text-[14px] font-bold text-[#86868B]">마일스톤</span>
                            <span className="text-[14px] font-bold text-[#86868B] text-center">UW</span>
                            <span className="text-[14px] font-bold text-[#86868B] text-center">실제</span>
                            <span className="text-[14px] font-bold text-[#86868B] text-center">지연</span>
                            <span className="text-[14px] font-bold text-[#86868B] text-center">상태</span>
                        </div>

                        {/* Rows */}
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
                        className={`flex-1 border border-[#333] rounded-[24px] p-[28px] transition-colors duration-300 ${hoveredProject === 'iota2' ? 'bg-[#333]' : 'bg-[#292928]/50'}`}
                        onMouseEnter={() => setHoveredProject('iota2')}
                        onMouseLeave={() => setHoveredProject(null)}
                    >
                        <div className="flex justify-between items-center mb-[24px]">
                            <h3 className="text-[24px] font-bold text-white leading-none">IOTA Two 816</h3>
                            <div className="px-[12px] py-[6px] bg-[#222] border border-[#333] rounded-full">
                                <span className="text-[12px] font-bold text-[#A1A1AA]">준공 2032.06</span>
                            </div>
                        </div>

                        {/* Table Header */}
                        <div className="grid grid-cols-[1fr_50px_60px_50px_60px] gap-[16px] mb-[16px] px-[8px]">
                            <span className="text-[14px] font-bold text-[#86868B]">마일스톤</span>
                            <span className="text-[14px] font-bold text-[#86868B] text-center">UW</span>
                            <span className="text-[14px] font-bold text-[#86868B] text-center">실제</span>
                            <span className="text-[14px] font-bold text-[#86868B] text-center">지연</span>
                            <span className="text-[14px] font-bold text-[#86868B] text-center">상태</span>
                        </div>

                        {/* Rows */}
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


        </div>
    );
}
