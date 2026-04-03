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
            const t4 = setTimeout(() => setStep(4), 2700);
            return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
        } else {
            setStep(0);
        }
    }, [isActive]);

    // Dashboard Matrix representation
    const rows = 8;
    const cols = 12; // 96 dots
    const normalDots = Array.from({ length: rows * cols - 1 }); 

    return (
        <section className="relative w-full h-full bg-[#fbfbfd] flex flex-col justify-center items-center overflow-hidden">
            
            <style>
                {`
                    @keyframes redPulseClean {
                        0% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.4); transform: scale(1); }
                        70% { box-shadow: 0 0 0 15px rgba(255, 59, 48, 0); transform: scale(1.1); }
                        100% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0); transform: scale(1); }
                    }
                `}
            </style>

            <div className="w-full max-w-[1400px] px-6 md:px-12 lg:px-20 mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center h-full pt-[60px] md:pt-0">
                
                {/* LEFT: Dry, authoritative editorial text (Inherited from Section 10 style) */}
                <div className={`w-full border-l-[3px] border-[#1d1d1f] pl-6 md:pl-10 transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${step >= 1 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}>
                    
                    <span className="text-[#86868b] font-bold text-[12px] md:text-[14px] tracking-[0.2em] uppercase mb-4 block">
                        Executive View : 예외 관리와 권한 위임(DA)
                    </span>

                    <h2 className="text-[32px] md:text-[45px] lg:text-[54px] font-bold leading-[1.2] text-[#1d1d1f] tracking-tight mb-8 md:mb-10 break-keep">
                        {lang === 'kr' ? (
                            <>
                                데이터 기반의 <br/>
                                <span className="font-extrabold">권한 위임 (Delegation of Authority)</span>
                            </>
                        ) : (
                            <>
                                Data-driven <br/>
                                <span className="font-extrabold">Delegation of Authority</span>
                            </>
                        )}
                    </h2>

                    <div className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <p className="text-[16px] md:text-[19px] font-bold text-[#1d1d1f] leading-[1.6] mb-5 break-keep">
                            {lang === 'kr' ? '거버넌스가 세팅된 플랫폼은 마이크로 매니징(Micro-management)을 요구하지 않습니다.' : 'A platform with established governance does not require micro-management.'}
                        </p>
                        <p className="text-[15px] md:text-[17px] font-medium text-[#424245] leading-[1.7] mb-5 break-keep">
                            {lang === 'kr' ? 'IFPDP는 실시간 데이터 취합을 통해 정상 범위의 공정은 자율 작동시키고, 리스크 한도를 이탈한 프로젝트(Red Flag)와 최종 의사결정(Approval) 안건만을 대표님께 보고합니다.' : 'Through real-time data aggregation, IFPDP autonomously operates processes within normal parameters, reporting only out-of-bounds projects (Red Flags) and final decision (Approval) agendas to the executive.'}
                        </p>
                        <p className="text-[16px] md:text-[19px] font-bold text-[#1d1d1f] leading-[1.6] break-keep">
                            {lang === 'kr' ? '이를 통해 경영진의 리소스를 \'과정의 통제\'가 아닌 \'전략적 결단\'에 집중시킵니다.' : 'This focuses executive resources on \'strategic decisions\' rather than \'process control\'.'}
                        </p>
                    </div>
                </div>

                {/* RIGHT: Minimalist Wireframe CEO Dashboard */}
                <div className={`relative w-full aspect-video max-h-[500px] bg-white border border-[#d2d2d7] rounded-lg shadow-[0_20px_40px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-[1500ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${step >= 3 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
                    
                    {/* Dashboard Header Bar */}
                    <div className="w-full h-[40px] border-b border-[#e5e5ea] flex items-center px-4 justify-between bg-[#fbfbfd]">
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full border border-[#d2d2d7]" />
                            <div className="w-2.5 h-2.5 rounded-full border border-[#d2d2d7]" />
                            <div className="w-2.5 h-2.5 rounded-full border border-[#d2d2d7]" />
                        </div>
                        <div className="flex gap-6">
                            <div className="w-12 h-1 bg-[#d2d2d7] rounded-full" />
                            <div className="w-8 h-1 bg-[#d2d2d7] rounded-full" />
                        </div>
                    </div>

                    {/* Dashboard Content Grid */}
                    <div className="w-full h-[calc(100%-40px)] p-6 lg:p-10 flex flex-col relative">
                        
                        {/* Title wireframe */}
                        <div className="w-1/3 h-3 bg-[#e5e5ea] rounded-full mb-8" />

                        {/* Matrix of Normal operations */}
                        <div className="w-full flex-1 grid grid-cols-12 gap-3 lg:gap-4 relative pr-[200px]">
                            {normalDots.map((_, i) => (
                                <div key={i} className="w-[6px] h-[6px] bg-[#d2d2d7] rounded-full mx-auto" />
                            ))}
                            
                            {/* The ONE Red Flag Exception */}
                            <div className={`absolute top-[40%] left-[60%] flex flex-col items-center z-10 transition-all duration-1000 ${step >= 4 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                <div className="w-4 h-4 bg-[#ff3b30] rounded-full relative z-20" style={{ animation: 'redPulseClean 2.5s infinite' }} />
                                
                                {/* Red Flag connection line to the floating box */}
                                <div className="w-[100px] h-[1px] bg-[#ff3b30] absolute top-2 left-4 origin-left scale-x-100 border-dashed border-t-[1px]" />
                            </div>
                        </div>

                        {/* Floating Exception Approval Panel */}
                        <div className={`absolute right-6 lg:right-10 top-1/2 -translate-y-1/2 w-[180px] bg-white border border-[#e5e5ea] shadow-lg rounded-md p-4 transition-all duration-[1200ms] delay-300 transform ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-1.5 h-1.5 bg-[#ff3b30] rounded-full" />
                                <div className="w-16 h-1.5 bg-[#e5e5ea] rounded-full" />
                            </div>
                            <div className="w-full h-1 bg-[#f5f5f7] rounded-full mb-1.5" />
                            <div className="w-4/5 h-1 bg-[#f5f5f7] rounded-full mb-4" />
                            
                            {/* Minimalist Approve Button */}
                            <div className="w-full h-8 bg-[#1d1d1f] text-white flex items-center justify-center text-[10px] font-bold tracking-widest cursor-pointer hover:bg-black transition-colors rounded-sm">
                                APPROVE
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </section>
    );
}
