const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migrationDirectory = path.resolve(__dirname, '..', 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationDirectory)
  .filter((fileName) => /^20260710\d+_ll_schema_consolidation\.sql$/u.test(fileName));

test('schema consolidation has exactly one dated migration', () => {
  assert.deepEqual(migrationFiles, ['20260710090000_ll_schema_consolidation.sql']);
});

const migration = fs.readFileSync(path.join(migrationDirectory, migrationFiles[0]), 'utf8');

test('phase one is additive and does not remove live storage before the Edge rollout', () => {
  const phaseOne = migration.slice(migration.indexOf('-- Phase 1'));
  assert.doesNotMatch(phaseOne, /\bdrop\s+table\b/iu);
  assert.doesNotMatch(phaseOne, /\bcascade\b/iu);
  assert.doesNotMatch(phaseOne, /\bcreate\s+table\b/iu);
});

test('notification and news merges preserve data before removal', () => {
  assert.match(migration, /add column if not exists recipient_email text/iu);
  assert.match(migration, /Notification delivery backfill readback failed/iu);
  assert.match(migration, /add column if not exists news_date date/iu);
  assert.match(migration, /add column if not exists ingested_at timestamptz/iu);
  assert.match(migration, /add constraint ll_news_items_news_date_dedupe_key_key unique \(news_date, dedupe_key\)/iu);
});

test('live source and work tables are deferred until their read paths are migrated', () => {
  const phaseOne = migration.slice(migration.indexOf('-- Phase 1'));
  for (const tableName of ['ll_source_files', 'll_source_sheets', 'll_source_columns', 'll_source_rows', 'll_board_posts', 'll_weekly_records']) {
    assert.doesNotMatch(phaseOne, new RegExp(`drop table public\\.${tableName} restrict`, 'u'));
  }
});
