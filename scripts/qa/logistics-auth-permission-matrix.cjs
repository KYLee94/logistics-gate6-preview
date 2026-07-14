const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const ARTIFACT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const CRITICAL_RUNTIME_FILES = [
  'src/context/AuthContext.jsx',
  'src/components/system/AuthSetup.jsx',
  'src/components/system/workspace/WorkspaceLogistics.jsx',
  'src/components/system/IotaLeftNav.jsx',
];
const SYSTEM_ADMIN_EMAILS = [
  'kylee@igisam.com',
  'sjlee@igisam.com',
  'jk.jeon@igisam.com',
  'seunghoon.lee@igisam.com',
  'ethan.lee@igisam.com',
];
const FEATURE_MANAGER_EMAILS = SYSTEM_ADMIN_EMAILS.slice(0, 3);
const FEATURE_KEYS = [
  'ai_chat',
  'data_quality',
  'analysis_tools',
  'data_playground',
  'login_history',
  'building_register_refresh',
  'opendart_refresh',
];

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function sqlTextArray(values) {
  return `array[${values.map((value) => `'${String(value).replace(/'/g, "''")}'`).join(',')}]`;
}

function runSupabaseQuery(sql) {
  const tmpPath = path.join(os.tmpdir(), `gate6-auth-permission-matrix-${process.pid}-${Date.now()}.sql`);
  fs.writeFileSync(tmpPath, sql, 'utf8');
  const result = spawnSync('npx', ['supabase', 'db', 'query', '--linked', '--file', tmpPath, '-o', 'json'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  try {
    fs.unlinkSync(tmpPath);
  } catch {
    // best effort
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'supabase db query failed').trim());
  }
  const text = (result.stdout || '').trim();
  const firstJson = text.indexOf('{');
  const lastJson = text.lastIndexOf('}');
  const jsonText = firstJson >= 0 && lastJson >= firstJson ? text.slice(firstJson, lastJson + 1) : text;
  const parsed = JSON.parse(jsonText || '{"rows":[]}');
  return Array.isArray(parsed) ? parsed : (parsed.rows || []);
}

function scanRuntimeImports() {
  return CRITICAL_RUNTIME_FILES.flatMap((relativePath) => {
    const absolutePath = path.join(ROOT, relativePath);
    const text = fs.readFileSync(absolutePath, 'utf8');
    const findings = [];
    if (/logisticsPermissionUsers|findStaticLogisticsPermissionUser|mergeBootstrapPermission/.test(text)) {
      findings.push({ file: relativePath, issue: 'runtime_permission_fallback' });
    }
    if (/LOGISTICS_ALLOWED_EMAILS|LOGISTICS_PERMISSION_USERS|logisticsUserByEmail/.test(text)) {
      findings.push({ file: relativePath, issue: 'legacy_frontend_permission_gate' });
    }
    return findings;
  });
}

function buildSql() {
  return `
with profiles as (
  select
    user_id,
    lower(email) as email,
    staff_name,
    organization,
    account_status,
    logistics_role,
    feature_permissions,
    last_login_at
  from public.ll_user_permissions
  where email is not null
    and btrim(email) <> ''
    and principal_type is null
    and scope_type is null
),
scopes as (
  select user_id, lower(principal_id) as principal_id, scope_type, scope_id, can_read, can_write, can_delete
  from public.ll_user_permissions
  where email is null
    and principal_type = 'user_email'
    and scope_type in ('asset', 'other_assets')
),
duplicates as (
  select email, count(*) as row_count
  from profiles
  group by email
  having count(*) > 1
),
duplicate_scopes as (
  select principal_id, scope_type, scope_id, count(*) as row_count
  from scopes
  group by principal_id, scope_type, scope_id
  having count(*) > 1
),
orphan_scopes as (
  select scopes.*
  from scopes
  left join profiles on profiles.email = scopes.principal_id
  where profiles.email is null
),
invalid_asset_scopes as (
  select scopes.*
  from scopes
  left join public.ll_assets on ll_assets.asset_id::text = scopes.scope_id
  where scopes.scope_type = 'asset' and ll_assets.asset_id is null
),
feature_counts as (
  select key, count(*)::int as granted_count
  from profiles
  cross join unnest(${sqlTextArray(FEATURE_KEYS)}::text[]) as key
  where coalesce((feature_permissions ->> key)::boolean, false) is true
  group by key
)
select jsonb_build_object(
  'permission_user_count', (select count(*) from profiles),
  'active_permission_user_count', (select count(*) from profiles where coalesce(account_status, 'active') = 'active'),
  'system_admin_count', (select count(*) from profiles where email = any(${sqlTextArray(SYSTEM_ADMIN_EMAILS)}::text[])),
  'feature_manager_count', (select count(*) from profiles where email = any(${sqlTextArray(FEATURE_MANAGER_EMAILS)}::text[])),
  'duplicate_email_count', (select count(*) from duplicates),
  'duplicate_emails', coalesce((select jsonb_agg(email order by email) from duplicates), '[]'::jsonb),
  'scope_row_count', (select count(*) from scopes),
  'scope_user_count', (select count(distinct principal_id) from scopes),
  'asset_scope_row_count', (select count(*) from scopes where scope_type = 'asset'),
  'other_scope_row_count', (select count(*) from scopes where scope_type = 'other_assets'),
  'duplicate_scope_count', (select count(*) from duplicate_scopes),
  'orphan_scope_count', (select count(*) from orphan_scopes),
  'invalid_asset_scope_count', (select count(*) from invalid_asset_scopes),
  'feature_grant_counts', coalesce((select jsonb_object_agg(key, granted_count order by key) from feature_counts), '{}'::jsonb),
  'recent_login_rows', (select count(*) from profiles where last_login_at is not null)
) as result;
`;
}

function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const staticFindings = scanRuntimeImports();
  const queryRows = runSupabaseQuery(buildSql());
  const db = queryRows?.[0]?.result || {};
  const failures = [];

  if (staticFindings.length) failures.push('runtime permission fallback or legacy gate remains');
  if (Number(db.permission_user_count || 0) < 1) failures.push('no permission profiles exist');
  if (Number(db.duplicate_email_count || 0) > 0) failures.push('duplicate permission emails exist');
  if (Number(db.duplicate_scope_count || 0) > 0) failures.push('duplicate permission scopes exist');
  if (Number(db.orphan_scope_count || 0) > 0) failures.push('permission scopes without profiles exist');
  if (Number(db.invalid_asset_scope_count || 0) > 0) failures.push('permission scopes reference missing assets');
  if (Number(db.system_admin_count || 0) !== SYSTEM_ADMIN_EMAILS.length) failures.push('system admin profiles are missing');
  if (Number(db.feature_manager_count || 0) !== FEATURE_MANAGER_EMAILS.length) failures.push('feature access manager profiles are missing');

  const report = {
    ok: failures.length === 0,
    generated_at: new Date().toISOString(),
    db,
    policy: {
      system_admin_emails: SYSTEM_ADMIN_EMAILS,
      feature_manager_emails: FEATURE_MANAGER_EMAILS,
      features_are_independent: true,
    },
    static_findings: staticFindings,
    failures,
  };
  const artifactPath = path.join(ARTIFACT_DIR, `auth-permission-matrix-${timestamp()}.json`);
  const latestPath = path.join(ARTIFACT_DIR, 'auth-permission-matrix-latest.json');
  fs.writeFileSync(artifactPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(latestPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main();
