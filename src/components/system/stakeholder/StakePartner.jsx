import React from 'react';

export default function StakePartner() {
    const partnerData = [
        { company: 'KT Estate', role: 'Property Management (PM)', rep: '김운영 팀장', contact: '02-123-4567', email: 'pm@ktestate.com', status: '계약 유지중', color: 'bg-[#4f46e5]' },
        { company: '법무법인 태평양', role: 'Legal Advisory', rep: '이법무 변호사', contact: '02-987-6543', email: 'legal@bkl.co.kr', status: '자문 계약 체결', color: 'bg-[#059669]' },
        { company: '삼일회계법인', role: 'Accounting & Tax', rep: '박회계 상무', contact: '02-333-4444', email: 'tax@samil.com', status: '세무 실사 중', color: 'bg-[#d97706]' },
        { company: 'CBRE Korea', role: 'Leasing Management (LM)', rep: '최임대 이사', contact: '02-555-6666', email: 'lm@cbre.com', status: '전속 대행 계약', color: 'bg-[#e11d48]' },
        { company: '에스원 (S-1)', role: 'Facility Management (FM)', rep: '장보안 파트장', contact: '02-777-8888', email: 'fm@s1.co.kr', status: '우선협상대상자', color: 'bg-[#2563eb]' },
        { company: '감정평가법인 A', role: 'Valuation', rep: '정감정 평가사', contact: '02-111-2222', email: 'val@appraisal.com', status: '파일럿 진행 중', color: 'bg-[#9333ea]' },
    ];

    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">운영 파트너</h1>
            <p className="text-[15px] text-[#86868B] mb-[36px]">성공적인 자산 운영 및 매각/구조화 지원을 위한 핵심 아웃소싱 파트너 명단입니다.</p>
            
            <div className="grid grid-cols-3 gap-[24px]">
                {partnerData.map((item, idx) => (
                    <div key={idx} className="bg-[#292928] border border-[#3c3c3c] rounded-[24px] overflow-hidden hover:border-[#555] transition-colors group cursor-pointer relative">
                        <div className={`h-[6px] w-full ${item.color}`}></div>
                        <div className="p-[28px]">
                            <span className="text-[13px] font-bold text-[#86868B] uppercase tracking-wider mb-[8px] block">{item.role}</span>
                            <h3 className="text-[22px] font-bold text-white mb-[24px] group-hover:text-[#fbf167] transition-colors">{item.company}</h3>
                            
                            <div className="flex flex-col gap-[16px]">
                                <div className="flex items-center gap-3">
                                    <div className="w-[32px] h-[32px] rounded-full bg-[#1A1A1A] flex items-center justify-center text-[#A1A1AA]">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    </div>
                                    <div>
                                        <span className="text-[14px] text-[#E5E5E5] font-medium">{item.rep}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-[32px] h-[32px] rounded-full bg-[#1A1A1A] flex items-center justify-center text-[#A1A1AA]">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                    </div>
                                    <div>
                                        <span className="text-[13px] text-[#A1A1AA]">{item.contact}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-[32px] h-[32px] rounded-full bg-[#1A1A1A] flex items-center justify-center text-[#A1A1AA]">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                    </div>
                                    <div>
                                        <span className="text-[13px] text-[#A1A1AA]">{item.email}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-[24px] pt-[20px] border-t border-[#333] flex justify-between items-center">
                                <span className="text-[12px] text-[#666]">Status</span>
                                <span className="text-[13px] font-bold text-[#E5E5E5]">{item.status}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
