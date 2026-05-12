import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const IotaOne427DetailCard = ({ id, vehicleId, title, dbData, navigateTo, externalPhase, setExternalPhase }) => {
    const [hoveredBarTranche, setHoveredBarTranche] = useState(null);
    const [isAccordionOpen, setIsAccordionOpen] = useState(false);
    const [localPhase, setLocalPhase] = useState('phase4');
    const activePhase = externalPhase || localPhase;
    const setActivePhase = setExternalPhase || setLocalPhase;

    // MOCK DATA for Phase 1 & 2 Capital Stack
    const mockPhase1 = {
        'Equity': dbData?.['Bridge']?.['Equity'] || [],
        'Tr.A': [{ name: 'Tr.A', type: 'Loan', rawAmount: 8400, displayIndex: 1, originalTranche: 'Tr.A' }],
        'Tr.B': [{ name: 'Tr.B', type: 'Loan', rawAmount: 2500, displayIndex: 1, originalTranche: 'Tr.B' }],
        'Tr.C': [{ name: 'Tr.C', type: 'Loan', rawAmount: 1500, displayIndex: 1, originalTranche: 'Tr.C' }],
        'Tr.D': [{ name: 'Tr.D', type: 'Loan', rawAmount: 2000, displayIndex: 1, originalTranche: 'Tr.D' }]
    };
    const mockPhase2 = {
        'Equity': dbData?.['Bridge']?.['Equity'] || [],
        'Tr.A': [{ name: 'Tr.A', type: 'Loan', rawAmount: 8400, displayIndex: 1, originalTranche: 'Tr.A' }],
        'Tr.B': [{ name: 'Tr.B', type: 'Loan', rawAmount: 2500, displayIndex: 1, originalTranche: 'Tr.B' }],
        'Tr.C': [{ name: 'Tr.C', type: 'Loan', rawAmount: 1500, displayIndex: 1, originalTranche: 'Tr.C' }],
        'Tr.D': [{ name: 'Tr.D', type: 'Loan', rawAmount: 2000, displayIndex: 1, originalTranche: 'Tr.D' }]
    };

    const getActiveData = () => {
        if (activePhase === 'phase1') return mockPhase1;
        if (activePhase === 'phase2') return mockPhase2;
        if (activePhase === 'phase3') return dbData?.['Bridge'] || {};
        if (activePhase === 'phase4') return dbData?.['Refinancing'] || {};
        return {};
    };

    const data = getActiveData();

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

    // Dynamic phase metrics based on the table
        const phaseMetrics = {
        phase1: {
            title: '최초UW',
            subtitle: '2021.11',
            cost: '2조 9,044억',
            costPyeong: '2,832 만원/평',
            revenue: '3조 2,907억',
            revenuePyeong: '3,209 만원/평',
            returnEM: '이익률 9.0%',
            returnIRR: '2,962억원',
            period: '68M',
            enoc: 'TBD',
            gfa: '85,159평',
            completionYear: '2027',
            officeArea: '-',
            retailArea: '-',
            hotelArea: '-'
        },
        phase2: {
            title: '1차 리파',
            subtitle: '2024.05',
            cost: '3조 9,231억',
            costPyeong: '3,825 만원/평',
            revenue: '4조 4,944억',
            revenuePyeong: '4,383 만원/평',
            returnEM: '이익률 12.7%',
            returnIRR: '5,712억원',
            period: '93M',
            enoc: 'TBD',
            gfa: '104,111평',
            completionYear: '2029',
            officeArea: '-',
            retailArea: '-',
            hotelArea: '-'
        },
        phase3: {
            title: '2차 리파',
            subtitle: '2025.01',
            cost: '취합중',
            costPyeong: '-',
            revenue: '5조 1,177억',
            revenuePyeong: '4,990 만원/평',
            returnEM: '이익률 9.0%',
            returnIRR: '4,540억원',
            period: '109M',
            enoc: 'TBD',
            gfa: '104,741평',
            completionYear: '2031',
            officeArea: '-',
            retailArea: '-',
            hotelArea: '-'
        },
        phase4: {
            title: '본PF 1차',
            subtitle: '2025.05',
            cost: '4조 9,751억',
            costPyeong: '4,851 만원/평',
            revenue: '5조 3,288억',
            revenuePyeong: '5,196 만원/평',
            returnEM: '이익률 6.6%',
            returnIRR: '3,536억원',
            period: '122M',
            enoc: 'TBD',
            gfa: '102,124평',
            completionYear: '2032',
            officeArea: '34,470평',
            retailArea: '1,569평',
            hotelArea: '5,121평'
        }
    };

    const baseMetrics = phaseMetrics['phase1'];
    const curMetrics = phaseMetrics[activePhase];

    const richData = [
        { category: '분석 대상 문서', phase1: '0. Hilton_IM_v2.06_PFV', phase2: '1. TM_밀레니엄힐튼 담보대출 Refi', phase3: '2. 만기연장 IM / 2.5. 추가투자 펀드', phase4: '3-1. 1차 PF대출 / 3-2. 현대건설 PF' },
        { category: '연면적', phase1: '85,159평', phase2: '104,111평', phase3: '104,741평', phase4: '102,124평' },
        { category: '총사업비 (지출)', phase1: '2조 9,044억원', phase2: '3조 9,231억원 (+35.1%)', phase3: '- (취합중)', phase4: '4조 9,751억원 (+71.3%)' },
        { category: '총매출 (수입)', phase1: '3조 2,907억원', phase2: '4조 4,944억원 (+36.6%)', phase3: '5조 1,177억원 (+55.5%)', phase4: '5조 3,288억원 (+61.9%)' },
        { category: '예상 사업이익', phase1: '2,962억원 (이익률 9.0%)', phase2: '5,712억원 (이익률 12.7%)', phase3: '4,540억원 (이익률 9.0%)', phase4: '3,536억원 (이익률 6.6%)' },
        { category: '토지 매입가', phase1: '1조 1,000억원 (평당 1.78억)', phase2: '1조 1,000억원 (동일)', phase3: '1조 1,000억원 (동일)', phase4: '1조 1,000억원 (동일)' },
        { category: '자산매입 비용 (명도/보상 포함)', phase1: '1조 4,519억원', phase2: '1조 3,078억원 (명도비 절감)', phase3: '1조 3,869억원 (일부 재상승)', phase4: '1조 3,005억원 (최종 확정)' },
        { category: '평당 도급공사비', phase1: '820만원 / 평', phase2: '900만원 / 평 (+15.4%)', phase3: '1,139만원 / 평 (+46.0%)', phase4: '1,130만원 / 평 (+44.9%)' },
        { category: '직접 공사비 총액', phase1: '6,983억원', phase2: '9,370억원 (+34.2%)', phase3: '1조 1,930억원 (+70.8%)', phase4: '1조 1,540억원 (+65.3%)' },
        { category: '금융 비용 총액', phase1: '6,172억원', phase2: '1조 2,196억원 (+97.6%)', phase3: '- (취합중)', phase4: '1조 9,529억원 (+216.4%)' },
        { category: '대출 구조 (총액)', phase1: '브릿지론 1.44조원', phase2: '리파이낸싱 1.44조원 (계획)', phase3: '브릿지 단기연장 1.44조원', phase4: '1차 PF 2.20조원 (실행)' },
        { category: '토지 감정가 (LTV)', phase1: '1조 4,069억원 (LTV 102.4%)', phase2: '2조 90억원 (LTV 80.6%)', phase3: '2조 6,535억원 (LTV 54.3%)', phase4: '2조 6,535억원 (LTV 82.91%)' },
        { category: '본공사 착공 시점', phase1: '2024년 05월 (예정)', phase2: '2025년 05월 (12개월 지연)', phase3: '2026년 07월 (26개월 지연)', phase4: '2027년 05월 (36개월 지연)' },
        { category: '사업 준공 시점', phase1: '2027년 09월 (68개월 소요)', phase2: '2029년 10월 (+25개월 지연)', phase3: '2031년 02월 (+41개월 지연)', phase4: '2032년 03월 (+54개월 지연)' }
    ];

    const ToggleContent = (
        <div className="bg-[#1C1C1E] p-1 rounded-[12px] flex items-center border border-[#3c3c3c]">
            {[
                { id: 'phase1', label: '최초UW', date: '2021.11' },
                { id: 'phase2', label: '1차 리파', date: '2024.05' },
                { id: 'phase3', label: '2차 리파', date: '2025.01' },
                { id: 'phase4', label: '본PF 1차', date: '2025.05' }
            ].map(p => (
                <button 
                    key={p.id}
                    onClick={() => setActivePhase(p.id)}
                    className={`relative px-4 py-1.5 rounded-[10px] text-[13px] font-bold transition-all duration-300 ${activePhase === p.id ? 'bg-[#2C2C2E] text-[#0A84FF] shadow-sm' : 'text-[#86868B] hover:text-white'}`}
                >
                    <span className="absolute -top-[20px] left-1/2 -translate-x-1/2 text-[11px] text-[#86868B] tracking-tight whitespace-nowrap font-normal cursor-default">{p.date}</span>
                    {p.label}
                </button>
            ))}
        </div>
    );

    return (
        <div id={id} className="mb-[28px]">
            <div className="flex justify-between items-end mb-[12px]">
                <h2 className="text-[24px] font-bold text-white tracking-tight">{title}</h2>
                {ToggleContent}
            </div>

            <div className="w-full p-[6px] border border-[#333] rounded-[38px] flex flex-col gap-[6px]">
                {/* Dashboard Metrics Cards */}
                <div 
                    className="w-full flex gap-[6px] cursor-pointer hover:opacity-90 transition-opacity relative group"
                    onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                >
                    <div className="absolute inset-0 bg-[#292928]/50 rounded-[32px] opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none flex items-center justify-center">
                        <span className="text-white font-bold tracking-tight text-[15px] bg-[#1a1a1c]/80 px-4 py-2 rounded-full border border-[#444] shadow-lg backdrop-blur-sm">
                            {isAccordionOpen ? '상세 표 닫기 ▲' : '개발 단계별 핵심 지표 상세 표 보기 ▼'}
                        </span>
                    </div>

                    <div className="w-[390px] h-[274px] flex flex-col gap-[6px]">
                        <div className="w-full flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] pr-6 flex flex-row items-center transition-colors duration-300">
                            <div className="w-[114px] flex flex-col justify-between border-r border-[#444]/50 h-[54px] pl-[24px]">
                                <span className="text-[14px] font-bold text-[#86868B] font-['Inter'] whitespace-nowrap">공급 예정</span>
                                <span className="text-[28px] font-bold text-white tracking-tight leading-none mt-[-2px] whitespace-nowrap">{curMetrics.completionYear}</span>
                            </div>
                            <div className="w-[100px] flex flex-col justify-between border-r border-[#444]/50 h-[54px] pl-[18px]">
                                <span className="text-[14px] font-bold text-[#86868B] font-['Inter'] whitespace-nowrap">Brand</span>
                                <img src={`/iota-logo.png`} alt="IOTA" className="h-[22px] object-contain object-left mt-0 opacity-100 mb-[4px]" />
                            </div>
                            <div className="flex-1 flex flex-col justify-between h-[54px] pl-[20px] overflow-hidden">
                                <span className="text-[14px] font-bold text-[#86868B] font-['Inter'] whitespace-nowrap">연면적</span>
                                <span className="text-[28px] font-bold text-white tracking-tight leading-none mt-[-2px] whitespace-nowrap">{curMetrics.gfa}</span>
                            </div>
                        </div>

                        <div className="w-full flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] px-6 pb-[8px] flex flex-row items-center transition-colors duration-300">
                            <div className="flex-[1.4] flex flex-col justify-center border-r border-[#444]/50 h-[74px] pr-5">
                                <span className="text-[14px] font-bold text-[#86868B] mb-[10px] font-['Inter']">개발기간</span>
                                <div className="flex items-center justify-start gap-[10px] mb-[4px]">
                                    <span className="text-[28px] font-bold text-[#A1A1AA] tracking-tighter leading-none">{baseMetrics.period}</span>
                                    <span className="text-[20px] text-[#666] leading-none mb-1 font-bold">→</span>
                                    <span className="text-[28px] font-bold text-white tracking-tighter leading-none">{curMetrics.period}</span>
                                </div>
                                <div className="flex justify-start gap-[24px] w-full">
                                    <span className="text-[11px] text-[#666] font-['Inter'] leading-none">{baseMetrics.title} {baseMetrics.subtitle}</span>
                                    <span className="text-[11px] text-[#A1A1AA] font-['Inter'] leading-none">{curMetrics.title} {curMetrics.subtitle}</span>
                                </div>
                            </div>
                            <div className="flex-[1] flex flex-col justify-center pl-6 h-[74px]">
                                <span className="text-[14px] font-bold text-[#86868B] mb-[10px] font-['Inter']">전용면적</span>
                                <div className="flex flex-col gap-[6px]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[14px] text-[#86868B] leading-none">업무</span>
                                        <span className="text-[16px] font-bold text-white leading-none">{curMetrics.officeArea}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[14px] text-[#86868B] leading-none">리테일</span>
                                        <span className="text-[16px] font-bold text-white leading-none">{curMetrics.retailArea}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[14px] text-[#86868B] leading-none">호텔</span>
                                        <span className="text-[16px] font-bold text-white leading-none">{curMetrics.hotelArea}</span>
                                    </div>
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
                                        <span className="text-[11px] text-[#666] mb-0 leading-none font-['Inter']">{baseMetrics.title}</span>
                                        <span className="text-[13px] text-[#86868B] mb-[6px]">{baseMetrics.costPyeong}</span>
                                        <span className="text-[28px] font-bold text-[#A1A1AA] tracking-tighter leading-none">{baseMetrics.cost}</span>
                                    </div>
                                    <span className="text-[20px] text-[#666] mb-[1px] font-bold mr-[-2px]">→</span>
                                    <div className="flex flex-col items-end w-[138px] whitespace-nowrap">
                                        <span className="text-[11px] text-white mb-0 leading-none font-medium font-['Inter'] whitespace-nowrap">{curMetrics.title}</span>
                                        <span className="text-[13px] text-white mb-[6px] whitespace-nowrap">{curMetrics.costPyeong}</span>
                                        <span className="text-[28px] font-bold text-[#bbb9af] tracking-tighter leading-none whitespace-nowrap">{curMetrics.cost}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="relative flex flex-col justify-end px-[32px] pb-[32px]">
                                <span className="absolute top-[20px] left-[20px] text-[15px] font-bold text-[#86868B] font-['Inter'] tracking-tight">매각 목표</span>
                                <div className="flex items-end justify-end gap-3 w-full">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-[#666] mb-0 leading-none font-['Inter']">{baseMetrics.title}</span>
                                        <span className="text-[13px] text-[#86868B] mb-[6px]">{baseMetrics.revenuePyeong}</span>
                                        <span className="text-[28px] font-bold text-[#A1A1AA] tracking-tighter leading-none">{baseMetrics.revenue}</span>
                                    </div>
                                    <span className="text-[20px] text-[#666] mb-[1px] font-bold mr-[-2px]">→</span>
                                    <div className="flex flex-col items-end w-[138px] whitespace-nowrap">
                                        <span className="text-[11px] text-white mb-0 leading-none font-medium font-['Inter'] whitespace-nowrap">{curMetrics.title}</span>
                                        <span className="text-[13px] text-white mb-[6px] whitespace-nowrap">{curMetrics.revenuePyeong}</span>
                                        <span className="text-[28px] font-bold text-[#bbb9af] tracking-tighter leading-none whitespace-nowrap">{curMetrics.revenue}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="relative flex flex-col justify-end px-[32px] pb-[34px]">
                                <span className="absolute top-[20px] left-[20px] text-[15px] font-bold text-[#86868B] font-['Inter'] tracking-tight">사업이익 목표</span>
                                <div className="flex items-end justify-end gap-3 w-full">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-[#666] mb-0 leading-none font-['Inter']">{baseMetrics.title}</span>
                                        <span className="text-[13px] text-[#86868B] mb-[6px] font-['Inter']">{baseMetrics.returnEM}</span>
                                        <span className="text-[28px] font-bold text-[#A1A1AA] tracking-tighter leading-none font-['Inter']">{baseMetrics.returnIRR}</span>
                                    </div>
                                    <span className="text-[20px] text-[#666] mb-[1px] font-bold mr-[-2px]">→</span>
                                    <div className="flex flex-col items-end w-[138px] whitespace-nowrap">
                                        <span className="text-[11px] text-white mb-0 leading-none font-medium font-['Inter'] whitespace-nowrap">{curMetrics.title}</span>
                                        <span className="text-[13px] text-white mb-[6px] font-['Inter'] whitespace-nowrap">{curMetrics.returnEM}</span>
                                        <span className="text-[28px] font-bold text-[#bbb9af] tracking-tighter leading-none font-['Inter'] whitespace-nowrap">{curMetrics.returnIRR}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="relative flex flex-col justify-end px-[32px] pb-[34px]">
                                <span className="absolute top-[20px] left-[20px] text-[15px] font-bold text-[#86868B] font-['Inter'] tracking-tight">E.NOC 목표</span>
                                <div className="flex items-end justify-end gap-3 w-full">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-[#666] mb-0 leading-none font-['Inter']">{baseMetrics.title}</span>
                                        <span className="text-[13px] text-[#86868B] mb-[6px]">-</span>
                                        <span className="text-[28px] font-bold text-[#A1A1AA] tracking-tighter leading-none">{baseMetrics.enoc}</span>
                                    </div>
                                    <span className="text-[20px] text-[#666] mb-[1px] font-bold mr-[-2px]">→</span>
                                    <div className="flex flex-col items-end w-[138px] whitespace-nowrap">
                                        <span className="text-[11px] text-white mb-0 leading-none font-medium font-['Inter'] whitespace-nowrap">{curMetrics.title}</span>
                                        <span className="text-[13px] text-white mb-[6px] whitespace-nowrap">-</span>
                                        <span className="text-[28px] font-bold text-[#bbb9af] tracking-tighter leading-none whitespace-nowrap">{curMetrics.enoc}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ACCORDION (Added cleanly without changing original surrounding UI) */}
                <AnimatePresence>
                    {isAccordionOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden bg-[#1c1c1e] rounded-[32px] border border-[#3c3c3c] mt-[6px]"
                        >
                            <div className="p-[32px]">
                                <h3 className="text-[20px] font-bold text-white mb-[20px] tracking-tight flex items-center">
                                    <span className="w-1.5 h-4 bg-[#A1A1AA] mr-2 rounded-full"></span>
                                    개발 단계별 핵심 지표 비교 요약표
                                </h3>
                                <div className="overflow-x-auto custom-scrollbar pb-2">
                                    <table className="w-full text-left border-collapse border-y-[2px] border-t-[#666] border-b-[#444] min-w-[1000px]">
                                        <thead>
                                            <tr className="border-b border-[#444] bg-[#1a1a1c]">
                                                <th className="py-4 px-4 text-[#86868B] font-bold text-[13px] border-r border-[#444] w-[180px]">지표 구분</th>
                                                <th className={`py-4 px-4 font-bold text-[13px] border-r border-[#444] ${activePhase==='phase1'?'text-[#0A84FF]':'text-[#86868B]'}`}>Phase 1: 초기 가정<br/><span className="text-[#666] font-normal">(2021.11 / IM 기준)</span></th>
                                                <th className={`py-4 px-4 font-bold text-[13px] border-r border-[#444] ${activePhase==='phase2'?'text-[#0A84FF]':'text-[#86868B]'}`}>Phase 2: 1차 연장<br/><span className="text-[#666] font-normal">(2024.05 / TM 기준)</span></th>
                                                <th className={`py-4 px-4 font-bold text-[13px] border-r border-[#444] ${activePhase==='phase3'?'text-[#0A84FF]':'text-[#86868B]'}`}>Phase 3: 2차 연장<br/><span className="text-[#666] font-normal">(2025.01 / 단기연장)</span></th>
                                                <th className={`py-4 px-4 font-bold text-[13px] ${activePhase==='phase4'?'text-[#0A84FF]':'text-[#86868B]'}`}>Phase 4: 1차 PF<br/><span className="text-[#666] font-normal">(2025.05 / PF IM 기준)</span></th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-[13.5px] text-[#E5E5E5]">
                                            {richData.map((row, idx) => (
                                                <tr key={idx} className="border-b border-[#333] hover:bg-[#2A2A2A] transition-colors">
                                                    <td className="py-3 px-4 font-bold text-[#A1A1AA] border-r border-[#444] bg-[#222] break-keep">{row.category}</td>
                                                    <td className={`py-3 px-4 border-r border-[#444] ${activePhase==='phase1'?'bg-[#2A2A2A] text-white':''}`}>{row.phase1}</td>
                                                    <td className={`py-3 px-4 border-r border-[#444] ${activePhase==='phase2'?'bg-[#2A2A2A] text-white':''}`}>{row.phase2}</td>
                                                    <td className={`py-3 px-4 border-r border-[#444] ${activePhase==='phase3'?'bg-[#2A2A2A] text-white':''}`}>{row.phase3}</td>
                                                    <td className={`py-3 px-4 ${activePhase==='phase4'?'bg-[#2A2A2A] text-white':''}`}>{row.phase4}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Visual Tranche Bar (EXACTLY AS ORIGINAL) */}
                <div className="w-full mt-[8px] mb-[8px]">
                    {(() => {
                        const allItems = Object.values(data).flat();
                        const barGroups = {};
                        allItems.forEach(item => {
                            if (item.isSubHeader) return;
                            let bT = item.originalTranche || item.type;
                            if (vehicleId !== '421') {
                                if (bT === '보통주' || bT === '1종 종류주' || (bT.includes('종류주') && !bT.includes('수익증권')) || bT === 'Equity') bT = 'Equity';
                                if (bT === '주주대여금' || bT === '주주대여') bT = '주주대여';
                            }
                            if (!barGroups[bT]) barGroups[bT] = 0;
                            barGroups[bT] += (item.rawAmount || 0);
                        });
                        
                        const order = {'Equity':1, '주주대여':2, 'Tr.A':3, 'Tr.A-1':3.1, 'Tr.A-2':3.2, 'Tr.B':4, 'Tr.B-1':4.1, 'Tr.B-2':4.2, 'Tr.C':5, 'Tr.D':6, 'A종 수익증권':3, 'B종 수익증권':4, 'C종 수익증권':5};
                        const sortedBarKeys = Object.keys(barGroups).sort((a,b) => (order[a] || 99) - (order[b] || 99));

                        return (
                            <div className="w-full h-[60px] relative rounded-[20px] bg-[#292928] select-none">
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

                {/* Investment Structure Box (EXACTLY AS ORIGINAL) */}
                <div className="w-full bg-[#292928] border border-[#3c3c3c] rounded-[32px] pt-[20px] flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center w-full pb-[16px] border-b border-[#444]/50 pl-[26px] pr-[32px]">
                        <div className="flex items-center gap-[16px] overflow-x-auto hide-scrollbar">
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
                        </div>
                        <div 
                            className="text-[14px] text-[#86868B] shrink-0 cursor-pointer hover:text-[#E5E5E5] transition-colors font-medium flex items-center group ml-4 translate-x-[6px]"
                            onClick={() => {
                                if (navigateTo) {
                                    navigateTo('platform/iotaseoul/stakeholder/lp');
                                    setTimeout(() => {
                                        window.location.hash = `#${vehicleId}`;
                                    }, 100);
                                }
                            }}
                        >
                            <span>자세히보기</span>
                            <svg className="w-[12px] h-[12px] ml-1 text-[#666] group-hover:text-[#A1A1AA] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>

                    <div className="flex w-full divide-x divide-[#444]/50">
                        {sortedTranches.map(trancheName => {
                            const items = data[trancheName];
                            if (!items || items.length === 0) return null;
                            const tSum = items.reduce((a, b) => a + (b.rawAmount || 0), 0);
                            const isHighlighted = 
                                hoveredBarTranche === trancheName || 
                                (hoveredBarTranche === '주주대여' && trancheName === 'Equity') ||
                                (hoveredBarTranche === 'Tr.A-2' && trancheName === 'Tr.A-1') ||
                                (hoveredBarTranche === 'Tr.B-2' && trancheName === 'Tr.B-1');
                                    
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
                                                        const isTargetSub = item.name === 'Tr.A-2' || item.name === 'Tr.B-2' || item.name === '보통주' || item.name === '1종 종류주' || (item.name && item.name.includes('종류주'));
                                                        const subSum = isTargetSub ? items.filter(it => it.originalTranche === item.name || (item.name === '1종 종류주' && it.originalTranche && it.originalTranche.includes('종류주'))).reduce((a,b) => a + (b.rawAmount || 0), 0) : 0;
                                                        
                                                        return (
                                                            <div key={i} className={`mt-[16px] mb-[12px] border-b border-[#444]/50 pb-2 ${isTargetSub ? 'flex justify-between items-end' : ''}`}>
                                                                <span className={`${isTargetSub ? getTrancheColor(item.name) : 'text-[#86868B]'} font-bold ${isTargetSub ? 'text-[15px]' : 'text-[13px]'}`}>{item.name}</span>
                                                                {isTargetSub && <span className="text-white font-bold text-[16px]">{subSum.toLocaleString()}<span className="ml-[2px]">억</span></span>}
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <div key={i} className="flex justify-between items-center w-full mb-[12px] group cursor-pointer">
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

export default IotaOne427DetailCard;
