import React from 'react';

export default function SystemCenter() {
    return (
        <div className="flex-1 h-full bg-transparent flex flex-col relative font-sans text-[#1D1D1F] dark:text-[#E5E5E5] overflow-y-auto hide-scrollbar transition-colors duration-300">
            
            {/* Top Tab Bar (IDE Style) */}
            <div className="w-full h-[46px] flex items-end justify-between shrink-0 bg-[#1A1A1A]">
                {/* Tabs Container */}
                <div className="flex h-full items-end pl-0">
                    {/* Inactive Tab */}
                    <div className="flex items-center justify-center px-6 h-full cursor-pointer text-[#86868B] hover:text-[#A1A1AA] transition-colors bg-transparent border-none">
                        <span className="text-[13px] font-normal tracking-wide">더케이트윈타워</span>
                    </div>
                    {/* Active Tab */}
                    <div className="flex items-center justify-between pl-6 pr-3 h-full cursor-pointer text-[#E5E5E5] bg-white dark:bg-[#1F1F1E] relative border-none">
                        <span className="text-[13px] font-medium tracking-wide mr-8">IOTA 서울 816</span>
                        <button className="text-[#86868B] hover:text-white transition-colors outline-none cursor-pointer flex items-center justify-center p-1 rounded-md hover:bg-[#333]">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                <div className="px-5 h-full flex items-center bg-[#1A1A1A]">
                    <div className="text-[#86868B] hover:text-[#E5E5E5] cursor-pointer tracking-[3px] font-black text-[13px] transition-colors duration-300 pb-[2px] transform translate-y-[1px] translate-x-0.5">
                        ···
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="w-[1200px] mx-auto flex-1 flex flex-col pt-[77px]">
                
                {/* Title & Metadata row */}
                <div className="w-full flex justify-between items-end mb-[26px]">
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] -translate-y-[1px] translate-x-[4px]">IOTA Seoul 2_816</h1>
                    
                    <div className="flex items-center h-[48px] translate-y-[4px] -translate-x-[30px]">
                        {/* Item 1 */}
                        <div className="flex flex-col items-center justify-center h-full px-[20px]">
                            <span className="text-[13px] text-[#666] font-normal -mb-[1px] font-['Inter']">Now</span>
                            <span className="text-[18px] font-bold text-[#A1A1AA] tracking-tight cursor-pointer transition-colors duration-200 hover:text-white">개발중</span>
                        </div>
                        
                        <div className="w-px h-[28px] bg-[#333]"></div>
                        
                        {/* Item 2 */}
                        <div className="flex flex-col items-center justify-center h-full px-[20px] flex-shrink-0">
                            <span className="text-[13px] text-[#666] font-normal -mb-[1px] font-['Inter']">Priority</span>
                            <span className="text-[18px] font-bold text-[#e11d48] tracking-tight font-['Inter'] cursor-pointer transition-all duration-200 hover:brightness-125">High</span>
                        </div>
                        
                        <div className="w-px h-[28px] bg-[#333]"></div>
                        
                        {/* Item 3 */}
                        <div className="flex flex-col items-center justify-center h-full px-[20px]">
                            <span className="text-[13px] text-[#666] font-normal -mb-[1px] font-['Inter']">Vehicle</span>
                            <span className="text-[18px] font-bold text-[#A1A1AA] tracking-tight font-['Inter'] cursor-pointer transition-colors duration-200 hover:text-white">PFV</span>
                        </div>
                        
                        <div className="w-px h-[28px] bg-[#333]"></div>
                        
                        {/* Item 4 */}
                        <div className="flex flex-col items-center justify-center h-full px-[20px]">
                            <span className="text-[13px] text-[#666] font-normal -mb-[1px] font-['Inter']">Sector</span>
                            <span className="text-[18px] font-bold text-[#A1A1AA] tracking-tight font-['Inter'] cursor-pointer transition-colors duration-200 hover:text-white">Commercial</span>
                        </div>
                        
                        <div className="w-px h-[28px] bg-[#333]"></div>
                        
                        {/* Item 5 */}
                        <div className="flex flex-col items-center justify-center h-full px-[20px]">
                            <span className="text-[13px] text-[#666] font-normal -mb-[1px] font-['Inter']">Use</span>
                            <span className="text-[18px] font-bold text-[#A1A1AA] tracking-tight font-['Inter'] cursor-pointer transition-colors duration-200 hover:text-white">Office</span>
                        </div>
                        
                        <div className="w-px h-[28px] bg-[#333]"></div>
                        
                        {/* Item 6 */}
                        <div className="flex flex-col items-center justify-center h-full pl-[20px]">
                            <span className="text-[13px] text-[#666] font-normal -mb-[1px] font-['Inter']">Project Type</span>
                            <span className="text-[18px] font-bold text-[#A1A1AA] tracking-tight font-['Inter'] cursor-pointer transition-colors duration-200 hover:text-white">Development</span>
                        </div>
                    </div>
                </div>

                {/* Team Info Pill Box */}
                <div className="w-full bg-[#292928] rounded-[24px] h-[74px] flex items-center justify-between px-8">
                    <div className="flex items-center text-[16px]">
                        <span className="text-[#86868B] mr-[12px] text-[14px] font-medium font-['Inter']">Director</span>
                        <span className="text-white font-bold mr-[32px] cursor-pointer hover:text-[#A1A1AA] transition-colors">이철승</span>
                        
                        <span className="text-[#86868B] mr-[12px] text-[14px] font-medium font-['Inter']">Project Owner</span>
                        <span className="text-white font-bold mr-[32px] cursor-pointer hover:text-[#A1A1AA] transition-colors">강순용</span>
                        
                        <span className="text-[#86868B] mr-[12px] text-[14px] font-medium font-['Inter']">Project Manager</span>
                        <div className="flex items-center gap-[14px]">
                            {['한찬호', '소현준', '이수정', '한수정', '박채현', '조영비'].map(name => (
                                <span key={name} className="text-white font-bold cursor-pointer hover:text-[#A1A1AA] transition-colors">{name}</span>
                            ))}
                        </div>
                    </div>
                    <div className="text-[15px] text-[#86868B] cursor-pointer hover:text-[#E5E5E5] transition-colors font-medium -mr-[2px] flex items-center group">
                        <span>사업2파트 프로젝트 전체보기</span>
                        <svg className="w-[12px] h-[12px] ml-1 text-[#666] group-hover:text-[#A1A1AA] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>

                {/* Timeline Setup */}
                <div className="w-full h-[128px] mt-[14px] relative group cursor-pointer rounded-[24px] hover:bg-[#242424] transition-colors duration-300 px-[40px]">
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
                            <div key={index} className="absolute flex flex-col items-center justify-center top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${ms.left * 100}%` }}>
                                {/* Date (UP) */}
                                <div className="absolute bottom-[20px] w-[120px] text-center pointer-events-none">
                                    <span className={`text-[13px] font-['Inter'] transition-colors duration-300 ${ms.type === 'now' ? 'font-bold text-white' : 'text-[#86868B] group-hover:text-[#E5E5E5]'}`}>
                                        {ms.date}
                                    </span>
                                </div>

                                {/* Node (CENTER) */}
                                <div className="relative z-10 flex items-center justify-center w-[14px] h-[14px]">
                                    {ms.type === 'now' ? (
                                        <div className="absolute w-[2px] h-[36px] border-l-[2px] border-dotted border-white -top-[14px] left-[10px]" />
                                    ) : (
                                        <div className="w-[14px] h-[14px] rounded-full bg-[#555] group-hover:bg-white transition-colors duration-300 shadow-sm" />
                                    )}
                                </div>

                                {/* Label (DOWN) */}
                                <div className="absolute top-[22px] w-[160px] text-center pointer-events-none">
                                    <span className="text-[15px] font-medium text-[#A1A1AA] group-hover:text-white transition-colors duration-300 whitespace-nowrap">
                                        {ms.label}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Dashboard Metrics Cards */}
                <div className="w-full flex gap-[20px] mt-[6px] pb-[40px]">
                    
                    {/* Left Column (380px) */}
                    <div className="w-[380px] h-[264px] flex flex-col gap-[20px]">
                        {/* Box 1 */}
                        <div className="w-full flex-1 bg-[#292928] rounded-[24px] px-6 py-0 flex flex-row items-center cursor-pointer group hover:bg-[#333] transition-colors duration-300">
                            <div className="flex-[0.8] flex flex-col justify-center border-r border-[#444] h-[60px]">
                                <span className="text-[13px] font-bold text-[#86868B] mb-1 font-['Inter']">공급 예정</span>
                                <span className="text-[26px] font-bold text-white tracking-tight leading-none">2032</span>
                            </div>
                            <div className="flex-1 flex flex-col justify-center pl-5 border-r border-[#444] h-[60px]">
                                <span className="text-[13px] font-bold text-[#86868B] mb-1 font-['Inter']">Brand</span>
                                <img src="/iota-logo.png" alt="IOTA" className="h-[22px] object-contain object-left mt-[2px]" />
                            </div>
                            <div className="flex-[1.2] flex flex-col justify-center pl-5 h-[60px]">
                                <span className="text-[13px] font-bold text-[#86868B] mb-1 font-['Inter']">연면적</span>
                                <span className="text-[22px] font-bold text-white tracking-tight leading-none">36,537평</span>
                            </div>
                        </div>

                        {/* Box 2 */}
                        <div className="w-full flex-1 bg-[#292928] rounded-[24px] px-6 py-0 flex flex-row items-center cursor-pointer group hover:bg-[#333] transition-colors duration-300">
                            <div className="flex-[1.4] flex flex-col justify-center border-r border-[#444] h-[60px] pr-5">
                                <span className="text-[13px] font-bold text-[#86868B] mb-2 font-['Inter']">개발기간</span>
                                <div className="flex items-center gap-3 mb-[6px]">
                                    <span className="text-[24px] font-bold text-[#A1A1AA] tracking-tighter leading-none">67M</span>
                                    <span className="text-[14px] text-[#666] leading-none">→</span>
                                    <span className="text-[24px] font-bold text-white tracking-tighter leading-none">116M</span>
                                </div>
                                <div className="flex justify-between w-full">
                                    <span className="text-[10px] text-[#666] font-['Inter'] leading-none">UW 2022.12</span>
                                    <span className="text-[10px] text-[#A1A1AA] font-['Inter'] leading-none">As-is 2026.03</span>
                                </div>
                            </div>
                            <div className="flex-[1] flex flex-col justify-center pl-5 h-[60px]">
                                <span className="text-[13px] font-bold text-[#86868B] mb-2 font-['Inter']">전용면적</span>
                                <div className="flex flex-col gap-[8px]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[12px] text-[#86868B] border-b border-dashed border-[#e11d48] pb-px leading-none">업무</span>
                                        <span className="text-[14px] font-bold text-white leading-none">15,529평</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[12px] text-[#86868B] border-b border-dashed border-[#e11d48] pb-px leading-none">리테일</span>
                                        <span className="text-[14px] font-bold text-white leading-none">1,022평</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column (800px Grid) */}
                    <div className="flex-1 h-[264px] bg-[#292928] rounded-[24px] p-8 relative flex flex-col cursor-pointer group hover:bg-[#333] transition-colors duration-300">
                        {/* Absolute Dividers */}
                        <div className="absolute top-1/2 left-[32px] right-[32px] h-px bg-[#3C3C3C] z-0" />
                        <div className="absolute top-[32px] bottom-[32px] left-1/2 w-px bg-[#3C3C3C] z-0" />
                        
                        <div className="grid grid-cols-2 grid-rows-2 w-full h-full relative z-10">
                            {/* Q1 원가 */}
                            <div className="flex flex-col justify-between pr-8 pb-5">
                                <span className="text-[14px] font-bold text-[#86868B] font-['Inter']">원가</span>
                                <div className="flex items-end justify-end gap-3 w-full">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-[#666] mb-[2px] font-['Inter']">UW 2022.12</span>
                                        <span className="text-[13px] text-[#86868B] mb-[4px]">4,380 만원/평</span>
                                        <span className="text-[26px] font-bold text-[#A1A1AA] tracking-tighter leading-none">1조 6,000억</span>
                                    </div>
                                    <span className="text-[18px] text-[#666] mb-[2px]">→</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-white mb-[2px] font-medium font-['Inter']">As-is 2026.03</span>
                                        <span className="text-[13px] text-white mb-[4px]">6,053 만원/평</span>
                                        <span className="text-[26px] font-bold text-white tracking-tighter leading-none">2조 1,964억</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Q2 매각 목표 */}
                            <div className="flex flex-col justify-between pl-8 pb-5">
                                <span className="text-[14px] font-bold text-[#86868B] font-['Inter']">매각 목표</span>
                                <div className="flex items-end justify-end gap-3 w-full">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-[#666] mb-[2px] font-['Inter']">UW 2022.12</span>
                                        <span className="text-[13px] text-[#86868B] mb-[4px]">4,600 만원/평</span>
                                        <span className="text-[26px] font-bold text-[#A1A1AA] tracking-tighter leading-none">1조 8,070억</span>
                                    </div>
                                    <span className="text-[18px] text-[#666] mb-[2px]">→</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-white mb-[2px] font-medium font-['Inter']">As-is 2026.03</span>
                                        <span className="text-[13px] text-white mb-[4px]"><span className="text-[#86868B] font-['Inter'] mr-1 tracking-tight">Target</span>6,500 만원/평</span>
                                        <span className="text-[26px] font-bold text-white tracking-tighter leading-none">2조 3,749억</span>
                                    </div>
                                </div>
                            </div>

                            {/* Q3 수익률 목표 */}
                            <div className="flex flex-col justify-between pr-8 pt-5">
                                <span className="text-[14px] font-bold text-[#86868B] font-['Inter']">수익률 목표</span>
                                <div className="flex items-end justify-end gap-3 w-full">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-[#666] mb-[2px] font-['Inter']">UW 2022.12</span>
                                        <span className="text-[13px] text-[#86868B] mb-[4px] font-['Inter']">EM x1.75</span>
                                        <span className="text-[26px] font-bold text-[#A1A1AA] tracking-tighter leading-none font-['Inter']">IRR 10.5%</span>
                                    </div>
                                    <span className="text-[18px] text-[#666] mb-[2px]">→</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-white mb-[2px] font-medium font-['Inter']">As-is 2026.03</span>
                                        <span className="text-[13px] text-white mb-[4px] font-['Inter']"><span className="text-[#86868B] mr-1 tracking-tight">Target</span>EM x1.73</span>
                                        <span className="text-[26px] font-bold text-white tracking-tighter leading-none font-['Inter']">IRR 5.8%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Q4 E.NOC 목표 */}
                            <div className="flex flex-col justify-between pl-8 pt-5">
                                <span className="text-[14px] font-bold text-[#86868B] font-['Inter']">E.NOC 목표</span>
                                <div className="flex items-end justify-end gap-3 w-full">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-[#666] mb-[2px] font-['Inter']">UW 2022.12</span>
                                        <span className="text-[13px] text-[#86868B] mb-[4px]">2027년 기준</span>
                                        <span className="text-[26px] font-bold text-[#A1A1AA] tracking-tighter leading-none">37.5만원</span>
                                    </div>
                                    <span className="text-[18px] text-[#666] mb-[2px]">→</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-white mb-[2px] font-medium font-['Inter']">As-is 2026.03</span>
                                        <span className="text-[13px] text-white mb-[4px]">2032년 기준</span>
                                        <span className="text-[26px] font-bold text-white tracking-tighter leading-none">64.3만원</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
