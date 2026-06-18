const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const WORKBOOK_PATH = path.join(ROOT, 'qa-artifacts', 'logistics-gate6', 'source-workbook-ingest', 'storage-upload', 'source-workbook.xlsx');

const CAPITAL_PERIODS = ['2022 2H', '2023 1H', '2023 2H', '2024 1Q', '2024 2Q', '2024 3Q', '2024 4Q', '2025 1Q', '2025 2Q', '2025 3Q', '2025 4Q', '2026 1Q'];
const LOCAL_PERIODS = ['2024 1Q', '2025 1Q', '2025 2Q', '2025 3Q', '2025 4Q', '2026 1Q'];
const CAPITAL_REGIONS = ['동남권', '남부권', '중앙권', '서부권', '서북권', '수도권 기타권', '평균'];
const LOCAL_REGIONS = ['경남권', '충청권', '전라권', '경북권', '지방 기타권', '평균'];
const SIZE_BUCKETS = ['소형', '중형', '대형', '초대형', '평균'];
const SUPPLY_CAPITAL = ['동남권', '남부권', '중앙권', '서부권', '서북권', '수도권 기타권', '소계'];
const SUPPLY_LOCAL = ['경남권', '충청권', '전라권', '경북권', '지방 기타권', '소계'];
const SENTINEL_KEY = 'lease|수도권|2026 1Q|복합 상온|rent_manwon_per_py|region|동남권';
const SENTINEL_EXPECTED = 3.0361600000000006;

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

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function text(value, fallback = '') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).trim();
}

function numberOrNull(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function periodKey(value) {
  return text(value).replace(/\s+/gu, '');
}

function metricKey(label) {
  const source = text(label).replace(/\s+/gu, '');
  if (source.includes('보증금')) return 'deposit_manwon_per_py';
  if (source.includes('임대료')) return 'rent_manwon_per_py';
  if (source.includes('관리비')) return 'management_fee_manwon_per_py';
  if (source.includes('렌트프리_공실률') || source.includes('렌트프리공실률')) return 'rent_free_vacancy_10';
  if (source.includes('렌트프리')) return 'rent_free_months_per_year';
  if (source.includes('공실률')) return 'vacancy_rate';
  return '';
}

function metricLabel(key, fallback) {
  return {
    deposit_manwon_per_py: '보증금(만원/평)',
    rent_manwon_per_py: '임대료(만원/평)',
    management_fee_manwon_per_py: '관리비(만원/평)',
    rent_free_months_per_year: '렌트프리(개월/년)',
    rent_free_vacancy_10: '렌트프리_공실률 10% 이상(개월/년)',
    vacancy_rate: '공실률(%)',
  }[key] || text(fallback);
}

function cell(ws, row1, col1) {
  return ws[XLSX.utils.encode_cell({ r: row1 - 1, c: col1 - 1 })]?.v;
}

function parseLeaseSection(ws, { scope, startRow, endRow, periods, blockWidth, regionLabels }) {
  const out = [];
  let category = '';
  let subcategory = '';
  for (let row = startRow; row <= endRow; row += 1) {
    const rawCategory = text(cell(ws, row, 2));
    const rawSubOrMetric = text(cell(ws, row, 3));
    const rawMetric = text(cell(ws, row, 4));
    if (rawCategory.startsWith('*') || rawCategory === '구분' || rawCategory.includes('권역별')) continue;
    let currentMetric = '';
    if (rawMetric) {
      if (rawCategory) category = rawCategory;
      if (rawSubOrMetric) subcategory = rawSubOrMetric;
      currentMetric = rawMetric;
    } else {
      if (rawCategory) {
        category = rawCategory;
        subcategory = '';
      }
      currentMetric = rawSubOrMetric;
    }
    const key = metricKey(currentMetric);
    if (!key || !category) continue;
    const segment = category === '복합' && subcategory ? `${category} ${subcategory}` : category;
    for (let block = 0; block < periods.length; block += 1) {
      for (let offset = 0; offset < blockWidth; offset += 1) {
        const col = 5 + block * blockWidth + offset;
        const value = numberOrNull(cell(ws, row, col));
        if (value === null) continue;
        const isRegion = offset < regionLabels.length;
        const label = isRegion ? regionLabels[offset] : SIZE_BUCKETS[offset - regionLabels.length];
        if (!label) continue;
        out.push({
          key: ['lease', scope, periods[block], segment, key, isRegion ? 'region' : 'size', label].join('|'),
          scope,
          period_label: periods[block],
          period_key: periodKey(periods[block]),
          segment_label: segment,
          metric_key: key,
          metric_label: metricLabel(key, currentMetric),
          dimension_type: isRegion ? 'region' : 'size',
          label,
          region: isRegion && label !== '평균' ? label : null,
          is_average: label === '평균',
          value,
        });
      }
    }
  }
  return out;
}

function parseLeaseWorkbook(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  return [
    ...parseLeaseSection(ws, { scope: '수도권', startRow: 8, endRow: 49, periods: CAPITAL_PERIODS, blockWidth: 12, regionLabels: CAPITAL_REGIONS }),
    ...parseLeaseSection(ws, { scope: '지방', startRow: 56, endRow: 96, periods: LOCAL_PERIODS, blockWidth: 11, regionLabels: LOCAL_REGIONS }),
  ];
}

function parseSupplyWorkbook(wb) {
  const ws = wb.Sheets[wb.SheetNames[3]];
  const out = [];
  let newYear = '';
  let cumulativeYear = '';
  for (let row = 6; row <= 71; row += 1) {
    if (text(cell(ws, row, 2))) newYear = text(cell(ws, row, 2));
    if (text(cell(ws, row, 19))) cumulativeYear = text(cell(ws, row, 19));
    const newQuarter = text(cell(ws, row, 3));
    const cumulativeQuarter = text(cell(ws, row, 20));
    const push = (seriesType, scope, label, value, periodLabel) => {
      const numeric = numberOrNull(value);
      if (numeric === null || !periodLabel || !label) return;
      out.push({
        key: ['supply', seriesType, periodLabel, scope, label].join('|'),
        series_type: seriesType,
        scope,
        period_label: periodLabel,
        period_key: periodKey(periodLabel),
        label,
        value: numeric,
      });
    };
    SUPPLY_CAPITAL.forEach((label, index) => push('new_supply', '수도권', label, cell(ws, row, 4 + index), [newYear, newQuarter].filter(Boolean).join(' ')));
    SUPPLY_LOCAL.forEach((label, index) => push('new_supply', '지방', label, cell(ws, row, 11 + index), [newYear, newQuarter].filter(Boolean).join(' ')));
    push('new_supply', '전체', '합계', cell(ws, row, 17), [newYear, newQuarter].filter(Boolean).join(' '));
    SUPPLY_CAPITAL.forEach((label, index) => push('cumulative_supply', '수도권', label, cell(ws, row, 21 + index), [cumulativeYear, cumulativeQuarter].filter(Boolean).join(' ')));
    SUPPLY_LOCAL.forEach((label, index) => push('cumulative_supply', '지방', label, cell(ws, row, 28 + index), [cumulativeYear, cumulativeQuarter].filter(Boolean).join(' ')));
    push('cumulative_supply', '전체', '합계', cell(ws, row, 34), [cumulativeYear, cumulativeQuarter].filter(Boolean).join(' '));
  }
  return out;
}

async function signIn(supabaseUrl, anonKey) {
  const accessToken = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (accessToken) return { token: accessToken, source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN' };
  const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or set LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error(`Supabase Auth login failed (${response.status}).`);
  return { token: body.access_token, source: 'password_grant' };
}

async function invoke(supabaseUrl, anonKey, token) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action: 'sector-market/read', payload: { limit: 12000 } }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) throw new Error(`sector-market/read failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
  return body.data || {};
}

function compareRows(excelRows, apiRows, tolerance = 0.000001) {
  const apiByKey = new Map(apiRows.map((row) => [row.key, row]));
  const excelKeys = new Set(excelRows.map((row) => row.key));
  const mismatches = [];
  let matched = 0;
  excelRows.forEach((excel) => {
    const actual = apiByKey.get(excel.key);
    if (!actual) {
      mismatches.push({ type: 'missing_api_row', key: excel.key, expected: excel });
      return;
    }
    matched += 1;
    if (Math.abs(Number(excel.value) - Number(actual.value)) > tolerance) {
      mismatches.push({ type: 'value_mismatch', key: excel.key, expected_value: excel.value, actual_value: actual.value, expected: excel, actual });
    }
  });
  apiRows.forEach((api) => {
    if (!excelKeys.has(api.key)) mismatches.push({ type: 'extra_api_row', key: api.key, actual: api });
  });
  return { checked: excelRows.length, matched, mismatches };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(WORKBOOK_PATH)) throw new Error(`Workbook not found: ${WORKBOOK_PATH}`);
  const wb = XLSX.readFile(WORKBOOK_PATH, { cellDates: false });
  const excelLeaseRows = parseLeaseWorkbook(wb);
  const excelSupplyRows = parseSupplyWorkbook(wb);
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  const auth = await signIn(supabaseUrl, anonKey);
  const data = await invoke(supabaseUrl, anonKey, auth.token);
  const apiLeaseRows = (data.views?.lease?.statistics_rows || []).map((row) => ({
    ...row,
    key: ['lease', row.scope, row.period_label, row.segment_label, row.metric_key, row.dimension_type, row.label].join('|'),
  }));
  const apiSupplyRows = (data.views?.supply?.statistics_rows || []).map((row) => ({
    ...row,
    key: ['supply', row.series_type, row.period_label, row.scope, row.label].join('|'),
  }));
  const leaseCompare = compareRows(excelLeaseRows, apiLeaseRows);
  const supplyCompare = compareRows(excelSupplyRows, apiSupplyRows);
  const sentinel = apiLeaseRows.find((row) => row.key === SENTINEL_KEY);
  const sentinelOk = Math.abs(Number(sentinel?.value) - SENTINEL_EXPECTED) < 0.000001;
  const report = {
    ok: leaseCompare.mismatches.length === 0 && supplyCompare.mismatches.length === 0 && sentinelOk,
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    workbook: WORKBOOK_PATH,
    sentinel: {
      key: SENTINEL_KEY,
      expected: SENTINEL_EXPECTED,
      actual: sentinel?.value ?? null,
      ok: sentinelOk,
    },
    summary: {
      excel_lease_rows: excelLeaseRows.length,
      api_lease_rows: apiLeaseRows.length,
      excel_supply_rows: excelSupplyRows.length,
      api_supply_rows: apiSupplyRows.length,
      lease_mismatches: leaseCompare.mismatches.length,
      supply_mismatches: supplyCompare.mismatches.length,
    },
    lease_compare: leaseCompare,
    supply_compare: supplyCompare,
  };
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `market-data-parity-audit-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'market-data-parity-audit-latest.json');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, artifact: outJson, summary: report.summary, sentinel: report.sentinel }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
