import React, { useState, useEffect, useRef } from 'react';
import img270 from '../assets/images/270parkave.jpg';
import imgIota from '../assets/images/iotaseoul.jpg';
import { useLanguage } from '../context/LanguageContext';

// Comparison Item Blueprint
const CardItem = ({ title, desc, isDark, isHighlighted, highlightClass }) => (
    <div className={`flex flex-col border-t ${isDark ? 'border-white/20' : 'border-[#1d1d1f]/10'} py-3 md:py-[14px]`}>
        <span className={`text-[12px] md:text-[13px] font-bold tracking-widest uppercase mb-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} style={{ fontFamily: "'Guardian Sans', sans-serif" }}>
            {title}
        </span>
        <span className={`transition-colors duration-[1500ms] text-[15px] md:text-[18px] font-bold tracking-tight leading-[1.3] break-keep ${isHighlighted ? highlightClass : (isDark ? 'text-white' : 'text-[#1d1d1f]')}`}>
            {desc}
        </span>
    </div>
);

export default function Section4({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);
    const stepRef = useRef(0);
    stepRef.current = step;

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }
        
        // Staggered presentation reveal mapped to Blackstone UI
        const t1 = setTimeout(() => setStep(1), 300);  // Title cascade
        const t2 = setTimeout(() => setStep(2), 800);  // 2-Card Comparisons slide-in
        const t3 = setTimeout(() => setStep(3), 1100); // (Legacy interval bypassed)
        const t4 = setTimeout(() => setStep(4), 1300); // Trigger Bubble Popup *MID-FLIGHT* (during pincer slides)
        const t5 = setTimeout(() => setStep(5), 1800); // Text Color Highlights (Red/Blue)

        const nextAction = (e) => {
            if (e.type === 'appSlideNext') {
                if (stepRef.current >= 5 && stepRef.current < 6) {
                    e.preventDefault(); // Intercept and block slide change
                    setStep(6); // Trigger the bottom vision text
                }
            }
        };

        window.addEventListener('appSlideNext', nextAction);
        
        return () => { 
            clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5);
            window.removeEventListener('appSlideNext', nextAction);
        };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white flex flex-col items-center justify-start relative px-6 md:px-12 pt-[80px] md:pt-[100px] pb-[100px] md:pb-[140px] overflow-y-auto">
            <div className="w-full max-w-[1340px] flex flex-col z-10 shrink-0 my-auto">
                
                {/* 1. Header Title Sequence (중앙정렬 및 자간 조정) */}
                <div className="flex flex-col items-center text-center mb-[44px]">
                    <div className="overflow-hidden mb-[8px]">
                        <span 
                            className={`block text-gray-500 text-[15px] md:text-[18px] transition-all duration-[1000ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
                            style={{ fontFamily: "'Guardian Sans', sans-serif" }}
                        >
                            Case Study : Agile Launching & Data Sovereignty
                        </span>
                    </div>
                    <div className="overflow-hidden">
                        <h2 
                            className={`text-[36px] md:text-[52px] font-bold text-[#1d1d1f] tracking-tight leading-[1.15] transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}
                        >
                            {lang === 'kr' ? (
                                <>
                                    <span className="text-[#1d4ed8]">데이터를 이해</span>하고, <br className="block md:hidden" />
                                    <span className="text-[#1d4ed8]">AI와 협업</span>할 때 가능해지는 일
                                </>
                            ) : (
                                <>
                                    What becomes possible when we <br className="block md:hidden" />
                                    <span className="text-[#1d4ed8]">Understand Data</span> and <br className="hidden md:block"/>
                                    <span className="text-[#1d4ed8]">Collaborate with AI</span>
                                </>
                            )}
                        </h2>
                    </div>
                </div>

                {/* 2. Side-by-Side Comparison Grid (좌측 밀림 고정 배치) */}
                <div className="w-full -translate-x-4 md:-translate-x-10 lg:-translate-x-20">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-[10px] md:gap-[22px]">

                        {/* Left: Traditional Outsourcing (White theme) */}
                        <div 
                            className={`flex flex-col bg-white border border-gray-200 p-6 md:p-10 mx-[15px] shadow-sm transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 2 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-[50px] md:-translate-x-[100px]'}`}
                        >
                            <div className="flex flex-col mb-2 md:mb-3">
                                <span className="text-gray-400 text-[12px] md:text-[14px] font-bold tracking-widest uppercase mb-1" style={{ fontFamily: "'Guardian Sans', sans-serif" }}>
                                    Traditional Agency Way
                                </span>
                                <h3 className="text-[28px] md:text-[40px] font-bold text-[#1d1d1f] tracking-tight leading-none mb-4">
                                    {lang === 'kr' ? "기존 외주 제작 방식" : "Traditional Agency Production"}
                                </h3>
                                {/* Thumbnail Image & Link Wrapper */}
                                <a 
                                    href="https://270parkave.com/" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex flex-col group cursor-pointer w-full outline-none"
                                >
                                    <div className="w-full h-[80px] md:h-[120px] lg:h-[135px] overflow-hidden mb-1 shadow-sm border border-gray-200 relative">
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 z-10 w-full h-full flex items-center justify-center">
                                            <span className="text-white opacity-0 group-hover:opacity-100 font-bold transition-opacity tracking-widest font-sans drop-shadow-md">VISIT SITE</span>
                                        </div>
                                        <img src={img270} alt="기존 제작 방식 - 270parkave" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                    </div>
                                    <div 
                                        className="flex items-center justify-start w-full mt-3 text-[13px] md:text-[15px] font-normal text-[#1d1d1f] transition-all tracking-wide"
                                        style={{ fontFamily: "'Guardian Sans', sans-serif" }}
                                    >
                                        <span className="relative pb-0 after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-[1.5px] after:bottom-0 after:left-0 after:bg-current after:origin-bottom-left after:transition-transform after:duration-300 group-hover:after:scale-x-100">Go to homepage</span>
                                        <div className="ml-3 w-[26px] h-[26px] rounded-full border border-[#1d1d1f] flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="4" y1="12" x2="20" y2="12"></line>
                                                <polyline points="14 6 20 12 14 18"></polyline>
                                            </svg>
                                        </div>
                                    </div>
                                </a>
                            </div>
                            
                            <div className="flex flex-col mt-auto pb-0">
                                <CardItem title={lang === 'kr' ? "의사결정 및 런칭" : "Decision & Launch"} desc={lang === 'kr' ? "기획-입찰-계약-제작 (3~6개월 소요)" : "Plan-Bid-Contract-Build (3~6 months)"} isDark={false} isHighlighted={step >= 5} highlightClass="text-[#d92d2d]" />
                                <CardItem title={lang === 'kr' ? "구축 비용" : "Deployment Cost"} desc={lang === 'kr' ? "억 단위 용역비 발생" : "Millions of dollars incurred"} isDark={false} isHighlighted={step >= 5} highlightClass="text-[#d92d2d]" />
                                <CardItem title={lang === 'kr' ? "콘텐츠 업데이트" : "Content Update"} desc={lang === 'kr' ? "대행사 경유 (평균 1~3일 소요)" : "Via agency (1~3 days average delay)"} isDark={false} isHighlighted={step >= 5} highlightClass="text-[#d92d2d]" />
                                <CardItem title={lang === 'kr' ? "데이터 소유권" : "Data Sovereignty"} desc={lang === 'kr' ? "대행사 DB 관리 (접근 권한 제한적)" : "Managed by agency (restricted access)"} isDark={false} isHighlighted={step >= 5} highlightClass="text-[#d92d2d]" />
                            </div>
                        </div>

                        {/* Right: AI-Driven Internalization (Dark theme highlighting effectiveness / Floating Bubble base) */}
                        <div className="relative">
                            <div 
                                className={`flex flex-col bg-[#1d1d1f] p-6 md:p-10 mx-[15px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] h-full overflow-hidden group transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 2 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-[50px] md:translate-x-[100px]'}`}
                            >
                                {/* Subtle background glow effect */}
                                <div className="absolute inset-0 bg-gradient-to-br from-[#ffffff10] to-transparent pointer-events-none"></div>

                                <div className="flex flex-col mb-2 md:mb-3 relative z-10">
                                    <span className="text-[#3b82f6] text-[12px] md:text-[14px] font-bold tracking-widest uppercase mb-1" style={{ fontFamily: "'Guardian Sans', sans-serif" }}>
                                        AI-Driven Internalization
                                    </span>
                                    <h3 className="text-[28px] md:text-[40px] font-bold text-white tracking-tight leading-none mb-4">
                                        <span style={{ fontFamily: "'Guardian Sans', sans-serif" }}>IOTA SEOUL</span> {lang === 'kr' ? "AI 구축" : "AI Production"}
                                    </h3>
                                    {/* Thumbnail Image & Link Wrapper */}
                                    <a 
                                        href="https://iotaseoul.site/" 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="flex flex-col group cursor-pointer w-full relative z-10 outline-none"
                                    >
                                        <div className="w-full h-[80px] md:h-[120px] lg:h-[135px] overflow-hidden mb-1 shadow-sm border border-white/10 relative">
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 z-10 w-full h-full flex items-center justify-center">
                                                <span className="text-white opacity-0 group-hover:opacity-100 font-bold transition-opacity tracking-widest font-sans drop-shadow-md">VISIT SITE</span>
                                            </div>
                                            <img src={imgIota} alt="AI 구축 사례 - IOTA SEOUL" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                        </div>
                                        <div 
                                            className="flex items-center justify-start w-full mt-3 text-[13px] md:text-[15px] font-normal text-white transition-all tracking-wide"
                                            style={{ fontFamily: "'Guardian Sans', sans-serif" }}
                                        >
                                            <span className="relative pb-0 after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-[1.5px] after:bottom-0 after:left-0 after:bg-current after:origin-bottom-left after:transition-transform after:duration-300 group-hover:after:scale-x-100">Go to homepage</span>
                                            <div className="ml-3 w-[26px] h-[26px] rounded-full border border-white flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="4" y1="12" x2="20" y2="12"></line>
                                                    <polyline points="14 6 20 12 14 18"></polyline>
                                                </svg>
                                            </div>
                                        </div>
                                    </a>
                                </div>
                                
                                <div className="flex flex-col mt-auto pb-0 relative z-10">
                                    <CardItem title={lang === 'kr' ? "의사결정 및 런칭" : "Decision & Launch"} desc={lang === 'kr' ? "내재인력이 AI 활용 단독 수행 (단 5일)" : "Exclusively internal AI leveraging (5 Days)"} isDark={true} isHighlighted={step >= 5} highlightClass="text-[#3b82f6]" />
                                    <CardItem title={lang === 'kr' ? "구축 비용" : "Deployment Cost"} desc={lang === 'kr' ? "0원 (도메인 비용 외 영구 면제)" : "$0 (Free permanently excluding domain)"} isDark={true} isHighlighted={step >= 5} highlightClass="text-[#3b82f6]" />
                                    <CardItem title={lang === 'kr' ? "콘텐츠 업데이트" : "Content Update"} desc={lang === 'kr' ? "실시간 5분 이내 직접 즉각 수정" : "Instant internal modification within 5 mins"} isDark={true} isHighlighted={step >= 5} highlightClass="text-[#3b82f6]" />
                                    <CardItem title={lang === 'kr' ? "데이터 소유권" : "Data Sovereignty"} desc={lang === 'kr' ? "내부 DB 실시간 축적 및 데이터 주권 확보" : "Real-time internal DB metrics & Data Sovereignty"} isDark={true} isHighlighted={step >= 5} highlightClass="text-[#3b82f6]" />
                                </div>
                            </div>
                            
                            {/* Floating Speech Bubble (Appears at Step 4 natively hovering on the right) */}
                            <div 
                                className={`absolute top-[20px] md:top-[40px] -right-[30px] md:-right-[90px] lg:-right-[260px] xl:-right-[320px] w-[300px] md:w-[380px] lg:w-[440px] bg-white p-6 md:p-9 shadow-[0_15px_40px_rgba(0,0,0,0.15)] border-[2.5px] border-[#1d1d1f] z-50 transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] pointer-events-none rounded-none ${step >= 4 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'} hidden md:block`}
                            >
                                {/* Speech Bubble Arrow (Rotated box with 2 aligned borders for perfect integration) */}
                                <div className="absolute top-[56px] md:top-[64px] -left-[10px] md:-left-[12px] w-5 h-5 md:w-6 md:h-6 bg-white border-l-[2.5px] border-b-[2.5px] border-[#1d1d1f] transform rotate-45 rounded-none"></div>
                                
                                <p className="text-[#1d1d1f] text-[16px] md:text-[18px] leading-[1.45] md:leading-[1.55] break-keep font-bold mb-5">
                                    {lang === 'kr' ? (
                                        <>
                                            외주 제작 시, 전체 맥락을 도급자에게<br className="hidden md:block" />
                                            이해시키고 양사가 커뮤니케이션하는 데에만<br className="hidden md:block" />
                                            <strong className="font-extrabold bg-[#1d1d1f] text-white px-1">수개월의 불필요한 기간</strong>이 증발합니다.
                                        </>
                                    ) : (
                                        <>
                                            When outsourcing, merely making contractors<br className="hidden md:block" />
                                            understand the full context and communicating back-and-forth<br className="hidden md:block" />
                                            evaporates <strong className="font-extrabold bg-[#1d1d1f] text-white px-1">months of unnecessary time</strong>.
                                        </>
                                    )}
                                </p>
                                <p className="text-[#1d1d1f] text-[16px] md:text-[18px] leading-[1.45] md:leading-[1.55] break-keep font-bold mb-5">
                                    {lang === 'kr' ? (
                                        <>
                                            반면 <strong className="text-[#1d4ed8] font-extrabold">내부 인력</strong>이 <strong className="font-extrabold">AI</strong>라는 무기를 직접 다루면<br className="hidden md:block" />
                                            외주 소통의 비효율이 존재하지 않으며,
                                        </>
                                    ) : (
                                        <>
                                            Conversely, if <strong className="text-[#1d4ed8] font-extrabold">internal talent</strong> directly wields <strong className="font-extrabold">AI</strong> as a weapon,<br className="hidden md:block" />
                                            the inefficiencies of external communication vanish entirely,
                                        </>
                                    )}
                                </p>
                                <p className="text-[#1d4ed8] text-[16px] md:text-[18px] leading-[1.45] md:leading-[1.55] break-keep font-extrabold mb-5">
                                    {lang === 'kr' ? (
                                        <>
                                            프로덕트 기획자의 역량과 AI 시너지가<br className="hidden md:block" />
                                            로스 없이 자산에 고스란히 반영됩니다.
                                        </>
                                    ) : (
                                        <>
                                            allowing the capabilities of product planners and AI synergy<br className="hidden md:block" />
                                            to be flawlessly reflected into corporate assets without loss.
                                        </>
                                    )}
                                </p>
                                <p className="text-[#1d4ed8] text-[16px] md:text-[18px] leading-[1.45] md:leading-[1.55] break-keep font-extrabold pb-1">
                                    {lang === 'kr' ? (
                                        <>
                                            실무 DB 실시간 축적 기반 상시 업데이트<br className="hidden md:block" />
                                            통제권을 기업이 온전히 독점합니다.
                                        </>
                                    ) : (
                                        <>
                                            The enterprise retains full exclusive control<br className="hidden md:block" />
                                            over continuous updates driven by real-time production DB accumulation.
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>

                    </div>
                </div>

                {/* 3. Bottom Vision Statement (Appears dynamically at end) */}
                <div 
                    className={`w-full flex justify-center items-center px-0 md:px-4 transition-all duration-[1800ms] ease-[cubic-bezier(0.19,1,0.22,1)] overflow-hidden ${step >= 6 ? 'opacity-100 mt-[60px] md:mt-[80px] max-h-[300px] translate-y-0' : 'opacity-0 mt-0 max-h-0 translate-y-12'}`}
                >
                    <p className="text-[36px] md:text-[52px] font-bold text-center tracking-tight text-[#1d1d1f] leading-[1.25] whitespace-nowrap pt-[5px]">
                        {lang === 'kr' ? (
                            <>
                                기획과 데이터만 내재되어 있다면, <br />
                                AI 시대에 우리가 직접 만들어내지 못할 <span className="text-[#1d4ed8]">'통합 플랫폼'</span>은 없습니다.
                            </>
                        ) : (
                            <>
                                As long as planning and data are internalized, <br />
                                there is no <span className="text-[#1d4ed8]">'integrated platform'</span> we cannot physically build in the AI era.
                            </>
                        )}
                    </p>
                </div>

            </div>
        </section>
    );
}
