import React from 'react';

export default function GovPfvRules() {
    const rulesData = [
        { partner: '시공사', window: '개발솔루션 <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">홍장군</span>', backup: 'Co-PM <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">권순일</span> / <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">강순용</span>', auth: 'UW 범위 내 자율, UW 외는 PM/CFT 운영위 승인' },
        { partner: '설계사', window: '개발솔루션 설계담당(<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">김대익</span>·<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">장성진</span>)', backup: 'PM <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">강순용</span>', auth: 'Alt 결정은 PM 단독, 상품 변경은 SSC 협의' },
        { partner: 'CM/감리', window: '개발솔루션 건설담당', backup: 'PM <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">강순용</span>', auth: '월 1회 정기 보고, 사고 즉시 보고' },
        { partner: '증권사 (PF 주관)', window: 'LFC <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">박준호</span>', backup: 'Co-PM <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">권순일</span> / <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">강순용</span>', auth: '리파이낸싱 옵션 상시 검토, 조건 변경은 운영위' },
        { partner: '대주단 (본PF·통합PF)', window: 'LFC <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">박준호</span>', backup: '운용지원 자금팀', auth: 'Covenants 보드 월간, 위반 시 24시간 내 통지' },
        { partner: '잠재 임차인', window: 'EMC <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">김민지</span>', backup: 'KAM 1파트 (운영기 이후)', auth: 'UW 범위 외 임대차는 운영위 결재' },
        { partner: 'LM사 (외주)', window: 'EMC <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">고아라</span>', backup: 'KAM 1파트', auth: '성과 약정 KPI 분기 점검' },
        { partner: '규제 당국·지자체', window: '사업1파트 <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">권순일</span>', backup: '개발솔루션 인허가(<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">이정훈</span>)', auth: 'PFV 재구조화·국토부 협의는 권순일 단독' },
        { partner: 'LP (수익자)', window: 'KAM 1파트 <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">김행단</span>', backup: 'CFT 총괄', auth: 'Q&A 단일 채널, 운영위 사전검토 필수' },
        { partner: '외부 법무·회계·감정 (IPR)', window: '프리츠 TFT <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">권순일</span>', backup: 'PM <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">강순용</span> (사실관계 한정)', auth: '자료 외부 반출 시 워터마크·로그' },
    ];

    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">PFV 단일 창구 운영 원칙</h1>
            <p className="text-[15px] text-[#86868B] mb-[36px]">외부 파트너로부터 ‘동일 사안에 대해 다른 답이 나가는 상황’을 원천 차단하기 위해 단일 창구를 지정합니다.</p>
            
            <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-[24px] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#222]">
                        <tr>
                            <th className="px-[24px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333] border-r border-[#333] w-[180px]">외부 파트너</th>
                            <th className="px-[24px] py-[16px] text-[13px] font-bold text-[#fbf167] border-b border-[#333] border-r border-[#333] w-[220px]">1차 단일창구</th>
                            <th className="px-[24px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333] border-r border-[#333] w-[200px]">백업 창구</th>
                            <th className="px-[24px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">승인 한도 / 주의</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                        {rulesData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#292928] transition-colors">
                                <td className="px-[24px] py-[16px] text-[15px] font-bold text-[#E5E5E5] border-r border-[#333]">{row.partner}</td>
                                <td className="px-[24px] py-[16px] text-[15px] text-[#E5E5E5] border-r border-[#333]" dangerouslySetInnerHTML={{ __html: row.window }}></td>
                                <td className="px-[24px] py-[16px] text-[14px] text-[#A1A1AA] border-r border-[#333]" dangerouslySetInnerHTML={{ __html: row.backup }}></td>
                                <td className="px-[24px] py-[16px] text-[14px] text-[#A1A1AA]">{row.auth}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
