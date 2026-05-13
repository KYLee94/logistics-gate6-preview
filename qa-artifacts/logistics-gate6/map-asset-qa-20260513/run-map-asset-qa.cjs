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
  const preview = spawn('cmd.exe', ['/d', '/c', 'npm run preview -- --host 127.0.0.1 --port 8083'], {
    cwd: repoRoot,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const previewLog = fs.createWriteStream(path.join(outDir, 'vite-preview-8083.log'), { flags: 'a' });
  preview.stdout.pipe(previewLog);
  preview.stderr.pipe(previewLog);

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:8083/platform/iotaseoul/workspace/logistics/dashboard/home');
      if (response.ok) break;
    } catch {
      await wait(500);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  let currentStep = 'init';
  page.on('console', (message) => {
    const text = message.text();
    if (/naver|map|leaflet|openapi|oapi|cdn\.jsdelivr|tile\.openstreetmap/i.test(text)) {
      consoleMessages.push({ type: message.type(), text });
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push({ step: currentStep, message: error.message, stack: error.stack || '' });
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (/naver|map|leaflet|openapi|oapi|cdn\.jsdelivr|tile\.openstreetmap/i.test(url)) {
      failedRequests.push({ url, failure: request.failure()?.errorText || 'unknown' });
    }
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

  currentStep = 'goto-home';
  await page.goto('http://127.0.0.1:8083/platform/iotaseoul/workspace/logistics/dashboard/home', { waitUntil: 'networkidle', timeout: 90000 });
  currentStep = 'wait-home-map';
  await wait(9000);
  await page.screenshot({ path: path.join(outDir, 'home-map-full.png'), fullPage: true });
  const homeText = await page.locator('body').innerText();
  const mapDebug = await page.evaluate(() => ({
    hasNaver: Boolean(window.naver?.maps?.Map),
    hasLeaflet: Boolean(window.L?.map),
    scripts: [...document.scripts]
      .map((script) => script.src)
      .filter((src) => /naver|leaflet|openapi|oapi|cdn\.jsdelivr/i.test(src)),
    canvas: (() => {
      const canvas = document.querySelector('.logistics-map-canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const images = [...canvas.querySelectorAll('img')].map((image) => ({
        src: image.currentSrc || image.src,
        width: image.width,
        height: image.height,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        display: getComputedStyle(image).display,
        opacity: getComputedStyle(image).opacity,
      })).slice(0, 12);
      return {
        rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
        childCount: canvas.querySelectorAll('*').length,
        imageCount: canvas.querySelectorAll('img').length,
        images,
      };
    })(),
    statusText: [...document.querySelectorAll('div')]
      .map((node) => node.textContent || '')
      .find((text) => text.includes('동적 지도') || text.includes('네이버 동적 지도') || text.includes('스케매틱')) || '',
  }));
  const mapMode = homeText.includes('네이버 동적 지도')
    ? 'naver'
    : homeText.includes('동적 지도 ·')
      ? 'leaflet'
    : homeText.includes('스케매틱')
        ? 'schematic'
        : 'unknown';

  currentStep = 'goto-asset';
  await page.goto('http://127.0.0.1:8083/platform/iotaseoul/workspace/logistics/dashboard/asset', { waitUntil: 'networkidle', timeout: 90000 });
  currentStep = 'wait-asset';
  await wait(3000);
  await page.screenshot({ path: path.join(outDir, 'asset-dashboard-full.png'), fullPage: true });
  const assetText = await page.locator('body').innerText();

  async function clickButton(text, screenshotName, index = 0) {
    const button = page.locator('button').filter({ hasText: text }).nth(index);
    currentStep = `open-${screenshotName}`;
    await button.scrollIntoViewIfNeeded({ timeout: 20000 });
    await wait(250);
    const box = await button.boundingBox();
    if (!box) throw new Error(`button not visible: ${text}`);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await wait(1000);
    const bodyText = await page.locator('body').innerText();
    await page.screenshot({ path: path.join(outDir, screenshotName), fullPage: true });
    currentStep = `close-${screenshotName}`;
    await page.evaluate(() => {
      const closeButton = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('닫기'));
      if (closeButton) closeButton.click();
    });
    await wait(300);
    return bodyText;
  }

  const assetMapPopup = await clickButton('자산 위치 보기', 'popup-asset-map.png');
  const enocPopup = await clickButton('E.NOC', 'popup-asset-enoc.png');
  const rosterPopup = await clickButton('원본 표 보기', 'popup-asset-roster.png', 0);
  const rentPopup = await clickButton('상세 보기', 'popup-asset-rent.png');
  const expiryPopup = await clickButton('원본 표 보기', 'popup-asset-expiry.png', 1);

  const result = {
    urlHome: 'http://127.0.0.1:8083/platform/iotaseoul/workspace/logistics/dashboard/home',
    urlAsset: 'http://127.0.0.1:8083/platform/iotaseoul/workspace/logistics/dashboard/asset',
    mapMode,
    checks: {
      homeHasDynamicMapStatus: homeText.includes('동적 지도 ·') || homeText.includes('네이버 동적 지도'),
      homeMapRendered: mapDebug.canvas?.rect?.height > 300
        && mapDebug.canvas?.imageCount >= 17
        && mapDebug.canvas?.images?.some((image) => image.naturalWidth > 1 && image.naturalHeight > 1),
      assetActive: assetText.includes('자산 개요') && assetText.includes('임차인 현황'),
      assetSelector: assetText.includes('경산 쿠팡물류센터') && assetText.includes('자산 위치 보기'),
      assetKpis: ['임대율', '총 임대면적', '공실면적', '월 임관리비 총액', 'E.NOC'].every((text) => assetText.includes(text)),
      assetSections: ['자산 핵심 요약', '임차인별 월 임관리비', '층별 배치', '면적 구성', '만기 스냅샷', '핵심 임차인'].every((text) => assetText.includes(text)),
      noAdminData: !assetText.includes('Admin Data') && !assetText.includes('관리자 검토 포인트'),
    },
    popupChecks: {
      assetMap: assetMapPopup.includes('포트폴리오 위치') && assetMapPopup.includes('좌표'),
      enoc: enocPopup.includes('E.NOC 검산 결과') && enocPopup.includes('검산 가능 row') && enocPopup.includes('저장 E.NOC'),
      roster: rosterPopup.includes('임차인 현황') && rosterPopup.includes('월 임관리비'),
      rent: rentPopup.includes('임차인별 월 임관리비') && rentPopup.includes('Lease Space 수') && rentPopup.includes('월 관리비'),
      expiry: expiryPopup.includes('만기 스냅샷') && expiryPopup.includes('계약만기일'),
    },
    debug: {
      mapDebug,
      failedRequests,
      pageErrors,
      consoleMessages,
    },
  };
  fs.writeFileSync(path.join(outDir, 'map-asset-qa-result.json'), JSON.stringify(result, null, 2), 'utf8');
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
