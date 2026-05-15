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
const outDir = path.join(__dirname, 'latest-weekly-home-asset-browser-qa-20260514');
const baseUrl = 'http://127.0.0.1:4180';
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

(async () => {
  const result = {
    baseUrl,
    screenshots: {},
    checks: {},
    pageErrors: [],
    consoleErrors: [],
  };

  const preview = run('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4180']);
  let browser;
  try {
    await waitForServer(baseUrl);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => result.pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !/ERR_NETWORK_ACCESS_DENIED/u.test(message.text())) {
        result.consoleErrors.push(message.text());
      }
    });
    await page.addInitScript(() => {
      const member = {
        email: 'kylee@igisam.com',
        staff_name: '이강윤',
        name: '이강윤',
        organization: '기획추진센터',
        team_name: '기획추진센터',
        role_code: 'manager',
      };
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        single: async () => ({ data: member, error: null }),
        then: (resolve) => resolve({ data: [], error: null }),
      };
      window.__SUPABASE_CLIENT__ = {
        auth: {
          getSession: async () => ({ data: { session: { user: { id: 'qa-user', email: member.email }, access_token: 'local-qa-token' } }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
          signOut: async () => ({ error: null }),
        },
        from: () => chain,
        functions: { invoke: async () => ({ data: null, error: { message: 'local qa blocked' } }) },
      };
    });

    await page.goto(routeBase, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(6500);
    await page.locator('button').filter({ hasText: '주간업무보고자료 업로드' }).first().click({ timeout: 15000 });
    await page.waitForTimeout(500);
    const selects = page.locator('[role="dialog"] select');
    const yearOptions = await selects.nth(0).locator('option').count();
    const monthOptions = await selects.nth(1).locator('option').count();
    await selects.nth(0).selectOption('2027');
    await selects.nth(1).selectOption('12');
    await selects.nth(2).selectOption('4');
    const uploadText = await page.getByRole('dialog').innerText();
    result.checks.weeklyUploadFreeYearMonthWeek = yearOptions >= 8 && monthOptions === 12 && /2027-12-20 ~ 2027-12-26/u.test(uploadText);
    result.screenshots.weeklyUpload = path.join(outDir, 'weekly-upload-free-selector.png');
    await page.screenshot({ path: result.screenshots.weeklyUpload, fullPage: true });
    await page.getByRole('button', { name: '닫기' }).click();

    await page.goto(`${routeBase}/dashboard/weekly`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3500);
    const weeklyProjectBullets = await page.locator('section').filter({ hasText: '신규 투자 Projects' }).locator('li').count()
      + await page.locator('section').filter({ hasText: '관리 Projects' }).locator('li').count();
    result.checks.weeklyProjectsRenderBullets = weeklyProjectBullets > 0;
    result.screenshots.weekly = path.join(outDir, 'weekly-project-bullets.png');
    await page.screenshot({ path: result.screenshots.weekly, fullPage: true });

    await page.goto(`${routeBase}/dashboard/home`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(4500);
    const homeText = await page.locator('body').innerText();
    result.checks.dashboardReturnButtonRenamed = homeText.includes('물류센터 워크 플랫폼') && !homeText.includes('업무 로그로 돌아가기') && !homeText.includes('원본 기준');
    result.checks.homeUseLegendOnlyAllowedLabels = ['상온창고', '복합', '저온창고', '사무실'].every((label) => homeText.includes(label))
      && !homeText.includes('하역장');
    result.checks.homeTenantContractFullWidth = homeText.includes('임차인 계약') && !homeText.includes('주요 임차인 계약 요약');
    result.checks.homeMapProviderTextRemoved = !homeText.includes('지도 제공');
    result.checks.homeNoZeroPercentOnePy = !/0\.0%[\s\S]{0,18}1평/u.test(homeText);
    const doughnutSegment = page.locator('button').filter({ hasText: '상온창고' }).first();
    const segmentBox = await doughnutSegment.boundingBox();
    await doughnutSegment.hover({ force: true });
    await page.waitForTimeout(350);
    const hoverText = await page.locator('body').innerText();
    result.checks.homeDoughnutHoverShowsDetails = /근거 행|비중/u.test(hoverText);
    const hoverBox = await page.getByTestId('chart-tooltip').first().boundingBox().catch(() => null);
    result.tooltipBox = { segmentBox, hoverBox };
    result.checks.chartTooltipRenderedNearCursor = Boolean(hoverBox && segmentBox && hoverBox.x > segmentBox.x);
    if (segmentBox && hoverBox) {
      await doughnutSegment.hover({ position: { x: Math.min(140, Math.max(12, segmentBox.width - 18)), y: Math.min(14, Math.max(8, segmentBox.height / 2)) }, force: true });
      await page.waitForTimeout(160);
      const movedHoverBox = await page.getByTestId('chart-tooltip').first().boundingBox().catch(() => null);
      result.tooltipBox.movedHoverBox = movedHoverBox;
      result.checks.chartTooltipFollowsCursor = Boolean(movedHoverBox && movedHoverBox.x > hoverBox.x + 18);
    } else {
      result.checks.chartTooltipFollowsCursor = false;
    }
    await page.getByRole('button', { name: '전체 표 보기' }).click();
    await page.waitForTimeout(400);
    const contractModalText = await page.getByRole('dialog').innerText();
    result.checks.tenantContractModalHasSelectorsAndManyColumns = contractModalText.includes('자산 전체')
      && contractModalText.includes('임차인 전체')
      && contractModalText.includes('평당 임대료')
      && contractModalText.includes('source row');
    result.checks.tenantContractModalStickyColumns = await page.getByRole('dialog').locator('table').first().evaluate((table) => {
      const headerCells = Array.from(table.querySelectorAll('thead th')).slice(0, 2);
      const bodyCells = Array.from(table.querySelectorAll('tbody tr:first-child td')).slice(0, 2);
      return [...headerCells, ...bodyCells].length === 4
        && [...headerCells, ...bodyCells].every((cell) => window.getComputedStyle(cell).position === 'sticky');
    });
    await page.getByRole('button', { name: '닫기' }).click();
    result.screenshots.home = path.join(outDir, 'home-doughnut-tenant-contract.png');
    await page.screenshot({ path: result.screenshots.home, fullPage: true });

    await page.goto(`${routeBase}/dashboard/asset`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(4500);
    await page.locator('select').first().selectOption({ label: '아레나스양지물류센터' }).catch(async () => {
      await page.locator('select').first().selectOption({ index: 1 });
    });
    await page.waitForTimeout(900);
    const assetText = await page.locator('body').innerText();
    const enocIndex = assetText.indexOf('E.NOC');
    result.assetTextSample = enocIndex >= 0 ? assetText.slice(Math.max(0, enocIndex - 80), enocIndex + 220) : assetText.slice(0, 300);
    result.checks.assetENocWonUnit = /E\. ?NOC[\s\S]{0,120}[0-9,]+원/u.test(assetText);
    result.checks.assetFundNameBesideTitle = /펀드/u.test(assetText) || /블라인드|물류센터/u.test(assetText);
    result.checks.assetExpiryHasZoneLabel = /만기 스냅샷[\s\S]*·/u.test(assetText);
    result.checks.assetBuildingRegisterServerButton = assetText.includes('건축물대장 조회');
    result.screenshots.asset = path.join(outDir, 'asset-enoc-expiry.png');
    await page.screenshot({ path: result.screenshots.asset, fullPage: true });

    await page.goto(`${routeBase}/dashboard/company`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(4500);
    const companyText = await page.locator('body').innerText();
    result.checks.companyOpenDartServerButton = companyText.includes('OpenDART 새로 조회') && companyText.includes('회사별 임차 자산 지도') && companyText.includes('DART 상세 정보');
    result.checks.companyTopOneLineBlocksRemoved = !companyText.includes('계약/금액') && !companyText.includes('개 좌표');
    result.checks.dataQualityHiddenForNonAllowedCenterUser = !companyText.includes('Data Quality');
    result.screenshots.company = path.join(outDir, 'company-opendart-map.png');
    await page.screenshot({ path: result.screenshots.company, fullPage: true });

    await page.goto(routeBase, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3500);
    const mainText = await page.locator('body').innerText();
    result.checks.mainTitleAndSubtitleUpdated = mainText.includes('물류센터 워크 플랫폼')
      && mainText.includes('물류센터 관련 업무 현황 및 이슈, 데이터 기반 대시보드')
      && mainText.includes('담당 및 권한');
    const editableTask = page.locator('[id^="task-"]').filter({ has: page.getByRole('button', { name: '수정' }) }).first();
    await editableTask.hover().catch(() => {});
    await editableTask.getByRole('button', { name: '수정' }).click({ timeout: 10000, force: true });
    await page.waitForTimeout(300);
    const confirmText = await page.getByRole('dialog').innerText();
    result.checks.taskEditConfirmModal = confirmText.includes('선택한 Task를 수정하시겠습니까?') && confirmText.includes('예') && confirmText.includes('아니오');
    await page.getByRole('button', { name: '아니오' }).click();
    await editableTask.hover().catch(() => {});
    await editableTask.getByRole('button', { name: '삭제' }).click({ timeout: 10000, force: true });
    await page.waitForTimeout(300);
    const deleteConfirmText = await page.getByRole('dialog').innerText();
    result.checks.taskDeleteConfirmModal = deleteConfirmText.includes('선택한 Task를 삭제하시겠습니까?') && deleteConfirmText.includes('예') && deleteConfirmText.includes('아니오');
    await page.getByRole('button', { name: '아니오' }).click();
    await editableTask.hover().catch(() => {});
    await editableTask.getByRole('button', { name: '완료' }).click({ timeout: 10000, force: true });
    await page.waitForTimeout(300);
    const completeConfirmText = await page.getByRole('dialog').innerText();
    result.checks.taskCompleteConfirmModal = completeConfirmText.includes('선택한 Task를 완료된 상태로 변경하시겠습니까?') && completeConfirmText.includes('예') && completeConfirmText.includes('아니오');
    await page.getByRole('button', { name: '아니오' }).click();

    result.checks.noPageErrors = result.pageErrors.length === 0;
    result.checks.noConsoleErrors = result.consoleErrors.length === 0;
    result.allPass = Object.values(result.checks).every(Boolean);
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
    console.log(JSON.stringify(result, null, 2));
    if (!result.allPass) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    preview.kill();
    setTimeout(() => process.exit(process.exitCode || 0), 250);
  }
})();
