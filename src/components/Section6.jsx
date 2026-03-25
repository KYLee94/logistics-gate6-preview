import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import imgJosh from '../assets/images/josh_panknin.webp';

export default function Section6({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }
        
        const t1 = setTimeout(() => setStep(1), 500); // Image fade in
        const t2 = setTimeout(() => setStep(2), 1000); // Quote text fade in
        const t3 = setTimeout(() => setStep(3), 1800); // Name and title fade in
        const t4 = setTimeout(() => setStep(4), 2800); // Underline highlight

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-black flex flex-col relative px-6 md:px-16 lg:px-24 pt-[100px] md:pt-[120px] pb-[80px] overflow-y-auto">
            
            <div className="w-full max-w-[1400px] mx-auto flex flex-col md:flex-row items-center md:items-start justify-between gap-[40px] md:gap-[80px] lg:gap-[100px] my-auto">
                
                {/* Left: Portrait Image */}
                <div 
                    className={`w-[260px] md:w-[340px] lg:w-[400px] shrink-0 overflow-hidden bg-[#1a1a1a] transition-all duration-[1500ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 1 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}
                    style={{ aspectRatio: '3 / 4' }}
                >
                    <img 
                        src={imgJosh} 
                        alt="Josh Panknin" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center text-gray-500 font-sans tracking-widest text-[13px] border border-[#333] p-4 text-center leading-relaxed"><span class="block text-white">IMAGE</span></div>';
                        }}
                    />
                </div>

                {/* Right: Quote Content */}
                <div className="flex flex-col flex-1 max-w-[850px] mt-0 md:-mt-1 lg:-mt-2">
                    
                    {/* Main Quote */}
                    <div className="overflow-visible">
                        <p 
                            className={`text-[14px] md:text-[26px] lg:text-[32px] xl:text-[35px] leading-[1.5] text-[#f4f4f5] font-light transition-all duration-[1500ms] ease-[cubic-bezier(0.19,1,0.22,1)] break-keep ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                            style={{ 
                                fontFamily: "'Guardian Sans', 'Apple SD Gothic Neo', 'Helvetica Neue', sans-serif",
                                letterSpacing: "-0.01em"
                            }}
                        >
                            {lang === 'kr' ? (
                                <>
                                    “AI 기술은 투자자뿐 아니라 운용사가 보다<br className="hidden md:block" />
                                    정확한 결정을 내릴 수 있도록 지원할 수 있으며<br className="hidden md:block" />
                                    구체적으로 AI가 부동산의 운영 효율성을 높이고,<br className="hidden md:block" />
                                    임차인 만족도를 증가시켜 결국 자산 가치를 극대화<br className="hidden md:block" />
                                    하는 중요한 도구가 될 것이라고 평가하고 있습니다.
                                    <br /><br />
                                    다만, AI 툴을 사용하기 위해서는 데이터의 정리가<br className="hidden md:block" />
                                    선행되어야 하는데 아직까지 부동산 업계는 오랜 시간<br className="hidden md:block" />
                                    쌓은 데이터들의 정리가 되지 않고 있습니다.
                                    <br /><br />
                                    현재까지 이런 데이터 정리를 하고 있는 회사들은<br className="hidden md:block" />
                                    글로벌 톱 5 정도로 앞으로 부동산 시장에서 <span 
                                        className="inline"
                                        style={{
                                            backgroundImage: 'linear-gradient(transparent 90%, #f4f4f5 90%, #f4f4f5 100%)',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: step >= 4 ? '100% 100%' : '0% 100%',
                                            transition: 'background-size 1.5s cubic-bezier(0.19, 1, 0.22, 1)'
                                        }}
                                    >데이터<br className="hidden md:block" />
                                    정리 및 분석이 가능한 회사들과 그렇지 못한 회사들의<br className="hidden md:block" />
                                    투자는 확연한 차이가 날 수 밖에 없다</span>고 보고 있습니다.”
                                </>
                            ) : (
                                <>
                                    “AI technology supports not only investors but also operators in making more accurate decisions, and it is assessed to be a crucial tool for enhancing operational efficiency, increasing tenant satisfaction, and ultimately maximizing asset value.
                                    <br /><br />
                                    However, the use of AI tools requires prior data organization, yet the real estate industry still struggles with decades of unorganized data.
                                    <br /><br />
                                    Currently, only about the top 5 global firms are undertaking such data structuring, and we anticipate <span 
                                        className="inline"
                                        style={{
                                            backgroundImage: 'linear-gradient(transparent 90%, #f4f4f5 90%, #f4f4f5 100%)',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: step >= 4 ? '100% 100%' : '0% 100%',
                                            transition: 'background-size 1.5s cubic-bezier(0.19, 1, 0.22, 1)'
                                        }}
                                    >a stark contrast in future investments between companies capable of data organization and analysis and those that are not</span>.”
                                </>
                            )}
                        </p>
                    </div>

                    {/* Name and Title (Left aligned inner text, aligned to right side of parent box) */}
                    <div 
                        className={`flex w-full mt-10 md:mt-16 lg:mt-24 transition-all duration-[1500ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                    >
                        <div className="flex flex-col text-left ml-auto w-full md:w-[65%] lg:w-[60%]">
                            <span 
                                className="text-white text-[18px] md:text-[20px] font-normal mb-1" 
                                style={{ fontFamily: "'Guardian Sans', 'Helvetica Neue', sans-serif" }}
                            >
                                Josh Panknin
                            </span>
                            <span 
                                className="text-[#e4e4e7] text-[15px] md:text-[17px] font-light tracking-wide" 
                                style={{ fontFamily: "'Guardian Sans', 'Apple SD Gothic Neo', 'Helvetica Neue', sans-serif" }}
                            >
                                {lang === 'kr' ? "Columbia Univ. 부동산 AI 연구 및 혁신 디렉터" : "Director of Real Estate AI Research & Innovation, Columbia Univ."}
                            </span>
                            <span 
                                className="text-white text-[14px] md:text-[15px] font-light tracking-wide mt-2 pt-2 border-t border-white/20" 
                                style={{ fontFamily: "'Guardian Sans', 'Apple SD Gothic Neo', 'Helvetica Neue', sans-serif" }}
                            >
                                {lang === 'kr' ? "MIPIM 2024 발표: “AI Lecture IV - Readying your business for a digital world”" : "Delivered at MIPIM 2024: “AI Lecture IV - Readying your business for a digital world”"}
                            </span>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
