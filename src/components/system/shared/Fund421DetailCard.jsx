import React, { useState } from 'react';

const formatAmount = (rawAmt) => {
    const amt = Math.round(rawAmt);
    const jo = Math.floor(amt / 10000);
    const uk = amt % 10000;
    let formattedUk = uk.toLocaleString('ko-KR');
    if (jo > 0) {
        if (uk === 0) return `${jo}조원`;
        return `${jo}조 ${formattedUk}억원`;
    }
    return `${formattedUk}억원`;
};

const Fund421DetailCard = ({ id, vehicleId, title, totalAmountStr, data, toggleContent, onInstClick }) => {
    const [hoveredBarTranche, setHoveredBarTranche] = useState(null);
    let totalEquity = 0;
    let totalLoan = 0;
    
    Object.values(data).forEach(trancheArray => {
        trancheArray.forEach(item => {
            if (item.isSubHeader) return;
            if (item.type === 'Equity') totalEquity += (item.rawAmount || 0);
            else totalLoan += (item.rawAmount || 0);
        });
    });
    
    const totalSum = totalEquity + totalLoan;
    const tranches = Object.keys(data);
    const sortedTranches = tranches.sort((a, b) => {
        const orderObj = {'A종 수익증권': 1, 'B종 수익증권': 2, 'C종 수익증권': 3, 'C-1종 수익증권': 4};
        if (orderObj[a] && orderObj[b]) return orderObj[a] - orderObj[b];
        
        if (a.includes('Tr.') && b.includes('Tr.')) return a.localeCompare(b);
        if (a.includes('Tr.')) return 1;
        if (b.includes('Tr.')) return -1;
        return a.localeCompare(b);
    });

    const getTrancheColor = (trancheName) => {
        if (trancheName.includes('Equity') || trancheName.includes('보통주') || (trancheName.includes('종류주') && !trancheName.includes('수익증권')) || trancheName.includes('주주대여금')) return 'text-white';
        if (trancheName.includes('Tr.A') || trancheName.includes('Tr. A') || trancheName.includes('A종')) return 'text-[#5da0e7]';
        if (trancheName.includes('Tr.B') || trancheName.includes('Tr. B') || trancheName.includes('B종')) return 'text-[#3aaab3]';
        if (trancheName.includes('Tr.C') || trancheName.includes('Tr. C') || (trancheName.includes('C종') && !trancheName.includes('C-1종'))) return 'text-[#b889d9]';
        if (trancheName.includes('Tr.D') || trancheName.includes('Tr. D') || trancheName.includes('D종') || trancheName.includes('C-1종')) return 'text-[#cd879c]';
        return 'text-white';
    };

    const getTrancheHoverColor = (trancheName) => {
        if (trancheName.includes('Equity') || trancheName.includes('보통주') || (trancheName.includes('종류주') && !trancheName.includes('수익증권')) || trancheName.includes('주주대여금')) return 'group-hover:text-[#eab308]';
        if (trancheName.includes('Tr.A') || trancheName.includes('Tr. A') || trancheName.includes('A종')) return 'group-hover:text-[#5da0e7]';
        if (trancheName.includes('Tr.B') || trancheName.includes('Tr. B') || trancheName.includes('B종')) return 'group-hover:text-[#3aaab3]';
        if (trancheName.includes('Tr.C') || trancheName.includes('Tr. C') || (trancheName.includes('C종') && !trancheName.includes('C-1종'))) return 'group-hover:text-[#b889d9]';
        if (trancheName.includes('Tr.D') || trancheName.includes('Tr. D') || trancheName.includes('D종') || trancheName.includes('C-1종')) return 'group-hover:text-[#cd879c]';
        return 'group-hover:text-white';
    };

    const getTrancheBgColor = (trancheName) => {
        if (trancheName.includes('Equity') || trancheName.includes('보통주') || (trancheName.includes('종류주') && !trancheName.includes('수익증권'))) return 'bg-black';
        if (trancheName.includes('주주대여금') || trancheName.includes('주주대여')) return 'bg-[#254266]';
        if (trancheName.includes('Tr.A-2')) return 'bg-[#315780]';
        if (trancheName.includes('Tr.A') || trancheName.includes('Tr. A') || trancheName.includes('A종')) return 'bg-[#4572a1]';
        if (trancheName.includes('Tr.B') || trancheName.includes('Tr. B') || trancheName.includes('B종')) return 'bg-[#2c777d]';
        if (trancheName.includes('Tr.C') || trancheName.includes('Tr. C') || (trancheName.includes('C종') && !trancheName.includes('C-1종'))) return 'bg-[#85609e]';
        if (trancheName.includes('Tr.D') || trancheName.includes('Tr. D') || trancheName.includes('D종') || trancheName.includes('C-1종')) return 'bg-[#966171]';
        return 'bg-[#444]';
    };

    return (
        <div id={id} className="mb-12">
            <div className="flex justify-between items-end mb-[14px]">
                <div className="flex flex-col gap-[2px]">
                    <h3 className="text-[24px] font-bold text-white tracking-tight leading-none">{title}</h3>
                </div>
                <div className="flex flex-col items-end gap-1">
                    {toggleContent && toggleContent}
                </div>
            </div>

            {/* Visual Tranche Bar */}
            <div className="w-full mb-[16px]">
                {(() => {
                    const allItems = Object.values(data).flat();
                    const barGroups = {};
                    allItems.forEach(item => {
                        if (item.isSubHeader) return;
                        let bT = item.originalTranche || item.type;
                        if (!barGroups[bT]) barGroups[bT] = 0;
                        barGroups[bT] += (item.rawAmount || 0);
                    });
                    
                    const order = {'Equity':1, '주주대여':2, 'Tr.A':3, 'Tr.A-1':3.1, 'Tr.A-2':3.2, 'Tr.B':4, 'Tr.C':5, 'Tr.D':6, 'A종 수익증권':3, 'B종 수익증권':4, 'C종 수익증권':5, 'C-1종 수익증권':5.1};
                    const sortedBarKeys = Object.keys(barGroups).sort((a,b) => (order[a] || 99) - (order[b] || 99));

                    return (
                        <div className="w-full h-[60px] relative rounded-[20px] bg-[#292928] select-none">
                            {/* Colored Bar Layer */}
                            <div className="absolute inset-0 flex w-full h-full rounded-[20px] overflow-hidden">
                                {sortedBarKeys.map(tName => {
                                    const tSum = barGroups[tName];
                                    if (tSum === 0) return null;
                                    const exactPct = totalSum > 0 ? ((tSum / totalSum) * 100).toFixed(6) : 0;
                                    return (
                                        <div 
                                            key={`bg-${tName}`} 
                                            className={`h-full transition-opacity duration-300 ${getTrancheBgColor(tName)} ${hoveredBarTranche && hoveredBarTranche !== tName ? 'opacity-40' : ''}`} 
                                            style={{ width: `${exactPct}%` }}
                                        />
                                    );
                                })}
                            </div>
                            {/* Text Overlay & Interaction Layer */}
                            <div className="absolute inset-0 flex w-full h-full">
                                {sortedBarKeys.map(tName => {
                                    const tSum = barGroups[tName];
                                    if (tSum === 0) return null;
                                    const pct = totalSum > 0 ? ((tSum / totalSum) * 100).toFixed(1) : 0;
                                    const exactPct = totalSum > 0 ? ((tSum / totalSum) * 100).toFixed(6) : 0;
                                    return (
                                        <div 
                                            key={`text-${tName}`} 
                                            className="h-full flex flex-col items-center justify-center relative cursor-pointer" 
                                            style={{ width: `${exactPct}%` }}
                                            onMouseEnter={() => setHoveredBarTranche(tName)}
                                            onMouseLeave={() => setHoveredBarTranche(null)}
                                        >
                                            <span className="text-white font-bold text-[13px] leading-none mb-[4px] whitespace-nowrap z-10 drop-shadow-md">{tName}</span>
                                            <span className="text-white font-bold text-[14px] leading-none whitespace-nowrap z-10 drop-shadow-md">{pct}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Investment Structure Box */}
            <div className="w-full bg-[#292928] border border-[#3c3c3c] rounded-[32px] pt-[20px] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center w-full pb-[16px] border-b border-[#444]/50 pl-[26px] pr-[32px]">
                    <div className="flex items-center gap-[16px] overflow-x-auto hide-scrollbar">
                        {(() => {
                            const sumA = data['A종 수익증권']?.reduce((a,b)=>a+(b.rawAmount||0),0) || 0;
                            const sumB = data['B종 수익증권']?.reduce((a,b)=>a+(b.rawAmount||0),0) || 0;
                            const sumC = data['C종 수익증권']?.reduce((a,b)=>a+(b.rawAmount||0),0) || 0;
                            const sumC1 = data['C-1종 수익증권']?.reduce((a,b)=>a+(b.rawAmount||0),0) || 0;
                            const total = sumA + sumB + sumC + sumC1;
                            return (
                                <>
                                    {sumA > 0 && (
                                    <div className="flex items-baseline gap-[4px] shrink-0">
                                        <span className={`${getTrancheColor('A종')} font-bold text-[14px] mr-[2px]`}>A종 수익증권</span>
                                        <span className="text-white font-bold text-[14px]">{formatAmount(sumA)}</span>
                                        <span className="text-[#86868B] text-[13px] tracking-tight mr-[4px]">({total > 0 ? ((sumA/total)*100).toFixed(1) : 0}%)</span>
                                    </div>
                                    )}
                                    {sumB > 0 && (
                                    <div className="flex items-baseline gap-[4px] shrink-0">
                                        <span className={`${getTrancheColor('B종')} font-bold text-[14px] mr-[2px]`}>B종 수익증권</span>
                                        <span className="text-white font-bold text-[14px]">{formatAmount(sumB)}</span>
                                        <span className="text-[#86868B] text-[13px] tracking-tight mr-[4px]">({total > 0 ? ((sumB/total)*100).toFixed(1) : 0}%)</span>
                                    </div>
                                    )}
                                    {sumC > 0 && (
                                    <div className="flex items-baseline gap-[4px] shrink-0">
                                        <span className={`${getTrancheColor('C종')} font-bold text-[14px] mr-[2px]`}>C종 수익증권</span>
                                        <span className="text-white font-bold text-[14px]">{formatAmount(sumC)}</span>
                                        <span className="text-[#86868B] text-[13px] tracking-tight mr-[4px]">({total > 0 ? ((sumC/total)*100).toFixed(1) : 0}%)</span>
                                    </div>
                                    )}
                                    {sumC1 > 0 && (
                                    <div className="flex items-baseline gap-[4px] shrink-0">
                                        <span className={`${getTrancheColor('C-1종')} font-bold text-[14px] mr-[2px]`}>C-1종 수익증권</span>
                                        <span className="text-white font-bold text-[14px]">{formatAmount(sumC1)}</span>
                                        <span className="text-[#86868B] text-[13px] tracking-tight mr-[4px]">({total > 0 ? ((sumC1/total)*100).toFixed(1) : 0}%)</span>
                                    </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                    <div className="flex items-center gap-[4px] shrink-0 bg-transparent py-1 px-3 border border-[#444] rounded-full cursor-pointer hover:bg-[#333] transition-colors group">
                        <span className="text-[#E5E5E5] text-[13px] font-medium tracking-tight group-hover:text-white transition-colors">수익자 자세히보기</span>
                        <svg className="w-[12px] h-[12px] ml-1 text-[#666] group-hover:text-[#A1A1AA] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>

                <div className="flex w-full divide-x divide-[#444]/50">
                    {sortedTranches.map(trancheName => {
                        const items = data[trancheName];
                        if (items.length === 0) return null;
                        const tSum = items.reduce((a, b) => a + (b.rawAmount || 0), 0);
                        const isHighlighted = 
                            hoveredBarTranche === trancheName || 
                            (hoveredBarTranche === '주주대여' && trancheName === 'Equity') ||
                            (hoveredBarTranche === 'Tr.A-2' && trancheName === 'Tr.A-1');
                                
                        let headerSum = tSum;
                        return (
                            <div key={trancheName} className={`flex-1 min-w-0 flex flex-col pb-[32px] pl-[26px] pr-0 transition-colors duration-300 ${isHighlighted ? 'bg-[#383838]' : ''}`}>
                                <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[380px] pr-[22px]">
                                    <div className={`flex justify-between items-center w-full sticky top-0 z-10 pt-[20px] pb-[16px] transition-colors duration-300 ${isHighlighted ? 'bg-[#383838]' : 'bg-[#2A2A2A]'}`}>
                                        <span className={`${getTrancheColor(trancheName)} font-bold text-[15px]`}>{trancheName}</span>
                                        <span className="text-white font-bold text-[16px]">{headerSum.toLocaleString()}<span className="ml-[2px]">억</span></span>
                                    </div>
                                    {items.map((item, i) => {
                                        if (item.isSubHeader) return null;
                                        return (
                                            <div key={i} className="flex justify-between items-center w-full mb-[12px] group cursor-pointer" onClick={() => onInstClick && onInstClick(item.name, trancheName, item.amount)}>
                                                <span className={`text-[#E5E5E5] text-[14.5px] transition-colors duration-200 ${getTrancheHoverColor(trancheName)} break-keep mr-2 truncate`}>
                                                    {item.displayIndex}. {item.name}
                                                </span>
                                                <span className={`text-[#E5E5E5] text-[14.5px] transition-colors duration-200 ${getTrancheHoverColor(trancheName)} shrink-0`}>
                                                    {Number(item.rawAmount).toLocaleString()}<span className="ml-[2px]">억</span>
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default Fund421DetailCard;
