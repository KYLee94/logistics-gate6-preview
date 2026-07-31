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
  { testId: 'market-supply-cumulative', dataset: 'supply_new', allowCacheReuse: true },
];
const POPUP_INVENTORY = [
  { id: 'overview-lease-chart', route: 'market-data/overview', container: 'market-overview-lease-chart', trigger: '[data-scoped-grouped-bar-row="true"][data-scoped-grouped-bar-clickable="true"], [data-scoped-bar-row="true"][data-scoped-bar-clickable="true"]', dataset: 'lease_statistics', expectRequest: true },
  { id: 'overview-transaction-chart', route: 'market-data/overview', container: 'market-overview-transaction-chart', trigger: '[data-scoped-bar-row="true"][data-scoped-bar-clickable="true"]', dataset: 'transaction_cases', expectRequest: true },
  { id: 'overview-supply-chart', route: 'market-data/overview', container: 'market-overview-supply-chart', trigger: '[data-supply-chart-period-group="true"][data-supply-chart-clickable="true"]', dataset: 'supply_pipeline', expectRequest: false },
  { id: 'lease-statistics-chart', route: 'market-data/lease-market', container: 'market-lease-statistics', trigger: '[data-scoped-bar-row="true"][data-scoped-bar-clickable="true"]', dataset: 'lease_statistics', expectRequest: true },
  { id: 'lease-history-button', route: 'market-data/lease-market', container: 'market-lease-statistics', trigger: '[data-testid="market-lease-history-button"]', dataset: 'lease_history', expectRequest: true },
  { id: 'lease-center-row', route: 'market-data/lease-market', container: 'market-lease-center-table', trigger: '[data-sortable-table="true"] tbody tr:has(td + td)', dataset: 'lease_history', expectRequest: true },
  { id: 'supply-new-row', route: 'market-data/supply-pipeline', container: 'market-supply-new', trigger: '[data-sortable-table="true"] tbody tr:has(td + td)', dataset: 'supply_new', expectRequest: true },
  { id: 'supply-pipeline-row', route: 'market-data/supply-pipeline', container: 'market-supply-pipeline', trigger: '[data-sortable-table="true"] tbody tr:has(td + td)', dataset: 'supply_pipeline', expectRequest: true },
  { id: 'supply-cumulative-row', route: 'market-data/supply-pipeline', container: 'market-supply-cumulative', trigger: '[data-sortable-table="true"] tbody tr:has(td + td)', dataset: 'supply_new', expectRequest: false },
  { id: 'supply-pipeline-chart', route: 'market-data/supply-pipeline', container: 'market-supply-pipeline', trigger: '[data-supply-chart-period-group="true"][data-supply-chart-clickable="true"]', dataset: 'supply_pipeline', expectRequest: false },
  { id: 'supply-cumulative-chart', route: 'market-data/supply-pipeline', container: 'market-supply-cumulative', trigger: '[data-supply-chart-period-group="true"][data-supply-chart-clickable="true"]', dataset: 'supply_cumulative', expectRequest: false },
  { id: 'transaction-case-row', route: 'market-data/transactions', container: 'market-transactions-cases', trigger: '[data-sortable-table="true"] tbody tr:has(td + td)', dataset: 'transaction_cases', expectRequest: true },
  { id: 'transaction-statistics-button', route: 'market-data/transactions', container: 'market-transactions-cases', trigger: '[data-testid="market-transactions-statistics-button"]', dataset: 'transaction_statistics', expectRequest: true },
  { id: 'transaction-period-button', route: 'market-data/transactions', container: 'market-transactions-period', trigger: '[data-testid="market-transactions-period-button"]', dataset: 'transaction_cases', expectRequest: false },
  { id: 'transaction-period-chart', route: 'market-data/transactions', container: 'market-transactions-period', trigger: '[data-stacked-period-group="true"][data-stacked-period-clickable="true"]', dataset: 'transaction_cases', expectRequest: true },
  { id: 'transaction-size-unit-price', route: 'market-data/transactions', container: 'market-transactions-size-unit-price', trigger: '[data-bar-list-row="true"][data-bar-list-clickable="true"]', dataset: 'transaction_cases', expectRequest: true },
  { id: 'transaction-size-market', route: 'market-data/transactions', container: 'market-transactions-size-market', trigger: '[data-bar-list-row="true"][data-bar-list-clickable="true"]', dataset: 'transaction_cases', expectRequest: true },
  { id: 'cap-rate-button', route: 'market-data/transactions', container: 'market-transactions-cap-rate', trigger: '[data-testid="market-transactions-cap-rate-button"]', dataset: 'cap_rate', expectRequest: true },
  { id: 'cap-rate-point', route: 'market-data/transactions', container: 'market-transactions-cap-rate', trigger: '[data-multi-line-point="true"]', dataset: 'cap_rate', expectRequest: true },
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

function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || undefined;
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
  const rawBody = await response.text();
  const body = (() => {
    try {
      return rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return {};
    }
  })();
  if (!response.ok || body?.ok === false) {
    const details = body?.detail ? ` ${JSON.stringify(body.detail)}` : '';
    const fallback = rawBody && !body.message && !body.error ? rawBody.slice(0, 800) : 'unknown error';
    throw new Error(`${dataset} failed (${response.status}): ${body.message || body.error || fallback}${details}`);
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
  const businessRows = rows.filter((row) => columns.some((column) => hasBusinessValue(row?.[column.key])));
  if (!businessRows.length) throw new Error(`${dataset}: no row has a non-empty business cell`);
  if (dataset === 'supply_new' && !columns.some((column) => isAddressLabel(column.label))) {
    throw new Error('supply_new: 소재지 business column is required');
  }
}

function hasBusinessValue(value) {
  if (value === 0 || value === false) return true;
  return value !== null && value !== undefined && String(value).replace(/\s+/gu, ' ').trim() !== '' && String(value).trim() !== '-';
}

function isAddressLabel(value) {
  return /(?:소재지|주소|대지\s*위치|위치)/u.test(String(value || ''));
}

function detailDataFromResponse(response) {
  return response.json().then((body) => body?.data || {}).catch(() => ({}));
}

async function detailDataWithFallback(response, fallback = {}) {
  const captured = response ? await detailDataFromResponse(response) : {};
  return Array.isArray(captured.rows) && captured.rows.length ? captured : fallback;
}

async function waitVisible(locator, label) {
  if (!await locator.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
    throw new Error(`${label} was not visible`);
  }
}

function waitForDetailResponse(page, dataset, timeout = 30000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      page.off('response', onResponse);
      resolve(response);
    };
    const onResponse = (response) => {
      if (!response.url().includes('/functions/v1/ll-dashboard-api')) return;
      const body = response.request().postDataJSON?.() || {};
      if (body.action === 'sector-market/detail/list') {
        if (body.payload?.dataset === dataset) finish(response);
      }
    };
    const timer = setTimeout(() => finish(null), timeout);
    page.on('response', onResponse);
  });
}

async function inspectDialog(page, dialog, dataset, detailData = {}) {
  await page.waitForFunction(() => {
    const modal = [...document.querySelectorAll('[role="dialog"]')].at(-1);
    const rows = [...(modal?.querySelectorAll('[data-sortable-table="true"] tbody tr') || [])];
    return rows.some((row) => row.querySelectorAll('td').length > 1);
  }, undefined, { timeout: 30000 });
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  const table = dialog.locator('[data-sortable-table="true"]').last();
  const tableRows = await table.locator('tbody tr').count();
  const dialogText = await dialog.innerText();
  const layout = await table.evaluate((scroller) => {
    const headers = [...scroller.querySelectorAll('thead th')];
    const headerRects = headers.map((header) => {
      const rect = header.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    });
    const headerOverlapCount = headerRects.slice(0, -1).filter((rect, index) => rect.right > headerRects[index + 1].left + 1).length;
    const bodyRows = [...scroller.querySelectorAll('tbody tr')];
    const unreadableCellCount = [...scroller.querySelectorAll('tbody td')].filter((cell) => {
      const style = getComputedStyle(cell);
      const clipped = cell.scrollWidth > cell.clientWidth + 1 && style.whiteSpace !== 'normal';
      return clipped && !cell.getAttribute('title');
    }).length;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
    const scrollerRect = scroller?.getBoundingClientRect();
    const lastHeaderRect = headers.at(-1)?.getBoundingClientRect();
    const headerLabels = headers.map((header) => (header.textContent || '').replace(/\s+/gu, ' ').trim());
    const addressColumnIndex = headerLabels.findIndex((label) => /(?:소재지|주소|대지\s*위치|위치)/u.test(label));
    const nonEmptyCellCount = bodyRows.reduce((count, row) => count + [...row.querySelectorAll('td')].filter((cell) => {
      const value = (cell.textContent || '').replace(/\s+/gu, ' ').trim();
      return value && value !== '-';
    }).length, 0);
    const visibleAddressCellCount = addressColumnIndex < 0 ? 0 : bodyRows.filter((row) => {
      const value = (row.querySelectorAll('td')[addressColumnIndex]?.textContent || '').replace(/\s+/gu, ' ').trim();
      return value && value !== '-';
    }).length;
    return {
      column_count: headers.length,
      header_labels: headerLabels,
      header_overlap_count: headerOverlapCount,
      zero_width_header_count: headerRects.filter((rect) => rect.width < 40).length,
      unreadable_cell_count: unreadableCellCount,
      non_empty_cell_count: nonEmptyCellCount,
      address_header_visible: addressColumnIndex >= 0,
      visible_address_cell_count: visibleAddressCellCount,
      horizontal_scroll: Boolean(scroller && scroller.scrollWidth > scroller.clientWidth + 1),
      last_column_visible_at_scroll_end: Boolean(
        scrollerRect
        && lastHeaderRect
        && lastHeaderRect.right <= scrollerRect.right + 1
        && lastHeaderRect.left >= scrollerRect.left - 1
      ),
      scroll_width: scroller?.scrollWidth || 0,
      client_width: scroller?.clientWidth || 0,
    };
  });
  const fullScreen = Boolean(box && viewport && box.width >= viewport.width * 0.9 && box.height >= viewport.height * 0.9);
  const internalText = /\b(?:payload|source_row_id|source_file_id|source_row_number|pnu|natural_key|row_hash)\b/iu.test(dialogText);
  const apiColumns = Array.isArray(detailData.columns) ? detailData.columns : [];
  const apiRows = Array.isArray(detailData.rows) ? detailData.rows : [];
  const apiNonEmptyRowCount = apiRows.filter((row) => apiColumns.some((column) => hasBusinessValue(row?.[column.key]))).length;
  const apiAddressColumn = apiColumns.find((column) => isAddressLabel(column.label));
  const apiNonEmptyAddressRowCount = apiAddressColumn
    ? apiRows.filter((row) => hasBusinessValue(row?.[apiAddressColumn.key])).length
    : 0;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const screenshotPath = path.join(OUT_DIR, `market-detail-browser-contract-${timestamp()}-${dataset}.png`);
  await dialog.screenshot({ path: screenshotPath });
  return {
    dataset,
    fullscreen: fullScreen,
    table_rows: tableRows,
    api_non_empty_row_count: apiNonEmptyRowCount,
    api_non_empty_address_row_count: apiNonEmptyAddressRowCount,
    internal_text: internalText,
    ...layout,
    screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
    ok: fullScreen
      && tableRows > 0
      && apiNonEmptyRowCount > 0
      && !internalText
      && layout.column_count > 0
      && layout.non_empty_cell_count > 0
      && (dataset !== 'supply_new' || layout.address_header_visible)
      && layout.header_overlap_count === 0
      && layout.zero_width_header_count === 0
      && layout.unreadable_cell_count === 0
      && layout.last_column_visible_at_scroll_end,
  };
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
  if (await passwordInput.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
    await passwordInput.fill(password);
    const submitButton = page.getByRole('button', { name: /로그인|확인|계속/u }).first();
    await waitVisible(submitButton, 'login button');
    await submitButton.click();
    await passwordInput.waitFor({ state: 'hidden', timeout: 30000 });
  }
}

async function openSupplyPopup(page, sectionTestId, expectedDataset, functionActions, detailData = {}, allowCacheReuse = false) {
  const section = page.locator(`[data-testid="${sectionTestId}"]`);
  await waitVisible(section, `${expectedDataset} section`);
  const table = section.locator('[data-sortable-table="true"]:visible').last();
  await waitVisible(table, `${expectedDataset} table`);
  await page.waitForFunction(({ sectionId }) => {
    const sectionNode = document.querySelector(`[data-testid="${sectionId}"]`);
    const rows = [...(sectionNode?.querySelectorAll('[data-sortable-table="true"] tbody tr') || [])];
    return rows.some((candidate) => {
      const value = (candidate.textContent || '').replace(/\s+/gu, ' ').trim();
      return value && !/표시할 데이터가 없습니다/u.test(value);
    });
  }, { sectionId: sectionTestId }, { timeout: 30000 });
  const row = table.locator('tbody tr').first();
  await waitVisible(row, `${expectedDataset} row`);
  const responsePromise = allowCacheReuse ? null : waitForDetailResponse(page, expectedDataset);
  const rowText = (await row.innerText()).replace(/\s+/gu, ' ').trim();
  await row.click();

  const dialog = page.locator('[role="dialog"]').last();
  if (!await dialog.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const failureScreenshot = path.join(OUT_DIR, `market-detail-browser-contract-${timestamp()}-${expectedDataset}-no-dialog.png`);
    await page.screenshot({ path: failureScreenshot, fullPage: false }).catch(() => {});
    throw new Error(`${expectedDataset}: dialog was not visible; row=${JSON.stringify(rowText)}; actions=${JSON.stringify(functionActions.slice(-10))}; screenshot=${path.relative(ROOT, failureScreenshot).replace(/\\/gu, '/')}`);
  }
  const response = responsePromise ? await responsePromise : null;
  if (!response && !allowCacheReuse) {
    const requestState = await dialog.locator('[data-testid="market-detail-request-state"]').innerText().catch(() => 'request state not rendered');
    throw new Error(`${expectedDataset}: detail response was not observed; row=${JSON.stringify(rowText)}; state=${JSON.stringify(requestState)}; actions=${JSON.stringify(functionActions.slice(-10))}`);
  }
  const check = await inspectDialog(page, dialog, expectedDataset, await detailDataWithFallback(response, detailData));
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 10000 });
  return {
    ...check,
    section_test_id: sectionTestId,
  };
}

async function openTriggeredPopup(page, expectedDataset, trigger, functionActions, detailData = {}) {
  const responsePromise = waitForDetailResponse(page, expectedDataset);
  await trigger.click();
  const dialog = page.locator('[role="dialog"]').last();
  await waitVisible(dialog, `${expectedDataset} dialog`);
  const response = await responsePromise;
  if (!response) {
    throw new Error(`${expectedDataset}: detail response was not observed; actions=${JSON.stringify(functionActions.slice(-10))}`);
  }
  const check = await inspectDialog(page, dialog, expectedDataset, await detailDataWithFallback(response, detailData));
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 10000 });
  return check;
}

async function openCumulativeSupplyChartPopup(page, detailData, functionActions) {
  const section = page.locator('[data-testid="market-supply-cumulative"]');
  await waitVisible(section, 'cumulative supply section');
  const period = section.locator('[data-supply-chart-period-group="true"][data-supply-chart-clickable="true"]').first();
  await waitVisible(period, 'cumulative supply chart period');
  const detailCallsBefore = functionActions.filter((action) => action === 'sector-market/detail/list').length;
  await period.click();
  const dialog = page.locator('[role="dialog"]').last();
  await waitVisible(dialog, 'cumulative supply chart dialog');
  const check = await inspectDialog(page, dialog, 'supply_cumulative_chart', detailData);
  const detailCallsAfter = functionActions.filter((action) => action === 'sector-market/detail/list').length;
  if (detailCallsAfter !== detailCallsBefore) {
    throw new Error('cumulative supply chart popup must use the already loaded chart values without an extra detail request');
  }
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 10000 });
  return check;
}

async function openInventoryPopup(page, entry, functionActions, detailDataByDataset, baseUrl) {
  await page.goto(joinUrl(baseUrl, entry.route), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitVisible(page.locator('[data-testid="market-data-dashboard"]'), `${entry.id} dashboard`);
  const container = page.locator(`[data-testid="${entry.container}"]`);
  await waitVisible(container, `${entry.id} container`);
  const trigger = container.locator(entry.trigger).first();
  await waitVisible(trigger, `${entry.id} trigger`);
  const responsePromise = entry.expectRequest ? waitForDetailResponse(page, entry.dataset) : null;
  await trigger.click();
  const dialog = page.locator('[role="dialog"]').last();
  await waitVisible(dialog, `${entry.id} dialog`);
  const response = responsePromise ? await responsePromise : null;
  if (entry.expectRequest && !response) throw new Error(`${entry.id}: expected ${entry.dataset} detail response was not observed`);
  const check = await inspectDialog(
    page,
    dialog,
    entry.dataset,
    await detailDataWithFallback(response, detailDataByDataset.get(entry.dataset)),
  );
  if (!check.ok) throw new Error(`${entry.id}: popup display contract failed: ${JSON.stringify(check)}`);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 10000 });
  return { ...check, id: entry.id, route: entry.route, request_observed: Boolean(response) };
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
  const detailDataByDataset = new Map();
  for (const dataset of DETAIL_DATASETS) {
    const firstPage = await invokeDetail(supabaseUrl, anonKey, auth.access_token, dataset);
    assertDetailResponse(dataset, firstPage, 100);
    const cappedPage = await invokeDetail(supabaseUrl, anonKey, auth.access_token, dataset, { page_size: 9999 });
    assertDetailResponse(dataset, cappedPage, 500);
    detailDataByDataset.set(dataset, firstPage);
    apiChecks.push({ dataset, total: firstPage.total, default_rows: firstPage.rows.length, capped_rows: cappedPage.rows.length });
  }

  const browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const functionActions = [];
  page.on('request', (request) => {
    if (!request.url().includes('/functions/v1/ll-dashboard-api')) return;
    const body = request.postDataJSON?.() || {};
    if (body.action) functionActions.push(body.action);
    if (body.action === 'sector-market/detail/list') {
      console.log(`[market-detail-request] dataset=${body.payload?.dataset || 'missing'} payload=${JSON.stringify(body.payload || {})}`);
    }
  });
  page.on('response', async (response) => {
    if (!response.url().includes('/functions/v1/ll-dashboard-api')) return;
    const body = response.request().postDataJSON?.() || {};
    if (body.action === 'sector-market/detail/list') {
      console.log(`[market-detail-response] dataset=${body.payload?.dataset || 'missing'} status=${response.status()}`);
      if (response.status() >= 400) {
        const errorBody = await response.text().catch(() => '');
        console.log(`[market-detail-error] dataset=${body.payload?.dataset || 'missing'} body=${errorBody.slice(0, 1200)}`);
      }
    }
  });

  try {
    await page.goto(joinUrl(baseUrl, 'market-data/supply-pipeline'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await signInThroughBrowser(page, email, password);
    await page.goto(joinUrl(baseUrl, 'market-data/supply-pipeline'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitVisible(page.locator('[data-testid="market-data-dashboard"]'), 'market dashboard after real login');
    await Promise.all(SUPPLY_SECTIONS.map(({ testId, dataset }) => waitVisible(
      page.locator(`[data-testid="${testId}"] [data-sortable-table="true"]`).first(),
      `${dataset} table`,
    )));

    const initialDetailCalls = functionActions.filter((action) => action === 'sector-market/detail/list').length;
    if (initialDetailCalls !== 0) throw new Error(`initial Supply Pipeline load issued ${initialDetailCalls} detail requests`);

    const supplyChecks = [];
    for (const { testId, dataset, allowCacheReuse } of SUPPLY_SECTIONS) {
      supplyChecks.push(await openSupplyPopup(
        page,
        testId,
        dataset,
        functionActions,
        detailDataByDataset.get(dataset),
        allowCacheReuse,
      ));
    }
    const cumulativeChartCheck = await openCumulativeSupplyChartPopup(page, detailDataByDataset.get('supply_cumulative'), functionActions);
    if (!supplyChecks.every((check) => check.ok)) throw new Error(`Supply popup contract failed: ${JSON.stringify(supplyChecks)}`);
    if (!cumulativeChartCheck.ok) throw new Error(`Cumulative supply chart popup contract failed: ${JSON.stringify(cumulativeChartCheck)}`);

    await page.goto(joinUrl(baseUrl, 'market-data/lease-market'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitVisible(page.locator('[data-testid="market-data-dashboard"]'), 'lease market dashboard');
    const leaseSection = page.locator('section').filter({ hasText: '최신 임대시장 통계' }).first();
    await waitVisible(leaseSection, 'latest lease market section');
    const leaseChecks = [
      await openTriggeredPopup(
        page,
        'lease_statistics',
        leaseSection.locator('[data-scoped-bar-row="true"]').first(),
        functionActions,
        detailDataByDataset.get('lease_statistics'),
      ),
      await openTriggeredPopup(
        page,
        'lease_history',
        leaseSection.getByRole('button', { name: '전체 기록 보기' }),
        functionActions,
        detailDataByDataset.get('lease_history'),
      ),
    ];
    if (!leaseChecks.every((check) => check.ok)) throw new Error(`Lease popup contract failed: ${JSON.stringify(leaseChecks)}`);

    await page.goto(joinUrl(baseUrl, 'market-data/transactions'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitVisible(page.locator('[data-testid="market-data-dashboard"]'), 'transactions dashboard');
    const transactionSection = page.locator('section').filter({ hasText: '거래 사례 비교' }).first();
    await waitVisible(transactionSection, 'transaction comparison section');
    const transactionDataRow = transactionSection.locator('[data-sortable-table="true"] tbody tr:has(td + td)').first();
    await waitVisible(transactionDataRow, 'transaction comparison data row');
    const transactionChecks = [
      await openTriggeredPopup(
        page,
        'transaction_cases',
        transactionDataRow,
        functionActions,
        detailDataByDataset.get('transaction_cases'),
      ),
      await openTriggeredPopup(
        page,
        'transaction_statistics',
        transactionSection.getByRole('button', { name: '매매통계 전체 보기' }),
        functionActions,
        detailDataByDataset.get('transaction_statistics'),
      ),
    ];
    const capRateSection = page.locator('section').filter({ hasText: 'Cap Rate 추이' }).last();
    transactionChecks.push(await openTriggeredPopup(
      page,
      'cap_rate',
      capRateSection.getByRole('button', { name: '값 테이블 보기' }),
      functionActions,
      detailDataByDataset.get('cap_rate'),
    ));
    if (!transactionChecks.every((check) => check.ok)) throw new Error(`Transaction popup contract failed: ${JSON.stringify(transactionChecks)}`);

    const inventoryChecks = [];
    for (const entry of POPUP_INVENTORY) {
      inventoryChecks.push(await openInventoryPopup(page, entry, functionActions, detailDataByDataset, baseUrl));
    }
    if (inventoryChecks.length !== POPUP_INVENTORY.length || !inventoryChecks.every((check) => check.ok)) {
      throw new Error(`Market popup inventory contract failed: ${JSON.stringify(inventoryChecks)}`);
    }

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
      cumulative_supply_chart_check: cumulativeChartCheck,
      lease_checks: leaseChecks,
      transaction_checks: transactionChecks,
      inventory_checks: inventoryChecks,
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
