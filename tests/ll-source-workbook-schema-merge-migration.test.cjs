const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migrationPath = path.resolve(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260711090000_merge_source_workbook_schema.sql',
);

test('source workbook schema merge migration exists', () => {
  assert.equal(fs.existsSync(migrationPath), true);
});

const migration = fs.existsSync(migrationPath)
  ? fs.readFileSync(migrationPath, 'utf8')
  : '';

test('source workbook schema merge migration adds workbook_schema and backfills from sheets and columns', () => {
  assert.match(migration, /alter table public\.ll_source_files\s+add column if not exists workbook_schema jsonb not null default '\{\}'::jsonb;/iu);
  assert.match(migration, /from public\.ll_source_sheets s/iu);
  assert.match(migration, /left join public\.ll_source_columns c/iu);
  assert.match(migration, /jsonb_agg\(/iu);
  assert.match(migration, /workbook_schema =/iu);
});

test('source workbook schema merge migration keeps ll_source_files and ll_source_rows live', () => {
  assert.doesNotMatch(migration, /drop table public\.ll_source_files\b/iu);
  assert.doesNotMatch(migration, /drop table public\.ll_source_rows\b/iu);
  assert.doesNotMatch(migration, /drop column if exists source_sheet_id\b/iu);
  assert.doesNotMatch(migration, /alter column source_sheet_id drop not null/iu);
});

test('source workbook schema merge migration does not retire sheets or columns yet', () => {
  assert.doesNotMatch(migration, /drop table public\.ll_source_sheets\b/iu);
  assert.doesNotMatch(migration, /drop table public\.ll_source_columns\b/iu);
  assert.doesNotMatch(migration, /drop constraint if exists ll_source_rows_source_sheet_id_fkey\b/iu);
});
