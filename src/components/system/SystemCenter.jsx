import React from 'react';

export default function SystemCenter() {
    return (
        <div className="flex-1 h-full bg-transparent flex flex-col relative font-sans text-[#1D1D1F] dark:text-[#E5E5E5] overflow-hidden transition-colors duration-300">
            
            {/* Top Tab Bar (IDE Style) */}
            <div className="relative z-[100] w-full h-[46px] flex items-end justify-between shrink-0 bg-[#1A1A1A]">
                {/* Tabs Container */}
                <div className="flex h-full items-end pl-0">
                    {/* Inactive Tab */}
                    <div className="flex items-center justify-center px-6 h-full cursor-pointer text-[#86868B] hover:text-[#A1A1AA] transition-colors bg-transparent border-none">
                        <span className="text-[13px] font-normal tracking-wide">더케이트윈타워</span>
                    </div>
                    {/* Active Tab */}
                    <div className="flex items-center justify-between pl-6 pr-3 h-full cursor-pointer text-[#E5E5E5] bg-white dark:bg-[#1F1F1E] relative border-none">
                        <span className="text-[13px] font-medium tracking-wide mr-8">IOTA Seoul 2 816</span>
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

            {/* Dedicated Scroll Container */}
            <div className="flex-1 w-full overflow-y-auto hide-scrollbar flex flex-col relative">
                {/* Main Content Area */}
                <div className="w-[1200px] mx-auto flex-1 flex flex-col pt-[77px] shrink-0 pb-[60px]">
                
                {/* Title & Metadata row */}
                <div className="w-full flex justify-between items-end mb-[26px]">
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] -translate-y-[1px] translate-x-[4px]">IOTA Seoul 2 816</h1>
                    
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
                <div className="w-full bg-[#292928] border border-[#3c3c3c] rounded-[24px] h-[74px] flex items-center justify-between px-8">
                    <div className="flex items-center text-[16px]">
                        <span className="text-[#86868B] mr-[12px] text-[14px] font-medium font-['Inter']">Director</span>
                        <span className="text-white font-bold mr-[32px] cursor-pointer hover:text-[#fbf167] transition-colors">이철승</span>
                        
                        <span className="text-[#86868B] mr-[12px] text-[14px] font-medium font-['Inter']">Project Owner</span>
                        <span className="text-white font-bold mr-[32px] cursor-pointer hover:text-[#fbf167] transition-colors">강순용</span>
                        
                        <span className="text-[#86868B] mr-[12px] text-[14px] font-medium font-['Inter']">Project Manager</span>
                        <div className="flex items-center gap-[14px]">
                            {['한찬호', '소현준', '이수정', '한수정', '박채현', '조영비'].map(name => (
                                <span key={name} className="text-white font-bold cursor-pointer hover:text-[#fbf167] transition-colors">{name}</span>
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
                <div className="w-full h-[120px] mt-[14px] mb-[8px] relative group cursor-pointer rounded-[24px] hover:bg-[#242424] transition-colors duration-300 px-[40px]">
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
                            <div key={index} className={`absolute flex flex-col items-center justify-center top-1/2 -translate-y-1/2 -translate-x-1/2 ${ms.type === 'now' ? 'ml-[4px]' : ''}`} style={{ left: `${ms.left * 100}%` }}>
                                {/* Date (UP) */}
                                <div className="absolute bottom-[20px] w-[120px] text-center pointer-events-none">
                                    <span className={`text-[13px] font-['Inter'] transition-colors duration-300 ${ms.type === 'now' ? 'font-bold text-[#c3c2b7]' : 'text-[#86868B] group-hover:text-[#E5E5E5]'}`}>
                                        {ms.date}
                                    </span>
                                </div>

                                {/* Node (CENTER) */}
                                <div className="relative z-10 flex items-center justify-center w-[14px] h-[14px]">
                                    {ms.type === 'now' ? (
                                        <div className="absolute w-[2px] h-[36px] border-l-[2px] border-dotted border-[#c3c2b7] -top-[14px] left-[6px]" />
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
                <div className="w-full flex gap-[20px] mt-[6px]">
                    
                    {/* Left Column (390px) */}
                    <div className="w-[390px] h-[274px] flex flex-col gap-[20px]">
                        {/* Box 1 */}
                        <div className="w-full flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] flex flex-row items-center cursor-pointer group hover:bg-[#333] transition-colors duration-300">
                            <div className="w-[116px] flex flex-col justify-between border-r border-[#444]/50 h-[54px] pl-[26px]">
                                <span className="text-[14px] font-bold text-[#86868B] font-['Inter'] whitespace-nowrap">공급 예정</span>
                                <span className="text-[28px] font-bold text-white tracking-tight leading-none mt-[-2px] whitespace-nowrap">2032</span>
                            </div>
                            <div className="w-[105px] flex flex-col justify-between border-r border-[#444]/50 h-[54px] pl-[18px]">
                                <span className="text-[14px] font-bold text-[#86868B] font-['Inter'] whitespace-nowrap">Brand</span>
                                <img src={`${import.meta.env.BASE_URL}iota-logo.png`} alt="IOTA" className="h-[22px] object-contain object-left mt-0 opacity-100 mb-[4px]" />
                            </div>
                            <div className="flex-1 flex flex-col justify-between h-[54px] pl-[22px] overflow-hidden">
                                <span className="text-[14px] font-bold text-[#86868B] font-['Inter'] whitespace-nowrap">연면적</span>
                                <span className="text-[28px] font-bold text-white tracking-tight leading-none mt-[-2px] whitespace-nowrap">36,537평</span>
                            </div>
                        </div>

                        {/* Box 2 */}
                        <div className="w-full flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] px-6 pb-[8px] flex flex-row items-center cursor-pointer group hover:bg-[#333] transition-colors duration-300">
                            <div className="flex-[1.4] flex flex-col justify-center border-r border-[#444]/50 h-[74px] pr-5">
                                <span className="text-[14px] font-bold text-[#86868B] mb-[10px] font-['Inter']">개발기간</span>
                                <div className="flex items-center justify-start gap-[10px] mb-[4px]">
                                    <span className="text-[28px] font-bold text-[#A1A1AA] tracking-tighter leading-none">67M</span>
                                    <span className="text-[20px] text-[#666] leading-none mb-1 font-bold">→</span>
                                    <span className="text-[28px] font-bold text-white tracking-tighter leading-none">116M</span>
                                </div>
                                <div className="flex justify-start gap-[24px] w-full">
                                    <span className="text-[11px] text-[#666] font-['Inter'] leading-none">UW 2022.12</span>
                                    <span className="text-[11px] text-[#A1A1AA] font-['Inter'] leading-none">As-is 2026.03</span>
                                </div>
                            </div>
                            <div className="flex-[1] flex flex-col justify-center pl-6 h-[74px]">
                                <span className="text-[14px] font-bold text-[#86868B] mb-[10px] font-['Inter']">전용면적</span>
                                <div className="flex flex-col gap-[10px]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[14px] text-[#86868B] leading-none">업무</span>
                                        <span className="text-[16px] font-bold text-white leading-none">15,529평</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[14px] text-[#86868B] leading-none">리테일</span>
                                        <span className="text-[16px] font-bold text-white leading-none">1,022평</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column (800px Grid) */}
                    <div className="flex-1 h-[274px] bg-[#292928] border border-[#3c3c3c] rounded-[32px] overflow-hidden relative flex flex-col cursor-pointer group hover:bg-[#333] transition-colors duration-300">
                        {/* Absolute Dividers */}
                        <div className="absolute top-1/2 left-0 right-0 h-px bg-[#3C3C3C] z-0" />
                        <div className="absolute top-[0px] bottom-[0px] left-1/2 w-px bg-[#3C3C3C] z-0" />
                        
                        <div className="grid grid-cols-2 grid-rows-2 w-full h-full relative z-10">
                            {/* Q1 원가 */}
                            <div className="relative flex flex-col justify-end px-[32px] pb-[32px]">
                                <span className="absolute top-[20px] left-[20px] text-[15px] font-bold text-[#86868B] font-['Inter'] tracking-tight">원가</span>
                                <div className="flex items-end justify-end gap-3 w-full">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-[#666] mb-0 leading-none font-['Inter']">UW 2022.12</span>
                                        <span className="text-[13px] text-[#86868B] mb-[6px]">4,380 만원/평</span>
                                        <span className="text-[28px] font-bold text-[#A1A1AA] tracking-tighter leading-none">1조 6,000억</span>
                                    </div>
                                    <span className="text-[20px] text-[#666] mb-[1px] font-bold mr-[-2px]">→</span>
                                    <div className="flex flex-col items-end w-[138px] whitespace-nowrap">
                                        <span className="text-[11px] text-white mb-0 leading-none font-medium font-['Inter'] whitespace-nowrap">As-is 2026.03</span>
                                        <span className="text-[13px] text-white mb-[6px] whitespace-nowrap">6,053 만원/평</span>
                                        <span className="text-[28px] font-bold text-[#fbf167] tracking-tighter leading-none whitespace-nowrap">2조 1,964억</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Q2 매각 목표 */}
                            <div className="relative flex flex-col justify-end px-[32px] pb-[32px]">
                                <span className="absolute top-[20px] left-[20px] text-[15px] font-bold text-[#86868B] font-['Inter'] tracking-tight">매각 목표</span>
                                <div className="flex items-end justify-end gap-3 w-full">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-[#666] mb-0 leading-none font-['Inter']">UW 2022.12</span>
                                        <span className="text-[13px] text-[#86868B] mb-[6px]">4,600 만원/평</span>
                                        <span className="text-[28px] font-bold text-[#A1A1AA] tracking-tighter leading-none">1조 8,070억</span>
                                    </div>
                                    <span className="text-[20px] text-[#666] mb-[1px] font-bold mr-[-2px]">→</span>
                                    <div className="flex flex-col items-end w-[138px] whitespace-nowrap">
                                        <span className="text-[11px] text-white mb-0 leading-none font-medium font-['Inter'] whitespace-nowrap">As-is 2026.03</span>
                                        <span className="text-[13px] text-white mb-[6px] whitespace-nowrap"><span className="text-[#86868B] font-['Inter'] mr-1 tracking-tight">Target</span>6,500 만원/평</span>
                                        <span className="text-[28px] font-bold text-[#fbf167] tracking-tighter leading-none whitespace-nowrap">2조 3,749억</span>
                                    </div>
                                </div>
                            </div>

                            {/* Q3 수익률 목표 */}
                            <div className="relative flex flex-col justify-end px-[32px] pb-[34px]">
                                <span className="absolute top-[20px] left-[20px] text-[15px] font-bold text-[#86868B] font-['Inter'] tracking-tight">수익률 목표</span>
                                <div className="flex items-end justify-end gap-3 w-full">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-[#666] mb-0 leading-none font-['Inter']">UW 2022.12</span>
                                        <span className="text-[13px] text-[#86868B] mb-[6px] font-['Inter']">EM x1.75</span>
                                        <span className="text-[28px] font-bold text-[#A1A1AA] tracking-tighter leading-none font-['Inter']">IRR 10.5%</span>
                                    </div>
                                    <span className="text-[20px] text-[#666] mb-[1px] font-bold mr-[-2px]">→</span>
                                    <div className="flex flex-col items-end w-[138px] whitespace-nowrap">
                                        <span className="text-[11px] text-white mb-0 leading-none font-medium font-['Inter'] whitespace-nowrap">As-is 2026.03</span>
                                        <span className="text-[13px] text-white mb-[6px] font-['Inter'] whitespace-nowrap"><span className="text-[#86868B] mr-1 tracking-tight">Target</span>EM x1.73</span>
                                        <span className="text-[28px] font-bold text-white tracking-tighter leading-none font-['Inter'] whitespace-nowrap">IRR 5.8%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Q4 E.NOC 목표 */}
                            <div className="relative flex flex-col justify-end px-[32px] pb-[34px]">
                                <span className="absolute top-[20px] left-[20px] text-[15px] font-bold text-[#86868B] font-['Inter'] tracking-tight">E.NOC 목표</span>
                                <div className="flex items-end justify-end gap-3 w-full">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-[#666] mb-0 leading-none font-['Inter']">UW 2022.12</span>
                                        <span className="text-[13px] text-[#86868B] mb-[6px]">2027년 기준</span>
                                        <span className="text-[28px] font-bold text-[#A1A1AA] tracking-tighter leading-none">37.5만원</span>
                                    </div>
                                    <span className="text-[20px] text-[#666] mb-[1px] font-bold mr-[-2px]">→</span>
                                    <div className="flex flex-col items-end w-[138px] whitespace-nowrap">
                                        <span className="text-[11px] text-white mb-0 leading-none font-medium font-['Inter'] whitespace-nowrap">As-is 2026.03</span>
                                        <span className="text-[13px] text-white mb-[6px] whitespace-nowrap">2032년 기준</span>
                                        <span className="text-[28px] font-bold text-white tracking-tighter leading-none whitespace-nowrap">64.3만원</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Major Issues Box */}
                <div className="w-full bg-[#292928] border border-[#3c3c3c] rounded-[32px] pl-[24px] pr-[32px] py-[24px] flex flex-col mt-[20px] mb-[20px] h-[127px]">
                    <div className="w-full flex justify-between items-center mb-[1px] mt-[-5px]">
                        <span className="text-[14px] font-bold text-[#86868B] font-['Inter'] relative top-[-1px]">주요 이슈</span>
                        <div className="w-[32px] h-[32px] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#444]/60 transition-colors duration-200 group/btn mr-[-4px]">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover/btn:opacity-100 transition-opacity">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                    </div>
                    <div className="flex flex-col gap-[4px]">
                        <span className="text-[16px] font-medium text-[#c3c2b7] leading-[22px] tracking-tight">
                            2026년 3월 클로징 목표로 리파이낸싱을 추진했으나 KB증권 안이 부결되어 현재는 선순위 일부는 메리츠증권, 잔여분은 NH증권이 참여하는 구조를 협의 중임
                        </span>
                        <span className="text-[16px] font-medium text-[#c3c2b7] leading-[22px] tracking-tight">
                            PFV는 브릿지론 후순위 대여 700억원 소노인터내셔널 확약을 확보했고, 힐튼 재개발사업과 통합 프로젝트 리츠 설립 후 PF를 조달해 전반적 사업구조 안정화하는 방안 함께 검토 중
                        </span>
                    </div>
                </div>

                {/* Investment Structure Box */}
                <div className="w-full bg-[#292928] border border-[#3c3c3c] rounded-[32px] pt-[20px] flex flex-col mb-[20px] overflow-hidden">
                    {/* Header Row */}
                    <div className="flex justify-between items-center w-full pb-[16px] border-b border-[#444]/50 pl-[26px] pr-[32px]">
                        <div className="flex items-center gap-[16px]">
                            <div className="flex items-center gap-[6px]">
                                <span className="text-[#86868B] font-bold text-[16px]">Equity</span>
                                <span className="text-[#fbf167] font-bold text-[16px]">63.95 억원</span>
                            </div>
                            <div className="flex items-center gap-[6px]">
                                <span className="text-[#86868B] font-bold text-[16px]">Loan</span>
                                <span className="text-[#fbf167] font-bold text-[16px]">9,570 억원</span>
                            </div>
                            
                            <div className="w-[1px] h-[12px] bg-[#444]/50 mx-[4px]"></div>
                            
                            <div className="flex items-baseline gap-[4px]">
                                <span className="text-[#86868B] font-bold text-[15px] mr-[2px]">Tr.A</span>
                                <span className="text-white font-bold text-[15px]">4,800 억원</span>
                                <span className="text-[#86868B] text-[14px] tracking-tight mr-[8px]">(7.7%)</span>
                                
                                <span className="text-[#86868B] font-bold text-[15px] mr-[2px]">Tr.B</span>
                                <span className="text-white font-bold text-[15px]">1,400 억원</span>
                                <span className="text-[#86868B] text-[14px] tracking-tight mr-[8px]">(11.3%)</span>
                                
                                <span className="text-[#86868B] font-bold text-[15px] mr-[2px]">Tr.C</span>
                                <span className="text-white font-bold text-[15px]">970 억원</span>
                                <span className="text-[#86868B] text-[14px] tracking-tight">(15.6%)</span>
                                
                                <span className="text-[#86868B] text-[14px] tracking-tight ml-[2px]">_ All-in</span>
                            </div>
                        </div>
                        <div className="text-[15px] text-[#86868B] cursor-pointer hover:text-[#E5E5E5] transition-colors font-medium flex items-center group">
                            <span>투자구조 자세히보기</span>
                            <svg className="w-[12px] h-[12px] ml-1 text-[#666] group-hover:text-[#A1A1AA] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>

                    {/* Content Columns */}
                    <div className="grid grid-cols-4 w-full divide-x divide-[#444]/50">
                        {/* Col 1 */}
                        <div className="flex flex-col pt-[20px] pb-[32px] pl-[26px] pr-[22px]">
                            <div className="flex justify-between items-center w-full mb-[16px]">
                                <span className="text-[#86868B] font-bold text-[15px]">수익자</span>
                                <span className="text-white font-bold text-[16px]">63.95 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full mb-[12px] group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">1. 국민은행</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">19.55 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full mb-[12px] group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">2. 에셀유한회사</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">16.50 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full mb-[12px] group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">3. 신한투자증권</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">12.95 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full mb-[12px] group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">4. NH투자증권</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">7.95 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">5. 삼성물산</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">6.00 억</span>
                            </div>
                        </div>

                        {/* Col 2 */}
                        <div className="flex flex-col pt-[20px] pb-[32px] px-[22px]">
                            <div className="flex justify-between items-center w-full mb-[16px]">
                                <span className="text-[#86868B] font-bold text-[15px]">Tr. A</span>
                                <span className="text-white font-bold text-[16px]">4,800 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full mb-[12px] group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">1. 국민은행</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">1,500 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full mb-[12px] group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">2. 과학기술인공제회</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">500 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full mb-[12px] group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">3. 대구은행</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">500 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full mb-[12px] group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">4. 미래에셋캐피탈</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">480 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">5. KB캐피탈</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">450 억</span>
                            </div>
                        </div>

                        {/* Col 3 */}
                        <div className="flex flex-col pt-[20px] pb-[32px] px-[22px]">
                            <div className="flex justify-between items-center w-full mb-[16px]">
                                <span className="text-[#86868B] font-bold text-[15px]">Tr. B</span>
                                <span className="text-white font-bold text-[16px]">1,400 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full mb-[12px] group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">1. 한투리얼(Debt)</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">600 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full mb-[12px] group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">2. 한투리얼(메자닌)</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">350 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full mb-[12px] group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">3. 신한증권</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">115 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full mb-[12px] group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">4. 신한캐피탈</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">100 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">5. NH투자증권</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">85 억</span>
                            </div>
                        </div>

                        {/* Col 4 */}
                        <div className="flex flex-col pt-[20px] pb-[32px] pl-[22px] pr-[32px]">
                            <div className="flex justify-between items-center w-full mb-[16px]">
                                <span className="text-[#86868B] font-bold text-[15px]">Tr. C</span>
                                <span className="text-white font-bold text-[16px]">970 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full mb-[12px] group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">1. 대신증권</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">480 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full mb-[12px] group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">2. 신한증권</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">290 억</span>
                            </div>
                            <div className="flex justify-between items-center w-full mb-[12px] group cursor-pointer">
                                <span className="text-[#E5E5E5] text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">3. DS증권</span>
                                <span className="text-white text-[15.5px] transition-all duration-200 group-hover:text-white group-hover:underline underline-offset-[3px] decoration-white/50">200 억</span>
                            </div>
                            <div className="w-full border-t border-[#444]/50 mt-[6px] mb-[18px]"></div>
                            <div className="flex justify-between items-center w-full">
                                <span className="text-[#E5E5E5] text-[15.5px]">주주대여금</span>
                                <span className="text-white font-bold text-[16px]">2,400 억</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Architectural Info Box */}
                <div className="w-full flex gap-[20px] mb-[20px]">
                    {/* Left Column (Image) */}
                    <div className="w-[450px] h-[452px] relative rounded-[32px] overflow-hidden group">
                        <img src={`${import.meta.env.BASE_URL}iotaseoul2.jpg`} alt="IOTA Seoul" className="w-full h-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-[1.03]" />
                        
                        {/* Premium Inner Overlay Stroke */}
                        <div className="absolute inset-0 rounded-[32px] border border-white/15 pointer-events-none z-10 transition-colors duration-700 group-hover:border-white/25"></div>
                        
                        {/* Top Right '+' Button */}
                        <div className="absolute top-[17px] right-[17px] w-[46px] h-[46px] rounded-full bg-black/20 border border-white/60 flex items-center justify-center cursor-pointer hover:bg-black/30 transition-colors z-10 shadow-sm">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="4" x2="12" y2="20"></line>
                                <line x1="4" y1="12" x2="20" y2="12"></line>
                            </svg>
                        </div>
                        
                        {/* Bottom Center Pill */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-[14px] py-[6px] rounded-[6px] bg-black/40 border border-white/20 flex items-center justify-center cursor-pointer hover:bg-black/60 transition-colors z-10 shadow-sm whitespace-nowrap">
                            <span className="text-[13px] text-white/90 font-medium tracking-tight">CG컷 | 평면도</span>
                        </div>
                    </div>

                    {/* Right Column (Data Table) */}
                    <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] pt-[24px] pb-[4px] relative flex flex-col h-[452px] overflow-hidden">
                        
                        {/* Architecture Overview Link */}
                        <div className="absolute top-[24px] right-[32px] text-[14px] text-[#86868B] cursor-pointer hover:text-[#E5E5E5] transition-colors font-medium flex items-center group z-10">
                            <span>건축개요 전체보기</span>
                            <svg className="w-[12px] h-[12px] ml-1 text-[#666] group-hover:text-[#A1A1AA] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                            </svg>
                        </div>

                        {/* Top Header Row */}
                        <div className="flex items-center gap-[24px] mb-[24px] pl-[28px] pr-[140px]">
                            <div className="flex flex-col gap-[3px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">시공사</span>
                                <span className="text-[28px] font-bold text-white tracking-tighter leading-none">삼성물산</span>
                            </div>
                            <div className="w-[1px] h-[36px] bg-[#444]/50"></div>
                            <div className="flex flex-col gap-[3px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">설계사</span>
                                <span className="text-[28px] font-bold text-white tracking-tighter leading-none">SOM, dA</span>
                            </div>
                            <div className="w-[1px] h-[36px] bg-[#444]/50"></div>
                            <div className="flex flex-col gap-[3px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">바닥면적</span>
                                <span className="text-[28px] font-bold text-white tracking-tighter leading-none">575평</span>
                            </div>
                            <div className="w-[1px] h-[36px] bg-[#444]/50"></div>
                            <div className="flex flex-col gap-[3px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">전력</span>
                                <span className="text-[28px] font-bold text-white tracking-tighter leading-none">13MW</span>
                            </div>
                        </div>

                        {/* Full Width Divider */}
                        <div className="w-full border-t border-[#444]/50"></div>

                        {/* 2-Column Data Grid */}
                        <div className="grid grid-cols-2 flex-1">
                            {/* Row 1 */}
                            <div className="grid grid-cols-[84px_1fr] items-center border-b border-r border-[#444]/50 pl-[28px] pr-[16px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">시행법인</span>
                                <span className="text-[16px] text-[#E5E5E5] tracking-tight font-medium truncate pr-4">와이디816피에프브이(주)</span>
                            </div>
                            <div className="grid grid-cols-[84px_1fr] items-center border-b border-[#444]/50 pl-[24px] pr-[32px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">규모</span>
                                <span className="text-[16px] text-[#E5E5E5] tracking-tight font-medium">B9 / 34F</span>
                            </div>

                            {/* Row 2 */}
                            <div className="grid grid-cols-[84px_1fr] items-center border-b border-r border-[#444]/50 pl-[28px] pr-[16px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">위치</span>
                                <span className="text-[16px] text-[#E5E5E5] tracking-tight font-medium truncate pr-4">서울시 중구 남대문로 5가 526, 537...</span>
                            </div>
                            <div className="grid grid-cols-[84px_1fr] items-center border-b border-[#444]/50 pl-[24px] pr-[32px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">층고</span>
                                <span className="text-[16px] text-[#E5E5E5] tracking-tight font-medium">4.3m (업무시설)</span>
                            </div>

                            {/* Row 3 */}
                            <div className="grid grid-cols-[84px_1fr] items-center border-b border-r border-[#444]/50 pl-[28px] pr-[16px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">연면적</span>
                                <span className="text-[16px] text-[#E5E5E5] tracking-tight font-medium truncate">120,783 m² (36,537평)</span>
                            </div>
                            <div className="grid grid-cols-[84px_1fr] items-center border-b border-[#444]/50 pl-[24px] pr-[32px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">천정고</span>
                                <span className="text-[16px] text-[#E5E5E5] tracking-tight font-medium">2.95m (업무시설)</span>
                            </div>

                            {/* Row 4 */}
                            <div className="grid grid-cols-[84px_1fr] items-center border-b border-r border-[#444]/50 pl-[28px] pr-[16px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">사업면적</span>
                                <span className="text-[16px] text-[#E5E5E5] tracking-tight font-medium truncate">7,199.90 m² (2,178평)</span>
                            </div>
                            <div className="grid grid-cols-[84px_1fr] items-center border-b border-[#444]/50 pl-[24px] pr-[32px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">주차대수</span>
                                <span className="text-[16px] text-[#E5E5E5] tracking-tight font-medium">519 대</span>
                            </div>

                            {/* Row 5 */}
                            <div className="grid grid-cols-[84px_1fr] items-center border-b border-r border-[#444]/50 pl-[28px] pr-[16px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">용도</span>
                                <span className="text-[16px] text-[#E5E5E5] tracking-tight font-medium truncate">업무시설, 근린생활시설</span>
                            </div>
                            <div className="grid grid-cols-[84px_1fr] items-center border-b border-[#444]/50 pl-[24px] pr-[32px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">높이</span>
                                <span className="text-[16px] text-[#E5E5E5] tracking-tight font-medium">162.98m</span>
                            </div>

                            {/* Row 6 */}
                            <div className="grid grid-cols-[84px_1fr] items-center border-b border-r border-[#444]/50 pl-[28px] pr-[16px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">건폐율</span>
                                <span className="text-[16px] text-[#E5E5E5] tracking-tight font-medium">42.86%</span>
                            </div>
                            <div className="grid grid-cols-[84px_1fr] items-center border-b border-[#444]/50 pl-[24px] pr-[32px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">개방형녹지</span>
                                <span className="text-[16px] text-[#E5E5E5] tracking-tight font-medium truncate">3,424.70m² (1,036평)</span>
                            </div>

                            {/* Row 7 */}
                            <div className="grid grid-cols-[84px_1fr] items-center border-r border-[#444]/50 pl-[28px] pr-[16px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">용적률</span>
                                <span className="text-[16px] text-[#E5E5E5] tracking-tight font-medium">1,159.94%</span>
                            </div>
                            <div className="grid grid-cols-[84px_1fr] items-center pl-[24px] pr-[32px]">
                                <span className="text-[15px] font-bold text-[#86868B] tracking-tight">전용률</span>
                                <span className="text-[16px] text-[#E5E5E5] tracking-tight font-medium">46.62%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Brand & Product Box */}
                <div className="w-full bg-[#292928] border border-[#3c3c3c] rounded-[32px] flex flex-row mb-[20px] overflow-hidden">
                    <div className="w-[200px] shrink-0 border-r border-[#444]/50 flex flex-col items-center justify-between py-[36px] px-[24px]">
                        <span className="text-[14px] font-bold text-[#86868B] w-full text-center">Brand & Product</span>
                        <img src={`${import.meta.env.BASE_URL}iota-logo.png`} alt="IOTA" className="w-[110px] object-contain opacity-100 my-auto" />
                        <div className="w-full flex flex-col gap-[8px]">
                            <div className="w-full h-[32px] rounded-[8px] border border-[#444] bg-transparent flex items-center justify-center cursor-pointer hover:bg-[#333] transition-colors">
                                <span className="text-[12px] font-bold text-[#A1A1AA] tracking-wide">Sales kit</span>
                            </div>
                            <a href="https://iotaseoul.site/" target="_blank" rel="noopener noreferrer" className="w-full h-[32px] rounded-[8px] border border-[#444] bg-transparent flex items-center justify-center cursor-pointer hover:bg-[#333] transition-colors">
                                <span className="text-[12px] font-bold text-[#A1A1AA] tracking-wide">Website</span>
                            </a>
                        </div>
                    </div>

                    {/* Right Partition (Data Grid + Footer) */}
                    <div className="flex-1 flex flex-col relative">
                        {/* Data Grid */}
                        <div className="flex-1 flex flex-col gap-[16px] pl-[32px] pr-[90px] py-[28px] relative">
                            {/* Rows */}
                            <div className="flex items-start">
                                <span className="w-[160px] shrink-0 text-[14px] font-bold text-[#86868B] mt-[1px]">Brand Guidelines</span>
                                <a href="#" className="text-[15px] font-medium text-[#c3c2b7] tracking-tight leading-[22px] hover:text-[#fbf167] cursor-pointer transition-colors">그리스 숫자로 10을 의미하는 단어 'IOTA'는 모든 수를 포함하는 통합의 수 '10'을 뜻합니다.</a>
                            </div>
                            <div className="flex items-start">
                                <span className="w-[160px] shrink-0 text-[14px] font-bold text-[#86868B] mt-[1px]">프로젝트 리서치</span>
                                <a href="#" className="text-[15px] font-medium text-[#c3c2b7] tracking-tight leading-[22px] hover:text-[#fbf167] cursor-pointer transition-colors">당대 글로벌 Trophy 오피스 사례를 비교 조사 했습니다. (아자부다이힐스, 토라노몬힐스, 270 파크에비뉴..)</a>
                            </div>
                            <div className="flex items-start">
                                <span className="w-[160px] shrink-0 text-[14px] font-bold text-[#86868B] mt-[1px]">프로젝트 브랜드 컨셉</span>
                                <a href="#" className="text-[15px] font-medium text-[#c3c2b7] tracking-tight leading-[22px] hover:text-[#fbf167] cursor-pointer transition-colors">TBD (ex. Moden Urban Village Green & Wellness by Azabudai Hills)</a>
                            </div>
                            <div className="flex items-start">
                                <span className="w-[160px] shrink-0 text-[14px] font-bold text-[#86868B] mt-[1px]">공간 UX 차별성</span>
                                <a href="#" className="text-[15px] font-medium text-[#c3c2b7] tracking-tight leading-[22px] hover:text-[#fbf167] cursor-pointer transition-colors">개방형녹지(게이트웨이파크), 시티뷰 멀티 아레나, 루프탑 스카이가든, 프라이빗 이벤트스페이스, 라운지, 로비, 진입동선 등</a>
                            </div>
                            <div className="flex items-start">
                                <span className="w-[160px] shrink-0 text-[14px] font-bold text-[#86868B] mt-[1px]">디지털 OS & UX</span>
                                <a href="#" className="text-[15px] font-medium text-[#c3c2b7] tracking-tight leading-[22px] hover:text-[#fbf167] cursor-pointer transition-colors">핀포인트+삼성전자 디지털 OS 탑재 기획 진행중</a>
                            </div>

                            {/* Circular Plus Button */}
                            <div className="absolute top-[18px] right-[18px] w-[46px] h-[46px] rounded-full border border-[#555] flex items-center justify-center cursor-pointer hover:bg-[#444] transition-colors group z-10 shadow-sm">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E5E5E5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                            </div>
                        </div>

                        {/* Footer Section restricted strictly to the right side */}
                        <div className="w-full h-[54px] border-t border-[#444]/50 flex items-center pl-[32px] gap-[24px] shrink-0">
                            <div className="flex items-center gap-[12px]">
                                <span className="text-[13px] font-bold text-[#86868B]">브랜드 담당</span>
                                <a href="#" className="text-[14px] font-bold text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors">공간솔루션센터</a>
                            </div>
                            <div className="w-[1px] h-[14px] bg-[#555]"></div>
                            <div className="flex items-center gap-[12px]">
                                <span className="text-[13px] font-bold text-[#86868B]">Partnership</span>
                                <a href="#" className="text-[14px] font-bold text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors">삼성전자</a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Corporate Sales & Partnership Box */}
                <div className="w-full bg-[#292928] border border-[#3c3c3c] rounded-[32px] flex flex-col mb-[20px] overflow-hidden">
                    {/* Header & Body */}
                    <div className="pl-[30px] pr-[32px] pt-[28px] pb-[27px] flex flex-col relative w-full">
                        {/* Title Row */}
                        <div className="flex items-center justify-between w-full mb-[14px]">
                            <span className="text-[14px] font-bold text-[#86868B] tracking-tight">기업 세일즈 & 파트너십</span>
                            <div className="text-[15px] text-[#86868B] cursor-pointer hover:text-[#E5E5E5] transition-colors font-medium flex items-center group tracking-tight">
                                <span>히스토리 전체보기</span>
                                <svg className="w-[12px] h-[12px] ml-[4px] text-[#666] group-hover:text-[#A1A1AA] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                        
                        {/* Content Rows */}
                        <div className="flex flex-col gap-[8px]">
                            {/* Row 1 */}
                            <div className="text-[15px] leading-[22px]">
                                <span className="text-[#86868B] font-medium mr-[6px] tracking-tight">[접촉 준비]</span>
                                <a href="#" className="text-[#c3c2b7] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">
                                    IOTA 서울 SK 계열사 통합 이전 관련 (약 0000명 0개층 사용) 접촉 준비 
                                </a>
                                <span className="text-[#666] mx-[8px]">ㅣ</span> 
                                <a href="#" className="text-[#E5E5E5] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">SK솔루션</a>
                                <span className="text-[#666] mx-[8px]">ㅣ</span> 
                                <a href="#" className="text-[#E5E5E5] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">OO 사업실 OOO 본부장</a>
                            </div>
                            
                            {/* Row 2 */}
                            <div className="text-[15px] leading-[22px]">
                                <span className="text-[#86868B] font-medium mr-[6px] tracking-tight">[제안 및 검토]</span>
                                <a href="#" className="text-[#c3c2b7] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">
                                    LG전자 이오타 임차, 프로젝트 내 설비 + 데이터센터 설비 협업 사업건 제안 및 상호 협의 진행중 
                                </a>
                                <span className="text-[#666] mx-[8px]">ㅣ</span> 
                                <a href="#" className="text-[#E5E5E5] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">LG전자</a>
                                <span className="text-[#666] mx-[8px]">ㅣ</span> 
                                <a href="#" className="text-[#E5E5E5] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">한국 영업본부 데이터사업실 CSO OOO</a>
                            </div>
                            
                            {/* Row 3 */}
                            <div className="text-[15px] leading-[22px]">
                                <span className="text-[#86868B] font-medium mr-[6px] tracking-tight">[제안 및 검토]</span>
                                <a href="#" className="text-[#c3c2b7] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">
                                    법무법인 화우 임차 제안(약 1천명 이오타2 7개층 사용) 및 협의 진행중 
                                </a>
                                <span className="text-[#666] mx-[8px]">ㅣ</span> 
                                <a href="#" className="text-[#E5E5E5] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">법무법인화우</a>
                                <span className="text-[#666] mx-[8px]">ㅣ</span> 
                                <a href="#" className="text-[#E5E5E5] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">한영익 팀장</a>
                            </div>
                        </div>
                    </div>

                    {/* Footer Section */}
                    <div className="w-full h-[54px] border-t border-[#444]/50 flex items-center pl-[30px] gap-[24px] shrink-0">
                        <div className="flex items-center gap-[12px]">
                            <span className="text-[13px] font-bold text-[#86868B]">기업세일즈 담당</span>
                            <a href="#" className="text-[14px] font-bold text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors">기업마케팅센터</a>
                        </div>
                        <div className="w-[1px] h-[14px] bg-[#555]"></div>
                        <div className="flex items-center gap-[12px]">
                            <span className="text-[13px] font-bold text-[#86868B]">Partnership</span>
                            <a href="#" className="text-[14px] font-bold text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors">PwC</a>
                        </div>
                    </div>
                </div>

                {/* Marketing & Placemaking Box */}
                <div className="w-full bg-[#292928] border border-[#3c3c3c] rounded-[32px] flex flex-row mb-[80px] overflow-hidden">
                    
                    {/* Left Column Strategy: Marketing */}
                    <div className="flex-1 border-r border-[#444]/50 flex flex-col">
                        {/* Body */}
                        <div className="pl-[30px] pr-[32px] pt-[28px] pb-[27px] flex flex-col flex-1">
                            {/* Title */}
                            <div className="flex items-center justify-between w-full mb-[14px]">
                                <span className="text-[14px] font-bold text-[#86868B] tracking-tight">Marketing</span>
                                <div className="text-[15px] text-[#86868B] cursor-pointer hover:text-[#E5E5E5] transition-colors font-medium flex items-center group tracking-tight -mr-[9px]">
                                    <span>마케팅 내역 전체보기</span>
                                    <svg className="w-[12px] h-[12px] ml-[4px] text-[#666] group-hover:text-[#A1A1AA] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                            {/* Content */}
                            <div className="flex flex-col gap-[8px]">
                                <div className="text-[15px] leading-[22px]">
                                    <span className="text-[#86868B] font-medium mr-[6px] tracking-tight">[자체생산]</span>
                                    <a href="#" className="text-[#c3c2b7] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">Design Presentation by Luke Fox (Interview 영상)</a>
                                </div>
                                <div className="text-[15px] leading-[22px]">
                                    <span className="text-[#86868B] font-medium mr-[6px] tracking-tight">[기획기사]</span>
                                    <a href="#" className="text-[#c3c2b7] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">AI시대 '서울의 지식 허브' 떠오르는 6개 핵심 지역은</a>
                                </div>
                                <div className="text-[15px] leading-[22px]">
                                    <span className="text-[#86868B] font-medium mr-[6px] tracking-tight">[기획기사]</span>
                                    <a href="#" className="text-[#c3c2b7] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">NH투자증권, 이오타2 프로젝트에 1300억 투입... 리파이낸싱 마무리 수순</a>
                                </div>
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="w-full h-[54px] border-t border-[#444]/50 flex items-center pl-[30px] shrink-0">
                            <span className="text-[13px] font-bold text-[#86868B] mr-[12px]">마케팅 담당</span>
                            <a href="#" className="text-[14px] font-bold text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors">기업마케팅센터</a>
                            <span className="text-[#666] mx-[8px]">ㅣ</span>
                            <a href="#" className="text-[14px] font-bold text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors">PR팀</a>
                        </div>
                    </div>

                    {/* Right Column Strategy: Placemaking */}
                    <div className="flex-1 flex flex-col">
                        {/* Body */}
                        <div className="pl-[30px] pr-[32px] pt-[28px] pb-[27px] flex flex-col flex-1 relative">
                            {/* Title */}
                            <div className="flex items-center justify-between w-full mb-[14px]">
                                <span className="text-[14px] font-bold text-[#86868B] tracking-tight">Placemaking</span>
                                <div className="text-[15px] text-[#86868B] cursor-pointer hover:text-[#E5E5E5] transition-colors font-medium flex items-center group tracking-tight">
                                    <span>히스토리 전체보기</span>
                                    <svg className="w-[12px] h-[12px] ml-[4px] text-[#666] group-hover:text-[#A1A1AA] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                            {/* Content Centered "TBD" */}
                            <div className="flex-1 flex items-center justify-center -mt-[14px]">
                                <span className="text-[#86868B] font-bold text-[24px]">TBD</span>
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="w-full h-[54px] border-t border-[#444]/50 flex items-center pl-[30px] shrink-0">
                            <span className="text-[13px] font-bold text-[#86868B] mr-[12px]">플레이스메이킹 담당</span>
                            <span className="text-[14px] font-bold text-[#86868B]">TBD</span>
                        </div>
                    </div>

                </div>

                </div>
            </div>
        </div>
    );
}
