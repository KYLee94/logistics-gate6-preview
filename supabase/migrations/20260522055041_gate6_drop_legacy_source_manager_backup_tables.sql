-- Gate 6 operating schema cleanup: consolidate source row/import tracking,
-- asset manager assignments, and temporary migration row backups.

begin;

-- Preserve legacy row payloads in the consolidated audit stream before dropping
-- the remaining small legacy physical tables.
insert into public.ll_audit_events (event_type, legacy_table, legacy_id, event_payload, created_at, updated_at)
select 'legacy_row_archive', 'public.ll_asset_managers', asset_manager_id,
       to_jsonb(t), created_at, coalesce(updated_at, created_at, now())
from public.ll_asset_managers t
where not exists (
  select 1 from public.ll_audit_events e
  where e.event_type = 'legacy_row_archive'
    and e.legacy_table = 'public.ll_asset_managers'
    and e.legacy_id = t.asset_manager_id
);

insert into public.ll_audit_events (event_type, legacy_table, legacy_id, event_payload, created_at, updated_at)
select 'legacy_row_archive', 'public.ll_import_runs', import_id,
       to_jsonb(t), created_at, coalesce(finished_at, created_at, now())
from public.ll_import_runs t
where not exists (
  select 1 from public.ll_audit_events e
  where e.event_type = 'legacy_row_archive'
    and e.legacy_table = 'public.ll_import_runs'
    and e.legacy_id = t.import_id
);

insert into public.ll_audit_events (event_type, legacy_table, legacy_id, event_payload, created_at, updated_at)
select 'legacy_row_archive', 'public.ll_sheet_rows', sheet_row_id,
       to_jsonb(t), created_at, created_at
from public.ll_sheet_rows t
where not exists (
  select 1 from public.ll_audit_events e
  where e.event_type = 'legacy_row_archive'
    and e.legacy_table = 'public.ll_sheet_rows'
    and e.legacy_id = t.sheet_row_id
);

insert into public.ll_audit_events (event_type, legacy_table, legacy_id, event_payload, created_at, updated_at)
select 'migration_row_backup', table_name, id::text,
       jsonb_build_object(
         'migration_id', migration_id,
         'table_name', table_name,
         'row_key', row_key,
         'before_payload', before_payload
       ),
       created_at, created_at
from public.ll_migration_row_backups t
where not exists (
  select 1 from public.ll_audit_events e
  where e.event_type = 'migration_row_backup'
    and e.legacy_id = t.id::text
);

-- Keep the latest manager assignment directly on ll_assets.
update public.ll_assets a
set current_manager_name = m.manager_name,
    current_manager_team = m.manager_team,
    current_manager_email = m.manager_email,
    updated_at = now()
from public.ll_asset_managers m
where m.asset_id = a.asset_id;

-- Move source-row/import FKs from legacy tables to ll_source_runs.
alter table public.ll_source_cells drop constraint if exists ll_source_cells_import_id_fkey;
alter table public.ll_source_cells
  add constraint ll_source_cells_import_id_fkey
  foreign key (import_id) references public.ll_source_runs(source_run_id)
  on update cascade on delete restrict;

alter table public.ll_assets drop constraint if exists ll_assets_source_sheet_row_id_fkey;
alter table public.ll_assets
  add constraint ll_assets_source_sheet_row_id_fkey
  foreign key (source_sheet_row_id) references public.ll_source_runs(source_run_id)
  on update cascade on delete set null;

alter table public.ll_tenants drop constraint if exists ll_tenants_source_sheet_row_id_fkey;
alter table public.ll_tenants
  add constraint ll_tenants_source_sheet_row_id_fkey
  foreign key (source_sheet_row_id) references public.ll_source_runs(source_run_id)
  on update cascade on delete set null;

alter table public.ll_leases drop constraint if exists ll_leases_source_sheet_row_id_fkey;
alter table public.ll_leases
  add constraint ll_leases_source_sheet_row_id_fkey
  foreign key (source_sheet_row_id) references public.ll_source_runs(source_run_id)
  on update cascade on delete set null;

alter table public.ll_lease_spaces drop constraint if exists ll_lease_spaces_source_sheet_row_id_fkey;
alter table public.ll_lease_spaces
  add constraint ll_lease_spaces_source_sheet_row_id_fkey
  foreign key (source_sheet_row_id) references public.ll_source_runs(source_run_id)
  on update cascade on delete set null;

alter table public.ll_rent_history drop constraint if exists ll_rent_history_source_sheet_row_id_fkey;
alter table public.ll_rent_history
  add constraint ll_rent_history_source_sheet_row_id_fkey
  foreign key (source_sheet_row_id) references public.ll_source_runs(source_run_id)
  on update cascade on delete set null;

drop table if exists public.ll_asset_managers cascade;
drop table if exists public.ll_import_runs cascade;
drop table if exists public.ll_sheet_rows cascade;
drop table if exists public.ll_migration_row_backups cascade;

create view public.ll_asset_managers with (security_invoker = true) as
select
  a.asset_id || ':manager' as asset_manager_id,
  a.asset_id,
  a.asset_code,
  a.asset_name,
  a.fund_code,
  a.fund_name,
  a.current_manager_name as manager_name,
  a.current_manager_team as manager_team,
  a.current_manager_email as manager_email,
  a.source_sheet_row_id,
  jsonb_build_object('source', 'll_assets.current_manager_*') as source_payload,
  a.created_at,
  a.updated_at
from public.ll_assets a
where a.current_manager_name is not null
   or a.current_manager_email is not null
   or a.current_manager_team is not null;

create view public.ll_import_runs with (security_invoker = true) as
select import_id, source_type, source_name, spreadsheet_id, file_name, started_at, finished_at,
       status, row_counts, memo, created_at
from public.ll_source_runs
where record_type = 'import_run';

create view public.ll_sheet_rows with (security_invoker = true) as
select source_run_id as sheet_row_id, import_id, source_type, source_name, sheet_name,
       row_number, header_row_number, row_values_json, row_hash, created_at
from public.ll_source_runs
where record_type = 'sheet_row';

create view public.ll_migration_row_backups with (security_invoker = true) as
select
  id,
  event_payload->>'migration_id' as migration_id,
  legacy_table as table_name,
  event_payload->>'row_key' as row_key,
  event_payload->'before_payload' as before_payload,
  created_at
from public.ll_audit_events
where event_type = 'migration_row_backup';

grant select on public.ll_asset_managers to authenticated, service_role;
grant select on public.ll_import_runs to authenticated, service_role;
grant select on public.ll_sheet_rows to authenticated, service_role;
grant select on public.ll_migration_row_backups to authenticated, service_role;

insert into public.ll_schema_metadata (
  metadata_id, metadata_key, object_type, table_schema, table_name, column_name,
  data_type, is_nullable, domain_group, role_category, description, source_system, is_active, created_at, updated_at
) values
  (gen_random_uuid(), 'cleanup:public.ll_asset_managers', 'table', 'public', 'll_asset_managers', null,
   null, true, 'Core Normalized', 'compatibility_view', 'Compatibility view over ll_assets current_manager fields.', 'gate6_cleanup_20260522055041', true, now(), now()),
  (gen_random_uuid(), 'cleanup:public.ll_import_runs', 'table', 'public', 'll_import_runs', null,
   null, true, 'Raw Source', 'compatibility_view', 'Compatibility view over ll_source_runs where record_type=import_run.', 'gate6_cleanup_20260522055041', true, now(), now()),
  (gen_random_uuid(), 'cleanup:public.ll_sheet_rows', 'table', 'public', 'll_sheet_rows', null,
   null, true, 'Raw Source', 'compatibility_view', 'Compatibility view over ll_source_runs where record_type=sheet_row.', 'gate6_cleanup_20260522055041', true, now(), now()),
  (gen_random_uuid(), 'cleanup:public.ll_migration_row_backups', 'table', 'public', 'll_migration_row_backups', null,
   null, true, 'Permission / Audit', 'compatibility_view', 'Migration backup rows archived into ll_audit_events.', 'gate6_cleanup_20260522055041', true, now(), now())
on conflict (metadata_key) do update set
  object_type = excluded.object_type,
  table_schema = excluded.table_schema,
  table_name = excluded.table_name,
  domain_group = excluded.domain_group,
  role_category = excluded.role_category,
  description = excluded.description,
  source_system = excluded.source_system,
  is_active = excluded.is_active,
  updated_at = now();

commit;
