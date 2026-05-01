import React from 'react';

export default function GovRaci() {
    const raciData = [
        { task: '일정 변경 (UW 범위 내)', pm: 'A/R', lfc: 'I', dev: 'C', emc: 'I', kam: 'I', total: 'I' },
        { task: '일정 변경 (UW 범위 외)', pm: 'R', lfc: 'C', dev: 'C', emc: 'I', kam: 'I', total: 'A' },
        { task: '사업비 증감 (UW 범위 내)', pm: 'A/R', lfc: 'C', dev: 'C', emc: 'I', kam: 'I', total: 'I' },
        { task: '사업비 증감 (UW 범위 외)', pm: 'R', lfc: 'C', dev: 'C', emc: 'I', kam: 'I', total: 'A' },
        { task: '설계 Alt 최종결정', pm: 'A', lfc: 'I', dev: 'R', emc: 'C', kam: 'I', total: 'I' },
        { task: '시공사 도급계약 체결', pm: 'A', lfc: 'C', dev: 'R', emc: 'I', kam: 'I', total: 'I' },
        { task: '임대차 (UW 범위 내)', pm: 'C', lfc: 'I', dev: 'I', emc: 'A/R', kam: 'C', total: 'I' },
        { task: '임대차 (UW 범위 외)', pm: 'R', lfc: 'I', dev: 'I', emc: 'C', kam: 'C', total: 'A' },
        { task: '대출 리파이낸싱', pm: 'C', lfc: 'A/R', dev: 'I', emc: 'I', kam: 'I', total: 'I' },
        { task: '대주단 Covenants 위반 대응', pm: 'R', lfc: 'A', dev: 'C', emc: 'I', kam: 'I', total: 'I' },
        { task: 'LP 정기보고', pm: 'C', lfc: 'I', dev: 'I', emc: 'I', kam: 'R', total: 'A' },
        { task: '자본콜·자금집행', pm: 'I', lfc: 'C', dev: 'I', emc: 'I', kam: 'R', total: 'A' },
        { task: '프로젝트리츠 편입 의향 회신', pm: 'C', lfc: 'C', dev: 'I', emc: 'I', kam: 'C', total: 'A' },
        { task: '분쟁/소송 대응', pm: 'C', lfc: 'C', dev: 'C', emc: 'C', kam: 'C', total: 'A' },
    ];

    const phase1Data = [
        { task: '설계 Short List·RFP·계약·진행 관리', col1: '', col2: '●', col3: '○', col4: '', col5: '', col6: '', col7: '', col8: '' },
        { task: 'BI / 상품 차별화 시나리오', col1: '', col2: '○', col3: '', col4: '●', col5: '', col6: '○', col7: '○', col8: '' },
        { task: '민원 대응 및 합의서 체결', col1: '●', col2: '', col3: '○', col4: '', col5: '', col6: '', col7: '○', col8: '' },
        { task: 'CM/감리 선정·계약', col1: '', col2: '●', col3: '○', col4: '', col5: '', col6: '', col7: '', col8: '' },
        { task: '인허가 (법률·일정·대관)', col1: '○', col2: '●', col3: '○', col4: '', col5: '', col6: '', col7: '', col8: '' },
        { task: 'PFV 재구조화 (통합·증감자 등)', col1: '●', col2: '', col3: '', col4: '', col5: 'C', col6: '', col7: '', col8: '○' },
        { task: '브릿지/PF 모집 (주관사·대주 협의)', col1: '○', col2: 'C', col3: '', col4: '', col5: '●', col6: '', col7: '', col8: '○' },
        { task: 'Sponsor·Equity·선매각 협의', col1: '○', col2: '●', col3: '', col4: '', col5: 'C', col6: '', col7: 'C', col8: '○' },
        { task: '시공사 RFP·선정·도급계약', col1: '', col2: '●', col3: '', col4: '', col5: '', col6: '', col7: '', col8: '' },
        { task: 'LM (착공 전, 대상기업 피칭·임대차 협의)', col1: '○', col2: 'C', col3: '', col4: '', col5: '', col6: '●', col7: 'C', col8: '' },
    ];

    const phase2Data = [
        { task: '공정관리 (시공·CM·감리)', col1: '', col2: '●', col3: '○', col4: '', col5: '', remark: '' },
        { task: '일정·예산 변경 (UW 범위 내)', col1: '', col2: '●', col3: '', col4: '', col5: '', remark: 'PM 자율' },
        { task: '일정·예산 변경 (UW 범위 외)', col1: '', col2: '●', col3: 'C', col4: 'C', col5: '', remark: 'CFT 운영위 승인' },
        { task: 'LM (준공 전, 피칭·임대차)', col1: '○', col2: '○', col3: '', col4: '', col5: '●', remark: 'KAM C' },
        { task: '대주단 Covenants 모니터링·대응', col1: '', col2: 'C', col3: '', col4: '●', col5: '', remark: '월간 보고' },
        { task: '사업비 정산 / 증감 관리', col1: '', col2: '●', col3: '', col4: 'C', col5: '', remark: '' },
        { task: 'LP 진척보고·자금집행', col1: '', col2: 'C', col3: '', col4: 'I', col5: 'I', remark: 'KAM A' },
    ];

    const phase3Data = [
        { task: 'PM(KT Estate 등) 관리·운영', col1: '●', col2: '○', col3: '', col4: '', col5: '', col6: '' },
        { task: 'LM (준공 후 임차인 관리)', col1: '', col2: '', col3: '', col4: '○', col5: '●', col6: '' },
        { task: '보험·대출 리파이낸싱(운영기)', col1: 'C', col2: '', col3: '●', col4: '', col5: '○', col6: '' },
        { task: '사업비 증감 (운영 단계)', col1: '○', col2: '', col3: '', col4: '', col5: '●', col6: '' },
        { task: '선매각/IPR 편입 의향 회신·구조 조율', col1: 'C', col2: '', col3: 'C', col4: '', col5: '○', col6: '●' },
        { task: '매각 자문사 선정·매매계약', col1: '', col2: '', col3: '', col4: '', col5: '●', col6: 'C' },
        { task: 'LP 분배·청산', col1: '', col2: '', col3: '', col4: '', col5: '●', col6: 'I' },
    ];

    const renderBadge = (role) => {
        const squareClass = "inline-flex w-[32px] h-[32px] items-center justify-center rounded-[10px] font-bold text-[14px]";
        const rectClass = "inline-flex px-2 min-w-[40px] h-[32px] items-center justify-center rounded-[10px] font-bold text-[14px]";
        if (role === 'A') return <span className={`${squareClass} bg-[#0e3658] text-[#5da0e7]`}>A</span>;
        if (role === 'R') return <span className={`${squareClass} bg-[#13383b] text-[#3aaab3]`}>R</span>;
        if (role === '●') return <span className="text-[20px] text-white">●</span>;
        if (role === '○') return <span className="text-[20px] text-[#A1A1AA]">○</span>;
        if (role === 'A/R') return <span className={`${rectClass} bg-[#f59e0b]/30 text-[#fcd34d]`}>A/R</span>;
        if (role === 'C') return <span className={`${squareClass} bg-[#512635] text-[#cd879c]`}>C</span>;
        if (role === 'I') return <span className={`${squareClass} bg-[#462561] text-[#b889d9]`}>I</span>;
        return role;
    };

    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1112px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[24px]">핵심 의사결정 RACI</h1>
            <div className="flex items-center gap-8 mb-[32px] bg-transparent border border-[#333] p-5 rounded-[24px]">
                <div className="flex items-center gap-3"><span className="inline-flex w-[32px] h-[32px] items-center justify-center rounded-[10px] font-bold text-[14px] bg-[#0e3658] text-[#5da0e7]">A</span> <span className="text-white text-[14px]">최종 결정 및 승인 (Accountable)</span></div>
                <div className="flex items-center gap-3"><span className="inline-flex w-[32px] h-[32px] items-center justify-center rounded-[10px] font-bold text-[14px] bg-[#13383b] text-[#3aaab3]">R</span> <span className="text-white text-[14px]">실무 주관 및 실행 (Responsible)</span></div>
                <div className="flex items-center gap-3"><span className="inline-flex w-[32px] h-[32px] items-center justify-center rounded-[10px] font-bold text-[14px] bg-[#512635] text-[#cd879c]">C</span> <span className="text-white text-[14px]">사전 협의 및 자문 (Consulted)</span></div>
                <div className="flex items-center gap-3"><span className="inline-flex w-[32px] h-[32px] items-center justify-center rounded-[10px] font-bold text-[14px] bg-[#462561] text-[#b889d9]">I</span> <span className="text-white text-[14px]">사후 결과 통보 (Informed)</span></div>
            </div>
            
            <div className="w-full border border-[#333] rounded-[24px] overflow-hidden">
                <table className="w-full text-center table-fixed">
                    <thead className="bg-transparent">
                        <tr>
                            <th className="px-[24px] py-[16px] text-[14px] font-bold text-[#86868B] border-b border-[#333] border-r border-[#333] w-[300px] min-w-[300px] max-w-[300px] text-left">의사결정 영역</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">PM<br/><span className="text-white font-normal text-[14px] block mt-[2px] cursor-pointer hover:underline underline-offset-4 decoration-white/30 transition-all">강순용</span></th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">LFC<br/><span className="text-white font-normal text-[14px] block mt-[2px] cursor-pointer hover:underline underline-offset-4 decoration-white/30 transition-all">박준호</span></th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">개발<br/><span className="text-white font-normal text-[14px] block mt-[2px] cursor-pointer hover:underline underline-offset-4 decoration-white/30 transition-all">홍장군</span></th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">EMC<br/><span className="text-white font-normal text-[14px] block mt-[2px] cursor-pointer hover:underline underline-offset-4 decoration-white/30 transition-all">김민지</span></th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">KAM<br/><span className="text-white font-normal text-[14px] block mt-[2px] cursor-pointer hover:underline underline-offset-4 decoration-white/30 transition-all">김행단</span></th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333]">CFT총괄<br/><span className="text-white font-normal text-[14px] block mt-[2px] cursor-pointer hover:underline underline-offset-4 decoration-white/30 transition-all">이철승</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                        {raciData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#292928] transition-colors group">
                                <td className="px-[24px] py-[14px] text-[14px] text-[#E5E5E5] border-r border-[#333] text-left group-hover:text-white transition-colors">{row.task}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.pm)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.lfc)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.dev)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.emc)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.kam)}</td>
                                <td className="px-[12px] py-[14px] transition-colors">{renderBadge(row.total)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="mt-[16px] text-[13px] text-[#bbb9af]">** 'A/R'은 PM이 자율 결정·실행을 동시에 보유함을 의미합니다.</p>
            {/* Divider */}
            <div className="w-full h-px bg-[#333] my-[80px]"></div>

            <h2 className="text-[28px] font-bold text-white mb-[12px] tracking-tight">Phase 별 주관·합의 매트릭스</h2>
            <p className="text-[16px] text-[#A1A1AA] leading-[26px] mb-[40px]">
                이오타서울 프로젝트의 라이프사이클은 크게 (1) PF 전(착공 전), (2) PF 후(개발 단계), (3) 운영 단계, (4) 매각 및 IPR 편입의 4단계로 구분됩니다.<br />
                본 매트릭스는 각 라이프사이클 단계별 핵심 과제에 대해 어떤 조직(Cell)이 주관(<span className="text-white">●</span>) 및 합의(<span className="text-[#A1A1AA]">○</span>) 책임을 지는지 통합적으로 정의합니다.
            </p>

            {/* Table 1 */}
            <h3 className="text-[20px] font-bold text-white mb-[16px]">PF 전(착공 전) 단계</h3>
            <div className="w-full border border-[#333] rounded-[24px] overflow-hidden mb-[48px]">
                <table className="w-full text-center table-fixed">
                    <thead className="bg-transparent">
                        <tr>
                            <th className="px-[24px] py-[16px] text-[14px] font-bold text-[#86868B] border-b border-[#333] border-r border-[#333] w-[300px] min-w-[300px] max-w-[300px] text-left">세부 업무</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">사업1파트</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">사업2파트</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">개발솔루션</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">SSC</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">LFC</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">EMC</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">KAM·기타</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333]">IPR(TF)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                        {phase1Data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#292928] transition-colors group">
                                <td className="px-[24px] py-[14px] text-[14px] text-[#E5E5E5] border-r border-[#333] text-left group-hover:text-white transition-colors">{row.task}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col1)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col2)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col3)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col4)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col5)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col6)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col7)}</td>
                                <td className="px-[12px] py-[14px] transition-colors">{renderBadge(row.col8)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Table 2 */}
            <h3 className="text-[20px] font-bold text-white mb-[16px]">PF 후(개발 단계)</h3>
            <div className="w-full border border-[#333] rounded-[24px] overflow-hidden mb-[48px]">
                <table className="w-full text-center table-fixed">
                    <thead className="bg-transparent">
                        <tr>
                            <th className="px-[24px] py-[16px] text-[14px] font-bold text-[#86868B] border-b border-[#333] border-r border-[#333] w-[300px] min-w-[300px] max-w-[300px] text-left">세부 업무</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">사업1파트</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">사업2파트</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">개발솔루션</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">LFC</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">EMC</th>
                            <th className="px-[24px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] text-left">비고</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                        {phase2Data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#292928] transition-colors group">
                                <td className="px-[24px] py-[14px] text-[14px] text-[#E5E5E5] border-r border-[#333] text-left group-hover:text-white transition-colors">{row.task}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col1)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col2)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col3)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col4)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col5)}</td>
                                <td className="px-[24px] py-[14px] text-[14px] text-[#86868B] transition-colors text-left">{row.remark}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Table 3 */}
            <h3 className="text-[20px] font-bold text-white mb-[16px]">운영·매각·IPR 편입 단계</h3>
            <div className="w-full border border-[#333] rounded-[24px] overflow-hidden mb-[16px]">
                <table className="w-full text-center table-fixed">
                    <thead className="bg-transparent">
                        <tr>
                            <th className="px-[24px] py-[16px] text-[14px] font-bold text-[#86868B] border-b border-[#333] border-r border-[#333] w-[300px] min-w-[300px] max-w-[300px] text-left">세부 업무</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">사업2파트</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">개발솔루션</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">LFC</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">EMC</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333] border-r border-[#333]">KAM 1파트</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#bbb9af] border-b border-[#333]">프리츠TFT</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                        {phase3Data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#292928] transition-colors group">
                                <td className="px-[24px] py-[14px] text-[14px] text-[#E5E5E5] border-r border-[#333] text-left group-hover:text-white transition-colors">{row.task}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col1)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col2)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col3)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col4)}</td>
                                <td className="px-[12px] py-[14px] border-r border-[#333]">{renderBadge(row.col5)}</td>
                                <td className="px-[12px] py-[14px] transition-colors">{renderBadge(row.col6)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
