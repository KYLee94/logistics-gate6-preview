const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const DEFAULT_ROUTE = 'work-platform';

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
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || undefined;
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

  const email = argsValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = argsValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
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

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `logout-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'logout-browser-smoke-latest.json');
  const screenshotPath = path.join(OUT_DIR, `logout-browser-smoke-${stamp}.png`);
  const targetUrl = joinUrl(argsValue('base-url', DEFAULT_BASE_URL), argsValue('route', DEFAULT_ROUTE));
  const auth = await signInSession();
  const uiEmail = argsValue('ui-email', envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com');
  const browserSession = {
    ...auth.session,
    user: {
      ...(auth.session.user || {}),
      email: uiEmail,
    },
  };
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    url: targetUrl,
    auth_source: auth.source,
    checks: {},
    errors: [],
    screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
  };
  let browser;
  let page;
  let logoutClicked = false;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' });
    await context.addInitScript(({ email, session }) => {
      if (localStorage.getItem('logisticsQaLogoutCompleted') === '1') return;
      if (window.location.pathname.includes('/auth-setup')) return;
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { email: uiEmail, session: browserSession });
    page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    page.on('response', (response) => {
      if (!logoutClicked && response.url().includes('/functions/v1/ll-dashboard-api') && response.status() >= 400) {
        report.errors.push(`edge ${response.status()} ${response.url()}`);
      }
    });

    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 45000 });
    const profileButton = page.getByTestId('logistics-profile-button');
    await profileButton.waitFor({ state: 'visible', timeout: 25000 });
    report.checks.profile_visible = true;

    await profileButton.click();
    const logoutButton = page.locator('button').filter({ hasText: /\uB85C\uADF8\uC544\uC6C3/u }).last();
    await logoutButton.waitFor({ state: 'visible', timeout: 10000 });
    report.checks.logout_button_visible = true;
    report.checks.stale_session_simulated = await page.evaluate(() => {
      const raw = sessionStorage.getItem('sb-iota-auth-token');
      if (!raw) return false;
      try {
        const session = JSON.parse(raw);
        session.expires_at = Math.round(Date.now() / 1000) - 120;
        session.expires_in = 0;
        sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
        sessionStorage.setItem('iota_last_activity', String(Date.now() - 31 * 60 * 1000));
        return true;
      } catch {
        return false;
      }
    });
    logoutClicked = true;
    const logoutStartedAt = Date.now();
    await page.evaluate(() => localStorage.setItem('logisticsQaLogoutCompleted', '1'));
    await Promise.all([
      page.waitForURL(/auth-setup/u, { timeout: 20000 }),
      logoutButton.click(),
    ]);
    report.logout_elapsed_ms = Date.now() - logoutStartedAt;
    report.final_url = page.url();
    report.checks.logout_navigated = /auth-setup/u.test(report.final_url);
    report.checks.logout_completed_without_refresh = report.logout_elapsed_ms < 5000;
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    const storageAfterLogout = await page.evaluate(() => ({
      session_token: sessionStorage.getItem('sb-iota-auth-token'),
      preview_auth: sessionStorage.getItem('logistics_preview_auth'),
      supabase_auth_keys: Object.keys(localStorage).filter((key) => /^sb-|supabase/iu.test(key)),
    })).catch(() => ({ session_token: null, preview_auth: null, supabase_auth_keys: [] }));
    report.storage_after_logout = {
      session_token_present: Boolean(storageAfterLogout.session_token),
      preview_auth_present: Boolean(storageAfterLogout.preview_auth),
      supabase_auth_key_count: storageAfterLogout.supabase_auth_keys.length,
    };
    report.checks.storage_cleared = !storageAfterLogout.session_token
      && !storageAfterLogout.preview_auth
      && storageAfterLogout.supabase_auth_keys.length === 0;
    await page.evaluate(() => localStorage.setItem('logisticsQaLogoutCompleted', '1'));
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    const profileVisibleAfterReentry = await page.getByTestId('logistics-profile-button').isVisible({ timeout: 5000 }).catch(() => false);
    report.reentry_url = page.url();
    report.checks.protected_route_blocked_after_logout = /auth-setup/u.test(report.reentry_url) || !profileVisibleAfterReentry;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    report.ok = Object.values(report.checks).every(Boolean) && report.errors.length === 0;
  } catch (error) {
    report.errors.push(error?.message || String(error));
    if (page) {
      try {
        report.body_excerpt = (await page.locator('body').innerText({ timeout: 5000 })).slice(0, 1200);
        await page.screenshot({ path: screenshotPath, fullPage: false });
      } catch {
        // Ignore screenshot failures after navigation errors.
      }
    }
  } finally {
    if (browser) await browser.close();
  }
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`logout browser smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
