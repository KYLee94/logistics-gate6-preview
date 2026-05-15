let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('C:/Users/10524/Desktop/codex_realasset/Project/03_Logi_Leasing_Dashboard/node_modules/playwright'));
}
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const outDir = path.join(__dirname, 'dashboard-parity-tabs-qa-20260513');
const baseUrl = 'http://127.0.0.1:4178';
const routeBase = `${baseUrl}/platform/iotaseoul/workspace/logistics`;

fs.mkdirSync(outDir, { recursive: true });

function run(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
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
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error(`Preview server not ready: ${url}`);
}

async function visibleText(page, text) {
  return page.getByText(text, { exact: false }).first().isVisible().catch(() => false);
}

async function countVisible(page, selector) {
  return page.locator(selector).count().catch(() => 0);
}

async function clickFirstAndCapture(page, locator, name, result) {
  const target = locator.first();
  const count = await locator.count().catch(() => 0);
  result.modalClicks[name] = { found: count > 0 };
  if (!count) return;
  await target.click();
  await page.waitForTimeout(500);
  result.modalClicks[name].modalVisible = await page.getByRole('dialog').isVisible().catch(() => false);
  const shot = path.join(outDir, `${name}-modal.png`);
  await page.screenshot({ path: shot, fullPage: true });
  result.screenshots[`${name}Modal`] = shot;
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('button').filter({ hasText: '닫기' }).first().click().catch(() => {});
}

(async () => {
  const result = {
    baseUrl,
    screenshots: {},
    checks: {},
    modalClicks: {},
    pageErrors: [],
    consoleErrors: [],
    networkBlocked: [],
  };

  const preview = run('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4178']);
  let browser;
  try {
    await waitForServer(baseUrl);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1300 } });
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
          user_metadata: { name: 'QA Admin', organization: 'IOTA 공통' },
        },
      }));
    });
    page.on('pageerror', (error) => result.pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (text.includes('ERR_NETWORK_ACCESS_DENIED')) result.networkBlocked.push(text);
      else result.consoleErrors.push(text);
    });

    await page.goto(routeBase, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(6500);
    result.screenshots.main = path.join(outDir, 'main-worklog.png');
    await page.screenshot({ path: result.screenshots.main, fullPage: true });
    const mainText = await page.locator('body').innerText();
    result.checks.mainHasWorkScopes = ['개인 업무', '팀 업무', '섹터 업무'].every((text) => mainText.includes(text));
    result.checks.mainNoPermissionGreenBlocks = !mainText.includes('담당 읽기') && !mainText.includes('기타 자산');
    result.checks.mainNoMoreAssetButton = !mainText.includes('개 더 보기');

    await page.goto(`${routeBase}/dashboard/home`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(6500);
    result.screenshots.home = path.join(outDir, 'home.png');
    await page.screenshot({ path: result.screenshots.home, fullPage: true });
    const homeText = await page.locator('body').innerText();
    result.checks.homeHasColdWarmDoughnut = homeText.includes('용도별 비율') && homeText.includes('상온') && homeText.includes('저온');
    result.checks.homeNoRawColdWarmCodeLegend = !homeText.includes('Y=') && !homeText.includes('N=');
    result.checks.homeHasCostPortionDoughnut = homeText.includes('월 임관리비 비중') && homeText.includes('자산별') && homeText.includes('임차인별');
    result.checks.homeHasColdRatioAndENocColumns = homeText.includes('저온창고 비율') && homeText.includes('E. NOC');
    result.checks.homeRemovedPortfolioSnapshot = !homeText.includes('포트폴리오 스냅샷');
    result.checks.homeHasMapTable = homeText.includes('자산명') && homeText.includes('주소(시군구)') && homeText.includes('연면적');
    result.checks.homeRemovedCoordinateColumn = !homeText.includes('좌표 표');
    result.checks.homeHasContractRentTrend = homeText.includes('계약 이력 기준 임대료 추이');
    result.checks.homeRemovedDuplicateMonthlyCostTrend = !homeText.includes('월 임관리비 추이');
    result.checks.homeHasTopSortingToggles = homeText.includes('Top 자산') && homeText.includes('Top 임차인') && homeText.includes('임관리비') && homeText.includes('면적');
    result.checks.homeHasRegionMetricToggle = homeText.includes('권역별 노출도') && homeText.includes('연면적');
    result.checks.homeRemovedLegacyTopTenantCard = !homeText.includes('상위 임차인');
    result.checks.homeHasExpiryAreaAxis = homeText.includes('만기 집중도') && homeText.includes('만기 임대면적');
    await clickFirstAndCapture(page, page.locator('button').filter({ hasText: '원본 표 보기' }), 'home-source-table', result);

    await page.goto(`${routeBase}/dashboard/sector`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(6500);
    result.screenshots.sector = path.join(outDir, 'sector.png');
    await page.screenshot({ path: result.screenshots.sector, fullPage: true });
    const sectorText = await page.locator('body').innerText();
    result.checks.sectorRouteRendersHomeModule = sectorText.includes('계약 이력 기준 임대료 추이') && sectorText.includes('권역별 노출도');
    result.checks.sectorRouteNoStandaloneMonthlyCostTrend = !sectorText.includes('월 임관리비 추이');
    result.checks.sectorHasSortingToggles = sectorText.includes('임관리비') && sectorText.includes('면적');
    result.checks.sectorHasSvgCharts = await countVisible(page, 'svg') >= 3;
    const trendSvg = page.locator('svg[aria-label*="월 임대료"]').first();
    const trendPoint = trendSvg.locator('rect[fill="transparent"]').nth(1);
    if (await trendPoint.count().catch(() => 0)) {
      await trendPoint.hover({ timeout: 5000 });
      await page.waitForTimeout(250);
      result.screenshots.sectorHover = path.join(outDir, 'sector-hover-tooltip.png');
      await page.screenshot({ path: result.screenshots.sectorHover, fullPage: true });
      result.checks.sectorImmediateHoverTooltip = await visibleText(page, '월 임대료') || await visibleText(page, '월 임관리비');
    } else {
      result.checks.sectorImmediateHoverTooltip = false;
    }
    await clickFirstAndCapture(page, page.locator('button').filter({ hasText: '원본 표 보기' }), 'sector-source-table', result);

    await page.goto(`${routeBase}/dashboard/tools`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(6500);
    result.screenshots.tools = path.join(outDir, 'analysis-tools.png');
    await page.screenshot({ path: result.screenshots.tools, fullPage: true });
    const toolsText = await page.locator('body').innerText();
    result.checks.toolsHasFilters = toolsText.includes('자산') && toolsText.includes('기업') && toolsText.includes('계약 원장');
    result.checks.toolsHasChartAndPopup = await countVisible(page, 'svg') >= 1;
    await clickFirstAndCapture(page, page.locator('button').filter({ hasText: '원본 표 보기' }), 'tools-source-table', result);

    await page.goto(`${routeBase}/dashboard/playground`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(6500);
    result.screenshots.playground = path.join(outDir, 'data-playground.png');
    await page.screenshot({ path: result.screenshots.playground, fullPage: true });
    const playgroundText = await page.locator('body').innerText();
    result.checks.playgroundHasFilters = playgroundText.includes('차원') && playgroundText.includes('지표') && playgroundText.includes('Top N');
    result.checks.playgroundHasChart = await countVisible(page, 'svg') >= 1;
    await clickFirstAndCapture(page, page.locator('button').filter({ hasText: '원본 표 보기' }), 'playground-source-table', result);

    await page.goto(`${routeBase}/dashboard/quality`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(6500);
    result.screenshots.quality = path.join(outDir, 'data-quality.png');
    await page.screenshot({ path: result.screenshots.quality, fullPage: true });
    const qualityText = await page.locator('body').innerText();
    result.checks.qualityHasIntegrityAndEdit = qualityText.includes('데이터 무결성 검사') && qualityText.includes('수정');
    result.checks.qualityHasPermissionBasis = qualityText.includes('권한 기준') || qualityText.includes('담당자별 권한');
    await clickFirstAndCapture(page, page.locator('button').filter({ hasText: '권한 기준' }), 'quality-permission-modal', result);

    result.checks.noPageErrors = result.pageErrors.length === 0;
    result.checks.noConsoleErrors = result.consoleErrors.length === 0;
    result.allPass = Object.values(result.checks).every(Boolean)
      && Object.values(result.modalClicks).every((item) => item.found && item.modalVisible);

    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    if (!result.allPass) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    preview.kill();
    setTimeout(() => process.exit(process.exitCode || 0), 250);
  }
})();
