import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Section17({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);
    const [isZooming, setIsZooming] = useState(false);

    useEffect(() => {
        if (isActive) {
            const t1 = setTimeout(() => setStep(1), 200);   // Image container
            const t2 = setTimeout(() => setStep(2), 700);   // Text Overlay
            const t3 = setTimeout(() => setStep(3), 1100);  // Button
            return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
        } else {
            setStep(0);
            setIsZooming(false);
        }
    }, [isActive]);

    return (
        <section className="relative w-full h-full bg-white flex flex-col justify-center items-center overflow-hidden font-sans">
            
            <div className="w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1600px] mx-auto relative flex flex-col justify-center items-center h-full pt-[60px] md:pt-0">
                
                {/* Image constrained by viewport height instead of wrapper width */}
                <div className={`relative flex flex-col justify-center items-center overflow-hidden transition-all duration-[1600ms] ${isZooming ? 'ease-[cubic-bezier(0.7,0,0.1,1)]' : 'ease-[cubic-bezier(0.16,1,0.3,1)]'} transform ${isZooming ? 'scale-[20] origin-[50%_35%]' : (step >= 1 ? 'opacity-100 scale-100 origin-center' : 'opacity-0 scale-[0.98] origin-center')}`}>
                    <img 
                        src={`${import.meta.env.BASE_URL}inside_IFPDP.jpg`} 
                        alt="Inside IFPDP Monitor Graphic" 
                        className="h-[84vh] w-auto object-contain block mx-auto"
                    />
                    
                    {/* Text Centered directly over the black monitor screen inside the aesthetic asset */}
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center pb-[18vh]">
                        
                        {/* Title */}
                        <h2 className={`text-[46px] md:text-[60px] lg:text-[84px] font-bold text-white tracking-tighter leading-none mb-3 md:mb-5 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${isZooming ? 'opacity-0 scale-[1.5] blur-md' : (step >= 2 ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-6 blur-[6px]')}`}>
                            Inside IFPDP
                        </h2>

                        {/* Subtitle */}
                        <p className={`text-[16px] md:text-[20px] lg:text-[24px] text-gray-300 font-medium tracking-tight mb-8 md:mb-12 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] delay-[100ms] transform ${isZooming ? 'opacity-0 scale-[1.5] blur-md' : (step >= 2 ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-6 blur-[6px]')}`}>
                            {lang === 'kr' ? "이제 본 AI 플랫폼의 주요 기능을 직접 체험해 보십시오." : "Experience the core features of the AI platform firsthand."}
                        </p>

                        {/* Stylish Button */}
                        <button 
                            className={`group cursor-pointer relative overflow-hidden rounded-full bg-white text-black px-10 py-3 md:px-14 md:py-4 flex items-center justify-center transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${isZooming ? 'opacity-0 translate-y-8 blur-md' : (step >= 3 ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-6 blur-[6px]')}`}
                            onClick={() => setIsZooming(true)}
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

            {/* Immersive System Integration Overlay (Fades in after zooming into the black screen) */}
            <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-black transition-all duration-[1200ms] ease-out ${isZooming ? 'opacity-100 delay-[1200ms] pointer-events-auto' : 'opacity-0 delay-0 pointer-events-none'}`}>
                <div className={`flex flex-col items-center transition-all duration-[1000ms] ease-out delay-[1500ms] transform ${isZooming ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                    <h3 className="text-[24px] md:text-[34px] font-medium text-white tracking-[-0.03em] mb-10 text-center leading-tight">
                        System Master Planning in progress.
                        <br/>
                        <span className="text-[#888] text-[18px] md:text-[22px] font-normal mt-3 block">
                            Please check back later.
                        </span>
                    </h3>
                    <button 
                        onClick={() => setIsZooming(false)}
                        className="px-8 py-3 rounded-full border border-gray-600 text-gray-300 hover:text-white hover:border-white transition-all cursor-pointer font-medium text-[15px] tracking-tight"
                    >
                        Go Back
                    </button>
                </div>
            </div>

        </section>
    );
}
