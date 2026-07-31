const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { hasFlag, marketReadPayload } = require('./logistics-market-data-egress-contract.cjs');
const { parseSourceWorkbook } = require('../ingest/logistics-source-workbook-ingest.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const LEGACY_WORKBOOK_PATH = path.join(ROOT, 'qa-artifacts', 'logistics-gate6', 'source-workbook-ingest', 'storage-upload', 'source-workbook.xlsx');
const EXTRACTED_WORKBOOK_PATH = path.join(ROOT, 'qa-artifacts', 'logistics-gate6', 'source-workbook-ingest', 'source-workbook-ingest-sector_market-2026Q1.extracted.json');
const DEFAULT_WORKBOOK_PATH = path.join(
  'C:\\Users\\10524\\Desktop\\codex_realasset\\Project\\03_Logi_Leasing_Dashboard',
  '물류 시장 데이터_20261Q.xlsx',
);

const CAPITAL_PERIODS = ['2022 2H', '2023 1H', '2023 2H', '2024 1Q', '2024 2Q', '2024 3Q', '2024 4Q', '2025 1Q', '2025 2Q', '2025 3Q', '2025 4Q', '2026 1Q'];
const LOCAL_PERIODS = ['2024 1Q', '2025 1Q', '2025 2Q', '2025 3Q', '2025 4Q', '2026 1Q'];
const CAPITAL_REGIONS = ['동남권', '남부권', '중앙권', '서부권', '서북권', '수도권 기타권', '평균'];
const LOCAL_REGIONS = ['경남권', '충청권', '전라권', '경북권', '지방 기타권', '평균'];
const SIZE_BUCKETS = ['소형', '중형', '대형', '초대형', '평균'];
const SUPPLY_CAPITAL = ['동남권', '남부권', '중앙권', '서부권', '서북권', '수도권 기타권', '소계'];
const SUPPLY_LOCAL = ['경남권', '충청권', '전라권', '경북권', '지방 기타권', '소계'];
const SENTINEL_KEY = 'lease|수도권|2026 1Q|복합 상온|rent_manwon_per_py|region|동남권';
const SENTINEL_EXPECTED = 3.0361600000000006;
const EXPECTED_CAP_RATE_ROWS = 84;

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

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function resolveWorkbookPath() {
  const explicit = argValue('workbook', envValue('LOGISTICS_MARKET_WORKBOOK'));
  const candidates = [explicit, DEFAULT_WORKBOOK_PATH, LEGACY_WORKBOOK_PATH]
    .filter(Boolean)
    .map((candidate) => path.resolve(candidate));
  const workbookPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!workbookPath) {
    throw new Error(`Workbook not found. Checked: ${candidates.join(', ')}`);
  }
  return workbookPath;
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

function quarterKey(value) {
  const source = text(value).toUpperCase().replace(/\s+/gu, '');
  const match = source.match(/^Q?([1-4])Q?$/u);
  return match ? `Q${match[1]}` : source;
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

function parseCapRateWorkbook(wb) {
  const ws = wb.Sheets[wb.SheetNames[7]];
  const out = [];
  let currentYear = '';
  for (let row = 6; row <= 230; row += 1) {
    const marker = text(cell(ws, row, 2));
    if (marker.charCodeAt(0) === 8251) break;
    const yearCell = numberOrNull(cell(ws, row, 2));
    if (yearCell) currentYear = String(yearCell);
    const quarter = quarterKey(cell(ws, row, 3));
    const capitalValue = numberOrNull(cell(ws, row, 4));
    const nationalValue = numberOrNull(cell(ws, row, 5));
    if (!currentYear || !quarter || (capitalValue === null && nationalValue === null)) continue;
    if (capitalValue !== null) {
      out.push({
        key: ['cap_rate', currentYear, quarter, 'capital_area'].join('|'),
        report_year: Number(currentYear),
        report_quarter: quarter,
        region_key: 'capital_area',
        value: capitalValue,
        source_row: row,
      });
    }
    if (nationalValue !== null) {
      out.push({
        key: ['cap_rate', currentYear, quarter, 'national'].join('|'),
        report_year: Number(currentYear),
        report_quarter: quarter,
        region_key: 'national',
        value: nationalValue,
        source_row: row,
      });
    }
  }
  return out;
}

function capRateRegionKey(value) {
  const label = text(value).toLowerCase();
  if (label.includes('수도권') || label.includes('capital')) return 'capital_area';
  if (label.includes('전국') || label.includes('national')) return 'national';
  return label;
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

async function invoke(supabaseUrl, anonKey, token, payload) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action: 'sector-market/read', payload }),
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

function compareHashRows(excelRows, apiRows) {
  const apiByKey = new Map(apiRows.map((row) => [row.key, row]));
  const excelKeys = new Set(excelRows.map((row) => row.key));
  const mismatches = [];
  let matched = 0;
  excelRows.forEach((excel) => {
    const actual = apiByKey.get(excel.key);
    if (!actual) {
      mismatches.push({ type: 'missing_api_row_hash', key: excel.key, expected_hash: excel.row_hash });
      return;
    }
    matched += 1;
    if (excel.row_hash !== actual.row_hash) {
      mismatches.push({ type: 'row_hash_mismatch', key: excel.key, expected_hash: excel.row_hash, actual_hash: actual.row_hash });
    }
  });
  apiRows.forEach((api) => {
    if (!excelKeys.has(api.key)) mismatches.push({ type: 'extra_api_row_hash', key: api.key, actual_hash: api.row_hash });
  });
  return { checked: excelRows.length, matched, mismatches };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const workbookPath = resolveWorkbookPath();
  const wb = XLSX.readFile(workbookPath, { cellDates: false });
  const parsedWorkbook = parseSourceWorkbook(workbookPath, {
    domain: 'sector_market',
    reportPeriod: '2026Q1',
    asOfDate: '2026-03-31',
    version: '2026Q1',
  });
  const extractedWorkbook = fs.existsSync(EXTRACTED_WORKBOOK_PATH)
    ? JSON.parse(fs.readFileSync(EXTRACTED_WORKBOOK_PATH, 'utf8'))
    : parsedWorkbook;
  const excelLeaseRows = parseLeaseWorkbook(wb);
  const excelSupplyRows = parseSupplyWorkbook(wb);
  const excelCapRateRows = parseCapRateWorkbook(wb);
  const excelRawHashRows = (extractedWorkbook.rows || []).map((row) => ({
    key: [row.sheet_name, row.row_number].join('|'),
    sheet_name: row.sheet_name,
    row_number: row.row_number,
    row_hash: row.row_hash,
  }));
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  const auth = await signIn(supabaseUrl, anonKey);
  const full = hasFlag('full');
  const fullData = full
    ? await invoke(supabaseUrl, anonKey, auth.token, { limit: 12000, include_raw_row_hashes: true })
    : null;
  const [leaseData, supplyData, transactionData] = full
    ? [fullData, fullData, fullData]
    : await Promise.all([
      invoke(supabaseUrl, anonKey, auth.token, marketReadPayload('lease')),
      invoke(supabaseUrl, anonKey, auth.token, marketReadPayload('supply')),
      invoke(supabaseUrl, anonKey, auth.token, marketReadPayload('transactions')),
    ]);
  const apiLeaseRows = (leaseData.views?.lease?.statistics_rows || []).map((row) => ({
    ...row,
    key: ['lease', row.scope, row.period_label, row.segment_label, row.metric_key, row.dimension_type, row.label].join('|'),
  }));
  const apiSupplyRows = (supplyData.views?.supply?.statistics_rows || []).map((row) => ({
    ...row,
    key: ['supply', row.series_type, row.period_label, row.scope, row.label].join('|'),
  }));
  const apiCapRateRows = (transactionData.views?.transactions?.charts?.cap_rate_series || []).map((row) => ({
    ...row,
    key: ['cap_rate', row.report_year, quarterKey(row.report_quarter), capRateRegionKey(row.region)].join('|'),
    value: Number(row.cap_rate),
  }));
  const apiRawHashRows = (fullData?.summary?.source_audit?.raw_row_hashes || []).map((row) => ({
    key: [row.sheet_name, row.row_number].join('|'),
    sheet_name: row.sheet_name,
    row_number: row.row_number,
    row_hash: row.row_hash,
  }));
  const leaseCompare = compareRows(excelLeaseRows, apiLeaseRows);
  const supplyCompare = compareRows(excelSupplyRows, apiSupplyRows);
  const capRateCompare = compareRows(excelCapRateRows, apiCapRateRows, 0.000000000001);
  const rawRowHashCompare = full ? compareHashRows(excelRawHashRows, apiRawHashRows) : null;
  const sentinel = apiLeaseRows.find((row) => row.key === SENTINEL_KEY);
  const sentinelOk = Math.abs(Number(sentinel?.value) - SENTINEL_EXPECTED) < 0.000001;
  const capRateCountOk = excelCapRateRows.length === EXPECTED_CAP_RATE_ROWS * 2 && apiCapRateRows.length === EXPECTED_CAP_RATE_ROWS * 2;
  const report = {
    ok: leaseCompare.mismatches.length === 0 && supplyCompare.mismatches.length === 0 && capRateCompare.mismatches.length === 0 && (!full || rawRowHashCompare.mismatches.length === 0) && sentinelOk && capRateCountOk,
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    mode: full ? 'full' : 'light',
    request_limits: {
      lease: marketReadPayload('lease', { full }).limit,
      supply: marketReadPayload('supply', { full }).limit,
      transactions: marketReadPayload('transactions', { full }).limit,
      raw_row_hashes: full ? 12000 : null,
    },
    workbook: workbookPath,
    workbook_source_hash: parsedWorkbook.sourceHash,
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
      excel_cap_rate_rows: excelCapRateRows.length,
      api_cap_rate_rows: apiCapRateRows.length,
      excel_raw_row_hashes: excelRawHashRows.length,
      api_raw_row_hashes: apiRawHashRows.length,
      lease_mismatches: leaseCompare.mismatches.length,
      supply_mismatches: supplyCompare.mismatches.length,
      cap_rate_mismatches: capRateCompare.mismatches.length,
       raw_row_hash_mismatches: rawRowHashCompare?.mismatches.length ?? null,
      cap_rate_count_ok: capRateCountOk,
    },
    lease_compare: leaseCompare,
    supply_compare: supplyCompare,
    cap_rate_compare: capRateCompare,
    raw_row_hash_compare: rawRowHashCompare,
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
