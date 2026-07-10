const READ_ONLY_FORBIDDEN_SQL = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|vacuum|analyze|do|call|merge)\b/iu;

function stripSqlCommentsAndStrings(sql) {
  return String(sql || '')
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/--[^\r\n]*/gu, ' ')
    .replace(/'(?:''|[^'])*'/gsu, "''")
    .replace(/\$(\w*)\$[\s\S]*?\$\1\$/gu, '$$');
}

function assertReadOnlySql(sql) {
  const source = String(sql || '');
  if (!/\bbegin\s+isolation\s+level\s+repeatable\s+read\s+read\s+only\s*;/iu.test(source)) {
    throw new Error('Preflight SQL must begin a REPEATABLE READ READ ONLY transaction.');
  }
  const inspectable = stripSqlCommentsAndStrings(source);
  const forbidden = inspectable.match(READ_ONLY_FORBIDDEN_SQL);
  if (forbidden) throw new Error(`Read-only SQL contains forbidden statement keyword: ${forbidden[1]}`);
  return true;
}

function buildPreflightSql() {
  const sql = String.raw`
begin isolation level repeatable read read only;
set local timezone to 'UTC';
set local statement_timeout to '15min';
set local search_path to pg_catalog, public, extensions;

with
relations as (
  select
    c.oid,
    n.nspname as schema_name,
    c.relname as object_name,
    c.relkind,
    case c.relkind
      when 'r' then 'table'
      when 'p' then 'partitioned_table'
      when 'v' then 'view'
      when 'm' then 'materialized_view'
      when 'f' then 'foreign_table'
      when 'S' then 'sequence'
      else c.relkind::text
    end as object_kind,
    c.relkind in ('r', 'p', 'v', 'm', 'f') as data_bearing,
    pg_get_userbyid(c.relowner) as object_owner,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced,
    case when c.relkind in ('r', 'p', 'm') then pg_relation_size(c.oid) else 0 end::text as relation_size_bytes,
    case when c.relkind in ('r', 'p', 'm') then pg_total_relation_size(c.oid) else 0 end::text as total_size_bytes,
    case when c.relkind in ('v', 'm') then pg_get_viewdef(c.oid, true) else null end as definition_sql,
    obj_description(c.oid) as object_comment
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname like 'll\_%' escape '\'
    and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
),
relation_stats as (
  select
    r.schema_name,
    r.object_name,
    case when r.data_bearing
      then nullif((xpath('/table/row/exact_count/text()', q.xml_result))[1]::text, '')
      else null
    end as exact_count,
    case when r.data_bearing
      then nullif((xpath('/table/row/canonical_json_sha256/text()', q.xml_result))[1]::text, '')
      else null
    end as canonical_json_sha256
  from relations r
  left join lateral (
    select query_to_xml(
      format(
        $query$
          select
            count(*)::text as exact_count,
            encode(
              digest(
                convert_to(
                  coalesce(
                    jsonb_agg(to_jsonb(src) order by to_jsonb(src)::text)::text,
                    '[]'
                  ),
                  'UTF8'
                ),
                'sha256'
              ),
              'hex'
            ) as canonical_json_sha256
          from %I.%I src
        $query$,
        r.schema_name,
        r.object_name
      ),
      false,
      true,
      ''
    ) as xml_result
  ) q on r.data_bearing
),
columns_catalog as (
  select
    cols.table_schema as schema_name,
    cols.table_name as object_name,
    cols.ordinal_position,
    cols.column_name,
    cols.data_type,
    cols.udt_schema,
    cols.udt_name,
    cols.is_nullable,
    cols.column_default,
    cols.character_maximum_length,
    cols.numeric_precision,
    cols.numeric_scale
  from information_schema.columns cols
  where cols.table_schema = 'public'
    and cols.table_name like 'll\_%' escape '\'
),
constraints_catalog as (
  select
    n.nspname as schema_name,
    rel.relname as object_name,
    con.conname as constraint_name,
    con.contype as constraint_type,
    pg_get_constraintdef(con.oid, true) as constraint_definition,
    coalesce((
      select jsonb_agg(att.attname order by keys.ord)
      from unnest(con.conkey) with ordinality keys(attnum, ord)
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = keys.attnum
    ), '[]'::jsonb) as columns,
    foreign_ns.nspname as foreign_schema_name,
    foreign_rel.relname as foreign_object_name,
    coalesce((
      select jsonb_agg(att.attname order by keys.ord)
      from unnest(con.confkey) with ordinality keys(attnum, ord)
      join pg_attribute att on att.attrelid = con.confrelid and att.attnum = keys.attnum
    ), '[]'::jsonb) as foreign_columns,
    con.confupdtype as on_update_code,
    con.confdeltype as on_delete_code,
    con.convalidated as is_validated
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  left join pg_class foreign_rel on foreign_rel.oid = con.confrelid
  left join pg_namespace foreign_ns on foreign_ns.oid = foreign_rel.relnamespace
  where n.nspname = 'public'
    and rel.relname like 'll\_%' escape '\'
),
indexes_catalog as (
  select
    n.nspname as schema_name,
    rel.relname as object_name,
    idx.relname as index_name,
    ix.indisprimary as is_primary,
    ix.indisunique as is_unique,
    ix.indisvalid as is_valid,
    ix.indisready as is_ready,
    pg_get_indexdef(ix.indexrelid) as index_definition,
    pg_get_expr(ix.indpred, ix.indrelid, true) as predicate
  from pg_index ix
  join pg_class rel on rel.oid = ix.indrelid
  join pg_namespace n on n.oid = rel.relnamespace
  join pg_class idx on idx.oid = ix.indexrelid
  where n.nspname = 'public'
    and rel.relname like 'll\_%' escape '\'
),
policies_catalog as (
  select
    schemaname as schema_name,
    tablename as object_name,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
  from pg_policies
  where schemaname = 'public'
    and tablename like 'll\_%' escape '\'
),
grants_catalog as (
  select
    table_schema as schema_name,
    table_name as object_name,
    grantee,
    privilege_type,
    is_grantable
  from information_schema.table_privileges
  where table_schema = 'public'
    and table_name like 'll\_%' escape '\'
),
dependencies_catalog as (
  select
    'view_dependency'::text as dependency_type,
    format('%I.%I', view_schema, view_name) as dependent_object,
    format('%I.%I', table_schema, table_name) as referenced_object,
    null::text as dependency_name
  from information_schema.view_table_usage
  where (view_schema = 'public' and view_name like 'll\_%' escape '\')
     or (table_schema = 'public' and table_name like 'll\_%' escape '\')

  union all

  select
    'foreign_key'::text,
    format('%I.%I', n.nspname, rel.relname),
    format('%I.%I', foreign_ns.nspname, foreign_rel.relname),
    con.conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  join pg_class foreign_rel on foreign_rel.oid = con.confrelid
  join pg_namespace foreign_ns on foreign_ns.oid = foreign_rel.relnamespace
  where con.contype = 'f'
    and ((n.nspname = 'public' and rel.relname like 'll\_%' escape '\')
      or (foreign_ns.nspname = 'public' and foreign_rel.relname like 'll\_%' escape '\'))

  union all

  select distinct
    'function_dependency'::text,
    proc_ns.nspname || '.' || p.proname,
    format('%I.%I', ref_ns.nspname, ref_rel.relname),
    p.oid::regprocedure::text
  from pg_depend dep
  join pg_proc p on dep.classid = 'pg_proc'::regclass and dep.objid = p.oid
  join pg_namespace proc_ns on proc_ns.oid = p.pronamespace
  join pg_class ref_rel on dep.refclassid = 'pg_class'::regclass and dep.refobjid = ref_rel.oid
  join pg_namespace ref_ns on ref_ns.oid = ref_rel.relnamespace
  where ref_ns.nspname = 'public'
    and ref_rel.relname like 'll\_%' escape '\'

  union all

  select
    'trigger_function'::text,
    format('%I.%I.%I', n.nspname, rel.relname, trig.tgname),
    proc_ns.nspname || '.' || p.proname,
    trig.tgname
  from pg_trigger trig
  join pg_class rel on rel.oid = trig.tgrelid
  join pg_namespace n on n.oid = rel.relnamespace
  join pg_proc p on p.oid = trig.tgfoid
  join pg_namespace proc_ns on proc_ns.oid = p.pronamespace
  where not trig.tgisinternal
    and n.nspname = 'public'
    and rel.relname like 'll\_%' escape '\'
),
missing_primary_keys as (
  select r.schema_name, r.object_name
  from relations r
  where r.relkind in ('r', 'p')
    and not exists (
      select 1 from pg_constraint con
      where con.conrelid = r.oid and con.contype = 'p'
    )
),
foreign_keys as (
  select
    con.oid,
    rel.oid as relation_oid,
    n.nspname as schema_name,
    rel.relname as object_name,
    con.conname as constraint_name,
    con.conkey as fk_column_numbers,
    coalesce((
      select jsonb_agg(att.attname order by keys.ord)
      from unnest(con.conkey) with ordinality keys(attnum, ord)
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = keys.attnum
    ), '[]'::jsonb) as fk_columns
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where con.contype = 'f'
    and n.nspname = 'public'
    and rel.relname like 'll\_%' escape '\'
),
missing_fk_indexes as (
  select fk.schema_name, fk.object_name, fk.constraint_name, fk.fk_columns
  from foreign_keys fk
  where not exists (
    select 1
    from pg_index ix
    where ix.indrelid = fk.relation_oid
      and ix.indisvalid
      and ix.indisready
      and (string_to_array(ix.indkey::text, ' ')::smallint[])[1:array_length(fk.fk_column_numbers, 1)] = fk.fk_column_numbers
  )
),
table_usage as (
  select
    schemaname as schema_name,
    relname as object_name,
    seq_scan::text,
    seq_tup_read::text,
    idx_scan::text,
    idx_tup_fetch::text,
    n_tup_ins::text,
    n_tup_upd::text,
    n_tup_del::text,
    n_live_tup::text,
    n_dead_tup::text,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
  from pg_stat_user_tables
  where schemaname = 'public'
    and relname like 'll\_%' escape '\'
),
index_usage as (
  select
    sui.schemaname as schema_name,
    sui.relname as object_name,
    sui.indexrelname as index_name,
    sui.idx_scan::text,
    sui.idx_tup_read::text,
    sui.idx_tup_fetch::text
  from pg_stat_user_indexes sui
  where sui.schemaname = 'public'
    and sui.relname like 'll\_%' escape '\'
),
storage_bucket_summary as (
  select
    b.id,
    b.name,
    b.public,
    b.file_size_limit::text,
    b.allowed_mime_types,
    b.created_at,
    b.updated_at,
    count(o.id)::text as object_count,
    coalesce(sum(
      case when coalesce(o.metadata ->> 'size', '') ~ '^[0-9]+$'
        then (o.metadata ->> 'size')::numeric
        else 0
      end
    ), 0)::text as total_object_bytes,
    encode(
      digest(
        convert_to(
          coalesce(
            jsonb_agg(to_jsonb(o) order by o.name, o.id)
              filter (where o.id is not null)::text,
            '[]'
          ),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    ) as object_manifest_sha256
  from storage.buckets b
  left join storage.objects o on o.bucket_id = b.id
  group by b.id, b.name, b.public, b.file_size_limit, b.allowed_mime_types, b.created_at, b.updated_at
),
storage_objects_catalog as (
  select
    o.id,
    o.bucket_id,
    o.name,
    to_jsonb(o) as object_record
  from storage.objects o
),
storage_policies_catalog as (
  select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies
  where schemaname = 'storage'
    and tablename in ('buckets', 'objects')
),
database_context as (
  select
    current_database() as database_name,
    current_user as database_user,
    current_setting('server_version') as server_version,
    current_setting('transaction_isolation') as transaction_isolation,
    current_setting('transaction_read_only') as transaction_read_only,
    now() as captured_at,
    (select stats_reset from pg_stat_database where datname = current_database()) as database_stats_reset,
    to_regclass('pg_stat_statements') is not null as pg_stat_statements_available,
    to_regprocedure('digest(bytea,text)') is not null as pgcrypto_digest_available
),
database_migrations as (
  select coalesce(jsonb_agg(to_jsonb(m) order by m.version), '[]'::jsonb) as rows,
         max(m.version)::text as migration_head
  from supabase_migrations.schema_migrations m
),
publications_catalog as (
  select pubname, schemaname, tablename
  from pg_publication_tables
  where schemaname = 'public'
    and tablename like 'll\_%' escape '\'
)
select jsonb_build_object(
  'captured_at', context.captured_at,
  'database_name', context.database_name,
  'database_user', context.database_user,
  'server_version', context.server_version,
  'transaction_isolation', context.transaction_isolation,
  'transaction_read_only', context.transaction_read_only,
  'transaction_end', 'implicit rollback on CLI disconnect',
  'database_stats_reset', context.database_stats_reset,
  'pg_stat_statements_available', context.pg_stat_statements_available,
  'pgcrypto_digest_available', context.pgcrypto_digest_available,
  'database_migration_head', migrations.migration_head,
  'database_migrations', migrations.rows,
  'relations', (select coalesce(jsonb_agg(to_jsonb(r) - 'oid' order by r.schema_name, r.object_name), '[]'::jsonb) from relations r),
  'relation_stats', (select coalesce(jsonb_agg(to_jsonb(s) order by s.schema_name, s.object_name), '[]'::jsonb) from relation_stats s),
  'columns', (select coalesce(jsonb_agg(to_jsonb(c) order by c.schema_name, c.object_name, c.ordinal_position), '[]'::jsonb) from columns_catalog c),
  'constraints', (select coalesce(jsonb_agg(to_jsonb(c) order by c.schema_name, c.object_name, c.constraint_name), '[]'::jsonb) from constraints_catalog c),
  'indexes', (select coalesce(jsonb_agg(to_jsonb(i) order by i.schema_name, i.object_name, i.index_name), '[]'::jsonb) from indexes_catalog i),
  'policies', (select coalesce(jsonb_agg(to_jsonb(p) order by p.schema_name, p.object_name, p.policyname), '[]'::jsonb) from policies_catalog p),
  'grants', (select coalesce(jsonb_agg(to_jsonb(g) order by g.schema_name, g.object_name, g.grantee, g.privilege_type), '[]'::jsonb) from grants_catalog g),
  'dependencies', (select coalesce(jsonb_agg(to_jsonb(d) order by d.dependent_object, d.referenced_object, d.dependency_type), '[]'::jsonb) from dependencies_catalog d),
  'missing_primary_keys', (select coalesce(jsonb_agg(to_jsonb(m) order by m.schema_name, m.object_name), '[]'::jsonb) from missing_primary_keys m),
  'missing_fk_indexes', (select coalesce(jsonb_agg(to_jsonb(m) order by m.schema_name, m.object_name, m.constraint_name), '[]'::jsonb) from missing_fk_indexes m),
  'table_usage', (select coalesce(jsonb_agg(to_jsonb(u) order by u.schema_name, u.object_name), '[]'::jsonb) from table_usage u),
  'index_usage', (select coalesce(jsonb_agg(to_jsonb(u) order by u.schema_name, u.object_name, u.index_name), '[]'::jsonb) from index_usage u),
  'publications', (select coalesce(jsonb_agg(to_jsonb(p) order by p.pubname, p.schemaname, p.tablename), '[]'::jsonb) from publications_catalog p),
  'storage_buckets', (select coalesce(jsonb_agg(to_jsonb(b) order by b.id), '[]'::jsonb) from storage_bucket_summary b),
  'storage_objects', (select coalesce(jsonb_agg(to_jsonb(o) order by o.bucket_id, o.name, o.id), '[]'::jsonb) from storage_objects_catalog o),
  'storage_policies', (select coalesce(jsonb_agg(to_jsonb(p) order by p.tablename, p.policyname), '[]'::jsonb) from storage_policies_catalog p)
) as snapshot
from database_context context
cross join database_migrations migrations;

-- The CLI disconnect intentionally rolls back this read-only transaction after returning the snapshot.
`;
  assertReadOnlySql(sql);
  return sql;
}

function assertIdentifier(value, label) {
  if (!/^[a-z_][a-z0-9_]*$/u.test(String(value || ''))) throw new Error(`${label} is not a safe SQL identifier: ${value}`);
  return String(value);
}

function sqlLiteral(value) {
  return `'${String(value ?? '').replace(/'/gu, "''")}'`;
}

function relationDropKeyword(objectKind) {
  if (objectKind === 'view') return 'view';
  if (objectKind === 'materialized_view') return 'materialized view';
  if (objectKind === 'table' || objectKind === 'partitioned_table' || objectKind === 'foreign_table') return 'table';
  throw new Error(`Unsupported drop object kind: ${objectKind}`);
}

function relkindForObjectKind(objectKind) {
  return {
    table: 'r',
    partitioned_table: 'p',
    view: 'v',
    materialized_view: 'm',
    foreign_table: 'f',
  }[objectKind];
}

function buildApplySql(preManifest, approvedDelta) {
  const { validateApprovedDelta } = require('./logistics-db-cleanup-core.cjs');
  const validation = validateApprovedDelta(approvedDelta, preManifest);
  if (!validation.ok) throw new Error(`Approved delta validation failed: ${validation.errors.join('; ')}`);
  const operations = approvedDelta.operations || [];
  const blocks = operations.map((operation, index) => {
    const [schemaName, objectName] = String(operation.qualified_name || '').split('.');
    const schema = assertIdentifier(schemaName, 'schema name');
    const object = assertIdentifier(objectName, 'object name');
    const expectedRelkind = relkindForObjectKind(operation.object_kind);
    if (!expectedRelkind) throw new Error(`Unsupported object kind: ${operation.object_kind}`);
    const expectedCount = String(operation.expected_exact_count);
    if (!/^\d+$/u.test(expectedCount)) throw new Error(`Operation ${index + 1} expected_exact_count must be a non-negative integer.`);
    if (!/^[a-f0-9]{64}$/u.test(String(operation.expected_canonical_json_sha256 || ''))) {
      throw new Error(`Operation ${index + 1} expected_canonical_json_sha256 must be SHA-256.`);
    }
    const dropKeyword = relationDropKeyword(operation.object_kind);
    return `
do $gate6_cleanup_guard_${index + 1}$
declare
  current_relkind "char";
  current_count bigint;
  current_checksum text;
begin
  select c.relkind
  into current_relkind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = ${sqlLiteral(schema)}
    and c.relname = ${sqlLiteral(object)};

  if current_relkind is null then
    raise exception 'Gate 6 cleanup guard: relation %.% does not exist', ${sqlLiteral(schema)}, ${sqlLiteral(object)};
  end if;
  if current_relkind <> ${sqlLiteral(expectedRelkind)}::"char" then
    raise exception 'Gate 6 cleanup guard: relation kind mismatch for %.%', ${sqlLiteral(schema)}, ${sqlLiteral(object)};
  end if;

  select
    count(*),
    encode(
      digest(
        convert_to(
          coalesce(jsonb_agg(to_jsonb(src) order by to_jsonb(src)::text)::text, '[]'),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )
  into current_count, current_checksum
  from ${schema}.${object} src;

  if current_count <> ${expectedCount}::bigint then
    raise exception 'Gate 6 cleanup guard: expected count mismatch for %.%', ${sqlLiteral(schema)}, ${sqlLiteral(object)};
  end if;
  if current_checksum <> ${sqlLiteral(operation.expected_canonical_json_sha256)} then
    raise exception 'Gate 6 cleanup guard: expected canonical checksum mismatch for %.%', ${sqlLiteral(schema)}, ${sqlLiteral(object)};
  end if;
end
$gate6_cleanup_guard_${index + 1}$;

drop ${dropKeyword} ${schema}.${object} restrict;`;
  });

  const sql = `-- Gate 6 DB cleanup apply. Generated from an approved manifest delta.
-- This SQL is never invoked by package.json or automatic release workflows.
begin;
set local lock_timeout to '5s';
set local statement_timeout to '5min';
set local search_path to pg_catalog, public, extensions;
${blocks.join('\n')}
commit;
select jsonb_build_object('ok', true, 'operation_count', ${operations.length}) as result;
`;
  if (/\bcascade\b/iu.test(sql)) throw new Error('Generated apply SQL must never contain CASCADE.');
  const dropStatements = sql.match(/\bdrop\s+(?:materialized\s+view|view|table)\b[^;]+;/giu) || [];
  if (dropStatements.length !== operations.length || dropStatements.some((statement) => !/\brestrict\s*;/iu.test(statement))) {
    throw new Error('Every generated DROP statement must end with RESTRICT.');
  }
  return sql;
}

module.exports = {
  assertReadOnlySql,
  buildApplySql,
  buildPreflightSql,
  stripSqlCommentsAndStrings,
};
