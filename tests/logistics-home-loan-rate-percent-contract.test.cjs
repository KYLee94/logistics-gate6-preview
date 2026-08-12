const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const featureDir = path.resolve(__dirname, '../src/features/logistics-data-platform');
const platformSource = fs.readFileSync(path.join(featureDir, 'LogisticsDataPlatform.jsx'), 'utf8');

async function loanRateContract() {
  const modulePath = path.join(featureDir, 'homeLoanRates.js');
  return import(`${pathToFileURL(modulePath).href}?loan-rate=${Date.now()}-${Math.random()}`);
}

async function documentContract() {
  const modulePath = path.join(featureDir, 'documentContract.js');
  return import(`${pathToFileURL(modulePath).href}?loan-rate-save=${Date.now()}-${Math.random()}`);
}

test('stored loan rates are displayed as percentage points without ratio conversion', async () => {
  const { formatHomeLoanRate, formatHomeLoanRateInput } = await loanRateContract();

  assert.equal(formatHomeLoanRate(5.25), '5.25%');
  assert.equal(formatHomeLoanRate('4.375'), '4.38%');
  assert.equal(formatHomeLoanRate(0.01), '0.01%');
  assert.equal(formatHomeLoanRate(5), '5.00%');
  assert.equal(formatHomeLoanRate(5.5), '5.50%');
  assert.equal(formatHomeLoanRate(0), '0.00%');
  assert.equal(formatHomeLoanRate(''), '—');
  assert.equal(formatHomeLoanRate(null), '—');
  assert.equal(formatHomeLoanRateInput(5), '5.00');
  assert.equal(formatHomeLoanRateInput(5.5), '5.50');
});

test('loan rate cells use decimal numeric inputs with a percent suffix and no scaling transform', () => {
  const homeValue = platformSource.slice(
    platformSource.indexOf('function HomePercentValue'),
    platformSource.indexOf('function AddableSingleSelectCell'),
  );
  const loanTable = platformSource.slice(
    platformSource.indexOf('<Section title="대출 현황">'),
    platformSource.indexOf('</Section>', platformSource.indexOf('<Section title="대출 현황">')),
  );

  assert.match(platformSource, /function HomePercentValue/u);
  assert.match(homeValue, /type=["']number["']/u);
  assert.match(homeValue, /step=["']0\.01["']/u);
  assert.match(homeValue, /onBlur=\{\(\) =>/u);
  assert.match(homeValue, /formatHomeLoanRateInput\(draft\)/u);
  assert.match(homeValue, />%<\/span>/u);
  assert.doesNotMatch(homeValue, /\*\s*100|\/\s*100/u);

  for (const field of ['coupon_rate', 'all_in_rate', 'fee_rate']) {
    assert.match(loanTable, new RegExp(`\\["${field}",\\s*"percent"\\]`, 'u'));
  }
});

test('home save keeps 3.5 percentage points unchanged for coupon, all-in, and fee rates', async () => {
  const { buildHomeDocumentPayload } = await documentContract();
  const payload = buildHomeDocumentPayload({
    asset: { asset_code: 'ASSET-PERCENT', fund_code: 'FUND-PERCENT' },
    funds: [{ fund_code: 'FUND-PERCENT' }],
    loans: [{
      fund_code: 'FUND-PERCENT',
      coupon_rate: '3.5',
      all_in_rate: '3.5',
      fee_rate: '3.5',
    }],
  });

  assert.deepEqual(payload.funds[0].loans, [{
    coupon_rate: 3.5,
    all_in_rate: 3.5,
    fee_rate: 3.5,
  }]);
});
