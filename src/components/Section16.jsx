import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Section16({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (isActive) {
            const t1 = setTimeout(() => setStep(1), 300);
            const t2 = setTimeout(() => setStep(2), 1100);
            const t3 = setTimeout(() => setStep(3), 1900);
            const t4 = setTimeout(() => setStep(4), 2800);
            return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
        } else {
            setStep(0);
        }
    }, [isActive]);

    // 10 Value chains list
    const vcNodes = ['소싱', '투자', '펀드생성', '개발추진', '파이낸싱', '유저솔루션', '기업마케팅', '개발관리', '준공', '운영'];

    return (
        <section className="relative w-full h-full bg-white flex flex-col justify-center items-center overflow-hidden">
            
            <style>
                {`
                    @keyframes redPulseAlert {
                        0% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.5); transform: scale(1); }
                        70% { box-shadow: 0 0 0 15px rgba(255, 59, 48, 0); transform: scale(1.1); }
                        100% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0); transform: scale(1); }
                    }
                `}
            </style>

            <div className="w-full max-w-[1500px] px-6 lg:px-14 mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center h-full pt-[60px] md:pt-0">
                
                {/* LEFT: Dry, authoritative text (Matched to User Image exactly) */}
                <div className={`w-full max-w-[600px] transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${step >= 1 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}>
                    
                    <span className="text-black font-bold text-[14px] md:text-[15px] tracking-tight mb-3 block">
                        Delegation of Authority
                    </span>

                    <h2 className="text-[40px] md:text-[50px] lg:text-[56px] font-bold leading-[1.2] text-black tracking-tight mb-8 md:mb-12">
                        {lang === 'kr' ? (
                            <>
                                DA : 데이터 기반의<br/>
                                권한 위임
                            </>
                        ) : (
                            <>
                                DA : Data-Driven<br/>
                                Delegation
                            </>
                        )}
                    </h2>

                    <div className={`flex flex-col gap-6 md:gap-7 transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <p className="text-[17px] md:text-[20px] font-bold text-black leading-[1.5] break-keep">
                            {lang === 'kr' ? (
                                <>거버넌스가 세팅된 플랫폼은 마이크로 매니징을<br/>요구하지 않습니다.</>
                            ) : (
                                <>A platform with established governance does not require micro-management.</>
                            )}
                        </p>
                        <p className="text-[15px] md:text-[17px] font-medium text-[#86868b] leading-[1.6] break-keep">
                            {lang === 'kr' ? (
                                <>IFPDP는 실시간 데이터 취합을 통해 정상 범위의 공정은 자율 작동시키고,<br/>리스크 한도를 이탈한 프로젝트(Red Flag)와 최종 의사결정(Approval) 안건만을<br/>대표님께 보고합니다.</>
                            ) : (
                                <>Through real-time data aggregation, IFPDP autonomously operates normal processes, reporting only out-of-bounds projects (Red Flags) and final decisions to the executive.</>
                            )}
                        </p>
                        <p className="text-[17px] md:text-[20px] font-bold text-black leading-[1.5] break-keep">
                            {lang === 'kr' ? (
                                <>이를 통해 경영진의 리소스를 '과정의 통제'가 아닌 '전략적 결단'에<br/>집중시킵니다.</>
                            ) : (
                                <>This focuses executive resources on 'strategic decisions' rather than 'process control'.</>
                            )}
                        </p>
                    </div>
                </div>

                {/* RIGHT: iPad Image Asset */}
                <div className={`relative w-full flex justify-end lg:justify-center items-center transition-all duration-[1500ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${step >= 3 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
                    <img 
                        src="/ipad.jpg" 
                        alt="iPad Dashboard Graphic" 
                        className="w-auto h-auto max-w-none object-contain origin-left mix-blend-darken"
                        style={{ transform: 'scale(1.3)' }}
                    />
                </div>

            </div>
        </section>
    );
}
