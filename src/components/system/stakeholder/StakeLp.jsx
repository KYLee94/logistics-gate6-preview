import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../../utils/supabaseClient';

const getTrancheColor = (trancheName) => {
    if (!trancheName) return 'text-[#86868B]';
    if (trancheName.includes('Equity') || trancheName.includes('보통주') || (trancheName.includes('종류주') && !trancheName.includes('수익증권')) || trancheName.includes('주주대여금')) return 'text-[#e5e5e5]';
    if (trancheName.includes('Tr.A') || trancheName.includes('Tr. A') || trancheName.includes('A종')) return 'text-[#5da0e7]';
    if (trancheName.includes('Tr.B') || trancheName.includes('Tr. B') || trancheName.includes('B종')) return 'text-[#3aaab3]';
    if (trancheName.includes('Tr.C') || trancheName.includes('Tr. C') || trancheName.includes('C종')) return 'text-[#b889d9]';
    if (trancheName.includes('Tr.D') || trancheName.includes('Tr. D') || trancheName.includes('D종')) return 'text-[#cd879c]';
    return 'text-[#86868B]';
};

const formatTrancheName = (name) => {
    if (!name) return '';
    if (name.includes('A종 수익증권')) return 'Tr.A';
    if (name.includes('B종 수익증권')) return 'Tr.B';
    if (name.includes('C종 수익증권')) return 'Tr.C';
    if (name.includes('D종 수익증권')) return 'Tr.D';
    return name;
};

const formatKoreanAmount = (amountStrOrNum) => {
    if (!amountStrOrNum) return '0억';
    let numStr = String(amountStrOrNum).replace(/,/g, '').replace('억', '').replace(' ', '');
    let num = Number(numStr);
    if (isNaN(num)) return amountStrOrNum;
    
    if (num >= 10000) {
        const jo = Math.floor(num / 10000);
        const uk = Math.floor(num % 10000);
        if (uk === 0) return `${jo}조원`;
        return `${jo}조 ${uk.toLocaleString()}억`;
    }
    return `${num.toLocaleString()}억`;
};

const AccordionContent = ({ instName, contactsCache, metaCache, isLast, isMaster = false, iotaInvestments = [], igisInvestments = [] }) => {
    const contacts = contactsCache[instName];
    const metaData = metaCache ? metaCache[instName] : undefined;
    const meta = metaData?.investment || [];
    const historyMeta = metaData?.history || [];
    return (
        <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className={`overflow-hidden bg-transparent border-x border-b border-[#3c3c3c] -mt-[1px] ${isLast ? 'rounded-b-[12px]' : ''}`}
        >
            <div className="p-6 grid grid-cols-2 gap-8">
                {isMaster ? (
                    <>
                        {/* Master Investors Layout */}
                        <div className="flex flex-col gap-6">
                            <div>
                                <h4 className="text-[14px] font-bold text-[#86868B] mb-4 uppercase">Investment Profile (투자 현황)</h4>
                                {!metaData ? (
                                    <div className="text-[13px] text-[#A1A1AA]">데이터 연동 중...</div>
                                ) : meta.length > 0 ? (
                                    <div className="flex flex-col gap-4">
                                        {meta.map((m, i) => (
                                            <div key={i} className="flex flex-col pb-4 border-b border-[#333] last:border-0">
                                                <div className="flex items-baseline gap-2 mb-1.5">
                                                    <div className="text-[14px] font-bold text-white">{m.name}</div>
                                                    {m.department && m.department !== '0' && (
                                                        <div className="text-[14px] text-white">
                                                            {formatKoreanAmount(m.department)}
                                                        </div>
                                                    )}
                                                </div>
                                                {m.title && <div className="text-[13px] text-[#A1A1AA] leading-relaxed whitespace-pre-line">{m.title}</div>}
                                                {m.email && <div className="text-[13px] text-[#A1A1AA] leading-relaxed whitespace-pre-line">{m.email}</div>}
                                                {m.mobile && <div className="text-[13px] text-[#A1A1AA] leading-relaxed whitespace-pre-line">{m.mobile}</div>}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-[13px] text-[#A1A1AA]">
                                        등록된 투자 현황이 없습니다.
                                    </div>
                                )}

                                {iotaInvestments.length > 0 && (
                                    <div className="flex flex-col gap-2 mt-4 pt-5 border-t border-[#333]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="text-[13px] font-bold text-[#86868B] uppercase">IOTA 프로젝트 투자 현황</div>
                                        </div>
                                        {iotaInvestments.map((inv, idx) => (
                                            <div key={`inv-${idx}`} className="flex justify-between items-center text-[13px] py-1 border-b border-[#333] border-dashed last:border-0">
                                                <span className="text-[#A1A1AA]">{inv.label}</span>
                                                <span className="text-white font-bold">{formatKoreanAmount(inv.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {igisInvestments.length > 0 && (
                                    <div className="flex flex-col gap-2 mt-4 pt-5 border-t border-[#333]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="text-[13px] font-bold text-[#86868B] uppercase">이지스 펀드 약정 현황</div>
                                            <div className="text-[11px] text-[#555] px-2 py-0.5 border border-[#333] rounded-full">전체</div>
                                        </div>
                                        {igisInvestments.slice(0, 15).map((inv, idx) => (
                                            <div key={`igis-inv-${idx}`} className="flex justify-between items-center text-[13px] py-1 border-b border-[#333] border-dashed last:border-0">
                                                <span className="text-[#A1A1AA]">{inv.fund}</span>
                                                <span className="text-white font-bold">{formatKoreanAmount(Math.floor(inv.amount / 100000000))}</span>
                                            </div>
                                        ))}
                                        {igisInvestments.length > 15 && (
                                            <div className="text-center text-[12px] text-[#555] mt-2">
                                                외 {igisInvestments.length - 15}개 펀드 (생략)
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-6">
                            <div>
                                <h4 className="text-[14px] font-bold text-[#86868B] mb-3 uppercase">Key Contacts (CRM)</h4>
                                <div className="text-[13px] text-[#A1A1AA] p-4 bg-transparent rounded-xl border border-dashed border-[#444] text-center h-[80px] flex items-center justify-center">
                                    연락처 정보 구조화 진행중
                                </div>
                            </div>
                            
                            <div>
                                <h4 className="text-[14px] font-bold text-[#86868B] mb-3 uppercase">소통 히스토리 & Notes</h4>
                                {historyMeta.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {historyMeta.map((h, i) => (
                                            <div key={i} className="p-4 bg-transparent rounded-xl border border-[#333]">
                                                {h.name && <div className="text-[13px] font-bold text-[#34d399] mb-1">[{h.name}]</div>}
                                                {h.title && <div className="text-[12px] text-[#A1A1AA] mb-2 font-medium">참석자: {h.title}</div>}
                                                {h.email && <div className="text-[13px] text-white leading-relaxed whitespace-pre-line mb-2">{h.email}</div>}
                                                {h.mobile && <div className="text-[13px] text-[#A1A1AA] leading-relaxed whitespace-pre-line">{h.mobile}</div>}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 bg-transparent rounded-xl border border-dashed border-[#444] h-[120px] flex items-center justify-center">
                                        <span className="text-[13px] text-[#555]">최근 미팅 노트 연동 준비중</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* IOTA Investors Layout (Original Reverted) */}
                        <div>
                            <h4 className="text-[14px] font-bold text-[#86868B] mb-3 uppercase">Key Contacts (CRM)</h4>
                            {!contacts ? (
                                <div className="text-[13px] text-[#A1A1AA]">데이터 연동 중...</div>
                            ) : contacts.length > 0 ? (
                                <div className="flex flex-col gap-3">
                                    {contacts.map((c, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 bg-[#1e1e1e] rounded-xl border border-[#333]">
                                            <div className="w-10 h-10 rounded-full bg-[#111] flex items-center justify-center text-[14px] font-bold text-white border border-[#444]">
                                                {c.name.substring(0,1)}
                                            </div>
                                            <div>
                                                <div className="text-[14px] font-bold text-white">{c.name} <span className="text-[#A1A1AA] font-normal text-[13px] ml-1">{c.title}</span></div>
                                                <div className="text-[12px] text-[#86868B] mt-0.5">{c.department} | {c.mobile} | {c.email}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-[13px] text-[#A1A1AA] p-4 bg-[#1e1e1e] rounded-xl border border-[#333] text-center">
                                    등록된 CRM 정보가 없습니다.
                                </div>
                            )}
                        </div>
                        
                        <div>
                            <h4 className="text-[14px] font-bold text-[#86868B] mb-3 uppercase">소통 히스토리 & Notes</h4>
                            {historyMeta.length > 0 ? (
                                <div className="flex flex-col gap-3">
                                    {historyMeta.map((h, i) => (
                                        <div key={i} className="p-4 bg-[#1e1e1e] rounded-xl border border-[#333]">
                                            {h.name && <div className="text-[13px] font-bold text-[#34d399] mb-1">[{h.name}]</div>}
                                            {h.title && <div className="text-[12px] text-[#A1A1AA] mb-2 font-medium">참석자: {h.title}</div>}
                                            {h.email && <div className="text-[13px] text-white leading-relaxed whitespace-pre-line mb-2">{h.email}</div>}
                                            {h.mobile && <div className="text-[13px] text-[#A1A1AA] leading-relaxed whitespace-pre-line">{h.mobile}</div>}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 bg-[#1e1e1e] rounded-xl border border-[#333] h-[120px] flex items-center justify-center">
                                    <span className="text-[13px] text-[#555]">최근 미팅 노트 연동 준비중</span>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </motion.div>
    );
};

const TransparentTable = ({ title, items, bridgeItems, refiItems, isLoan, vehicle, expandedRow, toggleRow, contactsCache, metaCache }) => {
    const [showAll, setShowAll] = useState(false);
    const [activePhase, setActivePhase] = useState('refi');
    
    const hasToggle = isLoan && bridgeItems && refiItems;
    let currentItems = items;
    if (hasToggle) {
        currentItems = activePhase === 'refi' ? refiItems : bridgeItems;
    }
    
    const displayItems = showAll ? currentItems : currentItems.slice(0, 5);

    const bridgeLabel = "기존 브릿지 대출";
    const refiLabel = vehicle === 427 ? "본PF 1차" : "금번 리파이낸싱";
    const refiDate = vehicle === 427 ? "2025.05" : "2026.05.24";

    return (
        <div className="mb-10">
            <div className="flex justify-between items-end mb-3 pl-2 pr-1">
                <h3 className="text-[16px] font-bold text-white flex items-center gap-2 m-0 leading-none pb-2">
                    <span className={`w-2 h-2 rounded-full ${isLoan ? 'bg-[#0A84FF]' : 'bg-[#34d399]'}`}></span>
                    {title}
                </h3>
                
                <div className="flex items-center gap-[10px]">
                    {/* Toggle Buttons */}
                    {hasToggle && (
                        <div className="flex bg-[#1a1a1a] rounded-[10px] p-[3px] border border-[#2c2c2e] relative items-center h-[34px]">
                            <button
                                onClick={() => { setActivePhase('bridge'); setShowAll(false); }}
                                className={`cursor-pointer px-4 h-full text-[13px] rounded-[7px] transition-colors ${activePhase === 'bridge' ? 'bg-[#2c2c2e] text-white font-medium shadow-sm' : 'text-[#86868B] hover:text-white'}`}
                            >
                                {bridgeLabel}
                            </button>
                            <div className="relative h-full flex">
                                <div className="absolute -top-[21px] left-1/2 -translate-x-1/2 text-[12px] text-[#86868B] font-medium tracking-tight whitespace-nowrap">
                                    {refiDate}
                                </div>
                                <button
                                    onClick={() => { setActivePhase('refi'); setShowAll(false); }}
                                    className={`cursor-pointer px-4 h-full text-[13px] rounded-[7px] transition-colors ${activePhase === 'refi' ? 'bg-[#2c2c2e] text-[#0A84FF] font-medium shadow-sm' : 'text-[#86868B] hover:text-white'}`}
                                >
                                    {refiLabel}
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* View All Button */}
                    <button 
                        onClick={() => setShowAll(!showAll)}
                        className="cursor-pointer text-[13px] font-medium text-[#86868B] hover:text-white transition-colors flex items-center justify-center bg-[#1a1a1a] hover:bg-[#2c2c2e] w-[72px] h-[34px] rounded-[10px] border border-[#2c2c2e]"
                    >
                        {showAll ? '접기' : '전체보기'}
                    </button>
                </div>
            </div>
            <div className="w-full">
                {displayItems.length > 0 ? displayItems.map((item, idx) => {
                    const uniqueKey = `${vehicle}-${isLoan ? 'loan' : 'equity'}-${item.name}-${item.rawAmount}-${idx}`;
                    const isExpanded = expandedRow === uniqueKey;
                    const isLastItem = idx === displayItems.length - 1;
                    
                    return (
                        <div key={idx} className="flex flex-col">
                            <div 
                                onClick={() => toggleRow(uniqueKey, item.name)}
                                className={`flex items-center justify-between px-5 py-[13px] cursor-pointer transition-colors border border-[#3c3c3c] bg-transparent
                                    ${idx === 0 ? 'rounded-t-[12px]' : ''} 
                                    ${isLastItem && !isExpanded ? 'rounded-b-[12px]' : ''}
                                    ${idx !== 0 ? '-mt-[1px]' : ''}
                                    ${isExpanded ? 'border-b-transparent z-10' : 'hover:bg-[#222]'}
                                `}
                            >
                                <div className="flex items-center gap-4">
                                    <span className="text-[15px] font-medium text-white">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-6">
                                    {item.tranche && (
                                        <span className={`text-[12px] font-medium tracking-tight ${getTrancheColor(item.tranche)}`}>{item.tranche}</span>
                                    )}
                                    <span className="text-[15px] font-bold text-white text-right w-[90px]">{item.amount}억</span>
                                    <svg className={`w-4 h-4 text-[#86868B] transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                                </div>
                            </div>
                            <AnimatePresence>
                                {isExpanded && <AccordionContent instName={item.name} contactsCache={contactsCache} metaCache={metaCache} isLast={isLastItem} isMaster={false} />}
                            </AnimatePresence>
                        </div>
                    );
                }) : (
                    <div className="px-5 py-4 border border-[#3c3c3c] rounded-[12px] text-[14px] text-[#A1A1AA] text-center">데이터 없음</div>
                )}
            </div>
        </div>
    );
};

export default function StakeLp() {
    const [searchTerm, setSearchTerm] = useState('');
    const [otherInvestors, setOtherInvestors] = useState([]);
    const [iotaData, setIotaData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState(null); // { name: string }
    const [contactsCache, setContactsCache] = useState({});
    const [metaCache, setMetaCache] = useState({});
    const [igisInvestmentsData, setIgisInvestmentsData] = useState({});

    // Fetch master DB for "Other Investors" and IOTA Stack
    useEffect(() => {
        const fetchMaster = async () => {
            try {
                // Fetch IOTA Capital Stack
                const { data: stackData } = await supabase.from('iota_capital_stack').select('*');
                
                let parsedIota = {
                    427: { equity: [], loan: [], bridgeLoan: [], refiLoan: [] },
                    816: { equity: [], loan: [], bridgeLoan: [], refiLoan: [] },
                    421: { equity: [], loan: [] }
                };

                if (stackData) {
                    stackData.forEach(item => {
                        const v = parseInt(item.vehicle_name);
                        let type = item.tranche_type === 'Equity' ? 'equity' : 'loan';
                        
                        // Hardcode override: 816호의 이지스421호(2400억)는 주주대여금이므로 Equity로 처리
                        if (v === 816 && item.institution_name === '이지스421호') {
                            type = 'equity';
                        }
                        
                        const obj = {
                            name: item.institution_name,
                            amount: item.amount_krw_100m.toLocaleString(),
                            rawAmount: item.amount_krw_100m,
                            tranche: formatTrancheName(item.tranche_name)
                        };

                        if (type === 'equity') {
                            if (v === 816 && item.phase !== 'Refinancing') return;
                            if (v === 427 && item.phase !== 'Refinancing') return;
                            if (parsedIota[v] && parsedIota[v].equity) parsedIota[v].equity.push(obj);
                        } else {
                            if (v === 427 || v === 816) {
                                if (item.phase === 'Bridge') parsedIota[v].bridgeLoan.push(obj);
                                if (item.phase === 'Refinancing') parsedIota[v].refiLoan.push(obj);
                            } else {
                                if (parsedIota[v] && parsedIota[v].loan) parsedIota[v].loan.push(obj);
                            }
                        }
                    });
                    
                    // Sort descending by amount
                    [427, 816].forEach(v => {
                        ['equity', 'bridgeLoan', 'refiLoan'].forEach(t => {
                            parsedIota[v][t].sort((a, b) => b.rawAmount - a.rawAmount);
                        });
                    });
                    ['equity', 'loan'].forEach(t => {
                        parsedIota[421][t].sort((a, b) => b.rawAmount - a.rawAmount);
                    });
                }
                setIotaData(parsedIota);

                // Fetch counterparties
                const { data: cps } = await supabase.from('counterparties').select('counterparty_id, name, category');
                // Fetch exposures
                const { data: exps } = await supabase.from('beneficiary_exposures').select('beneficiary_clean, beneficiary_raw, committed_amt, funds(short_name)');
                
                if (cps && exps && parsedIota) {
                    const amounts = {};
                    const igisInv = {};
                    exps.forEach(ex => {
                        const name = ex.beneficiary_clean || ex.beneficiary_raw;
                        if (name && ex.committed_amt) {
                            const amt = parseInt(ex.committed_amt);
                            amounts[name] = (amounts[name] || 0) + amt;
                            
                            if (ex.funds && ex.funds.short_name) {
                                if (!igisInv[name]) igisInv[name] = [];
                                igisInv[name].push({
                                    fund: `이지스${ex.funds.short_name}`,
                                    amount: amt
                                });
                            }
                        }
                    });

                    // Sort investments
                    Object.keys(igisInv).forEach(k => {
                        igisInv[k].sort((a, b) => b.amount - a.amount);
                    });
                    setIgisInvestmentsData(igisInv);

                    // List of IOTA names to exclude from "Other"
                    const iotaNames = new Set([
                        ...parsedIota[427].equity.map(i=>i.name), ...parsedIota[427].bridgeLoan.map(i=>i.name), ...parsedIota[427].refiLoan.map(i=>i.name),
                        ...parsedIota[816].equity.map(i=>i.name), ...parsedIota[816].bridgeLoan.map(i=>i.name), ...parsedIota[816].refiLoan.map(i=>i.name),
                        ...parsedIota[421].equity.map(i=>i.name), ...parsedIota[421].loan.map(i=>i.name)
                    ]);

                    const others = cps
                        .filter(cp => cp.name && !iotaNames.has(cp.name))
                        .map(cp => ({
                            ...cp,
                            total_amt: amounts[cp.name] || 0
                        }))
                        .filter(cp => cp.total_amt > 0)
                        .sort((a, b) => b.total_amt - a.total_amt)
                        .slice(0, 50); // Limit for performance

                    setOtherInvestors(others);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchMaster();
    }, []);

    useEffect(() => {
        if (!loading && window.location.hash) {
            const id = window.location.hash.substring(1);
            setTimeout(() => {
                const element = document.getElementById(id);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }
    }, [loading]);

    const fetchContacts = async (instName) => {
        if (contactsCache[instName]) return;
        
        try {
            let keyword = instName.split('(')[0].replace(' 펀드', '').trim();
            
            // Alias map for institutions where Excel name differs from DB name
            const aliases = {
                '농업협동조합중앙회': '농협중앙회'
            };
            if (aliases[keyword]) {
                keyword = aliases[keyword];
            }

            const { data: cps } = await supabase.from('counterparties').select('counterparty_id').ilike('name', `%${keyword}%`);
            
            if (cps && cps.length > 0) {
                const cpIds = cps.map(c => c.counterparty_id);
                const { data: ctData } = await supabase.from('counterparty_contacts').select('*').in('counterparty_id', cpIds);
                
                const validContacts = [];
                const investmentMeta = [];
                const historyMeta = [];

                (ctData || []).forEach(c => {
                    const name = c.name || '';
                    const title = c.title || '';
                    
                    // Exclude Table Headers
                    if (name.includes('투자자 참석자') || name.includes('당사 참석자') || name.includes('주요 회의록')) return;

                    // 1. Is Investment Profile?
                    const investmentKeywords = ['AUM', '펀드', '위탁', '운용자산', '모펀드', '규모', '조원', '부동산', '투자부', '대체투자', '전체'];
                    if (investmentKeywords.some(w => name.includes(w))) {
                        investmentMeta.push(c);
                        return;
                    }

                    // 2. Is Meeting History?
                    if (
                        (c.mobile && c.mobile.length > 20) || 
                        (c.email && c.email.length > 20 && !c.email.includes('@')) ||
                        name.length > 15 || title.length > 20
                    ) {
                        historyMeta.push(c);
                        return;
                    }

                    // 3. Otherwise, check if it's a valid contact
                    validContacts.push(c);
                });

                setContactsCache(prev => ({ ...prev, [instName]: validContacts }));
                setMetaCache(prev => ({ ...prev, [instName]: { investment: investmentMeta, history: historyMeta } }));
            } else {
                setContactsCache(prev => ({ ...prev, [instName]: [] }));
                setMetaCache(prev => ({ ...prev, [instName]: null }));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const getIotaInvestments = (instName) => {
        if (!iotaData) return [];
        const results = [];
        
        const checkPhase = (vehicle, phaseName, prefix) => {
            if (iotaData[vehicle] && iotaData[vehicle][phaseName]) {
                const match = iotaData[vehicle][phaseName].find(i => i.name === instName);
                if (match) {
                    const label = `IOTA ${vehicle} • ${prefix}${match.tranche ? ` • ${match.tranche}` : ''}`;
                    results.push({ label, amount: match.rawAmount || parseInt(String(match.amount || '0').replace(/,/g, '')) });
                }
            }
        };

        checkPhase(427, 'equity', 'Equity');
        checkPhase(427, 'bridgeLoan', '기존 브릿지');
        checkPhase(427, 'refiLoan', '본PF 1차');
        
        checkPhase(816, 'equity', 'Equity');
        checkPhase(816, 'bridgeLoan', '기존 브릿지');
        checkPhase(816, 'refiLoan', '금번 리파이낸싱');
        
        checkPhase(421, 'equity', '수익증권');
        checkPhase(421, 'loan', '대출');

        return results;
    };

    const toggleRow = (uniqueKey, instName) => {
        if (expandedRow === uniqueKey) {
            setExpandedRow(null);
        } else {
            setExpandedRow(uniqueKey);
            fetchContacts(instName);
        }
    };

    // Filter logic
    const isSearching = searchTerm.trim().length > 0;
    
    // Get all items that match the search
    const getSearchResults = () => {
        if (!isSearching) return [];
        const term = searchTerm.toLowerCase();
        
        const results = [];
        
        // Search in IOTA data
        if (iotaData) {
            [427, 816, 421].forEach(vehicle => {
                const types = vehicle === 421 ? ['equity', 'loan'] : ['equity', 'bridgeLoan', 'refiLoan'];
                types.forEach(type => {
                    if (iotaData[vehicle][type]) {
                        iotaData[vehicle][type].forEach(item => {
                            if (item.name && item.name.toLowerCase().includes(term)) {
                                results.push({ ...item, vehicle, type, isIota: true });
                            }
                        });
                    }
                });
            });
        }

        // Search in Other Investors
        otherInvestors.forEach(item => {
            if (item.name.toLowerCase().includes(term)) {
                results.push({ 
                    name: item.name, 
                    amount: Math.floor(item.total_amt / 100000000).toLocaleString(), 
                    isIota: false,
                    category: item.category
                });
            }
        });

        return results;
    };

    const searchResults = getSearchResults();
    const isSearchResultNonIota = isSearching && searchResults.every(r => !r.isIota);



    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[100px] max-w-[1112px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-[12px]">
                <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter']">LP / 대주 / SI</h1>
                
                {/* Search Bar */}
                <div className="relative w-[280px]">
                    <div className="absolute inset-y-0 left-[14px] flex items-center pointer-events-none">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <input
                        type="text"
                        className="bg-[#272726] border border-[#545451] hover:border-[#666] rounded-[12px] pl-[36px] pr-[16px] py-[8px] text-[13px] text-white w-[280px] focus:outline-none focus:border-[#2997ff] transition-colors"
                        placeholder="기관명 검색 (예: 국민연금)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <p className="text-[15px] text-[#86868B] mb-[36px]">이지스 전체 파트너사 마스터 디렉토리 및 CRM 연동 현황</p>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto hide-scrollbar">
                
                {isSearching ? (
                    // Search Mode (Grid View like StakeInternal)
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {searchResults.length > 0 ? searchResults.map((item, idx) => {
                            const uniqueKey = `search-${idx}-${item.name}`;
                            const isExpanded = expandedRow === uniqueKey;
                            return (
                                <div key={idx} className="col-span-1 md:col-span-1">
                                    <div 
                                        onClick={() => toggleRow(uniqueKey, item.name)}
                                        className={`bg-[#1c1c1c] border transition-all cursor-pointer p-5 flex flex-col
                                            ${isExpanded ? 'border-[#0A84FF] rounded-t-[16px]' : 'border-[#3c3c3c] rounded-[16px] hover:border-[#555]'}
                                        `}
                                    >
                                        <div className="text-[13px] font-bold text-[#86868B] mb-1">
                                            {item.isIota ? (
                                                <span>
                                                    IOTA {item.vehicle} • {item.type === 'equity' ? 'Equity' : 'Loan'}
                                                    {item.tranche && (
                                                        <>
                                                            {' • '}
                                                            <span className={getTrancheColor(item.tranche)}>{item.tranche}</span>
                                                        </>
                                                    )}
                                                </span>
                                            ) : (item.category || '기타 투자자')}
                                        </div>
                                        <h3 className="text-[18px] font-bold text-white leading-tight mb-4">{item.name}</h3>
                                        <div className="flex justify-between items-center mt-auto">
                                            <span className="text-[13px] text-[#A1A1AA]">총 약정/투자액</span>
                                            <span className="text-[15px] font-bold text-white">{item.amount ? `${item.amount}억` : `총 ${formatKoreanAmount(Math.floor(item.total_amt / 100000000))}`}</span>
                                        </div>
                                    </div>
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <div className="col-span-full">
                                                <AccordionContent instName={item.name} contactsCache={contactsCache} metaCache={metaCache} isLast={true} isMaster={!item.isIota} />
                                            </div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        }) : (
                            <div className="col-span-full py-10 text-center text-[#86868B] text-[15px]">
                                검색 결과가 없습니다.
                            </div>
                        )}
                    </div>
                ) : (
                    // Default Table Mode
                    <div className="flex flex-col gap-6">
                        
                        {loading || !iotaData ? (
                            <div className="text-center text-[#86868B] py-10">DB 데이터 연동 중...</div>
                        ) : (
                            <>
                                {/* IOTA 427 */}
                                <div className="mt-[20px]">
                                    <h2 className="text-[22px] font-bold text-white mb-[14px] tracking-tight">IOTA One (427 PFV)</h2>
                                    <div className="grid grid-cols-2 gap-8">
                                        <div><TransparentTable title="Equity (수익자)" items={iotaData[427].equity} isLoan={false} vehicle={427} expandedRow={expandedRow} toggleRow={toggleRow} contactsCache={contactsCache} /></div>
                                        <div><TransparentTable title="Loan (대주단)" items={iotaData[427].refiLoan} bridgeItems={iotaData[427].bridgeLoan} refiItems={iotaData[427].refiLoan} isLoan={true} vehicle={427} expandedRow={expandedRow} toggleRow={toggleRow} contactsCache={contactsCache} /></div>
                                    </div>
                                </div>

                                {/* IOTA 816 (Highest Priority currently) */}
                                <div>
                                    <h2 className="text-[22px] font-bold text-white mb-[14px] tracking-tight">IOTA Two (816 PFV)</h2>
                                    <div className="grid grid-cols-2 gap-8">
                                        <div><TransparentTable title="Equity (수익자)" items={iotaData[816].equity} isLoan={false} vehicle={816} expandedRow={expandedRow} toggleRow={toggleRow} contactsCache={contactsCache} /></div>
                                        <div><TransparentTable title="Loan (대주단)" items={iotaData[816].refiLoan} bridgeItems={iotaData[816].bridgeLoan} refiItems={iotaData[816].refiLoan} isLoan={true} vehicle={816} expandedRow={expandedRow} toggleRow={toggleRow} contactsCache={contactsCache} /></div>
                                    </div>
                                </div>

                                {/* IOTA 421 */}
                                <div id="section-421">
                                    <h2 className="text-[22px] font-bold text-white mb-[14px] tracking-tight">421호 펀드</h2>
                                    <div className="grid grid-cols-2 gap-8">
                                        <div><TransparentTable title="Equity (수익자)" items={iotaData[421].equity} isLoan={false} vehicle={421} expandedRow={expandedRow} toggleRow={toggleRow} contactsCache={contactsCache} /></div>
                                        <div><TransparentTable title="Loan (대주단)" items={iotaData[421].loan} isLoan={true} vehicle={421} expandedRow={expandedRow} toggleRow={toggleRow} contactsCache={contactsCache} /></div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Non-IOTA Investors */}
                        <div className="mt-3">
                            <h2 className="text-[22px] font-bold text-white mb-1 tracking-tight">기타 이지스 마스터 투자자</h2>
                            <p className="text-[14px] text-[#86868B] mb-6">IOTA에 참여하지 않은 기관 중 이지스 총 약정액이 높은 순서입니다.</p>
                            
                            {loading ? (
                                <div className="text-center text-[#86868B] py-10">DB 데이터 연동 중...</div>
                            ) : (
                                <div className="w-full">
                                    {otherInvestors.map((item, idx) => {
                                        const isExpanded = expandedRow === item.name;
                                        return (
                                            <div key={idx} className="flex flex-col">
                                                <div 
                                                    onClick={() => toggleRow(item.name, item.name)}
                                                    className={`flex items-center justify-between px-5 py-[14px] cursor-pointer transition-colors border border-[#3c3c3c] bg-transparent
                                                        ${idx === 0 ? 'rounded-t-[12px]' : ''} 
                                                        ${idx === otherInvestors.length - 1 && !isExpanded ? 'rounded-b-[12px]' : ''}
                                                        ${idx !== 0 ? '-mt-[1px]' : ''}
                                                        ${isExpanded ? 'border-b-transparent z-10' : 'hover:bg-[#222]'}
                                                    `}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-[15px] font-medium text-white">{item.name}</span>
                                                        <span className="text-[12px] text-[#86868B] border border-[#444] px-2 py-0.5 rounded-md">{item.category || '기타'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <span className="text-[15px] font-bold text-white text-right w-[150px]">총 {formatKoreanAmount(Math.floor(item.total_amt / 100000000))}</span>
                                                        <svg className={`w-4 h-4 text-[#86868B] transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                                                    </div>
                                                </div>
                                                <AnimatePresence>
                                                    {isExpanded && <AccordionContent instName={item.name} contactsCache={contactsCache} metaCache={metaCache} isLast={idx === otherInvestors.length - 1} isMaster={true} iotaInvestments={getIotaInvestments(item.name)} igisInvestments={igisInvestmentsData[item.name] || []} />}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}
