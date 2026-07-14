const fs = require('fs');
const path = require('path');
const { marketReadPayload } = require('./logistics-market-data-egress-contract.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const EXPECTED_SEGMENTS = ['복합 상온', '복합 저온', '상온(복합포함)', '저온(복합포함)'];

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

function text(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function groupSummary(rows, segment) {
  const segmentRows = rows.filter((row) => text(row.segment_label) === segment);
  return {
    segment,
    row_count: segmentRows.length,
    source_row_numbers: [...new Set(segmentRows.map((row) => Number(row.source_row_number || 0)).filter(Boolean))].sort((a, b) => a - b),
    metric_keys: [...new Set(segmentRows.map((row) => text(row.metric_key)).filter(Boolean))].sort(),
    period_count: new Set(segmentRows.map((row) => text(row.period_label)).filter(Boolean)).size,
    region_value_count: segmentRows.filter((row) => text(row.dimension_type) === 'region').length,
    size_value_count: segmentRows.filter((row) => text(row.dimension_type) === 'size').length,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  const auth = await signIn(supabaseUrl, anonKey);
  // Statistics rows are complete for the lease view; request only the UI contract limit.
  const data = await invoke(supabaseUrl, anonKey, auth.token, marketReadPayload('lease'));
  const leaseView = data.views?.lease || {};
  const rows = Array.isArray(leaseView.statistics_rows) ? leaseView.statistics_rows : [];
  const summaries = EXPECTED_SEGMENTS.map((segment) => groupSummary(rows, segment));
  const sourceSemantics = leaseView.temperature_semantics || {};
  const report = {
    ok: summaries.every((row) => row.row_count > 0 && row.metric_keys.length >= 6 && row.region_value_count > 0 && row.size_value_count > 0)
      && sourceSemantics.ok === true,
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    basis: '임대시장 통계 sheet의 별도 segment row를 Edge API statistics_rows와 source_row_number로 검증',
    interpretation: {
      '복합 상온': '복합 물류센터 행 중 상온 조건을 별도 관측한 원천 행입니다.',
      '복합 저온': '복합 물류센터 행 중 저온 조건을 별도 관측한 원천 행입니다.',
      '상온(복합포함)': '단일 상온과 복합센터 상온 조건을 포함한 원천 집계 행입니다. 앱에서 임의 합산하지 않습니다.',
      '저온(복합포함)': '단일 저온과 복합센터 저온 조건을 포함한 원천 집계 행입니다. 앱에서 임의 합산하지 않습니다.',
    },
    source_semantics: sourceSemantics,
    summaries,
  };
  const outJson = path.join(OUT_DIR, `market-data-temperature-semantics-audit-${timestampForFile()}.json`);
  const latestJson = path.join(OUT_DIR, 'market-data-temperature-semantics-audit-latest.json');
  const outMd = outJson.replace(/\.json$/u, '.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(outMd, [
    '# Market Data 온도 구분 의미 검증',
    '',
    `- 결과: ${report.ok ? 'PASS' : 'FAIL'}`,
    `- 기준: ${report.basis}`,
    '',
    ...Object.entries(report.interpretation).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '| segment | row_count | source rows | metrics | periods | region values | size values |',
    '| --- | ---: | --- | --- | ---: | ---: | ---: |',
    ...summaries.map((row) => `| ${row.segment} | ${row.row_count} | ${row.source_row_numbers.join(', ')} | ${row.metric_keys.join(', ')} | ${row.period_count} | ${row.region_value_count} | ${row.size_value_count} |`),
    '',
  ].join('\n'));
  console.log(JSON.stringify({ ok: report.ok, artifact: outJson, markdown: outMd, summaries }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
