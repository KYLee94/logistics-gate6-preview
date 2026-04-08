import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

const FadeInUp = ({ children, delay = 0 }) => {
    const domRef = useRef();
    const [isVisible, setVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setVisible(true);
                observer.unobserve(domRef.current);
            }
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
        
        if (domRef.current) observer.observe(domRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={domRef}
            className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
};

export default function Section16({ isActive }) {
    const { lang } = useLanguage();
    
    // Internal step logic for interactive text popup
    const [step, setStep] = useState(0);
    const stepRef = useRef(0);
    stepRef.current = step;

    // reset scroll to top on mount when active
    const scrollRef = useRef(null);
    useEffect(() => {
        if (isActive && scrollRef.current) {
            scrollRef.current.scrollTop = 0;
            setStep(0);
        }
    }, [isActive]);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }

        const handleSlideAction = (e) => {
            if (e.type === 'appSlideNext') {
                if (stepRef.current === 0) {
                    e.preventDefault();
                    setStep(1);
                }
            } else if (e.type === 'appSlidePrev') {
                if (stepRef.current === 1) {
                    e.preventDefault();
                    setStep(0);
                }
            }
        };

        window.addEventListener('appSlideNext', handleSlideAction);
        window.addEventListener('appSlidePrev', handleSlideAction);

        return () => { 
            window.removeEventListener('appSlideNext', handleSlideAction);
            window.removeEventListener('appSlidePrev', handleSlideAction);
        };
    }, [isActive]);

    const lists = [
        {
            title: "Goldman Sachs",
            krLine1: "사내 AI 랩을 주축으로 자체 개발한 GS AI Assistant를 전 세계 직원에게 배포.",
            krLine2: "오피스 업무 시간 30% 이상 단축, 외부 유출을 막기 위해 철저히 내부 보안 규정 결합된 프라이빗 플랫폼 형태 운영.",
            krLine3: <>"...하지만 더 중요한 것은 상대적으로 덜 주목받는 부분입니다. 바로 골드만삭스의 독자적인 구조화된 데이터, 즉 레전드 레이어에 저장된 30년 간의 거래 내역, 가격 모델, 위험 매개변수, 거래 상대방 기록 등에 AI 추론 기술을 적용하는 것입니다. 이는 상품화되는 모델 시장에서 결코 모방할 수 없는 자산입니다. <span className="bg-[#ffeb3b] text-[#1d1d1f]">골드만삭스는 모델 주변에 해자를 쌓는 것이 아니라, 데이터 주변에 해자를 쌓고 있는 것입니다."</span></>,
            enLine1: "Distributed their proprietary 'GS AI Assistant', developed by the internal AI lab, to employees worldwide.",
            enLine2: "Reduced office work time by over 30%, operating as a private platform tightly integrated with internal security regulations to prevent leaks.",
            enLine3: <>"...But what's more important is the relatively less highlighted aspect. It is the application of AI inference technology to Goldman Sachs' proprietary structured data—namely, 30 years of transaction history, pricing models, risk parameters, and counterparty records stored in the Legend layer. This is an asset that can never be replicated in the commoditized model market. <span className="bg-[#ffeb3b] text-[#1d1d1f]">Goldman Sachs is not building a moat around models, but building a moat around data."</span></>,
            link: "https://bankersmagazine.com/ai-banking/articles/goldman-ai-architecture/"
        },
        {
            title: "Brookfield Asset Management",
            krLine1: "전사 통합 컨트롤 타워 AI Value Creation Office 신설.",
            krLine2: "부동산, 인프라, PEF 등 분절된 사업부의 AI 프로젝트 우선순위를 조정하고, 보유 자산의 공간/운영 데이터를 AI 학습용으로 자산화하여 통제.",
            enLine1: "Established the enterprise integrated control tower 'AI Value Creation Office'.",
            enLine2: "Coordinates AI project priorities across siloed divisions like real estate, infra, and PEF, and controls spatial/operational data of managed assets for AI training.",
            link: "https://www.brookfield.com/views-news/insights/next-industrials-ai-transformation#driving-results"
        },
        {
            title: "EQT Partners",
            krLine1: "자체 AI 플랫폼 Motherbrain 구축 및 운용.",
            krLine2: "딜 소싱 및 포트폴리오 관리. 개별 인력에 의존하던 딜 발굴을 데이터 기반의 시스템적 의사결정으로 전환하여 전사 적용 중.",
            enLine1: "Built and operates the in-house AI platform 'Motherbrain'.",
            enLine2: "Deal sourcing and portfolio management. Converted deal finding, previously reliant on individual personnel, into a data-driven systemic decision process enterprise-wide.",
            link: "https://eqtgroup.com/about/motherbrain"
        },
        {
            title: "Jones Lang LaSalle",
            krLine1: "상업용 부동산 전용 AI 플랫폼 JLL Falcon 구축.",
            krLine2: "수십 년간 축적한 자체 임대, 매각, 운영 데이터를 AI 모델과 결합하여 자사 직원들만 사용할 수 있는 수백 개의 애플리케이션 구동 '엔진'으로 내재화",
            enLine1: "Built the commercial real estate dedicated AI platform 'JLL Falcon'.",
            enLine2: "Internalized as an 'engine' capable of running hundreds of applications exclusively for employees, combining decades of proprietary data with AI models.",
            link: "https://www.facebook.com/jll/videos/jll-falcon/1544548580080896/"
        }
    ];

    return (
        <section 
            ref={scrollRef}
            className={`w-full h-full bg-[#fff] text-[#1d1d1f] flex flex-col items-center overflow-y-auto hide-scrollbar font-sans pb-[150px] transition-opacity duration-1000 ${isActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
            <div className="w-full max-w-[1400px] px-6 md:px-12 lg:px-20 pt-[15vh] md:pt-[20vh] -mt-[100px]">
                
                {/* Hero Section */}
                <FadeInUp>
                    <h2 className="text-[26px] md:text-[36px] lg:text-[40px] font-extrabold leading-[1.3] tracking-tight mb-8 w-full break-keep text-[#1d1d1f] whitespace-nowrap md:whitespace-normal">
                        {lang === 'kr' ? (
                            <>
                                글로벌 선도 운용사들은 AI를 보조 툴이 아닌<br className="hidden md:block" />
                                파편화된 내부 데이터를 통합하고 투자 프로세스를 관리하는 핵심 인프라로<br className="hidden md:block" />
                                내재화하고 있습니다.
                            </>
                        ) : (
                            <>
                                Global leading asset managers are internalizing AI not merely as an operational tool, but as a core infrastructure integrating fragmented internal data to manage the investment process.
                            </>
                        )}
                    </h2>
                </FadeInUp>

                {/* Sub-hero Text */}
                <FadeInUp delay={100}>
                    <p className="text-[19px] md:text-[21px] font-bold text-[#555] leading-[1.3] w-full break-keep whitespace-nowrap md:whitespace-normal">
                        {lang === 'kr' ? (
                            <>
                                단순 IT 시스템 도입이 아니라 조직 전체의 데이터 거버넌스를 재설계하는 과정이므로, 비즈니스 밸류체인 전반을 이해하고<br className="hidden md:block"/>
                                조율할 수 있는 주체가 시스템 운영을 전담합니다.
                            </>
                        ) : (
                            <>
                                As it is a process of redesigning enterprise data governance rather than a simple IT system adoption, an entity capable of orchestrating the entire business value chain must be dedicated to system operations.
                            </>
                        )}
                    </p>
                </FadeInUp>

                <FadeInUp delay={200}>
                    <div className="w-full h-[1px] bg-[#1d1d1f] my-[52px]"></div>
                </FadeInUp>

                {/* List Section */}
                <div className="flex flex-col mb-[120px] md:mb-[180px]">
                    {lists.map((item, idx) => (
                        <div 
                            key={idx} 
                            className={`flex flex-col transition-all duration-1000 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`} 
                            style={{ transitionDelay: `${400 + idx * 150}ms`, transitionTimingFunction: 'cubic-bezier(0.19,1,0.22,1)' }}
                        >
                            <div className="flex flex-col">
                                <a 
                                    href={item.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="group flex flex-row items-center w-fit mb-4 cursor-pointer outline-none"
                                >
                                    <h3 
                                        className="text-[32px] md:text-[40px] leading-[1.2] text-[#1d1d1f] tracking-tight font-medium"
                                        style={{ fontFamily: "'Sanomat Wp', 'Sanomat Web', 'Sanomat', sans-serif" }}
                                    >
                                        <span className="relative pb-[4px] after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-[2px] after:bottom-[8px] after:left-0 after:bg-current after:origin-bottom-left after:transition-transform after:duration-300 group-hover:after:scale-x-100">
                                            {item.title}
                                        </span>
                                    </h3>
                                    <div className="ml-4 w-[28px] h-[28px] md:w-[32px] md:h-[32px] rounded-full border border-[#1d1d1f] flex shrink-0 items-center justify-center transition-all duration-300 group-hover:translate-x-1 group-hover:bg-[#1d1d1f] group-hover:text-white group-hover:border-transparent text-[#1d1d1f]">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="4" y1="12" x2="20" y2="12"></line>
                                            <polyline points="14 6 20 12 14 18"></polyline>
                                        </svg>
                                    </div>
                                </a>
                                <p className="text-[19px] md:text-[20px] font-normal text-[#555] leading-[1.3] break-keep mb-1">
                                    {lang === 'kr' ? item.krLine1 : item.enLine1}
                                </p>
                                <p className="text-[19px] md:text-[20px] font-normal text-[#555] leading-[1.3] break-keep">
                                    {lang === 'kr' ? item.krLine2 : item.enLine2}
                                </p>
                                {(item.krLine3 || item.enLine3) && (
                                    <div className="bg-[#1d1d1f] text-white p-6 md:p-8 mt-6 shadow-sm">
                                        <p className="text-[17px] md:text-[19px] font-medium leading-[1.65] break-keep">
                                            {lang === 'kr' ? item.krLine3 : item.enLine3}
                                        </p>
                                    </div>
                                )}
                            </div>
                            {idx !== lists.length - 1 && (
                                <div className="w-full h-[1px] bg-[#1d1d1f] my-[52px]"></div>
                            )}
                        </div>
                    ))}
                </div>

            </div>

            {/* Bottom Gradient Overlay (Lightweight text blocker for navigation) */}
            <div 
                className={`fixed bottom-0 left-0 w-full h-[140px] bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none z-[40] transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-0'}`}
            ></div>

            {/* Expandable Conclusion Section Triggered by User Interaction (Matching 4p, 6p Modal Overlay) */}
            <div 
                className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm transition-all duration-[800ms] ${step >= 1 ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setStep(0)}
            >
                <div 
                    className={`flex flex-col items-start justify-center text-left p-6 md:p-12 transition-transform duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 1 ? 'scale-100 translate-y-0' : 'scale-95 translate-y-12'}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <p className="text-[20px] md:text-[26px] lg:text-[32px] font-bold text-left tracking-tight text-white leading-[1.6] max-w-[1200px] break-keep">
                        {lang === 'kr' ? (
                            <>
                                데이터의 연결과 최적화는 가장 정밀한 <span className="text-[#3b82f6]">'리스크 매니지먼트'</span>이자, 강력한 <span className="text-[#3b82f6]">'자본 조달의 무기'</span>가 됩니다.<br/><br/>
                                <span className="inline-block text-gray-300 font-normal text-[17px] md:text-[22px] lg:text-[26px] leading-[1.4]">
                                파편화된 경험을 하나의 프로토콜로 통합할 때, 우리는 시장의 변동성과 잠재적 위험을 시스템으로 선제 통제할 수 있습니다.<br/>
                                낮아진 리스크는 곧 최적의 파이낸싱 금리 확보와 차별화된 우량 자산 매입으로 직결됩니다.<br/>
                                내부 데이터의 자산화와 시스템적 리스크 통제 체계(OS) 구축은 시장 지배력을 유지하기 위한 필수 전략입니다.
                                </span>
                            </>
                        ) : (
                            <>
                                The connection and optimization of data become the most precise <span className="text-[#3b82f6]">'risk management'</span> and a powerful <span className="text-[#3b82f6]">'weapon for capital sourcing'</span>.<br/><br/>
                                <span className="inline-block text-gray-300 font-normal text-[17px] md:text-[22px] lg:text-[24px] leading-[1.4]">
                                When fragmented experiences are integrated into a single protocol, we can preemptively control market volatility and potential risks through a system.<br/>
                                Lowered risk directly translates to securing optimal financing rates and acquiring differentiated prime assets.<br/>
                                Capitalizing internal data and building a systemic risk control framework (OS) are essential strategies to maintain market dominance.
                                </span>
                            </>
                        )}
                    </p>
                </div>
            </div>

        </section>
    );
}
