import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';

const DataFlow = () => {
    // Generate static random values per node to avoid React hydration mismatches 
    // and keep animations consistent across rerenders.
    const [streams] = useState(() => Array.from({ length: 12 }).map(() => ({
        top: 25 + Math.random() * 65,
        delay: Math.random() * 2.5,
        duration: 1.0 + Math.random() * 1.5,
        chars: Math.random() > 0.5 ? "011010" : "100101"
    })));

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {streams.map((s, i) => (
                <div 
                    key={i} 
                    className="absolute font-mono leading-none tracking-widest whitespace-nowrap data-stream"
                    style={{
                        top: `${s.top}%`,
                        left: '0',
                        fontSize: 'clamp(9px, 1vw, 12px)',
                        animationDelay: `${s.delay}s`,
                        animationDuration: `${s.duration}s`
                    }}
                >
                    {s.chars}
                </div>
            ))}
        </div>
    );
};

export default function Section8({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);
    const stepRef = useRef(0);
    stepRef.current = step;

    const stagesKR = ["소싱", "투자", "펀드생성", "개발추진", "파이낸싱", "유저솔루션", "기업마케팅", "개발관리", "준공", "운용개시"];
    const stagesEN = ["Source", "Invest", "Fund", "Dev Init", "Finance", "User Sol.", "Corp Mktg", "Dev Mgt", "Complete", "Operate"];
    const stages = lang === 'kr' ? stagesKR : stagesEN;

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }
        
        const t1 = setTimeout(() => setStep(1), 500);  // Title
        const t2 = setTimeout(() => setStep(2), 1500); // Subtitle
        const t3 = setTimeout(() => setStep(3), 2200); // Nodes Reveal
        const t4 = setTimeout(() => setStep(4), 3200); // Data flow begins (animation mapped)
        
        const nextAction = (e) => {
            if (e.type === 'appSlideNext') {
                if (stepRef.current === 4) {
                    e.preventDefault();
                    setStep(5); // Trigger horizontal scaling down & title appear
                    setTimeout(() => setStep(6), 1200); // Trigger vertical cloning
                    setTimeout(() => setStep(7), 2400); // Trigger lateral fragmentation even sooner
                }
            }
        };

        window.addEventListener('appSlideNext', nextAction);

        return () => { 
            clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
            window.removeEventListener('appSlideNext', nextAction);
        };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-black flex flex-col justify-start relative px-4 md:px-12 lg:px-20 pt-[80px] md:pt-[120px] pb-[80px] overflow-x-hidden overflow-y-auto">
            <style>{`
                @keyframes dataFlowRight {
                    0% { transform: translateX(-10%); opacity: 0; color: #3b82f6; }
                    15% { opacity: 0.8; }
                    60% { color: #f97316; }
                    85% { opacity: 1; color: #ef4444; filter: blur(0px); transform: translateX(70%); }
                    95% { opacity: 0; filter: blur(6px) brightness(1.5); transform: translateX(85%) scaleY(1.5); }
                    100% { opacity: 0; transform: translateX(90%); }
                }
                .data-stream {
                    animation-name: dataFlowRight;
                    animation-timing-function: ease-in;
                    animation-iteration-count: infinite;
                    opacity: 0;
                }
                .data-paused .data-stream {
                    animation-play-state: paused;
                    opacity: 0 !important;
                }
                .data-running .data-stream {
                    animation-play-state: running;
                }
                /* Hide scrollbar for narrow horizontal overflow */
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>

            <div className="w-full max-w-[1500px] mx-auto flex flex-col justify-center h-full">
                
                {/* 1. Header (Negative/Intense) */}
                <div className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                    <h2 className="text-[30px] md:text-[45px] lg:text-[52px] font-bold text-white tracking-tight leading-[1.25] break-keep mb-6 md:mb-8">
                        {lang === 'kr' ? (
                            <>
                                그 결과, 이지스의 '<span className="text-white border-b-[3px] md:border-b-[4px] border-[#dc2626] pb-1">10단계 가치 사슬(Value Chain)</span>'은<br className="hidden md:block"/> 단절되었습니다.
                            </>
                        ) : (
                            <>
                                As a result, IGIS' <span className="text-white border-b-[3px] md:border-b-[4px] border-[#dc2626] pb-1">'10-Step Value Chain'</span><br className="hidden md:block"/> has been severed.
                            </>
                        )}
                    </h2>
                </div>

                <div className="relative min-h-[140px] md:min-h-[160px] lg:min-h-[120px] mb-8 md:mb-16">
                    {/* Step 1-4 Subtitle (Horizontal Severance) */}
                    <h3 className={`absolute top-0 left-0 w-full text-[18px] md:text-[24px] lg:text-[28px] font-medium text-[#c4c4c6] tracking-tight leading-[1.5] break-keep transition-all duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 5 ? 'opacity-0 translate-y-[-20px] pointer-events-none' : (step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none')} max-w-[1100px]`}>
                        {lang === 'kr' ? (
                            <>
                                앞 단계에서 쌓은 경험과 데이터는 다음 단계로 흐르지 못하고 담당자의 PC 안에서 <strong className="text-white font-bold">휘발</strong>됩니다.<br />
                                우리는 매 프로젝트마다 가장 비효율적인 방식으로 <strong className="text-white font-bold">처음부터 다시 시작</strong>하고 있습니다.
                            </>
                        ) : (
                            <>
                                The experience and data accumulated in previous stages fail to flow to the next, <strong className="text-white font-bold">evaporating</strong> inside personal PCs.<br />
                                We are starting over from scratch for every project in the most <strong className="text-white font-bold">inefficient manner</strong>.
                            </>
                        )}
                    </h3>

                    {/* Step 5 Subtitle (Vertical Severance) */}
                    <h3 className={`absolute top-0 left-0 w-full text-[18px] md:text-[24px] lg:text-[28px] font-medium text-[#c4c4c6] tracking-tight leading-[1.5] break-keep transition-all duration-[1200ms] delay-[400ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 5 ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 translate-y-10 scale-95 pointer-events-none'} max-w-[1100px]`}>
                        {lang === 'kr' ? (
                            <>
                                나아가, 다른 프로젝트를 진행하는 팀들 간에도 <strong className="text-[#f97316] font-bold">노하우가 단 한 줄도 공유되지 않습니다.</strong><br />
                                소싱은 소싱끼리, 투자는 투자끼리 단절되어버리는 완벽한 <strong className="text-[#dc2626] font-bold">수직적 밀실 구조</strong>가 형성됩니다.
                            </>
                        ) : (
                            <>
                                Furthermore, even between teams working on different projects, <strong className="text-[#f97316] font-bold">not a single line of know-how is shared.</strong><br />
                                Sourcing is isolated from sourcing, investing from investing, resulting in a perfect <strong className="text-[#dc2626] font-bold">vertical silo structure</strong>.
                            </>
                        )}
                    </h3>
                </div>

                {/* 2. Value Chain Visualization */}
                <div className={`w-full overflow-x-auto hide-scrollbar pb-6 transition-all duration-[1500ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'}`}>
                    
                    {[0, 1, 2].map((rowIndex) => (
                        <div 
                            key={`row-wrapper-${rowIndex}`}
                            className={`flex flex-col min-w-[1000px] xl:min-w-0 w-full transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] 
                                ${rowIndex === 0 ? '' : (step >= 6 ? 'opacity-100 mt-[20px] md:mt-[30px] max-h-[500px]' : 'opacity-0 mt-0 max-h-0 overflow-hidden pointer-events-none')}
                            `}
                        >
                            {/* Project Title (Appears above each row smoothly) */}
                            <div className={`flex text-white font-bold text-[14px] md:text-[17px] px-2 transition-all duration-[800ms] origin-left ${step >= 5 ? 'opacity-100 max-h-[30px] mb-2 md:mb-3 scale-100' : 'opacity-0 max-h-0 mb-0 scale-95 overflow-hidden'}`}>
                                <span className="text-[#f97316] mr-2">{lang === 'kr' ? '프로젝트' : 'Project'} :</span> {["IOTA Seoul", "서리풀", "용산시티코어"][rowIndex]}
                            </div>

                            <div 
                                className={`flex items-center min-w-[1000px] xl:min-w-0 w-full transition-all duration-[300ms] ease-[cubic-bezier(0.19,1,0.22,1)] 
                                    ${step >= 7 ? 'gap-2 md:gap-3 lg:gap-4 overflow-visible border-transparent shadow-none' : 
                                      (step >= 5 ? 'gap-0 border-y-[3px] border-[#dc2626]/80 shadow-[0_0_20px_rgba(220,38,38,0.2)] overflow-hidden' : 'gap-0 border border-[#333] rounded-lg overflow-hidden')}
                                `}
                            >
                            {stages.map((stage, idx) => (
                                <React.Fragment key={idx}>
                                    {/* Node Compartment */}
                                    <div 
                                        className={`flex-1 flex flex-col relative bg-[#0f0f11] overflow-hidden transition-all duration-[300ms] ease-[cubic-bezier(0.19,1,0.22,1)]
                                            ${step >= 4 ? 'data-running' : 'data-paused'}
                                            ${step >= 5 ? 'h-[100px] md:h-[130px]' : 'h-[260px] md:h-[320px] lg:h-[350px]'}
                                            ${step >= 7 ? 'rounded-md border border-[#444] shadow-[0_0_15px_rgba(0,0,0,0.5)]' : 'rounded-none border-none shadow-none'}
                                        `}
                                    >
                                        {/* Top Title Bar */}
                                        <div 
                                            className={`w-full flex items-center justify-center z-20 transition-all duration-[300ms] 
                                                ${step >= 7 ? 'bg-[#1a1a1c] h-[30px] md:h-[40px] py-1 border-b border-[#333] shadow-none' : 
                                                  (step >= 5 ? 'bg-[#1a1a1c] h-[35px] md:h-[45px] py-1 border-b-[2px] border-[#ea580c] shadow-[0_4px_10px_rgba(234,88,12,0.4)]' : 'bg-[#1a1a1c] h-[60px] md:h-[70px] py-3 lg:py-4 border-b border-[#2a2a2c]')}
                                            `}
                                        >
                                            <span 
                                                className={`text-[#ededf0] font-bold text-center leading-[1.2] break-keep px-1 transition-all duration-[1200ms]
                                                    ${step >= 5 ? 'text-[10px] md:text-[13px]' : 'text-[12px] md:text-[14px] lg:text-[16px]'}
                                                `}
                                            >
                                                {stage}
                                            </span>
                                        </div>
                                        
                                        {/* Flowing Data Animation */}
                                        <div className={`absolute inset-0 z-10 p-2 opacity-80 ${step >= 5 ? 'top-[35px] md:top-[45px]' : 'top-[60px] md:top-[70px]'}`}>
                                            <DataFlow />
                                        </div>
                                    </div>
                                    
                                    {/* 3. The "Thick Walls" of severing (Fades out when fragmented to leave clean gaps) */}
                                    {idx < stages.length - 1 && (
                                        <div 
                                            className={`bg-gradient-to-b from-[#dc2626] to-[#f97316] shrink-0 z-30 shadow-[0_0_15px_rgba(239,68,68,0.9)] transition-all duration-[200ms] ease-in-out
                                                ${step >= 7 ? 'w-0 h-[80px] opacity-0 scale-y-0 mx-0 shadow-none' : 
                                                  (step >= 5 ? 'w-[6px] h-[100px] md:h-[130px] opacity-100 scale-y-100' : 'w-[4px] md:w-[6px] h-[260px] md:h-[320px] lg:h-[350px] opacity-[0.3] scale-y-100')}
                                            `} 
                                        ></div>
                                    )}
                                </React.Fragment>
                            ))}
                            </div>
                        </div>
                    ))}

                </div>

            </div>
        </section>
    );
}
