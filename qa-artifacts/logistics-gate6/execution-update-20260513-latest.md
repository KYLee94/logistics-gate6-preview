# Gate 6 Latest Execution Update - 2026-05-13

## What Changed

| area | result | evidence |
|---|---|---|
| Supabase qveg readback | `public.ll_payload_snapshots` readback succeeded. `home` snapshot 2 rows, `company` snapshot 61 rows, unique company ids 31. `ll_data_quality_findings` and `ll_tenants` currently read back as 0 rows. No mutation performed. | `supabase-detail-readback-20260513/result.json`, `supabase-snapshot-parity-20260513/result.json` |
| Company option mismatch | Current screen source is snapshot/company JSON, not `ll_tenants`. Snapshot unique company ids 31 and local company options 31 matched with missing 0. | `supabase-snapshot-parity-20260513/summary.md`, `company-selector-change-qa-20260513/result.json` |
| Home monthly cost source | KPI monthly total, asset option sum, company option sum, readback home KPI all matched at `11134228842`. Home KPI popup and tenant donut source were changed from partial `topTenants/topContracts` arrays to full company option source. | `WorkspaceLogistics.jsx`, `supabase-snapshot-parity-20260513/result.json` |
| Home rent trend source gap | The remaining trend/KPI basis gap is now explicitly shown under the trend chart instead of being hidden in the UI. | `WorkspaceLogistics.jsx`, `home-chart-interaction-qa-20260513/result.json` |
| Data Quality readback status | Data Quality tab now attempts optional `VITE_LOGI_SUPABASE_*` readback from `ll_data_quality_findings`; if unavailable or 0 rows, it displays derived checks and the readback status instead of silently mixing sources. | `WorkspaceLogistics.jsx`, `advanced-tabs-browser-qa-20260513/result.json` |
| Chart interaction QA | Rich bar charts now include the metric name in accessible button text, so Data Playground bars can be hovered/clicked consistently and popup QA passes. | `home-chart-interaction-qa-20260513/result.json` |
| Repo secret hygiene | `.env` remains on local disk but was removed from git tracking with `git rm --cached -- .env`; `.gitignore` and `.env.example` remain in place. | `repo-secret-hygiene-20260513/result.json` |

## Verification

| command | result |
|---|---|
| `npx eslint src/components/system/workspace/WorkspaceLogistics.jsx` | pass |
| `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -Command "npm run build"` | pass |
| `node qa-artifacts/logistics-gate6/supabase-detail-readback-20260513.cjs` | pass, qveg read-only SELECT, mutation 0 |
| `node qa-artifacts/logistics-gate6/supabase-snapshot-parity-20260513.cjs` | pass_with_notes |
| `node qa-artifacts/logistics-gate6/company-selector-change-qa-20260513.cjs` | pass |
| `node qa-artifacts/logistics-gate6/home-chart-interaction-qa-20260513.cjs` | pass |
| `node qa-artifacts/logistics-gate6/dashboard-parity-tabs-qa-20260513.cjs` | pass |
| `node qa-artifacts/logistics-gate6/advanced-tabs-static-qa-20260513.cjs` | pass |
| `node qa-artifacts/logistics-gate6/advanced-tabs-browser-qa-20260513.cjs` | pass |
| `node qa-artifacts/logistics-gate6/secret-scan-public-bundle-20260513.cjs` | pass, finding 0 |
| `node qa-artifacts/logistics-gate6/repo-secret-hygiene-20260513.cjs` | pass |

## Remaining Blockers

| blocker | current status | next action |
|---|---|---|
| live Google Sheets 17-tab cell-level preservation | still not proven end-to-end | requires OAuth/API path or user-side auth setup |
| Home rent trend vs portfolio KPI source basis | source gap remains: latest trend adjusted cost `10265767928` vs portfolio KPI `11134228842` | either regenerate payload from one canonical rule or label trend as historical active-contract basis |
| Data Quality actual write/update | UI request flow is present, but real save still requires deployed `/edits/submit` Edge Function and RLS | implement/deploy only after security review |
| Weekly Word ingest actual save | local migration/function draft exists, not deployed | apply migration and deploy function only with approval |
| OpenDART/building-register server integration | still not live-verified from server layer | implement/verify Edge Functions after UI parity work |
| live deployment QA | local/browser QA only | requires deployment target and live URL |
