const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const DEFAULT_ROUTE = '?p=contract-data';
const DATA_QUALITY_REMOVED_PLAN_TEXTS = ['Data Quality 정비 계획', '정규 계약 테이블', '임대료 이력', '원본 추적성', '계산값 검산', 'Data Update 연동'];

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
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || undefined;
}

function joinUrl(baseUrl, route) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(route.replace(/^\/+/u, ''), normalizedBase).toString();
}

function excelColumnIndex(letter) {
  return String(letter || '').toUpperCase().split('').reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
}

function excelColumnName(index) {
  let current = index;
  let name = '';
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function excelColumnRange(start, end) {
  const startIndex = excelColumnIndex(start);
  const endIndex = excelColumnIndex(end);
  return Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => excelColumnName(startIndex + offset));
}

function floorSortValue(label) {
  const value = String(label || '').trim().toUpperCase();
  const matches = [...value.matchAll(/B\s*\d+|\d+(?:\.\d+)?\s*(?:F|층)?/giu)];
  if (matches.length) {
    return Math.max(...matches.map((match) => {
      const token = match[0].trim().toUpperCase();
      const numeric = Number((token.match(/\d+(?:\.\d+)?/u) || [])[0]);
      if (!Number.isFinite(numeric)) return -999;
      return token.startsWith('B') ? -numeric : numeric;
    }));
  }
  const basement = value.match(/^B\s*(\d+)/u);
  if (basement) return -Number(basement[1]);
  const numeric = value.match(/-?\d+(?:\.\d+)?/u);
  return numeric ? Number(numeric[0]) : -999;
}

function dataUpdateFieldCoverage() {
  const sourcePath = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const expected = {
    'DB_일반': [...excelColumnRange('B', 'S'), ...excelColumnRange('U', 'Z'), ...excelColumnRange('AA', 'CF')],
    'DB_히스토리 누적': excelColumnRange('B', 'S'),
  };
  const found = {
    'DB_일반': new Set(),
    'DB_히스토리 누적': new Set(),
  };
  source.split(/\r?\n/u).forEach((line) => {
    if (!line.includes('sourceColumnLetter') || !line.includes('domain')) return;
    const domain = line.match(/domain: '([^']+)'/u)?.[1];
    const column = line.match(/sourceColumnLetter: '([^']+)'/u)?.[1];
    if (domain && column && found[domain]) found[domain].add(column);
  });
  const sheets = Object.fromEntries(Object.entries(expected).map(([sheet, columns]) => {
    const foundColumns = found[sheet] || new Set();
    const missing = columns.filter((column) => !foundColumns.has(column));
    return [sheet, {
      expected_count: columns.length,
      found_count: foundColumns.size,
      missing_columns: missing,
      ok: missing.length === 0,
    }];
  }));
  return {
    ok: Object.values(sheets).every((sheet) => sheet.ok),
    sheets,
  };
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
      email: user.email || envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'),
      source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN',
    };
  }
  const email = argsValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = argsValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
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
  return { session, email, source: 'password_grant' };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `data-update-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'data-update-browser-smoke-latest.json');
  const screenshotPath = path.join(OUT_DIR, `data-update-browser-smoke-${stamp}.png`);
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const route = argsValue('route', DEFAULT_ROUTE);
  const targetUrl = joinUrl(baseUrl, route);
  const auth = await signInSession();
  const sourceFieldCoverage = dataUpdateFieldCoverage();
  const uiEmail = argsValue('ui-email', envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com');
  const browserSession = {
    ...auth.session,
    user: {
      ...(auth.session.user || {}),
      email: uiEmail,
    },
  };
  const errors = [];
  const resourceErrors = [];
  const corsWarnings = [];
  const result = {
    ok: false,
    generated_at: new Date().toISOString(),
    url: targetUrl,
    auth_source: auth.source,
    ui_email: uiEmail,
    required_text: ['Data Update', '임대차계약 데이터 관리', '현재 계약 원장', '임대차계약 데이터 수정', '단위', '기본 정보', '임차 구역 및 면적', '계약 일정', '임대료/관리비', '권리·보험·특약', '시설 사양', '임대료 변경 내역', '평당 임대료', '평당 관리비', '월 임대료 총액', '월 관리비 총액', '기준일자', '임대료 변동 원인', '계약 변경 반영 이력'],
    forbidden_text: ['Contract Data', '원본 데이터 수정', 'Supabase 자동 반영', '원본 컬럼', '원본 EXCEL 전체 필드 수정 요청', '원본 EXCEL 전체 필드 추가 요청', 'DB_일반', 'DB_히스토리', '히스토리', '계약 변경 승인 대기', 'QA smoke', 'smoke_rolled_back'],
    missing_text: [],
    forbidden_found: [],
    page_errors: errors,
    resource_errors: resourceErrors,
    cors_warnings: corsWarnings,
    source_field_coverage: sourceFieldCoverage,
    mode_checks: {},
    screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
  };
  let browser;
  let page;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      deviceScaleFactor: 1,
      serviceWorkers: 'block',
    });
    await context.addInitScript(({ email, session }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { email: uiEmail, session: browserSession });
    page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (/blocked by CORS policy/iu.test(text)) corsWarnings.push(text);
      else if (/Failed to load resource/iu.test(text)) resourceErrors.push(text);
      else errors.push(text);
    });
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('Data Update'), null, { timeout: 45000 });
    let bodyText = await page.locator('body').innerText({ timeout: 10000 });
    result.missing_text = result.required_text.filter((text) => !bodyText.includes(text));
    result.forbidden_found = result.forbidden_text.filter((text) => bodyText.includes(text));
    result.forbidden_contexts = Object.fromEntries(result.forbidden_found.map((text) => {
      const index = bodyText.indexOf(text);
      return [text, index >= 0 ? bodyText.slice(Math.max(0, index - 160), index + text.length + 160) : ''];
    }));

    const leaseOptions = await page.locator('label', { hasText: '계약 구역' }).locator('option').allTextContents();
    const leaseFloorValues = leaseOptions
      .map((text) => floorSortValue(text.split('/').slice(1).join('/').trim() || text))
      .filter((value) => value > -999);
    result.mode_checks.lease_space_sort = {
      ok: leaseFloorValues.length > 1 && leaseFloorValues.every((value, index) => index === 0 || leaseFloorValues[index - 1] >= value),
      option_count: leaseOptions.length,
      floor_values: leaseFloorValues,
    };

    await page.getByRole('button', { name: '현재 계약 원장' }).first().click();
    await page.waitForFunction(() => document.body.innerText.includes('CURRENT CONTRACTS') && document.body.innerText.includes('닫기'), null, { timeout: 10000 });
    const ledgerModalText = await page.locator('body').innerText({ timeout: 10000 });
    result.mode_checks.ledger_modal = {
      ok: ledgerModalText.includes('CURRENT CONTRACTS') && ledgerModalText.includes('닫기'),
      has_fullscreen_entry: ledgerModalText.includes('현재 계약 원장'),
    };
    await page.getByRole('button', { name: '닫기' }).click();

    await page.getByRole('button', { name: /^추가$/u }).first().click();
    await page.waitForFunction(() => document.body.innerText.includes('임대차계약 데이터 수정'), null, { timeout: 10000 });
    const addModeText = await page.locator('body').innerText({ timeout: 10000 });
    const addRequestButtonCount = await page.getByRole('button', { name: '검토 후 정규 DB 반영' }).count();
    result.mode_checks.add_mode = {
      ok: addModeText.includes('임대차계약 데이터 수정') && addModeText.includes('예시') && addModeText.includes('입력값') && addRequestButtonCount === 1,
      has_example_column: addModeText.includes('예시'),
      has_input_column: addModeText.includes('입력값'),
      add_request_button_count: addRequestButtonCount,
    };

    await page.getByRole('button', { name: /^삭제$/u }).first().click();
    await page.waitForFunction(() => document.body.innerText.includes('정말 삭제하시겠습니까? 삭제된 내용은 별도 저장 공간에 아카이빙됩니다.'), null, { timeout: 10000 });
    const deleteModeText = await page.locator('body').innerText({ timeout: 10000 });
    result.mode_checks.delete_modal = {
      ok: deleteModeText.includes('정말 삭제하시겠습니까? 삭제된 내용은 별도 저장 공간에 아카이빙됩니다.')
        && deleteModeText.includes('예')
        && deleteModeText.includes('아니오'),
      has_archive_message: deleteModeText.includes('정말 삭제하시겠습니까? 삭제된 내용은 별도 저장 공간에 아카이빙됩니다.'),
      has_yes_no: deleteModeText.includes('예') && deleteModeText.includes('아니오'),
    };
    await page.getByRole('button', { name: '아니오' }).click();

    await page.getByRole('button', { name: /^수정$/u }).first().click();
    await page.waitForFunction(() => document.body.innerText.includes('임대차계약 데이터 수정'), null, { timeout: 10000 });
    const rentHistoryToggle = page.getByRole('button', { name: /임대료 변경 내역/u }).first();
    await rentHistoryToggle.click();
    const collapsedToggleText = await rentHistoryToggle.innerText({ timeout: 10000 });
    await rentHistoryToggle.click();
    const expandedToggleText = await rentHistoryToggle.innerText({ timeout: 10000 });
    const fieldHelpButtonCount = await page.getByRole('button', { name: /설명 보기/u }).count();
    const fieldHelpIconCount = await page.locator('button[title="항목 설명 보기"] img').count();
    await page.getByRole('button', { name: '펀드코드 설명 보기' }).first().click();
    let fieldHelpText = await page.locator('body').innerText({ timeout: 10000 });
    const fundCodeHelpOk = fieldHelpText.includes('샘플 데이터')
      && fieldHelpText.includes('항목별 설명 및 고려사항')
      && fieldHelpText.includes('F22005')
      && fieldHelpText.includes('AURUM 기반');
    await page.getByRole('button', { name: '월 임대료 총액 설명 보기' }).first().click();
    fieldHelpText = await page.locator('body').innerText({ timeout: 10000 });
    const rentHistoryHelpOk = fieldHelpText.includes('1,433,376,000')
      && fieldHelpText.includes('누적 관리');
    bodyText = await page.locator('body').innerText({ timeout: 10000 });
    const customScrollbarCount = await page.locator('.custom-scrollbar').count();
    const editSubmitButtonCount = await page.getByRole('button', { name: '검토 후 정규 DB 반영' }).count();
    const rentGroupStart = bodyText.indexOf('임대료/관리비');
    const rentGroupEnd = rentGroupStart >= 0 ? bodyText.indexOf('권리·보험·특약', rentGroupStart) : -1;
    const rentGroupText = rentGroupStart >= 0 && rentGroupEnd > rentGroupStart ? bodyText.slice(rentGroupStart, rentGroupEnd) : '';
    const requiredRentFields = ['평당 임대료', '평당 관리비', '월 임대료 총액', '월 관리비 총액', '기준일자', '임대료 변동 원인'];
    const requiredRentFieldResults = Object.fromEntries(requiredRentFields.map((text) => [text, rentGroupText.includes(text)]));
    const rfFoUnitOk = /RF\s+[\s\S]*?개월/u.test(rentGroupText) && /FO\s+[\s\S]*?개월/u.test(rentGroupText);
    const fieldHeaderHasDbColumn = /항목\s+(현재값|예시)\s+DB 반영\s+(수정값|입력값)/u.test(bodyText);
    result.mode_checks.event_log = {
      ok: bodyText.includes('계약 변경 반영 이력')
        && !bodyText.includes('계약 변경 승인 대기')
        && !bodyText.includes('QA smoke')
        && !bodyText.includes('smoke_rolled_back'),
      has_change_log_title: bodyText.includes('계약 변경 반영 이력'),
      hides_smoke_rows: !bodyText.includes('QA smoke') && !bodyText.includes('smoke_rolled_back'),
    };
    result.mode_checks.field_table = {
      ok: bodyText.includes('항목')
        && bodyText.includes('단위')
        && bodyText.includes('임대차계약 데이터 수정')
        && bodyText.includes('변경된 항목')
        && ['기본 정보', '임차 구역 및 면적', '계약 일정', '임대료/관리비', '권리·보험·특약', '시설 사양', '임대료 변경 내역'].every((text) => bodyText.includes(text))
        && Object.values(requiredRentFieldResults).every(Boolean)
        && rfFoUnitOk
        && !fieldHeaderHasDbColumn
        && !bodyText.includes('원본 컬럼')
        && !/[A-Z]{2}\.\s/u.test(bodyText)
        && !bodyText.includes('히스토리')
        && editSubmitButtonCount === 1
        && collapsedToggleText.includes('펼치기')
        && expandedToggleText.includes('접기')
        && fieldHelpButtonCount >= 100
        && fieldHelpIconCount >= 100
        && fundCodeHelpOk
        && rentHistoryHelpOk
        && customScrollbarCount > 0,
      has_item_header: bodyText.includes('항목'),
      has_unit_column: bodyText.includes('단위'),
      has_single_submit_button: editSubmitButtonCount === 1,
      edit_submit_button_count: editSubmitButtonCount,
      has_changed_count: bodyText.includes('변경된 항목'),
      rent_group_required_fields: requiredRentFieldResults,
      rent_group_rf_fo_unit_ok: rfFoUnitOk,
      has_group_accordion: collapsedToggleText.includes('펼치기') && expandedToggleText.includes('접기'),
      field_help_button_count: fieldHelpButtonCount,
      field_help_icon_count: fieldHelpIconCount,
      field_help_fund_code_ok: fundCodeHelpOk,
      field_help_rent_history_ok: rentHistoryHelpOk,
      removed_db_column: !fieldHeaderHasDbColumn,
      removed_column_index_prefix: !/[A-Z]{2}\.\s/u.test(bodyText),
      removed_sheet_prefix: !bodyText.includes('DB_일반') && !bodyText.includes('DB_히스토리'),
      removed_history_label: !bodyText.includes('히스토리'),
      custom_scrollbar_count: customScrollbarCount,
    };
    result.forbidden_found = result.forbidden_text.filter((text) => bodyText.includes(text));
    result.forbidden_contexts = Object.fromEntries(result.forbidden_found.map((text) => {
      const index = bodyText.indexOf(text);
      return [text, index >= 0 ? bodyText.slice(Math.max(0, index - 160), index + text.length + 160) : ''];
    }));

    const qualityUrl = joinUrl(baseUrl, '?p=data-quality');
    await page.goto(qualityUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('Data Quality'), null, { timeout: 45000 });
    const qualityText = await page.locator('body').innerText({ timeout: 10000 });
    const qualityCardsOneRow = await page.evaluate(() => {
      const section = [...document.querySelectorAll('section')]
        .find((item) => item.textContent?.includes('데이터 무결성 검사 및 수정 요청'));
      if (!section) return false;
      const grid = [...section.querySelectorAll('.grid')]
        .find((item) => ['총 점검 항목', 'critical', 'warning', 'info', '권한 기준'].every((label) => item.textContent?.includes(label)));
      if (!grid) return false;
      const children = [...grid.children].filter((item) => item.getBoundingClientRect().width > 0);
      if (children.length < 5) return false;
      const firstTop = Math.round(children[0].getBoundingClientRect().top);
      return children.slice(0, 5).every((item) => Math.abs(Math.round(item.getBoundingClientRect().top) - firstTop) <= 2);
    });
    result.mode_checks.data_quality = {
      ok: qualityText.includes('데이터 무결성 검사 및 수정 요청')
        && qualityCardsOneRow
        && DATA_QUALITY_REMOVED_PLAN_TEXTS.every((text) => !qualityText.includes(text))
        && !qualityText.includes('수정 요청 승인 대기')
        && !qualityText.includes('APPROVAL QUEUE'),
      removed_approval_queue: !qualityText.includes('수정 요청 승인 대기') && !qualityText.includes('APPROVAL QUEUE'),
      removed_rebase_plan: DATA_QUALITY_REMOVED_PLAN_TEXTS.every((text) => !qualityText.includes(text)),
      quality_cards_one_row: qualityCardsOneRow,
    };
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.body_excerpt = bodyText.slice(0, 1200);
    result.ok = result.missing_text.length === 0
      && result.forbidden_found.length === 0
      && result.page_errors.length === 0
      && sourceFieldCoverage.ok
      && result.mode_checks.lease_space_sort.ok
      && result.mode_checks.ledger_modal.ok
      && result.mode_checks.add_mode.ok
      && result.mode_checks.delete_modal.ok
      && result.mode_checks.event_log.ok
      && result.mode_checks.field_table.ok
      && result.mode_checks.data_quality.ok;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    if (page) {
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
      result.missing_text = result.required_text.filter((text) => !bodyText.includes(text));
      result.forbidden_found = result.forbidden_text.filter((text) => bodyText.includes(text));
      result.body_excerpt = bodyText.slice(0, 1200);
    }
  } finally {
    if (browser) await browser.close();
    fs.writeFileSync(outJson, JSON.stringify(result, null, 2), 'utf8');
    fs.writeFileSync(latestJson, JSON.stringify(result, null, 2), 'utf8');
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
