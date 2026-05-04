import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../../utils/supabaseClient';

const AccordionContent = ({ instName, contactsCache, isLast }) => {
    const contacts = contactsCache[instName];
    return (
        <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className={`overflow-hidden bg-[#2a2a2a] border-x border-b border-[#3c3c3c] -mt-[1px] ${isLast ? 'rounded-b-[12px]' : ''}`}
        >
            <div className="p-6 grid grid-cols-2 gap-8">
                {/* CRM Contacts */}
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
                
                {/* History / Info */}
                <div>
                    <h4 className="text-[14px] font-bold text-[#86868B] mb-3 uppercase">소통 히스토리 & Notes</h4>
                    <div className="p-4 bg-[#1e1e1e] rounded-xl border border-[#333] h-[120px] flex items-center justify-center">
                        <span className="text-[13px] text-[#555]">최근 미팅 노트 연동 준비중</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const TransparentTable = ({ title, items, isLoan, expandedRow, toggleRow, contactsCache }) => {
    const [showAll, setShowAll] = useState(false);
    const displayItems = showAll ? items : items.slice(0, 5);

    return (
        <div className="mb-10">
            <h3 className="text-[16px] font-bold text-white mb-3 pl-2 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isLoan ? 'bg-[#0A84FF]' : 'bg-[#34d399]'}`}></span>
                {title}
            </h3>
            <div className="w-full">
                {displayItems.length > 0 ? displayItems.map((item, idx) => {
                    const isExpanded = expandedRow === item.name;
                    const isLastItem = idx === displayItems.length - 1 && (showAll || items.length <= 5);
                    
                    return (
                        <div key={idx} className="flex flex-col">
                            <div 
                                onClick={() => toggleRow(item.name)}
                                className={`flex items-center justify-between px-5 py-[13px] cursor-pointer transition-colors border border-[#3c3c3c] bg-transparent
                                    ${idx === 0 ? 'rounded-t-[12px]' : ''} 
                                    ${isLastItem && !isExpanded ? 'rounded-b-[12px]' : ''}
                                    ${idx !== 0 ? '-mt-[1px]' : ''}
                                    ${isExpanded ? 'bg-[#2a2a2a] border-b-transparent z-10' : 'hover:bg-[#222]'}
                                `}
                            >
                                <div className="flex items-center gap-4">
                                    <span className="text-[15px] font-medium text-white">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-6">
                                    <span className="text-[15px] font-bold text-white text-right w-[100px]">{item.amount}억</span>
                                    <svg className={`w-4 h-4 text-[#86868B] transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                                </div>
                            </div>
                            <AnimatePresence>
                                {isExpanded && <AccordionContent instName={item.name} contactsCache={contactsCache} isLast={isLastItem} />}
                            </AnimatePresence>
                        </div>
                    );
                }) : (
                    <div className="px-5 py-4 border border-[#3c3c3c] rounded-[12px] text-[14px] text-[#A1A1AA] text-center">데이터 없음</div>
                )}
                
                {items.length > 5 && !showAll && (
                    <div 
                        onClick={() => setShowAll(true)}
                        className="flex items-center justify-center px-5 py-[13px] cursor-pointer transition-colors border border-[#3c3c3c] border-t-0 bg-[#1c1c1c] hover:bg-[#222] rounded-b-[12px]"
                    >
                        <span className="text-[14px] text-[#86868B] font-medium flex items-center gap-2">
                            전체보기 ({items.length - 5}개 더보기)
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" transform="rotate(180 12 12)"/></svg>
                        </span>
                    </div>
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

    // Fetch master DB for "Other Investors" and IOTA Stack
    useEffect(() => {
        const fetchMaster = async () => {
            try {
                // Fetch IOTA Capital Stack
                const { data: stackData } = await supabase.from('iota_capital_stack').select('*');
                
                let parsedIota = {
                    427: { equity: [], loan: [] },
                    816: { equity: [], loan: [] },
                    421: { equity: [], loan: [] }
                };

                if (stackData) {
                    stackData.forEach(item => {
                        // Phase filtering based on user requirement
                        if (item.vehicle_name == '816' && item.phase !== 'Refinancing') return;
                        if (item.vehicle_name == '427' && item.phase !== 'Bridge') return;
                        
                        const v = parseInt(item.vehicle_name);
                        const type = item.tranche_type === 'Equity' ? 'equity' : 'loan';
                        
                        if (parsedIota[v] && parsedIota[v][type]) {
                            parsedIota[v][type].push({
                                name: item.institution_name,
                                amount: item.amount_krw_100m.toLocaleString(),
                                rawAmount: item.amount_krw_100m
                            });
                        }
                    });
                    
                    // Sort descending by amount
                    [427, 816, 421].forEach(v => {
                        ['equity', 'loan'].forEach(t => {
                            parsedIota[v][t].sort((a, b) => b.rawAmount - a.rawAmount);
                        });
                    });
                }
                setIotaData(parsedIota);

                // Fetch counterparties
                const { data: cps } = await supabase.from('counterparties').select('counterparty_id, name, category');
                // Fetch exposures
                const { data: exps } = await supabase.from('beneficiary_exposures').select('counterparty_id, committed_amt');
                
                if (cps && exps && parsedIota) {
                    const amounts = {};
                    exps.forEach(ex => {
                        if (ex.counterparty_id && ex.committed_amt) {
                            amounts[ex.counterparty_id] = (amounts[ex.counterparty_id] || 0) + parseInt(ex.committed_amt);
                        }
                    });

                    // List of IOTA names to exclude from "Other"
                    const iotaNames = new Set([
                        ...parsedIota[427].equity.map(i=>i.name), ...parsedIota[427].loan.map(i=>i.name),
                        ...parsedIota[816].equity.map(i=>i.name), ...parsedIota[816].loan.map(i=>i.name),
                        ...parsedIota[421].equity.map(i=>i.name), ...parsedIota[421].loan.map(i=>i.name)
                    ]);

                    const others = cps
                        .filter(cp => cp.name && !iotaNames.has(cp.name))
                        .map(cp => ({
                            ...cp,
                            total_amt: amounts[cp.counterparty_id] || 0
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
            const keyword = instName.split('(')[0].replace(' 펀드', '').trim();
            const { data: cps } = await supabase.from('counterparties').select('counterparty_id').ilike('name', `%${keyword}%`);
            
            if (cps && cps.length > 0) {
                const cpIds = cps.map(c => c.counterparty_id);
                const { data: ctData } = await supabase.from('counterparty_contacts').select('*').in('counterparty_id', cpIds);
                setContactsCache(prev => ({ ...prev, [instName]: ctData || [] }));
            } else {
                setContactsCache(prev => ({ ...prev, [instName]: [] }));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const toggleRow = (instName) => {
        if (expandedRow === instName) {
            setExpandedRow(null);
        } else {
            setExpandedRow(instName);
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
                ['equity', 'loan'].forEach(type => {
                    iotaData[vehicle][type].forEach(item => {
                        if (item.name.toLowerCase().includes(term)) {
                            results.push({ ...item, vehicle, type, isIota: true });
                        }
                    });
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
        <div className="w-full flex-1 flex flex-col pt-[40px] pb-[60px] px-[40px] max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex justify-between items-end mb-[30px]">
                <div>
                    <h1 className="text-[32px] font-bold text-white tracking-tight leading-none mb-3">LP / 대주 / SI</h1>
                    <p className="text-[15px] text-[#86868B]">이지스 전체 파트너사 마스터 디렉토리 및 CRM 연동 현황</p>
                </div>
                
                {/* Search Bar */}
                <div className="relative w-[320px]">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-[#86868B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2.5 border border-[#3A3A3C] rounded-[12px] leading-5 bg-[#1C1C1E] text-white placeholder-[#86868B] focus:outline-none focus:border-[#0A84FF] transition-colors sm:text-[14px]"
                        placeholder="기관명 검색 (예: 국민연금)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto hide-scrollbar">
                
                {isSearching ? (
                    // Search Mode (Grid View like StakeInternal)
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {searchResults.length > 0 ? searchResults.map((item, idx) => {
                            const isExpanded = expandedRow === item.name;
                            return (
                                <div key={idx} className="col-span-1 md:col-span-1">
                                    <div 
                                        onClick={() => toggleRow(item.name)}
                                        className={`bg-[#1c1c1c] border transition-all cursor-pointer p-5 flex flex-col
                                            ${isExpanded ? 'border-[#0A84FF] rounded-t-[16px]' : 'border-[#3c3c3c] rounded-[16px] hover:border-[#555]'}
                                        `}
                                    >
                                        <div className="text-[13px] font-bold text-[#86868B] mb-1">
                                            {item.isIota ? `IOTA ${item.vehicle} (${item.type === 'loan' ? '대주' : '출자'})` : (item.category || '기타 투자자')}
                                        </div>
                                        <h3 className="text-[18px] font-bold text-white leading-tight mb-4">{item.name}</h3>
                                        <div className="flex justify-between items-center mt-auto">
                                            <span className="text-[13px] text-[#A1A1AA]">총 약정/투자액</span>
                                            <span className="text-[15px] font-bold text-white">{item.amount}억</span>
                                        </div>
                                    </div>
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <div className="col-span-full">
                                                <AccordionContent instName={item.name} />
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
                                <div className="mb-12">
                                    <h2 className="text-[22px] font-bold text-white mb-6 tracking-tight">IOTA One (427 PFV)</h2>
                                    <div className="grid grid-cols-2 gap-8">
                                        <div><TransparentTable title="Equity (수익자)" items={iotaData[427].equity} isLoan={false} expandedRow={expandedRow} toggleRow={toggleRow} contactsCache={contactsCache} /></div>
                                        <div><TransparentTable title="Loan (대주단)" items={iotaData[427].loan} isLoan={true} expandedRow={expandedRow} toggleRow={toggleRow} contactsCache={contactsCache} /></div>
                                    </div>
                                </div>

                                {/* IOTA 816 (Highest Priority currently) */}
                                <div className="mb-12">
                                    <h2 className="text-[22px] font-bold text-white mb-6 tracking-tight">IOTA Two (816 PFV)</h2>
                                    <div className="grid grid-cols-2 gap-8">
                                        <div><TransparentTable title="Equity (수익자)" items={iotaData[816].equity} isLoan={false} expandedRow={expandedRow} toggleRow={toggleRow} contactsCache={contactsCache} /></div>
                                        <div><TransparentTable title="Loan (대주단)" items={iotaData[816].loan} isLoan={true} expandedRow={expandedRow} toggleRow={toggleRow} contactsCache={contactsCache} /></div>
                                    </div>
                                </div>

                                {/* IOTA 421 */}
                                <div id="section-421" className="mb-12">
                                    <h2 className="text-[22px] font-bold text-white mb-6 tracking-tight">421호 펀드</h2>
                                    <div className="grid grid-cols-2 gap-8">
                                        <div><TransparentTable title="Equity (수익자)" items={iotaData[421].equity} isLoan={false} expandedRow={expandedRow} toggleRow={toggleRow} contactsCache={contactsCache} /></div>
                                        <div><TransparentTable title="Loan (대주단)" items={iotaData[421].loan} isLoan={true} expandedRow={expandedRow} toggleRow={toggleRow} contactsCache={contactsCache} /></div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Non-IOTA Investors */}
                        <div className="mt-8 p-6">
                            <h2 className="text-[22px] font-bold text-white mb-2 tracking-tight">기타 이지스 마스터 투자자</h2>
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
                                                    onClick={() => toggleRow(item.name)}
                                                    className={`flex items-center justify-between px-5 py-[14px] cursor-pointer transition-colors border border-[#3c3c3c] bg-transparent
                                                        ${idx === 0 && !isExpanded ? 'rounded-t-[12px]' : ''} 
                                                        ${idx === otherInvestors.length - 1 && !isExpanded ? 'rounded-b-[12px]' : ''}
                                                        ${idx !== 0 ? '-mt-[1px]' : ''}
                                                        ${isExpanded ? 'bg-[#2a2a2a] rounded-t-[12px] border-b-transparent z-10' : 'hover:bg-[#222]'}
                                                    `}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-[15px] font-medium text-white">{item.name}</span>
                                                        <span className="text-[12px] text-[#86868B] border border-[#444] px-2 py-0.5 rounded-md">{item.category || '기타'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <span className="text-[15px] font-bold text-white text-right w-[150px]">총 {Math.floor(item.total_amt / 100000000).toLocaleString()}억</span>
                                                        <svg className={`w-4 h-4 text-[#86868B] transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                                                    </div>
                                                </div>
                                                <AnimatePresence>
                                                    {isExpanded && <AccordionContent instName={item.name} contactsCache={contactsCache} isLast={false} />}
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
