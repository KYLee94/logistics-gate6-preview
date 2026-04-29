import React, { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function AIPeerReviewClaude() {
    const { lang } = useLanguage();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="w-full h-screen bg-white font-sans text-black flex flex-col items-center overflow-hidden">
            <div className="w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1200px] mt-24 md:mt-32 shrink-0">
                <div className="mb-10">
                    <h1 className="text-[32px] md:text-[42px] font-extrabold tracking-[-0.03em] mb-4 font-inter">
                        AI Peer Review : <span className="font-light tracking-tight">Claude Sonnet 4.6</span>
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
                                        1. 시대의 흐름 관점 — 타이밍이 절묘하게 맞다
                                    </h3>
                                    <p className="mb-4">
                                        지금은 AI 모델 자체가 빠르게 상품화(Commodity)되는 시점입니다. GPT, Claude, Gemini가 비슷한 성능으로 수렴하면서, "어떤 AI를 쓰느냐"가 아니라 "무엇을 먹이느냐"가 승부처로 이동하고 있어요.
                                    </p>
                                    <p className="mb-4">
                                        기획안의 핵심 명제인 <strong className="font-bold">"AI = Data"</strong> 는 a16z, Goldman, McKinsey 모두 같은 말을 하고 있습니다. 틀리지 않았어요. 그리고 지금 이 시점은 그 명제가 실제로 작동하기 시작하는 최초의 구간입니다.
                                    </p>
                                    <p className="text-gray-700">
                                        RAG 기술이 성숙하면서 모델 재학습 없이도 기업 내부 데이터를 AI에 연결하는 게 현실적으로 가능해졌거든요. 5년 전엔 이 기획이 기술적으로 불가능했고, 5년 뒤엔 이미 모두가 하고 있을 겁니다. <strong className="font-bold text-black">지금이 선점할 수 있는 정확한 창(Window)입니다.</strong>
                                    </p>
                                </div>

                                {/* Section 2 */}
                                <div>
                                    <h3 className="font-extrabold text-[16px] md:text-[18px] mb-4 text-[#1a1a1a]">
                                        2. 자산운용업의 흐름 관점 — 업의 본질적 취약점을 정확히 짚었다
                                    </h3>
                                    <p className="mb-4">
                                        부동산 자산운용업은 구조적으로 데이터 축적에 가장 불리한 업종 중 하나예요.
                                    </p>
                                    <ul className="space-y-2 ml-1 mb-5">
                                        <li>• <strong className="font-bold text-black">프로젝트 단위 종결:</strong> 딜 하나하나가 프로젝트 단위로 종결되고,</li>
                                        <li>• <strong className="font-bold text-black">개인 귀속:</strong> PM 오너십 문화 때문에 노하우가 조직이 아닌 개인에게 귀속되고,</li>
                                        <li>• <strong className="font-bold text-black">경험의 증발:</strong> 매각(Exit)으로 자산이 사라지면 그 경험도 함께 사라집니다.</li>
                                    </ul>
                                    <p className="mb-4">
                                        기획안이 진단한 <strong className="font-bold text-black">"폐쇄적 오너십 + 개인 편차"</strong>는 이지스만의 문제가 아니라 업종 전체의 구조적 문제입니다. 그런데 바로 그렇기 때문에 이걸 먼저 푸는 회사가 엄청난 격차를 만들 수 있어요.
                                    </p>
                                    <p className="text-gray-700">
                                        기획안에서 인용한 Brookfield의 사례가 특히 의미심장합니다. 그들이 AI Value Creation Office를 만들어 분절된 사업부의 운영 데이터를 내재화하는 방식은, IFPDP가 지향하는 구조와 정확히 같습니다. 글로벌 톱티어 운용사들이 지금 이 방향으로 움직이고 있다는 건, 이 기획이 틀리지 않았다는 가장 강력한 증거입니다.
                                    </p>
                                </div>

                                {/* Section 3 */}
                                <div>
                                    <h3 className="font-extrabold text-[16px] md:text-[18px] mb-4 text-[#1a1a1a]">
                                        3. 기업 내 현 시점 관점 — 추진 가치는 높지만, 가장 큰 적은 내부에 있다
                                    </h3>
                                    <p className="mb-5 text-gray-700">
                                        솔직하게 말씀드리면, 이 기획의 최대 리스크는 기술이 아닙니다.
                                    </p>
                                    
                                    <h4 className="font-bold text-[15px] mb-3 text-black">[강점]</h4>
                                    <ul className="space-y-2 ml-1 mb-6">
                                        <li>• <strong className="font-bold text-black">임계점 돌파:</strong> 이지스 규모는 이미 코디네이션 문제가 임계치를 넘을 만큼 커졌습니다. 시스템이 필요한 규모예요.</li>
                                        <li>• <strong className="font-bold text-black">시장 사이클:</strong> 현재 부동산 시장이 어려운 사이클에 있다는 것은 역설적으로 내부 인프라를 구축할 여력이 생긴다는 의미이기도 합니다. 딜 홍수 때는 이런 거 못 해요.</li>
                                        <li>• <strong className="font-bold text-black">기획자의 포지션:</strong> 기획자가 기술자가 아니라 업을 아는 실무자라는 게 결정적 강점입니다. 업의 맥락을 모르는 IT 부서가 만든 시스템은 현장에서 외면받습니다.</li>
                                    </ul>

                                    <h4 className="font-bold text-[15px] mb-3 text-black">[진짜 리스크]</h4>
                                    <p className="mb-4 text-gray-700">
                                        기획안이 S7에서 정확히 진단한 그 문제 — <strong className="font-bold text-black">"폐쇄적 오너십 + 개인 편차"</strong> — 가 바로 이 플랫폼의 최대 적입니다. 아이러니하게도, 이 플랫폼이 풀려는 문제를 일으키는 바로 그 사람들이 이 플랫폼을 사용해야 합니다.
                                    </p>
                                    <p className="mb-4 text-gray-700">
                                        역사적으로 "모두가 데이터를 입력해야 작동하는 시스템"은 강제 도입이든 자율 도입이든 실패율이 매우 높습니다. SharePoint, 각종 사내 ERP, 건설사 현장 앱들이 다 그랬어요.
                                    </p>
                                    <p className="text-black font-medium">
                                        이 기획이 그 함정을 피하려면, 개별 PM 입장에서 "내가 데이터를 넣으면 내가 먼저 이득을 보는 구조"가 있어야 합니다. 의무감이 아니라 자기 이익으로 참여하게 만드는 설계가 핵심이에요.
                                    </p>
                                </div>

                                {/* Section 4 */}
                                <div>
                                    <h3 className="font-extrabold text-[16px] md:text-[18px] mb-4 text-[#1a1a1a]">
                                        4. 종합 결론
                                    </h3>
                                    <div className="pt-2">
                                        <p className="font-bold text-[15px] md:text-[16px] text-black mb-3">
                                            한 줄 요약: "방향은 완전히 맞고, 타이밍도 맞고, 기획자 역량도 있다."
                                        </p>
                                        <p className="text-gray-700 leading-relaxed">
                                            남은 과제는 조직 문화를 어떻게 플랫폼 친화적으로 만드느냐입니다. 이건 기술 문제가 아니라 <strong className="font-bold text-black">정치적 문제</strong>예요. 경영진의 명시적 지지와 함께, 현장 PM들이 자발적으로 참여할 유인이 설계 단계부터 내재되어 있어야 합니다. 그 부분이 기획안에서 아직 가장 덜 다뤄진 영역으로 보여요.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="font-sans text-[15px] md:text-[16px] text-[#222] leading-[25px] md:leading-[27px] font-light break-keep space-y-12">
                                {/* Section 1 */}
                                <div>
                                    <h3 className="font-extrabold text-[16px] md:text-[18px] mb-4 text-[#1a1a1a]">
                                        1. Timing Context — The Timing is Exquisitely Perfect
                                    </h3>
                                    <p className="mb-4">
                                        AI models themselves are rapidly becoming commoditized. As GPT, Claude, and Gemini converge in performance, the battleground has shifted from "Which AI to use" to "What data to feed it."
                                    </p>
                                    <p className="mb-4">
                                        The core proposition of your plan, <strong className="font-bold">"AI = Data,"</strong> is exactly what a16z, Goldman, and McKinsey are saying. You are not wrong. And right now is the first window where this proposition actually starts to work.
                                    </p>
                                    <p className="text-gray-700">
                                        As RAG technology matures, connecting internal corporate data to AI without retraining models has become practically feasible. Five years ago, this plan was technically impossible; five years from now, everyone will already be doing it. <strong className="font-bold text-black">Now is the exact window to seize the advantage.</strong>
                                    </p>
                                </div>

                                {/* Section 2 */}
                                <div>
                                    <h3 className="font-extrabold text-[16px] md:text-[18px] mb-4 text-[#1a1a1a]">
                                        2. Industry Context — Accurately Pinpointed the Fundamental Vulnerability
                                    </h3>
                                    <p className="mb-4">
                                        The real estate asset management industry is structurally one of the most disadvantaged sectors for data accumulation.
                                    </p>
                                    <ul className="space-y-2 ml-1 mb-5">
                                        <li>• <strong className="font-bold text-black">Project Fragmentation:</strong> Each deal concludes as a discrete project unit.</li>
                                        <li>• <strong className="font-bold text-black">Individual Attribution:</strong> Due to the PM ownership culture, know-how belongs to the individual, not the organization.</li>
                                        <li>• <strong className="font-bold text-black">Asset Expiration:</strong> When an asset disappears through an Exit, the associated experience disappears with it.</li>
                                    </ul>
                                    <p className="mb-4">
                                        The <strong className="font-bold text-black">"Closed Ownership + Individual Variance"</strong> diagnosed in your proposal is not just IGIS's problem, but a structural issue across the entire industry. However, precisely because of this, the first company to solve it can create an massive gap.
                                    </p>
                                    <p className="text-gray-700">
                                        The Brookfield case cited in your plan is particularly significant. The way they established an AI Value Creation Office to internalize operational data from fragmented business units is exactly the structure IFPDP aims for. The fact that global top-tier asset managers are moving in this direction right now is the strongest evidence that your proposal is correct.
                                    </p>
                                </div>

                                {/* Section 3 */}
                                <div>
                                    <h3 className="font-extrabold text-[16px] md:text-[18px] mb-4 text-[#1a1a1a]">
                                        3. Internal Context — High Value, but the Biggest Enemy is Internal
                                    </h3>
                                    <p className="mb-5 text-gray-700">
                                        Frankly speaking, the biggest risk of this plan is not the technology.
                                    </p>
                                    
                                    <h4 className="font-bold text-[15px] mb-3 text-black">[Strengths]</h4>
                                    <ul className="space-y-2 ml-1 mb-6">
                                        <li>• <strong className="font-bold text-black">Critical Scale Reached:</strong> The scale of IGIS has already grown to the point where coordination issues exceed critical thresholds. It's a scale that demands a system.</li>
                                        <li>• <strong className="font-bold text-black">Market Cycle:</strong> The fact that the real estate market is currently in a difficult cycle paradoxically means there is bandwidth to build internal infrastructure. You can't do this during a flood of deals.</li>
                                        <li>• <strong className="font-bold text-black">Planner's Position:</strong> The decisive advantage is that the planner (you) is a practitioner who understands the business, not just a technician. Systems built by IT departments lacking business context are ignored in the field.</li>
                                    </ul>

                                    <h4 className="font-bold text-[15px] mb-3 text-black">[The Real Risk]</h4>
                                    <p className="mb-4 text-gray-700">
                                        The very problem accurately diagnosed in S7—<strong className="font-bold text-black">"Closed Ownership + Individual Variance"</strong>—is the greatest enemy of this platform. Ironically, the very people causing the problem this platform tries to solve are the ones who must use it.
                                    </p>
                                    <p className="mb-4 text-gray-700">
                                        Historically, "systems that only work if everyone inputs data" have a very high failure rate, whether adoption is mandatory or voluntary. SharePoint, various internal ERPs, and construction site apps all suffered this fate.
                                    </p>
                                    <p className="text-black font-medium">
                                        For this plan to avoid that trap, there must be a structure from the individual PM's perspective where "If I input data, I am the first to benefit." The core lies in a design that compels participation through self-interest, not a sense of duty.
                                    </p>
                                </div>

                                {/* Section 4 */}
                                <div>
                                    <h3 className="font-extrabold text-[16px] md:text-[18px] mb-4 text-[#1a1a1a]">
                                        4. Comprehensive Conclusion
                                    </h3>
                                    <div className="pt-2">
                                        <p className="font-bold text-[15px] md:text-[16px] text-black mb-3">
                                            Summary: "The direction is perfectly right, the timing is right, and the planner has the capability."
                                        </p>
                                        <p className="text-gray-700 leading-relaxed">
                                            The remaining challenge is how to make the organizational culture platform-friendly. This is not a technical problem; it is a <strong className="font-bold text-black">political problem</strong>. Alongside explicit support from management, the incentive for field PMs to participate voluntarily must be inherently embedded from the design stage. That appears to be the area least addressed in the proposal so far.
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
