const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migrationsDirectory = path.resolve(__dirname, '../supabase/migrations');
const marker = 'LOGISTICS_OCCUPANCY_RENT_ROLL_BASIS_V2';
const migrationPath = fs.readdirSync(migrationsDirectory)
  .map((name) => path.join(migrationsDirectory, name))
  .find((candidate) => fs.statSync(candidate).isFile()
    && fs.readFileSync(candidate, 'utf8').includes(marker));
const sql = migrationPath ? fs.readFileSync(migrationPath, 'utf8') : '';

test('rent-roll occupancy follow-up migration exists', () => {
  assert.ok(migrationPath, `${marker} migration is required`);
});

test('numerator is current occupied area and denominator is every current rent-roll area', () => {
  assert.match(sql, /occupancy_status['"]?\s*=\s*['"]occupied['"]/iu);
  assert.match(sql, /commencement_date[\s\S]*?<=\s*p_as_of/iu);
  assert.match(sql, /expiry_date[\s\S]*?>=\s*p_as_of/iu);
  assert.match(sql, /filter\s*\(\s*where[\s\S]*?occupancy_status[\s\S]*?is_current[\s\S]*?\)/iu);
  assert.match(sql, /sum\([\s\S]*?leased_area_sqm[\s\S]*?filter\s*\(\s*where\s+row_item\.is_current[\s\S]*?leased_area_sqm\s*>\s*0[\s\S]*?\)/iu);
  assert.match(sql, /v_denominator\s*:=\s*nullif\(v_current_rent_area,\s*0\)/iu);
});

test('asset registry areas never substitute for the rent-roll denominator', () => {
  assert.doesNotMatch(sql, /v_leasable_area_sqm|v_gross_area_sqm/iu);
  assert.doesNotMatch(sql, /asset_(?:leasable|gross)_area_sqm(?:_fallback)?/iu);
  assert.match(sql, /current_rent_roll_total_area_sqm/iu);
  assert.match(sql, /current_rent_roll_area_sqm/iu);
});

test('null occupancy has explicit MECE reasons instead of a false zero or fallback', () => {
  assert.match(sql, /v_current_row_count\s*=\s*0[\s\S]*?no_current_rent_roll_rows/iu);
  assert.match(sql, /v_current_rent_area\s*<=\s*0[\s\S]*?no_positive_current_rent_roll_area/iu);
  assert.match(sql, /v_occupied_area\s*>\s*v_current_rent_area[\s\S]*?occupied_area_exceeds_current_rent_roll_area/iu);
  assert.match(sql, /occupancy_rate['"]?\s*,\s*case[\s\S]*?v_data_mismatch[\s\S]*?then\s+null/iu);
  assert.match(sql, /vacant_area_sqm['"]?\s*,\s*case[\s\S]*?v_data_mismatch[\s\S]*?then\s+null/iu);
});

test('missing-area current rows are excluded without hiding a valid positive-area rate', () => {
  assert.match(sql, /current-without-area/iu);
  assert.match(sql, /area_data_incomplete/iu);
  assert.match(sql, /current_rows_without_positive_leased_area/iu);
  assert.doesNotMatch(
    sql,
    /v_current_positive_area_row_count\s*<\s*v_current_row_count[\s\S]{0,180}v_data_mismatch\s*:=\s*true/iu,
  );
  assert.match(sql, /area_data_incomplete['"]?[\s\S]*?v_current_positive_area_row_count\s*<\s*v_current_row_count/iu);
});

test('home occupancy as-of date is explicitly KST', () => {
  assert.match(
    sql,
    /statement_timestamp\(\)\s+at\s+time\s+zone\s+['"]Asia\/Seoul['"][\s\S]*?::date/iu,
  );
});

test('response preserves explainable counts, areas, basis, and RPC access contract', () => {
  for (const key of [
    'occupied_area_sqm',
    'denominator_area_sqm',
    'current_rent_roll_area_sqm',
    'stored_rent_roll_area_sqm',
    'current_row_count',
    'expired_row_count',
    'denominator_source',
    'data_basis',
    'data_mismatch',
    'data_mismatch_reason',
    'occupancy_rate',
  ]) {
    assert.match(sql, new RegExp(`['"]${key}['"]`, 'u'), `missing ${key}`);
  }
  assert.match(sql, /create\s+or\s+replace\s+function\s+logistics_core\.home_read_entry/iu);
  assert.match(sql, /security\s+definer/iu);
  assert.match(sql, /set\s+search_path\s*=\s*pg_catalog,\s*logistics_core/iu);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+logistics_core\.home_read_entry[\s\S]*?from\s+public,\s*anon/iu);
  assert.match(sql, /grant\s+execute\s+on\s+function\s+logistics_core\.home_read_entry[\s\S]*?to\s+authenticated/iu);
});
