#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_ENV_ROOT = path.resolve(ROOT, '..', 'IGIS-Fund-Production-DP');
const DEFAULT_LIVE_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const READ_ONLY_DEFAULT = true;
const expectedAssetCount = 19;
const timeoutMs = 45_000;

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function flagValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || undefined;
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

const envRoot = path.resolve(flagValue('env-root', DEFAULT_ENV_ROOT));
const fileEnv = {
  ...readEnvFile(path.join(envRoot, '.env')),
  ...readEnvFile(path.join(envRoot, '.env.local')),
};
const envValue = (...names) => names
  .map((name) => process.env[name] || fileEnv[name] || '')
  .find(Boolean) || '';
const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/u, '');
const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
const accessTokenFromEnv = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
const authEmail = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
const authPassword = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sumArea(rows) {
  return rows.reduce((sum, row) => sum + (finiteNumber(row?.leased_area_sqm) || 0), 0);
}

function rate(numerator, denominator) {
  return finiteNumber(denominator) > 0
    ? Number((Number(numerator || 0) / Number(denominator) * 100).toFixed(2))
    : null;
}

function todayKst() {
  return new Date(Date.now() + (9 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

async function acquireAuthenticatedSession() {
  assert.ok(supabaseUrl && anonKey, 'Supabase URL/anon key is missing');
  if (accessTokenFromEnv) {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${accessTokenFromEnv}` },
    });
    const user = await response.json().catch(() => null);
    assert.equal(response.status, 200, 'Supabase access token validation failed');
    assert.ok(user?.id, 'Supabase access token user is missing');
    return {
      source: 'access_token',
      session: {
        access_token: accessTokenFromEnv,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.round(Date.now() / 1000) + 3600,
        refresh_token: '',
        user,
      },
    };
  }
  assert.ok(authEmail && authPassword, 'Supabase QA login credentials are missing');
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: authEmail, password: authPassword }),
  });
  const session = await response.json().catch(() => null);
  assert.equal(response.status, 200, 'Supabase password login failed');
  assert.ok(session?.access_token && session?.user?.id, 'Supabase auth session is incomplete');
  if (!session.expires_at && session.expires_in) {
    session.expires_at = Math.round(Date.now() / 1000) + Number(session.expires_in);
  }
  return { source: 'password_grant', session };
}

async function invokeRaw(token, action, payload = {}) {
  const response = await fetch(`${supabaseUrl}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action, payload }),
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 500) }; }
  return { status: response.status, ok: response.ok, body };
}

async function invoke(token, action, payload = {}) {
  const result = await invokeRaw(token, action, payload);
  assert.equal(
    result.ok,
    true,
    `${action} HTTP ${result.status}: ${result.body?.error || result.body?.message || 'unknown'}`,
  );
  assert.equal(result.body?.ok, true, `${action} did not return ok:true`);
  assert.equal(result.body?.status, 'primary', `${action} did not return primary data`);
  assert.ok(result.body?.request_id, `${action} request_id is missing`);
  assert.ok(Object.hasOwn(result.body, 'revision'), `${action} revision is missing`);
  assert.ok(result.body?.data && typeof result.body.data === 'object', `${action} data is missing`);
  return result.body;
}

async function loadDocumentContract() {
  const filePath = path.join(ROOT, 'src', 'features', 'logistics-data-platform', 'documentContract.js');
  return import(`${pathToFileURL(filePath).href}?qa=${Date.now()}`);
}

function documentValueType(value, present = true) {
  if (!present) return 'missing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function firstDocumentMismatches(expected, actual, limit = 12, rootPath = '$') {
  const mismatches = [];
  const visit = (expectedValue, actualValue, currentPath, expectedPresent = true, actualPresent = true) => {
    if (mismatches.length >= limit) return;
    const expectedType = documentValueType(expectedValue, expectedPresent);
    const actualType = documentValueType(actualValue, actualPresent);
    if (expectedType !== actualType) {
      mismatches.push({
        path: currentPath,
        expected_type: expectedType,
        actual_type: actualType,
        expected_value: expectedPresent ? expectedValue : '__MISSING__',
        actual_value: actualPresent ? actualValue : '__MISSING__',
      });
      return;
    }
    if (expectedType === 'array') {
      if (expectedValue.length !== actualValue.length) {
        mismatches.push({
          path: `${currentPath}.length`,
          expected_type: 'number',
          actual_type: 'number',
          expected_value: expectedValue.length,
          actual_value: actualValue.length,
        });
      }
      const length = Math.max(expectedValue.length, actualValue.length);
      for (let index = 0; index < length && mismatches.length < limit; index += 1) {
        visit(
          expectedValue[index],
          actualValue[index],
          `${currentPath}[${index}]`,
          index < expectedValue.length,
          index < actualValue.length,
        );
      }
      return;
    }
    if (expectedType === 'object') {
      const fields = [...new Set([...Object.keys(expectedValue), ...Object.keys(actualValue)])].sort();
      for (const field of fields) {
        if (mismatches.length >= limit) break;
        visit(
          expectedValue[field],
          actualValue[field],
          `${currentPath}.${field}`,
          Object.hasOwn(expectedValue, field),
          Object.hasOwn(actualValue, field),
        );
      }
      return;
    }
    if (!Object.is(expectedValue, actualValue)) {
      mismatches.push({
        path: currentPath,
        expected_type: expectedType,
        actual_type: actualType,
        expected_value: expectedValue,
        actual_value: actualValue,
      });
    }
  };
  visit(expected, actual, rootPath);
  return mismatches.slice(0, limit);
}

function assertDocumentReadback(documentsEqual, label, expected, actual, detail = {}) {
  if (documentsEqual(expected, actual)) return;
  assert.fail(`${label}_READBACK_MISMATCH ${JSON.stringify({
    ...detail,
    first_mismatches: detail.first_mismatches || firstDocumentMismatches(expected, actual),
  })}`);
}

async function collectAssetOccupancyCandidates(token) {
  const bootstrap = await invoke(token, 'v2/home/read', {});
  const assets = Array.isArray(bootstrap.data?.assets) ? bootstrap.data.assets : [];
  assert.equal(assets.length, expectedAssetCount, `EXPECTED_${expectedAssetCount}_ASSETS_GOT_${assets.length}`);
  const today = todayKst();
  const details = [];
  for (const directoryRow of assets) {
    const assetCode = directoryRow.asset_code || directoryRow.asset_key;
    assert.ok(assetCode, 'Readable asset has no asset_code');
    const [home, rentRoll, maturities] = await Promise.all([
      invoke(token, 'v2/home/read', { asset_code: assetCode }),
      invoke(token, 'v2/rent-roll/read', { asset_code: assetCode, limit: 500 }),
      invoke(token, 'v2/maturities/read', { asset_code: assetCode }),
    ]);
    const asset = home.data?.asset || {};
    const rows = Array.isArray(rentRoll.data?.rows) ? rentRoll.data.rows : [];
    const occupiedRows = rows.filter((row) => row?.occupancy_status === 'occupied');
    const currentTermOccupiedRows = occupiedRows.filter((row) => (
      (!row.commencement_date || row.commencement_date <= today)
      && (!row.expiry_date || row.expiry_date >= today)
    ));
    const expiredRows = rows.filter((row) => row?.expiry_date && row.expiry_date < today);
    const expiredOccupiedRows = occupiedRows.filter((row) => row?.expiry_date && row.expiry_date < today);
    const occupiedLeasedArea = sumArea(occupiedRows);
    const currentTermOccupiedArea = sumArea(currentTermOccupiedRows);
    const totalRentArea = sumArea(rows);
    const assetLeasableArea = finiteNumber(asset.leasable_area_sqm);
    const assetGrossArea = finiteNumber(asset.gross_area_sqm);
    const selectedDenominator = assetLeasableArea > 0
      ? assetLeasableArea
      : assetGrossArea > 0 ? assetGrossArea : null;
    const denominatorBasis = assetLeasableArea > 0
      ? 'asset_leasable_area_sqm'
      : assetGrossArea > 0 ? 'asset_gross_area_sqm_fallback' : 'missing';
    const selectedDenominatorRate = rate(currentTermOccupiedArea, selectedDenominator);
    const homeOccupancyRate = finiteNumber(home.data?.occupancy_summary?.occupancy_rate);
    const maturityRows = Array.isArray(maturities.data?.maturities) ? maturities.data.maturities : [];
    details.push({
      asset_code: assetCode,
      asset_name: asset.name || directoryRow.name || assetCode,
      asset_leasable_area_sqm: assetLeasableArea,
      asset_gross_area_sqm: assetGrossArea,
      occupied_leased_area_sqm: Number(occupiedLeasedArea.toFixed(4)),
      current_term_occupied_area_sqm: Number(currentTermOccupiedArea.toFixed(4)),
      total_rent_leased_area_sqm: Number(totalRentArea.toFixed(4)),
      rent_row_count: rows.length,
      occupied_row_count: occupiedRows.length,
      current_term_occupied_row_count: currentTermOccupiedRows.length,
      expired_row_count: expiredRows.length,
      expired_occupied_row_count: expiredOccupiedRows.length,
      maturity_lease_row_count: maturityRows.filter((row) => row?.maturity_type === 'lease').length,
      rent_denominator_rate: rate(occupiedLeasedArea, totalRentArea),
      current_term_rent_denominator_rate: rate(currentTermOccupiedArea, totalRentArea),
      asset_leasable_rate: rate(occupiedLeasedArea, assetLeasableArea),
      asset_gross_rate: rate(occupiedLeasedArea, assetGrossArea),
      selected_denominator_area_sqm: selectedDenominator,
      denominator_basis: denominatorBasis,
      selected_denominator_rate: selectedDenominatorRate,
      over_100_anomaly: selectedDenominatorRate !== null && selectedDenominatorRate > 100,
      home_api_occupancy_rate: homeOccupancyRate,
      home_write_enabled: home.data?.write_enabled === true,
      rent_write_enabled: rentRoll.data?.write_enabled === true,
      home_revision: home.revision,
      rent_roll_revision: rentRoll.revision,
    });
  }
  return details;
}

function analyzeGyeongsan(rows) {
  const target = rows.find((row) => /경산/u.test(row.asset_name));
  assert.ok(target, 'GYEONGSAN_ASSET_NOT_FOUND');
  const candidates = [
    ['rent_denominator_rate', target.rent_denominator_rate],
    ['current_term_rent_denominator_rate', target.current_term_rent_denominator_rate],
    ['asset_leasable_rate', target.asset_leasable_rate],
    ['asset_gross_rate', target.asset_gross_rate],
    ['home_api_occupancy_rate', target.home_api_occupancy_rate],
  ];
  return {
    asset_code: target.asset_code,
    asset_name: target.asset_name,
    displayed_reference_rate: 74.8,
    matching_candidates: candidates
      .filter(([, value]) => value !== null && Math.abs(value - 74.8) <= 0.15)
      .map(([name, value]) => ({ name, value })),
    values: Object.fromEntries(candidates),
    expired_row_count: target.expired_row_count,
    expired_occupied_row_count: target.expired_occupied_row_count,
    occupied_leased_area_sqm: target.occupied_leased_area_sqm,
    total_rent_leased_area_sqm: target.total_rent_leased_area_sqm,
    asset_leasable_area_sqm: target.asset_leasable_area_sqm,
    asset_gross_area_sqm: target.asset_gross_area_sqm,
    current_denominator_basis: target.denominator_basis,
    current_selected_denominator_rate: target.selected_denominator_rate,
    user_confirmed_full_lease: true,
    proposed_leasable_area_sqm: 73821.68,
    proposed_selected_denominator_rate: rate(target.current_term_occupied_area_sqm, 73821.68),
  };
}

async function rollbackHomeDocument(token, assetCode, originalDocument, contract) {
  const current = await invoke(token, 'v2/home/read', { asset_code: assetCode });
  const result = await invoke(token, 'v2/home/batch-save', {
    asset_code: assetCode,
    client_request_id: randomUUID(),
    expected_revisions: {
      asset: current.data?.asset?.revision ?? current.revision,
      fund: current.data?.funds?.[0]?.revision,
    },
    ...originalDocument,
  });
  const readback = await invoke(token, 'v2/home/read', { asset_code: assetCode });
  assertDocumentReadback(
    contract.documentsEqual,
    'HOME_ROLLBACK',
    originalDocument,
    contract.buildHomeDocumentPayload(readback.data),
  );
  return result;
}

async function rollbackRentRollDocument(token, assetCode, originalDocument, contract) {
  const current = await invoke(token, 'v2/rent-roll/read', { asset_code: assetCode, limit: 500 });
  const result = await invoke(token, 'v2/rent-roll/batch-save', {
    asset_code: assetCode,
    client_request_id: randomUUID(),
    expected_xmin: String(current.revision),
    ...originalDocument,
  });
  const readback = await invoke(token, 'v2/rent-roll/read', { asset_code: assetCode, limit: 500 });
  assertDocumentReadback(
    contract.documentsEqual,
    'RENT_ROLL_ROLLBACK',
    originalDocument,
    contract.buildRentRollDocumentPayload(readback.data?.rows || []),
  );
  return result;
}

async function rollbackFinanceDocument(token, assetCode, originalDocument, contract) {
  const current = await invoke(token, 'v2/finance/read', { asset_code: assetCode });
  const result = await invoke(token, 'v2/finance/batch-save', {
    asset_code: assetCode,
    client_request_id: randomUUID(),
    expected_xmin: current.revision,
    ...originalDocument,
  });
  const readback = await invoke(token, 'v2/finance/read', { asset_code: assetCode });
  assertDocumentReadback(
    contract.documentsEqual,
    'FINANCE_ROLLBACK',
    originalDocument,
    contract.buildIncomeExpenseDocumentPayload(readback.data?.statement || {}),
  );
  return result;
}

function edgeActionFromRequest(request) {
  try { return request.postDataJSON()?.action || ''; } catch { return ''; }
}

function waitForEdgeAction(page, action, { timeout = timeoutMs } = {}) {
  return page.waitForResponse(
    (response) => response.url().includes('/functions/v1/ll-dashboard-api')
      && edgeActionFromRequest(response.request()) === action,
    { timeout },
  );
}

async function requirePrimaryBrowserResponse(response, action) {
  const body = await response.json().catch(() => null);
  const requestBody = (() => {
    try { return response.request().postDataJSON(); } catch { return null; }
  })();
  const payload = requestBody?.payload || {};
  const requestSummary = {
    asset_code: payload.asset_code,
    expected_revisions: payload.expected_revisions,
    asset_fields: payload.asset ? Object.keys(payload.asset) : [],
    asset_land_area_sqm: payload.asset?.land_area_sqm,
    fund_count: Array.isArray(payload.funds) ? payload.funds.length : null,
    funds: Array.isArray(payload.funds) ? payload.funds.map((fund) => ({
      fund_code: fund?.fund_code,
      investment_count: Array.isArray(fund?.investments) ? fund.investments.length : null,
      loan_count: Array.isArray(fund?.loans) ? fund.loans.length : null,
    })) : null,
  };
  assert.equal(
    response.ok(),
    true,
    `${action} browser HTTP ${response.status()}: ${JSON.stringify(body)} request=${JSON.stringify(requestSummary)}`,
  );
  assert.equal(body?.ok, true, `${action} browser response missing ok:true`);
  assert.equal(body?.status, 'primary', `${action} browser response is not primary`);
  return { body, request: response.request().postDataJSON() };
}

async function openAssetRoute(page, baseUrl, route, assetCode) {
  await page.goto(new URL(route, baseUrl).href, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  const shell = page.locator('[data-testid="logistics-data-platform"]');
  await shell.waitFor({ state: 'visible', timeout: timeoutMs });
  const select = page.locator('[data-testid="data-platform-asset-select"]');
  await select.waitFor({ state: 'visible', timeout: timeoutMs });
  await select.locator(`option[value="${assetCode}"]`).waitFor({ state: 'attached', timeout: timeoutMs });
  let selected = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await select.selectOption(assetCode);
    await page.waitForTimeout(500);
    selected = await select.inputValue() === assetCode;
    if (selected) break;
  }
  assert.equal(selected, true, `Asset selector did not retain ${assetCode}`);
  return shell;
}

async function exerciseHomeBrowserSave({ page, baseUrl, token, assetCode, contract }) {
  const original = await invoke(token, 'v2/home/read', { asset_code: assetCode });
  const home_original_document = contract.buildHomeDocumentPayload(original.data);
  let rollbackVerified = false;
  let mutationMayHaveBeenSent = false;
  let fieldLabel = '';
  try {
    const shell = await openAssetRoute(page, baseUrl, 'data-platform/home', assetCode);
    const editButton = shell.locator('[data-testid="home-edit"]');
    await editButton.waitFor({ state: 'visible', timeout: timeoutMs });
    assert.equal(await editButton.isEnabled(), true, 'Home write control is disabled');
    await editButton.click();
    const inputs = shell.locator('[data-testid="home-asset-overview"] input[type="number"]');
    await inputs.first().waitFor({ state: 'visible', timeout: timeoutMs });
    const candidates = await inputs.evaluateAll((nodes) => nodes.map((node, index) => ({
      index,
      value: node.value,
      label: node.getAttribute('aria-label') || '',
      eligible: !node.disabled && node.value !== '' && Number.isFinite(Number(node.value)),
    })));
    const candidate = candidates.find((item) => item.eligible);
    assert.ok(candidate, 'No existing home numeric value is available for +1 rollback QA');
    fieldLabel = candidate.label;
    const originalValue = candidate.value;
    const temporaryValue = String(Number(originalValue) + 1);
    const input = inputs.nth(candidate.index);
    await input.fill(temporaryValue);
    const responsePromise = waitForEdgeAction(page, 'v2/home/batch-save');
    mutationMayHaveBeenSent = true;
    await shell.locator('[data-testid="home-save"]').click();
    let saved;
    try {
      saved = await requirePrimaryBrowserResponse(await responsePromise, 'v2/home/batch-save');
    } catch (error) {
      throw new Error(
        `${error.message}; field=${fieldLabel || candidate.index}; original=${originalValue}; temporary=${temporaryValue}`,
      );
    }
    await editButton.waitFor({ state: 'visible', timeout: timeoutMs });
    assert.equal(
      await shell.locator('[data-testid="data-platform-error-dialog"]').isVisible(),
      false,
      'Home displayed an error dialog after a primary save response',
    );
    const changedReadback = await invoke(token, 'v2/home/read', { asset_code: assetCode });
    assertDocumentReadback(
      contract.documentsEqual,
      'HOME_CHANGED',
      contract.buildHomeDocumentPayload(saved.request.payload),
      contract.buildHomeDocumentPayload(changedReadback.data),
    );

    await shell.locator('[data-testid="home-edit"]').click();
    const rollbackInput = shell.locator('[data-testid="home-asset-overview"] input[type="number"]')
      .nth(candidate.index);
    await rollbackInput.fill(originalValue);
    const rollbackPromise = waitForEdgeAction(page, 'v2/home/batch-save');
    await shell.locator('[data-testid="home-save"]').click();
    await requirePrimaryBrowserResponse(await rollbackPromise, 'v2/home/batch-save rollback');
    const rollbackReadback = await invoke(token, 'v2/home/read', { asset_code: assetCode });
    assertDocumentReadback(
      contract.documentsEqual,
      'HOME_ROLLBACK',
      home_original_document,
      contract.buildHomeDocumentPayload(rollbackReadback.data),
    );
    rollbackVerified = true;
    return { field: fieldLabel, mode: 'plus_one_then_restore', rollback_readback_verified: true };
  } finally {
    if (mutationMayHaveBeenSent && !rollbackVerified) {
      await rollbackHomeDocument(token, assetCode, home_original_document, contract);
      rollbackVerified = true;
    }
  }
}

function boundedDomText(value, limit = 1_000) {
  const text = String(value || '').replace(/\s+/gu, ' ').trim();
  return text ? text.slice(0, limit) : null;
}

async function replaceRentRollInputValue(input, expectedValue, phase) {
  await input.click();
  await input.press('Control+A');
  await input.fill(expectedValue);
  const actualValue = await input.inputValue();
  assert.equal(
    actualValue,
    expectedValue,
    `${phase} rent-roll DOM input replacement failed: expected=${expectedValue} actual=${actualValue}`,
  );
}

async function collectRentRollSaveEvidence({
  page,
  shell,
  assetCode,
  candidate,
  saveButton,
  outcomeKind,
  requestFailure = null,
  browserErrors = [],
}) {
  const validationSummary = shell.locator('[data-testid="rent-roll-validation-summary"]');
  const errorDialog = shell.locator('[data-testid="data-platform-error-dialog"]');
  const saveState = shell.locator('[data-save-state]').first();
  const validationVisible = await validationSummary.isVisible().catch(() => false);
  const errorDialogVisible = await errorDialog.isVisible().catch(() => false);
  const validationMessages = validationVisible
    ? (await validationSummary.locator('[data-validation-row-id]').allTextContents())
      .map((message) => boundedDomText(message, 500))
      .filter(Boolean)
    : [];
  const draftStorage = await page.evaluate(({ selectedAssetCode, candidateRowId, candidateField }) => {
    const key = `gate6-rent-roll-draft-${selectedAssetCode}`;
    try {
      const value = JSON.parse(sessionStorage.getItem(key) || 'null');
      const dirtyRowIds = Array.isArray(value?.dirtyRowIds) ? value.dirtyRowIds : [];
      const dirtyRows = Array.isArray(value?.dirtyRows) ? value.dirtyRows : [];
      const candidateDirtyRow = dirtyRows.find((row) => row?._draft_id === candidateRowId);
      const dirtyFieldsByRow = new Map(Array.isArray(value?.dirtyFieldsByRow) ? value.dirtyFieldsByRow : []);
      return {
        present: Boolean(value),
        dirty_row_count: dirtyRowIds.length,
        candidate_is_dirty: dirtyRowIds.includes(candidateRowId),
        candidate_dirty_fields: Array.isArray(dirtyFieldsByRow.get(candidateRowId))
          ? dirtyFieldsByRow.get(candidateRowId)
          : [],
        candidate_dirty_value: candidateDirtyRow?.[candidateField] ?? null,
        candidate_dirty_value_type: candidateDirtyRow && Object.hasOwn(candidateDirtyRow, candidateField)
          ? typeof candidateDirtyRow[candidateField]
          : 'missing',
      };
    } catch {
      return {
        present: true,
        parse_error: true,
        dirty_row_count: null,
        candidate_is_dirty: null,
        candidate_dirty_fields: [],
        candidate_dirty_value: null,
        candidate_dirty_value_type: 'unavailable',
      };
    }
  }, {
    selectedAssetCode: assetCode,
    candidateRowId: candidate?.row_id || '',
    candidateField: candidate?.field || '',
  });
  const candidateDom = await page.evaluate(({ candidateRowId, candidateField }) => {
    const row = [...document.querySelectorAll('[data-rent-roll-row-id]')]
      .find((node) => node.getAttribute('data-rent-roll-row-id') === candidateRowId);
    if (!row) {
      return {
        present: false,
        aria_invalid: null,
        dom_input_value: null,
        dom_input_value_type: 'missing',
      };
    }
    const input = [...row.querySelectorAll('[data-draft-field]')]
      .find((node) => node.getAttribute('data-draft-field') === candidateField);
    return {
      present: true,
      aria_invalid: row.getAttribute('aria-invalid'),
      dom_input_value: input?.value ?? null,
      dom_input_value_type: input ? typeof input.value : 'missing',
    };
  }, { candidateRowId: candidate?.row_id || '', candidateField: candidate?.field || '' });

  return {
    outcome: outcomeKind,
    candidate: {
      row_id: candidate?.row_id || null,
      field: candidate?.field || null,
      input_index: Number.isInteger(candidate?.index) ? candidate.index : null,
      original_value: candidate?.original_value ?? null,
      original_value_type: candidate && Object.hasOwn(candidate, 'original_value')
        ? typeof candidate.original_value
        : 'missing',
      temporary_value: candidate?.temporary_value ?? null,
      temporary_value_type: candidate && Object.hasOwn(candidate, 'temporary_value')
        ? typeof candidate.temporary_value
        : 'missing',
      dom_input_value: candidateDom.dom_input_value,
      dom_input_value_type: candidateDom.dom_input_value_type,
      row_present: candidateDom.present,
      row_aria_invalid: candidateDom.aria_invalid,
    },
    validation_summary_visible: validationVisible,
    validation_summary_text: validationVisible
      ? boundedDomText(await validationSummary.textContent().catch(() => null))
      : null,
    validation_messages: validationMessages,
    aria_invalid_count: await shell.locator('[aria-invalid="true"]').count(),
    error_dialog_visible: errorDialogVisible,
    error_dialog_text: errorDialogVisible
      ? boundedDomText(await errorDialog.textContent().catch(() => null))
      : null,
    save_state: await saveState.getAttribute('data-save-state').catch(() => null),
    save_state_text: boundedDomText(await saveState.textContent().catch(() => null), 200),
    save_button_disabled: await saveButton.isDisabled().catch(() => null),
    save_button_visible: await saveButton.isVisible().catch(() => false),
    dirtyRowIds: draftStorage,
    request_failure: boundedDomText(requestFailure, 500),
    browser_errors: browserErrors.map((message) => boundedDomText(message, 500)).filter(Boolean),
  };
}

async function waitForRentRollSaveOutcome({ page, shell, action, assetCode, candidate, saveButton }) {
  const diagnosticTimeoutMs = Math.min(timeoutMs, 12_000);
  const browserErrors = [];
  const onPageError = (error) => browserErrors.push(`pageerror: ${error?.message || error}`);
  const onConsole = (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  try {
    const responseSignal = waitForEdgeAction(page, action, { timeout: diagnosticTimeoutMs })
      .then((response) => ({ kind: 'response', response }));
    const requestFailedSignal = page.waitForEvent('requestfailed', {
      predicate: (request) => request.url().includes('/functions/v1/ll-dashboard-api')
        && edgeActionFromRequest(request) === action,
      timeout: diagnosticTimeoutMs,
    }).then((request) => ({
      kind: 'requestfailed',
      requestFailure: request.failure()?.errorText || 'requestfailed',
    }));
    const validationSignal = shell.locator('[data-testid="rent-roll-validation-summary"]')
      .waitFor({ state: 'visible', timeout: diagnosticTimeoutMs })
      .then(() => ({ kind: 'client-validation' }));
    const errorDialogSignal = shell.locator('[data-testid="data-platform-error-dialog"]')
      .waitFor({ state: 'visible', timeout: diagnosticTimeoutMs })
      .then(() => ({ kind: 'error-dialog' }));
    const savedSignal = shell.locator('[data-save-state="saved"]')
      .waitFor({ state: 'visible', timeout: diagnosticTimeoutMs })
      .then(() => ({ kind: 'saved-without-observed-response' }));
    let outcome;
    try {
      outcome = await Promise.any([
        responseSignal,
        requestFailedSignal,
        validationSignal,
        errorDialogSignal,
        savedSignal,
      ]);
    } catch {
      outcome = { kind: 'diagnostic-timeout' };
    }
    const evidence = await collectRentRollSaveEvidence({
      page,
      shell,
      assetCode,
      candidate,
      saveButton,
      outcomeKind: outcome.kind,
      requestFailure: outcome.requestFailure,
      browserErrors,
    });
    return { ...outcome, evidence };
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
  }
}

async function exerciseRentRollBrowserSave({ page, baseUrl, token, assetCode, contract }) {
  const original = await invoke(token, 'v2/rent-roll/read', { asset_code: assetCode, limit: 500 });
  const rent_roll_original_document = contract.buildRentRollDocumentPayload(original.data?.rows || []);
  let rollbackVerified = false;
  let mutationMayHaveBeenSent = false;
  let candidateEvidence = null;
  try {
    const shell = await openAssetRoute(page, baseUrl, 'data-platform/rent-roll', assetCode);
    const inputs = shell.locator('input[data-draft-field="leased_area_sqm"]');
    await inputs.first().waitFor({ state: 'visible', timeout: timeoutMs });
    const candidates = await inputs.evaluateAll((nodes) => nodes.map((node, index) => ({
      index,
      row_id: node.closest('[data-rent-roll-row-id]')?.dataset.rentRollRowId || '',
      value: node.value.replaceAll(',', ''),
      eligible: !node.disabled && node.value !== '' && Number.isFinite(Number(node.value.replaceAll(',', ''))),
    })));
    const candidate = candidates.find((item) => item.eligible && item.row_id);
    assert.ok(candidate, 'No existing rent-roll leased area is available for +1 rollback QA');
    const temporaryValue = String(Number(candidate.value) + 1);
    candidateEvidence = {
      row_id: candidate.row_id,
      field: 'leased_area_sqm',
      index: candidate.index,
      original_value: candidate.value,
      temporary_value: temporaryValue,
    };
    const input = inputs.nth(candidate.index);
    await replaceRentRollInputValue(input, temporaryValue, 'temporary');
    await input.blur();
    const saveButton = shell.locator('[data-testid="rent-roll-save"]');
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="rent-roll-save"]')?.disabled,
      null,
      { timeout: timeoutMs },
    );
    const saveOutcomePromise = waitForRentRollSaveOutcome({
      page,
      shell,
      action: 'v2/rent-roll/batch-save',
      assetCode,
      candidate: candidateEvidence,
      saveButton,
    });
    mutationMayHaveBeenSent = true;
    await saveButton.click();
    const saveOutcome = await saveOutcomePromise;
    if (saveOutcome.kind !== 'response') {
      throw new Error(`RENT_ROLL_SAVE_BLOCKED ${JSON.stringify(saveOutcome.evidence)}`);
    }
    const saved = await requirePrimaryBrowserResponse(saveOutcome.response, 'v2/rent-roll/batch-save');
    await shell.locator('[data-save-state="saved"]').waitFor({ state: 'visible', timeout: timeoutMs });
    const changedReadback = await invoke(token, 'v2/rent-roll/read', { asset_code: assetCode, limit: 500 });
    assertDocumentReadback(
      contract.documentsEqual,
      'RENT_ROLL_CHANGED',
      contract.buildRentRollDocumentPayload(saved.request.payload?.rows || []),
      contract.buildRentRollDocumentPayload(changedReadback.data?.rows || []),
    );

    const rollbackInput = shell.locator(
      `[data-rent-roll-row-id="${candidate.row_id}"] input[data-draft-field="leased_area_sqm"]`,
    );
    await replaceRentRollInputValue(rollbackInput, candidate.value, 'rollback');
    await rollbackInput.blur();
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="rent-roll-save"]')?.disabled,
      null,
      { timeout: timeoutMs },
    );
    const rollbackOutcomePromise = waitForRentRollSaveOutcome({
      page,
      shell,
      action: 'v2/rent-roll/batch-save',
      assetCode,
      candidate: candidateEvidence,
      saveButton,
    });
    await saveButton.click();
    const rollbackOutcome = await rollbackOutcomePromise;
    if (rollbackOutcome.kind !== 'response') {
      throw new Error(`RENT_ROLL_ROLLBACK_BLOCKED ${JSON.stringify(rollbackOutcome.evidence)}`);
    }
    await requirePrimaryBrowserResponse(rollbackOutcome.response, 'v2/rent-roll/batch-save rollback');
    const rollbackReadback = await invoke(token, 'v2/rent-roll/read', { asset_code: assetCode, limit: 500 });
    assertDocumentReadback(
      contract.documentsEqual,
      'RENT_ROLL_ROLLBACK',
      rent_roll_original_document,
      contract.buildRentRollDocumentPayload(rollbackReadback.data?.rows || []),
    );
    rollbackVerified = true;
    return { ...candidateEvidence, mode: 'plus_one_then_restore', rollback_readback_verified: true };
  } finally {
    if (mutationMayHaveBeenSent && !rollbackVerified) {
      await rollbackRentRollDocument(token, assetCode, rent_roll_original_document, contract);
      rollbackVerified = true;
    }
  }
}

async function exerciseFinanceBrowserSave({ page, baseUrl, token, assetCode, contract }) {
  const original = await invoke(token, 'v2/finance/read', { asset_code: assetCode });
  const finance_original_document = contract.buildIncomeExpenseDocumentPayload(original.data?.statement || {});
  let rollbackVerified = false;
  let mutationMayHaveBeenSent = false;
  let candidateEvidence = null;
  try {
    const shell = await openAssetRoute(page, baseUrl, 'data-platform/income-expense', assetCode);
    const inputs = shell.locator('input[data-autosave-field]');
    await inputs.first().waitFor({ state: 'visible', timeout: timeoutMs });
    const candidates = await inputs.evaluateAll((nodes) => nodes.map((node, index) => ({
      index,
      field: node.dataset.autosaveField || '',
      value: node.value,
      eligible: !node.disabled && (node.value === '' || Number.isFinite(Number(node.value))),
      preferred: !node.disabled && node.value !== '' && Number.isFinite(Number(node.value)),
    })));
    const candidate = candidates.find((item) => item.preferred)
      || candidates.find((item) => item.eligible);
    assert.ok(candidate?.field, 'No editable finance cell is available for +1 rollback QA');
    candidateEvidence = { field: candidate.field, original_blank: candidate.value === '' };
    const input = inputs.nth(candidate.index);
    const temporaryValue = candidate.value === '' ? '1' : String(Number(candidate.value) + 1);
    await input.fill(temporaryValue);
    await shell.locator('[data-save-state="dirty"]').waitFor({ state: 'visible', timeout: timeoutMs });
    const responsePromise = waitForEdgeAction(page, 'v2/finance/batch-save');
    mutationMayHaveBeenSent = true;
    await input.blur();
    const saved = await requirePrimaryBrowserResponse(await responsePromise, 'v2/finance/batch-save');
    await shell.locator('[data-save-state="saved"]').waitFor({ state: 'visible', timeout: timeoutMs });
    const changedReadback = await invoke(token, 'v2/finance/read', { asset_code: assetCode });
    assertDocumentReadback(
      contract.documentsEqual,
      'FINANCE_CHANGED',
      contract.buildIncomeExpenseDocumentPayload(saved.request.payload?.statement || {}),
      contract.buildIncomeExpenseDocumentPayload(changedReadback.data?.statement || {}),
    );

    const rollbackInput = shell.locator(`input[data-autosave-field="${candidate.field}"]`);
    await rollbackInput.waitFor({ state: 'visible', timeout: timeoutMs });
    assert.equal(await rollbackInput.count(), 1, `Finance rollback field is not unique: ${candidate.field}`);
    const rollbackInputEvidence = {
      candidate_field: candidate.field,
      rollback_input_field_before_save: await rollbackInput.getAttribute('data-autosave-field'),
      rollback_input_value_before_save: null,
      rollback_input_field_after_save: null,
    };
    await rollbackInput.fill(candidate.value);
    rollbackInputEvidence.rollback_input_value_before_save = await rollbackInput.inputValue();
    assert.equal(
      rollbackInputEvidence.rollback_input_value_before_save,
      candidate.value,
      `Finance rollback DOM value mismatch for ${candidate.field}`,
    );
    await shell.locator('[data-save-state="dirty"]').waitFor({ state: 'visible', timeout: timeoutMs });
    const rollbackPromise = waitForEdgeAction(page, 'v2/finance/batch-save');
    await rollbackInput.blur();
    await requirePrimaryBrowserResponse(await rollbackPromise, 'v2/finance/batch-save rollback');
    rollbackInputEvidence.rollback_input_field_after_save = await shell
      .locator(`input[data-autosave-field="${candidate.field}"]`)
      .getAttribute('data-autosave-field')
      .catch(() => null);
    const rollbackReadback = await invoke(token, 'v2/finance/read', { asset_code: assetCode });
    const rollbackDocument = contract.buildIncomeExpenseDocumentPayload(
      rollbackReadback.data?.statement || {},
    );
    assertDocumentReadback(
      contract.documentsEqual,
      'FINANCE_ROLLBACK',
      finance_original_document,
      rollbackDocument,
      {
        candidate_field: candidate.field,
        ...rollbackInputEvidence,
        original_canonical_statement: finance_original_document.statement,
        first_mismatches: firstDocumentMismatches(finance_original_document, rollbackDocument),
      },
    );
    rollbackVerified = true;
    return { ...candidateEvidence, mode: 'plus_one_or_one_then_restore', rollback_readback_verified: true };
  } finally {
    if (mutationMayHaveBeenSent && !rollbackVerified) {
      await rollbackFinanceDocument(token, assetCode, finance_original_document, contract);
      rollbackVerified = true;
    }
  }
}

async function chooseBrowserAsset(token, rows, requestedAssetCode) {
  const candidates = requestedAssetCode
    ? rows.filter((row) => row.asset_code === requestedAssetCode)
    : rows.filter((row) => row.home_write_enabled && row.rent_write_enabled && row.rent_row_count > 0);
  assert.ok(candidates.length, 'No requested writable asset candidate exists');
  for (const candidate of candidates) {
    const finance = await invoke(token, 'v2/finance/read', { asset_code: candidate.asset_code });
    if (finance.data?.write_enabled === true) return candidate;
  }
  throw new Error('No asset is writable across home, rent-roll, and finance');
}

async function exerciseProductionBrowserWrites({ auth, rows, contract }) {
  const { chromium } = require('playwright');
  const asset = await chooseBrowserAsset(auth.session.access_token, rows, flagValue('asset-code'));
  const baseUrl = new URL(flagValue('base-url', DEFAULT_LIVE_BASE_URL)).href;
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromeExecutablePath(),
  });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 1000 } });
  await context.addInitScript(({ session }) => {
    sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
    sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email: session.user?.email || '' }));
  }, { session: auth.session });
  const page = await context.newPage();
  try {
    const home = await exerciseHomeBrowserSave({
      page, baseUrl, token: auth.session.access_token, assetCode: asset.asset_code, contract,
    });
    const rentRoll = await exerciseRentRollBrowserSave({
      page, baseUrl, token: auth.session.access_token, assetCode: asset.asset_code, contract,
    });
    const finance = await exerciseFinanceBrowserSave({
      page, baseUrl, token: auth.session.access_token, assetCode: asset.asset_code, contract,
    });
    return {
      asset_code: asset.asset_code,
      asset_name: asset.asset_name,
      home,
      rent_roll: rentRoll,
      finance,
      rollback_readback_verified: [home, rentRoll, finance]
        .every((item) => item.rollback_readback_verified === true),
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  const exerciseBrowserWrites = hasFlag('exercise-browser-writes');
  if (exerciseBrowserWrites && !hasFlag('confirm-production-rollback')) {
    throw new Error('--exercise-browser-writes requires --confirm-production-rollback');
  }
  const auth = await acquireAuthenticatedSession();
  const contract = await loadDocumentContract();
  const assets = await collectAssetOccupancyCandidates(auth.session.access_token);
  const gyeongsan = analyzeGyeongsan(assets);
  const browserWriteEvidence = exerciseBrowserWrites
    ? await exerciseProductionBrowserWrites({ auth, rows: assets, contract })
    : null;
  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: exerciseBrowserWrites ? 'production-browser-write-and-rollback' : 'production-read-only',
    read_only_default: READ_ONLY_DEFAULT,
    auth_source: auth.source,
    generated_at: new Date().toISOString(),
    today_kst: todayKst(),
    expected_asset_count: expectedAssetCount,
    asset_count: assets.length,
    assets,
    gyeongsan_analysis: gyeongsan,
    browser_write_evidence: browserWriteEvidence,
    operating_network_used: true,
    database_write_used: exerciseBrowserWrites,
    rollback_readback_verified: exerciseBrowserWrites
      ? browserWriteEvidence?.rollback_readback_verified === true
      : null,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
