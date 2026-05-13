const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  const outDir = __dirname;
  fs.mkdirSync(outDir, { recursive: true });
  const preview = spawn('cmd.exe', ['/d', '/c', 'npm run preview -- --host 127.0.0.1 --port 8082'], {
    cwd: path.resolve(__dirname, '../../..'),
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const previewLog = fs.createWriteStream(path.join(outDir, 'vite-preview-8082.log'), { flags: 'a' });
  preview.stdout.pipe(previewLog);
  preview.stderr.pipe(previewLog);
  async function waitForPreview() {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch('http://127.0.0.1:8082/platform/iotaseoul/workspace/logistics/dashboard/home');
        if (response.ok) return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    throw new Error('Vite preview did not start on 127.0.0.1:8082');
  }
  await waitForPreview();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
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

  await page.goto('http://127.0.0.1:8082/platform/iotaseoul/workspace/logistics/dashboard/home', {
    waitUntil: 'networkidle',
    timeout: 90000,
  });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(outDir, 'home-dashboard-full.png'), fullPage: true });

  const bodyText = await page.locator('body').innerText();
  fs.writeFileSync(path.join(outDir, 'body-text.txt'), bodyText, 'utf8');
  const checks = {
    activeHome: bodyText.includes('Home') && bodyText.includes('포트폴리오 위치'),
    fiveKpis: ['운영 자산 수', '총 임대면적', '총 공실면적', '공실률', '월 임관리비 총액'].every((text) => bodyText.includes(text)),
    portfolioLocation: bodyText.includes('포트폴리오 위치') && bodyText.includes('지도 크게 보기') && bodyText.includes('좌표 표'),
    snapshot: bodyText.includes('포트폴리오 스냅샷') && bodyText.includes('표시 임차인 수'),
    rentTrend: bodyText.includes('임대료 추이') && bodyText.includes('원본 표 보기'),
    vacancy: bodyText.includes('공실 요약'),
    expiry: bodyText.includes('만기 집중도') && bodyText.includes('월별 상세 보기'),
    tenantTables: bodyText.includes('상위 임차인') && bodyText.includes('주요 임차인 계약 요약'),
    noAdminData: !bodyText.includes('Admin Data') && !bodyText.includes('관리자 검토 포인트'),
  };

  async function clickByText(text, screenshotName) {
    const button = page.locator('button').filter({ hasText: text }).first();
    const buttonText = await button.innerText({ timeout: 20000 });
    fs.writeFileSync(path.join(outDir, `debug-button-${screenshotName}.txt`), buttonText, 'utf8');
    await button.scrollIntoViewIfNeeded({ timeout: 20000 });
    await page.waitForTimeout(250);
    const box = await button.boundingBox();
    if (!box) throw new Error(`Button not visible: ${text}`);
    const hit = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return element ? { tag: element.tagName, text: element.textContent?.slice(0, 120), cls: element.className } : null;
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    fs.writeFileSync(path.join(outDir, `debug-hit-${screenshotName}.json`), JSON.stringify({ text, box, hit }, null, 2), 'utf8');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, `debug-after-${screenshotName}`), fullPage: true });
    const modalText = await page.locator('body').innerText();
    fs.writeFileSync(path.join(outDir, `debug-body-after-${screenshotName}.txt`), modalText, 'utf8');
    await page.screenshot({ path: path.join(outDir, screenshotName), fullPage: true });
    await page.evaluate(() => {
      const closeButton = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('닫기'));
      if (closeButton) closeButton.click();
    });
    await page.waitForTimeout(300);
    return modalText;
  }

  const popupTexts = {};
  popupTexts.assets = await clickByText('운영 자산 수', 'popup-operating-assets.png');
  popupTexts.snapshotVacancy = await clickByText('현재 공실률', 'popup-snapshot-vacancy.png');
  popupTexts.map = await clickByText('지도 크게 보기', 'popup-portfolio-map.png');
  popupTexts.rentTrend = await clickByText('원본 표 보기', 'popup-rent-trend-table.png');
  popupTexts.expiry = await clickByText('월별 상세 보기', 'popup-expiry-monthly-detail.png');
  await page.getByText('쿠팡(주)').first().click({ timeout: 20000 });
  await page.waitForTimeout(800);
  popupTexts.tenant = await page.locator('body').innerText();
  await page.screenshot({ path: path.join(outDir, 'popup-tenant-detail.png'), fullPage: true });
  await page.evaluate(() => {
    const closeButton = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('닫기'));
    if (closeButton) closeButton.click();
  });

  const popupChecks = {
    assetsHeader: popupTexts.assets.includes('운영 자산 목록') && popupTexts.assets.includes('자산명') && popupTexts.assets.includes('연면적'),
    snapshotVacancyHeader: popupTexts.snapshotVacancy.includes('현재 공실률 근거') && popupTexts.snapshotVacancy.includes('공실면적'),
    mapHasAssetList: popupTexts.map.includes('포트폴리오 위치') && popupTexts.map.includes('자산명') && popupTexts.map.includes('좌표'),
    rentTrendHeader: popupTexts.rentTrend.includes('임대료 추이 원본 표') && popupTexts.rentTrend.includes('월 임대료(RF/FO 반영)'),
    expiryHeader: popupTexts.expiry.includes('만기 집중도 월별 상세') && popupTexts.expiry.includes('평당 월 임대료') && popupTexts.expiry.includes('E.NOC'),
    tenantHeader: popupTexts.tenant.includes('임차인 상세') && popupTexts.tenant.includes('월 임관리비'),
  };

  const result = {
    url: page.url(),
    outDir,
    checks,
    popupChecks,
    popupSamples: Object.fromEntries(Object.entries(popupTexts).map(([key, value]) => [key, value.slice(0, 500)])),
  };
  fs.writeFileSync(path.join(outDir, 'home-qa-result.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  preview.kill('SIGKILL');
  previewLog.end();
  setTimeout(() => process.exit(0), 100);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
