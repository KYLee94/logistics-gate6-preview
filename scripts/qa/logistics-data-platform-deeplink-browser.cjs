const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST_DIR = path.join(ROOT, 'dist');
const DEFAULT_DEPLOY_BASE_PATH = '/logistics-gate6-preview/';
const DEFAULT_LIVE_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const DEFAULT_TIMEOUT_MS = 30_000;
const ROUTES = Object.freeze([
  {
    key: 'root',
    publicPath: '',
    internalPath: 'platform/iotaseoul/workspace/logistics/data-platform/home',
  },
  {
    key: 'home',
    publicPath: 'home',
    internalPath: 'platform/iotaseoul/workspace/logistics/data-platform/home',
  },
  {
    key: 'rent-roll',
    publicPath: 'rent-roll',
    internalPath: 'platform/iotaseoul/workspace/logistics/data-platform/rent-roll',
  },
  {
    key: 'income-expense',
    publicPath: 'income-expense',
    internalPath: 'platform/iotaseoul/workspace/logistics/data-platform/income-expense',
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

async function authenticatedProbe(browser, baseUrl, route, timeoutMs, auth, expectWriteEnabled, screenshotDir = '') {
  const targetUrl = joinRoute(baseUrl, route.publicPath);
  const expectedPath = normalizedPathname(joinRoute(baseUrl, route.publicPath || 'home'));
  const context = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript(({ session }) => {
    sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
    sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email: session.user?.email || '' }));
  }, { session: auth.session });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.url().includes('/functions/v1/ll-dashboard-api') && response.status() >= 400) {
      errors.push(`edge ${response.status()} ${response.url()}`);
    }
  });
  let report;
  try {
    const directResponse = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const main = page.locator('[data-testid="logistics-data-platform"]');
    await main.waitFor({ state: 'visible', timeout: timeoutMs });
    await page.locator('nav button[aria-current="page"]').waitFor({ state: 'visible', timeout: timeoutMs });
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
    const directPath = normalizedPathname(page.url());
    const directSelectedTab = await page.locator('nav button[aria-current="page"]').count();
    const refreshResponse = await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await main.waitFor({ state: 'visible', timeout: timeoutMs });
    await page.locator('nav button[aria-current="page"]').waitFor({ state: 'visible', timeout: timeoutMs });
    const refreshPath = normalizedPathname(page.url());
    if (expectWriteEnabled) {
      await page.waitForFunction(() => Boolean(document.querySelector('header select')?.value), null, {
        timeout: timeoutMs,
      });
    }
    const assetSelected = Boolean(await page.locator('header select').inputValue().catch(() => ''));
    const assetOptionCount = await page.locator('header select option').count().catch(() => 0);
    const legacyWorkPlatformVisible = await page.locator('[data-work-platform-quick-tabs="true"]').isVisible().catch(() => false);
    let writeUi = { checked: false };
    if (expectWriteEnabled && !route.internalPath.endsWith('/home')) {
      const addSelector = route.key === 'rent-roll'
        ? '[data-testid="rent-roll-add"]'
        : '[data-testid="finance-add"]';
      const lockSelector = route.key === 'rent-roll'
        ? '[data-testid="rent-roll-write-lock"]'
        : '[data-testid="finance-write-lock"]';
      await page.locator(addSelector).waitFor({ state: 'visible', timeout: timeoutMs });
      await page.waitForFunction(
        (selector) => {
          const element = document.querySelector(selector);
          return Boolean(element && !element.disabled);
        },
        addSelector,
        { timeout: timeoutMs },
      );
      writeUi = {
        checked: true,
        add_enabled: await page.locator(addSelector).isEnabled(),
        lock_visible: await page.locator(lockSelector).isVisible().catch(() => false),
      };
    }
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
      write_ui: writeUi,
      screenshot_path: screenshotPath,
      errors,
    };
    report.ok = report.direct_status === 200
      && report.refresh_status === 200
      && report.direct_path === expectedPath
      && report.refresh_path === expectedPath
      && report.direct_selected_tab_count === 1
      && report.session_user_preserved
      && (!expectWriteEnabled || assetSelected)
      && !legacyWorkPlatformVisible
      && (!writeUi.checked || (writeUi.add_enabled && !writeUi.lock_visible))
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
    joinRoute(DEFAULT_LIVE_BASE_URL, 'rent-roll'),
    'https://kylee94.github.io/logistics-gate6-preview/rent-roll',
  );
  assert.equal(joinRoute(DEFAULT_LIVE_BASE_URL, ''), DEFAULT_LIVE_BASE_URL);
  assert.equal(normalizedPathname(`${DEFAULT_LIVE_BASE_URL}home/`), '/logistics-gate6-preview/home');
  for (const route of ROUTES) {
    const expectedTab = route.publicPath || 'home';
    assert.match(route.internalPath, new RegExp(`/data-platform/${expectedTab}$`, 'u'));
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
  const requireAuthenticated = hasFlag('require-authenticated');
  const expectWriteEnabled = hasFlag('expect-write-enabled');
  const screenshotDirFlag = flagValue('screenshot-dir');
  const screenshotDir = screenshotDirFlag ? path.resolve(process.cwd(), screenshotDirFlag) : '';
  if (expectWriteEnabled && !requireAuthenticated) {
    throw new Error('--expect-write-enabled requires --require-authenticated.');
  }
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode,
    base_url: baseUrl,
    expected_base_path: expectedBasePath,
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
    for (const route of ROUTES) {
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
