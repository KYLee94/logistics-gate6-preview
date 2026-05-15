const fs = require('fs');
const path = require('path');
const Module = require('module');
const { spawn } = require('child_process');

const bundledModules = process.env.CODEX_NODE_MODULES
  || 'C:\\Users\\10524\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules';
const bundledPnpmModules = path.join(bundledModules, '.pnpm', 'node_modules');
const bundledPlaywrightModules = path.join(bundledModules, '.pnpm', 'playwright@1.59.1', 'node_modules');
process.env.NODE_PATH = [bundledModules, bundledPnpmModules, bundledPlaywrightModules, process.env.NODE_PATH]
  .filter(Boolean)
  .join(path.delimiter);
Module._initPaths();

const { chromium } = require('playwright');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForPreview(port) {
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

async function setQaAuth(page) {
  await page.addInitScript(() => {
    const member = {
      email: 'sjlee@igisam.com',
      staff_name: '이시정',
      name: '이시정',
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
}

async function capture(page, outDir, name, result) {
  const shot = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  result.screenshots[name] = shot;
}

async function main() {
  const repoRoot = path.resolve(__dirname, '../..');
  const outDir = path.join(__dirname, 'worklog-main-current-qa-20260513');
  fs.mkdirSync(outDir, { recursive: true });
  const port = 8120;
  const preview = spawn('cmd.exe', ['/d', '/c', `npm run preview -- --host 127.0.0.1 --port ${port}`], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const previewLog = fs.createWriteStream(path.join(outDir, `vite-preview-${port}.log`), { flags: 'a' });
  preview.stdout.pipe(previewLog);
  preview.stderr.pipe(previewLog);

  let browser;
  try {
    await waitForPreview(port);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1300 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push({ message: error.message, stack: error.stack || '' }));
    await setQaAuth(page);

    const url = `http://127.0.0.1:${port}/platform/iotaseoul/workspace/logistics`;
    const result = { url, screenshots: {}, checks: {}, evidence: {}, pageErrors };
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await wait(1800);
    await capture(page, outDir, 'main', result);
    const bodyText = await page.locator('body').innerText();
    const boardAssetSelect = page.locator('select').first();
    const boardAssetSelectInfo = await boardAssetSelect.evaluate((select) => {
      const rect = select.getBoundingClientRect();
      const options = Array.from(select.options).map((option) => option.textContent.trim()).filter(Boolean);
      return { width: Math.round(rect.width), options };
    }).catch(() => ({ width: 0, options: [] }));

    await page.getByRole('button', { name: '팀 업무' }).click();
    await wait(250);
    const teamText = await page.locator('body').innerText();
    await capture(page, outDir, 'team-scope', result);

    await page.getByRole('button', { name: '섹터 업무' }).click();
    await wait(250);
    const sectorText = await page.locator('body').innerText();
    await capture(page, outDir, 'sector-scope', result);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await wait(1000);
    const firstTask = page.locator('div[id^="task-"]').filter({ hasText: 'Next Action' }).first();
    const taskConfirmEvidence = {};
    async function checkTaskAction(label, expectedMessage, confirm = false) {
      await firstTask.hover().catch(() => {});
      const button = firstTask.locator('button').filter({ hasText: label }).first();
      const buttonCount = await button.count().catch(() => 0);
      if (!buttonCount) return false;
      await button.click({ force: true });
      await wait(250);
      const dialog = page.getByRole('dialog');
      const dialogVisible = await dialog.isVisible().catch(() => false);
      if (!dialogVisible) return false;
      const dialogText = await dialog.innerText().catch(() => '');
      const ok = dialogText.includes(expectedMessage)
        && dialogText.includes('예')
        && dialogText.includes('아니오');
      taskConfirmEvidence[label] = dialogText;
      const dialogButtons = dialog.getByRole('button');
      if (confirm) {
        await dialogButtons.last().click();
      } else {
        await dialogButtons.first().click();
      }
      await wait(250);
      return ok;
    }
    const taskDeleteConfirm = await checkTaskAction('삭제', '선택한 Task를 삭제하시겠습니까?');
    const taskCompleteConfirm = await checkTaskAction('완료', '선택한 Task를 완료된 상태로 변경하시겠습니까?');
    const taskEditConfirm = await checkTaskAction('수정', '선택한 Task를 수정하시겠습니까?', true);
    const editModeText = await page.locator('body').innerText();
    const editModeHidesRegisterCancel = editModeText.includes('수정 완료') && !editModeText.includes('등록 취소');
    const editCancelButton = page.getByRole('button', { name: '취소' }).first();
    if (await editCancelButton.isVisible().catch(() => false)) await editCancelButton.click();
    await wait(250);

    const searchInput = page.getByPlaceholder('자산·임차인·계약·이슈를 검색하거나 질문하세요');
    await searchInput.fill('평택');
    await wait(350);
    const searchSection = page.locator('section').filter({ hasText: '통합 검색' }).first();
    const searchResult = searchSection.locator('button').filter({ hasText: '평택아디다스물류센터' }).first();
    const searchResultVisible = await searchResult.isVisible().catch(() => false);
    if (searchResultVisible) {
      await searchResult.click();
      await wait(450);
    }
    await capture(page, outDir, 'search-popup', result);
    const searchPopupText = await page.locator('body').innerText();
    const closeButtons = await page.getByRole('button', { name: '닫기' }).all();
    if (closeButtons.length) await closeButtons[closeButtons.length - 1].click();
    await wait(200);
    if (await page.getByRole('dialog').isVisible().catch(() => false)) {
      await page.keyboard.press('Escape').catch(() => {});
      await wait(200);
    }
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await wait(800);

    const uploadButton = page.getByRole('button', { name: '주간업무보고자료 업로드' }).first();
    const uploadCursor = await uploadButton.evaluate((el) => getComputedStyle(el).cursor);
    await uploadButton.click();
    await wait(300);
    await capture(page, outDir, 'upload-modal', result);
    const uploadText = await page.locator('body').innerText();
    const uploadDialog = page.getByRole('dialog');
    const periodSelectCount = await uploadDialog.locator('select').count();
    const hasWeekRange = /\d{4}-\d{2}-\d{2}\s*~\s*\d{4}-\d{2}-\d{2}/u.test(uploadText);

    const assetButtonMetrics = await page.evaluate(() => {
      const container = Array.from(document.querySelectorAll('section')).find((section) => section.innerText.includes('담당 자산'));
      const buttons = Array.from((container || document).querySelectorAll('button')).filter((button) => button.innerText.trim());
      return buttons.slice(0, 20).map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          label: button.innerText.trim(),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          cursor: getComputedStyle(button).cursor,
        };
      });
    });
    const foundAssetMetrics = assetButtonMetrics.filter((item) => item.width > 40 && item.height > 20);
    const widths = foundAssetMetrics.map((item) => item.width);
    const heights = foundAssetMetrics.map((item) => item.height);
    const assetButtonsEven = foundAssetMetrics.length >= 10
      && Math.max(...widths) - Math.min(...widths) <= 8
      && Math.max(...heights) - Math.min(...heights) <= 8
      && foundAssetMetrics.every((item) => item.cursor === 'pointer');

    result.assetButtonMetrics = assetButtonMetrics;
    result.boardAssetSelectInfo = boardAssetSelectInfo;
    result.taskConfirmEvidence = taskConfirmEvidence;
    const assetOptionsOnly = boardAssetSelectInfo.options.slice(1);
    const sortedAssetOptions = [...assetOptionsOnly].sort((a, b) => a.localeCompare(b, 'ko-KR'));
    result.checks = {
      hasMainTitle: bodyText.includes('물류센터 워크 플랫폼'),
      hasMainSubtitle: bodyText.includes('물류센터 관련 업무 현황 및 이슈, 데이터 기반 대시보드'),
      hasReportUploadLabel: bodyText.includes('주간업무보고자료 업로드'),
      noDeprecatedScopeShareComponent: !bodyText.includes('개인·팀·섹터 업무 공유'),
      noTodaySignalCards: !bodyText.includes('오늘 봐야 할 업무 신호'),
      boardAssetSelectUsesReadableAssets: boardAssetSelectInfo.width >= 170
        && boardAssetSelectInfo.options.length >= 10
        && !boardAssetSelectInfo.options.includes('IOTA 공통')
        && !boardAssetSelectInfo.options.includes('427 PFV')
        && assetOptionsOnly.every((label, index) => label === sortedAssetOptions[index]),
      hasTaskScopeSwitch: bodyText.includes('물류센터 주요 TASK 관리')
        && bodyText.includes('개인 업무')
        && bodyText.includes('팀 업무')
        && bodyText.includes('섹터 업무'),
      scopeSwitchChangesContent: teamText !== sectorText && sectorText.includes('섹터 업무'),
      taskActionConfirmPopups: taskDeleteConfirm && taskCompleteConfirm && taskEditConfirm,
      editModeHidesRegisterCancel,
      workRowsShowAssetRelation: bodyText.includes('Task') && bodyText.includes('관련 자산'),
      searchPopupDashboardPreview: searchResultVisible
        && searchPopupText.includes('ASSET DASHBOARD PREVIEW')
        && searchPopupText.includes('평택아디다스물류센터')
        && !searchPopupText.includes('지도 제공'),
      assetButtonsEven,
      uploadCursorPointer: uploadCursor === 'pointer',
      uploadModalHasPeriodSelectors: periodSelectCount >= 3 && hasWeekRange,
      uploadModalIsMinimal: uploadText.includes('주간업무보고자료 업로드')
        && uploadText.includes('반영 기간')
        && uploadText.includes('파일 선택')
        && uploadText.includes('데이터 반영'),
      noMainDataQaNoise: !bodyText.includes('OpenDART') && !bodyText.includes('건축물대장') && !bodyText.includes('Data QA'),
    };
    result.evidence.periodSelectCount = periodSelectCount;
    result.evidence.hasWeekRange = hasWeekRange;
    result.allPass = Object.values(result.checks).every(Boolean) && pageErrors.length === 0;
    fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.allPass ? 0 : 1;
  } finally {
    if (browser) await browser.close();
    preview.kill('SIGKILL');
    previewLog.end();
    setTimeout(() => process.exit(process.exitCode || 0), 100);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
