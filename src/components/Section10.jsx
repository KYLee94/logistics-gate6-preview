import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Section10({ isActive }) {
    const { lang } = useLanguage();
    
    // Staggered animation states for a formal, 'dry' presentation feel
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (isActive) {
            const t1 = setTimeout(() => setStep(1), 300);
            const t2 = setTimeout(() => setStep(2), 1100);
            const t3 = setTimeout(() => setStep(3), 1900);
            return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
        } else {
            setStep(0);
        }
    }, [isActive]);

    return (
        <section className="relative w-full h-full bg-[#fbfbfd] flex flex-col justify-center items-center overflow-hidden">
            <div className="w-full max-w-[1200px] px-6 md:px-12 lg:px-24 mx-auto flex flex-col justify-center h-full pt-[60px] md:pt-0">
                
                {/* Structural left border for an editorial, non-advertising, professional aesthetic */}
                <div className={`w-full max-w-[900px] border-l-[3px] border-[#1d1d1f] pl-6 md:pl-10 lg:pl-12 transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${step >= 1 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}>
                    
                    <h2 className="text-[28px] md:text-[45px] lg:text-[56px] font-bold leading-[1.25] text-[#1d1d1f] tracking-tight mb-8 md:mb-12 break-keep">
                        {lang === 'kr' ? (
                            <>
                                산업혁명 시대의 <span className="text-[#86868b] font-medium">증기기관</span>,<br/>
                                정보화 시대의 <span className="text-[#86868b] font-medium">World Wide Web</span>.<br/>
                                <span className={`inline-block mt-6 md:mt-8 font-extrabold text-[#1d1d1f] text-[40px] md:text-[64px] lg:text-[80px] tracking-tighter transition-all duration-[1200ms] ease-out transform ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                                    그리고 IFPDP.
                                </span>
                            </>
                        ) : (
                            <>
                                The <span className="text-[#86868b] font-medium">Steam Engine</span> of the Industrial Revolution,<br/>
                                The <span className="text-[#86868b] font-medium">World Wide Web</span> of the Information Age.<br/>
                                <span className={`inline-block mt-6 md:mt-8 font-extrabold text-[#1d1d1f] text-[40px] md:text-[64px] lg:text-[80px] tracking-tighter transition-all duration-[1200ms] ease-out transform ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                                    And IFPDP.
                                </span>
                            </>
                        )}
                    </h2>

                    <div className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <p className="text-[15px] md:text-[18px] lg:text-[20px] font-medium leading-[1.7] text-[#1d1d1f] mb-12 md:mb-16 break-keep max-w-[750px]">
                            {lang === 'kr' ? (
                                '특정 시대를 관통하는 필수재(Infrastructure)가 존재했듯, IFPDP는 이지스의 차세대를 움직이는 근본적인 \'엔진(The Engine)\'으로 기능합니다. 단순한 데이터 저장 공간을 넘어, 조직의 의사결정과 밸류체인을 하나로 연결하는 대체 불가능한 핵심 동력입니다.'
                            ) : (
                                'Just as indispensable infrastructures have defined specific eras, IFPDP functions as the fundamental \'Engine\' that drives IGIS\'s next generation. Beyond a mere data repository, it is an irreplaceable core dynamic connecting organizational decision-making and value chains as one.'
                            )}
                        </p>

                        <div className="flex items-center">
                            <a href="#none" className="group inline-flex items-center justify-center bg-[#1d1d1f] text-white px-8 md:px-10 py-4 md:py-5 font-bold text-[14px] md:text-[16px] tracking-wide hover:bg-[#333] transition-all duration-300">
                                {lang === 'kr' ? 'IFPDP 사용해보기' : 'Initialize IFPDP'}
                                <svg className="w-4 h-4 md:w-5 md:h-5 ml-3 md:ml-4 transform group-hover:translate-x-2 transition-transform duration-300" fill="none" strokeWidth="2.5" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="square" strokeLinejoin="miter" d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </a>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
