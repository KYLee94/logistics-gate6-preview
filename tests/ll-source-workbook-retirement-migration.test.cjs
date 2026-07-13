const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migrationPath = path.join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260713090000_retire_source_workbook_shadow_tables.sql',
);

test('source workbook retirement migration exists', () => {
  assert.equal(fs.existsSync(migrationPath), true);
});

const migration = fs.existsSync(migrationPath)
  ? fs.readFileSync(migrationPath, 'utf8')
  : '';

test('source workbook retirement validates schema, row sheet names, and foreign key dependencies before DDL', () => {
  const guardStart = migration.indexOf('do $$');
  const firstDdl = migration.indexOf('alter table public.ll_source_rows');

  assert.ok(guardStart >= 0 && firstDdl > guardStart);
  assert.match(migration, /workbook_schema/iu);
  assert.match(migration, /jsonb_array_elements/iu);
  assert.match(migration, /sheet_name is null/iu);
  assert.match(migration, /pg_constraint/iu);
  assert.match(migration, /raise exception/iu);
});

test('source workbook retirement removes only retired sheet and column structures with RESTRICT', () => {
  assert.match(migration, /drop constraint if exists ll_source_rows_source_sheet_id_fkey restrict/iu);
  assert.match(migration, /drop index if exists public\.ll_source_rows_sheet_idx/iu);
  assert.match(migration, /drop column if exists source_sheet_id restrict/iu);
  assert.match(migration, /drop table if exists public\.ll_source_columns restrict/iu);
  assert.match(migration, /drop table if exists public\.ll_source_sheets restrict/iu);
  assert.doesNotMatch(migration, /drop\s+cascade/iu);
  assert.doesNotMatch(migration, /drop table(?: if exists)? public\.ll_source_files\b/iu);
  assert.doesNotMatch(migration, /drop table(?: if exists)? public\.ll_source_rows\b/iu);
});
