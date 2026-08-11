const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migrationsDirectory = path.resolve(__dirname, '../supabase/migrations');
const marker = 'LOGISTICS_FUND_AUM_SOURCE_BACKFILL_V1';
const migrationPath = fs.readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => path.join(migrationsDirectory, name))
  .find((candidate) => fs.readFileSync(candidate, 'utf8').includes(marker));
const sql = migrationPath ? fs.readFileSync(migrationPath, 'utf8') : '';

const expected = Object.freeze({
  120085: [189228456200, 189228456200],
  112527: [214359785594, 214359785594],
  112755: [120540000000, 120540000000],
  112109: [76000000000, 76000000000],
  190002: [265904813630, 265979505630],
  112299: [147705990629, 147705990629],
  112505: [197603918260, 197603918260],
  112127: [425598336160, 425598336160],
  P00014: [185000000000, 185000000000],
  112703: [177800000000, 177800000000],
  S00002: [null, null],
  112606: [180901725000, 183601578000],
  112573: [95489000000, 95495739782],
  112751: [588058966310, 588058966310],
  112604: [137600000000, 137600000000],
  190013: [119660000000, 50592239000],
  112642: [237894893070, 237894893070],
});

test('AUM exact-source migration exists', () => {
  assert.ok(migrationPath, `${marker} migration is required`);
});

test('the operating source is frozen to the dated AUM workbook projection', { skip: !migrationPath }, () => {
  assert.match(sql, /public\.v_funds_enriched/iu);
  assert.match(sql, /펀드 AUM 관리_20260713\.xlsx/u);
  assert.match(sql, /펀드 AUM 관리_20260515\.xlsx/u);
  assert.match(sql, /2026-06-30/u);
  assert.match(sql, /aum_base_date\s+is\s+distinct\s+from\s+date\s+'2026-06-30'/iu);
  assert.match(sql, /aum_input_date\s+is\s+distinct\s+from\s+date\s+'2026-06-30'/iu);
  assert.match(sql, /AUM_SOURCE_ROW_COUNT_MISMATCH/u);
  assert.match(sql, /source\.fund_id\s+as\s+source_fund_id/iu);
  assert.match(sql, /count\(source_fund_id\)/iu);
  assert.match(sql, /v_present_source_count\s*<>\s*17/iu);
  assert.match(sql, /fund_code\s*=\s*'S00002'[\s\S]*?aum_source\s+is\s+distinct\s+from\s+'펀드 AUM 관리_20260515\.xlsx'/iu);
  assert.match(sql, /AUM_SOURCE_COMPONENT_SUM_MISMATCH/u);
  assert.match(sql, /benchmark_aum\s+is\s+distinct\s+from[\s\S]*?equity_won[\s\S]*?loan_won[\s\S]*?deposit_won/iu);
  assert.match(sql, /invested_aum\s+is\s+distinct\s+from[\s\S]*?invested_equity_won[\s\S]*?invested_loan_won[\s\S]*?invested_deposit_won/iu);
});

test('all 17 exact fund-code signatures preserve benchmark and invested meanings separately', {
  skip: !migrationPath,
}, () => {
  for (const [fundCode, [benchmarkAum, investedAum]] of Object.entries(expected)) {
    assert.match(sql, new RegExp(`'${fundCode}'`, 'u'), `missing fund ${fundCode}`);
    if (benchmarkAum !== null) assert.match(sql, new RegExp(String(benchmarkAum), 'u'));
    if (investedAum !== null) assert.match(sql, new RegExp(String(investedAum), 'u'));
  }
  assert.match(sql, /AUM_EXACT_SIGNATURE_MISMATCH/u);
});

test('only blank AUM receives invested actual AUM and missing source remains null', {
  skip: !migrationPath,
}, () => {
  assert.match(sql, /AUM_TARGET_CONFLICT/u);
  assert.match(sql, /previous_aum_krw\s+is\s+not\s+null[\s\S]*?previous_aum_krw\s+is\s+distinct\s+from\s+source\.invested_aum/iu);
  assert.match(sql, /set\s+aum_krw\s*=\s*source\.invested_aum/iu);
  assert.match(sql, /source\.invested_aum\s+is\s+not\s+null/iu);
  assert.match(sql, /target\.aum_krw\s+is\s+null/iu);
  assert.doesNotMatch(sql, /set\s+aum_krw\s*=\s*source\.benchmark_aum/iu);
  assert.match(sql, /AUM_UPDATED_COUNT_MISMATCH/u);
  assert.match(sql, /AUM_NULL_SOURCE_CHANGED/u);
  assert.match(sql, /AUM_BACKFILL_READBACK_FAILED/u);
  assert.match(sql, /v_updated_count\s+not\s+in\s*\(\s*0\s*,\s*16\s*\)/iu);
});

test('the backfill adds no table, column, key, or source metadata to logistics_core', {
  skip: !migrationPath,
}, () => {
  assert.doesNotMatch(sql, /create\s+(?:unlogged\s+)?table\s+logistics_core\./iu);
  assert.doesNotMatch(sql, /alter\s+table\s+logistics_core\.[\s\S]*?add\s+column/iu);
  assert.doesNotMatch(sql, /\bsource_(?:id|key|ref|payload)\b/iu);
  assert.match(sql, /create\s+temporary\s+table\s+aum_source_snapshot/iu);
});
