import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Section12({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);
    const [chapterStep, setChapterStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            setChapterStep(0);
            return;
        }
        
        let timers = [];
        
        // 1. Chapter text appears (like smoke) over solid black screen
        timers.push(setTimeout(() => setChapterStep(1), 200));
        
        // 2. The solid black background AND the chapter text fade out together, revealing the car
        timers.push(setTimeout(() => setChapterStep(2), 2200));

        // 3. Staggered fade-in animations for main text (살짝 텀을 두어 배경을 감상하게 함)
        timers.push(setTimeout(() => setStep(1), 4500));  // Heading
        timers.push(setTimeout(() => setStep(2), 4900));  // Quote
        timers.push(setTimeout(() => setStep(3), 5300));  // Paragraph 1
        timers.push(setTimeout(() => setStep(4), 5700));  // Paragraph 2 (Bold)
        timers.push(setTimeout(() => setStep(5), 6100));  // Paragraph 3
        timers.push(setTimeout(() => setStep(6), 8000));  // Underline Highlight & Context Popping (드라마틱한 간격 추가)
        
        return () => timers.forEach(t => clearTimeout(t));
    }, [isActive]);

    return (
        <section className="relative section w-full h-full flex flex-col justify-center items-center overflow-hidden bg-black">
            
            {/* Chapter Intro Overlay - Starts Solid Black First */}
            <div className={`absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black transition-opacity duration-[2000ms] ease-in-out pointer-events-none ${chapterStep <= 1 ? 'opacity-100' : 'opacity-0'}`}>
                <div 
                    className={`flex flex-col items-center text-center space-y-4 transition-all duration-[2000ms] ease-in-out ${chapterStep === 0 ? 'opacity-0 blur-lg scale-95' : chapterStep === 1 ? 'opacity-100 blur-none scale-100' : 'opacity-0 blur-lg scale-[1.02]'}`}
                    style={{ 
                        fontFamily: "'Sanomat Wp', 'Sanomat Web', 'Sanomat', sans-serif",
                        WebkitFontSmoothing: "antialiased",
                        textRendering: "optimizeLegibility",
                    }}
                >
                    <span className="text-[30px] md:text-[50px] text-gray-400 font-light tracking-wide duration-1000 transition-all">
                        Chapter 2.
                    </span>
                    <span className="text-[50px] md:text-[70px] text-white font-medium tracking-tight duration-1000 transition-all">
                        The Steering Wheel
                    </span>
                </div>
            </div>

            <div 
                className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat z-0 transform transition-transform duration-[40000ms] ease-linear"
                style={{ 
                    backgroundImage: `url('${import.meta.env.BASE_URL}car.webp')`,
                    transform: chapterStep >= 1 ? 'scale(1.05)' : 'scale(1)'
                }}
            />
            {/* Dimming Overlay to ensure text readability (Dims only when text appears to let users enjoy the bright background first) */}
            <div className={`absolute inset-0 bg-black/65 z-10 transition-opacity duration-[1500ms] ease-out ${step >= 1 ? 'opacity-100' : 'opacity-0'}`} />

            {/* Content Container (전체 텍스트 박스 위로 40px 추가로 끌어올림) */}
            <div className={`relative z-20 w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1200px] mx-auto text-white flex flex-col font-sans break-keep pt-5 -translate-y-10`}>
                
                {/* 0. Context Popping Header (맨 마지막 액션 시 밀어내며 등장) */}
                <div 
                    className={`overflow-hidden transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 6 ? 'max-h-[150px] opacity-100 mb-[44px] md:mb-[60px]' : 'max-h-0 opacity-0 mb-0'}`}
                >
                    <div 
                        className={`text-[55px] md:text-[75px] lg:text-[95px] font-medium text-white transition-transform duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 6 ? 'translate-y-0' : 'translate-y-12'}`}
                        style={{ 
                            fontFamily: "'Sanomat Wp', 'Sanomat Web', 'Sanomat', sans-serif",
                            letterSpacing: "-0.01em",
                            WebkitFontSmoothing: "antialiased",
                            textRendering: "optimizeLegibility",
                        }}
                    >
                        Context
                    </div>
                </div>

                {/* --- Sub Content Container (Shifted right by 200px) --- */}
                <div className="flex flex-col md:ml-[200px] w-full max-w-full">
                    {/* 1. Main Heading */}
                    <h2 
                        className={`text-[28px] md:text-[36px] lg:text-[45px] font-bold tracking-tight mb-10 transition-all duration-1000 ease-out ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                    >
                        {lang === 'kr' ? (
                            <>맥락 없는 데이터는 쓰레기와 같습니다.</>
                        ) : (
                            <>Contextless data is garbage.</>
                        )}
                    </h2>

                    {/* 2. Emphasized Quote */}
                    <h3 
                        className={`text-[20px] md:text-[26px] lg:text-[30px] font-bold text-[#f5f5f7] leading-[1.4] mb-10 transition-all duration-1000 ease-out ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                    >
                        {lang === 'kr' ? (
                            <>
                                "얼마 전, AI 에이전트가 한 기업의 주요 데이터를 완전히 날려버렸습니다."
                            </>
                        ) : (
                            <>
                                "Recently, an AI agent completely wiped out a company's critical data."
                            </>
                        )}
                    </h3>

                    {/* 3. Paragraph 1 */}
                    <p 
                        className={`text-[16px] md:text-[18px] lg:text-[20px] font-medium text-[#d2d2d7] leading-[1.65] mb-10 transition-all duration-1000 ease-out ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                    >
                        {lang === 'kr' ? (
                            <>
                                AI는 유능했습니다. 단지, 자신이 부수고 있는 것이 테스트 서버인지 실제 비즈니스 서버인지 구분할<br className="hidden lg:block"/>
                                <strong className="text-white font-bold">'조직의 맥락'</strong>이 시스템에 입력되어 있지 않았을 뿐입니다.
                            </>
                        ) : (
                            <>
                                The AI was highly capable. It simply lacked the <strong className="text-white font-bold">'organizational context'</strong> to distinguish<br className="hidden lg:block"/>
                                whether it was destroying a test server or a live production server.
                            </>
                        )}
                    </p>

                    {/* 4. Paragraph 2 (Bold core message) */}
                    <p 
                        className={`text-[16px] md:text-[18px] lg:text-[22px] font-bold text-white leading-[1.65] mb-10 transition-all duration-1000 ease-out ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                    >
                        {lang === 'kr' ? (
                            <>
                                <span className="relative inline-block pb-[1px]">
                                    AI의 능력은 '맥락 (Context)'
                                    <span className={`absolute bottom-[6px] left-0 h-[1px] md:h-[2px] bg-[#f5f5f7] -z-10 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${step >= 6 ? 'w-full opacity-100' : 'w-0 opacity-0'}`}></span>
                                </span>에 좌우됩니다.<br/>
                                맥락 없는 데이터는 AI라는 운전자를 최고급 엔진만 있고 운전대가 없는 포르쉐에 태운 것과 같습니다.
                            </>
                        ) : (
                            <>
                                An AI's true ability is solely dependent on <span className="relative inline-block pb-[1px]">
                                    'Context'
                                    <span className={`absolute bottom-[6px] left-0 h-[1px] md:h-[2px] bg-[#f5f5f7] -z-10 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${step >= 6 ? 'w-full opacity-100' : 'w-0 opacity-0'}`}></span>
                                </span>.<br/>
                                Contextless data is like putting an AI driver in a Porsche with a top-tier engine, but no steering wheel.
                            </>
                        )}
                    </p>

                    {/* 5. Paragraph 3 (Conclusion point) */}
                    <p 
                        className={`text-[16px] md:text-[18px] lg:text-[20px] font-medium text-[#d2d2d7] leading-[1.65] transition-all duration-1000 ease-out ${step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                    >
                        {lang === 'kr' ? (
                            <>
                                이것이 전세계 95%의 기업이 AI 도입에 실패하고 치명적인 리스크를 안게 되는 이유입니다.
                            </>
                        ) : (
                            <>
                                This is why 95% of companies worldwide fail at AI adoption and face fatal risks.
                            </>
                        )}
                    </p>
                </div>

            </div>
        </section>
    );
}
