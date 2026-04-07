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
    // Reverted to scattered format but with +30% volume and slightly slower speed
    const [streams] = useState(() => Array.from({ length: 78 }).map(() => {
        const colorPalette = ['#3b82f6', '#1d4ed8', '#1e3a8a', '#2dd4bf', '#06b6d4', '#6366f1', '#4f46e5', '#60a5fa'];
        return {
            top: 25 + Math.random() * 70,
            delay: Math.random() * 8, // staggered starts
            duration: 20.0 + Math.random() * 15.0, // Slower traversal
            chars: Math.random() > 0.5 ? "01101  1011  01" : "10  0100  1101 ",
            fontWeightList: Math.random() > 0.65 ? 'font-bold' : 'font-light',
            themeColor: colorPalette[Math.floor(Math.random() * colorPalette.length)]
        };
    }));

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-10" style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}>
            {streams.map((s, i) => (
                <div 
                    key={i} 
                    className={`absolute font-mono leading-none tracking-widest whitespace-pre data-stream-success ${s.fontWeightList}`}
                    style={{
                        top: `${s.top}%`,
                        left: '0',
                        fontSize: 'clamp(10px, 1.2vw, 15px)',
                        color: s.themeColor,
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
        let timeouts = [];
        if (!isActive) {
            setStep(0);
            return;
        }
        
        const setSafe = (val) => setStep(p => Math.max(p, val));

        // Initial cascade of the first screen's animations
        timeouts.push(setTimeout(() => setSafe(1), 500));  // Dilemma
        timeouts.push(setTimeout(() => setSafe(2), 1500)); // Modified Collaboration
        timeouts.push(setTimeout(() => setSafe(3), 2800)); // Merge to blocked state
        
        const nextAction = (e) => {
            if (e.type === 'appSlideNext') {
                if (stepRef.current < 4) {
                    e.preventDefault();
                    setStep(4); // Triggers upward pan and revealing of screen 2
                    timeouts.push(setTimeout(() => setSafe(5), 1000)); // Trigger arrow & text
                    timeouts.push(setTimeout(() => setSafe(6), 2500)); // Trigger totally flowing box
                }
            } else if (e.type === 'appSlidePrev') {
                if (stepRef.current >= 4) {
                    e.preventDefault();
                    setStep(3); // Pan back down to Phase 1
                }
            }
        };

        window.addEventListener('appSlideNext', nextAction);
        window.addEventListener('appSlidePrev', nextAction);

        return () => { 
            timeouts.forEach(clearTimeout);
            window.removeEventListener('appSlideNext', nextAction);
            window.removeEventListener('appSlidePrev', nextAction);
        };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white relative overflow-hidden">
            <style>{`
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

                @keyframes dataFlowSuccessRight {
                    0% { transform: translateX(-10vw); opacity: 0; }
                    10% { opacity: 0.8; }
                    50% { opacity: 1; }
                    80% { opacity: 0.8; }
                    100% { transform: translateX(100vw); opacity: 0; }
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
            
            {/* The Pan Camera Wrapper */}
            <div 
                className={`w-full absolute left-0 top-0 transition-transform duration-[1500ms] ease-[cubic-bezier(0.19,1,0.22,1)]
                    ${step >= 4 ? 'translate-y-[-13vh] md:translate-y-[-16vh]' : 'translate-y-0'}
                `}
            >
                <div className="w-full flex flex-col items-center justify-start relative px-4 md:px-12 lg:px-20 pb-[20vh]">
                    {/* Padding spacer to center Phase 1 initially without strictly binding to 100vh justify */}
                    <div className="w-full h-[15vh] md:h-[22vh] shrink-0"></div>

                    <div className="w-full max-w-[1500px] flex flex-col items-center justify-center space-y-4 md:space-y-6">
                        
                        {/* 1. Text Content (Static in Phase 2 for performance) */}
                        <div className="w-full flex items-center justify-center mb-6 md:mb-10">
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
                                <div className={`mt-[22px] md:mt-[34px] mb-[34px] md:mb-[50px] transition-all duration-[1200ms] delay-[200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} flex flex-col items-center`}>
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
                            <div className={`flex flex-col min-w-0 md:min-w-[1000px] xl:min-w-0 w-full transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)]`}>
                                
                                {/* Sharp Rectangular Control Tower on Blocked Box (Black for Phase 1) */}
                                <div className={`flex items-center justify-center w-full transition-all duration-[1000ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 3 ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0'}`}>
                                    <div className="flex flex-col items-center w-full">
                                        <div className="bg-[#1d1d1f] text-white px-8 py-1.5 font-bold text-[12px] md:text-[14px] tracking-widest uppercase border border-[#1d1d1f] rounded-none shadow-sm z-20">
                                            CONTROL TOWER
                                        </div>
                                        <div className="w-[3px] h-[15px] md:h-[20px] bg-[#1d1d1f] z-10 -my-[1px]"></div>
                                        <div className="w-full flex relative z-10">
                                            {stages.map((_, i) => (
                                                <div key={`ct-line-1-${i}`} className="flex-1 flex flex-col items-center relative">
                                                    <div className="absolute top-0 h-[3px] bg-[#1d1d1f] w-full" style={{ left: i === 0 ? '50%' : '0', width: (i === 0 || i === stages.length - 1) ? '50%' : '100%' }}></div>
                                                    <div className="w-[3px] h-[15px] md:h-[20px] bg-[#1d1d1f]"></div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div 
                                    className={`flex items-center w-full transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] relative
                                        ${step >= 3 ? 'gap-0 border-[2.5px] border-[#1d1d1f] rounded-none shadow-[0_15px_40px_rgba(29,29,31,0.15)] overflow-hidden bg-white' : 'gap-[10px] md:gap-[15px] lg:gap-[20px] bg-transparent border-transparent'}
                                    `}
                                >
                                    {stages.map((stage, idx) => (
                                        <React.Fragment key={idx}>
                                            <div 
                                                className={`flex-1 flex flex-col relative overflow-hidden transition-all duration-[1000ms] ease-[cubic-bezier(0.19,1,0.22,1)]
                                                    ${step >= 4 ? 'h-[60px] md:h-[80px]' : 'h-[80px] md:h-[110px]'}
                                                    ${step >= 3 ? 'bg-[#f4f4f5] border-transparent rounded-none shadow-none z-0 border-r border-[#1d1d1f]/30 last:border-r-0' : 'bg-[#fff] rounded-none border-[2px] border-[#1d1d1f] shadow-[0_4px_15px_rgba(29,29,31,0.1)] z-20'}
                                                `}
                                            >
                                                {step >= 3 && <DataFlowCell />}

                                                <div 
                                                    className={`w-full flex items-center justify-center z-20 transition-all duration-[1000ms]
                                                        ${step >= 3 ? 'bg-[#1d1d1f] h-[25px] md:h-[35px] py-1 border-none' : 'bg-[#1d1d1f] h-[25px] md:h-[35px] py-1 border-b border-[#1d1d1f]'}
                                                    `}
                                                >
                                                    <span className={`transition-all duration-[1000ms] font-bold text-center leading-[1.2] break-all md:break-keep px-[2px] md:px-1 text-[8px] md:text-[12px] text-white`}>
                                                        {stage}
                                                    </span>
                                                </div>
                                            </div>

                                            {idx < stages.length - 1 && (
                                                <div 
                                                    className={`bg-[#1d1d1f] shrink-0 z-30 transition-all duration-[1000ms] ease-[cubic-bezier(0.19,1,0.22,1)]
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

                        {/* Bottom CFT Text for Phase 1 (Organizational Decision) */}
                        <div className={`w-full text-center mt-1 md:mt-5 transition-all duration-[1200ms] delay-[500ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                            <h3 className="text-[15px] md:text-[20px] lg:text-[24px] font-medium text-[#1d1d1f] tracking-tight inline-block break-keep">
                                {lang === 'kr' ? 'Cross Functional System and CFT 조직 구축' : 'Establishment of Cross-Functional System and CFT'}
                            </h3>
                        </div>

                        {/* ========================================================= */}
                        {/* PHASE 2 CONTENTS (Appends seamlessly below Phase 1) */}
                        {/* ========================================================= */}

                        {/* Downward Arrow */}
                        <div className={`transition-all duration-[800ms] ease-out flex justify-center mt-[10px] md:mt-[20px] mb-[20px] md:mb-[30px]
                            ${step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8 scale-50 overflow-hidden max-h-0 min-h-0 m-0 p-0'}
                        `}>
                            <svg className="w-8 h-8 md:w-10 md:h-10 text-[#1d1d1f]" fill="none" strokeWidth="2.5" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </div>

                        {/* New Heading */}
                        <div className={`transition-all duration-[1000ms] ease-[cubic-bezier(0.19,1,0.22,1)] text-center mb-8 md:mb-12
                            ${step >= 5 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95 overflow-hidden max-h-0 min-h-0 m-0 p-0'}
                        `}>
                            <h2 className="text-[20px] md:text-[28px] lg:text-[34px] font-bold text-[#1d1d1f] tracking-tight break-keep border border-transparent" style={{ lineHeight: 'calc(1.4em - 2px)' }}>
                                {lang === 'kr' ? (
                                    <>이 공정을, <span className="bg-gradient-to-r from-red-500 to-orange-500 text-transparent bg-clip-text">조직의 유연성과 독립성을 확보</span>하면서<br className="hidden md:block"/> 유연하게 연결시키려면?</>
                                ) : (
                                    <>How do we flexibly connect this process, <br className="hidden md:block"/><span className="bg-gradient-to-r from-red-500 to-orange-500 text-transparent bg-clip-text">securing the organization's flexibility and independence</span>?</>
                                )}
                            </h2>
                        </div>

                        {/* Unified, Flowing Value Chain Box */}
                        <div className={`w-full overflow-x-auto hide-scrollbar pb-6 flex flex-col items-center transition-all duration-[1500ms] ease-[cubic-bezier(0.19,1,0.22,1)] delay-0
                            ${step >= 6 ? 'opacity-100 translate-y-0 filter-none' : 'opacity-0 translate-y-12 blur-sm overflow-hidden max-h-0 min-h-0 m-0 p-0'}
                        `}>
                            <div className={`flex flex-col min-w-0 md:min-w-[1000px] xl:min-w-0 w-full`}>
                                
                                {/* Sharp Rectangular Control Tower Org Chart */}
                                <div className={`flex items-center justify-center w-full opacity-0 scale-y-50 origin-bottom transition-all duration-[1000ms] ease-[cubic-bezier(0.19,1,0.22,1)] delay-[300ms] ${step >= 6 ? 'opacity-100 scale-y-100' : ''}`}>
                                    <div className="flex flex-col items-center w-full">
                                        <div className="bg-[#1e40af] text-white px-8 py-1.5 font-bold text-[12px] md:text-[14px] tracking-widest uppercase border border-[#1e40af] rounded-none shadow-sm z-20">
                                            CONTROL TOWER
                                        </div>
                                        <div className="w-[3px] h-[15px] md:h-[20px] bg-[#1e40af] z-10 -my-[1px]"></div>
                                        {/* Perfect Org Chart Branching to all 10 Flex Cells */}
                                        <div className="w-full flex relative z-10">
                                            {stages.map((_, i) => (
                                                <div key={`ct-line-2-${i}`} className="flex-1 flex flex-col items-center relative">
                                                    {/* Top horizontal connection */}
                                                    <div className="absolute top-0 h-[3px] bg-[#1e40af] w-full" style={{ left: i === 0 ? '50%' : '0', width: (i === 0 || i === stages.length - 1) ? '50%' : '100%' }}></div>
                                                    {/* Vertical stem down to box */}
                                                    <div className="w-[3px] h-[15px] md:h-[20px] bg-[#1e40af]"></div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div 
                                    className={`flex items-center w-full relative gap-0 border-[4.5px] border-[#1e40af] rounded-none shadow-[0_20px_50px_rgba(30,64,175,0.2)] overflow-hidden bg-white
                                    `}
                                >
                                    {/* Global Flow Engine representing total seamless sharing */}
                                    {step >= 6 && <DataFlowSuccess />}

                                    {stages.map((stage, idx) => (
                                        <React.Fragment key={idx}>
                                            <div 
                                                className={`flex-1 flex flex-col relative overflow-hidden h-[130px] md:h-[175px]
                                                    bg-[#f4f4f5] border-transparent rounded-none shadow-none z-0 
                                                    border-none
                                                `}
                                            >
                                                {/* Top Title Bar */}
                                                <div 
                                                    className={`w-full flex items-center justify-center z-20 bg-[#1e40af] h-[25px] md:h-[35px] py-1 rounded-none`}
                                                >
                                                    <span className={`font-bold text-center leading-[1.2] break-all md:break-keep px-[2px] md:px-1 text-[8px] md:text-[12px] text-white opacity-90`}>
                                                        {stage}
                                                    </span>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    ))}
                                </div>
                                
                                {/* Bottom IFPDP Text for Phase 2 (Technical Solution) */}
                                <div className={`w-full text-center mt-8 md:mt-12 transition-all duration-[1200ms] delay-[1800ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 6 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 overflow-hidden max-h-0 min-h-0 m-0 p-0'}`}>
                                    <h3 className="text-[14px] md:text-[18px] lg:text-[22px] font-medium text-[#1d1d1f] tracking-tight inline-block break-keep">
                                        {lang === 'kr' ? 'Cross Functional System and CFT 조직 구축' : 'Establishment of Cross-Functional System and CFT'}
                                    </h3>
                                    <div className="text-[18px] font-normal text-[#999] mt-1 mb-0 leading-none">with</div>
                                    <h3 className="text-[18px] md:text-[25px] lg:text-[30px] font-extrabold tracking-tight bg-gradient-to-r from-[#297cf6] to-[#0448d3] text-transparent bg-clip-text inline-block break-keep">
                                        IFPDP (IGIS Fund Production Data Platform)
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
