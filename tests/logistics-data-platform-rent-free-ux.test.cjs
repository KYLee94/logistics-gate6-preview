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

function extractedFunction(name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start);
  assert.ok(start >= 0 && end > start, `${name} 함수 추출 실패`);
  return new Function(`${source.slice(start, end)}\nreturn ${name};`)();
}

test('렌트롤 모든 직접 숫자 입력은 포커스 밖에서 콤마를 표시하고 포커스 중 원본 의미값을 편집한다', () => {
  const numberColumns = [...schemaSource.matchAll(/column\('([^']+)'[^\n]+?'number'/gu)]
    .map((match) => match[1]);
  assert.ok(numberColumns.length >= 10, '렌트롤 숫자 열 전체를 검증할 수 있어야 한다');
  assert.doesNotMatch(source, /RENT_ROLL_(?:MONEY|AREA|COMMA_NUMBER)_FIELDS/u);
  assert.match(source, /function\s+formatRentRollCommaInput\s*\(/u);
  const formatInput = extractedFunction('formatRentRollCommaInput', 'formatRentRollReadonlyValue');
  assert.equal(formatInput('1234567.89'), '1,234,567.89');
  assert.equal(formatInput('-1234.50'), '-1,234.50');
  assert.equal(formatInput(''), '');
  assert.match(source, /parseRentRollMoneyInput,/u);
  assert.match(schemaSource, /function\s+parseRentRollMoneyInput\s*\(/u);
  const numberInput = source.slice(
    source.indexOf('function RentRollCommaNumberInput'),
    source.indexOf('function percentInputValue'),
  );
  assert.match(numberInput, /const \[focused, setFocused\] = useState\(false\)/u);
  assert.match(numberInput, /focused\s*\?\s*parseRentRollMoneyInput\(value\)\s*:\s*formatRentRollCommaInput\(value\)/u);
  assert.match(numberInput, /type=["']text["']/u);
  assert.match(numberInput, /inputMode=["']decimal["']/u);
  assert.match(numberInput, /onFocus=\{\(\) => setFocused\(true\)\}/u);
  assert.match(numberInput, /onBlur=\{\(\) => setFocused\(false\)\}/u);
  assert.match(numberInput, /onChange\(parseRentRollMoneyInput\(event\.target\.value\)\)/u);
  assert.match(source, /const\s+commaNumberField\s*=\s*column\.kind\s*===\s*["']number["']/u);
  assert.match(source, /<RentRollCommaNumberInput/u);
});

test('렌트롤 인상률은 fraction readback을 화면 퍼센트로 바꾸고 편집값을 명시적 %로 저장한다', () => {
  const inputValue = extractedFunction('percentInputValue', 'percentStoredValue');
  const storedValue = extractedFunction('percentStoredValue', 'formatRentRollCommaInput');
  assert.equal(inputValue(0.03), '3');
  assert.equal(inputValue('0.03'), '3');
  assert.equal(inputValue('3%'), '3');
  assert.equal(inputValue(3), '3');
  assert.equal(inputValue(0), '0');
  assert.equal(inputValue(''), '');
  assert.equal(storedValue('3'), '3%');
  assert.equal(storedValue(''), '');
  assert.match(source, /value=\{percentInputValue\(row\[column\.key\]\)\}/u);
  assert.match(source, /percentStoredValue\(event\.target\.value\)/u);
});

test('렌트롤 다중 붙여넣기도 소수 인상률을 퍼센트 단위로 정규화한다', () => {
  const inputValue = extractedFunction('percentInputValue', 'percentStoredValue');
  const storedValue = extractedFunction('percentStoredValue', 'formatRentRollCommaInput');
  assert.equal(storedValue(inputValue('0.03')), '3%');
  assert.equal(storedValue(inputValue('3')), '3%');
  assert.equal(storedValue(inputValue('3%')), '3%');

  const pasteSource = source.slice(
    source.indexOf('function parsePaste'),
    source.indexOf('function RentRollPanel'),
  );
  assert.match(
    pasteSource,
    /percentStoredValue\(percentInputValue\(trimmed\)\)/u,
  );
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
  assert.match(source, /label:\s*["']Fit-out 개월["']/u);
  assert.match(source, /calculateRentFreePeriodMonths/u);
  assert.match(source, new RegExp('nextFields\\.fit_out_months\\s*=\\s*calculatedMonths', 'u'));
  assert.match(source, new RegExp("disabled=\\{[\\s\\S]{0,180}column\\.key === [\"']fit_out_months[\"']", "u"));
  assert.doesNotMatch(source, /function\s+FitOutPeriodCell\s*\(/u);
});
