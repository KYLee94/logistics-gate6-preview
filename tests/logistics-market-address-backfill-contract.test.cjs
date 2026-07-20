const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const edgeSource = fs.readFileSync(
  path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts'),
  'utf8',
);
const scriptSource = fs.readFileSync(
  path.join(ROOT, 'scripts', 'ops', 'logistics-market-address-backfill.cjs'),
  'utf8',
);

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `${startMarker} must have a bounded source section`);
  return source.slice(start, end);
}

test('lease geocode backfill accepts an explicit period or safely resolves the latest period', () => {
  const backfill = sourceBetween(
    edgeSource,
    'async function callSectorMarketAddressBackfill(',
    '\nfunction normalizeSectorMarketReadView(',
  );

  assert.match(backfill, /payload\.latest_only === true/u);
  assert.match(backfill, /payload\.report_period/u);
  assert.match(backfill, /latestPeriodResult/u);
  assert.match(backfill, /\.eq\('report_period', selectedLeasePeriod\)/u);
  assert.match(backfill, /latest_only: latestOnly/u);
  assert.match(backfill, /report_period: selectedLeasePeriod \|\| null/u);
});

test('latest lease period is selected by year, quarter, then period and fails when that row lacks a period', () => {
  const backfill = sourceBetween(
    edgeSource,
    'async function callSectorMarketAddressBackfill(',
    '\nfunction normalizeSectorMarketReadView(',
  );

  assert.match(backfill, /select\('report_year,report_quarter,report_period'\)/u);
  assert.match(backfill, /\.order\('report_year', \{ ascending: false \}\)/u);
  assert.match(backfill, /\.order\('report_quarter', \{ ascending: false \}\)/u);
  assert.match(backfill, /\.order\('report_period', \{ ascending: false \}\)/u);
  assert.doesNotMatch(backfill, /\.not\('report_period', 'is', null\)/u);
  assert.match(backfill, /if \(!selectedLeasePeriod\) return fail\(404/u);
});

test('lease geocode batches one Naver lookup per generated-address group with PNU fallback', () => {
  const backfill = sourceBetween(
    edgeSource,
    'async function callSectorMarketAddressBackfill(',
    '\nfunction normalizeSectorMarketReadView(',
  );

  assert.match(backfill, /marketGeocodeLocationKey\(row, info, address\)/u);
  assert.match(backfill, /marketBackfillGeocode\(ctx, group\.address\)/u);
  assert.match(backfill, /current\.rows\.push\(entry\)/u);
  assert.match(backfill, /nextPayload\.market_geocode/u);
  assert.match(backfill, /geocode_limit \|\| 25/u);
  assert.match(backfill, /geocoded_locations/u);
  assert.match(backfill, /updated_rows/u);
  assert.match(backfill, /remaining_locations/u);
});

test('lease geocode groups by the complete generated address before falling back to PNU', () => {
  const locationKey = sourceBetween(
    edgeSource,
    'function marketGeocodeLocationKey(',
    '\nasync function callSectorMarketAddressBackfill(',
  );

  const generatedAddressIndex = locationKey.indexOf('const generatedAddress');
  const pnuIndex = locationKey.indexOf('const pnu');
  assert.ok(generatedAddressIndex >= 0 && pnuIndex > generatedAddressIndex, 'generated address must be evaluated before PNU');
  assert.match(locationKey, /if \(generatedAddress\) return `address:\$\{generatedAddress\}`/u);
  assert.match(locationKey, /if \(pnu\) return `pnu:\$\{pnu\}`/u);
});

test('an existing coordinate seeds every missing sibling in the same generated-address group without Naver', () => {
  const backfill = sourceBetween(
    edgeSource,
    'async function callSectorMarketAddressBackfill(',
    '\nfunction normalizeSectorMarketReadView(',
  );
  const seed = sourceBetween(
    edgeSource,
    'function marketBackfillCoordinateSeed(',
    '\nasync function callSectorMarketAddressBackfill(',
  );

  assert.match(seed, /coordinate_address/u);
  assert.match(seed, /coordinate_source/u);
  assert.match(backfill, /seed: entry\.trustedSeed/u);
  assert.match(backfill, /filter\(\(group\) => !group\.seed\)/u);
  assert.match(backfill, /seedGeocodeResults/u);
  assert.match(backfill, /coordinate && !hasTrustedCoordinate/u);
  assert.match(backfill, /seeded_locations/u);
  assert.match(backfill, /propagated_rows/u);
});

test('coordinate seeds are inactive unless the request explicitly enables geocoding', () => {
  const backfill = sourceBetween(
    edgeSource,
    'async function callSectorMarketAddressBackfill(',
    '\nfunction normalizeSectorMarketReadView(',
  );

  assert.match(backfill, /const seedGeocodeResults = shouldGeocode\s*\?/u);
  assert.match(backfill, /: new Map<string, Record<string, unknown>>\(\)/u);
});

test('Naver coordinates are accepted only inside Korea and out-of-range values become failures', () => {
  const geocode = sourceBetween(
    edgeSource,
    'async function marketBackfillGeocode(',
    '\nfunction marketGeocodeLocationKey(',
  );
  const bounds = sourceBetween(
    edgeSource,
    'function marketBackfillCoordinatesInKorea(',
    '\nasync function marketBackfillGeocode(',
  );

  assert.match(bounds, /latitude >= 33 && latitude <= 39\.5/u);
  assert.match(bounds, /longitude >= 124 && longitude <= 132/u);
  assert.match(geocode, /marketBackfillCoordinatesInKorea\(latitude, longitude\)/u);
  assert.match(geocode, /status: 'out_of_range'/u);
  assert.match(geocode, /Korea geocode bounds/u);
});

test('Naver backfill calls use 2.2 second pacing and expose the pacing contract', () => {
  const backfill = sourceBetween(
    edgeSource,
    'async function callSectorMarketAddressBackfill(',
    '\nfunction normalizeSectorMarketReadView(',
  );

  assert.match(edgeSource, /const MARKET_BACKFILL_NAVER_PACING_MS = 2200/u);
  assert.match(backfill, /await marketBackfillNaverPacing\(groupIndex\)/u);
  assert.match(backfill, /geocode_pacing_ms: MARKET_BACKFILL_NAVER_PACING_MS/u);
});

test('coordinate seeds require a current Korean Naver result for the exact generated address', () => {
  const seed = sourceBetween(
    edgeSource,
    'function marketBackfillCoordinateSeed(',
    '\nasync function callSectorMarketAddressBackfill(',
  );

  assert.match(seed, /marketBackfillCoordinatesInKorea\(latitude, longitude\)/u);
  assert.match(seed, /marketBackfillSeedStatusIsTrusted/u);
  assert.match(seed, /marketNormalizedAddress\(currentGeocode\.query\)/u);
  assert.match(seed, /generatedAddress !== coordinateQuery/u);
  assert.match(seed, /return null/u);
});

test('latest or explicit lease geocode reads every 1000-row page and rejects count drift or an empty scope', () => {
  const backfill = sourceBetween(
    edgeSource,
    'async function callSectorMarketAddressBackfill(',
    '\nfunction normalizeSectorMarketReadView(',
  );

  assert.match(backfill, /const MARKET_BACKFILL_PAGE_SIZE = 1000/u);
  assert.match(backfill, /select\(config\.idColumn, \{ count: 'exact', head: true \}\)/u);
  assert.match(backfill, /if \(expectedRows === 0\) return fail\(404/u);
  assert.match(backfill, /for \(let pageOffset = 0; pageOffset < expectedRows; pageOffset \+= MARKET_BACKFILL_PAGE_SIZE\)/u);
  assert.match(backfill, /if \(fetchedRows !== expectedRows\) return fail\(409/u);
  assert.match(backfill, /expected_rows: expectedRows/u);
  assert.match(backfill, /fetched_rows: fetchedRows/u);
});

test('latest or explicit lease geocode updates only rows whose coordinates were applied in this batch', () => {
  const backfill = sourceBetween(
    edgeSource,
    'async function callSectorMarketAddressBackfill(',
    '\nfunction normalizeSectorMarketReadView(',
  );

  assert.match(backfill, /const updateRequired = geocodeLeasePeriodScope\s*\? geocodeApplied/u);
  assert.match(backfill, /: geocodeApplied \|\| safeText\(currentPayload\.generated_address\) !== address/u);
  assert.match(backfill, /if \(updateRequired\)/u);
  assert.doesNotMatch(backfill, /if \(geocodeApplied \|\| safeText\(currentPayload\.generated_address\) !== address/u);
});

test('a trusted group seed replaces missing and finite untrusted sibling coordinates', () => {
  const backfill = sourceBetween(
    edgeSource,
    'async function callSectorMarketAddressBackfill(',
    '\nfunction normalizeSectorMarketReadView(',
  );

  assert.match(backfill, /const trustedSeed = marketBackfillCoordinateSeed\(\{ info, currentPayload, address \}\)/u);
  assert.match(backfill, /const hasTrustedCoordinate = Boolean\(entry\.trustedSeed\)/u);
  assert.match(backfill, /const geocodeApplied = Boolean\(coordinate && !hasTrustedCoordinate\)/u);
  assert.doesNotMatch(backfill, /fillsMissingCoordinate/u);
  assert.doesNotMatch(backfill, /coordinateFromNaver/u);
  assert.match(backfill, /geocodedLocationKeys\.add\(groupKey\)/u);
});

test('lease geocode reports failures without treating them as successful coordinates', () => {
  const geocode = sourceBetween(
    edgeSource,
    'async function marketBackfillGeocode(',
    '\nasync function callSectorMarketAddressBackfill(',
  );
  const backfill = sourceBetween(
    edgeSource,
    'async function callSectorMarketAddressBackfill(',
    '\nfunction normalizeSectorMarketReadView(',
  );

  assert.match(geocode, /status: 'failed'/u);
  assert.match(backfill, /failures/u);
  assert.match(backfill, /geocode\.status !== 'ok'/u);
  assert.match(backfill, /const ok = allFailures\.length === 0/u);
});

test('ops script exposes period controls and paces until-complete requests', () => {
  assert.match(scriptSource, /hasFlag\('--latest'\)/u);
  assert.match(scriptSource, /argValue\('--period'/u);
  assert.match(scriptSource, /hasFlag\('--until-complete'\)/u);
  assert.match(scriptSource, /6500/u);
  assert.match(scriptSource, /remaining_locations/u);
});

test('ops totals retain only the latest remaining location count for each kind', () => {
  const totals = sourceBetween(
    scriptSource,
    'totals: batches.reduce(',
    '\n  };',
  );

  assert.match(totals, /current\.remaining_locations = Number\(result\.remaining_locations \|\| 0\)/u);
  assert.doesNotMatch(totals, /current\.remaining_locations \+=/u);
});
