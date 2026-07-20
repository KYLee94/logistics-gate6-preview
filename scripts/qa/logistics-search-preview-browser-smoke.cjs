const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const COMPANY_OPTIONS = require(path.join(ROOT, 'src', 'components', 'system', 'workspace', 'logisticsCompanyOptionsData.json'));
const ASSET_OPTIONS = require(path.join(ROOT, 'src', 'components', 'system', 'workspace', 'logisticsAssetOptionsData.json'));
const COMPANY_KPI_LABELS = ['임차 자산 수', '총 임차면적', '월 임관리비', '월 임대료', '월 관리비'];

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/gu, '')];
    }));
}

const fileEnv = {
  ...readEnvFile(path.join(ROOT, '.env')),
  ...readEnvFile(path.join(ROOT, '.env.local')),
};

function envValue(...keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
    if (fileEnv[key]) return fileEnv[key];
  }
  return '';
}

function argsValue(name, fallback = '') {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || undefined;
}

async function signInSession() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const accessToken = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (supabaseUrl && anonKey && accessToken) {
    const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` },
    });
    const user = await response.json().catch(() => null);
    if (!response.ok || !user?.id) throw new Error(`Supabase access token validation failed (${response.status}).`);
    return {
      session: {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.round(Date.now() / 1000) + 3600,
        refresh_token: '',
        user,
      },
      source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN',
    };
  }

  const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  if (!supabaseUrl || !anonKey || !email || !password) {
    throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or set LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  }
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await response.json().catch(() => null);
  if (!response.ok || !session?.access_token) throw new Error(`Supabase Auth login failed (${response.status}).`);
  if (!session.expires_at && session.expires_in) session.expires_at = Math.round(Date.now() / 1000) + Number(session.expires_in);
  return { session, source: 'password_grant' };
}

async function closePreview(page) {
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 });
}

async function openSearchPreview(page, query, resultKind, resultLabel) {
  const input = page.getByTestId('logistics-main-search-input');
  await input.fill(query);
  const kindLabel = resultKind === 'company' ? '임차인' : '자산';
  const result = page.locator('button')
    .filter({ hasText: resultLabel })
    .filter({ hasText: kindLabel })
    .first();
  await result.waitFor({ state: 'visible', timeout: 12000 });
  await result.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 15000 });
  return dialog;
}

async function fullscreenDialog(dialog) {
  return dialog.locator(':scope > div').evaluate((node) => {
    const box = node.getBoundingClientRect();
    return box.width >= window.innerWidth * 0.9 && box.height >= window.innerHeight * 0.85;
  }).catch(() => false);
}

async function companyKpis(dialog) {
  return dialog.evaluate((root, labels) => Object.fromEntries(labels.map((label) => {
    const labelNode = Array.from(root.querySelectorAll('div'))
      .find((node) => node.textContent?.trim() === label);
    const valueNode = labelNode?.parentElement?.querySelectorAll(':scope > div')[1];
    return [label, valueNode?.textContent?.trim() || ''];
  })), COMPANY_KPI_LABELS);
}

async function companyTableRows(dialog) {
  return dialog.locator('table').evaluateAll((tables) => {
    const table = tables.find((candidate) => {
      const headers = Array.from(candidate.querySelectorAll('thead th')).map((cell) => cell.textContent?.replace(/[↕▲▼]/gu, '').trim());
      return headers[0] === '자산명' && headers[2] === '구역';
    });
    if (!table) return [];
    return Array.from(table.querySelectorAll('tbody tr')).map((row) => {
      const cells = Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || '');
      return { assetName: cells[0] || '', zone: cells[2] || '' };
    }).filter((row) => row.assetName && row.assetName !== '-');
  });
}

function rowsUseAssetAscendingZoneDescending(rows) {
  const collator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' });
  const expected = [...rows].sort((left, right) => (
    collator.compare(left.assetName, right.assetName) || collator.compare(right.zone, left.zone)
  ));
  return rows.every((row, index) => (
    row.assetName === expected[index]?.assetName && row.zone === expected[index]?.zone
  ));
}

function companyCandidates() {
  const eligible = [...COMPANY_OPTIONS]
    .filter((company) => String(company?.tenantMasterName || '').trim().length >= 2)
    .sort((left, right) => Number(right?.assetCount || right?.selectorSortMeta?.assetCount || 0) - Number(left?.assetCount || left?.selectorSortMeta?.assetCount || 0));
  const preferred = eligible.find((company) => /쿠팡/u.test(company.tenantMasterName || ''));
  return preferred ? [preferred, ...eligible.filter((company) => company !== preferred).slice(0, 2)] : eligible.slice(0, 3);
}

function assetCandidate() {
  return ASSET_OPTIONS.find((asset) => /경산\s*쿠팡/iu.test(asset?.assetName || ''))
    || ASSET_OPTIONS.find((asset) => String(asset?.assetName || '').trim().length >= 2)
    || null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `search-preview-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'search-preview-browser-smoke-latest.json');
  const screenshot = path.join(OUT_DIR, `search-preview-browser-smoke-${stamp}.png`);
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const auth = await signInSession();
  const uiEmail = auth.session.user?.email || envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com';
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    auth_source: auth.source,
    selected_company: null,
    selected_asset: null,
    company_kpis: {},
    company_rows: [],
    company_attempts: [],
    company_api_responses: [],
    asset_api_responses: [],
    checks: {},
    errors: [],
    screenshot: path.relative(ROOT, screenshot).replace(/\\/gu, '/'),
  };

  let browser;
  let context;
  let page;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
    await context.addInitScript(({ email, session }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { email: uiEmail, session: auth.session });
    page = await context.newPage();
    page.on('response', async (response) => {
      const requestBody = response.request().postData() || '';
      if (!response.url().includes('/functions/v1/ll-dashboard-api') || !requestBody.includes('dashboard/company/read')) return;
      const body = await response.json().catch(() => ({}));
      report.company_api_responses.push({
        status: response.status(),
        ok: body?.ok !== false,
        error: body?.error || body?.message || '',
        row_count: body?.data?.leases?.length || body?.data?.rows?.length || 0,
      });
    });
    page.on('response', async (response) => {
      const requestBody = response.request().postData() || '';
      if (!response.url().includes('/functions/v1/ll-dashboard-api') || !requestBody.includes('dashboard/asset/read')) return;
      const body = await response.json().catch(() => ({}));
      report.asset_api_responses.push({
        status: response.status(),
        ok: body?.ok !== false,
        error: body?.error || body?.message || '',
        row_count: body?.data?.lease_spaces?.length || body?.data?.rows?.length || 0,
      });
    });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByTestId('logistics-main-search-input').waitFor({ state: 'visible', timeout: 90000 });

    let selectedCompany = null;
    let selectedCompanyDialog = null;
    for (const candidate of companyCandidates()) {
      const dialog = await openSearchPreview(page, candidate.tenantMasterName, 'company', candidate.tenantMasterName).catch(() => null);
      if (!dialog) continue;
      const rows = await page.waitForFunction(() => {
        const table = Array.from(document.querySelectorAll('[role="dialog"] table')).find((candidateTable) => {
          const headers = Array.from(candidateTable.querySelectorAll('thead th')).map((cell) => cell.textContent?.replace(/[↕▲▼]/gu, '').trim());
          return headers[0] === '자산명' && headers[2] === '구역';
        });
        return table?.querySelectorAll('tbody tr').length >= 2;
      }, undefined, { timeout: 20000 }).then(() => companyTableRows(dialog)).catch(() => []);
      report.company_attempts.push({
        company: candidate.tenantMasterName,
        row_count: rows.length,
        dialog_text: (await dialog.innerText().catch(() => '')).slice(0, 800),
      });
      if (rows.length >= 2) {
        selectedCompany = candidate;
        selectedCompanyDialog = dialog;
        report.company_rows = rows;
        break;
      }
      await closePreview(page).catch(() => null);
    }

    if (!selectedCompany || !selectedCompanyDialog) {
      throw new Error('정렬을 검증할 회사 검색 결과를 찾지 못했습니다.');
    }
    report.selected_company = selectedCompany.tenantMasterName;
    report.checks.company_popup_fullscreen = await fullscreenDialog(selectedCompanyDialog);
    report.company_kpis = await companyKpis(selectedCompanyDialog);
    report.checks.company_kpis_nonempty = COMPANY_KPI_LABELS.every((label) => {
      const value = String(report.company_kpis[label] || '').trim();
      return value.length > 0 && value !== '-';
    });
    report.checks.company_rows_asset_ascending_zone_descending = rowsUseAssetAscendingZoneDescending(report.company_rows);
    report.checks.company_full_view_button_korean = await selectedCompanyDialog
      .getByRole('button', { name: '기업 탭에서 전체 보기', exact: true })
      .count()
      .then((count) => count === 1);
    await closePreview(page);

    const asset = assetCandidate();
    if (!asset) throw new Error('자산 검색 후보를 찾지 못했습니다.');
    report.selected_asset = asset.assetName;
    const assetDialog = await openSearchPreview(page, asset.assetName, 'asset', asset.assetName);
    report.checks.asset_data_rows_visible = await page.waitForFunction(() => {
      const table = Array.from(document.querySelectorAll('[role="dialog"] table')).find((candidateTable) => {
        const headers = Array.from(candidateTable.querySelectorAll('thead th')).map((cell) => cell.textContent?.replace(/[↕▲▼]/gu, '').trim());
        return headers[0] === '임차인명';
      });
      return (table?.querySelectorAll('tbody tr').length || 0) > 0;
    }, undefined, { timeout: 20000 }).then(() => true).catch(() => false);
    report.checks.asset_popup_fullscreen = await fullscreenDialog(assetDialog);
    report.checks.asset_popup_overview_visible = await assetDialog.getByText('자산명', { exact: true }).count().then((count) => count > 0)
      && await assetDialog.getByText('현재 임차인 수', { exact: true }).count().then((count) => count > 0);
    report.checks.asset_full_view_button_korean = await assetDialog
      .getByRole('button', { name: '자산 탭에서 전체 보기', exact: true })
      .count()
      .then((count) => count === 1);
    await page.screenshot({ path: screenshot, fullPage: false });
    report.ok = Object.values(report.checks).every(Boolean) && report.errors.length === 0;
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    if (page && !fs.existsSync(screenshot)) await page.screenshot({ path: screenshot, fullPage: false }).catch(() => null);
    if (context) await context.close().catch(() => null);
    if (browser) await browser.close().catch(() => null);
    fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log(`search preview browser smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  console.log(`screenshot artifact: ${report.screenshot}`);
  if (!report.ok) {
    console.log(JSON.stringify(report.checks, null, 2));
    if (report.errors.length) console.error(report.errors.join('\n'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
