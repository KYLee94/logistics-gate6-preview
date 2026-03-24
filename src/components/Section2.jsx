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
        <section className="section w-full h-full bg-[#fbfbfd] overflow-y-auto relative px-4">
            <div className="w-full min-h-full flex flex-col items-center justify-center py-24 md:py-32">
                
                {/* 일반 Flex Flow로 좌측 정렬 및 가장 타이트한 줄간격 밀착 */}
                <div className="flex flex-col items-start justify-center text-left max-w-[1000px] w-full gap-0 md:gap-1 relative border-l-0 pl-0 -translate-y-[40px] md:-translate-y-[50px]">
                    
                    {/* 2. Top Text */}
                    <div 
                        className={`flex flex-col items-start transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] overflow-hidden ${step >= 2 ? 'opacity-100 max-h-[300px]' : 'opacity-0 max-h-0'}`}
                    >
                        <p className="text-[37px] md:text-[51px] font-bold text-[#1d1d1f] tracking-tight leading-[1.05]">
                            OpenClaw를 쓰고 계신
                        </p>
                    </div>

                    {/* 1. Middle Text (Hero) - 크기가 작아지지 않게 고정 */}
                    <div 
                        className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                    >
                        <p className="text-[37px] md:text-[51px] font-bold text-[#1d1d1f] tracking-tight leading-[1.05]">
                            대표님은 알고 계실 것입니다.
                        </p>
                    </div>

                    {/* 3. Bottom Text - 핵심 메시지 컬러도 무거운 검정으로 통일하여 전문성 강조 */}
                    <div 
                        className={`flex flex-col items-start transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] overflow-hidden ${step >= 3 ? 'opacity-100 max-h-[250px] mt-1' : 'opacity-0 max-h-0 mt-0'}`}
                    >
                        <p className="text-[37px] md:text-[51px] font-bold text-[#1d1d1f] tracking-tight leading-[1.05]">
                            내 PC에 들어와 모든 걸 할 수 있는 AI의 위력을.
                        </p>
                    </div>

                </div>
            </div>
        </section>
    );
}
