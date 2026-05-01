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

    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[110px] max-w-[1112px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[36px]">회의체 운영 방침</h1>
            
            <div className="w-full border border-[#333] rounded-[24px] overflow-hidden mb-[32px] bg-transparent">
                <div className="px-[28px] py-[20px] border-b border-[#333] bg-transparent">
                    <h3 className="text-[16px] font-bold text-white">표준 회의 어젠다 <span className="text-[#86868B] font-normal text-[13px] ml-1">(1시간 기준)</span></h3>
                </div>
                <div className="px-[28px] py-[40px]">
                    <div className="flex flex-col relative before:absolute before:inset-0 before:ml-[34px] md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-[#444] before:via-[#444] before:to-transparent">
                        
                        {timelineData.map((item, index) => (
                            <React.Fragment key={index}>
                                {/* Timeline Node */}
                                <div className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active ${index > 0 ? 'md:-mt-[16px] mt-[32px]' : ''}`}>
                                    <div className="flex items-center justify-center w-[56px] h-[56px] rounded-full border-[2px] border-[#444] bg-[#111] text-white font-bold text-[17px] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 relative">
                                        {item.time}
                                    </div>
                                    
                                    {/* Speech Bubble */}
                                    <div className="relative w-[calc(100%-5rem)] md:w-[calc(50%-156px)] md:group-odd:ml-[100px] md:group-even:mr-[100px] p-5 rounded-[16px] bg-[#111]
                                        md:group-odd:after:content-[''] md:group-odd:after:absolute md:group-odd:after:top-1/2 md:group-odd:after:-translate-y-1/2 md:group-odd:after:-right-[7px] md:group-odd:after:w-[14px] md:group-odd:after:h-[14px] md:group-odd:after:rotate-45 md:group-odd:after:bg-[#111]
                                        md:group-even:after:content-[''] md:group-even:after:absolute md:group-even:after:top-1/2 md:group-even:after:-translate-y-1/2 md:group-even:after:-left-[7px] md:group-even:after:w-[14px] md:group-even:after:h-[14px] md:group-even:after:rotate-45 md:group-even:after:bg-[#111]
                                        
                                        after:content-[''] after:absolute after:top-1/2 after:-translate-y-1/2 after:-left-[7px] after:w-[14px] after:h-[14px] after:rotate-45 after:bg-[#111] md:after:hidden
                                    ">
                                        <span className="text-[16px] font-bold text-white block">{item.title}</span>
                                        {item.desc && <p className="text-[14px] text-[#A1A1AA] mt-1">{item.desc}</p>}
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

        </div>
    );
}
