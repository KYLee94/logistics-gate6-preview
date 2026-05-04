with open("temp.jsx") as f:
    lines = f.readlines()

# Find line 733: "IOTA에 참여하지 않은 기관 중 이지스 총 약정액이 높은 순서입니다."
start_idx = -1
for i, line in enumerate(lines):
    if "IOTA에 참여하지 않은 기관 중 이지스 총 약정액이 높은 순서입니다." in line:
        start_idx = i
        break

if start_idx != -1:
    correct_bottom = """                            
                            {/* Search Results / Default List */}
                            <div className="w-full">
                                <div className={`${isSearching ? '' : 'hidden'}`}>
                                    {searchResultsContent}
                                </div>
                                <div className={`${isSearching ? 'hidden' : ''}`}>
                                    {loading ? (
                                        <div className="text-center text-[#86868B] py-10">DB 데이터 연동 중...</div>
                                    ) : (
                                        <div className="w-full">
                                            {otherInvestors.slice(0, displayCount).map((item, idx) => {
                                                const isExpanded = expandedRow === item.name;
                                                const isLastDisplayed = idx === Math.min(otherInvestors.length, displayCount) - 1;
                                                const hasMore = displayCount < otherInvestors.length;
                                                
                                                return (
                                                    <div key={idx} className="flex flex-col">
                                                        <div 
                                                            onClick={() => toggleRow(item.name, item.name)}
                                                            className={`flex items-center justify-between px-5 py-[14px] cursor-pointer transition-colors border border-[#3c3c3c] bg-transparent
                                                                ${idx === 0 ? 'rounded-t-[12px]' : ''} 
                                                                ${isLastDisplayed && !isExpanded && !hasMore ? 'rounded-b-[12px]' : ''}
                                                                ${idx !== 0 ? '-mt-[1px]' : ''}
                                                                ${isExpanded ? 'border-b-transparent z-10' : 'hover:bg-[#222]'}
                                                            `}
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-[24px] text-[13px] font-medium text-[#555] text-center">{idx + 1}</div>
                                                                <span className="text-[15px] font-medium text-white">{item.name}</span>
                                                                <span className="text-[12px] text-[#86868B] border border-[#444] px-2 py-0.5 rounded-md">{item.category || '기타'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-6">
                                                                <span className="text-[15px] font-bold text-white text-right w-[150px]">총 {formatKoreanAmount(Math.floor(item.total_amt / 100000000))}</span>
                                                                <svg className={`w-4 h-4 text-[#86868B] transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                                                            </div>
                                                        </div>
                                                        <AnimatePresence>
                                                            {isExpanded && <AccordionContent instName={item.name} contactsCache={contactsCache} metaCache={metaCache} isLast={isLastDisplayed && !hasMore} isMaster={true} iotaInvestments={getIotaInvestments(item.name)} igisInvestments={igisInvestmentsData[item.name] || []} />}
                                                        </AnimatePresence>
                                                    </div>
                                                );
                                            })}
                                            
                                            {otherInvestors.length > displayCount && (
                                                <div 
                                                    onClick={() => setDisplayCount(prev => prev + 50)}
                                                    className="flex items-center justify-center px-5 py-4 cursor-pointer transition-colors border border-[#3c3c3c] bg-transparent hover:bg-[#222] -mt-[1px] rounded-b-[12px]"
                                                >
                                                    <span className="text-[13px] font-bold text-[#86868B]">더보기 ({displayCount} / {otherInvestors.length})</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
"""
    lines = lines[:start_idx + 1] + [correct_bottom]
    with open("src/components/system/stakeholder/StakeLp.jsx", "w") as f:
        f.writelines(lines)
    print("Fixed syntax")
