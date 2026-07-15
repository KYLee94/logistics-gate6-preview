-- Authorization is server-owned. Browser clients receive only the scoped auth/me contract.

begin;

alter table public.ll_user_permissions enable row level security;

revoke all on table public.ll_user_permissions from anon;
revoke all on table public.ll_user_permissions from authenticated;

-- Browser clients must use the server-owned auth/me contract. Remove every
-- historical direct-table policy, including the former self-read policy.
drop policy if exists "ll_user_permissions_self_read" on public.ll_user_permissions;

do $$
declare
  policy_name name;
begin
  for policy_name in
    select polname
    from pg_policy
    where polrelid = 'public.ll_user_permissions'::regclass
  loop
    execute format('drop policy if exists %I on public.ll_user_permissions', policy_name);
  end loop;
end $$;

grant select, insert, update, delete on table public.ll_user_permissions to service_role;

commit;
