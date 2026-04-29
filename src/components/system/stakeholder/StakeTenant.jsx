import React from 'react';

export default function StakeTenant() {
    const tenantData = [
        { name: 'Global Tech Co.', industry: 'IT / Tech', space: '20,000 평', stage: 'Contract', progress: 90, note: '본계약서 조율 중, 렌트프리 협상 완료' },
        { name: '국내 대기업 A사 (계열사 통합)', industry: 'Manufacturing', space: '15,000 평', stage: 'LOI', progress: 60, note: 'LOI 수취 완료, 인테리어 공사비 지원 협의' },
        { name: '유니콘 스타트업 B사', industry: 'Platform', space: '5,000 평', stage: 'NDA', progress: 30, note: 'NDA 체결, 도면 및 스펙 북 제공' },
        { name: '글로벌 제약사 C', industry: 'Bio / Pharma', space: '3,000 평', stage: 'Targeting', progress: 10, note: '초기 태핑 메일 발송, 시설 스펙 확인 요청' },
        { name: '금융지주 D사', industry: 'Finance', space: '10,000 평', stage: 'Targeting', progress: 10, note: '여의도 이전 수요 파악 중' },
    ];

    const renderStageBadge = (stage) => {
        if (stage === 'Contract') return <span className="px-3 py-1 bg-[#059669]/20 text-[#34d399] rounded-md font-bold text-[13px] border border-[#059669]/30">Contract</span>;
        if (stage === 'LOI') return <span className="px-3 py-1 bg-[#d97706]/20 text-[#fbf167] rounded-md font-bold text-[13px] border border-[#d97706]/30">LOI</span>;
        if (stage === 'NDA') return <span className="px-3 py-1 bg-[#2563eb]/20 text-[#60a5fa] rounded-md font-bold text-[13px] border border-[#2563eb]/30">NDA</span>;
        return <span className="px-3 py-1 bg-[#4b5563]/30 text-[#9ca3af] rounded-md font-medium text-[13px] border border-[#4b5563]/30">Targeting</span>;
    };

    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">잠재 임차사</h1>
            <p className="text-[15px] text-[#86868B] mb-[36px]">이오타서울 자산의 앵커 테넌트(Anchor Tenant) 및 주요 임차사 파이프라인 관리 보드입니다.</p>
            
            <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-[24px] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#222]">
                        <tr>
                            <th className="px-[24px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333] border-r border-[#333] w-[220px]">타겟 기업명</th>
                            <th className="px-[24px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333] border-r border-[#333] w-[140px]">산업군</th>
                            <th className="px-[24px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333] border-r border-[#333] w-[120px]">요구 면적</th>
                            <th className="px-[24px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333] border-r border-[#333] w-[120px]">진행 단계</th>
                            <th className="px-[24px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333] border-r border-[#333] w-[160px]">Progress</th>
                            <th className="px-[24px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">진행 상황 노트</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                        {tenantData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#292928] transition-colors">
                                <td className="px-[24px] py-[20px] text-[15px] font-bold text-white border-r border-[#333]">{row.name}</td>
                                <td className="px-[24px] py-[20px] text-[14px] text-[#A1A1AA] border-r border-[#333]">{row.industry}</td>
                                <td className="px-[24px] py-[20px] text-[15px] text-[#E5E5E5] border-r border-[#333] font-medium">{row.space}</td>
                                <td className="px-[24px] py-[20px] border-r border-[#333]">{renderStageBadge(row.stage)}</td>
                                <td className="px-[24px] py-[20px] border-r border-[#333]">
                                    <div className="w-full bg-[#222] rounded-full h-2 mb-1">
                                        <div className="bg-[#fbf167] h-2 rounded-full" style={{ width: `${row.progress}%` }}></div>
                                    </div>
                                    <span className="text-[12px] text-[#86868B]">{row.progress}%</span>
                                </td>
                                <td className="px-[24px] py-[20px] text-[14px] text-[#A1A1AA] leading-[22px]">{row.note}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
