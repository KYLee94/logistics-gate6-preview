import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Section13({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);
    const [isModalPopupOpen, setIsModalPopupOpen] = useState(false);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }

        let timers = [];
        
        // Background dimming / Image reveal
        timers.push(setTimeout(() => setStep(0.5), 100));

        // Text reveal steps (빠르게 바로 등장)
        timers.push(setTimeout(() => setStep(1), 800));   // Heading
        timers.push(setTimeout(() => setStep(2), 1200));  // Question
        timers.push(setTimeout(() => setStep(3), 1600));  // Quotes
        timers.push(setTimeout(() => setStep(4), 2000));  // Para 1
        timers.push(setTimeout(() => setStep(5), 2400));  // Para 2
        timers.push(setTimeout(() => setStep(6), 2900));  // Conclusion
        
        // Giant 'Moat' + Underline drops in (마지막 효과, 충분히 읽을 시간 확보 후 등장)
        timers.push(setTimeout(() => setStep(7), 4800)); 

        return () => timers.forEach(t => clearTimeout(t));
    }, [isActive]);

    return (
        <section className="relative section w-full h-full flex flex-col justify-center items-center overflow-hidden bg-[#0A0A0C]">
            
            {/* Background Image: Very slow zoom animation like Section 12 */}
            <div 
                className={`absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat z-0 transform transition-transform duration-[40000ms] ease-linear`}
                style={{ 
                    backgroundImage: `url('${import.meta.env.BASE_URL}igis_office.webp')`,
                    transform: step >= 0.5 ? 'scale(1.15)' : 'scale(1)'
                }}
            />
            
            {/* Dimming Overlay to ensure readability */}
            <div className={`absolute inset-0 bg-black/75 z-10 transition-opacity duration-[1500ms] ease-out ${step >= 0.5 ? 'opacity-100' : 'opacity-0'}`} />

            {/* Content Container (Section 12와 동일하게 위치 및 내부 Moat 정렬) */}
            <div className={`relative z-20 w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1200px] mx-auto text-white flex flex-col font-sans break-keep pt-5 -translate-y-10`}>
                <div className="flex flex-col md:ml-[150px] w-full max-w-full text-left">
                    
                    {/* 0. Moat Popping Header (맨 마지막 액션 시 밀어내며 등장 - 12p Context와 완벽히 동일한 구조) */}
                    <div 
                        className={`overflow-hidden transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] md:-ml-[100px] ${step >= 7 ? 'max-h-[150px] opacity-100 mb-6 md:mb-10' : 'max-h-0 opacity-0 mb-0'}`}
                    >
                        <div 
                            className={`text-[55px] md:text-[75px] lg:text-[95px] font-medium text-white transition-transform duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 7 ? 'translate-y-0' : 'translate-y-12'}`}
                            style={{ 
                                fontFamily: "'Sanomat Wp', 'Sanomat Web', 'Sanomat', sans-serif",
                                letterSpacing: "-0.01em",
                                WebkitFontSmoothing: "antialiased",
                                textRendering: "optimizeLegibility",
                            }}
                        >
                            Moat
                        </div>
                    </div>

                    {/* 1. Main Heading */}
                    <h2 
                        className={`text-[26px] md:text-[34px] lg:text-[42px] font-bold tracking-tight mb-[46px] transition-all duration-1000 ease-out ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                    >
                        {lang === 'kr' ? (
                            <>데이터에 맥락이 쌓이면 해자(Moat)가 됩니다.</>
                        ) : (
                            <>Accumulated context over data becomes a Moat.</>
                        )}
                    </h2>

                    {/* 2. Question & Quotes Box */}
                    <div className={`flex flex-col mb-12 transition-all duration-1000 ease-out ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <p className={`text-[15px] md:text-[17px] lg:text-[19px] font-medium text-[#a1a1a6] mb-4`}>
                            {lang === 'kr' ? (
                                <>현재 이지스는 어떤 상태입니까?</>
                            ) : (
                                <>What is the current state of IGIS?</>
                            )}
                        </p>
                        <p className={`text-[18px] md:text-[22px] lg:text-[26px] font-bold text-white leading-[1.6] transition-all duration-1000 ease-out ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                            {lang === 'kr' ? (
                                <>
                                    "어떤 파트너사가 정치적으로 민감한지"<br className="hidden lg:block"/>
                                    "어떤 딜(Deal) 구조가 과거에 왜 실패했는지"<br className="hidden lg:block"/>
                                    "어떤 프로젝트는 무슨 문제를 어떻게 해결하고 극복해내었는지"
                                </>
                            ) : (
                                <>
                                    "Which partner is politically sensitive?"<br className="hidden lg:block"/>
                                    "Why did a specific deal structure fail in the past?"<br className="hidden lg:block"/>
                                    "How a certain project resolved and overcame its issues"
                                </>
                            )}
                        </p>
                    </div>

                    {/* 3. Paragraph 1 */}
                    <p 
                        className={`text-[16px] md:text-[18px] lg:text-[20px] font-medium text-[#d2d2d7] leading-[1.65] mb-12 transition-all duration-1000 ease-out ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                    >
                        {lang === 'kr' ? (
                            <>
                                이지스를 1조원 매출 운용사로 만든 진짜 '맥락(Institutional Knowledge)'은 서버에 존재하지 않습니다.<br className="hidden lg:block"/>
                                오직 500명 운용역들의 '머릿속과 개인 PC'에만 흩어져 있습니다.
                            </>
                        ) : (
                            <>
                                The true 'Institutional Knowledge' that built IGIS into a 1-trillion-won revenue firm does not exist on a server.<br className="hidden lg:block"/>
                                It is scattered solely across the minds and personal PCs of its 500 professionals.
                            </>
                        )}
                    </p>

                    {/* 4. Paragraph 2 (Underline emphasis) */}
                    <p 
                        className={`text-[16px] md:text-[18px] lg:text-[20px] font-medium text-[#d2d2d7] leading-[1.7] mb-12 transition-all duration-1000 ease-out ${step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                    >
                        {lang === 'kr' ? (
                            <>
                                직원들에게 AI 툴 사용법(Prompt)을 교육하는 것은 해답이 아닙니다.<br className="hidden lg:block"/>
                                툴을 쥐여주기 전에, AI가 안전하고 똑똑하게 뛰어놀 수 있는 <span className="relative inline-block font-bold text-white pb-[1px]">
                                    '이지스만의 거대한 맥락의 판(Context Graph)'
                                    <span className={`absolute bottom-[2px] md:bottom-[4px] left-0 h-[1px] md:h-[2px] bg-white -z-10 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${step >= 7 ? 'w-full opacity-100' : 'w-0 opacity-0'}`}></span>
                                </span>을 먼저 깔아주어야 합니다.
                            </>
                        ) : (
                            <>
                                Training employees on how to use AI tools (Prompt Engineering) is not the answer.<br className="hidden lg:block"/>
                                Before handing them the tools, we must first lay down <span className="relative inline-block font-bold text-white pb-[1px]">
                                    'IGIS's massive Context Graph'
                                    <span className={`absolute bottom-[2px] md:bottom-[4px] left-0 h-[1px] md:h-[2px] bg-white -z-10 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${step >= 7 ? 'w-full opacity-100' : 'w-0 opacity-0'}`}></span>
                                </span> where AI can operate securely and intelligently.
                            </>
                        )}
                    </p>

                    {/* 5. Conclusion point */}
                    <p 
                        className={`text-[16px] md:text-[18px] lg:text-[20px] font-medium text-[#d2d2d7] leading-[1.65] transition-all duration-1000 ease-out ${step >= 6 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                    >
                        {lang === 'kr' ? (
                            <>바로, 우리가 데이터 플랫폼을 구축해야 하는 이유입니다.</>
                        ) : (
                            <>This is exactly why we must build a data platform.</>
                        )}
                    </p>

                    {/* 6. Read Now Link */}
                    <div className={`mt-10 md:mt-12 transition-all duration-1000 ease-out ${step >= 6 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{ transitionDelay: '300ms' }}>
                        <button 
                            onClick={() => setIsModalPopupOpen(true)}
                            className="flex items-center gap-3 text-white group cursor-pointer w-fit"
                        >
                            <span className="text-[17px] md:text-[19px] font-medium tracking-normal font-sans relative top-[1px]">Read Now</span>
                            <div className="w-[36px] h-[36px] md:w-[42px] md:h-[42px] rounded-full border border-white/60 flex items-center justify-center transition-all duration-300 group-hover:bg-white group-hover:text-black">
                                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6 transition-transform group-hover:translate-x-1">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                </svg>
                            </div>
                        </button>
                    </div>

                </div>
            </div>

            {/* Reference Modal */}
            {isModalPopupOpen && (
                <div className="absolute inset-0 z-[999] flex items-center justify-center bg-black/60 p-4 md:p-8 backdrop-blur-sm -translate-y-[env(safe-area-inset-top)]">
                    <div className="w-full max-w-4xl max-h-[85vh] overflow-y-auto hide-scrollbar rounded-none p-6 md:p-10 lg:p-12 bg-white text-black shadow-2xl relative text-left"
                         onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setIsModalPopupOpen(false)}
                            className="absolute top-4 md:top-6 right-4 md:right-6 p-2 opacity-60 hover:opacity-100 transition-opacity cursor-pointer bg-gray-100 rounded-full hover:bg-gray-200"
                        >
                            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="font-sans text-[14px] md:text-[15px] leading-[1.7] font-normal break-keep text-gray-700">
                            <h3 className="text-[20px] md:text-[24px] lg:text-[26px] font-bold mb-6 tracking-[-0.03em] text-black border-b border-gray-100 pb-5">
                                데이터에 맥락이 쌓여 해자가 되는 이유와 특징 <span className="font-medium text-gray-500 text-[15px] lg:text-[17px] ml-1">(글로벌 레퍼런스)</span>
                            </h3>
                            
                            <p className="mb-6 pt-2">
                                데이터에 맥락(Context)이 쌓이면 기업의 가장 진정한 경쟁 우위인 <strong>'해자(Moat, 진입장벽)'</strong>가 됩니다. AI 시대에 일반적인 기술이나 모델은 평범한 상품(Commodity)이 되어가고 있지만, <strong>특정 기업만의 데이터에 맥락이 더해진 '독점적 데이터'는 쉽게 복제할 수 없는 강력한 방어기제</strong>가 됩니다.
                            </p>
                            <p className="mb-8">
                                데이터에 맥락이 쌓여 해자가 되는 이유와 그 특징은 다음과 같습니다.
                            </p>

                            <div className="space-y-8 mb-10 pl-1">
                                <div>
                                    <strong className="block text-[16px] md:text-[17px] font-bold mb-3 text-black">1. 독점적 데이터 (Proprietary Data)</strong>
                                    <ul className="list-disc pl-5 space-y-2">
                                        <li><strong className="font-medium text-black">단순 데이터 vs 맥락이 있는 데이터:</strong> 단순히 양이 많은 데이터보다, 우리 회사만의 제품, 서비스, 고객 행동에서 발생하는 고유한 데이터가 중요합니다.</li>
                                        <li><strong className="font-medium text-black">고품질과 구조:</strong> 데이터는 AI 성능 향상의 핵심이며, 올바른 데이터 구조(Taxonomy)와 연결된 맥락이 쌓여야 확장성과 유지보수가 가능한 해자가 됩니다.</li>
                                    </ul>
                                </div>
                                <div>
                                    <strong className="block text-[16px] md:text-[17px] font-bold mb-3 text-black">2. AI 시대의 진짜 해자 (AI Era Moat)</strong>
                                    <ul className="list-disc pl-5 space-y-2">
                                        <li><strong className="font-medium text-black">데이터 선순환 구조:</strong> 사용자로부터 데이터를 수집하고, 이를 바탕으로 모델을 개선하여, 더 나은 제품을 제공해 더 많은 데이터를 수집하는 구조가 맥락을 깊게 만들어 경쟁자를 따돌립니다.</li>
                                        <li><strong className="font-medium text-black">성능의 차이:</strong> AI 모델 자체가 아니라, 그 모델을 얼마나 깊이 있는 맥락 데이터로 학습(Fine-tuning)시켰는가가 성능 차이를 결정합니다.</li>
                                    </ul>
                                </div>
                                <div>
                                    <strong className="block text-[16px] md:text-[17px] font-bold mb-3 text-black">3. 맥락의 가치 (Value of Context)</strong>
                                    <ul className="list-disc pl-5 space-y-2">
                                        <li><strong className="font-medium text-black">사용자 경험 개인화:</strong> 고객의 과거 행동, 선호도, 구매 패턴(맥락)이 쌓이면, 개별 사용자에게 맞춤화된 서비스 제공이 가능해져 교체 비용(Switching Cost)을 발생시킵니다.</li>
                                        <li><strong className="font-medium text-black">예측력 향상:</strong> 맥락은 데이터의 의미를 명확히 하여, 단순 분석보다 더 정확한 미래 예측 모델을 가능하게 합니다.</li>
                                    </ul>
                                </div>
                            </div>

                            <p className="font-bold text-black leading-relaxed mb-12">
                                결국, 데이터(Data)가 원재료라면, 맥락(Context)은 그것을 가치 있게 만드는 기술이며, 이 두 가지가 결합된 데이터 장벽은 다른 회사가 백 날 따라 해도 따라올 수 없는 진정한 기술적, 비즈니스적 해자가 됩니다.
                            </p>

                            <h4 className="text-[17px] md:text-[19px] font-bold mb-6 tracking-normal text-black pt-2">
                                "독점적 데이터와 맥락의 힘" 관련 글로벌 주요 매체 레퍼런스
                            </h4>

                            <div className="space-y-6 md:space-y-8 pl-1">
                                <div>
                                    <strong className="block font-medium mb-2 md:mb-3 text-black text-[15px] md:text-[16px]">1. 데이터 자체보다 '맥락 있는 데이터'가 중요</strong>
                                    <ul className="space-y-1.5 md:space-y-2 pl-1">
                                        <li className="flex gap-2">
                                            <span className="shrink-0 text-black font-bold">→</span>
                                            <div>
                                                <p className="mb-0 leading-snug">"AI 경쟁력은 알고리즘이 아니라 데이터 맥락에 있다" <a href="https://hbr.org/2025/12/why-your-company-needs-a-chief-data-analytics-and-ai-officer" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline ml-1">Harvard Business Review (HBR)</a></p>
                                            </div>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="shrink-0 text-black font-bold">→</span>
                                            <div>
                                                <p className="mb-0 leading-snug">데이터 전략 = 비즈니스 전략 (데이터의 맥락화 강조) <a href="https://hbr.org/2017/05/whats-your-data-strategy" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline ml-1">Harvard Business Review (HBR)</a></p>
                                            </div>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="shrink-0 text-black font-bold">→</span>
                                            <div>
                                                <p className="mb-0 leading-snug">데이터 구조화 + 연결이 기업 경쟁력의 핵심 <a href="https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-data-driven-enterprise-of-2025" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline ml-1">McKinsey</a></p>
                                            </div>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="shrink-0 text-black font-bold">→</span>
                                            <div>
                                                <p className="mb-0 leading-snug">데이터 자체보다 "조직 내 활용 맥락"이 중요 <a href="https://www.mckinsey.com/midwest/~/media/McKinsey/Business%20Functions/McKinsey%20Analytics/Our%20Insights/Why%20data%20culture%20matters/Why-data-culture-matters.pdf" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline ml-1">McKinsey</a></p>
                                            </div>
                                        </li>
                                    </ul>
                                </div>

                                <div className="border-t border-gray-100 pt-5 md:pt-8">
                                    <strong className="block font-medium mb-2 md:mb-3 text-black text-[15px] md:text-[16px]">2. 데이터 선순환 구조 (Data Flywheel)가 해자를 만든다</strong>
                                    <ul className="space-y-1.5 md:space-y-2 pl-1">
                                        <li className="flex gap-2">
                                            <span className="shrink-0 text-black font-bold">→</span>
                                            <div>
                                                <p className="mb-0 leading-snug">Flywheel 개념의 원형 <a href="https://www.aboutamazon.com/news/company-news/amazons-original-1997-letter-to-shareholders" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline ml-1">Amazon</a></p>
                                            </div>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="shrink-0 text-black font-bold">→</span>
                                            <div>
                                                <p className="mb-0 leading-snug">AI에서 네트워크 효과 = 데이터 축적 <a href="https://a16z.com/podcast/a16z-podcast-data-network-effects/" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline ml-1">a16z</a></p>
                                            </div>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="shrink-0 text-black font-bold">→</span>
                                            <div>
                                                <p className="mb-0 leading-snug">AI 경쟁력은 "지속적 데이터 학습 루프" <a href="https://www.bcg.com/publications/2026/how-leaders-build-an-ai-first-cost-advantage" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline ml-1">BCG</a></p>
                                            </div>
                                        </li>
                                    </ul>
                                </div>

                                <div className="border-t border-gray-100 pt-5 md:pt-8">
                                    <strong className="block font-medium mb-2 md:mb-3 text-black text-[15px] md:text-[16px]">3. "데이터는 원재료, 맥락은 가치 창출 기술"</strong>
                                    <ul className="space-y-1.5 md:space-y-2 pl-1">
                                        <li className="flex gap-2">
                                            <span className="shrink-0 text-black font-bold">→</span>
                                            <div>
                                                <p className="mb-0 leading-snug">데이터는 '원유'가 아니라 '정제되어야 가치 발생' <a href="https://www.weforum.org/stories/2018/01/data-is-not-the-new-oil/" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline ml-1">World Economic Forum</a></p>
                                            </div>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="shrink-0 text-black font-bold">→</span>
                                            <div>
                                                <p className="mb-0 leading-snug">데이터 = 새로운 자원 (but 활용이 중요) <a href="https://www.economist.com/leaders/2017/05/06/the-worlds-most-valuable-resource-is-no-longer-oil-but-data" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline ml-1">Economist</a></p>
                                            </div>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div className="mt-12 mb-2 text-center border-t border-gray-100 pt-8">
                                <button
                                    onClick={() => setIsModalPopupOpen(false)}
                                    className="px-12 py-3 rounded-full font-medium transition-colors bg-black text-white hover:bg-gray-800 cursor-pointer shadow-lg"
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
