const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'http://127.0.0.1:8081/';
const DEFAULT_ROUTE = '?p=/platform/iotaseoul/workspace/logistics/dashboard/home';

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

function centerX(box) {
  return box.x + (box.width / 2);
}

function gapBetween(topBox, bottomBox) {
  return bottomBox.y - (topBox.y + topBox.height);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `access-ui-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'access-ui-browser-smoke-latest.json');
  const sidebarScreenshot = path.join(OUT_DIR, `access-ui-sidebar-${stamp}.png`);
  const modalScreenshot = path.join(OUT_DIR, `access-ui-feature-modal-${stamp}.png`);
  const chatScreenshot = path.join(OUT_DIR, `access-ui-chat-input-${stamp}.png`);
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
    ui_email: uiEmail,
    checks: {},
    screenshots: {
      sidebar: path.relative(ROOT, sidebarScreenshot).replace(/\\/gu, '/'),
      feature_modal: path.relative(ROOT, modalScreenshot).replace(/\\/gu, '/'),
    },
    metrics: {},
    errors: [],
    warnings: [],
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
    page.on('console', (message) => {
      const text = message.text();
      if (message.type() === 'error' || /error|failed|uncaught/iu.test(text)) {
        const isKnownNonBlocking = /naver|maps|failed to load resource|401|favicon/iu.test(text);
        report[isKnownNonBlocking ? 'warnings' : 'errors'].push(`console ${message.type()}: ${text}`);
      }
    });
    page.on('response', (response) => {
      const url = response.url();
      if (response.status() === 404) {
        const isLocalAppResource = url.startsWith(new URL(targetUrl).origin);
        report[isLocalAppResource ? 'errors' : 'warnings'].push(`resource 404 ${url}`);
      }
      if (url.includes('/functions/v1/ll-dashboard-api') && response.status() >= 500) {
        report.errors.push(`edge ${response.status()} ${url}`);
      }
    });
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 50000 });
    report.final_url = page.url();
    report.root_child_count = await page.locator('#root > *').count().catch(() => 0);

    const featureButton = page.getByTestId('logistics-feature-access-button');
    const loginButton = page.getByTestId('logistics-login-history-button');
    const notificationButton = page.getByTestId('logistics-notification-button');
    const profileButton = page.getByTestId('logistics-profile-button');
    await featureButton.waitFor({ state: 'visible', timeout: 25000 });
    await loginButton.waitFor({ state: 'visible', timeout: 25000 });
    await notificationButton.waitFor({ state: 'visible', timeout: 25000 });
    await profileButton.waitFor({ state: 'visible', timeout: 25000 });

    const featureBox = await featureButton.boundingBox();
    const loginBox = await loginButton.boundingBox();
    const notificationBox = await notificationButton.boundingBox();
    const profileBox = await profileButton.boundingBox();
    const profileImageBox = await profileButton.locator('img').first().boundingBox();
    const centers = [featureBox, loginBox, notificationBox, profileBox, profileImageBox].map(centerX);
    const maxCenterDelta = Math.max(...centers) - Math.min(...centers);
    const gaps = [gapBetween(featureBox, loginBox), gapBetween(loginBox, notificationBox), gapBetween(notificationBox, profileBox)];
    const maxGapDelta = Math.max(...gaps) - Math.min(...gaps);
    report.metrics.sidebar_centers = centers;
    report.metrics.sidebar_gaps = gaps;
    report.checks.sidebar_center_aligned = maxCenterDelta <= 2;
    report.checks.sidebar_vertical_gap_aligned = maxGapDelta <= 2;
    await page.screenshot({ path: sidebarScreenshot, clip: { x: 0, y: 780, width: 90, height: 220 } });

    await featureButton.click();
    const modal = page.getByTestId('logistics-feature-access-modal');
    await modal.waitFor({ state: 'visible', timeout: 25000 });
    await modal.getByText('기능 권한 관리').waitFor({ state: 'visible', timeout: 20000 });
    const hayunRow = modal.locator('[data-testid="logistics-feature-access-user"][data-user-email="hayun.jeong@igisam.com"]').first();
    await hayunRow.waitFor({ state: 'visible', timeout: 20000 });
    const hayunImage = hayunRow.locator('img').first();
    await hayunImage.waitFor({ state: 'visible', timeout: 20000 });
    const hayunImageLoaded = await hayunImage.evaluate((img) => new Promise((resolve) => {
      if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve(true);
        return;
      }
      const timer = setTimeout(() => resolve(false), 12000);
      img.onload = () => {
        clearTimeout(timer);
        resolve(true);
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
    }));
    const hayunImageState = await hayunImage.evaluate((img) => ({
      src: img.currentSrc || img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    }));
    report.metrics.hayun_image = hayunImageState;
    report.checks.hayun_photo_loaded = hayunImageLoaded && hayunImageState.src.includes('hayun-jeong.jpg');
    report.checks.hayun_photo_has_pixels = hayunImageState.naturalWidth > 0 && hayunImageState.naturalHeight > 0;
    report.checks.hayun_locked_default = await hayunRow.getAttribute('data-locked') === 'true';

    const saveButton = page.getByTestId('logistics-feature-access-save');
    await saveButton.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForFunction((button) => button && button.getAttribute('data-loading') === 'false', await saveButton.elementHandle(), { timeout: 25000 });
    const editableRows = modal.locator('[data-testid="logistics-feature-access-user"][data-locked="false"][data-user-email]:not([data-user-email=""])');
    let editableRow = null;
    const editableCount = await editableRows.count();
    for (let index = 0; index < editableCount; index += 1) {
      const candidate = editableRows.nth(index);
      if (await candidate.isVisible().catch(() => false) && !(await candidate.isDisabled().catch(() => true))) {
        editableRow = candidate;
        break;
      }
    }
    if (!editableRow) throw new Error('No visible editable feature permission row found.');
    await editableRow.waitFor({ state: 'visible', timeout: 20000 });
    const editableEmail = await editableRow.getAttribute('data-user-email');
    const editableFeatureKey = await editableRow.getAttribute('data-feature-key');
    const beforePressed = await editableRow.getAttribute('aria-pressed');
    const selector = `[data-testid="logistics-feature-access-user"][data-feature-key="${editableFeatureKey}"][data-user-email="${editableEmail}"]`;
    report.metrics.editable_row = {
      feature_key: editableFeatureKey,
      email: editableEmail,
      before_pressed: beforePressed,
      disabled: await editableRow.isDisabled(),
      text: (await editableRow.innerText()).replace(/\s+/gu, ' ').trim().slice(0, 120),
    };
    await editableRow.click();
    await page.waitForFunction(({ rowSelector, before }) => {
      const row = document.querySelector(rowSelector);
      return row && row.getAttribute('aria-pressed') !== before;
    }, { rowSelector: selector, before: beforePressed }, { timeout: 10000 });
    const toggledPressed = await modal.locator(selector).first().getAttribute('aria-pressed');
    report.checks.permission_toggle_changes_draft = toggledPressed !== beforePressed;
    await page.waitForFunction((button) => button && button.getAttribute('data-dirty') === 'true', await saveButton.elementHandle(), { timeout: 10000 });
    report.checks.permission_save_enabled_after_change = await saveButton.isEnabled();
    await saveButton.click();
    await page.waitForFunction((button) => (
      button
      && button.getAttribute('data-loading') === 'false'
      && button.getAttribute('data-saving') === 'false'
      && button.getAttribute('data-dirty') === 'false'
    ), await saveButton.elementHandle(), { timeout: 25000 });
    await modal.getByTestId('logistics-feature-access-refresh').click();
    await page.waitForFunction(({ selector: rowSelector, expected }) => {
      const row = document.querySelector(rowSelector);
      return row && row.getAttribute('aria-pressed') === expected;
    }, { selector, expected: toggledPressed }, { timeout: 30000 });
    await page.waitForFunction((button) => button && button.getAttribute('data-loading') === 'false', await saveButton.elementHandle(), { timeout: 25000 });
    report.checks.permission_save_persists_after_refresh = true;
    const refreshedEditable = modal.locator(selector).first();
    await refreshedEditable.click();
    await saveButton.waitFor({ state: 'visible', timeout: 10000 });
    await saveButton.click();
    await page.waitForFunction((button) => (
      button
      && button.getAttribute('data-loading') === 'false'
      && button.getAttribute('data-saving') === 'false'
      && button.getAttribute('data-dirty') === 'false'
    ), await saveButton.elementHandle(), { timeout: 25000 });
    await modal.getByTestId('logistics-feature-access-refresh').click();
    await page.waitForFunction(({ selector: rowSelector, expected }) => {
      const row = document.querySelector(rowSelector);
      return row && row.getAttribute('aria-pressed') === expected;
    }, { selector, expected: beforePressed }, { timeout: 30000 });
    report.checks.permission_restore_persists_after_refresh = true;
    await modal.screenshot({ path: modalScreenshot });
    await modal.getByTestId('logistics-feature-access-close').click();

    const chatOpenButton = page.getByTestId('logistics-ai-dock-open');
    if (await chatOpenButton.count()) {
      await chatOpenButton.click();
      const input = page.getByTestId('logistics-ai-input');
      const submit = page.getByTestId('logistics-ai-submit');
      const overlay = page.getByTestId('logistics-ai-input-highlight');
      await input.waitFor({ state: 'visible', timeout: 20000 });
      await input.fill('쿠팡(주) 123556');
      const inputBox = await input.boundingBox();
      const submitBox = await submit.boundingBox();
      const overlayColor = await overlay.locator('span').first().evaluate((node) => getComputedStyle(node).color);
      report.metrics.chat_input_height = inputBox.height;
      report.metrics.chat_submit_height = submitBox.height;
      report.metrics.chat_overlay_color = overlayColor;
      report.checks.chat_input_submit_height_aligned = Math.abs(inputBox.height - submitBox.height) <= 2;
      report.checks.chat_input_text_visible_color = !/rgba?\(0,\s*0,\s*0|transparent/iu.test(overlayColor);
      await page.screenshot({ path: chatScreenshot, fullPage: false });
      report.screenshots.chat_input = path.relative(ROOT, chatScreenshot).replace(/\\/gu, '/');
    } else {
      report.checks.chat_dock_absence_does_not_block_access_ui = true;
      report.warnings.push('AI chat dock button was not rendered in this access UI auth context; chatbot quality is covered by qa:ai-chatbot.');
    }

    report.ok = Object.values(report.checks).every(Boolean) && report.errors.length === 0;
  } catch (error) {
    report.errors.push(error?.message || String(error));
    if (page) {
      try {
        report.body_excerpt = (await page.locator('body').innerText()).slice(0, 1600);
        await page.screenshot({ path: sidebarScreenshot, fullPage: false });
      } catch {
        // ignore screenshot failures
      }
    }
  } finally {
    if (browser) await browser.close();
  }
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`access ui browser smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
