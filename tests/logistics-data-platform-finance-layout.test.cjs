const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  'utf8',
);

test('수익비용 누계 요약은 가로 KPI 중복 없이 단일 비교표로 제공한다', () => {
  assert.doesNotMatch(source, /data-testid=["']finance-kpi-strip["']/u);
  assert.match(source, /data-testid=["']finance-period-summary["']/u);
  assert.match(source, /기간 누계 · 자산 비교/u);
  assert.match(source, /<col className="w-\[34%\]"\s*\/>/u);
  assert.match(source, /<col className="w-\[22%\]"\s*\/>/u);
});

test('NOI·NCF 시계열과 기간 누계 자산 비교가 입력표보다 먼저 좌우로 배치된다', () => {
  const statementIndex = source.indexOf('data-testid="finance-statement-table"');
  const summaryIndex = source.indexOf('data-testid="finance-period-summary"');
  const trendIndex = source.indexOf('<FinanceTrend');
  assert.ok(statementIndex > 0, '월별 NOI 입력표가 필요합니다.');
  assert.ok(trendIndex > 0 && trendIndex < summaryIndex, '시계열은 상단 좌측에 있어야 합니다.');
  assert.ok(summaryIndex < statementIndex, '누계 자산 비교는 상단 우측에 있어야 합니다.');
  assert.match(source, /data-testid=["']finance-analysis-grid["']/u);
  assert.match(source, /xl:grid-cols-\[minmax\(0,1\.22fr\)_minmax\(420px,0\.78fr\)\]/u);
  assert.match(source, /min-w-\[264px\]/u);
  assert.match(source, /min-w-\[104px\]/u);
  assert.doesNotMatch(source, /min-w-\[250px\]/u);
  assert.doesNotMatch(source, /min-w-\[135px\]/u);
});

test('기간 프리셋과 직접 지정, 비교 자산 다중 선택을 지원한다', () => {
  assert.match(source, /const\s+FINANCE_PERIOD_PRESETS\s*=\s*Object\.freeze/u);
  for (const label of ['최근 1개월', '최근 3개월', '최근 6개월', '최근 1년', '직접 지정']) {
    assert.ok(source.includes(label), `기간 프리셋 누락: ${label}`);
  }
  assert.match(source, /data-testid=["']finance-period-preset["']/u);
  assert.match(source, /const\s+\[comparisonKeys,\s*setComparisonKeys\]/u);
  assert.match(source, /data-testid=["']finance-comparison-asset-toggle["']/u);
  assert.match(source, /type=["']checkbox["']/u);
  assert.match(source, /function\s+FinanceComparisonLoader\s*\(/u);
});

test('기본 NOI 계정 목록은 하나의 상수 계약으로 초기화한다', () => {
  assert.match(source, /const\s+DEFAULT_FINANCE_ACCOUNT_CODES\s*=\s*Object\.freeze/u);
  assert.match(source, /new Set\(DEFAULT_FINANCE_ACCOUNT_CODES\)/u);
});

test('NOI 계정 선택은 별도 선택칸이 아니라 손익표 첫 열에서 직접 수행한다', () => {
  const statementStart = source.indexOf('data-testid="finance-statement-table"');
  const statementEnd = source.indexOf('</table>', statementStart);
  const statement = source.slice(statementStart, statementEnd);

  assert.doesNotMatch(source, /data-testid="finance-account-picker"/u);
  assert.match(statement, /data-testid="finance-account-toggle"/u);
  assert.match(statement, /data-finance-account-active=/u);
  assert.match(statement, /미사용 계정/u);
  assert.match(statement, /disabled=\{!writeEnabled \|\| !row\.active\}/u);
  assert.match(source, /accountToggleRefs/u);
  assert.match(source, /pendingAccountFocusRef/u);
  assert.match(source, /finance-account-selection-status/u);
  assert.match(source, /filterFinanceCalculationAccounts/u);
  assert.match(source, /buildFinanceSeries\(entries, calculationAccounts/u);
  assert.doesNotMatch(statement, /setEntries[\s\S]{0,160}finance-account-toggle/u);
});
