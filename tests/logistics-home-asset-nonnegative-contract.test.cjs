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
    .includes('LOGISTICS_HOME_ASSET_NONNEGATIVE_V1'));
const migration = migrationPath ? fs.readFileSync(migrationPath, 'utf8') : '';

test('home asset nonnegative validator migration exists without expanding the four tables', () => {
  assert.ok(migrationPath, 'home asset validation migration marker is required');
  assert.doesNotMatch(migration, /create\s+table|alter\s+table[^;]*add\s+column/iu);
});

test('existing and future physical asset metrics reject negative finite values', { skip: !migrationPath }, () => {
  for (const field of [
    'land_area_sqm', 'building_area_sqm', 'gross_area_sqm', 'leasable_area_sqm',
    'building_coverage_ratio', 'floor_area_ratio', 'parking_count',
  ]) {
    assert.match(migration, new RegExp(field, 'u'));
  }
  assert.match(migration, /HOME_ASSET_EXISTING_NEGATIVE_VALUE/iu);
  assert.match(migration, /HOME_ASSET_NUMBER_NEGATIVE/iu);
  assert.match(migration, /HOME_ASSET_INTEGER_NEGATIVE/iu);
  assert.match(migration, /v_normalized[^;]*::numeric\s*<\s*0/isu);
});

test('validator keeps numeric/date normalization and remains private', { skip: !migrationPath }, () => {
  assert.match(migration, /create\s+or\s+replace\s+function\s+logistics_core\.assert_home_asset_document_valid\(p_document\s+jsonb\)/iu);
  assert.match(migration, /normalize_home_optional_number/iu);
  assert.match(migration, /normalize_home_optional_integer/iu);
  assert.match(migration, /normalize_home_optional_date/iu);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+logistics_core\.assert_home_asset_document_valid\(jsonb\)[^;]*from\s+public\s*,\s*anon\s*,\s*authenticated/isu);
});
