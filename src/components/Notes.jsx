import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Notes() {
    const { lang } = useLanguage();
    const [activeTab, setActiveTab] = useState(0);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [activeTab]);

    const planningTextKr = `1. 플랫폼 기획 의도 및 목적
부서 간 데이터 통합 및 의사결정 지원
현재 자산운용 과정에서 부서별(소싱, 투자, 개발, 운영 등)로 분산된 데이터와 문서를 중앙화한다.
IFPDP는 각 부서의 정량적 데이터와 정성적인 의사결정 이력을 통합하여 정보 취합 지연 시간을 없애고 정확한 전사 단위 의사결정을 지원하는 통합 시스템을 지향한다.

3-Pane 하이브리드 UX 도입
단순 텍스트 챗봇의 시각적 한계를 극복하기 위해, 고정형 데이터 대시보드와 대화형 AI 보조 패널을 결합한 3분할 인터페이스를 도입했다.
좌측 내비게이션으로 시스템을 탐색하고, 중앙 대시보드에서 주요 정보를 확인하며, 우측 패널은 사내 로컬 폐쇄망(On-Premise) 및 경량형 LLM과 연동되어 핵심 보안 유출 없이 즉각적인 데이터 요약 및 조작을 지시하는 직관적인 워크플로우를 제공한다.

2. SSOT(Single Source of Truth) 코어 시스템 아키텍처
자산 객체 기반의 그룹 데이터 통합
플랫폼의 기능 요구사항을 각각 별도의 메뉴와 테이블로 파편화하여 개발하지 않는다. 플랫폼의 근간 원자 단위인 개별 자산 상세 객체를 단일 진실 공급원(SSOT)으로 둔다.
개별 자산 객체에 입력되는 기초 데이터가 완벽하게 통제될 경우, 그룹 거시 지표 및 투자자(LP) 종합 뷰는 시스템이 개별 자산들을 취합하여 자동 산출하는 구조다. 즉, 자산의 10대 가치사슬, 기업 임차 정보, 파이낸싱 등 미시적 정보들이 모여 전사 관점의 거시적 대시보드를 렌더링하는 완벽한 정합성을 보장한다.

3. IFPDP 통합 플랫폼 7대 핵심 DB 모듈
파이프라인 실무 시트, 기능 요구사항 명세서 및 종합 자산운용사의 필수 컴플라이언스 요건을 모두 망라하여 구조화한 7대 데이터 모듈

① 자산 개요, 비히클 및 조직
자산 기본 구조: 자산/프로젝트명, 주요 용도(상업용, 물류, 주거, 코리빙, 복합 등), 대지/연면적 정보.
비히클 통제: 설정 형태(Fund, PFV, REITs, SPC), 펀드 호수명.
조직 및 인력 배분: 의사결정권자, 책임, 실무 담당 지정 내역 및 리얼에셋 그룹 내 인력 배분 현황.

② 자본 스택 및 수익자(LP) 관리
파이낸싱 구조: 에쿼티/론 총액, 조달 트랜치별 금리(선순위/중순위/후순위), LTV, 리파이낸싱 스케줄.
현금흐름 및 펀드 분배: 누적 배당 현황, 예상 vs 실제 매입가/평가액 비교, 캐피탈 콜 일정, 수익자 워터폴 결산.
투자자(LP) 동향 연계: 기관 유형 및 투자 성향별 LP 분류, 매각/매입 주관사 컨택 이력, 이지스 예상 수취 보수.

③ 10단계 가치사슬 및 시계열 트래킹
소싱 파이프라인: 딜 티저 접수 이력, CA 검토, 실사, 우선협상자 선정에 이르는 모든 소싱 히스토리.
전체 생애주기 일정: 매입(투자)일, PF 인출일, 착공일, 준공일, 대출 만기(연장)일, 펀드 만기일 및 예상 엑시트 완료 일정 등 타임라인 데이터베이스화.

④ 개발 상품 기획 및 ESG 전략
투자/개발 전략: Core, Value-add, Opportunistic 등 전략 분류. 부실 자산(NPL) 정상화 플랜 유무. 단일 건축안 vs 인접 부지 통합 개발안 등 복수 시나리오 타당성 비교 데이터.
하드 코스트 및 인허가: 증축, 리모델링, 철거, 관할청 사업 인허가 상황, 전력 공급 및 주요 설비 스펙.
설계 및 시공 파트너: 시공사 도급 순위, 설계사 기본 정보 및 사업 이력 현황.
공간 기획 및 ESG: 프롭테크 도입 현항, 친환경 설계(LEED, GRESB 등), 에너지 효율화 지표.

⑤ 실물 운영 및 임차인 네트워크
임대차 및 수익률 방어: 오피스 및 리테일 MD 앵커 테넌트 입점 이력, 임대율 방어율, 자본적 지출 내역.
FM/PM 관리: 주요 하자 보수 이력 플랫폼 연동.
임차 기업 니즈 타겟팅: 국내 Top 100 기업별 특수 임차 조건 트래킹 및 당사 보유/신규 자산과의 매칭 가능성 분석 데이터.

⑥ 거시 지표 및 부서별 성과 관리
그룹 전사 목표: 펀드 수익 및 수수료 기반의 전사 매출 달성률 현황, 하부 부서별 진척도 자동 추적.
외부 마켓 인텔리전스: 주요 대형 임차인의 이탈/이동 시장 동향, 대형 시공사의 외부 재무 리스크 이슈 타임라인 모니터링.

⑦ 의사결정 및 리스크 통제
Red Flag 우선순위: 준공 지연, 대규모 공실 우려, 재융자 불가 등 딜 브레이커 요소를 심각도 기준으로 시각화 및 알림 표출.
의사결정 판단 근거: 론 조건 변경, 수익률 하향 조정, 매각 시기 연기 등 재단/투자위에서 중대한 결정이 내려질 당시의 배경 사유와 정성적 판단 근거 기록.
내부 통제: 자산운용사 필수 법적 준수 요건, 이해상충 방지, 특정 문서 제출 기한 및 위원회 결재 로그 아카이빙.

4. 시스템 설계 구현 타당성
상세 자산 단위의 시나리오 구현
7대 DB 모듈에 담길 수많은 전사 데이터를 후방에서 일시 구축하는 것은 현실적으로 불가능하다. 따라서 프론트엔드 단계에서는 초기 파일럿 자산(더케이트윈타워 등)들을 중심으로 최소 기능 제품(MVP) 형태로 핵심 워크플로우를 우선 입증하여 거대 플랫폼 커버리지를 투명하게 증명한다.

모듈형 아키텍처 (디커플링 구조)
시각 리소스를 압도적으로 요구하는 중앙 메인 대시보드와 상황 인식 연산이 필요한 대화형 AI 패널 영역을 코드 레벨에서 완벽히 상호 격리한다. 이를 통해 각 모듈의 데이터 패치 및 기능 확장을 상호 충돌이나 성능 저하 없이 유연하게 구현할 수 있다.`;

    const planningTextEn = `1. Platform Intent and Objective
Inter-departmental Data Integration and Decision Support
Centralizes dispersed data and documents across different departments during the asset management process. IFPDP integrates each department's quantitative data and qualitative decision-making history to eliminate delays in information gathering and support accurate enterprise-level decision making.

3-Pane Hybrid UX Implementation
To overcome the limitations of simple text chatbots, a 3-pane interface combining a fixed data dashboard and a conversational AI assistant panel is introduced.
Users navigate the system via the left menu, view key information on the center dashboard, and use the right panel for immediate data summarization and workflow commands. The right panel is linked to the internal local closed network (On-Premise) and lightweight LLMs to strictly block core security leaks.

2. SSOT (Single Source of Truth) Core System Architecture
Group Data Integration based on Asset Objects
We do not fragment the platform's functionality into separate menus and tables. The base atomic unit of the platform, the individual asset detail object, is set as the Single Source of Truth (SSOT).
When foundational data entered into individual asset objects is perfectly controlled, macro indicators and LP composite views are automatically aggregated by the system. Micro-information such as the 10 value chains securely renders the macro dashboards logically.

3. Complete IFPDP 7 Core DB Modules
Structured data modules covering pipeline sheets, functional requirements, and strict asset management compliance:

① Asset Overview, Vehicle & Organization
Asset basic structure, vehicle control, organizational and personnel allocation history.
② Capital Stack & LP Management
Financing structures, cash flow tracking, LP trends and behavior matching.
③ 10 Value Chain & Time-Series Tracking
Sourcing pipelines and entire lifecycle schedule timetables.
④ Product Planning & ESG Strategy
Investment/development strategy, hard costs, licensing, space planning, and ESG indicators (LEED, GRESB).
⑤ Asset Operations & Corporate Leasing Networks
Leasing defense rates, FM/PM maintenance, and targeting key tenant needs.
⑥ Macro Indicators & Departmental Performance
Tracking enterprise goals alongside external market intelligence and risks.
⑦ Decision Context & Risk Control
Red Flag prioritization, records of qualitative decision judgments, and internal compliance logging.

4. System Design Implementation Feasibility
Detailed Scenario Implementation via MVP
It is unrealistic to temporarily build massive enterprise data into 7 DB modules at once. Therefore, the frontend phase will first prove core workflows transparently by using initial pilot assets (e.g., The K-Twin Tower) in a Minimum Viable Product (MVP) format.

Decoupled Modular Architecture
The visually demanding main dashboard and the computationally heavy AI panel are mutually decoupled at the code level, ensuring seamless scaling without performance degradation or conflicts.`;

    const rawTextKr = `1. 크게 이지스의 외부 / 내부 데이터로 나뉜다. (완벽한 플랫폼 모델로써 작동하는데에 내부 데이터만으로는 한계가 있기 때문이다)
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

4. 플랫폼 서비스 구축의 방법론 
- 스키마 유연화 : 전체 풀셑 항목을 만드는데 너무 집중하지 말고 지속적으로 바꿔가며 업데이트 한다. (AI 덕분에 항목을 바꾸고 업데이트 하는 비용이 기하급수적으로 자유로워졌기 때문이다.)
- AI 트리거용 맥락데이터 : 가장 중요한 것은, AI에게 어떤 상태값(이슈)일때 어떻게 대응하는지에 대한 맥락 데이터셋을 구성하고 지속 업데이트 하는 것이다. 
   ㄴ e.g.1. 전력 인입 단계에서 주의해야 할것. (예비수전-본수전-계약수전 으로 나뉘어지는데, 예비수전은 그냥 있냐고 물어보는 수준이며 금방 날라갈 수 있음. 이제는 전기가 없음. 옛날에는 신청하면 다 줬지만 지금은 아예 불가능. 예비수전 후 본수전 바로 신청 필요 & 전력은 홍장군 센터장님에게 모든 정보/커뮤니케이션 조율할 수 있도록 바로 공유 필요)
   ㄴ e.g.2 복합단지에서 앵커 리테일은 자산인지도를 강화시키고 결과적으로 오피스 공실률을 드라마틱하게 강화시키는 매우 중요한 역할을 한다. (IFC몰 사례) 
   ㄴ e.g.3. 자산의 공기의질을 계획하기 위해서는 건축 설계시부터 공조방식, 설비, 자재와 운영방식에 대해 건축 초반부터 구체적으로 고려하고 예산과 비용에 태워야 한다. 
  ㄴ 이런것들을 각개 10개의 가치사슬에서 미리 구현해 놓아야 한다.`;

    const rawTextEn = `1. Fundamentally divided into IGIS's external / internal data.
   - Initial external data utilizes raw files (such as RSQUARE) managed by the Research Center and processes them.
   - Internal datasets are built from scratch.
   - Mapping standard: Define a 'Standard Asset Identification Code (Asset ID)' first for integrating internal/external data.
   - Below is the direction for structuring the internal dataset.

2. Categorize time-series data separately.
    - e.g., Changes in data from underwriting to the present.
    - e.g., Changes in cost from teaser stage, to intermediate, to the present (and the reasons why).
    - Separation of time-series data collection, sets, and storage.
    - Snapshot: Implement a data snapshot lock-in feature at milestone points (e.g., initial teaser, investment review committee approval, main PF execution, completion).

3. The database is physically integrated into a Single Source of Truth.
    - Separate basic detail pages are constructed according to the needs of each department.
    - The final detail page contains all integrated information from all departments, accessible only to top-level administrators.
    - User permission settings (granting read/write access).

4. Methodology for Building Platform Services
- Schema Flexibility: Do not focus too much on building an exhaustive full-set initially; continuously change and update it.
- Contextual Data for AI Triggers: Most importantly, construct and continuously update contextual datasets that dictate how AI should respond under specific state values.
   - e.g.1. Things to watch out for during the power drawing phase.
   - e.g.2. In a mixed-use complex, anchor retail significantly strengthens branding and dramatically lowers office vacancy rates.
   - e.g.3. To plan asset air quality, specific air conditioning methods must be considered from the architectural design stage.
  - These must be implemented in advance across each of the 10 value chains.`;

    const aiTextKr = `1. [1안] 로컬 인프라망 자체 구축 (On-Premise AI)
가장 뛰어난 보안을 달성하기 위해 고용량 사내 통합 하드웨어와 로컬 오픈소스 LLM을 결합하는 방안이다. 외부망과의 데이터 통신을 원천 차단한 채, 사내 망 안에서만 빠르게 IFPDP 3단분리 적용을 이루어낸다.
- 고용량 통합 서버 구비 : 맥스튜디오/맥미니 등 로컬 AI 구동에 최적화된 최고 사양의 로컬 PC/서버를 자체 전산망 내에 구축
- 경량화 로컬 LLM 탑재 : Llama 3, Gemma 2 등 로컬 구동 최적화 오픈소스 모델을 탑재하여 핵심 시스템에 즉각 적용
- 접근 보안 및 이중 통제 : 사내 전용 폐쇄망 웹에 포팅하여 서비스하며, 이용자 접근 권한(읽기/쓰기)을 직급 및 부서별로 철저히 통제

2. [2안] 빅테크 제휴망 구축 (Enterprise AI)
빅테크 AI 벤더사(OpenAI, 구글, 앤스로픽 등)의 최상위 B2B 엔터프라이즈 모델과 전략적 제휴를 맺어 도입하는 도입안. 단순 시스템 개발을 넘어 공식 MOU 및 론칭을 기점으로 삼는다. 이를 통해 이지스자산운용의 '선진 기술 도입'과 '시스템 투명성'을 외부 투자자(LP) 및 기관들에게 각인시켜 신뢰도를 높이는 강력한 대외 홍보 수단으로 적극 활용한다.
- 최상위 LLM 체계 탑재 : OpenAI(GPT-4o), Google Gemini Advanced, Claude 3 Opus 등 검증된 최고 성능의 대형 언어 모델 기반 아키텍처 사용
- 엔터프라이즈 전용 폐쇄망 생태계 (데이터 보안 통제) : 자산의 핵심 원가/수익 정보가 외부 AI 벤더사의 학습용 데이터로 유출되지 않도록 VPC 수준의 인프라 구축 및 엔터프라이즈 API 계약 체결
- 초기 파일럿 및 테스트 사용자 성능검증 : 오류 및 할루시네이션(환각) 리스크를 초기 통제하기 위해, PO 레벨 이상 전사 핵심 인력 및 각 부서별 데이터 리더로 최초 사용자를 한정하여 철저한 초기 검증 및 시스템 정합성을 구축한다.`;

    const aiTextEn = `1. [Option 1] On-Premise Local AI Infrastructure
A plan focusing on the highest level of security by combining high-capacity internal enterprise hardware with local open-source LLMs. It fundamentally strictly isolates external data communication, rapidly deploying the IFPDP 3-tier structure entirely within the internal network.
- High-Capacity Integrated Servers: Deploy top-tier optimal local machines like Mac Studio/Mac Mini specifically configured for local AI processing within independent physical networks.
- Lightweight Local LLM: Instantly mount optimized models like Llama 3 or Gemma 2 on the core system.
- Access Security & Dual Control: Porting and servicing the platform on internal closed-network web environments, strictly managing user access rights across positions and departments.

2. [Option 2] Big Tech Partnership (Enterprise AI)
A plan to strategically ally with big tech AI vendors (OpenAI, Google) for their top-tier B2B Enterprise models. Beyond simple development, it marks an official MOU and launch. This actively acts as a powerful external PR tool to engrave IGIS's 'Technological Adoption' and 'System Transparency' to LP investors and institutions, fully restoring trust.
- Top-Tier LLM Architecture: Utilize proven massive language models such as OpenAI (GPT-4o), Google Gemini, and Claude 3 Opus.
- Enterprise-Dedicated Closed-Network (Data Security): Construct VPC-level infrastructures via API agreements to guarantee that critical asset cost and yield data is fundamentally blocked from leaking as learning mechanisms for external AI vendors.
- Pilot Test & Verification: To control initial errors and hallucination risks, initial usage will be strictly confined to PO level and above, along with core departmental data entry managers. This ensures rigorous initial verification and system stability before company-wide distribution.`;

    const upperTextKr = `1. 미션 수행의 목적
전사적 데이터 취합을 효율적으로 완수하기 위해, 이를 단순 부서 업무가 아닌 '리얼에셋 부문 전사 핵심 미션'으로 격상하여 추진한다. 
각 조직별 핵심 인력이 공식 미션 수행원으로 지정되어 강력한 크로스펑셔널(Cross-functional) 협업 체계를 구축하며, 참여자들에게 명확한 동기부여와 실질적인 OKR 평가 성과를 부여하는 것을 최우선 목적으로 한다.

2. 내부 데이터의 취합
1) 이미 기획추진센터 노션에 취합된 데이터
2) 아우름 데이터
3) 매주 주간회의때마다 이슈제기 되고 리더(이철승대표 이하) 합의로 취합할 데이터
    - e.g. 4/8 사업그룹 미팅 지시사항 : 프로젝트마다의 설계사/시공사 다 파악해서 데이터화
4) IFPDP 미션수행 시 각 부서와의 협의에 따라 필요한 데이터셑을 합의하고 추가. 
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

    const upperTextEn = `1. Purpose of Mission Execution
To efficiently accomplish enterprise-wide data collection, it is elevated from a mere departmental task to a 'Core Enterprise Mission for the Real Asset Division'. 
We will designate key personnel from each organization as official mission executors to build a strong cross-functional collaboration system, primarily aiming to provide clear motivation and practical OKR evaluation achievements to participants.

2. Collection of Internal Data
1) Data already collected in the Planning & Promotion Center's Notion
2) Aurum data
3) Data to be collected based on issues raised during weekly meetings and agreed upon by leaders (CEO Cheol-seung Lee and below)
    - e.g., Instructions from the April 8th Business Group meeting: Identify all architects/contractors for each project and digitize them.
4) Data sets agreed upon and added through consultation with each department during the IFPDP mission.
   - e.g., Corporate marketing CRM data, project-specific in-depth data (brand positioning, placemaking plans, M6 services, amenity space planning, etc.).

3. Methodology for Organizational Data Collection
- Set the initial projects/assets to be registered in consultation/agreement with the organization heads and working-level staff of each department, and closely collaborate with them to build the initial datasets.
- Expected collaborating departments and staff for data construction:
   - Corporate Marketing Center (Ah-ra Ko / Min-ji Kim)
   - Investment Group (Yong-woo Shin / Ki-seok Song / Bong-seok Hong)
   - Global Investment Group (TBD)
   - Special Situation Group (TBD)
   - Business Group (Soo-jung Lee / Soon-yong Kang)
   - Digital Business Group (TBD / Chang-eui Hong)
   - Development Solutions (Dae-ik Kim / TBD)
   - Management/Operation (TBD)
   - Global Asset Management (TBD)
   - Living Group (TBD)
   - Retail Solutions Center (TBD)
   - LFC (TBD)
   - Space Solutions Center (TBD)
   - CM (TBD)
   -> We plan to ideate what can satisfy needs and attract each department by creating an IFPDP demo screen, then contact the appropriate departments.
   -> For places without connections, we agreed to receive help from Leader Si-jeong Lee.

4. Collection of External Data
- Domestic Markets and Sectors: Crawling SPI data
- Domestic Quantitative Data: RSQUARE
- Global Markets and Sectors: Preqin, PMA, etc.
- Global Quantitative Data: RCA`;

    const defenseTextKr = `1. "그래서 기존 데이터 마이그레이션은 어떻게 할 건가?"
예상 질문: "과거 10년간 쌓인 수만 개의 엑셀 파일과 PDF는 이 시스템에 어떻게 넣을 건가? 수작업으로 다 칠 건가?"
방어 논리: 과거 데이터는 수치화하여 정형 DB에 억지로 밀어 넣지 않고, AI(Vector DB)가 검색할 수 있는 문서 형태로만 쏟아 넣는다. IFPDP의 정형 데이터(10단계 파이프라인)는 론칭일 이후 신규 프로젝트 및 핵심 파일럿 프로젝트(더케이트윈타워 등)부터 새롭게 시작하여 마찰 비용을 최소화하고 실행 속도를 높인다.

2. "실무진의 입력 저항은 어떻게 돌파할 것인가?"
예상 질문: "지금도 바빠 죽겠는데, 시스템에 데이터 입력하느라 일 못 하겠다는 불만은 어떻게 감당할 건가?"
방어 논리: 초기에는 부서별 1인의 미션자원자를 차출하여 전담시킨다. 입력 방식을 직접 타이핑하는 것이 아니라, 표준 엑셀 템플릿을 업로드하면 자동 파싱되는 방법을 취한다. 그것도 어려우면 Raw file을 전달 받아 기획추진에서 직접 입력한다.`;

    const defenseTextEn = `1. "How will we handle Legacy Data Migration?"
Anticipated Question: "How will we input the tens of thousands of Excel files and PDFs accumulated over the past 10 years into this system? Will it be done manually?"
Defense Logic: Past data is not forcibly quantified and pushed into a structured DB; it is simply loaded in a document format searchable by AI (Vector DB). IFPDP's structured data starts fresh with 'new projects post-launch' and 'core pilot projects' to minimize friction costs.

2. "How will we overcome the working-level Input Friction?"
Anticipated Question: "We are already swamped with work. How will we handle complaints about not being able to do our jobs because we're stuck entering data?"
Defense Logic: Initially, one Mission Volunteer is selected from each department to take dedicated charge. The input method involves automatic parsing when standard Excel templates are uploaded. If even that is difficult, raw files are matched directly.`;

    const parseSections = (text) => text.split(/(?=\n\d\.\s)/g);

    const planParts = parseSections(lang === 'en' ? planningTextEn : planningTextKr);
    const upperParts = parseSections(lang === 'en' ? upperTextEn : upperTextKr);
    const aiParts = parseSections(lang === 'en' ? aiTextEn : aiTextKr);
    const lowerParts = parseSections(lang === 'en' ? rawTextEn : rawTextKr);
    const defenseParts = parseSections(lang === 'en' ? defenseTextEn : defenseTextKr);

    const tabs = lang === 'en' 
        ? ["System Action Plan", "Collection Methodology", "Data Considerations", "AI Introduction Plan", "Q&A", "Architecture Feasibility", "System Data Schema"]
        : ["IFPDP 시스템 기획안", "데이터 취합 방법론", "취합 주요 고려사항", "AI 도입 계획", "Q&A", "아키텍처 타당성 검토", "데이터 스키마 v2.0"];

    return (
        <div className="w-full h-screen bg-white font-sans text-black flex flex-col items-center overflow-hidden">
            
            <div className="w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1600px] mt-24 md:mt-32 shrink-0">
                <h1 className="text-[22px] md:text-[30px] font-extrabold tracking-tight mb-8 font-inter">
                    {lang === 'en' ? 'IFPDP Execution Specifications' : 'IFPDP 세부 실행계획'}
                </h1>

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-200 mb-8 overflow-x-auto no-scrollbar gap-8">
                    {tabs.map((tab, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveTab(idx)}
                            className={"cursor-pointer whitespace-nowrap pb-3 font-bold text-[16px] md:text-[18px] transition-colors -mb-[1px] " + (activeTab === idx ? "border-b-[4px] border-black text-black" : "border-b-[4px] border-transparent text-gray-400 hover:text-gray-600")}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="w-full flex-1 overflow-y-auto pb-[150px] relative px-[24px] md:px-[50px] flex flex-col items-center">
                <div className="w-full max-w-[1600px] block">
                    <div className="w-full max-w-[1100px]">

                        {/* TAB 0: System Action Plan */}
                        {activeTab === 0 && (
                            <div className="animate-fadeIn">
                                <p className="text-md text-gray-500 font-medium mb-10 tracking-tight">
                                    {lang === 'en' ? 'April 21, 2026 - Version' : '2026.04.21 ver.'}
                                </p>
                                <div className="">
                                    {planParts.map((part, idx) => {
                                        const lines = part.trim().split('\n');
                                        const titleStr = lines[0];
                                        const bodyBlocks = lines.slice(1);
                                        
                                        return (
                                            <div key={`plan-${idx}`} className="mb-6" style={{ marginTop: idx > 0 ? '42px' : '0px' }}>
                                                <h2 className="text-xl font-bold mb-3">{titleStr}</h2>
                                                <div className="">
                                                    {bodyBlocks.map((line, lIdx) => {
                                                        if (!line.trim()) return <div key={`empty-${lIdx}`} className="mb-4"></div>;
                                                        
                                                        let isSubtitle = false;
                                                        if (!line.startsWith('①') && !line.startsWith('②') && !line.startsWith('③') && !line.startsWith('④') && !line.startsWith('⑤') && !line.startsWith('⑥') && !line.startsWith('⑦') && !line.includes(': ')) {
                                                            isSubtitle = (lIdx === 0 && line.length < 50) || (lIdx > 0 && bodyBlocks[lIdx-1].trim() === '' && line.length < 50); 
                                                        }

                                                        if (isSubtitle || line.startsWith('①') || line.startsWith('②') || line.startsWith('③') || line.startsWith('④') || line.startsWith('⑤') || line.startsWith('⑥') || line.startsWith('⑦')) {
                                                            return <div key={`p-uline-${lIdx}`} className="text-[18px] font-bold text-gray-700 leading-[27px] break-keep">{line}</div>;
                                                        }

                                                        if (line.includes(': ')) {
                                                            const parts = line.split(': ');
                                                            return (
                                                                <div key={`p-line-${lIdx}`} className="text-base leading-relaxed whitespace-pre-wrap text-gray-800">
                                                                    <strong className="text-black">{parts[0]}: </strong>
                                                                    {parts.slice(1).join(': ')}
                                                                </div>
                                                            );
                                                        }
                                                        
                                                        return <div key={`p-nline-${lIdx}`} className="text-base leading-relaxed whitespace-pre-wrap text-gray-800">{line}</div>;
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* TAB 1: Data Collection Methodology */}
                        {activeTab === 1 && (
                            <div className="animate-fadeIn">
                                <p className="text-md text-gray-500 font-medium mb-10 tracking-tight">
                                    {lang === 'en' ? 'April 9, 2026 - Planning Promotion Center Consensus Complete' : '2026.04.09 기획추진센터 컨센서스 ver.'}
                                </p>
                                <div className="space-y-8">
                                    {upperParts.map((part, idx) => {
                                        const lines = part.trim().split('\n');
                                        const title = lines[0];
                                        
                                        return (
                                            <div key={`up-${idx}`} className="mb-6">
                                                <h2 className="text-xl font-bold mb-3">{title}</h2>
                                                <div className="ml-2">
                                                    {lines.slice(1).map((line, lIdx) => {
                                                        const isPreamble = idx === 0;
                                                        const isArrowFocus = line.trim().startsWith('->');
                                                        return (
                                                            <div key={`uline-${lIdx}`} className={isPreamble ? "text-[18px] font-bold text-gray-700 leading-[27px] pl-3 break-keep" : `text-base leading-relaxed whitespace-pre-wrap ${isArrowFocus ? 'font-bold text-black' : 'text-gray-800'}`}>
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
                        )}

                        {/* TAB 2: Data Collection Considerations */}
                        {activeTab === 2 && (
                            <div className="animate-fadeIn">
                                <p className="text-md text-gray-500 font-medium mb-10 tracking-tight">
                                    {lang === 'en' ? 'April 9, 2026 - Planning Promotion Center Consensus Complete' : '2026.04.09 기획추진센터 컨센서스 ver.'}
                                </p>
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
                        )}

                        {/* TAB 3: AI Introduction Plan */}
                        {activeTab === 3 && (
                            <div className="animate-fadeIn">
                                 <p className="text-md text-gray-500 font-medium mb-6 tracking-tight">
                                    {lang === 'en' ? 'April 17, 2026 - Planning Promotion Center Consensus Complete' : '2026.04.17 기획추진센터 컨센서스 ver.'}
                                </p>
                                <p className="text-[17px] font-bold mb-10 text-gray-800 break-keep leading-relaxed mt-4">
                                    {lang === 'en' ? 'The IFPDP platform fundamentally constructs a data lake of real assets, freely mounting high-performance AI models on top to fulfill its ultimate role as an AI platform.' : '본 IFPDP 플랫폼은 기본적으로 리얼에셋의 데이터레이크를 구성하고, 그 위에 성능 좋은 AI모델을 자유롭게 태워 AI 플랫폼으로써 정통적/궁극적 기능을 수행한다.'}
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
                        )}

                        {/* TAB 4: Q&A */}
                        {activeTab === 4 && (
                            <div className="animate-fadeIn">
                                <div className="space-y-12 mt-2">
                                    {defenseParts.map((part, idx) => {
                                        const lines = part.trim().split('\n');
                                        const title = lines[0];
                                        
                                        return (
                                            <div key={`def-${idx}`} className="mb-8">
                                                <h2 className="text-[19px] font-bold mb-5">{title}</h2>
                                                <div className="ml-2 space-y-4 text-base leading-relaxed text-gray-800 bg-gray-50 border border-gray-200 p-6 rounded-md">
                                                    {lines.slice(1).map((line, lIdx) => {
                                                        if (!line.trim()) return null;
                                                        const isQuestion = line.startsWith('예상 질문:') || line.startsWith('Anticipated Question:');
                                                        const isLogic = line.startsWith('방어 논리:') || line.startsWith('Defense Logic:');
                                                        
                                                        if (isQuestion || isLogic) {
                                                            const [label, ...rest] = line.split(':');
                                                            return (
                                                                <div key={lIdx} className="flex flex-col md:flex-row gap-1 md:gap-4 items-start">
                                                                    <span className={`shrink-0 font-bold w-[90px] ${isQuestion ? 'text-[#e55039]' : 'text-[#4a69bd]'}`}>[{label.trim()}]</span>
                                                                    <span className="whitespace-normal break-keep pt-[1px]">{rest.join(':').trim()}</span>
                                                                </div>
                                                            );
                                                        }
                                                        return <div key={lIdx}>{line}</div>;
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* TAB 5: Architecture Feasibility */}
                        {activeTab === 5 && (
                            <div className="animate-fadeIn w-full relative">
                                <div className="bg-gray-50 border border-gray-300 p-8 md:p-10 rounded-sm">
                                            <h3 className="text-[24px] font-bold mb-8 flex items-center gap-2">
                                                {lang === 'en' ? 'Platform Architecture & Execution Strategy Feasibility Review' : '플랫폼 아키텍처 및 추진 전략 타당성 검토'}
                                            </h3>
                                            <div className="space-y-6 text-[15.5px] leading-relaxed text-gray-800 break-keep">
                                                <div>
                                                    <strong className="text-lg text-black block mb-1">{lang === 'en' ? '1. Validity of Pre-building a Data Lake' : '1. 데이터레이크(Data Lake) 선구축의 정합성'}</strong>
                                                    {lang === 'en' ? "The actual performance of AI models (such as LLM) is determined by the consistency and accessibility of internal data (based on RAG architecture). This roadmap, which combines fragmented departmental data into a single data lake called IFPDP and mounts AI on top of it, is the most perfect and technologically sound orthodox approach to prevent the introduction of meaningless AI shells." : "AI 모델(LLM 등)의 실질적 성능은 내부 데이터의 정합성과 접근성에 의해 결정된다(RAG 아키텍처 기반). 부서별로 분절된 데이터를 IFPDP라는 단일 데이터레이크로 결합한 후 그 위에 AI를 얹는 본 로드맵은, 무의미한 AI 껍데기 도입을 방지하는 가장 완벽하고 기술적으로 타당한 정석적 접근이다."}
                                                </div>
                                                <div>
                                                    <strong className="text-lg text-black block mb-1">{lang === 'en' ? '2. Realism of Multi-modal Phased Rollout Strategy' : '2. 멀티모달 롤아웃(Phased Rollout) 전략의 현실성'}</strong>
                                                    {lang === 'en' ? "The method of integrating an enterprise (secure closed) model in Phase 1 and prioritizing validation for higher authorities (PO and above) minimizes permission control and data contamination risks. The roadmap to expand to Phase 2 (all employees and diversification) after initial validation is a powerful implementation plan that dramatically lowers the trial and error costs that can occur during company-wide deployment." : "1단계에서 엔터프라이즈(보안 폐쇄형) 모델을 결합해 상위 권한자(PO 이상)를 대상으로 우선 검증하는 방식은 권한 제어와 데이터 오염 리스크를 최소화한다. 초기 검증을 거친 후 2단계(전직원 및 다각화)로 확장하는 로드맵은 전사 도입간 발생할 수 있는 시행착오 비용을 극적으로 낮추는 강력한 구현 플랜이다."}
                                                </div>
                                                <div>
                                                    <strong className="text-lg text-black block mb-1">{lang === 'en' ? '3. Maximization of Business Leverage (External Marketing)' : '3. 비즈니스 레버리지 극대화 (대외 마케팅)'}</strong>
                                                    {lang === 'en' ? "It is highly strategic to elevate this platform beyond internal operational efficiency to an external message of 'MOU and collaboration' with big tech companies (OpenAI, Google, etc.). This proves IGIS Asset Management's overwhelming establishment of an advanced system to external investors (LP) and the market, restoring corporate trust, and has the capability to drive an increase in corporate value that far exceeds the platform construction costs." : "본 플랫폼을 내부 업무 효율화에만 국한하지 않고, 빅테크 기업(OpenAI, 구글 등)과의 'MOU 및 협업'이라는 대외적 메시지로 승화시키는 것은 매우 전략적이다. 이는 외부 투자자(LP) 및 시장에 이지스자산운용의 압도적인 선진화 시스템 구축을 증명하여 기업 신뢰도를 회복시키고, 투입되는 플랫폼 구축 비용을 훨씬 상회하는 기업 가치 상승을 견인할 역량이 있다."}
                                                </div>
                                                <div>
                                                    <strong className="text-lg text-black block mb-1">{lang === 'en' ? '4. Network Separation & Data Privacy (Data Sovereignty)' : '4. 망분리 및 데이터 주권 (Data Privacy)'}</strong>
                                                    {lang === 'en' ? "When utilizing a vendor's foundation model, prioritizing financial data security was established by requiring a VPC (Virtual Private Cloud) based API communication network and closed architecture, which fundamentally blocks IGIS's core asset information (cost, yield, etc.) from leaking as external AI training data." : "벤더사의 파운데이션 모델 활용 시, 이지스의 핵심 자산 정보(원가, 수익률 등)가 해당 AI의 외부 학습용 데이터로 유출되지 않도록 원천 차단하는 VPC(가상 프라이빗 클라우드) 기반의 API 통신망 및 폐쇄 아키텍처를 전제로 하고 있어 최우선적인 금융 데이터 보안성을 확립하였다."}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                        )}

                        {/* TAB 6: Data Schema (Dev Asset) */}
                        {activeTab === 6 && (
                            <div className="animate-fadeIn w-full relative">
                                <div className="w-full">
                                    <h2 className="text-[20px] font-extrabold mb-4 font-inter text-[#1a1a1a]">IFPDP Asset Data Schema v2.0 - 개발자산 상세 (다중 필드/시계열 데이터 맵핑)</h2>
                                    
                                    <div className="w-full border border-gray-300 rounded-md mb-8 shadow-sm">
                                        <table className="w-full text-[13px] text-left border-collapse break-keep table-fixed">
                                            <thead className="bg-[#e4e4e7] text-[#333]">
                                                <tr>
                                                    <th className="border-b border-r border-gray-300 px-3 py-2 font-bold w-[120px]">화면영역 (UI 계층)</th>
                                                    <th className="border-b border-r border-gray-300 px-3 py-2 font-bold w-[160px]">데이터 속성</th>
                                                    <th className="border-b border-r border-gray-300 px-3 py-2 font-bold w-[180px]">DB 필드명</th>
                                                    <th className="border-b border-r border-gray-300 px-3 py-2 font-bold w-[200px]">데이터 구조</th>
                                                    <th className="border-b border-r border-gray-300 px-3 py-2 font-bold w-[120px]">데이터 타입</th>
                                                    <th className="border-b border-gray-300 px-3 py-2 font-bold">운영체제(OS) 화면 맵핑 예제 (IOTA Seoul)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white tracking-tight">
                                                {/* SECTION 1 */}
                                                <tr className="bg-[#f8f8f9]">
                                                    <td className="border-b border-r border-gray-300 px-3 py-2 font-bold text-gray-700" rowSpan="4">Section 1 (헤더 / 메타데이터)</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px]">① Static 프로필 <span className="text-gray-400 font-normal">(불변)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-mono text-[11px] text-[#2c3e50] font-bold">missionId / assetName</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px]">단일 구조</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] text-[#e67e22] font-semibold text-[12px]">String</td>
                                                    <td className="border-b border-gray-300 px-3 py-[6px] text-gray-600">IOTA Seoul 2 816 프로젝트</td>
                                                </tr>
                                                <tr className="bg-[#f8f8f9]">
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px]">① Static 프로필 <span className="text-gray-400 font-normal">(불변)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-mono text-[11px] text-[#2c3e50] font-bold">assetClass / vehicle</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px]">단일 구조</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] text-[#e67e22] font-semibold text-[12px]">Enum</td>
                                                    <td className="border-b border-gray-300 px-3 py-[6px] text-gray-600">Commercial / Office / PFV</td>
                                                </tr>
                                                <tr className="bg-[#f8f8f9]">
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px]">① Static 프로필 <span className="text-gray-400 font-normal">(불변)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-mono text-[11px] text-[#2c3e50] font-bold">director / pm_team</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px]">단일 Array</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] text-[#2980b9] font-semibold text-[12px]">Array of Strings</td>
                                                    <td className="border-b border-gray-300 px-3 py-[6px] text-gray-600">이철승(Director), 강순용(PO), 한찬호 외 PM팀 배열</td>
                                                </tr>
                                                <tr className="bg-[#f8f8f9]">
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-medium">② Dynamic 지표 <span className="text-gray-400 font-normal">(변동)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-mono text-[11px] text-[#8e44ad] font-bold">status / priority</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px]">단일 구조</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] text-[#e67e22] font-semibold text-[12px]">Enum</td>
                                                    <td className="border-b border-gray-300 px-3 py-[6px] text-gray-600">개발중 / High (진척 상황에 따른 변경)</td>
                                                </tr>

                                                {/* SECTION 2 */}
                                                <tr>
                                                    <td className="border-b border-r border-gray-300 px-3 py-2 font-bold text-gray-700" rowSpan="2">Section 2 (타임라인 로드맵)</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-medium">② Dynamic 지표 <span className="text-gray-400 font-normal">(변동)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-mono text-[11px] text-[#8e44ad] font-bold">timelineMilestones</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px]">Date Series <span className="text-gray-400">(마일스톤 배열)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] text-[#2980b9] font-semibold text-[12px]">Array of Objects</td>
                                                    <td className="border-b border-gray-300 px-3 py-[6px] text-gray-600">PFV설립, 통합심의 完, 1차~3차연장, 통합PF 조달 등 핵심 노드 누적</td>
                                                </tr>
                                                <tr>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-semibold text-[#1e3a8a]">③ Context 텍스트 <span className="text-[#3b82f6] font-normal">(RAG)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-mono text-[11px] text-[#16a085] font-bold">timelineDelayLog</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px]">Log Series <span className="text-gray-400">(로그 배열)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] text-[#2980b9] font-semibold text-[12px]">Array of Objects</td>
                                                    <td className="border-b border-gray-300 px-3 py-[6px] text-gray-600">변경 승인 히스토리 및 EOD 유예 등 지연 사유 트래킹</td>
                                                </tr>

                                                {/* SECTION 3 */}
                                                <tr className="bg-[#f0f4f8]">
                                                    <td className="border-b border-r border-gray-300 px-3 py-2 font-bold text-[#1e3a8a]" rowSpan="5">Section 3 (중단 / 파이낸싱 대시보드)</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-medium">② Dynamic 지표 <span className="text-gray-400 font-normal">(변동)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-mono text-[11px] text-[#8e44ad] font-bold">cost_sale_targets</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px]">Time-Series <span className="text-gray-400">(시계열 배열)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] text-[#2980b9] font-semibold text-[12px]">Array of Objects</td>
                                                    <td className="border-b border-gray-300 px-3 py-[6px] text-gray-600">원가 UW 1.6조 → As-is 2.19조 / 매각목표 1.8조 → 2.37조 분기별 궤적</td>
                                                </tr>
                                                <tr className="bg-[#f0f4f8]">
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-medium">② Dynamic 지표 <span className="text-gray-400 font-normal">(변동)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-mono text-[11px] text-[#8e44ad] font-bold">irr_target_log</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px]">Time-Series <span className="text-gray-400">(시계열 배열)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] text-[#2980b9] font-semibold text-[12px]">Array of Objects</td>
                                                    <td className="border-b border-gray-300 px-3 py-[6px] text-gray-600">목표 IRR 변동 (10.5% → 5.8%) 및 E.NOC 시계열</td>
                                                </tr>
                                                <tr className="bg-[#f0f4f8]">
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-semibold text-[#1e3a8a]">③ Context 텍스트 <span className="text-[#3b82f6] font-normal">(RAG)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-mono text-[11px] text-[#16a085] font-bold bg-yellow-100/50">majorIssuesLog</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-bold text-[#1e3a8a]">Log Series <span className="text-gray-500 font-normal">(로그 누적 배열)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] text-[#2980b9] font-semibold text-[12px]">Array of Objects</td>
                                                    <td className="border-b border-gray-300 px-3 py-[6px] text-black font-semibold">리파이낸싱(KB증권 부결, 메리츠/NH 컨택) 및 방안 <span className="text-[#e55039]">회의록</span> 정보</td>
                                                </tr>
                                                <tr className="bg-[#f0f4f8]">
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-medium">② Dynamic 지표 <span className="text-gray-400 font-normal">(변동)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-mono text-[11px] text-[#8e44ad] font-bold">equity_loan_tranches</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px]">Single Array <span className="text-gray-400">of Objects</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] text-[#2980b9] font-semibold text-[12px]">Array of Objects</td>
                                                    <td className="border-b border-gray-300 px-3 py-[6px] text-gray-600">Equity, Loan(Tr.A, B, C) 세부 은행별 참여금액/수익률/주주대여금</td>
                                                </tr>
                                                <tr className="bg-[#f0f4f8]">
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-medium">② Dynamic 지표 <span className="text-gray-400 font-normal">(변동)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-mono text-[11px] text-[#8e44ad] font-bold">developmentPeriod</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px]">Time-Series <span className="text-gray-400">(시계열 배열)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] text-[#2980b9] font-semibold text-[12px]">Array of Objects</td>
                                                    <td className="border-b border-gray-300 px-3 py-[6px] text-gray-600">목표 개발소요기간(67M → 116M) 등 주요 사업 변동치</td>
                                                </tr>

                                                {/* SECTION 4 */}
                                                <tr>
                                                    <td className="border-r border-gray-300 px-3 py-2 font-bold text-gray-700" rowSpan="4">Section 4 (하단 / RAG 컨텍스트)</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-semibold text-[#1e3a8a]">③ Context 텍스트 <span className="text-[#3b82f6] font-normal">(RAG)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-mono text-[11px] text-[#16a085] font-bold">brandProductStrategy</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px]">단일 컨텍스트 구조</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] text-[#e67e22] font-semibold text-[12px]">Text</td>
                                                    <td className="border-b border-gray-300 px-3 py-[6px] text-gray-600">Brand Guideline, 공간UX 차별성 전략 (개방형녹지, 스카이가든 등)</td>
                                                </tr>
                                                <tr>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-semibold text-[#1e3a8a]">③ Context 텍스트 <span className="text-[#3b82f6] font-normal">(RAG)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-mono text-[11px] text-[#16a085] font-bold">salesPartnershipLog</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-bold text-[#1e3a8a]">Log Series <span className="text-gray-500 font-normal">(로그 누적)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] text-[#2980b9] font-semibold text-[12px]">Array of Objects</td>
                                                    <td className="border-b border-gray-300 px-3 py-[6px] text-gray-600">기업 세일즈 이력 추적 (SK솔루션, LG전자 제안 및 임차 협의 로그)</td>
                                                </tr>
                                                <tr>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-semibold text-[#1e3a8a]">③ Context 텍스트 <span className="text-[#3b82f6] font-normal">(RAG)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-mono text-[11px] text-[#16a085] font-bold">marketingLog</td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] font-bold text-[#1e3a8a]">Log Series <span className="text-gray-500 font-normal">(로그 누적)</span></td>
                                                    <td className="border-b border-r border-gray-300 px-3 py-[6px] text-[#2980b9] font-semibold text-[12px]">Array of Objects</td>
                                                    <td className="border-b border-gray-300 px-3 py-[6px] text-gray-600">대외 홍보(인터뷰, 기획기사) 및 플레이스메이킹 히스토리 로그</td>
                                                </tr>
                                                <tr>
                                                    <td className="border-r border-gray-300 px-3 py-[6px]">① Static 프로필 <span className="text-gray-400 font-normal">(불변)</span></td>
                                                    <td className="border-r border-gray-300 px-3 py-[6px] font-mono text-[11px] text-[#2c3e50] font-bold">partners_architects</td>
                                                    <td className="border-r border-gray-300 px-3 py-[6px]">단일 구조 (Array)</td>
                                                    <td className="border-r border-gray-300 px-3 py-[6px] text-[#2980b9] font-semibold text-[12px]">Array of Strings</td>
                                                    <td className="px-3 py-[6px] text-gray-600">시공사(삼성물산), 설계사(SOM, dA), 자산관리 등 파트너 메타데이터</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Explanations */}
                                    <div className="space-y-6 text-[13px] leading-relaxed break-keep pb-20">
                                        <div>
                                            <h3 className="font-extrabold text-[15px] mb-2 text-[#1a1a1a]">1. 데이터 속성 (Data Attribute)</h3>
                                            <p className="mb-2 text-gray-700">비즈니스 관점에서 개발자산(디벨롭먼트) 데이터가 "어떤 성격과 주기를 띠는가?"를 정의. 운영자산과 달리 '목표 대비 현재(UW vs As-is)' 변동이 핵심입니다.</p>
                                            <ul className="space-y-1 ml-1 text-gray-800">
                                                <li>• <span className="font-bold text-[#1e3a8a]">① Static 프로필 (불변):</span> 프로젝트명, 비히클(PFV), 파트너/시공사 등 초기 세팅된 불변 정보.</li>
                                                <li>• <span className="font-bold text-[#1e3a8a]">② Dynamic 지표 (변동):</span> 목표 원가, 매각가, 에쿼티/론 비율 등 개발 진행도(인허가/착공/PF)에 따라 갱신되는 핵심 재무 정보.</li>
                                                <li>• <span className="font-bold text-[#1e3a8a]">③ Context Text (RAG):</span> 리파이낸싱 이슈 협의 내역, 주요 임차사(LG전자 등) 세일즈 핑퐁, 이사회 의사결정 회의록(Meeting Minutes).</li>
                                            </ul>
                                        </div>

                                        <div>
                                            <h3 className="font-extrabold text-[15px] mb-2 text-[#1a1a1a]">2. 데이터 구조 (Data Structure)</h3>
                                            <p className="mb-2 text-gray-700">정보 설계 관점에서 이 개발자산 데이터를 "시스템 코어에 어떻게 담아둘 것인가?"를 정의하는 데이터레이크 설계도입니다.</p>
                                            <ul className="space-y-1 ml-1 text-gray-800">
                                                <li>- <span className="font-bold text-gray-900">단일 구조 / 단일 컨텍스트 구조:</span> 현재 시점의 "딱 하나의 값"을 가지는 개발 개요 메타데이터.</li>
                                                <li>- <span className="font-bold text-gray-900">Time-Series (시계열 배열):</span> 단일 숫자가 아닌 "사업기획시(UW)엔 얼마였으나 인허가 지연으로 현재(As-is)는 얼마다"라는 원가/수익률 궤적 추적 구조.</li>
                                                <li>- <span className="font-bold text-gray-900">Date Series (마일스톤 배열):</span> 자산매입, 1/2차 연장, 통합PF 조달, 착공, 준공까지 선형적 날짜가 누적되는 타임라인 구조.</li>
                                                <li>- <span className="font-bold text-[#e55039]">Log Series (로그 누적 배열):</span> 특정 이슈(리파이낸싱 컨택, 주요 임차인 제안 등)마다 카라반/회의록 데이터가 차곡차곡 쌓이는 RAG 최적화 구조.</li>
                                            </ul>
                                        </div>
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
