# Gate 6 Progress Tracker - Logistics Work Platform

- Updated at: 2026-05-22T16:55:00.000+09:00
- Overall: 247 / 322 (76.7%)
- Active work branch: `codex/logistics-gate6-post-deploy-updates`
- gh-pages deployment: executed for compatibility view cleanup release.

## 2026-05-22 Update - Data Source Repair / Schema Consolidation

- Current session is branch-first. No gh-pages deployment was executed.
- Added current-row guard for dashboard lease-space reads so superseded source-preserved rows do not mix into Home/Asset/Company totals.
- Rechecked `?ㅼ뭅?대컯??, ?ㅼ뭅?대컯??` against source Excel and Edge payload.
  - Old lease-space/latest-history basis: `639,685,007`.
  - Component-level latest rent-history basis: `745,541,247`.
  - Reason: DB_?덉뒪?좊━ ?꾩쟻 has multiple physical rent components inside one DB_?쇰컲 contract row; old latest-key collapsed them by tenant/floor/zone/temperature only.
- Rechecked `?꾨젅?섏뒪?묒?臾쇰쪟?쇳꽣` against Edge payload.
  - Current component-level latest rent-history basis: `2,468,703,091`.
  - Current component rows: `21`.
  - Regression guard: fail if superseded rows push the value back toward `6,310,831,182` or 29 component rows.
- Added branch-side Edge read correction to recalculate dashboard current amounts from rent-history physical components.
- Added frontend rent-trend component key so trend charts do not collapse split components by `lease_space_id` only.
- Applied schema consolidation through the approved Supabase migration path.
  - Physical `public.ll_*` table count is now `20`.
  - Compatibility views keep old references readable during the transition.
  - Cleanup candidate count is now `0`.

## 2026-05-22 Update - Compatibility View Cleanup Preflight

- Physical table restructuring is not being repeated. The remaining Table Editor clutter is compatibility views.
- Runtime code contract was moved off the legacy view names.
  - Data Quality findings now use `public.ll_audit_events`.
  - Work Platform archive/task source labels now use `ll_work_items`.
  - Weekly references now use `ll_weekly_records`.
- Added an active denylist scan for legacy compatibility view names.
  - Active roots: `src`, `supabase/functions`, `scripts/qa`, `package.json`, `dist`.
  - Result: `0` active references after rebuilding `dist`.
- Catalog inventory now separates `BASE TABLE` and `VIEW`.
  - `base_table_count = 20`
  - `view_count = 21`
  - `legacy_compatibility_view_count = 21`
- Added a rollback-safe SQL preview artifact for compatibility view removal.
  - This is preview only. No view was dropped and no gh-pages deployment was executed.

## 2026-05-22 Update - Compatibility View Cleanup Applied

- gh-pages operating deployment completed for `https://kylee94.github.io/logistics-gate6-preview/`.
- `ll-dashboard-api` and `ll-weekly-doc-ingest` Edge Functions were deployed.
- Legacy compatibility views were removed from Supabase after deployment.
  - `base_table_count = 20`
  - `view_count = 0`
  - `legacy_compatibility_view_count = 0`
  - `cleanup_candidate_count = 0`
- Active source/dist denylist scan for 21 legacy view names passed with `0` findings.
- Live URL smoke returned HTTP 200 and a valid SPA bundle.
- Post-cleanup checks passed:
  - JWT smoke
  - Home/Asset/Company primary parity
  - Data Quality submit/approve/write/readback/audit e2e

| Stage | Area | Done/Total | Rate |
| ---: | --- | ---: | ---: |
| 2 | 怨듯넻 ?곗씠??湲곗? | 18 / 23 | 78.3% |
| 3 | ?낅Т 濡쒓렇 硫붿씤 ?섏씠吏 | 32 / 42 | 76.2% |
| 4 | Dashboard 怨듯넻 | 8 / 16 | 50.0% |
| 5 | Weekly source data after tab removal | 3 / 4 | 75.0% |
| 6 | Home ??| 33 / 41 | 80.5% |
| 7 | Asset ??| 19 / 28 | 67.9% |
| 8 | Company ??| 10 / 15 | 66.7% |
| 9 | Pivot Table | 12 / 13 | 92.3% |
| 10 | Data Quality | 18 / 21 | 85.7% |
| 11 | Analysis Tools | 6 / 9 | 66.7% |
| 12 | DB / Edge / 諛고룷 ?뱀씤?湲?| 33 / 33 | 100.0% |
| 13 | ?몃?沅뚰븳?湲?| 5 / 11 | 45.5% |
| 14 | QA 怨꾪쉷 | 44 / 51 | 86.3% |
| 15 | 理쒖쥌 ?꾨즺 湲곗? | 8 / 15 | 53.3% |

## Latest Priority Update

`Supabase 留덉씠洹몃젅?댁뀡 諛??곌껐 ?꾨즺` parent item 湲곗??쇰줈 ?대쾲 batch瑜?媛깆떊?덉뒿?덈떎.

- `public.ll_*` physical catalog???꾩옱 20媛??뚯씠釉붿엯?덈떎.
- 理쒖쥌 ?댁쁺 紐⑺몴???17~20媛?踰붿쐞??吏꾩엯?덉뒿?덈떎.
- ?듯빀 cleanup ?꾨즺:
  - detail tables -> `ll_lease_attributes`
  - fund tranche tables -> `ll_fund_capital_tranches`
  - audit/source review tables -> `ll_audit_events`
  - Work Platform task/snapshot/issues -> `ll_work_items`
  - board posts -> `ll_board_posts`
  - weekly report/assets/projects/doc ingest -> `ll_weekly_records`
  - source/import/sheet-row lineage -> `ll_source_runs` + `ll_source_cells`
  - asset managers -> `ll_assets.current_manager_*`
- 理쒖떊 catalog: 20 tables, 827 columns, missing PK 0, missing FK index 0, RLS disabled 0, cleanup candidates 0.
- Compatibility views remain for old object names, so Supabase UI may show more `ll_*` objects when views are included. Physical table count is 20.
- Latest object inventory separates `BASE TABLE` 20 and `VIEW` 21. Active runtime/dist references to the 21 legacy compatibility view names are now 0.
- `ll_schema_metadata` is retained as operating metadata for later cross-table PK/FK integration.
- 濡쒓렇??沅뚰븳 湲곗? ?뚯씠釉?`ll_user_permissions`??Supabase??9?됱쑝濡?議댁옱?섎ŉ, Edge Function???고???沅뚰븳 ?먮떒???ъ슜?⑸땲??

## QA Evidence

- `npm run qa:supabase-catalog`: pass
- `npm run qa:legacy-view-denylist`: pass
- `npm run qa:logistics-primary-parity`: pass
- `node tmp\dashboard_component_diff_from_edge.cjs`: pass
- `npm run qa:logistics-jwt-smoke`: pass
- `npm run qa:data-quality-e2e`: pass
- `npm run qa:ai-chatbot`: pass
- `npm run build:preview`: pass
- `git diff --check`: pass
- secret scan: pass; only Edge Function environment variable names were matched, no raw secret value was found in `dist`.

## Current Completion Notes

- Home/Asset/Company/PDF/Analysis/Pivot are wired to the Supabase primary-safe read path and API parity smoke passes.
- Data Quality submit/approve/write/readback/audit end-to-end??pass?덉뒿?덈떎.
- AI 梨쀫큸? ?먯궛 ?? ?뱀젙 ?먯궛 議고쉶, 留λ씫 湲곕컲 E.NOC ?꾩냽 吏덈Ц, production demo fallback 李⑤떒 QA瑜??듦낵?덉뒿?덈떎.
- ?뺤쟻 JSON? 401/403 fallback?쇰줈 ?곗씠吏 ?딆뒿?덈떎. ?쇰? ?뚯씪? 5xx/timeout ?먮뒗 print-safe 蹂댁“ fallback ?⑸룄濡쒕쭔 ?⑥븘 ?덉뒿?덈떎.
- Asset ??留뚭린 ?ㅻ깄?룹? `ll_lease_spaces` 湲곕컲 ?뚯깮 ?됱쓣 ?곗꽑?섍퀬 湲곗〈 snapshot??蹂닿컯媛믪쑝濡쒕쭔 蹂묓빀?섎룄濡??섏젙?덉뒿?덈떎.
- 留뚭린 ?ㅻ깄??李⑦듃??10嫄??쒗븳???댁젣?덇퀬, 媛숈? ?붿뿬媛쒖썡?대㈃ ?믪? 痢듭씠 癒쇱? ?ㅻ룄濡??뺣젹?⑸땲??
- gh-pages ?댁쁺 諛고룷???대쾲 schema/data-source consolidation batch?먯꽌???섑뻾?섏? ?딆븯?듬땲??

## Remaining Risks

- Browser-visible visual parity is still a manual confirmation item before gh-pages deployment.
- Full repo lint can still be noisy because this workspace includes unrelated legacy/IOTA code. Current build and targeted QA pass.
- `ll_schema_metadata` is still a first operating metadata version. Descriptions can be refined later for non-developer Supabase users.
- Physical deletion of bundled static JSON files is deferred until user browser QA confirms the deployed UI. Current core data path is Supabase primary-safe.
