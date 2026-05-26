const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const DEFAULT_ROUTE = '?p=home';

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
  const email = argsValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = argsValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
  if (!supabaseUrl || !anonKey || !email || !password) throw new Error('Set Supabase URL, anon key, email, and password.');
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await response.json().catch(() => null);
  if (!response.ok || !session?.access_token) throw new Error(`Supabase Auth login failed (${response.status}).`);
  if (!session.expires_at && session.expires_in) session.expires_at = Math.round(Date.now() / 1000) + Number(session.expires_in);
  return { session, email };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `external-refresh-buttons-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'external-refresh-buttons-browser-smoke-latest.json');
  const screenshotPath = path.join(OUT_DIR, `external-refresh-buttons-browser-smoke-${stamp}.png`);
  const targetUrl = joinUrl(argsValue('base-url', DEFAULT_BASE_URL), argsValue('route', DEFAULT_ROUTE));
  const auth = await signInSession();
  const uiEmail = argsValue('ui-email', envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com');
  const browserSession = { ...auth.session, user: { ...(auth.session.user || {}), email: uiEmail } };
  const errors = [];
  const result = {
    ok: false,
    generated_at: new Date().toISOString(),
    url: targetUrl,
    ui_email: uiEmail,
    required_controls: ['building-register-refresh', 'opendart-refresh'],
    missing_controls: [],
    forbidden_text: ['원본 데이터 수정'],
    forbidden_found: [],
    page_errors: errors,
    screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
  };
  let browser;
  let page;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await context.addInitScript(({ email, session }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { email: uiEmail, session: browserSession });
    page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-testid="building-register-refresh"]', { timeout: 60000 });
    await page.waitForSelector('[data-testid="opendart-refresh"]', { timeout: 60000 });
    const bodyText = await page.locator('body').innerText({ timeout: 10000 });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    for (const testId of result.required_controls) {
      if (!(await page.locator(`[data-testid="${testId}"]`).isVisible().catch(() => false))) result.missing_controls.push(testId);
    }
    result.forbidden_found = result.forbidden_text.filter((text) => bodyText.includes(text));
    result.body_excerpt = bodyText.slice(0, 1000);
    result.ok = result.missing_controls.length === 0 && result.forbidden_found.length === 0 && result.page_errors.length === 0;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    if (page) {
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      result.body_excerpt = await page.locator('body').innerText({ timeout: 3000 }).then((text) => text.slice(0, 1000)).catch(() => '');
    }
  } finally {
    if (browser) await browser.close();
    fs.writeFileSync(outJson, JSON.stringify(result, null, 2), 'utf8');
    fs.writeFileSync(latestJson, JSON.stringify(result, null, 2), 'utf8');
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
