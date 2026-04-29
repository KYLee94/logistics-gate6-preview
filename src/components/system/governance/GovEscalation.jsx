import React from 'react';

export default function GovEscalation() {
    const esData = [
        { trigger: 'UW 범위 외 일정/예산 변경', actor: 'PM <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">강순용</span>', step1: 'CFT 운영위 임시 소집', final: '부문대표 승인 + LP 통지' },
        { trigger: 'Covenants 위반 가능성', actor: 'LFC <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">박준호</span>', step1: 'PM·KAM·법무 자문 라운드', final: '부문대표 승인 후 대주단 통지' },
        { trigger: '핵심 임차인 LOI 철회', actor: 'EMC <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">김민지</span>', step1: 'PM·SSC·KAM 임시 LM 회의', final: 'PM 결정, 영향분석 후 운영위 통지' },
        { trigger: '규제·인허가·소송', actor: '<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">권순일</span> / <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">이정훈</span>', step1: '외부 송무 자문 + CFT 총괄 검토', final: '부문대표·법무 공동 결정, LP 통지' },
        { trigger: '미디어/평판 이슈', actor: 'PM / CFT 총괄', step1: '부문 커뮤니케이션 (외부 PR 자문)', final: '부문대표 단독 (24시간 내)' },
        { trigger: 'LP 임시 출자/분배 요청', actor: 'KAM <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">김행단</span>', step1: 'LFC·운용지원 검토', final: 'CFT 운영위 승인 → 자금집행' },
    ];

    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">주요 사안 에스컬레이션 라인</h1>
            <p className="text-[15px] text-[#86868B] mb-[36px]">외부 파트너와의 사안이 ‘일상’의 범위를 넘는 순간 에스컬레이션 라인이 자동 작동합니다.</p>
            
            <div className="flex flex-col gap-3">
                {esData.map((row, idx) => (
                    <div key={idx} className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[20px] flex items-center hover:border-[#555] transition-colors">
                        <div className="w-[280px] pr-4">
                            <span className="block text-[13px] text-[#e11d48] font-bold mb-1">Trigger</span>
                            <span className="text-[15px] font-bold text-white">{row.trigger}</span>
                            <div className="text-[13px] text-[#A1A1AA] mt-1" dangerouslySetInnerHTML={{ __html: row.actor }}></div>
                        </div>
                        
                        <div className="flex-1 flex items-center px-4">
                            <div className="w-[40px] flex justify-center text-[#555]">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                            </div>
                            <div className="flex-1 text-center bg-[#1A1A1A] border border-[#333] rounded-[8px] py-3 px-4">
                                <span className="text-[13px] text-[#86868B] block mb-1">1차 에스컬레이션</span>
                                <span className="text-[14px] text-[#E5E5E5] font-medium">{row.step1}</span>
                            </div>
                            <div className="w-[40px] flex justify-center text-[#555]">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                            </div>
                        </div>

                        <div className="w-[280px] pl-4 text-right">
                            <span className="block text-[13px] text-[#fbf167] font-bold mb-1">Final Decision</span>
                            <span className="text-[15px] font-bold text-white">{row.final}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
