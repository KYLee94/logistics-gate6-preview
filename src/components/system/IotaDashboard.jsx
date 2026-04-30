import React, { useState } from 'react';

const C_LEVEL = [
    { name: "전응준", role: "Co-PM 전략" },
    { name: "황인성", role: "Co-PM 사업" },
    { name: "김행단", role: "LFC" },
    { name: "한지원", role: "개발관리" },
    { name: "김민지", role: "EMC" },
    { name: "최진석", role: "SSC" }
];

const VEHICLES = [
    { id: "iota1", name: "Iota 1 (427)", legal: "PFV", phase: "본PF · 착공", contractor: "현대건설", arrangers: "신한·대신·NH증권", designers: "DA건축·Foster+Partners", progress: 28.4, status: "정상" },
    { id: "iota2", name: "Iota 2 (816)", legal: "PFV", phase: "리파이낸싱 · 철거", contractor: "삼성물산", arrangers: "NH·메리츠·신한", designers: "DA건축·SOM", progress: 12.1, status: "정상" },
    { id: "fund421", name: "421호 펀드", legal: "REF", phase: "운용 · 자본콜", contractor: "—", arrangers: "이지스자산운용", designers: "—", progress: 85, status: "정상" },
    { id: "ipr", name: "IPR (통합)", legal: "REITs", phase: "구조검토", contractor: "—", arrangers: "—", designers: "—", progress: 40, status: "Stage 2/5" }
];

const RISKS = [
    { id: 1, name: "건설 원가 상승 (Escalation)", cell: "개발관리", trigger: "예비비 80% 소진", level: "amber" },
    { id: 2, name: "책임준공 기한 지연", cell: "개발관리", trigger: "공정 지연 2주 누적", level: "amber" },
    { id: 3, name: "리파이낸싱 금리 변동성", cell: "파이낸싱(LFC)", trigger: "All-in 7% 초과", level: "green" },
    { id: 4, name: "오피스 초기 임대율 저조", cell: "기업마케팅(EMC)", trigger: "준공 D-6 50% 미달", level: "green" },
    { id: 5, name: "리테일 앵커 테넌트 이탈", cell: "기업마케팅(EMC)", trigger: "LOI 파기", level: "amber" }
];

export default function IotaDashboard() {
    return (
        <div className="w-full flex-1 flex flex-col pt-[50px] pb-[80px] max-w-[1400px] mx-auto px-6 overflow-y-auto hide-scrollbar">
            
            {/* Hero Section */}
            <div className="mb-[32px]">
                <h1 className="text-[40px] font-bold text-white tracking-tight leading-none mb-[12px]">이오타서울 Executive Dashboard</h1>
                <p className="text-[16px] text-[#A1A1AA] tracking-tight mb-[24px]">IGIS Iota CFT · 4대 축(PFV·Fund·CFT·IPR) 통합 거버넌스 단일 진실 화면</p>
                <div className="flex flex-wrap gap-3">
                    {C_LEVEL.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-[#292928] border border-[#3c3c3c] rounded-full">
                            <span className="text-[14px] font-bold text-white">{p.name}</span>
                            <span className="text-[12px] text-[#fbf167]">{p.role}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* KPI 4-Up Grid */}
            <div className="grid grid-cols-4 gap-5 mb-[40px]">
                {/* 1 */}
                <div className="bg-gradient-to-b from-[#292928] to-[#1A1A1A] border border-[#3c3c3c] rounded-[20px] p-[24px] relative overflow-hidden group hover:border-[#555] transition-colors">
                    <div className="absolute top-4 right-4"><span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#fbf167]/10 text-[#fbf167] border border-[#fbf167]/20 rounded-full">Live</span></div>
                    <h3 className="text-[14px] font-medium text-[#86868B] mb-[8px]">프로젝트 단계</h3>
                    <div className="text-[28px] font-bold text-white tracking-tight leading-tight mb-1">PF 후 · 개발</div>
                    <p className="text-[13px] text-[#A1A1AA]">Iota1·Iota2 본격 실행</p>
                </div>
                {/* 2 */}
                <div className="bg-gradient-to-b from-[#292928] to-[#1A1A1A] border border-[#3c3c3c] rounded-[20px] p-[24px] relative overflow-hidden group hover:border-[#555] transition-colors">
                    <div className="absolute top-4 right-4"><span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 rounded-full">Live</span></div>
                    <h3 className="text-[14px] font-medium text-[#86868B] mb-[8px]">90일 로드맵</h3>
                    <div className="text-[28px] font-bold text-white tracking-tight leading-tight mb-1">D+18</div>
                    <p className="text-[13px] text-[#A1A1AA]">현재 1차 안정화 구간</p>
                </div>
                {/* 3 */}
                <div className="bg-gradient-to-b from-[#292928] to-[#1A1A1A] border border-[#3c3c3c] rounded-[20px] p-[24px] relative overflow-hidden group hover:border-[#555] transition-colors">
                    <div className="absolute top-4 right-4"><span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 rounded-full">Live</span></div>
                    <h3 className="text-[14px] font-medium text-[#86868B] mb-[8px]">Top10 리스크</h3>
                    <div className="text-[28px] font-bold text-white tracking-tight leading-tight mb-1">3 <span className="text-[18px] text-[#666]">/ 10</span></div>
                    <p className="text-[13px] text-[#A1A1AA]">Amber 이상 주의 요망</p>
                </div>
                {/* 4 */}
                <div className="bg-gradient-to-b from-[#292928] to-[#1A1A1A] border border-[#3c3c3c] rounded-[20px] p-[24px] relative overflow-hidden group hover:border-[#555] transition-colors">
                    <div className="absolute top-4 right-4"><span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20 rounded-full">Live</span></div>
                    <h3 className="text-[14px] font-medium text-[#86868B] mb-[8px]">LP NPS (421호)</h3>
                    <div className="text-[28px] font-bold text-white tracking-tight leading-tight mb-1">72<span className="text-[18px] text-[#666] ml-1">점</span></div>
                    <p className="text-[13px] text-[#A1A1AA]">분기보고 정례화 정착</p>
                </div>
            </div>

            {/* Vehicle 4-up */}
            <div className="flex items-center justify-between mb-[20px]">
                <h2 className="text-[20px] font-bold text-white">Vehicle별 단면 <span className="text-[14px] font-normal text-[#666] ml-2">(Click → 상세)</span></h2>
            </div>
            <div className="grid grid-cols-4 gap-5 mb-[40px]">
                {VEHICLES.map(v => (
                    <div key={v.id} className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-[20px] p-[24px] hover:border-[#666] hover:bg-[#222] transition-all cursor-pointer group flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-[4px]">
                                <h3 className="text-[16px] font-bold text-white">{v.name} <span className="text-[13px] font-normal text-[#86868B]">{v.legal}</span></h3>
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${v.status === '정상' ? 'bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20' : 'bg-[#fbf167]/10 text-[#fbf167] border border-[#fbf167]/20'}`}>{v.status}</span>
                            </div>
                            <p className="text-[13px] text-[#A1A1AA] mb-[16px] pb-[12px] border-b border-[#333]">{v.phase}</p>
                            
                            <dl className="flex flex-col gap-2 mb-[24px]">
                                <div className="flex justify-between">
                                    <dt className="text-[12px] text-[#666]">시공</dt>
                                    <dd className="text-[12px] font-medium text-[#E5E5E5] text-right">{v.contractor}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-[12px] text-[#666]">주관사</dt>
                                    <dd className="text-[12px] font-medium text-[#E5E5E5] text-right">{v.arrangers}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-[12px] text-[#666]">설계</dt>
                                    <dd className="text-[12px] font-medium text-[#E5E5E5] text-right">{v.designers}</dd>
                                </div>
                            </dl>
                        </div>
                        
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-[11px] text-[#666]">진척도</span>
                                <span className="text-[13px] font-bold text-white">{v.progress}%</span>
                            </div>
                            <div className="w-full bg-[#333] h-[4px] rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-[#fbf167] to-white rounded-full" style={{ width: `${v.progress}%` }}></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 5 Dashboards */}
            <h2 className="text-[20px] font-bold text-white mb-[20px]">5대 핵심 대시보드</h2>
            <div className="grid grid-cols-2 gap-5 mb-[40px]">
                
                {/* 1. Slippage */}
                <div className="bg-[#1A1A1A] border border-[#3c3c3c] rounded-[20px] p-[24px]">
                    <div className="flex justify-between items-center mb-[20px]">
                        <h3 className="text-[16px] font-bold text-white">공정·예산 슬리피지 (PFV별)</h3>
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 rounded-full">Watch</span>
                    </div>
                    
                    <div className="mb-[16px]">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[14px] font-bold text-white">Iota 1 (427)</span>
                            <span className="text-[12px] text-[#A1A1AA]">예산 <span className="text-[#34d399]">+0%</span> · 일정 <span className="text-[#34d399]">0d</span></span>
                        </div>
                        <div className="w-full bg-[#333] h-[6px] rounded-full overflow-hidden"><div className="h-full bg-[#fbf167] rounded-full w-[28.4%]"></div></div>
                    </div>
                    
                    <div className="mb-[20px]">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[14px] font-bold text-white">Iota 2 (816)</span>
                            <span className="text-[12px] text-[#A1A1AA]">예산 <span className="text-[#e11d48]">-1.2%</span> · 일정 <span className="text-[#34d399]">0d</span></span>
                        </div>
                        <div className="w-full bg-[#333] h-[6px] rounded-full overflow-hidden"><div className="h-full bg-[#fbf167] rounded-full w-[12.1%]"></div></div>
                    </div>
                    
                    <div className="text-[11px] text-[#666] bg-[#222] p-2 rounded-lg">트리거: UW +5% 누적 / 2주 누적 지연 → 운영위 임시 소집</div>
                </div>

                {/* 2. Covenants */}
                <div className="bg-[#1A1A1A] border border-[#3c3c3c] rounded-[20px] p-[24px]">
                    <div className="flex justify-between items-center mb-[20px]">
                        <h3 className="text-[16px] font-bold text-white">대주단 Covenants 모니터링</h3>
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20 rounded-full">정상</span>
                    </div>
                    <table className="w-full text-left mb-[20px]">
                        <thead>
                            <tr className="border-b border-[#333] text-[12px] text-[#666]">
                                <th className="pb-2 font-medium">딜</th>
                                <th className="pb-2 font-medium">지표</th>
                                <th className="pb-2 font-medium">상태</th>
                            </tr>
                        </thead>
                        <tbody className="text-[13px]">
                            <tr className="border-b border-[#222]">
                                <td className="py-2.5 font-bold text-[#E5E5E5]">Iota 1 본PF</td>
                                <td className="py-2.5 text-[#A1A1AA]">DSCR 1.42 / LTV 58%</td>
                                <td className="py-2.5"><span className="text-[11px] px-2 py-0.5 bg-[#34d399]/10 text-[#34d399] rounded">정상</span></td>
                            </tr>
                            <tr className="border-b border-[#222]">
                                <td className="py-2.5 font-bold text-[#E5E5E5]">Iota 2 리파이낸싱</td>
                                <td className="py-2.5 text-[#A1A1AA]">DSCR 1.55 / LTV 55%</td>
                                <td className="py-2.5"><span className="text-[11px] px-2 py-0.5 bg-[#34d399]/10 text-[#34d399] rounded">정상</span></td>
                            </tr>
                            <tr>
                                <td className="py-2.5 font-bold text-[#E5E5E5]">통합 PF (예정)</td>
                                <td className="py-2.5 text-[#A1A1AA]">Term Sheet 협의</td>
                                <td className="py-2.5"><span className="text-[11px] px-2 py-0.5 bg-[#3b82f6]/10 text-[#3b82f6] rounded">준비</span></td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="text-[11px] text-[#666] bg-[#222] p-2 rounded-lg">위반 가능성 식별 시 24시간 내 LFC 주재 긴급 라운드 + 대주단 통지</div>
                </div>

                {/* 3. LM Pipeline */}
                <div className="bg-[#1A1A1A] border border-[#3c3c3c] rounded-[20px] p-[24px]">
                    <div className="flex justify-between items-center mb-[20px]">
                        <h3 className="text-[16px] font-bold text-white">LM 파이프라인 (NDA → 계약)</h3>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-[20px]">
                        <div className="bg-[#292928] border border-[#3c3c3c] rounded-[12px] p-3 text-center flex flex-col items-center justify-center">
                            <span className="text-[11px] text-[#A1A1AA] mb-1">NDA</span>
                            <span className="text-[24px] font-bold text-white leading-none">14</span>
                        </div>
                        <div className="bg-[#292928] border border-[#3c3c3c] rounded-[12px] p-3 text-center flex flex-col items-center justify-center">
                            <span className="text-[11px] text-[#A1A1AA] mb-1">피칭</span>
                            <span className="text-[24px] font-bold text-white leading-none">9</span>
                        </div>
                        <div className="bg-[#292928] border border-[#3c3c3c] rounded-[12px] p-3 text-center flex flex-col items-center justify-center border-b-2 border-b-[#fbf167]">
                            <span className="text-[11px] text-[#fbf167] mb-1">LOI</span>
                            <span className="text-[24px] font-bold text-white leading-none">4</span>
                        </div>
                        <div className="bg-[#292928] border border-[#3c3c3c] rounded-[12px] p-3 text-center flex flex-col items-center justify-center border-b-2 border-b-[#34d399]">
                            <span className="text-[11px] text-[#34d399] mb-1">계약</span>
                            <span className="text-[24px] font-bold text-white leading-none">1</span>
                        </div>
                    </div>
                    <div className="text-[11px] text-[#666] bg-[#222] p-2 rounded-lg">주관: EMC 김민지 / 단계별 전환율 분기 점검 (성과약정 KPI)</div>
                </div>

                {/* 4. IPR Stage */}
                <div className="bg-[#1A1A1A] border border-[#3c3c3c] rounded-[20px] p-[24px]">
                    <div className="flex justify-between items-center mb-[20px]">
                        <h3 className="text-[16px] font-bold text-white">IPR 사전 준비 진척 (Stage 0~5)</h3>
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#fbf167]/10 text-[#fbf167] border border-[#fbf167]/20 rounded-full">Stage 2/5</span>
                    </div>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><span className="text-[#fbf167] text-[13px] font-bold">Stage 1</span><span className="text-[13px] text-white">자산실사 및 밸류에이션</span></div>
                            <span className="text-[11px] text-[#fbf167] px-2 py-0.5 bg-[#222] rounded border border-[#333]">진행/완료</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><span className="text-[#fbf167] text-[13px] font-bold">Stage 2</span><span className="text-[13px] text-white">매매구조 검토</span></div>
                            <span className="text-[11px] text-[#fbf167] px-2 py-0.5 bg-[#222] rounded border border-[#333]">진행/완료</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><span className="text-[#666] text-[13px] font-bold">Stage 3</span><span className="text-[13px] text-[#A1A1AA]">LOI 제출 및 MOU</span></div>
                            <span className="text-[11px] text-[#666] px-2 py-0.5 bg-[#222] rounded border border-[#333]">대기</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><span className="text-[#666] text-[13px] font-bold">Stage 4</span><span className="text-[13px] text-[#A1A1AA]">본계약 (SPA)</span></div>
                            <span className="text-[11px] text-[#666] px-2 py-0.5 bg-[#222] rounded border border-[#333]">대기</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top 10 Risks Compact */}
            <h2 className="text-[20px] font-bold text-white mb-[20px]">Top10 리스크 (요약)</h2>
            <div className="bg-[#1A1A1A] border border-[#3c3c3c] rounded-[20px] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#222]">
                        <tr className="text-[12px] text-[#86868B]">
                            <th className="px-6 py-3 font-medium w-[60px]">#</th>
                            <th className="px-6 py-3 font-medium">리스크</th>
                            <th className="px-6 py-3 font-medium">트리거</th>
                            <th className="px-6 py-3 font-medium w-[100px]">상태</th>
                        </tr>
                    </thead>
                    <tbody className="text-[13px]">
                        {RISKS.map(r => (
                            <tr key={r.id} className="border-t border-[#333] hover:bg-[#222] transition-colors">
                                <td className="px-6 py-3 text-[#666] font-mono">#{r.id}</td>
                                <td className="px-6 py-3 font-bold text-[#E5E5E5]">{r.name}</td>
                                <td className="px-6 py-3 text-[#A1A1AA]">{r.trigger}</td>
                                <td className="px-6 py-3">
                                    <span className={`text-[11px] px-2 py-0.5 rounded border ${
                                        r.level === 'amber' ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20' : 
                                        'bg-[#34d399]/10 text-[#34d399] border-[#34d399]/20'
                                    }`}>
                                        {r.level === 'amber' ? '주의' : '정상'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

        </div>
    );
}
