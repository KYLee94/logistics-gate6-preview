import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Section18({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (isActive) {
            const t1 = setTimeout(() => setStep(1), 300);
            return () => clearTimeout(t1);
        } else {
            setStep(0);
        }
    }, [isActive]);

    return (
        <section className="relative w-full h-full bg-white flex flex-col justify-center items-center overflow-hidden font-sans">
            <div className={`relative z-20 flex flex-col items-center text-center transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] transform ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                
                <h2 className="text-[40px] md:text-[60px] lg:text-[80px] font-bold text-black tracking-tighter leading-none mb-4 md:mb-6">
                    Execution Plan
                </h2>
                
                <p className="text-[18px] md:text-[24px] font-medium text-gray-500 tracking-tight">
                    {lang === 'kr' ? (
                        <>업데이트 준비 중입니다.</>
                    ) : (
                        <>System update in progress...</>
                    )}
                </p>

            </div>
        </section>
    );
}
