const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const ARTIFACT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6', 'column-audit');
const SCHEMA_VERSION = 'gate6-ll-column-audit/v1';
const MAX_REFS_PER_COLUMN = 120;

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function attachManifestSha(manifest) {
  const next = JSON.parse(JSON.stringify(manifest));
  delete next.manifest_sha256;
  next.manifest_sha256 = sha256Text(canonicalStringify(next));
  return next;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function readLinkedProjectRef(root = ROOT) {
  for (const candidate of [
    path.join(root, 'supabase', '.temp', 'project-ref'),
    path.join(root, '.supabase', 'project-ref'),
  ]) {
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate, 'utf8').trim();
  }
  return '';
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseJsonFromOutput(raw) {
  const text = String(raw || '').trim();
  if (!text) throw new Error('Supabase CLI returned no JSON output.');
  try {
    return JSON.parse(text);
  } catch {
    // The CLI may print a notice before the JSON payload.
  }
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{' && text[start] !== '[') continue;
    for (let end = text.length - 1; end > start; end -= 1) {
      if (text[end] !== '}' && text[end] !== ']') continue;
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        // Try another possible JSON boundary.
      }
    }
  }
  throw new Error('Supabase CLI JSON output could not be parsed.');
}

function extractRows(parsed) {
  if (Array.isArray(parsed)) {
    const nested = parsed.flatMap((item) => Array.isArray(item?.rows) ? item.rows : []);
    return nested.length ? nested : parsed;
  }
  if (Array.isArray(parsed?.rows)) return parsed.rows;
  if (Array.isArray(parsed?.result?.rows)) return parsed.result.rows;
  return [];
}

function sanitizeCommandError(value) {
  return String(value || 'Supabase DB query failed.')
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/giu, 'postgresql://[redacted]@')
    .replace(/(password|service_role_key|access_token)=([^\s&]+)/giu, '$1=[redacted]')
    .trim();
}

function stripSqlComments(sql) {
  return String(sql || '')
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/--[^\r\n]*/gu, ' ');
}

function assertReadOnlySql(sql) {
  const normalized = stripSqlComments(sql).replace(/\s+/gu, ' ').trim().toLowerCase();
  if (!/^begin isolation level repeatable read read only;/u.test(normalized)) {
    throw new Error('Audit SQL must begin a REPEATABLE READ READ ONLY transaction.');
  }
  const prohibited = /\b(insert|update|delete|merge|alter|drop|create|grant|revoke|truncate|copy|call|do|vacuum|analyze)\b/iu;
  if (prohibited.test(normalized)) throw new Error(`Audit SQL contains a prohibited mutation token: ${normalized.match(prohibited)[0]}`);
  if (!/\bcommit;?$/u.test(normalized)) throw new Error('Audit SQL must commit its read-only transaction.');
  return true;
}

function readOnlySql(selectSql, timeoutMs) {
  const timeout = Math.max(1000, Math.floor(Number(timeoutMs) || 120000));
  const sql = `begin isolation level repeatable read read only;
set local statement_timeout = '${timeout}ms';
${selectSql.trim()}
commit;`;
  assertReadOnlySql(sql);
  return sql;
}

function buildMetadataSql(timeoutMs) {
  return readOnlySql(`
select jsonb_build_object(
  'transaction_isolation', current_setting('transaction_isolation'),
  'transaction_read_only', current_setting('transaction_read_only'),
  'database_name', current_database(),
  'server_version_num', current_setting('server_version_num'),
  'relations', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema_name', ns.nspname,
      'table_name', rel.relname,
      'relation_kind', rel.relkind::text,
      'rls_enabled', rel.relrowsecurity,
      'rls_forced', rel.relforcerowsecurity
    ) order by ns.nspname, rel.relname)
    from pg_class rel
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname like 'll\\_%' escape '\\'
      and rel.relkind in ('r', 'p', 'v', 'm', 'f')
  ), '[]'::jsonb),
  'columns', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema_name', ns.nspname,
      'table_name', rel.relname,
      'relation_kind', rel.relkind::text,
      'column_name', attr.attname,
      'ordinal_position', attr.attnum,
      'data_type', pg_catalog.format_type(attr.atttypid, attr.atttypmod),
      'nullable', not attr.attnotnull,
      'default_expression', pg_get_expr(def.adbin, def.adrelid),
      'identity', attr.attidentity <> '',
      'generated', attr.attgenerated <> '',
      'rls_enabled', rel.relrowsecurity,
      'rls_forced', rel.relforcerowsecurity,
      'column_comment', col_description(rel.oid, attr.attnum)
    ) order by ns.nspname, rel.relname, attr.attnum)
    from pg_class rel
    join pg_namespace ns on ns.oid = rel.relnamespace
    join pg_attribute attr on attr.attrelid = rel.oid and attr.attnum > 0 and not attr.attisdropped
    left join pg_attrdef def on def.adrelid = rel.oid and def.adnum = attr.attnum
    where ns.nspname = 'public'
      and rel.relname like 'll\\_%' escape '\\'
      and rel.relkind in ('r', 'p', 'v', 'm', 'f')
  ), '[]'::jsonb),
  'indexes', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema_name', ns.nspname,
      'table_name', rel.relname,
      'column_name', attr.attname,
      'index_name', idx_rel.relname,
      'is_primary', idx.indisprimary,
      'is_unique', idx.indisunique,
      'is_valid', idx.indisvalid,
      'definition', pg_get_indexdef(idx.indexrelid)
    ) order by ns.nspname, rel.relname, idx_rel.relname, key_pos.ordinality)
    from pg_index idx
    join pg_class rel on rel.oid = idx.indrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    join pg_class idx_rel on idx_rel.oid = idx.indexrelid
    join lateral unnest(idx.indkey) with ordinality as key_pos(attnum, ordinality) on key_pos.attnum > 0
    join pg_attribute attr on attr.attrelid = rel.oid and attr.attnum = key_pos.attnum
    where ns.nspname = 'public' and rel.relname like 'll\\_%' escape '\\'
  ), '[]'::jsonb),
  'foreign_keys', coalesce((
    select jsonb_agg(jsonb_build_object(
      'constraint_name', con.conname,
      'source_schema', source_ns.nspname,
      'source_table', source_rel.relname,
      'source_column', source_attr.attname,
      'target_schema', target_ns.nspname,
      'target_table', target_rel.relname,
      'target_column', target_attr.attname,
      'definition', pg_get_constraintdef(con.oid)
    ) order by con.conname, source_pos.ordinality)
    from pg_constraint con
    join pg_class source_rel on source_rel.oid = con.conrelid
    join pg_namespace source_ns on source_ns.oid = source_rel.relnamespace
    join pg_class target_rel on target_rel.oid = con.confrelid
    join pg_namespace target_ns on target_ns.oid = target_rel.relnamespace
    join lateral unnest(con.conkey) with ordinality as source_pos(attnum, ordinality) on true
    join lateral unnest(con.confkey) with ordinality as target_pos(attnum, ordinality) on target_pos.ordinality = source_pos.ordinality
    join pg_attribute source_attr on source_attr.attrelid = source_rel.oid and source_attr.attnum = source_pos.attnum
    join pg_attribute target_attr on target_attr.attrelid = target_rel.oid and target_attr.attnum = target_pos.attnum
    where con.contype = 'f'
      and ((source_ns.nspname = 'public' and source_rel.relname like 'll\\_%' escape '\\')
        or (target_ns.nspname = 'public' and target_rel.relname like 'll\\_%' escape '\\'))
  ), '[]'::jsonb),
  'rls_policies', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema_name', p.schemaname,
      'table_name', p.tablename,
      'policy_name', p.policyname,
      'command', p.cmd,
      'roles', p.roles,
      'using_expression', p.qual,
      'with_check_expression', p.with_check
    ) order by p.schemaname, p.tablename, p.policyname)
    from pg_policies p
    where p.schemaname = 'public' and p.tablename like 'll\\_%' escape '\\'
  ), '[]'::jsonb),
  'column_dependencies', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema_name', ns.nspname,
      'table_name', rel.relname,
      'column_name', attr.attname,
      'dependency_type', dep.deptype::text,
      'dependent_class', dep.classid::regclass::text,
      'dependent_object', pg_describe_object(dep.classid, dep.objid, dep.objsubid)
    ) order by ns.nspname, rel.relname, attr.attname, dep.classid::regclass::text, dep.objid)
    from pg_depend dep
    join pg_class rel on rel.oid = dep.refobjid
    join pg_namespace ns on ns.oid = rel.relnamespace
    join pg_attribute attr on attr.attrelid = rel.oid and attr.attnum = dep.refobjsubid
    where ns.nspname = 'public' and rel.relname like 'll\\_%' escape '\\'
      and dep.refobjsubid > 0
  ), '[]'::jsonb)
) as snapshot;`, timeoutMs);
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/gu, '""')}"`;
}

function quoteLiteral(value) {
  return `'${String(value).replace(/'/gu, "''")}'`;
}

function buildColumnStatsSql(columns, timeoutMs) {
  const groups = new Map();
  for (const column of columns) {
    const key = `${column.schema_name}.${column.table_name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(column);
  }
  const statements = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, group]) => {
    const first = group[0];
    const values = group.map((column) => `(${quoteLiteral(column.column_name)})`).join(', ');
    const jsonPairs = group.map((column) => `${quoteLiteral(column.column_name)}, source.${quoteIdentifier(column.column_name)}`).join(', ');
    return `(with row_values as (
      select jsonb_build_object(${jsonPairs}) as row_json
      from ${quoteIdentifier(first.schema_name)}.${quoteIdentifier(first.table_name)} as source
    ), entries as (
      select item.key as column_name, item.value as value
      from row_values cross join lateral jsonb_each(row_json) as item(key, value)
    )
    select ${quoteLiteral(first.schema_name)}::text as schema_name,
      ${quoteLiteral(first.table_name)}::text as table_name,
      expected.column_name,
      count(entries.column_name)::bigint as row_count,
      count(entries.column_name) filter (where entries.value = 'null'::jsonb)::bigint as null_count,
      count(distinct entries.value) filter (where entries.value <> 'null'::jsonb)::bigint as distinct_count,
      coalesce(sum(octet_length(entries.value::text)), 0)::bigint as payload_size_bytes,
      coalesce(sum(octet_length(entries.value::text)) filter (where entries.value <> 'null'::jsonb), 0)::bigint as non_null_payload_size_bytes
    from (values ${values}) as expected(column_name)
    left join entries on entries.column_name = expected.column_name
    group by expected.column_name)`;
  });
  const selectSql = statements.length
    ? statements.join('\nunion all\n')
    : "select null::text as schema_name, null::text as table_name, null::text as column_name, 0::bigint as row_count, 0::bigint as null_count, 0::bigint as distinct_count, 0::bigint as payload_size_bytes, 0::bigint as non_null_payload_size_bytes where false";
  return readOnlySql(`${selectSql};`, timeoutMs);
}

function runSupabaseDbQuery(sql, options = {}) {
  assertReadOnlySql(sql);
  const root = options.root || ROOT;
  const prefix = options.prefix || 'gate6-ll-column-audit';
  const sqlFile = path.join(os.tmpdir(), `${prefix}-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.sql`);
  fs.writeFileSync(sqlFile, sql, 'utf8');
  try {
    const result = spawnSync('npx', ['--yes', 'supabase', 'db', 'query', '--linked', '--file', sqlFile, '-o', 'json'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 128,
      shell: process.platform === 'win32',
      timeout: Math.max(1000, Number(options.timeoutMs) || 120000),
      windowsHide: true,
      env: process.env,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(sanitizeCommandError(result.stderr || result.stdout || `supabase db query exited ${result.status}`));
    return extractRows(parseJsonFromOutput(result.stdout));
  } finally {
    fs.rmSync(sqlFile, { force: true });
  }
}

function collectSnapshot(options = {}) {
  const result = {
    status: options.dryRun ? 'not_attempted' : 'unavailable',
    project_ref: options.projectRef || readLinkedProjectRef(options.root || ROOT) || null,
    metadata: {},
    statistics: [],
    queries: [],
    error: null,
  };
  if (options.dryRun) return result;
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 120000);
  const metadataSql = buildMetadataSql(timeoutMs);
  result.queries.push({ stage: 'metadata', read_only_verified: true, sql_sha256: sha256Text(metadataSql) });
  try {
    const rows = runSupabaseDbQuery(metadataSql, { root: options.root, prefix: 'gate6-ll-column-metadata', timeoutMs });
    const snapshot = normalizeJson(rows[0]?.snapshot || rows[0]);
    if (!snapshot || typeof snapshot !== 'object') throw new Error('Metadata query returned no snapshot object.');
    result.metadata = snapshot;
  } catch (error) {
    result.error = sanitizeCommandError(error instanceof Error ? error.message : error);
    return result;
  }
  const columns = asArray(result.metadata.columns);
  if (!columns.length) {
    result.status = 'available';
    return result;
  }
  const statsSql = buildColumnStatsSql(columns, timeoutMs);
  result.queries.push({ stage: 'statistics', read_only_verified: true, sql_sha256: sha256Text(statsSql) });
  try {
    result.statistics = runSupabaseDbQuery(statsSql, { root: options.root, prefix: 'gate6-ll-column-stats', timeoutMs });
    result.status = 'available';
  } catch (error) {
    result.status = 'partial';
    result.error = sanitizeCommandError(error instanceof Error ? error.message : error);
  }
  return result;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function listCodeFiles(root) {
  const entries = [];
  const allowedExtensions = new Set(['.js', '.jsx', '.cjs', '.mjs', '.ts', '.tsx', '.sql']);
  const excluded = new Set(['node_modules', '.git', 'dist', 'qa-artifacts', '.tools']);
  for (const directory of ['src', 'scripts', 'supabase', 'tests']) {
    const base = path.join(root, directory);
    if (!fs.existsSync(base)) continue;
    const visit = (current) => {
      for (const item of fs.readdirSync(current, { withFileTypes: true })) {
        if (item.isDirectory()) {
          if (!excluded.has(item.name)) visit(path.join(current, item.name));
        } else if (item.isFile() && allowedExtensions.has(path.extname(item.name).toLowerCase())) {
          entries.push(path.join(current, item.name));
        }
      }
    };
    visit(base);
  }
  return entries.sort();
}

function classifyReference(lines, index) {
  const context = lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 2)).join(' ').toLowerCase();
  if (/\b(insert|update|upsert|delete|alter|create|set)\b|\.(insert|update|upsert)\s*\(/u.test(context)) return 'write';
  if (/\b(select|from|returning|read|query)\b|\.select\s*\(/u.test(context)) return 'read';
  return 'unknown';
}

function collectCodeReferences(columns, root = ROOT) {
  const fileNames = listCodeFiles(root);
  const results = new Map(columns.map((column) => [`${column.schema_name}.${column.table_name}.${column.column_name}`, {
    references: [], total_count: 0, direct_count: 0, potential_count: 0, by_kind: { read: 0, write: 0, unknown: 0 }, truncated: false,
  }]));
  const targetsByColumnName = new Map();
  for (const column of columns) {
    const key = `${column.schema_name}.${column.table_name}.${column.column_name}`;
    if (!targetsByColumnName.has(column.column_name)) targetsByColumnName.set(column.column_name, []);
    targetsByColumnName.get(column.column_name).push({ ...column, key });
  }
  const selfPaths = new Set([
    'scripts/lib/logistics-column-audit-core.cjs',
    'scripts/qa/logistics-column-audit-preflight.cjs',
    'scripts/qa/logistics-column-audit-self-test.cjs',
  ]);
  for (const fileName of fileNames) {
    const relativePath = path.relative(root, fileName).split(path.sep).join('/');
    if (selfPaths.has(relativePath)) continue;
    const content = fs.readFileSync(fileName, 'utf8');
    const lowerContent = content.toLowerCase();
    const lines = content.split(/\r?\n/u);
    for (const [columnName, targets] of targetsByColumnName) {
      const columnPattern = new RegExp(`\\b${escapeRegExp(columnName)}\\b`, 'iu');
      if (!columnPattern.test(content)) continue;
      const matchingLines = [];
      lines.forEach((line, index) => { if (columnPattern.test(line)) matchingLines.push(index); });
      for (const target of targets) {
        const tableScoped = lowerContent.includes(target.table_name.toLowerCase());
        for (const lineIndex of matchingLines) {
          const record = results.get(target.key);
          const kind = classifyReference(lines, lineIndex);
          record.total_count += 1;
          record.by_kind[kind] += 1;
          if (tableScoped) record.direct_count += 1;
          else record.potential_count += 1;
          if (record.references.length < MAX_REFS_PER_COLUMN) {
            record.references.push({ file: relativePath, line: lineIndex + 1, kind, scope: tableScoped ? 'table_scoped' : 'potential_unscoped' });
          } else {
            record.truncated = true;
          }
        }
      }
    }
  }
  return { files_scanned: fileNames.length, by_column: results };
}

function countText(value) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function isZero(value) {
  return String(value ?? '') === '0';
}

function buildAuditManifest(snapshot, options = {}) {
  const root = options.root || ROOT;
  const metadata = snapshot.metadata || {};
  const columns = asArray(metadata.columns).sort((left, right) => `${left.schema_name}.${left.table_name}.${left.ordinal_position}`.localeCompare(`${right.schema_name}.${right.table_name}.${right.ordinal_position}`));
  const indexes = asArray(metadata.indexes);
  const foreignKeys = asArray(metadata.foreign_keys);
  const policies = asArray(metadata.rls_policies);
  const dependencies = asArray(metadata.column_dependencies);
  const statistics = new Map(asArray(snapshot.statistics).map((row) => [`${row.schema_name}.${row.table_name}.${row.column_name}`, row]));
  const referenceScan = collectCodeReferences(columns, root);
  const records = columns.map((column) => {
    const key = `${column.schema_name}.${column.table_name}.${column.column_name}`;
    const stat = statistics.get(key) || null;
    const columnIndexes = indexes.filter((row) => row.schema_name === column.schema_name && row.table_name === column.table_name && row.column_name === column.column_name);
    const columnForeignKeys = foreignKeys.filter((row) => (
      (row.source_schema === column.schema_name && row.source_table === column.table_name && row.source_column === column.column_name)
      || (row.target_schema === column.schema_name && row.target_table === column.table_name && row.target_column === column.column_name)
    ));
    const columnPolicies = policies.filter((row) => row.schema_name === column.schema_name && row.table_name === column.table_name);
    const columnDependencies = dependencies.filter((row) => row.schema_name === column.schema_name && row.table_name === column.table_name && row.column_name === column.column_name);
    const code = referenceScan.by_column.get(key);
    const criteria = {
      snapshot_complete: snapshot.status === 'available',
      statistics_collected: Boolean(stat),
      all_values_null: Boolean(stat) && String(stat.row_count) === String(stat.null_count),
      no_default_or_generated_value: !column.default_expression && !column.identity && !column.generated,
      no_index_dependency: columnIndexes.length === 0,
      no_foreign_key_dependency: columnForeignKeys.length === 0,
      no_catalog_dependency: columnDependencies.length === 0,
      no_rls_policy_dependency: columnPolicies.length === 0,
      no_code_reference: code.total_count === 0 && !code.truncated,
    };
    criteria.eligible_for_manual_review = Object.values(criteria).every(Boolean);
    const blockers = [];
    if (!criteria.snapshot_complete) blockers.push('operational_snapshot_incomplete');
    if (!criteria.statistics_collected) blockers.push('statistics_missing');
    if (!criteria.all_values_null) blockers.push('non_null_values_or_unverified_null_count');
    if (!criteria.no_default_or_generated_value) blockers.push('default_identity_or_generated_value_present');
    if (!criteria.no_index_dependency) blockers.push('index_dependency_present');
    if (!criteria.no_foreign_key_dependency) blockers.push('foreign_key_dependency_present');
    if (!criteria.no_catalog_dependency) blockers.push('catalog_dependency_present');
    if (!criteria.no_rls_policy_dependency) blockers.push('rls_policy_present');
    if (!criteria.no_code_reference) blockers.push('code_reference_present_or_scan_truncated');
    blockers.push('manual_approval_required_no_delete_capability');
    return {
      qualified_name: key,
      schema_name: column.schema_name,
      table_name: column.table_name,
      column_name: column.column_name,
      db: {
        relation_kind: column.relation_kind || null,
        data_type: column.data_type || null,
        nullable: Boolean(column.nullable),
        default_expression: column.default_expression || null,
        identity: Boolean(column.identity),
        generated: Boolean(column.generated),
        rls_enabled: Boolean(column.rls_enabled),
        rls_forced: Boolean(column.rls_forced),
      },
      dependencies: { indexes: columnIndexes, foreign_keys: columnForeignKeys, rls_policies: columnPolicies, catalog: columnDependencies },
      statistics: stat ? {
        row_count: countText(stat.row_count),
        null_count: countText(stat.null_count),
        distinct_count: countText(stat.distinct_count),
        payload_size_bytes: countText(stat.payload_size_bytes),
        non_null_payload_size_bytes: countText(stat.non_null_payload_size_bytes),
        payload_size_representation: 'jsonb_text_bytes',
      } : null,
      code_references: { total_count: code.total_count, table_scoped_count: code.direct_count, potential_unscoped_count: code.potential_count, by_kind: code.by_kind, truncated: code.truncated, references: code.references },
      criteria,
      blockers,
      decision: 'hold',
    };
  });
  const summary = {
    total_columns: records.length,
    hold_count: records.length,
    criteria_not_met_count: records.filter((record) => !record.criteria.eligible_for_manual_review).length,
    eligible_for_manual_review_count: records.filter((record) => record.criteria.eligible_for_manual_review).length,
    database_snapshot_available: snapshot.status === 'available',
  };
  const globalBlockers = ['This command has no delete, alter, or apply capability; every column remains hold.'];
  if (snapshot.status !== 'available') globalBlockers.push(`Operational snapshot is ${snapshot.status}${snapshot.error ? `: ${snapshot.error}` : '.'}`);
  if (!records.length) globalBlockers.push('No public.ll_* columns were captured.');
  return attachManifestSha({
    schema_version: SCHEMA_VERSION,
    kind: 'll_column_cleanup_preflight',
    generated_at: new Date().toISOString(),
    provenance: { project_ref: snapshot.project_ref || options.projectRef || null, repository_root: root },
    execution: {
      mode: 'read_only',
      dry_run: Boolean(options.dryRun),
      database_query_executed: !options.dryRun,
      mutation_capability: false,
      queries: snapshot.queries || [],
    },
    snapshot: {
      status: snapshot.status,
      transaction_isolation: metadata.transaction_isolation || null,
      transaction_read_only: metadata.transaction_read_only || null,
      database_name: metadata.database_name || null,
      error: snapshot.error || null,
    },
    code_scan: { files_scanned: referenceScan.files_scanned, roots: ['src', 'scripts', 'supabase', 'tests'] },
    columns: records,
    summary,
    safety_gate: { decision: 'hold', operation: 'none', automatic_deletion_allowed: false, blockers: globalBlockers },
  });
}

function collectAudit(options = {}) {
  const snapshot = collectSnapshot(options);
  return buildAuditManifest(snapshot, options);
}

function verifyManifest(manifest) {
  const errors = [];
  if (!manifest || manifest.schema_version !== SCHEMA_VERSION) errors.push('unexpected manifest schema version');
  if (manifest?.execution?.mutation_capability !== false) errors.push('manifest must state mutation_capability=false');
  if (manifest?.safety_gate?.decision !== 'hold') errors.push('manifest must remain hold');
  const expected = attachManifestSha(manifest || {}).manifest_sha256;
  if (!/^[a-f0-9]{64}$/u.test(String(manifest?.manifest_sha256 || ''))) errors.push('manifest SHA-256 missing or invalid');
  else if (manifest.manifest_sha256 !== expected) errors.push('manifest SHA-256 does not match content');
  return { ok: errors.length === 0, errors };
}

function defaultArtifactPath() {
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  return path.join(ARTIFACT_DIR, `ll-column-audit-${stamp}.json`);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

module.exports = {
  ROOT,
  SCHEMA_VERSION,
  assertReadOnlySql,
  attachManifestSha,
  buildAuditManifest,
  buildColumnStatsSql,
  buildMetadataSql,
  canonicalStringify,
  collectAudit,
  collectCodeReferences,
  collectSnapshot,
  defaultArtifactPath,
  parseArgs,
  readLinkedProjectRef,
  sha256Text,
  verifyManifest,
  writeJson,
};
