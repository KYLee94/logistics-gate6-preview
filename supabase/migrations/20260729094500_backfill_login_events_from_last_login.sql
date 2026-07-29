begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

insert into public.ll_login_events (
  event_id,
  email,
  auth_user_id,
  event_type,
  outcome,
  failure_code,
  created_at,
  updated_at
)
select
  md5(
    'legacy-login|' || lower(btrim(email)) || '|' || last_login_at::text
  )::uuid,
  lower(btrim(email)),
  user_id,
  'login',
  'success',
  null,
  last_login_at,
  last_login_at
from public.ll_user_permissions
where last_login_at is not null
  and lower(btrim(email)) like '%@igisam.com'
on conflict (event_id) do nothing;

commit;
