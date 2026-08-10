const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migrationsDirectory = path.resolve(__dirname, '..', 'supabase', 'migrations');
const migrationPath = fs.readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => path.join(migrationsDirectory, name))
  .find((candidate) => fs.readFileSync(candidate, 'utf8').includes('LOGISTICS_CORE_SIMPLE_V1'));
const migration = migrationPath ? fs.readFileSync(migrationPath, 'utf8') : '';
const maturityScopeMigrationPath = fs.readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => path.join(migrationsDirectory, name))
  .find((candidate) => fs.readFileSync(candidate, 'utf8').includes('LOGISTICS_SIMPLE_MATURITIES_SCOPE_V1'));
const maturityScopeMigration = maturityScopeMigrationPath
  ? fs.readFileSync(maturityScopeMigrationPath, 'utf8')
  : '';
const occupancyGuardMigrationPath = fs.readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => path.join(migrationsDirectory, name))
  .find((candidate) => fs.readFileSync(candidate, 'utf8')
    .includes('LOGISTICS_OCCUPANCY_EXPIRED_RENT_GUARD_V1'));
const occupancyGuardMigration = occupancyGuardMigrationPath
  ? fs.readFileSync(occupancyGuardMigrationPath, 'utf8')
  : '';

const canonicalTables = ['assets', 'funds', 'income_expense', 'rent_roll'];
const forbiddenColumnNames = [
  'id',
  'revision',
  'archived_at',
  'archived_by',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
  'account_code',
  'line_no',
  'row_no',
  'sector',
  'acquisition_cost',
  'acquisition_cost_krw',
  'current_valuation',
  'current_valuation_krw',
  'manager_name',
  'manager_team',
];

function contractTest(name, callback) {
  test(name, { skip: !migrationPath }, callback);
}

function tableBody(tableName) {
  const match = migration.match(new RegExp(
    `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?logistics_core\\.${tableName}\\s*\\(([\\s\\S]*?)\\n\\);`,
    'iu',
  ));
  assert.ok(match, `logistics_core.${tableName} must be created explicitly`);
  return match[1];
}

function assertColumns(tableName, columns) {
  const body = tableBody(tableName);
  for (const column of columns) {
    assert.match(body, new RegExp(`^\\s*${column}\\s+`, 'imu'), `${tableName}.${column} is required`);
  }
}

function declaredColumns(tableName) {
  return [...tableBody(tableName).matchAll(
    /^\s*([a-z_][a-z0-9_]*)\s+(?:text|numeric(?:\s*\([^)]*\))?|integer|bigint|boolean|date|timestamptz|jsonb)\b/gimu,
  )].map((match) => match[1]);
}

function assertDocumentFields(fields) {
  for (const field of fields) {
    assert.match(migration, new RegExp(`['"]${field}['"]`, 'u'), `document field ${field} must be declared`);
  }
}

test('LOGISTICS_CORE_SIMPLE_V1 migration exists before the contract can pass', () => {
  assert.ok(
    migrationPath,
    'No Supabase migration contains the LOGISTICS_CORE_SIMPLE_V1 marker',
  );
});

test('maturity read is asset-scoped, date-bounded, deduplicated, and detail-ready', () => {
  assert.ok(maturityScopeMigrationPath, 'missing LOGISTICS_SIMPLE_MATURITIES_SCOPE_V1 migration');
  assert.match(maturityScopeMigration, /create\s+or\s+replace\s+function\s+logistics_core\.maturities_read_entry/iu);
  assert.match(maturityScopeMigration, /p_payload->>['"]from_date['"]/iu);
  assert.match(maturityScopeMigration, /p_payload->>['"]to_date['"]/iu);
  assert.match(maturityScopeMigration, /between\s+v_from_date\s+and\s+v_to_date/iu);
  assert.match(maturityScopeMigration, /group\s+by[\s\S]{0,220}tenant_name[\s\S]{0,120}expiry_date/iu);
  for (const field of [
    'tenant_name',
    'commencement_date',
    'leased_area_sqm',
    'fund_name',
    'lender_names',
    'tranche_name',
    'commitment_amount',
    'coupon_rate',
    'all_in_rate',
  ]) {
    assert.match(maturityScopeMigration, new RegExp(`['"]${field}['"]`, 'iu'));
  }
  assert.doesNotMatch(maturityScopeMigration, /create\s+table/iu);
});

contractTest('the migration creates only the four canonical logistics_core tables', () => {
  const createdTables = [...migration.matchAll(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?logistics_core\.([a-z_]+)/giu,
  )].map((match) => match[1]).sort();
  assert.deepEqual(createdTables, canonicalTables);
});

contractTest('canonical table columns use only visible document identifiers', () => {
  for (const tableName of canonicalTables) {
    const body = tableBody(tableName);
    for (const column of forbiddenColumnNames) {
      assert.doesNotMatch(body, new RegExp(`^\\s*${column}\\s+`, 'imu'));
    }
    assert.doesNotMatch(body, /^\s*[a-z_]*_key\s+/imu);
    assert.doesNotMatch(body, /^\s*source_[a-z_]*\s+/imu);
    assert.doesNotMatch(body, /\buuid\b/iu);
  }
});

contractTest('assets is keyed by asset_code and carries fund_code plus the visible home fields', () => {
  const body = tableBody('assets');
  const expectedColumns = [
    'asset_code',
    'fund_code',
    'name',
    'address',
    'zoning_text',
    'land_area_sqm',
    'building_area_sqm',
    'gross_area_sqm',
    'leasable_area_sqm',
    'primary_use',
    'building_coverage_ratio',
    'floor_area_ratio',
    'floor_count',
    'structure_text',
    'parking_count',
    'completion_date',
  ];
  assert.deepEqual(declaredColumns('assets'), expectedColumns);
  assert.match(body, /^\s*asset_code\s+text\s+primary\s+key/imu);
  assert.match(body, /^\s*fund_code\s+text\b/imu);
  assert.match(body, /references\s+logistics_core\.funds\s*\(\s*fund_code\s*\)/iu);
  assertColumns('assets', [
    'name',
    'address',
    'zoning_text',
    'land_area_sqm',
    'building_area_sqm',
    'gross_area_sqm',
    'leasable_area_sqm',
    'primary_use',
    'building_coverage_ratio',
    'floor_area_ratio',
    'floor_count',
    'structure_text',
    'parking_count',
    'completion_date',
  ]);
});

contractTest('funds is one fund document with visible fields and investment and loan arrays', () => {
  const body = tableBody('funds');
  assert.deepEqual(declaredColumns('funds'), [
    'fund_code',
    'name',
    'fund_type',
    'investment_strategy',
    'inception_date',
    'maturity_date',
    'ownership_ratio',
    'investments',
    'loans',
  ]);
  assert.match(body, /^\s*fund_code\s+text\s+primary\s+key/imu);
  assertColumns('funds', [
    'name',
    'fund_type',
    'investment_strategy',
    'inception_date',
    'maturity_date',
    'ownership_ratio',
    'investments',
    'loans',
  ]);
  assert.doesNotMatch(body, /^\s*(?:legal_form|status)\s+/imu);
  assert.match(body, /investments\s+jsonb\s+not\s+null\s+default\s+'\[\]'::jsonb/iu);
  assert.match(body, /loans\s+jsonb\s+not\s+null\s+default\s+'\[\]'::jsonb/iu);
  assert.match(body, /jsonb_typeof\s*\(\s*investments\s*\)\s*=\s*'array'/iu);
  assert.match(body, /jsonb_typeof\s*\(\s*loans\s*\)\s*=\s*'array'/iu);
  assertDocumentFields([
    'tranche',
    'beneficiary_name',
    'agreed_amount_krw',
    'contributed_amount_krw',
    'lender_name',
    'committed_amount_krw',
    'drawdown_date',
    'maturity_date',
    'loan_type',
    'interest_type',
    'coupon_rate',
    'all_in_rate',
    'fee_rate',
  ]);
});

contractTest('rent_roll is one asset document whose rows array declares every editable field', () => {
  const body = tableBody('rent_roll');
  assert.deepEqual(declaredColumns('rent_roll'), ['asset_code', 'rows']);
  assert.match(body, /^\s*asset_code\s+text\s+primary\s+key/imu);
  assert.match(body, /references\s+logistics_core\.assets\s*\(\s*asset_code\s*\)/iu);
  assert.match(body, /rows\s+jsonb\s+not\s+null\s+default\s+'\[\]'::jsonb/iu);
  assert.match(body, /jsonb_typeof\s*\(\s*rows\s*\)\s*=\s*'array'/iu);
  assertDocumentFields([
    'occupancy_status',
    'tenant_name',
    'business_registration_number',
    'temperature_type',
    'goods_type',
    'floor_label',
    'zone_label',
    'subtenant_name',
    'free_area_type',
    'exclusive_area_sqm',
    'common_area_sqm',
    'leased_area_sqm',
    'signed_date',
    'commencement_date',
    'expiry_date',
    'operation_start_date',
    'deposit_total_krw',
    'security_type',
    'security_ratio',
    'monthly_rent_total_krw',
    'monthly_cam_total_krw',
    'pallet_rack_fee',
    'rent_free_start_date',
    'rent_free_end_date',
    'rent_free_months',
    'rent_free_periods',
    'fit_out_start_date',
    'fit_out_end_date',
    'fit_out_months',
    'fit_out_amount',
    'tenant_improvement_amount',
    'deposit_escalation_first_date',
    'deposit_escalation_interval_months',
    'deposit_escalation_rate',
    'rent_escalation_first_date',
    'rent_escalation_interval_months',
    'rent_escalation_rate',
    'cam_escalation_first_date',
    'cam_escalation_interval_months',
    'cam_escalation_rate',
    'tenant_cost_terms',
    'landlord_cost_terms',
    'renewal_terms',
    'termination_terms',
    'restoration_terms',
    'notes',
  ]);
});

contractTest('income_expense is one asset statement document without account identifiers', () => {
  const body = tableBody('income_expense');
  assert.deepEqual(declaredColumns('income_expense'), ['asset_code', 'statement']);
  assert.match(body, /^\s*asset_code\s+text\s+primary\s+key/imu);
  assert.match(body, /references\s+logistics_core\.assets\s*\(\s*asset_code\s*\)/iu);
  assert.match(body, /statement\s+jsonb\s+not\s+null\s+default\s+'\{\}'::jsonb/iu);
  assert.match(body, /jsonb_typeof\s*\(\s*statement\s*\)\s*=\s*'object'/iu);
  assertDocumentFields([
    'periods',
    'potential_income',
    'income_loss',
    'operating_expense',
    'below_noi',
    'debt_service',
    'name',
    'selected',
    'amounts',
  ]);
  assert.doesNotMatch(migration, /['"]account_code['"]/u);
  assert.doesNotMatch(migration, /['"](?:scenario|accounting_basis)['"]/u);
});

contractTest('optimistic concurrency uses PostgreSQL xmin without a stored revision column', () => {
  assert.match(migration, /xmin::text/iu);
  assert.match(migration, /expected_xmin/iu);
  assert.match(migration, /REVISION_CONFLICT/u);
  assert.doesNotMatch(migration, /add\s+column[^;]*\brevision\b/iu);
});

contractTest('temporary staging tables use PostgreSQL executable syntax', () => {
  assert.doesNotMatch(
    migration,
    /create\s+temporary\s+table\s+pg_temp\./iu,
    'CREATE TEMPORARY TABLE must not qualify the table with pg_temp',
  );
});

contractTest('screen-contract staging grants one approved pilot temporary read scope inside the transaction', () => {
  assert.match(migration, /from\s+logistics_core\.platform_pilot_users\s+pilot[\s\S]{0,500}where\s+pilot\.is_active/iu);
  assert.match(
    migration,
    /update\s+logistics_core\.user_permission_profiles[\s\S]{0,300}scope_mode\s*=\s*'all'[\s\S]{0,200}managed_read\s*=\s*true/iu,
  );
  assert.doesNotMatch(
    migration,
    /select\s+pilot\.user_id[\s\S]{0,300}permission\.scope_mode\s*=\s*'all'/iu,
  );
});

contractTest('month-only legacy rent-free periods are preserved without inventing dates', () => {
  assert.match(migration, /jsonb_build_object\s*\(\s*['"]months['"][\s\S]{0,120}rent_free_months/iu);
  assert.match(migration, /array\s*\[\s*['"]start_date['"]\s*,\s*['"]end_date['"]\s*,\s*['"]months['"]/iu);
  assert.doesNotMatch(migration, /SIMPLE_CORE_RENT_FREE_DATES_REQUIRED/u);
  assert.doesNotMatch(migration, /SIMPLE_CORE_RENT_FREE_PERIOD_BACKFILL_REQUIRED/u);
});

contractTest('month-only legacy Fit-out values are preserved until a date pair recalculates them', () => {
  assert.match(migration, /['"]fit_out_months['"]\s*,\s*item\.value->['"]fit_out_months['"]/iu);
  assert.match(
    migration,
    /foreach\s+v_field\s+in\s+array\s+array\[[\s\S]{0,400}['"]fit_out_months['"][\s\S]{0,800}RENT_ROLL_NUMBER_INVALID/iu,
  );
  assert.doesNotMatch(migration, /SIMPLE_CORE_FIT_OUT_DATES_REQUIRED/u);
});

contractTest('legacy investment and loan numeric strings are canonicalized without changing their values', () => {
  assert.match(migration, /create\s+or\s+replace\s+function\s+pg_temp\.canonical_json_number/iu);
  for (const field of [
    'agreed_amount_krw',
    'contributed_amount_krw',
    'committed_amount_krw',
    'coupon_rate',
    'all_in_rate',
    'fee_rate',
  ]) {
    assert.match(
      migration,
      new RegExp(`['"]${field}['"]\\s*,\\s*pg_temp\\.canonical_json_number\\(item\\.value->['"]${field}['"]\\)`, 'iu'),
    );
  }
});

contractTest('existing wildcard and create update delete permissions survive the document cutover', () => {
  assert.match(migration, /['"]\*['"]\s*=\s*any\s*\([^)]*managed_asset_codes/iu);
  assert.match(migration, /assert_asset_permission\s*\([^;]*['"]create['"]\s*\)/iu);
  assert.match(migration, /assert_asset_permission\s*\([^;]*['"]update['"]\s*\)/iu);
  assert.match(migration, /assert_asset_permission\s*\([^;]*['"]delete['"]\s*\)/iu);
});

contractTest('the three-person login gate is reattached before the verified archive is removed', () => {
  assert.match(migration, /enforce_temporary_login_gate/iu);
  assert.match(migration, /create\s+trigger[^;]*on\s+public\.ll_user_permissions/iu);
  assert.match(migration, /pg_depend/iu);
  assert.match(migration, /drop\s+schema\s+logistics_core_[a-z0-9_]+\s+cascade/iu);
});

contractTest('archive dependency checks ignore PostgreSQL-owned catalog and TOAST objects only', () => {
  const systemNamespaceGuards = migration.match(/namespace\.nspname\s*!~\s*['"]\^pg_['"]/giu) ?? [];
  const informationSchemaGuards = migration.match(/namespace\.nspname\s*<>\s*['"]information_schema['"]/giu) ?? [];

  assert.ok(systemNamespaceGuards.length >= 6, 'both dependency checks must exclude pg_catalog/pg_toast internals');
  assert.ok(informationSchemaGuards.length >= 6, 'both dependency checks must exclude information_schema internals');
  assert.match(migration, /SIMPLE_CORE_UNEXPECTED_EXTERNAL_DEPENDENCY/u);
  assert.match(migration, /SIMPLE_CORE_ARCHIVE_EXTERNAL_DEPENDENCY/u);
});

contractTest('current occupancy is superseded by the leasable then gross area contract', () => {
  assert.ok(occupancyGuardMigrationPath, 'the occupancy follow-up migration is required');
  assert.match(occupancyGuardMigration, /v_leasable_area_sqm\s*>\s*0/iu);
  assert.match(
    occupancyGuardMigration,
    /v_leasable_area_sqm\s+is\s+null\s+and\s+v_gross_area_sqm\s*>\s*0/iu,
  );
  assert.match(occupancyGuardMigration, /v_occupied_area\s*\/\s*v_denominator\s*\*\s*100/iu);
  assert.match(occupancyGuardMigration, /v_data_mismatch[\s\S]*?then\s+null/iu);
});
