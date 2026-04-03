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
        timers.push(setTimeout(() => setStep(3), 1500)); // Left Circle Diagram
        timers.push(setTimeout(() => setStep(4), 2000)); // Right Card Base
        timers.push(setTimeout(() => setStep(5), 2400)); // Role 1
        timers.push(setTimeout(() => setStep(6), 2800)); // Role 2
        timers.push(setTimeout(() => setStep(7), 3200)); // Role 3

        return () => timers.forEach(t => clearTimeout(t));
    }, [isActive]);

    // Data points for the 10 stages of the value chain
    const nodesKr = ['운영', '소싱', '투자', '펀드생성', '개발추진', '파이낸싱', '유저솔루션', '기업마케팅', '개발관리', '준공'];
    const nodesEn = ['Operation', 'Sourcing', 'Investment', 'Fund Creation', 'Development', 'Financing', 'User Solution', 'Corp Marketing', 'Dev Mgmt', 'Completion'];

    const nodes = lang === 'kr' ? nodesKr : nodesEn;
    const radius = 150; // Orbit circle radius (px)
    const labelRadius = 195; // Label distance from center (px)

    return (
        <section className="relative section w-full h-full flex flex-col overflow-hidden bg-[#fafafc] text-[#1d1d1f]">
            
            <div className="w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1200px] h-full mx-auto flex flex-col pt-24 md:pt-[7%] pb-10">
                
                {/* Header Phase */}
                <div className="w-full flex flex-col items-center text-center px-4 md:px-0 relative z-30">
                    <span className={`text-[#1d1d1f] font-bold text-[12px] md:text-[13px] tracking-widest uppercase mb-3 transition-all duration-1000 ease-out delay-[0ms] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        The Steering Wheel
                    </span>
                    
                    <h2 
                        className={`text-[32px] md:text-[42px] lg:text-[48px] font-bold leading-[1.2] tracking-tight text-[#1d1d1f] mb-3 transition-all duration-1000 ease-out delay-[100ms] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} 
                    >
                        {lang === 'kr' ? 'CFT 전략의 조향장치' : 'Steering Wheel of CFT Strategy'}
                    </h2>
                    
                    <h3 className={`text-[18px] md:text-[22px] font-bold text-[#86868b] tracking-tight mb-8 transition-all duration-1000 ease-out delay-[200ms] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        {lang === 'kr' ? '통합 실행 조직 - The Orchestrator' : 'Integrated Execution - The Orchestrator'}
                    </h3>

                    <p className={`text-[15px] md:text-[16px] lg:text-[17px] font-medium text-[#86868b] leading-[1.6] break-keep max-w-[700px] mx-auto transition-all duration-1000 ease-out delay-[100ms] ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
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

                {/* Main Content Row */}
                <div className="flex flex-col lg:flex-row w-full flex-1 mt-12 mb-8 lg:mt-16 items-center lg:items-stretch justify-center lg:justify-between gap-10 lg:gap-0 z-20">
                    
                    {/* Left: Circular Diagram */}
                    <div className={`relative w-full max-w-[400px] lg:w-[45%] h-[400px] flex items-center justify-center transition-all duration-1000 ease-out ${step >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                        {/* Orbit Line */}
                        <div className="absolute w-[300px] h-[300px] rounded-full border border-[#d1d5db] z-10" />
                        
                        {/* Core Circle */}
                        <div className="absolute w-[100px] h-[100px] rounded-full bg-black flex flex-col items-center justify-center z-30 shadow-lg">
                            <span className="text-white font-bold text-[18px] tracking-tight leading-tight">IFPDP</span>
                            <span className="text-[#a1a1aa] font-medium text-[12px] tracking-tight mt-0.5">{lang === 'kr' ? '기획추진' : 'Core'}</span>
                        </div>

                        {/* Nodes & Labels */}
                        {nodes.map((node, i) => {
                            const angleRad = (i * 36 - 90) * (Math.PI / 180);
                            const dotX = Math.cos(angleRad) * radius;
                            const dotY = Math.sin(angleRad) * radius;
                            
                            const labelX = Math.cos(angleRad) * labelRadius;
                            const labelY = Math.sin(angleRad) * labelRadius;

                            const isLeftHalf = i > 4 && i < 10;
                            
                            return (
                                <React.Fragment key={`node-${i}`}>
                                    {/* Black Solid Dot */}
                                    <div 
                                        className="absolute w-[18px] h-[18px] bg-black rounded-full z-20"
                                        style={{
                                            left: `calc(50% + ${dotX}px)`,
                                            top: `calc(50% + ${dotY}px)`,
                                            transform: 'translate(-50%, -50%)',
                                        }}
                                    />
                                    {/* Text Label */}
                                    <div 
                                        className="absolute text-[13px] font-bold text-black whitespace-nowrap z-20 leading-none"
                                        style={{
                                            left: `calc(50% + ${labelX}px)`,
                                            top: `calc(50% + ${labelY}px)`,
                                            transform: `translate(${isLeftHalf ? '-100%' : '0%'}, -50%)`,
                                            marginLeft: isLeftHalf ? '-6px' : '4px' // Minor offset for spacing
                                        }}
                                    >
                                        {node}
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {/* Right: Orchestrator Roles Card */}
                    <div className={`w-full lg:w-[50%] max-w-[600px] bg-white rounded-[32px] p-10 md:p-14 shadow-[0_10px_40px_rgba(0,0,0,0.03)] border border-[#e5e7eb] flex flex-col justify-center space-y-10 transition-all duration-1000 ease-out ${step >= 4 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
                        
                        {/* Role 1 */}
                        <div className={`flex flex-col transition-all duration-700 ease-out ${step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            <h3 className="text-[20px] font-bold text-black mb-2 tracking-tight">Rule Setting</h3>
                            <p className="text-[15px] font-medium text-[#86868b] leading-[1.6] break-keep">
                                {lang === 'kr' ? '각 조직과 협업하여 10단계 가치사슬 간 필수 데이터 연동 표준안 수립' : 'Establish essential data linkage standards across the 10-stage value chain.'}
                            </p>
                        </div>

                        {/* Role 2 */}
                        <div className={`flex flex-col transition-all duration-700 ease-out ${step >= 6 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            <h3 className="text-[20px] font-bold text-black mb-2 tracking-tight">Bottleneck Removal</h3>
                            <p className="text-[15px] font-medium text-[#86868b] leading-[1.6] break-keep">
                                {lang === 'kr' ? '권한이 모호한 회색지대와 데이터 병목 구간 조율 및 해소' : 'Coordinate and resolve ambiguous operational gray areas and data bottlenecks.'}
                            </p>
                        </div>

                        {/* Role 3 */}
                        <div className={`flex flex-col transition-all duration-700 ease-out ${step >= 7 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            <h3 className="text-[20px] font-bold text-black mb-2 tracking-tight">Optimization & Evolution</h3>
                            <p className="text-[15px] font-medium text-[#86868b] leading-[1.6] break-keep">
                                {lang === 'kr' ? '데이터 자산의 지속적 고도화 및 AI 플랫폼 운영 거버넌스 관리' : 'Continuously advance data assets and manage AI platform governance.'}
                            </p>
                        </div>

                    </div>
                </div>

            </div>
        </section>
    );
}
