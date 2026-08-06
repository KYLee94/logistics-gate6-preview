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

test('월별 NOI 입력표가 요약 시각화보다 먼저 나오고 기본 12개월 폭을 줄인다', () => {
  const statementIndex = source.indexOf('data-testid="finance-statement-table"');
  const summaryIndex = source.indexOf('data-testid="finance-period-summary"');
  const trendIndex = source.indexOf('<FinanceTrend');
  assert.ok(statementIndex > 0, '월별 NOI 입력표가 필요합니다.');
  assert.ok(summaryIndex > statementIndex, '누계 요약은 월별 입력표 뒤에 있어야 합니다.');
  assert.ok(trendIndex > summaryIndex, '시계열 차트는 누계 요약과 함께 입력표 뒤에 있어야 합니다.');
  assert.match(source, /min-w-\[224px\]/u);
  assert.match(source, /min-w-\[104px\]/u);
  assert.doesNotMatch(source, /min-w-\[250px\]/u);
  assert.doesNotMatch(source, /min-w-\[135px\]/u);
});
