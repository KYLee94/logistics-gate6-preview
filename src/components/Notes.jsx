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

    const rawTextKr = `1. 크게 이지스의 외부 / 내부 데이터로 나뉜다.
   - 최초 외부데이터는 리서치센터에서 주관하는 데이터(알스퀘어 등) raw파일을 쓰고 가공한다.
   - 내부데이터셋은 처음부터 만든다. 
   - 매핑기준 : 내/외부 데이터 결합을 위한 '표준 자산 식별 코드(Asset ID)'를 우선 정의
   - 아래부터는 내부 데이터셋의 구축 방향성이다.

2. 시계열로 관리할 데이터를 따로 분류한다.
    - e.g. 언더라이팅시와 지금의 데이터 변화 
    - e.g. 티저때의 원가와 중간, 지금의 원가 변화 (왜 그랬는지)
    - 시계열 데이터의 취합과 셑과 저장소를 따로 분류
    - 스냅샷 : 데이터 변화의 기준점 마일스톤(예: 초기 티저, 투자심의위원회 승인, 본 PF 기표, 준공) 시점의 데이터 스냅샷 락인(Lock-in) 기능 구현

3. 데이터베이스는 물리적으로 하나(SSOT)로 통합.
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

    const aiTextKr = `1. 1단계
빅테크 AI 벤더사(OpenAI, 구글 등)와의 전략적 제휴를 통해 전용 AI 플랫폼의 코어 뼈대를 구축한다. 단순 시스템 구축을 넘어 벤더사와의 공식 MOU 및 컨설팅 론칭을 기점으로, 이지스의 선진 기술 도입과 시스템 투명성을 외부 투자자(LP) 및 시장에 각인시켜 기업 신뢰도 회복을 위한 강력한 대외 홍보 및 비즈니스 레버리지 수단으로 적극 활용한다.
- AI사 후보 및 모델 : 오픈AI, 구글, 클로드 / LLM 기반
- 데이터 보안 아키텍처 : 금융/부동산 핵심 자산 정보가 외부 AI 학습용으로 유출되지 않도록 원천 차단하는 VPC 수준의 엔터프라이즈 전용 폐쇄망 생태계로 통제한다.
- 테스트 사용자 : PO 레벨 이상 및 각 부서별 핵심 데이터 입력 담당자로 한정하여 철저한 초기 검증을 거친다.

2. 2단계
특정 AI 모델에 종속되지 않고, 다양한 형태의 데이터(텍스트, 이미지 등)를 처리하는 강력한 멀티모달 AI 엔진들을 플러그인 형태로 자유롭게 끼우고 교체할 수 있는 유연한 아키텍처로 확장한다.
- AI사 후보 및 모델 : 오픈AI, 구글, 클로드 + a / 멀티모달 종합 환경 구성
- 사용자 환경 : 전 직원 사용 권한 확대 및 직무 특성에 맞춘 접속 환경(UI) 세분화 배포`;

    const aiTextEn = `1. Phase 1
By establishing a strategic alliance with big tech AI vendors (OpenAI, Google, etc.), we will build the core skeleton of the exclusive AI platform. Beyond simple system construction, starting with an official MOU, we will actively use this to imprint IGIS's Advanced Technology and System Transparency onto LP investors, serving as a powerful external PR tool.
- AI Candidates & Models: OpenAI, Google, Claude / LLM-based
- Data Security Architecture: Financial/real estate core asset information will be strictly controlled using a VPC-level enterprise-exclusive closed-network.
- Test Users: Strictly verified initially, limited to PO level and above, along with core data input managers.

2. Phase 2
Expands to a flexible architecture allowing powerful multi-modal AI engines processing various types of data (text, images, etc.) to be freely plugged in or replaced as plugins.
- AI Candidates & Models: OpenAI, Google, Claude + a / Comprehensive Multi-modal environment
- User Environment: Expanding usage rights to all employees and deploying segment-specific connection environments.`;

    const upperTextKr = `1. 미션 수행의 목적
전사적 데이터 취합을 효율적으로 완수하기 위해, 이를 단순 부서 업무가 아닌 리얼에셋 부문 전사 핵심 미션으로 격상하여 추진한다. 
각 조직별 핵심 인력이 공식 미션 수행원으로 지정되어 강력한 크로스펑셔널(Cross-functional) 협업 체계를 구축하며, 참여자들에게 명확한 동기부여와 실질적인 OKR 평가 성과를 부여하는 것을 최우선 목적으로 한다.

2. 내부 데이터의 취합
1) 이미 기획추진센터 노션에 취합된 데이터
2) 아우름 데이터
3) 매주 주간회의때마다 이슈제기 되고 리더(이철승대표 이하) 합의로 취합할 데이터
    - e.g. 4/8 사업그룹 미팅 지시사항 : 프로젝트마다의 설계사/시공사 다 파악해서 데이터화
4) IFPDP 미션수행시 각 부서와의 협의에 따라 필요한 데이터셑을 합의하고 추가. 
   - e.g. 기업마케팅 CRM 데이터, 프로젝트 별 심화데이터(브랜드 포지셔닝 등)

3. 조직적 데이터 취합의 방법론 
- 각각의 부서간 조직장 및 실무자와 협의/합의하여 최초 등록할 프로젝트/자산에 대해 설정하고, 그들과 긴밀하게 협력하여 최초 데이터셋을 구축한다.  
- 예상 데이터 구축 협업 부서와 실무자 
   ㄴ 기업마케팅센터 (고아라/김민지)
   ㄴ 투자그룹 (신용우/송기석/홍봉석)
   ㄴ 사업그룹 (이수정/강순용)
   ㄴ 개발솔루션 (김대익)
   -> ifpdp 시연화면을 만들어보며 각 부서별 니즈와 이를 충족하고 이들을 끌어들일수 있을만한것을 아이데이션 이후 접촉 예정

4. 외부데이터의 취합
- 국내 마켓과 섹터 : spi 데이터 크롤링 취합 
- 국내 정량데이터 : 알스퀘어
- 글로벌 마켓과 섹터 : 프리퀸, PMA 등
- 글로벌 정량데이터 : RCA`;

    const upperTextEn = `1. Purpose of Mission Execution
To efficiently accomplish enterprise-wide data collection, it is elevated from a mere departmental task to a Core Enterprise Mission for the Real Asset Division. 
We will designate key personnel from each organization as official mission executors to build a strong cross-functional collaboration system.

2. Collection of Internal Data
1) Data already collected in the Planning & Promotion Center's Notion
2) Aurum data
3) Data to be collected based on issues raised during weekly meetings
    - e.g., Identify all architects/contractors for each project and digitize them.
4) Data sets agreed upon and added through consultation with each department.

3. Methodology for Organizational Data Collection
- Set the initial projects/assets to be registered in consultation with the organization heads and closely collaborate with them to build the initial datasets.
- Expected collaborating departments and staff for data construction:
   - Corporate Marketing Center
   - Investment Group
   - Business Group
   - Development Solutions
   -> Plan to ideate satisfying needs by demonstrating IFPDP screens.

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
        ? ["System Action Plan", "Collection Methodology", "AI Introduction Plan", "Data Considerations", "Strategic Defense", "Architecture Feasibility"]
        : ["IFPDP 시스템 기획안", "데이터 취합 방법론", "AI 도입 계획", "취합 주요 고려사항", "전략적 방어 논리", "아키텍처 타당성 검토"];

    return (
        <div className="w-full h-full bg-white font-sans text-black flex flex-col items-center overflow-hidden">
            
            <div className="w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1400px] mt-24 md:mt-32 shrink-0">
                <h1 className="text-[32px] md:text-[40px] font-extrabold tracking-tight mb-8 font-inter">
                    {lang === 'en' ? 'IFPDP Execution Specifications' : 'IFPDP 세부 실행계획'}
                </h1>

                {/* Tab Navigation */}
                <div className="flex border-b-[2px] border-gray-200 mb-8 overflow-x-auto no-scrollbar pb-1">
                    {tabs.map((tab, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveTab(idx)}
                            className={"whitespace-nowrap px-6 py-3 font-bold text-[16px] md:text-[18px] transition-colors " + (activeTab === idx ? "border-b-[4px] border-black text-black" : "border-b-[4px] border-transparent text-gray-400 hover:text-gray-600")}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="w-full flex-1 overflow-y-auto pb-[150px] relative px-[24px] md:px-[50px] flex flex-col items-center">
                <div className="w-full max-w-[1100px] block">

                    {/* TAB 0: System Action Plan */}
                    {activeTab === 0 && (
                        <div className="animate-fadeIn">
                            <p className="text-md text-gray-500 font-medium mb-10 tracking-tight">
                                {lang === 'en' ? 'Updated 2026.04' : '2026.04 업데이트안'}
                            </p>
                            <div className="space-y-12">
                                {planParts.map((part, idx) => {
                                    const lines = part.trim().split('\n');
                                    const titleStr = lines[0];
                                    const bodyBlocks = lines.slice(1);
                                    
                                    return (
                                        <div key={"plan-" + idx} className="mb-8">
                                            <h2 className="text-[22px] md:text-[24px] font-bold mb-4 tracking-tighter text-black">{titleStr}</h2>
                                            <div className="text-[17px] leading-[30px] font-medium text-gray-800 break-keep">
                                                {bodyBlocks.map((line, lIdx) => {
                                                    if (!line.trim()) return <br key={lIdx} />;
                                                    
                                                    // Emphasize first lines or key phrases matching the strict styling
                                                    let isBoldLine = false;
                                                    if (!line.startsWith('①') && !line.startsWith('②') && !line.startsWith('③') && !line.startsWith('④') && !line.startsWith('⑤') && !line.startsWith('⑥') && !line.startsWith('⑦') && !line.includes(': ')) {
                                                        isBoldLine = (lIdx === 0 && line.length < 50); // Usually subtitles are short and first
                                                    }

                                                    if (isBoldLine || line.startsWith('①') || line.startsWith('②') || line.startsWith('③') || line.startsWith('④') || line.startsWith('⑤') || line.startsWith('⑥') || line.startsWith('⑦')) {
                                                        return <p key={lIdx} className="font-extrabold text-[19px] mt-6 mb-2">{line}</p>;
                                                    }

                                                    if (line.includes(': ')) {
                                                        const parts = line.split(': ');
                                                        return (
                                                            <p key={lIdx} className="mb-2">
                                                                <strong className="text-black">{parts[0]}: </strong>
                                                                {parts.slice(1).join(': ')}
                                                            </p>
                                                        );
                                                    }
                                                    
                                                    return <p key={lIdx} className="mb-2">{line}</p>;
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
                                {lang === 'en' ? 'April 9, 2026 - Consensus Complete' : '2026.04.09 기획추진센터 컨센서스 ver.'}
                            </p>
                            <div className="space-y-10">
                                {upperParts.map((part, idx) => {
                                    const lines = part.trim().split('\n');
                                    const title = lines[0];
                                    
                                    return (
                                        <div key={"up-" + idx} className="mb-6">
                                            <h2 className="text-[20px] font-bold mb-4">{title}</h2>
                                            <div className="ml-2">
                                                {lines.slice(1).map((line, lIdx) => {
                                                    const isPreamble = idx === 0;
                                                    const isArrowFocus = line.trim().startsWith('->') || line.trim().startsWith('->');
                                                    return (
                                                        <div key={"uline-" + lIdx} className={isPreamble ? "text-[18px] font-bold text-gray-700 leading-[27px] pl-3 break-keep mb-2" : "text-[16px] leading-[28px] break-keep " + (isArrowFocus ? "font-bold text-black mt-2" : "text-gray-800")}>
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

                    {/* TAB 2: AI Introduction Plan */}
                    {activeTab === 2 && (
                        <div className="animate-fadeIn">
                             <p className="text-md text-gray-500 font-medium mb-10 tracking-tight">
                                {lang === 'en' ? 'April 9, 2026 - Consensus Complete' : '2026.04.09 기획추진센터 컨센서스 ver.'}
                            </p>
                            <p className="text-[17px] font-bold mb-10 text-gray-800 break-keep leading-relaxed border-l-[4px] border-black pl-5">
                                {lang === 'en' ? 'The IFPDP platform fundamentally constructs a data lake of real assets, freely mounting high-performance AI models on top to fulfill its ultimate role as an AI platform.' : '본 IFPDP 플랫폼은 기본적으로 리얼에셋의 데이터레이크를 구성하고, 그 위에 성능 좋은 AI모델을 자유롭게 태워 AI 플랫폼으로써 정통적/궁극적 기능을 수행한다.'}
                            </p>
                            
                            <div className="space-y-10">
                                {aiParts.map((part, idx) => {
                                    const lines = part.trim().split('\n');
                                    const title = lines[0];
                                    
                                    return (
                                        <div key={"ai-" + idx} className="mb-6">
                                            <h2 className="text-[20px] font-bold mb-3">{title}</h2>
                                            <div className="ml-2">
                                                {lines.slice(1).map((line, lIdx) => {
                                                    const isPreamble = idx === 0 && lIdx === 0;
                                                    return (
                                                        <div key={"aline-" + lIdx} className={isPreamble ? "text-[17px] font-bold text-gray-700 leading-[27px] pl-3 mb-4 break-keep" : "text-[16px] leading-[28px] break-keep text-gray-800"}>
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

                    {/* TAB 3: Data Collection Considerations */}
                    {activeTab === 3 && (
                        <div className="animate-fadeIn">
                            <p className="text-md text-gray-500 font-medium mb-10 tracking-tight">
                                {lang === 'en' ? 'April 6, 2026 - Version' : '2026.04.06 ver.'}
                            </p>
                            <div className="space-y-10">
                                {lowerParts.map((part, idx) => {
                                    const lines = part.trim().split('\n');
                                    const title = lines[0];
                                    const body = lines.slice(1).join('\n');
                                    
                                    return (
                                        <div key={"low-" + idx} className="mb-6">
                                            <h2 className="text-[20px] font-bold mb-3">{title}</h2>
                                            <div className="text-[16px] leading-[28px] break-keep ml-2 text-gray-800 whitespace-pre-wrap">
                                                {body}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* TAB 4: Strategic Defense Logic */}
                    {activeTab === 4 && (
                        <div className="animate-fadeIn">
                             <p className="text-md text-gray-500 font-medium mb-10 tracking-tight">
                                {lang === 'en' ? 'Core logic for stakeholders' : '이해관계자 설득을 위한 주요 방어 논리'}
                            </p>
                            <div className="space-y-12">
                                {defenseParts.map((part, idx) => {
                                    const lines = part.trim().split('\n');
                                    const title = lines[0];
                                    
                                    return (
                                        <div key={"def-" + idx} className="mb-8">
                                            <h2 className="text-[20px] font-bold mb-5 tracking-tight">{title}</h2>
                                            <div className="ml-2 space-y-4 text-[16px] leading-[28px] text-gray-800 bg-gray-50 border-[2px] border-gray-200 p-8">
                                                {lines.slice(1).map((line, lIdx) => {
                                                    if (!line.trim()) return null;
                                                    const isQuestion = line.startsWith('예상 질문:') || line.startsWith('Anticipated Question:');
                                                    const isLogic = line.startsWith('방어 논리:') || line.startsWith('Defense Logic:');
                                                    
                                                    if (isQuestion || isLogic) {
                                                        const [label, ...rest] = line.split(':');
                                                        return (
                                                            <div key={lIdx} className="flex flex-col md:flex-row gap-1 md:gap-4 items-start break-keep">
                                                                <span className={"shrink-0 font-extrabold w-[100px] " + (isQuestion ? "text-[#d92d2d]" : "text-[#1e3a8a]")}>[{label.trim()}]</span>
                                                                <span className="whitespace-normal break-keep pt-[1px]">{rest.join(':').trim()}</span>
                                                            </div>
                                                        );
                                                    }
                                                    return <div key={lIdx} className="break-keep">{line}</div>;
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
                        <div className="animate-fadeIn">
                            <div className="bg-gray-50 border-[2px] border-black p-8 md:p-12 mb-10">
                                <h3 className="text-[24px] font-bold mb-10 flex items-center gap-2 border-b-[2px] border-gray-200 pb-5">
                                    {lang === 'en' ? 'Platform Architecture & Execution Strategy Feasibility Review' : '플랫폼 아키텍처 및 추진 전략 타당성 검토'}
                                </h3>
                                <div className="space-y-10 text-[16px] leading-[30px] text-[#333] break-keep">
                                    <div>
                                        <strong className="text-[19px] text-black block mb-2">{lang === 'en' ? '1. Validity of Pre-building a Data Lake' : '1. 데이터레이크(Data Lake) 선구축의 정합성'}</strong>
                                        {lang === 'en' ? "The actual performance of AI models (such as LLM) is determined by the consistency and accessibility of internal data (based on RAG architecture). This roadmap, which combines fragmented departmental data into a single data lake called IFPDP and mounts AI on top of it, is the most perfect and technologically sound orthodox approach to prevent the introduction of meaningless AI shells." : "AI 모델(LLM 등)의 실질적 성능은 내부 데이터의 정합성과 접근성에 의해 결정된다(RAG 아키텍처 기반). 부서별로 분절된 데이터를 IFPDP라는 단일 데이터레이크로 결합한 후 그 위에 AI를 얹는 본 로드맵은, 무의미한 AI 껍데기 도입을 방지하는 가장 완벽하고 기술적으로 타당한 정석적 접근이다."}
                                    </div>
                                    <div>
                                        <strong className="text-[19px] text-black block mb-2">{lang === 'en' ? '2. Realism of Multi-modal Phased Rollout Strategy' : '2. 멀티모달 롤아웃(Phased Rollout) 전략의 현실성'}</strong>
                                        {lang === 'en' ? "The method of integrating an enterprise (secure closed) model in Phase 1 and prioritizing validation for higher authorities (PO and above) minimizes permission control and data contamination risks. The roadmap to expand to Phase 2 (all employees and diversification) after initial validation is a powerful implementation plan that dramatically lowers the trial and error costs that can occur during company-wide deployment." : "1단계에서 엔터프라이즈(보안 폐쇄형) 모델을 결합해 상위 권한자(PO 이상)를 대상으로 우선 검증하는 방식은 권한 제어와 데이터 오염 리스크를 최소화한다. 초기 검증을 거친 후 2단계(전직원 및 다각화)로 확장하는 로드맵은 전사 도입간 발생할 수 있는 시행착오 비용을 극적으로 낮추는 강력한 구현 플랜이다."}
                                    </div>
                                    <div>
                                        <strong className="text-[19px] text-black block mb-2">{lang === 'en' ? '3. Maximization of Business Leverage (External Marketing)' : '3. 비즈니스 레버리지 극대화 (대외 마케팅)'}</strong>
                                        {lang === 'en' ? "It is highly strategic to elevate this platform beyond internal operational efficiency to an external message of 'MOU and collaboration' with big tech companies (OpenAI, Google, etc.). This proves IGIS Asset Management's overwhelming establishment of an advanced system to external investors (LP) and the market, restoring corporate trust, and has the capability to drive an increase in corporate value that far exceeds the platform construction costs." : "본 플랫폼을 내부 업무 효율화에만 국한하지 않고, 빅테크 기업(OpenAI, 구글 등)과의 'MOU 및 협업'이라는 대외적 메시지로 승화시키는 것은 매우 전략적이다. 이는 외부 투자자(LP) 및 시장에 이지스자산운용의 압도적인 선진화 시스템 구축을 증명하여 기업 신뢰도를 회복시키고, 투입되는 플랫폼 구축 비용을 훨씬 상회하는 기업 가치 상승을 견인할 역량이 있다."}
                                    </div>
                                    <div>
                                        <strong className="text-[19px] text-black block mb-2">{lang === 'en' ? '4. Network Separation & Data Privacy (Data Sovereignty)' : '4. 망분리 및 데이터 주권 (Data Privacy)'}</strong>
                                        {lang === 'en' ? "When utilizing a vendor's foundation model, prioritizing financial data security was established by requiring a VPC (Virtual Private Cloud) based API communication network and closed architecture, which fundamentally blocks IGIS's core asset information (cost, yield, etc.) from leaking as external AI training data." : "벤더사의 파운데이션 모델 활용 시, 이지스의 핵심 자산 정보(원가, 수익률 등)가 해당 AI의 외부 학습용 데이터로 유출되지 않도록 원천 차단하는 VPC(가상 프라이빗 클라우드) 기반의 API 통신망 및 폐쇄 아키텍처를 전제로 하고 있어 최우선적인 금융 데이터 보안성을 확립하였다."}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Bottom Gradient Overlay */}
            <div className="fixed bottom-0 left-0 w-full h-[140px] bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none z-[40]"></div>
        </div>
    );
}
