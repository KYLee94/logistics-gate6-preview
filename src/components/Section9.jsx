import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';

const DataFlowCell = () => {
    // Blocked flow: confined inside each individual cell
    const [streams] = useState(() => Array.from({ length: 8 }).map(() => ({
        top: 30 + Math.random() * 60,
        delay: Math.random() * 2.5,
        duration: 1.0 + Math.random() * 1.5, 
        chars: Math.random() > 0.5 ? "010 " : "101 "
    })));

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-10" style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}>
            {streams.map((s, i) => (
                <div 
                    key={i} 
                    className="absolute font-mono leading-none tracking-widest whitespace-pre data-stream-cell"
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

const DataFlowSuccess = () => {
    // Dense but slow global flowing data (unblocked)
    const [streams] = useState(() => Array.from({ length: 60 }).map(() => ({
        top: 30 + Math.random() * 60,
        delay: Math.random() * 6, // staggered starts
        duration: 6.0 + Math.random() * 4.0, // Slow: 6s - 10s traversal
        chars: Math.random() > 0.5 ? "01101  1011  01" : "10  0100  1101 "
    })));

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-10" style={{ maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}>
            {streams.map((s, i) => (
                <div 
                    key={i} 
                    className="absolute font-mono leading-none tracking-widest whitespace-pre data-stream-success"
                    style={{
                        top: `${s.top}%`,
                        left: '0',
                        fontSize: 'clamp(10px, 1.2vw, 15px)',
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

export default function Section9({ isActive }) {
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
        
        // Initial cascade of the first screen's animations
        const t1 = setTimeout(() => setStep(1), 500);  // Dilemma
        const t2 = setTimeout(() => setStep(2), 1500); // Modified Collaboration
        const t3 = setTimeout(() => setStep(3), 2800); // Merge to blocked state
        
        const nextAction = (e) => {
            if (e.type === 'appSlideNext') {
                if (stepRef.current >= 3 && stepRef.current < 4) {
                    e.preventDefault();
                    setStep(4); // Triggers upward pan and revealing of screen 2
                    setTimeout(() => setStep(5), 1000); // Trigger arrow & text
                    setTimeout(() => setStep(6), 2500); // Trigger totally flowing box
                }
            }
        };

        window.addEventListener('appSlideNext', nextAction);

        return () => { 
            clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); 
            window.removeEventListener('appSlideNext', nextAction);
        };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white relative overflow-hidden">
            <style>{`
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

                @keyframes dataFlowSuccessRight {
                    0% { transform: translateX(-10vw); opacity: 0; color: #93c5fd; }
                    10% { opacity: 0.8; color: #3b82f6; }
                    50% { color: #1e40af; opacity: 1; }
                    80% { opacity: 0.8; }
                    100% { transform: translateX(100vw); opacity: 0; color: #172554; }
                }
                .data-stream-success {
                    animation-name: dataFlowSuccessRight;
                    animation-timing-function: linear;
                    animation-iteration-count: infinite;
                    opacity: 0;
                }

                @keyframes dataFlowCellRight {
                    0% { transform: translateX(-10%); opacity: 0; color: #60a5fa; }
                    20% { opacity: 0.8; color: #3b82f6; }
                    80% { opacity: 0.8; color: #1e40af; transform: translateX(80%); }
                    95% { opacity: 0; filter: blur(4px) brightness(1.2); transform: translateX(95%) scaleY(1.3); }
                    100% { opacity: 0; transform: translateX(100%); }
                }
                .data-stream-cell {
                    animation-name: dataFlowCellRight;
                    animation-timing-function: ease-in;
                    animation-iteration-count: infinite;
                    opacity: 0;
                }
            `}</style>
            
            {/* The single wrapper that handles all content dynamically! */}
            <div className={`w-full h-full flex flex-col items-center justify-start overflow-y-auto hide-scrollbar pt-[80px] pb-[80px] relative`}>
                
                {/* --- SCREEN 1: Top Comparison Block --- */}
                <div className="w-full flex flex-col items-center justify-center relative px-4 md:px-12 lg:px-20 shrink-0">
                    <div className="w-full max-w-[1500px] flex flex-col items-center justify-center space-y-4 md:space-y-6">
                        
                        {/* 1. Text Content */}
                        <div className="w-full flex items-center justify-center">
                            <div className="w-full text-center flex flex-col items-center">
                                {/* Dilemma Paragraph */}
                                <div className={`transition-all duration-[1000ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                                    <h3 className={`text-[16px] md:text-[20px] lg:text-[24px] font-medium text-[#555] tracking-tight leading-[1.6] break-keep`}>
                                        {lang === 'kr' ? (
                                            <>
                                                조직간 자율에 맡기자니 파편화되고, 규약으로 강제하자니 유연성이 죽는 딜레마.<br className="hidden md:block"/>
                                                이를 깨기 위해 대표님은 <span className="text-[#1d1d1f] font-bold">CFT(Cross Functional Team) 전략에서 가장 현실적인 결정</span>을 내렸습니다.
                                            </>
                                        ) : (
                                            <>
                                                The dilemma of fragmentation through autonomy vs. loss of flexibility through strict rules.<br className="hidden md:block"/>
                                                To break this, the CEO made the <span className="text-[#1d1d1f] font-bold">most pragmatic decision in the CFT(Cross Functional Team) strategy</span>.
                                            </>
                                        )}
                                    </h3>
                                </div>

                                {/* Modified Collaboration Title (+2px increased) */}
                                <div className={`mt-[12px] md:mt-[24px] mb-[24px] md:mb-[40px] transition-all duration-[1200ms] delay-[200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} flex flex-col items-center`}>
                                    <h2 className="text-[28px] md:text-[41px] lg:text-[48px] font-bold bg-gradient-to-r from-[#297cf6] to-[#0448d3] text-transparent bg-clip-text tracking-tight leading-[1.2] mb-4 md:mb-6 inline-block">
                                        {lang === 'kr' ? "'수정 협업주의 (Modified Collaboration)'" : "'Modified Collaboration'"}
                                    </h2>
                                    
                                    <p className="text-[17px] md:text-[22px] lg:text-[26px] font-semibold text-[#1d1d1f] tracking-tight leading-[1.5] break-keep max-w-[1100px]">
                                        {lang === 'kr' ? (
                                            <>
                                                개인의 성향이나 선의에 기대는 것을 멈추고,<br className="hidden md:block" />
                                                <span className="font-bold bg-gradient-to-r from-[#297cf6] to-[#0448d3] text-transparent bg-clip-text">핵심 기능만큼은 컨트롤 타워를 통해 강제적으로 연결해 내겠다</span>는 원칙입니다.
                                            </>
                                        ) : (
                                            <>
                                                Stop relying on individual inclinations or goodwill, and<br className="hidden md:block" />
                                                <span className="font-bold bg-gradient-to-r from-[#297cf6] to-[#0448d3] text-transparent bg-clip-text">forcefully connect core functions through a control tower</span>.
                                            </>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 2. Blocked Value Chain Box */}
                        <div className="w-full overflow-x-auto hide-scrollbar pb-6 flex flex-col items-center">
                            <div className={`flex flex-col min-w-[1000px] xl:min-w-0 w-full transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)]`}>
                                
                                {/* Sharp Rectangular Control Tower on Blocked Box */}
                                <div className={`flex items-center justify-center w-full mb-3 transition-all duration-[1000ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 3 ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0'}`}>
                                    <div className="flex flex-col items-center w-full">
                                        <div className="bg-[#1e40af] text-white px-8 py-1.5 font-bold text-[12px] md:text-[14px] tracking-widest uppercase border border-[#1e40af] rounded-none shadow-sm z-20">
                                            CONTROL TOWER
                                        </div>
                                        <div className="w-[3px] h-[16px] md:h-[24px] bg-[#1e40af] opacity-50 z-10 -my-[1px]"></div>
                                        {/* Bridge line connecting to the box */}
                                        <div className="w-[95%] h-[2px] bg-gradient-to-r from-transparent via-[#1e40af] to-transparent opacity-80 z-10"></div>
                                    </div>
                                </div>

                                <div 
                                    className={`flex items-center w-full transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] relative
                                        ${step >= 3 ? 'gap-0 border-[2.5px] border-[#1e40af] rounded-none shadow-[0_15px_40px_rgba(30,64,175,0.15)] overflow-hidden bg-white' : 'gap-[10px] md:gap-[15px] lg:gap-[20px] bg-transparent border-transparent'}
                                    `}
                                >
                                    {stages.map((stage, idx) => (
                                        <React.Fragment key={idx}>
                                            <div 
                                                className={`flex-1 flex flex-col relative overflow-hidden transition-all duration-[1000ms] ease-[cubic-bezier(0.19,1,0.22,1)]
                                                    ${step >= 4 ? 'h-[60px] md:h-[80px]' : 'h-[80px] md:h-[110px]'}
                                                    ${step >= 3 ? 'bg-[#f4f4f5] border-transparent rounded-none shadow-none z-0 border-r border-[#1e40af]/30 last:border-r-0' : 'bg-[#fff] rounded-none border-[2px] border-[#ef4444] shadow-[0_4px_15px_rgba(239,68,68,0.15)] z-20'}
                                                `}
                                            >
                                                {/* Blocked Data Flow restricted INSIDE the individual cell */}
                                                {step >= 3 && <DataFlowCell />}

                                                {/* Top Title Bar */}
                                                <div 
                                                    className={`w-full flex items-center justify-center z-20 transition-all duration-[1000ms]
                                                        ${step >= 3 ? 'bg-[#1e40af] h-[25px] md:h-[35px] py-1 border-none' : 'bg-[#ef4444] h-[25px] md:h-[35px] py-1 border-b border-[#ef4444]'}
                                                    `}
                                                >
                                                    <span className={`transition-all duration-[1000ms] font-bold text-center leading-[1.2] break-keep px-1 text-[9px] md:text-[12px] text-white`}>
                                                        {stage}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Control Tower Force Link (Joints) */}
                                            {idx < stages.length - 1 && (
                                                <div 
                                                    className={`bg-[#1e40af] shrink-0 z-30 transition-all duration-[1000ms] ease-[cubic-bezier(0.19,1,0.22,1)]
                                                        ${step >= 4 ? 'h-[60px] md:h-[80px]' : 'h-[80px] md:h-[110px]'}
                                                        ${step >= 3 ? 'w-[2px] md:w-[3px] opacity-100 scale-y-100' : 'w-0 opacity-0 scale-y-0 mx-0'}
                                                    `} 
                                                ></div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- SCREEN 2: Comparison Block (Expands via max-height, pushing Screen 1 up) --- */}
                <div 
                    className={`w-full flex flex-col items-center justify-start overflow-hidden transition-all duration-[1500ms] ease-[cubic-bezier(0.19,1,0.22,1)]
                        ${step >= 4 ? 'max-h-[1200px] opacity-100 pt-6 md:pt-10' : 'max-h-0 opacity-0'}
                    `}
                >
                    <div className="w-full max-w-[1500px] flex flex-col items-center justify-center px-4 md:px-12 lg:px-20">
                        
                        {/* Downward Arrow */}
                        <div className={`transition-all duration-[800ms] ease-out flex justify-center mb-4 md:mb-6
                            ${step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 scale-50'}`}>
                            <div className="bg-[#1e40af]/10 px-6 py-2 rounded-none border border-[#1e40af]/20">
                                <svg className="w-6 h-6 md:w-8 md:h-8 text-[#1e40af]" fill="none" strokeWidth="2.5" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                </svg>
                            </div>
                        </div>

                        {/* New Heading */}
                        <div className={`transition-all duration-[1000ms] ease-[cubic-bezier(0.19,1,0.22,1)] text-center mb-8 md:mb-12
                            ${step >= 5 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
                        `}>
                            <h2 className="text-[20px] md:text-[28px] lg:text-[34px] font-bold text-[#1d1d1f] tracking-tight leading-[1.4] break-keep border border-transparent">
                                {lang === 'kr' ? (
                                    <>이 공정을, <span className="bg-[#1e40af] text-white px-3 py-1 mr-1">조직의 유연성과 독립성을 확보</span>하면서<br className="hidden md:block"/> 유연하게 연결시키려면?</>
                                ) : (
                                    <>How do we flexibly connect this process, <br className="hidden md:block"/><span className="bg-[#1e40af] text-white px-3 py-1 mr-1">securing the organization's flexibility and independence</span>?</>
                                )}
                            </h2>
                        </div>

                        {/* Unified, Flowing Value Chain Box */}
                        <div className={`w-full overflow-x-auto hide-scrollbar pb-6 flex flex-col items-center transition-all duration-[1500ms] ease-[cubic-bezier(0.19,1,0.22,1)] delay-[300ms]
                            ${step >= 6 ? 'opacity-100 translate-y-0 filter-none' : 'opacity-0 translate-y-12 blur-sm'}
                        `}>
                            <div className={`flex flex-col min-w-[1000px] xl:min-w-0 w-full`}>
                                
                                {/* Sharp Rectangular Control Tower overhead replacing Project Title */}
                                <div className={`flex items-center justify-center w-full mb-3 opacity-0 scale-y-50 origin-bottom transition-all duration-[1000ms] ease-[cubic-bezier(0.19,1,0.22,1)] delay-[1000ms] ${step >= 6 ? 'opacity-100 scale-y-100' : ''}`}>
                                    <div className="flex flex-col items-center w-full">
                                        <div className="bg-[#1e40af] text-white px-8 py-1.5 font-bold text-[12px] md:text-[14px] tracking-widest uppercase border border-[#1e40af] rounded-none shadow-sm z-20">
                                            CONTROL TOWER
                                        </div>
                                        <div className="w-[3px] h-[16px] md:h-[24px] bg-[#1e40af] opacity-50 z-10 -my-[1px]"></div>
                                        <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-[#1e40af] to-transparent opacity-80 z-10 relative"></div>
                                    </div>
                                </div>

                                <div 
                                    className={`flex items-center w-full relative gap-0 border-[2.5px] border-[#1e40af] rounded-none shadow-[0_20px_50px_rgba(30,64,175,0.2)] overflow-hidden bg-white
                                    `}
                                >
                                    {/* Global Flow Engine representing total seamless sharing */}
                                    {step >= 6 && <DataFlowSuccess />}

                                    {stages.map((stage, idx) => (
                                        <React.Fragment key={idx}>
                                            <div 
                                                className={`flex-1 flex flex-col relative overflow-hidden h-[80px] md:h-[110px]
                                                    bg-[#f4f4f5] border-transparent rounded-none shadow-none z-0 
                                                    border-none
                                                `}
                                            >
                                                {/* Top Title Bar */}
                                                <div 
                                                    className={`w-full flex items-center justify-center z-20 bg-[#1e40af] h-[25px] md:h-[35px] py-1 rounded-none`}
                                                >
                                                    <span className={`font-bold text-center leading-[1.2] break-keep px-1 text-[9px] md:text-[12px] text-white opacity-90`}>
                                                        {stage}
                                                    </span>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    ))}
                                </div>

                                {/* Bottom Cross Functional Text */}
                                <div className={`w-full text-center mt-8 md:mt-12 transition-all duration-[1200ms] delay-[1800ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 6 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                                    <h3 className="text-[17px] md:text-[22px] lg:text-[26px] font-extrabold tracking-tight bg-gradient-to-r from-[#297cf6] to-[#0448d3] text-transparent bg-clip-text inline-block break-keep">
                                        {lang === 'kr' ? 'Cross Functional System and CFT(Cross Functional Team) 조직 구축' : 'Establishment of Cross-Functional System and CFT'}
                                    </h3>
                                </div>

                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </section>
    );
}
