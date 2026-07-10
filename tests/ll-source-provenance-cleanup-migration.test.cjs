const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migration = fs.readFileSync(
  path.resolve(__dirname, '..', 'supabase', 'migrations', '20260710135538_remove_unused_source_provenance.sql'),
  'utf8',
);

test('unused source provenance cleanup keeps row identifiers but removes only their foreign keys', () => {
  const constraints = [
    'll_assets_source_sheet_row_id_fkey',
    'll_tenants_source_sheet_row_id_fkey',
    'll_leases_source_sheet_row_id_fkey',
    'll_lease_spaces_source_sheet_row_id_fkey',
    'll_rent_history_source_sheet_row_id_fkey',
    'll_lease_attributes_source_cell_id_fkey',
  ];

  for (const constraint of constraints) assert.match(migration, new RegExp(`drop constraint if exists ${constraint} restrict`, 'u'));
  assert.doesNotMatch(migration, /drop column if exists source_sheet_row_id/iu);
  assert.doesNotMatch(migration, /drop column if exists source_cell_id/iu);
});

test('unused source provenance cleanup uses restrict-only drops', () => {
  for (const tableName of ['ll_source_field_registry', 'll_source_cells', 'll_source_runs']) {
    assert.match(migration, new RegExp(`drop table public\\.${tableName} restrict`, 'u'));
  }
  assert.doesNotMatch(migration, /\bcascade\b/iu);
  assert.doesNotMatch(migration, /ll_source_files|ll_source_sheets|ll_source_columns|ll_source_rows/iu);
});
