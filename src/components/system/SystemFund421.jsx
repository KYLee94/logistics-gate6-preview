import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../utils/supabaseClient';
import { fetchWithRetry } from '../../utils/fetchWithRetry';

export default function SystemFund421() {
    const [iotaData, setIotaData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedInst, setSelectedInst] = useState(null);
    const [showAllLps, setShowAllLps] = useState(false);
    const vehicleId = '421';
    
    const navigateTo = (path) => {
        const base = import.meta.env.BASE_URL;
        const url = base.endsWith('/') ? `${base}${path}` : `${base}/${path}`;
        window.history.pushState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data, error } = await fetchWithRetry(() => supabase.from('iota_capital_stack').select('*'));
                if (error) {
                    console.error("Supabase API Error:", error);
                    setIotaData({ error: error.message });
                    return;
                }
                if (data) {
                    const grouped = {
                        421: { Current: {} }
                    };

                    data.forEach(item => {
                        const v = parseInt(item.vehicle_name);
                        if (v !== 421) return;
                        const p = item.phase;
                        let tranche = item.tranche_name;
                        let type = item.tranche_type;
                        let sortOrder = 0;
                        let originalTranche = tranche;

                        if (grouped[v] && grouped[v][p]) {
                            if (!grouped[v][p][tranche]) {
                                grouped[v][p][tranche] = [];
                            }
                            grouped[v][p][tranche].push({
                                name: item.institution_name,
                                amount: item.amount_krw_100m.toLocaleString(),
                                rawAmount: item.amount_krw_100m,
                                type: type,
                                originalTranche: originalTranche,
                                sortOrder: sortOrder
                            });
                        }
                    });

                    Object.keys(grouped[421]).forEach(p => {
                        Object.keys(grouped[421][p]).forEach(t => {
                            const arr = grouped[421][p][t];
                            arr.sort((a,b) => {
                                if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
                                return b.rawAmount - a.rawAmount;
                            });

                            let idx = 1;
                            arr.forEach(item => {
                                if (!item.isSubHeader) {
                                    item.displayIndex = idx++;
                                }
                            });
                        });
                    });

                    setIotaData(grouped);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleInstClick = (instName, tranche, amount) => {
        setSelectedInst({ name: instName, tranche, amount });
    };

    if (iotaData && iotaData.error) {
        return (
            <div className="w-full flex-1 flex flex-col items-center justify-center text-[#ff453a] gap-4">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span className="font-bold text-lg">DB 연동 오류 발생</span>
                <span className="text-[#86868B]">{iotaData.error}</span>
                <span className="text-[#666] text-sm mt-2">※ 인증 토큰이 만료되었거나 접근 권한이 없습니다. 페이지를 새로고침하거나 다시 로그인해주세요.</span>
            </div>
        );
    }

    if (loading || !iotaData) {
        return <div className="w-full flex-1 flex items-center justify-center text-[#86868B]">DB 데이터 로딩 중...</div>;
    }

    const getTotal = (v, p = 'Current') => {
        let sum = 0;
        if (iotaData[v] && iotaData[v][p]) {
            Object.values(iotaData[v][p]).forEach(trancheArray => {
                sum += trancheArray.reduce((a, b) => a + (parseFloat(b.rawAmount) || 0), 0);
            });
        }
        return sum;
    };

    const total421 = getTotal(421);

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

    // The VehicleDetailCard component logic adapted
    const VehicleDetailCard = ({ id, vehicleId, title, totalAmountStr, data }) => {
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
            if (a.includes('Tr.') && b.includes('Tr.')) return a.localeCompare(b);
            if (a.includes('Tr.')) return 1;
            if (b.includes('Tr.')) return -1;
            return a.localeCompare(b);
        });

        const getTrancheColor = (trancheName) => {
            if (trancheName.includes('Equity') || trancheName.includes('보통주') || (trancheName.includes('종류주') && !trancheName.includes('수익증권')) || trancheName.includes('주주대여금')) return 'text-white';
            if (trancheName.includes('Tr.A') || trancheName.includes('Tr. A') || trancheName.includes('A종')) return 'text-[#5da0e7]';
            if (trancheName.includes('Tr.B') || trancheName.includes('Tr. B') || trancheName.includes('B종')) return 'text-[#3aaab3]';
            if (trancheName.includes('Tr.C') || trancheName.includes('Tr. C') || trancheName.includes('C종')) return 'text-[#b889d9]';
            if (trancheName.includes('Tr.D') || trancheName.includes('Tr. D') || trancheName.includes('D종')) return 'text-[#cd879c]';
            return 'text-white';
        };

        const getTrancheHoverColor = (trancheName) => {
            if (trancheName.includes('Equity') || trancheName.includes('보통주') || (trancheName.includes('종류주') && !trancheName.includes('수익증권')) || trancheName.includes('주주대여금')) return 'group-hover:text-[#eab308]';
            if (trancheName.includes('Tr.A') || trancheName.includes('Tr. A') || trancheName.includes('A종')) return 'group-hover:text-[#5da0e7]';
            if (trancheName.includes('Tr.B') || trancheName.includes('Tr. B') || trancheName.includes('B종')) return 'group-hover:text-[#3aaab3]';
            if (trancheName.includes('Tr.C') || trancheName.includes('Tr. C') || trancheName.includes('C종')) return 'group-hover:text-[#b889d9]';
            if (trancheName.includes('Tr.D') || trancheName.includes('Tr. D') || trancheName.includes('D종')) return 'group-hover:text-[#cd879c]';
            return 'group-hover:text-white';
        };

        const getTrancheBgColor = (trancheName) => {
            if (trancheName.includes('Equity') || trancheName.includes('보통주') || (trancheName.includes('종류주') && !trancheName.includes('수익증권'))) return 'bg-black';
            if (trancheName.includes('주주대여금') || trancheName.includes('주주대여')) return 'bg-[#254266]';
            if (trancheName.includes('Tr.A-2')) return 'bg-[#315780]';
            if (trancheName.includes('Tr.A') || trancheName.includes('Tr. A') || trancheName.includes('A종')) return 'bg-[#4572a1]';
            if (trancheName.includes('Tr.B') || trancheName.includes('Tr. B') || trancheName.includes('B종')) return 'bg-[#2c777d]';
            if (trancheName.includes('Tr.C') || trancheName.includes('Tr. C') || trancheName.includes('C종')) return 'bg-[#85609e]';
            if (trancheName.includes('Tr.D') || trancheName.includes('Tr. D') || trancheName.includes('D종')) return 'bg-[#966171]';
            return 'bg-[#444]';
        };

        return (
            <div id={id} className="mb-12">
                <div className="flex justify-between items-end mb-[14px]">
                    <h2 className="text-[24px] font-bold text-white tracking-tight">{title}</h2>
                </div>

                {/* Visual Tranche Bar */}
                <div className="w-full mb-[20px]">
                    {(() => {
                        const allItems = Object.values(data).flat();
                        const barGroups = {};
                        allItems.forEach(item => {
                            if (item.isSubHeader) return;
                            let bT = item.originalTranche || item.type;
                            if (!barGroups[bT]) barGroups[bT] = 0;
                            barGroups[bT] += (item.rawAmount || 0);
                        });
                        
                        const order = {'Equity':1, '주주대여':2, 'Tr.A':3, 'Tr.A-1':3.1, 'Tr.A-2':3.2, 'Tr.B':4, 'Tr.C':5, 'Tr.D':6, 'A종 수익증권':3, 'B종 수익증권':4, 'C종 수익증권':5};
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
                                const total = sumA + sumB + sumC;
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
                                                <div key={i} className="flex justify-between items-center w-full mb-[12px] group cursor-pointer" onClick={() => handleInstClick(item.name, trancheName, item.amount)}>
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

    return (
        <div className="w-[1200px] mx-auto flex-1 flex flex-col pt-[77px] shrink-0 pb-[200px]">
            {/* Header / Title */}
            <div className="mb-[10px]">
                <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">421 Fund</h1>
                <p className="text-[16px] text-[#86868B] mb-[40px] leading-[26px]">
                    IOTA One, Two 투자를 위해 운용중인 이지스421호 부동산 사모펀드입니다.
                </p>
            </div>

            {/* Tables Section */}
            <div className="flex gap-[40px] mb-[60px]">
                {/* 1. 펀드 개요 */}
                <div className="flex-[0.85] flex flex-col">
                    <h2 className="text-[24px] font-bold text-white mb-[16px] tracking-tight">펀드 개요</h2>
                    <div className="w-full flex-1 flex flex-col border-t-[2px] border-[#666] border-b border-[#444]">
                        <div className="flex-1 flex border-b border-[#444]">
                            <div className="w-[140px] bg-[#1c1c1e] flex items-center px-4 py-2 text-[#86868B] text-[13px] font-bold">투자신탁명</div>
                            <div className="flex-1 flex items-center px-4 py-2 text-[#E5E5E5] text-[14px]">이지스일반사모부동산투자신탁421호</div>
                        </div>
                        <div className="flex-1 flex border-b border-[#444]">
                            <div className="w-[140px] bg-[#1c1c1e] flex items-center px-4 py-2 text-[#86868B] text-[13px] font-bold">설립일(존속기간)</div>
                            <div className="flex-1 flex items-center px-4 py-2 text-[#E5E5E5] text-[14px]">2021년 11월 22일(10년)</div>
                        </div>
                        <div className="flex-1 flex border-b border-[#444]">
                            <div className="w-[140px] bg-[#1c1c1e] flex items-center px-4 py-2 text-[#86868B] text-[13px] font-bold">집합투자업자</div>
                            <div className="flex-1 flex items-center px-4 py-2 text-[#E5E5E5] text-[14px]">이지스자산운용</div>
                        </div>
                        <div className="flex-1 flex border-b border-[#444]">
                            <div className="w-[140px] bg-[#1c1c1e] flex items-center px-4 py-2 text-[#86868B] text-[13px] font-bold">신탁사</div>
                            <div className="flex-1 flex items-center px-4 py-2 text-[#E5E5E5] text-[14px]">국민은행</div>
                        </div>
                        <div className="flex-1 flex border-b border-[#444]">
                            <div className="w-[140px] bg-[#1c1c1e] flex items-center px-4 py-2 text-[#86868B] text-[13px] font-bold">일반사무수탁</div>
                            <div className="flex-1 flex items-center px-4 py-2 text-[#E5E5E5] text-[14px]">스카이펀드</div>
                        </div>
                        <div className="flex-1 flex border-b border-[#444]">
                            <div className="w-[140px] bg-[#1c1c1e] flex items-center px-4 py-2 text-[#86868B] text-[13px] font-bold">판매회사</div>
                            <div className="flex-1 flex items-center px-4 py-2 text-[#E5E5E5] text-[14px]">대신증권, 이베스트투자증권</div>
                        </div>
                        <div className="flex-1 flex">
                            <div className="w-[140px] bg-[#1c1c1e] flex items-center px-4 py-2 text-[#86868B] text-[13px] font-bold">Equity</div>
                            <div className="flex-1 flex items-center px-4 py-2 text-[#E5E5E5] text-[14px] whitespace-nowrap">총 3,090억 <span className="text-[#86868B] ml-1">(A종 602억 / B종 620억 / C종 1,850억)</span></div>
                        </div>
                    </div>
                </div>

                {/* 2. 투자내역 */}
                <div className="flex-[1.15] flex flex-col">
                    <h2 className="text-[24px] font-bold text-white mb-[16px] tracking-tight">IOTA Seoul 투자내역</h2>
                    <table className="w-full flex-1 table-fixed text-left border-collapse border-y-[2px] border-t-[#666] border-b-[#444]">
                        <thead>
                            <tr className="border-b border-[#444] bg-[#1c1c1e]">
                                <th className="py-2 px-4 text-[#86868B] font-bold text-[13px] text-center w-[120px] border-r border-[#444]">투자자산</th>
                                <th className="py-2 px-4 text-[#86868B] font-bold text-[13px] text-center w-[110px] border-r border-[#444]">투자종류</th>
                                <th className="py-2 px-4 text-[#86868B] font-bold text-[13px] text-right border-r border-[#444]">투자금(백만원)</th>
                                <th className="py-2 px-4 text-[#86868B] font-bold text-[13px] text-right border-r border-[#444]">주식수(주)</th>
                                <th className="py-2 px-4 text-[#86868B] font-bold text-[13px] text-right">발행가액(원)</th>
                            </tr>
                        </thead>
                        <tbody className="text-[13px] text-[#E5E5E5]">
                            {/* YD427PFV */}
                            <tr className="border-b border-[#444]">
                                <td rowSpan="3" className="py-2 px-4 text-center font-bold text-white border-r border-[#444] bg-[#1a1a1c]">YD427PFV</td>
                                <td className="py-2 px-4 border-r border-[#444]">제1종종류주식</td>
                                <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">38,656</td>
                                <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">966,400</td>
                                <td className="py-2 px-4 text-right font-[Inter] tracking-tight">40,000</td>
                            </tr>
                            <tr className="border-b border-[#444]">
                                <td className="py-2 px-4 border-r border-[#444]">보통주식</td>
                                <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">20,444</td>
                                <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">511,100</td>
                                <td className="py-2 px-4 text-right font-[Inter] tracking-tight">40,000</td>
                            </tr>
                            <tr className="border-b border-[#444] bg-[#1c1c1e]/50">
                                <td className="py-2 px-4 font-bold text-center text-[#86868B] border-r border-[#444]">소계</td>
                                <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight border-r border-[#444]">59,100</td>
                                <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight border-r border-[#444]">1,477,500</td>
                                <td className="py-2 px-4 text-right font-[Inter] tracking-tight"></td>
                            </tr>
                            
                            {/* YD816PFV */}
                            <tr className="border-b border-[#444]">
                                <td rowSpan="4" className="py-2 px-4 text-center font-bold text-white border-r border-[#444] bg-[#1a1a1c]">YD816PFV</td>
                                <td className="py-2 px-4 border-r border-[#444]">제2종종류주식</td>
                                <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">500</td>
                                <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">100,000</td>
                                <td className="py-2 px-4 text-right font-[Inter] tracking-tight">5,000</td>
                            </tr>
                            <tr className="border-b border-[#444]">
                                <td className="py-2 px-4 border-r border-[#444]">보통주식</td>
                                <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">1,455</td>
                                <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">291,000</td>
                                <td className="py-2 px-4 text-right font-[Inter] tracking-tight">5,000</td>
                            </tr>
                            <tr className="border-b border-[#444]">
                                <td className="py-2 px-4 border-r border-[#444]">주주대여</td>
                                <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">240,000</td>
                                <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]"></td>
                                <td className="py-2 px-4 text-right font-[Inter] tracking-tight"></td>
                            </tr>
                            <tr className="border-b border-[#444] bg-[#1c1c1e]/50">
                                <td className="py-2 px-4 font-bold text-center text-[#86868B] border-r border-[#444]">소계</td>
                                <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight border-r border-[#444]">241,955</td>
                                <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight border-r border-[#444]">391,000</td>
                                <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight">5,000</td>
                            </tr>

                            {/* Total */}
                            <tr className="bg-[#2A2A2A]">
                                <td colSpan="2" className="py-2 px-4 text-center font-bold text-white border-r border-[#444]">계</td>
                                <td className="py-2 px-4 text-right font-bold text-[#0A84FF] text-[14.5px] font-[Inter] tracking-tight border-r border-[#444]">301,055</td>
                                <td className="py-2 px-4 border-r border-[#444]"></td>
                                <td className="py-2 px-4"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 수익자 지분 구조 */}
            <div className="w-full mb-[60px]">
                <div className="flex justify-between items-end mb-[16px]">
                    <h2 className="text-[24px] font-bold text-white tracking-tight">수익자 지분 구조</h2>
                    <button 
                        onClick={() => setShowAllLps(!showAllLps)}
                        className="px-[12px] py-[6px] rounded-[10px] border border-[#333] bg-transparent text-[12px] text-[#2997ff] hover:bg-[#2997ff]/10 transition-colors font-medium cursor-pointer tracking-tight flex items-center gap-2"
                    >
                        {showAllLps ? '주요 LP만 보기' : '전체 수익자 명부 보기'}
                    </button>
                </div>

                {!showAllLps ? (
                    <div className="w-full flex gap-[15px]">
                        <div 
                            className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] p-6 flex flex-col justify-between transition-colors duration-300 cursor-pointer hover:bg-[#3c3c3c]"
                            onClick={() => handleInstClick('삼성물산', 'C종 수익증권', '800')}
                        >
                            <div>
                                <div className="text-[#86868B] text-[13px] font-bold mb-1">Anchor LP (C종)</div>
                                <div className="text-[20px] font-bold text-white tracking-tight">삼성물산</div>
                            </div>
                            <div className="mt-4 flex items-end justify-between">
                                <div className="text-[14px] text-[#A1A1AA]">투자금 <span className="font-['Inter'] text-white ml-1">800</span><span className="text-[12px] ml-[2px]">억</span></div>
                                <div className="text-[24px] font-bold text-[#cd879c] font-['Inter'] tracking-tight translate-y-[5px]">25.9%</div>
                            </div>
                        </div>
                        <div 
                            className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] p-6 flex flex-col justify-between transition-colors duration-300 cursor-pointer hover:bg-[#3c3c3c]"
                            onClick={() => handleInstClick('NH투자증권', 'C종 수익증권', '500')}
                        >
                            <div>
                                <div className="text-[#86868B] text-[13px] font-bold mb-1">Anchor LP (C종)</div>
                                <div className="text-[20px] font-bold text-white tracking-tight">NH투자증권</div>
                            </div>
                            <div className="mt-4 flex items-end justify-between">
                                <div className="text-[14px] text-[#A1A1AA]">투자금 <span className="font-['Inter'] text-white ml-1">500</span><span className="text-[12px] ml-[2px]">억</span></div>
                                <div className="text-[24px] font-bold text-[#cd879c] font-['Inter'] tracking-tight translate-y-[5px]">16.2%</div>
                            </div>
                        </div>
                        <div 
                            className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] p-6 flex flex-col justify-between transition-colors duration-300 cursor-pointer hover:bg-[#3c3c3c]"
                            onClick={() => handleInstClick('이지스자산운용(주)', 'GP / Anchor LP (합산)', '424.5')}
                        >
                            <div>
                                <div className="text-[#86868B] text-[13px] font-bold mb-1">GP / Anchor LP (합산)</div>
                                <div className="text-[20px] font-bold text-white tracking-tight">이지스자산운용(주)</div>
                            </div>
                            <div className="mt-4 flex items-end justify-between">
                                <div className="text-[14px] text-[#A1A1AA]">투자금 <span className="font-['Inter'] text-white ml-1">424.5</span><span className="text-[12px] ml-[2px]">억</span></div>
                                <div className="text-[24px] font-bold text-[#5da0e7] font-['Inter'] tracking-tight translate-y-[5px]">13.7%</div>
                            </div>
                        </div>
                        <div 
                            className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] p-6 flex flex-col justify-between transition-colors duration-300 cursor-pointer hover:bg-[#3c3c3c]"
                            onClick={() => handleInstClick('디에스클러스터(주)', 'C종 수익증권', '250')}
                        >
                            <div>
                                <div className="text-[#86868B] text-[13px] font-bold mb-1">Major LP (C종)</div>
                                <div className="text-[20px] font-bold text-white tracking-tight">디에스클러스터(주)</div>
                            </div>
                            <div className="mt-4 flex items-end justify-between">
                                <div className="text-[14px] text-[#A1A1AA]">투자금 <span className="font-['Inter'] text-white ml-1">250</span><span className="text-[12px] ml-[2px]">억</span></div>
                                <div className="text-[24px] font-bold text-[#cd879c] font-['Inter'] tracking-tight translate-y-[5px]">8.1%</div>
                            </div>
                        </div>
                        <div 
                            className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] p-6 flex flex-col justify-between transition-colors duration-300 cursor-pointer hover:bg-[#3c3c3c]"
                            onClick={() => handleInstClick('(주)케이티에스테이트', 'B종 수익증권', '210')}
                        >
                            <div>
                                <div className="text-[#86868B] text-[13px] font-bold mb-1">Major LP (B종)</div>
                                <div className="text-[20px] font-bold text-white tracking-tight">(주)케이티에스테이트</div>
                            </div>
                            <div className="mt-4 flex items-end justify-between">
                                <div className="text-[14px] text-[#A1A1AA]">투자금 <span className="font-['Inter'] text-white ml-1">210</span><span className="text-[12px] ml-[2px]">억</span></div>
                                <div className="text-[24px] font-bold text-[#3aaab3] font-['Inter'] tracking-tight translate-y-[4px]">6.8%</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-full">
                        <table className="w-full text-left border-collapse border-y-[2px] border-t-[#666] border-b-[#444]">
                            <thead>
                                <tr className="border-b border-[#444] bg-[#1c1c1e]">
                                    <th className="py-2 px-4 text-[#86868B] font-bold text-[13px] text-center w-[140px] border-r border-[#444]">구분</th>
                                    <th className="py-2 px-4 text-[#86868B] font-bold text-[13px] text-center border-r border-[#444]">수익자</th>
                                    <th className="py-2 px-4 text-[#86868B] font-bold text-[13px] text-right border-r border-[#444] w-[150px]">투자금액(백만원)</th>
                                    <th className="py-2 px-4 text-[#86868B] font-bold text-[13px] text-right border-r border-[#444] w-[120px]">지분율(종별)</th>
                                    <th className="py-2 px-4 text-[#86868B] font-bold text-[13px] text-right w-[120px]">지분율(전체)</th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px] text-[#E5E5E5]">
                                {/* A종 */}
                                <tr className="border-b border-[#444]">
                                    <td rowSpan="7" className="py-2 px-4 text-center font-bold text-white border-r border-[#444] bg-[#1a1a1c]">A종 수익증권</td>
                                    <td className="py-2 px-4 border-r border-[#444] bg-[#5da0e7]/20 text-[#5da0e7] font-bold">이지스자산운용(주)</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#5da0e7] font-[Inter] tracking-tight border-r border-[#444] bg-[#5da0e7]/20">19,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444] bg-[#5da0e7]/20 text-[#5da0e7]">30.60%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#5da0e7] font-[Inter] tracking-tight bg-[#5da0e7]/20">6.10%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">한중건설(주)</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">13,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">21.00%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">4.20%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">에셀유한회사</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">10,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">16.10%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">3.20%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">구봉산업(주)</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">10,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">16.10%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">3.20%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">(주)데피니트파트너스</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">6,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">9.70%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">1.90%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">(주)게우트플래닝</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">4,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">6.50%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">1.30%</td>
                                </tr>
                                <tr className="border-b border-[#444] bg-[#1c1c1e]/50">
                                    <td className="py-2 px-4 font-bold text-center text-[#86868B] border-r border-[#444]">소계</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight border-r border-[#444]">62,000</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight border-r border-[#444]">100.00%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight">20.10%</td>
                                </tr>

                                {/* B종 */}
                                <tr className="border-b border-[#444]">
                                    <td rowSpan="11" className="py-2 px-4 text-center font-bold text-white border-r border-[#444] bg-[#1a1a1c]">B종 수익증권</td>
                                    <td className="py-2 px-4 border-r border-[#444] bg-[#5da0e7]/20 text-[#5da0e7] font-bold">이지스자산운용(주)</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#5da0e7] font-[Inter] tracking-tight border-r border-[#444] bg-[#5da0e7]/20">13,450</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444] bg-[#5da0e7]/20 text-[#5da0e7]">21.70%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#5da0e7] font-[Inter] tracking-tight bg-[#5da0e7]/20">4.40%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">안다인베스트먼트파트너스</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">9,500</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">15.30%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">3.10%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">에셀유한회사</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">5,350</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">8.60%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">1.70%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">구봉산업(주)</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">5,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">8.10%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">1.60%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">(주)에스제이더블유인터내셔널</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">3,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">4.80%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">1.00%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444] bg-[#3aaab3]/20 text-[#3aaab3] font-bold">(주)케이티에스테이트</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#3aaab3] font-[Inter] tracking-tight border-r border-[#444] bg-[#3aaab3]/20">21,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444] bg-[#3aaab3]/20 text-[#3aaab3]">33.90%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#3aaab3] font-[Inter] tracking-tight bg-[#3aaab3]/20">6.80%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">주식회사안다자산운용</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">1,500</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">2.40%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">0.50%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">이노베스트 코리아</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">1,200</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">1.90%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">0.40%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">(주)데피니트파트너스</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">1,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">1.60%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">0.30%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">(주)디와이시스템</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">1,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">1.60%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">0.30%</td>
                                </tr>
                                <tr className="border-b border-[#444] bg-[#1c1c1e]/50">
                                    <td className="py-2 px-4 font-bold text-center text-[#86868B] border-r border-[#444]">소계</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight border-r border-[#444]">62,000</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight border-r border-[#444]">100.00%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight">20.10%</td>
                                </tr>

                                {/* C종 */}
                                <tr className="border-b border-[#444]">
                                    <td rowSpan="6" className="py-2 px-4 text-center font-bold text-white border-r border-[#444] bg-[#1a1a1c]">C종 수익증권</td>
                                    <td className="py-2 px-4 border-r border-[#444] bg-[#5da0e7]/20 text-[#5da0e7] font-bold">이지스자산운용(주)</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#5da0e7] font-[Inter] tracking-tight border-r border-[#444] bg-[#5da0e7]/20">10,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444] bg-[#5da0e7]/20 text-[#5da0e7]">5.40%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#5da0e7] font-[Inter] tracking-tight bg-[#5da0e7]/20">3.20%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444] bg-[#cd879c]/20 text-[#cd879c] font-bold">삼성물산</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#cd879c] font-[Inter] tracking-tight border-r border-[#444] bg-[#cd879c]/20">80,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444] bg-[#cd879c]/20 text-[#cd879c]">43.20%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#cd879c] font-[Inter] tracking-tight bg-[#cd879c]/20">25.90%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444] bg-[#cd879c]/20 text-[#cd879c] font-bold">디에스클러스터 주식회사</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#cd879c] font-[Inter] tracking-tight border-r border-[#444] bg-[#cd879c]/20">25,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444] bg-[#cd879c]/20 text-[#cd879c]">13.50%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#cd879c] font-[Inter] tracking-tight bg-[#cd879c]/20">8.10%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444] bg-[#cd879c]/20 text-[#cd879c] font-bold">NH투자증권</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#cd879c] font-[Inter] tracking-tight border-r border-[#444] bg-[#cd879c]/20">50,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444] bg-[#cd879c]/20 text-[#cd879c]">27.00%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#cd879c] font-[Inter] tracking-tight bg-[#cd879c]/20">16.20%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">현대캐피탈</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">20,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">10.80%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">6.50%</td>
                                </tr>
                                <tr className="border-b border-[#444] bg-[#1c1c1e]/50">
                                    <td className="py-2 px-4 font-bold text-center text-[#86868B] border-r border-[#444]">소계</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight border-r border-[#444]">185,000</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight border-r border-[#444]">100.00%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight">59.90%</td>
                                </tr>

                                {/* Total */}
                                <tr className="bg-[#2A2A2A]">
                                    <td colSpan="2" className="py-2 px-4 text-center font-bold text-white border-r border-[#444]">합계</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#0A84FF] text-[14.5px] font-[Inter] tracking-tight border-r border-[#444]">309,000</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#0A84FF] text-[14.5px] font-[Inter] tracking-tight border-r border-[#444]">100.00%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#0A84FF] text-[14.5px] font-[Inter] tracking-tight">100.00%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Content brought over from VehicleIntegrated */}
            <VehicleDetailCard 
                id="section-421" 
                vehicleId="421"
                title="421호 펀드 투자 구조" 
                totalAmountStr={formatAmount(total421)} 
                data={iotaData[421].Current} 
            />

            {/* Layer Popup (Modal) for Institution Click */}
            <AnimatePresence>
                {selectedInst && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setSelectedInst(null)}
                            className="fixed inset-0 bg-black/60 z-[100]"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-[#1c1c1e] border border-[#3c3c3c] rounded-[24px] shadow-2xl z-[101] overflow-hidden"
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-[12px] font-bold text-[#0A84FF] px-2 py-1 bg-[#0A84FF]/10 rounded-md">
                                        {selectedInst.tranche}
                                    </span>
                                    <button onClick={() => setSelectedInst(null)} className="text-[#86868B] hover:text-white transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                    </button>
                                </div>
                                <h2 className="text-[24px] font-bold text-white mb-2">{selectedInst.name}</h2>
                                <p className="text-[16px] text-[#A1A1AA] mb-8">투자 금액: <strong className="text-white">{selectedInst.amount}억원</strong></p>
                                
                                <button 
                                    onClick={() => {
                                        setSelectedInst(null);
                                        navigateTo('platform/iotaseoul/stakeholder/lp#section-421');
                                    }}
                                    className="w-full py-3 bg-[#0A84FF] hover:bg-[#0071e3] text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2"
                                >
                                    CRM 및 이력 자세히 보기
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
