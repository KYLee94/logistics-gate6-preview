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
        }
    }, [isActive]);

    const lists = [
        {
            title: "Goldman Sachs",
            krLine1: "사내 AI 랩을 주축으로 자체 개발한 GS AI Assistant를 전 세계 직원에게 배포.",
            krLine2: "오피스 업무 시간 30% 이상 단축, 외부 유출을 막기 위해 철저히 내부 보안 규정 결합된 프라이빗 플랫폼 형태 운영.",
            enLine1: "Distributed their proprietary 'GS AI Assistant', developed by the internal AI lab, to employees worldwide.",
            enLine2: "Reduced office work time by over 30%, operating as a private platform tightly integrated with internal security regulations to prevent leaks."
        },
        {
            title: "Jones Lang LaSalle",
            krLine1: "상업용 부동산 전용 AI 플랫폼 JLL Falcon 구축.",
            krLine2: "수십 년간 축적한 자체 임대, 매각, 운영 데이터를 AI 모델과 결합하여 자사 직원들만 사용할 수 있는 수백 개의 애플리케이션 구동 '엔진'으로 내재화",
            enLine1: "Built the commercial real estate dedicated AI platform 'JLL Falcon'.",
            enLine2: "Internalized as an 'engine' capable of running hundreds of applications exclusively for employees, combining decades of proprietary data with AI models."
        },
        {
            title: "Brookfield Asset Management",
            krLine1: "전사 통합 컨트롤 타워 AI Value Creation Office 신설.",
            krLine2: "부동산, 인프라, PEF 등 분절된 사업부의 AI 프로젝트 우선순위를 조정하고, 보유 자산의 공간/운영 데이터를 AI 학습용으로 자산화하여 통제.",
            enLine1: "Established the enterprise integrated control tower 'AI Value Creation Office'.",
            enLine2: "Coordinates AI project priorities across siloed divisions like real estate, infra, and PEF, and controls spatial/operational data of managed assets for AI training."
        },
        {
            title: "EQT Partners",
            krLine1: "자체 AI 플랫폼 Motherbrain 구축 및 운용.",
            krLine2: "딜 소싱 및 포트폴리오 관리. 개별 인력에 의존하던 딜 발굴을 데이터 기반의 시스템적 의사결정으로 전환하여 전사 적용 중.",
            enLine1: "Built and operates the in-house AI platform 'Motherbrain'.",
            enLine2: "Deal sourcing and portfolio management. Converted deal finding, previously reliant on individual personnel, into a data-driven systemic decision process enterprise-wide."
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
                    <h2 className="text-[28px] md:text-[38px] lg:text-[42px] font-extrabold leading-[1.4] tracking-tight mb-8 max-w-[1000px] break-keep text-[#1d1d1f]">
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
                    <p className="text-[19px] md:text-[21px] font-bold text-[#86868b] leading-[1.45] max-w-[900px] break-keep">
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
                    <div className="w-full h-[2px] bg-[#1d1d1f] mt-[58px] mb-[70px] md:mb-[90px]"></div>
                </FadeInUp>

                {/* List Section */}
                <div className="flex flex-col mb-[120px] md:mb-[180px]">
                    {lists.map((item, idx) => (
                        <FadeInUp key={idx} delay={200 + idx * 150}>
                            <div className="flex flex-col hover:bg-neutral-50 transition-colors duration-500">
                                <h3 
                                    className="text-[32px] md:text-[40px] leading-[1.2] mb-4 text-[#1d1d1f] tracking-tight font-medium"
                                    style={{ fontFamily: "'Sanomat Wp', 'Sanomat Web', 'Sanomat', sans-serif" }}
                                >
                                    {item.title}
                                </h3>
                                <p className="text-[19px] md:text-[20px] font-bold text-[#555] leading-[1.45] break-keep mb-1">
                                    {lang === 'kr' ? item.krLine1 : item.enLine1}
                                </p>
                                <p className="text-[19px] md:text-[20px] font-bold text-[#86868b] leading-[1.45] break-keep">
                                    {lang === 'kr' ? item.krLine2 : item.enLine2}
                                </p>
                            </div>
                            {idx !== lists.length - 1 && (
                                <div className="w-full h-[1px] bg-[#1d1d1f] my-[42px]"></div>
                            )}
                        </FadeInUp>
                    ))}
                </div>

            </div>
        </section>
    );
}
