import React, { useState, useEffect } from 'react';
import img270 from '../assets/images/270parkave.jpg';
import imgIota from '../assets/images/iotaseoul.jpg';

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
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }
        
        // Staggered presentation reveal mapped to Blackstone UI
        const t1 = setTimeout(() => setStep(1), 300);  // Title cascade
        const t2 = setTimeout(() => setStep(2), 800);  // 2-Card Comparisons slide-in
        const t3 = setTimeout(() => setStep(3), 1400); // (Legacy spacing)
        const t4 = setTimeout(() => setStep(4), 1600); // Trigger Bubble Popup & Shift Left just before cards fully settle
        const t5 = setTimeout(() => setStep(5), 2100); // 5. Bottom Vision Statement
        const t6 = setTimeout(() => setStep(6), 2600); // 6. Text Color Highlights (Red/Blue)
        
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); clearTimeout(t6); };
    }, [isActive]);

    return (
        <section className="section w-full min-h-[100vh] bg-[#fbfbfd] flex flex-col items-center justify-start relative px-6 md:px-12 pt-[80px] md:pt-[100px] pb-[100px] md:pb-[140px] overflow-y-auto">
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
                            className={`text-[40px] md:text-[56px] font-bold text-[#1d1d1f] tracking-tight leading-[1.15] transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}
                        >
                            <span className="text-[#1d4ed8]">데이터를 이해</span>하고, <br className="block md:hidden" />
                            <span className="text-[#1d4ed8]">AI와 협업</span>할 때 벌어지는 일
                        </h2>
                    </div>
                </div>

                {/* 2. Side-by-Side Comparison Grid (Step 4에서 좌측 푸시 적용) */}
                <div 
                    className={`w-full transition-transform duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 4 ? '-translate-x-4 md:-translate-x-10 lg:-translate-x-20' : 'translate-x-0'}`}
                >
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
                                    기존 외주 제작 방식
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
                                <CardItem title="의사결정 및 런칭" desc="기획-입찰-계약-제작 (3~6개월 소요)" isDark={false} isHighlighted={step >= 6} highlightClass="text-[#d92d2d]" />
                                <CardItem title="구축 비용" desc="억 단위 용역비 발생" isDark={false} isHighlighted={step >= 6} highlightClass="text-[#d92d2d]" />
                                <CardItem title="콘텐츠 업데이트" desc="대행사 경유 (평균 1~3일 소요)" isDark={false} isHighlighted={step >= 6} highlightClass="text-[#d92d2d]" />
                                <CardItem title="데이터 소유권" desc="대행사 DB 관리 (접근 권한 제한적)" isDark={false} isHighlighted={step >= 6} highlightClass="text-[#d92d2d]" />
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
                                        <span style={{ fontFamily: "'Guardian Sans', sans-serif" }}>IOTA SEOUL</span> AI 구축
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
                                    <CardItem title="의사결정 및 런칭" desc="내재인력이 AI 활용 단독 수행 (단 5일)" isDark={true} isHighlighted={step >= 6} highlightClass="text-[#3b82f6]" />
                                    <CardItem title="구축 비용" desc="0원 (도메인 비용 외 영구 면제)" isDark={true} isHighlighted={step >= 6} highlightClass="text-[#3b82f6]" />
                                    <CardItem title="콘텐츠 업데이트" desc="실시간 5분 이내 직접 즉각 수정" isDark={true} isHighlighted={step >= 6} highlightClass="text-[#3b82f6]" />
                                    <CardItem title="데이터 소유권" desc="내부 DB 실시간 축적 및 데이터 주권 확보" isDark={true} isHighlighted={step >= 6} highlightClass="text-[#3b82f6]" />
                                </div>
                            </div>
                            
                            {/* Floating Speech Bubble (Appears at Step 4 natively hovering on the right) */}
                            <div 
                                className={`absolute top-[20px] md:top-[40px] -right-[30px] md:-right-[90px] lg:-right-[260px] xl:-right-[320px] w-[300px] md:w-[380px] lg:w-[440px] bg-[#f2f7fc] p-6 md:p-9 shadow-[0_15px_40px_rgba(0,0,0,0.15)] border-[2.5px] border-[#1d1d1f] z-50 transition-all duration-[1200ms] delay-[400ms] ease-[cubic-bezier(0.19,1,0.22,1)] pointer-events-none rounded-none ${step >= 4 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'} hidden md:block`}
                            >
                                {/* Speech Bubble Arrow (Rotated box with 2 aligned borders for perfect integration) */}
                                <div className="absolute top-[56px] md:top-[64px] -left-[10px] md:-left-[12px] w-5 h-5 md:w-6 md:h-6 bg-[#f2f7fc] border-l-[2.5px] border-b-[2.5px] border-[#1d1d1f] transform rotate-45 rounded-none"></div>
                                
                                <p className="text-[#1d1d1f] text-[16px] md:text-[18px] leading-[1.45] md:leading-[1.55] break-keep font-bold mb-5">
                                    외주 제작 시, 전체 맥락을 도급자에게<br className="hidden md:block" />
                                    이해시키고 양사가 커뮤니케이션하는 데에만<br className="hidden md:block" />
                                    <strong className="font-extrabold bg-[#1d1d1f] text-white px-1">수개월의 불필요한 기간</strong>이 증발합니다.
                                </p>
                                <p className="text-[#1d1d1f] text-[16px] md:text-[18px] leading-[1.45] md:leading-[1.55] break-keep font-bold mb-5">
                                    반면 <strong className="text-[#1d4ed8] font-extrabold">내부 인력</strong>이 <strong className="font-extrabold">AI</strong>라는 무기를 직접 다루면<br className="hidden md:block" />
                                    외주 교육의 비효율이 존재하지 않으며,
                                </p>
                                <p className="text-[#1d4ed8] text-[16px] md:text-[18px] leading-[1.45] md:leading-[1.55] break-keep font-extrabold pb-1">
                                    실무 DB 실시간 축적 기반 상시 업데이트<br className="hidden md:block" />
                                    통제권을 기업이 온전히 독점합니다.
                                </p>
                            </div>
                        </div>

                    </div>
                </div>

                {/* 3. Bottom Vision Statement (Appears dynamically at end) */}
                <div 
                    className={`mt-[34px] md:mt-[50px] w-full flex justify-center items-center px-0 md:px-4 transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                >
                    <p className="text-[30px] md:text-[46px] font-bold text-center tracking-tight text-[#1d1d1f] leading-[1.25] whitespace-nowrap">
                        기획과 데이터만 내재되어 있다면, <br />
                        AI 시대에 우리가 직접 만들어내지 못할 <span className="text-[#1d4ed8]">'통합 플랫폼'</span>은 없습니다.
                    </p>
                </div>

            </div>
        </section>
    );
}
