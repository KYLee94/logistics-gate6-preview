const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const HELPER_PATH = path.join(ROOT, 'src/features/logistics-data-platform/homeInvestmentPresentation.js');
const FRONTEND_PATH = path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
const CONTRACT_PATH = path.join(ROOT, 'src/features/logistics-data-platform/documentContract.js');

async function presentation() {
  return import(`${pathToFileURL(HELPER_PATH).href}?home-investment=${Date.now()}-${Math.random()}`);
}

test('종 구분은 네 기본값과 현재 사용자 항목을 단일 scalar로 표시한다', async () => {
  const {
    HOME_SHARE_CLASS_OPTIONS,
    homeShareClassOptions,
    homeShareClassPresentation,
  } = await presentation();

  assert.deepEqual(HOME_SHARE_CLASS_OPTIONS, [
    '보통주', '1종 종류주', '2종 종류주', '3종 종류주',
  ]);
  assert.deepEqual(homeShareClassOptions('우선주 A'), [
    ...HOME_SHARE_CLASS_OPTIONS,
    '우선주 A',
  ]);
  assert.deepEqual(homeShareClassPresentation(' 2종 종류주 '), {
    rawValue: '2종 종류주',
    displayValue: '2종 종류주',
    displayLabel: '2종 종류주',
    requiresClassification: false,
  });
});

test('generic 수익자는 원문을 보존하되 종 구분 값으로 표시하지 않는다', async () => {
  const { homeShareClassOptions, homeShareClassPresentation } = await presentation();
  assert.deepEqual(homeShareClassPresentation('수익자'), {
    rawValue: '수익자',
    displayValue: '',
    displayLabel: '분류 확인 필요',
    requiresClassification: true,
  });
  assert.equal(homeShareClassOptions('수익자').includes('수익자'), false);
});

test('한 수익증권 행에 추가한 종 구분은 같은 펀드의 다른 행 선택지로 재사용한다', async () => {
  const { HOME_SHARE_CLASS_OPTIONS, homeShareClassOptionsFromInvestments } = await presentation();
  assert.deepEqual(homeShareClassOptionsFromInvestments([
    { tranche: '  우선주 A  ' },
    { tranche: '수익자' },
    { tranche: '우선주 A' },
    { tranche: '전환우선주' },
    { tranche: '' },
  ]), [
    ...HOME_SHARE_CLASS_OPTIONS,
    '우선주 A',
    '전환우선주',
  ]);
});

test('홈 수익증권 종 구분은 선택과 항목 추가 UI를 사용하고 scalar tranche를 수정한다', () => {
  const source = fs.readFileSync(FRONTEND_PATH, 'utf8');
  const investmentStart = source.indexOf('수익증권');
  const investmentTable = source.slice(investmentStart, source.indexOf('</Section>', investmentStart));
  assert.match(source, /function AddableSingleSelectCell/u);
  assert.match(source, /homeShareClassPresentation/u);
  assert.match(source, /placeholder="종 구분 항목 추가"/u);
  assert.match(source, /homeShareClassOptionsFromInvestments\(investments\)/u);
  assert.match(investmentTable, /options=\{investmentShareClassOptions\}/u);
  assert.match(investmentTable, /updateHomeDraft\("beneficiary", investmentIndex, "tranche", value\)/u);
  assert.doesNotMatch(investmentTable, /\["tranche", "text"\]/u);
});

test('펀드 AUM은 aum_krw 직접값만 원 단위 숫자로 저장하고 ownership_ratio를 제거한다', async () => {
  const { buildHomeDocumentPayload } = await import(
    `${pathToFileURL(CONTRACT_PATH).href}?home-aum=${Date.now()}-${Math.random()}`
  );
  const payload = buildHomeDocumentPayload({
    asset: { asset_code: 'A1', fund_code: 'F1' },
    funds: [{ fund_code: 'F1', aum_krw: '1,250,000', ownership_ratio: 0.5 }],
    investments: [{ fund_code: 'F1', agreed_amount_krw: 10_000_000, contributed_amount_krw: 8_000_000 }],
  });

  assert.equal(payload.funds[0].aum_krw, 1_250_000);
  assert.equal(Object.hasOwn(payload.funds[0], 'ownership_ratio'), false);

  const withoutDirectAum = buildHomeDocumentPayload({
    asset: { asset_code: 'A1', fund_code: 'F1' },
    funds: [{ fund_code: 'F1' }],
    investments: [{ fund_code: 'F1', agreed_amount_krw: 10_000_000, contributed_amount_krw: 8_000_000 }],
  });
  assert.equal(Object.hasOwn(withoutDirectAum.funds[0], 'aum_krw'), false);
});

test('펀드 표는 지분율 편집 없이 AUM 원 단위 직접 입력을 제공한다', () => {
  const source = fs.readFileSync(FRONTEND_PATH, 'utf8');
  const fundStart = source.indexOf('펀드·수익증권 투자');
  const fundSection = source.slice(fundStart, source.indexOf('</Section>', fundStart));

  assert.match(fundSection, /"AUM\(원\)"/u);
  assert.match(fundSection, /\["aum_krw", "number"\]/u);
  assert.doesNotMatch(fundSection, /지분율|ownership_ratio/u);
});
