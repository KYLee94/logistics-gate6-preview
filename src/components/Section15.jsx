import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Section15({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }

        let timers = [];
        
        timers.push(setTimeout(() => setStep(1), 500));  // Title & Subtitle
        timers.push(setTimeout(() => setStep(2), 1200)); // Lead Copy
        timers.push(setTimeout(() => setStep(3), 2000)); // Center Core Hub
        timers.push(setTimeout(() => setStep(4), 2600)); // SVG / Div Lines expanding
        timers.push(setTimeout(() => setStep(5), 3200)); // Node 1 (Protocol)
        timers.push(setTimeout(() => setStep(6), 3600)); // Node 2 (Bottleneck)
        timers.push(setTimeout(() => setStep(7), 4000)); // Node 3 (Resource Orchestration)

        return () => timers.forEach(t => clearTimeout(t));
    }, [isActive]);

    return (
        <section className="relative section w-full h-full flex flex-col overflow-hidden bg-[#fbfbfd] text-[#1d1d1f]">
            
            <div className="w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1400px] h-full mx-auto flex flex-col pt-24 md:pt-[7%] pb-10">
                
                {/* Header Phase */}
                <div className="w-full flex flex-col items-center text-center px-4 md:px-0 relative z-20">
                    <span className={`text-[#86868b] font-semibold text-[13px] md:text-[14px] tracking-[0.3em] uppercase mb-4 transition-all duration-1000 ease-out delay-[0ms] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        THE STEERING WHEEL
                    </span>
                    
                    <h2 
                        className={`text-[28px] md:text-[40px] lg:text-[50px] font-medium leading-[1.1] tracking-tight text-[#1d1d1f] mb-6 md:mb-8 transition-all duration-1000 ease-out delay-[100ms] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} 
                        style={{ fontFamily: "'Sanomat Wp', 'Sanomat Web', 'Sanomat', sans-serif" }}
                    >
                        {lang === 'kr' ? (
                            <>
                                수정 협업주의의 조율자 
                                <span className="text-[25px] md:text-[35px] text-[#86868b] mt-2 block font-sans font-semibold tracking-normal">(The Orchestrator) : 기획추진실</span>
                            </>
                        ) : (
                            <>
                                The Orchestrator of Collaboration
                                <span className="text-[25px] md:text-[35px] text-[#86868b] mt-2 block font-sans font-semibold tracking-normal">IFPDP Core</span>
                            </>
                        )}
                    </h2>

                    <p className={`text-[16px] md:text-[18px] lg:text-[20px] font-medium text-[#424245] leading-[1.6] break-keep max-w-[850px] mx-auto transition-all duration-1000 ease-out delay-[100ms] ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        {lang === 'kr' ? (
                            <>
                                플랫폼은 데이터를 모을 수 있지만, 부서 간의 이해관계를 조정할 수는 없습니다.<br className="hidden md:block" />
                                <strong>기획추진실</strong>은 부서 간의 경계를 허물고 실행 속도를 극대화하기 위해 다음의 역할을 수행합니다.
                            </>
                        ) : (
                            <>
                                A platform can aggregate data, but it cannot align inter-departmental interests.<br className="hidden md:block" />
                                The <strong>IFPDP Core</strong> breaks down silos and maximizes execution speed by performing the following roles.
                            </>
                        )}
                    </p>
                </div>

                {/* Desktop Hub & Spoke Layout (md and up) */}
                <div className="relative flex-1 w-full max-w-[1100px] mx-auto hidden md:block mt-2 lg:mt-6 z-10">
                    
                    {/* The Hub Center */}
                    <div className={`absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-10 py-5 rounded-none border border-black/15 shadow-none z-30 flex flex-col items-center justify-center transition-all duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] ${step >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                        <span className="text-[12px] font-bold tracking-widest text-[#86868b] uppercase mb-1">Hub Component</span>
                        <h3 className="text-[22px] lg:text-[26px] font-bold tracking-tight text-[#1d1d1f] whitespace-nowrap">기획추진실</h3>
                        <p className="text-[13px] text-[#86868b] mt-1 font-semibold">IFPDP Core</p>
                    </div>

                    {/* Left Line */}
                    <div className={`absolute top-[40%] right-[50%] w-[33%] lg:w-[32%] h-[1px] bg-black/15 origin-right transition-transform duration-[1200ms] ease-[cubic-bezier(0.25,1,0.5,1)] z-10 ${step >= 4 ? 'scale-x-100' : 'scale-x-0'}`}></div>
                    
                    {/* Right Line */}
                    <div className={`absolute top-[40%] left-[50%] w-[33%] lg:w-[32%] h-[1px] bg-black/15 origin-left transition-transform duration-[1200ms] ease-[cubic-bezier(0.25,1,0.5,1)] z-10 ${step >= 4 ? 'scale-x-100' : 'scale-x-0'}`}></div>

                    {/* Bottom Line */}
                    <div className={`absolute top-[40%] left-1/2 w-[1px] h-[35%] bg-black/15 origin-top transition-transform duration-[1200ms] ease-[cubic-bezier(0.25,1,0.5,1)] z-10 ${step >= 4 ? 'scale-y-100' : 'scale-y-0'}`}></div>

                    {/* Node 1: Left */}
                    <div className={`absolute top-[40%] left-[3%] lg:left-[5%] -translate-y-1/2 w-[30%] max-w-[320px] bg-white pt-8 pb-7 px-8 rounded-none border border-black/15 shadow-none text-left flex flex-col transition-all duration-1000 ease-out z-20 ${step >= 5 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
                        <span className="w-10 h-10 rounded-full bg-[#f4f4f5] flex items-center justify-center text-[15px] font-bold text-[#1d1d1f] mb-5">1</span>
                        <h4 className="text-[18px] lg:text-[20px] font-bold text-[#1d1d1f] mb-3 tracking-tight">Protocol Design</h4>
                        <p className="text-[14px] lg:text-[15px] text-[#86868b] leading-[1.6] break-keep font-medium">
                            {lang === 'kr' ? '실무진의 반복적인 수작업과 중복 검토를 없애기 위한, 10단계 가치사슬 간 필수 데이터 연동 표준안 수립' : 'Establish essential data linkage standards across the 10-stage value chain to eliminate repetitive manual tasks and redundant reviews.'}
                        </p>
                    </div>

                    {/* Node 2: Right */}
                    <div className={`absolute top-[40%] right-[3%] lg:right-[5%] -translate-y-1/2 w-[30%] max-w-[320px] bg-white pt-8 pb-7 px-8 rounded-none border border-black/15 shadow-none text-left flex flex-col transition-all duration-1000 ease-out z-20 ${step >= 6 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
                        <span className="w-10 h-10 rounded-full bg-[#f4f4f5] flex items-center justify-center text-[15px] font-bold text-[#1d1d1f] mb-5">2</span>
                        <h4 className="text-[18px] lg:text-[20px] font-bold text-[#1d1d1f] mb-3 tracking-tight">Bottleneck Removal</h4>
                        <p className="text-[14px] lg:text-[15px] text-[#86868b] leading-[1.6] break-keep font-medium">
                            {lang === 'kr' ? '부서 간 권한이 모호한 회색지대, 데이터 병목 구간 해소 및 실무 지원' : 'Resolve data bottlenecks and ambiguous inter-departmental gray areas, providing direct operational support.'}
                        </p>
                    </div>

                    {/* Node 3: Bottom */}
                    <div className={`absolute top-[75%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] max-w-[340px] bg-white pt-8 pb-7 px-8 rounded-none border border-black/15 shadow-none text-left flex flex-col transition-all duration-1000 ease-out z-20 ${step >= 7 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}>
                        <span className="w-10 h-10 rounded-full bg-[#f4f4f5] flex items-center justify-center text-[15px] font-bold text-[#1d1d1f] mb-5">3</span>
                        <h4 className="text-[18px] lg:text-[20px] font-bold text-[#1d1d1f] mb-3 tracking-tight">Resource Orchestration</h4>
                        <p className="text-[14px] lg:text-[15px] text-[#86868b] leading-[1.6] break-keep font-medium">
                            {lang === 'kr' ? '전사 파이프라인 관점에서의 파트너 및 자원 최적화 연계' : 'Optimize and link partners and resources from a company-wide pipeline perspective.'}
                        </p>
                    </div>

                </div>

                {/* Mobile Linear Layout (hidden on md and up) */}
                <div className={`flex flex-col md:hidden w-full mt-10 space-y-6 pb-12 transition-all duration-1000 ease-out ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    
                    <div className={`bg-white p-6 rounded-none border border-black/15 shadow-none text-center relative z-20`}>
                        <span className="text-[12px] font-bold tracking-widest text-[#86868b] uppercase mb-1">Hub Component</span>
                        <h3 className="text-[22px] font-bold tracking-tight text-[#1d1d1f]">기획추진실</h3>
                        <p className="text-[13px] text-[#86868b] font-semibold">IFPDP Core</p>
                    </div>

                    {/* Animated vertical connector line */}
                    <div className={`w-[1px] h-10 bg-black/15 mx-auto transition-transform origin-top duration-[1500ms] ease-out ${step >= 4 ? 'scale-y-100' : 'scale-y-0'}`}></div>

                    <div className={`bg-white pt-6 pb-6 px-6 rounded-none border border-black/15 shadow-none flex flex-col items-start transition-all duration-1000 ease-out delay-[100ms] ${step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="w-8 h-8 rounded-full bg-[#f4f4f5] flex items-center justify-center text-[13px] font-bold text-[#1d1d1f] mb-4">1</span>
                        <h4 className="text-[17px] font-bold text-[#1d1d1f] mb-2 tracking-tight">Protocol Design</h4>
                        <p className="text-[14px] text-[#86868b] leading-[1.6] break-keep font-medium">
                            {lang === 'kr' ? '실무진의 반복적인 수작업과 중복 검토를 없애기 위한, 10단계 가치사슬 간 필수 데이터 연동 표준안 수립' : 'Establish essential data linkage standards across the 10-stage value chain.'}
                        </p>
                    </div>

                    <div className={`bg-white pt-6 pb-6 px-6 rounded-none border border-black/15 shadow-none flex flex-col items-start transition-all duration-1000 ease-out delay-[200ms] ${step >= 6 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="w-8 h-8 rounded-full bg-[#f4f4f5] flex items-center justify-center text-[13px] font-bold text-[#1d1d1f] mb-4">2</span>
                        <h4 className="text-[17px] font-bold text-[#1d1d1f] mb-2 tracking-tight">Bottleneck Removal</h4>
                        <p className="text-[14px] text-[#86868b] leading-[1.6] break-keep font-medium">
                            {lang === 'kr' ? '부서 간 권한이 모호한 회색지대, 데이터 병목 구간 해소 및 실무 지원' : 'Resolve data bottlenecks and ambiguous inter-departmental gray areas.'}
                        </p>
                    </div>

                    <div className={`bg-white pt-6 pb-6 px-6 rounded-none border border-black/15 shadow-none flex flex-col items-start transition-all duration-1000 ease-out delay-[300ms] ${step >= 7 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="w-8 h-8 rounded-full bg-[#f4f4f5] flex items-center justify-center text-[13px] font-bold text-[#1d1d1f] mb-4">3</span>
                        <h4 className="text-[17px] font-bold text-[#1d1d1f] mb-2 tracking-tight">Resource Orchestration</h4>
                        <p className="text-[14px] text-[#86868b] leading-[1.6] break-keep font-medium">
                            {lang === 'kr' ? '전사 파이프라인 관점에서의 파트너 및 자원 최적화 연계' : 'Optimize and link partners and resources from a company-wide perspective.'}
                        </p>
                    </div>
                </div>

            </div>
            
        </section>
    );
}
