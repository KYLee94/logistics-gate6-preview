import React, { useState, useEffect } from 'react';

export default function Section1() {
    const [expandedIndices, setExpandedIndices] = useState([]);

    useEffect(() => {
        const count = 5;
        const timeouts = [];
        for (let idx = 0; idx < count; idx++) {
            timeouts.push(
                setTimeout(() => {
                    setExpandedIndices(prev => [...prev, idx]);
                }, 2000 + idx * 400) // Start at 2000ms, each following 400ms later
            );
        }
        return () => timeouts.forEach(clearTimeout);
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
                        fontFamily: "'Sanomat web light', 'Sanomat Web Regular', 'Sanomat', sans-serif",
                        fontSize: "clamp(2.75rem, 6vw, 4.75rem)",
                        fontWeight: 200,
                        letterSpacing: "0.05em"
                    }}
                >
                    {words.map((item, idx) => {
                        const isExpanded = expandedIndices.includes(idx);
                        return (
                            <div key={idx} className="flex items-baseline">
                                <span>{item.i}</span>
                                <div 
                                    className={`overflow-hidden transition-all duration-[1000ms] ease-out flex ${isExpanded ? 'max-w-[400px] opacity-100' : 'max-w-0 opacity-0'}`}
                                >
                                    <span className="whitespace-pre">{item.text}</span>
                                </div>
                            </div>
                        );
                    })}
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
