const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const reconciliation = require(path.join(ROOT, 'scripts', 'ops', 'logistics-permission-reconciliation.cjs'));
const opsSource = fs.readFileSync(path.join(ROOT, 'scripts', 'ops', 'logistics-permission-reconciliation.cjs'), 'utf8');
const migration = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20260715013257_logistics_permission_reconciliation_20260715.sql'), 'utf8');
const rlsMigration = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20260715090000_harden_weekly_ingest_permissions_rls.sql'), 'utf8');

const source = {
  asset_registry: {
    entries: [{ asset_code: 'A1', asset_name: 'Asset one' }],
  },
};

function validReadback(overrides = {}) {
  return {
    source_profile_rows: 38,
    active_staff_profiles: 38,
    duplicate_staff_profile_emails: [],
    assets: 19,
    raw_managed: [38, 38, 38, 33],
    raw_other: [13, 8, 8, 4],
    effective: [318, 244, 244, 163],
    scope_classification: [
      { principal_type: 'user_email', scope_type: 'asset', rows: 211 },
      { principal_type: 'user_email', scope_type: 'other_assets', rows: 13 },
      { principal_type: '(null)', scope_type: '(null)', rows: 39 },
    ],
    canonical_assets: [{ asset_code: 'A1', asset_name: 'Asset one' }],
    admin_managed_assets: Array.from({ length: 5 }, () => ({ assets: 19 })),
    full_backend_admins: Array.from({ length: 3 }, () => ({
      assets: 19,
      managed_full_crud: true,
      other_full_crud: true,
      can_read: true,
      can_write: true,
      can_delete: true,
      features_all_true: true,
    })),
    admin_auth_bindings: [
      {
        profile_email: 'jk.jeon@igisam.com',
        user_id: '00000000-0000-0000-0000-000000000001',
        auth_email: 'jk.jeon@igisam.com',
        allowed_auth_emails: ['jk.jeon@igisam.com'],
        allowed_auth_candidates: 1,
      },
      {
        profile_email: 'kylee@igisam.com',
        user_id: '00000000-0000-0000-0000-000000000002',
        auth_email: '10524@igisam.com',
        allowed_auth_emails: ['kylee@igisam.com', '10524@igisam.com'],
        allowed_auth_candidates: 1,
      },
      {
        profile_email: 'sjlee@igisam.com',
        user_id: '00000000-0000-0000-0000-000000000003',
        auth_email: 'sjlee@igisam.com',
        allowed_auth_emails: ['sjlee@igisam.com'],
        allowed_auth_candidates: 1,
      },
    ],
    ethan_delete_false: true,
    hayun: { rows: 1, disabled: true, all_rights_false: true },
    unexpected_privileged_features: 0,
    rls_flags: { enabled: true, forced: false },
    pg_policies: [],
    table_grants: [
      { grantee: 'anon', privileges: [] },
      { grantee: 'authenticated', privileges: [] },
      { grantee: 'service_role', privileges: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'] },
    ],
    ...overrides,
  };
}

test('사후 읽기는 비대상 활성 사용자의 제한 기능 true를 0개만 허용한다', () => {
  assert.doesNotThrow(() => reconciliation.assertRemoteReadback(validReadback(), source));
  assert.throws(
    () => reconciliation.assertRemoteReadback(validReadback({ unexpected_privileged_features: 1 }), source),
    /Remote readback failed/u,
  );
});

test('사후 읽기는 RLS 잠금과 service_role CRUD 권한을 함께 요구한다', () => {
  assert.throws(
    () => reconciliation.assertRemoteReadback(validReadback({ rls_flags: { enabled: false, forced: false } }), source),
    /Remote readback failed/u,
  );
  assert.throws(
    () => reconciliation.assertRemoteReadback(validReadback({ table_grants: [] }), source),
    /Remote readback failed/u,
  );
});

test('사후 읽기는 3개 관리자 프로필의 Auth 연결을 정확하고 고유하게 요구한다', () => {
  const canonicalKylee = validReadback();
  canonicalKylee.admin_auth_bindings[1] = {
    ...canonicalKylee.admin_auth_bindings[1],
    auth_email: 'kylee@igisam.com',
  };
  assert.doesNotThrow(() => reconciliation.assertRemoteReadback(canonicalKylee, source));

  const nullUserId = validReadback();
  nullUserId.admin_auth_bindings[1] = { ...nullUserId.admin_auth_bindings[1], user_id: null };
  assert.throws(() => reconciliation.assertRemoteReadback(nullUserId, source), /admin Auth bindings/u);

  const duplicateUserId = validReadback();
  duplicateUserId.admin_auth_bindings[2] = {
    ...duplicateUserId.admin_auth_bindings[2],
    user_id: duplicateUserId.admin_auth_bindings[0].user_id,
  };
  assert.throws(() => reconciliation.assertRemoteReadback(duplicateUserId, source), /admin Auth bindings/u);

  const wrongAuthEmail = validReadback();
  wrongAuthEmail.admin_auth_bindings[1] = { ...wrongAuthEmail.admin_auth_bindings[1], auth_email: 'other@igisam.com' };
  assert.throws(() => reconciliation.assertRemoteReadback(wrongAuthEmail, source), /admin Auth bindings/u);

  const ambiguousKylee = validReadback();
  ambiguousKylee.admin_auth_bindings[1] = { ...ambiguousKylee.admin_auth_bindings[1], allowed_auth_candidates: 2 };
  assert.throws(() => reconciliation.assertRemoteReadback(ambiguousKylee, source), /admin Auth bindings/u);
});

test('readback SQL은 admin_auth_bindings와 Kylee 공식 alias 후보를 함께 조회한다', () => {
  const sql = reconciliation.readbackSql(['kylee@igisam.com', 'sjlee@igisam.com', 'jk.jeon@igisam.com']);
  assert.match(sql, /'admin_auth_bindings'/u);
  assert.match(sql, /10524@igisam\.com/u);
});

test('백업 SQL은 대상 행, scope hash, RLS, policy, role grant를 포함한다', () => {
  const sql = reconciliation.snapshotSql(['kylee@igisam.com']);
  for (const key of ['target_permission_rows', 'target_staff_rows', 'scope_row_hashes', 'rls_flags', 'pg_policies', 'table_grants']) {
    assert.match(sql, new RegExp(`'${key}'`, 'u'));
  }
});

test('migration은 중복 identity를 fail closed하고 제한 기능 true를 assertion으로 차단한다', () => {
  for (const marker of [
    'duplicate normalized staff_id',
    'staff_id does not match the canonical permission email',
    'Auth user id is already bound to a different permission email',
    'Both kylee canonical and alias Auth users exist',
    'Admin permission profile Auth binding readback failed',
    'unexpected privileged feature grants',
    '_ll_permission_scope_hash_baseline',
  ]) assert.match(migration, new RegExp(marker, 'u'));
});

test('Supabase dry-run은 stderr를 포함해 migration 목록을 파싱하는 사용자 변경을 보존한다', () => {
  assert.match(opsSource, /options\.includeStderr/u);
  assert.match(opsSource, /db', 'push', '--linked', '--dry-run'\], \{ includeStderr: true \}/u);
});

test('RLS migration은 browser role을 회수하고 service_role CRUD를 명시한다', () => {
  assert.match(rlsMigration, /revoke all on table public\.ll_user_permissions from anon;/u);
  assert.match(rlsMigration, /revoke all on table public\.ll_user_permissions from authenticated;/u);
  assert.match(rlsMigration, /grant select, insert, update, delete on table public\.ll_user_permissions to service_role;/u);
  assert.match(rlsMigration, /drop policy if exists "ll_user_permissions_self_read"/u);
});

test('apply는 project, source, dry-run, backup, explicit confirmation을 모두 요구한다', () => {
  assert.throws(
    () => reconciliation.assertApplyGuards({
      projectRef: 'qvegpozwrcmspdvjokiz',
      confirmProjectRef: 'qvegpozwrcmspdvjokiz',
      confirmSourceSha: 'source',
      confirmDryRunSha: 'dry',
      backupPath: 'backup.json',
    }, 'source', 'dry'),
    /confirm-apply/u,
  );
});
