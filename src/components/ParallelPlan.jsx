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
            subtitle: (
                <>
                    기본적으로 리얼에셋의 Datalake를 구성하고 성능 좋은 AI모델을 그 위에 태워 AI 플랫폼으로써의 궁극적 기능을 수행합니다.<br />
                    가장 핵심적인 '데이터 기반 확보'와 '기업용 AI 도입'은 순차적이 아닌 Parallel(병렬)로 동시 진행됩니다.
                </>
            ),
            box1: {
                title: "1. 플랫폼 (Platform)",
                desc: (
                    <>
                        Priority가 높은 핵심 프로젝트 우선순위로 그룹 내 정보를 취합하고, 단계별/섹터별 대시보드를 점진적으로 구축합니다.<br />
                        이를 현업에 실시간 배포하여 실무 효율을 극대화합니다.
                    </>
                ),
                bullets: [
                    { label: "A", title: "통합 통계", desc: "전체 프로젝트의 맥락별(Priority, Vehicle, Sector, Use, Type..) 리스팅 및 통합 통계 배포" },
                    { label: "B", title: "코어 상세화면", desc: "투자/개발/관리 자산의 유형별(오피스/물류/주거 등) 맞춤형 프로젝트 코어 화면 디지털화" },
                    { label: "C", title: "독립형 센터 대시보드", desc: "센터별(유저솔루션/투자자/기업/리테일 등) 본연의 역할에 몰입할 수 있는 전용 대시보드" }
                ]
            },
            box2: {
                title: "2. AI 시스템 도입",
                desc: "빅테크 AI 벤더사(OpenAI, 구글 등)와의 전략적 제휴를 맺습니다. 단순 개발을 넘어 공식 MOU 및 론칭을 통해 이지스의 '선진 기술 도입'과 '시스템 투명성'을 투자자들에게 각인시켜 신뢰도를 높이는 강력한 대외 홍보 수단으로 활용합니다.",
                bullets: [
                    { label: "엔진 후보군", title: "최상위 LLM 체계 탑재", desc: "OpenAI, Google Gemini, Claude 등 검증된 대형 언어 모델 기반 아키텍처" },
                    { label: "데이터 보안 통제", title: "엔터프라이즈 전용 폐쇄망 생태계", desc: "자산의 핵심 정보가 외부 학습용으로 넘어가지 않도록 VPC 수준의 인프라 구축" },
                    { label: "초기 파일럿 검증", title: "테스트 사용자 성능검증", desc: "PO 이상 및 핵심 데이터 취급 담당자로 한정하여 철저한 초기 검증 및 시스템 정합성 구축" }
                ]
            }
        },
        en: {
            title: "Platform Build & AI Adoption (Parallel Track)",
            subtitle: (
                <>
                    We will establish a Real Asset Datalake and efficiently integrate high-performance AI models to fulfill its ultimate role as an AI platform.<br />
                    The core 'Data Foundation' and 'Enterprise AI' will proceed concurrently.
                </>
            ),
            box1: {
                title: "1. Platform",
                desc: (
                    <>
                        We prioritize gathering scattered data starting with high-priority projects and will progressively deploy stage/sector dashboards in real-time.<br />
                        Deploy these natively in real-time to maximize practical management efficiency.
                    </>
                ),
                bullets: [
                    { label: "A", title: "Integrated Statistics", desc: "Deploy contextual (Priority, Vehicle, Sector, Use, Type..) listings and statistical distributions." },
                    { label: "B", title: "Core Detail Screens", desc: "Digitize tailored project core screens by asset type (Office, Logistics, etc.) for Investment/Development/Management." },
                    { label: "C", title: "Independent Center Dashboards", desc: "Dedicated dashboards allowing centers (User Solution/Investors/Corporate/Retail, etc.) to immerse in their roles." }
                ]
            },
            box2: {
                title: "2. Enterprise AI Adoption",
                desc: "Form strategic alliances with Big Tech AI vendors. Beyond simple development, official MOUs and launches will engrave IGIS's 'Technological Adoption' to investors, acting as a powerful PR tool to restore trust.",
                bullets: [
                    { label: "Engine Options", title: "Top-tier LLM Deployment", desc: "Architectures based on proven models like OpenAI, Google Gemini, and Claude." },
                    { label: "Data Security", title: "Enterprise Dedicated Closed-Network", desc: "Build VPC-level infrastructure to firmly seal critical asset data from external training." },
                    { label: "Initial Pilot Phase", title: "Test User Performance Verification", desc: "Rigorous testing confined to PO level and core data managers to build system integrity." }
                ]
            }
        }
    };

    const text = lang === 'kr' ? content.kr : content.en;

    return (
        <div className="w-full h-full bg-white flex flex-col items-center justify-start font-sans text-black relative px-[60px] pt-[120px] shrink-0 overflow-y-auto">
            
            <div className={`w-full max-w-[1400px] flex flex-col transition-all duration-[1200ms] transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                
                {/* Header Block */}
                <div className="w-full pt-[20px] pb-[36px] mb-[25px]">
                    <h1 className="text-[36px] md:text-[42px] font-extrabold tracking-tight uppercase font-inter leading-tight mb-[24px]">
                        {text.title}
                    </h1>
                    <p className="text-[22px] md:text-[24px] font-bold text-[#222] tracking-tight leading-[36px] break-keep">
                        {text.subtitle}
                    </p>
                </div>

                {/* Content Block Columns - Vertical Flow */}
                <div className="flex flex-col gap-[36px] w-full pb-[100px]">
                    
                    {/* Platform Box */}
                    <div className="w-full border-[6px] border-black px-[50px] pt-[40px] pb-[50px]">
                        <div className="flex items-start w-full">
                            <div className="flex-1 flex flex-col">
                                <h2 className="text-[32px] md:text-[36px] font-bold tracking-tighter mb-[13px] font-inter">
                                    {text.box1.title}
                                </h2>
                                <p className="text-[24px] font-medium text-[#222] leading-[36px] tracking-tight mb-[5px] break-keep">
                                    {text.box1.desc}
                                </p>
                                
                                <div className="w-full pt-[30px] grid grid-cols-3 gap-[40px]">
                                    {text.box1.bullets.map((bullet, idx) => (
                                        <div key={idx} className="flex flex-col">
                                            <div className="text-[17px] font-bold tracking-wider mb-[10px] pb-[10px] text-[#888] uppercase">
                                                {bullet.label}
                                            </div>
                                            <h3 className="text-[22px] font-bold text-black tracking-tight mb-[8px]">
                                                {bullet.title}
                                            </h3>
                                            <p className="text-[19px] font-medium leading-[28px] text-[#333] tracking-tight break-keep">
                                                {bullet.desc}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI Adoption Box */}
                    <div className="w-full border-[6px] border-black px-[50px] pt-[40px] pb-[50px]">
                        <div className="flex items-start w-full">
                            <div className="flex-1 flex flex-col">
                                <h2 className="text-[32px] md:text-[36px] font-bold tracking-tighter mb-[13px] font-inter">
                                    {text.box2.title}
                                </h2>
                                <p className="text-[24px] font-medium text-[#222] leading-[36px] tracking-tight mb-[5px] break-keep">
                                    {text.box2.desc}
                                </p>
                                
                                <div className="w-full pt-[30px] grid grid-cols-3 gap-[40px]">
                                    {text.box2.bullets.map((bullet, idx) => (
                                        <div key={idx} className="flex flex-col">
                                            <div className="text-[17px] font-bold tracking-wider mb-[10px] pb-[10px] text-[#888] uppercase">
                                                {bullet.label}
                                            </div>
                                            <h3 className="text-[22px] font-bold text-black tracking-tight mb-[8px]">
                                                {bullet.title}
                                            </h3>
                                            <p className="text-[19px] font-medium leading-[28px] text-[#333] tracking-tight break-keep">
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
