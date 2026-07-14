const MARKET_VIEW_LIMITS = Object.freeze({
  overview: 900,
  lease: 1800,
  supply: 1400,
  transactions: 1800,
  source: 1200,
});

const MARKET_VIEWS = Object.freeze(Object.keys(MARKET_VIEW_LIMITS));
const FULL_LIMIT = 12000;
const DEFAULT_MAX_COMPRESSED_BYTES = 2_400_000;

function hasFlag(name, argv = process.argv) {
  return argv.includes(`--${name}`);
}

function argsNumber(name, fallback, argv = process.argv) {
  const index = argv.indexOf(`--${name}`);
  const parsed = index === -1 ? NaN : Number(argv[index + 1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function marketReadPayload(view, { full = false, includeRawRowHashes = false } = {}) {
  if (!MARKET_VIEW_LIMITS[view]) throw new Error(`Unsupported market view: ${view}`);
  return {
    view,
    limit: full ? FULL_LIMIT : MARKET_VIEW_LIMITS[view],
    ...(includeRawRowHashes ? { include_raw_row_hashes: true } : {}),
  };
}

function responseSizeMetrics(response, rawText) {
  const contentLength = Number(response.headers.get('content-length') || 0);
  const contentEncoding = String(response.headers.get('content-encoding') || '').toLowerCase();
  return {
    content_encoding: contentEncoding || null,
    compressed_bytes: contentLength > 0 ? contentLength : null,
    decoded_bytes: Buffer.byteLength(rawText || '', 'utf8'),
  };
}

function summarizeEgress(results, maxCompressedBytes = DEFAULT_MAX_COMPRESSED_BYTES) {
  const requestKeys = results.map((row) => `${row.payload.view}:${row.payload.limit}`);
  const compressedBytes = results.reduce((sum, row) => sum + Number(row.compressed_bytes || 0), 0);
  const compressionVerifiable = results.every((row) => row.content_encoding && Number(row.compressed_bytes) > 0);
  return {
    request_count: results.length,
    unique_request_count: new Set(requestKeys).size,
    duplicate_request_count: requestKeys.length - new Set(requestKeys).size,
    total_compressed_bytes: compressionVerifiable ? compressedBytes : null,
    max_compressed_bytes: maxCompressedBytes,
    compression_verifiable: compressionVerifiable,
    within_compressed_budget: compressionVerifiable && compressedBytes <= maxCompressedBytes,
    one_request_per_view: results.length === MARKET_VIEWS.length
      && new Set(results.map((row) => row.payload.view)).size === MARKET_VIEWS.length
      && results.every((row) => row.payload.limit === MARKET_VIEW_LIMITS[row.payload.view]),
  };
}

function summarizeUiConsumption(requests) {
  const viewRequestCounts = Object.fromEntries(MARKET_VIEWS.map((view) => [view, 0]));
  const requestKeys = requests.map((row) => `${row.view || ''}:${Number(row.limit || 0)}`);
  requests.forEach((row) => {
    if (Object.hasOwn(viewRequestCounts, row.view)) viewRequestCounts[row.view] += 1;
  });
  return {
    ui_request_count: requests.length,
    ui_duplicate_request_count: requestKeys.length - new Set(requestKeys).size,
    ui_view_request_counts: viewRequestCounts,
    ui_each_view_at_most_once: Object.values(viewRequestCounts).every((count) => count <= 1),
    ui_total_at_most_five: requests.length <= MARKET_VIEWS.length,
  };
}

module.exports = {
  DEFAULT_MAX_COMPRESSED_BYTES,
  FULL_LIMIT,
  MARKET_VIEW_LIMITS,
  MARKET_VIEWS,
  argsNumber,
  hasFlag,
  marketReadPayload,
  responseSizeMetrics,
  summarizeEgress,
  summarizeUiConsumption,
};
