import React, { useState } from 'react';

export default function CenterBoard({ mockData }) {
    const [activeTab, setActiveTab] = useState('ops'); // 'fin', 'ops', 'org', 'time'
    const data = mockData;

    // Helper formatter
    const formatBillion = (num) => `${(num / 100000000).toLocaleString()}억`;

    return (
        <div className="flex-1 h-full bg-white overflow-y-auto px-6 md:px-12 py-10 pb-24">
            <div className="max-w-[1000px] mx-auto w-full flex flex-col gap-10">
                
                {/* --------------------------------------------------------
                    SECTION 1: HERO (Static Profile Core)
                    -------------------------------------------------------- */}
                <section className="flex flex-col gap-6">
                    {/* Badge & Red Flag */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-black text-white text-[12px] font-medium tracking-tight rounded-full">
                                {data.staticProfile.assetClass}
                            </span>
                            <span className="px-3 py-1 bg-gray-100 text-gray-600 border border-gray-200 text-[12px] font-medium tracking-tight rounded-full">
                                {data.staticProfile.vehicleInfo.type}
                            </span>
                        </div>
                        {data.contextualData.redFlags.status === 'Yellow' && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg group relative cursor-pointer">
                                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                                <span className="text-[12px] font-bold tracking-tight">Risk Alert</span>
                                {/* Hover Tooltip */}
                                <div className="absolute hidden group-hover:block top-full mt-2 right-0 w-[250px] p-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-[11px] leading-[1.5] shadow-xl z-50">
                                    {data.contextualData.redFlags.issue}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Titles */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="flex flex-col gap-2">
                            <span className="text-[13px] text-gray-500 font-medium tracking-wide uppercase">
                                {data.staticProfile.missionId}
                            </span>
                            <h1 className="text-[40px] md:text-[56px] font-bold text-black tracking-tighter leading-none">
                                {data.staticProfile.assetName}
                            </h1>
                            <span className="text-[14px] text-gray-500 tracking-tight mt-1 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                {data.staticProfile.address} (연면적 {data.staticProfile.grossArea})
                            </span>
                        </div>
                        
                        {/* Core KPI (AUM) */}
                        <div className="flex flex-col items-start md:items-end p-5 bg-gray-50 rounded-2xl border border-gray-100 min-w-[200px]">
                            <span className="text-[12px] text-gray-500 font-semibold tracking-wide uppercase mb-1">Target AUM</span>
                            <div className="text-[32px] font-bold text-black tracking-tighter leading-none">
                                {formatBillion(data.dynamicData.financials.aum.target_UW)}
                            </div>
                        </div>
                    </div>
                </section>

                <hr className="border-gray-200" />

                {/* --------------------------------------------------------
                    SECTION 2: DASHBOARD (Target vs Actual)
                    -------------------------------------------------------- */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Progress Card */}
                    <div className="p-5 border border-gray-200 rounded-2xl flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[14px] font-semibold text-gray-800 tracking-tight">가치사슬 진행도</span>
                            <span className="text-[12px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                {data.contextualData.statusIndicators.valueChainStep}
                            </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-black rounded-full transition-all duration-1000"
                                style={{ width: `${data.dynamicData.timeSeries?.completionDate?.actual_Current ? data.contextualData.statusIndicators.progressRate || 65 : 100}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between items-center text-[11px] font-medium">
                            <span className="text-gray-400">Target: 70%</span>
                            <span className="text-black">Actual: 65%</span>
                        </div>
                    </div>

                    {/* IRR Comparison Card */}
                    <div className="p-5 border border-gray-200 rounded-2xl flex flex-col justify-between">
                        <span className="text-[14px] font-semibold text-gray-800 tracking-tight">수익률 (IRR)</span>
                        <div className="flex items-end gap-3 mt-4">
                            <span className="text-[32px] font-bold text-black tracking-tighter leading-none">
                                {data.dynamicData.financials.irr.actual_Current}%
                            </span>
                            <span className="flex items-center text-[12px] font-semibold text-red-500 pb-1">
                                <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                1.3%p
                            </span>
                        </div>
                        <span className="text-[11px] text-gray-400 font-medium tracking-tight mt-2">
                            언더라이팅 목표: {data.dynamicData.financials.irr.target_UW}%
                        </span>
                    </div>

                    {/* Handover & Director */}
                    <div className="p-5 border border-gray-200 rounded-2xl flex flex-col justify-between bg-gray-50">
                        <div className="flex justify-between items-center">
                            <span className="text-[14px] font-semibold text-gray-800 tracking-tight">총괄/PM</span>
                            <div className="flex -space-x-2">
                                <div className="w-7 h-7 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-600">{data.staticProfile.hrAllocation.director[0]}</div>
                                <div className="w-7 h-7 rounded-full bg-gray-400 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">{data.staticProfile.hrAllocation.pm[0]}</div>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <span className="text-[11px] text-gray-500 font-medium tracking-tight block mb-1">프론트옵스 이관 현황</span>
                            <span className="text-[13px] font-bold text-black tracking-tight">{data.contextualData.statusIndicators.handoverStatus}</span>
                        </div>
                    </div>
                </section>

                {/* --------------------------------------------------------
                    SECTION 3 & 4: ADVANCED TABS
                    -------------------------------------------------------- */}
                <section className="flex flex-col mt-4">
                    {/* Tabs */}
                    <div className="flex gap-6 border-b border-gray-200 px-2 overflow-x-auto">
                        {[
                            { id: 'ops', label: '운영/부동산 스펙' },
                            { id: 'fin', label: '자본 스택' },
                            { id: 'org', label: '조직/네트워크' },
                            { id: 'time', label: '시계열 지표' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-3 text-[14px] font-semibold tracking-tight transition-colors whitespace-nowrap ${activeTab === tab.id ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content Container */}
                    <div className="py-8 min-h-[300px]">
                        
                        {/* OPS TAB */}
                        {activeTab === 'ops' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 bg-gray-50 rounded-2xl flex flex-col gap-5">
                                    <h4 className="text-[14px] font-bold text-gray-800 tracking-tight border-b border-gray-200 pb-2">스태킹 플랜 & 공간 기획</h4>
                                    <p className="text-[13px] text-gray-700 leading-relaxed font-medium tracking-tight">
                                        {data.contextualData.strategy.stackingPlan}
                                    </p>
                                    <div className="bg-white p-4 rounded-xl border border-gray-200">
                                        <span className="block text-[11px] text-gray-400 font-semibold mb-1">리테일 MD 비중</span>
                                        <span className="text-[13px] text-black font-semibold">{data.contextualData.strategy.retailMdPlan}</span>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                                       <span className="block text-[12px] text-gray-500 font-semibold">NOC 타겟 단가</span>
                                       <div className="text-right">
                                           <span className="text-[12px] text-gray-400 line-through mr-2">{data.dynamicData.operations.nocMetrics.target_UW.toLocaleString()}원</span>
                                           <span className="text-[14px] text-black font-bold">{data.dynamicData.operations.nocMetrics.actual_Current.toLocaleString()}원</span>
                                       </div>
                                    </div>
                                </div>
                                <div className="p-6 border border-gray-200 rounded-2xl flex flex-col gap-6">
                                    <h4 className="text-[14px] font-bold text-gray-800 tracking-tight border-b border-gray-200 pb-2">운영 효율 (Occupancy & ESG)</h4>
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <span className="block text-[12px] text-gray-500 font-semibold mb-1">현재 임대율 (Occupancy)</span>
                                            <span className="text-[28px] font-bold text-black tracking-tighter">{data.dynamicData.operations.occupancyRate.actual_Current}%</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-[12px] text-gray-500 font-semibold mb-1">잔여 임대(WALT)</span>
                                            <span className="text-[20px] font-bold text-black tracking-tighter">{data.dynamicData.operations.walt.actual_Current}년</span>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-[12px] font-medium text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <span className="block text-gray-400 mb-1">ESG 스펙</span>
                                        {data.contextualData.esgAndSpecs.esgCertification} · {data.contextualData.esgAndSpecs.carbonReduction}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* FIN TAB */}
                        {activeTab === 'fin' && (
                            <div className="flex flex-col gap-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-5 border border-gray-200 rounded-xl bg-gray-50">
                                        <span className="text-[11px] font-semibold text-gray-400 block mb-2">Equity (에쿼티)</span>
                                        <span className="text-[18px] font-bold text-black tracking-tight">{formatBillion(data.dynamicData.financials.equity.actual_Current)}</span>
                                    </div>
                                    <div className="p-5 border border-gray-200 rounded-xl bg-gray-50">
                                        <span className="text-[11px] font-semibold text-gray-400 block mb-2">Loan (대출)</span>
                                        <span className="text-[18px] font-bold text-black tracking-tight">{formatBillion(data.dynamicData.financials.loan.actual_Current)}</span>
                                    </div>
                                    <div className="p-5 border border-gray-200 rounded-xl bg-black text-white">
                                        <span className="text-[11px] font-semibold text-gray-400 block mb-2">LTV (담보비율)</span>
                                        <span className="text-[18px] font-bold tracking-tight">{data.dynamicData.financials.ltv.actual_Current}%</span>
                                    </div>
                                    <div className="p-5 border border-blue-100 rounded-xl bg-blue-50">
                                        <span className="text-[11px] font-semibold text-blue-400 block mb-2">Igis Revenue (당해 매출)</span>
                                        <span className="text-[18px] font-bold text-blue-700 tracking-tight">{formatBillion(data.dynamicData.financials.igisRevenue.actual_Current)}</span>
                                    </div>
                                </div>
                                <div className="p-6 border border-gray-200 rounded-2xl">
                                    <h4 className="text-[14px] font-bold text-gray-800 tracking-tight mb-4">투자자명부 (LP & Lenders)</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {data.contextualData.investorNetwork.lpList.map((lp, i) => (
                                            <span key={i} className="px-3 py-1.5 bg-gray-100 text-[12px] font-semibold text-gray-600 rounded-lg">{lp}</span>
                                        ))}
                                        {data.contextualData.investorNetwork.lenderList.map((lender, i) => (
                                            <span key={i} className="px-3 py-1.5 bg-gray-800 text-[12px] font-semibold text-white rounded-lg">{lender}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ORG TAB */}
                        {activeTab === 'org' && (
                            <div className="flex flex-col gap-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 border border-gray-200 rounded-2xl bg-gray-50 flex flex-col gap-4">
                                        <h4 className="text-[14px] font-bold text-gray-800 tracking-tight">투입 하부조직 (Involved Squads)</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {data.staticProfile.hrAllocation.involvedTeams.map((team, i) => (
                                                <span key={i} className="px-3 py-1 bg-white border border-gray-200 text-[12px] font-semibold text-gray-700 rounded-lg shadow-sm">{team}</span>
                                            ))}
                                        </div>
                                        <div className="mt-2 text-[12px] font-semibold text-gray-500">
                                            통합 투입 인력: <span className="text-black font-bold">{data.dynamicData.manpowerStatus.totalFTE.actual_Current} FTE</span> (Target: {data.dynamicData.manpowerStatus.totalFTE.target_UW})
                                        </div>
                                    </div>
                                    
                                    <div className="p-6 border border-gray-200 rounded-2xl flex flex-col gap-4">
                                        <h4 className="text-[14px] font-bold text-gray-800 tracking-tight">운영사(OpCo) 및 파트너 특성</h4>
                                        <div className="flex flex-col gap-3">
                                            <div className="text-[12px] font-medium text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                <span className="block text-gray-400 font-bold mb-1">OpCo 현황</span>
                                                {data.contextualData.partnerships.operatorInfo.operatorName}
                                            </div>
                                            {data.contextualData.partnerships.partnerContacts.map((p, i) => (
                                                <div key={i} className="text-[12px] font-medium text-gray-600 bg-white p-3 rounded-lg border border-gray-200">
                                                    <span className="block text-black font-bold mb-1">{p.company} ({p.role}) - {p.name}</span>
                                                    이슈: {p.issue}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TIME TAB */}
                        {activeTab === 'time' && (
                            <div className="p-6 border border-gray-200 rounded-2xl">
                                <h4 className="text-[14px] font-bold text-gray-800 tracking-tight mb-6">마일스톤 구조 (Target vs Actual)</h4>
                                <div className="flex flex-col gap-4">
                                    {[
                                        { label: '틸 체결 (Closing)', data: data.dynamicData.timeSeries.closingDate },
                                        { label: 'PF 기표 (Drawdown)', data: data.dynamicData.timeSeries.pfDrawdown },
                                        { label: '착공 (Const. Start)', data: data.dynamicData.timeSeries.constructionStart },
                                        { label: '준공 (Completion)', data: data.dynamicData.timeSeries.completionDate }
                                    ].map((ts, i) => {
                                        const isDelayed = ts.data.actual_Current > ts.data.target_UW;
                                        return (
                                            <div key={i} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                                                <span className="text-[13px] font-bold text-gray-800 w-[150px]">{ts.label}</span>
                                                <div className="flex items-center gap-6 text-[12px] font-semibold">
                                                    <span className="text-gray-400 line-through">{ts.data.target_UW}</span>
                                                    <span className={`${isDelayed ? 'text-red-500' : 'text-black'}`}>
                                                        {ts.data.actual_Current} {isDelayed && '(지연)'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    </div>
                </section>
                
            </div>
        </div>
    );
}
