import React from 'react';

export default function GovExternalComm() {
    const rulesData = [
        { partner: '시공사', windowText: '개발솔루션 ', members: ['홍장군'], backup: 'Co-PM <span className="text-[#E5E5E5] hover:text-[#2997FF] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#2997FF]/50">권순일</span> / <span className="text-[#E5E5E5] hover:text-[#2997FF] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#2997FF]/50">강순용</span>', auth: 'UW 범위 내 자율, UW 외는 PM/CFT 운영위 승인' },
        { partner: '설계사', windowText: '개발솔루션 ', members: ['김대익', '장성진'], backup: 'PM <span className="text-[#E5E5E5] hover:text-[#2997FF] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#2997FF]/50">강순용</span>', auth: 'Alt 결정은 PM 단독, 상품 변경은 SSC 협의' },
        { partner: 'CM/감리', windowText: '개발솔루션 건설담당', members: [], backup: 'PM <span className="text-[#E5E5E5] hover:text-[#2997FF] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#2997FF]/50">강순용</span>', auth: '월 1회 정기 보고, 사고 즉시 보고' },
        { partner: '증권사 (PF 주관)', windowText: 'LFC ', members: ['박준호'], backup: 'Co-PM <span className="text-[#E5E5E5] hover:text-[#2997FF] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#2997FF]/50">권순일</span> / <span className="text-[#E5E5E5] hover:text-[#2997FF] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#2997FF]/50">강순용</span>', auth: '리파이낸싱 옵션 상시 검토, 조건 변경은 운영위' },
        { partner: '대주단 (본PF·통합PF)', windowText: 'LFC ', members: ['박준호'], backup: '운용지원 자금팀', auth: 'Covenants 보드 월간, 위반 시 24시간 내 통지' },
        { partner: '잠재 임차인', windowText: 'EMC ', members: ['김민지'], backup: 'KAM 1파트 (운영기 이후)', auth: 'UW 범위 외 임대차는 운영위 결재' },
        { partner: 'LM사 (외주)', windowText: 'EMC ', members: ['고아라'], backup: 'KAM 1파트', auth: '성과 약정 KPI 분기 점검' },
        { partner: '규제 당국·지자체', windowText: '사업1파트 ', members: ['권순일'], backup: '개발솔루션 인허가(<span className="text-[#E5E5E5] hover:text-[#2997FF] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#2997FF]/50">이정훈</span>)', auth: 'PFV 재구조화·국토부 협의는 권순일 단독' },
        { partner: 'LP (수익자)', windowText: 'KAM 1파트 ', members: ['김행단'], backup: 'CFT 총괄', auth: 'Q&A 단일 채널, 운영위 사전검토 필수' },
        { partner: '외부 법무·회계·감정 (IPR)', windowText: '프리츠 TFT ', members: ['권순일'], backup: 'PM <span className="text-[#E5E5E5] hover:text-[#2997FF] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#2997FF]/50">강순용</span> (사실관계 한정)', auth: '자료 외부 반출 시 워터마크·로그' },
    ];

    const renderWindow = (text, members) => {
        return (
            <div className="flex flex-col gap-2">
                <div>
                    {text}
                    {members.map((name, idx) => (
                        <React.Fragment key={idx}>
                            <span className="text-[#E5E5E5] hover:text-[#2997FF] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#2997FF]/50">{name}</span>
                            {idx < members.length - 1 && '·'}
                        </React.Fragment>
                    ))}
                </div>
                {members.length > 0 && (
                    <div className="flex gap-2">
                        {members.map((name, idx) => (
                            <div key={idx} className="w-[28px] h-[28px] rounded-full overflow-hidden bg-[#3c3c3c] border border-[#444]">
                                <img src={`/${name}.webp`} alt={name} className="w-full h-full object-cover" onError={(e) => { e.target.src = '/default_avatar.svg'; }} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const esData = [
        { trigger: 'UW 범위 외 일정/예산 변경', actor: 'PM <span className="text-[#E5E5E5] hover:text-[#2997FF] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#2997FF]/50">강순용</span>', step1: 'CFT 운영위 임시 소집', final: '부문대표 승인 + LP 통지' },
        { trigger: 'Covenants 위반 가능성', actor: 'LFC <span className="text-[#E5E5E5] hover:text-[#2997FF] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#2997FF]/50">박준호</span>', step1: 'PM·KAM·법무 자문 라운드', final: '부문대표 승인 후 대주단 통지' },
        { trigger: '핵심 임차인 LOI 철회', actor: 'EMC <span className="text-[#E5E5E5] hover:text-[#2997FF] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#2997FF]/50">김민지</span>', step1: 'PM·SSC·KAM 임시 LM 회의', final: 'PM 결정, 영향분석 후 운영위 통지' },
        { trigger: '규제·인허가·소송', actor: '<span className="text-[#E5E5E5] hover:text-[#2997FF] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#2997FF]/50">권순일</span> / <span className="text-[#E5E5E5] hover:text-[#2997FF] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#2997FF]/50">이정훈</span>', step1: '외부 송무 자문 + CFT 총괄 검토', final: '부문대표·법무 공동 결정, LP 통지' },
        { trigger: '미디어/평판 이슈', actor: 'PM / CFT 총괄', step1: '부문 커뮤니케이션 (외부 PR 자문)', final: '부문대표 단독 (24시간 내)' },
        { trigger: 'LP 임시 출자/분배 요청', actor: 'KAM <span className="text-[#E5E5E5] hover:text-[#2997FF] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#2997FF]/50">김행단</span>', step1: 'LFC·운용지원 검토', final: 'CFT 운영위 승인 → 자금집행' },
    ];

    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[160px] max-w-[1112px] mx-auto">
            <h1 className="text-[37px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">대외 소통 정책</h1>
            <p className="text-[16px] text-[#86868B] mb-[48px]">외부 파트너로부터의 혼선을 원천 차단하기 위한 단일 창구를 지정하고, 일상의 범위를 넘어서는 주요 사안에 대한 에스컬레이션 라인을 통합 규정합니다.</p>
            
            <h2 className="text-[20px] font-bold text-white mb-[16px]">PFV 단일 창구 운영 원칙</h2>
            <div className="w-full bg-transparent border border-[#333] rounded-[24px] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-transparent">
                        <tr>
                            <th className="px-[24px] py-[16px] text-[14px] font-bold text-[#86868B] border-b border-[#333] border-r border-[#333] w-[200px]">외부 파트너</th>
                            <th className="px-[24px] py-[16px] text-[14px] font-bold text-[#2997FF] border-b border-[#333] border-r border-[#333] w-[260px]">1차 단일창구</th>
                            <th className="px-[24px] py-[16px] text-[14px] font-bold text-[#86868B] border-b border-[#333] border-r border-[#333] w-[200px]">백업 창구</th>
                            <th className="px-[24px] py-[16px] text-[14px] font-bold text-[#86868B] border-b border-[#333]">승인 한도 / 주의</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                        {rulesData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#292928] transition-colors">
                                <td className="px-[24px] py-[16px] text-[15px] font-bold text-[#E5E5E5] border-r border-[#333] whitespace-nowrap">{row.partner}</td>
                                <td className="px-[24px] py-[16px] text-[15px] font-bold text-[#E5E5E5] border-r border-[#333] whitespace-nowrap">{renderWindow(row.windowText, row.members)}</td>
                                <td className="px-[24px] py-[16px] text-[14px] text-[#A1A1AA] border-r border-[#333]" dangerouslySetInnerHTML={{ __html: row.backup }}></td>
                                <td className="px-[24px] py-[16px] text-[14px] text-[#A1A1AA]">{row.auth}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="w-full h-px bg-[#333] my-[56px]"></div>

            <h2 className="text-[20px] font-bold text-white mb-[16px]">범위 외 사안 에스컬레이션 라인</h2>
            <div className="flex flex-col gap-[16px]">
                {esData.map((row, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row md:items-stretch gap-[4px] group">
                        
                        {/* Left Box (Trigger) */}
                        <div className="flex-1 flex flex-col justify-center bg-[#1E1E1E] border border-[#3c3c3c] rounded-[16px] p-[20px] transition-colors group-hover:bg-[#292928]">
                            <div className="flex items-center mb-[8px]">
                                <div className="w-[8px] h-[8px] rounded-full bg-[#e11d48] mr-[12px] shrink-0"></div>
                                <span className="text-[13px] text-[#e11d48] font-bold">Trigger</span>
                            </div>
                            <div className="text-[18px] text-[#E5E5E5] font-medium text-left leading-snug pl-[20px] mb-[4px]">{row.trigger}</div>
                            <div className="text-[14px] text-[#A1A1AA] pl-[20px]" dangerouslySetInnerHTML={{ __html: row.actor }}></div>
                        </div>

                        {/* Arrow */}
                        <div className="flex items-center justify-center text-[#666] shrink-0">
                            <svg className="hidden md:block" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                            <svg className="block md:hidden" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                        </div>

                        {/* Middle Box (1차 에스컬레이션) */}
                        <div className="flex-1 flex flex-col justify-center bg-[#1E1E1E] border border-[#3c3c3c] rounded-[16px] p-[20px] transition-colors group-hover:bg-[#292928]">
                            <div className="flex items-center mb-[8px]">
                                <div className="w-[8px] h-[8px] rounded-full bg-[#86868B] mr-[12px] shrink-0"></div>
                                <span className="text-[13px] text-[#86868B] font-bold">1차 에스컬레이션</span>
                            </div>
                            <div className="text-[18px] text-[#E5E5E5] font-medium text-left leading-snug pl-[20px]">{row.step1}</div>
                        </div>

                        {/* Arrow */}
                        <div className="flex items-center justify-center text-[#666] shrink-0">
                            <svg className="hidden md:block" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                            <svg className="block md:hidden" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                        </div>

                        {/* Right Box (Final Decision) */}
                        <div className="flex-1 flex flex-col justify-center bg-[#1E1E1E] border border-[#3c3c3c] rounded-[16px] p-[20px] transition-colors group-hover:bg-[#292928]">
                            <div className="flex items-center mb-[8px]">
                                <div className="w-[8px] h-[8px] rounded-full bg-[#2997FF] mr-[12px] shrink-0"></div>
                                <span className="text-[13px] text-[#2997FF] font-bold">Final Decision</span>
                            </div>
                            <div className="text-[18px] text-[#2997FF] font-bold text-left leading-snug pl-[20px]">{row.final}</div>
                        </div>

                    </div>
                ))}
            </div>

            <div className="w-full h-px bg-[#333] my-[56px]"></div>

            <h2 className="text-[20px] font-bold text-white mb-[16px]">정보보호 및 NDA 통제 원칙</h2>
            <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-[24px] p-[32px]">
                <ul className="flex flex-col gap-[16px]">
                    <li className="flex items-start">
                        <div className="w-[6px] h-[6px] rounded-full bg-[#86868B] mt-[10px] mr-[16px] shrink-0"></div>
                        <span className="text-[16px] text-[#E5E5E5] leading-[26px]">외부 자료 송부는 통합 데이터룸의 '공유 폴더'만 사용하며, 직접 이메일 첨부는 원칙적으로 금지한다.</span>
                    </li>
                    <li className="flex items-start">
                        <div className="w-[6px] h-[6px] rounded-full bg-[#86868B] mt-[10px] mr-[16px] shrink-0"></div>
                        <span className="text-[16px] text-[#E5E5E5] leading-[26px]">IPR 관련 자료(권순약정·감정평가 등)는 워터마크·DRM 설정을 의무화한다.</span>
                    </li>
                    <li className="flex items-start">
                        <div className="w-[6px] h-[6px] rounded-full bg-[#86868B] mt-[10px] mr-[16px] shrink-0"></div>
                        <span className="text-[16px] text-[#E5E5E5] leading-[26px]">NDA 체결 후에도 '열람 가능 인원 명단'을 자료별로 별도 관리한다.</span>
                    </li>
                    <li className="flex items-start">
                        <div className="w-[6px] h-[6px] rounded-full bg-[#86868B] mt-[10px] mr-[16px] shrink-0"></div>
                        <span className="text-[16px] text-[#E5E5E5] leading-[26px]">외부 파트너가 다수 프로젝트에 동시 참여하는 경우(예: 시공사가 부문 내 타 프로젝트에 동시 참여), 이오타 전담 인력의 '차이니스월'을 명시 요청한다.</span>
                    </li>
                    <li className="flex items-start">
                        <div className="w-[6px] h-[6px] rounded-full bg-[#86868B] mt-[10px] mr-[16px] shrink-0"></div>
                        <span className="text-[16px] text-[#E5E5E5] leading-[26px]">미디어 노출(언론 인터뷰·사진 촬영 등)은 부문 커뮤니케이션 라인을 거쳐 부문대표 사전 승인 후에만 가능하다.</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
