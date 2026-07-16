const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const componentPath = path.join(__dirname, '..', 'src', 'components', 'system', 'IotaLeftNav.jsx');
const source = fs.readFileSync(componentPath, 'utf8');

const LOGISTICS_NAV_GROUPS = [
  'dashboard',
  'marketData',
  'dataManagement',
];

test('logistics submenu groups always start closed without reading legacy session storage values', () => {
  for (const group of LOGISTICS_NAV_GROUPS) {
    assert.match(source, new RegExp(`const \\[isLogistics${group[0].toUpperCase()}${group.slice(1)}Open, setIsLogistics${group[0].toUpperCase()}${group.slice(1)}Open\\] = useState\\(false\\);`, 'u'));
  }

  assert.doesNotMatch(source, /sessionStorage\.getItem\('isLogistics(?:Dashboard|MarketData|DataManagement)Open'\)/u);
  assert.doesNotMatch(source, /sessionStorage\.setItem\('isLogistics(?:Dashboard|MarketData|DataManagement)Open'/u);
});

test('each logistics submenu group gets an independent 60-second resettable auto-collapse timer', () => {
  assert.match(source, /const LOGISTICS_NAV_AUTO_COLLAPSE_MS = 60_000;/u);
  assert.match(source, /const logisticsNavAutoCollapseTimersRef = useRef\(\{\}\);/u);
  assert.match(source, /const resetLogisticsNavAutoCollapseTimer = useCallback\(\(group\) => \{/u);
  assert.match(source, /window\.setTimeout\(\(\) => \{[\s\S]*?setLogisticsNavGroupOpen\(group, false\);[\s\S]*?\}, LOGISTICS_NAV_AUTO_COLLAPSE_MS\)/u);
  assert.match(source, /const clearLogisticsNavAutoCollapseTimer = useCallback\(\(group\) => \{/u);
  assert.match(source, /clearLogisticsNavAutoCollapseTimer\(group\);[\s\S]*?logisticsNavAutoCollapseTimersRef\.current\[group\] = window\.setTimeout/u);
  assert.match(source, /const handleLogisticsNavGroupInteraction = useCallback\(\(group, isOpen\) => \{/u);
  assert.match(source, /if \(isOpen\) resetLogisticsNavAutoCollapseTimer\(group\);/u);
});

test('group interaction resets only that group timer and unmount clears every timer', () => {
  for (const group of LOGISTICS_NAV_GROUPS) {
    assert.match(source, new RegExp(`handleLogisticsNavGroupInteraction\\('${group}', isLogistics`, 'u'));
  }

  assert.match(source, /Object\.values\(logisticsNavAutoCollapseTimersRef\.current\)\.forEach\(\(timer\) => window\.clearTimeout\(timer\)\)/u);
  assert.match(source, /duration-300 ease-\[cubic-bezier\(0\.16,1,0\.3,1\)\]/u);
});
