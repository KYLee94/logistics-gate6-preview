const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const scriptPath = path.join(ROOT, 'scripts', 'qa', 'logistics-market-map-address-precision-audit.cjs');
const scriptSource = fs.readFileSync(scriptPath, 'utf8');
const { analyzeRows, buildReport } = require(scriptPath);

test('market map address QA reports actual coordinate, fallback, and duplicate-location metrics for every kind', () => {
  for (const kind of ['lease', 'supply', 'transactions']) {
    assert.match(scriptSource, new RegExp(`analyzeRows\\('${kind}'`, 'u'));
  }

  assert.match(scriptSource, /actual_coordinate_coverage/u);
  assert.match(scriptSource, /region_fallback_count/u);
  assert.match(scriptSource, /duplicate_location_group_count/u);
  assert.match(scriptSource, /duplicate_location_row_count/u);
  assert.match(scriptSource, /duplicate_location_groups/u);
});

test('market map address QA separates address and coordinate precision checks', () => {
  assert.match(scriptSource, /checks:\s*\{\s*address_precision: addressPrecisionCheckResult,/u);
  assert.match(scriptSource, /coordinate_precision: leaseCoordinateCheck,/u);
  assert.match(scriptSource, /function addressPrecisionCheck\(analyses\)/u);
  assert.match(scriptSource, /function coordinatePrecisionCheck\(analysis\)/u);
});

test('default market map QA fails when latest lease rows lack actual coordinates or use region fallbacks', () => {
  assert.match(scriptSource, /const leaseCoordinateCheck = coordinatePrecisionCheck\(leaseAnalysis\);/u);
  assert.match(scriptSource, /coordinate_count === analysis\.row_count/u);
  assert.match(scriptSource, /analysis\.region_fallback_count === 0/u);
  assert.match(scriptSource, /ok: addressPrecisionCheckResult\.ok && leaseCoordinateCheck\.ok/u);
  assert.doesNotMatch(scriptSource, /hasFlag\('kind'\)/u);
  assert.doesNotMatch(scriptSource, /hasFlag\('allow-missing'\)/u);
});

test('default gate rejects a fully addressed latest lease row when its coordinate is missing or region-fallback', () => {
  const lease = analyzeRows('lease', [{
    center_name: '테스트 물류센터',
    generated_address: '경기도 이천시 마장면 덕평리 101-1',
    coordinate_address: '경기도 이천시 마장면 덕평리 101-1',
    coordinate_source: 'missing',
    latitude: null,
    longitude: null,
  }]);
  const supply = analyzeRows('supply', []);
  const transactions = analyzeRows('transactions', []);
  const report = buildReport([lease, supply, transactions], { authSource: 'test', full: false });

  assert.equal(report.checks.address_precision.ok, true);
  assert.equal(report.checks.coordinate_precision.actual_coordinate_coverage.percent, 0);
  assert.equal(report.checks.coordinate_precision.region_fallback_count, 1);
  assert.equal(report.checks.coordinate_precision.ok, false);
  assert.equal(report.ok, false);
});

test('each kind preserves actual coordinate coverage, fallback count, and duplicate location groups independently', () => {
  const analysis = analyzeRows('supply', [
    {
      label: '공급 A',
      generated_address: '경기도 이천시 마장면 덕평리 101-1',
      coordinate_address: '경기도 이천시 마장면 덕평리 101-1',
      coordinate_source: 'stored',
      latitude: 37.242,
      longitude: 127.377,
    },
    {
      label: '공급 B',
      generated_address: '경기도 이천시 마장면 덕평리 101-1',
      coordinate_address: '경기도 이천시 마장면 덕평리 101-1',
      coordinate_source: 'stored',
      latitude: 37.242,
      longitude: 127.377,
    },
  ]);

  assert.deepEqual(analysis.actual_coordinate_coverage, {
    count: 2,
    total: 2,
    ratio: 1,
    percent: 100,
  });
  assert.equal(analysis.region_fallback_count, 0);
  assert.equal(analysis.duplicate_location_group_count, 1);
  assert.equal(analysis.duplicate_location_row_count, 2);
  assert.equal(analysis.duplicate_location_groups[0].location_address, '경기도 이천시 마장면 덕평리 101-1');
});
