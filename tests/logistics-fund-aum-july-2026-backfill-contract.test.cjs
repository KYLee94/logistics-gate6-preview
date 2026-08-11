const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migrationsDirectory = path.resolve(__dirname, '../supabase/migrations');
const marker = 'LOGISTICS_FUND_AUM_JULY_2026_BACKFILL_V2';
const migrationPath = fs.readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => path.join(migrationsDirectory, name))
  .find((candidate) => fs.readFileSync(candidate, 'utf8').includes(marker));
const sql = migrationPath ? fs.readFileSync(migrationPath, 'utf8') : '';

const expected = Object.freeze({
  112109: [40, 28000000000, 48000000000, 0, 76000000000],
  112127: [43, 208174063584, 210500000000, 6924272576, 425598336160],
  112299: [85, 72970776710, 71852000000, 2671790940, 147494567650],
  112505: [131, 54449350000, 140597938000, 2556630260, 197603918260],
  112527: [137, 211600000000, 0, 2759785594, 214359785594],
  112573: [147, 44506739782, 46500000000, 4489000000, 95495739782],
  112604: [167, 66100000000, 71500000000, 0, 137600000000],
  112606: [168, 57799853000, 122500000000, 3301725000, 183601578000],
  112642: [182, 61500000000, 169500000000, 6894893070, 237894893070],
  112703: [209, 111000000000, 56800000000, 10000000000, 177800000000],
  112751: [218, 237120581000, 342600000000, 8338385310, 588058966310],
  112755: [219, 60590000000, 59950000000, 0, 120540000000],
  120085: [241, 53500000000, 130000000000, 5728456200, 189228456200],
  190002: [251, 100074692000, 162400000000, 3504813630, 265979505630],
  190013: [256, 50592239000, 0, 0, 50592239000],
  P00014: [337, 10000000000, 175000000000, 0, 185000000000],
});

test('July 2026 invested-AUM migration exists', () => {
  assert.ok(migrationPath, `${marker} migration is required`);
});

test('the exact workbook, sheet, fingerprint, date, and invested columns are frozen', {
  skip: !migrationPath,
}, () => {
  assert.match(sql, /펀드 AUM 관리_20260811\.xlsx/u);
  assert.match(sql, /source_sheet:\s*sheet/iu);
  assert.match(sql, /source_sha256:\s*7E208A0BF0FEE7702DAC06EE808E7B2A93AF30165A96C6767FD327B370E2EB3C/iu);
  assert.match(sql, /source_columns:\s*A=fund_code,\s*M=input_date,\s*R=invested_equity,\s*S=invested_loan,\s*T=invested_deposit,\s*U=invested_aum/iu);
  assert.match(sql, /date\s+'2026-07-31'/iu);
  assert.match(sql, /AUM_JULY_SOURCE_DATE_MISMATCH/u);
});

test('all 16 source rows preserve exact components and AUM totals', { skip: !migrationPath }, () => {
  for (const [fundCode, [sourceRow, equity, loan, deposit, aum]] of Object.entries(expected)) {
    assert.equal(equity + loan + deposit, aum, `${fundCode} fixture sum`);
    const signature = new RegExp(
      `'${fundCode}'\\s*,\\s*${sourceRow}\\s*,\\s*date\\s+'2026-07-31'\\s*,\\s*${equity}\\s*,\\s*${loan}\\s*,\\s*${deposit}\\s*,\\s*${aum}`,
      'iu',
    );
    assert.match(sql, signature, `missing exact source row for ${fundCode}`);
  }
  assert.match(sql, /v_source_count\s*<>\s*16/iu);
  assert.match(sql, /AUM_JULY_SOURCE_ROW_COUNT_MISMATCH/u);
  assert.match(sql, /AUM_JULY_COMPONENT_SUM_MISMATCH/u);
});

test('the target universe is exact, S00002 remains absent from source and null in the document', {
  skip: !migrationPath,
}, () => {
  assert.match(sql, /v_target_count\s*<>\s*17/iu);
  assert.match(sql, /v_matched_target_count\s*<>\s*17/iu);
  assert.match(sql, /AUM_JULY_TARGET_FUND_SET_MISMATCH/u);
  assert.match(sql, /fund_code\s*=\s*'S00002'[\s\S]*?aum_krw\s+is\s+not\s+null/iu);
  assert.match(sql, /AUM_JULY_NULL_SOURCE_CHANGED/u);
  assert.doesNotMatch(sql, /\('S00002'\s*,\s*\d+\s*,\s*date\s+'2026-07-31'/iu);
});

test('only the exact previous or July value is accepted and reruns are idempotent', {
  skip: !migrationPath,
}, () => {
  assert.match(sql, /previous_aum_krw/iu);
  assert.match(sql, /previous_aum_krw\s+is\s+distinct\s+from\s+source\.expected_previous_aum/iu);
  assert.match(sql, /previous_aum_krw\s+is\s+distinct\s+from\s+source\.invested_aum/iu);
  assert.match(sql, /AUM_JULY_TARGET_CONFLICT/u);
  assert.match(sql, /set\s+aum_krw\s*=\s*source\.invested_aum/iu);
  assert.match(sql, /target\.aum_krw\s+is\s+distinct\s+from\s+source\.invested_aum/iu);
  assert.match(sql, /v_updated_count\s+not\s+in\s*\(\s*0\s*,\s*1\s*\)/iu);
  assert.match(sql, /AUM_JULY_UPDATED_COUNT_MISMATCH/u);
  assert.match(sql, /AUM_JULY_BACKFILL_READBACK_FAILED/u);
});

test('the update keeps the four-table schema and stores no provenance columns', {
  skip: !migrationPath,
}, () => {
  assert.doesNotMatch(sql, /create\s+(?:unlogged\s+)?table\s+logistics_core\./iu);
  assert.doesNotMatch(sql, /alter\s+table\s+logistics_core\.[\s\S]*?add\s+column/iu);
  assert.doesNotMatch(sql, /\bsource_(?:id|key|ref|payload)\b/iu);
  assert.match(sql, /create\s+temporary\s+table\s+aum_july_2026_source/iu);
});
