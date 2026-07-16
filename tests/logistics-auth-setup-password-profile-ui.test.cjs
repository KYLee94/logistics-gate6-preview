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

test('password step uses the authorization status name and image instead of an email identity', () => {
  const emailSubmit = blockBetween('const handleEmailSubmit', 'const handlePasswordSubmit');
  const passwordStep = blockBetween(') : step === 2 ? (', ') : step === 3 ? (');

  assert.match(emailSubmit, /remoteAuthStatus\?\.staff_name/u);
  assert.match(emailSubmit, /const remoteImageUrl = String\(\s*remoteAuthStatus\?\.image_url/u);
  assert.match(emailSubmit, /image_url: remoteImageUrl/u);
  assert.match(emailSubmit, /avatar_url: remoteImageUrl/u);
  assert.doesNotMatch(emailSubmit, /staff_name \|\| remoteAuthStatus\?\.name \|\| normalizedEmail/u);

  assert.match(passwordStep, /data-testid="logistics-password-profile"/u);
  assert.match(passwordStep, /data-testid="logistics-password-profile-photo"/u);
  assert.match(passwordStep, /data-testid="logistics-password-profile-name"/u);
  assert.match(passwordStep, /<UserAvatar memberInfo=\{selectedAvatarInfo\} name=\{staffName\}/u);
});
