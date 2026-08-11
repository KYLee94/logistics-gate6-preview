const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND_PATH = path.join(
  ROOT,
  'src/features/logistics-data-platform/LogisticsDataPlatform.jsx',
);
const ALIGNMENT_PATH = path.join(
  ROOT,
  'src/features/logistics-data-platform/homeFundTableAlignment.js',
);

async function alignmentContract() {
  return import(
    `${pathToFileURL(ALIGNMENT_PATH).href}?home-fund-alignment=${Date.now()}-${Math.random()}`
  );
}

test('home fund tables align names left, KRW amounts right, and all other cells center', async () => {
  const { homeFundTableCellAlign } = await alignmentContract();

  for (const field of ['name', 'beneficiary_name', 'lender_name']) {
    assert.equal(homeFundTableCellAlign(field), 'left');
  }
  for (const field of [
    'aum_krw',
    'agreed_amount_krw',
    'contributed_amount_krw',
    'committed_amount_krw',
  ]) {
    assert.equal(homeFundTableCellAlign(field), 'right');
  }
  for (const field of [
    'fund_type',
    'investment_strategy',
    'inception_date',
    'maturity_date',
    'tranche',
    'drawdown_date',
    'loan_type',
    'interest_type',
    'coupon_rate',
    'all_in_rate',
    'fee_rate',
  ]) {
    assert.equal(homeFundTableCellAlign(field), 'center');
  }
});

test('all three home fund table headers are centered and body cells use the alignment contract', () => {
  const source = fs.readFileSync(FRONTEND_PATH, 'utf8');
  const fundSectionStart = source.indexOf('<Section title="펀드·수익증권 투자"');
  const fundSection = source.slice(
    fundSectionStart,
    source.indexOf('</Section>', fundSectionStart),
  );
  const loanSectionStart = source.indexOf('<Section title="대출 현황">');
  const loanSection = source.slice(
    loanSectionStart,
    source.indexOf('</Section>', loanSectionStart),
  );

  assert.ok(fundSectionStart >= 0, 'fund section must exist');
  assert.ok(loanSectionStart >= 0, 'loan section must exist');
  assert.equal(
    (fundSection.match(/<th[\s\S]*?className="[^"]*text-center[^"]*"/gu) || []).length,
    2,
    'fund and investment header maps must both center their headings',
  );
  assert.equal(
    (loanSection.match(/<th[\s\S]*?className="[^"]*text-center[^"]*"/gu) || []).length,
    1,
    'loan header map must center its headings',
  );
  assert.match(fundSection, /align=\{homeFundTableCellAlign\(field\)\}/u);
  assert.match(fundSection, /align=\{homeFundTableCellAlign\("tranche"\)\}/u);
  assert.match(loanSection, /align=\{homeFundTableCellAlign\(field\)\}/u);
});

test('HomeValue and the addable share-class cell support explicit center alignment', () => {
  const source = fs.readFileSync(FRONTEND_PATH, 'utf8');
  const homeValue = source.slice(
    source.indexOf('function HomeValue'),
    source.indexOf('function AddableSingleSelectCell'),
  );
  const shareClassCell = source.slice(
    source.indexOf('function AddableSingleSelectCell'),
    source.indexOf('function MaturityList'),
  );

  assert.match(homeValue, /homeValueAlignClass\(align\)/u);
  assert.match(shareClassCell, /align = "left"/u);
  assert.match(shareClassCell, /homeValueAlignClass\(align\)/u);
});
