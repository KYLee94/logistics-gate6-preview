import React from 'react';
import WorkspaceActivityLog from './WorkspaceActivityLog';

export default function WorkspaceFund() {
    return (
                <div className="w-full flex-1 flex flex-col pt-[50px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header & Team Structure */}
            <div className="w-full flex justify-between items-center mb-[40px] gap-[40px]">
                {/* Header Metadata */}
                <div className="shrink-0 max-w-[300px]">
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">펀드운용</h1>
                    <p className="text-[15px] text-[#86868B] leading-[24px]">펀드(421) 운용 및 투자자 소통채널</p>
                </div>
                
                {/* Team Structure */}
                <div className="border border-[#333] rounded-[24px] flex flex-col bg-transparent shrink-0">

                    
                    <div className="flex items-center pl-[20px] pr-[16px] py-[10px]">
                        <div className="w-[54px] shrink-0">
                            <span className="text-[13px] font-bold text-[#86868B]">KAM</span>
                        </div>
                        <div className="flex items-center gap-[12px] w-[106px] shrink-0">
                            <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                                <img src={`${import.meta.env.BASE_URL}김행단.webp`} alt="김행단" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-white font-bold text-[13px] leading-tight">김행단</span>
                                <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">그룹장</span>
                            </div>
                        </div>
                        <div className="flex items-center ml-2">
                            <span className="text-[13px] font-medium text-[#86868B]">KAM 1파트 실무진</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <WorkspaceActivityLog workspaceCode="WS_KAM" workspaceLabel="펀드운용-KAM" />

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

            {/* Top 3 KPI Cards */}
            <div className="flex w-full gap-[24px] mb-[40px]">
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#fbf167]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">자본콜 누적 집행률</h3>
                    <div className="text-[42px] font-black text-white">85<span className="text-[20px] text-[#A1A1AA]">%</span></div>
                    <div className="w-full bg-[#1A1A1A] h-2 rounded-full mt-4"><div className="h-full bg-[#fbf167] rounded-full w-[85%]"></div></div>
                </div>
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#34d399]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">LP 만족도 (NPS)</h3>
                    <div className="text-[42px] font-black text-white">72<span className="text-[20px] text-[#A1A1AA]">점</span></div>
                    <p className="text-[13px] text-[#A1A1AA] mt-2">단일 채널 보고 체계 정착</p>
                </div>
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#e11d48]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">Pending Q&A</h3>
                    <div className="text-[42px] font-black text-white">0<span className="text-[16px] font-normal text-[#A1A1AA] ml-2">건</span></div>
                    <p className="text-[13px] text-[#34d399] mt-2">모든 LP 질의 종결</p>
                </div>
            </div>

            {/* Action Log */}
            <h2 className="text-[18px] font-bold text-white mb-[16px]">LP 보고 및 결재 로그</h2>
            <div className="flex flex-col gap-3">
                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[20px] flex items-center hover:border-[#555] transition-colors">
                    <div className="w-[120px]"><span className="text-[13px] text-[#86868B] font-medium">2026-04-04</span></div>
                    <div className="w-[100px]"><span className="text-[12px] px-2 py-0.5 bg-[#222] border border-[#333] text-[#A1A1AA] rounded">421호</span></div>
                    <div className="flex-1 px-4 border-l border-[#333]">
                        <span className="text-[15px] font-bold text-white">Q1 LP 분기보고 발송 + Q&A 5건 종결</span>
                    </div>
                    <div className="w-[100px] text-right">
                        <span className="text-[13px] text-[#666] font-bold">Closed</span>
                    </div>
                </div>
            </div>
            
            <p className="text-[12px] text-[#666] text-right mt-[40px]">Data Reference: IOTA Seoul 파이낸싱 구조_브릿지단계_241008.pdf</p>
        </div>
    );
}
