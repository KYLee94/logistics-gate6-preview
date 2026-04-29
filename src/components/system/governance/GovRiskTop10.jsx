import React from 'react';

export default function GovRiskTop10() {
    const riskData = [
        { no: 1, risk: '공정 지연 (시공·인허가 복합)', cell: '개발관리(<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">홍장군</span>)', trigger: '2주 누적 지연', final: 'PM' },
        { no: 2, risk: '사업비 UW 범위 외 증가', cell: 'PM(<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">강순용</span>)', trigger: 'UW +5% 누적', final: 'CFT 총괄' },
        { no: 3, risk: '대주단 Covenants 위반', cell: 'LFC(<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">박준호</span>)', trigger: 'DSCR/LTV 임계점', final: 'CFT 총괄' },
        { no: 4, risk: '핵심 임차인 이탈/철회', cell: 'EMC(<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">김민지</span>)', trigger: 'LOI 철회 통보', final: 'PM' },
        { no: 5, risk: '금리 환경 급변(리파이낸싱 옵션 훼손)', cell: 'LFC', trigger: '시장금리 ±50bp', final: 'CFT 총괄' },
        { no: 6, risk: 'LP 분배 지연 / 신뢰 하락', cell: 'KAM(<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">김행단</span>)', trigger: '분배 지연 30일', final: 'CFT 총괄' },
        { no: 7, risk: 'IPR 권순약정 협상 지연', cell: '프리츠 TFT(<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">권순일</span>)', trigger: 'Stage 2 지연 60일', final: 'CFT 총괄' },
        { no: 8, risk: '규제·인허가 변경', cell: '사업1파트(<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">권순일</span>)', trigger: '법령/지침 개정', final: '부문대표' },
        { no: 9, risk: '외부 자문 이해상충 노출', cell: 'CFT 총괄', trigger: '감정평가 5% 차이', final: '부문대표' },
        { no: 10, risk: '평판/미디어 리스크', cell: 'CFT 총괄', trigger: '외부 매체 보도', final: '부문대표' },
    ];

    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">Top 10 리스크 대응 방향</h1>
            <p className="text-[15px] text-[#86868B] mb-[36px]">리스크 등록부는 통합 데이터룸의 핵심 운영 도구입니다. 식별된 Top 10 리스크와 1차 대응 셀입니다.</p>
            
            <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-[24px] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#222]">
                        <tr>
                            <th className="px-[24px] py-[16px] text-[13px] font-bold text-[#555] border-b border-[#333] w-[60px] text-center">#</th>
                            <th className="px-[24px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333] border-r border-[#333] w-[300px]">리스크</th>
                            <th className="px-[24px] py-[16px] text-[13px] font-bold text-[#E5E5E5] border-b border-[#333] border-r border-[#333] w-[200px]">1차 대응 셀</th>
                            <th className="px-[24px] py-[16px] text-[13px] font-bold text-[#e11d48] border-b border-[#333] border-r border-[#333]">트리거</th>
                            <th className="px-[24px] py-[16px] text-[13px] font-bold text-[#fbf167] border-b border-[#333]">최종 책임</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                        {riskData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#292928] transition-colors">
                                <td className="px-[24px] py-[16px] text-[14px] font-bold text-[#555] text-center">{row.no}</td>
                                <td className="px-[24px] py-[16px] text-[15px] font-bold text-white border-r border-[#333]">{row.risk}</td>
                                <td className="px-[24px] py-[16px] text-[14px] text-[#A1A1AA] border-r border-[#333]" dangerouslySetInnerHTML={{ __html: row.cell }}></td>
                                <td className="px-[24px] py-[16px] text-[14px] font-medium text-[#c3c2b7] border-r border-[#333]">{row.trigger}</td>
                                <td className="px-[24px] py-[16px] text-[14px] font-bold text-[#E5E5E5]">{row.final}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
