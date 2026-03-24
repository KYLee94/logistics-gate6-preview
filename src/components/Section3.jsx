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
        const t4 = setTimeout(() => setStep(4), 1200);

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-[#fbfbfd] flex flex-col items-center justify-center relative px-6 md:px-12 overflow-y-auto">
            
            <div className="w-full max-w-[1000px] flex flex-col items-start justify-center text-left font-sans tracking-tight relative z-10 -translate-y-[40px] md:-translate-y-[50px] gap-0 pt-24 pb-32">
                
                {/* 1. Line 1 (Stanza 1) */}
                <div 
                    className={`transition-all duration-[1200ms] ease-out ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                >
                    <p className="text-[37px] md:text-[51px] font-bold text-[#242424] tracking-tight leading-[1.15] break-keep">
                        <span className="text-black">AI</span>의 진짜 위력은
                    </p>
                </div>

                {/* 2. Line 2 (Stanza 1) - 줄바꿈 (줄간격 + 2px 효과를 위해 mt 미세 추가) */}
                <div 
                    className={`transition-all duration-[1200ms] ease-out mt-1 md:mt-2 ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                >
                    <p className="text-[37px] md:text-[51px] font-bold text-[#242424] tracking-tight leading-[1.15] whitespace-normal break-keep">
                        내 PC 안의 <span className="text-black">'리치한 데이터(Rich Data)'</span>에서 나옵니다.
                    </p>
                </div>

                {/* 3. Line 3 (Stanza 2) - 줄바꿈 두 번 (더블 마진) */}
                <div 
                    className={`transition-all duration-[1200ms] ease-out mt-10 md:mt-16 ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                >
                    <p className="text-[37px] md:text-[51px] font-bold text-[#242424] tracking-tight leading-[1.15] break-keep">
                        <span className="text-black">AI</span>를 <span className="text-black">천재</span>로 만드는 것은
                    </p>
                </div>

                {/* 4. Line 4 (Stanza 2) - 줄바꿈 */}
                <div 
                    className={`transition-all duration-[1200ms] ease-out mt-1 md:mt-2 ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                >
                    <p className="text-[37px] md:text-[51px] font-bold text-[#242424] tracking-tight leading-[1.15] whitespace-normal break-keep">
                        다름 아닌 내 PC 안의 <span className="text-black">'풍부한 실무 데이터'</span>입니다.
                    </p>
                </div>

            </div>
        </section>
    );
}
