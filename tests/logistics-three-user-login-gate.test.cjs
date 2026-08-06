const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

test('임시 로그인 게이트는 세 명의 Auth 사용자만 활성화하고 기존 로그인 이력을 보존한다', () => {
  const migrationName = fs.readdirSync(path.join(ROOT, 'supabase', 'migrations'))
    .filter((name) => name.includes('temporary_three_user_login_gate'))
    .sort()
    .at(-1);

  assert.ok(migrationName, '세 명 전용 임시 로그인 게이트 migration이 필요합니다.');
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', migrationName), 'utf8');

  assert.match(sql, /from\s+logistics_core\.platform_pilot_users\s+pilot/iu);
  assert.match(sql, /where\s+pilot\.is_active\s*=\s*true/iu);
  assert.match(sql, /join\s+public\.ll_user_permissions[\s\S]{0,180}permission\.user_id\s*=\s*pilot\.user_id/iu);
  assert.match(sql, /join\s+auth\.users[\s\S]{0,160}auth_user\.id\s*=\s*pilot\.user_id/iu);
  for (const staffName of ['이관용', '전기영', '이시정']) {
    assert.match(sql, new RegExp(staffName, 'u'));
  }
  assert.doesNotMatch(sql, /values\s*\([\s\S]{0,400}@igisam\.com/iu);
  assert.match(sql, /count\(\*\)[\s\S]{0,160}<>\s*3/iu);
  assert.match(sql, /account_status\s*=\s*case[\s\S]{0,240}'active'[\s\S]{0,240}'disabled'/iu);
  assert.match(sql, /temporary_login_gate_20260806/u);
  assert.match(sql, /previous_account_status/u);
  assert.match(
    sql,
    /coalesce\([\s\S]{0,180}temporary_login_gate_20260806,previous_account_status[\s\S]{0,120}permission\.account_status/iu,
  );
  assert.match(sql, /scope_type\s+is\s+null[\s\S]{0,120}scope_id\s+is\s+null/iu);
  assert.match(sql, /active_profile_count[\s\S]{0,200}<>\s*3/iu);

  assert.doesNotMatch(sql, /delete\s+from\s+(?:auth\.users|public\.ll_user_permissions|public\.ll_login_events)/iu);
  assert.doesNotMatch(sql, /truncate\s+(?:table\s+)?(?:public\.)?ll_login/iu);
  assert.doesNotMatch(sql, /drop\s+(?:table|view)[\s\S]{0,80}ll_login/iu);
});

test('Edge 인증은 account_status active인 Auth user_id 일치 프로필만 허용한다', () => {
  const edge = fs.readFileSync(
    path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts'),
    'utf8',
  );

  assert.match(edge, /function\s+permissionMatchesJwtUser[\s\S]{0,180}isActivePermission\(profile\)[\s\S]{0,120}profile\.user_id[\s\S]{0,80}jwtUserId/iu);
  assert.match(edge, /function\s+isActivePermission[\s\S]{0,140}accountStatus[\s\S]{0,80}===\s*'active'/iu);
  assert.match(edge, /auth\/login-history\/record/u);
  assert.match(edge, /auth\/login-history\/list/u);
});

test('임시 로그인 제한은 권한 화면의 후속 수정으로 비파일럿을 재활성화하지 못하게 계속 적용된다', () => {
  const migrationName = fs.readdirSync(path.join(ROOT, 'supabase', 'migrations'))
    .filter((name) => name.includes('gate6_login_allowlist_enforcement'))
    .sort()
    .at(-1);

  assert.ok(migrationName, '임시 로그인 제한 지속 migration이 필요합니다.');
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', migrationName), 'utf8');

  assert.match(sql, /create\s+or\s+replace\s+function\s+logistics_core\.enforce_temporary_login_gate/iu);
  assert.match(sql, /before\s+insert\s+or\s+update\s+of\s+user_id\s*,\s*account_status/iu);
  assert.match(sql, /new\.account_status\s*:=\s*'disabled'/iu);
  assert.match(sql, /from\s+logistics_core\.platform_pilot_users\s+pilot[\s\S]{0,160}pilot\.user_id\s*=\s*new\.user_id[\s\S]{0,120}pilot\.is_active\s*=\s*true/iu);
  assert.match(sql, /update\s+public\.ll_user_permissions\s+permission[\s\S]{0,220}account_status\s*=\s*case/iu);
  assert.doesNotMatch(sql, /where\s+permission\.scope_type\s+is\s+null/iu);
  assert.match(sql, /v_active_profile_count[\s\S]{0,260}<>\s*3/iu);
  assert.match(sql, /previous_account_status/iu);
  assert.doesNotMatch(sql, /delete\s+from\s+(?:auth\.users|public\.ll_user_permissions|public\.ll_login_events)/iu);
  assert.doesNotMatch(sql, /truncate\s+(?:table\s+)?(?:public\.)?ll_login/iu);
});
