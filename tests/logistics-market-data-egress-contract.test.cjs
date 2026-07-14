const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_MAX_COMPRESSED_BYTES,
  FULL_LIMIT,
  MARKET_VIEW_LIMITS,
  MARKET_VIEWS,
  marketReadPayload,
  summarizeEgress,
  summarizeUiConsumption,
} = require('../scripts/qa/logistics-market-data-egress-contract.cjs');

test('lightweight market payloads use the UI limits for all five views', () => {
  assert.deepEqual(MARKET_VIEWS, ['overview', 'lease', 'supply', 'transactions', 'source']);
  for (const view of MARKET_VIEWS) {
    assert.deepEqual(marketReadPayload(view), { view, limit: MARKET_VIEW_LIMITS[view] });
  }
});

test('full payloads require an explicit full mode at the contract boundary', () => {
  assert.equal(marketReadPayload('lease').limit, 1800);
  assert.equal(marketReadPayload('lease', { full: true }).limit, FULL_LIMIT);
});

test('egress summary rejects duplicate requests and an unverifiable compressed size', () => {
  const rows = MARKET_VIEWS.map((view) => ({
    payload: marketReadPayload(view),
    content_encoding: 'br',
    compressed_bytes: 100,
  }));
  const summary = summarizeEgress(rows, DEFAULT_MAX_COMPRESSED_BYTES);
  assert.equal(summary.one_request_per_view, true);
  assert.equal(summary.duplicate_request_count, 0);
  assert.equal(summary.within_compressed_budget, true);
  assert.equal(DEFAULT_MAX_COMPRESSED_BYTES, 2_400_000);

  const duplicate = summarizeEgress([...rows, rows[0]]);
  assert.equal(duplicate.duplicate_request_count, 1);
  assert.equal(duplicate.one_request_per_view, false);

  const missingHeader = summarizeEgress(rows.map((row) => ({ ...row, compressed_bytes: null })));
  assert.equal(missingHeader.compression_verifiable, false);
  assert.equal(missingHeader.within_compressed_budget, false);
});

test('UI consumption contract permits one matching request per view only', () => {
  const requests = MARKET_VIEWS.map((view) => marketReadPayload(view));
  const summary = summarizeUiConsumption(requests);
  assert.equal(summary.ui_request_count, 5);
  assert.equal(summary.ui_duplicate_request_count, 0);
  assert.equal(summary.ui_each_view_at_most_once, true);
  assert.equal(summary.ui_total_at_most_five, true);

  const duplicate = summarizeUiConsumption([...requests, requests[0]]);
  assert.equal(duplicate.ui_duplicate_request_count, 1);
  assert.equal(duplicate.ui_view_request_counts.overview, 2);
  assert.equal(duplicate.ui_each_view_at_most_once, false);
  assert.equal(duplicate.ui_total_at_most_five, false);
});
