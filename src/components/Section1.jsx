import React, { useState, useEffect } from 'react';

export default function Section1() {
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setExpanded(true);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    const words = [
        { i: 'I', text: 'GIS\u00A0' },
        { i: 'F', text: 'und\u00A0' },
        { i: 'P', text: 'roduction\u00A0' },
        { i: 'D', text: 'ata\u00A0' },
        { i: 'P', text: 'latform' }
    ];

    return (
        <section className="section min-h-screen bg-black flex flex-col items-center justify-center relative">
            <div className="logo-fade w-full flex justify-center pb-20">
                <div 
                    className="flex text-white"
                    style={{ 
                        fontFamily: "'Sanomat Web Regular', 'Sanomat', sans-serif",
                        fontSize: "clamp(1.5rem, 4vw, 3.5rem)",
                        fontWeight: 400,
                        letterSpacing: "0.05em"
                    }}
                >
                    {words.map((item, idx) => (
                        <div key={idx} className="flex items-baseline">
                            <span>{item.i}</span>
                            <div 
                                className={`overflow-hidden transition-all duration-[3000ms] ease-out flex ${expanded ? 'max-w-[400px] opacity-100' : 'max-w-0 opacity-0'}`}
                            >
                                <span className="whitespace-pre">{item.text}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div id="scroll-arrow"
                className="absolute bottom-12 left-1/2 transform -translate-x-1/2 opacity-0 transition-opacity duration-1000">
                <svg className="w-8 h-8 text-white animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                </svg>
            </div>
        </section>
    );
}
