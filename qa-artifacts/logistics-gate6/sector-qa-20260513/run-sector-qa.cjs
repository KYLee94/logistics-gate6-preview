const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const outDir = __dirname;
  const repoRoot = path.resolve(__dirname, '../../..');
  const port = 8097;
  const preview = spawn('cmd.exe', ['/d', '/c', `npm run preview -- --host 127.0.0.1 --port ${port}`], {
    cwd: repoRoot,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const previewLog = fs.createWriteStream(path.join(outDir, `vite-preview-${port}.log`), { flags: 'a' });
  preview.stdout.pipe(previewLog);
  preview.stderr.pipe(previewLog);

  const urlSector = `http://127.0.0.1:${port}/platform/iotaseoul/workspace/logistics/dashboard/sector`;
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
  page.on('pageerror', (error) => {
    pageErrors.push({ message: error.message, stack: error.stack || '' });
  });
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

  await page.goto(urlSector, { waitUntil: 'networkidle', timeout: 90000 });
  await wait(3000);
  await page.screenshot({ path: path.join(outDir, 'sector-dashboard-full.png'), fullPage: true });
  const sectorText = await page.locator('body').innerText();

  async function clickButton(text, screenshotName, index = 0) {
    const button = page.locator('button').filter({ hasText: text }).nth(index);
    await button.scrollIntoViewIfNeeded({ timeout: 20000 });
    await wait(250);
    const box = await button.boundingBox();
    if (!box) throw new Error(`button not visible: ${text}`);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await wait(900);
    const bodyText = await page.locator('body').innerText();
    await page.screenshot({ path: path.join(outDir, screenshotName), fullPage: true });
    await page.evaluate(() => {
      const closeButton = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('닫기'));
      if (closeButton) closeButton.click();
    });
    await wait(300);
    return bodyText;
  }

  const expiryPopup = await clickButton('12개월 내 만기', 'popup-sector-expiry.png');
  const regionPopup = await clickButton('원본 표 보기', 'popup-sector-region.png', 0);
  const trendButton = page.locator('button').filter({ hasText: '월 임대료' }).first();
  await trendButton.scrollIntoViewIfNeeded({ timeout: 20000 });
  await trendButton.click();
  await wait(900);
  const trendPopup = await page.locator('body').innerText();
  await page.screenshot({ path: path.join(outDir, 'popup-sector-trend.png'), fullPage: true });
  await page.evaluate(() => {
    const closeButton = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('닫기'));
    if (closeButton) closeButton.click();
  });
  await wait(300);

  const firstAssetRow = page.locator('table').filter({ hasText: '공실률' }).locator('tbody tr').first();
  await firstAssetRow.scrollIntoViewIfNeeded({ timeout: 20000 });
  await firstAssetRow.click();
  await wait(900);
  const assetPopup = await page.locator('body').innerText();
  await page.screenshot({ path: path.join(outDir, 'popup-sector-asset-detail.png'), fullPage: true });
  await page.evaluate(() => {
    const closeButton = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('닫기'));
    if (closeButton) closeButton.click();
  });
  await wait(300);

  const firstTenantRow = page.locator('table').filter({ hasText: '임차인명' }).locator('tbody tr').first();
  await firstTenantRow.scrollIntoViewIfNeeded({ timeout: 20000 });
  await firstTenantRow.click();
  await wait(900);
  const tenantPopup = await page.locator('body').innerText();
  await page.screenshot({ path: path.join(outDir, 'popup-sector-tenant-detail.png'), fullPage: true });

  const result = {
    urlSector,
    checks: {
      sectorActive: sectorText.includes('시장 인텔리전스') && sectorText.includes('권역·자산·임차인 리스크 비교'),
      kpis: ['권역 수', '운영 자산 수', '총 임대면적', '월 임관리비', '12개월 내 만기'].every((text) => sectorText.includes(text)),
      regionPanel: sectorText.includes('권역별 노출도') && sectorText.includes('원본 표 보기'),
      trendPanel: sectorText.includes('월 임관리비 추이') && sectorText.includes('월 임대료') && sectorText.includes('월 관리비'),
      assetRanking: sectorText.includes('자산 랭킹') && sectorText.includes('공실률'),
      tenantRanking: sectorText.includes('임차인 랭킹') && sectorText.includes('임대면적'),
      rail: ['Top 자산', 'Top 임차인', '만기 집중도'].every((text) => sectorText.includes(text)),
      noAdminData: !sectorText.includes('Admin Data') && !sectorText.includes('관리자 검토 포인트'),
    },
    popupChecks: {
      expiry: expiryPopup.includes('12개월 내 만기 상세') && expiryPopup.includes('잔여 개월'),
      region: regionPopup.includes('권역별 노출도 원본 표') && regionPopup.includes('월 임관리비') && regionPopup.includes('공실률'),
      trend: trendPopup.includes('월 임관리비 추이 원본 표') && trendPopup.includes('월 임대료') && trendPopup.includes('월 관리비'),
      asset: assetPopup.includes('자산 랭킹 상세') && assetPopup.includes('월 임관리비') && assetPopup.includes('주요 임차인 수'),
      tenant: tenantPopup.includes('임차인 랭킹 상세') && tenantPopup.includes('DART corp code') && tenantPopup.includes('Lease Space 수'),
    },
    debug: { pageErrors },
  };
  fs.writeFileSync(path.join(outDir, 'sector-qa-result.json'), JSON.stringify(result, null, 2), 'utf8');
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
