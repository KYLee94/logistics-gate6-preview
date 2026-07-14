const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const edge = fs.readFileSync(
  path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts'),
  'utf8',
);
const migrationDirectory = path.join(ROOT, 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationDirectory)
  .filter((fileName) => /^20260714\d+_consolidate_weekly_board_into_work_items\.sql$/u.test(fileName));

test('weekly and board consolidation has exactly one migration', () => {
  assert.equal(migrationFiles.length, 1);
});

const migration = migrationFiles.length === 1
  ? fs.readFileSync(path.join(migrationDirectory, migrationFiles[0]), 'utf8')
  : '';

test('Edge uses ll_work_items as the only runtime table for weekly and board features', () => {
  assert.doesNotMatch(edge, /\.from\(['"]ll_(?:weekly_records|board_posts)['"]\)/u);
  assert.doesNotMatch(edge, /safeSelectRows\([^\n]+['"]ll_(?:weekly_records|board_posts)['"]/u);
  assert.match(edge, /\.from\(['"]ll_work_items['"]\)[\s\S]{0,300}\.eq\(['"]item_type['"], ['"]board_post['"]\)/u);
  assert.match(edge, /\.from\(['"]ll_work_items['"]\)[\s\S]{0,300}\.eq\(['"]item_type['"], ['"]weekly_report['"]\)/u);
  assert.match(edge, /weekly_record_type/u);
  assert.match(edge, /board_log_id/u);
});

test('Edge keeps the board and weekly response contracts while reading canonical columns', () => {
  assert.match(edge, /log_id:board_log_id/u);
  assert.match(edge, /content:board_content/u);
  assert.match(edge, /metadata:board_metadata/u);
  assert.match(edge, /record_type:weekly_record_type/u);
  assert.match(edge, /report_id:weekly_report_id/u);
  assert.match(edge, /row_json:weekly_row_json/u);
  assert.match(edge, /report_json:weekly_report_json/u);
});

test('migration preserves every legacy field before retiring both tables', () => {
  for (const column of [
    'board_log_id',
    'workspace_code',
    'workspace_label',
    'work_date',
    'board_content',
    'triage_type',
    'issue_status',
    'stakeholder_category',
    'stakeholder_name',
    'visibility_groups',
    'visibility_individuals',
    'comments',
    'attachments',
    'board_metadata',
    'weekly_record_type',
    'weekly_report_id',
    'report_year',
    'report_month',
    'report_week',
    'weekly_source_file_name',
    'weekly_source_sha256',
    'weekly_source_text',
    'weekly_report_json',
    'asset_code',
    'asset_name',
    'fund_code',
    'fund_name',
    'project_type',
    'project_name',
    'stakeholder',
    'weekly_status',
    'weekly_plan',
    'weekly_row_json',
    'weekly_requested_by',
    'weekly_parsed_counts',
    'weekly_message',
  ]) {
    assert.match(migration, new RegExp(`add column if not exists ${column}\\b`, 'u'));
  }

  assert.match(migration, /insert into public\.ll_work_items[\s\S]+from public\.ll_board_posts/iu);
  assert.match(migration, /insert into public\.ll_work_items[\s\S]+from public\.ll_weekly_records/iu);
  assert.match(migration, /Board post backfill count\/checksum validation failed/iu);
  assert.match(migration, /Weekly record backfill count\/checksum validation failed/iu);
  assert.match(migration, /md5\s*\(\s*coalesce\s*\(\s*string_agg/iu);
  assert.doesNotMatch(migration, /md5\s*\(\s*string_agg[\s\S]*?\),\s*['"]['"]\s*\)/iu);
});

test('migration is atomic and prevents source-table and primary-key collisions', () => {
  assert.match(migration, /(?:^|\n)begin\s*;/iu);
  assert.match(migration, /\bcommit\s*;\s*$/iu);
  assert.match(migration, /legacy_text_id[\s\S]{0,900}'public\.ll_board_posts:'\s*\|\|\s*b\.id::text/iu);
  assert.match(migration, /legacy_text_id[\s\S]{0,900}'public\.ll_weekly_records:'\s*\|\|\s*r\.id::text/iu);
  assert.match(migration, /'source_table',\s*'public\.ll_board_posts'/iu);
  assert.match(migration, /'source_table',\s*'public\.ll_weekly_records'/iu);
  assert.doesNotMatch(migration, /insert into public\.ll_work_items\s*\(\s*id\b/iu);
  assert.doesNotMatch(migration, /on conflict\s*\(\s*id\s*\)/iu);
});

test('migration uses guarded RESTRICT drops and never CASCADE', () => {
  assert.match(migration, /drop table (?:if exists )?public\.ll_board_posts restrict/iu);
  assert.match(migration, /drop table (?:if exists )?public\.ll_weekly_records restrict/iu);
  assert.doesNotMatch(migration, /\bcascade\b/iu);
  assert.doesNotMatch(migration, /create\s+(?:or\s+replace\s+)?view\s+public\.ll_/iu);
  assert.doesNotMatch(migration, /drop table[^;]+public\.ll_(?:work_items|source_files|source_rows)/iu);
});
