const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  'utf8',
);
const schemaSource = fs.readFileSync(
  path.resolve(__dirname, '../src/features/logistics-data-platform/rentRollSchema.js'),
  'utf8',
);

test('렌트롤 금액 입력은 숫자 의미를 보존하며 3자리 콤마로 표시한다', () => {
  assert.match(source, /const\s+RENT_ROLL_MONEY_FIELDS\s*=\s*new Set/u);
  const moneyFieldStart = source.indexOf('const RENT_ROLL_MONEY_FIELDS');
  const moneyFieldEnd = source.indexOf(']);', moneyFieldStart);
  const moneyFields = [...source.slice(moneyFieldStart, moneyFieldEnd).matchAll(/"([a-z0-9_]+)"/gu)]
    .map((match) => match[1]);
  assert.deepEqual(moneyFields, [
    'deposit_total_krw',
    'monthly_rent_total_krw',
    'monthly_cam_total_krw',
    'pallet_rack_fee',
    'fit_out_amount',
    'tenant_improvement_amount',
  ]);
  assert.match(source, /function\s+formatRentRollMoneyInput\s*\(/u);
  assert.match(source, /parseRentRollMoneyInput,/u);
  assert.match(schemaSource, /function\s+parseRentRollMoneyInput\s*\(/u);
  assert.match(source, /inputMode=\{moneyField \? ["']numeric["'] : undefined\}/u);
  assert.match(source, /formatRentRollMoneyInput\(row\[column\.key\]\)/u);
  assert.match(source, /parseRentRollMoneyInput\(event\.target\.value\)/u);
});

test('렌트프리는 접근 가능한 상세 팝업에서 복수 제공기간을 추가·삭제한다', () => {
  const displayColumns = source.slice(
    source.indexOf('const RENT_ROLL_DISPLAY_COLUMNS'),
    source.indexOf('const FINANCE_PERIOD_PRESETS'),
  );
  assert.match(displayColumns, /\["rent_free_start_date",\s*"rent_free_end_date"\]\.includes\(column\.key\)\)\s*return\s*\[\]/u);
  assert.match(displayColumns, /column\.key\s*===\s*["']rent_free_months["'][\s\S]*?label:\s*["']렌트프리 세부["']/u);
  assert.equal((displayColumns.match(/column\.key\s*===\s*["']rent_free_months["']/gu) || []).length, 1);
  assert.match(source, /function\s+RentFreePeriodsDialog\s*\(/u);
  assert.match(source, /data-testid=["']rent-free-details["']/u);
  assert.match(source, /data-testid=["']rent-free-period-dialog["']/u);
  assert.match(source, /role=["']dialog["']/u);
  assert.match(source, /aria-modal=["']true["']/u);
  assert.match(source, /렌트프리 기간 추가/u);
  assert.match(source, /렌트프리 기간 삭제/u);
  assert.match(source, /rent_free_periods/u);
  assert.doesNotMatch(source, /상세에서 입력/u);
});

test('Fit-out은 시작일과 종료일을 별도 입력하고 개월 수를 함께 계산한다', () => {
  assert.match(source, /const\s+RENT_ROLL_DISPLAY_COLUMNS/u);
  assert.match(source, /fit_out_start_date/u);
  assert.match(source, /fit_out_end_date/u);
  assert.match(source, /Fit-out 시작일/u);
  assert.match(source, /Fit-out 종료일/u);
  assert.match(source, /calculatePeriodMonths/u);
  assert.doesNotMatch(source, /function\s+FitOutPeriodCell\s*\(/u);
});
