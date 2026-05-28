const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const DEFAULT_ROUTE = '?p=platform/iotaseoul/workspace/logistics';

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
  const outJson = path.join(OUT_DIR, `work-platform-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'work-platform-browser-smoke-latest.json');
  const screenshotPath = path.join(OUT_DIR, `work-platform-browser-smoke-${stamp}.png`);
  const homeExpiryScreenshotPath = path.join(OUT_DIR, `work-platform-browser-smoke-${stamp}-home-expiry.png`);
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const targetUrl = joinUrl(baseUrl, argsValue('route', DEFAULT_ROUTE));
  const homeUrl = joinUrl(baseUrl, '?p=platform/iotaseoul/workspace/logistics/dashboard/home');
  const archiveUrl = joinUrl(baseUrl, 'platform/iotaseoul/workspace/archive?workspace=logistics');
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
    home_url: homeUrl,
    archive_url: archiveUrl,
    auth_source: auth.source,
    ui_email: uiEmail,
    checks: {},
    screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
    home_expiry_screenshot: path.relative(ROOT, homeExpiryScreenshotPath).replace(/\\/gu, '/'),
    errors: [],
  };
  let browser;
  let page;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
    await context.addInitScript(({ email, session }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { email: uiEmail, session: browserSession });
    page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    page.on('response', (response) => {
      if (response.url().includes('/functions/v1/ll-dashboard-api') && response.status() >= 500) {
        report.errors.push(`edge ${response.status()} ${response.url()}`);
      }
    });

    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.locator('#task-management').waitFor({ state: 'visible', timeout: 30000 });
    const taskHeaderText = await page.locator('#task-management').innerText();
    report.task_header_text = taskHeaderText;
    report.checks.current_week_is_may_week_5 = /26년\s*5월\s*5주/u.test(taskHeaderText);
    report.checks.current_week_is_not_may_week_4 = !/26년\s*5월\s*4주/u.test(taskHeaderText);

    const writeButton = page.getByRole('button', { name: /글\s*작성하기/u }).first();
    await writeButton.waitFor({ state: 'visible', timeout: 30000 });
    await writeButton.click();
    await page.getByRole('button', { name: /^접기$/u }).first().waitFor({ state: 'visible', timeout: 20000 });
    const headerMetrics = await page.evaluate(() => {
      const collapseButton = [...document.querySelectorAll('button')]
        .find((button) => button.textContent.trim() === '접기');
      const header = collapseButton?.closest('[class*="border-b"]');
      const dateLabel = header
        ? [...header.querySelectorAll('label')].find((label) => /년\s*\d+월\s*\d+일/u.test(label.textContent || ''))
        : null;
      const buttonBox = collapseButton?.getBoundingClientRect();
      const dateBox = dateLabel?.getBoundingClientRect();
      return {
        hasHeader: Boolean(header),
        hasDateLabel: Boolean(dateLabel),
        dateText: dateLabel?.textContent?.trim() || '',
        collapseText: collapseButton?.textContent?.trim() || '',
        sameLine: Boolean(buttonBox && dateBox && Math.abs(buttonBox.top - dateBox.top) < 8),
        dateAndCollapseVisible: Boolean(
          buttonBox
          && dateBox
          && dateBox.left >= 0
          && buttonBox.right <= window.innerWidth - 8
          && dateBox.right < buttonBox.left,
        ),
        collapseButtonWidth: buttonBox?.width || 0,
        dateLabelWidth: dateBox?.width || 0,
      };
    });
    report.header_metrics = headerMetrics;
    report.checks.write_header_date_and_collapse_same_line = headerMetrics.hasHeader
      && headerMetrics.hasDateLabel
      && headerMetrics.sameLine
      && headerMetrics.dateAndCollapseVisible
      && headerMetrics.collapseButtonWidth >= 48;

    const dropdownToggles = page.getByTestId('log-write-dropdown-toggle');
    const dropdownCount = await dropdownToggles.count();
    const dropdownResults = [];
    for (let index = 0; index < Math.min(dropdownCount, 5); index += 1) {
      const toggle = dropdownToggles.nth(index);
      await toggle.scrollIntoViewIfNeeded();
      const toggleText = (await toggle.innerText()).trim();
      await toggle.click();
      const menu = page.getByTestId('log-write-dropdown-menu');
      await menu.waitFor({ state: 'visible', timeout: 5000 });
      const optionButtons = menu.locator('button');
      const optionCount = await optionButtons.count();
      if (optionCount > 0) {
        await optionButtons.nth(Math.min(1, optionCount - 1)).click();
        await menu.waitFor({ state: 'detached', timeout: 5000 }).catch(() => null);
      }
      dropdownResults.push({ index, toggle_text: toggleText, option_count: optionCount });
    }
    report.board_dropdown_results = dropdownResults;
    report.checks.board_dropdowns_open_and_select = dropdownResults.length >= 5
      && dropdownResults.every((item) => item.option_count > 0);

    const visibilityButton = page.getByRole('button', { name: /^열람권한$/u }).first();
    await visibilityButton.click();
    await page.getByText('열람 권한 설정').waitFor({ state: 'visible', timeout: 5000 });
    const visibilityModalText = await page.locator('body').innerText();
    report.checks.board_visibility_modal_opens = visibilityModalText.includes('그룹 선택')
      && visibilityModalText.includes('특정 인원 추가');
    await page.getByRole('button', { name: /^확인$/u }).last().click();

    await page.screenshot({ path: screenshotPath, fullPage: false });

    await page.goto(homeUrl, { waitUntil: 'networkidle', timeout: 60000 });
    const expiryTitle = page.getByText('만기 집중도').last();
    await expiryTitle.waitFor({ state: 'visible', timeout: 30000 });
    const expirySection = expiryTitle.locator('xpath=ancestor::section[1]');
    const expirySectionText = await expirySection.innerText();
    report.home_expiry_section_text_excerpt = expirySectionText.slice(0, 1200);
    report.checks.home_expiry_axis_labels = expirySectionText.includes('LHS 만기 임대면적(평)')
      && expirySectionText.includes('RHS 만기 임차인 수');
    const rightCountAxis = await expirySection.locator('svg').evaluate((svg) => {
      const labels = [...svg.querySelectorAll('text')]
        .map((node) => ({
          text: (node.textContent || '').trim(),
          y: Number(node.getAttribute('y')),
        }))
        .filter((item) => /^\d+개$/u.test(item.text));
      const tickYs = labels.map((item) => item.y - 5).filter((value) => Number.isFinite(value));
      const countCircleYs = [...svg.querySelectorAll('circle')]
        .filter((node) => String(node.getAttribute('fill') || '').toLowerCase() === '#ffd166')
        .map((node) => Number(node.getAttribute('cy')))
        .filter((value) => Number.isFinite(value));
      return {
        labels: labels.map((item) => item.text),
        zero_count: labels.filter((item) => item.text === '0개').length,
        unique_count: new Set(labels.map((item) => item.text)).size,
        count_circle_count: countCircleYs.length,
        count_circles_align_to_ticks: countCircleYs.length > 0 && countCircleYs.every((cy) => (
          tickYs.some((tickY) => Math.abs(tickY - cy) <= 1.5)
        )),
      };
    });
    report.home_expiry_right_count_axis = rightCountAxis;
    report.checks.home_expiry_right_count_axis_integer_unique = rightCountAxis.labels.length >= 2
      && rightCountAxis.unique_count === rightCountAxis.labels.length
      && rightCountAxis.zero_count === 1;
    report.checks.home_expiry_count_points_align_to_integer_axis = rightCountAxis.count_circles_align_to_ticks;
    await expirySection.screenshot({ path: homeExpiryScreenshotPath });
    const hoverTargets = expirySection.locator('rect.cursor-pointer');
    const hoverTargetCount = await hoverTargets.count();
    report.home_expiry_hover_target_count = hoverTargetCount;
    if (hoverTargetCount > 0) {
      await hoverTargets.nth(Math.floor(hoverTargetCount / 2)).hover({ force: true });
    }
    const tooltip = page.getByTestId('chart-tooltip');
    await tooltip.waitFor({ state: 'visible', timeout: 5000 });
    const tooltipText = await tooltip.innerText();
    report.home_expiry_tooltip_text = tooltipText;
    report.checks.home_expiry_tooltip_has_area_count_and_details = tooltipText.includes('만기 임대면적')
      && tooltipText.includes('만기 임차인 수')
      && tooltipText.includes('만기 자산 / 임차인')
      && tooltipText.includes('/')
      && tooltipText.includes('평');

    await page.goto(archiveUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.getByText(/Task/u).first().waitFor({ state: 'visible', timeout: 30000 });
    const mayWeek5SidebarButtons = await page.locator('button').evaluateAll((buttons) => (
      buttons
        .map((button) => button.innerText || '')
        .filter((text) => /26년\s*5월\s*5주/u.test(text))
    ));
    report.archive_may_week_5_sidebar_buttons = mayWeek5SidebarButtons;
    report.checks.archive_may_week_5_not_duplicated = mayWeek5SidebarButtons.length <= 1;

    report.ok = Object.values(report.checks).every(Boolean) && report.errors.length === 0;
  } catch (error) {
    report.errors.push(error?.message || String(error));
    if (page) {
      try {
        report.body_excerpt = (await page.locator('body').innerText()).slice(0, 1600);
        await page.screenshot({ path: screenshotPath, fullPage: false });
      } catch {
        // ignore screenshot failures after navigation errors
      }
    }
  } finally {
    if (browser) await browser.close();
  }
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`work-platform browser smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
