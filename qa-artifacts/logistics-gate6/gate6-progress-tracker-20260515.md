# Gate 6 Progress Tracker - Logistics Work Platform

- Updated at: 2026-05-22T19:31:00.000+09:00
- Overall: 277 / 342 (81.0%)
- Active work branch: `codex/logistics-gate6-post-deploy-updates`
- gh-pages deployment: executed for compatibility view cleanup release.

## 2026-05-22 Update - Asset Tenant Table Width

- Asset 탭 `임차인 현황` 테이블 컬럼 폭을 전용 설정으로 조정했습니다.
  - RF/FO/TI를 compact 컬럼으로 처리했습니다.
  - 임차인명, 층/세부구역, 면적, 금액, 날짜 컬럼 폭을 Asset 임차인 현황에 맞게 별도 지정했습니다.
  - 해당 테이블에만 tight density를 적용해 좌우 스크롤 발생 가능성을 줄였습니다.
- Verification:
  - `git diff --check`: pass.
  - `npm run build -- --base=/logistics-gate6-preview/`: pass.

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

## 2026-05-22 Update - Home/Asset Metric and Loading UX Repair

- Duplicate checklist review completed:
  - Home/Asset area reconciliation already existed as a data QA theme, but the latest requirement is now locked more specifically: UI must never overwrite source gross floor area to make `gross = leased + vacancy` look true.
  - Yellow API loading block removal existed as a dashboard common item; the Asset fund overview-specific loading block is now included in the same item, not added as a duplicate parent item.
  - OpenDART, building register, and AI chatbot are already tracked under external API/AI items; no duplicate checklist item was added.
  - Tab flicker/performance and overall optimization were strengthened under Dashboard common QA/performance items.
- Home top KPI calculation was corrected:
  - `총 연면적` remains the sum of asset source gross floor area.
  - `총 임대면적` remains the sum of asset leased area.
  - `총 공실면적` remains the sum of asset vacancy area.
  - The UI now exposes `연면적 - 임대면적 - 공실면적 차이` in the evidence modal instead of changing gross area to force equality.
- Asset KPI calculation was corrected with the same rule:
  - Asset gross floor area is source gross first, not `leased + vacancy` first.
  - Each asset KPI modal includes the reconciliation gap.
- Asset `자산개요 · 투자개요 · 펀드개요` main-page 3-column display was replaced by a full-screen modal entry point.
- Asset fund overview normal loading no longer renders the yellow `Supabase 데이터를 확인 중` block.
- Investment overview rows that arrive as one merged `기타 / ...` value are split back into separate item rows for UI readability.
- Dashboard read bridge keeps the previous successful payload during primary-mode loading to reduce tab-switch flicker.
- Verification:
  - `npm run build -- --base=/logistics-gate6-preview/`: pass.
  - `npm run build:preview`: pass.
  - `ll-dashboard-api` Edge Function deployment to qveg: pass.
  - `npm run deploy` to gh-pages: pass.
  - Live URL readback: HTTP 200 and `assets/index-8MRHgdkT.js`.
- Unauthenticated Edge smoke: expected 401, so authenticated browser QA remains a user/manual confirmation item.

## 2026-05-22 Update - Chart Axis / Permission Message / Exposure UX Repair

- Duplicate checklist review completed:
  - API/OpenDART/building-register/AI chatbot quality was already tracked under Stage 13 and remains incomplete. No duplicate item was added.
  - Tab flicker/speed was already tracked under Dashboard common performance. The prior payload-retention fix is partial; full 1/2~1/3 speed target remains open.
  - Yellow API loading block removal was already tracked. This update extends it to dismissible permission/block messages and the fund overview-specific status block.
  - Home/Asset area reconciliation was already tracked. This update confirms the UI no longer overwrites source gross floor area to force equality.
- Implemented:
  - Dashboard blocked/permission message now has an `X` close button.
  - Home `만기 집중도` chart click and detail button now open a fullscreen modal.
  - Home `임차인 계약` table narrows the `자산 목록` column.
  - Home `권역별 노출도` adds both 연면적 비율 and 임관리비 비율 to right-side display, tooltip, and detail table.
  - Asset `만기 스냅샷` and `임차인별 월 임관리비` bar charts hide the unusable x-axis scale labels.
  - Asset `만기 스냅샷` labels add `층` to plain numeric floor values.
  - Company `자산별 노출도` hides the x-axis scale and fills bars by total-share ratio while keeping amount/area values on the right.
  - Analysis Tools asset/company comparison charts hide the unusable x-axis scale labels.
  - Pivot Table result chart hides the unusable x-axis scale labels.
  - Frontend read-permission filtering now honors `otherAsset.read`, `Admin`, and `System Admin` so full-read users are not incorrectly filtered by managed-asset-only logic.
  - Removed hard-coded display overrides that forced 경산/부산 area/KPI values in the frontend. Source gross, leased, and vacancy values remain visible with reconciliation gap evidence instead.
- Verification:
  - `npm run build -- --base=/logistics-gate6-preview/`: pass.
  - `git diff --check`: pass.
  - `npm run deploy`: pass.
  - Live URL readback: HTTP 200 and `assets/index-BBl_dCKm.js`.
  - Subagent static review completed; two risks were found and fixed: Company ratio bar scaling and full-read permission filtering.

## 2026-05-22 Update - Tab Speed / Asset Popup / AI Answer Repair

- Duplicate checklist review completed:
  - Tab flicker and speed were already tracked under Dashboard common performance; this update upgrades the prior partial fix with session-level API result caching and mounted-tab retention.
  - Asset `자산개요 · 투자개요 · 펀드개요` popup work was already tracked under Asset tab; this update adds prefetch/cache and modal-size alignment rather than a new parent item.
  - Home `권역별 노출도` ratio display was already tracked; this update changes the actual bar length to share ratio and hides the x-axis block.
  - AI chatbot quality/context/permission remains tracked under Stage 13. This update adds deterministic server answers for E.NOC and vacancy-rate questions, but broader chatbot quality remains open.
  - New future item added once: remove remaining hardcoded display/data constants so all platform/dashboard values can be Supabase-driven. This is not implemented in this batch.
- Implemented:
  - Dashboard read bridge now uses an in-memory session cache by action/payload, so revisiting tabs can render the last successful Supabase payload immediately.
  - Dashboard tabs remain mounted after first visit to reduce black-screen remount flicker during tab switches.
  - Asset project/fund overview data is prefetched for the selected asset and cached by asset id/name before the fullscreen popup opens.
  - Asset project/fund fullscreen modal sizing now matches the large Work Platform table modal pattern.
  - Investment overview restores a fuller MECE `기타` item template; missing values remain blank for later user editing.
  - Investment overview `기타` group cell is merged again while each item stays on its own row.
  - Home `권역별 노출도` bars now use each region's total-share ratio for both 연면적 and 임관리비 modes, and the x-axis label/tick block is removed.
  - AI context now applies latest rent-history amounts to lease-space rows before answering.
  - AI metric context now includes permission-filtered `dashboard_metric` cache rows instead of discarding them.
  - AI deterministic routing now prioritizes the current user question over older chat history when choosing the asset.
  - AI now answers asset/portfolio E.NOC and vacancy-rate questions with server-side calculations instead of relying on the LLM provider.
- Verification:
  - `git diff --check`: pass.
  - `npm run build -- --base=/logistics-gate6-preview/`: pass.
  - `ll-dashboard-api` Edge Function deployment to qveg: pass.
  - `npm run deploy`: pass.
  - Live URL readback: HTTP 200 and `assets/index-0MEet-kz.js`.
  - `npm run qa:ai-chatbot`: pass, including `부국물류센터 e.noc` and `전체 자산 평균 공실률` regression checks.

| Stage | Area | Done/Total | Rate |
| ---: | --- | ---: | ---: |
| 2 | 怨듯넻 ?곗씠??湲곗? | 18 / 24 | 75.0% |
| 3 | ?낅Т 濡쒓렇 硫붿씤 ?섏씠吏 | 32 / 42 | 76.2% |
| 4 | Dashboard 怨듯넻 | 12 / 19 | 63.2% |
| 5 | Weekly source data after tab removal | 3 / 4 | 75.0% |
| 6 | Home ??| 39 / 44 | 88.6% |
| 7 | Asset ??| 28 / 33 | 84.8% |
| 8 | Company ??| 12 / 17 | 70.6% |
| 9 | Pivot Table | 13 / 14 | 92.9% |
| 10 | Data Quality | 18 / 21 | 85.7% |
| 11 | Analysis Tools | 8 / 11 | 72.7% |
| 12 | DB / Edge / 諛고룷 ?뱀씤?湲?| 33 / 33 | 100.0% |
| 13 | ?몃?沅뚰븳?湲?| 6 / 12 | 50.0% |
| 14 | QA 怨꾪쉷 | 46 / 53 | 86.8% |
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
