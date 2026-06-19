import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invokeDashboardApi } from '../../../utils/supabaseSession';

const CARD = 'rounded-[16px] border border-[#333333] bg-[#252524]';
const INNER = 'rounded-[12px] border border-[#333333] bg-[#1F1F1E]';
const MUTED = 'text-[#A1A1AA]';
const CHART_COLORS = {
  primary: '#9AD7FF',
  secondary: '#B5E48C',
  warning: '#FFD166',
  accent: '#A78BFA',
  danger: '#FF9F9F',
  neutral: '#C7C7CC',
};
const CHART_SERIES_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.warning,
  CHART_COLORS.accent,
  '#93C5FD',
  '#FCA5A5',
  '#86EFAC',
  '#E5E5E5',
];

const SOURCE_DOMAINS = [
  { key: 'lease_contracts', label: '임대차' },
  { key: 'fund_info', label: '펀드/금융' },
  { key: 'sector_market', label: '시장자료' },
  { key: 'permissions', label: '권한/사용자' },
  { key: 'asset_specs', label: '자산 스펙' },
  { key: 'operating_costs', label: '운영비용' },
];

const MARKET_TABS = [
  { id: 'overview', route: 'overview', label: 'Overview' },
  { id: 'lease', route: 'lease-market', label: 'Lease Market' },
  { id: 'supply', route: 'supply-pipeline', label: 'Supply Pipeline' },
  { id: 'transactions', route: 'transactions', label: 'Transactions' },
  { id: 'source', route: 'source-update', label: 'Source Update' },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, fallback = '-') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function firstText(...values) {
  const found = values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
  return found === undefined ? '' : found;
}

const CAPITAL_REGION_LABELS = new Set(['동남권', '남부권', '중앙권', '서부권', '서북권', '수도권기타권', '수도권']);
const LOCAL_REGION_LABELS = new Set(['경남권', '충청권', '전라권', '경북권', '지방기타권', '부산권', '대구권', '광주권', '지방']);

function compactLabel(value) {
  return String(value || '').replace(/\s+/gu, '');
}

function stripRegionNumber(value) {
  return text(value, '')
    .replace(/^\s*\d+\s*[.)\-_:/]?\s*/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function regionGroupFor(value, label) {
  const compact = compactLabel(label);
  if (!compact) return '';
  if (CAPITAL_REGION_LABELS.has(compact) || /수도권/u.test(compact)) return '수도권';
  if (LOCAL_REGION_LABELS.has(compact) || /지방/u.test(compact)) return '지방';
  const sequence = String(value || '').match(/^\s*(\d+)/u);
  if (sequence) return Number(sequence[1]) <= 6 ? '수도권' : '지방';
  return '';
}

function formatRegionLabel(value) {
  const raw = text(value, '');
  if (!raw) return '-';
  const stripped = stripRegionNumber(raw);
  if (!stripped) return '-';
  if (/^\((수도권|지방)\)/u.test(stripped)) return stripped;
  const group = regionGroupFor(raw, stripped);
  return group ? `(${group}) ${stripped}` : stripped;
}

function isRegionFieldName(field) {
  return /권역|region|수도권역|전국권역|세부_?권역/iu.test(String(field || ''));
}

function isInternalFieldName(field) {
  const source = String(field || '').trim();
  const normalized = source.toLowerCase().replace(/\s+/gu, '_');
  return !source
    || /^ll_/iu.test(source)
    || /^source_/iu.test(normalized)
    || normalized.includes('source_row_id')
    || normalized.includes('source_file_id')
    || normalized.includes('source_sheet_id')
    || normalized.includes('natural_key')
    || normalized.includes('row_hash')
    || normalized.includes('payload')
    || normalized === 'pnu'
    || source.toUpperCase() === 'PNU'
    || /법정동코드/u.test(source);
}

function hasInternalToken(value) {
  return /\bll_|source_row_id|source_file_id|source_sheet_id|natural_key|natural\s+key|row_hash|row\s+hash|payload|\bPNU\b|\bpnu\b|법정동코드/iu.test(String(value || ''));
}

function publicDisplayText(value, fallback = '관리 대상') {
  const source = text(value, '');
  if (!source) return fallback;
  return hasInternalToken(source) ? fallback : source;
}

function formatFieldLabel(field) {
  return fieldDisplayLabel(field);
}

function formatDisplayValue(value, field = '') {
  const hasField = text(field, '') !== '';
  if (hasField && (isInternalFieldName(field) || !isUserVisibleField(field))) return '관리값 숨김';
  if (hasField && isRegionFieldName(field)) return formatRegionLabel(value);
  if (value && typeof value === 'object') return '-';
  return publicDisplayText(value, '-');
}

function publicRowValueEntries(row, limit = 5) {
  const values = row?.row_values && typeof row.row_values === 'object' ? row.row_values : {};
  return Object.entries(values)
    .filter(([key, value]) => isUserVisibleField(key) && text(value, '') !== '' && !hasInternalToken(value))
    .slice(0, limit);
}

function sourceRowDisplayTitle(row) {
  const values = row?.row_values && typeof row.row_values === 'object' ? row.row_values : {};
  const titleKeys = ['물류센터명', '자산명', '센터명', '펀드명', '임차인명', '회사명', '주소', 'asset_name', 'center_name', 'fund_name'];
  const key = titleKeys.find((item) => text(values[item], '') !== '');
  return key ? formatDisplayValue(values[key], key) : `${text(row?.sheet_name, '원천')} ${formatNumber(row?.row_number)}행`;
}

function sourceRowDisplaySummary(row) {
  const entries = publicRowValueEntries(row, 3);
  if (!entries.length) return '표시 가능한 요약값 없음';
  return entries
    .map(([key, value]) => `${formatFieldLabel(key)}: ${formatDisplayValue(value, key)}`)
    .join(' · ');
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value, digits = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '-';
  return parsed.toLocaleString('ko-KR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatKrw(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) return '-';
  if (Math.abs(parsed) >= 100000000) return `${formatNumber(parsed / 100000000, 1)}억원`;
  if (Math.abs(parsed) >= 10000) return `${formatNumber(parsed / 10000, 0)}만원`;
  return `${formatNumber(parsed, 0)}원`;
}

function formatKrwAxis(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return '0';
  if (Math.abs(parsed) >= 1000000000000) return `${formatNumber(parsed / 1000000000000, 1)}조`;
  if (Math.abs(parsed) >= 100000000) return `${formatNumber(parsed / 100000000, parsed >= 1000000000 ? 0 : 1)}억`;
  if (Math.abs(parsed) >= 10000) return `${formatNumber(parsed / 10000, 0)}만`;
  return formatNumber(parsed, 0);
}

function formatRate(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '-';
  const normalized = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  return `${formatNumber(normalized, 2)}%`;
}

const CAPITAL_REGION_NAMES = ['동남권', '남부권', '중앙권', '서부권', '서북권', '수도권 기타권'];
const LOCAL_REGION_NAMES = ['경남권', '충청권', '전라권', '경북권', '지방 기타권'];
const REGION_ORDER = [...CAPITAL_REGION_NAMES, ...LOCAL_REGION_NAMES];
const REGION_SCOPE = new Map([
  ...CAPITAL_REGION_NAMES.map((region) => [region, '수도권']),
  ...LOCAL_REGION_NAMES.map((region) => [region, '지방']),
]);
const REGION_MAP_POSITIONS = {
  동남권: [58, 57],
  남부권: [47, 64],
  중앙권: [50, 50],
  서부권: [38, 56],
  서북권: [32, 42],
  '수도권 기타권': [54, 43],
  경남권: [70, 77],
  충청권: [48, 70],
  전라권: [35, 82],
  경북권: [65, 67],
  '지방 기타권': [52, 82],
};
const REGION_CENTER_COORDS = {
  동남권: [37.241, 127.249],
  남부권: [37.263, 127.028],
  중앙권: [37.493, 127.031],
  서부권: [37.456, 126.705],
  서북권: [37.658, 126.831],
  '수도권 기타권': [37.394, 127.111],
  경남권: [35.228, 128.681],
  충청권: [36.815, 127.114],
  전라권: [35.824, 127.148],
  경북권: [36.019, 128.343],
  '지방 기타권': [35.871, 128.601],
};
const INTERNAL_FIELD_PATTERN = /^ll_|^source_|(^|_)(id|uuid)$|source_row_id|source_file_id|source_sheet_id|row_hash|natural_key|payload|pnu|법정동|법정동코드|adm_code|legal_dong_code|geom|geometry|created_at|updated_at/iu;
const FIELD_LABELS = {
  asset_name: '자산명',
  center_name: '센터명',
  warehouse_name: '센터명',
  fund_name: '펀드명',
  display_name: '표시명',
  region: '권역',
  temperature_type: '상/저온',
  legal_address: '주소',
  gross_area_py: '연면적(평)',
  leasable_area_py: '임대면적(평)',
  rent_manwon_per_py: '임대료(평당 만원)',
  deposit_manwon_per_py: '보증금(평당 만원)',
  management_fee_manwon_per_py: '관리비(평당 만원)',
  rent_free_months_per_year: '렌트프리(개월/년)',
  vacancy_rate: '공실률',
  transaction_amount_krw: '거래금액',
  unit_price_krw_per_py: '평당 거래가',
  buyer_name: '매수인',
  seller_name: '매도인',
  owner_or_developer: '소유주/시행사',
  owner_name: '소유주',
  completion_period: '준공/예정 시점',
  status: '진행상태',
  progress_status: '진행상태',
};

function cleanRegionName(value) {
  const source = text(value, '').replace(/\s+/gu, ' ').trim();
  const sequence = source.match(/^\s*(\d+)/u);
  const cleaned = source
    .replace(/^\((수도권|지방)\)\s*/u, '')
    .replace(/^(수도권|지방)\s*[-·:]?\s*/u, '')
    .replace(/^\d+\s*[\).\-\s]\s*/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (sequence && Number(sequence[1]) <= 6 && /기타|여타/u.test(cleaned)) return '수도권 기타권';
  if (sequence && Number(sequence[1]) >= 7 && /기타|여타/u.test(cleaned)) return '지방 기타권';
  if (cleaned === '수도권기타권') return '수도권 기타권';
  if (cleaned === '지방기타권') return '지방 기타권';
  if (cleaned === '기타권(지방)' || cleaned === '여타권') return '지방 기타권';
  if (cleaned === '기타' || cleaned === '기타권') return '수도권 기타권';
  return cleaned;
}

function regionValue(value) {
  return cleanRegionName(value) || '미분류';
}

function regionDisplay(value) {
  const region = regionValue(value);
  if (region === '전체') return '전체';
  const scope = REGION_SCOPE.get(region);
  return scope ? `(${scope}) ${region}` : region;
}

function regionMatches(selected, rowRegion) {
  return selected === '전체' || regionValue(rowRegion) === selected;
}

function regionScopeOf(value) {
  return REGION_SCOPE.get(regionValue(value)) || '';
}

function makeRegionOptions(rows) {
  const set = new Set(safeArray(rows).map((row) => regionValue(row.region)).filter((region) => region && region !== '미분류'));
  const ordered = [...set].sort((a, b) => {
    const left = REGION_ORDER.indexOf(a);
    const right = REGION_ORDER.indexOf(b);
    if (left !== -1 || right !== -1) return (left === -1 ? 999 : left) - (right === -1 ? 999 : right);
    return a.localeCompare(b, 'ko');
  });
  return [{ value: '전체', label: '전체' }, ...ordered.map((region) => ({ value: region, label: regionDisplay(region) }))];
}

function isCapitalRegion(value) {
  return regionScopeOf(value) === '수도권';
}

function isLocalRegion(value) {
  return regionScopeOf(value) === '지방';
}

function supplyArea(row) {
  return number(row.gross_area_py || row.supply_area_py || row.area_py || row.gfa_py || row.leasable_area_py);
}

function supplyPeriodLabel(row) {
  return text(row.completion_period || row.expected_period || row.expected_quarter || row.expected_year || row.completion_year, '미정');
}

function periodSortValue(value) {
  const source = text(value, '').replace(/\s+/gu, ' ').trim();
  const compact = source.replace(/\s+/gu, '');
  const match = compact.match(/^(20\d{2})(?:(\d)Q|([12])H)?$/u);
  if (match) {
    const year = Number(match[1]);
    const quarter = match[2] ? Number(match[2]) : (match[3] === '1' ? 2 : match[3] === '2' ? 4 : 1);
    return year * 10 + quarter;
  }
  const dateMatch = source.match(/(20\d{2})/u);
  return dateMatch ? Number(dateMatch[1]) * 10 : 99999;
}

function periodDate(value, end = false) {
  const source = text(value, '').replace(/\s+/gu, '');
  const match = source.match(/^(20\d{2})(?:(\d)Q|([12])H)?$/u);
  if (!match) {
    const year = (source.match(/(20\d{2})/u) || [])[1];
    return year ? `${year}-${end ? '12-31' : '01-01'}` : '';
  }
  const year = match[1];
  if (match[2]) {
    const quarter = Number(match[2]);
    const startMonth = String((quarter - 1) * 3 + 1).padStart(2, '0');
    const endMonth = String(quarter * 3).padStart(2, '0');
    return end ? `${year}-${endMonth}-28` : `${year}-${startMonth}-01`;
  }
  if (match[3]) return match[3] === '1' ? `${year}-${end ? '06-30' : '01-01'}` : `${year}-${end ? '12-31' : '07-01'}`;
  return `${year}-${end ? '12-31' : '01-01'}`;
}

function supplyDate(row, end = false) {
  return periodDate(supplyPeriodLabel(row), end) || periodDate(row.expected_year || row.completion_year, end);
}

function readablePeriod(value) {
  const source = text(value, '');
  const compact = source.replace(/\s+/gu, '');
  const match = compact.match(/^(\d{4})([1-4]Q|[12]H)$/u);
  return match ? `${match[1]} ${match[2]}` : source;
}

function fieldDisplayLabel(field) {
  const source = text(field, '');
  if (!source) return '-';
  if (INTERNAL_FIELD_PATTERN.test(source)) return '관리 필드';
  return FIELD_LABELS[source] || source.replace(/_/gu, ' ').replace(/\b\w/gu, (char) => char.toUpperCase());
}

function isUserVisibleField(field) {
  return Boolean(field) && !INTERNAL_FIELD_PATTERN.test(String(field));
}

function formatDate(value) {
  const source = String(value || '');
  if (!source) return '-';
  return source.slice(0, 10);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().slice(0, 10);
}

function addDays(dateText, diff) {
  const match = String(dateText || '').match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return dateKey();
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

function formatNewsDateLabel(value) {
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return value || '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(date);
}

function cleanNewsTitleForDisplay(title, publisher = '') {
  let out = text(title, '');
  const variants = [publisher, text(publisher, '').replace(/\s+/g, ''), text(publisher, '').replace(/뉴스$/u, '')].filter(Boolean);
  variants.forEach((variant) => {
    const escaped = String(variant).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out
      .replace(new RegExp(`\\s*[-|–—·ㆍ:]\\s*${escaped}\\s*$`, 'iu'), '')
      .replace(new RegExp(`^${escaped}\\s*[-|–—·ㆍ:]\\s*`, 'iu'), '');
  });
  return out
    .replace(/\s*[-|–—·ㆍ:]\s*(네이버뉴스|Google News|Bing News)\s*$/iu, '')
    .replace(/^\s*(?:\[중요\]|중요[:：-])\s*/iu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function sourceDomainLabel(domain) {
  return SOURCE_DOMAINS.find((item) => item.key === domain)?.label || text(domain);
}

async function invoke(action, payload = {}) {
  const { data, error } = await invokeDashboardApi(action, payload);
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.message || data.error || `${action} failed`);
  return data?.data || data || {};
}

function userFacingLoadError() {
  return '데이터를 불러오지 못했습니다. 권한 또는 Supabase 반영 상태를 확인해 주세요.';
}

const USER_FACING_LOAD_ERROR_TEXT = '데이터를 불러오지 못했습니다. 탭을 다시 열거나 잠시 후 재시도해 주세요.';
const EDGE_DATA_CACHE_TTL_MS = 15 * 60 * 1000;
const EDGE_DATA_CACHE = new Map();
const EDGE_DATA_INFLIGHT = new Map();

function edgeCacheKey(action, payload = {}) {
  try {
    return `${action}:${JSON.stringify(payload || {})}`;
  } catch {
    return `${action}:unserializable`;
  }
}

function useEdgeData(action, payload = {}, deps = []) {
  const payloadKey = edgeCacheKey(action, payload);
  const cachedState = EDGE_DATA_CACHE.get(payloadKey);
  const [state, setState] = useState(() => (
    cachedState
      ? { loading: false, error: '', data: cachedState.data, loadedAt: cachedState.loadedAt }
      : { loading: true, error: '', data: null, loadedAt: 0 }
  ));
  const stateRef = useRef(state);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const reload = async (payloadOverride = {}, options = {}) => {
    const normalizedOverride = payloadOverride?.nativeEvent || payloadOverride?.target ? {} : (payloadOverride || {});
    const requestPayload = { ...payload, ...normalizedOverride };
    const requestKey = edgeCacheKey(action, requestPayload);
    const cached = EDGE_DATA_CACHE.get(requestKey);
    if (!options.force && !Object.keys(normalizedOverride).length && cached && Date.now() - cached.loadedAt < EDGE_DATA_CACHE_TTL_MS) {
      if (mountedRef.current) setState({ loading: false, error: '', data: cached.data, loadedAt: cached.loadedAt });
      return cached.data;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    if (!options.silent && mountedRef.current) setState((current) => ({ ...current, loading: !current.data, error: '' }));
    try {
      let requestPromise = EDGE_DATA_INFLIGHT.get(requestKey);
      if (!requestPromise) {
        requestPromise = invoke(action, requestPayload).finally(() => {
          EDGE_DATA_INFLIGHT.delete(requestKey);
        });
        EDGE_DATA_INFLIGHT.set(requestKey, requestPromise);
      }
      const data = await requestPromise;
      const loadedAt = Date.now();
      EDGE_DATA_CACHE.set(requestKey, { data, loadedAt });
      if (mountedRef.current && requestRef.current === requestId) {
        setState({ loading: false, error: '', data, loadedAt });
      }
      return data;
    } catch {
      const fallbackCached = EDGE_DATA_CACHE.get(requestKey) || EDGE_DATA_CACHE.get(payloadKey);
      if (mountedRef.current && requestRef.current === requestId) {
        setState((current) => ({
          loading: false,
          error: USER_FACING_LOAD_ERROR_TEXT,
          data: current.data || fallbackCached?.data || null,
          loadedAt: current.loadedAt || fallbackCached?.loadedAt || 0,
        }));
      }
      return null;
    }
  };
  useEffect(() => {
    mountedRef.current = true;
    const cached = EDGE_DATA_CACHE.get(payloadKey);
    if (cached) {
      setState({ loading: false, error: '', data: cached.data, loadedAt: cached.loadedAt });
      if (Date.now() - cached.loadedAt >= EDGE_DATA_CACHE_TTL_MS) reload({}, { silent: true, force: true });
      return () => {
        mountedRef.current = false;
      };
    }
    reload({}, { silent: Boolean(stateRef.current.data) });
    return () => {
      mountedRef.current = false;
    };
  }, [payloadKey, ...deps]);
  useEffect(() => {
    const refreshIfStale = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      const current = stateRef.current;
      const stale = current.loadedAt && Date.now() - current.loadedAt > EDGE_DATA_CACHE_TTL_MS;
      if (current.error || !current.data || stale) reload({}, { silent: Boolean(current.data), force: true });
    };
    window.addEventListener('focus', refreshIfStale);
    document.addEventListener('visibilitychange', refreshIfStale);
    return () => {
      window.removeEventListener('focus', refreshIfStale);
      document.removeEventListener('visibilitychange', refreshIfStale);
    };
  }, [payloadKey, ...deps]);
  return { ...state, reload };
}

function ModuleHeader({ eyebrow, title, subtitle, right = null }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">{eyebrow}</div>
        <h2 className="mt-1 text-[24px] font-semibold tracking-tight text-white">{title}</h2>
        {subtitle ? <p className="mt-2 max-w-[860px] text-[13px] leading-5 text-[#A1A1AA]">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <div className={`${INNER} px-4 py-3`}>
      <div className="text-[12px] font-semibold text-[#86868B]">{label}</div>
      <div className="mt-2 truncate text-[22px] font-semibold text-white" title={String(value)}>{value}</div>
      {detail ? <div className="mt-1 text-[11px] leading-5 text-[#86868B]">{detail}</div> : null}
    </div>
  );
}

function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-[10px] border border-[#333333] bg-[#1F1F1E] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          disabled={tab.disabled}
          onClick={() => !tab.disabled && onChange(tab.id)}
          className={`h-8 rounded-[7px] px-3 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${value === tab.id ? 'bg-white text-[#1F1F1E]' : 'text-[#A1A1AA] hover:text-white'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function Table({ headers, rows, empty = '표시할 데이터가 없습니다.', minWidth = 820, maxHeight = 420, stickyCount = 0, columnWidths = [] }) {
  const [sort, setSort] = useState(null);
  const visibleRows = useMemo(() => {
    const source = safeArray(rows);
    if (!sort) return source;
    return source.slice().sort((a, b) => {
      const left = a?.[sort.index];
      const right = b?.[sort.index];
      const leftNumber = Number(String(left ?? '').replace(/[^\d.-]/gu, ''));
      const rightNumber = Number(String(right ?? '').replace(/[^\d.-]/gu, ''));
      const result = Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && (String(left ?? '').match(/\d/u) || String(right ?? '').match(/\d/u))
        ? leftNumber - rightNumber
        : String(left ?? '').localeCompare(String(right ?? ''), 'ko');
      return sort.direction === 'desc' ? -result : result;
    });
  }, [rows, sort]);
  const nextSort = (index) => {
    setSort((current) => ({
      index,
      direction: current?.index === index && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };
  const columnWidth = (index) => columnWidths[index] || Math.max(128, Math.floor(minWidth / Math.max(1, headers.length)));
  const stickyLeft = (index) => `${Array.from({ length: index }).reduce((sum, _, widthIndex) => sum + number(columnWidths[widthIndex] || columnWidth(widthIndex)), 0)}px`;
  return (
    <div className="custom-scrollbar overflow-auto rounded-[12px] border border-[#333333]" style={{ maxHeight }} data-sortable-table="true">
      <table className="w-full table-fixed border-collapse text-left text-[12px]" style={{ minWidth }}>
        <colgroup>
          {headers.map((header, index) => <col key={header} style={{ width: columnWidth(index) }} />)}
        </colgroup>
        <thead className="sticky top-0 z-20 bg-[#1F1F1E] text-[#A1A1AA]">
          <tr>
            {headers.map((header, index) => {
              const sticky = index < stickyCount;
              return (
                <th
                  key={header}
                  style={{ width: columnWidth(index), left: sticky ? stickyLeft(index) : undefined }}
                  className={`whitespace-nowrap px-3 py-2 font-semibold ${sticky ? 'sticky z-30 bg-[#1F1F1E]' : ''}`}
                  data-sortable-column="true"
                >
                  <button type="button" onClick={() => nextSort(index)} className="inline-flex w-full items-center gap-1 hover:text-white" title={`${header} 기준 정렬`}>
                    {header}
                    <span className={`text-[10px] ${sort?.index === index ? 'text-white' : 'text-[#5f5f64]'}`}>{sort?.index === index ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#303033]">
          {visibleRows.length ? visibleRows.map((row, index) => (
            <tr key={index} className="bg-[#171717] text-[#E5E5E5]">
              {row.map((cell, cellIndex) => {
                const sticky = cellIndex < stickyCount;
                return (
                  <td
                    key={cellIndex}
                    style={{ width: columnWidth(cellIndex), left: sticky ? stickyLeft(cellIndex) : undefined }}
                    className={`max-w-0 truncate px-3 py-2 align-top ${sticky ? 'sticky z-10 bg-inherit' : ''}`}
                    title={typeof cell === 'string' || typeof cell === 'number' ? String(cell) : undefined}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          )) : (
            <tr>
              <td colSpan={headers.length} className="bg-[#171717] px-3 py-5 text-center text-[#86868B]">{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SortableTable({
  columns,
  rows,
  empty = '표시할 데이터가 없습니다.',
  minWidth = 960,
  maxHeight = 520,
  stickyCount = 0,
  onRowClick,
  defaultSort = null,
}) {
  const [sort, setSort] = useState(defaultSort || null);
  const visibleRows = useMemo(() => {
    const source = safeArray(rows);
    if (!sort?.key) return source;
    const column = columns.find((item) => item.key === sort.key);
    const sortValue = column?.sortValue || ((row) => row?.[sort.key]);
    return source.slice().sort((a, b) => {
      const left = sortValue(a);
      const right = sortValue(b);
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      let result = 0;
      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        result = leftNumber - rightNumber;
      } else {
        result = String(left ?? '').localeCompare(String(right ?? ''), 'ko');
      }
      return sort.direction === 'desc' ? -result : result;
    });
  }, [columns, rows, sort]);
  const nextSort = (column) => {
    if (column.sortable === false) return;
    setSort((current) => ({
      key: column.key,
      direction: current?.key === column.key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };
  const stickyLeft = (index) => `${columns.slice(0, index).reduce((sum, column) => sum + number(column.width || 168), 0)}px`;
  return (
    <div className="custom-scrollbar overflow-auto rounded-[12px] border border-[#333333]" style={{ maxHeight }} data-sortable-table="true">
      <table className="w-full border-collapse text-left text-[12px]" style={{ minWidth }}>
        <thead className="sticky top-0 z-20 bg-[#1F1F1E] text-[#A1A1AA]">
          <tr>
            {columns.map((column, index) => {
              const sticky = index < stickyCount;
              return (
                <th
                  key={column.key}
                  style={{ width: column.width, left: sticky ? stickyLeft(index) : undefined }}
                  className={`whitespace-nowrap px-3 py-2 font-semibold ${sticky ? 'sticky z-30 bg-[#1F1F1E]' : ''}`}
                  data-sortable-column={column.sortable === false ? 'false' : 'true'}
                >
                  <button
                    type="button"
                    disabled={column.sortable === false}
                    onClick={() => nextSort(column)}
                    className={`inline-flex w-full items-center gap-1 ${column.align === 'right' ? 'justify-end' : 'justify-start'} ${column.sortable === false ? 'cursor-default text-[#86868B]' : 'hover:text-white'}`}
                    title={column.sortable === false ? undefined : `${column.label} 기준 정렬`}
                  >
                    {column.label}
                    {column.sortable === false ? null : <span className={`text-[10px] ${sort?.key === column.key ? 'text-white' : 'text-[#5f5f64]'}`}>{sort?.key === column.key ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#303033]">
          {visibleRows.length ? visibleRows.map((row, rowIndex) => (
            <tr
              key={row.row_key || row.id || row.asset_id || row.fund_id || rowIndex}
              onClick={() => onRowClick?.(row)}
              className={`bg-[#171717] text-[#E5E5E5] ${onRowClick ? 'cursor-pointer hover:bg-[#222222]' : ''}`}
            >
              {columns.map((column, index) => {
                const sticky = index < stickyCount;
                const value = column.render ? column.render(row) : row[column.key];
                const wrapCell = column.noTruncate || column.wrap;
                return (
                  <td
                    key={column.key}
                    style={{ width: column.width, left: sticky ? stickyLeft(index) : undefined }}
                    className={`${wrapCell ? 'whitespace-normal break-keep' : 'max-w-0 truncate'} px-3 py-2 align-top ${column.align === 'right' ? 'text-right' : ''} ${sticky ? 'sticky z-10 bg-inherit' : ''}`}
                  >
                    {value ?? '-'}
                  </td>
                );
              })}
            </tr>
          )) : (
            <tr>
              <td colSpan={columns.length} className="bg-[#171717] px-3 py-5 text-center text-[#86868B]">{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Modal({ title, onClose, children, width = 'max-w-[1180px]', fullscreen = false }) {
  if (!title) return null;
  return (
    <div className={`fixed inset-0 z-[90] bg-black/70 px-4 ${fullscreen ? 'py-4' : 'py-8'}`} role="dialog" aria-modal="true">
      <div className={`mx-auto ${fullscreen ? 'h-[calc(100vh-32px)] max-h-[calc(100vh-32px)]' : 'max-h-[86vh]'} ${width} overflow-hidden rounded-[16px] border border-[#3A3A3C] bg-[#1F1F1E] shadow-2xl`}>
        <div className="flex items-center justify-between gap-3 border-b border-[#333333] px-5 py-4">
          <h3 className="truncate text-[18px] font-semibold text-white">{title}</h3>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#3A3A3C] text-[14px] font-bold text-white hover:bg-white/5">×</button>
        </div>
        <div className={`custom-scrollbar ${fullscreen ? 'max-h-[calc(100vh-96px)]' : 'max-h-[calc(86vh-64px)]'} overflow-auto p-5`}>{children}</div>
      </div>
    </div>
  );
}

function FilterPills({ label, options, value, onChange }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;
          return (
            <button
              key={optionValue}
              type="button"
              onClick={() => onChange(optionValue)}
              className={`h-8 rounded-[8px] border px-3 text-[12px] font-semibold ${value === optionValue ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] text-[#A1A1AA] hover:text-white'}`}
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function loadNaverMapsSdk(clientId) {
  if (window.naver?.maps?.Map) return Promise.resolve();
  if (window.__logisticsNaverMapsSdkPromise) return window.__logisticsNaverMapsSdkPromise;
  window.__logisticsNaverMapsSdkPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('logistics-naver-map-sdk') || document.querySelector('script[data-logistics-naver-map="true"]');
    const script = existing || document.createElement('script');
    const settleReady = () => {
      if (window.naver?.maps?.Map) resolve();
      else {
        window.__logisticsNaverMapsSdkPromise = null;
        reject(new Error('Naver Maps SDK unavailable'));
      }
    };
    const timeoutId = window.setTimeout(() => {
      if (window.naver?.maps?.Map) resolve();
      else {
        window.__logisticsNaverMapsSdkPromise = null;
        reject(new Error('Naver Maps SDK timeout'));
      }
    }, 30000);
    const complete = () => {
      window.clearTimeout(timeoutId);
      settleReady();
    };
    const fail = () => {
      window.clearTimeout(timeoutId);
      window.__logisticsNaverMapsSdkPromise = null;
      reject(new Error('Naver Maps SDK load failed'));
    };
    script.id = script.id || 'logistics-naver-map-sdk';
    script.setAttribute('data-logistics-naver-map', 'true');
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.addEventListener('load', complete, { once: true });
    script.addEventListener('error', fail, { once: true });
    if (!existing) document.head.appendChild(script);
    if (existing && window.naver?.maps?.Map) complete();
  });
  return window.__logisticsNaverMapsSdkPromise;
}

function MarketMapPanel({ title, rows, labelKey = 'asset_name', regionKey = 'region', onSelect }) {
  const sourceRows = safeArray(rows);
  const visibleRows = useMemo(() => sourceRows.slice(0, 120), [sourceRows]);
  const excludedCount = Math.max(0, sourceRows.length - visibleRows.length);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const cadastralLayerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const [mapStatus, setMapStatus] = useState({ status: 'checking', message: '지도 설정 확인 중' });
  const [mapDisplayType, setMapDisplayType] = useState('normal');
  const applyMapDisplayType = (map, nextType) => {
    if (!map || !window.naver?.maps) return;
    if (cadastralLayerRef.current) cadastralLayerRef.current.setMap(null);
    cadastralLayerRef.current = null;
    if (nextType === 'satellite') {
      map.setMapTypeId(window.naver.maps.MapTypeId.SATELLITE);
      return;
    }
    map.setMapTypeId(window.naver.maps.MapTypeId.NORMAL);
    if (nextType === 'cadastral' && window.naver.maps.CadastralLayer) {
      cadastralLayerRef.current = new window.naver.maps.CadastralLayer();
      cadastralLayerRef.current.setMap(map);
    }
  };
  const hashPosition = (label, axis) => {
    const code = String(label || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return 18 + ((code * (axis === 'x' ? 17 : 29)) % 64);
  };
  const plotRows = useMemo(() => visibleRows.map((row, index) => {
    const region = regionValue(row[regionKey]);
    const position = REGION_MAP_POSITIONS[region] || [hashPosition(region || row[labelKey], 'x'), hashPosition(region || row[labelKey], 'y')];
    const xValue = Number(row.x_percent);
    const yValue = Number(row.y_percent);
    const rawLat = Number(row.latitude ?? row.lat ?? row.y_coord);
    const rawLng = Number(row.longitude ?? row.lng ?? row.x_coord);
    const regionCenter = REGION_CENTER_COORDS[region];
    const offsetLat = ((index % 7) - 3) * 0.008;
    const offsetLng = ((Math.floor(index / 7) % 7) - 3) * 0.01;
    return {
      row,
      index,
      label: text(row[labelKey] || row.label),
      region,
      regionLabel: regionDisplay(region),
      left: Number.isFinite(xValue) ? xValue : Math.max(8, Math.min(92, position[0] + ((index % 5) - 2) * 2.3)),
      top: Number.isFinite(yValue) ? yValue : Math.max(8, Math.min(90, position[1] + ((Math.floor(index / 5) % 5) - 2) * 2.2)),
      lat: Number.isFinite(rawLat) ? rawLat : (regionCenter ? regionCenter[0] + offsetLat : null),
      lng: Number.isFinite(rawLng) ? rawLng : (regionCenter ? regionCenter[1] + offsetLng : null),
      fallback: !(Number.isFinite(rawLat) && Number.isFinite(rawLng)),
    };
  }), [visibleRows, regionKey, labelKey]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    markersRef.current.forEach((marker) => marker?.setMap?.(null));
    markersRef.current = [];
    const mappableRows = plotRows.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
    if (!mappableRows.length) {
      mapInstanceRef.current = null;
      setMapStatus({ status: 'fallback', message: '지도 API 미설정/좌표 부족 · 권역 기준 표시' });
      return () => {
        cancelled = true;
      };
    }
    const ensureNaverMaps = async () => {
      try {
        setMapStatus({ status: 'checking', message: 'Naver Maps SDK 로딩 중' });
        const config = await invoke('naver/maps-config', {});
        const clientId = config?.ncp_key_id || config?.client_id || config?.ncp_client_id || config?.ncpKeyId || config?.key_id;
        if (!clientId) {
          if (!cancelled) setMapStatus({ status: 'fallback', message: '지도 API 미설정/좌표 부족 · 권역 기준 표시' });
          return;
        }
        await loadNaverMapsSdk(clientId);
        if (cancelled || !mapRef.current || !window.naver?.maps) return;
        const first = mappableRows[0];
        const center = new window.naver.maps.LatLng(first.lat, first.lng);
        const map = new window.naver.maps.Map(mapRef.current, {
          center,
          zoom: 8,
          minZoom: 6,
          background: '#151515',
        });
        mapInstanceRef.current = map;
        applyMapDisplayType(map, mapDisplayType);
        markersRef.current = mappableRows.map((item) => {
          const marker = new window.naver.maps.Marker({
            position: new window.naver.maps.LatLng(item.lat, item.lng),
            map,
            title: `${item.label} · ${item.regionLabel}${item.fallback ? ' · 권역 기준' : ''}`,
          });
          window.naver.maps.Event.addListener(marker, 'click', () => onSelectRef.current?.(item.row));
          return marker;
        });
        setMapStatus({
          status: 'ready',
          message: mappableRows.some((item) => item.fallback) ? 'Naver Maps · 일부 권역 기준 표시' : 'Naver Maps',
        });
      } catch {
        if (!cancelled) setMapStatus({ status: 'fallback', message: '지도 API 미설정/좌표 부족 · 권역 기준 표시' });
      }
    };
    ensureNaverMaps();
    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker?.setMap?.(null));
      markersRef.current = [];
      if (cadastralLayerRef.current) cadastralLayerRef.current.setMap(null);
      cadastralLayerRef.current = null;
    };
  }, [plotRows]);

  useEffect(() => {
    applyMapDisplayType(mapInstanceRef.current, mapDisplayType);
  }, [mapDisplayType]);

  return (
    <div className={`${INNER} p-4`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[14px] font-semibold text-white">{title}</div>
        <div className="text-[11px] text-[#86868B]">{formatNumber(visibleRows.length)}건 표시{excludedCount ? ` / ${formatNumber(excludedCount)}건 축약` : ''}</div>
      </div>
      <div
        ref={mapRef}
        className="relative h-[520px] overflow-hidden rounded-[12px] border border-[#333333] bg-[#151515]"
        aria-label={`${title} 지도`}
        data-naver-map-ready={mapStatus.status === 'ready' ? 'true' : 'false'}
        data-map-fallback-ready={mapStatus.status !== 'ready' && plotRows.length ? 'true' : 'false'}
      >
        <div className="absolute right-3 top-3 z-10 flex overflow-hidden rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E]/90">
          {[
            ['normal', '일반'],
            ['satellite', '위성'],
            ['cadastral', '지적'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMapDisplayType(value)}
              className={`h-8 px-3 text-[11px] font-semibold ${mapDisplayType === value ? 'bg-white text-[#1F1F1E]' : 'text-[#A1A1AA] hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {mapStatus.status !== 'ready' ? (
          <>
            <div className="absolute inset-0 opacity-45" style={{ backgroundImage: 'linear-gradient(#2B2B2D 1px, transparent 1px), linear-gradient(90deg, #2B2B2D 1px, transparent 1px)', backgroundSize: '38px 38px' }} />
            {Object.entries(REGION_MAP_POSITIONS).map(([region, position]) => (
              <div key={region} className="absolute text-[10px] font-semibold text-[#5F6368]" style={{ left: `${position[0]}%`, top: `${position[1]}%` }}>{regionDisplay(region)}</div>
            ))}
            <div className="absolute left-3 top-3 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E]/90 px-3 py-2 text-[11px] text-[#FFD479]">
              {mapStatus.message}
            </div>
            {plotRows.map((item) => (
            <button
              key={item.row.row_key || item.row.id || item.index}
              type="button"
              title={`${item.label} · ${item.regionLabel}${item.fallback ? ' · 권역 기준' : ''}`}
              onClick={() => onSelect?.(item.row)}
              className="absolute h-3 w-3 rounded-full border border-white bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.14)] hover:bg-[#A1A1AA]"
              style={{ left: `${item.left}%`, top: `${item.top}%` }}
            />
            ))}
          </>
        ) : (
          <div className="absolute left-3 top-3 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E]/80 px-3 py-2 text-[11px] text-[#E5E5E5]">{mapStatus.message}</div>
        )}
        {!visibleRows.length ? <div className="absolute inset-0 grid place-items-center text-[13px] text-[#86868B]">표시할 지도 데이터가 없습니다.</div> : null}
      </div>
    </div>
  );
}

function ChartTooltip({ hover }) {
  if (!hover) return null;
  const details = Array.isArray(hover.detail)
    ? hover.detail
    : String(hover.detail || '').split('\n').filter(Boolean);
  return (
    <div
      className="pointer-events-none fixed z-[120] max-w-[340px] rounded-[8px] border border-[#3A3A3C] bg-[#111111] px-3 py-2 text-[11px] leading-5 text-[#E5E5E5] shadow-2xl"
      style={{ left: hover.x + 12, top: hover.y + 12 }}
    >
      <div className="font-semibold text-white">{hover.title}</div>
      <div className="text-[#A1A1AA]">{hover.value}</div>
      {details.length ? (
        <div className="mt-1 space-y-0.5 text-[#86868B]">
          {details.map((detail, index) => <div key={`${detail}-${index}`}>{detail}</div>)}
        </div>
      ) : null}
    </div>
  );
}

function TinyTrend({ rows, labelKey = 'label', valueKey = 'value', color = CHART_COLORS.primary, formatter = formatNumber }) {
  const [hover, setHover] = useState(null);
  const normalizedRows = safeArray(rows)
    .map((row) => ({ ...row, [labelKey]: text(row[labelKey], '미정'), [valueKey]: number(row[valueKey]) }))
    .filter((row) => text(row[labelKey], '') !== '');
  const nonZeroRows = normalizedRows.filter((row) => number(row[valueKey]) !== 0);
  const visibleRows = (nonZeroRows.length ? nonZeroRows : normalizedRows).slice(-14);
  const maxValue = Math.max(...visibleRows.map((row) => Math.abs(number(row[valueKey]))), 1);
  return (
    <div className="relative flex h-[190px] items-end gap-1 rounded-[12px] border border-[#333333] bg-[#171717] p-3" data-chart-role="tiny-trend" data-chart-empty={visibleRows.length ? 'false' : 'true'}>
      {visibleRows.length ? visibleRows.map((row) => (
        <div key={row[labelKey]} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
          <div
            className="w-full rounded-t-[4px] transition-opacity hover:opacity-80"
            title={`${row[labelKey]} ${formatter(row[valueKey])}`}
            onMouseMove={(event) => setHover({ x: event.clientX, y: event.clientY, title: text(row[labelKey]), value: formatter(row[valueKey]), detail: row.count ? `${formatNumber(row.count)}건` : '' })}
            onMouseLeave={() => setHover(null)}
            style={{ height: `${Math.max(8, Math.min(100, (Math.abs(number(row[valueKey])) / maxValue) * 100))}%`, backgroundColor: number(row[valueKey]) === 0 ? '#3A3A3C' : color }}
          />
          <div className="max-w-full truncate text-[10px] text-[#86868B]" title={text(row[labelKey])}>{row[labelKey]}</div>
        </div>
      )) : <div className="grid h-full w-full place-items-center text-[13px] text-[#86868B]">차트 데이터가 없습니다.</div>}
      <ChartTooltip hover={hover} />
    </div>
  );
}

function BarList({ rows, labelKey = 'label', valueKey = 'value', formatter = formatNumber, maxRows = 10, color = CHART_COLORS.primary }) {
  const [hover, setHover] = useState(null);
  const normalizedRows = safeArray(rows)
    .map((row) => ({ ...row, [labelKey]: text(row[labelKey], '미정'), [valueKey]: number(row[valueKey]) }))
    .filter((row) => text(row[labelKey], '') !== '');
  const nonZeroRows = normalizedRows.filter((row) => number(row[valueKey]) !== 0);
  const visibleRows = (nonZeroRows.length ? nonZeroRows : normalizedRows).slice(0, maxRows);
  const maxValue = Math.max(...visibleRows.map((row) => Math.abs(number(row[valueKey]))), 1);
  return (
    <div className="relative space-y-2" data-chart-role="bar-list" data-chart-empty={visibleRows.length ? 'false' : 'true'}>
      {visibleRows.length ? visibleRows.map((row) => {
        const value = number(row[valueKey]);
        return (
          <div
            key={row.id || row[labelKey]}
            className={`${INNER} px-3 py-2`}
            onMouseMove={(event) => setHover({ x: event.clientX, y: event.clientY, title: text(row[labelKey]), value: formatter(value), detail: row.count ? `${formatNumber(row.count)}건` : '' })}
            onMouseLeave={() => setHover(null)}
          >
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="truncate text-[12px] font-semibold text-white">{text(row[labelKey])}</span>
              <span className="shrink-0 text-[12px] font-semibold text-[#E5E5E5]">{formatter(value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#2C2C2E]">
              <div className="h-full rounded-full" style={{ width: `${Math.max(5, Math.min(100, (Math.abs(value) / maxValue) * 100))}%`, backgroundColor: value === 0 ? '#3A3A3C' : color }} />
            </div>
          </div>
        );
      }) : <div className={`${INNER} px-4 py-5 text-center text-[13px] text-[#86868B]`}>표시할 차트 데이터가 없습니다.</div>}
      <ChartTooltip hover={hover} />
    </div>
  );
}

function GroupedBarChart({ rows, formatter = formatNumber }) {
  const [hover, setHover] = useState(null);
  const sourceRows = safeArray(rows).filter((row) => text(row.label, '') && text(row.series, '') && Number.isFinite(Number(row.value)));
  const labels = [...new Set(sourceRows.map((row) => text(row.label)))];
  const series = [...new Set(sourceRows.map((row) => text(row.series)))];
  const maxValue = Math.max(...sourceRows.map((row) => Math.abs(number(row.value))), 1);
  const colors = CHART_SERIES_COLORS;
  return (
    <div className="relative rounded-[12px] border border-[#333333] bg-[#171717] p-4" data-chart-role="grouped-bar" data-chart-empty={sourceRows.length ? 'false' : 'true'}>
      {sourceRows.length ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-[11px] text-[#A1A1AA]">
            {series.map((item, index) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                {item}
              </span>
            ))}
          </div>
          {labels.map((label) => (
            <div key={label} className="grid grid-cols-[128px_1fr] items-center gap-3">
              <div className="truncate text-[12px] font-semibold text-white" title={label}>{label}</div>
              <div className="space-y-1.5">
                {series.map((item, index) => {
                  const row = sourceRows.find((candidate) => text(candidate.label) === label && text(candidate.series) === item);
                  const value = number(row?.value);
                  return (
                    <div key={`${label}-${item}`} className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#2C2C2E]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${row ? Math.max(4, Math.min(100, (Math.abs(value) / maxValue) * 100)) : 0}%`, backgroundColor: colors[index % colors.length] }}
                          onMouseMove={(event) => row && setHover({ x: event.clientX, y: event.clientY, title: `${label} · ${item}`, value: formatter(value), detail: row.metric_label })}
                          onMouseLeave={() => setHover(null)}
                        />
                      </div>
                      <div className="w-[64px] text-right text-[11px] text-[#E5E5E5]">{row ? formatter(value) : '-'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : <div className="grid h-[220px] place-items-center text-[13px] text-[#86868B]">표시할 차트 데이터가 없습니다.</div>}
      <ChartTooltip hover={hover} />
    </div>
  );
}

function SupplyAreaChart({ rows, seriesType, title, formatter = (value) => `${formatNumber(value, 0)}평` }) {
  const [hover, setHover] = useState(null);
  const sourceRows = safeArray(rows).filter((row) => row.series_type === seriesType && text(row.period_label, '') && Number.isFinite(Number(row.value)));
  const totalRows = sourceRows.filter((row) => row.label === '합계').sort((a, b) => text(a.period_key).localeCompare(text(b.period_key)));
  const periods = totalRows.length ? totalRows.map((row) => text(row.period_label)) : [...new Set(sourceRows.map((row) => text(row.period_label)))];
  const regionRows = sourceRows.filter((row) => row.region && !row.is_subtotal);
  const regions = [...new Set(regionRows.map((row) => regionDisplay(row.region)))].slice(0, 8);
  const values = [...totalRows, ...regionRows].map((row) => number(row.value));
  const maxValue = Math.max(...values, 1);
  const width = 820;
  const height = 260;
  const chartTop = 18;
  const chartBottom = 218;
  const xFor = (index) => periods.length <= 1 ? width / 2 : 54 + (index * (width - 108)) / (periods.length - 1);
  const yFor = (value) => chartBottom - (number(value) / maxValue) * (chartBottom - chartTop);
  const colors = CHART_SERIES_COLORS;
  return (
    <div className="relative rounded-[12px] border border-[#333333] bg-[#171717] p-4" data-chart-role="supply-area" data-chart-empty={sourceRows.length ? 'false' : 'true'}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[13px] font-semibold text-white">{title}</div>
        <div className="text-[11px] text-[#86868B]">합계는 막대, 권역은 선으로 표시</div>
      </div>
      {sourceRows.length ? (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full overflow-visible">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <line key={ratio} x1="42" x2={width - 34} y1={chartBottom - ratio * (chartBottom - chartTop)} y2={chartBottom - ratio * (chartBottom - chartTop)} stroke="#2C2C2E" strokeWidth="1" />
            ))}
            {totalRows.map((row, index) => {
              const x = xFor(index);
              const y = yFor(row.value);
              const barWidth = Math.max(12, Math.min(34, (width - 120) / Math.max(1, periods.length) - 8));
              return (
                <rect
                  key={row.period_label}
                  x={x - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={chartBottom - y}
                  rx="3"
                  fill={CHART_COLORS.primary}
                  opacity="0.78"
                  onMouseMove={(event) => setHover({ x: event.clientX, y: event.clientY, title: `${row.period_label} · 합계`, value: formatter(row.value) })}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
            {regions.map((region, regionIndex) => {
              const points = periods.map((period, index) => {
                const row = regionRows.find((item) => text(item.period_label) === period && regionDisplay(item.region) === region);
                return row ? [xFor(index), yFor(row.value), row] : null;
              }).filter(Boolean);
              const pointString = points.map(([x, y]) => `${x},${y}`).join(' ');
              return (
                <g key={region}>
                  {points.length > 1 ? <polyline points={pointString} fill="none" stroke={colors[(regionIndex + 1) % colors.length]} strokeWidth="2" opacity="0.85" /> : null}
                  {points.map(([x, y, row]) => (
                    <circle
                      key={`${region}-${row.period_label}`}
                      cx={x}
                      cy={y}
                      r="4"
                      fill={colors[(regionIndex + 1) % colors.length]}
                      onMouseMove={(event) => setHover({ x: event.clientX, y: event.clientY, title: `${row.period_label} · ${region}`, value: formatter(row.value) })}
                      onMouseLeave={() => setHover(null)}
                    />
                  ))}
                </g>
              );
            })}
            {periods.map((period, index) => (
              <text key={period} x={xFor(index)} y={244} textAnchor="middle" fill="#86868B" fontSize="10">{period.replace(' ', '\u00A0')}</text>
            ))}
          </svg>
          <div className="flex flex-wrap gap-3 text-[11px] text-[#A1A1AA]">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.primary }} />합계</span>
            {regions.map((region, index) => (
              <span key={region} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[(index + 1) % colors.length] }} />{region}</span>
            ))}
          </div>
        </>
      ) : <div className="grid h-[260px] place-items-center text-[13px] text-[#86868B]">표시할 차트 데이터가 없습니다.</div>}
      <ChartTooltip hover={hover} />
    </div>
  );
}

function RegionFilterGroups({ label, value, onChange, options }) {
  const sourceOptions = safeArray(options).filter((option) => option?.value !== '전체');
  const capital = sourceOptions.filter((option) => regionScopeOf(option.value) === '수도권');
  const local = sourceOptions.filter((option) => regionScopeOf(option.value) === '지방');
  const other = sourceOptions.filter((option) => !regionScopeOf(option.value));
  const renderGroup = (title, rows) => rows.length ? (
    <div>
      <div className="mb-1 text-[10px] font-semibold text-[#86868B]">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {rows.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`h-8 rounded-[8px] border px-3 text-[12px] font-semibold ${value === option.value ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] text-[#A1A1AA] hover:text-white'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  ) : null;
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">{label}</div>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onChange('전체')}
          className={`h-8 rounded-[8px] border px-3 text-[12px] font-semibold ${value === '전체' ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] text-[#A1A1AA] hover:text-white'}`}
        >
          전체
        </button>
        {renderGroup('수도권', capital)}
        {renderGroup('지방', local)}
        {renderGroup('기타', other)}
      </div>
    </div>
  );
}

function aggregateRows(rows, labelFn, valueFn) {
  const grouped = new Map();
  rows.forEach((row) => {
    const label = text(labelFn(row), '미입력');
    const current = grouped.get(label) || { label, value: 0, count: 0 };
    current.value += number(valueFn(row));
    current.count += 1;
    grouped.set(label, current);
  });
  return [...grouped.values()].sort((a, b) => number(b.value) - number(a.value));
}

function periodBucket(value) {
  const source = text(value, '');
  if (/^\d{4}-\d{2}/u.test(source)) return source.slice(0, 7);
  if (/^\d{4}/u.test(source)) return source.slice(0, 4);
  return '미입력';
}

function StackedCapitalChart({
  rows,
  labelKey = 'display_name',
  equityKey = 'equity_krw',
  loanKey = 'loan_krw',
  referenceKey = '',
  maxRows = 24,
  labelForRow = null,
  tooltipForRow = null,
  onRowClick = null,
}) {
  const [hover, setHover] = useState(null);
  const visibleRows = safeArray(rows)
    .filter((row) => number(row[equityKey]) + number(row[loanKey]) + number(referenceKey ? row[referenceKey] : 0) !== 0)
    .sort((a, b) => (
      number(b[equityKey]) + number(b[loanKey]) + number(referenceKey ? b[referenceKey] : 0)
      - number(a[equityKey]) - number(a[loanKey]) - number(referenceKey ? a[referenceKey] : 0)
    ))
    .slice(0, maxRows);
  const maxValue = Math.max(...visibleRows.map((row) => number(row[equityKey]) + number(row[loanKey]) + number(referenceKey ? row[referenceKey] : 0)), 1);
  return (
    <div className={`${INNER} relative overflow-hidden p-4`} data-chart-role="capital-stack" data-chart-empty={visibleRows.length ? 'false' : 'true'}>
      {visibleRows.length ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] text-[#A1A1AA]">
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.secondary }} />Equity</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.primary }} />Loan</span>
            {referenceKey ? <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.warning }} />공동펀드 참조</span> : null}
          </div>
          <div className="overflow-x-auto pr-1">
            <div className="min-w-[960px] space-y-1.5">
              {visibleRows.map((row) => {
                const equity = number(row[equityKey]);
                const loan = number(row[loanKey]);
                const reference = number(referenceKey ? row[referenceKey] : 0);
                const total = equity + loan + reference;
                const label = labelForRow ? labelForRow(row) : text(row[labelKey]);
                const tooltip = tooltipForRow
                  ? tooltipForRow(row, { equity, loan, reference, total, label })
                  : { title: label, value: `합계 ${formatKrw(total)}`, detail: `Equity ${formatKrw(equity)} · Loan ${formatKrw(loan)}${referenceKey ? ` · 참고 ${formatKrw(reference)}` : ''}` };
                const barWidth = Math.max(4, Math.min(100, (total / maxValue) * 100));
                return (
                  <button
                    key={row.id || row.asset_id || row.fund_id || row[labelKey]}
                    type="button"
                    data-chart-row="capital"
                    className="grid w-full grid-cols-[300px_minmax(360px,1fr)_120px] items-center gap-3 rounded-[8px] px-2 py-1.5 text-left hover:bg-white/[0.04]"
                    onClick={() => onRowClick?.(row)}
                    onMouseMove={(event) => setHover({ x: event.clientX, y: event.clientY, ...tooltip })}
                    onMouseLeave={() => setHover(null)}
                  >
                    <span className="truncate text-[12px] font-semibold text-white" title={label}>{label}</span>
                    <span className="block h-3 rounded-full bg-[#2C2C2E]">
                      <span className="flex h-full overflow-hidden rounded-full" style={{ width: `${barWidth}%` }}>
                        <span className="h-full" style={{ width: `${total ? (equity / total) * 100 : 0}%`, backgroundColor: CHART_COLORS.secondary }} />
                        <span className="h-full" style={{ width: `${total ? (loan / total) * 100 : 0}%`, backgroundColor: CHART_COLORS.primary }} />
                        {referenceKey ? <span className="h-full" style={{ width: `${total ? (reference / total) * 100 : 0}%`, backgroundColor: CHART_COLORS.warning }} /> : null}
                      </span>
                    </span>
                    <span className="text-right text-[12px] font-semibold text-[#E5E5E5]">{formatKrw(total)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : <div className="px-4 py-5 text-center text-[13px] text-[#86868B]">표시할 투자 데이터가 없습니다.</div>}
      <ChartTooltip hover={hover} />
    </div>
  );
}

function summarizeNames(values, max = 2) {
  const names = safeArray(values).map((value) => text(value, '')).filter(Boolean);
  if (!names.length) return '-';
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} 외 ${formatNumber(names.length - max)}개`;
}

function investmentDisplayLabel(row, mode) {
  if (mode === 'fund') return `${text(row.display_name)} · ${summarizeNames(row.asset_names)}`;
  return `${text(row.display_name)} · ${summarizeNames(row.fund_names)}`;
}

function rateValue(row) {
  return firstText(row.interest_rate, row.loan_rate, row.all_in_rate, row.spread_rate, null);
}

function isLoanTranche(row) {
  return text(row.capital_kind, '') === 'loan' || /loan|대출/iu.test(text(row.tranche_type_label, ''));
}

function hasMeaningfulLoanData(row) {
  if (!isLoanTranche(row)) return true;
  return number(firstText(row.amount_krw, row.committed_amount_krw, row.drawn_amount_krw, 0)) > 0
    || text(firstText(row.counterparty_name, row.party_name, row.lender_name, ''), '') !== ''
    || text(row.drawdown_date, '') !== ''
    || text(row.maturity_date, '') !== ''
    || text(firstText(row.interest_rate, row.loan_rate, row.all_in_rate, row.spread_rate, ''), '') !== ''
    || text(firstText(row.loan_type, row.loan_period, ''), '') !== '';
}

function trancheLabel(row) {
  const raw = text(firstText(row.tranche, row.tranche_name, row.tranche_label, row.tranche_code, ''), '').trim();
  if (!raw || raw === '-') return 'A';
  const normalized = raw
    .replace(/tranche/igu, '')
    .replace(/[()[\]{}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toUpperCase();
  if (!normalized) return 'A';
  const single = normalized.match(/\b([A-Z])\b/u);
  return single ? single[1] : normalized;
}

function normalizeInvestmentDetailRow(row, funds) {
  return {
    ...row,
    asset_display_label: text(firstText(row.asset_name, row.asset_display_name, assetLabelForFundId(row.fund_id, funds))),
    rate_display_value: rateValue(row),
    tranche_display: trancheLabel(row),
  };
}

function investmentDetailRows(row, mode, tranches) {
  const fundId = text(row.fund_id, '');
  const assetId = text(row.asset_id, '');
  const assetName = text(firstText(row.asset_name, row.display_name, ''), '');
  return safeArray(tranches).filter((tranche) => {
    if (!hasMeaningfulLoanData(tranche)) return false;
    if (mode === 'fund') return fundId && text(tranche.fund_id, '') === fundId;
    const trancheAssetId = text(tranche.asset_id, '');
    const trancheAssetName = text(firstText(tranche.asset_name, tranche.asset_display_name, ''), '');
    return (assetId && trancheAssetId === assetId) || (assetName && trancheAssetName && trancheAssetName === assetName);
  });
}

function topCounterpartyLines(rows, label, max = 3) {
  const source = safeArray(rows)
    .slice()
    .sort((a, b) => number(b.amount_krw) - number(a.amount_krw));
  if (!source.length) return [`${label}: 세부 내역 없음`];
  const lines = source.slice(0, max).map((row) => `${label}: ${text(row.counterparty_name, '미기재')} ${formatKrw(row.amount_krw)}`);
  if (source.length > max) lines.push(`${label}: 외 ${formatNumber(source.length - max)}건`);
  return lines;
}

function investmentTooltip(row, mode, tranches, metrics) {
  const details = investmentDetailRows(row, mode, tranches);
  const equityRows = details.filter((item) => !isLoanTranche(item));
  const loanRows = details.filter(isLoanTranche);
  return {
    title: metrics.label,
    value: `합계 ${formatKrw(metrics.total)}`,
    detail: [
      mode === 'fund' ? `연결 자산: ${summarizeNames(row.asset_names, 3)}` : `연결 펀드: ${summarizeNames(row.fund_names, 3)}`,
      ...topCounterpartyLines(equityRows, 'Equity 투자자', 2),
      ...topCounterpartyLines(loanRows, 'Loan 대주', 2),
      metrics.reference ? `공동펀드 참고: ${formatKrw(metrics.reference)}` : '',
    ].filter(Boolean),
  };
}

function monthKey(value) {
  const source = text(value, '');
  const match = source.match(/^(20\d{2})[-.](\d{1,2})/u);
  if (!match) return '';
  return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}`;
}

function currentMonthKey() {
  return dateKey().slice(0, 7);
}

function formatMonthKey(value) {
  const source = text(value, '');
  const match = source.match(/^(20\d{2})-(\d{2})$/u);
  return match ? `${match[1]}.${match[2]}` : source || '-';
}

function assetLabelForFundId(fundId, funds) {
  const fund = safeArray(funds).find((row) => text(row.fund_id, '') === text(fundId, ''));
  return summarizeNames(fund?.asset_names);
}

function normalizeLoanTrancheRows(tranches, funds) {
  const startMonth = currentMonthKey();
  return safeArray(tranches)
    .filter((row) => isLoanTranche(row) && hasMeaningfulLoanData(row) && row.maturity_date && monthKey(row.maturity_date) >= startMonth)
    .map((row) => ({
      ...row,
      asset_display_label: text(firstText(row.asset_name, row.asset_display_name, assetLabelForFundId(row.fund_id, funds))),
      month_key: monthKey(row.maturity_date),
      rate_display_value: rateValue(row),
      tranche_display: trancheLabel(row),
    }))
    .sort((a, b) => String(a.maturity_date || '').localeCompare(String(b.maturity_date || '')) || number(b.amount_krw) - number(a.amount_krw));
}

function addMonthsToKey(value, offset) {
  const match = text(value, '').match(/^(20\d{2})-(\d{2})$/u);
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function loanMaturityTimelineRows(rows) {
  const grouped = new Map();
  safeArray(rows).forEach((row) => {
    const key = row.month_key || monthKey(row.maturity_date);
    if (!key) return;
    const current = grouped.get(key) || { month_key: key, label: formatMonthKey(key), value: 0, count: 0, details: [] };
    current.value += number(row.amount_krw);
    current.count += 1;
    current.details.push(row);
    grouped.set(key, current);
  });
  const startMonth = currentMonthKey();
  const maxMonth = [...grouped.keys()].sort().pop() || startMonth;
  const output = [];
  let cursor = startMonth;
  let guard = 0;
  while (cursor && cursor <= maxMonth && guard < 96) {
    output.push(grouped.get(cursor) || { month_key: cursor, label: formatMonthKey(cursor), value: 0, count: 0, details: [] });
    cursor = addMonthsToKey(cursor, 1);
    guard += 1;
  }
  return output;
}

function LoanMaturityTimelineChart({ rows, onMonthClick }) {
  const [hover, setHover] = useState(null);
  const visibleRows = safeArray(rows);
  const maxValue = Math.max(...visibleRows.map((row) => number(row.value)), 1);
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  const axisWidth = 76;
  const plotHeight = 220;
  return (
    <div className="relative rounded-[12px] border border-[#333333] bg-[#171717] p-4" data-chart-role="loan-maturity-timeline" data-chart-empty={visibleRows.length ? 'false' : 'true'}>
      {visibleRows.length ? (
        <div className="custom-scrollbar overflow-x-auto pb-1">
          <div className="relative h-[320px]" style={{ minWidth: `${Math.max(980, visibleRows.length * 58)}px` }}>
            <div className="absolute inset-x-0 top-0 h-[250px]" style={{ paddingLeft: axisWidth }}>
              {ticks.map((tick) => (
                <div key={tick} className="absolute left-0 right-0" style={{ bottom: `${tick * plotHeight}px` }}>
                  <span
                    className="absolute left-0 -translate-y-1/2 pr-3 text-right text-[10px] leading-none text-[#86868B]"
                    style={{ width: axisWidth }}
                    data-y-axis-label="loan-maturity"
                  >
                    {formatKrwAxis(maxValue * tick)}
                  </span>
                  <span className="block h-px bg-[#3A3A3C]/70" />
                </div>
              ))}
            </div>
            <div className="absolute bottom-8 right-0 top-0 flex items-end gap-2" style={{ left: axisWidth }}>
              {visibleRows.map((row) => {
                const details = safeArray(row.details)
                  .slice()
                  .sort((a, b) => number(b.amount_krw) - number(a.amount_krw))
                  .slice(0, 4)
                  .map((item) => `${text(item.asset_display_label)} · ${text(item.counterparty_name, '대주 미기재')} · ${text(item.tranche_display, 'A')} · ${formatKrw(item.amount_krw)}`);
                if (safeArray(row.details).length > 4) details.push(`외 ${formatNumber(safeArray(row.details).length - 4)}건`);
                const value = number(row.value);
                return (
                  <button
                    key={row.month_key}
                    type="button"
                    data-chart-row="loan-maturity-month"
                    className="group flex min-w-[48px] flex-1 flex-col items-center justify-end gap-2"
                    onClick={() => onMonthClick?.(row)}
                    onMouseMove={(event) => setHover({
                      x: event.clientX,
                      y: event.clientY,
                      title: row.label,
                      value: value ? `만기 ${formatKrw(value)} · ${formatNumber(row.count)}건` : '만기 예정 없음',
                      detail: details.length ? details : ['해당 월 만기 건 없음'],
                    })}
                    onMouseLeave={() => setHover(null)}
                    aria-label={`${row.label} 대출 만기 ${formatKrw(value)}`}
                  >
                    <span
                      className="block w-full rounded-t-[5px] transition-opacity group-hover:opacity-80"
                      style={{ height: `${value ? Math.max(10, Math.min(plotHeight, (value / maxValue) * plotHeight)) : 2}px`, backgroundColor: value ? CHART_COLORS.primary : '#4A4A4F' }}
                    />
                    <span className="max-w-full truncate text-[10px] text-[#86868B]" title={row.label}>{row.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : <div className="grid h-[180px] place-items-center text-[13px] text-[#86868B]">현재 월 이후 대출 만기 데이터가 없습니다.</div>}
      <ChartTooltip hover={hover} />
    </div>
  );
}

function LoanRateHorizontalChart({ rows, onRowClick }) {
  const [hover, setHover] = useState(null);
  const visibleRows = safeArray(rows)
    .filter((row) => row.rate_display_value !== null && row.rate_display_value !== '')
    .slice()
    .sort((a, b) => number(b.rate_display_value) - number(a.rate_display_value));
  const maxRate = Math.max(...visibleRows.map((row) => Math.abs(number(row.rate_display_value))), 1);
  return (
    <div className={`${INNER} relative p-4`} data-chart-role="loan-rate-horizontal" data-chart-empty={visibleRows.length ? 'false' : 'true'}>
      {visibleRows.length ? (
        <div className="custom-scrollbar max-h-[620px] overflow-auto pr-1">
          <div className="min-w-[900px] space-y-1.5">
            {visibleRows.map((row) => {
              const rate = number(row.rate_display_value);
              const label = text(row.asset_display_label);
              return (
                <button
                  key={row.row_key || `${row.asset_display_label}-${row.tranche_filter}-${row.rate_display_value}`}
                  type="button"
                  data-chart-row="loan-rate-asset"
                  onClick={() => onRowClick?.(row)}
                  className="grid w-full grid-cols-[300px_minmax(360px,1fr)_92px] items-center gap-3 rounded-[8px] px-2 py-1.5 text-left hover:bg-white/[0.04]"
                  onMouseMove={(event) => setHover({
                    x: event.clientX,
                    y: event.clientY,
                    title: label,
                    value: formatRate(rate),
                    detail: [
                      `Tranche: ${text(row.tranche_label, '전체 평균')}`,
                      `가중평균 기준 대출금액: ${formatKrw(row.weighted_amount_krw)}`,
                      `세부 대출: ${formatNumber(safeArray(row.details).length)}건`,
                    ],
                  })}
                  onMouseLeave={() => setHover(null)}
                >
                  <span className="truncate text-[12px] font-semibold text-white" title={label}>{label}</span>
                  <span className="block h-3 rounded-full bg-[#2C2C2E]">
                    <span className="block h-full rounded-full" style={{ width: `${Math.max(3, Math.min(100, (Math.abs(rate) / maxRate) * 100))}%`, backgroundColor: CHART_COLORS.warning }} />
                  </span>
                  <span className="text-right text-[12px] font-semibold text-[#E5E5E5]">{formatRate(rate)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : <div className="px-4 py-5 text-center text-[13px] text-[#86868B]">표시할 대출 금리 데이터가 없습니다.</div>}
      <ChartTooltip hover={hover} />
    </div>
  );
}

function normalizeLoanRateRows(tranches, funds) {
  return safeArray(tranches)
    .filter((row) => isLoanTranche(row) && hasMeaningfulLoanData(row) && rateValue(row) !== null && rateValue(row) !== '')
    .map((row) => normalizeInvestmentDetailRow(row, funds))
    .sort((a, b) => text(a.asset_display_label).localeCompare(text(b.asset_display_label), 'ko') || text(a.tranche_display).localeCompare(text(b.tranche_display), 'ko'));
}

function weightedRate(rows) {
  const weighted = safeArray(rows).reduce((acc, row) => {
    const amount = Math.max(0, number(row.amount_krw));
    const rate = number(row.rate_display_value);
    if (!amount || !Number.isFinite(rate)) return acc;
    return { amount: acc.amount + amount, value: acc.value + (rate * amount) };
  }, { amount: 0, value: 0 });
  if (!weighted.amount) return null;
  return weighted.value / weighted.amount;
}

function groupLoanRateRows(rows, trancheFilter) {
  const source = safeArray(rows).filter((row) => trancheFilter === '전체 평균' || text(row.tranche_display) === trancheFilter);
  const grouped = new Map();
  source.forEach((row) => {
    const label = text(row.asset_display_label, '자산 미기재');
    const current = grouped.get(label) || {
      row_key: `loan-rate-${label}-${trancheFilter}`,
      asset_display_label: label,
      tranche_label: trancheFilter,
      tranche_filter: trancheFilter,
      weighted_amount_krw: 0,
      details: [],
    };
    current.weighted_amount_krw += number(row.amount_krw);
    current.details.push(row);
    grouped.set(label, current);
  });
  return [...grouped.values()]
    .map((row) => ({ ...row, rate_display_value: weightedRate(row.details) }))
    .filter((row) => row.rate_display_value !== null)
    .sort((a, b) => number(b.rate_display_value) - number(a.rate_display_value) || text(a.asset_display_label).localeCompare(text(b.asset_display_label), 'ko'));
}

function trancheSummaryRows(rows) {
  const grouped = new Map();
  safeArray(rows).forEach((row) => {
    const label = trancheLabel(row);
    const current = grouped.get(label) || { label, amount_krw: 0, count: 0 };
    current.amount_krw += number(row.amount_krw);
    current.count += 1;
    grouped.set(label, current);
  });
  return [...grouped.values()].sort((a, b) => text(a.label).localeCompare(text(b.label), 'ko'));
}

function trancheSummaryText(rows) {
  const summary = trancheSummaryRows(rows);
  return summary.length ? summary.map((row) => `${row.label} ${formatNumber(row.count)}건`).join(', ') : '-';
}

function domainSources(sources, domain) {
  return sources.filter((row) => row.source_domain === domain);
}

function DailyLogisticsNewsCardLegacy() {
  const [expanded, setExpanded] = useState(true);
  const todayKey = dateKey();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const { loading, error, data, reload } = useEdgeData('news/list', { limit: 10, date: selectedDate }, [selectedDate]);
  const dataDate = text(data?.selected_date, '');
  const dataMatchesSelection = !dataDate || dataDate === selectedDate;
  const items = dataMatchesSelection ? safeArray(data?.items) : [];
  const latestRun = dataMatchesSelection ? data?.latest_run || null : null;
  const selectedRunStatus = latestRun ? text(latestRun.run_status) : 'no_run';
  const setClampedDate = (value) => setSelectedDate(value && value <= todayKey ? value : todayKey);
  const goDate = (diff) => setSelectedDate((current) => {
    const nextDate = addDays(current || todayKey, diff);
    return nextDate <= todayKey ? nextDate : todayKey;
  });
  return (
    <section className={`${CARD} mb-[28px] p-5`}>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-start">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">NEWS</div>
          <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-white">데일리 물류 뉴스</h2>
          <div className="mt-1 text-[11px] text-[#86868B]">수집 기준 {latestRun ? formatDateTime(latestRun.window_end) : formatNewsDateLabel(selectedDate)} · {selectedRunStatus}</div>
        </div>
        <div className="flex w-full items-center justify-center gap-2 md:w-auto md:pt-6">
          <button
            type="button"
            aria-label="이전 날짜 뉴스"
            onClick={() => goDate(-1)}
            className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#3A3A3C] text-[15px] font-semibold text-[#E5E5E5] hover:bg-white/5"
          >
            ‹
          </button>
          <label className="relative h-8 min-w-[178px]">
            <span className="sr-only">뉴스 날짜 선택</span>
            <input
              type="date"
              value={selectedDate}
              max={todayKey}
              onChange={(event) => setClampedDate(event.target.value || todayKey)}
              className="h-8 w-full rounded-[8px] border border-[#3A3A3C] bg-[#181818] px-3 text-center text-[12px] font-semibold text-white outline-none hover:bg-white/5 focus:border-[#7DD3FC]"
            />
          </label>
          <button
            type="button"
            aria-label="다음 날짜 뉴스"
            onClick={() => goDate(1)}
            disabled={selectedDate >= todayKey}
            className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#3A3A3C] text-[15px] font-semibold text-[#E5E5E5] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35"
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-2 md:justify-end">
          <button type="button" onClick={() => reload(selectedDate === todayKey ? { refresh: true } : {})} className="h-8 rounded-[8px] border border-[#3A3A3C] px-3 text-[12px] font-semibold text-[#E5E5E5] hover:bg-white/5">새로고침</button>
          <button type="button" onClick={() => setExpanded((value) => !value)} className="h-8 rounded-[8px] border border-[#3A3A3C] px-3 text-[12px] font-semibold text-[#E5E5E5] hover:bg-white/5">
            {expanded ? '접기' : '펼치기'}
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-4">
          {error ? <div className="rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[12px] text-[#FFD479]">{error}</div> : null}
          {loading && !items.length ? <div className={`${INNER} px-4 py-5 text-center text-[13px] text-[#A1A1AA]`}>뉴스를 불러오는 중입니다.</div> : null}
          {!loading && !items.length && !error ? <div className={`${INNER} px-4 py-5 text-center text-[13px] text-[#86868B]`}>{text(data?.empty_message, '수집된 뉴스가 없습니다.')}</div> : null}
          {items.length ? (
            <div className="grid gap-2">
              {items.map((item) => (
                <a key={item.news_item_id || item.canonical_url} href={item.canonical_url || item.original_url} target="_blank" rel="noreferrer" className={`${INNER} block px-4 py-3 hover:bg-[#242424]`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-white">{text(item.title)}</div>
                      <div className={`mt-1 line-clamp-2 text-[12px] leading-5 ${MUTED}`}>{text(item.summary, '요약이 아직 생성되지 않았습니다.')}</div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] leading-5 text-[#86868B]">
                      <div>{text(item.publisher, '언론사 미확인')}</div>
                      <div>{formatDateTime(item.published_at)}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function DailyLogisticsNewsCard() {
  const [expanded, setExpanded] = useState(true);
  const todayKey = dateKey();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const { loading, error, data, reload } = useEdgeData('news/list', { limit: 10, date: selectedDate }, [selectedDate]);
  const dataDate = text(data?.selected_date, '');
  const dataMatchesSelection = !dataDate || dataDate === selectedDate;
  const items = dataMatchesSelection ? safeArray(data?.items).slice(0, 10) : [];
  const latestRun = dataMatchesSelection ? data?.latest_run || null : null;
  const selectedRunStatus = latestRun ? text(latestRun.run_status) : 'no_run';
  const setClampedDate = (value) => setSelectedDate(value && value <= todayKey ? value : todayKey);
  const goDate = (diff) => setSelectedDate((current) => {
    const nextDate = addDays(current || todayKey, diff);
    return nextDate <= todayKey ? nextDate : todayKey;
  });
  return (
    <section className={`${CARD} mb-[28px] p-5`}>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-start">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">NEWS</div>
          <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-white">데일리 물류 뉴스</h2>
          <div className="mt-1 text-[11px] text-[#86868B]">수집 기준 {latestRun ? formatDateTime(latestRun.window_end) : formatNewsDateLabel(selectedDate)} · {selectedRunStatus}</div>
        </div>
        <div className="flex w-full items-center justify-center gap-2 md:w-auto md:pt-7">
          <button type="button" aria-label="이전 날짜 뉴스" onClick={() => goDate(-1)} className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#3A3A3C] text-[15px] font-semibold text-[#E5E5E5] hover:bg-white/5">‹</button>
          <label className="relative h-8 min-w-[178px]">
            <span className="sr-only">뉴스 날짜 선택</span>
            <input
              type="date"
              value={selectedDate}
              max={todayKey}
              onChange={(event) => setClampedDate(event.target.value || todayKey)}
              className="h-8 w-full rounded-[8px] border border-[#3A3A3C] bg-[#181818] px-3 text-center text-[12px] font-semibold text-white outline-none hover:bg-white/5 focus:border-[#7DD3FC]"
            />
          </label>
          <button type="button" aria-label="다음 날짜 뉴스" onClick={() => goDate(1)} disabled={selectedDate >= todayKey} className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#3A3A3C] text-[15px] font-semibold text-[#E5E5E5] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35">›</button>
        </div>
        <div className="flex items-center gap-2 md:justify-end">
          <button type="button" onClick={() => reload(selectedDate === todayKey ? { refresh: true } : {})} className="h-8 rounded-[8px] border border-[#3A3A3C] px-3 text-[12px] font-semibold text-[#E5E5E5] hover:bg-white/5">새로고침</button>
          <button type="button" onClick={() => setExpanded((value) => !value)} className="h-8 rounded-[8px] border border-[#3A3A3C] px-3 text-[12px] font-semibold text-[#E5E5E5] hover:bg-white/5">
            {expanded ? '접기' : '펼치기'}
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-4">
          {error ? <div className="rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[12px] text-[#FFD479]">{error}</div> : null}
          {loading && !items.length ? <div className={`${INNER} px-4 py-5 text-center text-[13px] text-[#A1A1AA]`}>뉴스를 불러오는 중입니다.</div> : null}
          {!loading && !items.length && !error ? <div className={`${INNER} px-4 py-5 text-center text-[13px] text-[#86868B]`}>{text(data?.empty_message, '수집된 뉴스가 없습니다.')}</div> : null}
          {items.length ? (
            <div className="grid gap-1.5">
              {items.map((item) => {
                const title = cleanNewsTitleForDisplay(item.title, item.publisher);
                return (
                  <a key={item.news_item_id || item.canonical_url} href={item.canonical_url || item.original_url} target="_blank" rel="noreferrer" className={`${INNER} block px-3 py-2 hover:bg-[#242424]`}>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <div className="min-w-0 truncate text-[13px] font-semibold text-white">{text(title, '-')}</div>
                      <div className="shrink-0 text-right text-[11px] text-[#86868B]">
                        <span>{text(item.publisher, '언론사 미확인')}</span>
                        <span className="ml-2">{formatDateTime(item.published_at)}</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function MarketDataDashboardLegacy({ activeTab = 'overview', onNavigate }) {
  const currentTab = MARKET_TABS.some((tab) => tab.id === activeTab) ? activeTab : 'overview';
  const { loading, error, data, reload } = useEdgeData('sector-market/read', { limit: 2000 }, []);
  const summary = data?.summary || {};
  const leases = safeArray(data?.leases);
  const supply = safeArray(data?.supply);
  const transactions = safeArray(data?.transactions);
  const capRates = safeArray(data?.cap_rates);
  const sources = safeArray(data?.sources);
  const charts = data?.charts || {};
  const expectedCounts = summary.expected_counts || {};
  const readback = summary.readback || {};
  const readbackItems = Object.entries(readback).map(([key, value]) => ({
    key,
    label: {
      lease_observations: '임대 관측치',
      supply_cases: '공급 전체',
      pipeline_supply_cases: '공급 예정',
      new_supply_cases: '신규 공급',
      transaction_cases: '매매 사례',
      cap_rate_series: 'Cap Rate',
      new_supply_total_gross_area_py: '신규공급 면적',
    }[key] || key,
    ...(value || {}),
  }));
  const latestTransaction = transactions.reduce((best, row) => (number(row.transaction_amount_krw) > number(best?.transaction_amount_krw) ? row : best), null);
  const supplyByStatus = aggregateRows(supply, (row) => row.status, () => 1).slice(0, 8);
  const selectTab = (id) => {
    const route = MARKET_TABS.find((tab) => tab.id === id)?.route || 'overview';
    if (onNavigate) onNavigate(route);
  };
  return (
    <div className="w-full max-w-[1480px] mx-auto px-8 pt-8 pb-14">
      <ModuleHeader
        eyebrow="MARKET DATA"
        title="Market Data"
        subtitle="물류 시장 데이터_20261Q Excel을 단일 원천으로 사용해 임대, 공급, 매매, Cap Rate를 분리해 보여줍니다."
        right={<button type="button" onClick={reload} className="h-9 rounded-[8px] border border-[#3A3A3C] px-3 text-[13px] font-semibold text-white hover:bg-white/5">새로고침</button>}
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={MARKET_TABS} value={currentTab} onChange={selectTab} />
        <div className="text-[12px] text-[#86868B]">
          원천: {text(summary.source?.file_name, '물류 시장 데이터_20261Q.xlsx')} · {summary.status === 'ready' ? 'Active source 적용' : '원천 데이터 없음'}
        </div>
      </div>
      {error ? <div className="mb-4 rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[13px] text-[#FFD479]">{error}</div> : null}
      {loading ? <div className={`${INNER} px-4 py-6 text-center text-[#A1A1AA]`}>시장자료를 불러오는 중입니다.</div> : null}
      {!loading && summary.status !== 'ready' ? <div className={`${INNER} mb-4 px-4 py-5 text-center text-[13px] text-[#A1A1AA]`}>Supabase에 active 시장자료가 아직 없습니다.</div> : null}

      {currentTab === 'overview' ? (
        <div className="space-y-5">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="임대 관측치" value={`${formatNumber(summary.lease_observation_count || leases.length)}건`} detail={`검증 기준 ${formatNumber(expectedCounts.lease_observations || 0)}건`} />
            <MetricCard label="평당 임대료" value={summary.weighted_rent_manwon_per_py == null ? '-' : `${formatNumber(summary.weighted_rent_manwon_per_py, 1)}만원`} detail="임대면적 가중평균" />
            <MetricCard label="공급 예정" value={`${formatNumber(summary.pipeline_supply_count || 0)}건`} detail={`신규공급 ${formatNumber(summary.new_supply_total_gross_area_py, 1)}평`} />
            <MetricCard label="매매 사례" value={`${formatNumber(summary.transaction_case_count || transactions.length)}건`} detail={summary.latest_cap_rate ? `최근 ${summary.latest_cap_rate.region} Cap Rate ${formatRate(summary.latest_cap_rate.cap_rate)}` : '거래 사례 기준'} />
          </section>
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="LEASE" title="권역별 평당 임대료" />
              <BarList rows={safeArray(charts.lease_rent_by_region)} formatter={(value) => `${formatNumber(value, 1)}만원`} />
            </div>
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="CAP RATE" title="Cap Rate 추이" />
              <Table headers={['기간', '권역', 'Cap Rate']} rows={capRates.slice(0, 12).map((row) => [text(row.period_label), formatRegionLabel(row.region), formatRate(row.cap_rate)])} />
            </div>
          </section>
        </div>
      ) : null}

      {currentTab === 'lease' ? (
        <section className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="LEASE MARKET" title="임대 시장 비교" subtitle="권역, 상/저온, 규모별 임대료와 공실률을 함께 확인합니다." />
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard label="최신 기준" value={text(summary.latest_lease_period, '-')} detail="Excel report period" />
            <MetricCard label="관측치" value={`${formatNumber(summary.lease_observation_count || leases.length)}건`} detail={`샘플 표시 ${formatNumber(leases.length)}건`} />
            <MetricCard label="센터 수" value={`${formatNumber(summary.latest_lease_center_count || 0)}개`} detail="최신 기간 기준" />
            <MetricCard label="공실률" value={summary.weighted_vacancy_rate == null ? '-' : formatRate(summary.weighted_vacancy_rate)} detail="임대면적 가중평균" />
          </div>
          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <BarList rows={safeArray(charts.lease_rent_by_temperature)} formatter={(value) => `${formatNumber(value, 1)}만원`} color="#34D399" />
            <BarList rows={safeArray(charts.lease_vacancy_by_region)} formatter={formatRate} color="#F59E0B" />
          </div>
          <Table
            minWidth={980}
            headers={['기간', '권역', '센터명', '상/저온', '임대면적(평)', '평당 임대료(만원)', '관리비(만원)', '공실률']}
            rows={leases.slice(0, 250).map((row) => [
              text(row.report_period),
              formatRegionLabel(row.region),
              text(row.center_name),
              text(row.temperature_type),
              formatNumber(row.leasable_area_py, 1),
              formatNumber(row.rent_manwon_per_py, 1),
              formatNumber(row.management_fee_manwon_per_py, 1),
              row.vacancy_rate == null ? '-' : formatRate(row.vacancy_rate),
            ])}
          />
        </section>
      ) : null}

      {currentTab === 'supply' ? (
        <section className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="SUPPLY PIPELINE" title="공급 예정 및 신규 공급" subtitle="준공 예정 시점, 권역, 진행 상태별 공급 규모를 비교합니다." />
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard label="공급 전체" value={`${formatNumber(summary.supply_case_count || supply.length)}건`} detail={`검증 기준 ${formatNumber(expectedCounts.supply_cases || 0)}건`} />
            <MetricCard label="공급 예정" value={`${formatNumber(summary.pipeline_supply_count || 0)}건`} detail="Pipeline cases" />
            <MetricCard label="당분기 신규" value={`${formatNumber(summary.new_supply_count || 0)}건`} detail={`${formatNumber(summary.new_supply_total_gross_area_py, 1)}평`} />
            <MetricCard label="진행상태" value={`${formatNumber(supplyByStatus.length)}종`} detail="상태별 분포 확인" />
          </div>
          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <BarList rows={safeArray(charts.supply_by_period)} formatter={(value) => `${formatNumber(value, 1)}평`} color="#60A5FA" />
            <BarList rows={supplyByStatus} formatter={(value) => `${formatNumber(value)}건`} color="#34D399" />
          </div>
          <Table
            minWidth={980}
            headers={['구분', '준공 예정', '권역', '센터명', '상/저온', '연면적(평)', '진행상태', '시공/소유주']}
            rows={supply.slice(0, 250).map((row) => [
              row.supply_kind === 'new_supply' ? '당분기 신규공급' : '공급예정',
              text(row.completion_period),
              formatRegionLabel(row.region),
              text(row.center_name),
              text(row.temperature_type),
              formatNumber(row.gross_area_py, 1),
              text(row.status),
              text(row.owner_or_developer || row.contractor_name),
            ])}
          />
        </section>
      ) : null}

      {currentTab === 'transactions' ? (
        <section className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="TRANSACTIONS" title="매매 사례 비교" subtitle="권역, 거래시점, 평당 단가, Cap Rate를 비교합니다." />
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard label="매매 사례" value={`${formatNumber(summary.transaction_case_count || transactions.length)}건`} detail={`검증 기준 ${formatNumber(expectedCounts.transaction_cases || 0)}건`} />
            <MetricCard label="Cap Rate Row" value={`${formatNumber(summary.cap_rate_series_count || capRates.length)}건`} detail="수도권/전국 차트 전개 전" />
            <MetricCard label="최대 거래" value={latestTransaction ? formatKrw(latestTransaction.transaction_amount_krw) : '-'} detail={latestTransaction ? text(latestTransaction.asset_name) : '샘플 기준'} />
            <MetricCard label="표시 샘플" value={`${formatNumber(transactions.length)}건`} detail="전체 count는 readback 기준" />
          </div>
          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <BarList rows={safeArray(charts.transactions_by_region)} formatter={formatKrw} color="#A78BFA" />
            <BarList rows={aggregateRows(transactions, (row) => row.transaction_period || row.transaction_year, (row) => row.transaction_amount_krw).slice(0, 10)} formatter={formatKrw} color="#60A5FA" />
          </div>
          <Table
            minWidth={1050}
            headers={['거래시점', '권역', '자산명', '연면적(평)', '거래금액', '평당 단가', '매수/매도', 'Cap Rate']}
            rows={transactions.slice(0, 250).map((row) => [
              text(row.transaction_period || row.transaction_date),
              formatRegionLabel(row.region),
              text(row.asset_name),
              formatNumber(row.area_py, 1),
              formatKrw(row.transaction_amount_krw),
              formatKrw(row.unit_price_krw_per_py),
              [row.buyer_name, row.seller_name].filter(Boolean).join(' / ') || '-',
              row.cap_rate == null ? '-' : formatRate(row.cap_rate),
            ])}
          />
        </section>
      ) : null}

      {currentTab === 'source' ? (
        <section className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="SOURCE UPDATE" title="분기별 Excel 업데이트 관리" subtitle="업로드, dry-run 검증, active 버전 교체, readback 확인 순서로 관리합니다." />
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard label="Active 상태" value={summary.status === 'ready' ? '정상' : '확인 필요'} detail={text(summary.source?.source_version, 'active 없음')} />
            <MetricCard label="원본 행" value={`${formatNumber(Object.values(summary.source?.row_counts || {}).reduce((sum, value) => sum + number(value), 0))}건`} detail="업로드 원천 기준" />
            <MetricCard label="정규화 합계" value={`${formatNumber((summary.lease_observation_count || 0) + (summary.supply_case_count || 0) + (summary.transaction_case_count || 0) + (summary.cap_rate_series_count || 0))}건`} detail="분석 데이터 readback" />
            <MetricCard label="Readback" value={readbackItems.every((item) => item.ok !== false) ? '통과' : '불일치'} detail="expected vs actual" />
          </div>
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            {['업로드', 'Dry-run 검증', 'Diff/승인', 'Active 교체'].map((step, index) => (
              <div key={step} className={`${INNER} px-4 py-4`}>
                <div className="text-[11px] font-semibold text-[#86868B]">STEP {index + 1}</div>
                <div className="mt-2 text-[14px] font-semibold text-white">{step}</div>
              </div>
            ))}
          </div>
          <div className="mb-5">
            <Table
              minWidth={820}
              headers={['검증 항목', '기대값', '실제값', '결과']}
              rows={readbackItems.map((item) => [
                item.label,
                item.expected == null ? '-' : formatNumber(item.expected, item.key.includes('area') ? 1 : 0),
                item.actual == null ? '-' : formatNumber(item.actual, item.key.includes('area') ? 1 : 0),
                item.ok === false ? '불일치' : '통과',
              ])}
            />
          </div>
          <Table
            minWidth={980}
            headers={['파일', '버전', 'Active', '상태', '원본 행수', '업데이트']}
            rows={sources.map((row) => [
              text(row.file_name),
              text(row.source_version),
              row.active_version ? 'Y' : 'N',
              text(row.parse_status),
              formatNumber(Object.values(row.row_counts || {}).reduce((sum, value) => sum + number(value), 0)),
              formatDate(row.updated_at || row.created_at),
            ])}
          />
        </section>
      ) : null}
    </div>
  );
}

export function MarketDataDashboard({ activeTab = 'overview', onNavigate = null }) {
  const currentTab = MARKET_TABS.find((tab) => tab.id === activeTab || tab.route === activeTab)?.id || 'overview';
  const { loading, error, data, reload } = useEdgeData('sector-market/read', { limit: 12000 }, []);
  const [modal, setModal] = useState(null);
  const [txnWindow, setTxnWindow] = useState('3y');
  const [txnRegion, setTxnRegion] = useState('전체');
  const [txnTemp, setTxnTemp] = useState('전체');
  const [txnType, setTxnType] = useState('전체');
  const [txnSizeRegion, setTxnSizeRegion] = useState('전체');
  const [txnSizePeriod, setTxnSizePeriod] = useState('전체');
  const [txnSizeBucket, setTxnSizeBucket] = useState('전체');
  const [leaseSegment, setLeaseSegment] = useState('전체');
  const [leaseMeasure, setLeaseMeasure] = useState('rent_manwon_per_py');
  const [leaseRegion, setLeaseRegion] = useState('전체');
  const [leaseSearch, setLeaseSearch] = useState('');
  const [leaseStatisticPeriod, setLeaseStatisticPeriod] = useState('');
  const [leaseHistoryPeriod, setLeaseHistoryPeriod] = useState('전체');
  const [leaseHistoryRegion, setLeaseHistoryRegion] = useState('전체');
  const [leaseHistorySearch, setLeaseHistorySearch] = useState('');
  const [supplyStart, setSupplyStart] = useState('2024-01-01');
  const [supplyEnd, setSupplyEnd] = useState('2028-12-31');
  const [supplyKind, setSupplyKind] = useState('전체');
  const summary = data?.summary || {};
  const leases = safeArray(data?.leases);
  const supply = safeArray(data?.supply);
  const transactions = safeArray(data?.transactions);
  const capRates = safeArray(data?.cap_rates);
  const sources = safeArray(data?.sources);
  const charts = data?.charts || {};
  const marketViews = data?.views || {};
  const leaseView = marketViews.lease || {};
  const supplyView = marketViews.supply || {};
  const leaseStatisticRows = safeArray(leaseView.statistics_rows);
  const supplyStatisticRows = safeArray(supplyView.statistics_rows);
  const sourceAudit = summary.source_audit || {};
  const expectedCounts = summary.expected_counts || {};
  const readback = summary.readback || {};
  const supplyKindOptions = [
    { value: '전체', label: '전체' },
    { value: 'new_supply', label: '신규공급' },
    { value: 'pipeline', label: '공급예정' },
  ];
  const leaseStatisticPeriods = safeArray(leaseView.statistics_periods).length
    ? safeArray(leaseView.statistics_periods)
    : [...new Set(leaseStatisticRows.map((row) => text(row.period_label, '')).filter(Boolean))];
  const selectedLeaseStatisticPeriod = leaseStatisticPeriod || text(leaseView.statistics_latest_period, '') || leaseStatisticPeriods.at(-1) || '';
  useEffect(() => {
    if (!leaseStatisticPeriod && selectedLeaseStatisticPeriod) setLeaseStatisticPeriod(selectedLeaseStatisticPeriod);
  }, [leaseStatisticPeriod, selectedLeaseStatisticPeriod]);
  const regions = makeRegionOptions([...leases, ...supply, ...transactions]);
  const temps = ['전체', ...new Set([...leases, ...supply, ...transactions].map((row) => text(row.temperature_type, '')).filter(Boolean))].filter(Boolean).slice(0, 10);
  const transactionTypes = ['전체', ...new Set(transactions.map((row) => text(row.transaction_type || row.deal_type, '')).filter(Boolean))].slice(0, 8);
  const maxTxnYear = Math.max(...transactions.map((row) => number(row.transaction_year || String(row.transaction_date || '').slice(0, 4))), new Date().getFullYear());
  const yearFrom = (row) => number(row.transaction_year || String(row.transaction_date || row.transaction_period || '').slice(0, 4));
  const txnWindowYears = { '1y': 1, '3y': 3, '5y': 5 }[txnWindow] || 3;
  const filteredTransactions = transactions.filter((row) => {
    const year = yearFrom(row);
    const inWindow = year ? year >= maxTxnYear - txnWindowYears + 1 : true;
    const regionOk = regionMatches(txnRegion, row.region);
    const tempOk = txnTemp === '전체' || text(row.temperature_type) === txnTemp;
    const typeText = text(row.transaction_type || row.deal_type, '');
    const typeOk = txnType === '전체' || typeText === txnType;
    return inWindow && regionOk && tempOk && typeOk;
  });
  const latestLeasePeriod = summary.latest_lease_period || leases.map((row) => text(row.report_period)).filter(Boolean).sort().at(-1);
  const latestLeases = leases.filter((row) => !latestLeasePeriod || text(row.report_period) === latestLeasePeriod);
  const leaseMeasureOptions = [
    { value: 'deposit_manwon_per_py', label: '보증금' },
    { value: 'rent_manwon_per_py', label: '임대료' },
    { value: 'management_fee_manwon_per_py', label: '관리비' },
    { value: 'rent_free_months_per_year', label: '렌트프리' },
    { value: 'rent_free_vacancy_10', label: '렌트프리(공실률 10% 이상)' },
    { value: 'vacancy_rate', label: '공실률' },
  ];
  const leaseMetricValue = (row) => {
    if (leaseMeasure === 'rent_free_vacancy_10') {
      const vacancy = number(row.vacancy_rate);
      const normalized = Math.abs(vacancy) <= 1 ? vacancy * 100 : vacancy;
      return normalized >= 10 ? number(row.rent_free_months_per_year) : 0;
    }
    return row[leaseMeasure];
  };
  const leaseMetricFormatter = leaseMeasure === 'vacancy_rate' ? formatRate : (value) => formatNumber(value, 1);
  const leaseStatisticAvailableSegments = new Set(leaseStatisticRows.map((row) => text(row.segment_label, '')).filter(Boolean));
  const leaseSegmentOptions = ['전체', '복합 전체', '복합 상온', '복합 저온', '상온', '저온', '상온(복합포함)', '저온(복합포함)']
    .filter((option) => option === '전체' || leaseStatisticAvailableSegments.size === 0 || leaseStatisticAvailableSegments.has(option));
  const leaseStatisticBaseRows = leaseStatisticRows.filter((row) => (
    text(row.period_label) === selectedLeaseStatisticPeriod
    && text(row.metric_key) === leaseMeasure
    && text(row.dimension_type) === 'region'
    && row.is_average !== true
  ));
  const leaseStatisticDisplayRows = (leaseSegment === '전체'
    ? leaseStatisticBaseRows
    : leaseStatisticBaseRows.filter((row) => text(row.segment_label) === leaseSegment)
  );
  const leaseStatisticChartRows = leaseStatisticDisplayRows.map((row) => ({
    label: regionDisplay(row.region || row.label),
    series: text(row.segment_label),
    value: row.value,
    metric_label: row.metric_label,
  }));
  const overviewLeaseRentRows = leaseStatisticRows
    .filter((row) => text(row.period_label) === selectedLeaseStatisticPeriod && text(row.metric_key) === 'rent_manwon_per_py' && text(row.dimension_type) === 'region' && text(row.segment_label) === '복합 상온' && row.is_average !== true)
    .map((row) => ({ label: regionDisplay(row.region || row.label), value: row.value, count: 1 }));
  const leaseSegmentedRows = latestLeases.filter((row) => {
    const temp = text(row.temperature_type);
    if (leaseSegment.startsWith('복합')) return /복합/iu.test(temp);
    if (leaseSegment === '상온') return /상온|dry|ambient/iu.test(temp) && !/저온|냉동|냉장|복합|cold/iu.test(temp);
    if (leaseSegment === '저온') return /저온|냉동|냉장|cold/iu.test(temp) && !/상온|복합|dry|ambient/iu.test(temp);
    if (leaseSegment === '상온(복합포함)') return !/저온만|cold only/iu.test(temp);
    if (leaseSegment === '저온(복합포함)') return /저온|냉동|냉장|복합|cold/iu.test(temp);
    return true;
  });
  const filteredLeaseRows = leaseSegmentedRows
    .filter((row) => regionMatches(leaseRegion, row.region))
    .filter((row) => !leaseSearch || `${row.center_name} ${row.legal_address}`.toLowerCase().includes(leaseSearch.toLowerCase()))
    .sort((a, b) => number(b.gross_area_py || b.leasable_area_py) - number(a.gross_area_py || a.leasable_area_py));
  const capitalLeaseRows = leaseSegmentedRows.filter((row) => isCapitalRegion(row.region));
  const localLeaseRows = leaseSegmentedRows.filter((row) => isLocalRegion(row.region));
  const newSupplyRows = supply.filter((row) => row.supply_kind === 'new_supply');
  const pipelineRows = supply.filter((row) => row.supply_kind === 'pipeline');
  const filteredSupplyRows = supplyKind === '전체' ? [...newSupplyRows, ...pipelineRows] : supply.filter((row) => row.supply_kind === supplyKind);
  const supplyTimelinePeriods = [...new Set(filteredSupplyRows.map(supplyPeriodLabel).filter((label) => label && label !== '미정'))]
    .sort((a, b) => periodSortValue(a) - periodSortValue(b));
  const rawSupplyStartIndex = supplyTimelinePeriods.findIndex((period) => periodDate(period, true) >= supplyStart);
  const supplyStartIndex = rawSupplyStartIndex === -1 ? Math.max(0, supplyTimelinePeriods.length - 1) : Math.max(0, rawSupplyStartIndex);
  const rawSupplyEndIndex = supplyTimelinePeriods.findIndex((period) => periodDate(period) > supplyEnd);
  const supplyEndIndex = rawSupplyEndIndex === -1 ? Math.max(0, supplyTimelinePeriods.length - 1) : Math.max(0, rawSupplyEndIndex - 1);
  const setSupplyTimelineStart = (index) => {
    const next = supplyTimelinePeriods[Math.max(0, Math.min(index, supplyTimelinePeriods.length - 1))];
    if (next) setSupplyStart(periodDate(next));
  };
  const setSupplyTimelineEnd = (index) => {
    const next = supplyTimelinePeriods[Math.max(0, Math.min(index, supplyTimelinePeriods.length - 1))];
    if (next) setSupplyEnd(periodDate(next, true));
  };
  const applySupplyPreset = (startPeriod, endPeriod = startPeriod) => {
    if (!startPeriod || !endPeriod) return;
    setSupplyStart(periodDate(startPeriod));
    setSupplyEnd(periodDate(endPeriod, true));
  };
  const rangedPipelineRows = filteredSupplyRows.filter((row) => {
    const startDate = supplyDate(row);
    const endDate = supplyDate(row, true);
    return !startDate || (endDate >= supplyStart && startDate <= supplyEnd);
  });
  const datedCumulativeNewRows = newSupplyRows.filter((row) => number(row.expected_year || row.completion_year) >= 2024);
  const cumulativeNewRows = datedCumulativeNewRows.length ? datedCumulativeNewRows : newSupplyRows;
  const aggregateBy = (rows, keyFn, valueFn, weightFn = null) => {
    const grouped = new Map();
    rows.forEach((row) => {
      const label = text(keyFn(row), '미분류');
      const current = grouped.get(label) || { label, count: 0, value: 0, weight: 0, weighted: 0 };
      const value = number(valueFn(row));
      const weight = weightFn ? number(weightFn(row)) : 1;
      current.count += 1;
      current.value += value;
      current.weight += weight;
      current.weighted += value * weight;
      grouped.set(label, current);
    });
    return [...grouped.values()].map((row) => ({ ...row, value: weightFn ? row.weighted / Math.max(1, row.weight) : row.value })).sort((a, b) => number(b.value) - number(a.value));
  };
  const supplyPeriodRows = aggregateBy(filteredSupplyRows, supplyPeriodLabel, supplyArea).sort((a, b) => String(a.label).localeCompare(String(b.label), 'ko'));
  const transactionMetricCards = [
    { label: '거래면적', value: filteredTransactions.reduce((sum, row) => sum + number(row.area_py), 0), formatter: (value) => `${formatNumber(value, 1)}평`, detail: '필터 적용 합계' },
    { label: '거래건수', value: filteredTransactions.length, formatter: (value) => `${formatNumber(value)}건`, detail: '중복 제거 거래 사례' },
    { label: '평당 거래가격', value: aggregateBy(filteredTransactions, () => 'weighted', (row) => row.unit_price_krw_per_py, (row) => row.area_py)[0]?.value || 0, formatter: formatKrw, detail: '연면적 가중평균' },
    { label: '총거래가격', value: filteredTransactions.reduce((sum, row) => sum + number(row.transaction_amount_krw), 0), formatter: formatKrw, detail: '필터 적용 합계' },
  ];
  const transactionPeriodOptions = ['전체', ...new Set(transactions.map((row) => text(row.transaction_year || String(row.transaction_period || '').slice(0, 4), '')).filter(Boolean).sort())];
  const transactionSizeOptions = ['전체', ...new Set(transactions.map((row) => text(row.size_bucket, '')).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko')))];
  const sizeFilteredTransactions = transactions
    .filter((row) => regionMatches(txnSizeRegion, row.region))
    .filter((row) => txnSizePeriod === '전체' || String(yearFrom(row)) === txnSizePeriod)
    .filter((row) => txnSizeBucket === '전체' || text(row.size_bucket) === txnSizeBucket);
  const transactionMarketGroups = new Map();
  filteredTransactions
    .filter((row) => yearFrom(row))
    .forEach((row) => {
      const key = `${yearFrom(row)}|${regionDisplay(row.region)}`;
      const current = transactionMarketGroups.get(key) || { label: String(yearFrom(row)), series: regionDisplay(row.region), value: 0, area: 0, count: 0 };
      current.value += number(row.transaction_amount_krw);
      current.area += number(row.area_py);
      current.count += 1;
      transactionMarketGroups.set(key, current);
    });
  const transactionMarketChartRows = [...transactionMarketGroups.values()]
    .map((row) => ({ ...row, metric_label: `${formatNumber(row.count)}건 · ${formatNumber(row.area, 1)}평` }))
    .sort((a, b) => Number(a.label) - Number(b.label) || a.series.localeCompare(b.series, 'ko'));
  const sizeUnitPriceRows = aggregateBy(
    sizeFilteredTransactions,
    (row) => (txnSizeBucket === '전체' ? text(row.size_bucket, '미정') : regionDisplay(row.region)),
    (row) => row.unit_price_krw_per_py,
    (row) => row.area_py,
  );
  const sizeMarketRows = aggregateBy(
    sizeFilteredTransactions,
    (row) => (txnSizeBucket === '전체' ? text(row.size_bucket, '미정') : regionDisplay(row.region)),
    (row) => row.transaction_amount_krw,
  );
  const capRateChartRows = capRates
    .map((row) => ({
      label: text(row.period_label || row.report_period || [row.report_year, row.report_quarter].filter(Boolean).join(' '), '미정'),
      series: regionDisplay(row.region || row.scope || row.region_group || '전체'),
      value: number(firstText(row.cap_rate, row.value, row.capital_area_cap_rate, row.national_cap_rate)),
      metric_label: text(row.metric_label || row.source_label, ''),
    }))
    .filter((row) => row.label !== '미정' && Number.isFinite(Number(row.value)) && Number(row.value) !== 0);
  const leasePeriodOptions = ['전체', ...new Set(leases.map((row) => text(row.report_period, '')).filter(Boolean).sort())]
    .map((period) => ({ value: period, label: period === '전체' ? '전체' : readablePeriod(period) }));
  const filteredLeaseHistoryRows = leases
    .filter((row) => leaseHistoryPeriod === '전체' || text(row.report_period) === leaseHistoryPeriod)
    .filter((row) => regionMatches(leaseHistoryRegion, row.region))
    .filter((row) => !leaseHistorySearch || `${row.center_name} ${row.legal_address}`.toLowerCase().includes(leaseHistorySearch.toLowerCase()))
    .sort((a, b) => text(b.report_period).localeCompare(text(a.report_period)) || text(a.center_name).localeCompare(text(b.center_name), 'ko'));
  const centerHistoryRows = (row) => leases
    .filter((item) => text(item.center_name) === text(row.center_name))
    .sort((a, b) => text(b.report_period).localeCompare(text(a.report_period)));
  const transactionColumns = [
    { key: 'transaction_period', label: '거래시점', width: 120, render: (row) => text(row.transaction_period || row.transaction_date) },
    { key: 'asset_name', label: '자산명', width: 190, render: (row) => text(row.asset_name) },
    { key: 'region', label: '권역', width: 150, render: (row) => regionDisplay(row.region), sortValue: (row) => regionDisplay(row.region) },
    { key: 'temperature_type', label: '상/저온', width: 110 },
    { key: 'area_py', label: '면적(평)', align: 'right', render: (row) => formatNumber(row.area_py, 1), sortValue: (row) => number(row.area_py) },
    { key: 'transaction_amount_krw', label: '거래금액', align: 'right', render: (row) => formatKrw(row.transaction_amount_krw), sortValue: (row) => number(row.transaction_amount_krw) },
    { key: 'unit_price_krw_per_py', label: '평당가', align: 'right', render: (row) => formatKrw(row.unit_price_krw_per_py), sortValue: (row) => number(row.unit_price_krw_per_py) },
    { key: 'buyer_name', label: '매수인', render: (row) => text(row.buyer_name) },
    { key: 'seller_name', label: '매도인', render: (row) => text(row.seller_name) },
  ];
  const leaseColumns = [
    { key: 'center_name', label: '센터명', width: 190, render: (row) => text(row.center_name) },
    { key: 'region', label: '권역', width: 150, render: (row) => regionDisplay(row.region), sortValue: (row) => regionDisplay(row.region) },
    { key: 'temperature_type', label: '상/저온', width: 110 },
    { key: 'gross_area_py', label: '연면적(평)', align: 'right', render: (row) => formatNumber(row.gross_area_py || row.leasable_area_py, 1), sortValue: (row) => number(row.gross_area_py || row.leasable_area_py) },
    { key: 'rent_manwon_per_py', label: '임대료', align: 'right', render: (row) => `${formatNumber(row.rent_manwon_per_py, 1)}만원`, sortValue: (row) => number(row.rent_manwon_per_py) },
    { key: 'management_fee_manwon_per_py', label: '관리비', align: 'right', render: (row) => `${formatNumber(row.management_fee_manwon_per_py, 1)}만원`, sortValue: (row) => number(row.management_fee_manwon_per_py) },
    { key: 'rent_free_months_per_year', label: '렌트프리', align: 'right', render: (row) => formatNumber(row.rent_free_months_per_year, 1), sortValue: (row) => number(row.rent_free_months_per_year) },
    { key: 'vacancy_rate', label: '공실률', align: 'right', render: (row) => formatRate(row.vacancy_rate), sortValue: (row) => number(row.vacancy_rate) },
    { key: 'legal_address', label: '주소', width: 320, noTruncate: true, render: (row) => text(row.legal_address), sortValue: (row) => text(row.legal_address) },
  ];
  const leaseHistoryColumns = [
    { key: 'report_period', label: '시점', width: 110, render: (row) => readablePeriod(row.report_period), sortValue: (row) => text(row.report_period) },
    ...leaseColumns,
  ];
  const supplyColumns = [
    { key: 'center_name', label: '자산명', width: 190, render: (row) => text(row.center_name || row.warehouse_name) },
    { key: 'region', label: '권역', width: 150, render: (row) => regionDisplay(row.region), sortValue: (row) => regionDisplay(row.region) },
    { key: 'gross_area_py', label: '연면적(평)', align: 'right', render: (row) => formatNumber(supplyArea(row), 1), sortValue: supplyArea },
    { key: 'owner_or_developer', label: '소유주/시행사', render: (row) => text(row.owner_or_developer || row.owner_name) },
    { key: 'temperature_type', label: '상/저온', width: 110 },
    { key: 'completion_period', label: '준공/예정', render: supplyPeriodLabel },
    { key: 'status', label: '진행상태', render: (row) => text(row.status || row.progress_status) },
    {
      key: 'legal_address',
      label: '주소',
      width: 340,
      noTruncate: true,
      render: (row) => {
        const address = text(firstText(row.legal_address, row.address, row.center_name, row.warehouse_name), '원천 주소 없음/정규화 주소 미입력');
        return row.address_source === 'center_name_fallback' ? `${address} (센터명 기반)` : address;
      },
      sortValue: (row) => text(firstText(row.legal_address, row.address, row.center_name, row.warehouse_name), ''),
    },
  ];
  const popupRows = modal?.type === 'lease-history' ? filteredLeaseHistoryRows : (modal?.rows || (modal?.row ? [modal.row] : []));
  return (
    <div className="w-full max-w-[1480px] mx-auto px-8 pt-8 pb-14">
      <ModuleHeader
        eyebrow="MARKET DATA"
        title="Market Data"
        right={(
          <div className="flex items-center gap-2">
            {onNavigate ? (
              <select
                value={currentTab}
                onChange={(event) => {
                  const next = MARKET_TABS.find((tab) => tab.id === event.target.value);
                  if (next) onNavigate(next.route);
                }}
                className="h-9 rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[13px] font-semibold text-white outline-none"
                aria-label="Market Data 하위 탭 선택"
              >
                {MARKET_TABS.map((tab) => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
              </select>
            ) : null}
            <button type="button" onClick={reload} className="h-9 rounded-[8px] border border-[#3A3A3C] px-3 text-[13px] font-semibold text-white hover:bg-white/5">새로고침</button>
          </div>
        )}
      />
      {error ? <div className="mb-4 rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[13px] text-[#FFD479]">{error}</div> : null}
      {loading ? <div className={`${INNER} px-4 py-6 text-center text-[#A1A1AA]`}>시장자료를 불러오는 중입니다.</div> : null}

      {currentTab === 'overview' ? (
        <div className="space-y-5">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="임대 관측치" value={`${formatNumber(summary.lease_observation_count || leases.length)}건`} detail={`최근 기준 ${text(summary.latest_lease_period, '-')}`} />
            <MetricCard label="평당 임대료" value={summary.weighted_rent_manwon_per_py == null ? '-' : `${formatNumber(summary.weighted_rent_manwon_per_py, 1)}만원`} detail="임대면적 가중평균" />
            <MetricCard label="공급 예정" value={`${formatNumber(summary.pipeline_supply_count || 0)}건`} detail={`당분기 신규공급 ${formatNumber(summary.new_supply_total_gross_area_py, 1)}평`} />
            <MetricCard label="매매 사례" value={`${formatNumber(summary.transaction_case_count || transactions.length)}건`} detail={summary.latest_cap_rate ? `최근 Cap Rate ${formatRate(summary.latest_cap_rate.cap_rate)}` : '2010년 이후 거래'} />
          </section>
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="LEASE" title="권역별 최신 임대료" />
              <BarList rows={overviewLeaseRentRows.length ? overviewLeaseRentRows : aggregateBy(latestLeases, (row) => regionDisplay(row.region), (row) => row.rent_manwon_per_py, (row) => row.leasable_area_py)} formatter={(value) => `${formatNumber(value, 1)}만원`} />
            </div>
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="TRANSACTION" title="권역별 거래금액" />
              <BarList rows={aggregateBy(transactions, (row) => regionDisplay(row.region), (row) => row.transaction_amount_krw)} formatter={formatKrw} color={CHART_COLORS.primary} />
            </div>
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="SUPPLY" title="공급 예정 시점" />
              <SupplyAreaChart rows={supplyStatisticRows} seriesType="new_supply" title="신규 공급 면적" />
            </div>
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="SOURCE READBACK" title="원천 적재 검증" />
              <SortableTable
                minWidth={760}
                columns={[
                  { key: 'sheet_name', label: '시트', width: 220 },
                  { key: 'expected_rows', label: '기대 행수', align: 'right', render: (row) => formatNumber(row.expected_rows), sortValue: (row) => number(row.expected_rows) },
                  { key: 'actual_rows', label: 'DB 행수', align: 'right', render: (row) => formatNumber(row.actual_rows), sortValue: (row) => number(row.actual_rows) },
                  { key: 'status', label: '결과' },
                ]}
                rows={safeArray(sourceAudit.sheet_readback)}
              />
            </div>
          </section>
        </div>
      ) : null}

      {currentTab === 'transactions' ? (
        <div className="space-y-5">
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="TRANSACTIONS" title="거래 사례 비교" />
            <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
              <FilterPills label="기간" value={txnWindow} onChange={setTxnWindow} options={[{ value: '1y', label: '최근 1년' }, { value: '3y', label: '최근 3년' }, { value: '5y', label: '최근 5년' }]} />
              <FilterPills label="권역" value={txnRegion} onChange={setTxnRegion} options={regions} />
              <FilterPills label="상/저온" value={txnTemp} onChange={setTxnTemp} options={temps} />
              <FilterPills label="실물/선매입" value={txnType} onChange={setTxnType} options={transactionTypes} />
            </div>
            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {transactionMetricCards.map((metric) => (
                <MetricCard key={metric.label} label={metric.label} value={metric.formatter(metric.value)} detail={metric.detail} />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <MarketMapPanel title="거래 자산 위치" rows={filteredTransactions} labelKey="asset_name" onSelect={(row) => setModal({ title: text(row.asset_name), row, columns: transactionColumns })} />
              <SortableTable minWidth={1120} stickyCount={2} defaultSort={{ key: 'transaction_amount_krw', direction: 'desc' }} columns={transactionColumns} rows={filteredTransactions} onRowClick={(row) => setModal({ title: text(row.asset_name), row, columns: transactionColumns })} />
            </div>
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="TIME SERIES" title="2010년 이후 권역별 거래시장 규모" subtitle="상단 거래 필터를 적용한 뒤, 연도별 거래금액을 권역별로 비교합니다." />
            <GroupedBarChart rows={transactionMarketChartRows} formatter={formatKrw} />
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="SIZE ANALYSIS" title="규모별 평당 거래가 및 거래시장 규모" subtitle="권역, 시점, 규모 구간을 바꾸면 아래 두 차트가 함께 바뀝니다." />
            <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <RegionFilterGroups label="권역" value={txnSizeRegion} onChange={setTxnSizeRegion} options={regions} />
              <FilterPills label="시점" value={txnSizePeriod} onChange={setTxnSizePeriod} options={transactionPeriodOptions.map((item) => ({ value: item, label: item === '전체' ? '전체' : `${item}년` }))} />
              <FilterPills label="규모" value={txnSizeBucket} onChange={setTxnSizeBucket} options={transactionSizeOptions.map((item) => ({ value: item, label: item }))} />
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <div>
                <div className="mb-2 text-[13px] font-semibold text-white">평당 거래가</div>
                <BarList rows={sizeUnitPriceRows} formatter={formatKrw} color={CHART_COLORS.secondary} />
              </div>
              <div>
                <div className="mb-2 text-[13px] font-semibold text-white">거래시장 규모</div>
                <BarList rows={sizeMarketRows} formatter={formatKrw} color={CHART_COLORS.primary} />
              </div>
            </div>
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="CAP RATE" title="Cap Rate 일반 추이" />
            <GroupedBarChart rows={capRateChartRows} formatter={formatRate} />
          </section>
        </div>
      ) : null}

      {currentTab === 'lease' ? (
        <div className="space-y-5">
          <section className={`${CARD} p-5`}>
            <ModuleHeader
              eyebrow="LEASE MARKET"
              title="최신 임대시장 통계"
              right={(
                <button
                  type="button"
                  onClick={() => setModal({ type: 'lease-history', title: '임대시장 전체 기록', columns: leaseHistoryColumns, width: 'max-w-[calc(100vw-32px)]', minWidth: 1460, maxHeight: 680 })}
                  className="h-9 rounded-[8px] border border-[#3A3A3C] px-3 text-[12px] font-semibold text-white hover:bg-white/5"
                >
                  전체 기록 보기
                </button>
              )}
            />
            <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[0.7fr_1fr]">
              <FilterPills label="시점" value={selectedLeaseStatisticPeriod} onChange={setLeaseStatisticPeriod} options={leaseStatisticPeriods.map((period) => ({ value: period, label: period }))} />
              <FilterPills label="지표" value={leaseMeasure} onChange={setLeaseMeasure} options={leaseMeasureOptions} />
              <div className="xl:col-span-2">
                <FilterPills label="상/저온 구분" value={leaseSegment} onChange={setLeaseSegment} options={leaseSegmentOptions} />
              </div>
            </div>
            <GroupedBarChart rows={leaseStatisticChartRows} formatter={leaseMetricFormatter} />
            {!leaseStatisticRows.length ? (
              <div className="mt-3 rounded-[8px] border border-[#5A4420] bg-[#2A2115] px-3 py-2 text-[12px] text-[#FFD479]">
                엑셀 임대시장 통계 요약값을 API에서 아직 받지 못했습니다. 원자료 기준 임시 집계가 아니라 QA 실패로 처리됩니다.
              </div>
            ) : null}
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="CENTER DETAIL" title="권역별 물류센터 임대 현황" />
            <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
              <RegionFilterGroups label="권역" value={leaseRegion} onChange={setLeaseRegion} options={regions} />
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
                자산 검색
                <input value={leaseSearch} onChange={(event) => setLeaseSearch(event.target.value)} className="mt-2 h-9 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[12px] text-white outline-none" placeholder="센터명 또는 주소" />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(420px,0.75fr)_minmax(560px,1.25fr)]">
              <MarketMapPanel title="권역별 센터" rows={filteredLeaseRows} labelKey="center_name" onSelect={(row) => setModal({ title: text(row.center_name), rows: centerHistoryRows(row), columns: leaseHistoryColumns, width: 'max-w-[calc(100vw-32px)]', minWidth: 1320, maxHeight: 680 })} />
              <SortableTable minWidth={1040} maxHeight={580} stickyCount={2} defaultSort={{ key: 'gross_area_py', direction: 'desc' }} columns={leaseColumns} rows={filteredLeaseRows} onRowClick={(row) => setModal({ title: text(row.center_name), rows: centerHistoryRows(row), columns: leaseHistoryColumns, width: 'max-w-[calc(100vw-32px)]', minWidth: 1320, maxHeight: 680 })} />
            </div>
          </section>
        </div>
      ) : null}

      {currentTab === 'supply' ? (
        <div className="space-y-5">
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="NEW SUPPLY" title="최근 신규 공급 사례" />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(420px,0.75fr)_minmax(560px,1.25fr)]">
              <MarketMapPanel title="당분기 신규공급" rows={newSupplyRows} labelKey="center_name" onSelect={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
              <SortableTable minWidth={980} maxHeight={580} stickyCount={2} defaultSort={{ key: 'gross_area_py', direction: 'desc' }} columns={supplyColumns} rows={newSupplyRows} onRowClick={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
            </div>
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="PIPELINE" title="공급 예정 물량" />
            <div className="mb-4">
              <div className="mb-3 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr] xl:items-start">
                <FilterPills label="유형" value={supplyKind} onChange={setSupplyKind} options={supplyKindOptions} />
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-[12px] font-semibold text-[#A1A1AA]">기간 slicer</div>
                    <div className="text-[11px] text-[#86868B]">{supplyStart} ~ {supplyEnd} · {formatNumber(rangedPipelineRows.length)}건</div>
                  </div>
                  {supplyTimelinePeriods.length ? (
                    <div className={`${INNER} p-3`}>
                      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <label className="text-[11px] font-semibold text-[#86868B]">
                          시작
                          <input
                            type="range"
                            min="0"
                            max={Math.max(0, supplyTimelinePeriods.length - 1)}
                            value={Math.min(supplyStartIndex, supplyEndIndex)}
                            onChange={(event) => setSupplyTimelineStart(Number(event.target.value))}
                            className="mt-2 w-full accent-[#9AD7FF]"
                          />
                        </label>
                        <label className="text-[11px] font-semibold text-[#86868B]">
                          종료
                          <input
                            type="range"
                            min="0"
                            max={Math.max(0, supplyTimelinePeriods.length - 1)}
                            value={Math.max(supplyStartIndex, supplyEndIndex)}
                            onChange={(event) => setSupplyTimelineEnd(Number(event.target.value))}
                            className="mt-2 w-full accent-[#B5E48C]"
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-1.5" data-supply-range-slicer="true">
                        {supplyTimelinePeriods.map((period, index) => {
                          const selected = index >= Math.min(supplyStartIndex, supplyEndIndex) && index <= Math.max(supplyStartIndex, supplyEndIndex);
                          return (
                            <button
                              key={period}
                              type="button"
                              onClick={() => applySupplyPreset(period)}
                              className={`h-8 rounded-[8px] border px-2.5 text-[11px] font-semibold ${selected ? 'border-[#9AD7FF] bg-[#21313A] text-white' : 'border-[#3A3A3C] text-[#A1A1AA] hover:text-white'}`}
                              title={`${period}만 보기`}
                            >
                              {period}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <input type="date" value={supplyStart} onChange={(event) => setSupplyStart(event.target.value)} className="h-9 rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[12px] text-white outline-none" aria-label="공급 시작일" />
                        <input type="date" value={supplyEnd} onChange={(event) => setSupplyEnd(event.target.value)} className="h-9 rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[12px] text-white outline-none" aria-label="공급 종료일" />
                      </div>
                    </div>
                  ) : (
                    <div className={`${INNER} px-4 py-3 text-[12px] text-[#A1A1AA]`}>기간 라벨이 있는 공급 데이터가 없습니다.</div>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(420px,0.75fr)_minmax(560px,1.25fr)]">
              <MarketMapPanel title="공급 예정 지도" rows={rangedPipelineRows} labelKey="center_name" onSelect={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
              <SortableTable minWidth={980} maxHeight={580} stickyCount={2} defaultSort={{ key: 'expected_year', direction: 'asc' }} columns={supplyColumns} rows={rangedPipelineRows} onRowClick={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
            </div>
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="CUMULATIVE" title="2024년 이후 누적 신규공급 사례" />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(420px,0.75fr)_minmax(560px,1.25fr)]">
              <MarketMapPanel title="누적 신규공급" rows={cumulativeNewRows} labelKey="center_name" onSelect={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
              <SortableTable minWidth={980} maxHeight={580} stickyCount={2} defaultSort={{ key: 'gross_area_py', direction: 'desc' }} columns={supplyColumns} rows={cumulativeNewRows} onRowClick={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
            </div>
          </section>
          <section className="space-y-5">
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="TIME SERIES" title="신규 공급 면적" />
              <SupplyAreaChart rows={supplyStatisticRows} seriesType="new_supply" title="신규 공급 면적" />
            </div>
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="CUMULATIVE" title="누적 공급 면적" />
              <SupplyAreaChart rows={supplyStatisticRows} seriesType="cumulative_supply" title="누적 공급 면적" />
            </div>
          </section>
        </div>
      ) : null}

      {currentTab === 'source' ? (
        <section className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="SOURCE UPDATE" title="분기별 Excel 업데이트 관리" subtitle="업로드, dry-run 검증, active와 diff, 승인 후 active 교체 순서로 관리합니다." />
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard label="원본 시트" value={`${formatNumber(sourceAudit.sheet_count || 0)}개`} detail={`${formatNumber(sourceAudit.source_row_count || 0)}행`} />
            <MetricCard label="원본 컬럼" value={`${formatNumber(sourceAudit.source_column_count || 0)}개`} detail="원본 컬럼 매핑 확인" />
            <MetricCard label="정규화 행" value={`${formatNumber((summary.lease_observation_count || 0) + (summary.supply_case_count || 0) + (summary.transaction_case_count || 0) + (summary.cap_rate_series_count || 0))}건`} detail="분석용 테이블 합계" />
            <MetricCard label="검증 결과" value={Object.values(readback).every((item) => item.ok !== false) ? '통과' : '확인 필요'} detail="expected vs actual" />
          </div>
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-5">
            {[
              ['1. 업로드', '다음 분기 Excel을 draft source로 등록'],
              ['2. Dry-run', '시트/챕터/컬럼/행수와 정규화 결과 사전 검증'],
              ['3. Diff', '현재 active와 신규 draft의 증감·누락·중복 비교'],
              ['4. 승인', '검증 결과와 diff 확인 후 관리자가 승인'],
              ['5. Active 교체', '승인된 source만 active로 전환하고 readback 재확인'],
            ].map(([title, body]) => (
              <div key={title} className={`${INNER} px-3 py-3`}>
                <div className="text-[12px] font-semibold text-white">{title}</div>
                <div className="mt-2 text-[11px] leading-5 text-[#A1A1AA]">{body}</div>
              </div>
            ))}
          </div>
          <SortableTable
            minWidth={980}
            stickyCount={1}
            columns={[
              { key: 'sheet_name', label: '시트', width: 240 },
              { key: 'expected_rows', label: '기대 행수', align: 'right', render: (row) => formatNumber(row.expected_rows), sortValue: (row) => number(row.expected_rows) },
              { key: 'actual_rows', label: 'DB 행수', align: 'right', render: (row) => formatNumber(row.actual_rows), sortValue: (row) => number(row.actual_rows) },
              { key: 'column_count', label: '컬럼', align: 'right', render: (row) => formatNumber(row.column_count), sortValue: (row) => number(row.column_count) },
              { key: 'header_row_number', label: '헤더 행', align: 'right' },
              { key: 'status', label: '결과' },
            ]}
            rows={safeArray(sourceAudit.sheet_readback)}
          />
          <div className="mt-5">
            <SortableTable
              minWidth={980}
              columns={[
                { key: 'file_name', label: '파일', width: 260 },
                { key: 'source_version', label: '버전' },
                { key: 'active_version', label: 'Active', render: (row) => row.active_version ? 'Y' : 'N' },
                { key: 'parse_status', label: '상태' },
                { key: 'updated_at', label: '업데이트', render: (row) => formatDate(row.updated_at || row.created_at) },
              ]}
              rows={sources}
            />
          </div>
        </section>
      ) : null}

      <Modal title={modal?.title} onClose={() => setModal(null)} width={modal?.width || 'max-w-[1180px]'}>
        {modal?.type === 'lease-history' ? (
          <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-[220px_1fr_320px]">
            <FilterPills label="시점" value={leaseHistoryPeriod} onChange={setLeaseHistoryPeriod} options={leasePeriodOptions} />
            <RegionFilterGroups label="권역" value={leaseHistoryRegion} onChange={setLeaseHistoryRegion} options={regions} />
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
              센터명/주소 검색
              <input value={leaseHistorySearch} onChange={(event) => setLeaseHistorySearch(event.target.value)} className="mt-2 h-9 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[12px] text-white outline-none" placeholder="센터명 또는 주소" />
            </label>
          </div>
        ) : null}
        <SortableTable
          minWidth={modal?.minWidth || 1180}
          maxHeight={modal?.maxHeight || 620}
          stickyCount={2}
          columns={modal?.columns || transactionColumns}
          rows={popupRows}
          empty="상세 데이터가 없습니다."
        />
      </Modal>
    </div>
  );
}

function InvestmentIndexDashboardLegacy() {
  const [mode, setMode] = useState('fund');
  const { loading, error, data, reload } = useEdgeData('investment-index/read', {}, []);
  const summary = data?.summary || {};
  const funds = safeArray(data?.funds);
  const assets = safeArray(data?.assets);
  const tranches = safeArray(data?.tranches);
  const loanRates = safeArray(data?.loan_rates);
  const rows = mode === 'fund' ? funds : assets;
  const totals = rows.reduce((acc, row) => ({
    equity: acc.equity + number(row.equity_krw),
    loan: acc.loan + number(row.loan_krw),
    reference: acc.reference + number(row.reference_total_capital_krw),
  }), { equity: 0, loan: 0, reference: 0 });
  const timelineRows = tranches
    .slice()
    .sort((a, b) => String(a.drawdown_date || '').localeCompare(String(b.drawdown_date || '')))
    .slice(0, 240);
  const drawdownChartRows = aggregateRows(
    tranches.filter((row) => row.drawdown_date),
    (row) => periodBucket(row.drawdown_date),
    (row) => row.amount_krw,
  ).sort((a, b) => String(a.label).localeCompare(String(b.label))).slice(-12);
  const maturityChartRows = aggregateRows(
    tranches.filter((row) => row.maturity_date),
    (row) => periodBucket(row.maturity_date),
    (row) => row.amount_krw,
  ).sort((a, b) => String(a.label).localeCompare(String(b.label))).slice(0, 12);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={[{ id: 'fund', label: '펀드 기준' }, { id: 'asset', label: '자산 기준' }]} value={mode} onChange={setMode} />
        <button type="button" onClick={reload} className="h-9 rounded-[8px] border border-[#3A3A3C] px-3 text-[13px] font-semibold text-white hover:bg-white/5">새로고침</button>
      </div>
      {error ? <div className="rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[13px] text-[#FFD479]">{error}</div> : null}
      {loading ? <div className={`${INNER} px-4 py-6 text-center text-[#A1A1AA]`}>투자지표를 불러오는 중입니다.</div> : null}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard label="Equity" value={formatKrw(totals.equity)} detail="확정 배분 기준" />
        <MetricCard label="Loan" value={formatKrw(totals.loan)} detail="확정 배분 기준" />
        <MetricCard label="합계" value={formatKrw(totals.equity + totals.loan)} detail={mode === 'asset' ? '공동 펀드 참고금액 제외' : '펀드별 합계'} />
        <MetricCard label="공동 펀드 참고" value={formatKrw(totals.reference)} detail={`${formatNumber(summary.joint_asset_reference_count || 0)}개 자산은 참고금액 분리`} />
      </section>
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard label="펀드" value={`${formatNumber(summary.fund_count || funds.length)}개`} detail="표시 가능한 펀드" />
        <MetricCard label="자산" value={`${formatNumber(summary.asset_count || assets.length)}개`} detail="권한 범위 내 자산" />
        <MetricCard label="Tranche" value={`${formatNumber(summary.tranche_count || tranches.length)}건`} detail="active, 중복 제거 후" />
        <MetricCard label="중복 제거" value={`${formatNumber(summary.deduped_tranche_count || 0)}건`} detail="동일 조건 tranche 반복 방지" />
      </section>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="CAPITAL STRUCTURE" title={`${mode === 'fund' ? '펀드별' : '자산별'} Equity / Loan 비교`} />
          <StackedCapitalChart rows={rows} referenceKey={mode === 'asset' ? 'reference_total_capital_krw' : ''} />
        </div>
        <div className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="SUMMARY TABLE" title="투자 규모 표" />
          <Table
            minWidth={940}
            headers={[mode === 'fund' ? '펀드명' : '자산명', mode === 'fund' ? '자산' : '펀드', 'Equity', 'Loan', '합계', '참고금액']}
            rows={rows.map((row) => [
              text(row.display_name),
              mode === 'fund' ? safeArray(row.asset_names).join(', ') || '-' : safeArray(row.fund_names).join(', ') || '-',
              formatKrw(row.equity_krw),
              formatKrw(row.loan_krw),
              formatKrw(row.total_capital_krw),
              formatKrw(row.reference_total_capital_krw),
            ])}
          />
        </div>
      </section>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="DRAWDOWN / MATURITY" title="인출 및 만기 일정" />
          <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-[12px] font-semibold text-[#A1A1AA]">인출 금액 추이</div>
              <BarList rows={drawdownChartRows} formatter={formatKrw} color={CHART_COLORS.secondary} maxRows={12} />
            </div>
            <div>
              <div className="mb-2 text-[12px] font-semibold text-[#A1A1AA]">만기 금액 분포</div>
              <BarList rows={maturityChartRows} formatter={formatKrw} color={CHART_COLORS.primary} maxRows={12} />
            </div>
          </div>
          <Table
            minWidth={1040}
            headers={['구분', '펀드명', '금액', '인출일', '만기일', '금리', '대주/수익자']}
            rows={timelineRows.map((row) => [
              text(row.tranche_type_label),
              text(row.fund_display_name),
              formatKrw(row.amount_krw),
              formatDate(row.drawdown_date),
              formatDate(row.maturity_date),
              row.interest_rate == null && row.loan_rate == null && row.all_in_rate == null ? '-' : formatRate(row.interest_rate || row.loan_rate || row.all_in_rate),
              text(row.counterparty_name),
            ])}
          />
        </div>
        <div className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="LOAN RATE" title="대출 금리 비교" />
          <BarList rows={loanRates.map((row) => ({ ...row, label: `${text(row.fund_display_name)} · ${text(row.counterparty_name)}`, value: row.interest_rate }))} formatter={formatRate} color={CHART_COLORS.warning} />
        </div>
      </section>
    </div>
  );
}

export function InvestmentIndexDashboard() {
  const [mode, setMode] = useState('fund');
  const [showStructureTable, setShowStructureTable] = useState(false);
  const [detailTarget, setDetailTarget] = useState(null);
  const [loanRateTranche, setLoanRateTranche] = useState('전체 평균');
  const { loading, error, data } = useEdgeData('investment-index/read', {}, []);
  const funds = safeArray(data?.funds);
  const assets = safeArray(data?.assets);
  const tranches = safeArray(data?.tranches);
  const rows = useMemo(() => (mode === 'fund' ? funds : assets)
    .slice()
    .sort((a, b) => (
      number(b.total_capital_krw) - number(a.total_capital_krw)
    )), [assets, funds, mode]);
  const totals = rows.reduce((acc, row) => ({
    equity: acc.equity + number(row.equity_krw),
    loan: acc.loan + number(row.loan_krw),
  }), { equity: 0, loan: 0 });
  const loanMaturityRows = useMemo(() => normalizeLoanTrancheRows(tranches, funds), [funds, tranches]);
  const loanMaturityChartRows = useMemo(() => loanMaturityTimelineRows(loanMaturityRows), [loanMaturityRows]);
  const loanRateBaseRows = useMemo(() => normalizeLoanRateRows(tranches, funds), [funds, tranches]);
  const loanRateTrancheOptions = useMemo(() => ['전체 평균', ...Array.from(new Set(loanRateBaseRows.map((row) => text(row.tranche_display, 'A')))).sort((a, b) => a.localeCompare(b, 'ko'))], [loanRateBaseRows]);
  useEffect(() => {
    if (!loanRateTrancheOptions.includes(loanRateTranche)) setLoanRateTranche('전체 평균');
  }, [loanRateTranche, loanRateTrancheOptions]);
  const loanRateChartRows = useMemo(() => groupLoanRateRows(loanRateBaseRows, loanRateTranche), [loanRateBaseRows, loanRateTranche]);
  const loanRateTableRows = useMemo(() => (
    loanRateTranche === '전체 평균'
      ? loanRateBaseRows
      : loanRateBaseRows.filter((row) => text(row.tranche_display) === loanRateTranche)
  ), [loanRateBaseRows, loanRateTranche]);
  const hasAssetRegion = mode === 'asset' && rows.some((row) => row.region || row.capital_region || row.national_region || row.region_group);
  const tableColumns = mode === 'fund'
    ? [
      { key: 'display_name', label: '펀드명', width: 220, noTruncate: true },
      { key: 'asset_names', label: '연결 자산', width: 360, noTruncate: true, render: (row) => safeArray(row.asset_names).join(', ') || '-' },
      { key: 'equity_krw', label: 'Equity', width: 150, align: 'right', render: (row) => formatKrw(row.equity_krw), sortValue: (row) => number(row.equity_krw) },
      { key: 'loan_krw', label: 'Loan', width: 150, align: 'right', render: (row) => formatKrw(row.loan_krw), sortValue: (row) => number(row.loan_krw) },
      { key: 'total_capital_krw', label: '합계', width: 150, align: 'right', render: (row) => formatKrw(row.total_capital_krw), sortValue: (row) => number(row.total_capital_krw) },
      { key: 'loan_ratio', label: 'Loan 비중', width: 120, align: 'right', render: (row) => formatRate(number(row.loan_krw) / Math.max(1, number(row.total_capital_krw))), sortValue: (row) => number(row.loan_krw) / Math.max(1, number(row.total_capital_krw)) },
      { key: 'equity_tranches', label: 'Equity Tranche', width: 170, render: (row) => trancheSummaryText(investmentDetailRows(row, mode, tranches).filter((item) => !isLoanTranche(item))), sortValue: (row) => investmentDetailRows(row, mode, tranches).filter((item) => !isLoanTranche(item)).length },
      { key: 'loan_tranches', label: 'Loan Tranche', width: 170, render: (row) => trancheSummaryText(investmentDetailRows(row, mode, tranches).filter(isLoanTranche)), sortValue: (row) => investmentDetailRows(row, mode, tranches).filter(isLoanTranche).length },
    ]
    : [
      { key: 'display_name', label: '자산명', width: 220, noTruncate: true },
      ...(hasAssetRegion ? [{ key: 'region', label: '권역', width: 150, render: (row) => formatRegionLabel(row.region || row.capital_region || row.national_region || row.region_group), sortValue: (row) => regionValue(row.region || row.capital_region || row.national_region || row.region_group) }] : []),
      { key: 'fund_names', label: '연결 펀드', width: 300, noTruncate: true, render: (row) => safeArray(row.fund_names).join(', ') || '-' },
      { key: 'equity_krw', label: 'Equity', width: 145, align: 'right', render: (row) => formatKrw(row.equity_krw), sortValue: (row) => number(row.equity_krw) },
      { key: 'loan_krw', label: 'Loan', width: 145, align: 'right', render: (row) => formatKrw(row.loan_krw), sortValue: (row) => number(row.loan_krw) },
      { key: 'total_capital_krw', label: '합계', width: 145, align: 'right', render: (row) => formatKrw(row.total_capital_krw), sortValue: (row) => number(row.total_capital_krw) },
      { key: 'equity_tranches', label: 'Equity Tranche', width: 170, render: (row) => trancheSummaryText(investmentDetailRows(row, mode, tranches).filter((item) => !isLoanTranche(item))), sortValue: (row) => investmentDetailRows(row, mode, tranches).filter((item) => !isLoanTranche(item)).length },
      { key: 'loan_tranches', label: 'Loan Tranche', width: 170, render: (row) => trancheSummaryText(investmentDetailRows(row, mode, tranches).filter(isLoanTranche)), sortValue: (row) => investmentDetailRows(row, mode, tranches).filter(isLoanTranche).length },
      { key: 'current_manager_name', label: '담당자', width: 120, render: (row) => text(row.current_manager_name) },
    ];
  const detailRows = useMemo(() => {
    if (!detailTarget) return [];
    if (detailTarget.type === 'loan-rate-asset') {
      const assetLabel = text(detailTarget.row?.asset_display_label);
      return loanRateBaseRows
        .filter((row) => text(row.asset_display_label) === assetLabel)
        .sort((a, b) => text(a.tranche_display, trancheLabel(a)).localeCompare(text(b.tranche_display, trancheLabel(b)), 'ko') || number(b.amount_krw) - number(a.amount_krw));
    }
    if (detailTarget.type === 'loan-maturity-month') return safeArray(detailTarget.row?.details);
    if (detailTarget.type === 'loan-rate' || detailTarget.type === 'loan-maturity') return [detailTarget.row];
    return investmentDetailRows(detailTarget.row, detailTarget.mode, tranches)
      .map((row) => normalizeInvestmentDetailRow(row, funds));
  }, [detailTarget, funds, loanRateBaseRows, tranches]);
  const detailEquityRows = detailRows.filter((row) => !isLoanTranche(row));
  const detailLoanRows = detailRows.filter(isLoanTranche);
  const detailEquity = detailEquityRows.reduce((sum, row) => sum + number(row.amount_krw), 0);
  const detailLoan = detailLoanRows.reduce((sum, row) => sum + number(row.amount_krw), 0);
  const detailEquitySummary = trancheSummaryRows(detailEquityRows);
  const detailLoanSummary = trancheSummaryRows(detailLoanRows);
  const detailTitle = detailTarget
    ? detailTarget.type === 'loan-rate-asset'
      ? `${text(detailTarget.row.asset_display_label)} · 전체 대출 정보`
      : detailTarget.type === 'loan-maturity-month'
        ? `${text(detailTarget.row.label)} 대출 만기`
        : detailTarget.type === 'loan-rate' || detailTarget.type === 'loan-maturity'
          ? `${text(detailTarget.row.fund_display_name)} · ${text(detailTarget.row.asset_display_label)}`
      : investmentDisplayLabel(detailTarget.row, detailTarget.mode)
    : '';
  const detailColumns = [
    { key: 'tranche_type_label', label: '구분', width: 130 },
    { key: 'fund_display_name', label: '펀드명', width: 160 },
    { key: 'asset_display_label', label: '자산명', width: 190, noTruncate: true },
    { key: 'counterparty_name', label: '투자자/대주', width: 250, noTruncate: true },
    { key: 'tranche_display', label: 'Tranche', width: 120, noTruncate: true, render: (row) => text(row.tranche_display, trancheLabel(row)), sortValue: (row) => text(row.tranche_display, trancheLabel(row)) },
    { key: 'amount_krw', label: '금액', width: 130, noTruncate: true, align: 'right', render: (row) => formatKrw(row.amount_krw), sortValue: (row) => number(row.amount_krw) },
    { key: 'rate_display_value', label: '금리', width: 90, noTruncate: true, align: 'right', render: (row) => row.rate_display_value == null || row.rate_display_value === '' ? '-' : formatRate(row.rate_display_value), sortValue: (row) => number(row.rate_display_value) },
    { key: 'maturity_date', label: '만기일', width: 110, noTruncate: true, render: (row) => formatDate(row.maturity_date) },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={[{ id: 'fund', label: '펀드 기준' }, { id: 'asset', label: '자산 기준' }]} value={mode} onChange={setMode} />
      </div>
      {error ? <div className="rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[13px] text-[#FFD479]">{error}</div> : null}
      {loading && !data ? <div className={`${INNER} px-4 py-6 text-center text-[#A1A1AA]`}>투자지표를 불러오는 중입니다.</div> : null}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard label="Equity" value={formatKrw(totals.equity)} detail={mode === 'asset' ? '자산에 확정 배분된 금액' : '펀드 기준 합계'} />
        <MetricCard label="Loan" value={formatKrw(totals.loan)} detail={mode === 'asset' ? '자산에 확정 배분된 금액' : '펀드 기준 합계'} />
        <MetricCard label="합계" value={formatKrw(totals.equity + totals.loan)} detail="Equity + Loan" />
      </section>
      <section className={`${CARD} p-5`}>
        <ModuleHeader
          eyebrow="CAPITAL STACK"
          title={mode === 'fund' ? '펀드별 Equity / Loan 구성' : '자산별 Equity / Loan 구성'}
          subtitle="합계 금액 기준 내림차순"
        />
        <StackedCapitalChart
          rows={rows}
          maxRows={Infinity}
          labelForRow={(row) => investmentDisplayLabel(row, mode)}
          tooltipForRow={(row, metrics) => investmentTooltip(row, mode, tranches, metrics)}
          onRowClick={(row) => setDetailTarget({ type: 'structure', mode, row })}
        />
        <button
          type="button"
          onClick={() => setShowStructureTable((current) => !current)}
          className="mt-4 flex h-11 w-full items-center justify-between rounded-[10px] border border-[#3A3A3C] bg-[#1F1F1E] px-4 text-left text-[13px] font-semibold text-[#E5E5E5] hover:bg-white/[0.04]"
        >
          <span>{showStructureTable ? '상세 투자 구조 닫기' : '상세 투자 구조 보기'}</span>
          <span className="text-[12px] font-medium text-[#86868B]">{formatNumber(rows.length)}건</span>
        </button>
        {showStructureTable ? (
          <div className="mt-5">
            <SortableTable
              minWidth={mode === 'fund' ? 1490 : hasAssetRegion ? 1420 : 1270}
              maxHeight={420}
              stickyCount={1}
              defaultSort={{ key: 'total_capital_krw', direction: 'desc' }}
              columns={tableColumns}
              rows={rows}
              onRowClick={(row) => setDetailTarget({ type: 'structure', mode, row })}
            />
          </div>
        ) : null}
      </section>
      <section className={`${CARD} p-5`}>
        <ModuleHeader eyebrow="LOAN MATURITY" title="대출 만기 일정" subtitle={`x축 시작: ${formatMonthKey(currentMonthKey())}`} />
        <LoanMaturityTimelineChart rows={loanMaturityChartRows} onMonthClick={(row) => setDetailTarget({ type: 'loan-maturity-month', row })} />
        <div className="mt-5">
          <SortableTable
            minWidth={1180}
            maxHeight={420}
            stickyCount={2}
            defaultSort={{ key: 'maturity_date', direction: 'asc' }}
            columns={[
              { key: 'month_key', label: '만기월', width: 110, render: (row) => formatMonthKey(row.month_key), sortValue: (row) => row.month_key },
              { key: 'fund_display_name', label: '펀드명', width: 180 },
              { key: 'asset_display_label', label: '자산명', width: 260, noTruncate: true },
              { key: 'tranche_display', label: 'Tranche', width: 110, render: (row) => text(row.tranche_display, trancheLabel(row)), sortValue: (row) => text(row.tranche_display, trancheLabel(row)) },
              { key: 'counterparty_name', label: '대주', width: 220, noTruncate: true },
              { key: 'amount_krw', label: '대출금액', align: 'right', render: (row) => formatKrw(row.amount_krw), sortValue: (row) => number(row.amount_krw) },
              { key: 'maturity_date', label: '만기일', render: (row) => formatDate(row.maturity_date) },
              { key: 'rate_display_value', label: '금리', align: 'right', render: (row) => row.rate_display_value == null || row.rate_display_value === '' ? '-' : formatRate(row.rate_display_value), sortValue: (row) => number(row.rate_display_value) },
            ]}
            rows={loanMaturityRows}
            onRowClick={(row) => setDetailTarget({ type: 'loan-maturity', row })}
          />
        </div>
      </section>
      <section className={`${CARD} p-5`}>
        <ModuleHeader eyebrow="LOAN RATE" title="대출 금리 비교" subtitle="자산별 대출금액 가중평균 기준" />
        <div className="mb-4">
          <FilterPills
            label="Tranche"
            options={loanRateTrancheOptions}
            value={loanRateTranche}
            onChange={setLoanRateTranche}
          />
        </div>
        <LoanRateHorizontalChart rows={loanRateChartRows} onRowClick={(row) => setDetailTarget({ type: 'loan-rate-asset', row })} />
        <div className="mt-5">
          <SortableTable
            minWidth={1060}
            maxHeight={420}
            stickyCount={2}
            defaultSort={{ key: 'rate_display_value', direction: 'desc' }}
            columns={[
              { key: 'fund_display_name', label: '펀드명', width: 180 },
              { key: 'asset_display_label', label: '자산명', width: 260, noTruncate: true },
              { key: 'tranche_display', label: 'Tranche', width: 110, render: (row) => text(row.tranche_display, trancheLabel(row)), sortValue: (row) => text(row.tranche_display, trancheLabel(row)) },
              { key: 'counterparty_name', label: '대주', width: 220, noTruncate: true },
              { key: 'amount_krw', label: '대출금액', align: 'right', render: (row) => formatKrw(row.amount_krw), sortValue: (row) => number(row.amount_krw) },
              { key: 'rate_display_value', label: '금리', align: 'right', render: (row) => row.rate_display_value == null || row.rate_display_value === '' ? '-' : formatRate(row.rate_display_value), sortValue: (row) => number(row.rate_display_value) },
              { key: 'maturity_date', label: '만기', render: (row) => formatDate(row.maturity_date) },
            ]}
            rows={loanRateTableRows}
            onRowClick={(row) => setDetailTarget({ type: 'loan-rate', row })}
          />
        </div>
      </section>
      <Modal title={detailTitle} onClose={() => setDetailTarget(null)} width="max-w-[calc(100vw-32px)]" fullscreen>
        {detailTarget?.type === 'structure' ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <MetricCard label="Equity" value={formatKrw(detailEquity)} detail="선택 항목의 수익자 지분" />
              <MetricCard label="Equity Tranche" value={`${formatNumber(detailEquityRows.length)}건`} detail={trancheSummaryText(detailEquityRows)} />
              <MetricCard label="Loan" value={formatKrw(detailLoan)} detail="선택 항목의 대출" />
              <MetricCard label="Loan Tranche" value={`${formatNumber(detailLoanRows.length)}건`} detail={trancheSummaryText(detailLoanRows)} />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className={`${INNER} p-4`}>
                <div className="mb-3 text-[13px] font-semibold text-white">Equity Tranche</div>
                <div className="flex flex-wrap gap-2">
                  {detailEquitySummary.length ? detailEquitySummary.map((row) => (
                    <span key={row.label} className="rounded-[8px] border border-[#3A3A3C] px-3 py-2 text-[12px] text-[#E5E5E5]">{row.label} · {formatKrw(row.amount_krw)} · {formatNumber(row.count)}건</span>
                  )) : <span className="text-[12px] text-[#86868B]">수익자 tranche 없음</span>}
                </div>
              </div>
              <div className={`${INNER} p-4`}>
                <div className="mb-3 text-[13px] font-semibold text-white">Loan Tranche</div>
                <div className="flex flex-wrap gap-2">
                  {detailLoanSummary.length ? detailLoanSummary.map((row) => (
                    <span key={row.label} className="rounded-[8px] border border-[#3A3A3C] px-3 py-2 text-[12px] text-[#E5E5E5]">{row.label} · {formatKrw(row.amount_krw)} · {formatNumber(row.count)}건</span>
                  )) : <span className="text-[12px] text-[#86868B]">대출 tranche 없음</span>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <div>
                <div className="mb-2 text-[13px] font-semibold text-white">수익자 테이블</div>
                <SortableTable
                  minWidth={980}
                  maxHeight={520}
                  stickyCount={2}
                  defaultSort={{ key: 'amount_krw', direction: 'desc' }}
                  columns={detailColumns}
                  rows={detailEquityRows}
                  empty="수익자 내역이 없습니다."
                />
              </div>
              <div>
                <div className="mb-2 text-[13px] font-semibold text-white">대주 테이블</div>
                <SortableTable
                  minWidth={980}
                  maxHeight={520}
                  stickyCount={2}
                  defaultSort={{ key: 'amount_krw', direction: 'desc' }}
                  columns={detailColumns}
                  rows={detailLoanRows}
                  empty="대주 내역이 없습니다."
                />
              </div>
            </div>
          </div>
        ) : (
          <SortableTable
            minWidth={1180}
            maxHeight={620}
            stickyCount={2}
            defaultSort={{ key: 'amount_krw', direction: 'desc' }}
            columns={detailColumns}
            rows={detailRows}
            empty="상세 투자 내역이 없습니다."
          />
        )}
      </Modal>
    </div>
  );
}

function AssetSpecDashboardLegacy() {
  const specRead = useEdgeData('asset-spec/read', {}, []);
  const costRead = useEdgeData('operating-costs/read', {}, []);
  const assets = safeArray(specRead.data?.assets);
  const specs = safeArray(specRead.data?.specs);
  const files = safeArray(specRead.data?.files);
  const tenantSummary = safeArray(specRead.data?.tenant_summary);
  const costs = safeArray(costRead.data?.rows);
  const specsByAsset = new Map(specs.map((row) => [row.asset_id, row]));
  const filesByAsset = new Map();
  files.forEach((row) => filesByAsset.set(row.asset_id, (filesByAsset.get(row.asset_id) || 0) + 1));
  const tenantsByAsset = new Map();
  tenantSummary.forEach((row) => {
    const assetRows = tenantsByAsset.get(row.asset_id) || [];
    assetRows.push(row);
    tenantsByAsset.set(row.asset_id, assetRows);
  });
  const latestCostByAsset = new Map();
  costs.forEach((row) => {
    if (!latestCostByAsset.has(row.asset_id)) latestCostByAsset.set(row.asset_id, row);
  });
  const rows = assets.map((asset) => ({
    ...asset,
    spec: specsByAsset.get(asset.asset_id) || {},
    cost: latestCostByAsset.get(asset.asset_id) || {},
    file_count: filesByAsset.get(asset.asset_id) || 0,
    tenants: tenantsByAsset.get(asset.asset_id) || [],
  }));
  return (
    <div className="space-y-5">
      {specRead.error || costRead.error ? <div className="rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[13px] text-[#FFD479]">{specRead.error || costRead.error}</div> : null}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard label="자산" value={`${formatNumber(assets.length)}개`} detail="권한 범위 내 비교 대상" />
        <MetricCard label="스펙 입력" value={`${formatNumber(specs.length)}건`} detail="상/저온, 층고, 통로 폭 등" />
        <MetricCard label="첨부 파일" value={`${formatNumber(files.length)}건`} detail="평면도, 면적표, 사진" />
        <MetricCard label="임차인 점유" value={`${formatNumber(tenantSummary.length)}건`} detail="자산별 임차인 연결" />
      </section>
      <section className={`${CARD} p-5`}>
        <ModuleHeader eyebrow="ASSET SPEC" title="자산 스펙 비교" />
        <Table
          minWidth={1180}
          headers={['자산', '상/저온', '층고', '통로 폭', '램프 폭', '바닥하중', '임차인 점유', '평면도 파일']}
          rows={rows.map((row) => [
            text(row.asset_name),
            text(row.spec.temperature_type),
            text(row.spec.clear_height_m),
            text(row.spec.corridor_width_m || row.spec.aisle_width_m),
            text(row.spec.ramp_width_m),
            [row.spec.floor_load_warehouse_kg_sqm, row.spec.floor_load_corridor_kg_sqm].filter(Boolean).join(' / ') || '-',
            row.tenants.length ? row.tenants.slice(0, 3).map((tenant) => text(tenant.tenant_name)).join(', ') : '-',
            `${formatNumber(row.file_count)}건`,
          ])}
        />
      </section>
    </div>
  );
}

export function AssetSpecDashboard() {
  const specRead = useEdgeData('asset-spec/read', {}, []);
  const costRead = useEdgeData('operating-costs/read', {}, []);
  const assets = safeArray(specRead.data?.assets);
  const specs = safeArray(specRead.data?.specs);
  const files = safeArray(specRead.data?.files);
  const tenantSummary = safeArray(specRead.data?.tenant_summary);
  const costs = safeArray(costRead.data?.rows);
  const specsByAsset = new Map(specs.map((row) => [row.asset_id, row]));
  const filesByAsset = new Map();
  files.forEach((row) => filesByAsset.set(row.asset_id, (filesByAsset.get(row.asset_id) || 0) + 1));
  const tenantsByAsset = new Map();
  tenantSummary.forEach((row) => {
    const assetRows = tenantsByAsset.get(row.asset_id) || [];
    assetRows.push(row);
    tenantsByAsset.set(row.asset_id, assetRows);
  });
  const latestCostByAsset = new Map();
  costs.forEach((row) => {
    if (!latestCostByAsset.has(row.asset_id)) latestCostByAsset.set(row.asset_id, row);
  });
  const rows = assets.map((asset) => ({
    ...asset,
    spec: specsByAsset.get(asset.asset_id) || {},
    cost: latestCostByAsset.get(asset.asset_id) || {},
    file_count: filesByAsset.get(asset.asset_id) || 0,
    tenants: tenantsByAsset.get(asset.asset_id) || [],
  }));
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const left = rows.find((row) => row.asset_id === leftId) || rows[0] || null;
  const right = rows.find((row) => row.asset_id === rightId) || rows[1] || rows[0] || null;
  const specItems = [
    ['상/저온', (row) => row?.spec?.temperature_type],
    ['권역', (row) => row?.region || row?.capital_region || row?.national_region || row?.region_group || row?.spec?.region],
    ['연면적(평)', (row) => row?.gross_floor_area_py || row?.spec?.gross_area_py],
    ['층고(m)', (row) => row?.spec?.clear_height_m],
    ['통로 폭(m)', (row) => row?.spec?.corridor_width_m || row?.spec?.aisle_width_m],
    ['램프 폭(m)', (row) => row?.spec?.ramp_width_m],
    ['창고 바닥하중', (row) => row?.spec?.floor_load_warehouse_kg_sqm],
    ['통로 바닥하중', (row) => row?.spec?.floor_load_corridor_kg_sqm],
    ['도면/면적표 파일', (row) => `${formatNumber(row?.file_count || 0)}건`],
    ['현재 임차인', (row) => row?.tenants?.length ? row.tenants.slice(0, 4).map((tenant) => text(tenant.tenant_name)).join(', ') : '-'],
  ];
  const tenantRows = tenantSummary.map((tenant) => {
    const asset = rows.find((row) => row.asset_id === tenant.asset_id) || {};
    return {
      id: `${tenant.asset_id}:${tenant.tenant_name}`,
      tenant_name: tenant.tenant_name,
      asset_name: asset.asset_name,
      region: asset.region || asset.capital_region || asset.national_region || asset.region_group || asset.spec?.region,
      leased_area_sqm: tenant.leased_area_sqm,
      temperature_type: asset.spec?.temperature_type,
      clear_height_m: asset.spec?.clear_height_m,
      corridor_width_m: asset.spec?.corridor_width_m || asset.spec?.aisle_width_m,
      ramp_width_m: asset.spec?.ramp_width_m,
      floor_load: [asset.spec?.floor_load_warehouse_kg_sqm, asset.spec?.floor_load_corridor_kg_sqm].filter(Boolean).join(' / '),
    };
  });
  return (
    <div className="space-y-5">
      {specRead.error || costRead.error ? <div className="rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[13px] text-[#FFD479]">{specRead.error || costRead.error}</div> : null}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard label="자산" value={`${formatNumber(assets.length)}개`} detail="비교 가능한 자산" />
        <MetricCard label="스펙 입력" value={`${formatNumber(specs.length)}건`} detail="상/저온, 층고, 통로 폭 등" />
        <MetricCard label="첨부 파일" value={`${formatNumber(files.length)}건`} detail="평면도, 면적표, 사진" />
        <MetricCard label="임차인 점유" value={`${formatNumber(tenantSummary.length)}건`} detail="임차인별 스펙 비교 기준" />
      </section>
      <section className={`${CARD} p-5`}>
        <ModuleHeader eyebrow="ASSET SPEC" title="자산 스펙 좌우 비교" subtitle="비교할 두 자산을 선택해 상/저온, 층고, 통로 폭, 램프 폭, 바닥하중, 임차인 점유를 나란히 확인합니다." />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[['left', left, leftId, setLeftId], ['right', right, rightId, setRightId]].map(([side, selected, selectedId, setSelected]) => (
            <div key={side} className={`${INNER} p-4`}>
              <select
                value={selected?.asset_id || selectedId || ''}
                onChange={(event) => setSelected(event.target.value)}
                className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[13px] font-semibold text-white outline-none"
              >
                {rows.map((row) => <option key={row.asset_id} value={row.asset_id}>{row.asset_name}</option>)}
              </select>
              <div className="mt-4 text-[18px] font-semibold text-white">{text(selected?.asset_name)}</div>
              <div className="mt-1 text-[12px] text-[#86868B]">{text(selected?.current_manager_name, '담당자 미입력')}</div>
              <div className="mt-4 divide-y divide-[#303033] rounded-[12px] border border-[#333333]">
                {specItems.map(([label, getter]) => (
                  <div key={label} className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 px-3 py-2">
                    <div className="text-[12px] font-semibold text-[#86868B]">{label}</div>
                    <div className="min-w-0 break-words text-[12px] text-white">{label === '권역' ? formatRegionLabel(getter(selected)) : text(getter(selected))}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className={`${CARD} p-5`}>
        <ModuleHeader eyebrow="TENANT SPEC FIT" title="임차인별 점유 자산 스펙 비교" subtitle="추후 임차인 요구 스펙과 실제 점유 자산의 스펙 차이를 비교하기 위한 작업 영역입니다." />
        <SortableTable
          minWidth={1190}
          stickyCount={2}
          defaultSort={{ key: 'tenant_name', direction: 'asc' }}
          columns={[
            { key: 'tenant_name', label: '임차인', width: 168 },
            { key: 'asset_name', label: '점유 자산', width: 168 },
            { key: 'region', label: '권역', width: 150, render: (row) => row.region ? formatRegionLabel(row.region) : '-', sortValue: (row) => regionValue(row.region) },
            { key: 'temperature_type', label: '상/저온' },
            { key: 'leased_area_sqm', label: '임대면적(㎡)', align: 'right', render: (row) => formatNumber(row.leased_area_sqm, 1), sortValue: (row) => number(row.leased_area_sqm) },
            { key: 'clear_height_m', label: '층고(m)', align: 'right', render: (row) => text(row.clear_height_m), sortValue: (row) => number(row.clear_height_m) },
            { key: 'corridor_width_m', label: '통로 폭(m)', align: 'right', render: (row) => text(row.corridor_width_m), sortValue: (row) => number(row.corridor_width_m) },
            { key: 'ramp_width_m', label: '램프 폭(m)', align: 'right', render: (row) => text(row.ramp_width_m), sortValue: (row) => number(row.ramp_width_m) },
            { key: 'floor_load', label: '바닥하중(창고/통로)' },
          ]}
          rows={tenantRows}
          empty="아직 임차인별 스펙 비교 데이터가 없습니다."
        />
      </section>
    </div>
  );
}

export function DataManagementDashboard() {
  const [tab, setTab] = useState('my');
  const [selectedRowId, setSelectedRowId] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [afterValue, setAfterValue] = useState('');
  const [reason, setReason] = useState('');
  const [managementSourceId, setManagementSourceId] = useState('전체');
  const [managementAsset, setManagementAsset] = useState('전체');
  const [managementFund, setManagementFund] = useState('전체');
  const [managementSearch, setManagementSearch] = useState('');
  const [submitStatus, setSubmitStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { loading, error, data, reload } = useEdgeData('data-management/status', { limit: 100, row_limit: 160 }, []);
  const sources = safeArray(data?.sources);
  const sheets = safeArray(data?.sheets);
  const columns = safeArray(data?.columns);
  const sourceRows = safeArray(data?.source_rows);
  const edits = safeArray(data?.edit_requests);
  const domainStats = safeArray(data?.domain_stats);
  const tabs = [
    { id: 'my', label: '내 작업' },
    { id: 'lease', label: '임대차' },
    { id: 'fund', label: '펀드/금융' },
    { id: 'market', label: '시장자료' },
    { id: 'permission', label: '권한/사용자' },
    { id: 'spec', label: '자산 스펙' },
    { id: 'cost', label: '운영비용' },
    { id: 'approval', label: '승인 대기' },
    { id: 'history', label: '반영 이력' },
  ];
  const domainForTab = {
    lease: 'lease_contracts',
    fund: 'fund_info',
    market: 'sector_market',
    permission: 'permissions',
    spec: 'asset_specs',
    cost: 'operating_costs',
  }[tab];
  const domainRows = domainForTab
    ? sourceRows.filter((row) => sources.find((source) => source.source_file_id === row.source_file_id)?.source_domain === domainForTab)
    : sourceRows;
  const rowOptionValue = (row, keys) => {
    const values = row?.row_values && typeof row.row_values === 'object' ? row.row_values : {};
    return text(firstText(...keys.map((key) => values[key])), '');
  };
  const assetKeys = ['자산명', '물류센터명', '센터명', '창고명', 'asset_name', 'center_name', 'warehouse_name'];
  const fundKeys = ['펀드명', 'fund_name', 'display_name'];
  const rowSearchText = (row) => [
    text(row.sheet_name, ''),
    rowOptionValue(row, assetKeys),
    rowOptionValue(row, fundKeys),
    sourceRowDisplayTitle(row),
    sourceRowDisplaySummary(row),
  ].join(' ').toLowerCase();
  const managementSourceOptions = [{ value: '전체', label: '전체 원천' }, ...sources
    .filter((source) => !domainForTab || source.source_domain === domainForTab)
    .map((source) => ({ value: source.source_file_id, label: `${sourceDomainLabel(source.source_domain)} · ${text(source.file_name)}` }))];
  const managementAssetOptions = ['전체', ...new Set(domainRows.map((row) => rowOptionValue(row, assetKeys)).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko')))];
  const managementFundOptions = ['전체', ...new Set(domainRows.map((row) => rowOptionValue(row, fundKeys)).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko')))];
  const filteredRows = domainRows
    .filter((row) => managementSourceId === '전체' || row.source_file_id === managementSourceId)
    .filter((row) => managementAsset === '전체' || rowOptionValue(row, assetKeys) === managementAsset)
    .filter((row) => managementFund === '전체' || rowOptionValue(row, fundKeys) === managementFund)
    .filter((row) => !managementSearch || rowSearchText(row).includes(managementSearch.toLowerCase()));
  const accessScope = text(data?.access_scope, 'unknown');
  const managedAssetCodes = safeArray(data?.managed_asset_codes);
  const rowAccessMessage = !sourceRows.length
    ? (accessScope === 'manager_full_source'
      ? '아직 조회 가능한 원천 행이 없습니다. 원천 파일 업로드 또는 active source 상태를 확인해 주세요.'
      : `현재 계정은 담당 자산 범위만 조회할 수 있습니다.${managedAssetCodes.length ? ` 담당 자산: ${managedAssetCodes.join(', ')}` : ' 담당 자산이 배정되지 않았습니다.'}`)
    : (!filteredRows.length ? '선택한 업무 구분에 해당하는 원천 행이 없습니다. 다른 업무 탭을 선택하거나 원천 매핑 상태를 확인해 주세요.' : '');
  const selectedRow = filteredRows.find((row) => row.source_row_id === selectedRowId) || filteredRows[0] || null;
  const rowValues = selectedRow?.row_values && typeof selectedRow.row_values === 'object' ? selectedRow.row_values : {};
  const editableFields = Object.keys(rowValues).filter(isUserVisibleField).slice(0, 80);
  const currentBeforeValue = selectedField ? text(rowValues[selectedField], '') : '';
  const currentBeforeDisplayValue = selectedField ? formatDisplayValue(currentBeforeValue, selectedField) : '';
  const afterDisplayValue = selectedField && afterValue ? formatDisplayValue(afterValue, selectedField) : '';
  const selectedSource = sources.find((row) => row.source_file_id === selectedRow?.source_file_id) || {};
  const selectedDomainStats = domainStats.find((row) => row.source_domain === domainForTab) || {};
  const hasPendingChange = Boolean(selectedRow && selectedField && afterValue && afterValue !== currentBeforeValue);
  const previewErrors = safeArray(preview?.validations).filter((item) => item.level === 'error');
  useEffect(() => {
    setSelectedRowId('');
    setSelectedField('');
    setAfterValue('');
    setReason('');
    setManagementSourceId('전체');
    setManagementAsset('전체');
    setManagementFund('전체');
    setManagementSearch('');
    setSubmitStatus(null);
    setPreview(null);
  }, [tab]);
  useEffect(() => {
    if (selectedRowId && !filteredRows.some((row) => row.source_row_id === selectedRowId)) setSelectedRowId('');
  }, [filteredRows, selectedRowId]);
  useEffect(() => {
    if ((!selectedField || !editableFields.includes(selectedField)) && editableFields.length) setSelectedField(editableFields[0]);
  }, [editableFields.join('|'), selectedField]);
  useEffect(() => {
    let active = true;
    if (!hasPendingChange || !selectedRow || !selectedField) {
      setPreview(null);
      setPreviewLoading(false);
      return () => { active = false; };
    }
    setPreviewLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await invoke('data-management/preview-edit', {
          source_row_id: selectedRow.source_row_id,
          field_name: selectedField,
          before_value: currentBeforeValue,
          requested_value: afterValue,
          source_domain: selectedSource.source_domain,
          sheet_name: selectedRow.sheet_name,
          row_number: selectedRow.row_number,
        });
        if (active) setPreview(result);
      } catch (previewError) {
        if (active) setPreview({ validations: [{ level: 'error', code: 'preview_failed', message: previewError.message || '검증에 실패했습니다.' }], can_submit: false });
      } finally {
        if (active) setPreviewLoading(false);
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [hasPendingChange, selectedRow?.source_row_id, selectedField, currentBeforeValue, afterValue, selectedSource.source_domain]);
  const sourceCards = SOURCE_DOMAINS.map((domain) => {
    const rows = domainSources(sources, domain.key);
    const active = rows.find((row) => row.active_version) || rows[0] || {};
    const stats = domainStats.find((row) => row.source_domain === domain.key) || {};
    return { ...domain, count: rows.length, active, stats };
  });
  const submitEdit = async () => {
    if (!selectedRow || !selectedField || !afterValue || afterValue === currentBeforeValue) {
      setSubmitStatus({ type: 'error', message: '변경할 행, 필드, 변경 후 값을 입력해 주세요.' });
      return;
    }
    if (previewErrors.length) {
      setSubmitStatus({ type: 'error', message: previewErrors[0].message || '검증 오류를 먼저 확인해 주세요.' });
      return;
    }
    setSubmitStatus({ type: 'pending', message: '승인 요청을 저장하는 중입니다.' });
    try {
      const source = sources.find((row) => row.source_file_id === selectedRow.source_file_id) || {};
      await invoke('data-management/submit-edit', {
        source_table: 'public.ll_source_rows',
        source_domain: source.source_domain,
        target_type: `${source.source_domain || 'source'}_edit`,
        target_name: `${selectedRow.sheet_name} ${selectedRow.row_number}행`,
        target_row_id: selectedRow.source_row_id,
        field_name: selectedField,
        before_value: currentBeforeValue,
        requested_value: afterValue,
        target_table: preview?.target?.target_table,
        target_field: preview?.target?.target_field,
        target_record_id: preview?.target?.target_row_id,
        primary_key_field: preview?.target?.primary_key_field,
        reason,
        sheet_name: selectedRow.sheet_name,
        row_number: selectedRow.row_number,
        impact_summary: '원본 행 변경 요청입니다. 승인 후 정규 테이블 반영 여부를 검토해야 합니다.',
      });
      setSubmitStatus({ type: 'success', message: '승인 요청이 저장되었습니다. 승인 대기 탭에서 처리 상태를 확인해 주세요.' });
      reload();
    } catch (submitError) {
      setSubmitStatus({ type: 'error', message: submitError.message || '승인 요청 저장에 실패했습니다.' });
    }
  };
  const reviewEdit = async (action, row) => {
    const id = row.request_id || row.id;
    if (!id) return;
    setSubmitStatus({ type: 'pending', message: '요청을 처리하는 중입니다.' });
    try {
      if (action === 'readback') await invoke('edits/readback', { id });
      if (action === 'approve') await invoke('edits/approve', { id, approval_note: 'Data Management 승인' });
      if (action === 'reject') await invoke('edits/reject', { id, rejection_note: 'Data Management 반려' });
      setSubmitStatus({ type: 'success', message: '요청 처리가 완료되었습니다.' });
      reload();
    } catch (reviewError) {
      setSubmitStatus({ type: 'error', message: reviewError.message || '요청 처리에 실패했습니다.' });
    }
  };
  const sourcePreviewRows = filteredRows.slice(0, 80).map((row) => [
    sourceDomainLabel(sources.find((source) => source.source_file_id === row.source_file_id)?.source_domain),
    text(row.sheet_name),
    `${formatNumber(row.row_number)}행`,
    sourceRowDisplayTitle(row),
    sourceRowDisplaySummary(row),
    safeArray(row.validation_flags).length ? `${safeArray(row.validation_flags).length}건` : '통과',
  ]);
  return (
    <div className="w-full max-w-[1480px] mx-auto px-8 pt-8 pb-14">
      <ModuleHeader eyebrow="DATA MANAGEMENT" title="Data Management" subtitle="Excel 원천, 검증, 변경 전후 비교, 승인 요청, 반영 이력을 한 화면에서 관리합니다." right={<button type="button" onClick={reload} className="h-9 rounded-[8px] border border-[#3A3A3C] px-3 text-[13px] font-semibold text-white hover:bg-white/5">새로고침</button>} />
      <div className="mb-5">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </div>
      <section className={`${CARD} mb-5 p-5`}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            ['1. 데이터 종류 선택', '임대차, 펀드/금융, 시장자료, 권한, 자산 스펙, 운영비용 중 고칠 업무를 먼저 고릅니다.'],
            ['2. 원천 행 선택', '엑셀에서 들어온 원본 행을 선택해 어떤 값이 현재 저장돼 있는지 확인합니다.'],
            ['3. 변경값 입력', '현재값과 변경값을 나란히 보면서 단위, 필수값, 중복 여부를 확인합니다.'],
            ['4. 승인 요청', '바로 DB를 바꾸지 않고 승인 대기에 올린 뒤, 관리자가 반영합니다.'],
          ].map(([title, body]) => (
            <div key={title} className={`${INNER} px-4 py-4`}>
              <div className="text-[13px] font-semibold text-white">{title}</div>
              <div className="mt-2 text-[12px] leading-5 text-[#A1A1AA]">{body}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[12px] leading-5 text-[#86868B]">
          선택한 원천과 자산 범위에 맞춰 수정 가능한 행과 필드를 보여주고, 저장 전 검증과 변경 전후 비교를 먼저 확인합니다.
        </div>
      </section>
      {error ? <div className="mb-4 rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[13px] text-[#FFD479]">{error}</div> : null}
      {loading ? <div className={`${INNER} px-4 py-6 text-center text-[#A1A1AA]`}>데이터 관리 현황을 불러오는 중입니다.</div> : null}
      {tab === 'my' ? (
        <div className="space-y-5">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard label="원천 파일" value={`${formatNumber(sources.length)}개`} detail="Excel active/draft 버전" />
            <MetricCard label="시트" value={`${formatNumber(sheets.length)}개`} detail="header, row count 추적" />
            <MetricCard label="컬럼" value={`${formatNumber(columns.length)}개`} detail="원본 컬럼 및 매핑 정보" />
            <MetricCard label="승인 대기" value={`${formatNumber(edits.filter((row) => row.status === 'submitted').length)}건`} detail="검토 후 반영" />
          </section>
          <section className="grid grid-cols-1 gap-3 xl:grid-cols-6">
            {sourceCards.map((item) => (
              <button key={item.key} type="button" onClick={() => setTab(item.key === 'lease_contracts' ? 'lease' : item.key === 'fund_info' ? 'fund' : item.key === 'sector_market' ? 'market' : item.key === 'permissions' ? 'permission' : item.key === 'operating_costs' ? 'cost' : 'spec')} className={`${INNER} px-4 py-4 text-left hover:bg-[#262626]`}>
                <div className="text-[13px] font-semibold text-white">{item.label}</div>
                <div className="mt-2 min-h-[40px] text-[12px] leading-5 text-[#A1A1AA]">{text(item.active.file_name, '아직 업로드 없음')}</div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-[#86868B]">
                  <span>{formatNumber(item.count)} versions</span>
                  <span>{item.active.active_version ? 'Active' : 'Draft'}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-[#86868B]">
                  <span>승인대기 {formatNumber(item.stats.pending_edits || 0)}건</span>
                  <span>{item.stats.latest_edit_at ? formatDate(item.stats.latest_edit_at) : '이력 없음'}</span>
                </div>
              </button>
            ))}
          </section>
        </div>
      ) : null}

      {['lease', 'fund', 'market', 'permission', 'spec', 'cost'].includes(tab) ? (
        <div className="space-y-5">
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="TARGET SELECTOR" title="관리 대상 선택" subtitle="원천, 자산, 펀드, 검색어를 먼저 고르면 아래 수정 대상 행과 미리보기가 즉시 좁혀집니다." />
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
              <label className="text-[12px] font-semibold text-[#A1A1AA]">
                원천
                <select value={managementSourceId} onChange={(event) => setManagementSourceId(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-white outline-none">
                  {managementSourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="text-[12px] font-semibold text-[#A1A1AA]">
                자산
                <select value={managementAsset} onChange={(event) => setManagementAsset(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-white outline-none">
                  {managementAssetOptions.map((option) => <option key={option} value={option}>{option === '전체' ? '전체 자산' : option}</option>)}
                </select>
              </label>
              <label className="text-[12px] font-semibold text-[#A1A1AA]">
                펀드
                <select value={managementFund} onChange={(event) => setManagementFund(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-white outline-none">
                  {managementFundOptions.map((option) => <option key={option} value={option}>{option === '전체' ? '전체 펀드' : option}</option>)}
                </select>
              </label>
              <label className="text-[12px] font-semibold text-[#A1A1AA]">
                검색
                <input value={managementSearch} onChange={(event) => setManagementSearch(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-white outline-none" placeholder="자산명, 펀드명, 시트, 값 검색" />
              </label>
            </div>
            <div className="mt-3 text-[12px] text-[#86868B]" data-data-management-selector-count="true">
              전체 {formatNumber(domainRows.length)}행 중 {formatNumber(filteredRows.length)}행 표시
            </div>
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="INPUT WIZARD" title={`${tabs.find((item) => item.id === tab)?.label} 입력 마법사`} subtitle="대형 표 직접 수정은 보조 기능으로 두고, 행 선택, 필드 선택, 값 검증, 변경 전후 비교, 승인 요청 순서로 처리합니다." />
            {rowAccessMessage ? (
              <div className={`${INNER} px-4 py-5 text-[13px] leading-6 text-[#A1A1AA]`}>
                {rowAccessMessage}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className={`${INNER} p-4`}>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="text-[12px] font-semibold text-[#A1A1AA]">
                      원본 행
                      <select value={selectedRow?.source_row_id || ''} onChange={(event) => setSelectedRowId(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-white outline-none">
                        {filteredRows.slice(0, 200).map((row) => (
                          <option key={row.source_row_id} value={row.source_row_id}>{row.sheet_name} · {row.row_number}행</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[12px] font-semibold text-[#A1A1AA]">
                      수정 필드
                      <select value={selectedField} onChange={(event) => { setSelectedField(event.target.value); setAfterValue(''); }} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-white outline-none">
                        {editableFields.length ? editableFields.map((field) => <option key={field} value={field}>{fieldDisplayLabel(field)}</option>) : <option value="">표시 가능한 필드 없음</option>}
                      </select>
                    </label>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="text-[12px] font-semibold text-[#A1A1AA]">
                      변경 전
                      <textarea value={currentBeforeDisplayValue} readOnly className="mt-2 h-24 w-full resize-none rounded-[8px] border border-[#333333] bg-[#151515] px-3 py-2 text-[13px] text-[#C7C7CC] outline-none" />
                    </label>
                    <label className="text-[12px] font-semibold text-[#A1A1AA]">
                      변경 후
                      <textarea value={afterValue} onChange={(event) => setAfterValue(event.target.value)} className="mt-2 h-24 w-full resize-none rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 py-2 text-[13px] text-white outline-none focus:border-[#8E8E93]" />
                    </label>
                  </div>
                  <label className="mt-4 block text-[12px] font-semibold text-[#A1A1AA]">
                    수정 사유
                    <input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-white outline-none focus:border-[#8E8E93]" placeholder="예: PM 제출 자료 반영, 분기 Excel 업데이트" />
                  </label>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={submitEdit}
                      disabled={!hasPendingChange || previewLoading || previewErrors.length > 0}
                      className="h-10 rounded-[8px] bg-white px-4 text-[13px] font-bold text-[#1F1F1E] hover:bg-[#E5E5E5] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {previewLoading ? '검증 중' : '승인 요청 저장'}
                    </button>
                    {submitStatus ? <span className={`text-[12px] ${submitStatus.type === 'error' ? 'text-[#FF9F9F]' : submitStatus.type === 'success' ? 'text-[#B5E48C]' : 'text-[#A1A1AA]'}`}>{submitStatus.message}</span> : null}
                  </div>
                </div>
                <div className={`${INNER} p-4`}>
                  <div className="text-[13px] font-semibold text-white">저장 전 영향 범위</div>
                  <div className="mt-3 space-y-2 text-[12px] leading-5 text-[#A1A1AA]">
                    <div>원천: {sourceDomainLabel(selectedSource.source_domain || domainForTab)}</div>
                    <div>시트/행: {selectedRow ? `${selectedRow.sheet_name} ${selectedRow.row_number}행` : '-'}</div>
                    <div>필드: {selectedField ? fieldDisplayLabel(selectedField) : '-'}</div>
                    <div>상태: {hasPendingChange ? '변경 감지' : '변경 없음'}</div>
                    <div>승인 대기: {formatNumber(selectedDomainStats.pending_edits || 0)}건</div>
                    <div>반영 방식: {preview?.auto_write_enabled ? '승인 후 자동 readback/반영 가능' : '승인 요청 검토 필요'}</div>
                  </div>
                  {hasPendingChange ? (
                    <div className="mt-4 rounded-[10px] border border-[#333333] bg-[#171717] p-3">
                      <div className="text-[12px] font-semibold text-white">저장 전 검증</div>
                      {previewLoading ? (
                        <div className="mt-2 text-[12px] text-[#A1A1AA]">검증 중입니다.</div>
                      ) : safeArray(preview?.validations).length ? (
                        <div className="mt-2 space-y-1">
                          {safeArray(preview?.validations).map((item, index) => (
                            <div key={`${item.code || 'validation'}-${index}`} className={`text-[12px] leading-5 ${item.level === 'error' ? 'text-[#FF9F9F]' : item.level === 'warning' ? 'text-[#FFD479]' : 'text-[#A1A1AA]'}`}>
                              {text(item.message)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-[12px] text-[#A1A1AA]">검증 오류가 없습니다.</div>
                      )}
                    </div>
                  ) : null}
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-[10px] border border-[#333333] bg-[#171717] p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">Before</div>
                      <div className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[12px] leading-5 text-[#C7C7CC]">{currentBeforeDisplayValue || '-'}</div>
                    </div>
                    <div className={`rounded-[10px] border p-3 ${hasPendingChange ? 'border-[#4B5563] bg-[#182018]' : 'border-[#333333] bg-[#171717]'}`}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">After</div>
                      <div className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[12px] leading-5 text-white">{afterDisplayValue || '-'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="SOURCE PREVIEW" title="원본 행 미리보기" />
            <Table
              minWidth={1180}
              maxHeight={460}
              stickyCount={1}
              columnWidths={[120, 180, 92, 240, 420, 120]}
              headers={['원천', '시트', '행', '대표 값', '요약', '검증']}
              rows={sourcePreviewRows}
            />
          </section>
        </div>
      ) : null}

      {tab === 'approval' ? (
        <section className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="APPROVAL" title="승인 대기" />
          <SortableTable
            minWidth={1180}
            stickyCount={2}
            defaultSort={{ key: 'created_at', direction: 'desc' }}
            columns={[
              { key: 'source_domain', label: '구분', width: 130, render: (row) => sourceDomainLabel(row.source_domain) },
              { key: 'target_name', label: '대상', width: 220, render: (row) => publicDisplayText(row.target_name) },
              { key: 'field_name', label: '필드', width: 150, render: (row) => fieldDisplayLabel(row.field_name) },
              { key: 'before_value', label: '변경 전', width: 180, render: (row) => formatDisplayValue(row.before_value, row.field_name) },
              { key: 'requested_value', label: '변경 후', width: 180, render: (row) => formatDisplayValue(row.requested_value, row.field_name) },
              { key: 'write_status', label: '상태', width: 150, render: (row) => text(row.write_status || row.status) },
              { key: 'requester_label', label: '요청자', width: 180, render: (row) => text(row.requester_label, '요청자') },
              { key: 'created_at', label: '생성일', width: 120, render: (row) => formatDate(row.created_at), sortValue: (row) => text(row.created_at) },
              {
                key: 'actions',
                label: '처리',
                width: 240,
                sortable: false,
                render: (row) => {
                  const payload = row.request_payload && typeof row.request_payload === 'object' ? row.request_payload : {};
                  const autoWrite = payload.auto_write_enabled === true;
                  return data?.can_approve ? (
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" disabled={!autoWrite} onClick={(event) => { event.stopPropagation(); reviewEdit('readback', row); }} className="h-7 rounded-[7px] border border-[#3A3A3C] px-2 text-[11px] font-semibold text-white disabled:opacity-30">Readback</button>
                      <button type="button" disabled={!autoWrite} onClick={(event) => { event.stopPropagation(); reviewEdit('approve', row); }} className="h-7 rounded-[7px] border border-[#3A3A3C] bg-white px-2 text-[11px] font-bold text-[#1F1F1E] disabled:opacity-30">승인</button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); reviewEdit('reject', row); }} className="h-7 rounded-[7px] border border-[#3A3A3C] px-2 text-[11px] font-semibold text-[#A1A1AA]">반려</button>
                    </div>
                  ) : <span className="text-[12px] text-[#86868B]">권한 없음</span>;
                },
              },
            ]}
            rows={edits.filter((row) => row.status === 'submitted')}
          />
          {submitStatus ? <div className={`mt-3 text-[12px] ${submitStatus.type === 'error' ? 'text-[#FF9F9F]' : submitStatus.type === 'success' ? 'text-[#B5E48C]' : 'text-[#A1A1AA]'}`}>{submitStatus.message}</div> : null}
        </section>
      ) : null}

      {tab === 'history' ? (
        <div className="space-y-5">
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="EDIT HISTORY" title="승인/반영 요청 이력" />
            <Table
              minWidth={1220}
              headers={['구분', '대상', '필드', '변경 후', 'Readback', '처리상태', '승인자', '업데이트']}
              rows={edits.map((row) => [
                sourceDomainLabel(row.source_domain),
                publicDisplayText(row.target_name),
                fieldDisplayLabel(row.field_name),
                formatDisplayValue(row.requested_value, row.field_name),
                row.readback_value ? formatDisplayValue(row.readback_value, row.field_name) : text(row.readback_value, row.write_status === 'written' ? '확인 필요' : '-'),
                text(row.write_status || row.status),
                text(row.approver_label),
                formatDate(row.written_at || row.updated_at || row.created_at),
              ])}
            />
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="SOURCE HISTORY" title="원천 파일 반영 이력" />
            <Table
              minWidth={980}
              headers={['구분', '파일', '버전', 'Active', '상태', '행수', '업데이트']}
              rows={sources.map((row) => [
                sourceDomainLabel(row.source_domain),
                text(row.file_name),
                text(row.source_version),
                row.active_version ? 'Y' : 'N',
                text(row.parse_status),
                formatNumber(Object.values(row.row_counts || {}).reduce((sum, value) => sum + number(value), 0)),
                formatDate(row.updated_at || row.created_at),
              ])}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}

export function HomeOperatingCostSummary() {
  const { data, error, loading } = useEdgeData('operating-costs/read', {}, []);
  const rows = safeArray(data?.rows);
  const summary = data?.summary || {};
  const latestRows = rows.slice(0, 12);
  const chartRows = latestRows.map((row) => ({
    label: row.asset_name || row.asset_id,
    value: number(row.pm_cost_krw) + number(row.fm_cost_krw) + number(row.insurance_cost_krw) + number(row.utility_cost_krw),
  }));
  return (
    <section className={`${CARD} p-5`}>
      <ModuleHeader eyebrow="OPERATING COST" title="운영비용 포트폴리오 비교" subtitle="PM, FM, 보험료, Utility를 자산별로 비교합니다. 아직 입력되지 않은 자산은 Data Management에서 추가합니다." />
      {error ? <div className="mb-4 rounded-[12px] border border-[#4C4329] bg-[#2B2613] px-4 py-3 text-[13px] text-[#F7D774]">{error}</div> : null}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard label="PM 비용" value={loading ? '조회 중' : formatKrw(summary.pm_cost_krw)} />
        <MetricCard label="FM 비용" value={loading ? '조회 중' : formatKrw(summary.fm_cost_krw)} />
        <MetricCard label="보험료" value={loading ? '조회 중' : formatKrw(summary.insurance_cost_krw)} />
        <MetricCard label="Utility" value={loading ? '조회 중' : formatKrw(summary.utility_cost_krw)} />
      </div>
      <div className="mb-5">
        <BarList rows={chartRows} formatter={formatKrw} color={CHART_COLORS.primary} />
      </div>
      <Table
        minWidth={980}
        headers={['자산', '기간', 'PM', 'FM', 'PM 인원', 'FM 인원', '보험료', 'Utility']}
        rows={latestRows.map((row) => [
          text(row.asset_name || row.asset_id),
          [formatDate(row.period_start), formatDate(row.period_end)].filter((value) => value !== '-').join(' ~ ') || '-',
          formatKrw(row.pm_cost_krw),
          formatKrw(row.fm_cost_krw),
          formatNumber(row.pm_headcount),
          formatNumber(row.fm_headcount),
          formatKrw(row.insurance_cost_krw),
          formatKrw(row.utility_cost_krw),
        ])}
        empty={loading ? '운영비용 데이터를 불러오는 중입니다.' : '아직 입력된 운영비용 데이터가 없습니다.'}
      />
    </section>
  );
}
