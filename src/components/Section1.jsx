import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Section1({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }
        
        // Staggered cinematic sequence mapping Apple-tier motion aesthetics
        const t1 = setTimeout(() => setStep(1), 150);
        const t2 = setTimeout(() => setStep(2), 650); 
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white flex flex-col relative overflow-y-auto">
            <div className="logo-fade w-full flex flex-col items-center justify-center -translate-y-8 my-auto py-12">
                
                {/* Main Title - Epic focal resolve effect */}
                <div 
                    className={`flex text-[#1d1d1f] text-center px-4 leading-tight text-[50px] md:text-[70px] lg:text-[80px] xl:text-[90px] font-bold transition-all duration-[1800ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${step >= 1 ? 'opacity-100 translate-y-0 scale-100 blur-0' : 'opacity-0 translate-y-12 scale-[0.98] blur-[12px]'}`}
                    style={{ 
                        fontFamily: "'Sanomat', 'Sanomat Wp', sans-serif",
                        letterSpacing: "-0.03em",
                        WebkitFontSmoothing: "antialiased",
                        MozOsxFontSmoothing: "grayscale",
                        textRendering: "optimizeLegibility",
                    }}
                >
                    IGIS Fund Production<br className="md:hidden block" /> Data Platform
                </div>

                {/* Subtitle - Gentle delayed cascade */}
                <div 
                    className={`mt-4 md:mt-6 text-[#86868b] text-[18px] md:text-[24px] lg:text-[28px] font-medium tracking-tight px-4 transition-all duration-[1800ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${step >= 2 ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-8 blur-[8px]'}`}
                    style={{ fontFamily: "'Sanomat', 'Apple SD Gothic Neo', '애플 SD 산돌고딕 Neo', sans-serif" }}
                >
                    {lang === 'kr' ? "ONE IGIS + CFT 전략의 완벽한 실체화 For AI ERA" : "The Ultimate Realization of ONE IGIS + CFT Strategy for the AI Era"}
                </div>

            </div>
        </section>
    );
}
