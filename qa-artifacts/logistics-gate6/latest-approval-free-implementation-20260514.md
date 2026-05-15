# Gate 6 approval-free implementation update - 2026-05-14

## Scope
- DB mutation, migration apply, Edge Function deploy, RLS/policy change, commit/push were not executed.
- This pass only changed local UI/source and QA scripts, then verified with local build/static/browser QA.

## Implemented locally
- Work platform naming:
  - Main title and sidebar label changed to `물류센터 워크 플랫폼`.
  - Main subtitle changed to `물류센터 관련 업무 현황 및 이슈, 데이터 기반 대시보드`.
  - Dashboard return button changed to `물류센터 워크 플랫폼`.
  - `원본 기준` pill removed.
  - Button colors aligned: Dashboard/return with `+ Task 등록하기`, weekly upload with `담당 및 권한`.
- Main worklog:
  - Assigned asset chips use fixed-size two-row layout and no forced asset code display.
  - Task edit/delete/complete now open confirmation modal first.
  - Edit mode hides the top register/cancel control that could be confused with edit completion.
- Weekly:
  - Upload week options use Monday-Sunday ranges.
  - Existing Word sample week alignment is covered by browser QA for free year/month/week selection.
  - Project contents render as bullet lines instead of slash-run text.
- Home:
  - Portfolio map height aligned with the right table; map provider text removed.
  - Use-category legend restricted to `상온창고`, `복합`, `저온창고`, `사무실`.
  - `0.0%` category no longer displays as `1평`.
  - Use-category colors set to 상온창고 orange, 저온창고 sky blue, 복합 purple, 사무실 gray.
  - Doughnut tooltips are fixed-position, right of cursor, and follow cursor movement.
  - Tenant contract full modal includes asset/tenant filters, wider source-rich columns, horizontal scroll, and sticky tenant/asset columns.
- Company:
  - Removed the top one-line blocks for 대상/기준시점/계약·금액/DART/지도.
  - Kept company leased-asset map and DART detail/refresh components.
  - Company selected tenant changes propagate to visible content and persist on re-entry.
- Dashboard permission scope:
  - Home, Asset, Company, Analysis Tools, Data Playground use readable-asset filtering helpers locally.
  - Data Quality tab is visible only for 기획추진센터 users named 이시정, 전기영, 이관용; tab color is orange.
- Tables:
  - Shared DataTable column sizing adjusted so short Home tables no longer over-expand first column.

## QA evidence
- Build: `npm run build` pass.
- ESLint: targeted source and QA scripts pass.
- Browser QA: `qa-artifacts/logistics-gate6/latest-weekly-home-asset-browser-qa-20260514/result.json`
  - `allPass=true`
  - Includes weekly selector, project bullets, button rename/color-related text checks, Home tooltip cursor-follow, tenant modal sticky columns, Asset E.NOC/fund/expiry, Company DART/map preservation, Data Quality hidden state, and Task edit/delete/complete confirmation modals.
- Table QA: `qa-artifacts/logistics-gate6/table-column-width-wrap-qa-20260514/result.json`
  - `allPass=true`
  - Checks no unnecessary scroll, no oversized first column, no unexpected nowrap overflow, numeric right alignment, no page/console errors.
- Home/Asset data-static QA: `qa-artifacts/logistics-gate6/home-enoc-use-contract-qa-20260514.json`
  - Code checks pass.
  - Five assets remain flagged for missing/outlier E.NOC or user-named review; no DB overwrite was executed.
- Company selector QA: `qa-artifacts/logistics-gate6/company-selector-change-qa-20260513/result.json`
  - `allPass=true`
  - Confirms selector changes content, re-entry persistence, top one-line blocks removed, map/DART/leased asset table preserved.
- Security/static QA:
  - `qa-artifacts/logistics-gate6/edge-api-security-static-qa-20260514/result.json`
  - Logistics Gate checks pass; legacy non-logistics IOTA direct mutations remain separated as existing technical debt.
  - `qa-artifacts/logistics-gate6/repo-secret-hygiene-20260513/result.json` pass.

## Still approval-needed
- Apply DB migrations or mutate `public.ll_*` data.
- Activate real Data Quality submit/approve/readback/write/audit flow against Supabase.
- Append live Sheets 17-tab cell-level manifest to Supabase.
- Set OpenDART, building register, and Naver geocoding secrets.
- Deploy Edge Functions.
- Run live QA on deployed URL with authenticated users.
- Commit and push.

## External-permission-needed
- Valid live auth/session for role-by-role QA.
- API keys and provider console/domain settings for OpenDART, building register, and Naver geocoding.
- User approval for any write/deploy/commit step.

## Addendum - current user fixes
- Doughnut chart segments now use exact SVG arc paths instead of overlapping dashed circles, so hover/click events are tied to the actual segment.
- Rich trend axes use stronger axis/tick styling and area charts scale by clean `평` tick values.
- Asset 면적 구성 removed 임대면적/공실면적 rows. 전체 연면적 is recalculated from 전용면적 subtotal + 공용면적 subtotal, and all ratios use that basis.
- Company layout narrows the leased-asset map column and expands the right DART detail column.
- Analysis Tools now supports metric switching for the benchmark chart and matrix.
- Data Quality edit request popup is now Excel-like: sheet/table/row/source cell/field/before/after/reason columns, multiple rows, and `cell_edits` submit payload.
- Main-page integrated search preview removes the large map and shows richer asset/tenant contract details.
- Additional static QA: `qa-artifacts/logistics-gate6/current-user-fixes-static-qa-20260514/result.json`.
