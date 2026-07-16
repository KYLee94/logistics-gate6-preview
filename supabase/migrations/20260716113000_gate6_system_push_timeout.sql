begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.ll_queue_web_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  webhook_secret text;
  gateway_jwt text;
begin
  if new.notification_type <> 'task_share' or new.delivery_status = 'dismissed' then
    return new;
  end if;

  select
    max(decrypted_secret) filter (where name = 'll_web_push_webhook_secret'),
    max(decrypted_secret) filter (where name = 'll_web_push_gateway_jwt')
  into webhook_secret, gateway_jwt
  from vault.decrypted_secrets
  where name in ('ll_web_push_webhook_secret', 'll_web_push_gateway_jwt');

  if nullif(webhook_secret, '') is null or nullif(gateway_jwt, '') is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://qvegpozwrcmspdvjokiz.supabase.co/functions/v1/ll-push-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || gateway_jwt,
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'll_notifications',
      'schema', 'public',
      'record', jsonb_build_object(
        'notification_id', new.notification_id,
        'recipient_user_id', new.recipient_user_id,
        'title', new.title,
        'body', new.body,
        'payload', new.payload
      )
    ),
    timeout_milliseconds := 10000
  );
  return new;
end;
$$;

revoke all on function public.ll_queue_web_push_notification() from public, anon, authenticated;

commit;
