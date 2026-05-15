# Next Execution Backlog Update - 2026-05-13

## Resolved Or Reclassified

| item | status |
|---|---|
| Company 31 vs 36 mismatch | Reclassified. Current dashboard source is `ll_payload_snapshots`/static snapshot JSON, and snapshot unique company ids match local options at 31 vs 31. `ll_tenants` currently reads back as 0 rows, so it is not the current parity source. |
| Home monthly cost portions | Partially resolved. KPI, asset option sum, company option sum, and readback home KPI all match at `11134228842`. Home popup and tenant donut now use full company option source, not partial `topTenants/topContracts`. |
| Data Playground chart hover/click | Resolved in local QA. Rich bar chart buttons now expose the metric name and open detail popups consistently. |
| Repo `.env` tracking | Resolved in git index. `.env` remains locally but is no longer tracked; `.gitignore` and `.env.example` are present. |

## Still Blocked

| item | reason |
|---|---|
| live Google Sheets 17-tab cell-level preservation | Needs authenticated Sheets/API extraction path. |
| Home rent trend source | Latest trend adjusted total is still `10265767928`, while portfolio KPI is `11134228842`; this needs canonical payload regeneration or explicit trend-basis labeling. |
| Data Quality real edit save | Needs `/edits/submit` Edge Function, RLS, and permission table deployment. |
| Weekly Word ingest real save | Local function/migration draft exists but has not been applied or deployed. |
| OpenDART/building-register APIs | Must be server-side Edge Functions; not live-verified yet. |
| live QA | Requires deployment/live URL. |

## Next Local-Only Work

1. Tighten Home rent trend labels/popups so the current source gap is visible and not mistaken for KPI mismatch.
2. Extend popup numeric parity QA to Home/Asset/Company/Sector modal tables.
3. Build static contract for `/edits/submit` and `/edits/approve` using only `public.ll_*` targets.
4. Add read-only source coverage report for `ll_payload_snapshots` by page/entity to separate missing source from UI defects.
