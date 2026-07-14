const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const MIN_LIVE_IDLE_MS = 120_000;

const ROUTES = [
  { key: 'work-platform', route: 'work-platform', selector: '#task-management', minText: 600 },
  { key: 'home', route: 'home', minText: 600 },
  { key: 'market-overview', route: 'market-data/overview', selector: '[data-testid="market-data-dashboard"]', minText: 600 },
  { key: 'market-lease', route: 'market-data/lease-market', selector: '[data-testid="market-data-dashboard"]', minText: 600 },
  { key: 'data-management-lease', route: 'data-management/lease-contracts', selector: '[data-data-management-redesign="true"]', minText: 500 },
  { key: 'data-management-quality', route: 'data-management/data-quality', selector: '[data-data-management-redesign="true"]', minText: 300 },
];

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

function argValue(name, fallback = '') {
  const eqPrefix = `--${name}=`;
  const eqArg = process.argv.find((item) => item.startsWith(eqPrefix));
  if (eqArg) return eqArg.slice(eqPrefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function numberArg(name, fallback) {
  const value = Number(argValue(name, String(fallback)));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\./u, '-').replace('T', '-');
}

function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || undefined;
}

function joinUrl(baseUrl, route, stamp) {
  const normalizedBase = String(baseUrl || DEFAULT_BASE_URL).endsWith('/') ? String(baseUrl || DEFAULT_BASE_URL) : `${baseUrl}/`;
  const url = new URL(String(route || '').replace(/^\/+/u, ''), normalizedBase);
  url.searchParams.set('qa_cache_bust', stamp);
  return url.toString();
}

async function navigateInApp(page, baseUrl, route, stamp) {
  const url = joinUrl(baseUrl, route, stamp);
  await page.evaluate((nextUrl) => {
    window.history.pushState(null, '', nextUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new CustomEvent('logistics-data-refresh', { detail: { path: window.location.pathname } }));
  }, url);
}

async function waitForDuration(page, durationMs) {
  const deadline = Date.now() + durationMs;
  await page.waitForFunction((target) => Date.now() >= target, deadline, {
    timeout: durationMs + 10_000,
    polling: Math.min(1000, Math.max(50, durationMs)),
  });
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
      email: user.email || envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com',
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
  return { session, email, source: 'password_grant' };
}

function hasVisibleLoadingState() {
  const loadingText = /(\ubd88\ub7ec\uc624\ub294 \uc911|\ub85c\ub529|Loading)/iu;
  const nodes = [...document.body.querySelectorAll('div, span, p, td, th, button')].slice(0, 2500);
  return nodes.some((node) => {
    const text = (node.textContent || '').trim();
    if (!text || text.length > 120 || !loadingText.test(text)) return false;
    if (node.children.length > 2) return false;
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  });
}

async function waitForRouteReady(page, probe) {
  await page.waitForFunction(({ selector, minText }) => {
    const body = document.body?.innerText || '';
    if (!body || body.length < minText) return false;
    if (/auth-setup/iu.test(window.location.href)) return false;
    if (selector && !document.querySelector(selector)) return false;
    return true;
  }, { selector: probe.selector || '', minText: probe.minText || 300 }, { timeout: 45_000 });
  await page.waitForFunction(() => {
    const loadingText = /(\ubd88\ub7ec\uc624\ub294 \uc911|\ub85c\ub529|Loading)/iu;
    const nodes = [...document.body.querySelectorAll('div, span, p, td, th, button')].slice(0, 2500);
    return !nodes.some((node) => {
      const text = (node.textContent || '').trim();
      if (!text || text.length > 120 || !loadingText.test(text)) return false;
      if (node.children.length > 2) return false;
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    });
  }, undefined, { timeout: 15_000 });
}

async function collectRouteState(page, probe, elapsedMs) {
  const state = await page.evaluate(({ selector, minText }) => {
    const body = document.body?.innerText || '';
    const internalPattern = /\bll_|source_row_id|source_file_id|source_sheet_id|natural_key|row_hash|payload|\bPNU\b|\bpnu\b|asset_[a-z0-9_]+|tenant_brn_/iu;
    const brokenPattern = /\?{4,}/u;
    const loadingText = /(\ubd88\ub7ec\uc624\ub294 \uc911|\ub85c\ub529|Loading)/iu;
    const loadingContexts = [];
    const hasLoading = [...document.body.querySelectorAll('div, span, p, td, th, button')].slice(0, 2500).some((node) => {
      const text = (node.textContent || '').trim();
      if (!text || text.length > 120 || !loadingText.test(text)) return false;
      if (node.children.length > 2) return false;
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = node.getBoundingClientRect();
      const visible = rect.width > 1 && rect.height > 1;
      if (visible) {
        loadingContexts.push({
          text,
          tag: node.tagName,
          className: String(node.className || '').slice(0, 160),
        });
      }
      return visible;
    });
    return {
      url: window.location.href,
      body_length: body.length,
      selector_present: selector ? Boolean(document.querySelector(selector)) : true,
      loading_visible: hasLoading,
      loading_contexts: loadingContexts.slice(0, 8),
      auth_setup_visible: /auth-setup/iu.test(window.location.href),
      broken_question_marks_visible: brokenPattern.test(body),
      internal_tokens_visible: internalPattern.test(body),
      min_text_ok: body.length >= minText,
      table_rows: [...document.querySelectorAll('tbody tr, [role="row"]')].length,
      excerpt: body.slice(0, 500),
    };
  }, { selector: probe.selector || '', minText: probe.minText || 300 });
  return {
    key: probe.key,
    route: probe.route,
    elapsed_ms: elapsedMs,
    ...state,
    ok: elapsedMs <= 15_000
      && state.selector_present
      && !state.loading_visible
      && !state.auth_setup_visible
      && !state.broken_question_marks_visible
      && !state.internal_tokens_visible
      && state.min_text_ok,
  };
}

async function waitForAction(page, action, trigger, timeout = 30_000) {
  const responsePromise = page.waitForResponse((response) => (
    response.url().includes('/functions/v1/ll-dashboard-api')
    && response.request().postData()?.includes(`"action":"${action}"`)
  ), { timeout }).catch(() => null);
  await trigger();
  const response = await responsePromise;
  const body = response ? await response.json().catch(() => null) : null;
  return { matched: Boolean(response), status: response?.status() || null, ok: Boolean(response) && response.status() < 400 && body?.ok !== false };
}

async function checkSystemModals(page) {
  const modalChecks = {};
  const featureButton = page.getByTestId('logistics-feature-access-button');
  if (await featureButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    const result = await waitForAction(page, 'feature-access/get', () => featureButton.click());
    const visible = await page.getByTestId('logistics-feature-access-modal').isVisible({ timeout: 15_000 }).catch(() => false);
    modalChecks.feature_access = { ...result, visible, ok: result.ok && visible };
    await page.getByTestId('logistics-feature-access-close').click().catch(() => {});
  } else {
    modalChecks.feature_access = { ok: false, visible: false, problem: 'feature access button not visible' };
  }

  const loginButton = page.getByTestId('logistics-login-history-button');
  if (await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    const result = await waitForAction(page, 'auth/login-history/list', () => loginButton.click());
    const visible = await page.getByTestId('logistics-login-history-modal').isVisible({ timeout: 15_000 }).catch(() => false);
    modalChecks.login_history = { ...result, visible, ok: result.ok && visible };
    await page.getByTestId('logistics-login-history-close').click().catch(() => {});
  } else {
    modalChecks.login_history = { ok: false, visible: false, problem: 'login history button not visible' };
  }

  const notificationButton = page.getByTestId('logistics-notification-button');
  if (await notificationButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    const result = await waitForAction(page, 'notifications/list', () => notificationButton.click());
    const visible = await page.getByTestId('logistics-notification-panel').isVisible({ timeout: 15_000 }).catch(() => false);
    modalChecks.notifications = { ...result, visible, ok: result.ok && visible };
  } else {
    modalChecks.notifications = { ok: false, visible: false, problem: 'notification button not visible' };
  }
  return modalChecks;
}

function edgeAction(response) {
  try {
    return JSON.parse(response.request().postData() || '{}')?.action || 'unknown-action';
  } catch {
    return 'unknown-action';
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `data-loading-idle-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'data-loading-idle-latest.json');
  const screenshotPath = path.join(OUT_DIR, `data-loading-idle-${stamp}.png`);
  const baseUrl = argValue('base-url', DEFAULT_BASE_URL);
  const idleMs = Math.max(MIN_LIVE_IDLE_MS, numberArg('idle-ms', MIN_LIVE_IDLE_MS));
  const auth = await signInSession();
  const uiEmail = argValue('ui-email', envValue('LOGISTICS_BROWSER_UI_EMAIL') || auth.email || 'kylee@igisam.com');
  const browserSession = { ...auth.session, user: { ...(auth.session.user || {}), email: uiEmail } };
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    script: 'qa:data-loading:idle',
    idle_model: 'live_browser_wait',
    base_url: baseUrl,
    auth_source: auth.source,
    ui_email: uiEmail,
    idle_ms: idleMs,
    routes: [],
    modal_checks: {},
    auth_errors: [],
    server_errors: [],
    errors: [],
    warnings: [],
    screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
  };
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(({ email, session }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { email: uiEmail, session: browserSession });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error' && !/Failed to load resource/iu.test(message.text())) {
        report.errors.push(`console: ${message.text().slice(0, 500)}`);
      }
    });
    page.on('response', (response) => {
      if (response.url().includes('/functions/v1/ll-dashboard-api') && [401, 403].includes(response.status())) {
        report.auth_errors.push(`edge ${response.status()} action=${edgeAction(response)}`);
      }
      if (response.url().includes('/functions/v1/ll-dashboard-api') && response.status() >= 500) {
        report.server_errors.push(`edge ${response.status()} action=${edgeAction(response)}`);
      }
    });

    await page.goto(joinUrl(baseUrl, '', `${stamp}-warmup`), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitForRouteReady(page, ROUTES[0]);
    report.idle_started_at = new Date().toISOString();
    const background = await context.newPage();
    try {
      await background.goto('about:blank');
      await background.bringToFront();
      await waitForDuration(background, idleMs);
    } finally {
      await background.close().catch(() => null);
      await page.bringToFront();
    }
    report.idle_finished_at = new Date().toISOString();

    for (const probe of ROUTES) {
      const startedAt = Date.now();
      try {
        await navigateInApp(page, baseUrl, probe.route, `${stamp}-${probe.key}`);
        await waitForRouteReady(page, probe);
        report.routes.push(await collectRouteState(page, probe, Date.now() - startedAt));
      } catch (error) {
        const row = await collectRouteState(page, probe, Date.now() - startedAt).catch(() => ({
          key: probe.key,
          route: probe.route,
          elapsed_ms: Date.now() - startedAt,
          ok: false,
          url: page.url(),
        }));
        row.ok = false;
        row.problem = row.problem || error?.message || String(error);
        report.routes.push(row);
      }
    }

    await navigateInApp(page, baseUrl, 'home', `${stamp}-modals`);
    await waitForRouteReady(page, { key: 'home', minText: 600 });
    report.modal_checks = await checkSystemModals(page);
    await page.screenshot({ path: screenshotPath, fullPage: false });
  } catch (error) {
    report.errors.push(error?.stack || error?.message || String(error));
  } finally {
    if (browser) await browser.close().catch(() => null);
  }

  const elapsedValues = report.routes.map((row) => row.elapsed_ms).filter((value) => Number.isFinite(value));
  report.summary = {
    failed_routes: report.routes.filter((row) => !row.ok).length,
    failed_modals: Object.values(report.modal_checks || {}).filter((row) => !row.ok).length,
    max_elapsed_ms: elapsedValues.length ? Math.max(...elapsedValues) : null,
    avg_elapsed_ms: elapsedValues.length ? Math.round(elapsedValues.reduce((sum, value) => sum + value, 0) / elapsedValues.length) : null,
  };
  report.ok = report.routes.length === ROUTES.length
    && report.routes.every((row) => row.ok)
    && Object.values(report.modal_checks || {}).every((row) => row.ok)
    && report.auth_errors.length === 0
    && report.server_errors.length === 0
    && report.errors.length === 0
    && idleMs >= MIN_LIVE_IDLE_MS
    && /^https:\/\/kylee94\.github\.io\/logistics-gate6-preview\/?/iu.test(baseUrl);

  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`data loading live idle ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson).replace(/\\/gu, '/')}`);
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
