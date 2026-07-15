/*
 * One-time permission reconciliation preflight for the 2026-05-13 workbook.
 * Default mode is read-only. --apply requires explicit reviewed confirmations.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..', '..');
const EXCEL_PATH = 'C:\\Users\\10524\\Desktop\\codex_realasset\\Project\\03_Logi_Leasing_Dashboard\\260513_담당자별 권한 부여_수식 제거.xlsx';
const JSON_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'logisticsPermissionData.json');
const MIGRATION_PATH = path.join(ROOT, 'supabase', 'migrations', '20260715013257_logistics_permission_reconciliation_20260715.sql');
const MIGRATION_FILENAME = path.basename(MIGRATION_PATH);
const RLS_MIGRATION_FILENAME = '20260715090000_harden_weekly_ingest_permissions_rls.sql';
const EXPECTED_MIGRATION_FILENAMES = [MIGRATION_FILENAME, RLS_MIGRATION_FILENAME];
const PROJECT_REF = 'qvegpozwrcmspdvjokiz';
const ADMIN_EMAILS = new Set(['kylee@igisam.com', 'jk.jeon@igisam.com', 'sjlee@igisam.com', 'seunghoon.lee@igisam.com', 'ethan.lee@igisam.com']);
const FULL_BACKEND_ADMIN_EMAILS = new Set(['kylee@igisam.com', 'sjlee@igisam.com', 'jk.jeon@igisam.com']);
const ADMIN_AUTH_EMAILS = Object.freeze({
  'kylee@igisam.com': ['kylee@igisam.com', '10524@igisam.com'],
  'sjlee@igisam.com': ['sjlee@igisam.com'],
  'jk.jeon@igisam.com': ['jk.jeon@igisam.com'],
});
const BACKEND_FEATURE_KEYS = [
  'ai_chat',
  'data_quality',
  'analysis_tools',
  'data_playground',
  'login_history',
  'building_register_refresh',
  'opendart_refresh',
  'market_research',
  'permission_admin',
  'approval_management',
];
const RESTRICTED_FEATURE_KEYS = [
  'ai_chat',
  'login_history',
  'building_register_refresh',
  'opendart_refresh',
  'market_research',
  'permission_admin',
  'approval_management',
];
const RIGHTS = ['read', 'create', 'update', 'delete'];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
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

function asFlags(row, offset) {
  return Object.fromEntries(RIGHTS.map((right, index) => [right, row[offset + index] === 'Y']));
}

function excelUsers() {
  if (!fs.existsSync(EXCEL_PATH)) throw new Error(`Workbook not found: ${EXCEL_PATH}`);
  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: false });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Sheet1, { header: 1, defval: '' }).slice(2);
  return rows
    .filter((row) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(String(row[1]).trim()))
    .map((row) => ({
      email: normalizeEmail(row[1]),
      staffName: String(row[0]).trim(),
      organization: String(row[2]).trim(),
      managed: asFlags(row, 3),
      other: asFlags(row, 7),
      assets: String(row[11]).split(',').map((value) => value.trim()).filter(Boolean),
    }));
}

function excelAssetRegistry() {
  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const headerIndex = rows.findIndex((row) => String(row[0]).trim() === '자산코드' && String(row[1]).trim() === '자산명');
  if (headerIndex < 0) throw new Error('Workbook asset registry header was not found.');
  const entries = rows.slice(headerIndex + 1)
    .filter((row) => /^[A-Z][A-Z0-9]+$/u.test(String(row[0]).trim()))
    .map((row, index) => ({
      asset_code: String(row[0]).trim(),
      asset_name: String(row[1]).trim(),
      fund_code: String(row[2]).trim(),
      worksheet_row: headerIndex + index + 3,
    }));
  return {
    sheet: sheetName,
    ref: sheet['!ref'],
    merged_ranges: (sheet['!merges'] || []).length,
    header_worksheet_row: headerIndex + 2,
    first_asset_worksheet_row: headerIndex + 3,
    last_asset_worksheet_row: headerIndex + entries.length + 2,
    entries,
  };
}

function jsonUsers() {
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  return (data.users || []).map((user) => ({
    email: normalizeEmail(user.email),
    staffName: String(user.name || '').trim(),
    organization: String(user.organization || '').trim(),
    managed: Object.fromEntries(RIGHTS.map((right) => [right, user.permissions?.managedAsset?.[right] === true])),
    other: Object.fromEntries(RIGHTS.map((right) => [right, user.permissions?.otherAsset?.[right] === true])),
    assets: [...new Set((user.managedAssetCodes || []).map(String).map((value) => value.trim()).filter(Boolean))],
  }));
}

function jsonAssetRegistry() {
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const entries = new Map();
  for (const user of data.users || []) {
    for (const asset of user.managedAssets || []) {
      const code = String(asset.assetCode || '').trim();
      if (code) entries.set(code, String(asset.assetName || '').trim());
    }
  }
  return entries;
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function countFlags(users, key) {
  return RIGHTS.map((right) => users.filter((user) => user[key][right]).length);
}

function effectiveCounts(users) {
  const assetCount = new Set(users.flatMap((user) => user.assets)).size;
  return RIGHTS.map((right) => users.reduce((total, user) => {
    const managed = user.managed[right] ? user.assets.length : 0;
    const other = user.other[right] ? assetCount - managed : 0;
    return total + managed + other;
  }, 0));
}

function sourceReport() {
  const excel = excelUsers();
  const json = jsonUsers();
  const assetRegistry = excelAssetRegistry();
  const jsonAssets = jsonAssetRegistry();
  const excelByEmail = new Map(excel.map((user) => [user.email, user]));
  const jsonByEmail = new Map(json.map((user) => [user.email, user]));
  const mismatch = [];
  for (const email of new Set([...excelByEmail.keys(), ...jsonByEmail.keys()])) {
    const left = excelByEmail.get(email);
    const right = jsonByEmail.get(email);
    if (!left || !right || left.staffName !== right.staffName || left.organization !== right.organization
      || !sameArray(left.assets, right.assets)
      || RIGHTS.some((rightName) => left.managed[rightName] !== right.managed[rightName] || left.other[rightName] !== right.other[rightName])) {
      mismatch.push(email);
    }
  }
  const report = {
    users: excel.length,
    unique_users: new Set(excel.map((user) => user.email)).size,
    assets: assetRegistry.entries.length,
    assignments: excel.reduce((total, user) => total + user.assets.length, 0),
    raw_managed: countFlags(excel, 'managed'),
    raw_other: countFlags(excel, 'other'),
    effective: effectiveCounts(excel),
    source_parity_mismatches: mismatch,
    admin_asset_counts: excel.filter((user) => ADMIN_EMAILS.has(user.email)).map((user) => ({ email: user.email, assets: user.assets.length })),
    full_backend_admins: [...FULL_BACKEND_ADMIN_EMAILS].sort().map((email) => ({
      email,
      assets: excelByEmail.get(email)?.assets.length,
      managed_full_crud: RIGHTS.every((right) => excelByEmail.get(email)?.managed[right] === true),
      other_full_crud: RIGHTS.every((right) => excelByEmail.get(email)?.other[right] === true),
      backend_feature_keys: BACKEND_FEATURE_KEYS,
    })),
    ethan_delete: excelByEmail.get('ethan.lee@igisam.com')?.managed.delete === false && excelByEmail.get('ethan.lee@igisam.com')?.other.delete === false,
    asset_registry: assetRegistry,
    asset_registry_mismatches: {
      assignment_codes: [...new Set(excel.flatMap((user) => user.assets))].sort().filter((code) => !assetRegistry.entries.some((entry) => entry.asset_code === code)),
      missing_assignment_codes: assetRegistry.entries.map((entry) => entry.asset_code).filter((code) => !excel.some((user) => user.assets.includes(code))),
      json_codes: assetRegistry.entries.map((entry) => entry.asset_code).filter((code) => !jsonAssets.has(code)),
      extra_json_codes: [...jsonAssets.keys()].filter((code) => !assetRegistry.entries.some((entry) => entry.asset_code === code)),
      json_names: assetRegistry.entries.filter((entry) => jsonAssets.get(entry.asset_code) !== entry.asset_name).map((entry) => entry.asset_code),
      required_a190013001: assetRegistry.entries.find((entry) => entry.asset_code === 'A190013001') || null,
    },
    asset_source_policy: 'The 19-code Excel asset registry is authoritative. A code absent from it is not added from JSON, plans, aliases, or the database; any set mismatch blocks reconciliation for manual source correction.',
  };
  const expected = report.users === 38
    && report.unique_users === 38
    && report.assets === 19
    && report.assignments === 211
    && sameArray(report.raw_managed, [38, 38, 38, 33])
    && sameArray(report.raw_other, [13, 8, 8, 4])
    && sameArray(report.effective, [318, 244, 244, 163])
    && report.source_parity_mismatches.length === 0
    && report.admin_asset_counts.length === 5
    && report.admin_asset_counts.every((entry) => entry.assets === 19)
    && report.ethan_delete;
  if (report.asset_registry_mismatches.assignment_codes.length || report.asset_registry_mismatches.missing_assignment_codes.length
    || report.asset_registry_mismatches.json_codes.length || report.asset_registry_mismatches.extra_json_codes.length
    || report.asset_registry_mismatches.json_names.length || report.asset_registry_mismatches.required_a190013001?.asset_name !== '포천정교리물류센터'
    || report.asset_registry.first_asset_worksheet_row !== 45 || report.asset_registry.last_asset_worksheet_row !== 63
    || report.asset_registry.merged_ranges !== 0) {
    throw new Error(`Asset registry validation failed: ${JSON.stringify(report.asset_registry_mismatches)}`);
  }
  if (!expected) throw new Error(`Source validation failed: ${JSON.stringify(report)}`);
  return { ...report, source_sha256: sha256(JSON.stringify(excel)) };
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/gu, "''")}'`;
}

function readbackSql(emails) {
  const list = emails.map(sqlQuote).join(', ');
  return `
with source_emails(email) as (values ${emails.map((email) => `(${sqlQuote(email)})`).join(', ')}),
profiles as (
  select p.*
  from public.ll_user_permissions p
  join source_emails s on lower(btrim(p.email)) = s.email
  where p.scope_type is null and p.scope_id is null
),
asset_total as (
  select count(distinct asset_code)::integer as count from public.ll_assets where asset_code is not null
),
scope_groups as (
  select coalesce(principal_type, '(null)') as principal_type, coalesce(scope_type, '(null)') as scope_type, count(*)::integer as rows
  from public.ll_user_permissions
  group by 1, 2
),
scope_row_hashes as (
  select
    coalesce(principal_type, '(null)') as principal_type,
    coalesce(scope_type, '(null)') as scope_type,
    count(*)::integer as rows,
    md5(coalesce(string_agg(md5(to_jsonb(p)::text), ',' order by md5(to_jsonb(p)::text)), '')) as row_hash
  from public.ll_user_permissions p
  where scope_type is not null or scope_id is not null
  group by 1, 2
),
rls_state as (
  select c.relrowsecurity as enabled, c.relforcerowsecurity as forced
  from pg_class c
  where c.oid = 'public.ll_user_permissions'::regclass
),
policy_state as (
  select policyname, roles, cmd, qual, with_check
  from pg_policies
  where schemaname = 'public' and tablename = 'll_user_permissions'
),
role_targets(grantee) as (
  values ('anon'), ('authenticated'), ('service_role')
),
role_grants as (
  select
    target.grantee,
    coalesce((
      select jsonb_agg(grant_row.privilege_type order by grant_row.privilege_type)
      from information_schema.role_table_grants grant_row
      where grant_row.table_schema = 'public'
        and grant_row.table_name = 'll_user_permissions'
        and grant_row.grantee = target.grantee
    ), '[]'::jsonb) as privileges
  from role_targets target
),
admin_auth_targets(profile_email, allowed_auth_emails) as (
  values
    ('kylee@igisam.com', array['kylee@igisam.com', '10524@igisam.com']::text[]),
    ('sjlee@igisam.com', array['sjlee@igisam.com']::text[]),
    ('jk.jeon@igisam.com', array['jk.jeon@igisam.com']::text[])
),
admin_auth_bindings as (
  select
    target.profile_email,
    target.allowed_auth_emails,
    p.user_id,
    lower(btrim(au.email)) as auth_email,
    (
      select count(*)::integer
      from auth.users candidate
      where lower(btrim(candidate.email)) = any(target.allowed_auth_emails)
    ) as allowed_auth_candidates
  from admin_auth_targets target
  left join public.ll_user_permissions p
    on lower(btrim(p.email)) = target.profile_email
   and p.scope_type is null
   and p.scope_id is null
  left join auth.users au on au.id = p.user_id
)
select jsonb_build_object(
  'source_profile_rows', (select count(*) from profiles),
  'active_staff_profiles', (select count(*) from public.ll_staff_profiles where is_active and lower(btrim(email)) in (${list})),
  'duplicate_staff_profile_emails', (select coalesce(jsonb_agg(email), '[]'::jsonb) from (select lower(btrim(email)) as email from public.ll_staff_profiles where lower(btrim(email)) in (${list}) group by 1 having count(*) <> 1) duplicates),
  'assets', (select count from asset_total),
  'canonical_assets', (select coalesce(jsonb_agg(jsonb_build_object('asset_code', asset_code, 'asset_name', btrim(asset_name)) order by asset_code), '[]'::jsonb) from public.ll_assets),
  'raw_managed', (select jsonb_build_array(count(*) filter (where (managed_asset_permissions ->> 'read')::boolean), count(*) filter (where (managed_asset_permissions ->> 'create')::boolean), count(*) filter (where (managed_asset_permissions ->> 'update')::boolean), count(*) filter (where (managed_asset_permissions ->> 'delete')::boolean)) from profiles),
  'raw_other', (select jsonb_build_array(count(*) filter (where (other_asset_permissions ->> 'read')::boolean), count(*) filter (where (other_asset_permissions ->> 'create')::boolean), count(*) filter (where (other_asset_permissions ->> 'update')::boolean), count(*) filter (where (other_asset_permissions ->> 'delete')::boolean)) from profiles),
  'effective', (select jsonb_build_array(
    sum(case when (managed_asset_permissions ->> 'read')::boolean then cardinality(managed_asset_codes) else 0 end + case when (other_asset_permissions ->> 'read')::boolean then (select count from asset_total) - case when (managed_asset_permissions ->> 'read')::boolean then cardinality(managed_asset_codes) else 0 end else 0 end),
    sum(case when (managed_asset_permissions ->> 'create')::boolean then cardinality(managed_asset_codes) else 0 end + case when (other_asset_permissions ->> 'create')::boolean then (select count from asset_total) - case when (managed_asset_permissions ->> 'create')::boolean then cardinality(managed_asset_codes) else 0 end else 0 end),
    sum(case when (managed_asset_permissions ->> 'update')::boolean then cardinality(managed_asset_codes) else 0 end + case when (other_asset_permissions ->> 'update')::boolean then (select count from asset_total) - case when (managed_asset_permissions ->> 'update')::boolean then cardinality(managed_asset_codes) else 0 end else 0 end),
    sum(case when (managed_asset_permissions ->> 'delete')::boolean then cardinality(managed_asset_codes) else 0 end + case when (other_asset_permissions ->> 'delete')::boolean then (select count from asset_total) - case when (managed_asset_permissions ->> 'delete')::boolean then cardinality(managed_asset_codes) else 0 end else 0 end)
  ) from profiles),
  'admin_managed_assets', (select coalesce(jsonb_agg(jsonb_build_object('email', lower(btrim(email)), 'assets', cardinality(managed_asset_codes)) order by lower(btrim(email))), '[]'::jsonb) from profiles where lower(btrim(email)) in ('kylee@igisam.com','jk.jeon@igisam.com','sjlee@igisam.com','seunghoon.lee@igisam.com','ethan.lee@igisam.com')),
  'full_backend_admins', (select coalesce(jsonb_agg(jsonb_build_object(
    'email', lower(btrim(email)),
    'assets', cardinality(managed_asset_codes),
    'managed_full_crud', managed_asset_permissions = '{"read": true, "create": true, "update": true, "delete": true}'::jsonb,
    'other_full_crud', other_asset_permissions = '{"read": true, "create": true, "update": true, "delete": true}'::jsonb,
    'can_read', can_read,
    'can_write', can_write,
    'can_delete', can_delete,
    'features_all_true',
      coalesce((feature_permissions ->> 'ai_chat')::boolean, false)
      and coalesce((feature_permissions ->> 'data_quality')::boolean, false)
      and coalesce((feature_permissions ->> 'analysis_tools')::boolean, false)
      and coalesce((feature_permissions ->> 'data_playground')::boolean, false)
      and coalesce((feature_permissions ->> 'login_history')::boolean, false)
      and coalesce((feature_permissions ->> 'building_register_refresh')::boolean, false)
      and coalesce((feature_permissions ->> 'opendart_refresh')::boolean, false)
      and coalesce((feature_permissions ->> 'market_research')::boolean, false)
      and coalesce((feature_permissions ->> 'permission_admin')::boolean, false)
      and coalesce((feature_permissions ->> 'approval_management')::boolean, false)
  ) order by lower(btrim(email))), '[]'::jsonb) from profiles where lower(btrim(email)) in ('kylee@igisam.com','sjlee@igisam.com','jk.jeon@igisam.com')),
  'admin_auth_bindings', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'profile_email', profile_email,
      'allowed_auth_emails', to_jsonb(allowed_auth_emails),
      'user_id', user_id,
      'auth_email', auth_email,
      'allowed_auth_candidates', allowed_auth_candidates
    ) order by profile_email), '[]'::jsonb)
    from admin_auth_bindings
  ),
  'unexpected_privileged_features', (
    select count(*)
    from public.ll_user_permissions p
    cross join lateral jsonb_each(coalesce(p.feature_permissions, '{}'::jsonb)) as feature(feature_key, feature_value)
    where p.scope_type is null
      and p.scope_id is null
      and p.account_status = 'active'
      and coalesce(lower(btrim(p.email)), '') not in ('kylee@igisam.com','sjlee@igisam.com','jk.jeon@igisam.com')
      and feature.feature_key in ('ai_chat','login_history','building_register_refresh','opendart_refresh','market_research','permission_admin','approval_management')
      and feature.feature_value = 'true'::jsonb
  ),
  'ethan_delete_false', (select coalesce((managed_asset_permissions ->> 'delete')::boolean, true) = false and coalesce((other_asset_permissions ->> 'delete')::boolean, true) = false and can_delete = false from profiles where lower(btrim(email)) = 'ethan.lee@igisam.com'),
  'hayun', (select jsonb_build_object('rows', count(*), 'disabled', bool_and(account_status = 'disabled'), 'all_rights_false', bool_and(can_read = false and can_write = false and can_delete = false and managed_asset_permissions = '{"read": false, "create": false, "update": false, "delete": false}'::jsonb and other_asset_permissions = '{"read": false, "create": false, "update": false, "delete": false}'::jsonb)) from public.ll_user_permissions where lower(btrim(email)) = 'hayun.jeong@igisam.com' and scope_type is null and scope_id is null),
  'scope_classification', (select coalesce(jsonb_agg(jsonb_build_object('principal_type', principal_type, 'scope_type', scope_type, 'rows', rows) order by rows desc), '[]'::jsonb) from scope_groups),
  'scope_row_hashes', (select coalesce(jsonb_agg(jsonb_build_object('principal_type', principal_type, 'scope_type', scope_type, 'rows', rows, 'row_hash', row_hash) order by principal_type, scope_type), '[]'::jsonb) from scope_row_hashes),
  'rls_flags', coalesce((select jsonb_build_object('enabled', enabled, 'forced', forced) from rls_state), '{}'::jsonb),
  'pg_policies', (select coalesce(jsonb_agg(jsonb_build_object('policyname', policyname, 'roles', to_jsonb(roles), 'cmd', cmd, 'qual', qual, 'with_check', with_check) order by policyname), '[]'::jsonb) from policy_state),
  'table_grants', (select coalesce(jsonb_agg(jsonb_build_object('grantee', grantee, 'privileges', privileges) order by grantee), '[]'::jsonb) from role_grants)
);`;
}

function snapshotSql(emails) {
  const profileEmails = [...new Set(emails.concat('hayun.jeong@igisam.com'))];
  const list = profileEmails.map(sqlQuote).join(', ');
  const authList = [...new Set(profileEmails.concat('10524@igisam.com'))].map(sqlQuote).join(', ');
  return `with scope_groups as (
    select coalesce(principal_type, '(null)') as principal_type, coalesce(scope_type, '(null)') as scope_type, count(*)::integer as rows
    from public.ll_user_permissions
    group by 1, 2
  ),
  scope_row_hashes as (
    select
      coalesce(principal_type, '(null)') as principal_type,
      coalesce(scope_type, '(null)') as scope_type,
      count(*)::integer as rows,
      md5(coalesce(string_agg(md5(to_jsonb(p)::text), ',' order by md5(to_jsonb(p)::text)), '')) as row_hash
    from public.ll_user_permissions p
    where scope_type is not null or scope_id is not null
    group by 1, 2
  ),
  rls_state as (
    select c.relrowsecurity as enabled, c.relforcerowsecurity as forced
    from pg_class c
    where c.oid = 'public.ll_user_permissions'::regclass
  ),
  policy_state as (
    select policyname, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename = 'll_user_permissions'
  ),
  role_targets(grantee) as (
    values ('anon'), ('authenticated'), ('service_role')
  ),
  role_grants as (
    select
      target.grantee,
      coalesce((
        select jsonb_agg(grant_row.privilege_type order by grant_row.privilege_type)
        from information_schema.role_table_grants grant_row
        where grant_row.table_schema = 'public'
          and grant_row.table_name = 'll_user_permissions'
          and grant_row.grantee = target.grantee
      ), '[]'::jsonb) as privileges
    from role_targets target
  )
  select jsonb_build_object(
    'target_permission_rows', (select coalesce(jsonb_agg(to_jsonb(p) order by lower(btrim(p.email))), '[]'::jsonb) from public.ll_user_permissions p where p.scope_type is null and p.scope_id is null and lower(btrim(p.email)) in (${list})),
    'target_staff_rows', (select coalesce(jsonb_agg(to_jsonb(sp) order by lower(btrim(sp.email))), '[]'::jsonb) from public.ll_staff_profiles sp where lower(btrim(sp.email)) in (${list})),
    'target_auth_rows', (select coalesce(jsonb_agg(jsonb_build_object('id', au.id, 'email', lower(btrim(au.email))) order by lower(btrim(au.email))), '[]'::jsonb) from auth.users au where lower(btrim(au.email)) in (${authList})),
    'scope_classification', (select coalesce(jsonb_agg(jsonb_build_object('principal_type', principal_type, 'scope_type', scope_type, 'rows', rows) order by rows desc), '[]'::jsonb) from scope_groups),
    'scope_row_hashes', (select coalesce(jsonb_agg(jsonb_build_object('principal_type', principal_type, 'scope_type', scope_type, 'rows', rows, 'row_hash', row_hash) order by principal_type, scope_type), '[]'::jsonb) from scope_row_hashes),
    'rls_flags', coalesce((select jsonb_build_object('enabled', enabled, 'forced', forced) from rls_state), '{}'::jsonb),
    'pg_policies', (select coalesce(jsonb_agg(jsonb_build_object('policyname', policyname, 'roles', to_jsonb(roles), 'cmd', cmd, 'qual', qual, 'with_check', with_check) order by policyname), '[]'::jsonb) from policy_state),
    'table_grants', (select coalesce(jsonb_agg(jsonb_build_object('grantee', grantee, 'privileges', privileges) order by grantee), '[]'::jsonb) from role_grants)
  );`;
}

function runSupabase(command, options = {}) {
  const result = spawnSync('npx', ['--yes', 'supabase', ...command], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    windowsHide: true,
    timeout: options.timeout || 10 * 60 * 1000,
  });
  if (result.error || result.status !== 0) throw new Error(String(result.stderr || result.stdout || result.error || `supabase ${command.join(' ')} failed`));
  const stdout = String(result.stdout || '').trim();
  const stderr = String(result.stderr || '').trim();
  return options.includeStderr ? [stdout, stderr].filter(Boolean).join('\n') : stdout;
}

function runSupabaseQuery(sql) {
  const sqlPath = path.join(process.env.TEMP || process.env.TMP || ROOT, `logistics-permission-preflight-${process.pid}-${Date.now()}.sql`);
  fs.writeFileSync(sqlPath, sql, 'utf8');
  try {
    return runSupabase(['db', 'query', '--linked', '--file', sqlPath, '-o', 'json']);
  } finally {
    fs.rmSync(sqlPath, { force: true });
  }
}

function parseQueryOutput(output) {
  const parsed = JSON.parse(output);
  return parsed.rows?.[0]?.jsonb_build_object || null;
}

function adminAuthBindingIssues(remote, { requireBound }) {
  const bindings = Array.isArray(remote?.admin_auth_bindings) ? remote.admin_auth_bindings : [];
  const issues = [];
  const expectedProfiles = Object.keys(ADMIN_AUTH_EMAILS);

  for (const profileEmail of expectedProfiles) {
    const rows = bindings.filter((entry) => normalizeEmail(entry.profile_email) === profileEmail);
    if (rows.length !== 1) {
      issues.push({ profile_email: profileEmail, reason: 'profile_binding_row_count', rows: rows.length });
      continue;
    }
    const [binding] = rows;
    if (Number(binding.allowed_auth_candidates) !== 1) {
      issues.push({
        profile_email: profileEmail,
        reason: 'allowed_auth_candidate_count',
        candidates: Number(binding.allowed_auth_candidates),
      });
    }
    if (!requireBound) continue;
    const userId = String(binding.user_id || '').trim();
    const authEmail = normalizeEmail(binding.auth_email);
    if (!userId) issues.push({ profile_email: profileEmail, reason: 'null_user_id' });
    if (!ADMIN_AUTH_EMAILS[profileEmail].includes(authEmail)) {
      issues.push({ profile_email: profileEmail, reason: 'unexpected_auth_email', auth_email: authEmail || null });
    }
  }

  if (bindings.length !== expectedProfiles.length) {
    issues.push({ reason: 'admin_auth_binding_row_count', rows: bindings.length });
  }
  if (requireBound) {
    const userIds = bindings.map((entry) => String(entry.user_id || '').trim()).filter(Boolean);
    if (new Set(userIds).size !== expectedProfiles.length) {
      issues.push({ reason: 'null_or_duplicate_user_id', distinct_user_ids: new Set(userIds).size });
    }
  }
  return issues;
}

function assertRemotePreflight(remote, source) {
  const adminAuthIssues = adminAuthBindingIssues(remote, { requireBound: false });
  if (adminAuthIssues.length) {
    throw new Error(`Remote preflight failed: admin Auth candidates are not unique: ${JSON.stringify(adminAuthIssues)}`);
  }
  const scope = new Map((remote.scope_classification || []).map((entry) => [`${entry.principal_type}:${entry.scope_type}`, Number(entry.rows)]));
  const expectedAssets = new Map(source.asset_registry.entries.map((entry) => [entry.asset_code, entry.asset_name]));
  const actualAssets = new Map((remote.canonical_assets || []).map((entry) => [entry.asset_code, String(entry.asset_name || '').trim()]));
  const canonicalAssetMismatch = expectedAssets.size !== actualAssets.size
    || [...expectedAssets].some(([code, name]) => actualAssets.get(code) !== name);
  if (remote.source_profile_rows !== 38 || remote.active_staff_profiles !== 38
    || (remote.duplicate_staff_profile_emails || []).length !== 0 || Number(remote.assets) !== 19
    || scope.get('user_email:asset') !== 211 || scope.get('user_email:other_assets') !== 13
    || scope.get('(null):(null)') !== 39 || remote.hayun?.rows !== 1 || canonicalAssetMismatch) {
    throw new Error(`Remote preflight failed: ${JSON.stringify(remote)}`);
  }
}

function assertRemoteReadback(remote, source) {
  const adminAuthIssues = adminAuthBindingIssues(remote, { requireBound: true });
  if (adminAuthIssues.length) {
    throw new Error(`Remote readback failed: admin Auth bindings are invalid: ${JSON.stringify(adminAuthIssues)}`);
  }
  const same = (actual, expected) => Array.isArray(actual) && sameArray(actual.map(Number), expected);
  const scope = new Map((remote.scope_classification || []).map((entry) => [`${entry.principal_type}:${entry.scope_type}`, Number(entry.rows)]));
  const expectedAssets = new Map(source.asset_registry.entries.map((entry) => [entry.asset_code, entry.asset_name]));
  const actualAssets = new Map((remote.canonical_assets || []).map((entry) => [entry.asset_code, String(entry.asset_name || '').trim()]));
  const canonicalAssetMismatch = expectedAssets.size !== actualAssets.size
    || [...expectedAssets].some(([code, name]) => actualAssets.get(code) !== name);
  const fullBackendAdmins = remote.full_backend_admins || [];
  const fullBackendAdminMismatch = fullBackendAdmins.length !== 3 || !fullBackendAdmins.every((entry) => Number(entry.assets) === 19
    && entry.managed_full_crud === true && entry.other_full_crud === true
    && entry.can_read === true && entry.can_write === true && entry.can_delete === true
    && entry.features_all_true === true);
  const grants = new Map((remote.table_grants || []).map((entry) => [
    entry.grantee,
    new Set((entry.privileges || []).map((privilege) => String(privilege).toUpperCase())),
  ]));
  const browserRolesRevoked = (grants.get('anon') || new Set()).size === 0
    && (grants.get('authenticated') || new Set()).size === 0;
  const serviceRoleCrudGranted = ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    .every((privilege) => (grants.get('service_role') || new Set()).has(privilege));
  const rlsHardened = remote.rls_flags?.enabled === true
    && Array.isArray(remote.pg_policies)
    && remote.pg_policies.length === 0;
  if (remote.source_profile_rows !== 38 || remote.active_staff_profiles !== 38 || (remote.duplicate_staff_profile_emails || []).length !== 0
    || Number(remote.assets) !== 19 || !same(remote.raw_managed, [38, 38, 38, 33]) || !same(remote.raw_other, [13, 8, 8, 4])
    || !same(remote.effective, [318, 244, 244, 163]) || scope.get('user_email:asset') !== 211 || scope.get('user_email:other_assets') !== 13
    || scope.get('(null):(null)') !== 39 || remote.ethan_delete_false !== true || remote.hayun?.rows !== 1 || remote.hayun?.disabled !== true || remote.hayun?.all_rights_false !== true
  || canonicalAssetMismatch || (remote.admin_managed_assets || []).length !== 5 || !(remote.admin_managed_assets || []).every((entry) => Number(entry.assets) === 19)
    || fullBackendAdminMismatch || Number(remote.unexpected_privileged_features) !== 0
    || !rlsHardened || !browserRolesRevoked || !serviceRoleCrudGranted) {
    throw new Error(`Remote readback failed: ${JSON.stringify(remote)}`);
  }
}

function assertApplyGuards(args, sourceSha, dryRunSha) {
  if (args.projectRef !== PROJECT_REF || args.confirmProjectRef !== PROJECT_REF) throw new Error('--project-ref and --confirm-project-ref must both equal the linked production ref.');
  if (args.confirmSourceSha !== sourceSha) throw new Error('--confirm-source-sha must equal the reported source_sha256.');
  if (args.confirmDryRunSha !== dryRunSha) throw new Error('--confirm-dry-run-sha must equal the reviewed db push --dry-run SHA-256.');
  if (!args.backupPath) throw new Error('--backup-path is required for --apply.');
  if (args.confirmApply !== 'RECONCILE_PERMISSIONS') throw new Error('--confirm-apply must equal RECONCILE_PERMISSIONS.');
  if (!String(args.backupPath).toLowerCase().endsWith('.json')) throw new Error('--backup-path must end in .json.');
  if (process.env.CI || process.env.GITHUB_ACTIONS) throw new Error('--apply is forbidden in CI.');
}

function pendingMigrationNames(dryRunOutput) {
  return String(dryRunOutput || '').split(/\r?\n/u)
    .map((line) => line.match(/^\s*(?:\u2022|-)\s+(.+\.sql)\s*$/u)?.[1])
    .filter(Boolean);
}

function assertExclusivePendingMigration(dryRunOutput) {
  const pending = pendingMigrationNames(dryRunOutput);
  if (pending.length !== EXPECTED_MIGRATION_FILENAMES.length
    || pending.some((name, index) => name !== EXPECTED_MIGRATION_FILENAMES[index])) {
    throw new Error(`Apply blocked: db push --dry-run must list exactly ${JSON.stringify(EXPECTED_MIGRATION_FILENAMES)}; found ${JSON.stringify(pending)}.`);
  }
  return pending;
}

function runSelfTest() {
  const source = sourceReport();
  const defaults = parseArgs([]);
  if (defaults.apply || source.users !== 38 || source.effective.join(',') !== '318,244,244,163') throw new Error('Self-test failed.');
  assertExclusivePendingMigration(`Would push these migrations:\n${EXPECTED_MIGRATION_FILENAMES.map((name) => ` \u2022 ${name}`).join('\n')}`);
  console.log(JSON.stringify({ ok: true, mode: 'self-test', source_sha256: source.source_sha256, expected: source }, null, 2));
}

function main() {
  const args = parseArgs();
  if (args.selfTest) return runSelfTest();
  const source = sourceReport();
  const emails = excelUsers().map((user) => user.email);
  const before = parseQueryOutput(runSupabaseQuery(snapshotSql(emails)));
  const remote = parseQueryOutput(runSupabaseQuery(readbackSql(emails)));
  let remoteValidation = { ok: true, blocker: null };
  try {
    assertRemotePreflight(remote, source);
  } catch (error) {
    remoteValidation = { ok: false, blocker: error.message };
  }
  const report = {
    ok: remoteValidation.ok,
    mode: args.apply ? 'apply' : 'dry-run',
    apply_executed: false,
    project_ref: PROJECT_REF,
    source,
    remote,
    remote_validation: remoteValidation,
    admin_auth_binding_validation: (() => {
      const issues = adminAuthBindingIssues(remote, { requireBound: true });
      return { ok: issues.length === 0, issues };
    })(),
    backup_instructions: 'Keep the baseline JSON and reviewed migration SQL together before applying. The JSON contains target permission/staff/Auth rows, scope classification and row hashes, RLS flags, pg_policies, and anon/authenticated/service_role grants.',
    rollback_instructions: 'Restore only before.target_staff_rows and before.target_permission_rows inside one transaction. Do not delete Auth users or scope rows. Before restoring, compare scope_row_hashes. The saved pre-apply RLS/policy/grant snapshot is audit evidence only: do not restore anon/authenticated grants or a self-read policy. After restoring, re-run readbackSql and require the hardened RLS state plus unchanged scope hashes.',
  };
  const dryRunOutput = runSupabase(['db', 'push', '--linked', '--dry-run'], { includeStderr: true });
  const dryRunSha = sha256(dryRunOutput);
  const pendingMigrations = assertExclusivePendingMigration(dryRunOutput);
  report.pending_migrations = pendingMigrations;
  report.dry_run_sha256 = dryRunSha;
  if (!args.apply) {
    console.log(JSON.stringify(report, null, 2));
    if (!remoteValidation.ok) process.exitCode = 1;
    return;
  }

  assertRemotePreflight(remote, source);
  assertApplyGuards(args, source.source_sha256, dryRunSha);
  const backupPath = path.resolve(args.backupPath);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, `${JSON.stringify({
    created_at: new Date().toISOString(),
    project_ref: PROJECT_REF,
    source,
    before,
    dry_run_output: dryRunOutput,
    dry_run_sha256: dryRunSha,
    rollback_instructions: report.rollback_instructions,
  }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  runSupabase(['db', 'push', '--linked']);
  const after = parseQueryOutput(runSupabaseQuery(readbackSql(emails)));
  assertRemoteReadback(after, source);
  report.apply_executed = true;
  report.backup_path = backupPath;
  report.post_apply_remote = after;
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) main();

module.exports = {
  BACKEND_FEATURE_KEYS,
  RESTRICTED_FEATURE_KEYS,
  assertApplyGuards,
  assertRemoteReadback,
  readbackSql,
  snapshotSql,
};
