const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const INTERNAL_TOKEN_PATTERN = /\bll_|source_row_id|source_file_id|source_sheet_id|natural_key|row_hash|payload|\bPNU\b|\bpnu\b|asset_[a-z0-9_]+|tenant_brn_/iu;
const BROKEN_TEXT_PATTERN = /\?{4,}/u;
const AUTH_SETUP_PATTERN = /auth-setup/iu;

const ROUTES = [
  { key: 'work-platform', route: 'work-platform', selector: '#task-management', minText: 600 },
  { key: 'home', route: 'home', minText: 600 },
  { key: 'asset', route: 'asset', minText: 600 },
  { key: 'company', route: 'company', minText: 600 },
  { key: 'investment-index', route: 'investment-index', minText: 500 },
  { key: 'asset-spec', route: 'asset-spec', minText: 500 },
  { key: 'analysis-tools', route: 'analysis-tools', minText: 300 },
  { key: 'pivot-table', route: 'pivot-table', minText: 300 },
  { key: 'data-quality', route: 'data-quality', minText: 300 },
  { key: 'market-overview', route: 'market-data/overview', selector: '[data-testid="market-data-dashboard"]', minText: 600 },
  { key: 'market-lease', route: 'market-data/lease-market', selector: '[data-testid="market-data-dashboard"]', minText: 600 },
  { key: 'market-supply', route: 'market-data/supply-pipeline', selector: '[data-testid="market-data-dashboard"]', minText: 600 },
  { key: 'market-transactions', route: 'market-data/transactions', selector: '[data-testid="market-data-dashboard"]', minText: 600 },
  { key: 'market-source', route: 'market-data/source-update', selector: '[data-testid="market-data-dashboard"]', minText: 500 },
  { key: 'data-management-asset', route: 'data-management/asset-data', selector: '[data-data-management-redesign="true"]', minText: 500 },
  { key: 'data-management-investment', route: 'data-management/investment-data', selector: '[data-data-management-redesign="true"]', minText: 500 },
  { key: 'data-management-lease', route: 'data-management/lease-contracts', selector: '[data-data-management-redesign="true"]', minText: 500 },
  { key: 'data-management-managers', route: 'data-management/managers', selector: '[data-data-management-redesign="true"]', minText: 500 },
  { key: 'data-management-quality', route: 'data-management/data-quality', selector: '[data-data-management-redesign="true"]', minText: 300 },
  { key: 'contract-data', route: 'contract-data', minText: 300 },
  { key: 'pdf-report', route: 'pdf-report', minText: 300 },
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

function visibleLoadingState() {
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
  }, { selector: probe.selector || '', minText: probe.minText || 300 }, { timeout: 45000 });
  await page.waitForFunction(visibleLoadingState, undefined, { timeout: 2500 }).catch(() => null);
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
  }, undefined, { timeout: 15000 }).catch(() => null);
}

async function collectRouteState(page, probe, elapsedMs) {
  const state = await page.evaluate(({ selector, minText }) => {
    const matchContexts = (body, pattern, limit = 8) => {
      const contexts = [];
      const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
      const re = new RegExp(pattern.source, flags);
      for (const match of body.matchAll(re)) {
        const index = match.index || 0;
        contexts.push({
          match: match[0],
          context: body
            .slice(Math.max(0, index - 90), Math.min(body.length, index + 140))
            .replace(/\s+/gu, ' ')
            .trim(),
        });
        if (contexts.length >= limit) break;
      }
      return contexts;
    };
    const internalTokenPattern = /\bll_|source_row_id|source_file_id|source_sheet_id|natural_key|row_hash|payload|\bPNU\b|\bpnu\b|asset_[a-z0-9_]+|tenant_brn_/iu;
    const brokenTextPattern = /\?{4,}/u;
    const hasVisibleLoadingState = () => {
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
    };
    const body = document.body?.innerText || '';
    const tableRows = [...document.querySelectorAll('tbody tr, [role="row"]')].length;
    const charts = [...document.querySelectorAll('svg, canvas, [data-chart-ready="true"], [data-testid*="chart"]')].length;
    const modals = [...document.querySelectorAll('[role="dialog"], [data-testid$="modal"]')].filter((node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 2 && rect.height > 2;
    }).length;
    return {
      url: window.location.href,
      body_length: body.length,
      selector_present: selector ? Boolean(document.querySelector(selector)) : true,
      loading_visible: hasVisibleLoadingState(),
      auth_setup_visible: /auth-setup/iu.test(window.location.href) || /\uc778\uc99d|login|sign in/iu.test(body.slice(0, 1200)),
      broken_question_marks_visible: brokenTextPattern.test(body),
      broken_question_contexts: matchContexts(body, brokenTextPattern),
      internal_tokens_visible: internalTokenPattern.test(body),
      internal_token_contexts: matchContexts(body, internalTokenPattern),
      min_text_ok: body.length >= minText,
      table_rows: tableRows,
      charts,
      modals,
      excerpt: body.slice(0, 800),
    };
  }, { selector: probe.selector || '', minText: probe.minText || 300 });
  return {
    key: probe.key,
    route: probe.route,
    elapsed_ms: elapsedMs,
    ...state,
    ok: elapsedMs <= 15000
      && state.selector_present
      && !state.loading_visible
      && !state.auth_setup_visible
      && !state.broken_question_marks_visible
      && !state.internal_tokens_visible
      && state.min_text_ok,
  };
}

async function waitForAction(page, action, trigger, timeout = 30000) {
  const responsePromise = page.waitForResponse((response) => (
    response.url().includes('/functions/v1/ll-dashboard-api')
    && response.request().postData()?.includes(`"action":"${action}"`)
  ), { timeout }).catch(() => null);
  await trigger();
  const response = await responsePromise;
  const body = response ? await response.json().catch(() => null) : null;
  return { matched: Boolean(response), status: response?.status() || null, ok: Boolean(response) && response.status() < 400 && body?.ok !== false };
}

async function checkSystemModals(page, report) {
  const modalChecks = {};
  const featureButton = page.getByTestId('logistics-feature-access-button');
  if (await featureButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    const result = await waitForAction(page, 'feature-access/get', () => featureButton.click());
    const visible = await page.getByTestId('logistics-feature-access-modal').isVisible({ timeout: 15000 }).catch(() => false);
    modalChecks.feature_access = { ...result, visible, ok: result.ok && visible };
    await page.getByTestId('logistics-feature-access-close').click().catch(() => {});
  } else {
    modalChecks.feature_access = { ok: false, visible: false, problem: 'feature access button not visible' };
  }

  const loginButton = page.getByTestId('logistics-login-history-button');
  if (await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    const result = await waitForAction(page, 'auth/login-history/list', () => loginButton.click());
    const visible = await page.getByTestId('logistics-login-history-modal').isVisible({ timeout: 15000 }).catch(() => false);
    modalChecks.login_history = { ...result, visible, ok: result.ok && visible };
    await page.getByTestId('logistics-login-history-close').click().catch(() => {});
  } else {
    modalChecks.login_history = { ok: false, visible: false, problem: 'login history button not visible' };
  }

  const notificationButton = page.getByTestId('logistics-notification-button');
  if (await notificationButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    const result = await waitForAction(page, 'notifications/list', () => notificationButton.click());
    const visible = await page.getByTestId('logistics-notification-panel').isVisible({ timeout: 15000 }).catch(() => false);
    modalChecks.notifications = { ...result, visible, ok: result.ok && visible };
    await page.keyboard.press('Escape').catch(() => {});
    await page.mouse.click(20, 20).catch(() => {});
  } else {
    modalChecks.notifications = { ok: false, visible: false, problem: 'notification button not visible' };
  }
  report.modal_checks = modalChecks;
}

async function checkIdleReturnAndTabSwitch(page, context, baseUrl, stamp, idleMs) {
  const overview = ROUTES.find((probe) => probe.key === 'market-overview');
  const lease = ROUTES.find((probe) => probe.key === 'market-lease');
  if (!overview || !lease) throw new Error('Market tab probes are not configured.');

  await navigateInApp(page, baseUrl, overview.route, `${stamp}-idle-before`);
  await waitForRouteReady(page, overview);
  const background = await context.newPage();
  try {
    await background.goto('about:blank');
    await background.bringToFront();
    await page.waitForTimeout(idleMs);

    const idleReturnStartedAt = Date.now();
    await page.bringToFront();
    await waitForRouteReady(page, overview);
    const idleReturn = await collectRouteState(page, overview, Date.now() - idleReturnStartedAt);

    const tabSwitchStartedAt = Date.now();
    await navigateInApp(page, baseUrl, lease.route, `${stamp}-tab-return`);
    await waitForRouteReady(page, lease);
    const tabSwitch = await collectRouteState(page, lease, Date.now() - tabSwitchStartedAt);

    return {
      idle_ms: idleMs,
      idle_return: idleReturn,
      tab_reswitch: tabSwitch,
      ok: idleReturn.ok && tabSwitch.ok,
    };
  } finally {
    await background.close().catch(() => {});
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `full-app-loading-stability-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'full-app-loading-stability-latest.json');
  const screenshotPath = path.join(OUT_DIR, `full-app-loading-stability-${stamp}.png`);
  const baseUrl = argValue('base-url', DEFAULT_BASE_URL);
  const cycles = numberArg('cycles', 50);
  const idleMs = numberArg('idle-ms', 3000);
  const auth = await signInSession();
  const uiEmail = argValue('ui-email', envValue('LOGISTICS_BROWSER_UI_EMAIL') || auth.email || 'kylee@igisam.com');
  const browserSession = { ...auth.session, user: { ...(auth.session.user || {}), email: uiEmail } };
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    script: 'qa:full-app-loading-stability',
    base_url: baseUrl,
    auth_source: auth.source,
    ui_email: uiEmail,
    cycles,
    idle_ms: idleMs,
    route_count: ROUTES.length,
    routes: [],
    idle_return: null,
    modal_checks: {},
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
      if (message.type() === 'error') {
        const text = message.text();
        if (/Error fetching logs: FunctionsFetchError/iu.test(text)) {
          report.warnings.push(`console: ${text.slice(0, 500)}`);
        } else if (/Failed to load resource/iu.test(text)) {
          // The paired response event records the actual URL/status. The console text alone is not actionable.
        } else {
          report.errors.push(`console: ${text.slice(0, 500)}`);
        }
      }
    });
    page.on('response', (response) => {
      if (response.status() === 404) {
        report.warnings.push(`resource 404 while_at=${page.url()} resource=${response.url()}`.slice(0, 1200));
      }
      if (response.url().includes('/functions/v1/ll-dashboard-api') && [401, 403, 500, 502, 503, 504].includes(response.status())) {
        report.errors.push(`edge ${response.status()} ${response.request().postData() || response.url()}`.slice(0, 900));
      }
    });

    await page.goto(joinUrl(baseUrl, '', `${stamp}-bootstrap`), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForRouteReady(page, ROUTES[0]);

    for (let cycle = 0; cycle < cycles; cycle += 1) {
      const probe = ROUTES[cycle % ROUTES.length];
      const startedAt = Date.now();
      try {
        await navigateInApp(page, baseUrl, probe.route, `${stamp}-${cycle + 1}`);
        await waitForRouteReady(page, probe);
        const row = await collectRouteState(page, probe, Date.now() - startedAt);
        row.cycle = cycle + 1;
        report.routes.push(row);
      } catch (error) {
        const row = await collectRouteState(page, probe, Date.now() - startedAt).catch(() => ({
          key: probe.key,
          route: probe.route,
          elapsed_ms: Date.now() - startedAt,
          ok: false,
          url: page.url(),
          problem: error?.message || String(error),
        }));
        row.cycle = cycle + 1;
        row.ok = false;
        row.problem = row.problem || error?.message || String(error);
        report.routes.push(row);
      }
    }

    report.idle_return = await checkIdleReturnAndTabSwitch(page, context, baseUrl, stamp, idleMs);

    await navigateInApp(page, baseUrl, 'home', `${stamp}-modals`);
    await waitForRouteReady(page, { key: 'home', minText: 600 });
    await checkSystemModals(page, report);
    await page.screenshot({ path: screenshotPath, fullPage: false });
  } catch (error) {
    report.errors.push(error?.message || String(error));
  } finally {
    if (browser) await browser.close();
  }

  const elapsedValues = report.routes.map((row) => row.elapsed_ms).filter((value) => Number.isFinite(value));
  report.summary = {
    failed_routes: report.routes.filter((row) => !row.ok).length,
    idle_return_ok: report.idle_return?.ok === true,
    failed_modals: Object.values(report.modal_checks || {}).filter((row) => !row.ok).length,
    max_elapsed_ms: elapsedValues.length ? Math.max(...elapsedValues) : null,
    avg_elapsed_ms: elapsedValues.length ? Math.round(elapsedValues.reduce((sum, value) => sum + value, 0) / elapsedValues.length) : null,
  };
  report.warnings = Array.from(new Set(report.warnings));
  report.ok = report.routes.length >= cycles
    && report.routes.every((row) => row.ok)
    && report.idle_return?.ok === true
    && Object.values(report.modal_checks || {}).every((row) => row.ok)
    && report.errors.length === 0
    && /^https:\/\/kylee94\.github\.io\/logistics-gate6-preview\/?/iu.test(baseUrl);

  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`full app loading stability ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson).replace(/\\/gu, '/')}`);
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
