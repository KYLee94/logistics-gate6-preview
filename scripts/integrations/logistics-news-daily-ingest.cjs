#!/usr/bin/env node
/* eslint-disable no-console */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const GOOGLE_NEWS_RSS_URL = 'https://news.google.com/rss/search';
const BING_NEWS_RSS_URL = 'https://www.bing.com/news/search';
const NEWS_COLLECTOR_VERSION = 'google-bing-rss-v2';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const SEARCH_QUERIES = [
  '물류센터 OR 물류창고',
  '물류센터 임대 OR 공실 OR 임대료',
  '물류센터 매매 OR 거래 OR 캡레이트 OR 자산운용',
  '저온물류센터 OR 풀필먼트센터',
  '물류창고 착공 OR 준공 OR 공급 OR 개발',
  '물류센터 PF OR 대출 OR 금리',
  '쿠팡 OR CJ대한통운 OR 컬리 물류센터',
];

const IMPORTANT_TERMS = [
  '물류센터', '물류창고', '저온물류', '풀필먼트', '임대', '임대료', '공실',
  '매매', '거래', '공급', '개발', '인허가', '착공', '준공', '캡레이트', 'cap rate',
  'PF', '대출', '금리', '쿠팡', 'CJ대한통운', '컬리', '네이버', 'SSG', '아마존', '3PL',
];
const CORE_TERMS = ['물류센터', '물류 창고', '물류창고', '저온물류', '저온 물류', '풀필먼트', 'fulfillment'];

const STRUCTURAL_TERMS = /(공급|매매|거래|임대|공실|준공|착공|인허가|금리|캡레이트|cap\s*rate|PF|투자|매각)/iu;

function hasFlag(name) {
  return process.argv.includes(name);
}

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalUrl(value) {
  try {
    const url = new URL(String(value || ''));
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach((key) => url.searchParams.delete(key));
    url.hash = '';
    return url.toString();
  } catch {
    return String(value || '').trim();
  }
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function uuidFromHash(value) {
  const hex = hash(value).slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${(parseInt(hex.slice(16, 18), 16) & 0x3f | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

function normalizeTitle(value) {
  return stripHtml(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 120);
}

function parseBasisKst(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!match) throw new Error('--basis-kst must look like 2026-06-16T07:00');
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]) - 9, Number(match[5])));
}

function currentSevenAmBasisKst() {
  const now = new Date();
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const todaySeven = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 22, 0, 0));
  return now.getTime() < todaySeven.getTime() ? new Date(todaySeven.getTime() - 24 * HOUR_MS) : todaySeven;
}

function kstDayOfWeek(date) {
  return new Date(date.getTime() + KST_OFFSET_MS).getUTCDay();
}

function kstDateKey(date) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function parseWindow() {
  const basis = argValue('--basis-kst', '');
  const windowEnd = basis ? parseBasisKst(basis) : currentSevenAmBasisKst();
  const windowHours = kstDayOfWeek(windowEnd) === 1 ? 72 : 24;
  const windowStart = new Date(windowEnd.getTime() - windowHours * HOUR_MS);
  return { windowStart, windowEnd, windowHours };
}

function xmlTag(source, tag) {
  const match = String(source || '').match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'iu'));
  return match ? stripHtml(match[1]) : '';
}

function parseRssItems(xml) {
  return [...String(xml || '').matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/giu)]
    .map((match) => {
      const item = match[1];
      return {
        title: xmlTag(item, 'title'),
        description: xmlTag(item, 'description'),
        pubDate: xmlTag(item, 'pubDate'),
        link: xmlTag(item, 'link'),
        originallink: xmlTag(item, 'link'),
        publisher: xmlTag(item, 'source'),
      };
    })
    .filter((item) => item.title && item.link);
}

async function fetchGoogleNewsRss(query) {
  const url = new URL(GOOGLE_NEWS_RSS_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'ko');
  url.searchParams.set('gl', 'KR');
  url.searchParams.set('ceid', 'KR:ko');
  const response = await fetch(url, {
    headers: { 'user-agent': 'logistics-gate6-news-collector/1.0' },
  });
  if (!response.ok) return [];
  return parseRssItems(await response.text());
}

async function fetchBingNewsRss(query) {
  const url = new URL(BING_NEWS_RSS_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'rss');
  url.searchParams.set('setlang', 'ko-KR');
  url.searchParams.set('cc', 'KR');
  const response = await fetch(url, {
    headers: { 'user-agent': 'logistics-gate6-news-collector/2.0' },
  });
  if (!response.ok) return [];
  return parseRssItems(await response.text()).map((item) => ({ ...item, source_name: 'bing_news_rss' }));
}

function inferPublisher(item) {
  if (item.publisher) return item.publisher;
  try {
    const host = new URL(item.originallink || item.link || '').hostname.replace(/^www\./, '');
    return host || '';
  } catch {
    return '';
  }
}

function scoreItem(item) {
  const text = `${item.title} ${item.summary}`;
  if (!CORE_TERMS.some((term) => text.toLowerCase().includes(term.toLowerCase()))) return { score: 0, matched: [] };
  const matched = IMPORTANT_TERMS.filter((term) => text.toLowerCase().includes(term.toLowerCase()));
  const structuralBoost = STRUCTURAL_TERMS.test(text) ? 2 : 0;
  return { score: matched.length + structuralBoost, matched };
}

function titleTokens(value) {
  return [...new Set(stripHtml(value).toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [])]
    .filter((token) => !['단독', '종합', '속보', '포토', '영상'].includes(token));
}

function titleSimilarity(left, right) {
  const a = titleTokens(left);
  const b = titleTokens(right);
  if (!a.length || !b.length) return 0;
  const bSet = new Set(b);
  const overlap = a.filter((token) => bSet.has(token)).length;
  return overlap / Math.min(a.length, b.length);
}

function storyClusterKey(value) {
  const normalized = normalizeTitle(value);
  if (normalized.includes('캠퍼스크루') || (normalized.includes('쿠팡풀필먼트') && normalized.includes('인증'))) return 'story:coupang-campuscrew';
  if (normalized.includes('롱탄') && normalized.includes('물류센터')) return 'story:long-thanh-logistics-center';
  if (normalized.includes('휴머노이드') && normalized.includes('물류센터')) return 'story:humanoid-logistics-center';
  if (normalized.includes('lx판토스') && normalized.includes('물류센터')) return 'story:lx-pantos-logistics-center';
  return '';
}

function removeNearDuplicateStories(items) {
  const selected = [];
  const clusters = new Set();
  for (const item of items) {
    const cluster = storyClusterKey(item.title);
    if (cluster && clusters.has(cluster)) continue;
    if (selected.some((existing) => titleSimilarity(existing.title, item.title) >= 0.45)) continue;
    if (cluster) clusters.add(cluster);
    selected.push(item);
  }
  return selected;
}

async function collectNews(windowStart, windowEnd) {
  const seen = new Map();
  const sourceStats = {};
  for (const query of SEARCH_QUERIES) {
    let rows = [];
    try {
      rows = await fetchGoogleNewsRss(`${query} when:${Math.ceil((windowEnd - windowStart) / (24 * HOUR_MS))}d`);
    } catch {
      rows = [];
    }
    let bingRows = [];
    try {
      bingRows = await fetchBingNewsRss(query);
    } catch {
      bingRows = [];
    }
    rows = [
      ...rows.map((item) => ({ ...item, source_name: 'google_news_rss' })),
      ...bingRows.map((item) => ({ ...item, source_name: item.source_name || 'bing_news_rss' })),
    ];
    for (const item of rows) {
      sourceStats[item.source_name || 'rss'] = (sourceStats[item.source_name || 'rss'] || 0) + 1;
      const publishedAt = new Date(item.pubDate);
      if (Number.isNaN(publishedAt.getTime())) continue;
      if (publishedAt < windowStart || publishedAt > windowEnd) continue;
      const title = stripHtml(item.title);
      const summary = stripHtml(item.description).slice(0, 500);
      const canonical = canonicalUrl(item.originallink || item.link);
      const titleHash = hash(normalizeTitle(title));
      const publisher = inferPublisher(item);
      const dedupeKey = canonical ? `url:${hash(canonical)}` : `title:${titleHash}`;
      const fallbackDedupeKey = `publisher-title-time:${hash(`${publisher}:${titleHash}:${publishedAt.toISOString().slice(0, 13)}`)}`;
      const scored = scoreItem({ title, summary });
      if (scored.score < 2) continue;
      const next = {
        dedupe_key: dedupeKey,
        canonical_url: canonical,
        original_url: item.link || canonical,
        title,
        publisher,
        published_at: publishedAt.toISOString(),
        summary,
        importance_score: scored.score,
        matched_keywords: scored.matched,
        source_name: item.source_name || 'rss',
        payload: { query, raw_pub_date: item.pubDate, fallback_dedupe_key: fallbackDedupeKey },
      };
      const current = seen.get(dedupeKey) || seen.get(fallbackDedupeKey);
      if (!current || Number(next.importance_score) > Number(current.importance_score)) {
        seen.set(dedupeKey, next);
        seen.set(fallbackDedupeKey, next);
      }
    }
  }
  const items = removeNearDuplicateStories(
    [...new Map([...seen.values()].map((item) => [item.dedupe_key, item])).values()]
      .sort((a, b) => Number(b.importance_score) - Number(a.importance_score) || Date.parse(b.published_at) - Date.parse(a.published_at)),
  ).slice(0, 10);
  items.sourceStats = sourceStats;
  return items;
}

function supabaseClientFromEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function upsertRun(client, runRow) {
  const result = await client.from('ll_news_runs').upsert(runRow, { onConflict: 'run_key' });
  if (result.error) throw new Error(`ll_news_runs upsert failed: ${result.error.message}`);
}

async function publish(run, items) {
  const supabase = supabaseClientFromEnv();
  const runRow = {
    news_run_id: uuidFromHash(run.run_key),
    run_key: run.run_key,
    scheduled_for: run.windowEnd.toISOString(),
    window_start: run.windowStart.toISOString(),
    window_end: run.windowEnd.toISOString(),
    source_summary: {
      collector_version: NEWS_COLLECTOR_VERSION,
      primary: 'google_news_rss',
      fallback: 'bing_news_rss',
      queries: SEARCH_QUERIES,
      query_count: SEARCH_QUERIES.length,
      window_hours: run.windowHours,
      strict_window_start: run.strictWindowStart?.toISOString?.() || run.windowStart.toISOString(),
      strict_window_end: run.windowEnd.toISOString(),
      strict_item_count: run.strictItemCount,
      expanded_to_recent_7d: run.expandedToRecent7d,
      source_stats: run.sourceStats || {},
      empty_state: items.length === 0,
    },
    run_status: 'completed',
    error_message: null,
    completed_at: new Date().toISOString(),
  };
  await upsertRun(supabase, runRow);
  const itemRows = items.map((item) => ({
    news_item_id: uuidFromHash(`${runRow.news_run_id}:${item.dedupe_key}`),
    news_run_id: runRow.news_run_id,
    ...item,
  }));
  if (itemRows.length) {
    const itemResult = await supabase.from('ll_news_items').upsert(itemRows, { onConflict: 'news_run_id,dedupe_key' });
    if (itemResult.error) throw new Error(`ll_news_items upsert failed: ${itemResult.error.message}`);
  }
  return { run: runRow, inserted_or_updated: itemRows.length };
}

async function publishFailure(run, error) {
  if (hasFlag('--dry-run')) return null;
  const supabase = supabaseClientFromEnv();
  const runRow = {
    news_run_id: uuidFromHash(run.run_key),
    run_key: run.run_key,
    scheduled_for: run.windowEnd.toISOString(),
    window_start: run.windowStart.toISOString(),
    window_end: run.windowEnd.toISOString(),
    source_summary: {
      collector_version: NEWS_COLLECTOR_VERSION,
      primary: 'google_news_rss',
      fallback: 'bing_news_rss',
      queries: SEARCH_QUERIES,
      query_count: SEARCH_QUERIES.length,
      window_hours: run.windowHours,
      empty_state: false,
    },
    run_status: 'failed',
    error_message: String(error?.message || error).slice(0, 1000),
    completed_at: new Date().toISOString(),
  };
  await upsertRun(supabase, runRow);
  return runRow;
}

async function main() {
  const { windowStart, windowEnd, windowHours } = parseWindow();
  const runKey = `daily-news:${kstDateKey(windowEnd)}:0700KST`;
  const run = { run_key: runKey, windowStart, windowEnd, windowHours, strictWindowStart: windowStart, strictItemCount: 0, expandedToRecent7d: false, sourceStats: {} };
  try {
    let items = await collectNews(windowStart, windowEnd);
    run.strictItemCount = items.length;
    run.sourceStats = items.sourceStats || {};
    if (items.length < 5) {
      run.expandedToRecent7d = true;
      run.windowStart = new Date(windowEnd.getTime() - 7 * 24 * HOUR_MS);
      items = await collectNews(run.windowStart, windowEnd);
      run.sourceStats = items.sourceStats || {};
    }
    const output = {
      ok: true,
      dry_run: hasFlag('--dry-run'),
      run_key: runKey,
      window_hours: windowHours,
      window_start: run.windowStart.toISOString(),
      strict_window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      strict_item_count: run.strictItemCount,
      expanded_to_recent_7d: run.expandedToRecent7d,
      source_stats: run.sourceStats,
      item_count: items.length,
      empty_message: items.length ? '' : '수집된 뉴스가 없습니다.',
      items,
    };
    if (!hasFlag('--dry-run')) output.published = await publish(run, items);
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    const failureRun = await publishFailure(run, error).catch((publishError) => ({ publish_error: publishError.message }));
    console.error(JSON.stringify({
      ok: false,
      dry_run: hasFlag('--dry-run'),
      run_key: runKey,
      window_hours: windowHours,
      window_start: run.windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      error: error.message,
      failure_run: failureRun,
    }, null, 2));
    process.exit(1);
  }
}

main();
