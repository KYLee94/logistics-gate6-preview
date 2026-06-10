const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const EDGE_FUNCTION = 'll-dashboard-api';
const DEFAULT_ORIGIN = 'https://kylee94.github.io';
const PY_PER_SQM = 0.3025;
const MISSING_ANSWER_PATTERN = /확인할 수 없습니다|찾지 못|충분하지|근거 데이터|제공 데이터|정보가 없습니다|답변에 필요한 근거|추가적인 데이터/iu;
const INTERNAL_PATTERN = /\bll_[a-z0-9_]+\b|public\.|asset_id|tenant_id|lease_space_id|source[_ -]?cell|source[_ -]?row|provider|fallback|answer_focus|required_facts|required_display_values|readable_asset_count|matched_tables|Edge Function|service role|JWT/iu;

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

function currentKstMonthEndDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeLoose(value) {
  return normalizeText(value).replace(/\s+/gu, '').replace(/[,._·()（）\[\]-]+/gu, '').toLowerCase();
}

function numberValue(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(String(value).replace(/,/gu, '').replace(/[^\d.-]/gu, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function formatWon(value) {
  return `${new Intl.NumberFormat('ko-KR').format(Math.round(value))}원`;
}

function compactWon(value) {
  if (!Number.isFinite(value)) return '';
  if (Math.abs(value) >= 100_000_000) return `${Math.round((value / 100_000_000) * 10) / 10}억`;
  return formatWon(value);
}

function formatPy(value) {
  return `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value)}평`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function rowAreaPy(row = {}) {
  const direct = numberValue(firstDefined(row.leased_area_py, row.leasedAreaPy, row.area_py, row.areaPy));
  if (direct && direct > 0) return direct;
  const sqm = numberValue(firstDefined(row.leased_area_sqm, row.leasedAreaSqm, row.exclusive_area_sqm, row.exclusiveAreaSqm, row.area_sqm, row.areaSqm));
  return sqm && sqm > 0 ? sqm * PY_PER_SQM : 0;
}

function grossAreaPy(asset = {}) {
  const direct = numberValue(firstDefined(asset.gross_floor_area_py, asset.grossFloorAreaPy, asset.total_area_py, asset.totalAreaPy));
  if (direct && direct > 0) return direct;
  const sqm = numberValue(firstDefined(asset.gross_floor_area_sqm, asset.grossFloorAreaSqm, asset.total_area_sqm, asset.totalAreaSqm));
  return sqm && sqm > 0 ? sqm * PY_PER_SQM : 0;
}

function rowMonthlyRent(row = {}) {
  return numberValue(firstDefined(row.current_monthly_rent_total, row.currentMonthlyRentTotal, row.monthly_rent_total, row.monthlyRentTotal)) || 0;
}

function rowMonthlyMf(row = {}) {
  return numberValue(firstDefined(row.current_monthly_mf_total, row.currentMonthlyMfTotal, row.monthly_mf_total, row.monthlyMfTotal)) || 0;
}

function rowMonthlyCombined(row = {}) {
  const combined = numberValue(firstDefined(row.current_monthly_cost_total, row.currentMonthlyCostTotal, row.monthly_cost_total, row.monthlyCostTotal, row.monthly_combined_total, row.monthlyCombinedTotal));
  return combined && combined > 0 ? combined : rowMonthlyRent(row) + rowMonthlyMf(row);
}

function weightedENoc(rows = []) {
  const acc = rows.reduce((sum, row) => {
    const area = rowAreaPy(row);
    const monthly = rowMonthlyCombined(row);
    const stored = numberValue(firstDefined(row.e_noc, row.eNoc, row.average_e_noc, row.averageENoc));
    const value = monthly && area > 0 ? monthly / area : stored;
    if (!value || !area) return sum;
    sum.weighted += value * area;
    sum.area += area;
    return sum;
  }, { weighted: 0, area: 0 });
  return acc.area > 0 ? acc.weighted / acc.area : 0;
}

function summarizeAsset(asset, leaseRows) {
  const gross = grossAreaPy(asset);
  const leased = leaseRows.reduce((sum, row) => sum + rowAreaPy(row), 0);
  const monthlyRent = leaseRows.reduce((sum, row) => sum + rowMonthlyRent(row), 0);
  const monthlyMf = leaseRows.reduce((sum, row) => sum + rowMonthlyMf(row), 0);
  const monthlyCost = leaseRows.reduce((sum, row) => sum + rowMonthlyCombined(row), 0);
  const vacancyArea = Math.max(0, gross - leased);
  return {
    asset,
    leaseRows,
    gross,
    leased,
    vacancyArea,
    vacancyRate: gross > 0 ? vacancyArea / gross : 0,
    monthlyRent,
    monthlyMf,
    monthlyCost,
    eNoc: weightedENoc(leaseRows),
  };
}

function groupRows(rows, keyFn) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!key) return;
    grouped.set(key, [...(grouped.get(key) || []), row]);
  });
  return grouped;
}

function assetName(row = {}) {
  return normalizeText(firstDefined(row.asset_name, row.assetName, row.asset));
}

function isUsefulDisplayName(value) {
  const text = normalizeText(value);
  return Boolean(text && text !== '-' && text !== '미입력' && text !== '없음' && !/^(asset|tenant)[_-]/iu.test(text));
}

function tenantName(row = {}) {
  const text = normalizeText(firstDefined(row.tenant_master_name, row.tenantMasterName, row.tenant_name, row.tenantName, row.company_name, row.companyName, row.raw_tenant_name, row.tenant));
  return isUsefulDisplayName(text) ? text : '';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, retryOptions = {}) {
  const attempts = retryOptions.attempts || 4;
  const retryStatuses = retryOptions.retryStatuses || [429, 502, 503, 504];
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!retryStatuses.includes(response.status) || attempt === attempts) return response;
      await sleep(5000 * attempt);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
      await sleep(5000 * attempt);
    }
  }
  throw lastError || new Error('fetch failed after retries');
}

async function signInForAccessToken(supabaseUrl, anonKey, email, password) {
  const response = await fetchWithRetry(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error(`Supabase Auth login failed (${response.status}): ${body.msg || body.message || body.error || 'unknown auth error'}`);
  }
  return body.access_token;
}

async function resolveAccessToken(supabaseUrl, anonKey) {
  const token = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (token) return { token, source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN' };
  const email = argsValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = argsValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  return { token: await signInForAccessToken(supabaseUrl, anonKey, email, password), source: 'password_grant' };
}

async function invoke(endpoint, anonKey, origin, token, action, payload) {
  const response = await fetchWithRetry(endpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: token ? `Bearer ${token}` : '',
      'content-type': 'application/json',
      origin,
    },
    body: JSON.stringify({ action, payload }),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { status: response.status, ok: response.ok, body };
}

function decorateRows(rows, assetMap, tenantMap) {
  return rows.map((row) => {
    const asset = assetMap.get(normalizeText(row.asset_id));
    const tenant = tenantMap.get(normalizeText(row.tenant_id));
    return {
      ...row,
      asset_name: assetName(row) || assetName(asset),
      tenant_master_name: tenantName(row) || tenantName(tenant),
    };
  });
}

function topTenantsByArea(rows) {
  const grouped = new Map();
  rows.forEach((row) => {
    const name = tenantName(row);
    if (!name) return;
    const current = grouped.get(name) || { tenantName: name, rows: [], area: 0, cost: 0 };
    current.rows.push(row);
    current.area += rowAreaPy(row);
    current.cost += rowMonthlyCombined(row);
    grouped.set(name, current);
  });
  return [...grouped.values()].filter((row) => row.area > 0).sort((a, b) => b.area - a.area || a.tenantName.localeCompare(b.tenantName, 'ko'));
}

function topTenantsByCost(rows) {
  return topTenantsByArea(rows).sort((a, b) => b.cost - a.cost || a.tenantName.localeCompare(b.tenantName, 'ko'));
}

function uniqueBy(values, keyFn) {
  const seen = new Set();
  return values.filter((value) => {
    const key = keyFn(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dateDisplay(value) {
  return normalizeText(value).slice(0, 10);
}

function matchesExpected(answer, expected) {
  const answerText = normalizeText(answer);
  const answerLoose = normalizeLoose(answerText);
  const raw = normalizeText(expected.value || expected);
  if (!raw) return true;
  if (answerText.includes(raw) || answerLoose.includes(normalizeLoose(raw))) return true;
  if (expected.kind === 'money') {
    const value = numberValue(expected.number);
    return value !== null && [formatWon(value), compactWon(value)].some((item) => answerText.includes(item) || answerLoose.includes(normalizeLoose(item)));
  }
  if (expected.kind === 'area') {
    const value = numberValue(expected.number);
    return value !== null && answerLoose.includes(normalizeLoose(formatPy(value)));
  }
  if (expected.kind === 'percent') {
    const value = numberValue(expected.number);
    if (value === null) return false;
    if (answerLoose.includes(normalizeLoose(formatPercent(value)))) return true;
    const expectedPercent = value * 100;
    const percentages = [...answerText.matchAll(/([0-9][0-9,]*(?:\.[0-9]+)?)\s*%/gu)]
      .map((match) => Number(match[1].replace(/,/gu, '')))
      .filter((item) => Number.isFinite(item));
    return percentages.some((item) => Math.abs(item - expectedPercent) <= 0.05);
  }
  if (expected.kind === 'date') {
    const date = dateDisplay(raw);
    const dateLoose = date.replace(/-/gu, '');
    return answerLoose.includes(dateLoose) || answerLoose.includes(date.replace(/-/gu, '.')) || answerLoose.includes(date.replace(/-/gu, ''));
  }
  return false;
}

function validateAnswer(testCase, result) {
  if (result.status !== 200) return [`HTTP ${result.status}`];
  if (result.body?.ok !== true) return ['ok=false'];
  const answer = normalizeText(result.body?.answer);
  const failures = [];
  if (!answer) failures.push('empty answer');
  if (INTERNAL_PATTERN.test(JSON.stringify(result.body))) failures.push('internal detail exposed');
  if (testCase.mustAnswer !== false && MISSING_ANSWER_PATTERN.test(answer)) failures.push('answer says data is missing');
  (testCase.expect || []).forEach((expected) => {
    if (!matchesExpected(answer, expected)) failures.push(`missing expected: ${normalizeText(expected.label || expected.value || expected)}`);
  });
  (testCase.expectAny || []).forEach((group, index) => {
    if (!group.some((expected) => matchesExpected(answer, expected))) failures.push(`missing any expected group ${index + 1}`);
  });
  return failures;
}

function addCase(cases, input) {
  if (cases.length >= 100) return;
  cases.push({
    id: `qa100_${String(cases.length + 1).padStart(3, '0')}_${input.id}`,
    ...input,
  });
}

function buildCases(model) {
  const cases = [];
  const { assets, summaries, allLeaseRows, allTenantsByArea, allTenantsByCost, leases, rentHistory } = model;
  const focusAssets = uniqueBy([
    ...summaries.sort((a, b) => b.monthlyCost - a.monthlyCost).slice(0, 4),
    ...summaries.sort((a, b) => b.leased - a.leased).slice(0, 4),
    ...summaries.sort((a, b) => b.vacancyRate - a.vacancyRate).slice(0, 4),
  ], (row) => assetName(row.asset)).slice(0, 6);
  const compareAssets = focusAssets.slice(0, 4);
  const focusTenants = uniqueBy([
    ...allTenantsByArea.slice(0, 6),
    ...allTenantsByCost.slice(0, 6),
    ...allTenantsByArea.filter((row) => /쿠팡/u.test(row.tenantName)),
  ], (row) => row.tenantName).slice(0, 6);
  const leaseFocus = leases
    .filter((row) => tenantName(row) && assetName(row))
    .filter((row) => firstDefined(row.current_end_date, row.first_end_date) || firstDefined(row.current_start_date, row.first_start_date))
    .slice(0, 8);
  const leaseTermFocus = leases
    .filter((row) => tenantName(row) && assetName(row))
    .filter((row) => firstDefined(row.rf_months, row.fo_months, row.rent_escalation_rate, row.escalation_cycle_months))
    .slice(0, 6);
  const rentFocus = rentHistory
    .filter((row) => tenantName(row) && assetName(row))
    .filter((row) => row.effective_date && (rowMonthlyRent(row) > 0 || rowMonthlyMf(row) > 0 || row.rent_per_py || row.mf_per_py))
    .slice(0, 8);
  const portfolioMonthlyCost = allLeaseRows.reduce((sum, row) => sum + rowMonthlyCombined(row), 0);
  const portfolioRent = allLeaseRows.reduce((sum, row) => sum + rowMonthlyRent(row), 0);
  const portfolioMf = allLeaseRows.reduce((sum, row) => sum + rowMonthlyMf(row), 0);
  const portfolioLeased = allLeaseRows.reduce((sum, row) => sum + rowAreaPy(row), 0);
  const portfolioGross = assets.reduce((sum, row) => sum + grossAreaPy(row), 0);
  const portfolioVacancyRate = portfolioGross > 0 ? Math.max(0, portfolioGross - portfolioLeased) / portfolioGross : 0;
  const portfolioENoc = weightedENoc(allLeaseRows);

  focusAssets.forEach((summary, index) => {
    addCase(cases, {
      id: `asset_exists_${index}`,
      category: '자산 존재/기본정보',
      question: `${assetName(summary.asset)} 있어?`,
      expect: [assetName(summary.asset)],
    });
    addCase(cases, {
      id: `asset_fund_address_${index}`,
      category: '자산 존재/기본정보',
      question: `${assetName(summary.asset)} 펀드랑 주소 알려줘`,
      expect: [assetName(summary.asset), normalizeText(summary.asset.fund_name || summary.asset.fundName || ''), normalizeText(summary.asset.address || '')].filter(Boolean),
    });
  });

  focusAssets.forEach((summary, index) => {
    addCase(cases, {
      id: `asset_area_${index}`,
      category: '자산 면적',
      question: `${assetName(summary.asset)} 총 연면적과 임대면적 알려줘`,
      expect: [assetName(summary.asset), { label: '총 연면적', kind: 'area', number: summary.gross }, { label: '임대면적', kind: 'area', number: summary.leased }],
    });
    addCase(cases, {
      id: `asset_vacancy_rate_${index}`,
      category: '공실률',
      question: `${assetName(summary.asset)} 공실률 얼마야?`,
      expect: [assetName(summary.asset), { label: '공실률', kind: 'percent', number: summary.vacancyRate }],
    });
    addCase(cases, {
      id: `asset_vacancy_area_${index}`,
      category: '공실면적',
      question: `${assetName(summary.asset)} 공실면적은 몇 평이야?`,
      expect: [assetName(summary.asset), { label: '공실면적', kind: 'area', number: summary.vacancyArea }],
    });
  });

  focusAssets.forEach((summary, index) => {
    addCase(cases, {
      id: `asset_monthly_cost_${index}`,
      category: '월 임관리비',
      question: `${assetName(summary.asset)} 월 임관리비 총액 얼마야?`,
      expect: [assetName(summary.asset), { label: '월 임관리비', kind: 'money', number: summary.monthlyCost }],
    });
    addCase(cases, {
      id: `asset_rent_mf_split_${index}`,
      category: '월 임대료/관리비',
      question: `${assetName(summary.asset)} 월 임대료랑 월 관리비 각각 알려줘`,
      expect: [assetName(summary.asset), { label: '월 임대료', kind: 'money', number: summary.monthlyRent }, { label: '월 관리비', kind: 'money', number: summary.monthlyMf }],
    });
    addCase(cases, {
      id: `asset_enoc_${index}`,
      category: 'E. NOC',
      question: `${assetName(summary.asset)} E. NOC 얼마야?`,
      expect: [assetName(summary.asset), { label: 'E. NOC', kind: 'money', number: summary.eNoc }],
    });
  });

  focusTenants.forEach((tenant, index) => {
    const tenantAssets = [...new Set(tenant.rows.map(assetName).filter(Boolean))];
    addCase(cases, {
      id: `tenant_assets_${index}`,
      category: '임차인/회사 질문',
      question: `${tenant.tenantName}이 임차하고 있는 물류센터는 뭐뭐야?`,
      expect: [tenant.tenantName, ...tenantAssets.slice(0, 2)],
    });
    addCase(cases, {
      id: `tenant_area_${index}`,
      category: '특정 임차인의 임차 면적',
      question: `${tenant.tenantName} 전체 임차 면적은 몇 평이야?`,
      expect: [tenant.tenantName, { label: '임차면적', kind: 'area', number: tenant.area }],
    });
    addCase(cases, {
      id: `tenant_monthly_cost_${index}`,
      category: '특정 임차인의 월 임관리비',
      question: `${tenant.tenantName} 월 임관리비 합계는 얼마야?`,
      expect: [tenant.tenantName, { label: '월 임관리비', kind: 'money', number: tenant.cost }],
    });
  });

  [
    ['portfolio_asset_count', '전체 읽기 가능한 자산 수는 몇 개야?', [String(assets.length)]],
    ['portfolio_gross_area', '전체 물류센터 총 연면적은 몇 평이야?', [{ label: '총 연면적', kind: 'area', number: portfolioGross }]],
    ['portfolio_leased_area', '전체 물류센터 임대면적 합계는 몇 평이야?', [{ label: '임대면적', kind: 'area', number: portfolioLeased }]],
    ['portfolio_vacancy_rate', '전체 물류센터 평균 공실률은 얼마야?', [{ label: '공실률', kind: 'percent', number: portfolioVacancyRate }]],
    ['portfolio_monthly_cost', '전체 물류센터 월 임관리비 합계는 얼마야?', [{ label: '월 임관리비', kind: 'money', number: portfolioMonthlyCost }]],
    ['portfolio_rent_mf', '전체 물류센터 월 임대료와 관리비를 나눠서 알려줘', [{ label: '월 임대료', kind: 'money', number: portfolioRent }, { label: '월 관리비', kind: 'money', number: portfolioMf }]],
    ['portfolio_enoc', '전체 물류센터 평균 E. NOC는 얼마야?', [{ label: 'E. NOC', kind: 'money', number: portfolioENoc }]],
    ['portfolio_top_tenant_area', '전체 물류센터 다 합쳐서 임차인 중에 누가 제일 면적 많이 차지하고 있어?', [allTenantsByArea[0]?.tenantName, { label: '임차면적', kind: 'area', number: allTenantsByArea[0]?.area }]],
    ['portfolio_top_tenant_cost', '전체 물류센터에서 월 임관리비를 가장 많이 내는 임차인은 누구야?', [allTenantsByCost[0]?.tenantName, { label: '월 임관리비', kind: 'money', number: allTenantsByCost[0]?.cost }]],
    ['portfolio_top_asset_area', '전체 자산 중 임대면적이 제일 큰 물류센터는 어디야?', [summaries.sort((a, b) => b.leased - a.leased)[0] && assetName(summaries.sort((a, b) => b.leased - a.leased)[0].asset)]],
    ['portfolio_top_asset_cost', '전체 자산 중 월 임관리비가 제일 큰 물류센터는 어디야?', [summaries.sort((a, b) => b.monthlyCost - a.monthlyCost)[0] && assetName(summaries.sort((a, b) => b.monthlyCost - a.monthlyCost)[0].asset)]],
    ['portfolio_top_asset_vacancy', '전체 자산 중 공실률이 제일 높은 물류센터는 어디야?', [summaries.sort((a, b) => b.vacancyRate - a.vacancyRate)[0] && assetName(summaries.sort((a, b) => b.vacancyRate - a.vacancyRate)[0].asset)]],
  ].forEach(([id, question, expect]) => addCase(cases, { id, category: '전체 포트폴리오 값/순위', question, expect: expect.filter(Boolean) }));

  leaseFocus.forEach((lease, index) => {
    const endDate = firstDefined(lease.current_end_date, lease.first_end_date);
    const startDate = firstDefined(lease.current_start_date, lease.first_start_date);
    if (endDate) {
      addCase(cases, {
        id: `lease_end_date_${index}`,
        category: '계약 기간/만기',
        question: `${assetName(lease)} ${tenantName(lease)} 계약 만기일 알려줘`,
        expect: [assetName(lease), tenantName(lease), { label: '계약 만기', kind: 'date', value: endDate }],
      });
    }
    if (startDate) {
      addCase(cases, {
        id: `lease_start_date_${index}`,
        category: '계약 기간/만기',
        question: `${assetName(lease)} ${tenantName(lease)} 계약 시작일 알려줘`,
        expect: [assetName(lease), tenantName(lease), { label: '계약 시작', kind: 'date', value: startDate }],
      });
    }
  });

  leaseTermFocus.slice(0, 4).forEach((lease, index) => {
    addCase(cases, {
      id: `lease_terms_rf_fo_${index}`,
      category: '계약 조건',
      question: `${assetName(lease)} ${tenantName(lease)} RF랑 FO 몇 개월이야?`,
      expect: [assetName(lease), tenantName(lease), normalizeText(lease.rf_months), normalizeText(lease.fo_months)].filter(Boolean),
    });
    addCase(cases, {
      id: `lease_escalation_${index}`,
      category: '계약 조건',
      question: `${assetName(lease)} ${tenantName(lease)} 임대료 상승률이랑 상승 주기 알려줘`,
      expect: [assetName(lease), tenantName(lease), normalizeText(lease.rent_escalation_rate), normalizeText(lease.escalation_cycle_months)].filter(Boolean),
    });
  });

  rentFocus.forEach((row, index) => {
    addCase(cases, {
      id: `rent_history_amount_${index}`,
      category: '임대료 변경 이력',
      question: `${assetName(row)} ${tenantName(row)} 임대료 변경 이력의 기준일자와 월 임대료 알려줘`,
      expect: [assetName(row), tenantName(row), { label: '기준일자', kind: 'date', value: row.effective_date }, { label: '월 임대료', kind: 'money', number: rowMonthlyRent(row) }],
    });
  });
  rentFocus.slice(0, 2).forEach((row, index) => {
    addCase(cases, {
      id: `rent_history_per_py_${index}`,
      category: '임대료 변경 이력',
      question: `${assetName(row)} ${tenantName(row)} 평당 임대료와 평당 관리비는 얼마야?`,
      expect: [assetName(row), tenantName(row), normalizeText(row.rent_per_py), normalizeText(row.mf_per_py)].filter(Boolean),
    });
  });

  for (let index = 0; index < compareAssets.length - 1; index += 1) {
    const left = compareAssets[index];
    const right = compareAssets[index + 1];
    [
      ['compare_vacancy', '공실률', { kind: 'percent', number: left.vacancyRate }, { kind: 'percent', number: right.vacancyRate }],
      ['compare_monthly_cost', '월 임관리비', { kind: 'money', number: left.monthlyCost }, { kind: 'money', number: right.monthlyCost }],
      ['compare_enoc', 'E. NOC', { kind: 'money', number: left.eNoc }, { kind: 'money', number: right.eNoc }],
    ].forEach(([id, metric, leftExpected, rightExpected]) => {
      addCase(cases, {
        id: `${id}_${index}`,
        category: '복수 자산 비교',
        question: `${assetName(left.asset)}와 ${assetName(right.asset)} ${metric} 비교해줘`,
        expect: [assetName(left.asset), assetName(right.asset), leftExpected, rightExpected],
      });
    });
  }

  focusTenants.slice(0, 4).forEach((tenant, index) => {
    const firstAsset = tenant.rows[0] ? assetName(tenant.rows[0]) : '';
    addCase(cases, {
      id: `followup_tenant_area_${index}`,
      category: '이전 대화 맥락 follow-up',
      question: '그 임차인의 임차 면적은?',
      history: [
        { role: 'user', content: `${tenant.tenantName}이 임차하고 있는 물류센터 알려줘` },
        { role: 'assistant', content: `${tenant.tenantName}은 ${firstAsset}에 임차 중입니다.` },
      ],
      expect: [tenant.tenantName, { label: '임차면적', kind: 'area', number: tenant.area }],
    });
  });

  while (cases.length < 100) {
    const summary = summaries[cases.length % summaries.length];
    addCase(cases, {
      id: `asset_operations_extra_${cases.length}`,
      category: '자산 운영현황',
      question: `${assetName(summary.asset)} 운영 현황 요약해줘`,
      expect: [assetName(summary.asset), { label: '임대면적', kind: 'area', number: summary.leased }],
    });
  }
  return cases.slice(0, 100);
}

async function main() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const origin = argsValue('origin', DEFAULT_ORIGIN);
  const basisDate = argsValue('basis-date', envValue('LOGISTICS_BASIS_DATE') || currentKstMonthEndDate());
  const caseDelayMs = Number(argsValue('case-delay-ms', envValue('LOGISTICS_AI_QA100_CASE_DELAY_MS') || 2200)) || 0;
  const startIndex = Math.max(0, Number(argsValue('start-index', '0')) || 0);
  const maxCases = Math.max(0, Number(argsValue('max-cases', '0')) || 0);
  const listOnly = process.argv.includes('--list-only');
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase URL or anon key.');
  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
  const auth = await resolveAccessToken(supabaseUrl, anonKey);
  const homeRead = await invoke(endpoint, anonKey, origin, auth.token, 'dashboard/home/read', { basis_date: basisDate });
  if (homeRead.status !== 200 || homeRead.body?.ok === false) throw new Error(`dashboard/home/read failed: ${homeRead.status}`);
  const data = homeRead.body?.data || {};
  const assets = data.assets || [];
  const tenants = data.tenants || [];
  const assetMap = new Map(assets.map((row) => [normalizeText(row.asset_id), row]));
  const tenantMap = new Map(tenants.map((row) => [normalizeText(row.tenant_id), row]));
  const leaseSpaces = decorateRows(data.lease_spaces || [], assetMap, tenantMap);
  const leases = decorateRows(data.leases || [], assetMap, tenantMap);
  const rentHistory = decorateRows(data.rent_history || [], assetMap, tenantMap);
  const spacesByAsset = groupRows(leaseSpaces, (row) => normalizeText(row.asset_id));
  const summaries = assets
    .map((asset) => summarizeAsset(asset, spacesByAsset.get(normalizeText(asset.asset_id)) || []))
    .filter((row) => assetName(row.asset));
  const model = {
    assets,
    summaries,
    allLeaseRows: leaseSpaces,
    allTenantsByArea: topTenantsByArea(leaseSpaces),
    allTenantsByCost: topTenantsByCost(leaseSpaces),
    leases,
    rentHistory,
  };
  const allCases = buildCases(model);
  const cases = maxCases > 0 ? allCases.slice(startIndex, startIndex + maxCases) : allCases.slice(startIndex);
  const results = [];
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outJson = path.join(OUT_DIR, `ai-chatbot-qa-100-${timestampForFile()}.json`);
  const latestJson = path.join(OUT_DIR, 'ai-chatbot-qa-100-latest.json');
  function writeOutput(final = false) {
    const byCategory = {};
    results.forEach((row) => {
      byCategory[row.category] = byCategory[row.category] || { total: 0, passed: 0, failed: 0 };
      byCategory[row.category].total += 1;
      if (row.ok) byCategory[row.category].passed += 1;
      else byCategory[row.category].failed += 1;
    });
    const output = {
      ok: listOnly ? true : final && results.length === cases.length && results.every((row) => row.ok),
      complete: final && results.length === cases.length,
      generated_at: new Date().toISOString(),
      origin,
      basis_date: basisDate,
      auth_source: auth.source,
      question_count: cases.length,
      total_question_count: allCases.length,
      start_index: startIndex,
      max_cases: maxCases || null,
      tested_count: results.length,
      passed_count: results.filter((row) => row.ok).length,
      failed_count: results.filter((row) => !row.ok).length,
      by_category: byCategory,
      questions: cases.map((item) => ({
        id: item.id,
        category: item.category,
        question: item.question,
        expected: item.expect || [],
      })),
      results,
    };
    fs.writeFileSync(outJson, JSON.stringify(output, null, 2), 'utf8');
    fs.writeFileSync(latestJson, JSON.stringify(output, null, 2), 'utf8');
    return output;
  }
  if (!listOnly) {
    for (const testCase of cases) {
      let result = null;
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        result = await invoke(endpoint, anonKey, origin, auth.token, 'ai/search-chat', {
          question: testCase.question,
          history: testCase.history || [],
          basis_date: basisDate,
          qa_sample: true,
          model_override: 'gemini-2.0-flash',
        });
        if (![429, 502, 503].includes(result.status)) break;
        if (attempt < 4) await sleep(5000 * attempt);
      }
      const failures = validateAnswer(testCase, result);
      results.push({
        id: testCase.id,
        category: testCase.category,
        question: testCase.question,
        expected: testCase.expect || [],
        status: result?.status || 0,
        ok: failures.length === 0,
        failures,
        answer: normalizeText(result?.body?.answer),
      });
      writeOutput(false);
      if (caseDelayMs > 0) await sleep(caseDelayMs);
    }
  }
  const output = writeOutput(true);
  console.log(JSON.stringify({
    ok: output.ok,
    generated_at: output.generated_at,
    question_count: output.question_count,
    tested_count: output.tested_count,
    passed_count: output.passed_count,
    failed_count: output.failed_count,
    by_category: output.by_category,
    failed_samples: output.results.filter((row) => !row.ok).slice(0, 20),
    artifact: outJson,
  }, null, 2));
  if (!listOnly && !output.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
