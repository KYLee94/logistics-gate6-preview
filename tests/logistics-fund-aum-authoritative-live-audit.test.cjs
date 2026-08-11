const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const scriptPath = path.resolve(
  __dirname,
  '../scripts/qa/logistics-fund-aum-authoritative-live-audit.cjs',
);
const releaseGatePath = path.resolve(
  __dirname,
  '../scripts/qa/logistics-data-platform-release-gate.cjs',
);

test('authoritative AUM audit requires an exact one-to-one fund_id match', () => {
  const { auditAuthoritativeAumRows } = require(scriptPath);
  const result = auditAuthoritativeAumRows([
    {
      fund_id: '120085',
      benchmark_aum: 189228456200,
      invested_aum: 189228456200,
      aum_source: '펀드 AUM 관리_20260713.xlsx',
      aum_base_date: '2026-06-30',
    },
    {
      fund_id: 'P00014',
      benchmark_aum: 185000000000,
      invested_aum: 185000000000,
      aum_source: '펀드 AUM 관리_20260713.xlsx',
      aum_base_date: null,
    },
    {
      fund_id: 'S00002',
      benchmark_aum: null,
      invested_aum: null,
      aum_source: '펀드 AUM 관리_20260515.xlsx',
      aum_base_date: null,
    },
  ], ['120085', 'P00014', 'S00002']);

  assert.equal(result.expected_fund_count, 3);
  assert.equal(result.exact_match_count, 3);
  assert.equal(result.authoritative_value_count, 2);
  assert.deepEqual(result.missing_fund_ids, []);
  assert.deepEqual(result.duplicate_fund_ids, []);
  assert.deepEqual(result.invalid_provenance_fund_ids, []);
  assert.deepEqual(result.null_aum_fund_ids, ['S00002']);
  assert.equal(result.ok, true);
});

test('authoritative AUM audit distinguishes missing, duplicate, and invalid provenance rows', () => {
  const { auditAuthoritativeAumRows } = require(scriptPath);
  const result = auditAuthoritativeAumRows([
    {
      fund_id: '120085',
      benchmark_aum: 1,
      invested_aum: 2,
      aum_source: 'wrong.xlsx',
      aum_base_date: '2026-06-29',
    },
    {
      fund_id: '120085',
      benchmark_aum: 1,
      invested_aum: 2,
      aum_source: '펀드 AUM 관리_20260713.xlsx',
      aum_base_date: '2026-06-30',
    },
  ], ['120085', '112527']);

  assert.deepEqual(result.missing_fund_ids, ['112527']);
  assert.deepEqual(result.duplicate_fund_ids, ['120085']);
  assert.deepEqual(result.invalid_provenance_fund_ids, ['120085']);
  assert.equal(result.ok, false);
});

test('S00002 keeps null AUM with its older authoritative workbook provenance', () => {
  const { auditAuthoritativeAumRows } = require(scriptPath);
  const result = auditAuthoritativeAumRows([{
    fund_id: 'S00002',
    benchmark_aum: null,
    invested_aum: null,
    aum_source: '펀드 AUM 관리_20260713.xlsx',
    aum_base_date: null,
  }], ['S00002']);

  assert.deepEqual(result.invalid_null_aum_provenance_fund_ids, ['S00002']);
  assert.equal(result.ok, false);
});

test('live audit permits only home/read POST plus enriched-view GET and never treats invested AUM as beneficiary capital', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');

  assert.match(source, /v2\/home\/read/u);
  assert.match(source, /rest\/v1\/v_funds_enriched/u);
  assert.match(source, /method:\s*'GET'/u);
  assert.match(source, /method:\s*'POST'/u);
  assert.match(source, /database_write_used:\s*false/u);
  assert.match(source, /fund_id,benchmark_aum,invested_aum,aum_source,aum_base_date/u);
  assert.match(source, /펀드 AUM 관리_20260713\.xlsx/u);
  assert.match(source, /2026-06-30/u);
  assert.doesNotMatch(source, /method:\s*'(?:PUT|PATCH|DELETE)'/u);
  assert.doesNotMatch(source, /batch-save|batch_save/u);
  assert.doesNotMatch(source, /agreed_amount_krw|contributed_amount_krw/u);
});

test('release gate includes authoritative AUM source and backfill contracts', () => {
  const source = fs.readFileSync(releaseGatePath, 'utf8');
  for (const marker of [
    'fund-aum-authoritative-live-audit-unit',
    'tests/logistics-fund-aum-authoritative-live-audit.test.cjs',
    'fund-aum-source-backfill-contract',
    'tests/logistics-fund-aum-source-backfill-contract.test.cjs',
  ]) assert.match(source, new RegExp(marker, 'u'));
});
