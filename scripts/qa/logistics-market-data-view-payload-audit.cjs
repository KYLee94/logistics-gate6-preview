const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const VIEWS = ['overview', 'lease', 'supply', 'transactions', 'source'];

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

async function invokeRaw(supabaseUrl, anonKey, token, payload) {
  const startedAt = Date.now();
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
  const rawText = await response.text();
  const elapsedMs = Date.now() - startedAt;
  const body = JSON.parse(rawText || '{}');
  if (!response.ok || body?.ok === false) throw new Error(`sector-market/read failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
  return { elapsed_ms: elapsedMs, bytes: Buffer.byteLength(rawText), data: body.data || {} };
}

async function invokeMeasured(supabaseUrl, anonKey, token, payload) {
  try {
    const result = await invokeRaw(supabaseUrl, anonKey, token, payload);
    return {
      ok: true,
      payload,
      elapsed_ms: result.elapsed_ms,
      bytes: result.bytes,
      data_keys: Object.keys(result.data || {}),
    };
  } catch (error) {
    return {
      ok: false,
      payload,
      elapsed_ms: 0,
      bytes: 0,
      error: error?.message || String(error),
    };
  }
}

function hasInternalKeys(value) {
  const hits = [];
  const visit = (node, pathParts = []) => {
    if (Array.isArray(node)) {
      node.slice(0, 30).forEach((item, index) => visit(item, [...pathParts, String(index)]));
      return;
    }
    if (!node || typeof node !== 'object') return;
    Object.entries(node).forEach(([key, child]) => {
      if (key.startsWith('ll_') || ['payload', 'source_row_id', 'source_sheet_id', 'source_column_id', 'pnu', 'legal_dong_code'].includes(key)) {
        hits.push([...pathParts, key].join('.'));
      }
      if (hits.length < 40) visit(child, [...pathParts, key]);
    });
  };
  visit(value);
  return hits;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  const auth = await signIn(supabaseUrl, anonKey);
  const legacyAll = await invokeMeasured(supabaseUrl, anonKey, auth.token, { limit: 12000 });
  const fallbackAll = legacyAll.ok
    ? null
    : await invokeMeasured(supabaseUrl, anonKey, auth.token, { limit: 2000 });
  const viewResults = [];
  for (const view of VIEWS) {
    const result = await invokeRaw(supabaseUrl, anonKey, auth.token, { view, limit: 12000 });
    const readbackStatus = result.data?.summary?.readback_status || result.data?.readback?.status || '';
    const viewKeys = Object.keys(result.data?.views || {});
    const baselineBytes = legacyAll.ok ? legacyAll.bytes : (fallbackAll?.ok ? fallbackAll.bytes : 0);
    viewResults.push({
      view,
      elapsed_ms: result.elapsed_ms,
      bytes: result.bytes,
      byte_ratio_to_legacy_all: baselineBytes ? Math.round((result.bytes / Math.max(1, baselineBytes)) * 1000) / 10 : null,
      readback_status: readbackStatus,
      view_keys: viewKeys,
      internal_key_hits: hasInternalKeys(result.data),
      ok: viewKeys.length === 1
        && viewKeys[0] === view
        && (view === 'source' ? readbackStatus === 'checked' : readbackStatus === 'skipped'),
    });
  }
  const interactiveViews = viewResults.filter((row) => row.view !== 'source');
  const legacyFullResourceExhausted = !legacyAll.ok && /546|compute resource|enough compute resources/iu.test(legacyAll.error || '');
  const ratioCheck = legacyAll.ok
    ? interactiveViews.every((row) => Number(row.byte_ratio_to_legacy_all) <= 35)
    : legacyFullResourceExhausted;
  const report = {
    ok: viewResults.every((row) => row.ok && row.internal_key_hits.length === 0)
      && ratioCheck,
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    baseline: {
      legacy_full: legacyAll,
      fallback_all: fallbackAll,
      note: legacyFullResourceExhausted
        ? '기존 전체 limit 12000 호출은 Edge compute resource 초과로 실패했습니다. 탭별 view 호출의 필요성을 보여주는 기준선으로 기록합니다.'
        : '기존 전체 호출 기준으로 탭별 payload 비율을 계산했습니다.',
    },
    views: viewResults,
    checks: {
      source_only_readback_checked: viewResults.find((row) => row.view === 'source')?.readback_status === 'checked',
      non_source_readback_skipped: interactiveViews.every((row) => row.readback_status === 'skipped'),
      legacy_full_resource_exhausted: legacyFullResourceExhausted,
      interactive_payloads_at_most_35pct_of_legacy_all: legacyAll.ok
        ? interactiveViews.every((row) => Number(row.byte_ratio_to_legacy_all) <= 35)
        : null,
      interactive_views_survive_when_legacy_full_fails: legacyFullResourceExhausted && interactiveViews.every((row) => row.ok),
      internal_fields_hidden: viewResults.every((row) => row.internal_key_hits.length === 0),
    },
  };
  const outJson = path.join(OUT_DIR, `market-data-view-payload-audit-${timestampForFile()}.json`);
  const latestJson = path.join(OUT_DIR, 'market-data-view-payload-audit-latest.json');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, artifact: outJson, checks: report.checks, views: report.views.map((row) => ({ view: row.view, bytes: row.bytes, ratio: row.byte_ratio_to_legacy_all, elapsed_ms: row.elapsed_ms })) }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
