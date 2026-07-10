const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migration = fs.readFileSync(
  path.resolve(__dirname, '..', 'supabase', 'migrations', '20260710134451_remove_retired_runtime_logs.sql'),
  'utf8',
);

test('runtime log cleanup retires only the proven unused relations', () => {
  const retiredTables = [
    'll_news_runs',
    'll_notification_deliveries',
    'll_audit_events',
    'll_payload_snapshots',
    'll_schema_metadata',
  ];

  for (const tableName of retiredTables) {
    assert.match(migration, new RegExp(`drop table public\\.${tableName} restrict`, 'u'));
  }

  assert.match(migration, /drop column if exists news_run_id restrict/iu);
  assert.match(migration, /drop column if exists payload restrict/iu);
  assert.match(migration, /drop column if exists created_at restrict/iu);
  assert.doesNotMatch(migration, /\bcascade\b/iu);
});

test('runtime log cleanup does not remove still-live source or work tables', () => {
  for (const tableName of ['ll_source_files', 'll_source_rows', 'll_board_posts', 'll_weekly_records', 'll_notifications', 'll_news_items']) {
    assert.doesNotMatch(migration, new RegExp(`drop table public\\.${tableName} restrict`, 'u'));
  }
});
