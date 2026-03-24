import React, { useState, useEffect } from 'react';

export default function Section3({ isActive }) {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }
        
        // Blackstone Style: Simple staggered, elegant fade ups from below
        const t1 = setTimeout(() => setStep(1), 300);
        const t2 = setTimeout(() => setStep(2), 600);
        const t3 = setTimeout(() => setStep(3), 900);

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-[#fbfbfd] flex flex-col items-center justify-center relative px-6 md:px-12 overflow-y-auto">
            
            <div className="w-full max-w-[1000px] flex flex-col items-start justify-center text-left font-sans tracking-tight relative z-10 -translate-y-[40px] md:-translate-y-[50px] gap-6 md:gap-8 pt-24 pb-32">
                
                {/* 1. Line 1 */}
                <div 
                    className={`transition-all duration-[1200ms] ease-out ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                >
                    <p className="text-[28px] md:text-[40px] xl:text-[46px] font-medium text-[#242424] leading-[1.3] break-keep">
                        <span className="font-bold text-black">AI</span>의 진짜 위력은
                    </p>
                </div>

                {/* 2. Line 2 (줄바꿈 없이 최대한 유지) */}
                <div 
                    className={`transition-all duration-[1200ms] ease-out ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                >
                    <p className="text-[28px] md:text-[40px] xl:text-[46px] font-medium text-[#242424] leading-[1.3] whitespace-normal md:whitespace-nowrap break-keep">
                        내 PC 안의 <span className="font-bold text-black">'리치한 데이터(Rich Data)'</span>에서 나옵니다.
                    </p>
                </div>

                {/* 3. Line 3 */}
                <div 
                    className={`transition-all duration-[1200ms] ease-out mt-8 md:mt-12 ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                >
                    <p className="text-[24px] md:text-[36px] xl:text-[42px] font-medium text-[#242424] leading-[1.4] break-keep">
                        <span className="font-bold text-black">AI</span>를 <span className="font-bold text-black">천재</span>로 만드는 것은,<br className="hidden md:block" />
                        다름 아닌 내 PC 안의 <span className="font-bold text-black">'풍부한 실무 데이터'</span>입니다.
                    </p>
                </div>

            </div>
        </section>
    );
}
