import React, { useState, useEffect } from 'react';
import openclawImg from '../assets/openclaw.jpg';

export default function Section2({ isActive }) {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }
        
        // Cinematic Sequencing
        const t1 = setTimeout(() => setStep(1), 500);  // "대표님은 알고계실 것입니다." 크게 뜸
        const t2 = setTimeout(() => setStep(2), 2200); // 텍스트 작아지며 위에 OpenClaw 등장
        const t3 = setTimeout(() => setStep(3), 3200); // 밑에 텍스트 등장

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-[#fbfbfd] overflow-hidden relative px-4">
            <div className="w-full min-h-full flex flex-col items-center justify-center">
                
                {/* 절대 위치 및 센터 기준점 역할을 하는 래퍼 */}
                <div className="relative flex flex-col items-center justify-center text-center max-w-[1000px] w-full">
                    
                    {/* 2. Top Logo & Text (Absolute) */}
                    <div 
                        className={`absolute bottom-full mb-8 md:mb-12 w-full flex flex-col items-center transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                    >
                        <img 
                            src={openclawImg} 
                            alt="OpenClaw Logo" 
                            className="h-[60px] md:h-[80px] object-contain mb-4 md:mb-6 mix-blend-multiply" 
                        />
                        <p className="text-[32px] md:text-[46px] font-bold text-gray-500 tracking-tight">
                            OpenClaw를 쓰고 계신
                        </p>
                    </div>

                    {/* 1. Middle Text (Hero) - 처음엔 크고, 이후 제 크기로 작아짐 */}
                    <div 
                        className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step === 0 ? 'opacity-0 scale-95 translate-y-6' : step === 1 ? 'opacity-100 scale-110 md:scale-125 translate-y-0' : 'opacity-100 scale-100 translate-y-0'}`}
                    >
                        <p className="text-[32px] md:text-[46px] font-bold text-[#1d1d1f] tracking-tight">
                            대표님은 알고 계실 것입니다.
                        </p>
                    </div>

                    {/* 3. Bottom Text (Absolute) - 핵심 메시지 강조 칼라 (신뢰의 Blue) */}
                    <div 
                        className={`absolute top-full mt-8 md:mt-12 w-full flex flex-col items-center transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}
                    >
                        <p className="text-[32px] md:text-[46px] font-bold text-blue-600 tracking-tight">
                            내 PC에 들어와 모든 걸 할 수 있는 AI의 위력을.
                        </p>
                    </div>

                </div>
            </div>
        </section>
    );
}
