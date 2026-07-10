begin;

-- The deployed Edge function reads collection date and ingest time directly from
-- articles, so the old run parent and its internal fields can now be removed.
do $$
begin
  if to_regclass('public.ll_news_items') is not null then
    alter table public.ll_news_items
      drop constraint if exists ll_news_items_news_run_id_fkey restrict,
      drop column if exists news_run_id restrict,
      drop column if exists payload restrict,
      drop column if exists created_at restrict;
  end if;
end $$;

-- These relations contain only replaced delivery state or internal diagnostics.
do $$
begin
  if to_regclass('public.ll_news_runs') is not null then
    execute 'drop table public.ll_news_runs restrict';
  end if;

  if to_regclass('public.ll_notification_deliveries') is not null then
    execute 'drop table public.ll_notification_deliveries restrict';
  end if;

  if to_regclass('public.ll_audit_events') is not null then
    execute 'drop table public.ll_audit_events restrict';
  end if;

  if to_regclass('public.ll_payload_snapshots') is not null then
    execute 'drop table public.ll_payload_snapshots restrict';
  end if;

  if to_regclass('public.ll_schema_metadata') is not null then
    execute 'drop table public.ll_schema_metadata restrict';
  end if;
end $$;

-- A successful transaction must leave no retired relation or legacy article field.
do $$
declare
  remaining_relations text[];
  remaining_columns text[];
begin
  select array_agg(name order by name)
  into remaining_relations
  from (values
    ('public.ll_news_runs'),
    ('public.ll_notification_deliveries'),
    ('public.ll_audit_events'),
    ('public.ll_payload_snapshots'),
    ('public.ll_schema_metadata')
  ) as retired(name)
  where to_regclass(name) is not null;

  if remaining_relations is not null then
    raise exception 'Retired runtime relations remain: %', array_to_string(remaining_relations, ', ');
  end if;

  select array_agg(column_name order by column_name)
  into remaining_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'll_news_items'
    and column_name in ('news_run_id', 'payload', 'created_at');

  if remaining_columns is not null then
    raise exception 'Retired news columns remain: %', array_to_string(remaining_columns, ', ');
  end if;
end $$;

commit;
