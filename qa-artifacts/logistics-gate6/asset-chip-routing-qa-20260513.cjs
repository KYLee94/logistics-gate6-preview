let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('C:/Users/10524/Desktop/codex_realasset/Project/03_Logi_Leasing_Dashboard/node_modules/playwright'));
}
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const repoRoot = path.resolve(__dirname, '../..');
  const outDir = path.join(__dirname, 'asset-chip-routing-qa-20260513');
  fs.mkdirSync(outDir, { recursive: true });
  const port = 8121;
  const preview = spawn('cmd.exe', ['/d', '/c', `npm run preview -- --host 127.0.0.1 --port ${port}`], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const previewLog = fs.createWriteStream(path.join(outDir, `vite-preview-${port}.log`), { flags: 'a' });
  preview.stdout.pipe(previewLog);
  preview.stderr.pipe(previewLog);

  try {
    for (let i = 0; i < 80; i += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/`);
        if (response.ok) break;
      } catch {
        await wait(500);
      }
    }

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1150 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push({ message: error.message, stack: error.stack || '' }));
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

    const url = `http://127.0.0.1:${port}/platform/iotaseoul/workspace/logistics`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await wait(1500);
    const targetName = '평택아디다스물류센터';
    const targetButton = page.getByRole('button', { name: targetName });
    const targetCursor = await targetButton.evaluate((el) => getComputedStyle(el).cursor);
    await targetButton.click();
    await page.waitForURL(/dashboard\/asset/, { timeout: 30000 });
    await wait(1800);
    await page.screenshot({ path: path.join(outDir, 'asset-after-chip-click.png'), fullPage: true });
    const bodyText = await page.locator('body').innerText();
    const selectedStorage = await page.evaluate(() => window.sessionStorage.getItem('logisticsSelectedAssetId'));
    const selectValues = await page.locator('select').evaluateAll((nodes) => nodes.map((node) => ({ value: node.value, text: node.options[node.selectedIndex]?.text || '' })));

    const result = {
      url,
      screenshots: {
        assetAfterChipClick: path.join(outDir, 'asset-after-chip-click.png'),
      },
      checks: {
        chipCursorPointer: targetCursor === 'pointer',
        navigatedToAssetDashboard: /dashboard\/asset/.test(page.url()),
        selectedAssetStored: selectedStorage === 'asset_a112500002',
        selectedAssetVisible: bodyText.includes(targetName),
        selectedAssetSelectMatches: selectValues.some((item) => item.value === 'asset_a112500002' && item.text.includes(targetName)),
      },
      selectedStorage,
      selectValues,
      pageErrors,
    };
    result.allPass = Object.values(result.checks).every(Boolean) && pageErrors.length === 0;
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
    preview.kill('SIGKILL');
    previewLog.end();
    process.exit(result.allPass ? 0 : 1);
  } catch (error) {
    preview.kill('SIGKILL');
    previewLog.end();
    console.error(error);
    process.exit(1);
  }
}

main();
