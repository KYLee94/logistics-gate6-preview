const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'system', 'IotaLeftNav.jsx'),
  'utf8',
);

test('기존 알림 패널 구현은 하나만 유지하고 일반 물류·신규 3탭 shell이 함께 재사용한다', () => {
  assert.equal((source.match(/data-testid="logistics-notification-panel"/gu) || []).length, 1);
  assert.equal((source.match(/const renderNotificationsPanel\s*=\s*\(\)\s*=>/gu) || []).length, 1);
  assert.ok((source.match(/\{renderNotificationsPanel\(\)\}/gu) || []).length >= 2);
});

test('신규 3탭 shell footer에도 기존 알림 버튼과 패널이 프로필 옆에 노출된다', () => {
  const dataPlatformBranch = source.slice(
    source.indexOf('if (isDataPlatformActive)'),
    source.indexOf('if (isLogisticsPath)'),
  );
  assert.match(dataPlatformBranch, /renderNotificationButton\(\)/u);
  assert.match(dataPlatformBranch, /renderNotificationsPanel\(\)/u);
  assert.match(dataPlatformBranch, /data-testid="logistics-profile-button"/u);
});

test('공용 알림 버튼은 기존 testid·읽지 않은 건수·open handler 계약을 유지한다', () => {
  const start = source.indexOf('const renderNotificationButton');
  const end = source.indexOf('const renderNotificationsPanel', start);
  assert.ok(start > 0 && end > start);
  const block = source.slice(start, end);
  assert.match(block, /data-testid="logistics-notification-button"/u);
  assert.match(block, /onClick=\{openNotificationsPanel\}/u);
  assert.match(block, /unreadNotificationCount/u);
});
