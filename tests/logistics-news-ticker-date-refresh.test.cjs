const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const componentPath = path.join(__dirname, '..', 'src', 'components', 'system', 'workspace', 'LogisticsNewsTicker.jsx');
const source = fs.readFileSync(componentPath, 'utf8');

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  const open = source.indexOf('{', source.indexOf(')', start));
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} does not close`);
}

test('ticker refreshes its news/list date only after a visible KST date change', () => {
  const component = extractFunction('LogisticsNewsTicker');

  assert.match(source, /const NEWS_DATE_CHECK_INTERVAL_MS = 15 \* 60 \* 1000;/u);
  assert.match(component, /const \[date, setDate\] = useState\(\(\) => kstDateKey\(\)\);/u);
  assert.match(component, /useEdgeData\('news\/list', \{ limit: 10, date \}\)/u);
  assert.match(component, /document\.visibilityState !== 'visible'/u);
  assert.match(component, /setDate\(\(current\) => \(current === nextDate \? current : nextDate\)\)/u);
});

test('ticker pauses date checks while hidden and synchronizes on visibility or focus return', () => {
  const component = extractFunction('LogisticsNewsTicker');

  assert.match(component, /if \(document\.hidden\) \{[\s\S]*window\.clearInterval\(dateCheckTimer\)/u);
  assert.match(component, /document\.addEventListener\('visibilitychange', onVisibilityChange\)/u);
  assert.match(component, /window\.addEventListener\('focus', synchronizeDate\)/u);
  assert.match(component, /startDateChecks\(\);/u);
  assert.match(component, /window\.setInterval\(synchronizeDate, NEWS_DATE_CHECK_INTERVAL_MS\)/u);
});

test('ticker retains the eight-second rotation, hover and focus pause, and reduced-motion guard', () => {
  const component = extractFunction('LogisticsNewsTicker');

  assert.match(component, /window\.setInterval\([^,]+, 8000\)/u);
  assert.match(component, /prefers-reduced-motion: reduce/u);
  assert.match(component, /onMouseEnter=\{\(\) => setPaused\(true\)\}/u);
  assert.match(component, /onFocusCapture=\{\(\) => setPaused\(true\)\}/u);
});
