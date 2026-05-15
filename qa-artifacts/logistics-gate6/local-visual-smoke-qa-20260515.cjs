const fs = require('fs');
const path = require('path');
const Module = require('module');

const bundledModules = process.env.CODEX_NODE_MODULES
  || 'C:\\Users\\10524\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules';
const bundledPnpmModules = path.join(bundledModules, '.pnpm', 'node_modules');
const bundledPlaywrightModules = path.join(bundledModules, '.pnpm', 'playwright@1.59.1', 'node_modules');
process.env.NODE_PATH = [bundledModules, bundledPnpmModules, bundledPlaywrightModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
Module._initPaths();

const { chromium } = require('playwright');

const baseUrl = process.env.LOGISTICS_LOCAL_URL || 'http://127.0.0.1:5173';
const outDir = path.join(process.cwd(), 'qa-artifacts', 'logistics-gate6', 'local-visual-smoke-qa-20260515');
fs.mkdirSync(outDir, { recursive: true });

const routes = [
  {
    id: 'workspace-main',
    path: '/platform/iotaseoul/workspace/logistics',
    requiredText: ['물류센터 워크 플랫폼'],
  },
  {
    id: 'home',
    path: '/platform/iotaseoul/workspace/logistics/dashboard/home',
    requiredText: ['용도별 비율', '계약 이력 기준 임대료 추이', '임차인 계약'],
  },
  {
    id: 'company',
    path: '/platform/iotaseoul/workspace/logistics/dashboard/company',
    requiredText: ['임차 자산 현황', '회사별 임차 자산 지도', 'DART 상세 정보'],
  },
  {
    id: 'quality',
    path: '/platform/iotaseoul/workspace/logistics/dashboard/quality',
    requiredText: ['Data Quality', 'Excel 한 시트 수정 파일'],
  },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
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
        user_metadata: { name: '이시정', staff_name: '이시정', organization: '기획추진센터' },
      },
    }));
  });
  await context.route('**/rest/v1/iota_seoul_pilot_members*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        email: 'sjlee@igisam.com',
        staff_name: '이시정',
        name: '이시정',
        organization: '기획추진센터',
        department: '기획추진센터',
      }),
    });
  });
  const results = [];
  try {
    for (const route of routes) {
      const page = await context.newPage();
      const consoleMessages = [];
      page.on('console', (message) => {
        if (['error', 'warning'].includes(message.type())) consoleMessages.push({ type: message.type(), text: message.text() });
      });
      page.on('pageerror', (error) => consoleMessages.push({ type: 'pageerror', text: error.message }));
      const url = `${baseUrl}${route.path}`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.locator('body').waitFor({ state: 'visible', timeout: 10000 });
      const bodyText = await page.locator('body').innerText({ timeout: 10000 });
      const authRequired = bodyText.includes('이지스 이메일을 입력해주세요') || bodyText.includes('IFPDP IOTA Seoul');
      const missingText = route.requiredText.filter((text) => !bodyText.includes(text));
      const screenshot = path.join(outDir, `${route.id}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });

      let doughnutTooltip = null;
      if (route.id === 'home') {
        const segmentCount = await page.locator('[data-segment-label]').count();
        if (segmentCount > 0) {
          const firstSegment = page.locator('[data-segment-label]').first();
          const segmentBox = await firstSegment.boundingBox();
          if (segmentBox) {
            await firstSegment.dispatchEvent('mousemove', {
              clientX: Math.round(segmentBox.x + segmentBox.width / 2),
              clientY: Math.round(segmentBox.y + segmentBox.height / 2),
            });
            const tooltip = page.locator('[data-testid="chart-tooltip"]').first();
            await tooltip.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
            if (await tooltip.isVisible().catch(() => false)) {
              doughnutTooltip = await tooltip.innerText();
            }
          }
        }
      }

      const blockingConsoleMessages = consoleMessages.filter((item) => (
        item.type !== 'warning'
        && !item.text.includes('ERR_NETWORK_ACCESS_DENIED')
      ));
      const doughnutTooltipOk = route.id !== 'home' || Boolean(doughnutTooltip);
      results.push({
        id: route.id,
        url,
        screenshot,
        missingText,
        consoleMessages,
        blockingConsoleMessages,
        doughnutTooltip,
        externalPending: authRequired,
        status: authRequired ? 'external_pending_auth_session_required' : (missingText.length || !doughnutTooltipOk || blockingConsoleMessages.length ? 'failed' : 'passed'),
        pass: !authRequired && missingText.length === 0 && doughnutTooltipOk && blockingConsoleMessages.length === 0,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  const report = {
    generated_at: new Date().toISOString(),
    baseUrl,
    allPass: results.every((item) => item.pass),
    results,
  };
  fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (!report.allPass && process.env.CI_STRICT_QA === '1') process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
