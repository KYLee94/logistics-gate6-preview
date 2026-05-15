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
  const outDir = path.join(__dirname, 'worklog-main-permission-layout-qa-20260513');
  fs.mkdirSync(outDir, { recursive: true });
  const port = 8105;
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push({ message: error.message, stack: error.stack || '' }));
    await setQaAuth(page);

    const url = `http://127.0.0.1:${port}/platform/iotaseoul/workspace/logistics`;
    const result = { url, screenshots: {}, checks: {}, evidence: {}, pageErrors };
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await wait(2200);
    await capture(page, outDir, 'main-layout', result);
    const bodyText = await page.locator('body').innerText();

    const permissionButton = page.getByRole('button', { name: '담당 및 권한' });
    const uploadButton = page.getByRole('button', { name: '주간업무보고자료 업로드' }).first();
    const dashboardButton = page.getByRole('button', { name: 'Dashboard' });
    const cursorChecks = {
      permission: await permissionButton.evaluate((el) => getComputedStyle(el).cursor),
      upload: await uploadButton.evaluate((el) => getComputedStyle(el).cursor),
      dashboard: await dashboardButton.evaluate((el) => getComputedStyle(el).cursor),
    };

    await permissionButton.click();
    await wait(350);
    await capture(page, outDir, 'permission-modal', result);
    const permissionText = await page.locator('body').innerText();
    await page.getByRole('button', { name: '닫기' }).click();
    await wait(200);

    await uploadButton.click();
    await wait(350);
    await capture(page, outDir, 'weekly-upload-modal', result);
    const uploadText = await page.locator('body').innerText();
    const fileInputCount = await page.locator('input[type="file"]').count();
    const periodSelectCount = await page.getByRole('dialog').locator('select').count();
    const hasWeekRange = /\d{4}-\d{2}-\d{2}\s*~\s*\d{4}-\d{2}-\d{2}/u.test(uploadText);

    result.cursorChecks = cursorChecks;
    result.evidence.fileInputCount = fileInputCount;
    result.evidence.periodSelectCount = periodSelectCount;
    result.evidence.hasWeekRange = hasWeekRange;
    result.checks = {
      hasCalmMainHeader: bodyText.includes('물류센터 워크 플랫폼')
        && bodyText.includes('물류센터 관련 업무 현황 및 이슈, 데이터 기반 대시보드'),
      hasPermissionSummary: bodyText.includes('담당 자산') && bodyText.includes('담당 펀드'),
      hasTaskFirstFlow: bodyText.includes('물류센터 주요 TASK 관리') && bodyText.includes('Next Action'),
      hasSharedWorklog: bodyText.includes('물류센터 워크 플랫폼 협업게시판'),
      noDeprecatedScopeShareComponent: !bodyText.includes('개인·팀·섹터 업무 공유'),
      uploadNotInlineOnMain: !bodyText.includes('Choose File') && !bodyText.includes('No file chosen'),
      permissionModalWorks: permissionText.includes('담당자별 자산') && permissionText.includes('자산코드') && permissionText.includes('펀드명'),
      uploadModalWorks: uploadText.includes('주간업무보고자료 업로드')
        && uploadText.includes('반영 기간')
        && uploadText.includes('파일 선택')
        && uploadText.includes('주간업무보고자료 읽기 및 반영')
        && fileInputCount >= 1
        && periodSelectCount >= 3
        && hasWeekRange,
      cursorPointer: Object.values(cursorChecks).every((value) => value === 'pointer'),
      noMainDataQaNoise: !bodyText.includes('OpenDART') && !bodyText.includes('건축물대장') && !bodyText.includes('Data QA'),
    };
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
