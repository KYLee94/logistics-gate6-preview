'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION_MARKER = 'LOGISTICS_FINANCE_CANONICAL_HIERARCHY_V2';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function migrationSource() {
  const directory = path.join(ROOT, 'supabase', 'migrations');
  const file = fs.readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .find((name) => fs.readFileSync(path.join(directory, name), 'utf8').includes(MIGRATION_MARKER));
  assert.ok(file, `${MIGRATION_MARKER} migration is missing`);
  return { file, sql: fs.readFileSync(path.join(directory, file), 'utf8') };
}

const REVENUE = Object.freeze([
  ['RENT_REVENUE', '임대수익'],
  ['MANAGEMENT_FEE_INCOME', '관리비수익'],
  ['UTILITIES_REIMBURSEMENT_INCOME', '수도광열비 회수수익'],
  ['INTEREST_INCOME', '이자수익'],
  ['MISCELLANEOUS_INCOME', '기타수익'],
]);

const OPEX = Object.freeze([
  ['PM_FEE', 'PM 수수료'],
  ['FM_FEE', 'FM 수수료'],
  ['REPAIRS_MAINTENANCE', '수선유지비'],
  ['UTILITIES', '수도광열비'],
  ['PROPERTY_INSURANCE', '보험료'],
  ['BUILDING_PROPERTY_TAX', '건물 재산세'],
  ['LAND_PROPERTY_TAX', '토지 재산세'],
  ['COMPREHENSIVE_REAL_ESTATE_TAX', '종합부동산세'],
  ['ROAD_OCCUPANCY_FEE', '도로점용료'],
  ['DEEMED_RENT_VAT', '간주임대료 부가세'],
  ['OTHER_TAXES', '기타 세금'],
  ['OTHER_PROPERTY_OPEX', '기타 운영비'],
]);

const BELOW_NOI = Object.freeze([
  ['AMC_FEE', 'AMC 수수료'],
  ['CUSTODY_FEE', '자산보관 수수료'],
  ['GENERAL_ADMIN_TRUSTEE_FEE', '일반사무·수탁 수수료'],
  ['CAPEX', '자본적 지출'],
  ['TENANT_IMPROVEMENT', '임차인 시설공사비(TI)'],
  ['LEASING_COMMISSION', '임대 중개수수료(LC)'],
]);

test('canonical hierarchy migration exists after RED contract is written', () => {
  const { file, sql } = migrationSource();
  assert.match(file, /^\d{14}_logistics_finance_canonical_hierarchy_v2\.sql$/u);
  assert.match(sql, /begin;/iu);
  assert.match(sql, /commit;/iu);
});

test('five revenue input rows replace persisted operating revenue subtotal', () => {
  const { sql } = migrationSource();
  for (const [code, label] of REVENUE) {
    assert.match(sql, new RegExp(`'${escapeRegExp(code)}'[\\s\\S]{0,180}'${escapeRegExp(label)}'`, 'u'));
  }
  assert.match(sql, /v_revenue_canonical_count\s*<>\s*5/iu);
  assert.match(sql, /FINANCE_CANONICAL_REVENUE_REQUIRED/iu);
  assert.match(sql, /OPERATING_REVENUE_PERSISTED_FORBIDDEN/iu);
  assert.match(sql, /OPERATING_REVENUE/iu);
});

test('operating expense and below-NOI catalogs match the approved human-readable hierarchy', () => {
  const { sql } = migrationSource();
  for (const [code, label] of [...OPEX, ...BELOW_NOI]) {
    assert.match(sql, new RegExp(`'${escapeRegExp(code)}'[\\s\\S]{0,180}'${escapeRegExp(label)}'`, 'u'));
  }
  for (const code of ['INTEREST_PAID', 'PRINCIPAL_REPAYMENT', 'LOAN_FEE']) {
    assert.match(sql, new RegExp(`'${code}'`, 'u'));
  }
});

test('migration preflight is fail-closed for the exact operating snapshot and preserves custom rows', () => {
  const { sql } = migrationSource();
  for (const marker of [
    'FINANCE_CANONICAL_HIERARCHY_DOCUMENT_COUNT_MISMATCH',
    'FINANCE_CANONICAL_HIERARCHY_SOURCE_SIGNATURE_MISMATCH',
    'FINANCE_CANONICAL_HIERARCHY_AMOUNT_DATA_PRESENT',
    'FINANCE_CANONICAL_HIERARCHY_PERIOD_DATA_PRESENT',
    'FINANCE_CANONICAL_HIERARCHY_CUSTOM_CHANGED',
    'FINANCE_CANONICAL_HIERARCHY_READBACK_FAILED',
  ]) assert.match(sql, new RegExp(marker, 'u'));
  assert.match(sql, /v_document_count\s*<>\s*19/iu);
  assert.match(sql, /v_operating_revenue_count\s*<>\s*19/iu);
  assert.match(sql, /v_amount_cell_count\s*<>\s*0/iu);
  assert.match(sql, /v_period_count\s*<>\s*0/iu);
  assert.match(sql, /except\s+select/iu);
  assert.match(sql, /가나다/u);
});

test('writer rejects synthetic DOCUMENT codes and canonicalizes all stored rows', () => {
  const { sql } = migrationSource();
  assert.match(sql, /like\s+'DOCUMENT:%'/iu);
  assert.match(sql, /FINANCE_DOCUMENT_ACCOUNT_CODE_FORBIDDEN/iu);
  assert.match(sql, /create\s+or\s+replace\s+function\s+logistics_core\.finance_account_code/iu);
  assert.match(sql, /create\s+or\s+replace\s+function\s+logistics_core\.finance_account_spec/iu);
  assert.match(sql, /create\s+or\s+replace\s+function\s+logistics_core\.sanitize_finance_section/iu);
  assert.match(sql, /create\s+or\s+replace\s+function\s+logistics_core\.assert_statement_valid/iu);
  assert.match(sql, /create\s+or\s+replace\s+function\s+logistics_core\.finance_batch_save_entry/iu);
  assert.match(sql, /FINANCE_READBACK_MISMATCH/iu);
});

test('derived subtotal and cash-flow metrics remain forbidden in stored statement rows', () => {
  const { sql } = migrationSource();
  for (const code of [
    'OPERATING_REVENUE', 'NET_OPERATING_INCOME', 'PRE_DEBT_CASH_FLOW',
    'AFTER_DEBT_SERVICE_CASH_FLOW', 'NET_CASH_FLOW',
    'CUMULATIVE_NET_CASH_FLOW', 'CLOSING_CASH_BALANCE',
  ]) assert.match(sql, new RegExp(`'${code}'`, 'u'));
  assert.match(sql, /FINANCE_DERIVED_ROW_STORAGE_FORBIDDEN/iu);
});

test('writer grant does not require an optional deployment role', () => {
  const { sql } = migrationSource();
  assert.doesNotMatch(sql, /\bto\s+logistics_api_owner\b/iu);
  assert.match(
    sql,
    /grant\s+execute\s+on\s+function\s+logistics_core\.finance_batch_save_entry\(uuid,\s*text,\s*jsonb,\s*jsonb\)\s+to\s+authenticated/iu,
  );
});

test('catalog defaults keep only principal repayment and loan fee optional', () => {
  const { sql } = migrationSource();
  assert.match(
    sql,
    /\('debt_service',\s*10,\s*'INTEREST_PAID',\s*'이자 지급액',\s*-1,\s*true\)/u,
  );
  assert.match(
    sql,
    /\('debt_service',\s*20,\s*'PRINCIPAL_REPAYMENT',\s*'원금 상환액',\s*-1,\s*false\)/u,
  );
  assert.match(
    sql,
    /\('debt_service',\s*30,\s*'LOAN_FEE',\s*'대출 관련 수수료',\s*-1,\s*false\)/u,
  );
  for (const code of [
    'TENANT_IMPROVEMENT', 'LEASING_COMMISSION', 'AMC_FEE',
    'CUSTODY_FEE', 'GENERAL_ADMIN_TRUSTEE_FEE',
    'BUILDING_PROPERTY_TAX', 'LAND_PROPERTY_TAX',
    'COMPREHENSIVE_REAL_ESTATE_TAX', 'ROAD_OCCUPANCY_FEE',
    'DEEMED_RENT_VAT', 'OTHER_TAXES',
  ]) {
    assert.match(
      sql,
      new RegExp(`\\([^\\n]*'${escapeRegExp(code)}'[^\\n]*true\\)`, 'u'),
      `${code} must remain selected by default`,
    );
  }
});
