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
            title: "플랫폼 구축 및 AI 도입 (Parallel 트랙)",
            subtitle: "기본적으로 리얼에셋의 Datalake를 구성하고 성능 좋은 AI모델을 효율적으로 태워 AI 플랫폼으로써의 궁극적 기능을 수행합니다. 가장 핵심적인 '플랫폼 데이터 기반 확보'와 '기업용 AI 도입'은 순차적이 아닌 Parallel(병렬)로 동시 진행됩니다.",
            box1: {
                title: "1. 플랫폼 (Platform)",
                desc: "Priority가 높은 핵심 프로젝트 우선순위로 그룹 내 흩어진 정보를 취합하고, 단계별/섹터별 대시보드를 점진적으로 구축합니다. 이를 현업에 실시간 배포하여 실질적 관리 효율을 극대화합니다.",
                bullets: [
                    { label: "A", title: "통합 통계망", desc: "전체 프로젝트의 맥락별(Priority, Sector, Type) 리스팅 및 통합 통계망 배포" },
                    { label: "B", title: "코어 상세화면 전산화", desc: "자산 유형별(오피스/물류/주거 등) 맞춤형 프로젝트 코어 화면 디지털화" },
                    { label: "C", title: "독립형 센터 대시보드", desc: "센터별(투자자/기업/리테일) 본연의 역할에 몰입할 수 있는 전용 대시보드" }
                ]
            },
            box2: {
                title: "2. AI 시스템 도입",
                desc: "빅테크 AI 벤더사(OpenAI, 구글 등)와의 전략적 제휴를 맺습니다. 단순 개발을 넘어 공식 MOU 및 론칭을 통해 이지스의 '선진 기술 도입'과 '시스템 투명성'을 LP 투자자들에게 각인시켜 기업 신뢰도 회복을 앞당깁니다.",
                bullets: [
                    { label: "엔진 후보군", title: "최상위 LLM 체계 탑재", desc: "OpenAI, Google Gemini, Claude 등 검증된 대형 언어 모델 기반 아키텍처" },
                    { label: "데이터 보안 통제", title: "철통 보안의 엔터프라이즈 폐쇄망", desc: "자산의 핵심 정보가 외부 학습용으로 넘어가지 않도록 VPC 수준의 인프라 구축" },
                    { label: "초기 파일럿 검증", title: "PO 레벨 이상 보안/성능 검증", desc: "핵심 데이터 취급 담당자로 철저히 한정하여 시스템 정합성과 안정성을 검증" }
                ]
            }
        },
        en: {
            title: "Platform Build & AI Adoption (Parallel Track)",
            subtitle: "We will establish a Real Asset Datalake and efficiently integrate high-performance AI models to fulfill its ultimate role as an AI platform. The core 'Data Foundation' and 'Enterprise AI' will proceed concurrently.",
            box1: {
                title: "1. Platform",
                desc: "We prioritize gathering scattered data starting with high-priority projects and will progressively deploy stage/sector dashboards in real-time to maximize practical management efficiency.",
                bullets: [
                    { label: "A", title: "Integrated Statistics", desc: "Deploy contextual (Priority, Sector, Type) listings and statistical nets." },
                    { label: "B", title: "Digitalized Core Screens", desc: "Digitize tailored core screens categorized by asset type (Office, Logistics, etc.)." },
                    { label: "C", title: "Center Dashboards", desc: "Dedicated dashboards tailored precisely for Investors, Corporate, and Retail centers." }
                ]
            },
            box2: {
                title: "2. Enterprise AI Adoption",
                desc: "Form strategic alliances with Big Tech AI vendors. Beyond software development, we will leverage official MOUs to showcase IGIS's 'Technological Transparency', dramatically restoring trust among LP investors.",
                bullets: [
                    { label: "Engine Options", title: "Top-tier LLM Deployment", desc: "Architectures based on proven models like OpenAI, Google Gemini, and Claude." },
                    { label: "Data Security", title: "Enterprise Closed-Network", desc: "Build VPC-level infrastructure to firmly seal critical asset data from external training." },
                    { label: "Initial Pilot Phase", title: "PO-level Strict Verification", desc: "Rigorous testing of system integrity confined to high-level core data managers." }
                ]
            }
        }
    };

    const text = lang === 'kr' ? content.kr : content.en;

    return (
        <div className="w-full h-full bg-white flex flex-col items-center justify-start font-sans text-black relative px-[60px] pt-[120px] shrink-0 overflow-y-auto">
            
            <div className={`w-full max-w-[1500px] flex flex-col transition-all duration-[1200ms] transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                
                {/* Header Block  - Clean & Dry Edge */}
                <div className="w-full border-b-[4px] border-black pb-[36px] mb-[45px]">
                    <h1 className="text-[48px] md:text-[56px] font-extrabold tracking-tight uppercase font-inter leading-tight mb-[24px]">
                        {text.title}
                    </h1>
                    <p className="text-[22px] md:text-[24px] font-medium text-[#444] tracking-tight leading-[1.6] break-keep">
                        {text.subtitle}
                    </p>
                </div>

                {/* Content Block Columns - Vertical Flow */}
                <div className="flex flex-col gap-[36px] w-full pb-[100px]">
                    
                    {/* Platform Box */}
                    <div className="w-full border-b-[2px] border-[#ddd] pb-[36px]">
                        <div className="flex items-start gap-[24px] w-full">
                            {/* Left Index */}
                            <div className="w-[10px] h-[52px] bg-black mt-[12px] shrink-0"></div>
                            
                            {/* Right Content */}
                            <div className="flex-1 flex flex-col">
                                <h2 className="text-[40px] md:text-[46px] font-bold tracking-tighter mb-[22px] font-inter">
                                    {text.box1.title}
                                </h2>
                                <p className="text-[24px] font-medium text-[#222] leading-[1.6] tracking-tight mb-[40px] break-keep">
                                    {text.box1.desc}
                                </p>
                                
                                <div className="w-full border-t-[2px] border-black pt-[30px] grid grid-cols-3 gap-[40px]">
                                    {text.box1.bullets.map((bullet, idx) => (
                                        <div key={idx} className="flex flex-col">
                                            <div className="text-[15px] font-bold tracking-wider mb-[16px] border-b-[1px] border-[#bbb] pb-[10px] text-[#555] uppercase">
                                                {bullet.label}
                                            </div>
                                            <h3 className="text-[20px] font-bold text-black tracking-tight mb-[12px]">
                                                {bullet.title}
                                            </h3>
                                            <p className="text-[17px] font-normal leading-[1.6] text-[#333] tracking-tight break-keep">
                                                {bullet.desc}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI Adoption Box */}
                    <div className="w-full">
                        <div className="flex items-start gap-[24px] w-full">
                            {/* Left Index */}
                            <div className="w-[10px] h-[52px] bg-black mt-[12px] shrink-0"></div>
                            
                            {/* Right Content */}
                            <div className="flex-1 flex flex-col">
                                <h2 className="text-[40px] md:text-[46px] font-bold tracking-tighter mb-[22px] font-inter">
                                    {text.box2.title}
                                </h2>
                                <p className="text-[24px] font-medium text-[#222] leading-[1.6] tracking-tight mb-[40px] break-keep">
                                    {text.box2.desc}
                                </p>
                                
                                <div className="w-full border-t-[2px] border-black pt-[30px] grid grid-cols-3 gap-[40px]">
                                    {text.box2.bullets.map((bullet, idx) => (
                                        <div key={idx} className="flex flex-col">
                                            <div className="text-[15px] font-bold tracking-wider mb-[16px] border-b-[1px] border-[#bbb] pb-[10px] text-[#555] uppercase">
                                                {bullet.label}
                                            </div>
                                            <h3 className="text-[20px] font-bold text-black tracking-tight mb-[12px]">
                                                {bullet.title}
                                            </h3>
                                            <p className="text-[17px] font-normal leading-[1.6] text-[#333] tracking-tight break-keep">
                                                {bullet.desc}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
            
        </div>
    );
}
