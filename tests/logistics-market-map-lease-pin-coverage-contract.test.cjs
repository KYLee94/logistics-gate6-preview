const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'qa', 'logistics-market-map-lease-pin-coverage.cjs');
const PACKAGE_PATH = path.join(ROOT, 'package.json');

function scriptSource() {
  return fs.readFileSync(SCRIPT_PATH, 'utf8');
}

test('lease pin coverage contract fixes the complete 927 asset and 681 pin regional baseline', () => {
  const source = scriptSource();

  assert.match(source, /const EXPECTED_VISIBLE_ASSET_COUNT = 927;/u);
  assert.match(source, /const EXPECTED_PIN_COUNT = 681;/u);
  assert.match(source, /동남권:\s*247/u);
  assert.match(source, /남부권:\s*112/u);
  assert.match(source, /중앙권:\s*43/u);
  assert.match(source, /서부권:\s*98/u);
  assert.match(source, /서북권:\s*38/u);
  assert.match(source, /['"]수도권 기타권['"]:\s*22/u);
  assert.match(source, /경남권:\s*39/u);
  assert.match(source, /충청권:\s*37/u);
  assert.match(source, /전라권:\s*22/u);
  assert.match(source, /경북권:\s*20/u);
  assert.match(source, /['"]지방 기타권['"]:\s*3/u);
  assert.match(source, /Object\.values\(EXPECTED_REGION_PIN_COUNTS\)\.reduce/u);
  assert.match(source, /expectedCountTotal !== EXPECTED_PIN_COUNT/u);
});

test('live coverage QA requires authenticated Naver points without fallback, stale, or OSM success masking', () => {
  const source = scriptSource();

  assert.match(source, /const DEFAULT_BASE_URL = 'https:\/\/kylee94\.github\.io\/logistics-gate6-preview\/';/u);
  assert.match(source, /market-data\/lease-market/u);
  assert.match(source, /sessionStorage\.setItem\('sb-iota-auth-token'/u);
  assert.match(source, /data-map-visible-asset-count/u);
  assert.match(source, /data-map-point-count/u);
  assert.match(source, /data-map-native-marker-count/u);
  assert.match(source, /data-map-coordinate-count/u);
  assert.match(source, /data-map-coordinate-source-count/u);
  assert.match(source, /data-map-fallback-count/u);
  assert.match(source, /data-naver-map-ready/u);
  assert.match(source, /data-osm-map-ready/u);
  assert.match(source, /data-map-fallback-ready/u);
  assert.match(source, /stale/iu);
  assert.match(source, /provider === 'naver'/u);
  assert.match(source, /naver_ready === true/u);
  assert.match(source, /osm_ready === false/u);
  assert.match(source, /fallback_count === 0/u);
  assert.match(source, /coordinate_count >= state\.point_count/u);
  assert.match(source, /coordinate_source_count >= state\.point_count/u);
  assert.match(source, /native_marker_count >= state\.point_count/u);
});

test('coverage QA checks every region, a single representative large map, tab re-entry, and one pin hover callout', () => {
  const source = scriptSource();

  assert.match(source, /for \(const \[region, expectedPointCount\] of Object\.entries\(EXPECTED_REGION_PIN_COUNTS\)\)/u);
  assert.match(source, /encodeURIComponent\(region\)/u);
  assert.match(source, /data-region-key/u);
  assert.match(source, /market-map-expand-button/u);
  assert.match(source, /representative_region/u);
  assert.match(source, /reentry/u);
  assert.match(source, /(?:page\.mouse\.move|\.(?:hover|dispatchEvent)\()/u);
  assert.match(source, /(?:logistics-map-callout|InfoWindow|map-callout)/u);
});

test('the QA script creates its JSON artifact only when executed and the package exposes one QA command', () => {
  const source = scriptSource();
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));

  assert.match(source, /if \(require\.main === module\) \{\s*main\(\)/u);
  assert.equal(
    packageJson.scripts['qa:market-map:lease-pin-coverage'],
    'node scripts/qa/logistics-market-map-lease-pin-coverage.cjs',
  );
});
