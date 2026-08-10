#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_ENV_ROOT = path.resolve(ROOT, '..', 'IGIS-Fund-Production-DP');
const DEFAULT_LIVE_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const expectedAssetCount = 19;
const expectedRowCount = 81;
const timeoutMs = 45_000;
const ALLOWED_ACTIONS = new Set(['v2/home/read', 'v2/rent-roll/read']);

function flagValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
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

function kstDateFromInstant(instantMs) {
  return new Date(instantMs + (9 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

function todayKst() {
  return kstDateFromInstant(Date.now());
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace(/,/gu, '').trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function canonicalOptionalDate(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) return 'INVALID';
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== text
    ? 'INVALID'
    : text;
}

function isCurrentContractRow(row, asOfDate) {
  const commencement = canonicalOptionalDate(row?.commencement_date);
  const expiry = canonicalOptionalDate(row?.expiry_date);
  if (commencement === 'INVALID' || expiry === 'INVALID') return false;
  return (!commencement || commencement <= asOfDate) && (!expiry || expiry >= asOfDate);
}

function calculateCurrentOccupancy(rows, asOfDate = todayKst()) {
  assert.match(asOfDate, /^\d{4}-\d{2}-\d{2}$/u, 'AS_OF_DATE_REQUIRED');
  const sourceRows = Array.isArray(rows) ? rows : [];
  const invalidDateRows = sourceRows.filter((row) => (
    canonicalOptionalDate(row?.commencement_date) === 'INVALID'
    || canonicalOptionalDate(row?.expiry_date) === 'INVALID'
  ));
  const currentRows = sourceRows.filter((row) => isCurrentContractRow(row, asOfDate));
  const invalidAreaRows = currentRows.filter((row) => {
    const area = finiteNumber(row?.leased_area_sqm);
    return area === null || area < 0;
  });
  const area = (row) => {
    const value = finiteNumber(row?.leased_area_sqm);
    return value !== null && value >= 0 ? value : 0;
  };
  const positiveAreaRows = currentRows.filter((row) => area(row) > 0);
  const occupiedRows = currentRows.filter((row) => row?.occupancy_status === 'occupied');
  const numerator = occupiedRows.reduce((sum, row) => sum + area(row), 0);
  const denominator = positiveAreaRows.reduce((sum, row) => sum + area(row), 0);
  const rate = denominator > 0 ? Number((numerator / denominator * 100).toFixed(2)) : null;
  return {
    as_of_date: asOfDate,
    stored_row_count: sourceRows.length,
    current_row_count: currentRows.length,
    excluded_noncurrent_row_count: sourceRows.length - currentRows.length - invalidDateRows.length,
    invalid_date_row_count: invalidDateRows.length,
    invalid_area_row_count: invalidAreaRows.length,
    current_positive_area_row_count: positiveAreaRows.length,
    current_rows_without_positive_leased_area: currentRows.length - positiveAreaRows.length,
    area_data_incomplete: positiveAreaRows.length < currentRows.length,
    current_occupied_row_count: occupiedRows.length,
    current_vacant_row_count: currentRows.filter((row) => row?.occupancy_status === 'vacant').length,
    current_planned_row_count: currentRows.filter((row) => row?.occupancy_status === 'planned').length,
    current_unknown_status_row_count: currentRows.filter((row) => (
      !['occupied', 'vacant', 'planned'].includes(row?.occupancy_status)
    )).length,
    current_occupied_leased_area_sqm: Number(numerator.toFixed(4)),
    current_all_status_leased_area_sqm: Number(denominator.toFixed(4)),
    expected_occupancy_rate: rate,
    expected_ui_label: rate === null ? '정보 없음' : `${rate.toFixed(1)}%`,
    information_missing: rate === null,
  };
}

function reconcileOccupancySurfaces(expected, apiRate, uiLabel = null) {
  const canonicalApiRate = finiteNumber(apiRate);
  const apiMatches = expected.expected_occupancy_rate === null
    ? canonicalApiRate === null
    : canonicalApiRate !== null
      && Math.abs(canonicalApiRate - expected.expected_occupancy_rate) <= 0.01;
  const uiMatches = uiLabel === null || uiLabel === expected.expected_ui_label;
  const status = expected.information_missing && apiMatches && uiMatches
    ? 'information_missing'
    : apiMatches && uiMatches ? 'exact' : 'mismatch';
  return {
    status,
    api_matches_expected: apiMatches,
    ui_matches_expected: uiMatches,
    expected_rate: expected.expected_occupancy_rate,
    api_rate: canonicalApiRate,
    difference_percentage_points: expected.expected_occupancy_rate === null || canonicalApiRate === null
      ? null
      : Number((canonicalApiRate - expected.expected_occupancy_rate).toFixed(2)),
    expected_ui_label: expected.expected_ui_label,
    observed_ui_label: uiLabel,
  };
}

async function acquireAuthenticatedSession(config) {
  assert.ok(config.supabaseUrl && config.anonKey, 'Supabase URL/anon key is missing');
  if (config.accessToken) {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.anonKey, authorization: `Bearer ${config.accessToken}` },
    });
    const user = await response.json().catch(() => null);
    assert.equal(response.status, 200, 'Supabase access token validation failed');
    assert.ok(user?.id, 'Supabase access token user is missing');
    return {
      source: 'access_token',
      session: {
        access_token: config.accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.round(Date.now() / 1000) + 3600,
        refresh_token: '',
        user,
      },
    };
  }
  assert.ok(config.email && config.password, 'Supabase QA login credentials are missing');
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: config.email, password: config.password }),
  });
  const session = await response.json().catch(() => null);
  assert.equal(response.status, 200, 'Supabase password login failed');
  assert.ok(session?.access_token && session?.user?.id, 'Supabase auth session is incomplete');
  if (!session.expires_at && session.expires_in) {
    session.expires_at = Math.round(Date.now() / 1000) + Number(session.expires_in);
  }
  return { source: 'password_grant', session };
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
  assert.equal(body?.ok, true, `${action} missing ok:true`);
  assert.equal(body?.status, 'primary', `${action} is not primary`);
  assert.ok(body?.request_id, `${action} request_id missing`);
  return body;
}

async function collectOperatingAudit(config, session, asOfDate) {
  const bootstrap = await invokeRead(config, session.access_token, 'v2/home/read', { as_of_date: asOfDate });
  const directory = Array.isArray(bootstrap.data?.assets) ? bootstrap.data.assets : [];
  assert.equal(directory.length, expectedAssetCount, `EXPECTED_${expectedAssetCount}_ASSETS_GOT_${directory.length}`);
  const assets = [];
  for (const entry of directory) {
    const assetCode = entry.asset_code || entry.asset_key;
    const [home, rent] = await Promise.all([
      invokeRead(config, session.access_token, 'v2/home/read', {
        asset_code: assetCode,
        as_of_date: asOfDate,
      }),
      invokeRead(config, session.access_token, 'v2/rent-roll/read', {
        asset_code: assetCode,
        limit: 500,
      }),
    ]);
    const calculation = calculateCurrentOccupancy(rent.data?.rows, asOfDate);
    const apiRate = finiteNumber(home.data?.occupancy_summary?.occupancy_rate);
    const reconciliation = reconcileOccupancySurfaces(calculation, apiRate);
    assets.push({
      asset_code: assetCode,
      asset_name: home.data?.asset?.name || entry.name || assetCode,
      ...calculation,
      home_api_occupancy_rate: apiRate,
      home_api_ui_label: apiRate === null ? '정보 없음' : `${apiRate.toFixed(1)}%`,
      api_reconciliation_status: reconciliation.status,
      api_matches_expected: reconciliation.api_matches_expected,
      difference_percentage_points: reconciliation.difference_percentage_points,
    });
  }
  const totalRows = assets.reduce((sum, asset) => sum + asset.stored_row_count, 0);
  assert.equal(totalRows, expectedRowCount, `EXPECTED_${expectedRowCount}_ROWS_GOT_${totalRows}`);
  return assets;
}

function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || undefined;
}

function browserActionPayload(response, expectedAction, expectedAssetCode) {
  try {
    const request = response.request();
    const body = request.postDataJSON();
    return request.method() === 'POST'
      && body?.action === expectedAction
      && body?.payload?.asset_code === expectedAssetCode;
  } catch {
    return false;
  }
}

async function readHomeDom(page) {
  const shell = page.locator('[data-testid="logistics-data-platform"]');
  const overview = shell.locator('[data-testid="home-asset-overview"]');
  const progress = shell.getByRole('progressbar', { name: '임대율' });
  const errorDialog = shell.locator('[data-testid="data-platform-error-dialog"]');
  return {
    asset_name: await overview.locator('dd span').first().getAttribute('title').catch(() => null),
    occupancy_aria: await progress.getAttribute('aria-valuetext').catch(() => null),
    error_dialog_visible: await errorDialog.isVisible().catch(() => false),
    error_dialog_text: await errorDialog.textContent().catch(() => null),
  };
}

function ariaToUiLabel(value) {
  if (value === '임대율 정보 없음') return '정보 없음';
  return String(value || '').replace(/^임대율\s*/u, '') || null;
}

async function observeAssetTransition(page, select, asset, previousAssetName) {
  const responsePromise = page.waitForResponse(
    (response) => browserActionPayload(response, 'v2/home/read', asset.asset_code),
    { timeout: timeoutMs },
  );
  await select.selectOption(asset.asset_code);
  const samples = [];
  let response = null;
  let responseError = null;
  void responsePromise.then((value) => { response = value; }).catch((error) => { responseError = error; });
  const deadline = Date.now() + timeoutMs;
  let stableCount = 0;
  while (Date.now() < deadline) {
    const sample = await readHomeDom(page);
    samples.push(sample);
    const expectedAria = asset.home_api_occupancy_rate === null
      ? '임대율 정보 없음'
      : `임대율 ${asset.home_api_occupancy_rate.toFixed(1)}%`;
    const stable = response
      && sample.asset_name === asset.asset_name
      && sample.occupancy_aria === expectedAria
      && !sample.error_dialog_visible;
    stableCount = stable ? stableCount + 1 : 0;
    if (stableCount >= 3) break;
    if (responseError) break;
    await page.waitForTimeout(10);
  }
  if (responseError) throw responseError;
  assert.ok(response, `HOME_BROWSER_RESPONSE_TIMEOUT:${asset.asset_code}`);
  const body = await response.json().catch(() => null);
  assert.equal(response.ok(), true, `HOME_BROWSER_HTTP_${response.status()}:${asset.asset_code}`);
  assert.equal(body?.ok, true, `HOME_BROWSER_NOT_OK:${asset.asset_code}`);
  assert.equal(body?.status, 'primary', `HOME_BROWSER_NOT_PRIMARY:${asset.asset_code}`);
  const final = samples.at(-1) || await readHomeDom(page);
  const observedNames = [...new Set(samples.map((sample) => sample.asset_name).filter(Boolean))];
  const staleNames = observedNames.filter((name) => name !== asset.asset_name);
  return {
    asset_code: asset.asset_code,
    asset_name: asset.asset_name,
    previous_asset_name: previousAssetName,
    expected_ui_label: asset.expected_ui_label,
    api_ui_label: asset.home_api_ui_label,
    observed_ui_label: ariaToUiLabel(final.occupancy_aria),
    observed_asset_names: observedNames,
    observed_stale_asset_names: staleNames,
    sample_count: samples.length,
    error_dialog_visible: final.error_dialog_visible,
    error_dialog_text: final.error_dialog_visible ? String(final.error_dialog_text || '').trim().slice(0, 500) : null,
    stable_selected_asset: final.asset_name === asset.asset_name,
    ui_matches_api: ariaToUiLabel(final.occupancy_aria) === asset.home_api_ui_label,
    ui_matches_expected: ariaToUiLabel(final.occupancy_aria) === asset.expected_ui_label,
  };
}

async function exerciseLiveBrowser(auth, assets) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 1000 } });
  await context.addInitScript(({ session }) => {
    sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
    sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email: session.user?.email || '' }));
  }, { session: auth.session });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.message || error).slice(0, 500)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500));
  });
  const transitions = [];
  try {
    const url = new URL('data-platform/home', flagValue('base-url', DEFAULT_LIVE_BASE_URL));
    url.searchParams.set('qa_cache_bust', String(Date.now()));
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const shell = page.locator('[data-testid="logistics-data-platform"]');
    await shell.waitFor({ state: 'visible', timeout: timeoutMs });
    const select = shell.locator('[data-testid="data-platform-asset-select"]');
    await select.waitFor({ state: 'visible', timeout: timeoutMs });
    await page.waitForFunction(
      (count) => document.querySelector('[data-testid="data-platform-asset-select"]')?.options.length === count + 1,
      expectedAssetCount,
      { timeout: timeoutMs },
    );
    const initiallySelectedAssetCode = await select.inputValue();
    const transitionOrder = [
      ...assets.filter((asset) => asset.asset_code !== initiallySelectedAssetCode),
      ...assets.filter((asset) => asset.asset_code === initiallySelectedAssetCode),
    ];
    let previousAssetName = null;
    for (const asset of transitionOrder) {
      try {
        transitions.push(await observeAssetTransition(page, select, asset, previousAssetName));
      } catch (error) {
        transitions.push({
          asset_code: asset.asset_code,
          asset_name: asset.asset_name,
          previous_asset_name: previousAssetName,
          expected_ui_label: asset.expected_ui_label,
          api_ui_label: asset.home_api_ui_label,
          observed_ui_label: null,
          observed_stale_asset_names: [],
          stable_selected_asset: false,
          ui_matches_api: false,
          ui_matches_expected: false,
          transition_error: String(error?.message || error).slice(0, 1000),
        });
      }
      previousAssetName = asset.asset_name;
    }
  } finally {
    await context.close();
    await browser.close();
  }
  return {
    ok: transitions.length === expectedAssetCount
      && transitions.every((row) => (
        row.stable_selected_asset
        && row.ui_matches_api
        && row.observed_stale_asset_names.length === 0
        && !row.error_dialog_visible
        && !row.transition_error
      ))
      && pageErrors.length === 0
      && consoleErrors.length === 0,
    transition_count: transitions.length,
    stale_transition_count: transitions.filter((row) => row.observed_stale_asset_names.length > 0).length,
    unstable_transition_count: transitions.filter((row) => !row.stable_selected_asset).length,
    ui_api_mismatch_count: transitions.filter((row) => !row.ui_matches_api).length,
    error_dialog_count: transitions.filter((row) => row.error_dialog_visible).length,
    page_errors: pageErrors,
    console_errors: consoleErrors,
    transitions,
  };
}

async function main() {
  const config = runtimeConfig();
  const auth = await acquireAuthenticatedSession(config);
  const asOfDate = flagValue('as-of-date', todayKst());
  const assets = await collectOperatingAudit(config, auth.session, asOfDate);
  const browser = hasFlag('browser-live') ? await exerciseLiveBrowser(auth, assets) : null;
  const report = {
    ok: assets.every((asset) => asset.api_matches_expected)
      && (!browser || browser.ok),
    mode: browser ? 'production_read_only_api_and_browser' : 'production_read_only_api',
    generated_at: new Date().toISOString(),
    as_of_date: asOfDate,
    allowed_actions: [...ALLOWED_ACTIONS],
    operating_network_used: true,
    database_write_used: false,
    expected_asset_count: expectedAssetCount,
    expected_row_count: expectedRowCount,
    exact_api_match_count: assets.filter((asset) => asset.api_matches_expected).length,
    api_mismatch_count: assets.filter((asset) => !asset.api_matches_expected).length,
    information_missing_count: assets.filter((asset) => asset.information_missing).length,
    information_missing_assets: assets.filter((asset) => asset.information_missing)
      .map((asset) => ({ asset_code: asset.asset_code, asset_name: asset.asset_name })),
    arenas_yangji: assets.find((asset) => asset.asset_code === 'A112127001') || null,
    assets,
    browser,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

module.exports = {
  calculateCurrentOccupancy,
  isCurrentContractRow,
  kstDateFromInstant,
  reconcileOccupancySurfaces,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}
