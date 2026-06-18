const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const EMPTY_MESSAGE = '\uC218\uC9D1\uB41C \uB274\uC2A4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.';

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

function argsValues(name) {
  const flag = `--${name}`;
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === flag && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function kstDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDateDays(dateText, diff) {
  const match = String(dateText || '').match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return kstDateKey();
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

function expectedWindowHours(dateText) {
  const match = String(dateText || '').match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return 24;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCDay() === 1 ? 72 : 24;
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
  return companies
    .filter(([, terms]) => terms.some((term) => normalized.includes(term.toLowerCase())))
    .map(([key]) => key);
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

async function invokeNewsList(supabaseUrl, anonKey, token, date, extraPayload = {}) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action: 'news/list', payload: { limit: 10, date, ...extraPayload } }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) throw new Error(`news/list ${date} failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
  const data = body.data || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const sourceSummary = data.latest_run?.source_summary || {};
  const dedupeKeys = items.map((item) => item.dedupe_key).filter(Boolean);
  const normalizedTitles = items.map((item) => String(item.title || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')).filter(Boolean);
  const categoryCounts = items.reduce((acc, item) => {
    const category = item.payload?.category || item.category || 'unknown';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  return {
    date,
    http_status: response.status,
    data_status: data.status,
    selected_date: data.selected_date,
    run_key: data.latest_run?.run_key || null,
    news_run_id: data.latest_run?.news_run_id || null,
    completed_at: data.latest_run?.completed_at || null,
    item_count: items.length,
    item_keys: dedupeKeys,
    items_summary: items.map((item) => ({
      dedupe_key: item.dedupe_key || null,
      title: item.title || '',
      publisher: item.publisher || '',
      published_at: item.published_at || null,
      canonical_url: item.canonical_url || item.original_url || '',
      category: item.payload?.category || item.category || '',
    })),
    missing_dedupe_count: items.filter((item) => !item.dedupe_key).length,
    unique_dedupe_count: new Set(dedupeKeys).size,
    unique_title_count: new Set(normalizedTitles).size,
    empty_message: data.empty_message,
    source_summary: sourceSummary,
    window_hours: sourceSummary.window_hours,
    strict_24h_window: sourceSummary.strict_24h_window,
    expanded_to_recent_7d: sourceSummary.expanded_to_recent_7d,
    titles_with_important_prefix: items
      .filter((item) => /^\s*(?:\[\uC911\uC694\]|\uC911\uC694[:\uFF1A-])/iu.test(String(item.title || '')))
      .map((item) => item.title),
    titles_with_publisher_suffix: items
      .filter((item) => item.publisher && new RegExp(`\\s*[-|\\u2013\\u2014\\u00B7\\u318D:]\\s*${String(item.publisher).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'iu').test(String(item.title || '')))
      .map((item) => item.title),
    missing_publisher_count: items.filter((item) => !item.publisher).length,
    company_mention_counts: items.reduce((acc, item) => {
      companyMentions(item.title).forEach((key) => {
        acc[key] = (acc[key] || 0) + 1;
      });
      return acc;
    }, {}),
    category_counts: categoryCounts,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  const dates = argsValues('date');
  const preserveRefreshDates = argsValues('preserve-refresh-date');
  const today = kstDateKey();
  const targets = dates.length ? dates : [today, addDateDays(today, -1)];
  const auth = await signIn(supabaseUrl, anonKey);
  const checks = [];
  for (const date of targets) checks.push(await invokeNewsList(supabaseUrl, anonKey, auth.token, date));
  const preservation_checks = [];
  for (const date of preserveRefreshDates) {
    const before = await invokeNewsList(supabaseUrl, anonKey, auth.token, date);
    const todayBefore = await invokeNewsList(supabaseUrl, anonKey, auth.token, today);
    const todayAfter = await invokeNewsList(supabaseUrl, anonKey, auth.token, today, { refresh: true });
    const after = await invokeNewsList(supabaseUrl, anonKey, auth.token, date, { refresh: true });
    const afterKeys = new Set(after.item_keys || []);
    preservation_checks.push({
      date,
      min_required_count: 8,
      max_required_count: 10,
      before_count: before.item_count,
      after_count: after.item_count,
      before_run_key: before.run_key,
      after_run_key: after.run_key,
      before_news_run_id: before.news_run_id,
      after_news_run_id: after.news_run_id,
      before_completed_at: before.completed_at,
      after_completed_at: after.completed_at,
      today_before_completed_at: todayBefore.completed_at,
      today_after_completed_at: todayAfter.completed_at,
      removed_keys: (before.item_keys || []).filter((key) => !afterKeys.has(key)),
      today_refresh_attempted: true,
      today_refresh_updated: Boolean(todayBefore.completed_at && todayAfter.completed_at && todayBefore.completed_at !== todayAfter.completed_at),
      past_run_unchanged: before.run_key === after.run_key
        && before.news_run_id === after.news_run_id
        && before.completed_at === after.completed_at,
      ok: before.item_count >= 8
        && before.item_count <= 10
        && after.item_count >= 8
        && after.item_count <= 10
        && todayBefore.completed_at
        && todayAfter.completed_at
        && todayBefore.completed_at !== todayAfter.completed_at
        && after.item_count >= before.item_count
        && before.run_key === after.run_key
        && before.news_run_id === after.news_run_id
        && before.completed_at === after.completed_at
        && (before.item_keys || []).every((key) => afterKeys.has(key)),
    });
  }
  const report = {
    ok: checks.every((check, index) => check.http_status === 200
      && check.selected_date === check.date
      && check.empty_message === EMPTY_MESSAGE
      && check.window_hours === expectedWindowHours(check.date)
      && check.strict_24h_window === (expectedWindowHours(check.date) === 24)
      && check.expanded_to_recent_7d !== true
      && check.item_count <= 10
      && check.missing_dedupe_count === 0
      && check.unique_dedupe_count === check.item_count
      && check.unique_title_count === check.item_count
      && check.titles_with_important_prefix.length === 0
      && check.titles_with_publisher_suffix.length === 0
      && check.missing_publisher_count === 0
      && Math.max(0, ...Object.values(check.company_mention_counts || {})) <= 2
      && (check.date !== '2026-06-17' || check.item_count >= 8))
      && preservation_checks.every((check) => check.ok),
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    checks,
    preservation_checks,
  };
  const outJson = path.join(OUT_DIR, `news-api-smoke-${timestampForFile()}.json`);
  const latestJson = path.join(OUT_DIR, 'news-api-smoke-latest.json');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, artifact: outJson, checks, preservation_checks }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
