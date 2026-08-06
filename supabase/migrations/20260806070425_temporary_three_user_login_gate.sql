-- Temporary Gate 6 login gate requested by the platform owner.
-- Runtime authorization continues to use ll_user_permissions.user_id and
-- account_status; no Auth user or login-history row is deleted.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create temporary table _gate6_temporary_login_allowlist (
  auth_user_id uuid primary key,
  permission_email text unique not null,
  staff_name text not null
) on commit drop;

insert into _gate6_temporary_login_allowlist (
  auth_user_id,
  permission_email,
  staff_name
)
select
  pilot.user_id,
  lower(btrim(permission.email)),
  btrim(permission.staff_name)
from logistics_core.platform_pilot_users pilot
join public.ll_user_permissions permission
  on permission.user_id = pilot.user_id
 and permission.scope_type is null
 and permission.scope_id is null
join auth.users auth_user
  on auth_user.id = pilot.user_id
where pilot.is_active = true;

do $preflight$
declare
  v_allowlist_count integer;
begin
  select count(*) into v_allowlist_count
  from _gate6_temporary_login_allowlist;

  if v_allowlist_count <> 3 then
    raise exception 'Temporary Gate 6 login allowlist must resolve to exactly 3 Auth user IDs; resolved %',
      v_allowlist_count;
  end if;

  if (
    select array_agg(allowlist.staff_name order by allowlist.staff_name)
    from _gate6_temporary_login_allowlist allowlist
  ) is distinct from array['이관용', '이시정', '전기영']::text[] then
    raise exception 'Temporary Gate 6 pilot identities must be 이관용, 전기영, 이시정';
  end if;

  if exists (
    select 1
    from _gate6_temporary_login_allowlist allowlist
    left join auth.users auth_user on auth_user.id = allowlist.auth_user_id
    left join public.ll_user_permissions permission
      on permission.user_id = allowlist.auth_user_id
     and permission.scope_type is null
     and permission.scope_id is null
    where auth_user.id is null
       or permission.user_id is null
       or lower(btrim(permission.email)) is distinct from allowlist.permission_email
       or btrim(permission.staff_name) is distinct from allowlist.staff_name
  ) then
    raise exception 'Temporary Gate 6 login allowlist Auth binding is incomplete';
  end if;
end;
$preflight$;

update public.ll_user_permissions permission
set
  account_status = case
    when permission.user_id in (
      select allowlist.auth_user_id
      from _gate6_temporary_login_allowlist allowlist
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
      'allowed', permission.user_id in (
        select allowlist.auth_user_id
        from _gate6_temporary_login_allowlist allowlist
      ),
      'applied_at', now(),
      'mode', 'temporary_until_platform_owner_release'
    ),
    true
  ),
  updated_at = now()
where permission.scope_type is null
  and permission.scope_id is null
  and nullif(btrim(permission.email), '') is not null;

do $readback$
declare
  active_profile_count integer;
begin
  select count(*) into active_profile_count
  from public.ll_user_permissions permission
  where permission.scope_type is null
    and permission.scope_id is null
    and permission.account_status = 'active';

  if active_profile_count <> 3 then
    raise exception 'Temporary Gate 6 login gate readback expected 3 active profiles, found %',
      active_profile_count;
  end if;

  if exists (
    select permission.user_id
    from public.ll_user_permissions permission
    where permission.scope_type is null
      and permission.scope_id is null
      and permission.account_status = 'active'
    except
    select allowlist.auth_user_id
    from _gate6_temporary_login_allowlist allowlist
  ) or exists (
    select allowlist.auth_user_id
    from _gate6_temporary_login_allowlist allowlist
    except
    select permission.user_id
    from public.ll_user_permissions permission
    where permission.scope_type is null
      and permission.scope_id is null
      and permission.account_status = 'active'
  ) then
    raise exception 'Temporary Gate 6 login gate active users differ from the approved Auth allowlist';
  end if;
end;
$readback$;

commit;
