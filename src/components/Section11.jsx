import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Section11({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);
    const [drawLine, setDrawLine] = useState(false);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            setDrawLine(false);
            return;
        }
        
        // 순차적 스르륵 등장을 위한 딜레이 배치 (Staggered Fade-in)
        const t1 = setTimeout(() => setStep(1), 100);  // 상단 타이틀
        const t2 = setTimeout(() => setStep(2), 400);  // 좌측 프로필 영역
        const t3 = setTimeout(() => setStep(3), 700);  // 우측 대문짝 영문 명언
        const t4 = setTimeout(() => { setStep(4); setDrawLine(true); }, 1300); // 밑줄 애니메이션 & 서브텍스트
        const t5 = setTimeout(() => setStep(5), 1600); // 하단 부가 설명 단락
        
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white flex flex-col overflow-y-auto pt-[80px] pb-[100px] md:pt-[120px] md:pb-[140px]">
            
            <div className={`w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1600px] mx-auto my-auto shrink-0 flex flex-col`}>
                
                {/* TOP HEADER (상단 타이틀 - 크기 4px 증가, 하단 여백 10px 축소) */}
                <div className={`mb-8 md:mb-14 transition-all duration-[1000ms] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <h3 className="text-[21px] md:text-[25px] lg:text-[26px] font-medium text-[#1d1d1f] tracking-tight leading-[1.4] break-keep font-sans">
                        {lang === 'kr' ? (
                            <>
                                본 IFPDP 기획 및 플랫폼 아키텍처는<br/>
                                글로벌 AI 석학 Indhran Seghar 디렉터와의 심층 논의 및 자문을 거쳐, 그 정합성과 비전을 검증받았습니다.
                            </>
                        ) : (
                            <>
                                The logic and architecture of the IFPDP have been validated for integrity and vision<br/>
                                through deep consultation with Indhran Seghar, a globally recognized AI authority.
                            </>
                        )}
                    </h3>
                </div>

                {/* MAIN GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-[4fr_6fr] gap-8 md:gap-16 lg:gap-24 items-start w-full">
                    
                    {/* LEFT COLUMN: Profile */}
                    <div className={`flex flex-col w-full transition-all duration-[1000ms] ease-out ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <div className="w-full relative pb-[80%] md:pb-[70%] lg:pb-[75%] overflow-hidden mb-4 bg-black">
                            <img 
                                src={`${import.meta.env.BASE_URL}Indhran.jpg`} 
                                alt="Indhran Seghar" 
                                className="absolute top-0 left-0 w-full h-full object-cover" 
                                style={{ objectPosition: 'center top' }}
                            />
                        </div>

                        <div className="text-[11px] md:text-[13px] lg:text-[14px] text-[#1d1d1f] font-sans leading-snug tracking-tight break-keep">
                            {/* 링크 연동 */}
                            <p className="font-bold mb-1 text-[13px] md:text-[15px]">
                                <a 
                                    href="https://www.linkedin.com.mcas.ms/in/seghar" 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="hover:text-blue-600 transition-colors underline underline-offset-[3px] decoration-gray-300 hover:decoration-blue-600"
                                >
                                    Indhran Seghar
                                </a>
                            </p>
                            
                            {lang === 'kr' ? (
                                <>
                                    <p>현) AIR APAC (싱가포르 AI 전략 자문기관 에어 에이팩) Founding Director</p>
                                    <p>전) HSBC 글로벌 서비스 트랜스포메이션 리드 (1천만 고객, 3.3만 명 임직원 대상)</p>
                                    <p>(부산시 협업, 부산 테크노파크 AI 전환 컨설팅 진행중)</p>
                                </>
                            ) : (
                                <>
                                    <p>Current: Founding Director, AIR APAC (Singapore Center for AI Readiness)</p>
                                    <p>Former: HSBC Global Service Transformation Lead (10M customers, 33K employees)</p>
                                    <p>(Currently advising Busan Techno Park on AI transformation)</p>
                                </>
                            )}
                            
                            {/* AIR APAC Logo - 원본의 70% 수준에서 추가 80%로 축소 (총 56% 수준, w-[60px] md:w-[72px]) */}
                            <div className="mt-4 w-[60px] md:w-[72px] opacity-80 mix-blend-multiply grayscale">
                                <img src={`${import.meta.env.BASE_URL}airapac.jpg`} alt="AIR APAC" className="w-full h-auto object-contain" />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: The Quotes */}
                    <div className={`flex flex-col pt-4 w-full`}>
                        
                        {/* Huge English Text - 위로 20px 이동 (-mt-[20px]), 폰트 2px 축소 */}
                        <div 
                            className={`-mt-[20px] text-[30px] md:text-[43px] lg:text-[52px] xl:text-[62px] leading-[1.15] text-[#1d1d1f] mb-8 md:mb-12 transition-all duration-[1200ms] ease-out ${step >= 3 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-[0.98]'}`}
                            style={{ 
                                fontFamily: "'Sanomat Wp', 'Sanomat Web', 'Sanomat', sans-serif",
                                fontWeight: 500,
                                letterSpacing: "-0.03em",
                                WebkitFontSmoothing: "antialiased",
                                MozOsxFontSmoothing: "grayscale",
                                textRendering: "optimizeLegibility",
                            }}
                        >
                            <span className="absolute -ml-[0.42em]">"</span>Deeply impressed by IGIS's platform vision.<br/>
                            <span 
                                className="inline"
                                style={{
                                    backgroundImage: 'linear-gradient(transparent calc(100% - 3px), #1d1d1f calc(100% - 3px), #1d1d1f 100%)',
                                    backgroundPosition: '0% 100%',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundSize: drawLine ? '100% 100%' : '0% 100%',
                                    transition: 'background-size 1200ms cubic-bezier(0.25,1,0.5,1)',
                                    paddingBottom: '2px'
                                }}
                            >
                                A perfect approach that hits the core context
                            </span><br/>
                            without the need for over-engineering."
                        </div>

                        {/* Smaller Korean Text */}
                        {lang === 'kr' && (
                            <div 
                                className={`mt-[10px] text-[17px] md:text-[20px] lg:text-[22px] font-bold text-[#86868b] leading-[1.4] tracking-tight mb-10 md:mb-16 font-sans break-keep transition-all duration-[1000ms] ease-out ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                            >
                                "이지스가 그리는 플랫폼 비전과 기획에 깊은 감명을 받았습니다.<br className="hidden md:block"/>
                                과도한 엔지니어링 없이, 문제의 본질(Context)을 명확히 꿰뚫은 완벽한 접근입니다."
                            </div>
                        )}

                        {/* Bottom Paragraph */}
                        <div 
                            className={`-mt-[10px] text-[14px] md:text-[15px] lg:text-[16px] xl:text-[17px] font-medium text-[#1d1d1f] leading-[1.65] tracking-tight font-sans break-keep transition-all duration-[1000ms] ease-out ${step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                        >
                            {lang === 'kr' ? (
                                <>
                                    <p>
                                        약 30분간 계획된 자문 미팅은 2시간을 훌쩍 넘어 마무리되었습니다.<br className="hidden xl:block"/>
                                        인드란은 이지스의 10단계 가치사슬을 데이터로 연결하려는 비전에 깊은 공감을 표했습니다. <br className="hidden xl:block"/>
                                        특히 "과도한 엔지니어링(Overly engineered) 없이, 조직이 이미 가진 문제와 데이터를 사려 깊게 활용하는 것"이 <br className="hidden xl:block"/>
                                        가장 훌륭한 플랫폼의 조건임을 확인했습니다.
                                    </p>
                                    <div className="mt-7 opacity-80 font-medium flex flex-wrap items-center gap-x-3 gap-y-2">
                                        <a href="https://www.linkedin.com/pulse/your-ai-agent-just-deleted-database-didnt-make-single-indhran-seghar-z08sc/" target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors underline underline-offset-[3px] decoration-gray-300 hover:decoration-blue-600">
                                            AI는 엔진이고, 당신은 핸들입니다.
                                        </a>
                                        <span className="text-gray-400">|</span>
                                        <a href="https://www.linkedin.com/pulse/ai-skills-gap-training-programme-closing-indhran-seghar-gk0hc/" target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors underline underline-offset-[3px] decoration-gray-300 hover:decoration-blue-600">
                                            어떤 교육도 해소하지 못하는 AI 기술 격차
                                        </a>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p>
                                        The advisory session, initially scheduled for 30 minutes, extended well past the two-hour mark.<br className="hidden xl:block"/>
                                        Indhran strongly resonated with our vision of connecting IGIS's 10-step value chain with data.<br className="hidden xl:block"/>
                                        He particularly validated that leveraging an organization's existing data and contextual problems carefully,<br className="hidden xl:block"/>
                                        without falling into the trap of being "overly engineered," is the fundamental prerequisite of a true platform.
                                    </p>
                                    <div className="mt-7 opacity-80 font-medium flex flex-wrap items-center gap-x-3 gap-y-2">
                                        <a href="https://www.linkedin.com/pulse/your-ai-agent-just-deleted-database-didnt-make-single-indhran-seghar-z08sc/" target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors underline underline-offset-[3px] decoration-gray-300 hover:decoration-blue-600">
                                            AI is the engine. You are the steering wheel.
                                        </a>
                                        <span className="text-gray-400">|</span>
                                        <a href="https://www.linkedin.com/pulse/ai-skills-gap-training-programme-closing-indhran-seghar-gk0hc/" target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors underline underline-offset-[3px] decoration-gray-300 hover:decoration-blue-600">
                                            The AI Skills Gap That No Training Programme Is Closing
                                        </a>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                </div>

            </div>

        </section>
    );
}
