import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Section7({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }
        
        const t1 = setTimeout(() => setStep(1), 500);  // Title cascade
        const t2 = setTimeout(() => setStep(2), 1200); // Subtitle
        const t3 = setTimeout(() => setStep(3), 2000); // 3-col grid
        const t4 = setTimeout(() => setStep(4), 2800); // Underlines highlight
        
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white flex flex-col items-center justify-center relative px-6 md:px-16 lg:px-24 pt-[80px] md:pt-[100px] pb-[80px] overflow-y-auto">
            <div className="w-full max-w-[1400px] mx-auto flex flex-col justify-center h-full">
                
                {/* 1. Header Messages */}
                <div className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                    <h2 className="text-[26px] md:text-[36px] lg:text-[42px] font-bold text-[#1d1d1f] tracking-tight leading-[1.3] break-keep mb-8 md:mb-12">
                        {lang === 'kr' ? (
                            <>
                                앞선 글로벌 석학의 경고는,<br />
                                놀랍게도 대표님이 CFT 마스터플랜에서 짚어준 우리의 현실과 정확히 일치합니다.
                            </>
                        ) : (
                            <>
                                Surprisingly, the preceding global expert's warning<br />
                                perfectly aligns with the reality pointed out in our CEO's CFT Masterplan.
                            </>
                        )}
                    </h2>
                </div>

                <div className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                    <h3 className="text-[26px] md:text-[36px] lg:text-[42px] font-bold text-[#1d1d1f] tracking-tight leading-[1.3] break-keep mb-16 md:mb-24">
                        {lang === 'kr' ? (
                            <>
                                "<span className="bg-gradient-to-r from-[#d92d2d] to-[#f97316] text-transparent bg-clip-text">운용 인력들의 폐쇄적인 오너십과 개인편차</span>" 때문입니다.
                            </>
                        ) : (
                            <>
                                It is due to the "<span className="bg-gradient-to-r from-[#d92d2d] to-[#f97316] text-transparent bg-clip-text">closed ownership and individual deviations of operation personnel</span>".
                            </>
                        )}
                    </h3>
                </div>

                {/* 2. Three Columns Grid */}
                <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-14 lg:gap-20 w-full transition-all duration-[1500ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                    
                    {/* Column 1 */}
                    <div className="flex flex-col">
                        <h4 className="text-[20px] md:text-[24px] font-bold text-[#1d1d1f] mb-6">
                            {lang === 'kr' ? "폐쇄적 오너십" : "Closed Ownership"}
                        </h4>
                        <p className="text-[16px] md:text-[18px] text-[#424245] leading-[1.65] break-keep font-medium">
                            {lang === 'kr' ? (
                                <>
                                    프로젝트/펀드 설정과 관리에서 가장 중요한 것은<br className="hidden lg:block" />
                                    운용역의 오너십. 이는 집중과 효율 측면에서 긍정적이나,<br className="hidden lg:block" />
                                    <span 
                                        className="relative inline transition-colors duration-500 font-bold"
                                        style={{
                                            backgroundImage: 'linear-gradient(transparent 85%, #d92d2d 85%, #d92d2d 100%)',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: step >= 4 ? '100% 100%' : '0% 100%',
                                            transition: 'background-size 1.2s cubic-bezier(0.19, 1, 0.22, 1)'
                                        }}
                                    >협업 측면에서는 부정적(폐쇄적)인 요소로 작용</span>
                                </>
                            ) : (
                                <>
                                    The most crucial aspect of project/fund setup and management is the operator’s ownership. While positive for focus and efficiency, <span 
                                        className="relative inline transition-colors duration-500 font-bold"
                                        style={{
                                            backgroundImage: 'linear-gradient(transparent 85%, #d92d2d 85%, #d92d2d 100%)',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: step >= 4 ? '100% 100%' : '0% 100%',
                                            transition: 'background-size 1.2s cubic-bezier(0.19, 1, 0.22, 1)'
                                        }}
                                    >it acts as a negative (closed) factor for collaboration.</span>
                                </>
                            )}
                        </p>
                    </div>

                    {/* Column 2 */}
                    <div className="flex flex-col">
                        <h4 className="text-[20px] md:text-[24px] font-bold text-[#1d1d1f] mb-6">
                            {lang === 'kr' ? "개인 편차" : "Individual Deviation"}
                        </h4>
                        <p className="text-[16px] md:text-[18px] text-[#424245] leading-[1.65] break-keep font-medium">
                            {lang === 'kr' ? (
                                <>
                                    협업의 본질에서 중요한건 <span 
                                        className="relative inline transition-colors duration-500 font-bold"
                                        style={{
                                            backgroundImage: 'linear-gradient(transparent 85%, #d92d2d 85%, #d92d2d 100%)',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: step >= 4 ? '100% 100%' : '0% 100%',
                                            transition: 'background-size 1.2s cubic-bezier(0.19, 1, 0.22, 1)'
                                        }}
                                    >상대방을 인정하고<br className="hidden lg:block" />
                                    나의 부족함을 드러내야 하는데 그게 안됨</span><br className="hidden lg:block" />
                                    PO마다 성향이 모두 달라 일관성이 없음
                                </>
                            ) : (
                                <>
                                    The essence of collaboration requires <span 
                                        className="relative inline transition-colors duration-500 font-bold"
                                        style={{
                                            backgroundImage: 'linear-gradient(transparent 85%, #d92d2d 85%, #d92d2d 100%)',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: step >= 4 ? '100% 100%' : '0% 100%',
                                            transition: 'background-size 1.2s cubic-bezier(0.19, 1, 0.22, 1)'
                                        }}
                                    >acknowledging others and revealing one's own shortcomings, which often fails.</span><br className="hidden lg:block" />
                                    PO profiles vary completely, lacking consistency.
                                </>
                            )}
                        </p>
                    </div>

                    {/* Column 3 */}
                    <div className="flex flex-col">
                        <h4 className="text-[20px] md:text-[24px] font-bold text-[#1d1d1f] mb-6">
                            {lang === 'kr' ? "이지스의 특성" : "Characteristics of IGIS"}
                        </h4>
                        <p className="text-[16px] md:text-[18px] text-[#424245] leading-[1.65] break-keep font-medium">
                            {lang === 'kr' ? (
                                <>
                                    대기업의 협업은 큰 조직의 협업 규약을 따르면<br className="hidden lg:block" />
                                    저절로 협업이 되는데 반해, 이지스는 협업 규약을<br className="hidden lg:block" />
                                    <span 
                                        className="relative inline transition-colors duration-500 font-bold"
                                        style={{
                                            backgroundImage: 'linear-gradient(transparent 85%, #d92d2d 85%, #d92d2d 100%)',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: step >= 4 ? '100% 100%' : '0% 100%',
                                            transition: 'background-size 1.2s cubic-bezier(0.19, 1, 0.22, 1)'
                                        }}
                                    >만들고 강제하면 유연성이 떨어지고 오히려 반작용 발생.</span>
                                </>
                            ) : (
                                <>
                                    While corporate collaboration naturally happens by following a large organization's protocol, for IGIS, <span 
                                        className="relative inline transition-colors duration-500 font-bold"
                                        style={{
                                            backgroundImage: 'linear-gradient(transparent 85%, #d92d2d 85%, #d92d2d 100%)',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: step >= 4 ? '100% 100%' : '0% 100%',
                                            transition: 'background-size 1.2s cubic-bezier(0.19, 1, 0.22, 1)'
                                        }}
                                    >creating and enforcing collaboration protocols reduces flexibility and causes adverse reactions.</span>
                                </>
                            )}
                        </p>
                    </div>

                </div>
            </div>
        </section>
    );
}
