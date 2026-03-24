import React, { useState, useEffect } from 'react';

export default function Section3({ isActive }) {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }
        
        // 0.4s 간격 (400ms)
        const t1 = setTimeout(() => setStep(1), 400);

        return () => { clearTimeout(t1); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white overflow-y-auto relative px-4">
            <div className="w-full min-h-full flex flex-col items-center justify-center py-24 md:py-32">
                <div 
                    className="w-full max-w-[1000px] text-[24px] sm:text-[32px] md:text-[40px] xl:text-[46px] flex flex-col items-start text-[#999] font-sans tracking-tight leading-snug gap-6 md:gap-8 relative break-keep"
                    style={{ fontWeight: 700 }}
                >
                    {/* Block 1 */}
                    <div className={`transition-all duration-[600ms] ease-out ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        AI의 진짜 위력은<br />
                        내 PC 안의 <span className="text-black">'리치한 데이터(Rich Data)'</span>에서 나옵니다.
                    </div>
                </div>
            </div>
        </section>
    );
}
