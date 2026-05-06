import React from 'react';
import WorkspaceActivityLog from './WorkspaceActivityLog';

export default function WorkspaceFinancing() {
    return (
                <div className="w-full flex-1 flex flex-col pt-[50px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header & Team Structure */}
            <div className="w-full flex justify-between items-center mb-[40px] gap-[40px]">
                {/* Header Metadata */}
                <div className="shrink-0 max-w-[350px]">
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">파이낸싱</h1>
                    <p className="text-[15px] text-[#86868B] leading-[24px] break-keep">IOTA Seoul Capital Stack 및 대주단 파이프라인 관리</p>
                </div>
                
                {/* Team Structure */}
                <div className="border border-[#333] rounded-[24px] flex flex-col bg-transparent shrink-0">

                    
                    <div className="flex items-center pl-[20px] pr-[10px] py-[10px]">
                        <div className="w-[70px] shrink-0">
                            <span className="text-[13px] font-bold text-[#86868B]">파이낸싱</span>
                        </div>
                        <div className="flex items-center gap-[12px] w-[130px] shrink-0">
                            <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                                <img src={`${import.meta.env.BASE_URL}박준호.webp`} alt="박준호" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-white font-bold text-[13px] leading-tight">박준호</span>
                                <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">LFC 센터장</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-x-1.5 gap-y-2 -ml-[6px]">
                            {["강석민","정리훈","손유정","김지우","박현승","이성민A","한승환"].map(name => (
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

            <WorkspaceActivityLog workspaceCode="WS_LFC" workspaceLabel="파이낸싱-LFC" />

            {/* 421 Fund Equity Stack */}
            <h2 className="text-[20px] font-bold text-white mb-[20px]">421 REF Equity Structure</h2>
            <div className="bg-[#1A1A1A] border border-[#333] rounded-[24px] p-[32px] mb-[40px]">
                <div className="flex justify-between items-end mb-[24px]">
                    <div>
                        <h3 className="text-[15px] text-[#86868B] font-bold mb-1">Total Equity Size</h3>
                        <div className="text-[40px] font-black text-white leading-none">3,090<span className="text-[20px] text-[#A1A1AA] ml-2">억원</span></div>
                    </div>
                    <div className="text-right">
                        <span className="text-[13px] text-[#666] block mb-1">Blended Target Return</span>
                        <span className="text-[20px] font-bold text-[#fbf167]">6.5%</span>
                    </div>
                </div>

                {/* Stacked Bar */}
                <div className="w-full h-[32px] rounded-[8px] flex overflow-hidden mb-[16px]">
                    <div className="h-full bg-[#e11d48] w-[20.1%] relative group cursor-pointer">
                        <div className="absolute inset-0 bg-white/0 hover:bg-white/10 transition-colors"></div>
                    </div>
                    <div className="h-full bg-[#fbf167] w-[20.1%] relative group cursor-pointer">
                        <div className="absolute inset-0 bg-white/0 hover:bg-white/10 transition-colors"></div>
                    </div>
                    <div className="h-full bg-[#34d399] w-[59.9%] relative group cursor-pointer">
                        <div className="absolute inset-0 bg-white/0 hover:bg-white/10 transition-colors"></div>
                    </div>
                </div>

                {/* Legend & Details */}
                <div className="grid grid-cols-3 gap-[20px]">
                    {/* A종 */}
                    <div className="bg-[#222] rounded-[16px] p-4 border-t-4 border-[#e11d48]">
                        <div className="flex justify-between mb-3">
                            <span className="text-[16px] font-bold text-white">A종 (선순위)</span>
                            <span className="text-[16px] font-bold text-[#e11d48]">620억 (20.1%)</span>
                        </div>
                        <ul className="text-[13px] text-[#A1A1AA] flex flex-col gap-2">
                            <li className="flex justify-between"><span>국민연금</span><span className="text-[#E5E5E5]">190억 (30.6%)</span></li>
                            <li className="flex justify-between"><span>교보생명</span><span className="text-[#E5E5E5]">130억 (21.0%)</span></li>
                            <li className="flex justify-between"><span>삼성생명/화재</span><span className="text-[#E5E5E5]">200억 (32.2%)</span></li>
                            <li className="flex justify-between"><span>DB손보/흥국</span><span className="text-[#E5E5E5]">100억 (16.2%)</span></li>
                        </ul>
                    </div>
                    {/* B종 */}
                    <div className="bg-[#222] rounded-[16px] p-4 border-t-4 border-[#fbf167]">
                        <div className="flex justify-between mb-3">
                            <span className="text-[16px] font-bold text-white">B종 (중순위)</span>
                            <span className="text-[16px] font-bold text-[#fbf167]">620억 (20.1%)</span>
                        </div>
                        <ul className="text-[13px] text-[#A1A1AA] flex flex-col gap-2">
                            <li className="flex justify-between"><span>메리츠화재</span><span className="text-[#E5E5E5]">210억 (33.9%)</span></li>
                            <li className="flex justify-between"><span>국민연금</span><span className="text-[#E5E5E5]">134.5억 (21.7%)</span></li>
                            <li className="flex justify-between"><span>MG새마을</span><span className="text-[#E5E5E5]">95억 (15.3%)</span></li>
                            <li className="flex justify-between"><span>삼성/현대 등</span><span className="text-[#E5E5E5]">180.5억 (29.1%)</span></li>
                        </ul>
                    </div>
                    {/* C종 */}
                    <div className="bg-[#222] rounded-[16px] p-4 border-t-4 border-[#34d399]">
                        <div className="flex justify-between mb-3">
                            <span className="text-[16px] font-bold text-white">C종 (후순위)</span>
                            <span className="text-[16px] font-bold text-[#34d399]">1,850억 (59.9%)</span>
                        </div>
                        <ul className="text-[13px] text-[#A1A1AA] flex flex-col gap-2">
                            <li className="flex justify-between"><span>이지스자산</span><span className="text-[#E5E5E5]">800억 (43.2%)</span></li>
                            <li className="flex justify-between"><span>NH투자증권</span><span className="text-[#E5E5E5]">500억 (27.0%)</span></li>
                            <li className="flex justify-between"><span>신한투자</span><span className="text-[#E5E5E5]">250억 (13.5%)</span></li>
                            <li className="flex justify-between"><span>한국/국민연금</span><span className="text-[#E5E5E5]">300억 (16.3%)</span></li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* PF Loan Structure */}
            <h2 className="text-[20px] font-bold text-white mb-[20px]">Project Financing Structure (Bridge)</h2>
            <div className="grid grid-cols-2 gap-[24px] mb-[40px]">
                {/* Iota 1 (YD427PFV) */}
                <div className="bg-[#1A1A1A] border border-[#333] rounded-[24px] p-[32px]">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-[18px] font-bold text-white mb-1">Iota 1 (YD427PFV)</h3>
                            <p className="text-[13px] text-[#86868B]">총 PF 한도: 1조 7,200억원 (LTV 71.7%)</p>
                        </div>
                        <div className="text-right">
                            <span className="text-[13px] text-[#666] block mb-1">PFV Equity</span>
                            <span className="text-[16px] font-bold text-[#E5E5E5]">800억원</span>
                        </div>
                    </div>
                    
                    {/* Tranche Breakdown */}
                    <div className="flex flex-col gap-3">
                        <div className="bg-[#222] p-3 rounded-[12px] flex items-center justify-between border-l-4 border-[#e11d48]">
                            <div className="flex flex-col">
                                <span className="text-[14px] font-bold text-white">Tranche A (선순위)</span>
                                <span className="text-[12px] text-[#86868B]">국민은행 외 108개 기관</span>
                            </div>
                            <div className="text-right flex flex-col">
                                <span className="text-[15px] font-bold text-[#e11d48]">8,400억</span>
                                <span className="text-[12px] text-[#A1A1AA]">6.25% (All-in 6.38%)</span>
                            </div>
                        </div>
                        <div className="bg-[#222] p-3 rounded-[12px] flex items-center justify-between border-l-4 border-[#d97706]">
                            <div className="flex flex-col">
                                <span className="text-[14px] font-bold text-white">Tranche B (중순위)</span>
                                <span className="text-[12px] text-[#86868B]">새마을금고 외 37개 기관</span>
                            </div>
                            <div className="text-right flex flex-col">
                                <span className="text-[15px] font-bold text-[#d97706]">2,500억</span>
                                <span className="text-[12px] text-[#A1A1AA]">7.95% (All-in 8.17%)</span>
                            </div>
                        </div>
                        <div className="bg-[#222] p-3 rounded-[12px] flex items-center justify-between border-l-4 border-[#fbf167]">
                            <div className="flex flex-col">
                                <span className="text-[14px] font-bold text-white">Tranche C (후순위)</span>
                                <span className="text-[12px] text-[#86868B]">BNK캐피탈 외 9개 기관</span>
                            </div>
                            <div className="text-right flex flex-col">
                                <span className="text-[15px] font-bold text-[#fbf167]">1,500억</span>
                                <span className="text-[12px] text-[#A1A1AA]">9.95% (All-in 10.26%)</span>
                            </div>
                        </div>
                        <div className="bg-[#222] p-3 rounded-[12px] flex items-center justify-between border-l-4 border-[#34d399]">
                            <div className="flex flex-col">
                                <span className="text-[14px] font-bold text-white">Tranche D (유동화)</span>
                                <span className="text-[12px] text-[#86868B]">유동화 SPC (증권사)</span>
                            </div>
                            <div className="text-right flex flex-col">
                                <span className="text-[15px] font-bold text-[#34d399]">2,000억</span>
                                <span className="text-[12px] text-[#A1A1AA]">4.45% (All-in 4.34%)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Iota 2 (YD816PFV) */}
                <div className="bg-[#1A1A1A] border border-[#333] rounded-[24px] p-[32px]">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-[18px] font-bold text-white mb-1">Iota 2 (YD816PFV)</h3>
                            <p className="text-[13px] text-[#86868B]">총 PF 한도: 9,570억원 (LTV 89.2%)</p>
                        </div>
                        <div className="text-right">
                            <span className="text-[13px] text-[#666] block mb-1">PFV Equity</span>
                            <span className="text-[16px] font-bold text-[#E5E5E5]">63.95억원</span>
                        </div>
                    </div>
                    
                    {/* Tranche Breakdown */}
                    <div className="flex flex-col gap-3">
                        <div className="bg-[#222] p-3 rounded-[12px] flex items-center justify-between border-l-4 border-[#e11d48]">
                            <div className="flex flex-col">
                                <span className="text-[14px] font-bold text-white">Tranche A (선순위)</span>
                                <span className="text-[12px] text-[#86868B]">국민은행 외 29개 기관</span>
                            </div>
                            <div className="text-right flex flex-col">
                                <span className="text-[15px] font-bold text-[#e11d48]">4,800억</span>
                                <span className="text-[12px] text-[#A1A1AA]">6.50% (All-in 7.70%)</span>
                            </div>
                        </div>
                        <div className="bg-[#222] p-3 rounded-[12px] flex items-center justify-between border-l-4 border-[#d97706]">
                            <div className="flex flex-col">
                                <span className="text-[14px] font-bold text-white">Tranche B (중순위)</span>
                                <span className="text-[12px] text-[#86868B]">한국투자 외 8개 기관</span>
                            </div>
                            <div className="text-right flex flex-col">
                                <span className="text-[15px] font-bold text-[#d97706]">1,400억</span>
                                <span className="text-[12px] text-[#A1A1AA]">8.50% (All-in 11.30%)</span>
                            </div>
                        </div>
                        <div className="bg-[#222] p-3 rounded-[12px] flex items-center justify-between border-l-4 border-[#fbf167]">
                            <div className="flex flex-col">
                                <span className="text-[14px] font-bold text-white">Tranche C (후순위)</span>
                                <span className="text-[12px] text-[#86868B]">신한증권 외 3개 기관</span>
                            </div>
                            <div className="text-right flex flex-col">
                                <span className="text-[15px] font-bold text-[#fbf167]">970억</span>
                                <span className="text-[12px] text-[#A1A1AA]">9.50% (All-in 15.60%)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <p className="text-[12px] text-[#666] text-right">Data Reference: IOTA Seoul 파이낸싱 구조_브릿지단계_241008.pdf</p>
        </div>
    );
}
