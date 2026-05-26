# Gate 6 Next Version Checklist - 2026-05-18

## Baseline Saved
- Current branch: `codex/logistics-leasing-work-platform`
- Baseline commit: `445c9c0`
- Baseline tag: `logistics-gate6-ai-grounding-20260518`
- Purpose: Keep a restorable version before the login/navigation/workspace restructuring work.

## 1. Chatbot Dashboard-Number Coverage - Pending For Next Phase
- 2026-05-26 correction: Direct Edge QA passing is not enough. The live/browser chatbot must also answer the exact regression question `안성 성은 물류센터 임대 현황 알려줘` and remove `답변 생성 중...`; this is tracked in `gate6-progress-tracker-20260515.md` and `npm run qa:ai-chatbot:browser`. Latest browser smoke passed on the live `work-platform` route.
- [ ] 모든 Dashboard 탭의 KPI, 표, 차트 숫자를 `ll_dashboard_metric_snapshots` 또는 대응되는 Supabase 계산 테이블에 사전 계산해 저장한다.
- [ ] Home 탭 숫자 질문: 운영 자산 수, 총 연면적, 총 임대면적, 공실면적, 공실률, 월 임관리비, 도넛/차트/표 숫자 전부 답변 가능하게 한다.
- [ ] Asset 탭 숫자 질문: 총 연면적, 임대율, 임대면적, 공실면적, 월 임관리비, E.NOC, 임차인 수, 층/구역별 계약 상세를 답변 가능하게 한다.
- [ ] Company 탭 숫자 질문: 임차 자산 수, 총 임차면적, 월 임대료, 월 관리비, 월 임관리비, 자산별 비중, DART 요약값을 답변 가능하게 한다.
- [ ] Analysis Tools/Data Playground/Data Quality 관련 계산 결과도 권한 범위 내에서 답변 가능하게 한다.
- [ ] “공실면적”, “공실률”, “연면적”, “E.NOC”처럼 같은 자산 안에서 다른 화면과 AI 답변이 다르게 나오는 경우를 전수 대조한다.
- [ ] 챗봇 답변은 LLM 추론보다 DB deterministic answer를 우선하고, 없을 때만 provider fallback을 쓴다.
- [ ] AI 답변에 관련 DB chip/source chip을 기본 노출하지 않고, 필요 시 상세 근거 버튼으로 분리한다.

## 2. Immediate UI/Auth/Workspace Restructure - This Session
- [x] 현재 버전을 GitHub commit/push/tag로 저장한다.
- [x] 로그인 화면을 물류센터 워크 플랫폼용으로 정리하고, 권한부여 Excel 기반 이메일만 통과시킨다.
- [x] 미로그인 상태에서 demo 자동 진입을 막고 로그인 화면으로 이동시킨다.
- [x] 좌측 사이드바를 물류 전용 탭으로 분리한다.
- [x] 좌측 탭 순서를 워크 플랫폼, Dashboard Home, Asset, Company, Analysis Tools, Data Playground, Data Quality로 맞춘다.
- [x] Weekly 탭을 제거한다.
- [x] 주간업무보고자료 업로드 버튼과 모달 진입점을 제거한다.
- [x] Analysis Tools, Data Playground, Data Quality, AI 챗봇 버튼은 기획추진센터 인원만 보이게 한다.
- [x] 워크 플랫폼 메인에서 검색/담당자산 아래에 Weekly 자산현황 원문 전체 보기 테이블을 배치한다.
- [x] 자산현황 테이블 아래에 물류센터 주요 Task 관리 컴포넌트를 배치한다.
- [x] 물류센터 워크 플랫폼 협업 게시판은 가장 아래로 이동한다.
- [x] Analysis Tools의 선택 자산·기업 비교를 좌측 자산 비교, 우측 기업 비교 2단으로 분리한다.
- [x] Asset 탭 상단 KPI에서 임대율 왼쪽에 총 연면적 블록을 추가한다.
- [x] 경산 쿠팡물류센터 공실면적, 부산송정물류센터 임차인 데이터, 아레나스양지물류센터 층/섹터 누락 원인을 확인하고, 즉시 가능한 프론트 보정과 DB 수정 필요 항목을 분리한다.

### Stage 2 Evidence
- Build passed: `npm run build -- --base=/logistics-gate6-preview/`
- Secret scan: no literal secret values in changed files. Only environment variable names were detected.
- Data note: 경산/부산송정/아레나스양지 보정은 current UI snapshot 기준 immediate fallback이며, Supabase canonical readback/rebuild는 Phase 1 chatbot dashboard-number coverage와 함께 추가 처리한다.
