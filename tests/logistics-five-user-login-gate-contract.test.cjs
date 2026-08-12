const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION_SUFFIX = 'logistics_expand_login_allowlist_to_five_users.sql';
const SCOPE_MIGRATION_SUFFIX = 'logistics_correct_two_user_managed_asset_partition.sql';
const PERMISSION_SOURCE = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'logisticsPermissionData.json');
const TARGET_EMAILS = ['jhlee@igisam.com', 'oce@igisam.com'];
const TARGET_NAMES = ['이정훈B', '오채은'];
const LEE_MANAGED_ASSET_CODES = [
  'A112606001',
  'A112755001',
  'A112527001',
  'A112527002',
  'A112527003',
];
const OH_MANAGED_ASSET_CODES = [
  'A112500002',
  'A112721001',
  'A112500003',
];

function migrationPath() {
  const matches = fs.readdirSync(path.join(ROOT, 'supabase', 'migrations'))
    .filter((name) => name.endsWith(MIGRATION_SUFFIX));
  assert.equal(matches.length, 1, `expected exactly one ${MIGRATION_SUFFIX} migration`);
  return path.join(ROOT, 'supabase', 'migrations', matches[0]);
}

function migrationSql() {
  return fs.readFileSync(migrationPath(), 'utf8');
}

function scopeMigrationSql() {
  const matches = fs.readdirSync(path.join(ROOT, 'supabase', 'migrations'))
    .filter((name) => name.endsWith(SCOPE_MIGRATION_SUFFIX));
  assert.equal(matches.length, 1, `expected exactly one ${SCOPE_MIGRATION_SUFFIX} migration`);
  return fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', matches[0]), 'utf8');
}

test('five-user gate identifies the two approved people and their exact managed assets', () => {
  const sql = migrationSql();
  assert.match(sql, /LOGISTICS_LOGIN_ALLOWLIST_FIVE_USERS_V1/u);
  TARGET_EMAILS.forEach((email) => assert.match(sql, new RegExp(email.replace('.', '\\.'), 'u')));
  TARGET_NAMES.forEach((name) => assert.match(sql, new RegExp(name, 'u')));
});

test('canonical permission source keeps each manager on only their own asset partition', () => {
  const source = JSON.parse(fs.readFileSync(PERMISSION_SOURCE, 'utf8'));
  const byEmail = new Map(source.users.map((user) => [user.email, user]));
  const oh = byEmail.get('oce@igisam.com');
  const lee = byEmail.get('jhlee@igisam.com');

  assert.deepEqual(oh.managedAssetCodes, OH_MANAGED_ASSET_CODES);
  assert.deepEqual(lee.managedAssetCodes, LEE_MANAGED_ASSET_CODES);
  assert.deepEqual(oh.managedAssets.map((asset) => asset.assetCode), OH_MANAGED_ASSET_CODES);
  assert.deepEqual(lee.managedAssets.map((asset) => asset.assetCode), LEE_MANAGED_ASSET_CODES);
  assert.deepEqual([...new Set(oh.managedAssets.map((asset) => asset.assetManagerName))], ['오채은']);
  assert.deepEqual([...new Set(lee.managedAssets.map((asset) => asset.assetManagerName))], ['이정훈B']);
  assert.deepEqual(oh.managedAssetCodes.filter((assetCode) => lee.managedAssetCodes.includes(assetCode)), []);
  assert.deepEqual(oh.permissions.managedAsset, { read: true, create: true, update: true, delete: true });
  assert.deepEqual(lee.permissions.managedAsset, { read: true, create: true, update: true, delete: true });
  assert.deepEqual(oh.permissions.otherAsset, { read: false, create: false, update: false, delete: false });
  assert.deepEqual(lee.permissions.otherAsset, { read: false, create: false, update: false, delete: false });
});

test('current scope partitions 오채은 three assets and 이정훈B five assets without overlap', () => {
  const sql = scopeMigrationSql();
  assert.match(sql, /LOGISTICS_TWO_USER_MANAGED_ASSET_PARTITION_V1/u);
  OH_MANAGED_ASSET_CODES.forEach((assetCode) => assert.match(sql, new RegExp(`oce@igisam\\.com[\\s\\S]{0,500}${assetCode}`, 'u')));
  LEE_MANAGED_ASSET_CODES.forEach((assetCode) => assert.match(sql, new RegExp(`jhlee@igisam\\.com[\\s\\S]{0,700}${assetCode}`, 'u')));
  assert.match(sql, /cardinality\s*\(\s*permission\.managed_asset_codes\s*\)\s*(?:<>|!=)\s*expected\.expected_count/iu);
  assert.match(sql, /v_distinct_asset_count\s*(?:<>|!=)\s*8/iu);
  assert.match(sql, /having\s+count\(\*\)\s*(?:<>|!=)\s*1/iu);
});

test('each partition receives managed CRUD while all other assets remain denied', () => {
  const sql = scopeMigrationSql();
  assert.match(sql, /jsonb_build_object\(\s*'read',\s*true,\s*'create',\s*true,\s*'update',\s*true,\s*'delete',\s*true\s*\)/iu);
  assert.match(sql, /jsonb_build_object\(\s*'read',\s*false,\s*'create',\s*false,\s*'update',\s*false,\s*'delete',\s*false\s*\)/iu);
  assert.match(sql, /can_read\s*=\s*true/iu);
  assert.match(sql, /can_write\s*=\s*true/iu);
  assert.match(sql, /can_delete\s*=\s*true/iu);
  assert.doesNotMatch(sql, /permission_admin['"]?\s*[,=:]\s*true/iu);
});

test('migration requires exact confirmed and unblocked Auth bindings before activation', () => {
  const sql = migrationSql();
  assert.match(sql, /join\s+auth\.users\s+auth_user/iu);
  assert.match(sql, /auth_user\.email_confirmed_at\s+is\s+null/iu);
  assert.match(sql, /auth_user\.banned_until/iu);
  assert.match(sql, /permission\.user_id\s*=\s*auth_user\.id/iu);
  assert.match(sql, /v_target_count\s*(?:<>|!=)\s*2/iu);
  assert.doesNotMatch(sql, /update\s+auth\.users|password|encrypted_password/iu);
});

test('migration expands only the exact three-person gate to the exact five-person gate', () => {
  const sql = migrationSql();
  for (const email of ['kylee@igisam.com', 'sjlee@igisam.com', 'jk.jeon@igisam.com', ...TARGET_EMAILS]) {
    assert.match(sql, new RegExp(email.replace('.', '\\.'), 'u'));
  }
  assert.match(sql, /account_status\s*=\s*'active'/iu);
  assert.match(sql, /temporary_login_gate_20260806/iu);
  assert.match(sql, /'allowed',\s*true/iu);
  assert.match(sql, /active[^;]{0,500}(?:<>|!=)\s*5/iu);
  assert.match(sql, /allowed[^;]{0,500}(?:<>|!=)\s*5/iu);
  assert.doesNotMatch(sql, /delete\s+from\s+(?:auth\.users|public\.ll_user_permissions)/iu);
});

test('migration is transactional, fail-closed, and validates post-write login capability', () => {
  for (const sql of [migrationSql(), scopeMigrationSql()]) {
    assert.match(sql, /\bbegin\s*;/iu);
    assert.match(sql, /set\s+local\s+lock_timeout/iu);
    assert.match(sql, /set\s+local\s+statement_timeout/iu);
    assert.match(sql, /raise\s+exception\s+using\s+errcode\s*=\s*'PT422'/iu);
    assert.match(sql, /raise\s+exception\s+using\s+errcode\s*=\s*'PT500'/iu);
    assert.match(sql, /commit\s*;\s*$/iu);
  }
});
