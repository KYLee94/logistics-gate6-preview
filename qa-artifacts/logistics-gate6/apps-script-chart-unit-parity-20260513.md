# Apps Script Chart / Unit Parity - 2026-05-13

## Scope

- Baseline source: `C:\Users\10524\Desktop\codex_realasset\Project\03_Logi_Leasing_Dashboard\Client.html`
- New implementation: `C:\tmp\IGIS-Fund-Production-DP\src\components\system\workspace\WorkspaceLogistics.jsx`
- QA screenshots:
  - `C:\tmp\IGIS-Fund-Production-DP\qa-artifacts\logistics-gate6\chart-unit-parity-qa-20260513\home-chart-parity.png`
  - `C:\tmp\IGIS-Fund-Production-DP\qa-artifacts\logistics-gate6\company-selector-change-qa-20260513\company-before.png`
  - `C:\tmp\IGIS-Fund-Production-DP\qa-artifacts\logistics-gate6\company-selector-change-qa-20260513\company-after.png`
- QA result JSON:
  - `C:\tmp\IGIS-Fund-Production-DP\qa-artifacts\logistics-gate6\chart-unit-parity-qa-20260513\result.json`
  - `C:\tmp\IGIS-Fund-Production-DP\qa-artifacts\logistics-gate6\company-selector-change-qa-20260513\result.json`

## Baseline Chart Rules Found In Apps Script

| tab | baseline chart | baseline source lines | chart type | X axis | Y axis / unit | legend / series | click popup |
|---|---|---:|---|---|---|---|---|
| Home | `home-rent-chart` | `Client.html:4178` | Chart.js line/mixed | `month` | left `currency`, right `count` | `monthlyRentTotalAdjusted` 월 임대료(RF/FO 반영), `monthlyMfTotalAdjusted` 월 관리비, `monthlyCostTotalAdjusted` 월 임관리비(RF/FO 반영), `grossFloorAreaDisplay` 총 연면적(만㎡), `activeAssetCount` 자산 수 | `임대료 추이 원본 표` |
| Home | `home-expiry-chart` | `Client.html:4192` | Chart.js bar/line mixed | `month` | left `area`, right `count` | `expiringAreaSqm` 만기 임대면적, `uniqueTenantCount` 만기 임차인 수 | `openHomeExpiryDetailModal_` |
| Asset | `asset-rent-chart` | `Client.html:5155` | Chart.js bar | tenant | currency | `monthlyCostTotal` 월 임관리비 | `임차인별 월 임관리비` |
| Asset | `asset-expiry-chart` | `Client.html:5161` | Chart.js bar | tenant | months | `monthsToExpiry` 잔여 개월 | `만기 스냅샷` |
| Company | `company-exposure-chart` | `Client.html:4459` | Chart.js bar | asset | area or currency | exposure mode: 임대면적 / 월 임관리비 | `자산별 노출도` |
| Sector | `sector-region-chart` | `Client.html:6915` | Chart.js bar | region | currency | 권역별 월 임관리비 | `권역별 노출도 원본 표` |
| Sector | `sector-rent-chart` | `Client.html:6921` | Chart.js line | `month` | currency | `monthlyRentTotal` 월 임대료, `monthlyMfTotal` 월 관리비 | `월 임관리비 추이 원본 표` |
| Analysis Tools | `tools-benchmark-chart` | `Client.html:7241` | Chart.js bar | asset | currency | 월 임대료 | `벤치마크 원본 표` |
| Data Playground | `playground-chart` | `Client.html:7520` | Chart.js bar | selected dimension | selected metric | current metric label | `데이터 분석 차트 원본` |

## Fixes Applied In This Pass

| item | before | after | QA status |
|---|---|---|---|
| Company selector | company JSON payloads were keyed only by internal payload fields; many payloads had no tenant id field, so selector fell back to the same company | payload map now falls back to the JSON filename stem such as `tenant_brn_1078198143` | pass |
| Home rent trend legend | showed only 월 임관리비 + 자산 수 | now shows the Apps Script 5-series baseline: 월 임대료(RF/FO 반영), 월 관리비, 월 임관리비(RF/FO 반영), 총 연면적(만㎡), 자산 수 | pass |
| Home rent trend axes | generic primary/secondary wording had appeared in earlier chart work | explicit `X축: 월별 기간`, left Y axis labels, right Y axis labels | pass |
| Chart hover details | insufficient detail in SVG points | each visible point has title-based hover detail with month and series values | partial pass |

## Current Precision Parity Result

| area | status | evidence | note |
|---|---|---|---|
| Company selector data switching | pass | `company-selector-change-qa-20260513/result.json` | selected company changed from `(주)LG생활건강` to `(주)버킷플레이스`, and page content changed |
| Home rent chart label/unit parity | pass | `chart-unit-parity-qa-20260513/result.json` | 5 baseline legend labels and axis copy are present |
| Home expiry chart unit parity | partial | source comparison only | series labels now match baseline, but exact Chart.js mixed bar/line rendering still needs visual baseline comparison |
| Remaining tabs chart parity | blocked for full pass | source matrix above | source-level baseline is extracted; live Apps Script runtime screenshot comparison still needs long-loading browser capture |

## Blockers / Next Work

- The full 1:1 chart rendering comparison still needs baseline Apps Script runtime screenshots for each chart after long load.
- Current new implementation uses SVG charts, while Apps Script uses Chart.js. Labels, units, data keys, and click popups can be matched; exact Chart.js rendering parity requires either Chart.js adoption or visual tolerance rules.
- External map / remote resources are blocked in the local QA sandbox and recorded separately as `networkBlocked`; they did not cause page runtime errors in the chart and Company selector checks.

## Subagent Reviewer Finding

- Reviewer role: existing Apps Script chart/unit parity auditor.
- Gate decision: `fail`.
- Main reasons:
  - Home doughnut charts from Apps Script (`저온/상온 구성`, `섹터별 월 임관리비`) are not yet restored in the new Home layout.
  - Sector monthly rent trend is still visually reinterpreted as a stacked period chart instead of the original 2-series line chart.
  - Analysis Tools, Data Playground, and Data Quality still need chart/filter/popup parity implementation.
  - Apps Script popups consistently include basis lines for 기준 시점, 범위, 단위, 근거. Several React modals still show only tables.
