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
                                이 플랫폼을 누가 설계하고 통제하느냐가 펀드의 수익률과 기업의 밸류에이션을 결정합니다. 기술 도입이 아닌 '조직의 룰'을 재설계하는 일이기에, 전사적 밸류체인을 조율하는 <span className="font-extrabold text-black bg-[#f4f4f5] px-2 py-0.5 ml-1 leading-none tracking-tight">[기획추진센터]</span>가 이 혁신의 운전대를 잡아야만 합니다.
                            </>
                        ) : (
                            <>
                                In the global capital market, AI is no longer a simple operational tool. It is a massive platform war to build a 'Moat' by centralizing proprietary data.<br/><br/>
                                Who designs and controls this platform determines fund returns and corporate valuation. Because it is about redesigning the 'rules of the organization' rather than mere technology adoption, the <span className="font-extrabold text-black bg-[#f4f4f5] px-2 py-0.5 ml-1 leading-none tracking-tight">[Strategic Planning Center]</span>, which orchestrates the enterprise value chain, must take the wheel of this innovation.
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t border-l border-[#1d1d1f] mb-[150px] md:mb-[200px]">
                    {[
                        {
                            krTitle: "EQT Partners (사모펀드)\n'Motherbrain' 플랫폼",
                            enTitle: "EQT Partners (PEF)\n'Motherbrain' Platform",
                            krStrategy: "딜 소싱 및 포트폴리오 관리를 위한 자체 AI 플랫폼 '마더브레인' 구축.",
                            enStrategy: "Built an in-house AI platform 'Motherbrain' for deal sourcing and portfolio management.",
                            krImplication: "개인의 인맥에 의존하던 딜 발굴을 시스템화하여, 전사 데이터 기반으로 투자 의사결정을 통제하는 가장 성공적인 대체투자 AI 내재화 사례.",
                            enImplication: "Systematized deal sourcing previously reliant on personal networks, controlling investment decisions based on enterprise data—the most successful native AI case in alt-investments."
                        },
                        {
                            krTitle: "Brookfield Asset Management\n'AI 가치 창출 오피스' 신설",
                            enTitle: "Brookfield Asset Management\n'AI Value Creation Office'",
                            krStrategy: "부동산, 인프라, PEF 등 사일로화된 부서를 통합 통제하는 'AI Value Creation Office' 신설.",
                            enStrategy: "Established 'AI Value Creation Office' to centrally control siloed divisions like Real Estate, Infra, and PEF.",
                            krImplication: "AI 도입을 전담하는 '크로스펑셔널 컨트롤 타워'를 경영진 직속으로 두어, 800개 이상의 전사 AI 프로젝트의 우선순위와 자원을 강제 재배치.",
                            enImplication: "Placed a cross-functional control tower directly under executive management to forcibly reallocate priorities and resources across 800+ enterprise AI projects."
                        },
                        {
                            krTitle: "JLL (상업용 부동산)\n'JLL Falcon' 독자 OS 구축",
                            enTitle: "JLL (Commercial Real Estate)\n'JLL Falcon' OS",
                            krStrategy: "상업용 부동산 업계 최초의 자체 AI 통합 플랫폼 '팔콘' 출시.",
                            enStrategy: "Launched 'Falcon', the commercial real estate industry's first integrated in-house AI platform.",
                            krImplication: "외부 범용 AI를 쓰지 않고, 자사가 수십 년간 축적한 임대/운영/매각 '맥락 데이터'를 AI 엔진에 독점적으로 결합하여 시장 지배력 강화.",
                            enImplication: "Foregoing general external AIs, they exclusively combined decades of native leasing/operation/sale 'context data' into their AI engine to solidify market dominance."
                        },
                        {
                            krTitle: "Goldman Sachs & Morgan Stanley\n내부 데이터 통제망",
                            enTitle: "Goldman Sachs & Morgan Stanley\nInternal Data Control Net",
                            krStrategy: "프론트 오피스 업무용 자체 AI Assistant 배포 및 컴플라이언스(규제) 자동 탐지 툴 내재화.",
                            enStrategy: "Deployed proprietary AI Assistants for front-office and internalized automated compliance detection tools.",
                            krImplication: "철저한 내부 데이터 보안 규정과 권한(Role) 통제 가이드라인을 시스템에 박아넣어, 예외 관리 및 리스크 통제를 자동화.",
                            enImplication: "Embedded rigorous internal data security rules and role authorization guidelines into the system, automating exception management and risk control."
                        }
                    ].map((item, idx) => (
                        <FadeInUp key={idx} delay={idx * 150}>
                            <div className="flex flex-col h-full border-r border-b border-[#1d1d1f] p-8 md:p-12 bg-white hover:bg-[#f4f4f5] transition-colors duration-500">
                                <h4 className="font-extrabold text-[20px] md:text-[24px] leading-[1.3] mb-8 whitespace-pre-line tracking-tight">
                                    {lang === 'kr' ? item.krTitle : item.enTitle}
                                </h4>
                                <div className="mt-auto">
                                    <div className="mb-6">
                                        <div className="flex items-center mb-3">
                                            <div className="w-[4px] h-[4px] bg-[#1d1d1f] mr-2"></div>
                                            <span className="font-bold text-[13px] tracking-widest">{lang === 'kr' ? '전략' : 'STRATEGY'}</span>
                                        </div>
                                        <p className="text-[15px] md:text-[16px] font-medium text-[#1d1d1f] leading-[1.6]">
                                            {lang === 'kr' ? item.krStrategy : item.enStrategy}
                                        </p>
                                    </div>
                                    <div>
                                        <div className="flex items-center mb-3">
                                            <div className="w-[4px] h-[4px] bg-[#86868b] mr-2"></div>
                                            <span className="font-bold text-[#86868b] text-[13px] tracking-widest">{lang === 'kr' ? '시사점' : 'IMPLICATION'}</span>
                                        </div>
                                        <p className="text-[15px] md:text-[16px] text-[#555] font-normal leading-[1.6]">
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
                        <span className="inline-block border border-[#1d1d1f] px-3 py-1 text-[13px] font-bold tracking-widest text-[#1d1d1f] mb-8 bg-[#f4f4f5]">
                            THE IGIS WAY :: IFPDP
                        </span>
                        <h2 className="text-[30px] md:text-[44px] font-extrabold leading-[1.3] tracking-tighter mb-10 break-keep max-w-[850px] text-[#1d1d1f]">
                            {lang === 'kr' ? (
                                <>글로벌 탑티어들의 전략은 명확합니다.<br/>"파편화된 엑셀을 버리고, 데이터를 통제하는 자사만의 통합 운영체제(OS)를 구축하라."</>
                            ) : (
                                <>The strategy of global top tiers is clear.<br/>"Discard fragmented spreadsheets, and build a proprietary integrated OS to control data."</>
                            )}
                        </h2>
                        <p className="text-[18px] md:text-[22px] text-[#1d1d1f] font-medium leading-[1.8] max-w-[800px] break-keep">
                            {lang === 'kr' ? (
                                <>
                                    이지스 리얼에셋 본부의 해답이 바로 <strong>[ IFPDP ]</strong> 입니다.<br/><br/>
                                    기획추진센터는 글로벌 스탠다드에 입각하여, 이 거대한 플랫폼의 거버넌스를 설계하고 10단계 가치사슬을 하나로 엮어내는 전사적 <span className="font-bold bg-[#1d1d1f] text-white px-2 py-0.5 rounded-sm mx-1">조율자(Orchestrator)</span>로서 즉각적인 실행(Action)에 돌입하겠습니다.
                                </>
                            ) : (
                                <>
                                    The answer for IGIS Real Assets division is <strong>[ IFPDP ]</strong>.<br/><br/>
                                    The Strategic Planning Center will construct the governance of this massive platform based on global standards, stepping in as an enterprise <span className="font-bold bg-[#1d1d1f] text-white px-2 py-0.5 rounded-sm mx-1">Orchestrator</span> to intertwine the 10-step value chain into immediate Action.
                                </>
                            )}
                        </p>
                    </div>
                </FadeInUp>

            </div>
        </section>
    );
}
