import React, { useState, useEffect } from 'react';

export default function Section3({ isActive }) {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }
        
        // 5페이지 스타일의 단단한 슬라이드업(템포 조절 적용 - 전체적으로 조금 더 빠르게)
        const t1 = setTimeout(() => setStep(1), 300);  // 1. AI의 진짜...
        const t2 = setTimeout(() => setStep(2), 1000); // 2. 내 PC 안의...
        
        // (살짝 쉬는 공백 - 호흡을 가다듬는 시간)
        const t3 = setTimeout(() => setStep(3), 2000); // 3. AI를 천재로...
        const t4 = setTimeout(() => setStep(4), 2800); // 4. 다름 아닌...
        const t5 = setTimeout(() => setStep(5), 3600); // 5. 밑줄 애니메이션 그리기 

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white flex flex-col items-center justify-center relative px-6 md:px-12 overflow-y-auto">
            
            {/* 2페이지와 동일하게 좌측 상단 정렬 및 가장 타이트한 기준 유지 */}
            <div className="w-full max-w-[1000px] flex flex-col items-start justify-center text-left font-sans tracking-tight relative z-10 -translate-y-[40px] md:-translate-y-[50px] gap-0 pt-24 pb-32">
                
                {/* 1. Line 1 (Hero Anchor) */}
                <div className="overflow-hidden">
                    <p 
                        className={`text-[37px] md:text-[51px] font-bold text-[#242424] tracking-tight leading-[1.13] whitespace-nowrap transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}
                    >
                        <span className="text-black">AI</span>의 진짜 위력은
                    </p>
                </div>

                {/* 2. Line 2 (스르륵 올라오는 마스킹 Wipe 연출 적용) */}
                <div className="overflow-hidden mt-1 md:mt-2">
                    <p 
                        className={`text-[37px] md:text-[51px] font-bold text-[#242424] tracking-tight leading-[1.13] whitespace-nowrap transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}
                    >
                        내 PC 안의 <span className="text-black">'리치한 데이터(Rich Data)'</span>에서 나옵니다.
                    </p>
                </div>

                {/* 3. Line 3 (더블 마진 배치 후 스르륵 상승) */}
                <div className="overflow-hidden mt-10 md:mt-16">
                    <p 
                        className={`text-[37px] md:text-[51px] font-bold text-[#242424] tracking-tight leading-[1.13] whitespace-nowrap transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 3 ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}
                    >
                        <span className="text-black">AI</span>를 <span className="text-black">천재</span>로 만드는 것은
                    </p>
                </div>

                {/* 4. Line 4 (Wipe 연출 + 밑줄 애니메이션용 pb 풀확보) */}
                <div className="overflow-hidden mt-1 md:mt-2">
                    {/* 클리핑 방지 위한 pb-4 유지하면서 p 태그 자체가 올라옴 */}
                    <p 
                        className={`relative text-[37px] md:text-[51px] font-bold text-[#242424] tracking-tight leading-[1.13] whitespace-nowrap pb-4 z-10 transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 4 ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}
                    >
                        다름 아닌 내 PC 안의{' '}
                        <span className="relative inline-block pb-[1px] text-black">
                            '풍부한 실무 데이터'
                            {/* 밑줄 렌더링 5스텝 분기 */}
                            <span 
                                className={`absolute bottom-[2px] left-0 h-[2px] md:h-[3px] bg-black -z-10 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${step >= 5 ? 'w-full opacity-100' : 'w-0 opacity-0'}`}
                            ></span>
                        </span>
                        입니다.
                    </p>
                </div>

            </div>
        </section>
    );
}
