const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const repoRoot = path.resolve(__dirname, '../..');
  const outDir = path.join(__dirname, 'worklog-main-qa-20260513');
  fs.mkdirSync(outDir, { recursive: true });
  const port = 8101;
  const preview = spawn('cmd.exe', ['/d', '/c', `npm run preview -- --host 127.0.0.1 --port ${port}`], {
    cwd: repoRoot,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const previewLog = fs.createWriteStream(path.join(outDir, `vite-preview-${port}.log`), { flags: 'a' });
  preview.stdout.pipe(previewLog);
  preview.stderr.pipe(previewLog);

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) break;
    } catch {
      await wait(500);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push({ message: error.message, stack: error.stack || '' }));
  await page.addInitScript(() => {
    const readerUser = {
      id: 'local-qa-reader',
      email: 'reader.qa@igis.local',
      app_metadata: { logistics_role: 'Reader' },
      user_metadata: {},
    };
    const readerMember = {
      email: 'reader.qa@igis.local',
      staff_name: 'QA Reader',
      name: 'QA Reader',
      role_code: 'reader',
    };
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      single: async () => ({ data: readerMember, error: null }),
      then: (resolve) => resolve({ data: [], error: null }),
    };
    window.__SUPABASE_CLIENT__ = {
      auth: {
        getSession: async () => ({ data: { session: { user: readerUser, access_token: 'local-qa-token' } }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signOut: async () => ({ error: null }),
      },
      from: () => chain,
    };
  });

  const url = `http://127.0.0.1:${port}/platform/iotaseoul/workspace/logistics`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await wait(2500);
  await page.screenshot({ path: path.join(outDir, 'worklog-main-initial.png'), fullPage: true });
  const uploadLocatorCheck = {
    fileInput: await page.locator('input[type="file"]').count(),
    wordButton: await page.getByRole('button', { name: /Word/ }).count(),
    weeklySelects: await page.locator('select').count(),
  };
  await page.getByRole('button', { name: /Word/ }).click();
  await wait(300);
  const uploadValidationText = await page.locator('body').innerText();

  await page.getByPlaceholder('제목을 입력하세요').fill('QA 작성 테스트 - 물류센터 업무 로그');
  await page.getByPlaceholder(/진행 이력/).fill('QA에서 작성 버튼 동작과 업무 로그 테이블 반영을 확인합니다.');
  await page.getByPlaceholder('회사명 검색/입력').fill('QA 이해관계자');
  await page.getByRole('button', { name: '작성하기' }).click();
  await wait(500);

  await page.getByRole('button', { name: '마감순' }).click();
  await wait(300);
  await page.getByRole('button', { name: 'Dashboard 보기' }).click();
  await page.waitForURL(/dashboard\/home/, { timeout: 10000 });
  const dashboardText = await page.locator('body').innerText();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await wait(1000);
  await page.getByRole('button', { name: 'Weekly 탭 보기' }).click();
  await page.waitForURL(/dashboard\/weekly/, { timeout: 10000 });
  const weeklyText = await page.locator('body').innerText();
  const weeklySelectorCheck = {
    weeklySelects: await page.locator('select').count(),
  };

  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await wait(1000);
  await page.screenshot({ path: path.join(outDir, 'worklog-main-final.png'), fullPage: true });
  const text = await page.locator('body').innerText();
  const composerLocatorCheck = {
    titleInput: await page.getByPlaceholder('제목을 입력하세요').count(),
    bodyInput: await page.getByPlaceholder(/진행 이력/).count(),
    stakeholderInput: await page.getByPlaceholder('회사명 검색/입력').count(),
    writeButton: await page.getByRole('button', { name: '작성하기' }).count(),
    permissionButton: await page.getByRole('button', { name: '열람권한' }).count(),
  };

  const result = {
    url,
    checks: {
      hasMainBoard: text.includes('물류센터 섹터 협업게시판'),
      hasWordUploadPanel: uploadLocatorCheck.fileInput > 0 && uploadLocatorCheck.wordButton > 0 && uploadValidationText.includes('Word'),
      hasComposer: Object.values(composerLocatorCheck).every((count) => count > 0),
      hasWorklogTable: text.includes('프로젝트') && text.includes('기능셀') && text.includes('등록자') && text.includes('진행상태'),
      hasWeeklyStatus: text.includes('이번 주 공유 현황') && text.includes('주요 이슈'),
      hasTaskCards: text.includes('물류센터 주요 TASK 관리') && text.includes('Next Action') && text.includes('마감순'),
      excludesDataQaFromMain: !text.includes('정규화 데이터') && !text.includes('API 미인증 차단') && !text.includes('원본 연결'),
      dashboardRouteWorks: dashboardText.includes('Home') || dashboardText.includes('Portfolio'),
      dashboardStorylineWorks: dashboardText.includes('DASHBOARD STORYLINE') && dashboardText.includes('업무 흐름 기준 탭 배치'),
      weeklyRouteWorks: weeklyText.includes('Weekly') || weeklyText.includes('주간'),
      weeklyPeriodSelectorsWork: weeklySelectorCheck.weeklySelects >= 5,
    },
    composerLocatorCheck,
    uploadLocatorCheck,
    weeklySelectorCheck,
    pageErrors,
  };
  result.allPass = Object.values(result.checks).every(Boolean) && pageErrors.length === 0;
  fs.writeFileSync(path.join(outDir, 'worklog-main-qa-result.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  preview.kill('SIGKILL');
  previewLog.end();
  setTimeout(() => process.exit(result.allPass ? 0 : 1), 100);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
