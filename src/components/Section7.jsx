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
                                앞선 글로벌 전문가의 지적은,<br />
                                놀랍게도 현재 우리가 현업에서 매일 마주하는 뼈아픈 한계와 일치합니다.
                            </>
                        ) : (
                            <>
                                The preceding global expert's warning<br />
                                perfectly aligns with the painful limitations we face in our daily operations.
                            </>
                        )}
                    </h2>
                </div>

                <div className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                    <h3 className="text-[26px] md:text-[36px] lg:text-[42px] font-bold text-[#1d1d1f] tracking-tight leading-[1.3] break-keep mb-16 md:mb-24">
                        {lang === 'kr' ? (
                            <>
                                바로 "<span className="text-[#d92d2d] font-bold">데이터 고립 현상과 파편화된 지식 자산</span>" 때문입니다.
                            </>
                        ) : (
                            <>
                                It is precisely due to "<span className="text-[#d92d2d] font-bold">data isolation and fragmented knowledge assets</span>".
                            </>
                        )}
                    </h3>
                </div>

                {/* 2. Three Columns Grid */}
                <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-14 lg:gap-20 w-full transition-all duration-[1500ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                    
                    {/* Column 1 */}
                    <div className="flex flex-col">
                        <h4 className="text-[20px] md:text-[24px] font-bold text-[#1d1d1f] mb-6">
                            {lang === 'kr' ? "데이터 고립 현상" : "Data Isolation"}
                        </h4>
                        <p className="text-[16px] md:text-[18px] text-[#424245] leading-[1.65] break-keep font-medium">
                            {lang === 'kr' ? (
                                <>
                                    각 자산별 책임과 권한이 명확한 것은 효율적이나,<br className="hidden lg:block" />
                                    강한 오너십이 오히려 부서 간<br className="hidden lg:block" />
                                    <span 
                                        className="relative inline transition-colors duration-500 font-bold"
                                        style={{
                                            backgroundImage: 'linear-gradient(transparent 85%, #d92d2d 85%, #d92d2d 100%)',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: step >= 4 ? '100% 100%' : '0% 100%',
                                            transition: 'background-size 1.2s cubic-bezier(0.19, 1, 0.22, 1)'
                                        }}
                                    >데이터가 전사적으로 흐르지 못하는 벽을 생성.</span>
                                </>
                            ) : (
                                <>
                                    Clear responsibility per asset is efficient, but<br className="hidden lg:block" />
                                    strong ownership acts as a limitation: <span 
                                        className="relative inline transition-colors duration-500 font-bold"
                                        style={{
                                            backgroundImage: 'linear-gradient(transparent 85%, #d92d2d 85%, #d92d2d 100%)',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: step >= 4 ? '100% 100%' : '0% 100%',
                                            transition: 'background-size 1.2s cubic-bezier(0.19, 1, 0.22, 1)'
                                        }}
                                    >it creates a wall restricting corporate data flow.</span>
                                </>
                            )}
                        </p>
                    </div>

                    {/* Column 2 */}
                    <div className="flex flex-col">
                        <h4 className="text-[20px] md:text-[24px] font-bold text-[#1d1d1f] mb-6">
                            {lang === 'kr' ? "파편화된 지식 자산" : "Fragmented Knowledge Assets"}
                        </h4>
                        <p className="text-[16px] md:text-[18px] text-[#424245] leading-[1.65] break-keep font-medium">
                            {lang === 'kr' ? (
                                <>
                                    실무진 개개인의 뛰어난 역량과 산출물이 <span 
                                        className="relative inline transition-colors duration-500 font-bold"
                                        style={{
                                            backgroundImage: 'linear-gradient(transparent 85%, #d92d2d 85%, #d92d2d 100%)',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: step >= 4 ? '100% 100%' : '0% 100%',
                                            transition: 'background-size 1.2s cubic-bezier(0.19, 1, 0.22, 1)'
                                        }}
                                    >전사 통합 자산화되지 못하고<br className="hidden lg:block" />
                                    각자의 이메일과 로컬 폴더 속에 흩어져 있음.</span><br className="hidden lg:block" />
                                    누가 어떤 정보를 쥐고 있는지 알 수 없어 중복 업무 발생.
                                </>
                            ) : (
                                <>
                                    Exceptional individual capabilities and outputs <span 
                                        className="relative inline transition-colors duration-500 font-bold"
                                        style={{
                                            backgroundImage: 'linear-gradient(transparent 85%, #d92d2d 85%, #d92d2d 100%)',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: step >= 4 ? '100% 100%' : '0% 100%',
                                            transition: 'background-size 1.2s cubic-bezier(0.19, 1, 0.22, 1)'
                                        }}
                                    >are not consolidated as corporate assets, but scattered across local folders.</span><br className="hidden lg:block" />
                                    Resulting in redundant work due to hidden information.
                                </>
                            )}
                        </p>
                    </div>

                    {/* Column 3 */}
                    <div className="flex flex-col">
                        <h4 className="text-[20px] md:text-[24px] font-bold text-[#1d1d1f] mb-6">
                            {lang === 'kr' ? "일관된 플랫폼 부재" : "Lack of Consistent Platform"}
                        </h4>
                        <p className="text-[16px] md:text-[18px] text-[#424245] leading-[1.65] break-keep font-medium">
                            {lang === 'kr' ? (
                                <>
                                    대기업처럼 강압적인 양식과 규약으로 묶어버리면<br className="hidden lg:block" />
                                    조직 특유의 생동감과 스피드가 즉각 상실됨.<br className="hidden lg:block" />
                                    <span 
                                        className="relative inline transition-colors duration-500 font-bold"
                                        style={{
                                            backgroundImage: 'linear-gradient(transparent 85%, #d92d2d 85%, #d92d2d 100%)',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: step >= 4 ? '100% 100%' : '0% 100%',
                                            transition: 'background-size 1.2s cubic-bezier(0.19, 1, 0.22, 1)'
                                        }}
                                    >개인의 업무 방식을 존중하면서도<br className="hidden lg:block" />
                                    이걸 백그라운드에서 하나로 연결할 시스템 부재.</span>
                                </>
                            ) : (
                                <>
                                    Binding collaboration with rigid corporate templates<br className="hidden lg:block" />
                                    instantly kills the organization's unique flexibility.<br className="hidden lg:block" />
                                    <span 
                                        className="relative inline transition-colors duration-500 font-bold"
                                        style={{
                                            backgroundImage: 'linear-gradient(transparent 85%, #d92d2d 85%, #d92d2d 100%)',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: step >= 4 ? '100% 100%' : '0% 100%',
                                            transition: 'background-size 1.2s cubic-bezier(0.19, 1, 0.22, 1)'
                                        }}
                                    >We lack a system that connects data in the background while respecting individuality.</span>
                                </>
                            )}
                        </p>
                    </div>

                </div>
            </div>
        </section>
    );
}
