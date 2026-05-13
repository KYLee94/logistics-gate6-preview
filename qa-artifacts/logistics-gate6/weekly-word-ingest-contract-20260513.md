# Weekly Word Ingest Contract - 2026-05-13

## User Request
- Upload a Word file using the same style as `RA부문_사업그룹4파트_주간업무자료(안)_260427_취합`.
- Read the document and update Weekly by year, month, and week.
- Update related Supabase data at the same time.
- Let the Weekly page switch between year/month/week.

## Current Repo Finding
- `WorkspaceLogistics.jsx` currently imports one static baseline file: `logisticsWeeklyReportData.json`.
- The baseline JSON already has `schemaVersion=weekly_report_v2`.
- The final IOTA repo does not currently include a Supabase Edge Function folder.
- The final IOTA repo does not include a Word parser dependency such as `mammoth`, `docx`, or `jszip`.

## Implemented This Pass
- Main worklog page now has a Word upload panel.
- Upload panel collects `file`, `year`, `month`, `week`, `week_key`, and `source_template`.
- Upload panel calls Supabase function `ll-weekly-doc-ingest`.
- Weekly page now has year/month/week selectors.
- Current selector is seeded with the existing baseline week: `2026-04-w4`.
- Browser QA confirms the upload panel and selectors render and interact.

## Required Server Function
Name: `ll-weekly-doc-ingest`

Expected behavior:
- Verify Authorization JWT.
- Re-read user role/scope from Supabase Auth app_metadata or a public `ll_*` permission table.
- Reject unauthenticated calls with 401.
- Reject insufficient permission with 403.
- Accept only `.doc` or `.docx`.
- Store the original Word file in a private bucket or a protected `ll_*` audit table.
- Parse the Word tables and body into `weekly_report_v2`.
- Upsert only public `ll_*` tables.
- Return the normalized weekly report payload and persisted week key.

## Supabase Write Boundary
Allowed target family:
- `public.ll_*` only

Recommended tables:
- `public.ll_weekly_reports`
- `public.ll_weekly_assets`
- `public.ll_weekly_projects`
- `public.ll_payload_snapshots`
- `public.ll_import_runs`

Do not allow:
- Browser direct insert/update/delete for Weekly import.
- Service role key in frontend.
- Public bucket storage for raw Word files.
- Client-supplied role/user_id/scope as authorization truth.
- non-ll_* mutation.

## Blocker
Actual Supabase persistence is still blocked until the Edge Function and matching `ll_*` schema/RLS are implemented and verified.
