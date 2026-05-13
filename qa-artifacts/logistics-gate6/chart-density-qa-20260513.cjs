const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const repoRoot = path.resolve(__dirname, '../..');
  const outDir = path.join(__dirname, 'chart-density-qa-20260513');
  fs.mkdirSync(outDir, { recursive: true });
  const port = 8098;
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

  const tabs = ['home', 'asset', 'company', 'sector'];
  const results = {};
  for (const tab of tabs) {
    const url = `http://127.0.0.1:${port}/platform/iotaseoul/workspace/logistics/dashboard/${tab}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await wait(tab === 'home' ? 6000 : 2500);
    await page.screenshot({ path: path.join(outDir, `${tab}-chart-density.png`), fullPage: true });
    const text = await page.locator('body').innerText();
    results[tab] = {
      url,
      hasAxisText: text.includes('Y축') || text.includes('X축') || text.includes('Y축 항목'),
      hasLegendText: text.includes('막대 길이') || text.includes('월 임대료') || text.includes('보조 지표'),
      noAdminData: !text.includes('Admin Data') && !text.includes('관리자 검토 포인트'),
    };
  }

  const result = {
    tabs: results,
    allPass: Object.values(results).every((row) => row.hasAxisText && row.hasLegendText && row.noAdminData),
    pageErrors,
  };
  fs.writeFileSync(path.join(outDir, 'chart-density-qa-result.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  preview.kill('SIGKILL');
  previewLog.end();
  setTimeout(() => process.exit(result.allPass && pageErrors.length === 0 ? 0 : 1), 100);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
