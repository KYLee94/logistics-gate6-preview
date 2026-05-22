const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const OUT_JSON = path.join(OUT_DIR, 'supabase-catalog-inventory-20260521.json');
const OUT_MD = path.join(OUT_DIR, 'supabase-catalog-inventory-20260521.md');
const NPX = 'npx';
const LEGACY_COMPATIBILITY_VIEWS = [
  'll_lease_space_area_breakdowns',
  'll_lease_space_specs',
  'll_lease_special_terms',
  'll_fund_beneficiary_tranches',
  'll_fund_loan_tranches',
  'll_api_audit_logs',
  'll_data_change_audit_logs',
  'll_source_review_logs',
  'll_issues',
  'll_work_platform_tasks',
  'll_work_platform_task_snapshots',
  'll_work_platform_board_posts',
  'll_weekly_reports',
  'll_weekly_assets',
  'll_weekly_projects',
  'll_weekly_doc_ingest_runs',
  'll_sheet_rows',
  'll_import_runs',
  'll_data_quality_findings',
  'll_asset_managers',
  'll_migration_row_backups',
];

function parseSupabaseJson(raw) {
  const start = raw.indexOf('{');
  if (start === -1) throw new Error('Supabase CLI JSON output was not found.');
  for (let end = raw.length - 1; end > start; end -= 1) {
    if (raw[end] !== '}') continue;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      // Continue until the JSON object boundary is found.
    }
  }
  throw new Error('Supabase CLI JSON output could not be parsed.');
}

function runQuery(sql) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sqlFile = path.join(OUT_DIR, `.tmp-supabase-catalog-${process.pid}-${Date.now()}.sql`);
  fs.writeFileSync(sqlFile, sql, 'utf8');
  try {
    const quotedSqlFile = `"${sqlFile.replace(/"/gu, '\\"')}"`;
    const output = execSync(`${NPX} supabase db query --linked -o json --file ${quotedSqlFile}`, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 16,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const parsed = parseSupabaseJson(output);
    return parsed.rows || [];
  } finally {
    fs.rmSync(sqlFile, { force: true });
  }
}

function readFileIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', '.vite', 'tmp'].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
      continue;
    }
    if (/\.(cjs|js|jsx|ts|tsx|sql|md|json)$/iu.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function usageCounts(tableNames) {
  const targets = [
    path.join(ROOT, 'src'),
    path.join(ROOT, 'scripts'),
    path.join(ROOT, 'supabase'),
  ];
  const files = targets.flatMap((target) => walkFiles(target));
  const counts = Object.fromEntries(tableNames.map((name) => [name, 0]));
  for (const filePath of files) {
    const text = readFileIfExists(filePath);
    for (const tableName of tableNames) {
      const matches = text.match(new RegExp(`\\b${tableName}\\b`, 'gu'));
      if (matches) counts[tableName] += matches.length;
    }
  }
  return counts;
}

function classifyTable(tableName) {
  if (['ll_source_cells', 'll_source_runs', 'll_source_field_registry'].includes(tableName)) {
    return { group: 'Raw Source', decision: 'delete_prohibited', reason: '원본 Excel/live Sheets/source cell 보존층입니다.' };
  }
  if (['ll_assets', 'll_tenants', 'll_leases', 'll_lease_spaces', 'll_rent_history'].includes(tableName)) {
    return { group: 'Core Normalized', decision: 'keep', reason: 'Dashboard/AI/Data Quality 기준 정규화 테이블입니다.' };
  }
  if (['ll_lease_attributes'].includes(tableName)) {
    return { group: 'Detail Normalized', decision: 'keep', reason: '원본 Excel 세부 면적, 스펙, 특수조건을 통합한 detail 테이블입니다.' };
  }
  if (['ll_funds', 'll_fund_asset_links', 'll_fund_capital_tranches'].includes(tableName)) {
    return { group: 'Fund', decision: 'keep', reason: '펀드 master/link/tranche 구조입니다.' };
  }
  if (['ll_work_items', 'll_board_posts', 'll_weekly_records'].includes(tableName)) {
    return { group: 'Work Platform / Weekly', decision: 'keep', reason: '업무 플랫폼과 weekly 관리 Project 운영 데이터입니다.' };
  }
  if (['ll_user_permissions', 'll_edit_requests', 'll_audit_events'].includes(tableName)) {
    return { group: 'Permission / Audit', decision: 'delete_prohibited', reason: '권한, 승인, readback, 감사 근거입니다.' };
  }
  if (tableName === 'll_cache_entries') {
    return { group: 'Cache / Snapshot', decision: 'keep', reason: '외부 API cache와 dashboard metric cache를 통합한 운영 cache contract입니다.' };
  }
  if (tableName === 'll_schema_metadata') {
    return { group: 'Metadata', decision: 'keep', reason: 'll_* 테이블과 컬럼 역할을 기록하는 schema metadata registry입니다.' };
  }
  if (['ll_dashboard_metric_snapshots', 'll_dashboard_read_snapshots', 'll_payload_snapshots', 'll_external_api_cache'].includes(tableName)) {
    return { group: 'Legacy Cache / Snapshot', decision: 'approval_delete_candidate', reason: 'll_cache_entries로 통합 후 삭제해야 하는 legacy cache/snapshot 테이블입니다.' };
  }
  if (tableName === 'll_worklogs') {
    return { group: 'Legacy Candidate', decision: 'approval_delete_candidate', reason: '사용처 0건 확인 전까지 보류하는 legacy 후보입니다.' };
  }
  return { group: 'Unclassified', decision: 'review_required', reason: '최신 사용처/역할 확인이 필요합니다.' };
}

function markdownTable(headers, rows) {
  const escapeCell = (value) => String(value ?? '').replace(/\|/gu, '\\|').replace(/\r?\n/gu, '<br>');
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`),
  ].join('\n');
}

function arrayValue(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined);
  if (value === null || value === undefined || value === '') return [];
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => item.replace(/^"|"$/gu, '').trim())
      .filter(Boolean);
  }
  return [value];
}

const tableSql = `
select
  n.nspname as table_schema,
  c.relname as table_name,
  (xpath('/row/count/text()', query_to_xml(format('select count(*) as count from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint as exact_rows,
  c.reltuples::bigint as estimated_rows,
  pg_relation_size(c.oid) as table_bytes,
  pg_total_relation_size(c.oid) as total_bytes,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  pg_get_userbyid(c.relowner) as table_owner,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  obj_description(c.oid) as table_comment
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'll\\_%' escape '\\'
order by c.relname;
`;

const objectSql = `
select
  n.nspname as object_schema,
  c.relname as object_name,
  case c.relkind
    when 'r' then 'BASE TABLE'
    when 'p' then 'PARTITIONED TABLE'
    when 'v' then 'VIEW'
    when 'm' then 'MATERIALIZED VIEW'
    when 'S' then 'SEQUENCE'
    else c.relkind::text
  end as object_type,
  pg_get_userbyid(c.relowner) as object_owner,
  c.relrowsecurity as rls_enabled,
  obj_description(c.oid) as object_comment
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname like 'll\\_%' escape '\\'
  and c.relkind in ('r', 'p', 'v', 'm', 'S')
order by object_type, object_name;
`;

const columnSql = `
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default,
  character_maximum_length,
  numeric_precision,
  numeric_scale
from information_schema.columns
where table_schema = 'public'
  and table_name like 'll\\_%' escape '\\'
order by table_name, ordinal_position;
`;

const constraintSql = `
select
  rel.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  array_remove(array_agg(att.attname order by ck.ord), null) as columns,
  fn.nspname as foreign_table_schema,
  frel.relname as foreign_table_name,
  array_remove(array_agg(fatt.attname order by ck.ord), null) as foreign_columns,
  con.confupdtype as on_update,
  con.confdeltype as on_delete
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
left join unnest(con.conkey) with ordinality as ck(attnum, ord) on true
left join pg_attribute att on att.attrelid = con.conrelid and att.attnum = ck.attnum
left join pg_class frel on frel.oid = con.confrelid
left join pg_namespace fn on fn.oid = frel.relnamespace
left join unnest(con.confkey) with ordinality as fk(attnum, ord) on fk.ord = ck.ord
left join pg_attribute fatt on fatt.attrelid = con.confrelid and fatt.attnum = fk.attnum
where n.nspname = 'public'
  and rel.relname like 'll\\_%' escape '\\'
  and con.contype in ('p', 'u', 'f')
group by rel.relname, con.conname, con.contype, fn.nspname, frel.relname, con.confupdtype, con.confdeltype
order by rel.relname, con.contype, con.conname;
`;

const indexSql = `
select
  t.relname as table_name,
  i.relname as index_name,
  ix.indisprimary as is_primary,
  ix.indisunique as is_unique,
  ix.indisvalid as is_valid,
  array_remove(array_agg(a.attname order by k.ord), null) as columns,
  pg_get_indexdef(ix.indexrelid) as index_def
from pg_index ix
join pg_class t on t.oid = ix.indrelid
join pg_namespace n on n.oid = t.relnamespace
join pg_class i on i.oid = ix.indexrelid
left join unnest(string_to_array(ix.indkey::text, ' ')::int2[]) with ordinality as k(attnum, ord) on true
left join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
where n.nspname = 'public'
  and t.relname like 'll\\_%' escape '\\'
group by t.relname, i.relname, ix.indisprimary, ix.indisunique, ix.indisvalid, ix.indexrelid
order by t.relname, i.relname;
`;

const fkIndexSql = `
with fks as (
  select
    con.oid,
    rel.oid as table_oid,
    rel.relname as table_name,
    con.conname as constraint_name,
    con.conkey as fk_column_nums,
    array_remove(array_agg(att.attname order by ck.ord), null) as fk_columns
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  left join unnest(con.conkey) with ordinality as ck(attnum, ord) on true
  left join pg_attribute att on att.attrelid = con.conrelid and att.attnum = ck.attnum
  where n.nspname = 'public'
    and rel.relname like 'll\\_%' escape '\\'
    and con.contype = 'f'
  group by con.oid, rel.oid, rel.relname, con.conname, con.conkey
),
idx as (
  select
    indrelid,
    indexrelid,
    indisvalid,
    string_to_array(indkey::text, ' ')::int2[] as index_column_nums
  from pg_index
)
select
  f.table_name,
  f.constraint_name,
  f.fk_columns,
  exists (
    select 1
    from idx i
    where i.indrelid = f.table_oid
      and i.indisvalid
      and i.index_column_nums[1:array_length(f.fk_column_nums, 1)] = f.fk_column_nums
  ) as has_supporting_index
from fks f
order by f.table_name, f.constraint_name;
`;

const policySql = `
select
  schemaname,
  tablename as table_name,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename like 'll\\_%' escape '\\'
order by tablename, policyname;
`;

const grantSql = `
select
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.table_privileges
where table_schema = 'public'
  and table_name like 'll\\_%' escape '\\'
  and grantee in ('anon', 'authenticated', 'service_role', 'postgres')
order by table_name, grantee, privilege_type;
`;

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const objects = runQuery(objectSql);
  const tables = runQuery(tableSql);
  const columns = runQuery(columnSql);
  const constraints = runQuery(constraintSql);
  const indexes = runQuery(indexSql);
  const fkIndexCoverage = runQuery(fkIndexSql);
  const policies = runQuery(policySql);
  const grants = runQuery(grantSql);
  const tableNames = tables.map((row) => row.table_name);
  const localUsage = usageCounts(tableNames);
  const classifications = Object.fromEntries(tableNames.map((tableName) => [tableName, {
    ...classifyTable(tableName),
    local_usage_count: localUsage[tableName] || 0,
  }]));

  const constraintsByTable = constraints.reduce((acc, row) => {
    acc[row.table_name] ||= [];
    acc[row.table_name].push(row);
    return acc;
  }, {});
  const columnsByTable = columns.reduce((acc, row) => {
    acc[row.table_name] ||= [];
    acc[row.table_name].push(row);
    return acc;
  }, {});
  const indexesByTable = indexes.reduce((acc, row) => {
    acc[row.table_name] ||= [];
    acc[row.table_name].push(row);
    return acc;
  }, {});
  const grantsByTable = grants.reduce((acc, row) => {
    acc[row.table_name] ||= [];
    acc[row.table_name].push(row);
    return acc;
  }, {});
  const policiesByTable = policies.reduce((acc, row) => {
    acc[row.table_name] ||= [];
    acc[row.table_name].push(row);
    return acc;
  }, {});

  const tableMatrix = tables.map((table) => {
    const tableConstraints = constraintsByTable[table.table_name] || [];
    const primaryKey = tableConstraints.find((row) => row.constraint_type === 'p');
    const uniqueCount = tableConstraints.filter((row) => row.constraint_type === 'u').length;
    const fkCount = tableConstraints.filter((row) => row.constraint_type === 'f').length;
    return {
      ...table,
      classification: classifications[table.table_name],
      column_count: (columnsByTable[table.table_name] || []).length,
      primary_key: arrayValue(primaryKey?.columns),
      foreign_key_count: fkCount,
      unique_constraint_count: uniqueCount,
      index_count: (indexesByTable[table.table_name] || []).length,
      policy_count: (policiesByTable[table.table_name] || []).length,
      grant_count: (grantsByTable[table.table_name] || []).length,
    };
  });

  const missingPrimaryKeys = tableMatrix.filter((row) => !row.primary_key.length).map((row) => row.table_name);
  const missingFkIndexes = fkIndexCoverage.filter((row) => row.has_supporting_index !== true);
  const rlsDisabled = tableMatrix.filter((row) => row.rls_enabled !== true).map((row) => row.table_name);
  const compatibilityViews = objects.filter((row) => row.object_type === 'VIEW' && LEGACY_COMPATIBILITY_VIEWS.includes(row.object_name));
  const objectTypeCounts = objects.reduce((acc, row) => {
    acc[row.object_type] = (acc[row.object_type] || 0) + 1;
    return acc;
  }, {});
  const cleanupCandidates = tableMatrix
    .filter((row) => ['ttl_or_slim_candidate', 'approval_delete_candidate', 'review_required'].includes(row.classification.decision))
    .map((row) => ({
      table_name: row.table_name,
      rows: row.exact_rows,
      group: row.classification.group,
      decision: row.classification.decision,
      local_usage_count: row.classification.local_usage_count,
      reason: row.classification.reason,
    }));

  const inventory = {
    generated_at: new Date().toISOString(),
    project_ref: 'qvegpozwrcmspdvjokiz',
    scope: 'public.ll_*',
    mode: 'read_only_catalog_inventory',
    summary: {
      table_count: tables.length,
      base_table_count: objectTypeCounts['BASE TABLE'] || 0,
      view_count: objectTypeCounts.VIEW || 0,
      legacy_compatibility_view_count: compatibilityViews.length,
      legacy_compatibility_view_denylist_count: LEGACY_COMPATIBILITY_VIEWS.length,
      column_count: columns.length,
      constraint_count: constraints.length,
      index_count: indexes.length,
      policy_count: policies.length,
      grant_count: grants.length,
      missing_primary_key_count: missingPrimaryKeys.length,
      missing_fk_index_count: missingFkIndexes.length,
      rls_disabled_count: rlsDisabled.length,
      cleanup_candidate_count: cleanupCandidates.length,
    },
    objects,
    legacy_compatibility_views: compatibilityViews,
    legacy_compatibility_view_denylist: LEGACY_COMPATIBILITY_VIEWS,
    tables: tableMatrix,
    columns,
    constraints,
    indexes,
    fk_index_coverage: fkIndexCoverage,
    policies,
    grants,
    cleanup_candidates: cleanupCandidates,
    risks: {
      missing_primary_keys: missingPrimaryKeys,
      missing_fk_indexes: missingFkIndexes,
      rls_disabled: rlsDisabled,
    },
  };

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');

  const md = [
    '# Supabase public.ll_* Catalog Inventory - 2026-05-21',
    '',
    '- Project: `qvegpozwrcmspdvjokiz`',
    '- Scope: `public.ll_*`',
    '- Mode: read-only catalog inventory via `npx supabase db query --linked`',
    '- This artifact does not execute cleanup, DROP, DELETE, RLS, policy, or grant changes.',
    '',
    '## Summary',
    '',
    markdownTable(
      ['Metric', 'Value'],
      Object.entries(inventory.summary).map(([key, value]) => [key, value]),
    ),
    '',
    '## Object Type Matrix',
    '',
    markdownTable(
      ['Object', 'Type', 'Owner', 'RLS', 'Comment'],
      objects.map((row) => [
        row.object_name,
        row.object_type,
        row.object_owner,
        row.rls_enabled ? 'enabled' : '',
        row.object_comment || '',
      ]),
    ),
    '',
    '## Compatibility View Denylist',
    '',
    markdownTable(
      ['View', 'Current object exists'],
      LEGACY_COMPATIBILITY_VIEWS.map((viewName) => [
        viewName,
        compatibilityViews.some((row) => row.object_name === viewName) ? 'yes' : 'no',
      ]),
    ),
    '',
    '## Table Matrix',
    '',
    markdownTable(
      ['Table', 'Rows', 'Columns', 'PK', 'FKs', 'Indexes', 'RLS', 'Policies', 'Grants', 'Group', 'Decision', 'Local uses'],
      tableMatrix.map((row) => [
        row.table_name,
        row.exact_rows,
        row.column_count,
        arrayValue(row.primary_key).join(', '),
        row.foreign_key_count,
        row.index_count,
        row.rls_enabled ? 'enabled' : 'disabled',
        row.policy_count,
        row.grant_count,
        row.classification.group,
        row.classification.decision,
        row.classification.local_usage_count,
      ]),
    ),
    '',
    '## FK Index Coverage',
    '',
    markdownTable(
      ['Table', 'Constraint', 'Columns', 'Supporting index'],
      fkIndexCoverage.map((row) => [
        row.table_name,
        row.constraint_name,
        arrayValue(row.fk_columns).join(', '),
        row.has_supporting_index ? 'yes' : 'no',
      ]),
    ),
    '',
    '## Cleanup Candidate Classification',
    '',
    markdownTable(
      ['Table', 'Rows', 'Group', 'Decision', 'Local uses', 'Reason'],
      cleanupCandidates.map((row) => [
        row.table_name,
        row.rows,
        row.group,
        row.decision,
        row.local_usage_count,
        row.reason,
      ]),
    ),
    '',
    '## Required Gates Before Cleanup',
    '',
    '- Browser-visible parity for Home, Asset, Company, PDF Report, Analysis Tools, and Pivot Table.',
    '- SQL preview, impact scope, rollback/export plan, readback query, and user approval.',
    '- No static fallback data exposure for 401/403 responses.',
    '- No cleanup of raw source, core normalized, permission, audit, or source-cell evidence tables.',
    '',
  ].join('\n');
  fs.writeFileSync(OUT_MD, md, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    json: path.relative(ROOT, OUT_JSON),
    markdown: path.relative(ROOT, OUT_MD),
    summary: inventory.summary,
  }, null, 2));
}

main();
