const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const edgePath = path.join(__dirname, '..', 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const edgeSource = fs.readFileSync(edgePath, 'utf8');

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = edgeSource.indexOf(marker);
  assert.ok(start >= 0, `${name} must exist`);
  const open = edgeSource.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = open; index < edgeSource.length; index += 1) {
    const char = edgeSource[index];
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
      if (depth === 0) return edgeSource.slice(start, index + 1);
    }
  }
  throw new Error(`${name} closing brace not found`);
}

function loadPureFunction(name) {
  const declaration = extractFunction(name);
  return new Function(`${declaration}\nreturn ${name};`)();
}

test('notification business identity is stable per event and recipient', () => {
  const dedupeKey = loadPureFunction('notificationBusinessEventDedupeKey');
  const first = dedupeKey('data-management-edit', 'REQ-123', 'USER@EXAMPLE.COM');
  const repeated = dedupeKey('data-management-edit', 'REQ-123', 'user@example.com');
  const otherRecipient = dedupeKey('data-management-edit', 'REQ-123', 'other@example.com');

  assert.equal(first, repeated);
  assert.notEqual(first, otherRecipient);
  assert.equal(first, 'business-event:data-management-edit:req-123:user@example.com');
});

test('notification public text maps internal keys to business labels', () => {
  const publicText = loadPureFunction('notificationPublicBusinessText');

  assert.equal(publicText('tenant_master_name', '업무 알림'), '임차인');
  assert.equal(publicText('data_management_view_field_update', '업무 알림'), '데이터 수정 요청');
  assert.equal(publicText('아레나스 양지', '업무 알림'), '아레나스 양지');
  assert.equal(publicText('public.ll_edit_requests', '업무 알림'), '업무 알림');
});

test('notification materialization never resets an existing delivery state', () => {
  const start = edgeSource.indexOf('async function materializeBusinessNotifications(');
  const end = edgeSource.indexOf('async function listCanonicalNotifications(', start);
  assert.ok(start >= 0 && end > start, 'notification materializer must exist');
  const materializer = edgeSource.slice(start, end);

  assert.match(materializer, /onConflict:\s*'dedupe_key'/u);
  assert.match(materializer, /ignoreDuplicates:\s*true/u);
  assert.doesNotMatch(materializer, /delivery_status:\s*'unread'[\s\S]*onConflict:[\s\S]*ignoreDuplicates:\s*false/u);
});

