import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Section17({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (isActive) {
            const t1 = setTimeout(() => setStep(1), 200);   // Image container
            const t2 = setTimeout(() => setStep(2), 700);   // Text Overlay
            const t3 = setTimeout(() => setStep(3), 1100);  // Button
            return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
        } else {
            setStep(0);
        }
    }, [isActive]);

    return (
        <section className="relative w-full h-full bg-white flex flex-col justify-center items-center overflow-hidden font-sans">
            
            <div className="w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1600px] mx-auto relative flex flex-col justify-center items-center h-full pt-[60px] md:pt-0">
                
                {/* Image constrained by viewport height instead of wrapper width */}
                <div className={`relative flex flex-col justify-center items-center overflow-hidden transition-all duration-[1500ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${step >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'}`}>
                    <img 
                        src={`${import.meta.env.BASE_URL}inside_IFPDP.jpg`} 
                        alt="Inside IFPDP Monitor Graphic" 
                        className="h-[84vh] w-auto object-contain block mx-auto"
                    />
                    
                    {/* Text Centered directly over the black monitor screen inside the aesthetic asset */}
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center pb-[18vh]">
                        
                        {/* Title */}
                        <h2 className={`text-[46px] md:text-[60px] lg:text-[84px] font-bold text-white tracking-tighter leading-none mb-6 md:mb-10 transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                            Inside IFPDP
                        </h2>

                        {/* Stylish Button */}
                        <button 
                            className={`group relative overflow-hidden rounded-full bg-white text-black px-10 py-3 md:px-14 md:py-4 flex items-center justify-center transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                            onClick={() => {
                                alert("System integration in progress. Please check back later.");
                            }}
                        >
                            <span className="relative z-10 text-[15px] md:text-[17px] font-bold tracking-tight whitespace-nowrap">
                                Go Inside
                            </span>
                            <div className="relative z-10 ml-3 md:ml-4 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1">
                                <svg className="w-3.5 h-3.5" fill="none" strokeWidth="2.5" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7l7 7-7 7" />
                                </svg>
                            </div>
                        </button>
                    </div>

                </div>
            </div>
        </section>
    );
}
