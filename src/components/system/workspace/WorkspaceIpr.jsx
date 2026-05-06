import React, { useState } from 'react';

export default function WorkspaceIpr() {
    const [activeTab, setActiveTab] = useState(0);

    return (
                <div className="w-full flex-1 flex flex-col pt-[50px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header & Team Structure */}
            <div className="w-full flex justify-between items-center mb-[40px] gap-[40px]">
                {/* Header Metadata */}
                <div className="shrink-0 max-w-[300px]">
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">IPR</h1>
                    <p className="text-[15px] text-[#86868B] leading-[24px]">자본시장 소통 및 프로젝트 리츠 TFT 운영</p>
                </div>
                
                {/* Team Structure */}
                <div className="border border-[#333] rounded-[24px] flex flex-col bg-transparent shrink-0">

                    
                    <div className="flex items-center pl-[20px] pr-[10px] py-[10px]">
                        <div className="w-[80px] shrink-0">
                            <span className="text-[13px] font-bold text-[#86868B]">투자</span>
                        </div>
                        <div className="flex items-center gap-[12px] w-[130px] shrink-0">
                            <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                                <img src={`${import.meta.env.BASE_URL}권순일.webp`} alt="권순일" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-white font-bold text-[13px] leading-tight">권순일</span>
                                <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">사업1파트장</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-x-1.5 gap-y-2 -ml-[6px]">
                            <span className="text-[#A1A1AA] text-[13px] font-medium leading-none ml-[6px] pt-[10px]">사업1파트 실무진</span>
                        </div>
                    </div>
                    <div className="w-full h-px bg-[#333]"></div>
                    <div className="flex items-center pl-[20px] pr-[10px] py-[10px]">
                        <div className="w-[80px] shrink-0">
                            <span className="text-[13px] font-bold text-[#86868B]">관리</span>
                        </div>
                        <div className="flex items-center gap-[12px] w-[130px] shrink-0">
                            <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                                <img src={`${import.meta.env.BASE_URL}윤용택.webp`} alt="윤용택" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-white font-bold text-[13px] leading-tight">윤용택</span>
                                <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">사업3파트</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-x-1.5 gap-y-2 -ml-[6px]">
                            <span className="text-[#A1A1AA] text-[13px] font-medium leading-none ml-[6px] pt-[10px]">신규 영입 예정</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-[20px]">
                {/* 기본 정보 */}
                <div className="bg-[#292928] border border-[#3c3c3c] px-[32px] py-[28px] rounded-[32px] w-full">
                    <div className="grid grid-cols-[110px_1fr] gap-y-3 text-[16px]">
                        <span className="text-[#86868B]">Vehicle</span>
                        <div className="flex items-center gap-[12px]">
                            <span className="text-white font-medium">
                                IPR [Iota Project REITs] - 프로젝트리츠 TFT : 권순일(투자) · 윤용택(관리)
                            </span>
                            <div className="flex items-center -space-x-[10px]">
                                <img src={`${import.meta.env.BASE_URL}권순일.webp`} alt="권순일" className="w-[32px] h-[32px] rounded-full border border-[#292928] object-cover shadow-sm relative z-10" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                <img src={`${import.meta.env.BASE_URL}윤용택.webp`} alt="윤용택" className="w-[32px] h-[32px] rounded-full border border-[#292928] object-cover shadow-sm relative z-0" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
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

            {/* 현재 투자 계획 Box */}
            <div className="bg-[#292928] border border-[#3c3c3c] px-[32px] pt-[28px] pb-[32px] rounded-[32px] w-full mt-[20px]">
                {/* Header & Tabs */}
                <div className="flex justify-between items-center mb-[32px] border-b border-[#3c3c3c] pb-[16px]">
                    <div className="flex items-center gap-[24px]">
                        <h4 className="text-[16px] font-bold text-white font-['Inter']">현재 투자 계획</h4>
                        
                        <div className="flex gap-[0px] items-center">
                            {["투자구조", "개발원가", "브릿지론", "PF", "재투자"].map((tab, idx) => (
                                <button 
                                    key={idx} 
                                    onClick={() => setActiveTab(idx)}
                                    className={`px-[16px] rounded-[8px] text-[13px] font-medium transition-colors cursor-pointer ${activeTab === idx ? 'bg-[#3c3c3c] text-white py-[6px]' : 'text-[#86868B] hover:text-[#bbb9af] py-[8px]'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                    <span className="text-[12px] text-[#86868B]">2026.05 ver.</span>
                </div>

                {/* Tab Content Area */}
                <div className="w-full min-h-[300px]">
                    {activeTab === 0 && (
                        // 1. 투자구조
                        <div className="flex flex-col items-center">
                            <div className="w-[800px] mb-[10px]">
                                <h3 className="text-[16px] text-white font-bold tracking-tight text-left">2026년 10월 Closing 시점에 보통주 Equity 및 Bridge Loan을 통해 잔금100% 구조로 매매대금 지급</h3>
                            </div>
                            <div className="bg-[#0A2640] text-white px-[40px] py-[16px] rounded-[20px] font-bold text-[15px] border border-[#2997ff]/30 shadow-lg mt-[10px]">이지스프로젝트리츠(IPR)</div>
                            
                            {/* Branching Lines */}
                            <div className="w-[500px] h-[40px] border-l border-r border-t border-[#666] mt-[30px] relative">
                                <div className="absolute top-[-30px] left-1/2 w-px h-[30px] bg-[#666] -translate-x-1/2"></div>
                                <div className="absolute top-[-14px] left-[25%] bg-[#292928] px-2 text-[17px] font-bold text-white tracking-tight -translate-x-1/2">2조 3,800억원</div>
                                <div className="absolute top-[-14px] right-[25%] bg-[#292928] px-2 text-[17px] font-bold text-white tracking-tight translate-x-1/2">1조 900억원</div>
                            </div>

                            <div className="flex gap-[40px] w-[800px] mt-[-1px]">
                                {/* YD427PFV */}
                                <div className="flex-1 bg-[#1c1c1e] border border-[#3c3c3c] rounded-[24px] pt-[16px] px-[20px] pb-[20px] flex flex-col gap-[16px]">
                                    <div className="text-center font-bold text-white pb-3 border-b border-[#3c3c3c] mt-[4px]">YD427PFV</div>
                                    <div className="flex justify-between text-[13px] text-[#E5E5E5] px-2">
                                        <div className="flex flex-col items-center"><span className="font-bold underline underline-offset-2">누적 투입금액</span><span className="text-[#A1A1AA]">(2조 2,800억원)</span></div>
                                        <div className="flex flex-col items-center"><span className="font-bold underline underline-offset-2">투자 자산</span><span className="text-[#A1A1AA]">밀레니엄 힐튼호텔</span></div>
                                    </div>
                                    <div className="flex flex-col gap-2 -mt-1 h-full justify-end">
                                        <div className="bg-[#0A2640] text-white p-[16px] rounded-[16px] text-center text-[13px] h-[90px] flex flex-col justify-center border border-[#2997ff]/20 shadow-inner">
                                            <span className="font-bold">Pre-PF Loan</span><span className="text-[#A1A1AA]">(2조 2,000억원)</span>
                                        </div>
                                        <div className="bg-[#e0f2fe] text-[#0A2640] py-[16px] px-[12px] rounded-[16px] text-center text-[13px] font-bold shadow-inner mb-[6px]">
                                            Equity (800억원)
                                        </div>
                                    </div>
                                </div>
                                {/* YD816PFV */}
                                <div className="flex-1 bg-[#1c1c1e] border border-[#3c3c3c] rounded-[24px] pt-[16px] px-[20px] pb-[20px] flex flex-col gap-[16px]">
                                    <div className="text-center font-bold text-white pb-3 border-b border-[#3c3c3c] mt-[4px]">YD816PFV</div>
                                    <div className="flex justify-between text-[13px] text-[#E5E5E5] px-2">
                                        <div className="flex flex-col items-center"><span className="font-bold underline underline-offset-2">누적 투입금액</span><span className="text-[#A1A1AA]">(1조 434억원)</span></div>
                                        <div className="flex flex-col items-center"><span className="font-bold underline underline-offset-2">투자 자산</span><span className="text-[#A1A1AA]">서울·메트로타워</span></div>
                                    </div>
                                    <div className="flex flex-col gap-2 -mt-1 h-full justify-end">
                                        <div className="bg-[#0A2640] text-white p-[16px] rounded-[16px] text-center text-[13px] h-[90px] flex flex-col justify-center border border-[#2997ff]/20 shadow-inner">
                                            <span className="font-bold">Bridge Loan</span><span className="text-[#A1A1AA]">(7,970억원)</span>
                                        </div>
                                        <div className="bg-[#e0f2fe] text-[#0A2640] py-[16px] px-[12px] rounded-[16px] text-center text-[13px] font-bold shadow-inner mb-[6px]">
                                            Equity* (2,464억원)
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="w-[800px] text-right mt-[6px] text-[11px] text-[#666]">※ 주주대여금 2,400억원 포함</div>
                        </div>
                    )}

                    {activeTab === 1 && (
                        // 2. 통합 개발원가
                        <div className="flex flex-col w-full items-center">
                            <h3 className="text-[16px] text-white font-bold mb-[16px] tracking-tight w-[calc(100%-200px)] text-left">통합 개발 시 총 사업비 8조 1,000억원 / 연면적당 5,820만원/평 예상</h3>
                            <div className="w-[calc(100%-200px)] border border-[#3c3c3c] rounded-[20px] overflow-hidden">
                                <div className="grid grid-cols-[140px_1.5fr_1.5fr_3fr] border-b border-[#3c3c3c] text-[13px] text-white font-bold">
                                    <div className="p-3 border-r border-[#3c3c3c] flex items-center justify-center">구분</div>
                                    <div className="p-3 border-r border-[#3c3c3c] flex items-center justify-center text-center"><span className="text-white text-[13px] mr-1">Total (IPR)</span>총액(백만원)</div>
                                    <div className="p-3 border-r border-[#3c3c3c] flex items-center justify-center text-center"><span className="text-white text-[13px] mr-1">Total (IPR)</span>평당가(백만원/평)</div>
                                    <div className="p-3 flex items-center justify-center">비고</div>
                                </div>
                                {[
                                    { k: '자산매입비용', v1: '3,648,814', v2: '26.2', r: ['IOTA One: 2조 3,800억원 (23.11백만원/평)', 'IOTA Two: 1조 900억원 (29.83백만원/평)'] },
                                    { k: '공사비용', v1: '1,866,281', v2: '13.4', r: ['IOTA One 평당 공사비: 11.0백만원/평 (현대건설)', 'IOTA Two 평당 공사비: 12.8백만원/평 (삼성물산)'] },
                                    { k: '제세공과금', v1: '37,718', v2: '0.3', r: [] },
                                    { k: '부대비용', v1: '216,009', v2: '1.6', r: ['준공 원시 취득세, 임차마케팅 비용 포함'] },
                                    { k: '금융비용', v1: '2,279,100', v2: '16.4', r: ['B/L 총액: 3조 6,000억원 (평균 All-In 7.7%)', 'PF Loan 총액: 6조 5,000억원 (평균 All-In 5.4%)'] },
                                    { k: '리츠운영비용', v1: '25,428', v2: '0.2', r: [] },
                                    { k: '예비비', v1: '26,649', v2: '0.2', r: [] }
                                ].map((row, i) => (
                                    <div key={i} className="grid grid-cols-[140px_1.5fr_1.5fr_3fr] border-b border-[#3c3c3c] text-[13px] text-[#E5E5E5]">
                                        <div className="p-3 border-r border-[#3c3c3c] font-bold text-center flex items-center justify-center">{row.k}</div>
                                        <div className="p-3 border-r border-[#3c3c3c] text-right font-mono tracking-tight flex items-center justify-end">{row.v1}</div>
                                        <div className="p-3 border-r border-[#3c3c3c] text-right font-mono tracking-tight flex items-center justify-end">{row.v2}</div>
                                        <div className="py-[12px] px-[16px] text-[#A1A1AA]">
                                            {row.r.length > 0 && (
                                                <ul className="list-disc pl-[16px] flex flex-col gap-[2px]">
                                                    {row.r.map((item, idx) => <li key={idx} className="pl-1 leading-tight">{item}</li>)}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div className="grid grid-cols-[140px_1.5fr_1.5fr_3fr] text-[14px] text-white font-bold">
                                    <div className="p-3 border-r border-[#3c3c3c] text-center">총 사업비</div>
                                    <div className="p-3 border-r border-[#3c3c3c] text-right font-mono tracking-tight">8,100,000</div>
                                    <div className="p-3 border-r border-[#3c3c3c] text-right font-mono tracking-tight">58.2</div>
                                    <div className="p-3"></div>
                                </div>
                            </div>
                            <div className="w-[calc(100%-200px)] text-right text-[11px] text-[#666] mt-[8px] mb-[10px]">※ 상기 내용은 확정이 아니며 관련 법령상 요구되는 기준 충족 등의 사유로 변경될 수 있습니다.</div>
                        </div>
                    )}

                    {activeTab === 2 && (
                        // 3. 브릿지론
                        <div className="flex flex-col w-full">
                            <div className="w-[660px] mx-auto">
                                <h3 className="text-[16px] text-white font-bold mb-[24px] tracking-tight">매입시점 필요재원 3조 9,500억원 중 Equity 3,500억원, Bridge Loan 3조 6,000억원 조달 계획</h3>
                                <div className="flex w-full gap-[10px]">
                                    {/* Uses */}
                                    <div className="flex flex-col w-[250px]">
                                        <div className="text-[14px] font-bold text-[#E5E5E5] mb-3 pb-2 border-b border-[#333] text-center">Uses (매입시점)</div>
                                        <div className="flex flex-col gap-1 w-full h-[360px]">
                                            <div className="bg-[#4d5341] text-white rounded text-center font-bold text-[13px] flex-[4] flex flex-col justify-center items-center">
                                                <span>자산매입비용</span><span className="text-[#bbb9af] font-normal">(3조 6,488억원)</span>
                                            </div>
                                            <div className="bg-[#7d7565] text-white rounded text-center font-bold text-[13px] flex-[1.2] flex flex-col justify-center items-center">
                                                <span>공사비용</span><span className="text-[#dcd8c8] font-normal">(479억원)</span>
                                            </div>
                                            <div className="bg-[#9ea08e] text-white rounded text-center font-bold text-[13px] flex-1 flex flex-col justify-center items-center">
                                                <span>제세공과금</span><span className="text-[#e2e3db] font-normal">(30억원)</span>
                                            </div>
                                            <div className="bg-[#b5af9d] text-white rounded text-center font-bold text-[13px] flex-[1.5] flex flex-col justify-center items-center">
                                                <span>금융비용</span><span className="text-[#e2e3db] font-normal">(2,222억원)</span>
                                            </div>
                                            <div className="bg-[#f0f0f0] text-[#333] rounded text-center font-bold text-[13px] flex-[1.2] flex flex-col justify-center items-center">
                                                <span>기타운영비용</span><span className="text-[#666] font-normal">(280억원)</span>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-[#333] flex justify-start gap-2 text-[14px] font-bold text-white">
                                            <span>총 필요재원 3조 9,500억원</span>
                                        </div>
                                    </div>
                                    {/* Sources */}
                                    <div className="flex flex-col w-[400px]">
                                        <div className="text-[14px] font-bold text-[#E5E5E5] mb-3 pb-2 border-b border-[#333] text-center">Sources (매입시점)</div>
                                        <div className="flex gap-[20px] h-[360px] items-stretch relative">
                                            <div className="flex flex-col gap-1 w-[250px] shrink-0 h-full">
                                                <div className="bg-[#0A2640] text-white rounded text-center font-bold text-[13px] flex-[4] flex flex-col justify-center items-center shadow-inner border border-[#2997ff]/30">
                                                    <span>Bridge Loan<br/>Tranche A</span><span className="text-[#86868B] font-normal">3조원 (LTV 59%)</span>
                                                </div>
                                                <div className="bg-[#0e7490] text-white rounded text-center font-bold text-[13px] flex-1 flex flex-col justify-center items-center shadow-inner border border-[#38bdf8]/30">
                                                    <span>Bridge Loan<br/>Tranche B</span><span className="text-[#a5f3fc] font-normal">6,000억원 (LTV 71%)</span>
                                                </div>
                                                <div className="bg-[#e0f2fe] text-[#0A2640] rounded text-center font-bold text-[13px] flex-1 flex flex-col justify-center items-center border border-dashed border-[#0A2640]">
                                                    <span>Equity<br/>(보통주)</span><span className="text-[#0A2640]/70 font-normal">3,500억원</span>
                                                </div>
                                            </div>
                                            <div className="flex-1 flex flex-col justify-between py-[10%]">
                                                <div className="bg-[#fce7f3] text-[#9d174d] py-3 px-4 rounded text-center font-bold text-[12px]">대출기관</div>
                                                <div className="bg-[#9f1239] text-white py-3 px-4 rounded text-center font-bold text-[12px]">KKR</div>
                                            </div>
                                        </div>
                                        <div className="mt-[20px] pt-3 border-t border-[#333] flex justify-start gap-2 text-[14px] font-bold text-white">
                                            <span>총 재원조달 3조 9,500억원</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 3 && (
                        // 4. PF
                        <div className="flex flex-col w-full">
                            <div className="w-[660px] mx-auto">
                                <h3 className="text-[16px] text-white font-bold mb-[24px] tracking-tight">총 투자비 8조 1,000억원 중 Equity 1조 5,500억원, PF Loan 6조 5,500억원 재원 조달 계획</h3>
                                <div className="flex w-full gap-[10px]">
                                    {/* Uses */}
                                    <div className="flex flex-col w-[250px]">
                                        <div className="text-[14px] font-bold text-[#E5E5E5] mb-3 pb-2 border-b border-[#333] text-center">Uses (착공시점)</div>
                                        <div className="flex flex-col gap-1 w-full h-[360px]">
                                            <div className="bg-[#4d5341] text-white rounded text-center font-bold text-[13px] flex-[3] flex flex-col justify-center items-center">
                                                <span>자산매입비용</span><span className="text-[#bbb9af] font-normal">(3조 6,488억원)</span>
                                            </div>
                                            <div className="bg-[#7d7565] text-white rounded text-center font-bold text-[13px] flex-[1.5] flex flex-col justify-center items-center">
                                                <span>공사비용</span><span className="text-[#dcd8c8] font-normal">(1조 8,662억원)</span>
                                            </div>
                                            <div className="bg-[#9ea08e] text-white rounded text-center font-bold text-[13px] flex-1 flex flex-col justify-center items-center">
                                                <span>제세공과금</span><span className="text-[#e2e3db] font-normal">(377억원)</span>
                                            </div>
                                            <div className="bg-[#b5af9d] text-white rounded text-center font-bold text-[13px] flex-[2] flex flex-col justify-center items-center">
                                                <span>금융비용</span><span className="text-[#e2e3db] font-normal">(2조 2,791억원)</span>
                                            </div>
                                            <div className="bg-[#f0f0f0] text-[#333] rounded text-center font-bold text-[13px] flex-[1.5] flex flex-col justify-center items-center">
                                                <span>기타운영비용</span><span className="text-[#666] font-normal">(2,680억원)</span>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-[#333] flex justify-start gap-2 text-[14px] font-bold text-white">
                                            <span>총 투자비 8조 1,000억원</span>
                                        </div>
                                    </div>
                                    {/* Sources */}
                                    <div className="flex flex-col w-[400px]">
                                        <div className="text-[14px] font-bold text-[#E5E5E5] mb-3 pb-2 border-b border-[#333] text-center">Sources (착공시점)</div>
                                        <div className="flex gap-[20px] h-[360px] items-stretch relative">
                                            <div className="flex flex-col gap-1 w-[250px] shrink-0 h-full">
                                                <div className="bg-[#0A2640] text-white rounded text-center font-bold text-[13px] flex-[3] flex flex-col justify-center items-center shadow-inner border border-[#2997ff]/30">
                                                    <span>PF Loan<br/>Tranche A</span><span className="text-[#86868B] font-normal">5조 8,000억원 (LTV 75%)</span>
                                                </div>
                                                <div className="bg-[#0e7490] text-white rounded text-center font-bold text-[13px] flex-1 flex flex-col justify-center items-center shadow-inner border border-[#38bdf8]/30">
                                                    <span>PF Loan<br/>Tranche B</span><span className="text-[#a5f3fc] font-normal">4,500억원</span>
                                                </div>
                                                <div className="bg-[#0ea5e9] text-white rounded text-center font-bold text-[13px] flex-1 flex flex-col justify-center items-center shadow-inner border border-[#7dd3fc]/30">
                                                    <span>PF Loan<br/>Tranche C</span><span className="text-[#bae6fd] font-normal">3,000억원</span>
                                                </div>
                                                <div className="bg-[#e0f2fe] text-[#0A2640] rounded text-center font-bold text-[13px] flex-1 flex flex-col justify-center items-center border border-dashed border-[#0A2640]">
                                                    <span>Equity<br/>(보통주)</span><span className="text-[#0A2640]/70 font-normal">7,500억원</span>
                                                </div>
                                                <div className="bg-transparent border-2 border-dashed border-[#eab308] text-[#eab308] rounded text-center font-bold text-[13px] flex-1 flex flex-col justify-center items-center">
                                                    <span>Equity<br/>(우선주)</span><span className="text-[#eab308]/70 font-normal">8,000억원</span>
                                                </div>
                                            </div>
                                            <div className="flex-1 flex flex-col justify-between py-[10%]">
                                                <div className="bg-[#fce7f3] text-[#9d174d] py-4 px-2 rounded text-center font-bold text-[12px] leading-tight">대출기관</div>
                                                <div className="flex flex-col gap-2">
                                                    <div className="bg-[#002f4b] text-white py-3 px-2 rounded text-center font-bold text-[11px] leading-tight border border-white/20">기존 투자자(재투자)</div>
                                                    <div className="bg-[#9f1239] text-white py-3 px-2 rounded text-center font-bold text-[12px] leading-tight">KKR</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-[#333] flex justify-start gap-2 text-[14px] font-bold text-white">
                                            <span>총 재원조달 8조 1,000억원</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 4 && (
                        // 5. 재투자
                        <div className="flex flex-col items-center w-full">
                            <div className="w-[900px] flex flex-col">
                                <h3 className="text-[16px] text-white font-bold mb-[32px] w-full text-left tracking-tight">자산양수도를 통해 회수한 PFV의 자금 중 일부를 IPR의 보통주 증자 시, 재투자할 예정입니다.</h3>
                                <div className="flex items-center justify-between w-full">
                                {/* Left: YD Series */}
                                <div className="flex flex-col gap-6 w-[350px]">
                                    <div className="bg-[#2a2d24] border border-[#4d5341] rounded-[12px] overflow-hidden">
                                        <div className="bg-[#4d5341] text-white text-center font-bold py-2 text-[14px]">YD427PFV</div>
                                        <div className="p-3 flex flex-col gap-2 text-[12px]">
                                            <div className="border border-dashed border-[#eab308] p-2 rounded text-center text-[#E5E5E5] bg-[#1A1A1A]">우선주 (470억원)</div>
                                            <div className="border border-dashed border-[#eab308] p-2 rounded text-center text-white font-bold bg-[#1A1A1A]">보통주 (330억원)<br/><span className="text-[#A1A1AA] font-normal text-[11px]">이지스421호 등 (230억원)</span></div>
                                        </div>
                                    </div>
                                    <div className="bg-[#2a2d24] border border-[#4d5341] rounded-[12px] overflow-hidden">
                                        <div className="bg-[#4d5341] text-white text-center font-bold py-2 text-[14px]">YD816PFV</div>
                                        <div className="p-3 flex flex-col gap-2 text-[12px]">
                                            <div className="border border-dashed border-[#eab308] p-2 rounded text-center text-white font-bold bg-[#1A1A1A]">주주대여 및 Equity<br/><span className="text-[#A1A1AA] font-normal text-[11px]">이지스421호 (2,535억원)</span></div>
                                            <div className="border border-dashed border-[#eab308] p-2 rounded text-center text-white font-bold bg-[#1A1A1A]">보통주<br/><span className="text-[#A1A1AA] font-normal text-[11px]">소노인터내셔널 (700억원) 등</span></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Arrow */}
                                <div className="flex flex-col items-center flex-1 mx-4">
                                    <div className="w-full h-[2px] bg-[#2997ff] relative">
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-[#2997ff] border-b-[5px] border-b-transparent"></div>
                                    </div>
                                    <div className="text-[13px] font-bold text-[#2997ff] mt-2 bg-[#1A1A1A] px-3 py-1 rounded-full border border-[#2997ff]/30 shadow-md">Total 4,000억원 재투자</div>
                                    <div className="text-[11px] text-[#A1A1AA] mt-1 text-center">전체 Equity의 30% 조달</div>
                                </div>

                                {/* Right: IPR Equity */}
                                <div className="flex flex-col w-[250px] border border-dashed border-[#2997ff] rounded-[12px] overflow-hidden bg-[#0A2640]">
                                    <div className="bg-[#2997ff]/20 text-white text-center font-bold py-3 text-[15px] border-b border-[#2997ff]/30">IPR 보통주 Equity</div>
                                    <div className="p-6 flex flex-col items-center justify-center h-[180px] text-center">
                                        <span className="text-[24px] font-bold text-white tracking-tight">4,000억원</span>
                                        <span className="text-[13px] text-[#A1A1AA] mt-2">안정적인 사업구조 보강</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
}
