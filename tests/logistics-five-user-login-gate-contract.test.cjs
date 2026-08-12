const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION_SUFFIX = 'logistics_expand_login_allowlist_to_five_users.sql';
const TARGET_EMAILS = ['jhlee@igisam.com', 'oce@igisam.com'];
const TARGET_NAMES = ['이정훈B', '오채은'];
const MANAGED_ASSET_CODES = [
  'A112500002',
  'A112721001',
  'A112500003',
  'A112606001',
  'A112755001',
  'A112527001',
  'A112527002',
  'A112527003',
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

test('five-user gate identifies the two approved people and their exact managed assets', () => {
  const sql = migrationSql();
  assert.match(sql, /LOGISTICS_LOGIN_ALLOWLIST_FIVE_USERS_V1/u);
  TARGET_EMAILS.forEach((email) => assert.match(sql, new RegExp(email.replace('.', '\\.'), 'u')));
  TARGET_NAMES.forEach((name) => assert.match(sql, new RegExp(name, 'u')));
  MANAGED_ASSET_CODES.forEach((assetCode) => assert.match(sql, new RegExp(assetCode, 'u')));
  assert.match(sql, /cardinality\s*\(\s*permission\.managed_asset_codes\s*\)\s*(?:<>|!=)\s*8/iu);
  assert.match(sql, /permission\.managed_asset_codes[\s\S]{0,240}expected\.managed_asset_codes/iu);
});

test('managed assets receive CRUD while all other assets remain denied', () => {
  const sql = migrationSql();
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
  const sql = migrationSql();
  assert.match(sql, /\bbegin\s*;/iu);
  assert.match(sql, /set\s+local\s+lock_timeout/iu);
  assert.match(sql, /set\s+local\s+statement_timeout/iu);
  assert.match(sql, /raise\s+exception\s+using\s+errcode\s*=\s*'PT422'/iu);
  assert.match(sql, /raise\s+exception\s+using\s+errcode\s*=\s*'PT500'/iu);
  assert.match(sql, /commit\s*;\s*$/iu);
});
