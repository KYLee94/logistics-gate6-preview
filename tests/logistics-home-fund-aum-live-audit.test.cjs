const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const scriptPath = path.resolve(__dirname, '../scripts/qa/logistics-home-fund-aum-live-audit.cjs');
const releaseGatePath = path.resolve(__dirname, '../scripts/qa/logistics-data-platform-release-gate.cjs');

test('fund audit keeps stored ownership and AUM candidates separate from investment-derived candidates', () => {
  const { auditHomeFundProjection } = require(scriptPath);
  const result = auditHomeFundProjection({
    asset: { asset_code: 'A1', name: 'Asset 1' },
    funds: [{
      fund_code: 'F1', name: 'Fund 1', ownership_ratio: 0.75,
      aum_krw: 1_000,
    }],
    investments: [
      {
        tranche: '1종', beneficiary_name: '기관 A',
        agreed_amount_krw: 600, contributed_amount_krw: 500,
      },
      {
        tranche: '2종', beneficiary_name: '기관 B',
        agreed_amount_krw: 400, contributed_amount_krw: 350,
      },
    ],
  });

  assert.equal(result.funds[0].ownership_ratio, 0.75);
  assert.deepEqual(result.funds[0].direct_aum_candidates, [{ field: 'aum_krw', value: 1000 }]);
  assert.equal(result.investment_totals.agreed_amount_krw, 1000);
  assert.equal(result.investment_totals.contributed_amount_krw, 850);
  assert.deepEqual(result.investments.map((row) => row.tranche), ['1종', '2종']);
  assert.equal(result.aum_candidate_evidence.direct_field_count, 1);
  assert.equal(result.aum_candidate_evidence.derived_candidate_count, 2);
});

test('missing direct AUM is explicit and is never silently replaced by agreed or contributed totals', () => {
  const { auditHomeFundProjection } = require(scriptPath);
  const result = auditHomeFundProjection({
    asset: { asset_code: 'A2', name: 'Asset 2' },
    funds: [{ fund_code: 'F2', name: 'Fund 2', ownership_ratio: null }],
    investments: [{ agreed_amount_krw: 100, contributed_amount_krw: 80 }],
  });

  assert.equal(result.aum_candidate_evidence.direct_field_count, 0);
  assert.equal(result.aum_candidate_evidence.direct_aum_missing, true);
  assert.equal(result.investment_totals.agreed_amount_krw, 100);
  assert.equal(result.investment_totals.contributed_amount_krw, 80);
  assert.equal(Object.hasOwn(result.funds[0], 'aum_krw'), false);
});

test('generic tranche cause distinguishes an API-stored value from a UI fallback', () => {
  const { auditHomeFundProjection, classifyGenericTrancheCause } = require(scriptPath);
  const stored = auditHomeFundProjection({
    asset: { asset_code: 'A190002001', name: '분당야탑물류센터' },
    funds: [],
    investments: [{ tranche: '수익자', beneficiary_name: '쿠팡' }],
  });
  const missing = auditHomeFundProjection({
    asset: { asset_code: 'A190002001', name: '분당야탑물류센터' },
    funds: [],
    investments: [{ tranche: null, beneficiary_name: null }],
  });

  assert.equal(classifyGenericTrancheCause(stored), 'api_stored_generic_tranche');
  assert.equal(classifyGenericTrancheCause(missing), 'tranche_missing_not_generic');
});

test('live matrix is fail-closed read-only for exactly 19 home documents', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  assert.match(source, /expectedAssetCount\s*=\s*19/u);
  assert.match(source, /v2\/home\/read/u);
  assert.match(source, /database_write_used:\s*false/u);
  assert.match(source, /raw_fund_keys/u);
  assert.match(source, /raw_investment_keys/u);
  assert.match(source, /A190002001/u);
  assert.doesNotMatch(source, /batch-save|batch_save|finance\/read|rent-roll\/read/u);
});

test('release gate retains the AUM, tranche, expense-item, and NOI cutover contracts', () => {
  const source = fs.readFileSync(releaseGatePath, 'utf8');
  for (const marker of [
    'fund-aum-tranche-noi-contract',
    'tests/logistics-fund-aum-tranche-noi-contract.test.cjs',
    'home-fund-investment-presentation',
    'tests/logistics-home-fund-investment-presentation.test.cjs',
    'rent-roll-cost-addable-multiselect',
    'tests/logistics-rent-roll-cost-addable-multiselect.test.cjs',
    'home-fund-aum-live-audit-unit',
    'tests/logistics-home-fund-aum-live-audit.test.cjs',
    'finance-presentation-hierarchy',
    'tests/logistics-finance-presentation-hierarchy.test.cjs',
    'finance-custom-accounts',
    'tests/logistics-data-platform-finance-custom-accounts.test.cjs',
  ]) assert.match(source, new RegExp(marker, 'u'), `missing release contract ${marker}`);
});
