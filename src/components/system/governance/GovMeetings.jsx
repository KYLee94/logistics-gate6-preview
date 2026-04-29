import React from 'react';

export default function GovMeetings() {
    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[36px]">회의체 운영 방침</h1>
            
            <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-[24px] overflow-hidden mb-[32px]">
                <div className="px-[28px] py-[20px] border-b border-[#333] bg-[#222]">
                    <h3 className="text-[16px] font-bold text-white">표준 회의 어젠다 <span className="text-[#86868B] font-normal text-[13px] ml-1">(1시간 기준)</span></h3>
                </div>
                <div className="px-[28px] py-[24px]">
                    <div className="flex flex-col relative before:absolute before:inset-0 before:ml-[50px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#444] before:to-transparent">
                        
                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-[#444] bg-[#222] text-[#fbf167] font-bold text-[13px] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                00
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-[16px] bg-[#292928] border border-[#3c3c3c]">
                                <span className="text-[15px] font-bold text-white">지난 주 액션 종결 확인 (5분)</span>
                            </div>
                        </div>

                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mt-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-[#444] bg-[#222] text-[#A1A1AA] font-bold text-[13px] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                05
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-[16px] bg-[#292928] border border-[#3c3c3c]">
                                <span className="text-[15px] font-bold text-white">주요 KPI/OKR 변동</span>
                                <p className="text-[13px] text-[#86868B] mt-1">— 대시보드 공유 (10분)</p>
                            </div>
                        </div>

                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mt-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-[#444] bg-[#222] text-[#e11d48] font-bold text-[13px] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                15
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-[16px] bg-[#292928] border border-[#3c3c3c]">
                                <span className="text-[15px] font-bold text-white">Top10 리스크 업데이트</span>
                                <p className="text-[13px] text-[#86868B] mt-1">— 색상 변동 셀만 (10분)</p>
                            </div>
                        </div>

                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mt-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-[#444] bg-[#222] text-[#34d399] font-bold text-[13px] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                25
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-[16px] bg-[#292928] border border-[#3c3c3c]">
                                <span className="text-[15px] font-bold text-white">의사결정 안건</span>
                                <p className="text-[13px] text-[#86868B] mt-1">— Two-Lock 표결 (15분)</p>
                            </div>
                        </div>

                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mt-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-[#444] bg-[#222] text-[#818cf8] font-bold text-[13px] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                40
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-[16px] bg-[#292928] border border-[#3c3c3c]">
                                <span className="text-[15px] font-bold text-white">외부 인터페이스 이슈</span>
                                <p className="text-[13px] text-[#86868B] mt-1">— 대주/LP/시공/임차 (10분)</p>
                            </div>
                        </div>

                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mt-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-[#444] bg-[#222] text-[#A1A1AA] font-bold text-[13px] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                50
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-[16px] bg-[#292928] border border-[#3c3c3c]">
                                <span className="text-[15px] font-bold text-white">IPR 워킹그룹 진척 (5분)</span>
                            </div>
                        </div>

                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mt-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-[#444] bg-[#222] text-[#A1A1AA] font-bold text-[13px] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                55
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-[16px] bg-[#292928] border border-[#3c3c3c]">
                                <span className="text-[15px] font-bold text-white">차주 액션 / 회의록 합의 (5분)</span>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

        </div>
    );
}
