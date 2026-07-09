const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const EXPECTED_CAP_RATE_SERIES_ROWS = 84;
const EXPECTED_CAP_RATE_CHART_ROWS = EXPECTED_CAP_RATE_SERIES_ROWS * 2;
const EXPECTED_2026_Q1_CAPITAL_CAP_RATE = 0.05283229917850053;
const EXPECTED_2026_Q1_NATIONAL_CAP_RATE = 0.05317220564523085;

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

function approxEqual(actual, expected, tolerance = 0.1) {
  return Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

function text(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function validCoordinate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0;
}

function fillRate(rows, predicate) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const filled = rows.filter(predicate).length;
  return Math.round((filled / rows.length) * 1000) / 10;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  const auth = await signIn(supabaseUrl, anonKey);
  const data = await invoke(supabaseUrl, anonKey, auth.token, 'sector-market/read', { limit: 12000 });
  const summary = data.summary || {};
  const readback = summary.readback || {};
  const sourceAudit = summary.source_audit || {};
  const dataQuality = summary.data_quality || {};
  const leaseRows = Array.isArray(data.leases) ? data.leases : [];
  const supplyRows = Array.isArray(data.supply) ? data.supply : [];
  const transactionRows = Array.isArray(data.transactions) ? data.transactions : [];
  const capRateRows = Array.isArray(data.cap_rates) ? data.cap_rates : [];
  const transactionCharts = data.views?.transactions?.charts || {};
  const mapPoints = [
    ...(Array.isArray(data.views?.lease?.map_points) ? data.views.lease.map_points : []),
    ...(Array.isArray(data.views?.supply?.map_points) ? data.views.supply.map_points : []),
    ...(Array.isArray(data.views?.transactions?.map_points) ? data.views.transactions.map_points : []),
  ];
  const leaseAddressFillRate = fillRate(leaseRows, (row) => text(row.legal_address || row.address));
  const supplyAddressFillRate = fillRate(supplyRows, (row) => text(row.legal_address || row.address));
  const pipelineAddressFillRate = fillRate(supplyRows.filter((row) => row.supply_kind === 'pipeline'), (row) => text(row.legal_address || row.address));
  const newSupplyAddressFillRate = fillRate(supplyRows.filter((row) => row.supply_kind === 'new_supply'), (row) => text(row.legal_address || row.address));
  const transactionAddressFillRate = fillRate(transactionRows, (row) => text(row.legal_address || row.address));
  const mapPointAddressFillRate = fillRate(mapPoints, (row) => text(row.address));
  const mapPointCoordinateFillRate = fillRate(mapPoints, (row) => text(row.address) && validCoordinate(row.latitude) && validCoordinate(row.longitude) && text(row.source) !== 'region-fallback');
  const mapPointCoordinateSourceFillRate = fillRate(mapPoints, (row) => text(row.coordinate_source) && text(row.coordinate_address));
  const capRateValueFillRate = fillRate(capRateRows, (row) => number(row.cap_rate || row.value) !== 0);
  const capRateValuesInRange = capRateRows.every((row) => {
    const value = number(row.cap_rate || row.value);
    return value > 0 && value < 0.2;
  });
  const latestCapRateRows = capRateRows.filter((row) => Number(row.report_year) === 2026 && text(row.report_quarter) === 'Q1');
  const latestCapitalCapRate = latestCapRateRows.find((row) => text(row.region).includes('수도권'));
  const latestNationalCapRate = latestCapRateRows.find((row) => text(row.region).includes('전국'));
  const mapPointCoordinateSamples = mapPoints
    .filter((row) => text(row.address) && validCoordinate(row.latitude) && validCoordinate(row.longitude))
    .slice(0, 20)
    .map((row) => ({
      kind: row.kind,
      label: row.label,
      region: row.region,
      address: row.address,
      generated_address: row.generated_address,
      address_rule: row.address_rule,
      latitude: row.latitude,
      longitude: row.longitude,
      coordinate_source: row.coordinate_source,
      coordinate_address: row.coordinate_address,
      source: row.source,
    }));
  const checks = {
    status_ready: summary.status === 'ready',
    data_validated: data.data_validated === true,
    validation_status_ready: data.validation_status === 'ready',
    active_source_only: Boolean(summary.source?.active_version && summary.source?.source_file_id),
    source_sheet_count: sourceAudit.sheet_count === 9,
    source_row_count: sourceAudit.source_row_count === 11738,
    source_sheet_readback_all_pass: Array.isArray(sourceAudit.sheet_readback) && sourceAudit.sheet_readback.length === 9 && sourceAudit.sheet_readback.every((row) => row.ok !== false && row.expected_rows === row.actual_rows),
    lease_count: summary.lease_observation_count === 9610,
    transaction_count: summary.transaction_case_count === 541,
    pipeline_supply_count: summary.pipeline_supply_count === 267,
    supply_total_count: summary.supply_case_count === 276,
    new_supply_count: summary.new_supply_count === 9,
    cap_rate_series_count: summary.cap_rate_series_count === EXPECTED_CAP_RATE_SERIES_ROWS,
    new_supply_total_gross_area_py: approxEqual(summary.new_supply_total_gross_area_py, 111517.9),
    readback_all_pass: Object.values(readback).every((item) => item && item.ok !== false),
    sample_non_empty: Array.isArray(data.leases) && data.leases.length > 0
      && Array.isArray(data.supply) && data.supply.length > 0
      && Array.isArray(data.transactions) && data.transactions.length > 0,
    lease_sample_full: Array.isArray(data.leases) && data.leases.length === 9610,
    lease_area_fill_rate: Number(dataQuality.lease_area_fill_rate || 0) >= 95,
    lease_rent_fill_rate: Number(dataQuality.lease_rent_fill_rate || 0) >= 50,
    transaction_area_fill_rate: Number(dataQuality.transaction_area_fill_rate || 0) >= 95,
    transaction_unit_price_fill_rate: Number(dataQuality.transaction_unit_price_fill_rate || 0) >= 95,
    lease_address_fill_rate: leaseAddressFillRate >= 95,
    supply_expected_period_fill_rate: Number(dataQuality.supply_expected_period_fill_rate || 0) >= 15,
    supply_address_fill_rate: supplyAddressFillRate >= 95,
    pipeline_address_fill_rate: pipelineAddressFillRate >= 95,
    new_supply_address_fill_rate: newSupplyAddressFillRate >= 95,
    transaction_address_fill_rate: transactionAddressFillRate >= 95,
    map_point_address_fill_rate: mapPointAddressFillRate >= 95,
    transaction_amount_by_year_non_empty: Array.isArray(transactionCharts.amount_by_year) && transactionCharts.amount_by_year.length > 0,
    transaction_amount_by_region_non_empty: Array.isArray(transactionCharts.amount_by_region) && transactionCharts.amount_by_region.length > 0,
    transaction_unit_price_by_size_non_empty: Array.isArray(transactionCharts.unit_price_by_size) && transactionCharts.unit_price_by_size.length > 0,
    cap_rate_chart_non_empty: Array.isArray(transactionCharts.cap_rate_series) && transactionCharts.cap_rate_series.length > 0,
    cap_rate_value_fill_rate: capRateValueFillRate >= 95,
    cap_rate_chart_count: Array.isArray(transactionCharts.cap_rate_series) && transactionCharts.cap_rate_series.length === EXPECTED_CAP_RATE_CHART_ROWS,
    cap_rate_values_in_reasonable_range: capRateValuesInRange,
    cap_rate_2026_q1_capital_matches_excel: approxEqual(latestCapitalCapRate?.cap_rate, EXPECTED_2026_Q1_CAPITAL_CAP_RATE, 0.000000000001),
    cap_rate_2026_q1_national_matches_excel: approxEqual(latestNationalCapRate?.cap_rate, EXPECTED_2026_Q1_NATIONAL_CAP_RATE, 0.000000000001),
    views_present: Boolean(data.views?.overview && data.views?.lease && data.views?.supply && data.views?.transactions && data.views?.source),
  };
  const report = {
    ok: Object.values(checks).every(Boolean),
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    checks,
    observed: {
      status: summary.status,
      source_file: summary.source?.file_name || null,
      source: summary.source || null,
      lease_observation_count: summary.lease_observation_count,
      transaction_case_count: summary.transaction_case_count,
      pipeline_supply_count: summary.pipeline_supply_count,
      new_supply_total_gross_area_py: summary.new_supply_total_gross_area_py,
      sample_counts: summary.sample_counts,
      data_quality: {
        ...dataQuality,
        lease_address_fill_rate: leaseAddressFillRate,
        supply_address_fill_rate: supplyAddressFillRate,
        pipeline_address_fill_rate: pipelineAddressFillRate,
        new_supply_address_fill_rate: newSupplyAddressFillRate,
        transaction_address_fill_rate: transactionAddressFillRate,
        map_point_address_fill_rate: mapPointAddressFillRate,
        map_point_coordinate_fill_rate: mapPointCoordinateFillRate,
        map_point_coordinate_source_fill_rate: mapPointCoordinateSourceFillRate,
        cap_rate_value_fill_rate: capRateValueFillRate,
      },
      map_point_coordinate_samples: mapPointCoordinateSamples,
      chart_counts: {
        transaction_amount_by_year: Array.isArray(transactionCharts.amount_by_year) ? transactionCharts.amount_by_year.length : 0,
        transaction_amount_by_region: Array.isArray(transactionCharts.amount_by_region) ? transactionCharts.amount_by_region.length : 0,
        transaction_unit_price_by_size: Array.isArray(transactionCharts.unit_price_by_size) ? transactionCharts.unit_price_by_size.length : 0,
        cap_rate_series: Array.isArray(transactionCharts.cap_rate_series) ? transactionCharts.cap_rate_series.length : 0,
      },
      cap_rate_latest_2026_q1: {
        capital_area: latestCapitalCapRate || null,
        national: latestNationalCapRate || null,
      },
      readback,
      source_audit: sourceAudit,
    },
  };
  const outJson = path.join(OUT_DIR, `market-data-readback-smoke-${timestampForFile()}.json`);
  const latestJson = path.join(OUT_DIR, 'market-data-readback-smoke-latest.json');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, artifact: outJson, checks, observed: report.observed }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
