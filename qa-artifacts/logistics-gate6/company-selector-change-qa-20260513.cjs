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
const outDir = path.join(__dirname, 'company-selector-change-qa-20260513');
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
      // retry until preview server is ready
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error(`Preview server not ready: ${url}`);
}

async function readCompanyState(page) {
  const selector = page.locator('select').first();
  const selected = await selector.evaluate((el) => ({
    value: el.value,
    label: el.selectedOptions[0]?.textContent?.trim() || '',
    optionCount: el.options.length,
  }));
  const mainText = await page.locator('body').innerText();
  const visibleHeadings = await page.locator('h2, h3, th').evaluateAll((nodes) =>
    nodes.slice(0, 30).map((node) => node.textContent.trim()).filter(Boolean),
  );
  return { selected, mainText, visibleHeadings };
}

(async () => {
  const result = {
    url: 'http://127.0.0.1:4177/platform/iotaseoul/workspace/logistics/dashboard/company',
    screenshots: {},
    checks: {},
    pageErrors: [],
    networkBlocked: [],
  };

  const preview = run('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4177']);
  let browser;
  try {
    await waitForServer('http://127.0.0.1:4177/');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
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
        maybeSingle: async () => ({ data: member, error: null }),
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
          user_metadata: {},
        },
      }));
    });
    page.on('pageerror', (error) => result.pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (text.includes('ERR_NETWORK_ACCESS_DENIED')) result.networkBlocked.push(text);
      else result.pageErrors.push(text);
    });

    await page.goto(result.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1200);

    const selector = page.locator('select').first();
    await selector.waitFor({ state: 'visible', timeout: 15000 });
    const before = await readCompanyState(page);
    result.screenshots.before = path.join(outDir, 'company-before.png');
    await page.screenshot({ path: result.screenshots.before, fullPage: true });

    await selector.selectOption({ index: Math.min(1, before.selected.optionCount - 1) });
    await page.waitForTimeout(1200);
    const after = await readCompanyState(page);
    const storedTenantId = await page.evaluate(() => window.sessionStorage.getItem('logisticsSelectedTenantId'));
    await page.reload({ waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(900);
    const afterReload = await readCompanyState(page);
    result.screenshots.after = path.join(outDir, 'company-after.png');
    await page.screenshot({ path: result.screenshots.after, fullPage: true });

    result.before = {
      selected: before.selected,
      visibleHeadings: before.visibleHeadings,
    };
    result.after = {
      selected: after.selected,
      visibleHeadings: after.visibleHeadings,
    };
    result.afterReload = {
      selected: afterReload.selected,
      visibleHeadings: afterReload.visibleHeadings,
      storedTenantId,
    };
    result.checks.selectorHasMultipleCompanies = before.selected.optionCount > 1;
    result.checks.selectedCompanyChanged = before.selected.value !== after.selected.value;
    result.checks.visibleContentChanged = before.mainText !== after.mainText;
    result.checks.selectedCompanyPersistsOnReentry = storedTenantId === after.selected.value && afterReload.selected.value === after.selected.value;
    result.checks.companyTopOneLineBlocksRemoved = ['대상', '기준시점', '계약/금액'].every((text) => !after.visibleHeadings.includes(text));
    result.checks.companyMapRestored = after.mainText.includes('회사별 임차 자산 지도') && after.mainText.includes('지도 크게 보기');
    result.checks.companyDartRestored = after.mainText.includes('DART 상세 정보') && after.mainText.includes('OpenDART 새로 조회');
    result.checks.companyDartHiddenFieldsRemoved = ['DART corp code', '매칭상태', '업종', '재무 구분', '사용한 보고서', '접수번호', 'DART 적재일', '검토 메모']
      .every((text) => !after.mainText.includes(text));
    result.checks.companyLeasedAssetsStillVisible = after.mainText.includes('임차 자산 현황') && after.mainText.includes('자산별 노출도');
    result.checks.noPageErrors = result.pageErrors.length === 0;
    result.allPass = Object.values(result.checks).every(Boolean);

    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
    if (!result.allPass) {
      console.error(JSON.stringify(result, null, 2));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } finally {
    if (browser) await browser.close();
    preview.kill();
    setTimeout(() => process.exit(process.exitCode || 0), 250);
  }
})();
