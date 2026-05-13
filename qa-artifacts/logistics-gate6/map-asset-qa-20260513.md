# Gate 6 Map + Asset Dashboard Unit QA - 2026-05-13

## Scope
- Repo: `C:\tmp\IGIS-Fund-Production-DP`
- Branch: `codex/logistics-leasing-work-platform`
- Routes:
  - `/platform/iotaseoul/workspace/logistics/dashboard/home`
  - `/platform/iotaseoul/workspace/logistics/dashboard/asset`

## Map Update
- Home `포트폴리오 위치` now attempts Naver Dynamic Map first.
- Public client id only is used in frontend.
- Sensitive NCP server value is not stored in source, JSON, QA output, or bundle.
- Fallback order:
  1. Naver Dynamic Map
  2. Leaflet/OpenStreetMap dynamic map
  3. schematic coordinate map

## Required NCP Web Service URLs
- `https://this8369.github.io`
- If path entries are accepted: `https://this8369.github.io/IGIS-Fund-Production-DP/`
- Local QA:
  - `http://localhost:8081`
  - `http://127.0.0.1:8081`
  - `http://localhost:8082`
  - `http://127.0.0.1:8082`
  - `http://127.0.0.1:8083`

## Asset Implemented Components
- 자산 개요 hero
- 자산 선택 selector
- 자산 위치 보기 modal
- KPI strip: 임대율, 총 임대면적, 공실면적, 월 임관리비 총액, E.NOC
- 임차인 현황 table and row detail popup
- 자산 핵심 요약
- 임차인별 월 임관리비 chart/table popup
- 층별 배치
- 면적 구성 table
- 만기 스냅샷 chart/table popup
- 핵심 임차인 cards and detail popup

## Data Source
- Asset options: `src/components/system/workspace/logisticsAssetOptionsData.json`
- Asset payload snapshots: `src/components/system/workspace/logisticsAssetData/*.json`
- Asset payload count: 17

## Local QA
- QA script: `qa-artifacts/logistics-gate6/map-asset-qa-20260513/run-map-asset-qa.cjs`
- Result JSON: `qa-artifacts/logistics-gate6/map-asset-qa-20260513/map-asset-qa-result.json`
- Screenshots:
  - `qa-artifacts/logistics-gate6/map-asset-qa-20260513/home-map-full.png`
  - `qa-artifacts/logistics-gate6/map-asset-qa-20260513/asset-dashboard-full.png`
  - `qa-artifacts/logistics-gate6/map-asset-qa-20260513/popup-asset-map.png`
  - `qa-artifacts/logistics-gate6/map-asset-qa-20260513/popup-asset-roster.png`
  - `qa-artifacts/logistics-gate6/map-asset-qa-20260513/popup-asset-expiry.png`

## Automated Result
- Home dynamic map status: PASS
- Map mode during local QA after NCP allowlist and rebuild: `naver`
- Home map rendered: PASS (`canvas.height=418`, `imageCount=58`, Naver tile images loaded)
- Asset active: PASS
- Asset selector: PASS
- Asset KPI strip: PASS
- Asset sections: PASS
- Asset map popup: PASS
- Asset E.NOC popup: PASS
- Asset roster popup: PASS
- Asset rent popup: PASS
- Asset expiry popup: PASS
- Admin Data / 관리자 검토 포인트 hidden: PASS

## Reviewer Notes
- Map reviewer: previous schematic-only state was blocked. Current implementation adds Naver-first dynamic map with Leaflet fallback.
- Asset reviewer: original Apps Script `renderAsset` is the source, not legacy renderer. KPI strip must exclude `unique_tenant_count`; this is reflected.
- Original Apps Script had a likely `assetMapPoint` undefined risk. New implementation uses `overview.latitude/longitude` directly for the modal.
- Asset parity blockers addressed in this pass:
  - E.NOC popup now includes current asset, average E.NOC, computable/missing/variance row counts, formula note, and audit table.
  - Rent chart and detail button now open the same detailed header set.
  - Stacking plan tenant chips now open tenant detail.
  - Area composition now includes other exclusive, common subtotal, mechanical/electrical, floor core, and other common rows.
  - Sidebar avatar fallback error was fixed; `pageErrors` is now 0.
- Final local reviewer result: PASS for Gate 6 map + Asset unit. Live deployment QA remains a separate follow-up gate.

## Remaining Parity Note
- Naver Maps SDK is active in local QA and `mapMode: naver` is recorded in `map-asset-qa-result.json`.
- Home and Asset map screenshots show actual Naver map tiles and markers, not a blank canvas.
- Browser page error log is now 0 after fixing the sidebar avatar fallback.
- The branch is not deployed/live yet, so live QA must still be rerun after push/deploy.
