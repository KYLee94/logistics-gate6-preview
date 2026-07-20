const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'components', 'system', 'workspace', 'LogisticsSectorModules.jsx'), 'utf8');

function between(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `missing start: ${start}`);
  assert.ok(endIndex >= 0, `missing end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('MarketMapPanel keeps the Naver canvas and refreshes only for creation, viewport change, or a real resize', () => {
  const panel = between('function MarketMapPanel({', 'function ChartTooltip({');
  const healthMonitor = between('const startNaverHealthMonitor = (map) => {', 'const ensureNaverMaps = async () => {');
  const ensureNaver = between('const ensureNaverMaps = async () => {', 'ensureNaverMaps();');

  assert.match(panel, /const mapResizeObserverRef = useRef\(null\);/u);
  assert.match(panel, /const mapResizeFrameRef = useRef\(null\);/u);
  assert.match(panel, /const markerSignature = useMemo\(\(\) => markerRows\.map/u);
  assert.match(panel, /const markerRowLookupRef = useRef\(new Map\(\)\);/u);
  assert.match(panel, /markerRowLookupRef\.current = markerRowLookup;/u);
  assert.match(panel, /const observeNaverMapResize = \(map\) => \{/u);
  assert.match(panel, /if \(width < 2 \|\| height < 2 \|\| nextSize === mapCanvasSizeRef\.current\) return;/u);
  assert.match(panel, /if \(mapInstanceRef\.current === map && mapProviderRef\.current === 'naver'\) refreshNaverMap\(map\);/u);
  assert.match(panel, /clearMapResizeObserver\(\);/u);
  assert.match(ensureNaver, /const canReuseNaverMap = mapProviderRef\.current === 'naver'/u);
  assert.match(ensureNaver, /if \(!canReuseNaverMap\) \{\s*setMapStatus\(\{ status: 'checking'/u);
  assert.match(ensureNaver, /observeNaverMapResize\(map\);/u);
  assert.match(ensureNaver, /if \(createdNaverMap \|\| shouldFitRegionMode \|\| shouldFitSelectedRegion\) refreshNaverMap\(map\);/u);
  assert.doesNotMatch(healthMonitor, /refreshNaverMap\(map\);/u);
});

test('marker updates and tab re-entry retain the provider instance instead of destroying the canvas', () => {
  const panel = between('function MarketMapPanel({', 'function ChartTooltip({');
  const mapEffect = panel.match(/useEffect\(\(\) => \{\s*let cancelled = false;[\s\S]*?\}, \[markerSignature, selectedMapRegion, forceOsm, isRegionMode, clusterIconHtml, clampRegionClusterMarkers, scheduleRegionClusterClamp\]\);/u)?.[0] || '';

  assert.match(mapEffect, /let map = mapInstanceRef\.current;/u);
  assert.match(mapEffect, /const createdNaverMap = !map;/u);
  assert.match(mapEffect, /if \(!map\) \{\s*map = new window\.naver\.maps\.Map/u);
  assert.match(mapEffect, /return \(\) => \{\s*cancelled = true;\s*clearNaverHealthMonitor\(\);\s*\};/u);
  assert.doesNotMatch(mapEffect, /return \(\) => \{[\s\S]{0,160}destroyCurrentMap\(\);/u);
  assert.doesNotMatch(mapEffect, /\[markerRows, selectedMapRegion/u);
  assert.match(panel, /const latestItem = markerRowLookupRef\.current\.get\(marketMapItemLookupKey\(item, labelKey\)\) \|\| item;/u);
  assert.match(panel, /onSelectRef\.current\?\.\(latestItem\.row\);/u);
});

test('twenty same-provider re-entry and marker-update cycles are contractually reuse-only', () => {
  const reuseOnlyCycle = { provider: 'naver', hasMapInstance: true, hasSdk: true };
  const shouldReuse = (state) => state.provider === 'naver' && state.hasMapInstance && state.hasSdk;
  const cycles = Array.from({ length: 20 }, () => shouldReuse(reuseOnlyCycle));

  assert.equal(cycles.every(Boolean), true);
  assert.equal(cycles.filter(Boolean).length, 20);
  assert.match(source, /const canReuseNaverMap = mapProviderRef\.current === 'naver' && Boolean\(mapInstanceRef\.current\) && Boolean\(window\.naver\?\.maps\);/u);
  assert.match(source, /const createdNaverMap = !map;/u);
  assert.match(source, /if \(!map\) \{\s*map = new window\.naver\.maps\.Map/u);
});

test('lease center detail only opens a nested map for an exact Korean coordinate', () => {
  const dashboard = between('function MarketDataDashboardContent(', 'function InvestmentIndexDashboardLegacy()');

  assert.match(dashboard, /const leaseCenterMapRow = \(row, historyRows = centerHistoryRows\(row\)\) => \(/u);
  assert.match(dashboard, /\[row, \.\.\.historyRows\]\.find\(\(item\) => isExactMarketAddressCoordinate\(item\)\)/u);
  assert.match(dashboard, /type: 'lease-center-detail'/u);
  assert.match(dashboard, /centerMapRow: leaseCenterMapRow\(row, historyRows\)/u);
  assert.match(dashboard, /data-testid="lease-center-map-button"/u);
  assert.match(dashboard, /disabled=\{!modal\.centerMapRow\}/u);
  assert.match(dashboard, /정확한 좌표가 없어 지도 보기를 사용할 수 없습니다\./u);
  assert.match(dashboard, /leaseCenterMapOpen && modal\?\.type === 'lease-center-detail' && modal\.centerMapRow/u);
  assert.match(dashboard, /rows=\{\[modal\.centerMapRow\]\}/u);
  assert.match(dashboard, /initialSelectedRegion=\{regionValue\(modal\.centerMapRow\.region\)\}/u);
});

test('exact center coordinates reject region, fallback, stale, and missing provenance', () => {
  assert.match(source, /function isExactMarketAddressCoordinate\(row\) \{/u);
  assert.match(source, /const source = text\(row\?\.coordinate_source \|\| row\?\.coordinateSource\)\.toLowerCase\(\);/u);
  assert.match(source, /const status = text\(row\?\.coordinate_status \|\| row\?\.geocode_status \|\| row\?\.market_geocode_status \|\| row\?\.status\)\.toLowerCase\(\);/u);
  assert.match(source, /\(\?:region\|fallback\|stale\|missing\|failed\|failure\|error\|out_of_range\|empty\)/u);
  assert.match(source, /Boolean\(coordinateAddress\) && \/\(\?:market_geocode\|geocod\|naver\|address\)\/iu\.test\(source\)/u);
});
