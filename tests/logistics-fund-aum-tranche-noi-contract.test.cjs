const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migrationsDirectory = path.resolve(__dirname, '../supabase/migrations');
const marker = 'LOGISTICS_FUND_AUM_TRANCHE_NOI_V1';
const migrationPath = fs.readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => path.join(migrationsDirectory, name))
  .find((candidate) => fs.readFileSync(candidate, 'utf8').includes(marker));
const sql = migrationPath ? fs.readFileSync(migrationPath, 'utf8') : '';

test('fund AUM, tranche correction, and NOI merge migration exists', () => {
  assert.ok(migrationPath, `${marker} migration is required`);
});

test('ownership ratio is removed and nullable non-negative AUM is directly editable without inferred backfill', {
  skip: !migrationPath,
}, () => {
  assert.match(sql, /FUND_OWNERSHIP_RATIO_NON_NULL_PRECONDITION/iu);
  assert.match(sql, /alter\s+table\s+logistics_core\.funds[\s\S]*?add\s+column\s+if\s+not\s+exists\s+aum_krw\s+numeric/iu);
  assert.match(sql, /aum_krw\s+is\s+null\s+or\s+aum_krw\s*>=\s*0/iu);
  assert.match(sql, /drop\s+column\s+if\s+exists\s+ownership_ratio/iu);
  assert.match(sql, /AUM_DIRECT_ENTRY_ONLY_NO_BACKFILL/u);
  assert.match(sql, /assert_home_fund_document_valid[\s\S]*?aum_krw[\s\S]*?normalize_home_optional_number/iu);
  assert.match(sql, /aum_krw\s*=\s*case\s+when\s+v_fund_document\s*\?\s*'aum_krw'[\s\S]*?normalize_home_optional_number/iu);
  assert.match(sql, /HOME_FUND_OWNERSHIP_RATIO_REMOVED/u);
  assert.match(sql, /maturities_read_entry[\s\S]*?greatest\(rent\.xmin::text::bigint,\s*fund\.xmin::text::bigint\)::text/iu);
  assert.doesNotMatch(sql, /maturities_read_entry[\s\S]*?concat\(rent\.xmin::text,\s*':'\s*,\s*fund\.xmin::text\)/iu);
  assert.doesNotMatch(sql, /set\s+aum_krw\s*=\s*(?:select|\()[\s\S]*?(?:sum|agreed_amount|contributed_amount)/iu);
});

test('only the four proven synthetic 수익자 tranche values are cleared with strict signatures', {
  skip: !migrationPath,
}, () => {
  for (const value of [
    'FUND_SYNTHETIC_TRANCHE_PREFLIGHT_MISMATCH',
    'FUND_SYNTHETIC_TRANCHE_POSTCHECK_FAILED',
    '190002', '190013', '쿠팡', '쿠팡로지스틱스',
    '99574318540', '500373460', '33847096725', '867874275',
  ]) assert.match(sql, new RegExp(value, 'u'), `missing strict tranche evidence ${value}`);
  assert.match(sql, /item\.value\s*-\s*'tranche'/iu);
  assert.match(sql, /with\s+ordinality[\s\S]*?jsonb_agg[\s\S]*?order\s+by\s+item\.ordinality/iu);
  assert.match(sql, /TRANCHE_ARBITRARY_USER_TEXT_PRESERVED/u);
  assert.match(sql, /'tranche'\s*,\s*case[\s\S]*?btrim/iu);
  assert.doesNotMatch(sql, /tranche[\s\S]{0,120}\bin\s*\(\s*'보통주'/iu);
});

test('canonical OPERATING_REVENUE stores potential income minus income loss and clears income_loss', {
  skip: !migrationPath,
}, () => {
  for (const value of [
    'OPERATING_REVENUE', 'potential_income', '영업수익', 'normal_sign',
    'NOI_OPERATING_REVENUE_NET_MISMATCH', 'NOI_OTHER_SECTION_CHANGED',
    'NOI_PERIODS_CHANGED', 'NOI_MERGE_READBACK_FAILED',
  ]) assert.match(sql, new RegExp(value, 'u'), `missing NOI contract ${value}`);
  assert.match(sql, /v_potential_sum\s*-\s*v_loss_sum/iu);
  assert.match(sql, /jsonb_build_object\([\s\S]*?'account_code'\s*,\s*'OPERATING_REVENUE'[\s\S]*?'statement_section'\s*,\s*'potential_income'[\s\S]*?'label'\s*,\s*'영업수익'[\s\S]*?'normal_sign'\s*,\s*1/iu);
  assert.match(sql, /jsonb_set\([\s\S]*?'\{income_loss\}'[\s\S]*?'\[\]'::jsonb/iu);
  assert.match(sql, /create\s+temporary\s+table\s+noi_merge_snapshot/iu);
  assert.match(sql, /operating_expense[\s\S]*?below_noi[\s\S]*?debt_service/iu);
});

test('statement validator and sanitizer preserve canonical account metadata and editable amounts', {
  skip: !migrationPath,
}, () => {
  assert.match(sql, /create\s+or\s+replace\s+function\s+logistics_core\.assert_statement_valid/iu);
  assert.match(sql, /create\s+or\s+replace\s+function\s+logistics_core\.sanitize_statement_rows/iu);
  for (const key of ['account_code', 'statement_section', 'label', 'normal_sign', 'selected', 'amounts']) {
    assert.match(sql, new RegExp(`'${key}'`, 'u'), `missing statement key ${key}`);
  }
  assert.match(sql, /OPERATING_REVENUE_CANONICAL_ROW_INVALID/u);
  assert.match(sql, /FINANCE_CANONICAL_OPERATING_REVENUE_REQUIRED/u);
  assert.match(sql, /jsonb_array_length\(p_statement->'potential_income'\)\s*<>\s*1/iu);
  assert.match(sql, /jsonb_array_length\(p_statement->'income_loss'\)\s*<>\s*0/iu);
  assert.match(sql, /assert_statement_transition_valid/iu);
  assert.match(sql, /finance_batch_save_entry/iu);
  assert.match(sql, /FINANCE_READBACK_MISMATCH/u);
});

test('existing rent-roll burden costs remain visible JSON item arrays', () => {
  const simpleMigration = fs.readFileSync(path.join(
    migrationsDirectory,
    '20260807180000_simplify_logistics_core_to_four_ui_tables.sql',
  ), 'utf8');
  const taxonomyMigration = fs.readFileSync(path.join(
    migrationsDirectory,
    '20260810070000_logistics_rent_roll_taxonomy_contract.sql',
  ), 'utf8');
  const contract = `${simpleMigration}\n${taxonomyMigration}`;
  assert.match(contract, /tenant_cost_terms['"]?\s*,\s*logistics_core\.sanitize_cost_terms/iu);
  assert.match(contract, /landlord_cost_terms['"]?\s*,\s*logistics_core\.sanitize_cost_terms/iu);
  assert.match(contract, /jsonb_build_object\(\s*'items'\s*,\s*v_items\s*\)/iu);
  assert.match(contract, /RENT_ROLL_COST_TERMS_INVALID/u);
  assert.match(contract, /jsonb_typeof\(v_row->v_field->'items'\)\s*<>\s*'array'/iu);
});

test('NOI merge fixture is idempotent and preserves the monthly net', () => {
  const statement = {
    periods: ['2026-07', '2026-08'],
    potential_income: [
      { amounts: { '2026-07': 120, '2026-08': 150 } },
      { amounts: { '2026-07': 10, '2026-08': null } },
    ],
    income_loss: [{ amounts: { '2026-07': 20, '2026-08': 30 } }],
    operating_expense: [{ name: '관리비', selected: true, amounts: { '2026-07': 40 } }],
    below_noi: [],
    debt_service: [],
  };
  const merge = (source) => {
    const amounts = Object.fromEntries(source.periods.map((month) => {
      const potential = source.potential_income.map((row) => row.amounts?.[month])
        .filter((value) => value !== null && value !== undefined);
      const loss = source.income_loss.map((row) => row.amounts?.[month])
        .filter((value) => value !== null && value !== undefined);
      const values = [...potential, ...loss];
      return [month, values.length
        ? potential.reduce((sum, value) => sum + value, 0)
          - loss.reduce((sum, value) => sum + value, 0)
        : null];
    }));
    return {
      ...source,
      potential_income: [{
        account_code: 'OPERATING_REVENUE',
        statement_section: 'potential_income',
        label: '영업수익',
        normal_sign: 1,
        selected: true,
        amounts,
      }],
      income_loss: [],
    };
  };
  const once = merge(statement);
  const twice = merge(once);
  assert.deepEqual(once.potential_income[0].amounts, { '2026-07': 110, '2026-08': 120 });
  assert.deepEqual(twice, once);
  assert.deepEqual(once.operating_expense, statement.operating_expense);
  assert.deepEqual(once.periods, statement.periods);
});
