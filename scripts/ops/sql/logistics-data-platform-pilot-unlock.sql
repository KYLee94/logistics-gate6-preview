begin;

do $guard$
declare
  active_pilot_count bigint;
  active_asset_count bigint;
  locked_route_count bigint;
  latest_migration_status text;
  latest_critical_exception_count bigint;
begin
  select count(*)
  into active_pilot_count
  from logistics_core.platform_pilot_users
  where is_active = true;

  if active_pilot_count <> 3 then
    raise exception 'Pilot unlock blocked: expected exactly 3 active pilots, found %', active_pilot_count;
  end if;

  select status, critical_exception_count
  into latest_migration_status, latest_critical_exception_count
  from logistics_core.migration_runs
  order by created_at desc
  limit 1;

  if latest_migration_status is distinct from 'validated'
     or coalesce(latest_critical_exception_count, 1) <> 0 then
    raise exception 'Pilot unlock blocked: latest migration status %, critical exceptions %',
      latest_migration_status,
      latest_critical_exception_count;
  end if;

  if exists (
    select 1
    from logistics_core.migration_exceptions
    where severity = 'critical' and resolution_status = 'open'
  ) then
    raise exception 'Pilot unlock blocked: unresolved critical migration exception exists';
  end if;

  if (select count(*) from logistics_core.monthly_ledger_entries where deleted_at is null) <> 0 then
    raise exception 'Pilot unlock blocked: finance ledger must be empty before the first pilot cutover';
  end if;

  select count(*) into active_asset_count
  from logistics_core.assets
  where deleted_at is null;

  select count(*) into locked_route_count
  from logistics_core.asset_writer_routes route
  join logistics_core.assets asset on asset.id = route.asset_id
  where asset.deleted_at is null and route.writer_mode = 'locked';

  if active_asset_count = 0 or locked_route_count <> active_asset_count then
    raise exception 'Pilot unlock blocked: expected % locked asset routes, found %',
      active_asset_count,
      locked_route_count;
  end if;
end;
$guard$;

grant execute on function logistics_api.rent_roll_batch_save(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function logistics_api.finance_batch_save(uuid, text, jsonb, jsonb) to authenticated;

update logistics_core.asset_writer_routes
set writer_mode = 'v2',
    reason = 'Three-user production pilot enabled after validated backfill',
    changed_at = now(),
    changed_by = null,
    revision = revision + 1
where writer_mode is distinct from 'v2';

update logistics_core.platform_feature_flags
set v2_write_enabled = true,
    reason = 'Three-user production pilot enabled after release-gate verification',
    changed_at = now(),
    changed_by = null,
    revision = revision + 1
where flag_key = 'data_platform_v2'
  and v2_write_enabled is distinct from true;

insert into logistics_core.audit_events (
  action,
  entity_type,
  change_payload,
  reason,
  mapping_version,
  correlation_id
) values (
  'pilot_write_unlock',
  'platform_feature_flag',
  jsonb_build_object('active_pilot_count', 3, 'writer_mode', 'v2'),
  'Production pilot unlocked only after the validated release gate',
  'gate6-data-platform-1',
  gen_random_uuid()
);

commit;
