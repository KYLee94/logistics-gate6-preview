-- Keep the temporary Gate 6 login restriction in force after the initial
-- three-user cutover. Permission-admin updates cannot reactivate a non-pilot
-- principal until this trigger is removed by a later owner-approved migration.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function logistics_core.enforce_temporary_login_gate()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, logistics_core
as $body$
begin
  if lower(btrim(coalesce(new.account_status, ''))) = 'active'
     and not exists (
       select 1
       from logistics_core.platform_pilot_users pilot
       where pilot.user_id = new.user_id
         and pilot.is_active = true
     ) then
    new.account_status := 'disabled';
  end if;

  return new;
end;
$body$;

revoke all on function logistics_core.enforce_temporary_login_gate() from public, anon, authenticated;

drop trigger if exists ll_user_permissions_temporary_login_gate
on public.ll_user_permissions;

create trigger ll_user_permissions_temporary_login_gate
before insert or update of user_id, account_status
on public.ll_user_permissions
for each row
execute function logistics_core.enforce_temporary_login_gate();

update public.ll_user_permissions permission
set
  account_status = case
    when exists (
      select 1
      from logistics_core.platform_pilot_users pilot
      where pilot.user_id = permission.user_id
        and pilot.is_active = true
    ) then 'active'
    else 'disabled'
  end,
  profile_payload = jsonb_set(
    coalesce(permission.profile_payload, '{}'::jsonb),
    '{temporary_login_gate_20260806}',
    jsonb_build_object(
      'previous_account_status', coalesce(
        permission.profile_payload #>> '{temporary_login_gate_20260806,previous_account_status}',
        permission.account_status
      ),
      'allowed', exists (
        select 1
        from logistics_core.platform_pilot_users pilot
        where pilot.user_id = permission.user_id
          and pilot.is_active = true
      ),
      'applied_at', now(),
      'mode', 'temporary_until_platform_owner_release'
    ),
    true
  ),
  updated_at = now();

do $readback$
declare
  v_active_profile_count integer;
  v_active_pilot_count integer;
begin
  select count(*)
  into v_active_pilot_count
  from logistics_core.platform_pilot_users pilot
  where pilot.is_active = true;

  if v_active_pilot_count <> 3 then
    raise exception 'Temporary Gate 6 login gate requires exactly 3 active pilot Auth IDs, found %',
      v_active_pilot_count;
  end if;

  select count(*)
  into v_active_profile_count
  from public.ll_user_permissions permission
  where permission.account_status = 'active';

  if v_active_profile_count <> 3 then
    raise exception 'Temporary Gate 6 login gate expected 3 active permission profiles, found %',
      v_active_profile_count;
  end if;

  if exists (
    select 1
    from public.ll_user_permissions permission
    where permission.account_status = 'active'
      and not exists (
        select 1
        from logistics_core.platform_pilot_users pilot
        where pilot.user_id = permission.user_id
          and pilot.is_active = true
      )
  ) or exists (
    select 1
    from logistics_core.platform_pilot_users pilot
    where pilot.is_active = true
      and not exists (
        select 1
        from public.ll_user_permissions permission
        where permission.user_id = pilot.user_id
          and permission.account_status = 'active'
      )
  ) then
    raise exception 'Temporary Gate 6 active permission profiles differ from the pilot Auth allowlist';
  end if;

  if (
    select array_agg(permission.staff_name order by permission.staff_name)
    from public.ll_user_permissions permission
    where permission.account_status = 'active'
  ) is distinct from array['이관용', '이시정', '전기영']::text[] then
    raise exception 'Temporary Gate 6 active identities must be 이관용, 전기영, 이시정';
  end if;
end;
$readback$;

commit;
