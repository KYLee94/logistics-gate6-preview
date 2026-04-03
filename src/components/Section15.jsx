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
        timers.push(setTimeout(() => setStep(1), 500));  // Title & Headers
        timers.push(setTimeout(() => setStep(2), 1000)); // Description
        timers.push(setTimeout(() => setStep(3), 1500)); // Orbit Diagram
        timers.push(setTimeout(() => setStep(4), 2000)); // Role 1
        timers.push(setTimeout(() => setStep(5), 2300)); // Role 2
        timers.push(setTimeout(() => setStep(6), 2600)); // Role 3

        return () => timers.forEach(t => clearTimeout(t));
    }, [isActive]);

    // Data points for the 10 stages of the value chain
    const nodesKr = ['운영', '소싱', '투자', '펀드생성', '개발추진', '파이낸싱', '유저솔루션', '기업마케팅', '개발관리', '준공'];
    const nodesEn = ['Operation', 'Sourcing', 'Investment', 'Fund Creation', 'Development', 'Financing', 'User Solution', 'Corp Marketing', 'Dev Mgmt', 'Completion'];

    const nodes = lang === 'kr' ? nodesKr : nodesEn;
    
    // Mathematically perfect radius settings
    const radius = 180; // Orbit circle radius (px) - Diameter is 360px
    const labelRadius = 220; // Exact distance from center to center of text (px)

    return (
        <section className="relative section w-full h-full flex flex-col overflow-hidden bg-[#fafafc] text-[#1d1d1f] justify-center items-center">
            
            <style>
                {`
                    @keyframes orbitSpin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    @keyframes orbitSpinReverse {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(-360deg); }
                    }
                    @keyframes dataFlowOut {
                        0% { transform: translateY(-50%) translateX(60px); opacity: 0; }
                        20% { opacity: 1; }
                        80% { opacity: 1; }
                        100% { transform: translateY(-50%) translateX(170px); opacity: 0; }
                    }
                    @keyframes dataFlowIn {
                        0% { transform: translateY(-50%) translateX(170px); opacity: 0; }
                        20% { opacity: 1; }
                        80% { opacity: 1; }
                        100% { transform: translateY(-50%) translateX(60px); opacity: 0; }
                    }
                `}
            </style>

            {/* Perfect viewport-centering container wrapping all 3 blocks uniformly */}
            <div className="w-full max-w-[1400px] px-6 md:px-12 flex flex-col items-center justify-center -translate-y-10">
                
                {/* 1. Header Phase */}
                <div className="w-full flex flex-col items-center text-center relative z-30 mb-10 md:mb-14">
                    <span className={`text-[#1d1d1f] font-bold text-[11px] md:text-[13px] tracking-widest uppercase mb-3 transition-all duration-1000 ease-out delay-[0ms] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        The Steering Wheel
                    </span>
                    
                    <h2 
                        className={`text-[32px] md:text-[44px] lg:text-[48px] font-bold leading-[1.2] tracking-tight text-[#1d1d1f] mb-3 transition-all duration-1000 ease-out delay-[100ms] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} 
                    >
                        {lang === 'kr' ? 'CFT 전략의 조향장치' : 'Steering Wheel of CFT Strategy'}
                    </h2>
                    
                    <h3 className={`text-[18px] md:text-[22px] font-bold text-[#86868b] tracking-tight mb-8 transition-all duration-1000 ease-out delay-[200ms] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        {lang === 'kr' ? '통합 실행 조직 - The Orchestrator' : 'Integrated Execution - The Orchestrator'}
                    </h3>

                    <p className={`text-[19px] md:text-[20px] lg:text-[21px] font-bold text-[#424245] leading-[1.6] break-keep max-w-[1000px] transition-all duration-1000 ease-out delay-[100ms] ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        {lang === 'kr' ? (
                            <>
                                플랫폼은 데이터를 모을 수 있지만, 맥락과 거버넌스를 직접 만들어낼 수는 없습니다.<br className="hidden md:block" />
                                기획추진센터는 가치사슬 간 시너지와 IFPDP의 선순환 기능을 극대화 하기 위해 다음의 역할을 수행합니다.
                            </>
                        ) : (
                            <>
                                A platform can aggregate data, but it cannot create context and governance directly.<br className="hidden md:block" />
                                The Planning & Promotion Center performs the following roles to maximize IFPDP synergy.
                            </>
                        )}
                    </p>
                </div>

                {/* 2. Main Centered Orbital Diagram */}
                <div className={`relative w-full flex justify-center items-center mb-[60px] transition-all duration-1000 ease-out ${step >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} style={{ height: '460px' }}>
                    
                    {/* The spinning component wrapper */}
                    <div className="absolute z-20 origin-center" style={{ animation: 'orbitSpin 60s linear infinite', width: `${radius * 2}px`, height: `${radius * 2}px` }}>
                        
                        {/* Orbit Track Line */}
                        <div className="absolute inset-0 rounded-full border border-gray-300 pointer-events-none" />

                        {/* Minimalist Data Exchange Spokes */}
                        {nodes.map((_, i) => {
                            const rotateDeg = i * 36 - 90;
                            // Alternating in and out logic
                            const isOutward = i % 2 === 0;
                            return (
                                <div key={`spoke-${i}`} 
                                     className="absolute top-1/2 left-1/2 h-[1px] bg-gradient-to-r from-transparent via-gray-300/60 to-gray-300 origin-left"
                                     style={{
                                         width: `${radius}px`,
                                         transform: `translateY(-50%) rotate(${rotateDeg}deg)`,
                                     }}>
                                    {/* Simple Data Dot moving along the spoke */}
                                    <div 
                                        className="absolute top-1/2 w-[3px] h-[3px] bg-black rounded-full"
                                        style={{ 
                                            transform: 'translateY(-50%)',
                                            animation: `${isOutward ? 'dataFlowOut' : 'dataFlowIn'} ${2.5 + (i % 3) * 0.4}s ease-in-out infinite`,
                                            animationDelay: `${i * 0.3}s`
                                        }} 
                                    />
                                </div>
                            );
                        })}

                        {/* Nodes & Accurately Distributed Labels */}
                        {nodes.map((node, i) => {
                            const angleRad = (i * 36 - 90) * (Math.PI / 180);
                            
                            const dotX = Math.cos(angleRad) * radius;
                            const dotY = Math.sin(angleRad) * radius;
                            
                            const labelX = Math.cos(angleRad) * labelRadius;
                            const labelY = Math.sin(angleRad) * labelRadius;
                            
                            return (
                                <React.Fragment key={`node-${i}`}>
                                    {/* Rotating Black Solid Dot */}
                                    <div 
                                        className="absolute w-[16px] h-[16px] bg-black rounded-full shadow-sm ring-[3px] ring-[#fafafc]"
                                        style={{
                                            left: `calc(50% + ${dotX}px)`,
                                            top: `calc(50% + ${dotY}px)`,
                                            transform: 'translate(-50%, -50%)',
                                        }}
                                    />
                                    {/* Perfect Geometric Label Wrapper */}
                                    <div 
                                        className="absolute flex justify-center items-center"
                                        style={{
                                            left: `calc(50% + ${labelX}px)`,
                                            top: `calc(50% + ${labelY}px)`,
                                            transform: 'translate(-50%, -50%)',
                                        }}
                                    >
                                        <div className="origin-center" style={{ animation: 'orbitSpinReverse 60s linear infinite' }}>
                                            <div className="text-[16px] font-bold text-black whitespace-nowrap leading-none tracking-tight" 
                                                 style={{ transform: 'rotate(-45deg)' }}>
                                                {node}
                                            </div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {/* Static Core Inner Layer */}
                    <div className="absolute w-[110px] h-[110px] rounded-full bg-black flex flex-col items-center justify-center z-30 shadow-[0_15px_30px_rgba(0,0,0,0.2)]">
                        <span className="text-white font-bold text-[18px] tracking-tight leading-tight">IFPDP</span>
                        <span className="text-[#a1a1aa] font-medium text-[12px] tracking-tight mt-0.5" style={{ fontFamily: "'Sanomat', sans-serif" }}>Core</span>
                    </div>

                </div>

                {/* 3. Bottom: Free-flowing 3 Columns Row Layout */}
                <div className="w-full max-w-[1600px] px-0 lg:px-4 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 lg:gap-12 text-left z-20 pb-4">
                    
                    {/* Role 1 */}
                    <div className={`flex flex-col w-full transition-all duration-700 ease-out ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <h3 className="text-[23px] font-bold text-black mb-2 tracking-tight">1. Rule Setting</h3>
                        <p className="text-[19px] font-bold text-[#626262] leading-[1.6]">
                            {lang === 'kr' ? (
                                <>각 조직과 협업하여 10단계 가치사슬 간 필수 데이터<br/>연동 표준안 수립</>
                            ) : (
                                <>Establish essential data linkage standards across<br/>the 10-stage value chain.</>
                            )}
                        </p>
                    </div>

                    {/* Role 2 */}
                    <div className={`flex flex-col w-full transition-all duration-700 ease-out ${step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <h3 className="text-[23px] font-bold text-black mb-2 tracking-tight">2. Bottleneck Removal</h3>
                        <p className="text-[19px] font-bold text-[#626262] leading-[1.6]">
                            {lang === 'kr' ? (
                                <>권한이 모호한 회색지대와 데이터 병목 구간<br/>조율 및 해소</>
                            ) : (
                                <>Coordinate and resolve ambiguous operational<br/>gray areas and data bottlenecks.</>
                            )}
                        </p>
                    </div>

                    {/* Role 3 */}
                    <div className={`flex flex-col w-full transition-all duration-700 ease-out ${step >= 6 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <h3 className="text-[23px] font-bold text-black mb-2 tracking-tight">3. Optimization & Evolution</h3>
                        <p className="text-[19px] font-bold text-[#626262] leading-[1.6]">
                            {lang === 'kr' ? (
                                <>데이터 자산의 지속적 고도화 및 AI 플랫폼 운영<br/>거버넌스 관리</>
                            ) : (
                                <>Continuously advance data assets and manage<br/>AI platform governance.</>
                            )}
                        </p>
                    </div>
                </div>

            </div>
        </section>
    );
}
