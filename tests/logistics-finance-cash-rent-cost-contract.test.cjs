const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const migrationDirectory = path.resolve(__dirname, '../supabase/migrations');
const marker = 'LOGISTICS_FINANCE_CASH_RENT_COST_CONTRACT_V1';
const migrationPath = fs.readdirSync(migrationDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => path.join(migrationDirectory, name))
  .find((candidate) => fs.readFileSync(candidate, 'utf8').includes(marker));
const sql = migrationPath ? fs.readFileSync(migrationPath, 'utf8') : '';

test('finance cash and rent cost migration exists', () => {
  assert.ok(migrationPath, `${marker} migration is required`);
});

test('rent cost terms remove only explicit empty sentinels and preserve unknown values', { skip: !migrationPath }, () => {
  assert.match(sql, /create or replace function logistics_core\.sanitize_cost_terms\(p_value jsonb\)/iu);
  for (const value of ['N/A', '-', '없음', '해당없음']) assert.match(sql, new RegExp(`'${value}'`, 'u'));
  assert.match(sql, /'수도광열비'\s+then\s+'수도광열비·공과금'/u);
  for (const preserved of ['주민세', 'FM관리비', '보험료', '재산세', 'N', '일상유지보수', '인건비']) {
    assert.match(sql, new RegExp(`'${preserved}'`, 'u'), `preservation marker missing: ${preserved}`);
  }
  assert.match(sql, /jsonb_build_object\('items',\s*v_items\)/iu);
  assert.match(sql, /create or replace function logistics_core\.is_standard_cost_term\(p_item text\)/iu);
  assert.match(sql, /not logistics_core\.is_standard_cost_term\(item_value\)/iu);
  assert.match(sql, /not logistics_core\.is_standard_cost_term\(term\.value #>> '\{\}'\)/iu);
  assert.match(sql, /RENT_COST_UNKNOWN_VALUE_CHANGED/u);
});

test('cost custom-only fixture excludes aliases and canonical defaults from unknown comparison', () => {
  const canonical = (value) => ({
    '수도광열비': '수도광열비·공과금',
    '전기·수도·가스 등 공과금': '수도광열비·공과금',
  }[String(value).trim()] || String(value).trim());
  const standards = new Set(['수도광열비·공과금', '임차인 시설 설치·개조비']);
  const customOnly = (values) => values.map(canonical).filter((value) => !standards.has(value));
  assert.deepEqual(customOnly(['수도광열비', '수도광열비·공과금', '주민세']), ['주민세']);
});

test('rent backfill is fail-closed and changes only the two cost fields at the same ordinality', {
  skip: !migrationPath,
}, () => {
  assert.match(sql, /RENT_COST_DOCUMENT_COUNT_MISMATCH/u);
  assert.match(sql, /RENT_COST_ROW_COUNT_MISMATCH/u);
  assert.match(sql, /v_document_count\s*<>\s*19/iu);
  assert.match(sql, /v_row_count\s*<>\s*81/iu);
  assert.match(sql, /v_na_count\s*<>\s*21/iu);
  assert.match(sql, /with ordinality/iu);
  assert.match(sql, /-\s*'tenant_cost_terms'\s*-\s*'landlord_cost_terms'/iu);
  assert.match(sql, /RENT_COST_NON_TARGET_FIELD_CHANGED/u);
  assert.match(sql, /RENT_COST_ROW_ORDER_CHANGED/u);
  assert.match(sql, /RENT_COST_SENTINEL_REMAINS/u);
});

test('stored finance sections include cash inputs while derived rows are forbidden', { skip: !migrationPath }, () => {
  for (const section of [
    'potential_income', 'income_loss', 'operating_expense', 'below_noi',
    'debt_service', 'cash_flow', 'cash_balance',
  ]) assert.match(sql, new RegExp(`'${section}'`, 'u'));
  const canonical = [
    ['OPERATING_REVENUE', 'potential_income', 1],
    ['OTHER_CASH_INFLOW', 'cash_flow', 1],
    ['OTHER_CASH_OUTFLOW', 'cash_flow', -1],
    ['OPENING_CASH_BALANCE', 'cash_balance', 1],
  ];
  for (const [code, section, sign] of canonical) {
    assert.match(sql, new RegExp(`'${code}'[\\s\\S]*?'${section}'[\\s\\S]*?${sign}`, 'u'));
  }
  for (const derived of [
    'NET_OPERATING_INCOME', 'PRE_DEBT_CASH_FLOW', 'AFTER_DEBT_SERVICE_CASH_FLOW',
    'NET_CASH_FLOW', 'CUMULATIVE_NET_CASH_FLOW', 'CLOSING_CASH_BALANCE',
  ]) assert.match(sql, new RegExp(`'${derived}'`, 'u'));
  assert.match(sql, /FINANCE_DERIVED_ROW_STORAGE_FORBIDDEN/u);
});

test('finance defaults keep one operating revenue, core OPEX, owner costs and debt service', {
  skip: !migrationPath,
}, () => {
  const coreOpex = [
    'PM_FEE', 'FM_FEE', 'REPAIRS_MAINTENANCE', 'UTILITIES',
    'PROPERTY_TAX_PUBLIC_DUES', 'PROPERTY_INSURANCE',
    'GENERAL_PROPERTY_ADMIN', 'OTHER_PROPERTY_OPEX',
  ];
  const belowNoi = [
    'CAPEX', 'TENANT_IMPROVEMENT', 'LEASING_COMMISSION', 'CAPITAL_RESERVE',
    'AMC_FEE', 'CUSTODY_FEE', 'GENERAL_ADMIN_TRUSTEE_FEE',
    'OTHER_OWNER_COST', 'NONCASH_ADDBACK',
  ];
  const debt = ['INTEREST_PAID', 'PRINCIPAL_REPAYMENT', 'LOAN_FEE'];
  for (const code of [...coreOpex, ...belowNoi, ...debt]) assert.match(sql, new RegExp(`'${code}'`, 'u'));
  for (const code of ['AMC_FEE', 'CUSTODY_FEE', 'GENERAL_ADMIN_TRUSTEE_FEE']) {
    assert.match(sql, new RegExp(`'${code}'[\\s\\S]*?true`, 'u'));
  }
  assert.match(sql, /FINANCE_CANONICAL_OPERATING_REVENUE_REQUIRED/u);
  assert.match(sql, /FINANCE_STANDARD_ACCOUNT_READBACK_FAILED/u);
});

test('finance migration and writer preserve periods, custom rows and all entered amounts', {
  skip: !migrationPath,
}, () => {
  assert.match(sql, /FINANCE_DOCUMENT_COUNT_MISMATCH/u);
  assert.match(sql, /FINANCE_AMOUNT_CELL_PREFLIGHT_FAILED/u);
  assert.match(sql, /v_document_count\s*<>\s*19/iu);
  assert.match(sql, /v_amount_cell_count\s*<>\s*0/iu);
  assert.match(sql, /FINANCE_PERIODS_CHANGED/u);
  assert.match(sql, /FINANCE_CUSTOM_ACCOUNT_CHANGED/u);
  assert.match(sql, /FINANCE_AMOUNT_DATA_CHANGED/u);
  assert.match(sql, /coalesce\(v_old_statement->'cash_flow',\s*'\[\]'::jsonb\)/iu);
  assert.match(sql, /coalesce\(v_old_statement->'cash_balance',\s*'\[\]'::jsonb\)/iu);
  assert.match(sql, /coalesce\(v_statement->'cash_flow',\s*'\[\]'::jsonb\)/iu);
  assert.match(sql, /coalesce\(v_statement->'cash_balance',\s*'\[\]'::jsonb\)/iu);
  assert.match(sql, /FINANCE_READBACK_MISMATCH/u);
  assert.doesNotMatch(sql, /create\s+(?:unlogged\s+)?table\s+logistics_core\./iu);
  assert.doesNotMatch(sql, /alter\s+table\s+logistics_core\./iu);
});

test('future custom account codes remain custom rows with their entered amounts', { skip: !migrationPath }, () => {
  assert.match(sql, /if\s+v_code\s*=\s*any\s*\(array\[/iu);
  assert.match(sql, /else\s+return\s+null;\s*end\s+if;/iu);
  assert.match(sql, /where\s+logistics_core\.finance_account_code\(p_section,\s*item\.value\)\s+is\s+null/iu);
  const classify = (code, known) => (known.has(code) ? code : null);
  const known = new Set(['PM_FEE', 'AMC_FEE']);
  const source = {
    account_code: 'CUSTOM_LOGISTICS_REBATE',
    label: '물류 장려금',
    selected: true,
    amounts: { '2026-08': 123456 },
  };
  assert.equal(classify(source.account_code, known), null);
  assert.deepEqual({ ...source }, source);
});

test('actual frontend canonical statement preserves required account metadata before storage', {
  skip: !migrationPath,
}, async () => {
  const contractUrl = pathToFileURL(path.resolve(__dirname, '../src/features/logistics-data-platform/documentContract.js'));
  const { buildIncomeExpenseStatement } = await import(`${contractUrl.href}?db-contract=${Date.now()}`);
  const accounts = [
    ['operating_expense', 'PM_FEE', 'PM 수수료'],
    ['cash_flow', 'OTHER_CASH_INFLOW', '기타 현금유입'],
    ['cash_flow', 'OTHER_CASH_OUTFLOW', '기타 현금유출'],
    ['cash_balance', 'OPENING_CASH_BALANCE', '기초 현금잔액'],
  ].map(([statement_section, account_code, name]) => ({ statement_section, account_code, name }));
  const statement = buildIncomeExpenseStatement({
    accounts,
    entries: [{ account_code: 'PM_FEE', month: '2026-08', amount: 100 }],
    selectedAccountCodes: accounts.map(({ account_code }) => account_code),
  });
  assert.deepEqual(Object.keys(statement.operating_expense[0]).sort(), [
    'account_code', 'amounts', 'label', 'normal_sign', 'selected', 'statement_section',
  ]);
  assert.deepEqual(statement.operating_expense[0], {
    account_code: 'PM_FEE',
    statement_section: 'operating_expense',
    label: 'PM 수수료',
    normal_sign: -1,
    selected: true,
    amounts: { '2026-08': 100 },
  });
  assert.match(sql, /create or replace function logistics_core\.sanitize_finance_section\(/iu);
  assert.match(sql, /finance_account_code\(p_section,\s*item\.value\)/iu);
  for (const key of ['account_code', 'statement_section', 'label', 'normal_sign', 'selected', 'amounts']) {
    assert.match(sql, new RegExp(`'${key}'`, 'u'));
  }
  assert.match(sql, /FINANCE_CANONICAL_INPUT_ROW_REQUIRED/u);
});
