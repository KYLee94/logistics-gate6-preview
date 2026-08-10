#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_ENV_ROOT = path.resolve(ROOT, '..', 'IGIS-Fund-Production-DP');
const DEFAULT_REFERENCE_BASE = 'C:\\Users\\10524\\Desktop\\codex_realasset\\Project\\03_Logi_Leasing_Dashboard';
const expectedAssetCount = 19;
const expectedRowCount = 81;
const ALLOWED_ACTIONS = new Set(['v2/home/read', 'v2/rent-roll/read']);

function flagValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim().replace(/^['"]|['"]$/gu, ''),
      ];
    }));
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function isUndergroundFloor(value) {
  if (isBlank(value)) return false;
  return /(?:^|[^A-Z])B\s*\d|\uc9c0\ud558|BASEMENT/iu.test(String(value).trim());
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace(/,/gu, '').trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function leasedAreaAtOperatingPrecision(value) {
  const numeric = finiteNumber(value);
  return numeric === null ? null : Math.round((numeric + Number.EPSILON) * 100) / 100;
}

function canonicalDate(value, XLSX = null) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  if (typeof value === 'number' && XLSX?.SSF?.parse_date_code) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/u.test(text)) return text;
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/u);
  if (slash) {
    const year = Number(slash[3]) < 100 ? 2000 + Number(slash[3]) : Number(slash[3]);
    return `${year}-${String(slash[1]).padStart(2, '0')}-${String(slash[2]).padStart(2, '0')}`;
  }
  return text;
}

function comparableRow(row) {
  return {
    asset_code: row?.asset_code ?? null,
    tenant_name: row?.tenant_name ?? null,
    leased_area_sqm: leasedAreaAtOperatingPrecision(row?.leased_area_sqm),
    commencement_date: canonicalDate(row?.commencement_date),
    expiry_date: canonicalDate(row?.expiry_date),
  };
}

function exactText(value) {
  return value === null || value === undefined || value === '' ? null : String(value).trim();
}

function exactTupleKey(row) {
  return JSON.stringify(Object.values(comparableRow(row)));
}

function auditFloorRows(asset, rows) {
  const evidence = (Array.isArray(rows) ? rows : []).map((row, index) => ({
    row_index: index + 1,
    asset_code: asset?.asset_code ?? asset?.asset_key ?? null,
    asset_name: asset?.asset_name ?? asset?.name ?? null,
    tenant_name: row?.tenant_name ?? null,
    business_registration_number: row?.business_registration_number ?? null,
    zone_label: row?.zone_label ?? null,
    leased_area_sqm: finiteNumber(row?.leased_area_sqm),
    commencement_date: canonicalDate(row?.commencement_date),
    expiry_date: canonicalDate(row?.expiry_date),
    floor_label: row?.floor_label ?? null,
    floor_blank: isBlank(row?.floor_label),
    underground: isUndergroundFloor(row?.floor_label),
  }));
  return {
    asset_code: asset?.asset_code ?? asset?.asset_key ?? null,
    asset_name: asset?.asset_name ?? asset?.name ?? null,
    row_count: evidence.length,
    floor_blank_count: evidence.filter((row) => row.floor_blank).length,
    floor_blank_rows: evidence.filter((row) => row.floor_blank),
    underground_row_count: evidence.filter((row) => row.underground).length,
    underground_rows: evidence.filter((row) => row.underground),
    rows: evidence,
  };
}

function exactMatchReferenceRows(apiRows, referenceRows) {
  const index = new Map();
  for (const reference of referenceRows || []) {
    const key = exactTupleKey(reference);
    index.set(key, [...(index.get(key) || []), reference]);
  }
  return (apiRows || []).map((row, indexPosition) => {
    const candidates = index.get(exactTupleKey(row)) || [];
    const reference = candidates.length === 1 ? candidates[0] : null;
    return {
      row_index: row?.row_index ?? indexPosition + 1,
      asset_code: row?.asset_code ?? null,
      tenant_name: row?.tenant_name ?? null,
      leased_area_sqm: finiteNumber(row?.leased_area_sqm),
      commencement_date: canonicalDate(row?.commencement_date),
      expiry_date: canonicalDate(row?.expiry_date),
      status: candidates.length === 1 ? 'exact' : candidates.length === 0 ? 'unmatched' : 'ambiguous',
      reference,
      candidates,
      underground_evidence: reference ? isUndergroundFloor(reference.floor_label) : false,
    };
  });
}

function classifyFloorSourceRows(apiRows, referenceRows) {
  const references = Array.isArray(referenceRows) ? referenceRows : [];
  return exactMatchReferenceRows(apiRows, references).map((strictResult, index) => {
    const apiRow = apiRows[index];
    if (strictResult.status === 'exact') {
      return { ...strictResult, status: 'strict_exact', normalization_rule: null };
    }
    if (strictResult.status === 'ambiguous') {
      return { ...strictResult, status: 'ambiguous', normalization_rule: null };
    }

    const sameAssetTenantBusiness = (reference) => (
      exactText(reference?.asset_code) === exactText(apiRow?.asset_code)
      && exactText(reference?.tenant_name) === exactText(apiRow?.tenant_name)
      && exactText(reference?.business_registration_number)
        === exactText(apiRow?.business_registration_number)
    );
    const sameAreaAtTwoDecimals = (reference) => (
      leasedAreaAtOperatingPrecision(reference?.leased_area_sqm)
        === leasedAreaAtOperatingPrecision(apiRow?.leased_area_sqm)
    );
    const areaIntegerCandidates = references.filter((reference) => (
      sameAssetTenantBusiness(reference)
      && canonicalDate(reference?.commencement_date) === canonicalDate(apiRow?.commencement_date)
      && canonicalDate(reference?.expiry_date) === canonicalDate(apiRow?.expiry_date)
      && Number.isInteger(finiteNumber(apiRow?.leased_area_sqm))
      && Math.round(finiteNumber(reference?.leased_area_sqm)) === finiteNumber(apiRow?.leased_area_sqm)
    ));
    const compositeExpiryCandidates = references.filter((reference) => (
      sameAssetTenantBusiness(reference)
      && sameAreaAtTwoDecimals(reference)
      && canonicalDate(reference?.commencement_date) === canonicalDate(apiRow?.commencement_date)
      && canonicalDate(apiRow?.expiry_date) === null
      && /^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/u.test(exactText(reference?.expiry_date) || '')
    ));
    const sourceDashCandidates = references.filter((reference) => (
      sameAssetTenantBusiness(reference)
      && sameAreaAtTwoDecimals(reference)
      && canonicalDate(apiRow?.commencement_date) === null
      && canonicalDate(apiRow?.expiry_date) === null
      && exactText(reference?.commencement_date) === '-'
      && exactText(reference?.expiry_date) === '-'
      && exactText(reference?.floor_label) === '-'
    ));
    const classified = [
      ...areaIntegerCandidates.map((reference) => ({ reference, rule: 'source_area_integer_rounding' })),
      ...compositeExpiryCandidates.map((reference) => ({ reference, rule: 'source_composite_expiry_to_operating_null' })),
      ...sourceDashCandidates.map((reference) => ({ reference, rule: 'source_dash_preserved_as_blank' })),
    ];
    if (classified.length !== 1) {
      return {
        ...strictResult,
        status: classified.length === 0 ? 'unmatched' : 'ambiguous',
        reference: null,
        candidates: classified.map((entry) => entry.reference),
        normalization_rule: null,
      };
    }
    const [{ reference, rule }] = classified;
    return {
      ...strictResult,
      status: rule === 'source_dash_preserved_as_blank'
        ? 'excluded_source_dash'
        : 'approved_unique_normalized',
      reference,
      candidates: [reference],
      normalization_rule: rule,
      underground_evidence: isUndergroundFloor(reference.floor_label),
    };
  });
}

function withoutFloor(row) {
  const clone = { ...(row || {}) };
  delete clone.floor_label;
  return clone;
}

function verifyFloorOnlyTransformation(before, after) {
  assert.ok(Array.isArray(before) && Array.isArray(after), 'ROWS_ARRAY_REQUIRED');
  assert.equal(after.length, before.length, 'ROW_COUNT_CHANGED');
  const changedFloorRows = [];
  for (let index = 0; index < before.length; index += 1) {
    try {
      assert.deepEqual(withoutFloor(after[index]), withoutFloor(before[index]));
    } catch {
      throw new Error(`NON_FLOOR_FIELD_CHANGED:${index + 1}`);
    }
    if ((before[index]?.floor_label ?? null) !== (after[index]?.floor_label ?? null)) {
      changedFloorRows.push(index + 1);
    }
  }
  return {
    before_total: before.length,
    after_total: after.length,
    before_blank: before.filter((row) => isBlank(row?.floor_label)).length,
    after_blank: after.filter((row) => isBlank(row?.floor_label)).length,
    changed_floor_rows: changedFloorRows,
    non_floor_immutable: true,
  };
}

function cellText(value) {
  return value === null || value === undefined ? null : String(value).trim();
}

function headerIndex(header, label) {
  const index = header.findIndex((value) => cellText(value) === label);
  assert.notEqual(index, -1, `REFERENCE_HEADER_MISSING:${label}`);
  return index;
}

function findHeaderRow(rows, requiredLabels) {
  const index = rows.findIndex((row) => requiredLabels.every((label) => (
    row.some((value) => cellText(value) === label)
  )));
  assert.notEqual(index, -1, `REFERENCE_HEADER_ROW_MISSING:${requiredLabels.join(',')}`);
  return index;
}

function resolveReferenceWorkbook(explicitPath = '') {
  if (explicitPath) return path.resolve(explicitPath);
  if (!fs.existsSync(DEFAULT_REFERENCE_BASE)) return '';
  const name = fs.readdirSync(DEFAULT_REFERENCE_BASE)
    .find((candidate) => candidate.includes('260414') && candidate.toLowerCase().endsWith('.xlsx'));
  return name ? path.join(DEFAULT_REFERENCE_BASE, name) : '';
}

function extractReferenceWorkbook(filePath) {
  const XLSX = require('xlsx');
  assert.ok(filePath && fs.existsSync(filePath), 'REFERENCE_WORKBOOK_NOT_FOUND');
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const generalSheet = workbook.Sheets[workbook.SheetNames.find((name) => name === 'DB_\uc77c\ubc18')];
  const historySheet = workbook.Sheets[workbook.SheetNames.find((name) => name === 'DB_\ud788\uc2a4\ud1a0\ub9ac \ub204\uc801')];
  assert.ok(generalSheet && historySheet, 'REFERENCE_REQUIRED_SHEET_MISSING');
  const generalRows = XLSX.utils.sheet_to_json(generalSheet, { header: 1, raw: true, defval: null });
  const historyRows = XLSX.utils.sheet_to_json(historySheet, { header: 1, raw: true, defval: null });

  const generalHeaderRow = findHeaderRow(generalRows, [
    '\uc790\uc0b0\ucf54\ub4dc', '\uc784\ucc28\uc778\uba85', '\uc784\ucc28 \uce35', '\ud604\uc7ac \uacc4\uc57d\uac1c\uc2dc\uc77c', '\ud604\uc7ac \uacc4\uc57d\ub9cc\uae30\uc77c',
  ]);
  const header = generalRows[generalHeaderRow];
  const generalColumns = {
    asset_name: headerIndex(header, '\uc790\uc0b0\uba85'),
    asset_code: headerIndex(header, '\uc790\uc0b0\ucf54\ub4dc'),
    tenant_name: headerIndex(header, '\uc784\ucc28\uc778\uba85'),
    business_registration_number: headerIndex(header, '\uc784\ucc28\uc778 \uc0ac\uc5c5\uc790\ubc88\ud638'),
    floor_label: headerIndex(header, '\uc784\ucc28 \uce35'),
    leased_area_sqm: headerIndex(header, '\uc784\ub300\uba74\uc801'),
    commencement_date: headerIndex(header, '\ud604\uc7ac \uacc4\uc57d\uac1c\uc2dc\uc77c'),
    expiry_date: headerIndex(header, '\ud604\uc7ac \uacc4\uc57d\ub9cc\uae30\uc77c'),
  };
  const general = generalRows.slice(generalHeaderRow + 1).flatMap((row, offset) => {
    const assetCode = cellText(row[generalColumns.asset_code]);
    if (!/^(?:A|AP|S)\w+/u.test(assetCode || '')) return [];
    return [{
      source_sheet: workbook.SheetNames.find((name) => name === 'DB_\uc77c\ubc18'),
      source_row: generalHeaderRow + offset + 2,
      asset_name: cellText(row[generalColumns.asset_name]),
      asset_code: assetCode,
      tenant_name: cellText(row[generalColumns.tenant_name]),
      business_registration_number: cellText(row[generalColumns.business_registration_number]),
      leased_area_sqm: finiteNumber(row[generalColumns.leased_area_sqm]),
      commencement_date: canonicalDate(row[generalColumns.commencement_date], XLSX),
      expiry_date: canonicalDate(row[generalColumns.expiry_date], XLSX),
      floor_label: cellText(row[generalColumns.floor_label]),
    }];
  });

  const historyHeaderRow = findHeaderRow(historyRows, [
    '\uc790\uc0b0\ucf54\ub4dc', '\uc784\ucc28\uc778\uba85', '\uc784\ucc28 \uce35', '\uc784\ub300\uba74\uc801',
  ]);
  const historyHeader = historyRows[historyHeaderRow];
  const historyColumns = {
    asset_code: headerIndex(historyHeader, '\uc790\uc0b0\ucf54\ub4dc'),
    tenant_name: headerIndex(historyHeader, '\uc784\ucc28\uc778\uba85'),
    floor_label: headerIndex(historyHeader, '\uc784\ucc28 \uce35'),
    leased_area_sqm: headerIndex(historyHeader, '\uc784\ub300\uba74\uc801'),
  };
  const history = historyRows.slice(historyHeaderRow + 1).flatMap((row, offset) => {
    const assetCode = cellText(row[historyColumns.asset_code]);
    if (!/^(?:A|AP|S)\w+/u.test(assetCode || '')) return [];
    return [{
      source_sheet: workbook.SheetNames.find((name) => name === 'DB_\ud788\uc2a4\ud1a0\ub9ac \ub204\uc801'),
      source_row: historyHeaderRow + offset + 2,
      asset_code: assetCode,
      tenant_name: cellText(row[historyColumns.tenant_name]),
      leased_area_sqm: finiteNumber(row[historyColumns.leased_area_sqm]),
      floor_label: cellText(row[historyColumns.floor_label]),
    }];
  });
  return { file: filePath, general, history };
}

function independentHistoryEvidence(apiRow, historyRows) {
  const matches = (historyRows || []).filter((row) => (
    row.asset_code === apiRow.asset_code
    && row.tenant_name === apiRow.tenant_name
    && finiteNumber(row.leased_area_sqm) === finiteNumber(apiRow.leased_area_sqm)
  ));
  const floors = [...new Set(matches.map((row) => row.floor_label).filter((value) => !isBlank(value)))].sort();
  return {
    exact_asset_tenant_area_match_count: matches.length,
    floor_values: floors,
    underground_evidence: floors.some(isUndergroundFloor),
    source_rows: matches.map((row) => row.source_row),
  };
}

function runtimeConfig() {
  const envRoot = path.resolve(flagValue('env-root', DEFAULT_ENV_ROOT));
  const fileEnv = {
    ...readEnvFile(path.join(envRoot, '.env')),
    ...readEnvFile(path.join(envRoot, '.env.local')),
  };
  const envValue = (...names) => names
    .map((name) => process.env[name] || fileEnv[name] || '')
    .find(Boolean) || '';
  return {
    supabaseUrl: envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/u, ''),
    anonKey: envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'),
    accessToken: envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN'),
    email: envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'),
    password: envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'),
  };
}

async function acquireAuthenticatedSession(config) {
  assert.ok(config.supabaseUrl && config.anonKey, 'Supabase URL/anon key is missing');
  if (config.accessToken) return { source: 'access_token', token: config.accessToken };
  assert.ok(config.email && config.password, 'Supabase QA login credentials are missing');
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: config.email, password: config.password }),
  });
  const session = await response.json().catch(() => null);
  assert.equal(response.status, 200, 'Supabase password login failed');
  assert.ok(session?.access_token && session?.user?.id, 'Supabase auth session is incomplete');
  return { source: 'password_grant', token: session.access_token };
}

async function invokeRead(config, token, action, payload = {}) {
  assert.ok(ALLOWED_ACTIONS.has(action), `READ_ONLY_ACTION_NOT_ALLOWED:${action}`);
  const response = await fetch(`${config.supabaseUrl}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action, payload }),
  });
  const body = await response.json().catch(() => null);
  assert.equal(response.ok, true, `${action} HTTP ${response.status}`);
  assert.equal(body?.ok, true, `${action} did not return ok:true`);
  assert.equal(body?.status, 'primary', `${action} did not return primary data`);
  assert.ok(body?.request_id, `${action} request_id is missing`);
  assert.ok(body?.data && typeof body.data === 'object', `${action} data is missing`);
  return body;
}

async function collectOperatingFloorAudit(config, token) {
  const bootstrap = await invokeRead(config, token, 'v2/home/read', {});
  const directory = Array.isArray(bootstrap.data?.assets) ? bootstrap.data.assets : [];
  assert.equal(directory.length, expectedAssetCount, `EXPECTED_${expectedAssetCount}_ASSETS_GOT_${directory.length}`);
  const assets = [];
  for (const entry of directory) {
    const assetCode = entry.asset_code || entry.asset_key;
    const response = await invokeRead(config, token, 'v2/rent-roll/read', { asset_code: assetCode, limit: 500 });
    assets.push(auditFloorRows({
      asset_code: assetCode,
      asset_name: entry.name || entry.asset_name || assetCode,
    }, response.data?.rows));
  }
  const total = assets.reduce((sum, asset) => sum + asset.row_count, 0);
  assert.equal(total, expectedRowCount, `EXPECTED_${expectedRowCount}_ROWS_GOT_${total}`);
  return {
    asset_count: assets.length,
    total_row_count: total,
    floor_blank_count: assets.reduce((sum, asset) => sum + asset.floor_blank_count, 0),
    underground_row_count: assets.reduce((sum, asset) => sum + asset.underground_row_count, 0),
    assets,
  };
}

async function main() {
  const config = runtimeConfig();
  const auth = await acquireAuthenticatedSession(config);
  const api = await collectOperatingFloorAudit(config, auth.token);
  const reference = extractReferenceWorkbook(resolveReferenceWorkbook(flagValue('xlsx')));
  const blanks = api.assets.flatMap((asset) => asset.floor_blank_rows);
  const matches = classifyFloorSourceRows(blanks, reference.general).map((match) => ({
    ...match,
    history_evidence: independentHistoryEvidence(match, reference.history),
  }));
  const report = {
    generated_at: new Date().toISOString(),
    mode: 'production_read_only',
    allowed_actions: [...ALLOWED_ACTIONS],
    production_mutation_used: false,
    expected_asset_count: expectedAssetCount,
    expected_row_count: expectedRowCount,
    api,
    reference: {
      file: reference.file,
      general_row_count: reference.general.length,
      history_row_count: reference.history.length,
      leased_area_match_precision_decimals: 2,
    },
    blank_floor_source_matches: matches,
    strict_exact_count: matches.filter((match) => match.status === 'strict_exact').length,
    approved_unique_normalized_count: matches.filter((match) => match.status === 'approved_unique_normalized').length,
    excluded_source_dash_count: matches.filter((match) => match.status === 'excluded_source_dash').length,
    target_source_row_count: matches.filter((match) => (
      match.status === 'strict_exact' || match.status === 'approved_unique_normalized'
    )).length,
    ambiguous_match_count: matches.filter((match) => match.status === 'ambiguous').length,
    unmatched_count: matches.filter((match) => match.status === 'unmatched').length,
    underground_exact_match_count: matches.filter((match) => match.underground_evidence).length,
    underground_history_evidence_count: matches.filter((match) => match.history_evidence.underground_evidence).length,
  };
  if (process.argv.includes('--compact')) {
    report.api.assets = report.api.assets.map(({ rows, ...asset }) => asset);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

module.exports = {
  auditFloorRows,
  canonicalDate,
  classifyFloorSourceRows,
  exactMatchReferenceRows,
  extractReferenceWorkbook,
  independentHistoryEvidence,
  isUndergroundFloor,
  resolveReferenceWorkbook,
  verifyFloorOnlyTransformation,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}
