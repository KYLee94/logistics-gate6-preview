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
    
    // reset scroll to top on mount when active
    const scrollRef = useRef(null);
    useEffect(() => {
        if (isActive && scrollRef.current) {
            scrollRef.current.scrollTop = 0;
            
            // To ensure intersection observers re-trigger on remount, we use keys or we just rely on component remount.
            // Since `isActive` controls visibility at MainLayout, intersection observer works exactly once when scrolling down natively.
        }
    }, [isActive]);

    return (
        <section 
            ref={scrollRef}
            className={`w-full h-full bg-[#fff] text-[#1d1d1f] flex flex-col items-center overflow-y-auto hide-scrollbar font-sans pb-[150px] transition-opacity duration-1000 ${isActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
            <div className="w-full max-w-[1200px] px-6 md:px-12 lg:px-20 pt-[15vh] md:pt-[20vh]">
                
                {/* Section 1: Hero Declaration */}
                <FadeInUp>
                    <div className="mb-8">
                        <span className="text-[13px] md:text-[15px] font-bold tracking-widest text-[#1d1d1f] uppercase border-b-[2px] border-[#1d1d1f] pb-2">
                            {lang === 'kr' ? 'GLOBAL STRATEGIC MANDATE' : 'GLOBAL STRATEGIC MANDATE'}
                        </span>
                    </div>
                </FadeInUp>

                <FadeInUp delay={100}>
                    <h2 className="text-[32px] md:text-[46px] lg:text-[56px] font-extrabold leading-[1.25] tracking-tighter mb-12 max-w-[1000px] break-keep">
                        {lang === 'kr' ? (
                            <>
                                "AI 도입은 IT 부서의 시스템 과제가 아닙니다. <br className="hidden lg:block"/>조직의 10년 생존을 결정할 '거버넌스(Governance)' 과제입니다."
                            </>
                        ) : (
                            <>
                                "Adopting AI is not an IT system task. <br className="hidden lg:block"/>It is a 'Governance' mandate that determines survival over the next decade."
                            </>
                        )}
                    </h2>
                </FadeInUp>

                <FadeInUp delay={200}>
                    <div className="w-full h-[1px] bg-[#1d1d1f] mb-12"></div>
                </FadeInUp>

                <FadeInUp delay={300}>
                    <p className="text-[17px] md:text-[20px] lg:text-[23px] font-medium leading-[1.7] md:leading-[1.8] text-[#1d1d1f] max-w-[950px] mb-[120px] md:mb-[180px] break-keep">
                        {lang === 'kr' ? (
                            <>
                                글로벌 자본 시장에서 AI는 더 이상 단순한 업무 보조 도구가 아닙니다. 독점적 데이터(Proprietary Data)를 중앙집권화하여 '해자(Moat)'를 구축하는 거대한 플랫폼 전쟁입니다.<br/><br/>
                                이 플랫폼을 누가 설계하고 통제하느냐가 향후 대체투자 운용사의 핵심 경쟁력이 됩니다. 단순한 IT 시스템의 도입이 아닌, 전사적 밸류체인을 하나로 묶는 <span className="font-extrabold text-[#1d1d1f] underline decoration-2 underline-offset-4">통합 데이터 거버넌스의 확립</span>이 필수적인 시점입니다.
                            </>
                        ) : (
                            <>
                                In the global capital market, AI is no longer a simple operational tool. It is a massive platform war to build a 'Moat' by centralizing proprietary data.<br/><br/>
                                Who designs and controls this platform will become the core competitive edge of alt-investment firms. It is no longer a simple IT rollout, but rather a necessity to establish an <span className="font-extrabold text-[#1d1d1f] underline decoration-2 underline-offset-4">integrated data governance</span> that unifies the enterprise value chain.
                            </>
                        )}
                    </p>
                </FadeInUp>

                {/* Section 2: Global Benchmarks */}
                <FadeInUp>
                    <h3 className="text-[22px] md:text-[30px] font-extrabold tracking-tight mb-10 text-[#1d1d1f]">
                        {lang === 'kr' ? '글로벌 대체투자 및 IB의 AI 플랫폼 내재화 동향' : 'Internalization Trends of AI Platforms in Global Alt-Investment & IB'}
                    </h3>
                </FadeInUp>
                
                <div className="flex flex-col border-t-2 border-[#1d1d1f] mb-[150px] md:mb-[200px]">
                    {[
                        {
                            krTitle: "EQT Partners (사모펀드) : 'Motherbrain' 플랫폼",
                            enTitle: "EQT Partners (PEF) : 'Motherbrain' Platform",
                            krStrategy: "딜 소싱 및 포트폴리오 관리를 위한 자체 AI 플랫폼 '마더브레인' 구축.",
                            enStrategy: "Built an in-house AI platform 'Motherbrain' for deal sourcing and portfolio management.",
                            krImplication: "개인의 인맥에 의존하던 딜 발굴을 시스템화하여, 전사 데이터 기반으로 투자 의사결정을 통제하는 가장 성공적인 대체투자 AI 내재화 사례.",
                            enImplication: "Systematized deal sourcing previously reliant on personal networks, controlling investment decisions based on enterprise data—the most successful native AI case in alt-investments."
                        },
                        {
                            krTitle: "Brookfield Asset Management : 'AI 가치 창출 오피스'",
                            enTitle: "Brookfield Asset Management : 'AI Value Creation Office'",
                            krStrategy: "부동산, 인프라, PEF 등 사일로화된 부서를 통합 통제하는 'AI Value Creation Office' 신설.",
                            enStrategy: "Established 'AI Value Creation Office' to centrally control siloed divisions like Real Estate, Infra, and PEF.",
                            krImplication: "AI 도입을 전담하는 '크로스펑셔널 컨트롤 타워'를 경영진 직속으로 두어, 800개 이상의 전사 AI 프로젝트의 우선순위와 자원을 강제 재배치.",
                            enImplication: "Placed a cross-functional control tower directly under executive management to forcibly reallocate priorities and resources across 800+ enterprise AI projects."
                        },
                        {
                            krTitle: "JLL (상업용 부동산) : 'JLL Falcon' 독자 OS 구축",
                            enTitle: "JLL (Commercial Real Estate) : 'JLL Falcon' OS",
                            krStrategy: "상업용 부동산 업계 최초의 자체 AI 통합 플랫폼 '팔콘' 출시.",
                            enStrategy: "Launched 'Falcon', the commercial real estate industry's first integrated in-house AI platform.",
                            krImplication: "외부 범용 AI를 쓰지 않고, 자사가 수십 년간 축적한 임대/운영/매각 '맥락 데이터'를 AI 엔진에 독점적으로 결합하여 시장 지배력 강화.",
                            enImplication: "Foregoing general external AIs, they exclusively combined decades of native leasing/operation/sale 'context data' into their AI engine to solidify market dominance."
                        },
                        {
                            krTitle: "Goldman Sachs & Morgan Stanley : 내부 데이터 통제망",
                            enTitle: "Goldman Sachs & Morgan Stanley : Internal Data Control Net",
                            krStrategy: "프론트 오피스 업무용 자체 AI Assistant 배포 및 컴플라이언스(규제) 자동 탐지 툴 내재화.",
                            enStrategy: "Deployed proprietary AI Assistants for front-office and internalized automated compliance detection tools.",
                            krImplication: "철저한 내부 데이터 보안 규정과 권한(Role) 통제 가이드라인을 시스템에 박아넣어, 예외 관리 및 리스크 통제를 자동화.",
                            enImplication: "Embedded rigorous internal data security rules and role authorization guidelines into the system, automating exception management and risk control."
                        }
                    ].map((item, idx) => (
                        <FadeInUp key={idx} delay={idx * 150}>
                            <div className="flex flex-col py-10 md:py-16 border-b p-2 md:p-8 border-[#1d1d1f] hover:bg-neutral-50 transition-colors duration-500 group">
                                <h4 className="font-extrabold text-[22px] md:text-[32px] leading-[1.3] mb-8 whitespace-pre-line tracking-tight group-hover:text-neutral-600 transition-colors duration-300">
                                    {lang === 'kr' ? item.krTitle : item.enTitle}
                                </h4>
                                <div className="flex flex-col md:flex-row md:items-start gap-8 md:gap-16">
                                    <div className="flex-1">
                                        <div className="flex items-center mb-4">
                                            <span className="font-bold text-[13px] tracking-widest uppercase border-b border-[#1d1d1f] pb-1 text-[#1d1d1f]">
                                                {lang === 'kr' ? '전략' : 'STRATEGY'}
                                            </span>
                                        </div>
                                        <p className="text-[16px] md:text-[18px] font-medium text-[#1d1d1f] leading-[1.7] break-keep">
                                            {lang === 'kr' ? item.krStrategy : item.enStrategy}
                                        </p>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center mb-4">
                                            <span className="font-bold text-[13px] tracking-widest uppercase border-b border-[#86868b] pb-1 text-[#86868b]">
                                                {lang === 'kr' ? '시사점' : 'IMPLICATION'}
                                            </span>
                                        </div>
                                        <p className="text-[16px] md:text-[18px] text-[#555] font-normal leading-[1.7] break-keep">
                                            {lang === 'kr' ? item.krImplication : item.enImplication}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </FadeInUp>
                    ))}
                </div>

                {/* Section 3: Conclusion */}
                <FadeInUp>
                    <div className="w-full flex flex-col items-center justify-center text-center mt-10">
                        <span className="inline-block border border-[#1d1d1f] px-3 py-1 text-[13px] md:text-[14px] font-bold tracking-widest text-[#1d1d1f] mb-8 bg-[#f4f4f5]">
                            IFPDP (IGIS Fund Production Data Platform)
                        </span>
                        <h2 className="text-[28px] md:text-[38px] lg:text-[44px] font-extrabold leading-[1.3] tracking-tighter mb-10 break-keep max-w-[850px] text-[#1d1d1f]">
                            {lang === 'kr' ? (
                                <>파편화된 실무 데이터를 중앙에서 통합 통제하는<br/>이지스 자체 운영체제(OS)의 도입</>
                            ) : (
                                <>Introduction of an Independent IGIS OS<br/>to Centrally Integrate Fragmented Working Data</>
                            )}
                        </h2>
                        <p className="text-[17px] md:text-[20px] text-[#1d1d1f] font-medium leading-[1.8] max-w-[800px] break-keep">
                            {lang === 'kr' ? (
                                <>
                                    글로벌 최고 수준의 투자 리스크 관리와 운영 효율성을 확보하기 위해서는, 실무자의 파편화된 스프레드시트를 전사 시스템으로 통합해야 합니다.<br/><br/>
                                    <strong>IFPDP</strong>는 글로벌 스탠다드에 입각하여 이지스의 전 주기를 하나의 통합 데이터 기반 하에 통제하는 근본적인 플랫폼 솔루션입니다.
                                </>
                            ) : (
                                <>
                                    To secure world-class investment risk management and operational efficiency, fragmented worker spreadsheets must be unified into an enterprise system.<br/><br/>
                                    <strong>IFPDP</strong> is a fundamental platform solution that controls the entire IGIS lifecycle under a single data foundation, based on global standards.
                                </>
                            )}
                        </p>
                    </div>
                </FadeInUp>

            </div>
        </section>
    );
}
