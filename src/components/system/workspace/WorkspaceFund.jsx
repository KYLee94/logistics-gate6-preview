import React, { useState, useEffect } from 'react';
import WorkspaceActivityLog from './WorkspaceActivityLog';
import { supabase } from '../../../utils/supabaseClient';
import { fetchWithRetry } from '../../../utils/fetchWithRetry';

export default function WorkspaceFund() {
    const [iotaData, setIotaData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedInst, setSelectedInst] = useState(null);
    const [showAllLps, setShowAllLps] = useState(false);

    useEffect(() => {
        const controller = new AbortController();

        const fetchData = async () => {
            try {
                const { data, error } = await fetchWithRetry(
                    () => supabase.from('iota_capital_stack').select('*').eq('vehicle_name', '421').abortSignal(controller.signal),
                    3, 
                    500, 
                    controller.signal
                );
                if (controller.signal.aborted) return;

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

                    Object.keys(grouped[421].Current).forEach(t => {
                        const arr = grouped[421].Current[t];
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

                    setIotaData(grouped);
                }
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error("Unhandled Exception:", error);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        fetchData();
        return () => controller.abort();
    }, []);

    const navigateTo = (path) => {
        const base = import.meta.env.BASE_URL;
        const url = base.endsWith('/') ? `${base}${path}` : `${base}/${path}`;
        window.history.pushState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    const handleInstClick = (instName, tranche, amount) => {
        setSelectedInst({ name: instName, tranche, amount });
    };

    const formatAmount = (rawAmt) => {
        const amt = Math.round(rawAmt); // 소수점 반올림
        const jo = Math.floor(amt / 10000);
        const uk = amt % 10000;
        let formattedUk = uk.toLocaleString('ko-KR');
        if (jo > 0) {
            if (uk === 0) return `${jo}조원`;
            return `${jo}조 ${formattedUk}억원`;
        }
        return `${formattedUk}억원`;
    };

    const getTotal = (v, p = 'Current') => {
        let sum = 0;
        if (iotaData[v] && iotaData[v][p]) {
            Object.values(iotaData[v][p]).forEach(trancheArray => {
                sum += trancheArray.reduce((a, b) => a + (parseFloat(b.rawAmount) || 0), 0);
            });
        }
        return sum;
    };

    const VehicleDetailCard = ({ id, vehicleId, title, totalAmountStr, data, toggleContent }) => {
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

        // Ensure we have formatAmount
        const amtFmt = (rawAmt) => {
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
            if (trancheName.includes('Tr.A-1')) return 'bg-[#4572a1]';
            if (trancheName.includes('Tr.A') || trancheName.includes('Tr. A') || trancheName.includes('A종')) return 'bg-[#4572a1]';
            if (trancheName.includes('Tr.B-2')) return 'bg-[#18464a]';
            if (trancheName.includes('Tr.B-1')) return 'bg-[#2c777d]';
            if (trancheName.includes('Tr.B') || trancheName.includes('Tr. B') || trancheName.includes('B종')) return 'bg-[#2c777d]';
            if (trancheName.includes('Tr.C') || trancheName.includes('Tr. C') || trancheName.includes('C종')) return 'bg-[#85609e]';
            if (trancheName.includes('Tr.D') || trancheName.includes('Tr. D') || trancheName.includes('D종')) return 'bg-[#966171]';
            return 'bg-[#444]';
        };

        const gfa = vehicleId === '427' ? '102,540평' : '36,537평';
        const officeArea = vehicleId === '427' ? '34,470평' : '15,529평';
        const retailArea = vehicleId === '427' ? '1,569평' : '1,022평';
        const hotelArea = vehicleId === '427' ? '5,121평' : '-평';

        return (
            <div id={id} className="mb-[28px]">
                <div className="flex justify-between items-end mb-[16px]">
                    <h2 className="text-[24px] font-bold text-white tracking-tight">{title}</h2>
                    {toggleContent}
                </div>

                {/* Dashboard Metrics Cards */}
                {vehicleId !== '421' && (
                <div className="w-full flex gap-[20px] mb-[20px]">
                    <div className="w-[390px] h-[274px] flex flex-col gap-[20px]">
                        <div className="w-full flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] pr-6 flex flex-row items-center transition-colors duration-300">
                            <div className="w-[114px] flex flex-col justify-between border-r border-[#444]/50 h-[54px] pl-[24px]">
                                <span className="text-[14px] font-bold text-[#86868B] font-['Inter'] whitespace-nowrap">공급 예정</span>
                                <span className="text-[28px] font-bold text-white tracking-tight leading-none mt-[-2px] whitespace-nowrap">2032</span>
                            </div>
                            <div className="w-[100px] flex flex-col justify-between border-r border-[#444]/50 h-[54px] pl-[18px]">
                                <span className="text-[14px] font-bold text-[#86868B] font-['Inter'] whitespace-nowrap">Brand</span>
                                <img src={`${import.meta.env.BASE_URL}iota-logo.png`} alt="IOTA" className="h-[22px] object-contain object-left mt-0 opacity-100 mb-[4px]" />
                            </div>
                            <div className="flex-1 flex flex-col justify-between h-[54px] pl-[20px] overflow-hidden">
                                <span className="text-[14px] font-bold text-[#86868B] font-['Inter'] whitespace-nowrap">연면적</span>
                                <span className="text-[28px] font-bold text-white tracking-tight leading-none mt-[-2px] whitespace-nowrap">{gfa}</span>
                            </div>
                        </div>

                        <div className="w-full flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] px-6 pb-[8px] flex flex-row items-center transition-colors duration-300">
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
                                <div className="flex flex-col gap-[6px]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[14px] text-[#86868B] leading-none">업무</span>
                                        <span className="text-[16px] font-bold text-white leading-none">{officeArea}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[14px] text-[#86868B] leading-none">리테일</span>
                                        <span className="text-[16px] font-bold text-white leading-none">{retailArea}</span>
                                    </div>
                                    {vehicleId !== '816' && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-[14px] text-[#86868B] leading-none">호텔</span>
                                        <span className="text-[16px] font-bold text-white leading-none">{hotelArea}</span>
                                    </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 h-[274px] bg-[#292928] border border-[#3c3c3c] rounded-[32px] overflow-hidden relative flex flex-col transition-colors duration-300">
                        <div className="absolute top-1/2 left-0 right-0 h-px bg-[#3C3C3C] z-0" />
                        <div className="absolute top-[0px] bottom-[0px] left-1/2 w-px bg-[#3C3C3C] z-0" />
                        
                        <div className="grid grid-cols-2 grid-rows-2 w-full h-full relative z-10">
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
                                        <span className="text-[28px] font-bold text-[#bbb9af] tracking-tighter leading-none whitespace-nowrap">2조 1,964억</span>
                                    </div>
                                </div>
                            </div>
                            
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
                                        <span className="text-[28px] font-bold text-[#bbb9af] tracking-tighter leading-none whitespace-nowrap">2조 3,749억</span>
                                    </div>
                                </div>
                            </div>

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
                                        <span className="text-[28px] font-bold text-[#bbb9af] tracking-tighter leading-none font-['Inter'] whitespace-nowrap">IRR 10.5%</span>
                                    </div>
                                </div>
                            </div>

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
                                        <span className="text-[28px] font-bold text-[#bbb9af] tracking-tighter leading-none whitespace-nowrap">64.3만원</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                )}

                {/* Visual Tranche Bar */}
                <div className="w-full mb-[20px]">
                    {(() => {
                        const allItems = Object.values(data).flat();
                        const barGroups = {};
                        allItems.forEach(item => {
                            if (item.isSubHeader) return;
                            let bT = item.originalTranche || item.type;
                            if (vehicleId !== '421') {
                                if (bT === '보통주' || bT === '1종 종류주 등' || (bT.includes('종류주') && !bT.includes('수익증권')) || bT === 'Equity') bT = 'Equity';
                                if (bT === '주주대여금' || bT === '주주대여') bT = '주주대여';
                            }
                            if (!barGroups[bT]) barGroups[bT] = 0;
                            barGroups[bT] += (item.rawAmount || 0);
                        });
                        
                        const order = {'Equity':1, '주주대여':2, 'Tr.A':3, 'Tr.A-1':3.1, 'Tr.A-2':3.2, 'Tr.B':4, 'Tr.B-1':4.1, 'Tr.B-2':4.2, 'Tr.C':5, 'Tr.D':6, 'A종 수익증권':3, 'B종 수익증권':4, 'C종 수익증권':5};
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
                            {vehicleId === '421' ? (
                                (() => {
                                    const sumA = data['A종 수익증권']?.reduce((a,b)=>a+(b.rawAmount||0),0) || 0;
                                    const sumB = data['B종 수익증권']?.reduce((a,b)=>a+(b.rawAmount||0),0) || 0;
                                    const sumC = data['C종 수익증권']?.reduce((a,b)=>a+(b.rawAmount||0),0) || 0;
                                    const total = sumA + sumB + sumC;
                                    return (
                                        <>
                                            {sumA > 0 && (
                                            <div className="flex items-baseline gap-[4px] shrink-0">
                                                <span className={`${getTrancheColor('A종')} font-bold text-[14px] mr-[2px]`}>A종 수익증권</span>
                                                <span className="text-white font-bold text-[14px]">{amtFmt(sumA)}</span>
                                                <span className="text-[#86868B] text-[13px] tracking-tight mr-[4px]">({total > 0 ? ((sumA/total)*100).toFixed(1) : 0}%)</span>
                                            </div>
                                            )}
                                            {sumB > 0 && (
                                            <div className="flex items-baseline gap-[4px] shrink-0">
                                                <span className={`${getTrancheColor('B종')} font-bold text-[14px] mr-[2px]`}>B종 수익증권</span>
                                                <span className="text-white font-bold text-[14px]">{amtFmt(sumB)}</span>
                                                <span className="text-[#86868B] text-[13px] tracking-tight mr-[4px]">({total > 0 ? ((sumB/total)*100).toFixed(1) : 0}%)</span>
                                            </div>
                                            )}
                                            {sumC > 0 && (
                                            <div className="flex items-baseline gap-[4px] shrink-0">
                                                <span className={`${getTrancheColor('C종')} font-bold text-[14px] mr-[2px]`}>C종 수익증권</span>
                                                <span className="text-white font-bold text-[14px]">{amtFmt(sumC)}</span>
                                                <span className="text-[#86868B] text-[13px] tracking-tight mr-[4px]">({total > 0 ? ((sumC/total)*100).toFixed(1) : 0}%)</span>
                                            </div>
                                            )}
                                        </>
                                    );
                                })()
                            ) : (
                                <>
                                    <div className="flex items-center gap-[6px] shrink-0">
                                        <span className={`${getTrancheColor('Equity')} font-bold text-[16px]`}>Equity</span>
                                        <span className="text-[#eab308] font-bold text-[16px]">{amtFmt(totalEquity)}</span>
                                    </div>
                                    <div className="flex items-center gap-[6px] shrink-0">
                                        <span className="text-white font-bold text-[16px]">Loan</span>
                                        <span className="text-[#eab308] font-bold text-[16px]">{amtFmt(totalLoan)}</span>
                                    </div>
                                    
                                    <div className="w-[1px] h-[12px] bg-[#444]/50 mx-[4px] shrink-0"></div>
                                    
                                    <div className="flex items-baseline gap-[8px] shrink-0">
                                        {(() => {
                                            const loanGroups = {};
                                            Object.values(data).flat().forEach(item => {
                                                if (item.isSubHeader) return;
                                                if (item.type === 'Equity') return;
                                                let orig = item.originalTranche || item.type;
                                                if (orig === 'Tr.A-1' || orig === 'Tr.A-2') orig = 'Tr.A';
                                                if (orig === 'Tr.B-1' || orig === 'Tr.B-2') orig = 'Tr.B';
                                                if (!loanGroups[orig]) loanGroups[orig] = 0;
                                                loanGroups[orig] += (item.rawAmount || 0);
                                            });
                                            const order = {'Tr.A':1, 'Tr.B':4, 'Tr.C':5, 'Tr.D':6};
                                            const loanKeys = Object.keys(loanGroups).sort((a,b) => (order[a] || 99) - (order[b] || 99));

                                            return loanKeys.map(origTranche => {
                                                const lSum = loanGroups[origTranche];
                                                const pct = totalLoan > 0 ? ((lSum / totalLoan) * 100).toFixed(1) : 0;
                                                return (
                                                    <div key={origTranche} className="flex items-baseline gap-[4px]">
                                                        <span className={`${getTrancheColor(origTranche)} font-bold text-[14px] mr-[2px]`}>{origTranche}</span>
                                                        <span className="text-white font-bold text-[14px]">{amtFmt(lSum)}</span>
                                                        <span className="text-[#86868B] text-[13px] tracking-tight mr-[4px]">({pct}%)</span>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </>
                            )}
                        </div>
                        <div 
                            className="text-[14px] text-[#86868B] shrink-0 cursor-pointer hover:text-[#E5E5E5] transition-colors font-medium flex items-center group ml-4 translate-x-[6px]"
                            onClick={() => {
                                if (vehicleId) {
                                    navigateTo('platform/iotaseoul/stakeholder/lp');
                                    setTimeout(() => {
                                        window.location.hash = `#${vehicleId}`;
                                    }, 100);
                                }
                            }}
                        >
                            <span>{vehicleId === '421' ? '수익자 자세히보기' : '자세히보기'}</span>
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
                                (hoveredBarTranche === 'Tr.A-2' && trancheName === 'Tr.A-1') ||
                                (hoveredBarTranche === 'Tr.B-2' && trancheName === 'Tr.B-1');
                                    // Calculate header sum (exclude Tr.A-2 from Tr.A-1 header sum)
                                    let headerSum = tSum;
                                    if (trancheName === 'Tr.A-1') {
                                        headerSum = items.filter(it => it.originalTranche !== 'Tr.A-2').reduce((a, b) => a + (b.rawAmount || 0), 0);
                                    }
                                    if (trancheName === 'Tr.B-1') {
                                        headerSum = items.filter(it => it.originalTranche !== 'Tr.B-2').reduce((a, b) => a + (b.rawAmount || 0), 0);
                                    }
                                    
                                    return (
                                        <div key={trancheName} className={`flex-1 min-w-0 flex flex-col pb-[32px] pl-[26px] pr-0 transition-colors duration-300 ${isHighlighted ? 'bg-[#383838]' : ''}`}>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[380px] pr-[22px]">
                                                <div className={`flex justify-between items-center w-full sticky top-0 z-10 pt-[20px] pb-[16px] transition-colors duration-300 ${isHighlighted ? 'bg-[#383838]' : 'bg-[#2A2A2A]'}`}>
                                                    <span className={`${getTrancheColor(trancheName)} font-bold text-[15px]`}>{trancheName}</span>
                                                    <span className="text-white font-bold text-[16px]">{headerSum.toLocaleString()}<span className="ml-[2px]">억</span></span>
                                                </div>
                                                {items.map((item, i) => {
                                                    if (item.isSubHeader) {
                                                        const isTargetSub = item.name === 'Tr.A-2' || item.name === 'Tr.B-2';
                                                        const subSum = isTargetSub ? items.filter(it => it.originalTranche === item.name).reduce((a,b) => a + (b.rawAmount || 0), 0) : 0;
                                                        
                                                        return (
                                                            <div key={i} className={`mt-[16px] mb-[12px] border-b border-[#444]/50 pb-2 ${isTargetSub ? 'flex justify-between items-end' : ''}`}>
                                                                <span className={`${isTargetSub ? getTrancheColor(item.name) : 'text-[#86868B]'} font-bold ${isTargetSub ? 'text-[15px]' : 'text-[13px]'}`}>{item.name}</span>
                                                                {isTargetSub && <span className="text-white font-bold text-[16px]">{subSum.toLocaleString()}<span className="ml-[2px]">억</span></span>}
                                                            </div>
                                                        );
                                                    }
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
                        <div className="w-[50px] shrink-0">
                            <span className="text-[13px] font-bold text-[#86868B]">KAM</span>
                        </div>
                        <div className="flex items-center gap-[12px] w-[96px] shrink-0">
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

            <div className="mt-[40px]">
                {loading || !iotaData ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                ) : (
                    <>
            <div className="w-full mb-[60px]">
                <div className="flex justify-between items-end mb-[24px]">
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
                    <VehicleDetailCard 
                        id="section-421" 
                        vehicleId="421"
                        title="3. 421호 펀드" 
                        totalAmountStr={formatAmount(getTotal(421))} 
                        data={iotaData[421].Current} 
                        toggleContent={
                            <button 
                                onClick={() => navigateTo('platform/iotaseoul/421-fund')}
                                className="px-[12px] py-[6px] rounded-[10px] border border-[#333] bg-transparent text-[12px] text-[#2997ff] hover:bg-[#2997ff]/10 transition-colors font-medium cursor-pointer tracking-tight"
                            >
                                펀드 구조 및 지분율 자세히보기
                            </button>
                        }
                    />
                    </>
                )}
            </div>
        </div>
    );
}
