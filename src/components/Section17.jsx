import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Section17({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (isActive) {
            const t1 = setTimeout(() => setStep(1), 300);
            const t2 = setTimeout(() => setStep(2), 1000);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        } else {
            setStep(0);
        }
    }, [isActive]);

    return (
        <section className="relative w-full h-full bg-black flex flex-col justify-center items-center overflow-hidden font-sans">
            
            {/* Background Image with Dark Overlay */}
            <div className={`absolute inset-0 w-full h-full transition-transform duration-[3000ms] ease-out ${step >= 1 ? 'scale-100' : 'scale-110'}`}>
                <img 
                    src={`${import.meta.env.BASE_URL}inside_IFPDP.jpg`} 
                    alt="Inside IFPDP Background" 
                    className="w-full h-full object-cover"
                />
            </div>
            <div className="absolute inset-0 bg-black/50 z-10"></div>

            {/* Content Container */}
            <div className="relative z-20 flex flex-col items-center text-center px-6">
                
                {/* Title */}
                <h2 className={`text-[60px] md:text-[80px] lg:text-[100px] font-bold text-white tracking-tighter leading-none mb-10 transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                    Inside IFPDP
                </h2>

                {/* Stylish Button */}
                <button 
                    className={`group relative overflow-hidden rounded-full bg-white text-black px-12 py-4 md:px-16 md:py-5 flex items-center justify-center transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                    onClick={() => {
                        // Action for entering IFPDP (placeholder for now, can trigger alert or navigation)
                        alert("Preparing IFPDP System Access...");
                    }}
                >
                    <span className="relative z-10 text-[16px] md:text-[18px] font-bold tracking-[-0.02em] whitespace-nowrap">
                        Go Inside
                    </span>
                    <div className="relative z-10 ml-3 md:ml-4 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1">
                        <svg className="w-3 h-3" fill="none" strokeWidth="2.5" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </button>

            </div>
        </section>
    );
}
