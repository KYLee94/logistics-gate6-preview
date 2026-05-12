import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../utils/supabaseClient';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import Fund421DetailCard from './shared/Fund421DetailCard';
import IotaOne427DetailCard from './shared/IotaOne427DetailCard';


export default function VehicleIntegrated() {
    const [phase816, setPhase816] = useState('refi'); // 'bridge' | 'refi'
    const [phase427, setPhase427] = useState('phase4');
    const [phase421, setPhase421] = useState('new'); // 'current' | 'new'
    const [selectedInst, setSelectedInst] = useState(null);
    const [iotaData, setIotaData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isHoveringIprWorkspace, setIsHoveringIprWorkspace] = useState(false);

    useEffect(() => {
        const controller = new AbortController();

        const fetchData = async () => {
            try {
                const { data, error } = await fetchWithRetry(
                    () => supabase.from('iota_capital_stack').select('*').abortSignal(controller.signal),
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
                    // Group data by vehicle -> phase -> tranche -> array of institutions
                    const grouped = {
                        427: { Bridge: {}, Refinancing: {} },
                        421: {},
                        816: { Bridge: {}, Refinancing: {} }
                    };

                    data.forEach(item => {
                        const v = parseInt(item.vehicle_name);
                        const p = item.phase;
                        let tranche = item.tranche_name; // 'Tr.A', '보통주', '주주대여금'
                        let type = item.tranche_type;
                        let sortOrder = 0;
                        let originalTranche = tranche;

                        // 427 & 816 special rule: merge '1종 종류주 등', '보통주', '주주대여금' into 'Equity'
                        if ((v === 427 || v === 816) && (tranche === '1종 종류주 등' || tranche === '보통주' || tranche === '주주대여금' || tranche.includes('종류주'))) {
                            tranche = 'Equity';
                            type = 'Equity';
                            if (originalTranche === '주주대여금') {
                                sortOrder = 1;
                            }
                        }
                        // 427 & 816 special rule: merge 'Tr.A-2' into 'Tr.A-1'
                        if ((v === 427 || v === 816) && tranche === 'Tr.A-2') {
                            tranche = 'Tr.A-1';
                            sortOrder = 1;
                        }

                        // 427 special rule: merge 'Tr.B-2' into 'Tr.B-1'
                        if (v === 427 && tranche === 'Tr.B-2') {
                            tranche = 'Tr.B-1';
                            sortOrder = 1;
                        }

                        if (!grouped[v]) {
                            grouped[v] = {};
                        }
                        if (!grouped[v][p]) {
                            grouped[v][p] = {};
                        }
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
                    });

                    // Sort everything by amount descending
                    [427, 421, 816].forEach(v => {
                        Object.keys(grouped[v]).forEach(p => {
                            Object.keys(grouped[v][p]).forEach(t => {
                                const arr = grouped[v][p][t];
                                arr.sort((a,b) => {
                                    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
                                    return b.rawAmount - a.rawAmount;
                                });

                                if ((v === 427 || v === 816) && t === 'Equity') {
                                    let hasSubheader = false;
                                    for (let i = 0; i < arr.length; i++) {
                                        if (arr[i].originalTranche === '주주대여금' && !hasSubheader) {
                                            arr.splice(i, 0, { isSubHeader: true, name: '주주대여금' });
                                            hasSubheader = true;
                                            i++; // skip the newly inserted subheader
                                        }
                                    }
                                }
                                
                                if ((v === 427 || v === 816) && t === 'Tr.A-1') {
                                    let hasSubheader = false;
                                    for (let i = 0; i < arr.length; i++) {
                                        if (arr[i].originalTranche === 'Tr.A-2' && !hasSubheader) {
                                            arr.splice(i, 0, { isSubHeader: true, name: 'Tr.A-2' });
                                            hasSubheader = true;
                                            i++; // skip the newly inserted subheader
                                        }
                                    }
                                }

                                if (v === 427 && t === 'Tr.B-1') {
                                    let hasSubheader = false;
                                    for (let i = 0; i < arr.length; i++) {
                                        if (arr[i].originalTranche === 'Tr.B-2' && !hasSubheader) {
                                            arr.splice(i, 0, { isSubHeader: true, name: 'Tr.B-2' });
                                            hasSubheader = true;
                                            i++; // skip the newly inserted subheader
                                        }
                                    }
                                }

                                let idx = 1;
                                arr.forEach(item => {
                                    if (!item.isSubHeader) {
                                        item.displayIndex = idx++;
                                    }
                                });
                            });
                        });
                    });

                    setIotaData(grouped);
                }
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error("Unhandled Exception in VehicleIntegrated:", error);
                setIotaData({ error: error.message || "데이터 로딩 중 예기치 않은 오류가 발생했습니다." });
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };
        fetchData();

        return () => {
            controller.abort();
        };
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

    const toggle816 = (
        <div className="bg-[#1C1C1E] p-1 rounded-[12px] flex items-center border border-[#3c3c3c]">
            <button 
                onClick={() => setPhase816('bridge')}
                className={`px-4 py-1.5 rounded-[10px] text-[13px] font-bold transition-all duration-300 ${phase816 === 'bridge' ? 'bg-[#2C2C2E] text-white shadow-sm' : 'text-[#86868B] hover:text-white'}`}
            >
                기존 브릿지 대출
            </button>
            <button 
                onClick={() => setPhase816('refi')}
                className={`relative px-4 py-1.5 rounded-[10px] text-[13px] font-bold transition-all duration-300 ${phase816 === 'refi' ? 'bg-[#2C2C2E] text-[#0A84FF] shadow-sm' : 'text-[#86868B] hover:text-white'}`}
            >
                <span className="absolute -top-[20px] left-1/2 -translate-x-1/2 text-[11px] text-[#86868B] tracking-tight whitespace-nowrap font-normal cursor-default">2026.05.24</span>
                금번 리파이낸싱
            </button>
        </div>
    );

    const toggle427 = (
        <div className="bg-[#1C1C1E] p-1 rounded-[12px] flex items-center border border-[#3c3c3c]">
            <button 
                onClick={() => setPhase427('bridge')}
                className={`px-4 py-1.5 rounded-[10px] text-[13px] font-bold transition-all duration-300 ${phase427 === 'bridge' ? 'bg-[#2C2C2E] text-white shadow-sm' : 'text-[#86868B] hover:text-white'}`}
            >
                기존 브릿지 대출
            </button>
            <button 
                onClick={() => setPhase427('refi')}
                className={`relative px-4 py-1.5 rounded-[10px] text-[13px] font-bold transition-all duration-300 ${phase427 === 'refi' ? 'bg-[#2C2C2E] text-[#0A84FF] shadow-sm' : 'text-[#86868B] hover:text-white'}`}
            >
                <span className="absolute -top-[20px] left-1/2 -translate-x-1/2 text-[11px] text-[#86868B] tracking-tight whitespace-nowrap font-normal cursor-default">2025.05</span>
                본PF 1차
            </button>
        </div>
    );

    const toggle421 = (
        <div className="bg-[#1C1C1E] p-1 rounded-[12px] flex items-center border border-[#3c3c3c]">
            <button 
                onClick={() => setPhase421('current')}
                className={`relative px-4 py-1.5 rounded-[10px] text-[13px] font-bold transition-all duration-300 cursor-pointer ${phase421 === 'current' ? 'bg-[#2C2C2E] text-[#0A84FF] shadow-sm' : 'text-[#86868B] hover:text-white'}`}
            >
                기존 펀드
            </button>
            <button 
                onClick={() => setPhase421('new')}
                className={`relative px-4 py-1.5 rounded-[10px] text-[13px] font-bold transition-all duration-300 cursor-pointer ${phase421 === 'new' ? 'bg-[#2C2C2E] text-[#0A84FF] shadow-sm' : 'text-[#86868B] hover:text-white'}`}
            >
                <span className="absolute -top-[20px] left-1/2 -translate-x-1/2 text-[11px] text-[#86868B] tracking-tight whitespace-nowrap font-normal cursor-default">2026.05</span>
                현재 현황
            </button>
        </div>
    );

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
                <div className="flex justify-between items-end mb-[12px]">
                    <h2 className="text-[24px] font-bold text-white tracking-tight">{title}</h2>
                    {toggleContent}
                </div>

                <div className="w-full p-[6px] border border-[#333] rounded-[38px] flex flex-col gap-[6px]">
                {/* Dashboard Metrics Cards */}
                {vehicleId !== '421' && (
                <div className="w-full flex gap-[6px]">
                    <div className="w-[390px] h-[274px] flex flex-col gap-[6px]">
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
                <div className="w-full mt-[8px] mb-[8px]">
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
            </div>
        );
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

    if (loading) {
        return <div className="w-full flex-1 flex items-center justify-center text-[#86868B]">DB 데이터 로딩 중...</div>;
    }

    if (!iotaData) {
        return <div className="w-full flex-1 flex flex-col items-center justify-center text-[#86868B] gap-4">
            <svg className="w-12 h-12 text-[#444]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <span>데이터 연동 대기 중</span>
        </div>;
    }

    // Calculate totals dynamically
    const getTotal = (v, p = 'Current') => {
        let sum = 0;
        if (iotaData[v] && iotaData[v][p]) {
            Object.values(iotaData[v][p]).forEach(trancheArray => {
                sum += trancheArray.reduce((a, b) => a + (parseFloat(b.rawAmount) || 0), 0);
            });
        }
        return sum;
    };

    const getTypeTotal = (v, p = 'Current', typeStr) => {
        let sum = 0;
        if (iotaData[v] && iotaData[v][p]) {
            Object.values(iotaData[v][p]).forEach(trancheArray => {
                trancheArray.forEach(item => {
                    if (item.type === typeStr && !item.isSubHeader) sum += (parseFloat(item.rawAmount) || 0);
                });
            });
        }
        return sum;
    };

    const get427MockPhaseTotal = (phase, typeStr) => {
        if (phase === 'phase1') {
            if (typeStr === 'Equity') return 2800;
            if (typeStr === 'Loan') return 28400;
            return 31200;
        }
        if (phase === 'phase2') {
            if (typeStr === 'Equity') return 2800;
            if (typeStr === 'Loan') return 16200;
            return 19000;
        }
        return 0;
    };

    const displayTotal427 = phase427 === 'phase1' || phase427 === 'phase2' 
        ? get427MockPhaseTotal(phase427, 'Total') 
        : getTotal(427, phase427 === 'phase3' ? 'Bridge' : 'Refinancing');
    const displayTotal816 = getTotal(816, phase816 === 'bridge' ? 'Bridge' : 'Refinancing');
    const activePhase421 = phase421 === 'current' ? '2024.10.ver' : 'new';
    const total421 = getTotal(421, activePhase421);

    const equity427 = phase427 === 'phase1' || phase427 === 'phase2'
        ? get427MockPhaseTotal(phase427, 'Equity')
        : getTypeTotal(427, phase427 === 'phase3' ? 'Bridge' : 'Refinancing', 'Equity');
        
    const loan427 = phase427 === 'phase1' || phase427 === 'phase2'
        ? get427MockPhaseTotal(phase427, 'Loan')
        : getTypeTotal(427, phase427 === 'phase3' ? 'Bridge' : 'Refinancing', 'Loan');
    
    // Grand total uses latest refinancing (or fixed values) for stability, or dynamic if preferred. Let's make it dynamic based on current toggles.
    const grandTotal = displayTotal427 + total421 + displayTotal816;

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

    return (
        <div className="w-[1200px] mx-auto flex-1 flex flex-col pt-[50px] shrink-0 pb-[100px]">
            
            {/* 1. 종합 */}
            <div className="mb-[28px]">
                <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[8px]">통합 Vehicle 파이낸싱 구조</h1>
                <p className="text-[16px] text-[#86868B] mb-[24px] leading-[26px]">IOTA Seoul 프로젝트 전체의 자본 구조 및 펀드별 에쿼티/론 조달 현황입니다.</p>
                
                {/* 외곽선 복구, 까만 박스 테두리 삭제 */}
                <div className="p-6 bg-[#272726] border border-[#3c3c3c] rounded-[24px] flex gap-8 items-start">
                    <div className="w-[280px] shrink-0 flex flex-col">
                        <div className="text-[13px] font-bold text-[#86868B] uppercase mb-[10px]">Total Project Volume</div>
                        <div className="text-[32px] font-bold text-white leading-none tracking-tight pt-[6px]">{formatAmount(grandTotal)}</div>
                    </div>
                    
                    <div className="flex-1 flex flex-col">
                        <div className="flex gap-4 w-full">
                            {/* 427 PFV Box */}
                            <div 
                                onClick={() => document.getElementById('section-427')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                className="flex-1 px-[20px] py-[16px] bg-[#151515] border border-transparent rounded-[16px] flex flex-col justify-between cursor-pointer hover:bg-[#1f1f1f] hover:border-[#444] transition-all"
                            >
                                <span className="text-[14px] font-bold text-white tracking-tight mb-[12px]">427 PFV</span>
                                <div className="flex flex-col gap-[6px]">
                                    <div className="flex justify-between items-center text-[13px]">
                                        <span className="text-[#86868B]">Equity</span>
                                        <span className="text-[#E5E5E5] font-semibold">{formatAmount(equity427)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[13px]">
                                        <span className="text-[#86868B]">Loan</span>
                                        <span className="text-[#E5E5E5] font-semibold">{formatAmount(loan427)}</span>
                                    </div>
                                    <div className="border-t border-[#333] pt-[10px] mt-[6px] flex justify-between items-end">
                                        <span className="text-[13px] text-[#86868B] font-medium leading-none mb-[2px]">Total</span>
                                        <span className="text-[20px] font-bold text-white tracking-tight leading-none">{formatAmount(displayTotal427)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* 816 PFV Box */}
                            <div 
                                onClick={() => document.getElementById('section-816')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                className="flex-1 px-[20px] py-[16px] bg-[#151515] border border-transparent rounded-[16px] flex flex-col justify-between cursor-pointer hover:bg-[#1f1f1f] hover:border-[#444] transition-all"
                            >
                                <span className="text-[14px] font-bold text-white tracking-tight mb-[12px]">816 PFV</span>
                                <div className="flex flex-col gap-[6px]">
                                    <div className="flex justify-between items-center text-[13px]">
                                        <span className="text-[#86868B]">Equity</span>
                                        <span className="text-[#E5E5E5] font-semibold">{formatAmount(getTypeTotal(816, phase816 === 'bridge' ? 'Bridge' : 'Refinancing', 'Equity'))}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[13px]">
                                        <span className="text-[#86868B]">Loan</span>
                                        <span className="text-[#E5E5E5] font-semibold">{formatAmount(getTypeTotal(816, phase816 === 'bridge' ? 'Bridge' : 'Refinancing', 'Loan'))}</span>
                                    </div>
                                    <div className="border-t border-[#333] pt-[10px] mt-[6px] flex justify-between items-end">
                                        <span className="text-[13px] text-[#86868B] font-medium leading-none mb-[2px]">Total</span>
                                        <span className="text-[20px] font-bold text-white tracking-tight leading-none">{formatAmount(displayTotal816)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* 421 Fund Box */}
                            <div 
                                onClick={() => document.getElementById('section-421')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                className="flex-1 px-[20px] py-[16px] bg-[#151515] border border-transparent rounded-[16px] flex flex-col justify-between cursor-pointer hover:bg-[#1f1f1f] hover:border-[#444] transition-all"
                            >
                                <span className="text-[14px] font-bold text-white tracking-tight mb-[12px]">421호 펀드</span>
                                <div className="flex flex-col justify-end h-full">
                                    <div className="border-t border-[#333] pt-[10px] mt-auto flex justify-between items-end">
                                        <span className="text-[13px] text-[#86868B] font-medium leading-none mb-[2px]">Total</span>
                                        <span className="text-[20px] font-bold text-white tracking-tight leading-none">{formatAmount(total421)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full h-[20px]"></div>

            {/* 2. IOTA One (427) */}
            <IotaOne427DetailCard 
                id="section-427" 
                vehicleId="427"
                title="IOTA One (427 PFV)" 
                dbData={iotaData[427] || {}}
                navigateTo={navigateTo}
                externalPhase={phase427}
                setExternalPhase={setPhase427}
            />

            <div className="w-full h-[38px]"></div>

            {/* 3. IOTA Two (816) */}
            <VehicleDetailCard 
                id="section-816" 
                vehicleId="816"
                title="IOTA Two (816 PFV)" 
                totalAmountStr={formatAmount(displayTotal816)} 
                data={iotaData[816][phase816 === 'bridge' ? 'Bridge' : 'Refinancing']} 
                toggleContent={toggle816}
            />

            <div className="w-full h-[38px]"></div>

            {/* 4. 421 펀드 */}
            <Fund421DetailCard 
                id="section-421" 
                vehicleId="421"
                title="421호 펀드" 
                totalAmountStr={formatAmount(total421)} 
                data={iotaData[421]?.[activePhase421] || {}} 
                toggleContent={toggle421}
            />

            <div className="w-full h-[38px]"></div>

            {/* 5. IPR */}
            <div id="section-ipr" className="mb-[28px]">
                <div className="flex justify-between items-end mb-[12px]">
                    <h2 className="text-[24px] font-bold text-white tracking-tight">IPR (Iota Project REITs)</h2>
                    <button 
                        onClick={() => navigateTo('platform/iotaseoul/workspace/ipr')}
                        className="px-[12px] py-[6px] rounded-[10px] border border-[#333] bg-transparent text-[12px] text-[#2997ff] hover:bg-[#2997ff]/10 transition-colors font-medium cursor-pointer tracking-tight"
                    >
                        IPR 워크스페이스로
                    </button>
                </div>
                
                <div className="flex flex-col gap-[20px]">
                    {/* 기본 정보 */}
                    <div className="bg-[#292928] border border-[#3c3c3c] px-[32px] py-[28px] rounded-[32px] w-full">
                        <div className="grid grid-cols-[110px_1fr] gap-y-3 text-[16px]">
                            <span className="text-[#86868B]">Vehicle</span>
                            <div className="flex items-center gap-[12px]">
                                <span 
                                    onClick={() => navigateTo('platform/iotaseoul/workspace/ipr')}
                                    onMouseEnter={() => setIsHoveringIprWorkspace(true)}
                                    onMouseLeave={() => setIsHoveringIprWorkspace(false)}
                                    onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                                    className="text-white font-medium cursor-pointer hover:text-[#2997ff] transition-colors"
                                >
                                    IPR [Iota Project REITs] - 프로젝트리츠 TFT : 권순일(투자) · 윤용택(관리)
                                </span>
                                <div 
                                    className="flex items-center -space-x-[10px] cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => navigateTo('platform/iotaseoul/workspace/ipr')}
                                    onMouseEnter={() => setIsHoveringIprWorkspace(true)}
                                    onMouseLeave={() => setIsHoveringIprWorkspace(false)}
                                    onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                                >
                                    <img src={`${import.meta.env.BASE_URL}권순일.webp`} alt="권순일" className="w-[32px] h-[32px] rounded-full border border-[#292928] object-cover shadow-sm relative z-10" />
                                    <img src={`${import.meta.env.BASE_URL}윤용택.webp`} alt="윤용택" className="w-[32px] h-[32px] rounded-full border border-[#292928] object-cover shadow-sm relative z-0" />
                                </div>
                            </div>
                            <span className="text-[#86868B]">성격</span><span className="text-white font-medium">통합 Vehicle (선매수자)</span>
                            <span className="text-[#86868B]">단체</span><span className="text-white font-medium">사전 준비 워킹그룹 (IPR-WG)</span>
                            <span className="text-[#86868B]">시공사/주관사</span><span className="text-white font-medium">TBD</span>
                            <span className="text-[#86868B]">대주 비고</span><span className="text-white font-medium">외부 자문: 법무·회계·감정 듀딜 / 병렬 트랙</span>
                        </div>
                    </div>

                    {/* 마일스톤 */}
                    <div className="bg-[#292928] border border-[#3c3c3c] px-[32px] pt-[28px] pb-[32px] rounded-[32px] w-full">
                        <h4 className="text-[14px] font-bold text-[#86868B] mb-[26px] font-['Inter']">마일스톤 / 트랙</h4>
                        
                        <div className="flex w-full items-start justify-between relative">
                            {/* Horizontal Line behind dots */}
                            <div className="absolute top-[7px] left-[8%] right-[8%] h-[2px] bg-[#3c3c3c] z-0"></div>
                            
                            {[
                                { stage: 0, title: "조기 의향 확인", desc: "이오타 자산을 IPR 편입 후보로 예비등록", active: true },
                                { stage: 1, title: "옵션 설계", desc: "가격결정 메커니즘, 인도시점, 수수료", active: true },
                                { stage: 2, title: "권순약정 초안", desc: "외부 법무자문 선정 및 초안 작성", active: false },
                                { stage: 3, title: "외부 검증", desc: "회계/감정 병렬 진행, 시나리오 검증", active: false },
                                { stage: 4, title: "LP 사전 통지", desc: "421호 펀드 LP 대상 편입 의향 청취", active: false },
                                { stage: 5, title: "약정 체결·공시", desc: "정식 권순약정 체결 후 운용보고 반영", active: false },
                            ].map((s, idx) => (
                                <div key={idx} className="relative z-10 flex flex-col items-center flex-1 px-2">
                                    {/* Dot */}
                                    <div className={`w-[16px] h-[16px] rounded-full mb-[20px] ${s.active ? 'border-[3px] border-[#eab308] bg-[#eab308]' : 'bg-[#3c3c3c]'}`}></div>
                                    {/* Title */}
                                    <div className={`text-center font-bold text-[15px] mb-[8px] ${s.active ? 'text-[#eab308]' : 'text-white'}`}>Stage {s.stage}<br/>{s.title}</div>
                                    {/* Desc */}
                                    <div className="text-center text-[#86868B] text-[12px] break-keep leading-snug px-1">{s.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {isHoveringIprWorkspace && (
                <div 
                    className="fixed z-[100] pointer-events-none px-[10px] py-[6px] bg-[#111] border border-[#333] text-[#bbb9af] text-[12px] font-normal whitespace-nowrap flex items-center gap-[6px]"
                    style={{
                        left: mousePos.x + 15,
                        top: mousePos.y + 15
                    }}
                >
                    IPR 워크스페이스로 이동
                </div>
            )}

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
                                <p className="text-[16px] text-[#A1A1AA] mb-8">모집 금액: <strong className="text-white">{selectedInst.amount}억원</strong></p>
                                
                                <button 
                                    onClick={() => {
                                        setSelectedInst(null);
                                        navigateTo('platform/iotaseoul/stakeholder/lp');
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
