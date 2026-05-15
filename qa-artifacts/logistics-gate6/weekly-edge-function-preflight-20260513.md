# Weekly Edge Function Preflight - 2026-05-13

## Scope
- Added draft Supabase Edge Function: `supabase/functions/ll-weekly-doc-ingest/index.ts`
- Added draft migration preview: `supabase/migrations/20260513000100_create_ll_weekly_ingest.sql`
- No Supabase deployment, migration, policy change, or database mutation was executed.

## Write Target Review
All planned write targets are `public.ll_*` only:
- `public.ll_user_permissions`
- `public.ll_weekly_reports`
- `public.ll_weekly_assets`
- `public.ll_weekly_projects`
- `public.ll_weekly_doc_ingest_runs`

## Security Contract
- Browser calls only `ll-weekly-doc-ingest`; parsing and writes stay server-side.
- Edge Function requires `Authorization: Bearer <JWT>`.
- Function calls `auth.getUser(jwt)` and fails with `401` when missing or invalid.
- Function checks `ll_user_permissions.can_ingest_weekly` or `app_metadata.logistics_role`.
- Non-manager roles fail with `403`.
- Service role key is referenced only from Edge Function environment variables.
- No raw SQL input endpoint is created.
- CORS allowlist is environment-configurable through `LL_ALLOWED_ORIGINS`.

## SQL Preview Status
The migration file is a preview artifact. Apply only after a controlled Supabase review.
No `non-ll_*` table, schema, RLS, or policy mutation is included.

## Remaining Blockers
- Actual deployment of `ll-weekly-doc-ingest` is not done.
- Actual creation of `ll_weekly_*` tables/RLS is not done.
- Word parsing is currently first-pass text extraction. The next step is template-specific table mapping against the supplied weekly Word format.
- OpenDART/building-register API integration and Supabase integrity recheck remain deferred until the current screen work is accepted.
