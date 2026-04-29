import React from 'react';

export default function StakeLp() {
    const lpData = [
        { name: '국민연금공단 (NPS)', type: 'Equity / LP', tag: 'Core LP', amount: '2,500억원', rep: '대체투자본부 부동산투자실', status: '의사결정 진행중' },
        { name: 'KB국민은행', type: 'Senior Loan', tag: '대주단 주간사', amount: '3,000억원', rep: 'IB영업부', status: 'Term Sheet 협의' },
        { name: '미래에셋증권', type: 'Mezzanine', tag: '공동 대주', amount: '1,000억원', rep: 'PF본부', status: '심사역 배정 완료' },
        { name: '교직원공제회', type: 'Equity / LP', tag: 'Co-Invest', amount: '1,500억원', rep: '대체투자부', status: 'IM 수령 대기' },
        { name: '글로벌 부동산 펀드 A', type: 'Strategic Investor', tag: 'SI', amount: 'TBD', rep: 'Asia Pacific 팀', status: '초기 탭핑 (Tapping)' },
    ];

    const getStatusColor = (status) => {
        if (status.includes('진행중')) return 'text-[#fbf167] bg-[#fbf167]/10 border-[#fbf167]/30';
        if (status.includes('협의')) return 'text-[#34d399] bg-[#34d399]/10 border-[#34d399]/30';
        if (status.includes('대기') || status.includes('초기')) return 'text-[#A1A1AA] bg-[#444]/50 border-[#555]';
        return 'text-[#818cf8] bg-[#818cf8]/10 border-[#818cf8]/30';
    };

    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">LP / 대주 / SI</h1>
            <p className="text-[15px] text-[#86868B] mb-[36px]">자본 구조(Capital Stack)를 구성하는 핵심 투자자 및 대주단 파이프라인 현황입니다.</p>
            
            <div className="grid grid-cols-2 gap-[24px]">
                {lpData.map((item, idx) => (
                    <div key={idx} className="bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative flex flex-col">
                        <div className="flex justify-between items-start mb-[20px]">
                            <div className="flex items-center gap-[16px]">
                                <div className="w-[48px] h-[48px] rounded-[12px] bg-[#1A1A1A] border border-[#333] flex items-center justify-center text-[18px] font-black text-[#555]">
                                    {item.name.substring(0, 2)}
                                </div>
                                <div>
                                    <h3 className="text-[20px] font-bold text-white leading-tight">{item.name}</h3>
                                    <span className="text-[14px] text-[#A1A1AA] mt-1 block">{item.type}</span>
                                </div>
                            </div>
                            <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-[#222] text-[#86868B] border border-[#333]">
                                {item.tag}
                            </span>
                        </div>
                        
                        <div className="flex-1 flex flex-col gap-[12px]">
                            <div className="flex justify-between items-center py-[12px] border-t border-[#333]/50">
                                <span className="text-[14px] text-[#86868B]">타겟 금액</span>
                                <span className="text-[16px] font-bold text-[#E5E5E5]">{item.amount}</span>
                            </div>
                            <div className="flex justify-between items-center py-[12px] border-t border-[#333]/50">
                                <span className="text-[14px] text-[#86868B]">담당 부서</span>
                                <span className="text-[15px] text-[#E5E5E5]">{item.rep}</span>
                            </div>
                            <div className="flex justify-between items-center py-[12px] border-t border-[#333]/50 mt-auto">
                                <span className="text-[14px] text-[#86868B]">현재 상태</span>
                                <span className={`px-3 py-1 rounded-full text-[13px] font-bold border ${getStatusColor(item.status)}`}>
                                    {item.status}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
