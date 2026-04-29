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
        if (role === 'A') return <span className="px-2 py-1 bg-[#4f46e5]/20 text-[#818cf8] rounded-md font-bold text-[13px]">A</span>;
        if (role === 'R') return <span className="px-2 py-1 bg-[#059669]/20 text-[#34d399] rounded-md font-bold text-[13px]">R</span>;
        if (role === 'A/R') return <span className="px-2 py-1 bg-[#d97706]/20 text-[#fbbf24] rounded-md font-bold text-[13px]">A/R</span>;
        if (role === 'C') return <span className="px-2 py-1 bg-[#4b5563]/50 text-[#9ca3af] rounded-md font-bold text-[13px]">C</span>;
        if (role === 'I') return <span className="px-2 py-1 text-[#6b7280] rounded-md font-normal text-[13px]">I</span>;
        return role;
    };

    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[16px]">RACI 매트릭스</h1>
            <p className="text-[15px] text-[#86868B] mb-[36px]">A=최종책임자(승인), R=실행자(주관), C=협의자, I=통보</p>
            
            <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-[24px] overflow-hidden">
                <table className="w-full text-center">
                    <thead className="bg-[#222]">
                        <tr>
                            <th className="px-[24px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333] border-r border-[#333] w-[260px] text-left">의사결정 영역</th>
                            <th className="px-[12px] py-[16px] text-[13px] font-bold text-white border-b border-[#333] border-r border-[#333]">PM<br/><span className="text-[#666] font-normal text-[11px] block mt-1">강순용</span></th>
                            <th className="px-[12px] py-[16px] text-[13px] font-bold text-white border-b border-[#333] border-r border-[#333]">LFC<br/><span className="text-[#666] font-normal text-[11px] block mt-1">박준호</span></th>
                            <th className="px-[12px] py-[16px] text-[13px] font-bold text-white border-b border-[#333] border-r border-[#333]">개발<br/><span className="text-[#666] font-normal text-[11px] block mt-1">홍장군</span></th>
                            <th className="px-[12px] py-[16px] text-[13px] font-bold text-white border-b border-[#333] border-r border-[#333]">EMC<br/><span className="text-[#666] font-normal text-[11px] block mt-1">김민지</span></th>
                            <th className="px-[12px] py-[16px] text-[13px] font-bold text-white border-b border-[#333] border-r border-[#333]">KAM<br/><span className="text-[#666] font-normal text-[11px] block mt-1">김행단</span></th>
                            <th className="px-[12px] py-[16px] text-[13px] font-bold text-[#fbf167] border-b border-[#333]">CFT총괄<br/><span className="text-[#666] font-normal text-[11px] block mt-1">이철승</span></th>
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
                                <td className="px-[12px] py-[14px] bg-[#222]/30 group-hover:bg-transparent transition-colors">{renderBadge(row.total)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
