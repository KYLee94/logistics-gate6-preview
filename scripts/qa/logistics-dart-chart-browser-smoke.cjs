const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const DEFAULT_ROUTE = '?p=company';

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
      email: user.email || envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'),
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
  return { session, email, source: 'password_grant' };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `dart-chart-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'dart-chart-browser-smoke-latest.json');
  const screenshotPath = path.join(OUT_DIR, `dart-chart-browser-smoke-${stamp}.png`);
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const route = argsValue('route', DEFAULT_ROUTE);
  const targetUrl = joinUrl(baseUrl, route);
  const auth = await signInSession();
  const uiEmail = argsValue('ui-email', envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com');
  const browserSession = {
    ...auth.session,
    user: {
      ...(auth.session.user || {}),
      email: uiEmail,
    },
  };
  const errors = [];
  const result = {
    ok: false,
    generated_at: new Date().toISOString(),
    url: targetUrl,
    auth_source: auth.source,
    ui_email: uiEmail,
    checks: {},
    page_errors: errors,
    screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
  };
  let browser;
  let page;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await context.addInitScript(({ email, session }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email }));
      localStorage.setItem('logisticsDashboardReadMode', 'preview');
    }, { email: uiEmail, session: browserSession });
    page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('DART 상세 정보'), null, { timeout: 45000 });
    const detailButton = page.getByRole('button', { name: /상세\s*보기/u }).first();
    await detailButton.waitFor({ state: 'visible', timeout: 15000 });
    await detailButton.click();
    await page.getByRole('dialog').or(page.locator('[role="dialog"], .fixed.inset-0')).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    const chart = page.locator('svg[aria-label="OpenDART 3개년 재무 차트"]').first();
    await chart.waitFor({ state: 'visible', timeout: 15000 });
    const axisCheck = await chart.evaluate((svg) => {
      const rightLabels = Array.from(svg.querySelectorAll('text'))
        .filter((node) => node.getAttribute('text-anchor') === 'end' && Number(node.getAttribute('x')) >= 800);
      const plottedItems = Array.from(svg.querySelectorAll('rect, polyline, circle'))
        .map((node) => Number(node.getAttribute('x') || node.getAttribute('cx') || 0))
        .filter((value) => Number.isFinite(value));
      return {
        right_label_count: rightLabels.length,
        max_plot_x: plottedItems.length ? Math.max(...plottedItems) : null,
        right_labels_outside_plot: rightLabels.length >= 2 && (!plottedItems.length || Math.max(...plottedItems) < 800),
      };
    });
    const hoverTarget = chart.locator('rect, circle').last();
    await hoverTarget.hover({ timeout: 10000 });
    const tooltip = page.locator('[data-testid="dart-financial-tooltip"]').first();
    await tooltip.waitFor({ state: 'visible', timeout: 10000 });
    const tooltipText = await tooltip.innerText();
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.checks = {
      axis: axisCheck,
      tooltip: {
        text: tooltipText,
        has_revenue: tooltipText.includes('매출액'),
        has_operating_income: tooltipText.includes('영업이익'),
        has_net_income: tooltipText.includes('당기순이익'),
      },
    };
    result.ok = axisCheck.right_labels_outside_plot
      && result.checks.tooltip.has_revenue
      && result.checks.tooltip.has_operating_income
      && result.checks.tooltip.has_net_income
      && errors.length === 0;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    if (page) await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
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
