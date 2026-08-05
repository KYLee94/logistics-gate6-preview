with core_tables as (
  select c.oid, c.relname, c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'logistics_core' and c.relkind in ('r', 'p')
), api_relations as (
  select c.relname, c.relkind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'logistics_api' and c.relkind in ('r', 'p', 'v', 'm', 'f')
), api_functions as (
  select p.oid, p.proname, p.prosecdef, p.proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'logistics_api'
), unindexed_foreign_keys as (
  select
    con.conname,
    con.conrelid::regclass::text as table_name
  from pg_constraint con
  where con.contype = 'f'
    and con.connamespace = 'logistics_core'::regnamespace
    and not exists (
      select 1
      from pg_index idx
      where idx.indrelid = con.conrelid
        and idx.indisvalid
        and idx.indpred is null
        and (idx.indkey::smallint[])[0:cardinality(con.conkey) - 1] @> con.conkey
    )
)
select jsonb_build_object(
  'core_table_count', (select count(*) from core_tables),
  'core_rls_enabled_count', (select count(*) from core_tables where relrowsecurity),
  'core_client_table_grant_count', (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'logistics_core'
      and grantee in ('anon', 'authenticated')
  ),
  'api_relation_count', (select count(*) from api_relations),
  'api_function_count', (select count(*) from api_functions),
  'api_security_definer_count', (select count(*) from api_functions where prosecdef),
  'api_functions_without_fixed_search_path', (
    select count(*)
    from api_functions
    where not exists (
      select 1 from unnest(coalesce(proconfig, array[]::text[])) setting
      where setting like 'search_path=%'
    )
  ),
  'authenticated_read_rpc_count', (
    select count(*)
    from information_schema.routine_privileges
    where specific_schema = 'logistics_api'
      and grantee = 'authenticated'
      and privilege_type = 'EXECUTE'
      and routine_name in ('home_read', 'rent_roll_read', 'finance_read', 'maturities_read', 'calculations_explain')
  ),
  'authenticated_write_rpc_count', (
    select count(*)
    from information_schema.routine_privileges
    where specific_schema = 'logistics_api'
      and grantee = 'authenticated'
      and privilege_type = 'EXECUTE'
      and routine_name in ('rent_roll_batch_save', 'finance_batch_save')
  ),
  'unindexed_foreign_key_count', (select count(*) from unindexed_foreign_keys),
  'unindexed_foreign_keys', (
    select coalesce(jsonb_agg(jsonb_build_object('constraint', conname, 'table', table_name) order by table_name, conname), '[]'::jsonb)
    from unindexed_foreign_keys
  )
) as security_posture;
