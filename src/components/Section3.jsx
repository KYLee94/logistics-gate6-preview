import React, { useState, useEffect } from 'react';

export default function Section3({ isActive }) {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }
        
        // Premium Cascade Timing
        const t1 = setTimeout(() => setStep(1), 500);  // "AI의 진짜 위력은"
        const t2 = setTimeout(() => setStep(2), 1200); // "내 PC 안의"
        const t3 = setTimeout(() => setStep(3), 1400); // "리치한 데이터에서"
        const t4 = setTimeout(() => setStep(4), 1600); // "나옵니다."
        const t5 = setTimeout(() => setStep(5), 2600); // ✨ Magical Glow Bloom

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-[#fbfbfd] flex flex-col items-center justify-center relative px-6 overflow-hidden">
            
            {/* ✨ Subtle Background Glow - Blooms violently but softly when step 5 triggers */}
            <div className={`absolute top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] md:w-[700px] md:h-[700px] bg-gradient-to-tr from-[#007AFF]/25 to-[#B026FF]/25 rounded-full blur-[100px] md:blur-[140px] transition-all duration-[2000ms] ease-out ${step >= 5 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} pointer-events-none`}></div>

            <div className="w-full max-w-[1200px] flex flex-col items-center justify-center text-center font-sans tracking-tight relative z-10">
                
                {/* 1. Introduction Phrase */}
                <div className="overflow-hidden mb-10 md:mb-16">
                    <p className={`text-[20px] md:text-[32px] font-medium text-gray-500 tracking-[-0.02em] transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 1 ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-full opacity-0 scale-95'}`}>
                        AI의 진짜 위력은
                    </p>
                </div>

                {/* 2. Hero Stack 1 */}
                <div className="overflow-hidden pb-1 md:pb-2">
                    <p className={`text-[40px] sm:text-[60px] md:text-[80px] lg:text-[100px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-[1.05] transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}>
                        내 PC 안의
                    </p>
                </div>

                {/* 3. Hero Stack 2 (Rich Data) */}
                <div className="overflow-hidden pb-1 md:pb-2">
                    <p className={`text-[40px] sm:text-[60px] md:text-[80px] lg:text-[100px] font-bold tracking-[-0.03em] leading-[1.05] transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 3 ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}>
                        <span className="relative inline-block">
                            <span className="text-[#1d1d1f] transition-opacity duration-1000">
                                '리치한 데이터(Rich Data)'
                            </span>
                            {/* Absolute overlay for smooth gradient fade in, completely circumventing cross-browser bg-clip-text interpolation bugs */}
                            <span 
                                className={`absolute top-0 left-0 w-full h-full bg-clip-text text-transparent bg-gradient-to-r from-[#007AFF] to-[#B026FF] transition-opacity duration-[1500ms] ${step >= 5 ? 'opacity-100' : 'opacity-0'}`}
                                aria-hidden="true"
                            >
                                '리치한 데이터(Rich Data)'
                            </span>
                        </span>
                        <span className="text-[#1d1d1f]">에서</span>
                    </p>
                </div>
                
                {/* 4. Hero Stack 3 */}
                <div className="overflow-hidden pb-1 md:pb-2">
                    <p className={`text-[40px] sm:text-[60px] md:text-[80px] lg:text-[100px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-[1.05] transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 4 ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}>
                        나옵니다.
                    </p>
                </div>

            </div>
        </section>
    );
}
