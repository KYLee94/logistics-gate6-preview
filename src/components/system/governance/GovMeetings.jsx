import React from 'react';

export default function GovMeetings() {
    const timelineData = [
        { time: '00', duration: '5분', title: '지난 주 액션 종결 확인 (5분)', desc: '' },
        { time: '05', duration: '10분', title: '주요 KPI/OKR 변동', desc: '대시보드 공유 (10분)' },
        { time: '15', duration: '10분', title: 'Top10 리스크 업데이트', desc: '색상 변동 셀만 (10분)' },
        { time: '25', duration: '15분', title: '의사결정 안건', desc: 'Two-Lock 표결 (15분)' },
        { time: '40', duration: '10분', title: '외부 인터페이스 이슈', desc: '대주/LP/시공/임차 (10분)' },
        { time: '50', duration: '5분', title: 'IPR 워킹그룹 진척 (5분)', desc: '' },
        { time: '55', duration: '5분', title: '차주 액션 / 회의록 합의 (5분)', desc: '' }
    ];

    const internalMeetings = [
        { meeting: 'Iota 임원 보고회', period: '월 1회 (3주차)', leader: '부문대표(이철승)', attendees: '부대표진·CFT 총괄·셀 리드 5인', output: '월간 사업보고서, T1 의사결정 사안 통과' },
        { meeting: 'CFT 운영위\n(Steering)', period: '격주 (수)', leader: 'CFT 총괄(부문대표 겸직)', attendees: 'PM·5개 셀 리드·KAM 1파트', output: 'UW 범위 외 의사결정, 변경관리 승인' },
        { meeting: '주간 PM Stand-up', period: '주 1회 (월)', leader: 'PM(강순용)', attendees: '5개 셀 실무 책임자', output: '주간 진척, Top10 리스크, 7일 액션' },
        { meeting: 'LP 정기보고 미팅', period: '분기 1회', leader: 'KAM 1파트(김행단)', attendees: 'PM·LFC·운용지원·외부 LP', output: '분기보고서, Q&A 로그' },
        { meeting: '대주단 보고', period: '월/분기', leader: 'LFC(박준호)', attendees: 'PM·KAM·외부 대주단', output: 'Covenants 모니터링 보드, 차주 통지' },
        { meeting: 'IPR WG', period: '격주 (목)', leader: '프리츠 TFT (권순일)', attendees: 'CFT 총괄·PM·외부자문(법무·회계·감정)', output: 'Forward Purchase 구조설계서, 약정 초안' },
        { meeting: '분기 회고(Retro)', period: '분기 말', leader: 'CFT 총괄', attendees: '전 셀 리드·실무 핵심 인력', output: 'KPI/OKR 리뷰, 원인분석, 차분기 OKR' }
    ];

    const externalMeetings = [
        { meeting: '이오타 1 (현대건설)', period: '격주 (수)', leader: '부문대표(이철승)', attendees: '현대건설 및 금융주관사들', output: '' },
        { meeting: '이오타 2 (삼성물산)', period: '격주 (수)', leader: '부문대표(이철승)', attendees: '삼성물산 및 금융주관사들', output: '' },
        { meeting: '통합PF (NH투자증권)', period: '격주 (수)', leader: '부문대표(이철승)', attendees: 'NH투자증권', output: '' }
    ];

    const triggers = [
        { condition: 'UW 범위 외 일정/예산 변경이 식별된 경우', action: 'CFT 운영위 임시 소집' },
        { condition: '대주단 Covenants 위반 가능성 식별', action: 'LFC 주재 긴급 라운드' },
        { condition: '핵심 임차인 협상 결렬 또는 LOI 철회', action: 'EMC 주재 임시 LM 회의' },
        { condition: '규제·인허가·소송 이슈 발생', action: 'CFT 총괄 직속 비상 회의' },
        { condition: 'LP 임시 출자·임시 분배 요청', action: 'KAM 1파트 주재 펀드 회의' }
    ];

    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[110px] max-w-[1112px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[36px]">회의체 운영 방침</h1>
            
            <div className="w-full border border-[#333] rounded-[24px] overflow-hidden mb-[32px] bg-transparent">
                <div className="px-[28px] py-[20px] border-b border-[#333] bg-transparent">
                    <h3 className="text-[16px] font-bold text-white">표준 회의 어젠다 <span className="text-[#86868B] font-normal text-[13px] ml-1">(1시간 기준)</span></h3>
                </div>
                <div className="px-[28px] py-[34px]">
                    <div className="flex flex-col relative before:absolute before:inset-x-0 before:top-[28px] before:bottom-0 before:ml-[34px] md:before:mx-auto md:before:translate-x-0 before:w-0.5 before:bg-gradient-to-b before:from-[#444] before:via-[#444] before:to-transparent">
                        
                        {timelineData.map((item, index) => (
                            <React.Fragment key={index}>
                                {/* Timeline Node */}
                                <div className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active ${index > 0 ? 'md:-mt-[16px] mt-[32px]' : ''}`}>
                                    <div className="flex items-center justify-center w-[56px] h-[56px] rounded-full border-[2px] border-[#444] bg-[#111] text-white font-bold text-[17px] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 relative">
                                        {item.time}
                                    </div>
                                    
                                    {/* Speech Bubble */}
                                    <div className="relative w-[calc(100%-5rem)] md:w-[calc(50%-156px)] md:group-odd:mr-[100px] md:group-even:ml-[100px] p-5 rounded-[16px] bg-[#111]
                                        md:group-odd:after:content-[''] md:group-odd:after:absolute md:group-odd:after:top-1/2 md:group-odd:after:-translate-y-1/2 md:group-odd:after:-left-[7px] md:group-odd:after:w-[14px] md:group-odd:after:h-[14px] md:group-odd:after:rotate-45 md:group-odd:after:bg-[#111]
                                        md:group-even:after:content-[''] md:group-even:after:absolute md:group-even:after:top-1/2 md:group-even:after:-translate-y-1/2 md:group-even:after:-right-[7px] md:group-even:after:w-[14px] md:group-even:after:h-[14px] md:group-even:after:rotate-45 md:group-even:after:bg-[#111]
                                        
                                        after:content-[''] after:absolute after:top-1/2 after:-translate-y-1/2 after:-left-[7px] after:w-[14px] after:h-[14px] after:rotate-45 after:bg-[#111] md:after:hidden
                                    ">
                                        <span className="text-[15px] font-bold text-white block">{item.title}</span>
                                        {item.desc && <p className="text-[15px] text-[#A1A1AA] mt-1">{item.desc}</p>}
                                    </div>

                                    {/* Duration Indicator: Clean text on the right of the vertical line */}
                                    <div className="absolute left-[34px] md:left-1/2 md:translate-x-[24px] top-[calc(100%-8px)] -translate-y-1/2 text-[13px] text-[#86868B] font-medium z-10 whitespace-nowrap">
                                        {item.duration}
                                    </div>
                                </div>
                            </React.Fragment>
                        ))}

                        {/* Final Node 60 */}
                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active md:-mt-[16px] mt-[32px]">
                            <div className="flex items-center justify-center w-[56px] h-[56px] rounded-full border-[2px] border-[#444] bg-[#111] text-white font-bold text-[17px] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                60
                            </div>
                            <div className="w-[calc(100%-5rem)] md:w-[calc(50%-3.5rem)] opacity-0">
                                {/* Invisible spacer block */}
                            </div>
                        </div>

                    </div>
                </div>
            </div>




            {/* 정기 회의체 */}
            <h2 className="text-[28px] font-bold text-white mt-[60px] mb-0 tracking-tight">정기 회의체 (Cadence)</h2>
            
            <h3 className="text-[18px] font-bold text-white mt-[30px] mb-[16px]">[이지스 내부]</h3>
            <div className="w-full border border-[#333] rounded-[24px] overflow-hidden mb-[32px]">
                <table className="w-full text-left table-fixed">
                    <thead className="bg-[#1E1E1E]">
                        <tr>
                            <th className="pl-[22px] pr-[12px] py-[12px] text-[15px] font-bold text-[#86868B] border-b border-[#333]  w-[180px]">회의체</th>
                            <th className="pl-[22px] pr-[12px] py-[12px] text-[15px] font-bold text-[#86868B] border-b border-[#333]  w-[120px]">주기</th>
                            <th className="pl-[22px] pr-[12px] py-[12px] text-[15px] font-bold text-[#86868B] border-b border-[#333]  w-[160px]">주재자</th>
                            <th className="pl-[42px] pr-[12px] py-[12px] text-[15px] font-bold text-[#86868B] border-b border-[#333]  w-[280px]">주요 참석자</th>
                            <th className="pl-[22px] pr-[12px] py-[12px] text-[15px] font-bold text-[#86868B] border-b border-[#333]">핵심 산출물</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                        {internalMeetings.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#292928] transition-colors group">
                                <td className="pl-[22px] pr-[12px] py-[12px] text-[15px] text-[#E5E5E5]  group-hover:text-white transition-colors text-left font-semibold">{row.meeting}</td>
                                <td className="pl-[22px] pr-[12px] py-[12px] text-[14px] transition-colors"><span className="inline-block px-[10px] py-[4px] rounded-[6px] bg-[#111] text-[#c3c2b7] group-hover:text-white transition-colors whitespace-nowrap">{row.period}</span></td>
                                <td className="pl-[22px] pr-[12px] py-[12px] text-[14px] font-bold text-white whitespace-nowrap transition-colors">{row.leader}</td>
                                <td className="pl-[42px] pr-[12px] py-[12px] text-[14px] text-[#c3c2b7]  text-left group-hover:text-[#E5E5E5] transition-colors">{row.attendees}</td>
                                <td className="pl-[22px] pr-[12px] py-[12px] text-[14px] text-[#c3c2b7] text-left group-hover:text-[#E5E5E5] transition-colors">{row.output}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <h3 className="text-[18px] font-bold text-white mt-[16px] mb-[16px]">[이지스 외부]</h3>
            <div className="w-full border border-[#333] rounded-[24px] overflow-hidden mb-[80px]">
                <table className="w-full text-left table-fixed">
                    <thead className="bg-[#1E1E1E]">
                        <tr>
                            <th className="pl-[22px] pr-[12px] py-[12px] text-[15px] font-bold text-[#86868B] border-b border-[#333]  w-[180px]">회의체</th>
                            <th className="pl-[22px] pr-[12px] py-[12px] text-[15px] font-bold text-[#86868B] border-b border-[#333]  w-[120px]">주기</th>
                            <th className="pl-[22px] pr-[12px] py-[12px] text-[15px] font-bold text-[#86868B] border-b border-[#333]  w-[160px]">주재자</th>
                            <th className="pl-[42px] pr-[12px] py-[12px] text-[15px] font-bold text-[#86868B] border-b border-[#333]  w-[280px]">주요 참석자</th>
                            <th className="pl-[22px] pr-[12px] py-[12px] text-[15px] font-bold text-[#86868B] border-b border-[#333]">핵심 산출물</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                        {externalMeetings.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#292928] transition-colors group">
                                <td className="pl-[22px] pr-[12px] py-[12px] text-[15px] text-[#E5E5E5]  group-hover:text-white transition-colors text-left font-semibold">{row.meeting}</td>
                                <td className="pl-[22px] pr-[12px] py-[12px] text-[14px] transition-colors"><span className="inline-block px-[10px] py-[4px] rounded-[6px] bg-[#111] text-[#c3c2b7] group-hover:text-white transition-colors whitespace-nowrap">{row.period}</span></td>
                                <td className="pl-[22px] pr-[12px] py-[12px] text-[14px] font-bold text-white whitespace-nowrap transition-colors">{row.leader}</td>
                                <td className="pl-[42px] pr-[12px] py-[12px] text-[14px] text-[#c3c2b7]  text-left group-hover:text-[#E5E5E5] transition-colors">{row.attendees}</td>
                                <td className="pl-[22px] pr-[12px] py-[12px] text-[14px] text-[#c3c2b7] text-left group-hover:text-[#E5E5E5] transition-colors">{row.output}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 비정기 회의체 */}
            <h2 className="text-[28px] font-bold text-white mt-[40px] mb-[16px] tracking-tight">비정기 회의체 (Trigger 기반)</h2>
            <p className="text-[17px] text-[#A1A1AA] leading-[26px] mb-[32px]">
                아래 트리거가 발생하는 즉시 24시간 내 비정기 회의가 자동 소집됩니다.<br/>
                트리거는 통합 데이터룸의 <strong className="text-[#E5E5E5]">‘리스크 등록부’</strong>에 등록된 항목과 연동됩니다.
            </p>

            <div className="flex flex-col gap-[12px]">
                {triggers.map((item, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row md:items-stretch gap-[12px] group">
                        
                        {/* Left Box (Condition) */}
                        <div className="flex-1 flex items-center bg-[#1E1E1E] border border-[#3c3c3c] rounded-[16px] p-[20px] transition-colors group-hover:bg-[#292928]">
                            <div className="w-[8px] h-[8px] rounded-full bg-[#86868B] mr-[16px] shrink-0"></div>
                            <div className="text-[18px] text-[#E5E5E5] font-medium text-left leading-snug">{item.condition}</div>
                        </div>

                        {/* Arrow */}
                        <div className="flex items-center justify-center text-[#666] shrink-0 px-[8px]">
                            <svg className="hidden md:block" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                            <svg className="block md:hidden" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                        </div>

                        {/* Right Box (Action) */}
                        <div className="flex-1 flex items-center bg-[#1E1E1E] border border-[#3c3c3c] rounded-[16px] p-[20px] transition-colors group-hover:bg-[#292928]">
                            <div className="w-[8px] h-[8px] rounded-full bg-[#5da0e7] mr-[16px] shrink-0"></div>
                            <div className="text-[18px] text-[#5da0e7] font-bold text-left leading-snug">{item.action}</div>
                        </div>

                    </div>
                ))}
            </div>

        </div>
    );
}
