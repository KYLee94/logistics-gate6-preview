const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'logisticsPermissionData.json');

const ADMIN_EMAILS = new Set([
  'kylee@igisam.com',
  'sjlee@igisam.com',
  'jk.jeon@igisam.com',
]);

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

function boolPermissions(value = {}) {
  return {
    read: value.read === true,
    create: value.create === true,
    update: value.update === true,
    delete: value.delete === true,
  };
}

function adminFeaturePermissions() {
  return Object.fromEntries(FEATURE_KEYS.map((key) => [key, true]));
}

function userRows() {
  const data = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  return (data.users || [])
    .map((user) => {
      const email = normalizeEmail(user.email);
      const refs = [
        ...(Array.isArray(user.managedAssetCodes) ? user.managedAssetCodes : []),
        ...(Array.isArray(user.managedAssets) ? user.managedAssets.flatMap((asset) => [asset.assetCode, asset.assetId]) : []),
      ]
        .map((item) => String(item || '').trim())
        .filter(Boolean);
      const uniqueRefs = [...new Set(refs)];
      const role = ADMIN_EMAILS.has(email)
        ? 'System Admin'
        : String(user.role || user.logisticsRole || 'Reader').trim() || 'Reader';
      return {
        email,
        staff_name: String(user.name || '').trim(),
        organization: String(user.organization || '').trim(),
        image_url: user.image_url || user.avatar_url || user.profile_image_url || null,
        logistics_role: role,
        managed_asset_codes: uniqueRefs,
        managed_asset_permissions: boolPermissions(user.permissions?.managedAsset),
        other_asset_permissions: boolPermissions(user.permissions?.otherAsset),
        can_ingest_weekly: role === 'System Admin',
        account_status: 'active',
        feature_permissions: ADMIN_EMAILS.has(email) ? adminFeaturePermissions() : {},
        profile_payload: {
          source: 'logisticsPermissionData.json',
          source_file: data.sourceFile || null,
          generated_at: data.generatedAt || null,
          managed_funds: user.managedFunds || [],
        },
      };
    })
    .filter((user) => user.email);
}

function sqlLiteralJson(value) {
  return `$json$${JSON.stringify(value)}$json$`;
}

function buildSql(rows) {
  return `
begin;

with src as (
  select
    lower(email) as email,
    staff_name,
    organization,
    image_url,
    logistics_role,
    managed_asset_codes,
    managed_asset_permissions,
    other_asset_permissions,
    can_ingest_weekly,
    account_status,
    feature_permissions,
    profile_payload
  from jsonb_to_recordset(${sqlLiteralJson(rows)}::jsonb) as x(
    email text,
    staff_name text,
    organization text,
    image_url text,
    logistics_role text,
    managed_asset_codes text[],
    managed_asset_permissions jsonb,
    other_asset_permissions jsonb,
    can_ingest_weekly boolean,
    account_status text,
    feature_permissions jsonb,
    profile_payload jsonb
  )
),
updated as (
  update public.ll_user_permissions p
  set
    staff_name = src.staff_name,
    organization = src.organization,
    image_url = src.image_url,
    logistics_role = src.logistics_role,
    managed_asset_codes = src.managed_asset_codes,
    managed_asset_permissions = src.managed_asset_permissions,
    other_asset_permissions = src.other_asset_permissions,
    can_ingest_weekly = src.can_ingest_weekly,
    account_status = src.account_status,
    feature_permissions = coalesce(p.feature_permissions, '{}'::jsonb) || src.feature_permissions,
    profile_payload = coalesce(p.profile_payload, '{}'::jsonb) || src.profile_payload,
    updated_at = now()
  from src
  where lower(p.email) = src.email
  returning lower(p.email) as email
)
insert into public.ll_user_permissions (
  user_id,
  email,
  staff_name,
  organization,
  image_url,
  logistics_role,
  managed_asset_codes,
  managed_asset_permissions,
  other_asset_permissions,
  can_ingest_weekly,
  account_status,
  feature_permissions,
  profile_payload
)
select
  coalesce((select au.id from auth.users au where lower(au.email) = src.email limit 1), gen_random_uuid()),
  src.email,
  src.staff_name,
  src.organization,
  src.image_url,
  src.logistics_role,
  src.managed_asset_codes,
  src.managed_asset_permissions,
  src.other_asset_permissions,
  src.can_ingest_weekly,
  src.account_status,
  src.feature_permissions,
  src.profile_payload
from src
where not exists (select 1 from updated u where u.email = src.email)
  and not exists (select 1 from public.ll_user_permissions p where lower(p.email) = src.email);

commit;

select
  count(*) as source_users,
  (select count(*) from public.ll_user_permissions where email is not null and btrim(email) <> '' and account_status = 'active') as active_permission_users
from jsonb_to_recordset(${sqlLiteralJson(rows)}::jsonb) as x(email text);
`;
}

function main() {
  const rows = userRows();
  const sql = buildSql(rows);
  const tmpPath = path.join(os.tmpdir(), `gate6-user-permission-backfill-${process.pid}-${Date.now()}.sql`);
  fs.writeFileSync(tmpPath, sql, 'utf8');
  const result = spawnSync('npx', ['supabase', 'db', 'query', '--linked', '--file', tmpPath, '-o', 'json'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  try {
    fs.unlinkSync(tmpPath);
  } catch {
    // best effort cleanup
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

main();
