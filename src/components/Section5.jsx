import React, { useState, useEffect } from 'react';

export default function Section5({ isActive }) {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }
        
        // 0.8s 간격 (800ms)
        const t1 = setTimeout(() => setStep(1), 500);
        const t2 = setTimeout(() => setStep(2), 1300);
        const t3 = setTimeout(() => setStep(3), 2100);
        const t4 = setTimeout(() => setStep(4), 2900);
        const t5 = setTimeout(() => setStep(5), 3700);
        const t6 = setTimeout(() => setStep(6), 4600); // 6. Trigger global shift and AI=DATA

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); clearTimeout(t6); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white overflow-y-auto relative px-4">
            <div className="w-full min-h-full max-w-[1400px] mx-auto flex flex-col items-center justify-center py-24 md:py-32 relative">
                <div 
                    className={`w-full max-w-[1000px] text-[24px] sm:text-[32px] md:text-[40px] xl:text-[46px] flex flex-col items-start text-[#999] font-sans tracking-tight leading-[1.32] gap-[29px] md:gap-[37px] relative break-keep -translate-y-[40px] md:-translate-y-[50px] transition-transform duration-[1400ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 6 ? '-translate-x-[50px] md:-translate-x-[150px] lg:-translate-x-[200px]' : 'translate-x-0'}`}
                    style={{ fontWeight: 700 }}
                >
                    {/* Block 1 */}
                    <div className={`transition-all duration-[600ms] ease-out ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        AI의 진짜 위력은 내 PC 안의<br />
                        <span className="text-black">'리치한 데이터(Rich Data)'</span>에서 나옵니다.
                    </div>

                    {/* Block 2 */}
                    <div className={`transition-all duration-[600ms] ease-out ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="text-black">IGIS도 마찬가지입니다.</span>
                    </div>

                    {/* Block 3 */}
                    <div className={`transition-all duration-[600ms] ease-out ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        거창한 AI 교육은 필요 없습니다.<br />
                        직원들은 지금처럼 <span className="text-black">검색창에 필요한 질문만</span><br />
                        던지면 되니까요.
                    </div>

                    {/* Block 4 */}
                    <div className={`transition-all duration-[600ms] ease-out ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        하지만 그 가벼운 질문에, AI가 얼마나<br />
                        <span className="text-black">깊고 날카로운 정답</span>을 내놓을 수 있는가.
                    </div>

                    {/* Block 5 */}
                    <div className={`transition-all duration-[600ms] ease-out ${step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        그것은 오직, 이지스 내부에 쌓여 흐르는<br />
                        <span className="text-black">'데이터의 깊이'</span>에 달려있습니다.
                    </div>
                </div>

                {/* 6. AI = Data Hero Text (Right Side Overlay) */}
                <div 
                    className={`absolute right-0 md:right-[2%] xl:right-[4%] text-[#1d1d1f] flex items-center justify-center antialiased text-[80px] md:text-[110px] lg:text-[130px] transition-all duration-[2500ms] delay-[300ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 6 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-[40px] scale-95'} hidden sm:flex`}
                    style={{ 
                        fontFamily: "'Sanomat Wp', 'Sanomat Web', 'Sanomat', sans-serif",
                        fontWeight: 300, 
                        letterSpacing: "-0.01em",
                        WebkitFontSmoothing: "antialiased",
                        MozOsxFontSmoothing: "grayscale",
                        textRendering: "optimizeLegibility" 
                    }}
                >
                    AI = Data
                </div>
            </div>
        </section>
    );
}
