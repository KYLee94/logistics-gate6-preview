import React, { useEffect } from 'react';

export default function Notes() {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const rawText = `1. 크게 이지스의 외부 / 내부 데이터로 나뉜다. (완벽한 플랫폼 모델로써 작동하는데에 내부 데이터만으로는 한계가 있기 때문이다)
   - 최초 외부데이터는 리서치센터에서 주관하는 데이터(알스퀘어 등) raw파일을 쓰고 가공한다.
   - 내부데이터셋은 처음부터 만든다. 
   - 매핑기준 : 내/외부 데이터 결합을 위한 '표준 자산 식별 코드(Asset ID)'를 우선 정의
   - 아래부터는 내부 데이터셋의 구축 방향성이다.

2. 시계열로 관리할 데이터를 따로 분류한다.
    - e.g. 언더라이팅시와 지금의 데이터 변화 
    - e.g. 티저때의 원가와 중간, 지금의 원가 변화 (왜 그랬는지)
    - 시계열 데이터의 취합과 셑과 저장소를 따로 분류
    - 스냅샷 : 데이터 변화의 기준점 마일스톤(예: 초기 티저, 투자심의위원회 승인, 본 PF 기표, 준공) 시점의 데이터 스냅샷 락인(Lock-in) 기능 구현

3. 데이터베이스는 물리적으로 하나(Single Source of Truth)로 통합. 하지만 사용자(부서)에 따른 최적 화면은 따로 구성된다.
    ㄴ 각 부서의 니즈에 맞게 부서별 기본 상세페이지를 모두 따로 구성한다. 
    ㄴ 최종 상세페이지에는, 모든 부서에서 취합된 정보가 담기고, 이 페이지는 최고 권한자만 열람할 수 있게 한다. 
    ㄴ 사용자 권한 설정 (데이터 열람 권한 부여, 읽기/쓰기 권한 부여)

4. 플랫폼 서비스 (맥락) 구축의 방법론 
- 스키마 유연화 : 전체 풀셑 항목을 만드는데 너무 집중하지 말고 지속적으로 바꿔가며 업데이트 한다. (AI 덕분에 항목을 바꾸고 업데이트 하는 비용이 기하급수적으로 자유로워졌기 때문이다.)
- AI 트리거용 맥락데이터 : 가장 중요한 것은, AI에게 어떤 상태값(이슈)일때 어떻게 대응하는지에 대한 맥락 데이터셋을 구성하고 지속 업데이트 하는 것이다. 
   ㄴ e.g.1. 전력 인입 단계에서 주의해야 할것. (예비수전-본수전-계약수전 으로 나뉘어지는데, 예비수전은 그냥 있냐고 물어보는 수준이며 금방 날라갈 수 있음. 이제는 전기가 없음. 옛날에는 신청하면 다 줬지만 지금은 아예 불가능. 예비수전 후 본수전 바로 신청 필요 & 전력은 홍장군 센터장님에게 모든 정보/커뮤니케이션 조율할 수 있도록 바로 공유 필요)
   ㄴ e.g.2 복합단지에서 앵커 리테일은 브래딩(자산인지도)를 강화시키고 결과적으로 오피스 공실률을 드라마틱하게 강화시키는 매우 중요한 역할을 한다. (IFC몰 사례) 
   ㄴ e.g.3. 자산의 공기의질을 계획하기 위해서는 건축 설계시부터 공조방식, 설비, 자재와 운영방식에 대해 건축 초반부터 구체적으로 고려하고 예산과 비용에 태워야 한다. 
  ㄴ 이런것들을 각개 10개의 가치사슬에서 미리 구현해 놓아야 한다.`;

    // Regex to split by numbered headers
    const lowerParts = rawText.split(/(?=\n\d\.\s)/g);

    const aiText = `1. 1단계
빅테크 AI 벤더사(OpenAI, 구글 등)와의 전략적 제휴를 통해 이지스자산운용 전용 AI 플랫폼의 코어 뼈대를 우선 구축한다. 단순 시스템 구축을 넘어 벤더사와의 공식 MOU 및 컨설팅 론칭을 기점으로, 이지스의 '초격차 선진 기술 도입'과 '시스템 투명성'을 외부 투자자(LP) 및 시장에 각인시켜 기업 신뢰도 회복을 위한 강력한 대외 홍보 및 비즈니스 레버리지 수단으로 적극 활용한다.
- AI사 후보 및 모델 : 오픈AI, 구글, 클로드 / LLM 기반
- 데이터 보안 아키텍처 : 금융/부동산 핵심 자산 정보가 외부 AI 학습용으로 유출되지 않도록 원천 차단하는 VPC(가상 프라이빗 클라우드) 수준의 엔터프라이즈 전용 폐쇄망 생태계로 통제한다.
- 테스트 사용자 : PO 레벨 이상 및 각 부서별 핵심 데이터 입력 담당자로 한정하여 철저한 초기 검증을 거친다.

2. 2단계
특정 AI 모델에 종속되지 않고, 다양한 형태의 데이터(텍스트, 이미지 등)를 처리하는 강력한 멀티모달 AI 엔진들을 플러그인 형태로 자유롭게 끼우고 교체할 수 있는 유연한 아키텍처로 확장한다.
- AI사 후보 및 모델 : 오픈AI, 구글, 클로드 + a / 멀티모달 종합 환경 구성
- 사용자 환경 : 전 직원 사용 권한 확대 및 직무 특성에 맞춘 접속 환경(UI) 세분화 배포`;

    const upperText = `1. 미션 수행의 목적
전사적 데이터 취합을 효율적으로 완수하기 위해, 이를 단순 부서 업무가 아닌 '리얼에셋 부문(이철승 대표이사 지시)의 전사 핵심 미션'으로 격상하여 추진한다. 각 조직별 핵심 인력을 공식 미션 수행원으로 지정해 강력한 크로스펑셔널(Cross-functional) 협업 체계를 구축하며, 참여자들에게 명확한 동기부여와 실질적인 OKR 평가 성과를 부여하는 것을 최우선 목적으로 한다.

2. 내부 데이터의 취합
1) 이미 기획추진센터 노션에 취합된 데이터
2) 아우름 데이터
3) 매주 주간회의때마다 이슈제기 되고 리더(이철승대표 이하) 합의로 취합할 데이터
    - e.g. 4/8 사업그룹 미팅 지시사항 : 프로젝트마다의 설계사/시공사 다 파악해서 데이터화
4) IFPDP 미션수행시 각 부서와의 협의에 따라 필요한 데이터셑을 합의하고 추가. 
   - e.g. 기업마케팅 CRM 데이터, 프로젝트 별 심화데이터(브랜드 포지셔닝, 플레이스 메이킹 플랜, M6 서비스, 어메니티 공간 계획 등) 등.

3. 조직적 데이터 취합의 방법론 
- 각각의 부서간 조직장 및 실무자와 협의/합의하여 최초 등록할 프로젝트/자산에 대해 설정하고, 그들과 긴밀하게 협력하여 최초 데이터셋을 구축한다.  
- 예상 데이터 구축 협업 부서와 실무자 
   ㄴ 기업마케팅센터 (고아라/김민지)
   ㄴ 투자그룹 (신용우/송기석/홍봉석)
   ㄴ 글로벌투자그룹 (미정)
   ㄴ 스페셜시츄에이션그룹 (미정)
   ㄴ 사업그룹 (이수정/강순용)
   ㄴ 디지털사업그룹 (미정/홍창의)
   ㄴ 개발솔루션 (김대익/미정)
   ㄴ 관리/운영 (미정)
   ㄴ 글로벌자산관리 (미정)
   ㄴ 리빙그룹 (미정)
   ㄴ 리테일솔루션센터 (미정)
   ㄴ LFC (미정)
   ㄴ 공간솔루션센터 (미정)
   ㄴ CM (미정)
   -> ifpdp 시연화면을 만들어보며 각 부서별 니즈와 이를 충족하고 이들을 끌어들일수 있을만한것을 아이데이션해본후 적절 부서 접촉 예정
   -> 인맥 없는 곳은 이시정 리더의 도움 받기로 함

4. 외부데이터의 취합
- 국내 마켓과 섹터 : spi 데이터 크롤링 취합 
- 국내 정량데이터 : 알스퀘어
- 글로벌 마켓과 섹터 : 프리퀸, PMA 등
- 글로벌 정량데이터 : RCA`;

    const aiParts = aiText.split(/(?=\n\d\.\s)/g);
    const upperParts = upperText.split(/(?=\n\d\.\s)/g);

    return (
        <div className="w-full h-screen overflow-y-auto pb-[200px] bg-white font-sans text-black flex flex-col items-center">
            
            {/* Header Width Sync Container (Matches Header Edge exactly) */}
            <div className="w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1600px] mt-24 md:mt-32">
                
                {/* 1100px Left Aligned Reading Width */}
                <div className="w-full max-w-[1100px]">
                    
                    {/* 1. Mission Setup Section */}
                    <div className="mb-20">
                        <h1 className="text-2xl md:text-3xl font-bold mb-2 pb-4 inline-block tracking-tight">
                            IFPDP 미션화 및 데이터 취합/활용 방법론
                        </h1>
                        <p className="text-md text-gray-500 font-medium mb-10 tracking-tight">2026.04.09 기획추진센터 합의 完</p>
                        
                        <div className="space-y-8">
                            {upperParts.map((part, idx) => {
                                const lines = part.trim().split('\n');
                                const title = lines[0];
                                
                                return (
                                    <div key={`up-${idx}`} className="mb-6">
                                        <h2 className="text-xl font-bold mb-3">{title}</h2>
                                        <div className="ml-2">
                                            {lines.slice(1).map((line, lIdx) => {
                                                const isPreamble = idx === 0 && lIdx === 0;
                                                const isArrowFocus = line.trim().startsWith('->');
                                                return (
                                                    <div key={`uline-${lIdx}`} className={isPreamble ? "text-[18px] font-bold text-gray-700 leading-[27px] pl-3 mb-4 break-keep" : `text-base leading-relaxed whitespace-pre-wrap ${isArrowFocus ? 'font-bold text-black' : 'text-gray-800'}`}>
                                                        {line}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Solid Complete Divider */}
                    <hr className="border-t-[3px] border-black my-20" />

                    {/* 2. AI Section */}
                    <div className="mb-20">
                        <h1 className="text-2xl md:text-3xl font-bold mb-2 pb-4 inline-block tracking-tight">
                            AI의 도입 계획
                        </h1>
                        <p className="text-md text-gray-500 font-medium mb-6 tracking-tight">2026.04.09 기획추진센터 합의 完</p>
                        <p className="text-[17px] font-bold mb-10 text-gray-800 break-keep leading-relaxed mt-4">
                            본 IFPDP 플랫폼은 기본적으로 리얼에셋의 데이터레이크를 구성하고, 그 위에 성능 좋은 AI모델을 자유롭게 태워 AI 플랫폼으로써 궁극적 기능을 수행한다.
                        </p>
                        
                        <div className="space-y-8">
                            {aiParts.map((part, idx) => {
                                const lines = part.trim().split('\n');
                                const title = lines[0];
                                
                                return (
                                    <div key={`ai-${idx}`} className="mb-6">
                                        <h2 className="text-xl font-bold mb-3">{title}</h2>
                                        <div className="ml-2">
                                            {lines.slice(1).map((line, lIdx) => {
                                                const isPreamble = idx === 0 && lIdx === 0;
                                                return (
                                                    <div key={`aline-${lIdx}`} className={isPreamble ? "text-[18px] font-bold text-gray-700 leading-[27px] pl-3 mb-4 break-keep" : "text-base leading-relaxed whitespace-pre-wrap text-gray-800"}>
                                                        {line}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Solid Complete Divider */}
                    <hr className="border-t-[3px] border-black my-20" />

                    {/* 3. Original Requirements Section */}
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold mb-10 pb-4 inline-block tracking-tight">
                            IFPDP_데이터 취합 주요 고려사항 <span className="text-lg font-normal text-gray-500">(2026.04.06 ver)</span>
                        </h1>
                        
                        <div className="space-y-8">
                            {lowerParts.map((part, idx) => {
                                const lines = part.trim().split('\n');
                                const title = lines[0];
                                const body = lines.slice(1).join('\n');
                                
                                return (
                                    <div key={`low-${idx}`} className="mb-6">
                                        <h2 className="text-xl font-bold mb-3">{title}</h2>
                                        <div className="text-base leading-relaxed whitespace-pre-wrap ml-2 text-gray-800">
                                            {body}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* 4. Feedback Validation Box */}
                    <div className="mt-32 mb-20">
                        <div className="bg-gray-50 border border-gray-300 p-8 md:p-10 rounded-sm">
                            <h3 className="text-[24px] font-bold mb-8 flex items-center gap-2">
                                플랫폼 아키텍처 및 추진 전략 타당성 검토
                            </h3>
                            <div className="space-y-6 text-[15.5px] leading-relaxed text-gray-800 break-keep">
                                <div>
                                    <strong className="text-lg text-black block mb-1">1. 데이터레이크(Data Lake) 선구축의 정합성</strong>
                                    AI 모델(LLM 등)의 실질적 성능은 내부 데이터의 정합성과 접근성에 의해 결정된다(RAG 아키텍처 기반). 부서별로 분절된 데이터를 IFPDP라는 단일 데이터레이크로 결합한 후 그 위에 AI를 얹는 본 로드맵은, 무의미한 AI 껍데기 도입을 방지하는 가장 완벽하고 기술적으로 타당한 정석적 접근이다.
                                </div>
                                <div>
                                    <strong className="text-lg text-black block mb-1">2. 멀티모달 롤아웃(Phased Rollout) 전략의 현실성</strong>
                                    1단계에서 엔터프라이즈(보안 폐쇄형) 모델을 결합해 상위 권한자(PO 이상)를 대상으로 우선 검증하는 방식은 권한 제어와 데이터 오염 리스크를 최소화한다. 초기 검증을 거친 후 2단계(전직원 및 다각화)로 확장하는 로드맵은 전사 도입간 발생할 수 있는 시행착오 비용을 극적으로 낮추는 강력한 구현 플랜이다.
                                </div>
                                <div>
                                    <strong className="text-lg text-black block mb-1">3. 비즈니스 레버리지 극대화 (대외 마케팅)</strong>
                                    본 플랫폼을 내부 업무 효율화에만 국한하지 않고, 빅테크 기업(OpenAI, 구글 등)과의 'MOU 및 협업'이라는 대외적 메시지로 승화시키는 것은 매우 전략적이다. 이는 외부 투자자(LP) 및 시장에 이지스자산운용의 압도적인 선진화 시스템 구축을 증명하여 기업 신뢰도를 회복시키고, 투입되는 플랫폼 구축 비용을 훨씬 상회하는 기업 가치 상승을 견인할 역량이 있다.
                                </div>
                                <div>
                                    <strong className="text-lg text-black block mb-1">4. 망분리 및 데이터 주권 (Data Privacy)</strong>
                                    벤더사의 파운데이션 모델 활용 시, 이지스의 핵심 자산 정보(원가, 수익률 등)가 해당 AI의 외부 학습용 데이터로 유출되지 않도록 원천 차단하는 VPC(가상 프라이빗 클라우드) 기반의 API 통신망 및 폐쇄 아키텍처를 전제로 하고 있어 최우선적인 금융 데이터 보안성을 확립하였다.
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
