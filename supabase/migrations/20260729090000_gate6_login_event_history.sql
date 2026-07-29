begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.ll_login_events (
  event_id uuid primary key,
  email text not null,
  auth_user_id uuid,
  event_type text not null,
  outcome text not null,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ll_login_events_email_check
    check (email = lower(btrim(email)) and email like '%@igisam.com'),
  constraint ll_login_events_event_type_check
    check (event_type in ('first_login', 'login', 'password_recovery')),
  constraint ll_login_events_outcome_check
    check (outcome in ('attempted', 'failed', 'success')),
  constraint ll_login_events_failure_code_check
    check (
      (outcome = 'failed' and failure_code in (
        'invalid_credentials',
        'password_policy',
        'account_exists',
        'rate_limited',
        'network_error',
        'auth_error'
      ))
      or (outcome <> 'failed' and failure_code is null)
    )
);

create index ll_login_events_recent_success_idx
  on public.ll_login_events (updated_at desc)
  where outcome = 'success';

create index ll_login_events_email_recent_idx
  on public.ll_login_events (email, updated_at desc);

alter table public.ll_login_events enable row level security;
revoke all on table public.ll_login_events from public, anon, authenticated;
grant select, insert, update on table public.ll_login_events to service_role;

comment on table public.ll_login_events is
  'User-facing login history and first-access support status. Stores no password, IP address, or raw browser data.';
comment on column public.ll_login_events.event_id is
  'One browser authentication submission. Retries update the same event instead of duplicating it.';
comment on column public.ll_login_events.failure_code is
  'Safe failure category only; raw provider errors are never stored.';

commit;
