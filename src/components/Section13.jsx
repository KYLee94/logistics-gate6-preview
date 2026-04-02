import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

const TypewriterText = ({ text, isActive, delay = 0, speed = 30 }) => {
    return (
        <>
            {text.split('').map((char, index) => (
                <span 
                    key={index} 
                    className="inline"
                    style={{ 
                        opacity: isActive ? 1 : 0, 
                        transition: `opacity 0s ${isActive ? delay + index * speed : 0}ms` 
                    }}
                >
                    {char}
                </span>
            ))}
        </>
    );
};

export default function Section13({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }

        let timers = [];
        
        // Background dimming / Image reveal
        timers.push(setTimeout(() => setStep(0.5), 100));

        // Start Typewriter sequences with perfectly modeled duration thresholds
        timers.push(setTimeout(() => setStep(1), 800));   // Heading
        timers.push(setTimeout(() => setStep(2), 2000));  // Question
        timers.push(setTimeout(() => setStep(3), 2800));  // Quotes
        timers.push(setTimeout(() => setStep(4), 4800));  // Para 1
        timers.push(setTimeout(() => setStep(5), 7800));  // Para 2
        timers.push(setTimeout(() => setStep(6), 12500)); // Conclusion
        
        // Giant 'Moat' + Underline drops in (마지막 효과)
        timers.push(setTimeout(() => setStep(7), 14000)); 

        return () => timers.forEach(t => clearTimeout(t));
    }, [isActive]);

    return (
        <section className="relative section w-full h-full flex flex-col justify-center items-center overflow-hidden bg-[#0A0A0C]">
            
            {/* Background Image: Very slow zoom animation like Section 12 */}
            <div 
                className={`absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat z-0 transform transition-all duration-[40000ms] ease-linear ${step >= 0.5 ? 'opacity-100' : 'opacity-0'}`}
                style={{ 
                    backgroundImage: `url('${import.meta.env.BASE_URL}igis_office.webp')`,
                    transform: step >= 0.5 ? 'scale(1.15)' : 'scale(1)',
                    transitionProperty: 'transform, opacity',
                    transitionDuration: '40000ms, 1500ms'
                }}
            />
            
            {/* Dimming Overlay to ensure readability */}
            <div className={`absolute inset-0 bg-black/75 z-10 transition-opacity duration-[1500ms] ease-out ${step >= 0.5 ? 'opacity-100' : 'opacity-0'}`} />

            {/* Giant "Moat" (마지막에 스윽 떠오르는 효과) */}
            <div 
                className={`absolute top-4 md:top-6 lg:top-10 left-4 md:left-10 lg:left-14 z-20 pointer-events-none transition-all duration-[1800ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 7 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'}`}
            >
                <h1 
                    className="text-[100px] md:text-[180px] lg:text-[230px] font-bold text-white leading-none tracking-tighter opacity-90"
                    style={{ 
                        fontFamily: "'Sanomat Wp', 'Sanomat Web', 'Sanomat', sans-serif"
                    }}
                >
                    Moat
                </h1>
            </div>

            {/* Content Container */}
            <div className={`relative z-20 w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1200px] mx-auto text-white flex flex-col font-sans break-keep pt-5`}>
                <div className="flex flex-col md:ml-[150px] w-full max-w-full text-left">
                    
                    {/* 1. Main Heading */}
                    <h2 className="text-[26px] md:text-[34px] lg:text-[42px] font-bold tracking-tight mb-14 text-white">
                        {lang === 'kr' ? (
                            <TypewriterText text="데이터에 맥락이 쌓이면 해자(Moat)가 됩니다." isActive={step >= 1} speed={25} />
                        ) : (
                            <TypewriterText text="Accumulated context over data becomes a Moat." isActive={step >= 1} speed={25} />
                        )}
                    </h2>

                    {/* 2. Question & Quotes Box */}
                    <div className="flex flex-col mb-12">
                        <p className="text-[15px] md:text-[17px] lg:text-[19px] font-medium text-[#a1a1a6] mb-4">
                            {lang === 'kr' ? (
                                <TypewriterText text="현재 이지스는 어떤 상태입니까?" isActive={step >= 2} speed={25} />
                            ) : (
                                <TypewriterText text="What is the current state of IGIS?" isActive={step >= 2} speed={25} />
                            )}
                        </p>
                        <p className="text-[18px] md:text-[22px] lg:text-[26px] font-bold text-white leading-[1.6]">
                            {lang === 'kr' ? (
                                <>
                                    <TypewriterText text='"어떤 파트너사가 정치적으로 민감한지"' isActive={step >= 3} speed={20} /><br className="hidden lg:block"/>
                                    <TypewriterText text='"어떤 딜(Deal) 구조가 과거에 왜 실패했는지"' isActive={step >= 3} delay={800} speed={20} />
                                </>
                            ) : (
                                <>
                                    <TypewriterText text='"Which partner is politically sensitive?"' isActive={step >= 3} speed={20} /><br className="hidden lg:block"/>
                                    <TypewriterText text='"Why did a specific deal structure fail in the past?"' isActive={step >= 3} delay={800} speed={20} />
                                </>
                            )}
                        </p>
                    </div>

                    {/* 3. Paragraph 1 */}
                    <p className="text-[16px] md:text-[18px] lg:text-[20px] font-medium text-[#d2d2d7] leading-[1.65] mb-12">
                        {lang === 'kr' ? (
                            <>
                                <TypewriterText text="이지스를 100조원의 운용사로 만든 진짜 '맥락(Institutional Knowledge)'은 서버에 존재하지 않습니다." isActive={step >= 4} speed={20} /><br className="hidden lg:block"/>
                                <TypewriterText text="오직 500명 운용역들의 '머릿속과 개인 PC'에만 흩어져 있습니다." isActive={step >= 4} delay={2000} speed={20} />
                            </>
                        ) : (
                            <>
                                <TypewriterText text="The true 'Institutional Knowledge' that built IGIS into a 100-trillion-won firm does not exist on a server." isActive={step >= 4} speed={20} /><br className="hidden lg:block"/>
                                <TypewriterText text="It is scattered solely across the minds and personal PCs of its 500 professionals." isActive={step >= 4} delay={2200} speed={20} />
                            </>
                        )}
                    </p>

                    {/* 4. Paragraph 2 (Underline emphasis) */}
                    <p className="text-[16px] md:text-[18px] lg:text-[20px] font-medium text-[#d2d2d7] leading-[1.7] mb-12">
                        {lang === 'kr' ? (
                            <>
                                <TypewriterText text="직원들에게 AI 툴 사용법(Prompt)을 교육하는 것은 해답이 아닙니다." isActive={step >= 5} speed={20} /><br className="hidden lg:block"/>
                                <TypewriterText text="툴을 쥐여주기 전에, AI가 안전하고 똑똑하게 뛰어놀 수 있는" isActive={step >= 5} delay={1400} speed={20} /><br className="hidden lg:block"/>
                                <span className="relative inline-block font-bold text-white mt-1">
                                    <TypewriterText text="'이지스만의 거대한 맥락의 판(Context Graph)'" isActive={step >= 5} delay={2600} speed={25} />
                                    {/* Action at the very end when step 7 is triggered */}
                                    <span className={`absolute bottom-[2px] md:bottom-[4px] left-0 h-[1px] md:h-[2px] bg-white -z-10 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${step >= 7 ? 'w-full opacity-100' : 'w-0 opacity-0'}`}></span>
                                </span>
                                <TypewriterText text="을 먼저 깔아주어야 합니다." isActive={step >= 5} delay={3700} speed={20} />
                            </>
                        ) : (
                            <>
                                <TypewriterText text="Training employees on how to use AI tools (Prompt Engineering) is not the answer." isActive={step >= 5} speed={20} /><br className="hidden lg:block"/>
                                <TypewriterText text="Before handing them the tools, we must first lay down" isActive={step >= 5} delay={1600} speed={20} /><br className="hidden lg:block"/>
                                <span className="relative inline-block font-bold text-white mt-1">
                                    <TypewriterText text="'IGIS's massive Context Graph'" isActive={step >= 5} delay={2600} speed={25} />
                                    <span className={`absolute bottom-[2px] md:bottom-[4px] left-0 h-[1px] md:h-[2px] bg-white -z-10 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${step >= 7 ? 'w-full opacity-100' : 'w-0 opacity-0'}`}></span>
                                </span>
                                <TypewriterText text=" where AI can operate securely and intelligently." isActive={step >= 5} delay={3400} speed={20} />
                            </>
                        )}
                    </p>

                    {/* 5. Conclusion point */}
                    <p className="text-[16px] md:text-[18px] lg:text-[20px] font-medium text-[#d2d2d7] leading-[1.65]">
                        {lang === 'kr' ? (
                            <TypewriterText text="바로, 우리가 데이터 플랫폼을 구축해야 하는 이유입니다." isActive={step >= 6} speed={25} />
                        ) : (
                            <TypewriterText text="This is exactly why we must build a data platform." isActive={step >= 6} speed={25} />
                        )}
                    </p>

                </div>
            </div>
        </section>
    );
}
