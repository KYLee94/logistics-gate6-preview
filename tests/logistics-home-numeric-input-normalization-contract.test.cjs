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
    .includes('LOGISTICS_HOME_NUMERIC_INPUT_NORMALIZATION_V1'));
const migration = migrationPath ? fs.readFileSync(migrationPath, 'utf8') : '';

test('home numeric input normalization migration exists', () => {
  assert.ok(migrationPath, 'home numeric normalization migration marker is required');
});

test('optional home numbers accept JSON numbers, numeric strings, null and blank strings only', {
  skip: !migrationPath,
}, () => {
  assert.match(migration, /normalize_home_optional_number/iu);
  assert.match(migration, /jsonb_typeof\s*\(\s*p_value\s*\)\s*=\s*'number'/iu);
  assert.match(migration, /jsonb_typeof\s*\(\s*p_value\s*\)\s*=\s*'string'/iu);
  assert.match(migration, /btrim\s*\([^)]*#>>\s*'\{\}'[^)]*\)\s*=\s*''/iu);
  assert.match(migration, /to_jsonb\s*\(\s*v_numeric\s*\)/iu);
  assert.match(migration, /HOME_NUMBER_INVALID/u);
});

test('asset and fund numeric, integer and date inputs are normalized before casts', {
  skip: !migrationPath,
}, () => {
  assert.match(migration, /normalize_home_optional_integer/iu);
  assert.match(migration, /normalize_home_optional_date/iu);
  assert.match(migration, /assert_home_asset_document_valid/iu);
  assert.match(migration, /assert_home_fund_document_valid/iu);
  assert.match(
    migration,
    /assert_home_asset_document_valid\s*\(\s*v_asset_document\s*\)[\s\S]*?update\s+logistics_core\.assets/iu,
  );
  assert.match(
    migration,
    /assert_home_fund_document_valid\s*\(\s*v_fund_document\s*\)[\s\S]*?update\s+logistics_core\.funds/iu,
  );
  for (const field of [
    'land_area_sqm', 'building_area_sqm', 'gross_area_sqm', 'leasable_area_sqm',
    'building_coverage_ratio', 'floor_area_ratio', 'ownership_ratio',
  ]) {
    assert.match(
      migration,
      new RegExp(`${field}\\s*=.*normalize_home_optional_number`, 'iu'),
    );
  }
  assert.match(migration, /parking_count\s*=.*normalize_home_optional_integer/iu);
  for (const field of ['completion_date', 'inception_date', 'maturity_date']) {
    assert.match(
      migration,
      new RegExp(`${field}\\s*=.*normalize_home_optional_date`, 'iu'),
    );
  }
});

test('investment and loan validators validate canonical optional numbers and preserve ranges', {
  skip: !migrationPath,
}, () => {
  assert.match(migration, /assert_investments_valid[\s\S]*?normalize_home_optional_number/iu);
  assert.match(migration, /INVESTMENT_AMOUNT_INVALID/u);
  assert.match(migration, /assert_loans_valid[\s\S]*?normalize_home_optional_number/iu);
  assert.match(migration, /LOAN_NUMBER_INVALID/u);
  assert.match(migration, /LOAN_NUMBER_OUT_OF_RANGE/u);
  assert.match(migration, /v_field\s*<>\s*'committed_amount_krw'[\s\S]*?>\s*100/iu);
});

test('investment and loan sanitizers remove blank optional numbers and store numeric strings as numbers', {
  skip: !migrationPath,
}, () => {
  for (const field of ['agreed_amount_krw', 'contributed_amount_krw']) {
    assert.match(
      migration,
      new RegExp(`'${field}'\\s*,\\s*logistics_core\\.normalize_home_optional_number`, 'iu'),
    );
  }
  for (const field of ['committed_amount_krw', 'coupon_rate', 'all_in_rate', 'fee_rate']) {
    assert.match(
      migration,
      new RegExp(`'${field}'\\s*,\\s*logistics_core\\.normalize_home_optional_number`, 'iu'),
    );
  }
  for (const field of ['drawdown_date', 'maturity_date']) {
    assert.match(
      migration,
      new RegExp(`'${field}'\\s*,\\s*logistics_core\\.normalize_home_optional_date`, 'iu'),
    );
  }
  assert.match(migration, /jsonb_strip_nulls/iu);
});

test('normalization changes functions only and leaves the four-table schema untouched', {
  skip: !migrationPath,
}, () => {
  assert.doesNotMatch(migration, /create\s+table|alter\s+table[^;]*add\s+column/iu);
  assert.match(migration, /notify\s+pgrst\s*,\s*'reload schema'/iu);
});
