import React, { useState } from 'react';
import { mockAssets } from '../../data/mockAssetDB';

export default function SystemCenter() {
    const asset = mockAssets[0];
    const [activeTab, setActiveTab] = useState('overview');

    return (
        <div className="flex-1 h-full bg-transparent flex flex-col relative font-sans text-[#E5E5E5] px-6 overflow-y-auto hide-scrollbar">
            
            {/* Top Header (Original preserved) */}
            <div className="w-full flex justify-between items-start pt-[20px] shrink-0">
                <div className="flex flex-col">
                    <span className="text-[18px] text-[#A1A1AA] font-normal tracking-tight">
                        프로젝트 상세 / 더케이트윈타워
                    </span>
                </div>
                {/* Changed ... to ··· (middle dots) */}
                <div className="text-[#A1A1AA] hover:text-[#E5E5E5] cursor-pointer pt-0 tracking-[3px] font-black text-[16px]">
                    ···
                </div>
            </div>

            {/* 컨텐츠 영역 (반응형 무시, 1000px 고정 폭 적용) */}
            <div className="w-[1000px] mx-auto shrink-0 flex flex-col mt-10 pb-20">
                
                {/* Header Profile for the Content Area */}
                <div className="w-full flex justify-between items-end mb-8 shrink-0">
                    <div className="flex flex-col gap-1">
                        <span className="text-[13px] text-[#A1A1AA] font-bold tracking-widest uppercase">
                            {asset.staticProfile.missionId}
                        </span>
                        <h1 className="text-[36px] text-white font-bold tracking-tight">
                            {asset.staticProfile.assetName}
                        </h1>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="px-4 py-1.5 bg-[#2C2C2A] rounded-full text-[#E5E5E5] text-[13px] font-bold tracking-wide border border-[#3A3A3A]">
                            {asset.contextualData.statusIndicators.valueChainStep}
                        </div>
                    </div>
                </div>

                {/* In-page Navigation Tabs */}
                <div className="w-full flex gap-8 border-b border-[#2C2C2E] mb-8 shrink-0">
                    <button 
                        onClick={() => setActiveTab('overview')}
                        className={`pb-3 text-[15px] font-medium transition-all ${activeTab === 'overview' ? 'text-white border-b-2 border-white' : 'text-[#888] hover:text-[#bbb]'}`}
                    >
                        Asset Overview (General)
                    </button>
                    <button 
                        onClick={() => setActiveTab('execution')}
                        className={`pb-3 text-[15px] font-medium transition-all flex items-center gap-2 ${activeTab === 'execution' ? 'text-[#4ADE80] border-b-2 border-[#4ADE80]' : 'text-[#888] hover:text-[#bbb]'}`}
                    >
                        Execution vs Plan 
                        <span className="px-2 py-0.5 bg-[#4ADE80]/10 text-[#4ADE80] text-[10px] rounded-lg tracking-wider font-bold">C-LEVEL</span>
                    </button>
                </div>

                {/* TAB CONTENT: ASSET OVERVIEW */}
                {activeTab === 'overview' && (
                    <div className="w-full flex flex-col gap-6">
                        
                        {/* Key Metrics Row */}
                        <div className="grid grid-cols-3 gap-6">
                            <div className="bg-[#1C1C1B] rounded-[24px] p-6 border border-[#2E2E2D] flex flex-col gap-2">
                                <span className="text-[13px] text-[#A1A1AA]">총 연면적</span>
                                <span className="text-[28px] font-bold text-white">{asset.staticProfile.grossArea}</span>
                            </div>
                            <div className="bg-[#1C1C1B] rounded-[24px] p-6 border border-[#2E2E2D] flex flex-col gap-2">
                                <span className="text-[13px] text-[#A1A1AA]">비히클 (Vehicle)</span>
                                <span className="text-[18px] font-bold text-white break-keep">{asset.staticProfile.vehicleInfo.name}</span>
                            </div>
                            <div className="bg-[#1C1C1B] rounded-[24px] p-6 border border-[#2E2E2D] flex flex-col gap-2">
                                <span className="text-[13px] text-[#A1A1AA]">Current 매입/매각 추정치</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-[28px] font-bold text-white">{(asset.dynamicData.financials.aum.actual_Current / 100000000).toLocaleString()}</span>
                                    <span className="text-[14px] text-[#A1A1AA]">억원</span>
                                </div>
                            </div>
                        </div>

                        {/* Operational Dynamics */}
                        <div className="w-full grid grid-cols-2 gap-6">
                            <div className="bg-[#1C1C1B] rounded-[24px] p-8 border border-[#2E2E2D] flex flex-col gap-5">
                                <h3 className="text-[16px] font-bold tracking-tight text-white">스태킹 플랜 및 가치설계</h3>
                                <p className="text-[14px] text-[#A1A1AA] leading-relaxed break-keep">
                                    {asset.contextualData.strategy.productStrategy}
                                </p>
                                <div className="px-4 py-3 bg-[#262626] rounded-xl text-[14px] font-medium text-[#E5E5E5]">
                                    {asset.contextualData.strategy.stackingPlan}
                                </div>
                                <div className="flex flex-col gap-2 mt-2">
                                    <span className="text-[12px] text-[#888]">핵심 유치 테넌트 (Anchors)</span>
                                    <div className="flex gap-2">
                                        {asset.contextualData.anchorTenants.map((tag, i) => (
                                            <span key={i} className="px-3 py-1 bg-[#333] rounded text-[13px] text-white">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-[#1C1C1B] rounded-[24px] p-8 border border-[#2E2E2D] flex flex-col gap-5">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-[16px] font-bold tracking-tight text-white">현장 리스크 및 자원 통제</h3>
                                    <div className={`px-3 py-1 rounded-md text-[12px] font-bold uppercase ${asset.contextualData.redFlags.status === 'Green' ? 'bg-[#4ADE80]/20 text-[#4ADE80]' : 'bg-[#FDE047]/20 text-[#FDE047]'}`}>
                                        {asset.contextualData.redFlags.status} FLAG
                                    </div>
                                </div>
                                <p className="text-[14px] text-[#E5E5E5] bg-[#222] p-4 rounded-xl border border-[#333] break-keep">
                                    "{asset.contextualData.redFlags.issue}"
                                </p>
                                <div className="pt-4 border-t border-[#333] flex items-center justify-between">
                                    <span className="text-[13px] text-[#888]">PM (실무 총괄)</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[15px] text-white font-medium">{asset.staticProfile.hrAllocation.pm}</span>
                                        <span className="px-2 py-1 bg-[#2C2C2A] rounded text-[12px] text-[#4ADE80] font-bold">
                                            FTE {asset.dynamicData.manpowerStatus.totalFTE.actual_Current}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB CONTENT: EXECUTION VS PLAN (The CEO View) */}
                {activeTab === 'execution' && (
                    <div className="w-full flex flex-col gap-8">
                        
                        {/* The Executive Variance Table */}
                        <div className="w-full bg-[#1C1C1B] rounded-[24px] border border-[#2E2E2D] overflow-hidden">
                            <div className="w-full px-6 py-4 bg-[#232322] border-b border-[#2E2E2D] flex items-center justify-between">
                                <h3 className="text-[16px] font-bold text-white flex items-center gap-2">
                                    <svg className="w-5 h-5 text-[#4ADE80]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                                    런칭 및 매각 실적 갭(Gap) 분석
                                </h3>
                                <div className="flex items-center gap-4 text-[12px] font-medium">
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#3A3A3A] rounded"></div>UW (초기 계획)</div>
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#4ADE80] rounded"></div>Actual (진행/실적)</div>
                                </div>
                            </div>
                            
                            <div className="flex flex-col">
                                {/* Row: AUM */}
                                <div className="flex border-b border-[#2E2E2D]/50 hover:bg-[#222] transition-colors">
                                    <div className="w-[140px] py-4 px-6 text-[13px] font-medium text-[#888] flex items-center">AUM 규모</div>
                                    <div className="flex-1 py-4 px-6 text-[15px] text-[#A1A1AA] border-r border-[#2E2E2D]/50 bg-[#222]">
                                        {(asset.dynamicData.financials.aum.target_UW / 100000000).toLocaleString()} 억원
                                    </div>
                                    <div className="flex-1 py-4 px-6 text-[16px] font-bold text-white relative bg-[#1A1A1A]">
                                        {(asset.dynamicData.financials.aum.actual_Current / 100000000).toLocaleString()} 억원
                                    </div>
                                </div>
                                
                                {/* Row: Rent */}
                                <div className="flex border-b border-[#2E2E2D]/50 hover:bg-[#222] transition-colors">
                                    <div className="w-[140px] py-4 px-6 text-[13px] font-medium text-[#888] flex items-center">평당 임대료</div>
                                    <div className="flex-1 py-4 px-6 text-[15px] text-[#A1A1AA] border-r border-[#2E2E2D]/50 bg-[#222]">
                                        {asset.dynamicData.financials.rentRate.target_UW / 10000} 만원
                                    </div>
                                    <div className="flex-1 py-4 px-6 text-[16px] font-bold text-[#4ADE80] relative bg-[#1A1A1A]">
                                        {asset.dynamicData.financials.rentRate.actual_Current / 10000} 만원 이상
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] px-2 py-0.5 bg-[#4ADE80]/20 rounded text-[#4ADE80]">UP</span>
                                    </div>
                                </div>

                                {/* Row: Stabilized */}
                                <div className="flex border-b border-[#2E2E2D]/50 hover:bg-[#222] transition-colors">
                                    <div className="w-[140px] py-4 px-6 text-[13px] font-medium text-[#888] flex flex-col justify-center gap-1">안정화 임대율<br/>및 달성 시점</div>
                                    <div className="flex-1 py-4 px-6 text-[15px] text-[#A1A1AA] border-r border-[#2E2E2D]/50 bg-[#222] flex flex-col gap-1">
                                        <span className="font-bold">{asset.dynamicData.operations.occupancyRate.target_UW}% 달성</span>
                                        <span className="text-[13px] leading-relaxed">{asset.dynamicData.operations.stabilizationPeriod.target_UW}</span>
                                    </div>
                                    <div className="flex-1 py-4 px-6 text-[16px] text-white bg-[#1A1A1A] flex flex-col gap-1 relative">
                                        <span className="font-bold text-[#4ADE80]">{asset.dynamicData.operations.occupancyRate.actual_Current}% 이상</span>
                                        <span className="text-[14px] text-white leading-relaxed break-keep">{asset.dynamicData.operations.stabilizationPeriod.actual_Current}</span>
                                        <span className="text-[12px] text-[#888]">관여: {asset.contextualData.strategy.tenantTargeting}</span>
                                        <span className="absolute right-4 top-4 text-[11px] px-2 py-0.5 bg-[#4ADE80]/20 rounded text-[#4ADE80]">FAST</span>
                                    </div>
                                </div>
                                
                                {/* Row: Exit & Yield */}
                                <div className="flex hover:bg-[#222] transition-colors">
                                    <div className="w-[140px] py-4 px-6 text-[13px] font-medium text-[#888] flex flex-col justify-center gap-1">매각 스펙<br/>(Exit & Yield)</div>
                                    <div className="flex-1 py-4 px-6 text-[15px] text-[#A1A1AA] border-r border-[#2E2E2D]/50 bg-[#222] flex flex-col justify-center gap-1">
                                        <span>{asset.dynamicData.operations.exitTiming?.target_UW || "3년 운영 후 매각"}</span>
                                        <span>매각가: {(asset.dynamicData.financials.exitPrice?.target_UW || 576800000000) / 100000000}억</span>
                                        <span>IRR: {asset.dynamicData.financials.irr.target_UW}%</span>
                                    </div>
                                    <div className="flex-1 py-4 px-6 text-[16px] text-white bg-[#1A1A1A] flex flex-col justify-center gap-1 relative">
                                        <span className="font-bold">{asset.dynamicData.operations.exitTiming?.actual_Current || "6개월 운영 후 조기 매각"}</span>
                                        <span className="font-bold text-[#4ADE80]">매각가: {(asset.dynamicData.financials.exitPrice?.actual_Current || 845000000000) / 100000000}억</span>
                                        <span className="font-bold text-[#4ADE80]">IRR: {asset.dynamicData.financials.irr.actual_Current}% (초과달성)</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Timeline Tracker Graphic */}
                        <div className="w-full bg-[#1C1C1B] rounded-[24px] border border-[#2E2E2D] p-8 flex flex-col gap-6">
                            <h3 className="text-[15px] font-bold text-white">매각 일정 타임라인 트래킹</h3>
                            
                            <div className="relative w-full h-[140px] mt-4 flex flex-col justify-between">
                                
                                {/* UW Track (Gray Line) */}
                                <div className="absolute top-[30px] left-[5%] right-[5%] h-0.5 bg-[#333] border-t border-dashed border-[#555]"></div>
                                
                                {/* Actual Track (Green Line) */}
                                <div className="absolute top-[100px] left-[5%] right-[5%] h-0.5 bg-[#4ADE80]/30 shadow-[0_0_10px_rgba(74,222,128,0.3)]"></div>

                                {/* Node 1: 착공 */}
                                <div className="absolute left-[5%] -translate-x-1/2 flex flex-col items-center top-[15px]">
                                    <span className="text-[11px] text-[#A1A1AA] mb-2 px-2 py-0.5 bg-[#333] rounded">UW</span>
                                    <div className="w-3 h-3 bg-[#555] rounded-full z-10 outline outline-4 outline-[#1C1C1B]"></div>
                                    <span className="text-[12px] font-bold text-[#888] mt-2">`21.09</span>
                                    <span className="text-[13px] text-white mt-8 whitespace-nowrap font-bold">착공</span>
                                    <span className="text-[12px] font-bold text-[#4ADE80] mt-1">`21.09</span>
                                    <div className="w-4 h-4 bg-[#4ADE80] border-[4px] border-[#1C1C1B] rounded-full z-10 absolute bottom-[23px] shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                                </div>

                                {/* Node 2: 사전임대/Pre-marketing (Actual Only) */}
                                <div className="absolute left-[35%] -translate-x-1/2 flex flex-col items-center bottom-[8px]">
                                    <span className="text-[13px] text-[#4ADE80] mb-1 font-bold whitespace-nowrap">사전임대/마케팅</span>
                                    <span className="text-[12px] font-bold text-[#4ADE80]">`23.03 ~ `23.09</span>
                                    <div className="w-4 h-4 bg-[#4ADE80] border-[4px] border-[#1C1C1B] rounded-full z-10 relative mt-2 shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                                </div>

                                {/* Node 3: 준공 */}
                                <div className="absolute left-[60%] -translate-x-1/2 flex flex-col items-center top-[15px]">
                                    <span className="text-[11px] text-[#A1A1AA] mb-2 px-2 py-0.5 bg-[#333] rounded">UW</span>
                                    <div className="w-3 h-3 bg-[#555] rounded-full z-10 outline outline-4 outline-[#1C1C1B]"></div>
                                    <span className="text-[12px] font-bold text-[#888] mt-2">`23.11</span>
                                    <span className="text-[13px] text-white mt-8 whitespace-nowrap font-bold">준공</span>
                                    <span className="text-[12px] font-bold text-[#4ADE80] mt-1">`23.11</span>
                                    <div className="w-4 h-4 bg-[#4ADE80] border-[4px] border-[#1C1C1B] rounded-full z-10 absolute bottom-[23px] shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                                </div>

                                {/* Node 4: 매각 */}
                                <div className="absolute right-[5%] translate-x-1/2 flex flex-col items-center top-[15px]">
                                    <span className="text-[11px] text-[#A1A1AA] mb-2 px-2 py-0.5 bg-[#333] rounded">UW 안정화 2년 후</span>
                                    <div className="w-3 h-3 bg-[#555] rounded-full z-10 outline outline-4 outline-[#1C1C1B]"></div>
                                    <span className="text-[12px] font-bold text-[#888] mt-2">`27.02</span>
                                </div>

                                {/* Node 4-Actual: 조기매각 */}
                                <div className="absolute left-[85%] -translate-x-1/2 flex flex-col items-center bottom-[8px]">
                                    <span className="text-[13px] text-white mb-1 font-bold whitespace-nowrap shadow-lg">매각 (Exit)</span>
                                    <span className="text-[12px] font-bold text-[#4ADE80]">`24.08</span>
                                    <div className="w-4 h-4 bg-[#4ADE80] border-[4px] border-[#1C1C1B] rounded-full z-10 relative mt-2 shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                                    {/* Dotted connection marking early exit */}
                                    <svg className="absolute w-[180px] h-[60px] pointer-events-none -top-[50px] left-[5px]" style={{strokeDasharray:"4 4"}}>
                                        <path d="M 0 60 Q 90 30 180 0" fill="transparent" stroke="#4ADE80" strokeWidth="1.5" />
                                    </svg>
                                    <span className="absolute -top-[65px] left-8 text-[12px] font-bold text-[#4ADE80] rotate-[-12deg] whitespace-nowrap">약 3년 조기매각 달성</span>
                                </div>

                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
