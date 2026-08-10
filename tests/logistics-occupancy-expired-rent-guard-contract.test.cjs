const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migrationsDirectory = path.resolve(__dirname, '..', 'supabase', 'migrations');
const migrationPath = fs.readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => path.join(migrationsDirectory, name))
  .find((candidate) => fs.readFileSync(candidate, 'utf8')
    .includes('LOGISTICS_OCCUPANCY_EXPIRED_RENT_GUARD_V1'));
const migration = migrationPath ? fs.readFileSync(migrationPath, 'utf8') : '';

test('occupancy and expired-rent guard migration exists', () => {
  assert.ok(migrationPath, 'guard migration marker is required');
});

test('occupancy numerator contains only currently effective occupied rows', { skip: !migrationPath }, () => {
  assert.match(migration, /occupancy_status['"]?\s*=\s*['"]occupied['"]/iu);
  assert.match(migration, /commencement_date[^;]*(?:is\s+null|<=\s*current_date)/iu);
  assert.match(migration, /expiry_date[^;]*(?:is\s+null|>=\s*current_date)/iu);
  assert.match(migration, /v_occupied_area/iu);
});

test('occupancy denominator prefers valid leasable area and falls back to gross only when absent', { skip: !migrationPath }, () => {
  assert.match(migration, /leasable_area_sqm[^;]*>\s*0/iu);
  assert.match(migration, /leasable_area_sqm[^;]*is\s+null[^;]*gross_area_sqm[^;]*>\s*0/iu);
  assert.match(migration, /denominator_source/iu);
  assert.match(migration, /data_basis/iu);
  assert.match(migration, /leasable_area_sqm/iu);
  assert.match(migration, /gross_area_sqm/iu);
});

test('invalid denominator or rent-roll total overflow is exposed as data mismatch', { skip: !migrationPath }, () => {
  assert.match(migration, /v_current_rent_area\s*>\s*v_denominator/iu);
  assert.match(migration, /v_occupied_area\s*>\s*v_denominator/iu);
  assert.match(migration, /data_mismatch/iu);
  assert.match(migration, /data_mismatch_reason/iu);
  assert.match(migration, /rent_roll_total_area_sqm/iu);
  assert.match(migration, /rent_roll_exceeds_denominator/iu);
  assert.match(migration, /invalid_(?:leasable_area|denominator)/iu);
  assert.doesNotMatch(migration, /least\s*\(\s*100/iu);
});

test('occupancy rate and vacancy are withheld when the denominator is inconsistent', { skip: !migrationPath }, () => {
  assert.match(migration, /occupancy_rate['"]?\s*,\s*case[^;]*v_data_mismatch[^;]*then\s+null/isu);
  assert.match(migration, /vacant_area_sqm['"]?\s*,\s*case[^;]*v_data_mismatch[^;]*then\s+null/isu);
});

test('rent-roll reads return all stored rows including expired rows', { skip: !migrationPath }, () => {
  assert.match(migration, /create\s+or\s+replace\s+function\s+logistics_core\.rent_roll_read_entry/iu);
  assert.match(migration, /includes_expired_rows['"]?\s*,\s*true/iu);
  assert.match(migration, /expired_row_count/iu);
  const readBody = migration.match(
    /create\s+or\s+replace\s+function\s+logistics_core\.rent_roll_read_entry[\s\S]*?\$body\$;/iu,
  )?.[0] || '';
  assert.match(readBody, /project_rent_rows\s*\(\s*document\.rows\s*\)/iu);
  assert.match(readBody, /expiry_date['"]?\)?::date\s*<\s*current_date/iu);
});

test('only the user-confirmed Gyeongsan full-lease area is corrected with strict preflight', { skip: !migrationPath }, () => {
  assert.match(migration, /GYEONGSAN_FULL_LEASE_AREA_CORRECTION_V1/u);
  assert.match(migration, /A120085001/u);
  assert.match(migration, /73821\.68/u);
  assert.match(migration, /98673\.64/u);
  assert.match(migration, /v_current_occupied_area\s+is\s+distinct\s+from\s+73821\.68/iu);
  assert.match(migration, /v_current_rent_area\s+is\s+distinct\s+from\s+v_current_occupied_area/iu);
  assert.match(migration, /v_current_tenant_count\s*<>\s*1/iu);
  assert.match(migration, /update\s+logistics_core\.assets[\s\S]*?where\s+asset_code\s*=\s*'A120085001'/iu);
  assert.equal(
    (migration.match(/update\s+logistics_core\.assets/giu) || []).length,
    1,
    'no other asset-area inference is allowed',
  );
});

test('full-document saves reject omission of any previously stored expired row', { skip: !migrationPath }, () => {
  assert.match(migration, /assert_expired_rent_rows_preserved/iu);
  assert.match(migration, /v_new_count\s*<\s*v_old_count/iu);
  assert.match(migration, /row_identity/iu);
  for (const field of ['tenant_name', 'floor_label', 'zone_label', 'commencement_date', 'expiry_date']) {
    assert.match(migration, new RegExp(`item\\.value->>'${field}'`, 'iu'));
  }
  assert.doesNotMatch(migration, /where\s+item\.value\s*=\s*v_old_row\.row_value/iu);
  assert.match(migration, /EXPIRED_RENT_ROWS_MUST_BE_PRESERVED/u);
  assert.match(
    migration,
    /assert_expired_rent_rows_preserved\s*\(\s*v_old_rows\s*,\s*v_rows\s*,\s*current_date\s*\)/iu,
  );
});

test('occupancy summary exposes direct active tenant and space counts', { skip: !migrationPath }, () => {
  assert.match(migration, /active_tenant_count/iu);
  assert.match(migration, /occupied_space_count/iu);
  assert.match(migration, /vacant_space_count/iu);
});

test('guard migration changes functions only and does not expand the four-table schema', { skip: !migrationPath }, () => {
  assert.doesNotMatch(migration, /create\s+table|alter\s+table[^;]*add\s+column/iu);
});
