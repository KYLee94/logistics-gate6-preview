const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const edgePath = path.join(__dirname, '..', 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const edge = fs.readFileSync(edgePath, 'utf8');

test('canonical notification list preserves its safe internal destination', () => {
  assert.match(edge, /\.select\('[^']*payload[^']*'\)/u);
  assert.match(edge, /payload:\s*notificationPublicPayload\(row\.payload,\s*row\)/u);
});

test('business notifications store internal page routes', () => {
  assert.match(edge, /function editRequestNotificationRoute\(/u);
  assert.match(edge, /payload:\s*\{\s*route:\s*editRequestNotificationRoute\(row\)/u);
  assert.match(edge, /route:\s*'data-management\/lease-contracts'/u);
  assert.match(edge, /payload:\s*\{\s*task_code:\s*taskCode,\s*route:\s*'work-platform'/u);
  assert.doesNotMatch(edge, /route:\s*`\/logistics-gate6-preview\/work-platform\?task=/u);
});
