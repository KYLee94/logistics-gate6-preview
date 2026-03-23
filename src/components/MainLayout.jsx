import React, { useState, useEffect } from 'react';
import Section1 from './Section1';
import Section2 from './Section2';
import Section3 from './Section3';

export default function MainLayout() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const slides = [<Section1 />, <Section2 />, <Section3 />];

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.key === 'PageDown') {
                setCurrentSlide(prev => Math.min(prev + 1, slides.length - 1));
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                setCurrentSlide(prev => Math.max(prev - 1, 0));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [slides.length]);

    return (
        <div className="w-full h-screen overflow-hidden relative bg-white">
            {slides.map((slide, index) => {
                const isActive = index === currentSlide;
                
                let transformStyle = '';
                if (index < currentSlide) {
                    transformStyle = 'translateX(-100%)';
                } else if (index > currentSlide) {
                    transformStyle = 'translateX(100%)';
                } else {
                    transformStyle = 'translateX(0)';
                }

                return (
                    <div 
                        key={index} 
                        className="absolute inset-0 w-full h-full transition-transform duration-[250ms]"
                        style={{ 
                            transform: transformStyle,
                            transitionTimingFunction: "cubic-bezier(0.83, 0, 0.17, 1)" // Fast, crisp book-like slide
                        }}
                    >
                        {React.cloneElement(slide, { isActive })}
                    </div>
                );
            })}

            {/* Global Keyboard Navigation Hint */}
            <div className="fixed bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-12 text-gray-400 z-[9999] pointer-events-none mix-blend-difference">
                <div className={`flex flex-col items-center gap-2 transition-opacity duration-300 ${currentSlide === 0 ? 'opacity-20' : 'opacity-100'}`}>
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                    </svg>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-white">Left</span>
                </div>
                <div className={`w-[1px] h-[30px] bg-white/20`} />
                <div className={`flex flex-col items-center gap-2 transition-opacity duration-300 ${currentSlide === slides.length - 1 ? 'opacity-20' : 'opacity-100'}`}>
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-white">Right</span>
                </div>
            </div>
        </div>
    );
}
