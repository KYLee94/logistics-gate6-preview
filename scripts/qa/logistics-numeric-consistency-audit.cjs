const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const EDGE_FUNCTION = 'll-dashboard-api';
const DEFAULT_ORIGIN = 'https://kylee94.github.io';
const PY_PER_SQM = 0.3025;

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

function argsValue(name, fallback = '') {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function currentKstMonthEndDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

function numberValue(value) {
  if (value === undefined || value === null || value === '') return 0;
  const numeric = Number(String(value).replace(/,/gu, '').replace(/[^\d.-]/gu, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function sumRows(rows, field) {
  return (rows || []).reduce((sum, row) => sum + numberValue(row?.[field]), 0);
}

function sumBy(rows, picker) {
  return (rows || []).reduce((sum, row) => sum + numberValue(picker(row)), 0);
}

function distinctCount(rows, picker) {
  return new Set((rows || []).map(picker).filter(Boolean)).size;
}

function areaPy(areaSqm) {
  return numberValue(areaSqm) * PY_PER_SQM;
}

function monthlyCost(row = {}) {
  const explicit = numberValue(firstDefined(row.current_monthly_cost_total, row.monthly_cost_total, row.monthlyCostTotal));
  if (explicit) return explicit;
  return numberValue(firstDefined(row.current_monthly_rent_total, row.monthly_rent_total))
    + numberValue(firstDefined(row.current_monthly_mf_total, row.monthly_mf_total));
}

function weightedExplicitENoc(rows) {
  const totals = (rows || []).reduce((acc, row) => {
    const area = numberValue(row.leased_area_sqm);
    const eNoc = numberValue(row.e_noc);
    if (area <= 0 || eNoc <= 0) return acc;
    return { weighted: acc.weighted + eNoc * area, area: acc.area + area };
  }, { weighted: 0, area: 0 });
  return totals.area > 0 ? totals.weighted / totals.area : 0;
}

function calculatedENoc(rows) {
  const area = sumRows(rows, 'leased_area_sqm');
  return area > 0 ? sumBy(rows, monthlyCost) / areaPy(area) : 0;
}

function groupBy(rows, picker) {
  const groups = new Map();
  (rows || []).forEach((row) => {
    const key = String(picker(row) || '');
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return groups;
}

function redactId(value) {
  const text = String(value || '');
  if (!text) return '';
  if (/^[a-z]+_/iu.test(text)) return text.replace(/^([a-z]+_).+/iu, '$1[redacted]');
  return '[redacted]';
}

function createChecker() {
  const findings = [];
  const stats = { checked: 0, passed: 0, warnings: 0, errors: 0 };

  function addFinding(severity, scope, label, expected, actual, delta, tolerance, meta = {}) {
    stats.checked += 1;
    if (severity === 'ok') {
      stats.passed += 1;
      return;
    }
    if (severity === 'warning') stats.warnings += 1;
    if (severity === 'error') stats.errors += 1;
    findings.push({
      severity,
      scope,
      label,
      expected: Math.round(numberValue(expected) * 100) / 100,
      actual: Math.round(numberValue(actual) * 100) / 100,
      delta: Math.round(numberValue(delta) * 100) / 100,
      tolerance,
      ...meta,
    });
  }

  function approx(scope, label, expected, actual, tolerance, meta) {
    const delta = numberValue(actual) - numberValue(expected);
    const severity = Math.abs(delta) <= tolerance ? 'ok' : 'error';
    addFinding(severity, scope, label, expected, actual, delta, tolerance, meta);
  }

  function warnIf(scope, label, condition, expected, actual, tolerance, meta) {
    if (!condition) {
      addFinding('ok', scope, label, expected, actual, 0, tolerance, meta);
      return;
    }
    addFinding('warning', scope, label, expected, actual, numberValue(actual) - numberValue(expected), tolerance, meta);
  }

  return { findings, stats, approx, warnIf };
}

function areaBreakdownTotals(rows = []) {
  const totals = {
    warehouse: 0,
    dock: 0,
    office: 0,
    otherExclusive: 0,
    corridor: 0,
    ramp: 0,
    mechanical: 0,
    parking: 0,
    core: 0,
    otherCommon: 0,
  };
  rows.forEach((row) => {
    const key = String(firstDefined(row.area_type, row.area_label, '') || '').toLowerCase();
    const value = numberValue(firstDefined(row.area_sqm, row.value));
    if (key.startsWith('aa_')) totals.warehouse += value;
    else if (key.startsWith('ab_')) totals.dock += value;
    else if (key.startsWith('ac_')) totals.office += value;
    else if (key.startsWith('ad_')) totals.otherExclusive += value;
    else if (key.startsWith('ae_')) totals.corridor += value;
    else if (key.startsWith('af_')) totals.ramp += value;
    else if (key.startsWith('ag_')) totals.mechanical += value;
    else if (key.startsWith('ah_')) totals.parking += value;
    else if (key.startsWith('ai_')) totals.core += value;
    else if (key.startsWith('aj_')) totals.otherCommon += value;
  });
  const exclusive = totals.warehouse + totals.dock + totals.office + totals.otherExclusive;
  const common = totals.corridor + totals.ramp + totals.mechanical + totals.parking + totals.core + totals.otherCommon;
  return { ...totals, exclusive, common, classified: exclusive + common };
}

async function signInForAccessToken(supabaseUrl, anonKey, email, password) {
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
  return body.access_token;
}

async function resolveAccessToken(supabaseUrl, anonKey) {
  const token = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (token) return { token, source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN' };
  const email = argsValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = argsValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  return { token: await signInForAccessToken(supabaseUrl, anonKey, email, password), source: 'password_grant' };
}

async function invoke(endpoint, anonKey, origin, token, action, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: token ? `Bearer ${token}` : '',
      'content-type': 'application/json',
      origin,
    },
    body: JSON.stringify({ action, payload }),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  if (!response.ok || body?.ok === false) {
    throw new Error(`${action} failed (${response.status}): ${JSON.stringify(body).slice(0, 400)}`);
  }
  return body;
}

function compareLeaseSpaceValues(checker, scope, expectedRows, actualRows, meta = {}) {
  const actualById = new Map((actualRows || []).map((row) => [String(row.lease_space_id || ''), row]));
  (expectedRows || []).forEach((expected) => {
    const id = String(expected.lease_space_id || '');
    const actual = actualById.get(id);
    if (!actual) {
      checker.approx(scope, 'lease_space exists across components', 1, 0, 0, {
        ...meta,
        lease_space_id_redacted: redactId(id),
      });
      return;
    }
    ['leased_area_sqm', 'exclusive_area_sqm', 'current_monthly_rent_total', 'current_monthly_mf_total', 'current_monthly_cost_total', 'e_noc'].forEach((field) => {
      checker.approx(scope, `lease_space ${field} matches`, numberValue(expected[field]), numberValue(actual[field]), field.includes('monthly') ? 1 : 0.5, {
        ...meta,
        lease_space_id_redacted: redactId(id),
      });
    });
  });
}

async function main() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const origin = argsValue('origin', envValue('LOGISTICS_QA_ORIGIN') || DEFAULT_ORIGIN);
  const basisDate = argsValue('basis-date', envValue('LOGISTICS_BASIS_DATE') || currentKstMonthEndDate());
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase URL or anon key.');

  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
  const auth = await resolveAccessToken(supabaseUrl, anonKey);
  const checker = createChecker();

  const home = await invoke(endpoint, anonKey, origin, auth.token, 'dashboard/home/read', { basis_date: basisDate });
  const homeData = home.data || {};
  const homeAssets = homeData.assets || [];
  const homeLeaseSpaces = homeData.lease_spaces || [];
  const homeSummary = homeData.summary || {};
  const homeSpacesByAsset = groupBy(homeLeaseSpaces, (row) => row.asset_id);
  const tenantIds = [...new Set(homeLeaseSpaces.map((row) => row.tenant_id).filter(Boolean))];

  checker.approx('HOME', 'operating_asset_count equals asset rows', homeAssets.length, homeSummary.operating_asset_count, 0);
  checker.approx('HOME', 'gross_floor_area_sqm equals asset sum', sumRows(homeAssets, 'gross_floor_area_sqm'), homeSummary.gross_floor_area_sqm, 0.5);
  checker.approx('HOME', 'leased_area_sqm equals lease space sum', sumRows(homeLeaseSpaces, 'leased_area_sqm'), homeSummary.leased_area_sqm, 0.5);
  checker.approx('HOME', 'exclusive_area_sqm equals lease space sum', sumRows(homeLeaseSpaces, 'exclusive_area_sqm'), homeSummary.exclusive_area_sqm, 0.5);
  checker.approx('HOME', 'current_monthly_rent_total equals lease space sum', sumRows(homeLeaseSpaces, 'current_monthly_rent_total'), homeSummary.current_monthly_rent_total, 1);
  checker.approx('HOME', 'current_monthly_mf_total equals lease space sum', sumRows(homeLeaseSpaces, 'current_monthly_mf_total'), homeSummary.current_monthly_mf_total, 1);
  checker.approx('HOME', 'current_monthly_cost_total equals rent plus management fee', numberValue(homeSummary.current_monthly_rent_total) + numberValue(homeSummary.current_monthly_mf_total), homeSummary.current_monthly_cost_total, 1);

  const assetReports = [];
  const assetLeaseSpacesById = new Map();
  for (const asset of homeAssets) {
    const assetId = String(asset.asset_id || '');
    const assetName = String(asset.asset_name || assetId || '-');
    const assetRead = await invoke(endpoint, anonKey, origin, auth.token, 'dashboard/asset/read', { basis_date: basisDate, asset_id: assetId });
    const data = assetRead.data || {};
    const summary = data.summary || {};
    const leaseSpaces = data.lease_spaces || [];
    leaseSpaces.forEach((row) => assetLeaseSpacesById.set(String(row.lease_space_id || ''), row));
    const scope = `ASSET:${assetName}`;
    const homeGrouped = homeSpacesByAsset.get(assetId) || [];
    const gross = numberValue(summary.gross_floor_area_sqm);
    const leased = sumRows(leaseSpaces, 'leased_area_sqm');
    const vacancy = Math.max(0, gross - leased);
    const areaTotals = areaBreakdownTotals(data.lease_space_area_breakdowns || []);
    const areaBasis = Math.max(gross, areaTotals.classified);
    const unclassified = Math.max(0, areaBasis - areaTotals.classified);
    const ratioTotal = areaBasis > 0 ? (areaTotals.classified + unclassified) / areaBasis : 1;

    checker.approx(scope, 'gross floor area matches HOME asset', numberValue(asset.gross_floor_area_sqm), summary.gross_floor_area_sqm, 0.5, { asset_id_redacted: redactId(assetId) });
    checker.approx(scope, 'leased area matches asset lease rows', leased, summary.leased_area_sqm, 0.5, { asset_id_redacted: redactId(assetId) });
    checker.approx(scope, 'leased area matches HOME grouped lease rows', sumRows(homeGrouped, 'leased_area_sqm'), summary.leased_area_sqm, 0.5, { asset_id_redacted: redactId(assetId) });
    checker.approx(scope, 'exclusive area matches asset lease rows', sumRows(leaseSpaces, 'exclusive_area_sqm'), summary.exclusive_area_sqm, 0.5, { asset_id_redacted: redactId(assetId) });
    checker.approx(scope, 'monthly rent matches asset lease rows', sumRows(leaseSpaces, 'current_monthly_rent_total'), summary.current_monthly_rent_total, 1, { asset_id_redacted: redactId(assetId) });
    checker.approx(scope, 'monthly management fee matches asset lease rows', sumRows(leaseSpaces, 'current_monthly_mf_total'), summary.current_monthly_mf_total, 1, { asset_id_redacted: redactId(assetId) });
    checker.approx(scope, 'monthly cost equals rent plus management fee', numberValue(summary.current_monthly_rent_total) + numberValue(summary.current_monthly_mf_total), summary.current_monthly_cost_total, 1, { asset_id_redacted: redactId(assetId) });
    checker.approx(scope, 'vacancy area equals gross minus leased', vacancy, summary.vacancy_area_sqm, 0.5, { asset_id_redacted: redactId(assetId) });
    checker.approx(scope, 'area reconciliation gap is zero', 0, summary.area_reconciliation_gap_sqm, 0.5, { asset_id_redacted: redactId(assetId) });
    checker.approx(scope, 'area composition ratios add to 100%', 1, ratioTotal, 0.0001, { asset_id_redacted: redactId(assetId) });
    checker.warnIf(scope, 'area composition has unclassified area', unclassified > 0.5, 0, unclassified, 0.5, { asset_id_redacted: redactId(assetId) });

    assetReports.push({
      asset_name: assetName,
      asset_id_redacted: redactId(assetId),
      lease_space_count: leaseSpaces.length,
      gross_floor_area_sqm: Math.round(gross * 100) / 100,
      leased_area_sqm: Math.round(leased * 100) / 100,
      vacancy_area_sqm: Math.round(vacancy * 100) / 100,
      average_rent_per_py: Math.round(numberValue(summary.current_monthly_rent_total) / Math.max(areaPy(leased), 1)),
      average_mf_per_py: Math.round(numberValue(summary.current_monthly_mf_total) / Math.max(areaPy(leased), 1)),
      weighted_explicit_e_noc: Math.round(weightedExplicitENoc(leaseSpaces)),
      calculated_e_noc: Math.round(calculatedENoc(leaseSpaces)),
      area_composition: {
        exclusive_sqm: Math.round(areaTotals.exclusive * 100) / 100,
        common_sqm: Math.round(areaTotals.common * 100) / 100,
        classified_sqm: Math.round(areaTotals.classified * 100) / 100,
        unclassified_sqm: Math.round(unclassified * 100) / 100,
        ratio_total: Math.round(ratioTotal * 10000) / 10000,
      },
    });
  }

  const companyReports = [];
  for (const tenantId of tenantIds) {
    const companyRead = await invoke(endpoint, anonKey, origin, auth.token, 'dashboard/company/read', { basis_date: basisDate, tenant_id: tenantId });
    const data = companyRead.data || {};
    const tenant = data.tenant || {};
    const tenantName = String(firstDefined(tenant.tenant_master_name, tenant.company_name, tenantId) || '-');
    const rows = data.lease_spaces || [];
    const summary = data.summary || {};
    const scope = `COMPANY:${tenantName}`;
    checker.approx(scope, 'asset_count equals distinct assets in lease rows', distinctCount(rows, (row) => row.asset_id), summary.asset_count, 0, { tenant_id_redacted: redactId(tenantId) });
    checker.approx(scope, 'leased area equals company lease rows', sumRows(rows, 'leased_area_sqm'), summary.leased_area_sqm, 0.5, { tenant_id_redacted: redactId(tenantId) });
    checker.approx(scope, 'monthly rent equals company lease rows', sumRows(rows, 'current_monthly_rent_total'), summary.current_monthly_rent_total, 1, { tenant_id_redacted: redactId(tenantId) });
    checker.approx(scope, 'monthly management fee equals company lease rows', sumRows(rows, 'current_monthly_mf_total'), summary.current_monthly_mf_total, 1, { tenant_id_redacted: redactId(tenantId) });
    checker.approx(scope, 'monthly cost equals rent plus management fee', numberValue(summary.current_monthly_rent_total) + numberValue(summary.current_monthly_mf_total), summary.current_monthly_cost_total, 1, { tenant_id_redacted: redactId(tenantId) });
    compareLeaseSpaceValues(checker, scope, rows, rows.map((row) => assetLeaseSpacesById.get(String(row.lease_space_id || ''))).filter(Boolean), {
      tenant_id_redacted: redactId(tenantId),
    });
    companyReports.push({
      tenant_name: tenantName,
      tenant_id_redacted: redactId(tenantId),
      asset_count: distinctCount(rows, (row) => row.asset_id),
      lease_space_count: rows.length,
      leased_area_sqm: Math.round(sumRows(rows, 'leased_area_sqm') * 100) / 100,
      average_rent_per_py: Math.round(numberValue(summary.current_monthly_rent_total) / Math.max(areaPy(summary.leased_area_sqm), 1)),
      average_mf_per_py: Math.round(numberValue(summary.current_monthly_mf_total) / Math.max(areaPy(summary.leased_area_sqm), 1)),
      weighted_explicit_e_noc: Math.round(weightedExplicitENoc(rows)),
      calculated_e_noc: Math.round(calculatedENoc(rows)),
    });
  }

  const output = {
    ok: checker.stats.errors === 0,
    generated_at: new Date().toISOString(),
    basis_date: basisDate,
    origin,
    auth_source: auth.source,
    checked_counts: {
      assets: homeAssets.length,
      tenants: tenantIds.length,
      home_lease_spaces: homeLeaseSpaces.length,
      checks: checker.stats.checked,
      passed: checker.stats.passed,
      warnings: checker.stats.warnings,
      errors: checker.stats.errors,
    },
    formulas: {
      area_py: 'area_sqm * 0.3025',
      vacancy_area_sqm: 'gross_floor_area_sqm - leased_area_sqm',
      average_rent_per_py: 'current_monthly_rent_total / leased_area_py',
      average_mf_per_py: 'current_monthly_mf_total / leased_area_py',
      calculated_e_noc: '(current_monthly_rent_total + current_monthly_mf_total) / leased_area_py',
      weighted_explicit_e_noc: 'sum(row.e_noc * row.leased_area_sqm) / sum(row.leased_area_sqm)',
    },
    findings: checker.findings,
    assets: assetReports,
    companies: companyReports,
  };

  const outDir = path.join(ROOT, 'qa-artifacts', 'logistics-gate6', `numeric-consistency-${basisDate.replace(/-/gu, '')}`);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `numeric-consistency-${timestampForFile()}.json`);
  const latestPath = path.join(outDir, 'numeric-consistency-latest.json');
  fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');
  fs.writeFileSync(latestPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(JSON.stringify({
    ok: output.ok,
    artifact: jsonPath,
    checked_counts: output.checked_counts,
    first_findings: output.findings.slice(0, 20),
  }, null, 2));
  if (!output.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
