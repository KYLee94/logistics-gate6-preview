# Gate 6 data value repair readback - 2026-05-22

## Scope

- User-reported issue: dashboard values became inconsistent, especially `아레나스양지물류센터` monthly total showing `63.1억` and Asset tenant rows showing duplicated/split rows.
- Initial mode: branch-only investigation and local code fix.
- Later mode: approved Supabase migration and Edge Function redeploy were applied; see the final readback lock section below.
- gh-pages deploy: none.

## Root Cause

`ll_lease_spaces` contains both:

- current rows used by the dashboard
- preserved historical/source rows with `contract_status = 'superseded_by_db_history_split'`

The deployed/dashboard read path was allowing the superseded rows into the screen aggregation. That made `아레나스양지물류센터` show the sum of current split rows and old DB_일반 aggregate rows.

## Readback Evidence

### 아레나스양지물류센터

| basis | rows | monthly cost |
|---|---:|---:|
| current `ll_lease_spaces` excluding superseded/inactive/expired/terminated/cancelled | 21 | 2,468,703,091 |
| `ll_rent_history` where `is_latest = true` | 21 | 2,468,703,091 |
| superseded source-preserved rows | 8 | 3,842,128,091 |
| bad mixed total if both are included | 29 | 6,310,831,182 |

Conclusion: `63.1억` is not the correct current value. It is a mixed-source total.

### Portfolio Current Total

| basis | rows | monthly cost |
|---|---:|---:|
| current `ll_lease_spaces` excluding superseded/inactive/expired/terminated/cancelled | 72 | 13,078,587,556 |
| `ll_rent_history` where `is_latest = true` | 75 | 13,078,587,556 |
| superseded source-preserved rows | 8 | 3,842,128,091 |

### Asset-by-Asset Current Check

| asset | current lease cost | latest history cost | diff | superseded rows |
|---|---:|---:|---:|---:|
| 경산 쿠팡물류센터 | 1,060,724,933 | 1,060,724,933 | 0 | 0 |
| 동산물류센터 | 492,674,649 | 492,674,649 | 0 | 0 |
| 두동 LG전자 통합물류센터 | 630,228,000 | 630,228,000 | 0 | 0 |
| 부국물류센터 | 155,328,845 | 155,328,845 | 0 | 0 |
| 부산송정물류센터 | 0 | 0 | 0 | 0 |
| 스카이박스1, 스카이박스2 | 639,685,007 | 639,685,007 | 0 | 0 |
| 아레나스안성 | 0 | 0 | 0 | 0 |
| 아레나스양지물류센터 | 2,468,703,091 | 2,468,703,091 | 0 | 8 |
| 안성 성은지구 물류센터 | 604,357,000 | 604,357,000 | 0 | 0 |
| 안성 홈플러스 중부허브 물류센터 | 629,174,800 | 629,174,800 | 0 | 0 |
| 양산 유산동 물류센터 | 251,987,517 | 251,987,517 | 0 | 0 |
| 에이블로지스물류센터 | 245,219,187 | 245,219,187 | 0 | 0 |
| 여주 본두리 물류센터 | 1,028,369,423 | 1,028,369,423 | 0 | 0 |
| 이천 마장면 물류센터 | 275,622,000 | 275,622,000 | 0 | 0 |
| 인천석남물류센터 | 2,863,471,002 | 2,863,471,002 | 0 | 0 |
| 평택아디다스물류센터 | 460,486,000 | 460,486,000 | 0 | 0 |
| 화성 석포리 물류센터 | 1,272,556,102 | 1,272,556,102 | 0 | 0 |

### Current Duplicate Risk

Current-contract duplicate grouping by `asset_id + tenant_id + floor + detail_area + temperature_type` returned only one candidate:

- `에이블로지스물류센터 / 아워박스(주) / temperature=N`
- This is not an obvious duplicate because the two lease space ids represent different B4~B3 and B2~B1 floor-zone strings that are normalized into blank display labels.

## Code Fix Applied Locally

### Edge Function

File: `supabase/functions/ll-dashboard-api/index.ts`

- Added `isCurrentDashboardLeaseSpace()` and `currentDashboardLeaseSpaces()`.
- Applied current-row filtering to:
  - `dashboard/home/read`
  - `dashboard/asset/read`
  - `dashboard/company/read`
  - AI search context
  - AI demo fallback context
  - dashboard metric refresh
- Temporarily de-prioritized stale `ll_cache_entries(cache_type='dashboard_metric')` inside AI evidence until metric cache is refreshed through the corrected filter.
- Metric refresh fallback now uses only `ll_rent_history.is_latest = true` if a lease-space source is unavailable.

### Frontend Defense

File: `src/components/system/workspace/WorkspaceLogistics.jsx`

- Added `isCurrentDashboardLeaseRow()` and `filterCurrentDashboardLeaseRows()`.
- Applied the filter to dashboard read adapters.
- Added tenant display fallback so internal ids such as `tenant_brn_1208800767` are not shown when a human tenant name exists.
- Applied the same display guard to tenant contract grouping.

## Verification

- `git diff --check`: pass
- `npx eslint src/components/system/workspace/WorkspaceLogistics.jsx scripts/qa/logistics-dashboard-primary-parity.cjs`: pass
- `npm run build:preview`: pass

## Remaining Data Watch Items

The old active/superseded filter issue has been closed through the later Supabase migration/readback lock below. Remaining watch items are narrower:

1. Static JSON fallback still exists physically in the bundle. It is blocked for 401/403 and should only remain as 5xx/timeout or print-safe fallback until manual browser QA is complete.
2. `ll_cache_entries` rows are operating cache only. They must not override the canonical component-level latest rent-history basis.
3. If future source uploads add split components, the regression guard should continue checking asset-level totals against component-level rows.

## 2026-05-22 Skybox Follow-up

`스카이박스1, 스카이박스2` was rechecked against the source Excel:

- Old `ll_lease_spaces` / `ll_rent_history.is_latest` basis: `639,685,007`.
- Source Excel `DB_히스토리 누적` contains multiple physical rent components inside one DB_일반 contract row.
- Important examples:
  - 봄날창고 / 스카이박스2 / 3층: 4,211.67 sqm, 183.47 sqm, 874.21 sqm components.
  - 싸이버로지텍 / 스카이박스2 / 4층: 4,999.5 sqm, 97.25 sqm, 1,867.7 sqm components.
- The old latest-key grouped by tenant/floor/zone/temperature only. It therefore dropped split components and under-counted the asset.
- Local recomputation from the Edge asset payload using component-level latest selection returned expected current monthly cost `745,541,247`.
- Branch fix:
  - Edge dashboard read payload now recalculates lease-space current amounts from rent-history components keyed by asset, tenant, contract space, floor, zone, temperature, rounded leased area, and rounded exclusive area.
  - Frontend rent trend rows now use the same component key instead of only `lease_space_id`.
- This old note was superseded by the later Supabase migration/readback below.

## 2026-05-22 Supabase Migration / Edge Readback Lock

After applying the approved Supabase migration and redeploying `ll-dashboard-api`, the Edge payload was checked again.

### Current Sentinel Values

| asset | current component rows | rent history rows | current monthly cost | diff |
|---|---:|---:|---:|---:|
| 스카이박스1, 스카이박스2 | 14 | 50 | 745,541,247 | 0 |
| 아레나스양지물류센터 | 21 | 70 | 2,468,703,091 | 0 |

### Portfolio Lock

| metric | value |
|---|---:|
| readable assets | 17 |
| current `ll_lease_spaces` rows used by dashboard | 72 |
| `ll_rent_history` rows | 163 |
| portfolio current monthly cost | 13,184,443,796 |

### Guardrails

- `아레나스양지물류센터` must not include superseded source-preserved rows that push the value toward `6,310,831,182`.
- `스카이박스1, 스카이박스2` must keep split rent-history components. The pass value is `745,541,247`, not the old collapsed `639,685,007`.
- Dashboard read payload now uses the component-level latest-rent basis for current amounts, so Home/Asset/Company totals are aligned.

### Verification

- `node tmp\dashboard_component_diff_from_edge.cjs`: pass, all asset diffs `0`.
- `npm run qa:logistics-primary-parity`: pass.
- `npm run qa:logistics-jwt-smoke`: pass.
- `npm run qa:supabase-catalog`: pass, physical `public.ll_*` table count `20`, cleanup candidates `0`.
