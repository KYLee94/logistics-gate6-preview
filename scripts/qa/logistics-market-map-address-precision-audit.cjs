const fs = require('fs');
const path = require('path');
const { hasFlag, marketReadPayload } = require('./logistics-market-data-egress-contract.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/gu, '')];
    }));
}

const fileEnv = {
  ...readEnvFile(path.join(ROOT, '.env')),
  ...readEnvFile(path.join(ROOT, '.env.local')),
};

function envValue(...keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
    if (fileEnv[key]) return fileEnv[key];
  }
  return '';
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function text(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function hasLotAddress(value) {
  return /(?:^|\s)(?:산\s*)?\d{1,5}(?:-\d{1,5})?\s*$/u.test(text(value));
}

function hasAdminUnitBeforeLot(value) {
  return /(?:읍|면|동|리|가)\d*\s+(?:산\s*)?\d{1,5}(?:-\d{1,5})?\s*$/u.test(text(value));
}

function hasActualCoordinate(latitude, longitude) {
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) return false;
  if (text(latitude) === '' || text(longitude) === '') return false;
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  return Number.isFinite(parsedLatitude)
    && Number.isFinite(parsedLongitude)
    && parsedLatitude >= 33
    && parsedLatitude <= 39.5
    && parsedLongitude >= 124
    && parsedLongitude <= 132;
}

function addressFor(row) {
  return text(row.generated_address)
    || text(row.address)
    || text(row.legal_address)
    || text(row.coordinate_address);
}

function rowLabel(row) {
  return text(row.center_name)
    || text(row.asset_name)
    || text(row.warehouse_name)
    || text(row.label)
    || '-';
}

function locationKey(value) {
  return text(value).replace(/\s+/gu, ' ').toLocaleLowerCase('ko-KR');
}

function compactSample(row, kind) {
  return {
    kind,
    label: rowLabel(row),
    region: text(row.region),
    period: text(row.report_period || row.completion_period || row.transaction_period || row.period_label),
    address: addressFor(row),
    coordinate_address: text(row.coordinate_address),
    latitude: row.latitude,
    longitude: row.longitude,
    coordinate_source: text(row.coordinate_source),
    source: text(row.source),
  };
}

function mapRowsForAudit(kind, data) {
  const views = data.views || {};
  if (kind === 'lease') {
    const leaseView = views.lease || {};
    return Array.isArray(leaseView.latest_rows)
      ? leaseView.latest_rows
      : (Array.isArray(data.leases) ? data.leases : []);
  }
  if (kind === 'supply') {
    const supplyView = views.supply || {};
    return Array.isArray(supplyView.rows)
      ? supplyView.rows
      : (Array.isArray(data.supply) ? data.supply : []);
  }
  if (kind === 'transactions') {
    const transactionView = views.transactions || {};
    return Array.isArray(transactionView.rows)
      ? transactionView.rows
      : (Array.isArray(data.transactions) ? data.transactions : []);
  }
  return [];
}

function analyzeRows(kind, rows) {
  const inspected = rows.map((row) => {
    const address = addressFor(row);
    const coordinateAddress = text(row.coordinate_address) || address;
    const coordinateSource = text(row.coordinate_source || row.source);
    return {
      row,
      address,
      coordinateAddress,
      preciseAddress: hasLotAddress(address) && hasAdminUnitBeforeLot(address),
      preciseCoordinateAddress: hasLotAddress(coordinateAddress) && hasAdminUnitBeforeLot(coordinateAddress),
      coordinatePresent: hasActualCoordinate(row.latitude, row.longitude),
      regionFallback: /region|fallback|missing/iu.test(coordinateSource),
    };
  });
  const missingPreciseAddress = inspected.filter((item) => !item.preciseAddress);
  const sourceLotExceptions = missingPreciseAddress.filter((item) => {
    const address = text(item.address);
    return /[A-Z]-?\d+\s*B?L|블럭|부지|산업단지|테크노파크|물류단지/iu.test(address)
      || !/(?:^|\s)(?:산\s*)?\d{1,5}(?:-\d{1,5})?\s*$/u.test(address);
  });
  const missingCoordinate = inspected.filter((item) => !item.coordinatePresent);
  const regionFallback = inspected.filter((item) => item.regionFallback);
  const missingCoordinateAddress = inspected.filter((item) => !item.preciseCoordinateAddress);
  const locationGroups = new Map();
  inspected.forEach((item) => {
    const key = locationKey(item.coordinateAddress);
    if (!key) return;
    const group = locationGroups.get(key) || [];
    group.push(item);
    locationGroups.set(key, group);
  });
  const duplicateLocationGroups = Array.from(locationGroups.entries())
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      location_key: key,
      location_address: items[0].coordinateAddress,
      row_count: items.length,
      samples: items.slice(0, 20).map((item) => compactSample(item.row, kind)),
    }));
  const coordinateCount = inspected.length - missingCoordinate.length;
  return {
    kind,
    row_count: rows.length,
    precise_address_count: inspected.length - missingPreciseAddress.length,
    missing_precise_address_count: missingPreciseAddress.length,
    source_lot_exception_count: sourceLotExceptions.length,
    coordinate_count: coordinateCount,
    missing_coordinate_count: missingCoordinate.length,
    actual_coordinate_coverage: {
      count: coordinateCount,
      total: inspected.length,
      ratio: inspected.length === 0 ? 0 : coordinateCount / inspected.length,
      percent: inspected.length === 0 ? 0 : (coordinateCount / inspected.length) * 100,
    },
    precise_coordinate_address_count: inspected.length - missingCoordinateAddress.length,
    missing_precise_coordinate_address_count: missingCoordinateAddress.length,
    region_fallback_count: regionFallback.length,
    duplicate_location_group_count: duplicateLocationGroups.length,
    duplicate_location_row_count: duplicateLocationGroups.reduce((count, group) => count + group.row_count, 0),
    missing_precise_address_samples: missingPreciseAddress.slice(0, 20).map((item) => compactSample(item.row, kind)),
    source_lot_exception_samples: sourceLotExceptions.slice(0, 20).map((item) => compactSample(item.row, kind)),
    missing_coordinate_samples: missingCoordinate.slice(0, 20).map((item) => compactSample(item.row, kind)),
    region_fallback_samples: regionFallback.slice(0, 20).map((item) => compactSample(item.row, kind)),
    duplicate_location_groups: duplicateLocationGroups.slice(0, 20),
    deokpyeong_samples: inspected
      .filter((item) => /덕평|마장면/iu.test(`${rowLabel(item.row)} ${item.address} ${item.coordinateAddress}`))
      .slice(0, 30)
      .map((item) => compactSample(item.row, kind)),
  };
}

function addressPrecisionCheck(analyses) {
  const failedAnalyses = analyses.filter((analysis) => (
    analysis.missing_precise_address_count !== analysis.source_lot_exception_count
  ));
  return {
    ok: failedAnalyses.length === 0,
    scope: 'all-reported-map-rows',
    failed_kinds: failedAnalyses.map((analysis) => analysis.kind),
  };
}

function coordinatePrecisionCheck(analysis) {
  return {
    ok: analysis.row_count > 0
      && analysis.coordinate_count === analysis.row_count
      && analysis.region_fallback_count === 0,
    scope: 'lease-latest-map-rows',
    kind: analysis.kind,
    actual_coordinate_coverage: analysis.actual_coordinate_coverage,
    region_fallback_count: analysis.region_fallback_count,
  };
}

function totalsFor(analyses) {
  return analyses.reduce((acc, item) => ({
    row_count: acc.row_count + item.row_count,
    coordinate_count: acc.coordinate_count + item.coordinate_count,
    missing_precise_address_count: acc.missing_precise_address_count + item.missing_precise_address_count,
    source_lot_exception_count: acc.source_lot_exception_count + item.source_lot_exception_count,
    missing_coordinate_count: acc.missing_coordinate_count + item.missing_coordinate_count,
    missing_precise_coordinate_address_count: acc.missing_precise_coordinate_address_count + item.missing_precise_coordinate_address_count,
    region_fallback_count: acc.region_fallback_count + item.region_fallback_count,
    duplicate_location_group_count: acc.duplicate_location_group_count + item.duplicate_location_group_count,
    duplicate_location_row_count: acc.duplicate_location_row_count + item.duplicate_location_row_count,
  }), {
    row_count: 0,
    coordinate_count: 0,
    missing_precise_address_count: 0,
    source_lot_exception_count: 0,
    missing_coordinate_count: 0,
    missing_precise_coordinate_address_count: 0,
    region_fallback_count: 0,
    duplicate_location_group_count: 0,
    duplicate_location_row_count: 0,
  });
}

function buildReport(analyses, { authSource, full }) {
  const leaseAnalysis = analyses.find((analysis) => analysis.kind === 'lease');
  if (!leaseAnalysis) throw new Error('Lease analysis is required for the default coordinate precision gate.');
  const addressPrecisionCheckResult = addressPrecisionCheck(analyses);
  const leaseCoordinateCheck = coordinatePrecisionCheck(leaseAnalysis);
  return {
    ok: addressPrecisionCheckResult.ok && leaseCoordinateCheck.ok,
    generated_at: new Date().toISOString(),
    auth_source: authSource,
    mode: full ? 'full' : 'light',
    request_limits: {
      lease: marketReadPayload('lease', { full }).limit,
      supply: marketReadPayload('supply', { full }).limit,
      transactions: marketReadPayload('transactions', { full }).limit,
    },
    scope: 'market-map-visible-rows',
    checks: {
      address_precision: addressPrecisionCheckResult,
      coordinate_precision: leaseCoordinateCheck,
    },
    coordinate_note: 'actual_coordinate_coverage는 저장된 유효 한국 좌표의 비율입니다. 기본 게이트는 lease latest map rows의 좌표 100%와 region fallback 0건을 모두 요구합니다.',
    address_note: '읍/면/동/리 + 본번-부번이 있는 행은 모두 정밀 주소로 통과합니다. 원천에 지번이 없고 산업단지 블록/부지명 또는 리 단위까지만 있는 행은 source_lot_exception으로 따로 남깁니다.',
    totals: totalsFor(analyses),
    analyses,
  };
}

async function signIn(supabaseUrl, anonKey) {
  const accessToken = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (accessToken) return { token: accessToken, source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN' };
  const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or set LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    const message = body.msg || body.message || body.error_description || body.error || 'unknown auth error';
    throw new Error(`Supabase Auth login failed (${response.status}): ${message}`);
  }
  return { token: body.access_token, source: 'password_grant' };
}

async function invoke(supabaseUrl, anonKey, token, action, payload = {}) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action, payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) throw new Error(`${action} failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
  return body.data || {};
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  const auth = await signIn(supabaseUrl, anonKey);
  const full = hasFlag('full');
  const [leaseData, supplyData, transactionData] = await Promise.all([
    invoke(supabaseUrl, anonKey, auth.token, 'sector-market/read', marketReadPayload('lease', { full })),
    invoke(supabaseUrl, anonKey, auth.token, 'sector-market/read', marketReadPayload('supply', { full })),
    invoke(supabaseUrl, anonKey, auth.token, 'sector-market/read', marketReadPayload('transactions', { full })),
  ]);
  const leaseRows = mapRowsForAudit('lease', leaseData);
  const supplyRows = mapRowsForAudit('supply', supplyData);
  const transactionRows = mapRowsForAudit('transactions', transactionData);
  const analyses = [
    analyzeRows('lease', leaseRows),
    analyzeRows('supply', supplyRows),
    analyzeRows('transactions', transactionRows),
  ];
  const report = buildReport(analyses, { authSource: auth.source, full });
  const outJson = path.join(OUT_DIR, `market-map-address-precision-audit-${timestampForFile()}.json`);
  const latestJson = path.join(OUT_DIR, 'market-map-address-precision-audit-latest.json');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, artifact: outJson, checks: report.checks, totals: report.totals }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  });
}

module.exports = {
  addressPrecisionCheck,
  analyzeRows,
  buildReport,
  coordinatePrecisionCheck,
  mapRowsForAudit,
};
