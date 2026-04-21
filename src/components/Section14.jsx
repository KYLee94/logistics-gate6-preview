import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Section14({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }

        let timers = [];
        
        timers.push(setTimeout(() => setStep(1), 150));  // Vertical Line
        timers.push(setTimeout(() => setStep(2), 1200)); // Titles and bodies
        timers.push(setTimeout(() => setStep(3), 2800)); // Bottom Horizontal Line
        timers.push(setTimeout(() => setStep(4), 3200)); // Core Premise 
        timers.push(setTimeout(() => setStep(5), 3800)); // Images pull together

        return () => timers.forEach(t => clearTimeout(t));
    }, [isActive]);

    return (
        <section className="relative section w-full h-full flex flex-col overflow-y-auto overflow-x-hidden bg-[#f4f4f5] pt-[80px] pb-[80px] md:pt-[100px] md:pb-[100px]">
            
            <div className="w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1400px] min-h-[75%] md:min-h-[65%] mx-auto my-auto shrink-0 flex flex-col justify-between">
                
                {/* Top 50:50 Split Area */}
                <div className="flex-1 flex flex-col md:flex-row relative">
                    
                    {/* Center Vertical Divider Line */}
                    <div 
                        className={`hidden md:block absolute left-1/2 top-0 bottom-0 w-[1px] bg-black/15 origin-top transition-transform duration-[900ms] ease-[cubic-bezier(0.7,0,0.3,1)] ${step >= 1 ? 'scale-y-100' : 'scale-y-0'}`}
                    ></div>

                    {/* Left Box (The Engine) */}
                    <div className="w-full md:w-1/2 flex-none flex flex-col justify-center items-end text-right pr-0 md:pr-[60px] lg:pr-[80px] xl:pr-[100px] 2xl:pr-[130px] py-10 md:py-0">
                        <span className={`text-[#86868b] font-semibold text-[14px] md:text-[15px] tracking-tight mb-6 md:mb-8 transition-all duration-1000 ease-out delay-[0ms] ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                            Definition 1
                        </span>
                        
                        <h2 
                            className={`text-[46px] md:text-[60px] lg:text-[75px] font-medium leading-[1.05] tracking-tight text-[#1d1d1f] mb-8 md:mb-10 transition-all duration-1000 ease-out delay-[150ms] ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} 
                            style={{ fontFamily: "'Sanomat Wp', 'Sanomat Web', 'Sanomat', sans-serif" }}
                        >
                            The Engine
                            <span className="block text-[20px] md:text-[24px] lg:text-[28px] tracking-normal font-sans text-[#86868b] mt-5 font-semibold">
                                IFPDP
                            </span>
                        </h2>
                        
                        <p className={`text-[16px] md:text-[18px] lg:text-[20px] font-medium text-[#424245] leading-[1.6] break-keep transition-all duration-1000 ease-out delay-[300ms] ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                            {lang === 'kr' ? (
                                <>데이터 통합과 AI 연산을 수행하는 물리적 시스템<br />(Technology)</>
                            ) : (
                                <>A physical system<br />(Technology)<br />that performs data integration and AI computation</>
                            )}
                        </p>

                        <div className={`mt-10 md:mt-16 w-full max-w-[220px] lg:max-w-[280px] grayscale transition-all duration-[2000ms] ease-[cubic-bezier(0.25,1,0.5,1)] 
                            ${step < 2 ? 'opacity-0 scale-95 translate-y-8 translate-x-0' : ''}
                            ${step >= 2 && step < 5 ? 'opacity-100 scale-100 translate-y-0 translate-x-0 delay-[500ms]' : ''}
                            ${step >= 5 ? 'opacity-100 scale-100 translate-y-0 translate-x-6 md:translate-x-10 lg:translate-x-16 delay-[0ms]' : ''}
                        `}>
                            <img src={`${import.meta.env.BASE_URL}engine_bw.png`} alt="Engine" className="w-full object-contain mix-blend-darken" />
                        </div>
                    </div>

                    {/* Mobile Divider */}
                    <div className={`md:hidden w-full h-[1px] bg-black/10 my-4 transition-transform duration-1000 origin-left ${step >= 1 ? 'scale-x-100' : 'scale-x-0'}`}></div>

                    {/* Right Box (The Steering Wheel) */}
                    <div className="w-full md:w-1/2 flex-none flex flex-col justify-center items-start text-left pl-0 md:pl-[60px] lg:pl-[80px] xl:pl-[100px] 2xl:pl-[130px] py-10 md:py-0">
                        <span className={`text-[#86868b] font-semibold text-[14px] md:text-[15px] tracking-tight mb-6 md:mb-8 transition-all duration-1000 ease-out delay-[200ms] ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                            Definition 2
                        </span>
                        
                        <h2 
                            className={`text-[36px] md:text-[45px] lg:text-[52px] xl:text-[62px] 2xl:text-[75px] font-medium leading-[1.05] tracking-tight text-[#1d1d1f] mb-8 md:mb-10 transition-all duration-1000 ease-out delay-[350ms] whitespace-nowrap overflow-visible ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} 
                            style={{ fontFamily: "'Sanomat Wp', 'Sanomat Web', 'Sanomat', sans-serif" }}
                        >
                            The Steering Wheel
                            <span className="block text-[20px] md:text-[24px] lg:text-[28px] tracking-normal font-sans text-[#86868b] mt-5 font-semibold">
                                Human Layer
                            </span>
                        </h2>
                        
                        <p className={`text-[12px] md:text-[13px] lg:text-[15px] xl:text-[17px] 2xl:text-[20px] font-medium text-[#424245] leading-[1.6] break-keep transition-all duration-1000 ease-out delay-[500ms] ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                            {lang === 'kr' ? (
                                <>시스템을 올바른 방향으로 통제하고 운영역들의 참여를 이끌어내는<br />조직적 거버넌스(Governance)</>
                            ) : (
                                <>Organizational governance that directs the system rightly and drives professional engagement</>
                            )}
                        </p>

                        <div className={`mt-10 md:mt-16 w-full max-w-[220px] lg:max-w-[280px] grayscale transition-all duration-[2000ms] ease-[cubic-bezier(0.25,1,0.5,1)] 
                            ${step < 2 ? 'opacity-0 scale-95 translate-y-8 translate-x-0' : ''}
                            ${step >= 2 && step < 5 ? 'opacity-100 scale-100 translate-y-0 translate-x-0 delay-[700ms]' : ''}
                            ${step >= 5 ? 'opacity-100 scale-100 translate-y-0 -translate-x-6 md:-translate-x-10 lg:-translate-x-16 delay-[0ms]' : ''}
                        `}>
                            <img src={`${import.meta.env.BASE_URL}steering_wheel_bw.png`} alt="Steering Wheel" className="w-full object-contain mix-blend-darken" />
                        </div>
                    </div>
                    
                </div>

                {/* Bottom Core Premise Area */}
                <div className="w-full mt-6 md:mt-20 -translate-y-5">
                    
                    {/* Horizontal Divider Line */}
                    <div 
                        className={`w-full h-[1px] bg-black/15 origin-center transition-transform duration-[1500ms] ease-[cubic-bezier(0.85,0,0.15,1)] ${step >= 3 ? 'scale-x-100' : 'scale-x-0'}`}
                    ></div>
                    
                    <div className={`pt-8 md:pt-10 flex flex-col items-center justify-center text-center transition-all duration-1000 ease-out ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <h3 className="text-[15px] md:text-[16px] font-bold tracking-tight text-[#86868b] mb-2 md:mb-3">
                            {lang === 'kr' ? '핵심 전제' : 'Core Premise'}
                        </h3>
                        
                        <p className="text-[17px] md:text-[22px] lg:text-[26px] font-medium text-[#1d1d1f] leading-[1.6] break-keep max-w-[1200px] w-full px-4 md:px-0 tracking-[-0.02em]">
                            {lang === 'kr' ? (
                                <>아무리 뛰어난 <strong>기술(Engine)</strong>을 도입하더라도, 이를 통제할 <strong>조직의 룰과 거버넌스(Steering Wheel)</strong>가<br className="hidden md:block" />부재하다면 플랫폼은 작동하지 않습니다.</>
                            ) : (
                                <>No matter how advanced the <strong>technology (Engine)</strong> is, the platform will not operate without the <strong>rules and organizational governance (Steering Wheel)</strong> to control it.</>
                            )}
                        </p>
                    </div>

                </div>
                
            </div>
            
        </section>
    );
}
