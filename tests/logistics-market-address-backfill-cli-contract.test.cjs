const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const scriptSource = fs.readFileSync(
  path.join(ROOT, 'scripts', 'ops', 'logistics-market-address-backfill.cjs'),
  'utf8',
);

test('stable lease runs pin the first read-only preflight scope before any apply request', () => {
  assert.match(scriptSource, /const stableLeaseScope = latestOnly \|\| Boolean\(reportPeriod\)/u);
  assert.match(scriptSource, /phase: 'preflight'/u);
  assert.match(scriptSource, /dry_run: true,/u);
  assert.match(scriptSource, /geocode: false,/u);
  assert.match(scriptSource, /pinnedScope = leaseScopeFromResponse\(preflightResponse\.data\)/u);
  assert.match(scriptSource, /source_file_id: safeText\(data\?\.source_file_id\)/u);
  assert.match(scriptSource, /report_period: safeText\(data\?\.report_period\)/u);
  assert.match(scriptSource, /expected_rows: positiveInteger\(data\?\.expected_rows\)/u);
});

test('every stable apply request carries the pinned scope and aborts on a response mismatch', () => {
  assert.match(scriptSource, /expected_source_file_id: pinnedScope\.source_file_id/u);
  assert.match(scriptSource, /expected_report_period: pinnedScope\.report_period/u);
  assert.match(scriptSource, /expected_rows: pinnedScope\.expected_rows/u);
  assert.match(scriptSource, /function leaseScopeMatches\(/u);
  assert.match(scriptSource, /actual\.source_file_id === expectedScope\.source_file_id/u);
  assert.match(scriptSource, /actual\.report_period === expectedScope\.report_period/u);
  assert.match(scriptSource, /actual\.expected_rows === expectedScope\.expected_rows/u);
  assert.match(scriptSource, /if \(!batch\.ok\) break;/u);
});

test('until-complete halts on zero or repeated remaining progress and artifacts list scope and per-batch effects', () => {
  assert.match(scriptSource, /batch\.write_count === 0/u);
  assert.match(scriptSource, /batch\.progress_locations <= 0/u);
  assert.match(scriptSource, /seenRemaining\.has\(batch\.remaining_locations\)/u);
  assert.match(scriptSource, /pinned_scope: pinnedScope/u);
  assert.match(scriptSource, /batch_manifest: batches\.map/u);
  assert.match(scriptSource, /write_count: batch\.write_count/u);
  assert.match(scriptSource, /planned_write_count: batch\.planned_write_count/u);
  assert.match(scriptSource, /failure_count: batch\.failure_count/u);
  assert.match(scriptSource, /write_count: phase === 'apply' \? plannedWriteCount : 0/u);
});

test('non-2xx Edge responses retain structured failure details in the artifact', () => {
  assert.match(scriptSource, /ok: response\.ok && body\?\.ok !== false/u);
  assert.match(scriptSource, /status: response\.status/u);
  assert.match(scriptSource, /data: body\.data \|\| \{\}/u);
  assert.match(scriptSource, /error: response\.ok \?/u);
});
