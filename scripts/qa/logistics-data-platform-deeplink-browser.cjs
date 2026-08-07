const assert = require('assert');
const { randomUUID } = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST_DIR = path.resolve(process.env.LOGISTICS_QA_DIST_DIR || path.join(ROOT, 'dist'));
const DEFAULT_DEPLOY_BASE_PATH = '/logistics-gate6-preview/';
const DEFAULT_LIVE_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const DEFAULT_TIMEOUT_MS = 30_000;
const HOME_MATURITY_ALERT_CONTRACT = Object.freeze({
  routeKey: 'data-platform-home',
  assetName: '안성 홈플러스 중부허브 물류센터',
  expectedCount: 2,
  expectedDate: '2026-08-11',
  expectedLenders: Object.freeze(['국민은행', '신한은행']),
});
const INTERNAL_MATURITY_IDENTIFIER = /\b(?:[0-9a-f]{8}-[0-9a-f-]{27,}|(?:asset|tenant|lease|contract|maturity|loan|fund)_[a-z0-9_-]+)\b/iu;
const ROUTES = Object.freeze([
  {
    key: 'root',
    publicPath: '',
    expectedPublicPath: 'data-platform/home',
    internalPath: 'platform/iotaseoul/workspace/logistics/data-platform/home',
    surface: 'data-platform',
    expectedTitle: '홈',
    navTestId: 'data-platform-home-nav',
  },
  {
    key: 'work-platform',
    publicPath: 'work-platform',
    internalPath: 'platform/iotaseoul/workspace/logistics',
    surface: 'legacy-work-platform',
  },
  {
    key: 'legacy-home',
    publicPath: 'home',
    internalPath: 'platform/iotaseoul/workspace/logistics/dashboard/home',
    surface: 'legacy-dashboard',
  },
  {
    key: 'data-platform',
    publicPath: 'data-platform',
    expectedPublicPath: 'data-platform/home',
    internalPath: 'platform/iotaseoul/workspace/logistics/data-platform/home',
    surface: 'data-platform',
    expectedTitle: '홈',
    navTestId: 'data-platform-home-nav',
  },
  {
    key: 'data-platform-home',
    publicPath: 'data-platform/home',
    internalPath: 'platform/iotaseoul/workspace/logistics/data-platform/home',
    surface: 'data-platform',
    expectedTitle: '홈',
    navTestId: 'data-platform-home-nav',
  },
  {
    key: 'data-platform-rent-roll',
    publicPath: 'data-platform/rent-roll',
    internalPath: 'platform/iotaseoul/workspace/logistics/data-platform/rent-roll',
    surface: 'data-platform',
    expectedTitle: '렌트롤',
    navTestId: 'data-platform-rent-roll-nav',
  },
  {
    key: 'data-platform-income-expense',
    publicPath: 'data-platform/income-expense',
    internalPath: 'platform/iotaseoul/workspace/logistics/data-platform/income-expense',
    surface: 'data-platform',
    expectedTitle: '수익·비용',
    navTestId: 'data-platform-income-expense-nav',
  },
]);

const MIME_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
});

function flagValue(name, fallback = '') {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function routesForScope(dataPlatformOnly = false, routeKey = '') {
  const scopedRoutes = dataPlatformOnly
    ? ROUTES.filter((route) => route.surface === 'data-platform')
    : ROUTES;
  return routeKey
    ? scopedRoutes.filter((route) => route.key === routeKey)
    : scopedRoutes;
}

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

const ENV_ROOT = path.resolve(flagValue('env-root', ROOT));
const fileEnv = {
  ...readEnvFile(path.join(ENV_ROOT, '.env')),
  ...readEnvFile(path.join(ENV_ROOT, '.env.local')),
};

function envValue(...keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
    if (fileEnv[key]) return fileEnv[key];
  }
  return '';
}

function normalizeBasePath(value) {
  const withLeadingSlash = `/${String(value || '').replace(/^\/+|\/+$/gu, '')}/`;
  return withLeadingSlash === '//' ? '/' : withLeadingSlash;
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.search = '';
  url.hash = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.toString();
}

function joinRoute(baseUrl, publicPath) {
  const target = new URL(String(publicPath || '').replace(/^\//u, ''), normalizeBaseUrl(baseUrl));
  const cacheBust = flagValue('cache-bust');
  if (cacheBust) target.searchParams.set('qa_cache_bust', cacheBust);
  return target.toString();
}

function normalizedPathname(value) {
  const pathname = new URL(value).pathname;
  return pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
}

function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || undefined;
}

function resolveDistFile(pathname, basePath) {
  const normalizedBasePath = normalizeBasePath(basePath);
  if (!pathname.startsWith(normalizedBasePath)) return null;
  const relativeUrlPath = decodeURIComponent(pathname.slice(normalizedBasePath.length)).replace(/^\/+|\/+$/gu, '');
  const relativeFilePath = relativeUrlPath || 'index.html';
  const candidates = [
    path.resolve(DIST_DIR, relativeFilePath),
    path.resolve(DIST_DIR, relativeFilePath, 'index.html'),
    path.resolve(DIST_DIR, '404.html'),
  ];
  const distPrefix = `${path.resolve(DIST_DIR)}${path.sep}`;
  return candidates.find((candidate) => (
    (candidate === path.resolve(DIST_DIR) || candidate.startsWith(distPrefix))
    && fs.existsSync(candidate)
    && fs.statSync(candidate).isFile()
  )) || null;
}

function startDistServer(basePath, port = 0) {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    throw new Error(`Local dist is missing. Run "npm run build:preview" first: ${DIST_DIR}`);
  }
  for (const route of ROUTES) {
    const fallbackPath = path.join(DIST_DIR, route.publicPath, 'index.html');
    if (!fs.existsSync(fallbackPath)) {
      throw new Error(`Deep-link fallback is missing for /${route.publicPath}. Run "npm run build:preview" first.`);
    }
  }

  const server = http.createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      const filePath = resolveDistFile(requestUrl.pathname, basePath);
      if (!filePath) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      const stat = fs.statSync(filePath);
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-length': stat.size,
        'content-type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      });
      if (request.method === 'HEAD') response.end();
      else fs.createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(error?.message || String(error));
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}${normalizeBasePath(basePath)}`,
        close: () => new Promise((closeResolve, closeReject) => {
          server.close((error) => (error ? closeReject(error) : closeResolve()));
        }),
      });
    });
  });
}

async function acquireAuthenticatedSession() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/u, '');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const accessToken = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (!supabaseUrl || !anonKey) {
    throw new Error('Authenticated route QA requires LOGISTICS_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY (or their VITE_ aliases).');
  }

  if (accessToken) {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` },
    });
    const user = await response.json().catch(() => null);
    if (!response.ok || !user?.id) {
      throw new Error(`LOGISTICS_SUPABASE_ACCESS_TOKEN validation failed (${response.status}).`);
    }
    return {
      source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN',
      session: {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.round(Date.now() / 1000) + 3600,
        refresh_token: '',
        user,
      },
    };
  }

  const email = flagValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = flagValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
  if (!email || !password) {
    throw new Error('Authenticated route QA was required, but no session was supplied. Set LOGISTICS_SUPABASE_ACCESS_TOKEN or email/password credentials.');
  }
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await response.json().catch(() => null);
  if (!response.ok || !session?.access_token || !session?.user?.id) {
    throw new Error(`Supabase password login failed (${response.status}).`);
  }
  if (!session.expires_at && session.expires_in) {
    session.expires_at = Math.round(Date.now() / 1000) + Number(session.expires_in);
  }
  return { source: 'password_grant', session };
}

async function transportProbe(browser, baseUrl, basePath, route, timeoutMs) {
  const targetUrl = joinRoute(baseUrl, route.publicPath);
  const expectedPath = normalizedPathname(targetUrl);
  const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  let report;
  try {
    const directResponse = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const directPath = normalizedPathname(page.url());
    const moduleSource = await page.locator('script[type="module"][src]').first().getAttribute('src').catch(() => '');
    const refreshResponse = await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const refreshPath = normalizedPathname(page.url());
    report = {
      ok: false,
      target_url: targetUrl,
      direct_status: directResponse?.status() || 0,
      direct_final_url: directResponse?.url() || '',
      direct_path: directPath,
      refresh_status: refreshResponse?.status() || 0,
      refresh_path: refreshPath,
      module_source: moduleSource || '',
      errors,
    };
    report.ok = report.direct_status === 200
      && report.refresh_status === 200
      && report.direct_path === expectedPath
      && report.refresh_path === expectedPath
      && String(report.module_source).startsWith(normalizeBasePath(basePath));
  } catch (error) {
    errors.push(error?.message || String(error));
    report = {
      ok: false,
      target_url: targetUrl,
      current_url: page.url(),
      body_text: await page.locator('body').innerText().catch(() => ''),
      asset_option_count: await page.locator('header select option').count().catch(() => 0),
      errors,
    };
  } finally {
    await context.close();
  }
  return report;
}

async function anonymousAuthProbe(browser, baseUrl, route, timeoutMs) {
  const targetUrl = joinRoute(baseUrl, route.publicPath);
  const authUrl = joinRoute(baseUrl, 'auth-setup');
  const expectedAuthPath = normalizedPathname(authUrl);
  const context = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText || 'unknown';
    if (errorText !== 'net::ERR_ABORTED' && /supabase\.co\/(?:auth|functions)\/v1\//u.test(request.url())) {
      errors.push(`requestfailed ${errorText} ${request.url().replace(/[?#].*$/u, '')}`);
    }
  });
  let report;
  try {
    const directResponse = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.locator('input#logistics-login-email').waitFor({ state: 'visible', timeout: timeoutMs });
    const redirectPath = normalizedPathname(page.url());
    const preservedBeforeRefresh = await page.evaluate(() => sessionStorage.getItem('logisticsPostLoginPath'));
    const refreshResponse = await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.locator('input#logistics-login-email').waitFor({ state: 'visible', timeout: timeoutMs });
    const preservedAfterRefresh = await page.evaluate(() => sessionStorage.getItem('logisticsPostLoginPath'));
    const refreshPath = normalizedPathname(page.url());
    report = {
      ok: false,
      target_url: targetUrl,
      direct_document_status: directResponse?.status() || 0,
      redirect_path: redirectPath,
      refresh_status: refreshResponse?.status() || 0,
      refresh_path: refreshPath,
      expected_login_path: route.internalPath,
      preserved_before_refresh: preservedBeforeRefresh,
      preserved_after_refresh: preservedAfterRefresh,
      login_form_visible: true,
      errors,
    };
    report.ok = report.direct_document_status === 200
      && report.refresh_status === 200
      && report.redirect_path === expectedAuthPath
      && report.refresh_path === expectedAuthPath
      && preservedBeforeRefresh === route.internalPath
      && preservedAfterRefresh === route.internalPath
      && errors.length === 0;
  } catch (error) {
    errors.push(error?.message || String(error));
    report = { ok: false, target_url: targetUrl, errors };
  } finally {
    await context.close();
  }
  return report;
}

async function homeMaturityAlertProbe(page, dataPlatformMain, edgeActions, timeoutMs) {
  const contract = HOME_MATURITY_ALERT_CONTRACT;
  const assetSelect = dataPlatformMain.locator('[data-testid="data-platform-asset-select"]');
  const maturityButton = dataPlatformMain.locator('[data-testid="data-platform-maturity-button"]');
  await assetSelect.waitFor({ state: 'visible', timeout: timeoutMs });
  await page.waitForFunction(
    ({ assetName }) => Array.from(document.querySelectorAll('[data-testid="data-platform-asset-select"] option'))
      .some((option) => option.textContent?.trim() === assetName && option.value),
    { assetName: contract.assetName },
    { timeout: timeoutMs },
  );

  const optionState = await assetSelect.evaluate((select, assetName) => ({
    currentValue: select.value,
    target: Array.from(select.options)
      .map((option) => ({ value: option.value, label: option.textContent?.trim() || '' }))
      .find((option) => option.label === assetName && option.value) || null,
    alternative: Array.from(select.options)
      .map((option) => ({ value: option.value, label: option.textContent?.trim() || '' }))
      .find((option) => option.value && option.label !== assetName) || null,
  }), contract.assetName);
  assert.ok(optionState.target, `${contract.assetName} 자산 선택 옵션을 찾지 못했습니다.`);

  // Always create an actual target-asset transition. This makes the loading-state
  // observation deterministic even when the browser initially restored this asset.
  if (optionState.currentValue === optionState.target.value) {
    assert.ok(optionState.alternative, '만기 알림 전환 검증에 사용할 다른 자산 옵션이 없습니다.');
    await assetSelect.selectOption(optionState.alternative.value);
    await page.waitForFunction(
      ({ value }) => {
        const select = document.querySelector('[data-testid="data-platform-asset-select"]');
        const button = document.querySelector('[data-testid="data-platform-maturity-button"]');
        return select?.value === value && /^만기 알림 \d+$/u.test(button?.textContent?.trim() || '');
      },
      { value: optionState.alternative.value },
      { timeout: timeoutMs },
    );
  }

  await page.evaluate(() => {
    const probe = {
      observedTexts: [],
      zeroExposed: false,
      inspect: null,
      observer: null,
    };
    probe.inspect = () => {
      const text = document.querySelector('[data-testid="data-platform-maturity-button"]')
        ?.textContent?.trim() || '';
      if (text && probe.observedTexts.at(-1) !== text) probe.observedTexts.push(text);
      if (/^만기 알림 0$/u.test(text)) probe.zeroExposed = true;
    };
    probe.observer = new MutationObserver(probe.inspect);
    probe.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.__gate6HomeMaturityAlertProbe = probe;
  });

  const actionStart = edgeActions.length;
  await assetSelect.selectOption(optionState.target.value);
  await page.evaluate(() => window.__gate6HomeMaturityAlertProbe?.inspect?.());
  await page.waitForFunction(
    ({ targetValue, expectedCount }) => {
      const select = document.querySelector('[data-testid="data-platform-asset-select"]');
      const button = document.querySelector('[data-testid="data-platform-maturity-button"]');
      return select?.value === targetValue
        && button?.textContent?.trim() === `만기 알림 ${expectedCount}`;
    },
    { targetValue: optionState.target.value, expectedCount: contract.expectedCount },
    { timeout: timeoutMs },
  );
  await page.evaluate(() => window.__gate6HomeMaturityAlertProbe?.inspect?.());

  const headerText = (await maturityButton.innerText()).trim();
  assert.equal(headerText, `만기 알림 ${contract.expectedCount}`);
  await maturityButton.click();
  const popup = maturityButton.locator('xpath=following-sibling::section[1]');
  await popup.waitFor({ state: 'visible', timeout: timeoutMs });
  const maturityRows = popup.locator('[data-testid="maturity-row"]');
  await maturityRows.first().waitFor({ state: 'visible', timeout: timeoutMs });
  const rowCount = await maturityRows.count();
  assert.equal(rowCount, contract.expectedCount, `${contract.assetName} 만기 목록 건수가 다릅니다.`);

  const rowTexts = (await maturityRows.allInnerTexts()).map((text) => text.trim());
  const detailChecks = [];
  for (const lender of contract.expectedLenders) {
    const rowIndex = rowTexts.findIndex((text) => text.includes(lender));
    assert.ok(rowIndex >= 0, `${lender} 대출 만기 행을 찾지 못했습니다.`);
    assert.ok(rowTexts[rowIndex].includes(contract.expectedDate), `${lender} 만기 행에 만기일이 없습니다.`);
    assert.doesNotMatch(rowTexts[rowIndex], INTERNAL_MATURITY_IDENTIFIER);

    await maturityRows.nth(rowIndex).click();
    const detailDialog = popup.locator('[data-testid="maturity-detail-dialog"]');
    await detailDialog.waitFor({ state: 'visible', timeout: timeoutMs });
    const detailText = (await detailDialog.innerText()).trim();
    assert.ok(detailText.includes(lender), `${lender} 상세 팝업에 대주명이 없습니다.`);
    assert.ok(detailText.includes(contract.expectedDate), `${lender} 상세 팝업에 만기일이 없습니다.`);
    assert.doesNotMatch(detailText, INTERNAL_MATURITY_IDENTIFIER);
    detailChecks.push({ lender, date: contract.expectedDate, visible: true });
    await detailDialog.getByRole('button', { name: '닫기' }).click();
    await detailDialog.waitFor({ state: 'hidden', timeout: timeoutMs });
  }

  const observerState = await page.evaluate(() => {
    const probe = window.__gate6HomeMaturityAlertProbe;
    probe?.observer?.disconnect();
    return {
      zero_exposed: Boolean(probe?.zeroExposed),
      observed_texts: Array.isArray(probe?.observedTexts) ? probe.observedTexts : [],
    };
  });
  const alertActions = edgeActions.slice(actionStart);
  const writeActions = alertActions.filter((action) => /(?:batch-save|save|write|delete|archive)/iu.test(action));
  assert.deepEqual(writeActions, [], '만기 알림 검증 중 쓰기 API가 호출되었습니다.');
  assert.ok(alertActions.includes('v2/maturities/read'), '대상 자산의 만기 읽기 API 호출을 확인하지 못했습니다.');

  return {
    checked: true,
    selected_asset: contract.assetName,
    header_text: headerText,
    row_count: rowCount,
    row_texts: rowTexts,
    detail_checks: detailChecks,
    loading_zero_exposed: observerState.zero_exposed,
    loading_text_history: observerState.observed_texts,
    edge_actions: alertActions,
    write_action_count: writeActions.length,
  };
}

const RENT_ROLL_RATE_FIELDS = Object.freeze([
  'deposit_escalation_rate',
  'rent_escalation_rate',
  'cam_escalation_rate',
]);

function requestAction(request) {
  try {
    return String(request.postDataJSON()?.action || '');
  } catch {
    return '';
  }
}

async function invokeDataPlatformQa(auth, action, payload) {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/u, '');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const response = await fetch(`${supabaseUrl}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${auth.session.access_token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ action, payload }),
  });
  return {
    status: response.status,
    ok: response.ok,
    body: await response.json().catch(() => null),
  };
}

function rentRollQaSparseUpdate(row, field, value) {
  const update = { operation: 'update' };
  [
    'row_key',
    'space_key',
    'contract_key',
    'contract_space_key',
    'rent_term_key',
    'tenant_key',
    'space_revision',
    'contract_revision',
    'allocation_revision',
    'rent_term_revision',
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(row || {}, key)) update[key] = row[key];
  });
  update[field] = value;
  return update;
}

function findRentRollReadRow(payloads, rowId) {
  return [...payloads]
    .reverse()
    .flatMap((payload) => (Array.isArray(payload?.data?.rows) ? payload.data.rows : []))
    .find((row) => String(row?.row_key || row?.space_key || '') === String(rowId || '')) || null;
}

function rentRollPercentDisplayValue(value) {
  const source = String(value ?? '').trim();
  if (!source) return '';
  const numeric = Number(source.replace(/%/gu, '').trim());
  if (!Number.isFinite(numeric)) return '';
  const percent = !source.includes('%') && numeric > 0 && numeric < 1
    ? numeric * 100
    : numeric;
  return String(Number(percent.toFixed(10)));
}

function findRentRollRateDisplayFixture(payloads) {
  for (const payload of payloads) {
    const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
    for (const row of rows) {
      for (const field of RENT_ROLL_RATE_FIELDS) {
        const rawValue = row?.[field];
        const expectedDisplay = rentRollPercentDisplayValue(rawValue);
        if (expectedDisplay && row.row_key) {
          return {
            row_id: String(row.row_key),
            field,
            raw_value: rawValue,
            expected_display: expectedDisplay,
          };
        }
      }
    }
  }
  return null;
}

async function rentRollSameValueSaveProbe(
  page,
  dataPlatformMain,
  edgeActions,
  rentRollReadPayloadPromises,
  timeoutMs,
) {
  const rateFixture = findRentRollRateDisplayFixture(
    await Promise.all([...rentRollReadPayloadPromises]),
  );
  let rateUi = { checked: false, value: '', percent_suffix: '' };
  if (rateFixture) {
    rateUi = await dataPlatformMain.locator('[data-rent-roll-row-id]').evaluateAll(
      (rows, fixture) => {
        const row = rows.find((candidate) => candidate.dataset.rentRollRowId === fixture.row_id);
        const input = row?.querySelector(`[data-draft-field="${fixture.field}"]`);
        return {
          checked: Boolean(input),
          value: input?.value || '',
          percent_suffix: input?.nextElementSibling?.textContent?.trim() || '',
        };
      },
      rateFixture,
    );
    assert.equal(rateUi.value, rateFixture.expected_display, 'API rate and visible percentage differ.');
    assert.equal(rateUi.percent_suffix, '%', 'Rate input must expose the percent unit.');
  }

  const numericCandidates = await dataPlatformMain
    .locator('input[data-draft-field][inputmode="decimal"]')
    .evaluateAll((inputs) => inputs.map((input, index) => {
      const semantic = input.value.replaceAll(',', '').trim();
      const numeric = Number(semantic);
      return {
        index,
        row_id: input.closest('[data-rent-roll-row-id]')?.dataset.rentRollRowId || '',
        field: input.dataset.draftField || '',
        semantic,
        blurred_display: input.value,
        eligible: !input.disabled
          && semantic !== ''
          && Number.isFinite(numeric)
          && Math.abs(numeric) >= 1000
          && input.value.includes(','),
      };
    }));
  const candidate = numericCandidates.find((item) => item.eligible && item.row_id && item.field);
  assert.ok(candidate, 'No existing editable numeric value with a visible thousands separator was found.');

  const numericInput = dataPlatformMain
    .locator('input[data-draft-field][inputmode="decimal"]')
    .nth(candidate.index);
  await numericInput.focus();
  const focusedValue = await numericInput.inputValue();
  assert.equal(focusedValue, candidate.semantic, 'Focused numeric input must expose the ungrouped semantic value.');
  const temporarySemantic = String(Number(candidate.semantic) + 1);
  await numericInput.fill(temporarySemantic);
  assert.equal(await numericInput.inputValue(), temporarySemantic);
  await numericInput.fill(candidate.semantic);
  await numericInput.blur();
  const blurredDisplay = await numericInput.inputValue();
  assert.ok(blurredDisplay.includes(','), 'Blurred numeric input must restore thousands separators.');
  assert.equal(Number(blurredDisplay.replaceAll(',', '')), Number(candidate.semantic));

  const saveButton = dataPlatformMain.locator('[data-testid="rent-roll-save"]');
  await saveButton.waitFor({ state: 'visible', timeout: timeoutMs });
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="rent-roll-save"]')?.disabled,
    null,
    { timeout: timeoutMs },
  );
  const saveActionStart = edgeActions.length;
  const saveResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/functions/v1/ll-dashboard-api')
      && requestAction(response.request()) === 'v2/rent-roll/batch-save',
    { timeout: timeoutMs },
  );
  await saveButton.click();
  const saveResponse = await saveResponsePromise;
  assert.ok(saveResponse.ok(), `Same-value batch-save failed (${saveResponse.status()}).`);
  const saveRequestBody = saveResponse.request().postDataJSON();
  assert.equal(saveRequestBody?.action, 'v2/rent-roll/batch-save');
  const saveRequestPayload = saveRequestBody?.payload || {};
  assert.equal(
    saveRequestPayload?.rows?.length,
    1,
    `Same-value QA must save exactly one existing row; received ${JSON.stringify(
      (saveRequestPayload?.rows || []).map((row) => ({
        operation: row?.operation,
        row_key: row?.row_key,
        space_key: row?.space_key,
        fields: Object.keys(row || {}).filter((key) => !['operation', 'row_key', 'space_key'].includes(key)),
      })),
    )}.`,
  );
  assert.equal(saveRequestPayload.rows[0]?.operation, 'update', 'Same-value QA must never create or delete a row.');
  assert.equal(
    Number(saveRequestPayload.rows[0]?.[candidate.field]),
    Number(candidate.semantic),
    'Batch-save payload changed the selected numeric value.',
  );
  await dataPlatformMain.locator('[data-save-state="saved"]').waitFor({
    state: 'visible',
    timeout: timeoutMs,
  });
  await page.waitForTimeout(300);
  const saveRequestCount = edgeActions
    .slice(saveActionStart)
    .filter((action) => action === 'v2/rent-roll/batch-save').length;
  assert.equal(saveRequestCount, 1, 'Same-value save must emit exactly one batch-save request.');
  const popupVisibleAfterSave = await page.locator('[data-testid="data-platform-error-dialog"]')
    .isVisible()
    .catch(() => false);
  assert.equal(popupVisibleAfterSave, false, 'Same-value save opened an error popup.');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.locator('[data-testid="data-platform-rent-roll-nav"][aria-current="page"]')
    .waitFor({ state: 'visible', timeout: timeoutMs });
  await page.waitForFunction(
    ({ rowId, field }) => Array.from(document.querySelectorAll('[data-rent-roll-row-id]'))
      .some((row) => row.dataset.rentRollRowId === rowId
        && row.querySelector(`[data-draft-field="${field}"]`)),
    { rowId: candidate.row_id, field: candidate.field },
    { timeout: timeoutMs },
  );
  const readback = await dataPlatformMain.locator('[data-rent-roll-row-id]').evaluateAll(
    (rows, target) => {
      const row = rows.find((candidateRow) => candidateRow.dataset.rentRollRowId === target.row_id);
      const input = row?.querySelector(`[data-draft-field="${target.field}"]`);
      return input?.value || '';
    },
    candidate,
  );
  assert.equal(Number(readback.replaceAll(',', '')), Number(candidate.semantic));
  assert.ok(readback.includes(','), 'Reloaded numeric readback must keep thousands separators.');
  let rateDisplayAfterReload = '';
  if (rateFixture) {
    rateDisplayAfterReload = await dataPlatformMain.locator('[data-rent-roll-row-id]').evaluateAll(
      (rows, fixture) => {
        const row = rows.find((candidateRow) => candidateRow.dataset.rentRollRowId === fixture.row_id);
        const input = row?.querySelector(`[data-draft-field="${fixture.field}"]`);
        const suffix = input?.nextElementSibling?.textContent?.trim() || '';
        return input ? `${input.value}${suffix}` : '';
      },
      rateFixture,
    );
    assert.equal(rateDisplayAfterReload, `${rateFixture.expected_display}%`);
  }
  const popupVisibleAfterReload = await page.locator('[data-testid="data-platform-error-dialog"]')
    .isVisible()
    .catch(() => false);
  assert.equal(popupVisibleAfterReload, false, 'Reloaded readback opened an error popup.');

  return {
    checked: true,
    safety_mode: 'same-value-existing-row',
    row_id: candidate.row_id,
    field: candidate.field,
    semantic_value: candidate.semantic,
    blurred_display: blurredDisplay,
    save_request_count: saveRequestCount,
    error_popup_visible: popupVisibleAfterSave || popupVisibleAfterReload,
    save_state: 'saved',
    readback,
    readback_semantic_matches:
      Number(readback.replaceAll(',', '')) === Number(candidate.semantic),
    readback_comma_visible: readback.includes(','),
    payload_operation: saveRequestPayload.rows[0].operation,
    payload_semantic_value: saveRequestPayload.rows[0][candidate.field],
    rate_fixture_checked: rateUi.checked,
    rate_fixture_field: rateFixture?.field || '',
    rate_fixture_raw: rateFixture?.raw_value ?? null,
    rate_expected_display: rateFixture ? `${rateFixture.expected_display}%` : '',
    rate_display: rateDisplayAfterReload,
  };
}

async function rentRollStaleRevisionSaveProbe(
  page,
  dataPlatformMain,
  edgeResponses,
  rentRollReadPayloadPromises,
  timeoutMs,
  auth,
) {
  const numericCandidates = await dataPlatformMain
    .locator('input[data-draft-field][inputmode="decimal"]')
    .evaluateAll((inputs) => inputs.map((input) => {
      const semantic = input.value.replaceAll(',', '').trim();
      const numeric = Number(semantic);
      return {
        row_id: input.closest('[data-rent-roll-row-id]')?.dataset.rentRollRowId || '',
        field: input.dataset.draftField || '',
        semantic,
        blurred_display: input.value,
        eligible: !input.disabled
          && semantic !== ''
          && Number.isFinite(numeric)
          && Math.abs(numeric) >= 1000
          && input.value.includes(','),
      };
    }));
  const candidate = numericCandidates.find((item) => item.eligible && item.row_id && item.field);
  assert.ok(candidate, 'No existing editable numeric value with a visible thousands separator was found.');
  const readPayloads = await Promise.all([...rentRollReadPayloadPromises]);
  const uiSnapshotRow = findRentRollReadRow(readPayloads, candidate.row_id);
  assert.ok(uiSnapshotRow, `UI snapshot row was not found for ${candidate.row_id}.`);
  const assetKey = await dataPlatformMain
    .locator('[data-testid="data-platform-asset-select"]')
    .inputValue();
  assert.ok(assetKey, 'A selected asset key is required for stale revision QA.');

  const noOpResponse = await invokeDataPlatformQa(auth, 'v2/rent-roll/batch-save', {
    asset_key: assetKey,
    client_request_id: randomUUID(),
    expected_revisions: {
      [candidate.row_id]: Number(uiSnapshotRow.space_revision ?? uiSnapshotRow.revision),
    },
    rows: [rentRollQaSparseUpdate(
      uiSnapshotRow,
      candidate.field,
      Number(candidate.semantic),
    )],
  });
  const no_op_api_status = noOpResponse.status;
  assert.ok(
    noOpResponse.ok && noOpResponse.body?.ok === true && noOpResponse.body?.status === 'primary',
    `Revision-staling no-op failed (${noOpResponse.status}): ${JSON.stringify(noOpResponse.body)}`,
  );

  const responseStart = edgeResponses.length;
  const numericInput = dataPlatformMain.locator(
    `[data-rent-roll-row-id="${candidate.row_id}"] [data-draft-field="${candidate.field}"]`,
  );
  const saveButton = dataPlatformMain.locator('[data-testid="rent-roll-save"]');
  const temporarySemantic = String(Number(candidate.semantic) + 1);
  let rollbackRequired = false;
  let rollback = { attempted: false, ok: true, status: 0 };
  try {
    await numericInput.focus();
    assert.equal(await numericInput.inputValue(), candidate.semantic);
    await numericInput.fill(temporarySemantic);
    await numericInput.blur();
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="rent-roll-save"]')?.disabled,
      null,
      { timeout: timeoutMs },
    );
    const conflictResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/functions/v1/ll-dashboard-api')
        && requestAction(response.request()) === 'v2/rent-roll/batch-save'
        && response.status() === 409,
      { timeout: timeoutMs },
    );
    const recoveryReadPromise = page.waitForResponse(
      (response) => response.url().includes('/functions/v1/ll-dashboard-api')
        && requestAction(response.request()) === 'v2/rent-roll/read'
        && response.status() >= 200 && response.status() < 300,
      { timeout: timeoutMs },
    );
    const retryResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/functions/v1/ll-dashboard-api')
        && requestAction(response.request()) === 'v2/rent-roll/batch-save'
        && response.status() >= 200 && response.status() < 300,
      { timeout: timeoutMs },
    );
    await saveButton.click();
    const conflictResponse = await conflictResponsePromise;
    assert.equal(conflictResponse.status(), 409, 'The first stale UI save must return HTTP 409.');
    const conflictBody = await conflictResponse.json().catch(() => null);
    assert.match(
      JSON.stringify(conflictBody),
      /REVISION_CONFLICT/u,
      'The expected first failure was not a revision conflict.',
    );
    await recoveryReadPromise;
    const retryResponse = await retryResponsePromise;
    assert.ok(retryResponse.ok(), `Automatic revision retry failed (${retryResponse.status()}).`);
    rollbackRequired = true;
    await dataPlatformMain.locator('[data-save-state="saved"]').waitFor({
      state: 'visible',
      timeout: timeoutMs,
    });
    const popupAfterRetry = await page.locator('[data-testid="data-platform-error-dialog"]')
      .isVisible()
      .catch(() => false);
    assert.equal(popupAfterRetry, false, 'Automatic revision recovery opened an error popup.');

    const recoveryResponses = edgeResponses.slice(responseStart);
    const recoveryBatchStatuses = recoveryResponses
      .filter((entry) => entry.action === 'v2/rent-roll/batch-save')
      .map((entry) => entry.status);
    const recoveryReadCount = recoveryResponses
      .filter((entry) => entry.action === 'v2/rent-roll/read' && entry.status >= 200 && entry.status < 300)
      .length;
    assert.deepEqual(recoveryBatchStatuses.slice(0, 2), [409, 200]);
    assert.ok(recoveryReadCount >= 2, 'Revision recovery must fresh-read before retry and read back after commit.');
    assert.equal(Number((await numericInput.inputValue()).replaceAll(',', '')), Number(temporarySemantic));

    await numericInput.focus();
    await numericInput.fill(candidate.semantic);
    await numericInput.blur();
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="rent-roll-save"]')?.disabled,
      null,
      { timeout: timeoutMs },
    );
    const restoreResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/functions/v1/ll-dashboard-api')
        && requestAction(response.request()) === 'v2/rent-roll/batch-save'
        && response.status() >= 200 && response.status() < 300,
      { timeout: timeoutMs },
    );
    await saveButton.click();
    const restoreResponse = await restoreResponsePromise;
    assert.ok(restoreResponse.ok(), `Original-value restore failed (${restoreResponse.status()}).`);
    await dataPlatformMain.locator('[data-save-state="saved"]').waitFor({
      state: 'visible',
      timeout: timeoutMs,
    });
    rollbackRequired = false;

    await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.locator('[data-testid="data-platform-rent-roll-nav"][aria-current="page"]')
      .waitFor({ state: 'visible', timeout: timeoutMs });
    await numericInput.waitFor({ state: 'visible', timeout: timeoutMs });
    const readback = await numericInput.inputValue();
    assert.equal(Number(readback.replaceAll(',', '')), Number(candidate.semantic));
    assert.ok(readback.includes(','), 'Restored reload readback must keep thousands separators.');
    const popupAfterReload = await page.locator('[data-testid="data-platform-error-dialog"]')
      .isVisible()
      .catch(() => false);
    assert.equal(popupAfterReload, false, 'Restored reload readback opened an error popup.');

    const allProbeResponses = edgeResponses.slice(responseStart);
    return {
      checked: true,
      safety_mode: 'stale-revision-plus-one-restore',
      row_id: candidate.row_id,
      field: candidate.field,
      semantic_value: candidate.semantic,
      temporary_semantic_value: temporarySemantic,
      no_op_api_status,
      ui_batch_statuses: allProbeResponses
        .filter((entry) => entry.action === 'v2/rent-roll/batch-save')
        .map((entry) => entry.status),
      recovery_read_count: allProbeResponses
        .filter((entry) => entry.action === 'v2/rent-roll/read' && entry.status >= 200 && entry.status < 300)
        .length,
      error_popup_visible: popupAfterRetry || popupAfterReload,
      restored_readback: readback,
      restored_semantic_matches:
        Number(readback.replaceAll(',', '')) === Number(candidate.semantic),
      restored_comma_visible: readback.includes(','),
      rollback,
    };
  } finally {
    if (rollbackRequired) {
      rollback.attempted = true;
      const latestRead = await invokeDataPlatformQa(auth, 'v2/rent-roll/read', {
        asset_key: assetKey,
        limit: 500,
      });
      const latestRow = findRentRollReadRow([latestRead.body], candidate.row_id);
      assert.ok(latestRead.ok && latestRow, 'Rollback could not read the latest rent-roll row.');
      const rollbackResponse = await invokeDataPlatformQa(auth, 'v2/rent-roll/batch-save', {
        asset_key: assetKey,
        client_request_id: randomUUID(),
        expected_revisions: {
          [candidate.row_id]: Number(latestRow.space_revision ?? latestRow.revision),
        },
        rows: [rentRollQaSparseUpdate(latestRow, candidate.field, Number(candidate.semantic))],
      });
      rollback.status = rollbackResponse.status;
      rollback.ok = rollbackResponse.ok && rollbackResponse.body?.ok === true;
      assert.ok(rollback.ok, `Rollback failed (${rollback.status}): ${JSON.stringify(rollbackResponse.body)}`);
    }
  }
}

async function authenticatedProbe(
  browser,
  baseUrl,
  route,
  timeoutMs,
  auth,
  expectWriteEnabled,
  screenshotDir = '',
  exerciseRentRollSameValueSave = false,
  exerciseRentRollStaleRevisionSave = false,
) {
  const targetUrl = joinRoute(baseUrl, route.publicPath);
  const expectedPath = normalizedPathname(joinRoute(baseUrl, route.expectedPublicPath ?? route.publicPath));
  const isDataPlatform = route.surface === 'data-platform';
  const context = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript(({ session }) => {
    sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
    sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email: session.user?.email || '' }));
    window.__gate6LegacySurfaceSeen = false;
    const inspectLegacySurface = () => {
      if (document.querySelector('[data-work-platform-quick-tabs="true"]')) {
        window.__gate6LegacySurfaceSeen = true;
      }
    };
    const observer = new MutationObserver(inspectLegacySurface);
    observer.observe(document, { childList: true, subtree: true });
    inspectLegacySurface();
  }, { session: auth.session });
  const page = await context.newPage();
  const errors = [];
  const edgeActions = [];
  const edgeResponses = [];
  const rentRollReadPayloadPromises = [];
  let documentRequestCount = 0;
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('request', (request) => {
    if (request.resourceType() === 'document') documentRequestCount += 1;
    if (!request.url().includes('/functions/v1/ll-dashboard-api')) return;
    try {
      const body = request.postDataJSON();
      if (body?.action) edgeActions.push(String(body.action));
    } catch {
      // Some browser retries do not retain a JSON body. Response errors are
      // still collected below, so an unreadable request body is not a failure.
    }
  });
  page.on('response', (response) => {
    const action = requestAction(response.request());
    if (response.url().includes('/functions/v1/ll-dashboard-api')) {
      edgeResponses.push({ action, status: response.status() });
    }
    if (
      response.url().includes('/functions/v1/ll-dashboard-api')
      && response.status() < 400
      && action === 'v2/rent-roll/read'
    ) {
      rentRollReadPayloadPromises.push(response.json().catch(() => null));
    }
    const expectedRevisionConflict = exerciseRentRollStaleRevisionSave
      && action === 'v2/rent-roll/batch-save'
      && response.status() === 409;
    if (
      response.url().includes('/functions/v1/ll-dashboard-api')
      && response.status() >= 400
      && !expectedRevisionConflict
    ) {
      errors.push(`edge ${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText || 'unknown';
    if (errorText !== 'net::ERR_ABORTED' && /supabase\.co\/(?:auth|functions)\/v1\//u.test(request.url())) {
      errors.push(`requestfailed ${errorText} ${request.url().replace(/[?#].*$/u, '')}`);
    }
  });
  let report;
  try {
    const directResponse = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const dataPlatformMain = page.locator('[data-testid="logistics-data-platform"]');
    const leftNav = page.locator('[data-testid="logistics-left-nav"]');
    const legacyWorkPlatform = page.locator('[data-work-platform-quick-tabs="true"]');
    const legacyDashboardHeading = page.locator('h1, h2').filter({ hasText: '대시보드 홈' }).first();
    const expectedSurface = isDataPlatform
      ? dataPlatformMain
      : route.surface === 'legacy-work-platform'
        ? legacyWorkPlatform
        : legacyDashboardHeading;
    await leftNav.waitFor({ state: 'visible', timeout: timeoutMs });
    await expectedSurface.waitFor({ state: 'visible', timeout: timeoutMs });
    if (isDataPlatform) {
      await page.locator(`[data-testid="${route.navTestId}"][aria-current="page"]`).waitFor({ state: 'visible', timeout: timeoutMs });
      await dataPlatformMain.locator('h1').filter({ hasText: route.expectedTitle }).waitFor({ state: 'visible', timeout: timeoutMs });
    }
    const sessionAdoption = await page.evaluate(async ({ accessToken, refreshToken }) => {
      const authClient = window.__SUPABASE_CLIENT__?.auth;
      if (!authClient) return { ok: false, reason: 'supabase_client_unavailable' };
      if (!refreshToken) {
        const result = await authClient.getSession();
        return {
          ok: Boolean(result?.data?.session?.access_token === accessToken),
          reason: result?.error?.message || '',
        };
      }
      const result = await authClient.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      return {
        ok: Boolean(!result?.error && result?.data?.session?.user?.id),
        reason: result?.error?.message || '',
      };
    }, {
      accessToken: auth.session.access_token,
      refreshToken: auth.session.refresh_token || '',
    });
    if (!sessionAdoption.ok) {
      throw new Error(`Supabase browser session adoption failed: ${sessionAdoption.reason || 'unknown error'}`);
    }
    if (isDataPlatform) {
      // setSession emits an auth-state event. The application deliberately hides
      // the platform shell while the server permission profile is revalidated,
      // so wait for the selected navigation item to return before measuring it.
      await page.locator(`[data-testid="${route.navTestId}"][aria-current="page"]`)
        .waitFor({ state: 'visible', timeout: timeoutMs });
    }
    const directPath = normalizedPathname(page.url());
    const directSelectedTab = isDataPlatform
      ? await page.locator(`[data-testid="${route.navTestId}"][aria-current="page"]`).count()
      : 0;
    const directLegacySurfaceSeen = await page.evaluate(() => Boolean(window.__gate6LegacySurfaceSeen));
    const refreshResponse = await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await leftNav.waitFor({ state: 'visible', timeout: timeoutMs });
    await expectedSurface.waitFor({ state: 'visible', timeout: timeoutMs });
    if (isDataPlatform) {
      await page.locator(`[data-testid="${route.navTestId}"][aria-current="page"]`).waitFor({ state: 'visible', timeout: timeoutMs });
    }
    const refreshPath = normalizedPathname(page.url());
    const refreshLegacySurfaceSeen = await page.evaluate(() => Boolean(window.__gate6LegacySurfaceSeen));
    if (expectWriteEnabled && isDataPlatform) {
      await page.waitForFunction(() => Boolean(document.querySelector('header select')?.value), null, {
        timeout: timeoutMs,
      });
      if (route.internalPath.endsWith('/home')) {
        await page.waitForFunction(() => {
          const main = document.querySelector('[data-testid="logistics-data-platform"]');
          const text = main?.innerText || '';
          const assetBrief = main?.querySelector('[data-testid="home-asset-brief"]');
          const leaseOperations = main?.querySelector('[data-testid="home-lease-operations"]');
          return Boolean(assetBrief && leaseOperations && text.includes('자산 브리프') && text.includes('임대 운영'))
            && !text.includes('표시할 데이터가 없습니다.');
        }, null, { timeout: timeoutMs });
      }
    }
    const assetSelected = isDataPlatform
      ? Boolean(await dataPlatformMain.locator('[data-testid="data-platform-asset-select"]').inputValue().catch(() => ''))
      : false;
    const assetOptionCount = isDataPlatform
      ? await dataPlatformMain.locator('[data-testid="data-platform-asset-select"] option').count().catch(() => 0)
      : 0;
    const legacyWorkPlatformVisible = await page.locator('[data-work-platform-quick-tabs="true"]').isVisible().catch(() => false);
    const dataPlatformVisible = await dataPlatformMain.isVisible().catch(() => false);
    const leftNavVisible = await leftNav.isVisible().catch(() => false);
    const dataPlatformNavVisible = isDataPlatform
      ? await page.locator(`[data-testid="${route.navTestId}"]`).isVisible().catch(() => false)
      : true;
    const dataPlatformNavItemCount = isDataPlatform
      ? await page.locator('[data-testid="data-platform-only-nav"] > [data-testid^="data-platform-"]').count().catch(() => 0)
      : 0;
    let loginHistoryUi = { checked: false };
    if (isDataPlatform && route.key === 'root') {
      const loginHistoryButton = page.locator('[data-testid="logistics-login-history-button"]');
      await loginHistoryButton.waitFor({ state: 'visible', timeout: timeoutMs });
      await loginHistoryButton.click();
      const loginHistoryModal = page.locator('[data-testid="logistics-login-history-modal"]');
      await loginHistoryModal.waitFor({ state: 'visible', timeout: timeoutMs });
      loginHistoryUi = {
        checked: true,
        button_visible: await loginHistoryButton.isVisible(),
        modal_visible: await loginHistoryModal.isVisible(),
      };
      await page.locator('[data-testid="logistics-login-history-close"]').click();
      await loginHistoryModal.waitFor({ state: 'hidden', timeout: timeoutMs });
    }
    let returnFocusUi = { checked: false };
    if (isDataPlatform && route.key === 'root') {
      await page.evaluate(() => {
        window.__gate6ReturnFocusProbe = {
          authResolvingSeen: false,
          visibilityChanges: 0,
        };
        const inspect = () => {
          if (document.querySelector('[data-testid="logistics-auth-resolving"]')) {
            window.__gate6ReturnFocusProbe.authResolvingSeen = true;
          }
        };
        const observer = new MutationObserver(inspect);
        observer.observe(document, { childList: true, subtree: true });
        document.addEventListener('visibilitychange', () => {
          window.__gate6ReturnFocusProbe.visibilityChanges += 1;
          inspect();
        });
        window.__gate6ReturnFocusObserver = observer;
        inspect();
      });
      const expectedReturnUrl = page.url();
      const documentRequestsBeforeReturn = documentRequestCount;
      const siblingPage = await context.newPage();
      await siblingPage.goto('about:blank');
      await siblingPage.bringToFront();
      await page.waitForTimeout(300);
      await page.bringToFront();
      // Headless Chromium does not consistently emit visibilitychange when
      // bringToFront swaps tabs. Dispatch the same visible-return event that
      // the application receives in a real browser so the revalidation path
      // is exercised deterministically.
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await page.waitForTimeout(1250);
      returnFocusUi = await page.evaluate(({ expectedUrl, requestDelta }) => {
        window.__gate6ReturnFocusObserver?.disconnect();
        return {
          checked: true,
          return_event_dispatched: true,
          visibility_change_count: window.__gate6ReturnFocusProbe?.visibilityChanges || 0,
          auth_resolving_ever_seen: Boolean(window.__gate6ReturnFocusProbe?.authResolvingSeen),
          data_platform_visible: Boolean(document.querySelector('[data-testid="logistics-data-platform"]')),
          url_preserved: window.location.href === expectedUrl,
          document_request_count: requestDelta,
        };
      }, {
        expectedUrl: expectedReturnUrl,
        requestDelta: documentRequestCount - documentRequestsBeforeReturn,
      });
      await siblingPage.close();
    }
    const dataPlatformBodyText = isDataPlatform ? await dataPlatformMain.innerText() : '';
    const bannedCopyVisible = isDataPlatform && [
      '물류센터 데이터 관리 플랫폼',
      'Gate 6',
      '아직 입력된 수익·비용·수납 자료가 없습니다.',
      '계산식 승인 전에는 합계 계산만 잠겨 있습니다.',
      '월별 수익·비용·수납 원장',
      '기존 대출 원장',
      '검증이 끝난 핵심 지표가 없습니다.',
      '핵심 열',
      '계약 조건',
      '비용·권리',
      '부가 정보',
    ].some((copy) => dataPlatformBodyText.includes(copy));
    const headerControlContract = isDataPlatform ? {
      title: await dataPlatformMain.locator('header h1').innerText(),
      asset_select_count: await dataPlatformMain.locator('header [data-testid="data-platform-asset-select"]').count(),
      maturity_button_count: await dataPlatformMain.locator('header [data-testid="data-platform-maturity-button"]').count(),
      top_tab_count: await dataPlatformMain.locator('header nav, header [role="tablist"]').count(),
    } : null;
    let homeMaturityAlertUi = { checked: false };
    if (isDataPlatform && route.key === HOME_MATURITY_ALERT_CONTRACT.routeKey) {
      homeMaturityAlertUi = await homeMaturityAlertProbe(page, dataPlatformMain, edgeActions, timeoutMs);
    }
    let writeUi = { checked: false };
    if (expectWriteEnabled && isDataPlatform && !route.internalPath.endsWith('/home')) {
      const writeSelector = route.key.endsWith('rent-roll')
        ? '[data-testid="rent-roll-add"]'
        : '[data-testid="finance-save"]';
      await page.locator(writeSelector).waitFor({ state: 'visible', timeout: timeoutMs });
      await page.waitForFunction(
        (selector) => {
          const element = document.querySelector(selector);
          return Boolean(element && !element.disabled);
        },
        writeSelector,
        { timeout: timeoutMs },
      );
      writeUi = {
        checked: true,
        write_control_enabled: await page.locator(writeSelector).isEnabled(),
      };
    }
    let financeTrendHover = { checked: false };
    if (isDataPlatform && route.internalPath.endsWith('/income-expense')) {
      const firstTrendPoint = page.locator('[data-testid="finance-trend"] button').first();
      await firstTrendPoint.waitFor({ state: 'visible', timeout: timeoutMs });
      await firstTrendPoint.hover();
      const tooltip = page.locator('[data-testid="finance-trend-tooltip"]');
      await tooltip.waitFor({ state: 'visible', timeout: timeoutMs });
      financeTrendHover = {
        checked: true,
        tooltip_visible: await tooltip.isVisible(),
        tooltip_text: (await tooltip.innerText()).trim(),
      };
      await dataPlatformMain.locator('header h1').hover();
      await tooltip.waitFor({ state: 'hidden', timeout: timeoutMs });
    }
    let homeBriefUi = { checked: false };
    if (isDataPlatform && route.internalPath.endsWith('/home')) {
      const brief = page.locator('[data-testid="home-asset-brief"]');
      homeBriefUi = await brief.evaluate((element) => ({
        checked: true,
        visible: Boolean(element.offsetWidth && element.offsetHeight),
        legacy_grid_count: document.querySelectorAll('[data-testid="home-asset-overview-grid"], [data-testid="home-tenant-summary"]').length,
        horizontal_overflow: element.scrollWidth > element.clientWidth + 1,
        tenant_name_count: element.querySelectorAll('[data-testid="home-tenant-operations"] li').length,
      }));
    }
    let rentRollDraft = { checked: false };
    if (
      expectWriteEnabled
      && isDataPlatform
      && route.internalPath.endsWith('/rent-roll')
      && !exerciseRentRollSameValueSave
      && !exerciseRentRollStaleRevisionSave
    ) {
      const tenantInput = page.locator('[data-draft-field="tenant_name"]').first();
      await tenantInput.waitFor({ state: 'visible', timeout: timeoutMs });
      const originalValue = await tenantInput.inputValue();
      const saveCountBefore = edgeActions.filter((action) => action === 'v2/rent-roll/batch-save').length;
      await tenantInput.fill(`${originalValue} `);
      await tenantInput.fill(originalValue);
      await page.waitForTimeout(750);
      const saveCountAfter = edgeActions.filter((action) => action === 'v2/rent-roll/batch-save').length;
      rentRollDraft = {
        checked: true,
        popup_visible: await page.locator('[data-testid="data-platform-error-dialog"]').isVisible().catch(() => false),
        save_request_count: saveCountAfter - saveCountBefore,
      };
      await page.evaluate(() => {
        Object.keys(sessionStorage)
          .filter((key) => key.startsWith('gate6-rent-roll-draft-'))
          .forEach((key) => sessionStorage.removeItem(key));
      });
    }
    let rentRollSameValueSave = { checked: false };
    if (
      exerciseRentRollSameValueSave
      && isDataPlatform
      && route.internalPath.endsWith('/rent-roll')
    ) {
      rentRollSameValueSave = await rentRollSameValueSaveProbe(
        page,
        dataPlatformMain,
        edgeActions,
        rentRollReadPayloadPromises,
        timeoutMs,
      );
    }
    let rentRollStaleRevisionSave = { checked: false };
    if (
      exerciseRentRollStaleRevisionSave
      && isDataPlatform
      && route.internalPath.endsWith('/rent-roll')
    ) {
      rentRollStaleRevisionSave = await rentRollStaleRevisionSaveProbe(
        page,
        dataPlatformMain,
        edgeResponses,
        rentRollReadPayloadPromises,
        timeoutMs,
        auth,
      );
    }
    const darkStyle = isDataPlatform ? await dataPlatformMain.evaluate((main) => {
      const card = main.querySelector('section:not([data-testid="finance-kpi-strip"])');
      return {
        main_background: getComputedStyle(main).backgroundColor,
        card_background: card ? getComputedStyle(card).backgroundColor : '',
        card_border: card ? getComputedStyle(card).borderTopColor : '',
      };
    }) : null;
    const storedSessionUserId = await page.evaluate(() => {
      try {
        return JSON.parse(sessionStorage.getItem('sb-iota-auth-token') || '{}')?.user?.id || '';
      } catch {
        return '';
      }
    });
    let screenshotPath = '';
    if (screenshotDir) {
      fs.mkdirSync(screenshotDir, { recursive: true });
      screenshotPath = path.join(screenshotDir, `${route.key}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
    }
    report = {
      ok: false,
      target_url: targetUrl,
      direct_status: directResponse?.status() || 0,
      direct_path: directPath,
      direct_selected_tab_count: directSelectedTab,
      refresh_status: refreshResponse?.status() || 0,
      refresh_path: refreshPath,
      session_user_preserved: storedSessionUserId === auth.session.user.id,
      browser_session_adopted: sessionAdoption.ok,
      asset_selected: assetSelected,
      asset_option_count: assetOptionCount,
      legacy_work_platform_visible: legacyWorkPlatformVisible,
      legacy_work_platform_ever_seen: directLegacySurfaceSeen || refreshLegacySurfaceSeen,
      legacy_work_platform_seen_direct: directLegacySurfaceSeen,
      legacy_work_platform_seen_refresh: refreshLegacySurfaceSeen,
      data_platform_visible: dataPlatformVisible,
      left_nav_visible: leftNavVisible,
      data_platform_nav_visible: dataPlatformNavVisible,
      data_platform_nav_item_count: dataPlatformNavItemCount,
      banned_copy_visible: bannedCopyVisible,
      header_control_contract: headerControlContract,
      dark_style: darkStyle,
      write_ui: writeUi,
      login_history_ui: loginHistoryUi,
      return_focus_ui: returnFocusUi,
      finance_trend_hover: financeTrendHover,
      home_brief_ui: homeBriefUi,
      home_maturity_alert_ui: homeMaturityAlertUi,
      rent_roll_draft: rentRollDraft,
      rent_roll_same_value_save: rentRollSameValueSave,
      rent_roll_stale_revision_save: rentRollStaleRevisionSave,
      screenshot_path: screenshotPath,
      errors,
    };
    report.ok = report.direct_status === 200
      && report.refresh_status === 200
      && report.direct_path === expectedPath
      && report.refresh_path === expectedPath
      && report.direct_selected_tab_count === (isDataPlatform ? 1 : 0)
      && report.session_user_preserved
      && leftNavVisible
      && dataPlatformNavVisible
      && (!isDataPlatform || dataPlatformNavItemCount === 3)
      && !bannedCopyVisible
      && (!isDataPlatform || (!expectWriteEnabled || assetSelected))
      && (isDataPlatform
        ? !legacyWorkPlatformVisible && !directLegacySurfaceSeen && !refreshLegacySurfaceSeen && dataPlatformVisible
        : !dataPlatformVisible)
      && (route.surface !== 'legacy-work-platform' || legacyWorkPlatformVisible)
      && (!isDataPlatform || (
        darkStyle?.main_background === 'rgb(31, 31, 30)'
        && darkStyle?.card_background === 'rgb(37, 37, 36)'
        && darkStyle?.card_border === 'rgb(51, 51, 51)'
        && headerControlContract?.title === route.expectedTitle
        && headerControlContract?.asset_select_count === 1
        && headerControlContract?.maturity_button_count === 1
        && headerControlContract?.top_tab_count === 0
      ))
      && (!loginHistoryUi.checked || (loginHistoryUi.button_visible && loginHistoryUi.modal_visible))
      && (!returnFocusUi.checked || (
        returnFocusUi.return_event_dispatched
        && returnFocusUi.visibility_change_count >= 1
        && !returnFocusUi.auth_resolving_ever_seen
        && returnFocusUi.data_platform_visible
        && returnFocusUi.url_preserved
        && returnFocusUi.document_request_count === 0
      ))
      && (!financeTrendHover.checked || (financeTrendHover.tooltip_visible && financeTrendHover.tooltip_text.length > 0))
      && (!homeBriefUi.checked || (homeBriefUi.visible && homeBriefUi.legacy_grid_count === 0 && !homeBriefUi.horizontal_overflow))
      && (!homeMaturityAlertUi.checked || (
        homeMaturityAlertUi.selected_asset === HOME_MATURITY_ALERT_CONTRACT.assetName
        && homeMaturityAlertUi.header_text === `만기 알림 ${HOME_MATURITY_ALERT_CONTRACT.expectedCount}`
        && homeMaturityAlertUi.row_count === HOME_MATURITY_ALERT_CONTRACT.expectedCount
        && homeMaturityAlertUi.detail_checks.length === HOME_MATURITY_ALERT_CONTRACT.expectedLenders.length
        && !homeMaturityAlertUi.loading_zero_exposed
        && homeMaturityAlertUi.write_action_count === 0
      ))
      && (!rentRollDraft.checked || (!rentRollDraft.popup_visible && rentRollDraft.save_request_count === 0))
      && (!rentRollSameValueSave.checked || (
        rentRollSameValueSave.safety_mode === 'same-value-existing-row'
        && rentRollSameValueSave.save_request_count === 1
        && rentRollSameValueSave.save_state === 'saved'
        && !rentRollSameValueSave.error_popup_visible
        && rentRollSameValueSave.readback_semantic_matches
        && rentRollSameValueSave.readback_comma_visible
        && rentRollSameValueSave.payload_operation === 'update'
        && (!rentRollSameValueSave.rate_fixture_checked
          || rentRollSameValueSave.rate_display === rentRollSameValueSave.rate_expected_display)
      ))
      && (!rentRollStaleRevisionSave.checked || (
        rentRollStaleRevisionSave.safety_mode === 'stale-revision-plus-one-restore'
        && rentRollStaleRevisionSave.no_op_api_status >= 200
        && rentRollStaleRevisionSave.no_op_api_status < 300
        && rentRollStaleRevisionSave.ui_batch_statuses[0] === 409
        && rentRollStaleRevisionSave.ui_batch_statuses[1] >= 200
        && rentRollStaleRevisionSave.ui_batch_statuses[1] < 300
        && rentRollStaleRevisionSave.ui_batch_statuses[2] >= 200
        && rentRollStaleRevisionSave.ui_batch_statuses[2] < 300
        && rentRollStaleRevisionSave.recovery_read_count >= 3
        && !rentRollStaleRevisionSave.error_popup_visible
        && rentRollStaleRevisionSave.restored_semantic_matches
        && rentRollStaleRevisionSave.restored_comma_visible
      ))
      && (!writeUi.checked || writeUi.write_control_enabled)
      && errors.length === 0;
  } catch (error) {
    errors.push(error?.message || String(error));
    report = {
      ok: false,
      target_url: targetUrl,
      current_url: page.url(),
      body_text: await page.locator('body').innerText().catch(() => ''),
      asset_option_count: await page.locator('header select option').count().catch(() => 0),
      errors,
    };
  } finally {
    await context.close();
  }
  return report;
}

function runSelfTest() {
  assert.equal(normalizeBasePath('logistics-gate6-preview'), DEFAULT_DEPLOY_BASE_PATH);
  assert.equal(normalizeBasePath('/logistics-gate6-preview/'), DEFAULT_DEPLOY_BASE_PATH);
  assert.equal(
    joinRoute(DEFAULT_LIVE_BASE_URL, 'data-platform/rent-roll'),
    'https://kylee94.github.io/logistics-gate6-preview/data-platform/rent-roll',
  );
  assert.equal(joinRoute(DEFAULT_LIVE_BASE_URL, ''), DEFAULT_LIVE_BASE_URL);
  assert.equal(normalizedPathname(`${DEFAULT_LIVE_BASE_URL}home/`), '/logistics-gate6-preview/home');
  const legacyRoutes = ROUTES.filter((route) => route.surface !== 'data-platform');
  const dataPlatformRoutes = routesForScope(true);
  assert.deepEqual(legacyRoutes.map((route) => route.publicPath), ['work-platform', 'home']);
  assert.equal(dataPlatformRoutes.length, 5);
  assert.equal(
    dataPlatformRoutes.find((route) => route.key === HOME_MATURITY_ALERT_CONTRACT.routeKey)?.publicPath,
    'data-platform/home',
  );
  assert.equal(HOME_MATURITY_ALERT_CONTRACT.expectedCount, HOME_MATURITY_ALERT_CONTRACT.expectedLenders.length);
  assert.doesNotMatch(HOME_MATURITY_ALERT_CONTRACT.assetName, INTERNAL_MATURITY_IDENTIFIER);
  assert.equal(routesForScope(false), ROUTES);
  assert.deepEqual(
    findRentRollRateDisplayFixture([{ data: { rows: [{
      row_key: 'rate-fixture-row',
      rent_escalation_rate: 0.03,
    }] } }]),
    {
      row_id: 'rate-fixture-row',
      field: 'rent_escalation_rate',
      raw_value: 0.03,
      expected_display: '3',
    },
  );
  assert.equal(rentRollPercentDisplayValue('3%'), '3');
  assert.equal(rentRollPercentDisplayValue(3), '3');
  assert.deepEqual(
    routesForScope(true, HOME_MATURITY_ALERT_CONTRACT.routeKey).map((route) => route.key),
    [HOME_MATURITY_ALERT_CONTRACT.routeKey],
  );
  for (const route of dataPlatformRoutes) {
    assert.match(route.internalPath, /\/data-platform\/(?:home|rent-roll|income-expense)$/u);
    assert.ok(route.publicPath === '' || /^data-platform(?:\/|$)/u.test(route.publicPath));
  }
  console.log('logistics data platform deep-link self-test PASS');
}

async function main() {
  if (hasFlag('self-test')) {
    runSelfTest();
    return;
  }

  const expectedBasePath = normalizeBasePath(flagValue('expected-base-path', DEFAULT_DEPLOY_BASE_PATH));
  const timeoutMs = Number(flagValue('timeout-ms', DEFAULT_TIMEOUT_MS));
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000) {
    throw new Error('--timeout-ms must be a number of at least 1000.');
  }
  const requireAuthenticated = hasFlag('require-authenticated');
  const expectWriteEnabled = hasFlag('expect-write-enabled');
  const exerciseRentRollSameValueSave = hasFlag('same-value-rent-roll-save');
  const exerciseRentRollStaleRevisionSave = hasFlag('stale-revision-rent-roll-save');
  const dataPlatformOnly = hasFlag('data-platform-only');
  const routeKey = flagValue('route');
  const routesUnderTest = routesForScope(dataPlatformOnly, routeKey);
  if (routeKey && routesUnderTest.length !== 1) {
    throw new Error(`Unknown or out-of-scope route key: ${routeKey}`);
  }
  const screenshotDirFlag = flagValue('screenshot-dir');
  const screenshotDir = screenshotDirFlag ? path.resolve(process.cwd(), screenshotDirFlag) : '';
  if (expectWriteEnabled && !requireAuthenticated) {
    throw new Error('--expect-write-enabled requires --require-authenticated.');
  }
  if (exerciseRentRollSameValueSave && exerciseRentRollStaleRevisionSave) {
    throw new Error('--same-value-rent-roll-save and --stale-revision-rent-roll-save cannot be combined.');
  }
  if (exerciseRentRollSameValueSave && !requireAuthenticated) {
    throw new Error('--same-value-rent-roll-save requires --require-authenticated.');
  }
  if (exerciseRentRollSameValueSave && !expectWriteEnabled) {
    throw new Error('--same-value-rent-roll-save requires --expect-write-enabled.');
  }
  if (exerciseRentRollSameValueSave && routeKey !== 'data-platform-rent-roll') {
    throw new Error('--same-value-rent-roll-save requires --route=data-platform-rent-roll.');
  }
  if (exerciseRentRollStaleRevisionSave && !requireAuthenticated) {
    throw new Error('--stale-revision-rent-roll-save requires --require-authenticated.');
  }
  if (exerciseRentRollStaleRevisionSave && !expectWriteEnabled) {
    throw new Error('--stale-revision-rent-roll-save requires --expect-write-enabled.');
  }
  if (exerciseRentRollStaleRevisionSave && routeKey !== 'data-platform-rent-roll') {
    throw new Error('--stale-revision-rent-roll-save requires --route=data-platform-rent-roll.');
  }

  let localServer = null;
  const suppliedBaseUrl = flagValue('base-url');
  const mode = suppliedBaseUrl ? 'supplied-url' : 'local-dist';
  if (suppliedBaseUrl) {
    const suppliedPath = normalizeBasePath(new URL(normalizeBaseUrl(suppliedBaseUrl)).pathname);
    if (suppliedPath !== expectedBasePath) {
      throw new Error(`GitHub Pages base-path mismatch: expected ${expectedBasePath}, received ${suppliedPath}`);
    }
  } else {
    const localPort = Number(flagValue('local-port', '0'));
    if (!Number.isInteger(localPort) || localPort < 0 || localPort > 65535) {
      throw new Error('--local-port must be an integer between 0 and 65535.');
    }
    localServer = await startDistServer(expectedBasePath, localPort);
  }
  const baseUrl = normalizeBaseUrl(suppliedBaseUrl || localServer.baseUrl);
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode,
    base_url: baseUrl,
    expected_base_path: expectedBasePath,
    route_scope: dataPlatformOnly ? 'data-platform-only' : 'all',
    rent_roll_same_value_save_requested: exerciseRentRollSameValueSave,
    rent_roll_stale_revision_save_requested: exerciseRentRollStaleRevisionSave,
    live_example: DEFAULT_LIVE_BASE_URL,
    authenticated: {
      required: requireAuthenticated,
      status: requireAuthenticated ? 'pending' : 'not_requested',
      auth_source: null,
      routes: [],
    },
    routes: [],
    errors: [],
  };

  let browser;
  try {
    const auth = requireAuthenticated ? await acquireAuthenticatedSession() : null;
    if (auth) {
      report.authenticated.status = 'running';
      report.authenticated.auth_source = auth.source;
    }
    browser = await chromium.launch({
      headless: !hasFlag('headed'),
      executablePath: chromeExecutablePath(),
    });
    for (const route of routesUnderTest) {
      const transport = await transportProbe(browser, baseUrl, expectedBasePath, route, timeoutMs);
      const anonymous = await anonymousAuthProbe(browser, baseUrl, route, timeoutMs);
      const routeReport = {
        key: route.key,
        public_path: route.publicPath,
        internal_path: route.internalPath,
        transport,
        anonymous_auth: anonymous,
        ok: transport.ok && anonymous.ok,
      };
      report.routes.push(routeReport);
      if (auth) {
        report.authenticated.routes.push(await authenticatedProbe(
          browser,
          baseUrl,
          route,
          timeoutMs,
          auth,
          expectWriteEnabled,
          screenshotDir,
          exerciseRentRollSameValueSave,
          exerciseRentRollStaleRevisionSave,
        ));
      }
    }
    if (auth) {
      report.authenticated.status = report.authenticated.routes.every((route) => route.ok) ? 'passed' : 'failed';
    }
    report.ok = report.routes.every((route) => route.ok)
      && (!requireAuthenticated || report.authenticated.status === 'passed')
      && report.errors.length === 0;
  } catch (error) {
    report.errors.push(error?.message || String(error));
    if (requireAuthenticated && report.authenticated.status !== 'passed') {
      report.authenticated.status = 'failed';
    }
  } finally {
    if (browser) await browser.close();
    if (localServer) await localServer.close();
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
