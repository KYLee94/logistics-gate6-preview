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
                    기본적으로 리얼에셋의 <span className="font-extrabold">데이터레이크</span>를 구성하고 성능 좋은 AI 모델을 그 위에 태워 AI 플랫폼으로써의 궁극적 기능을 수행한다.<br />
                    가장 핵심적인 '<span className="text-[#1e3a8a] font-bold">데이터 기반 확보</span>'와 '<span className="text-[#1e3a8a] font-bold">기업용 AI 도입</span>'은 순차적이 아닌 Parallel로 동시 진행된다.
                </>
            ),
            box1: {
                title: "1. 플랫폼",
                desc: (
                    <>
                        Priority가 높은 <span className="text-[#1e3a8a] font-bold">핵심 프로젝트</span> 우선순위로 그룹 내 정보를 취합하고, <span className="text-[#1e3a8a] font-bold">단계별/섹터별 대시보드</span>를 점진적으로 구축한다.<br />
                        이를 현업에 실시간 배포하여 실무 효율을 극대화한다.
                    </>
                ),
                bullets: [
                    { label: "A", title: "통합 통계", desc: <><span className="text-[#1e3a8a] font-bold">전체 프로젝트</span>의 맥락별(Priority, Vehicle, Sector, Use, Type..) <span className="text-[#1e3a8a] font-bold">리스팅 및 통합 통계</span> 배포</> },
                    { label: "B", title: "코어 상세화면", desc: <>투자/개발/관리 자산의 유형별(오피스/물류/주거 등) 맞춤형 <span className="text-[#1e3a8a] font-bold">프로젝트 코어 화면</span> 디지털화</> },
                    { label: "C", title: "독립형 센터 대시보드", desc: <>본연의 업무에 고도화 몰입할 수 있는 <span className="text-[#1e3a8a] font-bold">센터별 전용 대시보드</span> 구축 (유저솔루션/투자자/기업 등)</> }
                ]
            },
            box2: {
                title: "2. AI 시스템 도입 방안",
                option1: {
                    title: "[1안] 빅테크 제휴망 구축 (Enterprise AI)",
                    desc: <><span className="text-[#1e3a8a] font-bold">빅테크 AI 벤더사</span>(OpenAI, 구글 등)와의 전략적 제휴를 맺는다. 단순 개발을 넘어 공식 <span className="text-[#1e3a8a] font-bold">MOU 및 론칭</span>을 통해 <span className="text-[#1e3a8a] font-bold">강력한 대외 홍보 수단</span>으로 활용한다.</>,
                    bullets: [
                        { label: "엔진 후보군", title: "최상위 LLM 탑재", desc: "OpenAI, Google Gemini 등 대형 언어 모델 활용" },
                        { label: "인프라 보안", title: "VPC 수준의 폐쇄망", desc: "자산 데이터의 외부 학습 차단을 위한 VPC 인프라 구축" },
                        { label: "접근 통제", title: "테스트 사용자 한정", desc: <><span className="text-[#1e3a8a] font-bold">PO 이상 및 핵심 데이터 취급 담당자로 한정</span>하여 검증</> }
                    ]
                },
                option2: {
                    title: "[2안] 로컬 인프라망 자체 구축 (On-Premise AI)",
                    desc: <>가장 뛰어난 보안을 위해 <span className="text-[#1e3a8a] font-bold">고용량 사내 통합 하드웨어와 로컬 오픈소스 LLM</span>을 결합한다. 외부 통신을 차단한 채 <span className="text-[#1e3a8a] font-bold">빠른 IFPDP 3단분리 적용</span>을 이루어낸다.</>,
                    bullets: [
                        { label: "하드웨어", title: "고용량 통합 서버 구비", desc: <><span className="text-[#1e3a8a] font-bold">맥미니 등 AI 구동에 최적화된 로컬 PC/서버</span> 구축</> },
                        { label: "로컬 엔진", title: "경량화 로컬 LLM", desc: "Gemma 4 등의 모델을 탑재하여 핵심 시스템에 즉각 적용" },
                        { label: "접근 보안", title: "폐쇄 웹 및 이중 통제", desc: <>사내 폐쇄망 웹에 올려 서비스하며 <span className="text-[#1e3a8a] font-bold">이용자 접근 권한을 등급별로 철저히 통제</span></> }
                    ]
                }
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
                title: "2. Enterprise AI Adoption Options",
                option1: {
                    title: "[Option 1] Big Tech Partnership (Enterprise AI)",
                    desc: "Form strategic alliances with Big Tech AI vendors. Official MOUs and launches will engrave IGIS's 'Technological Adoption' to investors, acting as a powerful PR tool.",
                    bullets: [
                        { label: "Engine", title: "Top-tier LLM", desc: "Architectures based on proven large language models like OpenAI." },
                        { label: "Security", title: "VPC Level Closed-Network", desc: "VPC infrastructure to firmly seal critical asset data from external training." },
                        { label: "Control", title: "Restricted Testing", desc: "Rigorous testing confined to PO level and core data managers." }
                    ]
                },
                option2: {
                    title: "[Option 2] On-Premise Local AI Infrastructure",
                    desc: "Combine high-capacity enterprise hardware with local open-source LLMs to create an ultimate closed network environment, quickly applying IFPDP.",
                    bullets: [
                        { label: "Hardware", title: "Integrated Local Servers", desc: "Deploy capable local machines like Mac Minis for robust edge computing." },
                        { label: "Local Engine", title: "Lightweight Local LLM", desc: "Mount models like Gemma 4 to activate the 3-tier system instantly." },
                        { label: "Access Security", title: "Closed Web Portal", desc: "Strictly manage user access tiers within internal closed network web services." }
                    ]
                }
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
                    <div className="w-full border-[8px] border-[#1e3a8a] px-[50px] pt-[40px] pb-[50px]">
                        <div className="flex items-start w-full">
                            <div className="flex-1 flex flex-col">
                                <h2 className="text-[32px] md:text-[36px] font-bold tracking-tighter mb-[13px] font-inter">
                                    {text.box1.title}
                                </h2>
                                <p className="text-[24px] font-bold text-[#444] leading-[36px] tracking-tight mb-[5px] break-keep">
                                    {text.box1.desc}
                                </p>
                                
                                <div className="w-full pt-[30px] grid grid-cols-3 gap-[40px]">
                                    {text.box1.bullets.map((bullet, idx) => (
                                        <div key={idx} className="flex flex-col">
                                            <div className="text-[17px] font-bold tracking-wider mb-[5px] pb-[10px] text-[#888] uppercase">
                                                {bullet.label}
                                            </div>
                                            <h3 className="text-[22px] font-bold text-black tracking-tight mb-[7px]">
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
                    <div className="w-full border-[8px] border-[#1e3a8a] px-[40px] md:px-[50px] pt-[30px] pb-[40px]">
                        <div className="flex flex-col w-full">
                            <h2 className="text-[32px] md:text-[36px] font-bold tracking-tighter mb-[30px] font-inter">
                                {text.box2.title}
                            </h2>

                            {/* Option 1 */}
                            <div className="mb-[40px]">
                                <h3 className="text-[26px] font-extrabold text-[#1e3a8a] mb-[10px] tracking-tight">{text.box2.option1.title}</h3>
                                <p className="text-[22px] font-bold text-[#444] leading-[34px] tracking-tight mb-[25px] break-keep">
                                    {text.box2.option1.desc}
                                </p>
                                <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-[30px]">
                                    {text.box2.option1.bullets.map((bullet, idx) => (
                                        <div key={`opt1-${idx}`} className="flex flex-col">
                                            <div className="text-[16px] font-bold tracking-wider mb-[5px] text-[#888] uppercase">
                                                {bullet.label}
                                            </div>
                                            <h4 className="text-[22px] font-bold text-black tracking-tight mb-[8px]">
                                                {bullet.title}
                                            </h4>
                                            <p className="text-[18px] font-medium leading-[28px] text-[#333] tracking-tight break-keep">
                                                {bullet.desc}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="w-[calc(100%+80px)] md:w-[calc(100%+100px)] -ml-[40px] md:-ml-[50px] h-[1px] bg-gray-300 my-[20px]"></div>

                            {/* Option 2 */}
                            <div className="mt-[40px]">
                                <h3 className="text-[26px] font-extrabold text-[#1e3a8a] mb-[10px] tracking-tight">{text.box2.option2.title}</h3>
                                <p className="text-[22px] font-bold text-[#444] leading-[34px] tracking-tight mb-[25px] break-keep">
                                    {text.box2.option2.desc}
                                </p>
                                <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-[30px]">
                                    {text.box2.option2.bullets.map((bullet, idx) => (
                                        <div key={`opt2-${idx}`} className="flex flex-col">
                                            <div className="text-[16px] font-bold tracking-wider mb-[5px] text-[#888] uppercase">
                                                {bullet.label}
                                            </div>
                                            <h4 className="text-[22px] font-bold text-black tracking-tight mb-[8px]">
                                                {bullet.title}
                                            </h4>
                                            <p className="text-[18px] font-medium leading-[28px] text-[#333] tracking-tight break-keep">
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

            {/* Bottom Gradient Overlay (Lightweight text blocker for navigation) */}
            <div className="fixed bottom-0 left-0 w-full h-[140px] bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none z-[40]"></div>
            
        </div>
    );
}
