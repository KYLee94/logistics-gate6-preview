const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const scriptPath = path.resolve(__dirname, '../scripts/qa/logistics-occupancy-live-audit.cjs');
const releaseGatePath = path.resolve(__dirname, '../scripts/qa/logistics-data-platform-release-gate.cjs');

test('occupancy uses only current contract rows and all current statuses in the denominator', () => {
  const { calculateCurrentOccupancy } = require(scriptPath);
  const result = calculateCurrentOccupancy([
    {
      occupancy_status: 'occupied', leased_area_sqm: 100,
      commencement_date: '2026-01-01', expiry_date: '2026-12-31',
    },
    {
      occupancy_status: 'vacant', leased_area_sqm: 50,
      commencement_date: null, expiry_date: null,
    },
    {
      occupancy_status: 'planned', leased_area_sqm: 25,
      commencement_date: '2026-08-11', expiry_date: null,
    },
    {
      occupancy_status: 'occupied', leased_area_sqm: 30,
      commencement_date: null, expiry_date: '2026-08-09',
    },
  ], '2026-08-10');

  assert.equal(result.current_row_count, 2);
  assert.equal(result.current_occupied_row_count, 1);
  assert.equal(result.current_vacant_row_count, 1);
  assert.equal(result.current_planned_row_count, 0);
  assert.equal(result.current_occupied_leased_area_sqm, 100);
  assert.equal(result.current_all_status_leased_area_sqm, 150);
  assert.equal(result.expected_occupancy_rate, 66.67);
  assert.equal(result.expected_ui_label, '66.7%');
});

test('zero current denominator is information missing rather than zero percent', () => {
  const { calculateCurrentOccupancy } = require(scriptPath);
  const result = calculateCurrentOccupancy([
    {
      occupancy_status: 'occupied', leased_area_sqm: 100,
      commencement_date: '2027-01-01', expiry_date: null,
    },
  ], '2026-08-10');

  assert.equal(result.current_row_count, 0);
  assert.equal(result.current_all_status_leased_area_sqm, 0);
  assert.equal(result.expected_occupancy_rate, null);
  assert.equal(result.expected_ui_label, '정보 없음');
  assert.equal(result.information_missing, true);
});

test('null and zero current areas do not suppress a positive all-status denominator', () => {
  const { calculateCurrentOccupancy } = require(scriptPath);
  const result = calculateCurrentOccupancy([
    { occupancy_status: 'occupied', leased_area_sqm: null },
    { occupancy_status: 'vacant', leased_area_sqm: 0 },
    { occupancy_status: 'vacant', leased_area_sqm: 40 },
  ], '2026-08-10');

  assert.equal(result.current_all_status_leased_area_sqm, 40);
  assert.equal(result.current_positive_area_row_count, 1);
  assert.equal(result.current_rows_without_positive_leased_area, 2);
  assert.equal(result.area_data_incomplete, true);
  assert.equal(result.expected_occupancy_rate, 0);
  assert.equal(result.expected_ui_label, '0.0%');
  assert.equal(result.information_missing, false);
});

test('KST as-of date rolls over at 15:00 UTC', () => {
  const { kstDateFromInstant } = require(scriptPath);
  assert.equal(kstDateFromInstant(Date.parse('2026-08-09T14:59:59Z')), '2026-08-09');
  assert.equal(kstDateFromInstant(Date.parse('2026-08-09T15:00:00Z')), '2026-08-10');
});

test('API and UI reconciliation distinguishes exact, mismatch, and information-missing states', () => {
  const { reconcileOccupancySurfaces } = require(scriptPath);
  const expected = {
    expected_occupancy_rate: 66.67,
    expected_ui_label: '66.7%',
    information_missing: false,
  };
  assert.equal(reconcileOccupancySurfaces(expected, 66.67, '66.7%').status, 'exact');
  assert.equal(reconcileOccupancySurfaces(expected, 50, '50.0%').status, 'mismatch');
  assert.equal(reconcileOccupancySurfaces({
    expected_occupancy_rate: null,
    expected_ui_label: '정보 없음',
    information_missing: true,
  }, null, '정보 없음').status, 'information_missing');
});

test('live audit is fail-closed read-only and observes every asset transition for stale display', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  assert.match(source, /expectedAssetCount\s*=\s*19/u);
  assert.match(source, /v2\/home\/read/u);
  assert.match(source, /v2\/rent-roll\/read/u);
  assert.match(source, /hasFlag\('browser-live'\)/u);
  assert.match(source, /data-platform-asset-select/u);
  assert.match(source, /home-asset-overview/u);
  assert.match(source, /getByRole\('progressbar',\s*\{\s*name:\s*'임대율'/u);
  assert.match(source, /observed_stale_asset_names/u);
  assert.match(source, /page_errors/u);
  assert.match(source, /console_errors/u);
  assert.match(source, /database_write_used:\s*false/u);
  assert.doesNotMatch(source, /batch-save|batch_save|exercise-browser-writes/u);
});

test('release gate keeps both the SQL contract and the read-only audit unit', () => {
  const source = fs.readFileSync(releaseGatePath, 'utf8');
  assert.match(source, /occupancy-rent-roll-basis-contract/u);
  assert.match(source, /tests\/logistics-occupancy-rent-roll-basis-contract\.test\.cjs/u);
  assert.match(source, /occupancy-live-audit-unit/u);
  assert.match(source, /tests\/logistics-occupancy-live-audit\.test\.cjs/u);
});
