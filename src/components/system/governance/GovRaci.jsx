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

    const renderBadge = (role) => {
        const baseClass = "inline-block min-w-[36px] px-2 py-1 rounded-md font-bold text-[14px] text-center";
        if (role === 'A') return <span className={`${baseClass} bg-[#4f46e5]/40 text-[#c7d2fe]`}>A</span>;
        if (role === 'R') return <span className={`${baseClass} bg-[#059669]/40 text-[#a7f3d0]`}>R</span>;
        if (role === 'A/R') return <span className={`${baseClass} bg-[#d97706]/40 text-[#fde68a]`}>A/R</span>;
        if (role === 'C') return <span className={`${baseClass} bg-[#4b5563]/60 text-[#e5e7eb]`}>C</span>;
        if (role === 'I') return <span className={`${baseClass} bg-[#0ea5e9]/40 text-[#bae6fd]`}>I</span>;
        return role;
    };

    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[24px]">RACI 매트릭스</h1>
            <div className="flex items-center gap-8 mb-[36px] bg-transparent border border-[#333] p-5 rounded-[24px]">
                <div className="flex items-center gap-3"><span className="inline-block min-w-[36px] px-2 py-1 rounded-md font-bold text-[14px] text-center bg-[#4f46e5]/40 text-[#c7d2fe]">A</span> <span className="text-white text-[14px]">최종 결정 및 승인 (Accountable)</span></div>
                <div className="flex items-center gap-3"><span className="inline-block min-w-[36px] px-2 py-1 rounded-md font-bold text-[14px] text-center bg-[#059669]/40 text-[#a7f3d0]">R</span> <span className="text-white text-[14px]">실무 주관 및 실행 (Responsible)</span></div>
                <div className="flex items-center gap-3"><span className="inline-block min-w-[36px] px-2 py-1 rounded-md font-bold text-[14px] text-center bg-[#4b5563]/60 text-[#e5e7eb]">C</span> <span className="text-white text-[14px]">사전 협의 및 자문 (Consulted)</span></div>
                <div className="flex items-center gap-3"><span className="inline-block min-w-[36px] px-2 py-1 rounded-md font-bold text-[14px] text-center bg-[#0ea5e9]/40 text-[#bae6fd]">I</span> <span className="text-white text-[14px]">사후 결과 통보 (Informed)</span></div>
            </div>
            
            <div className="w-full border border-[#333] rounded-[24px] overflow-hidden">
                <table className="w-full text-center">
                    <thead className="bg-transparent">
                        <tr>
                            <th className="px-[24px] py-[16px] text-[14px] font-bold text-[#86868B] border-b border-[#333] border-r border-[#333] w-[260px] text-left">의사결정 영역</th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-white border-b border-[#333] border-r border-[#333]">PM<br/><span className="text-white font-normal text-[14px] block mt-[2px]">강순용</span></th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-white border-b border-[#333] border-r border-[#333]">LFC<br/><span className="text-white font-normal text-[14px] block mt-[2px]">박준호</span></th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-white border-b border-[#333] border-r border-[#333]">개발<br/><span className="text-white font-normal text-[14px] block mt-[2px]">홍장군</span></th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-white border-b border-[#333] border-r border-[#333]">EMC<br/><span className="text-white font-normal text-[14px] block mt-[2px]">김민지</span></th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-white border-b border-[#333] border-r border-[#333]">KAM<br/><span className="text-white font-normal text-[14px] block mt-[2px]">김행단</span></th>
                            <th className="px-[12px] py-[16px] text-[14px] font-bold text-[#fbf167] border-b border-[#333]">CFT총괄<br/><span className="text-white font-normal text-[14px] block mt-[2px]">이철승</span></th>
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
        </div>
    );
}
