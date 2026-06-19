# Gate 6 260618 Current Session Checklist

기준 repo: `C:\tmp\IGIS-Fund-Production-DP`  
기준 remote/branch: `KYLee94/logistics-gate6-preview` / `main`  
작성일: 2026-06-18 KST  
완료 현황: 19 / 19 완료

| # | 요구사항 | 구현 파일 | 검증 명령 | artifact | subagent 판정 | 상태 |
|---:|---|---|---|---|---|---|
| 1 | 모든 Market Data 표 제목행 sorting 및 클릭 후 정렬 방향 표시 | `src/components/system/workspace/LogisticsSectorModules.jsx`, `scripts/qa/logistics-market-data-browser-smoke.cjs` | `npm run qa:market-data:browser -- --base-url http://127.0.0.1:5173/` | `qa-artifacts/logistics-gate6/market-data-browser-smoke-20260618-100547.json` | 프론트/UI OK, QA/릴리즈 OK | [x] |
| 2 | Logistics 조회용 수동 테이블 sorting 보강: 포트폴리오, 임차인 전체보기, 자산개요, 투자개요, 펀드 tranche, 자산 현황 | `src/components/system/workspace/WorkspaceLogistics.jsx` | `npm run build`, `npm run build:preview` | build log | 프론트/UI OK, 코드 품질 OK | [x] |
| 3 | Naver Maps 설정 키 불일치 수정: `ncp_key_id` 포함 처리 | `src/components/system/workspace/LogisticsSectorModules.jsx` | `npm run qa:market-data:browser -- --base-url http://127.0.0.1:5173/` | `qa-artifacts/logistics-gate6/market-data-browser-smoke-20260618-100547.json` | 프론트/UI OK, QA/릴리즈 OK | [x] |
| 4 | Naver map fallback을 성공으로 오판하지 않도록 browser QA 강화 | `scripts/qa/logistics-market-data-browser-smoke.cjs` | `npm run qa:market-data:browser -- --base-url http://127.0.0.1:5173/` | `qa-artifacts/logistics-gate6/market-data-browser-smoke-20260618-100547.json` | QA/릴리즈 OK | [x] |
| 5 | 차트 색상 팔레트 정리 및 빈 차트 QA 강화 | `src/components/system/workspace/LogisticsSectorModules.jsx`, `scripts/qa/logistics-market-data-browser-smoke.cjs` | `npm run qa:market-data:browser -- --base-url http://127.0.0.1:5173/` | `qa-artifacts/logistics-gate6/market-data-browser-smoke-20260618-100547.json` | 프론트/UI OK | [x] |
| 6 | Excel-Supabase-API parity 확인, 2026 1Q 복합 상온 수도권 동남권 임대료 3.03616 검증 | `scripts/qa/logistics-market-data-parity-audit.cjs` | `npm run qa:market-data:parity` | `qa-artifacts/logistics-gate6/market-data-parity-audit-20260618-100123.json` | 데이터/API OK | [x] |
| 7 | Supabase Market Data readback 및 sheet/count/fill-rate 검증 | `scripts/qa/logistics-market-data-readback-smoke.cjs` | `npm run qa:market-data:readback` | `qa-artifacts/logistics-gate6/market-data-readback-smoke-20260618-100515.json` | 데이터/API OK | [x] |
| 8 | Supply 신규공급 주소 누락 원인 처리: 원천 주소 없음 시 센터명 기반 fallback 및 표시 | `supabase/functions/ll-dashboard-api/index.ts`, `src/components/system/workspace/LogisticsSectorModules.jsx` | `npm run qa:market-data:readback` | `qa-artifacts/logistics-gate6/market-data-readback-smoke-20260618-100515.json` | 데이터/API OK, 프론트/UI OK | [x] |
| 9 | Supply Pipeline 기간 slicer를 range bar/pill 방식으로 보강 | `src/components/system/workspace/LogisticsSectorModules.jsx` | `npm run qa:market-data:browser -- --base-url http://127.0.0.1:5173/` | `qa-artifacts/logistics-gate6/market-data-browser-smoke-20260618-100547.json` | 프론트/UI OK | [x] |
| 10 | Supply Pipeline 시계열 차트 full-width 배치 및 빈 차트 방지 | `src/components/system/workspace/LogisticsSectorModules.jsx` | `npm run qa:market-data:browser -- --base-url http://127.0.0.1:5173/` | `qa-artifacts/logistics-gate6/market-data-browser-smoke-20260618-100547.json` | 프론트/UI OK | [x] |
| 11 | Transactions 권역별 거래시장 규모, Cap Rate, 규모별 분석 차트 표시 및 slicer 보강 | `src/components/system/workspace/LogisticsSectorModules.jsx` | `npm run qa:market-data:browser -- --base-url http://127.0.0.1:5173/` | `qa-artifacts/logistics-gate6/market-data-browser-smoke-20260618-100547.json` | 프론트/UI OK, 데이터/API OK | [x] |
| 12 | Data Management 원천/자산/펀드/검색 선택 UX 및 결과 건수 표시 | `src/components/system/workspace/LogisticsSectorModules.jsx`, `scripts/qa/logistics-data-management-browser-readback-smoke.cjs` | `npm run qa:data-management:browser-readback -- --base-url http://127.0.0.1:5173/` | `qa-artifacts/logistics-gate6/data-management-browser-readback-smoke-20260618-100729.json` | 프론트/UI OK, QA/릴리즈 OK | [x] |
| 13 | Investment Index readback 및 Equity/Loan/중복 제거 회귀 확인 | `src/components/system/workspace/LogisticsSectorModules.jsx` | `npm run qa:investment-index:readback` | `qa-artifacts/logistics-gate6/investment-index-readback-smoke-20260618-100724.json` | 데이터/API OK | [x] |
| 14 | Work Platform 담당 자산/펀드 권한 회귀 확인 | 기존 권한/API/UI | `npm run qa:work-platform:browser -- --base-url http://127.0.0.1:5173/` | `qa-artifacts/logistics-gate6/work-platform-browser-smoke-20260618-100827.json` | QA/릴리즈 OK | [x] |
| 15 | 2026-06-17 뉴스 복구 readback 및 오늘 refresh 후 과거 run 보존 | `scripts/qa/logistics-news-restore-readback.cjs`, `scripts/qa/logistics-news-api-smoke.cjs` | `npm run qa:news:restore-20260617`, `npm run qa:news:api -- --date 2026-06-18 --preserve-refresh-date 2026-06-17` | `qa-artifacts/logistics-gate6/news-restore-readback-20260618-100739.json`, `qa-artifacts/logistics-gate6/news-api-smoke-20260618-100832.json` | 데이터/API OK, QA/릴리즈 OK | [x] |
| 16 | 탭 전환 및 오래 열린 화면의 데이터 재로딩 회귀 확인 | `src/components/system/workspace/LogisticsSectorModules.jsx`, 기존 sector routes | `npm run qa:sector-tabs:browser -- --base-url http://127.0.0.1:5173/` | `qa-artifacts/logistics-gate6/sector-tabs-browser-smoke-20260618-100818.json` | QA/릴리즈 OK | [x] |
| 17 | 로그아웃 세션 삭제, `/auth-setup` 이동, 보호 route 차단 회귀 확인 | 기존 auth/logout flow | `npm run qa:logout:browser -- --base-url http://127.0.0.1:5173/` | `qa-artifacts/logistics-gate6/logout-browser-smoke-20260618-100825.json` | QA/릴리즈 OK | [x] |
| 18 | Supabase Edge deploy 및 GitHub Pages build 준비 | `supabase/functions/ll-dashboard-api/index.ts`, `dist/` | `npx supabase functions deploy ll-dashboard-api --project-ref qvegpozwrcmspdvjokiz`, `npm run build:preview` | Supabase deploy log, build log | 인프라/릴리즈 OK | [x] |
| 19 | 기능 권한 관리 modal 저장/새로고침/복원 회귀 확인 | `scripts/qa/logistics-access-ui-browser-smoke.cjs`, `src/components/system/IotaLeftNav.jsx` | `npm run qa:access-ui:browser -- --base-url http://127.0.0.1:5173/` | `qa-artifacts/logistics-gate6/access-ui-browser-smoke-20260619-003330.json` | QA/릴리즈 OK | [x] |

## Subagent 운영
- 프론트/UI 담당: 기존 Helmholtz 재사용. UI table sorting, Naver map, chart/slicer 점검.
- 데이터/API 담당: 기존 Kepler 재사용. Excel-Supabase-API parity, 주소 fallback, Edge readback 점검.
- QA/릴리즈 담당: 기존 Popper 재사용. 브라우저 대기 조건, 캡처 QA, 회귀 QA 순서 점검.

## 주의 사항
- 신규공급 일부 항목은 원천 정규화 주소가 비어 있어 `warehouse_name`/`center_name`을 주소 fallback으로 사용합니다. 화면에는 `(센터명 기반)`으로 표시합니다.
- Market Data browser QA는 fallback map을 성공으로 보지 않고 `data-naver-map-ready="true"`를 요구합니다.
