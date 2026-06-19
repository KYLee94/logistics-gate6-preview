const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_WORKBOOK = 'C:\\Users\\10524\\Desktop\\codex_realasset\\Project\\03_Logi_Leasing_Dashboard\\260619_물류 자산 spec 샘플.xlsx';
const SHEET_NAME = '주요 물류센터 스펙 비교';
const TARGETS = [
  { name: '아레나스양지물류센터', column: 3 },
  { name: '인천석남물류센터', column: 4 },
  { name: '아레나스안성', column: 5 },
];
const ROW_LABELS = new Map([
  [5, '주소'],
  [6, '건물규모'],
  [7, '대지면적(평)'],
  [8, 'GFA(㎡)'],
  [9, 'GFA(평)'],
  [10, '상온창고 면적'],
  [11, '상온창고 면적(평)'],
  [12, '저온창고 면적'],
  [13, '저온창고 면적(평)'],
  [14, 'Net Storage Area/연면적'],
  [15, 'Net Storage Area'],
  [16, '시공사'],
  [17, '건폐율 / 용적률'],
  [18, '건물높이'],
  [19, '준공년도'],
  [20, '주차대수'],
  [21, '화물차량 접안 대수'],
  [22, '화물차량 접안 효율'],
  [23, 'Net Storage Area / 화물접안대수'],
  [24, '연면적/일반차량 주차대수'],
  [25, 'Type'],
  [26, '설계 하중 - 창고'],
  [27, '설계 하중 - 창고 비고'],
  [28, '설계 하중 - 하역장'],
  [29, '설계 하중 - 램프'],
  [30, '구조'],
  [31, '내마모도 기준'],
  [32, '평활도 기준(TR34 4th edition)'],
  [33, '외부마감 - 판넬'],
  [34, '외부마감 - 지붕'],
  [35, '구조 기둥 간격'],
  [36, '전기용량 - Kva'],
  [37, '전기용량 - 연면적평당 공급용량'],
  [38, '전기용량 - 평당 공급용량'],
  [39, '발전기 용량'],
  [40, '저수조 물탱크용량'],
  [41, '엘리베이터 대수'],
  [42, '엘리베이터 SPEC'],
  [43, '스노우멜팅'],
  [44, '층고 - 기준층'],
  [45, '층고 - 최고 높이층'],
  [46, '오버헤드 도어'],
  [47, '저온창고 (방열공사) - 벽'],
  [48, '저온창고 (방열공사) - 기둥'],
  [49, '저온창고 (방열공사) - 천장'],
  [50, '저온창고 (방열공사) - 바닥'],
  [51, '상온창고 환기'],
  [52, '냉동설비냉매'],
  [53, '소방설비 (기계소방, 전기소방)'],
]);

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

function compact(value) {
  return String(value || '').replace(/\s+/gu, '').toLowerCase();
}

function number(value) {
  const parsed = Number(String(value ?? '').replace(/,/gu, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value, digits = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '';
  return parsed.toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function pyFromSqm(value) {
  const sqm = number(value);
  return sqm === null ? null : sqm / 3.305785;
}

function firstText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function payloadObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function sourceValues(asset) {
  const payload = payloadObject(asset.source_payload);
  return payload.values && typeof payload.values === 'object' ? payload.values : {};
}

function valueFromDetailRows(asset, label) {
  const payload = payloadObject(asset.source_payload);
  const rows = Array.isArray(payload.detailRows) ? payload.detailRows : [];
  const found = rows.find((row) => compact(row?.label) === compact(label));
  return firstText(found?.value);
}

function currentAddress(asset, fallback) {
  const values = sourceValues(asset);
  return firstText(
    asset.standardized_address,
    asset.standardizedAddress,
    asset.sigungu_address,
    asset.address_sigungu,
    asset.address,
    values['주소'],
    valueFromDetailRows(asset, '주소'),
    fallback,
  );
}

function currentScale(asset, fallback) {
  const values = sourceValues(asset);
  const floors = firstText(asset.floor_summary, asset.building_scale, asset.scale, values['규모(층수)'], valueFromDetailRows(asset, '규모(층수)'));
  if (floors) return floors;
  const floorCount = firstText(asset.floor_count, asset.ground_floor_count, asset.underground_floor_count);
  return floorCount || fallback;
}

function currentLandArea(asset, fallback) {
  const values = sourceValues(asset);
  const directPy = number(firstText(asset.land_area_py, asset.site_area_py, values['대지면적(평)']));
  const sqm = number(firstText(asset.land_area_sqm, asset.site_area_sqm, values['대지면적(㎡)']));
  const py = directPy && directPy > 0 ? directPy : pyFromSqm(sqm);
  if (sqm !== null && py !== null) return `${formatNumber(sqm, 1)} sqm / ${formatNumber(py, 2)} py`;
  if (py !== null) return `${formatNumber(py, 2)} py`;
  return fallback;
}

function currentGfaSqm(asset, fallback) {
  const sqm = number(firstText(asset.gross_floor_area_sqm, asset.grossFloorAreaSqm, asset.total_area_sqm));
  return sqm === null ? fallback : formatNumber(sqm, 2);
}

function currentGfaPy(asset, fallback) {
  const directPy = number(firstText(asset.gross_floor_area_py, asset.grossFloorAreaPy, asset.total_area_py));
  const sqm = number(firstText(asset.gross_floor_area_sqm, asset.grossFloorAreaSqm, asset.total_area_sqm));
  const py = directPy && directPy > 0 ? directPy : pyFromSqm(sqm);
  return py === null ? fallback : formatNumber(py, 2);
}

function cellText(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
  return String(value).trim();
}

function rowsFromWorkbook(workbookPath, target, asset) {
  const workbook = XLSX.readFile(workbookPath, { cellDates: false });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) throw new Error(`Sheet not found: ${SHEET_NAME}`);
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  const rows = [];
  for (let rowIndex = 4; rowIndex <= 52; rowIndex += 1) {
    const sourceRow = matrix[rowIndex] || [];
    const rowNumber = rowIndex + 1;
    const label = ROW_LABELS.get(rowNumber) || cellText(sourceRow[0]) || `행 ${rowNumber}`;
    const workbookValue = cellText(sourceRow[target.column]);
    let value = workbookValue;
    if (rowNumber === 5) value = currentAddress(asset, workbookValue);
    if (rowNumber === 6) value = currentScale(asset, workbookValue);
    if (rowNumber === 7) value = currentLandArea(asset, workbookValue);
    if (rowNumber === 8) value = currentGfaSqm(asset, workbookValue);
    if (rowNumber === 9) value = currentGfaPy(asset, workbookValue);
    rows.push({ row_number: rowNumber, label, value });
  }
  return rows;
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
  if (!response.ok || !body.access_token) throw new Error(`Supabase Auth login failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
  return { token: body.access_token, source: 'password_grant' };
}

async function invoke(supabaseUrl, anonKey, token, action, payload = {}) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action, payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) throw new Error(`${action} failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
  return body.data || {};
}

function findAsset(assets, targetName) {
  const key = compact(targetName);
  return assets.find((asset) => compact(asset.asset_name || asset.display_name).includes(key) || key.includes(compact(asset.asset_name || asset.display_name)));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const workbookPath = process.argv.includes('--workbook')
    ? process.argv[process.argv.indexOf('--workbook') + 1]
    : DEFAULT_WORKBOOK;
  if (!fs.existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`);
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  const auth = await signIn(supabaseUrl, anonKey);
  const before = await invoke(supabaseUrl, anonKey, auth.token, 'asset-spec/read');
  const assets = Array.isArray(before.assets) ? before.assets : [];
  const results = [];
  for (const target of TARGETS) {
    const asset = findAsset(assets, target.name);
    if (!asset?.asset_id) throw new Error(`Target asset not found: ${target.name}`);
    const rows = rowsFromWorkbook(workbookPath, target, asset);
    const saved = await invoke(supabaseUrl, anonKey, auth.token, 'asset-spec/save', {
      asset_id: asset.asset_id,
      rows,
      source: 'asset_spec_sample_backfill',
      source_workbook: path.basename(workbookPath),
    });
    results.push({
      target: target.name,
      asset_id: asset.asset_id,
      asset_name: asset.asset_name,
      row_count: rows.length,
      readback_ok: saved.readback_ok === true,
      current_value_rows: rows.filter((row) => row.row_number >= 5 && row.row_number <= 9),
    });
  }
  const after = await invoke(supabaseUrl, anonKey, auth.token, 'asset-spec/read');
  const afterSpecs = Array.isArray(after.specs) ? after.specs : [];
  const report = {
    ok: results.every((row) => row.readback_ok),
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    workbook: workbookPath,
    results,
    readback_spec_count: afterSpecs.length,
  };
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `asset-spec-sample-backfill-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'asset-spec-sample-backfill-latest.json');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, artifact: outJson, results }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
