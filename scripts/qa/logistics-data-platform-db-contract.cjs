#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATION_FILE = '20260807180000_simplify_logistics_core_to_four_ui_tables.sql';
const OCCUPANCY_BASIS_FILE = '20260810084310_logistics_occupancy_rent_roll_basis_v2.sql';
const FOLLOWUP_MIGRATION_FILE = '20260811011055_logistics_fund_aum_tranche_noi_contract.sql';
const migrationPath = path.join(ROOT, 'supabase', 'migrations', MIGRATION_FILE);
const followupMigrationPath = path.join(ROOT, 'supabase', 'migrations', FOLLOWUP_MIGRATION_FILE);
const source = fs.readFileSync(migrationPath, 'utf8');
const followupSource = fs.readFileSync(followupMigrationPath, 'utf8');
const occupancyBasisSource = fs.readFileSync(
  path.join(
    ROOT,
    'supabase',
    'migrations',
    OCCUPANCY_BASIS_FILE,
  ),
  'utf8',
);

const INITIAL_TABLE_COLUMNS = Object.freeze({
  assets: [
    'asset_code', 'fund_code', 'name', 'address', 'zoning_text', 'land_area_sqm',
    'building_area_sqm', 'gross_area_sqm', 'leasable_area_sqm', 'primary_use',
    'building_coverage_ratio', 'floor_area_ratio', 'floor_count', 'structure_text',
    'parking_count', 'completion_date',
  ],
  funds: [
    'fund_code', 'name', 'fund_type', 'investment_strategy', 'inception_date',
    'maturity_date', 'ownership_ratio', 'investments', 'loans',
  ],
  rent_roll: ['asset_code', 'rows'],
  income_expense: ['asset_code', 'statement'],
});

const FINAL_TABLE_COLUMNS = Object.freeze({
  ...INITIAL_TABLE_COLUMNS,
  funds: [
    'fund_code', 'name', 'fund_type', 'investment_strategy', 'inception_date',
    'maturity_date', 'investments', 'loans', 'aum_krw',
  ],
});

const checks = [];
function check(id, assertion, evidence) {
  try {
    assertion();
    checks.push({ id, ok: true, evidence });
  } catch (error) {
    checks.push({ id, ok: false, error: error.message });
  }
}

function tableBody(table) {
  const match = source.match(new RegExp(`create\\s+table\\s+logistics_core\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'iu'));
  assert.ok(match, `missing canonical table ${table}`);
  return match[1];
}

function declaredColumns(table) {
  return tableBody(table)
    .split(/\r?\n/u)
    .map((line) => line.trim().replace(/,$/u, ''))
    .filter((line) => line && !/^constraint\b/iu.test(line))
    .map((line) => line.match(/^([a-z][a-z0-9_]*)\s/iu)?.[1])
    .filter(Boolean);
}

check('single-transaction-cutover', () => {
  assert.match(source, /(?:^|\n)begin;/iu);
  assert.match(source, /pg_advisory_xact_lock/iu);
  assert.match(source, /commit;\s*$/iu);
  assert.match(source, /set\s+local\s+lock_timeout/iu);
  assert.match(source, /set\s+local\s+statement_timeout/iu);
}, 'one guarded transaction with bounded locks and statement time');

check('exact-four-document-tables', () => {
  const tables = [...source.matchAll(/create\s+table\s+logistics_core\.([a-z0-9_]+)/giu)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(tables, Object.keys(FINAL_TABLE_COLUMNS).sort());
  assert.doesNotMatch(followupSource, /create\s+table\s+logistics_core\./iu);
}, Object.keys(FINAL_TABLE_COLUMNS));

check('visible-columns-only', () => {
  for (const [table, expected] of Object.entries(INITIAL_TABLE_COLUMNS)) {
    assert.deepEqual(declaredColumns(table), expected, `${table} columns drifted`);
  }
  assert.match(
    followupSource,
    /alter\s+table\s+logistics_core\.funds\s+add\s+column\s+if\s+not\s+exists\s+aum_krw\s+numeric/iu,
  );
  assert.match(
    followupSource,
    /alter\s+table\s+logistics_core\.funds\s+drop\s+column\s+if\s+exists\s+ownership_ratio/iu,
  );
  const finalFunds = declaredColumns('funds')
    .filter((column) => column !== 'ownership_ratio')
    .concat('aum_krw');
  assert.deepEqual(finalFunds, FINAL_TABLE_COLUMNS.funds, 'final funds columns drifted');
}, FINAL_TABLE_COLUMNS);

check('no-technical-storage-columns', () => {
  const declared = Object.values(FINAL_TABLE_COLUMNS).flat();
  const forbidden = /(?:^|_)(?:id|uuid|key|source|revision|version|created_at|updated_at|deleted_at)(?:$|_)/iu;
  assert.deepEqual(declared.filter((column) => forbidden.test(column)), []);
  assert.doesNotMatch(source, /\brevision\s+(?:bigint|integer|numeric)\b/iu);
}, 'no technical identifiers, provenance, audit timestamps, or stored revisions');

check('document-shapes-are-constrained', () => {
  assert.match(tableBody('funds'), /investments\s+jsonb[\s\S]*jsonb_typeof\(investments\)\s*=\s*'array'/iu);
  assert.match(tableBody('funds'), /loans\s+jsonb[\s\S]*jsonb_typeof\(loans\)\s*=\s*'array'/iu);
  assert.match(tableBody('rent_roll'), /rows\s+jsonb[\s\S]*jsonb_typeof\(rows\)\s*=\s*'array'/iu);
  assert.match(tableBody('income_expense'), /statement\s+jsonb[\s\S]*jsonb_typeof\(statement\)\s*=\s*'object'/iu);
}, 'fund arrays, rent rows, and finance statement have JSON shape constraints');

check('temporary-copy-and-readback', () => {
  for (const table of Object.keys(FINAL_TABLE_COLUMNS)) {
    assert.match(source, new RegExp(`create\\s+temporary\\s+table\\s+simple_core_${table}`, 'iu'));
    assert.match(source, new RegExp(`insert\\s+into\\s+logistics_core\\.${table}`, 'iu'));
    assert.match(source, new RegExp(`logistics_core\\.${table}[^;]+pg_temp\\.simple_core_${table}`, 'iu'));
  }
  assert.doesNotMatch(source, /create\s+temporary\s+table\s+pg_temp\./iu);
  assert.match(source, /SIMPLE_CORE_FINAL_READBACK_MISMATCH/iu);
}, 'all four documents use executable temporary staging and transactional readback');

check('xmin-concurrency-contract', () => {
  assert.match(source, /create\s+or\s+replace\s+function\s+logistics_core\.expected_xmin/iu);
  assert.match(source, /p_payload->>'expected_xmin'/iu);
  assert.match(source, /EXPECTED_XMIN_REQUIRED/iu);
  assert.match(source, /p_actual_xmin\s+is\s+distinct\s+from\s+p_expected_xmin[\s\S]*REVISION_CONFLICT/iu);
  assert.match(source, /\.xmin::text/iu);
}, 'PostgreSQL xmin is required and stale writes fail with 409');

check('full-home-document-writer', () => {
  assert.match(source, /home_batch_save_entry[\s\S]*p_payload->'asset'[\s\S]*p_payload->'funds'/iu);
  assert.match(source, /v_readback\s*:=\s*logistics_core\.home_read_entry/iu);
  assert.match(source, /'readback',\s*'verified'/iu);
  assert.doesNotMatch(source, /home_batch_save_entry[\s\S]{0,2200}p_payload->'operations'/iu);
}, 'home replaces visible asset and fund documents with readback');

check('full-rent-document-writer', () => {
  assert.match(source, /rent_roll_batch_save_entry[\s\S]*assert_rent_rows_valid\(p_payload->'rows'\)/iu);
  assert.match(source, /RENT_ROLL_READBACK_MISMATCH/iu);
}, 'rent-roll validates and replaces the complete rows document');

check('full-finance-document-writer', () => {
  assert.match(source, /finance_batch_save_entry[\s\S]*assert_statement_valid\(p_payload->'statement'\)/iu);
  assert.match(source, /FINANCE_READBACK_MISMATCH/iu);
}, 'finance validates and replaces the complete visible statement');

check('nested-technical-keys-are-denied', () => {
  for (const marker of [
    'SIMPLE_CORE_INVESTMENT_KEY_FORBIDDEN', 'SIMPLE_CORE_LOAN_KEY_FORBIDDEN',
    'SIMPLE_CORE_RENT_KEY_FORBIDDEN', 'SIMPLE_CORE_COST_TERM_KEY_FORBIDDEN',
    'SIMPLE_CORE_RENT_FREE_KEY_FORBIDDEN', 'SIMPLE_CORE_STATEMENT_KEY_FORBIDDEN',
    'SIMPLE_CORE_STATEMENT_ROW_KEY_FORBIDDEN',
  ]) assert.match(source, new RegExp(marker, 'u'));
  assert.match(source, /FINANCE_AMOUNT_INVALID/iu);
}, 'recursive allowlists cover every repeated document and monthly amount key');

check('permissions-preserve-wildcard-and-crud', () => {
  assert.match(source, /['"]\*['"]\s*=\s*any\s*\([^)]*managed_asset_codes/iu);
  for (const operation of ['create', 'update', 'delete']) {
    assert.match(source, new RegExp(`assert_asset_permission\\s*\\([^;]*['"]${operation}['"]`, 'iu'));
  }
}, 'wildcard scopes and create, update, delete checks survive cutover');

check('three-person-login-gate', () => {
  for (const name of ['이관용', '전기영', '이시정']) assert.ok(source.includes(name), `missing approved user ${name}`);
  assert.match(source, /create\s+or\s+replace\s+function\s+logistics_core\.enforce_temporary_login_gate/iu);
  assert.match(source, /create\s+trigger\s+ll_user_permissions_temporary_login_gate[\s\S]*on\s+public\.ll_user_permissions/iu);
  assert.match(source, /SIMPLE_CORE_LOGIN_GATE_READBACK_MISMATCH/iu);
  assert.match(source, /SIMPLE_CORE_POST_DROP_LOGIN_GATE_MISSING/iu);
}, 'exact approved allowlist is rebound and verified before and after cleanup');

check('archive-cleanup-is-dependency-guarded', () => {
  assert.match(source, /alter\s+schema\s+logistics_core\s+rename\s+to\s+logistics_core_rollback_20260807/iu);
  assert.match(source, /pg_depend/iu);
  assert.match(source, /SIMPLE_CORE_ARCHIVE_EXTERNAL_DEPENDENCY/iu);
  assert.match(source, /drop\s+schema\s+logistics_core_rollback_20260807\s+cascade/iu);
  assert.match(source, /SIMPLE_CORE_ARCHIVE_DROP_FAILED/iu);
}, 'archive is removed only after external dependency validation');

check('exact-eight-private-core-wrappers', () => {
  const expected = [
    'home_read', 'home_batch_save', 'rent_roll_read', 'rent_roll_batch_save',
    'finance_read', 'finance_batch_save', 'maturities_read', 'calculations_explain',
  ];
  const wrappers = [...source.matchAll(/create\s+or\s+replace\s+function\s+logistics_api\.([a-z0-9_]+)\s*\(/giu)]
    .map((match) => match[1]);
  assert.deepEqual([...new Set(wrappers)].sort(), expected.sort());
  for (const wrapper of expected) {
    assert.match(source, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+logistics_api\\.${wrapper}[^;]+to\\s+authenticated`, 'iu'));
  }
  assert.match(source, /revoke\s+all\s+on\s+schema\s+logistics_core\s+from\s+public,\s*anon,\s*authenticated/iu);
}, 'eight logistics_api wrappers are authenticated-only and core tables stay private');

check('primary-readback-envelope', () => {
  assert.match(source, /jsonb_build_object\(\s*'ok',\s*true,\s*'status',\s*'primary',\s*'request_id'/iu);
  assert.match(source, /READBACK_MISMATCH/iu);
}, 'writers return primary readback rather than fallback or stale data');

check('occupancy-uses-current-all-status-rent-roll-area', () => {
  assert.match(
    occupancyBasisSource,
    /sum\([\s\S]*?leased_area_sqm[\s\S]*?filter\s*\(\s*where\s+row_item\.is_current[\s\S]*?leased_area_sqm\s*>\s*0[\s\S]*?\)/iu,
  );
  assert.match(occupancyBasisSource, /v_denominator\s*:=\s*nullif\(v_current_rent_area,\s*0\)/iu);
  assert.match(occupancyBasisSource, /v_occupied_area\s*\/\s*v_denominator\s*\*\s*100/iu);
  assert.doesNotMatch(occupancyBasisSource, /v_leasable_area_sqm|v_gross_area_sqm/iu);
}, 'current occupied leased area is divided by all current positive rent-roll leased area');

const failed = checks.filter((item) => !item.ok);
process.stdout.write(`${JSON.stringify({
  ok: failed.length === 0,
  mode: 'four-document-database-contract',
  database_write_used: false,
  migrations: [MIGRATION_FILE, OCCUPANCY_BASIS_FILE, FOLLOWUP_MIGRATION_FILE],
  checks,
}, null, 2)}\n`);
process.exit(failed.length === 0 ? 0 : 1);
