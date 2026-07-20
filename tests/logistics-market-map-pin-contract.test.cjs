const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const panelSource = fs.readFileSync(path.join(root, 'src', 'components', 'system', 'workspace', 'LogisticsSectorModules.jsx'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'src', 'components', 'system', 'workspace', 'LogisticsMapRuntime.jsx'), 'utf8');

test('detail pins require valid Korean coordinates and never render a region fallback as a pin', () => {
  assert.match(panelSource, /const KOREA_LATITUDE_RANGE = \[33, 39\.5\];/u);
  assert.match(panelSource, /const KOREA_LONGITUDE_RANGE = \[124, 132\];/u);
  assert.match(panelSource, /function isValidKoreanLatLng\(lat, lng\)/u);
  assert.match(panelSource, /const hasRawCoords = isValidKoreanLatLng\(rawLat, rawLng\);/u);
  assert.match(panelSource, /const hasGeocodedCoords = isValidKoreanLatLng\(geocoded\?\.lat, geocoded\?\.lng\);/u);
  assert.match(panelSource, /plotRows\.filter\(\(item\) => item\.isCluster \|\| \(\s*!item\.fallback\s*&& isValidKoreanLatLng\(item\.lat, item\.lng\)/u);
});

test('detail pin preparation deduplicates center and precise location without a 120-row rendering slice', () => {
  assert.match(panelSource, /function marketMapDetailPinKey\(row, labelKey\)/u);
  assert.match(panelSource, /row\.center_name/u);
  assert.match(panelSource, /row\.coordinate_address/u);
  assert.match(panelSource, /const selectedRegionRows = useMemo\(\(\) => \{/u);
  assert.match(panelSource, /const seen = new Set\(\);/u);
  assert.match(panelSource, /if \(seen\.has\(pinKey\)\) return false;/u);
  assert.doesNotMatch(panelSource, /const detailPointLimit = 120;/u);
  assert.doesNotMatch(panelSource, /candidateRows\.slice\(0, mapRowLimit\)/u);
});

test('lease maps use complete latest rows and reject non-exact coordinate provenance', () => {
  assert.match(panelSource, /const latestLeaseRows = safeArray\(leaseView\.latest_rows\);/u);
  assert.match(panelSource, /const latestLeases = latestLeaseRows\.length\s*\? latestLeaseRows/u);
  assert.match(panelSource, /exactCoordinatesOnly = false/u);
  assert.match(panelSource, /!exactCoordinatesOnly \|\| isExactMarketAddressCoordinate\(item\.row\)/u);
  assert.match(panelSource, /title="권역별 센터"[^\n]+exactCoordinatesOnly/u);
});

test('each map panel isolates its region-selection event and exposes a stable instance id', () => {
  assert.match(panelSource, /function nextMarketMapInstanceId\(\)/u);
  assert.match(panelSource, /const mapInstanceIdRef = useRef\(nextMarketMapInstanceId\(\)\);/u);
  assert.match(panelSource, /const mapInstanceId = mapInstanceIdRef\.current;/u);
  assert.match(panelSource, /function marketMapRegionEventName\(instanceId\)/u);
  assert.match(panelSource, /marketMapRegionEventName\(mapInstanceId\)/u);
  assert.match(panelSource, /data-map-instance-id=\{mapInstanceId\}/u);
});

test('map lifecycle teardown clears provider markers, listeners, layers, and the active map on unmount', () => {
  assert.match(panelSource, /const destroyCurrentMapRef = useRef\(\(\) => \{\}\);/u);
  assert.match(panelSource, /destroyCurrentMapRef\.current = destroyCurrentMap;/u);
  assert.match(panelSource, /return \(\) => \{\s*destroyCurrentMapRef\.current\?\.\(\);\s*\};/u);
  assert.match(panelSource, /marker\?\.off\?\.\(\);/u);
  assert.match(panelSource, /clearNaverListeners\(\);/u);
  assert.match(panelSource, /cadastralLayerRef\.current\.setMap\(null\);/u);
  assert.match(panelSource, /mapInstanceRef\.current\.remove\(\);/u);
});

test('failed Leaflet SDK loads time out, remove the failed script, and allow a later retry', () => {
  assert.match(runtimeSource, /const LEAFLET_SDK_TIMEOUT_MS = 5000;/u);
  assert.match(runtimeSource, /window\.setTimeout\(/u);
  assert.match(runtimeSource, /removeLeafletSdkScript\(\);/u);
  assert.match(runtimeSource, /script\?\.remove\?\.\(\);/u);
  assert.match(runtimeSource, /window\.__logisticsLeafletPromise = null;/u);
});
