import React, { useState, useEffect } from 'react';
import WorkspaceActivityLog from './WorkspaceActivityLog';
import { supabase } from '../../../utils/supabaseClient';
import { fetchWithRetry } from '../../../utils/fetchWithRetry';

export default function WorkspaceFinancing() {
    const [iotaData, setIotaData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [marketNews, setMarketNews] = useState(null);
    const [selectedLender, setSelectedLender] = useState('전체 대주');
    const [newsLoading, setNewsLoading] = useState(false);
    
    const fetchMarketNews = async () => {
        setNewsLoading(true);
        try {
            // 외부 무료 프록시 서버 장애로 인해, 기존처럼 빠르고 안정적인 로컬 JSON 로드 방식으로 복원합니다.
            // (대신 실시간 갱신 느낌을 주도록 1초 딜레이를 추가합니다)
            await new Promise(resolve => setTimeout(resolve, 1000));
            const res = await fetch(`${import.meta.env.BASE_URL}data/lfc-market-news.json?t=${new Date().getTime()}`);
            if (res.ok) {
                const data = await res.json();
                setMarketNews(data);
            }
        } catch (e) {
            console.error("Failed to load market news", e);
        } finally {
            setNewsLoading(false);
        }
    };

    useEffect(() => {
        fetchMarketNews();
    }, []);
    
    const [selectedPfPlan, setSelectedPfPlan] = useState(null);
    
    const pfPlanData = [
        { id: "pf-plan-01", step: "01", name: "통합 PF 구조 확정", work: "427 본PF와 816 후속 PF를 통합 관점에서 연결", materials: "통합 자금구조표, 상환재원 표", counterparty: "주관기관 후보", target: "", next: "최종 엑셀 수령 후 구조표와 tranche sizing 연결" },
        { id: "pf-plan-02", step: "02", name: "Tranche sizing", work: "Senior, 중순위, 후순위, 주주대여금의 역할 구분", materials: "Capital stack, 대주별 조건표", counterparty: "대주단 / 증권사", target: "", next: "금액은 최종 엑셀 수령 후 반영" },
        { id: "pf-plan-03", step: "03", name: "주관·참여기관 협의", work: "대주단과의 구체적인 조건 협의", materials: "협의 메모, term sheet", counterparty: "KB, NH, 신한 등", target: "", next: "" },
        { id: "pf-plan-04", step: "04", name: "Term sheet 정리", work: "금융조건의 서면화 및 최종 조율", materials: "대출 조건표, 약정 주요 조건", counterparty: "대주단", target: "", next: "" },
        { id: "pf-plan-05", step: "05", name: "심의·승인 패키지", work: "대주단 내부 심의용 자료 작성", materials: "IM, 리스크심의, 사업계획, 모델", counterparty: "내부 심의 / 대주 심사", target: "", next: "" },
        { id: "pf-plan-06", step: "06", name: "약정서·담보 패키지", work: "대출약정서 및 제반 담보 계약 체결", materials: "약정서, 담보계약, 책임준공 관련 문서", counterparty: "법무 / 대주단 / 시공사", target: "", next: "" },
        { id: "pf-plan-07", step: "07", name: "기표 및 기존 대출 상환", work: "자금 집행 및 브릿지론 상환", materials: "기표 일정, 상환계획, 자금집행표", counterparty: "대리금융기관 / 대주단", target: "", next: "" }
    ];


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
                    const grouped = {
                        427: { Bridge: {}, Refinancing: {} },
                        421: { Current: {} },
                        816: { Bridge: {}, Refinancing: {} }
                    };

                    data.forEach(item => {
                        const v = parseInt(item.vehicle_name);
                        const p = item.phase;
                        let tranche = item.tranche_name;
                        let type = item.tranche_type;
                        let sortOrder = 0;
                        let originalTranche = tranche;

                        if ((v === 427 || v === 816) && (tranche === '1종 종류주 등' || tranche === '보통주' || tranche === '주주대여금' || tranche.includes('종류주'))) {
                            tranche = 'Equity';
                            type = 'Equity';
                            if (originalTranche === '주주대여금') {
                                sortOrder = 1;
                            }
                        }
                        if ((v === 427 || v === 816) && tranche === 'Tr.A-2') {
                            tranche = 'Tr.A-1';
                            sortOrder = 1;
                        }

                        if (v === 427 && tranche === 'Tr.B-2') {
                            tranche = 'Tr.B-1';
                            sortOrder = 1;
                        }

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
                                            i++; 
                                        }
                                    }
                                }
                                
                                if ((v === 427 || v === 816) && t === 'Tr.A-1') {
                                    let hasSubheader = false;
                                    for (let i = 0; i < arr.length; i++) {
                                        if (arr[i].originalTranche === 'Tr.A-2' && !hasSubheader) {
                                            arr.splice(i, 0, { isSubHeader: true, name: 'Tr.A-2' });
                                            hasSubheader = true;
                                            i++; 
                                        }
                                    }
                                }

                                if (v === 427 && t === 'Tr.B-1') {
                                    let hasSubheader = false;
                                    for (let i = 0; i < arr.length; i++) {
                                        if (arr[i].originalTranche === 'Tr.B-2' && !hasSubheader) {
                                            arr.splice(i, 0, { isSubHeader: true, name: 'Tr.B-2' });
                                            hasSubheader = true;
                                            i++; 
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
                console.error("Unhandled Exception:", error);
                setIotaData({ error: error.message || "오류" });
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

    const getTotal = (v, p = 'Current') => {
        let sum = 0;
        if (iotaData && iotaData[v] && iotaData[v][p]) {
            Object.values(iotaData[v][p]).forEach(trancheArray => {
                sum += trancheArray.reduce((a, b) => a + (parseFloat(b.rawAmount) || 0), 0);
            });
        }
        return sum;
    };

    const getTypeTotal = (v, p = 'Current', typeStr) => {
        let sum = 0;
        if (iotaData && iotaData[v] && iotaData[v][p]) {
            Object.values(iotaData[v][p]).forEach(trancheArray => {
                trancheArray.forEach(item => {
                    if (item.type === typeStr && !item.isSubHeader) sum += (parseFloat(item.rawAmount) || 0);
                });
            });
        }
        return sum;
    };

    const displayTotal427 = getTotal(427, 'Refinancing');
    const displayTotal816 = getTotal(816, 'Refinancing');
    const total421 = getTotal(421);
    
    const grandTotal = displayTotal427 + total421 + displayTotal816;

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

            {!loading && iotaData && !iotaData.error && (
                <div className="w-full mt-[24px] border-t border-[#3c3c3c] pt-[50px]">
                    <h2 className="text-[20px] font-bold text-white mb-[12px]">통합 Vehicle 파이낸싱 구조</h2>
                    <div className="p-6 bg-transparent border border-[#3c3c3c] rounded-[24px] flex gap-8 items-start">
                        <div className="w-[280px] shrink-0 flex flex-col">
                            <div className="text-[13px] font-bold text-[#86868B] uppercase mb-[10px]">Total Project Volume</div>
                            <div className="text-[32px] font-bold text-white leading-none tracking-tight pt-[6px]">{formatAmount(grandTotal)}</div>
                        </div>
                        
                        <div className="flex-1 flex flex-col">
                            <div className="flex gap-4 w-full">
                                {/* 427 PFV Box */}
                                <div className="flex-1 px-[20px] py-[16px] bg-[#151515] border border-transparent rounded-[16px] flex flex-col justify-between cursor-default transition-all">
                                    <span className="text-[14px] font-bold text-white tracking-tight mb-[12px]">427 PFV</span>
                                    <div className="flex flex-col gap-[6px]">
                                        <div className="flex justify-between items-center text-[13px]">
                                            <span className="text-[#86868B]">Equity</span>
                                            <span className="text-[#E5E5E5] font-semibold">{formatAmount(getTypeTotal(427, 'Refinancing', 'Equity'))}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[13px]">
                                            <span className="text-[#86868B]">Loan</span>
                                            <span className="text-[#E5E5E5] font-semibold">{formatAmount(getTypeTotal(427, 'Refinancing', 'Loan'))}</span>
                                        </div>
                                        <div className="border-t border-[#333] pt-[10px] mt-[6px] flex justify-between items-end">
                                            <span className="text-[13px] text-[#86868B] font-medium leading-none mb-[2px]">Total</span>
                                            <span className="text-[20px] font-bold text-white tracking-tight leading-none">{formatAmount(displayTotal427)}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* 816 PFV Box */}
                                <div className="flex-1 px-[20px] py-[16px] bg-[#151515] border border-transparent rounded-[16px] flex flex-col justify-between cursor-default transition-all">
                                    <span className="text-[14px] font-bold text-white tracking-tight mb-[12px]">816 PFV</span>
                                    <div className="flex flex-col gap-[6px]">
                                        <div className="flex justify-between items-center text-[13px]">
                                            <span className="text-[#86868B]">Equity</span>
                                            <span className="text-[#E5E5E5] font-semibold">{formatAmount(getTypeTotal(816, 'Refinancing', 'Equity'))}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[13px]">
                                            <span className="text-[#86868B]">Loan</span>
                                            <span className="text-[#E5E5E5] font-semibold">{formatAmount(getTypeTotal(816, 'Refinancing', 'Loan'))}</span>
                                        </div>
                                        <div className="border-t border-[#333] pt-[10px] mt-[6px] flex justify-between items-end">
                                            <span className="text-[13px] text-[#86868B] font-medium leading-none mb-[2px]">Total</span>
                                            <span className="text-[20px] font-bold text-white tracking-tight leading-none">{formatAmount(displayTotal816)}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* 421 Fund Box */}
                                <div className="flex-1 px-[20px] py-[16px] bg-[#151515] border border-transparent rounded-[16px] flex flex-col justify-between cursor-default transition-all">
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

                    <div className="w-full h-[44px]"></div>

                    {/* 월별 이자 발생 시계열 */}
                    <div className="w-full mb-[40px]">
                        <h2 className="text-[20px] font-bold text-white mb-[12px] uppercase tracking-tight">월별 이자 발생 시계열</h2>
                        <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-[24px] p-[32px] h-[320px] relative overflow-hidden flex items-end justify-between px-[60px]">
                            {/* Dummy Y-axis labels */}
                            <div className="absolute left-[20px] top-[24px] bottom-[40px] flex flex-col justify-between text-[11px] text-[#666] font-['Inter'] pointer-events-none">
                                <span>300억</span>
                                <span>150억</span>
                                <span>0</span>
                            </div>
                            
                            {/* Dummy Bar Chart */}
                            {[...Array(12)].map((_, i) => {
                                const isProjected = i >= 3;
                                const trA = isProjected ? 0 : 80 + Math.random() * 20;
                                const trB = isProjected ? 0 : 30 + Math.random() * 10;
                                const trC = isProjected ? 0 : 15 + Math.random() * 5;
                                const totalH = trA + trB + trC;
                                
                                return (
                                    <div key={i} className="flex flex-col items-center gap-[12px] h-full justify-end w-[40px] group">
                                        <div className={`w-full flex flex-col justify-end gap-[1px] ${isProjected ? 'opacity-20' : ''} transition-opacity cursor-crosshair`} style={{height: '220px'}}>
                                            {isProjected ? (
                                                <div className="w-full h-[20px] bg-[#333] rounded-t-[4px]" title={`${i+1}월 - 입력 대기`}></div>
                                            ) : (
                                                <>
                                                    <div className="w-full bg-[#b889d9] rounded-t-[4px]" style={{height: `${trC}%`}} title={`Tr.C 이자: ${trC.toFixed(0)}억`}></div>
                                                    <div className="w-full bg-[#3aaab3]" style={{height: `${trB}%`}} title={`Tr.B 이자: ${trB.toFixed(0)}억`}></div>
                                                    <div className="w-full bg-[#5da0e7]" style={{height: `${trA}%`}} title={`Tr.A 이자: ${trA.toFixed(0)}억`}></div>
                                                </>
                                            )}
                                        </div>
                                        <span className="text-[12px] text-[#86868B] font-['Inter'] font-medium tracking-tighter">{`${26 + Math.floor((i + 3) / 12)}-${String(((i + 3) % 12) + 1).padStart(2, '0')}`}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-[12px] text-[#666] mt-[12px] ml-[8px] transform -translate-y-[1px]">금리·실행일·만기 입력 시 월별 발생액이 표시됩니다. (현재 UI 예시용 데이터 적용)</p>
                    </div>

                    {/* 본 PF 계획(통합 PF) */}
                    <div className="w-full mb-[40px]">
                        <h2 className="text-[20px] font-bold text-white mb-[12px] uppercase tracking-tight">본 PF 계획(통합 PF)</h2>
                        
                        <div className="w-full bg-[#1A1A1A] border border-[#3c3c3c] rounded-[24px] overflow-hidden p-[32px]">
                            <div className="flex justify-between items-center mb-[24px]">
                                <strong className="text-white text-[16px] font-bold tracking-tight">본 PF 전환 준비사항</strong>
                                <span className="text-[#86868B] text-[13px] font-bold">통합 기준</span>
                            </div>
                            
                            {/* Stepper Rail */}
                            <div className="flex gap-[12px] overflow-x-auto pb-[20px] mb-[12px] scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
                                {pfPlanData.map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => setSelectedPfPlan(item)}
                                        className={`flex-shrink-0 w-[180px] h-[90px] border ${idx === 1 ? 'border-[#86868B] bg-[#222]' : 'border-[#333] bg-[#151515] hover:bg-[#1f1f1f]'} rounded-[12px] p-[16px] flex flex-col justify-between cursor-pointer transition-colors`}
                                    >
                                        <div className="text-[11px] font-bold text-[#86868B] font-['Inter']">STEP {item.step}</div>
                                        <div className="text-[14px] font-bold text-white leading-tight break-keep">{item.name}</div>
                                    </div>
                                ))}
                            </div>
                            
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr>
                                        <th className="px-[12px] py-[16px] text-[#86868B] font-bold text-[13px] border-b border-[#3c3c3c]">단계</th>
                                        <th className="px-[12px] py-[16px] text-[#86868B] font-bold text-[13px] border-b border-[#3c3c3c]">업무</th>
                                        <th className="px-[12px] py-[16px] text-[#86868B] font-bold text-[13px] border-b border-[#3c3c3c]">필요 자료</th>
                                        <th className="px-[12px] py-[16px] text-[#86868B] font-bold text-[13px] border-b border-[#3c3c3c]">카운터파티</th>
                                        <th className="px-[12px] py-[16px] text-[#86868B] font-bold text-[13px] border-b border-[#3c3c3c]">목표 일정</th>
                                        <th className="px-[12px] py-[16px] text-[#86868B] font-bold text-[13px] border-b border-[#3c3c3c] text-center w-[80px]">상세</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pfPlanData.map((item, idx) => (
                                        <tr key={idx} className="border-b border-[#333] last:border-b-0 hover:bg-[#252525] transition-colors cursor-pointer group" onClick={() => setSelectedPfPlan(item)}>
                                            <td className="px-[12px] py-[16px] text-[#E5E5E5] font-['Inter'] text-[14px]">{item.step}</td>
                                            <td className="px-[12px] py-[16px] text-white font-bold text-[14px]">{item.name}</td>
                                            <td className="px-[12px] py-[16px] text-[#A1A1AA] text-[13px]">{item.materials}</td>
                                            <td className="px-[12px] py-[16px] text-[#A1A1AA] text-[13px]">{item.counterparty}</td>
                                            <td className="px-[12px] py-[16px] text-[#A1A1AA] text-[13px] font-['Inter']">{item.target}</td>
                                            <td className="px-[12px] py-[16px] text-center">
                                                <button className="px-[14px] py-[6px] border border-[#444] text-[#A1A1AA] rounded-full text-[12px] group-hover:bg-[#333] group-hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); setSelectedPfPlan(item); }}>상세</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 시장 이슈 모니터링 */}
                    <div className="w-full mb-[30px]">
                        <div className="flex justify-between items-end mb-[12px]">
                            <h2 className="text-[20px] font-bold text-white uppercase tracking-tight">시장 이슈 모니터링</h2>
                            <button 
                                onClick={fetchMarketNews}
                                disabled={newsLoading}
                                className="px-[16px] py-[8px] bg-transparent border border-[#444] text-[#E5E5E5] rounded-[10px] text-[13px] font-bold hover:bg-[#333] transition-colors disabled:opacity-50 flex items-center gap-[6px]"
                            >
                                {newsLoading ? (
                                    <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    <svg className="w-[12px] h-[12px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                                )}
                                뉴스 업데이트
                            </button>
                        </div>
                        
                        <div className="w-full bg-transparent border border-[#3c3c3c] rounded-[24px] p-[32px] flex gap-[32px]">
                            {/* Sidebar Filters */}
                            <div className="w-[200px] shrink-0 flex flex-col">
                                                                <select 
                                    value={selectedLender} 
                                    onChange={(e) => setSelectedLender(e.target.value)}
                                    className="w-full bg-[#1A1A1A] border border-[#444] text-white text-[14px] rounded-[12px] px-[16px] py-[10px] outline-none hover:border-[#555] transition-colors focus:border-[#0a84ff] appearance-none"
                                    style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg fill="none" stroke="%2386868B" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '16px' }}
                                >
                                    <option value="전체 대주">전체 대주</option>
                                    {marketNews?.items?.map((g, i) => (
                                        <option key={i} value={g.lender}>{g.lender}</option>
                                    ))}
                                </select>
                                <div className="mt-[20px] text-[#666] text-[13px] font-['Inter'] leading-[22px]">
                                    뉴스 {marketNews?.generatedAt ? new Date(marketNews.generatedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'} <br/>
                                    확인 {new Date().toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} <br/>
                                    통합 · 실시간 크롤링
                                </div>
                            </div>

                            {/* News List */}
                            <div className="flex-1 flex flex-col gap-[16px]">
                                {marketNews ? (
                                    marketNews.items
                                        .filter(g => selectedLender === '전체 대주' || g.lender === selectedLender)
                                        .flatMap(g => g.articles.map(a => ({ ...a, lender: g.lender })))
                                        .sort((a,b) => new Date(b.date) - new Date(a.date))
                                        .map((article, idx) => (
                                            <a key={idx} href={article.url} target="_blank" rel="noreferrer" className="w-full bg-[#1A1A1A] border border-[#333] rounded-[16px] p-[20px] flex flex-col hover:border-[#555] hover:bg-[#222] transition-all group">
                                                <div className="flex items-center gap-[10px] mb-[8px]">
                                                    <span className="bg-[#2a2a2c] border border-[#444] text-[#A1A1AA] text-[11px] font-bold px-[8px] py-[2px] rounded-full">{article.lender}</span>
                                                    <span className="text-[#666] text-[12px] font-['Inter']">{article.date} · {article.publisher}</span>
                                                </div>
                                                <h3 className="text-white text-[15px] font-bold leading-snug group-hover:text-[#0a84ff] transition-colors">{article.title}</h3>
                                            </a>
                                        ))
                                ) : (
                                    <div className="w-full h-[200px] flex items-center justify-center text-[#666] text-[14px]">
                                        데이터를 불러오는 중입니다...
                                    </div>
                                )}
                                {marketNews && marketNews.items.filter(g => selectedLender === '전체 대주' || g.lender === selectedLender).flatMap(g => g.articles).length === 0 && (
                                    <div className="w-full h-[100px] flex items-center justify-center text-[#666] text-[14px]">
                                        해당 대주의 최근 크롤링 뉴스가 없습니다.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            )}
            {/* PF Plan Modal */}
            {selectedPfPlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPfPlan(null)}>
                    <div className="bg-[#151515] border border-[#333] rounded-[24px] w-full max-w-[480px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-[24px] border-b border-[#333] flex justify-between items-start">
                            <div>
                                <h3 className="text-[20px] font-bold text-white tracking-tight mb-[4px]">본 PF 계획 · STEP {selectedPfPlan.step}</h3>
                                <div className="text-[14px] text-[#86868B]">{selectedPfPlan.name}</div>
                            </div>
                            <button 
                                className="w-[32px] h-[32px] rounded-full border border-[#444] text-[#86868B] hover:text-white hover:bg-[#333] flex items-center justify-center transition-colors"
                                onClick={() => setSelectedPfPlan(null)}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-[24px] overflow-y-auto flex flex-col gap-[16px]">
                            <div className="bg-[#1A1A1A] border border-[#333] rounded-[16px] p-[20px]">
                                <h4 className="text-[14px] font-bold text-white mb-[16px]">업무 정의</h4>
                                <div className="flex flex-col gap-[12px]">
                                    <div className="flex text-[13px]"><span className="text-[#86868B] w-[80px] shrink-0 font-medium">단계</span><span className="text-[#E5E5E5] font-['Inter']">{selectedPfPlan.step}</span></div>
                                    <div className="flex text-[13px]"><span className="text-[#86868B] w-[80px] shrink-0 font-medium">업무</span><span className="text-[#E5E5E5]">{selectedPfPlan.work || "-"}</span></div>
                                    <div className="flex text-[13px]"><span className="text-[#86868B] w-[80px] shrink-0 font-medium">필요 자료</span><span className="text-[#E5E5E5]">{selectedPfPlan.materials || "-"}</span></div>
                                    <div className="flex text-[13px]"><span className="text-[#86868B] w-[80px] shrink-0 font-medium">카운터파티</span><span className="text-[#E5E5E5]">{selectedPfPlan.counterparty || "-"}</span></div>
                                    <div className="flex text-[13px]"><span className="text-[#86868B] w-[80px] shrink-0 font-medium">목표 일정</span><span className="text-[#E5E5E5]">{selectedPfPlan.target || "-"}</span></div>
                                </div>
                            </div>
                            {selectedPfPlan.next && (
                                <div className="bg-[#1A1A1A] border border-[#333] rounded-[16px] p-[20px]">
                                    <h4 className="text-[14px] font-bold text-white mb-[8px]">다음 액션</h4>
                                    <p className="text-[13px] text-[#E5E5E5] leading-relaxed">{selectedPfPlan.next}</p>
                                </div>
                            )}
                            <div className="bg-[#1A1A1A] border border-[#333] rounded-[16px] p-[20px]">
                                <h4 className="text-[14px] font-bold text-white mb-[8px]">LFC 관리 포인트</h4>
                                <p className="text-[13px] text-[#E5E5E5] leading-relaxed">본 PF 계획은 통합 PF 기준의 준비 업무만 이 컴포넌트에서 관리하고, 세부 협의 이력은 상단 LFC 업무 로그에 남기는 구조입니다.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}