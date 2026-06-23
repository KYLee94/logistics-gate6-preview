const fs = require('fs');
const path = require('path');

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
  return /(?:읍|면|동|리)\s+(?:산\s*)?\d{1,5}(?:-\d{1,5})?\s*$/u.test(text(value));
}

function hasCoordinate(value) {
  if (value === undefined || value === null || text(value) === '') return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0;
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
      coordinatePresent: hasCoordinate(row.latitude) && hasCoordinate(row.longitude),
      regionFallback: /region|fallback|missing/iu.test(coordinateSource),
    };
  });
  const missingPreciseAddress = inspected.filter((item) => !item.preciseAddress);
  const missingCoordinate = inspected.filter((item) => !item.coordinatePresent);
  const regionFallback = inspected.filter((item) => item.regionFallback);
  const missingCoordinateAddress = inspected.filter((item) => !item.preciseCoordinateAddress);
  return {
    kind,
    row_count: rows.length,
    precise_address_count: inspected.length - missingPreciseAddress.length,
    missing_precise_address_count: missingPreciseAddress.length,
    coordinate_count: inspected.length - missingCoordinate.length,
    missing_coordinate_count: missingCoordinate.length,
    precise_coordinate_address_count: inspected.length - missingCoordinateAddress.length,
    missing_precise_coordinate_address_count: missingCoordinateAddress.length,
    region_fallback_count: regionFallback.length,
    missing_precise_address_samples: missingPreciseAddress.slice(0, 20).map((item) => compactSample(item.row, kind)),
    missing_coordinate_samples: missingCoordinate.slice(0, 20).map((item) => compactSample(item.row, kind)),
    region_fallback_samples: regionFallback.slice(0, 20).map((item) => compactSample(item.row, kind)),
    deokpyeong_samples: inspected
      .filter((item) => /덕평|마장면/iu.test(`${rowLabel(item.row)} ${item.address} ${item.coordinateAddress}`))
      .slice(0, 30)
      .map((item) => compactSample(item.row, kind)),
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
  const data = await invoke(supabaseUrl, anonKey, auth.token, 'sector-market/read', { limit: 12000 });
  const leaseRows = Array.isArray(data.leases) ? data.leases : [];
  const supplyRows = Array.isArray(data.supply) ? data.supply : [];
  const transactionRows = Array.isArray(data.transactions) ? data.transactions : [];
  const analyses = [
    analyzeRows('lease', leaseRows),
    analyzeRows('supply', supplyRows),
    analyzeRows('transactions', transactionRows),
  ];
  const totals = analyses.reduce((acc, item) => ({
    row_count: acc.row_count + item.row_count,
    missing_precise_address_count: acc.missing_precise_address_count + item.missing_precise_address_count,
    missing_coordinate_count: acc.missing_coordinate_count + item.missing_coordinate_count,
    missing_precise_coordinate_address_count: acc.missing_precise_coordinate_address_count + item.missing_precise_coordinate_address_count,
    region_fallback_count: acc.region_fallback_count + item.region_fallback_count,
  }), {
    row_count: 0,
    missing_precise_address_count: 0,
    missing_coordinate_count: 0,
    missing_precise_coordinate_address_count: 0,
    region_fallback_count: 0,
  });
  const report = {
    ok: totals.missing_precise_address_count === 0
      && totals.missing_coordinate_count === 0
      && totals.missing_precise_coordinate_address_count === 0
      && totals.region_fallback_count === 0,
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    totals,
    analyses,
  };
  const outJson = path.join(OUT_DIR, `market-map-address-precision-audit-${timestampForFile()}.json`);
  const latestJson = path.join(OUT_DIR, 'market-map-address-precision-audit-latest.json');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, artifact: outJson, totals }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
