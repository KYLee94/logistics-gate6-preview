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
    .includes('LOGISTICS_RENT_ROLL_TAXONOMY_CONTRACT_V1'));
const migration = migrationPath ? fs.readFileSync(migrationPath, 'utf8') : '';
const documentContract = fs.readFileSync(path.resolve(
  __dirname,
  '../src/features/logistics-data-platform/documentContract.js',
), 'utf8');

function migrationTest(name, callback) {
  test(name, { skip: !migrationPath }, callback);
}

function functionBody(functionName) {
  const match = migration.match(new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+logistics_core\\.${functionName}`
      + `[\\s\\S]*?as\\s+\\$([a-z_]+)\\$([\\s\\S]*?)\\$\\1\\$\\s*;`,
    'iu',
  ));
  assert.ok(match, `missing logistics_core.${functionName}`);
  return match[2];
}

test('rent-roll taxonomy document migration exists', () => {
  assert.ok(
    migrationPath,
    'missing LOGISTICS_RENT_ROLL_TAXONOMY_CONTRACT_V1 migration',
  );
});

migrationTest('migration keeps the four-table schema and changes JSON documents only', () => {
  assert.doesNotMatch(migration, /create\s+table\s+logistics_core\./iu);
  assert.doesNotMatch(migration, /alter\s+table[\s\S]{0,100}add\s+column/iu);
  assert.match(migration, /update\s+logistics_core\.rent_roll/iu);
  assert.match(migration, /jsonb_array_elements\s*\(\s*document\.rows\s*\)/iu);
});

migrationTest('sanitizer whitelist exactly matches every frontend persisted rent-roll field', () => {
  const frontendMatch = documentContract.match(
    /const RENT_ROLL_FIELDS = Object\.freeze\(\[([\s\S]*?)\]\);/u,
  );
  assert.ok(frontendMatch, 'missing frontend RENT_ROLL_FIELDS');
  const frontendFields = [...frontendMatch[1].matchAll(/['"]([a-z_]+)['"]/gu)]
    .map((match) => match[1]);
  const sanitizer = functionBody('sanitize_rent_rows');
  const backendFields = [...sanitizer.matchAll(/^\s*['"]([a-z_]+)['"]\s*,/gmu)]
    .map((match) => match[1]);

  assert.deepEqual(backendFields, frontendFields);
  for (const field of [
    'rent_free_periods',
    'fit_out_start_date',
    'fit_out_end_date',
    'fit_out_months',
    'tenant_cost_terms',
    'landlord_cost_terms',
    'renewal_terms',
    'termination_terms',
    'restoration_terms',
  ]) {
    assert.equal(backendFields.includes(field), true, `${field} must be persisted`);
  }
  assert.equal(backendFields.includes('display_order'), false);
  assert.equal(backendFields.includes('is_active'), false);
  assert.equal(backendFields.includes('rent_free_months'), false);
});

migrationTest('legacy cold-storage Y/N maps exactly to the visible use enum', () => {
  const body = functionBody('normalize_temperature_type');
  assert.match(body, /v_text\s*=\s*['"]Y['"][\s\S]{0,80}to_jsonb\s*\(\s*['"]저온['"]/iu);
  assert.match(body, /v_text\s*=\s*['"]N['"][\s\S]{0,80}to_jsonb\s*\(\s*['"]상온['"]/iu);
  for (const value of ['상온', '저온', '복합', '사무실']) {
    assert.match(body, new RegExp(`['"]${value}['"]`, 'u'));
  }
  assert.match(body, /RENT_ROLL_TEMPERATURE_TYPE_INVALID/u);
  assert.match(migration, /RENT_ROLL_TEMPERATURE_MAPPING_MISMATCH/u);
  assert.match(migration, /temperature_type[\s\S]{0,300}Y[\s\S]{0,300}N/iu);
});

migrationTest('goods_type canonicalizes legacy comma strings to an ordered deduplicated string array', () => {
  const body = functionBody('normalize_goods_type');
  assert.match(body, /regexp_split_to_table[\s\S]{0,160}\[,;\\n\\r\]\+/iu);
  assert.match(body, /with\s+ordinality/iu);
  assert.match(body, /jsonb_build_array/iu);
  assert.match(body, /v_seen/iu);
  assert.match(body, /jsonb_typeof\s*\(\s*p_value\s*\)\s*=\s*['"]array['"]/iu);
  assert.match(body, /GOODS_TYPE_STRING_ARRAY_REQUIRED/u);
});

migrationTest('new writes accept only goods string arrays and a boolean deposit toggle', () => {
  const body = functionBody('assert_rent_rows_document_valid');
  assert.match(body, /jsonb_typeof\s*\(\s*v_row->['"]goods_type['"]\s*\)\s*<>\s*['"]array['"]/iu);
  assert.match(body, /jsonb_array_elements[\s\S]{0,180}jsonb_typeof[\s\S]{0,100}<>\s*['"]string['"]/iu);
  assert.match(body, /GOODS_TYPE_STRING_ARRAY_REQUIRED/u);
  assert.match(body, /GOODS_TYPE_ITEM_INVALID/u);
  assert.match(body, /deposit_escalation_enabled[\s\S]{0,180}jsonb_typeof[\s\S]{0,80}boolean/iu);
  assert.match(body, /DEPOSIT_ESCALATION_ENABLED_BOOLEAN_REQUIRED/u);
  assert.match(body, /assert_rent_rows_valid\s*\(/iu);
});

migrationTest('deposit toggle derives from only its three detail fields and never deletes them', () => {
  const body = functionBody('deposit_escalation_detail_present');
  for (const field of [
    'deposit_escalation_first_date',
    'deposit_escalation_interval_months',
    'deposit_escalation_rate',
  ]) {
    assert.match(body, new RegExp(`['"]${field}['"]`, 'u'));
  }
  assert.doesNotMatch(body, /rent_escalation_/u);
  assert.doesNotMatch(body, /cam_escalation_/u);

  const sanitizer = functionBody('sanitize_rent_rows');
  assert.match(sanitizer, /['"]deposit_escalation_enabled['"]/u);
  for (const field of [
    'deposit_escalation_first_date',
    'deposit_escalation_interval_months',
    'deposit_escalation_rate',
  ]) {
    assert.match(sanitizer, new RegExp(`['"]${field}['"]`, 'u'));
  }
  assert.doesNotMatch(sanitizer, /item\.value\s*#-\s*['"]deposit_escalation_/iu);
  assert.doesNotMatch(sanitizer, /jsonb_set_lax[\s\S]{0,100}delete_key/iu);
});

migrationTest('save path validates, sanitizes, preserves expired rows, and verifies readback', () => {
  const body = functionBody('rent_roll_batch_save_entry');
  assert.match(body, /assert_rent_rows_document_valid\s*\(/iu);
  assert.match(body, /sanitize_rent_rows\s*\(/iu);
  assert.match(body, /assert_expired_rent_rows_preserved\s*\(/iu);
  assert.match(body, /assert_document_array_permissions\s*\(/iu);
  assert.match(body, /RENT_ROLL_READBACK_MISMATCH/u);
  assert.match(body, /rent_roll_read_entry\s*\(/iu);
});

migrationTest('new internal helper functions are not executable by browser roles', () => {
  for (const signature of [
    'normalize_temperature_type\\(jsonb\\)',
    'normalize_goods_type\\(jsonb\\)',
    'deposit_escalation_value_present\\(jsonb\\)',
    'deposit_escalation_detail_present\\(jsonb\\)',
    'assert_rent_rows_document_valid\\(jsonb\\)',
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke\\s+all\\s+on\\s+function\\s+logistics_core\\.${signature}`
          + `[\\s\\S]{0,100}from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated`,
        'iu',
      ),
    );
  }
});

migrationTest('backfill is transactional, order-preserving, and performs exact readback', () => {
  assert.match(migration, /^begin\s*;/imu);
  assert.match(migration, /create\s+temporary\s+table\s+rent_roll_taxonomy_before/iu);
  assert.doesNotMatch(migration, /create\s+temporary\s+table\s+pg_temp\./iu);
  assert.match(migration, /with\s+ordinality/iu);
  assert.match(migration, /order\s+by\s+item\.ordinality/iu);
  assert.match(migration, /RENT_ROLL_ROW_COUNT_MISMATCH/u);
  assert.match(migration, /RENT_ROLL_TEMPERATURE_TOTAL_COUNT_MISMATCH/u);
  assert.match(migration, /RENT_ROLL_TEMPERATURE_MAPPING_MISMATCH/u);
  assert.match(migration, /RENT_ROLL_TEMPERATURE_BLANK_COUNT_CHANGED/u);
  assert.match(migration, /RENT_ROLL_TEMPERATURE_INVALID_REMAINS/u);
  assert.match(migration, /RENT_ROLL_NON_TAXONOMY_DATA_CHANGED/u);
  assert.match(migration, /RENT_ROLL_GOODS_TYPE_READBACK_MISMATCH/u);
  assert.match(migration, /RENT_ROLL_DEPOSIT_TOGGLE_READBACK_MISMATCH/u);
  assert.match(migration, /notify\s+pgrst\s*,\s*['"]reload schema['"]/iu);
  assert.match(migration, /commit\s*;/iu);
});

migrationTest('exact readback subtracts only the three intentionally changed fields', () => {
  const comparison = migration.slice(
    migration.indexOf('after_item.value'),
    migration.indexOf('RENT_ROLL_NON_TAXONOMY_DATA_CHANGED') + 48,
  );
  for (const field of [
    'temperature_type',
    'goods_type',
    'deposit_escalation_enabled',
  ]) {
    assert.match(comparison, new RegExp(`-\\s*['"]${field}['"]`, 'u'));
  }
  assert.doesNotMatch(comparison, /display_order/u);
  assert.doesNotMatch(comparison, /is_active/u);
  assert.doesNotMatch(comparison, /rent_free_periods/u);
  assert.doesNotMatch(comparison, /fit_out_months/u);
  assert.doesNotMatch(comparison, /tenant_cost_terms|landlord_cost_terms/u);
  assert.doesNotMatch(comparison, /renewal_terms|termination_terms|restoration_terms/u);
});
