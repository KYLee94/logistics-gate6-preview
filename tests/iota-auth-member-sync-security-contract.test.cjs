const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(ROOT, 'supabase', 'functions', 'iota-auth-member-sync', 'index.ts'),
  'utf8',
);

function blockBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0, `missing ${startMarker}`);
  assert.ok(end > start, `missing ${endMarker}`);
  return source.slice(start, end);
}

test('iota member sync is restricted to the production origin and localhost', () => {
  const originBlock = blockBetween('const allowedOrigins', 'function isAllowedOrigin');
  assert.match(originBlock, /https:\/\/kylee94\.github\.io/u);
  assert.match(originBlock, /http:\/\/localhost:5173/u);
  assert.match(originBlock, /http:\/\/localhost:4173/u);
  assert.doesNotMatch(originBlock, /this8369\.github\.io|127\.0\.0\.1/u);
});

test('iota member sync links only the authenticated JWT identity', () => {
  assert.match(source, /const jwtEmail = normalizeEmail\(userData\.user\.email\);/u);
  assert.match(source, /const jwtUserId = userData\.user\.id;/u);
  assert.match(source, /requestedEmail && requestedEmail !== jwtEmail/u);
  assert.match(source, /requestedAuthId && requestedAuthId !== jwtUserId/u);
  assert.doesNotMatch(source, /ALIAS|logistics_role|staff_name|organization/iu);
});

test('iota member sync requires exactly one active email-bearing canonical profile', () => {
  const lookupBlock = blockBetween(".from('ll_user_permissions')", 'const permissionRows');
  assert.match(lookupBlock, /\.select\('user_id,email,account_status'\)/u);
  assert.match(lookupBlock, /\.not\('email', 'is', null\)/u);
  assert.match(lookupBlock, /\.is\('scope_type', null\)/u);
  assert.match(lookupBlock, /\.is\('scope_id', null\)/u);
  assert.match(lookupBlock, /\.ilike\('email', jwtEmail\)\s*\.limit\(3\)/u);
  assert.match(source, /permissionRows\.length !== 1/u);
  assert.match(source, /filter\(\(row\) => normalizeEmail\(row\.email\) === jwtEmail\)/u);
  assert.match(source, /normalizeEmail\(permission\.email\) !== jwtEmail/u);
  assert.match(source, /normalizeAccountStatus\(permission\.account_status\) !== 'active'/u);
});

test('iota member sync propagates operational failures and only writes the identity link', () => {
  assert.match(source, /if \(!supabaseUrl \|\| !anonKey \|\| !serviceRoleKey\)/u);
  assert.match(source, /error: 'permission_read_failed'/u);
  assert.match(source, /error: 'permission_link_failed'/u);
  const updateBlock = blockBetween(".update({", ".eq('email', permission.email)");
  assert.match(updateBlock, /user_id: jwtUserId/u);
  assert.match(updateBlock, /updated_at: new Date\(\)\.toISOString\(\)/u);
  assert.doesNotMatch(updateBlock, /email\s*:/u);
  assert.match(source, /return json\(200, \{ ok: true, mode: 'identity_linked' \}, origin\);/u);
});
