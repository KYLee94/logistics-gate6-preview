const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  browserCloneHomeData,
  buildIncidentHomeDocumentPayload,
  collectTypeDiffs,
  validateHomeNestedNumbers,
} = require('../scripts/qa/logistics-home-422-readonly-diagnostic.cjs');

const fixture = {
  asset: {
    asset_code: 'A112527001',
    fund_code: '112527',
    land_area_sqm: 54990,
  },
  funds: [{ fund_code: '112527' }],
  investments: [{
    fund_code: '112527',
    tranche: 'fixture',
    beneficiary_name: 'fixture',
  }],
  loans: [{
    fund_code: '112527',
    tranche: 'fixture',
    lender_name: 'fixture',
    committed_amount_krw: 1,
  }],
};

test('브라우저 clone 경로가 누락된 중첩 숫자를 빈 문자열로 만들면 SQL 계약이 422로 거부한다', async () => {
  const { buildHomeDocumentPayload } = await import(
    '../src/features/logistics-data-platform/documentContract.js'
  );
  const canonicalReadDocument = buildHomeDocumentPayload(fixture);
  const browserDraft = browserCloneHomeData(fixture);
  browserDraft.asset.land_area_sqm = '54991';
  const browserDocument = buildIncidentHomeDocumentPayload(browserDraft);

  const violations = validateHomeNestedNumbers(browserDocument);
  assert.deepEqual(violations.map(({ code }) => code), [
    'INVESTMENT_AMOUNT_INVALID',
    'INVESTMENT_AMOUNT_INVALID',
    'LOAN_NUMBER_INVALID',
    'LOAN_NUMBER_INVALID',
  ]);
  assert.equal(browserDocument.asset.land_area_sqm, '54991');
  assert.equal(violations.every(({ actual_type }) => actual_type === 'string'), true);

  const diffs = collectTypeDiffs(canonicalReadDocument, browserDocument);
  assert.equal(diffs.some((item) => (
    item.path === 'funds[0].investments[0].agreed_amount_krw'
      && item.read_type === 'missing'
      && item.browser_type === 'string'
  )), true);
  assert.equal(diffs.some((item) => (
    item.path === 'funds[0].loans[0].coupon_rate'
      && item.read_type === 'missing'
      && item.browser_type === 'string'
  )), true);
});

test('동일 중첩 숫자를 null로 정규화하면 SQL 숫자 타입 계약을 통과한다', async () => {
  const browserDraft = browserCloneHomeData(fixture);
  for (const row of browserDraft.investments) {
    row.agreed_amount_krw = null;
    row.contributed_amount_krw = null;
  }
  for (const row of browserDraft.loans) {
    row.coupon_rate = null;
    row.all_in_rate = null;
  }
  assert.deepEqual(validateHomeNestedNumbers(buildIncidentHomeDocumentPayload(browserDraft)), []);
});

test('현재 문서 빌더는 같은 브라우저 초안을 누락 또는 숫자로 정규화한다', async () => {
  const { buildHomeDocumentPayload } = await import(
    '../src/features/logistics-data-platform/documentContract.js'
  );
  const browserDraft = browserCloneHomeData(fixture);
  browserDraft.asset.land_area_sqm = '54991';
  const document = buildHomeDocumentPayload(browserDraft);
  assert.equal(document.asset.land_area_sqm, 54991);
  assert.deepEqual(validateHomeNestedNumbers(document), []);
});

test('타입 차이 증거에는 원문 값이 포함되지 않는다', () => {
  const diffs = collectTypeDiffs(
    { funds: [{ investments: [{}] }] },
    { funds: [{ investments: [{ agreed_amount_krw: '' }] }] },
  );
  assert.deepEqual(diffs, [{
    path: 'funds[0].investments[0].agreed_amount_krw',
    read_type: 'missing',
    browser_type: 'string',
  }]);
  assert.equal(JSON.stringify(diffs).includes('54990'), false);
});

test('프런트 clone, 현재 정규화, SQL PT422, Edge 422 매핑이 같은 원인 사슬을 고정한다', () => {
  const root = path.resolve(__dirname, '..');
  const frontend = fs.readFileSync(
    path.join(root, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
    'utf8',
  );
  const contract = fs.readFileSync(
    path.join(root, 'src/features/logistics-data-platform/documentContract.js'),
    'utf8',
  );
  const migration = fs.readFileSync(
    path.join(root, 'supabase/migrations/20260807180000_simplify_logistics_core_to_four_ui_tables.sql'),
    'utf8',
  );
  const router = fs.readFileSync(
    path.join(root, 'supabase/functions/ll-dashboard-api/v2/router.ts'),
    'utf8',
  );

  assert.match(frontend, /coupon_rate:\s*row\.coupon_rate\s*\?\?\s*row\.loan_rate\s*\?\?\s*row\.interest_rate\s*\?\?\s*["']{2}/u);
  assert.match(frontend, /all_in_rate:\s*row\.all_in_rate\s*\?\?\s*row\.all_in\s*\?\?\s*["']{2}/u);
  assert.match(contract, /function\s+canonicalLoan[\s\S]*canonicalHomeNumber[\s\S]*if\s*\(numeric\s*===\s*null\)\s*delete\s+row\[field\]/u);
  assert.match(migration, /array\['committed_amount_krw',\s*'coupon_rate',\s*'all_in_rate',\s*'fee_rate'\][\s\S]*LOAN_NUMBER_INVALID/u);
  assert.match(migration, /assert_investments_valid\(v_fund_document->'investments'\)[\s\S]*assert_loans_valid\(v_fund_document->'loans'\)/u);
  assert.match(router, /code\s*===\s*'PT422'[\s\S]*httpStatus:\s*422,\s*code:\s*'BUSINESS_RULE_VIOLATION',\s*retryable:\s*false/u);
});
