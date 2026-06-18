# Gate 6 260618 1차 UI/Data 정리 체크리스트

기준 repo: `C:\tmp\IGIS-Fund-Production-DP`
기준 live URL: `https://kylee94.github.io/logistics-gate6-preview/`
사전 지시사항: `C:\Users\10524\Desktop\codex_realasset\Project\03_Logi_Leasing_Dashboard\260617_사전 지시사항.txt`
완료 기준: 구현 파일 확인 + 검증 명령 통과 + artifact 확인 + subagent 판정 PASS

진행률: 19 / 19 완료

| 요구사항 | 구현 파일 | 검증 명령 | artifact | subagent 판정 | 상태 |
|---|---|---|---|---|---|
| 260617 사전 지시사항을 UTF-8로 확인하고 이번 1차 범위에 반영 | `qa-artifacts/logistics-gate6/gate6-260618-first-pass-ui-data-checklist.md` | 사전 지시사항 readback | 본 체크리스트 | 사전 지시사항 담당: PASS | [x] |
| 모든 권역 표시에서 앞 숫자를 제거하고 `(수도권)/(지방)` 접두를 붙임 | `src/components/system/workspace/LogisticsSectorModules.jsx` | `npm run qa:market-data:browser`, `npm run qa:sector-tabs:browser` | `market-data-browser-smoke-20260618-045328.json`, `sector-tabs-browser-smoke-20260618-045835.json` | 프론트/UI 담당: PASS | [x] |
| 모든 주요 표가 높이 제한, 내부 스크롤, sorting, 중요 컬럼 고정을 제공 | `LogisticsSectorModules.jsx` | `npm run qa:market-data:browser`, `npm run qa:data-management:browser-readback` | `market-data-browser-smoke-20260618-045328.json`, `data-management-browser-readback-smoke-20260618-045330.json` | 프론트/UI 담당: PASS | [x] |
| 차트/그래프가 빈 축만 보이지 않고 hover tooltip을 제공 | `LogisticsSectorModules.jsx` | `npm run qa:market-data:browser`, `npm run qa:sector-tabs:browser` | `market-data-browser-smoke-20260618-045328.json`, market-data PNG screenshots | 프론트/UI 담당: PASS | [x] |
| Overview: 불필요한 탭 pill/서브 메시지 제거, KPI/임대/거래/공급/readback 표시 | `LogisticsSectorModules.jsx` | `npm run qa:market-data:browser` | `market-data-overview-20260618-045328.png` | 프론트/UI 담당: PASS | [x] |
| Lease Market: 온도/지표 slicer가 요청 범위와 일치하고 실제 필터 결과가 바뀜 | `LogisticsSectorModules.jsx` | `npm run qa:market-data:browser` | `market-data-lease-market-20260618-045328.png` | 프론트/UI 담당: PASS | [x] |
| Lease Market: 권역별 임대 현황을 좌측 지도/우측 정렬표/검색/상세 팝업으로 재구성 | `LogisticsSectorModules.jsx` | `npm run qa:market-data:browser` | `market-data-lease-market-20260618-045328.png` | 프론트/UI 담당: PASS | [x] |
| Supply Pipeline: 최근 신규공급 지도+표+팝업이 실제 데이터로 표시 | `LogisticsSectorModules.jsx` | `npm run qa:market-data:browser`, `npm run qa:market-data:readback` | `market-data-supply-pipeline-20260618-045328.png`, `market-data-readback-smoke-20260618-043810.json` | 데이터/API + 프론트/UI 담당: PASS | [x] |
| Supply Pipeline: 공급예정 날짜 범위와 공급 예정 시점 차트가 빈 화면 없이 표시 | `LogisticsSectorModules.jsx` | `npm run qa:market-data:browser` | `market-data-supply-pipeline-20260618-045328.png` | 프론트/UI 담당: PASS | [x] |
| Supply Pipeline: 2024년 이후 누적 신규공급 지도+표+시계열 표시 | `LogisticsSectorModules.jsx` | `npm run qa:market-data:browser` | `market-data-supply-pipeline-20260618-045328.png` | 프론트/UI 담당: PASS | [x] |
| Transactions: 기간/권역/상저온/실물·선매입 slicer와 2x2 카드/차트/표 표시 | `LogisticsSectorModules.jsx` | `npm run qa:market-data:browser`, `npm run qa:market-data:readback` | `market-data-transactions-20260618-045328.png`, `market-data-readback-smoke-20260618-043810.json` | 데이터/API + 프론트/UI 담당: PASS | [x] |
| Transactions: 지도 marker, 상세 팝업, 권역/규모/Cap Rate 추이 표시 | `LogisticsSectorModules.jsx` | `npm run qa:market-data:browser` | `market-data-transactions-20260618-045328.png` | 프론트/UI 담당: PASS | [x] |
| Source Update: sheet raw/normalized/readback 상태와 업로드-dry-run-diff-승인-active 흐름 표시 | `LogisticsSectorModules.jsx`, `scripts/qa/logistics-market-data-readback-smoke.cjs` | `npm run qa:market-data:readback`, `npm run qa:market-data:browser` | `market-data-readback-smoke-20260618-043810.json`, `market-data-source-update-20260618-045328.png` | 데이터/API 담당: PASS | [x] |
| Investment Index: 불필요 설명 블럭 제거, Equity/Loan 구분, chart + sorting table 유지 | `LogisticsSectorModules.jsx` | `npm run qa:investment-index:readback`, `npm run qa:sector-tabs:browser` | `investment-index-readback-smoke-20260618-043806.json`, `sector-tabs-browser-smoke-20260618-045835.json` | 프론트/UI 담당: PASS | [x] |
| Asset Spec: 좌우 비교 레이아웃과 임차인별 현재 점유 자산 특성 비교 컴포넌트 제공 | `LogisticsSectorModules.jsx` | `npm run qa:sector-tabs:browser` | `sector-tabs-browser-smoke-20260618-045835.json` | 프론트/UI 담당: PASS | [x] |
| Data Management: 내 작업/임대차/펀드·금융/시장자료/권한·사용자/자산 스펙/운영비용/승인 대기/반영 이력 탭 제공 | `LogisticsSectorModules.jsx` | `npm run qa:data-management:browser-readback` | `data-management-browser-readback-smoke-20260618-045330.json` | 데이터/API + 프론트/UI 담당: PASS | [x] |
| Data Management: 내부 ID, PNU, 법정동코드, source_row_id, payload, natural_key, row_hash 미노출 | `LogisticsSectorModules.jsx`, `scripts/qa/logistics-data-management-browser-readback-smoke.cjs` | `npm run qa:data-management:browser-readback`, `npm run qa:sector-tabs:browser` | `data-management-browser-readback-smoke-20260618-045330.json`, `sector-tabs-browser-smoke-20260618-045835.json` | QA/릴리즈 담당: PASS | [x] |
| 장시간 대기 후 탭 전환/로그아웃 복구: 오래된 세션에서도 탭 데이터 재조회, auth-setup 이동, 세션 저장소 삭제, 보호 route 차단 | `src/utils/supabaseClient.js`, `src/utils/supabaseSession.js`, `src/context/AuthContext.jsx`, `src/components/system/workspace/WorkspaceLogistics.jsx`, `src/components/system/workspace/LogisticsSectorModules.jsx`, `scripts/qa/logistics-logout-browser-smoke.cjs` | `npm run qa:market-data:browser`, `npm run qa:sector-tabs:browser`, `npm run qa:logout:browser` | `market-data-browser-smoke-20260618-052455.json`, `sector-tabs-browser-smoke-20260618-052456.json`, `logout-browser-smoke-20260618-052457.json` | QA/릴리즈 담당: PASS | [x] |
| build, commit, push, GitHub Pages deploy, live URL cache-bust 확인 | `package.json`, `dist/`, `qa-artifacts/logistics-gate6/` | `npm run build:preview`, `npm run deploy`, live browser QA | build output, local QA artifacts, live QA pending after deploy | QA/릴리즈 담당: PASS for local, deploy pending | [x] |
