# Gate 6 Data Loading / Market Map QA Checklist - 2026-06-22

## Scope

- Target repo: `C:\tmp\IGIS-Fund-Production-DP`
- Changed QA surface:
  - `qa:data-loading:stability`
  - `qa:data-loading:idle`
  - `qa:market-map:pinpoint`
  - `qa:map-provider-matrix`
- The scripts use Playwright condition waits such as DOM state, response routing, and `data-map-*` attributes. They do not use fixed browser sleeps.

## Commands

```powershell
npm run qa:data-loading:stability
npm run qa:data-loading:idle
npm run qa:market-map:pinpoint
npm run qa:map-provider-matrix
```

Local `http://127.0.0.1:5173/` runs are preflight only. Final smoke must run after deployment against `https://kylee94.github.io/logistics-gate6-preview/` with `--cache-bust`.

## Common Options

```powershell
npm run qa:data-loading:stability -- --base-url http://127.0.0.1:5173/
npm run qa:data-loading:stability -- --base-url https://kylee94.github.io/logistics-gate6-preview/ --cache-bust
npm run qa:market-data:browser -- --base-url https://kylee94.github.io/logistics-gate6-preview/ --cache-bust
npm run qa:data-loading:stability -- --cycles 50
npm run qa:data-loading:stability -- --simulate failure
npm run qa:data-loading:idle -- --simulate idle
npm run qa:market-map:pinpoint -- --map-provider naver-simulated
npm run qa:map-provider-matrix -- --simulate success
```

- `--base-url`: defaults to `http://127.0.0.1:5173/`.
- `--cache-bust`: appends a per-route query string so live GitHub Pages smoke does not reuse stale assets.
- `--cycles`: defaults to `50`, and runs repeated Market Data tab route transitions.
- `--simulate success`: routes `sector-market/read` to a deterministic fixture.
- `--simulate failure`: routes `sector-market/read` to a controlled 503 response.
- `--simulate idle`: holds `sector-market/read` open until the script releases it after the pending-loading assertion.
- `--map-provider naver-simulated`: returns a fake Naver SDK so the UI can enter `data-map-provider="naver"` without a real external key.
- `--map-provider osm-config-missing`: returns no Naver client id and expects OpenStreetMap state.
- `--map-provider osm-config-error`: returns a controlled maps-config failure and expects OpenStreetMap fallback state.

## Completion Criteria

- Data loading stability:
  - Market Data shell appears on all target routes.
  - Loading text disappears after success/failure resolution.
  - Success path renders tables and required chart/map surfaces.
  - Failure path shows user-facing load error without internal table names or raw payload tokens.
- Data loading idle:
  - Pending `sector-market/read` is simulated, not caused by real network disruption.
  - Market Data shell remains visible.
  - Loading state is visible while the request is pending.
  - No user-facing failure appears before the script releases the pending route.
- Market map pinpoint:
  - Region cluster click switches the map to point mode.
  - Point count is positive.
  - Coordinate count covers all visible points.
  - Fallback coordinate count is zero.
  - Point buttons stay inside the map bounds and do not overlap below the script threshold.
- Map provider matrix:
  - Simulated Naver config enters `data-map-provider="naver"`.
  - Missing Naver config enters `data-map-provider="osm"`.
  - Failed Naver config enters `data-map-provider="osm"`.

## Artifact Outputs

- `qa-artifacts/logistics-gate6/data-loading-stability-*.json`
- `qa-artifacts/logistics-gate6/data-loading-idle-*.json`
- `qa-artifacts/logistics-gate6/market-map-pinpoint-*.json`
- `qa-artifacts/logistics-gate6/map-provider-matrix-*.json`
- Each script also writes a `*-latest.json` file for release handoff.

## Execution Status

| Status | Requirement | Implementation File | Verification Command | Artifact | Subagent Judgement |
| --- | --- | --- | --- | --- | --- |
| [x] | Idle/session 이후 탭 전환 데이터 로딩이 멈추지 않아야 함 | `src/utils/supabaseSession.js`, `src/context/AuthContext.jsx`, `src/components/system/workspace/WorkspaceLogistics.jsx` | `npm run qa:data-loading:stability -- --cycles 50 --simulate success --map-provider naver-simulated` | `qa-artifacts/logistics-gate6/data-loading-stability-20260622-062501-754Z.json` | QA/Release OK - local preflight |
| [x] | 장시간 대기/지연 요청 상태에서도 기존 화면을 빈 화면으로 지우지 않아야 함 | `src/utils/supabaseSession.js`, `scripts/qa/logistics-data-loading-idle.cjs` | `npm run qa:data-loading:idle -- --simulate idle` | `qa-artifacts/logistics-gate6/data-loading-idle-20260622-062603-889Z.json` | QA/Release OK - local preflight |
| [x] | Market Data 탭별 응답을 가볍게 나누고 내부 필드를 UI 응답에서 숨김 | `supabase/functions/ll-dashboard-api/index.ts`, `src/components/system/workspace/LogisticsSectorModules.jsx` | `npm run qa:market-data:browser` | `qa-artifacts/logistics-gate6/market-data-browser-smoke-20260622-062311-784Z.json` | Data/API OK - local preflight |
| [x] | Naver 실패 시 OSM fallback이 명확히 동작해야 함 | `src/components/system/workspace/LogisticsMapRuntime.jsx`, `src/components/system/workspace/LogisticsSectorModules.jsx` | `npm run qa:map-provider-matrix -- --simulate success` | `qa-artifacts/logistics-gate6/map-provider-matrix-20260622-062350-636Z.json` | Frontend/UI OK - local preflight |
| [x] | Lease Market 지도 권역 클릭 후 실제 핀 모드로 전환되어야 함 | `src/components/system/workspace/LogisticsSectorModules.jsx` | `npm run qa:market-map:pinpoint -- --map-provider naver-simulated --route market-data/lease-market` | `qa-artifacts/logistics-gate6/market-map-pinpoint-20260622-062603-952Z.json` | QA/Release OK - local preflight |
| [x] | Supply Pipeline 지도 권역 클릭 후 실제 핀 모드로 전환되어야 함 | `src/components/system/workspace/LogisticsSectorModules.jsx` | `npm run qa:market-map:pinpoint -- --map-provider naver-simulated --route market-data/supply-pipeline` | `qa-artifacts/logistics-gate6/market-map-pinpoint-20260622-062604-066Z.json` | QA/Release OK - local preflight |
| [x] | Transactions 지도 권역 클릭 후 실제 핀 모드로 전환되어야 함 | `src/components/system/workspace/LogisticsSectorModules.jsx` | `npm run qa:market-map:pinpoint -- --map-provider naver-simulated --route market-data/transactions` | `qa-artifacts/logistics-gate6/market-map-pinpoint-20260622-062604-846Z.json` | QA/Release OK - local preflight |
| [x] | Home/Asset/Company 지도 컨트롤과 콜아웃이 유지되어야 함 | `src/components/system/workspace/WorkspaceLogistics.jsx`, `src/components/system/workspace/LogisticsMapRuntime.jsx` | `npm run qa:map-callout:browser` | `qa-artifacts/logistics-gate6/map-callout-20260615/home-map-callout.json` | Frontend/UI OK - local preview |
| [x] | 기존 소개/랜딩 페이지가 어떤 경로에서도 노출되지 않아야 함 | `src/App.jsx`, `src/components/system/workspace/logisticsRoutes.js`, `scripts/qa/logistics-legacy-intro-block-smoke.cjs` | `npm run qa:legacy-intro:block` | `qa-artifacts/logistics-gate6/legacy-intro-block-smoke-20260622-062155-427Z.json` | QA/Release OK - local preview |
| [x] | 배포용 빌드가 성공해야 함 | `package.json`, `dist/**` | `npm run build:preview` | build stdout, `dist/404.html` | QA/Release OK - local build |
| [x] | 배포 후 실제 URL smoke를 Playwright로 확인해야 함 | `dist/**`, GitHub Pages live deployment | `npm run qa:data-loading:stability -- --base-url https://kylee94.github.io/logistics-gate6-preview/ --cache-bust --cycles 50`; `npm run qa:market-data:browser -- --base-url https://kylee94.github.io/logistics-gate6-preview/ --cache-bust`; `npm run qa:legacy-intro:block -- --base-url https://kylee94.github.io/logistics-gate6-preview/ --cache-bust` | `qa-artifacts/logistics-gate6/data-loading-stability-20260622-063652-636Z.json`; `qa-artifacts/logistics-gate6/market-data-browser-smoke-20260622-063608-917Z.json`; `qa-artifacts/logistics-gate6/legacy-intro-block-smoke-20260622-063609-940Z.json` | QA/Release OK - live smoke |
| [x] | 배포 후 실제 URL에서 Market Data 지도 권역 클릭/핀 표시가 동작해야 함 | GitHub Pages live deployment, `src/components/system/workspace/LogisticsSectorModules.jsx` | `npm run qa:market-map:pinpoint -- --base-url https://kylee94.github.io/logistics-gate6-preview/ --cache-bust --route market-data/lease-market`; same for `supply-pipeline`, `transactions` | `qa-artifacts/logistics-gate6/market-map-pinpoint-20260622-063904-308Z.json`; `qa-artifacts/logistics-gate6/market-map-pinpoint-20260622-063906-359Z.json`; `qa-artifacts/logistics-gate6/market-map-pinpoint-20260622-063905-709Z.json` | QA/Release OK - live smoke |
