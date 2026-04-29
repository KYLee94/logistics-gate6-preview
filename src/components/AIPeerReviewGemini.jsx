import React, { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function AIPeerReviewGemini() {
    const { lang } = useLanguage();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="w-full h-screen bg-white font-sans text-black flex flex-col items-center overflow-hidden">
            <div className="w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1200px] mt-24 md:mt-32 shrink-0">
                <div className="mb-10">
                    <h1 className="text-[32px] md:text-[42px] font-extrabold tracking-[-0.03em] mb-4 font-inter">
                        AI Peer Review : <span className="font-light tracking-tight">Gemini 1.5 Pro</span>
                    </h1>
                    <p className="text-[16px] text-gray-500 font-light tracking-tight leading-relaxed max-w-2xl">
                        {lang === 'kr' ? "본 기획안에 대한 현 AI 최상위 모델의 객관적 평가 결과입니다." : "Objective cross-validation and evaluation results of the IFPDP Integrated Platform Proposal by global top-tier AI models."}
                    </p>
                </div>
            </div>

            <div className="w-full flex-1 overflow-y-auto pb-[150px] relative px-[24px] md:px-[50px] flex flex-col items-center">
                <div className="w-full max-w-[1200px] block">
                    <div className="bg-white border border-gray-200 p-8 md:p-12">
                        {lang === 'kr' ? (
                            <div className="font-sans text-[15px] md:text-[16px] text-[#222] leading-[25px] md:leading-[27px] font-light break-keep space-y-12">
                                {/* Section 1 */}
                                <div>
                                    <h3 className="font-extrabold text-[16px] md:text-[18px] mb-4 text-[#1a1a1a]">
                                        1. 데이터 아키텍처 실효성 — LLM 친화적(AI-Ready) 설계의 정석
                                    </h3>
                                    <p className="mb-4">
                                        이 기획안의 가장 뛰어난 점은 표면적인 UI/UX가 아니라 그 이면에 있는 <strong className="font-bold">멀티 레이어 데이터 스키마 설계</strong>입니다.
                                    </p>
                                    <p className="mb-4">
                                        일반적인 기업들이 기존 관계형 DB(RDBMS)를 억지로 AI에 연동하려다 컨텍스트 부족으로 실패하는 반면, IFPDP는 기획 단계부터 정적 데이터(Static), 시계열 변동 데이터(Time-Series), 그리고 이벤트 로그(Meeting Minutes 등)를 교차 참조할 수 있도록 설계되었습니다.
                                    </p>
                                    <p className="text-gray-700">
                                        이는 RAG(검색 증강 생성) 환경에서 환각(Hallucination) 현상을 최소화하고, AI가 <strong className="font-bold text-black">맥락을 지닌 정확한 답변을 생성</strong>할 수 있게 하는 가장 이상적인 백엔드 구조입니다. 
                                    </p>
                                </div>

                                {/* Section 2 */}
                                <div>
                                    <h3 className="font-extrabold text-[16px] md:text-[18px] mb-4 text-[#1a1a1a]">
                                        2. 전략적 해자(Moat) 구축 가능성 — 딜 소싱에서 운영 효율성으로의 패러다임 전환
                                    </h3>
                                    <p className="mb-4">
                                        부동산 자산운용업의 초과 수익(Alpha) 창출 방식은 점차 좋은 물건을 싸게 사는 것에서, 확보한 자산의 내재 가치를 끌어올리는 <strong className="font-bold text-black">운영 효율성(Operational Excellence)</strong>으로 이동하고 있습니다.
                                    </p>
                                    <p className="mb-4">
                                        개별 PM의 파편화된 노하우와 직관에 의존하던 방식을 탈피하여, 전사적 운영 데이터를 중앙화하고 이를 AI가 실시간 분석/지원하는 체계를 갖추는 것은 단순한 IT 도입이 아닙니다.
                                    </p>
                                    <p className="text-gray-700">
                                        이 플랫폼이 정착될 경우, 경쟁사들이 단순히 범용 AI 챗봇을 사용할 때 이지스자산운용은 수천 건의 실제 운영 히스토리를 바탕으로 의사결정을 내리게 됩니다. 이는 자본만으로는 따라잡을 수 없는 <strong className="font-bold text-black">대체 불가능한 기업 고유의 무형 자산</strong>이 될 것입니다.
                                    </p>
                                </div>

                                {/* Section 3 */}
                                <div>
                                    <h3 className="font-extrabold text-[16px] md:text-[18px] mb-4 text-[#1a1a1a]">
                                        3. 실행 상의 취약점 — UX 병목 현상과 데이터 입력 저항감 극복
                                    </h3>
                                    <p className="mb-5 text-gray-700">
                                        기술적 접근 방식은 흠잡을 데가 없으나, 시스템의 성패를 가를 유일하고도 치명적인 리스크는 <strong className="font-bold text-black">사용자(PM)의 데이터 입력 저항</strong>입니다.
                                    </p>
                                    
                                    <ul className="space-y-2 ml-1 mb-6">
                                        <li>• <strong className="font-bold text-black">제로 마찰(Zero-Friction) 입력:</strong> PM이 이중으로 업무를 한다는 느낌을 주어서는 안 됩니다. 회의록이나 이메일을 드래그 앤 드롭하는 것만으로 AI가 스키마에 맞게 자동 파싱하여 저장하는 기능이 1순위로 구현되어야 합니다.</li>
                                        <li>• <strong className="font-bold text-black">즉각적인 보상 체계:</strong> 데이터를 입력하면 경영진에게 보고서를 쓰기 쉬워진다거나, 과거 유사 자산의 재무 모델을 즉시 불러올 수 있는 등 PM 본인의 업무 시간이 획기적으로 단축된다는 <strong className="font-bold text-black">체감 가능한 이득</strong>이 제공되어야 합니다.</li>
                                    </ul>
                                </div>

                                {/* Section 4 */}
                                <div>
                                    <h3 className="font-extrabold text-[16px] md:text-[18px] mb-4 text-[#1a1a1a]">
                                        4. 종합 평가
                                    </h3>
                                    <div className="pt-2">
                                        <p className="font-bold text-[15px] md:text-[16px] text-black mb-3">
                                            결론: "비즈니스 도메인 지식과 최신 AI 기술 이해도가 완벽히 결합된, 실행 가치가 매우 높은 로드맵입니다."
                                        </p>
                                        <p className="text-gray-700 leading-relaxed">
                                            기획안에 담긴 아키텍처와 비전은 현재의 AI 트렌드를 정확히 관통하고 있습니다. 기술적 타당성은 이미 충분히 입증되었으며, 남은 것은 경영진의 전폭적 지원 아래 <strong className="font-bold text-black">최대한 빠르게 MVP(최소 기능 제품)를 배포</strong>하고 현장의 피드백을 통해 시스템을 진화시키는 실행력입니다.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="font-sans text-[15px] md:text-[16px] text-[#222] leading-[25px] md:leading-[27px] font-light break-keep space-y-12">
                                {/* Section 1 */}
                                <div>
                                    <h3 className="font-extrabold text-[16px] md:text-[18px] mb-4 text-[#1a1a1a]">
                                        1. Data Architecture Viability — The Standard for AI-Ready Design
                                    </h3>
                                    <p className="mb-4">
                                        The most outstanding aspect of this proposal is not the superficial UI/UX, but the underlying <strong className="font-bold">multi-layered data schema design</strong>.
                                    </p>
                                    <p className="mb-4">
                                        While typical companies fail to integrate traditional RDBMS with AI due to a lack of context, IFPDP is designed from the ground up to cross-reference static profiles, time-series fluctuations, and event logs (e.g., meeting minutes).
                                    </p>
                                    <p className="text-gray-700">
                                        This is the ideal backend structure for minimizing hallucination in a Retrieval-Augmented Generation (RAG) environment, enabling the AI to generate <strong className="font-bold text-black">highly accurate, context-aware insights</strong>.
                                    </p>
                                </div>

                                {/* Section 2 */}
                                <div>
                                    <h3 className="font-extrabold text-[16px] md:text-[18px] mb-4 text-[#1a1a1a]">
                                        2. Strategic Moat Potential — Paradigm Shift from Deal Sourcing to Operations
                                    </h3>
                                    <p className="mb-4">
                                        The source of excess returns (Alpha) in real estate asset management is shifting from buying assets cheaply to enhancing the intrinsic value of acquired assets through <strong className="font-bold text-black">Operational Excellence</strong>.
                                    </p>
                                    <p className="mb-4">
                                        Moving away from relying on the fragmented know-how and intuition of individual PMs to centralize enterprise-wide operational data for real-time AI analysis is not just an IT implementation.
                                    </p>
                                    <p className="text-gray-700">
                                        Once this platform is established, while competitors use generic AI chatbots, IGIS will make decisions based on thousands of actual operational histories. This creates an <strong className="font-bold text-black">irreplaceable, proprietary intangible asset</strong> that capital alone cannot replicate.
                                    </p>
                                </div>

                                {/* Section 3 */}
                                <div>
                                    <h3 className="font-extrabold text-[16px] md:text-[18px] mb-4 text-[#1a1a1a]">
                                        3. Execution Vulnerabilities — Overcoming UX Bottlenecks and Data Entry Friction
                                    </h3>
                                    <p className="mb-5 text-gray-700">
                                        While the technical approach is flawless, the single, critical risk that will determine the system's success is <strong className="font-bold text-black">user (PM) resistance to data entry</strong>.
                                    </p>
                                    
                                    <ul className="space-y-2 ml-1 mb-6">
                                        <li>• <strong className="font-bold text-black">Zero-Friction Input:</strong> PMs must never feel they are doing double work. Features that auto-parse and save meeting minutes or emails into the schema via simple drag-and-drop must be prioritized.</li>
                                        <li>• <strong className="font-bold text-black">Immediate Reward Mechanism:</strong> There must be <strong className="font-bold text-black">tangible benefits</strong>, such as drastically reducing the time needed to draft reports for management or instantly retrieving financial models of similar past assets.</li>
                                    </ul>
                                </div>

                                {/* Section 4 */}
                                <div>
                                    <h3 className="font-extrabold text-[16px] md:text-[18px] mb-4 text-[#1a1a1a]">
                                        4. Comprehensive Evaluation
                                    </h3>
                                    <div className="pt-2">
                                        <p className="font-bold text-[15px] md:text-[16px] text-black mb-3">
                                            Conclusion: "A highly actionable roadmap where business domain expertise and the latest AI technology understanding are perfectly aligned."
                                        </p>
                                        <p className="text-gray-700 leading-relaxed">
                                            The architecture and vision in this proposal accurately pierce current AI trends. The technical feasibility is well-proven. What remains is the execution capability to <strong className="font-bold text-black">deploy an MVP (Minimum Viable Product) as quickly as possible</strong> under full management support, evolving the system through field feedback.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Gradient Overlay */}
            <div className="fixed bottom-0 left-0 w-full h-[140px] bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none z-[40]"></div>
        </div>
    );
}
