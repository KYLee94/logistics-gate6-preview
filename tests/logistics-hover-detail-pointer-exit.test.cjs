const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const INTERACTION_PATH = path.join(
  ROOT,
  'src/components/system/workspace/hoverDetailInteraction.js',
);
const STACKING_PATH = path.join(
  ROOT,
  'src/components/system/workspace/StackingPlan.jsx',
);
const PLATFORM_PATH = path.join(
  ROOT,
  'src/features/logistics-data-platform/LogisticsDataPlatform.jsx',
);

async function interaction() {
  return import(`${pathToFileURL(INTERACTION_PATH).href}?hover-detail=${Date.now()}-${Math.random()}`);
}

test('pointer leave closes hover detail regardless of click or keyboard focus state', async () => {
  const { hoverDetailVisibility } = await interaction();

  let visible = hoverDetailVisibility(false, 'pointer-enter');
  assert.equal(visible, true);
  visible = hoverDetailVisibility(visible, 'click');
  assert.equal(visible, false);

  visible = hoverDetailVisibility(false, 'keyboard-focus');
  assert.equal(visible, true);
  visible = hoverDetailVisibility(visible, 'pointer-leave');
  assert.equal(visible, false);
});

test('stacking tooltip uses explicit pointer exit and keyboard focus instead of sticky focus-within CSS', () => {
  const source = fs.readFileSync(STACKING_PATH, 'utf8');

  assert.match(source, /onPointerEnter:\s*openTooltip/u);
  assert.match(source, /onPointerLeave:\s*closeTooltip/u);
  assert.match(source, /matches\(["']:focus-visible["']\)/u);
  assert.match(source, /onClick=\{handleClick\}/u);
  assert.doesNotMatch(source, /group-focus-within\/tenant/u);
});

test('finance trend hover detail already closes on pointer exit and keeps keyboard focus access', () => {
  const source = fs.readFileSync(PLATFORM_PATH, 'utf8');
  const start = source.indexOf('function FinanceTrend');
  const end = source.indexOf('function FinancePanel', start);
  const financeTrend = source.slice(start, end);

  assert.match(financeTrend, /onMouseLeave=\{\(\)\s*=>\s*setActiveIndex\(null\)\}/u);
  assert.match(financeTrend, /onFocus=\{\(\)\s*=>\s*setActiveIndex\(index\)\}/u);
  assert.match(financeTrend, /onBlur=\{\(\)\s*=>\s*setActiveIndex\(null\)\}/u);
});
