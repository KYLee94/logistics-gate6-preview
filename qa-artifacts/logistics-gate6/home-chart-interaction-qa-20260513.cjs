const fs = require('fs');
const path = require('path');
const Module = require('module');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '../..');
const outDir = path.join(__dirname, 'home-chart-interaction-qa-20260513');
const baseUrl = process.env.LOGISTICS_LOCAL_URL || 'http://127.0.0.1:4182';
const route = `${baseUrl}/platform/iotaseoul/workspace/logistics/dashboard/home`;

const bundledModules = process.env.CODEX_NODE_MODULES
  || 'C:\\Users\\10524\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules';
const bundledPnpmModules = path.join(bundledModules, '.pnpm', 'node_modules');
const bundledPlaywrightModules = path.join(bundledModules, '.pnpm', 'playwright@1.59.1', 'node_modules');
process.env.NODE_PATH = [bundledModules, bundledPnpmModules, bundledPlaywrightModules, process.env.NODE_PATH]
  .filter(Boolean)
  .join(path.delimiter);
Module._initPaths();

const { chromium } = require('playwright');

fs.mkdirSync(outDir, { recursive: true });

function runPreview() {
  return spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4182'], {
    cwd: root,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForServer(url, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error(`Preview server not ready: ${url}`);
}

async function capture(page, name, result) {
  const shot = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  result.screenshots[name] = shot;
}

async function setQaAuth(context) {
  await context.addInitScript(() => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem('iota_last_activity', Date.now().toString());
    localStorage.setItem('sb-iota-auth-token', JSON.stringify({
      access_token: 'qa-token',
      refresh_token: 'qa-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: expiresAt,
      user: {
        id: 'qa-user',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'sjlee@igisam.com',
        app_metadata: { role: 'Admin' },
        user_metadata: { name: 'QA Admin', staff_name: 'QA Admin', organization: 'Planning Center' },
      },
    }));
  });
  await context.route('**/rest/v1/iota_seoul_pilot_members*', async (routeHandler) => {
    await routeHandler.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        email: 'sjlee@igisam.com',
        staff_name: 'QA Admin',
        name: 'QA Admin',
        organization: 'Planning Center',
        department: 'Planning Center',
      }),
    });
  });
}

async function dispatchMove(page, locator, point) {
  await locator.dispatchEvent('mousemove', {
    clientX: Math.round(point.x),
    clientY: Math.round(point.y),
  });
}

async function firstVisibleTooltip(page) {
  const tooltip = page.locator('[data-testid="chart-tooltip"]').first();
  await tooltip.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  if (!(await tooltip.isVisible().catch(() => false))) return null;
  return tooltip;
}

async function checkDoughnutTooltip(page, result) {
  const segments = page.locator('[data-segment-label]');
  const count = await segments.count().catch(() => 0);
  result.checks.doughnutSegmentsExist = count >= 2;
  result.evidence.doughnutSegmentCount = count;
  if (count < 2) return;

  const first = segments.nth(0);
  const second = segments.nth(1);
  const firstLabel = await first.getAttribute('data-segment-label');
  const secondLabel = await second.getAttribute('data-segment-label');
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();

  result.evidence.firstDoughnutLabel = firstLabel;
  result.evidence.secondDoughnutLabel = secondLabel;
  result.checks.doughnutSegmentsHaveLabels = Boolean(firstLabel && secondLabel && firstLabel !== secondLabel);
  if (!firstBox || !secondBox) return;

  const firstPoint = { x: firstBox.x + firstBox.width / 2, y: firstBox.y + firstBox.height / 2 };
  await dispatchMove(page, first, firstPoint);
  let tooltip = await firstVisibleTooltip(page);
  const firstTooltipText = tooltip ? await tooltip.innerText() : '';
  const firstTooltipBox = tooltip ? await tooltip.boundingBox() : null;

  const secondPoint = { x: secondBox.x + secondBox.width / 2, y: secondBox.y + secondBox.height / 2 };
  await dispatchMove(page, second, secondPoint);
  tooltip = await firstVisibleTooltip(page);
  const secondTooltipText = tooltip ? await tooltip.innerText() : '';
  const secondTooltipBox = tooltip ? await tooltip.boundingBox() : null;

  result.evidence.firstDoughnutTooltip = firstTooltipText;
  result.evidence.secondDoughnutTooltip = secondTooltipText;
  result.evidence.firstTooltipBox = firstTooltipBox;
  result.evidence.secondTooltipBox = secondTooltipBox;

  result.checks.doughnutTooltipOneSegmentOnly = Boolean(
    firstTooltipText.includes(firstLabel)
    && !firstTooltipText.includes(secondLabel)
    && secondTooltipText.includes(secondLabel)
    && !secondTooltipText.includes(firstLabel),
  );
  result.checks.doughnutTooltipFollowsCursor = Boolean(
    firstTooltipBox
    && secondTooltipBox
    && Math.abs(firstTooltipBox.x - secondTooltipBox.x) > 5,
  );
  result.checks.doughnutTooltipRightOfCursor = Boolean(
    firstTooltipBox
    && firstTooltipBox.x >= Math.min(firstPoint.x + 8, page.viewportSize().width - firstTooltipBox.width - 12),
  );

  await first.dispatchEvent('click', {
    clientX: Math.round(firstPoint.x),
    clientY: Math.round(firstPoint.y),
  });
  await page.waitForTimeout(350);
  result.checks.doughnutSegmentClickModal = await page.getByRole('dialog').isVisible().catch(() => false);
  await capture(page, 'doughnut-segment-click-modal', result);
  if (await page.getByRole('dialog').isVisible().catch(() => false)) {
    await page.getByRole('dialog').getByRole('button').last().click().catch(() => {});
  }
  await page.mouse.move(8, 8).catch(() => {});
  await page.locator('[data-testid="chart-tooltip"]').first().waitFor({ state: 'hidden', timeout: 1500 }).catch(() => {});
}

async function checkTrendTooltip(page, result) {
  const hoverRects = page.locator('svg[role="img"] rect[fill="transparent"]');
  const count = await hoverRects.count().catch(() => 0);
  result.evidence.trendHoverRectCount = count;
  result.checks.trendHoverTargetsExist = count > 0;
  if (!count) return;

  const target = hoverRects.nth(Math.min(1, count - 1));
  await target.scrollIntoViewIfNeeded().catch(() => {});
  const box = await target.boundingBox();
  if (!box) return;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(point.x, point.y);
  const tooltip = await firstVisibleTooltip(page);
  const text = tooltip ? await tooltip.innerText() : '';
  const tooltipBox = tooltip ? await tooltip.boundingBox() : null;

  result.evidence.trendTooltip = text;
  result.evidence.trendTooltipBox = tooltipBox;
  result.checks.trendTooltipVisible = Boolean(text && tooltipBox);
  result.checks.trendTooltipRightOfCursor = Boolean(
    tooltipBox
    && tooltipBox.x >= Math.min(point.x + 8, page.viewportSize().width - tooltipBox.width - 12),
  );
}

async function checkChartAxisText(page, result) {
  const axisTexts = await page.locator('svg[role="img"] text').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return {
      text: node.textContent || '',
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y,
    };
  }));
  const visibleAxisTexts = axisTexts.filter((item) => item.text.trim() && item.width > 0 && item.height > 0);
  const brokenAxisTexts = visibleAxisTexts.filter((item) => item.x < -2 || item.y < -2);
  result.evidence.visibleAxisTextCount = visibleAxisTexts.length;
  result.evidence.brokenAxisTexts = brokenAxisTexts.slice(0, 10);
  result.checks.chartAxisTextVisible = visibleAxisTexts.length >= 12;
  result.checks.chartAxisTextNotClipped = brokenAxisTexts.length === 0;
}

(async () => {
  const result = {
    generated_at: new Date().toISOString(),
    baseUrl,
    route,
    checks: {},
    evidence: {},
    screenshots: {},
    pageErrors: [],
    consoleErrors: [],
  };

  const preview = runPreview();
  preview.stdout.on('data', (chunk) => process.stdout.write(chunk));
  preview.stderr.on('data', (chunk) => process.stderr.write(chunk));

  let browser;
  try {
    await waitForServer(baseUrl);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1350 }, deviceScaleFactor: 1 });
    await setQaAuth(context);
    const page = await context.newPage();
    page.on('pageerror', (error) => result.pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (!text.includes('ERR_NETWORK_ACCESS_DENIED')) result.consoleErrors.push(text);
    });

    await page.goto(route, { waitUntil: 'networkidle', timeout: 60000 });
    await page.locator('body').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(3500);
    await capture(page, 'home-full', result);

    const bodyText = await page.locator('body').innerText();
    result.checks.homeLoaded = !bodyText.includes('IFPDP IOTA Seoul') && bodyText.length > 1000;

    await checkDoughnutTooltip(page, result);
    await page.goto(route, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);
    await checkTrendTooltip(page, result);
    await checkChartAxisText(page, result);

    result.checks.noPageErrors = result.pageErrors.length === 0;
    result.checks.noConsoleErrors = result.consoleErrors.length === 0;
    result.allPass = Object.values(result.checks).every(Boolean);

    fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(result, null, 2));
    if (!result.allPass) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    preview.kill();
    setTimeout(() => process.exit(process.exitCode || 0), 250);
  }
})();
