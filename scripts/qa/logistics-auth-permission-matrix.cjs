const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const ARTIFACT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const SOURCE_JSON = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'logisticsPermissionData.json');
const CRITICAL_RUNTIME_FILES = [
  'src/context/AuthContext.jsx',
  'src/components/system/AuthSetup.jsx',
  'src/components/system/workspace/WorkspaceLogistics.jsx',
  'src/components/system/IotaLeftNav.jsx',
];
const ADMIN_EMAILS = [
  'kylee@igisam.com',
  'sjlee@igisam.com',
  'jk.jeon@igisam.com',
  'hayun.jeong@igisam.com',
];
const FEATURE_KEYS = [
  'ai_chat',
  'data_quality',
  'analysis_tools',
  'data_playground',
  'login_history',
  'building_register_refresh',
  'opendart_refresh',
];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function readSourceUsers() {
  const parsed = JSON.parse(fs.readFileSync(SOURCE_JSON, 'utf8'));
  return (parsed.users || [])
    .map((user) => ({
      email: normalizeEmail(user.email),
      staff_name: String(user.name || '').trim(),
      organization: String(user.organization || '').trim(),
    }))
    .filter((user) => user.email);
}

function sqlJsonLiteral(value) {
  return `$json$${JSON.stringify(value)}$json$`;
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
    if (/import\s+.*logisticsPermissionData\.json/.test(text)) {
      findings.push({ file: relativePath, issue: 'runtime_permission_json_import' });
    }
    if (/LOGISTICS_ALLOWED_EMAILS|LOGISTICS_PERMISSION_USERS|logisticsUserByEmail/.test(text)) {
      findings.push({ file: relativePath, issue: 'legacy_frontend_permission_gate' });
    }
    return findings;
  });
}

function buildSql(sourceUsers) {
  return `
with source_users as (
  select lower(email) as email, staff_name, organization
  from jsonb_to_recordset(${sqlJsonLiteral(sourceUsers)}::jsonb) as x(email text, staff_name text, organization text)
),
permissions as (
  select
    lower(email) as email,
    staff_name,
    organization,
    account_status,
    logistics_role,
    feature_permissions,
    last_login_at
  from public.ll_user_permissions
  where email is not null and btrim(email) <> ''
),
duplicates as (
  select email, count(*) as row_count
  from permissions
  group by email
  having count(*) > 1
),
missing_source as (
  select source_users.email
  from source_users
  left join permissions on permissions.email = source_users.email
  where permissions.email is null
),
admin_rows as (
  select *
  from permissions
  where email = any(${sqlTextArray(ADMIN_EMAILS)}::text[])
),
admin_feature_gaps as (
  select email, key
  from admin_rows
  cross join unnest(${sqlTextArray(FEATURE_KEYS)}::text[]) as key
  where coalesce((feature_permissions ->> key)::boolean, false) is not true
)
select jsonb_build_object(
  'source_user_count', (select count(*) from source_users),
  'permission_user_count', (select count(*) from permissions),
  'active_permission_user_count', (select count(*) from permissions where coalesce(account_status, 'active') = 'active'),
  'duplicate_email_count', (select count(*) from duplicates),
  'duplicate_emails', coalesce((select jsonb_agg(email order by email) from duplicates), '[]'::jsonb),
  'missing_source_count', (select count(*) from missing_source),
  'missing_source_emails', coalesce((select jsonb_agg(email order by email) from missing_source), '[]'::jsonb),
  'admin_user_count', (select count(*) from admin_rows),
  'admin_feature_gap_count', (select count(*) from admin_feature_gaps),
  'admin_feature_gaps', coalesce((select jsonb_agg(jsonb_build_object('email', email, 'feature', key) order by email, key) from admin_feature_gaps), '[]'::jsonb),
  'recent_login_rows', (
    select count(*)
    from public.ll_audit_events
    where event_type = 'auth_login'
      and coalesce(event_status, '') <> 'smoke_rolled_back'
  )
) as result;
`;
}

function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const sourceUsers = readSourceUsers();
  const staticFindings = scanRuntimeImports();
  const queryRows = runSupabaseQuery(buildSql(sourceUsers));
  const db = queryRows?.[0]?.result || {};
  const failures = [];

  if (staticFindings.length) failures.push('critical runtime files still depend on frontend permission JSON');
  if (Number(db.source_user_count || 0) !== sourceUsers.length) failures.push('source JSON count mismatch');
  if (Number(db.permission_user_count || 0) < sourceUsers.length) failures.push('ll_user_permissions has fewer users than source JSON');
  if (Number(db.duplicate_email_count || 0) > 0) failures.push('duplicate permission emails exist');
  if (Number(db.missing_source_count || 0) > 0) failures.push('some source users are not backfilled to ll_user_permissions');
  if (Number(db.admin_user_count || 0) !== ADMIN_EMAILS.length) failures.push('admin users are missing from ll_user_permissions');
  if (Number(db.admin_feature_gap_count || 0) > 0) failures.push('admin feature permissions are incomplete');

  const report = {
    ok: failures.length === 0,
    generated_at: new Date().toISOString(),
    source_json: path.relative(ROOT, SOURCE_JSON),
    db,
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
