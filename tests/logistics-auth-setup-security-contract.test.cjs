const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(ROOT, 'src', 'components', 'system', 'AuthSetup.jsx'),
  'utf8',
);

function blockBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0, `missing ${startMarker}`);
  assert.ok(end > start, `missing ${endMarker}`);
  return source.slice(start, end);
}

test('first access is restricted to the active permission status before signup', () => {
  const emailSubmit = blockBetween('const handleEmailSubmit', 'const handlePasswordSubmit');
  assert.match(source, /action: 'auth\/logistics-status'/u);
  assert.match(emailSubmit, /remoteAuthStatus\?\.allowed !== true/u);
  assert.match(
    emailSubmit,
    /(?:remoteAuthStatus\?\.account_status\)\.toLowerCase\(\)|String\(remoteAuthStatus\?\.account_status \|\| ''\)\.toLowerCase\(\)) !== 'active'/u,
  );
  assert.match(emailSubmit, /setIsFirstTime\(remoteHasAuthUser !== true\)/u);
});

test('first access uses Supabase signup and waits for an actual session before member sync', () => {
  const login = blockBetween('const proceedLogin', 'return (');
  assert.match(login, /supabase\.auth\.signUp\(\{/u);
  assert.match(login, /email:\s*authEmail/u);
  assert.match(login, /password,/u);
  assert.match(login, /emailRedirectTo:\s*buildPasswordRecoveryRedirectUrl\(\)/u);
  assert.match(login, /if \(!data\?\.session\)/u);

  const noSessionIndex = login.indexOf('if (!data?.session)');
  const syncIndex = login.indexOf("supabase.functions.invoke('iota-auth-member-sync'");
  assert.ok(noSessionIndex >= 0 && syncIndex > noSessionIndex, 'member sync must follow the real-session guard');
});

test('the client contains no shared access code, privileged setup endpoint, or local auth session activation', () => {
  assert.doesNotMatch(source, /VITE_IOTA_PILOT_ACCESS_CODE|logistics1!|accessCode/iu);
  assert.doesNotMatch(source, /auth\/first-login\/setup|auth\/password-reset\/access-code/u);
  assert.doesNotMatch(source, /activateLocalLogisticsSession|logistics_preview_auth/u);
  assert.doesNotMatch(source, /\.from\('iota_seoul_pilot_members'\)/u);
});
