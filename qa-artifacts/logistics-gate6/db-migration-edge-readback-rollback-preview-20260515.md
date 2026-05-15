# Gate 6 DB/Edge 적용 전 readback/rollback preview - 2026-05-15

## 현재 적용 경계
- 현재 Codex Supabase connector에서 보이는 프로젝트는 `qvegpozwrcmspdvjokiz` 하나입니다.
- 로컬 `.env`는 별도 project ref를 가리키고 있어, 실제 DB mutation/Edge deploy 전에는 대상 project ref 확인이 필요합니다.
- 본 문서는 read-only 조사와 적용 전 preview입니다. 실제 migration, Edge deploy, DB write는 이 문서 기준 readback/rollback 조건을 확인한 뒤 수행합니다.

## 현재 read-only 확인 결과
- connector visible project: `qvegpozwrcmspdvjokiz`
- local `.env` Supabase ref: `qgrszltduzblpvpqvkqr`
- `qvegpozwrcmspdvjokiz` 기준 `public.ll_user_permissions`: not found
- `qvegpozwrcmspdvjokiz` 기준 `auth.users`에서 `10524@igisam.com`, `rhksdyd13@gmail.com`: 0 rows
- 따라서 `qvegpozwrcmspdvjokiz`를 실제 Gate 6 대상 프로젝트로 확정하기 전에는 migration/Edge deploy/seed를 실행하지 않습니다.

## 적용 대상 migration
- `supabase/migrations/20260513000100_create_ll_weekly_ingest.sql`
- `supabase/migrations/20260514000100_create_ll_dashboard_api_tables.sql`
- `supabase/migrations/20260515000100_harden_ll_edit_write_audit.sql`

## 적용 대상 Edge Function
- `ll-dashboard-api`
- `ll-weekly-doc-ingest`

## 사전 read-only 확인 쿼리
```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'll_%'
order by table_name;

select to_regclass('public.ll_user_permissions') as ll_user_permissions;
select to_regclass('public.ll_edit_requests') as ll_edit_requests;
select to_regclass('public.ll_data_change_audit_logs') as ll_data_change_audit_logs;
select to_regclass('public.ll_external_api_cache') as ll_external_api_cache;

select email, id, created_at
from auth.users
where lower(email) in ('10524@igisam.com', 'rhksdyd13@gmail.com')
order by email;
```

## 적용 직후 readback 기준
```sql
select to_regclass('public.ll_user_permissions') as ll_user_permissions;
select to_regclass('public.ll_weekly_reports') as ll_weekly_reports;
select to_regclass('public.ll_weekly_assets') as ll_weekly_assets;
select to_regclass('public.ll_weekly_projects') as ll_weekly_projects;
select to_regclass('public.ll_weekly_doc_ingest_runs') as ll_weekly_doc_ingest_runs;
select to_regclass('public.ll_edit_requests') as ll_edit_requests;
select to_regclass('public.ll_worklogs') as ll_worklogs;
select to_regclass('public.ll_api_audit_logs') as ll_api_audit_logs;
select to_regclass('public.ll_data_change_audit_logs') as ll_data_change_audit_logs;
select to_regclass('public.ll_external_api_cache') as ll_external_api_cache;

select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'll_user_permissions',
    'll_weekly_reports',
    'll_weekly_assets',
    'll_weekly_projects',
    'll_weekly_doc_ingest_runs',
    'll_edit_requests',
    'll_worklogs',
    'll_api_audit_logs',
    'll_data_change_audit_logs',
    'll_external_api_cache'
  )
order by c.relname;

select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'll_user_permissions',
    'll_weekly_reports',
    'll_weekly_assets',
    'll_weekly_projects',
    'll_weekly_doc_ingest_runs',
    'll_edit_requests',
    'll_worklogs',
    'll_api_audit_logs',
    'll_data_change_audit_logs',
    'll_external_api_cache'
  )
order by tablename, policyname;

select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and tablename in ('ll_edit_requests', 'll_data_change_audit_logs', 'll_external_api_cache')
order by tablename, indexname;

select count(*) as ll_external_api_cache_rows
from public.ll_external_api_cache;
```

## Data Quality end-to-end readback 기준
1. `edits/submit`
   - 요청 row가 `ll_edit_requests.status = 'submitted'`로 생성되어야 합니다.
   - `request_payload.submit_readbacks`에 submit 시점 DB 값, before 값, `stale_at_submit`가 남아야 합니다.
   - 브라우저 직접 `supabase.from(...).insert/update/delete/upsert` 없이 Edge Function만 호출되어야 합니다.
2. `edits/readback`
   - 승인 직전 현재 DB 값이 다시 읽혀야 합니다.
   - 요청 당시 before 값과 다르면 `stale = true`가 표시되어야 합니다.
3. `edits/approve`
   - 자기 승인 금지.
   - target table/field allowlist 통과.
   - target row 기준 asset permission 재검증.
   - write 후 readback 값이 요청값과 일치해야 합니다.
   - `ll_data_change_audit_logs`에 before/after/readback/actor/approver/source row/cell/status가 남아야 합니다.
4. `edits/reject`
   - `submitted` 상태만 반려 가능해야 합니다.
   - 자기 반려는 별도 cancel flow가 아니므로 차단합니다.

## 외부 API cache/readback 기준
1. cache miss: provider 호출 후 `ll_external_api_cache`에 `provider`, `cache_key`, redacted `request_payload`, redacted `response_payload`, `provider_status`, `fetched_at`, `expires_at` 저장.
2. cache hit: 동일 요청은 provider 재호출 없이 cache response 반환.
3. provider 장애: 만료 cache가 있으면 `cache.stale = true`로 fallback 반환.
4. secret redaction: `GOOGLE_AI_KEY`, OpenDART, 건축물대장, Naver, service role 계열 값은 audit/cache/API response에 나오지 않아야 합니다.

## rollback SQL preview
```sql
drop policy if exists "ll_external_api_cache_read_manager" on public.ll_external_api_cache;
drop table if exists public.ll_external_api_cache;

drop policy if exists "ll_data_change_audit_logs_read_manager" on public.ll_data_change_audit_logs;
drop table if exists public.ll_data_change_audit_logs;

alter table if exists public.ll_edit_requests
  drop column if exists write_started_at,
  drop column if exists written_at,
  drop column if exists write_status,
  drop column if exists write_error,
  drop column if exists write_result;

drop table if exists public.ll_api_audit_logs;
drop table if exists public.ll_worklogs;
drop table if exists public.ll_edit_requests;

drop table if exists public.ll_weekly_doc_ingest_runs;
drop table if exists public.ll_weekly_projects;
drop table if exists public.ll_weekly_assets;
drop table if exists public.ll_weekly_reports;
drop table if exists public.ll_user_permissions;
```

## 주의
- rollback은 새 `ll_*` 운영 테이블까지 삭제하므로 실제 실행 전 row count와 업무 영향 확인이 필요합니다.
- 기존 `ll_assets`, `ll_tenants`, `ll_leases`, `ll_rent_history`, `ll_sheet_rows`, `ll_source_cells`, `ll_payload_snapshots`는 rollback 대상에 포함하지 않습니다.
