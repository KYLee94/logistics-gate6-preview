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
        timers.push(setTimeout(() => setStep(3), 2000)); // Orbit and Core
        timers.push(setTimeout(() => setStep(4), 2800)); // Particles Flow
        timers.push(setTimeout(() => setStep(5), 3400)); // Card 1 (Protocol)
        timers.push(setTimeout(() => setStep(6), 3800)); // Card 2 (Bottleneck)
        timers.push(setTimeout(() => setStep(7), 4200)); // Card 3 (Resource Orchestration)

        return () => timers.forEach(t => clearTimeout(t));
    }, [isActive]);

    // Data points configuration for the 10 stages of the value chain
    const valueChainPoints = Array.from({ length: 10 });

    return (
        <section className="relative section w-full h-full flex flex-col overflow-hidden bg-[#fafafc] text-[#1d1d1f]">
            
            {/* Inline CSS for dynamic organic animations */}
            <style>
                {`
                    @keyframes orbitSpin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    @keyframes bloodFlowIn {
                        0% { transform: translateY(-50%) rotate(var(--angle)) translateX(240px); opacity: 0; }
                        20% { opacity: 1; }
                        80% { opacity: 1; }
                        100% { transform: translateY(-50%) rotate(var(--angle)) translateX(60px); opacity: 0; }
                    }
                    @keyframes bloodFlowOut {
                        0% { transform: translateY(-50%) rotate(var(--angle)) translateX(60px); opacity: 0; }
                        20% { opacity: 1; }
                        80% { opacity: 1; }
                        100% { transform: translateY(-50%) rotate(var(--angle)) translateX(240px); opacity: 0; }
                    }
                    @keyframes wavePulse {
                        0% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.05); }
                        70% { box-shadow: 0 0 0 35px rgba(0, 0, 0, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
                    }
                    @keyframes rhythmBeat {
                        0%, 100% { transform: scale(1); opacity: 0.8; }
                        50% { transform: scale(1.1); opacity: 1; }
                    }
                    @keyframes softGlow {
                        0%, 100% { filter: drop-shadow(0px 0px 15px rgba(0,0,0,0.1)); }
                        50% { filter: drop-shadow(0px 0px 30px rgba(0,0,0,0.25)); }
                    }
                `}
            </style>

            <div className="w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1400px] h-full mx-auto flex flex-col pt-24 md:pt-[6%] pb-10">
                
                {/* Header Phase */}
                <div className="w-full flex flex-col items-center text-center px-4 md:px-0 relative z-30">
                    <span className={`text-[#86868b] font-semibold text-[13px] md:text-[14px] tracking-[0.3em] uppercase mb-4 transition-all duration-1000 ease-out delay-[0ms] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        THE STEERING WHEEL
                    </span>
                    
                    <h2 
                        className={`text-[28px] md:text-[38px] lg:text-[45px] font-medium leading-[1.2] tracking-tight text-[#1d1d1f] mb-6 md:mb-8 transition-all duration-1000 ease-out delay-[100ms] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} 
                        style={{ fontFamily: "'Sanomat Wp', 'Sanomat Web', 'Sanomat', sans-serif" }}
                    >
                        {lang === 'kr' ? (
                            <>
                                자연스러운 순환과 유기적인 조율
                                <span className="text-[22px] md:text-[30px] text-[#86868b] mt-2 block font-sans font-semibold tracking-normal">The Orchestrator : 기획추진실</span>
                            </>
                        ) : (
                            <>
                                Natural Circulation & Organic Orchestration
                                <span className="text-[22px] md:text-[30px] text-[#86868b] mt-2 block font-sans font-semibold tracking-normal">IFPDP Core</span>
                            </>
                        )}
                    </h2>

                    <p className={`text-[16px] md:text-[18px] lg:text-[20px] font-medium text-[#424245] leading-[1.6] break-keep max-w-[880px] mx-auto transition-all duration-1000 ease-out delay-[100ms] ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        {lang === 'kr' ? (
                            <>
                                플랫폼은 데이터를 모을 수 있지만, 부서 간의 이해관계를 조정할 수는 없습니다.<br className="hidden md:block" />
                                <strong>기획추진실</strong>은 부서 간의 경계를 허물고 실행 속도를 극대화하기 위해 <br className="hidden lg:block" />타 부서를 감시하는 구조가 아닌, 전사 가치사슬이 매끄럽게 연결되는 조율 레이어로 존재합니다.
                            </>
                        ) : (
                            <>
                                A platform aggregates data, but it cannot align inter-departmental interests.<br className="hidden md:block" />
                                The <strong>IFPDP Core</strong> acts not as a supervisor, but as an indispensable orchestration layer<br className="hidden lg:block" />that dissolves silos and ensures seamless operational flow across the value chain.
                            </>
                        )}
                    </p>
                </div>

                {/* Circular Ecosystem (Desktop) */}
                <div className="relative flex-1 w-full max-w-[1200px] mx-auto hidden lg:flex items-center justify-center -mt-8 z-10">
                    
                    {/* The Circular Track (Orbit) */}
                    <div className={`absolute w-[500px] h-[500px] rounded-full border border-black/10 transition-all duration-[2000ms] ease-out z-10 ${step >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.3]'}`}>
                        
                        {/* 10 Value Chain Nodes (Sourcing ~ Launch) distributed on the ring */}
                        <div className="absolute inset-0 w-full h-full" style={{ animation: 'orbitSpin 60s linear infinite' }}>
                            {valueChainPoints.map((_, i) => {
                                const angle = (i / 10) * 360;
                                return (
                                    <div key={i} className="absolute bottom-1/2 left-1/2 w-[2px] h-[250px] origin-bottom"
                                         style={{ transform: `translateX(-50%) rotate(${angle}deg)` }}>
                                         <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[10px] h-[10px] bg-[#1d1d1f]/20 rounded-full ring-4 ring-[#fafafc]"></div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Data Blood Circulation (Particles flowing in and out) */}
                    <div className={`absolute inset-0 transition-opacity duration-1000 z-20 ${step >= 4 ? 'opacity-100' : 'opacity-0'}`}>
                        {/* Inward Particles */}
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={`in-${i}`} className="absolute top-1/2 left-1/2 w-[40px] h-[2px] rounded-full bg-gradient-to-r from-transparent via-black/40 to-[#1d1d1f] origin-left"
                                 style={{
                                     '--angle': `${i * 72}deg`,
                                     animation: `bloodFlowIn ${3.5 + i * 0.4}s ease-in-out infinite`,
                                     animationDelay: `${i * 0.5}s`
                                 }}></div>
                        ))}
                        {/* Outward Particles */}
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={`out-${i}`} className="absolute top-1/2 left-1/2 w-[40px] h-[2px] rounded-full bg-gradient-to-r from-[#1d1d1f] via-black/40 to-transparent origin-left"
                                 style={{
                                     '--angle': `${45 + i * 72}deg`,
                                     animation: `bloodFlowOut ${3 + i * 0.3}s ease-in-out infinite`,
                                     animationDelay: `${i * 0.2}s`
                                 }}></div>
                        ))}
                    </div>

                    {/* IFPDP Core (The Heart) */}
                    <div className={`absolute w-[120px] h-[120px] rounded-full bg-[#161618] flex flex-col items-center justify-center text-white z-40 transition-all duration-[1500ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${step >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                         style={{ animation: step >= 4 ? 'softGlow 6s infinite ease-in-out' : 'none' }}>
                        <div className="w-[100px] h-[100px] rounded-full border border-white/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[spin_10s_linear_infinite_reverse]"></div>
                        <span className="text-[18px] font-bold tracking-tight z-10">IFPDP</span>
                        <span className="text-[11px] font-semibold tracking-[0.25em] text-white/50 uppercase mt-1 z-10">Core</span>
                    </div>

                    {/* Translucent Layer 1: Protocol Design (Top Left) */}
                    <div className={`absolute -top-10 left-5 w-[330px] p-7 rounded-[32px] bg-white/60 backdrop-blur-2xl border border-white shadow-[0_15px_40px_rgba(0,0,0,0.03)] z-30 transition-all duration-[1200ms] ease-out ${step >= 5 ? 'opacity-100 translate-x-0 translate-y-0' : 'opacity-0 -translate-x-8 -translate-y-8'}`}>
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[15px] font-bold text-[#1d1d1f] shadow-sm mb-4">1</div>
                        <h4 className="text-[18px] lg:text-[20px] font-bold text-[#1d1d1f] mb-2 tracking-tight flex items-center gap-2">
                            Protocol Design
                            <div className="flex h-2 w-10 bg-gradient-to-r from-transparent via-[#1d1d1f]/20 to-transparent animate-pulse rounded-full ml-1"></div>
                        </h4>
                        <p className="text-[14px] lg:text-[14px] text-[#424245] leading-[1.6] break-keep font-medium">
                            {lang === 'kr' ? '가치사슬 데이터 궤도를 매끄럽게 닦아주는 가이드라인. 연동 표준안을 수립하여 실무진의 반복적인 물리적 수작업과 중복 검토를 제거합니다.' : 'A guideline rounding the complex data orbit. Establishes linking standards seamlessly erasing redundant workflows.'}
                        </p>
                    </div>

                    {/* Translucent Layer 2: Bottleneck Removal (Top Right) */}
                    <div className={`absolute -top-10 right-5 w-[330px] p-7 rounded-[32px] bg-white/60 backdrop-blur-2xl border border-white shadow-[0_15px_40px_rgba(0,0,0,0.03)] z-30 transition-all duration-[1200ms] ease-out ${step >= 6 ? 'opacity-100 translate-x-0 translate-y-0' : 'opacity-0 translate-x-8 -translate-y-8'}`}>
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[15px] font-bold text-[#1d1d1f] shadow-sm mb-4"
                             style={{ animation: 'wavePulse 3s infinite' }}>2</div>
                        <h4 className="text-[18px] lg:text-[20px] font-bold text-[#1d1d1f] mb-2 tracking-tight flex items-center gap-2">
                            Bottleneck Removal
                            <div className="flex h-[2px] w-8 overflow-hidden ml-1 opacity-60">
                                <div className="w-4 h-full bg-[#1d1d1f] animate-[bloodFlowOut_1s_infinite]"></div>
                            </div>
                        </h4>
                        <p className="text-[14px] lg:text-[14px] text-[#424245] leading-[1.6] break-keep font-medium">
                            {lang === 'kr' ? '트랙의 정체 구간에 잔잔한 파동을 일으켜 시스템 윤활유를 공급. 권한이 모호한 회색지대와 병목 구간을 해소하여 실무를 지원합니다.' : 'Lubricating fluid dissolving jammed track sections. Removes critical bottleneck layers efficiently.'}
                        </p>
                    </div>

                    {/* Translucent Layer 3: Resource Orchestration (Bottom Center) */}
                    <div className={`absolute -bottom-6 w-[360px] p-7 rounded-[32px] bg-white/60 backdrop-blur-2xl border border-white shadow-[0_15px_40px_rgba(0,0,0,0.03)] z-30 flex flex-col items-center text-center transition-all duration-[1200ms] ease-out ${step >= 7 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[15px] font-bold text-[#1d1d1f] shadow-sm mb-4"
                             style={{ animation: 'rhythmBeat 3.5s ease-in-out infinite' }}>3</div>
                        <h4 className="text-[18px] lg:text-[20px] font-bold text-[#1d1d1f] mb-2 tracking-tight">Resource Orchestration</h4>
                        <p className="text-[14px] lg:text-[14px] text-[#424245] leading-[1.6] break-keep font-medium">
                            {lang === 'kr' ? 'IFPDP 코어의 역량과 에너지를 전체 파이프라인에 최적화된 리듬감으로 연결하고, 전사 관점의 파트너 자원을 유기적으로 분배합니다.' : 'Distributes profound core energies to all connected pipelines dynamically synchronizing holistic resource values.'}
                        </p>
                    </div>

                </div>

                {/* Mobile Linear Adaptation of the Organic Layers (Tablet & Below) */}
                <div className={`flex flex-col lg:hidden w-full mt-6 space-y-5 pb-12 transition-all duration-1000 ease-out ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    
                    {/* Core Mobile */}
                    <div className={`bg-[#121212] py-8 rounded-[40px] text-center relative z-20 shadow-[0_20px_50px_rgba(0,0,0,0.2)] text-white w-full max-w-[280px] mx-auto`}>
                        <h3 className="text-[26px] font-bold tracking-tight whitespace-nowrap">IFPDP Core</h3>
                        <p className="text-[12px] opacity-60 tracking-[0.25em] font-medium mt-1 uppercase">Central Hub Node</p>
                    </div>

                    {/* Connecting dashed line replacing solid structural line */}
                    <div className={`w-[2px] h-8 border-l-[2px] border-dashed border-black/15 mx-auto transition-transform origin-top duration-[1500ms] ease-out ${step >= 4 ? 'scale-y-100' : 'scale-y-0'}`}></div>

                    {/* Soft Translucent Cards for Mobile */}
                    <div className={`bg-white/60 backdrop-blur-xl p-7 rounded-[32px] border border-white shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col items-start transition-all duration-1000 ease-out delay-[100ms] ${step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[14px] font-bold text-[#1d1d1f] shadow-sm mb-4">1</div>
                        <h4 className="text-[18px] font-bold text-[#1d1d1f] mb-2 tracking-tight">Protocol Design</h4>
                        <p className="text-[14px] text-[#424245] leading-[1.6] break-keep font-medium">
                            {lang === 'kr' ? '가치사슬 데이터 궤도를 매끄럽게 닦아주는 가이드라인. 연동 표준안을 수립하여 중복 검토를 제거합니다.' : 'A guideline rounding the complex data orbit reliably.'}
                        </p>
                    </div>

                    <div className={`bg-white/60 backdrop-blur-xl p-7 rounded-[32px] border border-white shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col items-start transition-all duration-1000 ease-out delay-[200ms] ${step >= 6 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[14px] font-bold text-[#1d1d1f] shadow-sm mb-4" style={{ animation: 'wavePulse 3s infinite' }}>2</div>
                        <h4 className="text-[18px] font-bold text-[#1d1d1f] mb-2 tracking-tight">Bottleneck Removal</h4>
                        <p className="text-[14px] text-[#424245] leading-[1.6] break-keep font-medium">
                            {lang === 'kr' ? '트랙의 정체 구간에 잔잔한 파동을 일으켜 윤활. 모호한 회색지대와 병목 구간을 해소하여 실무를 지원합니다.' : 'A soothing wave dissolving jammed track bottlenecks sequentially.'}
                        </p>
                    </div>

                    <div className={`bg-white/60 backdrop-blur-xl p-7 rounded-[32px] border border-white shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col items-start transition-all duration-1000 ease-out delay-[300ms] ${step >= 7 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[14px] font-bold text-[#1d1d1f] shadow-sm mb-4" style={{ animation: 'rhythmBeat 3.5s infinite' }}>3</div>
                        <h4 className="text-[18px] font-bold text-[#1d1d1f] mb-2 tracking-tight">Resource Orchestration</h4>
                        <p className="text-[14px] text-[#424245] leading-[1.6] break-keep font-medium">
                            {lang === 'kr' ? 'IFPDP 코어의 에너지를 전체 파이프라인에 리듬감 있게 연결하고, 자원을 조율된 타이밍에 유기적으로 분배합니다.' : 'Distributes profound core energies iteratively to interconnected pipelines.'}
                        </p>
                    </div>
                </div>

            </div>
            
        </section>
    );
}
