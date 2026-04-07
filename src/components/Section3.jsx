import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Section3({ isActive }) {
    const { lang } = useLanguage();
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
        const t6 = setTimeout(() => setStep(6), 4800); // 6. 엔터프라이즈 스케일 브릿지 텍스트 

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); clearTimeout(t6); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white flex flex-col relative px-6 md:px-12 overflow-y-auto">
            
            {/* 2페이지와 동일하게 좌측 상단 정렬 및 가장 타이트한 기준 유지 */}
            <div className="w-full max-w-[1000px] mx-auto flex flex-col items-center justify-center text-center font-sans tracking-tight relative z-10 my-auto shrink-0 -translate-y-[40px] md:-translate-y-[50px] gap-0 pt-24 pb-32">
                
                {/* 1. Line 1 (Hero Anchor) */}
                <div className="overflow-hidden">
                    <p 
                        className={`text-[33px] md:text-[47px] font-bold text-[#242424] tracking-tight leading-[1.13] whitespace-nowrap transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}
                    >
                        <span className="text-black">AI</span>{lang === 'kr' ? "의 진짜 위력은" : "'s true absolute power"}
                    </p>
                </div>

                {/* 2. Line 2 (스르륵 올라오는 마스킹 Wipe 연출 적용) */}
                <div className="overflow-hidden mt-1 md:mt-2">
                    <p 
                        className={`text-[33px] md:text-[47px] font-bold text-[#242424] tracking-tight leading-[1.13] whitespace-nowrap transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}
                    >
                        {lang === 'kr' ? "내 PC 안의 " : "emerges from the "}
                        <span className="text-black">{lang === 'kr' ? "'리치한 데이터(Rich Data)'" : "'Rich Data'"}</span>
                        {lang === 'kr' ? "에서 나옵니다." : " within our PCs."}
                    </p>
                </div>

                {/* 3. Line 3 (더블 마진 배치 후 스르륵 상승) */}
                <div className="overflow-hidden mt-10 md:mt-16">
                    <p 
                        className={`text-[33px] md:text-[47px] font-bold text-[#242424] tracking-tight leading-[1.13] whitespace-nowrap transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 3 ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}
                    >
                        {lang === 'kr' ? "" : "What turns "}
                        <span className="text-black">AI</span>
                        {lang === 'kr' ? "를 " : " into a "}
                        <span className="bg-gradient-to-r from-[#297cf6] to-[#0448d3] text-transparent bg-clip-text font-bold">{lang === 'kr' ? "천재" : "genius"}</span>
                        {lang === 'kr' ? "로 만드는 것은" : ""}
                    </p>
                </div>

                {/* 4. Line 4 (Wipe 연출 + 밑줄 애니메이션용 pb 풀확보) */}
                <div className="overflow-hidden mt-1 md:mt-2">
                    {/* 클리핑 방지 위한 pb-4 유지하면서 p 태그 자체가 올라옴 */}
                    <p 
                        className={`relative text-[33px] md:text-[47px] font-bold text-[#242424] tracking-tight leading-[1.13] whitespace-nowrap pb-4 z-10 transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 4 ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}
                    >
                        {lang === 'kr' ? "다름 아닌 내 PC 안의 " : "is none other than our internal "}
                        <span className="relative inline-block pb-[1px]">
                            <span className="bg-gradient-to-r from-[#297cf6] to-[#0448d3] text-transparent bg-clip-text font-bold">
                                {lang === 'kr' ? "'풍부한 실무 데이터'" : "'Rich Production Data'"}
                            </span>
                            {/* 밑줄 렌더링 5스텝 분기 */}
                            <span 
                                className={`absolute bottom-[2px] left-0 h-[2px] md:h-[3px] bg-gradient-to-r from-[#297cf6] to-[#0448d3] -z-10 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${step >= 5 ? 'w-full opacity-100' : 'w-0 opacity-0'}`}
                            ></span>
                        </span>
                        {lang === 'kr' ? "입니다." : "."}
                    </p>
                </div>

                {/* 5. Line 5: Narrative Bridge 1 */}
                <div className="overflow-hidden mt-12 md:mt-20">
                    <p 
                        className={`text-[33px] md:text-[47px] font-bold text-[#242424] tracking-tight leading-[1.13] whitespace-nowrap transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 6 ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}
                    >
                        {lang === 'kr' ? "이 풍부한 데이터가 " : "When this rich data is connected at the "}
                        <span className="bg-gradient-to-r from-[#297cf6] to-[#0448d3] text-transparent bg-clip-text font-bold">{lang === 'kr' ? "전사(Enterprise)" : "Enterprise"}</span>
                        {lang === 'kr' ? " 단위로 연결될 때," : " level,"}
                    </p>
                </div>
                
                {/* 6. Line 6: Narrative Bridge 2 */}
                <div className="overflow-hidden mt-1 md:mt-2">
                    <p 
                        className={`text-[33px] md:text-[47px] font-bold text-[#242424] tracking-tight leading-[1.13] whitespace-nowrap transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] delay-[150ms] ${step >= 6 ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}
                    >
                        <span className="text-black">AI</span>
                        {lang === 'kr' ? "는 어떤 폭발적인 결과물을 만들어낼까요?" : " what explosive results will it produce?"}
                    </p>
                </div>

            </div>
        </section>
    );
}
