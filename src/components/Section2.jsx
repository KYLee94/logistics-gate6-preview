import React, { useState, useEffect } from 'react';
import openclawImg from '../assets/openclaw.jpg';

export default function Section2({ isActive }) {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }
        
        // 1. 가운데 텍스트 등장 (0.5s)
        const t1 = setTimeout(() => setStep(1), 500);
        // 2. 그 위 텍스트 + 이미지 등장 (1.3s)
        const t2 = setTimeout(() => setStep(2), 1300);
        // 3. 그 아래 텍스트 등장 (2.1s)
        const t3 = setTimeout(() => setStep(3), 2100);

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white overflow-y-auto relative px-4">
            <div className="w-full min-h-full flex flex-col items-center justify-center py-24 md:py-32">
                <div 
                    className="w-full max-w-[1000px] text-[28px] sm:text-[36px] md:text-[50px] flex flex-col items-start text-black font-sans tracking-tight leading-tight gap-2 md:gap-1 relative break-keep"
                    style={{ fontWeight: 400 }}
                >
                    {/* 2. Top Image (openclaw.jpg) - 텍스트(Top)와 동시에 등장 */}
                    <div className="absolute -top-[80px] md:-top-[100px] left-0 w-full h-[80px] md:h-[100px] flex items-end z-0 mix-blend-multiply pointer-events-none">
                        <img 
                            src={openclawImg} 
                            alt="OpenClaw Logo" 
                            className={`w-auto h-full object-contain object-left transition-all duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${step >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`} 
                        />
                    </div>

                    {/* 2. Top */}
                    <div className={`transition-all duration-500 ease-out relative z-10 ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        OpenClaw를 쓰고계신
                    </div>

                    {/* 1. Middle */}
                    <div className={`font-bold transition-all duration-500 ease-out relative z-10 ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        대표님은 알고계실 것입니다.
                    </div>

                    {/* 3. Bottom */}
                    <div className={`transition-all duration-500 ease-out relative z-10 ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        내 PC에 들어와 모든걸 할 수 있는 AI의 위력을.
                    </div>
                </div>
            </div>
        </section>
    );
}
