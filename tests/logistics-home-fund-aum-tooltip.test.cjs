'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  'utf8',
);

test('홈 펀드 AUM 헤더는 정확한 기준일을 기존 비고정 정보 tooltip으로 안내한다', () => {
  assert.match(source, /const HOME_FUND_AUM_INFO = "2026년 07월 31일 기준";/u);
  const headerStart = source.indexOf('AUM(원)');
  assert.notEqual(headerStart, -1);
  const header = source.slice(headerStart - 500, headerStart + 900);
  assert.match(header, /<GoodsInfoTooltip/u);
  assert.match(header, /ariaLabel="AUM 기준일 안내"/u);
  assert.match(header, /content=\{HOME_FUND_AUM_INFO\}/u);
});

test('AUM 안내는 저장 값과 무관한 표시 정보이고 hover·focus-visible만 열리며 즉시 닫힌다', () => {
  const start = source.indexOf('function GoodsInfoTooltip');
  const end = source.indexOf('function AddableMultiSelectCell', start);
  const tooltip = source.slice(start, end);
  assert.match(tooltip, /content = null/u);
  assert.match(tooltip, /onPointerEnter=\{openTooltip\}/u);
  assert.match(tooltip, /onPointerLeave=\{closeTooltip\}/u);
  assert.match(tooltip, /matches\(":focus-visible"\)/u);
  assert.match(tooltip, /onBlur=\{closeTooltip\}/u);
  assert.match(tooltip, /closeTooltip\(\);\s*event\.currentTarget\.blur/u);
  assert.match(tooltip, /aria-describedby=\{tooltipId\}/u);
  assert.match(tooltip, /role="tooltip"/u);
  assert.match(tooltip, /\{content \? \(/u);
  assert.doesNotMatch(headerSource(), /onChange|aum_krw/u);
});

function headerSource() {
  const headerStart = source.lastIndexOf('<thead', source.indexOf('AUM(원)'));
  const headerEnd = source.indexOf('</thead>', headerStart);
  return source.slice(headerStart, headerEnd);
}
