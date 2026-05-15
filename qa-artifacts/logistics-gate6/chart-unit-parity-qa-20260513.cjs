const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const outDir = path.join(__dirname, 'chart-unit-parity-qa-20260513');
fs.mkdirSync(outDir, { recursive: true });

function run(command, args) {
  const child = spawn(command, args, { cwd: root, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return child;
}

async function waitForServer(url, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error(`Preview server not ready: ${url}`);
}

async function grantQaSession(page) {
  await page.addInitScript(() => {
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
        email: 'qa@example.com',
        app_metadata: { role: 'Admin' },
        user_metadata: {},
      },
    }));
  });
}

(async () => {
  const result = {
    url: 'http://127.0.0.1:4178/platform/iotaseoul/workspace/logistics/dashboard/home',
    checks: {},
    screenshots: {},
    pageErrors: [],
    networkBlocked: [],
  };

  const preview = run('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4178']);
  let browser;
  try {
    await waitForServer('http://127.0.0.1:4178/');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
    await grantQaSession(page);
    page.on('pageerror', (error) => result.pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (text.includes('ERR_NETWORK_ACCESS_DENIED')) result.networkBlocked.push(text);
      else result.pageErrors.push(text);
    });

    await page.goto(result.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('text=임대차 Dashboard', { timeout: 20000 });
    await page.waitForTimeout(1200);
    const bodyText = await page.locator('body').innerText();
    const requiredLegendLabels = [
      '월 임대료(RF/FO 반영)',
      '월 관리비',
      '월 임관리비(RF/FO 반영)',
      '총 연면적(만㎡)',
      '자산 수',
    ];
    result.checks.homeRentTrendLegendMatchesAppsScript = requiredLegendLabels.every((label) => bodyText.includes(label));
    result.checks.homeRentTrendAxesHaveUnits = bodyText.includes('왼쪽 Y축') && bodyText.includes('오른쪽 Y축') && bodyText.includes('X축: 월별 기간');
    result.checks.homeRentTrendNoGenericLegend = !bodyText.includes('주 지표') && !bodyText.includes('보조 지표');
    result.checks.noPageErrors = result.pageErrors.length === 0;
    result.screenshots.home = path.join(outDir, 'home-chart-parity.png');
    await page.screenshot({ path: result.screenshots.home, fullPage: true });

    result.allPass = Object.values(result.checks).every(Boolean);
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    if (!result.allPass) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    preview.kill();
    setTimeout(() => process.exit(process.exitCode || 0), 250);
  }
})();
