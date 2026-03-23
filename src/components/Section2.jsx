import React, { useState, useEffect } from 'react';

export default function Section2({ isActive }) {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }
        
        // 1. 가운데 텍스트 등장 (0.5s)
        const t1 = setTimeout(() => setStep(1), 500);
        // 2. 그 위 텍스트 등장 (0.8s 간격 -> 1.3s)
        const t2 = setTimeout(() => setStep(2), 1300);
        // 3. 그 아래 텍스트 등장 (0.8s 간격 -> 2.1s)
        const t3 = setTimeout(() => setStep(3), 2100);
        // 4. 최상단 openclaw.jpg 이미지 쏙 등장 (0.8s 간격 -> 2.9s)
        const t4 = setTimeout(() => setStep(4), 2900);

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white flex flex-col items-center justify-center relative px-4">
            <div 
                className="w-[800px] text-[50px] flex flex-col items-start text-black font-sans tracking-tight leading-tight gap-1"
                style={{ fontWeight: 400 }}
            >
                {/* 4. Top Image (openclaw.jpg) - 텍스트 완료 후 아래에서 위로 쏙 등장 */}
                <div className="h-[100px] overflow-hidden -mb-4 flex items-end relative z-0 mix-blend-multiply">
                    <img 
                        src="/img/openclaw.jpg" 
                        alt="OpenClaw Logo" 
                        className={`h-[100px] object-contain object-left transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${step >= 4 ? 'translate-y-0 opacity-100' : 'translate-y-[100px] opacity-0'}`} 
                    />
                </div>

                {/* 2. Top */}
                <div className={`transition-all duration-500 ease-out relative z-10 ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    OpenClaw를 쓰고계신
                </div>

                {/* 1. Middle */}
                <div className={`font-bold transition-all duration-500 ease-out ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    대표님은 알고계실 것입니다.
                </div>

                {/* 3. Bottom */}
                <div className={`transition-all duration-500 ease-out ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    내 PC에 들어와 모든걸 할 수 있는<br />
                    AI의 위력을.
                </div>
            </div>
        </section>
    );
}
