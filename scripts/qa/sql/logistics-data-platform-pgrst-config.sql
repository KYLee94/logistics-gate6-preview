select
  role_name,
  setting
from (
  select
    rolname as role_name,
    unnest(coalesce(rolconfig, array[]::text[])) as setting
  from pg_roles
  where rolname = 'authenticator'
) role_settings
where setting like 'pgrst.db_schemas=%';
