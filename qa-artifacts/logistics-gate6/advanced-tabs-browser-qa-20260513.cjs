let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('C:/Users/10524/Desktop/codex_realasset/Project/03_Logi_Leasing_Dashboard/node_modules/playwright'));
}

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '../..');
const outDir = path.join(__dirname, 'advanced-tabs-browser-qa-20260513');
const port = 8081;
const routeBase = `http://127.0.0.1:${port}/platform/iotaseoul/workspace/logistics`;
fs.mkdirSync(outDir, { recursive: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {
      await wait(500);
    }
  }
  throw new Error(`preview timeout on ${port}`);
}

async function countVisible(page, selector) {
  return page.locator(selector).count().catch(() => 0);
}

async function textIncludes(page, words) {
  const text = await page.locator('body').innerText();
  return words.every((word) => text.includes(word));
}

(async () => {
  const result = {
    routeBase,
    screenshots: {},
    checks: {},
    pageErrors: [],
    consoleErrors: [],
  };
  const preview = spawn('cmd.exe', ['/d', '/c', `npm run preview -- --host 127.0.0.1 --port ${port}`], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const previewLog = fs.createWriteStream(path.join(outDir, `vite-preview-${port}.log`), { flags: 'a' });
  preview.stdout.pipe(previewLog);
  preview.stderr.pipe(previewLog);
  const browser = await chromium.launch({ headless: true });
  try {
    await waitForServer();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
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
          email: 'sjlee@igisam.com',
          app_metadata: { role: 'Admin' },
          user_metadata: { name: '이시정', organization: '기획추진센터' },
        },
      }));
    });
    page.on('pageerror', (error) => result.pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (!text.includes('ERR_NETWORK_ACCESS_DENIED')) result.consoleErrors.push(text);
    });
    await page.route('**/rest/v1/iota_seoul_pilot_members*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          email: 'sjlee@igisam.com',
          staff_name: '이시정',
          name: '이시정',
          organization: '기획추진센터',
          department: '기획추진센터',
          role_code: 'manager',
        }),
      });
    });

    await page.goto(`${routeBase}/dashboard/tools`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(8000);
    result.screenshots.tools = path.join(outDir, 'analysis-tools.png');
    await page.screenshot({ path: result.screenshots.tools, fullPage: true });
    result.checks.toolsHasMultiAssetCompanySelection = await textIncludes(page, ['자산 선택', '기업 선택', '선택 계약 원장', '검토 필요 항목']);
    result.checks.toolsHasClickableAssetButtons = await countVisible(page, 'button:has-text("경산 쿠팡물류센터")') > 0;

    await page.goto(`${routeBase}/dashboard/playground`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(8000);
    result.screenshots.playground = path.join(outDir, 'data-playground.png');
    await page.screenshot({ path: result.screenshots.playground, fullPage: true });
    result.checks.playgroundHasModes = await textIncludes(page, ['Sandbox', 'Explorer', 'BI Workspace']);
    result.checks.playgroundHasFullControls = await textIncludes(page, ['행 필드', '열 필드', '값 필드', '보조 값', '필터', 'Top N', '저장된 보기']);
    result.checks.playgroundHasOriginalDimensions = await page.locator('select').filter({ hasText: '펀드' }).count().catch(() => 0) > 0;
    result.checks.playgroundHasExcelPivotSummary = await textIncludes(page, ['다중 값 요약', '피벗 결과 테이블']);
    result.checks.playgroundHasChart = await countVisible(page, 'svg') >= 1;
    await page.locator('button').filter({ hasText: '피벗 결과 크게 보기' }).first().click();
    await page.waitForTimeout(500);
    result.checks.playgroundModalOpens = await page.getByRole('dialog').isVisible().catch(() => false);

    await page.goto(`${routeBase}/dashboard/quality`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(8000);
    result.screenshots.quality = path.join(outDir, 'data-quality.png');
    await page.screenshot({ path: result.screenshots.quality, fullPage: true });
    result.checks.qualityHasCriticalSheetField = await textIncludes(page, ['critical', '시트·필드별 필터', '시트', '필드']);
    result.checks.qualityHasEditRequest = await textIncludes(page, ['데이터 무결성 검사 및 수정 요청', '수정 요청']);

    result.checks.noPageErrors = result.pageErrors.length === 0;
    result.checks.noConsoleErrors = result.consoleErrors.length === 0;
    result.allPass = Object.values(result.checks).every(Boolean);
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(outDir, 'summary.md'), [
      '# Advanced tabs browser QA - 2026-05-13',
      '',
      `- allPass: ${result.allPass}`,
      '',
      '| check | status |',
      '|---|---|',
      ...Object.entries(result.checks).map(([key, value]) => `| ${key} | ${value ? 'pass' : 'fail'} |`),
      '',
      `- tools screenshot: ${result.screenshots.tools}`,
      `- playground screenshot: ${result.screenshots.playground}`,
      `- quality screenshot: ${result.screenshots.quality}`,
      '',
    ].join('\n'));
    console.log(JSON.stringify(result, null, 2));
    if (!result.allPass) process.exitCode = 1;
  } finally {
    await browser.close();
    preview.kill('SIGKILL');
    previewLog.end();
    process.exit(process.exitCode || 0);
  }
})();
