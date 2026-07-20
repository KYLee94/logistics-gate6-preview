const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const NAV_PATH = path.join(ROOT, 'src', 'components', 'system', 'IotaLeftNav.jsx');

test('system push UI never reports an OS notification from subscription alone', () => {
  const source = fs.readFileSync(NAV_PATH, 'utf8');

  assert.doesNotMatch(source, /setPushMessage\(['"]시스템 알림을 켰습니다\./u);
  assert.match(source, /confirmation\?\.showRequested/u);
  assert.match(source, /알림 수신 설정을 저장했고 테스트 알림 표시를 요청했습니다\./u);
  assert.match(source, /수신 설정은 저장했지만 테스트 알림 표시를 확인하지 못했습니다\./u);
});
