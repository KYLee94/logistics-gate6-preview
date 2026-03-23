import React from 'react';

export default function Section1() {
    return (
        <section className="section min-h-screen bg-white flex flex-col items-center justify-center relative">
            <div className="logo-fade w-full flex justify-center pb-20">
                <div 
                    className="flex text-black text-center px-4"
                    style={{ 
                        fontFamily: "'Sanomat web light', 'Sanomat Web Regular', 'Sanomat', sans-serif",
                        fontSize: "clamp(2rem, 5vw, 4rem)",
                        fontWeight: 100, // Very light
                        letterSpacing: "0.05em"
                    }}
                >
                    IGIS Fund Production Data Platform
                </div>
            </div>
            <div id="scroll-arrow"
                className="absolute bottom-12 left-1/2 transform -translate-x-1/2 opacity-0 transition-opacity duration-1000">
                <svg className="w-8 h-8 text-black animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                </svg>
            </div>
        </section>
    );
}
