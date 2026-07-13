const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const componentPath = path.join(__dirname, '..', 'src', 'components', 'system', 'IotaLeftNav.jsx');
const source = fs.readFileSync(componentPath, 'utf8');

function blockAfter(marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${marker} must exist`);
  const arrow = source.indexOf('=>', start);
  assert.ok(arrow >= 0, `${marker} must be an arrow function`);
  const open = source.indexOf('{', arrow);
  assert.ok(open >= 0, `${marker} must open a block`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${marker} closing brace not found`);
}

test('canonical fallback identity uses stable business fields, never the current time', () => {
  const canonical = blockAfter('const buildCanonicalNotification =');
  const fallback = blockAfter('const notificationFallbackId =');

  assert.match(canonical, /notificationFallbackId\(row\)/u);
  assert.doesNotMatch(canonical, /Date\.now\(/u);
  assert.match(fallback, /stableNotificationHash/u);
  assert.match(fallback, /created_at/u);
  assert.match(fallback, /reference_id|entity_id|request_id/u);
});

test('notification text translates internal field keys into business labels', () => {
  const sanitizer = blockAfter('const sanitizeNotificationText =');

  assert.match(sanitizer, /tenant_master_name/u);
  assert.match(sanitizer, /임차인/u);
  assert.match(sanitizer, /data_management_view_field_update/u);
  assert.match(sanitizer, /데이터 수정 요청/u);
});

test('successful notification mutations invalidate local cache and replace it from notifications/list', () => {
  const refresh = blockAfter('const refreshNotificationsFromServer =');
  const readOne = blockAfter('const markNotificationsRead =');
  const readAll = blockAfter('const markAllNotificationsRead =');
  const dismissOne = blockAfter('const dismissNotification =');
  const dismissAll = blockAfter('const dismissAllNotifications =');

  assert.match(refresh, /invalidateNotificationCaches\(\)/u);
  assert.match(refresh, /loadNotifications\(\{[^}]*forceServer:\s*true/u);
  [readOne, readAll, dismissOne, dismissAll].forEach((mutation) => {
    assert.match(mutation, /await refreshNotificationsFromServer\(\)/u);
  });
});
