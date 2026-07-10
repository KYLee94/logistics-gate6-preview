#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const RUN_KEY = 'daily-news:2026-06-17:0700KST';
const TARGET_DATE = '2026-06-17';

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

function normalizedTitle(value) {
  return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function companyMentions(title) {
  const normalized = String(title || '').toLowerCase();
  const companies = [
    ['coupang', ['\uCFE0\uD321', 'coupang']],
    ['cjlogistics', ['cj\uB300\uD55C\uD1B5\uC6B4', '\uB300\uD55C\uD1B5\uC6B4', 'cj logistics']],
    ['hanjin', ['\uD55C\uC9C4']],
    ['kurly', ['\uCEEC\uB9AC', 'kurly']],
    ['lotte', ['\uB86F\uB370\uAE00\uB85C\uBC8C\uB85C\uC9C0\uC2A4', '\uB86F\uB370\uD0DD\uBC30', '\uB86F\uB370 \uBB3C\uB958']],
  ];
  return companies.filter(([, terms]) => terms.some((term) => normalized.includes(term.toLowerCase()))).map(([key]) => key);
}

function hasServiceRoleEnv() {
  return Boolean(envValue('SUPABASE_SERVICE_ROLE_KEY', 'LOGISTICS_SUPABASE_SERVICE_ROLE_KEY'));
}

function supabaseClient() {
  const url = envValue('SUPABASE_URL', 'LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const key = envValue('SUPABASE_SERVICE_ROLE_KEY', 'LOGISTICS_SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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
  if (!response.ok || !body.access_token) {
    const message = body.msg || body.message || body.error_description || body.error || 'unknown auth error';
    throw new Error(`Supabase Auth login failed (${response.status}): ${message}`);
  }
  return { token: body.access_token, source: 'password_grant' };
}

async function readViaEdge() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY are required.');
  const auth = await signIn(supabaseUrl, anonKey);
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${auth.token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action: 'news/list', payload: { date: TARGET_DATE, limit: 10 } }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) throw new Error(`news/list readback failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
  const data = body.data || {};
  return {
    readback_source: `edge:${auth.source}`,
    run: data.latest_run || null,
    items: Array.isArray(data.items) ? data.items : [],
  };
}

async function readViaServiceRole() {
  const client = supabaseClient();
  const itemResult = await client.from('ll_news_items')
    .select('news_item_id,dedupe_key,canonical_url,original_url,title,publisher,published_at,summary,importance_score,matched_keywords,source_name,news_date,ingested_at')
    .eq('news_date', TARGET_DATE)
    .order('published_at', { ascending: false, nullsFirst: false });
  if (itemResult.error) throw new Error(`ll_news_items read failed: ${itemResult.error.message}`);
  const items = itemResult.data || [];
  return {
    readback_source: 'service_role',
    run: {
      run_key: RUN_KEY,
      completed_at: items[0]?.ingested_at || null,
    },
    items,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `news-restore-readback-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'news-restore-readback-latest.json');
  const readback = hasServiceRoleEnv() ? await readViaServiceRole() : await readViaEdge();
  const run = readback.run;
  const items = readback.items;
  const titles = items.map((item) => normalizedTitle(item.title)).filter(Boolean);
  const companyCounts = items.reduce((acc, item) => {
    companyMentions(item.title).forEach((key) => { acc[key] = (acc[key] || 0) + 1; });
    return acc;
  }, {});
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    readback_source: readback.readback_source,
    target_date: TARGET_DATE,
    run_key: RUN_KEY,
    run,
    item_count: items.length,
    item_keys: items.map((item) => item.dedupe_key),
    checks: {
      run_present: Boolean(run),
      run_key_exact: run?.run_key === RUN_KEY,
      completed_at_present: Boolean(run?.completed_at),
      item_count_8_to_10: items.length >= 8 && items.length <= 10,
      dedupe_keys_present: items.every((item) => Boolean(item.dedupe_key)),
      unique_dedupe_keys: new Set(items.map((item) => item.dedupe_key)).size === items.length,
      unique_titles: new Set(titles).size === titles.length,
      no_important_prefix: items.every((item) => !/^\s*(?:\[\uC911\uC694\]|\uC911\uC694[:\uFF1A-])/iu.test(String(item.title || ''))),
      no_publisher_suffix: items.every((item) => !item.publisher || !new RegExp(`\\s*[-|\\u2013\\u2014\\u00B7\\u318D:]\\s*${String(item.publisher).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'iu').test(String(item.title || ''))),
      publishers_present: items.every((item) => Boolean(item.publisher)),
      company_not_overconcentrated: Math.max(0, ...Object.values(companyCounts)) <= 2,
    },
    company_counts: companyCounts,
    items: items.map((item) => ({
      dedupe_key: item.dedupe_key,
      title: item.title,
      publisher: item.publisher,
      published_at: item.published_at,
      canonical_url: item.canonical_url,
      category: item.payload?.category || '',
      company_key: item.payload?.company_key || '',
      restoration_mode: item.payload?.restoration_mode || '',
    })),
  };
  report.ok = Object.values(report.checks).every(Boolean);
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`news restore readback ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
