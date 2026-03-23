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
        const t2 = setTimeout(() => setStep(2), 800);
        const t3 = setTimeout(() => setStep(3), 1200);
        const t4 = setTimeout(() => setStep(4), 1600);
        const t5 = setTimeout(() => setStep(5), 2000);

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white flex flex-col items-center justify-center relative px-4">
            <div 
                className="text-[40px] md:text-[46px] flex flex-col items-start justify-center text-[#999] font-sans tracking-tight leading-snug gap-8 relative"
                style={{ fontWeight: 700 }}
            >
                {/* Block 1 */}
                <div className={`transition-all duration-[600ms] ease-out ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    AI의 진짜 위력은<br />
                    내 PC 안의 <span className="text-black">'리치한 데이터(Rich Data)'</span>에서 나옵니다.
                </div>

                {/* Block 2 */}
                <div className={`transition-all duration-[600ms] ease-out ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    <span className="text-black">IGIS도 마찬가지입니다.</span>
                </div>

                {/* Block 3 */}
                <div className={`transition-all duration-[600ms] ease-out ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    직원들을 위한 거창한 AI 교육은 필요 없습니다.<br />
                    지금처럼 <span className="text-black">검색창에 필요한 질문</span>만 던지면 되니까요.
                </div>

                {/* Block 4 */}
                <div className={`transition-all duration-[600ms] ease-out ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    하지만 그 가벼운 질문에,<br />
                    AI가 얼마나 <span className="text-black">깊고 날카로운 정답</span>을 내놓을 수 있는가.
                </div>

                {/* Block 5 */}
                <div className={`transition-all duration-[600ms] ease-out ${step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    그것은 오직,<br />
                    이지스 내부에 흐르는 <span className="text-black">'데이터의 깊이'</span>에 달려있습니다.
                </div>
            </div>
        </section>
    );
}
