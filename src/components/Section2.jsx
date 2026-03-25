import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import openclawImg from '../assets/openclaw.jpg';

export default function Section2({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }
        
        // Cinematic Sequencing - 빠르게 조정
        const t1 = setTimeout(() => setStep(1), 500);  
        const t2 = setTimeout(() => setStep(2), 1400); // OpenClaw 등장 (당김)
        const t3 = setTimeout(() => setStep(3), 2100); // 밑에 텍스트 등장
        const t4 = setTimeout(() => setStep(4), 3000); // 밑줄 긋기 애니메이션

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white overflow-y-auto relative px-4">
            <div className="w-full min-h-full flex flex-col items-center justify-center py-24 md:py-32">
                
                {/* 일반 Flex Flow로 좌측 정렬 및 가장 타이트한 줄간격 밀착 */}
                <div className="flex flex-col items-start justify-center text-left max-w-[1000px] w-full gap-0 md:gap-1 relative border-l-0 pl-0 -translate-y-[40px] md:-translate-y-[50px]">
                    
                    {/* 2. Top Text (relative Wrapper for anchoring absolute Logo) */}
                    <div className="relative w-full">
                        {/* 0. OpenClaw Logo (Absolute 배치로 텍스트 밀림 현상 완벽 방지) */}
                        <div className="absolute bottom-full left-0 mb-1 md:mb-2 overflow-hidden pointer-events-none">
                            <img 
                                src={openclawImg} 
                                alt="OpenClaw Logo" 
                                className={`h-[40px] md:h-[60px] object-contain mix-blend-multiply transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 4 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`} 
                            />
                        </div>

                        {/* Top Text content */}
                        <div 
                            className={`flex flex-col items-start transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] overflow-hidden ${step >= 2 ? 'opacity-100 max-h-[300px]' : 'opacity-0 max-h-0'}`}
                        >
                            <p className="text-[37px] md:text-[51px] font-bold text-[#1d1d1f] tracking-tight leading-[1.05]">
                                {lang === 'kr' ? "OpenClaw를 쓰고 계신" : "As an active user of OpenClaw,"}
                            </p>
                        </div>
                    </div>

                    {/* 1. Middle Text (Hero) */}
                    <div 
                        className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                    >
                        <p className="text-[37px] md:text-[51px] font-bold text-[#1d1d1f] tracking-tight leading-[1.05]">
                            {lang === 'kr' ? "대표님은 이미 알고 계실 것입니다." : "you likely already recognize,"}
                        </p>
                    </div>

                    {/* 3. Bottom Text - 밑줄 그어지는 하이라이트 애니메이션 추가 */}
                    <div 
                        className={`flex flex-col items-start transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] overflow-hidden ${step >= 3 ? 'opacity-100 max-h-[250px] mt-1' : 'opacity-0 max-h-0 mt-0'}`}
                    >
                        <p className="text-[37px] md:text-[51px] font-bold text-[#1d1d1f] tracking-tight leading-[1.1] inline-block pb-4 z-10">
                            <span className="relative inline-block pb-[1px]">
                                {lang === 'kr' ? "내 PC에 들어와 모든 걸 할 수 있는" : "the unprecedented power of an AI"}
                                {/* 좌측에서 우측으로 그어지는 언더라인 (1px 얇게, 2px 더 위로 밀착) */}
                                <span 
                                    className={`absolute bottom-[2px] left-0 h-[2px] md:h-[3px] bg-[#1d1d1f] -z-10 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${step >= 4 ? 'w-full opacity-100' : 'w-0 opacity-0'}`}
                                ></span>
                            </span>
                            {lang === 'kr' ? ' AI의 위력을.' : ' operating entirely within your PC.'}
                        </p>
                    </div>

                </div>
            </div>
        </section>
    );
}
