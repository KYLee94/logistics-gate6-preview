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
    
    const scrollRef = useRef(null);
    useEffect(() => {
        if (isActive && scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
    }, [isActive]);

    return (
        <section 
            ref={scrollRef}
            className={`w-full h-full bg-[#fff] text-[#1d1d1f] flex flex-col items-center overflow-y-auto hide-scrollbar font-sans pb-[150px] transition-opacity duration-1000 ${isActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
            <div className="w-full max-w-[1200px] px-6 md:px-12 lg:px-20 pt-[15vh] md:pt-[20vh]">
                
                {/* Section 1: 도입 배경 */}
                <FadeInUp>
                    <h2 className="text-[28px] md:text-[38px] lg:text-[48px] font-extrabold leading-[1.3] tracking-tighter mb-10 max-w-[1000px] break-keep text-[#1d1d1f]">
                        {lang === 'kr' ? (
                            <>글로벌 대체투자 운용사의<br className="hidden md:block"/> AI 플랫폼 내재화 동향 및 시사점</>
                        ) : (
                            <>Trends and Implications of AI Platform Internalization<br className="hidden md:block"/> in Global Alt-Investment Firms</>
                        )}
                    </h2>
                </FadeInUp>

                <FadeInUp delay={100}>
                    <div className="w-full h-[1px] bg-[#1d1d1f] mb-12"></div>
                </FadeInUp>

                <FadeInUp delay={200}>
                    <p className="text-[17px] md:text-[19px] lg:text-[21px] font-medium leading-[1.8] text-[#1d1d1f] max-w-[950px] mb-[120px] md:mb-[160px] break-keep">
                        {lang === 'kr' ? (
                            <>
                                글로벌 선도 운용사들은 AI를 단순한 업무 보조 툴이 아닌, 파편화된 내부 데이터를 통합하고 투자 프로세스를 통제하는 핵심 인프라로 내재화하고 있습니다. 이는 단순한 IT 시스템 도입이 아니라 조직 전체의 데이터 거버넌스를 재설계하는 과정이므로, 비즈니스 밸류체인 전반을 이해하고 조율할 수 있는 주체가 시스템 운영을 전담하는 추세입니다.
                            </>
                        ) : (
                            <>
                                Global leading asset managers are internalizing AI not merely as an operational support tool, but as a core infrastructure that integrates fragmented internal data and controls the investment process. Since this is not a simple IT system adoption but a redesign of the organization's enterprise data governance, the trend is for a governing body capable of understanding and orchestrating the entire business value chain to take charge of system operations.
                            </>
                        )}
                    </p>
                </FadeInUp>

                {/* Section 2: 글로벌 내재화 사례 (Grid List) */}
                <FadeInUp>
                    <div className="w-full h-[2px] bg-[#1d1d1f] mb-0"></div>
                </FadeInUp>
                
                <div className="flex flex-col mb-[120px] md:mb-[180px]">
                    {[
                        {
                            krTitle: "EQT Partners (사모펀드)",
                            enTitle: "EQT Partners (PEF)",
                            krSystem: "자체 AI 플랫폼 'Motherbrain' 구축 및 운용.",
                            enSystem: "Built and operates an in-house AI platform 'Motherbrain'.",
                            krUsage: "딜 소싱 및 포트폴리오 관리. 개별 인력에 의존하던 딜 발굴을 데이터 기반의 시스템적 의사결정으로 전환하여 전사 적용 중.",
                            enUsage: "Deal sourcing and portfolio management. Converted deal finding, previously reliant on individual personnel, into a data-driven systemic decision process applied enterprise-wide."
                        },
                        {
                            krTitle: "Brookfield Asset Management (대체투자)",
                            enTitle: "Brookfield Asset Management (Alt-Investment)",
                            krSystem: "전사 통합 컨트롤 타워 'AI Value Creation Office' 신설.",
                            enSystem: "Established an enterprise integrated control tower 'AI Value Creation Office'.",
                            krUsage: "부동산, 인프라, PEF 등 분절된 사업부의 AI 프로젝트 우선순위를 조정하고, 보유 자산의 공간/운영 데이터를 AI 학습용으로 자산화하여 통제.",
                            enUsage: "Coordinates AI project priorities across siloed divisions like real estate, infra, and PEF, and controls spatial/operational data of managed assets by capitalizing them for AI training."
                        },
                        {
                            krTitle: "JLL (상업용 부동산 서비스)",
                            enTitle: "JLL (Commercial Real Estate Services)",
                            krSystem: "상업용 부동산 전용 자체 AI 플랫폼 'JLL Falcon' 구축.",
                            enSystem: "Built a commercial real estate dedicated in-house AI platform 'JLL Falcon'.",
                            krUsage: "외부 범용 AI 대신, 자사가 축적한 임대/운영/매각 데이터를 결합하여 내부 전문가 전용 업무 파이프라인 엔진으로 활용.",
                            enUsage: "Instead of external general AIs, it combines accumulated leasing/operational/sales data to serve as an operational pipeline engine exclusively for internal experts."
                        },
                        {
                            krTitle: "Goldman Sachs & Morgan Stanley (투자은행)",
                            enTitle: "Goldman Sachs & Morgan Stanley (Investment Bank)",
                            krSystem: "내부 데이터 보안망과 결합된 사내 전용 AI Assistant 배포.",
                            enSystem: "Deployed an internal custom AI Assistant coupled with an internal data security net.",
                            krUsage: "투자 분석 및 규제 리스크 탐지 자동화. 철저한 접근 권한(Role) 통제와 데이터 보안 규정을 시스템에 내재화하여 예외 관리 수행.",
                            enUsage: "Automated investment analysis and regulatory risk detection. Performs exception management by internalizing strict access role controls and data security protocols into the system."
                        }
                    ].map((item, idx) => (
                        <FadeInUp key={idx} delay={idx * 150}>
                            <div className="flex flex-col py-10 md:py-16 border-b p-2 md:p-8 border-[#1d1d1f] hover:bg-[#fcfcfc] transition-colors duration-500 group">
                                <h4 className="font-extrabold text-[22px] md:text-[28px] leading-[1.3] mb-8 tracking-tight group-hover:text-black transition-colors duration-300">
                                    {lang === 'kr' ? item.krTitle : item.enTitle}
                                </h4>
                                <div className="flex flex-col md:flex-row md:items-start gap-8 md:gap-14">
                                    <div className="flex-1">
                                        <div className="flex items-center mb-4">
                                            <span className="font-bold text-[13px] tracking-widest uppercase border-b border-[#1d1d1f] pb-1 text-[#1d1d1f]">
                                                {lang === 'kr' ? '시스템' : 'SYSTEM'}
                                            </span>
                                        </div>
                                        <p className="text-[16px] md:text-[18px] font-medium text-[#1d1d1f] leading-[1.7] break-keep">
                                            {lang === 'kr' ? item.krSystem : item.enSystem}
                                        </p>
                                    </div>
                                    <div className="flex-[1.5]">
                                        <div className="flex items-center mb-4">
                                            <span className="font-bold text-[13px] tracking-widest uppercase border-b border-[#555] pb-1 text-[#555]">
                                                {lang === 'kr' ? '활용' : 'UTILIZATION'}
                                            </span>
                                        </div>
                                        <p className="text-[16px] md:text-[18px] text-[#333] font-normal leading-[1.7] break-keep">
                                            {lang === 'kr' ? item.krUsage : item.enUsage}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </FadeInUp>
                    ))}
                </div>

                {/* Section 3: 실무적 결론 */}
                <FadeInUp>
                    <div className="w-full flex flex-col mb-10 border-l-[3px] border-[#1d1d1f] pl-6 md:pl-10">
                        <h3 className="text-[22px] md:text-[30px] font-extrabold leading-[1.4] tracking-tight mb-6 text-[#1d1d1f]">
                            {lang === 'kr' ? 'IFPDP 도입 및 운영 체계 구축의 필요성' : 'Necessity of Introducing and Operating IFPDP'}
                        </h3>
                        <p className="text-[17px] md:text-[19px] text-[#1d1d1f] font-medium leading-[1.8] max-w-[850px] break-keep">
                            {lang === 'kr' ? (
                                <>
                                    글로벌 사례에서 확인되듯, 플랫폼의 성공적인 안착을 위해서는 데이터를 물리적으로 연결하는 '시스템'과 이를 현업에 강제하고 조율하는 '거버넌스'가 동시에 요구됩니다.<br/><br/>
                                    이지스 리얼에셋 본부의 10단계 가치사슬을 IFPDP로 통합하기 위해, 해당 시스템의 구축 및 데이터 연동 권한을 기획추진센터에 부여하여 타 부서 간의 이해관계를 객관적으로 조율하고 실무 적용을 추진하고자 합니다.
                                </>
                            ) : (
                                <>
                                    As verified by global cases, successfully establishing a platform simultaneously requires a 'system' that physically connects data and a 'governance' that enforces and orchestrates it across the field.<br/><br/>
                                    In order to integrate IGIS Real Assets division's 10-step value chain into IFPDP, we intend to grant the Strategic Planning Center the authority to build this system and link data, objectiveally coordinating interests among other departments and driving its practical application.
                                </>
                            )}
                        </p>
                    </div>
                </FadeInUp>

            </div>
        </section>
    );
}
