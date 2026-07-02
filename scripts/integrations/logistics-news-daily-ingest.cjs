#!/usr/bin/env node
/* eslint-disable no-console */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const GOOGLE_NEWS_RSS_URL = 'https://news.google.com/rss/search';
const BING_NEWS_RSS_URL = 'https://www.bing.com/news/search';
const NEWS_COLLECTOR_VERSION = 'google-bing-rss-v6-today-expands-when-sparse';
const MIN_DAILY_NEWS_ITEMS = 8;
const EXPANDED_RECENT_DAYS = 7;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const SEARCH_QUERIES = [
  '"물류센터" "임대료" OR "물류센터" "공실" OR "물류센터" "임대차"',
  '"물류센터" "렌트프리" OR "물류센터" "NOC" OR "물류창고" "임대"',
  '"물류센터" "매매" OR "물류센터" "거래" OR "물류센터" "선매입"',
  '"물류센터" "매각" OR "물류센터" "자산운용" OR "물류센터" "캡레이트"',
  '"물류부동산" "리포트" OR "물류센터" "시장 리포트" OR "물류센터" "전망"',
  '"물류센터" "공급" OR "물류센터" "개발" OR "물류센터" "준공"',
  '"저온물류센터" OR "콜드체인" "물류센터" OR "풀필먼트센터"',
  '"물류창고" "임대" OR "물류창고" "매매" OR "물류창고" "공실"',
  '"물류센터"',
  '"물류창고"',
  '"물류부동산"',
  '"풀필먼트센터" OR "풀필먼트 서비스"',
  '"택배" "물류" "센터"',
  '"저온물류" OR "콜드체인"',
  '쿠팡 물류센터 OR 쿠팡 풀필먼트 OR 쿠팡 물류',
  'CJ대한통운 물류센터 OR CJ대한통운 택배 OR CJ대한통운 물류',
  '한진 물류센터 OR 한진 택배 OR 한진 물류',
  '컬리 물류센터 OR 컬리 배송 OR 컬리 물류',
  '롯데글로벌로지스 OR 롯데 물류센터 OR 롯데택배',
  '현대글로비스 물류 OR 현대글로비스 물류센터',
  'LX판토스 물류 OR 판토스 물류센터',
  'DHL 물류 OR DHL 물류센터',
  '로젠택배 물류 OR 로젠 물류센터',
  'GS리테일 물류 OR BGF 물류 OR 우체국 물류',
  '"물류센터" "거래면적" OR "물류센터" "평당가" OR "물류센터" "매입"',
  '"물류센터" "공급예정" OR "물류센터" "인허가" OR "물류센터" "착공"',
  '"물류센터" "임대시장" OR "물류센터" "공실률" OR "물류센터" "렌트프리"',
  '"물류센터" "캡레이트" OR "물류부동산" "투자" OR "물류부동산" "거래"',
  '쿠팡 CJ대한통운 한진 컬리 롯데글로벌로지스 물류 배송 택배 투자 실적',
];

const LOGISTICS_CONTEXT_TERMS = ['물류센터', '물류 창고', '물류창고', '풀필먼트', 'fulfillment', '저온물류', '저온 물류', '상온물류', '택배', '배송', '3PL', '창고', '허브', '콜드체인', 'cold chain', '냉장', '냉동'];
const MARKET_DEAL_TERMS = ['매매', '거래', '선매입', '매각', '인수', '매수', '매도', '자산운용', '리츠', '펀드', '투자', '캡레이트', 'cap rate', 'PF'];
const LEASE_MARKET_TERMS = ['임대', '임대차', '임대료', '공실', '렌트프리', 'NOC', 'WALE', '테넌트', '임차'];
const SUPPLY_DEVELOPMENT_TERMS = ['공급', '개발', '착공', '준공', '인허가', '신규공급', '신규 공급', '공급예정', '공급 예정', '물류단지', '허가'];
const MARKET_REPORT_TERMS = ['시장 리포트', '물류시장', '물류부동산', '리포트', '보고서', '전망', '마켓', 'market report'];
const MAJOR_COMPANIES = [
  { key: 'coupang', label: '쿠팡', terms: ['쿠팡', 'Coupang'] },
  { key: 'cjlogistics', label: 'CJ대한통운', terms: ['CJ대한통운', '대한통운', 'CJ Logistics'] },
  { key: 'hanjin', label: '한진', terms: ['한진'] },
  { key: 'kurly', label: '컬리', terms: ['컬리', 'Kurly'] },
  { key: 'lotte', label: '롯데글로벌로지스', terms: ['롯데글로벌로지스', '롯데택배', '롯데 물류', '롯데'] },
  { key: 'ssg', label: 'SSG', terms: ['SSG', '쓱닷컴', '이마트'] },
  { key: 'lx-pantos', label: 'LX판토스', terms: ['LX판토스', '판토스'] },
  { key: 'hyundai-glovis', label: '현대글로비스', terms: ['현대글로비스', 'Glovis'] },
  { key: 'dhl', label: 'DHL', terms: ['DHL'] },
  { key: 'logen', label: '로젠', terms: ['로젠', '로젠택배'] },
  { key: 'gs-bgf', label: 'GS/BGF', terms: ['GS리테일', 'GS25', 'BGF', 'CU'] },
  { key: 'korea-post', label: '우체국', terms: ['우체국', '우정사업본부'] },
];
const CATEGORY_TARGETS = {
  market_deal: 4,
  lease_market: 2,
  supply_development: 2,
  major_company: 4,
};
const CATEGORY_ORDER = ['market_deal', 'lease_market', 'supply_development', 'major_company', 'other'];
const MAX_ITEMS_PER_COMPANY = 2;
const MAX_MAJOR_COMPANY_ONLY_ITEMS = 5;
const COMPANY_BUSINESS_TERMS = ['실적', '투자', '배송', '택배', '물류', '센터', '풀필먼트', '창고', '허브', '운송', '로봇', '자동화', '커머스', '신선', '새벽배송', 'parcel', 'delivery', 'logistics', 'fulfillment', 'robot', 'automation'];

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

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanNewsTitle(title, publisher = '') {
  let out = stripHtml(title);
  const publisherVariants = [
    publisher,
    String(publisher || '').replace(/\s+/g, ''),
    String(publisher || '').replace(/뉴스$/u, ''),
  ].filter(Boolean);
  for (const variant of publisherVariants) {
    const escaped = escapeRegExp(variant);
    out = out
      .replace(new RegExp(`\\s*[-|–—·ㆍ:]\\s*${escaped}\\s*$`, 'iu'), '')
      .replace(new RegExp(`^${escaped}\\s*[-|–—·ㆍ:]\\s*`, 'iu'), '');
  }
  return out
    .replace(/\s*[-|–—·ㆍ:]\s*(네이버뉴스|Google News|Bing News)\s*$/iu, '')
    .replace(/^\s*(?:\[중요\]|중요[:：-])\s*/iu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function matchTerms(text, terms) {
  const lower = String(text || '').toLowerCase();
  return terms.filter((term) => lower.includes(String(term).toLowerCase()));
}

function companyForText(text) {
  const lower = String(text || '').toLowerCase();
  return MAJOR_COMPANIES.find((company) => company.terms.some((term) => lower.includes(String(term).toLowerCase()))) || null;
}

function scoreItem(item) {
  const text = `${item.title} ${item.summary}`;
  const logisticsMatches = matchTerms(text, LOGISTICS_CONTEXT_TERMS);
  const dealMatches = matchTerms(text, MARKET_DEAL_TERMS);
  const leaseMatches = matchTerms(text, LEASE_MARKET_TERMS);
  const supplyMatches = matchTerms(text, SUPPLY_DEVELOPMENT_TERMS);
  const reportMatches = matchTerms(text, MARKET_REPORT_TERMS);
  const company = companyForText(text);
  const hasLogisticsContext = logisticsMatches.length > 0;
  const hasMarketSignal = dealMatches.length || leaseMatches.length || reportMatches.length;
  const hasSupplySignal = supplyMatches.length;
  const companyLogisticsSignal = company && /물류|센터|창고|풀필먼트|허브|택배|배송|터미널|fulfillment/iu.test(text);
  const companyBusinessSignal = company && matchTerms(text, COMPANY_BUSINESS_TERMS).length > 0;
  if ((!hasLogisticsContext || (!hasMarketSignal && !hasSupplySignal)) && !companyLogisticsSignal && !companyBusinessSignal) {
    return { score: 0, matched: [], category: 'noise', company: null };
  }
  let category = 'major_company';
  if (dealMatches.length || reportMatches.length) category = 'market_deal';
  else if (leaseMatches.length) category = 'lease_market';
  else if (supplyMatches.length) category = 'supply_development';
  else if (!company) category = 'other';
  const matched = [...new Set([
    ...logisticsMatches,
    ...dealMatches,
    ...leaseMatches,
    ...supplyMatches,
    ...reportMatches,
    ...(company ? [company.label] : []),
  ])];
  const score = (logisticsMatches.length * 1.5)
    + (dealMatches.length * 3)
    + (leaseMatches.length * 3)
    + (supplyMatches.length * 1.5)
    + (reportMatches.length * 3)
    + (company ? 2 : 0)
    + (companyBusinessSignal ? 1 : 0);
  return { score, matched, category, company };
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
    if (selected.some((existing) => titleSimilarity(existing.title, item.title) >= 0.62)) continue;
    if (cluster) clusters.add(cluster);
    selected.push(item);
  }
  return selected;
}

function companyKeyForItem(item) {
  return item?.payload?.company_key || companyForText(`${item?.title || ''} ${item?.summary || ''}`)?.key || '';
}

function selectBalancedNews(items, limit = 10) {
  const sorted = removeNearDuplicateStories(items).sort(
    (a, b) => Number(b.importance_score) - Number(a.importance_score) || Date.parse(b.published_at) - Date.parse(a.published_at),
  );
  const selected = [];
  const selectedKeys = new Set();
  const categoryCounts = {};
  const companyCounts = {};
  const canAdd = (item, enforceCategoryTarget) => {
    if (!item || selectedKeys.has(item.dedupe_key)) return false;
    const category = item.payload?.category || 'other';
    const companyKey = companyKeyForItem(item);
    if (companyKey && (companyCounts[companyKey] || 0) >= MAX_ITEMS_PER_COMPANY) return false;
    if (category === 'major_company' && (categoryCounts.major_company || 0) >= MAX_MAJOR_COMPANY_ONLY_ITEMS) return false;
    if (enforceCategoryTarget && CATEGORY_TARGETS[category] && (categoryCounts[category] || 0) >= CATEGORY_TARGETS[category]) return false;
    return true;
  };
  const add = (item, enforceCategoryTarget = false) => {
    if (!canAdd(item, enforceCategoryTarget)) return false;
    const category = item.payload?.category || 'other';
    const companyKey = companyKeyForItem(item);
    selected.push(item);
    selectedKeys.add(item.dedupe_key);
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    if (companyKey) companyCounts[companyKey] = (companyCounts[companyKey] || 0) + 1;
    return selected.length >= limit;
  };
  for (const category of CATEGORY_ORDER) {
    for (const item of sorted.filter((row) => (row.payload?.category || 'other') === category)) {
      if (add(item, true)) return selected;
    }
  }
  for (const item of sorted) {
    if (add(item, false)) return selected;
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
      const publisher = inferPublisher(item);
      const title = cleanNewsTitle(item.title, publisher);
      const summary = stripHtml(item.description).slice(0, 500);
      const canonical = canonicalUrl(item.originallink || item.link);
      const titleHash = hash(normalizeTitle(title));
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
        payload: {
          query,
          raw_pub_date: item.pubDate,
          fallback_dedupe_key: fallbackDedupeKey,
          category: scored.category,
          company_key: scored.company?.key || '',
          company_label: scored.company?.label || '',
        },
      };
      const current = seen.get(dedupeKey) || seen.get(fallbackDedupeKey);
      if (!current || Number(next.importance_score) > Number(current.importance_score)) {
        seen.set(dedupeKey, next);
        seen.set(fallbackDedupeKey, next);
      }
    }
  }
  const candidates = [...new Map([...seen.values()].map((item) => [item.dedupe_key, item])).values()];
  const items = selectBalancedNews(candidates, 10);
  items.sourceStats = sourceStats;
  items.candidateCount = candidates.length;
  return items;
}

async function collectDailyNewsWithExpansion(windowStart, windowEnd, windowHours) {
  const strictItems = await collectNews(windowStart, windowEnd);
  const shouldExpand = windowHours === 24 && strictItems.length < MIN_DAILY_NEWS_ITEMS;
  if (!shouldExpand) {
    return {
      items: strictItems,
      strictItemCount: strictItems.length,
      expandedToRecent7d: false,
      expandedWindowStart: windowStart,
      sourceStats: strictItems.sourceStats || {},
      candidateCount: strictItems.candidateCount || strictItems.length,
    };
  }
  const expandedWindowStart = new Date(windowEnd.getTime() - EXPANDED_RECENT_DAYS * 24 * HOUR_MS);
  const expandedItems = await collectNews(expandedWindowStart, windowEnd);
  return {
    items: expandedItems.length >= strictItems.length ? expandedItems : strictItems,
    strictItemCount: strictItems.length,
    expandedToRecent7d: true,
    expandedWindowStart,
    sourceStats: expandedItems.sourceStats || strictItems.sourceStats || {},
    candidateCount: expandedItems.candidateCount || strictItems.candidateCount || expandedItems.length || strictItems.length,
  };
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
      expanded_to_recent_7d: run.expandedToRecent7d === true,
      strict_24h_window: run.windowHours === 24,
      candidate_count: run.candidateCount || items.length,
      selection_policy: {
        limit: 10,
        category_targets: CATEGORY_TARGETS,
        max_items_per_company: MAX_ITEMS_PER_COMPANY,
        max_major_company_only_items: MAX_MAJOR_COMPANY_ONLY_ITEMS,
      },
      expanded_window_start: run.expandedWindowStart?.toISOString?.() || null,
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
  const selectedDedupeKeys = new Set(itemRows.map((item) => item.dedupe_key).filter(Boolean));
  const existingItems = await supabase
    .from('ll_news_items')
    .select('dedupe_key')
    .eq('news_run_id', runRow.news_run_id);
  if (existingItems.error) throw new Error(`ll_news_items readback failed: ${existingItems.error.message}`);
  const staleDedupeKeys = (existingItems.data || [])
    .map((item) => item.dedupe_key)
    .filter((key) => key && !selectedDedupeKeys.has(key));
  if (staleDedupeKeys.length) {
    const staleDelete = await supabase
      .from('ll_news_items')
      .delete()
      .eq('news_run_id', runRow.news_run_id)
      .in('dedupe_key', staleDedupeKeys);
    if (staleDelete.error) throw new Error(`ll_news_items stale cleanup failed: ${staleDelete.error.message}`);
  }
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
      strict_24h_window: run.windowHours === 24,
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
  const run = { run_key: runKey, windowStart, windowEnd, windowHours, strictWindowStart: windowStart, strictItemCount: 0, expandedToRecent7d: false, sourceStats: {}, candidateCount: 0 };
  try {
    const collected = await collectDailyNewsWithExpansion(windowStart, windowEnd, windowHours);
    const items = collected.items;
    run.strictItemCount = collected.strictItemCount;
    run.expandedToRecent7d = collected.expandedToRecent7d;
    run.expandedWindowStart = collected.expandedWindowStart;
    run.sourceStats = collected.sourceStats || {};
    run.candidateCount = collected.candidateCount || items.length;
    const output = {
      ok: true,
      dry_run: hasFlag('--dry-run'),
      run_key: runKey,
      window_hours: windowHours,
      window_start: run.windowStart.toISOString(),
      strict_window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      strict_item_count: run.strictItemCount,
      expanded_to_recent_7d: run.expandedToRecent7d === true,
      strict_24h_window: windowHours === 24,
      candidate_count: run.candidateCount,
      expanded_window_start: run.expandedWindowStart?.toISOString?.() || null,
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
