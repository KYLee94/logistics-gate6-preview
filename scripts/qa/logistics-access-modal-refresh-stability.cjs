const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const DEFAULT_ROUTE = '?p=platform/iotaseoul/workspace/logistics/dashboard/home';

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

function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || undefined;
}

function joinUrl(baseUrl, route) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(route.replace(/^\/+/u, ''), normalizedBase).toString();
}

async function signInSession() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const accessToken = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (supabaseUrl && anonKey && accessToken) {
    const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` },
    });
    const user = await response.json().catch(() => null);
    if (!response.ok || !user?.id) throw new Error(`Supabase access token validation failed (${response.status}).`);
    return {
      session: {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.round(Date.now() / 1000) + 3600,
        refresh_token: '',
        user,
      },
      source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN',
    };
  }
  const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  if (!supabaseUrl || !anonKey || !email || !password) {
    throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or set LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  }
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await response.json().catch(() => null);
  if (!response.ok || !session?.access_token) throw new Error(`Supabase Auth login failed (${response.status}).`);
  if (!session.expires_at && session.expires_in) session.expires_at = Math.round(Date.now() / 1000) + Number(session.expires_in);
  return { session, source: 'password_grant' };
}

async function waitForAction(page, action, trigger, timeout = 30000) {
  const responsePromise = page.waitForResponse((response) => (
    response.url().includes('/functions/v1/ll-dashboard-api')
    && response.request().postData()?.includes(`"action":"${action}"`)
  ), { timeout }).catch(() => null);
  await trigger();
  const response = await responsePromise;
  const body = response ? await response.json().catch(() => null) : null;
  return { matched: Boolean(response), status: response?.status() || null, ok: body?.ok !== false };
}

async function dispatchRefreshEvents(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new CustomEvent('logistics-data-refresh'));
  });
}

async function waitForAutoReload(page, action) {
  await page.waitForTimeout(1500);
  const first = await waitForAction(page, action, () => dispatchRefreshEvents(page), 18000);
  if (first.matched) return first;
  await page.waitForTimeout(1500);
  return waitForAction(page, action, () => dispatchRefreshEvents(page), 18000);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `access-modal-refresh-stability-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'access-modal-refresh-stability-latest.json');
  const screenshot = path.join(OUT_DIR, `access-modal-refresh-stability-${stamp}.png`);
  const targetUrl = joinUrl(argsValue('base-url', DEFAULT_BASE_URL), argsValue('route', DEFAULT_ROUTE));
  const auth = await signInSession();
  const uiEmail = envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com';
  const browserSession = { ...auth.session, user: { ...(auth.session.user || {}), email: uiEmail } };
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    url: targetUrl,
    auth_source: auth.source,
    checks: {},
    calls: {},
    screenshot: path.relative(ROOT, screenshot).replace(/\\/gu, '/'),
    errors: [],
  };
  let browser;
  let page;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await context.addInitScript(({ email, session }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email }));
      sessionStorage.setItem('iotaLeftNavCollapsed', 'true');
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { email: uiEmail, session: browserSession });
    page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    page.on('response', (response) => {
      if (response.url().includes('/functions/v1/ll-dashboard-api') && response.status() >= 500) {
        report.errors.push(`edge ${response.status()} ${response.url()}`);
      }
    });
    await page.goto(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}cb=${stamp}`, { waitUntil: 'networkidle', timeout: 60000 });

    const featureButton = page.getByTestId('logistics-feature-access-button');
    await featureButton.waitFor({ state: 'visible', timeout: 25000 });
    const featureOpen = await waitForAction(page, 'feature-access/get', () => featureButton.click());
    const featureModal = page.getByTestId('logistics-feature-access-modal');
    await featureModal.waitFor({ state: 'visible', timeout: 25000 });
    await page.waitForFunction(() => {
      const button = document.querySelector('[data-testid="logistics-feature-access-save"]');
      return button && button.getAttribute('data-loading') === 'false';
    }, { timeout: 25000 });
    const featureRefresh = await waitForAutoReload(page, 'feature-access/get');
    report.calls.feature_open = featureOpen;
    report.calls.feature_auto_refresh = featureRefresh;
    report.checks.feature_open_loaded = featureOpen.matched && featureOpen.ok;
    report.checks.feature_open_modal_visible = await featureModal.isVisible();
    report.checks.feature_focus_or_refresh_reloads = featureRefresh.matched && featureRefresh.ok;
    await page.getByTestId('logistics-feature-access-close').click();

    const loginButton = page.getByTestId('logistics-login-history-button');
    await loginButton.waitFor({ state: 'visible', timeout: 25000 });
    const loginOpen = await waitForAction(page, 'auth/login-history/list', () => loginButton.click());
    const loginModal = page.getByTestId('logistics-login-history-modal');
    await Promise.race([
      loginModal.waitFor({ state: 'visible', timeout: 25000 }),
      page.getByText('권한자 로그인 상태').waitFor({ state: 'visible', timeout: 25000 }),
    ]);
    const loginRefresh = await waitForAutoReload(page, 'auth/login-history/list');
    report.calls.login_open = loginOpen;
    report.calls.login_auto_refresh = loginRefresh;
    report.checks.login_open_loaded = loginOpen.matched && loginOpen.ok;
    report.checks.login_open_modal_visible = await loginModal.isVisible().catch(() => false)
      || await page.getByText('권한자 로그인 상태').isVisible().catch(() => false);
    report.checks.login_focus_or_refresh_reloads = loginRefresh.matched && loginRefresh.ok;
    if (await loginModal.isVisible().catch(() => false)) await loginModal.screenshot({ path: screenshot });
    else await page.screenshot({ path: screenshot, fullPage: false });

    report.ok = Object.values(report.checks).every(Boolean) && report.errors.length === 0;
  } catch (error) {
    report.errors.push(error?.message || String(error));
    if (page) {
      try {
        report.body_excerpt = (await page.locator('body').innerText()).slice(0, 1600);
        await page.screenshot({ path: screenshot, fullPage: false });
      } catch {
        // ignore screenshot failures
      }
    }
  } finally {
    if (browser) await browser.close();
  }
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`access modal refresh stability ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
