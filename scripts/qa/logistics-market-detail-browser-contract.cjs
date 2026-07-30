const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const DETAIL_DATASETS = ['lease_current', 'lease_history', 'lease_statistics', 'supply_new', 'supply_pipeline', 'supply_cumulative', 'transaction_cases', 'transaction_statistics', 'cap_rate'];
const SUPPLY_SECTIONS = [
  { testId: 'market-supply-new', dataset: 'supply_new' },
  { testId: 'market-supply-pipeline', dataset: 'supply_pipeline' },
  { testId: 'market-supply-cumulative', dataset: 'supply_cumulative' },
];
const FORBIDDEN_FIELDS = new Set(['id', 'payload', 'source_row_id', 'source_file_id', 'source_row_number', 'pnu', 'legal_dong_code', 'row_hash', 'natural_key']);

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

const fileEnv = { ...readEnvFile(path.join(ROOT, '.env')), ...readEnvFile(path.join(ROOT, '.env.local')) };

function envValue(...keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
    if (fileEnv[key]) return fileEnv[key];
  }
  return '';
}

function optionValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] || fallback) : fallback;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function joinUrl(baseUrl, route) {
  return new URL(route.replace(/^\/+|\/+$/gu, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

function forbiddenPaths(value, pathParts = []) {
  if (Array.isArray(value)) return value.flatMap((item, index) => forbiddenPaths(item, [...pathParts, String(index)]));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const currentPath = [...pathParts, key];
    return [
      ...(FORBIDDEN_FIELDS.has(key.toLowerCase()) ? [currentPath.join('.')] : []),
      ...forbiddenPaths(child, currentPath),
    ];
  });
}

async function invokeDetail(supabaseUrl, anonKey, token, dataset, payload = {}) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: { apikey: anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json', origin: 'https://kylee94.github.io' },
    body: JSON.stringify({ action: 'sector-market/detail/list', payload: { dataset, ...payload } }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    const details = body?.detail ? ` ${JSON.stringify(body.detail)}` : '';
    throw new Error(`${dataset} failed (${response.status}): ${body.message || body.error || 'unknown error'}${details}`);
  }
  return body.data || {};
}

function assertDetailResponse(dataset, data, maxRows) {
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const columns = Array.isArray(data.columns) ? data.columns : [];
  if (!Number.isFinite(Number(data.total))) throw new Error(`${dataset}: total is missing`);
  if (rows.length > maxRows) throw new Error(`${dataset}: response returned ${rows.length} rows (max ${maxRows})`);
  if (!columns.length || !columns.every((column) => column && column.key && column.label && column.group)) {
    throw new Error(`${dataset}: business columns with group labels are required`);
  }
  if (!rows.every((row) => row && typeof row.row_key === 'string' && !Object.hasOwn(row, 'values'))) {
    throw new Error(`${dataset}: rows must use the flattened public business-field shape`);
  }
  const internal = forbiddenPaths(data);
  if (internal.length) throw new Error(`${dataset}: internal fields exposed: ${internal.join(', ')}`);
}

async function waitVisible(locator, label) {
  if (!await locator.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
    throw new Error(`${label} was not visible`);
  }
}

async function signInThroughBrowser(page, email, password) {
  const emailInput = page.locator('input[type="email"]').first();
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill(email);
    const continueButton = page.getByRole('button', { name: /다음|계속|확인|로그인/u }).first();
    await waitVisible(continueButton, 'email continue button');
    await continueButton.click();
  }
  const passwordInput = page.locator('input[type="password"]').first();
  if (await passwordInput.isVisible().catch(() => false)) {
    await passwordInput.fill(password);
    const submitButton = page.getByRole('button', { name: /로그인|확인|계속/u }).first();
    await waitVisible(submitButton, 'login button');
    await submitButton.click();
  }
}

async function openSupplyPopup(page, sectionTestId, expectedDataset) {
  const section = page.locator(`[data-testid="${sectionTestId}"]`);
  await waitVisible(section, `${expectedDataset} section`);
  const table = section.locator('[data-sortable-table="true"]').first();
  await waitVisible(table, `${expectedDataset} table`);
  const row = table.locator('tbody tr').first();
  await waitVisible(row, `${expectedDataset} row`);
  const responsePromise = page.waitForResponse((response) => {
    if (!response.url().includes('/functions/v1/ll-dashboard-api')) return false;
    const body = response.request().postDataJSON?.() || {};
    return body.action === 'sector-market/detail/list' && body.payload?.dataset === expectedDataset;
  }, { timeout: 20000 });
  await row.click();
  await responsePromise;

  const dialog = page.locator('[role="dialog"]').last();
  await waitVisible(dialog, `${expectedDataset} dialog`);
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  const tableRows = await dialog.locator('[data-sortable-table="true"] tbody tr').count();
  const dialogText = await dialog.innerText();
  const fullScreen = Boolean(box && viewport && box.width >= viewport.width * 0.9 && box.height >= viewport.height * 0.9);
  const internalText = /\b(?:payload|source_row_id|source_file_id|source_row_number|pnu|natural_key|row_hash)\b/iu.test(dialogText);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const screenshotPath = path.join(OUT_DIR, `market-detail-browser-contract-${timestamp()}-${expectedDataset}.png`);
  await dialog.screenshot({ path: screenshotPath });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 10000 });
  return {
    dataset: expectedDataset,
    section_test_id: sectionTestId,
    fullscreen: fullScreen,
    table_rows: tableRows,
    internal_text: internalText,
    screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
    ok: fullScreen && tableRows > 0 && !internalText,
  };
}

async function main() {
  const baseUrl = optionValue('base-url', DEFAULT_BASE_URL);
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const email = optionValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = optionValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
  if (!supabaseUrl || !anonKey || !email || !password) throw new Error('A real QA login and Supabase URL/key are required. Access-token or localStorage session injection is intentionally unsupported.');

  const authResponse = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const auth = await authResponse.json().catch(() => ({}));
  if (!authResponse.ok || !auth.access_token) throw new Error(`Real QA account login failed (${authResponse.status}).`);

  const apiChecks = [];
  for (const dataset of DETAIL_DATASETS) {
    const firstPage = await invokeDetail(supabaseUrl, anonKey, auth.access_token, dataset);
    assertDetailResponse(dataset, firstPage, 100);
    const cappedPage = await invokeDetail(supabaseUrl, anonKey, auth.access_token, dataset, { page_size: 9999 });
    assertDetailResponse(dataset, cappedPage, 500);
    apiChecks.push({ dataset, total: firstPage.total, default_rows: firstPage.rows.length, capped_rows: cappedPage.rows.length });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const functionActions = [];
  page.on('request', (request) => {
    if (!request.url().includes('/functions/v1/ll-dashboard-api')) return;
    const body = request.postDataJSON?.() || {};
    if (body.action) functionActions.push(body.action);
  });

  try {
    await page.goto(joinUrl(baseUrl, 'market-data/supply-pipeline'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await signInThroughBrowser(page, email, password);
    await waitVisible(page.locator('[data-testid="market-data-dashboard"]'), 'market dashboard after real login');
    await Promise.all(SUPPLY_SECTIONS.map(({ testId, dataset }) => waitVisible(
      page.locator(`[data-testid="${testId}"] [data-sortable-table="true"]`).first(),
      `${dataset} table`,
    )));

    const initialDetailCalls = functionActions.filter((action) => action === 'sector-market/detail/list').length;
    if (initialDetailCalls !== 0) throw new Error(`initial Supply Pipeline load issued ${initialDetailCalls} detail requests`);

    const supplyChecks = [];
    for (const { testId, dataset } of SUPPLY_SECTIONS) {
      supplyChecks.push(await openSupplyPopup(page, testId, dataset));
    }
    if (!supplyChecks.every((check) => check.ok)) throw new Error(`Supply popup contract failed: ${JSON.stringify(supplyChecks)}`);
    if (functionActions.some((action) => /(?:ingest|upload|create|update|delete|approve|submit)/iu.test(action))) {
      throw new Error(`QA issued a non-read-only Edge action: ${functionActions.join(', ')}`);
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const outputPath = path.join(OUT_DIR, `market-detail-browser-contract-${timestamp()}.json`);
    fs.writeFileSync(outputPath, JSON.stringify({
      ok: true,
      generated_at: new Date().toISOString(),
      base_url: baseUrl,
      login: 'real-browser-password-login',
      api_checks: apiChecks,
      initial_detail_calls: initialDetailCalls,
      function_actions: functionActions,
      supply_checks: supplyChecks,
    }, null, 2));
    process.stdout.write(`${JSON.stringify({ ok: true, output: path.relative(ROOT, outputPath).replace(/\\/gu, '/') })}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
