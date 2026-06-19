# Gate 6 260618 지시사항 반영 체크리스트

작성일: 2026-06-18 KST
기준 repo: `C:\tmp\IGIS-Fund-Production-DP`
기준 live URL: `https://kylee94.github.io/logistics-gate6-preview/`

완료 기준: 각 항목은 실제 QA artifact와 담당 subagent OK가 모두 남아야 `[x]`로 전환합니다.

| 요구사항 | 구현 파일 | 검증 명령 | artifact | subagent 판정 | 상태 |
|---|---|---|---|---|---|
| 2026-06-17 뉴스 run/readback: `daily-news:2026-06-17:0700KST`의 `news_run_id`, `completed_at`, item keys, item count 확인 | `scripts/qa/logistics-news-restore-readback.cjs` | `npm run qa:news:restore-20260617` | `qa-artifacts/logistics-gate6/news-restore-readback-latest.json` | 데이터/API 담당: PASS, Edge readback artifact 확인 | [x] |
| 2026-06-17 뉴스 복구: 원본 10건 우선, 없으면 재구성임을 명시하고 8~10건 upsert | `supabase/functions/ll-dashboard-api/index.ts`, `scripts/ops/logistics-news-edge-restore-20260617.cjs` | `npm run ops:news:edge-restore-20260617` | `qa-artifacts/logistics-gate6/news-edge-restore-20260617-latest.json` | 데이터/API 담당: PASS, 원본 상세 부재로 재구성 명시 | [x] |
| 과거 날짜 refresh 보존: 1건 보존 성공을 실패로 처리하고 8~10건과 key 불변 확인 | `scripts/qa/logistics-news-api-smoke.cjs` | `npm run qa:news:api -- --date 2026-06-18 --preserve-refresh-date 2026-06-17` | `qa-artifacts/logistics-gate6/news-api-smoke-latest.json` | QA/릴리즈 담당: PASS, 6/17 run/key/completed_at 불변 | [x] |
| 향후 뉴스 복구 가능성: QA artifact에 제목/URL/언론사/발간일 저장 | `scripts/qa/logistics-news-api-smoke.cjs` | `npm run qa:news:api -- --date 2026-06-18` | `qa-artifacts/logistics-gate6/news-api-smoke-latest.json` | 데이터/API 담당: PASS, `items_summary` 저장 | [x] |
| Market Data readback: raw 9 sheets / 11,738 rows 등 workbook 기반 적재 검증 | `scripts/qa/logistics-market-data-readback-smoke.cjs` | `npm run qa:market-data:readback` | `qa-artifacts/logistics-gate6/market-data-readback-smoke-20260618-030818.json` | 데이터/API 담당: PASS | [x] |
| Market Data 브라우저: 탭별 실제 데이터, sorting table, slicer, 수도권/지방, 내부 ID 미노출 | `src/components/system/workspace/LogisticsSectorModules.jsx`, `scripts/qa/logistics-market-data-browser-smoke.cjs` | `npm run qa:market-data:browser -- --base-url https://kylee94.github.io/logistics-gate6-preview/` | `qa-artifacts/logistics-gate6/market-data-browser-smoke-latest.json` | 프론트/UI 담당: PASS, live artifact 확인 | [x] |
| Market Data 지도: 가짜 격자 제거, Naver map 또는 명확한 “지도 API 미설정/좌표 부족” 상태 | `src/components/system/workspace/LogisticsSectorModules.jsx` | `npm run qa:market-data:browser -- --base-url https://kylee94.github.io/logistics-gate6-preview/` | `qa-artifacts/logistics-gate6/market-data-browser-smoke-latest.json` | 프론트/UI 담당: PASS, Naver ready 또는 명확 경고 기준 | [x] |
| Data Management 업무 흐름: 9개 탭, 선택-검증-diff-승인-반영이력/readback | `src/components/system/workspace/LogisticsSectorModules.jsx`, `scripts/qa/logistics-data-management-browser-readback-smoke.cjs` | `npm run qa:data-management:browser-readback -- --base-url https://kylee94.github.io/logistics-gate6-preview/` | `qa-artifacts/logistics-gate6/data-management-browser-readback-smoke-latest.json` | 프론트/UI 담당: PASS, live artifact 확인 | [x] |
| Data Management 권한: 5명 전체 자산 권한, 외부 PM 자기 자산만, 내부 ID/정책 문구 미노출 | `src/components/system/workspace/LogisticsSectorModules.jsx`, `scripts/qa/logistics-data-management-browser-readback-smoke.cjs` | `npm run qa:auth-permission-matrix && npm run qa:data-management:browser-readback` | `qa-artifacts/logistics-gate6/data-management-browser-readback-smoke-latest.json` | 데이터/API 담당: PASS, permission matrix 통과 | [x] |
| 로그아웃 회귀: 세션 삭제, `/auth-setup` 이동, 새로고침 보호 route 차단 | `scripts/qa/logistics-logout-browser-smoke.cjs` | `npm run qa:logout:browser -- --base-url https://kylee94.github.io/logistics-gate6-preview/` | `qa-artifacts/logistics-gate6/logout-browser-smoke-latest.json` | QA/릴리즈 담당: PASS, live artifact 확인 | [x] |
| Investment Index / Asset Spec / Asset tenant temperature / Home operating cost / 알림 깨짐 회귀 | `src/components/system/workspace/LogisticsSectorModules.jsx`, `src/components/system/WorkspaceLogistics.jsx`, `src/components/system/IotaLeftNav.jsx` | `npm run qa:sector-tabs:browser` | `qa-artifacts/logistics-gate6/sector-tabs-browser-smoke-latest.json` | 프론트/UI 담당: PASS, live artifact 확인 | [x] |
| 릴리즈 빌드 | `package.json`, `dist/` | `npm run build:preview` | build log, `dist/index.html` | QA/릴리즈 담당: PASS | [x] |
| Supabase Edge deploy | `supabase/functions/ll-dashboard-api/index.ts` | `npx supabase functions deploy ll-dashboard-api --project-ref qvegpozwrcmspdvjokiz` | deploy log | QA/릴리즈 담당: PASS | [x] |
| GitHub Pages deploy 및 live cache-bust 확인 | `package.json`, `dist/` | `npm run deploy`, live URL browser QA | `qa-artifacts/logistics-gate6/sector-tabs-browser-smoke-latest.json` | QA/릴리즈 담당: PASS, live QA 통과 | [x] |
