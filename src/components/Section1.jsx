import React, { useState, useEffect } from 'react';

export default function Section1({ isActive }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (!isActive) {
            setMounted(false);
            return;
        }
        
        const timer = setTimeout(() => {
            setMounted(true);
        }, 100); // 0.1초 후 바로 통통 튀어오르게
        return () => clearTimeout(timer);
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white flex flex-col items-center justify-center relative">
            <div className="logo-fade w-full flex justify-center pb-20">
                <div 
                    className={`flex text-black text-center px-4 antialiased transition-all duration-[800ms] ${mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-16 scale-95'}`}
                    style={{ 
                        fontFamily: "'Sanomat Wp', 'Sanomat Web', 'Sanomat', sans-serif",
                        fontSize: "60px",
                        fontWeight: 500, 
                        letterSpacing: "-0.01em",
                        WebkitFontSmoothing: "antialiased",
                        MozOsxFontSmoothing: "grayscale",
                        textRendering: "optimizeLegibility",
                        transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" // 밑에서 뽕 뜨는 바운스 효과
                    }}
                >
                    IGIS Fund Production Data Platform
                </div>
            </div>
        </section>
    );
}
