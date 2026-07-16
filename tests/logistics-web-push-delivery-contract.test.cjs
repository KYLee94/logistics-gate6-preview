const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const PUSH_EDGE_PATH = path.join(ROOT, 'supabase', 'functions', 'll-push-notifications', 'index.ts');
const PUSH_MIGRATION_PATH = path.join(ROOT, 'supabase', 'migrations', '20260716120000_expand_business_web_push_delivery.sql');
const BUSINESS_NOTIFICATION_TYPES = ['task_share', 'data_update', 'lease_maturity', 'loan_maturity', 'system'];

test('web push delivers every user-facing business notification without changing the public payload contract', () => {
  const source = fs.readFileSync(PUSH_EDGE_PATH, 'utf8');

  assert.match(source, /\.in\(\s*['"]notification_type['"]\s*,\s*BUSINESS_NOTIFICATION_TYPES\s*\)/u);
  assert.match(source, /\.neq\(\s*['"]delivery_status['"]\s*,\s*['"]dismissed['"]\s*\)/u);
  assert.match(source, /\.eq\(\s*['"]enabled['"]\s*,\s*true\s*\)/u);
  assert.match(source, /notification_id:\s*taskShare\.notification_id/u);
  assert.match(source, /title:\s*text\(taskShare\.title,\s*200\)/u);
  assert.match(source, /body:\s*text\(taskShare\.body,\s*1000\)/u);
  assert.match(source, /path:\s*notificationPath\(taskShare\.payload\)/u);
  assert.match(source, /statusCode === 404 \|\| statusCode === 410/u);
});

test('database queue trigger covers all business notifications and never blocks the originating save', () => {
  const source = fs.readFileSync(PUSH_MIGRATION_PATH, 'utf8');

  for (const notificationType of BUSINESS_NOTIFICATION_TYPES) {
    assert.match(source, new RegExp(`'${notificationType}'`, 'u'));
  }
  assert.match(source, /new\.delivery_status\s*=\s*'dismissed'/u);
  assert.match(source, /perform\s+net\.http_post\(/u);
  assert.match(source, /exception\s+when others then[\s\S]{0,400}raise warning/u);
  assert.match(source, /return new;/u);
});
