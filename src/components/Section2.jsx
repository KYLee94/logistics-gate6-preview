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
        // 2. 그 위 텍스트 등장 (1.3s)
        const t2 = setTimeout(() => setStep(2), 1300);
        // 3. 그 아래 텍스트 등장 (2.1s)
        const t3 = setTimeout(() => setStep(3), 2100);
        // 4. 최상단 openclaw.jpg 이미지 등장 (좀 더 빨리: 2.3s)
        const t4 = setTimeout(() => setStep(4), 2300);

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white flex flex-col items-center justify-center relative px-4">
            <div 
                className="w-[1000px] text-[50px] flex flex-col items-start justify-center text-black font-sans tracking-tight leading-tight gap-1 relative"
                style={{ fontWeight: 400 }}
            >
                {/* 4. Top Image (openclaw.jpg) - 절대 위치 지정으로 텍스트의 세로 중앙 정렬을 방해하지 않게 분리 */}
                <div className="absolute -top-[70px] left-0 h-[100px] overflow-hidden flex items-end z-0 mix-blend-multiply pointer-events-none">
                    <img 
                        src="/img/openclaw.jpg" 
                        alt="OpenClaw Logo" 
                        className={`h-[100px] object-contain object-left transition-all duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${step >= 4 ? 'translate-y-0 opacity-100' : 'translate-y-[100px] opacity-0'}`} 
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
        </section>
    );
}
