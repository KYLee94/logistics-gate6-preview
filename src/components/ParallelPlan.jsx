import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function ParallelPlan() {
    const { lang } = useLanguage();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const content = {
        kr: {
            title: "플랫폼 구축 및 AI 도입 계획",
            subtitle: "기본적으로 리얼에셋의 Datalake를 구성하고 그 위에 성능 좋은 AI모델을 플러그인 형태로 자유롭게 태워 AI 플랫폼으로써의 궁극적 기능을 수행합니다. 시스템 구축에 있어 가장 핵심적인 '플랫폼 데이터'와 'AI 연동'은 Parallel(병렬) 트랙으로 동시 진행됩니다.",
            box1: {
                title: "1. 플랫폼 (Platform)",
                desc: "Priority가 높은 핵심 프로젝트를 우선순위로 그룹 내 흩어진 정보를 취합하고, 단계/섹터/상황별 대시보드를 점진적으로 구축합니다. 이를 실시간으로 배포하여 즉각적인 실무 활용성과 업무 효율성을 높입니다.",
                bullets: [
                    "리얼에셋그룹 전체 프로젝트의 맥락별(Priority, Vehicle, Sector, Use, Type..) 리스팅 및 통합 통계망 구축",
                    "투자/개발/관리 자산의 유형별(오피스/물류/주거/데이터센터 등..) 프로젝트 코어 상세화면 전산화",
                    "센터별 독립 대시보드 (ex. 투자자/기업/리테일 등 센터 본연의 역할에 집중한 독립형 전문 화면 제공)"
                ]
            },
            box2: {
                title: "2. AI 시스템 도입",
                desc: "빅테크 AI 벤더사(OpenAI, 구글 등)와의 전략적 제휴를 통해 이지스 전용 AI 코어를 구축합니다. 단순 시스템 구축을 넘어 벤더사와의 공식 MOU 및 컨설팅 론칭을 기점으로, 이지스의 '초격차 선진 기술 도입'과 '시스템 투명성'을 외부 투자자(LP) 및 시장에 각인시켜 전사 신뢰도 회복을 위한 강력한 기업 홍보 및 비즈니스 레버리지 수단으로 적극 활용합니다.",
                items: [
                    { label: "AI 모델 후보", value: "OpenAI, Google Gemini, Claude 등 최상위 LLM 기반" },
                    { label: "데이터 보안 통제", value: "금융/부동산 핵심 자산 정보가 외부 AI 학습용으로 유출되지 않도록 원천 차단하는 VPC(가상 프라이빗 클라우드) 수준의 엔터프라이즈 전용 폐쇄망 생태계 구축" },
                    { label: "초기 검증 타겟", value: "PO 레벨 이상 임원진 및 각 부서별 핵심 데이터 입력 담당자로 한정하여 철저하고 엄격한 초기 시스템 보안/성능 검증" }
                ]
            }
        },
        en: {
            title: "Platform Build & AI Adoption Strategy",
            subtitle: "By establishing a Real Asset Datalake as the foundation and seamlessly integrating high-performance AI models, we construct the ultimate AI platform. The construction of the platform and AI adoption will proceed simultaneously on parallel tracks.",
            box1: {
                title: "1. Platform",
                desc: "Sequentially assemble internal group data starting with high-priority projects, and progressively build dashboards by stage/sector/situation. Deploy these natively in real-time to maximize practical usability and efficiency.",
                bullets: [
                    "Listings and comprehensive statistics of all Real Asset Group projects by context (Priority, Vehicle, Sector, Use, Type, etc.)",
                    "Digitalization of detailed project core screens categorized by asset type (Office/Logistics/Residential/Data Center, etc.)",
                    "Independent Center Dashboards (Specialized, dedicated screens tailored for Investors/Corporate/Retail centers)"
                ]
            },
            box2: {
                title: "2. AI Adoption",
                desc: "Construct an exclusive AI core for IGIS through strategic alliances with Big Tech AI vendors. Beyond mere system building, we will leverage official MOUs and consulting launches to engrave IGIS's 'Super-gap Advanced Technology Adoption' and 'System Transparency' onto LP investors. This acts as a powerful external PR and business leverage tool to restore corporate trust.",
                items: [
                    { label: "AI Candidates", value: "Top-tier LLMs including OpenAI, Google Gemini, and Claude" },
                    { label: "Data Security Architecture", value: "Strictly controlled via a VPC-level enterprise-exclusive closed-network ecosystem, fundamentally blocking any critical asset data from leaking into external AI training models." },
                    { label: "Initial Test Users", value: "Strictly restricted to PO level or higher and core data input managers from each department to ensure rigorous early security and performance verification." }
                ]
            }
        }
    };

    const text = lang === 'kr' ? content.kr : content.en;

    return (
        <div className="w-full h-screen bg-[#111110] flex flex-col items-center justify-center font-sans text-white relative overflow-hidden">
            
            {/* Background Effects */}
            <div className="absolute top-0 w-full h-[500px] bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-0"></div>
            
            {/* Main Header Container */}
            <div className={`z-10 w-full max-w-[1400px] px-10 flex flex-col items-center text-center mb-[60px] transition-all duration-1000 transform ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
                <h1 className="text-[36px] md:text-[46px] font-bold tracking-tight mb-6 font-guardian leading-tight">
                    {text.title}
                </h1>
                <p className="text-[17px] md:text-[19px] text-[#A1A1AA] max-w-[900px] leading-relaxed font-light break-keep">
                    {text.subtitle}
                </p>
            </div>

            {/* 2-Column Parallel Grid */}
            <div className={`z-10 w-full max-w-[1500px] px-10 flex relative items-stretch gap-0 transition-all duration-1000 delay-300 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                
                {/* Center PARALLEL visual bridge */}
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[80px] flex flex-col items-center justify-center z-20 pointer-events-none">
                    <div className="flex-1 w-[2px] bg-gradient-to-b from-transparent via-[#fbf167]/30 to-transparent"></div>
                    <div className="py-4 px-2 bg-[#111110] text-[#fbf167] font-bold tracking-[0.3em] text-[15px] transform rotate-90 my-8 shadow-[0_0_30px_rgba(251,241,103,0.1)] rounded-full whitespace-nowrap border border-[#fbf167]/20">
                        PARALLEL
                    </div>
                    <div className="flex-1 w-[2px] bg-gradient-to-b from-transparent via-[#fbf167]/30 to-transparent"></div>
                </div>

                {/* Left Card: Platform */}
                <div className="flex-1 bg-gradient-to-br from-[#1c1c1c] to-[#121212] border border-[#333] rounded-l-[32px] p-12 pr-[80px] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <h2 className="text-[32px] font-bold mb-6 font-inter tracking-tight flex items-center">
                        <span className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mr-4 text-[22px]">1</span>
                        {text.box1.title}
                    </h2>
                    <p className="text-[18px] text-[#E5E5E5] leading-[1.6] mb-10 font-medium break-keep">
                        {text.box1.desc}
                    </p>
                    <ul className="space-y-6">
                        {text.box1.bullets.map((bullet, idx) => (
                            <li key={idx} className="flex items-start">
                                <div className="min-w-[24px] h-[24px] rounded-full bg-[#333] text-[#86868B] flex items-center justify-center text-[12px] font-bold mr-4 mt-1 font-inter">
                                    {String.fromCharCode(97 + idx)}
                                </div>
                                <span className="text-[16px] text-[#A1A1AA] leading-relaxed break-keep group-hover:text-[#E5E5E5] transition-colors duration-300">{bullet}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Right Card: AI */}
                <div className="flex-1 bg-gradient-to-bl from-[#1c1c1c] to-[#121212] border border-[#333] border-l-0 rounded-r-[32px] p-12 pl-[80px] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-[#fbf167]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <h2 className="text-[32px] font-bold mb-6 font-inter tracking-tight flex items-center">
                        <span className="w-12 h-12 rounded-full bg-[#fbf167]/10 text-[#fbf167] flex items-center justify-center mr-4 text-[22px]">2</span>
                        {text.box2.title}
                    </h2>
                    <p className="text-[18px] text-[#E5E5E5] leading-[1.6] mb-10 font-medium break-keep">
                        {text.box2.desc}
                    </p>
                    <div className="space-y-6">
                        {text.box2.items.map((item, idx) => (
                            <div key={idx} className="flex flex-col bg-[#222]/50 p-5 rounded-2xl border border-[#333]/50 hover:bg-[#2a2a2a] transition-colors duration-300">
                                <span className="text-[14px] font-bold text-[#86868B] mb-2 font-inter tracking-tight">{item.label}</span>
                                <span className="text-[16px] text-[#E5E5E5] leading-relaxed break-keep">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
            
            {/* Bottom Gradient Overlay (Lightweight text blocker for navigation) */}
            <div className="fixed bottom-0 left-0 w-full h-[140px] bg-gradient-to-t from-[#111110] via-[#111110]/90 to-transparent pointer-events-none z-[40]"></div>
        </div>
    );
}
