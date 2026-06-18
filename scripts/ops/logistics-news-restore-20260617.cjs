#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..', '..');
const QA_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const RUN_KEY = 'daily-news:2026-06-17:0700KST';
const TARGET_DATE = '2026-06-17';
const WINDOW_START = new Date('2026-06-15T22:00:00.000Z');
const WINDOW_END = new Date('2026-06-16T22:00:00.000Z');
const QUERIES = [
  '물류센터 거래 OR 매각',
  '물류센터 임대차 OR 임대료 OR 공실률',
  '물류센터 공급 OR 개발 OR 착공 OR 준공',
  '물류 리츠 OR 물류 부동산 cap rate',
  '쿠팡 CJ대한통운 한진 물류 투자',
];

function hasFlag(name) {
  return process.argv.includes(name);
}

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

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

function uuidFromHash(input) {
  const hex = crypto.createHash('sha256').update(String(input)).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}

function supabaseClient() {
  const url = envValue('SUPABASE_URL', 'LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const key = envValue('SUPABASE_SERVICE_ROLE_KEY', 'LOGISTICS_SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function cleanTitle(title, publisher = '') {
  let value = String(title || '')
    .replace(/<!\[CDATA\[|\]\]>/gu, '')
    .replace(/<[^>]+>/gu, '')
    .replace(/&quot;/gu, '"')
    .replace(/&amp;/gu, '&')
    .replace(/^\s*(?:\[중요\]|중요[:：-])\s*/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
  const escapedPublisher = String(publisher || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (escapedPublisher) {
    value = value
      .replace(new RegExp(`\\s*[-|–—·ㆍ:]\\s*${escapedPublisher}\\s*$`, 'iu'), '')
      .replace(new RegExp(`^${escapedPublisher}\\s*[-|–—·ㆍ:]\\s*`, 'iu'), '');
  }
  return value.trim();
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(String(url || ''));
    parsed.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((key) => parsed.searchParams.delete(key));
    return parsed.toString();
  } catch {
    return String(url || '').trim();
  }
}

function categoryFor(title) {
  const text = String(title || '');
  if (/거래|매각|인수|매입|딜|투자/u.test(text)) return 'transaction';
  if (/임대|임차|임대료|공실|렌트프리/u.test(text)) return 'lease_market';
  if (/공급|개발|착공|준공|인허가|물량/u.test(text)) return 'supply_development';
  if (/리포트|전망|시장|cap rate|캡레이트|수익률/u.test(text)) return 'market_report';
  return 'operator_company';
}

function companyKey(title) {
  const text = String(title || '').toLowerCase();
  if (text.includes('쿠팡') || text.includes('coupang')) return 'coupang';
  if (text.includes('cj대한통운') || text.includes('대한통운') || text.includes('cj logistics')) return 'cjlogistics';
  if (text.includes('한진')) return 'hanjin';
  if (text.includes('컬리') || text.includes('kurly')) return 'kurly';
  if (text.includes('롯데')) return 'lotte';
  return '';
}

function itemFromRaw(raw, source = 'artifact') {
  const publisher = String(raw.publisher || raw.source_name || raw.source || '').trim();
  const title = cleanTitle(raw.title || raw.headline, publisher);
  const url = normalizeUrl(raw.canonical_url || raw.url || raw.link || raw.original_url);
  if (!title || !url) return null;
  const publishedAt = raw.published_at || raw.pubDate || raw.publishedAt || raw.date || `${TARGET_DATE}T00:00:00.000Z`;
  const dedupeKey = raw.dedupe_key || crypto.createHash('sha1').update(`${title}|${url}`).digest('hex');
  return {
    dedupe_key: dedupeKey,
    canonical_url: url,
    original_url: normalizeUrl(raw.original_url || raw.link || raw.url || url),
    title,
    publisher: publisher || '확인 필요',
    published_at: new Date(publishedAt).toISOString(),
    summary: String(raw.summary || raw.description || '').replace(/<[^>]+>/gu, '').slice(0, 500),
    importance_score: Number(raw.importance_score || 50),
    matched_keywords: Array.isArray(raw.matched_keywords) ? raw.matched_keywords : [],
    source_name: raw.source_name || source,
    payload: {
      ...(raw.payload && typeof raw.payload === 'object' ? raw.payload : {}),
      category: raw.payload?.category || categoryFor(title),
      company_key: raw.payload?.company_key || companyKey(title),
      restoration_source: source,
      restoration_note: source === 'rss_reconstruction'
        ? '원본 10건 상세 artifact를 찾지 못해 2026-06-17 07:00 KST 직전 24시간 기준으로 재수집 기반 재구성했습니다.'
        : '로컬 백업/export artifact에서 복구했습니다.',
    },
  };
}

function walkJson(value, items = []) {
  if (!value || typeof value !== 'object') return items;
  if (Array.isArray(value)) {
    value.forEach((entry) => walkJson(entry, items));
    return items;
  }
  if ((value.title || value.headline) && (value.canonical_url || value.url || value.link || value.original_url)) items.push(value);
  Object.values(value).forEach((entry) => walkJson(entry, items));
  return items;
}

function itemsFromArtifacts() {
  if (!fs.existsSync(QA_DIR)) return [];
  return fs.readdirSync(QA_DIR)
    .filter((name) => name.toLowerCase().includes('news') && name.endsWith('.json'))
    .flatMap((name) => {
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(QA_DIR, name), 'utf8'));
        return walkJson(parsed).map((raw) => itemFromRaw(raw, `artifact:${name}`)).filter(Boolean);
      } catch {
        return [];
      }
    });
}

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[|\]\]>/gu, '')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&amp;/gu, '&');
}

async function rssItems(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} after:2026-06-15 before:2026-06-18`)}&hl=ko&gl=KR&ceid=KR:ko`;
  const response = await fetch(url, { headers: { 'user-agent': 'logistics-gate6-news-restore/1.0' } });
  if (!response.ok) throw new Error(`RSS fetch failed (${response.status})`);
  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gu)].map((match) => {
    const block = match[1];
    const title = decodeXml(block.match(/<title>([\s\S]*?)<\/title>/u)?.[1]);
    const link = decodeXml(block.match(/<link>([\s\S]*?)<\/link>/u)?.[1]);
    const pubDate = decodeXml(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/u)?.[1]);
    const source = decodeXml(block.match(/<source[^>]*>([\s\S]*?)<\/source>/u)?.[1]);
    return itemFromRaw({ title, link, pubDate, publisher: source, source_name: 'google_news_rss', payload: { query } }, 'rss_reconstruction');
  }).filter(Boolean);
}

async function reconstructedItems() {
  const batches = [];
  for (const query of QUERIES) {
    try {
      batches.push(...await rssItems(query));
    } catch (error) {
      batches.push({ error: error.message, query });
    }
  }
  return batches.filter((item) => item && !item.error)
    .filter((item) => {
      const published = new Date(item.published_at);
      return Number.isNaN(published.getTime()) || (published >= WINDOW_START && published <= WINDOW_END);
    });
}

function selectBalanced(items) {
  const byKey = new Map();
  items.forEach((item) => {
    if (!item?.dedupe_key || byKey.has(item.dedupe_key)) return;
    byKey.set(item.dedupe_key, item);
  });
  const deduped = [...byKey.values()];
  const selected = [];
  const companyCounts = {};
  const categories = ['transaction', 'lease_market', 'supply_development', 'market_report', 'operator_company'];
  for (const category of categories) {
    const next = deduped.find((item) => !selected.includes(item) && item.payload?.category === category);
    if (next) {
      selected.push(next);
      const key = next.payload?.company_key || '';
      if (key) companyCounts[key] = (companyCounts[key] || 0) + 1;
    }
  }
  for (const item of deduped) {
    if (selected.length >= 10) break;
    if (selected.includes(item)) continue;
    const key = item.payload?.company_key || '';
    if (key && (companyCounts[key] || 0) >= 2) continue;
    selected.push(item);
    if (key) companyCounts[key] = (companyCounts[key] || 0) + 1;
  }
  return selected.slice(0, 10);
}

async function readCurrent(client) {
  const runResult = await client.from('ll_news_runs')
    .select('news_run_id,run_key,scheduled_for,window_start,window_end,source_summary,run_status,error_message,completed_at,created_at')
    .eq('run_key', RUN_KEY)
    .maybeSingle();
  if (runResult.error) throw new Error(`ll_news_runs read failed: ${runResult.error.message}`);
  const run = runResult.data;
  const itemResult = run ? await client.from('ll_news_items')
    .select('news_item_id,dedupe_key,canonical_url,original_url,title,publisher,published_at,summary,importance_score,matched_keywords,source_name,created_at,payload')
    .eq('news_run_id', run.news_run_id)
    .order('published_at', { ascending: false, nullsFirst: false }) : { data: [], error: null };
  if (itemResult.error) throw new Error(`ll_news_items read failed: ${itemResult.error.message}`);
  return { run, items: itemResult.data || [] };
}

async function main() {
  fs.mkdirSync(QA_DIR, { recursive: true });
  const stamp = timestampForFile();
  const artifact = path.join(QA_DIR, `news-restore-20260617-${stamp}.json`);
  const latest = path.join(QA_DIR, 'news-restore-20260617-latest.json');
  const publish = hasFlag('--publish');
  const itemsFile = argValue('--items-file');
  const client = supabaseClient();
  const before = await readCurrent(client);
  if (!before.run?.news_run_id) throw new Error(`${RUN_KEY} run is missing.`);

  const fileItems = itemsFile && fs.existsSync(itemsFile)
    ? walkJson(JSON.parse(fs.readFileSync(itemsFile, 'utf8'))).map((raw) => itemFromRaw(raw, `items-file:${path.basename(itemsFile)}`)).filter(Boolean)
    : [];
  const artifactItems = itemsFromArtifacts();
  const localCandidates = [...fileItems, ...artifactItems];
  const reconstructionNeeded = localCandidates.length < 8;
  const rssCandidates = reconstructionNeeded ? await reconstructedItems() : [];
  const selected = selectBalanced([...localCandidates, ...rssCandidates]);
  const mode = localCandidates.length >= 8 ? 'artifact_restore' : 'rss_reconstruction';
  const itemRows = selected.map((item) => ({
    news_item_id: uuidFromHash(`${before.run.news_run_id}:${item.dedupe_key}`),
    news_run_id: before.run.news_run_id,
    ...item,
    payload: {
      ...item.payload,
      restoration_mode: mode,
      restoration_run_key: RUN_KEY,
      restoration_generated_at: new Date().toISOString(),
    },
  }));

  let upsertResult = null;
  if (publish && itemRows.length >= 8) {
    const result = await client.from('ll_news_items').upsert(itemRows, { onConflict: 'news_run_id,dedupe_key' });
    if (result.error) throw new Error(`ll_news_items upsert failed: ${result.error.message}`);
    upsertResult = { inserted_or_updated: itemRows.length };
  }
  const after = publish ? await readCurrent(client) : before;
  const report = {
    ok: itemRows.length >= 8 && itemRows.length <= 10 && (!publish || after.items.length >= 8),
    generated_at: new Date().toISOString(),
    publish,
    run_key: RUN_KEY,
    target_date: TARGET_DATE,
    mode,
    note: mode === 'rss_reconstruction'
      ? '원본 10건 상세 artifact를 찾지 못해 2026-06-17 07:00 KST 직전 24시간 기준으로 재수집 기반 재구성했습니다.'
      : '로컬 백업/export artifact에서 원문 후보를 찾아 복구했습니다.',
    before: {
      news_run_id: before.run.news_run_id,
      completed_at: before.run.completed_at,
      item_count: before.items.length,
      item_keys: before.items.map((item) => item.dedupe_key),
    },
    candidates: {
      items_file_count: fileItems.length,
      artifact_count: artifactItems.length,
      rss_count: rssCandidates.length,
      selected_count: itemRows.length,
    },
    selected_items: itemRows.map((item) => ({
      dedupe_key: item.dedupe_key,
      title: item.title,
      publisher: item.publisher,
      published_at: item.published_at,
      canonical_url: item.canonical_url,
      category: item.payload?.category,
    })),
    upsert: upsertResult,
    after: {
      news_run_id: after.run.news_run_id,
      completed_at: after.run.completed_at,
      item_count: after.items.length,
      item_keys: after.items.map((item) => item.dedupe_key),
    },
  };
  fs.writeFileSync(artifact, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latest, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, publish, mode, artifact, selected_count: itemRows.length, before_count: before.items.length, after_count: after.items.length }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
